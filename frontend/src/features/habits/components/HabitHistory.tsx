import { useState } from 'react'
import { Box, Button, MenuItem, TextField, Typography } from '@mui/material'
import { useHabitHistoryQuery, useHabitSeriesQuery } from '../api'
import type { HabitDayEntry, HabitHistoryDay } from '../types'
import { HabitEvolutionChart } from './HabitEvolutionChart'
import { HabitHistoryGrid } from './HabitHistoryGrid'
import { DAY_TYPE_LABEL, formatDateBR, formatNumber } from './historyUtils'

// Superfície de histórico read-only (Story 6.4). Compõe: controle de intervalo +
// seletor de hábito + detalhe por-data (read-only) + gráfico de evolução + grade
// acessível. `useQuery` puro (sem otimismo/prefetch — AD-14). Datas manipuladas
// por split de string / Date local, sem desvio de fuso.

const DEFAULT_SPAN = 29 // últimos 30 dias, inclusive.

function isoLocalToday(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function clamp(iso: string, start: string, end: string): string {
  if (iso < start) return start
  if (iso > end) return end
  return iso
}

function defaultRange() {
  const end = isoLocalToday()
  return { start: addDays(end, -DEFAULT_SPAN), end }
}

// Estado read-only de uma linha do dia (sem controles editáveis).
function readState(entry: HabitDayEntry): string {
  if (entry.type === 'boolean') {
    return entry.value != null && Number(entry.value) === 1 ? 'feito' : 'não feito'
  }
  const unit = entry.unit ? ` ${entry.unit}` : ''
  if (entry.value == null) return `sem valor · meta ${formatNumber(entry.metaAtTime)}${unit}`
  return `${formatNumber(entry.value)} / ${formatNumber(entry.metaAtTime)}${unit}`
}

interface DayDetailProps {
  day: HabitHistoryDay | undefined
}

// Detalhe por-data (AC1): read-only, agrupado, % por grupo + % total + tipo do dia.
// Dia-lacuna → "Sem registro neste dia." (nunca 0% fabricado).
function DayDetail({ day }: DayDetailProps) {
  if (!day || day.entries.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
        Sem registro neste dia.
      </Typography>
    )
  }
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" component="div" sx={{ px: 1 }}>
        Completude do dia: {day.totalCompletion}%
        {day.dayType !== 'weekday' ? ` · ${DAY_TYPE_LABEL[day.dayType]}` : ''}
      </Typography>
      {day.groups.map((group) => {
        const groupEntries = day.entries.filter((entry) => entry.group === group.id)
        if (groupEntries.length === 0) return null
        return (
          <Box key={group.id} sx={{ mb: 1 }}>
            <Typography variant="subtitle2" component="h4" sx={{ px: 1, py: 0.5 }}>
              {group.name} · {group.completion}%
            </Typography>
            {groupEntries.map((entry) => (
              <Typography
                key={entry.id}
                variant="body2"
                component="div"
                sx={{ px: 2, minHeight: 32, display: 'flex', alignItems: 'center' }}
              >
                {entry.emoticon ? `${entry.emoticon} ` : ''}
                {entry.name}: {readState(entry)}
              </Typography>
            ))}
          </Box>
        )
      })}
    </Box>
  )
}

export function HabitHistory() {
  const [range, setRange] = useState(defaultRange)
  const [selectedHabitId, setSelectedHabitId] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => defaultRange().end)

  const history = useHabitHistoryQuery(range)
  const series = useHabitSeriesQuery(selectedHabitId, range)

  function updateRange(next: { start: string; end: string }) {
    if (next.start > next.end) return
    setRange(next)
    setSelectedDate((prev) => clamp(prev, next.start, next.end))
  }

  function shiftPeriod(direction: -1 | 1) {
    const span = DEFAULT_SPAN + 1
    updateRange({
      start: addDays(range.start, direction * span),
      end: addDays(range.end, direction * span),
    })
  }

  const habits = history.data?.habits ?? []
  const detailDay = history.data?.days.find((day) => day.date === selectedDate)

  return (
    <Box>
      <Typography variant="h6" component="h2" sx={{ px: 1 }}>
        Histórico
      </Typography>

      {/* Controle de intervalo (anterior/próximo período + seletores start/end). */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          px: 1,
          py: 1,
        }}
      >
        <Button size="small" onClick={() => shiftPeriod(-1)}>
          Período anterior
        </Button>
        <TextField
          label="Início"
          type="date"
          size="small"
          value={range.start}
          onChange={(event) => updateRange({ ...range, start: event.target.value })}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'aria-label': 'Início do intervalo' } }}
        />
        <TextField
          label="Fim"
          type="date"
          size="small"
          value={range.end}
          onChange={(event) => updateRange({ ...range, end: event.target.value })}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'aria-label': 'Fim do intervalo' } }}
        />
        <Button size="small" onClick={() => shiftPeriod(1)}>
          Próximo período
        </Button>
      </Box>

      {history.isPending ? (
        <Typography variant="body2" color="text.secondary" role="status" sx={{ px: 1, py: 2 }}>
          Carregando histórico…
        </Typography>
      ) : history.isError || !history.data ? (
        <Typography variant="body2" color="error" role="alert" sx={{ px: 1, py: 2 }}>
          Não foi possível carregar o histórico. Tente novamente.
        </Typography>
      ) : (
        <Box>
          {/* Detalhe por-data (AC1) — read-only. */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', flexWrap: 'wrap', px: 1 }}>
              <Button
                size="small"
                onClick={() => setSelectedDate((d) => clamp(addDays(d, -1), range.start, range.end))}
                disabled={selectedDate <= range.start}
              >
                Dia anterior
              </Button>
              <TextField
                label="Data"
                type="date"
                size="small"
                value={selectedDate}
                onChange={(event) =>
                  setSelectedDate(clamp(event.target.value, range.start, range.end))
                }
                slotProps={{
                  inputLabel: { shrink: true },
                  htmlInput: {
                    min: range.start,
                    max: range.end,
                    'aria-label': `Data selecionada: ${formatDateBR(selectedDate)}`,
                  },
                }}
              />
              <Button
                size="small"
                onClick={() => setSelectedDate((d) => clamp(addDays(d, 1), range.start, range.end))}
                disabled={selectedDate >= range.end}
              >
                Próximo dia
              </Button>
            </Box>
            <Typography variant="subtitle2" component="h3" sx={{ px: 1, mt: 1 }}>
              {formatDateBR(selectedDate)}
            </Typography>
            <DayDetail day={detailDay} />
          </Box>

          {/* Gráfico de evolução por hábito (AC2). */}
          <Box sx={{ mb: 2, px: 1 }}>
            <TextField
              select
              label="Hábito"
              size="small"
              value={selectedHabitId}
              onChange={(event) => setSelectedHabitId(event.target.value)}
              sx={{ minWidth: 200 }}
              slotProps={{ inputLabel: { shrink: true } }}
            >
              <MenuItem value="">
                <em>Selecione um hábito</em>
              </MenuItem>
              {habits.map((habit) => (
                <MenuItem key={habit.id} value={habit.id}>
                  {habit.emoticon ? `${habit.emoticon} ` : ''}
                  {habit.name}
                </MenuItem>
              ))}
            </TextField>

            {selectedHabitId === '' ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Selecione um hábito para ver o gráfico de evolução.
              </Typography>
            ) : series.isPending ? (
              <Typography variant="body2" color="text.secondary" role="status" sx={{ mt: 1 }}>
                Carregando série…
              </Typography>
            ) : series.isError || !series.data ? (
              <Typography variant="body2" color="error" role="alert" sx={{ mt: 1 }}>
                Não foi possível carregar a série. Tente novamente.
              </Typography>
            ) : (
              <HabitEvolutionChart series={series.data} />
            )}
          </Box>

          {/* Grade densa hábitos × dias = tabela acessível (AC1/AC3). */}
          <Box sx={{ px: 1 }}>
            <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
              Grade do período
            </Typography>
            <HabitHistoryGrid data={history.data} />
          </Box>
        </Box>
      )}
    </Box>
  )
}
