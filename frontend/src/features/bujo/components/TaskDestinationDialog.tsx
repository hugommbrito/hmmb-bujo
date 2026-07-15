import { useState, type ChangeEvent } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogTitle,
  IconButton,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { useMigrateTaskMutation, useTaskDensityQuery } from '../api'
import { currentMonthBounds } from './MigrationCard'
import { MonthDensityCalendar } from './MonthDensityCalendar'
import { MONTH_NAMES_PT } from '../monthNames'
import type { Task } from '../types'

interface TaskDestinationDialogProps {
  task: Task
  open: boolean
  onClose: () => void
  // Chamado SÓ quando a mutação de mover tem sucesso (além de onClose, que
  // também fecha no cancelar/backdrop/Esc) — permite a um consumidor (ex.:
  // TaskDetailPanel) reagir apenas ao sucesso, sem fechar algo maior (o
  // painel) quando o usuário só cancelou a escolha de destino.
  onSuccess?: () => void
}

type DestinationMode = 'day' | 'thisMonth' | 'future'

// Mesmo cálculo de "mês corrente" já duplicado em MonthlyPage/FuturePage —
// cálculo de UI, não autoridade de domínio.
function currentMonthFirst(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

// Autocontido (mesmo padrão do MoveTaskDialog embutido em TaskRow para
// reorder) — usa useMigrateTaskMutation() internamente, não recebe a
// mutation via prop.
export function TaskDestinationDialog({ task, open, onClose, onSuccess }: TaskDestinationDialogProps) {
  const [mode, setMode] = useState<DestinationMode>('day')
  const [calendarMonthFirst, setCalendarMonthFirst] = useState(currentMonthFirst())
  const [futureDay, setFutureDay] = useState('')
  const migrate = useMigrateTaskMutation()
  const { min, max } = currentMonthBounds()

  const density = useTaskDensityQuery(calendarMonthFirst, { enabled: open && mode === 'day' })
  const densityByDate = new Map((density.data ?? []).map((entry) => [entry.date, entry.count]))

  const subtasks = task.subtasks ?? []

  function handleMoveSuccess() {
    onClose()
    onSuccess?.()
  }

  function handleTabChange(_: unknown, value: DestinationMode) {
    setMode(value)
  }

  function shiftCalendarMonth(delta: 1 | -1) {
    const [year, month] = calendarMonthFirst.split('-').map(Number)
    const next = new Date(year, month - 1 + delta, 1)
    setCalendarMonthFirst(
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`,
    )
  }

  function handleThisMonthChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value
    if (!value) return
    migrate.mutate(
      { taskId: task.id, destination: 'month', scheduledDate: value },
      { onSuccess: handleMoveSuccess },
    )
  }

  function handleFutureMonthChange(event: ChangeEvent<HTMLInputElement>) {
    const month = event.target.value
    if (!month) return
    const scheduledDate = futureDay ? `${month}-${futureDay.padStart(2, '0')}` : undefined
    migrate.mutate(
      { taskId: task.id, destination: 'future', monthFirst: `${month}-01`, scheduledDate },
      { onSuccess: handleMoveSuccess },
    )
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Mover tarefa</DialogTitle>
      <Box sx={{ px: 3, pb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box>
          <Typography variant="heading" component="div">
            {task.title}
          </Typography>
          {task.description && (
            <Typography variant="body-sm" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
              {task.description}
            </Typography>
          )}
          {subtasks.length > 0 && (
            <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 3 }}>
              {subtasks.map((subtask) => (
                <Typography key={subtask.id} component="li" variant="body2">
                  {subtask.title}
                </Typography>
              ))}
            </Box>
          )}
        </Box>

        <Tabs value={mode} onChange={handleTabChange} aria-label="Destino da tarefa">
          <Tab value="day" label="Dia" />
          <Tab value="thisMonth" label="Este mês" />
          <Tab value="future" label="Futuro" />
        </Tabs>

        <Box role="tabpanel">
          {mode === 'day' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <IconButton size="small" onClick={() => shiftCalendarMonth(-1)} aria-label="Mês anterior">
                  <ChevronLeftIcon fontSize="small" />
                </IconButton>
                <Typography variant="body-sm" color="text.secondary">
                  {MONTH_NAMES_PT[Number(calendarMonthFirst.slice(5, 7)) - 1]}{' '}
                  {calendarMonthFirst.slice(0, 4)}
                </Typography>
                <IconButton size="small" onClick={() => shiftCalendarMonth(1)} aria-label="Próximo mês">
                  <ChevronRightIcon fontSize="small" />
                </IconButton>
              </Box>
              <MonthDensityCalendar
                monthFirst={calendarMonthFirst}
                densityByDate={densityByDate}
                onSelectDay={(iso) =>
                  migrate.mutate(
                    { taskId: task.id, destination: 'week', scheduledDate: iso },
                    { onSuccess: handleMoveSuccess },
                  )
                }
              />
            </Box>
          )}
          {mode === 'thisMonth' && (
            <TextField
              label="Data no mês corrente"
              type="date"
              size="small"
              fullWidth
              slotProps={{ htmlInput: { min, max }, inputLabel: { shrink: true } }}
              onChange={handleThisMonthChange}
            />
          )}
          {mode === 'future' && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                label="Dia (opcional)"
                type="number"
                size="small"
                value={futureDay}
                onChange={(event) => setFutureDay(event.target.value)}
                slotProps={{ htmlInput: { min: 1, max: 31 } }}
                sx={{ width: 140 }}
              />
              <TextField
                label="Mês"
                type="month"
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
                onChange={handleFutureMonthChange}
              />
            </Box>
          )}
        </Box>

        {migrate.isError && (
          <Typography color="error" variant="body-sm">
            Não foi possível mover a tarefa. Tente novamente.
          </Typography>
        )}
      </Box>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
      </DialogActions>
    </Dialog>
  )
}
