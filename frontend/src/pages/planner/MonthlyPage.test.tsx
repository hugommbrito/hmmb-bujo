import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'
import { createBujoTheme } from '../../theme'
import { MonthlyPage } from './MonthlyPage'

const mockCreateMutate = vi.fn()
const mockUpdateMutate = vi.fn()
const mockRefetch = vi.fn()

// `RecurringPlacementSection` não é mockada aqui (importOriginal) — ela chama
// `useRecurringTemplatesQuery`/`usePlaceRecurringTemplateMutation` direto de
// `../api`, fora deste mock, então continua real e precisa de `client`
// mockado + `QueryClientProvider` de verdade (mesma técnica de WeeklyPage.test.tsx).
vi.mock('../../features/bujo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../features/bujo')>()
  return {
    ...actual,
    useMonthlyLogQuery: vi.fn(),
    useCreateMonthlyTaskMutation: vi.fn(() => ({ mutate: mockCreateMutate })),
    useUpdateTaskMutation: vi.fn(() => ({ mutate: mockUpdateMutate })),
  }
})

vi.mock('../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import { useMonthlyLogQuery } from '../../features/bujo'
import client from '../../api/client'

const mockUseMonthlyLogQuery = useMonthlyLogQuery as ReturnType<typeof vi.fn>
const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>

function renderMonthlyPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={createBujoTheme('light')}>
        <MemoryRouter>
          <MonthlyPage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

// Modo Arquivo (Task 8.2): rota parametrizada `archive/monthly/:monthFirst` —
// só esta variante monta `useParams` com valor real.
function renderMonthlyPageAtArchiveRoute(monthFirst: string) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={createBujoTheme('light')}>
        <MemoryRouter initialEntries={[`/archive/monthly/${monthFirst}`]}>
          <Routes>
            <Route path="archive/monthly/:monthFirst" element={<MonthlyPage />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

// "Hoje" fixado (Task 8.3) — decoupla os testes do relógio real da máquina,
// já que `isCurrentMonth` (MonthlyPage.tsx) compara contra `new Date()`.
const FIXED_TODAY = new Date('2026-07-15T12:00:00')

// Mês NÃO-corrente (junho, com "hoje" fixado em julho) — cobre a regressão da
// 4.1: título continua "Sem dia definido", ordem inalterada.
const MONTHLY_LOG = {
  monthFirst: '2026-06-01',
  closed: false,
  tasks: [
    {
      id: 't1',
      title: 'Com dia',
      status: 'pending',
      eisenhower: null,
      category: null,
      scheduledDate: '2026-06-20',
      subtasks: [],
    },
    {
      id: 't2',
      title: 'Sem dia',
      status: 'pending',
      eisenhower: null,
      category: null,
      scheduledDate: null,
      subtasks: [],
    },
  ],
}

// Mês CORRENTE (julho, mesmo mês de FIXED_TODAY) — seção "Itens do Future Log
// para Julho" deve aparecer antes da seção com data (Task 8.1).
const MONTHLY_LOG_CURRENT = {
  monthFirst: '2026-07-01',
  closed: false,
  tasks: [
    {
      id: 't3',
      title: 'Com dia em julho',
      status: 'pending',
      eisenhower: null,
      category: null,
      scheduledDate: '2026-07-20',
      subtasks: [],
    },
    {
      id: 't4',
      title: 'Do Future Log',
      status: 'pending',
      eisenhower: null,
      category: null,
      scheduledDate: null,
      subtasks: [],
    },
  ],
}

describe('MonthlyPage (AC2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_TODAY)
    // Sem templates recorrentes por padrão — `RecurringPlacementSection` fica
    // sem DOM (banner vazio) e não interfere nos testes que não são sobre ela.
    mockGet.mockResolvedValue({ data: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('mostra skeleton enquanto o log está carregando', () => {
    mockUseMonthlyLogQuery.mockReturnValue({ isPending: true, data: undefined })

    renderMonthlyPage()

    expect(screen.getByLabelText('Este Mês')).toBeInTheDocument()
  })

  it('mostra estado vazio quando não há tarefas', () => {
    mockUseMonthlyLogQuery.mockReturnValue({
      isPending: false,
      data: { monthFirst: '2026-07-01', tasks: [] },
      refetch: mockRefetch,
    })

    renderMonthlyPage()

    expect(screen.getByText('Nenhuma tarefa neste mês.')).toBeInTheDocument()
  })

  it('agrupa tarefa com dia sob um DayHeader e tarefa sem dia em "Sem dia definido"', () => {
    mockUseMonthlyLogQuery.mockReturnValue({ isPending: false, data: MONTHLY_LOG, refetch: mockRefetch })

    renderMonthlyPage()

    expect(screen.getByText('Com dia')).toBeInTheDocument()
    expect(screen.getByText('Sem dia definido')).toBeInTheDocument()
    expect(screen.getByText('Sem dia')).toBeInTheDocument()
  })

  it('TaskRow renderiza somente-leitura (sem botão "Mover tarefa")', () => {
    mockUseMonthlyLogQuery.mockReturnValue({ isPending: false, data: MONTHLY_LOG, refetch: mockRefetch })

    renderMonthlyPage()

    expect(screen.queryByRole('button', { name: 'Mover tarefa' })).not.toBeInTheDocument()
  })

  it('formulário de adicionar tarefa ao mês chama a mutação com monthFirst do log carregado', () => {
    mockUseMonthlyLogQuery.mockReturnValue({ isPending: false, data: MONTHLY_LOG, refetch: mockRefetch })

    renderMonthlyPage()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Nova tarefa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(mockCreateMutate).toHaveBeenCalledWith(
      { monthFirst: '2026-06-01', title: 'Nova tarefa', scheduledDate: undefined },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('formulário com dia opcional envia scheduledDate derivado do mês do log', () => {
    mockUseMonthlyLogQuery.mockReturnValue({ isPending: false, data: MONTHLY_LOG, refetch: mockRefetch })

    renderMonthlyPage()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Com dia novo' } })
    fireEvent.change(screen.getByLabelText('Dia (opcional)'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(mockCreateMutate).toHaveBeenCalledWith(
      { monthFirst: '2026-06-01', title: 'Com dia novo', scheduledDate: '2026-06-05' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    mockUseMonthlyLogQuery.mockReturnValue({ isPending: false, data: MONTHLY_LOG, refetch: mockRefetch })

    const { container } = renderMonthlyPage()
    // jest-axe depende de timers reais (setTimeout/rAF internos) — fake
    // timers (usados aqui só para fixar "hoje" no render) travariam a
    // promise indefinidamente.
    vi.useRealTimers()

    expect(await axe(container)).toHaveNoViolations()
  })

  it('mês corrente: título "Itens do Future Log para Julho" aparece antes da seção com data', () => {
    mockUseMonthlyLogQuery.mockReturnValue({
      isPending: false,
      data: MONTHLY_LOG_CURRENT,
      refetch: mockRefetch,
    })

    renderMonthlyPage()

    expect(screen.getByText('Itens do Future Log para Julho')).toBeInTheDocument()
    expect(screen.getByText('Do Future Log')).toBeInTheDocument()
    expect(screen.getByText('Com dia em julho')).toBeInTheDocument()
    expect(screen.queryByText('Sem dia definido')).not.toBeInTheDocument()

    // A seção "Itens do Future Log" vem ANTES da seção com data (DayHeader) no DOM.
    const allText = document.body.textContent ?? ''
    expect(allText.indexOf('Itens do Future Log para Julho')).toBeLessThan(
      allText.indexOf('Com dia em julho'),
    )
  })

  it('mês NÃO-corrente: título continua "Sem dia definido", ordem inalterada (regressão da 4.1)', () => {
    mockUseMonthlyLogQuery.mockReturnValue({ isPending: false, data: MONTHLY_LOG, refetch: mockRefetch })

    renderMonthlyPage()

    expect(screen.getByText('Sem dia definido')).toBeInTheDocument()
    expect(screen.queryByText(/Itens do Future Log/)).not.toBeInTheDocument()
    const allText = document.body.textContent ?? ''
    expect(allText.indexOf('Com dia')).toBeLessThan(allText.indexOf('Sem dia definido'))
  })

  it('preencher a data de um item sem data chama useUpdateTaskMutation com o scheduledDate certo', () => {
    mockUseMonthlyLogQuery.mockReturnValue({
      isPending: false,
      data: MONTHLY_LOG_CURRENT,
      refetch: mockRefetch,
    })

    renderMonthlyPage()

    fireEvent.change(screen.getByLabelText('Confirmar data'), {
      target: { value: '2026-07-25' },
    })

    expect(mockUpdateMutate).toHaveBeenCalledWith({ taskId: 't4', scheduledDate: '2026-07-25' })
  })
})

const MONTHLY_TEMPLATE = {
  id: 'tpl-1',
  title: 'Revisão mensal',
  description: null,
  eisenhower: null,
  recurrenceGroup: 'monthly',
  recurrenceText: 'todo dia 1',
  active: true,
}

const ANNUAL_TEMPLATE = {
  id: 'tpl-2',
  title: 'Revisão anual',
  description: null,
  eisenhower: null,
  recurrenceGroup: 'annual',
  recurrenceText: 'toda virada de ano',
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
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_TODAY)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('mês corrente (não-janeiro): seção mostra só templates monthly', async () => {
    routeRecurringTemplatesGet([MONTHLY_TEMPLATE, ANNUAL_TEMPLATE])
    mockUseMonthlyLogQuery.mockReturnValue({
      isPending: false,
      data: MONTHLY_LOG_CURRENT,
      refetch: mockRefetch,
    })

    renderMonthlyPage()
    vi.useRealTimers()

    expect(await screen.findByText(/Revisão mensal/)).toBeInTheDocument()
    expect(screen.queryByText(/Revisão anual/)).not.toBeInTheDocument()
  })

  it('mês corrente = janeiro: seção mostra só templates monthly (annual revogado — Story 11.4)', async () => {
    routeRecurringTemplatesGet([MONTHLY_TEMPLATE, ANNUAL_TEMPLATE])
    mockUseMonthlyLogQuery.mockReturnValue({
      isPending: false,
      data: { ...MONTHLY_LOG_CURRENT, monthFirst: '2026-01-01' },
      refetch: mockRefetch,
    })
    vi.setSystemTime(new Date('2026-01-15T12:00:00'))

    renderMonthlyPage()
    vi.useRealTimers()

    expect(await screen.findByText(/Revisão mensal/)).toBeInTheDocument()
    expect(screen.queryByText(/Revisão anual/)).not.toBeInTheDocument()
  })

  it('mês NÃO-corrente: seção não aparece mesmo com templates ativos', async () => {
    routeRecurringTemplatesGet([MONTHLY_TEMPLATE])
    mockUseMonthlyLogQuery.mockReturnValue({ isPending: false, data: MONTHLY_LOG, refetch: mockRefetch })

    renderMonthlyPage()
    vi.useRealTimers()

    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(screen.queryByText(/Revisão mensal/)).not.toBeInTheDocument()
  })

  it('clicar "Definir placement" + confirmar chama a mutation com monthFirst e o dia informado', async () => {
    routeRecurringTemplatesGet([MONTHLY_TEMPLATE])
    mockUseMonthlyLogQuery.mockReturnValue({
      isPending: false,
      data: MONTHLY_LOG_CURRENT,
      refetch: mockRefetch,
    })
    mockPost.mockResolvedValueOnce({
      data: { id: 'task-1', title: 'Revisão mensal', status: 'pending', subtasks: [] },
    })

    renderMonthlyPage()
    vi.useRealTimers()

    fireEvent.click(await screen.findByRole('button', { name: 'Definir placement' }))
    // "Dia (opcional)" também é o rótulo do form "Adicionar tarefa ao mês" —
    // o campo do diálogo é o último no DOM (MUI Dialog é renderizado por
    // último via portal).
    const dayInputs = screen.getAllByLabelText('Dia (opcional)')
    fireEvent.change(dayInputs[dayInputs.length - 1], { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/recurring-templates/tpl-1/place/', {
        monthFirst: '2026-07-01',
        scheduledDate: '2026-07-05',
      }),
    )
  })
})

describe('Dedup + densidade (Story 11.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_TODAY)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('dedup: template já colocado no mês (sourceTemplate) não aparece na lista', async () => {
    routeRecurringTemplatesGet([MONTHLY_TEMPLATE])
    mockUseMonthlyLogQuery.mockReturnValue({
      isPending: false,
      data: {
        ...MONTHLY_LOG_CURRENT,
        tasks: [
          {
            id: 't5',
            title: 'Instância do template',
            status: 'pending',
            eisenhower: null,
            category: null,
            scheduledDate: '2026-07-10',
            subtasks: [],
            sourceTemplate: 'tpl-1',
          },
        ],
      },
      refetch: mockRefetch,
    })

    renderMonthlyPage()
    vi.useRealTimers()

    // A seção aparece (há template no grupo), mas a linha do tpl-1 já colocado
    // some (dedup). Esperamos o cabeçalho e então checamos a ausência da linha.
    await screen.findByText('Recorrentes')
    expect(screen.queryByText(/Revisão mensal/)).not.toBeInTheDocument()
  })

  it('abrir o dialog busca a densidade com o monthFirst do mês exibido', async () => {
    routeRecurringTemplatesGet([MONTHLY_TEMPLATE])
    mockUseMonthlyLogQuery.mockReturnValue({
      isPending: false,
      data: MONTHLY_LOG_CURRENT,
      refetch: mockRefetch,
    })

    renderMonthlyPage()
    vi.useRealTimers()

    fireEvent.click(await screen.findByRole('button', { name: 'Definir placement' }))

    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith('/api/bujo/task-density/', {
        params: { month_first: '2026-07-01' },
      }),
    )
  })
})

describe('Indicador "Fechado" e modo Arquivo (AC1/AC2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_TODAY)
    mockGet.mockResolvedValue({ data: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('closed: true mostra o texto "Fechado"', () => {
    mockUseMonthlyLogQuery.mockReturnValue({
      isPending: false,
      data: { ...MONTHLY_LOG, closed: true },
      refetch: mockRefetch,
    })

    renderMonthlyPage()

    expect(screen.getByText('Fechado')).toBeInTheDocument()
  })

  it('closed: false não mostra o texto "Fechado"', () => {
    mockUseMonthlyLogQuery.mockReturnValue({
      isPending: false,
      data: { ...MONTHLY_LOG, closed: false },
      refetch: mockRefetch,
    })

    renderMonthlyPage()

    expect(screen.queryByText('Fechado')).not.toBeInTheDocument()
  })

  it('rota /archive/monthly/:monthFirst chama useMonthlyLogQuery com o monthFirst da URL e esconde form + recorrentes', () => {
    mockUseMonthlyLogQuery.mockReturnValue({
      isPending: false,
      data: { ...MONTHLY_LOG, closed: true },
      refetch: mockRefetch,
    })

    renderMonthlyPageAtArchiveRoute('2026-06-01')

    expect(mockUseMonthlyLogQuery.mock.calls[0][0]).toBe('2026-06-01')
    expect(screen.getByLabelText('Arquivo — Mês de 2026-06-01')).toBeInTheDocument()
    expect(screen.queryByLabelText('Adicionar tarefa ao mês')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Definir placement' })).not.toBeInTheDocument()
  })

  it('closed: true também esconde o form de criação no período corrente (não só no Arquivo)', () => {
    mockUseMonthlyLogQuery.mockReturnValue({
      isPending: false,
      data: { ...MONTHLY_LOG, closed: true },
      refetch: mockRefetch,
    })

    renderMonthlyPage()

    expect(screen.queryByLabelText('Adicionar tarefa ao mês')).not.toBeInTheDocument()
  })
})

describe('onOpenDetail (Story 11.5, AC2/AC4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_TODAY)
    mockGet.mockResolvedValue({ data: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('clicar no título de uma TaskRow abre o TaskDetailPanel', () => {
    mockUseMonthlyLogQuery.mockReturnValue({ isPending: false, data: MONTHLY_LOG, refetch: mockRefetch })

    renderMonthlyPage()

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes de Com dia' }))

    // O painel é o último "Título" no DOM — o form de criação da própria
    // página já tem um campo com o mesmo rótulo.
    const titleInputs = screen.getAllByLabelText('Título')
    expect(titleInputs[titleInputs.length - 1]).toHaveValue('Com dia')
  })

  it('painel não abre (TaskRow somente-leitura) quando isArchiveView', () => {
    mockUseMonthlyLogQuery.mockReturnValue({
      isPending: false,
      data: { ...MONTHLY_LOG, closed: true },
      refetch: mockRefetch,
    })

    renderMonthlyPageAtArchiveRoute('2026-06-01')

    expect(screen.queryByRole('button', { name: 'Ver detalhes de Com dia' })).not.toBeInTheDocument()
  })

  it('painel não abre (TaskRow somente-leitura) quando closed: true no período corrente', () => {
    mockUseMonthlyLogQuery.mockReturnValue({
      isPending: false,
      data: { ...MONTHLY_LOG, closed: true },
      refetch: mockRefetch,
    })

    renderMonthlyPage()

    expect(screen.queryByRole('button', { name: 'Ver detalhes de Com dia' })).not.toBeInTheDocument()
  })
})
