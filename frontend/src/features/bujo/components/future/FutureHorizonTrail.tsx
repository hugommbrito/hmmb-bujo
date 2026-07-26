// ─────────────────────────────────────────────────────────────────────────────
// Trilho do horizonte do Future Log (Story 14.7, AC1/AC7 — M08).
//
//   ▶ Os `futureBoard.horizonMonths` meses ficam SEMPRE visíveis, inclusive os
//     de contagem 0 — o horizonte é scaffolding, não resultado de query. Linha
//     omitida seria a única leitura errada possível aqui.
//   ▶ `nav` com nome acessível + `aria-current` no mês em foco; a contagem vai
//     em TEXTO, nunca só por chip colorido (AC7).
//   ▶ Mês vazio usa `--ds-ink-muted`, e NÃO o `{colors.ink-disabled}` que o
//     DESIGN.md L629 descreve: a 14.6 provou por axe que `--ds-ink-disabled`
//     sobre `--ds-surface-subtle` mede ~2,6:1 e reprova AA. O piso de
//     acessibilidade vence o token de estilo — divergência deliberada.
//   ▶ Compact: a mesma lista vira barra horizontal rolável (abreviação de 3
//     letras + contagem), sem scroll horizontal no CONTEÚDO da superfície.
// ─────────────────────────────────────────────────────────────────────────────
import { Box } from '@mui/material'

import { formatMonthTitle } from './futureHorizon'
import { MONTH_ABBREV_PT } from '../../monthNames'
import { typography } from '../../../../shared/design/tokens'
import type { FutureLogMonthCount } from '../../types'

export interface FutureHorizonTrailProps {
  months: readonly FutureLogMonthCount[]
  /** Mês da coluna de foco. Quando é um mês DISTANTE (fora do horizonte),
   * nenhuma linha fica selecionada — voltar é escolher qualquer linha (AC1). */
  focusedMonthFirst: string
  compact?: boolean
  onSelect: (monthFirst: string) => void
  /** Abre o seletor "Ir para mês…" (popover no desktop, sheet em compact). */
  onOpenMonthPicker: () => void
}

function countLabel(taskCount: number): string {
  return taskCount === 1 ? '1 item' : `${taskCount} itens`
}

export function FutureHorizonTrail({
  months,
  focusedMonthFirst,
  compact = false,
  onSelect,
  onOpenMonthPicker,
}: FutureHorizonTrailProps) {
  if (compact) {
    return (
      <Box
        component="nav"
        aria-label="Meses do horizonte"
        sx={{
          display: 'flex',
          gap: 'var(--ds-space-1)',
          overflowX: 'auto',
          alignItems: 'stretch',
          pb: 'var(--ds-space-1)',
        }}
      >
        {months.map((month) => {
          const selected = month.monthFirst === focusedMonthFirst
          return (
            <Box
              key={month.monthFirst}
              component="button"
              type="button"
              aria-current={selected ? 'true' : undefined}
              aria-label={`${formatMonthTitle(month.monthFirst)}, ${countLabel(month.taskCount)}`}
              onClick={() => onSelect(month.monthFirst)}
              sx={{
                ...typography.label,
                flex: '0 0 auto',
                minWidth: 'var(--ds-touch-target-min)',
                minHeight: 'var(--ds-touch-target-min)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--ds-space-1)',
                padding: 'var(--ds-space-1) var(--ds-space-2)',
                border: '1px solid var(--ds-control-border)',
                borderRadius: 'var(--ds-radius-sm)',
                backgroundColor: selected ? 'var(--ds-primary)' : 'var(--ds-surface)',
                color: selected
                  ? 'var(--ds-on-primary)'
                  : month.taskCount === 0
                    ? 'var(--ds-ink-muted)'
                    : 'var(--ds-ink)',
                cursor: 'pointer',
              }}
            >
              <Box component="span" aria-hidden>
                {MONTH_ABBREV_PT[Number(month.monthFirst.slice(5, 7)) - 1]}
              </Box>
              <Box component="span" aria-hidden sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {month.taskCount}
              </Box>
            </Box>
          )
        })}
        <Box
          component="button"
          type="button"
          onClick={onOpenMonthPicker}
          sx={{
            ...typography.label,
            flex: '0 0 auto',
            minHeight: 'var(--ds-touch-target-min)',
            padding: 'var(--ds-space-1) var(--ds-space-2)',
            border: '1px solid var(--ds-control-border)',
            borderRadius: 'var(--ds-radius-sm)',
            backgroundColor: 'var(--ds-surface)',
            color: 'var(--ds-ink)',
            cursor: 'pointer',
          }}
        >
          Ir para mês…
        </Box>
      </Box>
    )
  }

  return (
    <Box
      component="nav"
      aria-label="Meses do horizonte"
      sx={{
        width: 'var(--ds-future-board-trail-width)',
        flex: '0 0 var(--ds-future-board-trail-width)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--ds-space-1)',
        minHeight: 0,
      }}
    >
      <Box sx={{ ...typography.label, color: 'var(--ds-ink-muted)', px: 'var(--ds-space-1)' }}>
        Horizonte · {months.length} meses
      </Box>
      <Box
        component="ul"
        sx={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--ds-space-1)',
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
        }}
      >
        {months.map((month) => {
          const selected = month.monthFirst === focusedMonthFirst
          return (
            <Box component="li" key={month.monthFirst}>
              <Box
                component="button"
                type="button"
                aria-current={selected ? 'true' : undefined}
                onClick={() => onSelect(month.monthFirst)}
                sx={{
                  ...typography.body,
                  width: '100%',
                  minHeight: 'var(--ds-touch-target-min)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--ds-space-2)',
                  textAlign: 'left',
                  padding: 'var(--ds-space-1) var(--ds-space-2)',
                  border: '1px solid var(--ds-control-border)',
                  borderRadius: 'var(--ds-radius-sm)',
                  backgroundColor: selected ? 'var(--ds-primary-soft)' : 'var(--ds-surface)',
                  color:
                    month.taskCount === 0 && !selected ? 'var(--ds-ink-muted)' : 'var(--ds-ink)',
                  cursor: 'pointer',
                }}
              >
                <Box component="span">{formatMonthTitle(month.monthFirst)}</Box>
                <Box component="span" sx={{ ...typography.label, fontVariantNumeric: 'tabular-nums' }}>
                  {countLabel(month.taskCount)}
                </Box>
              </Box>
            </Box>
          )
        })}
      </Box>
      <Box
        component="button"
        type="button"
        onClick={onOpenMonthPicker}
        sx={{
          ...typography.label,
          minHeight: 'var(--ds-touch-target-min)',
          padding: 'var(--ds-space-1) var(--ds-space-2)',
          border: '1px solid var(--ds-control-border)',
          borderRadius: 'var(--ds-radius-sm)',
          backgroundColor: 'var(--ds-surface)',
          color: 'var(--ds-ink)',
          cursor: 'pointer',
        }}
      >
        Ir para mês…
      </Box>
    </Box>
  )
}
