import { useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogTitle,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import { useProcessBrainDumpItemMutation } from '../api'
import type { BrainDumpItem } from '../types'

interface ProcessItemDialogProps {
  item: BrainDumpItem
  open: boolean
  onClose: () => void
}

type Destination = 'today' | 'week' | 'month' | 'future'

const DESTINATION_LABEL: Record<Destination, string> = {
  today: 'Hoje',
  week: 'Esta Semana',
  month: 'Este Mês',
  future: 'Futuro',
}

// Reaproveita o vocabulário de destino de TaskDestinationDialog
// (features/bujo/components/), mas não o componente em si — fortemente
// acoplado a `Task`/`useMigrateTaskMutation`. "Este Mês" não envia
// `monthFirst`: resolvido no backend via `today_for` (Task 4.1).
export function ProcessItemDialog({ item, open, onClose }: ProcessItemDialogProps) {
  const [destination, setDestination] = useState<Destination>('today')
  const [month, setMonth] = useState('')
  const processItem = useProcessBrainDumpItemMutation()

  function handleTabChange(_: unknown, value: Destination) {
    setDestination(value)
  }

  function handleConfirm() {
    processItem.mutate(
      {
        itemId: item.id,
        destination,
        monthFirst: destination === 'future' ? `${month}-01` : undefined,
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Mover item do Brain Dump</DialogTitle>
      <Box sx={{ px: 3, pb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {item.title}
        </Typography>

        <Tabs value={destination} onChange={handleTabChange} aria-label="Destino do item">
          <Tab value="today" label={DESTINATION_LABEL.today} />
          <Tab value="week" label={DESTINATION_LABEL.week} />
          <Tab value="month" label={DESTINATION_LABEL.month} />
          <Tab value="future" label={DESTINATION_LABEL.future} />
        </Tabs>

        {destination === 'future' && (
          <TextField
            label="Mês"
            type="month"
            size="small"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        )}

        {processItem.isError && (
          <Typography color="error" variant="body-sm">
            Não foi possível mover o item. Tente novamente.
          </Typography>
        )}
      </Box>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          onClick={handleConfirm}
          disabled={destination === 'future' && !month}
          variant="contained"
        >
          Mover
        </Button>
      </DialogActions>
    </Dialog>
  )
}
