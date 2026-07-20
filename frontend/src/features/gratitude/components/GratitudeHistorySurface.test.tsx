import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'

vi.mock('../../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import client from '../../../api/client'
import { createBujoTheme } from '../../../theme'
import { GratitudeHistorySurface } from './GratitudeHistorySurface'
import type { GratitudeMonth, GratitudeDay } from '../types'

const mockGet = client.get as ReturnType<typeof vi.fn>

// Idioma tz-safe de mês/dia por split de string (mesma técnica da surface).
function currentMonthFirst(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}
function addMonthsIso(monthFirstIso: string, delta: number): string {
  const [y, m] = monthFirstIso.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR')
}

const CURRENT_MONTH = currentMonthFirst()
const PREV_MONTH = addMonthsIso(CURRENT_MONTH, -1)
const TWO_MONTHS_AGO = addMonthsIso(CURRENT_MONTH, -2)
const FUTURE_MONTH = addMonthsIso(CURRENT_MONTH, 3)

// Datas fixas de conteúdo (independentes de "hoje"): sempre no passado.
const D1 = '2020-01-10'
const D2 = '2020-01-20'

function entry(id: string, date: string, text: string, createdAt: string): GratitudeDay['entries'][number] {
  return { id, date, text, createdAt }
}

function monthWith(monthFirst: string, days: GratitudeMonth['days']): GratitudeMonth {
  return { month: monthFirst, days }
}

function renderSurface() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={createBujoTheme('light')}>
        <main aria-label="Diário de Gratidão">
          <GratitudeHistorySurface />
        </main>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('GratitudeHistorySurface — visão por mês (AC1, AC2, AC5)', () => {
  // clearAllMocks (não resetAllMocks): preserva o mock global de matchMedia (test-setup).
  beforeEach(() => vi.clearAllMocks())

  it('loading: skeleton com role="status"', () => {
    mockGet.mockReturnValue(new Promise(() => {}))
    renderSurface()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('erro de leitura: alerta + retry', async () => {
    mockGet.mockRejectedValue(new Error('boom'))
    renderSurface()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar as entradas.',
    )
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
  })

  it('mês vazio → "Nenhuma entrada neste mês."', async () => {
    mockGet.mockResolvedValue({ data: monthWith(CURRENT_MONTH, []) })
    renderSurface()
    expect(await screen.findByText('Nenhuma entrada neste mês.')).toBeInTheDocument()
  })

  it('agrupa por dia com cabeçalho de data e entradas em ordem cronológica', async () => {
    mockGet.mockResolvedValue({
      data: monthWith(CURRENT_MONTH, [
        {
          date: D1,
          entries: [
            entry('a', D1, 'entrada-10-A', '2020-01-10T08:00:00Z'),
            entry('b', D1, 'entrada-10-B', '2020-01-10T09:00:00Z'),
          ],
        },
        { date: D2, entries: [entry('c', D2, 'entrada-20', '2020-01-20T07:00:00Z')] },
      ]),
    })
    renderSurface()

    // Cabeçalho de cada dia (heading, escapa a colisão com a data no rodapé da entrada).
    expect(await screen.findByRole('heading', { name: formatDateBR(D1) })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: formatDateBR(D2) })).toBeInTheDocument()

    // Entradas visíveis, na ordem em que o backend as agrupou.
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('entrada-10-A')
    expect(items[1]).toHaveTextContent('entrada-10-B')
    expect(items[2]).toHaveTextContent('entrada-20')
  })

  it('inicia no mês corrente (params {month} explícito) e "Próximo mês" desabilitado', async () => {
    mockGet.mockResolvedValue({ data: monthWith(CURRENT_MONTH, []) })
    renderSurface()

    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith('/api/gratitude/months/', {
        params: { month: CURRENT_MONTH },
      }),
    )
    expect(screen.getByRole('button', { name: 'Próximo mês' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Mês anterior' })).toBeEnabled()
  })

  it('navegar ao mês anterior busca o novo mês e habilita "Próximo mês"', async () => {
    mockGet.mockResolvedValue({ data: monthWith(CURRENT_MONTH, []) })
    const user = userEvent.setup()
    renderSurface()

    await screen.findByText('Nenhuma entrada neste mês.')
    await user.click(screen.getByRole('button', { name: 'Mês anterior' }))

    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith('/api/gratitude/months/', {
        params: { month: PREV_MONTH },
      }),
    )
    expect(screen.getByRole('button', { name: 'Próximo mês' })).toBeEnabled()
  })

  it('o seletor de mês (type="month") navega para o mês escolhido (params {month})', async () => {
    mockGet.mockResolvedValue({ data: monthWith(CURRENT_MONTH, []) })
    renderSurface()
    await screen.findByText('Nenhuma entrada neste mês.')

    // O input `type="month"` carrega um aria-label ("Mês selecionado: …") que sobrepõe o
    // label "Mês" — por isso a busca é pelo prefixo do aria-label.
    fireEvent.change(screen.getByLabelText(/Mês selecionado:/), {
      target: { value: TWO_MONTHS_AGO.slice(0, 7) },
    })

    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith('/api/gratitude/months/', {
        params: { month: TWO_MONTHS_AGO },
      }),
    )
  })

  it('o seletor de mês NÃO navega para o futuro (clamp no mês corrente → "Próximo mês" desabilita)', async () => {
    mockGet.mockResolvedValue({ data: monthWith(CURRENT_MONTH, []) })
    const user = userEvent.setup()
    renderSurface()
    await screen.findByText('Nenhuma entrada neste mês.')

    // Sai do mês corrente (aí "Próximo mês" habilita)…
    await user.click(screen.getByRole('button', { name: 'Mês anterior' }))
    expect(screen.getByRole('button', { name: 'Próximo mês' })).toBeEnabled()

    // …e tenta pular para um mês FUTURO pelo seletor: o clamp devolve ao mês corrente,
    // então "Próximo mês" volta a desabilitar (sem navegar ao futuro — AC4).
    fireEvent.change(screen.getByLabelText(/Mês selecionado:/), {
      target: { value: FUTURE_MONTH.slice(0, 7) },
    })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Próximo mês' })).toBeDisabled(),
    )
  })

  it('"Próximo mês" avança e desabilita ao chegar no mês corrente', async () => {
    mockGet.mockResolvedValue({ data: monthWith(CURRENT_MONTH, []) })
    const user = userEvent.setup()
    renderSurface()
    await screen.findByText('Nenhuma entrada neste mês.')

    await user.click(screen.getByRole('button', { name: 'Mês anterior' }))
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith('/api/gratitude/months/', {
        params: { month: PREV_MONTH },
      }),
    )
    // Avançar volta ao mês corrente e desabilita "Próximo mês" no limite superior.
    await user.click(screen.getByRole('button', { name: 'Próximo mês' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Próximo mês' })).toBeDisabled(),
    )
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    mockGet.mockResolvedValue({
      data: monthWith(CURRENT_MONTH, [
        { date: D1, entries: [entry('a', D1, 'entrada', '2020-01-10T08:00:00Z')] },
      ]),
    })
    renderSurface()
    await screen.findByRole('heading', { name: formatDateBR(D1) })
    expect(await axe(document.body)).toHaveNoViolations()
  })
})

describe('GratitudeHistorySurface — visão por data (AC3, AC5)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('escolher uma data entra no modo por-data (GET days/?date=) e "Voltar ao mês" retorna', async () => {
    // Roteia por URL: months/ (visão de mês) vs days/ (modo por-data).
    mockGet.mockImplementation((url: string) => {
      if (url === '/api/gratitude/days/') {
        return Promise.resolve({
          data: { date: D1, entries: [entry('d', D1, 'entrada-do-dia', '2020-01-10T08:00:00Z')] },
        })
      }
      return Promise.resolve({ data: monthWith(CURRENT_MONTH, []) })
    })
    renderSurface()
    await screen.findByText('Nenhuma entrada neste mês.')

    // "Ir para data": setar a data foca o dia (D3) e dispara a query diária.
    fireEvent.change(screen.getByLabelText('Ir para data'), { target: { value: D1 } })

    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith('/api/gratitude/days/', { params: { date: D1 } }),
    )
    expect(await screen.findByText('entrada-do-dia')).toBeInTheDocument()

    // "Voltar ao mês" limpa o foco e volta à visão de mês.
    await userEvent.setup().click(screen.getByRole('button', { name: 'Voltar ao mês' }))
    expect(await screen.findByText('Nenhuma entrada neste mês.')).toBeInTheDocument()
  })

  it('data sem entradas → "Nenhuma entrada para esta data."', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/api/gratitude/days/') {
        return Promise.resolve({ data: { date: D1, entries: [] } })
      }
      return Promise.resolve({ data: monthWith(CURRENT_MONTH, []) })
    })
    renderSurface()
    await screen.findByText('Nenhuma entrada neste mês.')

    fireEvent.change(screen.getByLabelText('Ir para data'), { target: { value: D1 } })

    expect(await screen.findByText('Nenhuma entrada para esta data.')).toBeInTheDocument()
  })

  it('modo por-data: loading exibe role="status"', async () => {
    // months/ resolve (para chegar ao "Ir para data"); days/ nunca resolve → pending.
    mockGet.mockImplementation((url: string) => {
      if (url === '/api/gratitude/days/') return new Promise(() => {})
      return Promise.resolve({ data: monthWith(CURRENT_MONTH, []) })
    })
    renderSurface()
    await screen.findByText('Nenhuma entrada neste mês.')

    fireEvent.change(screen.getByLabelText('Ir para data'), { target: { value: D1 } })

    expect(await screen.findByRole('status')).toBeInTheDocument()
  })

  it('modo por-data: erro de leitura → alerta + retry', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/api/gratitude/days/') return Promise.reject(new Error('boom'))
      return Promise.resolve({ data: monthWith(CURRENT_MONTH, []) })
    })
    renderSurface()
    await screen.findByText('Nenhuma entrada neste mês.')

    fireEvent.change(screen.getByLabelText('Ir para data'), { target: { value: D1 } })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar as entradas.',
    )
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
  })

  it('trocar a data DENTRO do modo por-data rebusca days/?date= com a nova data', async () => {
    mockGet.mockImplementation((url: string, config?: { params?: { date?: string } }) => {
      if (url === '/api/gratitude/days/') {
        return Promise.resolve({ data: { date: config?.params?.date, entries: [] } })
      }
      return Promise.resolve({ data: monthWith(CURRENT_MONTH, []) })
    })
    renderSurface()
    await screen.findByText('Nenhuma entrada neste mês.')

    // Entra no modo por-data em D1…
    fireEvent.change(screen.getByLabelText('Ir para data'), { target: { value: D1 } })
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith('/api/gratitude/days/', { params: { date: D1 } }),
    )

    // …e o seletor "Data" (aria-label "Data selecionada: …") troca para D2 → nova query.
    fireEvent.change(screen.getByLabelText(/Data selecionada:/), { target: { value: D2 } })
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith('/api/gratitude/days/', { params: { date: D2 } }),
    )
  })

  it('sem violações de acessibilidade no modo por-data (jest-axe)', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/api/gratitude/days/') {
        return Promise.resolve({
          data: { date: D1, entries: [entry('d', D1, 'entrada-do-dia', '2020-01-10T08:00:00Z')] },
        })
      }
      return Promise.resolve({ data: monthWith(CURRENT_MONTH, []) })
    })
    renderSurface()
    await screen.findByText('Nenhuma entrada neste mês.')

    fireEvent.change(screen.getByLabelText('Ir para data'), { target: { value: D1 } })
    await screen.findByText('entrada-do-dia')

    expect(await axe(document.body)).toHaveNoViolations()
  })
})
