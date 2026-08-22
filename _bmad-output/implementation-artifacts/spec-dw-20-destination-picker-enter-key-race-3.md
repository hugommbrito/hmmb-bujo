---
title: 'DW-20 (3ª derivação) — Enter local nos dois seletores de destino vivos'
type: 'bugfix'
created: '2026-08-06'
status: 'in-review'
baseline_revision: '555859b2b6f50abea558289995dd2fb45f666f53'
review_loop_iteration: 1
followup_review_recommended: false
context: []
warnings: [oversized]
deferred:
  - summary: >-
      MigrationRitualPage congela `pickerMonthFirst` no clique: se
      `useMonthlyLogQuery` ainda não resolveu, o seletor de destino NUNCA abre.
    evidence: |-
      `handleOpenDestinationPicker` (MigrationRitualPage.tsx:268-272) faz
      `setPickerMonthFirst(currentMonthLog.data?.monthFirst ?? null)` e a
      montagem depende de `destinationItemId && pickerMonthFirst` (:406). Com a
      query pendente o valor fica `null` PERMANENTEMENTE para aquele clique —
      nenhum re-render o corrige. É a causa do flake de
      `e2e/migration-flow.spec.ts:159`, que falha na 1ª tentativa em 100% das
      execuções medidas (9 runs), tanto na baseline `555859b` quanto com a
      mudança. Mesma classe de "clico em Escolher destino… e nada acontece" que
      DW-30 fechou por outro caminho.
    location: >-
      frontend/src/pages/MigrationRitualPage.tsx:268-272
    severity: medium
  - summary: >-
      `useKeyboardShortcuts` fica sem nenhum consumidor de produção depois desta
      mudança, mantendo o footgun do guard que não isenta BUTTON.
    evidence: |-
      Depois de removê-lo dos dois seletores, `grep -rn useKeyboardShortcuts
      frontend/src` só encontra o próprio hook, o seu teste e comentários em
      prosa. ShellLayout/AppLayout/MigrationFlow/DailyPage têm cópias INLINE de
      `window.addEventListener('keydown', …)` e nunca importaram o hook (a
      premissa contrária no intent do bundle é falsa). O módulo segue verde no
      CI provando código que ninguém usa, e o próximo consumidor reintroduz
      DW-20. O intent proíbe alterá-lo, então a decisão (aposentar, apagar ou
      anotar o hazard) fica para uma passagem própria.
    location: >-
      frontend/src/shared/hooks/useKeyboardShortcuts.ts
    severity: medium
  - summary: >-
      DestinationPicker mantém o dia armado ao trocar de aba, então o Enter pode
      confirmar um alvo da aba que não está visível.
    evidence: |-
      `setTab` (DestinationPicker.tsx:214-218) não reseta `armed`. Armar um dia
      da semana, ir para "Dia no mês" e confirmar grava o dia da SEMANA, com a
      grade do mês na tela. Pré-existente: antes desta mudança o atalho de
      `window` produzia a mesma confirmação obsoleta a partir de qualquer foco
      não-editável. Corrigir exige decidir se trocar de aba descarta a seleção —
      mudança de comportamento fora do escopo deste bundle.
    location: >-
      frontend/src/features/bujo/components/DestinationPicker.tsx:214-218
    severity: medium
  - summary: >-
      Os radiogroups de destino (4 opções) não têm navegação por seta nem
      tabindex roving em nenhuma das duas superfícies.
    evidence: |-
      `BrainDumpDestinationPicker.tsx:244-274` declara `role="radiogroup"` com 4
      radios, cada um um tab stop próprio e sem handler de seta — o contrato
      ARIA de radiogroup promete seta. O molde `DestinationDialog.tsx:557-561`
      tem a MESMA lacuna, documentada como deliberada ("sem navegação por seta —
      o grupo de DIAS abaixo é que a tem"). Pré-existente e comum às três
      superfícies: fechar aqui só criaria assimetria com o molde.
    location: >-
      frontend/src/features/braindump/components/BrainDumpDestinationPicker.tsx:244
    severity: low
  - summary: >-
      Nenhum dos radiogroups de dia declara `aria-orientation`, e um deles é
      vertical (o default de ARIA é horizontal).
    evidence: |-
      O grupo "Dia da semana" de `DestinationPicker.tsx:222` usa
      `flexDirection: 'column'` (vertical) sem `aria-orientation="vertical"`; o
      do Brain Dump é grade de 7 colunas, também sem declaração. Verificado
      `aria-orientation === null` nos dois. O molde `DestinationDialog` tem a
      mesma omissão. Pré-existente à mudança do Enter.
    location: >-
      frontend/src/features/bujo/components/DestinationPicker.tsx:222
    severity: low
  - summary: >-
      A grade de dias do mês de DestinationPicker põe os 28-31 `gridcell` num
      único `role="row"` e oferece um tab stop por célula.
    evidence: |-
      `DestinationPicker.tsx:331-359`: `role="grid"` com um `role="row"` só
      (`display: contents`) envolvendo todos os dias, sem tabindex roving e sem
      navegação por seta. Um mês de 5 semanas é anunciado como uma linha de 31
      células. Estrutura pré-existente; o molde resolveu por outro caminho
      (`MonthDensityCalendar`, um `<table>` real), cuja adoção aqui é migração
      de anatomia, não correção do Enter.
    location: >-
      frontend/src/features/bujo/components/DestinationPicker.tsx:331
    severity: low
  - summary: >-
      A anatomia de teclado do seletor de destino existe agora em 4 cópias
      verbatim, sem extração, e já divergiu entre elas.
    evidence: |-
      `handleContainerKeyDown`/`stopEnterFromDialog`/`armWeekday`/`WEEK_LENGTH`
      vivem em `DestinationDialog.tsx`, `monthly/MonthlyDestinationPicker.tsx` e
      nos dois alvos deste bundle, mais duas cópias do helper `pressEnter` nos
      testes. O guard de `disabled` e o de campo editável existem em algumas
      cópias e não em outras. Extrair pede tocar o molde, que o intent proíbe.
    location: >-
      frontend/src/features/bujo/components/DestinationDialog.tsx:448
    severity: low
---

<intent-contract>

## Intent

**Problem:** `BrainDumpDestinationPicker.tsx:211-214` e `DestinationPicker.tsx:173-184` registram `useKeyboardShortcuts({ Enter: confirm, … })` em `window`; o guard do hook (`useKeyboardShortcuts.ts:29-31`) isenta só INPUT/TEXTAREA/contentEditable — nunca BUTTON —, então com um `<button role="radio">` focado o handler de `window` lê o estado ANTES do clique nativo que a mesma tecla dispara como ação default, e confirma o destino/dia armado ANTERIORMENTE. No mesmo caminho, com o botão de confirmação focado, o `Enter` dispara o atalho E a ativação nativa: DUAS gravações da mesma tarefa.

**Approach:** Portar a anatomia de teclado do irmão provado em produção `DestinationDialog.tsx` para as duas superfícies: `Enter`/`Escape`/dígitos tratados no `onKeyDown` do PRÓPRIO container (`handleContainerKeyDown`, `DestinationDialog.tsx:448-481`) e `stopEnterFromDialog` (`:485-487`) pendurado em todo controle que É a própria ação, para o evento dele nunca subir. Onde o molde deixa o `Enter` subir (as opções de DIA), portar junto a peça que mantém foco e armado em SINCRONIA — `tabIndex` roving + `handleWeekdayKeyDown` (`:492-507`, `:689`) —, que é o que faz "confirma o armado" ≡ "confirma o focado" no molde.

## Boundaries & Constraints

**Always:**
- Escopo são os DOIS arquivos nomeados no intent + seus testes. `useKeyboardShortcuts` sai desses dois componentes (import inclusive).
- Regra ÚNICA que decide `stopEnterFromDialog` em cada controle: o `Enter` só pode subir até o container a partir de um controle cujo foco esteja PROVADAMENTE em sincronia com o alvo armado. Hoje isso vale para o radiogroup de dias da semana (depois do roving + setas) e para a entrada "Número do dia" (o valor dela É o armado). Todo o resto — radios de destino, abas, opções de "Outro mês", células do calendário/`gridcell`, "Hoje", "Sem dia definido", "Tentar de novo", "Fechar" e o botão de confirmação — recebe `stopEnterFromDialog` e executa APENAS a sua própria ação nativa.
- `handleContainerKeyDown`: `Enter` → `preventDefault()` + `confirm()`; `Escape` → `preventDefault()` + `stopPropagation()` + `onClose()`; dígitos só depois do guard de campo editável (mesmo guard do hook).
- Preservar sem alteração observável: os atalhos `1`–`7` de `DestinationPicker` (armam o dia da semana só quando `tab === 'week'`) e o fechamento por `Escape` — exatamente UM `onClose` por tecla, em qualquer estado.
- `radiogroup` de dias da semana com `tabIndex` roving (um único tab stop) + `ArrowLeft/Right/Up/Down/Home/End` que ARMAM e movem o foco, nos dois componentes.
- Comentários e nomes de teste em pt-BR; tokens `var(--ds-*)`, nunca literais.

**Block If:**
- Algum controle de confirmação deixar de ser alcançável por teclado depois da mudança (o botão nomeado tem de continuar sendo o caminho explícito de gravação).

**Never:**
- Não alterar `frontend/src/shared/hooks/useKeyboardShortcuts.ts` (outras superfícies dependem do guard atual), nem `DestinationDialog.tsx`, nem `MonthDensityCalendar.tsx`, nem `MonthlyDestinationPicker.tsx`.
- Não implementar "o `Enter` ARMA o focado E confirma" (rejeitada por decisão humana em 2026-08-03, com reprodução em browser): aqui o `Enter` nunca arma nada — quem arma é clique, seta ou dígito.
- Não introduzir foco inicial automático dentro do diálogo: sem ele o `Enter` na montagem morre no `div.MuiDialog-container` (ancestral do container), e nenhuma gravação de UMA tecla passa a existir.
- Não mexer no comportamento de `MigrationRitualPage`/`BrainDumpInboxPage` (só os componentes mudam).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Corrida do ledger (dias da semana) | Dia X armado; `ArrowRight` leva o foco ao dia Y; `Enter` | A seta ARMA Y ao mover o foco; o `Enter` confirma **Y**, uma única vez | Sem erro |
| Corrida do ledger (radio de destino, Brain Dump) | "Esta Semana" armado com dia; foco vai para o radio "Hoje"; `Enter` | O `Enter` apenas SELECIONA "Hoje" (ativação nativa) — nada é gravado | Sem POST |
| Botão de confirmação focado | Alvo armado; `Enter` | EXATAMENTE um `confirm()` (hoje são dois) | Sem erro |
| `Enter` na montagem (Brain Dump, `targetLog='today'`) | Picker recém-aberto, foco onde o MUI o põe (`div.MuiDialog-container`) | Nada é gravado — o evento não chega ao container | Sem POST |
| Dígito `3` na aba "Esta semana" (M10) | `tab === 'week'` | Arma quarta e move o foco para ela; `Enter` seguinte confirma quarta | Sem erro |
| Dígito digitado na entrada "Número do dia" (M10) | Foco no `input[type=number]` | O dígito NÃO é atalho (guard de editável); `Enter` ali confirma o dia digitado | Sem erro |
| `Escape` | Qualquer estado, de dentro do diálogo | Exatamente um `onClose` | Sem erro |
| Célula do calendário / `gridcell` focada | Dia X armado; foco na célula Y; `Enter` | O `Enter` ARMA Y (ativação nativa), não confirma X | Sem escrita |

</intent-contract>

## Code Map

- `frontend/src/features/braindump/components/BrainDumpDestinationPicker.tsx` — alvo 1 (M11, montado por `BrainDumpInboxPage.tsx:240`). Remover `useKeyboardShortcuts` (:33 import, :211-214 uso). Container = `Box` de :223 (recebe `onKeyDown`). Radios de DESTINO :251-274 (`stopEnterFromDialog`). Radiogroup de DIAS :300-328 (roving + setas; único grupo que deixa o `Enter` subir). `MonthDensityCalendar` :332-337 e :368-373 → embrulhar em `Box onKeyDown={stopEnterFromDialog}`. "Tentar de novo" :293, "Sem dia definido" :379-388, botão de confirmação :392-405, "Fechar" :234-240 → `stopEnterFromDialog`. `confirm()` :194-209; `isConfirmable()` :168-174 (é `true` na montagem quando `destination === 'today'`, pré-armado de `item.targetLog` em :119).
- `frontend/src/features/bujo/components/DestinationPicker.tsx` — alvo 2 (M10; ÚNICO call site é `MigrationRitualPage.tsx:407` — `WeeklyPlanningPage`/`MonthlyPlanningPage` já usam `DestinationDialog`). Remover `useKeyboardShortcuts` (:43 import, :173-184 uso) e mover Enter/Escape/dígitos `1`–`7` para o container = `Box` de :206. Radiogroup da semana :222-251 (roving + setas). Abas `role="tab"` (`DestinationTab` :484-506), `role="option"` de "Outro mês" :262-284, `‹`/`›` :292-300/:321-329, `role="grid"` :331-359 (embrulho), "Hoje" :364-384, "Sem dia definido" :385-404, confirmar :406-424 → `stopEnterFromDialog`. Entrada "Número do dia" :301-320 deixa o `Enter` subir (é o molde: `DestinationDialog.tsx:445-447`). `armed` inicia `null` (:106) e `confirm()` (:166-171) retorna cedo sem seleção.
- `frontend/src/features/bujo/components/DestinationDialog.tsx` — **somente leitura**, o molde. `handleContainerKeyDown` :448-481; `stopEnterFromDialog` :485-487; `handleWeekdayKeyDown` :492-507; `armWeekday` :382-387 (arma E foca, via `dayOptionRefs` :339); `tabIndex` roving :677/:689; racional de teclado :426-447 e :24-30 (cita DW-20 nominalmente); `stopEnterFromDialog` nos radios de DESTINO :596 com o comentário que descreve a classe exata do DW-20 (:588-595).
- `frontend/src/features/bujo/components/DestinationDialog.test.tsx` — **molde dos testes**. Helper `pressEnter` :63-65 (dispara o `keydown` e, só se ninguém cancelou, o `click` — reproduz o browser de verdade; **é indispensável**, `fireEvent.keyDown` sozinho não prova nada). Casos a espelhar: :116 (confirmação única), :144 ("confirma o dia que ACABOU de ser armado, não um anterior"), :167 (nada armado → não confirma), :173 (Escape uma vez), :180 (× fecha, não confirma), :190 (setas de dia andam sem confirmar), :388-399 (setas do radiogroup), :785 ("o Enter num radio de DESTINO não confirma o destino anterior").
- `frontend/src/features/bujo/components/DestinationPicker.test.tsx` — os 3 casos que disparam em `window` PRECISAM migrar para dentro do diálogo: :130 (`tecla 3 … e Enter confirma`), :140 (`Escape fecha o seletor`). Os casos de portal/Escape do Modal (:62, :77) continuam válidos sem alteração; o comentário :56-61 ("o Enter deste seletor segue sendo escopo BLOQUEADO de DW-20") fica obsoleto e deve ser atualizado.
- `frontend/src/features/braindump/components/BrainDumpDestinationPicker.test.tsx` — :226 (`Escape` em `window`) migra para dentro do diálogo. `ITEM.targetLog = 'week'` (:33): o caso de montagem com `'today'` precisa de um item próprio.
- `frontend/src/shared/hooks/useKeyboardShortcuts.ts:24-40` — causa raiz compartilhada, **somente leitura**.
- E2E existentes que passam por estas superfícies (não devem quebrar; nenhum navega por `Tab` dentro dos seletores): `e2e/migration-ritual.spec.ts:74,97`, `e2e/migration-flow.spec.ts:159`, `e2e/brain-dump-inbox.spec.ts:53`, `e2e/brain-dump-a11y.spec.ts` (usa `page.keyboard.press('Escape')` com o foco dentro do diálogo — servido pelo `Modal` do MUI).
- `frontend/src/features/bujo/components/migration/noLiteralTokens.test.ts:15,32` — varre `DestinationPicker.tsx?raw` por literais de cor; nada novo pode introduzir literal.

## Tasks & Acceptance

**Execution:**
- `frontend/src/features/bujo/components/DestinationPicker.tsx` -- remover `useKeyboardShortcuts`; adicionar `handleContainerKeyDown` no `Box` de :206 (Enter/Escape/dígitos `1`–`7` com guard de editável), `stopEnterFromDialog` local, `dayOptionRefs` + `handleWeekdayKeyDown` + `tabIndex` roving no radiogroup da semana, e `stopEnterFromDialog` em todos os controles listados no Code Map -- fecha a corrida e a gravação dupla preservando abas, dígitos e Escape.
- `frontend/src/features/braindump/components/BrainDumpDestinationPicker.tsx` -- mesma anatomia (sem dígitos: a superfície não tem atalho numérico), incluindo o embrulho `stopEnterFromDialog` nos dois `MonthDensityCalendar` -- fecha a corrida no seletor do Brain Dump sem criar gravação de uma tecla na montagem.
- `frontend/src/features/bujo/components/DestinationPicker.test.tsx` -- portar o helper `pressEnter` do molde; migrar os casos que disparavam em `window`; cobrir a Matrix (corrida com seta, confirmação única, Enter em aba/`gridcell`/"Hoje"/"Sem dia definido" não confirma, dígito + Enter, Enter na entrada do dia, Escape único) -- o teste da corrida é o entregável central do intent.
- `frontend/src/features/braindump/components/BrainDumpDestinationPicker.test.tsx` -- idem para a superfície do Brain Dump, incluindo o caso `targetLog='today'` + `Enter` na montagem sem POST -- pina que o fix não abre escrita de uma tecla.

**Acceptance Criteria:**
- Dado o seletor aberto com um dia armado, quando o foco vai para outra opção do radiogroup de dias por seta e o usuário aperta `Enter`, então a confirmação usa a opção que está FOCADA (a seta armou-a) e ocorre exatamente uma vez.
- Dado o botão nomeado de confirmação focado, quando o usuário aperta `Enter`, então `onConfirm`/`processItem` é chamado EXATAMENTE uma vez.
- Dado o `BrainDumpDestinationPicker` recém-montado para um item com `targetLog='today'`, quando um `Enter` chega sem interação prévia do usuário, então nenhum POST é disparado.
- Dado qualquer estado dos dois seletores, quando o usuário aperta `Escape` de dentro do diálogo, então `onClose` roda exatamente uma vez.
- Dado o radiogroup de dias da semana, quando o usuário navega por `Tab`, então o grupo é um único tab stop e as setas percorrem os 7 dias (contrato ARIA de `radiogroup`).
- Dado `grep` em ambos os arquivos, então não resta nenhuma referência a `useKeyboardShortcuts`.

## Spec Change Log

### 2026-08-06 — 3ª derivação: o "intent gap" das duas anteriores está RESOLVIDO por evidência, não por escolha

As derivações 1 e 2 pararam em `intent gap` sobre "o `Enter` confirma o ARMADO ou o FOCADO?". Três fatos verificados nesta passagem dissolvem a pergunta:

1. **O molde tem DUAS classes de radio, com contratos de `Enter` diferentes** — e a 2ª derivação tratou-as como uma só. Radios de DESTINO param o `Enter` (`DestinationDialog.tsx:596`, com o comentário :588-595 nomeando o DW-20) e o `Enter` neles seleciona o FOCADO; opções de DIA deixam subir e confirmam o ARMADO, mas lá armado ≡ focado por causa do roving + setas (:677-689, :492-507). Portar a anatomia COMPLETA (inclusive essa peça) satisfaz as duas cláusulas do intent ao mesmo tempo.
2. **O teste que o intent manda escrever já existe no molde**: `DestinationDialog.test.tsx:144` — "o Enter confirma o dia que ACABOU de ser armado, não um anterior" — e `:785` para o radio de destino. Não há teste a inventar contra o molde; há teste a espelhar.
3. **A premissa do 2º `Block If` era falsa.** Ele afirmava que adotar o molde "cria uma escrita destrutiva de UMA tecla que hoje não existe". Ela existe HOJE, e de forma mais exposta: o listener de `window` confirma um `Enter` vindo de qualquer lugar, e `isConfirmable()` já é `true` na montagem com `targetLog='today'` (`:119` + `:170`). Depois do port, o `Enter` da montagem morre no `div.MuiDialog-container` (ancestral do container — comprovado por `DestinationPicker.test.tsx:81-84`) e NADA é gravado. O port reduz a exposição; não a cria.

Sobre a decisão humana de 2026-08-03 ("apenas ARMAR", via guard no hook compartilhado): o motivo declarado dela era o auto-foco da 1ª opção na montagem do `WeeklyDestinationPicker` — componente **removido em DW-29**, inexistente na árvore. O mandato atual proíbe tocar o hook, e a semântica aqui adotada respeita o `Never` que aquela decisão fixou (o `Enter` nunca ARMA e confirma na mesma tecla: quem arma é clique/seta/dígito).

Divergência DELIBERADA e única em relação ao molde verbatim: as células de calendário/`gridcell` recebem `stopEnterFromDialog`. No molde elas deixam o `Enter` subir, mas lá não há sincronia foco↔armado nessa superfície — deixá-las subir aqui reproduziria exatamente o DW-20. Com o stop, o `Enter` nelas ARMA o dia focado, que é a direção conservadora e coerente com a decisão de 2026-08-03.

## Design Notes

Ordem real do browser: `keydown` → listeners → ação default → `click` → `onClick` arma o estado. O DW-20 nasce aí. Duas saídas existem e o molde usa as duas, por controle:

```
Controle que É a própria ação  → stopEnterFromDialog → só o clique nativo roda (arma/fecha/anda/confirma)
Opção de dia com foco≡armado   → sobe ao container   → preventDefault() + confirm() do que está armado
```

O que torna a 2ª linha segura é o roving + setas: mover o foco no radiogroup ARMA. Sem essa peça — que as derivações anteriores não portaram — "confirma o armado" e "confirma o focado" divergem, e é dessa divergência que o `intent gap` era feito.

Não portar `captureInitialFocus` é decisão explícita: sem foco inicial dentro do conteúdo, o `Enter` da montagem fica num ancestral e não alcança `handleContainerKeyDown`. A ergonomia de foco inicial é um ganho separado, fora deste bundle.

Nos testes, `fireEvent.keyDown` sozinho NÃO prova nada aqui: ele não dispara a ação default. Usar o helper `pressEnter` do molde (`DestinationDialog.test.tsx:63-65`), que só dispara o `click` quando o `keydown` não foi cancelado — é ele que distingue "confirmou uma vez" de "confirmou duas".

## Verification

**Commands:**
- `nvm use 22.15.1 && cd frontend && npx vitest run src/features/bujo/components/DestinationPicker.test.tsx src/features/braindump/components/BrainDumpDestinationPicker.test.tsx src/features/bujo/components/DestinationDialog.test.tsx src/features/bujo/components/migration/noLiteralTokens.test.ts` -- expected: tudo verde, incluindo os casos novos da Matrix
- `cd frontend && npx tsc --noEmit && npx eslint src/features/bujo/components/DestinationPicker.tsx src/features/braindump/components/BrainDumpDestinationPicker.tsx` -- expected: sem erros
- `cd frontend && npx vitest run` -- expected: suíte completa verde (o hook compartilhado tem outros consumidores)
- `cd frontend && CI=1 npx playwright test e2e/migration-ritual.spec.ts e2e/migration-flow.spec.ts e2e/brain-dump-inbox.spec.ts e2e/brain-dump.spec.ts` -- expected: verde (nenhum navega por `Tab` dentro dos seletores)
- `cd frontend && grep -rn "useKeyboardShortcuts" src/features/bujo/components/DestinationPicker.tsx src/features/braindump/components/BrainDumpDestinationPicker.tsx` -- expected: nenhuma saída
