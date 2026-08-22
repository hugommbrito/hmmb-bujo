import { fireEvent, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'

import { MigrationDecisionList } from './MigrationDecisionList'
import type { NormalizedMigrationItem } from './migrationRitualSources'

const ITEMS: NormalizedMigrationItem[] = [
  { id: 't1', title: 'Enviar documentos ao contador', originLabel: 'De: Junho de 2026', decision: null },
  { id: 't2', title: 'Renovar seguro do carro', originLabel: 'De: Maio de 2026', decision: null },
]

function baseProps(overrides: Partial<React.ComponentProps<typeof MigrationDecisionList>> = {}) {
  return {
    sourceId: 'month' as const,
    items: ITEMS,
    view: 'pending' as const,
    onViewChange: vi.fn(),
    loading: false,
    error: false,
    onRetry: vi.fn(),
    onMigrateToday: vi.fn(),
    onChooseDestination: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  }
}

describe('MigrationDecisionList (Story 14.9)', () => {
  it('mostra origem/linhagem e as 3 ações — nunca "Concluir"', () => {
    render(<MigrationDecisionList {...baseProps()} />)
    expect(screen.getByText('De: Junho de 2026')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Migrar para hoje' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Escolher destino…' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Cancelar' })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Concluir' })).not.toBeInTheDocument()
  })

  it('"Migrar para hoje" chama onMigrateToday com o id certo', () => {
    const onMigrateToday = vi.fn()
    render(<MigrationDecisionList {...baseProps({ onMigrateToday })} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Migrar para hoje' })[0])
    expect(onMigrateToday).toHaveBeenCalledWith('t1')
  })

  it('"Cancelar" chama onCancel; "Escolher destino…" chama onChooseDestination', () => {
    const onCancel = vi.fn()
    const onChooseDestination = vi.fn()
    render(<MigrationDecisionList {...baseProps({ onCancel, onChooseDestination })} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancelar' })[1])
    expect(onCancel).toHaveBeenCalledWith('t2')
    fireEvent.click(screen.getAllByRole('button', { name: 'Escolher destino…' })[1])
    expect(onChooseDestination).toHaveBeenCalledWith('t2')
  })

  it('offline: ações ficam aria-disabled e guardadas no clique', () => {
    const onMigrateToday = vi.fn()
    render(<MigrationDecisionList {...baseProps({ offline: true, onMigrateToday })} />)
    const button = screen.getAllByRole('button', { name: 'Migrar para hoje' })[0]
    expect(button).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(button)
    expect(onMigrateToday).not.toHaveBeenCalled()
  })

  it('erro de escrita: motivo inline + "Tentar novamente" por item', () => {
    const onRetryItem = vi.fn()
    render(
      <MigrationDecisionList
        {...baseProps({ itemErrors: { t1: 'Não foi possível migrar. Tente novamente.' }, onRetryItem })}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível migrar.')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(onRetryItem).toHaveBeenCalledWith('t1')
  })

  it('toggle "Tudo" mostra itens decididos nesta visita', () => {
    const decided: NormalizedMigrationItem[] = [
      { id: 't3', title: 'Já decidida', originLabel: 'De: Abril de 2026', decision: 'today' },
    ]
    render(<MigrationDecisionList {...baseProps({ items: decided, view: 'all' })} />)
    expect(screen.getByText('Já decidida')).toBeInTheDocument()
  })

  it('estado de erro de leitura: mostra motivo + retry, sem itens', () => {
    const onRetry = vi.fn()
    render(<MigrationDecisionList {...baseProps({ error: true, onRetry })} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar esta fonte.')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('fonte sem pendências mostra estado vazio', () => {
    render(<MigrationDecisionList {...baseProps({ items: [] })} />)
    expect(screen.getByText('Nenhuma pendência nesta fonte.')).toBeInTheDocument()
  })

  it('jest-axe: sem violações com a lista aberta', async () => {
    const { container } = render(<MigrationDecisionList {...baseProps()} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
