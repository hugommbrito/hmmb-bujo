import { forwardRef, useState, type FormEvent } from 'react'
import { Box, Button, MenuItem, Select, TextField } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import type { BrainDumpTargetLog } from '../types'

interface BrainDumpCaptureFormFields {
  title: string
  description?: string
  targetLog?: BrainDumpTargetLog
}

interface BrainDumpCaptureFormProps {
  onCapture: (fields: BrainDumpCaptureFormFields) => void
}

// Vocabulário de destino compartilhado com o BrainDumpCaptureSheet (Story 5.3)
// — fonte única, sem duplicar a lista. Exportar um valor não-componente ao lado
// de um componente dispara o aviso de fast-refresh (mesmo padrão de MigrationCard).
// eslint-disable-next-line react-refresh/only-export-components
export const TARGET_LOG_OPTIONS: Array<{ value: BrainDumpTargetLog | ''; label: string }> = [
  { value: '', label: 'Brain Dump' },
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Esta Semana' },
  { value: 'month', label: 'Este Mês' },
  { value: 'future', label: 'Futuro' },
]

// `inputRef` exposta via forwardRef (mesmo padrão de AddTaskRow,
// features/bujo/components/) — BrainDumpPage foca o título a cada montagem
// (Task 10.2), sem depender de por onde a navegação chegou (atalho `B` ou
// clique na sidebar).
export const BrainDumpCaptureForm = forwardRef<HTMLInputElement, BrainDumpCaptureFormProps>(
  function BrainDumpCaptureForm({ onCapture }, ref) {
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [targetLog, setTargetLog] = useState<BrainDumpTargetLog | ''>('')

    function handleSubmit(event: FormEvent) {
      event.preventDefault()
      const trimmedTitle = title.trim()
      if (!trimmedTitle) return

      onCapture({
        title: trimmedTitle,
        description: description.trim() || undefined,
        targetLog: targetLog || undefined,
      })
      setTitle('')
      setDescription('')
      setTargetLog('')
    }

    return (
      <Box
        component="form"
        onSubmit={handleSubmit}
        aria-label="Capturar item no Brain Dump"
        sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1 }}
      >
        <TextField
          inputRef={ref}
          label="Título"
          required
          size="small"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <TextField
          label="Descrição"
          multiline
          size="small"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <Select
          size="small"
          value={targetLog}
          onChange={(event) => setTargetLog(event.target.value as BrainDumpTargetLog | '')}
          inputProps={{ 'aria-label': 'Destino' }}
        >
          {TARGET_LOG_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
        <Box>
          <Button type="submit" startIcon={<AddIcon />} variant="contained" disabled={!title.trim()}>
            Capturar
          </Button>
        </Box>
      </Box>
    )
  },
)
