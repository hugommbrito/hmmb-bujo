import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { createBujoTheme } from '../../../theme'
import { CatchUpFlow } from './CatchUpFlow'
import type { Task } from '../types'

const mockMutate = vi.fn()

vi.mock('../api', () => ({
  useMigrateTaskMutation: vi.fn(() => ({ mutate: mockMutate })),
}))

function makeTask(id: string, title: string): Task {
  return { id, title, status: 'pending', eisenhower: null, category: null, subtasks: [] }
}

const MONTHLY: Task[] = [makeTask('m1', 'Mensal')]
const WEEKLY: Task[] = [makeTask('w1', 'Semanal')]
const DAILY: Task[] = [makeTask('d1', 'Diária')]

function renderFlow({
  monthlyTasks = [] as Task[],
  weeklyTasks = [] as Task[],
  dailyTasks = [] as Task[],
  onClose = vi.fn(),
} = {}) {
  const utils = render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <CatchUpFlow
        monthlyTasks={monthlyTasks}
        weeklyTasks={weeklyTasks}
        dailyTasks={dailyTasks}
        open
        onClose={onClose}
      />
    </ThemeProvider>,
  )
  return { ...utils, onClose }
}

describe('CatchUpFlow (AC1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('só monthlyTasks preenchido → abre direto em flowType=monthly, fecha ao esgotar', () => {
    const { onClose } = renderFlow({ monthlyTasks: MONTHLY })

    expect(screen.getByText('Mensal')).toBeInTheDocument()
    // 'monthly' não tem botão "hoje/semana" — só picker de mês/futuro/cancelar.
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(mockMutate).toHaveBeenCalledWith({ taskId: 'm1', destination: 'cancel' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('weeklyTasks + dailyTasks preenchidos (mês vazio) → abre direto em weekly, avança para daily ao esgotar weekly, fecha ao esgotar daily', () => {
    const { onClose } = renderFlow({ weeklyTasks: WEEKLY, dailyTasks: DAILY })

    expect(screen.getByText('Semanal')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Migrar para esta semana' }))

    expect(mockMutate).toHaveBeenCalledWith({ taskId: 'w1', destination: 'week' })
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('Diária')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Migrar para hoje' }))

    expect(mockMutate).toHaveBeenCalledWith({ taskId: 'd1', destination: 'today' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('decidir todas as tarefas de monthly avança automaticamente para weekly sem fechar o Dialog', () => {
    renderFlow({ monthlyTasks: MONTHLY, weeklyTasks: WEEKLY })

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Semanal')).toBeInTheDocument()
  })

  it('Esc durante weekly chama onClose do pai (Catch-Up inteiro pausa) sem pular para daily', () => {
    const { onClose } = renderFlow({ weeklyTasks: WEEKLY, dailyTasks: DAILY })

    fireEvent.keyDown(screen.getByRole('button', { name: 'Migrar para esta semana' }), {
      key: 'Escape',
    })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mockMutate).not.toHaveBeenCalled()
    expect(screen.getByText('Semanal')).toBeInTheDocument()
  })
})
