// ─────────────────────────────────────────────────────────────────────────────
// Resumo factual do ritual de migração (Story 14.9, M10) — mockup, frame D:
// fecha com contagem sóbria, sem celebração/exclamação/emoji, e leva de volta
// ao Hoje. Reflete SÓ a sessão de decisões que terminou (tally em memória da
// página — Design Notes da spec), nunca um total histórico.
// ─────────────────────────────────────────────────────────────────────────────
import { Box } from '@mui/material'

import { typography } from '../../../../shared/design/tokens'
import type { MigrationTally } from './MigrationContextRail'

export interface MigrationSummaryProps {
  tally: MigrationTally
  onBack: () => void
}

export function MigrationSummary({ tally, onBack }: MigrationSummaryProps) {
  const total = tally.migrated + tally.postponed + tally.cancelled

  return (
    <Box sx={{ maxWidth: '460px', margin: 'auto', textAlign: 'center', padding: 'var(--ds-space-6)' }}>
      <Box
        aria-hidden="true"
        sx={{
          width: '56px',
          height: '56px',
          borderRadius: 'var(--ds-radius-full)',
          border: '2px solid var(--ds-success)',
          color: 'var(--ds-success)',
          display: 'grid',
          placeItems: 'center',
          fontSize: '26px',
          margin: '0 auto var(--ds-space-4)',
        }}
      >
        ✓
      </Box>
      <Box component="h2" sx={{ ...typography['page-title'], color: 'var(--ds-ink)', margin: '0 0 4px' }}>
        Migração concluída
      </Box>
      <Box sx={{ ...typography.body, color: 'var(--ds-ink-muted)', mb: 'var(--ds-space-4)' }}>
        {total} {total === 1 ? 'tarefa decidida' : 'tarefas decididas'}. Nada ficou sem lugar.
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--ds-space-2)', mb: 'var(--ds-space-4)' }}>
        <SummaryCell value={tally.migrated} label="migradas" />
        <SummaryCell value={tally.postponed} label="adiadas" />
        <SummaryCell value={tally.cancelled} label="canceladas" />
      </Box>
      <Box
        component="button"
        type="button"
        onClick={onBack}
        sx={{
          ...typography.label,
          minHeight: 'var(--ds-touch-target-min)',
          border: '1px solid var(--ds-primary)',
          backgroundColor: 'var(--ds-primary)',
          color: 'var(--ds-on-primary)',
          borderRadius: 'var(--ds-radius-sm)',
          padding: 'var(--ds-space-2) var(--ds-space-4)',
          cursor: 'pointer',
        }}
      >
        Voltar ao Hoje
      </Box>
    </Box>
  )
}

function SummaryCell({ value, label }: { value: number; label: string }) {
  return (
    <Box sx={{ border: '1px solid var(--ds-border)', borderRadius: 'var(--ds-radius-md)', background: 'var(--ds-surface)', padding: 'var(--ds-space-3) var(--ds-space-2)' }}>
      <Box sx={{ ...typography['page-title'], fontVariantNumeric: 'tabular-nums' }}>{value}</Box>
      <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)', mt: '2px' }}>{label}</Box>
    </Box>
  )
}
