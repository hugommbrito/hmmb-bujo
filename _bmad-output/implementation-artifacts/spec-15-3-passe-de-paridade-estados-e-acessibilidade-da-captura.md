---
title: 'Passe de paridade, estados e acessibilidade da captura'
type: 'chore'
created: '2026-07-30'
status: 'done'
baseline_revision: '68b75d1a61c427129b744feb16172b369d607fab'
final_revision: '481245ccb8ac7f04d7887f81760e95abde17200e'
review_loop_iteration: 0
followup_review_recommended: true
context: [
  '{project-root}/_bmad-output/implementation-artifacts/epic-15-context.md',
  '{project-root}/_bmad-output/implementation-artifacts/13-shell-parity-checklist.md',
  '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md',
  '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md',
]
warnings: ['oversized']
deferred:
  - summary: >-
      BrainDumpItemSheet.tsx e BrainDumpDestinationPicker.tsx não implementam
      aria-busy durante ações em voo (Mover/Descartar/Salvar edição) — só
      BrainDumpCaptureSheet.tsx tem esse contrato.
    evidence: |-
      Confirmado via grep: `aria-busy` só existe em
      `BrainDumpCaptureSheet.tsx`. Gap pré-existente da Story 15.1 (quando
      BrainDumpItemSheet.tsx e BrainDumpDestinationPicker.tsx foram criados),
      exposto incidentalmente pela review desta story (15.3) ao tentar
      verificar a checklist BD-ST-06. Não é regressão desta story nem
      corrigido aqui — corrigir mudaria comportamento de componentes fora do
      Code Map desta story (passe de fechamento, sem mudança de
      comportamento).
    location: 'frontend/src/features/braindump/components/BrainDumpItemSheet.tsx; frontend/src/features/braindump/components/BrainDumpDestinationPicker.tsx'
    severity: medium
  - summary: >-
      MonthDensityCalendar (célula do dia, modo interativo) usa `minHeight:
      40` literal no ButtonBase, abaixo de --ds-touch-target-min (44px) —
      afeta o seletor de destino do Brain Dump (Este Mês/Futuro) e qualquer
      outro uso do componente compartilhado.
    evidence: |-
      `MonthDensityCalendar.tsx:163-169`: `ButtonBase` com `sx={{ minHeight:
      40, ... }}`; `sizingTransform` de `@mui/system/sizing/sizing.js`
      repassa números >1 direto como px (`40` → `min-height: 40px`), sem
      passar por `--ds-touch-target-min` (44px) como todo irmão de
      `BrainDumpDestinationPicker.tsx` (CONTROL_SX, "Sem dia definido",
      input de mês). Achado ao expandir a matriz de touch-target desta
      story para cobrir os sub-controles do seletor de destino revelados
      por Este Mês/Futuro (`brain-dump-a11y.spec.ts::seletor de destino —
      Este Mês revela o calendário`). `MonthDensityCalendar.tsx` não está
      no Code Map desta story — é componente compartilhado (Story
      11.3/11.6), e alterá-lo afeta outras superfícies fora do escopo de
      fechamento. Não corrigido aqui.
    location: 'frontend/src/features/bujo/components/MonthDensityCalendar.tsx:163-177'
    severity: medium
  - summary: >-
      No sheet de edição compact, os botões "Mover para um log"/"Descartar
      item" só ficam disabled via o disabled genérico (!isOnline) — nunca
      durante a própria mutação em voo, diferente do botão trailing da linha
      (ponteiro) e do confirmar do seletor de destino.
    evidence: |-
      `BrainDumpInboxPage.tsx:231` passa `disabled={!isOnline}` para
      `BrainDumpItemSheet`, o mesmo prop que governa Fechar/Salvar — não há
      um segundo prop ligado a `discardItem.isPending`/`processItem.isPending`
      como existe no botão trailing da linha (`discarding=
      {discardItem.isPending && discardItem.variables?.itemId === item.id}`,
      `BrainDumpInboxPage.tsx:208`) ou no confirmar do seletor de destino
      (`disabled={disabled || processItem.isPending}`,
      `BrainDumpDestinationPicker.tsx:388`). Achado ao tentar espelhar o
      teste "Descartar em voo" (wide) para a variante compact
      (`brain-dump-a11y.spec.ts`, 4ª rodada de review) — a asserção
      equivalente falharia porque o botão do sheet realmente não desabilita
      durante a própria pendência, só durante offline. Risco: duplo-clique
      rápido nesses 2 botões especificamente no compact pode disparar 2ª
      requisição. `BrainDumpItemSheet.tsx` não está no Code Map desta story
      (só leitura) — corrigir mudaria comportamento de um componente que a
      spec não autoriza tocar. Não corrigido aqui.
    location: 'frontend/src/features/braindump/components/BrainDumpItemSheet.tsx; frontend/src/pages/braindump/BrainDumpInboxPage.tsx:231'
    severity: medium
---

<intent-contract>

## Intent

**Problem:** As Stories 15.1/15.2 entregaram Brain Dump (inbox+processamento) e Capture Sheet no sistema novo, mas o gate de fechamento da Onda 4 nunca rodou: zero cobertura axe-core real (browser) sobre o conteúdo do Brain Dump/Capture Sheet (só jsdom, já documentado como não confiável para contraste/layout); zero verificação de touch target/teclado em browser real para essas superfícies; o seletor `LEGACY_CAPTURE_SURFACE` ainda exclui o Capture Sheet do axe do shell com uma justificativa (baixo contraste do `theme.ts` legado) que a própria 15.2 invalidou ao migrar o componente para tokens; e nem `scheduled_date` (divergência de paridade vs. legado) nem o status da rota legada foram registrados formalmente em nenhum artefato.

**Approach:** Passe de fechamento (sem mudança de comportamento), no molde da Story 13.4/`13-shell-parity-checklist.md`: (1) reavaliar e resolver `LEGACY_CAPTURE_SURFACE`; (2) criar uma matriz axe-core + teclado + touch-target dedicada ao Brain Dump/Capture Sheet em wide/medium/compact; (3) produzir `15-brain-dump-parity-checklist.md` documentando estados/ações equivalentes, as divergências já conhecidas (das specs 15.1/15.2) e as duas novas (`scheduled_date`, rota legada), e o mecanismo de rollback por superfície já existente.

## Boundaries & Constraints

**Always:**
- Reusar helpers existentes sem duplicar: `expectNoAxeViolations`/`WCAG_2_2_AA_TAGS` (`frontend/e2e/axeHelper.ts`), `dsToken`/`dsTokenPx`/`captureSheet`/`waitForDialogSettled`/`waitForSheetSettled` (`frontend/e2e/shellHelpers.ts`), `seedBrainDumpItems` (`frontend/e2e/seedBrainDumpItems.ts`).
- Toda célula axe nova usa as tags `WCAG_2_2_AA_TAGS`, sem `disableRules`, sem `test.skip`/`test.fixme` e sem `exclude` novo não justificado — célula que reprovar é corrigida (se trivial) ou vira divergência registrada no checklist novo com motivo e evidência.
- `scheduled_date`: já implementado e correto (backend sempre aceitou; UI nova o exercita para week/month/future desde a 15.1) — aqui é só **documentação** da divergência contra o legado (ganho, não regressão), sem tocar em `views.py`/`services.py`/`serializers.py`.
- Rollback por superfície: o mecanismo já existe (`shellRouting.ts:75`, trocar `shell: 'new'` → `'legacy'` na entrada `brain-dump`) e já está documentado em `13-shell-parity-checklist.md` §Rollback — o checklist novo só precisa referenciar esse mecanismo para a superfície Brain Dump/Captura, sem criar um novo.
- Rota legada: confirmar com evidência (não assumir) que `BrainDumpPage`/`BrainDumpItemRow` legado/`ProcessItemDialog` estão fora de uso ativo — `router.tsx:176-184` (comentário + JSX) e a suíte `brain-dump.spec.ts`/`brain-dump-inbox.spec.ts` já passando contra o DOM novo são a evidência; registrar isso no checklist, não reescrever esses arquivos legados.

**Block If:**
- Se remover a exclusão `LEGACY_CAPTURE_SURFACE` revelar uma violação axe real (não jsdom) cuja correção exigiria mudança de comportamento/UX já aceita em review anterior (ex.: o dark mode fixo em `'light'`, já `deferred` na 15.2) — não decidir unilateralmente a correção: manter a exclusão com motivo atualizado e registrar a violação como divergência nomeada no checklist novo, referenciando o item `deferred` já existente.

**Never:**
- Implementar `prefers-reduced-motion` — fora de escopo (waiver consciente do Épico 13, não reaberto aqui).
- Deletar fisicamente `BrainDumpPage.tsx`, `BrainDumpItemRow.tsx` (legado) ou `ProcessItemDialog.tsx` (e seus testes) — remoção física é do Épico 18, mesmo padrão de `FuturePage`/`RecurringPage`.
- Criar feature flag, toggle de UI ou segundo mecanismo de rollback — rejeitado desde a Story 13.0; o de `shellRouting.ts` é o único.
- Alterar contrato de API/backend do Brain Dump.

## I/O & Edge-Case Matrix

| Estado/Superfície | Cenário | Resultado esperado | Onde fica a evidência |
|---|---|---|---|
| loading/empty/error (Inbox) | `/brain-dump` com `page.route` segurando/derrubando `GET items/` | chrome+captura seguem disponíveis; já provado em jsdom | `15-brain-dump-parity-checklist.md` referencia `BrainDumpInboxPage.test.tsx` + nova célula axe real por estado |
| offline (Inbox + Capture Sheet) | `context.setOffline(true)` com sheet fechado e aberto | ações desabilitadas com motivo acessível, navegação intacta | célula axe `offline` na matriz nova |
| disabled (ações em voo) | criar/mover/descartar pendente | botão indisponível + `aria-busy`, sem duplo submit | célula de teclado/`aria-busy` na matriz nova |
| touch target | linha (Mover/Descartar), Capture Sheet (Fechar/Salvar/Cancelar), sheet de edição, seletor de destino | todos ≥44px via `--ds-touch-target-min` | assert `dsTokenPx` na matriz nova |

</intent-contract>

## Code Map

- `frontend/e2e/shell-a11y.spec.ts:67,148,283` -- renomear `LEGACY_CAPTURE_SURFACE` (ex.: `CAPTURE_SHEET_SURFACE`) e remover o `exclude` correspondente nas 2 células (`wide · /today · Capture Sheet aberto`, `compact 390 · /today · Capture Sheet aberto pelo FAB`), já que `BrainDumpCaptureSheet.tsx` usa só tokens `--ds-*` desde a 15.2 (o motivo original — contraste do `theme.ts` legado — não existe mais); rodar e ver se passa limpo. Se uma violação real aparecer, manter a exclusão com comentário atualizado (motivo atual, não o histórico) e registrar no checklist novo -- fecha o item `deferred[medium]` da 15.2 ("justificativa inválida sem remoção coordenada").
- `frontend/e2e/shell-a11y.spec.ts:34-56` -- comentário de topo que hoje descreve a exclusão como "superfície de captura LEGADA (migra no Épico 15)" -- atualizar para refletir a decisão tomada acima (migrado ou ainda excluído-e-por-quê).
- `frontend/e2e/axeHelper.ts` -- só ler: `expectNoAxeViolations`, `WCAG_2_2_AA_TAGS`; reusar sem alterar assinatura.
- `frontend/e2e/shellHelpers.ts` -- só ler: `dsToken`/`dsTokenPx` (touch target por token, não literal), `captureSheet`, `waitForDialogSettled`/`waitForSheetSettled` (sincronização antes de medir -- mesmo risco de "verde falso" documentado em `shell-a11y.spec.ts`).
- `frontend/e2e/seedBrainDumpItems.ts` -- só ler: popula itens pendentes direto no service, sem custo de round-trips, para o estado "populado" da matriz.
- NOVO `frontend/e2e/brain-dump-a11y.spec.ts` -- matriz axe-core (wide 1440×900 / medium 1280×800 / compact 390×720, mesmos viewports de `shell-a11y.spec.ts`) sobre `/brain-dump` nos estados vazio, populado (`seedBrainDumpItems`), loading (`page.route` segurando `GET items/`), error (`page.route` derrubando `GET items/`) e offline (`context.setOffline(true)`), mais Capture Sheet aberto (Dialog no ponteiro, Drawer no compact -- reusar `captureSheet`/`waitForDialogSettled`/`waitForSheetSettled`), sheet de edição de item aberto e seletor de destino aberto (`BrainDumpDestinationPicker`); mais teclado (ordem de tab Capturar→Pendências→linha→ações; `Escape` fecha overlay e devolve foco -- confirmação em browser real do que já é unit-testado) e touch target ≥44px via `dsTokenPx(page, '--ds-touch-target-min')` nas ações de linha (Mover/Descartar), Capture Sheet (Fechar/Salvar/Cancelar), sheet de edição e opções do seletor de destino -- fecha o gap: hoje zero axe real e zero touch-target sobre este conteúdo.
- `frontend/src/pages/braindump/BrainDumpInboxPage.tsx` -- só ler: já implementa skeleton (loading), `EMPTY_TEXT` (empty), banner+retry (error) e desabilita via `useOnlineStatus` (offline) -- referência dos estados que a matriz nova exercita, sem tocar no componente.
- `frontend/src/features/braindump/components/BrainDumpInboxItemRow.tsx:65-73` -- só ler: ações Mover/Descartar já usam `--ds-touch-target-min` -- referência para o assert.
- `frontend/src/features/braindump/components/BrainDumpCaptureSheet.tsx:136,218,233` -- só ler: Fechar/Salvar/Cancelar já usam `--ds-touch-target-min` -- referência para o assert.
- `frontend/src/app/layout/shell/shellRouting.ts:10-14,75` -- só ler: comentário documenta o mecanismo de rollback (`shell: 'new'→'legacy'`), procedimento completo em `13-shell-parity-checklist.md` §Rollback; entrada `brain-dump` já `surfaceMigrated: true`.
- `frontend/src/app/router.tsx:176-184` -- só ler: comentário + JSX confirmam que `BrainDumpPage` legada está desmontada da rota (`element: <BrainDumpInboxPage />`), remoção física reservada ao Épico 18.
- `frontend/e2e/brain-dump.spec.ts` (linhas 12-19) e `frontend/e2e/brain-dump-inbox.spec.ts` -- só ler: já passam contra o DOM da página nova (evidência de que a legada não está em uso ativo).
- `backend/braindump/views.py:94`, `backend/braindump/services.py:52,68,79`, `frontend/src/features/braindump/components/BrainDumpDestinationPicker.tsx:20-23,196` -- só ler: `scheduled_date` já aceito pela API e já exercitado pela UI nova para week/month/future -- fonte da divergência a documentar (ganho sobre o legado, que nunca o exercia).
- NOVO `_bmad-output/implementation-artifacts/15-brain-dump-parity-checklist.md` -- artefato de fechamento da Onda 4, no molde de `13-shell-parity-checklist.md`: tabela de estados (loading/empty/error/offline/disabled) e ações (capturar/mover/descartar/editar) do Inbox+Capture Sheet com evidência `arquivo::teste`; seção "Divergências contratadas" cruzando (por referência, sem duplicar texto) os itens `deferred` das specs `spec-15-1-brain-dump-no-sistema-novo-inbox-e-processamento.md`/`spec-15-2-capture-sheet-e-captura-persistente-no-sistema-novo.md`, mais a divergência nova de `scheduled_date`; seção "Rollback por superfície" apontando para `shellRouting.ts`/`13-shell-parity-checklist.md`; seção "Rota legada" com a evidência de uso-não-ativo.

## Tasks & Acceptance

**Execution:**
- `frontend/e2e/shell-a11y.spec.ts` -- renomear `LEGACY_CAPTURE_SURFACE`, reavaliar/remover a exclusão do Capture Sheet nas 2 células, atualizar o comentário de topo -- fecha o item `deferred[medium]` da 15.2.
- `frontend/e2e/brain-dump-a11y.spec.ts` (NOVO) -- matriz axe/teclado/touch-target descrita no Code Map -- fecha a I/O Matrix.
- `_bmad-output/implementation-artifacts/15-brain-dump-parity-checklist.md` (NOVO) -- checklist de paridade/estados/rollback/rota-legada/`scheduled_date` descrito no Code Map -- fecha o registro formal exigido pela AC da story.

**Acceptance Criteria:**
- Given a matriz de estados (loading/empty/error/offline/disabled) do Inbox e do Capture Sheet, when o passe roda, then cada estado tem evidência nomeada de equivalência com o legado (ou divergência registrada) em `15-brain-dump-parity-checklist.md`.
- Given wide/medium/compact, when `expectNoAxeViolations` roda sobre `/brain-dump` (vazio, populado, offline) e sobre o Capture Sheet/sheet de edição/seletor de destino abertos, then zero violação WCAG 2.2 AA sem `disableRules`/`test.skip`/exclusão nova não justificada.
- Given os controles interativos do Inbox e do Capture Sheet, when medidos via `dsTokenPx(page, '--ds-touch-target-min')`, then todos atingem 44px.
- Given `LEGACY_CAPTURE_SURFACE`, when reavaliado, then a exclusão é removida (se o axe passar limpo) ou mantida com motivo ATUAL registrado (não mais o motivo histórico do `theme.ts` legado).
- Given o estado da rota `/brain-dump`, when auditado, then o checklist novo registra, com evidência de código e de teste, que a superfície legada (`BrainDumpPage`/`BrainDumpItemRow`/`ProcessItemDialog`) está fora de uso ativo e que sua remoção física é do Épico 18.
- Given o mecanismo de rollback do shell, when o checklist novo é escrito, then ele referencia (não duplica) o procedimento já documentado em `shellRouting.ts`/`13-shell-parity-checklist.md` para a rota `brain-dump`.

## Spec Change Log

## Review Triage Log

### 2026-07-30 — Review pass (2ª rodada, pós-`done`)
- intent_gap: 0
- bad_spec: 0
- patch: 9 (high 0, medium 7, low 2)
- defer: 1 (high 0, medium 1, low 0)
- reject: 5
- addressed_findings:
  - `[medium]` `[patch]` As 3 células de offline (wide/medium/compact) checavam só o botão "Capturar" com o Título vazio — a mesma asserção passaria mesmo se `disabled={!isOnline}` fosse removido, porque o guard de título vazio (`!title.trim()`) já deixa o botão desabilitado sozinho. Corrigido: Título preenchido ANTES de `context.setOffline(true)` nas 3 células, isolando o efeito do offline; wide/medium também passaram a assere o botão "Mover" da LINHA desabilitado (achado adicional: só a ação de Capturar era checada, nunca a ação de escrita da linha).
  - `[medium]` `[patch]` As células de offline em `medium`/`compact` nunca semeavam um item antes de ficar offline — a afirmação da checklist "leitura já carregada permanece" (BD-ST-05) só era exercida de fato em `wide`. Corrigido: `seedBrainDumpItems` + assert de visibilidade pós-offline adicionados às duas células, espelhando `wide`.
  - `[medium]` `[patch]` O teste "Disabled em voo" (`aria-busy`/desabilitado durante o Salvar do Capture Sheet) só cobria a variante Dialog (wide/ponteiro) — a variante Drawer (compact/FAB), que usa o MESMO atributo `aria-busy` incondicional no componente, nunca tinha sido exercida em browser real. Corrigido: novo describe `Disabled em voo (compact)` espelhando o teste existente.
  - `[medium]` `[patch]` A célula "Capture Sheet aberto, depois offline" (I/O Matrix: sheet aberto ANTES de ficar offline) só existia em `wide` — a variante Drawer (compact) nunca foi testada indo offline com o sheet já montado. Corrigido: célula equivalente adicionada ao describe `compact 390×720`.
  - `[medium]` `[patch]` A matriz axe em `medium 1280×800` cobria `Capture Sheet`/`sheet de edição`/`seletor de destino` (fechado na rodada anterior) mas nunca teve células de `loading`/`error` — únicas faixas sem essa cobertura (`wide`/`compact` já tinham). Corrigido: 2 células novas (`loading`, `error`) adicionadas a `medium`, espelhando `wide`/`compact`.
  - `[medium]` `[patch]` A ordem de Tab (BD-AC-08) só era verificada em `wide` — a faixa compact (sem `trailingSlot` na linha, Design Notes 15.1) nunca teve sua sequência de Tab confirmada em browser real, apesar de ser estruturalmente diferente (a linha é a única parada, sem Mover/Descartar separados). Corrigido: teste equivalente adicionado ao describe `Teclado (compact)`.
  - `[medium]` `[patch]` No touch-target do seletor de destino, só `wide` clicava em "Esta Semana" para revelar e medir o radiogroup de dia — a célula `compact` media só as 4 opções top-level e o Fechar, nunca o sub-controle revelado. Corrigido: mesmo clique/medição adicionados à célula `compact`.
  - `[low]` `[patch]` As 3 células "populado" (wide/medium/compact) semeavam 3 itens mas só asseriam o item 1 visível antes do scan axe — uma regressão que truncasse a lista para 1 item passaria despercebida enquanto a checklist (BD-ST-04) afirma cobertura de "uma linha por item". Corrigido: asserções para "Item semeado 2"/"Item semeado 3" adicionadas às 3 células.
  - `[low]` `[patch]` O teste de ordem de Tab usava `.first()` nos locators de Título/Descrição, suprimindo o check de duplicata do modo estrito do Playwright sem necessidade real (os dois campos já são únicos no DOM quando o Capture Sheet está fechado — MUI desmonta o Dialog/Drawer com `open={false}`). Corrigido: `.first()` removido nos dois locators, deixando o teste falhar alto se um campo duplicado algum dia vazar para o DOM.
  - `[medium]` `[defer]` Ao expandir a matriz de touch-target para os sub-controles do seletor de destino revelados por "Este Mês"/"Futuro" (`MonthDensityCalendar`, "Sem dia definido" — nunca montados/medidos antes desta rodada), a célula do dia do calendário mostrou `minHeight: 40` literal no `ButtonBase` do componente (`MonthDensityCalendar.tsx:163-177`), abaixo de `--ds-touch-target-min` (44px); confirmado via leitura do `sizingTransform` de `@mui/system` (números >1 passam direto como px, sem token). Não corrigido nesta story: componente compartilhado (Story 11.3/11.6) fora do Code Map, e alterá-lo afeta outras superfícies fora do escopo de fechamento. Registrado como novo item em `deferred` (frontmatter) e como `DIV-BD-19` em `15-brain-dump-parity-checklist.md`. Célula axe nova para "Este Mês revela o calendário" e teste de touch-target para "Sem dia definido" (que passa) foram adicionados normalmente — só a medição da célula do dia foi omitida propositalmente.
- Rejeitados (5, todos ruído, decisão já justificada ou fora de escopo pela própria intenção): a suposição de transição instantânea em `openDestinationPicker` (compact) — assunção sobre a ausência de animação do `BrainDumpItemSheet` (fecha por desmontagem, não por `open` alternando), já documentada em comentário no próprio helper, sem cenário de falha concreto hoje; ausência de justificativa explícita para a faixa `compact 320×720` não aparecer na matriz nova — decisão de escopo já tomada e rejeitada na rodada anterior (a Approach do próprio Intent desta spec autoriza explicitamente "wide/medium/compact", diferente das 5 faixas do gate do shell); a falta de `aria-busy` em `BrainDumpItemSheet.tsx`/`BrainDumpDestinationPicker.tsx` (Mover/Descartar/Salvar-edição) — já coberta pelo item `deferred` existente (DIV-BD-18), registrado na rodada anterior; a nota sobre o `Block If` de `LEGACY_CAPTURE_SURFACE` e o dark mode fixo em `'light'` — auto-resolvida (o componente nunca renderiza em dark de fato, então não há risco vivo a testar); CI (`ci.yml`) não rodar Playwright como gate automático — mesma causa-raiz já registrada em `DIV-BD-06` (CI só roda `tsc`/`eslint`/`vite build`, sem test runner nenhum como gate), não uma lacuna nova e distinta.
  - `[medium]` `[patch]` A matriz axe em `medium 1280×800` só cobria vazio/populado/offline, sem células para Capture Sheet/sheet de edição/seletor de destino — a AC2 desta própria spec exige as três faixas × todos os overlays. Corrigido: 3 células novas adicionadas em `medium`, espelhando `wide`/`compact`.
  - `[medium]` `[patch]` O seletor de destino nunca era exercitado além do estado padrão ("Hoje") em nenhuma célula de axe/touch-target — os sub-controles reais (radiogroup de dia da semana, `MonthDensityCalendar`, input de mês) nunca eram montados nem medidos. Corrigido: pelo menos uma célula de touch-target e uma de axe agora selecionam "Esta Semana"/"Futuro" antes de medir/analisar.
  - `[medium]` `[patch]` A checklist (BD-ST-06) afirmava cobertura uniforme de `aria-busy`/sem-duplo-submit para Capturar/Mover/Descartar/Salvar, mas só Capturar (Capture Sheet) tinha teste e só esse componente implementa `aria-busy`. Corrigido: texto da checklist ajustado para refletir com precisão o que é testado; a ausência de `aria-busy` em `BrainDumpItemSheet.tsx`/`BrainDumpDestinationPicker.tsx` foi registrada como item `deferred` (pré-existente da 15.1, não desta story).
  - `[medium]` `[patch]` BD-AC-04 ("nunca empilham") era citado na checklist com evidência de teste que não afirmava isso de fato — `openDestinationPicker` nunca checava que o dialog "Item do Brain Dump" tinha desaparecido ao abrir o seletor. Corrigido: assert adicionado confirmando `toHaveCount(0)` do dialog do sheet de edição no caminho compact.
  - `[medium]` `[patch]` A suíte "Teclado" só testava a faixa wide (Dialog) — a variante compact (Drawer) nunca teve Escape/restauração de foco verificados em browser real. Corrigido: testes de teclado equivalentes adicionados para compact.
  - `[low]` `[patch]` BD-AC-05 citava um teste e2e como prova de "Descartar a partir do sheet", mas esse teste só cobre descartar pela linha — o clique em "Descartar item" dentro do sheet nunca é exercitado em e2e (só em jsdom mockado). Corrigido: texto da checklist ajustado para não superestimar a evidência.
  - `[low]` `[patch]` As três células de offline (wide/medium/compact) nunca semeavam itens antes de ficar offline, então a afirmação "leitura já carregada permanece" nunca era demonstrada de fato. Corrigido: `seedBrainDumpItems` adicionado à célula de offline em wide, com assert de que o item continua visível.
  - `[low]` `[patch]` `boundingBox()` pode retornar `null` e as asserções de touch-target acessavam `.height` direto (`box!.height`), produzindo um `TypeError` opaco em vez de uma falha de assert clara caso o elemento não esteja visível. Corrigido: checagem explícita (`expect(box).not.toBeNull()`) antes de cada leitura.
  - `[medium]` `[defer]` `BrainDumpItemSheet.tsx`/`BrainDumpDestinationPicker.tsx` não implementam `aria-busy` durante Mover/Descartar/Salvar em voo (só `BrainDumpCaptureSheet.tsx` tem) — gap pré-existente da Story 15.1, exposto por esta review, registrado em `deferred` para atenção futura, não implementado nesta story (mudança de comportamento fora do escopo de fechamento).
- Rejeitados (7, todos ruído ou decisão já justificada): compact 320×720 ausente da matriz nova (fora de escopo — a AC desta story pede só wide/medium/compact, diferente das 5 faixas do gate do shell); duplicação de helpers locais (`openCaptureSheet`, paper do Drawer) em vez de generalizar `shellHelpers.ts` (escolha de engenharia defensável — os helpers compartilhados são escopados a outras superfícies); dependência encadeada do seletor de destino compact via o sheet de edição (já documentada em comentário no próprio código, não é lacuna silenciosa); `LEGACY_CAPTURE_SURFACE` ter sido deletada em vez de renomeada (o Code Map usava "ex.:" — sugestão, não requisito; a AC de remover a exclusão foi cumprida); recheck de offline-com-overlay-já-aberto feito só para o Capture Sheet, não para os outros 2 overlays (mesmo mecanismo `useOnlineStatus` compartilhado, redundante testar 3×); comentário de cabeçalho não justificar a ausência de `exclude` nas células novas (óbvio pelo contexto — é a primeira cobertura real deste conteúdo); `13-shell-a11y-legacy-inventory.md` (achado LEG-03) sem ponteiro de volta para o fechamento — arquivo fora do Code Map desta story, decisão já justificada no checklist novo.

### 2026-07-30 — Review pass (4ª rodada, pós-`done`)
- intent_gap: 0
- bad_spec: 0
- patch: 5 (high 0, medium 4, low 1)
- defer: 1 (high 0, medium 1, low 0)
- reject: 11
- addressed_findings:
  - `[medium]` `[patch]` A faixa `medium` nunca teve describe próprio de touch-target — o Approach da spec pede a matriz dedicada em wide/medium/compact, mas só wide/compact tinham cobertura. Corrigido: novo describe `Touch target — medium 1280×800 (ponteiro)` com os mesmos 6 testes de wide (linha, Capture Sheet, sheet de edição, seletor de destino + dia revelado, "Sem dia definido", input de Mês).
  - `[medium]` `[patch]` As faixas `medium`/`compact` da matriz axe nunca escaneavam os sub-controles do seletor de destino revelados por "Esta Semana"/"Este Mês" — só `wide` tinha essas 2 células dedicadas. Corrigido: 2 células novas (`…dia revelado`, `…calendário revelado`) adicionadas a `medium` e a `compact`, espelhando `wide`.
  - `[medium]` `[patch]` A faixa `medium` da matriz axe nunca cobria o cenário "Capture Sheet aberto, depois offline" (I/O Matrix "sheet aberto") — só `wide`/`compact` tinham essa célula. Corrigido: célula equivalente adicionada a `medium`.
  - `[medium]` `[patch]` "Disabled em voo" (BD-ST-06/I-O Matrix: "criar/mover/descartar pendente") só tinha cobertura browser-real para "criar" (Capture Sheet → Salvar) — "mover" (confirmar do seletor de destino, `disabled={disabled || processItem.isPending}`) e "descartar" (ação trailing da linha, `discarding={discardItem.isPending...}`) já computam `disabled` em produção, mas isso nunca fora verificado em browser real. Corrigido: 2 testes novos em `wide` (mover via seletor de destino, descartar via linha) + 1 em `compact` (mover via sheet). Ao tentar espelhar "descartar" para o compact, a review encontrou um gap de produção distinto (o sheet de edição compact não liga Mover/Descartar ao `isPending` da própria mutação) — registrado como `deferred` (ver linha `defer` abaixo), não implementado como teste (a asserção falharia).
  - `[low]` `[patch]` O input nativo de "Futuro" (`aria-label="Mês"`) era o único sub-controle do seletor de destino ainda sem medição de touch-target, em qualquer faixa. Corrigido: teste novo em `wide`, `medium` e `compact`.
  - `[medium]` `[defer]` No sheet de edição compact, os botões "Mover para um log"/"Descartar item" só ficam `disabled` via o `disabled` genérico (`!isOnline`), nunca durante a própria mutação em voo — diferente do botão trailing da linha (ponteiro) e do confirmar do seletor de destino, que já ligam `disabled` ao `isPending` da mutação própria. Risco: duplo-clique rápido nesses 2 botões no compact pode disparar 2ª requisição. Achado ao tentar espelhar o teste "Descartar em voo" (wide) para compact; não corrigido (`BrainDumpItemSheet.tsx` fora do Code Map desta story, só leitura); registrado em `deferred` (frontmatter) e como `DIV-BD-20` em `15-brain-dump-parity-checklist.md`.
- Rejeitados (11, todos ruído, decisão já justificada por autoridade do próprio Intent, ou estado transitório da execução deste workflow):
  - Touch-target medir só altura (`box!.height`), nunca largura, nos botões Mover/Descartar da linha (`minWidth: 0` explícito em produção) — o token `--ds-touch-target-min` só é aplicado como `minHeight` em produção em toda a superfície (nunca `minWidth`); medir largura testaria uma garantia que o próprio design system não oferece para botões de texto, e o padrão de medir só altura via token é o mesmo já usado em `shell-bottomnav.spec.ts:379-382`.
  - Estrutura/contagens do `## Review Triage Log` de rodadas anteriores (2ª/3ª) parecerem combinadas sob um único cabeçalho datado — registro histórico já commitado por rodadas anteriores; reescrever entradas já fechadas contraria a diretriz explícita desta invocação de só acrescentar entradas novas ao registro, nunca reabrir/reescrever as existentes.
  - Frase "39→46" no checklist (Verificação, 3ª rodada) poder ser lida como se toda a enumeração fosse nova — nit de prosa cosmético em conteúdo já commitado por rodada anterior, decifrável pelo contexto ("39→46" já explicita o delta), sem consequência funcional.
  - Duplicação de corpo de teste quase idêntico entre wide/medium/compact em vez de parametrizar por viewport — mesmo padrão já estabelecido em `shell-a11y.spec.ts` (describes separados por faixa, não loop parametrizado); refatorar introduziria risco de regressão maior que o benefício, fora do escopo de um passe de fechamento.
  - `sprint-status.yaml` marcar a story como `done` enquanto o frontmatter desta spec está `in-review` — estado transitório desta própria execução (o Finalize deste workflow volta o `status` para `done` ao final, sem intervenção necessária aqui).
  - `DIV-BD-18`/`DIV-BD-19` não terem epic/story de follow-up atribuído, diferente de outros itens fora de escopo (rota legada → Épico 18) — decisão de rodadas anteriores já commitadas, não desta rodada; atribuir um épico/story a um item ainda não triado organizacionalmente não é algo que o Intent desta story autoriza ou pede.
  - `13-shell-a11y-legacy-inventory.md` (achado `LEG-03`) sem ponteiro de volta para o fechamento (re-levantado nesta rodada) — o Approach da spec (autoridade do próprio Intent) lista exatamente 3 entregáveis (`LEGACY_CAPTURE_SURFACE`, a matriz nova, o checklist novo); editar um 4º arquivo que o Intent nunca menciona é expansão de escopo que este passe de fechamento não pede.
  - Comentário de `router.tsx:176-184` dizer "`planner/brain-dump`" quando a rota real é `path: 'brain-dump'` — typo pré-existente, sem consequência funcional (é só um comentário), em arquivo fora do Code Map (só leitura); a citação verbatim no checklist novo (seção G) reproduz apenas o trecho a partir de "`BrainDumpPage` legada…", que É preciso — o typo não se propaga para o artefato de fechamento.
  - CI (`ci.yml`) não rodar Playwright como gate automático — mesma causa-raiz já registrada em `DIV-BD-06`, não um achado novo e distinto.
  - Nota de auditoria de alinhamento de intenção sobre o frontmatter desta spec estar temporariamente `in-review` com o `## Auto Run Result` da rodada anterior removido, divergindo do `sprint-status.yaml` (`done`) — mesmo estado transitório já coberto acima (o `status: in-review` é justamente o passo padrão deste workflow ao reabrir uma spec `done` para revisão; resolve-se no Finalize).
  - Observações de auditoria de alinhamento de intenção sobre `MonthDensityCalendar`/`aria-busy` em Mover-Descartar/`BD-AC-05` só-jsdom — confirmações independentes de itens JÁ registrados (`DIV-BD-19`, `DIV-BD-18`, nota da checklist §B), não achados novos.

## Design Notes

**Por que não reabrir os itens `deferred` de 15.1/15.2 nesta story:** a AC pede "equivalentes ou com divergência registrada" — as divergências já têm `summary`/`location`/`severity` registrados nos frontmatters de 15.1/15.2; o trabalho desta story é **cruzar essas referências** no checklist novo (fechamento formal do gate), não reabrir/corrigir cada uma. A exceção deliberada é `LEGACY_CAPTURE_SURFACE`, porque a própria 15.2 já sinalizou que ela especificamente precisa de uma "passada coordenada" — é isso que esta story executa.

## Verification

**Commands:**
- `cd frontend && npx tsc --noEmit && npx eslint .` -- expected: sem erro de tipo/lint.
- `cd frontend && CI=1 npx playwright test shell-a11y.spec.ts brain-dump-a11y.spec.ts brain-dump.spec.ts brain-dump-inbox.spec.ts` -- expected: todos verdes, incluindo as células novas sem `exclude`/`skip` não justificado.

**Manual checks (if no CLI):**
- Abrir `/brain-dump` em wide/medium/compact, abrir o Capture Sheet e o sheet de edição, conferir visualmente que nenhum controle fica menor que 44px e que o foco é sempre visível.

## Auto Run Result

**Resumo:** Quarta rodada de review sobre a spec (já `done`, reaberta como `in-review` para mais uma passada de fechamento). Nenhuma mudança de intent/spec — todas as correções foram testes/documentação, dentro do Code Map já existente. 5 patches aplicados (faixa `medium` sem describe de touch-target; `medium`/`compact` sem os sub-controles revelados do seletor de destino na matriz axe; `medium` sem o cenário "Capture Sheet aberto, depois offline"; "disabled em voo" só cobria "criar", nunca "mover"/"descartar"; input de "Futuro" nunca medido para touch-target) e 1 item novo deferido (`DIV-BD-20`: sheet de edição compact não desabilita Mover/Descartar durante a própria mutação em voo — só durante offline).

**Arquivos alterados:**
- `frontend/e2e/brain-dump-a11y.spec.ts` — 16 testes novos: describe `Touch target — medium 1280×800 (ponteiro)` inteiro (6 testes); 2 testes de revelação do seletor de destino (Esta Semana/Este Mês) em `medium` + 2 em `compact`; 1 teste `Capture Sheet aberto, depois offline` em `medium`; 1 teste de touch-target do input "Futuro" em `wide` + 1 em `compact`; 2 testes de "em voo" em `wide` (confirmar "Hoje" no seletor de destino; Descartar da linha) + 1 em `compact` (confirmar "Hoje" via sheet) — 46→62 testes, todos verdes.
- `_bmad-output/implementation-artifacts/15-brain-dump-parity-checklist.md` — seção A (BD-ST-06 reescrita para separar o contrato `disabled` do `aria-busy` e referenciar `DIV-BD-20`), seção C (linha `medium` e sub-controle "Futuro" adicionados à tabela, nota sobre altura-vs-largura), seção D (contagens `medium`/`compact` 8/9→11/11, total 28→33), tabela de divergências (`DIV-BD-20` novo), verificação (5ª entrada, 95 passed).
- `_bmad-output/implementation-artifacts/spec-15-3-passe-de-paridade-estados-e-acessibilidade-da-captura.md` — `deferred` (novo item `DIV-BD-20`), `## Review Triage Log` (nova entrada desta rodada), este `## Auto Run Result`.

**Findings desta rodada:**
- **Patch (5 — high 0, medium 4, low 1):** faixa `medium` sem describe próprio de touch-target (Approach da spec pede wide/medium/compact); `medium`/`compact` sem os 2 sub-controles revelados do seletor de destino na matriz axe (só `wide` tinha); `medium` sem a célula "Capture Sheet aberto, depois offline"; "disabled em voo" só verificava "criar" em browser real, nunca "mover"/"descartar" (o `disabled` já existe em produção para os três, só faltava a verificação); input de "Futuro" nunca medido para touch-target em nenhuma faixa.
- **Defer (1 — medium):** sheet de edição compact (`BrainDumpItemSheet.tsx`) não liga Mover/Descartar ao `isPending` da própria mutação — só ao `disabled` genérico de offline —, diferente da linha (ponteiro) e do confirmar do seletor de destino; achado ao tentar espelhar "descartar em voo" para o compact; fora do Code Map (só leitura), registrado como `DIV-BD-20`.
- **Reject (11):** touch-target medir só altura (convention estabelecida, token só governa `minHeight` em produção); estrutura de rodadas anteriores do Review Triage Log (registro histórico, não reescrito por diretriz desta invocação); frase "39→46" do checklist (cosmético, já commitado); duplicação de corpo de teste entre viewports (mesmo padrão de `shell-a11y.spec.ts`); `sprint-status.yaml` vs. `status: in-review` (estado transitório deste workflow); `DIV-BD-18`/`DIV-BD-19` sem epic de follow-up (fora do que o Intent pede); ponteiro de volta em `13-shell-a11y-legacy-inventory.md` (fora dos 3 entregáveis do Approach); typo "planner/brain-dump" em comentário do `router.tsx` (pré-existente, não se propaga ao checklist); CI sem Playwright como gate (mesma causa-raiz de `DIV-BD-06`); nota de auditoria sobre `in-review`/`Auto Run Result` removido (estado transitório, resolvido no Finalize); confirmações de itens já deferidos (`DIV-BD-19`/`DIV-BD-18`/`BD-AC-05`) sem achado novo.

**Follow-up review recommendation:** `true`. Contagem desta rodada (só `patch`): high 0, medium 4, low 1 → score `3×4 + 1×1 = 13` (≥5).

**Verificação:**
- `cd frontend && npx tsc --noEmit` — limpo.
- `cd frontend && npx eslint e2e/brain-dump-a11y.spec.ts` — limpo.
- `cd frontend && CI=1 npx playwright test brain-dump-a11y.spec.ts` — 62 passed.
- `cd frontend && CI=1 npx playwright test shell-a11y.spec.ts brain-dump-a11y.spec.ts brain-dump.spec.ts brain-dump-inbox.spec.ts` — 95 passed (17 + 62 + 13 + 3).
- `cd frontend && CI=1 npx playwright test brain-dump-a11y.spec.ts -g "em voo" --repeat-each 5` — 25/25 (5 testes × 5 repetições), zero flaky — as células mais sensíveis a timing (`page.route` + `setTimeout`) desta rodada.

**Riscos residuais:**
- `DIV-BD-19` (touch-target do `MonthDensityCalendar`) e `DIV-BD-20` (disabled em voo ausente no sheet compact) permanecem sem correção — ambos fora do Code Map desta story (componentes compartilhados/só-leitura).
- A suíte Playwright ainda não é gate automático de CI (mesma causa-raiz de `DIV-BD-06`, rejeitado nesta rodada por não ser um achado novo).

