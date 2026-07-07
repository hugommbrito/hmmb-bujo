import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '@mui/material'
import { createBujoTheme } from '../theme'

vi.mock('../shared/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../features/auth/api', () => ({
  loginApi: vi.fn(),
}))

// DailyPage (rota /today desde a Story 3.2) depende de TanStack Query — estes
// testes cobrem proteção de rota/navegação, não o conteúdo do Daily Log.
vi.mock('../features/bujo', () => ({
  useTodayLogQuery: () => ({
    isPending: false,
    data: { id: 'log-1', logDate: '2026-01-01', tasks: [] },
  }),
  useTransitionTaskMutation: () => ({ mutate: vi.fn() }),
  useCreateTaskMutation: () => ({ mutate: vi.fn() }),
}))

// TaskDetailPanel usa mutações do TanStack Query (`../api`) diretamente, fora
// deste mock — sem um QueryClientProvider na árvore, mocamos o componente.
vi.mock('../features/bujo/components/TaskDetailPanel', () => ({
  TaskDetailPanel: () => null,
}))

// Mock useMediaQuery to avoid jsdom matchMedia issues
vi.mock('@mui/material', async (importOriginal) => {
  const original = await importOriginal<typeof import('@mui/material')>()
  return { ...original, useMediaQuery: vi.fn().mockReturnValue(false) }
})

import { useAuth } from '../shared/hooks/useAuth'
import { loginApi } from '../features/auth/api'
import { routeDefinitions } from './router'

const mockAuthBase = { sessionExpired: false, login: vi.fn(), logout: vi.fn() }

function renderRouter(initialEntry: string) {
  const router = createMemoryRouter(routeDefinitions, { initialEntries: [initialEntry] })
  render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
  return router
}

describe('Router — proteção de rotas', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('test_autenticado_em_signup_redireciona_para_today', () => {
    vi.mocked(useAuth).mockReturnValue({ ...mockAuthBase, isAuthenticated: true })
    renderRouter('/signup')
    // SignupPageRoute redireciona para /today quando isAuthenticated === true
    expect(screen.getByRole('main', { name: 'Hoje' })).toBeInTheDocument()
  })

  it('test_rota_desconhecida_redireciona_para_today', () => {
    vi.mocked(useAuth).mockReturnValue({ ...mockAuthBase, isAuthenticated: true })
    renderRouter('/rota-que-nao-existe')
    // catchall (*) dentro do ProtectedLayout redireciona para /today
    expect(screen.getByRole('main', { name: 'Hoje' })).toBeInTheDocument()
  })

  it('test_nao_autenticado_redireciona_para_login', async () => {
    vi.mocked(useAuth).mockReturnValue({ ...mockAuthBase, isAuthenticated: false })
    renderRouter('/today')
    // ProtectedLayout redireciona para /login — LoginPage renderiza campo de email
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it('test_autenticado_acessa_today', () => {
    vi.mocked(useAuth).mockReturnValue({ ...mockAuthBase, isAuthenticated: true })
    renderRouter('/today')
    expect(screen.getByRole('main', { name: 'Hoje' })).toBeInTheDocument()
  })

  it('test_login_bem_sucedido_navega_para_today', async () => {
    // Integração completa: submeter o formulário de login com sucesso deve
    // disparar onSuccess -> navigate('/today') e renderizar a DailyPage "Hoje".
    const user = userEvent.setup()
    let authenticated = false
    vi.mocked(useAuth).mockImplementation(() => ({
      ...mockAuthBase,
      isAuthenticated: authenticated,
      login: () => {
        authenticated = true
      },
    }))
    vi.mocked(loginApi).mockResolvedValue({ access: 'acc-token', refresh: 'ref-token' })

    renderRouter('/login')

    await user.type(screen.getByLabelText(/email/i), 'user@example.com')
    await user.type(screen.getByLabelText(/senha/i), 'senha123')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(screen.getByRole('main', { name: 'Hoje' })).toBeInTheDocument()
    })

    // Regressão da Task 4: a casca autenticada não deve reintroduzir um <main>
    // genérico em torno do Outlet — só o <main aria-label="Hoje"> da DailyPage.
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(await axe(document.body)).toHaveNoViolations()
  })

  it('test_autenticado_em_login_redireciona_para_today', () => {
    vi.mocked(useAuth).mockReturnValue({ ...mockAuthBase, isAuthenticated: true })
    renderRouter('/login')
    // LoginPageRoute redireciona para /today quando isAuthenticated === true
    expect(screen.getByRole('main', { name: 'Hoje' })).toBeInTheDocument()
  })
})
