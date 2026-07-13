import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import client from '../../api/client'
import { keys } from '../../api/keys'
import { useOptimisticMutation } from '../../shared/hooks/useOptimisticMutation'
import { mapTaskTree, reorderTaskTree } from './taskTree'
import type {
  FutureLogMonthGroup,
  Log,
  MigrationQueue,
  MonthlyLog,
  MonthlyReviewQueue,
  Task,
  TaskCategory,
  TaskEisenhower,
  TaskStatus,
  WeeklyLog,
  WeeklyReviewQueue,
} from './types'

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
  scheduledDate?: string | null
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
  const queryClient = useQueryClient()
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
    mutationOptions: {
      onSuccess: () => {
        // A task de monthly_log (ex.: confirmação de data do Future Log, Task 8)
        // não aparece no cache do Daily Log — o updater otimista acima é um
        // no-op seguro nesse caso; invalidar por prefixo garante o refetch.
        queryClient.invalidateQueries({ queryKey: ['bujo', 'monthlyLog'] })
      },
    },
  })
}

interface ReorderTaskVariables {
  taskId: string
  targetTaskId: string
  position: 'before' | 'after'
}

async function reorderTask({ taskId, targetTaskId, position }: ReorderTaskVariables): Promise<Task> {
  const response = await client.post<Task>(`/api/bujo/tasks/${taskId}/reorder/`, {
    targetTaskId,
    position,
  })
  return response.data
}

export function useReorderTaskMutation() {
  return useOptimisticMutation<Task, unknown, ReorderTaskVariables, Log>({
    mutationFn: reorderTask,
    queryKey: keys.bujo.todayLog(),
    updater: (current, { taskId, targetTaskId, position }) => {
      if (!current) return current as unknown as Log
      return { ...current, tasks: reorderTaskTree(current.tasks, taskId, targetTaskId, position) }
    },
  })
}

async function fetchWeeklyLog(weekStart?: string): Promise<WeeklyLog> {
  const response = await client.get<WeeklyLog>('/api/bujo/logs/weekly/', {
    params: weekStart ? { week_start: weekStart } : undefined,
  })
  return response.data
}

export function useWeeklyLogQuery(weekStart?: string) {
  return useQuery({
    queryKey: keys.bujo.weeklyLog(weekStart),
    queryFn: () => fetchWeeklyLog(weekStart),
  })
}

async function fetchMonthlyLog(monthFirst?: string): Promise<MonthlyLog> {
  const response = await client.get<MonthlyLog>('/api/bujo/logs/monthly/', {
    params: monthFirst ? { month_first: monthFirst } : undefined,
  })
  return response.data
}

export function useMonthlyLogQuery(monthFirst?: string) {
  return useQuery({
    queryKey: keys.bujo.monthlyLog(monthFirst),
    queryFn: () => fetchMonthlyLog(monthFirst),
  })
}

async function fetchFutureLog(): Promise<FutureLogMonthGroup[]> {
  const response = await client.get<FutureLogMonthGroup[]>('/api/bujo/future-log/')
  return response.data
}

export function useFutureLogQuery() {
  return useQuery({
    queryKey: keys.bujo.futureLog(),
    queryFn: fetchFutureLog,
  })
}

interface CreateMonthlyTaskVariables {
  monthFirst: string
  title: string
  scheduledDate?: string | null
  description?: string | null
  eisenhower?: TaskEisenhower | null
  category?: TaskCategory | null
}

async function createMonthlyTask(fields: CreateMonthlyTaskVariables): Promise<Task> {
  const response = await client.post<Task>('/api/bujo/logs/monthly/', fields)
  return response.data
}

export function useCreateMonthlyTaskMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createMonthlyTask,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: keys.bujo.monthlyLog(variables.monthFirst) })
      queryClient.invalidateQueries({ queryKey: keys.bujo.futureLog() })
    },
  })
}

async function fetchMigrationQueue(): Promise<MigrationQueue> {
  const response = await client.get<MigrationQueue>('/api/bujo/migration/queue/')
  return response.data
}

export function useMigrationQueueQuery() {
  return useQuery({
    queryKey: keys.bujo.migrationQueue(),
    queryFn: fetchMigrationQueue,
  })
}

async function fetchWeeklyReviewQueue(): Promise<WeeklyReviewQueue> {
  const response = await client.get<WeeklyReviewQueue>('/api/bujo/weekly-review/queue/')
  return response.data
}

export function useWeeklyReviewQueueQuery() {
  return useQuery({
    queryKey: keys.bujo.weeklyReviewQueue(),
    queryFn: fetchWeeklyReviewQueue,
  })
}

async function fetchMonthlyReviewQueue(): Promise<MonthlyReviewQueue> {
  const response = await client.get<MonthlyReviewQueue>('/api/bujo/monthly-review/queue/')
  return response.data
}

export function useMonthlyReviewQueueQuery() {
  return useQuery({
    queryKey: keys.bujo.monthlyReviewQueue(),
    queryFn: fetchMonthlyReviewQueue,
  })
}

export type MigrationDestination = 'today' | 'week' | 'month' | 'future' | 'cancel'

interface MigrateTaskVariables {
  taskId: string
  destination: MigrationDestination
  monthFirst?: string
  scheduledDate?: string | null
}

async function migrateTask({ taskId, ...fields }: MigrateTaskVariables): Promise<Task> {
  const response = await client.post<Task>(`/api/bujo/tasks/${taskId}/migrate/`, fields)
  return response.data
}

export function useMigrateTaskMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: migrateTask,
    onSuccess: () => {
      // Invalidação por prefixo (mesma técnica de useCreateMonthlyTaskMutation):
      // cobre todas as variantes de monthFirst sem reconstruir qual foi afetada.
      queryClient.invalidateQueries({ queryKey: keys.bujo.migrationQueue() })
      queryClient.invalidateQueries({ queryKey: keys.bujo.weeklyReviewQueue() })
      queryClient.invalidateQueries({ queryKey: keys.bujo.monthlyReviewQueue() })
      queryClient.invalidateQueries({ queryKey: keys.bujo.todayLog() })
      queryClient.invalidateQueries({ queryKey: ['bujo', 'weeklyLog'] })
      queryClient.invalidateQueries({ queryKey: ['bujo', 'monthlyLog'] })
      queryClient.invalidateQueries({ queryKey: ['bujo', 'futureLog'] })
    },
  })
}
