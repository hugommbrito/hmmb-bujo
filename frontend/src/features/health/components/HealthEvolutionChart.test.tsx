import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'

import { createBujoTheme } from '../../../theme'

vi.mock('../../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import client from '../../../api/client'
import { HealthEvolutionChart } from './HealthEvolutionChart'
import type { HealthFieldDefinition, HealthFieldSeries } from '../types'

const mockGet = client.get as ReturnType<typeof vi.fn>

// recharts + jsdom: ResponsiveContainer usa ResizeObserver (não existe em jsdom) e
// mede por getBoundingClientRect. Sem estes mocks recharts lança. Damos dimensões
// fixas; as asserções são DOM próprio (role=img/aria-label/figcaption), não o SVG.
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

const NUMERIC_FIELDS: HealthFieldDefinition[] = [
  { id: 'f-peso', name: 'Peso', fieldType: 'decimal', enumOptions: [], active: true, displayOrder: 0 },
]

const SERIES: HealthFieldSeries = {
  field: NUMERIC_FIELDS[0],
  points: [
    { date: '2026-02-03', value: 80.5 },
    { date: '2026-02-05', value: 82 },
  ],
}

const RANGE = { start: '2026-02-01', end: '2026-02-28' }

function renderChart(numericFields = NUMERIC_FIELDS) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={createBujoTheme('light')}>
        <HealthEvolutionChart numericFields={numericFields} range={RANGE} />
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('HealthEvolutionChart', () => {
  beforeEach(() => vi.clearAllMocks())

  it('mostra estado vazio quando não há campo numérico', () => {
    renderChart([])
    expect(screen.getByText('Nenhum campo numérico para gráfico.')).toBeInTheDocument()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('pede para selecionar um campo antes de buscar a série', () => {
    renderChart()
    expect(screen.getByText('Selecione um campo numérico.')).toBeInTheDocument()
    // enabled:false com fieldId vazio → nenhuma requisição.
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('o seletor oferece o campo numérico como opção', async () => {
    renderChart()
    fireEvent.mouseDown(screen.getByRole('combobox'))
    expect(await screen.findByRole('option', { name: 'Peso' })).toBeInTheDocument()
  })

  it('renderiza o gráfico com role=img e aria-label de resumo ao selecionar', async () => {
    mockGet.mockResolvedValueOnce({ data: SERIES })
    renderChart()

    fireEvent.mouseDown(screen.getByRole('combobox'))
    fireEvent.click(await screen.findByRole('option', { name: 'Peso' }))

    const img = await screen.findByRole('img')
    expect(img.getAttribute('aria-label')).toMatch(/Evolução de Peso/)
    expect(img.getAttribute('aria-label')).toMatch(/2 dias com registro/)
    // figcaption com o mesmo resumo textual.
    expect(screen.getByText(/Evolução de Peso de 01\/02\/2026 a 28\/02\/2026/)).toBeInTheDocument()
    expect(mockGet).toHaveBeenCalledWith('/api/health-logs/series/', {
      params: { field: 'f-peso', start: '2026-02-01', end: '2026-02-28' },
    })
  })

  it('mostra erro com retry local ao selecionar (AC4)', async () => {
    mockGet.mockRejectedValueOnce(new Error('falhou'))
    renderChart()

    fireEvent.mouseDown(screen.getByRole('combobox'))
    fireEvent.click(await screen.findByRole('option', { name: 'Peso' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Não foi possível carregar a série.')
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade com o gráfico renderizado', async () => {
    mockGet.mockResolvedValue({ data: SERIES })
    const { container } = renderChart()

    fireEvent.mouseDown(screen.getByRole('combobox'))
    fireEvent.click(await screen.findByRole('option', { name: 'Peso' }))
    await screen.findByRole('img')

    expect(await axe(container)).toHaveNoViolations()
  })
})
