// ─────────────────────────────────────────────────────────────────────────────
// Weekly Board do sistema novo (Story 14.5, AC1/AC3/AC6/AC7).
//
//   ▶ NÃO reescreve `WeeklyPage.tsx` — ela continua servindo
//     `archive/weekly/:weekStart` (a variante de Arquivo é da 14.10).
//   ▶ "Hoje" nunca vem do cliente (Convenção #8): a semana corrente é lida do
//     PRÓPRIO servidor (`useWeeklyLogQuery()` sem parâmetro, que o backend
//     resolve via `today_for(user)`) — nenhuma chamada a `new Date()` para
//     derivar "semana atual" ou o alvo do stepper.
//   ▶ Composição por faixa via `useMediaQuery(mediaQueries.*)` — nunca string
//     literal — combinando os tokens já existentes (`wideUp`/`desktop`/
//     `tabletUp`) para derivar wide/medium/tablet/compact.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Box, Button, useMediaQuery } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

import {
  invalidateRitualQueries,
  TaskDetailCard,
  useCreateWeeklyTaskMutation,
  useReorderTaskMutation,
  useTransitionTaskMutation,
  useWeeklyCycleActionMutation,
  useWeeklyCycleReadinessQuery,
  useWeeklyLogQuery,
} from '../../features/bujo'
import type { CycleStatus, Task, TaskStatus, WeeklyDay } from '../../features/bujo'
import { WeeklyTaskPanel } from '../../features/bujo/components/weekly/WeeklyTaskPanel'
import { PlannerSkeleton } from '../../features/bujo/components/PlannerSkeleton'
import { capitalize, MONTH_NAMES_PT } from '../../features/bujo/monthNames'
import { mediaQueries, typography } from '../../shared/design/tokens'
import { addDaysIso, formatDayLabel, isoWeekNumber, parseLocalDate, weekPositionInMonth } from '../../shared/date'

type StatusFilterKey = 'pending' | 'started' | 'completed' | 'migrated-postponed' | 'cancelled'

const CYCLE_STATUS_LABEL: Record<Exclude<CycleStatus, null>, string> = {
  planning: 'Em planejamento',
  active: 'Em andamento',
  finalized: 'Finalizada',
}

function flattenTasks(tasks: Task[]): Task[] {
  return tasks.flatMap((task) => [task, ...flattenTasks(task.subtasks ?? [])])
}

function matchesStatusFilter(status: TaskStatus, filter: StatusFilterKey | null): boolean {
  if (filter === null) return true
  if (filter === 'migrated-postponed') return status === 'migrated' || status === 'postponed'
  return status === filter
}

function applyFilters(tasks: Task[], filter: StatusFilterKey | null, hideNotOpen: boolean): Task[] {
  return tasks.filter((task) => {
    const status = task.status ?? 'pending'
    if (!matchesStatusFilter(status, filter)) return false
    if (hideNotOpen && status !== 'pending' && status !== 'started') return false
    return true
  })
}

function formatWeekRange(weekStart: string): string {
  const start = parseLocalDate(weekStart)
  const end = parseLocalDate(addDaysIso(weekStart, 6))
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  const endLabel = `${end.getDate()} de ${MONTH_NAMES_PT[end.getMonth()]} de ${end.getFullYear()}`
  if (sameMonth) return `${start.getDate()}–${endLabel}`
  const startLabel = `${start.getDate()} de ${MONTH_NAMES_PT[start.getMonth()]}`
  return `${startLabel} – ${endLabel}`
}

function formatWeekPosition(weekStart: string): string {
  const positions = weekPositionInMonth(weekStart)
  const parts = positions.map((p) => `${p.position}ª semana de ${MONTH_NAMES_PT[p.month - 1]}`)
  return `${parts.join(' / ')} · semana ISO ${isoWeekNumber(weekStart)}`
}

function findPredecessor(
  days: WeeklyDay[],
  unscheduled: Task[],
  taskId: string,
): { period: string; date: string } | null {
  for (const day of days) {
    for (const task of day.tasks) {
      if (task.migratedToTask === taskId) {
        return { period: capitalize(formatDayLabel(day.date, 'weekday')), date: formatDayLabel(day.date, 'day-month') }
      }
    }
  }
  for (const task of unscheduled) {
    if (task.migratedToTask === taskId) {
      return { period: 'Sem dia definido', date: '' }
    }
  }
  return null
}

export function WeeklyBoardPage() {
  const queryClient = useQueryClient()
  const [explicitWeekStart, setExplicitWeekStart] = useState<string | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey | null>(null)
  const [hideNotOpen, setHideNotOpen] = useState(false)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0) // 0-6 dias, 7 = pool (compact)

  const weeklyLog = useWeeklyLogQuery(explicitWeekStart)
  // Dedup automático com a query acima quando `explicitWeekStart` é `undefined`
  // (mesma chave, mesmo cache) — o custo extra só existe ao navegar.
  const currentWeekLog = useWeeklyLogQuery()
  const readiness = useWeeklyCycleReadinessQuery()
  const createTask = useCreateWeeklyTaskMutation()
  const transitionTask = useTransitionTaskMutation()
  const reorderTask = useReorderTaskMutation()
  const cycleAction = useWeeklyCycleActionMutation()

  const isWide = useMediaQuery(mediaQueries.wideUp)
  const isDesktopUp = useMediaQuery(mediaQueries.desktop)
  const isTabletUp = useMediaQuery(mediaQueries.tabletUp)
  const faixa = isWide ? 'wide' : isDesktopUp ? 'medium' : isTabletUp ? 'tablet' : 'compact'

  if (weeklyLog.isPending) {
    return (
      <Box component="main" aria-label="Esta Semana" sx={{ p: 'var(--ds-space-4)' }}>
        <PlannerSkeleton />
      </Box>
    )
  }
  if (!weeklyLog.data) return null

  const { days, unscheduled, weekStart, closed, status } = weeklyLog.data
  const isReadonly = closed === true || status === 'finalized'
  const isCurrentWeek = Boolean(currentWeekLog.data && weekStart === currentWeekLog.data.weekStart)

  const allTasksFlat = flattenTasks([...days.flatMap((d) => d.tasks), ...unscheduled])
  const totals = {
    all: allTasksFlat.length,
    pending: allTasksFlat.filter((t) => (t.status ?? 'pending') === 'pending').length,
    started: allTasksFlat.filter((t) => t.status === 'started').length,
    completed: allTasksFlat.filter((t) => t.status === 'completed').length,
    migratedPostponed: allTasksFlat.filter((t) => t.status === 'migrated' || t.status === 'postponed').length,
    cancelled: allTasksFlat.filter((t) => t.status === 'cancelled').length,
  }
  const filtersActive = statusFilter !== null || hideNotOpen

  const allTasksById = new Map(allTasksFlat.map((task) => [task.id, task]))
  const openTask = openTaskId ? allTasksById.get(openTaskId) : undefined
  const isOpenTaskSubtask = openTaskId
    ? !days.some((d) => d.tasks.some((t) => t.id === openTaskId)) &&
      !unscheduled.some((t) => t.id === openTaskId)
    : false

  function handleTransition(taskId: string, toStatus: TaskStatus) {
    transitionTask.mutate(
      { taskId, toStatus },
      { onSuccess: () => invalidateRitualQueries(queryClient) },
    )
  }

  function handleCreate(dayIso: string | null, title: string) {
    createTask.mutate({ weekStart, title, scheduledDate: dayIso })
  }

  function handleReorder(taskId: string, targetTaskId: string, position: 'before' | 'after') {
    reorderTask.mutate(
      { taskId, targetTaskId, position },
      { onSuccess: () => invalidateRitualQueries(queryClient) },
    )
  }

  function handleOpenPlanning() {
    const target = readiness.data?.active
      ? addDaysIso(readiness.data.active.weekStart, 7)
      : currentWeekLog.data?.weekStart
    if (!target) return
    cycleAction.mutate({ action: 'open_planning_target', weekStart: target })
  }

  const planningTarget = readiness.data?.planning?.weekStart

  function panelFor(day: WeeklyDay, compact = false) {
    const regionLabel = `${capitalize(formatDayLabel(day.date, 'weekday'))}, ${formatDayLabel(day.date, 'day-month')}`
    return (
      <WeeklyTaskPanel
        key={day.date}
        regionLabel={regionLabel}
        heading={capitalize(formatDayLabel(day.date, 'weekday'))}
        subheading={formatDayLabel(day.date, 'day-month')}
        dayLinkHref={`/daily/${day.date}`}
        tasks={applyFilters(day.tasks, statusFilter, hideNotOpen)}
        cycleStatus={status as CycleStatus}
        readonly={isReadonly}
        compact={compact}
        createPlaceholder="＋ Adicionar tarefa…"
        onOpenDetail={setOpenTaskId}
        onTransition={handleTransition}
        onCreate={isReadonly ? undefined : (title) => handleCreate(day.date, title)}
        onReorder={isReadonly ? undefined : handleReorder}
      />
    )
  }

  const poolPanel = (
    <WeeklyTaskPanel
      regionLabel="Sem dia definido"
      heading="Sem dia definido"
      subheading="pool semanal"
      tasks={applyFilters(unscheduled, statusFilter, hideNotOpen)}
      cycleStatus={status as CycleStatus}
      readonly={isReadonly}
      createPlaceholder="＋ Adicionar sem data…"
      onOpenDetail={setOpenTaskId}
      onTransition={handleTransition}
      onCreate={isReadonly ? undefined : (title) => handleCreate(null, title)}
      onReorder={isReadonly ? undefined : handleReorder}
    />
  )

  const [seg, ter, qua, qui, sex, sab, dom] = days

  return (
    <Box component="main" aria-label="Esta Semana" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-3)', height: '100%', minHeight: 0 }}>
      <Box component="header" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-2)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-2)', flexWrap: 'wrap' }}>
          <Box sx={{ ...typography['page-title'], color: 'var(--ds-ink)' }}>{formatWeekRange(weekStart)}</Box>
          {status && (
            <Box
              sx={{
                ...typography.label,
                color: 'var(--ds-primary)',
                border: '1px solid var(--ds-primary)',
                borderRadius: 'var(--ds-radius-full)',
                padding: 'var(--ds-space-1) var(--ds-space-2)',
              }}
            >
              {CYCLE_STATUS_LABEL[status as Exclude<CycleStatus, null>]}
            </Box>
          )}
        </Box>
        <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>{formatWeekPosition(weekStart)}</Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-2)', flexWrap: 'wrap' }}>
          <Button aria-label="Semana anterior" onClick={() => setExplicitWeekStart(addDaysIso(weekStart, -7))}>
            ‹
          </Button>
          <Button aria-label="Próxima semana" onClick={() => setExplicitWeekStart(addDaysIso(weekStart, 7))}>
            ›
          </Button>
          {!isCurrentWeek && (
            <Button onClick={() => setExplicitWeekStart(undefined)}>Voltar para hoje</Button>
          )}
          {planningTarget ? (
            <>
              <Button
                component={RouterLink}
                to="/planner/week/planning"
                sx={{ backgroundColor: 'var(--ds-primary)', color: 'var(--ds-on-primary)' }}
              >
                Continuar planejamento
              </Button>
              <Button component={RouterLink} to="/planner/week/planning" variant="text">
                Semana em planejamento
              </Button>
            </>
          ) : (
            <Button
              onClick={handleOpenPlanning}
              sx={{ backgroundColor: 'var(--ds-primary)', color: 'var(--ds-on-primary)' }}
            >
              Planejar próxima semana
            </Button>
          )}
        </Box>

        <Box role="group" aria-label="Filtros por status" sx={{ display: 'flex', gap: 'var(--ds-space-1)', flexWrap: 'wrap', alignItems: 'center' }}>
          <FilterButton active={statusFilter === null} onClick={() => setStatusFilter(null)} label={`${totals.all} registros`} />
          <FilterButton active={statusFilter === 'pending'} onClick={() => setStatusFilter('pending')} label={`${totals.pending} pendentes`} />
          <FilterButton active={statusFilter === 'started'} onClick={() => setStatusFilter('started')} label={`${totals.started} iniciadas`} />
          <FilterButton active={statusFilter === 'completed'} onClick={() => setStatusFilter('completed')} label={`${totals.completed} concluídas`} />
          <FilterButton
            active={statusFilter === 'migrated-postponed'}
            onClick={() => setStatusFilter('migrated-postponed')}
            label={`${totals.migratedPostponed} migradas/adiadas`}
          />
          <FilterButton active={statusFilter === 'cancelled'} onClick={() => setStatusFilter('cancelled')} label={`${totals.cancelled} canceladas`} />
          <FilterButton active={hideNotOpen} onClick={() => setHideNotOpen((prev) => !prev)} label="Ocultar não abertas" />
          {filtersActive && (
            <Button
              size="small"
              onClick={() => {
                setStatusFilter(null)
                setHideNotOpen(false)
              }}
            >
              Limpar filtros
            </Button>
          )}
        </Box>
      </Box>

      {faixa === 'compact' ? (
        <>
          <Box role="tablist" aria-label="Selecionar dia da semana" sx={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--ds-space-1)' }}>
            {[...days, { date: 'pool' }].map((entry, index) => (
              <Box
                key={entry.date}
                role="tab"
                aria-selected={selectedIndex === index}
                component="button"
                type="button"
                onClick={() => setSelectedIndex(index)}
                sx={{
                  ...typography.label,
                  padding: 'var(--ds-space-1) var(--ds-space-2)',
                  border: '1px solid var(--ds-control-border)',
                  borderRadius: 'var(--ds-radius-sm)',
                  backgroundColor: selectedIndex === index ? 'var(--ds-primary)' : 'var(--ds-surface)',
                  color: selectedIndex === index ? 'var(--ds-on-primary)' : 'var(--ds-ink)',
                  cursor: 'pointer',
                }}
              >
                {index === 7 ? 'Sem dia' : formatDayLabel(entry.date, 'weekday-short-day')}
              </Box>
            ))}
          </Box>
          <Box sx={{ flex: 1, minHeight: 0 }}>
            {selectedIndex === 7 ? poolPanel : panelFor(days[selectedIndex])}
          </Box>
        </>
      ) : faixa === 'tablet' ? (
        // `3fr 1fr` (frações relativas, não pixel literal — AC8): a grade de
        // dias recebe proporcionalmente mais espaço que a faixa do pool, que
        // desce abaixo dela ("contexto lateral desce abaixo da superfície
        // principal", DESIGN.md).
        <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: '3fr 1fr', gap: 'var(--ds-space-2)' }}>
          <Box
            sx={{
              minHeight: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gridTemplateRows: 'repeat(3, minmax(0, 1fr))',
              gap: 'var(--ds-weekly-board-gap)',
            }}
          >
            {panelFor(seg)}
            {panelFor(ter)}
            {panelFor(qua)}
            {panelFor(qui)}
            {panelFor(sex)}
            <WeekendStack sab={sab} dom={dom} panelFor={panelFor} />
          </Box>
          <Box sx={{ minHeight: 0 }}>{poolPanel}</Box>
        </Box>
      ) : (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns:
              faixa === 'wide'
                ? 'repeat(3, minmax(0, 1fr)) minmax(var(--ds-weekly-board-unscheduled-min-width), .78fr)'
                : 'repeat(2, minmax(0, 1fr)) minmax(var(--ds-weekly-board-unscheduled-min-width), .78fr)',
            gridTemplateRows: faixa === 'wide' ? '1fr 1fr' : 'repeat(3, 1fr)',
            gridTemplateAreas:
              faixa === 'wide'
                ? '"seg ter qua pool" "qui sex weekend pool"'
                : '"seg ter pool" "qua qui pool" "sex weekend pool"',
            gap: 'var(--ds-weekly-board-gap)',
          }}
        >
          <Box sx={{ gridArea: 'seg', minHeight: 0, minWidth: 0 }}>{panelFor(seg)}</Box>
          <Box sx={{ gridArea: 'ter', minHeight: 0, minWidth: 0 }}>{panelFor(ter)}</Box>
          <Box sx={{ gridArea: 'qua', minHeight: 0, minWidth: 0 }}>{panelFor(qua)}</Box>
          <Box sx={{ gridArea: 'qui', minHeight: 0, minWidth: 0 }}>{panelFor(qui)}</Box>
          <Box sx={{ gridArea: 'sex', minHeight: 0, minWidth: 0 }}>{panelFor(sex)}</Box>
          <Box sx={{ gridArea: 'weekend', minHeight: 0, minWidth: 0 }}>
            <WeekendStack sab={sab} dom={dom} panelFor={panelFor} />
          </Box>
          <Box sx={{ gridArea: 'pool', minHeight: 0, minWidth: 0 }}>{poolPanel}</Box>
        </Box>
      )}

      {openTask && (
        <TaskDetailCard
          key={openTaskId}
          task={openTask}
          isSubtask={isOpenTaskSubtask}
          readonly={isReadonly}
          onClose={() => setOpenTaskId(null)}
          predecessor={openTaskId ? findPredecessor(days, unscheduled, openTaskId) : null}
        />
      )}
    </Box>
  )
}

function WeekendStack({
  sab,
  dom,
  panelFor,
}: {
  sab: WeeklyDay
  dom: WeeklyDay
  panelFor: (day: WeeklyDay, compact?: boolean) => ReactNode
}) {
  // Subgrade `1fr 1fr` EM COLUNAS (Sáb e Dom lado a lado, compactos) — não em
  // linhas: é a composição aprovada do mockup (`key-weekly.html`,
  // `.weekend-stack{grid-template-columns:1fr 1fr}`), e é o motivo de
  // `TaskRowBase` ter a variante `compact` (sem chip/ordem) para caber numa
  // coluna estreita.
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ds-weekly-board-gap)', height: '100%', minWidth: 0, minHeight: 0 }}>
      {panelFor(sab, true)}
      {panelFor(dom, true)}
    </Box>
  )
}

function FilterButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <Box
      component="button"
      type="button"
      aria-pressed={active}
      onClick={onClick}
      sx={{
        ...typography.label,
        padding: 'var(--ds-space-1) var(--ds-space-2)',
        border: '1px solid var(--ds-control-border)',
        borderRadius: 'var(--ds-radius-sm)',
        backgroundColor: active ? 'var(--ds-primary-soft)' : 'var(--ds-surface)',
        color: active ? 'var(--ds-primary)' : 'var(--ds-ink)',
        cursor: 'pointer',
      }}
    >
      {label}
    </Box>
  )
}
