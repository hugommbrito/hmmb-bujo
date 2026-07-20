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
import { MedicationHistoryPage } from './MedicationHistoryPage'

const mockGet = client.get as ReturnType<typeof vi.fn>

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={['/health/medications/history']}>
      <QueryClientProvider client={qc}>
        <ThemeProvider theme={createBujoTheme('light')}>
          <MedicationHistoryPage />
        </ThemeProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('MedicationHistoryPage (AC1/AC8)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renderiza a superfície de histórico dentro de um único <main aria-label="Medicamentos">', async () => {
    mockGet.mockResolvedValue({ data: { date: '2026-03-01', blocks: [], adHoc: [] } })
    renderPage()

    const mains = screen.getAllByRole('main', { name: 'Medicamentos' })
    expect(mains).toHaveLength(1)
    expect(await screen.findByRole('heading', { name: 'Histórico', level: 2 })).toBeInTheDocument()
  })

  it('exibe as abas "Hoje" e "Histórico" (aba, não item de nav)', () => {
    mockGet.mockResolvedValue({ data: { date: '2026-03-01', blocks: [], adHoc: [] } })
    renderPage()

    expect(screen.getByRole('tab', { name: 'Hoje' })).toBeInTheDocument()
    const historicoTab = screen.getByRole('tab', { name: 'Histórico' })
    expect(historicoTab).toBeInTheDocument()
    expect(historicoTab).toHaveAttribute('aria-selected', 'true')
  })
})
