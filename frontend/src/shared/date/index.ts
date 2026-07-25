// ─────────────────────────────────────────────────────────────────────────────
// Helpers de data LOCAL (Story 14.5, AC1/AC3) — a UMA implementação
// compartilhada, substituindo a 7ª cópia dos mesmos cálculos ad-hoc que já
// existem em `WeeklyPage.tsx`, `WeekDaySelector.tsx`, `DayHeader.tsx`,
// `MonthDensityCalendar.tsx` e outros.
//
//   ▶ "Hoje" NUNCA vem daqui: nenhuma função lê `new Date()` sem argumento.
//     `today_for(user)` é sempre do servidor (Convenções #8 da Story 14.5).
//   ▶ Um campo `date` no fio é "AAAA-MM-DD" sem hora/fuso — `new Date(iso)`
//     interpreta como UTC-meia-noite e desloca o dia em fusos negativos
//     (ex. UTC-3). Toda função abaixo parseia por partes.
//   ▶ Semana: segunda = dia 1 (weekday 0); 1ª semana do mês = a que contém o
//     dia 1 (pode começar no mês anterior); semana de virada pertence aos
//     DOIS meses simultaneamente (AD-05, docs/temporal-pattern.md).
//
// [Source: docs/temporal-pattern.md §6; backend/core/calendar.py]
// ─────────────────────────────────────────────────────────────────────────────

/** `Date` local → "AAAA-MM-DD". Nunca `toISOString()` (foge para UTC). */
export function isoOf(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** "AAAA-MM-DD" → `Date` local (meia-noite local, não UTC). */
export function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** "AAAA-MM-DD" + N dias (aceita negativo), por partes locais. */
export function addDaysIso(iso: string, days: number): string {
  const date = parseLocalDate(iso)
  date.setDate(date.getDate() + days)
  return isoOf(date)
}

/** Índice do dia na semana com segunda = 0 (`Date.getDay()` dá 0=dom…6=sáb). */
function mondayIndexOf(date: Date): number {
  return (date.getDay() + 6) % 7
}

/** Índice (0=segunda…6=domingo) do dia da semana de `iso`. Público para o
 * atalho "Migrar para `<dia>`" do ritual (Story 14.5, AC5): preserva o dia da
 * semana de origem mapeando o mesmo índice na semana-alvo. */
export function weekdayIndexOf(iso: string): number {
  return mondayIndexOf(parseLocalDate(iso))
}

/** Segunda-feira ISO da semana de `iso` — espelha `core.calendar.week_start_of`. */
export function mondayIsoOf(iso: string): string {
  return addDaysIso(iso, -mondayIndexOf(parseLocalDate(iso)))
}

/** Número da semana ISO-8601 (1–53) de `iso`. Semântica ISO real (a semana que
 * contém a quinta-feira pertence ao ano dessa quinta) — DISTINTA da "posição no
 * mês" abaixo, que segue a regra própria do projeto (AD-05). */
export function isoWeekNumber(iso: string): number {
  const date = parseLocalDate(iso)
  const dayIndex = mondayIndexOf(date)
  const thursday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - dayIndex + 3)
  const firstJanThatYear = new Date(thursday.getFullYear(), 0, 1)
  const diffDays = Math.round((thursday.getTime() - firstJanThatYear.getTime()) / 86_400_000)
  return Math.floor(diffDays / 7) + 1
}

/** week_starts (ISO) do mês — espelha `core.calendar.weeks_of_month`: 1ª = a que
 * contém o dia 1; última pode pertencer ao mês seguinte (semana compartilhada). */
function weekStartsOfMonth(year: number, month: number): string[] {
  const firstIso = isoOf(new Date(year, month - 1, 1))
  const lastIso = isoOf(new Date(year, month, 0)) // dia 0 do mês seguinte = último dia deste
  const out: string[] = []
  let cur = mondayIsoOf(firstIso)
  while (cur <= lastIso) {
    out.push(cur)
    cur = addDaysIso(cur, 7)
  }
  return out
}

export interface WeekPositionInMonth {
  /** 1-based: "1ª semana", "2ª semana"... */
  position: number
  /** 1–12 */
  month: number
  year: number
}

/**
 * Posição da semana no(s) mês(es) a que pertence, pela regra DO PROJETO
 * (AD-05: 1ª semana = a que contém o dia 1 — não ISO-8601). Devolve 1 elemento,
 * ou 2 quando a semana cruza a virada do mês (espelha `months_of_week`).
 */
export function weekPositionInMonth(weekStartIso: string): WeekPositionInMonth[] {
  const weekStart = parseLocalDate(weekStartIso)
  const weekEnd = parseLocalDate(addDaysIso(weekStartIso, 6))
  const combos: Array<{ year: number; month: number }> = [
    { year: weekStart.getFullYear(), month: weekStart.getMonth() + 1 },
  ]
  const endCombo = { year: weekEnd.getFullYear(), month: weekEnd.getMonth() + 1 }
  if (endCombo.year !== combos[0].year || endCombo.month !== combos[0].month) {
    combos.push(endCombo)
  }
  return combos.map(({ year, month }) => ({
    position: weekStartsOfMonth(year, month).indexOf(weekStartIso) + 1,
    month,
    year,
  }))
}

const WEEKDAY_LONG_PT_BR = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

function intlPart(date: Date, options: Intl.DateTimeFormatOptions, type: string): string {
  const parts = new Intl.DateTimeFormat('pt-BR', options).formatToParts(date)
  return parts.find((p) => p.type === type)?.value.replace('.', '') ?? ''
}

/**
 * Rótulo de dia canônico, no molde já provado em `DayHeader`/`WeekDaySelector`
 * (nome do dia + `Intl.DateTimeFormat('pt-BR', ...)` para dia/mês).
 *
 * - `'weekday'` → `"Segunda"` (nome completo, forma canônica dos painéis).
 * - `'day-month'` → `"20 jul."` (cabeçalho de painel/header do período).
 * - `'weekday-short-day'` → `"SEG 20"` (molde de `WeekDaySelector`, seletor compact).
 */
export function formatDayLabel(
  iso: string,
  style: 'weekday' | 'day-month' | 'weekday-short-day' = 'weekday',
): string {
  const date = parseLocalDate(iso)

  if (style === 'weekday') {
    return WEEKDAY_LONG_PT_BR[mondayIndexOf(date)]
  }
  if (style === 'day-month') {
    const day = intlPart(date, { day: '2-digit' }, 'day')
    const month = intlPart(date, { month: 'short' }, 'month')
    return `${day} ${month}.`
  }
  const weekday = intlPart(date, { weekday: 'short' }, 'weekday')
  const day = intlPart(date, { day: '2-digit' }, 'day')
  return `${weekday} ${day}`.toUpperCase()
}
