// ─────────────────────────────────────────────────────────────────────────────
// Rail de contexto do ritual (Story 14.5, AC3/AC5/AC6): densidade real (8
// faixas), totais, progresso derivado (2 dimensões), avisos acionáveis e as
// ações do ciclo (Concluir/Revisar planejamento, Iniciar semana com o painel
// de verificação dos 3 gates, Finalizar semana anterior, Cancelar planejamento).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { Box } from '@mui/material'

import { useWeeklyDensityQuery } from '../../api'
import { formatDayLabel } from '../../../../shared/date'
import { typography } from '../../../../shared/design/tokens'
import type { WeeklyCycleReadiness } from '../../types'
import { WEEKLY_RITUAL_SOURCE_LABEL, type WeeklyRitualSourceId } from './weeklyRitualSources'

export interface WeeklyProgressSourceInput {
  sourceId: WeeklyRitualSourceId
  /** Total de itens elegíveis AGORA (decididos + pendentes) — a fonte de onde
   * o snapshot da visita cresce quando itens novos aparecem. */
  eligibleNow: number
  pendingNow: number
}

export interface WeeklyContextRailProps {
  weekStart: string
  readiness: WeeklyCycleReadiness
  /** As 4 fontes OBRIGATÓRIAS do denominador de progresso — `monthly-expanded`
   * fica sempre FORA (não tem endpoint de contagem e é opcional). */
  progressSources: WeeklyProgressSourceInput[]
  previousWeeklyPendingCount: number
  previousPeriodStart: string | null
  onNavigateToSource: (sourceId: WeeklyRitualSourceId) => void
  onSelectDay: (scheduledDate: string | null) => void
  onCompletePlanning: () => void
  onStart: () => void
  onFinalizePrevious: () => void
  onCancelPlanning: () => void
  canCancelPlanning: boolean
  planningCompletedAt: string | null
}

export function WeeklyContextRail({
  weekStart,
  readiness,
  progressSources,
  previousWeeklyPendingCount,
  previousPeriodStart,
  onNavigateToSource,
  onSelectDay,
  onCompletePlanning,
  onStart,
  onFinalizePrevious,
  onCancelPlanning,
  canCancelPlanning,
  planningCompletedAt,
}: WeeklyContextRailProps) {
  const density = useWeeklyDensityQuery(weekStart)
  const [snapshot, setSnapshot] = useState<Record<string, number>>({})
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false)

  // Snapshot da visita (AC5): cresce quando um item NOVO aparece numa fonte já
  // revisada — nunca retrocede. Roda a cada render (idempotente: `Math.max`
  // não precisa de `useEffect`, é derivação pura de estado anterior).
  const nextSnapshot = { ...snapshot }
  let snapshotChanged = false
  for (const source of progressSources) {
    const current = nextSnapshot[source.sourceId] ?? 0
    if (source.eligibleNow > current) {
      nextSnapshot[source.sourceId] = source.eligibleNow
      snapshotChanged = true
    }
  }
  if (snapshotChanged) {
    // Atualização derivada do render atual — seguro porque é idempotente
    // (mesmo input produz o mesmo novo snapshot) e não causa loop (só cresce).
    setSnapshot(nextSnapshot)
  }

  const totalSnapshot = progressSources.reduce((sum, s) => sum + (nextSnapshot[s.sourceId] ?? 0), 0)
  const totalPending = progressSources.reduce((sum, s) => sum + s.pendingNow, 0)
  const decidedCount = totalSnapshot - totalPending
  const reviewedCount = progressSources.filter((s) => s.pendingNow === 0).length

  const canFinalize = readiness.finalize?.allowed ?? false
  const canStart = readiness.start?.allowed ?? false

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-4)' }}>
      <Box component="section" aria-label="Densidade real">
        <Box sx={{ ...typography['section-title'], color: 'var(--ds-ink)' }}>Densidade real</Box>
        {density.data && (
          <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>{density.data.total} registros</Box>
        )}
        {density.data && (
          <Box role="group" aria-label="Densidade por dia" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
            {density.data.days.map((day) => (
              <Box
                key={day.date}
                component="button"
                type="button"
                onClick={() => onSelectDay(day.date)}
                aria-label={`${formatDayLabel(day.date, 'weekday')}: ${day.total} registros`}
                sx={{
                  ...typography.body,
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: 'var(--ds-ink)',
                }}
              >
                <span>{formatDayLabel(day.date, 'weekday')}</span>
                <span>{day.total}</span>
              </Box>
            ))}
            <Box
              component="button"
              type="button"
              onClick={() => onSelectDay(null)}
              aria-label={`Sem dia definido: ${density.data.undated.total} registros`}
              sx={{
                ...typography.body,
                textAlign: 'left',
                display: 'flex',
                justifyContent: 'space-between',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: 'var(--ds-ink)',
              }}
            >
              <span>Sem dia definido</span>
              <span>{density.data.undated.total}</span>
            </Box>
          </Box>
        )}
      </Box>

      <Box component="section" aria-label="Progresso">
        <Box sx={{ ...typography['section-title'], color: 'var(--ds-ink)' }}>Progresso</Box>
        <Box
          role="progressbar"
          aria-label="Fontes revisadas"
          aria-valuenow={reviewedCount}
          aria-valuemin={0}
          aria-valuemax={4}
          aria-valuetext={`${reviewedCount} de 4 fontes revisadas`}
          sx={{ ...typography.body, color: 'var(--ds-ink)' }}
        >
          Fontes revisadas: {reviewedCount}/4
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

      <Box component="section" aria-label="Avisos">
        <Box sx={{ ...typography['section-title'], color: 'var(--ds-ink)' }}>Avisos</Box>
        {progressSources
          .filter((source) => source.sourceId !== 'previous-weekly' && source.pendingNow > 0)
          .map((source) => (
            <Box
              key={source.sourceId}
              component="button"
              type="button"
              onClick={() => onNavigateToSource(source.sourceId)}
              sx={{
                ...typography.body,
                display: 'flex',
                textAlign: 'left',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: 'var(--ds-warning)',
                // Piso de alvo de toque (achado real do axe na DW-16): sem
                // `minHeight` estes botões ficam abaixo do piso do WCAG 2.5.8 e
                // encostados uns nos outros, reprovando TANTO o tamanho quanto o
                // espaçamento. O token é o do projeto (`--ds-touch-target-min`,
                // o mesmo de `RETRY_BUTTON_SX` e do piso 44×44 da Story 14.5
                // AC7) — não um passo de espaçamento reaproveitado como piso de
                // acessibilidade. `flex` + `alignItems` centram o rótulo na
                // altura nova em vez de deixá-lo colado no topo.
                minHeight: 'var(--ds-touch-target-min)',
                alignItems: 'center',
              }}
            >
              {WEEKLY_RITUAL_SOURCE_LABEL[source.sourceId]}: {source.pendingNow} pendente(s)
            </Box>
          ))}

        {previousWeeklyPendingCount > 0 ? (
          <Box
            role="alert"
            sx={{ ...typography.body, color: 'var(--ds-danger)', display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}
          >
            <Box
              component="button"
              type="button"
              onClick={() => onNavigateToSource('previous-weekly')}
              sx={{
                ...typography.body,
                textAlign: 'left',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: 'var(--ds-danger)',
                // Mesmo piso de alvo de toque dos avisos acima (WCAG 2.5.8).
                display: 'flex',
                alignItems: 'center',
                minHeight: 'var(--ds-touch-target-min)',
              }}
            >
              Weekly anterior: {previousWeeklyPendingCount} pendência(s) — bloqueia iniciar semana
            </Box>
          </Box>
        ) : (
          <Box sx={{ ...typography.body, color: 'var(--ds-success)' }}>Semana anterior pronta para finalizar.</Box>
        )}
      </Box>

      <Box component="section" aria-label="Ações do ciclo" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-2)' }}>
        <Box
          component="button"
          type="button"
          onClick={onCompletePlanning}
          sx={{
            ...typography.label,
            backgroundColor: 'var(--ds-primary)',
            color: 'var(--ds-on-primary)',
            border: 'none',
            borderRadius: 'var(--ds-radius-sm)',
            padding: 'var(--ds-space-2)',
            cursor: 'pointer',
          }}
        >
          {planningCompletedAt ? 'Revisar planejamento' : 'Concluir planejamento'}
        </Box>

        <Box component="section" aria-label="Painel de verificação — Iniciar semana">
          <Box sx={{ ...typography.label, color: 'var(--ds-ink-muted)' }}>Iniciar semana</Box>
          {readiness.start && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
              <GateRow label="Data alcançada" ok={readiness.start.gates.dateReached} />
              <GateRow label="Planejamento concluído" ok={readiness.start.gates.planningCompleted} />
              <GateRow label="Weekly anterior finalizado" ok={readiness.start.gates.previousFinalized} />
            </Box>
          )}
          <Box
            component="button"
            type="button"
            disabled={!canStart}
            aria-disabled={!canStart}
            onClick={onStart}
            sx={{
              ...typography.label,
              backgroundColor: canStart ? 'var(--ds-primary)' : 'var(--ds-surface-subtle)',
              color: canStart ? 'var(--ds-on-primary)' : 'var(--ds-ink-disabled)',
              border: 'none',
              borderRadius: 'var(--ds-radius-sm)',
              padding: 'var(--ds-space-2)',
              cursor: canStart ? 'pointer' : 'not-allowed',
            }}
          >
            Iniciar semana
          </Box>
        </Box>

        {previousWeeklyPendingCount === 0 && previousPeriodStart && (
          <>
            <Box
              component="button"
              type="button"
              disabled={!canFinalize}
              aria-disabled={!canFinalize}
              onClick={() => setFinalizeDialogOpen(true)}
              sx={{
                ...typography.label,
                border: '1px solid var(--ds-danger)',
                color: 'var(--ds-danger)',
                background: 'none',
                borderRadius: 'var(--ds-radius-sm)',
                padding: 'var(--ds-space-2)',
                cursor: canFinalize ? 'pointer' : 'not-allowed',
              }}
            >
              Finalizar semana anterior
            </Box>
            {finalizeDialogOpen && (
              <Box role="alertdialog" aria-label="Finalizar semana anterior — irreversível" sx={{ ...typography.body }}>
                Esta ação é irreversível. Confirmar?
                <Box sx={{ display: 'flex', gap: 'var(--ds-space-2)', mt: 'var(--ds-space-1)' }}>
                  <Box
                    component="button"
                    type="button"
                    onClick={() => {
                      onFinalizePrevious()
                      setFinalizeDialogOpen(false)
                    }}
                  >
                    Confirmar
                  </Box>
                  <Box component="button" type="button" onClick={() => setFinalizeDialogOpen(false)}>
                    Cancelar
                  </Box>
                </Box>
              </Box>
            )}
          </>
        )}

        {canCancelPlanning && (
          <Box
            component="button"
            type="button"
            onClick={onCancelPlanning}
            sx={{ ...typography.body, color: 'var(--ds-ink-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Cancelar planejamento
          </Box>
        )}
      </Box>
    </Box>
  )
}

function GateRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <Box sx={{ ...typography.body, display: 'flex', gap: 'var(--ds-space-1)', color: ok ? 'var(--ds-success)' : 'var(--ds-danger)' }}>
      <span aria-hidden>{ok ? '✓' : '✗'}</span>
      <span>{label}</span>
    </Box>
  )
}
