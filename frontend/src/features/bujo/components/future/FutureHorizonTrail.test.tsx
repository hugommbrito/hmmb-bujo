import { fireEvent, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'

import { FutureHorizonTrail } from './FutureHorizonTrail'
import type { FutureLogMonthCount } from '../../types'

const HORIZONTE: FutureLogMonthCount[] = [
  { monthFirst: '2026-08-01', taskCount: 3 },
  { monthFirst: '2026-09-01', taskCount: 1 },
  { monthFirst: '2026-10-01', taskCount: 1 },
  { monthFirst: '2026-11-01', taskCount: 0 },
  { monthFirst: '2026-12-01', taskCount: 2 },
  { monthFirst: '2027-01-01', taskCount: 2 },
  { monthFirst: '2027-02-01', taskCount: 0 },
  { monthFirst: '2027-03-01', taskCount: 1 },
]

describe('FutureHorizonTrail — desktop (AC1/AC7)', () => {
  it('renderiza os 8 meses INCLUSIVE os vazios, com contagem em texto', () => {
    render(
      <FutureHorizonTrail
        months={HORIZONTE}
        focusedMonthFirst="2026-08-01"
        onSelect={vi.fn()}
        onOpenMonthPicker={vi.fn()}
      />,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(8)
    // Novembro tem 0 itens e MESMO ASSIM aparece, com o "0 itens" escrito.
    expect(screen.getByRole('button', { name: /Novembro de 2026/ })).toHaveTextContent('0 itens')
    expect(screen.getByRole('button', { name: /Agosto de 2026/ })).toHaveTextContent('3 itens')
    expect(screen.getByRole('button', { name: /Março de 2027/ })).toHaveTextContent('1 item')
  })

  it('o trilho é um nav com nome acessível e o mês em foco recebe aria-current', () => {
    render(
      <FutureHorizonTrail
        months={HORIZONTE}
        focusedMonthFirst="2026-10-01"
        onSelect={vi.fn()}
        onOpenMonthPicker={vi.fn()}
      />,
    )
    expect(screen.getByRole('navigation', { name: 'Meses do horizonte' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Outubro de 2026/ })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: /Agosto de 2026/ })).not.toHaveAttribute('aria-current')
  })

  it('foco num mês DISTANTE deixa o trilho sem nenhuma linha selecionada', () => {
    render(
      <FutureHorizonTrail
        months={HORIZONTE}
        focusedMonthFirst="2028-01-01"
        onSelect={vi.fn()}
        onOpenMonthPicker={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { current: true })).not.toBeInTheDocument()
    // ...e as 8 linhas continuam lá (o trilho não cresce nem encolhe).
    expect(screen.getAllByRole('listitem')).toHaveLength(8)
  })

  it('clicar numa linha troca o foco', () => {
    const onSelect = vi.fn()
    render(
      <FutureHorizonTrail
        months={HORIZONTE}
        focusedMonthFirst="2026-08-01"
        onSelect={onSelect}
        onOpenMonthPicker={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Dezembro de 2026/ }))
    expect(onSelect).toHaveBeenCalledWith('2026-12-01')
  })

  it('"Ir para mês…" vive no pé do trilho', () => {
    const onOpenMonthPicker = vi.fn()
    render(
      <FutureHorizonTrail
        months={HORIZONTE}
        focusedMonthFirst="2026-08-01"
        onSelect={vi.fn()}
        onOpenMonthPicker={onOpenMonthPicker}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ir para mês…' }))
    expect(onOpenMonthPicker).toHaveBeenCalled()
  })

  it('não tem violações de axe', async () => {
    const { container } = render(
      <FutureHorizonTrail
        months={HORIZONTE}
        focusedMonthFirst="2026-08-01"
        onSelect={vi.fn()}
        onOpenMonthPicker={vi.fn()}
      />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('FutureHorizonTrail — compact (AC1)', () => {
  it('vira barra de meses rolável, cada um anunciando mês + ano + contagem', () => {
    render(
      <FutureHorizonTrail
        months={HORIZONTE}
        focusedMonthFirst="2026-08-01"
        compact
        onSelect={vi.fn()}
        onOpenMonthPicker={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Agosto de 2026, 3 itens' })).toBeInTheDocument()
    // O mês vazio também está na barra (mesma regra do desktop).
    expect(screen.getByRole('button', { name: 'Novembro de 2026, 0 itens' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ir para mês…' })).toBeInTheDocument()
  })

  it('compact também marca aria-current no mês em foco', () => {
    render(
      <FutureHorizonTrail
        months={HORIZONTE}
        focusedMonthFirst="2026-09-01"
        compact
        onSelect={vi.fn()}
        onOpenMonthPicker={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Setembro de 2026, 1 item' })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  it('não tem violações de axe em compact', async () => {
    const { container } = render(
      <FutureHorizonTrail
        months={HORIZONTE}
        focusedMonthFirst="2026-08-01"
        compact
        onSelect={vi.fn()}
        onOpenMonthPicker={vi.fn()}
      />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
