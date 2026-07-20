import type { MedicationDayEntry } from './types'

// Helpers puros da camada realizada (Story 8.2). Sem dependência de React/Query —
// usados no render do Medication Block E no updater otimista (para o cabeçalho reagir
// antes do refetch), garantindo uma fonte única da regra derivada (AC6).

export type BlockStatus = 'confirmed' | 'partial' | 'pending'

/**
 * Estado DERIVADO de um bloco a partir das suas linhas `scheduled` (AC6):
 * `confirmed` = todas confirmadas; `partial` = ≥1 e <todas; `pending` = nenhuma.
 * Nunca armazenado — o backend computa o mesmo no GET (estado inicial) e o cliente
 * recomputa aqui no updater otimista. Um bloco sem linhas é `pending`.
 */
export function deriveBlockStatus(entries: MedicationDayEntry[]): BlockStatus {
  if (entries.length === 0) return 'pending'
  const confirmed = entries.filter((entry) => entry.confirmedAt != null).length
  if (confirmed === 0) return 'pending'
  if (confirmed === entries.length) return 'confirmed'
  return 'partial'
}

/**
 * Resumo textual de uma dose multi-componente `[{label, amount, unit}]` para a linha
 * (ex.: "50 mg (Losartana) + 1 comp"). Espelho deliberado do `doseSummary` local de
 * `MedicationsManager.tsx` (8.1) — a story pede reutilizar a lógica **sem modificar**
 * aquele componente, então a mesma regra pura vive aqui, na camada da 8.2.
 */
export function doseSummary(dose: MedicationDayEntry['doseAtTime']): string {
  return dose
    .map((c) => `${c.amount ?? ''} ${c.unit ?? ''}${c.label ? ` (${c.label})` : ''}`.trim())
    .join(' + ')
}
