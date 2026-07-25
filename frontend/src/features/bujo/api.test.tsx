import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import client from '../../api/client'
import { keys } from '../../api/keys'
import {
  useTodayLogQuery,
  useTransitionTaskMutation,
  useCreateTaskMutation,
  useCreateSubtaskMutation,
  useUpdateTaskMutation,
  useReorderTaskMutation,
  useWeeklyLogQuery,
  useMonthlyLogQuery,
  useFutureLogQuery,
  useCreateMonthlyTaskMutation,
  useCreateWeeklyTaskMutation,
  useDeleteTaskMutation,
  useMigrationQueueQuery,
  useMigrateTaskMutation,
  useWeeklyReviewQueueQuery,
  useMonthlyReviewQueueQuery,
  useCatchUpQueueQuery,
  useRecurringTemplatesQuery,
  useCreateRecurringTemplateMutation,
  useUpdateRecurringTemplateMutation,
  usePlaceRecurringTemplateMutation,
  useArchiveQuery,
  useWeeklyCycleReadinessQuery,
  useWeeklyCycleActionMutation,
  useMonthlyInWeekSourceQuery,
  useWeeklyRecurringSourceQuery,
  usePreviousWeeklySourceQuery,
  usePendingDailiesSourceQuery,
  useWeeklyDensityQuery,
  useRitualDecisionMutation,
} from './api'
import type {
  ArchiveEntry,
  BlockingTaskSource,
  CatchUpQueue,
  DensityResponse,
  FutureLogMonthGroup,
  Log,
  MigrationQueue,
  MonthlyLog,
  MonthlyReviewQueue,
  PendingDailiesSource,
  RecurringTaskTemplate,
  TaskSource,
  WeeklyCycleReadiness,
  WeeklyLog,
  WeeklyRecurringSource,
  WeeklyReviewQueue,
} from './types'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>
const mockPatch = client.patch as ReturnType<typeof vi.fn>
const mockDelete = client.delete as ReturnType<typeof vi.fn>

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return {
    qc,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
  }
}

const LOG: Log = {
  id: 'log-1',
  logDate: '2026-07-03',
  tasks: [
    {
      id: 'task-1',
      title: 'Tarefa',
      status: 'pending',
      eisenhower: null,
      category: null,
      subtasks: [],
    },
  ],
}

describe('useTodayLogQuery (AC1)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('busca o Daily Log de hoje com sucesso', async () => {
    mockGet.mockResolvedValueOnce({ data: LOG })
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useTodayLogQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(LOG)
    expect(mockGet).toHaveBeenCalledWith('/api/bujo/logs/today/', { params: undefined })
  })

  it('busca o Daily Log de uma data passada pelo param log_date (Story 11.11)', async () => {
    const PAST_LOG: Log = { ...LOG, logDate: '2026-06-10' }
    mockGet.mockResolvedValueOnce({ data: PAST_LOG })
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useTodayLogQuery('2026-06-10'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(PAST_LOG)
    expect(mockGet).toHaveBeenCalledWith('/api/bujo/logs/today/', {
      params: { log_date: '2026-06-10' },
    })
  })
})

describe('useTransitionTaskMutation (AC2)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('aplica o novo status de forma otimista antes da resposta do servidor', async () => {
    const { qc, wrapper } = makeWrapper()
    qc.setQueryData(keys.bujo.todayLog(), LOG)

    let resolvePost!: (value: { data: unknown }) => void
    mockPost.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePost = resolve
      }),
    )

    const { result } = renderHook(() => useTransitionTaskMutation(), { wrapper })

    result.current.mutate({ taskId: 'task-1', toStatus: 'started' })

    await waitFor(() => expect(result.current.isPending).toBe(true))
    expect(qc.getQueryData<Log>(keys.bujo.todayLog())?.tasks[0].status).toBe('started')

    resolvePost({ data: { ...LOG.tasks[0], status: 'started' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/task-1/transition/', {
      toStatus: 'started',
    })
  })

  it('reverte para o snapshot anterior em caso de erro', async () => {
    const { qc, wrapper } = makeWrapper()
    qc.setQueryData(keys.bujo.todayLog(), LOG)
    mockPost.mockRejectedValueOnce(new Error('falha de rede'))

    const { result } = renderHook(() => useTransitionTaskMutation(), { wrapper })

    result.current.mutate({ taskId: 'task-1', toStatus: 'started' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(qc.getQueryData<Log>(keys.bujo.todayLog())).toEqual(LOG)
  })

  it('com logDate, mira o cache do Daily Log passado (Story 11.11, Task 6.3)', async () => {
    const { qc, wrapper } = makeWrapper()
    const PAST_LOG: Log = { ...LOG, logDate: '2026-06-10' }
    qc.setQueryData(keys.bujo.todayLog('2026-06-10'), PAST_LOG)

    let resolvePost!: (value: { data: unknown }) => void
    mockPost.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePost = resolve
      }),
    )

    const { result } = renderHook(() => useTransitionTaskMutation('2026-06-10'), { wrapper })

    result.current.mutate({ taskId: 'task-1', toStatus: 'started' })

    await waitFor(() => expect(result.current.isPending).toBe(true))
    expect(qc.getQueryData<Log>(keys.bujo.todayLog('2026-06-10'))?.tasks[0].status).toBe('started')
    // Chave de "hoje" não é tocada — mutação mirou só o dia passado.
    expect(qc.getQueryData<Log>(keys.bujo.todayLog())).toBeUndefined()

    resolvePost({ data: { ...PAST_LOG.tasks[0], status: 'started' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('useCreateTaskMutation (AC1)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('adiciona a tarefa otimista na raiz antes da resposta do servidor', async () => {
    const { qc, wrapper } = makeWrapper()
    qc.setQueryData(keys.bujo.todayLog(), LOG)

    let resolvePost!: (value: { data: unknown }) => void
    mockPost.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePost = resolve
      }),
    )

    const { result } = renderHook(() => useCreateTaskMutation(), { wrapper })

    result.current.mutate({ title: 'Nova tarefa' })

    await waitFor(() => expect(result.current.isPending).toBe(true))
    const optimistic = qc.getQueryData<Log>(keys.bujo.todayLog())?.tasks[1]
    expect(optimistic?.title).toBe('Nova tarefa')
    expect(optimistic?.subtasks).toEqual([])

    resolvePost({ data: { ...optimistic, id: 'task-2' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/', { title: 'Nova tarefa' })
  })

  it('reverte para o snapshot anterior em caso de erro', async () => {
    const { qc, wrapper } = makeWrapper()
    qc.setQueryData(keys.bujo.todayLog(), LOG)
    mockPost.mockRejectedValueOnce(new Error('falha de rede'))

    const { result } = renderHook(() => useCreateTaskMutation(), { wrapper })

    result.current.mutate({ title: 'Nova tarefa' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(qc.getQueryData<Log>(keys.bujo.todayLog())).toEqual(LOG)
  })
})

describe('useCreateSubtaskMutation (AC2)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('adiciona a subtarefa otimista sob o pai antes da resposta do servidor', async () => {
    const { qc, wrapper } = makeWrapper()
    qc.setQueryData(keys.bujo.todayLog(), LOG)

    let resolvePost!: (value: { data: unknown }) => void
    mockPost.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePost = resolve
      }),
    )

    const { result } = renderHook(() => useCreateSubtaskMutation(), { wrapper })

    result.current.mutate({ parentTaskId: 'task-1', title: 'Subtarefa' })

    await waitFor(() => expect(result.current.isPending).toBe(true))
    const parent = qc.getQueryData<Log>(keys.bujo.todayLog())?.tasks[0]
    expect(parent?.subtasks?.[0].title).toBe('Subtarefa')

    resolvePost({ data: { ...parent?.subtasks?.[0], id: 'sub-1' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/task-1/subtasks/', {
      title: 'Subtarefa',
    })
  })

  it('reverte para o snapshot anterior em caso de erro', async () => {
    const { qc, wrapper } = makeWrapper()
    qc.setQueryData(keys.bujo.todayLog(), LOG)
    mockPost.mockRejectedValueOnce(new Error('falha de rede'))

    const { result } = renderHook(() => useCreateSubtaskMutation(), { wrapper })

    result.current.mutate({ parentTaskId: 'task-1', title: 'Subtarefa' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(qc.getQueryData<Log>(keys.bujo.todayLog())).toEqual(LOG)
  })
})

describe('useReorderTaskMutation', () => {
  const REORDER_LOG: Log = {
    id: 'log-1',
    logDate: '2026-07-03',
    tasks: [
      { id: 'task-1', title: 'Primeira', status: 'pending', eisenhower: null, category: null, subtasks: [] },
      { id: 'task-2', title: 'Segunda', status: 'pending', eisenhower: null, category: null, subtasks: [] },
    ],
  }

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('aplica a nova ordem de forma otimista antes da resposta do servidor', async () => {
    const { qc, wrapper } = makeWrapper()
    qc.setQueryData(keys.bujo.todayLog(), REORDER_LOG)

    let resolvePost!: (value: { data: unknown }) => void
    mockPost.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePost = resolve
      }),
    )

    const { result } = renderHook(() => useReorderTaskMutation(), { wrapper })

    result.current.mutate({ taskId: 'task-2', targetTaskId: 'task-1', position: 'before' })

    await waitFor(() => expect(result.current.isPending).toBe(true))
    expect(qc.getQueryData<Log>(keys.bujo.todayLog())?.tasks.map((t) => t.id)).toEqual([
      'task-2',
      'task-1',
    ])

    resolvePost({ data: REORDER_LOG.tasks[1] })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/task-2/reorder/', {
      targetTaskId: 'task-1',
      position: 'before',
    })
  })

  it('reverte para o snapshot anterior em caso de erro', async () => {
    const { qc, wrapper } = makeWrapper()
    qc.setQueryData(keys.bujo.todayLog(), REORDER_LOG)
    mockPost.mockRejectedValueOnce(new Error('falha de rede'))

    const { result } = renderHook(() => useReorderTaskMutation(), { wrapper })

    result.current.mutate({ taskId: 'task-2', targetTaskId: 'task-1', position: 'before' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(qc.getQueryData<Log>(keys.bujo.todayLog())).toEqual(REORDER_LOG)
  })

  it('com logDate, mira o cache do Daily Log passado (Story 11.11, Task 6.3)', async () => {
    const { qc, wrapper } = makeWrapper()
    qc.setQueryData(keys.bujo.todayLog('2026-06-10'), REORDER_LOG)

    let resolvePost!: (value: { data: unknown }) => void
    mockPost.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePost = resolve
      }),
    )

    const { result } = renderHook(() => useReorderTaskMutation('2026-06-10'), { wrapper })

    result.current.mutate({ taskId: 'task-2', targetTaskId: 'task-1', position: 'before' })

    await waitFor(() => expect(result.current.isPending).toBe(true))
    expect(qc.getQueryData<Log>(keys.bujo.todayLog('2026-06-10'))?.tasks.map((t) => t.id)).toEqual([
      'task-2',
      'task-1',
    ])

    resolvePost({ data: REORDER_LOG.tasks[1] })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('useUpdateTaskMutation (AC2)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('aplica o patch de forma otimista antes da resposta do servidor', async () => {
    const { qc, wrapper } = makeWrapper()
    qc.setQueryData(keys.bujo.todayLog(), LOG)

    let resolvePatch!: (value: { data: unknown }) => void
    mockPatch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePatch = resolve
      }),
    )

    const { result } = renderHook(() => useUpdateTaskMutation(), { wrapper })

    result.current.mutate({ taskId: 'task-1', description: 'Nova descrição' })

    await waitFor(() => expect(result.current.isPending).toBe(true))
    expect(qc.getQueryData<Log>(keys.bujo.todayLog())?.tasks[0].description).toBe(
      'Nova descrição',
    )

    resolvePatch({ data: { ...LOG.tasks[0], description: 'Nova descrição' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPatch).toHaveBeenCalledWith('/api/bujo/tasks/task-1/', {
      description: 'Nova descrição',
    })
  })

  it('reverte para o snapshot anterior em caso de erro', async () => {
    const { qc, wrapper } = makeWrapper()
    qc.setQueryData(keys.bujo.todayLog(), LOG)
    mockPatch.mockRejectedValueOnce(new Error('falha de rede'))

    const { result } = renderHook(() => useUpdateTaskMutation(), { wrapper })

    result.current.mutate({ taskId: 'task-1', title: 'Título editado' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(qc.getQueryData<Log>(keys.bujo.todayLog())).toEqual(LOG)
  })

  it('com scheduledDate invalida monthlyLog por prefixo (confirmação de item do Future Log)', async () => {
    const { qc, wrapper } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    mockPatch.mockResolvedValueOnce({
      data: { id: 'task-1', title: 'Item do futuro', status: 'pending', subtasks: [] },
    })

    const { result } = renderHook(() => useUpdateTaskMutation(), { wrapper })

    result.current.mutate({ taskId: 'task-1', scheduledDate: '2026-08-05' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPatch).toHaveBeenCalledWith('/api/bujo/tasks/task-1/', {
      scheduledDate: '2026-08-05',
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'monthlyLog'] })
  })

  it('invalida weeklyLog por prefixo no sucesso (edição via TaskDetailPanel em Esta Semana, Story 11.5 AC2)', async () => {
    const { qc, wrapper } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    mockPatch.mockResolvedValueOnce({
      data: { id: 'task-1', title: 'Editada', status: 'pending', subtasks: [] },
    })

    const { result } = renderHook(() => useUpdateTaskMutation(), { wrapper })

    result.current.mutate({ taskId: 'task-1', title: 'Editada' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'weeklyLog'] })
  })

  it('invalida dailyLog por prefixo no sucesso (edição de tarefa de um Daily Log passado, Story 11.11)', async () => {
    const { qc, wrapper } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    qc.setQueryData(keys.bujo.todayLog('2026-06-10'), {
      id: 'log-past',
      logDate: '2026-06-10',
      tasks: [{ id: 'task-1', title: 'Tarefa', status: 'pending', eisenhower: null, category: null, subtasks: [] }],
    })
    mockPatch.mockResolvedValueOnce({
      data: { id: 'task-1', title: 'Editada', status: 'pending', subtasks: [] },
    })

    const { result } = renderHook(() => useUpdateTaskMutation(), { wrapper })

    result.current.mutate({ taskId: 'task-1', title: 'Editada' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'dailyLog'] })
    expect(qc.getQueryState(keys.bujo.todayLog('2026-06-10'))?.isInvalidated).toBe(true)
  })
})

const WEEKLY_LOG: WeeklyLog = {
  status: null,
  planningCompletedAt: null,
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
}

const MONTHLY_LOG: MonthlyLog = {
  status: null,
  planningCompletedAt: null,
  monthFirst: '2026-07-01',
  tasks: [],
  closed: false,
}

const FUTURE_LOG_GROUPS: FutureLogMonthGroup[] = [
  { year: 2026, month: 8, tasks: [] },
]

describe('useWeeklyLogQuery (AC3)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('busca a semana corrente sem parâmetro', async () => {
    mockGet.mockResolvedValueOnce({ data: WEEKLY_LOG })
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useWeeklyLogQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(WEEKLY_LOG)
    expect(mockGet).toHaveBeenCalledWith('/api/bujo/logs/weekly/', { params: undefined })
  })

  it('busca uma semana específica pelo param week_start', async () => {
    mockGet.mockResolvedValueOnce({ data: WEEKLY_LOG })
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useWeeklyLogQuery('2026-07-13'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/api/bujo/logs/weekly/', {
      params: { week_start: '2026-07-13' },
    })
  })
})

describe('useMonthlyLogQuery (AC2)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('busca o mês corrente sem parâmetro', async () => {
    mockGet.mockResolvedValueOnce({ data: MONTHLY_LOG })
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useMonthlyLogQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(MONTHLY_LOG)
    expect(mockGet).toHaveBeenCalledWith('/api/bujo/logs/monthly/', { params: undefined })
  })

  it('busca um mês específico pelo param month_first', async () => {
    mockGet.mockResolvedValueOnce({ data: MONTHLY_LOG })
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useMonthlyLogQuery('2026-07-01'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/api/bujo/logs/monthly/', {
      params: { month_first: '2026-07-01' },
    })
  })

  it('enabled: false NÃO consulta (Story 14.5, Task 8 — "Monthly ampliado" só sob seleção)', async () => {
    const { wrapper } = makeWrapper()

    renderHook(() => useMonthlyLogQuery('2026-07-01', { enabled: false }), { wrapper })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mockGet).not.toHaveBeenCalled()
  })
})

describe('useFutureLogQuery (AC2)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('busca os grupos de meses futuros', async () => {
    mockGet.mockResolvedValueOnce({ data: FUTURE_LOG_GROUPS })
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useFutureLogQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(FUTURE_LOG_GROUPS)
    expect(mockGet).toHaveBeenCalledWith('/api/bujo/future-log/')
  })
})

describe('useCreateMonthlyTaskMutation (AC2)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('invalida monthlyLog e futureLog no sucesso', async () => {
    const { qc, wrapper } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    mockPost.mockResolvedValueOnce({
      data: { id: 'task-1', title: 'Item do futuro', status: 'pending', subtasks: [] },
    })

    const { result } = renderHook(() => useCreateMonthlyTaskMutation(), { wrapper })

    result.current.mutate({ monthFirst: '2026-08-01', title: 'Item do futuro' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/bujo/logs/monthly/', {
      monthFirst: '2026-08-01',
      title: 'Item do futuro',
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: keys.bujo.monthlyLog('2026-08-01') })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: keys.bujo.futureLog() })
  })
})

describe('useCreateWeeklyTaskMutation (Story 11.5, AC1)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('envia o payload correto e invalida weeklyLog + taskDensity no sucesso', async () => {
    const { qc, wrapper } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    mockPost.mockResolvedValueOnce({
      data: { id: 'task-1', title: 'Nova tarefa', status: 'pending', subtasks: [] },
    })

    const { result } = renderHook(() => useCreateWeeklyTaskMutation(), { wrapper })

    result.current.mutate({ weekStart: '2026-07-13', title: 'Nova tarefa', scheduledDate: '2026-07-14' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/bujo/logs/weekly/', {
      weekStart: '2026-07-13',
      title: 'Nova tarefa',
      scheduledDate: '2026-07-14',
    })
    // Por PREFIXO (Story 14.5, Task 12 — gap real): a chave exata
    // `keys.bujo.weeklyLog('2026-07-13')` nunca bate com a view sem
    // navegação explícita, que usa o sentinel 'current' — invalidar por
    // prefixo alcança as duas.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'weeklyLog'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'taskDensity'] })
  })
})

describe('useDeleteTaskMutation (Story 11.5, AC3)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('resposta 204 (hard delete) resolve com null sem quebrar o parse', async () => {
    const { wrapper } = makeWrapper()
    mockDelete.mockResolvedValueOnce({ status: 204, data: null })

    const { result } = renderHook(() => useDeleteTaskMutation(), { wrapper })

    result.current.mutate({ taskId: 'task-1' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockDelete).toHaveBeenCalledWith('/api/bujo/tasks/task-1/')
    expect(result.current.data).toBeNull()
  })

  it('resposta 200 (cancelado) resolve com o corpo da tarefa', async () => {
    const { wrapper } = makeWrapper()
    mockDelete.mockResolvedValueOnce({
      status: 200,
      data: { id: 'task-1', title: 'Tarefa', status: 'cancelled', subtasks: [] },
    })

    const { result } = renderHook(() => useDeleteTaskMutation(), { wrapper })

    result.current.mutate({ taskId: 'task-1' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({
      id: 'task-1',
      title: 'Tarefa',
      status: 'cancelled',
      subtasks: [],
    })
  })

  it('invalida dailyLog (por prefixo), weeklyLog, monthlyLog e taskDensity no sucesso', async () => {
    const { qc, wrapper } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    mockDelete.mockResolvedValueOnce({ status: 204, data: null })

    const { result } = renderHook(() => useDeleteTaskMutation(), { wrapper })

    result.current.mutate({ taskId: 'task-1' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'dailyLog'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'weeklyLog'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'monthlyLog'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'taskDensity'] })
  })

  it('a invalidação por prefixo ["bujo","dailyLog"] alcança um Daily Log passado (Story 11.11)', async () => {
    const { qc, wrapper } = makeWrapper()
    qc.setQueryData(keys.bujo.todayLog('2026-06-10'), { id: 'log-past', logDate: '2026-06-10', tasks: [] })
    mockDelete.mockResolvedValueOnce({ status: 204, data: null })

    const { result } = renderHook(() => useDeleteTaskMutation(), { wrapper })

    result.current.mutate({ taskId: 'task-1' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // `invalidateQueries` marca a query como stale — `undefined` indica que já
    // foi removida do cache antes deste ponto ou que o refetch (sem observers
    // ativos) não a repovoou; aqui só confirmamos que a invalidação por
    // prefixo não lança e que a chave de "hoje" continua intacta (regressão).
    expect(qc.getQueryState(keys.bujo.todayLog('2026-06-10'))?.isInvalidated).toBe(true)
  })
})

const MIGRATION_QUEUE: MigrationQueue = {
  logDate: '2026-07-12',
  tasks: [
    { id: 'task-1', title: 'Pendente de ontem', status: 'pending', eisenhower: null, category: null, subtasks: [] },
  ],
}

describe('useMigrationQueueQuery (AC1)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('busca a fila de migração de ontem', async () => {
    mockGet.mockResolvedValueOnce({ data: MIGRATION_QUEUE })
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useMigrationQueueQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(MIGRATION_QUEUE)
    expect(mockGet).toHaveBeenCalledWith('/api/bujo/migration/queue/')
  })
})

describe('useMigrateTaskMutation (AC3)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('destination=today monta o payload certo e invalida as chaves esperadas', async () => {
    const { qc, wrapper } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    mockPost.mockResolvedValueOnce({
      data: { id: 'task-1', title: 'Pendente de ontem', status: 'migrated', subtasks: [] },
    })

    const { result } = renderHook(() => useMigrateTaskMutation(), { wrapper })

    result.current.mutate({ taskId: 'task-1', destination: 'today' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/task-1/migrate/', {
      destination: 'today',
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: keys.bujo.migrationQueue() })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: keys.bujo.weeklyReviewQueue() })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: keys.bujo.monthlyReviewQueue() })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: keys.bujo.catchUpQueue() })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'dailyLog'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'weeklyLog'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'monthlyLog'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'futureLog'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'taskDensity'] })
  })

  it('a invalidação por prefixo ["bujo","dailyLog"] alcança um Daily Log passado (Story 11.11)', async () => {
    const { qc, wrapper } = makeWrapper()
    qc.setQueryData(keys.bujo.todayLog('2026-06-10'), { id: 'log-past', logDate: '2026-06-10', tasks: [] })
    mockPost.mockResolvedValueOnce({
      data: { id: 'task-1', title: 'Pendente', status: 'migrated', subtasks: [] },
    })

    const { result } = renderHook(() => useMigrateTaskMutation(), { wrapper })

    result.current.mutate({ taskId: 'task-1', destination: 'today' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(qc.getQueryState(keys.bujo.todayLog('2026-06-10'))?.isInvalidated).toBe(true)
  })

  it('destination=week monta o payload certo', async () => {
    const { wrapper } = makeWrapper()
    mockPost.mockResolvedValueOnce({
      data: { id: 'task-1', title: 'Pendente da semana anterior', status: 'migrated', subtasks: [] },
    })

    const { result } = renderHook(() => useMigrateTaskMutation(), { wrapper })

    result.current.mutate({ taskId: 'task-1', destination: 'week' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/task-1/migrate/', {
      destination: 'week',
    })
  })

  it('destination=month monta o payload com scheduledDate', async () => {
    const { wrapper } = makeWrapper()
    mockPost.mockResolvedValueOnce({
      data: { id: 'task-1', title: 'Pendente de ontem', status: 'postponed', subtasks: [] },
    })

    const { result } = renderHook(() => useMigrateTaskMutation(), { wrapper })

    result.current.mutate({ taskId: 'task-1', destination: 'month', scheduledDate: '2026-07-20' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/task-1/migrate/', {
      destination: 'month',
      scheduledDate: '2026-07-20',
    })
  })

  it('destination=future monta o payload com monthFirst e scheduledDate', async () => {
    const { wrapper } = makeWrapper()
    mockPost.mockResolvedValueOnce({
      data: { id: 'task-1', title: 'Pendente de ontem', status: 'postponed', subtasks: [] },
    })

    const { result } = renderHook(() => useMigrateTaskMutation(), { wrapper })

    result.current.mutate({
      taskId: 'task-1',
      destination: 'future',
      monthFirst: '2026-09-01',
      scheduledDate: '2026-09-10',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/task-1/migrate/', {
      destination: 'future',
      monthFirst: '2026-09-01',
      scheduledDate: '2026-09-10',
    })
  })

  it('destination=cancel monta o payload sem campos extras', async () => {
    const { wrapper } = makeWrapper()
    mockPost.mockResolvedValueOnce({
      data: { id: 'task-1', title: 'Pendente de ontem', status: 'cancelled', subtasks: [] },
    })

    const { result } = renderHook(() => useMigrateTaskMutation(), { wrapper })

    result.current.mutate({ taskId: 'task-1', destination: 'cancel' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/task-1/migrate/', {
      destination: 'cancel',
    })
  })
})

const WEEKLY_REVIEW_QUEUE: WeeklyReviewQueue = {
  weekStart: '2026-07-06',
  tasks: [
    { id: 'task-1', title: 'Pendente da semana anterior', status: 'pending', eisenhower: null, category: null, subtasks: [] },
  ],
}

describe('useWeeklyReviewQueueQuery (AC1)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('busca a fila de revisão semanal', async () => {
    mockGet.mockResolvedValueOnce({ data: WEEKLY_REVIEW_QUEUE })
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useWeeklyReviewQueueQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(WEEKLY_REVIEW_QUEUE)
    expect(mockGet).toHaveBeenCalledWith('/api/bujo/weekly-review/queue/')
  })
})

const MONTHLY_REVIEW_QUEUE: MonthlyReviewQueue = {
  monthFirst: '2026-06-01',
  tasks: [
    { id: 'task-2', title: 'Pendente do mês anterior', status: 'pending', eisenhower: null, category: null, subtasks: [] },
  ],
}

describe('useMonthlyReviewQueueQuery (AC2)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('busca a fila de revisão mensal', async () => {
    mockGet.mockResolvedValueOnce({ data: MONTHLY_REVIEW_QUEUE })
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useMonthlyReviewQueueQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(MONTHLY_REVIEW_QUEUE)
    expect(mockGet).toHaveBeenCalledWith('/api/bujo/monthly-review/queue/')
  })
})

const CATCH_UP_QUEUE: CatchUpQueue = {
  monthlyTasks: [
    { id: 'task-3', title: 'Pendente de 3 meses atrás', status: 'pending', eisenhower: null, category: null, subtasks: [] },
  ],
  weeklyTasks: [],
  dailyTasks: [
    { id: 'task-4', title: 'Pendente de 10 dias atrás', status: 'pending', eisenhower: null, category: null, subtasks: [] },
  ],
}

describe('useCatchUpQueueQuery (AC1)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('busca a fila de catch-up', async () => {
    mockGet.mockResolvedValueOnce({ data: CATCH_UP_QUEUE })
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useCatchUpQueueQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(CATCH_UP_QUEUE)
    expect(mockGet).toHaveBeenCalledWith('/api/bujo/catch-up/queue/')
  })
})

const RECURRING_TEMPLATES: RecurringTaskTemplate[] = [
  {
    id: 'tpl-1',
    title: 'Revisão semanal',
    description: null,
    eisenhower: null,
    recurrenceGroup: 'weekly',
    recurrenceText: 'toda sexta',
    active: true,
  },
]

describe('useRecurringTemplatesQuery (AC1, AC2)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('busca todos os templates sem filtro', async () => {
    mockGet.mockResolvedValueOnce({ data: RECURRING_TEMPLATES })
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useRecurringTemplatesQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(RECURRING_TEMPLATES)
    expect(mockGet).toHaveBeenCalledWith('/api/bujo/recurring-templates/', { params: undefined })
  })

  it('busca com filtros active/recurrenceGroup como query params snake_case', async () => {
    mockGet.mockResolvedValueOnce({ data: RECURRING_TEMPLATES })
    const { wrapper } = makeWrapper()

    const { result } = renderHook(
      () => useRecurringTemplatesQuery({ active: true, recurrenceGroup: 'weekly' }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/api/bujo/recurring-templates/', {
      params: { active: true, recurrence_group: 'weekly' },
    })
  })

  it('busca com filtro unplacedYear como query param snake_case (Story 11.4)', async () => {
    mockGet.mockResolvedValueOnce({ data: RECURRING_TEMPLATES })
    const { wrapper } = makeWrapper()

    const { result } = renderHook(
      () => useRecurringTemplatesQuery({ active: true, recurrenceGroup: 'annual', unplacedYear: 2026 }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/api/bujo/recurring-templates/', {
      params: { active: true, recurrence_group: 'annual', unplaced_year: 2026 },
    })
  })
})

describe('useCreateRecurringTemplateMutation (AC1)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('cria o template e invalida a lista por prefixo', async () => {
    const { qc, wrapper } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    mockPost.mockResolvedValueOnce({ data: RECURRING_TEMPLATES[0] })

    const { result } = renderHook(() => useCreateRecurringTemplateMutation(), { wrapper })

    result.current.mutate({
      title: 'Revisão semanal',
      recurrenceGroup: 'weekly',
      recurrenceText: 'toda sexta',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/bujo/recurring-templates/', {
      title: 'Revisão semanal',
      recurrenceGroup: 'weekly',
      recurrenceText: 'toda sexta',
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: keys.bujo.recurringTemplates() })
  })
})

describe('useUpdateRecurringTemplateMutation (AC3)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('edita o template e invalida a lista por prefixo', async () => {
    const { qc, wrapper } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    mockPatch.mockResolvedValueOnce({ data: { ...RECURRING_TEMPLATES[0], active: false } })

    const { result } = renderHook(() => useUpdateRecurringTemplateMutation(), { wrapper })

    result.current.mutate({ templateId: 'tpl-1', active: false })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPatch).toHaveBeenCalledWith('/api/bujo/recurring-templates/tpl-1/', {
      active: false,
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: keys.bujo.recurringTemplates() })
  })
})

describe('usePlaceRecurringTemplateMutation (AC2)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('coloca o template e invalida templates + weeklyLog + monthlyLog + futureLog', async () => {
    const { qc, wrapper } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    mockPost.mockResolvedValueOnce({
      data: { id: 'task-1', title: 'Revisão semanal', status: 'pending', subtasks: [] },
    })

    const { result } = renderHook(() => usePlaceRecurringTemplateMutation(), { wrapper })

    result.current.mutate({ templateId: 'tpl-1', weekStart: '2026-07-13' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/bujo/recurring-templates/tpl-1/place/', {
      weekStart: '2026-07-13',
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: keys.bujo.recurringTemplates() })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'weeklyLog'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'monthlyLog'] })
    // Story 11.4: colocar um anual do Future Log pode cair num mês futuro —
    // sem invalidar futureLog, o grupo novo não aparece sem refresh manual.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: keys.bujo.futureLog() })
  })

  it('a invalidação por prefixo alcança a query com unplacedYear no cache (Story 11.4, Task 3.4)', async () => {
    const { qc, wrapper } = makeWrapper()
    const unplacedYearKey = keys.bujo.recurringTemplates({
      active: true,
      recurrenceGroup: 'annual',
      unplacedYear: 2026,
    })
    qc.setQueryData(unplacedYearKey, [])
    mockPost.mockResolvedValueOnce({
      data: { id: 'task-1', title: 'Revisão anual', status: 'pending', subtasks: [] },
    })

    const { result } = renderHook(() => usePlaceRecurringTemplateMutation(), { wrapper })

    result.current.mutate({ templateId: 'tpl-annual-1', monthFirst: '2026-03-01' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(qc.getQueryState(unplacedYearKey)?.isInvalidated).toBe(true)
  })
})

const ARCHIVE_ENTRIES: ArchiveEntry[] = [
  { type: 'weekly', weekStart: '2026-06-01', monthFirst: null },
  { type: 'monthly', weekStart: null, monthFirst: '2026-05-01' },
]

describe('useArchiveQuery (AC2)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('busca os ciclos fechados', async () => {
    mockGet.mockResolvedValueOnce({ data: ARCHIVE_ENTRIES })
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useArchiveQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(ARCHIVE_ENTRIES)
    expect(mockGet).toHaveBeenCalledWith('/api/bujo/archive/')
  })
})

// =============================================================================
// Épico 14 (Story 14.5) — ciclo, fontes do ritual e densidade real
// =============================================================================

const READINESS: WeeklyCycleReadiness = {
  active: null,
  planning: null,
  start: null,
  finalize: null,
}

describe('useWeeklyCycleReadinessQuery (Story 14.5, AC4)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('busca a prontidão do ciclo sem nenhum param (o alvo é sempre do servidor)', async () => {
    mockGet.mockResolvedValueOnce({ data: READINESS })
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useWeeklyCycleReadinessQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(READINESS)
    expect(mockGet).toHaveBeenCalledWith('/api/bujo/logs/weekly/cycle/')
  })
})

describe('useWeeklyCycleActionMutation (Story 14.5, AC4/AC5)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('posta a ação e invalida os 5 prefixos do ritual (sem otimismo)', async () => {
    const { qc, wrapper } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    mockPost.mockResolvedValueOnce({
      data: { status: 'planning', planningCompletedAt: null, weekStart: '2026-07-27' },
    })

    const { result } = renderHook(() => useWeeklyCycleActionMutation(), { wrapper })
    result.current.mutate({ action: 'open_planning_target', weekStart: '2026-07-27' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/bujo/logs/weekly/cycle/', {
      action: 'open_planning_target',
      weekStart: '2026-07-27',
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'weeklyLog'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: keys.bujo.weeklyCycle() })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'ritualWeeklySource'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'ritualWeeklyDensity'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'taskDensity'] })
  })
})

const MONTHLY_IN_WEEK_SOURCE: TaskSource = {
  sourceId: 'monthly-in-week',
  blocking: false,
  countsTowardProgress: true,
  eligibleCount: 0,
  pendingDecisionCount: 0,
  reviewed: true,
  items: [],
}

describe('useMonthlyInWeekSourceQuery (Story 14.5, AC5)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('busca a fonte com week_start em snake_case e chave escopada por fonte+semana', async () => {
    mockGet.mockResolvedValueOnce({ data: MONTHLY_IN_WEEK_SOURCE })
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useMonthlyInWeekSourceQuery('2026-07-20'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(MONTHLY_IN_WEEK_SOURCE)
    expect(mockGet).toHaveBeenCalledWith('/api/bujo/rituals/weekly/sources/monthly-in-week/', {
      params: { week_start: '2026-07-20' },
    })
  })

  it('enabled: false NÃO consulta (a página do ritual guarda até o weekStart do alvo existir)', async () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useMonthlyInWeekSourceQuery('2026-07-20', { enabled: false }), { wrapper })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mockGet).not.toHaveBeenCalled()
  })
})

const WEEKLY_RECURRING_SOURCE: WeeklyRecurringSource = {
  sourceId: 'recurring',
  blocking: false,
  countsTowardProgress: true,
  eligibleCount: 0,
  pendingDecisionCount: 0,
  reviewed: true,
  items: [],
  alreadyPlaced: { countsTowardProgress: false, items: [] },
}

describe('useWeeklyRecurringSourceQuery (Story 14.5, AC5)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('busca a fonte de recorrentes com week_start em snake_case', async () => {
    mockGet.mockResolvedValueOnce({ data: WEEKLY_RECURRING_SOURCE })
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useWeeklyRecurringSourceQuery('2026-07-20'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(WEEKLY_RECURRING_SOURCE)
    expect(mockGet).toHaveBeenCalledWith('/api/bujo/rituals/weekly/sources/recurring/', {
      params: { week_start: '2026-07-20' },
    })
  })
})

const PREVIOUS_WEEKLY_SOURCE: BlockingTaskSource = {
  sourceId: 'previous-weekly',
  blocking: true,
  countsTowardProgress: true,
  eligibleCount: 0,
  pendingDecisionCount: 0,
  reviewed: true,
  items: [],
  readyToFinalize: true,
  previousPeriodStart: '2026-07-13',
}

describe('usePreviousWeeklySourceQuery (Story 14.5, AC5)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('busca a fonte bloqueante, incluindo previousPeriodStart (AC4)', async () => {
    mockGet.mockResolvedValueOnce({ data: PREVIOUS_WEEKLY_SOURCE })
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => usePreviousWeeklySourceQuery('2026-07-20'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.previousPeriodStart).toBe('2026-07-13')
    expect(mockGet).toHaveBeenCalledWith('/api/bujo/rituals/weekly/sources/previous-weekly/', {
      params: { week_start: '2026-07-20' },
    })
  })
})

const PENDING_DAILIES_SOURCE: PendingDailiesSource = {
  sourceId: 'pending-dailies',
  blocking: false,
  countsTowardProgress: true,
  eligibleCount: 0,
  pendingDecisionCount: 0,
  reviewed: true,
  groups: [],
}

describe('usePendingDailiesSourceQuery (Story 14.5, AC5)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('busca a fonte com groups (não items)', async () => {
    mockGet.mockResolvedValueOnce({ data: PENDING_DAILIES_SOURCE })
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => usePendingDailiesSourceQuery('2026-07-20'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(PENDING_DAILIES_SOURCE)
    expect('items' in (result.current.data ?? {})).toBe(false)
    expect(mockGet).toHaveBeenCalledWith('/api/bujo/rituals/weekly/sources/pending-dailies/', {
      params: { week_start: '2026-07-20' },
    })
  })
})

const WEEKLY_DENSITY: DensityResponse = {
  days: Array.from({ length: 7 }, (_, index) => ({
    date: `2026-07-${20 + index}`,
    total: 0,
    byStatus: {
      pending: 0,
      started: 0,
      completed: 0,
      cancelled: 0,
      migrated: 0,
      postponed: 0,
    },
  })),
  undated: {
    total: 0,
    byStatus: { pending: 0, started: 0, completed: 0, cancelled: 0, migrated: 0, postponed: 0 },
  },
  total: 0,
}

describe('useWeeklyDensityQuery (Story 14.5, AC6)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('busca a densidade real (8 faixas: 7 dias + undated)', async () => {
    mockGet.mockResolvedValueOnce({ data: WEEKLY_DENSITY })
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useWeeklyDensityQuery('2026-07-20'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(WEEKLY_DENSITY)
    expect(mockGet).toHaveBeenCalledWith('/api/bujo/rituals/weekly/density/', {
      params: { week_start: '2026-07-20' },
    })
  })
})

describe('useRitualDecisionMutation (Story 14.5, AC5)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('posta a decisão (corpo em camelCase) e invalida os 5 prefixos do ritual', async () => {
    const { qc, wrapper } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    mockPost.mockResolvedValueOnce({
      data: {
        id: 'decision-1',
        decision: 'keep',
        weekStart: '2026-07-20',
        monthFirst: null,
        taskId: 'task-1',
        recurringTemplateId: null,
        createdAt: '2026-07-18T12:00:00Z',
        updatedAt: '2026-07-18T12:00:00Z',
      },
    })

    const { result } = renderHook(() => useRitualDecisionMutation(), { wrapper })
    result.current.mutate({ decision: 'keep', weekStart: '2026-07-20', taskId: 'task-1' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/bujo/ritual-decisions/', {
      decision: 'keep',
      weekStart: '2026-07-20',
      taskId: 'task-1',
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'weeklyLog'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: keys.bujo.weeklyCycle() })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'ritualWeeklySource'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'ritualWeeklyDensity'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'taskDensity'] })
  })

  it('falha preserva o item (a mutação não muda cache nenhum otimisticamente)', async () => {
    const { qc, wrapper } = makeWrapper()
    mockPost.mockRejectedValueOnce(new Error('409'))

    const { result } = renderHook(() => useRitualDecisionMutation(), { wrapper })
    result.current.mutate({ decision: 'keep', weekStart: '2026-07-20', taskId: 'task-1' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    // Sem otimismo: nenhuma entrada de cache foi escrita para esta mutação.
    expect(qc.getQueryData(keys.bujo.ritualWeeklySource('monthly-in-week', '2026-07-20'))).toBeUndefined()
  })
})
