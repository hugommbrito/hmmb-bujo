import { Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DayType, HabitSeries } from '../types'
import {
  DAY_TYPE_LABEL,
  describeEvent,
  formatDateBR,
  formatDateShortBR,
  formatNumber,
} from './historyUtils'

// A 6.4 é a 1ª superfície de gráfico do app. Decisões de design (skill dataviz +
// AD-11 + editorial "ferramenta, não produto"):
// - UM eixo Y só (nunca dual-scale): a linha principal é o `value`. O peso efetivo
//   / multiplicador NÃO vira uma 2ª linha de escala diferente — é representado
//   EXCLUSIVAMENTE como sombreamento de ritmo (AC2). Isso respeita "one axis".
// - Série única → sem legenda de cor; o título nomeia o hábito. A tabela acessível
//   equivalente é a grade (HabitHistoryGrid), não o gráfico.
// - Marcadores de mudança SEMPRE acompanhados de texto (lista "Mudanças no período"
//   + tooltip) — cor nunca comunica sozinha (AC3).
// - `meta` NÃO é desenhada como ReferenceLine: ela é versionada (muda no tempo) e
//   suas mudanças já aparecem como marcadores; uma única linha horizontal seria
//   ambígua. Decisão documentada (Decisão 4 tratava a meta-line como opcional).

interface ChartDatum {
  date: string
  value: number | null
  dayType: DayType
  changeText?: string
}

// recharts injeta `active`/`payload` no componente de `content`; tipamos só o que
// lemos (v3 mudou `TooltipProps`, então evitamos importá-lo).
interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{ payload: ChartDatum }>
  unit?: string
}

function ChartTooltip({ active, payload, unit }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const datum = payload[0].payload
  const unitSuffix = unit ? ` ${unit}` : ''
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        px: 1,
        py: 0.5,
      }}
    >
      <Typography variant="body-sm" component="div">
        {formatDateBR(datum.date)}
      </Typography>
      <Typography variant="body-sm" component="div" color="text.secondary">
        {datum.value == null ? 'Sem registro' : `${formatNumber(datum.value)}${unitSuffix}`}
      </Typography>
      {datum.dayType !== 'weekday' && (
        <Typography variant="body-sm" component="div" color="text.secondary">
          {DAY_TYPE_LABEL[datum.dayType]}
        </Typography>
      )}
      {datum.changeText && (
        <Typography variant="body-sm" component="div">
          Mudança: {datum.changeText}
        </Typography>
      )}
    </Box>
  )
}

export interface HabitEvolutionChartProps {
  series: HabitSeries
}

export function HabitEvolutionChart({ series }: HabitEvolutionChartProps) {
  const theme = useTheme()
  const { habit, points, events } = series
  const dayTypes = series.dayTypes ?? []

  const pointByDate = new Map(points.map((p) => [p.date, p]))
  const eventByDate = new Map(events.map((e) => [e.effectiveFrom, describeEvent(e)]))
  const isBoolean = habit.type === 'boolean'

  const chartData: ChartDatum[] = dayTypes.map((dt) => {
    const point = pointByDate.get(dt.date)
    // Sem linha (dia nunca aberto) → lacuna honesta (null → quebra na linha).
    // Booleano COM linha e value nulo = "aberto, não feito" → 0 (parte do degrau),
    // nunca lacuna. Numérico com value nulo = sem medição → lacuna (não fabricar 0).
    let value: number | null
    if (!point) {
      value = null
    } else if (point.value != null) {
      value = Number(point.value)
    } else {
      value = isBoolean ? 0 : null
    }
    return {
      date: dt.date,
      value,
      dayType: dt.dayType,
      changeText: eventByDate.get(dt.date),
    }
  })

  // Blocos contíguos de fim de semana/feriado → sombreamento de ritmo.
  const bands: { x1: string; x2: string }[] = []
  for (let i = 0; i < chartData.length; i++) {
    if (chartData[i].dayType === 'weekday') continue
    const startDate = chartData[i].date
    let j = i
    while (j + 1 < chartData.length && chartData[j + 1].dayType !== 'weekday') j++
    bands.push({ x1: startDate, x2: chartData[j].date })
    i = j
  }

  const daysWithRecord = points.length
  const changeCount = events.length
  const first = chartData[0]?.date
  const last = chartData[chartData.length - 1]?.date
  const summary =
    first && last
      ? `Evolução de ${habit.name} de ${formatDateBR(first)} a ${formatDateBR(last)}. ` +
        `${daysWithRecord} ${daysWithRecord === 1 ? 'dia' : 'dias'} com registro, ` +
        `${changeCount} ${changeCount === 1 ? 'mudança' : 'mudanças'} de configuração no período.`
      : `Evolução de ${habit.name}: nenhum dia no período.`

  return (
    <Box>
      <Box component="figure" sx={{ m: 0 }}>
        <Box role="img" aria-label={summary} sx={{ width: '100%', height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid
                stroke={theme.palette.divider}
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateShortBR}
                tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
                stroke={theme.palette.divider}
                minTickGap={16}
              />
              <YAxis
                domain={isBoolean ? [0, 1] : [0, 'auto']}
                allowDecimals={!isBoolean}
                tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
                stroke={theme.palette.divider}
                width={40}
              />
              {bands.map((band) => (
                <ReferenceArea
                  key={`${band.x1}-${band.x2}`}
                  x1={band.x1}
                  x2={band.x2}
                  fill={theme.palette.text.primary}
                  fillOpacity={0.06}
                />
              ))}
              {events.map((event) => (
                <ReferenceLine
                  key={event.effectiveFrom}
                  x={event.effectiveFrom}
                  stroke={theme.palette.text.secondary}
                  strokeDasharray="4 2"
                />
              ))}
              <Tooltip content={<ChartTooltip unit={habit.unit} />} />
              <Line
                type="monotone"
                dataKey="value"
                name={habit.name}
                stroke={theme.palette.category.blue}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>
        <Typography
          component="figcaption"
          variant="body-sm"
          color="text.secondary"
          sx={{ mt: 1, display: 'block' }}
        >
          {summary}
        </Typography>
      </Box>

      {events.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="label" component="h4" color="text.secondary">
            Mudanças no período
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {events.map((event) => (
              <Typography component="li" variant="body-sm" key={event.effectiveFrom}>
                {formatDateBR(event.effectiveFrom)}: {describeEvent(event)}
              </Typography>
            ))}
          </Box>
        </Box>
      )}

      {bands.length > 0 && (
        <Typography variant="body-sm" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
          Fim de semana e feriados aparecem sombreados.
        </Typography>
      )}
    </Box>
  )
}
