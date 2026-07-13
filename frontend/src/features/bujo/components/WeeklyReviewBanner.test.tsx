import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'
import { createBujoTheme } from '../../../theme'
import { WeeklyReviewBanner } from './WeeklyReviewBanner'
import type { Task } from '../types'

const mockMigrateMutate = vi.fn()

vi.mock('../api', () => ({
  useWeeklyReviewQueueQuery: vi.fn(),
  useMigrateTaskMutation: vi.fn(() => ({ mutate: mockMigrateMutate })),
}))

import { useWeeklyReviewQueueQuery } from '../api'

const mockUseWeeklyReviewQueueQuery = useWeeklyReviewQueueQuery as ReturnType<typeof vi.fn>

const TASK: Task = {
  id: 'w1',
  title: 'Pendente da semana anterior',
  status: 'pending',
  eisenhower: null,
  category: null,
  subtasks: [],
}

function renderBanner() {
  return render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <WeeklyReviewBanner />
    </ThemeProvider>,
  )
}

describe('WeeklyReviewBanner (AC1)', () => {
  it('não renderiza com fila vazia', () => {
    mockUseWeeklyReviewQueueQuery.mockReturnValue({
      isPending: false,
      data: { weekStart: '2026-07-06', tasks: [] },
    })

    const { container } = renderBanner()

    expect(container).toBeEmptyDOMElement()
  })

  it('não renderiza enquanto isPending', () => {
    mockUseWeeklyReviewQueueQuery.mockReturnValue({ isPending: true, data: undefined })

    const { container } = renderBanner()

    expect(container).toBeEmptyDOMElement()
  })

  it('renderiza o texto exato com a contagem certa', () => {
    mockUseWeeklyReviewQueueQuery.mockReturnValue({
      isPending: false,
      data: { weekStart: '2026-07-06', tasks: [TASK, { ...TASK, id: 'w2' }] },
    })

    renderBanner()

    expect(
      screen.getByText('Semana anterior tem 2 tarefas sem disposição. Revisar?'),
    ).toBeInTheDocument()
  })

  it('clicar em "Iniciar revisão" abre o fluxo de migração com flowType weekly', () => {
    mockUseWeeklyReviewQueueQuery.mockReturnValue({
      isPending: false,
      data: { weekStart: '2026-07-06', tasks: [TASK] },
    })

    renderBanner()

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar revisão' }))

    expect(screen.getByText('1 de 1 revisadas')).toBeInTheDocument()
    expect(screen.getByText('Pendente da semana anterior')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Migrar para esta semana' })).toBeInTheDocument()
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    mockUseWeeklyReviewQueueQuery.mockReturnValue({
      isPending: false,
      data: { weekStart: '2026-07-06', tasks: [TASK] },
    })

    const { container } = renderBanner()

    expect(await axe(container)).toHaveNoViolations()
  })
})
