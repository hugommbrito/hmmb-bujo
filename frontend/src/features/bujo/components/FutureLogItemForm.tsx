import { useState, type FormEvent } from 'react'
import { Box, Button, TextField } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'

interface FutureLogItemFormFields {
  monthFirst: string
  title: string
  scheduledDate?: string
}

interface FutureLogItemFormProps {
  onAdd: (fields: FutureLogItemFormFields) => void
}

// Mês/ano via `<input type="month">` nativo e dia via número simples — sem
// instalar `@mui/x-date-pickers` (Dev Notes: "sem lib sem necessidade").
export function FutureLogItemForm({ onAdd }: FutureLogItemFormProps) {
  const [title, setTitle] = useState('')
  const [month, setMonth] = useState('')
  const [day, setDay] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle || !month) return

    const monthFirst = `${month}-01`
    const scheduledDate = day ? `${month}-${day.padStart(2, '0')}` : undefined

    onAdd({ monthFirst, title: trimmedTitle, scheduledDate })
    setTitle('')
    setMonth('')
    setDay('')
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      aria-label="Adicionar item ao Future Log"
      sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', flexWrap: 'wrap', px: 1, py: 1 }}
    >
      <TextField
        label="Título"
        size="small"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <TextField
        label="Mês"
        type="month"
        size="small"
        value={month}
        onChange={(event) => setMonth(event.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <TextField
        label="Dia (opcional)"
        type="number"
        size="small"
        value={day}
        onChange={(event) => setDay(event.target.value)}
        slotProps={{ htmlInput: { min: 1, max: 31 } }}
        sx={{ width: 140 }}
      />
      <Button type="submit" startIcon={<AddIcon />}>
        Adicionar
      </Button>
    </Box>
  )
}
