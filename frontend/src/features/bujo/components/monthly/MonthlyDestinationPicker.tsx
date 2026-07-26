// ─────────────────────────────────────────────────────────────────────────────
// Seletor de destino do ritual MENSAL (Story 14.6, AC5) — distinto do
// `WeeklyDestinationPicker` (14.5): calendário navegável por setas (dia
// anterior/próximo, não semana) + entrada direta do número do dia,
// sincronizados, validando 28–31 dias reais do mês-alvo (incl. bissexto).
// **Sem dia definido** é opção explícita. `Enter` confirma só a ação final
// nomeada (ex. "Migrar para 18 de agosto de 2026").
//
//   ▶ Não reusa `useKeyboardShortcuts` (Questão aberta #… já resolvida no
//     Dev Notes da story): a interação de teclado aqui é digitar num
//     `<input type="number">` de verdade, não atalhos globais de tecla única
//     — o guard de INPUT/TEXTAREA daquele hook existe para IGNORAR exatamente
//     esse caso, então usá-lo aqui seria contraproducente.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, type KeyboardEvent } from 'react'
import { Box, Drawer } from '@mui/material'

import { isoOf, lastDayOfMonth } from '../../../../shared/date'
import { capitalize, MONTH_NAMES_PT } from '../../monthNames'
import { shellCssVariables, typography } from '../../../../shared/design/tokens'

export interface MonthlyDestinationPickerProps {
  /** "AAAA-MM-01" do mês-ALVO do ritual. */
  targetMonthFirst: string
  compact?: boolean
  /** Falha da última confirmação (AC5): preserva alvo armado — o seletor não
   * fecha sozinho no erro. */
  error?: string | null
  onConfirm: (scheduledDate: string | null) => void
  onClose: () => void
}

const UNDATED = 'undated' as const

export function MonthlyDestinationPicker({
  targetMonthFirst,
  compact = false,
  error = null,
  onConfirm,
  onClose,
}: MonthlyDestinationPickerProps) {
  const lastDay = lastDayOfMonth(targetMonthFirst)
  const [year, month] = targetMonthFirst.split('-').map(Number)
  const [armed, setArmed] = useState<number | typeof UNDATED | null>(null)

  function isoForDay(day: number): string {
    return isoOf(new Date(year, month - 1, day))
  }

  function selectDay(day: number) {
    if (day < 1 || day > lastDay) return
    setArmed(day)
  }

  function step(delta: number) {
    const base = typeof armed === 'number' ? armed : 1
    selectDay(base + delta)
  }

  function confirm() {
    if (armed === null) return
    onConfirm(armed === UNDATED ? null : isoForDay(armed))
  }

  function handleContainerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      confirm()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  function confirmationLabel(): string {
    if (armed === null) return ''
    if (armed === UNDATED) return 'Sem dia definido'
    return `Migrar para ${armed} de ${MONTH_NAMES_PT[month - 1]}`
  }

  const monthLabel = `${capitalize(MONTH_NAMES_PT[month - 1])} de ${year}`

  const content = (
    <Box
      role="dialog"
      aria-label="Escolher destino"
      onKeyDown={handleContainerKeyDown}
      sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-2)', padding: 'var(--ds-space-3)' }}
    >
      <Box sx={{ ...typography['section-title'], color: 'var(--ds-ink)' }}>Escolher destino em {monthLabel}</Box>
      <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
        Setas navegam dia a dia · digite o número do dia · Enter confirma.
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-1)' }}>
        <Box
          component="button"
          type="button"
          aria-label="Dia anterior"
          onClick={() => step(-1)}
          sx={{ ...typography.body, border: '1px solid var(--ds-control-border)', borderRadius: 'var(--ds-radius-sm)', background: 'var(--ds-surface)', cursor: 'pointer' }}
        >
          ‹
        </Box>
        <input
          aria-label="Número do dia"
          type="number"
          min={1}
          max={lastDay}
          value={typeof armed === 'number' ? armed : ''}
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
          onClick={() => step(1)}
          sx={{ ...typography.body, border: '1px solid var(--ds-control-border)', borderRadius: 'var(--ds-radius-sm)', background: 'var(--ds-surface)', cursor: 'pointer' }}
        >
          ›
        </Box>
      </Box>

      <Box
        role="grid"
        aria-label={`Dias de ${monthLabel}`}
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(var(--ds-monthly-board-columns), minmax(0, 1fr))',
          gap: 'var(--ds-space-1)',
        }}
      >
        {Array.from({ length: lastDay }, (_, index) => index + 1).map((day) => (
          <Box
            key={day}
            component="button"
            type="button"
            role="gridcell"
            aria-current={armed === day ? 'true' : undefined}
            onClick={() => selectDay(day)}
            sx={{
              ...typography.meta,
              padding: 'var(--ds-space-1)',
              border: '1px solid var(--ds-control-border)',
              borderRadius: 'var(--ds-radius-sm)',
              backgroundColor: armed === day ? 'var(--ds-primary-soft)' : 'var(--ds-surface)',
              color: 'var(--ds-ink)',
              cursor: 'pointer',
            }}
          >
            {day}
          </Box>
        ))}
      </Box>

      <Box
        component="button"
        type="button"
        aria-pressed={armed === UNDATED}
        onClick={() => setArmed(UNDATED)}
        sx={{
          ...typography.body,
          textAlign: 'left',
          padding: 'var(--ds-space-2)',
          border: '1px solid var(--ds-control-border)',
          borderRadius: 'var(--ds-radius-sm)',
          backgroundColor: armed === UNDATED ? 'var(--ds-primary-soft)' : 'var(--ds-surface)',
          color: 'var(--ds-ink)',
          cursor: 'pointer',
        }}
      >
        Sem dia definido
      </Box>

      {armed !== null && (
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
