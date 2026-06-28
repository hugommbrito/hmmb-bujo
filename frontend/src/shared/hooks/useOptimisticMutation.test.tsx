import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useOptimisticMutation } from './useOptimisticMutation'

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

const TEST_KEY = ['test', 'item']

describe('useOptimisticMutation (AC2)', () => {
  it('aplica atualização otimista antes da mutação completar', async () => {
    const { qc, wrapper } = makeWrapper()
    qc.setQueryData(TEST_KEY, { count: 0 })

    let resolveMutation!: () => void
    const mutationFn = vi.fn(
      () => new Promise<void>((res) => { resolveMutation = res }),
    )
    const updater = vi.fn(
      (current: { count: number } | undefined) => ({ count: (current?.count ?? 0) + 1 }),
    )

    const { result } = renderHook(
      () => useOptimisticMutation({ mutationFn, queryKey: TEST_KEY, updater }),
      { wrapper },
    )

    result.current.mutate(undefined as unknown as void)

    await waitFor(() => expect(result.current.isPending).toBe(true))
    expect(qc.getQueryData(TEST_KEY)).toEqual({ count: 1 })

    resolveMutation()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('reverte para snapshot em caso de erro', async () => {
    const { qc, wrapper } = makeWrapper()
    qc.setQueryData(TEST_KEY, { count: 5 })

    const mutationFn = vi.fn(() => Promise.reject(new Error('falha')))
    const updater = vi.fn(() => ({ count: 99 }))

    const { result } = renderHook(
      () => useOptimisticMutation({ mutationFn, queryKey: TEST_KEY, updater }),
      { wrapper },
    )

    result.current.mutate(undefined as unknown as void)

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(qc.getQueryData(TEST_KEY)).toEqual({ count: 5 })
  })

  it('invalida queries após settled (sucesso)', async () => {
    const { qc, wrapper } = makeWrapper()
    qc.setQueryData(TEST_KEY, { count: 0 })
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    const mutationFn = vi.fn(() => Promise.resolve())
    const updater = vi.fn((c: { count: number } | undefined) => ({ count: (c?.count ?? 0) + 1 }))

    const { result } = renderHook(
      () => useOptimisticMutation({ mutationFn, queryKey: TEST_KEY, updater }),
      { wrapper },
    )

    result.current.mutate(undefined as unknown as void)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: TEST_KEY })
  })

  it('invalida queries após settled (erro)', async () => {
    const { qc, wrapper } = makeWrapper()
    qc.setQueryData(TEST_KEY, { count: 0 })
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    const mutationFn = vi.fn(() => Promise.reject(new Error('erro')))
    const updater = vi.fn(() => ({ count: 99 }))

    const { result } = renderHook(
      () => useOptimisticMutation({ mutationFn, queryKey: TEST_KEY, updater }),
      { wrapper },
    )

    result.current.mutate(undefined as unknown as void)
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: TEST_KEY })
  })
})
