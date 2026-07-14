import { useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogTitle, TextField } from '@mui/material'

interface RecurringPlacementDialogProps {
  open: boolean
  dateFieldType: 'date' | 'day'
  onConfirm: (value: string) => void
  onClose: () => void
}

// Reaproveitado por WeeklyPage (`dateFieldType="date"`, bounds implícitos —
// ver Dev Notes) e MonthlyPage (`dateFieldType="day"`, mesmo padrão de
// MigrationCard "Adiar no Futuro"). A conversão do valor bruto em
// `scheduledDate` fica com quem chama `onConfirm` — este componente só coleta.
export function RecurringPlacementDialog({
  open,
  dateFieldType,
  onConfirm,
  onClose,
}: RecurringPlacementDialogProps) {
  const [value, setValue] = useState('')

  function handleConfirm() {
    onConfirm(value)
    setValue('')
  }

  function handleClose() {
    setValue('')
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Definir placement</DialogTitle>
      <Box sx={{ px: 3, pb: 2 }}>
        {dateFieldType === 'date' ? (
          <TextField
            label="Data (opcional)"
            type="date"
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        ) : (
          <TextField
            label="Dia (opcional)"
            type="number"
            size="small"
            slotProps={{ htmlInput: { min: 1, max: 31 } }}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        )}
      </Box>
      <DialogActions>
        <Button onClick={handleClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleConfirm}>
          Confirmar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
