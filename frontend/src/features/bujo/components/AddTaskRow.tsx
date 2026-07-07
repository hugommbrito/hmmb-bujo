import { forwardRef, useState, type KeyboardEvent } from 'react'
import { Box, Button, TextField } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'

interface AddTaskRowProps {
  onAdd: (title: string) => void
  label?: string
  placeholder?: string
}

export const AddTaskRow = forwardRef<HTMLInputElement, AddTaskRowProps>(function AddTaskRow(
  { onAdd, label = 'Nova tarefa', placeholder = 'Nova tarefa' },
  ref,
) {
  const [title, setTitle] = useState('')

  function submit() {
    const trimmed = title.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setTitle('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    submit()
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, pt: 1 }}>
      <TextField
        inputRef={ref}
        placeholder={placeholder}
        slotProps={{ htmlInput: { 'aria-label': label } }}
        size="small"
        fullWidth
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <Button startIcon={<AddIcon />} onClick={submit} sx={{ whiteSpace: 'nowrap' }}>
        {label}
      </Button>
    </Box>
  )
})
