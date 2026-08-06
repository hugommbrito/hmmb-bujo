---
title: 'DW-27 — "Mover tarefa" cabeado no Weekly Board e no Monthly Board'
type: 'bugfix'
created: '2026-08-05'
status: 'in-review'
baseline_revision: '747c70d5e4596a66c7349c75bb8b63e9146193c2'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred:
  - summary: >-
      Mover tarefa de um período ARQUIVADO segue sem decisão de produto:
      `ArchiveWeeklyDetailPage.tsx` e `ArchiveMonthlyDetailPage.tsx` renderizam
      `TaskDetailCard` sem `onMove`, então o botão "Mover tarefa" agora
      simplesmente SOME dessas telas.
    evidence: |-
      Registrado pela própria spec (Design Notes → "Fora de escopo,
      registrado"). Condicionar o botão a `onMove` (Task 4) elimina o clique
      morto em toda superfície — melhor que um controle que não faz nada —, mas
      NÃO decide se mover tarefa de período arquivado deve existir. O `Never` da
      spec proíbe cablear `onMove` nessas duas páginas nesta passada.
    location: >-
      frontend/src/pages/archive/ArchiveWeeklyDetailPage.tsx:367;
      frontend/src/pages/archive/ArchiveMonthlyDetailPage.tsx:376
    severity: low
  - summary: >-
      O `radiogroup` "Selecionar destino" novo não tem navegação por
      setas/roving-tabindex — cada destino é um tab stop próprio.
    evidence: |-
      Espelha deliberadamente o molde VIVO que a spec manda seguir
      (`BrainDumpDestinationPicker.tsx:243-275`), que tem o mesmo gap (já
      registrado como deferred da Story 15.1). O grupo de DIAS deste mesmo
      diálogo mantém setas + roving intactos. Não é regressão nova; é o padrão
      herdado, e axe passa nos dois.
    location: >-
      frontend/src/features/bujo/components/DestinationDialog.tsx
    severity: low
  - summary: >-
      As ofertas que dependem de "hoje" (Esta Semana / Este Mês / Futuro / mês
      em foco) simplesmente não aparecem enquanto `useTodayLogQuery` /
      `useMonthlyLogQuery` não resolvem — sem estado de carregando nem de erro
      dentro do seletor.
    evidence: |-
      Na prática as duas queries começam na montagem da página, muito antes de
      o usuário abrir o detalhe e clicar em "Mover tarefa", então a janela é
      estreita. `BrainDumpDestinationPicker.tsx:283-297` resolve o mesmo
      problema com "Carregando…"/"Tentar de novo" visíveis — o padrão existe e
      poderia ser adotado aqui, mas a spec não pediu e nenhuma AC o cobre.
    location: >-
      frontend/src/pages/planner/WeeklyBoardPage.tsx;
      frontend/src/pages/planner/MonthlyBoardPage.tsx
    severity: low
---

<intent-contract>

## Intent

**Problem:** `WeeklyBoardPage.tsx:385` e `MonthlyBoardPage.tsx:416` renderizam `<TaskDetailCard>` sem a prop `onMove`, e o botão "Mover tarefa" (`TaskDetailCard.tsx:316-320`) não é condicionado a ela — o botão aparece e o clique não faz nada (`onClick={undefined}`, clique morto silencioso confirmado em dev). Gap deliberado desde as Stories 14.5/14.6; a decisão de produto de cablear foi tomada em 2026-08-03/04. Consequência viva: 4 testes de `frontend/e2e/move-task.spec.ts` (:86, :131, :194, :341) estão ATIVOS (sem `.skip`/`.fixme`) e portanto vermelhos.

**Approach:** Estender `DestinationDialog.tsx` de forma ADITIVA — `offer` volta a aceitar LISTA e `DestinationDayOffer` recupera as variantes `none` (destino sem dia, ex. "Hoje") e `month-choice` (mês escolhido pelo usuário, ex. "Futuro") — sem tocar o contrato `onConfirm(scheduledDate, meta)`. Cablear `onMove` nos dois boards abrindo esse diálogo a partir do detalhe da tarefa, com `FutureBoardPage.tsx:483-492` como molde de wireup e `BrainDumpDestinationPicker.tsx:243-275` como molde vivo do radiogroup de destinos nomeados. Reescrever (não reabilitar) os 4 E2E vermelhos para o caminho real: detalhe da tarefa → seletor novo.

## Boundaries & Constraints

**Always:**
- Extensão ADITIVA: os 2 call-sites existentes de `DestinationDialog` (`WeeklyPlanningPage.tsx:515`, `MonthlyPlanningPage.tsx:527`) passam `offer` como OBJETO ÚNICO e não podem exigir nenhuma edição. Uma oferta só ⇒ nenhum radiogroup de destinos (não renderizar grupo de um item só).
- `onConfirm(scheduledDate, meta)` intocado. O chamador continua decidindo o `destination` do POST a partir de `meta.offerId`.
- `DestinationDialog` permanece AGNÓSTICO de domínio: nada de `../api`, `Task`, `useMigrateTaskMutation` nem import de `app/layout/shell`. O ícone de cada destino entra como `ReactNode` vindo do chamador.
- Regras de domínio de `POST /migrate/` (verificadas em `backend/bujo/views.py:770-781` e `services/migration.py:128-172`), a respeitar nos chamadores:
  - `'today'` ignora `scheduledDate`; origem vira MIGRATED.
  - `'week'` SEM `scheduledDate` cai na semana CORRENTE no servidor, nunca na semana em foco ⇒ "Sem dia definido" fica INDISPONÍVEL com motivo quando a semana em foco não é a corrente. COM `scheduledDate`, o servidor deriva a semana do dia.
  - `'month'` sempre grava no mês CORRENTE (`month_first` é calculado no servidor, nunca aceito do cliente); origem vira POSTPONED.
  - `'future'` exige `monthFirst` ESTRITAMENTE posterior ao mês corrente (400 com "Use 'month' para o mês corrente." caso contrário); origem vira POSTPONED.
- Regra do Monthly: a oferta do mês EM FOCO usa `'month'` quando o foco é o mês corrente e `'future'` + `monthFirst` caso contrário; quando o foco é ANTERIOR ao mês corrente a oferta aparece INDISPONÍVEL com motivo (nunca um 400 cru) — mesmo racional de `monthWouldBeRejectedAsFuture()`/`STALE_TARGET_MIGRATE_ERROR` em `MonthlyPlanningPage.tsx:207-213`.
- Falha de escrita mantém o diálogo ABERTO com o destino armado e o motivo visível (`error` já existe).
- Guard de escrita dupla: `disabled` cobre offline E mutação em curso, como nos dois rituais.
- Idioma pt-BR em código, rótulos e testes.

**Block If:**
- Se preservar a anatomia exigir mudar o contrato de `POST /migrate/` — esta passada é frontend-only.
- Se algum teste pré-existente FORA de `move-task.spec.ts` exigir mudança de COMPORTAMENTO (não só de locator) para voltar ao verde.

**Never:**
- Não tocar `FutureBoardPage.tsx`, `MigrationRitualPage.tsx`, `DestinationPicker.tsx`, `MonthlyDestinationPicker.tsx`, `BrainDumpDestinationPicker.tsx`, `TaskDestinationDialog.tsx`, `TaskRow.tsx`, `TaskRowBase.tsx` nem superfícies legadas.
- Não cablear `onMove` em `ArchiveWeeklyDetailPage.tsx` / `ArchiveMonthlyDetailPage.tsx` — questão de produto em aberto (ver Design Notes).
- Não adicionar affordance de mover na LINHA (`TaskRowBase`) — o caminho é o detalhe da tarefa.
- Não editar `deferred-work.md`, `sprint-status.yaml` nem `epics.md`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Uma oferta só (rituais) | `offer` objeto único | Sem radiogroup de destinos; anatomia idêntica à de hoje | N/A |
| Lista de ofertas | `offer` com N>1 | `role="radiogroup"` "Selecionar destino", um `role="radio"` por oferta; nada pré-selecionado; anatomia do dia só da oferta selecionada | N/A |
| Destino `none` ("Hoje") | Oferta `kind:'none'` selecionada | Confirmável de imediato; `onConfirm(null, { offerId, monthFirst: '' })` | N/A |
| Destino `month-choice` ("Futuro") | Mês digitado > mês corrente | Calendário do mês escolhido + "Sem dia definido"; `meta.monthFirst` = mês escolhido | Mês ≤ corrente: `role="alert"` com o motivo, confirmar indisponível |
| Troca de mês no `month-choice` | Dia 31 armado, usuário troca para mês de 30 dias | Dia armado DESCARTADO | N/A |
| Weekly Board, semana em foco ≠ corrente | Board navegado com o stepper | Oferta da semana em foco com "Sem dia definido" INDISPONÍVEL e motivo no nome acessível | N/A |
| Monthly Board, mês em foco < corrente | Board navegado para mês passado | Oferta do mês em foco visível e INDISPONÍVEL, com o motivo | N/A |
| Falha do `POST /migrate/` | Servidor 4xx/5xx | Diálogo permanece aberto, destino armado preservado, "Não foi possível mover a tarefa. Tente novamente." | Sem toast, sem fechar |
| Offline ou mutação em curso | `!isOnline` ou `isPending` | Todos os controles do diálogo desabilitados | Segundo clique não gera 2º POST |
| Período readonly | `closed`/`finalized` | `TaskDetailCard` com `readonly` já some com o rodapé inteiro — nada a fazer | N/A |

</intent-contract>

## Code Map

- `frontend/src/features/bujo/components/DestinationDialog.tsx` -- **alvo principal**. Tipos :58-132 (`DayOfferWeek` :61, `DayOfferMonth` :71, `DestinationDayOffer` :78, `DestinationOffer` :80-93, `DestinationConfirmMeta` :95-102, `DestinationSelection` :104-107, props :109-132) · `weekOffer`/`monthOffer` :204-205 · reset de período :221-227 · foco inicial :248-254 · `currentSelection()` :289-300 · `confirm()` :304-310 · teclado no container :334-367 · `shortcutHint` :395-397 · corpo :404-607 · ramo `Drawer`/`Dialog` :610-658.
- `frontend/src/features/braindump/components/BrainDumpDestinationPicker.tsx` -- **molde VIVO da anatomia a recuperar**, SOMENTE LEITURA: radiogroup de 4 destinos nomeados com `navIconFor` :243-275 · `input type="month"` + erro de mês corrente :340-376 e :71 · "Sem dia definido" :378-389 · rótulo nomeado do ato :176-192.
- `frontend/src/pages/planner/FutureBoardPage.tsx` -- **molde de wireup**, SOMENTE LEITURA: `openMove`/`closeMove`/`confirmMove` :196-228 · `confirmLabelFor` :230-239 · `onMove` do `TaskDetailCard` :483-494 (fecha o detalhe e abre o seletor).
- `frontend/src/pages/planner/WeeklyBoardPage.tsx` -- call-site a cablear :384-393. `weekStart`/`status`/`closed` :131 · `isReadonly` :132 · `isCurrentWeek` :133 (a regra de "Sem dia") · `currentWeekLog` :110 · `allTasksById`/`openTask` :146-151. NÃO tem `useTodayLogQuery` — precisa adicionar para saber o mês corrente.
- `frontend/src/pages/planner/MonthlyBoardPage.tsx` -- call-site a cablear :415-423. Cabeçalho :24-26 documenta o gap como deliberado (**atualizar**) · `monthFirst` :141 · `isCurrentMonth` :143 · `todayIso` :144 (via `useTodayLogQuery` :120) · `formatMonthTitle` :98 · `addMonthsIso` :103.
- `frontend/src/features/bujo/components/TaskDetailCard.tsx` -- `onMove?` :56 · botão :316-320 (**condicionar a `onMove`**). Todos os testes que afirmam presença do botão já passam `onMove` (`TaskDetailCard.test.tsx` :248, :263, :496) — nenhum quebra.
- `frontend/src/features/bujo/api.ts` -- `MigrationDestination` :451 · `MigrateTaskVariables` :453-458 · `useMigrateTaskMutation` :465-490 (invalidação por prefixo já cobre daily/weekly/monthly/future/density). Sem mudança.
- `backend/bujo/views.py:759-793` + `backend/bujo/services/migration.py:128-172` -- contrato de `/migrate/`, SOMENTE LEITURA (regras acima).
- `frontend/src/shared/date/index.ts` -- `mondayIsoOf` :53 · `lastDayOfMonth` :117 · `addDaysIso` :34 · `addMonthsIso` :131 · `formatDayLabel` :185.
- `frontend/src/app/layout/shell/navIcons.tsx:119` -- `navIconFor(key, weight)`; chaves `today` / `planner-week` / `planner-month` / `planner-future` (ver `BrainDumpDestinationPicker.tsx:38-43`). Chamado PELOS BOARDS, nunca de dentro de `DestinationDialog`.
- `frontend/src/features/bujo/index.ts:57-65` -- barrel: exportar os tipos novos.
- Testes a estender: `DestinationDialog.test.tsx` (622 linhas; padrões de assert de portal :72-108 e de teclado :110-197), `WeeklyBoardPage.test.tsx` (`mockRoutes` :65-71 — **falta a rota `/api/bujo/logs/today/`**), `MonthlyBoardPage.test.tsx` (`mockRoutes` :53-67 já serve `today`).
- `frontend/e2e/move-task.spec.ts` -- 4 testes a REESCREVER (:86, :131, :194, :341) + o comentário :173-193 que documenta o gap. Locators do sistema novo: `Ver detalhes de <título>` (`TaskRowBase.tsx:409`), diálogo `Detalhe da tarefa` (`TaskDetailCard.tsx:180`), status de origem via `getByLabel(/^Migrada/)` / `/^Adiada/` (o rótulo real é `"<Status> — ir para o sucessor"`, `TaskRowBase.tsx:311-316`). Nenhum gate de CI usa `--grep-invert` — a exclusão citada no comentário era manual.

## Tasks & Acceptance

**Execution:**
- `frontend/src/features/bujo/components/DestinationDialog.tsx` -- adicionar `DayOfferNone` (`kind:'none'`) e `DayOfferMonthChoice` (`kind:'month-choice'` + `rejectUpToMonthFirst?` + `rejectedMonthReason?`) a `DestinationDayOffer`; adicionar `label?`, `icon?: ReactNode` e `unavailableReason?` a `DestinationOffer`; aceitar `offer: DestinationOffer | DestinationOfferList`; renderizar o radiogroup de destinos só quando há mais de uma oferta -- é a extensão aditiva que o wireup exige
- `frontend/src/features/bujo/components/DestinationDialog.test.tsx` -- cobrir a matriz de I/O nova (oferta única sem radiogroup, lista com radiogroup, `none` confirmável de imediato, `month-choice` com mês inválido/válido, descarte do dia ao trocar de mês, oferta indisponível não selecionável) e provar que o assert de portal e o de Enter-uma-vez seguem valendo na forma de lista -- a anatomia nova não pode reabrir os defeitos já fechados
- `frontend/src/features/bujo/index.ts` -- exportar os tipos novos no barrel -- coerência com o que já é exportado
- `frontend/src/features/bujo/components/TaskDetailCard.tsx` -- condicionar o botão "Mover tarefa" à presença de `onMove` -- elimina por construção o clique morto, em qualquer superfície
- `frontend/src/pages/planner/WeeklyBoardPage.tsx` -- adicionar `useTodayLogQuery`, estado de move, montagem das ofertas, `confirmLabelFor`, `handleConfirmMove` e `onMove` no `TaskDetailCard` (molde de `FutureBoardPage`) -- fecha o clique morto no Weekly
- `frontend/src/pages/planner/MonthlyBoardPage.tsx` -- o mesmo, com a regra `'month'` vs `'future'` do mês em foco e o bloqueio do mês passado; atualizar o comentário de cabeçalho :24-26 -- fecha o clique morto no Monthly e remove documentação que passou a mentir
- `frontend/src/pages/planner/WeeklyBoardPage.test.tsx` -- servir `/api/bujo/logs/today/` no `mockRoutes` e cobrir: o diálogo abre com as ofertas certas, "Sem dia" indisponível fora da semana corrente, cada destino manda o POST certo -- a prova por página do wireup
- `frontend/src/pages/planner/MonthlyBoardPage.test.tsx` -- cobrir: mês em foco corrente ⇒ `'month'`; mês em foco futuro ⇒ `'future'` + `monthFirst`; mês em foco passado ⇒ oferta indisponível com motivo e nenhum POST -- a regra de domínio do Monthly não pode regredir em silêncio
- `frontend/e2e/move-task.spec.ts` -- reescrever os 4 testes (:86, :131, :194, :341) para o caminho detalhe da tarefa → seletor novo e substituir o comentário :173-193 pelo registro de que o gap foi fechado -- eles são o registro executável desta regressão

**Acceptance Criteria:**
- Dado o Weekly Board ou o Monthly Board com uma tarefa aberta no detalhe, quando o usuário clica em "Mover tarefa", então o seletor de destino novo abre sobreposto (portalizado no não-compact, `Drawer` no compact) com os destinos nomeados disponíveis naquela superfície.
- Dado um destino escolhido e confirmado, quando o `POST /migrate/` responde 200, então o seletor e o detalhe fecham, a origem passa a exibir "Migrada"/"Adiada" conforme o destino, e a tarefa aparece na superfície de destino sem recarregar a página.
- Dados os dois rituais (semanal e mensal), quando a suíte roda, então o comportamento do seletor deles permanece idêntico ao de hoje, sem uma linha alterada nos seus call-sites.
- Dada qualquer superfície que renderize `TaskDetailCard` sem `onMove`, quando o detalhe abre, então não existe botão "Mover tarefa" no DOM.

## Spec Change Log

- **2026-08-05 — `move-task.spec.ts` tinha 10 testes, não 11, e 5 vermelhos, não 4.** A Verification pedia "11/11 verdes"; o arquivo sempre teve 10 `test()`. Além dos 4 citados (:86, :131, :194, :341), `mover para Esta semana sem escolher dia` (:382) também estava vermelho na baseline — provado rodando SÓ ele com a árvore no `baseline_revision` (`git stash`). Causa: locator obsoleto (`.MuiTypography-heading`, que o `WeeklyTaskPanel` do sistema novo não renderiza — o pool é um `role="region"` nomeado), não comportamento. Corrigido junto, dentro do mesmo arquivo, sem tocar produção: o Block If só proíbe mudança de COMPORTAMENTO em teste pré-existente FORA de `move-task.spec.ts`. Resultado: 10/10 verdes.
- **2026-08-05 — dois cliques de navegação do shell precisaram de `exact: true`.** Nos testes reescritos, `getByRole('button', { name: 'Hoje' | 'Futuro' })` passou a colidir com o botão `Ver detalhes de <título>` das tarefas criadas ("Tarefa trazida para hoje", "Tarefa a adiar no futuro") — o match do Playwright é substring e case-insensitive. Só locator; nenhuma mudança de comportamento.
- **2026-08-05 — a baseline de `tsc` está LIMPA.** A Verification previa erros pré-existentes (DW-28); `npx tsc -b --noEmit` sai 0 antes e depois. A baseline de `vitest` tem 8 falhas pré-existentes em 4 arquivos (`TaskDestinationDialog`, `TaskDetailPanel`, `noLiteralTokens/ItemRowBase`, `FuturePage`), todas fora do Code Map e idênticas depois da passada.

## Review Triage Log

## Design Notes

**Ofertas por board.** Cada board oferta o período que ele mostra MAIS os canônicos, porque `'week'` e `'month'` gravam em logs DIFERENTES — não dá para alcançar um pelo outro:

- **Weekly Board:** `today` "Hoje" (`none`) · `week` "Esta Semana" (`week`, semana CORRENTE, "Sem dia" disponível) · `board-week` "<intervalo da semana em foco>" (`week`, só quando o foco ≠ semana corrente, "Sem dia" INDISPONÍVEL com motivo) · `month` "Este Mês" (`month`, mês corrente) · `future` "Futuro" (`month-choice`).
- **Monthly Board:** `today` "Hoje" · `week` "Esta Semana" (semana corrente) · `month` "Este Mês" (mês corrente) · `board-month` "<título do mês em foco>" (só quando o foco ≠ mês corrente; mapeia para `'future'` + `monthFirst`; INDISPONÍVEL com motivo quando o foco é anterior ao corrente) · `future` "Futuro".

**Por que o ícone entra como `ReactNode`.** `DestinationDialog` promete no seu próprio cabeçalho (:15-18) não conhecer domínio nem shell. O chamador passa `navIconFor('planner-week')` já resolvido; a seleção continua sinalizada por `aria-checked` + `CONTROL_SELECTED_SX`, sem depender do peso `fill` do ícone.

**Por que `kind:'none'` NÃO usa o estado `armed`.** O efeito de reset de período (:223-227) apaga `armed` quando a chave do período muda; selecionar "Hoje" muda a chave e apagaria um `armed === null` recém-posto. Derivar a seleção direto do `kind` da oferta selecionada elimina a corrida:

```ts
function currentSelection(): DestinationSelection | null {
  if (!selectedOffer) return null
  if (selectedOffer.day.kind === 'none') {
    return { offerId: selectedOffer.id, scheduledDate: null, monthFirst: '' }
  }
  // ... (caminho atual, inalterado)
}
```

`monthFirst: ''` já é valor possível hoje (:296) e é ignorado por quem consome `'today'`.

**Sem densidade nas ofertas dos boards.** `densityByDate` é opcional e vem do chamador; para um mês que o usuário ainda vai escolher (`month-choice`) o chamador não tem como saber qual buscar. Os calendários dos boards abrem sem contagem — honesto, e sem um segundo endpoint divergente.

**Fora de escopo, registrado:** `ArchiveWeeklyDetailPage.tsx:367` e `ArchiveMonthlyDetailPage.tsx:376` renderizam o mesmo `TaskDetailCard` sem `onMove`. Condicionar o botão a `onMove` faz o botão morto SUMIR dessas telas — melhor que um controle que não faz nada —, mas NÃO decide se mover tarefa de período arquivado deve existir: isso segue sendo questão de produto, a registrar como trabalho diferido.

## Verification

**Commands:**
- `nvm use 22.15.1` -- pré-requisito: a sessão inicia em Node 18, incompatível com o frontend
- `cd frontend && npx tsc -b --noEmit` -- expected: SEM ERRO NENHUM. A baseline em `747c70d` está limpa (medida nesta passada); a ressalva original sobre erros pré-existentes de DW-28 não se aplica a este repositório hoje
- `cd frontend && npm run lint` -- expected: sem erro
- `cd frontend && npx vitest run` -- expected: as MESMAS 8 falhas pré-existentes da baseline, em 4 arquivos fora do Code Map (`TaskDestinationDialog.test.tsx`, `TaskDetailPanel.test.tsx`, `recurring/noLiteralTokens.test.ts`, `FuturePage.test.tsx`) e nenhuma outra; medir a baseline ANTES e comparar, para provar zero regressão
- `cd frontend && CI=1 npx playwright test e2e/move-task.spec.ts` -- expected: 10/10 verdes (o arquivo tem 10 `test()`, não 11). Na baseline eram 5 vermelhos, não 4: além dos citados (:86, :131, :194, :341), `mover para Esta semana sem escolher dia` (:382) também falhava, por locator obsoleto — ver Spec Change Log. O Playwright sobe os servidores sozinho contra o Postgres local `bujo_e2e`
- `cd frontend && CI=1 npx playwright test e2e/weekly-board.spec.ts e2e/monthly-board.spec.ts e2e/weekly-planning-ritual.spec.ts e2e/monthly-planning-ritual.spec.ts` -- expected: verde; prova que os rituais e os boards não regrediram

**Manual checks (if no CLI):**
- Nas faixas wide e compact, abrir o detalhe de uma tarefa no Weekly e no Monthly Board e confirmar que "Mover tarefa" abre o seletor sobreposto e visível sem rolagem, e que confirmar move de fato.
</content>
</invoke>
