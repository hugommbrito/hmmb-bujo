import { useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import {
  useHabitDayQuery,
  useMarkHabitEntryMutation,
  useOverrideDayWorkdayMutation,
  useSetHolidayMutation,
} from '../api'
import type { DayType, HabitDayEntry, HabitDayGroup } from '../types'

// Rótulos factuais e neutros do tipo de dia (UX-DR13: sem gamificação).
const DAY_TYPE_LABEL: Record<DayType, string> = {
  weekday: 'Dia útil',
  weekend: 'Fim de semana',
  holiday: 'Feriado',
}

// String EXATA da AC2 (mesma constante de HabitsManager) — verificada em teste.
const SAVE_ERROR = 'Não foi possível salvar. Tente novamente.'

const numberFormat = new Intl.NumberFormat('pt-BR')

function formatNumber(raw: string | null): string {
  if (raw == null || raw === '') return '0'
  const value = Number(raw)
  return Number.isNaN(value) ? String(raw) : numberFormat.format(value)
}

// "% da meta" (progresso cru na linha numérica) — cálculo trivial no cliente.
function metaPercent(value: string | null, meta: string | null): number | null {
  if (value == null || meta == null) return null
  const v = Number(value)
  const m = Number(meta)
  if (Number.isNaN(v) || Number.isNaN(m) || m === 0) return null
  return Math.round((v / m) * 100)
}

function isChecked(entry: HabitDayEntry): boolean {
  return entry.value != null && Number(entry.value) === 1
}

interface BooleanRowProps {
  entry: HabitDayEntry
  onMark: (value: string | null) => void
  error: boolean
}

function BooleanRow({ entry, onMark, error }: BooleanRowProps) {
  const checked = isChecked(entry)
  return (
    <Box sx={{ px: 1 }}>
      <FormControlLabel
        sx={{ minHeight: 44, width: '100%', m: 0 }}
        control={
          <Checkbox checked={checked} onChange={() => onMark(checked ? null : '1')} />
        }
        label={
          <Typography variant="body2">
            {entry.emoticon ? `${entry.emoticon} ` : ''}
            {entry.name}
          </Typography>
        }
      />
      {error && (
        <Typography variant="caption" color="error" role="alert" sx={{ pl: 4 }}>
          {SAVE_ERROR}
        </Typography>
      )}
    </Box>
  )
}

interface NumericRowProps {
  entry: HabitDayEntry
  onMark: (value: string | null) => void
  error: boolean
}

function NumericRow({ entry, onMark, error }: NumericRowProps) {
  const [draft, setDraft] = useState(entry.value ?? '')
  const percent = metaPercent(entry.value, entry.metaAtTime)
  const reached =
    entry.value != null &&
    entry.metaAtTime != null &&
    Number(entry.value) >= Number(entry.metaAtTime)
  const unitSuffix = entry.unit ? ` ${entry.unit}` : ''

  function commit() {
    const trimmed = draft.trim()
    const next = trimmed === '' ? null : trimmed
    if (next !== (entry.value ?? null)) onMark(next)
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, minHeight: 44 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2">
          {entry.emoticon ? `${entry.emoticon} ` : ''}
          {entry.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div">
          {reached
            ? 'Meta atingida'
            : `${formatNumber(entry.value)} / ${formatNumber(entry.metaAtTime)}${unitSuffix}` +
              (percent != null ? ` (${percent}%)` : '')}
        </Typography>
        {error && (
          <Typography variant="caption" color="error" role="alert" component="div">
            {SAVE_ERROR}
          </Typography>
        )}
      </Box>
      <TextField
        type="number"
        size="small"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
        }}
        inputProps={{ 'aria-label': `Valor de ${entry.name}` }}
        sx={{ width: 120 }}
      />
    </Box>
  )
}

interface HabitEntryRowProps {
  entry: HabitDayEntry
  date?: string
}

function HabitEntryRow({ entry, date }: HabitEntryRowProps) {
  const mark = useMarkHabitEntryMutation(date)
  const onMark = (value: string | null) => mark.mutate({ entryId: entry.id, value })
  return entry.type === 'numeric' ? (
    <NumericRow entry={entry} onMark={onMark} error={mark.isError} />
  ) : (
    <BooleanRow entry={entry} onMark={onMark} error={mark.isError} />
  )
}

interface GroupSectionProps {
  group: HabitDayGroup
  entries: HabitDayEntry[]
  date?: string
}

function GroupSection({ group, entries, date }: GroupSectionProps) {
  const groupEntries = entries.filter((entry) => entry.group === group.id)
  if (groupEntries.length === 0) return null
  // Multiplicador do grupo no dia (todas as linhas do grupo compartilham o mesmo,
  // exceto após override avulso). Legenda factual quando ≠ 1 (AD-10 transparência).
  const dayType = groupEntries[0].dayType
  const multiplier = groupEntries[0].multiplierAtTime
  const showLegend =
    dayType !== 'weekday' && multiplier != null && Number(multiplier) !== 1
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" component="h3" sx={{ px: 1, py: 0.5 }}>
        {group.name} · {group.completion}%
      </Typography>
      {showLegend && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, pb: 0.5 }}>
          <InfoOutlinedIcon fontSize="small" color="action" aria-hidden />
          <Typography variant="caption" color="text.secondary" component="div">
            {DAY_TYPE_LABEL[dayType]} · peso ×{formatNumber(multiplier)}
          </Typography>
        </Box>
      )}
      {groupEntries.map((entry) => (
        <HabitEntryRow key={entry.id} entry={entry} date={date} />
      ))}
    </Box>
  )
}

export interface HabitTrackerProps {
  date?: string
}

export function HabitTracker({ date }: HabitTrackerProps) {
  const habitDay = useHabitDayQuery(date)
  const setHoliday = useSetHolidayMutation(date)
  const overrideDay = useOverrideDayWorkdayMutation(date)

  if (habitDay.isPending) {
    return (
      <Typography variant="body2" color="text.secondary" role="status" sx={{ px: 1, py: 2 }}>
        Carregando hábitos…
      </Typography>
    )
  }

  if (habitDay.isError || !habitDay.data) {
    return (
      <Typography variant="body2" color="error" role="alert" sx={{ px: 1, py: 2 }}>
        {SAVE_ERROR}
      </Typography>
    )
  }

  const { date: day, totalCompletion, dayType, groups, entries } = habitDay.data

  return (
    <Box>
      <Box sx={{ px: 1, mb: 1 }}>
        <Typography variant="h6" component="h2">
          Hábitos
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          Completude do dia: {totalCompletion}%
        </Typography>
        <FormControlLabel
          sx={{ minHeight: 44 }}
          control={
            <Switch
              checked={dayType === 'holiday'}
              onChange={(event) =>
                setHoliday.mutate({ date: day, isHoliday: event.target.checked })
              }
            />
          }
          label="Feriado"
        />
        {/* Override avulso de dia (AC3): só quando o dia não é útil. Neutro, factual. */}
        {dayType !== 'weekday' && (
          <Button
            size="small"
            onClick={() => overrideDay.mutate(entries.map((entry) => entry.id))}
            disabled={overrideDay.isPending || entries.length === 0}
          >
            Tratar este dia como dia útil (peso cheio)
          </Button>
        )}
        {(setHoliday.isError || overrideDay.isError) && (
          <Typography variant="caption" color="error" role="alert" component="div">
            {SAVE_ERROR}
          </Typography>
        )}
      </Box>
      {entries.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
          Nenhum hábito ativo hoje.
        </Typography>
      ) : (
        groups.map((group) => (
          <GroupSection key={group.id} group={group} entries={entries} date={date} />
        ))
      )}
    </Box>
  )
}
