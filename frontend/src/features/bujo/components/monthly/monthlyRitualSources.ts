// ─────────────────────────────────────────────────────────────────────────────
// Lógica PURA das 3 fontes do ritual mensal (Story 14.6, AC5) — normalização de
// forma (RitualTaskItem/RitualTemplateItem → uma forma única) e a matriz de
// ações autorizadas por fonte (M07, literal):
//
//   ▶ `Alocar` (mutação real via `place/`) SÓ em `recurring` — a matriz do
//     backend (`ALLOWED_DECISIONS`) NÃO tem célula `(monthly, template)`:
//     recorrentes mensais/anuais nunca têm decisão-snapshot.
//   ▶ `Manter sem dia` (snapshot `keep_undated`) SÓ em `future-log` — a ÚNICA
//     combinação válida da matriz para alvo mensal.
//   ▶ `previous-monthly` (a fonte bloqueante) escoa SÓ por mutação — `decision`
//     é sempre `null` na resposta, nunca oferece "Manter".
// ─────────────────────────────────────────────────────────────────────────────
import { isoOf, lastDayOfMonth, parseLocalDate } from '../../../../shared/date'
import type {
  BlockingTaskSource,
  MonthlyRecurringSource,
  RitualTaskItem,
  RitualTemplateItem,
  TaskSource,
} from '../../types'

export const MONTHLY_RITUAL_SOURCE_ORDER = ['recurring', 'future-log', 'previous-monthly'] as const

export type MonthlyRitualSourceId = (typeof MONTHLY_RITUAL_SOURCE_ORDER)[number]

export const MONTHLY_RITUAL_SOURCE_LABEL: Record<MonthlyRitualSourceId, string> = {
  recurring: 'Recorrentes',
  'future-log': 'Future Log',
  'previous-monthly': 'Monthly anterior',
}

export type MonthlyRitualAction =
  | 'allocate'
  | 'defer_to_future_log'
  | 'keep_undated'
  | 'migrate_named_day'
  | 'choose_destination'
  | 'complete'
  | 'cancel'

export const MONTHLY_RITUAL_ACTION_LABEL: Record<MonthlyRitualAction, string> = {
  allocate: 'Alocar',
  defer_to_future_log: 'Adiar ao Future Log',
  keep_undated: 'Manter sem dia',
  migrate_named_day: 'Migrar para',
  choose_destination: 'Escolher destino…',
  complete: 'Concluir',
  cancel: 'Cancelar',
}

/** Conjunto AUTORIZADO e ESTÁVEL por fonte (não varia por item da mesma
 * fonte) — `Migrar para <dia>` e `Escolher destino…` sempre juntos quando a
 * fonte tem itens de Task (mesma convenção da 14.5). */
export const MONTHLY_RITUAL_SOURCE_ACTIONS: Record<MonthlyRitualSourceId, MonthlyRitualAction[]> = {
  recurring: ['allocate', 'defer_to_future_log'],
  'future-log': ['migrate_named_day', 'choose_destination', 'keep_undated', 'defer_to_future_log'],
  'previous-monthly': [
    'migrate_named_day',
    'choose_destination',
    'complete',
    'cancel',
    'defer_to_future_log',
  ],
}

export const MONTHLY_RITUAL_SOURCE_BLOCKING: Record<MonthlyRitualSourceId, boolean> = {
  recurring: false,
  'future-log': false,
  'previous-monthly': true,
}

export interface NormalizedRitualItem {
  id: string
  kind: 'task' | 'template'
  title: string
  decision: string | null
  /** Só itens de Task — usado pelo seletor de destino mensal (preserva o dia
   * de origem quando aplicável). */
  scheduledDate?: string | null
  /** Só itens de template — distingue `monthly`/`annual` dentro de `items`
   * (AC5: "são 4 buckets observáveis, não 3"). */
  recurrenceGroup?: RitualTemplateItem['template']['recurrenceGroup']
  /** Só exibido, NUNCA parseado (AD-08 item 4; M07 explícito). */
  recurrenceText?: string
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
    recurrenceGroup: item.template.recurrenceGroup,
    recurrenceText: item.template.recurrenceText,
    instancesInTargetCount: item.instancesInTargetCount,
  }))
}

export interface AlreadyPlacedBuckets {
  /** Mensal já alocado no mês-alvo. */
  alreadyPlaced: NormalizedRitualItem[]
  /** Anual já alocado no ano do mês-alvo. */
  alreadyPlacedInYear: NormalizedRitualItem[]
}

/** Os 2 buckets FORA do progresso da fonte Recorrentes (AC5/AC6) — nunca
 * aparecem na lista de decisões, só como contexto informativo. */
export function normalizeAlreadyPlacedBuckets(
  data: MonthlyRecurringSource | undefined,
): AlreadyPlacedBuckets {
  if (!data) return { alreadyPlaced: [], alreadyPlacedInYear: [] }
  return {
    alreadyPlaced: normalizeTemplateItems(data.alreadyPlaced.items),
    alreadyPlacedInYear: normalizeTemplateItems(data.alreadyPlacedInYear.items),
  }
}

/** Normaliza qualquer uma das 3 fontes-com-endpoint para a forma única EM
 * PROGRESSO (decidível) — os 2 buckets `alreadyPlaced*` da fonte Recorrentes
 * ficam de fora (ver `normalizeAlreadyPlacedBuckets`), pois nunca entram no
 * fluxo de decisão. */
export function normalizeSource(
  sourceId: MonthlyRitualSourceId,
  data: MonthlyRecurringSource | TaskSource | BlockingTaskSource | undefined,
): NormalizedRitualItem[] {
  if (!data) return []
  if (sourceId === 'recurring') {
    return normalizeTemplateItems((data as MonthlyRecurringSource).items)
  }
  return normalizeTaskItems((data as TaskSource | BlockingTaskSource).items)
}

/** `Pendentes de decisão` (durável, o que a API devolve) vs. `Tudo`: união do
 * durável (`decision !== null`, itens que a fonte ainda devolve) com o
 * efêmero (mutados NESTA visita — desaparecem da fonte por completo, então
 * só sobrevivem no snapshot local do componente). Mesmo padrão da 14.5. */
/** "Mesmo dia do mês de origem, com clamp" (AC5/AD-08) — o atalho
 * `migrate_named_day` do `MonthlyDecisionList` e o `MonthlyDestinationPicker`
 * reusam esta única aritmética, em vez de duplicá-la em dois arquivos. */
export function sameDayOfMonthClamped(originIso: string | null | undefined, targetMonthFirst: string): string {
  const [year, month] = targetMonthFirst.split('-').map(Number)
  const lastDay = lastDayOfMonth(targetMonthFirst)
  const day = originIso ? parseLocalDate(originIso).getDate() : 1
  return isoOf(new Date(year, month - 1, Math.min(day, lastDay)))
}

export function itemsForView(
  items: NormalizedRitualItem[],
  view: 'pending' | 'all',
  mutatedThisVisit: NormalizedRitualItem[],
): NormalizedRitualItem[] {
  if (view === 'pending') return items.filter((item) => item.decision === null)
  return [...items.filter((item) => item.decision !== null), ...mutatedThisVisit]
}
