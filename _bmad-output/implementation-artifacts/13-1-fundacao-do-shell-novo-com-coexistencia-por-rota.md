---
baseline_commit: ee50f102dd8c58f12d2ac8c34b899f341fd1ea89
---

# Story 13.1: Fundação do shell novo com coexistência por rota

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero o novo AppLayout (topbar 56px, canvas contínuo, workspace máx. 1440px) ativável rota a rota,
Para que a migração aconteça superfície a superfície com rota segura de rollback (UX-DR21, UX-DR22, UX-DR30; CAP-3).

## Acceptance Criteria

1. **Shell novo consome exclusivamente os tokens canônicos**

   **Dado que** o design system novo (tokens do `DESIGN.md` 2026-07-17),
   **Quando** o AppLayout novo é implementado,
   **Então** existe uma **camada de tokens única** com os valores canônicos (estruturais + papéis semânticos de cor Mineral Light/Dark), e o shell consome dela topbar `56px`, canvas, workspace máx. `1440px` e gutters `32/24/16px` — **zero literais estruturais nos componentes do shell**,
   **E** os tokens que esta story ainda não aplica (sidebar `240/64px`, badge, capture-action, mobile sheet) já ficam exportados para as Stories 13.2–13.4 consumirem, sem alterar a `Sidebar`/`BottomNav` atuais aqui.

2. **Coexistência por rota com rollback documentado por superfície**

   **Dado que** o legado continua vivo até a Onda 6,
   **Quando** uma rota autenticada é resolvida,
   **Então** um **registro por rota** (dados puros) decide qual casca renderiza — shell novo ou `AppLayout` legado — e se a superfície interna já foi migrada,
   **E** o rollback de qualquer superfície é **uma linha** nesse registro, documentada no artefato de rollback da story.

3. **Seam legado aplicado conforme a spec da 13.0**

   **Dado que** o tratamento aprovado na x.0 (Seam A — faixa editorial),
   **Quando** uma superfície ainda legada renderiza dentro do shell novo,
   **Então** aparece um aviso editorial persistente **no início do conteúdo**, com `{components.legacy-seam}`, sem toggle Legado/Moderno, sem moldura em volta do conteúdo e **sem poder ser dispensado**,
   **E** o aviso desaparece exclusivamente quando o registro marca aquela rota como migrada.

4. **Contrato acessível do shell**

   **Dado que** o `Accessibility Floor` do `EXPERIENCE.md`,
   **Quando** o shell novo renderiza,
   **Então** o **primeiro controle focável é `Pular para o conteúdo`**, a topbar é `header`, existe **exatamente um `main` por rota** (o da página — o shell não introduz outro) e a mudança de rota continua anunciada uma única vez pelo `RouteAnnouncer`,
   **E** controle focado nunca fica encoberto por topbar, bottom nav, FAB ou safe-area (scroll padding/margin reservados),
   **E** os atalhos `[` e `B` seguem funcionando com o mesmo escopo de hoje.

5. **axe-core no Playwright operacional**

   **Dado que** WCAG 2.2 AA precisa ser testável (revisão party-mode),
   **Quando** esta story fecha,
   **Então** `@axe-core/playwright` está instalado, com helper reutilizável e **pelo menos um spec verde** rodando axe numa rota do shell em wide e em compact,
   **E** o helper é a base que a Story 13.4 amplia para a matriz wide/medium/compact completa.

6. **Checklist de paridade enumerada como artefato**

   **Dado que** as Stories 13.2–13.4 consomem esse contrato,
   **Quando** o inventário do shell real é feito,
   **Então** existe o artefato `_bmad-output/implementation-artifacts/13-shell-parity-checklist.md` com itens **enumerados e verificáveis** de ações, estados, atalhos, badges, navegação, dados, comandos e estados vazios/loading/error/offline,
   **E** cada item nasce do código atual (não de suposição), com o arquivo/linha de origem.

7. **Nenhuma regressão funcional**

   **Dado que** o app inteiro passa a renderizar dentro do shell novo,
   **Quando** a suíte roda,
   **Então** os 3 testes compartilhados (`AppLayout`/`router`/`RouteAnnouncer`) e toda a suíte Vitest seguem verdes **sem mocks novos de Query** (o registro do shell é dados puros),
   **E** a suíte E2E existente segue verde.

## Tasks / Subtasks

- [x] **1. Camada de tokens canônicos do design system novo** (AC: 1)
  - [x] Criar `frontend/src/shared/design/tokens.ts` — **dados puros**, sem React, sem MUI, sem side effects.
  - [x] Exportar os tokens **estruturais** do `DESIGN.md` frontmatter: `sidebar-expanded: 240px`, `sidebar-collapsed: 64px`, `topbar-height: 56px`, `workspace-max-width: 1440px`, `reading-width: 800px`, `gutter-wide: 32px`, `gutter-medium: 24px`, `gutter-compact: 16px`, `touch-target-min: 44px`, `bottom-nav-items: 4`, `bottom-nav-configurable-items: 3`, spacing 4px, radius `sm 2 / md 4 / lg 8 / full 9999`, `focus-ring` (cor `#166C9C`, width 2px, offset 2px).
  - [x] Exportar os **papéis semânticos de cor** de **Mineral Light** (aliases sem prefixo) e **Mineral Dark** — exatamente os valores do frontmatter (`canvas #F5F2EA`, `surface #FBFAF6`, `surface-subtle #EEEBE2`, `surface-strong #E3DFD5`, `ink #25231F`, `ink-muted #666159`, `ink-disabled #969087`, `border #D6D1C7`, `border-strong #AAA399`, `control-border #666159`, `primary #315F5A`, `primary-hover #274D49`, `primary-soft #DDEAE7`, `on-primary #FFFFFF`, `info #3D6488`, `info-soft #E2EBF3`, `focus #166C9C`, `overlay #25231F7A` + a coluna `mineral-dark-*`).
  - [x] Aplicar os tokens como **CSS custom properties com prefixo `--ds-`** no elemento raiz do shell novo (ex.: `--ds-canvas`, `--ds-topbar-height`). Motivo: `sx`/CSS vars afetam apenas quem as lê — o conteúdo legado dentro do shell **não** é repintado, que é exatamente o que o seam promete.
  - [x] **NÃO alterar `frontend/src/theme.ts`.** A paleta MUI vigente é o sistema legado e a troca global de tema acontece só na consolidação (Épico 18) — ver `migration-plan.md`, nota de promoção 2026-07-23.
  - [x] Modelar a forma `{família}-{modo}-{papel}` na tipagem (Mineral Light = alias sem prefixo), mas **wirar somente Mineral**; as outras três famílias e o seletor de aparência são da Story 18.1.

- [x] **2. Shell novo — layout, topbar e workspace** (AC: 1, 4)
  - [x] Criar `frontend/src/app/layout/shell/ShellLayout.tsx` (novo componente; **não** editar `AppLayout.tsx`, que permanece como casca de rollback).
  - [x] Composição wide/medium/tablet: grid `[coluna de navegação][shellbody]`, onde `shellbody` é `grid-template-rows: {topbar-height} minmax(0,1fr)`. **A topbar não atravessa a coluna da navegação** — começa depois dela (mockup `key-app-shell-13-0.html`, `.browser`/`.shellbody`).
  - [x] `ShellTopbar.tsx`: altura `56px`, `component="header"`, composição **"superfície como protagonista"** — mostra o nome da superfície atual (mesma fonte de verdade do `RouteAnnouncer`: `handle.title` do match mais profundo, via `useMatches()`). Sem marca, sem breadcrumb, sem ações globais não contratadas.
  - [x] A topbar é **texto estático**, nunca live region — o anúncio de rota continua exclusivo do `RouteAnnouncer` (`EXPERIENCE.md`: "Título visual e RouteAnnouncer nunca repetem a mesma mensagem").
  - [x] Workspace: `background: canvas` contínuo, `max-width: 1440px`, gutter `32px` (≥1440), `24px` (768–1439) e `16px` (<768), scroll interno próprio.
  - [x] Compact (<768px): topbar **passa a existir** (hoje o mobile não tem topbar) + o `BottomNav` atual continua sendo renderizado; preservar o `padding-bottom` que reserva bottom nav + safe-area (hoje `calc(56px + env(safe-area-inset-bottom, 0px) + 8px)` em `AppLayout.tsx:55`).
  - [x] Dentro do shell novo, seguir renderizando os componentes **atuais** `Sidebar` e `BottomNav` sem alterá-los: a sidebar derivada do manifest é a Story 13.2 e a bottom nav de 3 atalhos + Menu é a 13.3.
  - [x] Preservar integralmente os atalhos `[` (toggle da sidebar) e `B` (Brain Dump) com os mesmos guards de hoje (`AppLayout.tsx:25-49`: ignora campo editável; `B` só sem `ctrl/meta/alt`).
  - [x] Preservar o `<RouteAnnouncer />` dentro do shell.

- [x] **3. Contrato acessível do shell** (AC: 4)
  - [x] `SkipLink.tsx`: **primeiro elemento focável do documento**, rótulo `Pular para o conteúdo`, visualmente oculto até receber foco (padrão do mockup: `transform: translateY(-160%)` → `.skip:focus { transform: none }`).
  - [x] Alvo do skip link = wrapper de conteúdo do shell com `id` estável e `tabIndex={-1}`, imediatamente em volta do `<Outlet />`. **Decisão deliberada:** o shell **não** renderiza `<main>` — as páginas já renderizam o seu (`<main aria-label="…">`) e existem testes de regressão explícitos contra um segundo `main` (`frontend/src/app/router.test.tsx:133`, `frontend/src/app/layout/RouteAnnouncer.test.tsx:125`). O wrapper focável preserva o "um único `main` por rota" e ainda entrega o pulo de foco.
  - [x] Reservar espaço para chrome fixo/sticky: `scroll-padding-top` = altura da topbar (+ `--dev-banner-height`), `scroll-padding-bottom` = bottom nav + FAB + `env(safe-area-inset-bottom)` no compact. Nenhum controle focado pode ficar encoberto.
  - [x] Landmarks nomeados: topbar = `header`; a `nav` "Navegação principal" já existe na `Sidebar` (`Sidebar.tsx:148`) e não deve ser duplicada.
  - [x] Focus ring do shell conforme `{components.focus-ring}` (cor `focus`, 2px, offset 2px).
  - [x] Respeitar `body.dev-env` (`frontend/src/index.css:18-29`): o banner de DEV empurra o documento em `--dev-banner-height` e reposiciona o paper do Drawer permanente. Verificar em dev que a topbar do shell não cobre nem é coberta pelo `DevEnvBanner` nem pelo `SessionExpiredBanner`. — o `ShellLayout` desconta `--dev-banner-height` na altura e no `scroll-padding-top`; validado via E2E `shell-a11y` (que roda com `DevEnvBanner` real no dev server).

- [x] **4. Coexistência por rota e rollback por superfície** (AC: 2, 3)
  - [x] Criar `frontend/src/app/layout/shell/shellRouting.ts` — **dados puros** (sem hooks, sem TanStack Query, sem env, sem side effects), no mesmo espírito do manifest da 12.3 (AD-17).
  - [x] Forma de cada entrada: `{ routeId, shell: 'new' | 'legacy', surfaceMigrated: boolean }`, cobrindo todas as rotas autenticadas do `router.tsx` (núcleo + as derivadas do registro de collections).
  - [x] Estado inicial desta story: **todas as rotas com `shell: 'new'` e `surfaceMigrated: false`** — o shell é novo em todo o app e toda superfície interna ainda é legada (logo, toda rota mostra o seam).
  - [x] `ProtectedLayout` (`router.tsx:44`) escolhe a casca lendo a entrada da rota ativa via `useMatches()` (mesmo mecanismo do `RouteAnnouncer`) — `ShellLayout` ou o `AppLayout` legado intocado.
  - [x] **Rollback = trocar `'new'` por `'legacy'` naquela entrada.** Documentar o procedimento (arquivo, campo, efeito, como verificar) numa seção própria do artefato de paridade da Task 6.
  - [x] Não introduzir flag de ambiente, feature flag remota ou toggle de UI. A coexistência é declarativa e por rota; `Legado/Moderno` como seletor visível está **explicitamente rejeitado** (reconcile 13.0).

- [x] **5. Legacy Seam Notice** (AC: 3)
  - [x] `LegacySeamNotice.tsx` renderizado pelo shell **no início do conteúdo** (antes do `<Outlet />`), quando `surfaceMigrated === false`.
  - [x] Visual por token: `background {colors.info-soft}`, `foreground {colors.info}`, `border-left: 3px solid {colors.info}` (`{components.legacy-seam}`). Faixa editorial — não envolve o conteúdo numa moldura nova.
  - [x] Texto aprovado no mockup: **"Esta área ainda usa a versão anterior. Você pode continuar trabalhando normalmente enquanto esta superfície é atualizada."** Voz pt-BR direta, sem desculpa nem celebração.
  - [x] Sem botão de dispensar, sem `localStorage`, sem toggle. Persistente enquanto a rota for legada.
  - [x] Não é `role="alert"` (não é erro e não pode ser anunciado a cada rota) — é conteúdo estático no fluxo de leitura. Renderizado como `aside` (landmark `complementary`) para não ficar solto fora do `main` (regra `region` do axe nos 3 testes de chrome).

- [x] **6. Checklist de paridade enumerada do shell** (AC: 6)
  - [x] Criar `_bmad-output/implementation-artifacts/13-shell-parity-checklist.md`.
  - [x] Inventariar do **código real** (não de memória) e enumerar: destinos e ordem da `Sidebar` (`Sidebar.tsx:58-83`), destinos e ordem da `BottomNav` (`BottomNav.tsx:30-38, 68-72`), grupos colapsáveis Planner/Saúde e seu comportamento, indicação de ativo (borda + fundo + peso + `aria-current`), colapso 240↔56px e o atalho `[`, atalho `B`, badge do Brain Dump, FAB de captura (aria-label online/offline, `disabled` offline, tooltip "Sem conexão"), `BrainDumpCaptureSheet`, anúncio de rota, `pb` do bottom nav/safe-area.
  - [x] Enumerar os estados exigidos pelo aceite da 13.4: vazio, loading, error, offline, disabled, readonly — com o comportamento **atual** de cada um no shell.
  - [x] Cada item: `[ ] ID | item | comportamento atual | origem (arquivo:linha) | status`.
  - [x] Registrar as divergências já contratadas (não são bugs): colapsada `56px` hoje × `64px` no contrato novo; bottom nav de 4 destinos fixos hoje × 3 configuráveis + Menu; mobile sem topbar hoje; Saúde hoje usa ícone `FavoriteBorder` × `first-aid-kit` no catálogo novo. Marcar cada uma com a story que resolve (13.2/13.3).
  - [x] Incluir a seção **Rollback por superfície** da Task 4.

- [x] **7. axe-core no Playwright** (AC: 5)
  - [x] Adicionar `@axe-core/playwright` como devDependency do `frontend/`.
  - [x] Criar `frontend/e2e/axeHelper.ts`: função que roda `AxeBuilder` com as tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` e falha com o detalhe das violações (id, impacto, seletores) — mensagem acionável, não `expect(violations).toEqual([])` cru.
  - [x] Criar `frontend/e2e/shell-a11y.spec.ts` usando a fixture existente (`e2e/fixtures.ts` — signup real por teste): roda axe em `/today` no shell novo, em wide e em compact.
  - [x] Compact via `test.use({ viewport: { width: 320, height: 720 } })` **dentro do spec**, não como novo project do `playwright.config.ts` — um project novo multiplicaria a suíte E2E inteira. A matriz completa wide/medium/compact é da Story 13.4.
  - [x] O spec precisa passar de verdade. Se o axe apontar violação preexistente do conteúdo legado (fora do shell), **não** silenciar globalmente: restringir o escopo do `AxeBuilder` ao chrome do shell nesta story e registrar a dívida no artefato de paridade para a 13.4. — `exclude: 'main'` (conteúdo legado) + exclusão da bottom nav legada no compact (SHELL-DEBT-01), ambas registradas no checklist.

- [x] **8. Testes e verificação** (AC: 1–7)
  - [x] Testes unitários novos em `frontend/src/app/layout/shell/`: `ShellLayout.test.tsx` (topbar com o título da superfície; skip link é o primeiro focável; **nenhum `<main>` novo**; atalhos `[`/`B`; `pb` do bottom nav no compact), `LegacySeamNotice.test.tsx` (visível quando `surfaceMigrated=false`, ausente quando `true`, sem controle de dispensar), `shellRouting.test.ts` (toda rota autenticada do `router.tsx` tem entrada; forma dos dados; ausência de import de Query/hooks).
  - [x] Rodar `jest-axe` nos componentes novos, como o resto do chrome já faz (`AppLayout.test.tsx`, `Sidebar.test.tsx`, `BottomNav.test.tsx`, `router.test.tsx`, `RouteAnnouncer.test.tsx` já importam `axe`).
  - [x] Rodar a suíte Vitest completa e **colar a contagem observada** (baseline desta story: **81 arquivos / 828 testes**, `npm run test:run` em 2026-07-24). Derivar "herdados + novos" contando o diff, nunca por subtração. — observado **85 arquivos / 881 testes** (ver Completion Notes).
  - [x] Rodar `npm run typecheck` e `npm run lint` (a regra de boundary do ESLint vale: `shared/` não importa `app/` nem `features/`). — ambos limpos.
  - [x] Rodar a suíte E2E — `nvm use 22.15.1` antes de qualquer comando de frontend/e2e. — **confirmado** (workers:1 contra branch Neon `e2e`): a única regressão da 13.1 (`gratitude-history.spec.ts`) foi corrigida e está 100% verde; as 4→3 falhas restantes são pré-existentes ao baseline `ee50f10` (ver Completion Notes).

## Dev Notes

### Fronteira desta story (o que é 13.1 e o que NÃO é)

| Entrega | Story |
|---|---|
| Casca nova (topbar, canvas, workspace, gutters), tokens, skip link, seam, coexistência por rota, axe-core, checklist de paridade | **13.1 (esta)** |
| Sidebar nova 240/64px derivada do manifest, catálogo Phosphor, badge na sidebar, grupos | 13.2 |
| Bottom nav de 3 atalhos + Menu, sheet de navegação completa, captura persistente/FAB novo | 13.3 |
| Passe de paridade completo + matriz axe wide/medium/compact | 13.4 |
| Configurações → Aparência (4 famílias × Light/Dark, persistência por conta) e Navegação mobile | 18.1 |

**Fora de escopo — não fazer nesta story:**

- Instalar `@phosphor-icons/react` ou trocar ícones. O catálogo é consumido pela sidebar/bottom nav novas (13.2/13.3); o shell de 13.1 não precisa de ícone novo.
- Alterar `theme.ts`, `Sidebar.tsx`, `BottomNav.tsx`, `AppLayout.tsx` ou qualquer página. O `AppLayout.tsx` legado é a rota de rollback e precisa continuar funcionando.
- Implementar as 4 famílias cromáticas, o modo Sistema, o seletor de aparência ou a persistência por conta (Story 18.1).
- Persistir estado de colapso da sidebar. Contrato novo: **somente na sessão**, nada no banco nem no navegador (`EXPERIENCE.md` §App shell; explicitamente rejeitado no reconcile da 13.0).
- Backend, schema, OpenAPI, `types.gen.ts`. Story 100% frontend.

### Estado atual do código a preservar (arquivos UPDATE lidos)

**`frontend/src/app/layout/AppLayout.tsx` (permanece intocado — casca de rollback)**
- Hoje: alterna `Sidebar` (≥768px) e `BottomNav` (<768px) por `useMediaQuery`; **mobile não tem topbar**; `sidebarCollapsed` é estado local não persistido; `useEffect` colapsa a sidebar em tablet; atalhos `[`/`B` registrados só quando `isDesktop` (≥1024px), com guard de campo editável e de `ctrl/meta/alt` no `B`; mobile aplica `pb: calc(56px + env(safe-area-inset-bottom, 0px) + 8px)`.
- O shell novo precisa **reproduzir** todos esses comportamentos. Perder o guard de `ctrl/meta/alt` no `B` sequestra `Cmd+B`/`Ctrl+B` do navegador — o comentário no código explica que é o mesmo cuidado do atalho `N` em `DailyPage.tsx`.

**`frontend/src/app/router.tsx`**
- `ProtectedLayout` (linha 44) é o único ponto que monta a casca autenticada — é ali que a escolha shell novo × legado entra.
- Rotas de collection vêm do registro por map puro, embrulhadas em `<Suspense fallback={null}>`; rotas de núcleo são eager e hardcoded (mudar isso quebra os testes síncronos de chrome — ver Dev Notes da 12.3).
- Todo route tem `handle: { title }` — é a fonte do `RouteAnnouncer` e passa a ser também a do título da topbar.

**`frontend/src/app/layout/RouteAnnouncer.tsx`**
- `role="status"` + `aria-live="polite"`, lê o `handle.title` do match mais profundo. Não duplicar: a topbar exibe o mesmo texto **visualmente**, sem ser live region.

**`frontend/src/app/layout/Sidebar.tsx` / `BottomNav.tsx` (renderizados pelo shell novo, sem alteração)**
- `Sidebar` é `Drawer variant="permanent"` — o paper é `position: fixed` na coluna esquerda; por isso a topbar do shell novo **não pode ser full-width**, tem de viver na coluna do `shellbody` (que é exatamente a composição do mockup aprovado).
- `Sidebar` já entrega ativo por borda + fundo + peso + `aria-current="page"` e `nav aria-label="Navegação principal"`.
- `BottomNav` já tem FAB com `aria-label` que muda offline, `disabled` offline com `Tooltip` "Sem conexão" (o `<span>` em volta do FAB é obrigatório — Tooltip não recebe eventos de elemento disabled) e o `BrainDumpCaptureSheet`.

**`frontend/src/index.css`**
- `body.dev-env` adiciona `padding-top: var(--dev-banner-height)` (28px) e reposiciona `.MuiDrawer-docked .MuiDrawer-paper` (`top`/`height`). Qualquer chrome sticky do shell novo precisa considerar `--dev-banner-height`.

**`frontend/src/app/providers/index.tsx`**
- `ColorModeContext` com `light`/`dark` em `localStorage` (`bujo-color-scheme`) alimenta `createBujoTheme`. **Continua exatamente como está** nesta story; a preferência por conta é da 18.1.

### Contrato do shell — números que o dev não deve inventar

| Item | Valor | Fonte |
|---|---|---|
| Topbar | `56px` | `DESIGN.md` `{components.app-shell.topbar-height}` |
| Sidebar expandida / rail | `240px` / `64px` | `{components.app-shell.sidebar-expanded/collapsed}` |
| Workspace máx. / leitura | `1440px` / `800px` | `{components.workspace}` |
| Gutter wide / medium / compact | `32px` / `24px` / `16px` | `{components.app-shell.gutter-*}` |
| Faixas | ≥1440 wide · 1024–1439 medium · 768–1023 tablet · <768 compact | `EXPERIENCE.md` §Responsive & Platform |
| Início da sidebar | expandida em wide/medium; **rail em tablet** | `DESIGN.md` §App Shell |
| Touch target | mínimo `44×44px` (frequentes compactos `48px`) | `EXPERIENCE.md` §Accessibility Floor |
| Focus ring | `#166C9C`, 2px, offset 2px | `{components.focus-ring}` |
| Seam | `info-soft` / `info` / borda-esquerda 3px `info` | `{components.legacy-seam}` |

### Coexistência: por que é assim

- O shell é chrome **global** — não existem duas cascas simultâneas na mesma rota. "Coexistência por rota" significa: (a) qual casca aquela rota monta, (b) se a **superfície interna** daquela rota já foi migrada (o que liga/desliga o seam).
- Depois desta story, **toda** rota autenticada mostra o seam. É o comportamento contratado (`EXPERIENCE.md` §State Patterns, `Seam legado`), não um efeito colateral: ele some rota a rota conforme as Ondas 3–5 migram cada superfície.
- Prod permanece no sistema atual durante as ondas; a coexistência e o rollback por superfície são mecanismos de **dev/homologação**. Rollback de prod = não promover (`migration-plan.md`, nota de promoção 2026-07-23; fluxo `dev` → `main` vigente desde 2026-07-22).
- O registro é dados puros pelo mesmo motivo do manifest (AD-17): server state no chrome obriga mocks de Query nos 3 testes compartilhados. Manter puro é o que preserva o AC 7.

### Tokens: por que uma camada nova em vez de reescrever `theme.ts`

- `theme.ts` é a paleta de 2026-06-15 (o sistema **legado**) e é consumida por todas as superfícies internas, que continuam legadas até suas ondas.
- Repintar `theme.ts` agora repintaria ~20 superfícies não validadas de uma vez, contradiria o seam ("esta área ainda usa a versão anterior") e é exatamente o risco "dois sistemas contaminarem tokens globais" do `migration-plan.md`.
- CSS custom properties `--ds-*` no root do shell só afetam quem as lê. Um `ThemeProvider` aninhado **não** serviria: ele vazaria a paleta nova para todo o conteúdo legado por herança de contexto.
- A troca global de tema é aceitável **na consolidação** (Épico 18), não aqui.

### Riscos concretos desta story

1. **Segundo `main`.** Dois testes já guardam isso (`router.test.tsx:133`, `RouteAnnouncer.test.tsx:125`). Se o shell renderizar `<main>`, eles quebram — e mais importante, o contrato de landmark do `EXPERIENCE.md` também.
2. **Topbar full-width sobre a sidebar fixa.** O paper do Drawer permanente é `position: fixed`; uma topbar `100%` no topo cobre o botão de colapso. A composição correta é `[sidebar][topbar + workspace]`.
3. **Atalhos silenciosamente perdidos.** `[` e `B` estão hoje no `AppLayout`; ao mover a montagem para o shell novo, se o `useEffect` não vier junto (com os mesmos guards), os atalhos somem sem nenhum teste vermelho fora dos testes do próprio `AppLayout` legado.
4. **`pb` do bottom nav perdido no mobile.** Sem ele, a última linha de conteúdo fica sob a bottom nav — e o aceite acessível exige que o **último** controle seja alcançável a 320 CSS px.
5. **Regressão do banner de DEV.** As regras de `index.css` assumem a geometria atual do Drawer; validar visualmente com `body.dev-env` ativo.
6. **Literais estruturais.** O AC 1 é medível: qualquer `56`, `240`, `1440`, `32` cravado nos componentes do shell é falha de aceite.

### Project Structure Notes

Arquivos previstos (`NEW` salvo indicação):

```
frontend/src/shared/design/tokens.ts                          NEW  (dados puros; primitivo sem dono — §7.2)
frontend/src/app/layout/shell/ShellLayout.tsx                 NEW
frontend/src/app/layout/shell/ShellTopbar.tsx                 NEW
frontend/src/app/layout/shell/SkipLink.tsx                    NEW
frontend/src/app/layout/shell/LegacySeamNotice.tsx            NEW
frontend/src/app/layout/shell/shellRouting.ts                 NEW  (dados puros)
frontend/src/app/layout/shell/*.test.tsx|*.test.ts            NEW
frontend/src/app/router.tsx                                   UPDATE (só ProtectedLayout escolhe a casca)
frontend/e2e/axeHelper.ts                                     NEW
frontend/e2e/shell-a11y.spec.ts                               NEW
frontend/package.json                                         UPDATE (+ @axe-core/playwright)
_bmad-output/implementation-artifacts/13-shell-parity-checklist.md   NEW
```

- `app/` = composição com dono (chrome, rotas, providers); `shared/` = primitivos sem dono. Os tokens vão para `shared/design/` porque 13.2–13.4, o Épico 14 e os módulos futuros também os consomem — não são propriedade do shell (§7.1/§7.2 da arquitetura).
- A regra de boundary do ESLint continua valendo: `features/<x>` nunca importa outra feature; `shared/` não importa `app/`.
- `e2e/shell-a11y.spec.ts` e `e2e/axeHelper.ts` são **artefatos de tipo novo** — nomeá-los explicitamente na File List final (guardrail recorrente das retros dos Épicos 3/4/11/12).

### Testing Requirements

- **Vitest + Testing Library + `jest-axe`** para o chrome novo, no padrão já usado por `AppLayout.test.tsx`/`Sidebar.test.tsx` (mock de `matchMedia` por faixa, `createMemoryRouter`, mock do barrel `../../features/braindump`).
- **Playwright** para o E2E acessível: `nvm use 22.15.1` antes; a suíte roda com `workers: 1` contra a branch Neon `e2e`. Esta story **não** cria migration, então não há passo de migration na branch `e2e`.
- **CI não roda Vitest nem Playwright** (arquitetura §7.4 — decisão mantida na Story 2.4): a rede de segurança é a execução local + code review. Rodar tudo localmente antes de fechar a story é obrigatório, não opcional.
- Contagens em Completion Notes: rodar o comando real e colar a saída literal; derivar herdados/novos pelo diff, nunca por subtração.

### Previous Story Intelligence

**Story 13.0 (gate de UX, `done` em 2026-07-24)** — contratos que esta story consome:
- `DESIGN.md` e `EXPERIENCE.md` foram **promovidos a canônicos** e vencem sobre qualquer mockup em conflito. Os dois mocks aprovados (`mockups/key-app-shell-13-0.html`, `mockups/key-settings-appearance-nav-13-0.html`) são referência de composição.
- Decisões diretamente vinculantes aqui: topbar **B** ("superfície protagonista", sem marca/breadcrumb), seam **A** (faixa editorial persistente), captura **A** (ancorada na navegação em desktop/tablet; FAB circular no compact), colapso **só na sessão**.
- Explicitamente **rejeitados** (não reintroduzir): toggle Legado/Moderno, seam na topbar ou como contorno do conteúdo, aviso dispensável, preferência de sidebar persistida, captura na topbar, FAB estendido com label.
- A 13.0 já mapeou o que cada story destrava — a linha da 13.1 é: "AppLayout novo, topbar 56px, canvas contínuo, workspace 1440px, coexistência por rota e checklist de paridade".

**Story 12.3 (manifest de collections)** — padrão a imitar:
- Registro em `app/` porque os consumidores são o chrome; **dados puros** justamente para não obrigar mocks de Query nos 3 testes compartilhados. `shellRouting.ts` segue a mesma disciplina.
- Aceite da 12.3 foi "pixel-idêntico". O aceite **desta** story não é: o shell muda de propósito. O que **não** pode mudar é comportamento (destinos, atalhos, badges, estados).

**Retros recentes (guardrails ativos):**
- File List precisa nomear artefatos de tipo novo (specs E2E, helpers) — a classe de achado sobreviveu 4 épicos.
- Reconciliar File List contra `git status --short` **depois** de qualquer passo pós-dev (QA/E2E), não só ao fim do dev-story.
- `Typography` com variante custom usada como bloco precisa de `component="div"` — relevante para o texto do seam e o título da topbar se usarem variantes custom.

### Git Intelligence

- `7b866dc feat(story-12.3): Manifest de collections, fatia 1` — último commit que tocou o chrome (`registry.ts`, `router.tsx`, `Sidebar.tsx`, `BottomNav.tsx`). É o estado que esta story encontra.
- `12.4`–`12.6` (`d94ab48`, `931ccc5`, `0e46e4b`) são backend puro (automação) — sem impacto no frontend.
- `c6ff96e feat(frontend): distinção visual DEV × PROD` introduziu `DevEnvBanner` + as regras de `index.css` que o shell novo precisa respeitar.
- Branch de trabalho: `dev` (homologação). `main` = prod, só após homologar.

### Pesquisa técnica

- **Versões resolvidas no lockfile** (respeitar, não interpretar o piso semver como versão instalada): MUI Material `6.5.0`, TanStack Query `5.101.1`, React `19.2.x`, React Router `6.30.x`, Vite `8.x`, Vitest `4.1.9`, Playwright `1.61.x`. **Esta story não faz upgrade de dependência** — só adiciona `@axe-core/playwright`.
- `@axe-core/playwright` é o pacote oficial da Deque para Playwright (`AxeBuilder`), compatível com `@playwright/test` 1.x; usar tags WCAG explícitas em vez do ruleset default para alinhar o gate ao piso 2.2 AA do projeto.
- `jest-axe` já está instalado e em uso em 20+ testes — não trocar de ferramenta no nível unitário.
- WCAG 2.2 AA relevante ao shell: `2.4.1 Bypass Blocks` (skip link), `2.4.7 Focus Visible`, `2.4.11 Focus Not Obscured (Minimum)` (novo em 2.2 — motivo do scroll padding), `1.4.10 Reflow` (320 CSS px), `2.5.8 Target Size (Minimum)` 24×24 — o projeto mantém piso mais forte de 44×44.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-13.1-Fundação-do-shell-novo-com-coexistência-por-rota]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-13-Onda-2a--App-Shell-no-Sistema-Novo]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR21] · [Source: …#UX-DR22] · [Source: …#UX-DR30]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md#App-Shell]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md#Layout--Spacing]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Information-Architecture]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Accessibility-Floor]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#State-Patterns]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Responsive--Platform]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#UX-Acceptance-Criteria]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/reconcile-story-13-0-app-shell.md]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/architecture-and-story-handoff.md#Contrato-acessível-do-shell]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/mockups/key-app-shell-13-0.html]
- [Source: _bmad-output/specs/spec-design-system-migration/SPEC.md#CAP-3]
- [Source: _bmad-output/specs/spec-design-system-migration/migration-plan.md#Critérios-por-onda]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-17]
- [Source: _bmad-output/planning-artifacts/architecture.md#7.1-Árvore-do-Projeto] · [Source: …#7.2-Fronteiras-Arquiteturais] · [Source: …#7.4-Configuração-Build-Testes--Deploy]
- [Source: _bmad-output/implementation-artifacts/13-0-ux-spec-do-app-shell-novo.md]
- [Source: frontend/src/app/layout/AppLayout.tsx] · [Source: frontend/src/app/layout/Sidebar.tsx] · [Source: frontend/src/app/layout/BottomNav.tsx] · [Source: frontend/src/app/layout/RouteAnnouncer.tsx] · [Source: frontend/src/app/router.tsx] · [Source: frontend/src/index.css] · [Source: frontend/src/theme.ts]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8)

### Debug Log References

- `jest-axe`/`axe` real divergem no `color-contrast`: em jsdom (unit) a regra não roda (sem layout), no browser (Playwright) roda. O label não-selecionado da `BottomNav` legada reprova `color-contrast` só no axe real — dívida legada (SHELL-DEBT-01), não regressão do shell. Excluída do gate compact e registrada no checklist.
- A regra `region` do axe ("All page content should be contained by landmarks") quebrou os 3 testes de chrome quando o seam era um `<p>` solto no wrapper focável (que não é `main`). Corrigido tornando o `LegacySeamNotice` um `aside` (landmark `complementary`).
- jsdom não implementa `Element.scrollIntoView`; o `SkipLink` chama `target.scrollIntoView?.(…)` (opcional) — o pulo de foco não depende dele.
- Teste de "dados puros" do `shellRouting.ts` lê o próprio fonte via `import '…?raw'` (suportado por `vite/client`), evitando tipos de node no `tsconfig.app.json`.

### Completion Notes List

Implementação 100% frontend, na branch `dev`. Nenhuma alteração em `theme.ts`, `Sidebar.tsx`, `BottomNav.tsx`, `AppLayout.tsx` ou páginas (todos preservados como legado/rollback). Único UPDATE de fonte: `router.tsx` (só `ProtectedLayout` escolhe a casca).

**AC atendidos:**
1. **Tokens canônicos** — `shared/design/tokens.ts` (dados puros) com estruturais + Mineral Light/Dark; aplicados como `--ds-*` na raiz do shell. Zero literais estruturais nos componentes do shell (toda geometria vem de `var(--ds-*)`). Sidebar 240/64, badge, capture-action e mobile-sheet já exportados para 13.2–13.4; `theme.ts` intocado.
2. **Coexistência por rota** — `shellRouting.ts` (dados puros) cobre todas as rotas autenticadas; `ProtectedLayout` lê a entrada ativa via `useMatches()`. Rollback = 1 linha (`new`→`legacy`), documentado no checklist.
3. **Seam A** — `LegacySeamNotice` no início do conteúdo, faixa editorial por token, texto aprovado, sem dispensar/toggle, não é `role=alert`; some quando `surfaceMigrated=true`.
4. **Contrato acessível** — skip link primeiro focável; topbar = `header`; exatamente um `main` por rota (shell não introduz outro); RouteAnnouncer único; scroll padding reserva topbar/bottom nav/FAB/safe-area; atalhos `[`/`B` com os mesmos guards e escopo desktop.
5. **axe-core** — `@axe-core/playwright` instalado; `axeHelper.ts` com tags WCAG 2.2 AA e mensagem acionável; `shell-a11y.spec.ts` verde em wide e compact.
6. **Checklist de paridade** — `13-shell-parity-checklist.md` enumerado do código real, com estados 13.4, divergências contratadas, dívidas e seção de rollback.
7. **Sem regressão** — 3 testes compartilhados + suíte Vitest completa verdes **sem mock novo de Query** (registro é dados puros).

**Contagens de teste (comando real, saída literal):**
- **Vitest** — `npm run test:run`: **85 arquivos / 881 testes, todos passando** (2026-07-24).
  - Baseline desta story (re-executada no início): **81 arquivos / 828 testes**.
  - Diff (contado, não subtraído): **+4 arquivos de teste novos** — `tokens.test.ts`, `ShellLayout.test.tsx`, `LegacySeamNotice.test.tsx`, `shellRouting.test.ts` — somando **+53 testes** (16 + 22 + 6 + 9). 828 herdados + 53 novos = 881.
- **typecheck** (`npm run typecheck`) e **lint** (`npm run lint`): limpos.
- **E2E** — **2 specs E2E novos** adicionados: `e2e/shell-a11y.spec.ts` (gate axe wide/compact) e `e2e/shell.spec.ts` (comportamento: ordem de tab, geometria de token, atalhos `[`/`B`, persistência do seam/título).
- **E2E — suíte completa com o shell novo ligado** (2026-07-24, Node 22.15.1, `workers:1` contra branch Neon `e2e`): **99 passed / 4 failed**.
  - **Única regressão introduzida pela 13.1: `gratitude-history.spec.ts` — CORRIGIDA.** O assert `getByText('Histórico de Gratidão')` (que confirma o anúncio de rota) passou a casar **2 nós**: o live region `role="status"` do `RouteAnnouncer` **e** o título estático homônimo que o novo `ShellTopbar` renderiza dentro do `role="banner"` (design aprovado na 13.0), violando o strict mode. Fix **no spec, não no app**: escopar ao live region — `page.getByRole('status').filter({ hasText: 'Histórico de Gratidão' })` — preservando a intenção original (verificar que o `RouteAnnouncer` anuncia o `handle.title`), sem afrouxar a asserção. Validação real: `CI=1 npx playwright test e2e/gratitude-history.spec.ts --reporter=line` ⇒ **`1 passed (24.1s)`**.
  - **3 falhas PRÉ-EXISTENTES (dívida separada, NÃO regressão da 13.1):** `archive.spec.ts:38`, `recurring-templates.spec.ts:306`, `task-reorder.spec.ts:58`. Falham **de forma idêntica no baseline `ee50f10`** (shell desligado — `3 failed / 8 passed` naquele recorte), portanto são anteriores a esta story e ficam fora do seu escopo.
  - **Conclusão:** corrigida a única regressão, o shell novo não introduz nenhuma falha E2E. ACs 5 e 7 atendidos no que compete à 13.1.

### File List

**NEW**
- `frontend/src/shared/design/tokens.ts`
- `frontend/src/shared/design/tokens.test.ts`
- `frontend/src/app/layout/shell/ShellLayout.tsx`
- `frontend/src/app/layout/shell/ShellLayout.test.tsx`
- `frontend/src/app/layout/shell/ShellTopbar.tsx`
- `frontend/src/app/layout/shell/SkipLink.tsx`
- `frontend/src/app/layout/shell/LegacySeamNotice.tsx`
- `frontend/src/app/layout/shell/LegacySeamNotice.test.tsx`
- `frontend/src/app/layout/shell/shellRouting.ts`
- `frontend/src/app/layout/shell/shellRouting.test.ts`
- `frontend/e2e/axeHelper.ts` *(artefato de tipo novo — helper E2E)*
- `frontend/e2e/shell-a11y.spec.ts` *(artefato de tipo novo — spec E2E de acessibilidade/axe)*
- `frontend/e2e/shell.spec.ts` *(artefato de tipo novo — spec E2E de comportamento do shell: ordem de tab, geometria, atalhos, seam)*
- `_bmad-output/implementation-artifacts/13-shell-parity-checklist.md` *(artefato de tipo novo)*

**UPDATE**
- `frontend/src/app/router.tsx` (só `ProtectedLayout` escolhe a casca)
- `frontend/e2e/gratitude-history.spec.ts` (fix de regressão da 13.1: assert do anúncio de rota escopado ao live region `role="status"` do `RouteAnnouncer`, evitando colisão strict-mode com o título homônimo do `ShellTopbar` no `role="banner"`)
- `frontend/package.json` + `frontend/package-lock.json` (+ `@axe-core/playwright` devDependency)
- `_bmad-output/implementation-artifacts/13-1-fundacao-do-shell-novo-com-coexistencia-por-rota.md` (frontmatter `baseline_commit`, checkboxes, Dev Agent Record, Status)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (13.1 → in-progress → review)

### Change Log

| Data | Mudança |
|---|---|
| 2026-07-24 | Fundação do shell novo: tokens `--ds-*`, `ShellLayout`/`ShellTopbar`/`SkipLink`/`LegacySeamNotice`, coexistência por rota (`shellRouting`), axe-core no Playwright e checklist de paridade. Story 100% frontend. |
| 2026-07-24 | Code review (story-automator, adversarial): 0 críticos, 1 médio, 2 baixos — todos corrigidos nos artefatos da story. `shell.spec.ts` adicionado à File List; contagem por arquivo dos testes Vitest corrigida (22/6, não 20/8). Status permanece `in-progress`: E2E é o único gate aberto. |
| 2026-07-24 | Fix E2E (única regressão da 13.1): `gratitude-history.spec.ts` — assert do anúncio de rota escopado ao live region `role="status"` do `RouteAnnouncer` (`getByRole('status').filter({ hasText: … })`), removendo a colisão strict-mode com o título homônimo que o `ShellTopbar` renderiza no `role="banner"`. Fix no spec, não no app (design da topbar aprovado na 13.0). Spec 100% verde (`1 passed`). Suíte E2E com shell = 99 passed / 4 failed; as 4 falhas restantes (archive/recurring-templates/task-reorder) são pré-existentes ao baseline `ee50f10`, não regressão da 13.1 — dívida separada. Task 8 (E2E) concluída. |
| 2026-07-24 | **Re-review (story-automator, adversarial, auto-fix) — 2ª passada.** Toda alegação re-verificada de forma independente: Vitest **85/881**, `typecheck` e `lint` **exit 0**, tokens conferidos valor-a-valor contra o frontmatter canônico do `DESIGN.md` (radius `md=6px` é o canônico; o texto da Task 1 era paráfrase), preservação de comportamento conferida linha-a-linha vs `AppLayout.tsx`, File List batendo com `git status`, contagem por arquivo recontada (16+22+6+9=53). **E2E executado nesta passada** (Node 22.15.1, servers reais contra a branch Neon `e2e`): os specs da 13.1 — `shell.spec.ts` (7) + `shell-a11y.spec.ts` (2) + `gratitude-history.spec.ts` (1) — **10 passed**, confirmando ACs 5 e 7. **0 críticos.** Único achado: dessincronia de status (todas as tasks `[x]` e todos os gates verdes, mas `Status: in-progress` e a ressalva de E2E da 1ª review já superada pelas Completion Notes/Change Log). Corrigido: `Status → done` e sprint-status sincronizado. |

## Senior Developer Review (AI)

> **Atualização da 2ª passada (2026-07-24):** a ressalva de E2E abaixo foi
> **RESOLVIDA**. Na re-review os specs da 13.1 rodaram verdes (`10 passed`) contra
> a branch Neon `e2e` real — ver "Re-review (2ª passada)" ao fim desta seção.
> Resultado final: **aprovado, 0 críticos, `Status → done`**.

**Revisor:** HugoMMBrito (fluxo `bmad-story-automator-review`, adversarial, auto-fix) · **Data:** 2026-07-24

**Resultado (1ª passada):** Mudanças aprovadas com ressalva — **0 críticos, 1 médio, 2 baixos**. Os achados de documentação foram corrigidos automaticamente. O aceite final dependia de **uma** confirmação de E2E que não era executável naquele contexto (resolvida na 2ª passada).

### Verificação executada (evidência real, não alegação)

- **Vitest** — `npm run test:run` (Node 22.15.1): **85 arquivos / 881 testes, todos verdes**. Bate exatamente com a alegação da story (828 baseline + 53 novos).
- **`npm run typecheck`** e **`npm run lint`**: limpos (sem violação da regra de boundary `shared/` ✗→ `app/`/`features/`).
- **Tokens vs canônico** — `shared/design/tokens.ts` conferido **valor a valor** contra o frontmatter de `DESIGN.md` (2026-07-17): cores (Mineral Light/Dark), `rounded` (`xs 2/sm 4/md 6/lg 8/full 9999`), `spacing`, `app-shell`, `focus-ring`, `legacy-seam`, `capture-action`, `badge`, `mobile-navigation-sheet` — **todos idênticos**. (O texto da Task 1 "`md 4`" era paráfrase imprecisa; o código seguiu corretamente a fonte canônica.)
- **Preservação de comportamento** — guards dos atalhos `[`/`B`, `pb` do compact e strings de `matchMedia` conferidos **linha a linha** contra `AppLayout.tsx`: reproduzidos com fidelidade. `theme.ts`/`Sidebar.tsx`/`BottomNav.tsx`/`AppLayout.tsx` intocados (confirmado por `git status`).
- **AC4 "skip link primeiro focável"** — validado que `DevEnvBanner` (`role="note"`, `pointer-events:none`, sem foco) e `SessionExpiredBanner` (só quando `sessionExpired` ⇒ `isAuthenticated=false` ⇒ redireciona a `/login`, nunca coexiste com o shell) **não** roubam o primeiro foco.

### Cobertura dos ACs

| AC | Situação |
|---|---|
| AC1 Tokens canônicos, zero literais | ✅ Verificado contra o frontmatter |
| AC2 Coexistência por rota + rollback 1 linha | ✅ `shellRouting.ts` (dados puros), `ProtectedLayout` via `useMatches()` |
| AC3 Seam A editorial persistente | ✅ `aside`, tokens, texto aprovado, sem dispensar |
| AC4 Contrato acessível | ✅ Skip link, `header`, um único `main`, scroll-padding, atalhos |
| AC5 axe-core no Playwright | ⚠️ Artefatos presentes (dep instalada, `axeHelper.ts` + `shell-a11y.spec.ts`); chrome verde no jest-axe. **Falta a execução verde do Playwright.** |
| AC6 Checklist de paridade | ✅ `13-shell-parity-checklist.md` enumerado com `arquivo:linha` |
| AC7 Sem regressão | ⚠️ Vitest 881 verde **sem mock novo de Query** (confirmado). **Falta a suíte E2E existente verde.** |

### Achados

- **[MÉDIO · corrigido] File List incompleta.** `frontend/e2e/shell.spec.ts` (7 testes de comportamento, artefato de tipo novo) existia no git mas não constava na File List, Tasks nem Completion Notes — exatamente o guardrail recorrente citado pela própria story (retros dos Épicos 3/4/11/12). → Adicionado à File List e às Completion Notes.
- **[BAIXO · corrigido] Contagem por arquivo dos testes Vitest imprecisa.** As Completion Notes atribuíam `ShellLayout.test.tsx = 20` e `LegacySeamNotice.test.tsx = 8`; a contagem real é **22** e **6** (o total 53 e o grande total 881 estavam corretos). → Corrigido para `16 + 22 + 6 + 9`.
- **[BAIXO · aberto, sem fix de código] E2E não confirmado.** Task 8 (`[ ]`) e os ACs 5/7 dependem da suíte E2E verde. Não é executável no contexto do review (exige dev server + branch Neon `e2e`). Deixado como o único gate pendente; a story permanece `in-progress`.

### Observação (não é defeito — para a 13.4 / ondas de migração)

- O shell troca o scroll de nível de documento por um workspace com `overflow:auto` próprio ("scroll interno" — contrato do `DESIGN.md`). Comportamentos legados que dependam de scroll de `window` ou `position: sticky` relativo à viewport podem mudar; não há teste cobrindo isso e as páginas seguem legadas. Vale um olhar no passe de paridade da 13.4.

---

### Re-review (2ª passada) — 2026-07-24

**Revisor:** HugoMMBrito (fluxo `bmad-story-automator-review`, adversarial, auto-fix) · **Resultado: APROVADO — 0 críticos, 0 altos, 0 médios novos. `Status → done`.**

Segunda execução do fluxo de review sobre a mesma story. Toda alegação foi **re-verificada de forma independente** (não aceita da 1ª passada):

**Evidência re-executada nesta passada:**
- **Vitest** — `npm run test:run` (Node 22.15.1): **85 arquivos / 881 testes, todos verdes.** Bate com a alegação (828 baseline + 53 novos).
- **`npm run typecheck`** e **`npm run lint`**: **exit 0** (confirmado explicitamente).
- **Tokens vs canônico** — `shared/design/tokens.ts` conferido valor-a-valor contra o frontmatter de `DESIGN.md`: `spacing` (1–12), `rounded` (**`md=6px`** — o canônico; o texto da Task 1 "`md 4`" era paráfrase), `app-shell`, `app-shell-badge`, `capture-action`, `mobile-navigation-sheet`, `legacy-seam`, `focus-ring` e as paletas Mineral Light/Dark — **todos idênticos.**
- **Preservação de comportamento** — guards de `[`/`B`, `pb` do compact e strings de `matchMedia` conferidos linha-a-linha contra `AppLayout.tsx`: reproduzidos com fidelidade. `theme.ts`/`Sidebar.tsx`/`BottomNav.tsx`/`AppLayout.tsx` intocados (`git status`).
- **AC4 "skip link primeiro focável"** — reconfirmado que `DevEnvBanner` (`role="note"`, `pointer-events:none`, sem foco) e `SessionExpiredBanner` (só quando `sessionExpired` ⇒ redireciona) não roubam o primeiro foco. `--dev-banner-height` é definido em `:root` (0px em PROD), então os `calc()` do shell nunca são inválidos.
- **File List vs git** — reconciliada com `git status --short`: completa e exata.
- **Contagem por arquivo** — recontada dos fontes: `tokens.test.ts` 16 · `ShellLayout.test.tsx` 22 · `LegacySeamNotice.test.tsx` 6 · `shellRouting.test.ts` 9 = **53**. Confere.
- **E2E (o gate que faltava)** — executado nesta passada com `webServer` real (dev 5173 + Django `config.settings.e2e` contra a branch Neon `e2e`), Node 22.15.1: `shell.spec.ts` (7) + `shell-a11y.spec.ts` (2) + `gratitude-history.spec.ts` (1) ⇒ **`10 passed (1.2m)`, exit 0.** Confirma AC5 (axe verde wide+compact) e AC7 (fix de regressão verde + comportamento do shell). As 3 falhas pré-existentes citadas nas Completion Notes (archive/recurring-templates/task-reorder) são de superfícies fora do escopo da 13.1 e não foram tocadas por esta story.

**Cobertura dos ACs (2ª passada):** AC1 ✅ · AC2 ✅ · AC3 ✅ · AC4 ✅ · **AC5 ✅ (E2E verde)** · AC6 ✅ · **AC7 ✅ (Vitest 881 sem mock novo de Query + E2E dos specs da 13.1 verde).**

**Achados desta passada:**
- **[MÉDIO · corrigido] Dessincronia de status.** Todas as 8 tasks `[x]` e todos os gates verdes (incluindo E2E, agora executado), porém `Status: in-progress` e a seção de review da 1ª passada ainda registrava E2E como pendente — ressalva já superada pelas Completion Notes/Change Log. → `Status → done`, ressalva marcada como resolvida e `sprint-status.yaml` sincronizado (13-1 → done).
- **Achados da 1ª passada confirmados como resolvidos:** File List completa (`shell.spec.ts` presente) e contagem de testes correta (22/6). Nada reaberto.

**Nits não-bloqueantes (deixados como estão, com justificativa):**
- `shellCssVariables()` é recomputado a cada render do `ShellLayout` (novo objeto de ~55 entradas). Micro-alocação num componente que renderiza raramente (toggle `[`, media query, troca de rota); um `useMemo` por `mode` seria idiomático, mas não vale churn em código testado e correto para ganho desprezível.
- Observação de scroll interno vs `window`/`sticky` do conteúdo legado permanece registrada para a 13.4 (acima).
