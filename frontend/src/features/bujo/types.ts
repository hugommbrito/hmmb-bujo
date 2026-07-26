import type { components } from '../../api/types.gen'

export type Log = components['schemas']['Log']
export type Task = components['schemas']['Task']
export type TaskStatus = components['schemas']['StatusEnum']
export type TaskCategory = components['schemas']['CategoryEnum']
export type TaskEisenhower = components['schemas']['EisenhowerEnum']
export type WeeklyDay = components['schemas']['WeeklyDay']
export type WeeklyLog = components['schemas']['WeeklyLog']
export type MonthlyLog = components['schemas']['MonthlyLog']
export type FutureLogMonthGroup = components['schemas']['FutureLogMonthGroup']
// Story 14.7 (M08) — trilho do Future Log: horizonte fixo de 8 meses + meses
// distantes com item. Aditivos ao `FutureLogMonthGroup` acima, que segue servindo
// o `GET /api/bujo/future-log/` legado.
export type FutureLogHorizon = components['schemas']['FutureLogHorizon']
export type FutureLogMonthCount = components['schemas']['FutureLogMonthCount']
export type MigrationQueue = components['schemas']['MigrationQueue']
export type WeeklyReviewQueue = components['schemas']['WeeklyReviewQueue']
export type MonthlyReviewQueue = components['schemas']['MonthlyReviewQueue']
export type CatchUpQueue = components['schemas']['CatchUpQueue']
export type RecurringTaskTemplate = components['schemas']['RecurringTaskTemplate']
export type RecurrenceGroup = components['schemas']['RecurrenceGroupEnum']
export type TaskDensityEntry = components['schemas']['TaskDensityEntry']
export type TaskDensityResponse = components['schemas']['TaskDensityResponse']
export type ArchiveEntry = components['schemas']['ArchiveEntry']

// --- Épico 14 (Story 14.5): ciclo, rituais, decisões e densidade real --------
export type WeeklyCycle = components['schemas']['WeeklyCycle']
export type WeeklyCycleAction = components['schemas']['WeeklyCycleAction']
export type WeeklyCycleReadiness = components['schemas']['WeeklyCycleReadiness']
export type TaskSource = components['schemas']['TaskSource']
export type BlockingTaskSource = components['schemas']['BlockingTaskSource']
export type WeeklyRecurringSource = components['schemas']['WeeklyRecurringSource']
export type PendingDailiesSource = components['schemas']['PendingDailiesSource']
export type RitualTaskItem = components['schemas']['RitualTaskItem']
export type RitualTemplateItem = components['schemas']['RitualTemplateItem']
export type _TemplateBucket = components['schemas']['_TemplateBucket']
export type DensityResponse = components['schemas']['DensityResponse']
export type DensityDay = components['schemas']['DensityDay']
export type DensityCell = components['schemas']['DensityCell']
export type DensityStatusBreakdown = components['schemas']['DensityStatusBreakdown']
export type RitualDecision = components['schemas']['RitualDecision']
export type RitualDecisionCreate = components['schemas']['RitualDecisionCreate']
export type DecisionEnum = components['schemas']['DecisionEnum']

// --- Story 14.6: ciclo mensal (leitura de prontidão) e fonte recorrente -------
export type MonthlyCycle = components['schemas']['MonthlyCycle']
export type MonthlyCycleAction = components['schemas']['MonthlyCycleAction']
export type MonthlyCycleReadiness = components['schemas']['MonthlyCycleReadiness']
export type MonthlyStartReadiness = components['schemas']['MonthlyStartReadiness']
export type MonthlyFinalizeReadiness = components['schemas']['MonthlyFinalizeReadiness']
export type MonthlyRecurringSource = components['schemas']['MonthlyRecurringSource']

// Uniões que o gerador NÃO produz — `openapi-typescript` não estreita campos
// declarados como `CharField(allow_null=True)` no backend (não `ChoiceField`),
// então `WeeklyLog.status`/`WeeklyCycle.status` chegam como `string | null` e
// `RitualTaskItem.decision`/`RitualTemplateItem.decision` como `string | null`.
export type CycleStatus = 'planning' | 'active' | 'finalized' | null

/** As 4 fontes do ritual semanal com endpoint próprio (`Monthly ampliado` não
 * tem fonte dedicada — usa `GET /logs/monthly/` direto). */
export type WeeklySourceId =
  | 'monthly-in-week'
  | 'recurring'
  | 'previous-weekly'
  | 'pending-dailies'

/** Estreitamento nomeado de `DecisionEnum` para os campos `decision` de item
 * de fonte (`string | null` no tipo gerado). */
export type RitualDecisionKind = DecisionEnum
