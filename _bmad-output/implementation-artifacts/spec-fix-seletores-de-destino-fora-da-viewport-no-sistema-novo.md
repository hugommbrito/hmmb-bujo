---
title: 'Seletores de destino dos rituais abrem fora da viewport no desktop'
type: 'bugfix'
created: '2026-08-03'
status: 'done'
review_loop_iteration: 1
context: []
baseline_commit: 'fa0c825a500792fbe26ea1eb483fe78dac623c57'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `WeeklyDestinationPicker` e `MonthlyDestinationPicker` fazem `if (!compact) return content` — no desktop não existe `Dialog` nenhum, então o "diálogo" (só `role="dialog"`, sem overlay nem posição fixa) entra no fluxo normal do DOM, depois da grade de 3 colunas do ritual. Confirmado em dev pelo usuário: clicar em "Alocar" (mensal) ou "Escolher destino…" (semanal) parece não fazer nada — o seletor abriu abaixo da dobra, invisível sem rolar.

**Approach:** Criar um seletor novo, agnóstico de domínio, com o layout/UX do `BrainDumpDestinationPicker` (já validado pelo usuário em uso) — incluindo o que corrige a causa raiz: `Dialog` real no desktop, `Drawer` no compact. Usá-lo nos dois rituais, preservando intactas as mutações, as regras de destino e o tratamento de erro existentes.

## Boundaries & Constraints

**Always:**
- Agnóstico de domínio: recebe `onConfirm`/`onClose` e a descrição do que é ofertado. Nunca importa `useMigrateTaskMutation`, `usePlaceRecurringTemplateMutation`, `Task` nem `RecurringTaskTemplate` — quem chama decide o `destination` do POST.
- Não-compact → `<Dialog open onClose={onClose}>`; compact → `<Drawer anchor="bottom">`. Mesmo par do `BrainDumpDestinationPicker`.
- Nasce preparado para o 2º consumidor (o "Mover tarefa" dos boards, DW-27): a API não pode assumir que o alvo é sempre um período fixo de ritual.
- Reusar sem duplicar: `MonthDensityCalendar`, `useTaskDensityQuery`, `useKeyboardShortcuts` (Enter confirma / Escape fecha), tokens `var(--ds-*)` (nunca literais de cor, espaço ou nº de colunas).
- Confirmação com rótulo NOMEADO do ato ("Alocar em 14 de agosto"), nunca "Confirmar" genérico — já vigente via `confirmLabelFor`.
- Erro mantém o seletor ABERTO com o destino armado e o motivo visível.

**Ask First:**
- Se preservar a anatomia exigir mudar o contrato de `POST /migrate/` ou de `place/`. Esta passada é frontend-only.
- Se algum teste pré-existente exigir mudança de COMPORTAMENTO (não só de locator) para voltar ao verde.

**Never:**
- Não tocar `FutureBoardPage.tsx`, `MigrationRitualPage.tsx`, `DestinationPicker.tsx`, `RecurringPlacementDialog.tsx`, `BrainDumpDestinationPicker.tsx` nem superfícies legadas — têm testes verdes e não foram reportadas como quebradas.
- Não cablear o `onMove` do `TaskDetailCard` — é DW-27, próxima passada.
- Não alterar o resto do ritual (fontes, decisões-snapshot, Manter/Concluir/Cancelar/Migrar/Adiar/Não alocar) — só o seletor.
- Não deletar `WeeklyDestinationPicker.tsx`/`MonthlyDestinationPicker.tsx` — o segundo ainda serve `FutureBoardPage`.
- Não criar story nem editar `sprint-status.yaml`/`epics.md`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Alocar recorrente (mensal), desktop | Ritual mensal, fonte Recorrentes, clique em "Alocar" | Seletor sobreposto e VISÍVEL sem rolagem; confirmar aloca no mês-alvo, com ou sem dia | Falha: seletor aberto + "Não foi possível alocar o template. Tente novamente." |
| Escolher destino (mensal) | Ritual mensal, item de Task | Migra para o dia escolhido do mês-alvo, com a regra `month` vs `future` existente | Falha: seletor aberto + "Não foi possível migrar a tarefa. Tente novamente." |
| Sem dia, semana-alvo ≠ corrente | `isCurrentWeek` falso | "Sem dia definido" INDISPONÍVEL com motivo — migrar `week` sem dia cairia na semana corrente, não na alvo | N/A |
| Mês-alvo anterior ao corrente | Ritual mensal em mês pulado | Guard `monthWouldBeRejectedAsFuture` segue barrando com erro explicativo, sem 400 cru | Mensagem local preservada |
| Troca de mês em foco | Pai atualiza `targetMonthFirst` | Dia armado é DESCARTADO (um "31" armado não sobrevive a um mês de 30 dias) | N/A |
| Faixa compact | Abaixo do breakpoint | `Drawer anchor="bottom"` — comportamento atual, sem regressão | N/A |

</frozen-after-approval>

## Code Map

- `features/braindump/components/BrainDumpDestinationPicker.tsx` -- **modelo de layout a reproduzir**, SOMENTE LEITURA. Calendário :325-332 · dias da semana :293-323 · "Sem dia definido" :372-383 · rótulo nomeado :170-186 · atalhos :205-208 · **`Dialog` no não-compact :428-448 vs `Drawer` no compact :410-426** (o padrão que corrige o bug).
- `features/bujo/components/DestinationPicker.tsx` -- **contrato a espelhar**, read-only: `onConfirm(scheduledDate, meta)` com o chamador decidindo `destination` (:26-32, :42-53); props opcionais compondo a anatomia (:55-74).
- `features/bujo/components/monthly/MonthlyDestinationPicker.tsx` -- **defeito :354**. `onConfirm(scheduledDate)` :50 · `confirmLabelFor` :67,:125-135 · reset do dia ao trocar de mês :91-93 (preservar) · aba "Outro mês" :159-210 · `role="row"` entre grid/gridcell :265-272 (achado real do axe). NÃO deletar — `FutureBoardPage` consome.
- `features/bujo/components/weekly/WeeklyDestinationPicker.tsx` -- **defeito :187**. `isCurrentWeek` governa "Sem dia" :54,:60,:135-140 (regra de domínio) · densidade :42,:95.
- `pages/planner/MonthlyPlanningPage.tsx` -- call-site :467-475, serve TANTO "Alocar" (`handleAllocate` :210-213, kind `template`) QUANTO "Escolher destino" (:320-323, kind `task`). `handleConfirmDestination` :330-364 já ramifica e trata erro · `destinationForTarget()` :126-128 · guard `monthWouldBeRejectedAsFuture()` :189-192 — **preservar os três** · `isCompact` :84.
- `pages/planner/WeeklyPlanningPage.tsx` -- call-site :466-475, serve SÓ "Escolher destino…" (:298-301, :308-326). ATENÇÃO: `handleAllocate` :225-242 é mutação DIRETA de um clique, SEM seletor — não é ponto de mudança aqui. `isCurrentWeek` :76.
- `features/bujo/components/{weekly/WeeklyDecisionList,monthly/MonthlyDecisionList}.tsx` -- renderizam os botões com guard de offline; read-only.
- `features/bujo/api.ts` -- `usePlaceRecurringTemplateMutation` :643 · `useMigrateTaskMutation` :465 · `invalidateRitualQueries` :726. Sem mudança.
- Testes: `{Weekly,Monthly}PlanningPage.test.tsx` e `{Weekly,Monthly}DestinationPicker.test.tsx` (manter verdes/estender) · `BrainDumpDestinationPicker.test.tsx` (referência de asserts) · E2E `{weekly,monthly}-planning-ritual.spec.ts`.
- `_bmad-output/implementation-artifacts/deferred-work.md` -- DW-27 já registra o `onMove` diferido; próximo id livre é DW-28.

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/features/bujo/components/DestinationDialog.tsx` -- criar o seletor agnóstico com layout do Brain Dump, `Dialog` no não-compact e `Drawer` no compact -- correção da causa raiz
- [x] `frontend/src/features/bujo/components/DestinationDialog.test.tsx` -- cobrir a matriz de I/O e, obrigatoriamente, o ASSERT DE REGRESSÃO: no não-compact o conteúdo vive num `Dialog` PORTALIZADO, não como filho direto do container de chamada -- é o que impede o bug de voltar
- [x] `frontend/src/pages/planner/MonthlyPlanningPage.tsx` -- trocar o seletor nos dois fluxos preservando `handleConfirmDestination`, `destinationForTarget()` e o guard -- fecha o defeito sem perder regra de domínio
- [x] `frontend/src/pages/planner/WeeklyPlanningPage.tsx` -- trocar o seletor no fluxo "Escolher destino…" preservando a regra `isCurrentWeek` -- fecha o defeito no semanal
- [x] `frontend/src/pages/planner/{Weekly,Monthly}PlanningPage.test.tsx` -- atualizar os asserts de seletor -- a anatomia muda
- [x] `frontend/e2e/{weekly,monthly}-planning-ritual.spec.ts` -- atualizar locators e provar o seletor visível sem rolagem em faixa desktop -- prova ponta-a-ponta do defeito relatado
- [x] exportar o componente no barrel de `features/bujo` se for o padrão do módulo -- coerência com `TaskDetailCard`/`TaskRowBase`

**Acceptance Criteria:**
- Dado o ritual semanal ou mensal em faixa desktop, quando o usuário abre um seletor de destino, então ele aparece sobreposto e imediatamente visível, sem qualquer rolagem.
- Dado o mesmo ritual em compact, quando o seletor abre, então o comportamento em `Drawer` permanece idêntico ao atual.
- Dadas as superfícies fora de escopo (Future Board, Migração, Brain Dump, legadas), quando a suíte roda, então nada nelas muda.
- Dado que DW-27 vai reusar este componente para "Mover tarefa", quando essa passada começar, então ofertar destinos livres além do período do ritual não exigirá mudança de API.

## Spec Change Log

### 2026-08-03 — iteração 1 (3 camadas de review + decisão do usuário)

**Achados que dispararam a emenda:**
1. **Escrita duplicada (grave).** `useKeyboardShortcuts` filtra só `INPUT`/`TEXTAREA`/`contentEditable`, nunca `BUTTON` — com o botão de confirmação focado, o Enter dispara o handler de `window` E o clique nativo, rodando `confirm()` duas vezes (provado em browser real: dois `POST /migrate/` 200). A mesma corrida faz o Enter confirmar um dia armado ANTERIOR em vez do focado. O `MonthlyDestinationPicker` substituído tratava keydown no PRÓPRIO container COM `preventDefault()` e documentava em :9-13 que rejeitava o hook global exatamente por isso — proteção perdida na troca. É a classe já registrada em DW-20, reproduzida num componente novo.
2. **Três affordances documentadas removidas em silêncio**, com os testes que as provavam reescritos em vez de portados: Story 14.5 AC5 (dígitos `1`–`7`/`0` + lembrete visível), Story 14.6 AC5 (entrada direta do nº do dia + setas, validando 28–31 incl. bissexto) e Stories 14.5/14.6 AC6 (clicar num dia do rail de densidade escolhe o destino da decisão corrente — o dialog modal com backdrop deixa o rail `aria-hidden` atrás, tornando `handleSelectDayFromDensity` código morto). A cláusula "Ask First" cobria isso e não foi honrada.

**O que foi emendado:** esta seção, as Design Notes (regras 3–6) e a lista de Execution, acrescentando as affordances a preservar e o molde de teclado correto.

**Estado ruim evitado:** um seletor que migra a tarefa duas vezes (ou cria duas instâncias do mesmo recorrente) sem o usuário perceber, e três affordances de stories já entregues desaparecendo sem nenhum teste vermelho — o pior caso, porque a suíte fica verde afirmando o contrário.

**Decisão do usuário (2026-08-03):** restaurar as três affordances; corrigir sobre o código existente em vez de reverter e re-derivar.

**KEEP — o que funcionou e deve sobreviver:**
- O par `Dialog` portalizado (não-compact) / `Drawer` (compact) e o assert ESTRUTURAL que o prova (`closest('.MuiDialog-root')`, `expect(container).not.toContainElement(dialog)`) — é a correção da causa raiz e o que impede a regressão de voltar invisível; um assert de presença (`getByRole('dialog')`) continuaria verde com o bug de volta.
- O contrato `onConfirm(scheduledDate, meta)` espelhando `DestinationPicker.tsx`, que manteve os `handleConfirmDestination` existentes válidos sem adaptador.
- A prova A/B por `git stash push -u` que demonstrou `tsc` e os 10 axe como vermelhos PRÉ-EXISTENTES (DW-28; DW-16 ampliada) em vez de assumir.
- A preservação de `destinationForTarget()`, do guard `monthWouldBeRejectedAsFuture()` e da regra `isCurrentWeek` de "Sem dia definido".

## Design Notes

Serve dois formatos de oferta sem virar dois componentes — o chamador declara o que é ofertado, no espírito das props opcionais de `DestinationPicker.tsx`:

- **Rituais (esta passada)**: período-alvo FIXO (vem de `readiness`) → oferta é "um dia dentro deste período, ou sem dia", direto ao calendário, sem radiogroup de destinos.
- **Boards (DW-27)**: movimento livre → os 4 destinos nomeados do Brain Dump (Hoje/Esta Semana/Este Mês/Futuro) com ícones de `shellDestinations`/`navIconFor`.

Um único destino ofertado deve dispensar o radiogroup, não renderizar um grupo de um item só.

Seis regras que a troca NÃO pode perder, todas com custo real se esquecidas:
1. Migrar `destination: 'week'` sem `scheduledDate` cai na semana CORRENTE no servidor, não na alvo — daí "Sem dia" ficar indisponível com motivo quando `isCurrentWeek` é falso.
2. `role="row"` entre `role="grid"` e `role="gridcell"` é obrigatório: sua ausência foi achado CRITICAL do axe (`aria-required-children`/`aria-required-parent`) na Story 14.7, com `display: contents` mantendo a grade CSS intacta.
3. **Enter NÃO pode vir de `useKeyboardShortcuts`** (handler de `window`): o hook não filtra `BUTTON`, então o Enter com o botão de confirmação focado dispara o handler E o clique nativo — `confirm()` roda duas vezes e a tarefa migra em duplicidade. Seguir o molde que o `MonthlyDestinationPicker` já provou (`:114-123`): keydown no PRÓPRIO container do diálogo, com `preventDefault()`. Isso também elimina a corrida em que o Enter confirma o dia armado anterior em vez do que acabou de receber foco (classe de DW-20).
4. **Story 14.5 AC5 — dígitos no seletor semanal:** `1`–`7` armam segunda–domingo, `0` arma "Sem dia definido", com lembrete discreto dos atalhos visível. Preservar, com teste que os exercite pela PÁGINA do ritual (não só pelo componente isolado).
5. **Story 14.6 AC5 — dia por digitação no seletor mensal:** entrada direta do número do dia e setas anterior/próximo, sincronizadas, validando os 28–31 dias reais do mês-alvo (incl. bissexto). Preservar, com teste na página do ritual.
6. **Stories 14.5/14.6 AC6 — dia pelo rail de densidade:** clicar num dia do rail de contexto escolhe o destino da decisão corrente. Um diálogo modal com backdrop deixa o rail `aria-hidden` atrás e torna `handleSelectDayFromDensity` inalcançável — se esse caminho morrer, é regressão. Resolver de forma que o clique no rail continue armando o destino, e provar por teste que é alcançável.

## Verification

**Commands:**
- `nvm use 22.15.1` -- pré-requisito: a sessão inicia em Node 18, incompatível com o frontend
- `cd frontend && npx tsc -b --noEmit` -- expected: sem erro (o vitest usa esbuild e NÃO type-checa; erro de tipo em teste só aparece aqui)
- `cd frontend && npm run lint` -- expected: sem erro
- `cd frontend && npx vitest run` -- expected: full-suite verde; medir a baseline ANTES de mudar código e comparar, para provar zero regressão
- `cd frontend && CI=1 npx playwright test e2e/weekly-planning-ritual.spec.ts e2e/monthly-planning-ritual.spec.ts` -- expected: verde; o Playwright sobe os servidores sozinho contra o Postgres local `bujo_e2e`

**Manual checks (if no CLI):**
- Nas faixas wide/medium/tablet, abrir "Alocar" (mensal) e "Escolher destino…" (semanal) e confirmar que aparecem sobrepostos e centralizados sem rolagem — a prova geométrica, que o assert de portal cobre estruturalmente mas não visualmente.

## Suggested Review Order

**Correção da causa raiz (o defeito relatado)**

- Entrada: o ramo que decide `Dialog` portalizado × `Drawer` — é a correção inteira em duas linhas
  [`DestinationDialog.tsx:634`](../../frontend/src/features/bujo/components/DestinationDialog.tsx#L634)
- O ramo compact, que já funcionava e não podia regredir
  [`DestinationDialog.tsx:609`](../../frontend/src/features/bujo/components/DestinationDialog.tsx#L609)
- O assert que impede a volta invisível: presença de dialog não basta, o portal é a prova
  [`DestinationDialog.test.tsx:78`](../../frontend/src/features/bujo/components/DestinationDialog.test.tsx#L78)

**Escrita duplicada no Enter (achado grave do review)**

- Keydown no próprio container com `preventDefault`, no lugar do hook global de `window`
  [`DestinationDialog.tsx:405`](../../frontend/src/features/bujo/components/DestinationDialog.tsx#L405)
- Botões que SÃO a própria ação barram o Enter antes de subir — evita a ação dupla
  [`DestinationDialog.tsx:369`](../../frontend/src/features/bujo/components/DestinationDialog.tsx#L369)
- O teste modela o contrato do browser: clique nativo só se ninguém chamou `preventDefault`
  [`DestinationDialog.test.tsx:118`](../../frontend/src/features/bujo/components/DestinationDialog.test.tsx#L118)
- Guard de mutação em curso, que faltava nos dois call-sites
  [`WeeklyPlanningPage.tsx:517`](../../frontend/src/pages/planner/WeeklyPlanningPage.tsx#L517)

**As três affordances restauradas (ACs das Stories 14.5/14.6)**

- AC6: o clique no rail arma o dia com o seletor fechado, e confirma direto se aberto
  [`WeeklyPlanningPage.tsx:392`](../../frontend/src/pages/planner/WeeklyPlanningPage.tsx#L392)
- AC6: o diálogo adota o dia já armado pelo rail na abertura
  [`DestinationDialog.tsx:200`](../../frontend/src/features/bujo/components/DestinationDialog.tsx#L200)
- 14.5 AC5: dígitos 1–7/0 com o lembrete visível dos atalhos de volta
  [`DestinationDialog.tsx:394`](../../frontend/src/features/bujo/components/DestinationDialog.tsx#L394)
- 14.6 AC5: entrada direta do número do dia, sincronizada com o calendário
  [`DestinationDialog.tsx:508`](../../frontend/src/features/bujo/components/DestinationDialog.tsx#L508)

**Acessibilidade e alvo de toque**

- Foco inicial adiado um frame: o `FocusTrap` do MUI reasserta depois, e jsdom não pegava
  [`DestinationDialog.tsx:251`](../../frontend/src/features/bujo/components/DestinationDialog.tsx#L251)
- Setas/Home/End no radiogroup — o que declarar `radiogroup` promete à tecnologia assistiva
  [`DestinationDialog.tsx:440`](../../frontend/src/features/bujo/components/DestinationDialog.tsx#L440)
- Piso de 44px elevado por especificidade, sem editar o componente compartilhado
  [`DestinationDialog.tsx:181`](../../frontend/src/features/bujo/components/DestinationDialog.tsx#L181)

**Periféricos**

- Helper isola o que afirma: `boundingBox` já é relativo à viewport, sem `scrollY`
  [`shellHelpers.ts:116`](../../frontend/e2e/shellHelpers.ts#L116)
- Densidade unificada: o mensal passa o mapa do rail, sem segundo endpoint divergente
  [`MonthlyPlanningPage.tsx:519`](../../frontend/src/pages/planner/MonthlyPlanningPage.tsx#L519)
- Dívidas registradas: DW-30 (defeito vivo em 2 superfícies), DW-28 (tsc), DW-16 (axe)
  [`deferred-work.md`](./deferred-work.md)
