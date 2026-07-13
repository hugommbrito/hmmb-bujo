import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'
import { createBujoTheme } from '../../theme'
import { MonthlyPage } from './MonthlyPage'

const mockCreateMutate = vi.fn()
const mockUpdateMutate = vi.fn()
const mockRefetch = vi.fn()

vi.mock('../../features/bujo', () => ({
  useMonthlyLogQuery: vi.fn(),
  useCreateMonthlyTaskMutation: vi.fn(() => ({ mutate: mockCreateMutate })),
  useUpdateTaskMutation: vi.fn(() => ({ mutate: mockUpdateMutate })),
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

// "Hoje" fixado (Task 8.3) — decoupla os testes do relógio real da máquina,
// já que `isCurrentMonth` (MonthlyPage.tsx) compara contra `new Date()`.
const FIXED_TODAY = new Date('2026-07-15T12:00:00')

// Mês NÃO-corrente (junho, com "hoje" fixado em julho) — cobre a regressão da
// 4.1: título continua "Sem dia definido", ordem inalterada.
const MONTHLY_LOG = {
  monthFirst: '2026-06-01',
  tasks: [
    {
      id: 't1',
      title: 'Com dia',
      status: 'pending',
      eisenhower: null,
      category: null,
      scheduledDate: '2026-06-20',
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

// Mês CORRENTE (julho, mesmo mês de FIXED_TODAY) — seção "Itens do Future Log
// para Julho" deve aparecer antes da seção com data (Task 8.1).
const MONTHLY_LOG_CURRENT = {
  monthFirst: '2026-07-01',
  tasks: [
    {
      id: 't3',
      title: 'Com dia em julho',
      status: 'pending',
      eisenhower: null,
      category: null,
      scheduledDate: '2026-07-20',
      subtasks: [],
    },
    {
      id: 't4',
      title: 'Do Future Log',
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
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_TODAY)
  })

  afterEach(() => {
    vi.useRealTimers()
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
      { monthFirst: '2026-06-01', title: 'Nova tarefa', scheduledDate: undefined },
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
      { monthFirst: '2026-06-01', title: 'Com dia novo', scheduledDate: '2026-06-05' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    mockUseMonthlyLogQuery.mockReturnValue({ isPending: false, data: MONTHLY_LOG, refetch: mockRefetch })

    const { container } = renderMonthlyPage()
    // jest-axe depende de timers reais (setTimeout/rAF internos) — fake
    // timers (usados aqui só para fixar "hoje" no render) travariam a
    // promise indefinidamente.
    vi.useRealTimers()

    expect(await axe(container)).toHaveNoViolations()
  })

  it('mês corrente: título "Itens do Future Log para Julho" aparece antes da seção com data', () => {
    mockUseMonthlyLogQuery.mockReturnValue({
      isPending: false,
      data: MONTHLY_LOG_CURRENT,
      refetch: mockRefetch,
    })

    renderMonthlyPage()

    expect(screen.getByText('Itens do Future Log para Julho')).toBeInTheDocument()
    expect(screen.getByText('Do Future Log')).toBeInTheDocument()
    expect(screen.getByText('Com dia em julho')).toBeInTheDocument()
    expect(screen.queryByText('Sem dia definido')).not.toBeInTheDocument()

    // A seção "Itens do Future Log" vem ANTES da seção com data (DayHeader) no DOM.
    const allText = document.body.textContent ?? ''
    expect(allText.indexOf('Itens do Future Log para Julho')).toBeLessThan(
      allText.indexOf('Com dia em julho'),
    )
  })

  it('mês NÃO-corrente: título continua "Sem dia definido", ordem inalterada (regressão da 4.1)', () => {
    mockUseMonthlyLogQuery.mockReturnValue({ isPending: false, data: MONTHLY_LOG, refetch: mockRefetch })

    renderMonthlyPage()

    expect(screen.getByText('Sem dia definido')).toBeInTheDocument()
    expect(screen.queryByText(/Itens do Future Log/)).not.toBeInTheDocument()
    const allText = document.body.textContent ?? ''
    expect(allText.indexOf('Com dia')).toBeLessThan(allText.indexOf('Sem dia definido'))
  })

  it('preencher a data de um item sem data chama useUpdateTaskMutation com o scheduledDate certo', () => {
    mockUseMonthlyLogQuery.mockReturnValue({
      isPending: false,
      data: MONTHLY_LOG_CURRENT,
      refetch: mockRefetch,
    })

    renderMonthlyPage()

    fireEvent.change(screen.getByLabelText('Confirmar data'), {
      target: { value: '2026-07-25' },
    })

    expect(mockUpdateMutate).toHaveBeenCalledWith({ taskId: 't4', scheduledDate: '2026-07-25' })
  })
})
