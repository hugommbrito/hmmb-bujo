// ─────────────────────────────────────────────────────────────────────────────
// Aba **Hoje** — superfície de registro (Story 16.1).
//
//   ▶ ORDEM DE LEITURA FIXA nas três faixas: data e tipo de dia → completude do
//     dia → registro por grupo (`EXPERIENCE.md#Hábitos`).
//
//   ▶ A INTERFACE NUNCA CALCULA COMPLETUDE. `totalCompletion` e
//     `groups[].completion` vêm do servidor; marcar feriado ou aplicar o
//     override REESCREVE `multiplierAtTime` no servidor e a UI **refetcha** —
//     nada de recálculo otimista de porcentagem, peso efetivo ou multiplicador.
//
//   ▶ DIAS PASSADOS: a navegação de data abre qualquer dia já semeado, com os
//     pesos congelados DAQUELE dia. Sem limite de retroatividade (gate 16.0,
//     Q5) — a interface não cria linhas, ela abre o dia.
//
//   ▶ O FUTURO NÃO É DESTINO. A retroatividade é ilimitada; a prospectividade
//     não existe. `GET /api/habits/days/?date=` chama `seed_habit_day`
//     incondicionalmente (`backend/habits/views.py`), então ABRIR um dia futuro
//     MATERIALIZA as linhas dele com os pesos/meta/multiplicador de hoje
//     congelados — e esse dia passaria a contar como "dia com registro" na
//     grade do Histórico, derrubando as razões booleanas (5/7 viraria 5/12).
//     Por isso `Próximo ›` para em HOJE, com o motivo escrito.
//
// [Source: mockup key-habitos.html F1/F2/F3/F4; spec 16.1 Task 4 e I/O Matrix]
// ─────────────────────────────────────────────────────────────────────────────
import { useId } from 'react'
import { Box, Button, Checkbox, FormControlLabel } from '@mui/material'

import { typography } from '../../../../shared/design/tokens'
import {
  useHabitDayQuery,
  useOverrideDayWorkdayMutation,
  useSetHolidayMutation,
} from '../../api'
import { DAY_TYPE_LABEL } from '../historyUtils'
import { CompletionBar } from './CompletionBar'
import { HabitGroupCard } from './HabitGroupCard'
import { HabitsTodaySkeleton } from './HabitsSkeleton'
import {
  RETRY_LABEL,
  addDays,
  formatDateLongBR,
  formatEffectiveWeight,
  isoLocalToday,
  sumEffectiveWeights,
} from './habitsSurface'

/** Verbatim do gate (§ Design Notes). */
export const EMPTY_TODAY = 'Nenhum hábito ativo hoje.'
export const READ_ERROR = 'Não foi possível carregar. Tente novamente.'
export const WRITE_ERROR = 'Não foi possível salvar. Tente novamente.'
export const OVERRIDE_LABEL = 'Tratar este dia como dia útil (peso cheio)'
export const HOLIDAY_LABEL = 'Marcar este dia como feriado'
export const PRECEDENCE_TEXT = 'Precedência: feriado > fim de semana > dia útil.'
/**
 * Motivo ESCRITO de `Próximo ›` indisponível em hoje — nunca só um botão
 * apagado (mesma regra do "criar hábito sem grupo").
 */
const RETRY_BUTTON_SX = {
  minHeight: 'var(--ds-touch-target-min)',
  backgroundColor: 'var(--ds-primary)',
  color: 'var(--ds-on-primary)',
  '&:hover': { backgroundColor: 'var(--ds-primary-hover)' },
} as const

const STEP_BUTTON_SX = {
  ...typography.label,
  minHeight: 'var(--ds-touch-target-min)',
  color: 'var(--ds-ink)',
  border: '1px solid var(--ds-control-border)',
  '&.Mui-disabled': { color: 'var(--ds-ink-muted)' },
} as const

export interface HabitsTodayPanelProps {
  /** Data visível (ISO). */
  date: string
  onChangeDate: (next: string) => void
  compact: boolean
  wide: boolean
  disabled?: boolean
  disabledReasonId?: string
}

export function HabitsTodayPanel({
  date,
  onChangeDate,
  compact,
  wide,
  disabled = false,
  disabledReasonId,
}: HabitsTodayPanelProps) {
  const today = isoLocalToday()
  const habitDay = useHabitDayQuery(date)
  const setHoliday = useSetHolidayMutation(date)
  const overrideDay = useOverrideDayWorkdayMutation(date)
  const reactId = useId()
  const dayHeadingId = `habits-day-${reactId}`
  // A data visível nunca passa de hoje: a navegação não oferece o caminho e o
  // `changeDate` de `HabitsRecordPage` clampa qualquer chamador em hoje.
  const atToday = date >= today

  if (habitDay.isPending) return <HabitsTodaySkeleton />

  if (habitDay.isError || !habitDay.data) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--ds-space-2)',
          alignItems: 'flex-start',
        }}
      >
        <Box role="alert" sx={{ ...typography.body, color: 'var(--ds-ink)' }}>
          {READ_ERROR}
        </Box>
        <Button onClick={() => habitDay.refetch()} sx={RETRY_BUTTON_SX}>
          {RETRY_LABEL}
        </Button>
      </Box>
    )
  }

  const { date: dayIso, totalCompletion, dayType, groups, entries } = habitDay.data
  const effectiveWeightSum = sumEffectiveWeights(entries)
  const filled = entries.filter((entry) => entry.value != null).length
  const isHoliday = dayType === 'holiday'
  const writeError = setHoliday.isError || overrideDay.isError

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-4)' }}>
      {/* ── Cabeçalho do dia ─────────────────────────────────────────────── */}
      <Box
        component="section"
        aria-labelledby={dayHeadingId}
        sx={{
          backgroundColor: 'var(--ds-surface)',
          border: '1px solid var(--ds-border)',
          borderRadius: 'var(--ds-radius-md)',
          padding: 'var(--ds-panel-padding)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--ds-space-3)',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--ds-space-2)',
            flexWrap: 'wrap',
          }}
        >
          <Box
            component="h2"
            id={dayHeadingId}
            sx={{ ...typography['section-title'], color: 'var(--ds-ink)', margin: 0 }}
          >
            {formatDateLongBR(dayIso)}
          </Box>
          <Box
            data-testid="habits-day-type-chip"
            sx={{
              ...typography.label,
              minHeight: 'var(--ds-chip-height)',
              display: 'inline-flex',
              alignItems: 'center',
              px: 'var(--ds-space-2)',
              borderRadius: 'var(--ds-radius-sm)',
              border: '1px solid var(--ds-border)',
              backgroundColor: 'var(--ds-surface-subtle)',
              color: 'var(--ds-ink-muted)',
            }}
          >
            {DAY_TYPE_LABEL[dayType]}
          </Box>
          <Box
            sx={{
              marginLeft: 'auto',
              display: 'flex',
              gap: 'var(--ds-space-1)',
              alignItems: 'center',
            }}
          >
            {/* Offline a navegação de data também para: trocar de dia dispara
                uma LEITURA que não pode completar, e o usuário cairia no erro de
                leitura com um retry que não tem como funcionar. O motivo é o
                mesmo da faixa (`disabledReasonId`). */}
            <Button
              onClick={() => onChangeDate(addDays(date, -1))}
              disabled={disabled}
              aria-describedby={disabled ? disabledReasonId : undefined}
              aria-label="Dia anterior"
              sx={STEP_BUTTON_SX}
            >
              ‹
            </Button>
            <Button
              onClick={() => onChangeDate(today)}
              aria-pressed={date === today}
              disabled={disabled}
              aria-describedby={disabled ? disabledReasonId : undefined}
              sx={STEP_BUTTON_SX}
            >
              Hoje
            </Button>
            <Button
              onClick={() => onChangeDate(addDays(date, 1))}
              disabled={atToday || disabled}
              aria-describedby={disabled ? disabledReasonId : undefined}
              aria-label="Próximo dia"
              sx={STEP_BUTTON_SX}
            >
              ›
            </Button>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-3)' }}>
          <Box
            data-testid="habits-day-percent"
            sx={{
              ...typography['page-title'],
              color: 'var(--ds-ink)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {totalCompletion}%
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <CompletionBar
              scope="day"
              percent={totalCompletion}
              label={`Completude do dia: ${totalCompletion} por cento`}
            />
          </Box>
        </Box>

        {/* Denominador NOMEADO — explicita o que estava exigível. */}
        <Box
          sx={{
            ...typography.meta,
            color: 'var(--ds-ink-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          Soma dos pesos efetivos do dia: {formatEffectiveWeight(effectiveWeightSum)} · {filled} de{' '}
          {entries.length} registros preenchidos
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--ds-space-2)',
            flexWrap: 'wrap',
            borderTop: '1px solid var(--ds-border)',
            pt: 'var(--ds-space-2)',
          }}
        >
          <FormControlLabel
            sx={{ margin: 0, ...typography.body, color: 'var(--ds-ink)' }}
            control={
              <Checkbox
                checked={isHoliday}
                disabled={disabled}
                onChange={(event) =>
                  setHoliday.mutate({ date: dayIso, isHoliday: event.target.checked })
                }
                inputProps={{
                  'aria-label': HOLIDAY_LABEL,
                  'aria-describedby': disabled ? disabledReasonId : undefined,
                }}
                sx={{
                  color: 'var(--ds-control-border)',
                  '&.Mui-checked': { color: 'var(--ds-primary)' },
                }}
              />
            }
            label={HOLIDAY_LABEL}
          />
          <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>{PRECEDENCE_TEXT}</Box>
          {/* Override avulso: só quando o dia NÃO é útil. Grava
              `multiplierAtTime = 1,00` nas linhas DO DIA VISÍVEL; a
              configuração dos grupos fica intocada. */}
          {dayType !== 'weekday' && (
            <Button
              onClick={() => overrideDay.mutate(entries.map((entry) => entry.id))}
              disabled={disabled || overrideDay.isPending || entries.length === 0}
              aria-describedby={disabled ? disabledReasonId : undefined}
              sx={{
                ...STEP_BUTTON_SX,
                marginLeft: 'auto',
                color: 'var(--ds-primary)',
                borderColor: 'var(--ds-primary)',
              }}
            >
              {OVERRIDE_LABEL}
            </Button>
          )}
        </Box>

        {writeError && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--ds-space-1)',
              alignItems: 'flex-start',
            }}
          >
            <Box role="alert" sx={{ ...typography.meta, color: 'var(--ds-danger)' }}>
              {WRITE_ERROR}
            </Box>
            <Button
              onClick={() => {
                if (setHoliday.isError) setHoliday.mutate({ date: dayIso, isHoliday: !isHoliday })
                if (overrideDay.isError) overrideDay.mutate(entries.map((entry) => entry.id))
              }}
              sx={{ ...STEP_BUTTON_SX, color: 'var(--ds-danger)', borderColor: 'var(--ds-danger)' }}
            >
              {RETRY_LABEL}
            </Button>
          </Box>
        )}
      </Box>

      {/* ── Registro em cards ────────────────────────────────────────────── */}
      {entries.length === 0 ? (
        <Box sx={{ ...typography.body, color: 'var(--ds-ink-muted)' }}>{EMPTY_TODAY}</Box>
      ) : (
        <Box
          data-testid="habits-record-cards"
          sx={{
            display: 'grid',
            gap: 'var(--ds-record-cards-gap)',
            alignItems: 'start',
            // `auto-fit` + o PISO do card: duas colunas só se formam quando
            // cada card cabe em `--ds-record-cards-card-min-width`. Com o
            // `--ds-record-cards-max-width` do container (aplicado em
            // `HabitsRecordPage`), o teto natural é
            // `--ds-record-cards-columns-wide` colunas. A forma anterior
            // (`repeat(<colunas>, 1fr)`) ignorava o piso e podia entregar dois
            // cards abaixo dele — exatamente o que o token existe para evitar.
            //
            // O teto de colunas é DECLARADO (não emergente da aritmética entre
            // max-width, piso e gap): o container nunca passa de
            // `--ds-record-cards-columns-wide` cards por faixa, e o piso do card
            // continua mandando quando o espaço não dá para tantos.
            gridTemplateColumns: wide
              ? `repeat(auto-fit, minmax(max(min(100%, var(--ds-record-cards-card-min-width)), calc((100% - (var(--ds-record-cards-columns-wide) - 1) * var(--ds-record-cards-gap)) / var(--ds-record-cards-columns-wide))), 1fr))`
              : 'minmax(0, 1fr)',
          }}
        >
          {groups.map((group) => (
            <HabitGroupCard
              key={group.id}
              group={group}
              entries={entries.filter((entry) => entry.group === group.id)}
              date={date}
              compact={compact}
              disabled={disabled}
              disabledReasonId={disabledReasonId}
              headingId={`habits-group-${group.id}`}
              dayType={dayType}
            />
          ))}
        </Box>
      )}
    </Box>
  )
}
