// ─────────────────────────────────────────────────────────────────────────────
// Estilos e textos compartilhados dos formulários de Hábitos (Story 16.1).
//
// Módulo SEM componentes (só dados) — separar é o que mantém o Fast Refresh
// válido no arquivo de componentes (`HabitsFormControls.tsx`).
//
//   ▶ `<input>`/`<select>` NATIVOS com `style` — mesmo precedente de
//     `ArchivePage.tsx`. O `TextField`/`Select` do MUI traria a paleta do tema
//     LEGADO (o `primary` teal reprova AA sobre `--ds-surface`), e esta
//     superfície é 100% `var(--ds-*)`.
//
//   ▶ Campos numéricos são `type="text" inputMode="decimal"`, não
//     `type="number"`: o contrato pede parser que aceite **vírgula e ponto**
//     (I/O Matrix), e `type="number"` recusa vírgula no locale pt-BR.
// ─────────────────────────────────────────────────────────────────────────────
import type { CSSProperties } from 'react'

import { typography } from '../../../../shared/design/tokens'

export const CONTROL_STYLE: CSSProperties = {
  ...typography.body,
  width: '100%',
  minHeight: 'var(--ds-touch-target-min)',
  paddingLeft: 'var(--ds-space-2)',
  paddingRight: 'var(--ds-space-2)',
  borderRadius: 'var(--ds-radius-md)',
  border: '1px solid var(--ds-control-border)',
  background: 'var(--ds-surface)',
  color: 'var(--ds-ink)',
}

export const DISABLED_CONTROL_STYLE: CSSProperties = {
  ...CONTROL_STYLE,
  background: 'var(--ds-surface-subtle)',
  color: 'var(--ds-ink-muted)',
}

export function controlStyle(disabled?: boolean): CSSProperties {
  return disabled ? DISABLED_CONTROL_STYLE : CONTROL_STYLE
}

export const PRIMARY_BUTTON_SX = {
  minHeight: 'var(--ds-touch-target-min)',
  backgroundColor: 'var(--ds-primary)',
  color: 'var(--ds-on-primary)',
  '&:hover': { backgroundColor: 'var(--ds-primary-hover)' },
  '&.Mui-disabled': {
    backgroundColor: 'var(--ds-surface-subtle)',
    color: 'var(--ds-ink-muted)',
  },
} as const

export const SECONDARY_BUTTON_SX = {
  ...typography.label,
  minHeight: 'var(--ds-touch-target-min)',
  color: 'var(--ds-ink)',
  border: '1px solid var(--ds-control-border)',
  '&.Mui-disabled': { color: 'var(--ds-ink-muted)', borderColor: 'var(--ds-border)' },
} as const

/**
 * Aviso PERSISTENTE dos campos versionados — texto fixo sob os campos, nunca
 * tooltip (tooltip não sobrevive a teclado nem a toque).
 */
export const PROSPECTIVE_NOTICE =
  'Alteração válida a partir de hoje. Registros anteriores preservados.'

