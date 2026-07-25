# Explicação dos arquivos não commitados — Story 14.2: Fontes dos rituais e decisões-snapshot (backend)

## Visão geral

A Story 14.2 é a **segunda story de código do Épico 14** (Onda 3 — Núcleo BuJo no
Sistema Novo) e é **backend puro** (Django/DRF): materializa no domínio as **fontes
de planejamento** dos rituais Semana/Mês (M06/M07 do `EXPERIENCE.md`) e a
**decisão-snapshot** por item, na forma decidida na **AD-28 item 6**. Ela **consome**
o estado de ciclo entregue pela 14.1 (`status`/`planning_completed_at`, `cycles.py`,
`is_cycle_closed`) e **não** o altera.

Peças centrais:

- Novo model `RitualDecision` (`TenantModel`) numa **tabela própria** (`ritual_decisions`):
  âncora **exclusiva** do alvo (`weekly_log` XOR `monthly_log`) e do item (`task` XOR
  `recurring_template`) por `CheckConstraint` *exactly-one*, `decision` como `TextChoices`
  + CHECK, e **4 uniques parciais por combinação** derivadas do produto cartesiano num
  helper (`_ritual_decision_uniques`, não 4 blocos copiados). Re-decidir é **upsert no
  serviço**, nunca segunda linha.
- Migration `0008_ritual_decisions` — **sem `RunPython`** (não há dado retroativo:
  decisões-snapshot nascem com o ritual), aplicada a `dev` **e** à branch Neon `e2e`
  antes do Playwright.
- Novo módulo de serviço `bujo/services/rituals.py`: matriz única `ALLOWED_DECISIONS`
  (3 células), `upsert_ritual_decision` idempotente que **jamais** toca a `Task`/template,
  e as **7 fontes** como funções independentes (4 do ritual semanal + 3 do mensal), com
  progresso **derivado na leitura** (`eligible − mutados − decididos`), nunca contador.
- Novo módulo `bujo/services/density.py`: densidade real dos rails — **só materializado
  no container-alvo**, **com** subtarefas, segmentada nos **6 status** (chaves sempre
  presentes), grade completa (7 dias / 28–31 dias com bissexto via `calendar.monthrange`)
  + faixa `undated`; conta **registros, não linhagens**.
- `previous_operational_weekly`/`previous_operational_monthly`/`has_undisposed` promovidos
  a **públicos** em `cycles.py` (as fontes bloqueantes não podem divergir do gate de Iniciar).
- Exceção nova `InvalidRitualDecision` (409). 10 rotas novas **sem agregador** (independência
  estrutural, AC7). `schema.yaml` e `types.gen.ts` regenerados com **0 deleções**
  (`594/0` e `562/0` — prova mecânica de aditividade estrita, AC8).

**Único arquivo de frontend de produto tocado:** `frontend/src/api/types.gen.ts` —
**gerado**, nunca editado à mão. Não há UI nova (as Stories 14.5/14.6 a construirão).

**Verificação (citada do Dev Agent Record e do QA):** pytest full-suite **1210 passed**
após a code review (1099 herdados da 14.1 + os novos; divisão derivada de `git diff`,
nunca por subtração); `ruff check`, `lint-imports` (1/0) e `tsc --noEmit` limpos;
`ruff format --check` segue vermelho nos **48 arquivos pré-existentes** (os 2 módulos novos
foram formatados; nenhum arquivo adicionado à dívida). Migration aplicada a `dev` e à
branch Neon `e2e` (`migrate --check` limpo depois) — o bug recorrente 7.1/7.2/14.1 não se
repetiu. E2E de regressão do contrato legado: **16 passed / 1 failed**; a falha
(`recurring-templates.spec.ts:306`, locator `Definir placement`) **verificada
pré-existente** por execução no baseline com a story stashada — herdada da classe de
locator ambíguo da 13.3, não é regressão. `ritual-sources.spec.ts` novo: **3 passed** na
branch `e2e`. Code review (story-automator): **Aprovada, 0 críticos**; 1 alto + 3 médios +
2 baixos corrigidos, 1 baixo registrado. sprint-status → `done`.

**Achado alto corrigido na review (A1):** as fontes bloqueantes (`previous-weekly`/
`previous-monthly`) anotavam a decisão-snapshot do log **anterior** — como a matriz casa
apenas *tipos* de alvo/item, um `keep` sobre uma `Task` ancorada no próprio weekly-anterior
tirava um item aberto de `pendingDecisionCount` e podia declarar `reviewed: true` ("semana
anterior pronta para finalizar" enquanto o gate de Iniciar respondia 409). Corrigido para
que a **mecânica bloqueante não consulte decisão nenhuma** (invariante por construção:
`pending == eligible` sempre), com teste novo não-vacuoso.

**Total documentado: 24 arquivos** (17 modificados + 7 novos), excluindo este próprio
relatório.

## Ordem lógica de funcionamento

1. **Artefatos de planejamento/processo** — story spec, sprint-status, test-summary do QA,
   orquestração do story-automator.
2. **Modelo de dados + migration** — `models.py` (`RitualDecision` + enum + constraints),
   migration `0008` (schema puro).
3. **Primitivas compartilhadas** — `core/exceptions.py` (`InvalidRitualDecision`),
   `cycles.py` (predicados públicos promovidos).
4. **Serviços** — `services/rituals.py` (decisão + 7 fontes), `services/density.py`
   (densidade real).
5. **Serializers** — envelope de fonte, itens, densidade, query/body.
6. **Views + URLs** — 1 view por endpoint (10) + 10 rotas.
7. **Contrato gerado** — `schema.yaml`, `types.gen.ts` (consumidores do backend).
8. **Obrigações de tenant** — `purge_e2e_users.py` + espelho de teste, factory + contrato
   de isolamento.
9. **Testes** — models, services, views, serializers, purge.
10. **E2E** — helper de contagem e spec (consumidores de fim a fim).

---

## 1. Artefatos de planejamento e processo

### `_bmad-output/implementation-artifacts/14-2-fontes-dos-rituais-e-decisoes-snapshot-backend.md`

**Função geral do arquivo** — Story spec da 14.2 (NEW, untracked). Contexto completo: 8
ACs, 9 Tasks, Dev Notes extensas, Dev Agent Record, Senior Developer Review (AI) e File List.

**Função geral da alteração** — Documento de fonte da verdade. `Status: done`,
`baseline_commit: 971da7c`. AC1 (tabela própria + âncoras exclusivas + uniques parciais),
AC2 (matriz de decisões + upsert idempotente + Task jamais tocada), AC3/AC4 (7 fontes com a
elegibilidade do M06/M07), AC5 (progresso derivado, nunca contador), AC6 (densidade só
materializado, com subtarefas, 6 status), AC7 (independência de carga/falha, zero
materialização, isolamento por tenant), AC8 (contrato legado preservado + aditividade
estrita). Dev Notes registra o estado do código consumido, as 5 ambiguidades resolvidas e a
dedução da **regra de dezembro** como emergente.

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Função geral do arquivo** — Fila e status do sprint (fonte da ordem mestre).

**Função geral da alteração** — `14-2-...: backlog → done` (linha 176) com o bloco de
histórico anexado (transições `ready-for-dev → review → done`, resumo dos gates e dos
achados A1/M1/M2/M3/B1/B2). `last_updated` reescrito com o resumo da review da 14.2 no topo.
`epic-14` permanece `in-progress`.

### `_bmad-output/implementation-artifacts/tests/test-summary-14-2.md`

**Função geral do arquivo** — Resumo do passo de QA (`bmad-qa-generate-e2e-tests`), NEW.

**Função geral da alteração** — Registra as 7 funções de teste de API novas (15 testes
coletados, uma parametrizada ×9), o spec E2E novo (3 testes), os 4 experimentos de
não-vacuidade, os gates (**1209 passed** ao fim do passo) e o **Achado 1** (a subtarefa
aparece no dia do pai na UI, mas conta como `undated` na densidade — consequência a
documentar para a UX das 14.5/14.6, não defeito).

### `_bmad-output/story-automator/orchestration-14-20260725-024358.md`

**Função geral do arquivo** — Documento de estado da orquestração `bmad-story-automator` que
conduz o Épico 14 (artefato de processo, não runtime).

**Função geral da alteração** — `currentStory: 14.1 → 14.2`, `currentStep`
`step-03b-execute-finish → step-03a-execute-review`; a tabela de progresso marca 14.1 como
`done` (com `git-commit = done`, commit `971da7cb`) e 14.2 como `in-progress`
(create/dev/automate/review `done`, git-commit pendente). 8 linhas novas de log anexadas
(commit da 14.1, início e passos da 14.2 até `code-review 14.2 done: pytest 1210 passed`).

## 2. Modelo de dados e migration

### `backend/bujo/models.py`

**Função geral do arquivo** — Models do app `bujo` (`Log`, `WeeklyLog`, `MonthlyLog`,
`Task`, `RecurringTaskTemplate`), todos sob `TenantModel` (UUID PK, `user_id` não-FK).

**Função geral da alteração** — Adiciona o enum `RitualDecisionKind`, o helper
`_ritual_decision_uniques` e o model `RitualDecision` (AD-28 item 6). `+144 / -0`.

**Blocos principais**
- `RitualDecisionKind(models.TextChoices)` **no nível do módulo** (l.110) —
  `KEEP/SKIP_WEEK/KEEP_UNDATED`; aninhá-la em `Meta` a esconderia dos `CheckConstraint`
  (mesmo motivo de `TaskStatus`/`CycleStatus`). Cada valor amarrado a **um** contexto de
  ritual pela matriz do serviço, não por convenção.
- `_ritual_decision_uniques()` (l.139) — **gera** as 4 uniques parciais via produto
  cartesiano das duas âncoras (`weekly_log`/`monthly_log` × `task`/`recurring_template`),
  extraído em vez de copiado (lição de dívida de gêmeos dos Épicos 13/14). Docstring explica
  por que **uma unique por par** (e não uma única sobre 4 colunas): no Postgres cada `NULL`
  é distinto, então a unique de 4 colunas com 2 nulas nunca colidiria.
- `RitualDecision(TenantModel)` (l.164): `Decision = RitualDecisionKind`; 4 FKs `null=True`,
  `on_delete=CASCADE`, todas com `related_name="ritual_decisions"` (nomes iguais em models
  diferentes não colidem); `decision` NOT NULL sem default; `created_at`/`updated_at` (o
  par prova o upsert sem escrita — `updated_at` intacto). `Meta`: `db_table="ritual_decisions"`
  (plural, como a AD-28 nomeia) + 2 CHECK *exactly-one* + CHECK do enum + as 4 uniques do helper.

**Comportamento de libs usadas**
- `CheckConstraint(condition=Q(...) | Q(...))`: impõe XOR de alvo/item no banco. Usa
  `condition=` (Django ≥5.1; `check=` deprecado).
- `UniqueConstraint(fields=..., condition=Q(... isnull=False ...))`: gera `CREATE UNIQUE
  INDEX ... WHERE ...` no Postgres — uma linha por `(alvo, item)`.

### `backend/bujo/migrations/0008_ritual_decisions.py`

**Função geral do arquivo** — Migration nomeada (NEW). Schema puro — **sem `RunPython`**
(contraste com a `0007`, que precisou da primeira `RunPython` do repo).

**Função geral da alteração** — `CreateModel` de `RitualDecision` com os 4 FKs `CASCADE`,
`decision` (choices), timestamps, e o `options.constraints` com os 2 CHECK *exactly-one*, o
CHECK do enum e as 4 `UniqueConstraint` parciais. `dependencies = [("bujo",
"0007_weekly_monthly_cycle_status")]`. Aplicada a `dev` e à branch Neon `e2e` antes do
Playwright.

## 3. Primitivas compartilhadas

### `backend/core/exceptions.py`

**Função geral do arquivo** — Exceções de domínio; `DomainError` → 409 pelo handler central.

**Função geral da alteração** — Nova `InvalidRitualDecision(DomainError)` (l.77). `+22 / -0`.
Docstring registra por que é exceção **nova** (não é `InvalidTransition` — o alvo pode estar
em `planning`; não é `CycleTargetConflict` — não é disputa pelo alvo único; é uma combinação
`(alvo, item, decisão)` que o produto não define) e que é também o erro devolvido quando o
item não existe no tenant, com mensagem **neutra** de propósito (não revelar linha alheia).

### `backend/bujo/services/cycles.py`

**Função geral do arquivo** — Ciclo de vida operacional de Weekly/Monthly (14.1).

**Função geral da alteração** — Promove 3 predicados a **públicos** para as fontes de ritual
consumirem — wrappers finos, **não** cópia da query. `+29 / -0`.

**Blocos principais**
- `previous_operational_weekly(*, user, week_start)` e `previous_operational_monthly(*,
  user, month_first)` (l.274/279): delegam a `_previous_operational(_WEEKLY|_MONTHLY,
  key=...)`. O comentário explica o risco de divergência: uma fonte que assumisse
  `week_start − 7 dias` mostraria "pronta para finalizar" enquanto Iniciar responderia 409
  (ciclo `NULL` intermediário contado por um lado e ignorado pelo outro).
- `has_undisposed(log)` (l.284): wrapper público de `_has_undisposed` — o **mesmo** predicado
  do gate de finalizar e do `readyToFinalize` que as fontes bloqueantes expõem.

## 4. Serviços

### `backend/bujo/services/rituals.py`

**Função geral do arquivo** — Módulo de serviço **novo** (NEW): decisões-snapshot + 7 fontes
dos rituais (AD-28 item 6; M06/M07). Funções de módulo, `@transaction.atomic` na escrita,
`user` keyword-only.

**Função geral da alteração** — Implementa a matriz de decisões, o upsert idempotente e as 7
fontes independentes (nenhuma função "todas as fontes"; a independência é estrutural, AC7).

**Blocos principais**
- Docstring do módulo: duas responsabilidades (decisão-snapshot × fontes), progresso
  **derivado na leitura**, e "nenhuma função materializa log" (`objects.filter(...).first()`,
  jamais `get_or_create_*_log` — guardrail da AC4 da 14.1, agora do lado da leitura).
- `ALLOWED_DECISIONS` (l.76): matriz única `decisão → (tipo de alvo, tipo de item)` — `keep`
  = (weekly, task), `skip_week` = (weekly, template), `keep_undated` = (monthly, task). As
  **ausências** são load-bearing (não existe `(monthly, template)` — "Não alocar neste mês"
  não existe para anual; não existe `keep` no Weekly anterior).
- `_exactly_one` (l.89): impõe exatamente-um alvo/item **antes** de tocar o banco (o CHECK é
  rede de segurança).
- `upsert_ritual_decision` (l.97): valida forma → consulta a matriz (`InvalidRitualDecision`)
  → resolve o log-alvo por `.filter().first()` (nunca materializa) e exige `status ==
  PLANNING` (senão `InvalidTransition`) → resolve o item pelo manager escopado (linha de
  outro tenant = inexistente → erro neutro). Idempotência real: mesma tupla + mesmo valor
  devolve **sem escrever** (`updated_at` intacto); mudança de decisão é `UPDATE` de 1 linha
  (hoje inalcançável, implementado por completude). `IntegrityError` da unique parcial é
  **corrida de upsert** → re-lê e devolve (não é `CycleTargetConflict`), com savepoint aninhado.
- `decisions_for_target` (l.181): `(por_task_id, por_template_id)` numa **única** query, para
  as fontes anotarem `decision` sem N+1.
- Envelope: `_bucket` (fora do progresso), `_envelope` (`eligible/pending/reviewed` sempre
  computados; `reviewed = pending == 0` → **vazio é revisado**), `_task_items`,
  `_undisposed_roots` (`parent_task__isnull=True`, `UNDISPOSED` importado de `archive.py`),
  `_by_day_then_undated` (`F("scheduled_date").asc(nulls_last=True)`),
  `_blocking_previous_source` (mecânica única das duas fontes bloqueantes — **não consulta
  decisão nenhuma**, correção A1), `_template_items`, `_partition_by_placement`.
- **Fontes semanais (M06):** `list_monthly_tasks_in_week` (fonte 1 — usa `months_of_week`
  para trazer **os dois** Monthly na virada; aceita `keep`), `list_weekly_recurring_candidates`
  (fonte 3 — todos os `weekly` ativos alfabéticos, `skip_week` sai de `pending` sem desativar,
  `already_placed` fora do progresso), `list_previous_weekly_pendings` (fonte 4 —
  **bloqueante**, via `previous_operational_weekly`), `list_pending_daily_groups` (fonte 5 —
  `log_date < week_start`, agrupada por data crescente, `groups` é a forma no fio; `items`
  é insumo das contagens e é deletado do envelope).
- **Fontes mensais (M07):** `list_monthly_recurring_candidates` (fonte 1 — `monthly` primeiro,
  depois `annual` elegíveis via `exclude(instances__monthly_log__month_first__year=...)`
  reusando a expressão de `RecurringTaskTemplateListView`; **regra de dezembro emergente**,
  zero `if month == 12`; `distinct=True` no `Count` por causa do segundo filtro sobre
  `instances`), `list_future_log_items` (fonte 2 — raízes do alvo, dia→sem-dia, aceita
  `keep_undated`, **exclui** sucessores cujo predecessor vive no monthly anterior via
  `exclude(migrated_from__monthly_log=previous)`), `list_previous_monthly_pendings` (fonte 3
  — **bloqueante**, gêmea da semanal).

**Comportamento de libs usadas**
- `months_of_week(week_start)`: devolve `set[tuple[int,int]]` com 2 elementos na virada.
- `Count("instances", filter=Q(...), distinct=True)`: contagem anotada por template.
- `transaction.atomic()` aninhado: savepoint que permite re-ler após `IntegrityError` sem
  quebrar a transação externa.

### `backend/bujo/services/density.py`

**Função geral do arquivo** — Módulo **novo** (NEW): densidade real de Weekly/Monthly (M06
L241 / M07 L299). Módulo por agregado (reusado pelas 14.5/14.6/14.10).

**Função geral da alteração** — `compute_week_density`/`compute_month_density`, com as regras
**opostas** às da listagem legada (`TaskDensityView`, intocado).

**Blocos principais**
- Docstring: dois contratos distintos coexistindo de propósito; densidade nova = **só
  materializado no container-alvo**, **inclui** subtarefas (sem `parent_task__isnull=True`),
  segmenta os 6 status, conta **registros, não linhagens**, grade completa + `undated`;
  aceita alvo em qualquer estado; nunca materializa.
- `UNDATED = "undated"` (chave própria — `scheduled_date IS NULL`).
- `_empty_cell()` (l.45): célula com as 6 chaves de `TaskStatus` sempre presentes (zeros
  explícitos, para distinguir "dia vazio" de "chave esquecida").
- `_fill(grid, log)` (l.55): uma query `.values("scheduled_date","status").annotate(count)`
  com `.order_by()` limpando o `Meta.ordering` (senão `order_index` quebraria o GROUP BY).
  Tarefa com `scheduled_date` fora do período é **ignorada** (paridade com `WeeklyLogView`,
  que esconde o mesmo registro — razão corrigida na review M3).
- `_envelope(grid, days)` (l.89): serializa dias + `undated` + total geral.
- `compute_week_density` (l.100): 7 dias + `undated`.
- `compute_month_density` (l.108): dias reais via `calendar.monthrange` (bissexto por
  construção, sem `if year % 4`).

## 5. Serializers

### `backend/bujo/serializers.py`

**Função geral do arquivo** — Serializers DRF do `bujo` (validam forma, não regra).

**Função geral da alteração** — Adiciona os serializers de decisão, o **envelope uniforme**
das fontes, os itens e a densidade. `+194 / -0`. Import de `RitualDecision`/`RitualDecisionKind`.

**Blocos principais**
- `RitualDecisionCreateSerializer`: corpo do POST (camelCase no fio via `CamelCaseJSONParser`);
  `validate()` exige **exatamente um** alvo e **um** item, `week_start` numa segunda,
  `month_first` no dia 1 — **forma é 400; a matriz de combinação é 409 no serviço** (distinção
  deliberada, §6.6).
- `RitualDecisionSerializer` de resposta: o alvo volta como **chave de período**
  (`weekStart`/`monthFirst` via `SerializerMethodField`), **não** o id opaco do log (correção
  M1); o item volta como `taskId`/`recurringTemplateId`.
- `_SourceEnvelopeSerializer` (base): `source_id`, `blocking`, `counts_toward_progress`,
  `eligible_count`, `pending_decision_count`, `reviewed`. **Sem campo `label`** (a cópia pt-BR
  é do UI).
- `RitualTaskItemSerializer`/`RitualTemplateItemSerializer`: `decision` vive **no item**, nunca
  no `TaskSerializer` (que é compartilhado por ~10 respostas legadas — mudaria contrato, AC8).
- `TaskSourceSerializer`, `BlockingTaskSourceSerializer` (+`ready_to_finalize`),
  `WeeklyRecurringSourceSerializer` (+`already_placed`), `MonthlyRecurringSourceSerializer`
  (+`already_placed_in_year`), `PendingDailiesSourceSerializer` (usa `groups`).
- `WeekSourceQuerySerializer`/`MonthSourceQuerySerializer`: `?week_start=`/`?month_first=` em
  **snake_case** (a camelização cobre corpo, não query string), validando segunda-feira/dia 1.
- Densidade: `DensityStatusBreakdownSerializer` (6 chaves sem underscore, então a camelização
  de saída não as altera), `DensityCellSerializer`, `DensityDaySerializer`,
  `DensityResponseSerializer`.

## 6. Views e URLs

### `backend/bujo/views.py`

**Função geral do arquivo** — Views DRF (`APIView`) do `bujo`. Views finas.

**Função geral da alteração** — 10 views novas (7 fontes + 2 densidades + POST de decisão),
uma por endpoint, **nenhum agregador**. `+179 / -0`. Importa os serviços de `rituals`/`density`
e os serializers novos.

**Blocos principais**
- `_WeekSourceView`/`_MonthSourceView`: bases finas (query serializer valida → serviço →
  serializer de resposta); só `service` e `response_serializer` variam.
- 7 views de fonte (`WeeklyMonthlyInWeekSourceView`, `WeeklyRecurringSourceView`,
  `WeeklyPreviousWeeklySourceView`, `WeeklyPendingDailiesSourceView`,
  `MonthlyRecurringSourceView`, `MonthlyFutureLogSourceView`,
  `MonthlyPreviousMonthlySourceView`), cada uma com `@extend_schema(parameters=..., responses=...)`.
- `WeeklyDensityView`/`MonthlyDensityView`: densidade real; docstring reforça que o legado
  `/api/bujo/task-density/` fica intocado e que **não** exigem alvo em planejamento.
- `RitualDecisionCreateView.post`: valida forma → `upsert_ritual_decision(**validated_data)`
  → 201. `InvalidRitualDecision`/`InvalidTransition` sobem como `DomainError` (409) pelo
  handler central, nenhuma tratada aqui.

### `backend/bujo/urls.py`

**Função geral do arquivo** — Roteamento do `bujo`.

**Função geral da alteração** — Importa as 10 views novas e adiciona **10 rotas** (kebab-case,
barra final, `name="bujo-ritual-..."`): `rituals/weekly/sources/{monthly-in-week,recurring,
previous-weekly,pending-dailies}/`, `rituals/weekly/density/`, `rituals/monthly/sources/
{recurring,future-log,previous-monthly}/`, `rituals/monthly/density/` e `ritual-decisions/`.
Comentário reforça: uma rota por fonte, sem agregador (independência estrutural, AC7).

## 7. Contrato gerado (produtores → consumidores)

### `schema.yaml`

**Função geral do arquivo** — OpenAPI gerado por `manage.py spectacular` (autoridade do
contrato; guardrail de CI compara com `types.gen.ts`).

**Função geral da alteração** — **Gerado**, não editado à mão. `+594 / -0`: os 10 paths novos
e os schemas de fonte/densidade/decisão. **Zero deleções** = aditividade estrita (prova
mecânica do AC8). Na review, `spectacular` regenerado bateu com o commitado.

### `frontend/src/api/types.gen.ts`

**Função geral do arquivo** — Tipos TS gerados a partir do `schema.yaml`
(`npm run generate-types`). **Nunca** editado à mão.

**Função geral da alteração** — **Gerado**. `+562 / -0`: tipos dos endpoints e envelopes
novos, zero deleções. `tsc --noEmit` limpo.

## 8. Obrigações de model tenant-scoped

### `backend/bujo/management/commands/purge_e2e_users.py`

**Função geral do arquivo** — Comando destrutivo que purga usuários de teste E2E; enumera
explicitamente os models tenant-scoped.

**Função geral da alteração** — Acrescenta `RitualDecision` ao import e a `TENANT_MODELS`.
`+16 / -...`. Comentário novo registra que a **ordem importa para o relatório** (não para a
corretude): `RitualDecision` referencia `Task`/logs por `CASCADE`, então é purgada **primeiro**
(da folha para a raiz) para que cada contagem seja honesta.

### `backend/bujo/tests/factories.py`

**Função geral do arquivo** — Factories (`factory_boy`) e registro do contrato de isolamento
compartilhado.

**Função geral da alteração** — `RitualDecisionFactory` nova (padrão `Params.user` +
`user_id = SelfAttribute("user.id")`) e `register_isolation_case("bujo.RitualDecision", ...)`
— o caso entra no contrato sem editar `conftest.py`.

## 9. Testes (por camada)

### `backend/bujo/tests/test_models.py`

**Função geral do arquivo** — Testes de model/constraint. `+152 / -0`.

**Função geral da alteração** — 8 funções novas + helper `_decisao_kwargs`: as 4 uniques
parciais (2ª linha do mesmo par → `IntegrityError`; pares diferentes coexistem; template;
alvo mensal), os 2 CHECK *exactly-one* (dois alvos/itens → erro), CHECK do enum, e a garantia
de que **nenhuma coluna de progresso** foi acrescentada.

### `backend/bujo/tests/test_services.py`

**Função geral do arquivo** — Testes de serviço. `+1031 / -0` (a maior mudança da story).

**Função geral da alteração** — ~40 funções novas (muitas parametrizadas): **matriz exaustiva**
`(decisão × alvo × item)` (3 legais / 9 ilegais, ilegal levanta e **não persiste**); alvo em
cada `status` (só `planning` passa); alvo inexistente não materializa; item de outro tenant
indistinguível de inexistente; **upsert idempotente provado em SQL** (helper `_sem_escrita`
da 14.1); **Task jamais tocada** (snapshot de todos os campos, não só `status`); CASCADE
apagando a decisão; elegibilidade das 7 fontes (os dois Monthly na virada, `already_placed`
fora do progresso, `skip_week` sem desativar, anterior **operacional** ignorando ciclos `NULL`,
`ready_to_finalize`, daily groups crescentes, anual saindo da elegibilidade por instância em
mês futuro do ano, **dezembro emergente**, Future Log não reapresentando sucessor migrado);
`decisions_for_target` em uma query; densidade (subtarefas contadas, 6 status, registros ≠
linhagens, sem projeção, fevereiro bissexto, só o container-alvo, log ausente → grade zerada);
**zero materialização** e isolamento por tenant.

### `backend/bujo/tests/test_views.py`

**Função geral do arquivo** — Testes de view/HTTP (DRF `APIClient`). `+600 / -0`.

**Função geral da alteração** — 21 funções novas: `401` sem token nos 10 endpoints;
`400` de forma (segunda-feira/dia 1, dois alvos, item ausente); `409` da matriz e do alvo
fora de `planning`; isolamento por tenant com Bearer real; envelope camelCase no fio;
`pending-dailies` usa `groups`; fontes bloqueantes expõem `readyToFinalize`; densidade com
`byStatus` de 6 chaves e todos os dias do mês; os dois buckets mensais no fio; POST
`keep_undated`/`skip_week` no fio (não cria Task nem desativa template); **laço do ritual no
fio** (decisão zera pendência sem mudar elegibilidade); fontes/densidades **recusam escrita**;
`/ritual-decisions/` **recusa leitura**; **caracterização da AC8** (as 9 respostas legadas
nomeadas mantêm o conjunto de chaves; `TaskSerializer` não ganhou `decision`).

### `backend/bujo/tests/test_serializers.py`

**Função geral do arquivo** — Testes de serializer (forma de fio). `+76 / -0`.

**Função geral da alteração** — 3 funções novas: `RitualDecisionCreateSerializer` exige
exatamente um alvo/item; envelope de fonte serializa **sem `label`** e com os 6 campos;
densidade serializa as 6 chaves de status **sem underscore** (camelização de saída não as altera).

### `backend/bujo/tests/test_purge_e2e_users.py`

**Função geral do arquivo** — Espelho de teste de `purge_e2e_users.py`. `+38 / -...`.

**Função geral da alteração** — `RitualDecision` acrescentada à lista espelho + função nova
`test_purge_apaga_decisoes_de_ritual` (purga efetiva de uma decisão).

## 10. E2E (Playwright)

### `frontend/e2e/countRitualContainers.ts`

**Função geral do arquivo** — Helper E2E novo (NEW): conta containers/decisões do usuário no
banco **real** da branch Neon `e2e`.

**Função geral da alteração** — `countRitualContainers(email)` roda `manage.py shell -c` com
`tenant_context` e devolve `{weekly, monthly, daily, decisions}`. A contagem tem que vir de
**fora do fio** porque contar pela API é impossível — `GET /api/bujo/logs/weekly/` faz
`get_or_create` de propósito (AC4 da 14.1). Mesma técnica dos seeds da 14.1; lê só a última
linha não-vazia (o `shell -c` imprime banner antes).

### `frontend/e2e/ritual-sources.spec.ts`

**Função geral do arquivo** — Spec E2E novo (NEW) — 3 testes contra o backend real da branch
Neon `e2e` (com a `0008` aplicada).

**Função geral da alteração** — Cobre o que só o fim-a-fim prova: (1) **AC7** — as 9 leituras
(7 fontes + 2 densidades) percorridas pelo ciclo de request completo **não materializam**
container nenhum (contagem via `countRitualContainers`), fonte vazia revisada,
`readyToFinalize: false` sem log anterior, grade completa/zerada; (2) **AC1/AC2/AC5** — laço
do ritual semanal (`keep` zera pendência sem mudar elegibilidade) + **upsert sob concorrência
real** (dois POSTs simultâneos convergem para **um** id — evidência do índice único parcial da
`0008` no Postgres de verdade); (3) **AC6/AC8** — a densidade nova conta a subtarefa que a
semana real mostra aninhada, mas na faixa `undated` (Achado 1), e o legado `/task-density/`
segue vivo com a chave de sempre. Usa `ritualApi` com JWT real e locators escopados (evita a
colisão com o `BrainDumpCaptureSheet` portalizado da 13.3). Asserção de zero erros de console.

---

**Nota:** nenhum comportamento de código-fonte foi alterado na produção deste relatório —
apenas leitura de `git status`/`git diff` e dos arquivos novos. Testes/gates não foram
re-executados aqui; as contagens e vereditos citados vêm do Dev Agent Record, do
test-summary do QA e da Senior Developer Review já registrados na story.
