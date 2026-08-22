# Checklist de paridade do App Shell — Épico 13

> Inventário **enumerado e verificável** do chrome real do app, extraído do
> código (não de suposição), com arquivo/linha de origem. Cada item é o contrato
> de comportamento que o shell novo (Stories 13.1–13.4) precisa preservar.
>
> - **Origem** aponta o arquivo/linha no commit baseline da Story 13.1
>   (`ee50f10`).
> - **Status**: `parity` = comportamento já preservado pelo shell novo; `13.2`/
>   `13.3`/`13.4` = entrega/verificação daquela story; `debt` = dívida registrada;
>   **`waiver consciente`** = requisito **dispensado por decisão do dono** — não é
>   dívida nem pendência e não é deferido para nenhuma story (hoje: `A11Y-07`).
> - **Evidência** aponta `arquivo::nome do teste` (ou "verificação manual +
>   motivo", quando não automatizável).
> - Divergências **contratadas** (não são bugs) estão na seção própria.
>
> Criado na Story 13.1 (2026-07-24). As Stories 13.2–13.4 consomem e atualizam
> este artefato.
>
> **FECHADO na Story 13.4 (2026-07-24):** nenhum item permanece com status `13.4`;
> todo item de A–H tem status final e Evidência. Ver
> [**Onda 2a — equivalência comprovada**](#onda-2a--equivalência-comprovada) ao
> fim, e a única exceção declarada ao piso: `A11Y-07` (**waiver consciente** de
> `prefers-reduced-motion`).

## A. Navegação — Sidebar (desktop/tablet)

> **Atualizado na Story 13.2 (2026-07-24):** a `ShellSidebar` nova
> (`frontend/src/app/layout/shell/ShellSidebar.tsx`) substitui a `Sidebar` legada
> DENTRO do `ShellLayout`. A `Sidebar.tsx` legada permanece intocada como
> rollback. Os itens abaixo passam a ser entregues pela `ShellSidebar`
> (derivação por map puro do registro + núcleo hardcoded, catálogo Phosphor,
> tokens `--ds-*`).
>
> **Atualizado na Story 13.4:** a linha de destino virou o componente
> compartilhado `ShellNavDestination.tsx` (uma cópia, não duas — AC3), e o
> "ativo" passou a vir do predicado ÚNICO `isDestinationActive`
> (`shellDestinations.ts`) nas três superfícies (SHELL-DEBT-03 fechada).

| ID | Item | Comportamento atual | Origem | Status | Evidência |
|---|---|---|---|---|---|
| SB-01 | Destino "Hoje" | `/today`, ícone `calendar-dot` (Phosphor), topo da lista | `ShellSidebar.tsx:TODAY,renderDestination` | ✅ 13.2 | `shell-sidebar.spec.ts::ordem canônica do inventário e navegação real das collections derivadas do manifest` · `ShellSidebar.test.tsx::renderiza núcleo + collections do registro na ordem do inventário SB-01…SB-10` |
| SB-02 | Grupo colapsável "Planner" | cabeçalho `Notebook` (DIV-10) + chevron unicode (DIV-11); inicia aberto | `ShellSidebar.tsx:renderGroup` | ✅ 13.2 | `ShellSidebar.test.tsx::agrupador expõe aria-expanded e NUNCA aria-current` · `shell-sidebar.spec.ts::rail mede 240↔64px, oculta labels preservando nomes acessíveis e alterna o toggle` |
| SB-03 | Filhos de Planner e ordem | Esta Semana → Este Mês → Futuro → Recorrentes | `ShellSidebar.tsx:PLANNER_CHILDREN` | ✅ 13.2 | `shellDestinations.test.ts::lista achatada segue a ordem canônica dos spines (não a do mockup)` |
| SB-04 | Destino "Gratidão" (avulso) | derivado do registro por `nav.order` (sem `id` literal desde a 13.4) | `shellDestinations.ts:deriveShellNavItems` | ✅ 13.2 · genérico em ✅ 13.4 | `shellDestinations.test.ts::nenhum id de collection é hardcodado no CÓDIGO da derivação` · `shell-sidebar.spec.ts::ordem canônica do inventário e navegação real das collections derivadas do manifest` |
| SB-05 | Grupo colapsável "Saúde" | cabeçalho `first-aid-kit` (Phosphor) + chevron; inicia aberto; agrupador **nunca** `aria-current` | `ShellSidebar.tsx:renderGroup` | ✅ 13.2 (DIV-4) | `shell-sidebar.spec.ts::destino ativo combina borda 3px, fundo primary-soft, peso forte e aria-current` · `ShellSidebar.test.tsx::agrupador com a rota profunda de um filho dentro segue só com aria-expanded` |
| SB-06 | Filhos de Saúde e ordem | grupo `saude` por `nav.order`: Métricas → Medicamentos | `shellDestinations.ts:deriveShellNavItems` | ✅ 13.2 | `shellDestinations.test.ts::estrutura agrupada: Planner e Saúde são grupos; demais são destinos` · `ShellSidebar.test.tsx::deriva label/grupo/ordem do registro (Métricas antes de Medicamentos por nav.order)` |
| SB-07 | Destino "Hábitos" (avulso) | derivado do registro; empate de `nav.order` com o grupo Saúde desempatado pelo índice no registro | `shellDestinations.ts:deriveShellNavItems` | ✅ 13.2 · genérico em ✅ 13.4 | `shellDestinations.test.ts::empate de nav.order é desempatado pela primeira ocorrência no registro` |
| SB-08 | Destino "Brain Dump" | `/brain-dump`, ícone `brain` (Phosphor) envolto por `BrainDumpBadge` | `ShellSidebar.tsx:BRAIN_DUMP` | ✅ 13.2 | `ShellSidebar.test.tsx::destino Brain Dump tem nome acessível no expandido e no rail` · `shell-a11y.spec.ts::medium · /brain-dump · destino com badge no estado ativo` |
| SB-09 | Destino "Arquivo" | `/archive`, ícone `archive` (Phosphor) | `ShellSidebar.tsx:ARCHIVE` | ✅ 13.2 | `shell-sidebar.spec.ts::ícones são Phosphor 20px em currentColor, sem MUI, e trocam para fill no selecionado` |
| SB-10 | Divisor + "Configurações" | `Divider` seguido de `/settings` com `gear` (Phosphor) | `ShellSidebar.tsx:SETTINGS` | ✅ 13.2 | `shell-a11y.spec.ts::wide · /settings · divisor + último destino do chrome` · `ShellSidebar.test.tsx::renderiza núcleo + collections do registro na ordem do inventário SB-01…SB-10` |
| SB-11 | Indicação de ativo | borda-esquerda 3px `--ds-primary` + fundo `--ds-primary-soft` + peso 700 + ícone `fill` + `aria-current="page"` | `ShellNavDestination.tsx` (13.4) | ✅ 13.2 · linha compartilhada em ✅ 13.4 | `shell-sidebar.spec.ts::destino ativo combina borda 3px, fundo primary-soft, peso forte e aria-current` · `ShellSidebar.test.tsx::destino ativo tem aria-current="page" e label em peso forte (canal além da cor)` |
| SB-12 | Colapso 240↔**64px** | `var(--ds-sidebar-expanded)` / `var(--ds-sidebar-collapsed)`; transição `width 0.2s`; oculta labels | `ShellSidebar.tsx:Drawer sx` | ✅ 13.2 (DIV-1: 56→64) | `shell-sidebar.spec.ts::rail mede 240↔64px, oculta labels preservando nomes acessíveis e alterna o toggle` · `ShellSidebar.test.tsx::zero literais estruturais (56/64/240/52/48) na sidebar` |
| SB-13 | Grupos fecham ao colapsar | `Collapse in={open && !collapsed}`; estado preservado na sessão | `ShellSidebar.tsx:renderGroup` | ✅ 13.2 | `ShellSidebar.test.tsx::grupos fecham ao colapsar (subitens somem)` · `shell-sidebar.spec.ts::agrupador recolhido com a rota ativa dentro mostra .contains e descrição acessível` |
| SB-14 | Landmark da navegação | `<nav aria-label="Navegação principal">` (único; não duplicado pelo shell) | `ShellSidebar.tsx:nav` | ✅ 13.2 | `shell.spec.ts::compact: topbar passa a existir, bottom nav presente e skip link primeiro focável` (ausência no compact) · `shell-a11y.spec.ts::wide · /today · sidebar expandida` |
| SB-15 | Botão colapsar/expandir | `IconButton` com aria-label alternando; ícone `sidebar-simple` (Phosphor) | `ShellSidebar.tsx:ToggleIcon` | ✅ 13.2 (DIV-1) | `ShellSidebar.test.tsx::toggle usa aria-label alternando e dispara onToggle` · `shell-sidebar.spec.ts::rail mede 240↔64px, oculta labels preservando nomes acessíveis e alterna o toggle` |

### A.1 Destino ativo por PREFIXO — fechamento da SHELL-DEBT-03 (Story 13.4)

O predicado de "destino ativo" existia em **três cópias literais** com semânticas
divergentes (match exato na sidebar; prefixo na bottom nav e no sheet). Passou a
ser **uma** função pura exportada de `shellDestinations.ts`
(`isDestinationActive(pathname, path)`), consumida pelas três superfícies.

| Item | Comportamento contratado | Evidência |
|---|---|---|
| Predicado único | `pathname === path \|\| pathname.startsWith(path + '/')` — prefixo do PRÓPRIO destino, nunca mais largo (`/planner/future` não ativa "Esta Semana") | `shellDestinations.test.ts::casa o path exato e o prefixo do PRÓPRIO destino, nunca um prefixo mais largo` |
| 9 rotas profundas ativam o PAI | `/habits/history`, `/gratitude/history`, `/health/metrics/history`, `/health/medications/history`, `/settings/habits`, `/settings/health-metrics`, `/settings/medications`, `/archive/weekly/:weekStart`, `/archive/monthly/:monthFirst` | `shellDestinations.test.ts::as 9 rotas profundas ativam o destino PAI correto` · `ShellSidebar.test.tsx::<rota> marca "<destino>" com aria-current e mantém exatamente UM ativo` (9 casos) |
| Exatamente UM `aria-current` por superfície, em TODA rota autenticada | invariante provada sobre `shellRoutes` inteiro, não por inspeção | `shellDestinations.test.ts::nenhuma rota autenticada casa mais de um destino da lista achatada` · `shellDestinations.test.ts::nenhum destino da nav é prefixo de outro destino da nav` · **no router REAL:** `shell-active-destination.spec.ts::exatamente um aria-current no destino pai correto, em toda rota autenticada` (as 22 rotas, uma sessão) |
| Pares de prefixo COLIDENTE no browser real | `/settings` × `/settings/{habits,health-metrics,medications}` e `/archive` × `/archive/{weekly,monthly}/*` — os dois pares que o AC1 nomeia como modo de falha da migração para prefixo; nenhum era visitado por teste E2E antes do passo de QA | `shell-active-destination.spec.ts::exatamente um aria-current no destino pai correto, em toda rota autenticada` · `shell-active-destination.spec.ts::/settings/medications: Menu selecionado e Configurações ativo uma única vez no sheet` · `…/archive/weekly/2026-07-20: Menu selecionado e Arquivo ativo uma única vez no sheet` |
| Agrupador recolhido com filho ativo por rota PROFUNDA | `.contains` + `aria-describedby` "Contém a página atual: Medicamentos." e **nenhum** `aria-current` no agrupador (a 13.2 só provava isso com a rota exata de um filho) | `shell-active-destination.spec.ts::agrupador recolhido com filho ativo por rota profunda: .contains, aria-expanded e nenhum aria-current` |
| `/daily/:date` sem destino ativo | **contrato registrado, não bug**: o Daily de uma data não tem destino próprio (o atalho do dia é "Hoje"); no compact o item **Menu** aparece selecionado | `shellDestinations.test.ts::/daily/:date não ativa nenhum destino (contrato registrado)` · `ShellSidebar.test.tsx::/daily/:date não ativa nenhum destino (contrato registrado, não bug)` · `shell-active-destination.spec.ts::/daily/:date: Menu selecionado e nenhum destino ativo no sheet` |

## B. Navegação — BottomNav (compact <768px)

> **Atualizado na Story 13.3 (2026-07-24):** a `ShellBottomNav` nova
> (`frontend/src/app/layout/shell/ShellBottomNav.tsx`) + o
> `ShellNavigationSheet` substituem a `BottomNav` legada DENTRO do
> `ShellLayout`. A `BottomNav.tsx` legada permanece intocada como rollback.
> Atalhos derivados de `shellDestinations.ts` (mesma fonte da `ShellSidebar`).

| ID | Item | Comportamento atual | Origem | Status | Evidência |
|---|---|---|---|---|---|
| BN-01 | 4 abas fixas → **3 atalhos derivados + Menu** | default sem preferência: 3 primeiros da ordem canônica (Hoje · Esta Semana · Este Mês) + item fixo Menu (ícone `list`) que abre o `ShellNavigationSheet` | `ShellBottomNav.tsx:shortcuts`; `shellDestinations.ts:deriveBottomNavShortcuts` | ✅ 13.3 (DIV-2) | `shell-bottomnav.spec.ts::3 atalhos default + Menu visíveis; altura da barra vem do token` · `ShellBottomNav.test.tsx::renderiza os 3 atalhos default (Hoje, Esta Semana, Este Mês) + Menu` |
| BN-02 | Paths das abas | derivados da lista achatada canônica (`/today`, `/planner/week`, `/planner/month`) | `shellDestinations.ts:flattenDestinations` | ✅ 13.3 | `shellDestinations.test.ts::3 primeiros da ordem canônica: Hoje, Esta Semana, Este Mês` · `shell-bottomnav.spec.ts::atalho navega e marca o ativo com aria-current` |
| BN-03 | Aba ativa por prefixo | predicado ÚNICO `isDestinationActive` (desde a 13.4); rota fora dos atalhos ⇒ **Menu selecionado** (DIV-12) | `ShellBottomNav.tsx:activeShortcut,menuSelected` | ✅ 13.3 · unificado em ✅ 13.4 | `ShellBottomNav.test.tsx::atalho ativo por prefixo do próprio destino (path + "/")` · `shell-bottomnav.spec.ts::rota fora dos atalhos: Menu selecionado` · `shell-a11y.spec.ts::compact 390 · /health/metrics · Menu selecionado` |
| BN-04 | Landmark | `<nav aria-label="Atalhos de navegação">` (fixo, `bottom:0`) — troca **contratada** (DIV-7) | `ShellBottomNav.tsx` | ✅ 13.3 | `ShellBottomNav.test.tsx::landmark é "Atalhos de navegação" (troca contratada — AC4)` · `shell.spec.ts::compact: topbar passa a existir, bottom nav presente e skip link primeiro focável` |
| BN-05 | `pb` de safe-area na barra | `pb: env(safe-area-inset-bottom, 0px)` + altura `var(--ds-bottom-nav-height)` | `ShellBottomNav.tsx` | ✅ 13.3 | `shell-bottomnav.spec.ts::3 atalhos default + Menu visíveis; altura da barra vem do token` · `ShellBottomNav.test.tsx::zero literais estruturais (56/64/240) — geometria só via tokens` |
| BN-06 | Contraste do label não-selecionado | `var(--ds-ink-muted)` sobre `var(--ds-surface)` (≥4.5:1); a barra nova está no gate axe compact | `ShellBottomNav.tsx:itemSx` | ✅ 13.3 (SHELL-DEBT-01 fechada) | `shell-bottomnav.spec.ts::bottom nav: ícones Phosphor 20px sem MUI, fill no selecionado e alvos ≥48px` · `shell-a11y.spec.ts::compact 320 · /today · reflow mínimo` · `shell-a11y.spec.ts::compact 390 · /today · topbar + bottom nav + FAB` |

### B.1 Sheet de navegação completa (Story 13.3, verificado na 13.4)

| Item | Comportamento contratado | Evidência |
|---|---|---|
| Conteúdo canônico completo | lista TODOS os destinos (inclusive os 3 atalhos), na ordem/agrupamento canônicos | `ShellNavigationSheet.test.tsx::lista TODOS os destinos (inclusive os 3 atalhos) na ordem canônica da sidebar` · `shell-bottomnav.spec.ts::Menu abre o sheet: todos os destinos, acima da bottom nav, foco no ativo` |
| Landmark `Navegação completa` | `<nav aria-label="Navegação completa">` (DIV-7) | `ShellNavigationSheet.test.tsx::landmark é a nav "Navegação completa", com header e botão Fechar` |
| 4 modos de fechamento + retorno de foco ao **Menu** | Fechar · `Escape` · backdrop · swipe-down (o último não automatizado — ver Limitações) | `shell-bottomnav.spec.ts::Fechar devolve o foco ao Menu; Escape fecha o sheet` · `shell-bottomnav.spec.ts::sheet fecha pelo backdrop e devolve o foco ao Menu` · `shell-keyboard.spec.ts::Escape fecha o sheet e devolve o foco ao Menu` |
| Foco inicial no destino ativo, armado só na abertura (WCAG 3.2.1) | nunca no Fechar; agrupador recolhido ⇒ primeiro destino VISÍVEL | `ShellNavigationSheet.test.tsx::foco inicial vai ao destino ativo (nunca ao Fechar)` · `ShellNavigationSheet.test.tsx::grupo da rota ativa recolhido: foco inicial cai no primeiro destino VISÍVEL` · `ShellNavigationSheet.test.tsx::reexpandir um agrupador NÃO rouba o foco do próprio agrupador` |
| Foco contido e conteúdo inferior inerte | Modal do MUI; a barra sai da AX tree com o sheet aberto | `shell-bottomnav.spec.ts::sheet: Tab contido no Modal e conteúdo inferior inerte` |

## C. Captura / FAB (compact)

| ID | Item | Comportamento atual | Origem | Status | Evidência |
|---|---|---|---|---|---|
| FAB-01 | FAB de captura | `position:fixed`, `bottom: calc(var(--ds-bottom-nav-height) + safe-area + var(--ds-space-4))`, `right: var(--ds-space-4)`, `var(--ds-capture-fab-size)` (52px) circular, ícone `note-pencil`, FORA da bottom nav | `ShellLayout.tsx` (FAB) | ✅ 13.3 | `shell-bottomnav.spec.ts::FAB de captura acima da barra abre o Capture Sheet real` |
| FAB-02 | aria-label online/offline | "Captura rápida" / "Captura rápida (sem conexão)" | `ShellLayout.tsx` (FAB) | ✅ 13.3 | `shell-bottomnav.spec.ts::offline: FAB indisponível com motivo, focável, sem abrir a captura; navegação segue` |
| FAB-03 | Offline + Tooltip | **`aria-disabled` + guard no click** (DIV-8); `Tooltip "Sem conexão"` | `ShellLayout.tsx` (FAB); `ShellSidebar.tsx` (âncora) | ✅ 13.3 (DIV-8) | `shell-bottomnav.spec.ts::offline: FAB indisponível com motivo, focável, sem abrir a captura; navegação segue` · `ShellSidebar.test.tsx::offline: aria-disabled + motivo acessível, continua focável e NÃO chama onOpenCapture` · `shell-a11y.spec.ts::compact 390 · /today · offline (FAB aria-disabled)` |
| FAB-04 | Badge sobre o ícone | `BrainDumpBadge` (`max={9}` + `badgeSx` do shell) envolve o ícone `note-pencil` | `ShellLayout.tsx` (FAB) | ✅ 13.3 | `shell-bottomnav.spec.ts::badge real do Brain Dump: 9+ no FAB e no sheet, com contagem exata acessível` |
| FAB-05 | `BrainDumpCaptureSheet` | instância ÚNICA no `ShellLayout`, compartilhada por FAB (compact) e âncora (desktop/tablet) | `ShellLayout.tsx:captureOpen` | ✅ 13.3 | `shell-bottomnav.spec.ts::FAB de captura acima da barra abre o Capture Sheet real` · `shell-bottomnav.spec.ts::âncora nominal ao fim da navegação abre a instância única do Capture Sheet` |
| FAB-06 | Âncora desktop/tablet | "Abrir captura rápida" ao fim da navegação (≥44px, borda `{components.interactive-control}`); icon-only no rail preservando `aria-label`; badge ligado ao ícone | `ShellSidebar.tsx` (âncora) | ✅ 13.3 | `shell-bottomnav.spec.ts::âncora nominal ao fim da navegação abre a instância única do Capture Sheet` · `shell-bottomnav.spec.ts::âncora icon-only no rail preserva o nome acessível e o badge dentro dos 64px` · `shell-bottomnav.spec.ts::tablet em rail: âncora icon-only abre a captura e não existe FAB nem bottom nav` |

## D. Badge do Brain Dump

| ID | Item | Comportamento atual | Origem | Status | Evidência |
|---|---|---|---|---|---|
| BD-01 | Badge do App Shell com token | shell passa `badgeSx` (`--ds-primary`/`--ds-on-primary`/`--ds-badge-min-height`/`--ds-radius-full`) via `slotProps`; uso legado permanece `color="primary"` | `BrainDumpBadge.tsx`; `shellDestinations.ts:SHELL_BADGE_SX` | ✅ 13.2 | `ShellSidebar.test.tsx::passa o cap max={9} e o estilo app-shell-badge ao BrainDumpBadge (integração do shell)` · `shell-sidebar.spec.ts::badge do Brain Dump mostra 9+ com contagem exata no nome acessível, tokens e sem deslocar o label` |
| BD-02 | Oculto em zero | `invisible={count === 0}` | `BrainDumpBadge.tsx` | parity | `BrainDumpBadge.test.tsx::fica invisível quando count é 0` · `shell-states.spec.ts::ST-01 vazio: superfície sem itens, chrome completo e estável` |
| BD-03 | Nome acessível com contagem exata | `aria-label="Brain Dump: N item(ns) pendente(s)"` (independe do cap `max`) | `BrainDumpBadge.tsx` | parity | `BrainDumpBadge.test.tsx::aria-label contém a contagem atual` · `shell-sidebar.spec.ts::badge do Brain Dump mostra 9+ com contagem exata no nome acessível, tokens e sem deslocar o label` |
| BD-04 | `9+` acima de 9 preservando contagem | prop `max={9}` (só o shell); `aria-label` mantém a contagem EXATA | `BrainDumpBadge.tsx`; `ShellNavDestination.tsx` | ✅ 13.2 (DIV-6) | `BrainDumpBadge.test.tsx::com max=9 mostra "9+" acima de 9 mas o aria-label mantém a contagem exata` · `shell-bottomnav.spec.ts::badge real do Brain Dump: 9+ no FAB e no sheet, com contagem exata acessível` · `shell-a11y.spec.ts::medium · /today · badge 9+ com contagem real` |

## E. Atalhos de teclado

| ID | Item | Comportamento atual | Origem | Status | Evidência |
|---|---|---|---|---|---|
| KB-01 | `[` toggle da sidebar | só desktop (≥1024px); ignora campo editável; **guard de `ctrl/meta/alt`** (fechado na review da 13.4 — o guard existia só para o `B`, então `Cmd+[`, que é "voltar" no macOS, também colapsava a sidebar) | `ShellLayout.tsx` | ✅ **13.4** (wide + medium + negativos + modificadores) | `shell.spec.ts::atalho [ colapsa e reexpande a sidebar; ignorado em campo editável` (wide) · `shell-keyboard.spec.ts::atalhos [ e B funcionam em medium, com guard de campo editável e de modificador` |
| KB-02 | `B` navega p/ Brain Dump | só desktop; guard de `ctrl/meta/alt`; ignora campo editável | `ShellLayout.tsx` | ✅ **13.4** | `shell.spec.ts::atalho B navega para o Brain Dump; ignorado com Meta e em campo editável` (wide) · `shell-keyboard.spec.ts::atalhos [ e B funcionam em medium, com guard de campo editável e de modificador` |
| KB-03 | Escopo dos atalhos | `mediaQueries.desktop` = `(min-width: 1024px)`: **valem** em wide/medium, **não valem** em tablet/compact | `tokens.ts:mediaQueries` | ✅ **13.4** (as 4 faixas medidas) | `shell-keyboard.spec.ts::atalhos [ e B NÃO valem em tablet` · `shell-keyboard.spec.ts::atalhos [ e B NÃO valem no compact` · `shell-sidebar.spec.ts::tablet inicia em rail de 64px; [ não vale e o toggle expande para 240px` |

## F. Anúncio de rota / topbar

| ID | Item | Comportamento atual | Origem | Status | Evidência |
|---|---|---|---|---|---|
| RA-01 | `RouteAnnouncer` `role=status` `aria-live=polite` | lê `handle.title` do match mais profundo | `RouteAnnouncer.tsx` | parity | `RouteAnnouncer.test.tsx` (suíte do componente) · `shell-keyboard.spec.ts::o chrome tem exatamente uma live region de rota; a topbar é estática` |
| RA-02 | Topbar como título visual | `ShellTopbar` mostra o mesmo `handle.title`, **estático**, nunca live region — e o chrome tem **exatamente UMA** region de rota | `ShellTopbar.tsx` | ✅ **13.4** (escopado ao chrome nas 2 composições) | `ShellLayout.test.tsx::test_topbar_nao_e_live_region_o_anuncio_segue_exclusivo_do_route_announcer` · `shell-keyboard.spec.ts::o chrome tem exatamente uma live region de rota; a topbar é estática` · `shell-keyboard.spec.ts::o chrome do compact tem exatamente uma live region de rota` |
| RA-03 | Um `main` por rota | páginas renderizam `<main>`; shell **não** introduz outro | `router.test.tsx`, `RouteAnnouncer.test.tsx` | parity | `ShellLayout.test.tsx::test_shell_nao_introduz_um_segundo_main` · `shell.spec.ts::topbar reflete a superfície e atualiza ao navegar, com um único main` |

## G. Contrato acessível do shell

| ID | Item | Comportamento atual | Origem | Status | Evidência |
|---|---|---|---|---|---|
| A11Y-01 | Skip link primeiro focável | `Pular para o conteúdo`, oculto até foco; alvo = wrapper `tabIndex=-1` em volta do `<Outlet/>` | `SkipLink.tsx`, `ShellLayout.tsx` | ✅ **13.4** (as 4 faixas) | `shell.spec.ts::skip link é o primeiro focável e move o foco para o conteúdo` · `shell-keyboard.spec.ts::skip link é o primeiro focável e leva ao wrapper de conteúdo` (+ variantes `(medium)`, `(tablet)`, `(compact)`) |
| A11Y-02 | Topbar = `header` | landmark `banner` | `ShellTopbar.tsx` | parity | `ShellLayout.test.tsx::test_topbar_e_header_e_mostra_o_nome_da_superficie_atual` · todas as 16 células de `shell-a11y.spec.ts` (regra `region`/`landmark-*`) |
| A11Y-03 | Foco **não encoberto** (WCAG 2.2 `2.4.11`) | `scroll-padding-top` = topbar + banner DEV; `scroll-padding-bottom` = bottom nav + FAB + safe-area (compact); nenhum controle focado é coberto por chrome fixo | `ShellLayout.tsx` | ✅ **13.4** (primeiro e último focáveis medidos por hit-test em 7 viewports, com a faixa da bottom nav assertada pelo token) | `shell-keyboard.spec.ts::primeiro e último focáveis ficam visíveis e não encobertos` (+ `(medium)`, `(tablet, rail)`, `(compact)`) · `shell-keyboard.spec.ts::320 CSS px: primeiro e último focáveis visíveis e não encobertos` · `…sob zoom 200%` · `…(640×400)` |
| A11Y-04 | `pb` do conteúdo no compact | `calc(bottom-nav + safe-area + 8px)` (paridade `AppLayout.tsx:55`) | `ShellLayout.tsx` | parity | `ShellLayout.test.tsx::test_workspace_aplica_os_tokens_ds_no_elemento_raiz_do_shell` · `shell-bottomnav.spec.ts::FAB de captura acima da barra abre o Capture Sheet real` |
| A11Y-05 | Banner de DEV respeitado | altura descontada via `--dev-banner-height`; Drawer reposicionado por `index.css` | `index.css`, `ShellLayout.tsx` | ✅ **13.4** (token lido do DOM, nunca 0 assumido) | `shell-keyboard.spec.ts::primeiro e último focáveis ficam visíveis e não encobertos` (assert explícito `--dev-banner-height > 0` e do topo contra a faixa) |
| A11Y-06 | Focus ring do shell | `--ds-focus` 2px offset 2px em `:focus-visible` — **inclusive dentro do sheet PORTALIZADO** (a regra do `ShellLayout` é descendente do `shell-root`; o paper do sheet vive em `document.body`, e o `ButtonBase` do MUI zera até o anel default do browser) | `tokens.ts:focusRing`, `ShellLayout.tsx`, **`ShellNavigationSheet.tsx` (slot `paper`)** | ✅ **13.4** (cor/largura/offset resolvidos do token no browser; regra reaplicada no portal no passo de QA) | `shell-keyboard.spec.ts::foco visível resolve outline de --ds-focus com 2px e offset 2px` · `shell-keyboard.spec.ts::foco visível resolve outline de --ds-focus na bottom nav (compact)` · `shell-keyboard.spec.ts::foco visível usa o anel do token também DENTRO do sheet portalizado` |
| A11Y-07 | `prefers-reduced-motion` | **não suportado e não buscado**: as animações do shell permanecem como estão (`width 0.2s` do Drawer da `ShellSidebar`; `Drawer`/`Collapse`/`Modal` do MUI) | `ShellSidebar.tsx`, `ShellNavigationSheet.tsx`, `ShellLayout.tsx` | **waiver consciente (UX-DR30 item 6 dispensado por decisão — Hugo 2026-07-24)** | **nenhuma — por decisão.** Não há teste porque o requisito está dispensado; a rastreabilidade é este waiver (nada implementado, nada verificado, nada deferido) |
| A11Y-08 | Zoom 200% e reflow em 320 CSS px | sem scroll horizontal do documento; navegação **e** captura alcançáveis e acionáveis; recomposição wide/medium → compact faz parte do aceite | `ShellLayout.tsx`, `ShellBottomNav.tsx`, `ShellNavigationSheet.tsx` | ✅ **13.4** (novo) | `shell-keyboard.spec.ts::320 CSS px: sem scroll horizontal, navegação e captura alcançáveis` · `shell-keyboard.spec.ts::chrome recompõe para compact sem perder destino nem ação` (720×450) · `…(640×400)` · `shell-bottomnav.spec.ts::sem scroll horizontal; barra, atalhos e FAB seguem visíveis` |
| A11Y-09 | Ordem de foco = ordem visual (WCAG `2.4.3`) | chrome → conteúdo em wide/medium/tablet; topbar → conteúdo → bottom nav → FAB no compact | `ShellLayout.tsx` | ✅ **13.4** (as 4 faixas, sequência assertada por nome acessível; ver DIV-18 para a ordem do FAB) | `shell-keyboard.spec.ts::ordem de Tab acompanha a ordem visual: skip link → sidebar → conteúdo` (wide) · `…acompanha a ordem visual em medium (chrome antes do conteúdo)` · `…ordem de Tab no rail do tablet: toggle → destinos por aria-label → captura` · `…ordem de Tab no compact: conteúdo → bottom nav → FAB, todos alcançáveis` |
| A11Y-10 | Alvos de toque (WCAG `2.5.8`) | ≥44px geral · ≥48px nos itens frequentes da bottom nav · 52px no FAB | tokens `--ds-touch-target-min`, `--ds-capture-fab-size` | ✅ 13.2/13.3 | `shell-bottomnav.spec.ts::bottom nav: ícones Phosphor 20px sem MUI, fill no selecionado e alvos ≥48px` · `shell-bottomnav.spec.ts::sheet: rolagem interna preserva header e Fechar, com alvos ≥44px` · `shell-sidebar.spec.ts::rail mede 240↔64px, oculta labels preservando nomes acessíveis e alterna o toggle` |

> **A11Y-07 é waiver, não dívida.** O dono (Hugo, 2026-07-24) **dispensou
> conscientemente** o UX-DR30 item 6 (reduced motion) para o App Shell — **agora
> e no futuro**. Não é `SHELL-DEBT`, não está deferido para as Ondas 3–5, para o
> Épico 18 nem para story alguma; não há nada a confirmar com UX. Nenhuma story do
> Épico 13 implementa ou verifica `prefers-reduced-motion`. Se a decisão mudar
> algum dia, é decisão nova do dono e story nova — não a retomada de uma
> pendência. O restante do piso (teclado, foco visível, foco não encoberto,
> targets, zoom 200%/reflow 320, contraste, nome/papel/estado, live region única)
> **está fechado** e é o que a 13.4 entregou (A11Y-01…A11Y-06, A11Y-08…A11Y-10).

## H. Estados exigidos pelo aceite da 13.4

**Fronteira registrada:** `ST-01` (vazio) e `ST-06` (readonly) são estados da
**superfície legada**. O que a Onda 2a garante — e o que a evidência abaixo mede —
é que o **chrome** permanece completo, estável e acessível nesses estados; a
auditoria do conteúdo interno é das Ondas 3–5 (Épicos 14–16).

| ID | Estado | Comportamento verificado | Origem | Status | Evidência |
|---|---|---|---|---|---|
| ST-01 | vazio | Daily Log vazio; chrome completo (14 destinos + topbar + seam + captura), nenhum item desabilitado, exatamente 1 `aria-current` | `fixtures.ts` (e2e) | ✅ **13.4** | `shell-states.spec.ts::ST-01 vazio: superfície sem itens, chrome completo e estável` |
| ST-02 | loading | contagem PENDENTE ⇒ badge oculto (`BD-02`) e **disponibilidade do chrome independente do contador**: navegação e captura seguem funcionando | `BrainDumpBadge.tsx` | ✅ **13.4** | `shell-states.spec.ts::ST-02 loading: badge oculto, navegação e captura seguem disponíveis` · `shell-states.spec.ts::ST-02 loading no compact: badge do FAB oculto, navegação e captura disponíveis` · `BrainDumpBadge.test.tsx::fica invisível quando count é 0` |
| ST-03 | error | contador em 500 ⇒ badge some e **navegação/captura permanecem**; zero `pageerror` | `BrainDumpBadge.tsx` | ✅ **13.4** | `shell-sidebar.spec.ts::falha do contador não bloqueia a navegação para o Brain Dump` · `shell-bottomnav.spec.ts::falha do contador não desabilita nem bloqueia a captura` |
| ST-04 | offline | FAB **e** âncora com `aria-disabled="true"` + guard no `onClick`, **permanecendo focáveis**, motivo no nome acessível e no Tooltip, navegação intacta (**este** é o contrato DIV-8) | `ShellLayout.tsx` (FAB); `ShellSidebar.tsx` (âncora) | ✅ **13.4** | `shell-bottomnav.spec.ts::offline: FAB indisponível com motivo, focável, sem abrir a captura; navegação segue` · `shell-bottomnav.spec.ts::offline: âncora indisponível com motivo, focável e sem abrir a captura` · `shell-a11y.spec.ts::wide · /today · offline (âncora aria-disabled)` · `shell-a11y.spec.ts::compact 390 · /today · offline (FAB aria-disabled)` |
| ST-05 | disabled | controle indisponível com tinta/superfície `disabled` **preservando rótulo, identidade e motivo** (nunca `disabled` nativo) | `EXPERIENCE.md §Accessibility Floor`; DIV-8 | ✅ **13.4** | `ShellSidebar.test.tsx::offline: aria-disabled + motivo acessível, continua focável e NÃO chama onOpenCapture` · as duas células offline de `shell-a11y.spec.ts` (contraste de `ink-disabled` sobre `surface-subtle` medido pelo axe real) |
| ST-06 | readonly | rota de histórico: chrome completo, destino **pai** ativo (A.1) e **inventário de controles do chrome FECHADO** — nenhuma ação de escrita da superfície subiu ao chrome (a captura persistente é chrome global, FAB-06) | `EXPERIENCE.md §Padrões de página` | ✅ **13.4** | `shell-states.spec.ts::ST-06 readonly: histórico com chrome completo, pai ativo e sem ação de escrita da superfície` · `shell-states.spec.ts::ST-06 readonly no compact: Menu selecionado e chrome fechado em 3 atalhos + Menu + FAB` · `shell-a11y.spec.ts::medium · /health/metrics/history · ativo por prefixo (AC1) + readonly` |
| ST-07 | **nav mínima** (zero/uma collection) | sem heading "Collections", sem grupo `Saúde` vazio, sem item desabilitado; `Planner` sempre completo | `shellDestinations.ts:deriveShellNavItems` | ✅ 13.2/13.3 | `shellDestinations.test.ts::zero collections: núcleo + Planner completos, sem Hábitos/Saúde/Gratidão` · `ShellSidebar.test.tsx::zero collections: núcleo + Planner completo, sem Saúde/avulsas e sem heading "Collections"` · `ShellNavigationSheet.test.tsx::nav mínima via seam: zero collections sem grupos/headings vazios` |
| ST-08 | **collection/grupo inédito** (DoD do AD-17) | collection avulsa nova = pasta + UMA entrada no registro: aparece nas três superfícies, na posição do `nav.order`, sem ícone e **sem crash**; chave de grupo nova também degrada sem ícone | `shellDestinations.ts`; `navIcons.tsx:navIconFor` | ✅ **13.4** (novo) | `shellDestinations.test.ts::collection avulsa inédita aparece na lista achatada, na posição do nav.order` · `ShellSidebar.test.tsx::collection avulsa inédita aparece na sidebar, sem ícone e sem crash (DoD do AD-17)` · `ShellNavigationSheet.test.tsx::collection avulsa inédita aparece no sheet, na posição do nav.order e sem ícone` · `ShellSidebar.test.tsx::cabeçalho de grupo com chave fora do catálogo degrada sem ícone em vez de derrubar o chrome` · `ShellNavigationSheet.test.tsx::cabeçalho de grupo com chave fora do catálogo degrada sem ícone (sem crash)` |

## Divergências contratadas (não são bugs)

| # | Hoje | Contrato novo | Resolve em |
|---|---|---|---|
| DIV-1 | Sidebar colapsada `56px` (`COLLAPSED_WIDTH`) | rail `64px` (`{components.app-shell.sidebar-collapsed}`) | ✅ **13.2** (`var(--ds-sidebar-collapsed)`) |
| DIV-2 | Bottom nav = 4 destinos fixos | 3 configuráveis + item fixo **Menu** (default derivado: Hoje/Esta Semana/Este Mês; UI de preferência é a 18.1) | ✅ **13.3** (`ShellBottomNav` + `shellDestinations`) |
| DIV-3 | Mobile **sem** topbar | compact **tem** topbar (superfície protagonista) | ✅ **13.1** |
| DIV-4 | Saúde usa ícone `FavoriteBorder` | catálogo novo usa `first-aid-kit` (Phosphor) | ✅ **13.2** (`navIcons.saude = FirstAidKit`) |
| DIV-5 | Ícones MUI (`@mui/icons-material`) | catálogo `@phosphor-icons/react` | ✅ **13.2** (sidebar) · ✅ **13.3** (bottom nav/sheet/FAB) · ✅ **13.4** (linha compartilhada `ShellNavDestination.tsx` sob o mesmo grep) |
| DIV-6 | Badge sem cap visual | `9+` acima de 9, contagem exata no nome acessível | ✅ **13.2** (`max={9}` só no shell) |
| DIV-7 | Landmark da bottom nav `"Navegação mobile"` | `"Atalhos de navegação"` (bottom nav) + `"Navegação completa"` (sheet) | ✅ **13.3** |
| DIV-8 | FAB offline com `disabled` nativo + `<span>` wrapper | `aria-disabled="true"` + guard no `onClick` — controle permanece focável, com identidade e motivo acessível; vale para FAB e âncora | ✅ **13.3** |
| DIV-9 | Altura da bottom nav 56px (MUI `BottomNavigation` legado) | token `--ds-bottom-nav-height` = **64px** | ✅ **13.3** (`tokens.ts:bottomNavHeight`) |

### Divergências PROMOVIDAS na Story 13.4 (eram decisões interinas "a confirmar")

As três decisões marcadas *"A confirmar com UX/Hugo no passe da 13.4"* — **mais** a
reconciliação do chevron, que estava escrita como já reconciliada, **sem** marcador
de pendência — deixam de ser pendências e passam a ser **divergências
contratadas**. Cada uma com o que o artefato upstream diz, o que o código faz, por
quê, a linha de código e o artefato que precisa absorver a mudança. **Custo de
reversão de qualquer uma: uma linha.**

| # | O que o artefato upstream diz | O que o código faz | Por quê | Linha de código | Artefato upstream que precisa absorver |
|---|---|---|---|---|---|
| **DIV-10** | `DESIGN.md §Catálogo Phosphor do App Shell` é um catálogo **FECHADO** e dá glyph de agrupador **apenas** a `Saúde` (`first-aid-kit`); a seção "GRUPO Planner" cataloga só os filhos, sem glyph para o cabeçalho | cabeçalho `Planner` usa `Notebook` | um agrupador sem ícone quebraria a simetria visual da lista (Saúde tem, Planner não teria) e o mockup aprovado mostra glyph nos dois; `Notebook` não colide com nenhum destino catalogado (em especial com `Calendar` de "Este Mês") e lê como "agenda/planner" | `frontend/src/app/layout/shell/navIcons.tsx` → `planner: Notebook` | **DESIGN.md §Catálogo Phosphor**: acrescentar o glyph de agrupador de `Planner` ao catálogo |
| **DIV-11** | o catálogo fechado **não define chevron**, e o épico proíbe `@mui/icons-material` no chrome novo (DIV-5) | chevron do agrupador é **glyph unicode decorativo** `⌄`/`⌃` com `aria-hidden` (como o `&#8964;` do mockup) — não é ícone de nenhuma das duas bibliotecas | única saída sem violar o catálogo fechado nem reintroduzir MUI icons; o estado já é exposto por `aria-expanded`, então o glyph é 100% decorativo | `ShellSidebar.tsx:renderGroup` · `ShellNavigationSheet.tsx:renderGroup` | **DESIGN.md §Catálogo Phosphor**: registrar o chevron como glyph decorativo fora do catálogo (ou catalogar um `caret-*`) |
| **DIV-12** | `EXPERIENCE.md §App Shell` exige "**Menu aparece selecionado**" quando a rota não está nos 3 atalhos; o mockup aprovado marca `aria-current` no botão Menu | `aria-current="page"` no botão **Menu** + os mesmos canais visuais dos atalhos, mantendo `aria-expanded` ligado ao sheet | `aria-current` num botão que abre sheet é heterodoxo (Menu não é destino), mas é o que o mockup aprovado mostra e o que comunica "você está fora dos atalhos"; verificado no gate axe real (nome/papel/estado) sem violação | `ShellBottomNav.tsx` → `menuSelected` / `aria-current` | **EXPERIENCE.md §App Shell**: dizer explicitamente que "Menu selecionado" inclui `aria-current="page"` (ou trocar para só canais visuais + `aria-expanded`) |
| **DIV-13** | `{components.app-shell-nav-icon}` fixa **20px** para ícones de navegação | `CAPTURE_FAB_ICON_SIZE = 24` **apenas** no FAB (constante nomeada, nunca literal solto); todos os itens de nav seguem em 20px | o FAB tem área de 52px (`{components.capture-action}`): 20px nele fica visualmente subdimensionado, e o mockup aprovado usa ~24px | `ShellLayout.tsx` → `CAPTURE_FAB_ICON_SIZE` | **DESIGN.md §App Shell / `{components.capture-action}`**: registrar o tamanho de ícone próprio do FAB |
| **DIV-14** | `UX-DR30 item 9` / `migration-plan` pedem que o "aceite meça **paridade**, não apenas screenshot" | a Onda 2a **não** introduz regressão visual automatizada por imagem: a paridade é medida por asserts **semânticos** (nomes/papéis/estados, `aria-current`, landmarks) e **geométricos** (tokens resolvidos, larguras, alvos, hit-test de foco) no browser real | Playwright **não roda no CI** (arquitetura §7.4): baselines de imagem locais seriam custo de manutenção sem gate, e ainda mais frágeis num app com 4 famílias cromáticas × 2 modos previstas para a 18.1. Se o dono quiser baselines, é uma story própria de infraestrutura de teste | — | **migration-plan.md** (riscos) e **EXPERIENCE.md §UX Acceptance Criteria**: registrar que a Onda 2a mede paridade por asserts, não por screenshot |

### Notas e limitações de composição registradas na Story 13.4

| # | Achado | Decisão e justificativa |
|---|---|---|
| **DIV-15** | **Cabeçalho de grupo permanece duplicado** entre `ShellSidebar.renderGroup` e `ShellNavigationSheet.renderGroup` (a **linha de destino** foi unificada em `ShellNavDestination.tsx`) | Unificar o agrupador exigiria uma prop condicional para **cada** divergência real da sidebar: rail (`aria-label`/`justifyContent`/`px`/`cursor`), `aria-describedby` de "Contém a página atual", peso condicional (`activeChild ? 700 : 600` × fixo 600) e chevron oculto no rail. O AC3 da 13.4 manda **parar** quando a unificação for lesiva: 4 props condicionais para 2 consumidores produziriam um componente pior que as duas cópias. O que era divergência de **comportamento** (o predicado de ativo) foi eliminado; sobra divergência de **composição**, que é intencional. O guard de ícone, que era o único trecho duplicado com risco, virou `navIcons.navIconFor` — usado pelos dois |
| **DIV-16** | **O registro de collections não tem label de grupo.** `CollectionNav` só carrega `group?: string`; o rótulo humano ("Saúde") não existe no dado | O rótulo vive num mapa **nomeado** (`GROUP_LABELS` em `shellDestinations.ts`), não em literais espalhados pela derivação, e uma chave fora do mapa **degrada para a própria chave** em vez de renderizar `undefined`. Além disso `ShellDestinationGroup.key` é tipada como `NavIconKey` (catálogo fechado) mas na prática recebe string aberta do registro — daí o cast e o guard de ícone. **Upstream a absorver:** `architecture.md#AD-17` (acrescentar `nav.groupLabel` ao manifest) — é decisão de arquitetura, não desta story |
| **DIV-17** | **A superfície legada de captura fica FORA do `<main>`.** O MUI portaliza o `BrainDumpCaptureSheet`, então o `exclude: 'main'` da SHELL-DEBT-02 não a alcançava; medido no browser, o label do `TextField` "Título" em foco dá ≈**2.8:1** (primary do tema **legado**, `#2bada0`) | As duas células "Capture Sheet aberto" usam `exclude: ['main', '[role="dialog"][aria-label="Captura rápida"]']` — **extensão de escopo da SHELL-DEBT-02**, não regra silenciada: nenhuma regra do axe é desligada, `disableRules` continua não existindo no repositório, e o achado está inventariado com dono (**LEG-03** em `13-shell-a11y-legacy-inventory.md`). O que essas células medem é o **chrome** com a captura aberta (FAB/âncora, topbar, backdrop, skip link, inertização do conteúdo inferior). O `--ds-primary` do sistema novo (`#315F5A`) já resolve o mesmo papel com contraste conforme; `theme.ts` é **fora de escopo** da 13.4 (rota de rollback) |
| **DIV-18** | **Ordem de DOM do FAB.** No compact, o `ShellLayout` renderiza a `ShellBottomNav` **antes** do FAB, mas visualmente o FAB fica **acima** da barra | **Verificado e registrado, não reordenado.** WCAG `2.4.3` pede ordem que preserve significado e operabilidade, não coincidência pixel a pixel: ambos são alcançáveis por teclado, na sequência barra → FAB, nenhum encoberto (hit-test), e a ordem lê como "navegação da barra, depois a ação flutuante". Reordenar o DOM mudaria o `pb`/`scroll-padding` do compact e o gate axe da 13.3 sem ganho de operabilidade. Evidência: `shell-keyboard.spec.ts::ordem de Tab no compact: conteúdo → bottom nav → FAB, todos alcançáveis` |
| **DIV-19** | **Leitor de tela real não é automatizável nesta suíte** | A cobertura de "screen reader" delegada pela 13.0 é exercida por **nome/papel/estado** acessível (axe real nas 16 células + asserts de `aria-current`/`aria-expanded`/`aria-disabled`/`aria-describedby`) e pela **live region única** de rota. Nenhum teste dirige NVDA/VoiceOver. **Limitação conhecida, não item verificado** |
| **DIV-20** | **Swipe-down do sheet e `env(safe-area-inset-*)` reais não são automatizados** (registrado honestamente na 13.3 e mantido) | O `SwipeableDrawer` fornece o gesto, mas o Chromium headless do Playwright não emula o arraste com fidelidade, e o desktop Chromium tem safe-area = 0. Os outros 3 modos de fechamento têm evidência; a safe-area é verificada pela **presença do token** na geometria (`env(safe-area-inset-bottom, 0px)` no grep de `ShellBottomNav.tsx`), não pelo valor num device real |

## Dívidas de acessibilidade

| ID | Dívida | Detalhe | Situação |
|---|---|---|---|
| SHELL-DEBT-01 | ~~Contraste do label da bottom nav legada~~ | A `ShellBottomNav` nova usa `var(--ds-ink-muted)` sobre `var(--ds-surface)` (≥4.5:1) no label não-selecionado e a barra ENTROU no gate axe compact. | ✅ **fechada (13.3)** |
| SHELL-DEBT-02 | Conteúdo legado das superfícies fora do gate | **RE-ESCOPADA na 13.4 com dono explícito.** O `<main>` da superfície legada (e a superfície de captura portalizada — DIV-17) permanece fora do `AxeBuilder`. A dívida deixa de ser genérica: os achados de `/today` estão **inventariados por faixa, com nó, medição e dono** em [`13-shell-a11y-legacy-inventory.md`](./13-shell-a11y-legacy-inventory.md) (LEG-01…LEG-04). **Dono:** a onda que migra cada superfície (**Ondas 3–5 / Épicos 14–16**) + o **Épico 18** para a troca global de `theme.ts` — a causa raiz de LEG-01/02/03 é o papel `primary` do sistema **legado** (`#2bada0`, 2.47:1), que os tokens novos já resolvem (`--ds-primary = #315F5A`). **Obrigação por onda:** rodar o coletor (`playwright.inventory.config.ts`) na própria superfície antes de declarar paridade de a11y | 🔁 **re-escopada (13.4)** → Ondas 3–5 + Épico 18 |
| SHELL-DEBT-03 | ~~Destino ativo da `ShellSidebar` por match EXATO~~ | **FECHADA na 13.4:** predicado ÚNICO `isDestinationActive` em `frontend/src/app/layout/shell/shellDestinations.ts`, consumido pelas três superfícies; as 3 cópias literais foram removidas. As 9 rotas profundas passam a ativar o destino pai, com a invariante de **um só** `aria-current` provada sobre `shellRoutes` inteiro (seção A.1) | ✅ **fechada (13.4)** |
| SHELL-DEBT-04 | ~~Collections avulsas escolhidas por `id` hardcoded~~ | **FECHADA na 13.4:** `deriveShellNavItems` monta **unidades** (avulsa \| grupo) e ordena por `nav.order` com tiebreak no índice de primeira ocorrência no registro; zero `id` literal (grep de guarda). Uma collection avulsa inédita aparece nas três superfícies — o DoD estrutural do AD-17 virou teste executável (ST-08). O guard de ícone foi estendido ao **cabeçalho de grupo** (`navIcons.navIconFor`), que antes derrubava o chrome com uma chave nova. **Gateamento** (filtrar o registro) segue fora de escopo (Épico 10); a derivação apenas tolera listas filtradas | ✅ **fechada (13.4)** |

> **`prefers-reduced-motion` NÃO entra nesta tabela.** Não é dívida de
> acessibilidade e não está deferido: é **waiver consciente** do dono (UX-DR30
> item 6 dispensado para o App Shell — Hugo, 2026-07-24), registrado em
> **`A11Y-07`** (seção G). Não criar `SHELL-DEBT-0x` para ele.

### Notas / decisões de implementação preservadas (13.2/13.3)

- **Nav mínima.** As três superfícies derivam as collections da lista **filtrada**
  (nunca hardcodam as 4): grupo `Saúde` só renderiza com ≥1 filho, avulsas só se
  presentes, `Planner` sempre completo, nunca há heading "Collections". Preparado
  para o default all-off de convidados (Épico 10). → `ST-07`
- **Foco inicial do sheet** no destino ativo por dois mecanismos complementares
  (foco no `ref` do item na montagem + refoco em `onEntered`, que vence o
  FocusTrap do Modal no browser real). Ajustado na review da 13.3: o alvo sai da
  lista de destinos **visíveis** e o foco é **armado só na abertura** (WCAG 2.2
  `3.2.1 On Focus`). → B.1
- **Tokens em portal.** As custom properties `--ds-*` aplicadas na raiz do shell
  não alcançam o paper de um `Drawer` portalizado: o `ShellNavigationSheet`
  reaplica `shellCssVariables()` nos slots `paper` e `backdrop`.
- **Chrome do compact é estado do compact**: sair da faixa fecha o
  `ShellNavigationSheet` (`ShellLayout`), senão voltar ao compact reabriria um
  Modal sem ação do usuário, com o foco preso.
- **Derivação por render, não em escopo de módulo**: uma constante de módulo
  congelaria os atalhos no primeiro import e deixaria de acompanhar o gateamento
  (Épico 10) e a preferência por conta (18.1).

## Rollback por superfície (Story 13.1, Task 4)

A coexistência é **declarativa e por rota**, sem flag de ambiente, feature flag
remota ou toggle de UI (o seletor visível "Legado/Moderno" está explicitamente
**rejeitado** no reconcile da 13.0).

**Arquivo:** `frontend/src/app/layout/shell/shellRouting.ts`
**Campo:** `shell` de cada entrada do array `shellRoutes` (`'new' | 'legacy'`).

**Rollback de uma superfície (uma linha):** trocar `shell: 'new'` por
`shell: 'legacy'` na entrada da rota afetada.

```ts
// Antes
{ routeId: 'planner/week', shell: 'new', surfaceMigrated: false },
// Rollback → volta a montar o AppLayout legado nessa rota
{ routeId: 'planner/week', shell: 'legacy', surfaceMigrated: false },
```

**Efeito:** `ProtectedLayout` (`router.tsx`) lê a entrada da rota ativa via
`useMatches()` + `resolveShellRoute()` e monta `AppLayout` legado (casca
intocada) em vez de `ShellLayout` — sem tocar em nenhum outro arquivo.

**Campo relacionado:** `surfaceMigrated` liga/desliga o seam legado
(`false` ⇒ faixa "Esta área ainda usa a versão anterior" visível). Marcar
`true` quando a superfície interna daquela rota for de fato migrada.

**Como verificar:**
1. Unitário: `shellRouting.test.ts` garante que toda rota autenticada do
   `router.tsx` tem entrada, a forma dos dados e a ausência de import de
   Query/hooks (dados puros).
2. Manual (dev): abrir a rota; casca `new` mostra topbar de 56px + skip link +
   seam; casca `legacy` mostra o `AppLayout` de hoje (sem topbar no mobile).

**Estado na 13.4:** as **22** entradas seguem `shell: 'new'`; nenhuma rota foi
migrada para `'legacy'`, e `AppLayout.tsx`/`Sidebar.tsx`/`BottomNav.tsx`/
`theme.ts`/`registry.ts` seguem **sem diff** (verificado por `git diff --stat` no
fechamento da story).

**Rollback de produção** = **não promover** `dev → main`. A coexistência e o
rollback por superfície são mecanismos de **dev/homologação**; prod permanece no
sistema atual durante as ondas (`migration-plan.md`, nota de promoção
2026-07-23; fluxo `dev → main` vigente desde 2026-07-22).

## Onda 2a — equivalência comprovada

Seção de fechamento da Story 13.4. A Onda 2a fecha com **equivalência comprovada**
(paridade medida), não estimada: cada item de A–H acima tem status final e
`arquivo::nome do teste`, e o piso de acessibilidade está fechado **exceto
`prefers-reduced-motion`**, que é **waiver consciente de produto** do dono
(`A11Y-07`) — não pendência, não dívida, não deferimento.

### Matriz do gate axe — faixa × rota × estado

`expectNoAxeViolations` com as tags `wcag2a, wcag2aa, wcag21a, wcag21aa,
wcag22aa`, **sem `disableRules`** e sem nenhuma regra silenciada. Nenhuma célula
usa `test.skip`/`test.fixme`. `label` no formato `faixa · rota · estado`.

**Tabela A — rotas por faixa** (todas com `exclude: 'main'`):

| Faixa / viewport | Rota | Estado | Spec dono | Resultado |
|---|---|---|---|---|
| wide 1440×900 | `/today` | sidebar expandida | `shell-a11y.spec.ts` | ✅ |
| wide 1440×900 | `/planner/week` | rail colapsado + agrupador com filho ativo | `shell-sidebar.spec.ts::axe sem violações no chrome com a sidebar em rail` | ✅ |
| wide 1440×900 | `/settings` | divisor + último destino do chrome | `shell-a11y.spec.ts` | ✅ |
| wide 1440×900 | `/today` | **skip link EM FOCO** — o único controle do chrome que vive fora da tela (`translateY(-160%)`) até receber foco; nas outras células o axe não mede `color-contrast` dele (célula acrescentada no passo de QA) | `shell-a11y.spec.ts::wide · /today · skip link EM FOCO…` | ✅ |
| medium 1280×800 | `/today` | faixa sem cobertura antes da 13.4 | `shell-a11y.spec.ts` | ✅ |
| medium 1280×800 | `/brain-dump` | destino com badge no ativo | `shell-a11y.spec.ts` | ✅ |
| medium 1280×800 | `/health/metrics/history` | ativo por prefixo (A.1) + readonly | `shell-a11y.spec.ts` | ✅ |
| tablet 800×720 | `/today` | rail inicial da faixa | `shell-a11y.spec.ts` | ✅ |
| tablet 800×720 | `/habits` | collection avulsa derivada do registro, em rail | `shell-a11y.spec.ts` | ✅ |
| compact 390×720 | `/today` | topbar + bottom nav + FAB | `shell-a11y.spec.ts` | ✅ |
| compact 390×720 | `/health/metrics` | rota fora dos 3 atalhos ⇒ Menu selecionado (DIV-12) | `shell-a11y.spec.ts` | ✅ |
| compact 320×720 | `/today` | reflow mínimo | `shell-a11y.spec.ts` | ✅ |
| compact 320×720 | `/archive` | prefixo profundo na faixa mínima | `shell-a11y.spec.ts` | ✅ |

**Tabela B — estados do chrome sob axe:**

| Faixa | Estado | Spec dono | Escopo | Resultado |
|---|---|---|---|---|
| compact 390×720 | sheet de navegação **aberto** | `shell-bottomnav.spec.ts::axe sem violações com o sheet de navegação aberto` | `exclude: 'main'` | ✅ |
| compact 390×720 | Capture Sheet **aberto pelo FAB** | `shell-a11y.spec.ts` | `exclude: ['main', dialog de captura]` — DIV-17 | ✅ |
| compact 390×720 | **offline** (FAB `aria-disabled`) | `shell-a11y.spec.ts` | `exclude: 'main'` | ✅ |
| wide 1440×900 | Capture Sheet aberto pela **âncora** | `shell-a11y.spec.ts` | `exclude: ['main', dialog de captura]` — DIV-17 | ✅ |
| wide 1440×900 | **offline** (âncora `aria-disabled`) | `shell-a11y.spec.ts` | `exclude: 'main'` | ✅ |
| medium 1280×800 | badge `9+` (12 itens semeados) | `shell-a11y.spec.ts` | `exclude: 'main'` | ✅ |

**Cuidado metodológico de toda célula:** antes de cada `analyze()` o spec espera
um **marcador estável** (título na `banner`, `toBeFocused` do título do Capture
Sheet, `aria-disabled` do controle offline, texto `9+` do badge, rail assentado com
os filhos do agrupador desmontados). Medir durante transição foi um vermelho falso
real durante a montagem desta matriz (a célula `tablet · /habits` reprovava
`target-size` por milissegundos, com um filho de grupo sendo clipado pelo
`Collapse`) — daí o helper `waitForRailSettled`.

### Auditoria além do axe (o que o axe não mede)

| Requisito | Faixas medidas | Evidência |
|---|---|---|
| Skip link primeiro focável ⇒ wrapper de conteúdo | wide · medium · tablet · compact | `shell-keyboard.spec.ts::skip link é o primeiro focável e leva ao wrapper de conteúdo` (+ 3 variantes) |
| Ordem de Tab = ordem visual (`2.4.3`) | wide · medium · tablet (rail) · compact | `shell-keyboard.spec.ts::ordem de Tab acompanha a ordem visual…` · `…em medium…` · `…no rail do tablet…` · `…no compact: conteúdo → bottom nav → FAB…` (DIV-18) |
| Destino ativo no **router real** (`4.1.2`) | wide (as 22 rotas) · compact (sheet) | `shell-active-destination.spec.ts` (5 testes — ver A.1) |
| Foco **não encoberto** (`2.4.11`), tokens lidos do DOM | wide · medium · tablet · compact 390 · 320 · 720×450 · 640×400 | `shell-keyboard.spec.ts::primeiro e último focáveis…` (7 testes) |
| Foco visível pelo token (`2.4.7`) | wide · compact · **sheet portalizado** | `shell-keyboard.spec.ts::foco visível resolve outline de --ds-focus…` (2 testes) · `…usa o anel do token também DENTRO do sheet portalizado` (3º teste; achado + correção do passo de QA — ver A11Y-06) |
| Atalhos `[`/`B` — positivos **e** negativos | wide · medium (valem) · tablet · compact (não valem) | `shell.spec.ts` (wide) · `shell-keyboard.spec.ts` (medium/tablet/compact) |
| `Escape` fecha o sheet devolvendo o foco ao **Menu** | compact | `shell-keyboard.spec.ts::Escape fecha o sheet e devolve o foco ao Menu` |
| Live region ÚNICA de rota no chrome (`4.1.3`) | wide · compact | `shell-keyboard.spec.ts::o chrome tem exatamente uma live region de rota; a topbar é estática` · `…o chrome do compact…` |
| Reflow 320 CSS px (`1.4.10`) | compact 320 | `shell-keyboard.spec.ts::320 CSS px…` (2 testes) · `shell-bottomnav.spec.ts::sem scroll horizontal…` |
| Zoom 200% (`1.4.4`) por viewport equivalente | 1440×900 → **720×450** · 1280×800 → **640×400** | `shell-keyboard.spec.ts::chrome recompõe para compact sem perder destino nem ação` (+ `(640×400)` + 2 de foco) |

**Emulação de zoom 200% — decisão documentada no spec:** viewport com **metade das
dimensões em CSS px** da faixa de origem. `Emulation.setPageScaleFactor` (CDP) é
pinch-zoom: escala pixels sem mudar CSS px e sem refluir, logo é inadequado para
`1.4.4`/`1.4.10`. `document.documentElement.style.zoom` recompõe no Chromium mas
interage com `position: fixed`, `100svh` e `env(safe-area-inset-*)` do chrome — só
serviria como complemento. A **recomposição** wide/medium → compact (720 e 640 caem
abaixo de 768) é **parte do aceite**: nenhum destino ou ação do chrome fica
inacessível na troca, e o sheet continua listando todos os destinos.

### Gates executados no fechamento

Ver *Completion Notes* da Story 13.4
(`13-4-passe-de-paridade-e-acessibilidade-do-shell.md`) para as contagens
literais de Vitest, `typecheck`, `lint` e E2E, com o comando real de cada um.
Resumo:

- **Vitest** — suíte completa verde (baseline da 13.3: 89 arquivos / 952 testes).
- **`typecheck`** (`tsc -b --noEmit`) e **`lint`** (`eslint .`) limpos.
- **E2E** — os 6 specs do shell (`shell`, `shell-a11y`, `shell-sidebar`,
  `shell-bottomnav`, `shell-keyboard`, `shell-states`) **mais** os specs que
  navegam pelo chrome (`brain-dump`, `archive`, `daily-tasks`,
  `gratitude-history`, `habit-history`, `health-history`, `medications-history`) —
  porque a derivação de destinos e o predicado de ativo mudaram.
- **Legados de rollback intocados:** `git diff --stat` vazio em `AppLayout.tsx`,
  `Sidebar.tsx`, `BottomNav.tsx`, `theme.ts` e `registry.ts`; nenhuma entrada de
  `shellRouting.ts` virou `'legacy'`.
- **Coletor de inventário** (`playwright.inventory.config.ts`) rodado nas 5 faixas
  — resultado em `13-shell-a11y-legacy-inventory.md`. É coleta, **não** gate.

**Passo de QA (`bmad-qa-generate-e2e-tests`, 2026-07-24) — acréscimo ao fechamento.**
Auditoria do que jsdom não pode reprovar, com **1 defeito de produto encontrado e
corrigido**: o sheet de navegação é portalizado pelo MUI (fora do `shell-root`) e o
`ButtonBase` aplica `outline: 0`, então **nenhum** dos seus controles tinha anel de
foco — a regra `:focus-visible` do token foi reaplicada no slot `paper`
(`ShellNavigationSheet.tsx`), com detector E2E permanente. Mais **+9 E2E**: o sweep
de destino ativo nas **22 rotas do router real** (`shell-active-destination.spec.ts`,
novo), ordem de Tab em **medium** e no **rail do tablet**, e a célula do **skip link
em foco** (17ª da matriz). As 2 falhas pré-existentes de `archive`/`daily-tasks`
(ambiguidade de locator, test-only) foram corrigidas. Contagens: E2E do shell
**95 passed**, specs que navegam pelo chrome **29 passed**, Vitest **89/981**
inalterado. Detalhe em `tests/test-summary-13-4.md`.
