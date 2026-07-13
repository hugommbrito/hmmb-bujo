import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'
import { createBujoTheme } from '../../theme'
import { WeeklyPage } from './WeeklyPage'

vi.mock('../../features/bujo', () => ({
  useWeeklyLogQuery: vi.fn(),
}))

import { useWeeklyLogQuery } from '../../features/bujo'

const mockUseWeeklyLogQuery = useWeeklyLogQuery as ReturnType<typeof vi.fn>

function mockMatchMedia(matchesMobile: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: matchesMobile && query === '(max-width: 767px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function renderWeeklyPage() {
  return render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <WeeklyPage />
    </ThemeProvider>,
  )
}

const DAYS = [
  { date: '2026-07-13', tasks: [{ id: 't1', title: 'Tarefa segunda', status: 'pending', eisenhower: null, category: null, subtasks: [] }] },
  { date: '2026-07-14', tasks: [] },
  { date: '2026-07-15', tasks: [] },
  { date: '2026-07-16', tasks: [] },
  { date: '2026-07-17', tasks: [] },
  { date: '2026-07-18', tasks: [] },
  { date: '2026-07-19', tasks: [] },
]

const WEEKLY_LOG = {
  weekStart: '2026-07-13',
  days: DAYS,
  unscheduled: [
    { id: 'u1', title: 'Tarefa sem dia', status: 'pending', eisenhower: null, category: null, subtasks: [] },
  ],
}

describe('WeeklyPage (AC3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMatchMedia(false)
  })

  it('mostra skeleton enquanto o log está carregando', () => {
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: true, data: undefined })

    renderWeeklyPage()

    expect(screen.getByLabelText('Esta Semana')).toBeInTheDocument()
  })

  it('desktop: renderiza os 7 dias lado a lado', () => {
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: WEEKLY_LOG })

    renderWeeklyPage()

    expect(screen.getByText('Tarefa segunda')).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('mobile: renderiza o seletor de dia e mostra só o dia selecionado', () => {
    mockMatchMedia(true)
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: WEEKLY_LOG })

    renderWeeklyPage()

    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getByText('Tarefa segunda')).toBeInTheDocument()
  })

  it('renderiza a seção "Sem dia definido" com as tarefas do weekly log sem scheduledDate', () => {
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: WEEKLY_LOG })

    renderWeeklyPage()

    expect(screen.getByText('Sem dia definido')).toBeInTheDocument()
    expect(screen.getByText('Tarefa sem dia')).toBeInTheDocument()
  })

  it('não renderiza a seção "Sem dia definido" quando unscheduled está vazio', () => {
    mockUseWeeklyLogQuery.mockReturnValue({
      isPending: false,
      data: { ...WEEKLY_LOG, unscheduled: [] },
    })

    renderWeeklyPage()

    expect(screen.queryByText('Sem dia definido')).not.toBeInTheDocument()
  })

  it('TaskRow renderiza somente-leitura (sem botão "Mover tarefa")', () => {
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: WEEKLY_LOG })

    renderWeeklyPage()

    expect(screen.queryByRole('button', { name: 'Mover tarefa' })).not.toBeInTheDocument()
  })

  it('sem violações de acessibilidade (jest-axe) no desktop', async () => {
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: WEEKLY_LOG })

    const { container } = renderWeeklyPage()

    expect(await axe(container)).toHaveNoViolations()
  })

  it('sem violações de acessibilidade (jest-axe) no mobile', async () => {
    mockMatchMedia(true)
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: WEEKLY_LOG })

    const { container } = renderWeeklyPage()

    expect(await axe(container)).toHaveNoViolations()
  })
})
