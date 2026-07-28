import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { MonthlyDayCell } from './MonthlyDayCell'
import type { Task } from '../../types'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't-1',
    title: 'Tarefa',
    status: 'pending',
    eisenhower: null,
    category: null,
    subtasks: [],
    migrationTarget: null,
    ...overrides,
  }
}

function renderCell(overrides: Partial<Parameters<typeof MonthlyDayCell>[0]> = {}) {
  return render(
    <MemoryRouter>
      <MonthlyDayCell
        date="2026-08-12"
        dayNumberLabel="12"
        fullDateLabel="12 de agosto de 2026"
        dayMonthLabel="12 de agosto"
        tasks={[]}
        cycleStatus="active"
        onOpenDetail={vi.fn()}
        {...overrides}
      />
    </MemoryRouter>,
  )
}

describe('MonthlyDayCell — contagem textual (AC1)', () => {
  it('"vazio" quando não há tarefas', () => {
    renderCell({ tasks: [] })
    expect(screen.getByText('vazio')).toBeInTheDocument()
  })

  it('"N abertas" quando nenhuma tarefa está em estado terminal', () => {
    renderCell({ tasks: [task({ id: 'a', status: 'pending' }), task({ id: 'b', status: 'started' })] })
    expect(screen.getByText('2 abertas')).toBeInTheDocument()
  })

  it('singular "1 aberta" para uma única tarefa não-terminal', () => {
    renderCell({ tasks: [task({ id: 'a', status: 'pending' })] })
    expect(screen.getByText('1 aberta')).toBeInTheDocument()
  })

  it('"N registros" quando a célula mistura ao menos um estado terminal', () => {
    renderCell({
      tasks: [task({ id: 'a', status: 'pending' }), task({ id: 'b', status: 'completed' })],
    })
    expect(screen.getByText('2 registros')).toBeInTheDocument()
  })

  it('singular "1 registro" para uma única tarefa terminal', () => {
    renderCell({ tasks: [task({ id: 'a', status: 'completed' })] })
    expect(screen.getByText('1 registro')).toBeInTheDocument()
  })
})

describe('MonthlyDayCell — cabeçalho e região de tarefas (AC1/AC7)', () => {
  it('o número do dia abre o Daily Log com aria-label de data completa', () => {
    renderCell()
    const link = screen.getByRole('link', { name: 'Abrir Daily Log de 12 de agosto de 2026' })
    expect(link).toHaveAttribute('href', '/daily/2026-08-12')
  })

  it('a região de tarefas expõe tabIndex=0 e aria-label com quantidade + instrução quando há tarefas', () => {
    renderCell({ tasks: [task({ id: 'a' })] })
    const region = screen.getByLabelText('1 tarefa em 12 de agosto; use as setas para rolar')
    expect(region).toHaveAttribute('tabindex', '0')
  })

  it('sem tarefas, a região de rolagem não recebe tabIndex nem aria-label', () => {
    renderCell({ tasks: [] })
    expect(screen.queryByLabelText(/use as setas para rolar/)).not.toBeInTheDocument()
  })

  it('today: contorno --ds-info aplicado via outline', () => {
    renderCell({ isToday: true })
    const cell = screen.getByRole('gridcell')
    expect(cell).toHaveStyle({ outline: '2px solid var(--ds-info)' })
  })
})

describe('MonthlyDayCell — criação contextual (AC1)', () => {
  it('onCreate dispara com o título digitado e limpa o rascunho', () => {
    const onCreate = vi.fn()
    renderCell({ onCreate })
    const input = screen.getByLabelText('Título')
    fireEvent.change(input, { target: { value: 'Nova tarefa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    expect(onCreate).toHaveBeenCalledWith('Nova tarefa')
    expect(input).toHaveValue('')
  })

  it('título em branco não dispara onCreate', () => {
    const onCreate = vi.fn()
    renderCell({ onCreate })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('readonly: formulário de criação ausente do DOM mesmo com onCreate presente', () => {
    renderCell({ onCreate: vi.fn(), readonly: true })
    expect(screen.queryByLabelText('Título')).not.toBeInTheDocument()
  })

  it('sem onCreate: formulário ausente (mês sem handler de criação, ex. leitura de outro mês)', () => {
    renderCell()
    expect(screen.queryByLabelText('Título')).not.toBeInTheDocument()
  })
})

describe('MonthlyDayCell — variant compact da TaskRowBase (AC2)', () => {
  it('renderiza as tarefas com data-testid de Task Row (compact, sem chip de ordem)', () => {
    renderCell({ tasks: [task({ id: 'a', title: 'Revisar' })] })
    const row = screen.getByTestId('task-row')
    expect(within(row).getByText('Revisar')).toBeInTheDocument()
  })
})
