// ─────────────────────────────────────────────────────────────────────────────
// Calendário completo do Monthly Board (Story 14.6, AC1/AC7) — `role="grid"`
// segunda→domingo com até 6 linhas, TODOS os dias do mês (inclusive vazios),
// dias fora do mês em `--ds-surface-subtle`/`--ds-ink-disabled` (texto, sem
// `daynum` clicável).
//
//   ▶ `monthGridWeeks` (`shared/date`, Task 2) monta a grade — nenhuma cópia
//     ad hoc daqui (a de `MonthDensityCalendar.tsx` é legada, fora de escopo).
//   ▶ Cada linha usa `display:'contents'` (role="row") para preservar a
//     semântica ARIA grid > row > gridcell sem quebrar o posicionamento CSS
//     Grid dos 7 cartões por linha.
//   ▶ `--ds-monthly-board-columns` (nunca o literal `7`) alimenta `repeat()` —
//     var() é válido dentro de `repeat()` nos browsers-alvo.
// ─────────────────────────────────────────────────────────────────────────────
import { Box } from '@mui/material'

import { MonthlyDayCell } from './MonthlyDayCell'
import { capitalize, MONTH_NAMES_PT } from '../../monthNames'
import { monthGridWeeks, parseLocalDate, formatDayLabel } from '../../../../shared/date'
import { typography } from '../../../../shared/design/tokens'
import type { CycleStatus, Task, TaskStatus } from '../../types'

const WEEKDAY_HEADERS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']

function fullDateLabel(iso: string): string {
  const date = parseLocalDate(iso)
  return `${date.getDate()} de ${MONTH_NAMES_PT[date.getMonth()]} de ${date.getFullYear()}`
}

function dayMonthLabel(iso: string): string {
  const date = parseLocalDate(iso)
  return `${date.getDate()} de ${MONTH_NAMES_PT[date.getMonth()]}`
}

export interface MonthlyCalendarGridProps {
  monthFirst: string
  /** Tarefas do mês, já agrupadas por `scheduledDate` ("AAAA-MM-DD"). */
  tasksByDate: Map<string, Task[]>
  /** "Hoje" do servidor (Convenção #8) — `null` enquanto não carregou. */
  todayIso: string | null
  cycleStatus: CycleStatus
  readonly: boolean
  onOpenDetail: (taskId: string) => void
  onTransition?: (taskId: string, toStatus: TaskStatus) => void
  onCreate?: (date: string, title: string) => void
}

export function MonthlyCalendarGrid({
  monthFirst,
  tasksByDate,
  todayIso,
  cycleStatus,
  readonly,
  onOpenDetail,
  onTransition,
  onCreate,
}: MonthlyCalendarGridProps) {
  const weeks = monthGridWeeks(monthFirst)
  const [year, month] = monthFirst.split('-').map(Number)
  const gridLabel = `${capitalize(MONTH_NAMES_PT[month - 1])} de ${year}; todos os dias e tarefas do mês`

  return (
    <Box
      role="grid"
      aria-label={gridLabel}
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(var(--ds-monthly-board-columns), minmax(0, 1fr))',
        // Piso por linha (achado real do axe, `target-size` — ver tokens.ts):
        // sem ele, `1fr` sozinho comprime o formulário de criação da célula
        // abaixo do alvo de toque mínimo em viewports curtos. Quando o total
        // excede a viewport, a GRADE inteira rola verticalmente (a lista
        // interna de cada célula continua rolando primeiro, isoladamente).
        gridAutoRows: 'minmax(var(--ds-monthly-board-min-cell-height), 1fr)',
        gap: 'var(--ds-monthly-board-gap)',
        minHeight: 0,
        border: '1px solid var(--ds-border)',
        borderRadius: 'var(--ds-radius-md)',
        overflow: 'auto',
      }}
    >
      <Box role="row" sx={{ display: 'contents' }}>
        {WEEKDAY_HEADERS.map((label) => (
          <Box
            key={label}
            role="columnheader"
            sx={{
              ...typography.label,
              color: 'var(--ds-ink-muted)',
              textAlign: 'center',
              padding: 'var(--ds-space-1)',
              backgroundColor: 'var(--ds-surface-subtle)',
            }}
          >
            {label}
          </Box>
        ))}
      </Box>

      {weeks.map((week, weekIndex) => (
        <Box key={weekIndex} role="row" sx={{ display: 'contents' }}>
          {week.map((day) =>
            day.inMonth ? (
              <MonthlyDayCell
                key={day.iso}
                date={day.iso}
                dayNumberLabel={String(parseLocalDate(day.iso).getDate())}
                fullDateLabel={fullDateLabel(day.iso)}
                dayMonthLabel={dayMonthLabel(day.iso)}
                tasks={tasksByDate.get(day.iso) ?? []}
                cycleStatus={cycleStatus}
                readonly={readonly}
                isToday={day.iso === todayIso}
                onOpenDetail={onOpenDetail}
                onTransition={onTransition}
                onCreate={readonly || !onCreate ? undefined : (title) => onCreate(day.iso, title)}
              />
            ) : (
              <Box
                key={day.iso}
                role="gridcell"
                sx={{
                  ...typography.meta,
                  // `--ds-ink-disabled` sobre `--ds-surface-subtle` reprova
                  // color-contrast (achado real do axe, ~2.6:1) — o par
                  // literal do DESIGN.md para "dias fora do mês" não passa no
                  // piso de acessibilidade; `--ds-ink-muted` mantém a mesma
                  // de-ênfase visual com contraste conforme (~5.1:1 AA).
                  color: 'var(--ds-ink-muted)',
                  backgroundColor: 'var(--ds-surface-subtle)',
                  border: '1px solid var(--ds-border)',
                  padding: 'var(--ds-space-1)',
                }}
              >
                {formatDayLabel(day.iso, 'day-month')}
              </Box>
            ),
          )}
        </Box>
      ))}
    </Box>
  )
}
