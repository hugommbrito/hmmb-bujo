import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'
import { createBujoTheme } from '../../theme'
import { FuturePage } from './FuturePage'

const mockCreateMutate = vi.fn()

// `RecurringPlacementDialog` não é mockado aqui (importOriginal) — chama
// `useRecurringTemplatesQuery`/`usePlaceRecurringTemplateMutation`/`useTaskDensityQuery`
// direto de `../api`, fora deste mock, então continua real e precisa de
// `client` mockado + `QueryClientProvider` de verdade (mesma técnica de
// MonthlyPage.test.tsx/WeeklyPage.test.tsx, Story 11.3).
vi.mock('../../features/bujo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../features/bujo')>()
  return {
    ...actual,
    useFutureLogQuery: vi.fn(),
    useCreateMonthlyTaskMutation: vi.fn(() => ({ mutate: mockCreateMutate })),
  }
})

vi.mock('../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}))

import { useFutureLogQuery } from '../../features/bujo'
import client from '../../api/client'

const mockUseFutureLogQuery = useFutureLogQuery as ReturnType<typeof vi.fn>
const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>

function renderFuturePage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={createBujoTheme('light')}>
        <FuturePage />
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

const FUTURE_GROUPS = [
  {
    year: 2026,
    month: 7,
    tasks: [
      {
        id: 't1',
        title: 'Pix VG',
        status: 'pending',
        eisenhower: null,
        category: null,
        scheduledDate: '2026-07-14',
        subtasks: [],
      },
      {
        id: 't2',
        title: 'Sem dia definido',
        status: 'pending',
        eisenhower: null,
        category: null,
        scheduledDate: null,
        subtasks: [],
      },
    ],
  },
]

// "Hoje" fixado (mesma técnica de MonthlyPage.test.tsx) — decoupla o
// ano/mês do heading/placement do relógio real da máquina.
const FIXED_TODAY = new Date('2026-07-15T12:00:00')

const ANNUAL_TEMPLATE = {
  id: 'tpl-annual-1',
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

describe('FuturePage (AC2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Sem anuais pendentes por padrão — a seção nova fica sem DOM (AC3) e não
    // interfere nos testes que não são sobre ela (mesmo padrão de MonthlyPage.test.tsx).
    mockGet.mockResolvedValue({ data: [] })
  })

  it('mostra skeleton enquanto carrega', () => {
    mockUseFutureLogQuery.mockReturnValue({ isPending: true, data: undefined })

    renderFuturePage()

    expect(screen.getByLabelText('Futuro')).toBeInTheDocument()
  })

  it('mostra estado vazio quando não há grupos', () => {
    mockUseFutureLogQuery.mockReturnValue({ isPending: false, data: [] })

    renderFuturePage()

    expect(screen.getByText('Nenhum item no futuro ainda.')).toBeInTheDocument()
  })

  it('agrupa por mês com cabeçalho "Julho 2026"', () => {
    mockUseFutureLogQuery.mockReturnValue({ isPending: false, data: FUTURE_GROUPS })

    renderFuturePage()

    expect(screen.getByText('Julho 2026')).toBeInTheDocument()
  })

  it('tarefa com dia exibe prefixo "(14)"', () => {
    mockUseFutureLogQuery.mockReturnValue({ isPending: false, data: FUTURE_GROUPS })

    renderFuturePage()

    expect(screen.getByText('(14)')).toBeInTheDocument()
    expect(screen.getByText('Pix VG')).toBeInTheDocument()
  })

  it('tarefa sem dia exibe prefixo "— jul"', () => {
    mockUseFutureLogQuery.mockReturnValue({ isPending: false, data: FUTURE_GROUPS })

    renderFuturePage()

    expect(screen.getByText('— jul')).toBeInTheDocument()
    expect(screen.getByText('Sem dia definido')).toBeInTheDocument()
  })

  it('submeter o formulário chama useCreateMonthlyTaskMutation', () => {
    mockUseFutureLogQuery.mockReturnValue({ isPending: false, data: [] })

    renderFuturePage()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Item do futuro' } })
    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '2026-12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(mockCreateMutate).toHaveBeenCalledWith({
      monthFirst: '2026-12-01',
      title: 'Item do futuro',
    })
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    mockUseFutureLogQuery.mockReturnValue({ isPending: false, data: FUTURE_GROUPS })

    const { container } = renderFuturePage()

    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('Anuais pendentes de [ano] (AC1/AC2/AC3 — Story 11.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_TODAY)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('com templates annual pendentes, a seção aparece com o heading "Anuais pendentes de 2026"', async () => {
    routeRecurringTemplatesGet([ANNUAL_TEMPLATE])
    mockUseFutureLogQuery.mockReturnValue({ isPending: false, data: [] })

    renderFuturePage()
    vi.useRealTimers()

    expect(await screen.findByText('Anuais pendentes de 2026')).toBeInTheDocument()
    expect(screen.getByText('Revisão anual')).toBeInTheDocument()
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith('/api/bujo/recurring-templates/', {
        params: { active: true, recurrence_group: 'annual', unplaced_year: 2026 },
      }),
    )
  })

  it('lista vazia: a seção não aparece (sem heading, sem DOM) — AC3', async () => {
    mockGet.mockResolvedValue({ data: [] })
    mockUseFutureLogQuery.mockReturnValue({ isPending: false, data: [] })

    renderFuturePage()
    vi.useRealTimers()

    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(screen.queryByText(/Anuais pendentes de/)).not.toBeInTheDocument()
  })

  it('clicar "Definir placement" abre o RecurringPlacementDialog com as infos do template', async () => {
    routeRecurringTemplatesGet([ANNUAL_TEMPLATE])
    mockUseFutureLogQuery.mockReturnValue({ isPending: false, data: [] })

    renderFuturePage()
    vi.useRealTimers()

    fireEvent.click(await screen.findByRole('button', { name: 'Definir placement' }))

    expect(screen.getByText('Recorrência: toda virada de ano')).toBeInTheDocument()
  })

  it('confirmar com data preenchida chama client.post com monthFirst e scheduledDate da data', async () => {
    routeRecurringTemplatesGet([ANNUAL_TEMPLATE])
    mockUseFutureLogQuery.mockReturnValue({ isPending: false, data: [] })
    mockPost.mockResolvedValueOnce({
      data: { id: 'task-1', title: 'Revisão anual', status: 'pending', subtasks: [] },
    })

    renderFuturePage()
    vi.useRealTimers()

    fireEvent.click(await screen.findByRole('button', { name: 'Definir placement' }))
    fireEvent.change(screen.getByLabelText('Data (opcional)'), {
      target: { value: '2026-11-20' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/api/bujo/recurring-templates/tpl-annual-1/place/',
        { monthFirst: '2026-11-01', scheduledDate: '2026-11-20' },
      ),
    )
  })

  it('confirmar sem preencher a data chama client.post com o mês corrente e scheduledDate undefined', async () => {
    routeRecurringTemplatesGet([ANNUAL_TEMPLATE])
    mockUseFutureLogQuery.mockReturnValue({ isPending: false, data: [] })
    mockPost.mockResolvedValueOnce({
      data: { id: 'task-1', title: 'Revisão anual', status: 'pending', subtasks: [] },
    })

    renderFuturePage()
    vi.useRealTimers()

    fireEvent.click(await screen.findByRole('button', { name: 'Definir placement' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/api/bujo/recurring-templates/tpl-annual-1/place/',
        { monthFirst: '2026-07-01', scheduledDate: undefined },
      ),
    )
  })

  it('sem violações de acessibilidade com a seção renderizada (jest-axe)', async () => {
    routeRecurringTemplatesGet([ANNUAL_TEMPLATE])
    mockUseFutureLogQuery.mockReturnValue({ isPending: false, data: [] })

    const { container } = renderFuturePage()
    vi.useRealTimers()

    await screen.findByText('Anuais pendentes de 2026')

    expect(await axe(container)).toHaveNoViolations()
  })
})
