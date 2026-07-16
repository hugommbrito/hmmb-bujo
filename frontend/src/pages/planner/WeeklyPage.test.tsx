import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'
import { createBujoTheme } from '../../theme'
import { WeeklyPage } from './WeeklyPage'

// `RecurringPlacementSection` não é mockada aqui (importOriginal) — ela chama
// `useRecurringTemplatesQuery`/`usePlaceRecurringTemplateMutation` direto de
// `../api`, fora deste mock, então continua real e precisa de `client`
// mockado + `QueryClientProvider` de verdade (mesma técnica de DailyPage.test.tsx).
vi.mock('../../features/bujo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../features/bujo')>()
  return {
    ...actual,
    useWeeklyLogQuery: vi.fn(),
  }
})

vi.mock('../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import { useWeeklyLogQuery } from '../../features/bujo'
import client from '../../api/client'

const mockUseWeeklyLogQuery = useWeeklyLogQuery as ReturnType<typeof vi.fn>
const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>

function mockMatchMedia(matchesMobile: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: matchesMobile && query === '(max-width: 767px)',
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

function renderWeeklyPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={createBujoTheme('light')}>
        <MemoryRouter>
          <WeeklyPage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

// Modo Arquivo (Task 8.1): rota parametrizada `archive/weekly/:weekStart` — só
// esta variante monta `useParams` com valor real.
function renderWeeklyPageAtArchiveRoute(weekStart: string) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={createBujoTheme('light')}>
        <MemoryRouter initialEntries={[`/archive/weekly/${weekStart}`]}>
          <Routes>
            <Route path="archive/weekly/:weekStart" element={<WeeklyPage />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

const DAYS = [
  { date: '2026-07-13', tasks: [{ id: 't1', title: 'Tarefa segunda', status: 'pending', eisenhower: null, category: null, subtasks: [] }] },
  { date: '2026-07-14', tasks: [] },
  { date: '2026-07-15', tasks: [] },
  { date: '2026-07-16', tasks: [] },
  { date: '2026-07-17', tasks: [] },
  { date: '2026-07-18', tasks: [] },
  { date: '2026-07-19', tasks: [] },
]

const WEEKLY_LOG = {
  weekStart: '2026-07-13',
  days: DAYS,
  closed: false,
  unscheduled: [
    { id: 'u1', title: 'Tarefa sem dia', status: 'pending', eisenhower: null, category: null, subtasks: [] },
  ],
}

describe('WeeklyPage (AC3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMatchMedia(false)
    // Sem templates recorrentes por padrão — `RecurringPlacementSection` fica
    // sem DOM (banner vazio) e não interfere nos testes que não são sobre ela.
    mockGet.mockResolvedValue({ data: [] })
  })

  it('mostra skeleton enquanto o log está carregando', () => {
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: true, data: undefined })

    renderWeeklyPage()

    expect(screen.getByLabelText('Esta Semana')).toBeInTheDocument()
  })

  it('desktop: renderiza os 7 dias em grade de 2 linhas (AC3)', () => {
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: WEEKLY_LOG })

    renderWeeklyPage()

    expect(screen.getByText('Tarefa segunda')).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    // Os 7 dias continuam renderizando (grade de 4 colunas → 4 + 3): um
    // DayHeader por dia, cada um com seu botão de colapsar. Sem asserção
    // frágil de `display: grid`.
    expect(screen.getAllByRole('button', { name: 'Colapsar lista de tarefas' })).toHaveLength(7)
  })

  it('mobile: renderiza o seletor de dia e mostra só o dia selecionado', () => {
    mockMatchMedia(true)
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: WEEKLY_LOG })

    renderWeeklyPage()

    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getByText('Tarefa segunda')).toBeInTheDocument()
  })

  it('renderiza a seção "Sem dia definido" com as tarefas do weekly log sem scheduledDate', () => {
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: WEEKLY_LOG })

    renderWeeklyPage()

    // `{ selector: 'span' }` desambigua do texto idêntico exibido pelo Select
    // "Dia (opcional)" do form de criação (Task 7.2) — o valor fechado do
    // MUI Select é um `<div role="combobox">`, não um `<span>`.
    expect(screen.getByText('Sem dia definido', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('Tarefa sem dia')).toBeInTheDocument()
  })

  it('não renderiza a seção "Sem dia definido" quando unscheduled está vazio', () => {
    mockUseWeeklyLogQuery.mockReturnValue({
      isPending: false,
      data: { ...WEEKLY_LOG, unscheduled: [] },
    })

    renderWeeklyPage()

    expect(screen.queryByText('Sem dia definido', { selector: 'span' })).not.toBeInTheDocument()
  })

  it('TaskRow renderiza somente-leitura (sem botão "Reordenar tarefa", ciclo de status desabilitado)', () => {
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: WEEKLY_LOG })

    renderWeeklyPage()

    expect(screen.queryByRole('button', { name: 'Reordenar tarefa' })).not.toBeInTheDocument()
  })

  it('botão "Mover tarefa" (Story 11.6) aparece mesmo sem onReorder', () => {
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: WEEKLY_LOG })

    renderWeeklyPage()

    expect(screen.getAllByRole('button', { name: 'Mover tarefa' }).length).toBeGreaterThan(0)
  })

  it('sem violações de acessibilidade (jest-axe) no desktop', async () => {
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: WEEKLY_LOG })

    const { container } = renderWeeklyPage()

    expect(await axe(container)).toHaveNoViolations()
  })

  it('sem violações de acessibilidade (jest-axe) no mobile', async () => {
    mockMatchMedia(true)
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: WEEKLY_LOG })

    const { container } = renderWeeklyPage()

    expect(await axe(container)).toHaveNoViolations()
  })
})

const WEEKLY_TEMPLATE = {
  id: 'tpl-1',
  title: 'Revisão semanal',
  description: null,
  eisenhower: null,
  recurrenceGroup: 'weekly',
  recurrenceText: 'toda sexta',
  active: true,
}

function routeRecurringTemplatesGet(templates: unknown[]) {
  mockGet.mockImplementation((requestUrl: string) => {
    if (requestUrl === '/api/bujo/recurring-templates/') {
      return Promise.resolve({ data: templates })
    }
    return Promise.resolve({ data: [] })
  })
}

describe('RecurringPlacementSection integration (AC2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMatchMedia(false)
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: WEEKLY_LOG })
  })

  it('seção não aparece quando não há templates weekly ativos', async () => {
    routeRecurringTemplatesGet([])

    renderWeeklyPage()

    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(screen.queryByText('Recorrentes')).not.toBeInTheDocument()
  })

  it('seção aparece com o template weekly ativo e some se ele for inativo', async () => {
    routeRecurringTemplatesGet([WEEKLY_TEMPLATE])

    renderWeeklyPage()

    expect(await screen.findByText(/Revisão semanal/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Definir placement' })).toBeInTheDocument()
  })

  it('clicar "Definir placement" + confirmar chama a mutation com os parâmetros certos', async () => {
    routeRecurringTemplatesGet([WEEKLY_TEMPLATE])
    mockPost.mockResolvedValueOnce({
      data: { id: 'task-1', title: 'Revisão semanal', status: 'pending', subtasks: [] },
    })

    renderWeeklyPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Definir placement' }))
    fireEvent.change(screen.getByLabelText('Data (opcional)'), {
      target: { value: '2026-07-15' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/recurring-templates/tpl-1/place/', {
        weekStart: '2026-07-13',
        scheduledDate: '2026-07-15',
      }),
    )
  })
})

describe('Dedup + densidade (Story 11.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMatchMedia(false)
  })

  it('dedup: template com instância na semana (sourceTemplate) não aparece na lista', async () => {
    routeRecurringTemplatesGet([WEEKLY_TEMPLATE])
    mockUseWeeklyLogQuery.mockReturnValue({
      isPending: false,
      data: {
        ...WEEKLY_LOG,
        days: [
          {
            date: '2026-07-13',
            tasks: [
              {
                id: 't1',
                title: 'Instância colocada',
                status: 'pending',
                eisenhower: null,
                category: null,
                subtasks: [],
                sourceTemplate: 'tpl-1',
              },
            ],
          },
          ...DAYS.slice(1),
        ],
        unscheduled: [],
      },
    })

    renderWeeklyPage()

    // A seção aparece (há template no grupo), mas a linha do tpl-1 já colocado
    // some (dedup). Esperamos o cabeçalho e então checamos a ausência da linha.
    await screen.findByText('Recorrentes')
    expect(screen.queryByText(/Revisão semanal/)).not.toBeInTheDocument()
  })

  it('abrir o dialog busca a densidade com monthFirst = mês do weekStart', async () => {
    routeRecurringTemplatesGet([WEEKLY_TEMPLATE])
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: WEEKLY_LOG })

    renderWeeklyPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Definir placement' }))

    // weekStart 2026-07-13 → mês 2026-07-01.
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith('/api/bujo/task-density/', {
        params: { month_first: '2026-07-01' },
      }),
    )
  })
})

describe('Indicador "Fechada" e modo Arquivo (AC1/AC2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMatchMedia(false)
    mockGet.mockResolvedValue({ data: [] })
  })

  it('closed: true mostra o texto "Fechada"', () => {
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: { ...WEEKLY_LOG, closed: true } })

    renderWeeklyPage()

    expect(screen.getByText('Fechada')).toBeInTheDocument()
  })

  it('closed: false não mostra o texto "Fechada"', () => {
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: { ...WEEKLY_LOG, closed: false } })

    renderWeeklyPage()

    expect(screen.queryByText('Fechada')).not.toBeInTheDocument()
  })

  it('rota /archive/weekly/:weekStart chama useWeeklyLogQuery com o weekStart da URL e esconde recorrentes', async () => {
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: { ...WEEKLY_LOG, closed: true } })

    renderWeeklyPageAtArchiveRoute('2026-07-13')

    expect(mockUseWeeklyLogQuery.mock.calls[0][0]).toBe('2026-07-13')
    expect(screen.getByLabelText('Arquivo — Semana de 2026-07-13')).toBeInTheDocument()
    expect(mockGet).not.toHaveBeenCalledWith('/api/bujo/recurring-templates/')
    expect(screen.queryByRole('button', { name: 'Definir placement' })).not.toBeInTheDocument()
  })
})

describe('Navegação anterior/próximo + indicadores de 3 estados (Story 11.11, AC1/AC5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMatchMedia(false)
    mockGet.mockResolvedValue({ data: [] })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('semana corrente: botão "Semana anterior" navega para weekStart -7 dias', () => {
    vi.setSystemTime(new Date('2026-07-13T12:00:00'))
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: WEEKLY_LOG })

    renderWeeklyPage()

    expect(screen.getByRole('link', { name: 'Semana anterior' })).toHaveAttribute(
      'href',
      '/archive/weekly/2026-07-06',
    )
  })

  it('semana corrente: botão "Próxima semana" ausente, sem indicador extra, sem link de volta', () => {
    vi.setSystemTime(new Date('2026-07-13T12:00:00'))
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: WEEKLY_LOG })

    renderWeeklyPage()

    expect(screen.queryByRole('link', { name: 'Próxima semana' })).not.toBeInTheDocument()
    expect(screen.queryByText('Você está vendo uma semana passada.')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Voltar para a semana atual' })).not.toBeInTheDocument()
  })

  it('semana passada aberta: indicador informativo + "Próxima semana" navega para weekStart +7 dias', () => {
    vi.setSystemTime(new Date('2026-07-27T12:00:00'))
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: WEEKLY_LOG })

    renderWeeklyPage()

    expect(screen.getByText('Você está vendo uma semana passada.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Próxima semana' })).toHaveAttribute(
      'href',
      '/archive/weekly/2026-07-20',
    )
    expect(screen.getByRole('link', { name: 'Voltar para a semana atual' })).toHaveAttribute(
      'href',
      '/planner/week',
    )
  })

  it('"Próxima semana" a partir da semana imediatamente anterior à corrente cai na rota canônica', () => {
    vi.setSystemTime(new Date('2026-07-20T12:00:00'))
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: WEEKLY_LOG })

    renderWeeklyPage()

    expect(screen.getByRole('link', { name: 'Próxima semana' })).toHaveAttribute(
      'href',
      '/planner/week',
    )
  })

  it('semana passada fechada: indicador "Fechada" (não o informativo) + link de volta', () => {
    vi.setSystemTime(new Date('2026-07-27T12:00:00'))
    mockUseWeeklyLogQuery.mockReturnValue({
      isPending: false,
      data: { ...WEEKLY_LOG, closed: true },
    })

    renderWeeklyPage()

    expect(screen.getByText('Fechada')).toBeInTheDocument()
    expect(screen.queryByText('Você está vendo uma semana passada.')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar para a semana atual' })).toBeInTheDocument()
  })

  it('sem violações de acessibilidade (jest-axe) numa semana passada aberta (nav anterior/próximo + indicador + link de volta)', async () => {
    vi.setSystemTime(new Date('2026-07-27T12:00:00'))
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: WEEKLY_LOG })

    const { container } = renderWeeklyPage()
    // `axe` usa timers reais internamente — sem isso, trava com fake timers
    // ativos (mesmo problema do describe block inteiro usar `vi.useFakeTimers`).
    vi.useRealTimers()

    expect(await axe(container)).toHaveNoViolations()
  })

  it('rascunho do formulário/painel aberto não vaza entre semanas ao navegar via "Semana anterior" (regressão — WeeklyPage não remonta entre rotas)', () => {
    vi.setSystemTime(new Date('2026-07-13T12:00:00'))
    mockUseWeeklyLogQuery.mockImplementation((weekStart?: string) => ({
      isPending: false,
      data: { ...WEEKLY_LOG, weekStart: weekStart ?? WEEKLY_LOG.weekStart },
    }))
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    render(
      <QueryClientProvider client={qc}>
        <ThemeProvider theme={createBujoTheme('light')}>
          <MemoryRouter initialEntries={['/planner/week']}>
            <Routes>
              <Route path="/planner/week" element={<WeeklyPage />} />
              <Route path="/archive/weekly/:weekStart" element={<WeeklyPage />} />
            </Routes>
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>,
    )

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'rascunho não enviado' } })
    expect(screen.getByLabelText('Título')).toHaveValue('rascunho não enviado')

    fireEvent.click(screen.getByRole('link', { name: 'Semana anterior' }))

    expect(screen.getByLabelText('Título')).toHaveValue('')
  })
})

describe('Formulário de criação de tarefa (Story 11.5, AC1/AC4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMatchMedia(false)
    mockGet.mockResolvedValue({ data: [] })
    // `refetch` mockado: o handleSubmit da página chama `weeklyLog.refetch()`
    // no onSuccess (mesmo descompasso de sentinel 'current' vs weekStart
    // explícito já corrigido em MonthlyPage — ver WeeklyPage.tsx).
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: WEEKLY_LOG, refetch: vi.fn() })
  })

  it('submit com dia selecionado chama client.post com weekStart/title/scheduledDate', async () => {
    mockPost.mockResolvedValueOnce({
      data: { id: 'new-1', title: 'Nova tarefa', status: 'pending', subtasks: [] },
    })

    renderWeeklyPage()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Nova tarefa' } })
    fireEvent.mouseDown(screen.getByLabelText('Dia (opcional)'))
    fireEvent.click(screen.getByRole('option', { name: 'SEG 13' }))
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/logs/weekly/', {
        weekStart: '2026-07-13',
        title: 'Nova tarefa',
        scheduledDate: '2026-07-13',
      }),
    )
  })

  it('submit sem dia chama client.post com scheduledDate undefined', async () => {
    mockPost.mockResolvedValueOnce({
      data: { id: 'new-1', title: 'Sem dia', status: 'pending', subtasks: [] },
    })

    renderWeeklyPage()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Sem dia' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/logs/weekly/', {
        weekStart: '2026-07-13',
        title: 'Sem dia',
        scheduledDate: undefined,
      }),
    )
  })

  it('título vazio não submete', () => {
    renderWeeklyPage()

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(mockPost).not.toHaveBeenCalledWith('/api/bujo/logs/weekly/', expect.anything())
  })

  it('form não aparece quando closed: true', () => {
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: { ...WEEKLY_LOG, closed: true } })

    renderWeeklyPage()

    expect(screen.queryByLabelText('Adicionar tarefa à semana')).not.toBeInTheDocument()
  })

  it('form aparece em período passado aberto (closed: false) mesmo via rota parametrizada', () => {
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: WEEKLY_LOG })

    renderWeeklyPageAtArchiveRoute('2026-07-13')

    expect(screen.getByLabelText('Adicionar tarefa à semana')).toBeInTheDocument()
  })
})

describe('onOpenDetail (Story 11.5, AC2/AC4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMatchMedia(false)
    mockGet.mockResolvedValue({ data: [] })
  })

  it('clicar no título de uma TaskRow abre o TaskDetailPanel', () => {
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: WEEKLY_LOG })

    renderWeeklyPage()

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes de Tarefa segunda' }))

    // O painel é o último "Título" no DOM — o form de criação da própria
    // página (Task 7.1) já tem um campo com o mesmo rótulo.
    const titleInputs = screen.getAllByLabelText('Título')
    expect(titleInputs[titleInputs.length - 1]).toHaveValue('Tarefa segunda')
  })

  it('painel não abre (TaskRow somente-leitura) quando closed: true, mesmo via rota parametrizada', () => {
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: { ...WEEKLY_LOG, closed: true } })

    renderWeeklyPageAtArchiveRoute('2026-07-13')

    expect(
      screen.queryByRole('button', { name: 'Ver detalhes de Tarefa segunda' }),
    ).not.toBeInTheDocument()
  })

  it('painel abre (TaskRow acionável) em período passado aberto (closed: false) via rota parametrizada', () => {
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: WEEKLY_LOG })

    renderWeeklyPageAtArchiveRoute('2026-07-13')

    expect(screen.getByRole('button', { name: 'Ver detalhes de Tarefa segunda' })).toBeInTheDocument()
  })

  it('painel não abre (TaskRow somente-leitura) quando closed: true no período corrente', () => {
    mockUseWeeklyLogQuery.mockReturnValue({ isPending: false, data: { ...WEEKLY_LOG, closed: true } })

    renderWeeklyPage()

    expect(
      screen.queryByRole('button', { name: 'Ver detalhes de Tarefa segunda' }),
    ).not.toBeInTheDocument()
  })
})
