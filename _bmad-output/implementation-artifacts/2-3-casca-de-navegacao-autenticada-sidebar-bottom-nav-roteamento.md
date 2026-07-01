---
baseline_commit: 82aad376e3a2e0ac5f87cc67df7e77e4be22e965
---

# Story 2.3: Casca de Navegação Autenticada (sidebar, bottom-nav, roteamento)

Status: done

## Story

Como **Hugo**,
Quero **navegar entre as superfícies do app por uma sidebar no desktop e bottom-nav no mobile, com roteamento protegido**,
Para que **eu acesse cada módulo do BuJo a partir de uma casca consistente e familiar** (UX-DR7, UX-DR8, UX-DR17, NFR-1).

## Acceptance Criteria

**AC1 — Sidebar desktop (≥1024px)**
**Dado que** o `AppLayout` no desktop (≥1024px),
**Quando** renderizado,
**Então** exibe a sidebar fixa (240px) com os itens de navegação: Hoje, Planner ▸ Esta Semana / Este Mês / Futuro (grupo colapsável), Hábitos, Saúde ▸ Métricas / Medicamentos (grupo colapsável), Gratidão, Brain Dump, Arquivo, separador visual, Configurações,
**E** o item da rota ativa recebe borda esquerda 3px de `primary.main` + fundo `alpha(primary.main, 0.10)`,
**E** o toggle de colapso (icon-only, 56px) funciona via botão dedicado e via atalho de teclado `[`,
**E** a tela de cada superfície ainda não implementada exibe um placeholder honesto com o nome da superfície ("Em desenvolvimento.") — nunca uma tela de erro.

**AC2 — Bottom-nav mobile (<768px)**
**Dado que** o `AppLayout` no mobile (<768px),
**Quando** renderizado,
**Então** a sidebar fica oculta e aparece a bottom-nav com 4 abas fixas acima da safe-area: Hoje · Planner · Hábitos · Saúde, sem drawer nem hambúrguer,
**E** um FAB placeholder (52×52px, `position: fixed`, canto inferior direito, acima da bottom-nav) está presente com ícone de adição,
**E** não há scroll horizontal de navegação em nenhuma superfície.

**AC3 — Roteamento protegido**
**Dado que** um usuário não autenticado acessa qualquer rota protegida,
**Quando** a rota renderiza,
**Então** é redirecionado para `/login` (sem flash de conteúdo protegido),
**E** após autenticar com sucesso na `LoginPage`, o app navega para `/today` (Daily Log de hoje),
**E** o empilhamento de modal é limitado a 1 nível (nunca abre modal sobre modal).

**AC4 — SessionExpiredBanner conectado à navegação**
**Dado que** uma sessão expira enquanto o usuário está no app,
**Quando** o `SessionExpiredBanner` aparece,
**Então** o botão "Entrar" redireciona o usuário para `/login` (via hard redirect `window.location.assign('/login')` ou navigate),
**E** o conteúdo por baixo permanece visível — banner é `position: fixed`, não bloqueia a UI.

## Tasks / Subtasks

- [x] **Task 1 — Instalar dependências** (AC: 1, 2, 3)
  - [x] 1.1: `cd frontend && npm install react-router-dom` (v6.x — confirmar que não instala v7 que tem breaking changes)
  - [x] 1.2: `cd frontend && npm install @mui/icons-material` (mesma major que `@mui/material` — verificar `package.json` atual que tem `^6.1.0`)
  - [x] 1.3: Verificar que `npx tsc --noEmit` ainda passa após instalação (sem tipos quebrados)

- [x] **Task 2 — PlaceholderPage** (AC: 1, 2, 3)
  - [x] 2.1: Criar `frontend/src/pages/PlaceholderPage.tsx`:
    - Props: `title: string`
    - Renderiza `<Box component="main" aria-label={title}>` com `Typography variant="heading"` mostrando o `title` e `Typography variant="body-sm" color="text.secondary"` com texto "Em desenvolvimento."
    - SEM erro, SEM rota 404 — é um placeholder informativo e limpo

- [x] **Task 3 — Router com rotas protegidas** (AC: 3)
  - [x] 3.1: Criar `frontend/src/app/router.tsx` com `createBrowserRouter` do react-router-dom
  - [x] 3.2: Criar componente interno `LoginPageRoute`:
    - Usa `useNavigate`; passa `onSuccess={() => navigate('/today')}` para `<LoginPage />`
    - Se `isAuthenticated === true` → `<Navigate to="/today" replace />` (não exibir login se já autenticado)
  - [x] 3.3: Criar componente interno `SignupPageRoute`:
    - Usa `useNavigate`; passa `onSuccess={() => navigate('/today')}` para `<SignupPage />`
    - Se `isAuthenticated === true` → `<Navigate to="/today" replace />`
  - [x] 3.4: Criar componente `ProtectedLayout`:
    - Lê `isAuthenticated` do `useAuth()`
    - Se `!isAuthenticated` → `<Navigate to="/login" replace />`
    - Se autenticado → `<AppLayout />` (que internamente renderiza `<Outlet />`)
  - [x] 3.5: Mapear rotas conforme `UX-DR17`:
    ```
    /login        → LoginPageRoute (público)
    /signup       → SignupPageRoute (público)
    /             → ProtectedLayout
      /today            → PlaceholderPage title="Hoje"
      /planner/week     → PlaceholderPage title="Esta Semana"
      /planner/month    → PlaceholderPage title="Este Mês"
      /planner/future   → PlaceholderPage title="Futuro"
      /habits           → PlaceholderPage title="Hábitos"
      /health/metrics   → PlaceholderPage title="Métricas de Saúde"
      /health/medications → PlaceholderPage title="Medicamentos"
      /gratitude        → PlaceholderPage title="Diário de Gratidão"
      /brain-dump       → PlaceholderPage title="Brain Dump"
      /archive          → PlaceholderPage title="Arquivo"
      /settings         → PlaceholderPage title="Configurações"
      index             → <Navigate to="/today" replace />
      *                 → <Navigate to="/today" replace />
    ```

- [x] **Task 4 — Sidebar desktop** (AC: 1)
  - [x] 4.1: Criar `frontend/src/app/layout/Sidebar.tsx`
    - Props: `collapsed: boolean`, `onToggle: () => void`
    - MUI `Drawer` variant="permanent" com `sx={{ width: collapsed ? 56 : 240, overflowX: 'hidden', transition: 'width 0.2s' }}`
    - Lista de itens conforme mapa de `UX-DR17` com ícones do `@mui/icons-material`
    - Grupos colapsáveis (Planner, Saúde): estado local `plannerOpen`/`healthOpen`; `Collapse` do MUI; chevron rotaciona conforme estado; quando sidebar collapsed, grupos ficam fechados automaticamente
    - Item ativo detectado via `useLocation()` + `useMatch()` ou comparação `location.pathname.startsWith(item.path)`
    - Item ativo: `sx={{ borderLeft: '3px solid', borderColor: 'primary.main', bgcolor: (theme) => alpha(theme.palette.primary.main, 0.10) }}`
    - Item inativo: `sx={{ borderLeft: '3px solid transparent' }}`
    - `ListItemText` oculto quando `collapsed === true` (prop `sx={{ display: collapsed ? 'none' : 'block' }}`)
    - Botão de toggle no topo da sidebar (ícone `MenuOpenIcon`/`MenuIcon` ou `ChevronLeftIcon`/`ChevronRightIcon`)
    - `<nav aria-label="Navegação principal">` envolvendo o Drawer (AC de semântica — Story 2.4 vai validar, mas criar aqui)
  - [x] 4.2: Ícones sugeridos por item (ajustar conforme disponibilidade no `@mui/icons-material`):
    - Hoje → `TodayIcon`
    - Planner (grupo) → `EventNoteIcon`
    - Esta Semana → `DateRangeIcon`
    - Este Mês → `CalendarMonthIcon`
    - Futuro → `ScheduleIcon`
    - Hábitos → `RepeatIcon` ou `CheckCircleOutlineIcon`
    - Saúde (grupo) → `FavoriteOutlineIcon` ou `MonitorHeartIcon`
    - Métricas → `ShowChartIcon`
    - Medicamentos → `MedicationIcon`
    - Gratidão → `SentimentSatisfiedAltIcon`
    - Brain Dump → `InboxIcon`
    - Arquivo → `FolderOpenIcon`
    - Configurações → `SettingsIcon`
    - Separador → `<Divider sx={{ my: 1 }} />`

- [x] **Task 5 — BottomNav mobile** (AC: 2)
  - [x] 5.1: Criar `frontend/src/app/layout/BottomNav.tsx`
    - MUI `Paper` component com `sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: theme.zIndex.appBar, pb: 'env(safe-area-inset-bottom, 0px)' }}`
    - `BottomNavigation` com 4 `BottomNavigationAction`: Hoje / Planner / Hábitos / Saúde
    - Aba ativa determinada por `useLocation()` (comparação por prefixo de pathname)
    - Navegação via `useNavigate()` no `onChange` do `BottomNavigation`
    - Mapeamento: Hoje → `/today`, Planner → `/planner/week`, Hábitos → `/habits`, Saúde → `/health/metrics`
    - `<nav aria-label="Navegação mobile">` envolvendo o `Paper`
    - FAB placeholder: `Fab` do MUI, `size="large"` (52×52px), `sx={{ position: 'fixed', bottom: 'calc(56px + env(safe-area-inset-bottom, 0px) + 16px)', right: 16 }}`, ícone `AddIcon`; disabled sem funcionalidade real (funcionalidade real na Story 5.3)

- [x] **Task 6 — AppLayout responsivo** (AC: 1, 2)
  - [x] 6.1: Criar `frontend/src/app/layout/AppLayout.tsx`
    - Estado: `sidebarCollapsed: boolean` (local, não TanStack Query — é UI state)
    - Detecção de viewport: `const isDesktop = useMediaQuery('(min-width: 1024px)')` e `const isMobile = useMediaQuery('(max-width: 767px)')`
    - Desktop: `<Box sx={{ display: 'flex' }}>` com `<Sidebar collapsed={sidebarCollapsed} onToggle={...} />` + `<Box component="main" sx={{ flexGrow: 1, minWidth: 0, overflow: 'auto' }} aria-label="Conteúdo principal"><Outlet /></Box>`
    - Mobile: `<Box>` + `<Box component="main" sx={{ pb: 'calc(56px + env(safe-area-inset-bottom, 0px) + 8px)' }} aria-label="Conteúdo principal"><Outlet /></Box>` + `<BottomNav />`
    - Tablet (768–1023px): comportamento igual ao desktop, mas sidebar começa colapsada
    - Atalho `[` global: `useEffect` com `window.addEventListener('keydown', handler)` que verifica `event.key === '[' && isDesktop && toggle`; cleanup no return
    - Sem `overflow-x: hidden` no body — o layout não deve gerar scroll horizontal

- [x] **Task 7 — Atualizar App.tsx** (AC: 3)
  - [x] 7.1: Substituir o conteúdo placeholder de `App.tsx` por:
    ```tsx
    import { RouterProvider } from 'react-router-dom'
    import { router } from './app/router'
    export default function App() {
      return <RouterProvider router={router} />
    }
    ```
  - [x] 7.2: Verificar que `main.tsx` não precisa de alteração — `<Providers><App /></Providers>` continua correto (RouterProvider está dentro de QueryClientProvider + AuthProvider ✅)

- [x] **Task 8 — Conectar SessionExpiredBanner à navegação** (AC: 4)
  - [x] 8.1: Atualizar `frontend/src/features/auth/components/SessionExpiredBanner.tsx`:
    - Mudar o `action` para sempre exibir o botão "Entrar" (não apenas quando `onLogin` está definido)
    - Quando `onLogin` não fornecido → `window.location.assign('/login')` como fallback
    - Forma canônica: `action={<Button color="inherit" size="small" onClick={onLogin ?? (() => window.location.assign('/login'))}>Entrar</Button>}`
  - [x] 8.2: Atualizar os testes de `SessionExpiredBanner.test.tsx` para refletir que o botão SEMPRE aparece (com `onLogin` ou com fallback)

- [x] **Task 9 — Testes** (AC: 1, 2, 3, 4)
  - [x] 9.1: Criar `frontend/src/app/router.test.tsx`:
    - `test_nao_autenticado_redireciona_para_login` — mock `useAuth` com `isAuthenticated: false`; renderizar com rota `/today`; verificar que a URL muda para `/login`
    - `test_autenticado_acessa_today` — mock `useAuth` com `isAuthenticated: true`; renderizar com rota `/today`; verificar que PlaceholderPage com título "Hoje" aparece
    - `test_login_bem_sucedido_navega_para_today` — renderizar `LoginPageRoute`; simular login com sucesso; verificar navigate chamado com `/today`
    - `test_ja_autenticado_em_login_redireciona_para_today` — `isAuthenticated: true`; acessar `/login`; verificar redirect para `/today`
  - [x] 9.2: Criar `frontend/src/app/layout/AppLayout.test.tsx`:
    - `test_desktop_mostra_sidebar` — mock `useMediaQuery` retornando `isDesktop: true`; verificar que `<nav aria-label="Navegação principal">` está presente
    - `test_mobile_mostra_bottom_nav` — mock `useMediaQuery` retornando `isMobile: true`; verificar que `<nav aria-label="Navegação mobile">` está presente, sidebar ausente
    - `test_atalho_colchete_faz_toggle_sidebar` — mock desktop; disparar `keydown` event com `key='['`; verificar que sidebar alterna estado collapsed
  - [x] 9.3: Criar `frontend/src/app/layout/Sidebar.test.tsx`:
    - `test_item_ativo_tem_estilo_de_destaque` — mock `useLocation` com pathname `/today`; verificar que item "Hoje" tem `borderLeft` de `primary.main`
    - `test_grupo_planner_expande_e_colapsa` — clicar no grupo Planner; verificar que subitens aparecem/desaparecem
    - `test_collapsed_oculta_textos` — prop `collapsed: true`; verificar que `ListItemText` não visível
  - [x] 9.4: Criar `frontend/src/app/layout/BottomNav.test.tsx`:
    - `test_quatro_abas_presentes` — verificar que as 4 abas estão renderizadas (Hoje, Planner, Hábitos, Saúde)
    - `test_fab_presente` — verificar que FAB com `aria-label` está presente
    - `test_aba_ativa_corresponde_a_rota_atual` — mock `useLocation` com `/habits`; verificar que aba "Hábitos" está ativa
  - [x] 9.5: `test_session_expired_banner_sempre_mostra_botao_entrar` — verificar que o botão "Entrar" sempre aparece mesmo sem `onLogin` prop

- [x] **Task 10 — Verificação final** (AC: 1, 2, 3, 4)
  - [x] 10.1: `cd frontend && npx vitest run` — todos os testes passando (incluindo todos os da Story 2.2 sem regressão)
  - [x] 10.2: `cd frontend && npx tsc --noEmit` — 0 erros de tipo
  - [x] 10.3: `cd frontend && npx eslint src/` — 0 erros de boundary (Sidebar/BottomNav/AppLayout estão em `app/layout/`, não em `features/`, portanto podem importar de `features/auth` via `useAuth` que está em `shared/hooks/`)

## Dev Notes

### ⚠️ Limites de Escopo (LEIA PRIMEIRO)

| Pertence a esta Story (2.3) | NÃO fazer agora — Story responsável |
|---|---|
| Router + rotas protegidas + PrivateRoute | `DailyPage` real com dados → **Story 3.2** |
| `AppLayout` (Sidebar + BottomNav) | Acessibilidade WCAG 2.2 AA auditada → **Story 2.4** |
| `PlaceholderPage` para todas as rotas | FAB com funcionalidade real (Capture Sheet) → **Story 5.3** |
| Atalho `[` para sidebar toggle | Badge do Brain Dump com contagem real → **Story 5.2** |
| LoginPage/SignupPage wired com navigate | Semântica HTML (`<nav>`, `<main>`) auditada → **Story 2.4** |
| SessionExpiredBanner com botão funcional | Acessibilidade WCAG (focus ring, tab order, aria-live) → **Story 2.4** |
| Placeholder FAB desabilitado | Zero mudanças no `backend/` |

**Princípio:** 100% frontend. Zero mudanças no `backend/`. Telas ainda não implementadas exibem placeholder honesto — nunca estado de erro ou tela em branco.

---

### Pacotes novos (instalação obrigatória antes de qualquer código)

```bash
cd frontend

# react-router-dom v6 — NÃO instalar v7 (tem breaking changes na API de data loading)
npm install react-router-dom

# @mui/icons-material — DEVE ser a mesma major que @mui/material (atualmente ^6.x)
npm install @mui/icons-material

# Verificar versões instaladas após
cat package.json | grep -E 'react-router|@mui/icons'
# Esperado: "react-router-dom": "^6.x.x" e "@mui/icons-material": "^6.x.x"
```

**Armadilha:** `@mui/icons-material@5.x` é incompatível com `@mui/material@6.x`. Verificar a major version.

---

### Estrutura do router e a ordem crítica dos providers

`RouterProvider` DEVE ficar DENTRO do `<Providers>` wrapper (que contém `QueryClientProvider` e `AuthProvider`). O `main.tsx` já faz isso corretamente:

```
<Providers>               ← QueryClient + AuthProvider + ThemeProvider
  <App>                   ← App.tsx retorna <RouterProvider router={router} />
    <RouterProvider>      ← renderiza routes
      <ProtectedLayout>   ← pode usar useAuth() ✅
        <AppLayout>       ← pode usar useNavigate() ✅
```

**NÃO** mover `RouterProvider` para fora de `<Providers>` — hooks como `useAuth()` e `useQuery()` quebrariam.

---

### ProtectedLayout — padrão canônico (NÃO reinventar)

```tsx
// Dentro de src/app/router.tsx
function ProtectedLayout() {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <AppLayout />
}
```

- `replace` é OBRIGATÓRIO — sem ele, o usuário pode voltar ao histórico e re-acessar a rota protegida com o botão Back, causando loop.
- `AppLayout` deve ter `<Outlet />` para renderizar a rota filha.

---

### LoginPageRoute — wiring de navegação pós-login

```tsx
// Dentro de src/app/router.tsx
function LoginPageRoute() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  // Já autenticado → ir direto para o app
  if (isAuthenticated) {
    return <Navigate to="/today" replace />
  }

  return <LoginPage onSuccess={() => navigate('/today', { replace: true })} />
}
```

- Mesma lógica para `SignupPageRoute` com `<SignupPage onSuccess={() => navigate('/today', { replace: true })} />`

---

### SessionExpiredBanner — o botão DEVE aparecer sem onLogin

Da Story 2.2, o banner foi criado com `action={onLogin && <Button ...>}` — o botão SÓ aparecia se `onLogin` fosse passado. `AuthProvider` não passa `onLogin` porque está fora do router.

**Correção em Story 2.3:**

```tsx
// frontend/src/features/auth/components/SessionExpiredBanner.tsx (atualizar)
export function SessionExpiredBanner({ onLogin }: SessionExpiredBannerProps) {
  const handleLogin = onLogin ?? (() => window.location.assign('/login'))

  return (
    <Alert
      severity="warning"
      sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}
      action={
        <Button color="inherit" size="small" onClick={handleLogin}>
          Entrar
        </Button>
      }
    >
      Sessão expirada. Entre novamente.
    </Alert>
  )
}
```

`window.location.assign('/login')` é uma hard redirect — aceitável aqui porque o usuário está intencionalmente navegando para login. Sem dependência de `useNavigate` → funciona de qualquer ponto da árvore de componentes, inclusive dentro do `AuthProvider`.

---

### Sidebar — item ativo com estilo de destaque correto

```tsx
// Dentro de Sidebar.tsx
import { alpha } from '@mui/material/styles'
import { useLocation, useNavigate } from 'react-router-dom'

// Para cada item de navegação:
const isActive = location.pathname === item.path
// Ou para sub-rotas (ex.: /planner/*):
const isActive = location.pathname.startsWith(item.path)

// Estilo do ListItemButton:
<ListItemButton
  onClick={() => navigate(item.path)}
  sx={{
    borderLeft: '3px solid',
    borderColor: isActive ? 'primary.main' : 'transparent',
    bgcolor: isActive
      ? (theme) => alpha(theme.palette.primary.main, 0.10)
      : 'transparent',
    '&:hover': {
      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
    },
    // Quando collapsed: centralizar ícone
    justifyContent: collapsed ? 'center' : 'flex-start',
    px: collapsed ? 0 : 2,
  }}
>
  <ListItemIcon sx={{ minWidth: collapsed ? 0 : 40, justifyContent: 'center' }}>
    {item.icon}
  </ListItemIcon>
  {!collapsed && (
    <ListItemText primary={item.label} primaryTypographyProps={{ variant: 'body' }} />
  )}
</ListItemButton>
```

**`alpha` deve ser importado de `@mui/material/styles`** (não de `@mui/system`). Ambos funcionam mas `@mui/material/styles` é o caminho canônico para projetos MUI.

---

### Grupos colapsáveis (Planner e Saúde)

```tsx
// Estado local — NÃO usar TanStack Query, é UI state puro
const [plannerOpen, setPlannerOpen] = useState(true)
const [healthOpen, setHealthOpen] = useState(true)

// Quando sidebar colapsa, fechar grupos para evitar overflow
useEffect(() => {
  if (collapsed) {
    setPlannerOpen(false)
    setHealthOpen(false)
  }
}, [collapsed])

// Group header
<ListItemButton onClick={() => !collapsed && setPlannerOpen(p => !p)}>
  <ListItemIcon><EventNoteIcon /></ListItemIcon>
  {!collapsed && (
    <>
      <ListItemText primary="Planner" />
      {plannerOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
    </>
  )}
</ListItemButton>
<Collapse in={plannerOpen && !collapsed} timeout="auto" unmountOnExit>
  {/* subitems: Esta Semana, Este Mês, Futuro */}
</Collapse>
```

---

### BottomNav — safe-area e posicionamento do FAB

```tsx
// BottomNav.tsx
<Paper
  component="nav"
  aria-label="Navegação mobile"
  sx={{
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 'appBar',  // ou theme.zIndex.appBar
  }}
  elevation={0}
>
  <BottomNavigation
    value={currentTab}
    onChange={(_, newValue) => navigate(tabPaths[newValue])}
    sx={{ pb: 'env(safe-area-inset-bottom, 0px)' }}
  >
    <BottomNavigationAction label="Hoje" icon={<TodayIcon />} />
    <BottomNavigationAction label="Planner" icon={<EventNoteIcon />} />
    <BottomNavigationAction label="Hábitos" icon={<RepeatIcon />} />
    <BottomNavigationAction label="Saúde" icon={<FavoriteOutlineIcon />} />
  </BottomNavigation>
</Paper>

{/* FAB placeholder — funcionalidade real na Story 5.3 */}
<Fab
  aria-label="Captura rápida (em breve)"
  disabled
  sx={{
    position: 'fixed',
    bottom: `calc(56px + env(safe-area-inset-bottom, 0px) + 16px)`,
    right: 16,
    width: 52,
    height: 52,
    bgcolor: 'text.primary',
    color: 'background.default',
    '&.Mui-disabled': {
      bgcolor: 'text.disabled',
    },
  }}
>
  <AddIcon />
</Fab>
```

**Nota:** `bottom: 'calc(56px + env(safe-area-inset-bottom, 0px) + 16px)'` garante que o FAB fica acima da bottom-nav, mesmo em iPhones com notch.

---

### Atalho de teclado `[` — padrão de implementação

```tsx
// AppLayout.tsx — dentro do componente
useEffect(() => {
  if (!isDesktop) return  // shortcut only on desktop

  const handleKeyDown = (event: KeyboardEvent) => {
    // Não disparar quando o foco está em input/textarea
    const target = event.target as HTMLElement
    const isEditable = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
    if (isEditable) return

    if (event.key === '[') {
      setSidebarCollapsed(prev => !prev)
    }
  }

  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [isDesktop])
```

**Não esquecer o cleanup** (`return () => removeEventListener(...)`) — sem ele, cada re-render do componente acumula listeners.

---

### Sem scroll horizontal — como garantir

Cada rota protegida renderiza `<PlaceholderPage />` que usa `<Box component="main">` sem overflow. O `AppLayout` NUNCA deve ter `overflow-x: scroll` ou `width: max-content`. Regras:
- Container `main` no desktop: `sx={{ flexGrow: 1, minWidth: 0 }}` — o `minWidth: 0` impede que o flex item expanda além do container.
- Container `main` no mobile: width automático (100vw), sem padding horizontal fixo que exceda a viewport.

---

### Estrutura de arquivos ao fim da story

```
frontend/src/
├── App.tsx                               ALTERAR — RouterProvider ao invés de placeholder
├── app/
│   ├── router.tsx                        NOVO — createBrowserRouter, ProtectedLayout, LoginPageRoute, SignupPageRoute
│   └── layout/
│       ├── AppLayout.tsx                 NOVO — layout responsivo, atalho [
│       ├── AppLayout.test.tsx            NOVO
│       ├── Sidebar.tsx                   NOVO — sidebar desktop, grupos colapsáveis, atalho [ state
│       ├── Sidebar.test.tsx              NOVO
│       ├── BottomNav.tsx                 NOVO — 4 abas + FAB placeholder
│       └── BottomNav.test.tsx            NOVO
├── pages/
│   └── PlaceholderPage.tsx               NOVO — placeholder honesto para rotas não implementadas
├── features/
│   └── auth/
│       └── components/
│           ├── SessionExpiredBanner.tsx  ALTERAR — botão "Entrar" sempre visível (fallback window.location)
│           └── SessionExpiredBanner.test.tsx  ALTERAR — atualizar teste do botão
```

**Não criar:**
- `src/pages/today/TodayPage.tsx` e demais pages individuais — `PlaceholderPage` é usado inline no router
- Nenhum arquivo em `backend/`
- Nenhuma query TanStack Query nesta story — toda navegação é estado local/router

---

### ⚠️ Armadilhas críticas (LEIA ANTES DE IMPLEMENTAR)

#### 1. react-router-dom v7 tem breaking changes — usar v6.x
v7 introduziu mudanças na API de data loading e na forma de configurar rotas. O `createBrowserRouter` básico funciona igual, mas para evitar surpresas use v6. Verificar `package.json` após `npm install`.

#### 2. RouterProvider precisa ficar DENTRO dos Providers
`useAuth()` (que usa `AuthContext`) e `useQuery()` só funcionam dentro de `QueryClientProvider` + `AuthProvider`. Se `RouterProvider` estiver fora, os hooks quebram silenciosamente (sem erro no TypeScript, mas comportamento incorreto em runtime).

#### 3. `replace: true` no Navigate de auth é obrigatório
Sem `replace`, o botão Back do browser leva o usuário de volta à rota protegida, que faz redirect de volta ao login — criando um loop no histórico de navegação.

#### 4. `minWidth: 0` no container main do flex layout
Em flex containers, itens têm `min-width: auto` por padrão, o que permite que expandam além do container. O `minWidth: 0` no `Box component="main"` impede que conteúdo grande cause overflow horizontal.

#### 5. `env(safe-area-inset-bottom)` não funciona sem a meta tag viewport
Verificar que `frontend/index.html` tem `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`. Sem `viewport-fit=cover`, a `env()` CSS function retorna 0 e o FAB pode ficar atrás da barra do sistema em iPhones.

#### 6. FAB desabilitado em Story 2.3 — sem lógica real de captura
O FAB DEVE estar `disabled` ou sem `onClick` nesta story. A funcionalidade real (Capture Sheet, Brain Dump) é da Story 5.3. Adicionar lógica parcial agora criaria estado inconsistente.

#### 7. Badge do Brain Dump — NÃO implementar
Story 5.2 é responsável pelo badge. Deixar o item "Brain Dump" na sidebar sem badge. A query key `keys.brainDump.count(userId)` existe em `keys.ts` mas NÃO deve ser usada nesta story.

#### 8. Grupos colapsáveis fecham quando sidebar colapsa
Quando `collapsed` muda de `false` para `true`, os grupos Planner e Saúde DEVEM fechar automaticamente (via `useEffect`). Sem isso, quando o usuário re-expande a sidebar, os grupos aparecem abertos no estado colapsado (overflow de conteúdo).

#### 9. Atalho `[` não deve disparar em inputs
Verificar `event.target` antes de fazer toggle — se o foco está em `INPUT`, `TEXTAREA` ou `contentEditable`, ignorar o atalho.

---

### Inteligência da Story anterior (2.2 — done)

- **73 testes passando** — não quebrar nenhum deles
- **`LoginPage` já tem `onSuccess?: () => void` prop** — só passar `() => navigate('/today')` nesta story
- **`SignupPage` já tem `onSuccess?: () => void` prop** — mesmo padrão
- **`SessionExpiredBanner` tem `onLogin?: () => void` prop** — mas o botão SÓ aparecia com prop (corrigir nesta story)
- **`AuthProvider` renderiza `{sessionExpired && <SessionExpiredBanner />}`** sem `onLogin` — ok após correção acima
- **`useAuth()` está em `shared/hooks/useAuth.ts`** — acessível de `app/layout/` sem violar boundaries
- **`AuthContext` exportado de `app/providers/AuthContext.ts`** (separado do Provider para react-refresh)
- **Providers stack:** `ColorModeContext → QueryClientProvider → AuthProvider → ThemeProvider`

### Git Intelligence

- Branch `main`, último commit `82aad37` ("feat(story-2.2): Sessão persistente, refresh single-flight e estados de auth no frontend")
- `frontend/src/App.tsx` tem apenas scaffold placeholder (7 linhas) — substituir completamente
- Sem `src/app/router.tsx` nem `src/app/layout/` — criar do zero
- Sem `src/pages/` — criar do zero
- `frontend/eslint.config.js` já tem regra `no-restricted-imports` com regex precisa (aplicada no fix de Story 2.2) — `app/layout/` pode importar de `shared/hooks/` sem problema
- Convenção de commit: `feat(story-2.3): Casca de navegação autenticada, sidebar, bottom-nav e roteamento`

### Testes obrigatórios

#### `frontend/src/app/router.test.tsx`

- `test_nao_autenticado_redireciona_para_login` — mock `isAuthenticated: false`; acessar `/today`; verificar que pathname muda para `/login`
- `test_autenticado_acessa_today` — mock `isAuthenticated: true`; acessar `/today`; verificar que "Hoje" está no documento
- `test_login_bem_sucedido_navega_para_today` — chamar `onSuccess`; verificar navegação para `/today`
- `test_autenticado_em_login_redireciona_para_today` — `isAuthenticated: true`; acessar `/login`; verificar redirect para `/today`

#### `frontend/src/app/layout/AppLayout.test.tsx`

- `test_desktop_mostra_sidebar_oculta_bottom_nav`
- `test_mobile_mostra_bottom_nav_oculta_sidebar`
- `test_atalho_colchete_faz_toggle_sidebar_no_desktop`
- `test_atalho_colchete_ignorado_em_input`

#### `frontend/src/app/layout/Sidebar.test.tsx`

- `test_item_ativo_tem_borda_primary`
- `test_item_inativo_sem_borda`
- `test_grupo_planner_expande_ao_clicar`
- `test_collapsed_oculta_textos_de_labels`
- `test_grupos_fecham_quando_sidebar_colapsa`

#### `frontend/src/app/layout/BottomNav.test.tsx`

- `test_quatro_abas_presentes`
- `test_fab_presente_e_desabilitado`
- `test_aba_ativa_por_rota`
- `test_navegacao_ao_clicar_aba`

#### `frontend/src/features/auth/components/SessionExpiredBanner.test.tsx` (atualizar)

- `test_botao_entrar_aparece_sem_onLogin_prop` — verificar que botão "Entrar" está presente mesmo sem prop
- `test_botao_entrar_chama_onLogin_quando_fornecido`
- `test_botao_entrar_usa_window_location_quando_sem_onLogin`

### Project Structure Notes

- `app/layout/` contém componentes de infra da casca — não são `features/`; é `app/` (composição com dono, conforme `architecture.md §7.1`)
- `pages/PlaceholderPage.tsx` vive em `pages/` pois é uma página reutilizável — mas não será substituída por `pages/daily/DailyPage.tsx` (Story 3.2); será mantida para rotas não implementadas
- `useAuth` de `shared/hooks/` — acessível de `app/layout/` sem violar ESLint boundary (shared/ é para qualquer camada)
- `react-router-dom` não é uma `feature` — é infra de roteamento; `app/router.tsx` e `app/layout/` podem importar de react-router-dom diretamente
- `@mui/icons-material` são componentes MUI — não violam boundaries

### References

- [Source: epics.md#Story-2.3] — user story e ACs originais; mapa de superfícies UX-DR17
- [Source: epics.md#Epic-2 intro] — casca navegável: sidebar, bottom-nav, roteamento autenticado, estados de auth
- [Source: architecture.md UX-DR7] — sidebar fixa 240px / colapsada 56px; grupos colapsáveis; item ativo borda 3px + bg 10%; badge Brain Dump; toggle `[`
- [Source: architecture.md UX-DR8] — bottom-nav 4 abas + FAB; sem drawer/hambúrguer; acima safe-area; Gratidão sem aba
- [Source: architecture.md UX-DR17] — IA: mapa completo de superfícies e rotas; modal max 1 nível; Migração nunca navegada diretamente
- [Source: architecture.md AR-12] — `app/layout/AppLayout` com app bar, bottom-nav, FAB
- [Source: architecture.md §7.1] — `app/router.tsx`, `app/layout/`, `pages/daily/`; `features/<x>` isoladas
- [Source: architecture.md §7.2] — fronteira ESLint: features não se importam; `app/` e `pages/` compõem múltiplas features
- [Source: architecture.md NFR-1] — mobile real: 100% das ações sem scroll horizontal
- [Source: _bmad-output/implementation-artifacts/2-2-sessao-persistente-refresh-single-flight-e-estados-de-auth-no-frontend.md] — File List, Completion Notes, armadilhas resolvidas; LoginPage + SignupPage com `onSuccess` prop; SessionExpiredBanner com `onLogin` prop
- [Source: frontend/src/theme.ts] — `brandPrimary: '#2BADA0'` mapeado para `palette.primary.main`; `colors.fabBg` para FAB
- [Source: frontend/src/app/providers/index.tsx] — stack de providers; ordem: QueryClient → AuthProvider → ThemeProvider
- [Source: frontend/src/features/auth/index.ts] — exports do barrel: LoginPage, SignupPage, SessionExpiredBanner, useAuth, tipos

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

Nenhum bloqueio crítico. Armadilhas contornadas durante implementação:
- `react-router-dom` v7 foi instalado inicialmente; downgrade para v6.30.4 feito explicitamente.
- `@mui/icons-material` v9 incompatível com `@mui/material` v6; instalado `^6.5.0` especificamente.
- Router tests: `getByText('Hoje')` falhava com múltiplos matches (sidebar + heading); corrigido para `getByRole('heading', { name: 'Hoje' })`.
- `BottomNavigationAction` active state: não usa `aria-selected`; usa classe CSS `Mui-selected`.
- `router.tsx` acionava regra ESLint `react-refresh/only-export-components`; adicionado `eslint-disable` pois o arquivo mistura componentes internos com exports de configuração (padrão válido para router).

### Completion Notes List

Implementação completa da Story 2.3:
- `react-router-dom@^6.30.4` + `@mui/icons-material@^6.5.0` instalados (versões compatíveis com MUI v6).
- `PlaceholderPage` criado com `aria-label` e texto "Em desenvolvimento." para todas as rotas não implementadas.
- `router.tsx` com `createBrowserRouter`, `ProtectedLayout` (redirect sem flash), `LoginPageRoute`/`SignupPageRoute` (redirect se já autenticado), 11 rotas protegidas + 2 públicas + catchall. `routeDefinitions` exportado para reúso em testes com `createMemoryRouter`.
- `Sidebar.tsx` (240px/56px): grupos colapsáveis Planner + Saúde com `Collapse`, item ativo via `aria-current` + `borderLeft 3px primary.main + alpha(10%)`, atalho `[` gerenciado pelo AppLayout, todos os ícones corretos do `@mui/icons-material`.
- `BottomNav.tsx`: 4 abas fixas (Hoje/Planner/Hábitos/Saúde), FAB disabled com `aria-label`, safe-area-inset-bottom via CSS `env()`, `<nav aria-label="Navegação mobile">`.
- `AppLayout.tsx`: responsivo com `useMediaQuery`, tablet inicia colapsado, atalho `[` apenas no desktop sem disparar em inputs, `minWidth: 0` no flex main para evitar overflow.
- `App.tsx` substituído por `<RouterProvider router={router} />`. `main.tsx` sem alterações.
- `SessionExpiredBanner.tsx` atualizado: botão "Entrar" sempre visível, fallback `window.location.assign('/login')` quando `onLogin` não fornecido.
- `frontend/index.html` atualizado: `viewport-fit=cover` adicionado para suporte correto a `env(safe-area-inset-bottom)` em iPhones.
- 99 testes passando (suíte completa, sem regressões). TypeScript: 0 erros. ESLint: 0 erros.

### Senior Developer Review (AI) — Correções aplicadas (auto-fix)

Revisão adversarial encontrou e corrigiu automaticamente:
- **[Bug] `BottomNav.getCurrentTab`** retornava `0` (aba "Hoje") como fallback para qualquer rota sem aba correspondente (ex.: `/settings`, `/gratitude`, `/brain-dump`, `/archive`), destacando "Hoje" incorretamente quando o usuário estava em outra superfície no mobile. Corrigido para retornar `-1` (nenhuma aba selecionada) nesses casos; teste `test_rota_sem_aba_correspondente_nao_destaca_nenhuma_aba` adicionado em `BottomNav.test.tsx`.
- **[Qualidade de teste] `router.test.tsx` → `test_login_bem_sucedido_navega_para_today`** não exercitava o fluxo real (apenas renderizava `/login` deslogado). Reescrito como teste de integração completo: mock de `loginApi` resolvendo com sucesso, preenchimento do formulário, submit, e verificação de que a navegação para `/today` ocorre de fato.
- **[Documentação] Contagem de testes incorreta** no Completion Notes (90 ao invés do total real, 98 antes do fix / 99 após). Corrigido.
- Limpeza menor: import duplicado de `react-router-dom` consolidado em `router.tsx`.

Suite final: 99 testes passando, `tsc --noEmit` 0 erros, `eslint src/` 0 erros.

### File List

- `frontend/index.html` — ALTERADO (viewport-fit=cover)
- `frontend/package.json` — ALTERADO (react-router-dom, @mui/icons-material adicionados)
- `frontend/package-lock.json` — ALTERADO (lock file atualizado)
- `frontend/src/App.tsx` — ALTERADO (RouterProvider ao invés de placeholder)
- `frontend/src/app/router.tsx` — NOVO
- `frontend/src/app/layout/AppLayout.tsx` — NOVO
- `frontend/src/app/layout/AppLayout.test.tsx` — NOVO
- `frontend/src/app/layout/Sidebar.tsx` — NOVO
- `frontend/src/app/layout/Sidebar.test.tsx` — NOVO
- `frontend/src/app/layout/BottomNav.tsx` — NOVO
- `frontend/src/app/layout/BottomNav.test.tsx` — NOVO
- `frontend/src/pages/PlaceholderPage.tsx` — NOVO
- `frontend/src/features/auth/components/SessionExpiredBanner.tsx` — ALTERADO
- `frontend/src/features/auth/components/SessionExpiredBanner.test.tsx` — ALTERADO

## Change Log

| Data | Mudança |
|---|---|
| 2026-06-29 | Implementação completa da Story 2.3: router, Sidebar, BottomNav, AppLayout, PlaceholderPage, SessionExpiredBanner atualizado. 90 testes passando, TypeScript e ESLint sem erros. |
| 2026-06-30 | Revisão adversarial (AI): corrigido bug de aba ativa incorreta no `BottomNav` para rotas sem aba correspondente; reescrito teste fake de login→navegação em `router.test.tsx`; corrigida contagem de testes no Completion Notes. 99 testes passando. |
