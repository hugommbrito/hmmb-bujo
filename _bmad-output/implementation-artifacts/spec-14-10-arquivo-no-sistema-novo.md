---
title: 'Story 14.10: Arquivo no sistema novo'
type: 'feature'
created: '2026-07-28'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_revision: '863e4a9e96e349f019272588b23a04f22f133d2d'
final_revision: '5d9997c4a8a3d924c859491f27c29ebbf5a474ff'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-14-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/mockups/key-archive.html'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/review-accessibility-archive.md'
warnings: ['oversized']
---

<intent-contract>

## Intent

**Problem:** O Arquivo hoje (`ArchivePage.tsx` + `WeeklyPage`/`MonthlyPage` legadas em `archive/weekly/:weekStart`/`archive/monthly/:monthFirst`) lista Weekly/Monthly fechados sem abas, sem filtro de período, com aparência `disabled` real (`text.disabled`) e sem navegação de linhagem entre períodos — violando a AC de contraste normal e a paridade de linhagem exigida.

**Approach:** Reescrever as 3 rotas já registradas (`archive`, `archive/weekly/:weekStart`, `archive/monthly/:monthFirst`) com componentes novos: índice com abas Semanal/Mensal + filtro de data (client-side, sobre `useArchiveQuery()` já existente) e detalhe por período reaproveitando `TaskRowBase`/`TaskDetailCard` (variant `readonly`) sobre `useWeeklyLogQuery(weekStart)`/`useMonthlyLogQuery(monthFirst)` (já parametrizados). Linhagem cross-período é capacidade nova: `TaskSerializer` ganha campo aditivo com a localização do sucessor; `TaskRowBase` ganha callback opcional invocado quando o sucessor não está no DOM atual, permitindo à página navegar para o período de destino.

## Boundaries & Constraints

**Always:**
- Escopo = Weekly + Monthly (paridade com `list_closed_cycles`, `backend/bujo/services/archive.py:76-104` — Daily/Future não têm conceito de "fechado", confirmado em `11-11-...md:32-33`).
- Índice (`useArchiveQuery()`, `frontend/src/features/bujo/api.ts:687-693`) permanece sem paginação/agregação/filtro no backend (`EXPERIENCE.md:371`); abas e filtro de data são só client-side sobre a lista já carregada.
- Detalhe reusa as queries parametrizadas já existentes (`useWeeklyLogQuery(weekStart)`, `useMonthlyLogQuery(monthFirst)` — `api.ts:215,298`) — nenhuma rota/endpoint de detalhe novo.
- Readonly derivado do estado REAL do período (`closed === true || status === 'finalized'`, mesmo padrão de `WeeklyBoardPage.tsx:132`/`MonthlyBoardPage.tsx:142`), nunca da rota — paridade com o bugfix da Story 11.11 (`isArchiveView` → gate por `closed`). Um período alcançado via seta de linhagem que NÃO está fechado renderiza mutável normalmente (mesmo componente, mesma derivação); só os fechados (sempre o caso ao entrar pela lista do índice) renderizam "Fechado"/"Somente leitura" sem mutação.
- Task Row/detalhe reaproveitam `TaskRowBase` (`variant="readonly"`) e `TaskDetailCard` (`readonly`, já suporta a prop) — sem nova anatomia, sem opacidade em título/descrição (só ícone de status terminal).
- Linhagem: só origem → sucessor imediato (nota D do mockup: bidirecional é `.working/future-vision/`, fora de escopo). Sucessor em Daily navega para a rota já existente `daily/:date`; em Weekly/Monthly navega para `archive/weekly/:weekStart`/`archive/monthly/:monthFirst`.
- Retorno (browser back / link) restaura aba, intervalo de datas, período selecionado, scroll e foco na seta de origem; chegada por linhagem foca a linha sucessora (`tabindex="-1"` + `aria-live="polite"`).
- Abas usam padrão ARIA completo (`tablist`/`tab`/`tabpanel`, roving tabindex, `Home`/`End`/setas) — corrige o High-3 do `review-accessibility-archive.md`.
- 3 rotas já registradas em `router.tsx:175,177-178,182-183` e `shellRouting.ts:74-76` (`surfaceMigrated: false`) — trocar só o componente montado e flipar `surfaceMigrated` para `true` nas 3 entradas. Sidebar (`shellDestinations.ts:62`) já existe, não tocar.
- `frontend/e2e/archive.spec.ts` deve continuar verde (tese: sem affordance de escrita, estados finais corretos, `migrationCount`), com seletores atualizados para a UI nova.

**Never:**
- Endpoint novo de detalhe ou de índice; paginação/busca/agregação no backend do Arquivo.
- Reaproveitar `TaskRow`/`WeeklyPage`/`MonthlyPage` legados (usam `text.disabled` real — proibido pela AC).
- Tocar tokens compartilhados de Weekly/Monthly ativos (débito de a11y pré-existente registrado em `deferred-work.md`, fora do Code Map desta story).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Índice vazio | `useArchiveQuery()` sem entradas do tipo da aba ativa | "Nenhuma semana/mês finalizado ainda.", sem período fantasma | — |
| Filtro sem resultado | Intervalo aplicado sem períodos no range | Empty mantém intervalo visível + "Limpar período" | — |
| Seta de linhagem, sucessor no período carregado | `migrated`/`postponed` com sucessor presente no DOM | Comportamento atual de `TaskRowBase` (scroll + highlight local) — sem mudança | — |
| Seta de linhagem, sucessor em outro período (Weekly/Monthly) | Sucessor fora do DOM, `migrationTarget` resolvido | Navega para `archive/weekly\|monthly/:key`, foca linha sucessora | — |
| Seta de linhagem, sucessor em Daily | `migrationTarget.type === 'daily'` | Navega para `daily/:date` | — |
| Sucessor em período ainda não fechado | Período de destino com `closed=false`/`status!='finalized'` | Página de detalhe renderiza mutável (mesma derivação `closed`/`status`) | — |
| Offline | `useOnlineStatus()` = false | Dados em cache legíveis; período sem cache mostra estado "não disponível offline", nunca vazio genérico | — |

</intent-contract>

## Code Map

- `backend/bujo/serializers.py:21-44` -- `TaskSerializer`: adicionar `SerializerMethodField` aditivo (ex. `migration_target`) expondo `{type, week_start|month_first|log_date}` de `migrated_to_task` (deriva de `weekly_log_id`/`monthly_log_id`/`log_id` do sucessor)
- `backend/bujo/models.py:210-217` -- `Task.migrated_to_task`/`migration_count` (campos já existentes, não tocar)
- `frontend/src/features/bujo/api.ts:687-693,215,298` -- `useArchiveQuery`, `useWeeklyLogQuery`, `useMonthlyLogQuery` (reuso, sem alteração de assinatura)
- `frontend/src/features/bujo/types.ts:31` -- `ArchiveEntry`; adicionar tipo para o novo campo do sucessor (gerado via `types.gen.ts`/`schema.yaml`)
- `frontend/src/features/bujo/components/TaskRowBase.tsx:108-111,155,161-162,210-221,268` -- `isLineageControl`/`handleLineageClick`/`successorAvailable`: adicionar prop opcional (ex. `onNavigateToSuccessor`) invocada quando o DOM lookup falha; sem prop = comportamento atual inalterado (Weekly/Monthly/Future/Migration boards não passam a prop)
- `frontend/src/features/bujo/components/TaskDetailCard.tsx:63,81` -- reuso com `readonly`
- `frontend/src/pages/archive/ArchivePage.tsx` (+ `.test.tsx`) -- reescrever: abas Semanal/Mensal (ARIA completo) + filtro de data client-side + lista mestre
- `frontend/src/pages/archive/ArchiveWeeklyDetailPage.tsx`, `ArchiveMonthlyDetailPage.tsx` (novos, + testes) -- substituem `WeeklyPage`/`MonthlyPage` nas rotas de Arquivo; day-groups (`days`/`unscheduled` no Weekly; agrupar por `scheduledDate` no Monthly) + drawer via `TaskDetailCard`
- `frontend/src/app/router.tsx:175,177-178,182-183` -- trocar `ArchivePage`(legado)/`WeeklyPage`/`MonthlyPage` pelos componentes novos nas 3 rotas já registradas
- `frontend/src/app/layout/shell/shellRouting.ts:74-76` -- `surfaceMigrated: false` → `true` nas 3 entradas de `archive*`
- `frontend/src/pages/planner/WeeklyPage.tsx`, `MonthlyPage.tsx` (+ testes) -- excluir: só são montados em `archive/weekly/:weekStart`/`archive/monthly/:monthFirst` (confirmado, nenhuma outra rota os usa); conteúdo legado de `ArchivePage.tsx` é substituído in-place (mesmo arquivo, reescrito)
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/mockups/key-archive.html`, `review-accessibility-archive.md` -- referência canônica + achados a corrigir na implementação real
- `frontend/e2e/archive.spec.ts`, `seedArchiveScenario.ts` -- atualizar seletores, preservar a tese

## Tasks & Acceptance

**Execution:**
- `backend/bujo/serializers.py` -- campo aditivo de localização do sucessor em `TaskSerializer` -- habilita navegação cross-período sem novo endpoint
- `cd backend && uv run python manage.py spectacular --file ../schema.yaml` + `cd frontend && npm run generate-types` -- regenerar `schema.yaml`/`types.gen.ts` com o campo novo do sucessor
- `frontend/src/pages/archive/ArchivePage.tsx` -- índice novo (abas + filtro + lista)
- `frontend/src/features/bujo/components/TaskRowBase.tsx` -- prop de navegação cross-período (aditiva, default no-op) -- pré-requisito das páginas de detalhe abaixo
- `frontend/src/pages/archive/ArchiveWeeklyDetailPage.tsx`, `ArchiveMonthlyDetailPage.tsx` -- detalhe readonly/mutável por estado real, day-groups, drawer, seta de linhagem cross-período (consome a prop nova)
- `frontend/src/app/router.tsx`, `shellRouting.ts` -- rewire das 3 rotas + flip de `surfaceMigrated`
- `frontend/src/pages/planner/WeeklyPage.tsx`, `MonthlyPage.tsx` (+ testes) -- excluir (sem outro consumidor após o rewire)
- `frontend/e2e/archive.spec.ts`, `frontend/e2e/archive-lineage.spec.ts` (novo) -- cobrir abas, filtro, detalhe readonly, seta cross-período (Weekly→Monthly, Monthly→Daily), retorno com estado preservado, offline, axe wide/medium/compact/tablet

**Acceptance Criteria:**
- Given ciclos Weekly/Monthly finalizados, when o Arquivo renderiza, then abas Semanal/Mensal → filtro de data → lista de períodos → detalhe readonly, com "Fechado"/"Somente leitura" textuais, contraste normal (sem `text.disabled`) e nenhum controle de mutação
- Given uma tarefa `migrated`/`postponed` com sucessor em outro período, when o usuário aciona a seta de linhagem, then navega ao período de destino (Weekly/Monthly via rota de Arquivo, Daily via `daily/:date`), foca a linha sucessora, e o retorno restaura aba/intervalo/período/scroll/foco na seta de origem
- Given o período de destino da linhagem NÃO está fechado, when a página de detalhe carrega, then renderiza mutável (sem "Fechado"), mesma derivação usada pelos boards ativos
- Given `frontend/e2e/archive.spec.ts`, when a suíte roda contra a UI nova, then continua verde com a mesma tese (sem `Alocar`, sem requisição de templates, `migrationCount` no payload)

## Design Notes

`TaskRowBase` não pode saber, por si só, se um sucessor fora do DOM está em outro período navegável ou simplesmente ausente — por isso a extensão é uma prop opcional de callback, não uma reescrita da lógica de `successorAvailable`. Quando a página de Arquivo tem o `migrationTarget` resolvido (do campo novo do backend), ela passa o callback; quando ausente (demais boards), o comportamento atual (aria-disabled mudo) sobrevive inalterado — zero regressão fora do Arquivo.

A distinção "fechado vs. não fechado" no destino da linhagem não é uma escolha de UX nova: é o mesmo bug já corrigido na Story 11.11 (`isArchiveView` gateando escrita por rota em vez de `closed`) aplicado ao sistema novo — o destino da linhagem é sempre renderizado pela verdade ao vivo do período (`closed`/`status`), nunca por "estar dentro do Arquivo".

## Verification

**Commands:**
- `npx tsc -b --noEmit` -- limpo
- `npm run lint` -- limpo
- `npx vitest run` -- sem regressão nos números atuais + novos testes desta story
- `uv run pytest -q` -- sem regressão
- `uv run ruff check .` / `uv run lint-imports` -- limpos
- `uv run python manage.py makemigrations --check --dry-run` -- "No changes detected" (campo é `SerializerMethodField`, sem migration)
- `git diff --stat -- schema.yaml frontend/src/api/types.gen.ts` -- só o campo novo do sucessor
- `nvm use 22.15.1 && CI=1 npx playwright test e2e/archive.spec.ts e2e/archive-lineage.spec.ts --retries=0` -- 100% verde

## Review Triage Log

### 2026-07-28 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 10 (high 2, medium 4, low 4)
- defer: 4
- reject: 4
- addressed_findings:
  - `[high]` `[patch]` `TaskRowBase.tsx` não repassa `onNavigateToSuccessor` na recursão de subtarefas (linha ~448) -- seta de linhagem cross-período de uma subtarefa migrada/postponed nunca navega, mesmo com `migrationTarget` resolvido
  - `[high]` `[patch]` Nenhum teste unitário cobre o estado offline (`useOnlineStatus() = false`) em `ArchiveWeeklyDetailPage.tsx`/`ArchiveMonthlyDetailPage.tsx` -- linha da matriz "Offline" não tem cobertura de teste no lado do detalhe (convenção estabelecida em todo outro consumidor de `useOnlineStatus` no repo)
  - `[medium]` `[patch]` `ArchiveMonthlyDetailPage.tsx` -- campo "Dia (opcional)" do form de criação é `<input type="date">` sem `min`/`max`, permite `scheduledDate` fora do mês exibido
  - `[medium]` `[patch]` Restauração de "último período" (scroll + destaque) em `ArchivePage.tsx` ao retornar do detalhe não tem nenhum teste (unit ou e2e) que verifique o comportamento
  - `[medium]` `[patch]` `ArchiveWeeklyDetailPage.test.tsx`/`ArchiveMonthlyDetailPage.test.tsx` não exercitam o form de criação de tarefa (mutation, guarda de título vazio, refetch) -- cobertura existia nos testes legados excluídos
  - `[medium]` `[patch]` Botão "Voltar ao Arquivo" (`ArchiveWeeklyDetailPage.tsx:258`, equivalente no Monthly) é link fixo para `/archive` sem querystring, descarta aba/filtro selecionados -- inconsistente com o retorno via browser back
  - `[low]` `[patch]` `get_migration_target` declara `MigrationTargetSerializer` só para `@extend_schema_field`, mas monta a resposta como dict manual nunca serializado/validado por ela -- diverge do padrão irmão (`get_subtasks`) no mesmo arquivo
  - `[low]` `[patch]` `ArchivePage.tsx`/`ArchiveWeeklyDetailPage.tsx`/`ArchiveMonthlyDetailPage.tsx` -- ramo `isError` não distingue offline (só o ramo `isPending` verifica `isOnline`), mostra erro genérico com retry que não pode funcionar offline
  - `[low]` `[patch]` Rótulo de contagem de resultados do filtro em `ArchivePage.tsx` atualiza sem `aria-live`/`role="status"`, mudança não é anunciada a leitor de tela
  - `[low]` `[patch]` Filtro de intervalo em `ArchivePage.tsx` aceita "Data inicial" > "Data final" sem validação, mostra a mesma mensagem genérica de um intervalo vazio legítimo

### 2026-07-28 — Review pass (pós reimplementação; código da tentativa anterior havia sido perdido em rollback do bmad-loop — ver nota abaixo)
- intent_gap: 0
- bad_spec: 0
- patch: 7 (high 1, medium 3, low 3)
- defer: 2 (medium 2)
- reject: 2 (low 2)
- addressed_findings:
  - `[high]` `[patch]` `ArchivePage.tsx` -- links da lista de entradas não passavam `state.archiveReturnQuery` (só `handleNavigateToSuccessor` fazia isso) -- quebrava a restauração de aba/filtro/scroll/foco no fluxo primário índice→detalhe→"Voltar ao Arquivo" (só funcionava vindo de um salto de linhagem); corrigido: links da lista agora constroem e passam o mesmo `state`
  - `[medium]` `[patch]` `backend/bujo/serializers.py` -- `get_migration_target` sem `select_related`, N+1 por tarefa migrada/postponed em qualquer listagem -- corrigido: `MIGRATED_TO_TASK_SELECT_RELATED` aplicado em `LogSerializer.get_tasks`/`WeeklyLogView.get`/`MonthlyLogView.get`
  - `[medium]` `[patch]` `archiveLineageReturn.ts` + páginas de detalhe -- navegação cross-período fazia no-op silencioso quando `pathForMigrationTarget` retornava null -- corrigido: mensagem de erro visível (`role="alert"`) em vez de clique morto
  - `[medium]` `[patch]` `ArchiveMonthlyDetailPage.tsx` -- campo "Dia" com `min`/`max` só HTML, sem validação em `handleSubmit` -- corrigido: guarda JS explícita (`dayError`) antes da mutation
  - `[low]` `[patch]` `ArchiveWeeklyDetailPage.tsx`/`ArchiveMonthlyDetailPage.tsx` -- `findTaskById` duplicado -- corrigido: reuso do helper compartilhado de `taskTree.ts`
  - `[low]` `[patch]` `test_serializers.py` -- ramo "sem container" de `get_migration_target` sem teste -- corrigido: teste adicionado
  - `[low]` `[patch]` `archiveLineageReturn.ts` -- entrada de `sessionStorage` só era limpa no caminho de sucesso do foco, vazando quando a linha de origem não reaparece -- corrigido: limpa imediatamente após a leitura, antes de tentar focar

**Nota sobre esta sessão:** ao iniciar este pass, o working tree não continha NENHUMA implementação (verificado: `ArchivePage.tsx` ainda era a versão legada, sem `migration_target` em `serializers.py`, sem `ArchiveWeeklyDetailPage.tsx`), apesar do frontmatter indicar `status: in-review` com o Review Triage Log acima já preenchido. O histórico do git (`refs/attempt-preserve-dirty/20260728-*`) confirma que uma tentativa anterior do bmad-loop implementou e revisou a story (produzindo o pass de 2026-07-28 acima), mas foi revertida (`reset` para `d128a3d`) e só o spec-file + `deferred-work.md` foram recuperados manualmente (commit `863e4a9`), sem o código. `baseline_revision` foi atualizado para `863e4a9` e a story foi reimplementada do zero contra este spec (já "Ready for Development") antes deste review pass rodar sobre o diff real.

### 2026-07-28 — Review pass (fresh review pós `status: done`, sobre `863e4a9..891997c`)
- intent_gap: 0
- bad_spec: 0
- patch: 5 (high 0, medium 2, low 3)
- defer: 0
- reject: 6
- addressed_findings:
  - `[medium]` `[patch]` `ArchiveWeeklyDetailPage.tsx`/`ArchiveMonthlyDetailPage.tsx` -- `arrivalHandledRef` só resetava por `weekStart`/`monthFirst`, nunca por navegação; uma segunda chegada por linhagem no MESMO período já montado (novo `location.state.focusTaskId`) nunca focava a linha sucessora -- corrigido: reset também por `location.key`; teste de regressão adicionado em ambas as páginas (navegação real via `createMemoryRouter`/`router.navigate`, confirmado que falha sem o fix)
  - `[medium]` `[patch]` `ArchivePage.tsx` -- filtro de intervalo na aba Mensal comparava só `monthFirst` (sempre dia 1) contra os limites de dia informados, excluindo o mês inteiro mesmo com metade dele dentro do range escolhido -- corrigido: `entryPeriodEnd` usa o último dia do mês para o teste de overlap, escopado à aba Mensal (a semântica da aba Semanal, não reportada como quebrada por nenhum revisor, ficou inalterada); teste de regressão adicionado
  - `[low]` `[patch]` `backend/bujo/serializers.py` `get_subtasks` -- sem `select_related` para `migrated_to_task`, reintroduzindo para subtarefas migradas/adiadas o mesmo N+1 que a story já havia corrigido em `LogSerializer.get_tasks`/`WeeklyLogView`/`MonthlyLogView` -- corrigido: mesmo `select_related(*MIGRATED_TO_TASK_SELECT_RELATED)` aplicado
  - `[low]` `[patch]` `backend/bujo/views.py` `FutureLogView.get` -- endpoint irmão pré-existente com a mesma lacuna de N+1, exposta pelo `migration_target` novo -- corrigido: `select_related` aplicado à mesma queryset
  - `[low]` `[patch]` `ArchivePage.tsx` -- `entryKey` (usada para destaque/`sessionStorage`) não distinguia tipo, colidindo quando uma semana começa no dia 1 de um mês com o mesmo `monthFirst` -- corrigido: nova `entryIdKey` (`${type}:${key}`) para identidade/destaque; `entryKey` seguiu reservada ao filtro de data; teste de regressão adicionado
- rejects notáveis (fora do escopo do intent ou já coberto por outra lente):
  - Ausência de foco/scroll ao chegar via linhagem em `DailyPage.tsx` (Monthly/Weekly→Daily) -- a própria matriz I/O do `<intent-contract>` só exige "Navega para `daily/:date`" para o alvo Daily, sem "foca linha sucessora" (diferente da linha Weekly/Monthly) -- comportamento intencional, não lacuna
  - Ausência de `RecurringPlacementSection`/`RecurringPlacementDialog`/drag-drop nas páginas de detalhe do Arquivo quando o período alcançado por linhagem NÃO está fechado -- o próprio `<intent-contract>` (Approach) só nomeia `TaskRowBase`/`TaskDetailCard` como componentes reaproveitados; paridade completa com os boards ativos nunca foi prometida ali, e um pass de review anterior já rejeitou o mesmo achado
  - Falta de teste `assertNumQueries` para o N+1 (query count não é contrato observável do consumidor)
  - Fragilidade teórica de `focusTaskRow` a um reorder futuro de `TaskRowBase`; duplicação do padrão de `sessionStorage` entre `ArchivePage`/`archiveLineageReturn`; `handleTabKeyDown` assumindo 2 abas para sempre -- preocupações especulativas/de manutenção, sem cenário de falha atual
- Verificação: `npx tsc -b --noEmit` limpo; `npm run lint` limpo; `npx vitest run` 140 arquivos/1815 testes verdes (incl. os novos desta rodada); `uv run pytest -q` 1319 testes verdes; `uv run ruff check .`/`uv run lint-imports` limpos; `makemigrations --check --dry-run` sem mudanças; `schema.yaml`/`types.gen.ts` sem diff (fixes são internos, sem mudança de contrato); `CI=1 npx playwright test e2e/archive.spec.ts e2e/archive-lineage.spec.ts --retries=0` 8/8 verdes

### 2026-07-28 — Review pass (fresh review pós `status: done`, sobre `863e4a9..7b8b063`)
- intent_gap: 0
- bad_spec: 0
- patch: 6 (high 0, medium 2, low 4)
- defer: 0
- reject: 4
- addressed_findings:
  - `[medium]` `[patch]` `ArchivePage.tsx` -- `entryPeriodEnd` calculava o fim real do período só para a aba Mensal (`lastDayOfMonth`); a aba Semanal caía num ponto único (`weekStart`), reintroduzindo para Semanal o MESMO bug de overlap que a review anterior desta story já havia corrigido só para Mensal -- semanas finalizadas que sobrepunham o início do range filtrado eram excluídas silenciosamente -- corrigido: `entryPeriodEnd` usa `addDaysIso(weekStart, 6)` para semanal; o teste que travava o comportamento errado como esperado foi reescrito com um cenário de overlap genuíno (regressão confirmada)
  - `[medium]` `[patch]` `ArchiveWeeklyDetailPage.tsx`/`ArchiveMonthlyDetailPage.tsx` -- `findPredecessor` só varria tarefas de NÍVEL RAIZ (dias/lista flat), ao contrário de `findTaskById` (usado para abrir o detalhe) que recorre em `subtasks` -- uma SUBTAREFA migrada/adiada cujo sucessor é aberto no mesmo período nunca mostrava "Veio de" -- mesma classe de bug que a review anterior já havia corrigido para `onNavigateToSuccessor` em `TaskRowBase.tsx`, agora do lado da busca de predecessor -- corrigido nas duas páginas (`findPredecessorTask`/`hasPredecessorTask` recursivos); teste de regressão adicionado em ambas
  - `[low]` `[patch]` `ArchiveMonthlyDetailPage.tsx` -- `dayError` só era limpo no próximo submit, nunca ao editar o campo -- corrigir a data e ver o banner de erro permanecer visível até resubmeter -- corrigido: `onChange` do campo de dia também limpa `dayError`
  - `[low]` `[patch]` `ArchivePage.tsx` -- a validação `draftFrom > draftTo` só rodava dentro do handler de submit (`applyRange`); `appliedFrom`/`appliedTo` (lidos direto da querystring) nunca passavam por ela -- um link/bookmark editado à mão com range invertido chegava a resultado indefinido (podia incluir entradas incorretamente, não só "vazio silencioso") sem nenhum aviso -- corrigido: `appliedRangeInvalid` computado a partir da URL, mesma mensagem de erro exibida; teste de regressão adicionado
  - `[low]` `[patch]` `ArchivePage.tsx` -- o efeito de restaurar destaque do "último período visitado" comparava a entrada salva contra `archive.data` inteiro (ignorando a aba ativa) e limpava o `sessionStorage` incondicionalmente -- uma entrada de tipo diferente da aba ativa (ex.: mensal salvo, aba Semanal por padrão) era descartada sem nunca ter chance de restaurar -- corrigido: só consome/limpa a entrada quando o tipo bate com a aba ativa; teste de regressão adicionado
  - `[low]` `[patch]` `TaskRowBase.tsx` -- comentário do cabeçalho do módulo ainda citava a `WeeklyPage` legada de `archive/weekly/:weekStart` como consumidora, mas esta story já a excluiu -- corrigido: comentário atualizado
- rejects notáveis (fora do escopo do intent ou já coberto por outra lente):
  - Navegar para o sucessor de OUTRA tarefa (linhagem cross-período) descarta silenciosamente texto não salvo no formulário "Adicionar tarefa" da página de detalhe atual -- mesmo padrão de todo o app (sem diálogo de confirmação de alterações não salvas em nenhum outro fluxo de navegação existente, incl. Daily/Weekly/Monthly board) -- não é uma regressão desta story, é paridade com a convenção estabelecida
  - Ausência de navegação "Semana anterior/Próxima semana" e "Mês anterior/Próximo mês" nas páginas novas de detalhe (presente na `WeeklyPage`/`MonthlyPage` legadas, que a story excluiu) -- nunca foi exigida pelo `<intent-contract>` (Approach/Boundaries não mencionam paginação sequencial entre períodos) nem coberta por `archive.spec.ts` antes desta story (confirmado: zero menção a "anterior"/"próxim" no spec e2e do commit-base `863e4a9`) -- leitura mais defensável dado o nível de detalhe do resto do Sempre/Nunca desta spec: simplificação deliberada do redesenho (índice+filtro+linhagem substitui paginação livre), não uma lacuna
  - Título vazio/só espaços no formulário de criação das novas páginas de detalhe faz no-op silencioso, sem erro nem estado disabled -- confirmado como a MESMA convenção já usada pelo `AddTaskRow` compartilhado (consumido por `DailyPage.tsx`, entre outros): `trim()` e `if (!trimmed) return`, sem feedback -- paridade com o padrão estabelecido do app, não uma lacuna desta story
  - Diferença de API do MUI (`inputProps` vs `slotProps`) entre o campo "Dia" de `ArchiveWeeklyDetailPage.tsx` (`<Select>` sobre um conjunto fechado de ≤7 dias da semana) e `ArchiveMonthlyDetailPage.tsx` (`<input type="date">` livre dentro do mês, precisa de `min`/`max`) -- não é uma inconsistência entre páginas irmãs, são controles genuinamente diferentes para formatos de dado diferentes
- Verificação: `npx tsc -b --noEmit` limpo; `npm run lint` limpo; `npx vitest run` 140 arquivos/1819 testes verdes (incl. 4 novos testes de regressão desta rodada); `uv run pytest -q` 1319 testes verdes (sem alteração no backend nesta rodada); `uv run ruff check .`/`uv run lint-imports` limpos; `makemigrations --check --dry-run` sem mudanças; `git diff --stat -- schema.yaml frontend/src/api/types.gen.ts` sem diff; `CI=1 npx playwright test e2e/archive.spec.ts e2e/archive-lineage.spec.ts --retries=0` 8/8 verdes

## Auto Run Result

**Resumo:** Rodada de dev-auto acionada com o spec já `status: done`, disparando uma review fresca (`review_loop_iteration` resetado para `0`) sobre o diff acumulado `863e4a9..7b8b063` (todas as 3 rodadas de review anteriores desta story incluídas). Quatro subagentes de review rodaram em paralelo (adversarial, edge-case-hunter, verification-gap, intent-alignment auditor); os três primeiros convergiram independentemente no mesmo achado principal (bug de overlap do filtro de período na aba Semanal, sibling do bug já corrigido só para Mensal numa rodada anterior). 6 achados foram classificados `patch` e corrigidos nesta sessão, 4 foram `reject` (paridade com convenções já estabelecidas no app ou simplificação deliberada do redesenho, sem exigência no `<intent-contract>`), 0 `defer` (nada novo para `deferred-work.md`).

**Arquivos alterados (patches desta sessão):**
- `frontend/src/pages/archive/ArchivePage.tsx` -- `entryPeriodEnd` ganhou o ramo semanal (`addDaysIso(weekStart, 6)`, igual ao mensal); `appliedRangeInvalid` computado direto da querystring (não só do handler de submit); efeito de restaurar "último período visitado" agora respeita a aba ativa antes de consumir/limpar o `sessionStorage`
- `frontend/src/pages/archive/ArchiveWeeklyDetailPage.tsx`, `ArchiveMonthlyDetailPage.tsx` -- `findPredecessor` agora recorre em `subtasks` (`findPredecessorTask`/`hasPredecessorTask`); `ArchiveMonthlyDetailPage.tsx` também limpa `dayError` no `onChange` do campo de dia, não só no próximo submit
- `frontend/src/features/bujo/components/TaskRowBase.tsx` -- comentário do cabeçalho atualizado (não citava mais a `WeeklyPage` legada, já excluída)
- `frontend/src/pages/archive/ArchivePage.test.tsx`, `ArchiveWeeklyDetailPage.test.tsx`, `ArchiveMonthlyDetailPage.test.tsx` -- testes de regressão para os achados testáveis (o teste do filtro semanal, que travava o bug como comportamento esperado, foi reescrito com um cenário de overlap genuíno)

**Achados da review — resumo:** ver `## Review Triage Log` acima (entrada `2026-07-28 — Review pass (fresh review pós status: done, sobre 863e4a9..7b8b063)`) para o detalhamento completo de patches/rejects.

**Recomendação de review de acompanhamento:** `true` -- 6 patches nesta passada (0 high, 2 medium, 4 low); score `3×2 + 1×4 = 10 ≥ 5`.

**Verificação:** `npx tsc -b --noEmit` limpo; `npm run lint` limpo; `npx vitest run` -- 140 arquivos, 1819 testes verdes; `uv run pytest -q` -- 1319 testes verdes; `uv run ruff check .` / `uv run lint-imports` limpos; `makemigrations --check --dry-run` -- "No changes detected"; `git diff --stat -- schema.yaml frontend/src/api/types.gen.ts` -- sem diff (fixes internos, sem mudança de contrato); `CI=1 npx playwright test e2e/archive.spec.ts e2e/archive-lineage.spec.ts --retries=0` -- 8/8 verdes.

**Riscos residuais:** nenhum novo identificado além dos já registrados em `deferred-work.md` de passes anteriores desta story. Um achado da lente intent-alignment (não classificado como bug de código) apontou que `deferred-work.md` ainda lista como abertos 3 itens `[low]` (offline/`aria-live`/validação de range) que já estão implementados no código atual -- não é um achado desta review (o mecanismo do orquestrador para o ledger é só acrescentar, nunca reabrir/reescrever entradas existentes), então nenhuma entrada existente foi tocada; sinalizado aqui só para o orquestrador avaliar a reconciliação. `_bmad-output/implementation-artifacts/sprint-status.yaml` permanece modificado no working tree (alteração pré-existente à sessão, fora do escopo deste diff) -- não commitado, não tocado.

