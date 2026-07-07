import { useState } from 'react'
import { Box, Chip, IconButton, Typography, useMediaQuery } from '@mui/material'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import TaskAltIcon from '@mui/icons-material/TaskAlt'
import CancelIcon from '@mui/icons-material/Cancel'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight'
import type { Task, TaskStatus } from '../types'

const STATUS_ICON: Record<TaskStatus, typeof RadioButtonUncheckedIcon> = {
  pending: RadioButtonUncheckedIcon,
  started: HourglassEmptyIcon,
  completed: TaskAltIcon,
  cancelled: CancelIcon,
  migrated: ArrowForwardIcon,
  postponed: KeyboardDoubleArrowRightIcon,
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'Pendente',
  started: 'Em andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
  migrated: 'Migrada',
  postponed: 'Adiada',
}

// Só pending/started/completed participam do ciclo de clique nesta story —
// migrated/postponed/cancelled chegam via Fluxo de Migração/menu (fora de escopo).
const NEXT_STATUS: Partial<Record<TaskStatus, TaskStatus>> = {
  pending: 'started',
  started: 'completed',
  completed: 'pending',
}

const STATUS_CHIP_LABEL: Partial<Record<TaskStatus, string>> = {
  started: 'Iniciada',
  completed: 'Feita',
}

function eisenhowerChipInfo(eisenhower: Task['eisenhower']) {
  if (eisenhower === 'ui') return { label: 'U+I', key: 'ui' as const, textColor: '#FFFFFF' }
  if (eisenhower === 'u') return { label: 'U', key: 'u' as const, textColor: '#FFFFFF' }
  if (eisenhower === 'i') return { label: 'I', key: 'i' as const, textColor: '#1A1612' }
  return null
}

interface TaskRowProps {
  task: Task
  onTransition: (taskId: string, toStatus: TaskStatus) => void
}

export function TaskRow({ task, onTransition }: TaskRowProps) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [announcement, setAnnouncement] = useState('')

  const status = task.status ?? 'pending'
  const StatusIcon = STATUS_ICON[status]
  const nextStatus = NEXT_STATUS[status]
  const statusChipLabel = STATUS_CHIP_LABEL[status]
  const eisenhowerChip = eisenhowerChipInfo(task.eisenhower)
  const category = task.category || null

  function handleStatusClick() {
    if (!nextStatus) return
    onTransition(task.id, nextStatus)
    setAnnouncement(`Tarefa marcada como ${STATUS_LABEL[nextStatus]}`)
  }

  return (
    <Box
      data-testid="task-row"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        minHeight: isMobile ? 44 : 36,
        borderLeft: '3px solid',
        borderLeftColor: (theme) =>
          category ? theme.palette.category[category] : theme.palette.divider,
        pl: 1,
        pr: 1.5,
        position: 'relative',
      }}
    >
      <IconButton
        size="small"
        aria-label={STATUS_LABEL[status]}
        onClick={handleStatusClick}
        disabled={!nextStatus}
        sx={{ color: status === 'completed' ? (theme) => theme.palette.category.green : 'text.secondary' }}
      >
        <StatusIcon fontSize="small" />
      </IconButton>
      <Typography
        variant="body2"
        sx={{
          flex: 1,
          textDecoration: status === 'cancelled' ? 'line-through' : 'none',
          color: status === 'completed' ? 'text.disabled' : 'text.primary',
        }}
      >
        {task.title}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {eisenhowerChip && (
          <Chip
            label={eisenhowerChip.label}
            size="small"
            sx={{
              bgcolor: (theme) => theme.palette.priority[eisenhowerChip.key],
              color: eisenhowerChip.textColor,
              fontWeight: 600,
              fontSize: '11px',
              height: 18,
            }}
          />
        )}
        {statusChipLabel && (
          <Chip
            label={statusChipLabel}
            size="small"
            variant="outlined"
            sx={{
              borderColor: (theme) => theme.palette.category[status === 'started' ? 'yellow' : 'green'],
              color: (theme) => theme.palette.category[status === 'started' ? 'yellow' : 'green'],
              height: 18,
            }}
          />
        )}
      </Box>
      <Box
        role="status"
        aria-live="polite"
        sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}
      >
        {announcement}
      </Box>
    </Box>
  )
}
