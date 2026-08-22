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
import { MigrationRitualPage } from '../pages/MigrationRitualPage'
import { WeeklyBoardPage } from '../pages/planner/WeeklyBoardPage'
import { WeeklyPlanningPage } from '../pages/planner/WeeklyPlanningPage'
import { MonthlyBoardPage } from '../pages/planner/MonthlyBoardPage'
import { MonthlyPlanningPage } from '../pages/planner/MonthlyPlanningPage'
import { FutureBoardPage } from '../pages/planner/FutureBoardPage'
import { RecurringLibraryPage } from '../pages/planner/RecurringLibraryPage'
import { ArchivePage } from '../pages/archive/ArchivePage'
import { ArchiveWeeklyDetailPage } from '../pages/archive/ArchiveWeeklyDetailPage'
import { ArchiveMonthlyDetailPage } from '../pages/archive/ArchiveMonthlyDetailPage'
import { BrainDumpInboxPage } from '../pages/braindump/BrainDumpInboxPage'
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
        // Story 14.9 (M10): ritual de migração/catch-up ROTEADO dentro do
        // shell (não `Dialog`, não overlay full-screen — decisão fechada do
        // mockup `key-migracao.html`). Irmã de `today`/`archive`/`settings`,
        // não filha de `planner/*` (a migração não pertence a nenhum dos
        // quatro logs — é o ritual que une os três níveis mês/semana/dia).
        path: 'migration',
        element: <MigrationRitualPage />,
        handle: { title: 'Migração' },
      },
      {
        // Story 14.5: `planner/week` passa a montar o Weekly Board do sistema
        // novo. `WeeklyPage` legada (que servia `archive/weekly/:weekStart`)
        // foi excluída na Story 14.10 — a rota de Arquivo agora monta
        // `ArchiveWeeklyDetailPage`.
        path: 'planner/week',
        element: <WeeklyBoardPage />,
        handle: { title: 'Esta Semana' },
      },
      {
        // Segmentos diferentes de `planner/week` ⇒ precisa de entrada própria
        // em `shellRouting.ts` (matchesPattern exige igualdade de contagem de
        // segmentos). A sidebar continua marcando "Esta Semana" como ativa
        // (isDestinationActive é por prefixo) — correto, não regressão.
        path: 'planner/week/planning',
        element: <WeeklyPlanningPage />,
        handle: { title: 'Planejar a semana' },
      },
      {
        // Story 14.6: `planner/month` passa a montar o Monthly Board do
        // sistema novo (mesmo padrão da 14.5). `MonthlyPage` legada (que
        // servia `archive/monthly/:monthFirst`) foi excluída na Story 14.10.
        path: 'planner/month',
        element: <MonthlyBoardPage />,
        handle: { title: 'Este Mês' },
      },
      {
        path: 'planner/month/planning',
        element: <MonthlyPlanningPage />,
        handle: { title: 'Planejar o mês' },
      },
      {
        // Story 14.7: `planner/future` passa a montar o Future Log do sistema
        // novo (M08). `FuturePage` legada permanece no repositório, apenas
        // DESMONTADA da rota — a remoção do legado é o Épico 18, junto com
        // `TaskRow.tsx` e as demais páginas legadas (AC9).
        path: 'planner/future',
        element: <FutureBoardPage />,
        handle: { title: 'Futuro' },
      },
      {
        // Story 14.8: `planner/recurring` passa a montar a biblioteca do
        // sistema novo (M09). `RecurringPage` legada (e o
        // `RecurringTemplateManager` que ela monta) permanecem no repositório,
        // apenas DESMONTADAS da rota — a remoção do legado é o Épico 18, junto
        // com `FuturePage.tsx` e `TaskRow.tsx` (AC9). O rollback por superfície
        // continua sendo UMA LINHA: trocar o `element` de volta.
        path: 'planner/recurring',
        element: <RecurringLibraryPage />,
        handle: { title: 'Recorrentes' },
      },
      // Rotas de collection (Hábitos, Saúde-Métricas, Medicamentos, Gratidão)
      // derivadas do registro — ver `collectionRoutes` acima. Ordem/paths/títulos
      // idênticos aos hardcoded que substituíram.
      ...collectionRoutes,
      {
        // Story 15.1 (M11): `planner/brain-dump` passa a montar o Inbox do
        // sistema novo. `BrainDumpPage` legada (e `BrainDumpItemRow.tsx`/
        // `ProcessItemDialog.tsx`) permanecem no repositório, apenas
        // DESMONTADAS da rota — a remoção do legado é o Épico 18 (mesmo
        // padrão de `FutureBoardPage`/`RecurringLibraryPage`).
        path: 'brain-dump',
        element: <BrainDumpInboxPage />,
        handle: { title: 'Brain Dump' },
      },
      { path: 'archive', element: <ArchivePage />, handle: { title: 'Arquivo' } },
      {
        // Story 14.10: `WeeklyPage`/`MonthlyPage` legadas foram excluídas —
        // as duas rotas de detalhe do Arquivo agora montam os componentes
        // novos, readonly/mutável derivado do estado REAL do período.
        path: 'archive/weekly/:weekStart',
        element: <ArchiveWeeklyDetailPage />,
        handle: { title: 'Arquivo — Semana' },
      },
      {
        path: 'archive/monthly/:monthFirst',
        element: <ArchiveMonthlyDetailPage />,
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
