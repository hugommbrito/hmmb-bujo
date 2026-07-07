import { useQuery } from '@tanstack/react-query'
import client from '../../api/client'
import { keys } from '../../api/keys'
import { useOptimisticMutation } from '../../shared/hooks/useOptimisticMutation'
import { mapTaskTree } from './taskTree'
import type { Log, Task, TaskCategory, TaskEisenhower, TaskStatus } from './types'

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

interface TaskFields {
  title: string
  description?: string | null
  eisenhower?: TaskEisenhower | null
  category?: TaskCategory | null
}

function optimisticTask(fields: TaskFields): Task {
  return {
    id: crypto.randomUUID(),
    status: 'pending',
    subtasks: [],
    ...fields,
  }
}

type CreateTaskVariables = TaskFields

async function createTask(fields: CreateTaskVariables): Promise<Task> {
  const response = await client.post<Task>('/api/bujo/tasks/', fields)
  return response.data
}

export function useCreateTaskMutation() {
  return useOptimisticMutation<Task, unknown, CreateTaskVariables, Log>({
    mutationFn: createTask,
    queryKey: keys.bujo.todayLog(),
    updater: (current, fields) => {
      if (!current) return current as unknown as Log
      return { ...current, tasks: [...current.tasks, optimisticTask(fields)] }
    },
  })
}

interface CreateSubtaskVariables extends TaskFields {
  parentTaskId: string
}

async function createSubtask({ parentTaskId, ...fields }: CreateSubtaskVariables): Promise<Task> {
  const response = await client.post<Task>(`/api/bujo/tasks/${parentTaskId}/subtasks/`, fields)
  return response.data
}

export function useCreateSubtaskMutation() {
  return useOptimisticMutation<Task, unknown, CreateSubtaskVariables, Log>({
    mutationFn: createSubtask,
    queryKey: keys.bujo.todayLog(),
    updater: (current, { parentTaskId, ...fields }) => {
      if (!current) return current as unknown as Log
      return {
        ...current,
        tasks: mapTaskTree(current.tasks, parentTaskId, (task) => ({
          ...task,
          subtasks: [...(task.subtasks ?? []), optimisticTask(fields)],
        })),
      }
    },
  })
}

interface UpdateTaskVariables extends Partial<TaskFields> {
  taskId: string
}

async function updateTask({ taskId, ...patch }: UpdateTaskVariables): Promise<Task> {
  const response = await client.patch<Task>(`/api/bujo/tasks/${taskId}/`, patch)
  return response.data
}

export function useUpdateTaskMutation() {
  return useOptimisticMutation<Task, unknown, UpdateTaskVariables, Log>({
    mutationFn: updateTask,
    queryKey: keys.bujo.todayLog(),
    updater: (current, { taskId, ...patch }) => {
      if (!current) return current as unknown as Log
      return {
        ...current,
        tasks: mapTaskTree(current.tasks, taskId, (task) => ({ ...task, ...patch })),
      }
    },
  })
}
