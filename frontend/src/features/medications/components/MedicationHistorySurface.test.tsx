import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'

vi.mock('../../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import client from '../../../api/client'
import { createBujoTheme } from '../../../theme'
import { MedicationHistorySurface } from './MedicationHistorySurface'
import type { MedicationDay, MedicationDayEntry } from '../types'

const mockGet = client.get as ReturnType<typeof vi.fn>

// Datas ancoradas em "hoje" local (split de string, sem new Date(iso)).
function isoToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

const TODAY = isoToday()
const YESTERDAY = addDays(TODAY, -1)

function entry(overrides: Partial<MedicationDayEntry> = {}): MedicationDayEntry {
  return {
    id: 'e1',
    medicationId: 'm1',
    medicationTitle: 'Losartana',
    substanceName: 'Losartana K',
    doseAtTime: [{ label: '', amount: 50, unit: 'mg' }],
    confirmedAt: null,
    source: 'scheduled',
    timeBlockId: 'b1',
    ...overrides,
  }
}

function dayWith(overrides: Partial<MedicationDay> = {}): MedicationDay {
  return {
    date: TODAY,
    blocks: [
      {
        timeBlockId: 'b1',
        timeBlockName: 'Manhã',
        status: 'pending',
        entries: [entry()],
      },
    ],
    adHoc: [],
    ...overrides,
  }
}

function renderSurface() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={createBujoTheme('light')}>
        <main aria-label="Medicamentos">
          <MedicationHistorySurface />
        </main>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('MedicationHistorySurface — navegador de data (AC1)', () => {
  // clearAllMocks (não resetAllMocks): preserva o mock global de window.matchMedia
  // (test-setup) que o MUI usa.
  beforeEach(() => vi.clearAllMocks())

  it('abre em hoje: "Próximo dia" desabilitado e o seletor limitado a hoje', async () => {
    mockGet.mockResolvedValue({ data: dayWith() })
    renderSurface()

    await screen.findByRole('heading', { name: 'Manhã', level: 3 })
    expect(screen.getByRole('button', { name: 'Próximo dia' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Dia anterior' })).toBeEnabled()

    const dateInput = screen.getByLabelText(/Data selecionada:/) as HTMLInputElement
    expect(dateInput.value).toBe(TODAY)
    expect(dateInput.getAttribute('max')).toBe(TODAY)
  })

  it('navegar ao dia anterior habilita "Próximo dia" e busca a nova data', async () => {
    mockGet.mockResolvedValue({ data: dayWith() })
    const user = userEvent.setup()
    renderSurface()

    await screen.findByRole('heading', { name: 'Manhã', level: 3 })
    await user.click(screen.getByRole('button', { name: 'Dia anterior' }))

    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith('/api/medications/days/', {
        params: { date: YESTERDAY },
      }),
    )
    expect(screen.getByRole('button', { name: 'Próximo dia' })).toBeEnabled()
  })
})

describe('MedicationHistorySurface — dose perdida vs. pendente (AC3)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('hoje: bloco pendente mostra "Pendente"; nenhuma "Dose perdida"', async () => {
    mockGet.mockResolvedValue({ data: dayWith() })
    renderSurface()

    await screen.findByRole('heading', { name: 'Manhã', level: 3 })
    expect(screen.getByText('Pendente')).toBeInTheDocument()
    expect(screen.queryByText('Dose perdida')).not.toBeInTheDocument()
  })

  it('dia passado: linha scheduled sem confirmação vira "Dose perdida" (texto+ícone)', async () => {
    mockGet.mockResolvedValue({ data: dayWith({ date: YESTERDAY }) })
    const user = userEvent.setup()
    renderSurface()

    await screen.findByRole('heading', { name: 'Manhã', level: 3 })
    await user.click(screen.getByRole('button', { name: 'Dia anterior' }))

    // Linha exibe "Dose perdida"; o cabeçalho do bloco vira "Doses perdidas".
    expect(await screen.findByText('Dose perdida')).toBeInTheDocument()
    expect(screen.getByText('Doses perdidas')).toBeInTheDocument()
    expect(screen.queryByText('Pendente')).not.toBeInTheDocument()
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    mockGet.mockResolvedValue({ data: dayWith() })
    renderSurface()
    await screen.findByRole('heading', { name: 'Manhã', level: 3 })
    expect(await axe(document.body)).toHaveNoViolations()
  })
})

describe('MedicationHistorySurface — estados (AC8)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('empty state: dia sem linhas → "Nenhum medicamento neste dia."', async () => {
    mockGet.mockResolvedValue({ data: dayWith({ blocks: [], adHoc: [] }) })
    renderSurface()

    expect(await screen.findByText('Nenhum medicamento neste dia.')).toBeInTheDocument()
  })

  it('loading: skeleton com role="status"', () => {
    mockGet.mockReturnValue(new Promise(() => {}))
    renderSurface()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('erro de leitura: alerta + retry preservando a data selecionada', async () => {
    mockGet.mockRejectedValue(new Error('boom'))
    renderSurface()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o histórico.',
    )
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
    // A data selecionada (hoje) é preservada apesar do erro.
    const dateInput = screen.getByLabelText(/Data selecionada:/) as HTMLInputElement
    expect(dateInput.value).toBe(TODAY)
  })

  it('exibe avulsos passados numa seção read-only Avulso/PRN (AC7)', async () => {
    mockGet.mockResolvedValue({
      data: dayWith({
        date: YESTERDAY,
        blocks: [],
        adHoc: [
          entry({
            id: 'ah1',
            medicationTitle: 'Dipirona',
            source: 'ad_hoc',
            timeBlockId: null,
            confirmedAt: '2026-03-01T14:00:00Z',
            doseAtTime: [{ label: '', amount: 1, unit: 'comp' }],
          }),
        ],
      }),
    })
    renderSurface()

    const prn = await screen.findByRole('heading', { name: 'Avulso / PRN', level: 3 })
    expect(within(prn.parentElement as HTMLElement).getByText('Dipirona · 1 comp')).toBeInTheDocument()
  })
})
