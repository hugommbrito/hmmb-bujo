import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'
import { createBujoTheme } from '../../../theme'
import { TaskDestinationDialog } from './TaskDestinationDialog'
import type { Task } from '../types'

const mockMigrateMutate = vi.fn()

vi.mock('../api', () => ({
  useMigrateTaskMutation: vi.fn(),
  useTaskDensityQuery: vi.fn(),
}))

import { useMigrateTaskMutation, useTaskDensityQuery } from '../api'

const mockUseMigrateTaskMutation = useMigrateTaskMutation as ReturnType<typeof vi.fn>
const mockUseTaskDensityQuery = useTaskDensityQuery as ReturnType<typeof vi.fn>

function baseTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Finalizar relatório Q2',
    status: 'pending',
    eisenhower: null,
    category: null,
    subtasks: [],
    ...overrides,
  }
}

function renderDialog(props: Partial<Parameters<typeof TaskDestinationDialog>[0]> = {}) {
  const defaults = { task: baseTask(), open: true, onClose: vi.fn() }
  const merged = { ...defaults, ...props }
  return {
    ...merged,
    ...render(
      <ThemeProvider theme={createBujoTheme('light')}>
        <TaskDestinationDialog {...merged} />
      </ThemeProvider>,
    ),
  }
}

describe('TaskDestinationDialog (AC1, AC2, AC3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseMigrateTaskMutation.mockReturnValue({ mutate: mockMigrateMutate, isError: false })
    mockUseTaskDensityQuery.mockReturnValue({
      data: [
        { date: '2026-07-10', count: 2 },
        { date: '2026-07-15', count: 1 },
      ],
    })
  })

  it('exibe título, descrição e subtarefas', () => {
    renderDialog({
      task: baseTask({
        description: 'Descrição da tarefa',
        subtasks: [{ id: 'sub-1', title: 'Subtarefa 1', status: 'pending', subtasks: [] }],
      }),
    })

    expect(screen.getByText('Finalizar relatório Q2')).toBeInTheDocument()
    expect(screen.getByText('Descrição da tarefa')).toBeInTheDocument()
    expect(screen.getByText('Subtarefa 1')).toBeInTheDocument()
  })

  it('aba "Dia" mostra o MonthDensityCalendar interativo com as densidades da query', () => {
    renderDialog()

    expect(screen.getByLabelText('10 de julho, 2 tarefas')).toBeInTheDocument()
    expect(screen.getByLabelText('15 de julho, 1 tarefa')).toBeInTheDocument()
  })

  it('clicar num dia chama mutate com destination=week e fecha o diálogo no sucesso', () => {
    const { onClose } = renderDialog()

    fireEvent.click(screen.getByLabelText('10 de julho, 2 tarefas'))

    expect(mockMigrateMutate).toHaveBeenCalledWith(
      { taskId: 'task-1', destination: 'week', scheduledDate: '2026-07-10' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
    mockMigrateMutate.mock.calls[0][1].onSuccess()
    expect(onClose).toHaveBeenCalled()
  })

  it('Prev/Next mês trocam o mês do calendário e disparam novo fetch de densidade', () => {
    renderDialog()

    mockUseTaskDensityQuery.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }))

    const lastCallMonthFirst = mockUseTaskDensityQuery.mock.calls.at(-1)?.[0]
    expect(lastCallMonthFirst).not.toBe(undefined)
    expect(lastCallMonthFirst).toMatch(/-01$/)
  })

  it('aba "Este mês" — onChange da data chama mutate com destination=month', () => {
    const { onClose } = renderDialog()

    fireEvent.click(screen.getByRole('tab', { name: 'Este mês' }))
    fireEvent.change(screen.getByLabelText('Data no mês corrente'), {
      target: { value: '2026-07-20' },
    })

    expect(mockMigrateMutate).toHaveBeenCalledWith(
      { taskId: 'task-1', destination: 'month', scheduledDate: '2026-07-20' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
    mockMigrateMutate.mock.calls[0][1].onSuccess()
    expect(onClose).toHaveBeenCalled()
  })

  it('aba "Futuro" — dia então mês chama mutate com scheduledDate composto', () => {
    renderDialog()

    fireEvent.click(screen.getByRole('tab', { name: 'Futuro' }))
    fireEvent.change(screen.getByLabelText('Dia (opcional)'), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '2026-09' } })

    expect(mockMigrateMutate).toHaveBeenCalledWith(
      {
        taskId: 'task-1',
        destination: 'future',
        monthFirst: '2026-09-01',
        scheduledDate: '2026-09-05',
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('aba "Futuro" — sem dia, só mês, chama mutate com scheduledDate undefined', () => {
    renderDialog()

    fireEvent.click(screen.getByRole('tab', { name: 'Futuro' }))
    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '2026-09' } })

    expect(mockMigrateMutate).toHaveBeenCalledWith(
      {
        taskId: 'task-1',
        destination: 'future',
        monthFirst: '2026-09-01',
        scheduledDate: undefined,
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('erro de mutação mostra mensagem e não fecha o diálogo', () => {
    mockUseMigrateTaskMutation.mockReturnValue({ mutate: mockMigrateMutate, isError: true })
    const { onClose } = renderDialog()

    expect(
      screen.getByText('Não foi possível mover a tarefa. Tente novamente.'),
    ).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('botão "Cancelar" fecha o diálogo sem mover', () => {
    const { onClose } = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onClose).toHaveBeenCalled()
    expect(mockMigrateMutate).not.toHaveBeenCalled()
  })

  it('botão "Cancelar" NÃO chama onSuccess — só onClose', () => {
    const onSuccess = vi.fn()
    const { onClose } = renderDialog({ onSuccess })

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onClose).toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('sucesso da mutação chama onClose e onSuccess', () => {
    const onSuccess = vi.fn()
    renderDialog({ onSuccess })

    fireEvent.click(screen.getByRole('tab', { name: 'Este mês' }))
    fireEvent.change(screen.getByLabelText('Data no mês corrente'), {
      target: { value: '2026-07-20' },
    })
    mockMigrateMutate.mock.calls[0][1].onSuccess()

    expect(onSuccess).toHaveBeenCalled()
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    renderDialog()
    expect(await axe(document.body)).toHaveNoViolations()
  })
})
