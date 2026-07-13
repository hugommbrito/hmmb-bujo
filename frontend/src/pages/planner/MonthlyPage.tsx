import { useState, type FormEvent } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { useCreateMonthlyTaskMutation, useMonthlyLogQuery } from '../../features/bujo'
import type { Task } from '../../features/bujo'
import { DayHeader } from '../../features/bujo/components/DayHeader'
import { PlannerSkeleton } from '../../features/bujo/components/PlannerSkeleton'
import { TaskRow } from '../../features/bujo/components/TaskRow'

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
          {withoutDate.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="heading" sx={{ px: 1 }}>
                Sem dia definido
              </Typography>
              {withoutDate.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </Box>
          )}
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
