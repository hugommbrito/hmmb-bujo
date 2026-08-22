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
// 2026-07-22 é uma quarta-feira da semana de 2026-07-20 (a `weeklyLog` default)
// e do mês de julho — é a autoridade de "hoje" das ofertas de "Mover tarefa".
const TODAY_LOG = { id: 'log-1', logDate: '2026-07-22', tasks: [] }

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

function mockRoutes({
  log,
  readiness = READINESS,
  todayLog = TODAY_LOG,
  logByWeekStart,
}: {
  log: ReturnType<typeof weeklyLog>
  readiness?: unknown
  todayLog?: unknown
  /** Semana NAVEGADA (`?week_start=`) — sem isto o stepper devolveria a mesma
   * semana e `isCurrentWeek` nunca ficaria falso. */
  logByWeekStart?: Record<string, ReturnType<typeof weeklyLog>>
}) {
  mockGet.mockImplementation((url: string, config?: { params?: { week_start?: string } }) => {
    if (url === '/api/bujo/logs/weekly/cycle/') return Promise.resolve({ data: readiness })
    if (url === '/api/bujo/logs/weekly/') {
      const weekStart = config?.params?.week_start
      const navigated = weekStart ? logByWeekStart?.[weekStart] : undefined
      return Promise.resolve({ data: navigated ?? log })
    }
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

// ─────────────────────────────────────────────────────────────────────────────
// DW-27 — "Mover tarefa" cabeado. O botão do `TaskDetailCard` era um clique
// morto silencioso (`onClick={undefined}`) nesta superfície; a prova por página
// é que ele abre o seletor com as ofertas certas e que cada destino vira o POST
// exato que a regra de domínio de `/migrate/` exige.
// ─────────────────────────────────────────────────────────────────────────────
describe('WeeklyBoardPage — "Mover tarefa" (DW-27)', () => {
  const LOG_WITH_TASK = weeklyLog({
    days: [
      { date: '2026-07-20', tasks: [task({ id: 't-1', title: 'Tarefa a mover' })] },
      ...Array.from({ length: 6 }, (_, i) => ({ date: `2026-07-${21 + i}`, tasks: [] })),
    ],
  })

  /** Semana SEGUINTE (destino do stepper "Próxima semana"). */
  const NEXT_WEEK_LOG = weeklyLog({
    weekStart: '2026-07-27',
    days: [
      { date: '2026-07-27', tasks: [task({ id: 't-1', title: 'Tarefa a mover' })] },
      ...Array.from({ length: 6 }, (_, i) => ({ date: `2026-07-${28 + i}`, tasks: [] })),
    ],
  })

  beforeEach(() => {
    vi.resetAllMocks()
    mockFaixa('wide')
    setOnline(true)
  })

  /** `navigator.onLine` é a fonte de `useOnlineStatus`; jsdom nasce online e o
   * `beforeEach` acima restaura, para o estado não vazar entre testes. */
  function setOnline(value: boolean) {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value })
  }

  async function openMoveDialog() {
    renderPage()
    await waitFor(() => expect(screen.getByText('Tarefa a mover')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes de Tarefa a mover' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Mover tarefa' }))
    return screen.getByRole('dialog', { name: 'Escolher destino' })
  }

  function destinationGroup() {
    return screen.getByRole('radiogroup', { name: 'Selecionar destino' })
  }

  it('o detalhe da tarefa oferece "Mover tarefa" e o clique abre o seletor de destino', async () => {
    mockRoutes({ log: LOG_WITH_TASK })
    const dialog = await openMoveDialog()

    expect(dialog).toBeInTheDocument()
    // O detalhe FECHA ao abrir o seletor — dois modais empilhados disputariam
    // foco e backdrop.
    expect(screen.queryByRole('dialog', { name: 'Detalhe da tarefa' })).not.toBeInTheDocument()
    // O seletor nomeia a tarefa que está sendo movida.
    expect(within(dialog).getByText('Tarefa a mover')).toBeInTheDocument()
  })

  it('na semana CORRENTE oferta só os canônicos — a semana em foco já é "Esta Semana"', async () => {
    mockRoutes({ log: LOG_WITH_TASK })
    await openMoveDialog()

    expect(within(destinationGroup()).getAllByRole('radio').map((radio) => radio.textContent)).toEqual([
      'Hoje',
      'Esta Semana',
      'Este Mês',
      'Futuro',
    ])
  })

  it('numa semana NAVEGADA a oferta da semana em foco entra, e nela "Sem dia definido" fica INDISPONÍVEL com motivo', async () => {
    mockRoutes({ log: LOG_WITH_TASK, logByWeekStart: { '2026-07-27': NEXT_WEEK_LOG } })
    renderPage()
    await waitFor(() => expect(screen.getByText('Tarefa a mover')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Próxima semana' }))
    await waitFor(() => expect(screen.getByRole('region', { name: /Segunda/ })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes de Tarefa a mover' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Mover tarefa' }))

    const focused = within(destinationGroup()).getByRole('radio', { name: '27 de julho – 2 de agosto de 2026' })
    fireEvent.click(focused)

    // A regra de domínio: `'week'` SEM `scheduledDate` cai na semana CORRENTE no
    // servidor, nunca na navegada.
    const undated = screen.getByRole('button', {
      name: '0 Sem dia definido — indisponível: esta não é a semana corrente — escolha um dia',
    })
    expect(undated).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(undated)
    expect(screen.queryByRole('button', { name: /^Mover/ })).not.toBeInTheDocument()
  })

  // Irmão do teste acima: aquele para na indisponibilidade do "Sem dia"; este
  // exercita o POST da oferta `board-week`. Sem ele, apagar
  // `|| offerId === MOVE_OFFER.boardWeek` de `migrateFieldsFor` quebraria mover
  // para outra semana EM SILÊNCIO.
  it('a oferta da semana NAVEGADA, com um dia daquela semana armado, manda destination=week + o ISO daquele dia', async () => {
    mockRoutes({ log: LOG_WITH_TASK, logByWeekStart: { '2026-07-27': NEXT_WEEK_LOG } })
    mockPost.mockResolvedValueOnce({ data: task({ id: 't-1' }) })
    renderPage()
    await waitFor(() => expect(screen.getByText('Tarefa a mover')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Próxima semana' }))
    await waitFor(() => expect(screen.getByRole('region', { name: /Segunda/ })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes de Tarefa a mover' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Mover tarefa' }))

    fireEvent.click(within(destinationGroup()).getByRole('radio', { name: '27 de julho – 2 de agosto de 2026' }))
    // Quarta-feira da semana NAVEGADA (29/jul), não da corrente.
    fireEvent.click(screen.getByRole('radio', { name: '3 Quarta, 29 jul.' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mover para quarta, 29 jul.' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/t-1/migrate/', {
        destination: 'week',
        scheduledDate: '2026-07-29',
      }),
    )
  })

  it('destino "Hoje" manda destination=today, sem scheduledDate', async () => {
    mockRoutes({ log: LOG_WITH_TASK })
    mockPost.mockResolvedValueOnce({ data: task({ id: 't-1' }) })
    await openMoveDialog()

    fireEvent.click(within(destinationGroup()).getByRole('radio', { name: 'Hoje' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mover para hoje' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/t-1/migrate/', { destination: 'today' }),
    )
    // Metade da AC2: no SUCESSO o seletor fecha (o detalhe já fechou ao abri-lo).
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Escolher destino' })).not.toBeInTheDocument(),
    )
  })

  it('destino "Esta Semana" com dia escolhido manda destination=week + o ISO exato do dia', async () => {
    mockRoutes({ log: LOG_WITH_TASK })
    mockPost.mockResolvedValueOnce({ data: task({ id: 't-1' }) })
    await openMoveDialog()

    fireEvent.click(within(destinationGroup()).getByRole('radio', { name: 'Esta Semana' }))
    fireEvent.click(screen.getByRole('radio', { name: '3 Quarta, 22 jul.' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mover para quarta, 22 jul.' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/t-1/migrate/', {
        destination: 'week',
        scheduledDate: '2026-07-22',
      }),
    )
  })

  it('destino "Este Mês" sem dia manda destination=month e nenhum scheduledDate (o servidor resolve o mês corrente)', async () => {
    mockRoutes({ log: LOG_WITH_TASK })
    mockPost.mockResolvedValueOnce({ data: task({ id: 't-1' }) })
    await openMoveDialog()

    fireEvent.click(within(destinationGroup()).getByRole('radio', { name: 'Este Mês' }))
    fireEvent.click(screen.getByRole('button', { name: '0 Sem dia definido' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mover sem dia definido (este mês)' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/t-1/migrate/', {
        destination: 'month',
        scheduledDate: undefined,
      }),
    )
  })

  // Par NÃO-VACUOSO do teste acima: `{ scheduledDate: undefined }` também casa
  // quando a chave está AUSENTE, então só o caso "sem dia" não provaria que o
  // dia CHEGA no payload. Cada board tem sua própria cópia de `migrateFieldsFor`.
  it('destino "Este Mês" COM dia armado carrega o ISO do dia no payload', async () => {
    mockRoutes({ log: LOG_WITH_TASK })
    mockPost.mockResolvedValueOnce({ data: task({ id: 't-1' }) })
    await openMoveDialog()

    fireEvent.click(within(destinationGroup()).getByRole('radio', { name: 'Este Mês' }))
    // Calendário do mês corrente (julho/2026, do `logDate` do servidor).
    fireEvent.click(screen.getByRole('button', { name: '15 de julho, sem tarefas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mover para 15 jul.' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/t-1/migrate/', {
        destination: 'month',
        scheduledDate: '2026-07-15',
      }),
    )
  })

  it('destino "Futuro" recusa o mês corrente e, com um mês posterior, manda destination=future + monthFirst', async () => {
    mockRoutes({ log: LOG_WITH_TASK })
    mockPost.mockResolvedValueOnce({ data: task({ id: 't-1' }) })
    await openMoveDialog()

    fireEvent.click(within(destinationGroup()).getByRole('radio', { name: 'Futuro' }))
    const monthInput = screen.getByLabelText('Mês')

    // Mês corrente (julho/2026, derivado do `logDate` do servidor) é recusado.
    fireEvent.change(monthInput, { target: { value: '2026-07' } })
    expect(screen.getByRole('alert')).toHaveTextContent('Este Mês atende o mês corrente')
    expect(screen.queryByRole('button', { name: /^Mover/ })).not.toBeInTheDocument()

    fireEvent.change(monthInput, { target: { value: '2026-09' } })
    fireEvent.click(screen.getByRole('button', { name: '15 de setembro, sem tarefas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mover para 15 set.' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/t-1/migrate/', {
        destination: 'future',
        monthFirst: '2026-09-01',
        scheduledDate: '2026-09-15',
      }),
    )
  })

  it('falha do POST mantém o seletor ABERTO, com o destino armado e o motivo visível', async () => {
    mockRoutes({ log: LOG_WITH_TASK })
    mockPost.mockRejectedValueOnce(new Error('boom'))
    await openMoveDialog()

    fireEvent.click(within(destinationGroup()).getByRole('radio', { name: 'Hoje' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mover para hoje' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível mover a tarefa. Tente novamente.'),
    )
    expect(screen.getByRole('dialog', { name: 'Escolher destino' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mover para hoje' })).toBeInTheDocument()
  })

  it('offline: todos os controles do seletor ficam desabilitados e nenhum POST sai', async () => {
    mockRoutes({ log: LOG_WITH_TASK })
    setOnline(false)
    await openMoveDialog()

    const radios = within(destinationGroup()).getAllByRole('radio')
    expect(radios.every((radio) => (radio as HTMLButtonElement).disabled)).toBe(true)

    fireEvent.click(radios[0]) // "Hoje" — o único confirmável de imediato
    expect(screen.queryByRole('button', { name: 'Mover para hoje' })).not.toBeInTheDocument()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('mutação EM CURSO desabilita a confirmação — o segundo clique não vira um 2º POST', async () => {
    mockRoutes({ log: LOG_WITH_TASK })
    // Promessa que nunca resolve: a mutação fica EM CURSO durante todo o teste,
    // que é exatamente a janela em que o duplo clique geraria a escrita dupla.
    mockPost.mockReturnValue(new Promise(() => {}))
    await openMoveDialog()

    fireEvent.click(within(destinationGroup()).getByRole('radio', { name: 'Hoje' }))
    const confirmar = screen.getByRole('button', { name: 'Mover para hoje' })
    fireEvent.click(confirmar)

    await waitFor(() => expect(confirmar).toBeDisabled())
    fireEvent.click(confirmar)
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it('semana finalized: o rodapé inteiro do detalhe some — não há "Mover tarefa" a clicar', async () => {
    mockRoutes({
      log: weeklyLog({
        status: 'finalized',
        closed: true,
        days: [
          { date: '2026-07-20', tasks: [task({ id: 't-1', title: 'Tarefa a mover' })] },
          ...Array.from({ length: 6 }, (_, i) => ({ date: `2026-07-${21 + i}`, tasks: [] })),
        ],
      }),
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Tarefa a mover')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes de Tarefa a mover' }))
    await screen.findByRole('dialog', { name: 'Detalhe da tarefa' })
    expect(screen.queryByRole('button', { name: 'Mover tarefa' })).not.toBeInTheDocument()
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
