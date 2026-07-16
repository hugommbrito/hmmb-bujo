import { useTodayLogQuery } from '../../features/bujo'

// Hoje só compõe `bujo` (único domínio pronto). habits/medications/gratitude
// entram nos Épicos 6/7/8/9 — ponto de composição para prefetch paralelo
// (§7.3) quando esses domínios existirem.
export function useDailyData(logDate?: string) {
  const todayLog = useTodayLogQuery(logDate)

  return { todayLog }
}
