import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'
import { createBujoTheme } from '../../../theme'
import { MonthlyReviewBanner } from './MonthlyReviewBanner'
import type { Task } from '../types'

const mockMigrateMutate = vi.fn()

vi.mock('../api', () => ({
  useMonthlyReviewQueueQuery: vi.fn(),
  useMigrateTaskMutation: vi.fn(() => ({ mutate: mockMigrateMutate })),
}))

import { useMonthlyReviewQueueQuery } from '../api'

const mockUseMonthlyReviewQueueQuery = useMonthlyReviewQueueQuery as ReturnType<typeof vi.fn>

const TASK: Task = {
  id: 'm1',
  title: 'Pendente do mês anterior',
  status: 'pending',
  eisenhower: null,
  category: null,
  subtasks: [],
}

function renderBanner() {
  return render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <MonthlyReviewBanner />
    </ThemeProvider>,
  )
}

describe('MonthlyReviewBanner (AC2)', () => {
  it('não renderiza com fila vazia', () => {
    mockUseMonthlyReviewQueueQuery.mockReturnValue({
      isPending: false,
      data: { monthFirst: '2026-06-01', tasks: [] },
    })

    const { container } = renderBanner()

    expect(container).toBeEmptyDOMElement()
  })

  it('não renderiza enquanto isPending', () => {
    mockUseMonthlyReviewQueueQuery.mockReturnValue({ isPending: true, data: undefined })

    const { container } = renderBanner()

    expect(container).toBeEmptyDOMElement()
  })

  it('renderiza o texto exato com a contagem certa', () => {
    mockUseMonthlyReviewQueueQuery.mockReturnValue({
      isPending: false,
      data: { monthFirst: '2026-06-01', tasks: [TASK, { ...TASK, id: 'm2' }] },
    })

    renderBanner()

    expect(
      screen.getByText('Mês anterior tem 2 tarefas sem disposição. Revisar mês anterior?'),
    ).toBeInTheDocument()
  })

  it('clicar em "Revisar mês anterior" abre o fluxo de migração com flowType monthly', () => {
    mockUseMonthlyReviewQueueQuery.mockReturnValue({
      isPending: false,
      data: { monthFirst: '2026-06-01', tasks: [TASK] },
    })

    renderBanner()

    fireEvent.click(screen.getByRole('button', { name: 'Revisar mês anterior' }))

    expect(screen.getByText('1 de 1 revisadas')).toBeInTheDocument()
    expect(screen.getByText('Pendente do mês anterior')).toBeInTheDocument()
    // flowType="monthly" — sem botão "hoje/semana", só 3 botões de decisão.
    expect(
      screen.queryByRole('button', { name: 'Migrar para hoje' }),
    ).not.toBeInTheDocument()
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    mockUseMonthlyReviewQueueQuery.mockReturnValue({
      isPending: false,
      data: { monthFirst: '2026-06-01', tasks: [TASK] },
    })

    const { container } = renderBanner()

    expect(await axe(container)).toHaveNoViolations()
  })
})
