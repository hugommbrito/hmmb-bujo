import { useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogTitle, TextField, Typography } from '@mui/material'
import { useTaskDensityQuery } from '../api'
import type { RecurringTaskTemplate, TaskCategory } from '../types'
import { MonthDensityCalendar } from './MonthDensityCalendar'

// Rótulos por extenso das prioridades Eisenhower "reais" (Story 11.8). Só
// ui/u/i entram no mapa: none/''/null significam "sem prioridade" e não
// renderizam nada (regra de nulos, AC3 — mesma convenção de TaskDetailPanel e
// RecurringTemplateManager, que também duplicam este mapa localmente).
const EISENHOWER_LABEL: Record<'ui' | 'u' | 'i', string> = {
  ui: 'Urgente + Importante',
  u: 'Urgente',
  i: 'Importante',
}

// Categoria não tem sentinela tipo `'none'` (Story 11.12) — todo valor do
// enum é uma cor real, ausência é só `null`/`''`/`undefined`.
const CATEGORY_LABEL: Record<TaskCategory, string> = {
  teal: 'Teal',
  purple: 'Purple',
  pink: 'Pink',
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
}

interface RecurringPlacementDialogProps {
  open: boolean
  dateFieldType: 'date' | 'day'
  template: RecurringTaskTemplate | null // info da recorrência a exibir (Story 11.3)
  monthFirst: string // mês p/ o calendário de densidade (Story 11.3)
  onConfirm: (value: string) => void
  onClose: () => void
}

// Reaproveitado por WeeklyPage (`dateFieldType="date"`, bounds implícitos —
// ver Dev Notes) e MonthlyPage (`dateFieldType="day"`, mesmo padrão de
// MigrationCard "Adiar no Futuro"). A conversão do valor bruto em
// `scheduledDate` fica com quem chama `onConfirm` — este componente só coleta.
// Story 11.3: além de coletar, exibe as infos da recorrência e um calendário
// do mês com a densidade de tarefas (informativo, sem seleção).
export function RecurringPlacementDialog({
  open,
  dateFieldType,
  template,
  monthFirst,
  onConfirm,
  onClose,
}: RecurringPlacementDialogProps) {
  const [value, setValue] = useState('')
  // enabled: open evita fetch prematuro (o Dialog do MUI desmonta os filhos
  // com open=false, mas o guard mantém o hook honesto de qualquer forma).
  const density = useTaskDensityQuery(monthFirst, { enabled: open })
  const densityByDate = new Map((density.data ?? []).map((entry) => [entry.date, entry.count]))

  function handleConfirm() {
    onConfirm(value)
    setValue('')
  }

  function handleClose() {
    setValue('')
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Definir placement</DialogTitle>
      <Box sx={{ px: 3, pb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {template && (
          <Box>
            <Typography variant="heading" component="div">
              {template.title}
            </Typography>
            {template.description && (
              <Typography variant="body-sm" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                {template.description}
              </Typography>
            )}
            <Typography variant="body-sm" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
              Recorrência: {template.recurrenceText}
            </Typography>
            {template.eisenhower && template.eisenhower in EISENHOWER_LABEL && (
              <Typography variant="body-sm" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                Prioridade: {EISENHOWER_LABEL[template.eisenhower as 'ui' | 'u' | 'i']}
              </Typography>
            )}
            {template.category && (
              <Typography variant="body-sm" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                Categoria: {CATEGORY_LABEL[template.category]}
              </Typography>
            )}
          </Box>
        )}

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

        <MonthDensityCalendar monthFirst={monthFirst} densityByDate={densityByDate} />
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
