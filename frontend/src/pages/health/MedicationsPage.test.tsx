import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import client from '../../api/client'
import { MedicationsPage } from './MedicationsPage'

const mockGet = client.get as ReturnType<typeof vi.fn>

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  // MemoryRouter: a página agora hospeda <MedicationsTabs/> (Story 8.3), que usa
  // useLocation — precisa de contexto de rota (a aba "Hoje" vive no <Outlet/>).
  return render(
    <MemoryRouter initialEntries={['/health/medications']}>
      <QueryClientProvider client={qc}>
        <MedicationsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('MedicationsPage (/health/medications)', () => {
  beforeEach(() => vi.resetAllMocks())

  it('renderiza a superfície diária real (não o placeholder) com um único <main>', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.startsWith('/api/medications/days/')) {
        return Promise.resolve({ data: { date: '2026-03-01', blocks: [], adHoc: [] } })
      }
      return Promise.resolve({ data: [] })
    })
    renderPage()

    const main = screen.getByRole('main', { name: 'Medicamentos' })
    expect(main).toBeInTheDocument()
    expect(screen.getAllByRole('main')).toHaveLength(1)
    // A rota deixou de ser o PlaceholderPage ("Em desenvolvimento.").
    expect(screen.queryByText('Em desenvolvimento.')).not.toBeInTheDocument()
    // A superfície real aparece (empty state factual).
    expect(await screen.findByText('Nenhum medicamento para hoje.')).toBeInTheDocument()
  })
})
