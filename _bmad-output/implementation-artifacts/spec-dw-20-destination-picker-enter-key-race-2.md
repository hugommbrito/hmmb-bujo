---
title: 'DW-20 (2ª derivação) — Enter global nos seletores de destino legados'
type: 'bugfix'
created: '2026-08-05'
status: 'blocked'
baseline_revision: '34c665e621a440e915c65e914fc080767ee6e6a9'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `BrainDumpDestinationPicker.tsx:211-214` e `DestinationPicker.tsx:165-177` registram `useKeyboardShortcuts({ Enter: confirm, Escape: onClose })` em `window`; o guard do hook (`useKeyboardShortcuts.ts:29-33`) só isenta INPUT/TEXTAREA/contentEditable, então com um `<button role="radio">` focado o handler de window lê o estado ANTES do clique nativo que a tecla dispara como ação default — a gravação pode não corresponder ao alvo que o usuário acabou de focar (DW-20).

**Approach:** NÃO RESOLVIDO — o intent do bundle manda duas coisas mutuamente exclusivas nestes dois arquivos (ver `Block If` e a matriz abaixo). A escolha é semântica, incide sobre um caminho de ESCRITA destrutiva, e o repositório carrega DUAS decisões registradas em direções opostas, ambas de 2026-08-03. Bloqueado para decisão humana.

## Boundaries & Constraints

**Always:**
- Não alterar `frontend/src/shared/hooks/useKeyboardShortcuts.ts` (mandato explícito do intent). Os 3 consumidores reais são `DestinationPicker:177`, `WeeklyDestinationPicker:70` e `BrainDumpDestinationPicker:211` — o intent diz "5 consumidores"; a contagem real de call sites é 3 (as outras 2 cópias citadas no cabeçalho do hook são inline em `ShellLayout`/`AppLayout` e não passam pelo hook).
- Escopo são os DOIS arquivos nomeados. `WeeklyDestinationPicker.tsx` NÃO está no bundle, mesmo sendo o 3º consumidor do mesmo hook.
- Comentários e nomes de teste em pt-BR.

**Block If:**
- **[DISPARADO]** A semântica do `Enter` com uma opção (`role="radio"`/`role="gridcell"`) focada não é decidível a partir do intent: ele mandata o MOLDE do `DestinationDialog` (que confirma o alvo ARMADO) e, no mesmo parágrafo, um TESTE que exige confirmar o alvo FOCADO. Nos dois arquivos-alvo os dois resultados divergem de fato, porque foco e alvo armado podem divergir (sem tabindex roving, sem navegação por setas — verificado).
- **[DISPARADO]** Adotar o molde verbatim em `BrainDumpDestinationPicker` cria uma escrita destrutiva de UMA tecla que hoje não existe (evidência na matriz, linha "Enter solto na montagem").

**Never:**
- Não implementar a semântica "o `Enter` arma o focado E confirma" sem decisão humana nova: foi REJEITADA em 2026-08-03 com reprodução em browser real (`POST /migrate/` → 200), registrada em `spec-dw-20-destination-picker-enter-key-race.md` (`Spec Change Log`).
- Não reaplicar `spec-dw-20-destination-picker-enter-key-race.attempt-2026-08-03.patch`: implementa exatamente a semântica rejeitada.
- Não mexer em `WeeklyDestinationPicker.tsx` nem no auto-foco da 1ª opção (AC da Story 14.5, pinada em `WeeklyDestinationPicker.test.tsx:147-152`).

## I/O & Edge-Case Matrix

As três leituras defensáveis, com o MESMO input, produzem escritas diferentes. R1 = molde do `DestinationDialog` verbatim. R2 = molde + sincronia foco↔armado (tabindex roving + setas que armam, também portadas do dialog). R3 = decisão humana de 2026-08-03 expressa localmente (o `Enter` não roda quando o alvo focado ativa nativamente).

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Cenário do ledger | Dia X armado; foco (Tab) vai para o dia Y; `Enter` | **R1:** confirma X (o "obsoleto" do ledger — determinístico, casa com `aria-checked` e com o rótulo do botão nomeado). **R2:** confirma Y (mas Y só é alcançável por seta, que já o ARMA). **R3:** arma Y, não grava nada | Sem erro esperado |
| Teste que o intent mandata | idem acima | Passa SÓ em R2. Falha em R1 (confirma X) e em R3 (não confirma) | — |
| `Enter` solto na montagem (Brain Dump) | Item com `targetLog='today'`; picker recém-aberto; nada escolhido pelo usuário; `Enter` (inclusive key-repeat do `Enter` que abriu) | **R1:** GRAVA `POST /process/` movendo para hoje — `destination` já vem pré-armado de `item.targetLog` (:119) e `isConfirmable()` é `true` na montagem quando o destino é `today` (:170). **R2:** idem R1. **R3:** nada é gravado | Escrita indevida |
| `Enter` solto na montagem (M10) | `DestinationPicker` recém-aberto | Seguro nas três: `armed` inicia `null` (:99) e `confirm()` retorna cedo sem seleção (:160-165) | Sem POST |
| Foco no botão nomeado de confirmação | Alvo armado; foco no botão; `Enter` | Uma única gravação nas três leituras (`stopEnterFromDialog` impede o evento de subir; hoje há gravação DUPLA — clique nativo + atalho de window) | Sem erro esperado |
| `Escape` | Qualquer estado | Um único fechamento (`preventDefault` + `stopPropagation`, molde `DestinationDialog:340-347`) | — |

</intent-contract>

## Code Map

- `frontend/src/shared/hooks/useKeyboardShortcuts.ts:24-41` — causa raiz compartilhada, **somente leitura** (mandato do intent). `handleKeyDown` (:27-36) isenta só INPUT/TEXTAREA/contentEditable (:29-31) e modificadores (:32); `BUTTON` nunca é isentado, então o handler roda antes do clique nativo do radio focado.
- `frontend/src/features/braindump/components/BrainDumpDestinationPicker.tsx` — alvo 1 (M11). `useKeyboardShortcuts({ Enter: confirm, Escape: onClose })` em :211-214 (o ledger citava :205-208; deslocou 6 linhas). `confirm()` :194-209; `isConfirmable()` :168-174 — **retorna `true` na montagem quando `destination === 'today'`**; `destination` pré-armado de `item.targetLog` em :119; invariante documentado em :17-19 ("a pré-seleção só marca o radio; confirmar continua sendo um ato explícito do usuário"). `role="radiogroup"` de destinos :244, radios :255; `radiogroup` de dias :300, radios :309. **Nenhum `tabIndex`, nenhum `onKeyDown` local, nenhuma navegação por seta** — cada radio é um tab stop próprio, logo foco e armado divergem. Container = `Box` de :223.
- `frontend/src/features/bujo/components/DestinationPicker.tsx` — alvo 2 (M10, montado por `MigrationRitualPage.tsx:407`). `shortcutHandlers` + `useKeyboardShortcuts` :165-177 (Enter/Escape + dígitos `1`-`7` guardados por `tab === 'week'`). `armed` inicia `null` :99; `currentSelection()` :127-147; `confirm()` :160-165 retorna cedo sem seleção. `role="radiogroup"` :212, radios :218, `role="gridcell"` :331. Mesma ausência de `tabIndex`/setas.
- `frontend/src/features/bujo/components/DestinationDialog.tsx` — o molde que o intent manda copiar; **somente leitura**. Criado em `5191907` (2026-08-03). Racional em :310-331 — cita DW-20 nominalmente e declara a semântica: "As opções de dia … deixam o Enter subir: aqui ele é cancelado … e **confirma o destino ARMADO**" (:325-328). `handleContainerKeyDown` :332-365 (`Enter` → `preventDefault()` + `confirm()`; `Escape` → `preventDefault` + `stopPropagation` + `onClose`; guard de editável :352-353 antes dos dígitos). `stopEnterFromDialog` :369-371, pendurado em :420, :500, :534, :585. **Diferença estrutural que o intent não menciona:** o dialog tem `tabIndex` ROVING nos radios (:466) e `handleWeekdayKeyDown` (:376-391) que ARMA ao mover o foco por seta — por isso foco e armado nunca divergem lá, e "confirma o armado" ≡ "confirma o focado". `armed` inicia da prop `armedDate` (:200).
- `frontend/src/features/bujo/components/monthly/MonthlyDestinationPicker.tsx:114-123` — molde anterior do mesmo padrão (handler local com `preventDefault`), citado por `DestinationDialog:320`; somente leitura.
- `_bmad-output/implementation-artifacts/spec-dw-20-destination-picker-enter-key-race.md` — 1ª derivação, `blocked` em `intent gap` na MESMA pergunta semântica. `Spec Change Log` :100-110 registra a decisão humana de 2026-08-03 (**apenas ARMAR**; gravação continua ato explícito no botão nomeado) e o racional da rejeição. Seu `Code Map` não menciona `DestinationDialog` — foi planejada sem ele à vista.
- `frontend/e2e/brain-dump-inbox.spec.ts:42-65` e `frontend/e2e/weekly-planning-ritual.spec.ts:96-115` — harnesses e2e prontos para as duas anatomias, quando houver o que verificar.

## Tasks & Acceptance

**Execution:** PENDENTE — a decisão do `Block If` determina o diff. Invariante nas três leituras (não implementado nesta passagem, para não fixar por acidente a semântica do `Enter`):
- `frontend/src/features/braindump/components/BrainDumpDestinationPicker.tsx` / `frontend/src/features/bujo/components/DestinationPicker.tsx` — `stopEnterFromDialog` nos botões que SÃO a própria ação (fecha, confirmar, passos de dia), encerrando a gravação DUPLA no botão nomeado; `Escape` com `preventDefault` + `stopPropagation` (um único fechamento).

**Acceptance Criteria:** PENDENTE pela mesma razão. O critério de aceite do bundle ("confirma o FOCADO e não o previamente armado") só é satisfazível sob R2 e contradiz o molde mandatado — é o objeto da pergunta 1 abaixo.

## Spec Change Log

### 2026-08-05 — 2ª derivação aberta e bloqueada sem escrever código

Derivada do bundle `destination-picker-enter-key-race` (run `20260805-190312-f03e`), que mandata o oposto da 1ª derivação: proíbe tocar `useKeyboardShortcuts.ts` e manda adotar o molde local do `DestinationDialog`. A 1ª derivação (`spec-dw-20-...-race.md`, `blocked`) segue como registro histórico da decisão humana de 2026-08-03; a semântica que ela fixou (`apenas ARMAR`, via guard no hook compartilhado) NÃO é implementável sob o novo mandato sem também divergir do molde. Nenhum arquivo de produção foi tocado nesta passagem.

## Design Notes

Ordem real do browser: `keydown` → listeners (o atalho de window) → ação default → `click` → `onClick` arma o estado. O DW-20 nasce aí: no instante do atalho, o clique que armaria o alvo focado ainda não aconteceu.

O molde do `DestinationDialog` mata a corrida por SUPRESSÃO: `preventDefault()` no `Enter` elimina o clique nativo, então não existe mais estado "a caminho" para ser lido cedo — a gravação passa a corresponder sempre ao que está visivelmente armado (`aria-checked` + rótulo do botão nomeado). Isso é defensável e determinístico, mas no cenário literal do ledger o resultado observável continua sendo "grava X enquanto o foco está em Y" — o que o ledger chama de defeito. O dialog só não sofre disso porque fechou a divergência foco↔armado por outro meio (tabindex roving :466 + setas que armam :376-391), peça que o intent não menciona e que os dois pickers-alvo não têm.

Daí as três leituras da matriz. Elas diferem em: o que é gravado no cenário do ledger (X / Y / nada), quantas teclas custam para confirmar, se a semântica do radiogroup muda de 7 tab stops para 1 (R2, mudança visível de a11y e de e2e), e se passa a existir escrita de uma tecla logo após abrir o Brain Dump (R1 e R2 sim, R3 não).

Ainda que o mandato do teste fosse tratado como redação imprecisa e descartado, restaria escolher entre R1, R2 e R3 — nenhuma delas é selecionada pelo intent, e as duas decisões registradas do repositório (a decisão humana de 2026-08-03 e o `DestinationDialog` do mesmo dia, commit `5191907`) apontam para lados opostos. Não é uma escolha que esta sessão possa fazer por conta.

## Verification

Nada a verificar: nenhum código foi alterado. Árvore versionada limpa em `34c665e`, idêntica ao início da sessão.

## Auto Run Result

Status: blocked
Blocking condition: intent gap

### Perguntas para o humano

1. **Com uma opção (`role="radio"`/`role="gridcell"`) focada, o que o `Enter` deve fazer nestes dois seletores?**
   - (a) **R1 — confirmar o alvo ARMADO** (molde do `DestinationDialog` verbatim, `preventDefault()` no container). Diff pequeno, paridade com o irmão novo. Custo: no cenário do ledger grava X com o foco em Y; e no Brain Dump passa a existir gravação de UMA tecla na montagem (item com `targetLog='today'`).
   - (b) **R2 — R1 + portar a sincronia foco↔armado** (tabindex roving + setas que armam, como no dialog). Satisfaz o teste que o bundle mandata e torna a gravação obsoleta impossível. Custo: diff maior, o radiogroup passa de 7 tab stops para 1 (a11y e e2e visíveis), e mantém a gravação de uma tecla na montagem do Brain Dump.
   - (c) **R3 — apenas ARMAR** (a decisão de 2026-08-03, agora local: se o alvo focado ativa nativamente, o handler de `Enter` não roda). Preserva o invariante de `BrainDumpDestinationPicker.tsx:17-19` e não cria escrita de uma tecla. Custo: diverge do molde que o intent mandata e do `DestinationDialog`, e o critério de aceite do bundle não é atingível.
2. **A decisão humana de 2026-08-03 (apenas ARMAR) continua valendo para estes dois arquivos legados, ou foi superseded pelo `DestinationDialog` (`5191907`, mesmo dia), que ships a semântica oposta e documenta DW-20 como resolvido por ela?** As duas são decisões registradas do mesmo dia em direções opostas; nada nos artefatos ordena uma sobre a outra.
3. **Se a resposta a (1) for (a) ou (b): a gravação de uma tecla na montagem do Brain Dump é aceitável, ou o `confirm()` deve exigir um ato explícito do usuário antes (ex.: só habilitar o `Enter` do container depois da primeira interação)?** Hoje `destination` já vem pré-armado de `item.targetLog` (:119) e `isConfirmable()` é `true` na montagem para `today` (:170) — é a mesma classe de risco que motivou a rejeição de 2026-08-03.

### Evidência levantada

- Os dois pickers-alvo não têm `tabIndex` nem navegação por seta nos `role="radiogroup"` (grep em ambos os arquivos): foco e alvo armado divergem, ao contrário do `DestinationDialog` (:466, :376-391). É isso que torna R1 e R2 observavelmente diferentes.
- `DestinationDialog:325-328` declara textualmente "confirma o destino ARMADO" para as opções de dia — o molde mandatado é incompatível com o teste mandatado ("confirma o FOCADO").
- `BrainDumpDestinationPicker:119` + `:170`: destino pré-armado na montagem e confirmável de imediato quando `today` ⇒ sob R1/R2, `Enter` solto (ou key-repeat do `Enter` que abriu o picker) grava `POST /process/`.
- `DestinationPicker:99` + `:160-165`: `armed` inicia `null` e `confirm()` retorna cedo ⇒ o mesmo risco NÃO existe no M10. As duas superfícies do bundle não são simétricas.
- `spec-dw-20-destination-picker-enter-key-race.md:100-110`: decisão humana de 2026-08-03 por "apenas ARMAR", com reprodução em browser real da alternativa rejeitada (`POST /migrate/` → 200).
- `git log`: `DestinationDialog.tsx` criado em `5191907` (2026-08-03), ancestral de `34c665e`.
- O bundle irmão `legacy-destination-picker-dialog-parity`, citado na nota de coordenação do intent, NÃO existe em `.bmad-loop/runs/20260805-190312-f03e/bundles/` (único bundle no run é `destination-picker-enter-key-race`) — não há rebase a coordenar, e a paridade que R2 exigiria não está atribuída a outro bundle neste run.

### Itens pré-existentes observados (para o ledger, pelo orquestrador)

- `medium` Gravação DUPLA no botão nomeado de confirmação nos dois pickers: com o foco nele, o `Enter` dispara o clique nativo E o atalho de window ⇒ dois `POST` da mesma tarefa. Independe da escolha semântica; é o único item que as três leituras corrigem igual.
- `medium` `DestinationPicker`: `Enter` com foco numa aba ou nos passos `‹`/`›` confirma junto com a ação do próprio botão.
- `low` O intent do bundle afirma "5 consumidores" de `useKeyboardShortcuts`; os call sites reais são 3.

### Riscos residuais

Nenhum no repositório: nenhum arquivo de produção ou de teste foi alterado. DW-20 continua ABERTO e reproduzível em `34c665e`.
