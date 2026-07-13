import { useState, type FormEvent } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import {
  useCreateMonthlyTaskMutation,
  useMonthlyLogQuery,
  useUpdateTaskMutation,
} from '../../features/bujo'
import type { Task } from '../../features/bujo'
import { DayHeader } from '../../features/bujo/components/DayHeader'
import { PlannerSkeleton } from '../../features/bujo/components/PlannerSkeleton'
import { TaskRow } from '../../features/bujo/components/TaskRow'
import { capitalize, MONTH_NAMES_PT } from '../../features/bujo/monthNames'

// Mês corrente calculado no frontend a partir de `new Date()` local — cálculo
// de UI (mesma técnica de MigrationCard), só usado para decidir a ordem/rótulo
// da seção `withoutDate` (Task 8.1). Autoridade de "mês corrente" de verdade
// é `today_for` no backend.
function currentMonthFirst(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

function groupTasksByScheduledDate(tasks: Task[]) {
  const byDate = new Map<string, Task[]>()
  const withoutDate: Task[] = []

  for (const task of tasks) {
    if (!task.scheduledDate) {
      withoutDate.push(task)
      continue
    }
    const existing = byDate.get(task.scheduledDate)
    if (existing) {
      existing.push(task)
    } else {
      byDate.set(task.scheduledDate, [task])
    }
  }

  const withDate = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))
  return { withDate, withoutDate }
}

export function MonthlyPage() {
  const monthlyLog = useMonthlyLogQuery()
  const createMonthlyTask = useCreateMonthlyTaskMutation()
  const updateTask = useUpdateTaskMutation()
  const [title, setTitle] = useState('')
  const [day, setDay] = useState('')

  if (monthlyLog.isPending) {
    return (
      <Box component="main" aria-label="Este Mês" sx={{ p: 3 }}>
        <PlannerSkeleton />
      </Box>
    )
  }

  if (!monthlyLog.data) return null

  const { monthFirst, tasks } = monthlyLog.data
  const { withDate, withoutDate } = groupTasksByScheduledDate(tasks)
  // Task 8.1: mês exibido é o mês corrente → seção `withoutDate` vem antes de
  // `withDate`, com o rótulo "Itens do Future Log para [Mês]" (itens que já
  // chegaram fisicamente ao Monthly Log corrente, Future Log = monthly_log
  // futuro, AD-03) aguardando confirmação de data. Qualquer outro mês mantém
  // o comportamento pré-4.3 (withDate primeiro, "Sem dia definido" depois).
  const isCurrentMonth = monthFirst === currentMonthFirst()
  const withoutDateTitle = isCurrentMonth
    ? `Itens do Future Log para ${capitalize(MONTH_NAMES_PT[Number(monthFirst.slice(5, 7)) - 1])}`
    : 'Sem dia definido'

  function handleConfirmScheduledDate(taskId: string, value: string) {
    if (!value) return
    updateTask.mutate({ taskId, scheduledDate: value })
  }

  const withoutDateSection = withoutDate.length > 0 && (
    <Box sx={{ mt: 3 }}>
      <Typography variant="heading" sx={{ px: 1 }}>
        {withoutDateTitle}
      </Typography>
      {withoutDate.map((task) =>
        isCurrentMonth ? (
          <Box key={task.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1 }}>
              <TaskRow task={task} />
            </Box>
            <TextField
              label="Confirmar data"
              type="date"
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              onChange={(event) => handleConfirmScheduledDate(task.id, event.target.value)}
            />
          </Box>
        ) : (
          <TaskRow key={task.id} task={task} />
        ),
      )}
    </Box>
  )

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    const scheduledDate = day ? `${monthFirst.slice(0, 7)}-${day.padStart(2, '0')}` : undefined
    createMonthlyTask.mutate(
      { monthFirst, title: trimmedTitle, scheduledDate },
      // O query key ativo desta página é o sentinel 'current' (Task 7.1) —
      // a invalidação da mutação usa `monthFirst` explícito, então não
      // alcança este key. Refetch direto garante o mês corrente atualizado.
      { onSuccess: () => monthlyLog.refetch() },
    )
    setTitle('')
    setDay('')
  }

  return (
    <Box component="main" aria-label="Este Mês" sx={{ p: 3 }}>
      {tasks.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1, mb: 2 }}>
          Nenhuma tarefa neste mês.
        </Typography>
      ) : isCurrentMonth ? (
        <>
          {withoutDateSection}
          {withDate.map(([date, dayTasks]) => (
            <DayHeader
              key={date}
              logDate={date}
              pendingCount={dayTasks.filter((task) => task.status === 'pending').length}
            >
              {dayTasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </DayHeader>
          ))}
        </>
      ) : (
        <>
          {withDate.map(([date, dayTasks]) => (
            <DayHeader
              key={date}
              logDate={date}
              pendingCount={dayTasks.filter((task) => task.status === 'pending').length}
            >
              {dayTasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </DayHeader>
          ))}
          {withoutDateSection}
        </>
      )}
      <Box
        component="form"
        onSubmit={handleSubmit}
        aria-label="Adicionar tarefa ao mês"
        sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', flexWrap: 'wrap', px: 1, py: 1, mt: 3 }}
      >
        <TextField
          label="Título"
          size="small"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
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
    </Box>
  )
}
