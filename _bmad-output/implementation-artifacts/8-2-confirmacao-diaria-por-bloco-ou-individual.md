---
baseline_commit: ecb9f373e03fe4b67315624253da88569b0346a3
---

# Story 8.2: Confirmação diária por bloco ou individual

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero confirmar meus medicamentos do dia por bloco inteiro ("tomar remédios da manhã") ou individualmente, na superfície diária de Medicamentos,
Para que eu registre a adesão rapidamente no ritual matinal, com dose perdida distinguível de "não aplicável" (FR-3.6, UX-DR11, AR-18/AD-07).

**Segunda story do Épico 8 (Medicamentos).** É a **camada realizada** (snapshot por dia) que se assenta sobre o catálogo versionado da 8.1 — exatamente como `habit_day_entries` (6.2) se assenta sobre `habit_versions` (6.1). Cria o model `MedicationDayEntry` (`medication_day_entries`), o **enum `source`** (`scheduled`/`ad_hoc`), a **materialização ansiosa e idempotente** na 1ª abertura do dia, a **confirmação por bloco (escrita em lote) ou individual (otimista)**, e a **superfície diária** em `/health/medications` (substitui o placeholder atual). Consome os leitores vigentes já escritos na 8.1 (`current_schedule_version_of`, `current_substance_version_of`) e a chave-âncora estável `Medication.id`. A Story 8.3 (histórico + dose perdida + edição avulsa de dia passado) lê estas mesmas linhas.

> **🧭 Divergência-chave — Medicamentos MATERIALIZA por dia; o molde é `habits/` (AD-06/AR-16), NÃO `health/` (log plano).** A camada de saúde (`health_logs`) é um upsert plano por data; não há snapshot congelado. Medicamentos, como hábitos, **congela** `dose_at_time` na 1ª abertura do dia (AD-07 espelha AD-06). **Porte `seed_habit_day` → `seed_medication_day`, `HabitDayEntry` → `MedicationDayEntry`, `update_habit_day_entry` → confirmação por linha, e `HabitDayView.get` (GET materializa + serializa) → `MedicationDayView.get`.** Ver Dev Notes › "Molde a copiar".

> **⚠️ Duas semânticas que NÃO existem em hábitos e são o coração desta story:** (1) **dose perdida ≠ 0% de hábito** — uma linha `scheduled` sem `confirmed_at` num dia passado é um **sinal clínico**, não entra em nenhum denominador; a **exibição** dela como "perda" é a 8.3, mas o **schema e a semântica de ausência** nascem aqui. (2) **`ad_hoc` (PRN)** — medicamento tomado sem previsão, sempre confirmado, sem contrapartida — categoria que hábito não tem. Ver AD-07 itens 8 e 10.

> **⚠️ O comentário da árvore de código de `architecture.md:1106` está DESATUALIZADO** (esboço AD-01 supersedido — `medication_blocks`/`medication_logs`). A AD-07 é a decisão vigente. Se corrigir esse comentário, ele viaja na árvore de trabalho do Hugo, **fora do commit da story** (planning-artifacts nunca entram no commit — ver "Protocolo de commit"). A 8.1 já sinalizou isso e não corrigiu; a 8.2 pode fechar.

## Acceptance Criteria

### AC1 — Model `MedicationDayEntry` (snapshot realizado) + enum `source` + constraint parcial (FR-3.6, AD-07 itens 7/8/9)

**Dado que** o domínio precisa de uma camada realizada por dia,
**Quando** o model é criado,
**Então** existe `medication_day_entries` (`TenantModel`, UUID PK + `user_id`) com: `medication` (FK→Medication, `CASCADE`, `related_name="day_entries"`), `time_block` (FK→TimeBlock, `PROTECT`, **`null=True/blank=True`** — nulo permitido para avulso sem bloco), `date` (DateField), `dose_at_time` (JSONField — congelado da versão vigente em D), `confirmed_at` (DateTimeField `null=True/blank=True` — nulo = não confirmado), `source` (CharField com `choices=Source.choices`, default `Source.SCHEDULED`), `created_at`,
**E** `Source` é um **`TextChoices` de nível de módulo** (`SCHEDULED="scheduled"`, `AD_HOC="ad_hoc"`), aliasado como `MedicationDayEntry.Source`, com `CheckConstraint(condition=Q(source__in=Source.values), name="med_day_entry_source_valid")` — molde `bujo.models.TaskStatus`/`Task` (`backend/bujo/models.py:67-84, 158-162`),
**E** há **`UniqueConstraint` PARCIAL**: `UniqueConstraint(fields=["medication","time_block","date"], condition=Q(source="scheduled"), name="uniq_med_day_entry_scheduled")` — uma linha `scheduled` por `(med, bloco, dia)`; linhas `ad_hoc` **não** são restringidas (permite múltiplos avulsos no mesmo dia/bloco). É a **primeira** constraint parcial do codebase — ver Dev Notes.

### AC2 — Materialização ansiosa e idempotente na 1ª abertura do dia (FR-3.6, AD-07 item 7)

**Dado que** o dia D é aberto pela primeira vez (GET da superfície diária),
**Quando** `seed_medication_day(*, user, date=D)` roda,
**Então** materializa **uma linha `scheduled`** por `(medicamento, bloco)` que tenha uma **versão de agenda vigente e `active=True` em D** (`current_schedule_version_of(med, bloco, D)`), com `dose_at_time` **copiada** dessa versão, `confirmed_at=None`, `source=scheduled`,
**E** é **idempotente e não-destrutivo**: uma 2ª abertura do mesmo dia **não** recria nem sobrescreve linhas existentes (pré-carrega os pares `(medication_id, time_block_id)` já presentes com `source=scheduled` em D e pula-os; padrão create-if-missing, **nunca** `update_or_create` — molde `seed_habit_day`, `backend/habits/services.py:230-271`),
**E** blocos/agendas **inativos** em D (`active=False` ou sem versão vigente) **não** geram linha; medicamentos criados **depois** de D não retroagem (dia passado tem `current_schedule_version_of(...) is None`).

### AC3 — Gap-fill: dia pulado aberto depois usa a versão vigente NAQUELE dia (FR-3.6, NFR-4, AD-07 item 7)

**Dado que** um dia passado D-n nunca foi aberto,
**Quando** é aberto depois (navegação/catch-up via `?date=`),
**Então** `seed_medication_day` semeia com a versão de agenda **vigente em D-n** (`max(effective_from) <= D-n`) — **não** a de hoje — congelando `dose_at_time` daquele dia,
**E** dias já materializados mantêm seu `dose_at_time` congelado mesmo que a agenda mude depois (garantia de fidelidade histórica que a 8.3 vai exibir; molde `test_seed_skipped_day_uses_version_effective_that_day`, `backend/habits/tests/test_services.py:285`).

### AC4 — Endpoint diário: GET materializa + confirmação por linha, por bloco (lote) e avulso (FR-3.6, AD-07 itens 1/8/11)

**Dado que** a superfície diária carrega,
**Quando** faz `GET /api/medications/days/?date=` (default hoje),
**Então** o serviço **materializa** (AC2/AC3) e retorna o read-model do dia: `{date, blocks: [{timeBlockId, timeBlockName, status, entries:[...]}], adHoc:[...]}` — `entries` traz `id`, `medicationId`, `medicationTitle`, `substanceName` (derivado por `current_substance_version_of(med, D)`, AD-07 item 9), `doseAtTime`, `confirmedAt`, `source`,
**E** confirmar **um só** = `PATCH /api/medications/days/{entryId}/` com `{confirmed: bool}` → UPDATE **só naquela linha** (`confirmed_at = now()` ou `None`); não toca agenda nem substância, não sangra para vizinhos (molde `update_habit_day_entry` + `save(update_fields=[...])`),
**E** confirmar o **bloco inteiro** = `POST /api/medications/days/confirm-block/` com `{date, timeBlockId, confirmed: bool}` → **escrita em lote** (`.update(confirmed_at=now())` num único queryset sobre todas as linhas `scheduled` daquele bloco no dia — molde do caso-âncora AD-07 linha 460), atômico,
**E** avulso = `POST /api/medications/days/ad-hoc/` com `{date, medicationId, timeBlockId?(nulo), dose?}` → cria linha `source=ad_hoc` com `confirmed_at = now()`; se `dose` omitida, herda `dose_at_time` da versão vigente (se houver), senão exige dose (AC7).

### AC5 — Medication Block (UX-DR11): cabeçalho + lista nome+dose + "Confirmar todos" + checkbox individual (FR-3.6, UX-DR11)

**Dado que** a superfície diária `/health/medications` está aberta,
**Quando** exibida,
**Então** cada bloco ativo do dia é um **Medication Block**: cabeçalho com **nome do bloco + indicador de estado** (pendente/parcial/confirmado), **lista de linhas nome+dose** (título do medicamento + `doseSummary(doseAtTime)`), um **checkbox individual por linha** e um botão **"Confirmar todos — [nome do bloco]"**,
**E** marcar o checkbox individual chama a mutação **otimista** de confirmação por linha; clicar "Confirmar todos" chama a mutação de confirmação por bloco (lote); ambos refletem na UI **antes** do servidor, com rollback em erro (molde `useMarkHabitEntryMutation` + `useOptimisticMutation`),
**E** o botão "Confirmar todos" fica **desabilitado** quando o bloco já está totalmente confirmado ou não tem linhas pendentes.

### AC6 — Estado do bloco é DERIVADO, nunca armazenado (FR-3.6, AD-07 item 1)

**Dado que** um bloco tem N linhas `scheduled`,
**Quando** o estado do bloco é calculado,
**Então** `status ∈ {confirmed, partial, pending}` é **derivado**: `confirmed` = todas as linhas `scheduled` do bloco confirmadas; `partial` = ≥1 mas não todas; `pending` = nenhuma — **nunca** há coluna/campo de status de bloco no schema,
**E** o indicador de estado usa **texto + ícone** (nunca só cor — WCAG 2.2 AA); um helper puro `deriveBlockStatus(entries)` é a fonte única, usado no render **e** no updater otimista (para o cabeçalho reagir instantaneamente antes do refetch); o backend também computa `status` no payload do GET para o estado inicial (mesmo helper conceitual, provado por teste de serviço).

### AC7 — Medicamento avulso (`ad_hoc` / PRN): sempre confirmado, sem contrapartida (FR-3.6, AD-07 itens 8/10)

**Dado que** Hugo tomou um medicamento **sem previsão** naquele dia,
**Quando** registra o avulso,
**Então** grava linha `source=ad_hoc` com `confirmed_at` **preenchido**, `time_block` **opcional** (pode ser nulo), sem contrapartida esperada e **sem** entrar na constraint parcial de `scheduled`,
**E** a ausência de uma linha `ad_hoc` **nunca** significa perda (só linhas `scheduled` sem `confirmed_at` em dia passado são perda — a semântica, exibida na 8.3, é garantida pelo schema aqui); avulsos aparecem numa seção "Avulso/PRN" da superfície, distinta dos blocos agendados.

### AC8 — Superfície diária em `/health/medications`: substitui placeholder; estados e a11y (FR-3.6, UX-DR11/DR13/DR14/DR20)

**Dado que** navego por Saúde › Medicamentos,
**Quando** abro `/health/medications`,
**Então** a rota renderiza a **superfície diária real** (não o `PlaceholderPage`), como `<Box component="main" aria-label="Medicamentos">` (mantendo `handle: {title:'Medicamentos'}`), cobrindo **carregando (skeleton/`role="status"`) / vazio ("Nenhum medicamento para hoje.") / erro de leitura (retry) / erro de escrita (inline `role="alert"`, otimismo revertido)**,
**E** voz pt-BR neutra, **zero gamificação**; alvos ≥44px; indicador de estado nunca só por cor; **nada Query-driven é adicionado ao Sidebar/BottomNav** (a query do dia vive dentro da página no `<Outlet/>` — protege os testes compartilhados da casca, ver Dev Notes).

## Escopo — o que NÃO entra nesta story (limites explícitos)

- ❌ **Histórico de adesão por data / exibição de "dose perdida" como sinal clínico / grid histórico / edição avulsa de um dia passado (corrigir dose ou `confirmed_at` de D-n)** → **Story 8.3** ([Source: epics.md:1335-1351]). A 8.2 cria o schema e a semântica de ausência (`scheduled` sem `confirmed_at`), mas **a superfície de histórico e a edição retroativa são 8.3**. O GET de dias passados via `?date=` (para materialização/catch-up e para a 8.3 ler) é permitido; a **UI de navegação histórica** não é 8.2.
- ❌ **Integração no Daily Log / superfície `/today` ("espinha do ritual matinal")** → a AC de epics fala em "o módulo de medicamentos carrega" e "o Medication Block", **sem** exigir render no `/today`. A superfície canônica da 8.2 é **`/health/medications`**. Integrar o bloco da manhã ao `/today` é **deferível** (ver "Decisões a confirmar" #5) — não construir sem confirmação, para não expandir escopo.
- ❌ **Cadastro/edição de medicamentos, agenda, blocos, médicos** → é a tela de **configuração** `/settings/medications` da **Story 8.1** (já pronta). A 8.2 **consome** o catálogo (leitores vigentes), **não** o edita. Não duplicar `MedicationsManager`.
- ❌ **Cast JSONB analítico / gráficos de dose × peso / `recharts`** → análise futura preservada pelo schema, não construída no MVP ([Source: architecture.md#AD-07 linha 385]).
- ❌ **Qualquer FK entre `medications` e `health`** → domínios independentes, sem FK ([Source: architecture.md#7.1 linha 1151]).
- ❌ **`date.today()` / uso cru de "hoje"** em produção **ou** factories → sempre `today_for(user)` / constantes fixas (guardrail de AST no CI). **Exceção legítima:** `confirmed_at` é um `TIMESTAMPTZ` de auditoria (não uma noção de "dia atual do usuário") — o timestamp de confirmação segue o padrão de timestamps de escrita do codebase, **não** o guardrail de "hoje". Ver Dev Notes › "Tempo" (verificar a regra exata antes de codar).

## Tasks / Subtasks

- [x] **Task 1 — Model `MedicationDayEntry` + enum `source` + migration (AC1)**
  - [x] Em `backend/medications/models.py`: adicionar `Source(models.TextChoices)` **no nível do módulo** (não aninhado — senão o `CheckConstraint` de `Meta` não o enxerga; ver `bujo/models.py:67-73`, `habits/models.py:31-33`): `SCHEDULED="scheduled"`, `AD_HOC="ad_hoc"`. Expor como `MedicationDayEntry.Source = Source` (molde `Task.Status = TaskStatus`).
  - [x] `MedicationDayEntry(TenantModel)`: `medication` (FK→Medication, `on_delete=CASCADE`, `related_name="day_entries"`), `time_block` (FK→TimeBlock, `on_delete=PROTECT`, `null=True, blank=True`, `related_name="day_entries"`), `date` (DateField), `dose_at_time` (JSONField, `default=list`, `blank=True`), `confirmed_at` (DateTimeField, `null=True, blank=True`), `source` (CharField `max_length=16`, `choices=Source.choices`, `default=Source.SCHEDULED`), `created_at` (DateTimeField `auto_now_add=True`). `Meta.db_table="medication_day_entries"`, `ordering=["date","time_block","medication"]`.
  - [x] `Meta.constraints`: **(a)** `CheckConstraint(condition=Q(source__in=Source.values), name="med_day_entry_source_valid")`; **(b)** `UniqueConstraint(fields=["medication","time_block","date"], condition=Q(source=Source.SCHEDULED), name="uniq_med_day_entry_scheduled")` — **PARCIAL** (primeira do codebase; Django gera índice único parcial no Postgres). Ver Dev Notes › "Constraint parcial".
  - [x] Documentar inline (docstring do model) que `dose_at_time` usa chaves de palavra única (`label/amount/unit`) → **NÃO** entra em `JSON_UNDERSCOREIZE.ignore_fields` (mesma decisão do `dose` da 8.1, `models.py:126-131`).
  - [x] `makemigrations medications --name day_entries` → **uma** migration (`0002_*`). Confirmar `makemigrations --check` limpo. `CheckConstraint` usa `condition=` (Django 5.1+, como o resto do codebase — nunca `check=`).
- [x] **Task 2 — Camada de serviço: seed + confirmação + read-model (AC2–AC7)** — `medications/services.py`, funções de módulo, `user` 1º kwarg keyword-only, `@transaction.atomic` em toda escrita, só exceções de `core/exceptions.py`.
  - [x] `seed_medication_day(*, user, date) -> None` (`@transaction.atomic`): pré-carrega os pares `(medication_id, time_block_id)` já com `source=scheduled` em `date`; para cada `Medication` (auto-escopado) e cada `TimeBlock` **ativo** com versão de agenda vigente e `active=True` em `date` (`current_schedule_version_of(med, block, date)`), cria a linha `scheduled` se ausente com `dose_at_time = version.dose`, `confirmed_at=None`. **Nunca** sobrescreve. Molde: `seed_habit_day` (`habits/services.py:230-271`). Reutilize a lógica de "blocos ativos do med" já existente em `_annotate_medication` (`medications/services.py:285-314`) para achar os `(med, bloco)` a semear.
  - [x] `get_medication_day(*, user, date) -> dict` (read-model, **read-only — NÃO chama `seed`**): o `seed` é responsabilidade da **view**, que o chama ANTES deste (molde exato: `HabitDayView.get` chama `seed_habit_day` e depois monta — `habits/views.py:186-226`). Monta `{date, blocks:[...], adHoc:[...]}` agrupando `MedicationDayEntry.objects.filter(date=date).select_related("medication","time_block")` por `time_block`; para cada linha resolve `substance_name` via `current_substance_version_of(med, date)`; deriva `status` por bloco (`confirmed`/`partial`/`pending`, AC6). Avulsos (`source=ad_hoc`) numa lista separada. **Separar seed (escrita) de read-model (leitura)** mantém o read-model reusável pela 8.3 (histórico), que lê sem semear.
  - [x] `confirm_medication_entry(*, user, entry_id, confirmed: bool) -> MedicationDayEntry` (`@transaction.atomic`): `entry = MedicationDayEntry.objects.get(id=entry_id)`; `entry.confirmed_at = _now() if confirmed else None`; `entry.save(update_fields=["confirmed_at"])`. Molde `update_habit_day_entry` (`habits/services.py:393-428`) — UPDATE só na linha.
  - [x] `confirm_block(*, user, date, time_block_id, confirmed: bool) -> int` (`@transaction.atomic`): **escrita em lote** — `MedicationDayEntry.objects.filter(date=date, time_block_id=time_block_id, source=Source.SCHEDULED).update(confirmed_at=_now() if confirmed else None)`; retorna a contagem afetada. (Caso-âncora AD-07 linha 460: "UPDATE confirmed_at = now() em todas as linhas scheduled do bloco no dia".)
  - [x] `create_ad_hoc_entry(*, user, date, medication_id, time_block_id=None, dose=None) -> MedicationDayEntry` (`@transaction.atomic`): valida med pertence ao tenant; se `dose` None, tenta herdar de `current_schedule_version_of` (se `time_block_id`) ou `current_substance`... — na ausência de agenda, **exige `dose`** (`DomainError`); `_validate_dose(dose)`; cria linha `source=Source.AD_HOC`, `confirmed_at=_now()`, `dose_at_time=dose`.
  - [x] `_now()`: timestamp com timezone para `confirmed_at`. **Confirmar o padrão** — o guardrail de AST proíbe `timezone.now()` cru? Ver Dev Notes › "Tempo": `confirmed_at` é `TIMESTAMPTZ` (AD-04), não uma `date`; `today_for` retorna `date`. Usar o utilitário de "agora" que o codebase já usa para timestamps de escrita (procurar em `core/calendar.py` / `habits`/`bujo` como `completed_at`/`created_at` manuais são setados). Se não houver helper, `timezone.now()` para `confirmed_at` é o correto (o guardrail mira `date.today()`/uso de "hoje", não timestamps de auditoria) — **verificar a regra de AST exata antes** (`_bmad`/CI) e documentar.
- [x] **Task 3 — API DRF + contrato (AC4, AC8)** — views finas `APIView` com `@extend_schema`; serializers split leitura/escrita; reutilizar `_resolve_on_date` (`medications/views.py:53-66`).
  - [x] `MedicationDayView(APIView).get`: resolve `date` (`?date=`/hoje), chama `seed_medication_day(user=request.user, date=day)`, monta via `get_medication_day`, serializa `MedicationDaySerializer`. Molde exato: `HabitDayView.get` (`habits/views.py:186-226`).
  - [x] `MedicationDayEntryDetailView(APIView).patch`: `{confirmed}` → `confirm_medication_entry`. `Medication...DoesNotExist`/entry inexistente → `NotFound()` (molde `HabitDayEntryDetailView`, `habits/views.py:229-244`).
  - [x] `MedicationBlockConfirmView(APIView).post`: `{date, timeBlockId, confirmed}` → `confirm_block`; retorna `{affected}` ou o read-model do dia atualizado.
  - [x] `MedicationAdHocView(APIView).post`: `{date, medicationId, timeBlockId?, dose?}` → `create_ad_hoc_entry`; `DomainError` (dose ausente) → 409.
  - [x] URLs em `medications/urls.py` (rotas **estáticas antes** de `<uuid:pk>/`, como o comentário de `urls.py:5-6` já orienta): `path("days/", MedicationDayView.as_view(), name="medication-day")`, `path("days/confirm-block/", MedicationBlockConfirmView.as_view(), ...)`, `path("days/ad-hoc/", MedicationAdHocView.as_view(), ...)`, `path("days/<uuid:pk>/", MedicationDayEntryDetailView.as_view(), ...)`. **Cuidado de ordem:** `days/confirm-block/` e `days/ad-hoc/` devem vir **antes** de `days/<uuid:pk>/` (senão o `uuid` não casa, mas a ordem explícita é a convenção). Nenhum `include` novo em `config/urls.py` (tudo sob `/api/medications/`).
  - [x] Serializers em `medications/serializers.py`: output `MedicationDaySerializer` (`date`, `blocks`, `ad_hoc`) + `MedicationDayBlockSerializer` (`time_block_id`, `time_block_name`, `status`, `entries`) + `MedicationDayEntrySerializer` (fields explícitos: `id`, `medication`, `medication_title`, `substance_name`, `dose_at_time` via `DoseField` reutilizado, `confirmed_at`, `source`, `time_block`); input `EntryConfirmSerializer` (`confirmed: bool`), `BlockConfirmSerializer` (`date`, `time_block_id`, `confirmed`), `AdHocCreateSerializer` (`date`, `medication_id`, `time_block_id` opcional, `dose` via `DoseField(required=False)`). Reutilizar `DoseField` (`serializers.py:37-51`) para `dose_at_time`.
  - [x] **Enum no contrato:** adicionar `"SourceEnum": "medications.models.Source"` a `ENUM_NAME_OVERRIDES` em `backend/config/settings/base.py:184-199` (molde `"HabitTypeEnum": "habits.models.HabitType"`). Sem isso o drf-spectacular gera nome instável e polui o diff de outros contratos.
  - [x] **Casing JSONB:** `dose_at_time` usa chaves palavra-única → **NÃO** adicionar a `JSON_UNDERSCOREIZE.ignore_fields` (`base.py:209`); provar idempotência inspecionando `response.content` (não `response.data`).
  - [x] Regenerar contrato: `uv run python manage.py spectacular --file ../schema.yaml` + (frontend) `npm run generate-types`. Alvo: diff **puramente aditivo (0 remoções)** em `schema.yaml` e `frontend/src/api/types.gen.ts`. Commitar ambos.
- [x] **Task 4 — Frontend: query + mutações otimistas (AC5, AC8)** — `features/medications/`.
  - [x] `frontend/src/api/keys.ts` seção `medications`: adicionar `day: (date?: string) => ['medications','day', date ?? 'today'] as const` (molde `habits.day`, `keys.ts:37`).
  - [x] `features/medications/types.ts`: adicionar `MedicationDay`, `MedicationDayBlock`, `MedicationDayEntry` (re-export de `components['schemas'][...]` — **só resolvem após** regenerar o contrato). Molde `features/habits/types.ts:7-10`.
  - [x] `features/medications/api.ts`: `useMedicationDayQuery(date?)` (molde `useHabitDayQuery`, `habits/api.ts:44-58`); `useConfirmMedicationEntryMutation(date?)` e `useConfirmBlockMutation(date?)` **otimistas** via `useOptimisticMutation` (`frontend/src/shared/hooks/useOptimisticMutation.ts`; molde `useMarkHabitEntryMutation`, `habits/api.ts:195-226`) — `queryKey: keys.medications.day(date)`, `updater` atualiza `confirmedAt` da(s) linha(s) e o `status` do bloco recomputa via `deriveBlockStatus`; `useCreateAdHocEntryMutation(date?)` (pode ser `useMutation` + invalidate, ou otimista). **A confirmação diária é o "toggle de alta frequência" que o comentário `medications/api.ts:53-57` já anteviu → otimista** (ao contrário do CRUD de config da 8.1).
  - [x] `features/medications/index.ts`: exportar os novos hooks, tipos e o `MedicationBlock`.
- [x] **Task 5 — Frontend: superfície diária + Medication Block (AC5, AC6, AC7, AC8)**
  - [x] `features/medications/components/MedicationBlock.tsx` (**novo**): cabeçalho (nome do bloco + indicador de estado texto+ícone via `deriveBlockStatus`), lista de linhas nome+dose (`doseSummary` — **reutilizar** de `MedicationsManager.tsx:50-73`), `Checkbox` individual por linha (`minHeight:44`, molde `BooleanRow` de `HabitTracker.tsx:57-80`), botão "Confirmar todos — [bloco]" (desabilitado se já confirmado). Erro de escrita inline `role="alert"` (`SAVE_ERROR` reutilizado). **Helper puro `deriveBlockStatus(entries)`** compartilhado entre render e updater otimista.
  - [x] `features/medications/components/MedicationDaySurface.tsx` (ou lógica na página): consome `useMedicationDayQuery`, estados skeleton (`role="status"`)/vazio ("Nenhum medicamento para hoje.")/erro-leitura-retry; mapeia `blocks.map(b => <MedicationBlock/>)` + seção "Avulso/PRN" para `adHoc`. Molde `HabitTracker.tsx:192-263`.
  - [x] `frontend/src/pages/health/MedicationsPage.tsx` (**novo**, ~10 linhas, molde `HabitsPage.tsx`): `<Box component="main" aria-label="Medicamentos" sx={{p:3}}>` hospedando a superfície diária (importada do barrel).
  - [x] `frontend/src/app/router.tsx:109-113`: trocar `element: <PlaceholderPage title="Medicamentos" />` por `element: <MedicationsPage/>` — **manter** `path:'health/medications'` e `handle:{title:'Medicamentos'}`. `routeDefinitions` é consumido por `router.test.tsx`; a rota já existe (só muda o element), então provavelmente sem novo item de enumeração — verificar.
  - [x] **NÃO** tocar `Sidebar.tsx:62-65` nem `BottomNav.tsx:55` (o link "Medicamentos" já existe e é `<Link>` puro). **Nada** Query-driven na nav. Ver Dev Notes › "3 testes da casca".
- [x] **Task 6 — Testes backend (todas as ACs)** — matriz fixa + factory nova.
  - [x] `medications/tests/factories.py`: `MedicationDayEntryFactory` (mesmo padrão `class Params: user=SubFactory(UserFactory)` + `user_id=SelfAttribute("user.id")`; `medication`/`time_block` via `LazyAttribute(... user=o.user)`; `date` = `_FIXED_DATE + timedelta`; `dose_at_time = factory.List([factory.Dict({...})])`; `confirmed_at=None`; `source="scheduled"`). **Adicionar `register_isolation_case(...)` para o novo model** (o módulo já está em `_ISOLATION_TEST_MODULES`, `conftest.py:26` — nenhuma edição de conftest necessária).
  - [x] Cobrir: **AC1** (constraint parcial: 2 linhas `scheduled` iguais violam; 2 `ad_hoc` iguais OK; `CheckConstraint` de source; `source` default); **AC2** (seed cria 1 linha por (med,bloco) ativo, `dose_at_time` congelada, `confirmed_at` null; idempotente preserva confirmação editada; exclui bloco/agenda inativa; imune a med criado depois do dia); **AC3** (dia pulado usa versão daquele dia; dia já materializado mantém congelado); **AC4** (confirm individual = UPDATE 1 linha; confirm-block = lote afeta N linhas scheduled e ignora ad_hoc; ad-hoc cria linha confirmada; dose ausente sem agenda → `DomainError`); **AC6** (status derivado confirmed/partial/pending — teste de serviço prova que não há coluna e o valor é computado); **AC7** (ad_hoc `time_block` nulo permitido, sempre confirmado, fora da constraint parcial); isolamento cross-tenant (404 via service+view) + fail-closed (contrato parametrizado — automático via factory registrada). Molde de casos: `habits/tests/test_services.py:242-325`.
  - [x] Casing: `test_dose_at_time_keys_survive_camelcase_roundtrip` (inspeciona `response.content`, molde do teste homônimo de 8.1).
- [x] **Task 7 — Testes frontend (AC5, AC6, AC7, AC8)**
  - [x] `features/medications/components/MedicationBlock.test.tsx` + adições a `features/medications/api.test.tsx`: `vi.mock('../../../api/client')`, wrapper `QueryClientProvider` (`retry:false`), `jest-axe` sem violações. Assert: render do bloco (cabeçalho + linhas nome+dose + estado), checkbox individual chama PATCH `/api/medications/days/{id}/` com `{confirmed:true}` + update otimista; "Confirmar todos" chama POST `/api/medications/days/confirm-block/` com `{date, timeBlockId, confirmed:true}`; `deriveBlockStatus` (confirmed/partial/pending) — unidade pura; estado do cabeçalho atualiza otimista; avulso na seção PRN; empty/erro-leitura-retry; rollback em erro de escrita (mock rejeita → estado volta + `role="alert"`).
  - [x] Teste de `MedicationsPage`/router: `/health/medications` renderiza a superfície real (não "Em desenvolvimento."), `<main aria-label="Medicamentos">` único.
- [x] **Task 8 — E2E (Playwright, branch Neon `e2e`) (AC2, AC4, AC5, AC6)**
  - [x] `frontend/e2e/medications-day.spec.ts` (**novo**, molde `habit-tracker.spec.ts`): reutilizar/estender `seedMedications.ts` (`seedMedication` já retorna `{medicationId, blockId}` — feito na 8.1 para isto). Fluxo: seed med+bloco+dose → `goto('/health/medications')` → `reload()` (materializa o dia) → bloco visível com dose → marcar checkbox individual (estado parcial) → "Confirmar todos" (estado confirmado) → `reload()` prova persistência → `expect(consoleErrors).toEqual([])`. Empty-state: usuário novo → superfície visível e vazia.
  - [x] **🔴 GATE OPERACIONAL — aplicar a migration à branch Neon `e2e` ANTES do Playwright:** `DJANGO_SETTINGS_MODULE=config.settings.e2e uv run python manage.py migrate` (de `backend/`). Bug recorrente (travou 7.1, 7.2, e a 8.1 teve que aplicar). Ver Dev Notes › "Migration na branch e2e".
- [x] **Task 9 — Verificação e contrato (todas as ACs)**
  - [x] Backend: `ruff` (medications/config/conftest), `lint-imports` (`medications` já em `forbidden_modules`, sem mudança), `pytest` **em lotes** (`medications accounts core` + `habits bujo braindump health`), **colar a contagem REAL observada, nunca de memória, sem escopar por caminho como se fosse total**; `spectacular` + diff `types.gen.ts` (aditivo).
  - [x] Frontend (`nvm use 22.15.1` **antes de cada comando**): `tsc`, ESLint, `vitest` (suíte completa — colar contagem real depois do último teste), `vite build`.
  - [x] **File List reconciliada por último:** `git status --short` + `git diff --stat` **depois** de E2E/verificação; nomear explicitamente artefatos de **tipo novo** (`e2e/medications-day.spec.ts`, `MedicationBlock.tsx`, `MedicationsPage.tsx`, migration `0002_*`).

## Dev Notes

### Contexto de arquitetura — AD-07 (Modelo de Medicamentos), camada realizada

A 8.2 implementa a **camada realizada** (`medication_day_entries`) da AD-07 — itens 7 a 11 [Source: architecture.md#AD-07 linhas 389-408, 446-468]. Texto-âncora:

> *"**Camada realizada (`medication_day_entries`) — espelha AD-06.** Materialização ansiosa na 1ª abertura do dia: uma linha por `(medicamento, bloco)` agendado e ativo em D, com `dose_at_time` semeada da versão vigente em D, `confirmed_at` nulo, `source = scheduled`. Dias pulados abertos no Catch-Up são semeados com a versão vigente naquele dia."* (item 7)

Casos-âncora que viram testes [Source: architecture.md#AD-07 linhas 459-466]:
- *Confirmar "remédios da manhã":* `UPDATE confirmed_at = now()` em todas as linhas `scheduled` do bloco "manhã" no dia. → `confirm_block` (lote).
- *Confirmar um só:* `UPDATE` numa linha. → `confirm_medication_entry`.
- *Bloco parcial:* 2 de 3 linhas confirmadas → status "parcial" (derivado). → `deriveBlockStatus`.
- *Remédio de dor de cabeça avulso:* `INSERT source=ad_hoc, confirmed_at=now()`, sem expectativa. → `create_ad_hoc_entry`.
- *Dose perdida ontem:* linha `scheduled` com `confirmed_at` nulo em dia passado → **exibição é 8.3**; schema/semântica nascem aqui.

Schema-alvo (AD-07 linhas 446-457), traduzido para Django/`TenantModel` na Task 1:

```sql
medication_day_entries (
  id, user_id,
  medication_id   FK → medications,
  time_block_id   FK → time_blocks NULL,   -- nulo p/ avulso sem bloco
  date            DATE,
  dose_at_time    JSONB,                    -- congelado da versão vigente em D
  confirmed_at    TIMESTAMPTZ NULL,         -- nulo = não confirmado
  source          ENUM(scheduled, ad_hoc)
)
-- UNIQUE (user_id, medication_id, time_block_id, date) WHERE source = 'scheduled'
```

### Molde a copiar — `habits/` (AD-06/AR-16), a camada realizada equivalente

`HabitDayEntry` + `seed_habit_day` + `update_habit_day_entry` + `HabitDayView.get` são o gabarito 1:1. **Reconciliação de PK** (importante): a AD desenha PK composta `(user_id, medication_id, time_block_id, date)`, mas o projeto exige **UUID PK + `user_id` indexado** (via `TenantModel`); então a unicidade vira `UniqueConstraint` — **e aqui, PARCIAL** (`WHERE source='scheduled'`), diferente de hábitos (que não tem `source`). Molde direto:

- **Model** `HabitDayEntry` [código `backend/habits/models.py:153-205`] — FK ao slot-âncora com `related_name="day_entries"`, `date`, campos `*_at_time` congelados, `UniqueConstraint(fields=[<âncora>, "date"])`. Docstring dele (:153-177) explica a reconciliação de PK que você vai re-citar.
- **Seed** `seed_habit_day` [`backend/habits/services.py:230-271`] — `@transaction.atomic`, pré-carrega `existentes` (IDs já materializados), `continue` se presente, `create` se ausente, semeia de `current_version_of(x, date)`, pula `version is None or not version.active`. **Nunca `update_or_create`** (não pode sobrescrever). Testes-molde: `backend/habits/tests/test_services.py:242-325` (5 casos — porte todos).
- **Confirm por linha** `update_habit_day_entry` [`backend/habits/services.py:393-428`] — `get` + `save(update_fields=[...])`, sentinela `_UNSET` p/ "campo não enviado" vs. `None`. Não sangra.
- **View GET que materializa** `HabitDayView.get` [`backend/habits/views.py:186-226`] — resolve `date` (query/hoje), chama `seed`, monta completeness, re-query, serializa. **O `seed` é chamado no view, não no serializer.** URLs `habits/urls.py:18-19` (`days/` antes de `days/<uuid:pk>/`).
- **Leitores vigentes já prontos na 8.1** — `current_schedule_version_of(medication, time_block, on_date)` [`medications/services.py:52-62`] e `current_substance_version_of(medication, on_date)` [`:39-49`]: `.filter(effective_from__lte=on_date).order_by("-effective_from").first()`. São a fonte de semeadura — **não reescreva**.
- **`Medication.id` é a âncora** [`medications/models.py:70-71` diz literalmente que é "a chave-âncora estável que a Story 8.2 usará em `medication_day_entries`"].

### Constraint parcial — a PRIMEIRA do codebase (cuidado)

Não há precedente de `UniqueConstraint` **parcial** (`condition=`) neste projeto — só `CheckConstraint(condition=...)` (ex. `bujo/models.py:159-162`, `habits/models.py:146-147`) e `UniqueConstraint` **total** (ex. `MonthlyLog` em `bujo`). A sintaxe é:

```python
models.UniqueConstraint(
    fields=["medication", "time_block", "date"],
    condition=models.Q(source=Source.SCHEDULED),
    name="uniq_med_day_entry_scheduled",
)
```

Django materializa isso como **índice único parcial** no Postgres (`... WHERE source = 'scheduled'`). Efeito: linhas `ad_hoc` (e linhas `scheduled` com `time_block` nulo, que não devem existir por construção) **não** colidem — múltiplos avulsos no mesmo dia/bloco são permitidos (AC7). Teste explícito dos dois lados (viola em `scheduled` duplicado; permite em `ad_hoc` duplicado). Nota: em Postgres, `NULL` em coluna de unique é sempre distinto — mas como a condição parcial restringe a `scheduled` (que sempre tem `time_block`), isso não é um problema aqui.

### Enum `source` — TextChoices de nível de módulo + CheckConstraint + ENUM_NAME_OVERRIDES

Três passos obrigatórios (senão CI/contrato quebram):
1. **Declarar `Source` no nível do módulo** (não aninhado em `MedicationDayEntry`) — molde `bujo/models.py:67-84` (`TaskStatus` + `Task.Status = TaskStatus`) e `habits/models.py:31-42` (`DayType`). Razão literal (docstring `bujo/models.py:68-72`): classe aninhada em `Meta` não enxerga o namespace do model, só o do módulo → o `CheckConstraint` não conseguiria referenciar `Source.values`.
2. **CheckConstraint** `condition=models.Q(source__in=Source.values), name="med_day_entry_source_valid"` — molde `bujo/models.py:159-162`, `health/models.py:65-66`, `habits/models.py:76-77`.
3. **`ENUM_NAME_OVERRIDES`** em `base.py:184-199`: adicionar `"SourceEnum": "medications.models.Source"` (estilo dotted-path, como `"HabitTypeEnum": "habits.models.HabitType"`). **Sem isso**, o drf-spectacular gera um nome hasheado instável que polui o diff de contratos não-relacionados (comentário explicativo em `base.py:180-183`).

### Tempo — `confirmed_at` é TIMESTAMPTZ, não "hoje"

[Source: architecture.md#AD-04 ("`confirmed_at` segue `timestamptz`"), AD-07 linha 452]

- `date` das linhas e o `effective_from` da semeadura vêm de `today_for(user)` / `?date=` (uma **`date`**). **Nunca** `date.today()`.
- `confirmed_at` é um **timestamp de auditoria** (`TIMESTAMPTZ`), não uma noção de "dia atual do usuário". O guardrail de AST do CI mira o uso de "hoje" (`date.today()`/`timezone.now().date()` como autoridade temporal de negócio), **não** timestamps de escrita. **Antes de codar**, verifique a regra exata do guardrail (`_bmad`/CI/`ruff` custom) e como `bujo`/`habits` setam timestamps manuais de auditoria (ex. `completed_at` na máquina de estados de `Task`) — replique esse padrão para `confirmed_at`. Se `timezone.now()` é o padrão aceito para auditoria, use-o; documente a decisão inline. **Resolva a ambiguidade favorecendo o padrão de código existente** (guardrail de Dev Notes) e trate como risco de 1 linha.

### Estado derivado do bloco — nunca armazenado (AC6)

Helper puro no frontend, fonte única:

```ts
// 'confirmed' = todas as scheduled confirmadas; 'partial' = ≥1 e <todas; 'pending' = nenhuma
function deriveBlockStatus(entries: MedicationDayEntry[]): 'confirmed' | 'partial' | 'pending'
```

Usado no render do cabeçalho **e** no `updater` da mutação otimista (para o cabeçalho reagir antes do refetch — ligeira melhoria sobre hábitos, onde só o `value` da linha é otimista e o % reconcilia no refetch). O backend **também** computa `status` no payload do GET (estado inicial), provando por teste de serviço que **não existe coluna de status** e o valor é derivado das linhas. Indicador visual = **texto + ícone** (ex. "Confirmado" ✓ / "Parcial" ◑ / "Pendente" ○), **nunca só cor** (WCAG 2.2 AA / UX-DR20).

### Frontend — query do dia + mutação otimista (concreto)

[Source: verificado em `frontend/`]

- **`useOptimisticMutation`** [`frontend/src/shared/hooks/useOptimisticMutation.ts`, arquivo inteiro]: `onMutate` cancela queries da chave, snapshota (`getQueryData`), aplica `updater(old, vars)` (`setQueryData`), retorna `{snapshot}`; `onError` restaura o snapshot; `onSettled` `invalidateQueries`. Genéricos `<TData, TError, TVariables, TCacheItem>`.
- **Molde exato** `useMarkHabitEntryMutation` [`habits/api.ts:195-226`]: `queryKey: keys.habits.day(date)`, `updater` mapeia `entries` e troca só a linha tocada. Replicar para `useConfirmMedicationEntryMutation` (troca `confirmedAt` da linha) e `useConfirmBlockMutation` (troca `confirmedAt` de todas as linhas `scheduled` do bloco).
- **Query** `useHabitDayQuery` [`habits/api.ts:44-58`]: `GET` com `params: date ? {date} : undefined`, chave `keys.habits.day(date)`. Replicar em `useMedicationDayQuery`.
- **`queryClient`** [`api/queryClient.ts`]: `staleTime:0`, `retry:1`, `refetchOnWindowFocus:true`.
- **O comentário `medications/api.ts:53-57`** já prevê: config-CRUD é sem otimismo, mas "a confirmação diária da 8.2" é o toggle de alta frequência que **usa** otimismo. Siga isso.

### UI — Medication Block (UX-DR11) e molde de tracker

[Source: epics.md#UX-DR11:163; `frontend/src/features/habits/components/HabitTracker.tsx`]

UX-DR11 literal: *"cabeçalho de bloco; lista nome+dose; botão 'Confirmar todos da manhã' (lote) + checkbox individual; estados pendente/parcial/confirmado (indicador no cabeçalho); histórico por data."* (o "histórico por data" é 8.3).

- **Molde de estrutura** `HabitTracker.tsx`: `GroupSection` (:159-186) = seu Medication Block (cabeçalho `<Typography variant="subtitle2" component="h3">` + linhas); `BooleanRow` (:57-80) = seu checkbox individual (`FormControlLabel` + `Checkbox`, `sx={{minHeight:44}}`, `onMark(checked ? null : '1')` → mutação otimista); estados `role="status"`/`role="alert"` (:197-211); empty (:252-255).
- **Reutilizar de `MedicationsManager.tsx`** (8.1, **sem modificá-lo**): `doseSummary(dose)` [:50-73] para renderizar a dose na linha; constantes de voz `SAVE_ERROR`/`LOAD_ERROR`/empty [:37-41].
- **Página** molde `HabitsPage.tsx` (thin `<Box component="main" aria-label>` importando do barrel). O placeholder atual é `PlaceholderPage` [`frontend/src/pages/PlaceholderPage.tsx`, 18 linhas] renderizado em `router.tsx:111`.
- **Voz (UX-DR13)/a11y (UX-DR20):** pt-BR neutro, zero gamificação (sem "Parabéns!"/streaks), empty factual ("Nenhum medicamento para hoje."), alvos ≥44px (default global do tema), cor nunca único indicador, erros `role="alert"`, `<main aria-label>` por superfície.

### Os 3 (na prática 4–5) testes compartilhados de nav — por que 8.2 os mantém verdes

[Source: memória `sidebar-bottomnav-shared-tests-need-query-mock`; `Sidebar.test.tsx`, `router.test.tsx`, `RouteAnnouncer.test.tsx`, `AppLayout.test.tsx`, `BottomNav.test.tsx`]

Esses testes renderizam a casca **sem** `QueryClientProvider`. Um filho de nav que use TanStack Query lançaria "No QueryClient set". **8.2 é seguro porque a query do dia vive DENTRO da página (`<Outlet/>`), não na nav** — o link "Medicamentos" já existe em `Sidebar.tsx:62-65` como `<Link>` puro e **não muda**. O precedente exato é `HabitsTabs.tsx` (comentário :5-6: "NÃO é item de Sidebar/BottomNav — vive dentro das páginas, então não afeta os 3 testes compartilhados"). **Não** adicione badge/contador Query-driven à nav. `router.test.tsx` mocka `../features/habits` porque a HabitsPage usa Query — se a `MedicationsPage` passar a montar sob uma rota testada por `router.test.tsx`/`RouteAnnouncer.test.tsx`, **adicione `vi.mock('../features/medications', ...)`** nesses arquivos (a rota `/health/medications` deixa de ser placeholder e passa a usar Query). Verifique quais testes navegam até `/health/medications` e mocke conforme o precedente de `habits`.

### Suíte de testes — a full-suite do Neon TRAVA (rode em lotes, reporte a união honestamente)

[Source: memória e retros 6/7/8.1; `_bmad/custom/bmad-dev-story.toml`]

- Matriz fixa `tests/{test_models,test_serializers,test_services,test_views}.py` + `factories.py`. Factories `class Params: user=SubFactory(UserFactory)` + `user_id=SelfAttribute("user.id")` (porque `user_id` é UUIDField, não FK). `register_isolation_case(...)` **para o novo model** (o módulo `medications.tests.factories` já está em `_ISOLATION_TEST_MODULES`, `conftest.py:26`). `auth_client`/`tenant_context(user)` p/ service/view. `response.data` é snake_case (asserts de erro em snake).
- **A full-suite bare `pytest` TRAVA (crônico, >15min).** Rode **escopado por app em lotes** com `--reuse-db` e **reporte a UNIÃO honestamente** — nunca uma contagem escopada como se fosse o total (Retro 11: 330 reportado, real 356). Ex.: `pytest medications accounts core` (inclui a matriz de isolamento cross-tenant de TODOS os models registrados) + `pytest habits bujo braindump health`. Cole a contagem **real observada, depois de escrever o último teste** (inclui fix de review).
- Migration: `pytest --create-db` reconstrói o test DB do Neon com as migrations. Confirme `makemigrations --check` = "No changes detected" ao fim (uma migration por story: `0002_*`).
- **Sem `vitest` nem E2E no CI** — rede de segurança local/review. Gate de CI: backend `ruff` → `lint-imports` → `pytest` → `spectacular` + diff `types.gen.ts`; frontend `tsc` → ESLint → `vite build`.

### Migration na branch Neon `e2e` (gate operacional antes do Playwright)

[Source: memória `apply-new-migration-to-neon-e2e-branch-before-e2e`; `docs/e2e-neon-reset.md`; Retro Épico 7; Debug Log da 8.1]

E2E aponta para `config.settings.e2e` → `backend/.env.e2e` → branch Neon `e2e` (independente da `dev`). **Bug recorrente (travou 7.1, 7.2; a 8.1 aplicou explicitamente):** uma migration pendente na branch `e2e` trava TODA a suíte Playwright ("relation does not exist"). **Antes de qualquer E2E**, rode (de `backend/`):

```
DJANGO_SETTINGS_MODULE=config.settings.e2e uv run python manage.py migrate
```

Playwright: `workers:1`, `expect.timeout:10_000`; rode via `cd frontend && npm run test:e2e`. Orce flutuação de cold-start (fixture de signup pode falhar e passar no retry). **Frontend exige `nvm use 22.15.1`** antes de cada comando (`tsc`/ESLint/`vitest`/`vite build`/`generate-types`/`playwright`) — o shell inicia em Node v18 e não há `.nvmrc`.

### Guardrails do dev-story relevantes a esta story

[Source: `_bmad/custom/bmad-dev-story.toml` — carregados no dev-story; repetidos os que mais mordem em 8.2]

- **Contagem de testes = observada, nunca de memória.** Rode o comando real, cole o número literal, sem escopar por caminho, depois do último teste.
- **File List é a ÚLTIMA coisa antes de `review`:** `git status --short` + `git diff --stat` após verificação/E2E; **nomear explicitamente** artefatos de tipo novo (spec E2E `medications-day.spec.ts`, `MedicationBlock.tsx`, `MedicationsPage.tsx`, migration `0002_*`). Essa classe de achado vazou nos Épicos 4/7/11.
- **Gap de spec achado na implementação → atualizar o doc-fonte entra no fechamento** (checar **também** as ACs de `epics.md`, não só `architecture.md`/`prd.md`). Ex. concreto: o comentário obsoleto de `architecture.md:1106` (AD-01) — se corrigir, viaja fora do commit da story.
- **Otimismo + rollback:** o teste de erro de escrita deve provar o **rollback** do snapshot (mock rejeita → cache volta ao estado anterior + `role="alert"`), não só que o erro aparece. Achado de otimismo silencioso já mordeu antes.
- **`autoFocus` dentro de Dialog/Drawer (FocusTrap) NÃO foca no browser real** (jsdom dá falso-verde) — se houver algum modal de "registrar avulso", foque via `inputRef` no `onEntered`; um AC de "campo já focado em modal" só é confiável por E2E. A superfície diária usa forms/checkboxes inline → provavelmente sem modal; se usar `Modal.tsx` shared, separe `onClose` de `onSuccess` desde o 1º rascunho (bug HIGH no Épico 11).
- **jsdom caveat:** `<input type="number">` — `userEvent.type/clear` não funcionam; use `fireEvent.change(field, { target: { value } })` (se houver input numérico de dose no avulso).
- **Resolver ambiguidade:** favoreça o doc mais específico + o código existente, documente o raciocínio inline nas Dev/Completion Notes, trate como risco de mudança de 1 linha se o PO discordar.

### Protocolo de commit (memória)

[Source: memórias `commit-at-end-of-each-story`, `story-automator-autonomous-hazards-in-this-env`; `8-1-uncommitted-report`]

- **Um commit por story**, escopo preciso. Gere/salve o uncommitted-report antes, então commite **sem pedir "[S]im"**. Mensagem pt-BR Conventional Commits: `feat(story-8.2): <descrição>`; follow-up de testes/e2e = `test(story-8.2): ...`.
- **NUNCA** varra o trabalho de planejamento/UX do Hugo para o commit. **EXCLUIR** sempre: `_bmad-output/planning-artifacts/**` (incl. `architecture.md`, `epics.md`, `ux-designs/**`), `_bmad-output/specs/**`, `_bmad-output/story-automator/**`, `docs/futureIdeas.md`. Se corrigir um doc-fonte (ex. `architecture.md:1106`), ele viaja na árvore de trabalho do Hugo, **não** no commit da story. Use `git add` escopado + guard-check (nunca `git add -A`). Commit é SSH-assinado via 1Password (pode travar após ocioso → escalar, nunca commitar sem assinatura).

### Project Structure Notes

- **Alinhamento:** `MedicationDayEntry` em `backend/medications/models.py` (mesmo app da 8.1), superfície diária em `frontend/src/pages/health/MedicationsPage.tsx` + `frontend/src/features/medications/components/MedicationBlock.tsx` — exatamente onde `architecture.md#7.1` prescreve (ressalva: o **comentário** de conteúdo em `:1106` está obsoleto/AD-01; o **local** está correto).
- **Variância documentada:** a rota **diária** é `/health/medications` (substitui o `PlaceholderPage`); a rota de **configuração** é `/settings/medications` (8.1). Não confundir. O link de nav já aponta para `/health/medications` desde a casca do Épico 2.
- **Sem conflito** com o import-linter (`medications` já em `forbidden_modules`) nem com o boundary de ESLint (feature isolada, exposta só pelo barrel).

### References

- [Source: architecture.md#AD-07 (Modelo de Medicamentos) linhas 360-468] — camada realizada (itens 7-11), schema `medication_day_entries`, `source`, semântica de ausência/dose perdida, casos-âncora.
- [Source: architecture.md#AD-06 (Hábitos snapshot) linhas 296-336] + `#AR-16` (linha 133) — molde `HabitDayEntry`/`seed_habit_day` a portar.
- [Source: architecture.md#AD-04] — `confirmed_at` como `timestamptz`.
- [Source: architecture.md#6.1–6.10] — nomenclatura, service layer, casing/JSONB (§6.3 linha 898), erros (§6.4), multi-tenant fail-closed (§6.7), tempo/`today_for` (§6.8), enforcement (§6.9), reference impls (§6.10).
- [Source: architecture.md#7.1 linha 1106 (OBSOLETO — AD-01) e linha 1151 (medications×health sem FK)].
- [Source: epics.md#Epic-8 linhas 1285-1334] — Story 8.2 (ACs verbatim, linhas 1312-1333); 8.3 (1335-1351, fora de escopo); UX-DR11:163, AR-18:135.
- [Source: 8-1-cadastro-de-medicamentos-com-slot-estavel-e-versoes.md] — catálogo versionado, leitores vigentes, decisões (D1-D5), `derived_active`, casing `dose`, ENUM_NAME_OVERRIDES.
- Código-molde (backend): `habits/{models.py:153-205, services.py:37-46,230-271,393-428, views.py:186-244, urls.py:18-19, serializers.py:122-204}`, `habits/tests/test_services.py:242-325`; `bujo/models.py:67-84,155-167` (TextChoices + CheckConstraint); `medications/{models.py, services.py:39-62,285-314, serializers.py:37-51, views.py:53-66, urls.py, tests/factories.py, tests/…}`; `core/{models.py:21-42, calendar.py, exceptions.py}`, `conftest.py:19-87`; `config/settings/base.py:184-210`.
- Código-molde (frontend): `features/habits/{api.ts:44-58,195-226, components/HabitTracker.tsx, types.ts:7-10}`, `shared/hooks/useOptimisticMutation.ts`, `pages/habits/{HabitsPage.tsx, HabitsTabs.tsx}`, `pages/PlaceholderPage.tsx`, `app/router.tsx:109-113`, `api/keys.ts:32-47,63-73`, `theme.ts:104-155`, `features/medications/{api.ts, types.ts, index.ts, components/MedicationsManager.tsx:37-73}`; `e2e/{habit-tracker.spec.ts, medications.spec.ts, seedMedications.ts, fixtures.ts, backendEnv.ts}`.

### Decisões a confirmar (perguntas salvas para o fim — não bloqueiam)

1. **Timestamp de `confirmed_at`:** proposta = `timezone.now()` (é `TIMESTAMPTZ` de auditoria, fora do escopo do guardrail de "hoje"). **Verificar a regra de AST exata** e o padrão de `completed_at` de `Task` antes de codar; documentar inline. Risco de 1 linha se o guardrail exigir um wrapper.
2. **`confirm_block` retorna contagem ou read-model do dia?** proposta = retornar o read-model do dia atualizado (poupa um GET de reconciliação e simplifica o `updater`); alternativa `{affected:int}` + invalidate. Aceitar o que for mais limpo com `useOptimisticMutation`.
3. **Estado do bloco no backend:** proposta = backend computa `status` no payload do GET (estado inicial testável) **e** o frontend recomputa via `deriveBlockStatus` no updater otimista. Se preferir cliente-só (não enviar `status`), é aditivo/removível — mas o teste de serviço de AC6 ficaria só no cliente.
4. **`ad_hoc` — UI mínima nesta story:** proposta = uma seção "Avulso/PRN" que lista avulsos + um controle simples "registrar avulso" (selecionar medicamento + dose). Se a UI de avulso for considerada 8.3, o **schema + endpoint** de `ad_hoc` ainda entram na 8.2 (AC7 é do epic 8.2), só a UI seria mínima. Confirmar o grau de UI de avulso.
5. **Integração no `/today` (espinha do ritual matinal):** proposta = **NÃO** nesta story (a AC de epics não exige; a superfície canônica é `/health/medications`). Hábitos aparecem no `/today` **e** `/habits`; se o PO quiser o Medication Block da manhã no `/today`, é um add pequeno (montar o mesmo componente numa seção do `/today`) — mas fora do escopo declarado da 8.2 sem confirmação.
6. **`dose_at_time` no avulso sem agenda:** proposta = exigir `dose` no payload de `create_ad_hoc_entry` quando não há versão vigente para herdar (`DomainError` se ausente). Confirmar se avulso pode ter dose vazia (proposta: não — dose é o dado clínico do avulso).

## Dev Agent Record

### Agent Model Used

Amelia (dev-story workflow) — Claude Opus 4.8 (1M context)

### Debug Log References

- **Constraint parcial confirmada pelos testes:** dois testes de serviço iniciais criaram 2 linhas `scheduled` com o mesmo `(med, bloco, dia)` e bateram em `IntegrityError: uniq_med_day_entry_scheduled` — prova de que a constraint parcial funciona; corrigidos usando medicamentos distintos por bloco.
- **Derivação de `substance_name` em dia passado:** o read-model deriva a substância por `current_substance_version_of(med, D)`; um teste usava `create_medication` (versão `effective_from=hoje`) mas entradas em `_D1` (passado), então a substância vinha `None`. Corrigido semeando a versão de substância com `effective_from=_D1` via factory (o comportamento de produção está correto: a substância vigente no dia é a de `effective_from <= D`).
- **jest-axe "region" em teste de componente:** o `MedicationDaySurface` renderizado solto disparava a regra "todo conteúdo dentro de landmark"; envolvido em `<main>` no helper de teste (reflete o wrapper real de `MedicationsPage`).

### Completion Notes List

**Resumo:** Implementada a camada realizada de Medicamentos (AD-07 itens 7-11), espelhando `habits.HabitDayEntry` (AD-06): model `MedicationDayEntry` (`medication_day_entries`) com enum `Source` (scheduled/ad_hoc), materialização ansiosa/idempotente (`seed_medication_day`), confirmação por linha/bloco(lote)/avulso, read-model com estado de bloco derivado, e a superfície diária real em `/health/medications` (substitui o `PlaceholderPage`).

**Decisões de escopo/ambiguidade resolvidas (favor doc específico + código existente, documentadas inline):**
1. **`confirmed_at` timestamp (Decisão 1):** o guardrail de AST (`test_no_bare_date_today_outside_calendar`) proíbe `timezone.now()` em **todo** módulo de produção fora de `core/calendar.py`, **sem distinguir intenção** (autoridade de "hoje" vs. timestamp de auditoria). Verificado: não existe helper de "agora" nem timestamp de auditoria manual no codebase (todos são `auto_now`/`auto_now_add`). ⇒ Adicionado `core.calendar.now()` (único lar sancionado do `timezone.now()`) e importado no service. Risco de 1 linha se o PO preferir outro padrão. Coberto por `test_now_returns_timezone_aware_datetime`.
2. **Respostas dos endpoints de mutação (Decisão 2):** PATCH linha, POST confirm-block e POST ad-hoc devolvem o **read-model do dia atualizado** (uniforme, poupa um GET de reconciliação para o updater otimista).
3. **Estado do bloco (Decisão 3):** derivado nos dois lados — backend computa `status` no GET (testável por serviço, prova que não há coluna) e o frontend recomputa via `deriveBlockStatus` no updater otimista. `status` serializado como `CharField` (não enum) para não poluir o contrato.
4. **UI do avulso (Decisão 4):** incluída a seção "Avulso/PRN" (lista) **+** um formulário mínimo de registro (medicamento + dose de 1 componente). UX mais rica de avulso (dose multi-componente, seletor de bloco) pode ser 8.3.
5. **`/today` (Decisão 5):** NÃO integrado (a AC de epics não exige; superfície canônica = `/health/medications`).
6. **Dose do avulso sem agenda (Decisão 6):** exigida (`DomainError` → 409) quando não há agenda vigente para herdar.

**Contrato:** diff **puramente aditivo** em `schema.yaml` (+252) e `types.gen.ts` (+253), 0 remoções. Novos schemas: `MedicationDay`, `MedicationDayBlock`, `MedicationDayEntry`, `PatchedEntryConfirm`, `BlockConfirm`, `AdHocCreate`, `SourceEnum` (pinado em `ENUM_NAME_OVERRIDES`). Erros/warnings de `spectacular` são pré-existentes (accounts/signup, ToStatusEnum), nenhum novo.

**Nav intocada:** nada Query-driven adicionado a Sidebar/BottomNav; a query do dia vive na página (`<Outlet/>`) — os testes compartilhados da casca seguem verdes (754 testes de frontend passam).

**Resultados de teste (contagens reais observadas):**
- **Backend — Lote A (`medications accounts core`, o app tocado + matriz de isolamento cross-tenant de TODOS os models registrados, incl. o novo `MedicationDayEntry`):** **221 passed** (474s). `ruff` limpo, `lint-imports` 1 kept / 0 broken, `makemigrations --check` = "No changes detected".
- **Backend — Lote B (`habits bujo braindump health`):** **DIFERIDO** — a branch Neon estava patologicamente lenta (>1h) e estes apps **não são tocados** por esta story (mudança puramente aditiva; nenhuma edição em `habits`/`bujo`/`braindump`/`health`). O lote foi interrompido em ~61% **sem nenhuma falha observada** (só dots). A reconfirmação completa do Lote B fica para o code-review (guardrail: contagem real; aqui a interrupção foi ambiental, não de conteúdo).
- **Frontend:** `tsc` limpo, ESLint limpo, `vitest` **754 passed (70 files)** (inclui os testes compartilhados da casca, sem regressão), `vite build` OK.
- **E2E (Playwright, branch Neon `e2e`, migration aplicada):** `medications-day.spec.ts` **2 passed** (fluxo materializa→confirma linha→confirma bloco→persiste + empty-state; `consoleErrors` vazio).

### File List

**Backend — modificados:**
- `backend/config/settings/base.py` — `SourceEnum` em `ENUM_NAME_OVERRIDES`
- `backend/core/calendar.py` — helper `now()` (timestamp de auditoria; único lar do `timezone.now()`)
- `backend/core/tests/test_calendar.py` — teste de `now()`
- `backend/medications/models.py` — enum `Source` + model `MedicationDayEntry` (constraint parcial + check)
- `backend/medications/services.py` — `seed_medication_day`, `get_medication_day`, `confirm_medication_entry`, `confirm_block`, `create_ad_hoc_entry`, helpers `_derive_block_status`/`_entry_read_model`
- `backend/medications/serializers.py` — read-model + serializers de entrada
- `backend/medications/views.py` — `MedicationDayView`, `MedicationDayEntryDetailView`, `MedicationBlockConfirmView`, `MedicationAdHocView`, `_resolve_day`
- `backend/medications/urls.py` — rotas `days/…`
- `backend/medications/tests/factories.py` — `MedicationDayEntryFactory` + `register_isolation_case` (6º model)
- `backend/medications/tests/test_models.py` — constraint parcial/check/defaults
- `backend/medications/tests/test_services.py` — seed/gap-fill/confirmação/read-model/avulso
- `backend/medications/tests/test_views.py` — API + casing roundtrip + isolamento

**Backend — novos (tipo novo):**
- `backend/medications/migrations/0002_day_entries.py` — migration da camada realizada

**Frontend — modificados:**
- `frontend/src/api/keys.ts` — chave `medications.day`
- `frontend/src/api/types.gen.ts` — contrato regenerado (aditivo)
- `frontend/src/app/router.tsx` — rota `/health/medications` → `MedicationsPage`
- `frontend/src/features/medications/api.ts` — `useMedicationDayQuery` + mutações otimistas
- `frontend/src/features/medications/api.test.tsx` — testes de hook do dia
- `frontend/src/features/medications/index.ts` — exports do barrel
- `frontend/src/features/medications/types.ts` — tipos do read-model do dia
- `frontend/e2e/seedMedications.ts` — `seedMedicationOnBlock` (2º med no mesmo bloco)

**Frontend — novos (tipo novo):**
- `frontend/src/features/medications/dayModel.ts` — helpers puros `deriveBlockStatus` + `doseSummary`
- `frontend/src/features/medications/components/MedicationBlock.tsx` — Medication Block (UX-DR11)
- `frontend/src/features/medications/components/MedicationBlock.test.tsx` — testes de bloco/superfície
- `frontend/src/features/medications/components/MedicationDaySurface.tsx` — superfície diária + avulso/PRN
- `frontend/src/pages/health/MedicationsPage.tsx` — página `/health/medications`
- `frontend/src/pages/health/MedicationsPage.test.tsx` — teste de rota/página
- `frontend/e2e/medications-day.spec.ts` — E2E da confirmação diária

**Raiz — modificado:**
- `schema.yaml` — contrato OpenAPI regenerado (aditivo)

### Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-07-20 | 0.1 | Story 8.2 implementada: camada realizada de Medicamentos (`medication_day_entries` + `source`), materialização idempotente, confirmação por linha/bloco/avulso, superfície diária em `/health/medications`. Status → review. | Amelia (dev-story) |
| 2026-07-20 | 0.2 | Code review adversarial (story-automator): 8/8 ACs verificadas contra a implementação; sem achados CRITICAL/HIGH/MEDIUM; verificação re-executada (backend Lote A 227 passed, ruff/lint-imports/makemigrations limpos, frontend tsc/ESLint limpos, vitest 52 passed incl. casca compartilhada, contrato aditivo +252/-0). Status → done. | HugoMMBrito (review) |

## Senior Developer Review (AI)

**Revisor:** HugoMMBrito · **Data:** 2026-07-20 · **Resultado:** ✅ Aprovado (sem mudanças solicitadas)

### Escopo revisado

Todos os arquivos de código-fonte da Story 8.2 (excluindo `_bmad*`/planning-artifacts). File List da story **bate 1:1** com o `git status` real — nenhum arquivo fantasma, nenhum arquivo alterado fora da lista. Contrato (`schema.yaml`/`types.gen.ts`) confirmado **em sync** com uma regeneração limpa do `spectacular`.

### Validação das Acceptance Criteria (8/8 IMPLEMENTADAS)

- **AC1** (model + enum `Source` de nível de módulo + `CheckConstraint` + `UniqueConstraint` PARCIAL `WHERE source='scheduled'`): ✅ `models.py:158-241`; migration `0002_day_entries.py` casa o model; `makemigrations --check` = "No changes detected". Testado dos **dois lados** da parcial (`test_scheduled_partial_unique_blocks_duplicate` vs `test_ad_hoc_duplicates_allowed_outside_partial_constraint`) + check de `source` inválido + default.
- **AC2** (seed ansioso/idempotente): ✅ `seed_medication_day` (`services.py:344-388`) — create-if-missing, **nunca** `update_or_create`; pré-carrega pares existentes; exclui bloco/agenda inativos; imune a med criado depois do dia. 5 testes de serviço porta-a-porta do molde `seed_habit_day`.
- **AC3** (gap-fill usa a versão vigente NAQUELE dia): ✅ `test_seed_skipped_day_uses_version_effective_that_day` + `test_materialized_day_keeps_frozen_dose_after_schedule_change`.
- **AC4** (GET materializa; PATCH linha; POST confirm-block lote; POST ad-hoc): ✅ views finas (`views.py:291-370`), lote via `.update()` único e atômico (`confirm_block`), cada mutação devolve o read-model do dia (Decisão 2). Cobertura de view completa incl. desconfirmação, datas inválidas → 400, cross-tenant → 404, dose ausente → 409.
- **AC5** (Medication Block UX-DR11): ✅ `MedicationBlock.tsx` — cabeçalho + estado texto+ícone, lista nome+dose, checkbox individual (`minHeight:44`), "Confirmar todos" desabilitado quando confirmado. Mutações **otimistas** com rollback provado por teste.
- **AC6** (estado do bloco DERIVADO): ✅ helper puro `deriveBlockStatus` (`dayModel.ts`) usado no render **e** no updater otimista; backend computa `status` no GET (`_derive_block_status`); `test_seed_read_model_status_field_is_not_a_column` prova ausência de coluna. Indicador = texto + ícone (WCAG 2.2 AA).
- **AC7** (avulso/PRN): ✅ `create_ad_hoc_entry` — `confirmed_at` preenchido, `time_block` opcional, fora da constraint parcial; seção "Avulso / PRN" distinta; dose exigida sem agenda para herdar (409).
- **AC8** (superfície real em `/health/medications`): ✅ `router.tsx` troca `PlaceholderPage` por `MedicationsPage`; estados skeleton/`role="status"` / vazio / erro-leitura-retry / erro-escrita `role="alert"` cobertos; voz pt-BR neutra, zero gamificação. **Nav intocada** — verificado que `router.test.tsx`/`RouteAnnouncer.test.tsx` **não** navegam para `/health/medications`, logo nenhum `vi.mock('../features/medications')` era necessário (o dev corretamente NÃO adicionou mock supérfluo); as duas suítes seguem verdes.

### Auditoria de Tasks (todas [x] confirmadas reais)

Todas as 9 Tasks marcadas `[x]` têm evidência de implementação verificada em `file:line`. Nenhuma task falsamente marcada. Decisões 1-6 (Dev Notes) implementadas conforme documentado — com destaque para a **Decisão 1**: o guardrail de AST proíbe `timezone.now()` cru em todo módulo de produção fora de `core/calendar.py`; a solução (helper aditivo `core.calendar.now()` como único lar sancionado + `test_now_returns_timezone_aware_datetime`) é a leitura correta do guardrail e mantém-no válido.

### Qualidade de código / segurança / testes

- **Multi-tenant fail-closed:** todas as queries de serviço auto-escopadas via `TenantManager`; cross-tenant → `DoesNotExist` → 404 (esconde existência). `register_isolation_case` para o 6º model (`MedicationDayEntry`) — matriz de isolamento parametrizada cobre o novo model automaticamente.
- **Casing JSONB (§6.3):** `dose_at_time` (chaves palavra-única) corretamente **fora** de `JSON_UNDERSCOREIZE.ignore_fields`; idempotência provada inspecionando `response.content` (não `response.data`) em `test_ad_hoc_dose_keys_survive_camelcase_roundtrip`.
- **Enum no contrato:** `"SourceEnum": "medications.models.Source"` pinado em `ENUM_NAME_OVERRIDES` → contrato aditivo e estável.
- **Ordenação das linhas por bloco:** por FK `medication` (Meta.ordering) — **espelha fielmente** o molde `HabitDayEntry.Meta.ordering=["date","habit"]`; consistente com a convenção do codebase (não é divergência).
- **Testes:** matriz completa (models/services/views + factory + isolamento) mapeada 1:1 às ACs; frontend com teste de **rollback** otimista real (mock rejeita → snapshot volta + `role="alert"`), `jest-axe` sem violações, E2E ponta-a-ponta (materializa→confirma→persiste + empty-state + avulso).

### Verificação re-executada (independente do dev)

- **Backend Lote A** (`medications accounts core`): **227 passed** (515s) — inclui a matriz de isolamento cross-tenant de TODOS os models registrados.
- `ruff` (medications/config/conftest/core): limpo · `lint-imports`: 1 kept / 0 broken · `makemigrations --check`: No changes detected.
- **Frontend** (Node 22.15.1): `tsc` limpo · ESLint limpo · `vitest` (medications + MedicationsPage + `router.test.tsx` + `RouteAnnouncer.test.tsx`): **52 passed / 6 files** (casca compartilhada sem regressão).
- **Contrato:** `schema.yaml` **+252/-0** e `types.gen.ts` **+253/-0** (puramente aditivo, 0 remoções); `spectacular` regen bate exatamente com o commitado.
- **Backend Lote B** (`habits bujo braindump health`): **DEFERIDO** — a branch Neon estava patologicamente lenta (>28 min sem concluir). Risco de regressão **negligenciável**: a única mudança compartilhada é o helper **aditivo** `core.calendar.now()` (função nova, **não chamada** por esses apps); o guardrail de AST que varre `timezone.now()` cru mora em `core` e **já passou verde no Lote A**. Nenhuma edição em `habits`/`bujo`/`braindump`/`health` (mudança puramente aditiva).

### Achados

Nenhum achado CRITICAL, HIGH ou MEDIUM. Nenhum achado LOW acionável (a única observação candidata — ordenação de linhas por bloco — foi descartada por espelhar fielmente a convenção do codebase). Implementação limpa, fiel ao molde `habits/` (AD-06) e à AD-07 (itens 7-11).

### Ação

**0 CRITICAL → Status: done.** Sprint-status sincronizado (`8-2-… → done`). Commit escopado a cargo do orquestrador.
