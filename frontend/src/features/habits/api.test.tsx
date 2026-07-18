import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import client from '../../api/client'
import {
  useAddHabitVersionMutation,
  useCreateHabitGroupMutation,
  useCreateHabitMutation,
  useHabitGroupsQuery,
  useHabitsQuery,
  useUpdateHabitIdentityMutation,
} from './api'
import type { Habit, HabitGroup } from './types'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>
const mockPatch = client.patch as ReturnType<typeof vi.fn>

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return {
    qc,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
  }
}

const HABIT: Habit = {
  id: 'habit-1',
  name: 'Ler',
  emoticon: '📖',
  group: 'group-1',
  type: 'boolean',
  weight: '2.00',
  active: true,
  meta: null,
  bonus: null,
  effectiveFrom: '2026-07-17',
}

const GROUP: HabitGroup = { id: 'group-1', name: 'Saúde', displayOrder: 0 }

describe('useHabitsQuery', () => {
  beforeEach(() => vi.resetAllMocks())

  it('busca hábitos ativos por padrão', async () => {
    const { wrapper } = makeWrapper()
    mockGet.mockResolvedValueOnce({ data: [HABIT] })

    const { result } = renderHook(() => useHabitsQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/api/habits/')
    expect(result.current.data).toEqual([HABIT])
  })

  it('inclui inativos quando includeInactive=true', async () => {
    const { wrapper } = makeWrapper()
    mockGet.mockResolvedValueOnce({ data: [HABIT] })

    const { result } = renderHook(() => useHabitsQuery({ includeInactive: true }), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/api/habits/?includeInactive=true')
  })
})

describe('useHabitGroupsQuery', () => {
  beforeEach(() => vi.resetAllMocks())

  it('busca a lista de grupos', async () => {
    const { wrapper } = makeWrapper()
    mockGet.mockResolvedValueOnce({ data: [GROUP] })

    const { result } = renderHook(() => useHabitGroupsQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/api/habit-groups/')
    expect(result.current.data).toEqual([GROUP])
  })
})

describe('useCreateHabitMutation', () => {
  beforeEach(() => vi.resetAllMocks())

  it('envia o payload e invalida o prefixo habits no sucesso', async () => {
    const { qc, wrapper } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    mockPost.mockResolvedValueOnce({ data: HABIT })

    const { result } = renderHook(() => useCreateHabitMutation(), { wrapper })
    result.current.mutate({ name: 'Ler', group: 'group-1', type: 'boolean', weight: '2' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/habits/', {
      name: 'Ler',
      group: 'group-1',
      type: 'boolean',
      weight: '2',
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['habits'] })
  })
})

describe('useUpdateHabitIdentityMutation', () => {
  beforeEach(() => vi.resetAllMocks())

  it('faz PATCH da identidade e invalida habits', async () => {
    const { qc, wrapper } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    mockPatch.mockResolvedValueOnce({ data: { ...HABIT, name: 'Novo' } })

    const { result } = renderHook(() => useUpdateHabitIdentityMutation(), { wrapper })
    result.current.mutate({ habitId: 'habit-1', name: 'Novo' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPatch).toHaveBeenCalledWith('/api/habits/habit-1/', { name: 'Novo' })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['habits'] })
  })
})

describe('useAddHabitVersionMutation', () => {
  beforeEach(() => vi.resetAllMocks())

  it('faz POST da nova versão e invalida habits', async () => {
    const { qc, wrapper } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    mockPost.mockResolvedValueOnce({
      data: { id: 'v2', habit: 'habit-1', weight: '5', active: true, meta: null, bonus: null, effectiveFrom: '2026-07-17' },
    })

    const { result } = renderHook(() => useAddHabitVersionMutation(), { wrapper })
    result.current.mutate({ habitId: 'habit-1', weight: '5' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/habits/habit-1/versions/', { weight: '5' })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['habits'] })
  })

  it('faz POST de active:false para desativar', async () => {
    const { wrapper } = makeWrapper()
    mockPost.mockResolvedValueOnce({
      data: { id: 'v2', habit: 'habit-1', weight: '2', active: false, meta: null, bonus: null, effectiveFrom: '2026-07-17' },
    })

    const { result } = renderHook(() => useAddHabitVersionMutation(), { wrapper })
    result.current.mutate({ habitId: 'habit-1', active: false })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/habits/habit-1/versions/', { active: false })
  })
})

describe('useCreateHabitGroupMutation', () => {
  beforeEach(() => vi.resetAllMocks())

  it('faz POST do grupo e invalida habits', async () => {
    const { qc, wrapper } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    mockPost.mockResolvedValueOnce({ data: GROUP })

    const { result } = renderHook(() => useCreateHabitGroupMutation(), { wrapper })
    result.current.mutate({ name: 'Saúde' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/habit-groups/', { name: 'Saúde' })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['habits'] })
  })
})
