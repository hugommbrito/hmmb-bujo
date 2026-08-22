---
baseline_commit: d14e366a2fedee838a0b25fac1c55ae74c48726e
---

# Story 13.3: Bottom-nav e captura persistente mobile

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero a navegação mobile do sistema novo (top bar + bottom nav + captura persistente),
Para que o fluxo diário mobile continue completo, sem scroll horizontal (NFR-1, UX-DR22).

## Acceptance Criteria

1. **Bottom nav nova no shell; legados intocados; sem Query direto no chrome**

   **Dado que** o `ShellLayout` (13.1) hoje renderiza a `BottomNav` legada no compact,
   **Quando** a navegação mobile do shell novo é implementada,
   **Então** existe um componente **novo** `frontend/src/app/layout/shell/ShellBottomNav.tsx` que o `ShellLayout` renderiza no compact no lugar da `BottomNav` legada, e `BottomNav.tsx`/`Sidebar.tsx`/`AppLayout.tsx` legados **permanecem intocados** como rota de rollback,
   **E** nenhum componente do shell consome TanStack Query **direto**: contagem entra só pelo `BrainDumpBadge` e a captura só pelo `BrainDumpCaptureSheet`, ambos via barrel `features/braindump`. A **única mudança contratada nos testes compartilhados** é adicionar o stub `BrainDumpCaptureSheet` ao mock do barrel em `router.test.tsx` (que hoje só fornece `BrainDumpBadge` — `AppLayout.test.tsx`/`RouteAnnouncer.test.tsx` já têm o stub) e ao mock de `ShellSidebar.test.tsx`; **nenhum** `QueryClientProvider` novo nesses testes.

2. **Três atalhos derivados + Menu fixo; só destinos implementados**

   **Dado que** o contrato de `{components.app-shell.bottom-nav-configurable-items}` = **3** destinos dinâmicos + quarto item fixo **Menu** (a spec da 13.0 refina o "até 4 destinos" do epics),
   **Quando** a bottom nav monta seus itens,
   **Então** os 3 atalhos vêm de uma **derivação pura** da lista de destinos disponíveis (núcleo hardcoded + collections do registro filtrado — mesma fonte da `ShellSidebar`): sem preferência salva (a UI de Configurações → Navegação mobile é a **18.1**), valem **os três primeiros destinos disponíveis na ordem canônica, sem duplicatas** → hoje **Hoje, Esta Semana, Este Mês** (não copiar o exemplo do mockup, que mostra uma configuração do Fluxo 8),
   **E** só destinos implementados aparecem (módulos futuros **nunca** aparecem desabilitados); a derivação tolera zero/uma collection por construção (filtrar a lista, não hardcodar),
   **E** o atalho ativo casa a rota por prefixo do próprio destino (path exato ou `path + '/'`, como `containsRoute` da `ShellSidebar`); quando a rota atual não está entre os 3 atalhos, **Menu aparece selecionado**.

3. **Menu abre o sheet de navegação completa (conteúdo canônico)**

   **Dado que** `{components.mobile-navigation-sheet}` (high-sheet, `surface`, backdrop `overlay`, `radius-top {rounded.lg}` = **8px** — o token vence os 12px do markup do mockup),
   **Quando** o item fixo **Menu** (ícone `list`) é acionado,
   **Então** abre um sheet alto com backdrop, alça, header com "Navegação" + botão **Fechar** (≥44px) e rolagem interna, que **termina acima da bottom nav/safe-area**,
   **E** o sheet lista **todos** os destinos disponíveis — inclusive os 3 atalhos — na **ordem e agrupamentos canônicos da `ShellSidebar`** (Hoje → Planner[Esta Semana→Este Mês→Futuro→Recorrentes] → Hábitos → Saúde[Métricas→Medicamentos] → Gratidão → Brain Dump → Arquivo → Configurações; a ordem do markup do mockup **não** é canônica — os spines vencem), com badge do Brain Dump, destino ativo com `aria-current="page"` + múltiplos canais, e agrupadores com `aria-expanded` (nunca `aria-current`).

4. **Comportamento acessível do sheet**

   **Dado que** o Accessibility Floor e o padrão Mobile Navigation Sheet do EXPERIENCE.md,
   **Quando** o sheet abre/fecha,
   **Então** o **foco inicial vai ao destino ativo** (nunca ao Fechar — rejeitado na 13.0), `Tab` fica contido, o conteúdo inferior fica inerte, e fecha por **Fechar, backdrop, `Escape` ou arrastar para baixo**,
   **E** ao fechar **sem navegar** o foco retorna ao item **Menu**; ao navegar, o sheet fecha e o anúncio de rota segue exclusivo do `RouteAnnouncer`,
   **E** landmarks: bottom nav = `nav` **"Atalhos de navegação"**, sheet = `nav` **"Navegação completa"** (a `nav` "Navegação mobile" era da `BottomNav` legada — a troca de nome é contratada e os asserts existentes que a citam são atualizados de propósito).

5. **Captura persistente: FAB no compact + âncora na navegação em desktop/tablet**

   **Dado que** `{components.capture-action}` (ícone `note-pencil`, `desktop-anchor: navigation`, `mobile-size: 52px`, radius `full`) e a decisão Captura A da 13.0,
   **Quando** o controle de captura é implementado,
   **Então** no **compact** existe um FAB circular de `var(--ds-capture-fab-size)` no canto inferior direito, **fora da bottom nav**, acima dela e da safe-area (paridade FAB-01: `calc(bottom-nav + safe-area + 16px)`), e no **desktop/medium/tablet** a `ShellSidebar` ganha a âncora **"Abrir captura rápida"** ao fim da navegação (spacer + botão com borda `{components.interactive-control}`): nominal expandida, icon-only no rail preservando o nome acessível,
   **E** ambos permanecem **sempre visíveis**, carregam o `BrainDumpBadge` (com `max={9}` e `badgeSx` do shell, padrão da 13.2; cápsula ligada ao ícone sem cobrir o pictograma) e abrem o **`BrainDumpCaptureSheet` existente** (a superfície de captura permanece legada até a Onda 4 — Épico 15); uma **única instância** do sheet no shell.

6. **Offline: indisponível com motivo acessível, identidade e foco preservados**

   **Dado que** UX-DR15 e o contrato novo do DESIGN.md ("Offline usa superfície e tinta disabled, **preservando identidade, foco e motivo acessível**; falha do contador não altera a disponibilidade"),
   **Quando** `useOnlineStatus()` reporta offline,
   **Então** FAB e âncora ficam indisponíveis com superfície/tinta disabled **permanecendo focáveis** (`aria-disabled="true"` + guard no `onClick` — **divergência contratada** vs `disabled` nativo do legado FAB-03; registrar no checklist) e com motivo acessível (aria-label "Captura rápida (sem conexão)" e/ou tooltip "Sem conexão" — paridade FAB-02),
   **E** falha/loading do contador do badge **não** bloqueia nem desabilita a captura, e navegação segue funcional.

7. **Tokens, catálogo e geometria — zero literais estruturais**

   **Dado que** o contrato de tokens do shell (13.1),
   **Quando** os componentes novos renderizam,
   **Então** toda geometria vem de `var(--ds-*)`: o token `bottomNavHeight` sobe de `56px` (altura do MUI legado) para **`64px`** (contrato do mockup aprovado — o comentário em `tokens.ts` já prevê esta troca na 13.3), e `pb`/`scroll-padding` do `ShellLayout` continuam corretos por referenciarem o token,
   **E** ícones **só** do catálogo Phosphor fechado via `navIcons` (+ `note-pencil` e `list` novos; nenhum `@mui/icons-material` nos componentes do shell — fecha a parte da DIV-5 da bottom nav), touch targets ≥44px (itens frequentes da bottom nav ≥48px — a altura de 64px cobre), e **nenhum scroll horizontal** no fluxo mobile (reflow 320 CSS px sem perda de conteúdo/ação).

8. **Paridade, checklist e nenhuma regressão**

   **Dado que** a checklist enumerada `13-shell-parity-checklist.md`,
   **Quando** esta story fecha,
   **Então** os itens `BN-01…BN-06`, `FAB-01…FAB-05` e as divergências `DIV-2` (4 fixos → 3+Menu) e `DIV-5` (parte bottom nav) são marcados **resolvidos** (ou com divergência registrada), a dívida **SHELL-DEBT-01** é fechada — a bottom nav nova **entra no gate axe compact** (remover `nav[aria-label="Navegação mobile"]` do `exclude` de `shell-a11y.spec.ts` e garantir contraste do label não-selecionado),
   **E** a suíte Vitest completa segue verde (colar contagem literal; derivar herdados/novos pelo diff), `typecheck`/`lint` limpos (boundary do ESLint), e a suíte E2E dos specs do shell segue verde incluindo os cenários novos de bottom nav/sheet/captura.

## Tasks / Subtasks

- [x] **1. Extrair a derivação de destinos para módulo puro compartilhado** (AC: 2, 3)
  - [x] Criar `frontend/src/app/layout/shell/shellDestinations.ts` — **dados puros/funções puras** (sem React, sem hooks, sem Query; mesmo espírito de `shellRouting.ts`/AD-17): núcleo hardcoded (`Hoje`, grupo `Planner` + 4 filhos, `Brain Dump`, `Arquivo`, `Configurações`) + derivação das collections (avulsas + grupo `saude` por `nav.order`) a partir de uma lista de `CollectionManifestEntry` (default = registro).
  - [x] Expor: (a) a **estrutura canônica agrupada** (para sidebar e sheet) e (b) a **lista achatada de destinos navegáveis na ordem canônica** (para os atalhos da bottom nav). Marcar o destino `brain-dump` como portador de badge.
  - [x] Derivar os **3 atalhos default**: `flatDestinations.slice(0, 3)` da lista achatada (sem preferência = três primeiros disponíveis, sem duplicatas — EXPERIENCE §App Shell, aparência e atalhos). Assinatura pronta para receber preferência no futuro (18.1), sem implementá-la.
  - [x] Refatorar `ShellSidebar.tsx` para consumir este módulo **sem mudar nenhum comportamento/markup** (as constantes `TODAY`/`PLANNER_CHILDREN`/etc. migram para lá; `ShellSidebar.test.tsx` precisa continuar verde **sem alteração de asserts** — é o detector de regressão da refatoração; a prop-seam `collections` continua funcionando).

- [x] **2. Ícones novos no catálogo (`navIcons`)** (AC: 5, 7)
  - [x] Adicionar as chaves `capture` → `NotePencil` (`note-pencil`) e `menu` → `List` (`list`) ao `navIcons.tsx`, conforme catálogo fechado (escopo 13.3 na tabela da 13.2).
  - [x] **Colisão de nome:** o MUI exporta `List` (componente de lista) e o Phosphor também (`ícone list`) — importar com alias (`import { List as ListIcon } from '@phosphor-icons/react'`) dentro do `navIcons.tsx`; consumidores usam só `navIcons['menu']`.
  - [x] Nenhum outro glyph novo; nenhum `@mui/icons-material` nos componentes do shell.

- [x] **3. `ShellBottomNav.tsx` — 3 atalhos + Menu** (AC: 1, 2, 4, 7)
  - [x] Novo `frontend/src/app/layout/shell/ShellBottomNav.tsx`: `nav` com `aria-label="Atalhos de navegação"`, fixa no rodapé, altura `var(--ds-bottom-nav-height)` + `pb: env(safe-area-inset-bottom, 0px)` (paridade BN-04/BN-05 com o landmark novo), fundo `var(--ds-surface)`, borda superior `var(--ds-border)`.
  - [x] 4 itens em grade igual: 3 atalhos derivados (Task 1) + **Menu** fixo (ícone `menu`, abre o sheet). Item = ícone Phosphor (~22px no mockup; `regular`/`fill` no selecionado) + label curto; ativo = tinta `var(--ds-primary)` + fundo `var(--ds-primary-soft)` + `fill` + `aria-current="page"` (mockup) — nunca cor isolada.
  - [x] Ativo por prefixo do destino (path exato ou `path + '/'`); rota fora dos atalhos ⇒ **Menu selecionado** (mesmos canais visuais; o botão Menu também expõe `aria-expanded` ligado ao sheet).
  - [x] **Contraste do label não-selecionado ≥4.5:1** (label ~10-12px): usar `var(--ds-ink-muted)` sobre `var(--ds-surface)` (#666159/#FBFAF6 ≈ 5.5:1) — é o fix da SHELL-DEBT-01; o gate axe compact passa a cobrir a barra.
  - [x] Atalho `brain-dump` (quando presente na configuração futura) renderiza com `BrainDumpBadge` (`max={9}` + `badgeSx` do shell) ligado ao ícone.
  - [x] Sem Query direto; sem literais estruturais (nenhum `56`/`64` cravado).

- [x] **4. `ShellNavigationSheet.tsx` — menu de navegação completa** (AC: 3, 4)
  - [x] Novo `frontend/src/app/layout/shell/ShellNavigationSheet.tsx` com MUI `SwipeableDrawer` (`anchor="bottom"`) — fornece backdrop, `Escape`, swipe-down e focus trap do Modal; conteúdo inferior fica inerte pelo próprio Modal.
  - [x] Composição: alça (grab), header com "Navegação" + botão Fechar (≥44px, borda `interactive-control`), `nav aria-label="Navegação completa"` com rolagem interna. Paper: `background var(--ds-surface)`, `border-radius` superior `var(--ds-radius-lg)`, altura alta (high-sheet) e **`bottom: calc(var(--ds-bottom-nav-height) + env(safe-area-inset-bottom, 0px))`** — o sheet termina acima da bottom nav (mockup: `.sheet{bottom:64px}`).
  - [x] Conteúdo: estrutura canônica agrupada da Task 1 — todos os destinos disponíveis (inclusive os 3 atalhos), grupos `Planner`/`Saúde` com `aria-expanded` (podem iniciar expandidos; estado só na sessão), itens ≥44px, destino ativo com `aria-current="page"` + indicador/fundo/peso/`fill`, Brain Dump com badge.
  - [x] **Foco inicial no destino ativo** (ex.: `ref` + focus no mount do item ativo; se nenhum destino casa a rota, focar o primeiro item). Navegar fecha o sheet; **fechar sem navegar devolve o foco ao botão Menu** (o `SwipeableDrawer` restaura o foco ao elemento de origem por default — verificar em teste).
  - [x] Não introduzir `main`/landmark solto (regra `region` do axe — aprendizado da 13.1: conteúdo fora de landmark quebra os testes de chrome).

- [x] **5. Captura persistente — FAB compact + âncora na `ShellSidebar` + sheet único** (AC: 1, 5, 6)
  - [x] **Estado no `ShellLayout`:** `captureOpen` + **uma** instância de `<BrainDumpCaptureSheet open onClose>` (barrel `features/braindump`) para todos os breakpoints; `useOnlineStatus()` para o estado offline.
  - [x] **FAB compact** (renderizado pelo `ShellLayout`, fora da `nav` da bottom nav — mockup: "o FAB permanece fora da bottom nav"): circular `var(--ds-capture-fab-size)` (52px), `border-radius var(--ds-radius-full)`, fundo `var(--ds-primary)`/tinta `var(--ds-on-primary)`, ícone `capture` (`note-pencil`, ~24px no mockup), `position: fixed; right: var(--ds-space-4); bottom: calc(var(--ds-bottom-nav-height) + env(safe-area-inset-bottom, 0px) + var(--ds-space-4))` (paridade FAB-01 com tokens), envolvendo o ícone com `BrainDumpBadge` (paridade FAB-04 + AC do epics "carrega o badge").
  - [x] **Âncora desktop/tablet na `ShellSidebar`:** após a lista de navegação, `spacer` (flex 1) + botão "Abrir captura rápida" com borda `1px solid var(--ds-control-border)` (`{components.interactive-control}`), radius `var(--ds-radius-md)`, min-height ≥44px, ícone `capture` + label nominal; no rail vira icon-only **preservando `aria-label`**, com badge ligado ao canto do ícone (CSS do mockup `.rail .action-nav>.badge`). A âncora recebe `onOpenCapture` via prop nova do `ShellSidebar` (a interface `{ collapsed, onToggle }` ganha o handler; o seam de teste `collections` permanece).
  - [x] **Offline (FAB e âncora):** `aria-disabled="true"` + guard no click (não usar `disabled` nativo — AC 6; foco e identidade preservados), superfície `var(--ds-surface-subtle)`/tinta `var(--ds-ink-disabled)`, `aria-label` "…(sem conexão)" e `Tooltip title="Sem conexão"` (com `aria-disabled` o Tooltip funciona sem o `<span>` wrapper do legado). Disponibilidade **independe** do contador.
  - [x] **Mocks (memória de guardrail do projeto):** adicionar o stub `BrainDumpCaptureSheet: ({ open }) => open ? <div>capture sheet aberto</div> : null` ao `vi.mock('../features/braindump')` de **`router.test.tsx`** (hoje só tem `BrainDumpBadge`) e ao mock de **`ShellSidebar.test.tsx`**; `AppLayout.test.tsx`/`RouteAnnouncer.test.tsx`/`ShellLayout.test.tsx` já o têm. Nenhum `QueryClientProvider` novo.

- [x] **6. Wire no `ShellLayout` + token 64px** (AC: 1, 7)
  - [x] Em `tokens.ts`: `bottomNavHeight: '56px'` → **`'64px'`** e atualizar o comentário (o valor novo é o do mockup aprovado; as fórmulas de `pb`/`scroll-padding` do `ShellLayout` já referenciam `--ds-bottom-nav-height` e se ajustam sozinhas).
  - [x] Em `ShellLayout.tsx`: trocar `<BottomNav />` (import `../BottomNav`) por `<ShellBottomNav …/>` + FAB + `<ShellNavigationSheet …/>` + `<BrainDumpCaptureSheet …/>` no compact; passar `onOpenCapture` à `ShellSidebar` no desktop/tablet. Não mexer em topbar/skip link/seam/atalhos `[`/`B`.
  - [x] Atualizar `ShellLayout.test.tsx`: asserts de `'Navegação mobile'` (linhas ~129/138/172) passam a `'Atalhos de navegação'` (troca contratada de landmark — AC 4); manter os asserts de token `--ds-bottom-nav-height` (continuam válidos); cobrir FAB presente no compact e ausente no desktop.

- [x] **7. Testes unitários dos componentes novos** (AC: 1–7)
  - [x] `ShellBottomNav.test.tsx` (padrão de chrome: `MemoryRouter`, mock do barrel braindump, **sem** QueryClientProvider): 3 atalhos default (Hoje/Esta Semana/Este Mês) + Menu; ativo por rota com `aria-current`; rota fora dos atalhos ⇒ Menu selecionado; landmark "Atalhos de navegação"; navegação ao clicar; `jest-axe`.
  - [x] `ShellNavigationSheet.test.tsx`: lista completa na ordem canônica (inclusive os 3 atalhos) derivada da lista filtrada (zero/uma collection sem heading vazio — reusar o seam de injeção); destino ativo com `aria-current` e foco inicial nele; fechar sem navegar devolve foco ao acionador; `Escape` fecha; badge do Brain Dump presente; `jest-axe`.
  - [x] `shellDestinations.test.ts`: ordem canônica achatada; 3 primeiros = atalhos default; filtragem zero/uma collection; **dados puros** (grep via `?raw` de import de Query/hooks, padrão `shellRouting.test.ts`).
  - [x] `ShellSidebar.test.tsx` (additions): âncora "Abrir captura rápida" nominal expandida / icon-only no rail com nome acessível e badge; offline ⇒ `aria-disabled` + motivo + continua focável; click chama `onOpenCapture` (online) e não chama (offline).
  - [x] Guards de grep nos testes (padrão 13.2): nenhum `@mui/icons-material` em `ShellBottomNav`/`ShellNavigationSheet`; nenhum literal `56`/`64`/`240` estrutural.

- [x] **8. E2E, gate axe e checklist de paridade** (AC: 8)
  - [x] `nvm use 22.15.1` antes de qualquer comando de frontend/e2e.
  - [x] Novo `frontend/e2e/shell-bottomnav.spec.ts` (viewport compact 320×720 e/ou 390): 3 atalhos + Menu visíveis acima da safe-area; navegação por atalho; Menu selecionado em rota fora dos atalhos (ex.: `/health/metrics`); sheet abre com todos os destinos, navega e fecha; foco volta a Menu ao fechar sem navegar; FAB abre o Capture Sheet real; **sem scroll horizontal em 320px**.
  - [x] `shell-a11y.spec.ts`: **remover** `nav[aria-label="Navegação mobile"]` do `exclude` do gate compact (SHELL-DEBT-01 fecha — a bottom nav nova precisa passar `color-contrast` no axe real); atualizar comentários.
  - [x] `shell.spec.ts:159`: assert `'Navegação mobile'` → `'Atalhos de navegação'`; verificar os demais asserts compact.
  - [x] Atualizar `13-shell-parity-checklist.md`: `BN-01…BN-06`, `FAB-01…FAB-05`, `DIV-2`, `DIV-5` (bottom nav) resolvidos na 13.3 com arquivo/símbolo; registrar as divergências contratadas novas — landmark "Navegação mobile"→"Atalhos de navegação", offline `disabled`→`aria-disabled` (foco preservado), altura 56→64px; SHELL-DEBT-01 fechada.
  - [x] Rodar `npm run test:run` (colar contagem literal; derivar herdados/novos pelo diff), `npm run typecheck`, `npm run lint`.
  - [x] Rodar E2E escopado aos specs do shell (`CI=1 npx playwright test e2e/shell-bottomnav.spec.ts e2e/shell.spec.ts e2e/shell-a11y.spec.ts e2e/shell-sidebar.spec.ts --reporter=line`) — ver Testing Requirements para o workaround do banco e2e. Esta story **não** cria migration.

## Dev Notes

### Fronteira desta story (o que é 13.3 e o que NÃO é)

| Entrega | Story |
|---|---|
| Casca, topbar, tokens, skip link, seam, coexistência, axe-core, checklist | 13.1 (done) |
| Sidebar 240/64 derivada do manifest, catálogo Phosphor, badge `9+`, rail, `[` | 13.2 (done) |
| **Bottom nav 3 atalhos + Menu, sheet de navegação completa, captura persistente (FAB compact + âncora desktop/tablet), offline acessível** | **13.3 (esta)** |
| Passe de paridade completo + matriz axe wide/medium/compact | 13.4 |
| Configurações → Navegação mobile (escolha dos 3 atalhos, persistência por conta) e Aparência | 18.1 |
| Migração da superfície de captura/Brain Dump para o sistema novo | Épico 15 (15.2) |

**Fora de escopo — não fazer nesta story:**

- **UI/persistência de configuração dos atalhos** (Configurações → Navegação mobile é a 18.1; sem backend, sem `localStorage` — o default derivado é o único comportamento desta story).
- Alterar `BottomNav.tsx`, `Sidebar.tsx`, `AppLayout.tsx` legados (rollback), `theme.ts` ou o `registry.ts`.
- Trocar/reescrever o `BrainDumpCaptureSheet` (superfície legada até a Onda 4; apenas **reutilizar** — preserva texto em erro, foco e confirmação de descarte).
- Backend, migration, OpenAPI, `types.gen.ts`. Story **100% frontend**.
- Matriz axe completa wide/medium/compact e passe de paridade final (13.4).

### Contrato do shell — números que o dev não deve inventar

| Item | Valor | Fonte |
|---|---|---|
| Bottom nav | **3** atalhos dinâmicos + **Menu** fixo; altura **64px** (mockup) + safe-area | `{components.app-shell.bottom-nav-configurable-items}`; mockup `.phone`/`.bottom` |
| Default sem preferência | **3 primeiros destinos disponíveis na ordem canônica** (hoje: Hoje, Esta Semana, Este Mês) | EXPERIENCE §App Shell, aparência e atalhos |
| FAB de captura | circular **52px**, radius `full`, `right 16px`, `bottom = bottom-nav + safe-area + 16px`, fora da bottom nav | `{components.capture-action}`; mockup `.fab`; FAB-01 |
| Âncora desktop/tablet | fim da navegação; nominal/icon-only; borda `1px solid {colors.control-border}`; ≥44px | DESIGN §App Shell; `{components.interactive-control}`; mockup `.action-nav` |
| Sheet | high-sheet, `surface`, backdrop `overlay`, radius-top `{rounded.lg}` = **8px** (token vence os 12px do markup), termina acima da bottom nav | `{components.mobile-navigation-sheet}`; mockup `.sheet` |
| Ícones | `note-pencil` (captura) e `list` (Menu); nav 20px `regular`/`fill`; mockup usa ~22px na bottom nav e ~24px no FAB | DESIGN §Catálogo Phosphor; `{components.app-shell-nav-icon}` |
| Badge | `min-height 18px`, radius full, bg `primary`, fg `on-primary`, `9+`, contagem exata acessível | `{components.app-shell-badge}`; BD-01…BD-04 |
| Touch target | ≥44px; controles frequentes compactos 48px | EXPERIENCE §Accessibility Floor |
| Landmarks | bottom nav `Atalhos de navegação`; sheet `Navegação completa`; sidebar `Navegação principal` | EXPERIENCE §Accessibility Floor |
| Faixas | compact <768px; reflow válido a 320 CSS px | EXPERIENCE §Responsive & Platform |

### Estado atual do código a preservar (arquivos lidos)

**`frontend/src/app/layout/shell/ShellLayout.tsx` (UPDATE)**
- Compact: renderiza `<BottomNav />` legada (`ShellLayout.tsx:188`) — é o ponto de troca. `workspaceInlineStyle` já reserva `pb`/`scrollPaddingBottom` via `--ds-bottom-nav-height`/`--ds-capture-fab-size` — **não** reescrever as fórmulas; elas absorvem o token novo de 64px.
- Já gerencia `sidebarCollapsed` e os atalhos `[`/`B` (desktop only, guards de campo editável e ctrl/meta/alt) — não tocar.
- Renderiza `ShellSidebar` só quando `!isCompact` (`:135-140`).

**`frontend/src/app/layout/BottomNav.tsx` (LEGADA — intocada, referência de paridade)**
- 4 abas fixas (`Hoje`/`Planner`/`Hábitos`/`Saúde`), match por `startsWith` (BN-03), `nav aria-label="Navegação mobile"`, `pb` safe-area (BN-05).
- FAB 52×52, `bottom: calc(56px + safe-area + 16px)`, `right:16`; `aria-label` online/offline (FAB-02); `disabled={!isOnline}` + `Tooltip "Sem conexão"` com `<span>` wrapper (FAB-03 — o shell novo troca por `aria-disabled`, ver AC 6); `BrainDumpBadge` sobre o ícone (FAB-04); `BrainDumpCaptureSheet` local (FAB-05 — no shell sobe para o `ShellLayout`).

**`frontend/src/app/layout/shell/ShellSidebar.tsx` (UPDATE)**
- Deriva núcleo + collections inline (`:71-81` núcleo; `:130-136` collections filtradas) — é o código que migra para `shellDestinations.ts` na Task 1 (refatoração sem mudança de comportamento).
- Já tem `SHELL_BADGE_SX`, `VISUALLY_HIDDEN`, `iconFor` com fallback para collection sem ícone (fix da review 13.2 — **preservar**), `containsRoute`, prop-seam `collections`.
- Interface atual `{ collapsed, onToggle, collections? }` — ganha `onOpenCapture` (âncora). O `nav aria-label="Navegação principal"` permanece único.

**`frontend/src/app/layout/shell/navIcons.tsx` (UPDATE)**
- Mapa fechado keyado por identidade; adicionar `capture: NotePencil` e `menu: List as ListIcon`. `NAV_ICON_SIZE = 20`.

**`frontend/src/shared/design/tokens.ts` (UPDATE)**
- `appShell.bottomNavHeight: '56px'` com comentário explícito: "o contrato novo da bottom nav (3 atalhos + Menu) chega na Story 13.3, que substitui este valor pelo do mockup" → trocar para `'64px'`.
- `captureAction` (52px/full/note-pencil) e `mobileNavigationSheet` (high-sheet/surface/overlay/radius-top lg) **já exportados** e mapeados para `--ds-capture-fab-size` etc. — consumir, não recriar.

**`frontend/src/features/braindump/` (reutilizar, sem UPDATE previsto)**
- `BrainDumpCaptureSheet { open, onClose }`: SwipeableDrawer com preservação de texto, confirmação de descarte e foco no título — usar como está.
- `BrainDumpBadge { children, max?, badgeSx? }`: cap `9+` e estilo do shell já entregues na 13.2; `aria-label` com contagem exata; oculto em 0/loading/erro.
- Barrel `index.ts` exporta ambos — importar **só** do barrel.

**`frontend/src/shared/hooks/useOnlineStatus.ts`** — wrapper de `navigator.onLine` sem Query; seguro em qualquer teste.

**Mocks existentes do barrel braindump (leitura obrigatória antes da Task 5):**
- `router.test.tsx:44-46`: **só** `BrainDumpBadge` → **precisa** do stub `BrainDumpCaptureSheet` (sem ele, o import no chrome vira `undefined` e os ~30 testes do router explodem).
- `AppLayout.test.tsx:17-21`, `RouteAnnouncer.test.tsx:41-45`, `ShellLayout.test.tsx:24-28`, `BottomNav.test.tsx:7-11`: já têm ambos os stubs.
- `ShellSidebar.test.tsx:17+`: mock rico de `BrainDumpBadge` (expõe `max`/`badgeSx` em data-attrs) → adicionar o stub do sheet.

### Decisões de design já tomadas (não reabrir)

- **Captura A** (13.0): ancorada na navegação em desktop/tablet; **FAB circular icon-only** no compact. Rejeitados: captura na topbar, dock sobre o workspace, FAB estendido com label.
- **Menu mobile A**: sheet alto. Rejeitados: drawer lateral, tela modal completa, foco inicial no Fechar.
- O menu completo **não é overflow**: lista todos os destinos, inclusive os 3 atalhos, e é a visão completa e dinâmica da navegação (13.0 §Contrato do manifest).
- Badge acima de 9 = `9+` com contagem exata no nome acessível (rejeitado: contagem exata visual).
- Estado de colapso/grupos só na sessão; nada persistido (vale para o estado dos grupos dentro do sheet também).
- Seam legado e topbar não mudam nesta story; a topbar do compact já existe desde a 13.1 (DIV-3 resolvida).

### Riscos concretos desta story

1. **Quebrar `router.test.tsx`** — qualquer import de `BrainDumpCaptureSheet` no chrome sem o stub no mock do barrel derruba a suíte do router. Fazer o mock **antes** de wirar o sheet (Task 5).
2. **Copiar o mockup literalmente** — o próprio mockup avisa ("não copiar o markup"): a ordem do sheet no frame E não é canônica, os atalhos do frame D são um exemplo configurado (Fluxo 8), o radius 12px diverge do token (8px). EXPERIENCE/DESIGN vencem.
3. **Duplicar a derivação de destinos** — bottom nav e sheet **reusam** a derivação da sidebar via `shellDestinations.ts`; três cópias divergentes da ordem canônica é o anti-padrão que o manifest existe para evitar (AD-17/FR-1.3).
4. **Regressão na refatoração da `ShellSidebar`** — a Task 1 move constantes sem mudar comportamento; `ShellSidebar.test.tsx` (17 testes) deve permanecer verde sem editar asserts (edições ali são só as *additions* da Task 7).
5. **Literais estruturais** — `56`, `64`, `52`, `240` cravados são falha do AC 7; tudo via `var(--ds-*)`.
6. **Contraste do label da bottom nav** — a razão de existir da SHELL-DEBT-01; com o gate axe compact passando a incluir a barra, um label com tinta fraca reprova o spec E2E. Usar `--ds-ink-muted`/`--ds-primary` sobre `--ds-surface`.
7. **Foco do sheet** — foco inicial no destino ativo (não no Fechar) e retorno ao Menu ao fechar sem navegar; `SwipeableDrawer` restaura o foco por default, mas o teste precisa provar (jsdom não implementa `scrollIntoView` — chamar como opcional, aprendizado da 13.1).
8. **Landmark órfã / regra `region` do axe** — o FAB e o sheet vivem fora do `main`; FAB dentro de elemento sem landmark quebra os 3 testes de chrome (o seam da 13.1 virou `aside` por isso). O FAB pode viver dentro da `nav` do sheet? Não — mockup o mantém fora da bottom nav; solução do legado: o FAB é irmão da `nav` e o axe dos testes de chrome roda com `exclude: 'main'`… **validar com `jest-axe` no `ShellLayout` compact** e, se a regra `region` acusar, envolver o FAB em landmark apropriada (ex.: `complementary` nomeada) — nunca silenciar a regra globalmente.
9. **`aria-disabled` + Tooltip** — com `aria-disabled` (sem `disabled` nativo) o elemento continua recebendo eventos: o `<span>` wrapper do legado se torna desnecessário, mas o guard no `onClick` é obrigatório (senão offline abre o sheet).
10. **Menu com `aria-expanded` + seleção** — o botão Menu acumula estados (selecionado quando rota fora dos atalhos; `aria-expanded` quando o sheet abre); não usar `aria-current` e `aria-expanded` como canais únicos — manter os canais visuais.

### Project Structure Notes

Arquivos previstos (`NEW` salvo indicação):

```
frontend/src/app/layout/shell/shellDestinations.ts          NEW  (derivação pura; padrão shellRouting/AD-17)
frontend/src/app/layout/shell/shellDestinations.test.ts     NEW
frontend/src/app/layout/shell/ShellBottomNav.tsx            NEW
frontend/src/app/layout/shell/ShellBottomNav.test.tsx       NEW
frontend/src/app/layout/shell/ShellNavigationSheet.tsx      NEW
frontend/src/app/layout/shell/ShellNavigationSheet.test.tsx NEW
frontend/src/app/layout/shell/navIcons.tsx                  UPDATE (+ capture/menu)
frontend/src/app/layout/shell/ShellSidebar.tsx              UPDATE (consome shellDestinations; âncora de captura; onOpenCapture)
frontend/src/app/layout/shell/ShellSidebar.test.tsx         UPDATE (additions da âncora/offline; asserts existentes intactos)
frontend/src/app/layout/shell/ShellLayout.tsx               UPDATE (ShellBottomNav + FAB + sheets; onOpenCapture)
frontend/src/app/layout/shell/ShellLayout.test.tsx          UPDATE (landmark novo; FAB)
frontend/src/shared/design/tokens.ts                        UPDATE (bottomNavHeight 56→64)
frontend/src/app/router.test.tsx                            UPDATE (stub BrainDumpCaptureSheet no mock do barrel)
frontend/e2e/shell-bottomnav.spec.ts                        NEW  (artefato de tipo novo — spec E2E da bottom nav/sheet/captura)
frontend/e2e/shell-a11y.spec.ts                             UPDATE (gate compact inclui a bottom nav nova)
frontend/e2e/shell.spec.ts                                  UPDATE (landmark novo no assert compact)
_bmad-output/implementation-artifacts/13-shell-parity-checklist.md  UPDATE (BN/FAB/DIV-2/DIV-5/SHELL-DEBT-01)
```

- `app/layout/shell/` = chrome com dono; pode importar `features/braindump`, `app/collections/registry`, `shared/design/tokens`, `shared/hooks` (regra: `app/` → `features/`/`shared/`; `shared/` nunca importa `app/`/`features/` — ESLint boundary).
- **Nenhuma dependência nova** (Phosphor, axe e MUI já instalados; respeitar o lockfile: MUI `6.5.0`, TanStack Query `5.101.1`, React `19.2.x`, Router `6.30.x`, Vite `8.x`, Vitest `4.1.9`, Playwright `1.61.x`).

### Testing Requirements

- **Vitest + Testing Library + `jest-axe`**, padrão de chrome (`MemoryRouter`, mock do barrel `features/braindump`, **sem** `QueryClientProvider`). Nav mínima nos componentes novos via injeção da lista de collections (seam da 13.2).
- **CI não roda Vitest nem Playwright** (arquitetura §7.4): execução local completa é obrigatória. Contagens em Completion Notes: comando real + saída literal; herdados/novos pelo diff.
- **`nvm use 22.15.1`** antes de todo comando de frontend/e2e (a sessão inicia em Node 18).
- **Playwright:** ambiente e2e é isolado (`--mode e2e`, portas 5173/8000) — **nunca** derrubar 5174/8001 (dev local do usuário). Falha em massa no fixture de signup ⇒ checar vazamento de `VITE_API_BASE_URL` antes de culpar o banco.
- **Banco e2e:** a credencial da branch Neon `e2e` está **stale** desde 2026-07-24 (pendência ops do dono). Workaround validado na review da 13.2: `DATABASE_URL` one-shot apontando o Postgres **local** `bujo_e2e` ao rodar o Playwright (`CI=1 DATABASE_URL=… npx playwright test e2e/shell-bottomnav.spec.ts e2e/shell.spec.ts e2e/shell-a11y.spec.ts e2e/shell-sidebar.spec.ts --reporter=line`). E2E **não** fica "não verificado".
- Esta story **não** cria migration — sem passo de migration no banco e2e.
- File List final nomeia artefatos de tipo novo (spec E2E novo) e é reconciliada com `git status --short` **depois** de QA/E2E (guardrail recorrente das retros 3/4/11/12).

### Previous Story Intelligence

**Story 13.2 (`done`)** — base direta:
- `ShellSidebar` + `navIcons` prontos; badge `max`/`badgeSx` entregue; padrão de teste com mock rico do badge (data-attrs) e greps de guarda (`?raw`) — **replicar** nos componentes novos.
- Review da 13.2 (aplicar aqui de saída): File List completa incluindo artefatos do passo automate/QA; **fallback de ícone** para collection fora do catálogo (não crashar o shell — o `shellDestinations` herda essa tolerância); testar a **integração** de props através de mocks (o passthrough esconde regressão); tokens até em `minHeight` de header (nada de `48` literal).
- E2E da 13.2 só ficou verde com o workaround do Postgres local (ver Testing Requirements).

**Story 13.1 (`done`)** — fundação: tokens `--ds-*` (capture/sheet/bottom-nav já exportados), `shellRouting` puro, `axeHelper`, checklist; aprendizados: regra `region` do axe (landmark para conteúdo solto), `jest-axe` não roda `color-contrast` em jsdom (só o axe real do Playwright pega — por isso o gate E2E compact importa), `scrollIntoView` opcional em jsdom, `Typography` custom como bloco precisa `component="div"`.

**Story 13.0 (gate UX)** — contratos vinculantes desta story: bottom nav 3+Menu, sheet alto, captura A, foco no destino ativo, retorno ao Menu, offline com motivo, badge `9+`. Rejeições listadas em "Decisões de design já tomadas".

### Git Intelligence

- Baseline: `d14e366 feat(story-13.2): Sidebar nova derivada do manifest` (HEAD da `dev`). `e9cba41` criou o env E2E dedicado (`--mode e2e`) — é o ambiente que os specs desta story usam.
- Branch de trabalho: `dev` (homologação); `main` = prod só após homologar. Na automação, commit com `--no-gpg-sign` (1Password SSH indisponível) e `git add` **escopado** (nunca `git add -A`).
- Protocolo de fechamento: rodar `/bmad-uncommitted-report`, salvar o report, commitar sem pedir confirmação (protocolo 2026-07-16).

### Pesquisa técnica

- **MUI `SwipeableDrawer`** (v6, instalada): `anchor="bottom"` + `onOpen`/`onClose`; fornece swipe-down, `Escape`, backdrop click e focus trap/restauração via Modal — cobre os 4 modos de fechamento do contrato sem lib nova. `disableSwipeToOpen` mantém o sheet só por acionamento explícito. O `BrainDumpCaptureSheet` já usa o mesmo componente (precedente no repo).
- **MUI `BottomNavigation`** é opcional: o item Menu não é navegação e o contrato visual é do DESIGN — compor com `Box`/`ButtonBase` pode ser mais direto que sobrescrever `BottomNavigationAction` (que causou a dívida de contraste no legado). Decisão do dev; o contrato é o aceite, não o componente.
- **Phosphor**: named imports (`NotePencil`, `List as ListIcon`); `size`/`weight`/`currentColor` como na 13.2. Sem upgrade de dependência.
- WCAG 2.2 AA relevante: `1.4.3 Contrast` (label da bottom nav — SHELL-DEBT-01), `2.4.11 Focus Not Obscured` (FAB/bottom nav/sheet não encobrem foco — `scroll-padding` já reserva), `2.5.8 Target Size` (44/48px), `1.4.10 Reflow` (320px), `4.1.2 Name/Role/Value` (`aria-current`/`aria-expanded`/`aria-disabled`).

### Questões abertas (registrar; não bloqueiam o #YOLO)

1. **Semântica do "Menu selecionado".** EXPERIENCE exige "Menu aparece selecionado" quando a rota não está nos atalhos; o mockup marca `aria-current="page"` no botão Menu. Menu é um botão que abre sheet (não um destino), então `aria-current` nele é heterodoxo, mas é o que o mockup aprovado mostra. **Decisão interina:** seguir o mockup (`aria-current="page"` + canais visuais) e registrar no checklist para o passe da 13.4 confirmar com UX/Hugo.
2. **Ícones de 22/24px no compact.** `{components.app-shell-nav-icon}` fixa 20px, mas o mockup usa ~22px nos tabs e ~24px no FAB. **Decisão interina:** manter 20px (token) nos itens de nav e aceitar ícone maior apenas no FAB se necessário para presença visual (52px de área) — registrar a escolha no checklist; qualquer valor usado deve vir de constante nomeada, não literal solto.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-13.3-Bottom-nav-e-captura-persistente-mobile]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-13-Onda-2a--App-Shell-no-Sistema-Novo]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR15] · [Source: …#UX-DR22] · [Source: …#NFR-1]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md#App-Shell] (captura, bottom nav, sheet, badges)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md#Catálogo-Phosphor-do-App-Shell] (`note-pencil`, `list`)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Information-Architecture] (§App shell — compact, Menu, atalhos)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Component-Patterns] (§App Shell, aparência e atalhos — default dos 3 atalhos)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#State-Patterns] (Captura offline; Menu mobile aberto; Badge)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Interaction-Primitives] (fechamento do sheet; retorno de foco)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Accessibility-Floor] (landmarks; foco inicial; targets; badge `9+`)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Responsive--Platform] (<768px; 320px sem scroll horizontal)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/reconcile-story-13-0-app-shell.md] (decisões aprovadas/rejeitadas)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/mockups/key-app-shell-13-0.html] (frames D/E — compact/sheet; `.action-nav`/`.fab`/`.sheet`)
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-17--Manifestregistry-estático-de-collections-fatia-1]
- [Source: _bmad-output/planning-artifacts/architecture.md#7.2-Fronteiras-Arquiteturais] · [Source: …#7.4-Configuração-Build-Testes--Deploy]
- [Source: _bmad-output/implementation-artifacts/13-0-ux-spec-do-app-shell-novo.md]
- [Source: _bmad-output/implementation-artifacts/13-1-fundacao-do-shell-novo-com-coexistencia-por-rota.md]
- [Source: _bmad-output/implementation-artifacts/13-2-sidebar-nova-derivada-do-manifest.md]
- [Source: _bmad-output/implementation-artifacts/13-shell-parity-checklist.md] (BN-*, FAB-*, DIV-2, DIV-5, SHELL-DEBT-01)
- [Source: frontend/src/app/layout/BottomNav.tsx] · [Source: frontend/src/app/layout/shell/ShellLayout.tsx] · [Source: frontend/src/app/layout/shell/ShellSidebar.tsx] · [Source: frontend/src/app/layout/shell/navIcons.tsx]
- [Source: frontend/src/shared/design/tokens.ts] · [Source: frontend/src/shared/hooks/useOnlineStatus.ts]
- [Source: frontend/src/features/braindump/index.ts] · [Source: frontend/src/features/braindump/components/BrainDumpCaptureSheet.tsx] · [Source: frontend/src/features/braindump/components/BrainDumpBadge.tsx]
- [Source: frontend/src/app/router.test.tsx] · [Source: frontend/e2e/shell-a11y.spec.ts] · [Source: frontend/e2e/shell.spec.ts]

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5) — Claude Code CLI, workflow bmad-dev-story.

### Debug Log References

- **RouteAnnouncer.test.tsx (mobile) quebrou após o wire**: o teste navegava
  clicando na aba "Hábitos" da `BottomNav` legada, que não existe na
  `ShellBottomNav` (3 atalhos + Menu). Agravante: o `SwipeableDrawer` mantém o
  conteúdo montado fechado por default (`keepMounted`), deixando um "Hábitos"
  oculto no DOM (`pointer-events: none`). Fix duplo: `ModalProps={{ keepMounted:
  false }}` no sheet (sem swipe-to-open não há razão para manter montado; o
  foco inicial passa a disparar a cada abertura) + teste atualizado para o
  fluxo mobile canônico novo (Menu → sheet → Hábitos). Desvio documentado nas
  Completion Notes (#3).
- **E2E: geometria do sheet reprovava (bottom edge 1004 > 657)**: duas causas
  encadeadas — (a) os tokens `--ds-*` aplicados via `style` no root do
  `SwipeableDrawer` não alcançavam o paper no portal de forma confiável
  (var() não resolvido invalida `bottom`/`max-height` no browser real; jsdom
  não pega porque não faz layout) → tokens reaplicados via `style` DIRETO nos
  slots `paper` e `backdrop`; (b) o assert media a geometria durante o slide de
  entrada (o `toBeFocused` passa cedo via `autoFocus`, antes do `onEntered`) →
  assert com `expect.poll` até a transição assentar.
- **E2E: bottom nav "sumia" com o sheet aberto**: o Modal marca o conteúdo
  inferior como inerte (`aria-hidden`) — exatamente o contrato do AC4 — e o
  `getByRole` deixa de encontrar a barra. Asserts de `aria-expanded`/geometria
  com o sheet aberto usam locator CSS.

### Completion Notes List

1. **Task 1** — `shellDestinations.ts` criado como módulo puro (padrão
   `shellRouting.ts`/AD-17): estrutura canônica agrupada (`deriveShellNavItems`),
   lista achatada (`flattenDestinations`) e atalhos default
   (`deriveBottomNavShortcuts` = 3 primeiros sem duplicatas, count vindo de
   `appShell.bottomNavConfigurableItems`). `ShellSidebar` refatorada para
   consumi-lo sem mudança de comportamento (os 17 testes pré-existentes
   passaram sem tocar em asserts ANTES das additions da âncora). O
   `SHELL_BADGE_SX` migrou para `shellDestinations.ts` (dados puros) por ser
   compartilhado por 4 consumidores (sidebar, bottom nav, sheet, FAB).
   A assinatura de `deriveBottomNavShortcuts` já recebe `preferredPaths?`
   (18.1) e **explode com erro claro** se alguém passar — falhar alto > ignorar
   silenciosamente preferência de usuário (coberto por teste).
2. **Tasks 3–6** — `ShellBottomNav` (nav "Atalhos de navegação", 4 itens em
   grade, ativo multi-canal + `aria-current`, Menu com `aria-expanded`, label
   não-selecionado `--ds-ink-muted` ≥4.5:1 = fix SHELL-DEBT-01),
   `ShellNavigationSheet` (SwipeableDrawer bottom, conteúdo canônico completo,
   foco inicial no destino ativo via `autoFocus`+`onEntered`, paper termina
   acima da bottom nav, tokens reaplicados nos slots do portal), FAB compact +
   âncora "Abrir captura rápida" na sidebar (nominal/icon-only), instância
   única do `BrainDumpCaptureSheet` no `ShellLayout`, offline com
   `aria-disabled`+guard (DIV-8), token `bottomNavHeight` 56→64px. Legados
   (`BottomNav`/`Sidebar`/`AppLayout`) intocados; `registry.ts`/`theme.ts`
   intocados.
3. **Desvios documentados** (ambiguidade resolvida a favor do código/contrato,
   registrada como risco de 1 linha se o PO discordar):
   (a) `RouteAnnouncer.test.tsx` (mobile) atualizado além da lista contratada
   de mudanças em testes compartilhados — o fluxo antigo (aba "Hábitos" da
   bottom nav legada) deixou de existir por design; o teste agora exercita o
   caminho canônico novo (Menu → sheet → Hábitos), preservando o assert do
   anúncio.
   (b) `ShellSidebar.test.tsx`: o assert de integração do badge passou de
   `getByTestId` para `getAllByTestId` (length 2 + mesmas props em ambos) —
   consequência direta do AC5 (a âncora também carrega o badge); o assert ficou
   MAIS forte, não mais fraco.
   (c) Sheet com `ModalProps={{ keepMounted: false }}` — evita destinos
   duplicados ocultos no DOM e garante o foco inicial a cada abertura.
4. **Gap de especificação**: nenhum encontrado — epics.md (AC da 13.3),
   EXPERIENCE/DESIGN e architecture.md cobrem os contratos implementados; as 2
   Questões Abertas da story (aria-current no Menu; ícone 24px no FAB) foram
   decididas interinamente CONFORME a story previa e registradas no checklist
   de paridade para o passe da 13.4. Story 100% frontend: sem migration, sem
   OpenAPI, sem `types.gen.ts`.
5. **Checklist de paridade**: BN-01…BN-06 ✅, FAB-01…FAB-05 ✅ (+FAB-06 novo
   para a âncora), DIV-2/DIV-5 (bottom nav) ✅, divergências novas contratadas
   registradas (DIV-7 landmark, DIV-8 aria-disabled, DIV-9 altura 64px),
   SHELL-DEBT-01 fechada (gate axe compact sem exclude da barra).
6. **Testes (contagens observadas, comandos reais)**:
   - `npm run test:run` → **Test Files 89 passed (89) · Tests 948 passed (948)**.
     Divisão derivada do diff: **907 herdados** (baseline 13.2) + **41 novos**
     (11 `shellDestinations.test.ts` + 11 `ShellBottomNav.test.tsx` + 13
     `ShellNavigationSheet.test.tsx` + 4 additions `ShellSidebar.test.tsx` + 2
     additions `ShellLayout.test.tsx`) = 948 ✓.
   - `npm run typecheck` e `npm run lint` limpos.
   - E2E (`CI=1 DATABASE_URL=postgres://…@localhost:5432/bujo_e2e npx
     playwright test e2e/shell-bottomnav.spec.ts e2e/shell.spec.ts
     e2e/shell-a11y.spec.ts e2e/shell-sidebar.spec.ts --reporter=line`) →
     **27 passed (1.1m)**: shell-bottomnav **8 novos** + shell 7 + shell-a11y 2
     + shell-sidebar 10. Workaround do Postgres local `bujo_e2e` (credencial da
     branch Neon e2e stale — pendência ops registrada). Gate axe compact agora
     INCLUI a bottom nav nova (`color-contrast` real) e passou.
7. **Passo QA (`bmad-qa-generate-e2e-tests`, 2026-07-24)** — auditoria AC por AC
   encontrou **14 gaps** de E2E e todos foram fechados em
   `e2e/shell-bottomnav.spec.ts` (nenhuma mudança em código de produção):
   âncora de captura em wide **e** tablet (AC5/FAB-06 não tinha E2E), offline
   real via `context.setOffline` no FAB e na âncora (AC6/DIV-8), falha do
   contador não bloqueando a captura (AC6), badge com contagem REAL no FAB e no
   sheet (AC3/AC5), `Tab` contido + conteúdo inferior inerte (AC4), fechamento
   pelo **backdrop** (4º modo do AC4), agrupadores do sheet (AC3), rolagem
   interna com header fixo (AC3), Phosphor/`fill`/alvos ≥48px medidos na barra
   (AC7/DIV-5), **gate axe com o sheet ABERTO** (AC8) e reflow 320 com o sheet
   aberto (AC7). Resultado: `e2e/shell-bottomnav.spec.ts` **22 passed** (8 + 14)
   e escopo do shell **41 passed (1.5m)** — 27 herdados sem regressão;
   typecheck/lint limpos. Achados de ferramenta (não de produto): o Playwright
   trata `aria-disabled` como "not enabled" (clique offline usa `force`) e a
   geometria precisa de `waitForSheetSettled` para não medir a animação.
   Detalhes em `tests/test-summary-13-3.md`.

### File List

**Novos:**
- frontend/src/app/layout/shell/shellDestinations.ts
- frontend/src/app/layout/shell/shellDestinations.test.ts
- frontend/src/app/layout/shell/ShellBottomNav.tsx
- frontend/src/app/layout/shell/ShellBottomNav.test.tsx
- frontend/src/app/layout/shell/ShellNavigationSheet.tsx
- frontend/src/app/layout/shell/ShellNavigationSheet.test.tsx
- frontend/e2e/shell-bottomnav.spec.ts — **artefato de tipo novo**: spec E2E
  permanente da bottom nav/sheet/captura (entra na suíte do shell); ampliado no
  passo QA de 8 → **22 testes**
- _bmad-output/implementation-artifacts/tests/test-summary-13-3.md —
  **artefato do passo QA**: auditoria de gaps + mapa de cobertura por AC

**Modificados:**
- frontend/src/app/layout/shell/navIcons.tsx (+ `capture`/`menu`, alias `List as ListIcon`)
- frontend/src/app/layout/shell/ShellSidebar.tsx (consome shellDestinations; âncora de captura; `onOpenCapture`; `useOnlineStatus`)
- frontend/src/app/layout/shell/ShellSidebar.test.tsx (stub do sheet no mock; badge assert 2×; +4 testes da âncora/offline)
- frontend/src/app/layout/shell/ShellLayout.tsx (ShellBottomNav + FAB + ShellNavigationSheet + BrainDumpCaptureSheet único; `onOpenCapture` na sidebar)
- frontend/src/app/layout/shell/ShellLayout.test.tsx (landmark novo; +2 testes FAB/âncora; comentário do token)
- frontend/src/app/layout/RouteAnnouncer.test.tsx (fluxo mobile via Menu → sheet — desvio documentado #3a)
- frontend/src/app/router.test.tsx (stub `BrainDumpCaptureSheet` no mock do barrel — mudança contratada AC1)
- frontend/src/shared/design/tokens.ts (`bottomNavHeight` 56→64px + comentário)
- frontend/e2e/shell-a11y.spec.ts (gate compact sem exclude da bottom nav — SHELL-DEBT-01)
- frontend/e2e/shell.spec.ts (landmark "Atalhos de navegação" no assert compact)
- _bmad-output/implementation-artifacts/13-shell-parity-checklist.md (BN/FAB/DIV-2/DIV-5/DIV-7/DIV-8/DIV-9/SHELL-DEBT-01 + decisões interinas; **review**: SHELL-DEBT-03/04 e notas de foco/prefixo)
- _bmad-output/implementation-artifacts/13-3-bottom-nav-e-captura-persistente-mobile.md (este arquivo)
- _bmad-output/implementation-artifacts/sprint-status.yaml (status da story)
- _bmad-output/story-automator/orchestration-13-20260724-130311.md — **artefato do passo de orquestração** (log da sessão do story-automator do Épico 13; reconciliado com `git status --short` na review)

**Tocados na review de código (2026-07-24):** `ShellNavigationSheet.tsx` (ativo por
prefixo; foco inicial em destino visível e armado só na abertura),
`ShellNavigationSheet.test.tsx` (+3 testes), `ShellBottomNav.tsx` (derivação por
render), `ShellBottomNav.test.tsx` (assert que faltava no caso negativo),
`ShellLayout.tsx` (fecha o sheet ao sair do compact), `ShellLayout.test.tsx`
(+1 teste), `RouteAnnouncer.test.tsx` (nomes de teste), `13-shell-parity-checklist.md`.

## Senior Developer Review (AI)

**Revisor:** HugoMMBrito · **Data:** 2026-07-24 · **Workflow:** `bmad-story-automator-review` (modo auto-fix)
**Desfecho:** **Approve** — 0 críticos. 4 médios + 3 baixos **corrigidos na review**; 2 dívidas registradas para a 13.4.

### Verificação das alegações da story (tudo re-executado, nada aceito no papel)

| Alegação | Comando | Resultado |
|---|---|---|
| Vitest 89 files / 948 testes | `npm run test:run` | ✅ confirmado **89 passed / 948 passed** (antes das correções) |
| `typecheck`/`lint` limpos | `npm run typecheck`, `npm run lint` | ✅ ambos sem saída de erro |
| E2E do shell 41 passed | `CI=1 DATABASE_URL=…/bujo_e2e npx playwright test e2e/shell-bottomnav e2e/shell e2e/shell-a11y e2e/shell-sidebar --reporter=line` | ✅ confirmado **41 passed (1.5m)** |
| Tasks 1–8 marcadas `[x]` | leitura de cada arquivo da File List | ✅ nenhuma task marcada sem implementação correspondente |
| Legados intocados (rollback) | `git status` / diff | ✅ `BottomNav.tsx`, `Sidebar.tsx`, `AppLayout.tsx`, `theme.ts`, `registry.ts` sem diff |
| AC1 sem Query direto no chrome | grep + testes sem `QueryClientProvider` | ✅ contagem só via `BrainDumpBadge`; captura só via `BrainDumpCaptureSheet` |
| SHELL-DEBT-01 fechada | diff de `shell-a11y.spec.ts` + run do gate | ✅ `exclude` reduzido a `main`; `color-contrast` real passou com a barra dentro |

Cobertura de AC: **AC1–AC8 implementados**. Nenhuma task `[x]` falsa, nenhum arquivo listado sem diff.

### 🔴 Críticos

Nenhum.

### 🟡 Médios (corrigidos na review)

1. **[MEDIUM][AC3/AC4] `ShellNavigationSheet` marcava o destino ativo só por match EXATO**, enquanto a
   `ShellBottomNav` usa prefixo. As rotas de histórico das collections são reais
   (`/habits/history`, `/health/metrics/history`, `/gratitude/history`): nelas o sheet
   abria **sem nenhum destino ativo** — sem `aria-current`, sem indicador lateral —
   e o foco inicial do AC4 pousava justamente num item que não se declarava ativo.
   → **Corrigido**: `isActive = containsRoute` (o mesmo predicado da barra).
   Teste novo: `rota de histórico marca o destino pai como ativo (prefixo, igual à
   bottom nav)`, que também prova "exatamente UM `aria-current` na navegação completa".

2. **[MEDIUM][AC4] Foco inicial do sheet ficava órfão quando o agrupador da rota ativa
   estava recolhido.** O alvo do foco vinha da lista achatada, mas `Collapse
   unmountOnExit` **desmonta** os filhos de um grupo recolhido — em 3 cliques
   (abrir → recolher Planner → fechar → reabrir em `/planner/week`) o sheet abria
   sem foco inicial nenhum, contrariando "o foco inicial vai ao destino ativo".
   → **Corrigido**: o alvo sai de `visibleDestinations` (respeita `closedGroups`),
   com fallback no primeiro item **visível**. Teste novo: `grupo da rota ativa
   recolhido: foco inicial cai no primeiro destino VISÍVEL`.

3. **[MEDIUM][AC4 / WCAG 2.2 `3.2.1`] `autoFocus` no item ativo roubava o foco a cada
   reexpansão de agrupador.** `autoFocus` dispara em toda montagem do elemento, e o
   `Collapse` remonta os filhos sempre que o grupo reabre: acionar "Planner" jogava o
   foco do próprio agrupador para "Esta Semana", sem ação do usuário.
   → **Corrigido**: o foco inicial passa a ser **armado só quando `open` vira true** e
   consumido pelo primeiro `ref` que anexa (`attachInitialFocus`); `onEntered`
   permanece como rede do browser real. Sai também o `eslint-disable jsx-a11y/no-autofocus`.
   Teste novo: `reexpandir um agrupador NÃO rouba o foco do próprio agrupador`.

4. **[MEDIUM][qualidade de teste] `ShellBottomNav.test.tsx` tinha um caso NEGATIVO sem
   nenhum assert.** O teste do prefixo renderizava `/planner/future` e chamava
   `.unmount()` na mesma linha — o comentário prometia provar que "prefixo mais largo
   não ativa o atalho de `/planner/week`", mas nada era verificado: cobertura
   aparente sem poder de falha.
   → **Corrigido**: `unmount()` do primeiro render + 3 asserts reais (nem Esta Semana
   nem Este Mês ativos; Menu selecionado).

### 🟢 Baixos (corrigidos na review)

5. **[LOW][AC1] `menuOpen` não era resetado ao sair do compact.** O sheet é chrome
   exclusivo da faixa: ao alargar a janela ele desmontava com o estado ainda `true`,
   e **voltar** ao compact reabria um Modal sozinho, sem ação do usuário e com o foco
   preso. → `useEffect` que fecha o sheet quando `!isCompact`. Teste novo em
   `ShellLayout.test.tsx` (`test_sair_do_compact_fecha_o_sheet_e_voltar_nao_o_reabre_sozinho`),
   com mock de `matchMedia` que expõe `matches` como getter para simular a troca de faixa.

6. **[LOW][AC2] Derivação dos atalhos congelada em escopo de módulo.**
   `const SHORTCUTS = deriveBottomNavShortcuts(...)` rodava uma única vez no primeiro
   import — divergindo dos outros dois consumidores da mesma derivação (sidebar e
   sheet derivam por render) e virando armadilha silenciosa para os dois consumidores
   futuros da lista: o gateamento que **filtra** o registro (Épico 10) e a preferência
   por conta (18.1). → derivação movida para o corpo do componente (`shortcuts`).
   Sem mudança de comportamento hoje (os 3 primeiros destinos são núcleo).

7. **[LOW][qualidade de teste] Nomes de teste desatualizados no `RouteAnnouncer.test.tsx`:**
   o `describe` dizia `(BottomNav)` e o teste `..._via_bottom_nav` agora navega pelo
   **sheet**. → renomeados para o fluxo real (`ShellBottomNav + sheet de navegação`,
   `..._via_sheet_do_menu`).

### Dívidas registradas (fora do escopo desta story — não corrigidas de propósito)

- **SHELL-DEBT-03 — `ShellSidebar` segue com destino ativo por match exato.** Depois do
  fix #1 as três superfícies não usam mais o mesmo predicado. A sidebar **não** foi
  tocada porque a Task 1 desta story contratou explicitamente "refatorar sem mudar
  nenhum comportamento", com os 17 testes dela como detector de regressão. Unificar
  o predicado nas três superfícies é item do passe da 13.4.
- **SHELL-DEBT-04 — collections avulsas escolhidas por `id` hardcoded.**
  `deriveShellNavItems` monta os avulsos com `find(c => c.id === 'habits' | 'gratitude')`
  (comportamento herdado da 13.2 e preservado pela Task 1). Uma collection avulsa
  **nova** no registro não apareceria em nenhuma superfície de navegação — o que
  contraria o DoD do AD-17 ("collection nova = pasta + UMA entrada no registro"). O
  grupo `saude` já é genérico (`nav.group` + `nav.order`); falta o mesmo para os avulsos.
- **Duplicação de `renderDestination`/`renderGroup`** entre `ShellSidebar` e
  `ShellNavigationSheet` (~90 linhas quase idênticas). A derivação de **dados** foi
  corretamente unificada em `shellDestinations.ts` (era o risco #3 da story); a
  extração do **componente** de item/grupo compartilhado é candidata natural ao passe
  da 13.4 — fazê-la dentro de uma review arriscaria as duas superfícies de uma vez.

### Notas favoráveis (o que está acima da média)

- `shellDestinations.ts` cumpre o AD-17 de verdade: dados puros, com grep `?raw` de
  guarda contra React/hooks/Query/env, e os três consumidores lendo a MESMA ordem.
- `deriveBottomNavShortcuts` **explode com mensagem clara** se alguém passar
  preferência antes da 18.1 — falhar alto em vez de ignorar silenciosamente uma
  preferência de usuário, com teste cobrindo.
- O passo QA fechou 14 gaps de E2E reais (offline nativo, backdrop, `Tab` contido,
  inerte, badge com contagem real, axe com o sheet aberto, reflow 320 com o sheet) e
  registrou com honestidade o que **não** foi coberto e por quê (swipe-down, safe-area).
- Desvios do dev foram documentados em vez de escondidos (RouteAnnouncer mobile via
  sheet, badge assert 2×, `keepMounted: false`) — e todos se confirmaram corretos.

### Gates após as correções (re-executados)

```
npm run test:run   → Test Files  89 passed (89) · Tests  952 passed (952)
                     (948 da story + 4 testes novos da review)
npm run typecheck  → limpo
npm run lint       → limpo
CI=1 DATABASE_URL=postgres://postgres:postgres@localhost:5432/bujo_e2e \
  npx playwright test e2e/shell-bottomnav.spec.ts e2e/shell.spec.ts \
  e2e/shell-a11y.spec.ts e2e/shell-sidebar.spec.ts --reporter=line
                   → 41 passed
```

Cada um dos 4 testes novos foi **provado não-vacuoso**: com a correção revertida
cirurgicamente, o teste correspondente falha (4/4 verificados).

## Change Log

| Data | Mudança |
|---|---|
| 2026-07-24 | create-story: contexto completo da 13.3 (bottom nav 3 atalhos + Menu, sheet de navegação completa, captura persistente FAB/âncora, offline acessível, token 64px, SHELL-DEBT-01). |
| 2026-07-24 | qa-generate-e2e-tests: 14 gaps de E2E fechados em `shell-bottomnav.spec.ts` (âncora wide/tablet, offline real do FAB e da âncora, erro do contador, badge com contagem real, `Tab` contido + inerte, backdrop, agrupadores do sheet, rolagem interna, Phosphor/alvos medidos, axe com sheet aberto, reflow 320 com sheet). Spec 8 → 22 testes; escopo do shell **41 passed**; typecheck/lint limpos; zero mudança em produção. Resumo em `tests/test-summary-13-3.md`. |
| 2026-07-24 | code-review (story-automator, auto-fix): **0 críticos** — alegações da story re-executadas e confirmadas (Vitest 89/948, typecheck/lint, E2E 41). Corrigidos 4 médios + 3 baixos: destino ativo do sheet por **prefixo** (rotas de histórico das collections abriam o sheet sem nenhum ativo), foco inicial do sheet a partir dos destinos **visíveis** (grupo recolhido desmonta os filhos), foco inicial **armado só na abertura** (o `autoFocus` roubava o foco do agrupador a cada reexpansão — WCAG 3.2.1), assert que faltava no caso negativo de prefixo da `ShellBottomNav`, `menuOpen` resetado ao sair do compact (o sheet reabria sozinho ao voltar), derivação dos atalhos movida de escopo de módulo para o render, nomes de teste do `RouteAnnouncer`. +4 testes (todos provados não-vacuosos revertendo a correção). Gates finais: **Vitest 89/952**, typecheck/lint limpos, **E2E shell 41 passed**. Dívidas registradas p/ 13.4: SHELL-DEBT-03 (ativo exato na `ShellSidebar`), SHELL-DEBT-04 (collections avulsas por `id` hardcoded), duplicação de item/grupo entre sidebar e sheet. Status → done. |
| 2026-07-24 | dev-story: implementação completa — `shellDestinations.ts` (derivação pura compartilhada), `ShellBottomNav` (3 atalhos + Menu, landmark "Atalhos de navegação"), `ShellNavigationSheet` (conteúdo canônico, foco no ativo, termina acima da barra), captura persistente (FAB compact + âncora na sidebar + `BrainDumpCaptureSheet` único), offline `aria-disabled` com motivo (DIV-8), token bottom-nav 56→64px (DIV-9), SHELL-DEBT-01 fechada (gate axe compact inclui a barra). Vitest 89/948 (907 herdados + 41 novos), typecheck/lint limpos, E2E shell 27 passed (8 novos) via Postgres local `bujo_e2e`. Desvios documentados: RouteAnnouncer mobile via sheet; badge assert 2×; `keepMounted: false` no sheet. Status → review. |
