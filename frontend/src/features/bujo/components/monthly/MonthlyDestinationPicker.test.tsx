import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MonthlyDestinationPicker } from './MonthlyDestinationPicker'

describe('MonthlyDestinationPicker — calendário + entrada direta (AC5)', () => {
  it('mostra 31 gridcells para agosto (mês de 31 dias)', () => {
    render(<MonthlyDestinationPicker targetMonthFirst="2026-08-01" onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getAllByRole('gridcell')).toHaveLength(31)
  })

  it('fevereiro bissexto mostra 29 gridcells', () => {
    render(<MonthlyDestinationPicker targetMonthFirst="2028-02-01" onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getAllByRole('gridcell')).toHaveLength(29)
  })

  it('clicar num dia arma o destino e mostra a confirmação nomeada', () => {
    render(<MonthlyDestinationPicker targetMonthFirst="2026-08-01" onConfirm={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('gridcell', { name: '18' }))
    expect(screen.getByText('Migrar para 18 de agosto')).toBeInTheDocument()
  })

  it('setas navegam dia a dia a partir do dia armado', () => {
    render(<MonthlyDestinationPicker targetMonthFirst="2026-08-01" onConfirm={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('gridcell', { name: '18' }))
    fireEvent.click(screen.getByRole('button', { name: 'Próximo dia' }))
    expect(screen.getByLabelText('Número do dia')).toHaveValue(19)
  })

  it('entrada direta do número do dia sincroniza com o calendário', () => {
    render(<MonthlyDestinationPicker targetMonthFirst="2026-08-01" onConfirm={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Número do dia'), { target: { value: '20' } })
    expect(screen.getByRole('gridcell', { name: '20' })).toHaveAttribute('aria-current', 'true')
  })

  it('"Sem dia definido" é opção explícita e confirma com null', () => {
    const onConfirm = vi.fn()
    render(<MonthlyDestinationPicker targetMonthFirst="2026-08-01" onConfirm={onConfirm} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sem dia definido' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(onConfirm).toHaveBeenCalledWith(null)
  })

  it('confirma com a data ISO correta do dia escolhido', () => {
    const onConfirm = vi.fn()
    render(<MonthlyDestinationPicker targetMonthFirst="2026-08-01" onConfirm={onConfirm} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('gridcell', { name: '18' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(onConfirm).toHaveBeenCalledWith('2026-08-18')
  })

  it('Enter confirma a ação final nomeada', () => {
    const onConfirm = vi.fn()
    render(<MonthlyDestinationPicker targetMonthFirst="2026-08-01" onConfirm={onConfirm} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('gridcell', { name: '18' }))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' })
    expect(onConfirm).toHaveBeenCalledWith('2026-08-18')
  })

  it('Escape fecha o seletor', () => {
    const onClose = vi.fn()
    render(<MonthlyDestinationPicker targetMonthFirst="2026-08-01" onConfirm={vi.fn()} onClose={onClose} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('erro preservado é exibido e o seletor permanece armado', () => {
    render(
      <MonthlyDestinationPicker
        targetMonthFirst="2026-08-01"
        error="Não foi possível migrar a tarefa. Tente novamente."
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível migrar a tarefa.')
  })
})
