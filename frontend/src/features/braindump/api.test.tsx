import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

vi.mock('../auth', () => ({
  useAuth: () => ({
    userId: 'user-1',
    isAuthenticated: true,
    sessionExpired: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}))

import client from '../../api/client'
import { keys } from '../../api/keys'
import {
  useBrainDumpItemsQuery,
  useBrainDumpCountQuery,
  useCreateBrainDumpItemMutation,
  useProcessBrainDumpItemMutation,
  useDiscardBrainDumpItemMutation,
} from './api'
import type { BrainDumpCount, BrainDumpItem } from './types'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>
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

const ITEM: BrainDumpItem = {
  id: 'item-1',
  title: 'Item',
  description: null,
  targetLog: null,
  createdAt: '2026-07-16T10:00:00Z',
}

describe('useBrainDumpItemsQuery', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('busca a lista de itens do Brain Dump', async () => {
    const { wrapper } = makeWrapper()
    mockGet.mockResolvedValueOnce({ data: [ITEM] })

    const { result } = renderHook(() => useBrainDumpItemsQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/api/brain-dump/items/')
    expect(result.current.data).toEqual([ITEM])
  })
})

describe('useBrainDumpCountQuery', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('busca a contagem do Brain Dump com a chave escopada por userId', async () => {
    const { qc, wrapper } = makeWrapper()
    mockGet.mockResolvedValueOnce({ data: { count: 2 } satisfies BrainDumpCount })

    const { result } = renderHook(() => useBrainDumpCountQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/api/brain-dump/count/')
    expect(result.current.data).toEqual({ count: 2 })
    expect(qc.getQueryData(keys.brainDump.count('user-1'))).toEqual({ count: 2 })
  })
})

describe('useCreateBrainDumpItemMutation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('envia o payload correto e invalida brainDump.list e brainDump.count no sucesso', async () => {
    const { qc, wrapper } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    mockPost.mockResolvedValueOnce({ data: ITEM })

    const { result } = renderHook(() => useCreateBrainDumpItemMutation(), { wrapper })

    result.current.mutate({ title: 'Item novo', targetLog: 'week' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/brain-dump/items/', {
      title: 'Item novo',
      targetLog: 'week',
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: keys.brainDump.list() })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: keys.brainDump.count('user-1') })
  })

  it('incrementa a contagem otimisticamente antes da resposta do servidor', async () => {
    const { qc, wrapper } = makeWrapper()
    qc.setQueryData(keys.brainDump.count('user-1'), { count: 1 })
    let resolvePost: (value: { data: BrainDumpItem }) => void = () => {}
    mockPost.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePost = resolve
      })
    )

    const { result } = renderHook(() => useCreateBrainDumpItemMutation(), { wrapper })

    result.current.mutate({ title: 'Item novo' })

    await waitFor(() =>
      expect(qc.getQueryData(keys.brainDump.count('user-1'))).toEqual({ count: 2 })
    )

    resolvePost({ data: ITEM })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('reverte a contagem otimista em caso de erro (rollback)', async () => {
    const { qc, wrapper } = makeWrapper()
    qc.setQueryData(keys.brainDump.count('user-1'), { count: 1 })
    mockPost.mockRejectedValueOnce(new Error('falha de rede'))

    const { result } = renderHook(() => useCreateBrainDumpItemMutation(), { wrapper })

    result.current.mutate({ title: 'Item novo' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(qc.getQueryData(keys.brainDump.count('user-1'))).toEqual({ count: 1 })
  })
})

describe('useProcessBrainDumpItemMutation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('envia o payload correto ao endpoint de processamento', async () => {
    const { wrapper } = makeWrapper()
    mockPost.mockResolvedValueOnce({
      data: { id: 'task-1', title: 'Item', status: 'pending', subtasks: [] },
    })

    const { result } = renderHook(() => useProcessBrainDumpItemMutation(), { wrapper })

    result.current.mutate({ itemId: 'item-1', destination: 'today' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/brain-dump/items/item-1/process/', {
      destination: 'today',
    })
  })

  it('invalida brainDump.list, brainDump.count, dailyLog, weeklyLog, monthlyLog e taskDensity no sucesso', async () => {
    const { qc, wrapper } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    mockPost.mockResolvedValueOnce({
      data: { id: 'task-1', title: 'Item', status: 'pending', subtasks: [] },
    })

    const { result } = renderHook(() => useProcessBrainDumpItemMutation(), { wrapper })

    result.current.mutate({ itemId: 'item-1', destination: 'today' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: keys.brainDump.list() })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: keys.brainDump.count('user-1') })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'dailyLog'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'weeklyLog'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'monthlyLog'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bujo', 'taskDensity'] })
  })
})

describe('useDiscardBrainDumpItemMutation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('chama o DELETE correto e invalida brainDump.list e brainDump.count no sucesso', async () => {
    const { qc, wrapper } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    mockDelete.mockResolvedValueOnce({ status: 204, data: undefined })

    const { result } = renderHook(() => useDiscardBrainDumpItemMutation(), { wrapper })

    result.current.mutate({ itemId: 'item-1' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockDelete).toHaveBeenCalledWith('/api/brain-dump/items/item-1/')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: keys.brainDump.list() })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: keys.brainDump.count('user-1') })
  })
})
