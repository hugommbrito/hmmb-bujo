// ─────────────────────────────────────────────────────────────────────────────
// Seletor de destino do ritual (Story 14.5, AC5/Task 9) — 8 alvos (`1`–`7` +
// `0`), contagem de densidade por alvo, confirmação NOMEADA sem modal
// adicional (desktop inline; compact em sheet). `0` (Sem dia) fica
// indisponível com motivo quando a semana-alvo não é a corrente (lacuna B7:
// `migrate` com `destination: 'week'` sem `scheduledDate` cairia na semana
// CORRENTE, não na semana-alvo — nunca mandar em silêncio para a semana errada).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { Box, Drawer } from '@mui/material'

import { useWeeklyDensityQuery } from '../../api'
import { useKeyboardShortcuts } from '../../../../shared/hooks/useKeyboardShortcuts'
import { addDaysIso, formatDayLabel } from '../../../../shared/date'
import { shellCssVariables, typography } from '../../../../shared/design/tokens'

export interface WeeklyDestinationPickerProps {
  /** Segunda-feira da semana-ALVO do ritual (nunca a semana corrente por
   * suposição — vem de `readiness.planning.weekStart`). */
  weekStart: string
  /** A semana-alvo É a semana corrente? Decide a disponibilidade do alvo `0`. */
  isCurrentWeek: boolean
  compact?: boolean
  /** Falha da última confirmação (AC5): preserva alvo armado/foco — o
   * seletor NÃO fecha sozinho no erro, então "Tentar novamente" é
   * literalmente reconfirmar o mesmo destino já nomeado. */
  error?: string | null
  onConfirm: (scheduledDate: string | null) => void
  onClose: () => void
}

const DIGIT_KEYS = ['1', '2', '3', '4', '5', '6', '7'] as const

export function WeeklyDestinationPicker({
  weekStart,
  isCurrentWeek,
  compact = false,
  error = null,
  onConfirm,
  onClose,
}: WeeklyDestinationPickerProps) {
  const density = useWeeklyDensityQuery(weekStart)
  const [armedIndex, setArmedIndex] = useState<number | null>(null)
  const firstOptionRef = useRef<HTMLElement | null>(null)

  const days = Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i))
  const UNDATED_INDEX = 7

  useEffect(() => {
    firstOptionRef.current?.focus()
  }, [])

  function selectTarget(index: number) {
    if (index === UNDATED_INDEX && !isCurrentWeek) return
    setArmedIndex(index)
  }

  function confirm() {
    if (armedIndex === null) return
    if (armedIndex === UNDATED_INDEX && !isCurrentWeek) return
    onConfirm(armedIndex === UNDATED_INDEX ? null : days[armedIndex])
  }

  const shortcutHandlers = Object.fromEntries([
    ...DIGIT_KEYS.map((digit, index) => [digit, () => selectTarget(index)]),
    ['0', () => selectTarget(UNDATED_INDEX)],
    ['Enter', () => confirm()],
    ['Escape', () => onClose()],
  ])
  useKeyboardShortcuts(shortcutHandlers)

  function confirmationLabel(): string {
    if (armedIndex === null) return ''
    if (armedIndex === UNDATED_INDEX) return 'Sem dia definido'
    return `Migrar para ${formatDayLabel(days[armedIndex], 'weekday').toLowerCase()}, ${formatDayLabel(days[armedIndex], 'day-month')}`
  }

  const content = (
    <Box
      role="dialog"
      aria-label="Escolher destino"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--ds-space-2)',
        padding: 'var(--ds-space-3)',
      }}
    >
      <Box sx={{ ...typography['section-title'], color: 'var(--ds-ink)' }}>Escolher destino</Box>
      <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
        Atalhos: 1–7 escolhem o dia · 0 deixa sem data · Enter confirma.
      </Box>
      <Box role="radiogroup" aria-label="Destino" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
        {days.map((date, index) => {
          const dayTotal = density.data?.days[index]?.total
          return (
            <Box
              key={date}
              ref={index === 0 ? firstOptionRef : undefined}
              component="button"
              type="button"
              role="radio"
              aria-checked={armedIndex === index}
              tabIndex={index === 0 ? 0 : -1}
              onClick={() => selectTarget(index)}
              sx={{
                ...typography.body,
                textAlign: 'left',
                padding: 'var(--ds-space-2)',
                border: '1px solid var(--ds-control-border)',
                borderRadius: 'var(--ds-radius-sm)',
                backgroundColor: armedIndex === index ? 'var(--ds-primary-soft)' : 'var(--ds-surface)',
                color: 'var(--ds-ink)',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>
                {index + 1} {formatDayLabel(date, 'weekday')}
              </span>
              {dayTotal !== undefined && (
                <span aria-label={`${dayTotal} registros`} style={{ color: 'var(--ds-ink-muted)' }}>
                  {dayTotal}
                </span>
              )}
            </Box>
          )
        })}
        <Box
          component="button"
          type="button"
          role="radio"
          aria-checked={armedIndex === UNDATED_INDEX}
          aria-disabled={!isCurrentWeek}
          aria-label={
            isCurrentWeek
              ? '0 Sem dia'
              : '0 Sem dia — indisponível: a semana-alvo não é a semana corrente'
          }
          onClick={() => selectTarget(UNDATED_INDEX)}
          sx={{
            ...typography.body,
            textAlign: 'left',
            padding: 'var(--ds-space-2)',
            border: '1px solid var(--ds-control-border)',
            borderRadius: 'var(--ds-radius-sm)',
            backgroundColor: armedIndex === UNDATED_INDEX ? 'var(--ds-primary-soft)' : 'var(--ds-surface)',
            color: isCurrentWeek ? 'var(--ds-ink)' : 'var(--ds-ink-disabled)',
            cursor: isCurrentWeek ? 'pointer' : 'not-allowed',
          }}
        >
          0 Sem dia
        </Box>
      </Box>

      {armedIndex !== null && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-2)' }}>
          <Box sx={{ ...typography.body, color: 'var(--ds-ink)' }}>{confirmationLabel()}</Box>
          <Box
            component="button"
            type="button"
            onClick={confirm}
            sx={{
              ...typography.label,
              backgroundColor: 'var(--ds-primary)',
              color: 'var(--ds-on-primary)',
              border: 'none',
              borderRadius: 'var(--ds-radius-sm)',
              padding: 'var(--ds-space-1) var(--ds-space-2)',
              cursor: 'pointer',
            }}
          >
            Confirmar
          </Box>
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
