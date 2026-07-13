import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
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
  useMigrationQueueQuery,
  useMigrateTaskMutation,
} from './api'
import type { FutureLogMonthGroup, Log, MigrationQueue, MonthlyLog, WeeklyLog } from './types'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>
const mockPatch = client.patch as ReturnType<typeof vi.fn>

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
    expect(mockGet).toHaveBeenCalledWith('/api/bujo/logs/today/')
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
})

const WEEKLY_LOG: WeeklyLog = {
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
}

const MONTHLY_LOG: MonthlyLog = {
  monthFirst: '2026-07-01',
  tasks: [],
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

  it('destination=today monta o payload certo e invalida as 4 chaves esperadas', async () => {
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
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: keys.bujo.todayLog() })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'monthlyLog'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'futureLog'] })
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
