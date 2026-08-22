// ─────────────────────────────────────────────────────────────────────────────
// Card de grupo da variante "Registro em cards" (Story 16.1).
//
//   ▶ UM Panel POR GRUPO, com Section Header interno (nome · peso efetivo · %)
//     e a barra de `--ds-completion-bar-height-group`. Nenhum Panel aninhado,
//     nenhuma sombra — o card não vira dashboard (`DESIGN.md` L708).
//
//   ▶ A PORCENTAGEM DO GRUPO VEM DO SERVIDOR (`HabitDayGroup.completion`).
//     O peso efetivo é a SOMA dos fatores que o servidor já congelou em cada
//     linha (`weightAtTime × multiplierAtTime`) — transparência do denominador,
//     não recálculo de completude.
//
//   ▶ LEGENDA DE MULTIPLICADOR só quando o dia NÃO é útil **E** o multiplicador
//     difere de 1 (paridade com `HabitTracker.tsx:166-180`). Texto verbatim do
//     gate: `Feriado · peso ×0,5 neste grupo`.
// ─────────────────────────────────────────────────────────────────────────────
import { Box } from '@mui/material'

import { typography } from '../../../../shared/design/tokens'
import { DAY_TYPE_LABEL } from '../historyUtils'
import type { HabitDayEntry, HabitDayGroup } from '../../types'
import { CompletionBar } from './CompletionBar'
import { HabitTrackerRow } from './HabitTrackerRow'
import { formatDecimal, formatEffectiveWeight, sumEffectiveWeights } from './habitsSurface'

/** Verbatim do gate — grupo vazio é estado LEGÍTIMO, não erro a corrigir. */
export const EMPTY_GROUP = 'Nenhum hábito neste grupo.'

export interface HabitGroupCardProps {
  group: HabitDayGroup
  entries: HabitDayEntry[]
  date?: string
  compact: boolean
  disabled?: boolean
  disabledReasonId?: string
  headingId: string
}

export function HabitGroupCard({
  group,
  entries,
  date,
  compact,
  disabled,
  disabledReasonId,
  headingId,
}: HabitGroupCardProps) {
  const effectiveWeight = sumEffectiveWeights(entries)
  const first = entries[0]
  const multiplier = first?.multiplierAtTime
  const dayType = first?.dayType
  const showLegend =
    dayType != null && dayType !== 'weekday' && multiplier != null && Number(multiplier) !== 1

  return (
    <Box
      component="section"
      aria-labelledby={headingId}
      data-testid="habit-group-card"
      sx={{
        backgroundColor: 'var(--ds-surface)',
        border: '1px solid var(--ds-border)',
        borderRadius: 'var(--ds-radius-md)',
        padding: 'var(--ds-panel-padding)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--ds-space-2)',
        minWidth: 0,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 'var(--ds-space-2)',
          flexWrap: 'wrap',
        }}
      >
        <Box
          component="h3"
          id={headingId}
          sx={{ ...typography['section-title'], color: 'var(--ds-ink)', margin: 0 }}
        >
          {group.name}
        </Box>
        <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
          peso efetivo {formatEffectiveWeight(effectiveWeight)}
        </Box>
        {/* A porcentagem em TEXTO é obrigatória ao lado da barra. */}
        <Box
          data-testid="habit-group-percent"
          sx={{
            ...typography['body-strong'],
            color: 'var(--ds-ink)',
            marginLeft: 'auto',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {group.completion}%
        </Box>
      </Box>

      <CompletionBar
        scope="group"
        percent={group.completion}
        label={`Completude do grupo ${group.name}: ${group.completion} por cento`}
      />

      {showLegend && (
        <Box sx={{ ...typography.meta, color: 'var(--ds-warning)' }}>
          {DAY_TYPE_LABEL[dayType]} · peso ×{formatDecimal(multiplier) ?? '1'} neste grupo
        </Box>
      )}

      {entries.length === 0 ? (
        <Box sx={{ ...typography.body, color: 'var(--ds-ink-muted)' }}>{EMPTY_GROUP}</Box>
      ) : (
        <Box
          component="ul"
          sx={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            borderTop: '1px solid var(--ds-border)',
          }}
        >
          {entries.map((entry) => (
            <HabitTrackerRow
              key={entry.id}
              entry={entry}
              date={date}
              compact={compact}
              disabled={disabled}
              disabledReasonId={disabledReasonId}
            />
          ))}
        </Box>
      )}
    </Box>
  )
}
