// ─────────────────────────────────────────────────────────────────────────────
// Monthly Board do sistema novo (Story 14.6, AC1/AC3/AC7/AC9) — irmã mensal da
// `WeeklyBoardPage` (14.5). NÃO reescreve `MonthlyPage.tsx` — ela continua
// servindo `archive/monthly/:monthFirst`.
//
//   ▶ `MonthlyLog` (ao contrário de `WeeklyLog`) devolve `tasks` FLAT, sem
//     `days[]`/`unscheduled` prontos — `groupTasksByDate` abaixo agrupa por
//     `scheduledDate` (mesma responsabilidade que `MonthlyPage.tsx` legado já
//     resolve com `groupTasksByScheduledDate`, mas devolvendo um Map para a
//     grade completa, não só duas listas).
//   ▶ "Hoje" nunca vem do cliente (Convenção #8): a data de hoje para o
//     contorno `--ds-info` vem de `useTodayLogQuery().data?.logDate`.
//   ▶ Stepper anterior/próximo (AC3: "restrito a ciclos operacionais") —
//     decisão de escopo documentada: aritmética simples de ±1 mês, mesmo
//     molde do stepper do Weekly Board (±7 dias, sem checagem de estado
//     antes de navegar — a leitura de qualquer mês materializa via
//     `get_or_create` no servidor, comportamento já aceito para o BOARD desde
//     a 14.1). "Restrito a ciclos operacionais" documenta a INTENÇÃO do
//     produto (evitar navegação solta por meses que só armazenam Future Log),
//     mas nenhum endpoint hoje enumera meses finalizados para filtrar
//     ativamente o stepper — o histórico teria sua própria superfície mais
//     rica em `archive/monthly/:monthFirst` (Story 14.10). Risco de mudança
//     de uma linha se o Product Owner quiser essa restrição ativa aqui.
//   ▶ `onMove` de `TaskDetailCard` fica INTOCADO (mesmo gap da 14.5 — mover
//     entre dias pelo board, fora do ritual, não está wireado no Weekly
//     Board também; não é regressão, é o mesmo escopo).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Box, Button, useMediaQuery } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

import {
  invalidateRitualQueries,
  TaskDetailCard,
  useCreateMonthlyTaskMutation,
  useMonthlyCycleActionMutation,
  useMonthlyCycleReadinessQuery,
  useMonthlyLogQuery,
  useReorderTaskMutation,
  useTodayLogQuery,
  useTransitionTaskMutation,
} from '../../features/bujo'
import type { CycleStatus, Task, TaskStatus } from '../../features/bujo'
import { MonthlyCalendarGrid } from '../../features/bujo/components/monthly/MonthlyCalendarGrid'
// Reuso deliberado (AD-21/"zero recriação"): `WeeklyTaskPanel` é uma
// composição genérica (header + contagem + lista rolável + criação
// contextual + reordenação) sem nada Weekly-específico — serve tanto o pool
// "Sem dia definido" quanto a lista completa de um dia em compact, sem fork.
import { WeeklyTaskPanel } from '../../features/bujo/components/weekly/WeeklyTaskPanel'
import { PlannerSkeleton } from '../../features/bujo/components/PlannerSkeleton'
import { capitalize, MONTH_NAMES_PT } from '../../features/bujo/monthNames'
import { mediaQueries, typography } from '../../shared/design/tokens'
import { formatDayLabel, monthGridWeeks, parseLocalDate } from '../../shared/date'

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

function groupTasksByDate(tasks: Task[]): { byDate: Map<string, Task[]>; unscheduled: Task[] } {
  const byDate = new Map<string, Task[]>()
  const unscheduled: Task[] = []
  for (const task of tasks) {
    if (!task.scheduledDate) {
      unscheduled.push(task)
      continue
    }
    const existing = byDate.get(task.scheduledDate)
    if (existing) existing.push(task)
    else byDate.set(task.scheduledDate, [task])
  }
  return { byDate, unscheduled }
}

function formatMonthTitle(monthFirst: string): string {
  const [year, month] = monthFirst.split('-').map(Number)
  return `${capitalize(MONTH_NAMES_PT[month - 1])} de ${year}`
}

function addMonthsIso(monthFirstIso: string, delta: number): string {
  const [year, month] = monthFirstIso.split('-').map(Number)
  const date = new Date(year, month - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

export function MonthlyBoardPage() {
  const queryClient = useQueryClient()
  const [explicitMonthFirst, setExplicitMonthFirst] = useState<string | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey | null>(null)
  const [hideNotOpen, setHideNotOpen] = useState(false)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [compactSelection, setCompactSelection] = useState<string | 'undated' | null>(null)

  const monthlyLog = useMonthlyLogQuery(explicitMonthFirst)
  // Dedup automático com a query acima quando `explicitMonthFirst` é `undefined`.
  const currentMonthLog = useMonthlyLogQuery()
  const todayLog = useTodayLogQuery()
  const readiness = useMonthlyCycleReadinessQuery()
  const createTask = useCreateMonthlyTaskMutation()
  const transitionTask = useTransitionTaskMutation()
  const reorderTask = useReorderTaskMutation()
  const cycleAction = useMonthlyCycleActionMutation()

  const isWide = useMediaQuery(mediaQueries.wideUp)
  const isDesktopUp = useMediaQuery(mediaQueries.desktop)
  const isTabletUp = useMediaQuery(mediaQueries.tabletUp)
  const faixa = isWide ? 'wide' : isDesktopUp ? 'medium' : isTabletUp ? 'tablet' : 'compact'

  if (monthlyLog.isPending) {
    return (
      <Box component="main" aria-label="Este Mês" sx={{ p: 'var(--ds-space-4)' }}>
        <PlannerSkeleton />
      </Box>
    )
  }
  if (!monthlyLog.data) return null

  const { monthFirst, tasks, closed, status } = monthlyLog.data
  const isReadonly = closed === true || status === 'finalized'
  const isCurrentMonth = Boolean(currentMonthLog.data && monthFirst === currentMonthLog.data.monthFirst)
  const todayIso = todayLog.data?.logDate ?? null

  const allTasksFlat = flattenTasks(tasks)
  const totals = {
    all: allTasksFlat.length,
    pending: allTasksFlat.filter((t) => (t.status ?? 'pending') === 'pending').length,
    started: allTasksFlat.filter((t) => t.status === 'started').length,
    completed: allTasksFlat.filter((t) => t.status === 'completed').length,
    migratedPostponed: allTasksFlat.filter((t) => t.status === 'migrated' || t.status === 'postponed').length,
    cancelled: allTasksFlat.filter((t) => t.status === 'cancelled').length,
  }
  const filtersActive = statusFilter !== null || hideNotOpen

  const filteredTasks = applyFilters(tasks, statusFilter, hideNotOpen)
  const { byDate: tasksByDate, unscheduled } = groupTasksByDate(filteredTasks)

  const allTasksById = new Map(allTasksFlat.map((task) => [task.id, task]))
  const openTask = openTaskId ? allTasksById.get(openTaskId) : undefined
  const isOpenTaskSubtask = openTaskId ? !tasks.some((t) => t.id === openTaskId) : false

  function handleTransition(taskId: string, toStatus: TaskStatus) {
    transitionTask.mutate({ taskId, toStatus }, { onSuccess: () => invalidateRitualQueries(queryClient) })
  }

  function handleCreate(dayIso: string | null, title: string) {
    createTask.mutate({ monthFirst, title, scheduledDate: dayIso })
  }

  function handleReorder(taskId: string, targetTaskId: string, position: 'before' | 'after') {
    reorderTask.mutate({ taskId, targetTaskId, position }, { onSuccess: () => invalidateRitualQueries(queryClient) })
  }

  function handleOpenPlanning() {
    // `open_planning_target` é determinístico no servidor (M07: sem escolha,
    // sem campo de data) — nenhum `monthFirst` precisa ser enviado.
    cycleAction.mutate({ action: 'open_planning_target' })
  }

  const planningTarget = readiness.data?.planning?.monthFirst

  const poolPanel = (
    <WeeklyTaskPanel
      regionLabel="Sem dia definido"
      heading="Sem dia definido"
      subheading="pool mensal"
      tasks={unscheduled}
      cycleStatus={status as CycleStatus}
      readonly={isReadonly}
      createPlaceholder="＋ Adicionar sem dia…"
      onOpenDetail={setOpenTaskId}
      onTransition={handleTransition}
      onCreate={isReadonly ? undefined : (title) => handleCreate(null, title)}
      onReorder={isReadonly ? undefined : handleReorder}
    />
  )

  function compactDayPanel(dateIso: string) {
    const regionLabel = `${capitalize(formatDayLabel(dateIso, 'weekday'))}, ${formatDayLabel(dateIso, 'day-month')}`
    return (
      <WeeklyTaskPanel
        regionLabel={regionLabel}
        heading={formatDayLabel(dateIso, 'day-month')}
        dayLinkHref={`/daily/${dateIso}`}
        tasks={tasksByDate.get(dateIso) ?? []}
        cycleStatus={status as CycleStatus}
        readonly={isReadonly}
        createPlaceholder="＋ Adicionar tarefa…"
        onOpenDetail={setOpenTaskId}
        onTransition={handleTransition}
        onCreate={isReadonly ? undefined : (title) => handleCreate(dateIso, title)}
        onReorder={isReadonly ? undefined : handleReorder}
      />
    )
  }

  const weeks = monthGridWeeks(monthFirst)
  const inMonthDays = weeks.flat().filter((day) => day.inMonth)
  const defaultCompactDate =
    todayIso && inMonthDays.some((day) => day.iso === todayIso) ? todayIso : inMonthDays[0]?.iso
  const effectiveCompactSelection = compactSelection ?? defaultCompactDate ?? null

  return (
    <Box component="main" aria-label="Este Mês" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-3)', height: '100%', minHeight: 0 }}>
      <Box component="header" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-2)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-2)', flexWrap: 'wrap' }}>
          <Box sx={{ ...typography['page-title'], color: 'var(--ds-ink)' }}>{formatMonthTitle(monthFirst)}</Box>
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

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-2)', flexWrap: 'wrap' }}>
          <Button aria-label="Mês anterior" onClick={() => setExplicitMonthFirst(addMonthsIso(monthFirst, -1))}>
            ‹
          </Button>
          <Button
            aria-label="Próximo mês operacional"
            onClick={() => setExplicitMonthFirst(addMonthsIso(monthFirst, 1))}
          >
            ›
          </Button>
          {!isCurrentMonth && (
            <Button onClick={() => setExplicitMonthFirst(undefined)}>Voltar para o mês atual</Button>
          )}
          {planningTarget ? (
            <>
              <Button
                component={RouterLink}
                to="/planner/month/planning"
                sx={{ backgroundColor: 'var(--ds-primary)', color: 'var(--ds-on-primary)' }}
              >
                Continuar planejamento
              </Button>
              <Button component={RouterLink} to="/planner/month/planning" variant="text">
                Mês em planejamento
              </Button>
            </>
          ) : (
            <Button
              onClick={handleOpenPlanning}
              sx={{ backgroundColor: 'var(--ds-primary)', color: 'var(--ds-on-primary)' }}
            >
              Planejar próximo mês
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

      {/* Tablet reusa a composição de compact (seleção de data + lista de um
          dia por vez), não a grade de 7 colunas: achado real do axe
          (`target-size`) — mesmo com a coluna do pool removida da largura
          disputada (Task 9), 7 colunas a ~768–1023px não deixam espaço
          suficiente para os alvos de toque de `TaskRowBase` variant `compact`
          (componente compartilhado, "não modificar" — AC2) permanecerem
          ≥24px. Risco de mudança de uma linha se uma composição própria de
          tablet for desejada no futuro, com uma revisão de `TaskRowBase`. */}
      {faixa === 'compact' || faixa === 'tablet' ? (
        <>
          <Box
            role="grid"
            aria-label="Selecionar dia do mês"
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(var(--ds-monthly-board-columns), minmax(0, 1fr))',
              gap: 'var(--ds-space-1)',
            }}
          >
            {weeks.map((week, weekIndex) => (
              <Box key={weekIndex} role="row" sx={{ display: 'contents' }}>
                {week.map((day) =>
                  day.inMonth ? (
                    <Box
                      key={day.iso}
                      role="gridcell"
                      component="button"
                      type="button"
                      aria-current={effectiveCompactSelection === day.iso ? 'true' : undefined}
                      onClick={() => setCompactSelection(day.iso)}
                      sx={{
                        ...typography.label,
                        padding: 'var(--ds-space-1)',
                        border: '1px solid var(--ds-control-border)',
                        borderRadius: 'var(--ds-radius-sm)',
                        backgroundColor:
                          effectiveCompactSelection === day.iso ? 'var(--ds-primary)' : 'var(--ds-surface)',
                        color: effectiveCompactSelection === day.iso ? 'var(--ds-on-primary)' : 'var(--ds-ink)',
                        outline: day.iso === todayIso ? '2px solid var(--ds-info)' : 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {parseLocalDate(day.iso).getDate()}
                    </Box>
                  ) : (
                    <Box
                      key={day.iso}
                      role="gridcell"
                      // `--ds-ink-muted` (não `--ds-ink-disabled`, achado real
                      // do axe em `MonthlyCalendarGrid.tsx`): mesma correção
                      // de contraste, mesmo racional.
                      sx={{ ...typography.meta, color: 'var(--ds-ink-muted)', padding: 'var(--ds-space-1)' }}
                    >
                      {formatDayLabel(day.iso, 'day-month')}
                    </Box>
                  ),
                )}
              </Box>
            ))}
          </Box>
          <Box
            component="button"
            type="button"
            aria-pressed={effectiveCompactSelection === 'undated'}
            onClick={() => setCompactSelection('undated')}
            sx={{
              ...typography.label,
              alignSelf: 'flex-start',
              padding: 'var(--ds-space-1) var(--ds-space-2)',
              border: '1px solid var(--ds-control-border)',
              borderRadius: 'var(--ds-radius-sm)',
              backgroundColor: effectiveCompactSelection === 'undated' ? 'var(--ds-primary)' : 'var(--ds-surface)',
              color: effectiveCompactSelection === 'undated' ? 'var(--ds-on-primary)' : 'var(--ds-ink)',
              cursor: 'pointer',
            }}
          >
            Sem dia definido
          </Box>
          <Box sx={{ flex: 1, minHeight: 0 }}>
            {effectiveCompactSelection === 'undated'
              ? poolPanel
              : effectiveCompactSelection && compactDayPanel(effectiveCompactSelection)}
          </Box>
        </>
      ) : (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) var(--ds-monthly-board-undated-width)',
            gap: 'var(--ds-monthly-board-gap)',
          }}
        >
          <MonthlyCalendarGrid
            monthFirst={monthFirst}
            tasksByDate={tasksByDate}
            todayIso={todayIso}
            cycleStatus={status as CycleStatus}
            readonly={isReadonly}
            onOpenDetail={setOpenTaskId}
            onTransition={handleTransition}
            onCreate={isReadonly ? undefined : handleCreate}
          />
          <Box sx={{ minHeight: 0 }}>{poolPanel}</Box>
        </Box>
      )}

      {openTask && (
        <TaskDetailCard
          key={openTaskId}
          task={openTask}
          isSubtask={isOpenTaskSubtask}
          readonly={isReadonly}
          onClose={() => setOpenTaskId(null)}
        />
      )}
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
