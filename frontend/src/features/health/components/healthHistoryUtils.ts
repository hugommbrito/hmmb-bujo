import type { HealthFieldType, HealthValue } from '../types'

// Formatação numérica pt-BR (mesmo idioma de habits/components/historyUtils.ts).
// Intl arredonda na exibição (maximumFractionDigits default = 3) — é isto que a
// Decisão 8 chama de "arredondada só na exibição".
const numberFormat = new Intl.NumberFormat('pt-BR')

// Números do dashboard/série. `null`/vazio → "—" (lacuna honesta, nunca 0 fabricado).
export function formatNumber(raw: number | string | null | undefined): string {
  if (raw == null || raw === '') return '—'
  const value = Number(raw)
  return Number.isNaN(value) ? String(raw) : numberFormat.format(value)
}

// Datas chegam como "YYYY-MM-DD" (date-only). Formatamos por SPLIT DE STRING —
// nunca `new Date(iso)` — para não sofrer o desvio de fuso (UTC vs local) que
// deslocaria o dia. "2026-01-05" → "05/01" (curto) / "05/01/2026" (completo).
export function formatDateShortBR(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// Tipa/renderiza uma célula da tabela pela DEFINIÇÃO do campo (AC1):
// integer/decimal → número pt-BR; boolean → "Sim"/"Não" factual; enum/text →
// string; chave ausente no blob (undefined) → "—" honesto — NUNCA 0/false
// fabricado. Distingue "sem valor" (—) de um `false` real gravado ("Não").
export function formatCellValue(
  fieldType: HealthFieldType,
  value: HealthValue | undefined,
): string {
  if (value === undefined || value === null || value === '') return '—'
  switch (fieldType) {
    case 'integer':
    case 'decimal':
      return formatNumber(value as number)
    case 'boolean':
      return value === true ? 'Sim' : 'Não'
    case 'enum':
    case 'text':
      return String(value)
    default:
      return String(value)
  }
}
