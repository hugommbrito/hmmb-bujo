import { Dialog, DialogTitle, List, ListItemButton, ListItemText, Typography } from '@mui/material'
import type { Task } from '../types'

interface MoveTaskDialogProps {
  task: Task
  siblings: Task[]
  open: boolean
  onMove: (targetTaskId: string, position: 'before' | 'after') => void
  onClose: () => void
}

export function MoveTaskDialog({ task, siblings, open, onMove, onClose }: MoveTaskDialogProps) {
  const otherSiblings = siblings.filter((sibling) => sibling.id !== task.id)

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Mover "{task.title}" para...</DialogTitle>
      {otherSiblings.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 3, pb: 3 }}>
          Nenhuma outra tarefa para reordenar
        </Typography>
      ) : (
        <List sx={{ pb: 2, minWidth: 280 }}>
          {otherSiblings.map((sibling) => (
            <div key={sibling.id}>
              <ListItemButton
                onClick={() => {
                  onMove(sibling.id, 'before')
                  onClose()
                }}
              >
                <ListItemText primary={`Acima de ${sibling.title}`} />
              </ListItemButton>
              <ListItemButton
                onClick={() => {
                  onMove(sibling.id, 'after')
                  onClose()
                }}
              >
                <ListItemText primary={`Abaixo de ${sibling.title}`} />
              </ListItemButton>
            </div>
          ))}
        </List>
      )}
    </Dialog>
  )
}
