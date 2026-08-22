# Explicação dos arquivos não commitados — Story 14.5: Weekly Board e planejamento semanal no sistema novo (M06)

## Visão geral

A Story 14.5 é a **quinta story de código do Épico 14** (Núcleo BuJo no Sistema Novo) e é a
**maior story do épico até aqui** — o próprio [IR] a marcou como candidata a split ("Task Row
base + Weekly Board + ritual de planejamento numa story só, no caminho crítico") e a story
reconhece isso e opta por **três fases sequenciais em vez de dividir** (o próximo número de
chave, `14-6`, já pertence ao Monthly Board, e dividir exigiria renumerar 14.6–14.10 contra a
ordem mestre). O resultado é **63 arquivos** não commitados (27 modificados + 36 novos),
cobrindo:

- **Fase A — Fundação.** Tokens de componente (`taskRow`, `weeklyBoard`, `weeklyPlanning`,
  `panel`, `chip`, `domainIcon`) + catálogo fechado de ícones Phosphor (`taskStatusIcons.tsx`) +
  **nascimento da `TaskRowBase`** (a Task Row canônica de 5 colunas do sistema novo, revisão
  party-mode, UX-DR26) + **`TaskDetailCard`** (o detalhe canônico: categoria em radiogroup,
  Eisenhower em 2 checkboxes, footer Salvar/Mover/Cancelar/Excluir, navegação de linhagem
  intra-semana). O `TaskRow.tsx` legado e seus 5 consumidores (Daily, Monthly, Future, Arquivo,
  `WeeklyPage` de Arquivo) **não são tocados**.
- **Fase B — Weekly Board.** `WeeklyBoardPage.tsx` (rota `planner/week`, primeira substituição de
  `WeeklyPage.tsx` no sistema novo — que continua servindo só `archive/weekly/:weekStart`):
  grade 4×2 aprovada (Seg/Ter/Qua/Qui/Sex + weekend-stack em colunas + pool "Sem dia definido"
  sempre visível), recomposição wide/medium/tablet/compact, 6 filtros de status + "Ocultar não
  abertas" (globais, de sessão), criação contextual por painel, reordenação relativa dentro do
  dia. Um pequeno backend aditivo e **read-only** fecha 3 lacunas de leitura que a UI precisa
  (`GET /logs/weekly/cycle/` novo, `previousPeriodStart`, `week_start` no OpenAPI de
  `WeeklyLogView`).
- **Fase C — Ritual de planejamento.** `WeeklyPlanningPage.tsx` (rota nova
  `planner/week/planning`): três regiões (rail de fontes, lista de decisões, rail de contexto
  sticky), as 5 fontes do spine (`Monthly na semana`, `Monthly ampliado`, `Recorrentes`, `Weekly
  anterior`, `Daily pendentes`) carregando **independentemente**, matriz de ações autorizada e
  estável por fonte, seletor de destino por teclado (`1`–`7`/`0`+Enter), progresso derivado em 2
  dimensões, painel de verificação dos 3 gates de `Iniciar semana`, `Finalizar semana anterior`
  dentro do ritual.
- **Regressão E2E (AC9).** 4 specs de regressão atualizados (`weekly-monthly-task-crud`,
  `past-period-navigation`, `weekly-monthly-cycle`, `ritual-sources`) porque a nova composição
  quebra locators antigos (Select "Dia (opcional)" → criação contextual; links → botões no
  stepper), 2 specs E2E novos (`weekly-board.spec.ts`, `weekly-planning-ritual.spec.ts`) e 2 seeds
  ORM-puro novos — **mais 8 specs acrescentados no passo de QA** (reordenação, navegação de
  linhagem, `TaskDetailCard` inteiro contra o browser real, `Migrar para <dia>`, `Cancelar
  planejamento`, offline do ritual), que acharam e corrigiram um bug real de acessibilidade
  (`TaskDetailCard` sem nome acessível no `role="dialog"`, WCAG 4.1.2) e um falso-positivo de
  teste (`color-contrast` medido durante a transição do MUI `Fade`).

**Verificação (citada do Dev Agent Record, do passo de QA e da Senior Developer Review — não
re-executada na produção deste relatório):** `dev-story` fechou com pytest **1285 passed**
(1269 herdados + 16, backend aditivo, zero migration), Vitest **1223 passed/105 arquivos** (220
testes 100% novos em 16 arquivos), Playwright **27/27 passed** (5 specs), e **3 achados reais de
produto** corrigidos na própria Task 12 (cache stale na criação semanal por invalidação de chave
exata em vez de prefixo; `color-contrast` reprovado pelo axe porque `calc(1/opacity-do-
ancestral)` não desfaz opacidade herdada em CSS real; `TaskDetailCard` não respeitando semana
`finalized`). O passo de QA acrescentou 8 specs E2E (23 testes nos dois arquivos, antes 15) e
corrigiu 1 achado real de acessibilidade + 1 falso-positivo de teste. A review adversarial
(6 frentes paralelas) achou e corrigiu **1 CRÍTICO** (subtarefa da AC2 nunca implementada,
apesar de marcada `[x]`), **4 ALTOS** (controle de status vazando em semana `closed` legada;
radiogroup de categoria sem navegação por seta; ritual sem tratamento de falha/retry por item;
axe do ritual cobrindo só 2 das 5 faixas) e **6 MÉDIOS**, fechando com pytest **1287 passed**,
Vitest **1245 passed/105 arquivos**, Playwright **41/41 passed** (6 specs, 11.5min, branch Neon
`e2e`). `sprint-status.yaml` → `done`.

**Total documentado: 63 arquivos** (27 modificados + 36 novos), excluindo este próprio relatório.

## Ordem lógica de funcionamento

1. **Artefatos de planejamento/processo** — story spec, resumo do passo de QA, sprint-status,
   orquestração do story-automator.
2. **Backend — serviço** (`cycles.py`, `rituals.py`) → **serializers** (`serializers.py`) →
   **views** (`views.py`): a leitura aditiva e read-only de prontidão do ciclo (AC4).
3. **Contrato gerado** — `schema.yaml`, `types.gen.ts` (consumidores do backend).
4. **Backend — testes** (`test_services.py`, `test_views.py`).
5. **Frontend — primitivos compartilhados**: `shared/date/`, `shared/hooks/useKeyboardShortcuts`,
   `shared/design/tokens.ts` (tokens de componente novos).
6. **Frontend — camada de dados**: `api/keys.ts`, `features/bujo/types.ts`, `features/bujo/api.ts`,
   barrel `features/bujo/index.ts`.
7. **Frontend — roteamento/shell**: `app/router.tsx`, `shellRouting.ts`.
8. **Frontend — componentes canônicos**: `taskStatusIcons.tsx`, `TaskRowBase.tsx`,
   `TaskDetailCard.tsx`.
9. **Frontend — componentes do ritual semanal** (`features/bujo/components/weekly/`): lógica pura
   das fontes, painel diário/pool, menu de reordenação, rail de fontes, lista de decisões,
   seletor de destino, rail de contexto, guardrails de token.
10. **Frontend — páginas**: `WeeklyBoardPage.tsx`, `WeeklyPlanningPage.tsx`.
11. **E2E (Playwright)** — helpers/seeds/specs novos e os 4 specs de regressão atualizados.

---

## 1. Artefatos de planejamento e processo

### `_bmad-output/implementation-artifacts/14-5-weekly-board-e-planejamento-semanal-no-sistema-novo.md`

**Função geral do arquivo** — Story spec da 14.5 (NEW, untracked, ~750 linhas). Fonte da
verdade: `Status: done`, `baseline_commit: a0a3b5e`. 9 ACs, 12 Tasks em 3 Fases, Dev Notes
extensas (contratos de API linha a linha, matriz status×ciclo, 12 ambiguidades resolvidas, 9
lacunas de backend B1–B9 e como a story as resolve), Dev Agent Record, Senior Developer Review
(AI), Change Log e File List.

**Função geral da alteração** — Documento de contexto para toda a entrega. Registra
explicitamente que a story é candidata a split e por que não foi dividida (mecânica de chave do
`sprint-status.yaml`), documenta as **9 questões abertas para o dono** (nenhuma bloqueia a
implementação: `destination:'week'` sem `scheduledDate` cair na semana corrente em vez da
semana-alvo; reordenação sem drag; linhagem só intra-semana; histórico de `Tudo` não sobrevive a
reload; `Cancelar planejamento` não bloqueado por decisões no backend; sem "desfazer decisão";
`Monthly ampliado` materializa Monthly Logs; tarefa com `scheduledDate` fora da semana fica
invisível), e fecha com a Senior Developer Review completa (1 crítico + 4 altos + 6 médios,
todos corrigidos na mesma passagem).

### `_bmad-output/implementation-artifacts/tests/test-summary-14-5.md`

**Função geral do arquivo** — Resumo do passo de QA (`bmad-qa-generate-e2e-tests`) da 14.5 (NEW,
untracked). Artefato de processo/testing.

**Função geral da alteração** — Documenta as 8 lacunas de cobertura E2E que o `dev-story` deixou
(nenhum E2E abria o `TaskDetailCard` inteiro; reordenação sem spec; navegação de linhagem sem
prova contra DOM real; `Migrar para <dia>`; `Cancelar planejamento`; offline do ritual; pool
genuinamente vazio) e os **2 achados reais** que o passo revelou: (1) `TaskDetailCard` sem nome
acessível no `role="dialog"` — WCAG 4.1.2 — porque o MUI só repassa `aria-label` ao `Modal` raiz,
não ao `Paper` que carrega `role="dialog"` de fato; corrigido movendo o `aria-label` para
`slotProps.paper`; (2) falso-positivo de `color-contrast` do axe por medir o
`.MuiDialog-container` ainda em opacidade de transição do `Fade` do MUI (não o `.MuiDialog-paper`,
cuja opacidade já é 1), resolvido com o helper novo `waitForDialogSettled`. Tabela de gates:
`23/23 Playwright` isolado (3 rodadas até verde), `38/38` na regressão completa pós-correção.

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Função geral do arquivo** — Fila e status do sprint (fonte da ordem mestre).

**Função geral da alteração** — `14-5-...: backlog → done` (linha única, muito extensa) com o
histórico completo anexado ao valor: nota de que a entrada estava em `backlog` embora a story já
dissesse `ready-for-dev` (mesmo padrão já visto na 14.3 — `create-story` não sincroniza o
sprint-status), execução em 3 fases sem split de fato, os 3 achados reais da Task 12, o achado
extra só-de-teste (clique em "Esta Semana" travando 60s em viewport tablet porque o shell inicia
em rail colapsado), e os números de gate de cada etapa (`dev-story` → `automate` → `code-review`).
`epic-14` permanece `in-progress`.

### `_bmad-output/story-automator/orchestration-14-20260725-024358.md`

**Função geral do arquivo** — Documento de estado da orquestração `bmad-story-automator` que
conduz o Épico 14 (artefato de processo, não runtime).

**Função geral da alteração** — `currentStory: 14.4 → 14.5`; `lastUpdated` avançado de
`10:10:00Z` para `15:47:28Z`. A tabela de progresso marca 14.4 como totalmente fechada
(`git-commit = done`) e 14.5 como `create/dev/automate/review = done`, `git-commit in-progress`.
7 linhas de log anexadas: fechamento da 14.4, início da 14.5, `create-story` verificado, review
ciclo 1 PASS, `dev-story` done → review (Vitest 1223/1223, pytest 1285/1285, Playwright 27/27,
3 bugs reais corrigidos), `automate` (QA) done (+8 specs E2E, 1 bug de a11y corrigido), e
`code-review` done (1 crítico + 4 altos + 6 médios corrigidos; pytest 1287, Vitest 1245,
Playwright 41/41).

## 2. Backend — serviço (aditivo, read-only)

### `backend/bujo/services/cycles.py`

**Função geral do arquivo** — Serviço de ciclos de vida (Weekly/Monthly): transições, gates,
predicados de "anterior operacional". Funções de módulo, a maioria `@transaction.atomic`.

**Função geral da alteração** — Acrescenta **duas** funções privadas de suporte e **uma** função
pública (`weekly_cycle_readiness`), todas de leitura pura. `+57 / -0`. Nenhuma função existente
muda de assinatura ou comportamento.

**Blocos principais**
- `_cycle_snapshot(log) -> dict | None` (linhas ~291-300): projeção mínima de um `WeeklyLog`
  (`week_start`, `status`, `planning_completed_at`), ou `None` sem log — o bloco `active`/
  `planning` da resposta de `GET /logs/weekly/cycle/`.
- `weekly_cycle_readiness(*, user) -> dict` (linhas ~303-336): a leitura agregada. Busca `active`
  (`status=ACTIVE`) e `planning` (`status=PLANNING`) via `.first()` (sem `get_or_create`, sem
  escrita). Se há `planning`, computa os **3 gates de start** (`date_reached`,
  `planning_completed`, `previous_finalized`) reusando `_previous_operational` — o mesmo
  predicado que `start_weekly` já usa internamente, então painel (`GET`) e gate real (`POST`)
  **não podem divergir** por construção. Se há `active`, computa os **2 gates de finalize**
  (`no_open_tasks` via `_has_undisposed`, `next_planning_exists` via
  `_weekly_next_planning_exists`). Devolve os 4 blocos com `None` nos inexistentes.

**Funções, classes e importações específicas**
- `weekly_cycle_readiness`: fecha as lacunas B1–B4 das Dev Notes — sem este endpoint, o cliente
  não sabia qual semana está `active`/`planning`, qual dos 3 gates de `start` falhou (os 3 emitem
  `detail` byte-a-byte idêntico no 409) nem se o próximo Weekly já está em `planning` (2º gate de
  `finalize`).

### `backend/bujo/services/rituals.py`

**Função geral do arquivo** — Serviço das fontes dos rituais + decisões-snapshot (14.2/14.4).

**Função geral da alteração** — Adiciona `_period_start_of(log)` e o campo
`previous_period_start` ao envelope de `_blocking_previous_source`. `+19 / -0`. Nenhuma outra
fonte muda.

**Blocos principais**
- `_period_start_of(log)` (linhas ~260-270): `getattr(log, "week_start", None) or
  getattr(log, "month_first", None)` — nome **neutro** de propósito (Story 14.5, AC4) porque
  serve **as duas** fontes bloqueantes (`previous-weekly` → `week_start`; `previous-monthly` →
  `month_first`), no molde de `period_start` da fila unificada da 14.3.
- `_blocking_previous_source` (docstring ampliada + `previous_period_start=_period_start_of
  (previous)` no envelope, linha ~297): a razão de existir — `finalize` **exige** um alvo
  (`weekStart`), e derivá-lo por `week_start − 7 dias` está **errado** quando um ciclo `NULL`
  intermediário existe (`previous_operational_weekly` já pula esses ciclos; a aritmética não
  pularia). Provado em teste (`test_fonte_weekly_anterior_previous_period_start_ignora_ciclo_
  null_intermediario`).

## 3. Backend — serializers

### `backend/bujo/serializers.py`

**Função geral do arquivo** — Serializers DRF do app `bujo`.

**Função geral da alteração** — `+61 / -1`. Acrescenta 6 serializers novos (a projeção completa
de `GET /logs/weekly/cycle/`) + 1 campo aditivo em `BlockingTaskSourceSerializer` + 1 serializer
de parâmetro de query só para documentação OpenAPI.

**Blocos principais**
- `_WeeklyCycleSnapshotSerializer` (linhas ~202-207): `week_start`, `status`,
  `planning_completed_at` — o bloco `active`/`planning`.
- `WeeklyStartGatesSerializer` / `WeeklyStartReadinessSerializer` (linhas ~210-221): os 3
  booleanos de `start` + `allowed`/`target`/`gates`.
- `WeeklyFinalizeGatesSerializer` / `WeeklyFinalizeReadinessSerializer` (linhas ~224-235): os 2
  booleanos de `finalize`.
- `WeeklyCycleReadinessSerializer` (linhas ~238-248): compõe os 4 blocos com `allow_null=True`
  em cada um — a forma exata da resposta de `GET /logs/weekly/cycle/`. Docstring registra que
  "este serializer só projeta, nunca decide".
- `WeeklyLogQuerySerializer` (linhas ~251-257): `week_start` opcional — **só** para declarar o
  parâmetro no OpenAPI de `WeeklyLogView.get` (que hoje o omite, `query?: never` no tipo
  gerado); a validação/normalização real continua manual na view, sem mudança de comportamento.
- `BlockingTaskSourceSerializer.previous_period_start` (campo novo, linha ~601): `DateField
  (allow_null=True)`.

## 4. Backend — views

### `backend/bujo/views.py`

**Função geral do arquivo** — Views DRF (`APIView`) do `bujo`. Views finas (serviço → resposta).

**Função geral da alteração** — `+19 / -3`. Método novo `get` em `WeeklyCycleView`
(**mesma rota**, sem rota nova) + `@extend_schema(parameters=[...])` em `WeeklyLogView.get`.

**Blocos principais**
- Imports (linhas ~46-53): `WeeklyCycleReadinessSerializer`, `WeeklyLogQuerySerializer` e
  `weekly_cycle_readiness` acrescentados em ordem alfabética.
- `WeeklyLogView.get` (linha ~310): `@extend_schema(parameters=[WeeklyLogQuerySerializer],
  responses=WeeklyLogSerializer)` — só a declaração OpenAPI muda; o corpo do método (normalização
  manual de `week_start`) é intocado.
- `WeeklyCycleView.get` (linhas ~442-452, novo): `@extend_schema(responses=
  WeeklyCycleReadinessSerializer)`; `readiness = weekly_cycle_readiness(user=request.user);
  return Response(WeeklyCycleReadinessSerializer(readiness).data)`. Zero regra de domínio na
  view — toda a decisão vem do serviço.

**Comportamento de libs usadas**
- `@extend_schema(parameters=[...])`: aceita um serializer como fonte de parâmetros de query no
  OpenAPI gerado — usado aqui só para **documentar** um parâmetro que a view já aceitava
  manualmente, sem introduzir validação nova.

## 5. Contrato gerado (produtores → consumidores)

### `schema.yaml`

**Função geral do arquivo** — OpenAPI gerado por `manage.py spectacular` (autoridade do
contrato; guardrail de CI compara com `types.gen.ts`).

**Função geral da alteração** — **Gerado**, não editado à mão. `+142 / -1`: a operação `get`
nova em `/api/bujo/logs/weekly/cycle/` (`bujo_logs_weekly_cycle_retrieve`, resposta
`WeeklyCycleReadiness`), o parâmetro `week_start` acrescentado a `/api/bujo/logs/weekly/`, o
campo `previousPeriodStart` em `BlockingTaskSource`, e os 6 componentes de schema novos
(`WeeklyCycleReadiness`, `WeeklyStartGates`, `WeeklyStartReadiness`, `WeeklyFinalizeGates`,
`WeeklyFinalizeReadiness`, `_WeeklyCycleSnapshot`). A única deleção é a substituição do
comentário duplicado da descrição do `post` existente (texto reorganizado, não uma remoção de
componente). Regenerado via `spectacular` e comparado byte-a-byte contra o commitado na review —
idêntico.

### `frontend/src/api/types.gen.ts`

**Função geral do arquivo** — Tipos TS gerados a partir do `schema.yaml`
(`npm run generate-types`). **Nunca** editado à mão.

**Função geral da alteração** — **Gerado**. `+91 / -3` (a checagem do diff completo confirma
que as 3 deleções são os placeholders `get?: never`/`query?: never` virando tipos reais — **zero
deleção de componente**, coerente com o texto do Dev Agent Record que reporta `88/3`; a contagem
de `git diff --stat` inclui 3 linhas extras de docstring reformatada). `WeeklyCycleReadiness`,
`WeeklyStartGates(Readiness)`, `WeeklyFinalizeGates(Readiness)` e `_WeeklyCycleSnapshot` nascem
como novos tipos em `components['schemas']`; `bujo_logs_weekly_cycle_retrieve` nasce em
`operations`; `bujo_logs_weekly_retrieve.parameters.query` ganha `{ week_start?: string }`.
Nenhum consumidor legado foi tocado — os tipos novos alimentam exclusivamente
`frontend/src/features/bujo/types.ts` (seção 6).

## 6. Backend — testes

### `backend/bujo/tests/test_services.py`

**Função geral do arquivo** — Testes de serviço. `+257 / -0`.

**Função geral da alteração** — 12 funções `test_` novas (uma parametrizada em 3 casos + uma em
2), cobrindo `weekly_cycle_readiness` e `previous_period_start`.
- `test_readiness_sem_nenhum_ciclo_operacional_devolve_os_quatro_blocos_nulos` — caso base.
- `test_readiness_reflete_active_e_planning_com_os_tres_gates_de_start` — espelha o exemplo
  literal da AC4 (`active`+`planning` presentes, os 3 gates de `start` falham, `finalize`
  passa).
- `test_readiness_start_allowed_true_quando_os_tres_gates_passam` /
  `test_readiness_finalize_allowed_true_quando_os_dois_gates_passam` — casos irmãos positivos.
- `test_readiness_start_e_o_gate_real_nao_podem_divergir` (parametrizado, 3 gates isolados) e
  `test_readiness_finalize_e_o_gate_real_nao_podem_divergir` (parametrizado, 2 gates isolados) —
  **a prova central da AC4**: para cada gate isolado, a leitura (`weekly_cycle_readiness`) e a
  transição real (`start_weekly`/`finalize_weekly`, que levantam `InvalidTransition`) concordam.
- `test_readiness_e_leitura_pura_sem_escrita_nem_get_or_create` — usa `_sem_escrita` (molde da
  14.1) para provar `WeeklyLog.objects.count()` inalterado e nenhum INSERT/UPDATE/DELETE emitido.
- `test_fonte_weekly_anterior_previous_period_start_ignora_ciclo_null_intermediario` — o cenário
  que prova que `weekStart − 7` erraria o alvo (ciclo `NULL` entre o alvo e o `active`).
- `test_fonte_weekly_anterior_ausente_previous_period_start_e_none` /
  `test_fonte_monthly_anterior_previous_period_start_usa_month_first` — casos de borda e a gêmea
  mensal (`_blocking_previous_source` é compartilhada pelas duas fontes).

### `backend/bujo/tests/test_views.py`

**Função geral do arquivo** — Testes de view/HTTP (DRF `APIClient`). `+119 / -0`.

**Função geral da alteração** — 5 funções `test_` novas, cobrindo o contrato HTTP de
`GET /logs/weekly/cycle/` e o campo `previousPeriodStart` no fio.
- `test_get_weekly_cycle_sem_ciclo_nenhum_devolve_os_quatro_blocos_nulos` — 200 com os 4 blocos
  `null`.
- `test_get_weekly_cycle_devolve_os_quatro_blocos_no_fio_camelcase` — cenário completo via 4
  `POST`s reais (`open_planning_target` → `complete_planning` → `start` → novo
  `open_planning_target`), lendo o corpo camelCase esperado e confirmando que **repetir a
  leitura devolve exatamente o mesmo corpo** (nenhuma escrita no `GET`).
- `test_get_weekly_cycle_isolamento_entre_tenants_com_bearer_real` / `..._sem_autenticacao_
  retorna_401` — isolamento e auth.
- `test_fontes_bloqueantes_no_fio_expoem_previous_period_start` — o campo aditivo no fio,
  camelCase, para as duas fontes bloqueantes (`previous-weekly`/`previous-monthly`); mais um
  assert acrescentado ao teste pré-existente `test_fontes_bloqueantes_no_fio_expoem_ready_to_
  finalize` (`previousPeriodStart is None` sem anterior).

## 7. Frontend — primitivos compartilhados

### `frontend/src/shared/date/index.ts` (NEW) + `index.test.ts` (NEW)

**Função geral do arquivo** — A **implementação única** de helpers de data LOCAL do sistema
novo (Story 14.5, AC1/AC3), substituindo o que a Dev Notes chama de "a 7ª cópia" dos mesmos
cálculos ad-hoc espalhados em `WeeklyPage.tsx`, `WeekDaySelector.tsx`, `DayHeader.tsx`,
`MonthDensityCalendar.tsx` etc.

**Função geral da alteração** — Arquivo novo com 7 funções exportadas, todas puras e sem
`new Date()` sem argumento (Convenção #8: "hoje" nunca vem do cliente).

**Funções, classes e importações específicas**
- `isoOf(date)` / `parseLocalDate(iso)`: conversão `Date` local ↔ `"AAAA-MM-DD"` **sem** passar
  por UTC (`toISOString()` seria errado em fusos negativos).
- `addDaysIso(iso, days)`: soma dias (aceita negativo) por partes locais.
- `weekdayIndexOf(iso)` (público, usado pelo atalho "Migrar para `<dia>`" do ritual): índice
  0=segunda…6=domingo.
- `mondayIsoOf(iso)`: segunda-feira da semana — espelha `core.calendar.week_start_of`.
- `isoWeekNumber(iso)`: número da semana ISO-8601 real (algoritmo da quinta-feira), **distinto**
  de `weekPositionInMonth` abaixo.
- `weekPositionInMonth(weekStartIso)`: posição da semana no(s) mês(es), pela regra **do
  projeto** (AD-05: 1ª semana = a que contém o dia 1 — não ISO), devolvendo 1 ou 2 elementos
  (semana de virada).
- `formatDayLabel(iso, style)`: 3 estilos de rótulo pt-BR (`weekday`, `day-month`,
  `weekday-short-day`), usando `Intl.DateTimeFormat('pt-BR', ...)`.

**Testes** (17 casos) — incluem os **casos-âncora** citados nominalmente pelas Dev Notes
(`mondayIsoOf('2023-01-01') === '2022-12-26'`, já que 01/01/2023 era domingo) e a prova de que a
semana de virada pertence aos dois meses simultaneamente.

### `frontend/src/shared/hooks/useKeyboardShortcuts.ts` (NEW) + `.test.ts` (NEW)

**Função geral do arquivo** — Hook de atalho de teclado compartilhado (Story 14.5, Task 9),
extraindo a **5ª cópia** do mesmo guard já provado em `ShellLayout.tsx`, `AppLayout.tsx`,
`MigrationFlow.tsx` e `DailyPage.tsx`.

**Função geral da alteração** — `useKeyboardShortcuts(handlers, options?)`: registra um listener
`keydown` em `window`; ignora o atalho quando o alvo é `INPUT`/`TEXTAREA`/`contentEditable`
(campo editável) **ou** um modificador (`ctrl`/`meta`/`alt`) está pressionado — o molde
**completo** de `ShellLayout.tsx` (fecha a assimetria do guard incompleto de `AppLayout.tsx`, que
só guardava `B` contra modificador, não `[`). `options.enabled` desliga o listener inteiro (usado
pelo seletor de destino, que só precisa do atalho quando está aberto). Consumido só pelo
`WeeklyDestinationPicker` novo — as 4 cópias legadas permanecem intocadas.

### `frontend/src/shared/design/tokens.ts` (UPDATE) + `tokens.test.ts` (UPDATE)

**Função geral do arquivo** — Dados puros de design tokens do App Shell (sem React/MUI):
`spacing`, `radius`, `typography`, `breakpoints`, `mediaQueries`, `colorRoles`, `mineralLight/
Dark`, `shellCssVariables(mode)`.

**Função geral da alteração** — Acrescenta 6 blocos de tokens de **componente** (AC8, valores
literais do `DESIGN.md`) e as 12 variáveis `--ds-*` correspondentes em `shellCssVariables()`.
`+63 / -0`.

**Blocos principais**
- `taskRow` (linhas ~172-183): `minHeightPointer: '36px'`, `minHeightTouch: '48px'`, `padding`,
  `categoryBorderWidth: '3px'`, `statusIconSize: '20px'`.
- `weeklyBoard` (linhas ~185-197): `gap`, `weekdayMinWidth: '240px'`, `unscheduledMinWidth:
  '235px'`, `terminalOpacity: 0.58` — comentário registra que `terminalOpacity` nasce aqui (não
  em `taskRow`) porque a AC8 pede a CSS var **na Task Row**, não na grade.
- `weeklyPlanning` (linhas ~199-204): `sourceRail: '190px'`, `contextRail: '315px'`,
  `densityPosition: 'sticky'`.
- `panel` / `chip` / `domainIcon` (linhas ~206-232): tokens de painel/chip/ícone de domínio
  (`@phosphor-icons/react`, `weight: 'regular'`, `sizeDefault: '20px'`).
- 12 entradas novas em `structuralCssVariables` (linhas ~428-439): `--ds-task-row-min-height-
  pointer|-touch`, `--ds-task-row-category-border-width`, `--ds-task-row-status-icon-size`,
  `--ds-task-row-terminal-opacity`, `--ds-weekly-board-gap|-weekday-min-width|-unscheduled-min-
  width`, `--ds-weekly-planning-source-rail|-context-rail`, `--ds-panel-padding`,
  `--ds-chip-height`.

**Testes** (`tokens.test.ts`, +72 linhas): um bloco `describe` novo com 7 `it`s — os 6 valores
batendo com `DESIGN.md` mais o teste que prova "cada token de componente novo aparece em
`shellCssVariables`" (o precedente "token exportado antes de aplicado" que o arquivo já tinha).

## 8. Frontend — camada de dados

### `frontend/src/api/keys.ts` (UPDATE) + `keys.test.ts` (UPDATE)

**Função geral do arquivo** — Factory central de query keys do TanStack Query, padrão
`[escopo, entidade, discriminador, params?]`.

**Função geral da alteração** — `+7 / -0`. Acrescenta `bujo.weeklyCycle()` (chave fixa, sem
discriminador), `bujo.ritualWeeklySource(sourceId, weekStart)` e
`bujo.ritualWeeklyDensity(weekStart)`. `keys.test.ts` ganha 3 `it`s novos provando os 3 formatos
e que sourceId/weekStart diferentes geram chaves diferentes (invalidação seletiva depende disso).

### `frontend/src/features/bujo/types.ts` (UPDATE)

**Função geral do arquivo** — Re-exporta aliases de `components['schemas']` (gerado) para o
resto do `features/bujo/` nunca importar `types.gen` direto.

**Função geral da alteração** — `+37 / -0`. Acrescenta 16 re-exports (`WeeklyCycle`,
`WeeklyCycleAction`, `WeeklyCycleReadiness`, `TaskSource`, `BlockingTaskSource`,
`WeeklyRecurringSource`, `PendingDailiesSource`, `RitualTaskItem`, `RitualTemplateItem`,
`_TemplateBucket`, `DensityResponse`, `DensityDay`, `DensityCell`, `DensityStatusBreakdown`,
`RitualDecision`, `RitualDecisionCreate`, `DecisionEnum`) e declara **à mão** 3 uniões que o
gerador não estreita: `CycleStatus = 'planning' | 'active' | 'finalized' | null`,
`WeeklySourceId` (as 4 fontes com endpoint próprio) e `RitualDecisionKind = DecisionEnum`.

### `frontend/src/features/bujo/api.ts` (UPDATE) + `api.test.tsx` (UPDATE)

**Função geral do arquivo** — Hooks TanStack Query do domínio `bujo` (23 hooks pré-existentes).

**Função geral da alteração** — `+190 / -5`. Corrige a invalidação de
`useCreateWeeklyTaskMutation` (achado real da Task 12) e acrescenta 8 hooks novos + 1 helper de
invalidação compartilhado.

**Blocos principais**
- `useCreateWeeklyTaskMutation.onSuccess` (linha ~234): troca
  `invalidateQueries({ queryKey: keys.bujo.weeklyLog(variables.weekStart) })` (chave **exata** da
  data) por `invalidateQueries({ queryKey: ['bujo', 'weeklyLog'] })` (**prefixo**) — a view sem
  navegação explícita usa a chave sentinel `'current'`, que nunca bate com a data literal; sem o
  prefixo, criar tarefa vendo a semana corrente nunca atualizava a lista.
- `useMonthlyLogQuery(monthFirst, options?)` (linha ~279): ganha `options?.enabled` (default
  `true`) — a fonte `Monthly ampliado` do ritual só consulta **sob seleção** (o endpoint
  materializa Monthly Logs de propósito).
- `invalidateRitualQueries(queryClient)` (linha ~588, exportado): invalida os **5 prefixos** que
  qualquer ação do ritual pode afetar (`weeklyLog`, `weeklyCycle`, `ritualWeeklySource`,
  `ritualWeeklyDensity`, `taskDensity`) — garante que nenhum call site das Tasks 8-10 esqueça um
  alvo.
- `useRitualTaskTransitionMutation()` (linha ~602): reusa `transitionTask` mas **sem**
  `useOptimisticMutation` — a versão otimista escreve no cache de `todayLog`, errado para um item
  de qualquer fonte do ritual (Dev Notes, ambiguidade #4: "nenhuma mutação otimista nesta story").
- `useWeeklyCycleReadinessQuery` / `useWeeklyCycleActionMutation` (linhas ~618-637): `GET`/`POST`
  de `/api/bujo/logs/weekly/cycle/`; a mutação invalida por `onSettled` (não `onSuccess`) — cobre
  também o caso de 409.
- `useMonthlyInWeekSourceQuery` / `useWeeklyRecurringSourceQuery` / `usePreviousWeeklySourceQuery`
  / `usePendingDailiesSourceQuery` / `useWeeklyDensityQuery` (linhas ~640-720): um `useQuery` por
  fonte/endpoint, todos com `options?.enabled`, todos em query string **snake_case**
  (`{ week_start: weekStart }`) via `params`.
- `useRitualDecisionMutation()` (linha ~726): `POST /api/bujo/ritual-decisions/`, corpo em
  camelCase, invalidação pelos 5 prefixos em `onSettled`.

**Testes** (`api.test.tsx`, +305 linhas): describe blocks para cada hook novo, incluindo
`enabled: false` não consultando (`useMonthlyLogQuery`, `useMonthlyInWeekSourceQuery`), os 5
prefixos invalidados por `useWeeklyCycleActionMutation`/`useRitualDecisionMutation`, e "falha
preserva o item" (nenhuma escrita otimista de cache).

### `frontend/src/features/bujo/index.ts` (UPDATE, barrel)

**Função geral do arquivo** — Barrel público do domínio `bujo` — único ponto de import para
`pages/` (regra de fronteira ESLint: `features/<x>` nunca importa outra feature).

**Função geral da alteração** — `+30 / -0`. Exporta os 8 hooks novos + `invalidateRitualQueries`
+ os 3 componentes canônicos novos (`TaskRowBase`, `TaskDetailCard`,
`taskStatusIconFor`/`taskStatusIcons`/`TASK_STATUS_ICON_SIZE`) + os 20 tipos novos de
`types.ts` (incluindo os 3 estreitamentos manuais). `TaskRowBase`/`TaskDetailCard` saem pelo
barrel como **delta autorizado da AD-21** (componente de composição compartilhado entre
`pages/`).

## 9. Frontend — roteamento/shell

### `frontend/src/app/layout/shell/shellRouting.ts` (UPDATE) + `shellRouting.test.ts` (UPDATE)

**Função geral do arquivo** — Registro central de 24+ rotas com `{ routeId, shell,
surfaceMigrated }` — `surfaceMigrated: true` faz o `LegacySeamNotice` desaparecer só naquela
rota; `matchesPattern` exige igualdade de contagem de segmentos.

**Função geral da alteração** — `+7 / -1`. `planner/week` vira **a primeira superfície migrada**
(`surfaceMigrated: false → true`) e ganha uma entrada irmã `planner/week/planning` (segmentos
diferentes, precisa de registro próprio).

**Testes** — o teste antigo `test_estado_inicial_desta_story_shell_novo_em_tudo_e_nenhuma_
superficie_migrada` (que descrevia o estado da Story 13.1) é **renomeado e reescrito** para
`test_shell_e_novo_em_tudo_e_apenas_as_rotas_migradas_tem_surfaceMigrada_true`, com um `Set` de
exceções (`MIGRATED_ROUTE_IDS`); um segundo teste novo prova explicitamente que
`planner/week.surfaceMigrated === true`.

### `frontend/src/app/router.tsx` (UPDATE)

**Função geral do arquivo** — Definição central de rotas (`RouteObject[]`) consumida pelo
`createBrowserRouter`.

**Função geral da alteração** — `+16 / -2`. `planner/week` monta `WeeklyBoardPage` (não mais
`WeeklyPage`) com `handle: { title: 'Esta Semana' }` preservado; rota nova
`planner/week/planning` monta `WeeklyPlanningPage` com `handle: { title: 'Planejar a semana' }`.
`WeeklyPage` continua importada (serve `archive/weekly/:weekStart`, intocada).

## 10. Frontend — componentes canônicos

### `frontend/src/features/bujo/components/taskStatusIcons.tsx` (NEW) + `.test.tsx` (NEW)

**Função geral do arquivo** — Catálogo **fechado** de ícones Phosphor por status (AC2/AC8), no
molde literal de `app/layout/shell/navIcons.tsx`.

**Função geral da alteração** — Arquivo novo, 50 linhas. `TASK_STATUS_ICON_SIZE = 20`;
`STATUS_LABEL: Record<TaskStatus, string>` reusado **nominalmente** do legado
(`TaskRow.tsx:28-35`, não reescrito de memória); `taskStatusIcons: Record<TaskStatus, Icon>`
(`pending→Circle`, `started→HourglassMedium`, `completed→CheckCircle`, `cancelled→XCircle`,
`migrated→ArrowRight`, `postponed→ArrowLineRight`); `taskStatusIconFor(status, weight?)` —
resolvedor que **degrada sem ícone** (retorna `null`) para status desconhecido, nunca derruba a
linha.

**Testes** (5 casos): catálogo cobre exatamente os 6 status, tamanho canônico, rótulos
reusados, degradação para status desconhecido, `weight: 'fill'` repassado.

### `frontend/src/features/bujo/components/TaskRowBase.tsx` (NEW, 408 linhas) + `.test.tsx` (NEW, 326 linhas)

**Função geral do arquivo** — A Task Row **base** do sistema novo (AC2, UX-DR26) — **nasce
nesta story**. Comentário de cabeçalho documenta explicitamente: (a) é a base que toda superfície
migrada reusa a partir do Épico 14; (b) o `TaskRow.tsx` legado continua intocado e serve os 5
consumidores atuais até o Épico 17; (c) quais eixos o Épico 17 especializa (variantes de
densidade, o slot `trailingSlot`, o indicador de `waitingOn` — deliberadamente ausente aqui).

**Função geral da alteração** — Componente novo completo.

**Blocos principais**
- `NEXT_STATUS` (linha ~32): cicla **só** os 3 status operáveis por clique
  (`pending→started→completed→pending`) — `migrated`/`postponed` nunca nascem de clique (AD-02).
- `TERMINAL_OPACITY_STATUSES` (linha ~47): `completed`/`cancelled`/`migrated`/`postponed` —
  grupo de-enfatizado **diferente** do "terminal na origem" do backend. Comentário registra o
  achado real de produto da Task 12: a opacidade reduzida só se aplica a elementos com **fundo
  opaco próprio** (ícone, badge Eisenhower), nunca ao título/descrição — CSS não permite um filho
  desfazer a opacidade acumulada de um ancestral via `calc(1/x)`.
- `isStatusCycleControl(status, readonly)` (linha ~77): a matriz status×ciclo — recebe o
  booleano `readonly` **já resolvido** (não `cycleStatus` puro), correção do achado ALTO da
  review (um `closed` legado, `status IS NULL`, deixava o ícone clicável antes da correção).
- Efeitos (linhas ~123-161): descoberta de sucessor no DOM (`document.querySelector
  ('[data-task-id=...]')` — sucessor na semana carregada = sucessor no DOM, sem lookup de rede);
  listener do evento customizado `bujo:lineage-highlight` (o "farol" que a origem dispara);
  encerramento do destaque por timer (2000ms) **ou** pela primeira interação/foco.
- `handleLineageClick` (linha ~170): `scrollIntoView` (instantâneo sob `prefers-reduced-motion`),
  dispara o evento customizado, move o foco.
- Render (linhas ~191-408): grade de 5 colunas (`--ds-task-row-status-icon-size` — não um
  literal separado, correção do achado MÉDIO da review — `28px` `minmax(0,1fr)` `auto` `24px`),
  variante `compact` reduz para 2 colunas; célula de status como `<button>` (controle),
  `role="img"` (conteúdo semântico) ou controle de linhagem conforme a matriz; recursão de
  subtarefas; `role="status" aria-live="polite"` oculto para anúncios.

### `frontend/src/features/bujo/components/TaskDetailCard.tsx` (NEW, 482 linhas) + `.test.tsx` (NEW, 481 linhas)

**Função geral do arquivo** — O detalhe canônico da Task Row (AC2, UX-DR26): Categoria como
`role="radiogroup"` visual (7 `role="radio"`), Eisenhower como 2 checkboxes reais derivando o
enum combinado, footer com a hierarquia Salvar/Mover/Cancelar/Excluir, semântica de `Enter`
completa.

**Função geral da alteração** — Componente novo completo (+ subtarefa adicionada na review —
achado CRÍTICO: a UI de criação de subtarefa estava marcada `[x]` na story mas não existia no
arquivo original).

**Blocos principais**
- `toggleUrgent`/`toggleImportant` (linhas ~50-60): derivação pura do enum `none|u|i|ui` a
  partir de 2 booleans independentes — nunca 2 estados soltos.
- Estado local (linhas ~97-106): rascunho de `title`/`description`/`category`/`eisenhower` +
  `subtaskDraft`; `categoryRefs` para o roving tabindex.
- `handleSaveAndClose` (linha ~111): valida título não-vazio, bloqueia se já há escrita em
  andamento, `updateTask.mutate(...)` com **um único PATCH**; `onError` preserva o rascunho e
  mostra "Não foi possível salvar. Tente novamente." (fechamento explícito descarta; falha
  preserva — ambiguidade #7 resolvida).
- `handleTitleKeyDown`/`handleContainerKeyDown` (linhas ~136-150): Enter simples no Título
  salva-e-fecha; `Ctrl/Cmd+Enter` de **qualquer** campo salva-e-fecha (tratado no container, com
  guard para não disparar os dois).
- `handleAddSubtask`/`handleSubtaskKeyDown` (linhas ~152-167): `createSubtask.mutate(...)`, Enter
  adiciona — o formulário novo da correção CRÍTICA da review.
- `handleCategoryKeyDown` (linhas ~174-187): roving tabindex do radiogroup — `ArrowRight/Down`
  avança, `ArrowLeft/Up` recua, **com wrap** nas duas pontas — correção do achado ALTO da review
  (antes só a opção selecionada era alcançável por teclado).
- `handleCancel`/`handleDelete` (linhas ~189-203): `Cancelar tarefa` = `POST /tasks/{id}/
  transition/ { toStatus: 'cancelled' }`; `Excluir` = `DELETE /tasks/{id}/` — **dois serviços
  distintos**, de propósito.
- Render (linhas ~205-436): `<Dialog>` do MUI com `aria-label` em `slotProps.paper` (**não** na
  prop direta do `Dialog`) — a correção do achado do passo de QA (WCAG 4.1.2: o MUI só repassa
  `aria-label` direto ao `Modal` raiz, não ao `Paper` que carrega `role="dialog"`); campos
  desabilitados quando `readonly`; footer condicionado a `!readonly` (ausente, não `disabled`).
- `CategorySwatch` (linhas ~438-482): sub-componente do radio individual —
  `role="radio"`/`aria-checked`/`aria-disabled`, `tabIndex` roving (`0` só no selecionado), `ref`
  como prop normal (React 19, sem `forwardRef`).

**Comportamento de libs usadas**
- MUI `<Dialog slotProps={{ paper: {...} }}>`: `slotProps.paper` repassa props direto ao
  componente `Paper` interno (que carrega `role="dialog"`), diferente de props no nível do
  `Dialog` (que só alcançam o `Modal` raiz) — a causa exata do bug de acessibilidade encontrado.

## 11. Frontend — componentes do ritual semanal (`features/bujo/components/weekly/`)

### `weeklyRitualSources.ts` (NEW, 153 linhas) + `.test.ts` (NEW, 158 linhas)

**Função geral do arquivo** — Lógica **pura** (sem React) das 5 fontes do ritual: normalização
de forma e a matriz de ações autorizadas.

**Função geral da alteração** — Módulo novo, consumido por `WeeklySourceRail`,
`WeeklyDecisionList` e `WeeklyPlanningPage`.

**Funções, classes e importações específicas**
- `WEEKLY_RITUAL_SOURCE_ORDER`/`_LABEL` (linhas ~23-39): a ordem fixa das 5 fontes.
- `WEEKLY_RITUAL_SOURCE_ACTIONS` (linha ~63): o conjunto **autorizado e estável** por fonte —
  `keep` só em `monthly-in-week`, `skip_week` só em `recurring`; as demais fontes só mutação. É o
  guardrail textual da mesma armadilha do achado A1 da Story 14.2 (a matriz do backend casa só
  *tipos*, aceitaria um `keep` de qualquer fonte com Task).
- `normalizeTaskItems`/`normalizeTemplateItems`/`normalizePendingDailyGroups`/`normalizeSource`
  (linhas ~92-140): unificam `RitualTaskItem`/`RitualTemplateItem`/`PendingDailyGroup` numa forma
  única (`NormalizedRitualItem`).
- `itemsForView(items, view, mutatedThisVisit)` (linha ~146): `Pendentes` filtra
  `decision === null`; `Tudo` une o durável (`decision !== null`) com o efêmero (mutado nesta
  visita, só em memória).

### `WeeklyTaskPanel.tsx` (NEW, 182 linhas) + `.test.tsx` (NEW, 196 linhas)

**Função geral do arquivo** — Painel diário/pool do Weekly Board (AC1/AC7) — **um único**
componente serve os 7 dias e o pool (a diferença é só `scheduledDate: null` vs. data real).

**Função geral da alteração** — Componente novo. `<section aria-label={regionLabel}>` com
header (nome do dia + `openCount` "N abertas", excluindo terminais) + lista de `TaskRowBase` (com
`Nenhuma tarefa.` se vazio — **nunca condicional**, o pool sempre renderiza) + formulário de
criação contextual escopado (`aria-label` próprio, não colide entre painéis). `dayLinkHref`
(painéis de dia) navega ao Daily Log via `<RouterLink>`; a Task Row abre o detalhe — **alvos
separados**.

### `WeeklyRowOverflowMenu.tsx` (NEW, 76 linhas) + `.test.tsx` (NEW, 76 linhas)

**Função geral do arquivo** — Comando relativo de reordenação (Task 7, lacuna B5): sem drag
entre dias.

**Função geral da alteração** — `IconButton` (`DotsThreeVertical`) abre um `<Menu>` com "Mover
acima" (irmão anterior, `position: 'before'`, `disabled` se for o primeiro), "Mover abaixo"
(irmão seguinte, `position: 'after'`, `disabled` se for o último) e "Mover para…" (abre o
`MoveTaskDialog` já provado no legado, reusado sem alteração).

### `WeeklySourceRail.tsx` (NEW, 80 linhas) + `.test.tsx` (NEW, 79 linhas)

**Função geral do arquivo** — `<nav aria-label="Fontes do planejamento">` com as 5 fontes na
ordem fixa (AC5).

**Função geral da alteração** — Cada fonte é um botão com `aria-current` (ativa),
`aria-busy` (carregando — **não** desabilita as outras), contagem (`entry.pendingCount`, ou
"erro"), e subtítulo opcional. `monthly-expanded` mostra "opcional", nunca número.

### `WeeklyDecisionList.tsx` (NEW, 273 linhas) + `.test.tsx` (NEW, 400 linhas)

**Função geral do arquivo** — A lista de decisões da fonte **ativa** (AC5) — o conjunto de ações
completo e estável (`WEEKLY_RITUAL_SOURCE_ACTIONS`), toggle Pendentes/Tudo, continuidade de foco.

**Função geral da alteração** — Componente novo, o mais denso do ritual.

**Blocos principais**
- Continuidade de foco (linhas ~74-89): `useEffect` reage a `items` mudar — se o item agido
  (`lastActed`) sumiu (decisão persistida), foca a próxima pendência na **mesma posição**, ou o
  heading da fonte ao esgotar.
- `actOn`/`chooseDestination`/`allocate` (linhas ~91-105): guardam contra `offline` (clique
  simplesmente não roda — defesa em profundidade além do `aria-disabled`).
- Render (linhas ~111-273): agrupamento por `groupLabel` só quando `sourceId === 'pending-
  dailies'` (a única fonte com `groups`); os botões de ação são condicionados por
  `actions.includes(...)`; `itemErrors`/`onRetryItem` — mensagem de falha **por item**, com
  "Tentar novamente" (achado ALTO da review: nenhuma decisão tinha tratamento de falha antes);
  seção `alreadyPlaced` (só `recurring`) sempre visível, fora do progresso.

### `WeeklyDestinationPicker.tsx` (NEW, 208 linhas) + `.test.tsx` (NEW, 213 linhas)

**Função geral do arquivo** — Seletor de destino do ritual (AC5/Task 9): 8 alvos (`1`–`7` + `0`),
teclado, confirmação nomeada sem modal adicional.

**Função geral da alteração** — Componente novo, consome `useWeeklyDensityQuery` e
`useKeyboardShortcuts`.

**Blocos principais**
- `selectTarget`/`confirm` (linhas ~53-62): `0` (Sem dia) só arma se `isCurrentWeek` — a UI que
  materializa a lacuna B7 (`migrate` com `destination:'week'` sem `scheduledDate` cairia na
  semana corrente, não na semana-alvo).
- `shortcutHandlers` (linhas ~64-70): `1`-`7` selecionam por índice, `0` seleciona "Sem dia",
  `Enter` confirma, `Escape` fecha — todos via `useKeyboardShortcuts`.
- `confirmationLabel()` (linha ~72): gera o texto nomeado (`"Migrar para quarta, 22 jul."`).
- Render (linhas ~78-208): `role="dialog"`; 8 `role="radio"` com contagem de densidade por dia
  (`density.data?.days[index]?.total`); alvo `0` com `aria-disabled`+motivo acessível quando
  indisponível; `error` prop (achado ALTO da review: falha na confirmação agora mostra motivo sem
  fechar o seletor); compact renderiza em `<Drawer>` reaplicando `shellCssVariables()` no `paper`
  **e** no `backdrop`.

### `WeeklyContextRail.tsx` (NEW, 322 linhas) + `.test.tsx` (NEW, 409 linhas)

**Função geral do arquivo** — Rail de contexto do ritual (AC3/AC5/AC6): densidade (8 faixas),
progresso derivado (2 dimensões), avisos, ações do ciclo.

**Função geral da alteração** — Componente novo, o segundo mais denso.

**Blocos principais**
- Snapshot de progresso (linhas ~61-81): `nextSnapshot` cresce (nunca retrocede) quando um item
  novo aparece numa fonte — derivação pura por render (`Math.max` implícito), sem `useEffect`
  (idempotente, seguro contra loop). `decidedCount = totalSnapshot − totalPending`.
- Densidade (linhas ~89-139): 8 faixas (7 dias + `undated`), cada botão chama `onSelectDay` — "a
  densidade escolhe destino, não abre inspeção" (AC6).
- Progresso (linhas ~141-165): 2 `role="progressbar"` (`Fontes revisadas`/4, `Itens decididos`/
  snapshot), com `aria-valuenow`/`aria-valuemax`/`aria-valuetext`.
- Avisos (linhas ~167-208): fontes não-bloqueantes pendentes navegam ao clicar; `Weekly anterior`
  (bloqueante) usa `role="alert"` distinto por semântica e cor; ao zerar, vira "pronta para
  finalizar".
- Ações do ciclo (linhas ~210-310): `Concluir`/`Revisar planejamento` (texto condicionado a
  `planningCompletedAt`); painel de verificação com os 3 `GateRow` (✓/✗ individual); `Iniciar
  semana` desabilitado com motivo; `Finalizar semana anterior` atrás de `role="alertdialog"`
  irreversível, usando `previousPeriodStart` (nunca `weekStart − 7`); `Cancelar planejamento`
  condicionado por `canCancelPlanning` (prop vinda do chamador).
- `GateRow` (linha ~315): `✓`/`✗` + rótulo, cor por `ok`.

### `noLiteralTokens.test.ts` (`weekly/`, NEW, 42 linhas) e (`planner/`, NEW, 31 linhas)

**Função geral do arquivo** — Guardrail automatizado de AC8 — prova estrutural (não visual) de
"zero literal reservado a token". Dois arquivos porque a fronteira de import ESLint
(`pages/` ↛ `features/`) impede um script único cruzar as duas pastas.

**Função geral da alteração** — Ambos importam o código-fonte via `?raw` (Vite) dos componentes/
páginas novos e verificam, por regex, a ausência dos 8 literais reservados
(`240px`, `235px`, `315px`, `190px`, `0.58`, `36px`, `48px`, `3px`) e de qualquer cor hexadecimal
literal (`#[0-9a-fA-F]{3,8}`). O de `weekly/` cobre os 8 componentes de `TaskRowBase` até
`WeeklyContextRail`; o de `pages/planner/` cobre `WeeklyBoardPage`/`WeeklyPlanningPage`.

**Comportamento de libs usadas**
- `import x from './Component.tsx?raw'` (Vite): importa o **conteúdo textual** do arquivo como
  string, em vez do módulo compilado — permite auditoria estática do código-fonte em tempo de
  teste, sem executar o componente.

## 12. Frontend — páginas

### `frontend/src/pages/planner/WeeklyBoardPage.tsx` (NEW, 440 linhas) + `.test.tsx` (NEW, 449 linhas)

**Função geral do arquivo** — A página do Weekly Board do sistema novo (AC1/AC3/AC6/AC7) — monta
em `planner/week`, substituindo `WeeklyPage` só nessa rota.

**Função geral da alteração** — Página nova completa.

**Blocos principais**
- Helpers de módulo (linhas ~44-97): `flattenTasks` (raízes + subtarefas recursivamente),
  `matchesStatusFilter`/`applyFilters` (filtro global), `formatWeekRange`/`formatWeekPosition`
  (header), `findPredecessor` (deriva o "Veio de…" buscando, na própria semana carregada, a task
  cujo `migratedToTask` é o id aberto — **nunca** inventa link reverso).
- Estado (linhas ~99-120): `explicitWeekStart` (navegação anterior/próxima), `statusFilter`/
  `hideNotOpen` (sessão, nunca persistido), `openTaskId`, `selectedIndex` (seletor compact).
  `weeklyLog`/`currentWeekLog` (dedup automático de cache quando `explicitWeekStart` é
  `undefined`), `readiness` (para o CTA de planejamento), `isWide`/`isDesktopUp`/`isTabletUp` via
  `useMediaQuery(mediaQueries.*)` — nunca string literal.
- `isReadonly = closed === true || status === 'finalized'` (linha ~132): a semana `finalized`
  (nova) **ou** `closed` legado (sem estado explícito) ambas viram readonly.
- `panelFor`/`poolPanel` (linhas ~181-217): fábricas de `WeeklyTaskPanel` por dia/pool,
  encapsulando `onCreate`/`onReorder` condicionados a `!isReadonly`.
- Render por faixa (linhas ~301-382): `compact` → `role="tablist"` de 8 células + 1 painel;
  `tablet` → `gridTemplateRows: '3fr 1fr'` (fração relativa, **não** pixel literal — correção do
  achado MÉDIO da review que usava `minHeight: '200px'`); `wide`/`medium` → grade por
  `gridTemplateAreas` explícito (weekend-stack como área própria).
- `WeekendStack` (linhas ~398-418): `gridTemplateColumns: '1fr 1fr'` — **em colunas**, não em
  linhas (correção do achado MÉDIO da review: um giro de eixo vs. o mockup aprovado que também
  esvaziava a razão de existir da variante `compact` da Task Row).

### `frontend/src/pages/planner/WeeklyPlanningPage.tsx` (NEW, 478 linhas) + `.test.tsx` (NEW, 367 linhas)

**Função geral do arquivo** — O ritual de planejamento (AC5) — três regiões (rail de fontes,
lista, rail de contexto sticky), monta em `planner/week/planning`.

**Função geral da alteração** — Página nova completa. O alvo do ritual vem **sempre** de
`readiness.data?.planning?.weekStart` — nunca da URL.

**Blocos principais**
- As 5 queries de fonte (linhas ~82-91): 4 fontes com `enabled: hasTarget`; `monthlyExpanded` com
  `enabled: hasTarget && activeSourceId === 'monthly-expanded'` (só sob seleção — evita
  materializar Monthly Logs de meses nunca visitados).
- Normalização por fonte (linhas ~115-160): `itemsBySource`/`loadingBySource`/`errorBySource`
  como `Record` por `WeeklyRitualSourceId` — cada fonte é isolada estruturalmente (uma em erro
  não contamina as outras).
- Handlers de decisão (`handleKeep`/`handleSkipWeek`/`handleAllocate`/`handleComplete`/
  `handleCancel`/`handleMigrateNamedDay`, linhas ~199-296): todos seguem o mesmo padrão — função
  `run()` guardada em `retryActionsRef.current[id]` (para "Tentar novamente" repetir a **mesma**
  ação exata), `onError` grava `itemErrors[id]`, `onSuccess` chama `recordMutation` (efêmero,
  "Tudo" desta visita) + `invalidateRitualQueries`.
- `handleConfirmDestination` (linha ~308): só fecha o seletor **no sucesso** — falha preserva
  item/foco/seletor aberto (correção do achado ALTO da review).
- Ações do ciclo (`handleCompletePlanning`/`handleStart`/`handleFinalizePrevious`/
  `handleCancelPlanning`, linhas ~344-364): todas recarregam `readiness` via `onSettled` —
  cobre tanto sucesso quanto 409, sem parsing de string de erro.
- `canCancelPlanning` (linha ~391): `!hasAnyDecision && !hasAnyTaskInTarget` — a UI **impõe** a
  regra do spine (o backend só bloqueia por tarefa, não por decisão — lacuna B11 registrada).
- Render (linhas ~393-478): grade de 3 colunas por token (`--ds-weekly-planning-source-rail`/
  `-context-rail`); banner offline (`role="status"`) ocupando a linha inteira quando `!isOnline`.

## 13. E2E (Playwright)

### `frontend/e2e/fixtures.ts` (UPDATE)

**Função geral do alteração** — `detailPanel(page)` (helper usado por ~10 specs) passa a casar
`.MuiDrawer-paper, .MuiDialog-paper` — cobre tanto o painel legado (Drawer, Daily/Monthly/
Future/Arquivo) quanto o `TaskDetailCard` novo (Dialog), pelo mesmo texto "Detalhe da tarefa".

### `frontend/e2e/shellHelpers.ts` (UPDATE)

**Função geral da alteração** — `+28 / -0`. Promove `navigate(page, destination)` (antes
duplicada em `weekly-monthly-cycle.spec.ts` e `ritual-sources.spec.ts`) para cá. Acrescenta
`waitForDialogSettled(page)` (par de `waitForSheetSettled`) — espera a opacidade do
`.MuiDialog-container` assentar em `1` antes de qualquer `axe` scan contra um `<Dialog>` recém-
aberto (o falso-positivo de `color-contrast` do passo de QA).

### `frontend/e2e/seedWeeklyBoardScenario.ts` (NEW, 151 linhas)

**Função geral do arquivo** — 3 seeds ORM-puro (via `manage.py shell -c`) para os specs do
Weekly Board. `seedWeeklyBoardScenario` (3 tasks na semana corrente: pendente+concluída na
segunda, uma no pool); `seedFinalizedWeekWithTasks` (semana `finalized` 2 semanas atrás, COM
tarefas — incluindo um par migrada/sucessora, para provar a seta de linhagem sobrevivendo ao
readonly); `seedWeeklyBoardLineageScenario` (par migrada/sucessora na semana **corrente**, para
o teste de navegação de linhagem intra-semana).

### `frontend/e2e/seedWeeklyPlanningScenario.ts` (NEW, 77 linhas)

**Função geral do arquivo** — Cenário ORM-puro completo do ritual: semana corrente `active` com
1 tarefa pendente (alimenta `previous-weekly` da próxima semana); próxima semana em `planning`
(o alvo); 1 tarefa de Monthly na semana-alvo; 1 template recorrente `weekly` ativo; 1 Daily Log
de 3 dias atrás não resolvido — um item elegível por fonte.

### `frontend/e2e/weekly-board.spec.ts` (NEW, 380 linhas)

**Função geral do arquivo** — Spec E2E do Weekly Board contra o backend real da branch Neon
`e2e`. `/planner/week` é a **primeira** superfície migrada — os axe scans aqui rodam **sem**
`exclude: 'main'`.

**Função geral da alteração** — 12 testes (7 do `dev-story` + 5 do passo de QA) em 5
`test.describe` por faixa (wide/medium/tablet/compact/reflow-320): composição+geometria por
token+filtro global+criação contextual; readonly em `finalized` (incl. detalhe desabilitado);
axe sem exclusão; axe com o Detalhe **aberto**; reordenação Mover acima/abaixo; navegação de
linhagem com destaque/foco; categoria+Eisenhower persistindo via round-trip; Cancelar/Excluir no
detalhe; recomposição por faixa; scroll horizontal ausente em compact/320.

### `frontend/e2e/weekly-planning-ritual.spec.ts` (NEW, 298 linhas)

**Função geral do arquivo** — Spec E2E do ritual contra o backend real. `/planner/week/planning`
é a segunda superfície migrada.

**Função geral da alteração** — 11 testes (8 do `dev-story` + 3 do passo de QA): abrir o ritual
não materializa container (`countRitualContainers`); as 5 fontes carregam independentemente (uma
via `page.route(...).abort()`); decisão sai de Pendentes e permanece em Tudo, sem toast; seletor
de destino por teclado (`2`+Enter); painel de verificação dos 3 gates; Finalizar semana anterior
com dialog irreversível; `Migrar para <dia>` (atalho nomeado); Cancelar planejamento; offline
(clique `force: true` provando que o **componente** guarda a ação, não só o Playwright); axe nas
4 faixas + reflow 320.

### `frontend/e2e/weekly-monthly-task-crud.spec.ts` (UPDATE, `+123/-79`)

**Função geral da alteração** — Reescreve os locators que a nova composição quebra: Select "Dia
(opcional)" → painel do dia (`region` filtrado por "abertas") com formulário próprio; pool via
`region('Sem dia definido')`; Select "Eisenhower" → `checkbox('Urgente')`; "Cancelar tarefa" →
"Excluir tarefa" no teste de hard-delete-ou-cancela (a nomenclatura mudou: agora há 2 botões
distintos); teste de ciclo fechado passa a abrir o detalhe e provar campos desabilitados/rodapé
ausente, em vez de só checar ausência de formulário.

### `frontend/e2e/past-period-navigation.spec.ts` (UPDATE, `+82/-73`)

**Função geral da alteração** — Links "Semana anterior"/"Próxima semana"/"Voltar para a semana
atual" → **botões** ("Semana anterior"/"Próxima semana"/"Voltar para hoje" — o stepper
bidirecional novo não esconde "Próxima semana" na corrente); some o aviso textual "Você está
vendo uma semana passada." (o indicador agora é a presença do botão "Voltar para hoje");
`getByLabel('Título')` escopado ao painel do dia (região "abertas"); "Mover tarefa" migrou para
dentro do `TaskDetailCard` (não mais inline na linha).

### `frontend/e2e/weekly-monthly-cycle.spec.ts` (UPDATE, `+23/-17`)

**Função geral da alteração** — Promove `navigate()` para `shellHelpers.ts` (remove a cópia
local). No teste de ciclo `finalized` vazio: "Fechada" → "Finalizada" (dentro do `main`
escopado), e o assert de ausência de formulário passa por `main.getByLabel('Título')` (evita
colisão com o `Título *` oculto do `BrainDumpCaptureSheet`) + assert novo de "Reordenar tarefa"
ausente.

### `frontend/e2e/ritual-sources.spec.ts` (UPDATE, `+1/-6`)

**Função geral da alteração** — Remove a cópia local de `navigate()`, importando de
`shellHelpers.ts` (dedup, sem mudança de comportamento do teste).
