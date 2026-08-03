// ─────────────────────────────────────────────────────────────────────────────
// Localização do PREDECESSOR de uma tarefa dentro de um período do Arquivo
// ("Veio de") — extraído de `ArchiveWeeklyDetailPage.tsx`/
// `ArchiveMonthlyDetailPage.tsx` (DW-17): a lógica de busca era idêntica nas
// duas páginas, só a FORMA dos dados difere (`WeeklyLog.days`/`unscheduled`
// vs. `MonthlyLog.tasks` FLAT, dia via `scheduledDate` por tarefa). A
// recursão em `subtasks` vive em `findPredecessorTask` (`taskTree.ts`), mesma
// convenção já usada para `findTaskById`.
//
// As duas páginas chamam estas funções PRIMEIRO contra o período que já têm
// carregado; quando o resultado é `null` (predecessor fora do período local),
// a página tenta de novo contra os dados do período de ORIGEM (recebido via
// `location.state.originPeriod`, carregado por uma segunda
// `useWeeklyLogQuery`/`useMonthlyLogQuery` condicional) — ver Design Notes da
// bundle DW-17/DW-18.
// ─────────────────────────────────────────────────────────────────────────────
import { findPredecessorTask } from '../../features/bujo/taskTree'
import type { Task, WeeklyDay } from '../../features/bujo'
import { formatDayLabel } from '../../shared/date'
import { capitalize } from '../../features/bujo/monthNames'

export interface PredecessorLocation {
  period: string
  date: string
}

/** Busca o predecessor de `taskId` dentro de um WeeklyLog (dias + tarefas sem
 * dia definido). */
export function findPredecessorInWeeklyLog(
  days: WeeklyDay[],
  unscheduled: Task[],
  taskId: string,
): PredecessorLocation | null {
  for (const day of days) {
    if (findPredecessorTask(day.tasks, taskId)) {
      return {
        period: capitalize(formatDayLabel(day.date, 'weekday')),
        date: formatDayLabel(day.date, 'day-month'),
      }
    }
  }
  if (findPredecessorTask(unscheduled, taskId)) {
    return { period: 'Sem dia definido', date: '' }
  }
  return null
}

/** Busca o predecessor de `taskId` dentro de um MonthlyLog (`tasks` FLAT — o
 * dia vem do `scheduledDate` da própria tarefa predecessora). */
export function findPredecessorInMonthlyLog(tasks: Task[], taskId: string): PredecessorLocation | null {
  const predecessor = findPredecessorTask(tasks, taskId)
  if (!predecessor) return null
  if (predecessor.scheduledDate) {
    return {
      period: capitalize(formatDayLabel(predecessor.scheduledDate, 'weekday')),
      date: formatDayLabel(predecessor.scheduledDate, 'day-month'),
    }
  }
  return { period: 'Sem dia definido', date: '' }
}
