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

type DestinationMode = 'today' | 'week' | 'month' | 'future'

// Mesmo cálculo de "mês corrente" já duplicado em MonthlyPage/FuturePage —
// cálculo de UI, não autoridade de domínio.
function currentMonthFirst(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

// Parse por partes (não `new Date(isoString)`, que sofre off-by-one de UTC —
// mesma técnica de `MonthDensityCalendar.parseLocalDate`); só formata, não
// precisa de objeto Date.
function formatDDMM(iso: string): string {
  const [, month, day] = iso.split('-')
  return `${day}/${month}`
}

// Autocontido (mesmo padrão do MoveTaskDialog embutido em TaskRow para
// reorder) — usa useMigrateTaskMutation() internamente, não recebe a
// mutation via prop.
export function TaskDestinationDialog({ task, open, onClose, onSuccess }: TaskDestinationDialogProps) {
  const [mode, setMode] = useState<DestinationMode>('today')
  const [calendarMonthFirst, setCalendarMonthFirst] = useState(currentMonthFirst())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [monthDate, setMonthDate] = useState('')
  const [futureDay, setFutureDay] = useState('')
  const [futureMonth, setFutureMonth] = useState('')
  const migrate = useMigrateTaskMutation()

  // Aba "Este mês" fixa o mês corrente (o backend força `month_first =
  // current_month_first` para `destination === 'month'`) — sem navegação
  // Prev/Next, diferente da aba "Esta semana".
  const thisMonthFirst = currentMonthFirst()

  const weekDensity = useTaskDensityQuery(calendarMonthFirst, { enabled: open && mode === 'week' })
  const weekDensityByDate = new Map((weekDensity.data ?? []).map((entry) => [entry.date, entry.count]))

  const monthDensity = useTaskDensityQuery(thisMonthFirst, { enabled: open && mode === 'month' })
  const monthDensityByDate = new Map(
    (monthDensity.data ?? []).map((entry) => [entry.date, entry.count]),
  )

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

  // Clique no dia já selecionado desseleciona (toggle) — caminho mais simples
  // para o usuário voltar a "semana/mês sem data" sem um controle extra.
  function handleSelectWeekDay(iso: string) {
    setSelectedDate((current) => (current === iso ? null : iso))
  }

  function handleSelectMonthDay(iso: string) {
    setMonthDate((current) => (current === iso ? '' : iso))
  }

  function handleFutureMonthChange(event: ChangeEvent<HTMLInputElement>) {
    setFutureMonth(event.target.value)
  }

  function handleConfirm() {
    if (mode === 'today') {
      migrate.mutate({ taskId: task.id, destination: 'today' }, { onSuccess: handleMoveSuccess })
    } else if (mode === 'week') {
      migrate.mutate(
        { taskId: task.id, destination: 'week', scheduledDate: selectedDate ?? undefined },
        { onSuccess: handleMoveSuccess },
      )
    } else if (mode === 'month') {
      migrate.mutate(
        { taskId: task.id, destination: 'month', scheduledDate: monthDate || undefined },
        { onSuccess: handleMoveSuccess },
      )
    } else {
      if (!futureMonth) return
      const scheduledDate = futureDay ? `${futureMonth}-${futureDay.padStart(2, '0')}` : undefined
      migrate.mutate(
        { taskId: task.id, destination: 'future', monthFirst: `${futureMonth}-01`, scheduledDate },
        { onSuccess: handleMoveSuccess },
      )
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Migrar Tarefa</DialogTitle>
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
          {task.scheduledDate && (
            <Typography variant="body-sm" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
              Atualmente: {formatDDMM(task.scheduledDate)}
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
          <Tab value="today" label="Hoje" />
          <Tab value="week" label="Esta semana" />
          <Tab value="month" label="Este mês" />
          <Tab value="future" label="Futuro" />
        </Tabs>

        <Box role="tabpanel">
          {mode === 'today' && (
            <Typography variant="body2" color="text.secondary">
              Mover para o Daily Log de hoje.
            </Typography>
          )}
          {mode === 'week' && (
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
                densityByDate={weekDensityByDate}
                selectedDate={selectedDate}
                onSelectDay={handleSelectWeekDay}
              />
            </Box>
          )}
          {mode === 'month' && (
            <MonthDensityCalendar
              monthFirst={thisMonthFirst}
              densityByDate={monthDensityByDate}
              selectedDate={monthDate || null}
              onSelectDay={handleSelectMonthDay}
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
                value={futureMonth}
                onChange={handleFutureMonthChange}
                slotProps={{ inputLabel: { shrink: true } }}
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
        <Button
          onClick={handleConfirm}
          disabled={mode === 'future' && !futureMonth}
          variant="contained"
        >
          Migrar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
