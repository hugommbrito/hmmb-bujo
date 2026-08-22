# Explicação dos arquivos não commitados — Story 14.6: Monthly Board e planejamento mensal no sistema novo (M07)

## Visão geral

A Story 14.6 é a **sexta story de código do Épico 14** (Núcleo BuJo no Sistema Novo) e é a
**irmã mensal direta da 14.5** (Weekly Board, já commitada — `ecffe40`, que é o
`baseline_commit` desta story). Ao contrário da 14.5 — que nasceu com backend E frontend
aditivos simétricos e teve de **construir do zero** a fundação (`TaskRowBase`, `TaskDetailCard`,
`taskStatusIcons.tsx`, tokens `taskRow`/`panel`/`chip`, `shared/date`, `useKeyboardShortcuts`) —
a 14.6 é **majoritariamente frontend** e **reusa** toda essa fundação sem recriar nada. O backend
do ciclo e das 3 fontes do ritual mensal já existia inteiro desde as Stories 14.1/14.2/14.4; a
única lacuna de backend nesta story (AC4) **espelha byte-a-byte** a que a 14.5 fechou para o
Weekly. O resultado são **52 arquivos** não commitados (26 modificados + 26 novos), cobrindo:

- **Fase A — Backend aditivo + fundação de dados.** `monthly_cycle_readiness` (leitura pura e
  agregada de qual mês está `active`/`planning`, qual dos 3 gates de `start` falhou e se o próximo
  mês já está em planejamento — molde direto de `weekly_cycle_readiness`, trocando `_WEEKLY`→
  `_MONTHLY` e `week_start`→`month_first`), os 6 serializers `Monthly*` correspondentes +
  `MonthlyLogQuerySerializer` (declaração OpenAPI de `month_first`), o `GET /api/bujo/logs/monthly/
  cycle/` novo (método novo na view existente), e a fiação de dados do frontend: helpers de
  calendário mensal (`monthGridWeeks`/`lastDayOfMonth`) em `shared/date`, tokens `monthlyBoard`/
  `monthlyPlanning`, keys/hooks/tipos, **e a correção de 2 bugs de cache** já identificados
  (`useCreateMonthlyTaskMutation` invalidando por prefixo; `invalidateRitualQueries` estendida com
  os 4 prefixos mensais).
- **Fase B — Monthly Board.** `MonthlyBoardPage.tsx` (rota `planner/month`, primeira story a
  substituir `MonthlyPage.tsx` no sistema novo — que continua servindo só `archive/monthly/
  :monthFirst`): calendário `role="grid"` seg→dom de até 6 linhas com **todos os dias do mês**
  (dias fora do mês não-interativos), células compactas com `TaskRowBase` variant `compact`, pool
  "Sem dia definido" contínuo **reusando `WeeklyTaskPanel` diretamente** (decisão AD-21 — a
  composição já era 100% genérica), criação contextual por célula/pool, 6 filtros de status +
  "Ocultar não abertas", e a decisão de **tablet reusar a composição de compact** (achado
  arquitetural de a11y: 7 colunas a 768–1023px comprimem os alvos de toque do `TaskRowBase`
  compartilhado, "não modificar" por AC2).
- **Fase C — Ritual de planejamento mensal.** `MonthlyPlanningPage.tsx` (rota nova
  `planner/month/planning`): três regiões (rail de fontes, lista de decisões, rail de contexto
  sticky), as **3 fontes** do M07 em ordem fixa (`Recorrentes → Future Log → Monthly anterior`,
  a bloqueante por último), matriz de ações autorizada e estável por fonte (recorrentes SEM
  decisão-snapshot, `future-log` com `keep_undated`, `previous-monthly` só mutação), **seletor de
  destino mensal próprio** (calendário + setas + input do número do dia, distinto dos atalhos
  `1`–`7`/`0` do Weekly), minicalendário de densidade completo (não 8 faixas lineares), progresso
  derivado sobre **3 fontes** (denominador diferente do Weekly, que usa 4), painel de verificação
  dos 3 gates de `Iniciar mês`, `Finalizar mês anterior` dentro do ritual — e **sem "Cancelar
  planejamento"** (divergência deliberada do M07: o alvo mensal é sempre sequencial e
  determinístico).
- **Fase D — Acessibilidade, regressão e E2E.** 2 specs E2E novos (`monthly-board.spec.ts`,
  `monthly-planning-ritual.spec.ts`) + 2 seeds ORM-puros novos, **3 specs de regressão
  atualizados** (`weekly-monthly-task-crud`, `move-task`, `weekly-monthly-review`) porque a nova
  composição quebra locators antigos (formulário único do `MonthlyPage` legado → criação
  contextual; seção "Itens do Future Log para \<Mês\>" → ritual). As 5 faixas (wide/medium/tablet/
  compact/reflow-320) cobertas por `axe` desde o primeiro commit — sem a lacuna que a 14.5 teve de
  corrigir depois.

**Verificação (citada do Dev Agent Record, do passo de QA e da Senior Developer Review — não
re-executada na produção deste relatório):** `dev-story` fechou com pytest **1301 passed**
(backend aditivo, zero migration), Vitest **1387 passed/115 arquivos**, e 3 rodadas de Playwright
até verde que revelaram **3 achados reais de acessibilidade** só pegos contra o browser real e a
branch Neon `e2e` (jsdom não pega): (1) `color-contrast` em dias fora do mês — `--ds-ink-disabled`
sobre `--ds-surface-subtle` reprova AA (~2,6:1), corrigido para `--ds-ink-muted` (~5,1:1); (2)
`target-size` no formulário de criação da célula — o `IconButton` herdava o piso global de 44px do
`theme.ts`, corrigido com override local a `--ds-chip-height`; (3) achado arquitetural de tablet
(acima). O passo de QA (`bmad-qa-generate-e2e-tests`) acrescentou **2 specs E2E novos** (Cancelar/
Excluir no Detalhe AC2; offline do ritual AC7) + **4 testes Vitest novos** (empty-por-filtro;
retry de decisão + falha de migração + offline no `MonthlyPlanningPage`; disparo de `Adiar ao
Future Log`), fechando com Vitest **1392 passed** e Playwright **25/25**. A review adversarial (4
frentes paralelas) achou e corrigiu **7 achados reais** — **1 CRÍTICO** (`destinationForTarget()`
quebrava com 400 sem contexto durante meses pulados de 2+ — guard local `monthWouldBeRejectedAsFuture`
adicionado), **3 ALTOS** (AC8 violado por literal `7` em 2 componentes do ritual; `tsc -b --noEmit`
NÃO estava limpo por um `exact: true` inexistente no `ByRoleOptions`; AC9 pediu atualização e a
entrega fez remoção do teste "move de Este Mês para Futuro"), **2 MÉDIOS** e **1 BAIXO/MÉDIO**,
fechando com pytest **1301 passed**, Vitest **1399 passed/115 arquivos**, Playwright **25/25
efetivo**. `sprint-status.yaml` → `done`.

**Total documentado: 52 arquivos** (26 modificados + 26 novos), excluindo este próprio relatório.
**51 pertencem à Story 14.6**; 1 é um artefato de investigação de bug de produção **não
relacionado** a esta story (`investigations/task-migration-waiting-on-investigation.md`, seção 1.5
abaixo), presente na árvore de trabalho e portanto documentado, mas sinalizado como fora de escopo.

## Ordem lógica de funcionamento

1. **Artefatos de planejamento/processo** — story spec, resumo do passo de QA, sprint-status,
   orquestração do story-automator (+ o artefato de investigação não relacionado, sinalizado).
2. **Backend — serviço** (`cycles.py`) → **serializers** (`serializers.py`) → **views**
   (`views.py`): a leitura aditiva e read-only de prontidão do ciclo mensal (AC4).
3. **Contrato gerado** — `schema.yaml`, `types.gen.ts` (consumidores do backend).
4. **Backend — testes** (`test_services.py`, `test_views.py`).
5. **Frontend — primitivos compartilhados**: `shared/date/` (helpers de grade mensal),
   `shared/design/tokens.ts` (tokens `monthlyBoard`/`monthlyPlanning`).
6. **Frontend — camada de dados**: `api/keys.ts`, `features/bujo/types.ts`, `features/bujo/api.ts`
   (hooks mensais + os 2 bugs de cache corrigidos), barrel `features/bujo/index.ts`.
7. **Frontend — roteamento/shell**: `app/router.tsx`, `shellRouting.ts`.
8. **Frontend — lógica pura do ritual** (`features/bujo/components/monthly/monthlyRitualSources.ts`).
9. **Frontend — componentes do Monthly Board** (`monthly/MonthlyDayCell.tsx`, `MonthlyCalendarGrid.tsx`).
10. **Frontend — componentes do ritual mensal** (`monthly/MonthlySourceRail.tsx`,
    `MonthlyDecisionList.tsx`, `MonthlyDestinationPicker.tsx`, `MonthlyContextRail.tsx`).
11. **Frontend — páginas**: `MonthlyBoardPage.tsx`, `MonthlyPlanningPage.tsx`.
12. **Frontend — guardrails de token** (`monthly/noLiteralTokens.test.ts`, `planner/noLiteralTokens.test.ts`).
13. **E2E (Playwright)** — seeds/specs novos e os 3 specs de regressão atualizados.

---

## 1. Artefatos de planejamento e processo

### `_bmad-output/implementation-artifacts/14-6-monthly-board-e-planejamento-mensal-no-sistema-novo.md`

**Função geral do arquivo** — Story spec da 14.6 (NEW, untracked, 411 linhas). Fonte da verdade:
`Status: done`, `baseline_commit: ecffe40`. 9 ACs, 11 Tasks em 4 Fases (A: backend + fundação de
dados; B: Monthly Board; C: ritual; D: a11y/regressão/E2E), Dev Notes com os contratos de API já
existentes (verificados no código, nenhum hipotético), Dev Agent Record, três blocos de review
(dev-story, passo de QA, code-review adversarial), Change Log e File List.

**Função geral da alteração** — Documento de contexto para toda a entrega. Registra o
**"Contexto de herança"** (o que a 14.5 já construiu e é para ser REUSADO, nunca recriado), os
achados herdados da 14.4 que nomeiam esta story ("a fonte mensal tem 4 buckets observáveis, não
3"), os riscos de regressão E2E verificados lendo os specs atuais, e **5 questões abertas** para o
dono — incluindo a nº5, descoberta no code-review: `next_monthly_target` (backend, sem piso)
permite que o alvo do ritual fique ANTES do mês corrente durante regularização atrasada de 2+
meses, e **não existe** combinação no contrato de `migrate/` que migre uma tarefa PARA o próprio
mês-alvo já passado (mitigado nesta story com um guard local, mas a lacuna de produto continua
aberta).

### `_bmad-output/implementation-artifacts/tests/test-summary-14-6.md`

**Função geral do arquivo** — Resumo do passo de QA (`bmad-qa-generate-e2e-tests`) da 14.6 (NEW,
untracked). Artefato de processo/testing.

**Função geral da alteração** — Documenta as lacunas de cobertura E2E/unit que o `dev-story`
deixou, comparadas **teste a teste** contra os specs irmãos do Weekly (14.5): nenhum E2E do
Monthly exercitava `TaskDetailCard` Cancelar/Excluir contra o backend real (AC2), nem o estado
offline do ritual (AC7); `MonthlyBoardPage.test.tsx` não tinha "empty por filtro";
`MonthlyPlanningPage.test.tsx` só tinha a cobertura no componente isolado (retry de decisão, falha
de migração, offline); e `MonthlyDecisionList.test.tsx` não provava o disparo de `defer_to_future_log`.
Documenta **1 achado de autoria do próprio teste** (não de produto): o "Concluir falhando" inicial
usava a fonte `previous-monthly` e colidia com o segundo `role="alert"` persistente do aviso
bloqueante — corrigido escopando a asserção a `within(region 'Decisões — Monthly anterior')`.
Tabela de gates: Vitest **1392** (115 arquivos), Playwright **25/25** isolado (flakiness de
cold-start da branch Neon `e2e` documentada). Responde a Questão aberta #3 (pull do Future Log já
coberto por completude, sem teste substituto).

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Função geral do arquivo** — Fila e status do sprint (fonte da ordem mestre).

**Função geral da alteração** — `+3 / -3` (cabeçalho `last_updated: 2026-07-23 → 2026-07-25` e a
linha de status da 14.6). A entrada `14-6-...` transita para `done` com o histórico completo
anexado ao valor (execução das 4 fases, os 3 achados reais de a11y, o passo de QA, e os 7 achados
do code-review). A linha muito extensa do valor da 14.4 (herança do commit anterior) permanece;
`epic-14` segue `in-progress`.

### `_bmad-output/story-automator/orchestration-14-20260725-024358.md`

**Função geral do arquivo** — Documento de estado da orquestração `bmad-story-automator` que
conduz o Épico 14 (artefato de processo, não runtime).

**Função geral da alteração** — `+11 / -4`. `currentStory: 14.5 → 14.6`; `lastUpdated` avançado de
`15:47:28Z` para `2026-07-26T00:58:53Z`. A tabela de progresso marca 14.5 como totalmente fechada
(`git-commit = done`) e 14.6 como `create/dev/automate/review = done`, `git-commit in-progress`.
9 linhas de log anexadas, incluindo o registro de que a sessão de `dev-story` da 14.6 **crashou
duas vezes** (ECONNRESET e erro de certificado TLS) no meio da Task 6 — com as Tasks 1-5 (Fase A)
já verificadas — e foi retomada na terceira tentativa; depois `automate` done e `code-review` done.

### `_bmad-output/implementation-artifacts/investigations/task-migration-waiting-on-investigation.md`

**Função geral do arquivo** — Relatório de investigação forense (formato `bmad-investigate`, NEW,
untracked, 180 linhas) de um **erro 500 em produção** ao migrar uma tarefa: `psycopg.errors.
NotNullViolation` porque `tasks.waiting_on` recebeu `NULL` contra a constraint `NOT NULL`.

**⚠️ Fora do escopo da Story 14.6.** Este arquivo **não faz parte** da entrega do Monthly Board —
é um artefato de investigação de um incidente de produção separado (traceback em `services/tasks.
py:48` `create_task` via `TaskMigrateView`). A conclusão (confidence **High**) é que o `NULL`
decorre de **incompatibilidade entre o código carregado pelo processo e o schema já migrado**
(instância antiga da aplicação executando após a migration `0006_task_waiting_on`, provável
rollout parcial), e que a edição manual do status `migrated → pending` foi o **gatilho**, não a
causa. Está documentado aqui por ser um arquivo não commitado presente na árvore, mas não deve ser
confundido com o trabalho da story; commitá-lo (ou não) é decisão à parte da 14.6.

## 2. Backend — serviço (aditivo, read-only)

### `backend/bujo/services/cycles.py`

**Função geral do arquivo** — Serviço de ciclos de vida (Weekly/Monthly): transições, gates,
predicados de "anterior operacional". Funções de módulo.

**Função geral da alteração** — `~52 linhas` alteradas. Generaliza um helper existente e
acrescenta **uma** função pública nova (`monthly_cycle_readiness`), toda de leitura pura. Nenhuma
função existente muda de comportamento.

**Blocos principais**
- `_cycle_snapshot(log, *, key_field: str)` (linhas ~291-300): o snapshot da 14.5 ganha o parâmetro
  `key_field` (`getattr(log, key_field)`) para servir **as duas** dimensões — `week_start` (Weekly)
  e `month_first` (Monthly). As duas chamadas de `weekly_cycle_readiness` foram atualizadas para
  passar `key_field="week_start"` explicitamente (refator neutro, mesmo comportamento).
- `monthly_cycle_readiness(*, user) -> dict` (linhas ~303-345, novo): a leitura agregada mensal.
  Busca `active` (`status=ACTIVE`) e `planning` (`status=PLANNING`) via `.first()` (sem escrita, sem
  `get_or_create`). Se há `planning`, computa os **3 gates de start** (`date_reached`,
  `planning_completed`, `previous_finalized`) reusando `_previous_operational(_MONTHLY, key=...)` —
  o mesmo predicado que `start_monthly` já usa, então painel (`GET`) e gate real (`POST`) não podem
  divergir por construção. Se há `active`, computa os **2 gates de finalize** (`no_open_tasks` via
  `_has_undisposed`, `next_planning_exists` via `_monthly_next_planning_exists`).

**Funções, classes e importações específicas**
- `monthly_cycle_readiness`: a **única divergência de produto** em relação ao Weekly é
  `_monthly_next_planning_exists`, que exige o mês EXATAMENTE seguinte (sem lacuna), enquanto o
  Weekly aceita qualquer planning futuro — documentado na docstring. Zero predicado novo, zero
  escrita.

## 3. Backend — serializers

### `backend/bujo/serializers.py`

**Função geral do arquivo** — Serializers DRF do app `bujo`.

**Função geral da alteração** — `+58 / -0`. Acrescenta 6 serializers novos (a projeção completa
de `GET /logs/monthly/cycle/`) + 1 serializer de parâmetro de query só para documentação OpenAPI.
Todos **espelham byte-a-byte** os análogos `Weekly*` (`serializers.py:203-246`), trocando
`week_start`→`month_first`; mesmos nomes de campo.

**Blocos principais**
- `_MonthlyCycleSnapshotSerializer` (linhas ~268-272): `month_first`, `status`,
  `planning_completed_at` — o bloco `active`/`planning`.
- `MonthlyStartGatesSerializer` / `MonthlyStartReadinessSerializer` (linhas ~275-286): os 3
  booleanos de `start` + `allowed`/`target`/`gates`.
- `MonthlyFinalizeGatesSerializer` / `MonthlyFinalizeReadinessSerializer` (linhas ~289-299): os 2
  booleanos de `finalize`.
- `MonthlyCycleReadinessSerializer` (linhas ~302-311): compõe os 4 blocos com `allow_null=True`
  em cada um — a forma exata da resposta de `GET /logs/monthly/cycle/`. Docstring registra que
  "este serializer só projeta, nunca decide".
- `MonthlyLogQuerySerializer` (linhas ~317-321): `month_first` opcional — **só** para declarar o
  parâmetro no OpenAPI de `MonthlyLogView.get`; a validação/normalização real continua manual na
  view, sem mudança de comportamento (molde de `WeeklyLogQuerySerializer`).

## 4. Backend — views

### `backend/bujo/views.py`

**Função geral do arquivo** — Views DRF (`APIView`) do `bujo`. Views finas (serviço → resposta).

**Função geral da alteração** — `~17 linhas`. Método novo `get` em `MonthlyCycleView`
(**mesma rota**, sem rota nova) + `@extend_schema(parameters=[...])` em `MonthlyLogView.get`.

**Blocos principais**
- Imports (linhas ~23-67): `MonthlyCycleReadinessSerializer`, `MonthlyLogQuerySerializer` e
  `monthly_cycle_readiness` acrescentados em ordem alfabética.
- `MonthlyLogView.get` (linha ~372): `@extend_schema(parameters=[MonthlyLogQuerySerializer],
  responses=MonthlyLogSerializer)` — só a declaração OpenAPI muda; o corpo (normalização manual de
  `month_first`) é intocado.
- `MonthlyCycleView.get` (linhas ~485-488, novo): `@extend_schema(responses=
  MonthlyCycleReadinessSerializer)`; `readiness = monthly_cycle_readiness(user=request.user);
  return Response(MonthlyCycleReadinessSerializer(readiness).data)`. Zero regra de domínio na view;
  a docstring registra que **espelha byte-a-byte** `WeeklyCycleView.get`. O `post` existente
  (ações do ciclo, determinístico, sem retargeting) é intocado.

## 5. Contrato gerado (produtores → consumidores)

### `schema.yaml`

**Função geral do arquivo** — OpenAPI gerado por `manage.py spectacular` (autoridade do contrato;
guardrail de CI compara com `types.gen.ts`).

**Função geral da alteração** — **Gerado**, não editado à mão. `+131 / -0`: a operação `get` nova
em `/api/bujo/logs/monthly/cycle/`, o parâmetro `month_first` acrescentado a `/api/bujo/logs/
monthly/`, e os 6 componentes de schema novos (`MonthlyCycleReadiness`, `MonthlyStartGates`,
`MonthlyStartReadiness`, `MonthlyFinalizeGates`, `MonthlyFinalizeReadiness`, `_MonthlyCycleSnapshot`).
**Zero deleção** de componente pré-existente. Regenerado via `spectacular` e confirmado idêntico
ao já commitado pela Fase A na review.

### `frontend/src/api/types.gen.ts`

**Função geral do arquivo** — Tipos TS gerados a partir do `schema.yaml`
(`npm run generate-types`). **Nunca** editado à mão.

**Função geral da alteração** — **Gerado**. `+81 / -3` na contagem de `git diff --stat`; o Dev
Agent Record reporta `79 inserções / 2 deleções`, sendo as 2 deleções os stubs `get?: never`/
`query?: never` virando o tipo real do `GET /logs/monthly/cycle/` — **zero deleção de componente**.
`MonthlyCycleReadiness`, `MonthlyStartGates(Readiness)`, `MonthlyFinalizeGates(Readiness)` e
`_MonthlyCycleSnapshot` nascem em `components['schemas']`; a operação `bujo_logs_monthly_cycle_
retrieve` nasce em `operations`; a query de `bujo_logs_monthly_retrieve` ganha `{ month_first?:
string }`. Os tipos novos alimentam exclusivamente `frontend/src/features/bujo/types.ts` (seção 6).

## 6. Backend — testes

### `backend/bujo/tests/test_services.py`

**Função geral do arquivo** — Testes de serviço. `+203 / -0`.

**Função geral da alteração** — Funções `test_` novas cobrindo `monthly_cycle_readiness`,
espelhando os testes que a 14.5 escreveu para `weekly_cycle_readiness`.
- Caso base (os 4 blocos nulos sem nenhum ciclo operacional), o cenário completo `active`+`planning`
  com os 3 gates de start, e os casos irmãos positivos de `start`/`finalize` `allowed: true`.
- **A prova central da AC4** (o painel e o gate real **não podem divergir**): para cada gate
  isolado, a leitura (`monthly_cycle_readiness`) e a transição real (`start_monthly`/
  `finalize_monthly`, que levantam `InvalidTransition`) concordam — molde de
  `test_readiness_finalize_e_o_gate_real_nao_podem_divergir` da 14.5.
- A prova de **leitura pura** (`CaptureQueriesContext`, `MonthlyLog.objects.count()` inalterado,
  nenhum `get_or_create`).
- Inclui `test_ciclo_monthly_dois_meses_pulados_exigem_materializacao_sequencial` — o cenário que
  prova o achado CRÍTICO do code-review (alvo do ritual ficando antes do mês corrente durante
  regularização atrasada).

### `backend/bujo/tests/test_views.py`

**Função geral do arquivo** — Testes de view/HTTP (DRF `APIClient`). `+90 / -0`.

**Função geral da alteração** — Funções `test_` novas cobrindo o contrato HTTP de
`GET /logs/monthly/cycle/`: 200 com os 4 blocos `null` sem ciclo; o cenário completo lido no fio
**camelCase** (via `POST`s reais de `open_planning_target`→`complete_planning`→`start`),
confirmando que repetir a leitura devolve exatamente o mesmo corpo (nenhuma escrita no `GET`);
isolamento entre tenants com bearer real; e 401 sem autenticação.

## 7. Frontend — primitivos compartilhados

### `frontend/src/shared/date/index.ts` (UPDATE) + `index.test.ts` (UPDATE)

**Função geral do arquivo** — A implementação única de helpers de data LOCAL do sistema novo
(nasceu na 14.5). Todos puros, sem `new Date()` sem argumento (Convenção #8).

**Função geral da alteração** — `+42 / -0`. Acrescenta 3 exports para o Monthly Board (Task 2),
construídos a partir dos primitivos já existentes — **não** duplica a cópia própria de
`MonthDensityCalendar.tsx` (legado da 11.3, fora de escopo).

**Funções, classes e importações específicas**
- `lastDayOfMonth(monthFirst)`: último dia do mês (28–31, incl. bissexto) via `new Date(year,
  month, 0).getDate()` — espelha a regra que `TaskMigrateSerializer`/`MonthlyTaskCreateSerializer`
  já validam no backend (`calendar.monthrange`), para dar feedback client-side antes do POST.
- `monthGridWeeks(monthFirst)`: as semanas seg→dom cobrindo o mês inteiro (**4 a 6 linhas** —
  fevereiro não bissexto começando numa segunda produz exatamente 4, caso corrigido no code-review),
  cada dia marcado `inMonth: boolean` via `mondayIsoOf`/`addDaysIso`. Interface `MonthGridDay`
  (`iso`, `inMonth`) exportada junto.

**Testes** (`index.test.ts`, +89 linhas): casos incluindo fevereiro bissexto, a virada dez/jan, e
o caso de 4 linhas (achado do code-review).

### `frontend/src/shared/design/tokens.ts` (UPDATE) + `tokens.test.ts` (UPDATE)

**Função geral do arquivo** — Dados puros de design tokens do App Shell (sem React/MUI).

**Função geral da alteração** — `+42 / -0`. Acrescenta os 2 blocos de tokens de componente do
M07 (AC8, valores literais do `DESIGN.md` linhas 373-382) e as 6 variáveis `--ds-monthly-*` em
`shellCssVariables()`.

**Blocos principais**
- `monthlyBoard` (linhas ~217-241): `columns: 7`, `gap: spacing[2]`, `undatedWidth: '268px'`,
  `dayScroll: 'internal'`, `terminalOpacity: 0.58` — comentário registra que `dayScroll`/
  `terminalOpacity` **reusam** as vars da 14.5 (não recriar). Acrescenta `minCellHeight: '140px'`
  **não documentado no DESIGN.md** — decisão de implementação por causa do achado real de
  `target-size` do axe (sem um piso, `grid-auto-rows: minmax(0, 1fr)` comprime o formulário de
  criação da célula abaixo do alvo de toque em viewports curtos).
- `monthlyPlanning` (linhas ~245-249): `sourceRail: '188px'`, `contextRail: '310px'`,
  `densityPosition: 'sticky'`.
- 6 entradas novas em `structuralCssVariables` (linhas ~474-479): `--ds-monthly-board-columns|
  -gap|-undated-width|-min-cell-height`, `--ds-monthly-planning-source-rail|-context-rail`.

**Testes** (`tokens.test.ts`, +32 linhas): valores batendo com `DESIGN.md` + cada token novo
aparecendo em `shellCssVariables`.

## 8. Frontend — camada de dados

### `frontend/src/api/keys.ts` (UPDATE) + `keys.test.ts` (UPDATE)

**Função geral do arquivo** — Factory central de query keys do TanStack Query.

**Função geral da alteração** — `+7 / -0`. Acrescenta `bujo.monthlyCycle()` (chave fixa),
`bujo.ritualMonthlySource(sourceId, monthFirst)` e `bujo.ritualMonthlyDensity(monthFirst)` — molde
direto do bloco Weekly. `keys.test.ts` (+29 linhas) ganha os `it`s provando os 3 formatos e que
sourceId/monthFirst diferentes geram chaves diferentes (invalidação seletiva depende disso).

### `frontend/src/features/bujo/types.ts` (UPDATE)

**Função geral do arquivo** — Re-exporta aliases de `components['schemas']` (gerado) para o resto
do `features/bujo/` nunca importar `types.gen` direto.

**Função geral da alteração** — `+8 / -0`. Acrescenta 6 re-exports: `MonthlyCycle`,
`MonthlyCycleAction`, `MonthlyCycleReadiness`, `MonthlyStartReadiness`, `MonthlyFinalizeReadiness`,
`MonthlyRecurringSource`. Os 3 primeiros (`MonthlyCycle`/`MonthlyCycleAction`/`MonthlyRecurringSource`)
já existiam em `types.gen` mas ainda **não estavam re-exportados** aqui (só os `Weekly*` estavam);
os 3 de prontidão nasceram na Task 1.

### `frontend/src/features/bujo/api.ts` (UPDATE) + `api.test.tsx` (UPDATE)

**Função geral do arquivo** — Hooks TanStack Query do domínio `bujo`.

**Função geral da alteração** — `~138 linhas`. Corrige 2 bugs de cache e acrescenta 6 hooks novos.

**Blocos principais**
- `useCreateMonthlyTaskMutation.onSuccess` (linha ~322): troca `invalidateQueries({ queryKey:
  keys.bujo.monthlyLog(variables.monthFirst) })` (chave **exata** da data) por `invalidateQueries
  ({ queryKey: ['bujo', 'monthlyLog'] })` (**prefixo**) — **mesma classe de bug** que
  `useCreateWeeklyTaskMutation` teve corrigida na 14.5: a view sem navegação explícita usa a chave
  sentinel `'current'`, que nunca bate com a data literal devolvida pelo servidor; sem o prefixo,
  criar tarefa vendo o mês corrente nunca atualizava a lista (AC9, bug #1).
- `invalidateRitualQueries(queryClient)` (linhas ~592-612): estendida com os **4 prefixos mensais**
  (`monthlyLog`, `monthlyCycle`, `ritualMonthlySource`, `ritualMonthlyDensity`) além dos 5
  semanais — como as mutações do ritual são **compartilhadas** entre os dois rituais, sem esta
  extensão qualquer decisão do ritual mensal deixaria o Monthly Board e as próprias fontes com
  cache stale (AC9, bug #2).
- `useMonthlyCycleReadinessQuery` / `useMonthlyCycleActionMutation` (linhas ~752-773): `GET`/`POST`
  de `/api/bujo/logs/monthly/cycle/`; a mutação invalida por `onSettled` (cobre também 409).
- `useMonthlyRecurringSourceQuery` / `useMonthlyFutureLogSourceQuery` / `usePreviousMonthlySourceQuery`
  / `useMonthlyDensityQuery` (linhas ~776-852): um `useQuery` por fonte/endpoint, todos com
  `options?.enabled` e query string **snake_case** (`{ month_first: monthFirst }`). O comentário
  registra que `future-log` **não tem** equivalente semanal 1:1 (o ritual semanal não tem fonte
  "Future Log") — segue o padrão geral de `TaskSourceSerializer`, devolvendo `TaskSource`.

**Testes** (`api.test.tsx`, +253 linhas): describe blocks para cada hook novo, `enabled: false`
não consultando, os 9 prefixos invalidados por `invalidateRitualQueries`, e os 2 bugs de cache
com teste que falha antes da correção.

### `frontend/src/features/bujo/index.ts` (UPDATE, barrel)

**Função geral do arquivo** — Barrel público do domínio `bujo` — único ponto de import para
`pages/` (regra de fronteira ESLint).

**Função geral da alteração** — `+12 / -0`. Exporta os 6 hooks mensais novos + 6 tipos `Monthly*`.
Registrado como **gap fechado da Fase A** (Task 4): `api.ts`/`types.ts` já tinham os símbolos, mas
eles não haviam chegado ao barrel, bloqueando a Fase B/C. Os componentes de `monthly/` **não** são
exportados pelo barrel (consumidos só via caminho direto pelas páginas, mesmo padrão de `weekly/`
na 14.5).

## 9. Frontend — roteamento/shell

### `frontend/src/app/layout/shell/shellRouting.ts` (UPDATE) + `shellRouting.test.ts` (UPDATE)

**Função geral do arquivo** — Registro central de rotas com `{ routeId, shell, surfaceMigrated }`;
`surfaceMigrated: true` faz o `LegacySeamNotice` desaparecer só naquela rota.

**Função geral da alteração** — `+5 / -1`. `planner/month` vira a **segunda superfície interna
migrada** (`surfaceMigrated: false → true`) e ganha uma entrada irmã `planner/month/planning`
(segmentos diferentes, precisa de registro próprio — `matchesPattern` exige igualdade de contagem
de segmentos).

**Testes** (`shellRouting.test.ts`, +8/-2): o `Set` `MIGRATED_ROUTE_IDS` do teste da 14.5 ganha
`planner/month` e `planner/month/planning`.

### `frontend/src/app/router.tsx` (UPDATE)

**Função geral do arquivo** — Definição central de rotas (`RouteObject[]`) consumida pelo
`createBrowserRouter`.

**Função geral da alteração** — `~12 linhas`. `planner/month` monta `MonthlyBoardPage` (não mais
`MonthlyPage`) com `handle: { title: 'Este Mês' }` preservado; rota nova `planner/month/planning`
monta `MonthlyPlanningPage` com `handle: { title: 'Planejar o mês' }`. `MonthlyPage` continua
importada (serve `archive/monthly/:monthFirst`, intocada).

## 10. Frontend — lógica pura do ritual mensal

### `frontend/src/features/bujo/components/monthly/monthlyRitualSources.ts` (NEW, 166 linhas) + `.test.ts` (NEW, 224 linhas)

**Função geral do arquivo** — Lógica **pura** (sem React) das 3 fontes do ritual mensal:
normalização de forma e a matriz de ações autorizadas. Consumido por `MonthlySourceRail`,
`MonthlyDecisionList`, `MonthlyDestinationPicker` e `MonthlyPlanningPage`.

**Funções, classes e importações específicas**
- `MONTHLY_RITUAL_SOURCE_ORDER`/`_LABEL`/`_BLOCKING` (linhas ~23-71): a ordem fixa
  (`recurring → future-log → previous-monthly`), rótulos, e o mapa de bloqueio (só
  `previous-monthly`).
- `MONTHLY_RITUAL_SOURCE_ACTIONS` (linhas ~55-65): o conjunto **autorizado e estável** por fonte —
  `allocate` só em `recurring` (a matriz do backend `ALLOWED_DECISIONS` **não tem** `(monthly,
  template)`); `keep_undated` só em `future-log` (a única decisão-snapshot válida para alvo mensal);
  `previous-monthly` só ações mutantes (`decision` sempre `null`). É o guardrail textual da mesma
  armadilha do achado A1 da 14.2.
- `NormalizedRitualItem` + `normalizeTaskItems`/`normalizeTemplateItems`/`normalizeSource` (linhas
  ~73-143): unificam `RitualTaskItem`/`RitualTemplateItem` numa forma única. `normalizeAlreadyPlacedBuckets`
  extrai os **2 buckets fora do progresso** da fonte Recorrentes (`alreadyPlaced`,
  `alreadyPlacedInYear`) — os "4 buckets observáveis, não 3" herdados da 14.4.
- `sameDayOfMonthClamped(originIso, targetMonthFirst)` (linhas ~152-157): "mesmo dia do mês de
  origem, com clamp" (a divergência mensal do "preservar o dia da semana" do Weekly — dias da
  semana não fazem sentido entre meses). **Movida para cá** de `MonthlyDestinationPicker.tsx` no
  dev-story (achado de lint `react-refresh/only-export-components`); reusada pelo atalho
  `migrate_named_day` e pelo picker, sem duplicar a aritmética.
- `itemsForView(items, view, mutatedThisVisit)` (linha ~159): `Pendentes` filtra `decision === null`;
  `Tudo` une o durável com o efêmero (mutado nesta visita). Mesmo padrão da 14.5.

## 11. Frontend — componentes do Monthly Board (`features/bujo/components/monthly/`)

### `MonthlyDayCell.tsx` (NEW, 186 linhas) + `.test.tsx` (NEW, 126 linhas)

**Função geral do arquivo** — Célula de dia do calendário (AC1/AC2/AC7): cabeçalho com número/data
(`aria-label="Abrir Daily Log de <data completa>"`, `<RouterLink>` para `/daily/<date>`) +
contagem textual + lista rolável de `TaskRowBase` variant `compact` + criação contextual.

**Blocos principais**
- `countLabel(tasks)` (linhas ~28-34): "vazio" / "N abertas" (nenhuma terminal) / "N registros"
  (mistura com ao menos 1 terminal) — mesmo padrão do mockup `key-monthly.html`.
- A região de tarefas é sempre `tabIndex=0` + `aria-label` com quantidade e instrução ("use as
  setas para rolar") quando há tarefas (AC7); `overflow: 'auto'` + `overscrollBehavior: 'contain'`.
- O formulário de criação (`!readonly && onCreate`) tem os **overrides de a11y**: `minHeight:
  var(--ds-chip-height)` no input e `minWidth/minHeight/padding` no `IconButton` sobrescrevendo o
  piso global de 44px do `theme.ts` — as duas correções de `target-size` do axe.

### `MonthlyCalendarGrid.tsx` (NEW, 143 linhas) + `.test.tsx` (NEW, 107 linhas)

**Função geral do arquivo** — Calendário completo (AC1/AC7): `role="grid"` seg→dom de até 6 linhas
com todos os dias do mês.

**Blocos principais**
- `monthGridWeeks` (`shared/date`) monta a grade; cada linha usa `display: 'contents'` (`role="row"`)
  para preservar a semântica ARIA grid > row > gridcell sem quebrar o CSS Grid de 7 colunas.
- `gridTemplateColumns: 'repeat(var(--ds-monthly-board-columns), minmax(0, 1fr))'` — **nunca o
  literal `7`** (AC8; `var()` é válido dentro de `repeat()` nos browsers-alvo).
- `gridAutoRows: 'minmax(var(--ds-monthly-board-min-cell-height), 1fr)'` — o piso por linha do
  achado de `target-size`.
- Dias `inMonth` renderizam `MonthlyDayCell`; dias fora do mês renderizam um `gridcell` de texto em
  `--ds-ink-muted` (não `--ds-ink-disabled` — a correção de `color-contrast` do axe) sobre
  `--ds-surface-subtle`.

## 12. Frontend — componentes do ritual mensal (`features/bujo/components/monthly/`)

### `MonthlySourceRail.tsx` (NEW, 74 linhas) + `.test.tsx` (NEW, 41 linhas)

**Função geral do arquivo** — `<nav aria-label="Fontes do planejamento mensal">` com as 3 fontes
na ordem fixa (AC5). Molde direto de `WeeklySourceRail`.

**Função geral da alteração** — Cada fonte é um botão com `aria-current` (ativa), `aria-busy`
(carregando — **não** desabilita as outras), contagem (`entry.pendingCount`, ou "erro") e
subtítulo opcional. Diferente do Weekly, as 3 fontes **sempre** têm contagem própria (nenhuma
"opcional sem número").

### `MonthlyDecisionList.tsx` (NEW, 286 linhas) + `.test.tsx` (NEW, 256 linhas)

**Função geral do arquivo** — A lista de decisões da fonte **ativa** (AC5) — o conjunto de ações
completo e estável (`MONTHLY_RITUAL_SOURCE_ACTIONS`), toggle Pendentes/Tudo, continuidade de foco.
O componente mais denso do ritual mensal.

**Blocos principais**
- Continuidade de foco (linhas ~83-95): `useEffect` reage a `items` mudar — se o item agido sumiu,
  foca a próxima pendência na mesma posição, ou o heading da fonte ao esgotar.
- `actOn`/`chooseDestination`/`allocate` (linhas ~97-111): guardam contra `offline` (clique não
  roda — defesa em profundidade além do `aria-disabled`).
- Agrupamento (linhas ~114-122): só `recurring` agrupa; `groupLabels` deriva **dos itens presentes**
  (`['monthly', 'annual'].filter(...)`) — correção de qualidade do dev-story: sem isso,
  "Mensais"/"Lembrete anual" apareceriam vazios depois do único item do grupo ser decidido.
- Render dos botões condicionado por `actions.includes(...)`; `migrate_named_day` computa
  `sameDayOfMonthClamped(item.scheduledDate, targetMonthFirst)` e mostra "Migrar para dia N";
  `itemErrors`/`onRetryItem` — mensagem de falha por item com "Tentar novamente".
- As 2 seções `alreadyPlaced`/`alreadyPlacedInYear` (só `recurring`, fora do progresso) sempre
  visíveis, com botão "Alocar outra instância".

### `MonthlyDestinationPicker.tsx` (NEW, 239 linhas) + `.test.tsx` (NEW, 78 linhas)

**Função geral do arquivo** — Seletor de destino do ritual mensal (AC5) — **distinto** do
`WeeklyDestinationPicker`: calendário navegável por setas (dia anterior/próximo) + entrada direta
do número do dia, sincronizados, validando 28–31 dias reais do mês-alvo (incl. bissexto).

**Blocos principais**
- `selectDay`/`step`/`confirm` (linhas ~50-63): `selectDay` valida `1..lastDay`; o `<input
  type="number">` e os botões `‹`/`›` compartilham o estado `armed`.
- `handleContainerKeyDown` (linhas ~65-74): `Enter` confirma a ação nomeada, `Escape` fecha.
- Comentário de cabeçalho documenta por que **não reusa `useKeyboardShortcuts`**: a interação é
  digitar num `<input>` real, e o guard de INPUT/TEXTAREA daquele hook existe justamente para
  IGNORAR esse caso — usá-lo seria contraproducente.
- `role="grid"` de dias (`var(--ds-monthly-board-columns)` — a correção do achado ALTO do
  code-review, antes era o literal `repeat(7, ...)`), opção explícita "Sem dia definido", `error`
  prop (falha na confirmação mostra motivo sem fechar). Compact renderiza em `<Drawer>` reaplicando
  `shellCssVariables()` no `paper` **e** no `backdrop`.

### `MonthlyContextRail.tsx` (NEW, 343 linhas) + `.test.tsx` (NEW, 152 linhas)

**Função geral do arquivo** — Rail de contexto do ritual (AC3/AC5/AC6): minicalendário de
densidade completo, progresso derivado sobre **3 fontes**, avisos acionáveis e as ações do ciclo.
O segundo mais denso.

**Blocos principais**
- Densidade (linhas ~110-190): consome `useMonthlyDensityQuery`; **minicalendário completo do mês**
  (não 8 faixas lineares como o Weekly), cada dia um `gridcell`-botão com `aria-label` textual
  (`describeDensityDay`: total + contagem por status) e barra colorida `aria-hidden` (decorativa);
  clicar **escolhe destino** (`onSelectDay`), não abre inspeção (AC6). Faixa "Sem dia definido"
  com o mesmo tratamento.
- Progresso (linhas ~192-216): 2 `role="progressbar"` — `Fontes revisadas`/**3** (denominador
  mensal) e `Itens decididos`/total, com `aria-valuenow`/`-max`/`-text`.
- Avisos (linhas ~218-248): fontes não-bloqueantes pendentes navegam ao clicar; o
  `previous-monthly` usa `role="alert"` distinto (bloqueia iniciar mês); ao zerar vira "Mês
  anterior pronto para finalizar".
- Ações do ciclo (linhas ~250-331): `Concluir/Revisar planejamento`, o painel dos 3 gates
  (`GateRow` ✓/✗) + `Iniciar mês` (desabilitado até `readiness.start.allowed`), e `Finalizar mês
  anterior` atrás de um `role="alertdialog"` irreversível. **Sem "Cancelar planejamento"** (AC3).

## 13. Frontend — páginas

### `frontend/src/pages/planner/MonthlyBoardPage.tsx` (NEW, 448 linhas) + `.test.tsx` (NEW)

**Função geral do arquivo** — Monthly Board do sistema novo (AC1/AC3/AC7/AC9) — irmã mensal da
`WeeklyBoardPage`. Landmark `<main aria-label="Este Mês">`.

**Blocos principais**
- `groupTasksByDate`/`flattenTasks`/`applyFilters` (linhas ~64-96): `MonthlyLog` devolve `tasks`
  **flat** (sem `days[]`/`unscheduled` prontos como o `WeeklyLog`), então a página agrupa por
  `scheduledDate` num `Map` para a grade + a lista `unscheduled` do pool.
- Stepper de mês (`addMonthsIso`, ±1 mês) — o comentário de cabeçalho documenta a **decisão de
  escopo** de que "restrito a ciclos operacionais" (AC3) descreve a intenção mas nenhum endpoint
  hoje enumera meses finalizados para filtrar ativamente; risco de mudança de uma linha.
- `poolPanel` e `compactDayPanel` **reusam `WeeklyTaskPanel`** diretamente (AD-21, "zero
  recriação" — a composição já era genérica).
- Recomposição por faixa: `wide`/`medium` usam `MonthlyCalendarGrid` + pool à direita;
  **`tablet` e `compact` reusam a mesma composição** (seletor de data + `WeeklyTaskPanel` de um dia
  por vez) — o achado arquitetural de a11y (7 colunas a 768–1023px comprimem os alvos de toque do
  `TaskRowBase` compartilhado). "Hoje" vem de `useTodayLogQuery().data?.logDate` (Convenção #8).
- `TaskDetailCard` aberto **inalterado** (AC2); `onMove` fica sem handler (mesmo gap da 14.5 —
  mover entre dias pelo board, fora do ritual, não está wireado em nenhum board novo).

### `frontend/src/pages/planner/MonthlyPlanningPage.tsx` (NEW, 478 linhas) + `.test.tsx` (NEW)

**Função geral do arquivo** — Ritual de planejamento mensal (AC5) — três regiões em grid
(`--ds-monthly-planning-source-rail` / `1fr` / `--ds-monthly-planning-context-rail`). Landmark
`<main aria-label="Planejar <mês> de <ano>">`. O alvo do ritual vem **sempre** de
`readiness.planning.monthFirst`, nunca da URL.

**Blocos principais**
- `destinationForTarget()` (linha ~126): decide `destination: 'month'` (quando o alvo **coincide**
  com o mês corrente — o servidor sempre resolve `'month'` para `today_for`) vs `'future'` (com
  `monthFirst` explícito, quando estritamente posterior). A regra `month` vs `future` do
  `TaskMigrateSerializer` (edge case real das Dev Notes).
- `monthWouldBeRejectedAsFuture()` + `STALE_TARGET_MIGRATE_ERROR` (linhas ~176-195): **a correção
  do achado CRÍTICO do code-review**. `next_monthly_target` (backend, sem piso) permite que o alvo
  fique ANTES do mês corrente em meses pulados; `'future'` rejeita `monthFirst` não estritamente
  posterior e `'month'` sempre resolve para o corrente — não há combinação que migre PARA o alvo já
  passado. O guard bloqueia os 3 fluxos que passam por `migrateTask` (migrar dia nomeado, confirmar
  destino, adiar ao Future Log) **antes do POST**, com erro local explicativo em vez de um 400 sem
  contexto (`Alocar`/`place/` não tem essa restrição, por isso não é guardado).
- Handlers por ação (linhas ~210-364): `handleAllocate`/`handleDeferToFutureLog`/`handleKeepUndated`/
  `handleComplete`/`handleCancel`/`handleMigrateNamedDay`/`handleConfirmDestination` — cada um
  grava a mutação (`placeTemplate`/`migrateTask`/`transitionTask`/`ritualDecision`), registra o
  item em `mutatedThisVisit`, invalida por `invalidateRitualQueries`, guarda a ação em
  `retryActionsRef` para o retry por item, e trata `onError` preservando o item + motivo. `Adiar ao
  Future Log` é determinístico (sempre o mês imediatamente seguinte ao alvo).
- Composição (linhas ~406-476): `MonthlySourceRail` + `MonthlyDecisionList` + `MonthlyContextRail`
  (aside sticky) + `MonthlyDestinationPicker` sob demanda; banner offline `role="status"` no topo
  (`useOnlineStatus`); densidade pré-carregada (`useMonthlyDensityQuery` dedup com o rail).

## 14. Frontend — guardrails de token

### `frontend/src/features/bujo/components/monthly/noLiteralTokens.test.ts` (NEW, 48 linhas)

**Função geral do arquivo** — Guardrail (sem par de produção) que lê os componentes de `monthly/`
como `?raw` e falha se algum escreve um literal estrutural em vez de `var(--ds-*)`. Par por pasta
(a fronteira de import `features/`↔`pages/` exige um guard por diretório, precedente da 14.5).
Inclui a regra específica `/repeat\(\s*7\s*,/` — o guard novo do achado ALTO do code-review (o
literal `7` em `repeat(7, ...)`, que um `\b7\b` genérico não pegaria sem falso-positivo na prosa
dos comentários).

### `frontend/src/pages/planner/noLiteralTokens.test.ts` (UPDATE)

**Função geral do arquivo** — Guardrail equivalente para as páginas de `pages/planner/`.

**Função geral da alteração** — `+18 / -2`. Acrescenta `MonthlyBoardPage.tsx`/`MonthlyPlanningPage.tsx`
ao mapa de fontes e os literais próprios do M07 (`268px`, `188px`, `310px`) à lista `FORBIDDEN_LITERALS`.

## 15. E2E (Playwright)

### `frontend/e2e/seedMonthlyBoardScenario.ts` (NEW, 166 linhas)

**Função geral do arquivo** — Seeds ORM-puros do Monthly Board (AC1/AC9), molde direto de
`seedWeeklyBoardScenario.ts`. Exporta 3 cenários: `seedMonthlyBoardScenario` (mês corrente com
tarefa no dia + concluída + sem dia), `seedFinalizedMonthWithTasks` (mês `finalized` 2 meses atrás,
com par migrada/sucessora — prova readonly com conteúdo real) e `seedMonthlyBoardLineageScenario`
(par migrada/sucessora no mês corrente — prova o ciclo clique→scroll→destaque→foco). Usa um helper
puro `shift_months` (evita depender de `dateutil`) e dias fixos (1 e 2) para nunca cruzar a virada
de mês.

### `frontend/e2e/seedMonthlyPlanningScenario.ts` (NEW, 74 linhas)

**Função geral do arquivo** — Seed do ritual mensal (AC5/AC9): o mês corrente fica `active` com
uma pendência (alimenta a fonte bloqueante `previous-monthly` do alvo), o próximo mês nasce
`planning` (o alvo), com 1 item elegível por fonte — um template recorrente `monthly` ativo e uma
Task residente no Monthly Log do alvo sem `scheduled_date` (Future Log = monthly_log futuro,
AD-03).

### `frontend/e2e/monthly-board.spec.ts` (NEW, 341 linhas)

**Função geral do arquivo** — 12 testes E2E do Monthly Board cobrindo as 5 faixas + AC1/AC2/AC3.
O 12º teste ("Detalhe da tarefa: Cancelar transiciona o status; Excluir remove a linha", AC2) foi
acrescentado no passo de QA (molde direto do análogo do Weekly).

### `frontend/e2e/monthly-planning-ritual.spec.ts` (NEW, 288 linhas)

**Função geral do arquivo** — 13 testes E2E do ritual mensal cobrindo AC5/AC6/AC7, incluindo os 2
ramos de `destinationForTarget()` (`'month'` vs `'future'`) contra o backend real. O 13º teste
("offline desabilita decisões com motivo; clique fica guardado, sem fila local", AC7) foi
acrescentado no passo de QA (usando a fonte não-bloqueante `future-log` de propósito).

### `frontend/e2e/weekly-monthly-task-crud.spec.ts` (UPDATE, +89)

**Função geral da alteração** — Atualiza os testes de criação em "Este Mês": o teste "cria tarefa
em Este Mês" (antes "coberto por completude") vira **"cria tarefa em Este Mês com dia específico e
sem dia (AC1)"** e passa a usar **criação contextual** (`main.locator('[data-date="..."]')` para o
dia, `region 'Sem dia definido'` para o pool), assertando o `scheduledDate` do POST — o formulário
único do `MonthlyPage` legado deixou de existir. O teste de edição via painel compartilhado também
migra para o pool + `TaskDetailCard`. Comentário de cabeçalho atualizado documentando a segunda
migração (14.6).

### `frontend/e2e/move-task.spec.ts` (UPDATE, +29)

**Função geral da alteração** — O teste **"move de Este Mês para Futuro"** (nomeado explicitamente
pela AC9) foi **restaurado** no code-review (a entrega original o havia deletado, achado ALTO #4):
a criação migra para contextual (`pool.getByLabel('Título')`/`'Adicionar'`), mas o teste
**permanece falhando deliberadamente** no passo "Mover tarefa" — affordance que só `TaskRow.tsx`
legado expõe e que `TaskRowBase` genuinamente não tem (mesma causa-raiz dos outros 3 testes com
origem em "Esta Semana", pré-existentes da 14.5). Mantido como **registro executável** da
regressão (não `.skip`), com comentário extenso; os 4 excluídos do gate via `--grep-invert` até
uma decisão de produto sobre o wireup de `onMove` nos boards novos.

### `frontend/e2e/weekly-monthly-review.spec.ts` (UPDATE, +56)

**Função geral da alteração** — Substitui o trecho de Monthly (obsoleto): a asserção da seção
**"Itens do Future Log para \<Mês\>"** com ordem-no-DOM e o `getByLabel('Confirmar data')` inline
eram contrato do `MonthlyPage` legado — o Monthly Board novo não tem essa seção (itens do Future
Log aparecem no pool/célula como qualquer tarefa, decididos pelo ritual). O teste agora assera a
**ausência** dessas superfícies (`toHaveCount(0)`) e a presença do item no pool "Sem dia definido".
Também **corrige um achado pré-existente da 14.5** (fora de escopo mas bloqueante do gate): o
trecho semanal tinha um `strict mode violation` porque `TaskRowBase` renderiza subtarefas
aninhadas com o mesmo `data-testid="task-row"` do pai — resolvido com um `.filter({ hasNotText:
... })`. As linhas 1-119 (banners de revisão em `DailyPage`/`MonthlyReviewBanner`) **não mudam**.
