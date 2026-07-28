import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import client from '../../api/client'
import { keys } from '../../api/keys'
import { useOptimisticMutation } from '../../shared/hooks/useOptimisticMutation'
import { mapTaskTree, reorderTaskTree } from './taskTree'
import type {
  ArchiveEntry,
  BlockingTaskSource,
  CatchUpQueue,
  DensityResponse,
  FutureLogHorizon,
  FutureLogMonthGroup,
  Log,
  MigrationQueue,
  MonthlyCycle,
  MonthlyCycleAction,
  MonthlyCycleReadiness,
  MonthlyLog,
  MonthlyRecurringSource,
  MonthlyReviewQueue,
  PendingDailiesSource,
  RecurrenceGroup,
  RecurringTaskTemplate,
  RitualDecision,
  RitualDecisionCreate,
  Task,
  TaskCategory,
  TaskDensityEntry,
  TaskDensityResponse,
  TaskEisenhower,
  TaskSource,
  TaskStatus,
  UnifiedMigrationQueue,
  WeeklyCycle,
  WeeklyCycleAction,
  WeeklyCycleReadiness,
  WeeklyLog,
  WeeklyRecurringSource,
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
    // Story 14.10: campo aditivo, sempre `null` no otimista (nenhuma criação
    // otimista nasce com sucessor de migração).
    migrationTarget: null,
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
    onSuccess: () => {
      // Prefixo (não a chave exata `keys.bujo.weeklyLog(variables.weekStart)`):
      // a view SEM navegação explícita usa a chave sentinel 'current'
      // (`useWeeklyLogQuery()`), que nunca bate com a data real devolvida pelo
      // servidor — invalidar por prefixo alcança as duas (Story 14.5, Task 12,
      // gap real: criar tarefa na semana corrente não atualizava a lista).
      queryClient.invalidateQueries({ queryKey: ['bujo', 'weeklyLog'] })
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
      // Story 14.7 (code review, 4ª ocorrência da classe de bug da AC9): o
      // Future Log é a PRIMEIRA superfície a fiar "Excluir tarefa" do
      // `TaskDetailCard` sobre `monthly_log` futuros (a AC5 mantém o botão de
      // propósito) E a exibir contagens vindas de `keys.bujo.futureHorizon()`.
      // Sem este prefixo, excluir um item pelo detalhe atualiza a coluna de
      // foco (`monthlyLog` acima) e deixa o TRILHO dizendo "3 itens" enquanto a
      // lista mostra 2 — exatamente o que a AC4 proíbe ("atualiza lista,
      // contagens do trilho e cabeçalho de foco").
      queryClient.invalidateQueries({ queryKey: ['bujo', 'futureLog'] })
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

// `enabled` (Story 14.5, Task 8): a fonte `Monthly ampliado` do ritual só
// consulta SOB SELEÇÃO — o endpoint materializa o Monthly Log (`get_or_create`
// de propósito), e uma leitura eager a cada abertura do ritual materializaria
// meses que o usuário nunca visitou.
export function useMonthlyLogQuery(monthFirst?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: keys.bujo.monthlyLog(monthFirst),
    queryFn: () => fetchMonthlyLog(monthFirst),
    enabled: options?.enabled ?? true,
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

async function fetchFutureHorizon(): Promise<FutureLogHorizon> {
  const response = await client.get<FutureLogHorizon>('/api/bujo/future-log/horizon/')
  return response.data
}

/**
 * Trilho do Future Log (Story 14.7, AC2): horizonte fixo de 8 meses — vazios
 * inclusive — + meses distantes com item. Endpoint NOVO, aditivo: `/future-log/`
 * (consumido por `useFutureLogQuery` acima) segue com contrato idêntico.
 */
export function useFutureHorizonQuery() {
  return useQuery({
    queryKey: keys.bujo.futureHorizon(),
    queryFn: fetchFutureHorizon,
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
    onSuccess: () => {
      // Prefixo (não a chave exata `keys.bujo.monthlyLog(variables.monthFirst)`):
      // mesma classe de bug que useCreateWeeklyTaskMutation teve corrigida na
      // 14.5 — a view SEM navegação explícita usa a chave sentinel 'current',
      // que nunca bate com a data real devolvida pelo servidor (Story 14.6, AC9).
      queryClient.invalidateQueries({ queryKey: ['bujo', 'monthlyLog'] })
      // PREFIXO `['bujo','futureLog']`, não a chave exata `keys.bujo.futureLog()`
      // (Story 14.7, AC9): a partir do M08 existe uma SEGUNDA chave sob esse
      // prefixo — `keys.bujo.futureHorizon()` = ['bujo','futureLog','horizon'],
      // o trilho de 8 meses. `['bujo','futureLog','list']` não é prefixo de
      // 'horizon', então a invalidação exata deixaria o trilho e as contagens
      // desatualizados depois de capturar num mês distante. É a TERCEIRA
      // ocorrência desta classe de bug (14.5: useCreateWeeklyTaskMutation;
      // 14.6: o `monthlyLog` da linha acima).
      queryClient.invalidateQueries({ queryKey: ['bujo', 'futureLog'] })
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

async function fetchUnifiedMigrationQueue(): Promise<UnifiedMigrationQueue> {
  const response = await client.get<UnifiedMigrationQueue>('/api/bujo/migration/unified-queue/')
  return response.data
}

/**
 * Fila única de migração (Story 14.3, sem consumidor de frontend até a 14.9) —
 * único dado de leitura do ritual roteado (`MigrationRitualPage`) e do banner
 * unificado no Hoje (`MigrationRitualBanner`). Mesmo endpoint que já alimenta
 * `useMigrationQueueQuery`/`useCatchUpQueueQuery` (aliases finos, Story 14.3).
 */
export function useUnifiedMigrationQueueQuery() {
  return useQuery({
    queryKey: keys.bujo.unifiedMigrationQueue(),
    queryFn: fetchUnifiedMigrationQueue,
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
      // Story 14.9 (M10): a fila unificada é o único dado de leitura do ritual
      // roteado e do banner unificado — toda decisão de migração precisa
      // re-derivar essa fila, do mesmo jeito que já invalida os dois aliases
      // finos acima (mesmo endpoint na origem, `services/migration.py`).
      queryClient.invalidateQueries({ queryKey: keys.bujo.unifiedMigrationQueue() })
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

// `enabled` (Story 14.7): mesmo molde de `useMonthlyLogQuery`/`useTaskDensityQuery`
// — o Future Log só sabe qual ANO consultar depois que o horizonte responde (o
// ano vem do âncora do servidor, nunca de `new Date()`), e sem o guard a query
// dispararia uma vez com `unplacedYear: undefined` (chave diferente, resposta
// inútil) antes de disparar de novo com o ano certo. Default `true` = todos os
// consumidores anteriores intocados.
export function useRecurringTemplatesQuery(
  params?: RecurringTemplatesParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: keys.bujo.recurringTemplates(params),
    queryFn: () => fetchRecurringTemplates(params),
    enabled: options?.enabled ?? true,
  })
}

interface RecurringTemplateFields {
  title: string
  description?: string | null
  eisenhower?: TaskEisenhower | null
  category?: TaskCategory | null
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

/**
 * Invalidação COMPARTILHADA das três mutações da biblioteca de templates
 * (create/update/delete) — Story 14.8, AC8.
 *
 *   ▶ `keys.bujo.recurringTemplates()` resolve para
 *     `['bujo','recurringTemplates','list',{}]` e JÁ alcança as variantes
 *     parametrizadas: `partialMatchKey` do `@tanstack/query-core` faz *partial
 *     deep match* (`Object.keys(b).every(...)`) e `{}` é subconjunto de
 *     qualquer objeto de params. Isto NÃO é a classe de bug das 14.5/14.6/14.7
 *     (lá as chaves eram irmãs por SUFIXO — `list` × `horizon`; aqui é o mesmo
 *     sufixo com params) e não deve ser "corrigido".
 *
 *   ▶ Os três prefixos consumidores são ADITIVOS e baratos — CONSISTÊNCIA, não
 *     conserto de bug: com `staleTime: 0` (`api/queryClient.ts`) a navegação
 *     entre rotas já refaz o fetch. A razão concreta está registrada pelo passo
 *     de QA da 14.4: excluir o último recorrente pendente ENCERRA a pendência
 *     da fonte — `pendingDecisionCount`/`reviewed` são computados na leitura, e
 *     o soft delete mexe no progresso do ritual.
 */
function invalidateRecurringTemplateConsumers(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: keys.bujo.recurringTemplates() })
  queryClient.invalidateQueries({ queryKey: ['bujo', 'ritualWeeklySource'] })
  queryClient.invalidateQueries({ queryKey: ['bujo', 'ritualMonthlySource'] })
  queryClient.invalidateQueries({ queryKey: ['bujo', 'futureLog'] })
}

export function useCreateRecurringTemplateMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createRecurringTemplate,
    onSuccess: () => invalidateRecurringTemplateConsumers(queryClient),
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
    onSuccess: () => invalidateRecurringTemplateConsumers(queryClient),
  })
}

interface DeleteRecurringTemplateVariables {
  templateId: string
}

/**
 * SOFT DELETE (Story 14.4, backend; Story 14.8, cliente). O servidor responde
 * **204** e é IDEMPOTENTE: repetir o DELETE sobre um template já excluído
 * continua respondendo 204. A exclusão é LÓGICA — `deleted_at` sai de todos os
 * pontos de leitura via `live_templates()` (AD-08 item 6b), mas as tarefas já
 * criadas a partir do template PRESERVAM a linhagem (`sourceTemplate` continua
 * válido). Sem corpo na requisição.
 */
async function deleteRecurringTemplate({
  templateId,
}: DeleteRecurringTemplateVariables): Promise<void> {
  await client.delete(`/api/bujo/recurring-templates/${templateId}/`)
}

export function useDeleteRecurringTemplateMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteRecurringTemplate,
    onSuccess: () => invalidateRecurringTemplateConsumers(queryClient),
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
      // refresh manual da página. PREFIXO desde a 14.7 (AC9): alcança também
      // `keys.bujo.futureHorizon()`, sem o qual alocar um anual num mês do
      // horizonte não atualiza a contagem daquele mês no trilho.
      queryClient.invalidateQueries({ queryKey: ['bujo', 'futureLog'] })
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

// ─── Épico 14 (Story 14.5): ciclo, fontes do ritual e densidade real ─────────
//
// Sem otimismo (Dev Notes, ambiguidade #4): `useOptimisticMutation` cobre a
// forma do Brain Dump/Daily Log, diferente da forma de `WeeklyLog`
// (`days[]`+`unscheduled`), e o NFR de <2s não se aplica ao planejamento
// (AD-14). Falha de escrita deve preservar item/densidade/foco — invalidação
// por prefixo em `onSettled` é suficiente e mais simples.

/**
 * Invalidação única pós-decisão do ritual: cobre os prefixos que qualquer ação
 * de QUALQUER um dos dois rituais pode afetar — `weeklyLog`/`monthlyLog` (os
 * boards), `weeklyCycle`/`monthlyCycle` (os painéis de prontidão),
 * `ritualWeeklySource`/`ritualWeeklyDensity` + `ritualMonthlySource`/
 * `ritualMonthlyDensity` (as fontes e os rails) e `taskDensity` (densidade
 * legada, ainda consumida pelo Mês).
 *
 * Exportada para os call sites de AMBOS os rituais que reusam
 * `useMigrateTaskMutation`/`useRitualTaskTransitionMutation`/
 * `usePlaceRecurringTemplateMutation` para as ações mutantes (Migrar/Adiar/
 * Concluir/Cancelar/Alocar) — os 4 prefixos mensais foram acrescentados na
 * Story 14.6, AC9: sem eles, qualquer decisão do ritual MENSAL que passe por
 * essas mutações compartilhadas deixaria o Monthly Board e as fontes do
 * próprio ritual mensal com cache desatualizado após a ação.
 */
export function invalidateRitualQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['bujo', 'weeklyLog'] })
  queryClient.invalidateQueries({ queryKey: keys.bujo.weeklyCycle() })
  queryClient.invalidateQueries({ queryKey: ['bujo', 'ritualWeeklySource'] })
  queryClient.invalidateQueries({ queryKey: ['bujo', 'ritualWeeklyDensity'] })
  queryClient.invalidateQueries({ queryKey: ['bujo', 'monthlyLog'] })
  queryClient.invalidateQueries({ queryKey: keys.bujo.monthlyCycle() })
  queryClient.invalidateQueries({ queryKey: ['bujo', 'ritualMonthlySource'] })
  queryClient.invalidateQueries({ queryKey: ['bujo', 'ritualMonthlyDensity'] })
  // Story 14.7, AC9: toda decisão do ritual MENSAL que adia um item para o
  // Future Log (`destination:'future'`) muda o conteúdo E as contagens do
  // trilho do M08. Sem este prefixo, a superfície nova fica com trilho e
  // cabeçalho de foco desatualizados depois de qualquer uma das 4 mutações que
  // chamam esta função em `onSettled`.
  queryClient.invalidateQueries({ queryKey: ['bujo', 'futureLog'] })
  queryClient.invalidateQueries({ queryKey: ['bujo', 'taskDensity'] })
}

/**
 * Transição de status para o RITUAL (Concluir/Cancelar em `WeeklyPlanningPage`)
 * — reusa a mesma `mutationFn` de `transitionTask`, mas SEM `useOptimisticMutation`
 * (Dev Notes, ambiguidade #4: "nenhuma mutação otimista nesta story"). A versão
 * otimista (`useTransitionTaskMutation`) escreve direto no cache de
 * `keys.bujo.todayLog`, o que é errado aqui: um item do ritual (ex.: um Daily
 * pendente de `pending-dailies`) pode ser de qualquer dia, não necessariamente
 * "hoje", e o board/planejamento não usam esse cache.
 */
export function useRitualTaskTransitionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: transitionTask,
    onSuccess: () => invalidateRitualQueries(queryClient),
  })
}

async function fetchWeeklyCycleReadiness(): Promise<WeeklyCycleReadiness> {
  const response = await client.get<WeeklyCycleReadiness>('/api/bujo/logs/weekly/cycle/')
  return response.data
}

export function useWeeklyCycleReadinessQuery() {
  return useQuery({
    queryKey: keys.bujo.weeklyCycle(),
    queryFn: fetchWeeklyCycleReadiness,
  })
}

async function runWeeklyCycleAction(variables: WeeklyCycleAction): Promise<WeeklyCycle> {
  const response = await client.post<WeeklyCycle>('/api/bujo/logs/weekly/cycle/', variables)
  return response.data
}

export function useWeeklyCycleActionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: runWeeklyCycleAction,
    onSettled: () => invalidateRitualQueries(queryClient),
  })
}

async function fetchMonthlyInWeekSource(weekStart: string): Promise<TaskSource> {
  const response = await client.get<TaskSource>(
    '/api/bujo/rituals/weekly/sources/monthly-in-week/',
    { params: { week_start: weekStart } },
  )
  return response.data
}

export function useMonthlyInWeekSourceQuery(weekStart: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: keys.bujo.ritualWeeklySource('monthly-in-week', weekStart),
    queryFn: () => fetchMonthlyInWeekSource(weekStart),
    enabled: options?.enabled ?? true,
  })
}

async function fetchWeeklyRecurringSource(weekStart: string): Promise<WeeklyRecurringSource> {
  const response = await client.get<WeeklyRecurringSource>(
    '/api/bujo/rituals/weekly/sources/recurring/',
    { params: { week_start: weekStart } },
  )
  return response.data
}

export function useWeeklyRecurringSourceQuery(weekStart: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: keys.bujo.ritualWeeklySource('recurring', weekStart),
    queryFn: () => fetchWeeklyRecurringSource(weekStart),
    enabled: options?.enabled ?? true,
  })
}

async function fetchPreviousWeeklySource(weekStart: string): Promise<BlockingTaskSource> {
  const response = await client.get<BlockingTaskSource>(
    '/api/bujo/rituals/weekly/sources/previous-weekly/',
    { params: { week_start: weekStart } },
  )
  return response.data
}

export function usePreviousWeeklySourceQuery(weekStart: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: keys.bujo.ritualWeeklySource('previous-weekly', weekStart),
    queryFn: () => fetchPreviousWeeklySource(weekStart),
    enabled: options?.enabled ?? true,
  })
}

async function fetchPendingDailiesSource(weekStart: string): Promise<PendingDailiesSource> {
  const response = await client.get<PendingDailiesSource>(
    '/api/bujo/rituals/weekly/sources/pending-dailies/',
    { params: { week_start: weekStart } },
  )
  return response.data
}

export function usePendingDailiesSourceQuery(weekStart: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: keys.bujo.ritualWeeklySource('pending-dailies', weekStart),
    queryFn: () => fetchPendingDailiesSource(weekStart),
    enabled: options?.enabled ?? true,
  })
}

async function fetchWeeklyDensity(weekStart: string): Promise<DensityResponse> {
  const response = await client.get<DensityResponse>('/api/bujo/rituals/weekly/density/', {
    params: { week_start: weekStart },
  })
  return response.data
}

export function useWeeklyDensityQuery(weekStart: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: keys.bujo.ritualWeeklyDensity(weekStart),
    queryFn: () => fetchWeeklyDensity(weekStart),
    enabled: options?.enabled ?? true,
  })
}

async function createRitualDecision(variables: RitualDecisionCreate): Promise<RitualDecision> {
  const response = await client.post<RitualDecision>('/api/bujo/ritual-decisions/', variables)
  return response.data
}

export function useRitualDecisionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createRitualDecision,
    onSettled: () => invalidateRitualQueries(queryClient),
  })
}

// ─── Story 14.6: ciclo mensal (leitura de prontidão) e fontes do ritual ──────
// Molde direto do bloco Weekly acima — mesmas convenções (sem otimismo, params
// em snake_case, `enabled` repassado).

async function fetchMonthlyCycleReadiness(): Promise<MonthlyCycleReadiness> {
  const response = await client.get<MonthlyCycleReadiness>('/api/bujo/logs/monthly/cycle/')
  return response.data
}

export function useMonthlyCycleReadinessQuery() {
  return useQuery({
    queryKey: keys.bujo.monthlyCycle(),
    queryFn: fetchMonthlyCycleReadiness,
  })
}

async function runMonthlyCycleAction(variables: MonthlyCycleAction): Promise<MonthlyCycle> {
  const response = await client.post<MonthlyCycle>('/api/bujo/logs/monthly/cycle/', variables)
  return response.data
}

export function useMonthlyCycleActionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: runMonthlyCycleAction,
    onSettled: () => invalidateRitualQueries(queryClient),
  })
}

async function fetchMonthlyRecurringSource(monthFirst: string): Promise<MonthlyRecurringSource> {
  const response = await client.get<MonthlyRecurringSource>(
    '/api/bujo/rituals/monthly/sources/recurring/',
    { params: { month_first: monthFirst } },
  )
  return response.data
}

export function useMonthlyRecurringSourceQuery(
  monthFirst: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: keys.bujo.ritualMonthlySource('recurring', monthFirst),
    queryFn: () => fetchMonthlyRecurringSource(monthFirst),
    enabled: options?.enabled ?? true,
  })
}

// `future-log` não tem equivalente semanal 1:1 (o ritual semanal não tem fonte
// "Future Log") — segue o padrão geral de `TaskSourceSerializer`, mesma forma
// de `useMonthlyInWeekSourceQuery`, que também devolve `TaskSource`.
async function fetchMonthlyFutureLogSource(monthFirst: string): Promise<TaskSource> {
  const response = await client.get<TaskSource>(
    '/api/bujo/rituals/monthly/sources/future-log/',
    { params: { month_first: monthFirst } },
  )
  return response.data
}

export function useMonthlyFutureLogSourceQuery(
  monthFirst: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: keys.bujo.ritualMonthlySource('future-log', monthFirst),
    queryFn: () => fetchMonthlyFutureLogSource(monthFirst),
    enabled: options?.enabled ?? true,
  })
}

async function fetchPreviousMonthlySource(monthFirst: string): Promise<BlockingTaskSource> {
  const response = await client.get<BlockingTaskSource>(
    '/api/bujo/rituals/monthly/sources/previous-monthly/',
    { params: { month_first: monthFirst } },
  )
  return response.data
}

export function usePreviousMonthlySourceQuery(
  monthFirst: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: keys.bujo.ritualMonthlySource('previous-monthly', monthFirst),
    queryFn: () => fetchPreviousMonthlySource(monthFirst),
    enabled: options?.enabled ?? true,
  })
}

async function fetchMonthlyDensity(monthFirst: string): Promise<DensityResponse> {
  const response = await client.get<DensityResponse>('/api/bujo/rituals/monthly/density/', {
    params: { month_first: monthFirst },
  })
  return response.data
}

export function useMonthlyDensityQuery(monthFirst: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: keys.bujo.ritualMonthlyDensity(monthFirst),
    queryFn: () => fetchMonthlyDensity(monthFirst),
    enabled: options?.enabled ?? true,
  })
}
