---
title: 'Capture Sheet e captura persistente no sistema novo'
type: 'feature'
created: '2026-07-30'
status: 'done'
baseline_revision: '7615468f4e68d1adc9f3588275a58db57f9d7c2b'
final_revision: '1394af9729501273db46f12ac148088237910290'
review_loop_iteration: 0
followup_review_recommended: false
context: [
  '{project-root}/_bmad-output/implementation-artifacts/epic-15-context.md',
  '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/mockups/key-brain-dump.html',
]
warnings: ['oversized']
deferred:
  - summary: >-
      O gesto nativo de descartar por swipe-down (SwipeableDrawer) foi
      perdido ao migrar o Capture Sheet compact para o padrão Drawer simples.
    evidence: |-
      Mesma troca (SwipeableDrawer → Drawer simples) já feita, sem ressalva,
      em `BrainDumpItemSheet.tsx` (Story 15.1) — não é uma regressão nova
      desta story, é a segunda aplicação do mesmo padrão já aceito em review.
      X/Esc/backdrop continuam fechando normalmente; só o gesto de arrastar
      para baixo deixou de existir.
    location: 'frontend/src/features/braindump/components/BrainDumpCaptureSheet.tsx'
    severity: medium
  - summary: >-
      `shellCssVariables('light')` está fixo nos três slots de Paper novos
      (Drawer, Dialog, dialog de descarte), ignorando `theme.palette.mode`.
    evidence: |-
      Mesmo atalho já presente, sem ressalva, em `BrainDumpItemSheet.tsx`
      (Story 15.1) — usuários em dark mode veem um Capture Sheet e um dialog
      de descarte com tema claro sobre o resto da UI escura. Corrigir direito
      exigiria passar `theme.palette.mode` (ou equivalente) para dentro do
      componente, não é um ajuste de uma linha.
    location: 'frontend/src/features/braindump/components/BrainDumpCaptureSheet.tsx'
    severity: medium
  - summary: >-
      Desabilitar os campos ao ficar offline com o sheet já aberto força o
      navegador a tirar o foco do campo focado, sem recuperação de foco nem
      anúncio via `aria-live`/`role="status"` do motivo que aparece.
    evidence: |-
      Mesma lacuna já presente em `BrainDumpItemSheet.tsx` (Story 15.1) para
      o par `disabled`/`disabledReason` — comportamento herdado do padrão
      estabelecido, não introduzido por esta story.
    location: 'frontend/src/features/braindump/components/BrainDumpCaptureSheet.tsx'
    severity: low
  - summary: >-
      Offline desabilita TODOS os campos (Título/Descrição/Destino), não só
      Salvar, o que é mais restritivo do que a cópia "Esta ação exige rede."
      sugere isoladamente.
    evidence: |-
      Mesma decisão de produto já tomada em `BrainDumpInboxCaptureForm.tsx`/
      `BrainDumpItemSheet.tsx` — consistente com o resto da superfície Brain
      Dump, não uma divergência desta story.
    location: 'frontend/src/features/braindump/components/BrainDumpCaptureSheet.tsx'
    severity: low
  - summary: >-
      Campos desabilitados offline (Título/Descrição/Destino) não têm nenhum
      estilo visual de "desabilitado" (opacity/cor mais apagada) — olhando só
      pro campo, nada indica visualmente por que não dá para digitar.
    evidence: |-
      `FIELD_INPUT_STYLE` é aplicado sem variação condicional a `disabled`, e
      fixa `color`/`background` que sobrepõem o estilo nativo do browser para
      `:disabled`. Mesmo padrão inalterado, já presente em
      `BrainDumpItemSheet.tsx` (Story 15.1) para o mesmo par
      `disabled`/`FIELD_INPUT_STYLE` — não introduzido por esta story.
    location: 'frontend/src/features/braindump/components/BrainDumpCaptureSheet.tsx'
    severity: low
  - summary: >-
      Título/Descrição/Destino não ficam `disabled` durante `createItem.
      isPending`; se editados nesse intervalo, o `onSuccess` reseta e fecha
      incondicionalmente, descartando a edição feita durante o envio.
    evidence: |-
      `handleSubmit`/`content` só amarram `disabled` à prop `disabled`
      (offline), nunca a `createItem.isPending` — mesma lacuna do componente
      legado (os `TextField`/`Select` originais também não tinham `disabled`
      durante o envio), não introduzida por esta story.
    location: 'frontend/src/features/braindump/components/BrainDumpCaptureSheet.tsx'
    severity: medium
  - summary: >-
      Descartar (X/Esc/backdrop/Cancelar → "Descartar") com um save em voo
      não cancela a mutação — o item ainda é criado no servidor mesmo com o
      usuário acreditando ter descartado.
    evidence: |-
      `confirmDiscard`/`requestClose` chamam `resetFields()` → `createItem.
      reset()`, que só limpa o estado local da mutation (TanStack Query);
      não existe `AbortController`/cancelamento da requisição HTTP em voo.
      Mesma lógica, inalterada por esta story (herdada do componente legado).
    location: 'frontend/src/features/braindump/components/BrainDumpCaptureSheet.tsx'
    severity: medium
  - summary: >-
      Cruzar o breakpoint compact/ponteiro (~768px) com o sheet já aberto
      remonta o Drawer/Dialog (MUI desmonta um modal e monta o outro),
      reiniciando a transição de entrada e refocando o Título.
    evidence: |-
      `if (compact) return <Drawer>... return <Dialog>...` alterna qual
      elemento é retornado a cada render — o estado (`title`/`description`/
      `targetLog`) sobrevive porque vive no componente pai, mas o Drawer/
      Dialog em si é remontado pelo React. Introduzido por esta story (antes
      só existia uma variante, sem esse branch); sem cobertura de teste.
    location: 'frontend/src/features/braindump/components/BrainDumpCaptureSheet.tsx'
    severity: low
  - summary: >-
      `shell-a11y.spec.ts` ainda exclui todo o Capture Sheet do scan real de
      axe via o seletor `LEGACY_CAPTURE_SURFACE`, justificado historicamente
      como "dívida de conteúdo legado" — mas esta story migrou o componente
      para tokens, invalidando essa justificativa sem remover a exclusão.
    evidence: |-
      As duas células que abrem o Capture Sheet em `shell-a11y.spec.ts`
      passam `exclude: ['main', LEGACY_CAPTURE_SURFACE]` para o axe; o diff
      só renomeou o `aria-label` do gatilho nesse arquivo, sem tocar na
      exclusão. A única cobertura restante é `jest-axe` em jsdom, que este
      mesmo repo documenta (`TaskRowBase.test.tsx`) como não confiável para
      `color-contrast`/layout real — exatamente a classe de achado já
      registrada nos itens de dark mode/campo desabilitado acima. Remover a
      exclusão agora provavelmente faria esses achados já deferidos
      aparecerem como falha de CI, então precisa de uma passada coordenada,
      não uma remoção isolada.
    location: 'frontend/e2e/shell-a11y.spec.ts'
    severity: medium
---

<intent-contract>

## Intent

**Problem:** `BrainDumpCaptureSheet.tsx` (Story 5.3) é a única instância que o shell novo usa como "captura persistente" desde a Story 13.3 — o próprio código a rotula de stopgap ("superfície legada até a Onda 4 — Épico 15"). Ela não usa tokens de design, é sempre um `SwipeableDrawer` (sem variante Dialog para wide/medium/tablet) e diverge do contrato de DESIGN.md/EXPERIENCE.md/handoff-15.0: rótulo do botão, texto/posição da dica, sem "Cancelar" na variante de ponteiro, sem `aria-busy`, alvo de fechar pequeno demais.

**Approach:** Reescrever `BrainDumpCaptureSheet.tsx` no lugar com tokens de design, seguindo o padrão responsivo Dialog(ponteiro)/Drawer(compact) já estabelecido por `BrainDumpItemSheet.tsx` (15.1); ligar `ShellLayout.tsx` à variante nova (`compact`, `disabled`/`disabledReason`) e corrigir o nome acessível do FAB, hoje inconsistente com a âncora da sidebar.

## Boundaries & Constraints

**Always:**
- Preservar `{open, onClose}` e o hook de mutação (`useCreateBrainDumpItemMutation`) inalterados. `compact`/`disabled`/`disabledReason` são props NOVAS e opcionais, com `compact = true` como default — isso preserva o único consumidor que nunca vai passar essas props (`BottomNav.tsx`, mobile-only por natureza) sem tocar nesse arquivo.
- O Capture Sheet FECHA ao salvar com sucesso (sem limpar+refocar para a próxima captura) — DESIGN.md "Fluxo 3", EXPERIENCE.md e `story-15.0-brain-dump.md` §4 concordam nisso, e o handoff estabelece que DESIGN.md/EXPERIENCE.md vencem em conflito com outras leituras (ver Design Notes).
- Ordem dos campos Título → Descrição → Destino; "Brain Dump" (`''`) continua o valor padrão pré-selecionado de Destino; a dica "Fica no Brain Dump até ser processado." fica junto ao campo Destino em ambas as variantes (mockup B1/C2) — remove o texto de rodapé atual, que está com a cópia errada E no lugar errado.
- Ação primária "Salvar no Brain Dump" (pendente: "Salvando…") nas duas variantes. Ponteiro (wide/medium/tablet) ganha "Cancelar" ao lado (mockup B1); compact mantém uma única ação primária, sem Cancelar (mockup C2).
- "Cancelar" passa pela MESMA guarda de fechamento que X/Esc/backdrop (título preenchido → dialog "Descartar item?") — DESIGN.md:673, "em todas as faixas".
- A região carrega `aria-busy` enquanto a criação está pendente, além da guarda já existente de botão indisponível (handoff §6).
- Botão Fechar (×) atinge `--ds-touch-target-min` (44px).
- `aria-label` do FAB em `ShellLayout.tsx` vira "Abrir captura rápida"/"Abrir captura rápida (sem conexão)", igualando `ShellSidebar.tsx` e o contrato de nome acessível do handoff §7.
- Reusar `shellCssVariables('light')` no slot do Paper/Drawer (mesma técnica de `BrainDumpItemSheet.tsx` para portais) e `TARGET_LOG_OPTIONS` (vocabulário único, sem duplicar).
- Toda cor/geometria nova via `var(--ds-*)` (`shared/design/tokens.ts`), nunca cor de tema MUI crua.

**Block If:**
- Existir, no momento da implementação, algum importador de `BrainDumpCaptureSheet` além de `ShellLayout.tsx` e `BottomNav.tsx` (checado limpo nesta investigação) — pare e decida se o default `compact = true` ainda preserva o comportamento desse consumidor novo antes de prosseguir.

**Never:**
- Alterar `AppLayout.tsx`, `Sidebar.tsx` ou `BottomNav.tsx` (shell legado, hoje inalcançável — toda rota é `shell: 'new'` em `shellRouting.ts` — caminho de rollback congelado). Os defaults das props novas devem manter `BrainDumpCaptureSheet` compilando e se comportando como hoje para `BottomNav.tsx`, sem editar esse arquivo.
- Alterar a âncora de captura do `ShellSidebar.tsx`, `BrainDumpBadge.tsx`, ou os tokens de tamanho/ícone/posição do FAB — já corretos desde a Story 13.3; só o `aria-label` do FAB em `ShellLayout.tsx` muda.
- Introduzir estado novo de cliente ou nova query key para a captura — a contagem continua fluindo por `['brainDump','count',userId]`, via a mutação otimista já existente.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Abrir em wide/medium/tablet | clique na âncora da sidebar "Abrir captura rápida" | Dialog ~400px abre sem navegar, foco no Título, "Cancelar" visível ao lado de "Salvar no Brain Dump" | — |
| Abrir em compact | tap no FAB "Abrir captura rápida" | Sheet sobe do fundo (até 80vh), foco no Título, sem "Cancelar" | — |
| Salvar (clique ou Enter no Título) | título preenchido | cria item no destino escolhido (ou Brain Dump default), sheet fecha, foco volta ao acionador, indicador de pendências sobe | Enter/clique repetido durante pending não duplica (botão indisponível + `aria-busy`) |
| Cancelar sem alteração (só ponteiro) | título vazio | fecha direto, sem dialog | — |
| Fechar com título preenchido (X, Esc, backdrop ou Cancelar) | qualquer variante | dialog "Descartar item?"; Descartar limpa e fecha; Continuar editando mantém o rascunho | — |
| Falha de escrita | Salvar, servidor erra | sheet permanece aberto, campos preservados, erro inline junto à ação | retry manual (reenviar) |
| Offline com o sheet já aberto | perde conexão durante o uso | campos e ação de salvar ficam indisponíveis, motivo acessível junto ao Salvar | — |

</intent-contract>

## Code Map

- `frontend/src/features/braindump/components/BrainDumpCaptureSheet.tsx` -- reescrever com tokens de design + variante responsiva Dialog(ponteiro, ~400px)/Drawer(compact, 80vh), no padrão de `BrainDumpItemSheet.tsx` (`compact` prop, `shellCssVariables('light')` em `slotProps.paper.style`, inputs brutos com um `FIELD_INPUT_STYLE` local); props novas opcionais `compact = true`, `disabled = false`, `disabledReason?: string`; botão primário "Salvar no Brain Dump"/"Salvando…", "Cancelar" só no ponteiro, dica junto ao campo Destino, `aria-busy` na região durante `isPending`, Fechar com `--ds-touch-target-min`.
- `frontend/src/features/braindump/components/BrainDumpCaptureSheet.test.tsx` -- reescrever cobrindo as DUAS variantes (compact/Drawer default e `compact={false}`/Dialog), Cancelar, `aria-busy`, `disabled`/`disabledReason`, cópia nova, alvo de 44px do Fechar -- lição já custada na 15.1 (variante compact do seletor de destino ficou sem teste na 1ª passada de review).
- `frontend/src/features/braindump/components/BrainDumpItemSheet.tsx` -- só ler: referência de padrão (Drawer/Dialog responsivo, `shellCssVariables`, `FIELD_INPUT_STYLE`, footer com `--ds-primary`/`--ds-on-primary`).
- `frontend/src/features/braindump/components/BrainDumpCaptureForm.tsx` -- só ler: `TARGET_LOG_OPTIONS` (fonte única do vocabulário; `{value: '', label: 'Brain Dump'}` já é o default, sem mudança).
- `frontend/src/features/braindump/api.ts` -- só ler: `useCreateBrainDumpItemMutation` (contrato inalterado: `{title, description?, targetLog?}`, otimista sobre a contagem).
- `frontend/src/app/layout/shell/ShellLayout.tsx` -- `<BrainDumpCaptureSheet>` (L276) ganha `compact={isCompact}` `disabled={!isOnline}` `disabledReason={...}`; FAB (L226-268) `aria-label` troca "Captura rápida"/"Captura rápida (sem conexão)" (L237) → "Abrir captura rápida"/"Abrir captura rápida (sem conexão)" (paridade com `ShellSidebar.tsx:205` e handoff §7).
- `frontend/src/app/layout/shell/ShellLayout.test.tsx:151,164` -- ajustar as duas asserções que hoje buscam `getByRole('button', { name: 'Captura rápida' })` para "Abrir captura rápida" (a L166 já espera esse nome para a âncora da sidebar — só o FAB está desalinhado).
- `frontend/src/app/layout/shell/ShellSidebar.tsx` -- só ler: `onOpenCapture`, `captureLabel` (L205, já corretos -- referência da string alvo).
- `frontend/src/pages/braindump/BrainDumpInboxPage.tsx:35` -- só ler: `OFFLINE_REASON = 'Sem conexão. Esta ação exige rede.'` (constante a replicar em `ShellLayout.tsx`).
- `frontend/src/app/layout/BottomNav.tsx` -- só ler, NÃO alterar: consumidor legado que não passa as props novas; depende do default `compact = true` para manter seu comportamento atual.
- `frontend/e2e/brain-dump.spec.ts` -- `describe('badge no FAB mobile', ...)` (L116-241): atualizar o nome acessível do FAB em todas as ocorrências (L127,155,181,201,217,233 → "Abrir captura rápida"/variante offline) e do botão de salvar (L165, "Salvar" → "Salvar no Brain Dump"); adicionar um teste novo no viewport desktop padrão do projeto cobrindo a variante de ponteiro (Dialog) via âncora da sidebar -- hoje só a variante compact tem e2e.

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/features/braindump/components/BrainDumpCaptureSheet.tsx` -- reescrever com tokens + variante Dialog/Drawer responsiva -- fecha a paridade visual/token de DESIGN.md:673.
- [x] `frontend/src/features/braindump/components/BrainDumpCaptureSheet.test.tsx` -- reescrever cobrindo as duas variantes, Cancelar, `aria-busy`, offline -- fecha a I/O Matrix.
- [x] `frontend/src/app/layout/shell/ShellLayout.tsx` -- `compact`/`disabled`/`disabledReason` na instância única + correção do `aria-label` do FAB -- ativa a variante nova e resolve a divergência de nome acessível.
- [x] `frontend/src/app/layout/shell/ShellLayout.test.tsx` -- ajustar as 2 asserções afetadas pelo `aria-label` novo do FAB.
- [x] `frontend/e2e/brain-dump.spec.ts` -- atualizar locators existentes da variante compact + adicionar cobertura e2e da variante de ponteiro -- fecha o gap: hoje zero e2e cobre o Dialog.

**Acceptance Criteria:**
- [x] Given qualquer rota, when Hugo aciona a captura persistente do shell (âncora na navegação em wide/medium/tablet, FAB no compact), then o Capture Sheet abre sem navegar, com foco no Título, na variante Dialog (~400px, com Cancelar) ou Sheet (sem Cancelar) conforme a faixa.
- [x] Given o Capture Sheet aberto com título preenchido, when Hugo salva (clique ou Enter), then o item é criado no destino escolhido (ou Brain Dump default), o sheet fecha, o foco volta ao acionador na rota onde Hugo estava, e o indicador de pendências sobe.
- [x] Given o Capture Sheet aberto com texto no Título, when Hugo fecha por qualquer caminho (X, Esc, backdrop, Cancelar), then "Descartar item?" abre antes de perder o rascunho, em todas as faixas.
- [x] Given o `BrainDumpCaptureSheet` renderizado sem as props novas (consumidor legado `BottomNav.tsx`), when a captura é acionada, then o comportamento atual (sheet único, sempre no formato compact) permanece inalterado.

## Spec Change Log

- O Code Map previa reescrever `BrainDumpCaptureSheet.tsx` no padrão de `BrainDumpItemSheet.tsx`, que usa `<select>` NATIVO (não a MUI `<Select>` que o componente legado usava) — consequência direta disso, não coberta explicitamente pela lista de locators do Code Map: `frontend/e2e/brain-dump.spec.ts` linhas 163-164 (interação com o campo Destino do Capture Sheet) trocaram de clique+opção (API da MUI `<Select>`) para `.selectOption('week')` (API de `<select>` nativo), mesmo padrão já usado por `brain-dump-inbox.spec.ts:30` contra `BrainDumpItemSheet`. Sem essa troca o e2e quebraria contra o componente reescrito.
- `frontend/src/app/layout/shell/ShellLayout.test.tsx` — o teste `test_desktop_nao_tem_fab_mas_a_ancora_da_sidebar_abre_o_mesmo_sheet` tinha uma asserção negativa (`queryByRole('button', {name: 'Captura rápida'})).not.toBeInTheDocument()`) provando "sem FAB". Como a correção do `aria-label` do FAB (`Boundaries & Constraints`) faz FAB e âncora da sidebar convergirem para o MESMO nome acessível ("Abrir captura rápida"), a asserção precisou virar uma contagem (`toHaveLength(1)`) — o nome agora existe (é a âncora), então "zero" deixou de ser a prova correta de "sem FAB duplicado".

Ambos os ajustes são consequência mecânica das mudanças descritas no Code Map/Boundaries, não mudança de escopo.

## Review Triage Log

### 2026-07-30 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 4 (high 1, medium 3, low 0)
- defer: 4 (high 0, medium 2, low 2)
- reject: 5
- addressed_findings:
  - `[high]` `[patch]` O rename do `aria-label` do FAB ("Captura rápida" → "Abrir captura rápida") não tinha sido propagado para 4 specs e2e pré-existentes que localizavam o mesmo FAB pelo nome antigo (`shell-a11y.spec.ts`, `shell-bottomnav.spec.ts`, `shell-keyboard.spec.ts`, `shell-states.spec.ts`, algumas com `exact: true`/igualdade literal). Corrigido: locators atualizados nesses 4 arquivos, espelhando o que já tinha sido feito em `ShellLayout.test.tsx`/`brain-dump.spec.ts`.
  - `[medium]` `[patch]` O mock de `BrainDumpCaptureSheet` em `ShellLayout.test.tsx` descartava `compact`/`disabled`/`disabledReason`, então nenhum teste verificava que `ShellLayout` calcula/repassa esses valores corretamente a partir de `isCompact`/`isOnline`. Corrigido: mock estendido para expor as 3 props; testes novos cobrindo `compact` por breakpoint e `disabled`/`disabledReason` alternando online/offline.
  - `[medium]` `[patch]` A variante compact (Drawer) perdeu `aria-modal="true"` que o componente legado tinha no `role="dialog"` do conteúdo — só a variante Dialog (ponteiro) comunicava semântica de modal. Corrigido: `aria-modal: true` adicionado ao spread compact; teste existente de role/nome estendido para also verificar `aria-modal`.
  - `[medium]` `[patch]` O rodapé da variante ponteiro usava `flexDirection: 'row-reverse'`, renderizando "Cancelar" visualmente antes de "Salvar no Brain Dump" — diverge do mockup (`key-brain-dump.html` B1: primário à esquerda, secundário à direita, sem reversão) e cria descompasso entre ordem visual e ordem de tabulação. Corrigido: `row-reverse` → `row`; ordem do DOM (Salvar, Cancelar) já batia com a ordem visual desejada.

### 2026-07-30 — Review pass (follow-up)
- intent_gap: 0
- bad_spec: 0
- patch: 3 (high 1, medium 1, low 1)
- defer: 1 (high 0, medium 0, low 1)
- reject: 16 (high 0, medium 0, low 16)
- addressed_findings:
  - `[high]` `[patch]` O rename do `aria-label` do FAB ("Captura rápida" → "Abrir captura rápida") não tinha sido propagado inteiramente para `frontend/e2e/shell-bottomnav.spec.ts`: 3 locators (linhas 198, 286, 536) ainda buscavam o nome antigo e só continuavam passando por coincidência (Playwright faz match por substring quando `exact` não é `true`, e "captura rápida" é substring de "abrir captura rápida"); 2 asserções (linhas 590, 714) usavam `exact: true` com o nome antigo dentro de um `toHaveCount(0)`, o que virou uma prova vazia após o rename — nenhum botão tem mais esse nome exato, então a asserção sempre passaria mesmo que um FAB duplicado aparecesse com o nome novo. Corrigido: as 3 primeiras atualizadas para "Abrir captura rápida"; as 2 últimas convertidas para `toHaveCount(1)` (provando que só a âncora existe, sem FAB duplicado) — mesmo padrão de correção já usado em `ShellLayout.test.tsx` desde a passada de review anterior (ver Spec Change Log).
  - `[medium]` `[patch]` `aria-busy` durante o envio só tinha teste (e só coincidia com o próprio nó `role="dialog"`) na variante compact — no Dialog do ponteiro, o MUI estampa `role="dialog"` no Paper via `slotProps.paper`, um nó diferente do `<form>` interno que carregava `aria-busy`, então o elemento que assistive tech reconhece como "o dialog" nunca sinalizava ocupado para usuários de wide/medium/tablet durante o salvamento. Corrigido: `aria-busy` adicionado também a `slotProps.paper` do Dialog; teste novo cobrindo a variante ponteiro.
  - `[low]` `[patch]` `offlineId` era uma string literal fixa (não `useId()`), divergindo do padrão já usado em `BrainDumpItemSheet.tsx` (que deriva o id por instância via `idPrefix`) — risco latente de colisão de `id` no DOM se este componente algum dia renderizar mais de uma instância simultânea. Corrigido: trocado para `useId()`.

### 2026-07-30 — Review pass (follow-up 2)
- intent_gap: 0
- bad_spec: 0
- patch: 2 (high 0, medium 0, low 2)
- defer: 4 (high 0, medium 3, low 1)
- reject: 10 (high 0, medium 0, low 10)
- addressed_findings:
  - `[low]` `[patch]` A AC "o foco volta ao acionador" (Tasks & Acceptance item 2) não tinha nenhuma asserção em nenhuma camada de teste — grep por `toBeFocused()` em todos os specs tocados pela story não encontrou nenhuma checagem do FAB/âncora após salvar. Corrigido: `frontend/e2e/brain-dump.spec.ts` ganhou `await expect(fab).toBeFocused()`/`await expect(anchor).toBeFocused()` nos dois testes de "salvar" (FAB compact e âncora ponteiro), logo após o sheet fechar; ambos passaram de primeira (restauração de foco padrão do `Modal` do MUI, já funcionava — só faltava a prova).
  - `[low]` `[patch]` O describe block `fechar e descartar (guarda comum a X/Esc/backdrop/Cancelar)` prometia cobertura de backdrop no próprio nome, mas nenhum teste do arquivo clicava no backdrop — só Fechar(×) e Esc. Corrigido: 3 testes novos em `BrainDumpCaptureSheet.test.tsx` (`document.querySelector('.MuiBackdrop-root')` + clique, já que o Modal do MUI monta via portal fora do `container` do RTL) cobrindo backdrop sem título (fecha direto) e com título (dialog "Descartar item?") nas duas variantes; todos passaram de primeira (mesma guarda `requestClose`, comportamento já correto).
- Achados novos registrados em `deferred` (frontmatter): (1) campos não ficam `disabled` durante `createItem.isPending` e o `onSuccess` reseta/fecha incondicionalmente, descartando edição feita durante o envio anterior; (2) descartar com um save em voo não cancela a mutação — `createItem.reset()` só limpa estado local, o POST em andamento ainda cria o item no servidor; (3) cruzar o breakpoint compact/ponteiro (~768px) com o sheet aberto remonta o Drawer/Dialog (retransição + refoco do Título), sem perda de dados (o estado vive no componente pai) mas sem cobertura; (4) `shell-a11y.spec.ts` ainda exclui todo o Capture Sheet do scan real de axe via `LEGACY_CAPTURE_SURFACE` — justificativa histórica ("dívida de conteúdo legado") que esta própria story invalida ao migrar o componente para tokens, deixando a única cobertura real de WCAG fora do alcance do gate; os itens (1) e (2) já existiam no componente legado (lógica de `requestClose`/`handleSubmit` inalterada por esta story), (3) é novo (introduzido pela variante responsiva desta story), (4) é exposto por esta story mas por si não é motivo para reverter a migração.
- Rejeitados (10, todos ruído): 5 duplicatas de itens já registrados em `deferred` (dark mode fixo em `light`, swipe-to-dismiss perdido — achado por 2 reviewers independentes —, perda de foco offline sem `aria-live`, offline desabilita todos os campos, campos desabilitados sem estilo visual); `aria-label="Captura rápida"` repetido como 3 literais em vez de `aria-labelledby` (risco de manutenção, sem bug atual); `OFFLINE_REASON` duplicado entre `ShellLayout.tsx`/`BrainDumpInboxPage.tsx`/`BrainDumpItemSheet.tsx` (o próprio Code Map da spec instruiu replicar a constante, mesmo padrão da 15.1); nome acessível compartilhado do FAB/âncora ter tornado a prova de "sem FAB duplicado" `toHaveCount(1)` em vez de `toHaveCount(0)` (tradeoff já revisto e aceito nas 2 passadas anteriores); `disabled` sem `disabledReason` deixar o Salvar sem motivo acessível (inatingível — o único chamador sempre passa os dois juntos); inconsistência entre `status`/`Auto Run Result` observada no início desta passada (artefato do próprio processo de review, não do código).
- Verificação desta passada: `cd frontend && npx tsc --noEmit && npx eslint .` limpos; `npx vitest run src/features/braindump/components/BrainDumpCaptureSheet.test.tsx src/app/layout/shell/ShellLayout.test.tsx src/app/layout/BottomNav.test.tsx` 63/63 (60 pré-existentes + 3 novos de backdrop); `CI=1 npx playwright test brain-dump.spec.ts` 13/13 (inclui as 2 novas asserções de foco).

## Design Notes

**Precedência de documentos (fechamento vs. limpeza-e-refoco):** `epic-15-context.md` cita "after capture, Título clears and refocuses for the next entry" para o Capture Sheet, mas essa frase descreve o formulário de captura DA PÁGINA Inbox (`BrainDumpInboxCaptureForm`, 15.1), não o Capture Sheet do shell. Três fontes independentes concordam que o Capture Sheet **fecha** ao salvar: DESIGN.md "Fluxo 3" ("Salva; o sheet fecha, o indicador do Brain Dump aumenta e o foco volta ao acionador"), `story-15.0-brain-dump.md` §4 ("Se salva, o foco também volta ao acionador porque a rota não muda") e `traceability.md`. O próprio handoff estabelece que, em conflito, DESIGN.md e EXPERIENCE.md vencem — e `epic-15-context.md` é um digest auto-compilado dessas mesmas fontes ("Generated from planning artifacts"), não uma autoridade paralela. O comportamento atual do componente legado (`onSuccess: resetFields(); onClose()`) já fecha, então nenhuma mudança de comportamento é necessária aqui — só a leitura do epic context precisa ser desconsiderada nesse ponto específico.

**`compact = true` como default:** proposital, não arbitrário — preserva o único consumidor que nunca vai passar a prop (`BottomNav.tsx`, mobile-only por natureza da bottom nav) sem tocar nesse arquivo congelado; `ShellLayout.tsx` passa `compact={isCompact}` explicitamente por ser o único chamador que precisa alternar entre as duas variantes.

## Verification

**Commands:**
- `cd frontend && npx tsc --noEmit && npx eslint . && npx vitest run src/features/braindump/components/BrainDumpCaptureSheet.test.tsx src/app/layout/shell/ShellLayout.test.tsx src/app/layout/BottomNav.test.tsx` -- expected: sem erro de tipo/lint; testes novos e existentes passam (jest-axe incluso), `BottomNav.test.tsx` continua verde sem alteração.
- `cd frontend && npx playwright test brain-dump.spec.ts` -- expected: verde, incluindo a cobertura nova da variante de ponteiro.

**Manual checks (if no CLI):**
- Abrir `/today` em wide e em compact, acionar a captura pela âncora/FAB, conferir Dialog ~400px com Cancelar vs. Sheet sem Cancelar, dica junto ao Destino, botão "Salvar no Brain Dump", e foco retornando ao acionador após salvar/cancelar.

## Auto Run Result

**Resumo:** Segunda passada de review de acompanhamento (follow-up 2, disparada por `followup_review_recommended: true` da passada anterior) sobre o diff completo da story desde `baseline_revision`. Sem mudança de escopo/intenção: 2 achados `patch` corrigidos — ambos lacunas de verificação (comportamento já correto, faltava a prova, confirmado pelos testes passando de primeira) —, 4 novos itens deferidos, 0 `intent_gap`/`bad_spec`.

**Arquivos alterados nesta passada:**
- `frontend/e2e/brain-dump.spec.ts` — `await expect(fab).toBeFocused()`/`await expect(anchor).toBeFocused()` nos dois testes de "salvar" (FAB compact e âncora ponteiro), provando a AC "o foco volta ao acionador" que nenhum teste da story verificava.
- `frontend/src/features/braindump/components/BrainDumpCaptureSheet.test.tsx` — 3 testes novos de clique no backdrop (`document.querySelector('.MuiBackdrop-root')`, já que o Modal do MUI monta via portal fora do `container` do RTL): sem título fecha direto, com título abre "Descartar item?" (compact), e a mesma paridade na variante ponteiro (Dialog).

**Review — achados desta passada (2026-07-30, follow-up 2):**
- 2 `patch` (0 high, 0 medium, 2 low) — ambos corrigidos nesta execução (ver Review Triage Log).
- 4 `defer` (0 high, 3 medium, 1 low) — dois pré-existentes no componente legado (campos não `disabled` durante `isPending`; descartar não cancela o save em voo), um novo introduzido por esta story (remount ao cruzar o breakpoint compact/ponteiro com o sheet aberto) e um exposto por esta story (exclusão `LEGACY_CAPTURE_SURFACE` do axe em `shell-a11y.spec.ts` que a própria migração para tokens invalida). Registrados no frontmatter `deferred`.
- 10 `reject` — 5 duplicatas de itens já deferidos (dark mode, swipe-to-dismiss, foco/aria-live offline, offline desabilita todos os campos, estilo visual de disabled), mais achados sem consequência real hoje (aria-label triplicado sem bug atual, duplicação de `OFFLINE_REASON` que a própria spec mandou replicar, tradeoff já revisto 2x do nome acessível compartilhado FAB/âncora, `disabled` sem `disabledReason` inatingível com o único chamador atual, e a inconsistência de status/Auto Run Result observada no início desta passada — artefato do processo de review, não do código).
- 0 `intent_gap`, 0 `bad_spec`.

**Recomendação de nova revisão:** `false` — os 2 patches desta passada são `low` (verificação de comportamento que já funcionava; nenhum código de produção mudou, só os testes). `3×0 medium + 1×2 low = 2`, abaixo do limiar de 5.

**Verificação realizada (sobre o diff completo desde `baseline_revision`):**
- `cd frontend && npx tsc --noEmit && npx eslint .` — limpos.
- `cd frontend && npx vitest run src/features/braindump/components/BrainDumpCaptureSheet.test.tsx src/app/layout/shell/ShellLayout.test.tsx src/app/layout/BottomNav.test.tsx` — 63/63 passando (60 pré-existentes + 3 novos de backdrop).
- `cd frontend && CI=1 npx playwright test brain-dump.spec.ts` — 13/13 passando (inclui as 2 novas asserções de foco pós-salvar).

**Riscos residuais:**
- Os 9 itens agora em `deferred` (5 da passada anterior + 4 desta) permanecem sem correção de código — nenhum bloqueia a funcionalidade principal. Os dois de maior atenção futura: (1) descartar com um save em voo não cancela a mutação (o item é criado mesmo assim), e (2) a exclusão de axe em `shell-a11y.spec.ts` deixa a superfície migrada sem cobertura real de WCAG — os dois merecem uma passada dedicada, o segundo idealmente junto com os achados de dark mode/contraste já deferidos (removê-lo isolado provavelmente falharia CI contra achados já conhecidos).
- Com `followup_review_recommended: false`, o ciclo de review desta story se estabiliza aqui — encerramento normal via HALT `done`.

