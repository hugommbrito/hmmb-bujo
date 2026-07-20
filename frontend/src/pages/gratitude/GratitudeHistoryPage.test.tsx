import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import client from '../../api/client'
import { createBujoTheme } from '../../theme'
import { GratitudeHistoryPage } from './GratitudeHistoryPage'

const mockGet = client.get as ReturnType<typeof vi.fn>

function currentMonthFirst(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

// Espelha MedicationHistoryPage.test.tsx: a sub-rota /gratitude/history compõe
// <main aria-label="Diário de Gratidão"> (mesmo landmark da aba "Hoje") + abas + surface.
function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={['/gratitude/history']}>
      <QueryClientProvider client={qc}>
        <ThemeProvider theme={createBujoTheme('light')}>
          <GratitudeHistoryPage />
        </ThemeProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('GratitudeHistoryPage (/gratitude/history — AC6)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renderiza a superfície de histórico dentro de um único <main aria-label="Diário de Gratidão">', async () => {
    mockGet.mockResolvedValue({ data: { month: currentMonthFirst(), days: [] } })
    renderPage()

    const mains = screen.getAllByRole('main', { name: 'Diário de Gratidão' })
    expect(mains).toHaveLength(1)
    expect(await screen.findByRole('heading', { name: 'Histórico', level: 2 })).toBeInTheDocument()
  })

  it('exibe as abas "Hoje"/"Histórico" com "Histórico" ativa (aba, não item de nav)', () => {
    mockGet.mockResolvedValue({ data: { month: currentMonthFirst(), days: [] } })
    renderPage()

    expect(screen.getByRole('tab', { name: 'Hoje' })).toBeInTheDocument()
    const historicoTab = screen.getByRole('tab', { name: 'Histórico' })
    expect(historicoTab).toBeInTheDocument()
    expect(historicoTab).toHaveAttribute('aria-selected', 'true')
  })
})
