export {
  useTodayLogQuery,
  useTransitionTaskMutation,
  useCreateTaskMutation,
  useCreateSubtaskMutation,
  useUpdateTaskMutation,
  useReorderTaskMutation,
  useWeeklyLogQuery,
  useMonthlyLogQuery,
  useFutureLogQuery,
  useFutureHorizonQuery,
  useCreateMonthlyTaskMutation,
  useCreateWeeklyTaskMutation,
  useDeleteTaskMutation,
  useMigrationQueueQuery,
  useUnifiedMigrationQueueQuery,
  useMigrateTaskMutation,
  useWeeklyReviewQueueQuery,
  useMonthlyReviewQueueQuery,
  useCatchUpQueueQuery,
  useRecurringTemplatesQuery,
  useCreateRecurringTemplateMutation,
  useUpdateRecurringTemplateMutation,
  useDeleteRecurringTemplateMutation,
  usePlaceRecurringTemplateMutation,
  useTaskDensityQuery,
  useArchiveQuery,
  invalidateRitualQueries,
  useWeeklyCycleReadinessQuery,
  useWeeklyCycleActionMutation,
  useRitualTaskTransitionMutation,
  useMonthlyInWeekSourceQuery,
  useWeeklyRecurringSourceQuery,
  usePreviousWeeklySourceQuery,
  usePendingDailiesSourceQuery,
  useWeeklyDensityQuery,
  useRitualDecisionMutation,
  useMonthlyCycleReadinessQuery,
  useMonthlyCycleActionMutation,
  useMonthlyRecurringSourceQuery,
  useMonthlyFutureLogSourceQuery,
  usePreviousMonthlySourceQuery,
  useMonthlyDensityQuery,
} from './api'
export { MigrationBanner } from './components/MigrationBanner'
export { WeeklyReviewBanner } from './components/WeeklyReviewBanner'
export { MonthlyReviewBanner } from './components/MonthlyReviewBanner'
export { CatchUpBanner } from './components/CatchUpBanner'
// Story 14.9 (M10) — banner unificado que substitui MigrationBanner+CatchUpBanner
// em DailyPage.tsx (os dois seguem exportados acima, intocados, para rollback).
export { MigrationRitualBanner } from './components/migration/MigrationRitualBanner'
export { RecurringTemplateManager } from './components/RecurringTemplateManager'
export { RecurringPlacementSection } from './components/RecurringPlacementSection'
export { MonthDensityCalendar } from './components/MonthDensityCalendar'
// Seletor de destino agnóstico de domínio — `Dialog` portalizado no não-compact,
// `Drawer` no compact. Compartilhado entre os rituais (Weekly/Monthly Planning)
// e, na sequência, o "Mover tarefa" dos boards (DW-27).
export { DestinationDialog } from './components/DestinationDialog'
export type {
  DestinationDialogProps,
  DestinationOffer,
  DestinationOfferList,
  DestinationDayOffer,
  DayOfferWeek,
  DayOfferMonth,
  DayOfferNone,
  DayOfferMonthChoice,
  DestinationConfirmMeta,
  DestinationSelection,
} from './components/DestinationDialog'
export { TaskRowBase } from './components/TaskRowBase'
export { TaskDetailCard } from './components/TaskDetailCard'
// Story 14.8 (M09): componentes de RAIZ do sistema novo — a Item Row (irmã da
// Task Row, sem máquina de estados) e os dois controles canônicos extraídos do
// `TaskDetailCard`, compartilhados pelos dois cards de detalhe.
export { ItemRowBase } from './components/ItemRowBase'
export { CategorySwatchGroup } from './components/CategorySwatchGroup'
export { EisenhowerCheckboxPair } from './components/EisenhowerCheckboxPair'
export { TemplateDetailCard } from './components/TemplateDetailCard'
export { taskStatusIconFor, taskStatusIcons, TASK_STATUS_ICON_SIZE } from './components/taskStatusIcons'
export type { MigrationDestination } from './api'
export type {
  Log,
  Task,
  TaskStatus,
  TaskCategory,
  TaskEisenhower,
  WeeklyDay,
  WeeklyLog,
  MonthlyLog,
  FutureLogMonthGroup,
  FutureLogHorizon,
  FutureLogMonthCount,
  MigrationQueue,
  WeeklyReviewQueue,
  MonthlyReviewQueue,
  CatchUpQueue,
  UnifiedMigrationQueue,
  UnifiedQueueSection,
  UnifiedQueueGroup,
  RecurringTaskTemplate,
  RecurrenceGroup,
  TaskDensityEntry,
  TaskDensityResponse,
  ArchiveEntry,
  MigrationTarget,
  MigrationTargetType,
  WeeklyCycle,
  WeeklyCycleAction,
  WeeklyCycleReadiness,
  TaskSource,
  BlockingTaskSource,
  WeeklyRecurringSource,
  PendingDailiesSource,
  RitualTaskItem,
  RitualTemplateItem,
  _TemplateBucket,
  DensityResponse,
  DensityDay,
  DensityCell,
  DensityStatusBreakdown,
  RitualDecision,
  RitualDecisionCreate,
  DecisionEnum,
  CycleStatus,
  WeeklySourceId,
  RitualDecisionKind,
  MonthlyCycle,
  MonthlyCycleAction,
  MonthlyCycleReadiness,
  MonthlyStartReadiness,
  MonthlyFinalizeReadiness,
  MonthlyRecurringSource,
} from './types'
