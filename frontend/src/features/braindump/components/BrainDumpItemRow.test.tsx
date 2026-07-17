import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { createBujoTheme } from '../../../theme'
import { BrainDumpItemRow } from './BrainDumpItemRow'
import type { BrainDumpItem } from '../types'

const mockDiscardMutate = vi.fn()
const mockProcessMutate = vi.fn()

// BrainDumpItemRow renderiza o ProcessItemDialog real (não mockado) — só os
// hooks de API são mockados aqui, mesmo padrão de TaskDetailPanel.test.tsx.
vi.mock('../api', () => ({
  useDiscardBrainDumpItemMutation: () => ({ mutate: mockDiscardMutate }),
  useProcessBrainDumpItemMutation: () => ({ mutate: mockProcessMutate, isError: false }),
}))

function baseItem(overrides: Partial<BrainDumpItem> = {}): BrainDumpItem {
  return {
    id: 'item-1',
    title: 'Ideia solta',
    description: null,
    targetLog: null,
    createdAt: '2026-07-16T10:00:00Z',
    ...overrides,
  }
}

function renderRow(item: BrainDumpItem) {
  render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <BrainDumpItemRow item={item} />
    </ThemeProvider>,
  )
}

describe('BrainDumpItemRow (AC2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza título e descrição', () => {
    renderRow(baseItem({ description: 'Detalhes da ideia' }))

    expect(screen.getByText('Ideia solta')).toBeInTheDocument()
    expect(screen.getByText('Detalhes da ideia')).toBeInTheDocument()
  })

  it('não renderiza descrição quando ausente', () => {
    renderRow(baseItem({ description: null }))

    expect(screen.getByText('Ideia solta')).toBeInTheDocument()
    expect(screen.queryByText('Detalhes da ideia')).not.toBeInTheDocument()
  })

  it('clicar "Mover" abre o ProcessItemDialog', () => {
    renderRow(baseItem())

    fireEvent.click(screen.getByRole('button', { name: 'Mover' }))

    expect(screen.getByText('Mover item do Brain Dump')).toBeInTheDocument()
  })

  it('clicar "Descartar" chama a mutation direto, sem diálogo de confirmação', () => {
    renderRow(baseItem())

    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))

    expect(mockDiscardMutate).toHaveBeenCalledWith({ itemId: 'item-1' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
