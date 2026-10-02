import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
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

// `finalize.gates.noOpenTasks: true` casa com `EMPTY_BLOCKING_SOURCE` (0 itens):
// desde a Story 14.11 o rail lê a verdade do servidor, e um gate ✗ com fonte
// vazia é o estado defensivo "subtarefas fora desta lista" (coberto à parte).
const READINESS_WITH_TARGET = {
  active: { monthFirst: '2026-07-01', status: 'active', planningCompletedAt: null },
  planning: { monthFirst: '2026-08-01', status: 'planning', planningCompletedAt: null },
  start: { allowed: false, target: '2026-08-01', gates: { dateReached: false, planningCompleted: false, previousFinalized: false } },
  finalize: { allowed: true, target: '2026-07-01', gates: { noOpenTasks: true, nextPlanningExists: true } },
}

/** 409 de gate de ciclo, como `core/exceptions.py` o emite (Story 14.11). */
function conflict409(detail: string, code: string): AxiosError {
  const response = {
    status: 409,
    data: { detail, code },
    statusText: 'Conflict',
    headers: {},
    config: { headers: new AxiosHeaders() },
  } as AxiosResponse
  return new AxiosError('Request failed with status code 409', 'ERR_BAD_REQUEST', response.config, undefined, response)
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
  monthlyDensity = EMPTY_DENSITY,
}: {
  readiness?: unknown
  recurring?: unknown
  futureLog?: unknown
  previousMonthly?: unknown
  previousMonthlyStatus?: number
  currentMonthFirst?: string
  monthlyDensity?: unknown
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
    // UMA fonte de densidade para o mês-alvo: alimenta o minicalendário do rail
    // de contexto E o calendário do seletor de destino. Nenhum `/task-density/`
    // aqui — o seletor não consulta nada por conta própria, senão os dois
    // calendários da mesma tela poderiam divergir (achado de review).
    if (url === '/api/bujo/rituals/monthly/density/') return Promise.resolve({ data: monthlyDensity })
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
    fireEvent.click(await screen.findByRole('button', { name: '18 de agosto, sem tarefas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Migrar para 18 de agosto' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/api/bujo/tasks/t-1/migrate/',
        expect.objectContaining({ destination: 'future', monthFirst: '2026-08-01', scheduledDate: '2026-08-18' }),
      ),
    )
  })

  it('mês-alvo COINCIDE com o corrente: destination "month" + monthFirst explícito (adaptador único, Story 14.11)', async () => {
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
    fireEvent.click(await screen.findByRole('button', { name: '5 de agosto, sem tarefas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Migrar para 5 de agosto' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/api/bujo/tasks/t-2/migrate/',
        expect.objectContaining({ destination: 'month', monthFirst: '2026-08-01', scheduledDate: '2026-08-05' }),
      ),
    )
  })

  it('mês-alvo ANTES do corrente (regularização atrasada, Story 14.11): POST month + monthFirst = alvo, sem guard local', async () => {
    // `next_monthly_target` (backend) não tem piso — em catch-up de meses
    // pulados, `planning.monthFirst` fica ANTES do mês corrente real. O servidor
    // aceita `'month'` + `monthFirst` na faixa `[alvo, corrente]`, então o guard
    // local da 14.6 (`monthWouldBeRejectedAsFuture`) deixou de existir.
    mockRoutes({
      readiness: { ...READINESS_WITH_TARGET, planning: { monthFirst: '2026-08-01', status: 'planning', planningCompletedAt: null } },
      currentMonthFirst: '2026-09-01', // corrente estritamente DEPOIS do alvo em planejamento
      previousMonthly: {
        ...EMPTY_BLOCKING_SOURCE,
        items: [{ task: { id: 't-3', title: 'Atrasadíssima', status: 'pending', eisenhower: null, category: null, subtasks: [], scheduledDate: null }, decision: null }],
      },
    })
    mockPost.mockResolvedValueOnce({ data: { id: 't-3' } })
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento mensal' })
    fireEvent.click(screen.getByRole('button', { name: /Monthly anterior/ }))
    await screen.findByText('Atrasadíssima')

    fireEvent.click(screen.getByRole('button', { name: 'Escolher destino…' }))
    fireEvent.click(await screen.findByRole('button', { name: '5 de agosto, sem tarefas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Migrar para 5 de agosto' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/api/bujo/tasks/t-3/migrate/',
        expect.objectContaining({ destination: 'month', monthFirst: '2026-08-01', scheduledDate: '2026-08-05' }),
      ),
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Escolher destino' })).not.toBeInTheDocument(),
    )
  })

  it('"Migrar para dia N" (atalho) com alvo passado também usa month + monthFirst', async () => {
    mockRoutes({
      readiness: { ...READINESS_WITH_TARGET, planning: { monthFirst: '2026-08-01', status: 'planning', planningCompletedAt: null } },
      currentMonthFirst: '2026-09-01',
      previousMonthly: {
        ...EMPTY_BLOCKING_SOURCE,
        items: [{ task: { id: 't-4', title: 'Cardiologista', status: 'started', eisenhower: null, category: null, subtasks: [], scheduledDate: '2026-07-20' }, decision: null }],
      },
    })
    mockPost.mockResolvedValueOnce({ data: { id: 't-4' } })
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento mensal' })
    fireEvent.click(screen.getByRole('button', { name: /Monthly anterior/ }))
    await screen.findByText('Cardiologista')

    fireEvent.click(screen.getByRole('button', { name: 'Migrar para dia 20' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/api/bujo/tasks/t-4/migrate/',
        expect.objectContaining({ destination: 'month', monthFirst: '2026-08-01', scheduledDate: '2026-08-20' }),
      ),
    )
  })

  it('"Adiar": alvo+1 ≤ corrente manda month + monthFirst (rótulo nomeia o mês); alvo+1 > corrente manda future ("Adiar ao Future Log")', async () => {
    const item = { task: { id: 't-5', title: 'Adiável', status: 'pending', eisenhower: null, category: null, subtasks: [], scheduledDate: null }, decision: null }

    // Regularização atrasada: alvo ago, corrente set ⇒ "adiar" cai em setembro (= corrente).
    mockRoutes({
      readiness: { ...READINESS_WITH_TARGET, planning: { monthFirst: '2026-08-01', status: 'planning', planningCompletedAt: null } },
      currentMonthFirst: '2026-09-01',
      previousMonthly: { ...EMPTY_BLOCKING_SOURCE, items: [item] },
    })
    mockPost.mockResolvedValueOnce({ data: { id: 't-5' } })
    const first = renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento mensal' })
    fireEvent.click(screen.getByRole('button', { name: /Monthly anterior/ }))
    await screen.findByText('Adiável')
    // Review 14.11: com alvo passado o rótulo nomeia o mês real do destino
    // (alvo+1 = setembro = corrente ⇒ `'month'`), não "Future Log".
    expect(screen.queryByRole('button', { name: 'Adiar ao Future Log' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Adiar para Setembro de 2026' }))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/api/bujo/tasks/t-5/migrate/',
        expect.objectContaining({ destination: 'month', monthFirst: '2026-09-01' }),
      ),
    )
    first.unmount()
    vi.resetAllMocks()
    mockMatchMediaDefault()

    // Cenário regular: alvo ago, corrente jul ⇒ "adiar" cai em setembro (> corrente) ⇒ future.
    mockRoutes({ currentMonthFirst: '2026-07-01', previousMonthly: { ...EMPTY_BLOCKING_SOURCE, items: [item] } })
    mockPost.mockResolvedValueOnce({ data: { id: 't-5' } })
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento mensal' })
    fireEvent.click(screen.getByRole('button', { name: /Monthly anterior/ }))
    await screen.findByText('Adiável')
    fireEvent.click(screen.getByRole('button', { name: 'Adiar ao Future Log' }))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/api/bujo/tasks/t-5/migrate/',
        expect.objectContaining({ destination: 'future', monthFirst: '2026-09-01' }),
      ),
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Story 14.11 — regularização atrasada: faixa, 409 explicado, readiness em
// erro, sem alvo.
// ─────────────────────────────────────────────────────────────────────────────
describe('MonthlyPlanningPage — regularização atrasada (Story 14.11)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMatchMediaDefault()
  })

  it('alvo anterior ao corrente: faixa com passos e "Próximo passo" no 1º ✗; meta de mês passado na lista', async () => {
    mockRoutes({
      readiness: {
        ...READINESS_WITH_TARGET,
        planning: { monthFirst: '2026-08-01', status: 'planning', planningCompletedAt: '2026-07-31T10:00:00Z' },
        start: { allowed: false, target: '2026-08-01', gates: { dateReached: true, planningCompleted: true, previousFinalized: false } },
        finalize: { allowed: false, target: '2026-07-01', gates: { noOpenTasks: false, nextPlanningExists: true } },
      },
      currentMonthFirst: '2026-09-01',
      previousMonthly: {
        ...EMPTY_BLOCKING_SOURCE,
        previousPeriodStart: '2026-07-01',
        items: [{ task: { id: 't-1', title: 'Cardiologista', status: 'started', eisenhower: null, category: null, subtasks: [], scheduledDate: null, }, decision: null, parentTitle: 'Consultas' }],
      },
    })
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento mensal' })

    const banner = screen.getByRole('status', { name: 'Regularização atrasada' })
    expect(banner).toHaveTextContent('O alvo deste ritual é Agosto de 2026, anterior ao mês corrente (Setembro de 2026)')
    expect(within(banner).getByText('Próximo passo: Finalizar Julho de 2026')).toBeInTheDocument()

    expect(screen.getByText('Agosto de 2026 já passou — as decisões abaixo regularizam o registro desse mês.')).toBeInTheDocument()

    // A subtarefa-cabeça aparece na fonte bloqueante, nomeando o pai. Escopado
    // ao rail de fontes: o aviso do rail de contexto ("Monthly anterior: …")
    // também é um botão com esse nome.
    const sourceRail = screen.getByRole('navigation', { name: 'Fontes do planejamento mensal' })
    fireEvent.click(within(sourceRail).getByRole('button', { name: /Monthly anterior/ }))
    await screen.findByText('Cardiologista')
    expect(screen.getByText('Subtarefa de Consultas')).toBeInTheDocument()
  })

  it('alvo igual/posterior ao corrente: sem faixa, sem meta de mês passado', async () => {
    mockRoutes() // alvo ago, corrente jul
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento mensal' })
    expect(screen.queryByRole('status', { name: 'Regularização atrasada' })).not.toBeInTheDocument()
    expect(screen.queryByText(/já passou/)).not.toBeInTheDocument()
  })

  it('POST de ciclo rejeitado com 409: o detail do servidor aparece em role="alert" e o botão segue clicável', async () => {
    mockRoutes()
    mockPost.mockRejectedValueOnce(
      conflict409('Conclua o planejamento do mês (01/08/2026) antes de iniciar.', 'planning_completed'),
    )
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento mensal' })

    // `Iniciar mês` está desabilitado pela readiness; "Concluir planejamento" não.
    const button = screen.getByRole('button', { name: 'Concluir planejamento' })
    fireEvent.click(button)

    const alert = await screen.findByText('Conclua o planejamento do mês (01/08/2026) antes de iniciar.')
    expect(alert.closest('[role="alert"]')).not.toBeNull()
    expect(button).not.toBeDisabled()
    expect(mockPost).toHaveBeenCalledWith('/api/bujo/logs/monthly/cycle/', { action: 'complete_planning', monthFirst: '2026-08-01' })

    // Fora do 409: fallback genérico da ação, nunca o erro cru.
    mockPost.mockRejectedValueOnce(new Error('Network Error'))
    fireEvent.click(button)
    expect(await screen.findByText('Não foi possível concluir o planejamento. Tente novamente.')).toBeInTheDocument()
  })

  it('"Finalizar mês anterior" usa o alvo da readiness (finalize.target) e explica o 409', async () => {
    mockRoutes()
    mockPost.mockRejectedValueOnce(
      conflict409('Ainda há tarefas pendentes ou iniciadas no mês (01/07/2026), subtarefas incluídas — decida todas antes de finalizar.', 'no_open_tasks'),
    )
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento mensal' })

    fireEvent.click(screen.getByRole('button', { name: 'Finalizar mês anterior' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/logs/monthly/cycle/', { action: 'finalize', monthFirst: '2026-07-01' }),
    )
    expect(await screen.findByText(/subtarefas incluídas — decida todas antes de finalizar/)).toBeInTheDocument()
  })

  it('readiness em erro: alerta com Tentar novamente (refetch), nunca "nenhum mês em planejamento"', async () => {
    let fail = true
    mockGet.mockImplementation((url: string) => {
      if (url === '/api/bujo/logs/monthly/cycle/') {
        return fail ? Promise.reject(new Error('500')) : Promise.resolve({ data: READINESS_WITH_TARGET })
      }
      if (url === '/api/bujo/logs/monthly/') {
        return Promise.resolve({ data: { monthFirst: '2026-07-01', tasks: [], closed: false, status: 'active', planningCompletedAt: null } })
      }
      if (url === '/api/bujo/rituals/monthly/sources/recurring/') return Promise.resolve({ data: EMPTY_RECURRING_SOURCE })
      if (url === '/api/bujo/rituals/monthly/sources/future-log/') return Promise.resolve({ data: EMPTY_TASK_SOURCE })
      if (url === '/api/bujo/rituals/monthly/sources/previous-monthly/') return Promise.resolve({ data: EMPTY_BLOCKING_SOURCE })
      if (url === '/api/bujo/rituals/monthly/density/') return Promise.resolve({ data: EMPTY_DENSITY })
      return Promise.reject(new Error(`unhandled GET ${url}`))
    })
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Não foi possível carregar a prontidão do ciclo mensal.')
    expect(screen.queryByText('Nenhum mês em planejamento no momento.')).not.toBeInTheDocument()

    fail = false
    fireEvent.click(within(alert).getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('main', { name: 'Planejar Agosto de 2026' })).toBeInTheDocument()
  })

  // Review 14.11 — o adaptador de destino depende do mês corrente.
  it('mês corrente ainda em voo: "Migrar para dia N" não faz POST e explica que ainda não carregou', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/api/bujo/logs/monthly/cycle/') return Promise.resolve({ data: READINESS_WITH_TARGET })
      if (url === '/api/bujo/logs/monthly/') return new Promise(() => {}) // nunca resolve
      if (url === '/api/bujo/rituals/monthly/sources/recurring/') return Promise.resolve({ data: EMPTY_RECURRING_SOURCE })
      if (url === '/api/bujo/rituals/monthly/sources/future-log/') return Promise.resolve({ data: EMPTY_TASK_SOURCE })
      if (url === '/api/bujo/rituals/monthly/sources/previous-monthly/') {
        return Promise.resolve({
          data: {
            ...EMPTY_BLOCKING_SOURCE,
            items: [{ task: { id: 't-9', title: 'Pendente', status: 'pending', eisenhower: null, category: null, subtasks: [], scheduledDate: '2026-07-20' }, decision: null }],
          },
        })
      }
      if (url === '/api/bujo/rituals/monthly/density/') return Promise.resolve({ data: EMPTY_DENSITY })
      return Promise.reject(new Error(`unhandled GET ${url}`))
    })
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento mensal' })
    const sourceRail = screen.getByRole('navigation', { name: 'Fontes do planejamento mensal' })
    fireEvent.click(within(sourceRail).getByRole('button', { name: /Monthly anterior/ }))
    await screen.findByText('Pendente')

    fireEvent.click(screen.getByRole('button', { name: 'Migrar para dia 20' }))

    const decisions = screen.getByRole('region', { name: 'Decisões — Monthly anterior' })
    await waitFor(() => expect(within(decisions).getByRole('alert')).toHaveTextContent('ainda não carregou'))
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('mês corrente FALHOU: a mensagem diz que falhou e o clique dispara um novo GET', async () => {
    let monthlyGets = 0
    mockGet.mockImplementation((url: string) => {
      if (url === '/api/bujo/logs/monthly/cycle/') return Promise.resolve({ data: READINESS_WITH_TARGET })
      if (url === '/api/bujo/logs/monthly/') {
        monthlyGets += 1
        return Promise.reject(new Error('500'))
      }
      if (url === '/api/bujo/rituals/monthly/sources/recurring/') return Promise.resolve({ data: EMPTY_RECURRING_SOURCE })
      if (url === '/api/bujo/rituals/monthly/sources/future-log/') return Promise.resolve({ data: EMPTY_TASK_SOURCE })
      if (url === '/api/bujo/rituals/monthly/sources/previous-monthly/') {
        return Promise.resolve({
          data: {
            ...EMPTY_BLOCKING_SOURCE,
            items: [{ task: { id: 't-9', title: 'Pendente', status: 'pending', eisenhower: null, category: null, subtasks: [], scheduledDate: '2026-07-20' }, decision: null }],
          },
        })
      }
      if (url === '/api/bujo/rituals/monthly/density/') return Promise.resolve({ data: EMPTY_DENSITY })
      return Promise.reject(new Error(`unhandled GET ${url}`))
    })
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento mensal' })
    const sourceRail = screen.getByRole('navigation', { name: 'Fontes do planejamento mensal' })
    fireEvent.click(within(sourceRail).getByRole('button', { name: /Monthly anterior/ }))
    await screen.findByText('Pendente')
    await waitFor(() => expect(monthlyGets).toBeGreaterThanOrEqual(1))
    const before = monthlyGets

    fireEvent.click(screen.getByRole('button', { name: 'Migrar para dia 20' }))

    const decisions = screen.getByRole('region', { name: 'Decisões — Monthly anterior' })
    await waitFor(() =>
      expect(within(decisions).getByRole('alert')).toHaveTextContent('Não foi possível carregar o mês corrente — tente novamente.'),
    )
    await waitFor(() => expect(monthlyGets).toBeGreaterThan(before))
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('sem alvo em planejamento: mensagem + link "Ir para Este Mês"', async () => {
    mockRoutes({ readiness: { active: null, planning: null, start: null, finalize: null } })
    renderPage()
    expect(await screen.findByText('Nenhum mês em planejamento no momento.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir para Este Mês' })).toHaveAttribute('href', '/planner/month')
  })

  it('jest-axe: faixa de regularização sem violações', async () => {
    mockRoutes({
      readiness: { ...READINESS_WITH_TARGET, planning: { monthFirst: '2026-08-01', status: 'planning', planningCompletedAt: null } },
      currentMonthFirst: '2026-09-01',
      previousMonthly: { ...EMPTY_BLOCKING_SOURCE, previousPeriodStart: '2026-07-01' },
    })
    const { container } = renderPage()
    await screen.findByRole('status', { name: 'Regularização atrasada' })
    expect(await axe(container)).toHaveNoViolations()
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
    fireEvent.click(await screen.findByRole('button', { name: '18 de agosto, sem tarefas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Migrar para 18 de agosto' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível migrar a tarefa'))
    // O seletor continua aberto E ARMADO — falha preserva item/foco (AC5), então
    // "tentar novamente" é reconfirmar o mesmo ato já nomeado.
    expect(screen.getByRole('dialog', { name: 'Escolher destino' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Migrar para 18 de agosto' })).toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Defeito corrigido: os dois pickers antigos faziam `if (!compact) return
// content`, então no desktop o seletor entrava no fluxo normal do DOM DEPOIS da
// grade de 3 colunas do ritual — abria abaixo da dobra, e clicar em "Alocar"/
// "Escolher destino…" parecia não fazer nada. A prova estrutural aqui é que o
// seletor NÃO é descendente do `main` do ritual: ele é portalizado.
// ─────────────────────────────────────────────────────────────────────────────
describe('MonthlyPlanningPage — o seletor de destino abre SOBREPOSTO, fora do fluxo do ritual', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMatchMediaDefault()
  })

  it('"Alocar" (recorrentes) abre o seletor portalizado, fora do main, com o ato NOMEADO', async () => {
    mockRoutes({
      recurring: {
        ...EMPTY_RECURRING_SOURCE,
        items: [
          {
            template: {
              id: 'tpl-1',
              title: 'Recorrente mensal',
              recurrenceGroup: 'monthly',
              recurrenceText: 'todo mês',
              active: true,
              eisenhower: null,
              category: null,
              description: null,
            },
            decision: null,
          },
        ],
      },
    })
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento mensal' })
    await screen.findByText('Recorrente mensal')

    // Capturado ANTES de abrir: com o modal aberto o MUI marca a subárvore da
    // página com `aria-hidden`, então uma consulta por role deixaria de
    // encontrá-lo — o que por si só já prova que existe camada modal de verdade.
    const main = screen.getByRole('main', { name: 'Planejar Agosto de 2026' })

    fireEvent.click(screen.getByRole('button', { name: 'Alocar' }))

    const dialog = await screen.findByRole('dialog', { name: 'Escolher destino' })
    expect(main).not.toContainElement(dialog)
    expect(dialog.closest('.MuiDialog-root')).not.toBeNull()

    // O verbo do ato é "Alocar" (template → `place/`), não "Migrar".
    fireEvent.click(await screen.findByRole('button', { name: '10 de agosto, sem tarefas' }))
    expect(within(dialog).getByRole('button', { name: 'Alocar em 10 de agosto' })).toBeInTheDocument()
  })

  // Story 14.6 AC5 — a entrada direta do número do dia e as setas existem e
  // chegam ao usuário PELA PÁGINA do ritual, sincronizadas com o calendário.
  it('a entrada direta do número do dia e as setas funcionam pela página do ritual (AC5)', async () => {
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
    mockPost.mockResolvedValueOnce({ data: { id: 't-1' } })
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento mensal' })
    fireEvent.click(screen.getByRole('button', { name: /Future Log/ }))
    await screen.findByText('Item do Future Log')

    fireEvent.click(screen.getByRole('button', { name: 'Escolher destino…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Escolher destino' })

    // Lembrete VISÍVEL dos atalhos do mensal (também restaurado).
    expect(
      within(dialog).getByText('Setas navegam dia a dia · digite o número do dia · Enter confirma.'),
    ).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText('Número do dia'), { target: { value: '12' } })
    // Sincronizado com o calendário de densidade reusado (`MonthDensityCalendar`
    // marca o dia escolhido com `aria-pressed`; o `aria-current` do grid antigo
    // não existe mais e a spec proíbe alterar o componente compartilhado).
    expect(within(dialog).getByRole('button', { name: '12 de agosto, sem tarefas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    fireEvent.click(within(dialog).getByRole('button', { name: 'Próximo dia' }))
    expect(within(dialog).getByLabelText('Número do dia')).toHaveValue(13)

    fireEvent.click(within(dialog).getByRole('button', { name: 'Migrar para 13 de agosto' }))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/api/bujo/tasks/t-1/migrate/',
        expect.objectContaining({ scheduledDate: '2026-08-13' }),
      ),
    )
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  // Story 14.6 AC6 — "selecionar um dia escolhe destino para a decisão corrente".
  it('clicar num dia do minicalendário de densidade arma o destino da decisão corrente (AC6)', async () => {
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
    mockPost.mockResolvedValueOnce({ data: { id: 't-1' } })
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento mensal' })
    fireEvent.click(screen.getByRole('button', { name: /Future Log/ }))
    await screen.findByText('Item do Future Log')

    const densityGrid = await screen.findByRole('grid', { name: 'Minicalendário de densidade' })
    fireEvent.click(within(densityGrid).getByRole('gridcell', { name: '14 de agosto: vazio' }))

    fireEvent.click(screen.getByRole('button', { name: 'Escolher destino…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Escolher destino' })

    // Já ARMADO no dia escolhido no rail — a confirmação nomeada está pronta.
    expect(within(dialog).getByLabelText('Número do dia')).toHaveValue(14)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Migrar para 14 de agosto' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/api/bujo/tasks/t-1/migrate/',
        expect.objectContaining({ scheduledDate: '2026-08-14' }),
      ),
    )
  })

  // Achado de review: o seletor e o rail liam densidade de endpoints DIFERENTES,
  // então os dois calendários da mesma tela podiam mostrar contagens divergentes.
  it('o calendário do seletor usa a MESMA densidade do rail, sem requisição extra', async () => {
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
      monthlyDensity: {
        ...EMPTY_DENSITY,
        total: 3,
        days: [
          { date: '2026-08-18', total: 3, byStatus: { pending: 3, started: 0, completed: 0, cancelled: 0, migrated: 0, postponed: 0 } },
        ],
      },
    })
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento mensal' })
    fireEvent.click(screen.getByRole('button', { name: /Future Log/ }))
    await screen.findByText('Item do Future Log')

    fireEvent.click(screen.getByRole('button', { name: 'Escolher destino…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Escolher destino' })

    // A contagem do rail (3 registros no dia 18) aparece no calendário do seletor.
    expect(within(dialog).getByRole('button', { name: '18 de agosto, 3 tarefas' })).toBeInTheDocument()
    // E nenhuma requisição ao endpoint de densidade genérico foi feita.
    expect(mockGet.mock.calls.some(([url]) => url === '/api/bujo/task-density/')).toBe(false)
  })

  // Achado de review: sem gate de escrita EM CURSO, dois cliques rápidos em
  // confirmar viram dois POST — duas instâncias do mesmo recorrente no "Alocar".
  it('durante a escrita em curso o seletor fica bloqueado — nada de alocar em duplicidade', async () => {
    mockRoutes({
      recurring: {
        ...EMPTY_RECURRING_SOURCE,
        items: [
          {
            template: {
              id: 'tpl-1',
              title: 'Recorrente mensal',
              recurrenceGroup: 'monthly',
              recurrenceText: 'todo mês',
              active: true,
              eisenhower: null,
              category: null,
              description: null,
            },
            decision: null,
          },
        ],
      },
    })
    // Nunca resolve: mantém a mutação PENDENTE durante todo o teste.
    mockPost.mockImplementation(() => new Promise(() => {}))
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento mensal' })
    await screen.findByText('Recorrente mensal')

    fireEvent.click(screen.getByRole('button', { name: 'Alocar' }))
    const dialog = await screen.findByRole('dialog', { name: 'Escolher destino' })
    fireEvent.click(within(dialog).getByRole('button', { name: '10 de agosto, sem tarefas' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Alocar em 10 de agosto' }))

    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Alocar em 10 de agosto' })).toBeDisabled(),
    )
    fireEvent.click(within(dialog).getByRole('button', { name: 'Alocar em 10 de agosto' }))
    fireEvent.keyDown(within(dialog).getByLabelText('Número do dia'), { key: 'Enter' })

    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it('"Escolher destino…" (task) também abre portalizado, fora do main', async () => {
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
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento mensal' })
    fireEvent.click(screen.getByRole('button', { name: /Future Log/ }))
    await screen.findByText('Item do Future Log')

    const main = screen.getByRole('main', { name: 'Planejar Agosto de 2026' })
    fireEvent.click(screen.getByRole('button', { name: 'Escolher destino…' }))

    const dialog = await screen.findByRole('dialog', { name: 'Escolher destino' })
    expect(main).not.toContainElement(dialog)
    expect(dialog.closest('.MuiDialog-root')).not.toBeNull()
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
