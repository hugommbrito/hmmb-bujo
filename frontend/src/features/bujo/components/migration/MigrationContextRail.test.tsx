import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MigrationContextRail, type MigrationTally } from './MigrationContextRail'

const EMPTY_TALLY: MigrationTally = { migrated: 0, postponed: 0, cancelled: 0 }

describe('MigrationContextRail (Story 14.9)', () => {
  it('mostra progresso "N de M revisadas" a partir do snapshot que só cresce (não retrocede quando itens são decididos)', () => {
    const { rerender } = render(
      <MigrationContextRail
        progressSources={[
          { sourceId: 'month', pendingNow: 3 },
          { sourceId: 'week', pendingNow: 2 },
          { sourceId: 'day', pendingNow: 3 },
        ]}
        tally={EMPTY_TALLY}
        onNavigateToSource={vi.fn()}
        onPause={vi.fn()}
      />,
    )
    // Snapshot inicial: 8 elegíveis, 0 decididos ainda.
    expect(screen.getByText(/Itens decididos: 0\/8/)).toBeInTheDocument()

    // 3 itens decididos (a fila só lista pendentes — decidir os REMOVE, então
    // `pendingNow` cai para 5 no total); o DENOMINADOR (8) tem de persistir.
    rerender(
      <MigrationContextRail
        progressSources={[
          { sourceId: 'month', pendingNow: 2 },
          { sourceId: 'week', pendingNow: 1 },
          { sourceId: 'day', pendingNow: 2 },
        ]}
        tally={{ migrated: 2, postponed: 1, cancelled: 0 }}
        onNavigateToSource={vi.fn()}
        onPause={vi.fn()}
      />,
    )
    expect(screen.getByText(/Itens decididos: 3\/8/)).toBeInTheDocument()
  })

  it('tally exibe migradas/adiadas/canceladas', () => {
    render(
      <MigrationContextRail
        progressSources={[{ sourceId: 'day', pendingNow: 0 }]}
        tally={{ migrated: 2, postponed: 1, cancelled: 1 }}
        onNavigateToSource={vi.fn()}
        onPause={vi.fn()}
      />,
    )
    const region = screen.getByRole('region', { name: 'Decidido até agora' })
    expect(region).toHaveTextContent('2')
    expect(region).toHaveTextContent('migradas')
    expect(region).toHaveTextContent('adiadas')
    expect(region).toHaveTextContent('canceladas')
  })

  it('por fonte: clicar navega para a fonte', () => {
    const onNavigateToSource = vi.fn()
    render(
      <MigrationContextRail
        progressSources={[
          { sourceId: 'month', pendingNow: 3 },
          { sourceId: 'week', pendingNow: 0 },
        ]}
        tally={EMPTY_TALLY}
        onNavigateToSource={onNavigateToSource}
        onPause={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText('Meses'))
    expect(onNavigateToSource).toHaveBeenCalledWith('month')
  })

  it('"Pausar e sair" chama onPause', () => {
    const onPause = vi.fn()
    render(
      <MigrationContextRail progressSources={[]} tally={EMPTY_TALLY} onNavigateToSource={vi.fn()} onPause={onPause} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Pausar e sair' }))
    expect(onPause).toHaveBeenCalled()
  })
})
