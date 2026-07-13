import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'
import { createBujoTheme } from '../../theme'
import { FuturePage } from './FuturePage'

const mockCreateMutate = vi.fn()

vi.mock('../../features/bujo', () => ({
  useFutureLogQuery: vi.fn(),
  useCreateMonthlyTaskMutation: vi.fn(() => ({ mutate: mockCreateMutate })),
}))

import { useFutureLogQuery } from '../../features/bujo'

const mockUseFutureLogQuery = useFutureLogQuery as ReturnType<typeof vi.fn>

function renderFuturePage() {
  return render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <FuturePage />
    </ThemeProvider>,
  )
}

const FUTURE_GROUPS = [
  {
    year: 2026,
    month: 7,
    tasks: [
      {
        id: 't1',
        title: 'Pix VG',
        status: 'pending',
        eisenhower: null,
        category: null,
        scheduledDate: '2026-07-14',
        subtasks: [],
      },
      {
        id: 't2',
        title: 'Sem dia definido',
        status: 'pending',
        eisenhower: null,
        category: null,
        scheduledDate: null,
        subtasks: [],
      },
    ],
  },
]

describe('FuturePage (AC2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mostra skeleton enquanto carrega', () => {
    mockUseFutureLogQuery.mockReturnValue({ isPending: true, data: undefined })

    renderFuturePage()

    expect(screen.getByLabelText('Futuro')).toBeInTheDocument()
  })

  it('mostra estado vazio quando não há grupos', () => {
    mockUseFutureLogQuery.mockReturnValue({ isPending: false, data: [] })

    renderFuturePage()

    expect(screen.getByText('Nenhum item no futuro ainda.')).toBeInTheDocument()
  })

  it('agrupa por mês com cabeçalho "Julho 2026"', () => {
    mockUseFutureLogQuery.mockReturnValue({ isPending: false, data: FUTURE_GROUPS })

    renderFuturePage()

    expect(screen.getByText('Julho 2026')).toBeInTheDocument()
  })

  it('tarefa com dia exibe prefixo "(14)"', () => {
    mockUseFutureLogQuery.mockReturnValue({ isPending: false, data: FUTURE_GROUPS })

    renderFuturePage()

    expect(screen.getByText('(14)')).toBeInTheDocument()
    expect(screen.getByText('Pix VG')).toBeInTheDocument()
  })

  it('tarefa sem dia exibe prefixo "— jul"', () => {
    mockUseFutureLogQuery.mockReturnValue({ isPending: false, data: FUTURE_GROUPS })

    renderFuturePage()

    expect(screen.getByText('— jul')).toBeInTheDocument()
    expect(screen.getByText('Sem dia definido')).toBeInTheDocument()
  })

  it('submeter o formulário chama useCreateMonthlyTaskMutation', () => {
    mockUseFutureLogQuery.mockReturnValue({ isPending: false, data: [] })

    renderFuturePage()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Item do futuro' } })
    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '2026-12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(mockCreateMutate).toHaveBeenCalledWith({
      monthFirst: '2026-12-01',
      title: 'Item do futuro',
    })
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    mockUseFutureLogQuery.mockReturnValue({ isPending: false, data: FUTURE_GROUPS })

    const { container } = renderFuturePage()

    expect(await axe(container)).toHaveNoViolations()
  })
})
