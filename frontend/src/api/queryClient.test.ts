import { describe, it, expect } from 'vitest'
import { queryClient } from './queryClient'

describe('queryClient (AC2)', () => {
  const defaults = queryClient.getDefaultOptions()

  it('refetchOnWindowFocus está habilitado', () => {
    expect(defaults.queries?.refetchOnWindowFocus).toBe(true)
  })

  it('staleTime é 0 (dados sempre stale)', () => {
    expect(defaults.queries?.staleTime).toBe(0)
  })

  it('retry é 1 (uma tentativa extra em falha)', () => {
    expect(defaults.queries?.retry).toBe(1)
  })
})
