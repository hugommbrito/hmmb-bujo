/* eslint-disable react-refresh/only-export-components */
import { createBrowserRouter, Navigate, useNavigate } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import { LoginPage } from '../features/auth/components/LoginPage'
import { SignupPage } from '../features/auth/components/SignupPage'
import { useAuth } from '../shared/hooks/useAuth'
import { AppLayout } from './layout/AppLayout'
import { PlaceholderPage } from '../pages/PlaceholderPage'

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
      { path: 'today', element: <PlaceholderPage title="Hoje" /> },
      { path: 'planner/week', element: <PlaceholderPage title="Esta Semana" /> },
      { path: 'planner/month', element: <PlaceholderPage title="Este Mês" /> },
      { path: 'planner/future', element: <PlaceholderPage title="Futuro" /> },
      { path: 'habits', element: <PlaceholderPage title="Hábitos" /> },
      { path: 'health/metrics', element: <PlaceholderPage title="Métricas de Saúde" /> },
      { path: 'health/medications', element: <PlaceholderPage title="Medicamentos" /> },
      { path: 'gratitude', element: <PlaceholderPage title="Diário de Gratidão" /> },
      { path: 'brain-dump', element: <PlaceholderPage title="Brain Dump" /> },
      { path: 'archive', element: <PlaceholderPage title="Arquivo" /> },
      { path: 'settings', element: <PlaceholderPage title="Configurações" /> },
      { path: '*', element: <Navigate to="/today" replace /> },
    ],
  },
]

export const router = createBrowserRouter(routeDefinitions)
