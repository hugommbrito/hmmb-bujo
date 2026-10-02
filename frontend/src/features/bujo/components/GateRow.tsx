// ─────────────────────────────────────────────────────────────────────────────
// Linha de gate dos painéis de verificação (✓/✗ + rótulo + motivo).
//
// Story 14.11: EXTRAÍDA das duas cópias idênticas que viviam em
// `weekly/WeeklyContextRail.tsx` e `monthly/MonthlyContextRail.tsx`, e ganha
// `reason` — o motivo curto que acompanha um ✗ ("subtarefas incluídas", "abra
// o planejamento do mês seguinte"), no mesmo espírito do `detail` que o
// servidor devolve no 409 do gate. Zero literal estrutural/cromático: tudo
// `var(--ds-*)`.
// ─────────────────────────────────────────────────────────────────────────────
import { Box } from '@mui/material'

import { typography } from '../../../shared/design/tokens'

export interface GateRowProps {
  label: string
  ok: boolean
  /** Exibido só quando `ok === false` — o motivo do ✗. */
  reason?: string
}

export function GateRow({ label, ok, reason }: GateRowProps) {
  return (
    <Box
      sx={{
        ...typography.body,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--ds-space-1)',
        color: ok ? 'var(--ds-success)' : 'var(--ds-danger)',
      }}
    >
      <Box component="span" sx={{ display: 'flex', gap: 'var(--ds-space-1)' }}>
        <span aria-hidden>{ok ? '✓' : '✗'}</span>
        <span>{label}</span>
      </Box>
      {!ok && reason && (
        <Box component="span" sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
          {reason}
        </Box>
      )}
    </Box>
  )
}
