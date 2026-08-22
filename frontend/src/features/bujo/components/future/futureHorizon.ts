// ─────────────────────────────────────────────────────────────────────────────
// Lógica PURA do Future Log do sistema novo (Story 14.7 — M08). Sem React, sem
// Query, sem DOM: ordenação, formatação de data parcial/completa, agrupamento
// dos meses distantes por ano, contagens do cabeçalho de foco e a validação de
// captura. Testado isoladamente em `futureHorizon.test.ts`.
//
//   ▶ "Hoje" NUNCA vem daqui (Convenção #8): o âncora é do servidor
//     (`anchorMonthFirst` de `GET /api/bujo/future-log/horizon/`).
// ─────────────────────────────────────────────────────────────────────────────
import { addMonthsIso } from '../../../../shared/date'
import { futureBoard } from '../../../../shared/design/tokens'
import { capitalize, MONTH_ABBREV_PT, MONTH_NAMES_PT } from '../../monthNames'
import type { FutureLogMonthCount, Task } from '../../types'

/**
 * Ordenação "dia → sem-dia" (AC3), espelho de `_by_day_then_undated`
 * (`backend/bujo/services/rituals.py:254`, cujo docstring já cita "(M08)"):
 * `scheduled_date` ascendente com nulos POR ÚLTIMO, desempate por `order_index`.
 *
 * O desempate por `order_index` sai de graça por ser um `Array.prototype.sort`
 * ESTÁVEL (garantido pela spec desde ES2019): `order_index` não é campo do
 * contrato de API (`TaskSerializer` não o expõe) porque o backend já entrega a
 * lista ordenada por ele (`Task.Meta.ordering = ["order_index"]`) — preservar a
 * ordem de entrada entre datas iguais É o desempate por `order_index`.
 *
 * A ordenação NÃO pode ser deixada ao default do backend: `Meta.ordering` é só
 * `order_index` e não conhece dia nenhum.
 */
export function sortByDayThenUndated(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (!a.scheduledDate && !b.scheduledDate) return 0
    if (!a.scheduledDate) return 1
    if (!b.scheduledDate) return -1
    return a.scheduledDate < b.scheduledDate ? -1 : a.scheduledDate > b.scheduledDate ? 1 : 0
  })
}

/** Prefixo visual de data parcial vs. completa (FR-1.2): `(14)` com dia, `— ago`
 * só com mês. Números tabulares e cor ficam no componente — aqui é só o texto. */
export function dayPrefixOf(task: Task, monthFirst: string): string {
  if (task.scheduledDate) return `(${Number(task.scheduledDate.slice(8, 10))})`
  return `— ${MONTH_ABBREV_PT[Number(monthFirst.slice(5, 7)) - 1]}`
}

/**
 * Rótulo ACESSÍVEL do prefixo — diferencia os dois casos por PALAVRA, nunca pela
 * forma (`(14)` vs. `— ago` é distinção puramente visual; um leitor de tela
 * anunciaria "parêntese 14" e "traço ago").
 */
export function dayPrefixLabelOf(task: Task, monthFirst: string): string {
  const monthName = MONTH_NAMES_PT[Number(monthFirst.slice(5, 7)) - 1]
  if (task.scheduledDate) {
    return `Dia ${Number(task.scheduledDate.slice(8, 10))} de ${monthName}`
  }
  return `Sem dia definido em ${monthName}`
}

export interface DistantYearGroup {
  year: number
  months: FutureLogMonthCount[]
}

/** Meses distantes agrupados por ano, preservando a ordem ascendente que o
 * backend já garante (AC1: o seletor "Ir para mês…" agrupa por ano). */
export function groupDistantByYear(distant: readonly FutureLogMonthCount[]): DistantYearGroup[] {
  const groups: DistantYearGroup[] = []
  for (const month of distant) {
    const year = Number(month.monthFirst.slice(0, 4))
    const last = groups[groups.length - 1]
    if (last && last.year === year) last.months.push(month)
    else groups.push({ year, months: [month] })
  }
  return groups
}

export interface FocusCounts {
  total: number
  dated: number
  undated: number
}

/**
 * Contagens do cabeçalho de foco, derivadas da PRÓPRIA lista renderizada (AC1) —
 * jamais de `taskCount` do trilho ou de qualquer outra origem que possa divergir
 * do que está na tela.
 */
export function focusCountsOf(tasks: readonly Task[]): FocusCounts {
  const dated = tasks.filter((task) => Boolean(task.scheduledDate)).length
  return { total: tasks.length, dated, undated: tasks.length - dated }
}

/** "3 itens · 2 com dia · 1 sem dia" (singular/plural corretos). */
export function formatFocusCounts(counts: FocusCounts): string {
  const itens = counts.total === 1 ? '1 item' : `${counts.total} itens`
  return `${itens} · ${counts.dated} com dia · ${counts.undated} sem dia`
}

/** "Agosto de 2026" — cabeçalho da coluna de foco e do trilho. */
export function formatMonthTitle(monthFirst: string): string {
  const [year, month] = monthFirst.split('-').map(Number)
  return `${capitalize(MONTH_NAMES_PT[month - 1])} de ${year}`
}

/**
 * Horizonte rolante a partir do âncora do servidor. `futureBoard.horizonMonths`
 * é a ÚNICA fonte do número 8 no cliente (AC8) — nenhum componente escreve o
 * literal.
 */
export function horizonMonthsFrom(anchorMonthFirst: string): string[] {
  return Array.from({ length: futureBoard.horizonMonths }, (_, index) =>
    addMonthsIso(anchorMonthFirst, index + 1),
  )
}

/**
 * Validação de captura (AC3): o mês precisa ser estritamente MAIOR que o âncora.
 *
 * `MonthlyTaskCreateSerializer` aceita qualquer `month_first` (só valida
 * `day == 1` e `scheduled_date` dentro do mês) — sem esta checagem no cliente, um
 * item capturado num mês do passado/corrente seria criado com 201 e
 * **desapareceria da superfície sem erro nenhum**.
 */
export function isCaptureMonthInFuture(monthFirst: string, anchorMonthFirst: string): boolean {
  return monthFirst > anchorMonthFirst
}

/** Motivo inline da rejeição — nomeia a saída, não só o erro (AC3). */
export const CAPTURE_MONTH_REJECTED =
  'Este mês não pertence ao Futuro. Use o Mês ou a Semana para datas de agora.'
