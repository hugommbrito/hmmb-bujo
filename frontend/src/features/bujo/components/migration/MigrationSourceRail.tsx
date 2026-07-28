// ─────────────────────────────────────────────────────────────────────────────
// Rail de fontes do ritual de migração (Story 14.9, M10) — molde de
// `WeeklySourceRail.tsx`, mas as 3 "fontes" são NÍVEIS (Meses/Semanas/Dias) da
// MESMA fila unificada, não endpoints independentes. Por isso não há
// `isLoading`/`isError` por entrada como no Weekly (uma leitura só, `isError`
// é um único booleano compartilhado pelas 3 — ver Dev Notes/relatório final).
// ─────────────────────────────────────────────────────────────────────────────
import { Box } from '@mui/material'

import { typography } from '../../../../shared/design/tokens'
import { MIGRATION_SOURCE_ORDER, MIGRATION_SOURCE_LABEL, MIGRATION_SOURCE_SUBTITLE, type MigrationSourceId } from './migrationRitualSources'

export interface MigrationSourceRailEntry {
  sourceId: MigrationSourceId
  count: number
}

export interface MigrationSourceRailProps {
  entries: MigrationSourceRailEntry[]
  activeSourceId: MigrationSourceId
  onSelect: (sourceId: MigrationSourceId) => void
  /** Único dado de leitura (`unified_migration_queue`) — uma falha afeta as 3
   * entradas igualmente; cada uma ainda oferece "erro"/retry PRÓPRIO
   * (chamando o mesmo refetch), preservando o padrão "erro/retry local por
   * fonte" do rail, mesmo com uma única leitura por trás das 3. */
  isError?: boolean
}

export function MigrationSourceRail({ entries, activeSourceId, onSelect, isError = false }: MigrationSourceRailProps) {
  const bySourceId = new Map(entries.map((entry) => [entry.sourceId, entry]))

  return (
    <Box component="nav" aria-label="Fontes da migração" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
      {MIGRATION_SOURCE_ORDER.map((sourceId) => {
        const entry = bySourceId.get(sourceId)
        const active = sourceId === activeSourceId
        const reviewed = !isError && (entry?.count ?? 0) === 0
        return (
          <Box
            key={sourceId}
            component="button"
            type="button"
            aria-current={active ? 'true' : undefined}
            onClick={() => onSelect(sourceId)}
            sx={{
              ...typography.body,
              textAlign: 'left',
              padding: 'var(--ds-space-2)',
              border: 'none',
              borderLeft: `var(--ds-task-row-category-border-width) solid ${active ? 'var(--ds-primary)' : 'transparent'}`,
              backgroundColor: active ? 'var(--ds-primary-soft)' : 'transparent',
              color: isError ? 'var(--ds-danger)' : 'var(--ds-ink)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--ds-space-1)',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--ds-space-2)' }}>
              <span>{MIGRATION_SOURCE_LABEL[sourceId]}</span>
              <Box component="span" sx={{ ...typography.meta, color: reviewed ? 'var(--ds-success)' : 'var(--ds-ink-muted)' }}>
                {isError ? 'erro' : reviewed ? '✓ revisado' : entry?.count ?? 0}
              </Box>
            </Box>
            <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
              {reviewed ? '0 restantes' : MIGRATION_SOURCE_SUBTITLE[sourceId]}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
