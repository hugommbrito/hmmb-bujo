import { fireEvent, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
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

describe('MonthlyDestinationPicker — extensões aditivas do M08 (Story 14.7, AC4/AC5)', () => {
  const HORIZONTE = ['2026-08-01', '2026-09-01', '2027-06-01']

  it('sem selectableMonths NÃO existe aba "Outro mês" (composição da 14.6 intacta)', () => {
    render(<MonthlyDestinationPicker targetMonthFirst="2026-08-01" onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Outro mês' })).not.toBeInTheDocument()
  })

  it('com selectableMonths a aba "Outro mês" lista os meses e retarga a grade', () => {
    const onTargetMonthChange = vi.fn()
    render(
      <MonthlyDestinationPicker
        targetMonthFirst="2026-08-01"
        selectableMonths={HORIZONTE}
        onTargetMonthChange={onTargetMonthChange}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Outro mês' }))
    expect(screen.getAllByRole('option')).toHaveLength(3)
    fireEvent.click(screen.getByRole('option', { name: 'Setembro de 2026' }))
    expect(onTargetMonthChange).toHaveBeenCalledWith('2026-09-01')
  })

  it('a aba "Outro mês" esconde a grade de dias e "Dia em <mês>" a traz de volta', () => {
    render(
      <MonthlyDestinationPicker
        targetMonthFirst="2026-08-01"
        selectableMonths={HORIZONTE}
        onTargetMonthChange={vi.fn()}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getAllByRole('gridcell')).toHaveLength(31)
    fireEvent.click(screen.getByRole('tab', { name: 'Outro mês' }))
    expect(screen.queryByRole('gridcell')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Dia em agosto' }))
    expect(screen.getAllByRole('gridcell')).toHaveLength(31)
  })

  it('trocar o mês-alvo DESCARTA o dia armado (o componente não remonta)', () => {
    const { rerender } = render(
      <MonthlyDestinationPicker
        targetMonthFirst="2026-08-01"
        selectableMonths={HORIZONTE}
        onTargetMonthChange={vi.fn()}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('gridcell', { name: '31' }))
    expect(screen.getByLabelText('Número do dia')).toHaveValue(31)

    rerender(
      <MonthlyDestinationPicker
        targetMonthFirst="2026-09-01"
        selectableMonths={HORIZONTE}
        onTargetMonthChange={vi.fn()}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    // Setembro tem 30 dias: um "31" sobrevivente seria um destino impossível.
    expect(screen.getByLabelText('Número do dia')).toHaveValue(null)
    expect(screen.getAllByRole('gridcell')).toHaveLength(30)
  })

  it('confirmLabelFor nomeia o PRÓPRIO botão por ato — nunca um "Confirmar" genérico', () => {
    const onConfirm = vi.fn()
    render(
      <MonthlyDestinationPicker
        targetMonthFirst="2026-08-01"
        confirmLabelFor={({ scheduledDate }) =>
          scheduledDate ? `Datar em ${Number(scheduledDate.slice(8))} de agosto` : 'Manter sem dia definido'
        }
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('gridcell', { name: '14' }))
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Datar em 14 de agosto' }))
    expect(onConfirm).toHaveBeenCalledWith('2026-08-14')
  })

  it('confirmLabelFor nomeia também o ato "manter sem dia"', () => {
    const onConfirm = vi.fn()
    render(
      <MonthlyDestinationPicker
        targetMonthFirst="2026-08-01"
        confirmLabelFor={({ scheduledDate }) => (scheduledDate ? 'Datar' : 'Manter sem dia definido')}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Sem dia definido' }))
    fireEvent.click(screen.getByRole('button', { name: 'Manter sem dia definido' }))
    expect(onConfirm).toHaveBeenCalledWith(null)
  })
})

// A 14.6 nunca mediu este componente ABERTO e deixou passar um
// `aria-required-children` CRITICAL (`role="grid"` sem `role="row"`), que só o
// gate de 5 faixas da 14.7 pegou — no browser, tarde. Estes dois casos põem a
// mesma medição no ciclo rápido, e cobrem as DUAS composições: a grade de dias
// (14.6) e a estrutura ARIA que a 14.7 acrescentou (`tablist`/`tab` +
// `listbox`/`option`), que nenhuma faixa de axe media na aba aberta.
describe('MonthlyDestinationPicker — piso de acessibilidade nas duas abas (code review 14.7)', () => {
  const HORIZONTE = ['2026-08-01', '2026-09-01', '2027-06-01']

  it('não tem violações de axe na grade de dias', async () => {
    const { container } = render(
      <MonthlyDestinationPicker
        targetMonthFirst="2026-08-01"
        selectableMonths={HORIZONTE}
        onTargetMonthChange={vi.fn()}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('não tem violações de axe na aba "Outro mês" aberta', async () => {
    const { container } = render(
      <MonthlyDestinationPicker
        targetMonthFirst="2026-08-01"
        selectableMonths={HORIZONTE}
        onTargetMonthChange={vi.fn()}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Outro mês' }))
    expect(screen.getByRole('listbox', { name: 'Meses de destino' })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })
})
