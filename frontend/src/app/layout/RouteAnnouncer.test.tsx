import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '@mui/material'
import { createBujoTheme } from '../../theme'

vi.mock('../../shared/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

// DailyPage (rota /today desde a Story 3.2) depende de TanStack Query — estes
// testes cobrem o anúncio de navegação, não o conteúdo do Daily Log.
// `MigrationBanner`/`WeeklyReviewBanner`/`MonthlyReviewBanner`/`CatchUpBanner`
// também usam TanStack Query direto (`../api`), fora deste mock — mocados
// como `TaskDetailPanel` abaixo, sem QueryClientProvider aqui.
vi.mock('../../features/bujo', () => ({
  useTodayLogQuery: () => ({
    isPending: false,
    data: { id: 'log-1', logDate: '2026-01-01', tasks: [] },
  }),
  useTransitionTaskMutation: () => ({ mutate: vi.fn() }),
  useCreateTaskMutation: () => ({ mutate: vi.fn() }),
  useReorderTaskMutation: () => ({ mutate: vi.fn() }),
  MigrationBanner: () => null,
  WeeklyReviewBanner: () => null,
  MonthlyReviewBanner: () => null,
  CatchUpBanner: () => null,
  RecurringTemplateManager: () => null,
}))

// TaskDetailPanel usa mutações do TanStack Query (`../api`) diretamente, fora
// deste mock — sem um QueryClientProvider na árvore, mocamos o componente.
vi.mock('../../features/bujo/components/TaskDetailPanel', () => ({
  TaskDetailPanel: () => null,
}))

// BrainDumpBadge (Sidebar/BottomNav, Story 5.2) usa TanStack Query direto —
// mesmo motivo do mock de TaskDetailPanel acima, sem QueryClientProvider aqui.
vi.mock('../../features/braindump', () => ({
  BrainDumpBadge: ({ children }: { children: React.ReactNode }) => children,
  BrainDumpCaptureSheet: ({ open }: { open: boolean }) =>
    open ? <div>capture sheet aberto</div> : null,
}))

// HabitTracker (DailyPage, Story 6.2) e useHabitDayQuery (via useDailyData) usam
// TanStack Query direto — mesmo motivo dos mocks acima, sem QueryClientProvider aqui.
vi.mock('../../features/habits', () => ({
  useHabitDayQuery: () => ({ isPending: false, data: undefined }),
  HabitTracker: () => null,
}))

// Mock useMediaQuery to avoid jsdom matchMedia issues — força branch desktop/tablet (Sidebar visível)
vi.mock('@mui/material', async (importOriginal) => {
  const original = await importOriginal<typeof import('@mui/material')>()
  return { ...original, useMediaQuery: vi.fn().mockReturnValue(false) }
})

import { useAuth } from '../../shared/hooks/useAuth'
import { useMediaQuery } from '@mui/material'
import { routeDefinitions } from '../router'

const mockAuthBase = { sessionExpired: false, userId: null, login: vi.fn(), logout: vi.fn() }

function renderRouter(initialEntry: string) {
  const router = createMemoryRouter(routeDefinitions, { initialEntries: [initialEntry] })
  render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
  return router
}

describe('RouteAnnouncer', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ ...mockAuthBase, isAuthenticated: true })
  })

  it('test_anuncia_superficie_inicial', () => {
    renderRouter('/today')

    expect(screen.getByRole('status')).toHaveTextContent('Hoje')
  })

  it('test_anuncia_mudanca_de_superficie_ao_navegar', async () => {
    const user = userEvent.setup()
    renderRouter('/today')

    await user.click(screen.getByText('Hábitos'))

    expect(screen.getByRole('status')).toHaveTextContent('Hábitos')
  })

  it('test_sem_violacoes_de_acessibilidade', async () => {
    renderRouter('/today')

    expect(await axe(document.body)).toHaveNoViolations()
  })
})

describe('RouteAnnouncer — mobile (BottomNav)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ ...mockAuthBase, isAuthenticated: true })
    // Força branch mobile (BottomNav visível, Sidebar oculta) — só a query de mobile é true.
    vi.mocked(useMediaQuery).mockImplementation((query: string) => query === '(max-width: 767px)')
  })

  it('test_anuncia_superficie_inicial_via_bottom_nav', () => {
    renderRouter('/today')

    expect(screen.getByRole('status')).toHaveTextContent('Hoje')
  })

  it('test_anuncia_mudanca_de_superficie_ao_navegar_via_bottom_nav', async () => {
    const user = userEvent.setup()
    renderRouter('/today')

    await user.click(screen.getByText('Hábitos'))

    expect(screen.getByRole('status')).toHaveTextContent('Hábitos')
    // Regressão da Task 4: navegar não deve introduzir um segundo <main> —
    // só o <main aria-label="Hábitos"> do PlaceholderPage deve existir.
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('test_sem_violacoes_de_acessibilidade_apos_navegar', async () => {
    const user = userEvent.setup()
    renderRouter('/today')

    await user.click(screen.getByText('Hábitos'))

    expect(await axe(document.body)).toHaveNoViolations()
  })
})
