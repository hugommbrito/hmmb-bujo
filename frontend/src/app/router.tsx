/* eslint-disable react-refresh/only-export-components */
import { createBrowserRouter, Navigate, useNavigate } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import { LoginPage } from '../features/auth/components/LoginPage'
import { SignupPage } from '../features/auth/components/SignupPage'
import { useAuth } from '../shared/hooks/useAuth'
import { AppLayout } from './layout/AppLayout'
import { PlaceholderPage } from '../pages/PlaceholderPage'
import { DailyPage } from '../pages/daily/DailyPage'
import { WeeklyPage } from '../pages/planner/WeeklyPage'
import { MonthlyPage } from '../pages/planner/MonthlyPage'
import { FuturePage } from '../pages/planner/FuturePage'
import { RecurringPage } from '../pages/planner/RecurringPage'
import { ArchivePage } from '../pages/archive/ArchivePage'

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

function ProtectedLayout() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <AppLayout />
}

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
      { path: 'habits', element: <PlaceholderPage title="Hábitos" />, handle: { title: 'Hábitos' } },
      {
        path: 'health/metrics',
        element: <PlaceholderPage title="Métricas de Saúde" />,
        handle: { title: 'Métricas de Saúde' },
      },
      {
        path: 'health/medications',
        element: <PlaceholderPage title="Medicamentos" />,
        handle: { title: 'Medicamentos' },
      },
      {
        path: 'gratitude',
        element: <PlaceholderPage title="Diário de Gratidão" />,
        handle: { title: 'Diário de Gratidão' },
      },
      {
        path: 'brain-dump',
        element: <PlaceholderPage title="Brain Dump" />,
        handle: { title: 'Brain Dump' },
      },
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
        element: <PlaceholderPage title="Configurações" />,
        handle: { title: 'Configurações' },
      },
      { path: '*', element: <Navigate to="/today" replace /> },
    ],
  },
]

export const router = createBrowserRouter(routeDefinitions)
