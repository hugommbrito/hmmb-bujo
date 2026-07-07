import { useQuery } from '@tanstack/react-query'
import client from '../../api/client'
import { keys } from '../../api/keys'
import { useOptimisticMutation } from '../../shared/hooks/useOptimisticMutation'
import type { Log, Task, TaskStatus } from './types'

async function fetchTodayLog(): Promise<Log> {
  const response = await client.get<Log>('/api/bujo/logs/today/')
  return response.data
}

export function useTodayLogQuery() {
  return useQuery({
    queryKey: keys.bujo.todayLog(),
    queryFn: fetchTodayLog,
  })
}

interface TransitionTaskVariables {
  taskId: string
  toStatus: TaskStatus
}

async function transitionTask({ taskId, toStatus }: TransitionTaskVariables): Promise<Task> {
  const response = await client.post<Task>(`/api/bujo/tasks/${taskId}/transition/`, { toStatus })
  return response.data
}

export function useTransitionTaskMutation() {
  return useOptimisticMutation<Task, unknown, TransitionTaskVariables, Log>({
    mutationFn: transitionTask,
    queryKey: keys.bujo.todayLog(),
    updater: (current, { taskId, toStatus }) => {
      if (!current) return current as unknown as Log
      return {
        ...current,
        tasks: current.tasks.map((task) =>
          task.id === taskId ? { ...task, status: toStatus } : task,
        ),
      }
    },
  })
}
