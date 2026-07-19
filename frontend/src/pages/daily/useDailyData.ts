import { useTodayLogQuery } from '../../features/bujo'
import { useHabitDayQuery } from '../../features/habits'

// Ponto de composição do fluxo da manhã (§7.3). `bujo` (tarefas do dia) +
// `habits` (tracker do dia, Épico 6). medications/gratitude entram nos Épicos
// 8/9 aqui também, para prefetch paralelo.
export function useDailyData(logDate?: string) {
  const todayLog = useTodayLogQuery(logDate)
  const habitDay = useHabitDayQuery(logDate)

  return { todayLog, habitDay }
}
