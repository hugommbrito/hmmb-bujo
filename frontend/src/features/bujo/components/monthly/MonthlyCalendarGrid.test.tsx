import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { MonthlyCalendarGrid } from './MonthlyCalendarGrid'
import { lastDayOfMonth } from '../../../../shared/date'
import type { Task } from '../../types'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't-1',
    title: 'Tarefa',
    status: 'pending',
    eisenhower: null,
    category: null,
    subtasks: [],
    ...overrides,
  }
}

function renderGrid(overrides: Partial<Parameters<typeof MonthlyCalendarGrid>[0]> = {}) {
  return render(
    <MemoryRouter>
      <MonthlyCalendarGrid
        monthFirst="2026-08-01"
        tasksByDate={new Map()}
        todayIso={null}
        cycleStatus="active"
        readonly={false}
        onOpenDetail={vi.fn()}
        {...overrides}
      />
    </MemoryRouter>,
  )
}

describe('MonthlyCalendarGrid — composição da grade (AC1/AC7)', () => {
  it('role="grid" nomeado com o mês por extenso', () => {
    renderGrid()
    expect(screen.getByRole('grid', { name: /Agosto de 2026/ })).toBeInTheDocument()
  })

  it('7 columnheaders (SEG…DOM)', () => {
    renderGrid()
    expect(screen.getAllByRole('columnheader')).toHaveLength(7)
  })

  it('todos os dias do mês (inclusive vazios) aparecem como gridcells interativos', () => {
    renderGrid()
    const total = lastDayOfMonth('2026-08-01')
    // Cada dia in-month vira um <MonthlyDayCell> com link "Abrir Daily Log de ...".
    const links = screen.getAllByRole('link', { name: /Abrir Daily Log de/ })
    expect(links).toHaveLength(total)
  })

  it('dias fora do mês aparecem como texto, sem link/botão (não-interativos)', () => {
    renderGrid()
    // Agosto de 2026 começa numa faixa que inclui dias de julho antes do dia 1.
    const gridcells = screen.getAllByRole('gridcell')
    const linkCells = screen.getAllByRole('link', { name: /Abrir Daily Log de/ })
    expect(gridcells.length).toBeGreaterThan(linkCells.length)
  })

  it('tarefa agrupada por scheduledDate aparece SÓ na própria célula', () => {
    const tasksByDate = new Map([
      ['2026-08-12', [task({ id: 'a', title: 'Consulta' })]],
    ])
    renderGrid({ tasksByDate })
    const cell = screen.getByRole('link', { name: /Abrir Daily Log de 12 de agosto de 2026/ }).closest(
      '[data-date]',
    ) as HTMLElement
    expect(within(cell).getByText('Consulta')).toBeInTheDocument()
    const otherCell = screen
      .getByRole('link', { name: /Abrir Daily Log de 13 de agosto de 2026/ })
      .closest('[data-date]') as HTMLElement
    expect(within(otherCell).queryByText('Consulta')).not.toBeInTheDocument()
  })

  it('today: só a célula com data igual a todayIso recebe o contorno --ds-info', () => {
    renderGrid({ todayIso: '2026-08-12' })
    const cell = screen.getByRole('link', { name: /Abrir Daily Log de 12 de agosto de 2026/ }).closest(
      '[data-date]',
    ) as HTMLElement
    expect(cell).toHaveStyle({ outline: '2px solid var(--ds-info)' })
    const otherCell = screen
      .getByRole('link', { name: /Abrir Daily Log de 13 de agosto de 2026/ })
      .closest('[data-date]') as HTMLElement
    expect(otherCell).toHaveStyle({ outline: 'none' })
  })

  it('onCreate recebe a data do dia clicado', () => {
    const onCreate = vi.fn()
    renderGrid({ onCreate })
    const cell = screen
      .getByRole('link', { name: /Abrir Daily Log de 12 de agosto de 2026/ })
      .closest('[data-date]') as HTMLElement
    const input = within(cell).getByLabelText('Título')
    fireEvent.change(input, { target: { value: 'Nova' } })
    fireEvent.click(within(cell).getByRole('button', { name: 'Adicionar' }))
    expect(onCreate).toHaveBeenCalledWith('2026-08-12', 'Nova')
  })

  it('readonly: nenhuma célula in-month expõe formulário de criação', () => {
    renderGrid({ readonly: true, onCreate: vi.fn() })
    expect(screen.queryAllByLabelText('Título')).toHaveLength(0)
  })
})
