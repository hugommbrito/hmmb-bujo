import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'
import { createBujoTheme } from '../../../theme'
import { MigrationBanner } from './MigrationBanner'
import type { Task } from '../types'

const mockMigrateMutate = vi.fn()

vi.mock('../api', () => ({
  useMigrationQueueQuery: vi.fn(),
  useMigrateTaskMutation: vi.fn(() => ({ mutate: mockMigrateMutate })),
}))

import { useMigrationQueueQuery } from '../api'

const mockUseMigrationQueueQuery = useMigrationQueueQuery as ReturnType<typeof vi.fn>

const TASK: Task = {
  id: 'y1',
  title: 'Pendente de ontem',
  status: 'pending',
  eisenhower: null,
  category: null,
  subtasks: [],
}

function renderBanner() {
  return render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <MigrationBanner />
    </ThemeProvider>,
  )
}

describe('MigrationBanner (AC1)', () => {
  it('não renderiza com fila vazia', () => {
    mockUseMigrationQueueQuery.mockReturnValue({
      isPending: false,
      data: { logDate: '2026-06-14', tasks: [] },
    })

    const { container } = renderBanner()

    expect(container).toBeEmptyDOMElement()
  })

  it('não renderiza enquanto isPending', () => {
    mockUseMigrationQueueQuery.mockReturnValue({ isPending: true, data: undefined })

    const { container } = renderBanner()

    expect(container).toBeEmptyDOMElement()
  })

  it('renderiza o texto exato com a contagem certa', () => {
    mockUseMigrationQueueQuery.mockReturnValue({
      isPending: false,
      data: { logDate: '2026-06-14', tasks: [TASK, { ...TASK, id: 'y2' }] },
    })

    renderBanner()

    expect(
      screen.getByText('2 tarefas pendentes de ontem. Iniciar migração?'),
    ).toBeInTheDocument()
  })

  it('clicar em "Iniciar" abre o fluxo de migração', () => {
    mockUseMigrationQueueQuery.mockReturnValue({
      isPending: false,
      data: { logDate: '2026-06-14', tasks: [TASK] },
    })

    renderBanner()

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar' }))

    expect(screen.getByText('1 de 1 revisadas')).toBeInTheDocument()
    expect(screen.getByText('Pendente de ontem')).toBeInTheDocument()
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    mockUseMigrationQueueQuery.mockReturnValue({
      isPending: false,
      data: { logDate: '2026-06-14', tasks: [TASK] },
    })

    const { container } = renderBanner()

    expect(await axe(container)).toHaveNoViolations()
  })
})
