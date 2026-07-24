# Checklist de paridade do App Shell — Épico 13

> Inventário **enumerado e verificável** do chrome real do app, extraído do
> código (não de suposição), com arquivo/linha de origem. Cada item é o contrato
> de comportamento que o shell novo (Stories 13.1–13.4) precisa preservar.
>
> - **Origem** aponta o arquivo/linha no commit baseline da Story 13.1
>   (`ee50f10`).
> - **Status**: `parity` = comportamento já preservado pelo shell novo; `13.2`/
>   `13.3`/`13.4` = entrega/verificação daquela story; `debt` = dívida registrada.
> - Divergências **contratadas** (não são bugs) estão na seção própria.
>
> Criado na Story 13.1 (2026-07-24). As Stories 13.2–13.4 consomem e atualizam
> este artefato.

## A. Navegação — Sidebar (desktop/tablet)

| ID | Item | Comportamento atual | Origem | Status |
|---|---|---|---|---|
| SB-01 | Destino "Hoje" | `/today`, ícone `TodayIcon`, topo da lista | `Sidebar.tsx:59` | parity |
| SB-02 | Grupo colapsável "Planner" | cabeçalho com `EventNoteIcon` + chevron; inicia aberto (`plannerOpen=true`) | `Sidebar.tsx:88,168-192` | parity |
| SB-03 | Filhos de Planner e ordem | Esta Semana → Este Mês → Futuro → Recorrentes | `Sidebar.tsx:62-67` | parity |
| SB-04 | Destino "Gratidão" (avulso) | derivado do registro (`collectionNavItem('gratitude')`) | `Sidebar.tsx:80` | parity |
| SB-05 | Grupo colapsável "Saúde" | cabeçalho `FavoriteBorder` + chevron; inicia aberto (`healthOpen=true`); agrupador **não** recebe `aria-current` | `Sidebar.tsx:89,197-221` | parity |
| SB-06 | Filhos de Saúde e ordem | grupo `saude` por `nav.order`: Métricas → Medicamentos | `Sidebar.tsx:71-74` | parity |
| SB-07 | Destino "Hábitos" (avulso) | derivado do registro (`collectionNavItem('habits')`) | `Sidebar.tsx:79` | parity |
| SB-08 | Destino "Brain Dump" | `/brain-dump`, ícone `InboxIcon` envolto por `BrainDumpBadge` | `Sidebar.tsx:81` | parity |
| SB-09 | Destino "Arquivo" | `/archive`, ícone `FolderOpenIcon` | `Sidebar.tsx:82` | parity |
| SB-10 | Divisor + "Configurações" | `Divider` seguido de `/settings` com `SettingsIcon` | `Sidebar.tsx:225-227` | parity |
| SB-11 | Indicação de ativo | borda-esquerda 3px `primary` + fundo `alpha(primary,0.10)` + peso 700 + `aria-current="page"` | `Sidebar.tsx:101-110,119` | parity |
| SB-12 | Colapso 240↔56px | `DRAWER_WIDTH=240` / `COLLAPSED_WIDTH=56`; transição `width 0.2s`; oculta labels | `Sidebar.tsx:34-35,138-146` | parity (largura muda p/ 64 → **13.2**) |
| SB-13 | Grupos fecham ao colapsar | `useEffect` fecha Planner/Saúde quando `collapsed` | `Sidebar.tsx:91-96` | parity |
| SB-14 | Landmark da navegação | `<nav aria-label="Navegação principal">` (único; não duplicado pelo shell) | `Sidebar.tsx:148` | parity |
| SB-15 | Botão colapsar/expandir | `IconButton` com aria-label alternando; `MenuOpen`/`Menu` | `Sidebar.tsx:159-161` | parity (ícone → `sidebar-simple` na **13.2**) |

## B. Navegação — BottomNav (compact <768px)

| ID | Item | Comportamento atual | Origem | Status |
|---|---|---|---|---|
| BN-01 | 4 abas fixas | Hoje · Planner · Hábitos · Saúde | `BottomNav.tsx:68-71` | 13.3 (vira 3 configuráveis + Menu) |
| BN-02 | Paths das abas | `['/today','/planner/week', habits, saude]` | `BottomNav.tsx:30` | parity |
| BN-03 | Aba ativa por prefixo | `getCurrentTab` casa por `startsWith` | `BottomNav.tsx:32-38` | parity |
| BN-04 | Landmark | `<nav aria-label="Navegação mobile">` (Paper fixo, `bottom:0`) | `BottomNav.tsx:50-52` | parity |
| BN-05 | `pb` de safe-area na barra | `pb: env(safe-area-inset-bottom, 0px)` no `BottomNavigation` | `BottomNav.tsx:66` | parity |
| BN-06 | Contraste do label não-selecionado | reprova `color-contrast` (axe real) — **dívida legada** | `BottomNav.tsx:68-71` | debt → SHELL-DEBT-01 |

## C. Captura / FAB (compact)

| ID | Item | Comportamento atual | Origem | Status |
|---|---|---|---|---|
| FAB-01 | FAB de captura | `position:fixed`, `bottom: calc(56px + safe-area + 16px)`, `right:16`, 52×52 | `BottomNav.tsx:80-90` | 13.3 |
| FAB-02 | aria-label online/offline | "Captura rápida" / "Captura rápida (sem conexão)" | `BottomNav.tsx:81` | parity |
| FAB-03 | `disabled` offline + Tooltip | `disabled={!isOnline}`; `Tooltip title="Sem conexão"`; `<span>` obrigatório em volta do FAB disabled | `BottomNav.tsx:75-97` | parity |
| FAB-04 | Badge sobre o ícone | `BrainDumpBadge` envolve `AddIcon` | `BottomNav.tsx:92-94` | parity |
| FAB-05 | `BrainDumpCaptureSheet` | abre por `captureOpen`; `onClose` fecha | `BottomNav.tsx:98` | parity |

## D. Badge do Brain Dump

| ID | Item | Comportamento atual | Origem | Status |
|---|---|---|---|---|
| BD-01 | Badge MUI `color="primary"` | `badgeContent={count}` | `BrainDumpBadge.tsx:14` | parity (token `app-shell-badge` na **13.2**) |
| BD-02 | Oculto em zero | `invisible={count === 0}` | `BrainDumpBadge.tsx:14` | parity |
| BD-03 | Nome acessível com contagem exata | `aria-label="Brain Dump: N item(ns) pendente(s)"` | `BrainDumpBadge.tsx:12,14` | parity |
| BD-04 | `9+` acima de 9 preservando contagem | **não implementado hoje** (Badge MUI usa `max`? não configurado) — cap `9+` é da **13.2** | `BrainDumpBadge.tsx:9-14` | 13.2 |

## E. Atalhos de teclado

| ID | Item | Comportamento atual | Origem | Status |
|---|---|---|---|---|
| KB-01 | `[` toggle da sidebar | só desktop (≥1024px); ignora campo editável | `AppLayout.tsx:36-37` → `ShellLayout.tsx` | parity |
| KB-02 | `B` navega p/ Brain Dump | só desktop; guard de `ctrl/meta/alt`; ignora campo editável | `AppLayout.tsx:38-44` → `ShellLayout.tsx` | parity |
| KB-03 | Escopo dos atalhos | `mediaQueries.desktop` = `(min-width: 1024px)` (string idêntica) | `tokens.ts:mediaQueries` | parity |

## F. Anúncio de rota / topbar

| ID | Item | Comportamento atual | Origem | Status |
|---|---|---|---|---|
| RA-01 | `RouteAnnouncer` `role=status` `aria-live=polite` | lê `handle.title` do match mais profundo | `RouteAnnouncer.tsx:19-23` | parity |
| RA-02 | Topbar como título visual | `ShellTopbar` mostra o mesmo `handle.title`, **estático**, nunca live region | `ShellTopbar.tsx` | parity (novo) |
| RA-03 | Um `main` por rota | páginas renderizam `<main>`; shell **não** introduz outro | `router.test.tsx:133`, `RouteAnnouncer.test.tsx:125` | parity |

## G. Contrato acessível do shell (novo em 13.1)

| ID | Item | Comportamento atual | Origem | Status |
|---|---|---|---|---|
| A11Y-01 | Skip link primeiro focável | `Pular para o conteúdo`, oculto até foco; alvo = wrapper `tabIndex=-1` em volta do `<Outlet/>` | `SkipLink.tsx`, `ShellLayout.tsx` | parity (novo) |
| A11Y-02 | Topbar = `header` | landmark `banner` | `ShellTopbar.tsx` | parity (novo) |
| A11Y-03 | Focus não encoberto | `scroll-padding-top` = topbar + banner DEV; `scroll-padding-bottom` = bottom nav + FAB + safe-area (compact) | `ShellLayout.tsx` | parity (novo) |
| A11Y-04 | `pb` do conteúdo no compact | `calc(bottom-nav + safe-area + 8px)` (paridade `AppLayout.tsx:55`) | `ShellLayout.tsx` | parity |
| A11Y-05 | Banner de DEV respeitado | altura descontada via `--dev-banner-height`; Drawer reposicionado por `index.css` | `index.css:18-29`, `ShellLayout.tsx` | parity |
| A11Y-06 | Focus ring do shell | `--ds-focus` 2px offset 2px em `:focus-visible` | `tokens.ts:focusRing`, `ShellLayout.tsx` | parity (novo) |

## H. Estados exigidos pelo aceite da 13.4

Comportamento **atual** de cada estado no chrome/superfícies (base para a matriz completa da Story 13.4):

| ID | Estado | Comportamento atual | Origem | Status |
|---|---|---|---|---|
| ST-01 | vazio | Daily Log vazio mostra "Nenhuma tarefa para hoje." | `fixtures.ts:18` (e2e) | 13.4 |
| ST-02 | loading | badge do Brain Dump oculto enquanto `data` indefinido; contagem só aparece com dados | `BrainDumpBadge.tsx:9-14` | 13.4 |
| ST-03 | error | falha do contador não bloqueia navegação/captura (badge some) | `BrainDumpBadge.tsx` | 13.4 |
| ST-04 | offline | FAB `disabled` + Tooltip "Sem conexão"; `useOnlineStatus` | `BottomNav.tsx:75-97` | 13.4 |
| ST-05 | disabled | controles indisponíveis com tinta disabled preservando rótulo/motivo | `EXPERIENCE.md §Accessibility Floor` | 13.4 |
| ST-06 | readonly | superfícies de histórico em leitura; sem ação de escrita | `EXPERIENCE.md §Padrões de página` | 13.4 |

## Divergências contratadas (não são bugs)

| # | Hoje | Contrato novo | Resolve em |
|---|---|---|---|
| DIV-1 | Sidebar colapsada `56px` (`COLLAPSED_WIDTH`) | rail `64px` (`{components.app-shell.sidebar-collapsed}`) | 13.2 |
| DIV-2 | Bottom nav = 4 destinos fixos | 3 configuráveis + item fixo **Menu** | 13.3 |
| DIV-3 | Mobile **sem** topbar (`AppLayout` renderiza só `Outlet` + `BottomNav`) | compact **tem** topbar (superfície protagonista) | **13.1 (feito)** |
| DIV-4 | Saúde usa ícone `FavoriteBorder` | catálogo novo usa `first-aid-kit` (Phosphor) | 13.2 |
| DIV-5 | Ícones MUI (`@mui/icons-material`) | catálogo `@phosphor-icons/react` | 13.2/13.3 |
| DIV-6 | Badge sem cap visual | `9+` acima de 9, contagem exata no nome acessível | 13.2 |

## Dívidas de acessibilidade (deferidas para a 13.4)

| ID | Dívida | Detalhe | Deferida para |
|---|---|---|---|
| SHELL-DEBT-01 | Contraste do label da bottom nav legada | `.MuiBottomNavigationAction-label` de aba não-selecionada reprova `color-contrast` (axe real, viewport compact `/today`). Componente legado renderizado sem alteração nesta story; excluído do gate axe do `shell-a11y.spec.ts` (compact) com nota. | 13.3 (reconstrução da bottom nav) / 13.4 (matriz axe) |
| SHELL-DEBT-02 | Conteúdo legado das superfícies fora do gate | O `<main>` da página legada é excluído do `AxeBuilder` (`exclude: 'main'`) — a dívida de a11y do conteúdo interno é migrada onda a onda. | 13.4 (matriz wide/medium/compact completa) |

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
   Query/hooks (dados puros — preserva os 3 testes compartilhados sem mock novo).
2. Manual (dev): abrir a rota; casca `new` mostra topbar de 56px + skip link +
   seam; casca `legacy` mostra o `AppLayout` de hoje (sem topbar no mobile).

**Rollback de produção** = **não promover** `dev → main`. A coexistência e o
rollback por superfície são mecanismos de **dev/homologação**; prod permanece no
sistema atual durante as ondas (`migration-plan.md`, nota de promoção
2026-07-23; fluxo `dev → main` vigente desde 2026-07-22).
