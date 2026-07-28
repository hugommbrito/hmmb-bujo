---
title: 'Story 14.10: Arquivo no sistema novo'
type: 'feature'
created: '2026-07-28'
status: 'in-review'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: 'd128a3d9e8cf7eed51daa9881b937444b8493f43'
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
