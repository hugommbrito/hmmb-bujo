import { describe, it, expect, afterEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useOnlineStatus } from './useOnlineStatus'

function setNavigatorOnLine(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  })
}

describe('useOnlineStatus', () => {
  afterEach(() => {
    // Restaura o default de jsdom (online) para não vazar estado entre testes.
    setNavigatorOnLine(true)
    vi.restoreAllMocks()
  })

  it('estado inicial reflete navigator.onLine', () => {
    setNavigatorOnLine(true)
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)
  })

  it('evento offline muda o estado para false', () => {
    setNavigatorOnLine(true)
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current).toBe(false)
  })

  it('evento online volta o estado para true', () => {
    setNavigatorOnLine(false)
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(false)

    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current).toBe(true)
  })
})
