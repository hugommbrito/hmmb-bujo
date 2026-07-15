import { Box, ButtonBase, Typography } from '@mui/material'
import { MONTH_NAMES_PT } from '../monthNames'

/**
 * Calendário do mês com indicador de densidade de tarefas por dia (Story 11.3,
 * AC2/AC3). **Apenas informativo nesta story.**
 *
 * A seleção é o gancho de reuso da Story 11.6 (mover/migrar tarefa tocando num
 * dia — epics.md:817): as props `selectedDate`/`onSelectDay` já existem, mas
 * ficam **desligadas** aqui. Só há `onClick`/estado-selecionado quando
 * `onSelectDay` é passado — 11.3 não passa, então o grid não é interativo.
 */
interface MonthDensityCalendarProps {
  monthFirst: string // 'YYYY-MM-01' — mês a exibir
  densityByDate: Map<string, number> // 'YYYY-MM-DD' -> count (só dias > 0)
  selectedDate?: string | null // OPCIONAL — reservado p/ Story 11.6
  onSelectDay?: (isoDate: string) => void // OPCIONAL — reservado p/ Story 11.6
}

// AD-05: segunda é o 1º dia da semana.
const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

// Parseia 'YYYY-MM-DD' por partes e monta com `new Date(y, m-1, d)` LOCAL —
// evita o off-by-one de UTC de `new Date(isoString)` (mesma técnica de
// WeekDaySelector.formatDayChipLabel).
function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function isoOf(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function MonthDensityCalendar({
  monthFirst,
  densityByDate,
  selectedDate,
  onSelectDay,
}: MonthDensityCalendarProps) {
  const first = parseLocalDate(monthFirst)
  const year = first.getFullYear()
  const month = first.getMonth() + 1
  const monthLabel = MONTH_NAMES_PT[month - 1]
  // new Date(year, month, 0) = último dia do mês corrente (dia 0 do mês seguinte).
  const daysInMonth = new Date(year, month, 0).getDate()
  // getDay(): 0=Dom … 6=Sáb → índice seg-based (Seg=0 … Dom=6).
  const leadingBlanks = (first.getDay() + 6) % 7

  const cells: (number | null)[] = [
    ...Array<null>(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Completa a última linha com células vazias até fechar a semana.
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const interactive = Boolean(onSelectDay)

  return (
    <Box
      component="table"
      aria-label={`Densidade de tarefas de ${monthLabel}`}
      sx={{
        width: '100%',
        maxWidth: '100%',
        tableLayout: 'fixed',
        borderCollapse: 'collapse',
      }}
    >
      <Box component="thead">
        <Box component="tr">
          {WEEKDAY_LABELS.map((label) => (
            <Box component="th" scope="col" key={label} sx={{ py: 0.5, textAlign: 'center' }}>
              <Typography variant="label" color="text.secondary" component="span">
                {label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
      <Box component="tbody">
        {weeks.map((week) => (
          // Toda semana renderizada contém ≥1 dia real → chave estável e única.
          <Box component="tr" key={`week-${week.find((d): d is number => d !== null)}`}>
            {week.map((day, di) => {
              if (day === null) {
                // Célula vazia (antes do dia 1 / após o último) — sem conteúdo
                // nem nome acessível. Índice como chave é estável aqui (a
                // posição da célula vazia na semana não muda).
                return <Box component="td" key={`blank-${di}`} aria-hidden="true" />
              }
              const iso = isoOf(year, month, day)
              const count = densityByDate.get(iso) ?? 0
              const label =
                count > 0
                  ? `${day} de ${monthLabel}, ${count} ${count === 1 ? 'tarefa' : 'tarefas'}`
                  : `${day} de ${monthLabel}, sem tarefas`
              const selected = interactive && selectedDate === iso

              const content = (
                <>
                  <Typography variant="body-sm" component="div">
                    {day}
                  </Typography>
                  {count > 0 && (
                    <Typography variant="label" component="div" color="primary.main">
                      {count}
                    </Typography>
                  )}
                </>
              )

              return (
                <Box
                  component="td"
                  key={iso}
                  // No modo informativo o nome acessível vive no <td>; no modo
                  // interativo (11.6) migra para o <ButtonBase>.
                  aria-label={interactive ? undefined : label}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    p: 0,
                    verticalAlign: 'top',
                  }}
                >
                  {interactive ? (
                    <ButtonBase
                      onClick={() => onSelectDay?.(iso)}
                      aria-label={label}
                      aria-pressed={selected}
                      sx={{
                        width: '100%',
                        minHeight: 40,
                        flexDirection: 'column',
                        justifyContent: 'flex-start',
                        p: 0.5,
                        ...(selected && { bgcolor: 'action.selected' }),
                      }}
                    >
                      {content}
                    </ButtonBase>
                  ) : (
                    <Box sx={{ minHeight: 40, p: 0.5 }}>{content}</Box>
                  )}
                </Box>
              )
            })}
          </Box>
        ))}
      </Box>
    </Box>
  )
}
