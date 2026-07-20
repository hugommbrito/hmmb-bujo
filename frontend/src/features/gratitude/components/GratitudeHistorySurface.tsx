import { useState } from 'react'
import { Box, Button, Skeleton, TextField, Typography } from '@mui/material'
import { useGratitudeDayQuery, useGratitudeMonthQuery } from '../api'
import { GratitudeEntryList } from './GratitudeEntryList'

// Voz neutra pt-BR (UX-DR13, zero gamificação/CTA). Strings EXATAS.
const LOAD_ERROR = 'Não foi possível carregar as entradas.'
const EMPTY_MONTH = 'Nenhuma entrada neste mês.'
const EMPTY_DAY = 'Nenhuma entrada para esta data.'
const RETRY = 'Tentar novamente'

// Datas manipuladas por SPLIT DE STRING / Date local — NUNCA `new Date(iso)` (evita drift
// de fuso). Aritmética de MÊS copiada de MonthlyPage (addMonthsIso/currentMonthFirst) e de
// DIA de MedicationHistorySurface/GratitudeDaySurface (isoLocalToday/addDays/clampMax/
// formatDateBR). Cap SUPERIOR no mês/dia corrente; sem limite inferior (AC4/AC6).

function currentMonthFirst(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

// 'YYYY-MM-01' + N meses (split de string, não `new Date(iso)`).
function addMonthsIso(monthFirstIso: string, delta: number): string {
  const [year, month] = monthFirstIso.split('-').map(Number)
  const date = new Date(year, month - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

function isoLocalToday(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Não passa do limite superior (mês/dia corrente); sem limite inferior.
function clampMax(iso: string, max: string): string {
  return iso > max ? max : iso
}

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR')
}

function formatMonthBR(monthFirstIso: string): string {
  const [y, m] = monthFirstIso.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
}

export function GratitudeHistorySurface() {
  const today = isoLocalToday()
  const currentMonth = currentMonthFirst()
  // Estado local: mês exibido (default = mês corrente) e a data focada (null = visão de
  // mês; setada = visão "por data", D3). O cap de mês/dia é UI; a autoridade temporal
  // real é o servidor (today_for). Navegação de mês/data é estado de UI (não roteamento).
  const [monthFirst, setMonthFirst] = useState(currentMonth)
  const [focusedDate, setFocusedDate] = useState<string | null>(null)

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h6" component="h2" sx={{ px: 1, mb: 1 }}>
        Histórico
      </Typography>
      {focusedDate === null ? (
        <MonthView
          monthFirst={monthFirst}
          currentMonth={currentMonth}
          today={today}
          onChangeMonth={setMonthFirst}
          onFocusDate={setFocusedDate}
        />
      ) : (
        <DayView
          focusedDate={focusedDate}
          today={today}
          onChangeDate={setFocusedDate}
          onBackToMonth={() => setFocusedDate(null)}
        />
      )}
    </Box>
  )
}

// --- Visão por mês (agrupada por dia) ----------------------------------------
interface MonthViewProps {
  monthFirst: string
  currentMonth: string
  today: string
  onChangeMonth: (monthFirst: string) => void
  onFocusDate: (date: string) => void
}

function MonthView({
  monthFirst,
  currentMonth,
  today,
  onChangeMonth,
  onFocusDate,
}: MonthViewProps) {
  const monthQuery = useGratitudeMonthQuery(monthFirst)
  const atCurrentMonth = monthFirst >= currentMonth

  return (
    <Box>
      {/* Navegador de mês: anterior (sem limite inferior) / próximo (≤ mês corrente) +
          seletor type="month" capado no mês corrente. */}
      <Box
        sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', flexWrap: 'wrap', px: 1, py: 1 }}
      >
        <Button
          size="small"
          onClick={() => onChangeMonth(addMonthsIso(monthFirst, -1))}
          sx={{ minHeight: 44 }}
        >
          Mês anterior
        </Button>
        <TextField
          label="Mês"
          type="month"
          size="small"
          value={monthFirst.slice(0, 7)}
          onChange={(event) => {
            if (event.target.value) {
              onChangeMonth(clampMax(`${event.target.value}-01`, currentMonth))
            }
          }}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: {
              max: currentMonth.slice(0, 7),
              'aria-label': `Mês selecionado: ${formatMonthBR(monthFirst)}`,
            },
          }}
        />
        <Button
          size="small"
          onClick={() => onChangeMonth(clampMax(addMonthsIso(monthFirst, 1), currentMonth))}
          disabled={atCurrentMonth}
          sx={{ minHeight: 44 }}
        >
          Próximo mês
        </Button>
      </Box>

      {/* "Ir para data": entra no modo por-data (D3) a partir da visão de mês. */}
      <Box sx={{ px: 1, py: 1 }}>
        <TextField
          label="Ir para data"
          type="date"
          size="small"
          value=""
          onChange={(event) => {
            if (event.target.value) onFocusDate(clampMax(event.target.value, today))
          }}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }}
        />
      </Box>

      <Typography variant="subtitle2" component="h3" sx={{ px: 1, mb: 1 }}>
        {formatMonthBR(monthFirst)}
      </Typography>

      {monthQuery.isPending ? (
        <Box role="status" aria-live="polite" sx={{ px: 1, py: 2 }}>
          <Skeleton variant="text" width={200} />
          <Skeleton variant="rectangular" height={44} sx={{ mt: 1 }} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Carregando entradas…
          </Typography>
        </Box>
      ) : monthQuery.isError || !monthQuery.data ? (
        <Box sx={{ px: 1, py: 2 }}>
          <Typography variant="body2" color="error" role="alert">
            {LOAD_ERROR}
          </Typography>
          <Button size="small" onClick={() => void monthQuery.refetch()} sx={{ mt: 1 }}>
            {RETRY}
          </Button>
        </Box>
      ) : monthQuery.data.days.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 2 }}>
          {EMPTY_MONTH}
        </Typography>
      ) : (
        monthQuery.data.days.map((day) => (
          <Box key={day.date} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" component="h4" sx={{ px: 1, mb: 0.5 }}>
              {formatDateBR(day.date)}
            </Typography>
            <GratitudeEntryList entries={day.entries} />
          </Box>
        ))
      )}
    </Box>
  )
}

// --- Visão por data específica (reusa o read-model diário da 9.1) ------------
interface DayViewProps {
  focusedDate: string
  today: string
  onChangeDate: (date: string) => void
  onBackToMonth: () => void
}

function DayView({ focusedDate, today, onChangeDate, onBackToMonth }: DayViewProps) {
  const dayQuery = useGratitudeDayQuery(focusedDate)

  return (
    <Box>
      <Box
        sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', flexWrap: 'wrap', px: 1, py: 1 }}
      >
        <Button size="small" onClick={onBackToMonth} sx={{ minHeight: 44 }}>
          Voltar ao mês
        </Button>
        <TextField
          label="Data"
          type="date"
          size="small"
          value={focusedDate}
          onChange={(event) => {
            if (event.target.value) onChangeDate(clampMax(event.target.value, today))
          }}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: {
              max: today,
              'aria-label': `Data selecionada: ${formatDateBR(focusedDate)}`,
            },
          }}
        />
      </Box>

      <Typography variant="subtitle2" component="h3" sx={{ px: 1, mb: 1 }}>
        {formatDateBR(focusedDate)}
      </Typography>

      {dayQuery.isPending ? (
        <Box role="status" aria-live="polite" sx={{ px: 1, py: 2 }}>
          <Skeleton variant="text" width={200} />
          <Skeleton variant="rectangular" height={44} sx={{ mt: 1 }} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Carregando entradas…
          </Typography>
        </Box>
      ) : dayQuery.isError || !dayQuery.data ? (
        <Box sx={{ px: 1, py: 2 }}>
          <Typography variant="body2" color="error" role="alert">
            {LOAD_ERROR}
          </Typography>
          <Button size="small" onClick={() => void dayQuery.refetch()} sx={{ mt: 1 }}>
            {RETRY}
          </Button>
        </Box>
      ) : dayQuery.data.entries.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 2 }}>
          {EMPTY_DAY}
        </Typography>
      ) : (
        <GratitudeEntryList entries={dayQuery.data.entries} />
      )}
    </Box>
  )
}
