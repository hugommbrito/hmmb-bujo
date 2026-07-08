import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'
import { createBujoTheme } from '../../../theme'
import { MoveTaskDialog } from './MoveTaskDialog'
import type { Task } from '../types'

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'task-1',
    title: 'Tarefa',
    status: 'pending',
    eisenhower: null,
    category: null,
    subtasks: [],
    ...overrides,
  }
}

function renderDialog({
  task = makeTask({ id: 'task-1', title: 'Revisar PR' }),
  siblings = [
    task,
    makeTask({ id: 'task-2', title: 'Escrever testes' }),
    makeTask({ id: 'task-3', title: 'Fazer deploy' }),
  ],
  onMove = vi.fn(),
  onClose = vi.fn(),
}: {
  task?: Task
  siblings?: Task[]
  onMove?: (targetTaskId: string, position: 'before' | 'after') => void
  onClose?: () => void
} = {}) {
  const utils = render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <MoveTaskDialog task={task} siblings={siblings} open onMove={onMove} onClose={onClose} />
    </ThemeProvider>,
  )
  return { ...utils, task, onMove, onClose }
}

describe('MoveTaskDialog', () => {
  it('renderiza a lista de irmãos excluindo a própria tarefa', () => {
    renderDialog()

    expect(screen.getByText('Acima de Escrever testes')).toBeInTheDocument()
    expect(screen.getByText('Abaixo de Escrever testes')).toBeInTheDocument()
    expect(screen.getByText('Acima de Fazer deploy')).toBeInTheDocument()
    expect(screen.queryByText('Acima de Revisar PR')).not.toBeInTheDocument()
  })

  it('clicar "Acima de X" chama onMove(x.id, "before")', () => {
    const { onMove } = renderDialog()

    fireEvent.click(screen.getByText('Acima de Escrever testes'))

    expect(onMove).toHaveBeenCalledWith('task-2', 'before')
  })

  it('clicar "Abaixo de Y" chama onMove(y.id, "after")', () => {
    const { onMove } = renderDialog()

    fireEvent.click(screen.getByText('Abaixo de Fazer deploy'))

    expect(onMove).toHaveBeenCalledWith('task-3', 'after')
  })

  it('mostra mensagem de lista vazia quando não há outra tarefa', () => {
    const task = makeTask({ id: 'task-1', title: 'Única' })
    renderDialog({ task, siblings: [task] })

    expect(screen.getByText('Nenhuma outra tarefa para reordenar')).toBeInTheDocument()
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    const { container } = renderDialog()

    expect(await axe(container)).toHaveNoViolations()
  })
})
