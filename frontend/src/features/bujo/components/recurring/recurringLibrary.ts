// ─────────────────────────────────────────────────────────────────────────────
// Derivações puras da biblioteca de recorrentes (Story 14.8, AC1).
//
//   ▶ FONTE ÚNICA: `visibleByGroup()` produz de uma vez a lista visível de CADA
//     grupo com o filtro vigente. A contagem de cada aba é o `.length` DESSA
//     lista, e o painel renderiza exatamente ELA. Derivar a contagem de uma
//     segunda origem (ex.: contar todos os templates do grupo, ignorando o
//     filtro) é o modo mais barato de a aba dizer "4" e mostrar 2.
//
//   ▶ O FILTRO É CLIENT-SIDE sobre UMA query sem params — decisão vigente desde
//     a Story 11.2 e o que mantém a troca de aba instantânea, sem novo estado
//     de loading. NÃO introduzir `?active`/`?recurrence_group` nesta superfície:
//     o servidor já filtra `deleted_at` na origem (`live_templates()`, AD-08
//     item 6b), e é essa assimetria (`active` no cliente × excluído no
//     servidor) que o E2E da 14.4 prova.
//
//   ▶ A ORDEM VEM DO SERVIDOR (`order_by("recurrence_text")`, `views.py:232`) —
//     estas funções PRESERVAM a ordem da resposta e nunca reordenam.
// ─────────────────────────────────────────────────────────────────────────────
import type { RecurrenceGroup, RecurringTaskTemplate } from '../../types'

export const RECURRENCE_GROUP_LABEL: Record<RecurrenceGroup, string> = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  annual: 'Anual',
}

/** Ordem canônica das abas (Semanal → Mensal → Anual), como no mockup frame A. */
export const RECURRENCE_GROUPS = Object.keys(RECURRENCE_GROUP_LABEL) as RecurrenceGroup[]

export type VisibleByGroup = Record<RecurrenceGroup, RecurringTaskTemplate[]>

/**
 * A lista visível de cada grupo sob o filtro vigente — a ÚNICA origem da
 * contagem das abas e do conteúdo do painel.
 */
export function visibleByGroup(
  templates: readonly RecurringTaskTemplate[],
  showInactive: boolean,
): VisibleByGroup {
  const result = { weekly: [], monthly: [], annual: [] } as VisibleByGroup
  for (const template of templates) {
    if (!showInactive && !template.active) continue
    // Grupo desconhecido (contrato futuro) não derruba a superfície nem some
    // sem rastro: simplesmente não pertence a nenhuma das três abas.
    const bucket = result[template.recurrenceGroup as RecurrenceGroup]
    if (bucket) bucket.push(template)
  }
  return result
}

/** Subline canônica da Item Row: `{Grupo} — {recurrenceText}` (mockup frame A). */
export function sublineOf(template: RecurringTaskTemplate): string {
  return `${RECURRENCE_GROUP_LABEL[template.recurrenceGroup]} — ${template.recurrenceText}`
}

/** Ids do par `role="tab"` ⇄ `role="tabpanel"` (`aria-controls`/`aria-labelledby`).
 * Vivem aqui, e não no componente das abas, porque os DOIS lados precisam deles
 * e nenhum é dono do outro. */
export function tabIdOf(group: RecurrenceGroup): string {
  return `recurring-tab-${group}`
}

export function tabPanelIdOf(group: RecurrenceGroup): string {
  return `recurring-tabpanel-${group}`
}
