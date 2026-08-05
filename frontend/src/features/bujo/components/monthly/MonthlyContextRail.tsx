// ─────────────────────────────────────────────────────────────────────────────
// Rail de contexto do ritual mensal (Story 14.6, AC3/AC5/AC6) — minicalendário
// COMPLETO do mês (não 8 faixas lineares como o Weekly), totais, progresso
// derivado sobre as 3 fontes (denominador diferente do Weekly, que usa 4),
// avisos acionáveis e as ações do ciclo (Concluir/Revisar planejamento,
// Iniciar mês com o painel de verificação dos 3 gates, Finalizar mês
// anterior). **Sem "Cancelar planejamento"** — divergência deliberada do
// Weekly (M07, AC3): o alvo mensal é sempre sequencial e determinístico.
//
//   ▶ Segmentação por status agrupada em 4 baldes (pendentes/iniciadas/
//     concluídas/demais), mesmo agrupamento do texto da legenda do mockup
//     (`key-monthly.html`) — a barra colorida é `aria-hidden` (decorativa); a
//     contagem completa por status vive só no nome acessível do botão do dia.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { Box } from '@mui/material'

import { useMonthlyDensityQuery } from '../../api'
import { monthGridWeeks, parseLocalDate } from '../../../../shared/date'
import { MONTH_NAMES_PT } from '../../monthNames'
import { typography } from '../../../../shared/design/tokens'
import type { DensityDay, MonthlyCycleReadiness } from '../../types'
import { MONTHLY_RITUAL_SOURCE_LABEL, type MonthlyRitualSourceId } from './monthlyRitualSources'

export interface MonthlyProgressSourceInput {
  sourceId: MonthlyRitualSourceId
  eligibleNow: number
  pendingNow: number
}

export interface MonthlyContextRailProps {
  targetMonthFirst: string
  readiness: MonthlyCycleReadiness
  /** As 3 fontes do denominador de progresso (AC5) — diferente do Weekly, que
   * tem 4 (uma delas, `monthly-expanded`, fica fora do denominador lá). */
  progressSources: MonthlyProgressSourceInput[]
  previousMonthlyPendingCount: number
  previousPeriodStart: string | null
  onNavigateToSource: (sourceId: MonthlyRitualSourceId) => void
  onSelectDay: (scheduledDate: string | null) => void
  onCompletePlanning: () => void
  onStart: () => void
  onFinalizePrevious: () => void
  planningCompletedAt: string | null
}

function dayMonthLabel(iso: string): string {
  const date = parseLocalDate(iso)
  return `${date.getDate()} de ${MONTH_NAMES_PT[date.getMonth()]}`
}

function pluralize(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

function describeDensityDay(day: DensityDay | undefined, dateIso: string): string {
  const label = dayMonthLabel(dateIso)
  if (!day || day.total === 0) return `${label}: vazio`
  const { pending, started, completed, cancelled, migrated, postponed } = day.byStatus
  const demais = cancelled + migrated + postponed
  const parts: string[] = []
  if (pending) parts.push(pluralize(pending, 'pendente', 'pendentes'))
  if (started) parts.push(pluralize(started, 'iniciada', 'iniciadas'))
  if (completed) parts.push(pluralize(completed, 'concluída', 'concluídas'))
  if (demais) parts.push(pluralize(demais, 'em outro estado', 'em outros estados'))
  return `${label}: ${pluralize(day.total, 'registro', 'registros')} — ${parts.join(', ')}`
}

function segmentWidths(day: DensityDay | undefined): { color: string; percent: number }[] {
  if (!day || day.total === 0) return []
  const { pending, started, completed, cancelled, migrated, postponed } = day.byStatus
  const demais = cancelled + migrated + postponed
  return [
    { color: 'var(--ds-ink-muted)', percent: (pending / day.total) * 100 },
    { color: 'var(--ds-warning)', percent: (started / day.total) * 100 },
    { color: 'var(--ds-success)', percent: (completed / day.total) * 100 },
    { color: 'var(--ds-ink-disabled)', percent: (demais / day.total) * 100 },
  ].filter((segment) => segment.percent > 0)
}

export function MonthlyContextRail({
  targetMonthFirst,
  readiness,
  progressSources,
  previousMonthlyPendingCount,
  previousPeriodStart,
  onNavigateToSource,
  onSelectDay,
  onCompletePlanning,
  onStart,
  onFinalizePrevious,
  planningCompletedAt,
}: MonthlyContextRailProps) {
  const density = useMonthlyDensityQuery(targetMonthFirst)
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false)

  const densityByDate = new Map((density.data?.days ?? []).map((day) => [day.date, day]))
  const weeks = monthGridWeeks(targetMonthFirst)

  const totalEligible = progressSources.reduce((sum, s) => sum + s.eligibleNow, 0)
  const totalPending = progressSources.reduce((sum, s) => sum + s.pendingNow, 0)
  const decidedCount = totalEligible - totalPending
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
          <Box
            role="grid"
            aria-label="Minicalendário de densidade"
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(var(--ds-monthly-board-columns), minmax(0, 1fr))',
              gap: 'var(--ds-space-1)',
            }}
          >
            {weeks.map((week, weekIndex) => (
              <Box key={weekIndex} role="row" sx={{ display: 'contents' }}>
                {week.map((day) => {
                  if (!day.inMonth) {
                    return <Box key={day.iso} role="gridcell" aria-hidden="true" />
                  }
                  const densityDay = densityByDate.get(day.iso)
                  return (
                    <Box
                      key={day.iso}
                      component="button"
                      type="button"
                      role="gridcell"
                      aria-label={describeDensityDay(densityDay, day.iso)}
                      onClick={() => onSelectDay(day.iso)}
                      sx={{
                        ...typography.meta,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        padding: 'var(--ds-space-1)',
                        border: '1px solid var(--ds-border)',
                        borderRadius: 'var(--ds-radius-sm)',
                        background: 'var(--ds-surface)',
                        color: 'var(--ds-ink)',
                        cursor: 'pointer',
                      }}
                    >
                      <span>{parseLocalDate(day.iso).getDate()}</span>
                      <Box aria-hidden="true" sx={{ display: 'flex', height: 'var(--ds-task-row-category-border-width)', borderRadius: 'var(--ds-radius-xs)', overflow: 'hidden', backgroundColor: 'var(--ds-surface-subtle)' }}>
                        {segmentWidths(densityDay).map((segment, index) => (
                          <Box key={index} sx={{ width: `${segment.percent}%`, backgroundColor: segment.color }} />
                        ))}
                      </Box>
                    </Box>
                  )
                })}
              </Box>
            ))}
          </Box>
        )}
        {density.data && (
          <Box
            component="button"
            type="button"
            onClick={() => onSelectDay(null)}
            aria-label={`Sem dia definido: ${pluralize(density.data.undated.total, 'registro', 'registros')}`}
            sx={{
              ...typography.body,
              width: '100%',
              textAlign: 'left',
              display: 'flex',
              justifyContent: 'space-between',
              border: '1px solid var(--ds-border)',
              borderRadius: 'var(--ds-radius-sm)',
              background: 'var(--ds-surface)',
              cursor: 'pointer',
              color: 'var(--ds-ink)',
              mt: 'var(--ds-space-1)',
            }}
          >
            <span>Sem dia definido</span>
            <span>{density.data.undated.total}</span>
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
          aria-valuemax={3}
          aria-valuetext={`${reviewedCount} de 3 fontes revisadas`}
          sx={{ ...typography.body, color: 'var(--ds-ink)' }}
        >
          Fontes revisadas: {reviewedCount}/3
        </Box>
        <Box
          role="progressbar"
          aria-label="Itens decididos"
          aria-valuenow={decidedCount}
          aria-valuemin={0}
          aria-valuemax={totalEligible}
          aria-valuetext={`${decidedCount} de ${totalEligible} itens decididos`}
          sx={{ ...typography.body, color: 'var(--ds-ink)' }}
        >
          Itens decididos: {decidedCount}/{totalEligible}
        </Box>
      </Box>

      <Box component="section" aria-label="Avisos">
        <Box sx={{ ...typography['section-title'], color: 'var(--ds-ink)' }}>Avisos</Box>
        {progressSources
          .filter((source) => source.sourceId !== 'previous-monthly' && source.pendingNow > 0)
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
                // Piso de alvo de toque (achado real do axe na DW-16) — mesmo
                // fix do irmão `weekly/WeeklyContextRail.tsx`: sem `minHeight`
                // estes botões ficam abaixo do piso do WCAG 2.5.8 e encostados,
                // reprovando tamanho E espaçamento. O token é o do projeto
                // (`--ds-touch-target-min`, piso 44×44 da Story 14.5 AC7).
                minHeight: 'var(--ds-touch-target-min)',
                alignItems: 'center',
              }}
            >
              {MONTHLY_RITUAL_SOURCE_LABEL[source.sourceId]}: {source.pendingNow} pendente(s)
            </Box>
          ))}

        {previousMonthlyPendingCount > 0 ? (
          <Box role="alert" sx={{ ...typography.body, color: 'var(--ds-danger)', display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
            <Box
              component="button"
              type="button"
              onClick={() => onNavigateToSource('previous-monthly')}
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
              Monthly anterior: {previousMonthlyPendingCount} pendência(s) — bloqueia iniciar mês
            </Box>
          </Box>
        ) : (
          <Box sx={{ ...typography.body, color: 'var(--ds-success)' }}>Mês anterior pronto para finalizar.</Box>
        )}
      </Box>

      <Box component="section" aria-label="Ações do ciclo" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-2)' }}>
        <Box
          component="button"
          type="button"
          onClick={onCompletePlanning}
          sx={{ ...typography.label, backgroundColor: 'var(--ds-primary)', color: 'var(--ds-on-primary)', border: 'none', borderRadius: 'var(--ds-radius-sm)', padding: 'var(--ds-space-2)', cursor: 'pointer' }}
        >
          {planningCompletedAt ? 'Revisar planejamento' : 'Concluir planejamento'}
        </Box>

        <Box component="section" aria-label="Painel de verificação — Iniciar mês">
          <Box sx={{ ...typography.label, color: 'var(--ds-ink-muted)' }}>Iniciar mês</Box>
          {readiness.start && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
              <GateRow label="Data alcançada (dia 1 ou posterior)" ok={readiness.start.gates.dateReached} />
              <GateRow label="Planejamento concluído" ok={readiness.start.gates.planningCompleted} />
              <GateRow label="Monthly anterior finalizado" ok={readiness.start.gates.previousFinalized} />
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
            Iniciar mês
          </Box>
        </Box>

        {previousMonthlyPendingCount === 0 && previousPeriodStart && (
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
              Finalizar mês anterior
            </Box>
            {finalizeDialogOpen && (
              <Box role="alertdialog" aria-label="Finalizar mês anterior — irreversível" sx={{ ...typography.body }}>
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
