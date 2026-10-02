---
title: 'Story 14.11: Regularização atrasada do ciclo mensal — destravar e explicar'
type: 'bugfix'
created: '2026-10-01'
status: 'done'
baseline_commit: '32429a37c29458c3ad9532afb6ee89b06b4acb34'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-14-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Com agosto `active` (1 subtarefa `started` sob pai `completed`), setembro `planning` desde 31/08 e outubro `NULL`, o ritual mensal abre setembro e trava: a fonte "Monthly anterior" lista só raízes (0 itens, `reviewed: true`) enquanto o gate de finalizar olha a subárvore inteira (`ready_to_finalize: false`); a UI diz "pronto para finalizar" com o botão desabilitado, as ações de ciclo engolem o 409, nada diz que o alvo é setembro, e migrar/adiar para um alvo passado é bloqueado por guard local (Questão aberta nº 5 da 14.6).

**Approach:** Manter a regra sequencial (M07). Backend: fonte bloqueante e fila unificada passam a listar "cabeças abertas" (raiz aberta ou subtarefa aberta sob pai disposto); `migrate/` aceita `destination: 'month'` com `month_first` explícito entre o alvo de planejamento e o mês corrente; cada gate de iniciar/finalizar devolve 409 com `detail` legível e `code` = chave do gate. Frontend: botões nomeiam o mês-alvo, faixa "Regularização atrasada" com os passos, gates de finalizar visíveis, verdade do servidor para "pronto para finalizar", erros exibidos, guard substituído por um adaptador único de destino.

## Boundaries & Constraints

**Always:** `today_for(user)` como única fonte de "hoje"; transições só por service, 409 via `InvalidTransition`/handler central; `undisposed_roots` continua nas fontes não bloqueantes; `'future'` inalterado (`month_first > corrente`); `'month'` sem `month_first` continua = mês corrente; tokens `--ds-*` (guard `noLiteralTokens`), `GateRow`, `role="alert"`/`"status"`, alvo de toque ≥ `--ds-touch-target-min`; "Mês anterior pronto para finalizar." permanece textual (E2E); aria-labels "Já alocados (fora do progresso)" inalterados; `schema.yaml` + `types.gen.ts` regenerados e commitados; sem migration; sem `ruff format`.

**Never:** pular meses, finalizar/iniciar automaticamente ou mudar `next_monthly_target`; `None → ACTIVE`; regra pai/filho na máquina de estados de Task; novo valor no enum de `destination`; ajuste manual de dados; tocar `braindump/views.py`; `git add -A` (árvore tem reorganização do vault fora do escopo).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Subtarefa órfã | anterior `active`: pai `completed` + filho `started` | fonte `previous-monthly`/`previous-weekly` lista o filho; `eligible 1`, `reviewed false`, `ready_to_finalize false` | N/A |
| Filho sob pai aberto | pai `pending` + filho `pending` | só o pai como item (filho aninhado) | N/A |
| Invariante | qualquer árvore | `reviewed == ready_to_finalize == not has_undisposed` | N/A |
| Fila unificada | subtarefa órfã em mês < anterior | aparece na seção `month` | N/A |
| Migrar p/ alvo passado | `'month'`, `month_first` = planning < corrente | 200; sucessor no alvo; origem `postponed` | N/A |
| Adiar p/ corrente | alvo = m−1, `month_first` = corrente | 200 | N/A |
| Fora da faixa | `'month'`, `month_first` < alvo ou > corrente | 400 `{month_first}` | "Anterior ao alvo de planejamento mensal." / "Use 'future' para meses após o corrente." |
| Legado | `'month'` sem `month_first`; `'future'` ≤ corrente | corrente / 400 "Use 'month' para o mês corrente." | inalterado |
| Gate de iniciar | `start` com anterior não finalizado | 409 `{detail, code: 'previous_finalized'}` | detail pt-BR |
| Gate de finalizar | `finalize` com subtarefa aberta | 409 `{detail, code: 'no_open_tasks'}` | detail cita subtarefas |
| UI: contador 0 + gate ✗ | `finalize.gates.noOpenTasks=false` | alerta "tarefas abertas fora desta lista (subtarefas)"; botão desabilitado; sem "pronto" | N/A |
| UI: alvo < corrente | planning=set, corrente=out | faixa com passos; "Próximo passo" no 1º ✗; "Já alocados em Setembro de 2026" + meta de mês passado | N/A |
| UI: ação 409 | POST cycle rejeitado | `role="alert"` com `detail`; botões reabilitam | fallback genérico fora de 409 |
| UI: readiness falha / sem alvo | GET falha / `planning null` | retry / link "Ir para Este Mês" | N/A |

</frozen-after-approval>

## Code Map

- `backend/core/exceptions.py:51-57,172-182` -- `InvalidTransition` (+`reason`/`code`) e handler 409 (`code` só quando presente)
- `backend/bujo/services/cycles.py:80-112,134-158,223-259,349-385,444` -- `_CycleSpec` (+`label`), `_previous_operational`, `_has_undisposed`, `_start`/`_finalize` (um `raise` por gate), readiness (chaves dos gates), `next_monthly_target` (reusar como piso)
- `backend/bujo/services/rituals.py:237-251,273-330,400,544` -- `_task_items`, `undisposed_roots` (manter), novo `undisposed_heads`, `_blocking_previous_source` (docstring do invariante), fontes anteriores
- `backend/bujo/services/migration.py:32,233-313` -- import + `unified_migration_queue` → `undisposed_heads`; docstring de `migrate_task` (L128-146)
- `backend/bujo/serializers.py:461-485,702` -- `TaskMigrateSerializer.validate` (helper dia 1 / mesmo mês; `help_text`); `RitualTaskItemSerializer` (`parent_title` opcional)
- `backend/bujo/views.py:63-75,762-791` -- import `next_monthly_target`; `TaskMigrateView` faixa `[min(alvo, corrente), corrente]`
- `backend/bujo/tests/test_services.py:2058,2307,2546,2593,2757,2800,4430`, `test_views.py:1390,1414,3440`, `core/tests/test_exceptions.py:30,47` -- testes a estender/preservar
- `frontend/src/api/errors.ts` (novo) -- `domainErrorMessage(error, fallback)`; `src/api/client.ts` só trata 401
- `frontend/src/shared/date/index.ts:131` (`addMonthsIso` já existe), `src/features/bujo/monthNames.ts` (`MONTH_NAMES_PT`) -- `monthsBetweenIso`, `formatMonthTitle` compartilhado (substitui cópias em `MonthlyPlanningPage.tsx:65-75` e `MonthlyBoardPage.tsx:136-144`)
- `frontend/src/features/bujo/components/monthly/MonthlyContextRail.tsx:31,105-106,249-272,288-356,362` -- props, avisos, painéis de gates, `GateRow` (extrair p/ `GateRow.tsx` + `reason`)
- `frontend/src/features/bujo/components/monthly/MonthlyCatchUpBanner.tsx` (novo) -- faixa de regularização
- `frontend/src/features/bujo/components/monthly/MonthlyDecisionList.tsx:38-45,259-290` -- títulos "Já alocados em …" + `targetMonthIsPast`
- `frontend/src/pages/planner/MonthlyPlanningPage.tsx:101-146,207-213,233-260,315-375,394-407,506` -- estados, adaptador `migrateFieldsForMonth`, `runCycleAction`, wiring
- `frontend/src/pages/planner/MonthlyBoardPage.tsx:30,181,363-369,440-466` -- alvo previsto, botões nomeados, erro/retry
- `frontend/src/features/bujo/api.ts:465-472,733,894-915,963` -- `invalidateRitualQueries` (+`keys.bujo.migrationQueue()`), hooks de ciclo
- `frontend/src/features/bujo/components/monthly/noLiteralTokens.test.ts:17-24` -- `SOURCES` += arquivos novos
- `frontend/e2e/seedMonthlyBoardScenario.ts:60` (`SHIFT_MONTHS_HELPER`), `seedMonthlyPlanningScenario.ts`, `monthly-planning-ritual.spec.ts`, `monthly-board.spec.ts` -- seed/spec novos
- `_bmad-output/planning-artifacts/epics.md:2370` -- inserir "Story 14.11" após a 14.10; `14-6-...md` Questão aberta nº 5 → resolvida por esta story

## Tasks & Acceptance

**Execution:**
- [x] `_bmad-output/planning-artifacts/epics.md`, `_bmad-output/implementation-artifacts/14-6-monthly-board-e-planejamento-mensal-no-sistema-novo.md` -- registrar a story e fechar a Questão nº 5 -- rastreabilidade
- [x] `backend/core/exceptions.py`, `backend/bujo/services/cycles.py` -- `reason`/`code` por gate -- 409 explicável
- [x] `backend/bujo/services/rituals.py`, `backend/bujo/services/migration.py`, `backend/bujo/serializers.py` -- `undisposed_heads` na fonte bloqueante e na fila; `parent_title` -- fonte ≡ gate
- [x] `backend/bujo/serializers.py`, `backend/bujo/views.py`, `backend/bujo/services/migration.py` -- `'month'` + `month_first` explícito em faixa -- migrar para alvo passado
- [x] `backend/bujo/tests/*`, `backend/core/tests/test_exceptions.py` -- testes da matriz + teste-âncora (m−2 active c/ subtarefa órfã, m−1 planning → migrar → finalizar → iniciar) + `code` nos testes de divergência
- [x] `schema.yaml`, `frontend/src/api/types.gen.ts` -- regenerar
- [x] `frontend/src/api/errors.ts`, `src/shared/date/index.ts`, `src/features/bujo/monthNames.ts`, `GateRow.tsx`, `api.ts` -- helpers compartilhados
- [x] `frontend/src/pages/planner/MonthlyBoardPage.tsx` -- botões nomeados, linha de regularização, erro/retry, `onError`
- [x] `frontend/src/pages/planner/MonthlyPlanningPage.tsx`, `MonthlyCatchUpBanner.tsx`, `MonthlyContextRail.tsx`, `MonthlyDecisionList.tsx` -- faixa, gates de finalizar, verdade do servidor, `runCycleAction`, adaptador de destino, títulos com mês
- [x] `frontend/src/**/*.test.tsx|ts` -- vitest da matriz de UI (inclui jest-axe na faixa)
- [x] `frontend/e2e/seedMonthlyCatchUpScenario.ts` (novo), `monthly-planning-ritual.spec.ts`, `monthly-board.spec.ts` -- cenário de regularização atrasada ponta a ponta + 409 simulado via `page.route`

**Acceptance Criteria:**
- Given agosto `active` com subtarefa `started` sob pai `completed`, setembro `planning` concluído e hoje em outubro, when o usuário abre o board e o ritual, then o botão lê "Continuar planejamento de Setembro de 2026", a faixa diz "Próximo passo: Finalizar Agosto de 2026", a fonte "Monthly anterior" lista a subtarefa e, após decidi-la, "Finalizar mês anterior" habilita, "Iniciar mês" habilita e o board passa a oferecer "Planejar Outubro de 2026"
- Given o alvo em `planning` anterior ao mês corrente, when o usuário migra um item para um dia do alvo ou adia ao Future Log, then o POST usa `destination: 'month'` com `monthFirst` e o servidor aceita
- Given qualquer POST de ciclo rejeitado com 409, when a resposta chega, then o `detail` aparece em `role="alert"` e nenhum botão fica mudo
- Given o cenário regular (alvo = mês seguinte ao corrente), when a suíte existente roda, then `monthly-planning-ritual.spec.ts`, `monthly-board.spec.ts`, `weekly-monthly-cycle.spec.ts` e os testes de `future` continuam verdes

## Spec Change Log

## Review Triage Log

### 2026-10-01 — Review pass (ciclo 1: blind-hunter, edge-case-hunter, verification-gap)

Dispensados (com motivo):
- `domainErrorCode` exportado sem consumidor em produção — cosmético: o contrato exigido pela spec (`code` no corpo do 409) está cumprido e o `detail` é o que a UI mostra; realçar o `GateRow` recusado pelo `code` é refinamento, não lacuna.
- Texto da regularização duplicado entre board (linha compacta) e faixa do ritual (versão completa) — redação deliberadamente distinta por superfície; a única computação compartilhada (`monthsBetweenIso`) já é uma.
- Helper `conflict409`/`axiosErrorWith` repetido em três arquivos de teste — duplicação de fixture de teste co-localizada, padrão do repo; sem consequência para o usuário.
- `sprint-status.yaml` em `in-progress` enquanto a spec está `in-review` — o próprio rito sincroniza o status no passo 5.
- Alerta "bloqueia iniciar" com `Finalizar` habilitado por cache divergente (fonte > 0, gate ✓) — janela transitória: `invalidateRitualQueries` e `readiness.refetch()` rodam juntos em toda mutação do ritual; sem caminho durável para o estado descrito.
- Vitest/Playwright fora do CI — pré-existente e já rastreado em DW-68.

Mantidos como **patch** (corrigidos neste ciclo): comentário/docstring da faixa `[alvo, corrente]` sobre meses intermediários + testes de faixa (intermediário e posição regular); `parentTitle` no ritual semanal (normalizador + lista + testes); alerta transitório "subtarefas fora desta lista" durante o carregamento da fonte; recuperação quando `GET /logs/monthly/` falha (refetch + mensagem) e testes dos guards; prop morta `previousPeriodStart` no rail; `DomainError.code = None` declarado; literal `2px`; `SHIFT_MONTHS_HELPER` exportado uma vez; resultados dos gates registrados na spec; contexto do épico (contrato de migrate atualizado + decisões suprimidas restauradas); `cycleError` do board só enquanto não há alvo; `reason`/`code` nas recusas da matriz e de `complete_planning` (`state_changed`/`not_planning`) e nos dois gates semanais opcionais; oferta do mês em foco não marcada indisponível sem readiness; teste das 3 chaves novas em `invalidateRitualQueries`; teste do piso previsto (`active + 1`) no board; docstring de `test_fila_unificada_descarta_dispostos_e_subtarefas`; `detail` mensal com nome do mês; rótulo "Adiar para <mês>" quando o destino do adiamento é ≤ corrente.

Mantidos como **defer** (ledger DW-72 a DW-77): fila unificada/aliases sem contexto do pai; ritual semanal engole 409 e gate de finalizar pela contagem local; `'month'` legado sem validar `scheduled_date` no mês corrente; filas de review legadas só com raízes; 400 de `monthFirst` por alvo avançado em outra sessão; teste DW-60 de Hábitos falhando no baseline.

## Design Notes

Opção escolhida para a divergência fonte×gate: expor "cabeças abertas" (não relaxar o gate, que FR-1.10 e `test_ciclo_weekly_finalizar_bloqueado_por_subtarefa_pendente` pinam; não proibir pai concluído com filho aberto, estado legal produzido pela UI). Toda cadeia aberta tem exatamente uma cabeça, logo `has_undisposed ⇔ existe cabeça` e `reviewed ⇔ ready_to_finalize` por construção.

Contrato de migração: `'month'` já significa "um Monthly específico, origem `postponed`"; só o mês passa a ser explícito, com piso em `next_monthly_target` (único mês ≤ corrente em que ainda se escreve durante regularização) e teto no corrente. `'future'` segue sendo o Future Log (horizonte `> corrente`). Frontend concentra a escolha em `migrateFieldsForMonth(monthFirst, scheduledDate)`: `> corrente` → `future`, senão `month` + `monthFirst`.

Rail: visibilidade e habilitação de "Finalizar mês anterior" vêm de `readiness.finalize` (servidor); o contador local só alimenta o aviso "N pendência(s)". O ramo "subtarefas fora desta lista" permanece como estado defensivo contra defasagem de cache.

## Verification

**Commands:**
- `cd backend && uv run pytest -q` -- expected: verde, com os testes novos
- `cd backend && uv run ruff check . && uv run lint-imports && uv run python manage.py makemigrations --check --dry-run` -- expected: limpo / `1 kept, 0 broken` / `No changes detected`
- `cd backend && uv run python manage.py spectacular --file ../schema.yaml && cd ../frontend && npm run generate-types && git diff --stat ../schema.yaml src/api/types.gen.ts` -- expected: só `help_text`/`parentTitle`
- `cd frontend && npx tsc -b --noEmit && npm run lint && npm run test:run` -- expected: limpo / limpo / verde
- `cd frontend && CI=1 npx playwright test e2e/monthly-planning-ritual.spec.ts e2e/monthly-board.spec.ts e2e/weekly-monthly-cycle.spec.ts` -- expected: 100% verde (banco `bujo_e2e` local)

**Resultados (HEAD final, 2026-10-02, após o ciclo 1 de review):**
- `uv run pytest -q` → **1515 passed** (1513 na entrega + 2 testes de faixa do review)
- `uv run ruff check .` → All checks passed · `uv run lint-imports` → Contracts: 1 kept, 0 broken · `makemigrations --check --dry-run` → No changes detected
- `spectacular` + `npm run generate-types` → `git diff --stat` = `schema.yaml` +7 / `types.gen.ts` +6 −1 (só `parentTitle` e o `help_text` de `monthFirst`)
- `npx tsc -b --noEmit` → limpo · `npm run lint` → limpo
- `npm run test:run` → **2377 passed | 8 failed** (2385): as 8 são pré-existentes — 7 da DW-61 (`TaskDestinationDialog` ×5, `TaskDetailPanel` ×1, `FuturePage` ×1) + 1 de Hábitos (`HabitsRecordPage` "DW-60: o glifo…"), confirmada no baseline `32429a3` em worktree limpo (DW-77); zero falhas novas
- `CI=1 npx playwright test e2e/monthly-planning-ritual.spec.ts e2e/monthly-board.spec.ts e2e/weekly-monthly-cycle.spec.ts e2e/weekly-planning-ritual.spec.ts` → **52 passed** (banco local `bujo_e2e`); na 1ª rodada (antes do review) 2 falhas reais corrigidas: contraste do link "Mês em planejamento" (teal do tema) e a espera de hidratação do teste de axe no cenário de regularização

**Manual checks (if no CLI):**
- Na cópia de produção (dev Railway): board → "Continuar planejamento de Setembro de 2026" → faixa com "Próximo passo: Finalizar Agosto de 2026" → "Cardiologista" listada em Monthly anterior → decidir → Finalizar → Iniciar → "Planejar Outubro de 2026" → migrar as 3 pendências de setembro para outubro → Finalizar setembro → Concluir/Iniciar outubro.

## Suggested Review Order

**Ponto de entrada — fonte bloqueante ≡ gate de finalizar**

- Cabeças abertas: raiz aberta OU subtarefa aberta sob pai disposto; é o que torna `has_undisposed ⇔ existe cabeça`
  [`rituals.py:265`](../../backend/bujo/services/rituals.py#L265)

- A fonte "Monthly/Weekly anterior" lista cabeças, não raízes — fim do "0 itens com `ready_to_finalize: false`"
  [`rituals.py:350`](../../backend/bujo/services/rituals.py#L350)

- `parent_title` só é lido para subtarefas-cabeça; raízes nunca tocam `parent_task`
  [`rituals.py:246`](../../backend/bujo/services/rituals.py#L246)

- Fila unificada (e aliases legados) com o mesmo predicado — mesmo ponto cego, mesma correção
  [`migration.py:282`](../../backend/bujo/services/migration.py#L282)

- Invariante provado por forma de árvore: `reviewed == ready_to_finalize == not has_undisposed`
  [`test_services.py:5051`](../../backend/bujo/tests/test_services.py#L5051)

**Contrato de migração para alvo passado (`'month'` + `month_first`)**

- Piso = `min(next_monthly_target, corrente)`, teto = corrente; meses intermediários inclusos; `'future'` intacto
  [`views.py:786`](../../backend/bujo/views.py#L786)

- Regras de forma (dia 1, `scheduled_date` no mês) compartilhadas entre `'future'` e `'month'` explícito
  [`serializers.py:475`](../../backend/bujo/serializers.py#L475)

- Adaptador ÚNICO no frontend: `> corrente` → `future`, senão `month` + `monthFirst` — substitui o guard local da 14.6
  [`monthlyRitualSources.ts:192`](../../frontend/src/features/bujo/components/monthly/monthlyRitualSources.ts#L192)

- Teste-âncora do cenário real: subtarefa órfã → migrar p/ alvo passado → finalizar → iniciar, sem salto
  [`test_services.py:5093`](../../backend/bujo/tests/test_services.py#L5093)

**409 explicável por gate**

- Um `raise` por gate, `code` = chave de `readiness.*.gates`, `detail` pt-BR com o mês por extenso
  [`cycles.py:309`](../../backend/bujo/services/cycles.py#L309)

- Gate de finalizar cita subtarefas de tarefas já concluídas
  [`cycles.py:346`](../../backend/bujo/services/cycles.py#L346)

- Recusa da matriz (readiness obsoleta) também legível: "o ciclo mudou de estado — recarregue"
  [`cycles.py:189`](../../backend/bujo/services/cycles.py#L189)

- Handler central: `code` entra no corpo só quando a exceção o carrega; todo outro 409 mantém `{detail}`
  [`exceptions.py:201`](../../backend/core/exceptions.py#L201)

- Leitor único do envelope no frontend: só o 409 expõe `detail`; o resto cai no fallback do chamador
  [`errors.ts:31`](../../frontend/src/api/errors.ts#L31)

**Ritual mensal: verdade do servidor, faixa e sem botão mudo**

- Toda ação de ciclo passa por `runCycleAction` (409 → `role="alert"`, outro erro → fallback, sucesso limpa)
  [`MonthlyPlanningPage.tsx:413`](../../frontend/src/pages/planner/MonthlyPlanningPage.tsx#L413)

- "Pronto para finalizar" e visibilidade do botão vêm de `readiness.finalize`, nunca do contador local
  [`MonthlyContextRail.tsx:124`](../../frontend/src/features/bujo/components/monthly/MonthlyContextRail.tsx#L124)

- Painel de verificação de Finalizar (2 gates ✓/✗ + motivo), irmão do painel de Iniciar
  [`MonthlyContextRail.tsx:377`](../../frontend/src/features/bujo/components/monthly/MonthlyContextRail.tsx#L377)

- Alvo anterior ao corrente ⇒ faixa de regularização (passos do M07 derivados da readiness)
  [`MonthlyPlanningPage.tsx:178`](../../frontend/src/pages/planner/MonthlyPlanningPage.tsx#L178)

- Passos puros da faixa: "Próximo passo" é o primeiro ✗ na ordem finalizar → concluir → iniciar
  [`monthlyCatchUp.ts:16`](../../frontend/src/features/bujo/components/monthly/monthlyCatchUp.ts#L16)

- Readiness em erro vira retry (nunca "nenhum mês em planejamento"); sem alvo vira link para o board
  [`MonthlyPlanningPage.tsx:150`](../../frontend/src/pages/planner/MonthlyPlanningPage.tsx#L150)

- Mês corrente indisponível: query em voo vs. falhada (refetch) — guard dos 3 fluxos de migrate
  [`MonthlyPlanningPage.tsx:242`](../../frontend/src/pages/planner/MonthlyPlanningPage.tsx#L242)

- Rótulos honestos na regularização: "Adiar para <mês>" quando o destino é ≤ corrente; "Subtarefa de <pai>"
  [`MonthlyDecisionList.tsx:134`](../../frontend/src/features/bujo/components/monthly/MonthlyDecisionList.tsx#L134)

**Board: alvo nomeado e piso espelhado**

- Alvo previsto espelha `next_monthly_target` (planning → active+1 → corrente) e nomeia os botões
  [`MonthlyBoardPage.tsx:237`](../../frontend/src/pages/planner/MonthlyBoardPage.tsx#L237)

- Piso de escrita do "Mover tarefa" espelha o servidor; sem readiness, o servidor decide
  [`MonthlyBoardPage.tsx:253`](../../frontend/src/pages/planner/MonthlyBoardPage.tsx#L253)

- `open_planning_target` com `onError` (detail do 409) e alerta só enquanto não há alvo
  [`MonthlyBoardPage.tsx:397`](../../frontend/src/pages/planner/MonthlyBoardPage.tsx#L397)

**Periféricos — compartilhados, semanal, testes, docs**

- `GateRow` extraída dos dois rails, com `reason` no ✗
  [`GateRow.tsx:22`](../../frontend/src/features/bujo/components/GateRow.tsx#L22)

- Ritual semanal adota `parentTitle` (o backend já o emite pela mecânica única)
  [`WeeklyDecisionList.tsx:204`](../../frontend/src/features/bujo/components/weekly/WeeklyDecisionList.tsx#L204)

- `invalidateRitualQueries` também re-deriva as filas de migração/catch-up
  [`api.ts:446`](../../frontend/src/features/bujo/api.ts#L446)

- Contrato no fio: `'month'` + `monthFirst` = alvo passado (200) e 409 de finalizar com `code`
  [`test_views.py:4815`](../../backend/bujo/tests/test_views.py#L4815) · [`test_views.py:4944`](../../backend/bujo/tests/test_views.py#L4944)

- UI: contador 0 + gate ✗ (verdade do servidor) e a página em regularização atrasada
  [`MonthlyContextRail.test.tsx:90`](../../frontend/src/features/bujo/components/monthly/MonthlyContextRail.test.tsx#L90) · [`MonthlyPlanningPage.test.tsx:369`](../../frontend/src/pages/planner/MonthlyPlanningPage.test.tsx#L369)

- E2E contra o backend real: seed do cenário da produção e o caminho completo até "Planejar <mês corrente>"
  [`seedMonthlyCatchUpScenario.ts:28`](../../frontend/e2e/seedMonthlyCatchUpScenario.ts#L28) · [`monthly-planning-ritual.spec.ts:310`](../../frontend/e2e/monthly-planning-ritual.spec.ts#L310)

- Docs: contrato de migrate no contexto do épico, story no epics.md, Questão nº 5 da 14.6 resolvida
  [`epic-14-context.md:39`](epic-14-context.md#L39) · [`epics.md:2383`](../planning-artifacts/epics.md#L2383) · [`14-6-…md:283`](14-6-monthly-board-e-planejamento-mensal-no-sistema-novo.md#L283)
