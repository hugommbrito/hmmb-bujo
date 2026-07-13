import { useEffect, useRef, useState } from 'react'
import { Box, Typography } from '@mui/material'
import {
  MigrationBanner,
  MonthlyReviewBanner,
  WeeklyReviewBanner,
  useCreateTaskMutation,
  useReorderTaskMutation,
  useTransitionTaskMutation,
} from '../../features/bujo'
import { AddTaskRow } from '../../features/bujo/components/AddTaskRow'
import { DayHeader } from '../../features/bujo/components/DayHeader'
import { TaskDetailPanel } from '../../features/bujo/components/TaskDetailPanel'
import { TaskRow } from '../../features/bujo/components/TaskRow'
import { DailyLogSkeleton } from '../../features/bujo/components/DailyLogSkeleton'
import { findTaskById } from '../../features/bujo/taskTree'
import { useDailyData } from './useDailyData'

export function DailyPage() {
  const { todayLog } = useDailyData()
  const transition = useTransitionTaskMutation()
  const createTask = useCreateTaskMutation()
  const reorder = useReorderTaskMutation()
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const addTaskInputRef = useRef<HTMLInputElement>(null)

  function handleReorder(taskId: string, targetTaskId: string, position: 'before' | 'after') {
    reorder.mutate({ taskId, targetTaskId, position })
  }

  // Atalho `N` — escopo desta página (não global como `[` em AppLayout.tsx).
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Sem este guard, Ctrl+N/Cmd+N (atalho nativo do navegador para nova
      // janela) seria sequestrado: o `key` continua "n" com um modificador
      // pressionado, então o preventDefault() abaixo bloquearia o atalho do
      // navegador em vez de só agir sobre o "n" isolado.
      if (event.ctrlKey || event.metaKey || event.altKey) return

      const target = event.target as HTMLElement
      const isEditable =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      if (isEditable) return

      if (event.key === 'n' || event.key === 'N') {
        // Sem isso, o navegador ainda insere o caractere "n" no campo assim
        // que o focus() abaixo move o foco para ele dentro do mesmo keydown.
        event.preventDefault()
        addTaskInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

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
  const openTask = openTaskId ? findTaskById(tasks, openTaskId) : undefined
  const isOpenTaskSubtask = openTaskId ? !tasks.some((task) => task.id === openTaskId) : false

  return (
    <Box component="main" aria-label="Hoje" sx={{ p: 3 }}>
      <MigrationBanner />
      <WeeklyReviewBanner />
      <MonthlyReviewBanner />
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
              onOpenDetail={setOpenTaskId}
              siblings={tasks}
              onReorder={handleReorder}
            />
          ))
        )}
        <AddTaskRow ref={addTaskInputRef} onAdd={(title) => createTask.mutate({ title })} />
      </DayHeader>
      <TaskDetailPanel
        key={openTaskId ?? 'none'}
        task={openTask}
        isSubtask={isOpenTaskSubtask}
        onClose={() => setOpenTaskId(null)}
      />
    </Box>
  )
}
