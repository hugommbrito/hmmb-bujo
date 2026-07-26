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
import { MonthlyBoardPage } from './MonthlyBoardPage'
import type { Task } from '../../features/bujo'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>

const READINESS = { active: null, planning: null, start: null, finalize: null }
const TODAY_LOG = { id: 'log-1', logDate: '2026-08-12', tasks: [] }

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Tarefa',
    status: 'pending',
    eisenhower: null,
    category: null,
    subtasks: [],
    ...overrides,
  }
}

function monthlyLog({
  monthFirst = '2026-08-01',
  tasks = [] as Task[],
  closed = false,
  status = 'active' as string | null,
  planningCompletedAt = null as string | null,
}: {
  monthFirst?: string
  tasks?: Task[]
  closed?: boolean
  status?: string | null
  planningCompletedAt?: string | null
} = {}) {
  return { monthFirst, tasks, closed, status, planningCompletedAt }
}

function mockRoutes({
  log,
  readiness = READINESS,
  todayLog = TODAY_LOG,
}: {
  log: ReturnType<typeof monthlyLog>
  readiness?: unknown
  todayLog?: unknown
}) {
  mockGet.mockImplementation((url: string) => {
    if (url === '/api/bujo/logs/monthly/cycle/') return Promise.resolve({ data: readiness })
    if (url === '/api/bujo/logs/monthly/') return Promise.resolve({ data: log })
    if (url === '/api/bujo/logs/today/') return Promise.resolve({ data: todayLog })
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
          <MonthlyBoardPage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('MonthlyBoardPage — composição e rota (AC1/AC3)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockFaixa('wide')
  })

  it('renderiza um único <main aria-label="Este Mês">', async () => {
    mockRoutes({ log: monthlyLog() })
    renderPage()
    await waitFor(() => expect(screen.getByRole('main', { name: 'Este Mês' })).toBeInTheDocument())
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('cabeçalho mostra o mês por extenso e o estado do ciclo', async () => {
    mockRoutes({ log: monthlyLog({ monthFirst: '2026-08-01', status: 'active' }) })
    renderPage()
    await waitFor(() => expect(screen.getByText('Agosto de 2026')).toBeInTheDocument())
    expect(screen.getByText('Em andamento')).toBeInTheDocument()
  })

  it('a coluna "Sem dia definido" aparece SEMPRE, mesmo vazia', async () => {
    mockRoutes({ log: monthlyLog() })
    renderPage()
    await screen.findByRole('grid', { name: /Agosto de 2026/ })
    const pool = screen.getByRole('region', { name: 'Sem dia definido' })
    expect(within(pool).getByText('Nenhuma tarefa.')).toBeInTheDocument()
  })

  it('mês finalized: mutações ausentes do DOM (sem form de criação na grade nem no pool)', async () => {
    mockRoutes({
      log: monthlyLog({ status: 'finalized', closed: true, tasks: [task({ id: 't-1', title: 'Tarefa fechada' })] }),
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Tarefa fechada')).toBeInTheDocument())
    expect(screen.queryAllByLabelText('Título')).toHaveLength(0)
  })

  it('caso irmão: mês NÃO finalized mostra os formulários de criação', async () => {
    mockRoutes({ log: monthlyLog({ status: 'active' }) })
    renderPage()
    await screen.findByRole('grid', { name: /Agosto de 2026/ })
    expect(screen.queryAllByLabelText('Título').length).toBeGreaterThan(0)
  })

  it('jest-axe: sem violações', async () => {
    mockRoutes({ log: monthlyLog() })
    const { container } = renderPage()
    await screen.findByRole('grid', { name: /Agosto de 2026/ })
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('MonthlyBoardPage — agrupamento por scheduledDate (AC1)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockFaixa('wide')
  })

  it('tarefa com scheduledDate aparece na célula; sem scheduledDate vai para o pool', async () => {
    mockRoutes({
      log: monthlyLog({
        tasks: [
          task({ id: 'd1', title: 'Com data', scheduledDate: '2026-08-12' }),
          task({ id: 'u1', title: 'Sem data', scheduledDate: null }),
        ],
      }),
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Com data')).toBeInTheDocument())
    const pool = screen.getByRole('region', { name: 'Sem dia definido' })
    expect(within(pool).getByText('Sem data')).toBeInTheDocument()
    expect(within(pool).queryByText('Com data')).not.toBeInTheDocument()
  })
})

describe('MonthlyBoardPage — recomposição por faixa (AC1)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockRoutes({ log: monthlyLog() })
  })

  it('faixa compact: mostra um seletor de dia (grid) + acesso a "Sem dia definido"', async () => {
    mockFaixa('compact')
    renderPage()
    await screen.findByRole('grid', { name: 'Selecionar dia do mês' })
    expect(screen.getByText('Sem dia definido')).toBeInTheDocument()
    // Só uma região de dia/pool exibida por vez.
    expect(screen.getAllByRole('region').length).toBe(1)
  })

  it('faixa wide: calendário completo + pool lateral', async () => {
    mockFaixa('wide')
    renderPage()
    await screen.findByRole('grid', { name: /Agosto de 2026/ })
    expect(screen.getByRole('region', { name: 'Sem dia definido' })).toBeInTheDocument()
  })

  it('faixa tablet: reusa a composição de compact (seletor de dia), não a grade de 7 colunas (achado real do axe, target-size)', async () => {
    mockFaixa('tablet')
    renderPage()
    await screen.findByRole('grid', { name: 'Selecionar dia do mês' })
    expect(screen.getByText('Sem dia definido')).toBeInTheDocument()
    expect(screen.getAllByRole('region').length).toBe(1)
  })
})

describe('MonthlyBoardPage — filtros globais (AC1)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockFaixa('wide')
  })

  it('filtro por status é GLOBAL: some da célula E do pool na mesma asserção', async () => {
    mockRoutes({
      log: monthlyLog({
        tasks: [
          task({ id: 'd1', title: 'Pendente na célula', status: 'pending', scheduledDate: '2026-08-12' }),
          task({ id: 'u1', title: 'Concluída no pool', status: 'completed', scheduledDate: null }),
        ],
      }),
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Pendente na célula')).toBeInTheDocument())
    expect(screen.getByText('Concluída no pool')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /concluídas/ }))

    await waitFor(() => expect(screen.getByText('Concluída no pool')).toBeInTheDocument())
    expect(screen.queryByText('Pendente na célula')).not.toBeInTheDocument()
  })

  it('empty por filtro (AC7): filtro sem resultado nenhum mantém a barra visível e limpável', async () => {
    mockRoutes({
      log: monthlyLog({
        tasks: [task({ id: 'd1', title: 'Pendente', status: 'pending', scheduledDate: '2026-08-12' })],
      }),
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Pendente')).toBeInTheDocument())

    // Nenhuma tarefa cancelada existe — o filtro zera célula E pool.
    fireEvent.click(screen.getByRole('button', { name: /canceladas/ }))

    await waitFor(() => expect(screen.queryByText('Pendente')).not.toBeInTheDocument())
    // A barra de filtro continua visível e o botão de limpar, clicável.
    expect(screen.getByRole('button', { name: /canceladas/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    await waitFor(() => expect(screen.getByText('Pendente')).toBeInTheDocument())
  })
})

describe('MonthlyBoardPage — criação contextual (AC1)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockFaixa('wide')
  })

  it('criação pelo pool envia scheduledDate nulo', async () => {
    mockRoutes({ log: monthlyLog() })
    mockPost.mockResolvedValueOnce({ data: task({ id: 'new-1', title: 'Nova' }) })
    renderPage()
    await screen.findByRole('grid', { name: /Agosto de 2026/ })

    const pool = screen.getByRole('region', { name: 'Sem dia definido' })
    fireEvent.change(within(pool).getByLabelText('Título'), { target: { value: 'Nova' } })
    fireEvent.click(within(pool).getByRole('button', { name: 'Adicionar' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/api/bujo/logs/monthly/',
        expect.objectContaining({ title: 'Nova', scheduledDate: null }),
      ),
    )
  })
})
