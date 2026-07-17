import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'
import { createBujoTheme } from '../../theme'
import { BrainDumpPage } from './BrainDumpPage'

const mockCreateMutate = vi.fn()
const mockDiscardMutate = vi.fn()
const mockProcessMutate = vi.fn()

vi.mock('../../features/braindump', () => ({
  useBrainDumpItemsQuery: vi.fn(),
  useCreateBrainDumpItemMutation: () => ({ mutate: mockCreateMutate }),
}))

vi.mock('../../features/braindump/api', () => ({
  useDiscardBrainDumpItemMutation: () => ({ mutate: mockDiscardMutate }),
  useProcessBrainDumpItemMutation: () => ({ mutate: mockProcessMutate, isError: false }),
}))

import { useBrainDumpItemsQuery } from '../../features/braindump'

const mockUseBrainDumpItemsQuery = useBrainDumpItemsQuery as ReturnType<typeof vi.fn>

function renderPage() {
  return render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <BrainDumpPage />
    </ThemeProvider>,
  )
}

const ITEMS = [
  { id: 'item-1', title: 'Ideia solta', description: null, targetLog: null, createdAt: '2026-07-16T10:00:00Z' },
]

describe('BrainDumpPage (AC1)', () => {
  it('mostra skeleton enquanto carrega', () => {
    mockUseBrainDumpItemsQuery.mockReturnValue({ isPending: true, data: undefined })

    renderPage()

    expect(screen.getByLabelText('Brain Dump')).toBeInTheDocument()
  })

  it('estado vazio mostra "Brain Dump vazio."', () => {
    mockUseBrainDumpItemsQuery.mockReturnValue({ isPending: false, data: [] })

    renderPage()

    expect(screen.getByText('Brain Dump vazio.')).toBeInTheDocument()
  })

  it('lista renderiza itens mockados', () => {
    mockUseBrainDumpItemsQuery.mockReturnValue({ isPending: false, data: ITEMS })

    renderPage()

    expect(screen.getByText('Ideia solta')).toBeInTheDocument()
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    mockUseBrainDumpItemsQuery.mockReturnValue({ isPending: false, data: ITEMS })

    const { container } = renderPage()

    expect(await axe(container)).toHaveNoViolations()
  })
})
