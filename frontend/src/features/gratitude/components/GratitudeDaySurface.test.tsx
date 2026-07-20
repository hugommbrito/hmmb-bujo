import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'

vi.mock('../../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import client from '../../../api/client'
import { createBujoTheme } from '../../../theme'
import { GratitudeDaySurface } from './GratitudeDaySurface'
import type { GratitudeDay, GratitudeEntry } from '../types'

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

function entry(overrides: Partial<GratitudeEntry> = {}): GratitudeEntry {
  return {
    id: 'g1',
    date: TODAY,
    text: 'Grato pelo café',
    createdAt: `${TODAY}T09:00:00Z`,
    ...overrides,
  }
}

function dayWith(entries: GratitudeEntry[], date = TODAY): GratitudeDay {
  return { date, entries }
}

function renderSurface(initialEntry = '/gratitude') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={createBujoTheme('light')}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <main aria-label="Diário de Gratidão">
            <GratitudeDaySurface />
          </main>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('GratitudeDaySurface — estados (AC3, AC6)', () => {
  // clearAllMocks (não resetAllMocks): preserva o mock global de window.matchMedia.
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

  it('empty state: string EXATA "Nenhuma entrada para esta data." (voz neutra, sem CTA)', async () => {
    mockGet.mockResolvedValue({ data: dayWith([]) })
    renderSurface()
    expect(await screen.findByText('Nenhuma entrada para esta data.')).toBeInTheDocument()
  })

  it('lista as entradas do dia (texto + hora)', async () => {
    mockGet.mockResolvedValue({ data: dayWith([entry({ text: 'Grato pela chuva' })]) })
    renderSurface()
    expect(await screen.findByText('Grato pela chuva')).toBeInTheDocument()
  })
})

describe('GratitudeDaySurface — composer (AC1, AC2, AC7)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('adicionar entrada via composer: POST {text, date} e a entrada aparece; input reseta', async () => {
    // 1ª carga vazia; após POST + invalidação, o refetch traz a entrada.
    mockGet.mockResolvedValueOnce({ data: dayWith([]) })
    mockGet.mockResolvedValue({ data: dayWith([entry({ text: 'Grato pela família' })]) })
    mockPost.mockResolvedValueOnce({
      data: entry({ id: 'real-1', text: 'Grato pela família' }),
    })
    const user = userEvent.setup()
    renderSurface()

    await screen.findByText('Nenhuma entrada para esta data.')
    const field = screen.getByLabelText('Sua gratidão')
    await user.type(field, 'Grato pela família')
    await user.click(screen.getByRole('button', { name: 'Adicionar' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/gratitude/entries/', {
        text: 'Grato pela família',
        date: TODAY,
      }),
    )
    expect(await screen.findByText('Grato pela família')).toBeInTheDocument()
    // Input resetado no onSuccess.
    await waitFor(() => expect(field).toHaveValue(''))
  })

  it('múltiplas entradas na mesma data são exibidas (AC2)', async () => {
    mockGet.mockResolvedValue({
      data: dayWith([
        entry({ id: 'a', text: 'Primeira' }),
        entry({ id: 'b', text: 'Segunda' }),
      ]),
    })
    renderSurface()
    expect(await screen.findByText('Primeira')).toBeInTheDocument()
    expect(screen.getByText('Segunda')).toBeInTheDocument()
  })

  it('botão Adicionar fica desabilitado com texto vazio', async () => {
    mockGet.mockResolvedValue({ data: dayWith([]) })
    renderSurface()
    await screen.findByText('Nenhuma entrada para esta data.')
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeDisabled()
  })

  it('erro ao salvar: mostra alerta inline e PRESERVA o texto digitado (AC7)', async () => {
    // A carga inicial resolve (dia vazio); só o POST falha → mensagem inline padrão
    // (role="alert") e o texto digitado NÃO é perdido (reset só acontece no onSuccess).
    mockGet.mockResolvedValue({ data: dayWith([]) })
    mockPost.mockRejectedValueOnce(new Error('falha de rede'))
    const user = userEvent.setup()
    renderSurface()

    await screen.findByText('Nenhuma entrada para esta data.')
    const field = screen.getByLabelText('Sua gratidão')
    await user.type(field, 'Grato mesmo com erro')
    await user.click(screen.getByRole('button', { name: 'Adicionar' }))

    // AC7 — mensagem inline padrão (role="alert").
    expect(
      await screen.findByText('Não foi possível salvar. Tente novamente.'),
    ).toBeInTheDocument()
    // AC7 — o texto digitado é preservado até o rollback (sem reset no erro).
    expect(field).toHaveValue('Grato mesmo com erro')
  })
})

describe('GratitudeDaySurface — seletor de data (AC4, AC5)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('abre em hoje por padrão e "Próximo dia" fica desabilitado', async () => {
    mockGet.mockResolvedValue({ data: dayWith([]) })
    renderSurface()
    await screen.findByText('Nenhuma entrada para esta data.')
    expect(mockGet).toHaveBeenCalledWith('/api/gratitude/days/', { params: { date: TODAY } })
    expect(screen.getByRole('button', { name: 'Próximo dia' })).toBeDisabled()
  })

  it('trocar para o dia anterior busca a nova data', async () => {
    mockGet.mockResolvedValue({ data: dayWith([]) })
    const user = userEvent.setup()
    renderSurface()
    await screen.findByText('Nenhuma entrada para esta data.')
    await user.click(screen.getByRole('button', { name: 'Dia anterior' }))
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith('/api/gratitude/days/', {
        params: { date: YESTERDAY },
      }),
    )
    expect(screen.getByRole('button', { name: 'Próximo dia' })).toBeEnabled()
  })

  it('abre na data do ?date= (link "Gratidão de ontem")', async () => {
    mockGet.mockResolvedValue({ data: dayWith([], YESTERDAY) })
    renderSurface(`/gratitude?date=${YESTERDAY}`)
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith('/api/gratitude/days/', {
        params: { date: YESTERDAY },
      }),
    )
  })
})

describe('GratitudeDaySurface — acessibilidade', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sem violações de acessibilidade (jest-axe)', async () => {
    mockGet.mockResolvedValue({ data: dayWith([entry()]) })
    renderSurface()
    await screen.findByText('Grato pelo café')
    expect(await axe(document.body)).toHaveNoViolations()
  })
})
