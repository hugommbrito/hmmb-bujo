// ─────────────────────────────────────────────────────────────────────────────
// Painel diário/pool do Weekly Board (Story 14.5, AC1/AC7): header + contagem +
// lista com scroll interno próprio + criação contextual. Um ÚNICO componente
// serve os 7 dias e o pool "Sem dia definido" — a única diferença estrutural é
// `scheduledDate` (a data do dia, ou `null` para o pool).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, type KeyboardEvent } from 'react'
import { Box, IconButton } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

import { TaskRowBase } from '../TaskRowBase'
import { WeeklyRowOverflowMenu } from './WeeklyRowOverflowMenu'
import { typography } from '../../../../shared/design/tokens'
import type { CycleStatus, Task, TaskStatus } from '../../types'

export interface WeeklyTaskPanelProps {
  /** Nome acessível completo do painel (região) — ex. "Segunda-feira, 20 de
   * julho" ou "Sem dia definido". */
  regionLabel: string
  /** Título visual curto ("Segunda") ou "Sem dia definido". */
  heading: string
  /** "20 jul." nos painéis de dia; "pool semanal" no pool. */
  subheading?: string
  /** Link para o Daily Log — só nos painéis de dia. */
  dayLinkHref?: string
  tasks: Task[]
  cycleStatus: CycleStatus
  readonly?: boolean
  compact?: boolean
  createPlaceholder: string
  onOpenDetail: (taskId: string) => void
  onTransition?: (taskId: string, toStatus: TaskStatus) => void
  onCreate?: (title: string) => void
  /** Comando relativo (Mover acima/abaixo/para…) restrito aos irmãos DESTE
   * painel — ausente em `compact` (weekend-stack) e em `readonly`. */
  onReorder?: (taskId: string, targetTaskId: string, position: 'before' | 'after') => void
}

export function WeeklyTaskPanel({
  regionLabel,
  heading,
  subheading,
  dayLinkHref,
  tasks,
  cycleStatus,
  readonly = false,
  compact = false,
  createPlaceholder,
  onOpenDetail,
  onTransition,
  onCreate,
  onReorder,
}: WeeklyTaskPanelProps) {
  const [draftTitle, setDraftTitle] = useState('')
  const openCount = tasks.filter((task) => {
    const status = task.status ?? 'pending'
    return status === 'pending' || status === 'started'
  }).length

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
      component="section"
      aria-label={regionLabel}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        minWidth: 0,
        height: '100%',
        backgroundColor: 'var(--ds-surface)',
        border: '1px solid var(--ds-border)',
        borderRadius: 'var(--ds-radius-md)',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 'var(--ds-space-2)',
          padding: 'var(--ds-space-2)',
          borderBottom: '1px solid var(--ds-border)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 'var(--ds-space-2)', minWidth: 0 }}>
          <Box component="h3" sx={{ ...typography['section-title'], color: 'var(--ds-ink)', margin: 0 }}>
            {dayLinkHref ? (
              <Box component={RouterLink} to={dayLinkHref} sx={{ color: 'inherit', textDecoration: 'none' }}>
                {heading}
              </Box>
            ) : (
              heading
            )}
          </Box>
          {subheading && !compact && (
            <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>{subheading}</Box>
          )}
        </Box>
        <Box
          sx={{ ...typography.meta, color: 'var(--ds-ink-muted)', whiteSpace: 'nowrap' }}
          aria-label={`${openCount} tarefas abertas em ${regionLabel}`}
        >
          {openCount} abertas
        </Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 'var(--ds-space-1)' }}>
        {tasks.length === 0 ? (
          <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)', padding: 'var(--ds-space-2)' }}>
            Nenhuma tarefa.
          </Box>
        ) : (
          tasks.map((task, index) => (
            <TaskRowBase
              key={task.id}
              task={task}
              variant={readonly ? 'readonly' : compact ? 'compact' : 'full'}
              cycleStatus={cycleStatus}
              order={index + 1}
              onOpenDetail={onOpenDetail}
              onTransition={onTransition}
              trailingSlot={
                !readonly && !compact && onReorder ? (
                  <WeeklyRowOverflowMenu task={task} siblings={tasks} onReorder={onReorder} />
                ) : undefined
              }
            />
          ))
        )}
      </Box>

      {!readonly && onCreate && (
        <Box
          component="form"
          aria-label={`Adicionar tarefa em ${regionLabel}`}
          onSubmit={(event) => {
            event.preventDefault()
            submitCreate()
          }}
          sx={{ display: 'flex', gap: 'var(--ds-space-1)', padding: 'var(--ds-space-2)' }}
        >
          <input
            aria-label="Título"
            placeholder={createPlaceholder}
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            onKeyDown={handleTitleKeyDown}
            style={{
              ...typography.body,
              flex: 1,
              minWidth: 0,
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
            sx={{ color: 'var(--ds-primary)' }}
          >
            +
          </IconButton>
        </Box>
      )}
    </Box>
  )
}
