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
//   ▶ `onMove` de `TaskDetailCard` está CABEADO desde DW-27 (o gap da 14.5/14.6
//     foi fechado nos dois boards): o botão abre o `DestinationDialog` com os
//     destinos nomeados desta superfície. A oferta do mês EM FOCO passa pelo
//     adaptador único `migrateFieldsForMonth` (Story 14.11): posterior ao
//     corrente ⇒ `'future'` + `monthFirst`; na faixa `[alvo de planejamento,
//     corrente]` ⇒ `'month'` + `monthFirst` explícito (o servidor aceita); abaixo
//     do alvo ⇒ INDISPONÍVEL com motivo (ali não se escreve mais).
//   ▶ Story 14.11 — os botões de ciclo NOMEIAM o mês-alvo ("Continuar
//     planejamento de Setembro de 2026" / "Planejar Outubro de 2026"; o alvo
//     previsto espelha `next_monthly_target`: `planning` → `active + 1` → mês
//     corrente), uma linha de regularização atrasada aparece quando o alvo é
//     anterior ao corrente, a prontidão em erro ganha retry, e o 409 de
//     `open_planning_target` vira `role="alert"` com o `detail` do servidor.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Box, Button, useMediaQuery } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

import { domainErrorMessage } from '../../api/errors'

import {
  DestinationDialog,
  invalidateRitualQueries,
  TaskDetailCard,
  useCreateMonthlyTaskMutation,
  useMigrateTaskMutation,
  useMonthlyCycleActionMutation,
  useMonthlyCycleReadinessQuery,
  useMonthlyLogQuery,
  useReorderTaskMutation,
  useTodayLogQuery,
  useTransitionTaskMutation,
} from '../../features/bujo'
import type {
  CycleStatus,
  DestinationConfirmMeta,
  DestinationOffer,
  DestinationSelection,
  MigrationDestination,
  Task,
  TaskStatus,
} from '../../features/bujo'
import { MonthlyCalendarGrid } from '../../features/bujo/components/monthly/MonthlyCalendarGrid'
import { migrateFieldsForMonth } from '../../features/bujo/components/monthly/monthlyRitualSources'
// Reuso deliberado (AD-21/"zero recriação"): `WeeklyTaskPanel` é uma
// composição genérica (header + contagem + lista rolável + criação
// contextual + reordenação) sem nada Weekly-específico — serve tanto o pool
// "Sem dia definido" quanto a lista completa de um dia em compact, sem fork.
import { WeeklyTaskPanel } from '../../features/bujo/components/weekly/WeeklyTaskPanel'
import { PlannerSkeleton } from '../../features/bujo/components/PlannerSkeleton'
import { capitalize, formatMonthTitle } from '../../features/bujo/monthNames'
import { navIconFor } from '../../app/layout/shell/navIcons'
import { mediaQueries, typography } from '../../shared/design/tokens'
import { addMonthsIso, formatDayLabel, mondayIsoOf, monthGridWeeks, monthsBetweenIso, parseLocalDate } from '../../shared/date'
import { useOnlineStatus } from '../../shared/hooks/useOnlineStatus'

type StatusFilterKey = 'pending' | 'started' | 'completed' | 'migrated-postponed' | 'cancelled'

const CYCLE_STATUS_LABEL: Record<Exclude<CycleStatus, null>, string> = {
  planning: 'Em planejamento',
  active: 'Em andamento',
  finalized: 'Finalizada',
}

// ── "Mover tarefa" (DW-27) ────────────────────────────────────────────────────
/** Story 14.11: `POST /migrate/` grava com `'month'` + `monthFirst` em qualquer
 * mês da faixa `[alvo de planejamento mensal, corrente]`; ABAIXO do alvo não
 * se escreve mais (400 "Anterior ao alvo de planejamento mensal."). */
const PAST_MONTH_UNAVAILABLE_REASON = 'este mês é anterior ao alvo de planejamento mensal'

/** `'future'` recusa o mês corrente ("Use 'month' para o mês corrente."). */
const FUTURE_MONTH_REJECTED_REASON = 'Este Mês atende o mês corrente — escolha essa opção.'

const MOVE_ERROR = 'Não foi possível mover a tarefa. Tente novamente.'

const OPEN_PLANNING_ERROR = 'Não foi possível abrir o planejamento. Tente novamente.'

/** Ids das ofertas — o chamador é quem traduz `meta.offerId` no `destination`
 * do POST (o diálogo é agnóstico de domínio). */
const MOVE_OFFER = {
  today: 'today',
  currentWeek: 'week',
  currentMonth: 'month',
  boardMonth: 'board-month',
  future: 'future',
} as const

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

export function MonthlyBoardPage() {
  const queryClient = useQueryClient()
  const [explicitMonthFirst, setExplicitMonthFirst] = useState<string | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey | null>(null)
  const [hideNotOpen, setHideNotOpen] = useState(false)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [compactSelection, setCompactSelection] = useState<string | 'undated' | null>(null)
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)
  // Story 14.11: motivo do último `open_planning_target` rejeitado (409 →
  // `detail` do servidor; outro erro → fallback). Limpo no próximo sucesso.
  const [cycleError, setCycleError] = useState<string | null>(null)

  const monthlyLog = useMonthlyLogQuery(explicitMonthFirst)
  // Dedup automático com a query acima quando `explicitMonthFirst` é `undefined`.
  const currentMonthLog = useMonthlyLogQuery()
  const todayLog = useTodayLogQuery()
  const readiness = useMonthlyCycleReadinessQuery()
  // Assim que um alvo em planejamento existe, o erro de "Planejar" perdeu o
  // objeto (review): limpa, para não ficar preso ao navegar/recarregar.
  const planningTargetFromReadiness = readiness.data?.planning?.monthFirst ?? null
  useEffect(() => {
    if (planningTargetFromReadiness) setCycleError(null)
  }, [planningTargetFromReadiness])
  const createTask = useCreateMonthlyTaskMutation()
  const transitionTask = useTransitionTaskMutation()
  const reorderTask = useReorderTaskMutation()
  const cycleAction = useMonthlyCycleActionMutation()
  const migrateTask = useMigrateTaskMutation()
  const isOnline = useOnlineStatus()

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

  // ── "Mover tarefa" (DW-27) ─────────────────────────────────────────────────
  // A semana corrente sai de `mondayIsoOf(todayIso)` (espelho exato de
  // `core.calendar.week_start_of`), não de `new Date()` — "hoje" continua vindo
  // do servidor (Convenção #8), como já faz `BrainDumpDestinationPicker`.
  const currentMonthFirst = currentMonthLog.data?.monthFirst ?? null
  const currentWeekStart = todayIso ? mondayIsoOf(todayIso) : null

  // ── Alvo do ciclo (Story 14.11) ──────────────────────────────────────────
  // `planning` é o alvo quando existe; senão o PREVISTO espelha
  // `next_monthly_target` do servidor: mês seguinte ao `active`, ou o corrente.
  const planningTarget = readiness.data?.planning?.monthFirst ?? null
  const predictedTarget = readiness.data
    ? readiness.data.active
      ? addMonthsIso(readiness.data.active.monthFirst, 1)
      : currentMonthFirst
    : null
  const cycleTarget = planningTarget ?? predictedTarget
  // Regularização atrasada: o alvo (em planejamento ou previsto) é anterior ao
  // mês corrente — faltam `catchUpMonths` meses, materializados um por vez.
  const catchUpMonths =
    cycleTarget && currentMonthFirst && cycleTarget < currentMonthFirst
      ? monthsBetweenIso(cycleTarget, currentMonthFirst)
      : 0
  // Piso de escrita de `'month'` + `monthFirst`: espelha o servidor
  // (`min(next_monthly_target, corrente)` em `TaskMigrateView`) — o alvo em
  // planejamento OU o previsto (`active + 1`), quando anterior ao corrente;
  // senão o próprio corrente. Abaixo dele a oferta do mês em foco fica indisponível.
  const writableFloor =
    currentMonthFirst && (cycleTarget && cycleTarget < currentMonthFirst ? cycleTarget : currentMonthFirst)
  // Sem prontidão (pendente/erro) o piso é desconhecido: NÃO marcar a oferta
  // como indisponível — o servidor valida, e um 400 vira `MOVE_ERROR` (review).
  const boardMonthBelowFloor = Boolean(readiness.data && writableFloor && monthFirst < writableFloor)

  const moveOffers: DestinationOffer[] = [
    {
      id: MOVE_OFFER.today,
      label: 'Hoje',
      icon: navIconFor('today'),
      day: { kind: 'none' },
    },
    ...(currentWeekStart
      ? [
          {
            id: MOVE_OFFER.currentWeek,
            label: 'Esta Semana',
            icon: navIconFor('planner-week'),
            day: { kind: 'week' as const, weekStart: currentWeekStart },
            undated: {},
          },
        ]
      : []),
    ...(currentMonthFirst
      ? [
          {
            id: MOVE_OFFER.currentMonth,
            label: 'Este Mês',
            icon: navIconFor('planner-month'),
            day: { kind: 'month' as const, monthFirst: currentMonthFirst },
            undated: {},
          },
        ]
      : []),
    // O mês NAVEGADO só é destino distinto quando não é o corrente. Posterior ⇒
    // `'future'` + `monthFirst`; entre o alvo de planejamento e o corrente ⇒
    // `'month'` + `monthFirst` (Story 14.11); abaixo do alvo ⇒ visível e
    // INDISPONÍVEL com o motivo, nunca um 400 cru do servidor.
    ...(currentMonthFirst && monthFirst !== currentMonthFirst
      ? [
          {
            id: MOVE_OFFER.boardMonth,
            label: formatMonthTitle(monthFirst),
            icon: navIconFor('planner-month'),
            day: { kind: 'month' as const, monthFirst },
            undated: {},
            unavailableReason: boardMonthBelowFloor ? PAST_MONTH_UNAVAILABLE_REASON : null,
          },
        ]
      : []),
    ...(currentMonthFirst
      ? [
          {
            id: MOVE_OFFER.future,
            label: 'Futuro',
            icon: navIconFor('planner-future'),
            day: {
              kind: 'month-choice' as const,
              rejectUpToMonthFirst: currentMonthFirst,
              rejectedMonthReason: FUTURE_MONTH_REJECTED_REASON,
            },
            undated: {},
          },
        ]
      : []),
  ]

  function openMove(taskId: string) {
    setMovingTaskId(taskId)
    setMoveError(null)
  }

  function closeMove() {
    setMovingTaskId(null)
    setMoveError(null)
  }

  /** Rótulo NOMEADO do ato — nunca um "Confirmar" genérico. */
  function confirmLabelForMove({ offerId, scheduledDate, monthFirst: selectionMonth }: DestinationSelection): string {
    if (offerId === MOVE_OFFER.today) return 'Mover para hoje'
    if (!scheduledDate) {
      if (offerId === MOVE_OFFER.currentWeek) return 'Mover sem dia definido (esta semana)'
      if (offerId === MOVE_OFFER.currentMonth) return 'Mover sem dia definido (este mês)'
      return `Mover sem dia definido (${formatMonthTitle(selectionMonth).toLowerCase()})`
    }
    if (offerId === MOVE_OFFER.currentWeek) {
      return `Mover para ${formatDayLabel(scheduledDate, 'weekday').toLowerCase()}, ${formatDayLabel(scheduledDate, 'day-month')}`
    }
    return `Mover para ${formatDayLabel(scheduledDate, 'day-month')}`
  }

  /** `meta.offerId` → contrato de `POST /migrate/`. "Este Mês" sem `monthFirst`
   * é o legado (o servidor resolve o corrente); o mês NAVEGADO passa pelo
   * adaptador único `migrateFieldsForMonth` (Story 14.11). */
  function migrateFieldsFor(
    offerId: string,
    scheduledDate: string | null,
    selectionMonthFirst: string,
  ): { destination: MigrationDestination; monthFirst?: string; scheduledDate?: string | null } | null {
    const day = scheduledDate ?? undefined
    if (offerId === MOVE_OFFER.today) return { destination: 'today' }
    if (offerId === MOVE_OFFER.currentWeek) return { destination: 'week', scheduledDate: day }
    if (offerId === MOVE_OFFER.currentMonth) return { destination: 'month', scheduledDate: day }
    if (offerId === MOVE_OFFER.boardMonth) {
      if (boardMonthBelowFloor || !currentMonthFirst) return null
      return migrateFieldsForMonth(monthFirst, scheduledDate, currentMonthFirst)
    }
    if (offerId === MOVE_OFFER.future) {
      return { destination: 'future', monthFirst: selectionMonthFirst, scheduledDate: day }
    }
    return null
  }

  function handleConfirmMove(scheduledDate: string | null, meta: DestinationConfirmMeta) {
    if (!movingTaskId) return
    const fields = migrateFieldsFor(meta.offerId, scheduledDate, meta.monthFirst)
    // Oferta sem tradução para o contrato de `/migrate/` (o mês em foco já
    // passado é exatamente esse caso): NUNCA um retorno silencioso — o motivo
    // aparece no diálogo, que é a razão de esta passada existir.
    if (!fields) {
      setMoveError(MOVE_ERROR)
      return
    }
    setMoveError(null)
    migrateTask.mutate(
      { taskId: movingTaskId, ...fields },
      {
        // Sucesso NÃO mostra toast: a invalidação por prefixo re-deriva o board
        // de origem e o de destino sozinha. `invalidateRitualQueries` cobre o
        // que `useMigrateTaskMutation` NÃO invalida — prontidão de ciclo e
        // fontes dos rituais —, como já fazem `handleTransition`/`handleReorder`:
        // mover a ÚLTIMA pendente para fora do mês muda o banner de
        // planejamento, e sem isto ele ficaria desatualizado.
        onSuccess: () => {
          invalidateRitualQueries(queryClient)
          closeMove()
        },
        // Falha PRESERVA o seletor aberto, com o destino armado e o motivo.
        onError: () => setMoveError(MOVE_ERROR),
      },
    )
  }

  function handleOpenPlanning() {
    // `open_planning_target` é determinístico no servidor (M07: sem escolha,
    // sem campo de data) — nenhum `monthFirst` precisa ser enviado. Um 409
    // (disputa de alvo, gate) vira texto em `role="alert"` (Story 14.11).
    cycleAction.mutate(
      { action: 'open_planning_target' },
      {
        onSuccess: () => setCycleError(null),
        onError: (error) => setCycleError(domainErrorMessage(error, OPEN_PLANNING_ERROR)),
      },
    )
  }

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
                Continuar planejamento de {formatMonthTitle(planningTarget)}
              </Button>
              {/* Cor EXPLÍCITA (mesmo achado do axe da DW-16): sem override o MUI
                  aplica o teal legado de `theme.palette.primary`, abaixo do piso AA
                  sobre a superfície — pego pelo axe do board em regularização atrasada. */}
              <Button
                component={RouterLink}
                to="/planner/month/planning"
                variant="text"
                sx={{ color: 'var(--ds-primary)' }}
              >
                Mês em planejamento
              </Button>
            </>
          ) : (
            <Button
              onClick={handleOpenPlanning}
              disabled={cycleAction.isPending}
              sx={{ backgroundColor: 'var(--ds-primary)', color: 'var(--ds-on-primary)' }}
            >
              {predictedTarget ? `Planejar ${formatMonthTitle(predictedTarget)}` : 'Planejar próximo mês'}
            </Button>
          )}
          {readiness.isError && (
            <Box role="alert" sx={{ ...typography.meta, color: 'var(--ds-danger)', display: 'flex', alignItems: 'center', gap: 'var(--ds-space-1)' }}>
              Não foi possível carregar o ciclo mensal.
              <Button size="small" onClick={() => readiness.refetch()} sx={{ color: 'var(--ds-primary)' }}>
                Tentar novamente
              </Button>
            </Box>
          )}
        </Box>

        {catchUpMonths > 0 && cycleTarget && currentMonthFirst && (
          <Box role="status" sx={{ ...typography.meta, color: 'var(--ds-warning)' }}>
            Regularização atrasada: {formatMonthTitle(cycleTarget)} é anterior ao mês corrente —{' '}
            {catchUpMonths === 1 ? 'falta 1 mês' : `faltam ${catchUpMonths} meses`} para alcançar{' '}
            {formatMonthTitle(currentMonthFirst)}, um por vez.
          </Box>
        )}

        {cycleError && !planningTarget && (
          <Box role="alert" sx={{ ...typography.body, color: 'var(--ds-danger)', backgroundColor: 'var(--ds-danger-soft)', padding: 'var(--ds-space-2)', borderRadius: 'var(--ds-radius-sm)' }}>
            {cycleError}
          </Box>
        )}

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
          // Fecha o detalhe e abre o seletor (molde de `FutureBoardPage`): dois
          // modais empilhados disputariam foco e backdrop.
          onMove={() => {
            const taskId = openTask.id
            setOpenTaskId(null)
            openMove(taskId)
          }}
          onClose={() => setOpenTaskId(null)}
        />
      )}

      {movingTaskId && (
        <DestinationDialog
          title="Escolher destino"
          description={allTasksById.get(movingTaskId)?.title}
          offer={moveOffers}
          compact={faixa === 'compact'}
          // Guard de escrita dupla: offline E mutação em curso — sem a segunda
          // metade, dois cliques rápidos viram dois POST da MESMA tarefa.
          disabled={!isOnline || migrateTask.isPending}
          error={moveError}
          confirmLabelFor={confirmLabelForMove}
          onConfirm={handleConfirmMove}
          onClose={closeMove}
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
