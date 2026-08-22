// ─────────────────────────────────────────────────────────────────────────────
// Lógica PURA das 3 "fontes" do ritual de migração (Story 14.9, M10) — aqui
// "fonte" é NÍVEL (mês/semana/dia), não um endpoint próprio como no Weekly/
// Monthly ritual (14.5/14.6): as 3 vêm do MESMO dado de leitura,
// `unified_migration_queue` (Story 14.3), já em ordem mês→semana→dia
// (contrato do backend — esta camada NUNCA reordena).
//
//   ▶ Ao contrário de `weeklyRitualSources.ts`/`monthlyRitualSources.ts`, a
//     fila de migração não tem campo `decision`: um item PENDENTE de decisão
//     é, por definição, todo item que a fila devolve (ela só lista o que
//     ainda não foi migrado/adiado/cancelado). "Tudo" (pendentes + já
//     decididos NESTA visita) depende inteiramente do snapshot local
//     `mutatedThisVisit` que `MigrationRitualPage` mantém — mesmo padrão do
//     Weekly/Monthly, sem duplicar a mecânica aqui.
// ─────────────────────────────────────────────────────────────────────────────
import { formatDayLabel } from '../../../../shared/date'
import { capitalize, MONTH_NAMES_PT } from '../../monthNames'
import type { Task, UnifiedQueueSection } from '../../types'

/** Chave ÚNICA de `sessionStorage` (Design Notes da spec, item 2) — o total
 * `M` capturado no primeiro mount do ritual NESTA aba, consumido pelo banner
 * pausado ("N de M restantes"). Não é posição nem histórico: só um contador,
 * limpo quando a fila zera ou quando `M` já não bate com a realidade (itens
 * novos entraram — `MigrationRitualPage` recaptura no próximo mount). */
export const MIGRATION_SESSION_TOTAL_KEY = 'migrationRitualSessionTotal'

export const MIGRATION_SOURCE_ORDER = ['month', 'week', 'day'] as const

export type MigrationSourceId = (typeof MIGRATION_SOURCE_ORDER)[number]

export const MIGRATION_SOURCE_LABEL: Record<MigrationSourceId, string> = {
  month: 'Meses',
  week: 'Semanas',
  day: 'Dias',
}

export const MIGRATION_SOURCE_HEADING: Record<MigrationSourceId, string> = {
  month: 'De meses anteriores',
  week: 'De semanas anteriores',
  day: 'De dias anteriores',
}

export const MIGRATION_SOURCE_SUBTITLE: Record<MigrationSourceId, string> = {
  month: 'de ciclos anteriores',
  week: 'de semanas anteriores',
  day: 'inclui ontem',
}

/** Item único da fila achatada — um `Task` de raiz + a fonte/período de onde
 * veio (usado pelo rótulo de origem "De: <período>" e pelo agrupamento). */
export interface MigrationQueueItem {
  task: Task
  sourceId: MigrationSourceId
  /** "AAAA-MM-01" (mês), "AAAA-MM-DD" segunda-feira (semana) ou "AAAA-MM-DD"
   * (dia) — a chave de período do grupo de origem, como veio do backend. */
  periodStart: string
}

/** Achata `groups[].items[]` de UMA seção em uma lista plana de itens, cada um
 * carregando a própria fonte/período — a UI trabalha só com esta forma. */
function flattenSection(section: UnifiedQueueSection): MigrationQueueItem[] {
  const sourceId = section.sourceId as MigrationSourceId
  return section.groups.flatMap((group) =>
    group.items.map((task) => ({ task, sourceId, periodStart: group.periodStart })),
  )
}

/** Uma entrada por fonte, SEMPRE as 3 (mesmo vazias) — espelha o contrato do
 * backend, que devolve as 3 seções sempre presentes (AD-09 item 8). */
export function itemsBySource(
  sections: UnifiedQueueSection[] | undefined,
): Record<MigrationSourceId, MigrationQueueItem[]> {
  const bySourceId = new Map(sections?.map((section) => [section.sourceId, section]) ?? [])
  const result = {} as Record<MigrationSourceId, MigrationQueueItem[]>
  for (const sourceId of MIGRATION_SOURCE_ORDER) {
    const section = bySourceId.get(sourceId)
    result[sourceId] = section ? flattenSection(section) : []
  }
  return result
}

/** "De: Junho 2026" (mês) · "De: semana de 20 jul." (semana) · "De: 26 jul."
 * (dia) — rótulo de origem/linhagem de cada linha da lista de decisão. */
export function originLabelFor(sourceId: MigrationSourceId, periodStart: string): string {
  if (sourceId === 'month') {
    const [year, month] = periodStart.split('-').map(Number)
    return `De: ${capitalize(MONTH_NAMES_PT[month - 1])} de ${year}`
  }
  if (sourceId === 'week') {
    return `De: semana de ${formatDayLabel(periodStart, 'day-month')}`
  }
  return `De: ${formatDayLabel(periodStart, 'day-month')}`
}

/** Forma única que `MigrationDecisionList` consome — achatada a partir de
 * `MigrationQueueItem` (pendente, vindo da fila) OU do snapshot local
 * `mutatedThisVisit` de `MigrationRitualPage` (já decidido NESTA visita,
 * `decision` não-nulo — mesmo padrão do Weekly/Monthly). */
export interface NormalizedMigrationItem {
  id: string
  title: string
  originLabel: string
  decision: string | null
}

export function normalizeQueueItem(item: MigrationQueueItem): NormalizedMigrationItem {
  return {
    id: item.task.id,
    title: item.task.title,
    originLabel: originLabelFor(item.sourceId, item.periodStart),
    decision: null,
  }
}
