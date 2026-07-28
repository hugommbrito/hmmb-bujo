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
import { mediaQueries } from '../../shared/design/tokens'
import { WeeklyBoardPage } from './WeeklyBoardPage'
import type { Task, WeeklyDay } from '../../features/bujo'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>

const READINESS = { active: null, planning: null, start: null, finalize: null }

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Tarefa',
    status: 'pending',
    eisenhower: null,
    category: null,
    subtasks: [],
    migrationTarget: null,
    ...overrides,
  }
}

function weeklyLog({
  weekStart = '2026-07-20',
  days,
  unscheduled = [],
  closed = false,
  status = 'active' as string | null,
  planningCompletedAt = null as string | null,
}: {
  weekStart?: string
  days?: WeeklyDay[]
  unscheduled?: Task[]
  closed?: boolean
  status?: string | null
  planningCompletedAt?: string | null
} = {}) {
  const defaultDays: WeeklyDay[] = Array.from({ length: 7 }, (_, i) => ({
    date: `2026-07-${20 + i}`,
    tasks: [],
  }))
  return {
    weekStart,
    days: days ?? defaultDays,
    unscheduled,
    closed,
    status,
    planningCompletedAt,
  }
}

function mockRoutes({ log, readiness = READINESS }: { log: ReturnType<typeof weeklyLog>; readiness?: unknown }) {
  mockGet.mockImplementation((url: string) => {
    if (url === '/api/bujo/logs/weekly/cycle/') return Promise.resolve({ data: readiness })
    if (url === '/api/bujo/logs/weekly/') return Promise.resolve({ data: log })
    return Promise.reject(new Error(`unhandled GET ${url}`))
  })
}

function mockFaixa(faixa: 'wide' | 'medium' | 'tablet' | 'compact') {
  const wideUp: string = mediaQueries.wideUp
  const desktop: string = mediaQueries.desktop
  const tabletUp: string = mediaQueries.tabletUp
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches:
        (faixa === 'wide' && [wideUp, desktop, tabletUp].includes(query)) ||
        (faixa === 'medium' && [desktop, tabletUp].includes(query)) ||
        (faixa === 'tablet' && query === tabletUp) ||
        false,
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

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={createBujoTheme('light')}>
        <MemoryRouter>
          <WeeklyBoardPage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('WeeklyBoardPage — composição e rota (AC1/AC3)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockFaixa('wide')
  })

  it('renderiza um único <main aria-label="Esta Semana">', async () => {
    mockRoutes({ log: weeklyLog() })
    renderPage()
    await waitFor(() => expect(screen.getByRole('main', { name: 'Esta Semana' })).toBeInTheDocument())
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('posiciona cada dia em sua própria região nomeada, incluindo o pool VAZIO', async () => {
    mockRoutes({ log: weeklyLog() })
    renderPage()
    await screen.findByRole('button', { name: /registros/ })

    expect(screen.getByRole('region', { name: /Segunda/ })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Domingo/ })).toBeInTheDocument()
    // O pool aparece SEMPRE, mesmo vazio (a condição `unscheduled.length > 0`
    // do legado desaparece nesta story).
    const pool = screen.getByRole('region', { name: 'Sem dia definido' })
    expect(within(pool).getByText('Nenhuma tarefa.')).toBeInTheDocument()
  })

  it('header mostra o intervalo completo e a posição no mês numa semana normal', async () => {
    mockRoutes({ log: weeklyLog({ weekStart: '2026-07-20' }) })
    renderPage()
    await screen.findByRole('button', { name: /registros/ })

    expect(screen.getByText(/20–26 de julho de 2026/)).toBeInTheDocument()
    expect(screen.getByText(/semana de julho/)).toBeInTheDocument()
    expect(screen.getByText(/semana ISO/)).toBeInTheDocument()
  })

  it('header mostra AMBOS os meses numa semana de virada', async () => {
    mockRoutes({ log: weeklyLog({ weekStart: '2026-06-29' }) })
    renderPage()
    await screen.findByRole('button', { name: /registros/ })

    expect(screen.getByText(/29 de junho – 5 de julho de 2026/)).toBeInTheDocument()
    expect(screen.getByText(/semana de junho.*semana de julho/)).toBeInTheDocument()
  })

  it('semana finalized: mutações ausentes do DOM (sem form de criação, sem menu de reordenar)', async () => {
    mockRoutes({
      log: weeklyLog({
        status: 'finalized',
        closed: true,
        days: [
          { date: '2026-07-20', tasks: [task({ id: 't-1', title: 'Tarefa fechada' })] },
          ...Array.from({ length: 6 }, (_, i) => ({ date: `2026-07-${21 + i}`, tasks: [] })),
        ],
      }),
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Tarefa fechada')).toBeInTheDocument())

    expect(screen.queryAllByLabelText('Título')).toHaveLength(0)
    expect(screen.queryAllByRole('button', { name: 'Reordenar tarefa' })).toHaveLength(0)
  })

  it('closed legado (status null) SEM "finalized": ainda assim mutações ausentes do DOM', async () => {
    // `isReadonly = closed === true || status === 'finalized'` é um OR — só
    // testar a conjunção (os dois `true` juntos) não provaria a disjunção;
    // uma regressão para `&&` passaria despercebida.
    mockRoutes({
      log: weeklyLog({
        status: null,
        closed: true,
        days: [
          { date: '2026-07-20', tasks: [task({ id: 't-1', title: 'Tarefa fechada legada' })] },
          ...Array.from({ length: 6 }, (_, i) => ({ date: `2026-07-${21 + i}`, tasks: [] })),
        ],
      }),
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Tarefa fechada legada')).toBeInTheDocument())
    expect(screen.queryAllByLabelText('Título')).toHaveLength(0)
  })

  it('status "finalized" SEM closed legado: mutações ausentes do DOM do mesmo jeito', async () => {
    mockRoutes({
      log: weeklyLog({
        status: 'finalized',
        closed: false,
        days: [
          { date: '2026-07-20', tasks: [task({ id: 't-1', title: 'Tarefa finalizada' })] },
          ...Array.from({ length: 6 }, (_, i) => ({ date: `2026-07-${21 + i}`, tasks: [] })),
        ],
      }),
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Tarefa finalizada')).toBeInTheDocument())
    expect(screen.queryAllByLabelText('Título')).toHaveLength(0)
  })

  it('caso irmão: semana NÃO finalized mostra os formulários de criação', async () => {
    mockRoutes({ log: weeklyLog({ status: 'active' }) })
    renderPage()
    await screen.findByRole('button', { name: /registros/ })
    expect(screen.queryAllByLabelText('Título').length).toBeGreaterThan(0)
  })

  it('jest-axe: sem violações', async () => {
    mockRoutes({ log: weeklyLog() })
    const { container } = renderPage()
    await screen.findByRole('button', { name: /registros/ })
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('WeeklyBoardPage — recomposição por faixa (AC1)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockRoutes({ log: weeklyLog() })
  })

  it('faixa compact: mostra o seletor de 8 células e um painel por vez', async () => {
    mockFaixa('compact')
    renderPage()
    await screen.findByRole('button', { name: /registros/ })

    expect(screen.getByRole('tablist', { name: 'Selecionar dia da semana' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(8)
    // Só uma região de dia/pool é exibida por vez.
    expect(screen.getAllByRole('region').length).toBe(1)
  })

  it('faixa tablet: pool desce para uma linha própria, dias em 2 colunas', async () => {
    mockFaixa('tablet')
    renderPage()
    await screen.findByRole('button', { name: /registros/ })

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Sem dia definido' })).toBeInTheDocument()
    expect(screen.getAllByRole('region').length).toBe(8) // 7 dias + pool
  })

  it('faixa medium: pool permanece lateral, 7 regiões de dia + pool', async () => {
    mockFaixa('medium')
    renderPage()
    await screen.findByRole('button', { name: /registros/ })
    expect(screen.getAllByRole('region').length).toBe(8)
  })

  it('faixa wide: composição aprovada, 7 dias + pool', async () => {
    mockFaixa('wide')
    renderPage()
    await screen.findByRole('button', { name: /registros/ })
    expect(screen.getAllByRole('region').length).toBe(8)
  })
})

describe('WeeklyBoardPage — filtros globais (AC1/Task 7)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockFaixa('wide')
  })

  it('filtro por status é GLOBAL: some da lista de um dia E do pool na mesma asserção', async () => {
    mockRoutes({
      log: weeklyLog({
        days: [
          { date: '2026-07-20', tasks: [task({ id: 'd1', title: 'Pendente no dia', status: 'pending' })] },
          ...Array.from({ length: 6 }, (_, i) => ({ date: `2026-07-${21 + i}`, tasks: [] })),
        ],
        unscheduled: [task({ id: 'u1', title: 'Concluída no pool', status: 'completed' })],
      }),
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Pendente no dia')).toBeInTheDocument())
    expect(screen.getByText('Concluída no pool')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /concluídas/ }))

    await waitFor(() => expect(screen.getByText('Concluída no pool')).toBeInTheDocument())
    expect(screen.queryByText('Pendente no dia')).not.toBeInTheDocument()
  })

  it('empty por filtro (AC7): filtro sem resultado nenhum mantém a barra visível e limpável', async () => {
    mockRoutes({
      log: weeklyLog({
        days: [
          { date: '2026-07-20', tasks: [task({ id: 'd1', title: 'Pendente', status: 'pending' })] },
          ...Array.from({ length: 6 }, (_, i) => ({ date: `2026-07-${21 + i}`, tasks: [] })),
        ],
      }),
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Pendente')).toBeInTheDocument())

    // Nenhuma tarefa cancelada existe — o filtro zera TODOS os painéis.
    fireEvent.click(screen.getByRole('button', { name: /canceladas/ }))

    await waitFor(() => expect(screen.queryByText('Pendente')).not.toBeInTheDocument())
    // A barra de filtro continua visível e o botão de limpar, clicável.
    expect(screen.getByRole('button', { name: /canceladas/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    await waitFor(() => expect(screen.getByText('Pendente')).toBeInTheDocument())
  })

  it('filtro NÃO persiste entre montagens (estado de sessão, nunca localStorage)', async () => {
    mockRoutes({
      log: weeklyLog({
        days: [
          { date: '2026-07-20', tasks: [task({ id: 'd1', title: 'Pendente', status: 'pending' })] },
          ...Array.from({ length: 6 }, (_, i) => ({ date: `2026-07-${21 + i}`, tasks: [] })),
        ],
      }),
    })
    const { unmount } = renderPage()
    await waitFor(() => expect(screen.getByText('Pendente')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /concluídas/ }))
    await waitFor(() => expect(screen.queryByText('Pendente')).not.toBeInTheDocument())
    unmount()

    renderPage()
    await waitFor(() => expect(screen.getByText('Pendente')).toBeInTheDocument())
  })

  it('Limpar filtros restaura a lista completa', async () => {
    mockRoutes({
      log: weeklyLog({
        days: [
          { date: '2026-07-20', tasks: [task({ id: 'd1', title: 'Pendente', status: 'pending' })] },
          ...Array.from({ length: 6 }, (_, i) => ({ date: `2026-07-${21 + i}`, tasks: [] })),
        ],
      }),
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Pendente')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /concluídas/ }))
    await waitFor(() => expect(screen.queryByText('Pendente')).not.toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    await waitFor(() => expect(screen.getByText('Pendente')).toBeInTheDocument())
  })

  it('contagem "N abertas" é reportada por painel', async () => {
    mockRoutes({
      log: weeklyLog({
        days: [
          {
            date: '2026-07-20',
            tasks: [task({ id: 'd1', status: 'pending' }), task({ id: 'd2', status: 'completed' })],
          },
          ...Array.from({ length: 6 }, (_, i) => ({ date: `2026-07-${21 + i}`, tasks: [] })),
        ],
      }),
    })
    renderPage()
    await screen.findByRole('button', { name: /registros/ })
    const segunda = screen.getByRole('region', { name: /Segunda/ })
    expect(within(segunda).getByText('1 abertas')).toBeInTheDocument()
  })
})

describe('WeeklyBoardPage — criação contextual (AC1/Task 7)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockFaixa('wide')
  })

  it('criação por painel de dia envia scheduledDate do dia', async () => {
    mockRoutes({ log: weeklyLog() })
    mockPost.mockResolvedValueOnce({ data: task({ id: 'new-1', title: 'Nova' }) })
    renderPage()
    await screen.findByRole('button', { name: /registros/ })

    const segunda = screen.getByRole('region', { name: /Segunda/ })
    fireEvent.change(within(segunda).getByLabelText('Título'), { target: { value: 'Nova' } })
    fireEvent.click(within(segunda).getByRole('button', { name: 'Adicionar' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/logs/weekly/', {
        weekStart: '2026-07-20',
        title: 'Nova',
        scheduledDate: '2026-07-20',
      }),
    )
  })

  it('criação pelo pool envia scheduledDate: null', async () => {
    mockRoutes({ log: weeklyLog() })
    mockPost.mockResolvedValueOnce({ data: task({ id: 'new-1', title: 'Sem data' }) })
    renderPage()
    await screen.findByRole('button', { name: /registros/ })

    const pool = screen.getByRole('region', { name: 'Sem dia definido' })
    fireEvent.change(within(pool).getByLabelText('Título'), { target: { value: 'Sem data' } })
    fireEvent.click(within(pool).getByRole('button', { name: 'Adicionar' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/logs/weekly/', {
        weekStart: '2026-07-20',
        title: 'Sem data',
        scheduledDate: null,
      }),
    )
  })
})

describe('WeeklyBoardPage — reordenação relativa dentro do dia (Task 7, lacuna B5)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockFaixa('wide')
  })

  it('Mover abaixo chama POST /tasks/{id}/reorder/ restrito aos irmãos do MESMO dia', async () => {
    mockRoutes({
      log: weeklyLog({
        days: [
          {
            date: '2026-07-20',
            tasks: [
              task({ id: 'd1', title: 'Primeira' }),
              task({ id: 'd2', title: 'Segunda' }),
            ],
          },
          ...Array.from({ length: 6 }, (_, i) => ({ date: `2026-07-${21 + i}`, tasks: [] })),
        ],
      }),
    })
    mockPost.mockResolvedValueOnce({ data: task({ id: 'd1' }) })
    renderPage()
    await waitFor(() => expect(screen.getByText('Primeira')).toBeInTheDocument())

    const menus = screen.getAllByRole('button', { name: 'Reordenar tarefa' })
    fireEvent.click(menus[0])
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mover abaixo' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/d1/reorder/', {
        targetTaskId: 'd2',
        position: 'after',
      }),
    )
  })
})
