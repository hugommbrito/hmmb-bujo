// ─────────────────────────────────────────────────────────────────────────────
// Rail de contexto do ritual de migração (Story 14.9, M10) — adaptação do
// rail de contexto do Weekly/Monthly (`WeeklyContextRail.tsx`): SEM
// calendário-alvo (a migração não tem um destino único, ver mockup
// `key-migracao.html`), com progresso (decidido/total, snapshot que só
// cresce — mesma mecânica de `WeeklyContextRail`), o que foi decidido NESTA
// visita (tally em memória — Design Notes da spec: vida da MONTAGEM, não
// histórico) e restantes por fonte.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { Box } from '@mui/material'

import { typography } from '../../../../shared/design/tokens'
import { MIGRATION_SOURCE_LABEL, MIGRATION_SOURCE_ORDER, type MigrationSourceId } from './migrationRitualSources'

export interface MigrationProgressSourceInput {
  sourceId: MigrationSourceId
  /** Pendentes AGORA nesta fonte (a fila só lista pendentes — todo item
   * presente É elegível E pendente ao mesmo tempo, ao contrário do
   * Weekly/Monthly, que têm `decision` persistida). */
  pendingNow: number
}

export interface MigrationTally {
  migrated: number
  postponed: number
  cancelled: number
}

export interface MigrationContextRailProps {
  progressSources: MigrationProgressSourceInput[]
  tally: MigrationTally
  onNavigateToSource: (sourceId: MigrationSourceId) => void
  onPause: () => void
}

export function MigrationContextRail({ progressSources, tally, onNavigateToSource, onPause }: MigrationContextRailProps) {
  // Snapshot da visita (mesma ratchet de `WeeklyContextRail`): cresce quando um
  // item NOVO aparece numa fonte — nunca retrocede. Sem isto, decidir um item
  // faria o DENOMINADOR encolher junto com o numerador (a fila só lista
  // pendentes), e "3 de 8 revisadas" nunca apareceria — só "0 de 5", "0 de 4"...
  const [snapshot, setSnapshot] = useState<Record<string, number>>({})

  const nextSnapshot = { ...snapshot }
  let snapshotChanged = false
  for (const source of progressSources) {
    const current = nextSnapshot[source.sourceId] ?? 0
    if (source.pendingNow > current) {
      nextSnapshot[source.sourceId] = source.pendingNow
      snapshotChanged = true
    }
  }
  if (snapshotChanged) {
    // Derivação idempotente do render atual — mesmo padrão de `WeeklyContextRail`.
    setSnapshot(nextSnapshot)
  }

  const totalSnapshot = progressSources.reduce((sum, s) => sum + (nextSnapshot[s.sourceId] ?? 0), 0)
  const totalPending = progressSources.reduce((sum, s) => sum + s.pendingNow, 0)
  const decidedCount = totalSnapshot - totalPending
  const reviewedCount = progressSources.filter((s) => s.pendingNow === 0).length

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-4)' }}>
      <Box component="section" aria-label="Progresso">
        <Box sx={{ ...typography['section-title'], color: 'var(--ds-ink)' }}>Progresso</Box>
        <Box
          role="progressbar"
          aria-label="Fontes revisadas"
          aria-valuenow={reviewedCount}
          aria-valuemin={0}
          aria-valuemax={MIGRATION_SOURCE_ORDER.length}
          aria-valuetext={`${reviewedCount} de ${MIGRATION_SOURCE_ORDER.length} fontes revisadas`}
          sx={{ ...typography.body, color: 'var(--ds-ink)' }}
        >
          Fontes revisadas: {reviewedCount}/{MIGRATION_SOURCE_ORDER.length}
        </Box>
        <Box
          role="progressbar"
          aria-label="Itens decididos"
          aria-valuenow={decidedCount}
          aria-valuemin={0}
          aria-valuemax={totalSnapshot}
          aria-valuetext={`${decidedCount} de ${totalSnapshot} itens decididos`}
          sx={{ ...typography.body, color: 'var(--ds-ink)' }}
        >
          Itens decididos: {decidedCount}/{totalSnapshot}
        </Box>
      </Box>

      <Box component="section" aria-label="Decidido até agora">
        <Box sx={{ ...typography['section-title'], color: 'var(--ds-ink)' }}>Decidido até agora</Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--ds-space-2)' }}>
          <TallyCell value={tally.migrated} label="migradas" color="var(--ds-primary)" />
          <TallyCell value={tally.postponed} label="adiadas" color="var(--ds-warning)" />
          <TallyCell value={tally.cancelled} label="canceladas" color="var(--ds-ink)" />
        </Box>
      </Box>

      <Box component="section" aria-label="Por fonte">
        <Box sx={{ ...typography['section-title'], color: 'var(--ds-ink)' }}>Por fonte</Box>
        <Box component="ul" sx={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {progressSources.map((source) => (
            <Box
              component="li"
              key={source.sourceId}
              sx={{ display: 'flex', justifyContent: 'space-between', ...typography.body, padding: 'var(--ds-space-1) 0', borderBottom: '1px solid var(--ds-border)' }}
            >
              <Box
                component="button"
                type="button"
                onClick={() => onNavigateToSource(source.sourceId)}
                sx={{ ...typography.body, textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ds-ink)' }}
              >
                {MIGRATION_SOURCE_LABEL[source.sourceId]}
              </Box>
              <Box component="span" sx={{ color: source.pendingNow === 0 ? 'var(--ds-success)' : 'var(--ds-ink-muted)' }}>
                {source.pendingNow}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      <Box component="section" aria-label="Ações do ritual" sx={{ mt: 'auto' }}>
        <Box
          component="button"
          type="button"
          onClick={onPause}
          sx={{
            ...typography.label,
            width: '100%',
            minHeight: 'var(--ds-touch-target-min)',
            border: '1px solid var(--ds-control-border)',
            background: 'var(--ds-surface)',
            color: 'var(--ds-ink)',
            borderRadius: 'var(--ds-radius-sm)',
            padding: 'var(--ds-space-2)',
            cursor: 'pointer',
          }}
        >
          Pausar e sair
        </Box>
        <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)', mt: 'var(--ds-space-1)' }}>
          Retoma com os itens ainda pendentes. Ao decidir tudo, você vê o resumo e volta ao Hoje.
        </Box>
      </Box>
    </Box>
  )
}

function TallyCell({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <Box sx={{ border: '1px solid var(--ds-border)', borderRadius: 'var(--ds-radius-sm)', background: 'var(--ds-surface)', padding: 'var(--ds-space-2)', textAlign: 'center' }}>
      <Box sx={{ ...typography['section-title'], color, fontVariantNumeric: 'tabular-nums' }}>{value}</Box>
      <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>{label}</Box>
    </Box>
  )
}
