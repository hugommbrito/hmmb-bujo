import { fireEvent, render, screen, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { WeeklyTaskPanel } from './WeeklyTaskPanel'
import type { Task } from '../../types'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Tarefa',
    status: 'pending',
    eisenhower: null,
    category: null,
    subtasks: [],
    migrationTarget: null,
    ...overrides,
  }
}

describe('WeeklyTaskPanel — anatomia (AC1)', () => {
  it('renderiza region com nome acessível completo', () => {
    render(
      <WeeklyTaskPanel
        regionLabel="Segunda-feira, 20 de julho"
        heading="Segunda"
        subheading="20 jul."
        tasks={[]}
        cycleStatus="active"
        createPlaceholder="＋ Adicionar tarefa…"
        onOpenDetail={vi.fn()}
      />,
    )
    expect(screen.getByRole('region', { name: 'Segunda-feira, 20 de julho' })).toBeInTheDocument()
  })

  it('o cabeçalho do painel é um heading semântico (contrato de E2E, AC9)', () => {
    render(
      <WeeklyTaskPanel
        regionLabel="Sem dia definido"
        heading="Sem dia definido"
        tasks={[]}
        cycleStatus="active"
        createPlaceholder="＋ Adicionar sem data…"
        onOpenDetail={vi.fn()}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Sem dia definido' })).toBeInTheDocument()
  })

  it('renderiza mesmo VAZIO (o pool nunca é condicional)', () => {
    render(
      <WeeklyTaskPanel
        regionLabel="Sem dia definido"
        heading="Sem dia definido"
        subheading="pool semanal"
        tasks={[]}
        cycleStatus="active"
        createPlaceholder="＋ Adicionar sem data…"
        onOpenDetail={vi.fn()}
      />,
    )
    expect(screen.getByRole('region', { name: 'Sem dia definido' })).toBeInTheDocument()
    expect(screen.getByText('Nenhuma tarefa.')).toBeInTheDocument()
  })

  it('caso irmão: com tarefas, a lista aparece e "Nenhuma tarefa." some', () => {
    render(
      <WeeklyTaskPanel
        regionLabel="Segunda"
        heading="Segunda"
        tasks={[task({ title: 'Rever contrato' })]}
        cycleStatus="active"
        createPlaceholder="＋ Adicionar tarefa…"
        onOpenDetail={vi.fn()}
      />,
    )
    expect(screen.getByText('Rever contrato')).toBeInTheDocument()
    expect(screen.queryByText('Nenhuma tarefa.')).not.toBeInTheDocument()
  })

  it('contagem "N abertas" exclui terminais', () => {
    render(
      <WeeklyTaskPanel
        regionLabel="Segunda"
        heading="Segunda"
        tasks={[
          task({ id: '1', status: 'pending' }),
          task({ id: '2', status: 'completed' }),
          task({ id: '3', status: 'started' }),
        ]}
        cycleStatus="active"
        createPlaceholder="＋ Adicionar tarefa…"
        onOpenDetail={vi.fn()}
      />,
    )
    expect(screen.getByText('2 abertas')).toBeInTheDocument()
  })

  it('link do cabeçalho do dia e a Task Row abrem alvos SEPARADOS', () => {
    const onOpenDetail = vi.fn()
    render(
      <MemoryRouter>
        <WeeklyTaskPanel
          regionLabel="Segunda-feira, 20 de julho"
          heading="Segunda"
          dayLinkHref="/daily/2026-07-20"
          tasks={[task({ title: 'Tarefa X' })]}
          cycleStatus="active"
          createPlaceholder="＋ Adicionar tarefa…"
          onOpenDetail={onOpenDetail}
        />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: 'Segunda' })
    expect(link).toHaveAttribute('href', '/daily/2026-07-20')
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes de Tarefa X' }))
    expect(onOpenDetail).toHaveBeenCalledWith('task-1')
  })
})

describe('WeeklyTaskPanel — criação contextual (AC1/AC7)', () => {
  beforeEach(() => vi.resetAllMocks())

  it('formulário escopado ao painel com Título/Adicionar preservados do legado', () => {
    const onCreate = vi.fn()
    render(
      <WeeklyTaskPanel
        regionLabel="Segunda-feira, 20 de julho"
        heading="Segunda"
        tasks={[]}
        cycleStatus="active"
        createPlaceholder="＋ Adicionar tarefa…"
        onOpenDetail={vi.fn()}
        onCreate={onCreate}
      />,
    )
    const form = screen.getByRole('form', { name: 'Adicionar tarefa em Segunda-feira, 20 de julho' })
    const input = within(form).getByLabelText('Título')
    fireEvent.change(input, { target: { value: 'Nova tarefa' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Adicionar' }))
    expect(onCreate).toHaveBeenCalledWith('Nova tarefa')
  })

  it('Enter no campo Título também cria', () => {
    const onCreate = vi.fn()
    render(
      <WeeklyTaskPanel
        regionLabel="Sem dia definido"
        heading="Sem dia definido"
        tasks={[]}
        cycleStatus="active"
        createPlaceholder="＋ Adicionar sem data…"
        onOpenDetail={vi.fn()}
        onCreate={onCreate}
      />,
    )
    const input = screen.getByLabelText('Título')
    fireEvent.change(input, { target: { value: 'Via Enter' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCreate).toHaveBeenCalledWith('Via Enter')
  })

  it('sem onCreate (readonly), o formulário não é renderizado', () => {
    render(
      <WeeklyTaskPanel
        regionLabel="Segunda"
        heading="Segunda"
        tasks={[]}
        cycleStatus="finalized"
        readonly
        createPlaceholder="＋ Adicionar tarefa…"
        onOpenDetail={vi.fn()}
      />,
    )
    expect(screen.queryByLabelText('Título')).not.toBeInTheDocument()
  })
})

describe('WeeklyTaskPanel — jest-axe', () => {
  it('sem violações de acessibilidade', async () => {
    const { container } = render(
      <WeeklyTaskPanel
        regionLabel="Segunda-feira, 20 de julho"
        heading="Segunda"
        subheading="20 jul."
        tasks={[task()]}
        cycleStatus="active"
        createPlaceholder="＋ Adicionar tarefa…"
        onOpenDetail={vi.fn()}
        onCreate={vi.fn()}
      />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
