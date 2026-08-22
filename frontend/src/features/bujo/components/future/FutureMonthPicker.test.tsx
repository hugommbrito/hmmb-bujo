import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { FutureMonthPicker } from './FutureMonthPicker'
import type { FutureLogMonthCount } from '../../types'

const DISTANTES: FutureLogMonthCount[] = [
  { monthFirst: '2027-06-01', taskCount: 2 },
  { monthFirst: '2027-09-01', taskCount: 1 },
  { monthFirst: '2028-01-01', taskCount: 4 },
]

describe('FutureMonthPicker (AC1/AC7)', () => {
  it('lista os meses distantes agrupados por ano, com contagem', () => {
    render(
      <FutureMonthPicker
        distant={DISTANTES}
        lastHorizonMonthFirst="2027-03-01"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByRole('heading', { name: '2027' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '2028' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Meses de 2027' }).querySelectorAll('li')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /Junho de 2027/ })).toHaveTextContent('2 itens')
    expect(screen.getByRole('button', { name: /Setembro de 2027/ })).toHaveTextContent('1 item')
  })

  it('escolher um mês distante leva o foco a ele', () => {
    const onSelect = vi.fn()
    render(
      <FutureMonthPicker
        distant={DISTANTES}
        lastHorizonMonthFirst="2027-03-01"
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Janeiro de 2028/ }))
    expect(onSelect).toHaveBeenCalledWith('2028-01-01')
  })

  it('sem mês distante nenhum mostra o estado vazio do mockup, nomeando o último mês do horizonte', () => {
    render(
      <FutureMonthPicker
        distant={[]}
        lastHorizonMonthFirst="2027-03-01"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('Nada capturado além de Março de 2027.')).toBeInTheDocument()
    expect(
      screen.getByText('Use o campo de captura com uma data para registrar mais adiante.'),
    ).toBeInTheDocument()
    // Irmã de não-vacuidade: nenhum mês listado nesse estado.
    expect(screen.queryByRole('heading', { name: '2027' })).not.toBeInTheDocument()
  })

  it('compact abre em sheet e continua listando os mesmos meses', () => {
    render(
      <FutureMonthPicker
        distant={DISTANTES}
        lastHorizonMonthFirst="2027-03-01"
        compact
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /Junho de 2027/ })).toBeInTheDocument()
  })
})

describe('FutureMonthPicker — piso de acessibilidade do overlay (AC7)', () => {
  // A superfície tem DOIS overlays, e eles não podem divergir no piso: o
  // `MonthlyDestinationPicker` já se expõe como `role="dialog"` NOMEADO
  // ("Escolher destino"). Um `aria-label` posto no componente `Dialog`/`Drawer`
  // do MUI cai no root `role="presentation"`, NÃO no elemento que carrega o
  // papel — o overlay fica anônimo (e, no `Drawer`, sem papel nenhum). É o que
  // estes dois testes travam.
  it('desktop: o overlay é um dialog NOMEADO', () => {
    render(
      <FutureMonthPicker
        distant={DISTANTES}
        lastHorizonMonthFirst="2027-03-01"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByRole('dialog', { name: 'Ir para mês' })).toBeInTheDocument()
  })

  it('compact: o sheet é o MESMO dialog nomeado (mesmo papel, outra composição)', () => {
    render(
      <FutureMonthPicker
        distant={DISTANTES}
        lastHorizonMonthFirst="2027-03-01"
        compact
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByRole('dialog', { name: 'Ir para mês' })).toBeInTheDocument()
  })

  it('Escape fecha o overlay sem trocar o mês em foco (desktop e compact)', () => {
    const onClose = vi.fn()
    const onSelect = vi.fn()
    const { rerender } = render(
      <FutureMonthPicker
        distant={DISTANTES}
        lastHorizonMonthFirst="2027-03-01"
        onSelect={onSelect}
        onClose={onClose}
      />,
    )
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    rerender(
      <FutureMonthPicker
        distant={DISTANTES}
        lastHorizonMonthFirst="2027-03-01"
        compact
        onSelect={onSelect}
        onClose={onClose}
      />,
    )
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
    // Fechar não é escolher: o foco do mês só muda por `onSelect` (AC1).
    expect(onSelect).not.toHaveBeenCalled()
  })
})
