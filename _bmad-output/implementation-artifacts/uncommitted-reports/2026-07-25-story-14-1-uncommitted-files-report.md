# Explicação dos arquivos não commitados — Story 14.1: Ciclos de vida de Weekly e Monthly (backend)

## Visão geral

A Story 14.1 é a **primeira story de código do Épico 14** (Onda 3 — Núcleo BuJo no
Sistema Novo) e é **backend puro** (Django/DRF): ela materializa no domínio o ciclo
de vida operacional dos logs Weekly e Monthly decidido na **AD-28** e nos spines
**M06/M07** do `EXPERIENCE.md`. Em vez de derivar "fechado" por conteúdo (regime do
Épico 4), o ciclo passa a ter **estado explícito persistido** — `planning → active
→ finalized`, mais a terceira semântica `NULL` (fora do regime operacional) — com
**gates de transição no serviço** e **unicidade garantida pelo banco** (índices
únicos parciais).

Peças centrais:

- Duas colunas idênticas (`status VARCHAR NULL`, `planning_completed_at TIMESTAMPTZ
  NULL`) + 6 constraints em `weekly_log` **e** `monthly_log` (`models.py`).
- A **primeira `RunPython` do repositório**: migration `0007` que adiciona schema e
  faz o **backfill retroativo** com contagens por bucket impressas pelo próprio
  `migrate` (aplicada a `dev` e à branch Neon `e2e`).
- Módulo de serviço novo `bujo/services/cycles.py`: matriz única `ALLOWED`, 9
  serviços idempotentes parametrizados por `_CycleSpec` (5 weekly + 4 monthly).
- `finalized` vira a autoridade de "ciclo fechado" (`is_cycle_closed`), fechando o
  buraco do ciclo **finalizado vazio** que a derivação por conteúdo não pegava.
- Dois endpoints de ação (`logs/weekly/cycle/`, `logs/monthly/cycle/`) + dois campos
  aditivos nas respostas de log; `schema.yaml` e `types.gen.ts` regenerados com
  **0 deleções** (prova mecânica de aditividade estrita — AC5).

**Único arquivo de frontend de produto tocado:** `frontend/src/api/types.gen.ts` —
**gerado**, nunca editado à mão. Não há UI nova (as Stories 14.5/14.6 a construirão).

**Verificação (rodada de verdade):** pytest full-suite **1099 passed** (1094 herdados
+ 5 novos após a code review; divisão derivada de `git diff`, nunca por subtração);
`ruff check` limpo; `tsc --noEmit` limpo. `ruff format --check` segue vermelho em 48
arquivos **pré-existentes** (dívida global, nenhum arquivo adicionado pela story).
E2E: 28 passed / 4 failed em `weekly-monthly-task-crud.spec.ts`, as 4 **verificadas
pré-existentes** no baseline `c2ba650` (locator `getByLabel('Título')` sem escopo
colide com o `BrainDumpCaptureSheet` portalizado da 13.3 — não é regressão).
Code review (story-automator): **Aprovada, 0 críticos**; 1 alto + 2 médios + 1 baixo,
todos corrigidos. sprint-status → `done`.

**Achado alto corrigido na review (A1):** `is_cycle_closed` aplicava a derivação por
conteúdo a **todo** ciclo, então dispor a última tarefa de um alvo `planning` (ou do
`active`) o tornava readonly e o mandava ao Arquivo **sem ritual** — contra M06/M07.
Corrigido para **um critério por regime**: `status` não-`NULL` fecha só por
`finalized`; `status IS NULL` (legado) segue pela derivação intacta.

**Total documentado: 33 arquivos** (19 modificados + 14 novos), excluindo este
próprio relatório.

## Ordem lógica de funcionamento

1. **Artefatos de planejamento/processo** — story, sprint-status, architecture (adendo
   as-built da AD-28), test-summary do QA, orquestração do story-automator, doc de ops.
2. **Modelo de dados + migration** — `models.py` (colunas/constraints/enum), migration
   `0007` (schema + backfill).
3. **Primitivas compartilhadas** — `core/calendar.py` (`month_turn_week`),
   `core/exceptions.py` (`CycleTargetConflict`).
4. **Serviços** — `services/cycles.py` (novo, produtor da lógica de transição),
   `services/archive.py` (`is_cycle_closed`), `services/tasks.py` (guardrail).
5. **Serializers** — 2 campos aditivos + 4 serializers de ciclo.
6. **Views + URLs** — 2 views de ação + 2 campos nas respostas + 2 rotas.
7. **Contrato gerado** — `schema.yaml`, `types.gen.ts` (consumidores do backend).
8. **Testes** — models, services, views, calendar, factories.
9. **E2E** — fixtures, seed, spec (consumidores de fim a fim).

---

## 1. Artefatos de planejamento e processo

### `_bmad-output/implementation-artifacts/14-1-ciclos-de-vida-de-weekly-e-monthly-backend.md`

**Função geral do arquivo** — Story spec da 14.1 (NEW, untracked). Contexto completo:
8 ACs, 8 Tasks, Dev Notes, Dev Agent Record, Senior Developer Review (AI) e File List.

**Função geral da alteração** — Documento de fonte da verdade da story. `Status: done`,
`baseline_commit: c2ba650`. Contém as evidências contratadas: saídas literais do
`migrate` em `dev` (weekly `finalized=4, active=3, active_materializado=0, null=7`;
monthly `2/3/2/6`) e na branch `e2e` (weekly `4/1/0/7`; monthly `2/1/0/6`), as provas
de não-vacuidade (4 experimentos), as contagens de teste derivadas e a review com os
achados A1/M1/M2/B1.

**Blocos principais** — ACs 1–8 (schema+unicidade, serviços idempotentes, monthly
sequencial+janela, materialização nunca atribui estado, contrato legado preservado,
`finalized` como autoridade, data migration com contagens, API exposta); Dev Notes com
o estado atual do código e as 5 ambiguidades resolvidas; Completion Notes por AC;
Senior Developer Review com a tabela de alegações re-executadas.

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Função geral do arquivo** — Fila e status do sprint (fonte da ordem mestre).

**Função geral da alteração** — `14-1-...: backlog → done` (linha 175) e `last_updated:
2026-07-24 → 2026-07-25` com um bloco de histórico anexado (transições
`in-progress → review → done`, resumo da review e dos gates). `epic-14` permanece
`in-progress`.

### `_bmad-output/planning-artifacts/architecture.md`

**Função geral do arquivo** — Decisões de arquitetura (AD-01…AD-29).

**Função geral da alteração** — Acrescenta ao fim da **AD-28** um **"Adendo as-built
2026-07-25 (Story 14.1 entregue)"** com 5 detalhes de contrato que só ficaram
determinados na implementação, para as Stories 14.5/14.6/14.10 não os re-derivarem:
(1) forma dos 2 endpoints de ação; (2) campos `status`/`planningCompletedAt` aditivos
nos GETs; (3) `closed` com **um critério por regime** (correção A1 da review);
(4) `CycleTargetConflict` distinta de `InvalidTransition`; (5) bootstrap de usuário
novo + precedência do backfill (`corrente → active`, `futuro → NULL`, `passado fechado
→ finalized`, resto → `NULL`) + "anterior operacional" no gate.

### `_bmad-output/implementation-artifacts/tests/test-summary-14-1.md`

**Função geral do arquivo** — Resumo do passo de QA (`bmad-qa-generate-e2e-tests`), NEW.

**Função geral da alteração** — Registra os frameworks usados (pytest+DRF, Playwright,
nenhum novo), as lacunas de automação fechadas (401/isolamento por tenant dos endpoints
novos, ciclo de vida do monthly por HTTP, AC4 em mês futuro), o spec E2E novo e o seed,
e a correção do `F841` do `ruff`. Baseline da story citada: 1086 passed.

### `_bmad-output/story-automator/` (8 arquivos de orquestração, NEW)

**Função geral** — Artefatos de estado/log do rito `bmad-story-automator` que conduz o
Épico 14 (não são código nem afetam runtime). São:

- `orchestration-14-20260725-024358.md` — documento de estado da orquestração
  (`status: IN_PROGRESS`, `currentStory: 14.1`, `storyRange: 14.1..14.10`).
- `agents/agents-orchestration-14-20260725-024358.md` — plano de agentes por story
  (create/dev/automate/review), JSON versionado 1.0.0.
- `complexity-orchestration-14-20260725-024358.json` — pontuação de complexidade por
  story (14.1 = Medium, score 5).
- `preflight-14-20260725-024313.md` e `preflight-14-20260725-023513.md` — snapshots de
  pré-voo (contagem de stories, complexidade, nota "14.0 already done").
- `policy-snapshots/20260725-024358-79b3b368.json` — snapshot da política vigente.
- `init-log-20260725-023247.md` e `init-log-20260725-024203.md` — logs de init do rito
  (uma linha cada).

**Nota de ordenação** — Os dois timestamps (`-023247`/`-023513` e `-024203`/`-024358`)
indicam **duas inicializações** do orquestrador na mesma data; ambos os conjuntos ficam
untracked. São artefatos de processo — incluí-los ou não no commit é decisão do dono.

### `docs/e2e-neon-reset.md`

**Função geral do arquivo** — Runbook da branch Neon `e2e` e do fallback Postgres local.

**Função geral da alteração** — A §"credencial da branch `e2e` stale" é reescrita: o
banner de topo passa a **RESOLVIDO em 2026-07-25** (a credencial atual é válida; a
`0007` foi aplicada por esse caminho), o sintoma é reposicionado como condicional
("quando a credencial expira") e o fallback local vira contingência ("Se a credencial
voltar a expirar") em vez de instrução ativa. Fecha o gap de documentação da Task 8.

## 2. Modelo de dados e migration

### `backend/bujo/models.py`

**Função geral do arquivo** — Models do app `bujo` (`Log`, `WeeklyLog`, `MonthlyLog`,
`Task`, etc.), todos sob `TenantModel` (UUID PK, `user_id` não-FK, `TenantManager`).

**Função geral da alteração** — Adiciona o **estado do ciclo** aos dois logs (AD-28
item 1), colunas **idênticas** por decisão.

**Blocos principais**
- `CycleStatus(models.TextChoices)` **no nível do módulo** (`PLANNING/ACTIVE/FINALIZED`)
  — aninhá-la em `Meta` a esconderia dos `CheckConstraint` (mesmo motivo de `TaskStatus`).
  Docstring: `NULL` é a 3ª semântica (fora do regime), sem valor `none` no enum.
- `_cycle_status_constraints(prefix)` — helper que **gera** as 3 constraints de uma
  tabela (CHECK de valores válidos + 2 uniques parciais `active`/`planning` por
  `user_id`). Extraído em vez de copiado para não criar dívida de gêmeos (lição 13.3/13.4).
- Em `WeeklyLog` e `MonthlyLog`: `Status = CycleStatus`, coluna `status` (com
  `# noqa: DJ001` justificado — `ruff` roda `select=["DJ"]` e DJ001 barra `null=True` em
  string), coluna `planning_completed_at` (timestamp, nunca booleano) e
  `*_cycle_status_constraints("weekly_log"|"monthly_log")` no `Meta.constraints`.

**Comportamento de libs usadas**
- `UniqueConstraint(fields=["user_id"], condition=Q(status=...))`: gera `CREATE UNIQUE
  INDEX ... WHERE ...` no Postgres — no máximo um `active` e um `planning` por usuário.
- `CheckConstraint(condition=Q(status__in=CycleStatus.values) | Q(status__isnull=True))`:
  aceita os 3 valores **ou** `NULL`. Usa `condition=` (Django ≥5.1; `check=` deprecado).

### `backend/bujo/migrations/0007_weekly_monthly_cycle_status.py`

**Função geral do arquivo** — Migration nomeada (NEW) — schema + data migration. É a
**primeira `RunPython` do repositório**.

**Função geral da alteração** — Adiciona as colunas/constraints e faz o **backfill
retroativo** dos ciclos existentes, com contagens por bucket impressas.

**Blocos principais**
- `current_key(*, kind, today)` (pura): segunda da semana / dia 1 do mês do período
  corrente.
- `classify_cycle_status(*, kind, key, today, derived_closed) -> str | None` (pura, é o
  ponto de teste): precedência **normativa** — corrente → `active`; **futuro → `None`
  independente de `derived_closed`**; passado fechado → `finalized`; resto → `None`.
- `_derived_closed_map(...)`: reimplementa localmente a derivação de fechado (`total>0`
  e `undisposed==0`, subárvore completa) — migrations não podem importar `services`.
  `UNDISPOSED = ("pending","started")` congelado como literal (não importar `bujo.models`).
- `_backfill_one(...)`: aplica os buckets aos logs de um usuário e **materializa** o
  ciclo corrente como `active` se ausente (`user_id=` à mão — model histórico não tem o
  `save()` de `TenantModel`).
- `backfill(apps, schema_editor)`: varre **só** os `user_id` presentes em
  `weekly_log`/`monthly_log`/`tasks` (AC7); em banco vazio (pytest) sai numa linha.
- `Migration.operations`: `AddField ×4 → AddConstraint ×6 → RunPython(backfill, noop)` —
  as uniques entram **antes** do backfill para que ele não possa gerar dois `active`.

**Comportamento de libs usadas**
- `apps.get_model(...)`: devolve models **históricos** sem `TenantManager` — queries
  não-escopadas, por isso a iteração é por usuário e sem `tenant_context`.
- `core.calendar.today_for` importado direto (guardrail de AST ignora `migrations/`).
- `migrations.RunPython.noop` no reverso: reverter dropa as colunas, nada a restaurar.

## 3. Primitivas compartilhadas (`core`)

### `backend/core/calendar.py`

**Função geral do arquivo** — Autoridade temporal única (`today_for`, `now`,
`week_start_of`, `weeks_of_month`, ...).

**Função geral da alteração** — Adiciona `month_turn_week(month_first) -> tuple[date,
date]`: a semana seg→dom que **contém a virada do mês** (`week_start_of(month_first)` até
`+6 dias`). Docstring deixa explícito que a janela é **informativa, nunca gate** e
devolve só `date`s puras (regra de porta: `core` não importa `bujo`).

### `backend/core/exceptions.py`

**Função geral do arquivo** — Exceções de domínio; `DomainError` → 409 pelo handler.

**Função geral da alteração** — Nova `CycleTargetConflict(DomainError)`: tradução da
colisão das uniques parciais (`IntegrityError` → 409), com docstring citando AD-28 item
2 e explicando por que **não** é `InvalidTransition` (é corrida perdida, não transição
ilegal). O docstring de `ClosedCycleReadOnly` é atualizado de `is_container_closed` para
`is_cycle_closed`.

## 4. Serviços

### `backend/bujo/services/cycles.py`

**Função geral do arquivo** — Módulo de serviço **novo** (NEW): o ciclo de vida
operacional de Weekly e Monthly (AD-28; M06/M07). Funções de módulo, `@transaction.atomic`
no serviço, `user` keyword-only.

**Função geral da alteração** — Implementa a matriz de transições e os 9 serviços
públicos, com Weekly/Monthly parametrizados por `_CycleSpec` (não duplicados).

**Blocos principais**
- `ALLOWED` (l.59-64): matriz única. `None→ACTIVE` **ausente é load-bearing** (fecha o
  bypass do ritual); `FINALIZED` terminal (conjunto vazio); `PLANNING→None` a única
  transição "para trás".
- `add_months(...)`, `_CycleSpec` (dataclass frozen com `model`, `key_field`,
  `next_planning_exists`), `_weekly_next_planning_exists` (qualquer semana posterior) e
  `_monthly_next_planning_exists` (exatamente o mês seguinte).
- Helpers privados: `_get`, `_status_of`, `_check_allowed` (impõe a matriz →
  `InvalidTransition`), `_previous_operational` (ignora ciclos `NULL` — evita o "ciclo
  órfão" do AC7), `_has_undisposed` (reusa `UNDISPOSED` de `archive.py`), `_save_status`
  e `_create_planning` (savepoint aninhado traduzindo `IntegrityError` →
  `CycleTargetConflict`).
- Transições genéricas: `_open_planning_target`, `_complete_planning` (não muda `status`,
  não re-timbra o timestamp), `_start` (3 gates cumulativos: data ≥ chave + planejamento
  concluído + anterior operacional `finalized`), `_finalize` (zero undisposed + próximo
  `planning` registrado). **Idempotência checada antes da matriz** (auto-transição = no-op).
- Serviços públicos Weekly (5): `open_weekly_planning_target` (rejeita alvo no passado),
  `complete_weekly_planning`, `start_weekly`, `finalize_weekly`,
  `cancel_weekly_planning_target` (só com zero tarefas; zera `status` **e**
  `planning_completed_at`).
- Serviços públicos Monthly (4, **sem cancel** — M07): `next_monthly_target` (alvo
  determinístico — precedência **`planning` existente → mês seguinte ao `active` → mês
  corrente**; a precedência do `planning` foi o achado M1 da review, restaura a
  idempotência na janela sem `active`), `open_monthly_planning_target` (sem parâmetro de
  data), `complete_monthly_planning`, `start_monthly`, `finalize_monthly`.

### `backend/bujo/services/archive.py`

**Função geral do arquivo** — Fechamento de ciclos e montagem do Arquivo (FR-1.10/1.13).

**Função geral da alteração** — Move a **autoridade de fechamento** para o estado
explícito, mantendo a derivação como fallback dos ciclos `NULL` legados.

**Blocos principais**
- Docstring do módulo reescrito: agora há **dois critérios** (estado explícito +
  derivação), escolhidos **por regime**, e a antiga filosofia "fechamento sempre
  COMPUTADO" deixou de valer para o regime operacional.
- `is_cycle_closed(log)` (novo): se `log.status` não-`NULL` → fecha sse `FINALIZED`;
  se `NULL` → `is_container_closed(log)` (intacta). É a autoridade que os consumidores
  chamam.
- `_CLOSED_BY_EITHER = Q(status=FINALIZED) | Q(status__isnull=True, total__gt=0,
  undisposed=0)` — o mesmo critério-por-regime em SQL; ramos mutuamente exclusivos, união
  sem duplicata sem `distinct()`. **Correção A1 da review:** o `status__isnull=True` no
  ramo derivado impede fechar acidentalmente ciclos `planning`/`active`.
- `list_closed_cycles(*, user)`: os dois `filter(total__gt=0, undisposed=0)` viram
  `filter(_CLOSED_BY_EITHER)`. `is_container_closed` fica **intacta** (fallback).

### `backend/bujo/services/tasks.py`

**Função geral do arquivo** — Serviços de tarefa (create/update/delete/reorder).

**Função geral da alteração** — `_check_container_open` passa a usar `is_cycle_closed`
(não `is_container_closed`): fecha o buraco do ciclo `finalized` **vazio**, que a
derivação devolvia como aberto (`total==0`). Import trocado. **`reorder_task` passa a
chamar `_check_container_open`** (l.128), que antes não cobria — AC6 nomeia as 4 mutações
(`create/update/delete/reorder`). Docstrings atualizados explicando ambas as mudanças.

## 5. Serializers

### `backend/bujo/serializers.py`

**Função geral do arquivo** — Serializers DRF do `bujo` (validam forma, não regra).

**Função geral da alteração** — Adiciona os campos aditivos de ciclo e os serializers dos
endpoints novos, **preservando `closed`** (AC5).

**Blocos principais**
- `_CycleFieldsMixin` (metaclass `SerializerMetaclass`): `status` (CharField
  `allow_null`) + `planning_completed_at` (DateTimeField `allow_null`). Herdado por
  `WeeklyLogSerializer` e `MonthlyLogSerializer` (que mantêm `closed`).
- `WEEKLY_CYCLE_ACTIONS` (5) e `MONTHLY_CYCLE_ACTIONS` (4, **sem** `cancel_planning_target`
  — ausência é regra de produto, M07).
- `WeeklyCycleActionSerializer`/`MonthlyCycleActionSerializer`: `action` (`ChoiceField`),
  chave opcional (`week_start`/`month_first`); `validate()` exige segunda-feira/dia 1 e
  torna a chave obrigatória para toda ação **exceto** `open_planning_target`.
- `WeeklyCycleSerializer`/`MonthlyCycleSerializer` de resposta (herdam o mixin); o monthly
  acrescenta `regular_window_start`/`regular_window_end` (janela da virada, informativa).

## 6. Views e URLs

### `backend/bujo/views.py`

**Função geral do arquivo** — Views DRF (`APIView`) do `bujo`. Views finas.

**Função geral da alteração** — 2 views de ação de ciclo + os 2 campos aditivos nas
respostas de log.

**Blocos principais**
- Imports: 9 serviços de `cycles`, `is_cycle_closed` (substitui `is_container_closed`),
  `month_turn_week`.
- `WeeklyLogView.get`/`MonthlyLogView.get`: `closed` passa a usar `is_cycle_closed`; o
  dict de resposta ganha `status` e `planning_completed_at` **lidos direto do log** —
  nenhum serviço de ciclo é chamado e nenhum estado é atribuído (AC4).
- `WEEKLY_CYCLE_SERVICES`/`MONTHLY_CYCLE_SERVICES`: dicts módulo-level `action → serviço`.
- `WeeklyCycleView.post`: valida via serializer, resolve `week_start` (default = semana
  corrente), despacha para o serviço, devolve `{weekStart, status, planningCompletedAt}`.
- `MonthlyCycleView.post`: `open_planning_target` chama o serviço **sem** `month_first`
  (alvo determinístico); computa a janela via `month_turn_week` e devolve os 5 campos.
  Sem `atomic` e sem regra de transição na camada HTTP.

### `backend/bujo/urls.py`

**Função geral do arquivo** — Roteamento do `bujo`.

**Função geral da alteração** — Importa `WeeklyCycleView`/`MonthlyCycleView` e adiciona
`logs/weekly/cycle/` (`bujo-weekly-cycle`) e `logs/monthly/cycle/` (`bujo-monthly-cycle`).

## 7. Contrato gerado (produtores → consumidores)

### `schema.yaml`

**Função geral do arquivo** — OpenAPI gerado por `manage.py spectacular` (autoridade do
contrato; guardrail de CI compara com `types.gen.ts`).

**Função geral da alteração** — **Gerado**, não editado à mão. `+156 / -0`: dois paths
novos (`/api/bujo/logs/{weekly,monthly}/cycle/`) e os schemas de ação/resposta. **Zero
deleções** = aditividade estrita (prova mecânica do AC5). Na review, `spectacular`
regenerado bateu byte a byte com o commitado.

### `frontend/src/api/types.gen.ts`

**Função geral do arquivo** — Tipos TS gerados a partir do `schema.yaml`
(`npm run generate-types`). **Nunca** editado à mão.

**Função geral da alteração** — **Gerado**. `+141 / -0`: tipos dos endpoints e campos
novos, zero deleções. `tsc --noEmit` limpo.

## 8. Testes (por camada)

### `backend/bujo/tests/factories.py`

**Função geral do arquivo** — Factories (`factory_boy`) e registro do contrato de
isolamento compartilhado.

**Função geral da alteração** — Comentários vinculantes em `WeeklyLogFactory`/
`MonthlyLogFactory`: `status` **permanece no default `None`** (qualquer outro default
estouraria as uniques parciais em massa). Dois `register_isolation_case` novos
(`bujo.WeeklyLog`, `bujo.MonthlyLog`) — entram no contrato sem editar `conftest.py`.

### `backend/bujo/tests/test_models.py`

**Função geral do arquivo** — Testes de model/constraint. `+156 / -0`, **10 funções novas**.

**Função geral da alteração** — Constraints de ciclo (2º `active`/`planning` do mesmo
usuário → `IntegrityError`; `active` de dois usuários coexiste; status inválido barrado
pelo CHECK; `NULL` aceito) + testes puros de `classify_cycle_status`/`current_key` da
migration `0007` importados via `importlib.import_module` (nome começa com dígito).

### `backend/bujo/tests/test_services.py`

**Função geral do arquivo** — Testes de serviço. `+924 / -3`, **~43 funções novas**
(muitas parametrizadas).

**Função geral da alteração** — Bloco de ciclo: **matriz exaustiva** por `itertools.product`
sobre `(None, planning, active, finalized)` nos dois tipos (par ilegal levanta e **não
persiste**); idempotência dos 9 serviços com o helper `_sem_escrita` (achado M2 —
`CaptureQueriesContext` prova **zero** INSERT/UPDATE/DELETE na re-execução); gates de
Iniciar isolados; `finalize` bloqueado por `pending`/`started`/ausência do próximo
`planning`; irreversibilidade; `cancel` só com zero tarefas; alvo mensal determinístico +
dois meses pulados sequenciais; `_previous_operational` ignorando `NULL`; guardrails de
AC4; regressões da review (ciclo no regime com tudo disposto **não** é readonly;
`NULL` legado continua fechado; alvo mensal na janela entre finalizar/iniciar).

### `backend/bujo/tests/test_views.py`

**Função geral do arquivo** — Testes de view/HTTP (DRF `APIClient`). `+618 / -0`, **27
funções novas**.

**Função geral da alteração** — 200/400/409 dos endpoints de ciclo; `action` inválida →
400; 401 sem token; isolamento por tenant com Bearer real; ciclo de vida completo do
monthly por HTTP; gates e "sem lacuna" do monthly; idempotência no fio + AC4 na gravação
em mês futuro; **caracterização do AC5** — o conjunto de chaves das 9 respostas legadas é
o esperado **mais** os dois campos novos, e nada mais mudou (comparando o JSON de fio em
camelCase); regressões da review sobre `closed`/`/archive/`/`POST` no `active` disposto.

### `backend/core/tests/test_calendar.py`

**Função geral do arquivo** — Testes da autoridade temporal.

**Função geral da alteração** — Testa `month_turn_week`: casos parametrizados (mês que
começa na segunda; no domingo — janela começa no mês anterior; virada de ano; fevereiro
bissexto 2028) + propriedades (sempre seg→dom de 7 dias; sempre contém `month_first`;
devolve `date`s puras).

## 9. E2E (Playwright)

### `frontend/e2e/fixtures.ts`

**Função geral do arquivo** — Fixtures compartilhadas do Playwright.

**Função geral da alteração** — Exporta `E2E_PASSWORD` (o spec de ciclo precisa de JWT
real em `/api/accounts/token/`, porque os endpoints ainda não têm UI); `signUpAndLandOnToday`
passa a usá-la. Achado B1 da review: comentário órfão reordenado (a constante e seu
comentário vêm antes; o comentário de `signUpAndLandOnToday` volta a encostar na função).

### `frontend/e2e/seedFinalizedEmptyCycle.ts`

**Função geral do arquivo** — Seed E2E novo (NEW) — cria o cenário degenerado de um ciclo
`finalized` **vazio** (o caso que a derivação não representava).

**Função geral da alteração** — `seedFinalizedEmptyWeekly(email)`: roda `manage.py shell
-c` com `tenant_context`, materializa o `WeeklyLog` da semana corrente, força
`status="finalized"` com **zero tarefas** e devolve `{weekStart}`. Semeia direto (não pelo
ritual) porque chegar a `finalized` pela API exigiria um segundo ciclo em `planning`,
embaralhando a asserção do Arquivo. Mesma técnica de `seedClosedCycleScenario.ts`.

### `frontend/e2e/weekly-monthly-cycle.spec.ts`

**Função geral do arquivo** — Spec E2E novo (NEW) — 3 testes contra o backend real da
branch Neon `e2e` (com a `0007` aplicada).

**Função geral da alteração** — Cobre o que só o fim-a-fim prova: (1) **AC4** — navegar
Hoje→Semana→Mês→Futuro materializa logs com `status: null`, e reentrar no app com o regime
já conquistado não altera `status` nem o timestamp; (2) **AC1/AC2** — a unique **parcial**
do banco vira 409 na disputa de alvo, e `finalized` é terminal (re-finalizar = no-op 200;
`start`/`complete_planning`/`cancel` = 409); (3) **AC6** — ciclo `finalized` vazio aparece
no Arquivo e a página da semana fica readonly (sem affordance de escrita; `createWeeklyTask`
→ 409). Usa um `cycleApi` com JWT real e locators **escopados** (evita a colisão com o
`BrainDumpCaptureSheet` portalizado da 13.3). Asserção de zero erros de console.

---

**Nota:** nenhum comportamento de código-fonte foi alterado na produção deste relatório —
apenas leitura de `git status`/`git diff` e dos arquivos novos. Testes/gates não foram
re-executados aqui; as contagens e vereditos citados vêm do Dev Agent Record e da Senior
Developer Review já registrados na story.
