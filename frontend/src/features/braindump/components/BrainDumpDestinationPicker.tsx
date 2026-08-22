// ─────────────────────────────────────────────────────────────────────────────
// "Mover" — seletor de destino do Brain Dump (Story 15.1 — M11).
//
//   ▶ Reusa a ANATOMIA do seletor de destino do ritual de migração (M10,
//     `DestinationPicker.tsx`): calendário de densidade (`MonthDensityCalendar`
//     + `useTaskDensityQuery`), `useKeyboardShortcuts` (Enter confirma, Escape
//     fecha), ação primária NOMEADA pelo destino/dia escolhido, atalho "Sem dia
//     definido" sempre alcançável. NÃO importa nem altera `DestinationPicker.tsx`
//     — a spec bloqueia mudar o comportamento hoje ativo do consumidor real
//     (`MigrationRitualPage`), e a anatomia exigida aqui diverge o bastante
//     (radiogroup de 4 destinos NOMEADOS — Hoje/Esta Semana/Este Mês/Futuro —
//     no lugar das 3 abas Esta semana/Dia no mês/Outro mês) para justificar um
//     componente novo que só reusa as PEÇAS internas (Block If da spec).
//   ▶ Ícones/rótulos do radiogroup vêm de `shellDestinations.ts`/`navIcons.tsx`
//     (fonte única, só leitura) — os MESMOS da navegação lateral
//     (`calendar-dot`/`calendar-dots`/`calendar`/`calendar-plus`).
//   ▶ Pré-seleciona a opção de `item.targetLog` (AC da spec) SEM mover o item
//     sozinho — a pré-seleção só marca o radio; confirmar continua sendo um
//     ato explícito do usuário.
//   ▶ `scheduled_date` é REAL aqui (diferente do legado, que nunca a exercia):
//     Esta Semana/Este Mês aceitam dia escolhido OU "Sem dia definido"; Futuro
//     exige mês (`input type="month"` nativo) e recusa o mês corrente
//     (I/O Matrix da spec — "Este Mês atende o mês corrente").
//   ▶ Confirma via `useProcessBrainDumpItemMutation` (já existe, sem mudança).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { Box, Button, Dialog, Drawer } from '@mui/material'

import { useProcessBrainDumpItemMutation } from '../api'
import { MonthDensityCalendar, useTaskDensityQuery, useTodayLogQuery } from '../../bujo'
import { navIconFor, type NavIconKey } from '../../../app/layout/shell/navIcons'
import { deriveShellNavItems, flattenDestinations } from '../../../app/layout/shell/shellDestinations'
import { useKeyboardShortcuts } from '../../../shared/hooks/useKeyboardShortcuts'
import { addDaysIso, formatDayLabel, mondayIsoOf } from '../../../shared/date'
import { shellCssVariables, typography } from '../../../shared/design/tokens'
import type { BrainDumpItem, BrainDumpTargetLog } from '../types'

const RADIO_DESTINATIONS: ReadonlyArray<{ destination: BrainDumpTargetLog; navKey: NavIconKey }> = [
  { destination: 'today', navKey: 'today' },
  { destination: 'week', navKey: 'planner-week' },
  { destination: 'month', navKey: 'planner-month' },
  { destination: 'future', navKey: 'planner-future' },
]

// Rótulos canônicos derivados do MESMO registro que alimenta a navegação
// lateral (fonte única — nunca duplicar o vocabulário).
const NAV_LABEL_BY_KEY = new Map(
  flattenDestinations(deriveShellNavItems()).map((dest) => [dest.key, dest.label]),
)
function labelFor(navKey: NavIconKey): string {
  return NAV_LABEL_BY_KEY.get(navKey) ?? navKey
}

function currentMonthFirstOf(logDate: string): string {
  return `${logDate.slice(0, 7)}-01`
}

function monthLabelOf(monthFirst: string): string {
  const [year, month] = monthFirst.split('-').map(Number)
  const name = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(year, month - 1, 1))
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${year}`
}

function dayMonthLabelOf(iso: string): string {
  const day = Number(iso.slice(8, 10))
  const [year, month] = iso.slice(0, 7).split('-').map(Number)
  const name = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(year, month - 1, 1))
  return `${day} de ${name}`
}

const FUTURE_MONTH_CURRENT_ERROR = "Este Mês atende o mês corrente — escolha essa opção ao lado."

const CONTROL_SX = {
  minHeight: 'var(--ds-touch-target-min)',
  border: '1px solid var(--ds-control-border)',
  borderRadius: 'var(--ds-radius-sm)',
  backgroundColor: 'var(--ds-surface)',
  color: 'var(--ds-ink)',
  cursor: 'pointer',
} as const

const CONTROL_SELECTED_SX = {
  border: '2px solid var(--ds-primary)',
  backgroundColor: 'var(--ds-primary-soft)',
  color: 'var(--ds-primary)',
  fontWeight: 700,
} as const

/** Cor EXPLÍCITA (achado real do axe em stories anteriores): o `primary` do
 * tema MUI é o teal de marca, abaixo de AA sobre `--ds-surface`. */
const RETRY_BUTTON_SX = {
  minHeight: 'var(--ds-touch-target-min)',
  backgroundColor: 'var(--ds-primary)',
  color: 'var(--ds-on-primary)',
  '&:hover': { backgroundColor: 'var(--ds-primary-hover)' },
} as const

const TODAY_READ_ERROR = 'Não foi possível carregar as datas de referência.'

export interface BrainDumpDestinationPickerProps {
  item: BrainDumpItem
  compact?: boolean
  disabled?: boolean
  onClose: () => void
}

export function BrainDumpDestinationPicker({
  item,
  compact = false,
  disabled = false,
  onClose,
}: BrainDumpDestinationPickerProps) {
  // `|| null`: `item.targetLog` no schema gerado é `TargetLogEnum | BlankEnum |
  // NullEnum | null` — o DRF serializa o campo opcional como STRING VAZIA
  // (`BlankEnum`), não só como `null`. `''` não é um destino selecionável, e
  // deixá-lo entrar no estado marcaria um radio inexistente; a guarda de
  // veracidade colapsa vazio/nulo no mesmo "nada pré-selecionado" (mesmo
  // tratamento de `brainDumpMetaLineOf` em `BrainDumpInboxItemRow`).
  const [destination, setDestination] = useState<BrainDumpTargetLog | null>(item.targetLog || null)
  // `undefined` = nenhum dia armado ainda (confirmar indisponível); `null` =
  // "Sem dia definido" (ato explícito); string = dia escolhido.
  const [scheduledDate, setScheduledDate] = useState<string | null | undefined>(undefined)
  const [futureMonth, setFutureMonth] = useState('') // "AAAA-MM"
  const [writeError, setWriteError] = useState<string | null>(null)

  const todayLog = useTodayLogQuery()
  const processItem = useProcessBrainDumpItemMutation()

  const todayIso = todayLog.data?.logDate
  const currentMonthFirst = todayIso ? currentMonthFirstOf(todayIso) : null
  const weekStart = todayIso ? mondayIsoOf(todayIso) : null
  const weekDays = weekStart ? Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i)) : []

  const futureMonthFirst = /^\d{4}-\d{2}$/.test(futureMonth) ? `${futureMonth}-01` : null
  // Derivado a cada render (nunca guardado em estado próprio): `currentMonthFirst`
  // só fica disponível depois que `useTodayLogQuery` resolve, e um valor
  // calculado no momento do `onChange` ficaria PRESO ao "ainda não carregou"
  // se o usuário digitar o mês antes da resposta chegar.
  const futureMonthError =
    futureMonthFirst && currentMonthFirst && futureMonthFirst === currentMonthFirst
      ? FUTURE_MONTH_CURRENT_ERROR
      : null
  const activeMonthFirst = destination === 'month' ? currentMonthFirst : futureMonthFirst

  const density = useTaskDensityQuery(activeMonthFirst ?? undefined, {
    enabled: Boolean(activeMonthFirst) && (destination === 'month' || destination === 'future'),
  })
  const densityByDate = new Map((density.data ?? []).map((entry) => [entry.date, entry.count]))

  function selectDestination(next: BrainDumpTargetLog) {
    setDestination(next)
    setScheduledDate(undefined)
  }

  function selectUndated() {
    setScheduledDate(null)
  }

  function selectDay(iso: string) {
    setScheduledDate(iso)
  }

  function handleFutureMonthChange(value: string) {
    setFutureMonth(value)
    setScheduledDate(undefined)
  }

  function isConfirmable(): boolean {
    if (!destination) return false
    if (destination === 'today') return true
    if (destination === 'week' || destination === 'month') return scheduledDate !== undefined
    // 'future'
    return Boolean(futureMonthFirst) && !futureMonthError && scheduledDate !== undefined
  }

  function confirmLabel(): string {
    if (destination === 'today') return 'Mover para hoje'
    if (destination === 'week') {
      if (!scheduledDate) return 'Mover sem dia definido (esta semana)'
      return `Mover para ${formatDayLabel(scheduledDate, 'weekday').toLowerCase()}, ${dayMonthLabelOf(scheduledDate)}`
    }
    if (destination === 'month') {
      if (!scheduledDate) return 'Mover sem dia definido (este mês)'
      return `Mover para ${dayMonthLabelOf(scheduledDate)}`
    }
    if (destination === 'future') {
      if (!futureMonthFirst) return 'Mover'
      if (!scheduledDate) return `Mover sem dia definido (${monthLabelOf(futureMonthFirst).toLowerCase()})`
      return `Mover para ${dayMonthLabelOf(scheduledDate)} de ${futureMonthFirst.slice(0, 4)}`
    }
    return 'Mover'
  }

  function confirm() {
    if (!isConfirmable() || !destination || disabled || processItem.isPending) return
    setWriteError(null)
    processItem.mutate(
      {
        itemId: item.id,
        destination,
        monthFirst: destination === 'future' ? (futureMonthFirst ?? undefined) : undefined,
        scheduledDate: destination === 'today' ? undefined : scheduledDate,
      },
      {
        onSuccess: onClose,
        onError: () => setWriteError('Não foi possível mover o item. Tente novamente.'),
      },
    )
  }

  useKeyboardShortcuts({
    Enter: confirm,
    Escape: onClose,
  })

  // `role="dialog"`/`aria-label` só no CONTEÚDO quando a faixa é compact
  // (Drawer): MUI Drawer não estampa `role="dialog"` sozinho, diferente de
  // MUI Dialog (que já estampa `role="dialog"` + `aria-modal` no próprio
  // Paper) — duplicar aqui para o Dialog criaria dois `role="dialog"`
  // aninhados, o de fora sem nome acessível (achado de review). O Dialog
  // recebe o nome via `slotProps.paper['aria-label']` mais abaixo.
  const content = (
    <Box
      {...(compact ? { role: 'dialog' as const, 'aria-label': 'Para onde mover este item?' } : {})}
      sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-3)', padding: 'var(--ds-space-3)' }}
    >
      <Box component="header" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--ds-space-2)' }}>
        <Box>
          <Box component="h2" sx={{ ...typography['section-title'], color: 'var(--ds-ink)', margin: 0 }}>
            Para onde mover este item?
          </Box>
          <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>{item.title}</Box>
        </Box>
        <Button
          onClick={onClose}
          aria-label="Fechar"
          sx={{ minWidth: 'var(--ds-touch-target-min)', minHeight: 'var(--ds-touch-target-min)', color: 'var(--ds-ink-muted)' }}
        >
          ×
        </Button>
      </Box>

      <Box
        role="radiogroup"
        aria-label="Selecionar log de destino"
        sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--ds-space-1)' }}
      >
        {RADIO_DESTINATIONS.map(({ destination: option, navKey }) => {
          const selected = destination === option
          return (
            <Box
              key={option}
              component="button"
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => selectDestination(option)}
              sx={{
                ...CONTROL_SX,
                ...(selected && CONTROL_SELECTED_SX),
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--ds-space-1)',
                padding: 'var(--ds-space-2)',
                ...typography.meta,
              }}
            >
              {navIconFor(navKey, selected ? 'fill' : 'regular')}
              {labelFor(navKey)}
            </Box>
          )
        })}
      </Box>

      {/* `useTodayLogQuery` é a autoridade de "hoje"/mês/semana corrente
          (Convenção #8) — só Esta Semana/Este Mês/Futuro dependem dela
          (Hoje é resolvido no servidor, sem precisar de `todayIso` aqui).
          Loading/erro SEMPRE visíveis onde o dia-a-escolher apareceria (achado
          de review: nunca silencioso — sem isto o formulário ficava com o
          seletor de dia simplesmente ausente, sem explicação). */}
      {(destination === 'week' || destination === 'month' || destination === 'future') &&
        (todayLog.isPending ? (
          <Box role="status" sx={{ ...typography.body, color: 'var(--ds-ink-muted)' }}>
            Carregando…
          </Box>
        ) : todayLog.isError ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-2)', alignItems: 'flex-start' }}>
            <Box role="alert" sx={{ ...typography.body, color: 'var(--ds-ink)' }}>
              {TODAY_READ_ERROR}
            </Box>
            <Button onClick={() => todayLog.refetch()} sx={RETRY_BUTTON_SX}>
              Tentar de novo
            </Button>
          </Box>
        ) : null)}

      {destination === 'week' && weekStart && !todayLog.isPending && !todayLog.isError && (
        <Box role="radiogroup" aria-label={`Dias de ${formatDayLabel(weekStart, 'day-month')} a ${formatDayLabel(weekDays[6], 'day-month')}`} sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'var(--ds-space-1)' }}>
          {weekDays.map((iso) => {
            const selected = scheduledDate === iso
            const isToday = iso === todayIso
            return (
              <Box
                key={iso}
                component="button"
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                aria-label={`${formatDayLabel(iso, 'weekday')}, ${dayMonthLabelOf(iso)}${isToday ? ', hoje' : ''}`}
                onClick={() => selectDay(iso)}
                sx={{
                  ...CONTROL_SX,
                  ...(selected && CONTROL_SELECTED_SX),
                  ...(isToday && !selected && { borderColor: 'var(--ds-info)' }),
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 'var(--ds-space-1)',
                  ...typography.meta,
                }}
              >
                {formatDayLabel(iso, 'weekday-short-day')}
              </Box>
            )
          })}
        </Box>
      )}

      {destination === 'month' && currentMonthFirst && !todayLog.isPending && !todayLog.isError && (
        <MonthDensityCalendar
          monthFirst={currentMonthFirst}
          densityByDate={densityByDate}
          selectedDate={scheduledDate ?? null}
          onSelectDay={disabled ? undefined : selectDay}
        />
      )}

      {destination === 'future' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
          <Box component="label" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
            <span style={{ ...typography.label }}>Mês</span>
            <input
              aria-label="Mês"
              type="month"
              disabled={disabled}
              value={futureMonth}
              onChange={(event) => handleFutureMonthChange(event.target.value)}
              aria-describedby={futureMonthError ? 'brain-dump-future-month-error' : undefined}
              style={{
                ...typography.body,
                padding: 'var(--ds-space-2)',
                border: '1px solid var(--ds-control-border)',
                borderRadius: 'var(--ds-radius-sm)',
                background: 'var(--ds-surface)',
                color: 'var(--ds-ink)',
                minHeight: 'var(--ds-touch-target-min)',
              }}
            />
          </Box>
          {futureMonthError && (
            <Box id="brain-dump-future-month-error" role="alert" sx={{ ...typography.meta, color: 'var(--ds-danger)' }}>
              {futureMonthError}
            </Box>
          )}
          {futureMonthFirst && !futureMonthError && !todayLog.isPending && !todayLog.isError && (
            <MonthDensityCalendar
              monthFirst={futureMonthFirst}
              densityByDate={densityByDate}
              selectedDate={scheduledDate ?? null}
              onSelectDay={disabled ? undefined : selectDay}
            />
          )}
        </Box>
      )}

      {(destination === 'week' || destination === 'month' || (destination === 'future' && futureMonthFirst)) && (
        <Box
          component="button"
          type="button"
          aria-pressed={scheduledDate === null}
          disabled={disabled}
          onClick={selectUndated}
          sx={{ ...CONTROL_SX, ...(scheduledDate === null && CONTROL_SELECTED_SX), ...typography.body }}
        >
          Sem dia definido
        </Box>
      )}

      {isConfirmable() && (
        <Button
          onClick={confirm}
          disabled={disabled || processItem.isPending}
          sx={{
            ...typography.label,
            minHeight: 'var(--ds-touch-target-min)',
            backgroundColor: 'var(--ds-primary)',
            color: 'var(--ds-on-primary)',
            '&:hover': { backgroundColor: 'var(--ds-primary-hover)' },
            '&.Mui-disabled': { backgroundColor: 'var(--ds-surface-subtle)', color: 'var(--ds-ink-muted)' },
          }}
        >
          {confirmLabel()}
        </Button>
      )}

      {writeError && (
        <Box role="alert" sx={{ ...typography.meta, color: 'var(--ds-danger)' }}>
          {writeError}
        </Box>
      )}
    </Box>
  )

  if (compact) {
    return (
      <Drawer
        anchor="bottom"
        open
        onClose={onClose}
        slotProps={{
          paper: {
            style: shellCssVariables('light'),
            sx: { padding: 'var(--ds-space-2)', maxHeight: '88vh', overflowY: 'auto' },
          },
        }}
      >
        {content}
      </Drawer>
    )
  }

  return (
    <Dialog
      open
      onClose={onClose}
      slotProps={{
        paper: {
          'aria-label': 'Para onde mover este item?',
          style: shellCssVariables('light'),
          sx: {
            width: 'min(420px, 90vw)',
            backgroundColor: 'var(--ds-surface)',
            border: '1px solid var(--ds-border)',
            borderRadius: 'var(--ds-radius-md)',
            '& :focus-visible': { outline: '2px solid var(--ds-focus)', outlineOffset: '2px' },
          },
        },
      }}
    >
      {content}
    </Dialog>
  )
}
