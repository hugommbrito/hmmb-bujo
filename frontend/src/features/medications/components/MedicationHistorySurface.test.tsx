import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { axe } from 'jest-axe'

vi.mock('../../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import client from '../../../api/client'
import { createBujoTheme } from '../../../theme'
import { MedicationHistorySurface } from './MedicationHistorySurface'
import type { MedicationDay, MedicationDayEntry } from '../types'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>

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
    untracked: false,
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

// --- Story 16.2c — dia "não registrado" no Histórico de Medicamentos ----------

describe('MedicationHistorySurface — dia não registrado (16.2c)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('checkbox rotulado, desmarcado por padrão; marcar chama POST e troca "Dose perdida" por "Não registrado" otimista', async () => {
    mockGet.mockResolvedValue({ data: dayWith({ date: YESTERDAY }) })
    mockPost.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    renderSurface()

    await screen.findByRole('heading', { name: 'Manhã', level: 3 })
    await user.click(screen.getByRole('button', { name: 'Dia anterior' }))
    expect(await screen.findByText('Dose perdida')).toBeInTheDocument()

    const checkbox = screen.getByRole('checkbox', { name: 'Marcar este dia como não registrado' })
    expect(checkbox).not.toBeChecked()
    await user.click(checkbox)

    expect(mockPost).toHaveBeenCalledWith('/api/medications/untracked-days/', {
      date: YESTERDAY,
      untracked: true,
    })
    await waitFor(() => expect(checkbox).toBeChecked())
    expect(screen.queryByText('Dose perdida')).not.toBeInTheDocument()
    expect(screen.queryByText('Doses perdidas')).not.toBeInTheDocument()
    expect(screen.getAllByText('Não registrado').length).toBeGreaterThanOrEqual(2)
    // Estado ESCRITO no título da data (nunca só o checkbox).
    expect(
      screen.getByRole('heading', { level: 3, name: /Dia não registrado — fora das estatísticas/ }),
    ).toBeInTheDocument()
    expect(await axe(document.body)).toHaveNoViolations()
  })

  it('dia já marcado no servidor abre com o checkbox marcado e sem "Dose perdida"', async () => {
    mockGet.mockResolvedValue({ data: dayWith({ date: YESTERDAY, untracked: true }) })
    const user = userEvent.setup()
    renderSurface()
    await screen.findByRole('heading', { name: 'Manhã', level: 3 })
    await user.click(screen.getByRole('button', { name: 'Dia anterior' }))

    await waitFor(() =>
      expect(
        screen.getByRole('checkbox', { name: 'Marcar este dia como não registrado' }),
      ).toBeChecked(),
    )
    expect(screen.queryByText('Dose perdida')).not.toBeInTheDocument()
    expect(screen.getAllByText('Não registrado').length).toBeGreaterThanOrEqual(2)
  })

  it('escrita que FALHA: rollback (checkbox volta), alerta + retry da MESMA escrita', async () => {
    mockGet.mockResolvedValue({ data: dayWith() })
    mockPost.mockRejectedValue(new Error('nope'))
    const user = userEvent.setup()
    renderSurface()
    await screen.findByRole('heading', { name: 'Manhã', level: 3 })

    const checkbox = screen.getByRole('checkbox', { name: 'Marcar este dia como não registrado' })
    await user.click(checkbox)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível salvar. Tente novamente.',
    )
    expect(checkbox).not.toBeChecked()
    expect(screen.getByText('Pendente')).toBeInTheDocument()

    const before = mockPost.mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(mockPost.mock.calls.length).toBe(before + 1))
    expect(mockPost).toHaveBeenLastCalledWith('/api/medications/untracked-days/', {
      date: TODAY,
      untracked: true,
    })
  })
})

const FUTURE_DAY_MESSAGE = 'Não é possível marcar um dia futuro como não registrado.'

function validationError400(fields: Record<string, string[]>): AxiosError {
  const response = {
    status: 400,
    data: { detail: 'Validation failed', fields },
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
  } as AxiosResponse
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', response.config, undefined, response)
}

describe('MedicationHistorySurface — dia não registrado: erros e navegação (review 1)', () => {
  beforeEach(() => vi.clearAllMocks())

  // P1 — 400 de campo: a mensagem do servidor é a explicação; retry não passaria.
  it('400 de campo `date`: mostra a mensagem do servidor e NÃO oferece retry', async () => {
    mockGet.mockResolvedValue({ data: dayWith() })
    mockPost.mockRejectedValue(validationError400({ date: [FUTURE_DAY_MESSAGE] }))
    const user = userEvent.setup()
    renderSurface()
    await screen.findByRole('heading', { name: 'Manhã', level: 3 })
    await user.click(screen.getByRole('checkbox', { name: 'Marcar este dia como não registrado' }))

    const alert = await screen.findByTestId('medications-untracked-field-error')
    expect(alert).toHaveAttribute('role', 'alert')
    expect(alert).toHaveTextContent(FUTURE_DAY_MESSAGE)
    expect(screen.queryByText('Não foi possível salvar. Tente novamente.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: 'Marcar este dia como não registrado' }),
    ).not.toBeChecked()
  })

  // P2 — trocar de data zera o estado do toggle; o retry reenvia as variáveis da falha.
  it('erro em D1 + "Dia anterior": nenhum alerta sobrevive à troca de data', async () => {
    mockGet.mockResolvedValue({ data: dayWith() })
    mockPost.mockRejectedValue(new Error('nope'))
    const user = userEvent.setup()
    renderSurface()
    await screen.findByRole('heading', { name: 'Manhã', level: 3 })
    await user.click(screen.getByRole('checkbox', { name: 'Marcar este dia como não registrado' }))
    await screen.findByRole('alert')

    await user.click(screen.getByRole('button', { name: 'Dia anterior' }))
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith('/api/medications/days/', {
        params: { date: YESTERDAY },
      }),
    )
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument()
  })

  it('retry reenvia as MESMAS variáveis da falha (dia já marcado → untracked: false)', async () => {
    mockGet.mockResolvedValue({ data: dayWith({ untracked: true }) })
    mockPost.mockRejectedValue(new Error('nope'))
    const user = userEvent.setup()
    renderSurface()
    const checkbox = await screen.findByRole('checkbox', {
      name: 'Marcar este dia como não registrado',
    })
    await waitFor(() => expect(checkbox).toBeChecked())
    await user.click(checkbox)
    await screen.findByRole('alert')
    expect(mockPost).toHaveBeenLastCalledWith('/api/medications/untracked-days/', {
      date: TODAY,
      untracked: false,
    })

    const before = mockPost.mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(mockPost.mock.calls.length).toBe(before + 1))
    expect(mockPost).toHaveBeenLastCalledWith('/api/medications/untracked-days/', {
      date: TODAY,
      untracked: false,
    })
  })

  // P6 — o controle não some durante o fetch: fica montado e `disabled`.
  it('enquanto o dia carrega, o checkbox continua montado e desabilitado (sem salto de layout)', async () => {
    mockGet.mockReturnValue(new Promise(() => {}))
    renderSurface()
    const checkbox = screen.getByRole('checkbox', { name: 'Marcar este dia como não registrado' })
    expect(checkbox).toBeDisabled()
    expect(checkbox).not.toBeChecked()
  })

  it('erro de leitura: a linha do toggle NÃO é montada', async () => {
    mockGet.mockRejectedValue(new Error('boom'))
    renderSurface()
    await screen.findByRole('alert')
    expect(
      screen.queryByRole('checkbox', { name: 'Marcar este dia como não registrado' }),
    ).not.toBeInTheDocument()
  })
})
