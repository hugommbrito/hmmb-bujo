// ─────────────────────────────────────────────────────────────────────────────
// Guard de atalho de teclado COMPARTILHADO (Story 14.5, Task 9) — extrai a
// 5ª cópia do mesmo guard já provado em `ShellLayout.tsx` (:108-129),
// `AppLayout.tsx`, `MigrationFlow.tsx` e `DailyPage.tsx`: ignora o atalho
// quando o foco está em campo editável (INPUT/TEXTAREA/contentEditable) OU
// quando um modificador (ctrl/meta/alt) está pressionado — o molde COMPLETO é
// o de `ShellLayout.tsx`, que já fecha a assimetria do guard incompleto de
// `AppLayout.tsx` (lá só `B` era guardado contra modificador, não `[`).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from 'react'

export type KeyboardShortcutHandlers = Record<string, (event: KeyboardEvent) => void>

export interface UseKeyboardShortcutsOptions {
  enabled?: boolean
}

export function useKeyboardShortcuts(
  handlers: KeyboardShortcutHandlers,
  options?: UseKeyboardShortcutsOptions,
) {
  const enabled = options?.enabled ?? true

  useEffect(() => {
    if (!enabled) return undefined

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      const isEditable =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      if (isEditable) return
      if (event.ctrlKey || event.metaKey || event.altKey) return

      const handler = handlers[event.key]
      if (handler) handler(event)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, handlers])
}
