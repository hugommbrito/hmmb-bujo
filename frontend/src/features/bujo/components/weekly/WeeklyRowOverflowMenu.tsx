// ─────────────────────────────────────────────────────────────────────────────
// Comando relativo de reordenação (Story 14.5, Task 7; Dev Notes → lacuna B5):
// sem drag entre dias — "Mover acima"/"Mover abaixo" contra o irmão adjacente
// (mesmo dia) e "Mover para…" reusa o `MoveTaskDialog` já provado no legado.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { IconButton, Menu, MenuItem } from '@mui/material'
import { DotsThreeVertical } from '@phosphor-icons/react'

import { MoveTaskDialog } from '../MoveTaskDialog'
import type { Task } from '../../types'

export interface WeeklyRowOverflowMenuProps {
  task: Task
  /** Irmãos do MESMO dia/pool, na ordem exibida (a Task Row deste `task` está
   * incluída). */
  siblings: Task[]
  onReorder: (taskId: string, targetTaskId: string, position: 'before' | 'after') => void
}

export function WeeklyRowOverflowMenu({ task, siblings, onReorder }: WeeklyRowOverflowMenuProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)

  const index = siblings.findIndex((sibling) => sibling.id === task.id)
  const previousSibling = index > 0 ? siblings[index - 1] : null
  const nextSibling = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null

  return (
    <>
      <IconButton
        size="small"
        aria-label="Reordenar tarefa"
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={{ color: 'var(--ds-ink-muted)' }}
      >
        <DotsThreeVertical size={16} />
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem
          disabled={!previousSibling}
          onClick={() => {
            if (previousSibling) onReorder(task.id, previousSibling.id, 'before')
            setAnchorEl(null)
          }}
        >
          Mover acima
        </MenuItem>
        <MenuItem
          disabled={!nextSibling}
          onClick={() => {
            if (nextSibling) onReorder(task.id, nextSibling.id, 'after')
            setAnchorEl(null)
          }}
        >
          Mover abaixo
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMoveDialogOpen(true)
            setAnchorEl(null)
          }}
        >
          Mover para…
        </MenuItem>
      </Menu>
      <MoveTaskDialog
        task={task}
        siblings={siblings}
        open={moveDialogOpen}
        onMove={(targetId, position) => onReorder(task.id, targetId, position)}
        onClose={() => setMoveDialogOpen(false)}
      />
    </>
  )
}
