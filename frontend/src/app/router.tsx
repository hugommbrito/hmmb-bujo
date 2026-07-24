/* eslint-disable react-refresh/only-export-components */
import { Suspense } from 'react'
import { createBrowserRouter, Navigate, useMatches, useNavigate } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import { LoginPage } from '../features/auth/components/LoginPage'
import { SignupPage } from '../features/auth/components/SignupPage'
import { useAuth } from '../shared/hooks/useAuth'
import { AppLayout } from './layout/AppLayout'
import { ShellLayout } from './layout/shell/ShellLayout'
import { resolveShellRoute } from './layout/shell/shellRouting'
import { collections } from './collections/registry'
import { DailyPage } from '../pages/daily/DailyPage'
import { WeeklyPage } from '../pages/planner/WeeklyPage'
import { MonthlyPage } from '../pages/planner/MonthlyPage'
import { FuturePage } from '../pages/planner/FuturePage'
import { RecurringPage } from '../pages/planner/RecurringPage'
import { ArchivePage } from '../pages/archive/ArchivePage'
import { BrainDumpPage } from '../pages/braindump/BrainDumpPage'
import { SettingsPage } from '../pages/settings/SettingsPage'
import { HabitsSettingsPage } from '../pages/settings/HabitsSettingsPage'
import { HealthMetricsSettingsPage } from '../pages/settings/HealthMetricsSettingsPage'
import { MedicationsSettingsPage } from '../pages/settings/MedicationsSettingsPage'

function LoginPageRoute() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  if (isAuthenticated) {
    return <Navigate to="/today" replace />
  }

  return <LoginPage onSuccess={() => navigate('/today', { replace: true })} />
}

function SignupPageRoute() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  if (isAuthenticated) {
    return <Navigate to="/today" replace />
  }

  return <SignupPage onSuccess={() => navigate('/today', { replace: true })} />
}

// Coexistência por rota (Story 13.1): o registro puro `shellRouting.ts` decide,
// rota a rota, qual casca monta — o shell novo ou o `AppLayout` legado, que
// permanece intocado como rota de rollback. O match ativo vem de `useMatches()`,
// o MESMO mecanismo do `RouteAnnouncer`. Rollback de uma superfície = trocar
// `shell: 'new'` por `'legacy'` naquela entrada (uma linha) — procedimento em
// `13-shell-parity-checklist.md`, seção "Rollback por superfície".
function ProtectedLayout() {
  const { isAuthenticated } = useAuth()
  const matches = useMatches()
  const activePathname = matches[matches.length - 1]?.pathname ?? '/'
  const shellRoute = resolveShellRoute(activePathname)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (shellRoute.shell === 'legacy') {
    return <AppLayout />
  }

  return <ShellLayout surfaceMigrated={shellRoute.surfaceMigrated} />
}

// Rotas de collection derivadas do registro por map puro (Story 12.3). Cada
// elemento lazy é embrulhado num <Suspense fallback={null}> — nada é pintado
// durante o microtask de load, preservando o pixel-idêntico. As rotas de NÚCLEO
// permanecem eager e hardcoded abaixo (Suspense em `/today` quebraria os testes
// síncronos de chrome — ver Risco crítico nas Dev Notes da story).
const collectionRoutes: RouteObject[] = collections.flatMap((collection) =>
  collection.routes.map((route) => {
    const RouteComponent = route.component
    return {
      path: route.path,
      element: (
        <Suspense fallback={null}>
          <RouteComponent />
        </Suspense>
      ),
      handle: { title: route.title },
    }
  }),
)

export const routeDefinitions: RouteObject[] = [
  {
    path: '/login',
    element: <LoginPageRoute />,
  },
  {
    path: '/signup',
    element: <SignupPageRoute />,
  },
  {
    path: '/',
    element: <ProtectedLayout />,
    children: [
      { index: true, element: <Navigate to="/today" replace /> },
      { path: 'today', element: <DailyPage />, handle: { title: 'Hoje' } },
      { path: 'daily/:date', element: <DailyPage />, handle: { title: 'Daily Log' } },
      {
        path: 'planner/week',
        element: <WeeklyPage />,
        handle: { title: 'Esta Semana' },
      },
      {
        path: 'planner/month',
        element: <MonthlyPage />,
        handle: { title: 'Este Mês' },
      },
      {
        path: 'planner/future',
        element: <FuturePage />,
        handle: { title: 'Futuro' },
      },
      {
        path: 'planner/recurring',
        element: <RecurringPage />,
        handle: { title: 'Recorrentes' },
      },
      // Rotas de collection (Hábitos, Saúde-Métricas, Medicamentos, Gratidão)
      // derivadas do registro — ver `collectionRoutes` acima. Ordem/paths/títulos
      // idênticos aos hardcoded que substituíram.
      ...collectionRoutes,
      { path: 'brain-dump', element: <BrainDumpPage />, handle: { title: 'Brain Dump' } },
      { path: 'archive', element: <ArchivePage />, handle: { title: 'Arquivo' } },
      {
        path: 'archive/weekly/:weekStart',
        element: <WeeklyPage />,
        handle: { title: 'Arquivo — Semana' },
      },
      {
        path: 'archive/monthly/:monthFirst',
        element: <MonthlyPage />,
        handle: { title: 'Arquivo — Mês' },
      },
      {
        path: 'settings',
        element: <SettingsPage />,
        handle: { title: 'Configurações' },
      },
      {
        path: 'settings/habits',
        element: <HabitsSettingsPage />,
        handle: { title: 'Configurações — Hábitos' },
      },
      {
        path: 'settings/health-metrics',
        element: <HealthMetricsSettingsPage />,
        handle: { title: 'Configurações — Métricas de Saúde' },
      },
      {
        path: 'settings/medications',
        element: <MedicationsSettingsPage />,
        handle: { title: 'Configurações — Medicamentos' },
      },
      { path: '*', element: <Navigate to="/today" replace /> },
    ],
  },
]

export const router = createBrowserRouter(routeDefinitions)
