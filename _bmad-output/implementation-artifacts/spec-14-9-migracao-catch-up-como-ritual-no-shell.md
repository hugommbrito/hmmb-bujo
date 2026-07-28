---
title: 'Story 14.9: Migração/Catch-Up como ritual no shell (M10)'
type: 'feature'
created: '2026-07-27'
status: 'in-progress'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: '098d76abfe7d1bc5eca3a6707c22847f5db4b099'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-14-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/mockups/key-migracao.html'
warnings: ['oversized']
---

<intent-contract>

## Intent

**Problem:** Hoje (Daily) mostra dois banners separados (`MigrationBanner`+`CatchUpBanner`), cada um abrindo seu próprio `Dialog` (`MigrationFlow`/`CatchUpFlow`) sobre as filas legadas; a fila unificada (`GET /api/bujo/migration/unified-queue/`, Story 14.3) já está pronta no backend mas sem nenhum consumidor de frontend, e o fluxo atual não tem pausar/retomar nem destino flexível.

**Approach:** Unificar os dois banners num só, alimentado pela fila unificada; abrir um ritual **roteado dentro do shell** (mesma composição rail-de-fontes + lista + rail-de-contexto do Weekly/Monthly planning, `WeeklyPlanningPage.tsx:393-477`) em vez de `Dialog`; estender o destination picker existente para as 3 abas do mockup; fechar com um resumo factual.

## Boundaries & Constraints

**Always:**
- Único dado de leitura: `unified_migration_queue`/`GET /api/bujo/migration/unified-queue/` (`backend/bujo/services/migration.py:233-313`, view em `views.py:654`). Nenhum endpoint novo, nenhuma migration, nenhuma mudança de schema/serializer no backend.
- Única mutação, para **toda** decisão (migrar hoje/semana/mês/futuro/cancelar): `POST /api/bujo/tasks/{id}/migrate/` via `useMigrateTaskMutation` (`api.ts:436`) — mesmo verbo que `MigrationCard` já usa.
- Novo hook `useUnifiedMigrationQueueQuery` + chave `['bujo','unifiedMigrationQueue','list']` (molde de `keys.ts:25-28`); `useMigrateTaskMutation` passa a invalidar também essa chave.
- Ritual é uma **página roteada dentro do `ShellLayout`** (não `Dialog`, não overlay full-screen) — nova rota top-level `migration` em `router.tsx` (irmã de `today`/`archive`/`settings`), landmark `<main aria-label="Migração">`, `shellRouting.ts` com `surfaceMigrated: true` **só para essa rota nova** (Daily continua `false`).
- Composição da página: rail-de-fontes (molde `WeeklySourceRail.tsx`) + lista de decisão (molde `WeeklyDecisionList.tsx`, incl. foco no próximo pendente ao decidir) + rail de contexto (molde `WeeklyContextRail.tsx`/`MonthlyContextRail.tsx`, adaptado: progresso decidido/total + fontes revisadas + tally migradas/adiadas/canceladas **em memória, escopado à sessão da página** — sem posição persistida, conforme decisão fechada do mockup).
- Destination picker: **promover** `MonthlyDestinationPicker.tsx` (que já documenta essa intenção no próprio cabeçalho, `:15-21`) para um componente compartilhado de nome neutro com 3 abas — Esta semana (dia-da-semana, molde `WeeklyDestinationPicker.tsx`) · Dia no mês · Outro mês —, atalhos Hoje/Sem dia definido, confirmação com rótulo nomeado ("Migrar para quarta, 23 de julho").
- Banner novo (`.mnotice` do mockup, seção A): "N tarefas precisam de decisão · X de meses · Y de semanas · Z de dias" + botão "Migrar ›"; vazio = sem DOM algum. Variante pausada "Migração pausada · N de M restantes" — `M` é o total capturado em `sessionStorage` quando o ritual abriu nesta sessão de navegador (única chave, ex. `migrationRitualSessionTotal`; não é posição nem histórico), `N` vem ao vivo da fila; se não houver `M` salvo (primeira leitura, sem sessão de ritual aberta ainda), o banner mostra só a contagem simples (variante não-pausada). Mantém `WeeklyReviewBanner`/`MonthlyReviewBanner` intocados em `DailyPage.tsx`.
- Ações da linha de decisão: **Migrar para hoje** (destaque) / **Escolher destino…** / **Cancelar** (via `destination: 'cancel'`) — nunca "Concluir".
- Ações sem sucesso mostram erro inline + retry por item (sem toast); offline desabilita decisões com motivo (`useOnlineStatus()`, sem fila local).
- Estados obrigatórios (loading/empty/read-error/write-error/offline/parcial-por-fonte) + axe-core (wide/medium/tablet/compact/reflow 320) com rail, lista, rail-de-contexto, destination picker e resumo **abertos** (lição das 14.6/14.7: nunca medir estrutura ARIA fechada).
- Arquivos legados (`MigrationBanner.tsx`, `CatchUpBanner.tsx`, `MigrationFlow.tsx`, `MigrationCard.tsx`, `CatchUpFlow.tsx`, views/aliases legados) permanecem no repo intocados em comportamento, só desmontados de `DailyPage.tsx` — mesmo padrão de rollback-por-arquivo das 14.5-14.8.
- `frontend/e2e/unified-migration-queue.spec.ts` e `migration-flow.spec.ts` continuam passando sem alteração de tese (provam matemática da fila e o fluxo legado, que seguem existindo).

**Block If:** nenhuma decisão bloqueante identificada — mockup + epic context já fecham nome da fila, verbo de mutação, ausência de "Concluir" e semântica de resume ("restam itens, sem posição exata").

**Never:**
- Não criar linhas em `ritual_decisions`/`RitualDecision` para decisões de migração — a mutação em si é a persistência (`services/rituals.py`, docstring de `models.py:275-277`); esse mecanismo é exclusivo das decisões `keep`/`skip_week`/`keep_undated` do ritual semanal/mensal.
- Não implementar fila/estado local para escrita offline.
- Não tocar `WeeklyReviewBanner`/`MonthlyReviewBanner` (preocupação separada).
- Não migrar `today`/`daily/:date` para `surfaceMigrated: true` — só a nova rota `migration` o é.
- Não deletar nem `.skip` nenhum teste dos dois specs E2E legados citados acima.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fila vazia | `unified-queue` retorna `totalCount: 0` | Banner não renderiza (sem DOM) | — |
| Decidir último item de uma fonte | Ação bem-sucedida no único pendente da fonte | Fonte marca "revisada" no rail; foco move para o heading da fonte; se era a última fonte, ritual mostra resumo | — |
| Escolher destino → Outro mês | Usuário abre "Escolher destino…", aba "Outro mês", confirma | `POST /migrate/` com `destination:'future', monthFirst` | — |
| Falha de escrita | `POST /migrate/` retorna erro | Item permanece na lista com motivo inline + retry; decisão não se perde | Retry local no mesmo item |
| Offline | `useOnlineStatus()` = false | Ações de decisão desabilitadas com motivo visível; leitura da fila continua | Sem fila local |
| Pausar e retomar | Usuário navega para fora da rota `migration` e volta | Banner mostra variante pausada com "N de M restantes" (`M` de `sessionStorage`, `N` ao vivo); reabrir a rota refaz a query e mostra os itens restantes (tally de resumo reinicia; `M` do banner persiste até a fila zerar) | — |

</intent-contract>

## Code Map

- `backend/bujo/services/migration.py:233-313` -- `unified_migration_queue`, fonte de dados única (não tocar)
- `backend/bujo/views.py:654` -- `UnifiedMigrationQueueView`, endpoint já existente a consumir
- `frontend/src/features/bujo/api.ts:436` -- `useMigrateTaskMutation`, adicionar hook `useUnifiedMigrationQueueQuery` e chave de invalidação
- `frontend/src/api/keys.ts:25-28` -- molde de chave para a nova `unifiedMigrationQueue`
- `frontend/src/pages/daily/DailyPage.tsx:100-121` -- trocar `MigrationBanner`+`CatchUpBanner` pelo banner unificado
- `frontend/src/features/bujo/components/MigrationBanner.tsx`, `CatchUpBanner.tsx` -- desmontar (não editar comportamento)
- `frontend/src/pages/planner/WeeklyPlanningPage.tsx:393-477` -- molde de composição rail+lista+context-rail
- `frontend/src/features/bujo/components/weekly/WeeklySourceRail.tsx` -- molde do rail de fontes
- `frontend/src/features/bujo/components/weekly/WeeklyDecisionList.tsx` -- molde da lista de decisão (foco contínuo, erro por item)
- `frontend/src/features/bujo/components/weekly/WeeklyContextRail.tsx`, `.../monthly/MonthlyContextRail.tsx` -- molde do rail de contexto (adaptar: progresso + tally)
- `frontend/src/features/bujo/components/monthly/MonthlyDestinationPicker.tsx:15-21` -- promover para componente compartilhado (o próprio cabeçalho já documenta a intenção)
- `frontend/src/features/bujo/components/weekly/WeeklyDestinationPicker.tsx` -- fonte da aba "Esta semana"
- `frontend/src/app/router.tsx:107-163` -- registrar rota nova `migration`
- `frontend/src/app/layout/shell/shellRouting.ts:50-51` -- entrada `surfaceMigrated: true` para a rota `migration`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/mockups/key-migracao.html` -- mockup canônico (frames A-F)
- `frontend/e2e/unified-migration-queue.spec.ts`, `migration-flow.spec.ts` -- conferir sem quebrar, não duplicar cobertura

## Tasks & Acceptance

**Execution:**
- `frontend/src/features/bujo/api.ts` -- criar `useUnifiedMigrationQueueQuery` (`GET /api/bujo/migration/unified-queue/`) + invalidar a nova chave em `useMigrateTaskMutation` -- fila unificada precisa de consumidor de frontend
- `frontend/src/api/keys.ts` -- adicionar `unifiedMigrationQueue: () => ['bujo','unifiedMigrationQueue','list']`
- `frontend/src/features/bujo/components/migration/` (pasta nova) -- `MigrationRitualBanner.tsx` (unifica os 2 banners legados), `MigrationSourceRail.tsx`/reuso, `MigrationDecisionList.tsx`/reuso, `MigrationContextRail.tsx` (progresso + tally em memória), `MigrationSummary.tsx` (resumo factual) -- superfície nova do ritual, granularidade a critério do dev, co-locada com testes
- `frontend/src/features/bujo/components/DestinationPicker.tsx` (promovido de `MonthlyDestinationPicker.tsx`, absorvendo `WeeklyDestinationPicker.tsx`) -- 3 abas (Esta semana/Dia no mês/Outro mês) + atalhos -- reuso único do picker pelas 3 superfícies (Weekly/Monthly/Migração)
- `frontend/src/pages/MigrationRitualPage.tsx` (+ `.test.tsx`) -- compõe banner de origem/rail/lista/context-rail/resumo, landmark `<main aria-label="Migração">`
- `frontend/src/app/router.tsx` -- rota `migration` nova
- `frontend/src/app/layout/shell/shellRouting.ts` (+ `.test.ts`) -- `surfaceMigrated: true` para `migration`
- `frontend/src/pages/daily/DailyPage.tsx` -- trocar os 2 banners legados pelo `MigrationRitualBanner`
- `frontend/e2e/migration-ritual.spec.ts` (novo) -- banner unificado, abrir ritual roteado (não Dialog), decidir com os 3 destinos, pausar (navegar para fora) e retomar, resumo factual, offline, 5 faixas de axe com overlays abertos
- Guard de literais (`noLiteralTokens.test.ts` equivalente na pasta `migration/`) -- nenhum token novo, nenhum literal estrutural

**Acceptance Criteria:**
- Given a fila unificada com itens de mês/semana/dia, when a página `migration` abre, then mostra rail Meses→Semanas→Dias com contagem por fonte, lista de decisão com origem/linhagem, e rail de contexto com progresso/decidido/restante — nunca `Dialog` nem overlay full-screen
- Given um item pendente, when o usuário escolhe "Migrar para hoje"/"Escolher destino…"/"Cancelar", then a única mutação é `POST /migrate/` com o `destination` correspondente, sem "Concluir" em nenhum lugar da UI
- Given todas as decisões tomadas, when a última fica sem pendências, then um resumo factual (migradas/adiadas/canceladas) precede a volta a "Hoje"
- Given `MigrationBanner`/`CatchUpBanner` removidos de `DailyPage.tsx`, when `unified-migration-queue.spec.ts`/`migration-flow.spec.ts` rodam, then continuam verdes sem alteração de tese

## Design Notes

Dois números diferentes, duas vidas diferentes — não confundir os dois ao implementar:
1. **Tally do resumo** (migradas/adiadas/canceladas): estado em memória da página do ritual (`useState`, incrementado a cada `onSuccess` de mutação por tipo de `destination`). Só existe enquanto o componente está montado; pausar = desmontar = tally se perde, e o resumo final reflete só a sessão de decisões que terminou (não um total histórico). Isso é aceitável porque o resumo só aparece quando a fila zera **dentro** de uma montagem contínua.
2. **"N de M restantes" do banner pausado**: `M` é só um contador (não um breakdown), salvo em `sessionStorage` no primeiro mount do ritual nesta aba, e limpo quando a fila zera (fim do ritual) ou quando `M` já não bate com a realidade (ex. itens novos entraram na fila — nesse caso, recapturar `M` no próximo mount). Sobrevive a navegar para fora e voltar dentro da mesma aba; não sobrevive a fechar a aba/app (aceitável — decisões em si nunca se perdem, só a moldura "de M").

A promoção do destination picker (`MonthlyDestinationPicker` → componente compartilhado) é reuso arquitetural, não invenção: o próprio arquivo já anota a extensão prevista na 14.9. Preservar o comportamento hoje coberto por `WeeklyPlanningPage`/`MonthlyPlanningPage`/`FutureBoardPage` ao promover (testes desses consumidores não podem regredir).

## Verification

**Commands:**
- `npx tsc -b --noEmit` -- limpo
- `npm run lint` -- limpo
- `npx vitest run` -- sem regressão nos números atuais (1748 passed/131 arquivos + novos testes desta story)
- `uv run pytest -q` -- 1314 passed (backend intocado por esta story)
- `uv run ruff check .` / `uv run lint-imports` -- limpos
- `uv run python manage.py makemigrations --check --dry-run` -- "No changes detected"
- `git diff --stat -- schema.yaml frontend/src/api/types.gen.ts` -- vazio
- `nvm use 22.15.1 && CI=1 npx playwright test e2e/migration-ritual.spec.ts e2e/unified-migration-queue.spec.ts e2e/migration-flow.spec.ts --retries=0` -- novo spec 100% verde; os 2 legados sem regressão de tese (contra a branch Neon `e2e`, `migrate --check` limpo antes)
