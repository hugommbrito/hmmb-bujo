import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import client from '../../api/client'
import {
  useCreateGratitudeEntryMutation,
  useGratitudeDayQuery,
  useGratitudeMonthQuery,
} from './api'
import { keys } from '../../api/keys'
import type { GratitudeDay, GratitudeMonth } from './types'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>

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

const DAY: GratitudeDay = {
  date: '2026-07-20',
  entries: [
    { id: 'g1', date: '2026-07-20', text: 'Grato pelo café', createdAt: '2026-07-20T09:00:00Z' },
  ],
}

describe('useGratitudeDayQuery', () => {
  beforeEach(() => vi.clearAllMocks())

  it('busca o dia com a data passada', async () => {
    const { wrapper } = makeWrapper()
    mockGet.mockResolvedValueOnce({ data: DAY })
    const { result } = renderHook(() => useGratitudeDayQuery('2026-07-20'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/api/gratitude/days/', {
      params: { date: '2026-07-20' },
    })
    expect(result.current.data).toEqual(DAY)
  })

  it('sem data → params undefined (hoje resolvido no servidor)', async () => {
    const { wrapper } = makeWrapper()
    mockGet.mockResolvedValueOnce({ data: DAY })
    renderHook(() => useGratitudeDayQuery(), { wrapper })
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith('/api/gratitude/days/', { params: undefined }),
    )
  })
})

const MONTH: GratitudeMonth = {
  month: '2026-07-01',
  days: [
    {
      date: '2026-07-20',
      entries: [
        { id: 'g1', date: '2026-07-20', text: 'Grato pelo café', createdAt: '2026-07-20T09:00:00Z' },
      ],
    },
  ],
}

describe('useGratitudeMonthQuery (Story 9.2)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('busca o mês com params {month} e retorna o read-model agrupado por dia', async () => {
    const { wrapper } = makeWrapper()
    mockGet.mockResolvedValueOnce({ data: MONTH })
    const { result } = renderHook(() => useGratitudeMonthQuery('2026-07-01'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/api/gratitude/months/', {
      params: { month: '2026-07-01' },
    })
    expect(result.current.data).toEqual(MONTH)
  })

  it('sem mês → params undefined (mês corrente resolvido no servidor)', async () => {
    const { wrapper } = makeWrapper()
    mockGet.mockResolvedValueOnce({ data: MONTH })
    renderHook(() => useGratitudeMonthQuery(), { wrapper })
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith('/api/gratitude/months/', { params: undefined }),
    )
  })
})

describe('useCreateGratitudeEntryMutation (append otimista — AC7)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('faz POST {text, date} e faz append otimista no cache da chave do dia', async () => {
    const { qc, wrapper } = makeWrapper()
    qc.setQueryData(keys.gratitude.day('2026-07-20'), DAY)
    mockPost.mockResolvedValueOnce({
      data: { id: 'real-1', date: '2026-07-20', text: 'Grato pela corrida', createdAt: '2026-07-20T10:00:00Z' },
    })

    const { result } = renderHook(() => useCreateGratitudeEntryMutation('2026-07-20'), { wrapper })
    result.current.mutate({ text: 'Grato pela corrida', date: '2026-07-20' })

    // Otimismo aplicado no onMutate (antes do await do servidor): 2ª entrada aparece.
    await waitFor(() => {
      const cached = qc.getQueryData<GratitudeDay>(keys.gratitude.day('2026-07-20'))
      expect(cached?.entries).toHaveLength(2)
      expect(cached?.entries[1].text).toBe('Grato pela corrida')
    })
    expect(mockPost).toHaveBeenCalledWith('/api/gratitude/entries/', {
      text: 'Grato pela corrida',
      date: '2026-07-20',
    })
  })

  it('rollback no erro: a entrada otimista some (volta ao snapshot)', async () => {
    const { qc, wrapper } = makeWrapper()
    qc.setQueryData(keys.gratitude.day('2026-07-20'), DAY)
    mockPost.mockRejectedValueOnce(new Error('boom'))

    const { result } = renderHook(() => useCreateGratitudeEntryMutation('2026-07-20'), { wrapper })
    result.current.mutate({ text: 'vai falhar', date: '2026-07-20' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    const cached = qc.getQueryData<GratitudeDay>(keys.gratitude.day('2026-07-20'))
    expect(cached?.entries).toHaveLength(1)
    expect(cached?.entries[0].text).toBe('Grato pelo café')
  })
})
