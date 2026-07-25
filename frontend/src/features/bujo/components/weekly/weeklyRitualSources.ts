// ─────────────────────────────────────────────────────────────────────────────
// Lógica PURA das 5 fontes do ritual semanal (Story 14.5, AC5) — normalização
// de forma (RitualTaskItem/RitualTemplateItem/PendingDailyGroup → uma forma
// única) e a matriz de ações autorizadas por fonte (M06, literal):
//
//   ▶ `Manter` (snapshot `keep`) SÓ em `monthly-in-week`.
//   ▶ `Não alocar nesta semana` (snapshot `skip_week`) SÓ em `recurring`.
//   ▶ As demais fontes escoam SÓ por mutação — a matriz do backend
//     (`ALLOWED_DECISIONS`) casa apenas *tipos* de alvo/item, então um `keep`
//     disparado a partir de `previous-weekly`/`pending-dailies` seria
//     ACEITO com 201 e criaria decisão fantasma (mesma armadilha do achado A1
//     da Story 14.2) — por isso a UI nunca oferece o botão fora da célula.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  BlockingTaskSource,
  PendingDailiesSource,
  RitualTaskItem,
  RitualTemplateItem,
  TaskSource,
  WeeklyRecurringSource,
} from '../../types'

export const WEEKLY_RITUAL_SOURCE_ORDER = [
  'monthly-in-week',
  'monthly-expanded',
  'recurring',
  'previous-weekly',
  'pending-dailies',
] as const

export type WeeklyRitualSourceId = (typeof WEEKLY_RITUAL_SOURCE_ORDER)[number]

export const WEEKLY_RITUAL_SOURCE_LABEL: Record<WeeklyRitualSourceId, string> = {
  'monthly-in-week': 'Monthly na semana',
  'monthly-expanded': 'Monthly ampliado',
  recurring: 'Recorrentes',
  'previous-weekly': 'Weekly anterior',
  'pending-dailies': 'Daily pendentes',
}

export type WeeklyRitualAction =
  | 'keep'
  | 'skip_week'
  | 'migrate_named_day'
  | 'choose_destination'
  | 'complete'
  | 'cancel'
  | 'allocate'

export const WEEKLY_RITUAL_ACTION_LABEL: Record<WeeklyRitualAction, string> = {
  keep: 'Manter',
  skip_week: 'Não alocar nesta semana',
  migrate_named_day: 'Migrar para',
  choose_destination: 'Escolher destino…',
  complete: 'Concluir',
  cancel: 'Cancelar',
  allocate: 'Alocar',
}

/** Conjunto AUTORIZADO e ESTÁVEL por fonte (não varia por item da mesma
 * fonte) — `Migrar para <dia>` e `Escolher destino…` sempre juntos quando a
 * fonte tem itens de Task (nunca um sem o outro). */
export const WEEKLY_RITUAL_SOURCE_ACTIONS: Record<WeeklyRitualSourceId, WeeklyRitualAction[]> = {
  'monthly-in-week': ['keep', 'migrate_named_day', 'choose_destination', 'complete', 'cancel'],
  'monthly-expanded': ['migrate_named_day', 'choose_destination', 'complete', 'cancel'],
  recurring: ['allocate', 'skip_week'],
  'previous-weekly': ['migrate_named_day', 'choose_destination', 'complete', 'cancel'],
  'pending-dailies': ['migrate_named_day', 'choose_destination', 'complete', 'cancel'],
}

export const WEEKLY_RITUAL_SOURCE_BLOCKING: Record<WeeklyRitualSourceId, boolean> = {
  'monthly-in-week': false,
  'monthly-expanded': false,
  recurring: false,
  'previous-weekly': true,
  'pending-dailies': false,
}

export interface NormalizedRitualItem {
  id: string
  kind: 'task' | 'template'
  title: string
  decision: string | null
  /** Só itens de Task — usado pelo atalho "Migrar para `<dia>`" (preserva o
   * dia de origem). */
  scheduledDate?: string | null
  /** Só `pending-dailies` — a data do Daily Log de origem (agrupamento). */
  groupLabel?: string
  instancesInTargetCount?: number
}

export function normalizeTaskItems(items: RitualTaskItem[]): NormalizedRitualItem[] {
  return items.map((item) => ({
    id: item.task.id,
    kind: 'task',
    title: item.task.title,
    decision: item.decision,
    scheduledDate: item.task.scheduledDate,
  }))
}

export function normalizeTemplateItems(items: RitualTemplateItem[]): NormalizedRitualItem[] {
  return items.map((item) => ({
    id: item.template.id,
    kind: 'template',
    title: item.template.title,
    decision: item.decision,
    instancesInTargetCount: item.instancesInTargetCount,
  }))
}

export function normalizePendingDailyGroups(
  groups: PendingDailiesSource['groups'],
): NormalizedRitualItem[] {
  return groups.flatMap((group) =>
    group.items.map((item) => ({
      id: item.task.id,
      kind: 'task' as const,
      title: item.task.title,
      decision: item.decision,
      scheduledDate: item.task.scheduledDate,
      groupLabel: group.date,
    })),
  )
}

/** Normaliza qualquer uma das 4 fontes-com-endpoint para a forma única. */
export function normalizeSource(
  sourceId: WeeklyRitualSourceId,
  data: TaskSource | BlockingTaskSource | WeeklyRecurringSource | PendingDailiesSource | undefined,
): NormalizedRitualItem[] {
  if (!data) return []
  if (sourceId === 'recurring') {
    return normalizeTemplateItems((data as WeeklyRecurringSource).items)
  }
  if (sourceId === 'pending-dailies') {
    return normalizePendingDailyGroups((data as PendingDailiesSource).groups)
  }
  return normalizeTaskItems((data as TaskSource | BlockingTaskSource).items)
}

/** `Pendentes de decisão` (durável, o que a API devolve) vs. `Tudo`: união do
 * durável (`decision !== null`, itens que a fonte ainda devolve) com o
 * efêmero (mutados NESTA visita — desaparecem da fonte por completo, então
 * só sobrevivem no snapshot local do componente). */
export function itemsForView(
  items: NormalizedRitualItem[],
  view: 'pending' | 'all',
  mutatedThisVisit: NormalizedRitualItem[],
): NormalizedRitualItem[] {
  if (view === 'pending') return items.filter((item) => item.decision === null)
  return [...items.filter((item) => item.decision !== null), ...mutatedThisVisit]
}
