import { Box, Typography } from '@mui/material'
import { useCreateMonthlyTaskMutation, useFutureLogQuery } from '../../features/bujo'
import type { Task } from '../../features/bujo'
import { FutureLogItemForm } from '../../features/bujo/components/FutureLogItemForm'
import { PlannerSkeleton } from '../../features/bujo/components/PlannerSkeleton'
import { TaskRow } from '../../features/bujo/components/TaskRow'

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const MONTH_ABBREV = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
]

function formatMonthGroupTitle(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`
}

// EXPERIENCE.md §4.7 / decision-log: "(14)" quando tem dia, "— jul" quando é
// só mês (Future Log parcial, FR-1.2).
function formatDayPrefix(task: Task, month: number): string {
  if (task.scheduledDate) {
    const day = Number(task.scheduledDate.split('-')[2])
    return `(${day})`
  }
  return `— ${MONTH_ABBREV[month - 1]}`
}

export function FuturePage() {
  const futureLog = useFutureLogQuery()
  const createMonthlyTask = useCreateMonthlyTaskMutation()

  if (futureLog.isPending) {
    return (
      <Box component="main" aria-label="Futuro" sx={{ p: 3 }}>
        <PlannerSkeleton />
      </Box>
    )
  }

  if (!futureLog.data) return null

  return (
    <Box component="main" aria-label="Futuro" sx={{ p: 3 }}>
      <FutureLogItemForm onAdd={(fields) => createMonthlyTask.mutate(fields)} />
      {futureLog.data.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1, mt: 2 }}>
          Nenhum item no futuro ainda.
        </Typography>
      ) : (
        futureLog.data.map((group) => (
          <Box key={`${group.year}-${group.month}`} sx={{ mt: 3 }}>
            <Typography variant="heading" sx={{ px: 1 }}>
              {formatMonthGroupTitle(group.year, group.month)}
            </Typography>
            {group.tasks.map((task) => (
              <Box key={task.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 40 }}>
                  {formatDayPrefix(task, group.month)}
                </Typography>
                <Box sx={{ flex: 1 }}>
                  <TaskRow task={task} />
                </Box>
              </Box>
            ))}
          </Box>
        ))
      )}
    </Box>
  )
}
