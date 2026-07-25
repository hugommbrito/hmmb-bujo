import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useKeyboardShortcuts } from './useKeyboardShortcuts'

function dispatchKeyDown(
  key: string,
  options: { ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; target?: EventTarget } = {},
) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, ...options })
  ;(options.target ?? window).dispatchEvent(event)
}

describe('useKeyboardShortcuts — guard compartilhado (Story 14.5, Task 9)', () => {
  it('chama o handler da tecla pressionada', () => {
    const onOne = vi.fn()
    renderHook(() => useKeyboardShortcuts({ '1': onOne }))
    dispatchKeyDown('1')
    expect(onOne).toHaveBeenCalledTimes(1)
  })

  it('ignora teclas sem handler registrado', () => {
    const onOne = vi.fn()
    renderHook(() => useKeyboardShortcuts({ '1': onOne }))
    dispatchKeyDown('9')
    expect(onOne).not.toHaveBeenCalled()
  })

  it('guard de campo editável: INPUT em foco ignora o atalho', () => {
    const onOne = vi.fn()
    renderHook(() => useKeyboardShortcuts({ '1': onOne }))
    const input = document.createElement('input')
    document.body.appendChild(input)
    dispatchKeyDown('1', { target: input })
    expect(onOne).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('caso irmão: fora de um campo editável, o mesmo atalho dispara', () => {
    const onOne = vi.fn()
    renderHook(() => useKeyboardShortcuts({ '1': onOne }))
    const div = document.createElement('div')
    document.body.appendChild(div)
    dispatchKeyDown('1', { target: div })
    expect(onOne).toHaveBeenCalledTimes(1)
    document.body.removeChild(div)
  })

  it('guard de modificador: Ctrl/Cmd/Alt + tecla ignora o atalho', () => {
    const onOne = vi.fn()
    renderHook(() => useKeyboardShortcuts({ '1': onOne }))
    dispatchKeyDown('1', { ctrlKey: true })
    dispatchKeyDown('1', { metaKey: true })
    dispatchKeyDown('1', { altKey: true })
    expect(onOne).not.toHaveBeenCalled()
  })

  it('enabled: false desativa o listener inteiro', () => {
    const onOne = vi.fn()
    renderHook(() => useKeyboardShortcuts({ '1': onOne }, { enabled: false }))
    dispatchKeyDown('1')
    expect(onOne).not.toHaveBeenCalled()
  })

  it('remove o listener ao desmontar', () => {
    const onOne = vi.fn()
    const { unmount } = renderHook(() => useKeyboardShortcuts({ '1': onOne }))
    unmount()
    dispatchKeyDown('1')
    expect(onOne).not.toHaveBeenCalled()
  })
})
