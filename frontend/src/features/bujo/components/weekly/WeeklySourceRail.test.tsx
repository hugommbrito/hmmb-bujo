import { fireEvent, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'

import { WeeklySourceRail, type WeeklySourceRailEntry } from './WeeklySourceRail'
import { WEEKLY_RITUAL_SOURCE_ORDER } from './weeklyRitualSources'

function entries(overrides: Partial<Record<string, Partial<WeeklySourceRailEntry>>> = {}) {
  return WEEKLY_RITUAL_SOURCE_ORDER.map((sourceId) => ({
    sourceId,
    pendingCount: 3,
    isLoading: false,
    isError: false,
    ...overrides[sourceId],
  }))
}

describe('WeeklySourceRail — as 5 fontes na ordem fixa (AC5)', () => {
  it('renderiza um <nav aria-label="Fontes do planejamento"> com as 5 fontes na ordem', () => {
    render(<WeeklySourceRail entries={entries()} activeSourceId="monthly-in-week" onSelect={vi.fn()} />)
    const nav = screen.getByRole('navigation', { name: 'Fontes do planejamento' })
    const labels = ['Monthly na semana', 'Monthly ampliado', 'Recorrentes', 'Weekly anterior', 'Daily pendentes']
    for (const label of labels) {
      expect(nav).toHaveTextContent(label)
    }
  })

  it('"Monthly ampliado" mostra "opcional", SEM número', () => {
    render(<WeeklySourceRail entries={entries()} activeSourceId="monthly-in-week" onSelect={vi.fn()} />)
    const button = screen.getByRole('button', { name: /Monthly ampliado/ })
    expect(button).toHaveTextContent('opcional')
    expect(button).not.toHaveTextContent('3')
  })

  it('clicar numa fonte chama onSelect com o sourceId', () => {
    const onSelect = vi.fn()
    render(<WeeklySourceRail entries={entries()} activeSourceId="monthly-in-week" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /Recorrentes/ }))
    expect(onSelect).toHaveBeenCalledWith('recurring')
  })

  it('a fonte ativa tem aria-current', () => {
    render(<WeeklySourceRail entries={entries()} activeSourceId="recurring" onSelect={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Recorrentes/ })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: /Monthly na semana/ })).not.toHaveAttribute('aria-current')
  })

  it('fonte carregando tem aria-busy — as outras NÃO ficam desabilitadas', () => {
    const onSelect = vi.fn()
    render(
      <WeeklySourceRail
        entries={entries({ 'previous-weekly': { isLoading: true } })}
        activeSourceId="monthly-in-week"
        onSelect={onSelect}
      />,
    )
    expect(screen.getByRole('button', { name: /Weekly anterior/ })).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(screen.getByRole('button', { name: /Recorrentes/ }))
    expect(onSelect).toHaveBeenCalledWith('recurring')
  })

  it('fonte em erro mostra "erro" no lugar da contagem', () => {
    render(
      <WeeklySourceRail
        entries={entries({ 'pending-dailies': { isError: true } })}
        activeSourceId="monthly-in-week"
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /Daily pendentes/ })).toHaveTextContent('erro')
  })

  it('jest-axe: sem violações', async () => {
    const { container } = render(
      <WeeklySourceRail entries={entries()} activeSourceId="monthly-in-week" onSelect={vi.fn()} />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
