# Explicacao dos arquivos nao commitados - Story 5.3 (Captura rapida no mobile via FAB e Capture Sheet)

## Visao geral

O conjunto de mudancas implementa a Story 5.3, ultima do Epico 5 (Brain Dump & Captura Rapida): o FAB mobile (ate aqui um botao estatico e permanentemente `disabled` no `BottomNav`) passa a abrir um **Capture Sheet** — um bottom sheet (`SwipeableDrawer` do MUI) com titulo (foco automatico), descricao opcional e um select de 5 destinos (default "Brain Dump"). Salvar (botao ou Enter no titulo) chama a mesma mutation ja existente desde a Story 5.1 (`useCreateBrainDumpItemMutation`) — **toda captura cria um `BrainDumpItem`**, nunca uma `Task` diretamente, mesmo quando um destino diferente de "Brain Dump" e escolhido (Decisao Critica documentada nas Dev Notes da story). Fechar sem salvar (swipe-down, `Esc`, clique no backdrop ou no botao "X") converge num unico handler que so pede confirmacao de descarte se o titulo estiver preenchido — primeiro dialogo de confirmacao destrutiva do codebase. Um novo hook `useOnlineStatus` (wrapper fino sobre `navigator.onLine` + eventos `online`/`offline`) desabilita o FAB e exibe um `Tooltip` "Sem conexao" quando o dispositivo esta offline, garantindo que nenhuma captura seja perdida silenciosamente (AC #3).

A story e **100% frontend**: nenhum arquivo `backend/` foi tocado, porque o endpoint `POST /api/brain-dump/items/`, o serializer e o service ja existem desde a Story 5.1 e nao mudam. O code review encontrou e corrigiu 1 achado LOW (guard de duplo-submit via Enter faltando em `handleSubmit`, que permitia criar itens duplicados com dois Enter rapidos durante uma mutacao em voo), corrigiu contagens de teste desatualizadas na documentacao da story (609/610 testes unitarios e 12 casos e2e, nao 604/11 como o dev-story havia registrado), e registrou 1 achado MEDIUM de flakiness pre-existente da suite (cross-file, nao relacionado a esta story) como follow-up nao bloqueante. Cobertura: 5 testes novos no componente `BrainDumpCaptureSheet` (Enter-submit, destino default sem `targetLog`, botao "Fechar" com/sem titulo), 3 testes novos no hook `useOnlineStatus`, 3 testes novos/reescritos no `BottomNav` (FAB habilitado por padrao, desabilitado offline com tooltip, clique abre o sheet), ajustes de mock em `AppLayout.test.tsx`/`RouteAnnouncer.test.tsx`, e 4 testes E2E novos no `brain-dump.spec.ts` cobrindo o fluxo completo do Capture Sheet em viewport mobile.

## Ordem logica de funcionamento

1. Um novo primitivo compartilhado, `useOnlineStatus` (`shared/hooks/`), expoe o estado de conectividade do navegador via a Web API nativa (`navigator.onLine` + eventos `online`/`offline`), sem dependencia nova.
2. O vocabulario de destino (`TARGET_LOG_OPTIONS`), ate aqui privado do `BrainDumpCaptureForm.tsx` (formulario desktop, Story 5.1), passa a ser exportado para ser reaproveitado sem duplicacao pelo novo componente mobile.
3. O novo componente `BrainDumpCaptureSheet` compoe: `SwipeableDrawer` (bottom sheet com swipe-down nativo) + formulario (titulo/descricao/select) + `Dialog` de confirmacao de descarte, consumindo a mutation `useCreateBrainDumpItemMutation` ja existente (Story 5.1/5.2, sem alteracao) e o vocabulario importado do passo 2.
4. O barrel `features/braindump/index.ts` passa a reexportar `BrainDumpCaptureSheet`, unico ponto de import permitido para fora da feature (fronteira de ESLint).
5. `BottomNav.tsx` liga as pecas: consome `useOnlineStatus` para desabilitar o `Fab` e trocar seu `aria-label`/`Tooltip` quando offline, e consome `BrainDumpCaptureSheet` via o barrel, controlando sua abertura/fechamento com um `useState` local (`captureOpen`).
6. Testes sobem em cascata: unitarios dedicados de cada peca nova (`useOnlineStatus.test.ts`, `BrainDumpCaptureSheet.test.tsx`), o teste do `BottomNav` reescrito para o novo comportamento (FAB funcional em vez de permanentemente desabilitado), e dois testes de terceiros que renderizam o `BottomNav` real (`AppLayout.test.tsx`, `RouteAnnouncer.test.tsx`) com o mock do barrel `features/braindump` estendido para tambem stubar `BrainDumpCaptureSheet`.
7. O E2E (`frontend/e2e/brain-dump.spec.ts`) valida o fluxo completo contra backend+frontend reais em viewport mobile (390x844): locator do FAB atualizado (o `aria-label` "em breve" deixou de existir) e 4 testes novos cobrindo abrir o sheet e salvar em qualquer destino, salvar via Enter no destino default, `Esc` sem/com titulo, e offline desabilitando o FAB.
8. Artefatos de planejamento/status (`sprint-status.yaml`, `test-summary.md`, log de orquestracao do story-automator, arquivo da story com a Senior Developer Review) registram o fechamento da story como `done`.

---

## 1. Artefatos de planejamento e status

### `_bmad-output/implementation-artifacts/5-3-captura-rapida-no-mobile-via-fab-e-capture-sheet.md`

**Funcao geral do arquivo**

Arquivo da story gerado pelo workflow BMAD (`create-story`), contendo ACs, tasks, dev notes, debug log, code review e file list. Status atual: `done`.

**Funcao geral da alteracao**

Arquivo novo (untracked) — nao existia antes desta story. Documenta integralmente o ciclo `create-story → dev-story → automate → code-review` da Story 5.3, incluindo a Senior Developer Review que corrigiu um bug e as contagens de teste.

**Blocos principais**

- Linhas 19-35: as 3 Acceptance Criteria — FAB abre o Capture Sheet com foco no titulo, salvar por botao/Enter atualiza o badge; fechar por swipe-down/Esc com confirmacao condicional; FAB desabilitado offline sem perda silenciosa de captura.
- Linhas 41-300: 7 tasks/subtasks detalhando o hook de conectividade, a exportacao do vocabulario de destino, o componente do Capture Sheet, o wiring do FAB, os testes de frontend, o e2e e a verificacao final — todas marcadas `[x]`.
- Linhas 302-305: **Review Follow-ups (AI)** — o achado LOW corrigido (guard de duplo-submit) marcado `[x]`, e o achado MEDIUM pre-existente de flakiness da suite registrado como follow-up nao bloqueante (`[ ]`, fora do escopo desta story).
- Linhas 307-378: Dev Notes — a Decisao Critica (toda captura cria `BrainDumpItem`, nunca placement direto de `Task`), o escopo deliberadamente restrito de "offline" (so o FAB, nao um toast global de conectividade), os limites de teste do gesto de swipe-down (nao simulavel em jsdom/Playwright headless), o primeiro uso de `SwipeableDrawer`/`Tooltip`/dialogo de confirmacao destrutiva no codebase, e os 3 testes existentes que quebravam sem ajuste.
- Linhas 380-424: Dev Agent Record — Debug Log (achado real via e2e: `autoFocus` sozinho nao funciona dentro do `SwipeableDrawer`/`FocusTrap` no browser real, corrigido com `onEntered` da transicao) e File List (4 arquivos novos, 7 modificados, 0 arquivos `backend/`).
- Linhas 425-445: **Senior Developer Review (AI)** — 3 achados: (1) LOW corrigido, guard de duplo-submit por Enter durante o envio; (2) MEDIUM corrigido no proprio documento, contagens de teste desatualizadas (609/610 unitarios reais, nao 604; 12 casos e2e, nao 11); (3) MEDIUM pre-existente e fora de escopo, suite unitaria flaky (~2 falhas nao-deterministicas por rodada, conjunto que muda a cada execucao, todas passam em isolamento) — registrado como follow-up, nao bloqueante.
- Linhas 447-450: Change Log — duas entradas, a implementacao original (status `review`) e a revisao com o fix aplicado (status `done`).

**Comportamento de libs usadas**

- N/A — arquivo de documentacao, sem codigo executavel.

---

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Funcao geral do arquivo**

Arquivo de tracking central do sprint (gerado pelo workflow `bmad-sprint-planning`), com o status de cada story de cada epico.

**Funcao geral da alteracao**

Atualiza o comentario de `last_updated` (linha 38) e move a entrada `5-3-captura-rapida-no-mobile-via-fab-e-capture-sheet` de `backlog` para `done` (linha 100), refletindo o fechamento da story apos o code review.

**Blocos principais**

- Linha 38: `last_updated: 2026-07-17  # Story 5.3 pronta para review` — nota: o comentario ainda descreve o estagio intermediario ("pronta para review"), enquanto o valor logo abaixo ja reflete `done`; nao afeta o funcionamento do tracking (o campo lido pelos workflows e o mapa `development_status`, nao o comentario).
- Linha 100: `5-3-captura-rapida-no-mobile-via-fab-e-capture-sheet: backlog` → `done`.

**Comportamento de libs usadas**

- N/A — YAML de dados, consumido pelos workflows BMAD (`bmad-sprint-status`, `bmad-story-automator`) para decidir a proxima story a processar.

---

### `_bmad-output/implementation-artifacts/tests/test-summary.md`

**Funcao geral do arquivo**

Resumo cumulativo de rodadas de automacao de teste (QA/E2E) por story, mantido pelo workflow `bmad-qa-generate-e2e-tests`.

**Funcao geral da alteracao**

Acrescenta (append, sem alterar conteudo anterior) uma nova secao "Resumo de Automacao de Testes — Story 5.3" a partir da linha 1936, documentando os 4 gaps de cobertura fechados nesta rodada de QA (Enter no ultimo campo, destino default sem cobertura, botao "Fechar" (X) sem cobertura, tooltip "Sem conexao" so verificado via `aria-label`).

**Blocos principais**

- Linhas 1936-1953: contexto da rodada — story ja chegou em `review` com cobertura propria extensa; esta rodada complementou os gaps mapeados contra as 3 ACs, sem tocar arquivos de producao.
- Linhas 1946-1953: tabela de gaps descobertos e auto-aplicados, cada um com a AC correspondente e onde foi coberto (unit e/ou e2e).
- Linhas 1955-1971: testes gerados por arquivo — 1 novo no `brain-dump.spec.ts` (total 12), 4 novos no `BrainDumpCaptureSheet.test.tsx` (total 12), 1 novo no `BottomNav.test.tsx` (total 9).
- Linhas 1972-1987: tabela de cobertura por AC pos-run, cruzando cada criterio com o(s) teste(s) que o cobre.
- Linhas 1988-2003: resultado de execucao real (`npm run lint` limpo; `vitest run --no-file-parallelism` 609 passed/53 files; `playwright test brain-dump.spec.ts` 12 passed/50.8s).
- Linhas 2017-2022: limites de cobertura por design (nao gaps) — gesto fisico de swipe-down (nao simulavel em jsdom/Playwright headless) e propriedades de layout CSS (tamanho/posicao do FAB, ausencia de scroll horizontal), ambos reservados a verificacao manual.

**Comportamento de libs usadas**

- N/A — Markdown de relatorio, nao executavel.

---

### `_bmad-output/story-automator/orchestration-5-20260716-224123.md`

**Funcao geral do arquivo**

Log de orquestracao do workflow `bmad-story-automator` para o Epico 5, com estado da maquina (story atual, passos concluidos) e uma tabela de progresso por story/etapa.

**Funcao geral da alteracao**

Avanca o ponteiro de orquestracao de `currentStory: 5.2` para `5.3` (linha 7), atualiza `lastUpdated` (linha 10), marca a linha da Story 5.2 como totalmente `done` (incluindo `git-commit`) e a Story 5.3 com `create-story`/`dev-story`/`automate`/`code-review` concluidos e `git-commit` pendente (`in-progress`, linha 59), e acrescenta 9 novas entradas de log cronologico (linhas 93-104) narrando o fechamento da 5.2 e todo o ciclo da 5.3 ate o code review.

**Blocos principais**

- Linhas 7-10: ponteiro de estado da orquestracao (story atual, timestamp).
- Linha 59 (tabela): progresso por story/etapa — 5.3 = done ate `code-review`, `git-commit` ainda pendente (`-`), status geral `in-progress`.
- Linhas 99-104 (log append-only): eventos cronologicos, incluindo a contagem real de testes de cada etapa — dev-story: 604 frontend + 11 e2e (contagem inicial, depois corrigida na revisao); automate: 4 gaps fechados, 609 unit + 12 e2e; code review: PASS com 1 LOW auto-corrigido (guard de duplo-submit), contagens de teste corrigidas na story, 1 MEDIUM de flakiness pre-existente registrado como follow-up, contagem final 610 unit + 12 e2e (609 + 1 teste de regressao do proprio review).

**Comportamento de libs usadas**

- N/A — log de orquestracao em Markdown/YAML de front matter, consumido pelo proprio workflow `bmad-story-automator` para retomada (resumable tmux orchestration).

---

## 2. Frontend — primitivo compartilhado de conectividade

### `frontend/src/shared/hooks/useOnlineStatus.ts`

**Funcao geral do arquivo**

Arquivo novo (untracked). Hook React reutilizavel, sem dono de feature (`shared/hooks/`, mesmo diretorio de `useOptimisticMutation.ts`), que expoe o estado atual de conectividade do navegador.

**Funcao geral da alteracao**

Primeiro uso no codebase da deteccao de conectividade via Web API nativa — nao existia nenhum hook equivalente antes desta story.

**Blocos principais**

- Linhas 1-8: imports (`useEffect`, `useState` de `react`) e comentario de escopo — deliberadamente **nao** e suporte offline (a arquitetura documenta explicitamente "Sem offline no MVP"), so deteccao de conectividade para desabilitar o FAB (AC #3).
- Linha 8: `const [isOnline, setIsOnline] = useState(() => navigator.onLine)` — inicializacao lazy que le o estado real do navegador na montagem.
- Linhas 10-23: `useEffect` que registra `window.addEventListener('online', handleOnline)` e `window.addEventListener('offline', handleOffline)`, com a funcao de cleanup removendo os dois listeners no unmount.
- Linha 25: retorna o booleano `isOnline`.

**Funcoes, classes e importacoes especificas**

- `useOnlineStatus(): boolean`: sem parametros; deriva o estado inicial de `navigator.onLine` e o mantem sincronizado via os eventos nativos `online`/`offline` do `window`, sem polling.

**Comportamento de libs usadas**

- `navigator.onLine` (Web API nativa): propriedade booleana do navegador que reflete o estado de conectividade percebido pelo SO/browser — pode ter falsos positivos (rede local ativa mas sem acesso real a internet), aceito como limitacao conhecida pois o hook so precisa detectar quedas obvias de rede para desabilitar o FAB, nao garantir conectividade real ao servidor.
- Eventos `online`/`offline` do `window`: disparados pelo navegador quando o estado de `navigator.onLine` muda — usados aqui em vez de polling, sem overhead de timer.

---

### `frontend/src/shared/hooks/useOnlineStatus.test.ts`

**Funcao geral do arquivo**

Arquivo novo (untracked). Testes unitarios (Vitest) do hook `useOnlineStatus`, isolado via `renderHook`.

**Funcao geral da alteracao**

Cobertura completa do hook: estado inicial, transicao para offline, transicao de volta para online.

**Blocos principais**

- Linhas 5-10: helper `setNavigatorOnLine(value)` — redefine `navigator.onLine` via `Object.defineProperty` com um getter customizado (a propriedade nativa e read-only e nao pode ser atribuida diretamente).
- Linhas 13-17: `afterEach` restaura `navigator.onLine` para `true` (default do jsdom) e chama `vi.restoreAllMocks()`, evitando vazamento de estado entre testes.
- Linhas 19-23: `'estado inicial reflete navigator.onLine'` — com `navigator.onLine = true`, `renderHook(() => useOnlineStatus())` retorna `true`.
- Linhas 25-34: `'evento offline muda o estado para false'` — dispara `window.dispatchEvent(new Event('offline'))` dentro de `act()` e confirma que `result.current` vira `false`.
- Linhas 36-45: `'evento online volta o estado para true'` — parte de offline, dispara `new Event('online')` e confirma o retorno a `true`.

**Comportamento de libs usadas**

- `@testing-library/react renderHook`: monta um componente de teste minimo em torno do hook e expoe seu valor de retorno via `result.current`, sem exigir um componente-alvo real.
- `act()`: envolve o `dispatchEvent` para garantir que a atualizacao de estado do React (`setIsOnline`) seja processada de forma sincrona antes da asserção seguinte.

---

## 3. Frontend — vocabulario compartilhado de destino (reuso sem duplicacao)

### `frontend/src/features/braindump/components/BrainDumpCaptureForm.tsx`

**Funcao geral do arquivo**

Formulario de captura desktop do Brain Dump (Story 5.1), usado na `BrainDumpPage` — titulo, descricao e select de destino.

**Funcao geral da alteracao**

A unica mudanca e tornar publica (exportada) a constante `TARGET_LOG_OPTIONS`, ate aqui privada do modulo, para ser reaproveitada pelo novo `BrainDumpCaptureSheet` sem duplicar a lista de 5 opcoes. **Sem mudanca de comportamento** no formulario desktop em si.

**Blocos principais**

- Linhas 16-19: comentario justificando a exportacao (fonte unica compartilhada com a Story 5.3) e o `eslint-disable-next-line react-refresh/only-export-components` — necessario porque exportar um valor nao-componente ao lado de um componente (`BrainDumpCaptureForm`) dispara o aviso de fast-refresh do Vite; o mesmo padrao ja usado por `MigrationCard.tsx`.
- Linha 20: `const` vira `export const TARGET_LOG_OPTIONS: Array<{ value: BrainDumpTargetLog | ''; label: string }> = [...]` — array em si (5 entradas: `''`→"Brain Dump", `'today'`→"Hoje", `'week'`→"Esta Semana", `'month'`→"Este Mes", `'future'`→"Futuro") permanece identico.

**Funcoes, classes e importacoes especificas**

- `TARGET_LOG_OPTIONS`: unica fonte de verdade do vocabulario de destino, agora consumida por dois componentes (`BrainDumpCaptureForm` no desktop e `BrainDumpCaptureSheet` no mobile) — qualquer mudanca futura no vocabulario (nome de label, nova opcao) so precisa ser feita em um lugar.

**Comportamento de libs usadas**

- N/A alem do proprio ESLint (regra `react-refresh/only-export-components`, suprimida deliberadamente e com justificativa em comentario).

---

## 4. Frontend — componente novo `BrainDumpCaptureSheet`

### `frontend/src/features/braindump/components/BrainDumpCaptureSheet.tsx`

**Funcao geral do arquivo**

Arquivo novo (untracked). Componente principal desta story: o bottom sheet mobile de captura rapida, aberto pelo FAB do `BottomNav`.

**Funcao geral da alteracao**

Primeiro uso do `SwipeableDrawer` do MUI no codebase (o precedente existente, `TaskDetailPanel.tsx`, usa `Drawer` simples, sem swipe nativo) e primeiro dialogo de confirmacao destrutiva do codebase (`Dialog` "Descartar item?").

**Blocos principais**

- Linhas 1-18: imports — `useRef`/`useState`/`FormEvent` de `react`; componentes MUI (`Box`, `Button`, `Dialog`, `DialogActions`, `DialogTitle`, `IconButton`, `MenuItem`, `Select`, `SwipeableDrawer`, `TextField`, `Typography`) e `CloseIcon`; `useCreateBrainDumpItemMutation` de `'../api'` (mesma mutation da Story 5.1/5.2, sem alteracao); `TARGET_LOG_OPTIONS` importado de `./BrainDumpCaptureForm` (reuso, secao 3); `BrainDumpTargetLog` como tipo.
- Linhas 25-38: estado local — `title`, `description`, `targetLog` (default `''`, ou seja "Brain Dump"), `confirmDiscardOpen`, `titleRef` (ref para foco imperativo) e `createItem = useCreateBrainDumpItemMutation()`. `resetFields()` limpa os 3 campos e chama `createItem.reset()` (limpa tambem o estado de erro da mutation anterior).
- Linhas 40-51 (`requestClose`): unico ponto de fechamento sem salvar — chamado pelo `onClose` do `SwipeableDrawer` em swipe-down, `Esc` **e** clique no backdrop (mesmo handler do `Modal` subjacente do MUI), e pelo botao "X" do cabeçalho. Se `title.trim()` tiver conteudo, abre o dialogo de confirmacao (`setConfirmDiscardOpen(true)`) e retorna sem fechar; caso contrario, limpa os campos e chama `onClose` direto.
- Linhas 53-57 (`confirmDiscard`): acionado pelo botao "Descartar" do dialogo — fecha o dialogo, limpa os campos e chama `onClose`.
- Linhas 59-75 (`handleSubmit`): faz `event.preventDefault()`, calcula `trimmedTitle`; o guard `if (!trimmedTitle || createItem.isPending) return` (linha 65, comentado nas linhas 62-64) e o **fix do achado LOW do code review** — sem o `createItem.isPending`, dois `Enter` rapidos no titulo (que contorna o `disabled` do botao Salvar) disparavam duas mutacoes e criavam itens duplicados. Em seguida chama `createItem.mutate({ title, description: description.trim() || undefined, targetLog: targetLog || undefined }, { onSuccess: () => { resetFields(); onClose() } })`.
- Linhas 79-93 (`SwipeableDrawer`): `anchor="bottom"`, `open`/`onClose={requestClose}`, `disableSwipeToOpen` (o sheet so abre via `onClick` do FAB, nunca por swipe-up), `slotProps.paper` com `maxHeight: '80vh'` (mesma convencao de `TaskDetailPanel.tsx`) e `slotProps.transition.onEntered` chamando `titleRef.current?.focus()` — mecanismo de foco que so atua **depois** da animacao de entrada terminar.
- Linhas 94-157 (formulario): `Box` com `role="dialog"`, `aria-modal="true"`, `aria-label="Captura rapida"`, `component="form"`, `onSubmit={handleSubmit}`; cabeçalho com titulo e `IconButton aria-label="Fechar"` chamando `requestClose`; `TextField` de titulo com `inputRef={titleRef}` **e** `autoFocus` (linhas 109-123, os dois mecanismos de foco coexistindo — ver Comportamento de libs); `TextField` de descricao (`multiline`, `minRows={2}`); `Select` de destino com `displayEmpty` e `inputProps={{ 'aria-label': 'Destino' }}`, populado a partir de `TARGET_LOG_OPTIONS.map(...)`; mensagem de erro inline condicional em `createItem.isError`; botao "Salvar" (`disabled={!title.trim() || createItem.isPending}`); texto de rodape "Salvo no Brain Dump ate voce processar."
- Linhas 160-171 (`Dialog` de confirmacao): `open={confirmDiscardOpen}`, titulo "Descartar item?", corpo "O titulo preenchido sera perdido.", acoes "Continuar editando" (fecha o dialogo sem descartar) e "Descartar" (`color="error"`, chama `confirmDiscard`).

**Funcoes, classes e importacoes especificas**

- `BrainDumpCaptureSheet({ open, onClose }: BrainDumpCaptureSheetProps)`: componente controlado — quem decide quando abrir/fechar e o componente pai (`BottomNav`), via as props `open`/`onClose`; o componente nunca gerencia sua propria visibilidade.
- `requestClose`/`confirmDiscard`/`handleSubmit`: as 3 funcoes que concentram toda a logica de negocio do componente; nenhuma delas depende de estado externo alem do proprio `useState` local e da mutation.
- `useCreateBrainDumpItemMutation` (de `'../api'`, Story 5.1/5.2, **sem nenhuma alteracao nesta story**): garante que toda captura do sheet — independente do destino escolhido — sempre cria um `BrainDumpItem` via `POST /api/brain-dump/items/`, nunca uma `Task` direta (Decisao Critica da story, ver arquivo da story).

**Comportamento de libs usadas**

- `@mui/material SwipeableDrawer`: variante do `Drawer` que adiciona reconhecimento de gestos de toque/ponteiro (swipe) para abrir/fechar, alem do comportamento padrao de `onClose` (Esc, backdrop) herdado do `Modal` subjacente. `disableSwipeToOpen` desliga so o swipe-**up** para abrir (o sheet e sempre aberto programaticamente pelo FAB); o swipe-**down** para fechar continua ativo e cai no mesmo `onClose={requestClose}`.
- `slotProps.transition.onEntered`: callback do componente de transicao interno do MUI (`Transition`/`Slide`), disparado quando a animacao de entrada termina — usado aqui porque o `autoFocus` nativo do `TextField` e sobrescrito pelo `FocusTrap` do `Modal` durante a propria animacao (achado real, so detectado pelo e2e contra o browser real; jsdom nao reproduz esse comportamento, por isso o teste unitario de foco so exercita o `autoFocus`).
- `@mui/material Dialog`/`DialogTitle`/`DialogActions`: modal padrao do MUI para o fluxo de confirmacao — foco preso (`FocusTrap`) e fechamento por `Esc`/backdrop chamando `() => setConfirmDiscardOpen(false)` (equivalente a "Continuar editando").
- `createItem.isPending`/`createItem.isError`/`createItem.reset()` (estado do `useMutation` do TanStack Query, via `useOptimisticMutation`): `isPending` gate tanto o `disabled` do botao Salvar quanto (apos o fix) o guard do `handleSubmit`; `isError` controla a mensagem inline; `reset()` limpa esse estado de erro ao reabrir/reenviar o formulario.

---

## 5. Frontend — barrel da feature `braindump`

### `frontend/src/features/braindump/index.ts`

**Funcao geral do arquivo**

Barrel publico do feature `braindump` — unico ponto de import permitido para outras partes do app (fronteira de ESLint).

**Funcao geral da alteracao**

Adiciona a reexportacao de `BrainDumpCaptureSheet`.

**Blocos principais**

- Linha 9: `export { BrainDumpCaptureSheet } from './components/BrainDumpCaptureSheet'` — inserido logo apos a reexportacao ja existente de `BrainDumpBadge` (linha 8).

**Funcao/papel do arquivo em relacao aos demais**

- E por este barrel que `BottomNav.tsx` importa `BrainDumpCaptureSheet` (`'../../features/braindump'`), respeitando a mesma regra de fronteira ja usada para `BrainDumpBadge` desde a Story 5.2 — nenhum import por subpath direto (`.../components/BrainDumpCaptureSheet`) e permitido fora da propria feature.

---

## 6. Frontend — wiring do FAB mobile (`BottomNav`)

### `frontend/src/app/layout/BottomNav.tsx`

**Funcao geral do arquivo**

Navegacao inferior mobile: 4 abas de rota (Hoje/Planner/Habitos/Saude) e um FAB central para captura rapida.

**Funcao geral da alteracao**

O FAB deixa de ser permanentemente `disabled` (placeholder desde a Story 5.2, que so adicionara o badge visual) e passa a ser **funcional**: habilitado por padrao, desabilitado apenas quando offline (com `Tooltip` "Sem conexao"), e abre o `BrainDumpCaptureSheet` ao ser clicado.

**Blocos principais**

- Linhas 1-2: `useState` adicionado ao import de `react`; `Tooltip` adicionado ao import de `@mui/material`.
- Linhas 11-12: `BrainDumpCaptureSheet` adicionado ao import existente de `BrainDumpBadge` (mesmo barrel); novo import `useOnlineStatus` de `'../../shared/hooks/useOnlineStatus'`.
- Linhas 28-29 (dentro de `BottomNav()`): `const isOnline = useOnlineStatus()` e `const [captureOpen, setCaptureOpen] = useState(false)` — os dois pedacos de estado que controlam, respectivamente, se o FAB esta habilitado e se o sheet esta aberto.
- Linhas 59-81: o `Fab` estatico anterior (`disabled` fixo, sem `onClick`) e substituido por um `Tooltip` envolvendo um `<span>` que envolve o `Fab`: `title={isOnline ? '' : 'Sem conexao'}`; o `Fab` ganha `aria-label` dinamico (`'Captura rapida'` ou `'Captura rapida (sem conexao)'`), `disabled={!isOnline}` e `onClick={() => setCaptureOpen(true)}`. Posicao/tamanho (`position: fixed`, `52x52`) permanecem inalterados.
- Linha 82: `<BrainDumpCaptureSheet open={captureOpen} onClose={() => setCaptureOpen(false)} />` — renderizado fora do `Tooltip`/`Fab`, como irmao, controlado pelo mesmo estado `captureOpen`.

**Funcoes, classes e importacoes especificas**

- `isOnline`/`captureOpen`: unica fonte de verdade local de dois comportamentos distintos — conectividade (derivada do hook, sem estado proprio) e visibilidade do sheet (estado proprio do `BottomNav`, que e quem "possui" o Capture Sheet neste fluxo mobile).
- `disabled={!isOnline}` no `Fab` garante estruturalmente que o Capture Sheet nunca abre offline (um `Fab disabled` nao dispara `onClick`) — nao ha guard duplicado dentro do `BrainDumpCaptureSheet` para essa condicao.

**Comportamento de libs usadas**

- `@mui/material Tooltip`: exige que o elemento filho seja capaz de receber eventos de mouse/foco para funcionar; um `Fab` com `disabled` **nao** dispara esses eventos (comportamento nativo de elementos desabilitados no DOM), entao a recipe oficial do MUI para tooltips em elementos desabilitados e envolve-los num `<span>` intermediario — e exatamente o padrao aplicado aqui (comentario explicativo nas linhas 60-62), sem o qual o tooltip nunca apareceria justamente no estado offline em que e exigido pela AC #3.

---

## 7. Frontend — testes unitarios

### `frontend/src/features/braindump/components/BrainDumpCaptureSheet.test.tsx`

**Funcao geral do arquivo**

Arquivo novo (untracked). Testes unitarios do `BrainDumpCaptureSheet`, com `client.post` mockado, `useAuth` mockado e um `QueryClientProvider` real por teste — mesmo boilerplate de `BrainDumpBadge.test.tsx`.

**Blocos principais**

- Linhas 7-19: mocks de `'../../../api/client'` (so `post`, `get`, `patch`, `delete` como `vi.fn()`) e de `'../../auth'` (`useAuth` retornando `userId: 'user-1'`).
- Linhas 26-37: helper `renderSheet(open = true)` — cria um `QueryClient` novo por chamada (`retry: false` em queries/mutations) e renderiza o componente dentro de `QueryClientProvider`.
- Linhas 44-49: `'foca o titulo automaticamente quando aberto'` — via `waitFor`, confirma `toHaveFocus()` no `textbox` "Titulo" (exercita o `autoFocus`, ja que jsdom nao dispara o `onEntered` da transicao).
- Linhas 51-69: `'expoe as 5 opcoes de destino, com "Brain Dump" como default'` — confirma o texto do combobox fechado e as 5 opcoes apos abrir (`'Brain Dump'`, `'Hoje'`, `'Esta Semana'`, `'Este Mes'`, `'Futuro'`).
- Linhas 71-90: `'submeter com titulo cria o item com o destino escolhido e chama onClose'` — escolhe "Esta Semana", clica "Salvar", confirma `client.post` chamado com `{ title, targetLog: 'week' }` e `onClose` chamado.
- Linhas 92-109 (**novo**): `'submeter com o destino default (Brain Dump) cria o item sem targetLog'` — sem escolher destino, confirma que o payload **nao** carrega `targetLog` (`expect(payload.targetLog).toBeUndefined()`) — fecha o gap do Fluxo 2 da UX (caso mais comum), ate entao so coberto pelo caso nao-default.
- Linhas 111-126 (**novo**): `'Enter no campo Titulo submete o formulario (AC #1: "Enter no ultimo campo")'` — `user.type(titulo, 'Via Enter{Enter}')` dispara o submit implicito do form, sem handler de teclado customizado.
- Linhas 128-150: `'Enter repetido durante o envio nao cria itens duplicados'` — teste de regressao do achado LOW do code review: mantem o `mockPost` pendente (`resolvePost` guardado), dispara `Enter` duas vezes seguidas com a mutation em voo, e confirma `mockPost` chamado **apenas 1 vez** — prova direta do guard `createItem.isPending` aplicado no fix.
- Linhas 152-162 (**novo**): `'botao "Fechar" (X) sem titulo fecha direto, sem dialogo de descarte (AC #2)'` — clica o `IconButton` "Fechar" (nao o `Esc`), confirma `onClose` chamado 1 vez e nenhum dialogo de descarte.
- Linhas 164-173 (**novo**): `'botao "Fechar" (X) com titulo mostra o dialogo de descarte e nao fecha ainda (AC #2)'` — mesmo botao, mas com titulo preenchido: dialogo "Descartar item?" aparece, `onClose` **nao** e chamado ainda.
- Linhas 175-224: casos ja existentes de `Esc` (sem/com titulo, "Continuar editando" mantem o titulo, "Descartar" limpa e chama `onClose`) via `fireEvent.keyDown(..., { key: 'Escape' })` no elemento com `role="dialog"`.
- Linhas 226-240: falha na mutation (`mockPost.mockRejectedValueOnce`) mostra a mensagem de erro inline e **nao** chama `onClose`; o titulo permanece preenchido (nada perdido).
- Linhas 242-248: `jest-axe` sem violacoes de acessibilidade com o sheet aberto.

**Funcoes, classes e importacoes especificas**

- `mockPost` (`client.post as ReturnType<typeof vi.fn>`): usado tanto para simular sucesso (`mockResolvedValueOnce`) quanto falha (`mockRejectedValueOnce`) e para controlar manualmente o momento de resolucao (`new Promise((resolve) => { resolvePost = resolve })`) no teste de duplo-submit.

**Comportamento de libs usadas**

- `userEvent.type(el, 'texto{Enter}')` (`@testing-library/user-event`): digita o texto caractere a caractere e, ao encontrar `{Enter}`, dispara os eventos de teclado reais (`keydown`/`keypress`/`keyup`) no elemento focado — e o que aciona o submit implicito do `<form onSubmit>`, sem precisar simular um clique no botao.
- `waitFor`/`findBy*` (`@testing-library/react`): usados apenas onde ha assincronia real (resolucao da `Promise` da mutation, abertura de dialogos) — sem waits artificiais para estados sincronos.

---

### `frontend/src/app/layout/BottomNav.test.tsx`

**Funcao geral do arquivo**

Testes do componente `BottomNav`.

**Funcao geral da alteracao**

O mock do barrel `features/braindump` (ja existente desde a Story 5.2, so com `BrainDumpBadge`) e estendido para tambem stubar `BrainDumpCaptureSheet`; o teste antigo que assumia o FAB permanentemente desabilitado e substituido por 4 testes cobrindo o novo comportamento (habilitado por padrao, desabilitado offline com `aria-label` proprio, tooltip visivel no hover offline, clique abre o sheet).

**Blocos principais**

- Linha 1: `afterEach` adicionado ao import de `vitest`.
- Linhas 8-11: mock do barrel estendido — `BrainDumpCaptureSheet: ({ open }: { open: boolean }) => (open ? <div>capture sheet aberto</div> : null)` — um stub minimo que so renderiza um marcador textual quando `open=true`, evitando depender do componente real (que exigiria `QueryClientProvider`/mocks de API neste arquivo).
- Linhas 13-18: novo helper `setNavigatorOnLine(value)` (mesma tecnica de `useOnlineStatus.test.ts` — `Object.defineProperty` com getter customizado).
- Linhas 41-45: `afterEach` do `describe('BottomNav')` restaura `navigator.onLine` para `true` apos cada teste, evitando vazamento de estado offline entre testes.
- Linhas 55-60 (**reescrito**): `test_fab_presente_e_habilitado_por_padrao` (era `test_fab_presente_e_desabilitado`) — com `navigator.onLine = true`, confirma o `Fab` de `aria-label` exato `'Captura rapida'` presente e **nao** desabilitado.
- Linhas 62-68 (**novo**): `test_fab_desabilitado_offline_com_tooltip` — com `navigator.onLine = false`, confirma o `Fab` de `aria-label` `'Captura rapida (sem conexao)'` presente e desabilitado.
- Linhas 70-82 (**novo**): `test_tooltip_sem_conexao_aparece_no_hover_offline` — offline, `user.hover(fab.parentElement)` (o `<span>` wrapper, ja que um `Fab disabled` nao dispara eventos de hover diretamente) e confirma via `screen.findByRole('tooltip')` que o texto e exatamente "Sem conexao".
- Linhas 84-91 (**novo**): `test_clicar_fab_abre_capture_sheet` — online, confirma que "capture sheet aberto" nao aparece antes do clique e aparece depois de `user.click` no FAB.

**Funcoes, classes e importacoes especificas**

- `setNavigatorOnLine`: helper local que redefine `navigator.onLine` via um getter, permitindo simular os dois estados sem depender de eventos `online`/`offline` reais (o `useOnlineStatus` real dentro do `BottomNav` le `navigator.onLine` na montagem).

**Comportamento de libs usadas**

- `userEvent.hover(el)`: dispara a sequencia de eventos de ponteiro (`pointerover`/`mouseover`/etc.) que o `Tooltip` do MUI escuta para decidir quando exibir o conteudo — usado no elemento `<span>` wrapper, nao no `Fab` disabled diretamente (mesma razao documentada em `BottomNav.tsx`).

---

### `frontend/src/app/layout/AppLayout.test.tsx`

**Funcao geral do arquivo**

Testes do `AppLayout`, que compoe `Sidebar`/`BottomNav` conforme o breakpoint (`useMediaQuery`).

**Funcao geral da alteracao**

O mock do barrel `features/braindump` (linhas 16-19) e estendido para tambem stubar `BrainDumpCaptureSheet` (mesmo stub textual do `BottomNav.test.tsx`) — sem esse ajuste, os testes mobile deste arquivo (que renderizam o `BottomNav` real) quebrariam ao importar `BrainDumpCaptureSheet` como `undefined` do barrel mockado.

**Blocos principais**

- Linhas 17-18: `BrainDumpCaptureSheet: ({ open }: { open: boolean }) => (open ? <div>capture sheet aberto</div> : null)` adicionado ao objeto retornado pelo `vi.mock`.

**Funcao/papel da mudanca**

- Ajuste puramente mecanico de mock, sem nenhuma nova asserção — mantem os testes existentes (`test_mobile_mostra_bottom_nav_oculta_sidebar`, os dois `test_sem_violacoes_de_acessibilidade`) passando com o `BottomNav` real renderizado.

---

### `frontend/src/app/layout/RouteAnnouncer.test.tsx`

**Funcao geral do arquivo**

Testes do anunciador de rota (acessibilidade), que renderiza o `router` completo (portanto `AppLayout`/`Sidebar`/`BottomNav` reais).

**Funcao geral da alteracao**

Mesmo ajuste do `AppLayout.test.tsx` — o mock do barrel `features/braindump` ganha o stub de `BrainDumpCaptureSheet`. Este arquivo **nao estava no escopo explicito das tasks da story** (que so citava `BottomNav.test.tsx`/`AppLayout.test.tsx`); foi identificado e corrigido durante o dev porque tambem renderiza o `BottomNav` real no branch mobile (registrado explicitamente nas Completion Notes da story, guardrail de File List da retro do Epico 11).

**Blocos principais**

- Linha 43: `BrainDumpCaptureSheet: ({ open }: { open: boolean }) => (open ? <div>capture sheet aberto</div> : null)` adicionado ao mock existente (que ja continha `BrainDumpBadge` desde a Story 5.2).

**Funcao/papel da mudanca**

- Mesma logica do ajuste em `AppLayout.test.tsx`: evita que o import de `BrainDumpCaptureSheet` resolva para `undefined` quando o `BottomNav` real e montado por este arquivo.

---

## 8. E2E — cobertura de regressao mobile

### `frontend/e2e/brain-dump.spec.ts`

**Funcao geral do arquivo**

Suite E2E (Playwright, browser real) do Brain Dump, rodando contra backend+frontend reais (`config.settings.e2e`), cobertura de regressao permanente desde a Story 5.1.

**Funcao geral da alteracao**

Dentro do `test.describe('badge no FAB mobile', ...)` (viewport `{ width: 390, height: 844 }` ja configurado desde a Story 5.2): (1) ajuste obrigatorio no teste existente do badge — o locator do FAB muda de `'Captura rapida (em breve)'` para `'Captura rapida'`, ja que o `aria-label` antigo deixa de existir quando o FAB fica funcional; (2) 4 testes novos exercitando o Capture Sheet real de ponta a ponta.

**Blocos principais**

- Linha 114 (ajuste, dentro do teste ja existente `'capturar um item mostra o badge no FAB...'`): `page.getByRole('button', { name: 'Captura rapida' })` (era `'Captura rapida (em breve)'`).
- Linhas 139-163 (**novo**): `'tocar o FAB abre o Capture Sheet; salvar cria um BrainDumpItem em qualquer destino e atualiza o badge (AC1)'` — toca o FAB, confirma o `textbox` "Titulo" focado, preenche titulo, escolhe destino "Esta Semana" no `combobox`/`option`, clica "Salvar"; confirma que o `dialog` "Captura rapida" some (`toHaveCount(0)`) e o badge do FAB mostra "1"; navega para `/brain-dump` e confirma que o item aparece na lista — prova de que qualquer destino ainda cria um `BrainDumpItem`, nunca uma `Task` direta.
- Linhas 165-185 (**novo**): `'salvar via Enter no Titulo captura no destino default (Brain Dump) e atualiza o badge (AC1)'` — preenche o titulo e usa `titulo.press('Enter')` **sem** escolher destino; confirma o mesmo fechamento do sheet, badge "1" e o item aparecendo em `/brain-dump` — fecha, num unico fluxo linear, os dois gaps de "Enter no ultimo campo" e "destino default sem `targetLog`".
- Linhas 187-199 (**novo**): `'Esc sem titulo fecha o Capture Sheet sem criar nada (AC2)'` — abre o sheet, confirma foco no titulo, pressiona `Escape`, confirma o `dialog` fechado e o badge continuando com a classe `MuiBadge-invisible`.
- Linhas 201-217 (**novo**): `'Esc com titulo mostra o dialogo "Descartar item?"; descartar fecha sem criar nada (AC2)'` — preenche o titulo, `Escape`, confirma o texto "Descartar item?" visivel, clica "Descartar", confirma o sheet fechado e o badge ainda invisivel.
- Linhas 219-228 (**novo**): `'offline desabilita o FAB; voltar a ficar online reabilita (AC3)'` — `page.context().setOffline(true)` confirma o FAB `toBeDisabled()`; `setOffline(false)` restaura `toBeEnabled()`.

**Funcoes, classes e importacoes especificas**

- Nenhum import novo — os testes reaproveitam os mesmos `page.getByRole(...)` semanticos ja usados nos testes pre-existentes do arquivo.

**Comportamento de libs usadas**

- `page.context().setOffline(true/false)` (Playwright): simula perda/retorno de conectividade de rede no nivel do `BrowserContext`, fazendo os eventos `offline`/`online` do navegador dispararem de fato — exercitando o `useOnlineStatus` real (nao um mock) contra o browser real, complementando os testes unitarios que simulam o mesmo evento via `window.dispatchEvent`.
- `.locator('.MuiBadge-badge')` / `toHaveClass(/MuiBadge-invisible/)`: mesma tecnica ja usada pelos testes de badge da Story 5.2 — o MUI `Badge` congela visualmente o ultimo digito exibido durante a transicao de saida, entao a verificacao correta de "sumiu" e pela classe CSS, nao pela ausencia do texto no DOM.

---

## Observacoes finais

- Nenhum arquivo de codigo-fonte foi modificado durante a producao deste relatorio; nenhum teste foi executado.
- O escopo cobrido corresponde integralmente a saida de `git status --short` no momento da analise: 10 arquivos modificados (`sprint-status.yaml`, `test-summary.md`, log de orquestracao, `brain-dump.spec.ts`, `AppLayout.test.tsx`, `BottomNav.test.tsx`, `BottomNav.tsx`, `RouteAnnouncer.test.tsx`, `BrainDumpCaptureForm.tsx`, `features/braindump/index.ts`) + 5 arquivos novos (o arquivo da story, `BrainDumpCaptureSheet.tsx` e seu teste, `useOnlineStatus.ts` e seu teste). Confirma-se **0 arquivos `backend/`** tocados, coerente com a story ser 100% frontend.
- O arquivo do proprio relatorio (este) nao foi incluido na analise, conforme a regra padrao da skill.
