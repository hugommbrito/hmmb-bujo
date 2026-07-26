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
//
//   ▶ ESTENDIDO NO LUGAR pela Story 14.7 (M08), nunca forkado: três props
//     OPCIONAIS, todas com default que reproduz o comportamento da 14.6 byte a
//     byte (`MonthlyDestinationPicker.test.tsx` passa sem uma linha alterada).
//     A Story 14.9 provavelmente estende de novo — as abas previstas lá são
//     "Esta semana · Dia no mês · Outro mês", superconjunto das duas daqui.
//     Promover o componente a `components/` compartilhado com nome neutro é
//     decisão natural da 14.9 (Questão aberta #3 da 14.7), não desta story.
//
//   ▶ O mês-alvo é CONTROLADO pelo pai quando `selectableMonths` é passado
//     (`targetMonthFirst` + `onTargetMonthChange`). É o que preserva a
//     assinatura de `onConfirm(scheduledDate)` intacta: o pai já sabe para
//     qual mês está confirmando porque é ele quem detém esse estado.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState, type KeyboardEvent } from 'react'
import { Box, Drawer } from '@mui/material'

import { isoOf, lastDayOfMonth } from '../../../../shared/date'
import { capitalize, MONTH_NAMES_PT } from '../../monthNames'
import { shellCssVariables, typography } from '../../../../shared/design/tokens'

/** Seleção armada, na forma que o rótulo nomeado da 14.7 consome. */
export interface MonthlyDestinationSelection {
  /** "AAAA-MM-01" do mês em foco no momento da confirmação. */
  monthFirst: string
  /** `null` = "Sem dia definido". */
  scheduledDate: string | null
}

export interface MonthlyDestinationPickerProps {
  /** "AAAA-MM-01" do mês-ALVO do ritual. */
  targetMonthFirst: string
  compact?: boolean
  /** Falha da última confirmação (AC5): preserva alvo armado — o seletor não
   * fecha sozinho no erro. */
  error?: string | null
  onConfirm: (scheduledDate: string | null) => void
  onClose: () => void
  /**
   * Story 14.7, AC4 — aba "Outro mês": meses "AAAA-MM-01" para os quais o
   * destino pode ser retargetado (os 8 do horizonte + os distantes com item).
   * Ausente/vazia = sem aba, exatamente a composição da 14.6.
   */
  selectableMonths?: readonly string[]
  /** Chamado ao escolher outro mês na aba. O pai atualiza `targetMonthFirst`,
   * e a grade de dias se retarga (o dia armado é descartado — 31 não existe em
   * todo mês). */
  onTargetMonthChange?: (monthFirst: string) => void
  /**
   * Story 14.7, AC4 — rótulo NOMEADO do ato ("Datar em 14 de agosto", "Mover
   * para setembro de 2026", "Manter sem dia definido"), aplicado ao próprio
   * botão de confirmação. Ausente = o par "texto + `Confirmar`" da 14.6.
   */
  confirmLabelFor?: (selection: MonthlyDestinationSelection) => string
}

const UNDATED = 'undated' as const

export function MonthlyDestinationPicker({
  targetMonthFirst,
  compact = false,
  error = null,
  onConfirm,
  onClose,
  selectableMonths,
  onTargetMonthChange,
  confirmLabelFor,
}: MonthlyDestinationPickerProps) {
  const lastDay = lastDayOfMonth(targetMonthFirst)
  const [year, month] = targetMonthFirst.split('-').map(Number)
  const [armed, setArmed] = useState<number | typeof UNDATED | null>(null)
  const [tab, setTab] = useState<'day' | 'month'>('day')

  // O mês-alvo muda sem remontar o componente (o pai só troca a prop), então o
  // dia armado precisa de reset EXPLÍCITO: `useState` sobrevive à troca de
  // prop, e um "18" armado em agosto viraria um 18 de fevereiro silencioso —
  // pior, um "31" armado sobreviveria a um mês de 30 dias.
  useEffect(() => {
    setArmed(null)
  }, [targetMonthFirst])

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
    if (confirmLabelFor) {
      return confirmLabelFor({
        monthFirst: targetMonthFirst,
        scheduledDate: armed === UNDATED ? null : isoForDay(armed),
      })
    }
    if (armed === UNDATED) return 'Sem dia definido'
    return `Migrar para ${armed} de ${MONTH_NAMES_PT[month - 1]}`
  }

  const monthLabel = `${capitalize(MONTH_NAMES_PT[month - 1])} de ${year}`
  const otherMonths = selectableMonths ?? []
  const hasMonthTab = otherMonths.length > 0
  const showDayGrid = !hasMonthTab || tab === 'day'

  function monthOptionLabel(monthFirstIso: string): string {
    const [optionYear, optionMonth] = monthFirstIso.split('-').map(Number)
    return `${capitalize(MONTH_NAMES_PT[optionMonth - 1])} de ${optionYear}`
  }

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

      {hasMonthTab && (
        <Box role="tablist" aria-label="Tipo de destino" sx={{ display: 'flex', gap: 'var(--ds-space-1)' }}>
          <DestinationTab
            selected={tab === 'day'}
            label={`Dia em ${MONTH_NAMES_PT[month - 1]}`}
            onSelect={() => setTab('day')}
          />
          <DestinationTab selected={tab === 'month'} label="Outro mês" onSelect={() => setTab('month')} />
        </Box>
      )}

      {hasMonthTab && tab === 'month' && (
        <Box
          role="listbox"
          aria-label="Meses de destino"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--ds-space-1)',
            maxHeight: '40vh',
            overflowY: 'auto',
          }}
        >
          {otherMonths.map((monthFirstIso) => (
            <Box
              key={monthFirstIso}
              component="button"
              type="button"
              role="option"
              aria-selected={monthFirstIso === targetMonthFirst}
              onClick={() => {
                onTargetMonthChange?.(monthFirstIso)
                setTab('day')
              }}
              sx={{
                ...typography.body,
                textAlign: 'left',
                minHeight: 'var(--ds-touch-target-min)',
                padding: 'var(--ds-space-2)',
                border: '1px solid var(--ds-control-border)',
                borderRadius: 'var(--ds-radius-sm)',
                backgroundColor:
                  monthFirstIso === targetMonthFirst ? 'var(--ds-primary-soft)' : 'var(--ds-surface)',
                color: 'var(--ds-ink)',
                cursor: 'pointer',
              }}
            >
              {monthOptionLabel(monthFirstIso)}
            </Box>
          ))}
        </Box>
      )}

      {showDayGrid && (
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
      )}

      {showDayGrid && (
      <Box
        role="grid"
        aria-label={`Dias de ${monthLabel}`}
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(var(--ds-monthly-board-columns), minmax(0, 1fr))',
          gap: 'var(--ds-space-1)',
        }}
      >
        {/* `role="row"` OBRIGATÓRIO entre `grid` e `gridcell` — achado real do axe
            (`aria-required-children` + `aria-required-parent`, ambos CRITICAL),
            exposto pelo gate de 5 faixas da Story 14.7 com o seletor ABERTO (a
            14.6 nunca mediu este componente aberto). `display: contents` mantém a
            grade CSS byte a byte: a linha some do layout e só existe na árvore de
            acessibilidade. Uma linha só, porque a grade aqui é uma faixa de dias
            corridos, não um calendário semanal. */}
        <Box role="row" sx={{ display: 'contents' }}>
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
      </Box>
      )}

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
          {/* Sem `confirmLabelFor` (14.6): o par "texto + botão `Confirmar`".
              Com ele (14.7, AC4): o PRÓPRIO botão leva o nome do ato — nunca um
              "Confirmar" genérico —, e o texto separado sai para não duplicar o
              rótulo no leitor de tela. */}
          {!confirmLabelFor && (
            <Box sx={{ ...typography.body, color: 'var(--ds-ink)' }}>{confirmationLabel()}</Box>
          )}
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
              padding: 'var(--ds-space-1) var(--ds-space-2)',
              cursor: 'pointer',
            }}
          >
            {confirmLabelFor ? confirmationLabel() : 'Confirmar'}
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

function DestinationTab({
  selected,
  label,
  onSelect,
}: {
  selected: boolean
  label: string
  onSelect: () => void
}) {
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
