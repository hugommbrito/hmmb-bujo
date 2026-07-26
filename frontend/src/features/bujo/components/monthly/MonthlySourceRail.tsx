// ─────────────────────────────────────────────────────────────────────────────
// Rail de fontes do ritual mensal (Story 14.6, AC5) — molde direto de
// `WeeklySourceRail`: `<nav aria-label="Fontes do planejamento mensal">` com as
// 3 fontes na ordem fixa. Diferente do Weekly, as 3 fontes SEMPRE têm contagem
// própria (nenhuma "opcional sem número" como `monthly-expanded`).
// ─────────────────────────────────────────────────────────────────────────────
import { Box } from '@mui/material'

import {
  MONTHLY_RITUAL_SOURCE_LABEL,
  MONTHLY_RITUAL_SOURCE_ORDER,
  type MonthlyRitualSourceId,
} from './monthlyRitualSources'
import { typography } from '../../../../shared/design/tokens'

export interface MonthlySourceRailEntry {
  sourceId: MonthlyRitualSourceId
  pendingCount: number
  subtitle?: string
  isLoading: boolean
  isError: boolean
}

export interface MonthlySourceRailProps {
  entries: MonthlySourceRailEntry[]
  activeSourceId: MonthlyRitualSourceId
  onSelect: (sourceId: MonthlyRitualSourceId) => void
}

export function MonthlySourceRail({ entries, activeSourceId, onSelect }: MonthlySourceRailProps) {
  const bySourceId = new Map(entries.map((entry) => [entry.sourceId, entry]))

  return (
    <Box component="nav" aria-label="Fontes do planejamento mensal" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
      {MONTHLY_RITUAL_SOURCE_ORDER.map((sourceId) => {
        const entry = bySourceId.get(sourceId)
        const active = sourceId === activeSourceId
        return (
          <Box
            key={sourceId}
            component="button"
            type="button"
            aria-current={active ? 'true' : undefined}
            aria-busy={entry?.isLoading ? 'true' : undefined}
            onClick={() => onSelect(sourceId)}
            sx={{
              ...typography.body,
              textAlign: 'left',
              padding: 'var(--ds-space-2)',
              border: 'none',
              borderLeft: `var(--ds-task-row-category-border-width) solid ${active ? 'var(--ds-primary)' : 'transparent'}`,
              backgroundColor: active ? 'var(--ds-primary-soft)' : 'transparent',
              color: entry?.isError ? 'var(--ds-danger)' : 'var(--ds-ink)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--ds-space-1)',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--ds-space-2)' }}>
              <span>{MONTHLY_RITUAL_SOURCE_LABEL[sourceId]}</span>
              <Box component="span" sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
                {entry?.isError ? 'erro' : (entry?.pendingCount ?? 0)}
              </Box>
            </Box>
            {entry?.subtitle && (
              <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>{entry.subtitle}</Box>
            )}
          </Box>
        )
      })}
    </Box>
  )
}
