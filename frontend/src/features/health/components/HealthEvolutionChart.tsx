import { useState } from 'react'
import { Box, Button, MenuItem, TextField, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useHealthFieldSeriesQuery } from '../api'
import type { HealthFieldDefinition, HealthFieldSeries } from '../types'
import { formatDateBR, formatDateShortBR, formatNumber } from './healthHistoryUtils'

// Gráfico de evolução de UM campo numérico (AC2). Mirror SIMPLIFICADO de
// HabitEvolutionChart (6.4): Saúde NÃO versiona e NÃO tem tipo de dia/multiplicador
// → linha única, SEM ReferenceLine de mudança, SEM ReferenceArea de ritmo, SEM
// eventos. Decisões de design (skill `dataviz`): um eixo Y só; série única → sem
// legenda de cor (o rótulo/figcaption nomeia o campo); a tabela acessível
// equivalente é HealthHistoryTable, não o SVG; cor via token validado do tema
// (`category.blue`, já usado em 6.4). Auto-contido: gerencia o campo selecionado e
// busca a série (divergência de 6.4, onde o seletor vivia no orquestrador — a story
// 7.3 coloca o seletor e os estados vazios aqui).

interface ChartDatum {
  date: string
  value: number | null
}

// recharts injeta `active`/`payload` no `content`; tipamos só o que lemos.
interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{ payload: ChartDatum }>
}

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const datum = payload[0].payload
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
        {datum.value == null ? 'Sem registro' : formatNumber(datum.value)}
      </Typography>
    </Box>
  )
}

// Enumera todos os dias "YYYY-MM-DD" de [start, end] por aritmética de Date LOCAL
// (sem drift de fuso) — o eixo X cobre o range inteiro para que dias sem valor
// virem lacuna (`connectNulls={false}`), nunca zero fabricado.
function eachDayISO(start: string, end: string): string[] {
  const [ys, ms, ds] = start.split('-').map(Number)
  const [ye, me, de] = end.split('-').map(Number)
  const out: string[] = []
  const cur = new Date(ys, ms - 1, ds)
  const last = new Date(ye, me - 1, de)
  while (cur <= last) {
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, '0')
    const d = String(cur.getDate()).padStart(2, '0')
    out.push(`${y}-${m}-${d}`)
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

interface ChartBodyProps {
  series: HealthFieldSeries
  range: { start: string; end: string }
}

function ChartBody({ series, range }: ChartBodyProps) {
  const theme = useTheme()
  const { field, points } = series

  const valueByDate = new Map(points.map((p) => [p.date, p.value]))
  const dates = eachDayISO(range.start, range.end)
  const chartData: ChartDatum[] = dates.map((date) => ({
    date,
    value: valueByDate.get(date) ?? null,
  }))

  const daysWithRecord = points.length
  const first = dates[0]
  const last = dates[dates.length - 1]
  const summary =
    first && last
      ? `Evolução de ${field.name} de ${formatDateBR(first)} a ${formatDateBR(last)}. ` +
        `${daysWithRecord} ${daysWithRecord === 1 ? 'dia' : 'dias'} com registro no período.`
      : `Evolução de ${field.name}: nenhum dia no período.`

  return (
    <Box component="figure" sx={{ m: 0, mt: 1 }}>
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
            {/* Métrica de saúde contínua (peso, pressão…): NÃO forçar linha de base
                em zero — achataria a variação que a evolução existe para mostrar
                (anti-padrão de dataviz p/ séries contínuas). `'auto'` deixa o
                recharts escalar ao range dos dados. Divergência consciente de 6.4,
                onde a série é contagem/multiplicador (0-based faz sentido). */}
            <YAxis
              domain={['auto', 'auto']}
              allowDecimals
              tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
              stroke={theme.palette.divider}
              width={40}
            />
            <Tooltip content={<ChartTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              name={field.name}
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
  )
}

export interface HealthEvolutionChartProps {
  numericFields: HealthFieldDefinition[]
  range: { start: string; end: string }
}

export function HealthEvolutionChart({ numericFields, range }: HealthEvolutionChartProps) {
  const [selectedFieldId, setSelectedFieldId] = useState('')
  const series = useHealthFieldSeriesQuery(selectedFieldId, range)

  if (numericFields.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Nenhum campo numérico para gráfico.
      </Typography>
    )
  }

  return (
    <Box>
      <TextField
        select
        label="Campo numérico"
        size="small"
        value={selectedFieldId}
        onChange={(event) => setSelectedFieldId(event.target.value)}
        sx={{ minWidth: 200 }}
        slotProps={{ inputLabel: { shrink: true } }}
      >
        <MenuItem value="">
          <em>Selecione um campo numérico</em>
        </MenuItem>
        {numericFields.map((field) => (
          <MenuItem key={field.id} value={field.id}>
            {field.name}
          </MenuItem>
        ))}
      </TextField>

      {selectedFieldId === '' ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Selecione um campo numérico.
        </Typography>
      ) : series.isPending ? (
        <Typography variant="body2" color="text.secondary" role="status" sx={{ mt: 1 }}>
          Carregando série…
        </Typography>
      ) : series.isError || !series.data ? (
        <Box role="alert" sx={{ mt: 1 }}>
          <Typography variant="body2" color="error">
            Não foi possível carregar a série.
          </Typography>
          <Button size="small" onClick={() => series.refetch()} sx={{ mt: 1 }}>
            Tentar novamente
          </Button>
        </Box>
      ) : (
        <ChartBody series={series.data} range={range} />
      )}
    </Box>
  )
}
