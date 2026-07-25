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
import { WeeklyPlanningPage } from './WeeklyPlanningPage'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>

// `vi.resetAllMocks()` (usado em cada `beforeEach`) limpa a implementação do
// `window.matchMedia` global de `test-setup.ts` — sem isso, `useMediaQuery`
// (faixa compact do seletor de destino) recebe `undefined` e quebra o mount.
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
  active: null,
  planning: { weekStart: '2026-07-27', status: 'planning', planningCompletedAt: null },
  start: null,
  finalize: null,
}

const EMPTY_TASK_SOURCE = {
  sourceId: 'monthly-in-week',
  blocking: false,
  countsTowardProgress: true,
  eligibleCount: 0,
  pendingDecisionCount: 0,
  reviewed: true,
  items: [],
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
}

const EMPTY_BLOCKING_SOURCE = {
  sourceId: 'previous-weekly',
  blocking: true,
  countsTowardProgress: true,
  eligibleCount: 0,
  pendingDecisionCount: 0,
  reviewed: true,
  items: [],
  readyToFinalize: false,
  previousPeriodStart: null,
}

const EMPTY_PENDING_DAILIES = {
  sourceId: 'pending-dailies',
  blocking: false,
  countsTowardProgress: true,
  eligibleCount: 0,
  pendingDecisionCount: 0,
  reviewed: true,
  groups: [],
}

function mockRoutes({
  readiness = READINESS_WITH_TARGET,
  monthlyInWeek = EMPTY_TASK_SOURCE,
  recurring = EMPTY_RECURRING_SOURCE,
  previousWeekly = EMPTY_BLOCKING_SOURCE,
  pendingDailies = EMPTY_PENDING_DAILIES,
  previousWeeklyStatus = 200,
}: {
  readiness?: unknown
  monthlyInWeek?: unknown
  recurring?: unknown
  previousWeekly?: unknown
  pendingDailies?: unknown
  previousWeeklyStatus?: number
} = {}) {
  mockGet.mockImplementation((url: string) => {
    if (url === '/api/bujo/logs/weekly/cycle/') return Promise.resolve({ data: readiness })
    if (url === '/api/bujo/logs/weekly/') {
      // Referência de "semana corrente" (Convenção #8) — deliberadamente
      // DIFERENTE do alvo do ritual, para o caso comum (planejar a PRÓXIMA
      // semana) não ser confundido com "planejando a semana corrente".
      return Promise.resolve({
        data: {
          weekStart: '2026-07-20',
          days: Array.from({ length: 7 }, (_, i) => ({ date: `2026-07-${20 + i}`, tasks: [] })),
          unscheduled: [],
          closed: false,
          status: 'active',
          planningCompletedAt: null,
        },
      })
    }
    if (url === '/api/bujo/rituals/weekly/sources/monthly-in-week/') return Promise.resolve({ data: monthlyInWeek })
    if (url === '/api/bujo/rituals/weekly/sources/recurring/') return Promise.resolve({ data: recurring })
    if (url === '/api/bujo/rituals/weekly/sources/previous-weekly/') {
      return previousWeeklyStatus === 200
        ? Promise.resolve({ data: previousWeekly })
        : Promise.reject(new Error('falha ao consultar previous-weekly'))
    }
    if (url === '/api/bujo/rituals/weekly/sources/pending-dailies/') return Promise.resolve({ data: pendingDailies })
    if (url === '/api/bujo/logs/monthly/') return Promise.resolve({ data: { monthFirst: '2026-07-01', tasks: [], closed: false, status: null, planningCompletedAt: null } })
    return Promise.reject(new Error(`unhandled GET ${url}`))
  })
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={createBujoTheme('light')}>
        <MemoryRouter>
          <WeeklyPlanningPage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('WeeklyPlanningPage — três regiões (AC5)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMatchMediaDefault()
  })

  it('renderiza main, nav de fontes e a lista de decisões da fonte ativa', async () => {
    mockRoutes()
    renderPage()

    expect(await screen.findByRole('navigation', { name: 'Fontes do planejamento' })).toBeInTheDocument()
    expect(screen.getByRole('main', { name: 'Planejar a semana' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Decisões — Monthly na semana' })).toBeInTheDocument()
  })

  it('sem alvo de planejamento, mostra mensagem em vez da lista', async () => {
    mockRoutes({ readiness: { active: null, planning: null, start: null, finalize: null } })
    renderPage()
    expect(await screen.findByText('Nenhuma semana em planejamento no momento.')).toBeInTheDocument()
  })

  it('trocar de fonte no rail muda a fonte exibida na lista', async () => {
    mockRoutes()
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento' })

    fireEvent.click(screen.getByRole('button', { name: /Recorrentes/ }))

    expect(await screen.findByRole('region', { name: 'Decisões — Recorrentes' })).toBeInTheDocument()
  })

  it('jest-axe: sem violações', async () => {
    mockRoutes()
    const { container } = renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento' })
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('WeeklyPlanningPage — fontes independentes (AC5)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMatchMediaDefault()
  })

  it('uma fonte em erro (previous-weekly) NÃO bloqueia as outras', async () => {
    mockRoutes({ previousWeeklyStatus: 500 })
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento' })

    // monthly-in-week (a fonte ativa por padrão) segue operável.
    expect(screen.getByRole('region', { name: 'Decisões — Monthly na semana' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    // Trocar para a fonte com erro mostra a mensagem local, sem afetar as demais.
    fireEvent.click(screen.getByRole('button', { name: /Weekly anterior/ }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Recorrentes/ }))
    expect(screen.getByRole('region', { name: 'Decisões — Recorrentes' })).toBeInTheDocument()
  })

  it('pending-dailies usa groups (não uma fonte quebrada por assumir items)', async () => {
    mockRoutes({
      pendingDailies: {
        ...EMPTY_PENDING_DAILIES,
        groups: [{ date: '2026-07-10', items: [{ task: { id: 't-1', title: 'Tarefa antiga', status: 'pending', eisenhower: null, category: null, subtasks: [] }, decision: null }] }],
      },
    })
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento' })

    const nav = screen.getByRole('navigation', { name: 'Fontes do planejamento' })
    fireEvent.click(within(nav).getByRole('button', { name: /Daily pendentes/ }))
    expect(await screen.findByText('Tarefa antiga')).toBeInTheDocument()
  })
})

describe('WeeklyPlanningPage — seletor de destino (AC5, Task 9)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMatchMediaDefault()
  })

  it('"Escolher destino…" abre o seletor; confirmar migra e fecha', async () => {
    mockRoutes({
      monthlyInWeek: {
        ...EMPTY_TASK_SOURCE,
        items: [
          {
            task: {
              id: 't-1',
              title: 'Rever contrato',
              status: 'pending',
              eisenhower: null,
              category: null,
              subtasks: [],
              scheduledDate: '2026-07-29',
            },
            decision: null,
          },
        ],
      },
    })
    mockPost.mockResolvedValueOnce({ data: { id: 't-1', title: 'Rever contrato', status: 'migrated', eisenhower: null, category: null, subtasks: [] } })
    renderPage()
    await screen.findByText('Rever contrato')

    fireEvent.click(screen.getByRole('button', { name: 'Escolher destino…' }))
    expect(await screen.findByRole('dialog', { name: 'Escolher destino' })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: '3' }) // quarta
    fireEvent.keyDown(window, { key: 'Enter' })

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/t-1/migrate/', {
        destination: 'week',
        scheduledDate: '2026-07-29',
      }),
    )
    expect(screen.queryByRole('dialog', { name: 'Escolher destino' })).not.toBeInTheDocument()
  })
})

describe('WeeklyPlanningPage — falha de decisão preserva item e oferece retry (AC5)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMatchMediaDefault()
  })

  it('Concluir falhando mostra o motivo + Tentar novamente; retry repete a MESMA ação', async () => {
    mockRoutes({
      monthlyInWeek: {
        ...EMPTY_TASK_SOURCE,
        items: [
          {
            task: { id: 't-1', title: 'Rever contrato', status: 'pending', eisenhower: null, category: null, subtasks: [], scheduledDate: '2026-07-27' },
            decision: null,
          },
        ],
      },
    })
    mockPost.mockRejectedValueOnce(new Error('falha de rede'))
    mockPost.mockResolvedValueOnce({ data: { id: 't-1', title: 'Rever contrato', status: 'completed', eisenhower: null, category: null, subtasks: [] } })
    renderPage()
    await screen.findByText('Rever contrato')

    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar a decisão'))
    // O item continua na lista — falha não some com ele.
    expect(screen.getByText('Rever contrato')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() =>
      expect(mockPost).toHaveBeenLastCalledWith('/api/bujo/tasks/t-1/transition/', { toStatus: 'completed' }),
    )
    expect(mockPost).toHaveBeenCalledTimes(2)
  })
})

describe('WeeklyPlanningPage — falha na confirmação de destino preserva o seletor aberto (AC5)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMatchMediaDefault()
  })

  it('POST de migrate falhando NÃO fecha o seletor e mostra o motivo', async () => {
    mockRoutes({
      monthlyInWeek: {
        ...EMPTY_TASK_SOURCE,
        items: [
          {
            task: { id: 't-1', title: 'Rever contrato', status: 'pending', eisenhower: null, category: null, subtasks: [], scheduledDate: '2026-07-29' },
            decision: null,
          },
        ],
      },
    })
    mockPost.mockRejectedValueOnce(new Error('falha de rede'))
    renderPage()
    await screen.findByText('Rever contrato')

    fireEvent.click(screen.getByRole('button', { name: 'Escolher destino…' }))
    await screen.findByRole('dialog', { name: 'Escolher destino' })

    fireEvent.keyDown(window, { key: '3' })
    fireEvent.keyDown(window, { key: 'Enter' })

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível migrar a tarefa'))
    // O seletor continua aberto — falha preserva item/foco (AC5).
    expect(screen.getByRole('dialog', { name: 'Escolher destino' })).toBeInTheDocument()
  })
})

describe('WeeklyPlanningPage — offline (AC7)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMatchMediaDefault()
  })

  it('sem rede: aviso persistente role=status e decisões indisponíveis', async () => {
    mockRoutes({
      monthlyInWeek: {
        ...EMPTY_TASK_SOURCE,
        items: [
          {
            task: { id: 't-1', title: 'Rever contrato', status: 'pending', eisenhower: null, category: null, subtasks: [], scheduledDate: '2026-07-27' },
            decision: null,
          },
        ],
      },
    })
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    renderPage()
    await screen.findByText('Rever contrato')

    expect(screen.getByRole('status')).toHaveTextContent('Sem conexão')
    expect(screen.getByRole('button', { name: 'Concluir' })).toHaveAttribute('aria-disabled', 'true')

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })
})
