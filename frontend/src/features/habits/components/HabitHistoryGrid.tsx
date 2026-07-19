import { Box, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import type {
  DayType,
  HabitDayEntry,
  HabitHistoryDay,
  HabitHistoryRange,
  HabitSlim,
} from '../types'
import { DAY_TYPE_LABEL, formatDateBR, formatDateShortBR, formatNumber } from './historyUtils'

// Grade densa hábitos × dias (UX-DR4). É a TABELA EQUIVALENTE acessível que o
// Accessibility Floor exige para o gráfico (mata dois requisitos com um componente):
// - `<table>` semântica: linhas = hábitos, colunas = dias; headers programáticos
//   (`<th scope="col">` datas, `<th scope="row">` hábitos).
// - células anunciam data + estado (aria-label), lacuna = "—" honesto (texto, não
//   só cor); fim de semana/feriado distintos com RÓTULO (tag textual), não só cor.
// - Mobile (<768px): alternativa de LISTA por dia — sem scroll horizontal (UX-DR18).

interface CellState {
  display: string
  aria: string
}

function cellState(entry: HabitDayEntry | undefined, habit: HabitSlim): CellState {
  if (!entry || entry.value == null) {
    // Lacuna honesta OU não-feito: sem valor registrado → "—".
    return { display: '—', aria: 'sem registro' }
  }
  if (habit.type === 'boolean') {
    const done = Number(entry.value) === 1
    return { display: done ? '✓' : '—', aria: done ? 'feito' : 'não feito' }
  }
  const unitSuffix = habit.unit ? ` ${habit.unit}` : ''
  return {
    display: formatNumber(entry.value),
    aria: `${formatNumber(entry.value)}${unitSuffix}`,
  }
}

// Tag textual curta para colunas de ritmo (nunca só cor).
const DAY_TYPE_TAG: Record<DayType, string> = {
  weekday: '',
  weekend: 'FDS',
  holiday: 'FER',
}

function entriesByHabit(day: HabitHistoryDay): Map<string, HabitDayEntry> {
  return new Map(day.entries.map((e) => [e.habitId, e]))
}

// Texto só para leitor de tela (o `<th>` precisa de texto VISÍVEL não-aria-hidden
// para o axe empty-table-header; o rótulo completo/dia-tipo entra aqui).
const srOnly = {
  position: 'absolute',
  width: 1,
  height: 1,
  p: 0,
  m: '-1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const

export interface HabitHistoryGridProps {
  data: HabitHistoryRange
}

export function HabitHistoryGrid({ data }: HabitHistoryGridProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery('(max-width:767px)')
  const { habits, days } = data

  if (habits.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 2 }}>
        Nenhum registro no período.
      </Typography>
    )
  }

  // Índice dia→(hábito→linha) para leitura O(1) das células.
  const indexByDate = new Map(days.map((day) => [day.date, entriesByHabit(day)]))

  if (isMobile) {
    // Alternativa de lista por dia (sem scroll horizontal). Só dias com registro.
    const daysWithRecord = days.filter((day) => day.entries.length > 0)
    return (
      <Box>
        {daysWithRecord.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 2 }}>
            Nenhum registro no período.
          </Typography>
        ) : (
          daysWithRecord.map((day) => {
            const byHabit = entriesByHabit(day)
            return (
              <Box key={day.date} sx={{ mb: 2 }}>
                <Typography variant="subtitle2" component="h4" sx={{ px: 1 }}>
                  {formatDateBR(day.date)}
                  {day.dayType !== 'weekday' ? ` · ${DAY_TYPE_LABEL[day.dayType]}` : ''}
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                  {habits.map((habit) => {
                    const state = cellState(byHabit.get(habit.id), habit)
                    return (
                      <Typography component="li" variant="body-sm" key={habit.id}>
                        {habit.emoticon ? `${habit.emoticon} ` : ''}
                        {habit.name}: {state.aria}
                      </Typography>
                    )
                  })}
                </Box>
              </Box>
            )
          })
        )}
      </Box>
    )
  }

  const rhythmBg = theme.palette.action.hover

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box
        component="table"
        sx={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%' }}
      >
        <Typography component="caption" variant="body-sm" color="text.secondary" sx={{ textAlign: 'left', px: 1, py: 0.5 }}>
          Grade de hábitos por dia. Colunas são dias; linhas são hábitos. Fim de semana
          (FDS) e feriados (FER) são marcados no cabeçalho.
        </Typography>
        <thead>
          <tr>
            <Box component="th" scope="col" sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper', textAlign: 'left', p: 1, borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="label" component="span">Hábito</Typography>
            </Box>
            {days.map((day) => {
              const tag = DAY_TYPE_TAG[day.dayType]
              const isRhythm = day.dayType !== 'weekday'
              return (
                <Box
                  component="th"
                  scope="col"
                  key={day.date}
                  sx={{
                    p: 0.5,
                    minWidth: 40,
                    textAlign: 'center',
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    bgcolor: isRhythm ? rhythmBg : undefined,
                  }}
                >
                  <Typography variant="body-sm" component="div">
                    {formatDateShortBR(day.date)}
                  </Typography>
                  {tag && (
                    <Typography variant="label" component="div" color="text.secondary">
                      {tag}
                    </Typography>
                  )}
                  {/* Rótulo completo (data + tipo de dia) para leitor de tela. */}
                  <Box component="span" sx={srOnly}>
                    {isRhythm
                      ? `${formatDateBR(day.date)}, ${DAY_TYPE_LABEL[day.dayType]}`
                      : formatDateBR(day.date)}
                  </Box>
                </Box>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {habits.map((habit) => (
            <tr key={habit.id}>
              <Box
                component="th"
                scope="row"
                sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper', textAlign: 'left', p: 1, whiteSpace: 'nowrap', borderBottom: `1px solid ${theme.palette.divider}` }}
              >
                <Typography variant="body-sm" component="span">
                  {habit.emoticon ? `${habit.emoticon} ` : ''}
                  {habit.name}
                </Typography>
              </Box>
              {days.map((day) => {
                const state = cellState(indexByDate.get(day.date)?.get(habit.id), habit)
                const dayLabel = day.dayType !== 'weekday'
                  ? `${formatDateBR(day.date)} (${DAY_TYPE_LABEL[day.dayType]})`
                  : formatDateBR(day.date)
                return (
                  <Box
                    component="td"
                    key={day.date}
                    aria-label={`${habit.name}, ${dayLabel}: ${state.aria}`}
                    sx={{
                      p: 0.5,
                      textAlign: 'center',
                      borderBottom: `1px solid ${theme.palette.divider}`,
                      bgcolor: day.dayType !== 'weekday' ? rhythmBg : undefined,
                    }}
                  >
                    <Typography variant="body-sm" component="span" aria-hidden>
                      {state.display}
                    </Typography>
                  </Box>
                )
              })}
            </tr>
          ))}
        </tbody>
      </Box>
    </Box>
  )
}
