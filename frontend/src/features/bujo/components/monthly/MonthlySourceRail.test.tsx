import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MonthlySourceRail, type MonthlySourceRailEntry } from './MonthlySourceRail'

const ENTRIES: MonthlySourceRailEntry[] = [
  { sourceId: 'recurring', pendingCount: 3, isLoading: false, isError: false },
  { sourceId: 'future-log', pendingCount: 2, isLoading: false, isError: false },
  { sourceId: 'previous-monthly', pendingCount: 0, subtitle: 'Bloqueia iniciar mês', isLoading: false, isError: false },
]

describe('MonthlySourceRail — as 3 fontes em ordem fixa (AC5)', () => {
  it('renderiza as 3 fontes na ordem Recorrentes → Future Log → Monthly anterior', () => {
    render(<MonthlySourceRail entries={ENTRIES} activeSourceId="recurring" onSelect={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual([
      expect.stringContaining('Recorrentes'),
      expect.stringContaining('Future Log'),
      expect.stringContaining('Monthly anterior'),
    ])
  })

  it('a fonte ativa recebe aria-current', () => {
    render(<MonthlySourceRail entries={ENTRIES} activeSourceId="future-log" onSelect={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Future Log/ })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: /Recorrentes/ })).not.toHaveAttribute('aria-current')
  })

  it('onSelect dispara com o sourceId clicado', () => {
    const onSelect = vi.fn()
    render(<MonthlySourceRail entries={ENTRIES} activeSourceId="recurring" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /Monthly anterior/ }))
    expect(onSelect).toHaveBeenCalledWith('previous-monthly')
  })

  it('fonte em erro mostra "erro" no lugar da contagem', () => {
    const entries = [{ ...ENTRIES[0], isError: true, pendingCount: 3 }]
    render(<MonthlySourceRail entries={entries} activeSourceId="recurring" onSelect={vi.fn()} />)
    expect(screen.getByText('erro')).toBeInTheDocument()
  })
})
