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
//   ▶ "Mover tarefa" (DW-27): o botão do `TaskDetailCard` abre o
//     `DestinationDialog` com os destinos NOMEADOS desta superfície. O board
//     oferta o período que MOSTRA mais os canônicos porque `'week'` e `'month'`
//     gravam em logs DIFERENTES — não dá para alcançar um pelo outro. As regras
//     de domínio de `POST /migrate/` viram indisponibilidade EXPLÍCITA com
//     motivo, nunca um 400 cru (ver `WEEK_UNDATED_UNAVAILABLE_REASON`).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Box, Button, useMediaQuery } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

import {
  DestinationDialog,
  invalidateRitualQueries,
  TaskDetailCard,
  useCreateWeeklyTaskMutation,
  useMigrateTaskMutation,
  useReorderTaskMutation,
  useTodayLogQuery,
  useTransitionTaskMutation,
  useWeeklyCycleActionMutation,
  useWeeklyCycleReadinessQuery,
  useWeeklyLogQuery,
} from '../../features/bujo'
import type {
  CycleStatus,
  DestinationConfirmMeta,
  DestinationOffer,
  DestinationSelection,
  MigrationDestination,
  Task,
  TaskStatus,
  WeeklyDay,
} from '../../features/bujo'
import { WeeklyTaskPanel } from '../../features/bujo/components/weekly/WeeklyTaskPanel'
import { PlannerSkeleton } from '../../features/bujo/components/PlannerSkeleton'
import { capitalize, MONTH_NAMES_PT } from '../../features/bujo/monthNames'
import { navIconFor } from '../../app/layout/shell/navIcons'
import { mediaQueries, typography } from '../../shared/design/tokens'
import { useOnlineStatus } from '../../shared/hooks/useOnlineStatus'
import { addDaysIso, formatDayLabel, isoWeekNumber, parseLocalDate, weekPositionInMonth } from '../../shared/date'

type StatusFilterKey = 'pending' | 'started' | 'completed' | 'migrated-postponed' | 'cancelled'

const CYCLE_STATUS_LABEL: Record<Exclude<CycleStatus, null>, string> = {
  planning: 'Em planejamento',
  active: 'Em andamento',
  finalized: 'Finalizada',
}

// ── "Mover tarefa" (DW-27) ────────────────────────────────────────────────────
/** `POST /migrate/` com `destination: 'week'` e SEM `scheduledDate` cai na
 * semana CORRENTE no servidor (`services/migration.py`), nunca na semana em
 * foco. A oferta da semana navegada existe, mas sem a opção "Sem dia definido". */
const WEEK_UNDATED_UNAVAILABLE_REASON = 'esta não é a semana corrente — escolha um dia'

/** `'future'` exige `monthFirst` ESTRITAMENTE posterior ao mês corrente
 * (`views.py`: "Use 'month' para o mês corrente."). */
const FUTURE_MONTH_REJECTED_REASON = 'Este Mês atende o mês corrente — escolha essa opção.'

const MOVE_ERROR = 'Não foi possível mover a tarefa. Tente novamente.'

/** Ids das ofertas — o chamador é quem traduz `meta.offerId` no `destination`
 * do POST (o diálogo é agnóstico de domínio). */
const MOVE_OFFER = {
  today: 'today',
  currentWeek: 'week',
  boardWeek: 'board-week',
  currentMonth: 'month',
  future: 'future',
} as const

function monthFirstOf(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

function monthTitleOf(monthFirst: string): string {
  const [year, month] = monthFirst.split('-').map(Number)
  return `${capitalize(MONTH_NAMES_PT[month - 1])} de ${year}`
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
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)

  const weeklyLog = useWeeklyLogQuery(explicitWeekStart)
  // Dedup automático com a query acima quando `explicitWeekStart` é `undefined`
  // (mesma chave, mesmo cache) — o custo extra só existe ao navegar.
  const currentWeekLog = useWeeklyLogQuery()
  // Autoridade de "hoje" (Convenção #8) — daqui saem o mês corrente das ofertas
  // de "Mover tarefa" e o teto de recusa do destino "Futuro".
  const todayLog = useTodayLogQuery()
  const readiness = useWeeklyCycleReadinessQuery()
  const createTask = useCreateWeeklyTaskMutation()
  const transitionTask = useTransitionTaskMutation()
  const reorderTask = useReorderTaskMutation()
  const cycleAction = useWeeklyCycleActionMutation()
  const migrateTask = useMigrateTaskMutation()
  const isOnline = useOnlineStatus()

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

  // ── "Mover tarefa" (DW-27) ─────────────────────────────────────────────────
  // Uma oferta por destino ALCANÇÁVEL desta superfície. `'week'` e `'month'`
  // gravam em logs diferentes, então o board precisa ofertar os dois além do
  // período que ele mostra. As ofertas que dependem de "hoje" só entram depois
  // que o servidor respondeu — nada é derivado de `new Date()` aqui.
  const currentWeekStart = currentWeekLog.data?.weekStart ?? null
  const currentMonthFirst = todayLog.data?.logDate ? monthFirstOf(todayLog.data.logDate) : null

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
    // A semana NAVEGADA só é um destino distinto quando não é a corrente — e
    // nela "Sem dia definido" é impossível por regra do servidor.
    //
    // O gate é `currentWeekStart && weekStart !== currentWeekStart`, NÃO
    // `!isCurrentWeek`: `isCurrentWeek` é `false` enquanto `currentWeekLog`
    // carrega, e nessa janela nasceria uma oferta para a semana que É a
    // corrente, carregando o motivo "esta não é a semana corrente" — informação
    // falsa. (`isCurrentWeek` segue servindo o botão "Voltar para hoje", onde
    // um `false` transitório só mostra um atalho a mais.) Mesmo padrão do
    // Monthly.
    ...(currentWeekStart && weekStart !== currentWeekStart
      ? [
          {
            id: MOVE_OFFER.boardWeek,
            label: formatWeekRange(weekStart),
            icon: navIconFor('planner-week'),
            day: { kind: 'week' as const, weekStart },
            undated: { unavailableReason: WEEK_UNDATED_UNAVAILABLE_REASON },
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

  /** Rótulo NOMEADO do ato — nunca um "Confirmar" genérico. O dia de um destino
   * SEMANAL é nomeado pelo dia da semana (é assim que a semana é lida); o de um
   * destino mensal, pela data. */
  function confirmLabelForMove({ offerId, scheduledDate, monthFirst }: DestinationSelection): string {
    if (offerId === MOVE_OFFER.today) return 'Mover para hoje'
    const isWeekDestination = offerId === MOVE_OFFER.currentWeek || offerId === MOVE_OFFER.boardWeek
    if (!scheduledDate) {
      if (offerId === MOVE_OFFER.currentWeek) return 'Mover sem dia definido (esta semana)'
      if (offerId === MOVE_OFFER.currentMonth) return 'Mover sem dia definido (este mês)'
      return `Mover sem dia definido (${monthTitleOf(monthFirst).toLowerCase()})`
    }
    if (isWeekDestination) {
      return `Mover para ${formatDayLabel(scheduledDate, 'weekday').toLowerCase()}, ${formatDayLabel(scheduledDate, 'day-month')}`
    }
    return `Mover para ${formatDayLabel(scheduledDate, 'day-month')}`
  }

  /** `meta.offerId` → contrato de `POST /migrate/`. `'today'` ignora
   * `scheduledDate` no servidor; `'month'` sempre grava no mês CORRENTE
   * (`month_first` nunca é aceito do cliente); `'future'` exige `monthFirst`. */
  function migrateFieldsFor(
    offerId: string,
    scheduledDate: string | null,
    monthFirst: string,
  ): { destination: MigrationDestination; monthFirst?: string; scheduledDate?: string } | null {
    const day = scheduledDate ?? undefined
    if (offerId === MOVE_OFFER.today) return { destination: 'today' }
    if (offerId === MOVE_OFFER.currentWeek || offerId === MOVE_OFFER.boardWeek) {
      return { destination: 'week', scheduledDate: day }
    }
    if (offerId === MOVE_OFFER.currentMonth) return { destination: 'month', scheduledDate: day }
    if (offerId === MOVE_OFFER.future) return { destination: 'future', monthFirst, scheduledDate: day }
    return null
  }

  function handleConfirmMove(scheduledDate: string | null, meta: DestinationConfirmMeta) {
    if (!movingTaskId) return
    const fields = migrateFieldsFor(meta.offerId, scheduledDate, meta.monthFirst)
    // Oferta sem tradução para o contrato de `/migrate/` (ex.: o mês em foco já
    // passado): NUNCA um retorno silencioso — o motivo aparece no diálogo, que
    // é a razão de esta passada existir.
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
        // mover a ÚLTIMA pendente para fora da semana muda o banner de
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
          // Fecha o detalhe e abre o seletor (molde de `FutureBoardPage`): dois
          // modais empilhados disputariam foco e backdrop.
          onMove={() => {
            const taskId = openTask.id
            setOpenTaskId(null)
            openMove(taskId)
          }}
          onClose={() => setOpenTaskId(null)}
          predecessor={openTaskId ? findPredecessor(days, unscheduled, openTaskId) : null}
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
