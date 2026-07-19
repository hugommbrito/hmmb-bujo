import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'

vi.mock('../../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import client from '../../../api/client'
import { HealthMetricsLog } from './HealthMetricsLog'
import type { HealthDaily, HealthFieldDefinition } from '../types'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPut = client.put as ReturnType<typeof vi.fn>

const F_PESO: HealthFieldDefinition = {
  id: 'f-peso',
  name: 'Peso',
  fieldType: 'decimal',
  enumOptions: [],
  active: true,
  displayOrder: 0,
}
const F_EXERCICIO: HealthFieldDefinition = {
  id: 'f-exercicio',
  name: 'Exercício',
  fieldType: 'boolean',
  enumOptions: [],
  active: true,
  displayOrder: 1,
}
const F_HUMOR: HealthFieldDefinition = {
  id: 'f-humor',
  name: 'Humor',
  fieldType: 'enum',
  enumOptions: ['Bom', 'Ruim'],
  active: true,
  displayOrder: 2,
}
const F_NOTAS: HealthFieldDefinition = {
  id: 'f-notas',
  name: 'Notas',
  fieldType: 'text',
  enumOptions: [],
  active: true,
  displayOrder: 3,
}

const DAILY: HealthDaily = {
  yesterday: { date: '2026-07-18', values: { 'f-peso': 80 } },
  today: { date: '2026-07-19', values: {} },
  fields: [F_PESO, F_EXERCICIO, F_HUMOR, F_NOTAS],
}

function setDaily(daily: HealthDaily) {
  mockGet.mockImplementation(() => Promise.resolve({ data: daily }))
}

function renderLog() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <HealthMetricsLog />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('HealthMetricsLog', () => {
  beforeEach(() => vi.resetAllMocks())

  it('mostra "Ontem, [data]" no topo e "Hoje, [data]" abaixo (AC3)', async () => {
    setDaily(DAILY)
    renderLog()

    const ontem = await screen.findByRole('heading', { name: /^Ontem, 18 de julho de 2026$/ })
    const hoje = screen.getByRole('heading', { name: /^Hoje, 19 de julho de 2026$/ })
    expect(ontem).toBeInTheDocument()
    expect(hoje).toBeInTheDocument()
    // Ontem aparece antes de Hoje no DOM (ritual matinal).
    expect(ontem.compareDocumentPosition(hoje) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renderiza cada campo pelo tipo (AC5)', async () => {
    setDaily(DAILY)
    renderLog()

    // Cada campo aparece nas duas seções (ontem + hoje) → 2 controles por campo.
    const pesos = await screen.findAllByLabelText('Peso')
    expect(pesos).toHaveLength(2)
    expect(pesos[0]).toHaveAttribute('type', 'number')
    expect(pesos[0]).toHaveAttribute('inputMode', 'decimal')

    expect(screen.getAllByRole('checkbox', { name: 'Exercício' })).toHaveLength(2) // Switch
    expect(screen.getAllByRole('combobox', { name: 'Humor' })).toHaveLength(2) // Select
    expect(screen.getAllByLabelText('Notas')).toHaveLength(2) // TextField
  })

  it('mostra o valor já gravado do dia (ontem: Peso=80)', async () => {
    setDaily(DAILY)
    renderLog()

    const ontem = await screen.findByRole('region', { name: /^Ontem,/ })
    expect(within(ontem).getByLabelText('Peso')).toHaveValue(80)
    const hoje = screen.getByRole('region', { name: /^Hoje,/ })
    expect(within(hoje).getByLabelText('Peso')).toHaveValue(null) // vazio
  })

  it('salva o dia e mostra confirmação inline "Dados de hoje salvos." (AC5)', async () => {
    setDaily(DAILY)
    mockPut.mockResolvedValueOnce({
      data: { id: 'log-1', date: '2026-07-19', values: { 'f-peso': 88 } },
    })
    renderLog()

    const hoje = await screen.findByRole('region', { name: /^Hoje,/ })
    // jsdom: <input type=number> não aceita userEvent.type → fireEvent.change.
    fireEvent.change(within(hoje).getByLabelText('Peso'), { target: { value: '88' } })
    await userEvent.click(within(hoje).getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(within(hoje).getByText('Dados de hoje salvos.')).toBeInTheDocument(),
    )
    expect(mockPut).toHaveBeenCalledWith(
      '/api/health-logs/',
      expect.objectContaining({ date: '2026-07-19', values: expect.objectContaining({ 'f-peso': 88 }) }),
    )
  })

  it('só renderiza os campos ativos retornados pelo backend (AC4)', async () => {
    // O read-model já exclui inativos; a superfície reflete só `fields`.
    setDaily({ ...DAILY, fields: [F_PESO] })
    renderLog()

    await screen.findAllByLabelText('Peso')
    expect(screen.queryByRole('checkbox', { name: 'Exercício' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Humor' })).not.toBeInTheDocument()
  })

  it('estado vazio: sem campos ativos → frase + link para Configurações', async () => {
    setDaily({ ...DAILY, fields: [] })
    renderLog()

    expect(await screen.findByText('Nenhum campo de saúde ativo.')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Configurar métricas de saúde/ })
    expect(link).toHaveAttribute('href', '/settings/health-metrics')
  })

  it('erro de leitura: mensagem local + retry', async () => {
    mockGet.mockRejectedValue(new Error('boom'))
    renderLog()

    expect(
      await screen.findByText('Não foi possível carregar as métricas de saúde.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
  })

  it('erro de escrita: mensagem + input preservado', async () => {
    setDaily(DAILY)
    mockPut.mockRejectedValueOnce(new Error('fail'))
    renderLog()

    const hoje = await screen.findByRole('region', { name: /^Hoje,/ })
    const peso = within(hoje).getByLabelText('Peso')
    fireEvent.change(peso, { target: { value: '77' } })
    await userEvent.click(within(hoje).getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(within(hoje).getByText('Não foi possível salvar. Tente novamente.')).toBeInTheDocument(),
    )
    // Input preservado após a falha.
    expect(within(hoje).getByLabelText('Peso')).toHaveValue(77)
  })

  it('não tem violações de acessibilidade (jest-axe)', async () => {
    setDaily(DAILY)
    const { container } = renderLog()
    await screen.findAllByLabelText('Peso')
    expect(await axe(container)).toHaveNoViolations()
  })
})
