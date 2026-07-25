// ─────────────────────────────────────────────────────────────────────────────
// Rail de fontes do ritual (Story 14.5, AC5): `<nav aria-label="Fontes do
// planejamento">` com as 5 fontes na ordem fixa. Cada fonte carrega/falha
// independentemente — o rail só reflete o estado (`aria-busy`/erro), nunca
// desabilita as outras.
// ─────────────────────────────────────────────────────────────────────────────
import { Box } from '@mui/material'

import { WEEKLY_RITUAL_SOURCE_LABEL, WEEKLY_RITUAL_SOURCE_ORDER, type WeeklyRitualSourceId } from './weeklyRitualSources'
import { typography } from '../../../../shared/design/tokens'

export interface WeeklySourceRailEntry {
  sourceId: WeeklyRitualSourceId
  /** `null` = "Monthly ampliado": opcional, sem número (fora do denominador,
   * sem endpoint de contagem). */
  pendingCount: number | null
  subtitle?: string
  isLoading: boolean
  isError: boolean
}

export interface WeeklySourceRailProps {
  entries: WeeklySourceRailEntry[]
  activeSourceId: WeeklyRitualSourceId
  onSelect: (sourceId: WeeklyRitualSourceId) => void
}

export function WeeklySourceRail({ entries, activeSourceId, onSelect }: WeeklySourceRailProps) {
  const bySourceId = new Map(entries.map((entry) => [entry.sourceId, entry]))

  return (
    <Box component="nav" aria-label="Fontes do planejamento" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
      {WEEKLY_RITUAL_SOURCE_ORDER.map((sourceId) => {
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
              <span>{WEEKLY_RITUAL_SOURCE_LABEL[sourceId]}</span>
              {sourceId === 'monthly-expanded' ? (
                <Box component="span" sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
                  opcional
                </Box>
              ) : (
                entry && (
                  <Box component="span" sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
                    {entry.isError ? 'erro' : entry.pendingCount}
                  </Box>
                )
              )}
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
