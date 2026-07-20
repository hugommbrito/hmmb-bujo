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
import { GratitudePage } from './GratitudePage'

const mockGet = client.get as ReturnType<typeof vi.fn>

// MemoryRouter: a página hospeda <GratitudeTabs/> (Story 9.2), que usa useLocation — a aba
// "Hoje" vive no <Outlet/> (nunca na casca de nav). Espelha MedicationsPage.test.tsx.
function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <MemoryRouter initialEntries={['/gratitude']}>
      <QueryClientProvider client={qc}>
        <ThemeProvider theme={createBujoTheme('light')}>
          <GratitudePage />
        </ThemeProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('GratitudePage (/gratitude — AC6)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renderiza a superfície diária dentro de um único <main aria-label="Diário de Gratidão">', async () => {
    mockGet.mockResolvedValue({ data: { date: '2026-07-20', entries: [] } })
    renderPage()

    const mains = screen.getAllByRole('main', { name: 'Diário de Gratidão' })
    expect(mains).toHaveLength(1)
    // A superfície da 9.1 (composer + estado vazio) segue intacta sob as abas.
    expect(await screen.findByText('Nenhuma entrada para esta data.')).toBeInTheDocument()
  })

  it('exibe as abas "Hoje"/"Histórico" com "Hoje" ativa (aba dentro da página, não item de nav)', () => {
    mockGet.mockResolvedValue({ data: { date: '2026-07-20', entries: [] } })
    renderPage()

    const hojeTab = screen.getByRole('tab', { name: 'Hoje' })
    expect(hojeTab).toBeInTheDocument()
    expect(hojeTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Histórico' })).toBeInTheDocument()
  })
})
