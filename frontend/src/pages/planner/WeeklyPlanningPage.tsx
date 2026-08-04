// ─────────────────────────────────────────────────────────────────────────────
// Ritual de planejamento semanal (Story 14.5, AC5) — três regiões: rail de
// fontes (nav), lista de decisões (centro), rail de contexto (aside, sticky —
// conteúdo da Task 10). Visualmente separado da grade, sem camada modal, sem
// tela cheia.
//
//   ▶ O alvo do ritual vem SEMPRE de `readiness.planning.weekStart` — nunca da
//     URL (é o que sustenta "apenas uma semana Em planejamento").
//   ▶ Cada fonte é um `useQuery` independente — uma fonte em erro nunca
//     desabilita as outras.
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Box, useMediaQuery } from '@mui/material'

import {
  invalidateRitualQueries,
  useMigrateTaskMutation,
  useMonthlyInWeekSourceQuery,
  useMonthlyLogQuery,
  usePendingDailiesSourceQuery,
  usePlaceRecurringTemplateMutation,
  usePreviousWeeklySourceQuery,
  useRitualDecisionMutation,
  useRitualTaskTransitionMutation,
  useWeeklyCycleActionMutation,
  useWeeklyCycleReadinessQuery,
  useWeeklyDensityQuery,
  useWeeklyLogQuery,
  useWeeklyRecurringSourceQuery,
} from '../../features/bujo'
import { PlannerSkeleton } from '../../features/bujo/components/PlannerSkeleton'
import { WeeklySourceRail, type WeeklySourceRailEntry } from '../../features/bujo/components/weekly/WeeklySourceRail'
import { WeeklyDecisionList } from '../../features/bujo/components/weekly/WeeklyDecisionList'
import {
  DestinationDialog,
  type DestinationSelection,
} from '../../features/bujo/components/DestinationDialog'
import { WeeklyContextRail, type WeeklyProgressSourceInput } from '../../features/bujo/components/weekly/WeeklyContextRail'
import {
  normalizeSource,
  normalizeTaskItems,
  normalizeTemplateItems,
  WEEKLY_RITUAL_SOURCE_ORDER,
  type NormalizedRitualItem,
  type WeeklyRitualSourceId,
} from '../../features/bujo/components/weekly/weeklyRitualSources'
import { addDaysIso, formatDayLabel } from '../../shared/date'
import { mediaQueries, typography } from '../../shared/design/tokens'
import { useOnlineStatus } from '../../shared/hooks/useOnlineStatus'

const PROGRESS_SOURCE_IDS: WeeklyRitualSourceId[] = [
  'monthly-in-week',
  'recurring',
  'previous-weekly',
  'pending-dailies',
]

export function WeeklyPlanningPage() {
  const queryClient = useQueryClient()
  const [activeSourceId, setActiveSourceId] = useState<WeeklyRitualSourceId>('monthly-in-week')
  const [view, setView] = useState<'pending' | 'all'>('pending')
  const [mutatedThisVisit, setMutatedThisVisit] = useState<Record<string, NormalizedRitualItem[]>>({})
  const [destinationPickerItemId, setDestinationPickerItemId] = useState<string | null>(null)
  // Falha de decisão preserva item/densidade/foco e oferece retry (AC5) — o
  // item por si só já permanece na lista (a mutação que falhou não some com
  // ele), mas sem isto não havia NENHUM motivo visível nem "Tentar novamente".
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({})
  const retryActionsRef = useRef<Record<string, () => void>>({})
  const [destinationError, setDestinationError] = useState<string | null>(null)
  // Story 14.5 AC6 — dia escolhido no rail de densidade. O rail fica `aria-hidden`
  // atrás do backdrop enquanto o seletor está aberto, então o clique acontece
  // ANTES: guardamos o dia e o seletor abre com ele JÁ ARMADO, a um clique da
  // confirmação nomeada. É o que mantém o caminho do rail vivo e alcançável.
  const [dayFromDensityRail, setDayFromDensityRail] = useState<string | null | undefined>(undefined)
  const isCompact = useMediaQuery(mediaQueries.compact)
  const isOnline = useOnlineStatus()

  const readiness = useWeeklyCycleReadinessQuery()
  const weekStart = readiness.data?.planning?.weekStart
  const hasTarget = Boolean(weekStart)
  // "Hoje" nunca vem do cliente (Convenção #8): a semana corrente é a que o
  // servidor devolve para a query sem parâmetro — usada só para decidir a
  // disponibilidade do alvo `0` no seletor de destino (lacuna B7).
  const currentWeekLog = useWeeklyLogQuery()
  const isCurrentWeek = Boolean(weekStart && currentWeekLog.data?.weekStart === weekStart)
  // Log do ALVO (distinto da semana corrente acima) — só para "Cancelar
  // planejamento" saber se o alvo já tem alguma tarefa (a 2ª metade do
  // guardrail "zero decisão + zero tarefa" que o backend não impõe sozinho).
  const targetWeekLog = useWeeklyLogQuery(weekStart)

  const monthlyInWeek = useMonthlyInWeekSourceQuery(weekStart ?? '', { enabled: hasTarget })
  const recurring = useWeeklyRecurringSourceQuery(weekStart ?? '', { enabled: hasTarget })
  const previousWeekly = usePreviousWeeklySourceQuery(weekStart ?? '', { enabled: hasTarget })
  const pendingDailies = usePendingDailiesSourceQuery(weekStart ?? '', { enabled: hasTarget })
  // Densidade real por dia da semana-ALVO — a MESMA chave que o rail de
  // contexto já consulta (dedup automático do TanStack Query, zero rede extra).
  // O seletor de destino recebe o mapa pronto: quem conhece "densidade semanal"
  // é esta página, não o componente agnóstico.
  const weeklyDensity = useWeeklyDensityQuery(weekStart ?? '', { enabled: hasTarget })
  // "Qualquer mês navegável" (M06) — navegação entre meses fica para uma
  // extensão futura; por ora, o mês do alvo do planejamento.
  const monthlyExpandedTarget = `${(weekStart ?? '').slice(0, 7)}-01`
  const monthlyExpanded = useMonthlyLogQuery(monthlyExpandedTarget, {
    enabled: hasTarget && activeSourceId === 'monthly-expanded',
  })

  const transitionTask = useRitualTaskTransitionMutation()
  const migrateTask = useMigrateTaskMutation()
  const placeTemplate = usePlaceRecurringTemplateMutation()
  const ritualDecision = useRitualDecisionMutation()
  const cycleAction = useWeeklyCycleActionMutation()

  if (readiness.isPending) {
    return (
      <Box component="main" aria-label="Planejar a semana" sx={{ p: 'var(--ds-space-4)' }}>
        <PlannerSkeleton />
      </Box>
    )
  }

  if (!weekStart) {
    return (
      <Box component="main" aria-label="Planejar a semana" sx={{ p: 'var(--ds-space-4)' }}>
        Nenhuma semana em planejamento no momento.
      </Box>
    )
  }

  const itemsBySource: Record<WeeklyRitualSourceId, NormalizedRitualItem[]> = {
    'monthly-in-week': normalizeSource('monthly-in-week', monthlyInWeek.data),
    'monthly-expanded': monthlyExpanded.data
      ? normalizeTaskItems(
          monthlyExpanded.data.tasks
            .filter((task) => task.status === 'pending' || task.status === 'started')
            .map((task) => ({ task, decision: null })),
        )
      : [],
    recurring: normalizeSource('recurring', recurring.data),
    'previous-weekly': normalizeSource('previous-weekly', previousWeekly.data),
    'pending-dailies': normalizeSource('pending-dailies', pendingDailies.data),
  }

  const loadingBySource: Record<WeeklyRitualSourceId, boolean> = {
    'monthly-in-week': monthlyInWeek.isPending,
    'monthly-expanded': monthlyExpanded.isFetching,
    recurring: recurring.isPending,
    'previous-weekly': previousWeekly.isPending,
    'pending-dailies': pendingDailies.isPending,
  }

  const errorBySource: Record<WeeklyRitualSourceId, boolean> = {
    'monthly-in-week': monthlyInWeek.isError,
    'monthly-expanded': monthlyExpanded.isError,
    recurring: recurring.isError,
    'previous-weekly': previousWeekly.isError,
    'pending-dailies': pendingDailies.isError,
  }

  const railEntries: WeeklySourceRailEntry[] = WEEKLY_RITUAL_SOURCE_ORDER.map((sourceId) => {
    if (sourceId === 'monthly-expanded') {
      return { sourceId, pendingCount: null, isLoading: loadingBySource[sourceId], isError: errorBySource[sourceId] }
    }
    const pendingCount = itemsBySource[sourceId].filter((item) => item.decision === null).length
    let subtitle: string | undefined
    if (sourceId === 'recurring') {
      subtitle = `${itemsBySource[sourceId].length} ativos · ${pendingCount} não avaliados`
    } else if (sourceId === 'previous-weekly') {
      subtitle = 'Bloqueia iniciar semana'
    } else if (sourceId === 'pending-dailies') {
      const days = new Set(itemsBySource[sourceId].map((item) => item.groupLabel))
      subtitle = `${days.size} dias não resolvidos`
    }
    return { sourceId, pendingCount, subtitle, isLoading: loadingBySource[sourceId], isError: errorBySource[sourceId] }
  })

  function retry(sourceId: WeeklyRitualSourceId) {
    if (sourceId === 'monthly-in-week') monthlyInWeek.refetch()
    if (sourceId === 'recurring') recurring.refetch()
    if (sourceId === 'previous-weekly') previousWeekly.refetch()
    if (sourceId === 'pending-dailies') pendingDailies.refetch()
    if (sourceId === 'monthly-expanded') monthlyExpanded.refetch()
  }

  function recordMutation(sourceId: WeeklyRitualSourceId, itemId: string, decision: string) {
    const item = itemsBySource[sourceId].find((candidate) => candidate.id === itemId)
    if (!item) return
    setMutatedThisVisit((prev) => ({
      ...prev,
      [sourceId]: [...(prev[sourceId] ?? []), { ...item, decision }],
    }))
  }

  // Falha preserva item/densidade/foco (AC5): a linha JÁ permanece na lista
  // (a mutação que falhou não remove nada) — o que faltava era o motivo
  // visível e um "Tentar novamente" que repete EXATAMENTE a última ação.
  function setItemError(itemId: string) {
    setItemErrors((prev) => ({ ...prev, [itemId]: 'Não foi possível salvar a decisão. Tente novamente.' }))
  }

  function clearItemError(itemId: string) {
    setItemErrors((prev) => {
      if (!(itemId in prev)) return prev
      const next = { ...prev }
      delete next[itemId]
      return next
    })
  }

  function handleRetryItem(itemId: string) {
    retryActionsRef.current[itemId]?.()
  }

  function handleKeep(itemId: string) {
    if (!weekStart) return
    const run = () => {
      clearItemError(itemId)
      ritualDecision.mutate(
        { decision: 'keep', weekStart, taskId: itemId },
        { onError: () => setItemError(itemId) },
      )
    }
    retryActionsRef.current[itemId] = run
    run()
  }

  function handleSkipWeek(templateId: string) {
    if (!weekStart) return
    const run = () => {
      clearItemError(templateId)
      ritualDecision.mutate(
        { decision: 'skip_week', weekStart, recurringTemplateId: templateId },
        { onError: () => setItemError(templateId) },
      )
    }
    retryActionsRef.current[templateId] = run
    run()
  }

  function handleAllocate(templateId: string) {
    if (!weekStart) return
    const run = () => {
      clearItemError(templateId)
      placeTemplate.mutate(
        { templateId, weekStart },
        {
          onSuccess: () => {
            recordMutation(activeSourceId, templateId, 'allocated')
            invalidateRitualQueries(queryClient)
          },
          onError: () => setItemError(templateId),
        },
      )
    }
    retryActionsRef.current[templateId] = run
    run()
  }

  function handleComplete(taskId: string) {
    const run = () => {
      clearItemError(taskId)
      transitionTask.mutate(
        { taskId, toStatus: 'completed' },
        {
          onSuccess: () => {
            recordMutation(activeSourceId, taskId, 'completed')
            invalidateRitualQueries(queryClient)
          },
          onError: () => setItemError(taskId),
        },
      )
    }
    retryActionsRef.current[taskId] = run
    run()
  }

  function handleCancel(taskId: string) {
    const run = () => {
      clearItemError(taskId)
      transitionTask.mutate(
        { taskId, toStatus: 'cancelled' },
        {
          onSuccess: () => {
            recordMutation(activeSourceId, taskId, 'cancelled')
            invalidateRitualQueries(queryClient)
          },
          onError: () => setItemError(taskId),
        },
      )
    }
    retryActionsRef.current[taskId] = run
    run()
  }

  function handleMigrateNamedDay(taskId: string, destinationDate: string) {
    const run = () => {
      clearItemError(taskId)
      migrateTask.mutate(
        { taskId, destination: 'week', scheduledDate: destinationDate },
        {
          onSuccess: () => {
            recordMutation(activeSourceId, taskId, 'migrated')
            invalidateRitualQueries(queryClient)
          },
          onError: () => setItemError(taskId),
        },
      )
    }
    retryActionsRef.current[taskId] = run
    run()
  }

  function handleOpenDestinationPicker(itemId: string) {
    setDestinationError(null)
    setDestinationPickerItemId(itemId)
  }

  function handleCloseDestinationPicker() {
    setDestinationPickerItemId(null)
    setDestinationError(null)
    setDayFromDensityRail(undefined)
  }

  function handleConfirmDestination(scheduledDate: string | null) {
    if (!destinationPickerItemId) return
    const taskId = destinationPickerItemId
    setDestinationError(null)
    migrateTask.mutate(
      { taskId, destination: 'week', scheduledDate },
      {
        onSuccess: () => {
          recordMutation(activeSourceId, taskId, 'migrated')
          invalidateRitualQueries(queryClient)
          // Só fecha o seletor no SUCESSO — falha preserva item/foco: o
          // seletor continua aberto, com o motivo visível, para "Tentar
          // novamente" ser literalmente repetir a mesma confirmação.
          handleCloseDestinationPicker()
        },
        onError: () => setDestinationError('Não foi possível migrar a tarefa. Tente novamente.'),
      },
    )
  }

  const activeItems = itemsBySource[activeSourceId].filter((item) =>
    view === 'pending' ? item.decision === null : item.decision !== null,
  )
  const activeAllItems =
    view === 'all'
      ? [...activeItems, ...(mutatedThisVisit[activeSourceId] ?? [])]
      : activeItems

  // Todo 409 de domínio traz só `detail` — decidir pelo estado JÁ CONHECIDO
  // (não por parsing de string) e recarregar o readiness depois de qualquer
  // ação de ciclo (êxito ou 409), para o painel de verificação nunca ficar
  // desatualizado frente ao que o servidor realmente aceitou.
  function refetchReadinessAfter() {
    readiness.refetch()
  }

  function handleCompletePlanning() {
    cycleAction.mutate({ action: 'complete_planning', weekStart }, { onSettled: refetchReadinessAfter })
  }

  function handleStart() {
    cycleAction.mutate({ action: 'start', weekStart }, { onSettled: refetchReadinessAfter })
  }

  const previousPeriodStart = previousWeekly.data?.previousPeriodStart ?? null

  function handleFinalizePrevious() {
    if (!previousPeriodStart) return
    cycleAction.mutate(
      { action: 'finalize', weekStart: previousPeriodStart },
      { onSettled: refetchReadinessAfter },
    )
  }

  function handleCancelPlanning() {
    cycleAction.mutate({ action: 'cancel_planning_target', weekStart }, { onSettled: refetchReadinessAfter })
  }

  function handleNavigateToSource(sourceId: WeeklyRitualSourceId) {
    setActiveSourceId(sourceId)
    setView('pending')
  }

  // "Selecionar um dia escolhe destino para a decisão CORRENTE" (AC6): a
  // densidade é um segundo caminho para o MESMO destino. Com o seletor ABERTO o
  // rail está `aria-hidden` atrás do backdrop, então este clique só chega com o
  // seletor FECHADO: ele arma o dia, que o seletor adota (`armedDate`) na próxima
  // abertura — a um clique da confirmação nomeada, em vez de virar código morto.
  function handleSelectDayFromDensity(scheduledDate: string | null) {
    if (destinationPickerItemId) {
      handleConfirmDestination(scheduledDate)
      return
    }
    setDayFromDensityRail(scheduledDate)
  }

  // Rótulo NOMEADO do ato, nunca um "Confirmar" genérico.
  function confirmLabelForDestination({ scheduledDate }: DestinationSelection): string {
    if (!scheduledDate) return 'Migrar sem dia definido'
    return `Migrar para ${formatDayLabel(scheduledDate, 'weekday').toLowerCase()}, ${formatDayLabel(scheduledDate, 'day-month')}`
  }

  const weeklyDensityByDate = new Map(
    (weeklyDensity.data?.days ?? []).map((day) => [day.date, day.total]),
  )

  const progressSources: WeeklyProgressSourceInput[] = PROGRESS_SOURCE_IDS.map((sourceId) => ({
    sourceId,
    eligibleNow: itemsBySource[sourceId].length,
    pendingNow: itemsBySource[sourceId].filter((item) => item.decision === null).length,
  }))

  const hasAnyDecision =
    (monthlyInWeek.data?.items.some((item) => item.decision !== null) ?? false) ||
    (recurring.data?.items.some((item) => item.decision !== null) ?? false)
  const hasAnyTaskInTarget = targetWeekLog.data
    ? targetWeekLog.data.days.some((day) => day.tasks.length > 0) || targetWeekLog.data.unscheduled.length > 0
    : false
  const canCancelPlanning = !hasAnyDecision && !hasAnyTaskInTarget

  return (
    <Box
      component="main"
      aria-label="Planejar a semana"
      sx={{
        display: 'grid',
        gridTemplateColumns: 'var(--ds-weekly-planning-source-rail) minmax(0, 1fr) var(--ds-weekly-planning-context-rail)',
        gap: 'var(--ds-space-4)',
        alignItems: 'start',
      }}
    >
      {!isOnline && (
        <Box
          role="status"
          sx={{
            gridColumn: '1 / -1',
            ...typography.body,
            color: 'var(--ds-danger)',
            backgroundColor: 'var(--ds-danger-soft)',
            padding: 'var(--ds-space-2)',
            borderRadius: 'var(--ds-radius-sm)',
          }}
        >
          Sem conexão. As ações de planejamento exigem rede. Decisões indisponíveis.
        </Box>
      )}

      <WeeklySourceRail entries={railEntries} activeSourceId={activeSourceId} onSelect={setActiveSourceId} />

      <WeeklyDecisionList
        sourceId={activeSourceId}
        weekStart={weekStart}
        items={activeAllItems}
        alreadyPlacedItems={
          activeSourceId === 'recurring' && recurring.data
            ? normalizeTemplateItems(recurring.data.alreadyPlaced.items)
            : undefined
        }
        view={view}
        onViewChange={setView}
        loading={loadingBySource[activeSourceId]}
        error={errorBySource[activeSourceId]}
        offline={!isOnline}
        onRetry={() => retry(activeSourceId)}
        itemErrors={itemErrors}
        onRetryItem={handleRetryItem}
        onKeep={handleKeep}
        onSkipWeek={handleSkipWeek}
        onAllocate={handleAllocate}
        onComplete={handleComplete}
        onCancel={handleCancel}
        onMigrateNamedDay={handleMigrateNamedDay}
        onChooseDestination={handleOpenDestinationPicker}
      />

      <Box component="aside" aria-label="Contexto do planejamento" sx={{ position: 'sticky', top: 0 }}>
        <WeeklyContextRail
          weekStart={weekStart}
          readiness={readiness.data ?? { active: null, planning: null, start: null, finalize: null }}
          progressSources={progressSources}
          previousWeeklyPendingCount={progressSources.find((s) => s.sourceId === 'previous-weekly')?.pendingNow ?? 0}
          previousPeriodStart={previousPeriodStart}
          onNavigateToSource={handleNavigateToSource}
          onSelectDay={handleSelectDayFromDensity}
          onCompletePlanning={handleCompletePlanning}
          onStart={handleStart}
          onFinalizePrevious={handleFinalizePrevious}
          onCancelPlanning={handleCancelPlanning}
          canCancelPlanning={canCancelPlanning}
          planningCompletedAt={readiness.data?.planning?.planningCompletedAt ?? null}
        />
      </Box>

      {/* A semana-alvo vem de `readiness`, fixa. "Sem dia definido" fica
          INDISPONÍVEL com motivo quando o alvo não é a semana corrente: migrar
          `destination: 'week'` sem `scheduledDate` cairia na semana CORRENTE no
          servidor, nunca na alvo (lacuna B7 da Story 14.5 — regra de domínio
          preservada na íntegra). `disabled` cobre offline E mutação em curso:
          sem a segunda metade, dois cliques rápidos em confirmar viram dois POST
          de migração da MESMA tarefa. */}
      {destinationPickerItemId && (
        <DestinationDialog
          title="Escolher destino"
          description={`Semana de ${formatDayLabel(weekStart, 'day-month')} a ${formatDayLabel(addDaysIso(weekStart, 6), 'day-month')}`}
          offer={{
            id: 'target-week',
            day: { kind: 'week', weekStart, densityByDate: weeklyDensityByDate },
            undated: isCurrentWeek
              ? {}
              : { unavailableReason: 'a semana-alvo não é a semana corrente' },
          }}
          armedDate={dayFromDensityRail}
          compact={isCompact}
          disabled={!isOnline || migrateTask.isPending}
          error={destinationError}
          confirmLabelFor={confirmLabelForDestination}
          onConfirm={handleConfirmDestination}
          onClose={handleCloseDestinationPicker}
        />
      )}
    </Box>
  )
}
