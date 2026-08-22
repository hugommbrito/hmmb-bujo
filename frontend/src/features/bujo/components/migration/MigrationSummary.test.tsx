import { fireEvent, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'

import { MigrationSummary } from './MigrationSummary'

describe('MigrationSummary (Story 14.9)', () => {
  it('mostra a contagem factual, sem exclamação/emoji além do check decorativo', () => {
    render(<MigrationSummary tally={{ migrated: 5, postponed: 2, cancelled: 1 }} onBack={vi.fn()} />)
    expect(screen.getByText('Migração concluída')).toBeInTheDocument()
    expect(screen.getByText('8 tarefas decididas. Nada ficou sem lugar.')).toBeInTheDocument()
  })

  it('tally mostra migradas/adiadas/canceladas', () => {
    render(<MigrationSummary tally={{ migrated: 5, postponed: 2, cancelled: 1 }} onBack={vi.fn()} />)
    expect(screen.getByText('migradas')).toBeInTheDocument()
    expect(screen.getByText('adiadas')).toBeInTheDocument()
    expect(screen.getByText('canceladas')).toBeInTheDocument()
  })

  it('"Voltar ao Hoje" chama onBack', () => {
    const onBack = vi.fn()
    render(<MigrationSummary tally={{ migrated: 1, postponed: 0, cancelled: 0 }} onBack={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao Hoje' }))
    expect(onBack).toHaveBeenCalled()
  })

  it('jest-axe: sem violações', async () => {
    const { container } = render(<MigrationSummary tally={{ migrated: 1, postponed: 1, cancelled: 1 }} onBack={vi.fn()} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
