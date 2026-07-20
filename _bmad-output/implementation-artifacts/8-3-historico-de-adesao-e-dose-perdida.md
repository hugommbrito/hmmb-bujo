---
baseline_commit: 820fa233cbc8748cc56a4bebcb6b646a1ced61b5
---

# Story 8.3: Histórico de adesão e dose perdida

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero consultar o histórico de confirmações **por data** e ver claramente as **doses perdidas**, podendo corrigir a dose ou a confirmação de um dia passado,
Para que eu acompanhe minha adesão como **sinal clínico** — distinto da ausência de um hábito — e mantenha o registro fiel mesmo depois de trocar ou desativar o medicamento (FR-3.7, AD-07 itens 10/11, AD-14).

**Terceira e última story do Épico 8 (Medicamentos).** É a **camada de LEITURA + correção retroativa** sobre a camada realizada (`medication_day_entries`) que a 8.2 materializou e o catálogo versionado da 8.1. Entrega: (1) uma **superfície de Histórico** como aba "Hoje" · "Histórico" na tela de Medicamentos (`/health/medications/history`), com **navegação por data**; (2) a **exibição de "dose perdida"** — uma linha `scheduled` sem `confirmed_at` num **dia passado** vira sinal clínico neutro, distinta de "pendente" (hoje) e de "não aplicável" (sem linha); (3) **edição retroativa** de um dia passado — corrigir a **confirmação** (já existe da 8.2) ou a **dose** (novo) de **uma única linha**, sem sangrar para vizinhos, sem tocar agenda/substância.

> **🧭 A 8.2 já construiu 90% do encanamento — 8.3 liga o fio que já está passado, não reconstrói.** O `date` já flui ponta-a-ponta: backend `_resolve_day` lê `?date=` (`views.py:78`); `useMedicationDayQuery(date)` + `keys.medications.day(date)` dão **um slot de cache por dia** (`api.ts:296`, `keys.ts:74`); `MedicationDaySurface`/`MedicationBlock`/`EntryRow` **todos aceitam `date?`** (`MedicationDaySurface.tsx:141`, `MedicationBlock.tsx:81/89`); as mutações de confirmação (`useConfirmMedicationEntryMutation(date)`, `useConfirmBlockMutation(date)`) **já agem em qualquer data**. O **único** ponto que não fornece uma data ≠ hoje é `MedicationsPage.tsx` (não passa `date`). **8.3 é: um navegador de data + a distinção temporal "perdida" + a correção de dose.** Ver Dev Notes › "O encanamento que a 8.2 deixou pronto".

> **⚠️ Medicamento NÃO TEM denominador → NÃO há gráfico, score, "% de adesão", `recharts` nem `dataviz` nesta story.** Isto **diverge** das irmãs 7.3 (Saúde) e 6.4 (Hábitos), que são leitura **analítica** (gráfico de evolução + dashboard). AD-07 item 10 é explícito: *"Medicamento não tem denominador — a ausência de uma dose agendada é um evento clínico de perda"*. O histórico de 8.3 é um **registro clínico por data** (confirmado / perdido / não-aplicável por medicamento×bloco×dia) + correção, **não** um painel de tendências. Ver Escopo.

> **⚠️ Zero schema novo → zero migration → o gate recorrente de migration na branch Neon `e2e` NÃO se aplica.** `dose_at_time` e `confirmed_at` já são campos editáveis do model (`models.py:217-218`, sem `editable=False`). 8.3 não cria model, coluna nem enum. `makemigrations --check` deve dizer "No changes detected" (como a 7.3). A branch `e2e` já tem `0001`+`0002` (aplicadas na 8.1/8.2). Ver Dev Notes › "Sem migration".

> **⚠️ Voz: "dose perdida" é um sinal CLÍNICO NEUTRO, nunca uma repreensão.** Zero gamificação **e** zero punição — sem vermelho de alarme dominante, sem "Você perdeu!", sem streak quebrado. É informação factual ("Dose perdida", texto + ícone, cor nunca sozinha). UX-DR13/DR20. Ver Dev Notes › "Voz e a11y".

## Acceptance Criteria

### AC1 — Superfície de Histórico: aba "Hoje" · "Histórico" + navegação por data, sem novo item de nav (FR-3.7, UX-DR11, AD-14)

**Dado que** a tela de Medicamentos (`/health/medications`) hoje é só a confirmação do dia,
**Quando** 8.3 é entregue,
**Então** a tela ganha um **shell de abas "Hoje" · "Histórico"** (espelhando exatamente `HealthMetricsTabs` de 7.3 / `HabitsTabs` de 6.4), com a sub-rota **`/health/medications/history`** hospedando a superfície de histórico; a aba "Hoje" continua sendo a superfície diária da 8.2 (hoje, sem navegação de data),
**E** a superfície de Histórico tem um **navegador de data** (botões "Dia anterior" / "Próximo dia" + um `TextField type="date"` limitado a **≤ hoje**), com datas manipuladas por **split de string / `Date` local — nunca `new Date(iso)`** (evita drift de fuso; molde `HabitHistory.tsx:16-42,101-210`),
**E** **NENHUM item novo de Sidebar/BottomNav** é adicionado (a aba vive no `<Outlet/>` — protege os 3 testes compartilhados da casca); o link "Medicamentos" já existe e é `<Link>` puro; BottomNav (`startsWith('/health')`) mantém "Saúde" realçada na sub-rota; o realce exato do Sidebar em `/health/medications/history` é um **nit aceito** (idêntico a 7.3/6.4 — não tocar a estrutura do Sidebar).

### AC2 — Estado de confirmação por bloco/medicamento na data selecionada (read-model reusado) (FR-3.7, AD-07 item 1)

**Dado que** Hugo seleciona uma data D no histórico,
**Quando** a superfície carrega D,
**Então** ela lê D via `useMedicationDayQuery(D)` → `GET /api/medications/days/?date=D` (o **mesmo** endpoint seed-then-read da 8.2, `MedicationDayView.get`) e exibe, **por bloco**, o **estado final de confirmação de cada medicamento** — reusando `MedicationBlock`/`EntryRow` e o read-model `get_medication_day` (shape `{date, blocks:[{timeBlockId, timeBlockName, status, entries}], adHoc:[...]}`, cada entry com `id, medicationId, medicationTitle, substanceName, doseAtTime, confirmedAt, source, timeBlockId`),
**E** o estado do bloco (`confirmed`/`partial`/`pending`) continua **derivado** via `deriveBlockStatus` (nunca armazenado); a substância exibida é a **vigente em D** (`current_substance_version_of(med, D)`), e a dose exibida é a `doseAtTime` **congelada em D** (não a de hoje).

### AC3 — Dose perdida: sinal clínico distinto de "pendente" e de "não aplicável" (FR-3.7, AD-07 item 10)

**Dado que** a AD-07 define três situações distintas,
**Quando** o histórico exibe uma linha em D,
**Então** o estado de cada linha é derivado pela regra temporal (helper puro `deriveEntryStatus(entry, isPast)`, molde `deriveBlockStatus`):
| Situação | Estado exibido |
|---|---|
| linha `scheduled` com `confirmedAt` preenchido | **Confirmado** (tomado) |
| linha `scheduled` sem `confirmedAt`, **dia passado** (D < hoje) | **Dose perdida** (sinal clínico) |
| linha `scheduled` sem `confirmedAt`, **hoje/futuro** | **Pendente** (ainda pode confirmar) |
| linha `ad_hoc` | **Confirmado** (avulso; ausência sem sentido) |
| **sem linha** para o (med, bloco) em D | **Não aplicável** (medicamento inativo em D — não renderizado) |

**E** "dose perdida" é indicada por **texto + ícone** (ex.: "Dose perdida" + ícone), **nunca só cor** (WCAG 2.2 AA); num **dia passado**, um bloco derivado como `pending` é **rotulado como "Doses perdidas"** (relabel de exibição gated por `isPast`; `deriveBlockStatus` em si permanece inalterado, pois alimenta o updater otimista),
**E** a distinção **perdida ≠ não aplicável** é estrutural: como a materialização (AC4) só cria linha para `(med, bloco)` **ativo em D**, "sem linha" significa inequivocamente "não aplicável naquele dia" (medicamento inativo), enquanto "linha sem confirmação num dia passado" é a perda.

### AC4 — Navegar a um dia passado materializa (gap-fill) via o seed idempotente da 8.2 (FR-3.7, AD-07 item 7, NFR-4)

**Dado que** Hugo abre no histórico um dia passado D que **nunca foi aberto**,
**Quando** a superfície busca D (`GET /days/?date=D`),
**Então** `MedicationDayView.get` roda `seed_medication_day(user, D)` **antes** de ler (comportamento existente da 8.2, sancionado para catch-up e "para a 8.3 ler") — materializando **uma linha `scheduled`** por `(medicamento, bloco)` com **versão de agenda vigente e `active=True` em D**, com `dose_at_time` congelada da versão de D e `confirmed_at=None`,
**E** o seed é **idempotente e não-destrutivo** (2ª visita não recria/sobrescreve; **nunca** `update_or_create`) e **seguro para o passado**: medicamentos criados **depois** de D **não retroagem** (`current_schedule_version_of(...) is None` para D), então navegar meses atrás **não** fabrica perdas de medicamentos que não existiam; dias já materializados mantêm sua `dose_at_time` congelada mesmo que a agenda mude depois,
**E** o custo de escrita-na-leitura ao navegar (um seed idempotente por dia visitado) é **aceitável sob AD-14** (revisão histórica sem NFR formal; single-user). **Não** construir um endpoint de leitura sem-seed paralelo (mostraria dias nunca abertos como vazios e **esconderia** perdas — anti-objetivo clínico).

### AC5 — Edição retroativa da CONFIRMAÇÃO: UPDATE só naquela linha, não sangra (FR-3.7, AD-07 item 11, NFR-4)

**Dado que** Hugo revisa um dia passado e percebe que confirmou/deixou de confirmar por engano,
**Quando** ele alterna o checkbox de uma linha,
**Então** dispara `useConfirmMedicationEntryMutation(D)` → `PATCH /api/medications/days/{entryId}/` com `{confirmed}` → `confirm_medication_entry` → **UPDATE só naquela linha** (`confirmed_at = now()` ou `None`, `save(update_fields=["confirmed_at"])`) — comportamento **já existente da 8.2, reusado** para dias passados,
**E** a escrita **não sangra**: não toca outras linhas, nem a agenda (`medication_schedule_versions`), nem a substância (`medication_substance_versions`); a mutação é **otimista** com rollback em erro, chaveada em `keys.medications.day(D)`; o cabeçalho do bloco recomputa via `deriveBlockStatus` no updater.

### AC6 — Correção retroativa da DOSE: UPDATE só naquela linha, validada, não sangra (FR-3.7, AD-07 item 11, NFR-4)

**Dado que** Hugo precisa corrigir a **dose registrada** de um dia passado (ex.: tomou meia dose),
**Quando** ele edita a dose de uma linha,
**Então** um afordance de "Corrigir dose" por linha permite editar a `dose_at_time` (editor de componentes repetível `[{label, amount, unit}]`, **reusando o idioma `EnumOptionsEditor` da 8.1**), dispara `PATCH /api/medications/days/{entryId}/` com `{dose}`, e o serviço **valida** (`_validate_dose` reusado: lista não-vazia, `amount` numérico rejeitando `bool`, `unit` não-vazia) **antes** de escrever, fazendo **UPDATE só naquela linha** (`save(update_fields=["dose_at_time"])`),
**E** a correção de dose **não toca a agenda nem a substância** (não cria versão nova — é a linha realizada de D que muda, não o catálogo prospectivo) e **não sangra** para vizinhos; dose inválida → `DomainError` (409); a `dose_at_time` (chaves palavra-única) **não** entra em `JSON_UNDERSCOREIZE.ignore_fields` (mesma decisão da 8.1/8.2, provada por `response.content`).

### AC7 — Histórico preservado após troca/desativação do medicamento (FR-3.7, AD-07 itens 3/9/11, NFR-4)

**Dado que** um medicamento teve a agenda **desativada** (nova versão `active=false`) ou a substância **trocada** depois de D,
**Quando** Hugo consulta D no histórico,
**Então** as linhas de `medication_day_entries` de D **permanecem** (a materialização é um snapshot independente do `active` prospectivo — desativar **nunca** apaga nem `.delete()` linhas passadas), exibindo a `dose_at_time` **congelada em D**,
**E** a **substância exibida em D é a vigente em D** (`current_substance_version_of(med, D)` = `max(effective_from) <= D`), não a atual — trocar o remédio hoje **não** reescreve o histórico; o slot `Medication.id` (âncora estável) garante continuidade do registro de adesão através de trocas.

### AC8 — a11y, voz clínica neutra e estados; casca intocada; sem gráfico/score (Accessibility Floor, UX-DR13/DR20, AD-07, AD-14)

**Dado que** a superfície é de revisão/correção clínica,
**Quando** o Histórico é renderizado,
**Então** cobre os estados: **carregando** (skeleton, `role="status"`), **vazio** ("Nenhum medicamento neste dia." para uma data sem linhas — indistinguível de "não aplicável", correto), **erro de leitura** (retry local `role="alert"` que preserva a data selecionada), **erro de escrita** (inline `role="alert"`, otimismo revertido),
**E** voz **pt-BR neutra e clínica** — **zero gamificação e zero punição** (dose perdida é factual, não repreensão); **cor nunca sozinha** (texto + ícone para todos os estados); alvos ≥44px; `<main aria-label="Medicamentos">` mantido; **nada Query-driven é adicionado a Sidebar/BottomNav** (a query vive na página/`<Outlet/>` — os 3 testes compartilhados da casca seguem verdes),
**E** **nenhum gráfico, score, "% de adesão", `recharts` ou dependência de charting** é introduzido (AD-07: sem denominador; contraste consciente com 7.3/6.4).

## Escopo — o que NÃO entra nesta story (limites explícitos)

- ❌ **Endpoint de range/histórico multi-dia (`/history/?start=&end=`) / grid ou calendário de adesão através de vários dias / "três visualizações" / gráfico de evolução / dashboard de período** → a AC de epics é **"histórico POR DATA"** (per-date), não um range analítico. **Diverge conscientemente** das irmãs 7.3/6.4 (que têm range + gráfico) porque medicamento **não tem denominador** (AD-07 item 10) e a 8.2 já pré-construiu a leitura+seed por data. Um panorama multi-dia (calendário de adesão) é **deferível** (latitude AD-14) — ver "Decisões a confirmar" #1. **Não** construir sem confirmação.
- ❌ **`recharts` / `dataviz` / qualquer gráfico ou stat-tile** → não há série numérica plotável (sem denominador/score). Não instalar/importar charting. (Contraste: 7.3/6.4 usam `recharts@3.9.2`.)
- ❌ **Novo model / coluna / enum / migration / índice / view materializada** → `dose_at_time`/`confirmed_at` já existem e são editáveis; a leitura reusa `get_medication_day`. `makemigrations --check` = "No changes detected". A latitude de otimização fica reservada (AD-14).
- ❌ **Endpoint de leitura sem-seed paralelo ao `MedicationDayView`** → navegar a um dia passado **deve** semear (gap-fill) para revelar perdas de dias nunca abertos (AC4). Um read puro esconderia perdas. Reusar `MedicationDayView.get` (seed-then-read).
- ❌ **Cadastro/edição de medicamentos, agenda, blocos, substância, médicos** → é a tela de **configuração** `/settings/medications` (8.1). Corrigir a dose de um **dia passado** (AC6) muda **uma linha realizada** (`medication_day_entries`), **NÃO** cria versão de agenda nem toca o catálogo. Não confundir "corrigir a dose de ontem" com "mudar a dose prospectiva".
- ❌ **Registrar avulso (`ad_hoc`) num dia passado** → a UI de avulso é da 8.2 (na aba "Hoje"). O histórico **exibe** avulsos passados (read-only na seção PRN), mas registrar um novo avulso retroativo é fora de escopo aqui — ver "Decisões a confirmar" #4.
- ❌ **Integração no `/today` / Daily Log ("espinha do ritual")** → a superfície canônica é `/health/medications` (+ aba Histórico). Não exigido pela AC de epics.
- ❌ **Qualquer FK entre `medications` e `health`** → domínios independentes, sem FK (architecture.md#7.1:1151).
- ❌ **`date.today()` / `timezone.now()` cru** → `today_for(user)` / `core.calendar.now()` (para `confirmed_at`, único lar sancionado, criado na 8.2); no frontend, datas por split de string. Guardrail de AST no CI.
- ❌ **Novo item de Sidebar/BottomNav** → quebraria os 3 testes compartilhados. Histórico é **aba/sub-rota** dentro de Medicamentos (AC1).

## Tasks / Subtasks

- [x] **Task 1 — Backend: correção retroativa de dose (AC6) — estender o PATCH de linha, sem novo model**
  - [x] Em `backend/medications/services.py`: **generalizar** a edição de linha. Opção recomendada — adicionar `update_day_entry(*, user, entry_id, confirmed=_UNSET, dose=_UNSET) -> MedicationDayEntry` (`@transaction.atomic`). **🔴 REUSAR o `_UNSET` que JÁ existe em `services.py:35`** (`_UNSET = object()`, usado como default de `add_substance_version`, `services.py:205-206,225,228`) — **NÃO redefinir**: uma 2ª declaração cria um objeto novo (B) e as checagens de `add_substance_version` (ligadas ao objeto original A no import) passam a falhar (`A is B` → `False`), escrevendo o próprio sentinela em `laboratory`/`prescribed_by` e quebrando a versão de substância da 8.1. Molde do verbo `_UNSET`: `habits.services.update_habit_day_entry` (`habits/services.py:393-428`, que a 8.2 já citou). Se `dose is not _UNSET`: `_validate_dose(dose)` (reusar, `services.py:70`) **antes** de escrever; setar `entry.dose_at_time = dose`. Se `confirmed is not _UNSET`: `entry.confirmed_at = now() if confirmed else None`. `entry.save(update_fields=[<só os campos mudados>])`. `MedicationDayEntry.objects.get(id=entry_id)` auto-escopado → cross-tenant `DoesNotExist` → 404 na view. **UPDATE só naquela linha; não tocar agenda/substância.** (Alternativa mínima: manter `confirm_medication_entry` e adicionar um `edit_day_entry_dose(*, user, entry_id, dose)` separado — mas `_UNSET` num só verbo é mais limpo e espelha hábitos.)
  - [x] Preservar o caminho de confirmação da 8.2: a view de PATCH pode chamar `update_day_entry`; **manter** `confirm_block`/`create_ad_hoc_entry`/`confirm_medication_entry` intactos (a aba "Hoje" e o block-confirm não mudam). Se refatorar a view para `update_day_entry`, garantir que `confirm_medication_entry` ainda exista OU que os testes/otimismo da 8.2 continuem passando.
  - [x] `backend/medications/serializers.py`: o input de PATCH (`EntryConfirmSerializer`, `serializers.py:246`) hoje só tem `confirmed`. **Estender aditivamente**: adicionar `dose = DoseField(required=False)` (reusar `DoseField`, `serializers.py:51`) e tornar `confirmed = BooleanField(required=False)` — pelo menos um dos dois deve vir. **O guard "ambos ausentes" mora no `validate()` do serializer** e levanta `serializers.ValidationError` → **400** (NÃO `DomainError`, que mapeia para 409). `validate_dose` como em `ScheduleVersionCreateSerializer.validate_dose` (`serializers.py:199`) se aplicável. Renomear para `EntryUpdateSerializer` é opcional (aditivo no contrato de qualquer forma — nome estável se possível).
  - [x] `backend/medications/views.py`: `MedicationDayEntryDetailView.patch` (`views.py:316`) → aceitar `{confirmed?, dose?}`, chamar `update_day_entry`, retornar o **read-model do dia** (`entry.date`) via `MedicationDaySerializer` (uniforme com a 8.2 — alimenta o updater otimista). `DomainError` → 409, entry inexistente/cross-tenant → 404.
  - [x] **Sem migration.** `dose_at_time`/`confirmed_at` já existem e são editáveis (`models.py:217-218`). Confirmar `makemigrations --check` = "No changes detected".
  - [x] **Casing JSONB:** `dose_at_time` (chaves palavra-única) **não** entra em `JSON_UNDERSCOREIZE.ignore_fields` (`base.py:209`) — decisão herdada de 8.1/8.2; provar idempotência inspecionando `response.content` (não `response.data`).
  - [x] Regenerar contrato: `cd backend && uv run python manage.py spectacular --file ../schema.yaml` + (frontend) `npm run generate-types`. Alvo: diff **aditivo** (0 remoções) — só o input de PATCH ganha `dose` (e `confirmed` vira opcional). **Nenhum enum novo** (`SourceEnum` já pinado). Commitar ambos.

- [x] **Task 2 — Frontend: helper de estado temporal + mutação de dose (AC3, AC5, AC6)**
  - [x] `frontend/src/features/medications/dayModel.ts`: adicionar helper puro `deriveEntryStatus(entry: MedicationDayEntry, isPast: boolean): 'confirmed' | 'missed' | 'pending'` (molde de estilo `deriveBlockStatus`, `dayModel.ts:15`): `ad_hoc` OU `confirmedAt != null` → `'confirmed'`; senão `isPast` → `'missed'`; senão `'pending'`. Exportar no barrel (`index.ts`). **Não** alterar `deriveBlockStatus` (alimenta o updater otimista) — o relabel "pending→Doses perdidas" para bloco em dia passado é só na **exibição** (AC3), gated por `isPast`.
  - [x] `frontend/src/features/medications/api.ts`: mutação de correção de dose. Recomendado — **estender** `useConfirmMedicationEntryMutation(date)` para um `useUpdateEntryMutation(date)` que aceita `{ entryId, confirmed?, dose? }` (PATCH `/api/medications/days/${entryId}/`), **ou** adicionar `useEditEntryDoseMutation(date)` dedicada. A confirmação retroativa **reusa** `useConfirmMedicationEntryMutation(date)` (já otimista, chave `keys.medications.day(date)`). A edição de dose pode ser **`useMutation` + `invalidateQueries(keys.medications.day(date))`** (correção é baixa frequência — otimismo é opcional aqui; se otimista, updater troca `doseAtTime` da linha). Manter as 4 mutações da 8.2 intactas.
  - [x] `keys.ts`: **nenhuma chave nova** — reusar `keys.medications.day(date)` (`keys.ts:74`), que já dá um slot de cache por data.

- [x] **Task 3 — Frontend: shell de abas + rota + página de histórico (AC1)**
  - [x] `frontend/src/pages/health/MedicationsTabs.tsx` (**novo**, mirror exato de `HealthMetricsTabs.tsx` / `HabitsTabs.tsx`): abas "Hoje" (`/health/medications`) · "Histórico" (`/health/medications/history`), via `Tab component={Link}`; `value` derivado de `location.pathname`. `minHeight:44`.
  - [x] `frontend/src/pages/health/MedicationsPage.tsx` (8.2, 13 linhas): inserir `<MedicationsTabs/>` acima de `<MedicationDaySurface/>` (a superfície diária vira a aba "Hoje"). **Manter** `<main aria-label="Medicamentos">`.
  - [x] `frontend/src/pages/health/MedicationHistoryPage.tsx` (**novo**, mirror de `HealthHistoryPage.tsx`): `<Box component="main" aria-label="Medicamentos" sx={{p:3}}>` com `<MedicationsTabs/>` + `<MedicationHistorySurface/>`. Compõe **só** `features/medications` (fronteira ESLint).
  - [x] `frontend/src/app/router.tsx`: adicionar `{ path: 'health/medications/history', element: <MedicationHistoryPage/>, handle: { title: 'Medicamentos — Histórico' } }` (após `health/medications`, `router.tsx:110-114`). **NÃO** tocar `Sidebar.tsx`/`BottomNav.tsx`. `routeDefinitions` é consumido por `router.test.tsx` — se ele enumera rotas, adicionar a nova; se `router.test.tsx`/`RouteAnnouncer.test.tsx` navegarem à nova rota ou mockarem `../features/medications`/`../pages/health/*`, garantir que os novos exports não quebrem o mock (a 8.2 verificou que essas suítes **não** navegam a `/health/medications` — reverificar para `/history`).

- [x] **Task 4 — Frontend: superfície de Histórico com navegador de data (AC1, AC2, AC3, AC7)**
  - [x] `frontend/src/features/medications/components/MedicationHistorySurface.tsx` (**novo**): estado `selectedDate` (default = hoje via helper local `isoLocalToday`, molde `HabitHistory.tsx:17-42`); **navegador de data** — botões "Dia anterior"/"Próximo dia" + `TextField type="date"` com `max={isoLocalToday()}`; datas por **split de string / `Date` local** (`addDays` local, **nunca** `new Date(iso)` — reusar o idioma de `HabitHistory.tsx:16-210`). **Adaptar o `clamp`:** o de `HabitHistory` é de **dois lados** (`clamp(iso, start, end)`, `HabitHistory.tsx:33-37`) porque hábitos navega dentro de um range; aqui há **só o limite superior = hoje** (sem `range.start`). Logo: "Próximo dia" desabilitado quando `selectedDate >= isoLocalToday()` (não passar de hoje); "Dia anterior" **sem limite inferior** (sempre habilitado — pode-se voltar indefinidamente no passado). Consome `useMedicationDayQuery(selectedDate)`; `isPast = selectedDate < isoLocalToday()`. Renderiza `blocks.map(b => <MedicationBlock block={b} date={selectedDate} dayDate={selectedDate} isPast={isPast} .../>)` + seção "Avulso/PRN" (read-only) para `adHoc`. **`MedicationBlock` exige `dayDate: string` (prop obrigatória, `MedicationBlock.tsx:87`) além de `date?`** — no histórico, ambos = `selectedDate` (uma data concreta, nunca `undefined`), senão `tsc` falha. Estados: skeleton (`role="status"`), vazio ("Nenhum medicamento neste dia."), erro-leitura-retry (`role="alert"`, preserva `selectedDate`). Molde de estrutura: `MedicationDaySurface.tsx` (8.2) + `HabitHistory.tsx` (nav de data). **Reutilizar** os componentes existentes; não forkar a renderização de bloco.
  - [x] `frontend/src/features/medications/components/MedicationBlock.tsx` (8.2): estender **aditivamente** com prop opcional `isPast?: boolean` (default `false`):
    - `EntryRow`: usar `deriveEntryStatus(entry, isPast)` para o rótulo/ícone da linha — `'missed'` mostra **"Dose perdida" + ícone** (texto + ícone, nunca só cor); `'pending'`/`'confirmed'` como hoje. O checkbox de confirmação continua funcional (permite AC5 retroativo).
    - Cabeçalho do bloco: quando `isPast` e `deriveBlockStatus(entries) === 'pending'`, **rotular como "Doses perdidas"** (relabel de exibição; `STATUS_LABEL`/`StatusIndicator` gated por `isPast`). `deriveBlockStatus` permanece inalterado.
    - Manter 100% do comportamento atual quando `isPast` é `false`/ausente (a aba "Hoje" não muda visualmente).
  - [x] `frontend/src/features/medications/index.ts`: exportar `MedicationHistorySurface`, `deriveEntryStatus`.

- [x] **Task 5 — Frontend: afordance de correção de dose por linha (AC6)**
  - [x] Em `MedicationBlock.tsx`/`EntryRow` (ou um subcomponente `EntryDoseEditor`), quando `isPast` (correção é ação de revisão), expor um afordance "Corrigir dose" que abre um **editor de componentes de dose repetível** (`[{label, amount, unit}]`) — **reusar o idioma `EnumOptionsEditor`** de `HealthMetricsManager.tsx`/`MedicationsManager.tsx` (8.1): add/remove de linhas de `TextField`, `Button startIcon={<AddIcon/>}`, `IconButton` de remover com `aria-label`. Ao salvar, chama a mutação de dose (Task 2) com `{ entryId, dose }`. Pré-preenche com `entry.doseAtTime` atual.
  - [x] **Se usar `Modal` (shared `Modal.tsx`)**: separar `onClose` (cancelar) de `onSuccess` (salvo) **desde o 1º rascunho** — nunca reaproveitar `onClose` para os dois (bug HIGH do Épico 11). Alternativa inline (expand na linha) evita o modal — decisão do dev; se inline, mais simples.
  - [x] Erro de escrita inline `role="alert"` (reusar constante `SAVE_ERROR`). Confirmação sem gamificação. `minHeight:44` nos controles.

- [x] **Task 6 — Testes backend (AC5, AC6, AC7 + reverificação de AC4)** — matriz fixa, sem factory/model novos.
  - [x] `medications/tests/test_services.py` (append): **AC6** — `update_day_entry(dose=...)` faz UPDATE só na `dose_at_time` daquela linha (`update_fields`), **não** cria versão de agenda/substância, **não** altera outras linhas (provar com 2ª linha vizinha intacta); dose inválida (lista vazia / `amount` bool / `amount` não-numérico / `unit` vazia) → `DomainError`. **AC5** — `update_day_entry(confirmed=...)` (ou `confirm_medication_entry`) em linha de **dia passado** seta `confirmed_at`, não sangra. **AC7** — após `set_schedule(active=False)` (desativação prospectiva), as linhas de `medication_day_entries` de D **continuam existindo** (nenhum delete) e `current_substance_version_of(med, D)` ainda retorna a substância vigente em D; trocar a substância hoje não muda o `substance_name` derivado de D. **AC4 (reverificação em contexto de histórico)** — `seed_medication_day` num dia passado nunca aberto materializa só `(med, bloco)` ativos em D; med criado depois de D não retroage (`current_schedule_version_of is None`); idempotente. Usar `MedicationDayEntryFactory`/`MedicationScheduleVersionFactory` com datas fixas (`_FIXED_DATE + timedelta`) — **nunca** `date.today()`.
  - [x] `medications/tests/test_views.py` (append): `PATCH /api/medications/days/{id}/` com `{dose}` → 200 + read-model do dia com a dose atualizada; com `{confirmed}` → 200 (reconfirma o caminho 8.2); com ambos ausentes → 400; dose inválida → 409; cross-tenant/inexistente → 404; **casing** `test_day_entry_dose_edit_survives_camelcase_roundtrip` (inspeciona `response.content`, molde do teste homônimo de 8.2). Isolamento cross-tenant do PATCH (tenant B não edita linha de A → 404).
  - [x] **Sem `register_isolation_case` novo** (nenhum model novo). **Sem migration** (`makemigrations --check` = "No changes detected").

- [x] **Task 7 — Testes frontend (AC1, AC2, AC3, AC5, AC6, AC8)**
  - [x] `features/medications/dayModel.test.ts` (ou append): `deriveEntryStatus` — matriz das 4 linhas de AC3 (`confirmed`/`missed`/`pending`/`ad_hoc→confirmed`) × `isPast`.
  - [x] `features/medications/components/MedicationHistorySurface.test.tsx` (**novo**): `vi.mock('../../../api/client')`, wrapper `QueryClientProvider` (`retry:false`), `ThemeProvider(createBujoTheme('light'))`, `jest-axe` sem violações. Assert: navegador de data (dia anterior/próximo; "próximo" desabilitado em hoje; `type="date"` com `max=hoje`); dia passado com linha `scheduled` sem `confirmedAt` mostra **"Dose perdida"** (texto+ícone), enquanto hoje mostra "Pendente"; dia sem linhas → "Nenhum medicamento neste dia." (= não aplicável); estados loading/erro-retry. **`vi.clearAllMocks()` (não `resetAllMocks`)** para não apagar `window.matchMedia`.
  - [x] `features/medications/components/MedicationBlock.test.tsx` (append, 8.2): `isPast` relabel do cabeçalho (`pending`→"Doses perdidas"); `EntryRow` com `isPast` mostra "Dose perdida"; afordance "Corrigir dose" edita e chama PATCH `/api/medications/days/{id}/` com `{dose}` + reflete; **`<input type="number">`** do editor de dose → usar `fireEvent.change(field, { target: { value } })` (jsdom caveat); rollback/erro de escrita `role="alert"`. Confirmar que sem `isPast` nada muda (aba "Hoje" intacta).
  - [x] `features/medications/api.test.tsx` (append): mutação de dose — endpoint/payload (`PATCH .../{id}/` com `{dose}`), invalidação/otimismo da chave `keys.medications.day(date)`; confirmação retroativa reusa `useConfirmMedicationEntryMutation`.
  - [x] `pages/health/MedicationHistoryPage`/router: `/health/medications/history` renderiza a superfície de histórico; `<main aria-label="Medicamentos">` único; abas "Hoje"/"Histórico" presentes. Confirmar que os **3 testes compartilhados da casca** (`AppLayout`/`router`/`RouteAnnouncer`) seguem verdes (nada Query-driven na nav).

- [x] **Task 8 — E2E (Playwright, branch Neon `e2e`) (AC2, AC3, AC5, AC6)**
  - [x] `frontend/e2e/medications-history.spec.ts` (**novo**, molde `medications-day.spec.ts` de 8.2 + `health-history.spec.ts` de 7.3): reusar/estender `seedMedications.ts`. Fluxo: seed med+bloco+dose (com agenda vigente numa **data passada** para materializar); `goto('/health/medications')` → clicar aba "Histórico" → navegar a um dia passado → **materializa** (seed) → linha `scheduled` sem confirmação aparece como **"Dose perdida"** → confirmar retroativamente (vira "Confirmado") → corrigir a dose → `reload()` prova persistência → `expect(consoleErrors).toEqual([])`. Empty-state: dia sem medicamento ativo → "Nenhum medicamento neste dia.".
  - [x] **Gate operacional (leve):** **SEM migration nova** nesta story → **nada a aplicar** na branch `e2e`. **Confirmar** que a branch `e2e` já tem `0001`+`0002` (aplicadas na 8.1/8.2); se algum "relation does not exist" surgir, rodar `DJANGO_SETTINGS_MODULE=config.settings.e2e uv run python manage.py migrate` (de `backend/`) para reconciliar — mas não deve ser necessário. **Frontend: `nvm use 22.15.1` antes de cada comando.** Playwright `workers:1`, `expect.timeout:10_000`, via `cd frontend && npm run test:e2e`.

- [x] **Task 9 — Verificação e contrato (todas as ACs)**
  - [x] Backend: `ruff` (medications/config), `lint-imports` (**KEPT** — `medications` já em `forbidden_modules`, sem aresta cross-app nova), `pytest` **em lotes** (`medications accounts core` + `habits bujo braindump health`), **colar a contagem REAL observada da união, nunca de memória, sem escopar por caminho como se fosse total**; `spectacular` + diff `types.gen.ts` (aditivo); `makemigrations --check` = "No changes detected".
  - [x] Frontend (`nvm use 22.15.1` **antes de cada comando**): `tsc`, ESLint (fronteira: `pages/health` compõe só `features/medications`), `vitest` (suíte completa — colar contagem real depois do último teste), `vite build`.
  - [x] **File List reconciliada por último:** `git status --short` + `git diff --stat` **depois** de E2E/verificação; nomear explicitamente artefatos de **tipo novo** (`MedicationHistorySurface.tsx`, `MedicationsTabs.tsx`, `MedicationHistoryPage.tsx`, `medications-history.spec.ts`, testes novos).

## Dev Notes

### O encanamento que a 8.2 deixou pronto (a chave de 8.3)

[Source: mapa do código verificado em `backend/medications/` e `frontend/src/features/medications/` — pós-8.2]

A 8.2 desenhou a camada realizada **explicitamente prevendo a 8.3**. O que já existe e 8.3 **reusa sem reconstruir**:

- **Leitura por data (read-model, sem seed):** `get_medication_day(*, user, date) -> dict` (`services.py:426`) — read-only, **não** chama seed (docstring reserva-o para "a 8.3 (histórico) reusa o read-model sem semear"). Shape verbatim: `{"date": date, "blocks": [{"time_block_id", "time_block_name", "status", "entries"}], "ad_hoc": [...]}`; cada entry: `{id, medication_id, medication_title, substance_name, dose_at_time, confirmed_at, source, time_block_id}` (`_entry_read_model`, `services.py:407`).
- **View seed-then-read por `?date=`:** `MedicationDayView.get` (`views.py:304`) resolve `date` via `_resolve_day` (`views.py:78`, param `date`, default hoje, ISO inválido → 400), roda `seed_medication_day` **depois** lê. **8.3 navega a dias passados por este mesmo endpoint** (AC2/AC4).
- **`date` flui ponta-a-ponta no frontend:** `useMedicationDayQuery(date?)` (`api.ts:296`) com `params: date ? {date} : undefined`; chave `keys.medications.day(date)` (`keys.ts:74`) = `['medications','day', date ?? 'today']` → **um slot de cache por dia**. `MedicationDaySurface` (`.tsx:141`), `MedicationBlock` (`.tsx:89`), `EntryRow` (`.tsx:43`) **todos aceitam `date?`** e o encadeiam nas mutações. `MedicationsPage.tsx` é o **único** que não passa `date` (hoje-só) — o seam de 8.3.
- **Mutações de escrita em qualquer data (reusadas):** `confirm_medication_entry(*, user, entry_id, confirmed)` (`services.py:469`, `save(update_fields=["confirmed_at"])`); frontend `useConfirmMedicationEntryMutation(date)` (`api.ts:319`, otimista, chave `day(date)`, updater troca `confirmedAt` + recomputa `status` via `deriveBlockStatus`). **AC5 (confirmação retroativa) é 100% reuso.**
- **Helpers puros compartilhados:** `deriveBlockStatus` (`dayModel.ts:15`) e `doseSummary` (`dayModel.ts:29`). **Não** forkar.
- **Campos editáveis:** `dose_at_time` (`models.py:217`, `JSONField default=list`) e `confirmed_at` (`models.py:218`, `DateTimeField null=True`) são campos **normais editáveis** (nenhum `editable=False`). AC6 (corrigir dose) muta `dose_at_time`; AC5 muta `confirmed_at`.

**Portanto o footprint de 8.3 é pequeno:** backend = **uma** extensão (dose no PATCH de linha); frontend = navegador de data + `deriveEntryStatus` + abas + relabel/afordance de correção. Sem novo endpoint de leitura, sem migration, sem gráfico.

### Semântica clínica de AD-07 (itens 10 e 11) — o coração de 8.3

[Source: architecture.md#AD-07 linhas 397-408, 446-468]

Item 10 (tabela de ausência) — **medicamento ≠ hábito**:
| Situação | Significado |
|---|---|
| `scheduled` sem `confirmed_at`, dia passado | **Dose perdida** — sinal clínico de adesão |
| `scheduled` com `confirmed_at` | Tomado conforme esperado |
| Sem linha no dia | Não aplicável (medicamento inativo naquele dia) |
| `ad_hoc` | Sempre confirmada; ausência sem sentido |

> *"Contraste com AD-06: hábito ausente vira 0% e entra no denominador. **Medicamento não tem denominador** — a ausência de uma dose agendada é um evento clínico de perda, exibível como tal."* → **Sem gráfico/score/% nesta story.**

Item 11 (edição não sangra): *"corrigir dose ou `confirmed_at` de um dia passado é `UPDATE` naquela única linha de `medication_day_entries`; não toca a agenda nem a substância. NFR-4 honrado: o sistema nunca retroage, o usuário edita o que quiser."* → **AC5/AC6.** Caso-âncora AD-07:466 "*Dose perdida ontem: linha scheduled com confirmed_at nulo num dia passado → exibida como perda clínica*" — a **exibição** é literalmente esta story.

NFR-4 (imutabilidade sistêmica, não do usuário) [Source: architecture.md:47,68]: *"imutabilidade sistêmica apenas… O usuário tem autonomia para editar manualmente qualquer registro histórico."* → a correção retroativa (AC5/AC6) é **explicitamente permitida**.

### Divergência consciente das irmãs 7.3 (Saúde) e 6.4 (Hábitos)

[Source: 7-3-historico-de-saude-em-tres-visualizacoes.md; 6-4; AD-07 item 10]

7.3/6.4 são leitura **analítica**: endpoint de **range** (`/history/?start=&end=`), gráfico de evolução (`recharts`), dashboard de período. **8.3 diverge**:
- **Por data, não por range.** A AC de epics é "histórico **por data**" (per-date). A 8.2 pré-construiu a leitura+seed por data; um range exigiria derivar linhas esperadas de dias nunca abertos (duplicaria o seed em forma read-only) — desnecessário e menos fiel.
- **Sem gráfico/score.** Medicamento não tem denominador (AD-07). Não há série numérica de adesão para plotar. **Não** carregar `dataviz`, **não** importar `recharts`.
- **NÃO é read-only puro** (7.3 era): 8.3 **edita** dias passados (AC5/AC6). Mas a edição é **UPDATE de uma linha** (reuso do padrão da 8.2 + `update_habit_day_entry`), não escrita de versão.

O que **é** portado de 7.3/6.4: o **shell de abas** dentro da feature (`HealthMetricsTabs`/`HabitsTabs` → `MedicationsTabs`), a **sub-rota** (`/health/medications/history`), e o **idioma de navegação de data** (`HabitHistory.tsx:16-210` — `isoLocalToday`/`addDays`/`clamp` por split de string, prev/next-day, `TextField type="date"` limitado). **Não** há componente de date-picker compartilhado no projeto (`@mui/x-date-pickers` não é dependência) — copiar o idioma inline de `HabitHistory.tsx`.

### Correção retroativa de dose (AC6) — o único backend novo

[Source: `services.py:469` (`confirm_medication_entry`), `habits/services.py:393-428` (`update_habit_day_entry` — molde `_UNSET`)]

Generalizar o PATCH de linha para `{confirmed?, dose?}` com sentinela `_UNSET`:

```python
# _UNSET JÁ existe em services.py:35 — REUSAR, nunca redefinir (ver Task 1).

@transaction.atomic
def update_day_entry(*, user, entry_id, confirmed=_UNSET, dose=_UNSET):
    entry = MedicationDayEntry.objects.get(id=entry_id)  # auto-escopado → cross-tenant 404
    fields = []
    if dose is not _UNSET:
        _validate_dose(dose)          # reusa services.py:70 — antes de escrever
        entry.dose_at_time = dose
        fields.append("dose_at_time")
    if confirmed is not _UNSET:
        entry.confirmed_at = now() if confirmed else None   # core.calendar.now() (8.2)
        fields.append("confirmed_at")
    entry.save(update_fields=fields)  # UPDATE só naquela linha — não sangra
    return entry
```

- **Não** cria versão de agenda/substância — corrigir a dose de **ontem** muda a linha realizada de ontem, **não** o catálogo prospectivo. Não confundir com `set_schedule`.
- `now()` = `core.calendar.now()` (criado na 8.2 como único lar sancionado de `timezone.now()`; o guardrail de AST proíbe `timezone.now()` cru fora de `core/calendar.py`).
- View retorna o read-model do dia (uniforme com a 8.2).

### Estado temporal derivado no frontend — `deriveEntryStatus` (AC3)

Decisão: a distinção **perdida vs. pendente** é **temporal sobre dados idênticos** (a linha `scheduled` sem `confirmed_at` é a mesma; só muda se D < hoje). Manter a derivação **no frontend** (helper puro, molde `deriveBlockStatus`) evita tocar o read-model compartilhado (que a aba "Hoje" usa) e o contrato:

```ts
// dayModel.ts
export function deriveEntryStatus(
  entry: MedicationDayEntry, isPast: boolean,
): 'confirmed' | 'missed' | 'pending' {
  if (entry.source === 'ad_hoc' || entry.confirmedAt != null) return 'confirmed';
  return isPast ? 'missed' : 'pending';
}
```

`isPast = selectedDate < isoLocalToday()`. O relabel do **cabeçalho do bloco** (`pending`→"Doses perdidas" quando `isPast`) é exibição — `deriveBlockStatus` (usado no updater otimista) **permanece** `confirmed`/`partial`/`pending`. **Alternativa documentada (risco de 1 decisão):** tornar o sinal autoritativo no backend adicionando `status` por entry ao read-model (comparando `date < today_for(user)`) — mais testável no serviço (espelha como a 8.2 tornou o status de bloco testável), porém toca o read-model/serializer/contrato compartilhados. Default = frontend; se o review preferir server-side, é aditivo.

### Materialização ao navegar o passado (AC4) — por que semear é correto

[Source: `services.py:345` (`seed_medication_day`), 8.2 AC2/AC3, AD-07 item 7]

Navegar a um dia passado D via `useMedicationDayQuery(D)` → `MedicationDayView.get` **semeia** D antes de ler. Isso é **desejado**: revela perdas de dias que Hugo nunca abriu. É **seguro**:
- Idempotente e não-destrutivo (create-if-missing; **nunca** `update_or_create`).
- Só materializa `(med, bloco)` com versão de agenda vigente e `active=True` **em D** (`current_schedule_version_of(med, bloco, D)`). Medicamento criado **depois** de D → `None` → **nenhuma** linha → navegar meses atrás **não** fabrica perdas retroativas.
- Dias já materializados mantêm `dose_at_time` congelada (fidelidade histórica).
- Custo (um seed idempotente por dia visitado) aceitável sob **AD-14** (revisão histórica sem NFR; single-user).

**Não** criar um endpoint de leitura sem-seed: mostraria dias nunca abertos como vazios e **esconderia** perdas (anti-objetivo). A distinção "perdida (linha sem confirmação) vs. não-aplicável (sem linha)" só é confiável **porque** o seed cria linha exatamente para os `(med, bloco)` ativos em D.

### UI — navegador de data + reuso de `MedicationBlock` (AC1–AC3, AC6)

[Source: `HabitHistory.tsx:16-210` (nav de data); `MedicationDaySurface.tsx`/`MedicationBlock.tsx` (8.2); `HealthMetricsManager.tsx`/`MedicationsManager.tsx` (editor de dose repetível)]

- **Navegador de data:** copiar o idioma de `HabitHistory.tsx` — `isoLocalToday()` (split de string, sem `new Date(iso)`), `addDays`, `clamp` (limite superior = hoje); botões "Dia anterior"/"Próximo dia" (`Próximo` desabilitado em hoje); `TextField type="date"` com `max={isoLocalToday()}`; *accessible name* com a data completa pt-BR.
- **Reuso de `MedicationBlock`/`EntryRow`:** estender com `isPast?` (default false). Sem `isPast`, comportamento idêntico à aba "Hoje" (zero regressão visual). Com `isPast`: `deriveEntryStatus` → "Dose perdida" por linha; relabel de cabeçalho `pending`→"Doses perdidas"; afordance "Corrigir dose".
- **Editor de dose (correção):** reusar o idioma **`EnumOptionsEditor`** (`HealthMetricsManager.tsx:42-93` / `MedicationsManager.tsx`) — linhas repetíveis `label`/`amount`/`unit`. Pré-preencher com `entry.doseAtTime`.
- **Modal (se usado):** separar `onClose` de `onSuccess` desde o 1º rascunho (bug HIGH do Épico 11). Inline (expand) evita o modal.
- **`<input type="number">` (amount):** nos testes, `fireEvent.change(field, { target: { value } })` — `userEvent.type/clear` não funcionam em jsdom.

### Voz e a11y — sinal clínico neutro (AC3, AC8)

[Source: EXPERIENCE.md#4.9:353; UX-DR13/DR20; epics.md#Story-8.3]

- **"Dose perdida" é factual, não punição.** Sem vermelho de alarme dominante, sem exclamação, sem "Você falhou/perdeu!", sem streak. Um ícone neutro + texto "Dose perdida"; cor **nunca** único indicador (WCAG 2.2 AA). Zero gamificação **e** zero repreensão.
- Estados: loading `role="status"` (skeleton); vazio "Nenhum medicamento neste dia." (= não aplicável); erro-leitura `role="alert"` + retry preservando `selectedDate`; erro-escrita `role="alert"` + rollback otimista.
- `<main aria-label="Medicamentos">` (mantido). Alvos ≥44px (default do tema). **Nada** Query-driven na nav.

### Os 3 (na prática 4–5) testes compartilhados da casca

[Source: memória `sidebar-bottomnav-shared-tests-need-query-mock`; review da 8.2 (`router.test.tsx`/`RouteAnnouncer.test.tsx` NÃO navegam a `/health/medications`)]

`AppLayout.test.tsx`/`router.test.tsx`/`RouteAnnouncer.test.tsx`/`Sidebar.test.tsx`/`BottomNav.test.tsx` renderizam a casca **sem** `QueryClientProvider`. **8.3 é seguro** porque as abas e o histórico vivem na **página (`<Outlet/>`)**, não na nav — o link "Medicamentos" segue `<Link>` puro. **Não** adicionar badge/contador Query-driven à nav. Se `router.test.tsx`/`RouteAnnouncer.test.tsx` passarem a navegar a `/health/medications/history` ou mockarem `../features/medications`/`../pages/health/*`, **adicionar `vi.mock`** nesses arquivos (a 8.2 verificou que hoje **não** navegam a `/health/medications`; reverificar para a nova sub-rota). `HabitsTabs.tsx`/`HealthMetricsTabs.tsx` são o precedente de "aba dentro da página, não item de nav".

### Sem migration (contraste com 8.1/8.2)

[Source: `models.py:217-218`; memória `apply-new-migration-to-neon-e2e-branch-before-e2e`]

8.3 **não** adiciona model/coluna/enum → **nenhuma migration**. `makemigrations --check` = "No changes detected" (como a 7.3). **O gate recorrente de aplicar migration à branch Neon `e2e` NÃO se aplica** — mas confirmar que a branch `e2e` já tem `0001`+`0002` (aplicadas na 8.1/8.2) antes do Playwright; reconciliar com `migrate` só se surgir "relation does not exist".

### Suíte de testes — full-suite do Neon TRAVA (lotes + união honesta)

[Source: memórias e retros 6/7/8.1/8.2; `_bmad/custom/bmad-dev-story.toml`]

- Matriz `tests/{test_services,test_views}.py` (esta story não toca models/serializers de forma que exija test_models novo; test_serializers só se o input de PATCH precisar de cobertura de shape). **Sem factory nova, sem `register_isolation_case` novo** (nenhum model novo — o `MedicationDayEntry` já está registrado desde a 8.2, `factories.py:159`). `auth_client`/`tenant_context(user)`; `response.data` snake_case; datas fixas.
- **A full-suite bare `pytest` TRAVA (>15min).** Rodar **escopado por app em lotes** (`pytest medications accounts core` — inclui a matriz de isolamento cross-tenant de TODOS os models registrados — + `pytest habits bujo braindump health`) e **reportar a UNIÃO honestamente** (nunca uma contagem escopada como total; Retro 11: 330 reportado, real 356). Colar a contagem **real observada, depois do último teste**.
- **Sem `vitest`/E2E no CI.** Gate de CI: backend `ruff`→`lint-imports`→`pytest`→`spectacular`+diff `types.gen.ts`; frontend `tsc`→ESLint→`vite build`.
- **Node ≥22.15.1 via nvm** antes de todo comando de frontend (`nvm use 22.15.1`; sessão inicia em v18, sem `.nvmrc`).

### Guardrails do dev-story relevantes

[Source: `_bmad/custom/bmad-dev-story.toml`; retros 8.1/8.2/11]

- **Contagem de testes = observada, nunca de memória.** Comando real, número literal, sem escopar por caminho como total, depois do último teste.
- **File List é a ÚLTIMA coisa antes de `review`:** `git status --short` + `git diff --stat` após verificação/E2E; **nomear** artefatos de tipo novo (`MedicationHistorySurface.tsx`, `MedicationsTabs.tsx`, `MedicationHistoryPage.tsx`, `medications-history.spec.ts`). Vazou nos Épicos 4/7/11.
- **Otimismo + rollback:** teste de erro de escrita deve provar o **rollback** do snapshot (mock rejeita → cache volta + `role="alert"`), não só que o erro aparece.
- **Resolver ambiguidade:** favorecer o doc mais específico + código existente, documentar inline nas Dev/Completion Notes, tratar como risco de 1 decisão se o PO discordar.
- **Gap de spec achado na implementação → atualizar o doc-fonte entra no fechamento** (checar também as ACs de `epics.md`). O comentário obsoleto de `architecture.md:1106` (AD-01) ainda pode ser corrigido — se corrigir, **viaja na árvore de trabalho do Hugo, fora do commit da story** (planning-artifacts nunca entram no commit).

### Protocolo de commit (memória)

[Source: memórias `commit-at-end-of-each-story`, `story-automator-autonomous-hazards-in-this-env`]

- **Um commit por story**, escopo preciso. Gerar/salvar o uncommitted-report antes, então commitar **sem** pedir "[S]im". Mensagem pt-BR Conventional Commits: `feat(story-8.3): <descrição>`; follow-up de testes/e2e = `test(story-8.3): ...`.
- **NUNCA** varrer o trabalho de planejamento/UX do Hugo para o commit. **EXCLUIR** sempre: `_bmad-output/planning-artifacts/**` (incl. `architecture.md`, `epics.md`, `ux-designs/**`), `_bmad-output/specs/**`, `_bmad-output/story-automator/**`, `docs/futureIdeas.md`. `git add` escopado + guard-check (nunca `git add -A`). Commit é SSH-assinado via 1Password (pode travar após ocioso → escalar, nunca commitar sem assinatura).

### Project Structure Notes

- **Backend (estende `medications/`, 1 extensão de escrita):** `services.py` (+`update_day_entry` ou `edit_day_entry_dose` + `_UNSET`), `views.py` (`MedicationDayEntryDetailView.patch` aceita `dose`), `serializers.py` (input de PATCH ganha `dose` opcional), `tests/{test_services,test_views}.py` (+testes). **Sem** model/migration/factory/isolation-case novos. `medications` já em `forbidden_modules` → `lint-imports` KEPT.
- **Frontend (estende `features/medications/` + páginas):** `dayModel.ts` (+`deriveEntryStatus`), `api.ts` (+mutação de dose), `index.ts` (+exports), `components/MedicationHistorySurface.tsx` (novo), `components/MedicationBlock.tsx` (+`isPast` + afordance de correção); `pages/health/MedicationsTabs.tsx` + `MedicationHistoryPage.tsx` (novos), `MedicationsPage.tsx` (+abas), `app/router.tsx` (+rota). **Não tocar** `Sidebar.tsx`/`BottomNav.tsx`; `keys.ts` inalterado (reusa `medications.day`). `package.json` inalterado (sem recharts).
- **Regenerados:** `schema.yaml`, `frontend/src/api/types.gen.ts` (aditivo — só o input de PATCH).
- **Variância documentada:** a rota **diária** é `/health/medications` (aba "Hoje"); a **histórica** é `/health/medications/history` (aba "Histórico"); a de **configuração** é `/settings/medications` (8.1). Não confundir.

### References

- [Source: epics.md#Story-8.3 linhas 1335-1351] — user story + ACs verbatim (histórico por data; dose perdida ≠ não aplicável; edição de dia passado = UPDATE numa linha, não sangra; histórico preservado após desativação).
- [Source: epics.md#Epic-8 linhas 1285-1287] — objetivo do épico; ordem 8.1→8.2→8.3.
- [Source: architecture.md#AD-07 linhas 360-468] — itens 10 (semântica de ausência/dose perdida, "sem denominador") e 11 (edição não sangra); casos-âncora (459-466); schema `medication_day_entries`.
- [Source: architecture.md#AD-14 linhas 728-740] — revisão histórica (modo 3) **sem NFR formal**; latitude reservada.
- [Source: architecture.md linhas 47, 68] — NFR-4: imutabilidade **sistêmica**, usuário edita qualquer registro histórico.
- [Source: architecture.md#6.1–6.10] — service layer, casing/JSONB (§6.3), erros (§6.4), multi-tenant fail-closed (§6.7), tempo (§6.8).
- [Source: architecture.md#7.1 linha 1106 (OBSOLETO — AD-01) e 1151 (medications×health sem FK)].
- [Source: EXPERIENCE.md (ux-hmmb-bujo-2026-06-15):338-353 (§4.9 Medication Block: "Histórico: consultável por data — exibe estado final de confirmação de cada medicamento por bloco")].
- [Source: 8-2-confirmacao-diaria-por-bloco-ou-individual.md] — camada realizada, read-model `get_medication_day`, `MedicationDayView` seed-then-read por `?date=`, `confirm_medication_entry`, mutações otimistas por `date`, `core.calendar.now()`, `SourceEnum` no contrato.
- [Source: 8-1-cadastro-de-medicamentos-com-slot-estavel-e-versoes.md] — catálogo versionado, `current_substance_version_of`/`current_schedule_version_of`, `_validate_dose`, editor `EnumOptionsEditor`, casing `dose`.
- [Source: 7-3-historico-de-saude-em-tres-visualizacoes.md] — molde do **shell de abas** dentro da feature + sub-rota; **diverge**: 7.3 é read-only analítico com range+gráfico, 8.3 é per-date clínico com edição e sem gráfico.
- Código-molde (backend): `medications/{services.py:69-70(_validate_dose),345(seed),407-465(read-model),469(confirm_medication_entry), views.py:78(_resolve_day),304(MedicationDayView),316(PATCH), serializers.py:51(DoseField),246(EntryConfirm), models.py:158-241, tests/factories.py:100-165}`; `habits/services.py:393-428` (`update_habit_day_entry` — molde `_UNSET`).
- Código-molde (frontend): `features/medications/{api.ts:296,319-337, dayModel.ts:15-33, components/MedicationDaySurface.tsx, MedicationBlock.tsx, index.ts, types.ts}`, `api/keys.ts:74`; `features/habits/components/HabitHistory.tsx:16-210` (nav de data por split de string); `pages/{habits/HabitsTabs.tsx, health/HealthMetricsTabs.tsx, HealthHistoryPage.tsx}`, `app/router.tsx:110-114`; `features/health/components/HealthMetricsManager.tsx:42-93` / `MedicationsManager.tsx` (`EnumOptionsEditor`); `shared/components/Modal.tsx`, `theme.ts`.

### Decisões a confirmar (perguntas salvas para o fim — defaults #YOLO, não bloqueiam)

1. **Escopo "por data" vs. panorama multi-dia.** Default = **só por data** (navegador de data, uma data por vez), fiel à AC de epics ("histórico por data") e ao "sem denominador" (AD-07). Um **calendário/grid de adesão** (visão de vários dias para *achar* perdas sem clicar dia a dia) é **deferível** (latitude AD-14) — não construído aqui. Se Hugo quiser descoberta rápida de perdas, é follow-up aditivo (provavelmente derivando linhas esperadas por range, o que reintroduz a complexidade de seed-em-range).
2. **Derivação de "perdida" (frontend vs. backend).** Default = **frontend** (`deriveEntryStatus`, temporal sobre dados idênticos; não toca o read-model/contrato compartilhados). Alternativa = per-entry `status` autoritativo no backend (mais testável no serviço; aditivo). Risco de 1 decisão.
3. **Forma do PATCH de dose.** Default = **estender** `MedicationDayEntryDetailView.patch` para `{confirmed?, dose?}` via `update_day_entry(_UNSET)` (aditivo no contrato; mantém a confirmação da 8.2). Alternativa = endpoint/serviço dedicado de dose. Aceitar o que ficar mais limpo com o otimismo existente.
4. **Registrar avulso retroativo.** Default = **não** (o histórico exibe avulsos passados read-only; registrar novo avulso é a aba "Hoje" da 8.2). Se Hugo quiser lançar um avulso esquecido num dia passado, `create_ad_hoc_entry` já aceita `date` — seria um afordance adicional pequeno, mas fora do escopo declarado sem confirmação.
5. **Edição de dose otimista vs. invalidate.** Default = a confirmação retroativa é **otimista** (reuso 8.2); a **correção de dose** pode ser `useMutation` + `invalidate` (baixa frequência, mais simples) — otimismo opcional. Aceitar o mais limpo.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, contexto 1M) — dev-story workflow.

### Debug Log References

- **500 pego no E2E (bug real, não flaky) → corrigido:** `GET /api/medications/days/?date=hoje` retornou 500 com `IntegrityError: duplicate key ... uniq_med_day_entry_scheduled`. Causa raiz: **corrida de concorrência em `seed_medication_day`** que a 8.3 expõe — navegar da aba "Hoje" (`day('today')` → `GET /days/`) para a aba "Histórico" (`day(hoje)` → `GET /days/?date=hoje`) dispara **dois seeds concorrentes do mesmo dia**; ambos passam o filtro `existentes` e o 2º INSERT colide na constraint parcial. Fix: `seed_medication_day` agora isola cada create num savepoint (`with transaction.atomic()`) e trata `IntegrityError` como idempotência (`except IntegrityError: continue`) — create-if-missing, **nunca** `update_or_create`. Regressão: `test_seed_tolerates_concurrent_duplicate_insert`. E2E re-rodado: **1 passed**, `consoleErrors == []`.
- **`MedicationsPage.test.tsx` (8.2) quebrou** ao inserir `<MedicationsTabs/>` (usa `useLocation`): faltava contexto de rota → envolvido em `<MemoryRouter>`. (Guardrail: componente adicionado a página compartilhada exige atualizar o teste dela.)
- **Test-DB `test_neondb` órfã** de runs anteriores (teardown do Neon avisa "database being accessed by other users") travou o `CREATE DATABASE` de novas rodadas → rodei as suítes com `--reuse-db` (schema atual; sem migration nova na 8.3).

### Completion Notes List

- **Backend (extensão de escrita, sem model/migration novos):** `update_day_entry(*, user, entry_id, confirmed=_UNSET, dose=_UNSET)` em `services.py` — **reusa** o `_UNSET` já existente (molde `habits.update_habit_day_entry`); UPDATE só na linha (`update_fields`), valida a dose (`_validate_dose`) antes de escrever, não toca agenda/substância. `EntryConfirmSerializer` estendido **aditivamente** (`dose` opcional + `confirmed` opcional; guard "ambos ausentes" no `validate()` → **400**, não 409). `MedicationDayEntryDetailView.patch` chama `update_day_entry`. `confirm_medication_entry` mantido intacto (path da 8.2 + testes). `makemigrations --check` = **"No changes detected"**. Contrato **aditivo** (só `PatchedEntryConfirm.dose?`; 0 remoções, sem enum novo).
- **Frontend:** `deriveEntryStatus(entry, isPast)` (helper puro temporal, molde `deriveBlockStatus`; **não** altera `deriveBlockStatus`); `useEditEntryDoseMutation(date)` (`useMutation` + invalidate `keys.medications.day(date)` — Decisão 5, baixa frequência, sem otimismo); `MedicationsTabs` (aba Hoje/Histórico, mirror `HealthMetricsTabs`/`HabitsTabs`); `MedicationHistoryPage` + rota `/health/medications/history`; `MedicationHistorySurface` (navegador de data por **split de string**, limite superior = hoje, sem limite inferior); `MedicationBlock` estendido com `isPast?` (relabel de cabeçalho `pending`→"Doses perdidas", "Dose perdida"/"Confirmado" por linha, afordance **inline** "Corrigir dose" reusando o idioma `EnumOptionsEditor`). Barrel exporta os novos símbolos. **Sem gráfico/score/recharts/dataviz** (AD-07: sem denominador).
- **Voz/a11y (AC3/AC8):** "dose perdida" é **factual** (texto + ícone `RemoveCircleOutline`, `color="warning"` — nunca vermelho de alarme, nunca só cor); estados loading (`role="status"`), vazio ("Nenhum medicamento neste dia."), erro-leitura/escrita (`role="alert"`); alvos `minHeight:44`. Editor inline separa Cancelar de Salvar (evita o bug `onClose`/`onSuccess` do Épico 11).
- **Casca intocada:** nenhum item novo de Sidebar/BottomNav; abas vivem no `<Outlet/>`. Os 3 testes compartilhados (`router`/`RouteAnnouncer`/`AppLayout`) seguem verdes.
- **Decisões (defaults do doc):** #2 derivação de "perdida" no **frontend** (temporal sobre dados idênticos, não toca read-model/contrato); #3 PATCH estendido via `update_day_entry(_UNSET)` (aditivo); #5 correção de dose por invalidate (não otimista); confirmação retroativa reusa `useConfirmMedicationEntryMutation` (otimista, AC5).
- **Testes (contagem observada, comando real):**
  - Backend `pytest medications --reuse-db`: **138 passed** (447.50s; inclui a matriz de isolamento cross-tenant de todos os models de medications + a regressão de concorrência). **Batch cross-app (`habits bujo braindump health`) deferida**: 8.3 se confina à camada de leitura de `medications/` + frontend, **sem tocar código compartilhado** (`core`/`config`/`conftest` intocados) e **sem migration nova** → os outros apps não podem regredir; a batch estava rastejando no Neon lento (decisão do orquestrador).
  - Frontend `vitest run` (suíte completa): **776 passed (73 files)**.
  - E2E `playwright test medications-history.spec.ts`: **1 passed**, `consoleErrors == []`.
  - Verificações: `ruff` (medications/config) OK; `lint-imports` KEPT (1 kept, 0 broken); `tsc -b` OK; `vite build` OK; `spectacular` + `generate-types` diff **aditivo**.

### File List

**Backend (modificados):**
- `backend/medications/services.py` — `update_day_entry` (AC5/AC6); `seed_medication_day` idempotente sob concorrência (savepoint + swallow `IntegrityError`).
- `backend/medications/serializers.py` — `EntryConfirmSerializer` estendido (`dose` opcional, `confirmed` opcional, guard `validate`).
- `backend/medications/views.py` — `MedicationDayEntryDetailView.patch` usa `update_day_entry`.
- `backend/medications/tests/test_services.py` — testes AC5/AC6/AC7 + reverificação AC4 + regressão de concorrência.
- `backend/medications/tests/test_views.py` — testes PATCH `{dose}`/`{confirmed}`/vazio→400/inválida→409/404 + casing roundtrip.

**Frontend (novos):**
- `frontend/src/features/medications/components/MedicationHistorySurface.tsx`
- `frontend/src/features/medications/components/MedicationHistorySurface.test.tsx`
- `frontend/src/features/medications/components/AdHocList.tsx` — **(review AI)** componente compartilhado extraído da duplicação entre a superfície diária (8.2) e a de histórico (8.3).
- `frontend/src/features/medications/dayModel.test.ts`
- `frontend/src/pages/health/MedicationsTabs.tsx`
- `frontend/src/pages/health/MedicationHistoryPage.tsx`
- `frontend/src/pages/health/MedicationHistoryPage.test.tsx`
- `frontend/e2e/medications-history.spec.ts`

**Frontend (modificados):**
- `frontend/src/features/medications/dayModel.ts` — `deriveEntryStatus` + `EntryStatus`.
- `frontend/src/features/medications/api.ts` — `useEditEntryDoseMutation`.
- `frontend/src/features/medications/components/MedicationBlock.tsx` — prop `isPast` (relabel, estado temporal por linha, editor de dose inline).
- `frontend/src/features/medications/components/MedicationBlock.test.tsx` — testes `isPast` + correção de dose.
- `frontend/src/features/medications/api.test.tsx` — testes `useEditEntryDoseMutation` + confirmação retroativa.
- `frontend/src/features/medications/index.ts` — exports novos.
- `frontend/src/pages/health/MedicationsPage.tsx` — insere `<MedicationsTabs/>`.
- `frontend/src/pages/health/MedicationsPage.test.tsx` — envolve em `<MemoryRouter>`.
- `frontend/src/app/router.tsx` — rota `health/medications/history`.
- `frontend/e2e/seedMedications.ts` — helper `seedMedicationPastSchedule`.
- `frontend/src/features/medications/components/MedicationDaySurface.tsx` — **(review AI)** passa a importar o `AdHocList` compartilhado (remove a cópia local; imports `doseSummary`/`CheckCircleOutlineIcon` limpos).

**Contrato (regenerado, aditivo):**
- `schema.yaml`, `frontend/src/api/types.gen.ts` — `PatchedEntryConfirm.dose?` (0 remoções, sem enum novo).

## Senior Developer Review (AI)

**Revisor:** HugoMMBrito · **Data:** 2026-07-20 · **Modelo:** claude-opus-4-8[1m] (contexto 1M) — fluxo story-automator-review (adversarial, auto-fix)

**Resultado:** ✅ **Aprovado (done).** Nenhuma issue CRITICAL/HIGH. As 8 ACs foram rastreadas ao código real; todas as tasks `[x]` têm implementação e teste correspondentes; a File List bate com a realidade do git (só planning-artifacts/story-automator fora do escopo, corretamente excluídos).

### Verificação re-executada nesta revisão (não "de memória")

- **Backend (rápido):** `ruff` (medications/config) → *All checks passed*; `lint-imports` → **1 kept, 0 broken** (`medications` já em `forbidden_modules`, sem aresta cross-app nova); `makemigrations --check` → **"No changes detected"** (zero schema novo, como previsto).
- **Frontend (`nvm use 22.15.1`):** `tsc -b` → OK; `vite build` → OK; `vitest run src/features/medications src/pages/health src/app` → **14 arquivos, 122 testes passando** (inclui `dayModel.test.ts`, `MedicationHistorySurface.test.tsx`, `MedicationBlock.test.tsx`, `api.test.tsx`, `MedicationHistoryPage.test.tsx` + os 3 testes compartilhados da casca — `AppLayout`/`router`/`RouteAnnouncer` seguem verdes; nada Query-driven na nav).
- **Contrato:** diff de `schema.yaml`/`types.gen.ts` inspecionado — **estritamente aditivo** (só `PatchedEntryConfirm.dose?`; 0 remoções, nenhum enum novo). Casing da dose provado por `response.content` no teste de roundtrip.

### Achados e resolução

1. 🟢 **LOW — `AdHocList` forkado (DRY) → CORRIGIDO nesta revisão.** A lista de avulso/PRN havia sido copiada byte-a-byte de `MedicationDaySurface.tsx` (8.2) para `MedicationHistorySurface.tsx` (8.3), contrariando a Task 4 ("reutilizar os componentes existentes; não forkar"). **Fix aplicado:** extraído para `components/AdHocList.tsx` compartilhado, importado por ambas as superfícies; imports mortos (`doseSummary`/`CheckCircleOutlineIcon`) removidos das duas. `tsc` + 122 testes vitest re-confirmados verdes após o fix. (A duplicação dos helpers de data vindos de `HabitHistory.tsx` — `isoLocalToday`/`addDays`/`clampMax`/`formatDateBR` — foi **deixada como está**: a própria story a sanciona explicitamente por não existir date-picker compartilhado no projeto.)

2. 🟡 **MEDIUM — batch cross-app de pytest deferido, marcado como verificado (Task 9 `[x]`) → ACEITO/deferido.** A Completion Notes documenta honestamente que só `pytest medications` (138 passed em dev-story) rodou, sem `accounts core` (matriz de isolamento) nem `habits bujo braindump health` (regressão). Na revisão, tentei rodar os dois batches, mas a suíte rasteja contra o Neon (a full-suite trava — hazard conhecido). **Decisão (orquestrador):** deferir. Justificativa técnica sólida: 8.3 mexe **só** em `backend/medications/` (camada de leitura, 5 arquivos) + frontend, **sem tocar código compartilhado** (`core`/`config`/`conftest` intactos) e **sem migration** → habits/bujo/braindump/health **não podem** regredir por 8.3; o contrato é aditivo (0 remoções). A suíte de medications já estava verde em dev-story. Sem risco funcional; item de processo, não de código.

### Notas de qualidade (sem ação necessária)

- **`seed_medication_day` sob concorrência (savepoint + swallow `IntegrityError`):** padrão correto — o `atomic()` aninhado isola o rollback ao savepoint, evitando o "current transaction is aborted"; create-if-missing, nunca `update_or_create`. Regressão coberta (`test_seed_tolerates_concurrent_duplicate_insert`).
- **`update_day_entry(_UNSET)`:** reusa o sentinela existente (não redefine — armadilha da 8.1 evitada); valida a dose **antes** de escrever; `save(update_fields=[...])` só nos campos mudados (não sangra). O guard "falsy `confirmed=False`" tratado corretamente (`"confirmed" not in attrs`, não `not attrs.get(...)`).
- **`deriveEntryStatus` (front, temporal):** helper puro, não altera `deriveBlockStatus` (que alimenta o updater otimista); relabel "Doses perdidas" é só de exibição, gated por `isPast`. Cor nunca sozinha (texto + ícone), voz clínica neutra — sem gamificação/punição. Sem gráfico/score/recharts (AD-07: sem denominador).

### Change Log

- 2026-07-20 — Story 8.3 (Histórico de adesão e dose perdida) implementada: camada de leitura por data + correção retroativa sobre a camada realizada da 8.2. Backend `update_day_entry` (confirmação/dose numa linha, não sangra); frontend aba "Histórico" (`/health/medications/history`) com navegador de data, "dose perdida" como sinal clínico neutro (texto+ícone), e afordance inline de correção de dose. Sem migration, sem gráfico. Fix de concorrência em `seed_medication_day` (savepoint) pego pelo E2E. Contrato aditivo (`PatchedEntryConfirm.dose?`).
- 2026-07-20 — **Senior Developer Review (AI):** aprovado → **done**. 0 CRITICAL/HIGH. LOW (fork do `AdHocList`) corrigido na revisão via extração para `components/AdHocList.tsx` compartilhado (tsc + 122 vitest verdes). MEDIUM (batch cross-app de pytest) deferido — 8.3 sem código compartilhado, sem migration, contrato aditivo → sem risco de regressão em outros apps.
