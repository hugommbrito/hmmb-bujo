import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'
import { createBujoTheme } from '../../../theme'
import { CatchUpBanner } from './CatchUpBanner'
import type { Task } from '../types'

const mockMigrateMutate = vi.fn()

vi.mock('../api', () => ({
  useCatchUpQueueQuery: vi.fn(),
  useMigrateTaskMutation: vi.fn(() => ({ mutate: mockMigrateMutate })),
}))

import { useCatchUpQueueQuery } from '../api'

const mockUseCatchUpQueueQuery = useCatchUpQueueQuery as ReturnType<typeof vi.fn>

const TASK: Task = {
  id: 'd1',
  title: 'Pendente de 10 dias atrás',
  status: 'pending',
  eisenhower: null,
  category: null,
  subtasks: [],
}

function renderBanner() {
  return render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <CatchUpBanner />
    </ThemeProvider>,
  )
}

describe('CatchUpBanner (AC1)', () => {
  it('não renderiza com as 3 filas vazias', () => {
    mockUseCatchUpQueueQuery.mockReturnValue({
      isPending: false,
      data: { monthlyTasks: [], weeklyTasks: [], dailyTasks: [] },
    })

    const { container } = renderBanner()

    expect(container).toBeEmptyDOMElement()
  })

  it('não renderiza enquanto isPending', () => {
    mockUseCatchUpQueueQuery.mockReturnValue({ isPending: true, data: undefined })

    const { container } = renderBanner()

    expect(container).toBeEmptyDOMElement()
  })

  it('renderiza com contagem somada correta quando só 1 das 3 filas tem tarefas', () => {
    mockUseCatchUpQueueQuery.mockReturnValue({
      isPending: false,
      data: { monthlyTasks: [], weeklyTasks: [], dailyTasks: [TASK, { ...TASK, id: 'd2' }] },
    })

    renderBanner()

    expect(
      screen.getByText(
        '2 tarefas sem disposição de dias, semanas ou meses anteriores. Iniciar Catch-Up?',
      ),
    ).toBeInTheDocument()
  })

  it('clicar no botão abre o CatchUpFlow', () => {
    mockUseCatchUpQueueQuery.mockReturnValue({
      isPending: false,
      data: { monthlyTasks: [], weeklyTasks: [], dailyTasks: [TASK] },
    })

    renderBanner()

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar Catch-Up' }))

    expect(screen.getByText('1 de 1 revisadas')).toBeInTheDocument()
    expect(screen.getByText('Pendente de 10 dias atrás')).toBeInTheDocument()
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    mockUseCatchUpQueueQuery.mockReturnValue({
      isPending: false,
      data: { monthlyTasks: [], weeklyTasks: [], dailyTasks: [TASK] },
    })

    const { container } = renderBanner()

    expect(await axe(container)).toHaveNoViolations()
  })
})
