// ─────────────────────────────────────────────────────────────────────────────
// Aba **Histórico** (Story 16.1) — SOMENTE LEITURA, em contraste NORMAL
// (readonly nunca assume aparência disabled).
//
//   ▶ ORDEM CANÔNICA: intervalo → detalhe do dia → evolução → grade
//     (`EXPERIENCE.md#Hábitos`).
//
//   ▶ NENHUM CONTROLE DE ESCRITA vive aqui. A única saída para correção é
//     "Abrir este dia para edição", que leva a data selecionada para a aba
//     **Hoje** — navegação, não mutação.
//
//   ▶ DIA-LACUNA: "Sem registro neste dia." + a nota de que nenhuma linha foi
//     materializada. NENHUMA porcentagem — 0% fabricado seria mentira.
//
//   ▶ FALHA PARCIAL: a série falha e a grade carrega; cada bloco tem erro e
//     retry PRÓPRIOS. "Sem hábito selecionado ⇒ nada é buscado"
//     (`useHabitSeriesQuery` já traz `enabled: habitId !== ''`).
//
// [Source: mockup F8/F9 + E5; spec 16.1 Task 6]
// ─────────────────────────────────────────────────────────────────────────────
import { useId, useMemo, useState } from 'react'
import { Box, Button } from '@mui/material'

import { typography } from '../../../../shared/design/tokens'
import {
  useHabitGroupsQuery,
  useHabitHistoryQuery,
  useHabitSeriesQuery,
  useHabitsQuery,
} from '../../api'
import { DAY_TYPE_LABEL, formatDateBR } from '../historyUtils'
import { HabitEvolutionChart } from '../HabitEvolutionChart'
import { HABIT_SERIES_VIEW_LABEL, type HabitSeriesView } from '../habitSeriesView'
import type { HabitDayEntry, HabitHistoryDay, HabitSeries } from '../../types'
import { EMPTY_RANGE, HabitCompletionGrid, NO_RECORD_DAY } from './HabitCompletionGrid'
import { HabitsHistorySkeleton } from './HabitsSkeleton'
import { Field } from './HabitsFormControls'
import { SECONDARY_BUTTON_SX, controlStyle } from './habitsFormStyles'
import {
  RETRY_LABEL,
  addDays,
  clampDate,
  contributionFactor,
  formatDateLongBR,
  formatDateMediumBR,
  formatDecimal,
  formatEffectiveWeight,
  isoLocalToday,
  metaPercent,
  minDate,
  rowStateText,
  sumEffectiveWeights,
} from './habitsSurface'

export const READ_ERROR = 'Não foi possível carregar. Tente novamente.'
export const NO_HABIT_SELECTED = 'Selecione um hábito para ver o gráfico de evolução.'
export const NO_RECORD_DAY_NOTE =
  'Nenhuma linha foi materializada para este dia — o dia nunca foi aberto.'
export const OPEN_FOR_EDIT = 'Abrir este dia para edição'

/** Últimos 30 dias, inclusive — paridade com `HabitHistory.tsx:16`. */
const DEFAULT_SPAN = 29

/**
 * Motivo escrito de `Próximo período ›` indisponível. O histórico não avança
 * para o futuro: `GET /api/habits/history/` não materializa nada, mas oferecer
 * períodos futuros só renderizaria colunas vazias e sugeriria que existe
 * registro por vir.
 */
export const LATEST_PERIOD_NOTE = 'Este é o período mais recente.'

function defaultRange() {
  const end = isoLocalToday()
  return { start: addDays(end, -DEFAULT_SPAN), end }
}

const SERIES_VIEWS: HabitSeriesView[] = ['value', 'metaPercent', 'contribution']

/**
 * Visões OFERECIDAS para o hábito selecionado.
 *
 * `% da meta` não existe para hábito **booleano**: `metaAtTime` é sempre nulo,
 * `metaPercent` devolveria `null` em TODO ponto e a tabela equivalente imprimiria
 * "Sem registro neste dia." em dias que TÊM registro — absência fabricada, o
 * inverso exato do princípio "nunca 0% fabricado". A visão não é oferecida em vez
 * de ser oferecida e mentir.
 */
function viewsFor(type: 'boolean' | 'numeric' | undefined): HabitSeriesView[] {
  if (type === 'boolean') return SERIES_VIEWS.filter((option) => option !== 'metaPercent')
  return SERIES_VIEWS
}

const BLOCK_SX = {
  backgroundColor: 'var(--ds-surface)',
  border: '1px solid var(--ds-border)',
  borderRadius: 'var(--ds-radius-md)',
  padding: 'var(--ds-panel-padding)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--ds-space-2)',
} as const

function BlockError({ onRetry }: { onRetry: () => void }) {
  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)', alignItems: 'flex-start' }}
    >
      <Box role="alert" sx={{ ...typography.body, color: 'var(--ds-ink)' }}>
        {READ_ERROR}
      </Box>
      <Button onClick={onRetry} sx={SECONDARY_BUTTON_SX}>
        {RETRY_LABEL}
      </Button>
    </Box>
  )
}

// ─── Detalhe do dia ──────────────────────────────────────────────────────────

function DayDetail({
  day,
  date,
  onOpenForEdit,
}: {
  day: HabitHistoryDay | undefined
  date: string
  onOpenForEdit: () => void
}) {
  const headingId = `habits-history-detail-${date}`
  const hasRecord = day != null && day.entries.length > 0

  return (
    <Box component="section" aria-labelledby={headingId} sx={BLOCK_SX}>
      <Box
        component="h3"
        id={headingId}
        sx={{ ...typography['section-title'], color: 'var(--ds-ink)', margin: 0 }}
      >
        {formatDateLongBR(date)}
      </Box>

      {!hasRecord ? (
        <>
          <Box sx={{ ...typography.body, color: 'var(--ds-ink-muted)' }}>{NO_RECORD_DAY}</Box>
          <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>{NO_RECORD_DAY_NOTE}</Box>
        </>
      ) : (
        <>
          <Box
            sx={{ ...typography.meta, color: 'var(--ds-ink-muted)', fontVariantNumeric: 'tabular-nums' }}
          >
            {DAY_TYPE_LABEL[day.dayType]} · completude {day.totalCompletion}% · soma dos pesos
            efetivos: {formatEffectiveWeight(sumEffectiveWeights(day.entries))} ·{' '}
            {day.entries.filter((entry) => entry.value != null).length} de {day.entries.length}{' '}
            registros preenchidos
          </Box>
          {day.groups.map((group) => {
            const groupEntries = day.entries.filter((entry) => entry.group === group.id)
            if (groupEntries.length === 0) return null
            return (
              <Box key={group.id}>
                <Box
                  component="h4"
                  sx={{ ...typography.label, color: 'var(--ds-primary)', margin: 0 }}
                >
                  {group.name} · {group.completion}%
                </Box>
                <Box component="ul" sx={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {groupEntries.map((entry) => (
                    <Box
                      component="li"
                      key={entry.id}
                      sx={{
                        display: 'flex',
                        gap: 'var(--ds-space-2)',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid var(--ds-border)',
                        py: 'var(--ds-space-1)',
                        ...typography.body,
                        color: 'var(--ds-ink)',
                      }}
                    >
                      <Box component="span">
                        {entry.name}
                        <Box
                          component="span"
                          sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}
                        >
                          {' '}
                          · Peso {formatDecimal(entry.weightAtTime) ?? '0'}
                        </Box>
                      </Box>
                      <Box
                        component="span"
                        sx={{ ...typography.meta, color: 'var(--ds-ink-muted)', whiteSpace: 'nowrap' }}
                      >
                        {rowStateText({
                          type: entry.type,
                          value: entry.value,
                          metaAtTime: entry.metaAtTime,
                          unit: entry.unit,
                        })}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            )
          })}
        </>
      )}

      <Box sx={{ display: 'flex', gap: 'var(--ds-space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
        <Button onClick={onOpenForEdit} sx={SECONDARY_BUTTON_SX}>
          {OPEN_FOR_EDIT}
        </Button>
        <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
          Leva o dia selecionado para a aba Hoje. Não há nenhum controle de escrita nesta
          superfície.
        </Box>
      </Box>
    </Box>
  )
}

// ─── Painel ──────────────────────────────────────────────────────────────────

export interface HabitsHistoryPanelProps {
  compact: boolean
  /** Leva a data para a aba Hoje (navegação, nunca escrita). */
  onOpenDayForEdit: (date: string) => void
}

export function HabitsHistoryPanel({ compact, onOpenDayForEdit }: HabitsHistoryPanelProps) {
  const [range, setRange] = useState(defaultRange)
  const [selectedDate, setSelectedDate] = useState(() => defaultRange().end)
  const [selectedHabitId, setSelectedHabitId] = useState('')
  const [rawView, setView] = useState<HabitSeriesView>('value')
  const reactId = useId()

  const history = useHabitHistoryQuery(range)
  // `enabled: habitId !== ''` no hook: sem seleção, NADA é buscado.
  const series = useHabitSeriesQuery(selectedHabitId, range)
  // Grupos/inativos são ENFEITE do agrupamento da grade: se falharem, a grade
  // degrada para lista sem grupos, nunca para erro.
  const groupsQuery = useHabitGroupsQuery()
  const habitsQuery = useHabitsQuery({ includeInactive: true })

  const inactiveHabitIds = useMemo(
    () => new Set((habitsQuery.data ?? []).filter((h) => !h.active).map((h) => h.id)),
    [habitsQuery.data],
  )

  // Metas/bônus CONGELADOS por dia, para as visões derivadas da série.
  const frozenByDate = useMemo(() => {
    const index = new Map<string, HabitDayEntry>()
    if (!history.data || selectedHabitId === '') return index
    for (const day of history.data.days) {
      const entry = day.entries.find((candidate) => candidate.habitId === selectedHabitId)
      if (entry) index.set(day.date, entry)
    }
    return index
  }, [history.data, selectedHabitId])

  const viewSeries: HabitSeries | null = useMemo(() => {
    if (!series.data) return null
    // Visão efetiva: booleano nunca entra em `% da meta` (ver `viewsFor`).
    const view = viewsFor(series.data.habit.type).includes(rawView) ? rawView : 'value'
    if (view === 'value') return series.data
    return {
      ...series.data,
      points: series.data.points.map((point) => {
        const frozen = frozenByDate.get(point.date)
        const derived =
          view === 'metaPercent'
            ? metaPercent(point.value, frozen?.metaAtTime)
            : (() => {
                const factor = contributionFactor(
                  series.data.habit.type,
                  point.value,
                  frozen?.metaAtTime,
                  frozen?.bonusAtTime,
                  // O ponto EXISTE (estamos mapeando `points`): booleano com
                  // valor nulo é "não feito" ⇒ 0, nunca lacuna.
                  true,
                )
                return factor == null ? null : Math.round(factor * 100)
              })()
        return { ...point, value: derived == null ? null : String(derived) }
      }),
    }
  }, [series.data, rawView, frozenByDate])

  const selectedHabitType = series.data?.habit.type
  const availableViews = viewsFor(selectedHabitType)
  // Trocar de hábito numérico → booleano com `% da meta` ativa não deve deixar a
  // superfície numa visão que não se aplica ao hábito exibido.
  const effectiveView = availableViews.includes(rawView) ? rawView : 'value'

  const today = isoLocalToday()
  // O período mais recente é o que TERMINA hoje — não existe período futuro.
  const atLatestPeriod = range.end >= today

  function updateRange(next: { start: string; end: string }) {
    if (next.start > next.end) return
    // Teto DURO em hoje, aplicado no ponto único de escrita do intervalo: nem
    // `shiftPeriod` nem um chamador futuro conseguem passar disso.
    const end = next.end > today ? today : next.end
    const clamped = { start: next.start > end ? end : next.start, end }
    setRange(clamped)
    setSelectedDate((prev) => clampDate(prev, clamped.start, clamped.end))
  }

  function shiftPeriod(direction: -1 | 1) {
    if (direction === 1 && atLatestPeriod) return
    const span = DEFAULT_SPAN + 1
    // Avançando, o fim para em hoje e o início acompanha para preservar a
    // janela de 30 dias (senão o último período viria truncado sem motivo).
    const end = direction === 1 ? minDate(addDays(range.end, span), today) : addDays(range.end, -span)
    updateRange({ start: addDays(end, -DEFAULT_SPAN), end })
  }

  if (history.isPending) return <HabitsHistorySkeleton />

  const habits = history.data?.habits ?? []
  const detailDay = history.data?.days.find((day) => day.date === selectedDate)
  const dateFieldId = `habits-history-date-${reactId}`
  const habitFieldId = `habits-history-habit-${reactId}`
  const viewFieldId = `habits-history-view-${reactId}`
  const latestPeriodNoteId = `habits-history-latest-${reactId}`

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-4)' }}>
      {/* ── Intervalo ────────────────────────────────────────────────────── */}
      <Box
        sx={{
          ...BLOCK_SX,
          flexDirection: 'row',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: 'var(--ds-space-2)',
        }}
      >
        <Button onClick={() => shiftPeriod(-1)} sx={SECONDARY_BUTTON_SX}>
          ‹ Período anterior
        </Button>
        <Box
          sx={{
            ...typography.meta,
            color: 'var(--ds-ink-muted)',
            alignSelf: 'center',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatDateMediumBR(range.start)} a {formatDateMediumBR(range.end)} ·{' '}
          {DEFAULT_SPAN + 1} dias
        </Box>
        <Button
          onClick={() => shiftPeriod(1)}
          disabled={atLatestPeriod}
          aria-describedby={atLatestPeriod ? latestPeriodNoteId : undefined}
          sx={SECONDARY_BUTTON_SX}
        >
          Próximo período ›
        </Button>
        {atLatestPeriod && (
          <Box
            id={latestPeriodNoteId}
            role="note"
            sx={{ ...typography.meta, color: 'var(--ds-ink-muted)', alignSelf: 'center' }}
          >
            {LATEST_PERIOD_NOTE}
          </Box>
        )}
        <Box sx={{ marginLeft: 'auto', minWidth: 0 }}>
          <Field id={dateFieldId} label="Dia em detalhe">
            <input
              id={dateFieldId}
              type="date"
              value={selectedDate}
              min={range.start}
              max={range.end}
              aria-label={`Dia em detalhe: ${formatDateBR(selectedDate)}`}
              onChange={(event) =>
                setSelectedDate(clampDate(event.target.value, range.start, range.end))
              }
              style={controlStyle(false)}
            />
          </Field>
        </Box>
      </Box>

      {history.isError || !history.data ? (
        <BlockError onRetry={() => history.refetch()} />
      ) : (
        <>
          <DayDetail
            day={detailDay}
            date={selectedDate}
            onOpenForEdit={() => onOpenDayForEdit(selectedDate)}
          />

          {/* ── Evolução ─────────────────────────────────────────────────── */}
          <Box component="section" aria-labelledby={`habits-history-evolution-${reactId}`} sx={BLOCK_SX}>
            <Box
              component="h3"
              id={`habits-history-evolution-${reactId}`}
              sx={{ ...typography['section-title'], color: 'var(--ds-ink)', margin: 0 }}
            >
              Evolução por hábito
            </Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 14rem), 1fr))',
                gap: 'var(--ds-space-3)',
              }}
            >
              <Field id={habitFieldId} label="Hábito">
                <select
                  id={habitFieldId}
                  value={selectedHabitId}
                  onChange={(event) => setSelectedHabitId(event.target.value)}
                  style={controlStyle(false)}
                >
                  <option value="">Selecione um hábito</option>
                  {habits.map((habit) => (
                    <option key={habit.id} value={habit.id}>
                      {habit.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id={viewFieldId} label="Visão">
                <select
                  id={viewFieldId}
                  value={effectiveView}
                  onChange={(event) => setView(event.target.value as HabitSeriesView)}
                  style={controlStyle(false)}
                >
                  {availableViews.map((option) => (
                    <option key={option} value={option}>
                      {HABIT_SERIES_VIEW_LABEL[option]}
                    </option>
                  ))}
                </select>
              </Field>
            </Box>

            {selectedHabitId === '' ? (
              <Box sx={{ ...typography.body, color: 'var(--ds-ink-muted)' }}>
                {NO_HABIT_SELECTED}
              </Box>
            ) : series.isPending ? (
              <Box role="status" sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
                Carregando a série…
              </Box>
            ) : series.isError || !viewSeries ? (
              // A falha da SÉRIE não derruba a grade abaixo.
              <BlockError onRetry={() => series.refetch()} />
            ) : (
              <>
                <HabitEvolutionChart series={viewSeries} view={effectiveView} />
                {/* TABELA EQUIVALENTE PERMANENTE — nunca atrás de disclosure. */}
                <SeriesEquivalentTable series={viewSeries} view={effectiveView} />
              </>
            )}
          </Box>

          {/* ── Grade ────────────────────────────────────────────────────── */}
          <Box component="section" aria-labelledby={`habits-history-grid-${reactId}`} sx={BLOCK_SX}>
            <Box
              component="h3"
              id={`habits-history-grid-${reactId}`}
              sx={{ ...typography['section-title'], color: 'var(--ds-ink)', margin: 0 }}
            >
              Completude por hábito e período
            </Box>
            {history.data.habits.length === 0 ? (
              <Box sx={{ ...typography.body, color: 'var(--ds-ink-muted)' }}>{EMPTY_RANGE}</Box>
            ) : (
              <HabitCompletionGrid
                data={history.data}
                groups={groupsQuery.data ?? []}
                inactiveHabitIds={inactiveHabitIds}
                compact={compact}
              />
            )}
          </Box>
        </>
      )}
    </Box>
  )
}

/** Tabela equivalente do gráfico — mesma superfície, contraste normal. */
function SeriesEquivalentTable({
  series,
  view,
}: {
  series: HabitSeries
  view: HabitSeriesView
}) {
  const unit = view === 'value' ? (series.habit.unit ?? '') : '%'
  const pointByDate = new Map(series.points.map((point) => [point.date, point]))
  const dayTypes = series.dayTypes ?? []
  return (
    <Box component="table" sx={{ borderCollapse: 'collapse', width: '100%' }}>
      <Box
        component="caption"
        sx={{ ...typography.meta, color: 'var(--ds-ink-muted)', textAlign: 'left', pb: 'var(--ds-space-1)' }}
      >
        Tabela equivalente do gráfico — {series.habit.name},{' '}
        {HABIT_SERIES_VIEW_LABEL[view].toLowerCase()}. Permanente, não escondida atrás de botão.
      </Box>
      <thead>
        <tr>
          {['Data', 'Tipo de dia', 'Leitura'].map((header) => (
            <Box
              component="th"
              scope="col"
              key={header}
              sx={{
                ...typography.label,
                textAlign: 'left',
                p: 'var(--ds-space-1)',
                border: '1px solid var(--ds-border)',
                color: 'var(--ds-ink)',
              }}
            >
              {header}
            </Box>
          ))}
        </tr>
      </thead>
      <tbody>
        {dayTypes.map((dayType) => {
          const point = pointByDate.get(dayType.date)
          const reading =
            point == null || point.value == null
              ? NO_RECORD_DAY
              : `${formatDecimal(point.value)}${unit ? ` ${unit}` : ''}`
          return (
            <tr key={dayType.date}>
              <Box
                component="th"
                scope="row"
                sx={{
                  ...typography.meta,
                  textAlign: 'left',
                  p: 'var(--ds-space-1)',
                  border: '1px solid var(--ds-border)',
                  color: 'var(--ds-ink)',
                }}
              >
                {formatDateBR(dayType.date)}
              </Box>
              <Box
                component="td"
                sx={{ ...typography.meta, p: 'var(--ds-space-1)', border: '1px solid var(--ds-border)', color: 'var(--ds-ink)' }}
              >
                {DAY_TYPE_LABEL[dayType.dayType]}
              </Box>
              <Box
                component="td"
                sx={{ ...typography.meta, p: 'var(--ds-space-1)', border: '1px solid var(--ds-border)', color: 'var(--ds-ink)' }}
              >
                {reading}
              </Box>
            </tr>
          )
        })}
      </tbody>
    </Box>
  )
}
