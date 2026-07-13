import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'
import { createBujoTheme } from '../../theme'
import { MonthlyPage } from './MonthlyPage'

const mockCreateMutate = vi.fn()
const mockRefetch = vi.fn()

vi.mock('../../features/bujo', () => ({
  useMonthlyLogQuery: vi.fn(),
  useCreateMonthlyTaskMutation: vi.fn(() => ({ mutate: mockCreateMutate })),
}))

import { useMonthlyLogQuery } from '../../features/bujo'

const mockUseMonthlyLogQuery = useMonthlyLogQuery as ReturnType<typeof vi.fn>

function renderMonthlyPage() {
  return render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <MonthlyPage />
    </ThemeProvider>,
  )
}

const MONTHLY_LOG = {
  monthFirst: '2026-07-01',
  tasks: [
    {
      id: 't1',
      title: 'Com dia',
      status: 'pending',
      eisenhower: null,
      category: null,
      scheduledDate: '2026-07-20',
      subtasks: [],
    },
    {
      id: 't2',
      title: 'Sem dia',
      status: 'pending',
      eisenhower: null,
      category: null,
      scheduledDate: null,
      subtasks: [],
    },
  ],
}

describe('MonthlyPage (AC2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mostra skeleton enquanto o log está carregando', () => {
    mockUseMonthlyLogQuery.mockReturnValue({ isPending: true, data: undefined })

    renderMonthlyPage()

    expect(screen.getByLabelText('Este Mês')).toBeInTheDocument()
  })

  it('mostra estado vazio quando não há tarefas', () => {
    mockUseMonthlyLogQuery.mockReturnValue({
      isPending: false,
      data: { monthFirst: '2026-07-01', tasks: [] },
      refetch: mockRefetch,
    })

    renderMonthlyPage()

    expect(screen.getByText('Nenhuma tarefa neste mês.')).toBeInTheDocument()
  })

  it('agrupa tarefa com dia sob um DayHeader e tarefa sem dia em "Sem dia definido"', () => {
    mockUseMonthlyLogQuery.mockReturnValue({ isPending: false, data: MONTHLY_LOG, refetch: mockRefetch })

    renderMonthlyPage()

    expect(screen.getByText('Com dia')).toBeInTheDocument()
    expect(screen.getByText('Sem dia definido')).toBeInTheDocument()
    expect(screen.getByText('Sem dia')).toBeInTheDocument()
  })

  it('TaskRow renderiza somente-leitura (sem botão "Mover tarefa")', () => {
    mockUseMonthlyLogQuery.mockReturnValue({ isPending: false, data: MONTHLY_LOG, refetch: mockRefetch })

    renderMonthlyPage()

    expect(screen.queryByRole('button', { name: 'Mover tarefa' })).not.toBeInTheDocument()
  })

  it('formulário de adicionar tarefa ao mês chama a mutação com monthFirst do log carregado', () => {
    mockUseMonthlyLogQuery.mockReturnValue({ isPending: false, data: MONTHLY_LOG, refetch: mockRefetch })

    renderMonthlyPage()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Nova tarefa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(mockCreateMutate).toHaveBeenCalledWith(
      { monthFirst: '2026-07-01', title: 'Nova tarefa', scheduledDate: undefined },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('formulário com dia opcional envia scheduledDate derivado do mês do log', () => {
    mockUseMonthlyLogQuery.mockReturnValue({ isPending: false, data: MONTHLY_LOG, refetch: mockRefetch })

    renderMonthlyPage()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Com dia novo' } })
    fireEvent.change(screen.getByLabelText('Dia (opcional)'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(mockCreateMutate).toHaveBeenCalledWith(
      { monthFirst: '2026-07-01', title: 'Com dia novo', scheduledDate: '2026-07-05' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    mockUseMonthlyLogQuery.mockReturnValue({ isPending: false, data: MONTHLY_LOG, refetch: mockRefetch })

    const { container } = renderMonthlyPage()

    expect(await axe(container)).toHaveNoViolations()
  })
})
