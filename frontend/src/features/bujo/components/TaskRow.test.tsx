import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { createBujoTheme } from '../../../theme'
import { TaskRow } from './TaskRow'
import type { Task } from '../types'

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

function renderTaskRow(task: Task, onTransition = vi.fn(), onOpenDetail = vi.fn()) {
  render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <TaskRow task={task} onTransition={onTransition} onOpenDetail={onOpenDetail} />
    </ThemeProvider>,
  )
  return { onTransition, onOpenDetail }
}

describe('TaskRow (AC2)', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it('exibe o título da tarefa', () => {
    renderTaskRow(baseTask({ title: 'Consulado PT' }))
    expect(screen.getByText('Consulado PT')).toBeInTheDocument()
  })

  it('borda esquerda usa a cor da categoria', () => {
    renderTaskRow(baseTask({ category: 'teal' }))
    expect(screen.getByTestId('task-row')).toHaveStyle({ borderLeftColor: '#2BADA0' })
  })

  it('borda esquerda cai para divider quando category é null', () => {
    renderTaskRow(baseTask({ category: null }))
    expect(screen.getByTestId('task-row')).toHaveStyle({ borderLeftColor: '#DDD8CF' })
  })

  it('touch target mínimo de 44px no mobile', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(max-width: 767px)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    renderTaskRow(baseTask())

    expect(screen.getByTestId('task-row')).toHaveStyle({ minHeight: '44px' })
  })

  it('clicar no ícone pending chama onTransition com "started"', () => {
    const { onTransition } = renderTaskRow(baseTask({ status: 'pending' }))

    fireEvent.click(screen.getByRole('button', { name: 'Pendente' }))

    expect(onTransition).toHaveBeenCalledWith('task-1', 'started')
  })

  it('clicar no ícone started chama onTransition com "completed"', () => {
    const { onTransition } = renderTaskRow(baseTask({ status: 'started' }))

    fireEvent.click(screen.getByRole('button', { name: 'Em andamento' }))

    expect(onTransition).toHaveBeenCalledWith('task-1', 'completed')
  })

  it('clicar no ícone completed chama onTransition com "pending" (fecha o ciclo)', () => {
    const { onTransition } = renderTaskRow(baseTask({ status: 'completed' }))

    fireEvent.click(screen.getByRole('button', { name: 'Concluída' }))

    expect(onTransition).toHaveBeenCalledWith('task-1', 'pending')
  })

  it('ícone de migrated não é clicável', () => {
    const { onTransition } = renderTaskRow(baseTask({ status: 'migrated' }))

    const button = screen.getByRole('button', { name: 'Migrada' })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(onTransition).not.toHaveBeenCalled()
  })

  it('ícone de postponed não é clicável', () => {
    renderTaskRow(baseTask({ status: 'postponed' }))
    expect(screen.getByRole('button', { name: 'Adiada' })).toBeDisabled()
  })

  it('ícone de cancelled não é clicável e título fica tachado', () => {
    renderTaskRow(baseTask({ status: 'cancelled', title: 'Tarefa cancelada' }))

    expect(screen.getByRole('button', { name: 'Cancelada' })).toBeDisabled()
    expect(screen.getByText('Tarefa cancelada')).toHaveStyle({ textDecoration: 'line-through' })
  })

  it('chip Eisenhower omitido quando eisenhower é null', () => {
    renderTaskRow(baseTask({ eisenhower: null }))
    expect(screen.queryByText('U+I')).not.toBeInTheDocument()
  })

  it('chip Eisenhower omitido quando eisenhower é "none"', () => {
    renderTaskRow(baseTask({ eisenhower: 'none' }))
    expect(screen.queryByText('—')).not.toBeInTheDocument()
    expect(screen.queryByText('U+I')).not.toBeInTheDocument()
  })

  it('chip Eisenhower "U+I" exibido quando eisenhower é "ui"', () => {
    renderTaskRow(baseTask({ eisenhower: 'ui' }))
    expect(screen.getByText('U+I')).toBeInTheDocument()
  })

  it('chip de status "Iniciada" exibido para started', () => {
    renderTaskRow(baseTask({ status: 'started' }))
    expect(screen.getByText('Iniciada')).toBeInTheDocument()
  })

  it('chip de status "Feita" exibido para completed', () => {
    renderTaskRow(baseTask({ status: 'completed' }))
    expect(screen.getByText('Feita')).toBeInTheDocument()
  })

  it('nenhum chip de status para pending', () => {
    renderTaskRow(baseTask({ status: 'pending' }))
    expect(screen.queryByText('Iniciada')).not.toBeInTheDocument()
    expect(screen.queryByText('Feita')).not.toBeInTheDocument()
  })

  it('anuncia o novo estado após o clique (aria-live)', () => {
    renderTaskRow(baseTask({ status: 'pending' }))

    fireEvent.click(screen.getByRole('button', { name: 'Pendente' }))

    expect(screen.getByRole('status')).toHaveTextContent('Tarefa marcada como Em andamento')
  })

  it('clique no título chama onOpenDetail com o id da tarefa (AC2)', () => {
    const { onOpenDetail } = renderTaskRow(baseTask({ id: 'task-42' }))

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes de Finalizar relatório Q2' }))

    expect(onOpenDetail).toHaveBeenCalledWith('task-42')
  })

  it('subtarefas em task.subtasks renderizam como linhas aninhadas com indentação (AC3)', () => {
    renderTaskRow(
      baseTask({
        subtasks: [
          { id: 'sub-1', title: 'Subtarefa 1', status: 'pending', subtasks: [] },
          { id: 'sub-2', title: 'Subtarefa 2', status: 'completed', subtasks: [] },
        ],
      }),
    )

    expect(screen.getByText('Subtarefa 1')).toBeInTheDocument()
    expect(screen.getByText('Subtarefa 2')).toBeInTheDocument()
    expect(screen.getAllByTestId('task-row')).toHaveLength(3)
  })

  it('ciclar o status de uma subtarefa não afeta o pai (AC3, sem cascata)', () => {
    const { onTransition } = renderTaskRow(
      baseTask({
        id: 'parent-1',
        subtasks: [{ id: 'sub-1', title: 'Subtarefa 1', status: 'pending', subtasks: [] }],
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes de Subtarefa 1' }))
    // A busca acima só confirma que a subtarefa é independente na árvore; o
    // clique de transição usa o mesmo ícone de status do pai e da subtarefa —
    // aqui garantimos que cada um dispara `onTransition` com o seu próprio id.
    const statusButtons = screen.getAllByRole('button', { name: 'Pendente' })
    fireEvent.click(statusButtons[1])

    expect(onTransition).toHaveBeenCalledWith('sub-1', 'started')
    expect(onTransition).not.toHaveBeenCalledWith('parent-1', expect.anything())
  })
})
