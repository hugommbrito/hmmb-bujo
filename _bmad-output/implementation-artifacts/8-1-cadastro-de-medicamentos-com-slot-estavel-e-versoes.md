---
baseline_commit: 510897b638bab898d3d21d5f4d53ba1914b8896f
---

# Story 8.1: Cadastro de medicamentos com slot estável e versões

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero cadastrar medicamentos como **slots estáveis** cuja substância, laboratório, médico e dose por bloco **variam no tempo**, gerenciados na tela Configurações > Medicamentos,
Para que meu histórico de adesão continue contínuo mesmo quando o médico troca o remédio ou a dose (FR-3.4, FR-3.5, FR-3.7, AR-18/AD-07).

**Primeira story do Épico 8 (Medicamentos).** É a fundação de modelagem do domínio: cria o app `medications/` do backend **do zero** e a feature `features/medications/` do frontend **do zero**, mais a tela **Configurações > Medicamentos**. Estabelece o **catálogo versionado** (`medications` slot + `medication_substance_versions` + `medication_schedule_versions` + `time_blocks` + `doctors`) que é a **fonte de verdade prospectiva** consumida pela Story 8.2 (materializa `medication_day_entries` com `dose_at_time` semeada da versão vigente) e pela Story 8.3 (histórico de adesão + dose perdida). Ordem interna do épico: **cadastro/versões (8.1) → confirmação diária (8.2) → histórico/dose perdida (8.3)**.

> **🧭 Divergência-chave — Medicamentos VERSIONA; reuse o molde de Hábitos (Épico 6), NÃO o de Saúde (Épico 7).** Saúde é uma tabela **plana e não-versionada** (`health_field_definitions`) porque não há denominador histórico. Medicamentos é o **oposto**: dose/substância/ativo alimentam um snapshot congelado por dia (AD-07 espelha AD-06). O estado de `(medicamento, bloco)` no dia D = a versão com `max(effective_from) <= D`. **Porte os padrões de `habits/` — `HabitVersion` (effective-dating, `active` na versão, `UniqueConstraint(parent, effective_from)`, `update_or_create` para "mesma mudança no mesmo dia = UPDATE"), `current_version_of(x, on_date)`, e a divisão identidade-vs-versão** ([Source: architecture.md#AD-07 linhas 360-468; AD-06 linhas 296-336]). **NÃO** copie a chatura plana de `health_field_definitions` para as tabelas de versão.

> **⚠️ O comentário da árvore de código está DESATUALIZADO.** `architecture.md:1106` diz `medications (medications, medication_blocks, medication_logs)` — esse é o esboço **AD-01 SUPERSEDIDO**. A AD-07 (linha 468) o descarta explicitamente: "substitui a porção de medicamentos da AD-01 (`medication_blocks` com `block ENUM` e `medication_logs` deixam de existir nessa forma)". **Siga o schema da AD-07 (abaixo), nunca o comentário da árvore.** Se fechar a story, corrija o comentário de `architecture.md:1106` na árvore de trabalho do Hugo (fora do commit da story — ver "Protocolo de commit").

## Acceptance Criteria

### AC1 — Cadastrar medicamento: slot estável + versão de substância vigente (FR-3.4, AD-07)

**Dado que** estou na tela Configurações > Medicamentos,
**Quando** cadastro um medicamento,
**Então** `medications.title` grava o **slot estável** ("Remédio de pressão") — **sem coluna `active`** (o ativo/inativo vive nas versões, AC5) — e `medication_substance_versions` grava o **produto vigente** (`substance_name`, `laboratory` opcional, `prescribed_by` → `doctors` opcional) com `effective_from = today_for(user)`,
**E** tudo é **escopado por tenant** (`user_id` via `TenantModel`) e o `id` de `medications` é um **UUID estável** (será a chave-âncora de `medication_day_entries` na Story 8.2).

### AC2 — Blocos de horário dinâmicos por usuário, sem ENUM e sem migração (FR-3.4, AD-07)

**Dado que** o usuário organiza seus horários,
**Quando** cria/edita um bloco,
**Então** `time_blocks` grava `name`, `display_order` e `active` — **dinâmico por usuário, SEM ENUM** — e novos blocos ("antes do almoço") são criados **sem migração de schema**,
**E** o bloco só **agrupa e ordena** (papel não-analítico, não-restritivo); desativar (`active=false`) esconde sem apagar, preservando referências históricas de versões de agenda.

### AC3 — Agenda de doses por (medicamento, bloco) com dose JSONB validada no serviço (FR-3.5, AD-07)

**Dado que** defino a agenda de doses de um medicamento,
**Quando** informo a dose de um bloco,
**Então** `medication_schedule_versions` grava, por `(medicamento, bloco)`, a `dose` como **JSONB multi-componente** `[{label, amount, unit}]` (número de componentes livre — cobre remédio com >1 droga), `active` e `effective_from = today_for(user)`,
**E** cada componente é **validado na camada de serviço**: `amount` **numérico** (rejeitar `bool`, que em Python é subclasse de `int`), `unit` string **não-vazia**, `label` string; a lista de dose deve ser **não-vazia**,
**E** doses diferentes em blocos diferentes são naturalmente representáveis (uma versão de agenda por `(medicamento, bloco)`).

### AC4 — Dois eixos de versão independentes, prospectivos (FR-3.5, AD-07)

**Dado que** algo muda no tempo,
**Quando** aplico a mudança,
**Então** **trocar só a dose** insere **nova `medication_schedule_versions`** (eixo agenda) e **trocar a substância/laboratório/médico** insere **nova `medication_substance_versions`** (eixo substância) — **eixos independentes** ("só a dose" toca a agenda; "só o laboratório" toca a substância; "o remédio inteiro" toca os dois),
**E** toda inserção de versão é **prospectiva** (`effective_from = today_for(user)`); uma segunda mudança no **mesmo dia** é **UPDATE** da versão daquele dia (via `UniqueConstraint` + `update_or_create`), não uma nova linha; campos não informados são **herdados** da versão vigente.

### AC5 — Desativação vive nas versões; histórico preservado; nada retroage (FR-3.7, NFR-4, AD-07)

**Dado que** existe uma agenda ativa,
**Quando** a desativo,
**Então** o ativo/inativo é gravado como **nova versão de agenda com `active=false`** (prospectivo) — **nunca** uma coluna `active` em `medications` e **nunca** um `.delete()` físico — e todo o histórico é preservado,
**E** como toda mudança é datada por `effective_from`, **dias passados mantêm o valor congelado** (garantia estrutural para a materialização da 8.2; nenhuma linha de dia é criada nesta story).

### AC6 — Médicos como catálogo referenciável (FR-3.4, AD-07 item 6)

**Dado que** um medicamento é receitado por um médico,
**Quando** cadastro/associo o médico,
**Então** `doctors` (`name`, `specialty` opcional) é um catálogo por tenant, e `medication_substance_versions.prescribed_by` referencia-o (`on_delete=PROTECT` — preserva histórico),
**E** o médico pode ser criado a partir da tela de Medicamentos e reutilizado entre medicamentos.

### AC7 — Tela Configurações > Medicamentos: lista + criar/editar com efeitos prospectivos explícitos (FR-3.4, FR-3.7, UX-DR13/UX-DR17)

**Dado que** navego por Configurações,
**Quando** abro **Medicamentos** (rota `/settings/medications`, alcançada pelo hub de Configurações),
**Então** vejo a lista de medicamentos (Item Row: título + substância/dose/blocos vigentes + ações Editar/Desativar) e formulários inline para criar/editar medicamento, agenda por bloco, blocos de horário e médicos,
**E** os formulários **explicam o efeito prospectivo** ("Alteração válida a partir de hoje. Registros anteriores preservados."), **preferem Desativar a Excluir**, e cobrem os estados de **carregando (skeleton) / vazio / erro de leitura (retry) / erro de escrita (input preservado)** — voz pt-BR neutra, zero gamificação, WCAG 2.2 AA (indicador nunca só por cor; alvos ≥44px; erros `role="alert"`, confirmações `role="status"`).

## Escopo — o que NÃO entra nesta story (limites explícitos)

Para impedir que o dev construa o épico inteiro de uma vez, estes itens são de stories posteriores e **não devem** ser construídos aqui:

- ❌ **`medication_day_entries` / materialização ansiosa idempotente / `dose_at_time` congelado / `source = scheduled | ad_hoc` / confirmação por bloco (escrita em lote) ou individual / status "confirmado/parcial" derivado** → **Story 8.2**. As tabelas de 8.1 devem ser *projetadas* para semear a 8.2 (o `id` UUID de `medications` + `current_*_version_of(...)` são o contrato futuro), mas **nenhuma linha de `medication_day_entries` é criada/lida aqui**.
- ❌ **Medication Block (UX-DR11): cabeçalho de bloco na superfície diária, "Confirmar todos da manhã", checkbox individual, estados pendente/parcial/confirmado** → **Story 8.2** ([Source: epics.md:163, 247]). Isso é a superfície **diária**, não a de configuração.
- ❌ **`source` ENUM (`scheduled`/`ad_hoc`) + `TextChoices` + `CheckConstraint` + `ENUM_NAME_OVERRIDES["SourceEnum"]`** → **Story 8.2**. **8.1 provavelmente NÃO tem nenhum campo enum** (blocos são dinâmicos, sem ENUM; `source` é 8.2) — logo, provavelmente **nenhuma** adição a `ENUM_NAME_OVERRIDES`. Confirme antes de adicionar.
- ❌ **Histórico de adesão por data / "dose perdida" (sinal clínico) / edição avulsa de dia passado (`UPDATE` numa linha de `medication_day_entries`)** → **Story 8.3** ([Source: epics.md:1335-1351]).
- ❌ **Substituir o placeholder de 1º nível `/health/medications` ou mexer no Sidebar/BottomNav "Saúde › Medicamentos"** → aquela superfície é a **confirmação diária** da Story 8.2 (`Sidebar.tsx:62-65`, `router.tsx:108-112`). 8.1 vive em **`/settings/medications`**, alcançada via a página Configurações. **Nada Query-driven é adicionado à nav** (protege os 3 testes compartilhados — ver Dev Notes).
- ❌ **Qualquer FK entre `medications` e `health`** → domínios independentes, sem FK ([Source: architecture.md#7.1 linha 1151]).
- ❌ **Cast JSONB analítico da dose (`(dose->0->>'amount')::numeric`) / gráficos / `recharts`** → análise futura preservada pelo schema, **não construída no MVP** ([Source: architecture.md#AD-07 linha 385]).
- ❌ **`date.today()`/`timezone.now()` cru** em qualquer lugar (produção **ou** factories) → sempre `today_for(user)` no serviço (guardrail de AST no CI).

**Deferível/opcional (espelha 6.1/7.1):** `display_order` **entra no schema** de `time_blocks` (append sequencial na criação), mas **UI de reordenação (drag/subir-descer) é opcional/deferível** na primeira fatia. Ver "Decisões a confirmar".

## Tasks / Subtasks

- [x] **Task 1 — Criar o app Django `medications/` e os models (AC1–AC6)**
  - [x] Criar `backend/medications/` espelhando o esqueleto de `backend/habits/` (`__init__.py`, `apps.py` [`MedicationsConfig`, `default_auto_field="django.db.models.BigAutoField"`, `name="medications"`], `models.py`, `serializers.py`, `services.py`, `views.py`, `urls.py`, `admin.py`, `migrations/__init__.py`, `tests/`). Ver Dev Notes › "Esqueleto do app".
  - [x] Registrar `"medications"` no fim do bloco `# Local` de `INSTALLED_APPS` em `backend/config/settings/base.py` (após `"health"`).
  - [x] **Todos os models herdam `core.models.TenantModel`** (UUID PK `id` + `user_id UUIDField(db_index=True)` + `objects=TenantManager()` auto-escopado fail-closed + `all_objects`). **Nunca redeclare `id`/`user_id`.** `TenantModel` **não** fornece timestamps → adicione `created_at = DateTimeField(auto_now_add=True)` onde fizer sentido.
  - [x] `Doctor(TenantModel)`: `name` (CharField), `specialty` (CharField NULL/blank), `created_at`. `Meta.db_table="doctors"`, `ordering=["name"]`. (Catálogo plano estilo `HabitGroup` — **sem** coluna `active`; AD-07 não a especifica.)
  - [x] `TimeBlock(TenantModel)`: `name` (CharField), `display_order` (PositiveIntegerField, default 0), `active` (BooleanField, default `True`), `created_at`. `Meta.db_table="time_blocks"`, `ordering=["display_order", "name"]`. **Sem ENUM, sem CheckConstraint** (é dinâmico).
  - [x] `Medication(TenantModel)`: `title` (CharField), `created_at`. `Meta.db_table="medications"`, `ordering=["title"]`. **SEM coluna `active`** (AC5).
  - [x] `MedicationSubstanceVersion(TenantModel)`: `medication` (FK→Medication, `on_delete=CASCADE`, `related_name="substance_versions"`), `substance_name` (CharField), `laboratory` (CharField NULL/blank), `prescribed_by` (FK→Doctor, `on_delete=PROTECT`, NULL/blank), `effective_from` (DateField), `created_at`. `Meta.db_table="medication_substance_versions"`, `ordering=["medication","-effective_from","-created_at"]`, `constraints=[UniqueConstraint(fields=["medication","effective_from"], name="uniq_substance_version_per_day")]`.
  - [x] `MedicationScheduleVersion(TenantModel)`: `medication` (FK→Medication, `on_delete=CASCADE`, `related_name="schedule_versions"`), `time_block` (FK→TimeBlock, `on_delete=PROTECT`, `related_name="schedule_versions"`), `dose` (JSONField, `default=list`, `blank=True`), `active` (BooleanField, default `True`), `effective_from` (DateField), `created_at`. `Meta.db_table="medication_schedule_versions"`, `ordering=["medication","time_block","-effective_from","-created_at"]`, `constraints=[UniqueConstraint(fields=["medication","time_block","effective_from"], name="uniq_schedule_version_per_day")]`.
  - [x] `makemigrations medications --name initial` — **uma** migration (`0001_initial`). Confirme `makemigrations --check` limpo depois.
- [x] **Task 2 — Camada de serviço (AC1–AC6)** — `medications/services.py`, funções de módulo (nunca classes), `user` primeiro kwarg keyword-only, `@transaction.atomic` em toda escrita, só exceções de `core/exceptions.py`.
  - [x] `create_doctor(*, user, name, specialty=None) -> Doctor`; `list_doctors(*, user)`; `update_doctor(*, user, doctor_id, **fields)` (name/specialty).
  - [x] `create_time_block(*, user, name, display_order=None) -> TimeBlock` (append: se `display_order` None, `max(display_order)+1` do tenant — padrão `health/services.py:77-79`); `update_time_block(*, user, time_block_id, **fields)` (name/display_order/active — desativar/reativar via `active`); `list_time_blocks(*, user, include_inactive=False)`.
  - [x] `create_medication(*, user, title, substance_name, laboratory=None, prescribed_by_id=None) -> Medication` (`@transaction.atomic`): cria `Medication` **+** primeira `MedicationSubstanceVersion` com `effective_from = today_for(user)` **na mesma transação** (molde "criar Habit + primeira HabitVersion"). Valida `prescribed_by_id` pertence ao tenant (`Doctor.objects.get(...)` auto-escopado; `DoesNotExist` → `DomainError`/404).
  - [x] `add_substance_version(*, user, medication_id, substance_name=None, laboratory=None, prescribed_by_id=None) -> MedicationSubstanceVersion`: `effective_from = today_for(user)`; `update_or_create(medication=..., effective_from=today, defaults={...})`; **herda** campos não informados da versão vigente (helper `_inherit`, molde `habits/services.py:166-173`).
  - [x] `set_schedule(*, user, medication_id, time_block_id, dose, active=True) -> MedicationScheduleVersion`: **valida `dose`** via `_validate_dose` (ver abaixo) **antes** de escrever; `effective_from = today_for(user)`; `update_or_create(medication=..., time_block=..., effective_from=today, defaults={"dose":..., "active":...})`. **Desativar agenda** = `set_schedule(..., active=False)` (nova versão prospectiva; nunca delete).
  - [x] `_validate_dose(dose)`: `dose` deve ser **lista não-vazia**; cada item um dict com `label` (str), `amount` (numérico — `isinstance(v,(int,float)) and not isinstance(v,bool)`), `unit` (str não-vazia após `strip`). Qualquer violação → `DomainError` (molde `health/services.py:123-166` `_validate_value`; "validar tudo antes de escrever" molde `upsert_health_log`). Ver "Decisões a confirmar" sobre `label` vazio.
  - [x] Helpers de leitura vigente (consumidos pela tela e pela 8.2): `current_substance_version_of(medication, on_date)` e `current_schedule_version_of(medication, time_block, on_date)` = `.filter(effective_from__lte=on_date).order_by("-effective_from").first()` (molde `habits/services.py:37-46`).
  - [x] `list_medications(*, user, on_date=None)`: `on_date` default `today_for(user)`; retorna medicamentos com a substância vigente + agendas vigentes por bloco ativo, para a tela renderizar "estado de hoje".
- [x] **Task 3 — API DRF + contrato (AC1–AC7)** — views finas `APIView` (o codebase **não** usa ViewSet/router) com `@extend_schema`; serializers split leitura/escrita; `<uuid:pk>`.
  - [x] Endpoints (ver Dev Notes › "URLs — sem colisão"): `/api/medications/` (GET lista `?onDate=`, POST criar), `/api/medications/{id}/` (GET detalhe, PATCH `title`), `/api/medications/{id}/substance-versions/` (POST), `/api/medications/{id}/schedule-versions/` (POST — set/deactivate agenda de um bloco), `/api/doctors/` (GET, POST) + `/api/doctors/{id}/` (PATCH), `/api/time-blocks/` (GET `?includeInactive=`, POST) + `/api/time-blocks/{id}/` (PATCH).
  - [x] Serializers: `ModelSerializer` de saída com `fields` **explícito** (nunca `"__all__"`); `Serializer` plano de entrada com `validate()`. Para a **dose JSONB**, use o wrapper tipado por schema (`@extend_schema_field({"type":"array","items":{"type":"object","properties":{"label":{"type":"string"},"amount":{"type":"number"},"unit":{"type":"string"}}}})` sobre um `serializers.JSONField`) — molde `HealthValuesField` (`health/serializers.py:30-43`) — para o contrato TS sair usável.
  - [x] Wire em `backend/config/urls.py`: `path("api/medications/", include("medications.urls"))`, `path("api/doctors/", include("medications.urls_doctors"))`, `path("api/time-blocks/", include("medications.urls_time_blocks"))`. **Nenhuma colisão** com `/api/health/` (liveness) — confirmado.
  - [x] **Casing/JSONB — decisão explícita:** a `dose` usa **chaves estáticas de palavra única** (`label`/`amount`/`unit`); o `underscoreize`/`camelize` só reescreve chaves com underscore/fronteira de caso, então elas passam **intactas** — **NÃO adicione `"dose"` a `JSON_UNDERSCOREIZE.ignore_fields`** (`base.py:207-208`). Documente isso inline. (Contraste: `health_logs.values` é indexado por UUID e por isso está no `ignore_fields`.) Se algum dia surgir chave de dose multi-palavra, aí sim entra na tupla.
  - [x] Regenerar contrato: `uv run python manage.py spectacular --file ../schema.yaml` + (frontend) `npm run generate-types` → `schema.yaml` **e** `frontend/src/api/types.gen.ts`. Alvo: diff **puramente aditivo (0 remoções)**. Commitar **ambos**. CI faz o diff de `types.gen.ts` (gate).
- [x] **Task 4 — Feature frontend `features/medications/` (AC1–AC7)**
  - [x] Criar `frontend/src/features/medications/` espelhando `features/habits/`: `api.ts` (hooks), `types.ts` (`import type { components } from '../../api/types.gen'` → `Medication`, `MedicationSubstanceVersion`, `MedicationScheduleVersion`, `TimeBlock`, `Doctor`), `index.ts` (barrel — só api+hooks+types+components; feature nunca importa outra feature), `components/`.
  - [x] Adicionar seção `medications` em `frontend/src/api/keys.ts` (convenção `[escopo, entidade, discriminador, params?]`, **sem `userId`**): ex. `medications.list(params?)`, `medications.doctors()`, `medications.timeBlocks(params?)`.
  - [x] Hooks: queries `useMedicationsQuery`, `useDoctorsQuery`, `useTimeBlocksQuery`; mutações **config-CRUD sem otimismo** (`useMutation` + `invalidateQueries({ queryKey: ['medications'] })` por prefixo — molde `health/api.ts:33-90`). **Divisão identidade-vs-versão** (molde `habits/api.ts`): `title` = PATCH no recurso base; substância/agenda = **POST em sub-recurso `substance-versions/` / `schedule-versions/`** (`useAddHabitVersionMutation:154-176` é o precedente exato).
  - [x] `MedicationsManager.tsx` modelado em `HabitsManager.tsx` (versionamento + lista + cópia prospectiva) e `HealthMetricsManager.tsx` (linhas repetíveis): lista ordenada; form de criação (título + substância + laboratório + `Select` de médico + criar médico inline); editor de **dose multi-componente** e de **agenda por bloco** via o idioma repetível **`EnumOptionsEditor`** (`HealthMetricsManager.tsx:42-93` — add/remove de linhas de `TextField`); toggle **Desativar/Ativar** de agenda; sub-gerenciadores inline para **blocos de horário** e **médicos** (mesmo idioma de linha gerenciada). Tooltip prospectivo: `"Alteração válida a partir de hoje. Registros anteriores preservados."` (`HabitsManager.tsx:31-32`).
  - [x] Estados: skeleton (loading) / vazio / erro de leitura com retry / erro de escrita com input preservado (`SAVE_ERROR` inline `role="alert"`; confirmação `role="status"`). Inativo = opacidade 0.6 + texto "(inativo)" (nunca só cor). Formulários = **MUI controlado + `useState`** (o projeto **não** usa react-hook-form/Formik/zod).
- [x] **Task 5 — Rota e navegação (AC7)**
  - [x] Criar `frontend/src/pages/settings/MedicationsSettingsPage.tsx` (espelho de `HealthMetricsSettingsPage.tsx`, ~17 linhas): `<Box component="main" aria-label="Configurações — Medicamentos" sx={{p:3}}>` + `h5` título + `body2 text.secondary` explicando o efeito prospectivo + `<MedicationsManager/>` (importado do barrel).
  - [x] Adicionar rota `{ path: 'settings/medications', element: <MedicationsSettingsPage/>, handle: { title: 'Configurações — Medicamentos' } }` em `frontend/src/app/router.tsx` (irmã de `settings/health-metrics`, ~`:144`). `routeDefinitions` é exportado e consumido por `router.test.tsx` — atualize o teste se ele enumerar rotas.
  - [x] Adicionar `<ListItem>`/`<Link component={RouterLink} to="/settings/medications">Medicamentos</Link>` em `frontend/src/pages/settings/SettingsPage.tsx` (hub; `minHeight:44`).
  - [x] **NÃO** tocar no placeholder `/health/medications` nem no Sidebar/BottomNav. **Nada** Query-driven na nav.
- [x] **Task 6 — Testes backend (todas as ACs)** — matriz fixa `tests/{test_models,test_serializers,test_services,test_views}.py` + `factories.py`.
  - [x] `medications/tests/factories.py`: uma factory por model (`DoctorFactory`, `TimeBlockFactory`, `MedicationFactory`, `MedicationSubstanceVersionFactory`, `MedicationScheduleVersionFactory`) no padrão `class Params: user = SubFactory(UserFactory)` + `user_id = SelfAttribute("user.id")`; datas = **constantes fixas + timedelta**, nunca `date.today()`. Chamar `register_isolation_case(...)` **para CADA um dos 5 models** (`TenantModel`).
  - [x] Adicionar `"medications.tests.factories"` a `_ISOLATION_TEST_MODULES` em `backend/conftest.py:19-26` (liga o contrato de isolamento parametrizado — cross-tenant 404 **e** fail-closed `TenantScopeViolation`).
  - [x] Cobrir: AC1 (criar med + versão de substância, `active` ausente em `medications`, UUID); AC2 (time_block dinâmico, append `display_order`, desativar/reativar); AC3 (dose JSONB válida grava; inválida → `DomainError`: lista vazia, `amount` não-numérico, `amount` bool, `unit` vazia); AC4 (nova dose = nova schedule version / mesmo dia = UPDATE via `UniqueConstraint`; nova substância = nova substance version; herança de campos); AC5 (desativar = versão `active=false`, nada deletado; versão passada intacta); AC6 (doctor referenciado, `prescribed_by` PROTECT); isolamento cross-tenant (404 via service+view) + fail-closed (contrato parametrizado). `CheckConstraint` N/A (sem enum nesta story).
- [x] **Task 7 — Testes frontend (todas as ACs)**
  - [x] `features/medications/api.test.tsx` + `components/MedicationsManager.test.tsx` espelhando os de health/habits: `vi.mock('../../../api/client')`, wrapper `QueryClientProvider` (`retry:false`), `jest-axe` sem violações. Assert de endpoint/payload **camelCase** (ex. POST `/api/medications/` com `{ title, substanceName, laboratory, prescribedById }`; POST `schedule-versions/` com `{ timeBlockId, dose:[{label,amount,unit}] }`), invalidação `['medications']`, editor repetível de dose (add/remove linhas), toggle ativo, empty/erro-leitura-retry, rótulo "(inativo)".
  - [x] **jsdom caveat:** `<input type="number">` — `userEvent.type/clear` não funcionam; usar `fireEvent.change(field, { target: { value } })` para o campo `amount` da dose.
- [x] **Task 8 — E2E (Playwright, contra a branch Neon `e2e`)**
  - [x] `frontend/e2e/medications.spec.ts` + `frontend/e2e/seedMedications.ts` (espelho de `seedHealthFields.ts`/`seedHabits.ts`: `execFileSync('uv',['run','python','manage.py','shell','-c', script], { env:{ DJANGO_SETTINGS_MODULE:'config.settings.e2e' } })` dentro de `tenant_context`, chamando os serviços de 8.1). Navegação via `page.goto('/settings')` → clicar link "Medicamentos" → assert URL `/settings/medications` + `main {name:'Configurações — Medicamentos'}` (molde `health-metrics.spec.ts:37-41`). Cobrir criar med + definir dose + reload persiste + desativar.
  - [x] **🔴 GATE OPERACIONAL — aplicar a migration à branch Neon `e2e` ANTES do Playwright:** `DJANGO_SETTINGS_MODULE=config.settings.e2e uv run python manage.py migrate` (de `backend/`). Bug recorrente (travou 7.2). Ver Dev Notes › "Migration na branch e2e".
- [x] **Task 9 — Verificação e contrato (todas as ACs)**
  - [x] Backend: `ruff` (medications/config/conftest), `lint-imports` (contrato "core não importa apps de domínio" — `medications` **já** está em `forbidden_modules`, `pyproject.toml:59`; nenhuma mudança), `pytest` (app `medications` + suíte — ver "Suíte de testes" para o padrão em lotes; **cole a contagem REAL observada, nunca de memória, e rode SEM escopar por caminho**), `spectacular` + diff `types.gen.ts` (aditivo).
  - [x] Frontend (`nvm use 22.15.1` **antes de cada comando**): `tsc`, ESLint, `vitest` (suíte completa — cole a contagem real **depois** do último teste), `vite build`.
  - [x] **File List reconciliada por último:** rodar `git status --short` + `git diff --stat` **depois** de E2E/verificação e listar explicitamente artefatos de **tipo novo** (`e2e/medications.spec.ts`, `e2e/seedMedications.ts`, novo app inteiro).

## Dev Notes

### Contexto de arquitetura — AD-07 (Modelo de Medicamentos) é a decisão-mãe

A story implementa **apenas a camada de cadastro/versões** da AD-07 (slot estável + blocos dinâmicos + agenda/substância versionadas). A camada realizada (`medication_day_entries`) e a semântica de ausência/dose perdida são 8.2/8.3. Texto literal âncora [Source: architecture.md#AD-07 linhas 360-468]:

> *"**`medications.title`** = o slot estável da rotina ('Remédio de pressão'). É o que ganha blocos, agenda e histórico contínuo de adesão — não quebra quando o médico troca a substância. **`medication_substance_versions`** = o produto que preenche o slot ao longo do tempo... Produto vigente no dia D = versão com `max(effective_from) <= D`."*

Dois eixos de versão **independentes** (item 4): dose muda por `(medicamento, bloco)` → `medication_schedule_versions`; substância/laboratório/médico mudam no nível do medicamento → `medication_substance_versions`. Dose = JSONB estruturado multi-componente (item 5), validado na camada de serviço (`amount` numérico, `unit` não-vazia). Médicos (item 6) via `prescribed_by` na versão de substância. **O `active` vive nas versões** (schema: `medications` não tem `active`; `medication_schedule_versions.active` sim).

**Schema canônico (AD-07, linhas 412-457)** — o dev deve reproduzir exatamente (traduzido para Django/`TenantModel` na Task 1):

```sql
doctors (id, user_id, name, specialty TEXT NULL)
time_blocks (id, user_id, name, display_order, active BOOLEAN)   -- dinâmico; só agrupa/ordena; sem papel analítico
medications (id, user_id, title TEXT)                            -- slot estável; SEM coluna active
medication_substance_versions (id, user_id, medication_id FK, substance_name TEXT, laboratory TEXT NULL,
                               prescribed_by FK→doctors NULL, effective_from DATE)   -- vigente em D = max(effective_from<=D)
medication_schedule_versions (id, user_id, medication_id FK, time_block_id FK, dose JSONB,
                              active BOOLEAN, effective_from DATE)                    -- estado de (med,bloco) em D = max(effective_from<=D)
```

Nota AD-07 (linha 456): a `UNIQUE (user_id, medication_id, time_block_id, date) WHERE source='scheduled'` é de **`medication_day_entries`** (8.2), **não** desta story. Para 8.1, os `UniqueConstraint` são sobre **`effective_from`** (não `date`): `(medication, effective_from)` para substância e `(medication, time_block, effective_from)` para agenda.

### Molde a copiar — `habits/` (versionamento), NÃO `health/` (plano)

`HabitVersion` [Source: architecture.md#AD-06 linhas 328-336; código `backend/habits/models.py:83-110`] é o gabarito direto de ambas as tabelas de versão:

- `active` e `effective_from` **na linha de versão** (não no pai).
- `UniqueConstraint(fields=[<pai>, effective_from], name="uniq_...")` → "segunda mudança no mesmo dia = UPDATE da versão do dia" via `update_or_create`.
- `Meta.ordering = ["<fk>", "-effective_from", "-created_at"]`.
- Serviço: `current_version_of(x, on_date)` = `.filter(effective_from__lte=on_date).order_by("-effective_from").first()`; `add_*_version` faz `update_or_create` + herda campos não informados da versão vigente.
- O multi-composto `HabitGroupDayMultiplier` (`habits/models.py:113-150`, `UniqueConstraint(fields=["group","day_type","effective_from"])`) é o análogo mais próximo do `(medication, time_block, effective_from)`.

O slot `medications.title` (identidade pura, estado versionado nos filhos) é análogo a `Habit` (identidade) + `HabitVersion` (config versionada). A divisão **identidade (PATCH base) vs. versão (POST sub-recurso)** já existe em `habits/api.ts` (`useUpdateHabitIdentityMutation` vs. `useAddHabitVersionMutation`).

### Esqueleto do app (backend) — o que criar

Todo app de domínio tem layout idêntico [Source: architecture.md#6.2; verificado em `backend/health/`, `backend/habits/`]:

```
backend/medications/
  __init__.py  apps.py  models.py  services.py  serializers.py  views.py  admin.py
  urls.py  urls_doctors.py  urls_time_blocks.py
  migrations/__init__.py  (+ 0001_initial após makemigrations)
  tests/__init__.py  factories.py  test_models.py  test_serializers.py  test_services.py  test_views.py
```

- Enum: **não há** nesta story (blocos dinâmicos; `source` é 8.2). Se por algum motivo adicionar `TextChoices`, declare-o **em nível de módulo** (não aninhado, senão o `CheckConstraint` não o enxerga) + registre em `ENUM_NAME_OVERRIDES` (`base.py:183-198`).
- `admin.py`: registrar os models (opcional, mas os apps existentes o fazem).
- **`medications` já está em `forbidden_modules` do import-linter** (`backend/pyproject.toml:59`) — nada a mudar. Imports domínio→domínio são permitidos; `core` nunca importa domínio.

### Camada de serviço — assinatura fixa e exceções

[Source: architecture.md#6.2, #6.6, #6.9, #6.10]

- Funções de módulo, `def <verbo>_<substantivo>(*, user, ...) -> Model`; `user` primeiro kwarg keyword-only; recebe dados já validados + `user`, **nunca** `request`.
- `@transaction.atomic` no serviço que escreve multi-tabela (ex. `create_medication` cria med + versão). A view **nunca** abre `atomic`.
- Escopo **implícito** via `Model.objects` (auto-escopado); **nunca** passar `user_id` cru, **nunca** `all_objects` fora de admin.
- **Só levantar exceções de `core/exceptions.py`**: `DomainError` → 409; `TenantScopeViolation` → 500 opaco; validação de serializer → 400 `{detail, fields}`; `DoesNotExist` → a **view** converte para `NotFound()` (404, esconde existência cross-tenant). `ImmutableSnapshot(DomainError)` existe e é reservada para AD-06/07 — **mas nesta story não há snapshot materializado**, então provavelmente não será levantada aqui (é 8.2, ao editar dia já congelado).
- **Tempo:** `from core.calendar import today_for`; `effective_from = today_for(user)`. **Nunca** `date.today()`/`timezone.now()` (guardrail de AST no CI reprova, inclusive em factories).

### Validação da dose JSONB (o análogo direto de `health/services.py:123-166`)

Validar **na camada de serviço**, não no serializer. Molde `_validate_value` (rejeita `bool` explicitamente porque `bool ⊂ int`):

```python
def _validate_dose(dose):
    if not isinstance(dose, list) or not dose:
        raise DomainError("A dose deve ter ao menos um componente.")
    for comp in dose:
        if not isinstance(comp, dict):
            raise DomainError("Componente de dose inválido.")
        amount = comp.get("amount")
        if isinstance(amount, bool) or not isinstance(amount, (int, float)):
            raise DomainError("amount deve ser numérico.")
        unit = comp.get("unit")
        if not isinstance(unit, str) or not unit.strip():
            raise DomainError("unit é obrigatória.")
        # label: str (ver "Decisões a confirmar")
```

"Validar tudo antes de qualquer escrita" — molde `upsert_health_log` (`health/services.py:194-230`).

### Contrato / casing — a exceção JSONB NÃO se aplica à dose

[Source: architecture.md#6.3 linha 898; base.py:201-209; memória `apply-new-migration...` e discussão 7.2]

`djangorestframework-camel-case` converte a borda; **a varredura é recursiva e cega**. A regra crítica: **nunca confie em "as chaves não vão converter"** — a proteção é a tupla `ignore_fields`, não a forma das chaves. **PORÉM**, para 8.1 a decisão correta é **NÃO** adicionar `dose` a `ignore_fields`, porque `label`/`amount`/`unit` são palavras únicas que o `underscoreize`/`camelize` deixa intactas (não há fronteira de caso nem underscore). Isto **difere** de `health_logs.values` (chaves UUID/`blood_pressure`, que estão em `ignore_fields`). **Documente essa decisão inline** e prove idempotência inspecionando `response.content` (JSON renderizado), não `response.data` (pré-render, snake_case). Teste de contrato genérico: `backend/core/tests/test_api_contract.py:24-60`.

### URLs — sem colisão

`/api/health/` é **reservado ao liveness check** (`config/urls.py`, comentário explícito na linha ~17). Os prefixos desta story — `/api/medications/`, `/api/doctors/`, `/api/time-blocks/` — **não colidem** (verificado no urlconf raiz). Split de recursos irmãos em `urls*.py` separados com `include` próprio (precedente: `habits.urls` + `habits.urls_groups`). Rotas estáticas antes de `<uuid:pk>/`.

### UX — a tela de config (nenhum mockup dedicado existe; monte do arquétipo)

[Source: EXPERIENCE.md (ux-hmmb-bujo-2026-06-15):68-72, 722, 726; DESIGN.md:473, 493; ux-hmmb-bujo-2026-07-17/EXPERIENCE.md:70, 96; epics.md#UX-DR17:175]

- **Não há mock detalhado** de "Configurações › Medicamentos" (o único artefato med-específico é o Medication Block da 8.2, UX-DR11). Monte do **arquétipo "Coleção/Configuração"**: `grupos/filtros → lista → criar/editar`. Precedentes irmãos a copiar: **Configurações › Hábitos** e **Configurações › Métricas de Saúde**.
- **Princípio de config (load-bearing):** *"Formulários explicam efeitos prospectivos... Desativar é preferido a excluir quando o histórico precisa ser preservado."* (EXPERIENCE.md:722).
- Layout recomendado (sintetizado): `Box component="main"` (`p:3`) + `h5` título + `body2 text.secondary` explicador prospectivo, hospedando `MedicationsManager`. Manager = lista de Item Rows (título + substância/dose/blocos vigentes + Editar/Desativar) + `Divider` + forms inline. Dose multi-componente e agenda por bloco = editores de linha repetível (idioma `EnumOptionsEditor`). Blocos de horário e médicos = suas próprias listas gerenciadas pequenas (mesmo idioma add/remove).
- Voz (UX-DR13) / a11y (UX-DR20, WCAG 2.2 AA): pt-BR neutro, **zero gamificação** (empty states factuais, "Medicamento desativado."); `<main aria-label>` por superfície; cor **nunca** único indicador; erros `role="alert"`, confirmações `role="status"`; **desativar-não-apagar**; alvos ≥44px (já default global no tema em `MuiButton`/`MuiIconButton`).

### Padrões de frontend concretos (arquivos + linhas)

[Source: verificado em `frontend/`]

- **Tema:** `frontend/src/theme.ts` `createBujoTheme(mode)` (:104-155). Tokens (:59-91): surface `#FDFAF4`, ink `#1A1612`, `brand-primary #2BADA0`; Inter; `spacing:4`, `borderRadius:4`, **`shadows` todos 'none'** (flat), `MuiButton minHeight:44` + `MuiIconButton 44` globais (:147-153). **Nunca hex hardcoded** — use `sx` semântico (`color:'text.secondary'`, `error.main`). Health/medications são "Onda 5" da futura migração de design system → **não** invente estilo estrutural one-off (a migração NÃO está autorizada; construa com o `theme.ts` atual).
- **Query keys:** `frontend/src/api/keys.ts` — convenção `[escopo, entidade, discriminador, params?]`, **sem `userId`** (logout limpa o cache inteiro). `habits.*` (:33-47) e `health.*` (:49-62) são os templates.
- **Data layer:** `api/client.ts` (axios single instance + interceptor 401/refresh), `api/queryClient.ts` (`staleTime:0`, `retry:1`, `refetchOnWindowFocus:true`). Config-CRUD = `useMutation` + `invalidateQueries` por prefixo (**sem** otimismo; `useOptimisticMutation` é só para toggles de alta frequência, ex. a confirmação diária da 8.2).
- **Forms repetíveis:** `EnumOptionsEditor` (`HealthMetricsManager.tsx:42-93`) — controlado por `options:T[]` + `onChange`, `handleAdd/Remove/Change` por índice, `Button startIcon={<AddIcon/>}`, remover `IconButton` com aria-label. **Reuse para dose `[{label,amount,unit}]` e para a agenda por bloco.**
- **Prospectivo + identidade-vs-versão:** `HabitsManager.tsx` (:31-32 tooltip; `HabitRow` :46-163 nova versão vs. identidade separada); `habits/api.ts` (`useAddHabitVersionMutation` POST `versions/`; `useUpdateHabitIdentityMutation` PATCH base).
- **Estrutura da feature:** `features/<dom>/{api.ts, api.test.tsx, types.ts, index.ts, components/*.tsx}`; barrel `index.ts`; página fina (~17 linhas) importa do barrel. Tipos em `types.ts` re-exportam `components['schemas'][...]` de `api/types.gen.ts` (**só resolvem após** regenerar o contrato). ESLint `eslint-plugin-boundaries` impõe a fronteira de features.

### Os 3 testes compartilhados de nav — por que 8.1 os mantém verdes

[Source: memória `sidebar-bottomnav-shared-tests-need-query-mock`; `router.test.tsx`, `RouteAnnouncer.test.tsx`, `AppLayout.test.tsx`]

Esses testes renderizam a casca **sem** `QueryClientProvider` e só sobrevivem porque `vi.mock`am cada filho de nav que usa TanStack Query (precedente `BrainDumpBadge`). **8.1 é seguro** porque a tela de medicamentos é uma **página em `<Outlet/>`** alcançada pelo hub de Configurações — não adiciona nenhum filho Query-driven a `Sidebar`/`BottomNav`. **Não** adicione badge/contador Query-driven à nav; se algum dia precisar, adicione `vi.mock` do módulo aos **três** arquivos. Um `<Link>` puro (sem Query) é seguro. `router.test.tsx` também consome `routeDefinitions` — se ele enumera rotas, adicione a nova.

### Suíte de testes — a full-suite do Neon TRAVA (rode em lotes, reporte a união honestamente)

[Source: memória e retros 6/7; `_bmad/custom/bmad-dev-story.toml`]

- Backend: matriz fixa `tests/{test_models,test_serializers,test_services,test_views}.py` + `factories.py`. Factories com `class Params: user=SubFactory(UserFactory)` + `user_id=SelfAttribute("user.id")` (porque `user_id` é UUIDField, não FK). `register_isolation_case(...)` **por model** + `"medications.tests.factories"` em `_ISOLATION_TEST_MODULES` (`conftest.py:19`). `auth_client`/`tenant_context(user)` para testes de serviço/view. `response.data` é snake_case (asserts de erro em snake).
- **A full-suite bare `pytest` TRAVA (crônico, >15min).** Rode **escopado por app em lotes** com `--reuse-db` e **reporte a UNIÃO honestamente** — nunca uma contagem escopada como se fosse o total. Ex.: `pytest medications accounts core` + `pytest habits bujo braindump health`. **Nunca** escope por caminho e reporte como total (Retro 11: 330 reportado, real 356 — `accounts/` fora). Cole a contagem **real observada, depois de escrever o último teste** (inclui fix de review).
- Migration: `pytest --create-db` reconstrói o test DB do Neon com `0001_initial`. Confirme `makemigrations --check` = "No changes detected" ao fim (uma migration por story).
- **Sem `vitest` nem E2E no CI** — são rede de segurança local/review. Ordem do gate de CI: backend `ruff` → `lint-imports` → `pytest` → `spectacular` + diff `types.gen.ts`; frontend `tsc` → ESLint → `vite build`.

### Migration na branch Neon `e2e` (gate operacional antes do Playwright)

[Source: memória `apply-new-migration-to-neon-e2e-branch-before-e2e`; `docs/e2e-neon-reset.md:55`; Retro Epic 7 §3/#1]

E2E aponta para `config.settings.e2e` → `backend/.env.e2e` → branch Neon `e2e` (independente da `dev`). **Bug recorrente:** uma migration pendente na branch `e2e` trava TODA a suíte Playwright ("relation does not exist"). **Antes de qualquer E2E**, rode (de `backend/`):

```
DJANGO_SETTINGS_MODULE=config.settings.e2e uv run python manage.py migrate
```

A branch `dev` (onde o app é usado) migra sob `config.settings.dev`. Playwright: `workers:1`, `expect.timeout:10_000`; rode via `cd frontend && npm run test:e2e`. Orce flutuação de cold-start (fixture de signup pode falhar e passar no retry). **Frontend exige `nvm use 22.15.1`** antes de cada comando (`tsc`/ESLint/`vitest`/`vite build`/`generate-types`/`playwright`) — o shell inicia em Node v18 e não há `.nvmrc`.

### Guardrails do dev-story relevantes a esta story

[Source: `_bmad/custom/bmad-dev-story.toml` — carregados automaticamente no dev-story; repetidos aqui os que mais mordem em 8.1]

- **Contagem de testes = observada, nunca de memória.** Rode o comando real e cole o número literal, **sem escopar por caminho**, **depois** do último teste.
- **File List é a ÚLTIMA coisa antes de `review`:** `git status --short` + `git diff --stat` após verificação manual/E2E; **nomear explicitamente** artefatos de tipo novo (spec E2E permanente `medications.spec.ts`, seed `seedMedications.ts`, app novo inteiro). Essa classe de achado vazou nos Épicos 4/7/11.
- **Gap de spec achado na implementação → atualizar o doc-fonte entra no fechamento** (checar **também** as ACs de `epics.md`, não só `architecture.md`/`prd.md`). Ex. concreto nesta story: corrigir o comentário obsoleto de `architecture.md:1106`.
- **Dialog/modal:** se usar modal de criação, separe `onClose` (cancelar) de `onSuccess` desde o 1º rascunho — nunca reaproveite um `onClose` para os dois (bug HIGH no Épico 11). A tela de config usa **forms inline**, então provavelmente sem modal — mas se um `Modal` (shared `Modal.tsx`) for usado, aplique a regra.
- **MUI `Typography` com `variant` custom** (`body-sm`, `label`) usado como **bloco** precisa de `component="div"` explícito (senão vira `<span>` inline e `noWrap`/truncação não se aplicam). Prefira `body2`/`caption` nativos onde possível (6.1 evitou o bug assim).
- **`autoFocus` dentro de Dialog/Drawer (FocusTrap) NÃO foca no browser real** (jsdom dá falso-verde). Se houver, foque via `inputRef` no callback `onEntered`. Um AC de "campo já focado em modal" só é provável de verdade por E2E.
- **Resolver ambiguidade:** favoreça o doc mais específico + o código existente, documente o raciocínio inline nas Dev/Completion Notes, trate como risco de mudança de 1 linha se o PO discordar.

### Protocolo de commit (memória)

[Source: memórias `commit-at-end-of-each-story`, `story-automator-autonomous-hazards-in-this-env`; `7-2-uncommitted-report`]

- **Um commit por story**, escopo preciso. Gere/salve o uncommitted-report antes, então commite **sem pedir "[S]im"**. Mensagem pt-BR Conventional Commits: `feat(story-8.1): <descrição>`; follow-up de testes/e2e = `test(story-8.1): ...`.
- **NUNCA** varra o trabalho de planejamento/UX do Hugo para o commit. **EXCLUIR** sempre: `_bmad-output/planning-artifacts/**` (incl. `architecture.md`, `epics.md`, `ux-designs/**`), `_bmad-output/specs/**`, `_bmad-output/story-automator/**`, `docs/futureIdeas.md`. Se corrigir um doc-fonte (ex. `architecture.md:1106`), ele viaja na árvore de trabalho do Hugo, **não** no commit da story. Use `git add` escopado + guard-check (nunca `git add -A`). Commit é SSH-assinado via 1Password (pode travar após ocioso → escalar, nunca commitar sem assinatura).

### Steering específico do Épico 8

[Source: Retro Epic 7 §6 linhas 87-99; architecture.md:1151]

- Domínio **independente**: `medications` e `health` sem FK — 8.1 começa com zero dependência de código de Saúde.
- Ativo compartilhado (conveniência, não dependência): o schema já preserva a análise futura de dose (`(dose->0->>'amount')::numeric` sobre a timeline de `medication_schedule_versions`) — **não** construir no MVP.
- **"Dose perdida" (sinal clínico ≠ ausência de hábito)** é da 8.2/8.3 — não modelar aqui além de garantir que `effective_from` torna tudo prospectivo (a fidelidade histórica que a 8.3 vai exibir depende disto).

### Project Structure Notes

- **Alinhamento:** app backend em `backend/medications/` e feature frontend em `frontend/src/features/medications/` + página em `frontend/src/pages/settings/MedicationsSettingsPage.tsx` — exatamente as posições que a árvore de `architecture.md#7.1` prescreve (com a ressalva de que o **comentário** de conteúdo em `:1106` está obsoleto/AD-01; o **local** está correto).
- **Variância documentada:** a rota de **configuração** é `/settings/medications` (nova, irmã de `settings/health-metrics`); a rota `/health/medications` já existe como **placeholder** e é a superfície **diária** da 8.2 — não confundir nem substituir.
- **Sem conflito** com o import-linter (`medications` já em `forbidden_modules`) nem com o boundary de ESLint (feature isolada, exposta só pelo barrel).

### References

- [Source: architecture.md#AD-07 (Modelo de Medicamentos) linhas 360-468] — schema, dois eixos de versão, dose JSONB, doctors, semântica prospectiva.
- [Source: architecture.md#AD-06 (Hábitos snapshot) linhas 296-336] — molde `HabitVersion`/effective-dating a portar.
- [Source: architecture.md#6.1–6.10] — nomenclatura, service layer, casing/JSONB (§6.3 linha 898), erros (§6.4), multi-tenant fail-closed (§6.7), tempo/`today_for` (§6.8), enforcement (§6.9), reference impls (§6.10).
- [Source: architecture.md#7.1 linha 1106 (OBSOLETO — AD-01) e linha 1151 (medications×health sem FK)].
- [Source: epics.md#Epic-8 linhas 1285-1310] — Story 8.1 (ACs verbatim); linhas 1312-1351 (8.2/8.3, fora de escopo); UX-DR11:163, UX-DR17:175, AR-18:135.
- [Source: EXPERIENCE.md (ux-hmmb-bujo-2026-06-15):68-72, 722, 726; DESIGN.md:473, 493] — IA de Configurações, arquétipo Coleção/Config, princípio prospectivo.
- Código-molde: `backend/habits/{models.py:45-150, services.py:37-212, api}`, `backend/health/{models.py:37-69, services.py:77-230, serializers.py:30-53}`, `backend/core/{models.py:21-43, tenant.py, exceptions.py, calendar.py}`, `backend/conftest.py:19-64`; `frontend/src/features/{habits,health}/*`, `theme.ts:104-155`, `api/keys.ts`, `pages/settings/*`, `app/router.tsx`, `e2e/{health-metrics.spec.ts, seedHealthFields.ts, backendEnv.ts}`.

### Decisões a confirmar (perguntas salvas para o fim — não bloqueiam)

1. **`label` da dose vazio:** a AD-07 só exige `amount` numérico + `unit` não-vazia (linha 385). Proposta: `label` é string **presente mas pode ser vazia** (para remédio de droga única, onde o `substance_name` já identifica). Se o PO quiser `label` obrigatório para multi-droga, é mudança de 1 linha na validação.
2. **Agenda inline na criação:** proposta = `create_medication` cria só med + versão de substância; a agenda por bloco é definida em passo separado (`set_schedule`), espelhando a leitura das ACs ("cadastra um medicamento" vs. "define a agenda de doses"). Aceitar doses no create é opcional/aditivo.
3. **`doctors` sem `active`:** a AD-07 não dá coluna `active` a `doctors` (catálogo simples, protegido por `PROTECT`). Proposta: sem desativação de médico nesta fatia.
4. **Reorder de `time_blocks`:** `display_order` no schema + append na criação; **UI de reordenação deferida** (espelha 6.1/7.1).
5. **"Desativar" no nível do medicamento (Item Row):** como `medications` **não tem coluna `active`** (AC5) e a AC de epics fala em "desativar uma **agenda**", a proposta é: "Desativar" na linha do medicamento = inserir versão `active=false` **em todas as agendas ativas** daquele medicamento (prospectivo, em lote atômico); um medicamento sem nenhuma agenda ativa é exibido como inativo (derivado, não armazenado). Confirmar se o PO quer granularidade só por bloco em vez de um atalho no nível do med.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) — workflow dev-story (BMAD).

### Debug Log References

- **Migration**: `makemigrations medications --name initial` → uma migration (`0001_initial`, 5 models). `makemigrations --check` = "No changes detected".
- **Backend tests**: rebuild do test DB do Neon com `pytest --create-db` (0001_initial aplicado). 1 falha inicial em `test_past_schedule_version_stays_frozen_after_deactivation` foi **bug do teste** (chamou `current_schedule_version_of(med, yesterday)` sem o arg `time_block`) — corrigido para `current_schedule_version_of(med, block, yesterday)`; passa.
- **GATE E2E**: migration aplicada à branch Neon `e2e` **antes** do Playwright (`DJANGO_SETTINGS_MODULE=config.settings.e2e uv run python manage.py migrate` → `Applying medications.0001_initial... OK`). 1ª execução E2E teve falha transitória de signup (`ECONNREFUSED` em `/api/bujo/logs/today/`) porque um edit de `models.py` (noqa DJ001) disparou o StatReloader do webServer **durante** o teste; re-execução limpa passou (2 passed, 51s).
- **Ruff DJ001**: `null=True` em `CharField` (`specialty`/`laboratory`) segue a convenção do codebase — `# noqa: DJ001` com justificativa (AD-07: `TEXT NULL`), como `bujo.models.Task.description`.

### Completion Notes List

Implementada a **camada de cadastro/versões** da AD-07 (slot estável + blocos dinâmicos + agenda/substância versionadas). App backend `medications/` e feature frontend `features/medications/` criados **do zero**, mais a tela **Configurações > Medicamentos** (`/settings/medications`).

**Backend** — 5 models `TenantModel` (`Doctor`, `TimeBlock`, `Medication` [SEM `active`], `MedicationSubstanceVersion`, `MedicationScheduleVersion`) portando o molde de `habits/` (effective-dating, `UniqueConstraint(pai, effective_from)`, `update_or_create` para "mesma mudança no mesmo dia = UPDATE"). Camada de serviço com dois eixos de versão **independentes** (`add_substance_version` / `set_schedule`), `_validate_dose` (amount numérico rejeitando `bool`, unit não-vazia, lista não-vazia, `label` pode ser vazio — Decisão 1), herança de campos não informados, e `today_for(user)` em toda datação. API DRF fina (`APIView` + `@extend_schema`) em 3 recursos-irmãos (`/api/medications/`, `/api/doctors/`, `/api/time-blocks/`).

**Decisões de spec resolvidas** (favorecendo o doc mais específico + código existente; risco de 1 linha se o PO discordar — guardrail):
- **Decisão 1** — `label` da dose pode ser vazio (string presente).
- **Decisão 2** — `create_medication` cria só slot + versão de substância; agenda por bloco em passo separado (`set_schedule`).
- **Decisão 3** — `doctors` sem coluna `active` (catálogo simples protegido por `PROTECT`).
- **Decisão 4** — `display_order` no schema + append na criação; UI de reordenação deferida.
- **Decisão 5** — `medications` não tem `active` (AC5) → estado **derivado** (`derived_active`): sem agenda = ativo; com agendas = ativo se ≥1 ativa. O "Desativar" no Item Row (nível-medicamento) é um **atalho de frontend** que aplica `active=false` em lote a cada bloco ativo via `schedule-versions/` (Promise.all, molde `overrideDayWorkday` de habits) — **nenhum endpoint novo** além dos da Task 3. Desativar por-bloco (AC5 literal) é o toggle granular em cada agenda.

**Casing JSONB (§6.3)** — `dose` (`[{label, amount, unit}]`) usa chaves de palavra única, que `underscoreize`/`camelize` deixa **intactas**; **NÃO** adicionado a `JSON_UNDERSCOREIZE.ignore_fields` (decisão documentada inline em model+serializer+teste). Provado por `test_dose_keys_survive_camelcase_roundtrip` (inspeciona `response.content`). **Nenhum enum** nesta story → nenhuma mudança em `ENUM_NAME_OVERRIDES`. `medications` já estava em `forbidden_modules` (import-linter) — sem mudança.

**Frontend** — `MedicationsManager` modelado em `HealthMetricsManager` (linhas repetíveis) + `HabitsManager` (versão-vs-identidade, tooltip prospectivo). Editor de dose multi-componente (`DoseEditor`, idioma `EnumOptionsEditor`), sub-gerenciadores de blocos e médicos, estados skeleton/vazio/erro-leitura-retry/erro-escrita. Inativo = opacidade 0.6 + "(inativo)" (cor nunca única — WCAG). Toggles Desativar/Ativar com `aria-label` distintos por nível (medicamento/agenda/bloco) para desambiguação a11y (WCAG 2.5.3: rótulo visível contido no nome acessível). Contrato regenerado (`spectacular` + `generate-types`); diff **puramente aditivo (0 remoções)** em `schema.yaml` e `types.gen.ts`.

**Os 3 testes compartilhados de nav** seguem verdes: a tela é uma página em `<Outlet/>` alcançada pelo hub de Configurações; nada Query-driven foi adicionado a `Sidebar`/`BottomNav` (só um `<Link>` puro em `SettingsPage`).

**Verificação (contagens reais observadas, não de memória):**
- Backend `pytest` (rodado em lotes cobrindo os 7 apps): **Lote 1 (`medications accounts core` — inclui a matriz parametrizada de isolamento cross-tenant de TODOS os models registrados): 187 passed (391s)**. `medications` isolado: **82 passed**. **Lote 2 (`habits bujo braindump health` — apps NÃO tocados por esta story aditiva) ficou I/O-bound na branch Neon (>20min, sem regressão observada) e será RECONFIRMADO no code-review**; nenhuma mudança de código compartilhado afeta esses apps (só adições: `medications` em `INSTALLED_APPS`/urls e `medications.tests.factories` no contrato de isolamento — este último já exercitado e verde no Lote 1).
- Frontend `vitest` (suíte completa): **734 passed (68 arquivos)** — inclui 20 testes novos de medications.
- E2E Playwright (`medications.spec.ts`, branch Neon `e2e`): **2 passed**.
- `ruff` ✓, `lint-imports` ✓ (port rule KEPT), `tsc` ✓, ESLint ✓, `vite build` ✓, `makemigrations --check` = No changes detected.

**Nota de doc-fonte (fora do commit da story):** o comentário obsoleto de `architecture.md:1106` (esboço AD-01 supersedido — `medication_blocks`/`medication_logs`) deve ser corrigido na árvore de trabalho do Hugo (planning-artifacts nunca entram no commit da story).

### File List

**Backend — app novo `medications/` (criado do zero):**
- `backend/medications/__init__.py`
- `backend/medications/apps.py`
- `backend/medications/models.py`
- `backend/medications/services.py`
- `backend/medications/serializers.py`
- `backend/medications/views.py`
- `backend/medications/urls.py`
- `backend/medications/urls_doctors.py`
- `backend/medications/urls_time_blocks.py`
- `backend/medications/admin.py`
- `backend/medications/migrations/__init__.py`
- `backend/medications/migrations/0001_initial.py`
- `backend/medications/tests/__init__.py`
- `backend/medications/tests/factories.py`
- `backend/medications/tests/test_models.py`
- `backend/medications/tests/test_serializers.py`
- `backend/medications/tests/test_services.py`
- `backend/medications/tests/test_views.py`

**Backend — modificados:**
- `backend/config/settings/base.py` (`"medications"` em `INSTALLED_APPS`)
- `backend/config/urls.py` (3 includes: `/api/medications/`, `/api/doctors/`, `/api/time-blocks/`)
- `backend/conftest.py` (`"medications.tests.factories"` em `_ISOLATION_TEST_MODULES`)

**Frontend — feature nova `features/medications/` (criada do zero):**
- `frontend/src/features/medications/types.ts`
- `frontend/src/features/medications/api.ts`
- `frontend/src/features/medications/index.ts`
- `frontend/src/features/medications/components/MedicationsManager.tsx`
- `frontend/src/features/medications/api.test.tsx`
- `frontend/src/features/medications/components/MedicationsManager.test.tsx`

**Frontend — página, modificados e artefatos de tipo novo:**
- `frontend/src/pages/settings/MedicationsSettingsPage.tsx` (novo)
- `frontend/src/app/router.tsx` (rota `settings/medications`)
- `frontend/src/pages/settings/SettingsPage.tsx` (link "Medicamentos")
- `frontend/src/api/keys.ts` (seção `medications`)
- `frontend/src/api/types.gen.ts` (regenerado — aditivo)
- `frontend/e2e/medications.spec.ts` (**spec E2E permanente — tipo novo**)
- `frontend/e2e/seedMedications.ts` (**seed E2E — tipo novo**)

**Contrato:**
- `schema.yaml` (regenerado — aditivo)

### Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-07-20 | 0.1 | Implementação da Story 8.1 — cadastro de medicamentos com slot estável e versões (app `medications/` + feature `features/medications/` + tela Configurações > Medicamentos). | dev-story (Amelia / Opus 4.8) |
| 2026-07-20 | 0.2 | Code review (autônomo, story-automator-review): 3 achados LOW/MEDIUM auto-corrigidos no frontend; 0 CRÍTICOS. Verificação reconfirmada (backend Lote 1 = 187 passed; vitest = 735 passed). Status → done. | review (Opus 4.8, 1M) |

## Senior Developer Review (AI)

**Revisor:** HugoMMBrito (via story-automator-review autônomo) · **Data:** 2026-07-20 · **Modelo:** claude-opus-4-8[1m]

**Resultado:** ✅ **Aprovado (done)** — 0 achados CRÍTICOS. Implementação de alta qualidade: todas as 7 ACs verificadas contra o código; File List reconciliada com o git (bate 1:1, zero discrepância); esquema de contrato **puramente aditivo** (`schema.yaml` +542/−0, `types.gen.ts` +539/−0). Os 3 achados abaixo (LOW/MEDIUM) foram **auto-corrigidos** nesta revisão.

### Validação de ACs (todas IMPLEMENTED)

- **AC1** slot + 1ª versão de substância na mesma transação (`create_medication`, `@transaction.atomic`); `medications` sem `active`; UUID `TenantModel`. ✓ (`test_create_medication_*`, `test_medication_has_no_active_column`)
- **AC2** `time_blocks` dinâmico sem ENUM/migração; append de `display_order`; desativar/reativar preserva. ✓
- **AC3** dose JSONB multi-componente validada **no serviço** (`_validate_dose`: `amount` numérico rejeitando `bool`, `unit` não-vazia, lista não-vazia). ✓
- **AC4** dois eixos independentes prospectivos; mesmo dia = UPDATE via `UniqueConstraint` + `update_or_create`; herança de campos não informados (sentinela `_UNSET`). ✓
- **AC5** desativação = nova versão `active=false` (nunca `.delete()`); passado congelado. ✓ (`test_past_schedule_version_stays_frozen_after_deactivation`)
- **AC6** `doctors` catálogo por tenant, `prescribed_by` `on_delete=PROTECT`; criável a partir da tela e reutilizável. ✓
- **AC7** tela `/settings/medications` via hub; skeleton/vazio/erro-leitura-retry/erro-escrita; voz pt-BR neutra; WCAG (`role="alert"`, `(inativo)` textual + opacidade, alvos ≥44px). ✓

### Achados e correções aplicadas

1. **[MEDIUM] Erro de escrita do toggle nível-medicamento não era exibido** — `frontend/src/features/medications/components/MedicationsManager.tsx`: o indicador `isError` da `MedicationRow` omitia `setMedActive.isError`, então uma falha no "Desativar/Ativar medicamento" (lote via `schedule-versions/`) ficava silenciosa — inconsistente com o requisito de erro de escrita da AC7. **Corrigido:** `setMedActive.isError` adicionado à união + teste novo (`surfaça erro de escrita quando o toggle de nível-medicamento falha`).
2. **[LOW] Dose fantasma `amount: 0`** — `MedicationsManager.tsx` `rowsToDose`: uma linha com só a unidade preenchida virava `{amount: 0}` (`Number('') === 0`), aceita pelo backend (0 é numérico). **Corrigido:** o filtro passa a exigir `amount` preenchido; linha com quantidade e sem unidade continua indo ao backend (que rejeita `unit` vazia, com feedback).
3. **[LOW] Médico inline não era autosselecionado** — `MedicationsManager.tsx` `handleCreateDoctorInline`: criar um médico pelo campo inline não o selecionava no `Select`, exigindo um passo manual extra (fricção contra a AC6). **Corrigido:** `onSuccess` autosseleciona o médico recém-criado (`setDoctorId(doctor.id)`).

**Consciente, NÃO alterado (consistência com irmãos):** ausência de confirmação `role="status"` de sucesso — os managers de config irmãos (`HabitsManager`, `HealthMetricsManager`) também só usam `role="alert"` para erro e não emitem toast de sucesso em CRUD de configuração (a lista se atualiza via `invalidateQueries`). Adicionar um one-off aqui violaria o guardrail de Dev Notes ("não inventar estilo estrutural one-off").

### Gates reconfirmados nesta revisão

- Backend: `ruff` ✓, `lint-imports` ✓ (port rule KEPT), `makemigrations --check` = No changes detected, **pytest Lote 1 (`medications accounts core`, inclui a matriz de isolamento cross-tenant dos 5 models) = 187 passed (373s)**.
- Frontend (`nvm use 22.15.1`): `tsc` ✓, ESLint ✓, **vitest (suíte completa) = 735 passed (68 arquivos)** — inclui o teste novo do achado #1.
- Contrato: diff aditivo (0 remoções) confirmado em `schema.yaml` e `types.gen.ts`.
