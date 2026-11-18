// ─────────────────────────────────────────────────────────────────────────────
// Componentes de formulário compartilhados da superfície de Hábitos (16.1).
// Os estilos/textos vivem em `habitsFormStyles.ts` (módulo sem componentes).
// ─────────────────────────────────────────────────────────────────────────────
import type { ReactNode } from 'react'
import { Box } from '@mui/material'

import { typography } from '../../../../shared/design/tokens'
import { PROSPECTIVE_NOTICE } from './habitsFormStyles'

export interface FieldProps {
  id: string
  label: string
  hint?: string
  children: ReactNode
}

/** Rótulo VISÍVEL + controle (nunca placeholder como rótulo). */
export function Field({ id, label, hint, children }: FieldProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)', minWidth: 0 }}>
      <Box component="label" htmlFor={id} sx={{ ...typography.label, color: 'var(--ds-ink)' }}>
        {label}
        {hint && (
          <Box component="span" sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
            {' '}
            {hint}
          </Box>
        )}
      </Box>
      {children}
    </Box>
  )
}

/** Duas colunas em faixa larga, uma coluna quando não cabe. */
export function FieldPair({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 12rem), 1fr))',
        gap: 'var(--ds-space-3)',
      }}
    >
      {children}
    </Box>
  )
}

/** Aviso persistente dos campos versionados (texto, nunca tooltip). */
export function ProspectiveNotice() {
  return (
    <Box
      data-testid="prospective-notice"
      sx={{
        ...typography.meta,
        color: 'var(--ds-info)',
        backgroundColor: 'var(--ds-info-soft)',
        borderLeft: '3px solid var(--ds-info)',
        padding: 'var(--ds-space-2)',
        borderRadius: 'var(--ds-radius-sm)',
      }}
    >
      {PROSPECTIVE_NOTICE}
    </Box>
  )
}
