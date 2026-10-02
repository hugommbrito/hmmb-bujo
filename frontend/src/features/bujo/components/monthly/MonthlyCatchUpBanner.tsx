// ─────────────────────────────────────────────────────────────────────────────
// Faixa "Regularização atrasada" do ritual mensal (Story 14.11).
//
// Aparece SÓ quando o alvo do ritual (`readiness.planning.monthFirst`) é
// ANTERIOR ao mês corrente — o usuário entrou num mês sem ter planejado o
// anterior, e o M07 manda materializar um mês por vez (planejar → concluir →
// iniciar → finalizar), sem salto nem lote. A faixa nomeia o alvo, diz quantos
// meses faltam até o corrente e lista os passos na ordem em que destravam,
// marcando o PRIMEIRO ✗ como "Próximo passo" — cada ✓/✗ vem da readiness do
// servidor (os mesmos predicados dos gates), nunca de contagem local.
//
//   ▶ `role="status"`: informativa e persistente; não rouba foco.
//   ▶ Zero literal estrutural/cromático — tudo `var(--ds-*)` (guard
//     `noLiteralTokens.test.ts`).
// ─────────────────────────────────────────────────────────────────────────────
import { Box } from '@mui/material'

import { monthsBetweenIso } from '../../../../shared/date'
import { typography } from '../../../../shared/design/tokens'
import { formatMonthTitle } from '../../monthNames'
import type { MonthlyCycleReadiness } from '../../types'
import { GateRow } from '../GateRow'
import { catchUpSteps } from './monthlyCatchUp'

export interface MonthlyCatchUpBannerProps {
  targetMonthFirst: string
  currentMonthFirst: string
  readiness: MonthlyCycleReadiness
  /** Chave do Monthly operacional anterior (fonte bloqueante), ou `null` sem
   * anterior — aí não há "Finalizar" a listar e o gate passa por vacuidade. */
  previousPeriodStart: string | null
}

export function MonthlyCatchUpBanner({
  targetMonthFirst,
  currentMonthFirst,
  readiness,
  previousPeriodStart,
}: MonthlyCatchUpBannerProps) {
  const steps = catchUpSteps(targetMonthFirst, readiness, previousPeriodStart)
  const nextStep = steps.find((step) => !step.ok)
  const monthsLeft = monthsBetweenIso(targetMonthFirst, currentMonthFirst)
  const target = formatMonthTitle(targetMonthFirst)
  const current = formatMonthTitle(currentMonthFirst)

  return (
    <Box
      component="section"
      role="status"
      aria-label="Regularização atrasada"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--ds-space-2)',
        padding: 'var(--ds-space-3)',
        border: '1px solid var(--ds-warning)',
        borderRadius: 'var(--ds-radius-sm)',
        backgroundColor: 'var(--ds-surface-subtle)',
        color: 'var(--ds-ink)',
      }}
    >
      <Box sx={{ ...typography['section-title'], color: 'var(--ds-ink)' }}>Regularização atrasada</Box>
      <Box sx={{ ...typography.body }}>
        O alvo deste ritual é <strong>{target}</strong>, anterior ao mês corrente ({current}). Os meses são
        materializados um por vez — depois de {target},{' '}
        {monthsLeft === 1 ? 'ainda falta 1 mês' : `ainda faltam ${monthsLeft} meses`} até {current}.
      </Box>
      {nextStep && (
        <Box sx={{ ...typography.label, color: 'var(--ds-primary)' }}>Próximo passo: {nextStep.label}</Box>
      )}
      <Box
        component="ol"
        aria-label="Passos da regularização"
        sx={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}
      >
        {steps.map((step) => (
          <Box component="li" key={step.label}>
            <GateRow label={step.label} ok={step.ok} reason={step === nextStep ? step.reason : undefined} />
          </Box>
        ))}
      </Box>
    </Box>
  )
}
