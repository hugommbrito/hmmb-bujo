import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'

import { createBujoTheme } from '../../../theme'

vi.mock('../../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import client from '../../../api/client'
import { HealthHistory } from './HealthHistory'
import type { HealthHistory as HealthHistoryData } from '../types'

const mockGet = client.get as ReturnType<typeof vi.fn>

// recharts mocks (o gráfico só renderiza SVG ao selecionar um campo, mas mantemos
// os mocks por segurança para não estourar caso a árvore monte o ResponsiveContainer).
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      width: 600, height: 300, top: 0, left: 0, right: 600, bottom: 300, x: 0, y: 0,
      toJSON: () => {},
    }),
  })
})

const HISTORY: HealthHistoryData = {
  start: '2026-02-01',
  end: '2026-02-28',
  fields: [
    { id: 'f-peso', name: 'Peso', fieldType: 'decimal', enumOptions: [], active: true, displayOrder: 0 },
  ],
  days: [{ date: '2026-02-03', values: { 'f-peso': 80.5 } }],
  summary: [{ fieldId: 'f-peso', count: 1, min: 80.5, max: 80.5, avg: 80.5, latest: 80.5 }],
}

function renderHistory() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={createBujoTheme('light')}>
        <HealthHistory />
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('HealthHistory', () => {
  // vi.clearAllMocks (NÃO resetAllMocks): resetAllMocks apagaria o mock global de
  // window.matchMedia do qual useMediaQuery (na tabela) depende (armadilha de 6.4).
  beforeEach(() => vi.clearAllMocks())

  it('renderiza o controle de intervalo (período anterior/próximo + datas)', () => {
    mockGet.mockReturnValue(new Promise(() => {})) // pendente
    renderHistory()
    expect(screen.getByRole('button', { name: 'Período anterior' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próximo período' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Início do intervalo/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Fim do intervalo/)).toBeInTheDocument()
  })

  it('mostra o estado de carregamento', () => {
    mockGet.mockReturnValue(new Promise(() => {}))
    renderHistory()
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Carregando histórico…')
  })

  it('mostra estado vazio quando não há campos de saúde', async () => {
    mockGet.mockResolvedValueOnce({ data: { ...HISTORY, fields: [], days: [], summary: [] } })
    renderHistory()
    expect(
      await screen.findByText('Nenhum campo de saúde para exibir.'),
    ).toBeInTheDocument()
  })

  it('mostra erro com retry', async () => {
    mockGet.mockRejectedValueOnce(new Error('falhou'))
    renderHistory()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Não foi possível carregar o histórico.')
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
  })

  it('compõe as três visualizações (dashboard + gráfico + tabela)', async () => {
    mockGet.mockResolvedValue({ data: HISTORY })
    renderHistory()
    expect(await screen.findByRole('heading', { name: 'Resumo do período' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Evolução' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tabela por data' })).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade', async () => {
    mockGet.mockResolvedValue({ data: HISTORY })
    const { container } = renderHistory()
    await screen.findByRole('heading', { name: 'Resumo do período' })
    expect(await axe(container)).toHaveNoViolations()
  })
})
