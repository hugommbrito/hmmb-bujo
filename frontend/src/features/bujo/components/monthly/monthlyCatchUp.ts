// ─────────────────────────────────────────────────────────────────────────────
// Lógica PURA da faixa "Regularização atrasada" (Story 14.11) — separada do
// componente por `react-refresh/only-export-components` (mesmo motivo de
// `monthlyRitualSources.ts`).
// ─────────────────────────────────────────────────────────────────────────────
import { formatMonthTitle } from '../../monthNames'
import type { MonthlyCycleReadiness } from '../../types'

export interface CatchUpStep {
  label: string
  ok: boolean
  reason?: string
}

/** Passos na ordem do M07, cada ✓/✗ derivado da readiness (verdade do servidor). */
export function catchUpSteps(
  targetMonthFirst: string,
  readiness: MonthlyCycleReadiness,
  previousPeriodStart: string | null,
): CatchUpStep[] {
  const target = formatMonthTitle(targetMonthFirst)
  const steps: CatchUpStep[] = []
  if (previousPeriodStart) {
    const openTasksLeft = readiness.finalize ? !readiness.finalize.gates.noOpenTasks : false
    steps.push({
      label: `Finalizar ${formatMonthTitle(previousPeriodStart)}`,
      ok: readiness.start?.gates.previousFinalized ?? false,
      reason: openTasksLeft
        ? 'Decida as pendências da fonte "Monthly anterior" (subtarefas incluídas) e confirme em "Finalizar mês anterior".'
        : 'Confirme em "Finalizar mês anterior" no rail de contexto.',
    })
  }
  steps.push({
    label: `Concluir planejamento de ${target}`,
    ok: readiness.start?.gates.planningCompleted ?? false,
    reason: 'Use "Concluir planejamento" no rail de contexto — não exige zerar os avisos.',
  })
  steps.push({
    label: `Iniciar ${target}`,
    // Enquanto o alvo está em `planning`, iniciar é sempre o último ✗: ao
    // acontecer, a readiness troca de alvo e a faixa some ou avança de mês.
    ok: false,
    reason: 'Libera quando os passos anteriores estiverem ✓.',
  })
  return steps
}
