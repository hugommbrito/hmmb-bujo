// ─────────────────────────────────────────────────────────────────────────────
// Seletor de destino COMPARTILHADO (Story 14.9, M10) — promovido a partir da
// intenção já documentada em `monthly/MonthlyDestinationPicker.tsx` (:15-21):
// "as abas previstas são Esta semana · Dia no mês · Outro mês, superconjunto
// das duas daqui". Único consumidor por ora: `MigrationRitualPage` — as três
// superfícies mais antigas (`WeeklyPlanningPage`/`MonthlyPlanningPage`/
// `FutureBoardPage`) continuam com `WeeklyDestinationPicker`/
// `MonthlyDestinationPicker` intocados (comportamento e testes JÁ provados,
// sem motivo para reabrir o risco de regressão de uma migração de call-site
// que esta story não exige — `unified-migration-queue.spec.ts`/
// `migration-flow.spec.ts` continuam sendo a prova de que o fluxo legado
// segue existindo). A ANATOMIA (abas, grade de dias com entrada direta,
// listbox de "Outro mês", radiogroup de dias da semana, atalhos de teclado)
// é a mesma dos dois pickers mais antigos — reusada aqui, não reinventada.
//
//   ▶ 3 abas, cada uma OPCIONAL por composição de props: `week` (radiogroup de
//     dias da semana corrente, molde `WeeklyDestinationPicker`), `month`
//     (grade de dias + entrada direta do mês em foco, molde
//     `MonthlyDestinationPicker`) e, DENTRO de `month`, "Outro mês" quando
//     `selectableMonths` tem itens (mesma extensão aditiva da Story 14.7). Só
//     a aba "Esta semana" some quando `week` está ausente; abrir SEM nenhuma
//     das duas é erro de uso do chamador (a Migração sempre passa as duas).
//   ▶ Atalhos NOVOS do mockup (`key-migracao.html`, frame C): "Hoje" e "Sem
//     dia definido" no rodapé, TAB-AGNÓSTICOS (aparecem sob qualquer aba
//     ativa) — ausentes nos dois pickers anteriores.
//   ▶ `onConfirm(scheduledDate, meta)` — `meta.kind` diz ao chamador qual
//     `destination` do `POST /migrate/` usar (`'today'`→`destination:'today'`;
//     `'week'`→`'week'`; `'month'`→`'month'` ou `'future'`, a depender de
//     `meta.monthFirst` bater com o mês corrente — decisão do CHAMADOR, este
//     componente não conhece o conceito de "mês corrente"). Uma função com
//     MENOS parâmetros continua atribuível a este tipo (JS/TS padrão) — não é
//     breaking change para um eventual consumidor que só leia `scheduledDate`.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { Box, Drawer } from '@mui/material'

import { addDaysIso, formatDayLabel, isoOf, lastDayOfMonth } from '../../../shared/date'
import { capitalize, MONTH_NAMES_PT } from '../monthNames'
import { useKeyboardShortcuts } from '../../../shared/hooks/useKeyboardShortcuts'
import { shellCssVariables, typography } from '../../../shared/design/tokens'

export interface DestinationConfirmMeta {
  kind: 'today' | 'week' | 'month'
  /** "AAAA-MM-01" do mês relevante à decisão — o mês da data escolhida (abas
   * "Esta semana"/"Hoje") ou o mês em foco na grade/"Outro mês". Informativo:
   * o chamador decide `destination:'month'` vs `'future'` comparando com o
   * mês corrente, que este componente não conhece. */
  monthFirst: string
}

export interface DestinationSelection extends DestinationConfirmMeta {
  scheduledDate: string | null
}

export interface DestinationPickerProps {
  /** Aba "Esta semana" — segunda-feira da semana-alvo (a Migração sempre usa
   * a semana CORRENTE). Ausente = a aba não existe. */
  week?: { weekStart: string }
  /** Abas "Dia no mês"/"Outro mês" — mês em foco no momento. Ausente = só
   * "Esta semana" existe. */
  month?: {
    targetMonthFirst: string
    /** "Outro mês" só existe com >0 itens aqui. */
    selectableMonths?: readonly string[]
    onTargetMonthChange?: (monthFirst: string) => void
  }
  /** Atalho "Hoje" no rodapé (mockup, frame C) — ausente = atalho não existe. */
  todayIso?: string
  compact?: boolean
  error?: string | null
  onConfirm: (scheduledDate: string | null, meta: DestinationConfirmMeta) => void
  onClose: () => void
  confirmLabelFor?: (selection: DestinationSelection) => string
}

type Tab = 'week' | 'day' | 'other-month'

type Armed =
  | { kind: 'today' }
  | { kind: 'week'; index: number }
  | { kind: 'day'; day: number }
  | { kind: 'undated' }
  | null

const WEEKDAY_KEYS = ['1', '2', '3', '4', '5', '6', '7'] as const

export function DestinationPicker({
  week,
  month,
  todayIso,
  compact = false,
  error = null,
  onConfirm,
  onClose,
  confirmLabelFor,
}: DestinationPickerProps) {
  const hasOtherMonthTab = Boolean(month?.selectableMonths?.length)
  const [tab, setTab] = useState<Tab>(week ? 'week' : 'day')
  const [armed, setArmed] = useState<Armed>(null)

  const weekDays = week ? Array.from({ length: 7 }, (_, i) => addDaysIso(week.weekStart, i)) : []

  const lastDay = month ? lastDayOfMonth(month.targetMonthFirst) : 0
  const [monthYear, monthMonth] = month ? month.targetMonthFirst.split('-').map(Number) : [0, 0]

  function isoForDay(day: number): string {
    return isoOf(new Date(monthYear, monthMonth - 1, day))
  }

  function selectWeekday(index: number) {
    if (index < 0 || index > 6) return
    setArmed({ kind: 'week', index })
  }

  function selectDay(day: number) {
    if (!month || day < 1 || day > lastDay) return
    setArmed({ kind: 'day', day })
  }

  function stepDay(delta: number) {
    const base = armed?.kind === 'day' ? armed.day : 1
    selectDay(base + delta)
  }

  function selectToday() {
    if (!todayIso) return
    setArmed({ kind: 'today' })
  }

  function selectUndated() {
    setArmed({ kind: 'undated' })
  }

  function selectOtherMonth(monthFirstIso: string) {
    month?.onTargetMonthChange?.(monthFirstIso)
    setTab('day')
    setArmed(null)
  }

  function currentSelection(): DestinationSelection | null {
    if (!armed) return null
    if (armed.kind === 'today') {
      return { kind: 'today', scheduledDate: todayIso ?? null, monthFirst: (todayIso ?? '').slice(0, 7) + '-01' }
    }
    if (armed.kind === 'week') {
      const scheduledDate = weekDays[armed.index]
      return { kind: 'week', scheduledDate, monthFirst: `${scheduledDate.slice(0, 7)}-01` }
    }
    if (armed.kind === 'day') {
      return { kind: 'month', scheduledDate: isoForDay(armed.day), monthFirst: month!.targetMonthFirst }
    }
    // 'undated' — o container depende da aba ativa no momento da confirmação.
    if (tab === 'week' && week) {
      return { kind: 'week', scheduledDate: null, monthFirst: `${week.weekStart.slice(0, 7)}-01` }
    }
    return { kind: 'month', scheduledDate: null, monthFirst: month?.targetMonthFirst ?? '' }
  }

  function confirm() {
    const selection = currentSelection()
    if (!selection) return
    const { scheduledDate, ...meta } = selection
    onConfirm(scheduledDate, meta)
  }

  const shortcutHandlers: Record<string, () => void> = {
    Enter: confirm,
    Escape: onClose,
  }
  if (week) {
    for (const [index, key] of WEEKDAY_KEYS.entries()) {
      shortcutHandlers[key] = () => {
        if (tab === 'week') selectWeekday(index)
      }
    }
  }
  useKeyboardShortcuts(shortcutHandlers)

  function confirmationLabel(selection: DestinationSelection): string {
    if (confirmLabelFor) return confirmLabelFor(selection)
    if (selection.kind === 'today') return 'Migrar para hoje'
    if (!selection.scheduledDate) return 'Sem dia definido'
    if (selection.kind === 'week') {
      return `Migrar para ${formatDayLabel(selection.scheduledDate, 'weekday').toLowerCase()}, ${formatDayLabel(selection.scheduledDate, 'day-month')}`
    }
    const day = Number(selection.scheduledDate.slice(8, 10))
    return `Migrar para ${day} de ${MONTH_NAMES_PT[monthMonth - 1]}`
  }

  const monthLabel = month ? `${capitalize(MONTH_NAMES_PT[monthMonth - 1])} de ${monthYear}` : ''
  const selection = currentSelection()

  const content = (
    <Box
      role="dialog"
      aria-label="Escolher destino"
      sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-2)', padding: 'var(--ds-space-3)' }}
    >
      <Box sx={{ ...typography['section-title'], color: 'var(--ds-ink)' }}>Escolher destino</Box>

      {(Number(Boolean(week)) + Number(Boolean(month)) + Number(hasOtherMonthTab)) > 1 && (
        <Box role="tablist" aria-label="Tipo de destino" sx={{ display: 'flex', gap: 'var(--ds-space-1)' }}>
          {week && <DestinationTab selected={tab === 'week'} label="Esta semana" onSelect={() => setTab('week')} />}
          {month && <DestinationTab selected={tab === 'day'} label="Dia no mês" onSelect={() => setTab('day')} />}
          {hasOtherMonthTab && (
            <DestinationTab selected={tab === 'other-month'} label="Outro mês" onSelect={() => setTab('other-month')} />
          )}
        </Box>
      )}

      {tab === 'week' && week && (
        <Box role="radiogroup" aria-label="Dia da semana" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
          {weekDays.map((date, index) => (
            <Box
              key={date}
              component="button"
              type="button"
              role="radio"
              aria-checked={armed?.kind === 'week' && armed.index === index}
              onClick={() => selectWeekday(index)}
              sx={{
                ...typography.body,
                textAlign: 'left',
                padding: 'var(--ds-space-2)',
                border: '1px solid var(--ds-control-border)',
                borderRadius: 'var(--ds-radius-sm)',
                backgroundColor: armed?.kind === 'week' && armed.index === index ? 'var(--ds-primary-soft)' : 'var(--ds-surface)',
                color: 'var(--ds-ink)',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>
                {index + 1} {formatDayLabel(date, 'weekday')}
              </span>
            </Box>
          ))}
        </Box>
      )}

      {tab === 'other-month' && month && (
        <Box
          role="listbox"
          aria-label="Meses de destino"
          sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)', maxHeight: '40vh', overflowY: 'auto' }}
        >
          {(month.selectableMonths ?? []).map((monthFirstIso) => {
            const [optionYear, optionMonth] = monthFirstIso.split('-').map(Number)
            return (
              <Box
                key={monthFirstIso}
                component="button"
                type="button"
                role="option"
                aria-selected={monthFirstIso === month.targetMonthFirst}
                onClick={() => selectOtherMonth(monthFirstIso)}
                sx={{
                  ...typography.body,
                  textAlign: 'left',
                  minHeight: 'var(--ds-touch-target-min)',
                  padding: 'var(--ds-space-2)',
                  border: '1px solid var(--ds-control-border)',
                  borderRadius: 'var(--ds-radius-sm)',
                  backgroundColor: monthFirstIso === month.targetMonthFirst ? 'var(--ds-primary-soft)' : 'var(--ds-surface)',
                  color: 'var(--ds-ink)',
                  cursor: 'pointer',
                }}
              >
                {`${capitalize(MONTH_NAMES_PT[optionMonth - 1])} de ${optionYear}`}
              </Box>
            )
          })}
        </Box>
      )}

      {tab === 'day' && month && (
        <>
          <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>{monthLabel}</Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-1)' }}>
            <Box
              component="button"
              type="button"
              aria-label="Dia anterior"
              onClick={() => stepDay(-1)}
              sx={{ ...typography.body, border: '1px solid var(--ds-control-border)', borderRadius: 'var(--ds-radius-sm)', background: 'var(--ds-surface)', cursor: 'pointer' }}
            >
              ‹
            </Box>
            <input
              aria-label="Número do dia"
              type="number"
              min={1}
              max={lastDay}
              value={armed?.kind === 'day' ? armed.day : ''}
              onChange={(event) => {
                const value = Number(event.target.value)
                if (Number.isFinite(value) && value >= 1) selectDay(Math.min(value, lastDay))
              }}
              style={{
                ...typography.body,
                width: '64px',
                padding: 'var(--ds-space-1)',
                border: '1px solid var(--ds-control-border)',
                borderRadius: 'var(--ds-radius-sm)',
                background: 'var(--ds-surface)',
                color: 'var(--ds-ink)',
              }}
            />
            <Box
              component="button"
              type="button"
              aria-label="Próximo dia"
              onClick={() => stepDay(1)}
              sx={{ ...typography.body, border: '1px solid var(--ds-control-border)', borderRadius: 'var(--ds-radius-sm)', background: 'var(--ds-surface)', cursor: 'pointer' }}
            >
              ›
            </Box>
          </Box>
          <Box
            role="grid"
            aria-label={`Dias de ${monthLabel}`}
            sx={{ display: 'grid', gridTemplateColumns: 'repeat(var(--ds-monthly-board-columns), minmax(0, 1fr))', gap: 'var(--ds-space-1)' }}
          >
            <Box role="row" sx={{ display: 'contents' }}>
              {Array.from({ length: lastDay }, (_, index) => index + 1).map((day) => (
                <Box
                  key={day}
                  component="button"
                  type="button"
                  role="gridcell"
                  aria-current={armed?.kind === 'day' && armed.day === day ? 'true' : undefined}
                  onClick={() => selectDay(day)}
                  sx={{
                    ...typography.meta,
                    padding: 'var(--ds-space-1)',
                    border: '1px solid var(--ds-control-border)',
                    borderRadius: 'var(--ds-radius-sm)',
                    backgroundColor: armed?.kind === 'day' && armed.day === day ? 'var(--ds-primary-soft)' : 'var(--ds-surface)',
                    color: 'var(--ds-ink)',
                    cursor: 'pointer',
                  }}
                >
                  {day}
                </Box>
              ))}
            </Box>
          </Box>
        </>
      )}

      <Box sx={{ display: 'flex', gap: 'var(--ds-space-2)' }}>
        {todayIso && (
          <Box
            component="button"
            type="button"
            aria-pressed={armed?.kind === 'today'}
            onClick={selectToday}
            sx={{
              ...typography.body,
              flex: 1,
              minHeight: 'var(--ds-touch-target-min)',
              padding: 'var(--ds-space-2)',
              border: '1px solid var(--ds-control-border)',
              borderRadius: 'var(--ds-radius-sm)',
              backgroundColor: armed?.kind === 'today' ? 'var(--ds-primary-soft)' : 'var(--ds-surface)',
              color: 'var(--ds-ink)',
              cursor: 'pointer',
            }}
          >
            Hoje
          </Box>
        )}
        <Box
          component="button"
          type="button"
          aria-pressed={armed?.kind === 'undated'}
          onClick={selectUndated}
          sx={{
            ...typography.body,
            flex: 1,
            minHeight: 'var(--ds-touch-target-min)',
            padding: 'var(--ds-space-2)',
            border: '1px solid var(--ds-control-border)',
            borderRadius: 'var(--ds-radius-sm)',
            backgroundColor: armed?.kind === 'undated' ? 'var(--ds-primary-soft)' : 'var(--ds-surface)',
            color: 'var(--ds-ink)',
            cursor: 'pointer',
          }}
        >
          Sem dia definido
        </Box>
      </Box>

      {selection && (
        <Box
          component="button"
          type="button"
          onClick={confirm}
          sx={{
            ...typography.label,
            minHeight: 'var(--ds-touch-target-min)',
            backgroundColor: 'var(--ds-primary)',
            color: 'var(--ds-on-primary)',
            border: 'none',
            borderRadius: 'var(--ds-radius-sm)',
            padding: 'var(--ds-space-2)',
            cursor: 'pointer',
          }}
        >
          {confirmationLabel(selection)}
        </Box>
      )}

      {error && (
        <Box role="alert" sx={{ ...typography.meta, color: 'var(--ds-danger)' }}>
          {error}
        </Box>
      )}
    </Box>
  )

  if (!compact) return content

  return (
    <Drawer
      anchor="bottom"
      open
      onClose={onClose}
      slotProps={{
        paper: {
          style: shellCssVariables('light'),
          sx: {
            padding: 'var(--ds-space-2)',
            '& :focus-visible': { outline: '2px solid var(--ds-focus)', outlineOffset: '2px' },
          },
        },
        backdrop: { style: shellCssVariables('light') },
      }}
    >
      {content}
    </Drawer>
  )
}

function DestinationTab({ selected, label, onSelect }: { selected: boolean; label: string; onSelect: () => void }) {
  return (
    <Box
      component="button"
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      sx={{
        ...typography.label,
        minHeight: 'var(--ds-touch-target-min)',
        padding: 'var(--ds-space-1) var(--ds-space-2)',
        border: '1px solid var(--ds-control-border)',
        borderRadius: 'var(--ds-radius-sm)',
        backgroundColor: selected ? 'var(--ds-primary)' : 'var(--ds-surface)',
        color: selected ? 'var(--ds-on-primary)' : 'var(--ds-ink)',
        cursor: 'pointer',
      }}
    >
      {label}
    </Box>
  )
}
