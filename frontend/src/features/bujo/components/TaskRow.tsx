import { useRef, useState, type DragEvent } from 'react'
import { Box, Chip, IconButton, Typography, useMediaQuery } from '@mui/material'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import TaskAltIcon from '@mui/icons-material/TaskAlt'
import CancelIcon from '@mui/icons-material/Cancel'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined'
import { MoveTaskDialog } from './MoveTaskDialog'
import { TaskDestinationDialog } from './TaskDestinationDialog'
import type { Task, TaskStatus } from '../types'

// Long-press ≥500ms (EXPERIENCE.md §6.2) — abaixo disso é um toque comum.
const LONG_PRESS_MS = 500

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
  // Opcionais: Weekly/Monthly Log (Story 4.1) reusam `TaskRow` somente-leitura
  // (só a prop `task`) — migração/transição a partir dessas superfícies é
  // escopo das Stories 4.2/4.3.
  onTransition?: (taskId: string, toStatus: TaskStatus) => void
  onOpenDetail?: (taskId: string) => void
  siblings?: Task[]
  onReorder?: (taskId: string, targetTaskId: string, position: 'before' | 'after') => void
  isSubtask?: boolean
}

export function TaskRow({
  task,
  onTransition,
  onOpenDetail,
  siblings,
  onReorder,
  isSubtask = false,
}: TaskRowProps) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [announcement, setAnnouncement] = useState('')
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after' | null>(null)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [destinationDialogOpen, setDestinationDialogOpen] = useState(false)
  const longPressTimer = useRef<number | null>(null)

  const status = task.status ?? 'pending'
  const StatusIcon = STATUS_ICON[status]
  const nextStatus = NEXT_STATUS[status]
  const statusChipLabel = STATUS_CHIP_LABEL[status]
  // Linhagem de migração (Story 4.6 AC#2): `migration_count` é consultável.
  // > 0 significa "esta tarefa já foi carregada N vezes até aqui" — o sinal
  // clássico do BuJo de tarefa que vive escapando. Exibido em qualquer status
  // (uma pending com count alto é justamente o que se quer enxergar).
  const migrationCount = task.migrationCount ?? 0
  const eisenhowerChip = eisenhowerChipInfo(task.eisenhower)
  const category = task.category || null
  const subtasks = task.subtasks ?? []
  const isReorderable = Boolean(onReorder)

  function handleStatusClick() {
    if (!nextStatus || !onTransition) return
    onTransition(task.id, nextStatus)
    setAnnouncement(`Tarefa marcada como ${STATUS_LABEL[nextStatus]}`)
  }

  function handleDragStart(event: DragEvent<HTMLDivElement>) {
    event.dataTransfer.setData('text/plain', task.id)
    event.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const isTopHalf = event.clientY - rect.top < rect.height / 2
    setDragOverPosition(isTopHalf ? 'before' : 'after')
  }

  function handleDragLeave() {
    setDragOverPosition(null)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const draggedId = event.dataTransfer.getData('text/plain')
    if (draggedId !== task.id) {
      onReorder!(draggedId, task.id, dragOverPosition ?? 'after')
    }
    setDragOverPosition(null)
  }

  function handleDragEnd() {
    setDragOverPosition(null)
  }

  function clearLongPressTimer() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function handleTouchStart() {
    if (!isMobile || !isReorderable) return
    longPressTimer.current = window.setTimeout(() => setMoveDialogOpen(true), LONG_PRESS_MS)
  }

  return (
    // AC5: cards de superfície larga (Daily/Mês/"Sem dia") capam e centralizam
    // para aproximar chips/ações do título; nas colunas estreitas da grade da
    // Semana (< maxWidth) o cap é inerte (no-op). Subtarefas fluem dentro do
    // bloco já limitado do pai — sem centralização aninhada (gate !isSubtask).
    <Box sx={{ width: '100%', maxWidth: isSubtask ? 'none' : 720, mx: isSubtask ? 0 : 'auto' }}>
      <Box
        data-testid="task-row"
        draggable={isReorderable && !isMobile}
        onDragStart={isReorderable && !isMobile ? handleDragStart : undefined}
        onDragOver={isReorderable && !isMobile ? handleDragOver : undefined}
        onDragLeave={isReorderable && !isMobile ? handleDragLeave : undefined}
        onDrop={isReorderable && !isMobile ? handleDrop : undefined}
        onDragEnd={isReorderable && !isMobile ? handleDragEnd : undefined}
        onTouchStart={isMobile && isReorderable ? handleTouchStart : undefined}
        onTouchEnd={isMobile && isReorderable ? clearLongPressTimer : undefined}
        onTouchMove={isMobile && isReorderable ? clearLongPressTimer : undefined}
        onTouchCancel={isMobile && isReorderable ? clearLongPressTimer : undefined}
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
          transition: 'background-color 120ms ease',
          '&:hover': { bgcolor: 'action.hover' },
          '&:hover .drag-handle': { opacity: 1 },
        }}
      >
        {dragOverPosition && (
          <Box
            data-testid="drag-over-indicator"
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: '2px',
              bgcolor: 'primary.main',
              top: dragOverPosition === 'before' ? 0 : undefined,
              bottom: dragOverPosition === 'after' ? 0 : undefined,
            }}
          />
        )}
        <IconButton
          size="small"
          aria-label={STATUS_LABEL[status]}
          onClick={handleStatusClick}
          disabled={!nextStatus || !onTransition}
          sx={{ color: status === 'completed' ? (theme) => theme.palette.category.green : 'text.secondary' }}
        >
          <StatusIcon fontSize="small" />
        </IconButton>
        {/* Coluna título + descrição. `minWidth: 0` é obrigatório para o
            ellipsis (`noWrap`) da descrição funcionar dentro do flex do card. */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {onOpenDetail ? (
            <Typography
              component="button"
              type="button"
              onClick={() => onOpenDetail(task.id)}
              aria-label={`Ver detalhes de ${task.title}`}
              variant="body2"
              sx={{
                textAlign: 'left',
                background: 'none',
                border: 'none',
                font: 'inherit',
                padding: 0,
                cursor: 'pointer',
                textDecoration: status === 'cancelled' ? 'line-through' : 'none',
                color: status === 'completed' ? 'text.disabled' : 'text.primary',
              }}
            >
              {task.title}
            </Typography>
          ) : (
            <Typography
              variant="body2"
              sx={{
                textDecoration: status === 'cancelled' ? 'line-through' : 'none',
                color: status === 'completed' ? 'text.disabled' : 'text.primary',
              }}
            >
              {task.title}
            </Typography>
          )}
          {/* AC1/AC2: descrição truncada em 1 linha, só quando há conteúdo
              (guard falsy cobre null/""/undefined). `component="div"` é
              obrigatório: `body-sm` é variante custom e o MUI só mapeia as
              variantes nativas para elemento — sem ela o fallback é <span>
              (display:inline), onde `overflow`/`text-overflow` do `noWrap` não
              se aplicam (some o ellipsis) e a linha sobe para junto do título.
              Mesma razão do `component="div"` em RecurringPlacementDialog. */}
          {task.description && (
            <Typography variant="body-sm" color="text.secondary" component="div" noWrap>
              {task.description}
            </Typography>
          )}
        </Box>
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
          {migrationCount > 0 && (
            <Chip
              label={`↻ ${migrationCount}×`}
              size="small"
              variant="outlined"
              aria-label={`Migrada ${migrationCount} ${migrationCount === 1 ? 'vez' : 'vezes'}`}
              sx={{
                borderColor: 'divider',
                color: 'text.secondary',
                fontSize: '11px',
                height: 18,
              }}
            />
          )}
        </Box>
        {!isSubtask && (
          <IconButton
            size="small"
            aria-label="Mover tarefa"
            onClick={() => setDestinationDialogOpen(true)}
            disabled={status !== 'pending' && status !== 'started'}
            sx={{ color: 'text.secondary' }}
          >
            <DriveFileMoveOutlinedIcon fontSize="small" />
          </IconButton>
        )}
        {isReorderable && !isMobile && (
          <Box className="drag-handle" sx={{ display: 'flex', alignItems: 'center', opacity: 0 }}>
            <IconButton
              size="small"
              aria-label="Reordenar tarefa"
              onClick={() => setMoveDialogOpen(true)}
              sx={{ color: 'text.secondary' }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
            <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'grab', color: 'text.secondary' }}>
              <DragIndicatorIcon fontSize="small" />
            </Box>
          </Box>
        )}
        <Box
          role="status"
          aria-live="polite"
          sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}
        >
          {announcement}
        </Box>
      </Box>
      {isReorderable && (
        <MoveTaskDialog
          task={task}
          siblings={siblings ?? []}
          open={moveDialogOpen}
          onMove={(targetId, position) => {
            onReorder!(task.id, targetId, position)
            setMoveDialogOpen(false)
          }}
          onClose={() => setMoveDialogOpen(false)}
        />
      )}
      {!isSubtask && (
        <TaskDestinationDialog
          task={task}
          open={destinationDialogOpen}
          onClose={() => setDestinationDialogOpen(false)}
        />
      )}
      {subtasks.length > 0 && (
        <Box sx={{ pl: 3 }}>
          {subtasks.map((subtask) => (
            <TaskRow
              key={subtask.id}
              task={subtask}
              onTransition={onTransition}
              onOpenDetail={onOpenDetail}
              isSubtask
            />
          ))}
        </Box>
      )}
    </Box>
  )
}
