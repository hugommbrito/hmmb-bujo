import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { WeeklyRowOverflowMenu } from './WeeklyRowOverflowMenu'
import type { Task } from '../../types'

function task(overrides: Partial<Task> = {}): Task {
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

describe('WeeklyRowOverflowMenu — comando relativo de reordenação (Task 7, lacuna B5)', () => {
  it('Mover acima chama onReorder com o irmão ANTERIOR e position=before', () => {
    const onReorder = vi.fn()
    const siblings = [task({ id: 'a' }), task({ id: 'b' }), task({ id: 'c' })]
    render(<WeeklyRowOverflowMenu task={siblings[1]} siblings={siblings} onReorder={onReorder} />)

    fireEvent.click(screen.getByRole('button', { name: 'Reordenar tarefa' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mover acima' }))

    expect(onReorder).toHaveBeenCalledWith('b', 'a', 'before')
  })

  it('Mover abaixo chama onReorder com o irmão SEGUINTE e position=after', () => {
    const onReorder = vi.fn()
    const siblings = [task({ id: 'a' }), task({ id: 'b' }), task({ id: 'c' })]
    render(<WeeklyRowOverflowMenu task={siblings[1]} siblings={siblings} onReorder={onReorder} />)

    fireEvent.click(screen.getByRole('button', { name: 'Reordenar tarefa' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mover abaixo' }))

    expect(onReorder).toHaveBeenCalledWith('b', 'c', 'after')
  })

  it('primeiro da lista: "Mover acima" fica desabilitado (sem irmão anterior)', () => {
    const siblings = [task({ id: 'a' }), task({ id: 'b' })]
    render(<WeeklyRowOverflowMenu task={siblings[0]} siblings={siblings} onReorder={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Reordenar tarefa' }))
    expect(screen.getByRole('menuitem', { name: 'Mover acima' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('caso irmão: não sendo o primeiro, "Mover acima" fica habilitado', () => {
    const siblings = [task({ id: 'a' }), task({ id: 'b' })]
    render(<WeeklyRowOverflowMenu task={siblings[1]} siblings={siblings} onReorder={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Reordenar tarefa' }))
    expect(screen.getByRole('menuitem', { name: 'Mover acima' })).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('último da lista: "Mover abaixo" fica desabilitado (sem irmão seguinte)', () => {
    const siblings = [task({ id: 'a' }), task({ id: 'b' })]
    render(<WeeklyRowOverflowMenu task={siblings[1]} siblings={siblings} onReorder={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Reordenar tarefa' }))
    expect(screen.getByRole('menuitem', { name: 'Mover abaixo' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('"Mover para…" abre o MoveTaskDialog com os irmãos restantes', () => {
    const siblings = [task({ id: 'a', title: 'A' }), task({ id: 'b', title: 'B' }), task({ id: 'c', title: 'C' })]
    render(<WeeklyRowOverflowMenu task={siblings[0]} siblings={siblings} onReorder={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Reordenar tarefa' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mover para…' }))

    expect(screen.getByText('Acima de B')).toBeInTheDocument()
    expect(screen.getByText('Acima de C')).toBeInTheDocument()
  })
})
