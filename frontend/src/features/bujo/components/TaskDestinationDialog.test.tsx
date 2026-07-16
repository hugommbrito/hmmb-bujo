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
    // "Esta semana" e "Este mês" partem do mês corrente real (currentMonthFirst
    // não é mockado) — os rótulos "10/15 de julho" assumem execução em julho
    // de 2026, mesma premissa já usada na suite anterior a esta story.
    mockUseTaskDensityQuery.mockReturnValue({
      data: [
        { date: '2026-07-10', count: 2 },
        { date: '2026-07-15', count: 1 },
      ],
    })
  })

  it('título do diálogo é "Migrar Tarefa"', () => {
    renderDialog()

    expect(screen.getByRole('dialog', { name: 'Migrar Tarefa' })).toBeInTheDocument()
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

  it('exibe "Atualmente: DD/MM" quando task.scheduledDate está presente', () => {
    renderDialog({ task: baseTask({ scheduledDate: '2026-07-20' }) })

    expect(screen.getByText('Atualmente: 20/07')).toBeInTheDocument()
  })

  it('não exibe "Atualmente" quando task.scheduledDate está ausente', () => {
    renderDialog()

    expect(screen.queryByText(/^Atualmente:/)).not.toBeInTheDocument()
  })

  it('4 abas na ordem Hoje/Esta semana/Este mês/Futuro, com "Hoje" selecionada por padrão', () => {
    renderDialog()

    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent)
    expect(tabs).toEqual(['Hoje', 'Esta semana', 'Este mês', 'Futuro'])
    expect(screen.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true')
  })

  it('aba "Hoje" — sem campos; Migrar chama mutate com destination=today', () => {
    const { onClose } = renderDialog()

    expect(screen.getByText('Mover para o Daily Log de hoje.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Migrar' }))

    expect(mockMigrateMutate).toHaveBeenCalledWith(
      { taskId: 'task-1', destination: 'today' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
    mockMigrateMutate.mock.calls[0][1].onSuccess()
    expect(onClose).toHaveBeenCalled()
  })

  it('aba "Esta semana" — clicar um dia não migra ainda; só migra ao clicar "Migrar"', () => {
    renderDialog()
    fireEvent.click(screen.getByRole('tab', { name: 'Esta semana' }))

    fireEvent.click(screen.getByLabelText('10 de julho, 2 tarefas'))
    expect(mockMigrateMutate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Migrar' }))
    expect(mockMigrateMutate).toHaveBeenCalledWith(
      { taskId: 'task-1', destination: 'week', scheduledDate: '2026-07-10' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('aba "Esta semana" — sem clicar dia, Migrar chama mutate com scheduledDate undefined (semana sem data)', () => {
    renderDialog()
    fireEvent.click(screen.getByRole('tab', { name: 'Esta semana' }))

    fireEvent.click(screen.getByRole('button', { name: 'Migrar' }))
    expect(mockMigrateMutate).toHaveBeenCalledWith(
      { taskId: 'task-1', destination: 'week', scheduledDate: undefined },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('aba "Esta semana" — clicar no dia já selecionado desmarca (toggle)', () => {
    renderDialog()
    fireEvent.click(screen.getByRole('tab', { name: 'Esta semana' }))
    const day = screen.getByLabelText('10 de julho, 2 tarefas')

    fireEvent.click(day)
    expect(day).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(day)
    expect(day).toHaveAttribute('aria-pressed', 'false')
  })

  it('Prev/Next mês (aba "Esta semana") trocam o mês do calendário e disparam novo fetch de densidade', () => {
    renderDialog()
    fireEvent.click(screen.getByRole('tab', { name: 'Esta semana' }))

    mockUseTaskDensityQuery.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }))

    const lastCallMonthFirst = mockUseTaskDensityQuery.mock.calls.at(-1)?.[0]
    expect(lastCallMonthFirst).not.toBe(undefined)
    expect(lastCallMonthFirst).toMatch(/-01$/)
  })

  it('aba "Este mês" — sem navegação Prev/Next (mês fixo no corrente)', () => {
    renderDialog()
    fireEvent.click(screen.getByRole('tab', { name: 'Este mês' }))

    expect(screen.queryByRole('button', { name: 'Mês anterior' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Próximo mês' })).not.toBeInTheDocument()
  })

  it('aba "Este mês" — clicar um dia + Migrar chama mutate com destination=month e scheduledDate', () => {
    renderDialog()
    fireEvent.click(screen.getByRole('tab', { name: 'Este mês' }))

    fireEvent.click(screen.getByLabelText('10 de julho, 2 tarefas'))
    expect(mockMigrateMutate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Migrar' }))
    expect(mockMigrateMutate).toHaveBeenCalledWith(
      { taskId: 'task-1', destination: 'month', scheduledDate: '2026-07-10' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('aba "Este mês" — sem clicar dia, Migrar chama mutate com scheduledDate undefined (mês sem data)', () => {
    renderDialog()
    fireEvent.click(screen.getByRole('tab', { name: 'Este mês' }))

    fireEvent.click(screen.getByRole('button', { name: 'Migrar' }))
    expect(mockMigrateMutate).toHaveBeenCalledWith(
      { taskId: 'task-1', destination: 'month', scheduledDate: undefined },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('aba "Este mês" — clicar no dia já selecionado desmarca (toggle)', () => {
    renderDialog()
    fireEvent.click(screen.getByRole('tab', { name: 'Este mês' }))
    const day = screen.getByLabelText('10 de julho, 2 tarefas')

    fireEvent.click(day)
    expect(day).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(day)
    expect(day).toHaveAttribute('aria-pressed', 'false')
  })

  it('aba "Futuro" — dia então mês; Migrar chama mutate com scheduledDate composto', () => {
    renderDialog()
    fireEvent.click(screen.getByRole('tab', { name: 'Futuro' }))
    fireEvent.change(screen.getByLabelText('Dia (opcional)'), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '2026-09' } })
    expect(mockMigrateMutate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Migrar' }))
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

  it('aba "Futuro" — sem dia, só mês; Migrar chama mutate com scheduledDate undefined', () => {
    renderDialog()
    fireEvent.click(screen.getByRole('tab', { name: 'Futuro' }))
    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '2026-09' } })

    fireEvent.click(screen.getByRole('button', { name: 'Migrar' }))
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

  it('aba "Futuro" — botão "Migrar" desabilitado até o mês ser preenchido', () => {
    renderDialog()
    fireEvent.click(screen.getByRole('tab', { name: 'Futuro' }))

    expect(screen.getByRole('button', { name: 'Migrar' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '2026-09' } })
    expect(screen.getByRole('button', { name: 'Migrar' })).toBeEnabled()
  })

  it('trocar de aba não reseta o estado das outras', () => {
    renderDialog()
    fireEvent.click(screen.getByRole('tab', { name: 'Esta semana' }))
    fireEvent.click(screen.getByLabelText('10 de julho, 2 tarefas'))

    fireEvent.click(screen.getByRole('tab', { name: 'Futuro' }))
    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '2026-09' } })

    fireEvent.click(screen.getByRole('tab', { name: 'Esta semana' }))
    fireEvent.click(screen.getByRole('button', { name: 'Migrar' }))

    expect(mockMigrateMutate).toHaveBeenCalledWith(
      { taskId: 'task-1', destination: 'week', scheduledDate: '2026-07-10' },
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

    fireEvent.click(screen.getByRole('button', { name: 'Migrar' }))
    mockMigrateMutate.mock.calls[0][1].onSuccess()

    expect(onSuccess).toHaveBeenCalled()
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    renderDialog()
    expect(await axe(document.body)).toHaveNoViolations()
  })
})
