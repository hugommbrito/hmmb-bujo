// ─────────────────────────────────────────────────────────────────────────────
// Célula de dia do Monthly Board (Story 14.6, AC1/AC2/AC7) — cabeçalho com
// número/data (abre o Daily Log) + contagem textual + lista rolável de
// `TaskRowBase` variant `compact` + criação contextual.
//
//   ▶ `TaskRowBase` variant `compact` SEMPRE (AC2) — mesma variante do
//     weekend-stack da 14.5. Nunca `readonly`: o próprio `TaskRowBase` deriva
//     o comportamento somente-leitura de `cycleStatus === 'finalized'`, sem
//     precisar de uma variante própria.
//   ▶ Contagem textual segue o mesmo padrão do mockup (`key-monthly.html`):
//     "vazio" (0 tarefas), "N abertas" (nenhuma em estado terminal) ou
//     "N registros" (mistura com ao menos 1 estado terminal).
//   ▶ A região de tarefas é sempre `tabIndex=0` + `aria-label` com quantidade e
//     instrução de navegação (AC7) quando há tarefas — não há como medir
//     overflow real em jsdom/CSS de forma confiável, então o rótulo é sempre
//     oferecido (nunca incorreto, apenas às vezes desnecessário).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, type KeyboardEvent } from 'react'
import { Box, IconButton } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

import { TaskRowBase } from '../TaskRowBase'
import { typography } from '../../../../shared/design/tokens'
import type { CycleStatus, Task, TaskStatus } from '../../types'

const TERMINAL_STATUSES = new Set<TaskStatus>(['completed', 'cancelled', 'migrated', 'postponed'])

function countLabel(tasks: Task[]): string {
  const n = tasks.length
  if (n === 0) return 'vazio'
  const hasTerminal = tasks.some((task) => TERMINAL_STATUSES.has(task.status ?? 'pending'))
  if (hasTerminal) return `${n} ${n === 1 ? 'registro' : 'registros'}`
  return `${n} ${n === 1 ? 'aberta' : 'abertas'}`
}

export interface MonthlyDayCellProps {
  /** "AAAA-MM-DD" do dia desta célula. */
  date: string
  /** "12" — só o número do dia, para o cabeçalho compacto. */
  dayNumberLabel: string
  /** "12 de agosto de 2026" — para `aria-label="Abrir Daily Log de <data completa>"`. */
  fullDateLabel: string
  /** "12 de agosto" — para a instrução de rolagem (mesmo texto do mockup, sem ano). */
  dayMonthLabel: string
  tasks: Task[]
  cycleStatus: CycleStatus
  /** Mês `finalized` (AC3): sem criação — a leitura permanece via `TaskRowBase`. */
  readonly?: boolean
  isToday?: boolean
  onOpenDetail: (taskId: string) => void
  onTransition?: (taskId: string, toStatus: TaskStatus) => void
  onCreate?: (title: string) => void
}

export function MonthlyDayCell({
  date,
  dayNumberLabel,
  fullDateLabel,
  dayMonthLabel,
  tasks,
  cycleStatus,
  readonly = false,
  isToday = false,
  onOpenDetail,
  onTransition,
  onCreate,
}: MonthlyDayCellProps) {
  const [draftTitle, setDraftTitle] = useState('')

  function submitCreate() {
    const trimmed = draftTitle.trim()
    if (!trimmed || !onCreate) return
    onCreate(trimmed)
    setDraftTitle('')
  }

  function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') submitCreate()
  }

  return (
    <Box
      role="gridcell"
      data-date={date}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        gap: 'var(--ds-space-1)',
        padding: 'var(--ds-space-1)',
        backgroundColor: 'var(--ds-surface)',
        border: '1px solid var(--ds-border)',
        outline: isToday ? '2px solid var(--ds-info)' : 'none',
        outlineOffset: '-2px',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 'var(--ds-space-1)', flex: '0 0 auto' }}>
        <Box
          component={RouterLink}
          to={`/daily/${date}`}
          aria-label={`Abrir Daily Log de ${fullDateLabel}`}
          sx={{ ...typography['body-strong'], color: 'var(--ds-ink)', textDecoration: 'none' }}
        >
          {dayNumberLabel}
        </Box>
        <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)', whiteSpace: 'nowrap' }}>
          {countLabel(tasks)}
        </Box>
      </Box>

      <Box
        tabIndex={tasks.length > 0 ? 0 : undefined}
        aria-label={
          tasks.length > 0
            ? `${tasks.length} tarefa${tasks.length === 1 ? '' : 's'} em ${dayMonthLabel}; use as setas para rolar`
            : undefined
        }
        sx={{ flex: 1, minHeight: 0, overflow: 'auto', overscrollBehavior: 'contain' }}
      >
        {tasks.map((task) => (
          <TaskRowBase
            key={task.id}
            task={task}
            variant="compact"
            cycleStatus={cycleStatus}
            onOpenDetail={onOpenDetail}
            onTransition={onTransition}
          />
        ))}
      </Box>

      {!readonly && onCreate && (
        <Box
          component="form"
          aria-label={`Adicionar tarefa em ${dayMonthLabel}`}
          onSubmit={(event) => {
            event.preventDefault()
            submitCreate()
          }}
          sx={{ display: 'flex', gap: 'var(--ds-space-1)', flex: '0 0 auto' }}
        >
          <input
            aria-label="Título"
            placeholder="＋ Adicionar tarefa…"
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            onKeyDown={handleTitleKeyDown}
            style={{
              ...typography.meta,
              flex: 1,
              minWidth: 0,
              // `--ds-chip-height` (24px) — achado real do axe (`target-size`):
              // sem altura mínima, o input encolhe abaixo do alvo de toque
              // mínimo AA na célula compacta do calendário.
              minHeight: 'var(--ds-chip-height)',
              padding: 'var(--ds-space-1)',
              border: '1px solid var(--ds-control-border)',
              borderRadius: 'var(--ds-radius-sm)',
              background: 'var(--ds-surface)',
              color: 'var(--ds-ink)',
            }}
          />
          <IconButton
            type="submit"
            aria-label="Adicionar"
            size="small"
            sx={{
              color: 'var(--ds-primary)',
              // Sobrescreve o piso global de 44px (`theme.ts`, MuiIconButton)
              // para o alvo AA real de 24px (`--ds-chip-height`, WCAG 2.2
              // 2.5.8 Minimum) — achado real do axe: numa célula de calendário
              // de 7 colunas, os 44px globais não deixam espaço nenhum para o
              // input ao lado permanecer ≥24px (Story 14.6).
              minWidth: 'var(--ds-chip-height)',
              minHeight: 'var(--ds-chip-height)',
              padding: 0,
            }}
          >
            +
          </IconButton>
        </Box>
      )}
    </Box>
  )
}
