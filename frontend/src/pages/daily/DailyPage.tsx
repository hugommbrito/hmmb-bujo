import { Box, Typography } from '@mui/material'
import { useTransitionTaskMutation } from '../../features/bujo'
import { DayHeader } from '../../features/bujo/components/DayHeader'
import { TaskRow } from '../../features/bujo/components/TaskRow'
import { DailyLogSkeleton } from '../../features/bujo/components/DailyLogSkeleton'
import { useDailyData } from './useDailyData'

export function DailyPage() {
  const { todayLog } = useDailyData()
  const transition = useTransitionTaskMutation()

  if (todayLog.isPending) {
    return (
      <Box component="main" aria-label="Hoje" sx={{ p: 3 }}>
        <DailyLogSkeleton />
      </Box>
    )
  }

  if (!todayLog.data) return null

  const { logDate, tasks } = todayLog.data
  const pendingCount = tasks.filter((task) => task.status === 'pending').length

  return (
    <Box component="main" aria-label="Hoje" sx={{ p: 3 }}>
      <DayHeader logDate={logDate} pendingCount={pendingCount}>
        {tasks.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 3, py: 2 }}>
            Nenhuma tarefa para hoje. Adicione ou migre do dia anterior.
          </Typography>
        ) : (
          tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onTransition={(taskId, toStatus) => transition.mutate({ taskId, toStatus })}
            />
          ))
        )}
      </DayHeader>
    </Box>
  )
}
