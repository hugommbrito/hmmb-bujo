import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, Route, Routes, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type QueryMockResult = { isPending: boolean; isError: boolean; data?: unknown; refetch: () => void }

let weeklyLogResult: QueryMockResult
// Dispatch por parâmetro (DW-17): a página agora chama `useWeeklyLogQuery`
// DUAS vezes (o período da URL +, condicionalmente, o período de ORIGEM de
// uma linhagem cross-período semanal) e `useMonthlyLogQuery` uma vez (origem
// mensal, cross-tipo). Os mapas abaixo simulam dados DISTINTOS para o
// período de origem, chaveados pelo `weekStart`/`monthFirst` exato que o
// componente passa — a chamada "própria" da página (sem entrada no mapa) cai
// no `weeklyLogResult` de sempre.
let originWeeklyLogByWeekStart: Record<string, QueryMockResult> = {}
let originMonthlyLogByMonthFirst: Record<string, QueryMockResult> = {}
const disabledQueryResult: QueryMockResult = { isPending: false, isError: false, data: undefined, refetch: vi.fn() }

const useWeeklyLogQueryMock = vi.fn((weekStart?: string, options?: { enabled?: boolean }): QueryMockResult => {
  // Honra `enabled: false` (mesmo quando um teste registrou uma entrada de
  // origem para este `weekStart` por engano) — mantém o mock fiel ao
  // contrato real do hook, não só ao dispatch por parâmetro.
  if (options?.enabled === false) return disabledQueryResult
  return (weekStart !== undefined && originWeeklyLogByWeekStart[weekStart]) || weeklyLogResult
})
const useMonthlyLogQueryMock = vi.fn((monthFirst?: string, options?: { enabled?: boolean }): QueryMockResult => {
  if (options?.enabled === false) return disabledQueryResult
  return (monthFirst !== undefined && originMonthlyLogByMonthFirst[monthFirst]) || disabledQueryResult
})
const mockNavigate = vi.fn()

vi.mock('../../features/bujo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../features/bujo')>()
  return {
    ...actual,
    // Forward via rest-args (NÃO `(weekStart, options) => mock(weekStart, options)`):
    // preserva a ARIDADE exata da chamada real — a chamada "própria" da
    // página (`useWeeklyLogQuery(weekStart)`, 1 argumento) precisa continuar
    // registrando `call.length === 1` em `.mock.calls`, senão o teste de
    // "enabled: false" (que distingue a chamada de origem pelo `call.length`)
    // não consegue diferenciar as duas chamadas.
    useWeeklyLogQuery: (...args: [string?, { enabled?: boolean }?]) => useWeeklyLogQueryMock(...args),
    useMonthlyLogQuery: (...args: [string?, { enabled?: boolean }?]) => useMonthlyLogQueryMock(...args),
  }
})

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import client from '../../api/client'
import { createBujoTheme } from '../../theme'
import { ArchiveWeeklyDetailPage } from './ArchiveWeeklyDetailPage'

const mockPost = client.post as ReturnType<typeof vi.fn>

function task(overrides: Record<string, unknown> = {}) {
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

function weeklyLog(overrides: Record<string, unknown> = {}) {
  return {
    weekStart: '2026-07-13',
    days: [
      { date: '2026-07-13', tasks: [] },
      { date: '2026-07-14', tasks: [] },
      { date: '2026-07-15', tasks: [] },
      { date: '2026-07-16', tasks: [] },
      { date: '2026-07-17', tasks: [] },
      { date: '2026-07-18', tasks: [] },
      { date: '2026-07-19', tasks: [] },
    ],
    unscheduled: [],
    closed: false,
    status: null,
    ...overrides,
  }
}

function queryResult(overrides: Partial<NonNullable<typeof weeklyLogResult>> = {}) {
  return { isPending: false, isError: false, data: undefined, refetch: vi.fn(), ...overrides }
}

function renderPage(initialEntry = '/archive/weekly/2026-07-13', state?: unknown) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={createBujoTheme('light')}>
        <MemoryRouter
          initialEntries={[{ pathname: '/archive/weekly/2026-07-13', search: '', state, key: initialEntry }]}
        >
          <Routes>
            <Route path="/archive/weekly/:weekStart" element={<ArchiveWeeklyDetailPage />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  Element.prototype.scrollIntoView = vi.fn()
  weeklyLogResult = queryResult({ data: undefined })
  originWeeklyLogByWeekStart = {}
  originMonthlyLogByMonthFirst = {}
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ArchiveWeeklyDetailPage (Story 14.10)', () => {
  it('loading: mostra o esqueleto', () => {
    weeklyLogResult = queryResult({ isPending: true, data: undefined })
    renderPage()
    expect(screen.getByRole('main', { name: 'Arquivo — Semana' })).toBeInTheDocument()
  })

  it('erro de leitura (online): mensagem genérica com retry', () => {
    const refetch = vi.fn()
    weeklyLogResult = queryResult({ isError: true, data: undefined, refetch })
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('erro de leitura offline: "não disponível offline", sem retry inútil', () => {
    const onLineSpy = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
    weeklyLogResult = queryResult({ isError: true, data: undefined })
    renderPage()

    expect(screen.getByText('Esta semana não está disponível offline.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument()
    onLineSpy.mockRestore()
  })

  it('semana fechada: "Fechada"/"Somente leitura", sem forms de mutação, TaskRowBase readonly', () => {
    weeklyLogResult = queryResult({
      data: weeklyLog({
        closed: true,
        days: [
          { date: '2026-07-13', tasks: [task({ title: 'Concluída', status: 'completed' })] },
          ...Array.from({ length: 6 }, (_, i) => ({ date: `2026-07-${14 + i}`, tasks: [] })),
        ],
      }),
    })
    renderPage()

    expect(screen.getByText('Fechada')).toBeInTheDocument()
    expect(screen.getByText('Somente leitura')).toBeInTheDocument()
    expect(screen.queryByLabelText('Adicionar tarefa à semana')).not.toBeInTheDocument()
    expect(screen.getByText('Concluída')).toBeInTheDocument()
  })

  it('semana NÃO fechada (alcançada via linhagem): renderiza mutável, com form de criação', () => {
    weeklyLogResult = queryResult({ data: weeklyLog({ closed: false, status: 'active' }) })
    renderPage()

    expect(screen.queryByText('Fechada')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Adicionar tarefa à semana')).toBeInTheDocument()
  })

  it('form de criação: cria tarefa com título e dia, guarda título vazio, refetch ao concluir', async () => {
    const refetch = vi.fn()
    weeklyLogResult = queryResult({ data: weeklyLog({ closed: false }), refetch })
    mockPost.mockResolvedValue({ data: task({ id: 'nova' }) })
    const user = userEvent.setup()
    renderPage()

    // Guarda: título vazio não dispara POST.
    await user.click(screen.getByRole('button', { name: 'Adicionar' }))
    expect(mockPost).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Título'), 'Nova tarefa')
    await user.click(screen.getByRole('button', { name: 'Adicionar' }))

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/bujo/logs/weekly/', expect.objectContaining({ title: 'Nova tarefa' })))
    await waitFor(() => expect(refetch).toHaveBeenCalled())
  })

  it('dia sem tarefas não renderiza day-group vazio (só os dias com conteúdo)', () => {
    weeklyLogResult = queryResult({
      data: weeklyLog({
        days: [
          { date: '2026-07-13', tasks: [task({ title: 'Tarefa da segunda' })] },
          ...Array.from({ length: 6 }, (_, i) => ({ date: `2026-07-${14 + i}`, tasks: [] })),
        ],
      }),
    })
    renderPage()

    expect(screen.getByRole('heading', { name: 'Segunda' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Terça' })).not.toBeInTheDocument()
  })

  it('detalhe da tarefa mostra predecessor quando o sucessor está no mesmo período', async () => {
    const origem = task({ id: 'origem', title: 'Origem', status: 'migrated', migratedToTask: 'sucessor' })
    const sucessor = task({ id: 'sucessor', title: 'Sucessor' })
    weeklyLogResult = queryResult({
      data: weeklyLog({
        days: [
          { date: '2026-07-13', tasks: [origem] },
          { date: '2026-07-14', tasks: [sucessor] },
          ...Array.from({ length: 5 }, (_, i) => ({ date: `2026-07-${15 + i}`, tasks: [] })),
        ],
      }),
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /Ver detalhes de Sucessor/i }))
    expect(screen.getByText(/Veio de/)).toBeInTheDocument()
  })

  it('detalhe da tarefa mostra predecessor quando o predecessor é uma SUBTAREFA (Story 14.10, review)', async () => {
    const origemSub = task({ id: 'origem-sub', title: 'Origem sub', status: 'migrated', migratedToTask: 'sucessor' })
    const origemPai = task({ id: 'origem-pai', title: 'Pai', subtasks: [origemSub] })
    const sucessor = task({ id: 'sucessor', title: 'Sucessor' })
    weeklyLogResult = queryResult({
      data: weeklyLog({
        days: [
          { date: '2026-07-13', tasks: [origemPai] },
          { date: '2026-07-14', tasks: [sucessor] },
          ...Array.from({ length: 5 }, (_, i) => ({ date: `2026-07-${15 + i}`, tasks: [] })),
        ],
      }),
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /Ver detalhes de Sucessor/i }))
    expect(screen.getByText(/Veio de/)).toBeInTheDocument()
  })

  it('predecessor cross-período: origem é um MÊS diferente (Monthly→Weekly, DW-17), "Veio de" usa o dado do período de origem carregado via location.state.originPeriod', async () => {
    const origemNoMes = task({
      id: 'origem-no-mes',
      title: 'Origem no mês',
      status: 'migrated',
      migratedToTask: 'sucessor',
      scheduledDate: '2026-06-10',
    })
    originMonthlyLogByMonthFirst['2026-06-01'] = queryResult({
      data: { monthFirst: '2026-06-01', tasks: [origemNoMes], closed: false, status: null },
    })
    weeklyLogResult = queryResult({
      data: weeklyLog({
        days: [
          { date: '2026-07-13', tasks: [task({ id: 'sucessor', title: 'Sucessor' })] },
          ...Array.from({ length: 6 }, (_, i) => ({ date: `2026-07-${14 + i}`, tasks: [] })),
        ],
      }),
    })
    const user = userEvent.setup()
    renderPage('/archive/weekly/2026-07-13', { originPeriod: { type: 'monthly', monthFirst: '2026-06-01' } })

    await user.click(screen.getByRole('button', { name: /Ver detalhes de Sucessor/i }))
    expect(screen.getByText(/Veio de/)).toBeInTheDocument()
  })

  it('predecessor na MESMA página mas SEMANA diferente (DW-17): origem semanal de outra semana é carregada via location.state.originPeriod', async () => {
    const origemOutraSemana = task({
      id: 'origem-outra-semana',
      title: 'Origem em outra semana',
      status: 'migrated',
      migratedToTask: 'sucessor',
    })
    originWeeklyLogByWeekStart['2026-06-01'] = queryResult({
      data: weeklyLog({
        weekStart: '2026-06-01',
        days: [
          { date: '2026-06-01', tasks: [origemOutraSemana] },
          { date: '2026-06-02', tasks: [] },
          { date: '2026-06-03', tasks: [] },
          { date: '2026-06-04', tasks: [] },
          { date: '2026-06-05', tasks: [] },
          { date: '2026-06-06', tasks: [] },
          { date: '2026-06-07', tasks: [] },
        ],
      }),
    })
    weeklyLogResult = queryResult({
      data: weeklyLog({
        days: [
          { date: '2026-07-13', tasks: [task({ id: 'sucessor', title: 'Sucessor' })] },
          ...Array.from({ length: 6 }, (_, i) => ({ date: `2026-07-${14 + i}`, tasks: [] })),
        ],
      }),
    })
    const user = userEvent.setup()
    renderPage('/archive/weekly/2026-07-13', { originPeriod: { type: 'weekly', weekStart: '2026-06-01' } })

    await user.click(screen.getByRole('button', { name: /Ver detalhes de Sucessor/i }))
    expect(screen.getByText(/Veio de/)).toBeInTheDocument()
  })

  it('chegada direta (sem seta de linhagem, sem originPeriod): nenhuma query de origem fica habilitada, "Veio de" permanece ausente (comportamento de hoje preservado)', async () => {
    weeklyLogResult = queryResult({
      data: weeklyLog({
        days: [
          { date: '2026-07-13', tasks: [task({ id: 'sucessor', title: 'Sucessor direto' })] },
          ...Array.from({ length: 6 }, (_, i) => ({ date: `2026-07-${14 + i}`, tasks: [] })),
        ],
      }),
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /Ver detalhes de Sucessor direto/i }))
    expect(screen.queryByText(/Veio de/)).not.toBeInTheDocument()

    // As duas queries de origem SEMPRE são chamadas (hooks incondicionais),
    // mas com `weekStart`/`monthFirst` undefined e `enabled: false` — nunca
    // disparam a busca "semana atual"/"mês atual" (sentinela) como efeito
    // colateral de `originPeriod` ausente.
    const originWeeklyCall = useWeeklyLogQueryMock.mock.calls.find((call) => call.length > 1)
    const originMonthlyCall = useMonthlyLogQueryMock.mock.calls.find((call) => call.length > 1)
    expect(originWeeklyCall?.[0]).toBeUndefined()
    expect(originWeeklyCall?.[1]).toEqual({ enabled: false })
    expect(originMonthlyCall?.[0]).toBeUndefined()
    expect(originMonthlyCall?.[1]).toEqual({ enabled: false })
  })

  it('linhagem cross-período: sucessor fora do DOM navega para a rota do destino e grava retorno', async () => {
    const origem = task({
      id: 'origem',
      title: 'Origem',
      status: 'migrated',
      migratedToTask: 'sucessor',
      migrationTarget: { type: 'monthly', monthFirst: '2026-08-01' },
    })
    weeklyLogResult = queryResult({
      data: weeklyLog({
        days: [
          { date: '2026-07-13', tasks: [origem] },
          ...Array.from({ length: 6 }, (_, i) => ({ date: `2026-07-${14 + i}`, tasks: [] })),
        ],
      }),
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /ir para o sucessor/i }))

    expect(mockNavigate).toHaveBeenCalledWith(
      '/archive/monthly/2026-08-01',
      expect.objectContaining({
        state: expect.objectContaining({
          focusTaskId: 'sucessor',
          // DW-17: a página de ORIGEM viaja sua própria identidade de
          // período — o destino usa isso para achar o predecessor quando ele
          // não estiver no período que o destino já carregou.
          originPeriod: { type: 'weekly', weekStart: '2026-07-13' },
        }),
      }),
    )
    // DW-18: o valor agora é uma pilha (array JSON), não a string crua.
    expect(sessionStorage.getItem('bujo:archive-lineage-return-task-id')).toBe(JSON.stringify(['origem']))
  })

  it('linhagem cross-período com migrationTarget sem chave utilizável: mostra erro visível, não navega, não grava retorno (achado da review)', async () => {
    const origem = task({
      id: 'origem',
      title: 'Origem',
      status: 'migrated',
      migratedToTask: 'sucessor',
      // `type` presente mas sem a chave correspondente — `pathForMigrationTarget`
      // devolve `null` (inconsistência de dados defensiva).
      migrationTarget: { type: 'monthly' },
    })
    weeklyLogResult = queryResult({
      data: weeklyLog({
        days: [
          { date: '2026-07-13', tasks: [origem] },
          ...Array.from({ length: 6 }, (_, i) => ({ date: `2026-07-${14 + i}`, tasks: [] })),
        ],
      }),
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /ir para o sucessor/i }))

    expect(mockNavigate).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('bujo:archive-lineage-return-task-id')).toBeNull()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível abrir o período de destino desta linhagem.',
    )
  })

  it('retorno cuja linha de origem não existe mais: a entrada de sessionStorage é limpa mesmo assim (não vaza)', async () => {
    // DW-18: entrada gravada no formato de pilha (array JSON).
    sessionStorage.setItem('bujo:archive-lineage-return-task-id', JSON.stringify(['tarefa-que-sumiu']))
    weeklyLogResult = queryResult({
      data: weeklyLog({
        days: [
          { date: '2026-07-13', tasks: [task({ title: 'Outra tarefa' })] },
          ...Array.from({ length: 6 }, (_, i) => ({ date: `2026-07-${14 + i}`, tasks: [] })),
        ],
      }),
    })
    renderPage()

    await waitFor(() =>
      expect(sessionStorage.getItem('bujo:archive-lineage-return-task-id')).toBeNull(),
    )
  })

  it('chegada por linhagem (location.state.focusTaskId) foca a linha sucessora', async () => {
    weeklyLogResult = queryResult({
      data: weeklyLog({
        days: [
          { date: '2026-07-13', tasks: [task({ id: 'sucessor', title: 'Sucessor aqui' })] },
          ...Array.from({ length: 6 }, (_, i) => ({ date: `2026-07-${14 + i}`, tasks: [] })),
        ],
      }),
    })
    renderPage('/archive/weekly/2026-07-13', { focusTaskId: 'sucessor' })

    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled())
    // Foco vai para o primeiro botão da linha (o controle de status, já que o
    // sucessor mutável não tem seta de linhagem própria) — ver
    // `archiveLineageReturn.focusTaskRow`.
    const row = screen.getByText('Sucessor aqui').closest('[data-task-id]') as HTMLElement
    expect(row.querySelector('button')).toHaveFocus()
  })

  it('segunda chegada por linhagem no MESMO período já montado também foca a linha sucessora (achado da review)', async () => {
    weeklyLogResult = queryResult({
      data: weeklyLog({
        days: [
          { date: '2026-07-13', tasks: [task({ id: 'sucessor-1', title: 'Sucessor um' })] },
          { date: '2026-07-14', tasks: [task({ id: 'sucessor-2', title: 'Sucessor dois' })] },
          ...Array.from({ length: 5 }, (_, i) => ({ date: `2026-07-${15 + i}`, tasks: [] })),
        ],
      }),
    })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const router = createMemoryRouter(
      [{ path: '/archive/weekly/:weekStart', element: <ArchiveWeeklyDetailPage /> }],
      { initialEntries: [{ pathname: '/archive/weekly/2026-07-13', state: { focusTaskId: 'sucessor-1' } }] },
    )
    render(
      <QueryClientProvider client={qc}>
        <ThemeProvider theme={createBujoTheme('light')}>
          <RouterProvider router={router} />
        </ThemeProvider>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      const row = screen.getByText('Sucessor um').closest('[data-task-id]') as HTMLElement
      expect(row.querySelector('button')).toHaveFocus()
    })

    // Mesma rota (`weekStart` inalterado) — só o `location.state.focusTaskId`
    // muda, simulando um segundo salto de linhagem pousando na semana já
    // montada. Sem o reset de `arrivalHandledRef` por `location.key`, esta
    // segunda chegada nunca focaria a linha sucessora.
    await act(async () => {
      await router.navigate('/archive/weekly/2026-07-13', { state: { focusTaskId: 'sucessor-2' } })
    })

    await waitFor(() => {
      const row = screen.getByText('Sucessor dois').closest('[data-task-id]') as HTMLElement
      expect(row.querySelector('button')).toHaveFocus()
    })
  })

  it('sem violações de acessibilidade (jest-axe) — semana fechada', async () => {
    weeklyLogResult = queryResult({
      data: weeklyLog({ closed: true, days: [{ date: '2026-07-13', tasks: [task()] }, ...Array.from({ length: 6 }, (_, i) => ({ date: `2026-07-${14 + i}`, tasks: [] }))] }),
    })
    const { container } = renderPage()
    expect(await axe(container)).toHaveNoViolations()
  })
})
