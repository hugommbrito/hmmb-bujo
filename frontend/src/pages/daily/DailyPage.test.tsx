import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'
import { createBujoTheme } from '../../theme'
import { DailyPage } from './DailyPage'

const mockMutate = vi.fn()

vi.mock('../../features/bujo', () => ({
  useTodayLogQuery: vi.fn(),
  useTransitionTaskMutation: vi.fn(() => ({ mutate: mockMutate })),
}))

import { useTodayLogQuery } from '../../features/bujo'

const mockUseTodayLogQuery = useTodayLogQuery as ReturnType<typeof vi.fn>

function renderDailyPage() {
  return render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <DailyPage />
    </ThemeProvider>,
  )
}

const EMPTY_TEXT = 'Nenhuma tarefa para hoje. Adicione ou migre do dia anterior.'

describe('DailyPage (AC1, AC3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mostra skeleton enquanto o log está carregando (isPending)', () => {
    mockUseTodayLogQuery.mockReturnValue({ isPending: true, data: undefined })

    renderDailyPage()

    expect(screen.getByLabelText('Hoje')).toBeInTheDocument()
    expect(screen.queryByText(EMPTY_TEXT)).not.toBeInTheDocument()
  })

  it('mostra o estado vazio quando não há tarefas', () => {
    mockUseTodayLogQuery.mockReturnValue({
      isPending: false,
      data: { id: 'log-1', logDate: '2026-06-15', tasks: [] },
    })

    renderDailyPage()

    expect(screen.getByText(EMPTY_TEXT)).toBeInTheDocument()
  })

  it('mostra a lista de Task Rows quando há tarefas', () => {
    mockUseTodayLogQuery.mockReturnValue({
      isPending: false,
      data: {
        id: 'log-1',
        logDate: '2026-06-15',
        tasks: [
          { id: 't1', title: 'Tarefa 1', status: 'pending', eisenhower: null, category: null },
          { id: 't2', title: 'Tarefa 2', status: 'started', eisenhower: 'u', category: 'teal' },
        ],
      },
    })

    renderDailyPage()

    expect(screen.getByText('Tarefa 1')).toBeInTheDocument()
    expect(screen.getByText('Tarefa 2')).toBeInTheDocument()
    expect(screen.queryByText(EMPTY_TEXT)).not.toBeInTheDocument()
  })

  it('clicar no ícone de status de uma Task Row aciona a mutação de transição (AC2, integração)', () => {
    mockUseTodayLogQuery.mockReturnValue({
      isPending: false,
      data: {
        id: 'log-1',
        logDate: '2026-06-15',
        tasks: [
          { id: 't1', title: 'Tarefa 1', status: 'pending', eisenhower: null, category: null },
        ],
      },
    })

    renderDailyPage()

    fireEvent.click(screen.getByRole('button', { name: 'Pendente' }))

    expect(mockMutate).toHaveBeenCalledWith({ taskId: 't1', toStatus: 'started' })
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    mockUseTodayLogQuery.mockReturnValue({
      isPending: false,
      data: {
        id: 'log-1',
        logDate: '2026-06-15',
        tasks: [
          { id: 't1', title: 'Tarefa 1', status: 'pending', eisenhower: null, category: null },
        ],
      },
    })

    const { container } = renderDailyPage()

    expect(await axe(container)).toHaveNoViolations()
  })
})
