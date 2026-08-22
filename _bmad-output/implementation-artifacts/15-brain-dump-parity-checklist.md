# Checklist de paridade do Brain Dump/Captura — Épico 15 (Onda 4)

> Fechamento formal da Onda 4 (Story 15.3), no molde de
> [`13-shell-parity-checklist.md`](./13-shell-parity-checklist.md): estados e
> ações do Inbox + Capture Sheet com evidência nomeada (`arquivo::teste`),
> divergências **contratadas** (não são bugs) cruzadas por referência com os
> `deferred` das specs 15.1/15.2 e desta própria spec 15.3 (sem duplicar
> texto), reavaliação da exclusão
> `LEGACY_CAPTURE_SURFACE`, e o registro do estado da rota legada e do
> mecanismo de rollback.
>
> **Escopo:** Brain Dump Inbox (`/brain-dump`, `BrainDumpInboxPage`) + Capture
> Sheet persistente do shell (`BrainDumpCaptureSheet`) + sheet de edição
> (`BrainDumpItemSheet`) + seletor de destino (`BrainDumpDestinationPicker`).
> Sem mudança de comportamento — passe de fechamento/acessibilidade (spec
> `spec-15-3-passe-de-paridade-estados-e-acessibilidade-da-captura.md`).

## A. Estados do Inbox

| ID | Estado | Comportamento | Origem | Evidência (jsdom) | Evidência (browser real, nova) |
|---|---|---|---|---|---|
| BD-ST-01 | loading | skeleton de 5 linhas (`aria-hidden`); header/Capturar seguem funcionais; heading "Pendências" ainda não existe | `BrainDumpInboxPage.tsx:152-164` | `BrainDumpInboxPage.test.tsx::loading preserva header e captura, com skeleton de 5 linhas` | `brain-dump-a11y.spec.ts::wide · /brain-dump · loading` · `…compact 390 · /brain-dump · loading` |
| BD-ST-02 | vazio | "Brain Dump vazio." — único texto, sem incentivo a conteúdo; captura continua visível | `BrainDumpInboxPage.tsx:39,188` | `BrainDumpInboxPage.test.tsx::vazio mostra "Brain Dump vazio." — único texto, captura continua visível` | `brain-dump-a11y.spec.ts::wide · /brain-dump · vazio` · `…medium · /brain-dump · vazio` · `…compact 390 · /brain-dump · vazio` |
| BD-ST-03 | error (leitura) | banner `role="alert"` + botão "Tentar de novo" (retry), sem bloquear a captura | `BrainDumpInboxPage.tsx:178-186` | `BrainDumpInboxPage.test.tsx::erro de leitura mostra banner + retry, sem bloquear a captura` | `brain-dump-a11y.spec.ts::wide · /brain-dump · error` · `…compact 390 · /brain-dump · error` |
| BD-ST-04 | populado | contagem exata ("N item(ns)") + uma linha por item (Item Row variante Brain Dump) | `BrainDumpInboxPage.tsx:167-176,202-214` | `BrainDumpInboxPage.test.tsx::lista populada mostra a contagem e uma linha por item` | `brain-dump-a11y.spec.ts::wide/medium/compact 390 · /brain-dump · populado` (3 células, `seedBrainDumpItems(email, 3)`, asserindo os 3 itens visíveis — não só o primeiro, achado de review) |
| BD-ST-05 | offline (sheet fechado E aberto — I/O Matrix) | captura e ações de escrita desabilitadas (`disabled` nativo nos campos/botões), motivo acessível junto ao Capturar; leitura já carregada permanece; sheet aberto ANTES de ficar offline também reage (o `disabled`/`disabledReason` do `BrainDumpCaptureSheet` é ligado ao `useOnlineStatus` ao vivo, `ShellLayout.tsx:287-288`) | `BrainDumpInboxPage.tsx:130,150,207` · `useOnlineStatus.ts` · `ShellLayout.tsx:287-288` | — (offline não é reproduzível em jsdom) | `brain-dump-a11y.spec.ts::wide/medium/compact 390 · /brain-dump · offline` (3 células, item semeado ANTES de ficar offline nas 3 faixas — achado de review: medium/compact não semeavam antes, então "leitura já carregada permanece" nunca era provada; Título preenchido ANTES de ficar offline nas 3 faixas — achado de review: sem isto o guard de título vazio confundia a asserção do botão Capturar; wide/medium também asserem o botão "Mover" da LINHA desabilitado, achado de review: só o botão Capturar era checado) · `…wide/compact 390 · /brain-dump · Capture Sheet aberto, depois offline` (sheet aberto, agora nas duas variantes de FocusTrap — achado de review: só o Dialog/wide tinha cobertura) |
| BD-ST-06 | disabled em voo (**criar/mover/descartar — ver DIV-BD-18/DIV-BD-20 p/ o que falta**) | a criação (Capture Sheet → Salvar) mantém o botão indisponível com `aria-busy`/rótulo "Salvando…", sem duplo submit, no Dialog (ponteiro) E no Drawer (compact/FAB); mover (confirmar no seletor de destino) e descartar (ação trailing da linha, ponteiro) ficam `disabled` durante a mutação própria, sem 2ª requisição — verificado em browser real nesta rodada (achado de review: só "criar" tinha essa verificação; `disabled`/`aria-busy` são contratos DISTINTOS — **`BrainDumpItemSheet.tsx` (Salvar/Mover/Descartar) e `BrainDumpDestinationPicker.tsx` (Mover) não implementam `aria-busy`**, só `disabled` comum, ver DIV-BD-18; e o "Descartar item"/"Mover para um log" do sheet de edição compact nem `disabled`-durante-pendência têm, ver DIV-BD-20) | `BrainDumpCaptureSheet.tsx:96-112,124`; `BrainDumpDestinationPicker.tsx:386-388`; `BrainDumpInboxPage.tsx:208` | `BrainDumpCaptureSheet.test.tsx::Enter repetido durante o envio não cria itens duplicados; a região fica aria-busy` · `…durante o envio, o próprio role="dialog" (Paper do MUI Dialog) fica aria-busy` | `brain-dump-a11y.spec.ts::Disabled em voo › Capture Sheet: Salvar em voo fica aria-busy e desabilitado, sem 2ª requisição` (Dialog, wide) · `…Disabled em voo (compact) › Capture Sheet (Drawer, FAB): Salvar em voo fica aria-busy…` (Drawer, compact) · `…Disabled em voo › Seletor de destino: confirmar "Hoje" em voo fica desabilitado…` (wide) · `…Disabled em voo › Linha: Descartar em voo fica desabilitado…` (wide) · `…Disabled em voo (compact) › Seletor de destino (a partir do sheet): confirmar "Hoje" em voo…` (compact — achado de review desta 4ª rodada: só "criar" tinha cobertura; Mover/Descartar-da-linha seguem sem equivalente compact porque o sheet de edição não conecta seus botões ao `isPending` da própria mutação, ver DIV-BD-20) |

## B. Ações e overlays

| ID | Ação/Overlay | Comportamento | Evidência (jsdom) | Evidência (browser real) |
|---|---|---|---|---|
| BD-AC-01 | Capturar (painel Inbox) | otimista sobre a contagem, refoca Título após sucesso | `BrainDumpInboxCaptureForm.test.tsx` | `brain-dump.spec.ts::captura, processa para Hoje e descarta um item…` |
| BD-AC-02 | Editar (linha → sheet) | abre `BrainDumpItemSheet` pré-preenchido; salvar é NÃO-otimista; dirty-check compara contra o valor carregado (nunca "tem texto") | `BrainDumpInboxPage.test.tsx::Editar abre o sheet do item` · `BrainDumpItemSheet.test.tsx` | `brain-dump-inbox.spec.ts::editar título/descrição/destino do item via o sheet — a linha atualiza in-place, sem otimismo (I/O Matrix)` · `…fechar o sheet de edição sem alteração fecha direto; com alteração pede confirmação (dirty-check)` |
| BD-AC-03 | Mover (linha, ponteiro) | abre `BrainDumpDestinationPicker` direto, radiogroup de 4 destinos, pré-seleciona `target_log` | `BrainDumpInboxPage.test.tsx::Mover (linha) abre o seletor de destino direto` | `brain-dump-inbox.spec.ts::mover para Esta Semana com um dia escolhido cria a Task com scheduled_date (delta do M11 vs. o legado)` |
| BD-AC-04 | Mover a partir do sheet (compact) | fecha o sheet de edição e abre o picker no MESMO gesto — nunca empilham | `BrainDumpInboxPage.test.tsx::Mover a partir do sheet fecha o sheet e abre o seletor — nunca empilham` | `brain-dump-a11y.spec.ts::openDestinationPicker` (helper compartilhado pelas células compact de destino) — o branch `compact` agora **assere explicitamente** `getByRole('dialog', { name: 'Item do Brain Dump' })` com `toHaveCount(0)` logo após abrir o picker (achado de review: antes só se provava que o picker aparecia, nunca que o sheet realmente sumia) |
| BD-AC-05 | Descartar (linha ou sheet) | executa DIRETO, sem dialog, sem desfazer (paridade deliberada com o legado); guard contra duplo-clique via `discarding` | `BrainDumpInboxPage.test.tsx::Descartar (linha) chama a mutation direto, sem dialog intermediário` · `…Descartar a partir do sheet fecha o sheet e chama a mutation direto` | Descartar **pela linha**: `brain-dump.spec.ts::captura, processa para Hoje e descarta um item…` (browser real). Descartar **pelo sheet** ("Descartar item", compact): **só jsdom** — `BrainDumpInboxPage.test.tsx::Descartar a partir do sheet fecha o sheet e chama a mutation direto`; nenhum e2e clica o botão "Descartar item" dentro do sheet (gap não fechado por esta story, registrado aqui para não superestimar a cobertura) |
| BD-AC-06 | Restauração de foco (Editar/Mover/Descartar) | foco volta ao acionador da linha após qualquer overlay fechar, inclusive no encadeamento sheet→picker — verificado nas DUAS implementações de FocusTrap (Dialog no ponteiro, Drawer no compact) | `BrainDumpInboxPage.test.tsx::fechar o sheet de edição devolve o foco ao acionador da linha…` · `…fechar o seletor de destino aberto DIRETO da linha devolve o foco ao botão Mover…` · `…mover a partir do sheet e depois fechar o seletor devolve o foco ao acionador ORIGINAL da linha…` | `brain-dump-a11y.spec.ts::Teclado › Escape fecha o sheet de edição (sem alteração) e devolve o foco à linha` · `…Escape fecha o seletor de destino e devolve o foco ao acionador` (Dialog, wide) · `…Teclado (compact) › Escape fecha o sheet de edição (Drawer, sem alteração)…` · `…Escape fecha o seletor de destino (Drawer, aberto a partir do sheet)…` (Drawer, compact — FocusTrap DIFERENTE do Dialog, nunca verificado antes desta rodada) |
| BD-AC-07 | Capture Sheet — abrir/fechar/Escape | Título em foco na abertura; `Enter` salva; Escape/backdrop/X/Cancelar convergem na mesma guarda de descarte ("Descartar item?" se houver título) — verificado no Dialog (ponteiro) E no Drawer (compact) | `BrainDumpCaptureSheet.test.tsx` | `brain-dump.spec.ts::Esc sem título fecha o Capture Sheet sem criar nada (AC2)` · `…Esc com título mostra o diálogo "Descartar item?"…` · `brain-dump-a11y.spec.ts::Teclado › Escape fecha o Capture Sheet e devolve o foco ao acionador` (Dialog, wide) · `…Teclado (compact) › Escape fecha o Capture Sheet (Drawer, FAB)…` (Drawer, compact) |
| BD-AC-08 | Ordem de Tab (Inbox) | ponteiro/wide: Capturar (Título→Descrição→Destino→botão) → linha (título ativável) → ações trailing (Mover→Descartar); compact: mesma sequência do painel Capturar, mas a linha é a ÚNICA parada seguinte (`trailingSlot` ausente — Design Notes 15.1) | não coberto em jsdom (ordem de Tab real depende do browser) | `brain-dump-a11y.spec.ts::Teclado › ordem de Tab: Capturar → Pendências → linha → ações` (wide) · `…Teclado (compact) › ordem de Tab: Capturar → Pendências → linha (compact, sem trailingSlot)` (achado de review: só wide tinha cobertura antes) |

## C. Touch target ≥44px (`--ds-touch-target-min`)

Medido via `dsTokenPx(page, '--ds-touch-target-min')` (token real, não literal) contra `boundingBox()` dos controles — mesmo padrão de `shell-bottomnav.spec.ts`.

| Superfície | Controles medidos | Evidência |
|---|---|---|
| Linha (ponteiro — wide E medium) | Mover, Descartar | `brain-dump-a11y.spec.ts::Touch target — wide 1440×900 (ponteiro) › linha…` · `…Touch target — medium 1280×800 (ponteiro) › linha…` (achado de review desta 4ª rodada: a faixa `medium` não tinha describe próprio de touch-target) |
| Capture Sheet | Fechar, Salvar no Brain Dump, Cancelar (wide/medium) / Fechar, Salvar (compact) | `brain-dump-a11y.spec.ts::Touch target — wide 1440×900 (ponteiro) › Capture Sheet: Fechar/Salvar/Cancelar…` · `…Touch target — medium 1280×800 (ponteiro) › Capture Sheet…` · `…Touch target — compact 390×720 › Capture Sheet: Fechar/Salvar…` |
| Sheet de edição | Fechar, Salvar (wide/medium) / Fechar, Salvar, Mover para um log, Descartar item (compact) | `brain-dump-a11y.spec.ts::Touch target — wide 1440×900 (ponteiro) › sheet de edição…` · `…Touch target — medium 1280×800 (ponteiro) › sheet de edição…` · `…Touch target — compact 390×720 › sheet de edição…` |
| Seletor de destino | radiogroup (Hoje/Esta Semana/Este Mês/Futuro), Fechar, "Sem dia definido", **o radiogroup de dia** revelado por "Esta Semana" (wide/medium/compact) e **o input nativo de Mês** revelado por "Futuro" (wide/medium/compact — achado de review desta 4ª rodada: único sub-controle de "Futuro" ainda sem medição) | `brain-dump-a11y.spec.ts::Touch target — wide 1440×900 (ponteiro) › seletor de destino…` · `…Touch target — medium 1280×800 (ponteiro) › seletor de destino…` · `…Touch target — compact 390×720 › seletor de destino…` (3 faixas × opções/Fechar/dia/"Sem dia definido"/input de Mês) |

Todos os controles **medidos** atingem ≥44px (`--ds-touch-target-min`). Toda
medição confirma `boundingBox()` não-nulo antes de dereferenciar `.height`
(achado de review: um seletor sem match retornaria `null` e o `!` do
TypeScript mascararia isso como um `TypeError` opaco em vez de uma falha de
asserção legível). Todas as medições são de ALTURA (`box!.height`) contra o
token — o mesmo padrão já usado em `shell-bottomnav.spec.ts:379-382` para
controles com token dedicado; largura não é medida porque o próprio token
`--ds-touch-target-min` só é aplicado como `minHeight` em produção (os
botões de linha, por exemplo, usam `minWidth: 0` deliberadamente — texto+
padding define a largura, não o token).

**Gap conhecido, NÃO medido aqui (DIV-BD-19):** as células do
`MonthDensityCalendar` (calendário revelado ao escolher "Este Mês"/"Futuro")
usam `minHeight: 40` literal (abaixo de 44px) — componente compartilhado
fora do Code Map desta story (Story 11.3/11.6). Ver seção "Divergências
contratadas" abaixo.

## D. Matriz axe-core (WCAG 2.2 AA, sem `disableRules`/exclusão nova não justificada)

`expectNoAxeViolations` com `WCAG_2_2_AA_TAGS` (mesmas tags de
`shell-a11y.spec.ts`), zero violação em todas as células — nenhuma `test.skip`/
`test.fixme`.

| Faixa | Estados/overlays cobertos | Spec dono |
|---|---|---|
| wide 1440×900 | vazio, populado, loading, error, offline (com item semeado sobrevivendo), Capture Sheet (âncora), sheet de edição, seletor de destino (default, com o radiogroup de dia revelado via "Esta Semana", E com o calendário revelado via "Este Mês"), Capture Sheet aberto→offline (I/O Matrix "sheet aberto") — **11 células** | `brain-dump-a11y.spec.ts` (describe `Matriz axe — wide 1440×900`) |
| medium 1280×800 | vazio, populado, loading, error, offline, Capture Sheet (âncora), sheet de edição, seletor de destino (default + dia revelado via "Esta Semana" + calendário revelado via "Este Mês"), Capture Sheet aberto→offline — **11 células** (achado de review, 4ª rodada: os sub-controles revelados do picker e a célula Capture-Sheet→offline nunca tinham sido escaneados nesta faixa, só em wide) | `brain-dump-a11y.spec.ts` (describe `Matriz axe — medium 1280×800`) |
| compact 390×720 | vazio, populado, loading, error, offline, Capture Sheet (FAB), sheet de edição, seletor de destino (default + dia revelado + calendário revelado), Capture Sheet aberto→offline — **11 células** (achado de review, 4ª rodada: os 2 sub-controles revelados do picker nunca tinham sido escaneados nesta faixa) | `brain-dump-a11y.spec.ts` (describe `Matriz axe — compact 390×720`) |

33 células no total (11 + 11 + 11, simétrico nas 3 faixas desde a 4ª rodada
de review) — fecha o gap "zero cobertura axe real (browser) sobre o
conteúdo do Brain Dump/Capture Sheet" identificado no Intent desta story,
incluindo os sub-controles do seletor de destino revelados só após escolher
um destino com dia/mês (radiogroup de dia da semana; `MonthDensityCalendar`
+ "Sem dia definido" — ver DIV-BD-19 para o gap de touch-target, não de axe,
encontrado ali) agora escaneados nas 3 faixas, não só em wide. As 3 faixas
espelham `shell-a11y.spec.ts` (tablet fica fora: o Brain Dump não tem
composição própria por faixa — `mediaQueries.tabletUp` já resolve tablet
como "ponteiro", igual wide/medium).

## E. `LEGACY_CAPTURE_SURFACE` — reavaliado e FECHADO (closes deferred[medium] da 15.2)

**Antes desta story:** `shell-a11y.spec.ts` excluía o `BrainDumpCaptureSheet`
do axe real nas duas células "Capture Sheet aberto" (`exclude: ['main',
LEGACY_CAPTURE_SURFACE]`), com uma justificativa histórica — "superfície de
captura LEGADA, `theme.ts` `brandPrimary = #2BADA0` dá ≈2,8:1 sobre a
superfície clara" (achado `LEG-03` em `13-shell-a11y-legacy-inventory.md`). A
Story 15.2 migrou o `BrainDumpCaptureSheet` para tokens `--ds-*`
(`--ds-primary = #315F5A`, contraste conforme), invalidando essa justificativa
sem remover a exclusão — exatamente o `deferred[medium]` que esta story
fecha ("justificativa inválida sem remoção coordenada").

**Decisão desta story:** a exclusão foi **removida** (não apenas renomeada).
Procedimento:
1. As duas células (`wide · /today · Capture Sheet aberto pela âncora` e
   `compact 390 · /today · Capture Sheet aberto pelo FAB`) rodaram o axe real
   **sem** `LEGACY_CAPTURE_SURFACE` no `exclude` (só `exclude: 'main'`
   permanece, igual às demais 14 células do gate).
2. Resultado: **zero violação** nas duas — confirmado rodando
   `CI=1 npx playwright test shell-a11y.spec.ts -g "Capture Sheet aberto"`
   (2 passed).
3. A causa raiz (contraste do `primary` do tema legado) não existe mais no
   componente; o `Block If` da spec ("se uma violação real aparecer, manter a
   exclusão com motivo atualizado") não se aplicou — não houve violação.

**Evidência:** `shell-a11y.spec.ts::wide · /today · Capture Sheet aberto pela
âncora` · `…compact 390 · /today · Capture Sheet aberto pelo FAB` (ambas sem
`exclude` de captura); comentário de topo do arquivo (linhas ~8-40) e o antigo
comentário da constante (removida) atualizados para registrar o fechamento.

`13-shell-a11y-legacy-inventory.md` (achado `LEG-03`) não foi editado — não
está no Code Map desta story e seu conteúdo é histórico (inventário do estado
ANTES da migração); este checklist é o registro formal do fechamento.

## F. `scheduled_date` — divergência de paridade documentada (ganho, não regressão)

O legado (`ProcessItemDialog.tsx`) nunca exercia `scheduled_date` ao
processar um item do Brain Dump — o campo existia no contrato da API mas o
formulário legado não tinha UI para escolher um dia. Desde a Story 15.1, a UI
nova (`BrainDumpDestinationPicker.tsx`) exercita `scheduled_date` de verdade
para os destinos `week`/`month`/`future` (calendário de densidade + rádio de
dia), e o backend sempre aceitou o campo.

- **Backend (não alterado por esta story, só lido):**
  `backend/braindump/views.py:94` (`process_brain_dump_item(...,
  scheduled_date=validated.get("scheduled_date"))`); `backend/braindump/
  services.py:52` (parâmetro `scheduled_date=None` de `process_brain_dump_item`),
  `:68` (resolve `week_start_of(scheduled_date)` quando informado),
  `:79` (repassa `scheduled_date` para `create_task`, exceto quando
  `destination == "today"`).
- **Frontend (não alterado por esta story, só lido):**
  `frontend/src/features/braindump/components/BrainDumpDestinationPicker.tsx:20-23`
  (comentário do cabeçalho já registra: "`scheduled_date` é REAL aqui
  (diferente do legado, que nunca a exercia)"), `:196` (`scheduledDate:
  destination === 'today' ? undefined : scheduledDate` no payload do
  `processItem.mutate`).
- **Evidência de exercício real (E2E):**
  `brain-dump-inbox.spec.ts::mover para Esta Semana com um dia escolhido cria
  a Task com scheduled_date (delta do M11 vs. o legado)`.

**Classificação:** divergência de paridade **contratada**, não uma regressão
— o sistema novo faz MAIS do que o legado fazia, dentro do mesmo contrato de
API que já aceitava o campo. Nenhuma mudança de comportamento nesta story
(`views.py`/`services.py`/`serializers.py` intocados, conforme Boundaries da
spec).

## G. Rota legada — fora de uso ativo (remoção física é do Épico 18)

Confirmado com evidência de código e de teste (não assumido):

- `frontend/src/app/router.tsx:176-184` — a rota `path: 'brain-dump'` monta
  `element: <BrainDumpInboxPage />` (sistema novo); o comentário no próprio
  arquivo registra: "`BrainDumpPage` legada (e `BrainDumpItemRow.tsx`/
  `ProcessItemDialog.tsx`) permanecem no repositório, apenas DESMONTADAS da
  rota — a remoção do legado é o Épico 18 (mesmo padrão de
  `FutureBoardPage`/`RecurringLibraryPage`)".
- `frontend/src/app/layout/shell/shellRouting.ts:75` — a entrada
  `{ routeId: 'brain-dump', shell: 'new', surfaceMigrated: true }` confirma a
  superfície como migrada (não é só a casca do shell — o CONTEÚDO interno
  também).
- `frontend/e2e/brain-dump.spec.ts:12-19` — comentário do próprio spec:
  "Story 15.1 (M11): `/brain-dump` passa a montar `BrainDumpInboxPage`
  (sistema novo) — a linha não tem mais `data-testid="brain-dump-item-row"`
  … Os testes abaixo foram ajustados para o novo DOM"; todos os testes do
  arquivo passam contra o DOM da página NOVA (`ItemRowBase`/`role="listitem"`,
  `BrainDumpDestinationPicker`), não contra `BrainDumpItemRow.tsx`/
  `ProcessItemDialog.tsx` legados.
- `frontend/e2e/brain-dump-inbox.spec.ts` — spec inteiro dedicado à
  superfície NOVA (edição paritária via PATCH, `scheduled_date` real),
  também contra o DOM novo.

**Arquivos legados preservados intocados** (não deletados — remoção física é
do Épico 18, mesmo padrão de `FuturePage.tsx`/`RecurringPage.tsx`):
`frontend/src/pages/braindump/BrainDumpPage.tsx`,
`frontend/src/features/braindump/components/BrainDumpItemRow.tsx`,
`frontend/src/features/braindump/components/ProcessItemDialog.tsx` (e seus
testes). Nenhum desses arquivos foi tocado por esta story.

## H. Rollback por superfície

O mecanismo é o mesmo de `13-shell-parity-checklist.md` §Rollback — esta
story não cria um segundo mecanismo (proibido desde a Story 13.0).

**Arquivo:** `frontend/src/app/layout/shell/shellRouting.ts`
**Entrada:** `{ routeId: 'brain-dump', shell: 'new', surfaceMigrated: true }`
(linha 75).

**Rollback de uma linha:** trocar `shell: 'new'` por `shell: 'legacy'` nessa
entrada — `ProtectedLayout` (`router.tsx`) monta o `AppLayout` legado em vez
do `ShellLayout` para a rota `/brain-dump`, sem tocar em nenhum outro
arquivo. Procedimento completo (efeito, verificação, campo
`surfaceMigrated`) em `13-shell-parity-checklist.md` §"Rollback por
superfície".

## Divergências contratadas (cruzadas por referência — não duplicam o texto original)

Cada linha aponta para o `deferred` já registrado no frontmatter da spec de
origem (`summary`/`location`/`severity` completos ficam lá); o trabalho desta
story é o cruzamento formal, não a reabertura/correção de cada item.

| # | Resumo | Localização | Severidade | Origem |
|---|---|---|---|---|
| DIV-BD-01 | Radiogroups novos (destino, dia da semana) sem navegação por setas/roving-tabindex, só Tab por item — mesmo gap herdado de `DestinationPicker.tsx` (M10) | `BrainDumpDestinationPicker.tsx` | low | `spec-15-1` `deferred[0]` |
| DIV-BD-02 | `input type="month"` de "Futuro" sem `min` — mês passado pode ser escolhido/confirmado (replicado do `ProcessItemDialog.tsx` legado) | `BrainDumpDestinationPicker.tsx` | low | `spec-15-1` `deferred[1]` |
| DIV-BD-03 | Recusa client-side do mês corrente em "Futuro" tem janela breve com `currentMonthFirst` ainda `null`; backend revalida e rejeita com 400 (nenhuma Task inválida chega a existir) | `BrainDumpDestinationPicker.tsx:122` | low | `spec-15-1` `deferred[2]` |
| DIV-BD-04 | Radiogroup de dia da semana permite selecionar/confirmar um dia já passado na semana corrente (achado incidental, sem AC violada) | `BrainDumpDestinationPicker.tsx:255` | low | `spec-15-1` `deferred[3]` |
| DIV-BD-05 | `useTaskDensityQuery` descarta erro (`density.data ?? []`) — falha de leitura da densidade renderiza como mês vazio (padrão herdado de `TaskDestinationDialog.tsx`) | `BrainDumpDestinationPicker.tsx:131` | low | `spec-15-1` `deferred[4]` |
| DIV-BD-06 | CI (`ci.yml`) só roda `tsc`/`eslint`/`vite build` — vitest/jest-axe não são gate automático (achado incidental, alheio aos arquivos da 15.1) | `.github/workflows/ci.yml` | medium | `spec-15-1` `deferred[5]` |
| DIV-BD-07 | Corrida entre o atalho global de Enter (`useKeyboardShortcuts`) e o clique nativo do botão-radio focado pode confirmar uma seleção antiga — anatomia idêntica já existe, sem alteração, em `DestinationPicker.tsx` (M10) | `BrainDumpDestinationPicker.tsx:205-208`; `DestinationPicker.tsx` | medium | `spec-15-1` `deferred[6]` |
| DIV-BD-08 | Swipe-down (gesto nativo de descartar) perdido ao trocar `SwipeableDrawer` → `Drawer` simples no Capture Sheet compact — mesma troca já aceita em `BrainDumpItemSheet.tsx` (15.1); X/Esc/backdrop continuam fechando | `BrainDumpCaptureSheet.tsx` | medium | `spec-15-2` `deferred[0]` |
| DIV-BD-09 | `shellCssVariables('light')` fixo nos 3 slots de Paper novos, ignorando `theme.palette.mode` — dark mode veria o Capture Sheet/dialog de descarte com tema claro (mesmo atalho já em `BrainDumpItemSheet.tsx`) | `BrainDumpCaptureSheet.tsx` | medium | `spec-15-2` `deferred[1]` |
| DIV-BD-10 | Desabilitar campos offline com o sheet aberto tira o foco sem recuperação/anúncio `aria-live` (mesma lacuna de `BrainDumpItemSheet.tsx`) | `BrainDumpCaptureSheet.tsx` | low | `spec-15-2` `deferred[2]` |
| DIV-BD-11 | Offline desabilita TODOS os campos (Título/Descrição/Destino), não só Salvar — mais restritivo que a cópia isolada sugere (consistente com o resto da superfície) | `BrainDumpCaptureSheet.tsx` | low | `spec-15-2` `deferred[3]` |
| DIV-BD-12 | Campos desabilitados offline sem estilo visual de "desabilitado" — nada indica visualmente por que não dá para digitar (mesmo padrão de `BrainDumpItemSheet.tsx`) | `BrainDumpCaptureSheet.tsx` | low | `spec-15-2` `deferred[4]` |
| DIV-BD-13 | Título/Descrição/Destino não ficam `disabled` durante `createItem.isPending` — edição nessa janela é descartada pelo `onSuccess` incondicional (lacuna herdada do componente legado) | `BrainDumpCaptureSheet.tsx` | medium | `spec-15-2` `deferred[5]` |
| DIV-BD-14 | Descartar com um save em voo não cancela a mutação HTTP — o item ainda pode ser criado no servidor mesmo com o usuário acreditando ter descartado (herdado, sem `AbortController`) | `BrainDumpCaptureSheet.tsx` | medium | `spec-15-2` `deferred[6]` |
| DIV-BD-15 | Cruzar o breakpoint compact/ponteiro com o sheet já aberto remonta o Drawer/Dialog (MUI desmonta um modal e monta o outro), reiniciando a transição e refocando o Título | `BrainDumpCaptureSheet.tsx` | low | `spec-15-2` `deferred[7]` |
| DIV-BD-16 | `LEGACY_CAPTURE_SURFACE` — **FECHADA nesta story**, ver seção E acima | `shell-a11y.spec.ts` | ~~medium~~ fechada | `spec-15-2` `deferred[8]` → resolvida por `spec-15-3` |
| DIV-BD-17 | `scheduled_date` real na UI nova vs. nunca exercido pelo legado — ver seção F acima (ganho, não regressão) | `BrainDumpDestinationPicker.tsx`; `braindump/services.py`/`views.py` | — (ganho) | `epic-15-context.md` §Technical Decisions; documentado formalmente nesta story |
| DIV-BD-18 | `BrainDumpItemSheet.tsx`/`BrainDumpDestinationPicker.tsx` não implementam `aria-busy` durante ações em voo (Mover/Descartar/Salvar edição) — só `BrainDumpCaptureSheet.tsx` tem esse contrato (ver BD-ST-06 acima) | `BrainDumpItemSheet.tsx`; `BrainDumpDestinationPicker.tsx` | medium | achado da própria review desta story (15.3); registrado como `deferred` no frontmatter de `spec-15-3-passe-de-paridade-estados-e-acessibilidade-da-captura.md` — gap pré-existente da 15.1 (quando os dois componentes foram criados), não regressão, e fora do Code Map desta story (não corrigido: mudaria comportamento de componentes que a spec não autoriza tocar) |
| DIV-BD-19 | `MonthDensityCalendar` (célula do dia, modo interativo) usa `minHeight: 40` literal, abaixo de `--ds-touch-target-min` (44px) — afeta o seletor de destino do Brain Dump (Este Mês/Futuro) e qualquer outro uso do componente compartilhado (ver seção C acima) | `frontend/src/features/bujo/components/MonthDensityCalendar.tsx:163-177` | medium | achado da própria review desta story (15.3) ao expandir a matriz de touch-target para os sub-controles revelados por Este Mês/Futuro; registrado como `deferred` no frontmatter de `spec-15-3-passe-de-paridade-estados-e-acessibilidade-da-captura.md` — componente compartilhado (Story 11.3/11.6) fora do Code Map desta story, não corrigido (alterá-lo afeta outras superfícies fora do escopo de fechamento) |
| DIV-BD-20 | No sheet de edição compact, os botões "Mover para um log"/"Descartar item" só ficam `disabled` via o `disabled` genérico (`!isOnline`, `BrainDumpInboxPage.tsx:231`) — nunca ficam indisponíveis durante a PRÓPRIA mutação em voo, diferente do botão trailing da linha (ponteiro, ligado a `discarding`) e do confirmar do seletor de destino (ligado a `processItem.isPending`); risco de duplo submit ao clicar 2× rápido nesses 2 botões especificamente no compact | `frontend/src/features/braindump/components/BrainDumpItemSheet.tsx` (props `onMove`/`onDiscard`, sem gate de pendência própria); `frontend/src/pages/braindump/BrainDumpInboxPage.tsx:231` | medium | achado da própria review desta story (15.3), 4ª rodada, ao tentar espelhar "Descartar em voo" (wide, ver BD-ST-06) para o compact; registrado como `deferred` no frontmatter — `BrainDumpItemSheet.tsx` está fora do Code Map desta story (só leitura), corrigir mudaria comportamento de um componente que a spec não autoriza tocar |

Nenhum item acima foi reaberto/corrigido por esta story, exceto DIV-BD-16
(único cuja própria origem já sinalizava a necessidade de uma "passada
coordenada" — ver Design Notes da spec 15.3), DIV-BD-17 (documentação
formal, sem alteração de código) e DIV-BD-18/DIV-BD-19/DIV-BD-20 (achados
NOVOS expostos ao montar/revisar a checklist — registrados como `deferred`,
deliberadamente não corrigidos: fora do Code Map desta story, que não
autoriza mudança de comportamento em componentes compartilhados/fora de
escopo).

## Verificação (comandos rodados no fechamento desta story)

- `cd frontend && npx tsc --noEmit` — limpo.
- `cd frontend && npx eslint .` — limpo.
- `cd frontend && CI=1 npx playwright test shell-a11y.spec.ts brain-dump-a11y.spec.ts brain-dump.spec.ts brain-dump-inbox.spec.ts` — **72 passed** (17 `shell-a11y.spec.ts` + 39 `brain-dump-a11y.spec.ts` + 13 `brain-dump.spec.ts` + 3 `brain-dump-inbox.spec.ts`), zero `test.skip`/`test.fixme`, zero `exclude` novo não justificado (contagem confirmada via `--list` por arquivo). Rodado 3× no total para checar flake: a 1ª rodada pegou uma corrida real no teste de ordem de Tab (o `GET items/` inicial podia resolver NO MEIO da sequência de Tab, trocando skeleton→lista e resetando o foco para `<body>`) — corrigida esperando a linha populada ANTES de tabular; reconfirmado com `--repeat-each 8` (8/8). Uma 2ª rodada de review (8 gaps: medium incompleto, sub-controles do picker nunca revelados, BD-AC-04 nunca asserido, teclado só em wide, `boundingBox()` sem guard de `null`, evidências overstated de BD-ST-06/BD-AC-05/offline-sem-seed) motivou os testes/reescritas acima; as 8 células mais arriscadas foram estressadas com `--repeat-each 3` (24/24) antes da rodada final completa (72/72, zero flaky).
- **3ª rodada de review** (2026-07-30, ver `spec-15-3-…md` `## Review Triage Log`): confounds de offline (guard de título vazio mascarando o efeito do `useOnlineStatus`), medium/compact offline sem semear item (a asserção de "leitura já carregada permanece" nunca era exercida de verdade), assimetrias wide↔compact/medium (aria-busy, Capture-Sheet→offline, ordem de Tab, radiogroup de dia do seletor de destino, loading/error em medium) e um sub-controle nunca revelado (`MonthDensityCalendar`/"Sem dia definido") — todos corrigidos com 7 células novas (39→46 em `brain-dump-a11y.spec.ts`: 11 wide + 8 medium + 9 compact axe = 28; 4 teclado wide + 4 teclado compact = 8; 1 disabled-em-voo wide + 1 compact = 2; 5 touch-target wide + 3 touch-target compact = 8) + reescritas nos testes de offline/populado/Tab, exceto o `minHeight: 40` do `MonthDensityCalendar`, registrado como DIV-BD-19 (componente compartilhado fora do Code Map). Suíte completa reconfirmada: `cd frontend && npx tsc --noEmit && npx eslint .` limpos; `CI=1 npx playwright test shell-a11y.spec.ts brain-dump-a11y.spec.ts brain-dump.spec.ts brain-dump-inbox.spec.ts` — **79 passed** (17 + 46 + 13 + 3), zero flaky.
- **4ª rodada de review** (2026-07-30, ver `spec-15-3-…md` `## Review Triage Log`): a faixa `medium` nunca teve describe próprio de touch-target (o Approach da spec pede a matriz dedicada em wide/medium/compact); a faixa `medium` e `compact` nunca escaneavam os sub-controles do seletor de destino revelados por "Esta Semana"/"Este Mês" (só wide); a faixa `medium` nunca cobria o cenário "Capture Sheet aberto, depois offline" (só wide/compact); o input nativo de "Futuro" nunca era medido para touch-target em nenhuma faixa; e "disabled em voo" (BD-ST-06/I-O Matrix) só tinha cobertura browser-real para "criar" (Capture Sheet), nunca para "mover" (confirmar do seletor de destino) ou "descartar" (linha) — todos corrigidos com 16 células novas em `brain-dump-a11y.spec.ts` (46→62: describe `Touch target — medium 1280×800` inteiro, 6 testes; 2 testes de revelação do picker em `medium` + 2 em `compact`; 1 teste `Capture Sheet aberto, depois offline` em `medium`; 1 teste de touch-target do input "Futuro" em wide + 1 em compact; 2 testes de "em voo" em wide (mover/descartar) + 1 em compact (mover)). Ao tentar espelhar "descartar em voo" para o compact, a review encontrou um gap de produção genuíno e distinto de DIV-BD-18 (não é falta de `aria-busy`, é falta do PRÓPRIO `disabled`-durante-pendência nos botões do sheet de edição compact) — registrado como `deferred` (DIV-BD-20), não corrigido (fora do Code Map, `BrainDumpItemSheet.tsx` é só leitura). Suíte completa reconfirmada: `cd frontend && npx tsc --noEmit && npx eslint .` limpos; `CI=1 npx playwright test shell-a11y.spec.ts brain-dump-a11y.spec.ts brain-dump.spec.ts brain-dump-inbox.spec.ts` — **95 passed** (17 + 62 + 13 + 3), zero flaky; as 5 células novas de "em voo" (mais sensíveis a timing por usarem `page.route` + `setTimeout`) foram adicionalmente estressadas com `--repeat-each 5` (25/25).
