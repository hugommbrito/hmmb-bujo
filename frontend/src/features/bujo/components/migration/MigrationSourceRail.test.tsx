import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MigrationSourceRail } from './MigrationSourceRail'

const ENTRIES = [
  { sourceId: 'month' as const, count: 3 },
  { sourceId: 'week' as const, count: 2 },
  { sourceId: 'day' as const, count: 0 },
]

describe('MigrationSourceRail (Story 14.9)', () => {
  it('renderiza as 3 fontes na ordem mês→semana→dia com a contagem de cada uma', () => {
    render(<MigrationSourceRail entries={ENTRIES} activeSourceId="month" onSelect={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((button) => button.textContent)).toEqual([
      expect.stringContaining('Meses'),
      expect.stringContaining('Semanas'),
      expect.stringContaining('Dias'),
    ])
  })

  it('marca a fonte ativa com aria-current', () => {
    render(<MigrationSourceRail entries={ENTRIES} activeSourceId="week" onSelect={vi.fn()} />)
    expect(screen.getByText('Semanas').closest('button')).toHaveAttribute('aria-current', 'true')
    expect(screen.getByText('Meses').closest('button')).not.toHaveAttribute('aria-current')
  })

  it('fonte com 0 restantes fica marcada "revisada"', () => {
    render(<MigrationSourceRail entries={ENTRIES} activeSourceId="month" onSelect={vi.fn()} />)
    expect(screen.getByText('✓ revisado')).toBeInTheDocument()
    expect(screen.getByText('0 restantes')).toBeInTheDocument()
  })

  it('clicar numa fonte chama onSelect', () => {
    const onSelect = vi.fn()
    render(<MigrationSourceRail entries={ENTRIES} activeSourceId="month" onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Semanas').closest('button')!)
    expect(onSelect).toHaveBeenCalledWith('week')
  })

  it('estado de erro: as 3 entradas mostram "erro" (leitura única compartilhada)', () => {
    render(<MigrationSourceRail entries={ENTRIES} activeSourceId="month" onSelect={vi.fn()} isError />)
    expect(screen.getAllByText('erro')).toHaveLength(3)
  })
})
