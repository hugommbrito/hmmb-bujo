import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import client from '../../api/client'
import { keys } from '../../api/keys'
import { useOptimisticMutation } from '../../shared/hooks/useOptimisticMutation'
import { mapTaskTree, reorderTaskTree } from './taskTree'
import type {
  ArchiveEntry,
  CatchUpQueue,
  FutureLogMonthGroup,
  Log,
  MigrationQueue,
  MonthlyLog,
  MonthlyReviewQueue,
  RecurrenceGroup,
  RecurringTaskTemplate,
  Task,
  TaskCategory,
  TaskDensityEntry,
  TaskDensityResponse,
  TaskEisenhower,
  TaskStatus,
  WeeklyLog,
  WeeklyReviewQueue,
} from './types'

async function fetchTodayLog(logDate?: string): Promise<Log> {
  const response = await client.get<Log>('/api/bujo/logs/today/', {
    params: logDate ? { log_date: logDate } : undefined,
  })
  return response.data
}

export function useTodayLogQuery(logDate?: string) {
  return useQuery({
    queryKey: keys.bujo.todayLog(logDate),
    queryFn: () => fetchTodayLog(logDate),
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

export function useTransitionTaskMutation(logDate?: string) {
  return useOptimisticMutation<Task, unknown, TransitionTaskVariables, Log>({
    mutationFn: transitionTask,
    queryKey: keys.bujo.todayLog(logDate),
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
        // Uma task de weekly_log/monthly_log (ex.: confirmação de data do
        // Future Log, Task 8; edição via TaskDetailPanel em Semana/Mês,
        // Story 11.5 AC2) não aparece no cache do Daily Log — o updater
        // otimista acima é um no-op seguro nesses casos; invalidar por
        // prefixo garante o refetch.
        queryClient.invalidateQueries({ queryKey: ['bujo', 'weeklyLog'] })
        queryClient.invalidateQueries({ queryKey: ['bujo', 'monthlyLog'] })
        // Idem para um Daily Log passado (Story 11.11, Task 6.4) — sem isso,
        // editar uma tarefa de um dia passado via TaskDetailPanel faria um
        // update otimista "no-op" (chave exata 'today' não bate) sem nunca
        // convergir para o servidor.
        queryClient.invalidateQueries({ queryKey: ['bujo', 'dailyLog'] })
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

export function useReorderTaskMutation(logDate?: string) {
  return useOptimisticMutation<Task, unknown, ReorderTaskVariables, Log>({
    mutationFn: reorderTask,
    queryKey: keys.bujo.todayLog(logDate),
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

interface CreateWeeklyTaskVariables {
  weekStart: string
  title: string
  scheduledDate?: string | null
  description?: string | null
  eisenhower?: TaskEisenhower | null
  category?: TaskCategory | null
}

async function createWeeklyTask(fields: CreateWeeklyTaskVariables): Promise<Task> {
  const response = await client.post<Task>('/api/bujo/logs/weekly/', fields)
  return response.data
}

export function useCreateWeeklyTaskMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createWeeklyTask,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: keys.bujo.weeklyLog(variables.weekStart) })
      queryClient.invalidateQueries({ queryKey: ['bujo', 'taskDensity'] })
    },
  })
}

interface DeleteTaskVariables {
  taskId: string
}

async function deleteTask({ taskId }: DeleteTaskVariables): Promise<Task | null> {
  const response = await client.delete<Task | null>(`/api/bujo/tasks/${taskId}/`)
  return response.status === 204 ? null : response.data
}

export function useDeleteTaskMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      // Container de origem é desconhecido no call-site genérico (Daily,
      // Weekly ou Monthly) — invalidação por prefixo nas 3 chaves, mesmo
      // padrão de useUpdateTaskMutation pra 'monthlyLog'. Prefixo (não a chave
      // exata 'today') alcança também um Daily Log passado (Story 11.11).
      queryClient.invalidateQueries({ queryKey: ['bujo', 'dailyLog'] })
      queryClient.invalidateQueries({ queryKey: ['bujo', 'weeklyLog'] })
      queryClient.invalidateQueries({ queryKey: ['bujo', 'monthlyLog'] })
      queryClient.invalidateQueries({ queryKey: ['bujo', 'taskDensity'] })
    },
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
      // A densidade reflete tarefas recém-criadas — invalidação por prefixo
      // alcança o sentinel 'current' e qualquer mês (Story 11.3, Task 4.4).
      queryClient.invalidateQueries({ queryKey: ['bujo', 'taskDensity'] })
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

async function fetchCatchUpQueue(): Promise<CatchUpQueue> {
  const response = await client.get<CatchUpQueue>('/api/bujo/catch-up/queue/')
  return response.data
}

export function useCatchUpQueueQuery() {
  return useQuery({
    queryKey: keys.bujo.catchUpQueue(),
    queryFn: fetchCatchUpQueue,
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
      queryClient.invalidateQueries({ queryKey: keys.bujo.catchUpQueue() })
      // Prefixo (não a chave exata 'today') — alcança também um Daily Log
      // passado (Story 11.11, Task 6.4).
      queryClient.invalidateQueries({ queryKey: ['bujo', 'dailyLog'] })
      queryClient.invalidateQueries({ queryKey: ['bujo', 'weeklyLog'] })
      queryClient.invalidateQueries({ queryKey: ['bujo', 'monthlyLog'] })
      queryClient.invalidateQueries({ queryKey: ['bujo', 'futureLog'] })
      queryClient.invalidateQueries({ queryKey: ['bujo', 'taskDensity'] })
    },
  })
}

interface RecurringTemplatesParams {
  active?: boolean
  recurrenceGroup?: RecurrenceGroup
  unplacedYear?: number
}

async function fetchRecurringTemplates(
  params?: RecurringTemplatesParams,
): Promise<RecurringTaskTemplate[]> {
  const response = await client.get<RecurringTaskTemplate[]>('/api/bujo/recurring-templates/', {
    // snake_case: espelha o backend real (Task 7.1), não a convenção
    // camelCase aspiracional do §6.3 que WeeklyLogView/MonthlyLogView já não seguem.
    params: params
      ? {
          active: params.active,
          recurrence_group: params.recurrenceGroup,
          unplaced_year: params.unplacedYear,
        }
      : undefined,
  })
  return response.data
}

export function useRecurringTemplatesQuery(params?: RecurringTemplatesParams) {
  return useQuery({
    queryKey: keys.bujo.recurringTemplates(params),
    queryFn: () => fetchRecurringTemplates(params),
  })
}

interface RecurringTemplateFields {
  title: string
  description?: string | null
  eisenhower?: TaskEisenhower | null
  recurrenceGroup: RecurrenceGroup
  recurrenceText: string
  active?: boolean
}

async function createRecurringTemplate(
  fields: RecurringTemplateFields,
): Promise<RecurringTaskTemplate> {
  const response = await client.post<RecurringTaskTemplate>('/api/bujo/recurring-templates/', fields)
  return response.data
}

export function useCreateRecurringTemplateMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createRecurringTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.bujo.recurringTemplates() })
    },
  })
}

interface UpdateRecurringTemplateVariables extends Partial<RecurringTemplateFields> {
  templateId: string
}

async function updateRecurringTemplate({
  templateId,
  ...patch
}: UpdateRecurringTemplateVariables): Promise<RecurringTaskTemplate> {
  const response = await client.patch<RecurringTaskTemplate>(
    `/api/bujo/recurring-templates/${templateId}/`,
    patch,
  )
  return response.data
}

export function useUpdateRecurringTemplateMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateRecurringTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.bujo.recurringTemplates() })
    },
  })
}

interface PlaceRecurringTemplateVariables {
  templateId: string
  weekStart?: string
  monthFirst?: string
  scheduledDate?: string | null
}

async function placeRecurringTemplate({
  templateId,
  ...fields
}: PlaceRecurringTemplateVariables): Promise<Task> {
  const response = await client.post<Task>(
    `/api/bujo/recurring-templates/${templateId}/place/`,
    fields,
  )
  return response.data
}

export function usePlaceRecurringTemplateMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: placeRecurringTemplate,
    onSuccess: () => {
      // A lista de templates ativos não muda com um placement, mas simplifica
      // invalidar por prefixo; o log afetado (semanal ou mensal) sim muda —
      // mesma técnica de invalidação cruzada de useMigrateTaskMutation:
      // invalidar ambos os prefixos é seguro mesmo quando só um se aplica.
      queryClient.invalidateQueries({ queryKey: keys.bujo.recurringTemplates() })
      queryClient.invalidateQueries({ queryKey: ['bujo', 'weeklyLog'] })
      queryClient.invalidateQueries({ queryKey: ['bujo', 'monthlyLog'] })
      // Story 11.4: colocar um anual do Future Log pode cair num mês futuro
      // (diferente de Weekly/MonthlyPage, que só colocam no período corrente
      // já visível) — sem isso, o grupo novo não aparece no Future Log sem
      // refresh manual da página.
      queryClient.invalidateQueries({ queryKey: keys.bujo.futureLog() })
      // Colocar um recorrente cria uma Task no período → a densidade muda.
      // Prefixo alcança o sentinel 'current' e qualquer mês (Story 11.3).
      queryClient.invalidateQueries({ queryKey: ['bujo', 'taskDensity'] })
    },
  })
}

async function fetchTaskDensity(monthFirst?: string): Promise<TaskDensityEntry[]> {
  const response = await client.get<TaskDensityResponse>('/api/bujo/task-density/', {
    // snake_case no fio, igual a fetchMonthlyLog/fetchWeeklyLog.
    params: monthFirst ? { month_first: monthFirst } : undefined,
  })
  return response.data.density
}

// Densidade de tarefas por dia do mês (Story 11.3). Molde de useMonthlyLogQuery,
// mas com `enabled` repassado: o modal de placement só busca quando aberto (o
// MUI Dialog desmonta os filhos com open=false, mas passamos enabled:open para
// não disparar fetch prematuro na montagem). `month_first` é obrigatório no
// backend, então sempre passamos o mês em questão.
export function useTaskDensityQuery(monthFirst?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: keys.bujo.taskDensity(monthFirst),
    queryFn: () => fetchTaskDensity(monthFirst),
    enabled: options?.enabled ?? true,
  })
}

async function fetchArchive(): Promise<ArchiveEntry[]> {
  const response = await client.get<ArchiveEntry[]>('/api/bujo/archive/')
  return response.data
}

export function useArchiveQuery() {
  return useQuery({
    queryKey: keys.bujo.archive(),
    queryFn: fetchArchive,
  })
}
