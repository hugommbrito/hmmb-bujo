import { useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { useDiscardBrainDumpItemMutation } from '../api'
import { ProcessItemDialog } from './ProcessItemDialog'
import type { BrainDumpItem } from '../types'

interface BrainDumpItemRowProps {
  item: BrainDumpItem
}

// "Descartar" chama a mutation direto no clique, sem diálogo de confirmação
// intermediário — mesmo padrão de "Excluir tarefa"/"Cancelar tarefa" em
// TaskDetailPanel.tsx (features/bujo/components/); não existe precedente de
// ConfirmDialog em nenhuma superfície do projeto.
export function BrainDumpItemRow({ item }: BrainDumpItemRowProps) {
  const [processDialogOpen, setProcessDialogOpen] = useState(false)
  const discardItem = useDiscardBrainDumpItemMutation()

  return (
    <Box
      data-testid="brain-dump-item-row"
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 1,
        px: 1,
        py: 1,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body1">{item.title}</Typography>
        {item.description && (
          <Typography variant="body-sm" color="text.secondary" component="div">
            {item.description}
          </Typography>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
        <Button size="small" onClick={() => setProcessDialogOpen(true)}>
          Mover
        </Button>
        <Button
          size="small"
          color="error"
          onClick={() => discardItem.mutate({ itemId: item.id })}
        >
          Descartar
        </Button>
      </Box>
      <ProcessItemDialog
        item={item}
        open={processDialogOpen}
        onClose={() => setProcessDialogOpen(false)}
      />
    </Box>
  )
}
