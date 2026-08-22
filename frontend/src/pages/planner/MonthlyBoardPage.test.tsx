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
    migrationTarget: null,
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
  logByMonthFirst,
}: {
  log: ReturnType<typeof monthlyLog>
  readiness?: unknown
  todayLog?: unknown
  /** Mês NAVEGADO (`?month_first=`) — sem isto o stepper devolveria o mesmo mês
   * e `isCurrentMonth` nunca ficaria falso. */
  logByMonthFirst?: Record<string, ReturnType<typeof monthlyLog>>
}) {
  mockGet.mockImplementation((url: string, config?: { params?: { month_first?: string } }) => {
    if (url === '/api/bujo/logs/monthly/cycle/') return Promise.resolve({ data: readiness })
    if (url === '/api/bujo/logs/monthly/') {
      const monthFirst = config?.params?.month_first
      const navigated = monthFirst ? logByMonthFirst?.[monthFirst] : undefined
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

// ─────────────────────────────────────────────────────────────────────────────
// DW-27 — "Mover tarefa" cabeado. Além de fechar o clique morto, a regra de
// domínio do Monthly não pode regredir em silêncio: `'month'` sempre grava no
// mês CORRENTE no servidor, então o mês NAVEGADO só é alcançável por `'future'`
// — e apenas quando é posterior ao corrente.
// ─────────────────────────────────────────────────────────────────────────────
describe('MonthlyBoardPage — "Mover tarefa" (DW-27)', () => {
  const POOL_TASK = task({ id: 't-1', title: 'Tarefa a mover', scheduledDate: null })
  const LOG_WITH_TASK = monthlyLog({ tasks: [POOL_TASK] })
  const NEXT_MONTH_LOG = monthlyLog({ monthFirst: '2026-09-01', tasks: [POOL_TASK] })
  const PREVIOUS_MONTH_LOG = monthlyLog({ monthFirst: '2026-07-01', tasks: [POOL_TASK] })

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

  function destinationGroup() {
    return screen.getByRole('radiogroup', { name: 'Selecionar destino' })
  }

  async function openMoveDialog() {
    await waitFor(() => expect(screen.getByText('Tarefa a mover')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes de Tarefa a mover' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Mover tarefa' }))
    return screen.getByRole('dialog', { name: 'Escolher destino' })
  }

  it('o clique em "Mover tarefa" fecha o detalhe e abre o seletor de destino', async () => {
    mockRoutes({ log: LOG_WITH_TASK })
    renderPage()
    const dialog = await openMoveDialog()

    expect(dialog).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Detalhe da tarefa' })).not.toBeInTheDocument()
    expect(within(dialog).getByText('Tarefa a mover')).toBeInTheDocument()
  })

  it('mês em foco CORRENTE: oferta só os canônicos e "Este Mês" manda destination=month', async () => {
    mockRoutes({ log: LOG_WITH_TASK })
    mockPost.mockResolvedValueOnce({ data: task({ id: 't-1' }) })
    renderPage()
    await openMoveDialog()

    // Sem oferta do "mês em foco": ele JÁ é "Este Mês".
    expect(within(destinationGroup()).getAllByRole('radio').map((radio) => radio.textContent)).toEqual([
      'Hoje',
      'Esta Semana',
      'Este Mês',
      'Futuro',
    ])

    fireEvent.click(within(destinationGroup()).getByRole('radio', { name: 'Este Mês' }))
    fireEvent.click(screen.getByRole('button', { name: '12 de agosto, sem tarefas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mover para 12 ago.' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/t-1/migrate/', {
        destination: 'month',
        scheduledDate: '2026-08-12',
      }),
    )
  })

  it('mês em foco POSTERIOR ao corrente: a oferta do mês em foco manda destination=future + monthFirst', async () => {
    mockRoutes({ log: LOG_WITH_TASK, logByMonthFirst: { '2026-09-01': NEXT_MONTH_LOG } })
    mockPost.mockResolvedValueOnce({ data: task({ id: 't-1' }) })
    renderPage()
    await waitFor(() => expect(screen.getByText('Tarefa a mover')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Próximo mês operacional' }))
    await waitFor(() => expect(screen.getByText('Setembro de 2026')).toBeInTheDocument())
    await openMoveDialog()

    // "Este Mês" e o mês EM FOCO coexistem e significam meses DIFERENTES: o
    // primeiro é sempre o corrente (o servidor resolve `month_first`), o segundo
    // é o navegado, e só ele alcança setembro.
    expect(within(destinationGroup()).getAllByRole('radio').map((radio) => radio.textContent)).toEqual([
      'Hoje',
      'Esta Semana',
      'Este Mês',
      'Setembro de 2026',
      'Futuro',
    ])

    fireEvent.click(within(destinationGroup()).getByRole('radio', { name: 'Setembro de 2026' }))
    fireEvent.click(screen.getByRole('button', { name: '15 de setembro, sem tarefas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mover para 15 set.' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/t-1/migrate/', {
        destination: 'future',
        monthFirst: '2026-09-01',
        scheduledDate: '2026-09-15',
      }),
    )
    // Metade da AC2: no SUCESSO o seletor fecha.
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Escolher destino' })).not.toBeInTheDocument(),
    )
  })

  it('mês em foco ANTERIOR ao corrente: a oferta aparece INDISPONÍVEL com o motivo e nenhum POST acontece', async () => {
    mockRoutes({ log: LOG_WITH_TASK, logByMonthFirst: { '2026-07-01': PREVIOUS_MONTH_LOG } })
    renderPage()
    await waitFor(() => expect(screen.getByText('Tarefa a mover')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Mês anterior' }))
    await waitFor(() => expect(screen.getByText('Julho de 2026')).toBeInTheDocument())
    await openMoveDialog()

    const past = within(destinationGroup()).getByRole('radio', {
      name: 'Julho de 2026 — indisponível: este mês já é anterior ao mês atual',
    })
    expect(past).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(past)
    expect(past).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByRole('button', { name: /^Mover/ })).not.toBeInTheDocument()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('destino "Esta Semana" sem dia manda destination=week (o servidor resolve a semana corrente)', async () => {
    mockRoutes({ log: LOG_WITH_TASK })
    mockPost.mockResolvedValueOnce({ data: task({ id: 't-1' }) })
    renderPage()
    await openMoveDialog()

    fireEvent.click(within(destinationGroup()).getByRole('radio', { name: 'Esta Semana' }))
    fireEvent.click(screen.getByRole('button', { name: '0 Sem dia definido' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mover sem dia definido (esta semana)' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/t-1/migrate/', {
        destination: 'week',
        scheduledDate: undefined,
      }),
    )
  })

  // Par NÃO-VACUOSO do teste acima: `{ scheduledDate: undefined }` também casa
  // quando a chave está AUSENTE, então só o caso "sem dia" não provaria que o
  // dia CHEGA no payload. Cada board tem sua própria cópia de `migrateFieldsFor`.
  it('destino "Esta Semana" COM dia armado carrega o ISO do dia no payload', async () => {
    mockRoutes({ log: LOG_WITH_TASK })
    mockPost.mockResolvedValueOnce({ data: task({ id: 't-1' }) })
    renderPage()
    await openMoveDialog()

    fireEvent.click(within(destinationGroup()).getByRole('radio', { name: 'Esta Semana' }))
    // `todayLog.logDate` = 2026-08-12 (quarta) ⇒ semana corrente de 2026-08-10
    // (segunda) a 2026-08-16; "3 Quarta" é o próprio 12/ago.
    fireEvent.click(screen.getByRole('radio', { name: '3 Quarta, 12 ago.' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mover para quarta, 12 ago.' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/t-1/migrate/', {
        destination: 'week',
        scheduledDate: '2026-08-12',
      }),
    )
  })

  it('destino "Hoje" manda destination=today, sem scheduledDate', async () => {
    mockRoutes({ log: LOG_WITH_TASK })
    mockPost.mockResolvedValueOnce({ data: task({ id: 't-1' }) })
    renderPage()
    await openMoveDialog()

    fireEvent.click(within(destinationGroup()).getByRole('radio', { name: 'Hoje' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mover para hoje' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/t-1/migrate/', { destination: 'today' }),
    )
  })

  it('falha do POST mantém o seletor ABERTO, com o destino armado e o motivo visível', async () => {
    mockRoutes({ log: LOG_WITH_TASK })
    mockPost.mockRejectedValueOnce(new Error('boom'))
    renderPage()
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
    renderPage()
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
    renderPage()
    await openMoveDialog()

    fireEvent.click(within(destinationGroup()).getByRole('radio', { name: 'Hoje' }))
    const confirmar = screen.getByRole('button', { name: 'Mover para hoje' })
    fireEvent.click(confirmar)

    await waitFor(() => expect(confirmar).toBeDisabled())
    fireEvent.click(confirmar)
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it('mês finalized: o rodapé inteiro do detalhe some — não há "Mover tarefa" a clicar', async () => {
    mockRoutes({ log: monthlyLog({ status: 'finalized', closed: true, tasks: [POOL_TASK] }) })
    renderPage()
    await waitFor(() => expect(screen.getByText('Tarefa a mover')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes de Tarefa a mover' }))
    await screen.findByRole('dialog', { name: 'Detalhe da tarefa' })
    expect(screen.queryByRole('button', { name: 'Mover tarefa' })).not.toBeInTheDocument()
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
