---
title: 'DW-20 — Enter global não pode confirmar destino/dia obsoleto nos seletores'
type: 'bugfix'
created: '2026-08-03'
status: 'blocked'
baseline_revision: '69ebc01f671e4c878c83989a03ac03cc470d90b7'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** O atalho global de `Enter` de `useKeyboardShortcuts` lê o estado React no bubbling do `keydown`, ANTES do clique nativo que a própria tecla dispara como ação default no `<button role="radio">`/`role="gridcell"` focado — então `confirm()` age sobre o destino/dia armado ANTES do foco atual e pode mover/migrar a tarefa para um alvo obsoleto (DW-20).

**Approach:** Quando a tecla é `Enter`, o default ainda não foi prevenido e o alvo focado ATIVA nativamente (`BUTTON`/`SUMMARY`/`A[href]`), o hook NÃO roda o handler — quem manda é a ação do próprio botão focado (o clique nativo). O atalho global deixa de existir nesse caminho, então não há mais leitura de estado obsoleto: o bug não é corrigido lendo o estado depois, é corrigido não lendo.

**Semântica FIXADA (decisão humana de 2026-08-03 — ver `Spec Change Log`):** `Enter` numa opção focada (`role="radio"`/`role="gridcell"`) apenas ARMA aquela opção; a gravação continua sendo um ato explícito no botão NOMEADO de confirmação — coerente com o invariante já documentado em `BrainDumpDestinationPicker.tsx:17-19` ("a pré-seleção só marca o radio; confirmar continua sendo um ato explícito do usuário"). A alternativa "o `Enter` arma o focado E confirma" foi REJEITADA (ver `Never`). Para o texto "Enter confirma" seguir literal em uma tecla no fluxo de atalho, a seleção por DÍGITO (`1`-`7`/`0`) move o foco para o botão nomeado de confirmação — não para o radio armado —, de modo que o `Enter` seguinte ative esse botão nativamente e confirme UMA única vez.

## Boundaries & Constraints

**Always:**
- O fix da corrida vive no hook COMPARTILHADO (`useKeyboardShortcuts`) — cobre `BrainDumpDestinationPicker` (M11), `DestinationPicker` (M10) e `WeeklyDestinationPicker` (14.5) de uma vez.
- O diff do hook é UM guard novo em `handleKeyDown`: se `event.key === 'Enter'` && `!event.defaultPrevented` && o alvo ativa nativamente (`BUTTON`/`SUMMARY`/`A[href]`), retornar sem chamar o handler. Sem adiamento (`setTimeout`/microtask), sem espelho de handler em ref, sem mudar as deps do `useEffect` — nada disso é necessário quando o handler simplesmente não roda.
- O guard é GERAL (qualquer alvo que ative nativamente), não escopado por `role`: em todo botão focado a ação do próprio botão é a intenção do usuário, e é justamente o atalho global disparando por cima que produz a classe do DW-20.
- Se o default JÁ foi prevenido por um listener anterior (ex. um `onKeyDown` local do componente): não haverá clique nativo, logo não há leitura obsoleta possível ⇒ o handler roda SÍNCRONO, como hoje.
- Teclas que NÃO ativam o alvo nativamente (dígitos, `Escape`) continuam síncronas, com o guard atual (editável + modificador) intacto — o guard novo é só para `Enter`.
- Onde a seleção acontece por atalho de dígito, o foco vai para o BOTÃO NOMEADO de confirmação (que só existe quando há alvo armado), pelo caminho do DÍGITO apenas.
- Comentários e nomes de teste em pt-BR.

**Block If:**
- Algum consumidor do hook que registre `Enter` não oferecer nenhum botão nomeado de confirmação alcançável por `Tab`: com este guard, o usuário de teclado ficaria sem caminho para confirmar. (Verificado no planejamento: os 3 consumidores renderizam o botão nomeado logo depois das opções, na ordem do DOM — `BrainDumpDestinationPicker`, `DestinationPicker:395-413`, `WeeklyDestinationPicker:157-177`.)

**Never:**
- Não adiar o `Enter` para o macrotask (semântica "o `Enter` arma o focado E confirma"): REJEITADA na resolução de 2026-08-03 — com a 1ª opção auto-focada na montagem do `WeeklyDestinationPicker`, um `Enter` solto (ou o key-repeat do próprio `Enter` que abriu o seletor) gravaria a migração com uma tecla, sem nada armado e sem o botão nomeado ter aparecido.
- Não mexer no auto-foco da 1ª opção na montagem do `WeeklyDestinationPicker` (`:49-51`; AC da Story 14.5, pinada em `WeeklyDestinationPicker.test.tsx:147-152`): com esta semântica um `Enter` solto após abrir só ARMA a segunda-feira, sem gravar nada — a AC continua válida como está.
- Não roubar o foco no clique de MOUSE numa opção: só o caminho de dígito move o foco. O usuário de mouse segue para o botão nomeado por conta própria.
- Não mexer em `MonthlyDestinationPicker` (mecanismo diferente: `onKeyDown` local + `preventDefault`, que já cancela o clique nativo — não há leitura obsoleta via `window`).
- Não cobrir `Space`: o clique nativo de `Space` sai no `keyup`, não no `keydown` onde o guard vive; nenhum consumidor registra `Space` hoje, e armar por `Space` numa opção focada já funciona nativamente.
- Não redesenhar os radiogroups (roving tabindex / ARIA completo) nem trocar contratos de `onConfirm`/`useProcessBrainDumpItemMutation`.
- Não editar o ledger de deferred-work (o orquestrador registra a resolução).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Foco novo vence o armado (DW-20) | Dia X armado; foco (Tab) vai para o dia Y; `Enter` | O clique nativo ARMA Y (o botão nomeado passa a nomear Y); NENHUMA confirmação — nem de X (o obsoleto, que é o bug) nem de Y | Sem POST |
| Confirmar o alvo armado | Dia Y armado; foco no botão nomeado; `Enter` | O clique nativo confirma Y UMA única vez (o atalho global não roda ⇒ sem confirmação dupla) | Sem erro esperado |
| Dígito arma e leva ao botão | Foco na opção 1; tecla `3` | Arma quarta E move o foco para o botão nomeado ("Migrar para quarta, …") | Sem POST |
| Dígito + `Enter` (AC5 da 14.5) | Depois do `3` acima, `Enter` | Confirma quarta (clique nativo do botão nomeado já focado) — o fluxo `2` + `Enter` de `weekly-planning-ritual.spec.ts` segue idêntico do ponto de vista do usuário | Sem erro esperado |
| `Enter` solto após abrir | `WeeklyDestinationPicker` recém-montado (1ª opção auto-focada), nada armado; `Enter` (inclusive key-repeat de quem abriu o seletor) | Arma segunda-feira e o botão nomeado aparece; NADA é gravado | Sem POST |
| Destino focado sem dia | `destination='week'` com dia armado; foco vai para o radio "Este Mês"; `Enter` | Clique arma "Este Mês" e limpa o dia ⇒ nada é confirmado | Sem POST |
| Alvo não-ativável | `Enter` com foco em `div`/`window`/paper do dialog | Handler roda de forma SÍNCRONA, como hoje: confirma o alvo armado (ou nada, se não houver) | Sem erro esperado |
| Tecla não-ativadora | `3`/`0`/`Escape` com foco num `<button>` | Handler roda de forma SÍNCRONA (o guard novo é só para `Enter`) | Sem erro esperado |
| Default já prevenido | `Enter` num `<button>` cujo `onKeyDown` local chamou `preventDefault()` | Sem clique nativo ⇒ handler roda SÍNCRONO (nada a sobrescrever) | Sem erro esperado |
| Outro botão focado | `Enter` com foco numa aba, em `‹`/`›`, no "×" ou no "0 Sem dia" `aria-disabled` | SÓ a ação do próprio botão (trocar aba / passo de dia / fechar / nada) — nunca uma confirmação por cima | Sem POST |
| Campo editável | `Enter`/dígito com foco em `INPUT`/`TEXTAREA`/contentEditable | Atalho ignorado (guard atual) | Sem erro esperado |

</intent-contract>

## Code Map

- `frontend/src/shared/hooks/useKeyboardShortcuts.ts` — ÚNICO ponto do fix da corrida. `handleKeyDown` (:27-36) só exclui INPUT/TEXTAREA/contentEditable e modificadores: o guard novo entra logo depois desses, antes da busca do handler. Deps `[enabled, handlers]` (:40) ficam como estão — sem timer pendente para preservar, o re-registro a cada render é irrelevante.
- `frontend/src/shared/hooks/useKeyboardShortcuts.test.ts` — 7 testes; todos despacham `keydown` com `target` explícito (`window`/`input`/`div`), padrão a reusar para o alvo `<button>`.
- `frontend/src/features/braindump/components/BrainDumpDestinationPicker.tsx` — superfície reportada. `confirm()` (:188-203) lê `destination`/`scheduledDate`/`futureMonthFirst`; `useKeyboardShortcuts({ Enter: confirm, Escape: onClose })` (:205-208); radios de destino (:245-267), radios de dia da semana (:299-320), "Sem dia definido" (:373-382). SEM atalho de dígito ⇒ **não muda uma linha**: o fix do hook basta, e o caminho de teclado para confirmar é `Tab` até o botão primário nomeado + `Enter`.
- `frontend/src/features/bujo/components/DestinationPicker.tsx` — mesma anatomia (M10, consumido por `MigrationRitualPage`). `confirm()` (:159-164), `shortcutHandlers` com `Enter`/`Escape` + dígitos `1`-`7` guardados por `tab === 'week'` (:166-177), radios de dia (:214-238), `gridcell`s do mês (:327-346), botão nomeado condicionado a `selection` (:395-413). O foco vai para esse botão SÓ no caminho dos dígitos — `selectWeekday` (:110-113) também é chamado pelo `onClick` do radio (:220), então o desvio de foco não pode morar dentro dele sem distinguir a origem.
- `frontend/src/features/bujo/components/weekly/WeeklyDestinationPicker.tsx` — TERCEIRO consumidor do hook (não citado no ledger, mas afetado pelo fix): auto-foca a opção 1 na montagem (:44-51, :99) e os dígitos armam OUTRO alvo — sem mover o foco, o `Enter` seguinte cairia no radio focado e apenas re-armaria a opção 1, sem nunca confirmar. Botão nomeado condicionado a `armedIndex !== null` (:157-177): ele NÃO existe no commit em que o dígito arma, então o foco precisa ser aplicado depois do commit (ref + efeito, não uma chamada direta dentro de `selectTarget` :53-56, que também é o `onClick` do radio :105).
- `frontend/src/features/bujo/components/MonthDensityCalendar.tsx:162-177` — dias interativos são `ButtonBase` (⇒ `<button>` real), logo cobertos pelo guard do hook; somente leitura.
- `frontend/src/features/bujo/components/monthly/MonthlyDestinationPicker.tsx:114-123` — fora de escopo (handler local com `preventDefault`); somente leitura, serve de contraste na Design Note.
- Testes existentes que provam ausência de regressão: `DestinationPicker.test.tsx:32-40`, `WeeklyDestinationPicker.test.tsx:73-85,109-121,147-153`, `WeeklyPlanningPage.test.tsx:258,332` — todos usam `fireEvent.keyDown(window, …)` (alvo não-ativável ⇒ caminho síncrono preservado).
- `frontend/e2e/brain-dump-inbox.spec.ts:42-65` — harness pronto do seletor do Brain Dump (capturar item → "Mover" → "Esta Semana" → dia). Idioma de asserção de payload já usado em `e2e/move-task.spec.ts:110-118` (`page.waitForResponse` + `response.request().postDataJSON()`).
- `frontend/e2e/weekly-planning-ritual.spec.ts:96-115` — e2e real de `2` + `Enter` no `WeeklyDestinationPicker`; precisa continuar verde.

## Tasks & Acceptance

**Execution:**
- `frontend/src/shared/hooks/useKeyboardShortcuts.ts` — manter os guards atuais e acrescentar um guard: se `event.key === 'Enter'` && `!event.defaultPrevented` && o alvo ativa nativamente (`BUTTON`/`SUMMARY`/`A[href]`), retornar sem chamar o handler. Nada mais muda no hook (sem `setTimeout`, sem ref de handlers, sem mexer nas deps).
- `frontend/src/features/bujo/components/weekly/WeeklyDestinationPicker.tsx` — ref no botão nomeado de confirmação e, SÓ no caminho dos dígitos (`1`-`7`/`0`), focá-lo depois do commit em que o alvo é armado (ex.: flag num ref consumida por um efeito que depende de `armedIndex`). Nada de foco quando `selectTarget` volta cedo (`0` com `isCurrentWeek === false`) nem no `onClick` de mouse. Auto-foco da opção 1 na montagem PERMANECE.
- `frontend/src/features/bujo/components/DestinationPicker.tsx` — mesma coisa para os dígitos `1`-`7` da aba "Esta semana": focar o botão nomeado depois do commit, sem tocar no caminho de `onClick`/`stepDay`/grade do mês.
- `frontend/src/shared/hooks/useKeyboardShortcuts.test.ts` — cobrir a matriz do hook: `Enter` com alvo `<button>` NÃO chama o handler; caso irmão com alvo `div`/`window` chama (par não-vacuoso); `Enter` num `<button>` com `defaultPrevented` chama; tecla `3` com alvo `<button>` chama (o guard é só para `Enter`); `Escape` com alvo `<button>` chama.
- `frontend/src/features/braindump/components/BrainDumpDestinationPicker.test.tsx` — regressão DW-20 com `userEvent` (reproduz keydown→keypress→click como o browser): dia X armado + foco em outro dia Y + `Enter` ⇒ NENHUM POST e o radio Y fica `aria-checked` (o obsoleto X nunca é gravado); em seguida `Enter` com o foco no botão nomeado ⇒ UM POST com o `scheduledDate` de Y. Repetir o caso do POST na faixa compact (Drawer) — AC nº 2.
- `frontend/src/features/bujo/components/DestinationPicker.test.tsx` — a MESMA regressão na grade do mês (`role="gridcell"`, AC nº 1): dia X armado + foco no `gridcell` Y + `Enter` ⇒ `onConfirm` não é chamado e Y fica armado; `Enter` no botão nomeado ⇒ `onConfirm` UMA vez com Y. Mais o par do atalho: dígito arma o dia, o foco vai para o botão nomeado, `Enter` confirma o dia do DÍGITO.
- `frontend/src/features/bujo/components/weekly/WeeklyDestinationPicker.test.tsx` — com `userEvent` e o foco real na opção 1: (a) `Enter` solto logo após a montagem ⇒ `onConfirm` NÃO é chamado e a segunda fica armada; (b) tecla `3` move o foco para o botão nomeado e o `Enter` seguinte confirma quarta UMA vez; (c) tecla `0` com `isCurrentWeek === false` ⇒ nada armado, foco intacto, nenhum `onConfirm`.
- `frontend/e2e/brain-dump-inbox.spec.ts` — teste novo em browser real: armar um dia, focar outro dia do radiogroup, `Enter`, provar que NÃO houve POST `/process/` e que o botão nomeado passou a nomear o dia focado; então ativar o botão nomeado e afirmar pelo payload que o `scheduledDate` é o do dia focado. A data esperada tem de vir do próprio DOM/API (rótulo do botão / resposta da week), nunca do relógio local do browser (o servidor usa `TIME_ZONE = "UTC"`; em fuso negativo, domingo à noite, o oráculo local erra a semana).
- `frontend/e2e/migration-ritual.spec.ts` (ou o e2e equivalente do M10) — prova em browser real do `DestinationPicker`, que é um dos dois componentes efetivamente modificados: dígito arma o dia da semana, o foco vai para o botão nomeado e `Enter` migra uma única vez.

**Acceptance Criteria:**
- Dado o ritual de migração (M10, `MigrationRitualPage`) com um dia já armado na grade do mês, quando o foco for para outro `gridcell` e `Enter` for pressionado, então NADA é migrado e o dia focado passa a ser o armado (o obsoleto nunca é gravado); a migração acontece no botão nomeado — a mesma regra vale para as duas superfícies, sem `preventDefault` nem adiamento próprio em nenhum dos pickers.
- Dado o seletor do Brain Dump em faixa compact (Drawer), quando o `Enter` num radio focado armar o destino, então o comportamento é o mesmo da faixa pointer (o guard é do hook, não do container).
- Dado o `WeeklyDestinationPicker` recém-aberto com a 1ª opção auto-focada e nada armado, quando `Enter` for pressionado (inclusive por key-repeat de quem abriu o seletor), então nenhuma migração é gravada.
- Dado que a suíte inteira do frontend é executada, quando `npm run test:run` terminar, então nenhum teste existente regride (em especial os que usam `fireEvent.keyDown(window, …)` e o que pina o auto-foco da 1ª opção).
- Dado o ritual semanal em browser real, quando `weekly-planning-ritual.spec.ts` rodar, então o fluxo `2` + `Enter` continua confirmando terça (agora porque o `2` levou o foco ao botão nomeado).

## Spec Change Log

### 2026-08-03 — Resolução da escalação CRITICAL (intent gap), decidida com o humano

**Pergunta:** com o foco numa opção (`role="radio"`/`role="gridcell"`), o `Enter` deve armar o alvo focado E confirmar na mesma tecla, ou apenas ARMAR?

**Decisão (humano):** apenas ARMAR — o botão focado manda. O atalho global de `Enter` não roda quando o alvo focado ativa nativamente; a gravação continua sendo um ato explícito no botão nomeado; a seleção por dígito move o foco para esse botão, para que "Enter confirma" siga valendo em uma tecla no fluxo de atalho.

**Por que:** a semântica anterior ("adiar e confirmar") fazia um `Enter` solto logo depois de abrir o `WeeklyDestinationPicker` migrar a tarefa para segunda-feira, com nada armado e sem o botão nomeado ter aparecido (reproduzido em browser real: `POST /migrate/` → 200). Ela contradizia o invariante de `BrainDumpDestinationPicker.tsx:17-19` e só se sustentaria mudando o auto-foco da 1ª opção, que é AC da Story 14.5 pinada em teste. A opção escolhida deixa essa AC intacta e ainda encerra em espécie 4 achados `medium` da mesma classe (confirmação dupla no botão nomeado; `Enter` confirmando junto com troca de aba e com os passos `‹`/`›`; `Enter` no "0 Sem dia" `aria-disabled` confirmando o alvo anterior).

**O que mudou nesta spec:** `Approach` (semântica fixada), `Boundaries & Constraints` (guard novo no lugar de adiamento/timers/ref; auto-foco da 14.5 protegido por `Never`; foco de mouse não é roubado), a `I/O & Edge-Case Matrix` inteira, o `Code Map` dos 3 consumidores, `Tasks & Acceptance` (incluindo as lacunas de teste que a passagem anterior havia listado: `role="gridcell"`, alvo `0`/"Sem dia", faixa compact/Drawer, prova em browser real dos DOIS componentes modificados e oráculo de data do e2e vindo do DOM/API) e as `Design Notes`.

**Sobre o patch preservado** (`spec-dw-20-destination-picker-enter-key-race.attempt-2026-08-03.patch`): implementa a semântica REJEITADA — serve apenas como evidência e como fonte de andaimes de teste (harness de `userEvent`, alvos de `keydown`). NÃO reaplicar como está.

## Review Triage Log

### 2026-08-03 — Review pass
- intent_gap: 1: (high 1, medium 0, low 0)
- bad_spec: 0
- patch: 0
- defer: 7: (high 0, medium 7, low 0)
- reject: 5
- addressed_findings:
  - none
- attempted_change_patch: `spec-dw-20-destination-picker-enter-key-race.attempt-2026-08-03.patch` (código revertido; a tentativa completa está preservada nesse patch)

## Design Notes

Ordem real do browser (e reproduzida pelo `user-event` v14, `event/behavior/keypress.js`): `keydown` → listeners (aqui o atalho) → ação default → `click` → `onClick` arma o estado → React comita (evento discreto ⇒ flush síncrono). É daí que vem o DW-20: no instante em que o atalho roda, o clique que arma o alvo focado ainda não aconteceu.

Havia duas famílias de correção, e a escolha entre elas é semântica, não técnica:

1. **Ler depois** — adiar o handler com `setTimeout(…, 0)` (um microtask cairia antes do `click`) e relê-lo de um espelho por render. Corrige a leitura obsoleta, mas transforma `Enter` em "arma o focado E confirma": uma tecla passa a gravar em QUALQUER alvo focado, inclusive na opção auto-focada na montagem do `WeeklyDestinationPicker`. **REJEITADA** na resolução de 2026-08-03.
2. **Não ler** — quando um alvo que ativa nativamente está focado, o atalho global simplesmente não roda; a ação do botão é a intenção do usuário. **ESCOLHIDA.**

```ts
// em handleKeyDown, depois dos guards de campo editável e de modificador:
const activatesOnEnter =
  target.tagName === 'BUTTON' ||
  target.tagName === 'SUMMARY' ||
  (target.tagName === 'A' && target.hasAttribute('href'))
if (event.key === 'Enter' && !event.defaultPrevented && activatesOnEnter) return
```

Por que isto encerra a classe inteira, e não só a linha do ledger: com o atalho calado enquanto um botão tem foco, deixam de existir a confirmação DUPLA no próprio botão nomeado (clique nativo + atalho), a confirmação disparada junto com a troca de aba ou com os passos `‹`/`›`, e a confirmação do alvo anterior quando o foco está no "0 Sem dia" `aria-disabled`. O `Enter` em cada botão faz exatamente o que aquele botão faz.

O preço é uma tecla a mais para quem chega numa opção por `Tab` (`Enter` arma, `Tab` + `Enter` confirma no botão nomeado) — e ZERO tecla a mais no fluxo de atalho, porque o dígito entrega o foco ao botão nomeado. É por isso que o desvio de foco vai para o botão, e não para o radio armado: focar o radio faria o `Enter` seguinte apenas re-armá-lo, sem nunca confirmar. O texto "Atalhos: 1–7 escolhem o dia · 0 deixa sem data · Enter confirma" (`WeeklyDestinationPicker:91`) segue literal nesse caminho e não precisa mudar.

`INPUT[type=submit|button]` não precisa de tratamento: o guard de campo editável já barra qualquer `INPUT` antes. `Space` fica de fora de propósito (clique nativo no `keyup`; nenhum consumidor registra `Space`) — armar por `Space` numa opção focada continua funcionando, e é o atalho de teclado nativo do radio.

## Verification

**Commands:**
- `cd frontend && npm run test:run -- src/shared/hooks/useKeyboardShortcuts.test.ts src/features/braindump/components/BrainDumpDestinationPicker.test.tsx src/features/bujo/components/DestinationPicker.test.tsx src/features/bujo/components/weekly/WeeklyDestinationPicker.test.tsx src/features/bujo/components/monthly/MonthlyDestinationPicker.test.tsx src/pages/planner/WeeklyPlanningPage.test.tsx` — expected: tudo verde, incluindo os testes novos de regressão.
- `cd frontend && npm run test:run` — expected: suíte completa verde (gate cross-app: o hook é compartilhado).
- `cd frontend && npm run lint && npm run typecheck` — expected: zero erro.
- `cd frontend && CI=1 npx playwright test e2e/brain-dump-inbox.spec.ts e2e/weekly-planning-ritual.spec.ts e2e/migration-ritual.spec.ts` — expected: verde (prova em browser real da ordem keydown→click e das duas anatomias).

## Auto Run Result

Status: blocked
Blocking condition: intent gap

### O que foi implementado (revertido — preservado em `spec-dw-20-destination-picker-enter-key-race.attempt-2026-08-03.patch`)

Adiamento do atalho `Enter` em `useKeyboardShortcuts` quando o alvo focado ativa nativamente (`BUTTON`/`SUMMARY`/`A[href]`), com releitura do handler num espelho por-render e cancelamento dos timers no desmonte; sincronia foco↔seleção nos atalhos de dígito de `DestinationPicker` e `WeeklyDestinationPicker`; 15 testes novos (hook, 3 pickers) + 1 e2e em browser real.

Arquivos tocados (todos revertidos):
- `frontend/src/shared/hooks/useKeyboardShortcuts.ts` — desvio de `Enter` para o macrotask pós-clique + espelho de handlers.
- `frontend/src/features/bujo/components/DestinationPicker.tsx` / `weekly/WeeklyDestinationPicker.tsx` — foco segue a seleção por dígito.
- 4 arquivos de teste + `frontend/e2e/brain-dump-inbox.spec.ts` — regressões DW-20 e pares anti-regressão.

### Achado que bloqueou (high, intent gap)

Com a semântica que esta spec fixou ("o `Enter` num alvo focado arma o que está focado e confirma" — Approach + linha 1 da I/O Matrix, dentro do `<intent-contract>`), um `Enter` solto logo depois de abrir o `WeeklyDestinationPicker` — que auto-foca a 1ª opção na montagem (AC da Story 14.5, Task 9) — passa a MIGRAR a tarefa para segunda-feira com NADA armado e sem o botão de confirmação nomeado ter aparecido. Provado por sonda própria: o mesmo teste passa no baseline `69ebc01` (`onConfirm` não é chamado) e falha com a mudança (`onConfirm` chamado com `2026-07-20`); um revisor reproduziu em browser real (`POST /api/bujo/tasks/<id>/migrate/ {"destination":"week","scheduledDate":"…"}` → 200). Agravante: o seletor é aberto pressionando `Enter` em "Escolher destino…", então key-repeat cai no radio recém-focado.

A escolha semântica não é decidível pelo intent do DW-20: ele oferece as DUAS mecânicas ("defer to the native click for role=radio/gridcell" = só armar; "read committed state on the next tick" = armar e confirmar) e não seleciona entre elas, enquanto o invariante já documentado em `frontend/src/features/braindump/components/BrainDumpDestinationPicker.tsx:17-19` ("a pré-seleção só marca o radio; confirmar continua sendo um ato explícito do usuário") puxa para a opção de só armar. As duas levam a resultados observavelmente diferentes num ato destrutivo (gravação com um toque vs. um toque a mais).

### Perguntas em aberto — RESOLVIDAS em 2026-08-03 (ver `Spec Change Log`)

Registro histórico do bloqueio; a spec acima já é a única leitura válida. Respostas:

1. Apenas ARMAR (opção **b**): o atalho global de `Enter` não roda com um alvo nativamente ativável em foco.
2. Sim, com um refinamento que elimina o custo no fluxo de atalho: o dígito move o foco para o botão nomeado, então "Enter confirma" segue valendo em UMA tecla depois de `1`-`7`/`0`. A tecla extra só existe para quem chega numa opção por `Tab`.
3. Não se aplica — a opção (a) foi rejeitada, e o auto-foco da 1ª opção (AC da Story 14.5) permanece intocado.

### Itens para a re-derivação (seriam patch; moot com o código revertido)

Pós-resolução de 2026-08-03: os itens de teste e o do oráculo de data já foram absorvidos por `Tasks & Acceptance`; os dois `low` e o item do timer morreram com a semântica rejeitada (não existe mais adiamento, ref de handlers nem comentário de conformidade ARIA a escrever).

- ~~`medium` Re-checar `event.defaultPrevented` DENTRO do timer: um listener de `keydown` registrado depois pode cancelar o clique nativo após a decisão de adiar — o handler roda igual e volta a ler estado pré-clique.~~ MOOT: sem timer, a checagem de `defaultPrevented` acontece no próprio `keydown`.
- `medium` Oráculo de data do e2e novo vem do relógio LOCAL do browser, enquanto a semana renderizada vem do servidor (`TIME_ZONE = "UTC"`): em fuso negativo, domingo à noite, a asserção erra por 7 dias. Derivar a data do próprio DOM/API.
- `medium` Lacunas de teste: nenhuma cobertura de `role="gridcell"` (grade do mês — a AC nº 1 desta spec), nenhum teste do alvo `0`/"Sem dia" com a sincronia de foco (apagar o `ref` mantinha tudo verde), nenhuma cobertura da faixa compact/Drawer (AC nº 2), e nenhuma prova em browser real dos DOIS componentes efetivamente modificados (a e2e nova exercita o M11, que não mudou).
- `low` `handlersRef.current = handlers` escrito no corpo do render (impuro em render descartado); `useEffect` resolve.
- `low` Comentário novo afirma conformidade ARIA de radiogroup que não foi construída (sem roving tabindex / navegação por setas).

### Itens pré-existentes observados (não causados por esta mudança — para o ledger, pelo orquestrador)

- `medium` `npm run typecheck` falha em `frontend/src/features/braindump/components/BrainDumpDestinationPicker.tsx:113` (TS2345: `''` no enum gerado `TargetLogEnum` não é atribuível) — reproduzido idêntico no baseline `69ebc01`; quebra `npm run build`.
- `medium` 8 testes unitários vermelhos no baseline (`TaskDestinationDialog` ×5, `TaskDetailPanel`, `FuturePage` — dependentes da data corrente — e `recurring/noLiteralTokens`): conjunto idêntico com e sem a mudança (8 falhas / 1911 passes no baseline vs. 8 / 1925 com a mudança).
- `medium` `.github/workflows/ci.yml` não roda vitest nem Playwright no job de frontend (só tsc + eslint + build): toda a proteção de regressão é local.
- `medium` `WeeklyDestinationPicker`: o alvo "0 Sem dia" com `aria-disabled` (semana-alvo ≠ corrente) segue focável e clicável enquanto `selectTarget` retorna cedo — o `Enter` ali confirma o dia armado antes (classe do DW-20, idêntica no baseline).
- `medium` `Enter` com foco no botão de confirmação chama `onConfirm` DUAS vezes (clique nativo + atalho) e nem `MigrationRitualPage` nem `WeeklyPlanningPage` guardam por `isPending` ⇒ dois `POST /migrate/` da mesma task (pré-existente em espécie: a ordem muda, a contagem não).
- `medium` `DestinationPicker`: `Enter` com foco numa aba ou nos passos ‹/› de dia confirma junto com a ação do botão (pré-existente em espécie).
- `medium` Key-repeat de `Enter` confirma mais de uma vez (falha também no baseline).

### Verificação executada antes do bloqueio

- `npm run test:run` (alvos): 6 arquivos / 98 testes verdes; depois 33 verdes nos 2 arquivos com o teste adicional do "×".
- `npm run test:run` (suíte completa): 8 falhas / 1925 passes — conjunto de falhas idêntico ao baseline (provado em worktree em `69ebc01`).
- `npm run lint`: limpo. `npm run typecheck`: 1 erro pré-existente (acima).
- `CI=1 npx playwright test e2e/brain-dump-inbox.spec.ts e2e/weekly-planning-ritual.spec.ts e2e/migration-ritual.spec.ts`: 25 passes / 5 falhas — as 5 são violações de contraste do axe em botões de texto MUI da própria página (o seletor nem é montado nesses testes), sem relação com o diff.
- Não-vacuidade provada por mutação temporária no cancelamento de timers (2 testes falham) e pela sonda de regressão comparada ao baseline.

### Riscos residuais

Nenhum no repositório: o código foi revertido e a árvore versionada está limpa em `69ebc01`. O DW-20 continua ABERTO e reproduzível. A tentativa completa (incluindo os 16 testes) está no patch salvo e pode ser reaproveitada assim que a pergunta 1 for respondida.
