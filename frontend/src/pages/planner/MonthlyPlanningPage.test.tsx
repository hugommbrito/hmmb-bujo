import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import client from '../../api/client'
import { createBujoTheme } from '../../theme'
import { MonthlyPlanningPage } from './MonthlyPlanningPage'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>

function mockMatchMediaDefault() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

const READINESS_WITH_TARGET = {
  active: { monthFirst: '2026-07-01', status: 'active', planningCompletedAt: null },
  planning: { monthFirst: '2026-08-01', status: 'planning', planningCompletedAt: null },
  start: { allowed: false, target: '2026-08-01', gates: { dateReached: false, planningCompleted: false, previousFinalized: false } },
  finalize: { allowed: false, target: '2026-07-01', gates: { noOpenTasks: false, nextPlanningExists: true } },
}

const EMPTY_RECURRING_SOURCE = {
  sourceId: 'recurring',
  blocking: false,
  countsTowardProgress: true,
  eligibleCount: 0,
  pendingDecisionCount: 0,
  reviewed: true,
  items: [],
  alreadyPlaced: { countsTowardProgress: false, items: [] },
  alreadyPlacedInYear: { countsTowardProgress: false, items: [] },
}

const EMPTY_TASK_SOURCE = {
  sourceId: 'future-log',
  blocking: false,
  countsTowardProgress: true,
  eligibleCount: 0,
  pendingDecisionCount: 0,
  reviewed: true,
  items: [],
}

const EMPTY_BLOCKING_SOURCE = {
  sourceId: 'previous-monthly',
  blocking: true,
  countsTowardProgress: true,
  eligibleCount: 0,
  pendingDecisionCount: 0,
  reviewed: true,
  items: [],
  readyToFinalize: false,
  previousPeriodStart: null,
}

const EMPTY_DENSITY = { days: [], undated: { total: 0, byStatus: { pending: 0, started: 0, completed: 0, cancelled: 0, migrated: 0, postponed: 0 } }, total: 0 }

function mockRoutes({
  readiness = READINESS_WITH_TARGET,
  recurring = EMPTY_RECURRING_SOURCE,
  futureLog = EMPTY_TASK_SOURCE,
  previousMonthly = EMPTY_BLOCKING_SOURCE,
  previousMonthlyStatus = 200,
  currentMonthFirst = '2026-07-01',
}: {
  readiness?: unknown
  recurring?: unknown
  futureLog?: unknown
  previousMonthly?: unknown
  previousMonthlyStatus?: number
  currentMonthFirst?: string
} = {}) {
  mockGet.mockImplementation((url: string) => {
    if (url === '/api/bujo/logs/monthly/cycle/') return Promise.resolve({ data: readiness })
    if (url === '/api/bujo/logs/monthly/') {
      return Promise.resolve({ data: { monthFirst: currentMonthFirst, tasks: [], closed: false, status: 'active', planningCompletedAt: null } })
    }
    if (url === '/api/bujo/rituals/monthly/sources/recurring/') return Promise.resolve({ data: recurring })
    if (url === '/api/bujo/rituals/monthly/sources/future-log/') return Promise.resolve({ data: futureLog })
    if (url === '/api/bujo/rituals/monthly/sources/previous-monthly/') {
      return previousMonthlyStatus === 200
        ? Promise.resolve({ data: previousMonthly })
        : Promise.reject(new Error('falha ao consultar previous-monthly'))
    }
    if (url === '/api/bujo/rituals/monthly/density/') return Promise.resolve({ data: EMPTY_DENSITY })
    return Promise.reject(new Error(`unhandled GET ${url}`))
  })
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={createBujoTheme('light')}>
        <MemoryRouter>
          <MonthlyPlanningPage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('MonthlyPlanningPage — três regiões (AC5)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMatchMediaDefault()
  })

  it('renderiza main, nav de fontes e a lista de decisões da fonte ativa', async () => {
    mockRoutes()
    renderPage()
    expect(await screen.findByRole('navigation', { name: 'Fontes do planejamento mensal' })).toBeInTheDocument()
    expect(screen.getByRole('main', { name: 'Planejar Agosto de 2026' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Decisões — Recorrentes' })).toBeInTheDocument()
  })

  it('sem alvo de planejamento, mostra mensagem em vez da lista', async () => {
    mockRoutes({ readiness: { active: null, planning: null, start: null, finalize: null } })
    renderPage()
    expect(await screen.findByText('Nenhum mês em planejamento no momento.')).toBeInTheDocument()
  })

  it('trocar de fonte no rail muda a fonte exibida na lista', async () => {
    mockRoutes()
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento mensal' })
    fireEvent.click(screen.getByRole('button', { name: /Monthly anterior/ }))
    expect(await screen.findByRole('region', { name: 'Decisões — Monthly anterior' })).toBeInTheDocument()
  })

  it('jest-axe: sem violações', async () => {
    mockRoutes()
    const { container } = renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento mensal' })
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('MonthlyPlanningPage — fontes independentes (AC5)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMatchMediaDefault()
  })

  it('uma fonte em erro (previous-monthly) NÃO bloqueia as outras', async () => {
    mockRoutes({ previousMonthlyStatus: 500 })
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento mensal' })

    expect(screen.getByRole('region', { name: 'Decisões — Recorrentes' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Monthly anterior/ }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Future Log/ }))
    expect(screen.getByRole('region', { name: 'Decisões — Future Log' })).toBeInTheDocument()
  })
})

describe('MonthlyPlanningPage — destino "month" vs "future" (Dev Notes: TaskMigrateSerializer)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMatchMediaDefault()
  })

  it('mês-alvo DIFERENTE do corrente: confirma com destination "future" + monthFirst explícito', async () => {
    mockRoutes({
      currentMonthFirst: '2026-07-01',
      previousMonthly: {
        ...EMPTY_BLOCKING_SOURCE,
        items: [{ task: { id: 't-1', title: 'Revisar', status: 'pending', eisenhower: null, category: null, subtasks: [], scheduledDate: '2026-07-20' }, decision: null }],
      },
    })
    mockPost.mockResolvedValueOnce({ data: { id: 't-1' } })
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento mensal' })
    fireEvent.click(screen.getByRole('button', { name: /Monthly anterior/ }))
    await screen.findByText('Revisar')

    fireEvent.click(screen.getByRole('button', { name: 'Escolher destino…' }))
    fireEvent.click(await screen.findByRole('gridcell', { name: '18' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/api/bujo/tasks/t-1/migrate/',
        expect.objectContaining({ destination: 'future', monthFirst: '2026-08-01', scheduledDate: '2026-08-18' }),
      ),
    )
  })

  it('mês-alvo COINCIDE com o corrente (regularização atrasada): destination "month", sem monthFirst', async () => {
    mockRoutes({
      currentMonthFirst: '2026-08-01', // igual ao alvo em planejamento
      previousMonthly: {
        ...EMPTY_BLOCKING_SOURCE,
        items: [{ task: { id: 't-2', title: 'Atrasada', status: 'pending', eisenhower: null, category: null, subtasks: [], scheduledDate: null }, decision: null }],
      },
    })
    mockPost.mockResolvedValueOnce({ data: { id: 't-2' } })
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento mensal' })
    fireEvent.click(screen.getByRole('button', { name: /Monthly anterior/ }))
    await screen.findByText('Atrasada')

    fireEvent.click(screen.getByRole('button', { name: 'Escolher destino…' }))
    fireEvent.click(await screen.findByRole('gridcell', { name: '5' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/api/bujo/tasks/t-2/migrate/',
        expect.objectContaining({ destination: 'month', scheduledDate: '2026-08-05' }),
      ),
    )
    const [, body] = mockPost.mock.calls[0]
    expect(body).not.toHaveProperty('monthFirst')
  })

  it('mês-alvo ANTES do corrente (meses pulados, AC3): bloqueia local, sem POST, com motivo explicativo', async () => {
    // `next_monthly_target` (backend) não tem piso — em catch-up de meses
    // pulados, `planning.monthFirst` fica ANTES do mês corrente real. Nem
    // `destination: 'future'` (exige monthFirst > corrente) nem `'month'`
    // (sempre resolve para o corrente, não para o alvo) conseguem migrar PARA
    // o próprio alvo já passado — `monthWouldBeRejectedAsFuture()` deve
    // bloquear ANTES do POST, não deixar o servidor responder 400.
    mockRoutes({
      readiness: { ...READINESS_WITH_TARGET, planning: { monthFirst: '2026-08-01', status: 'planning', planningCompletedAt: null } },
      currentMonthFirst: '2026-09-01', // corrente estritamente DEPOIS do alvo em planejamento
      previousMonthly: {
        ...EMPTY_BLOCKING_SOURCE,
        items: [{ task: { id: 't-3', title: 'Atrasadíssima', status: 'pending', eisenhower: null, category: null, subtasks: [], scheduledDate: null }, decision: null }],
      },
    })
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento mensal' })
    fireEvent.click(screen.getByRole('button', { name: /Monthly anterior/ }))
    await screen.findByText('Atrasadíssima')

    fireEvent.click(screen.getByRole('button', { name: 'Escolher destino…' }))
    fireEvent.click(await screen.findByRole('gridcell', { name: '5' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    // Escopado ao dialog: a fonte bloqueante (Monthly anterior) TAMBÉM usa
    // `role="alert"` para seu aviso persistente — sem escopo, colide (mesma
    // razão documentada no Completion Notes da story para o teste de retry).
    const dialog = screen.getByRole('dialog', { name: 'Escolher destino' })
    await waitFor(() =>
      expect(within(dialog).getByRole('alert')).toHaveTextContent('já é anterior ao mês atual'),
    )
    expect(mockPost).not.toHaveBeenCalled()
    // O seletor continua aberto — mesma disciplina de falha de AC5.
    expect(dialog).toBeInTheDocument()
  })
})

describe('MonthlyPlanningPage — sem "Cancelar planejamento" (AC3, divergência do Weekly)', () => {
  it('nenhum botão "Cancelar planejamento" existe nesta tela', async () => {
    mockRoutes()
    mockMatchMediaDefault()
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento mensal' })
    expect(screen.queryByRole('button', { name: 'Cancelar planejamento' })).not.toBeInTheDocument()
  })
})

describe('MonthlyPlanningPage — falha de decisão preserva item e oferece retry (AC5)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMatchMediaDefault()
  })

  it('Concluir falhando mostra o motivo + Tentar novamente; retry repete a MESMA ação', async () => {
    mockRoutes({
      previousMonthly: {
        ...EMPTY_BLOCKING_SOURCE,
        items: [
          {
            task: { id: 't-1', title: 'Revisar orçamento', status: 'pending', eisenhower: null, category: null, subtasks: [], scheduledDate: '2026-07-20' },
            decision: null,
          },
        ],
      },
    })
    mockPost.mockRejectedValueOnce(new Error('falha de rede'))
    mockPost.mockResolvedValueOnce({ data: { id: 't-1', title: 'Revisar orçamento', status: 'completed', eisenhower: null, category: null, subtasks: [] } })
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento mensal' })
    fireEvent.click(screen.getByRole('button', { name: /Monthly anterior/ }))
    await screen.findByText('Revisar orçamento')

    // Escopado à região de decisões: o rail de contexto TAMBÉM usa
    // `role="alert"` para o aviso bloqueante persistente do Monthly anterior
    // (AC5) — sem escopo, `getByRole('alert')` colide com os dois.
    const decisions = screen.getByRole('region', { name: 'Decisões — Monthly anterior' })
    fireEvent.click(within(decisions).getByRole('button', { name: 'Concluir' }))
    await waitFor(() =>
      expect(within(decisions).getByRole('alert')).toHaveTextContent('Não foi possível salvar a decisão'),
    )
    // O item continua na lista — falha não some com ele.
    expect(within(decisions).getByText('Revisar orçamento')).toBeInTheDocument()

    fireEvent.click(within(decisions).getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() =>
      expect(mockPost).toHaveBeenLastCalledWith('/api/bujo/tasks/t-1/transition/', { toStatus: 'completed' }),
    )
    expect(mockPost).toHaveBeenCalledTimes(2)
  })
})

describe('MonthlyPlanningPage — falha na confirmação de destino preserva o seletor aberto (AC5)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMatchMediaDefault()
  })

  it('POST de migrate falhando NÃO fecha o seletor e mostra o motivo', async () => {
    mockRoutes({
      futureLog: {
        ...EMPTY_TASK_SOURCE,
        items: [
          {
            task: { id: 't-1', title: 'Item do Future Log', status: 'pending', eisenhower: null, category: null, subtasks: [], scheduledDate: null },
            decision: null,
          },
        ],
      },
    })
    mockPost.mockRejectedValueOnce(new Error('falha de rede'))
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento mensal' })
    fireEvent.click(screen.getByRole('button', { name: /Future Log/ }))
    await screen.findByText('Item do Future Log')

    fireEvent.click(screen.getByRole('button', { name: 'Escolher destino…' }))
    fireEvent.click(await screen.findByRole('gridcell', { name: '18' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível migrar a tarefa'))
    // O seletor continua aberto — falha preserva item/foco (AC5).
    expect(screen.getByRole('dialog', { name: 'Escolher destino' })).toBeInTheDocument()
  })
})

describe('MonthlyPlanningPage — offline (AC7)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMatchMediaDefault()
  })

  it('sem rede: aviso persistente role=status e decisões indisponíveis', async () => {
    mockRoutes({
      previousMonthly: {
        ...EMPTY_BLOCKING_SOURCE,
        items: [
          {
            task: { id: 't-1', title: 'Revisar orçamento', status: 'pending', eisenhower: null, category: null, subtasks: [], scheduledDate: '2026-07-20' },
            decision: null,
          },
        ],
      },
    })
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento mensal' })
    fireEvent.click(screen.getByRole('button', { name: /Monthly anterior/ }))
    await screen.findByText('Revisar orçamento')

    expect(screen.getByRole('status')).toHaveTextContent('Sem conexão')
    expect(screen.getByRole('button', { name: 'Concluir' })).toHaveAttribute('aria-disabled', 'true')

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })
})
