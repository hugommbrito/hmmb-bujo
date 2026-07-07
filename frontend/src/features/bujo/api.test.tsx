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
} from './api'
import type { Log } from './types'

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
