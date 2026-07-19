import type { DayType, HabitChange, HabitVersionEvent } from '../types'

// Formatação numérica pt-BR (espelha o padrão de HabitTracker.tsx).
const numberFormat = new Intl.NumberFormat('pt-BR')

export function formatNumber(raw: string | number | null | undefined): string {
  if (raw == null || raw === '') return '0'
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

// Rótulos factuais e neutros do tipo de dia (UX-DR13: sem gamificação).
export const DAY_TYPE_LABEL: Record<DayType, string> = {
  weekday: 'Dia útil',
  weekend: 'Fim de semana',
  holiday: 'Feriado',
}

// Texto humano de UMA mudança de configuração — acompanha SEMPRE o marcador
// (cor nunca comunica sozinha; AC3). before/after chegam como string (decimais)
// ou 'true'/'false' (active); 'created' é a primeira versão.
export function describeChange(change: HabitChange): string {
  switch (change.field) {
    case 'weight':
      return `Peso ${formatNumber(change.before)} → ${formatNumber(change.after)}`
    case 'meta':
      return `Meta ${formatNumber(change.before)} → ${formatNumber(change.after)}`
    case 'bonus':
      return `Bônus ${formatNumber(change.before)} → ${formatNumber(change.after)}`
    case 'active':
      return change.after === 'true' ? 'Reativado' : 'Desativado'
    case 'created':
      return 'Criado'
    default:
      return change.field
  }
}

// Todas as mudanças de um evento datado, juntas (ex.: "Peso 3 → 4 · Meta 30 → 40").
export function describeEvent(event: HabitVersionEvent): string {
  return event.changes.map(describeChange).join(' · ')
}

// Um dia é "ritmo" (sombreado) se não for dia útil.
export function isRhythmDay(dayType: DayType): boolean {
  return dayType !== 'weekday'
}
