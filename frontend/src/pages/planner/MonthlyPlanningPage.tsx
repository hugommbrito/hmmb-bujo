// ─────────────────────────────────────────────────────────────────────────────
// Ritual de planejamento mensal (Story 14.6, AC5) — três regiões: rail de
// fontes (nav), lista de decisões (centro), rail de contexto (aside, sticky).
// Molde direto da `WeeklyPlanningPage` (14.5), com as divergências do M07:
//
//   ▶ O alvo do ritual vem SEMPRE de `readiness.planning.monthFirst` — nunca
//     da URL.
//   ▶ `destination: 'month'` vs `'future'` (Dev Notes → `TaskMigrateSerializer`):
//     o servidor resolve `'month'` sempre para `today_for(user)` — então só é
//     seguro usar `'month'` quando o mês-alvo COINCIDE com o mês corrente.
//     Caso contrário, `'future'` com `monthFirst` explícito. `destinationForTarget()`
//     decide isso uma única vez. ACHADO DE REVISÃO: em meses pulados (AC3), o
//     alvo pode ficar ANTES do mês corrente — `'future'` rejeita `monthFirst`
//     não estritamente posterior (`views.py:748-755`), e não há combinação que
//     migre para o próprio alvo já passado. `monthWouldBeRejectedAsFuture()`
//     guarda os 3 fluxos afetados (migrar dia nomeado, confirmar destino,
//     adiar ao Future Log) com um erro local explicativo em vez de um 400 sem
//     contexto. Sem fix de contrato nesta story (ver Dev Notes → Questão 5).
//   ▶ "Alocar" (recorrentes) abre o MESMO seletor de destino mensal — unifica
//     as duas opções do mockup ("Escolher dia"/"Alocar sem dia") num único
//     fluxo, já que `place/` aceita `scheduledDate` opcional.
//   ▶ "Adiar ao Future Log" é um clique único e determinístico: sempre o mês
//     imediatamente seguinte ao alvo (mesmo padrão de "sempre o próximo",
//     usado em toda a story para evitar escolha/retargeting).
//   ▶ Sem `cancel_planning_target` — AC3: não existe "Cancelar planejamento"
//     em nenhuma tela do Monthly.
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Box, useMediaQuery } from '@mui/material'

import {
  invalidateRitualQueries,
  useMigrateTaskMutation,
  useMonthlyCycleActionMutation,
  useMonthlyCycleReadinessQuery,
  useMonthlyDensityQuery,
  useMonthlyFutureLogSourceQuery,
  useMonthlyLogQuery,
  useMonthlyRecurringSourceQuery,
  usePlaceRecurringTemplateMutation,
  usePreviousMonthlySourceQuery,
  useRitualDecisionMutation,
  useRitualTaskTransitionMutation,
} from '../../features/bujo'
import { PlannerSkeleton } from '../../features/bujo/components/PlannerSkeleton'
import { MonthlySourceRail, type MonthlySourceRailEntry } from '../../features/bujo/components/monthly/MonthlySourceRail'
import { MonthlyDecisionList } from '../../features/bujo/components/monthly/MonthlyDecisionList'
import {
  DestinationDialog,
  type DestinationSelection,
} from '../../features/bujo/components/DestinationDialog'
import { MonthlyContextRail, type MonthlyProgressSourceInput } from '../../features/bujo/components/monthly/MonthlyContextRail'
import {
  normalizeAlreadyPlacedBuckets,
  normalizeSource,
  MONTHLY_RITUAL_SOURCE_ORDER,
  type MonthlyRitualSourceId,
  type NormalizedRitualItem,
} from '../../features/bujo/components/monthly/monthlyRitualSources'
import { capitalize, MONTH_NAMES_PT } from '../../features/bujo/monthNames'
import { mediaQueries, typography } from '../../shared/design/tokens'
import { useOnlineStatus } from '../../shared/hooks/useOnlineStatus'

function addMonthsIso(monthFirstIso: string, delta: number): string {
  const [year, month] = monthFirstIso.split('-').map(Number)
  const date = new Date(year, month - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

function formatMonthTitle(monthFirst: string): string {
  const [year, month] = monthFirst.split('-').map(Number)
  return `${capitalize(MONTH_NAMES_PT[month - 1])} de ${year}`
}

type DestinationTarget = { kind: 'template' | 'task'; id: string }

export function MonthlyPlanningPage() {
  const queryClient = useQueryClient()
  const [activeSourceId, setActiveSourceId] = useState<MonthlyRitualSourceId>('recurring')
  const [view, setView] = useState<'pending' | 'all'>('pending')
  const [mutatedThisVisit, setMutatedThisVisit] = useState<Record<string, NormalizedRitualItem[]>>({})
  const [destinationTarget, setDestinationTarget] = useState<DestinationTarget | null>(null)
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({})
  const retryActionsRef = useRef<Record<string, () => void>>({})
  const [destinationError, setDestinationError] = useState<string | null>(null)
  // Story 14.6 AC6 — dia escolhido no rail de densidade. O rail fica `aria-hidden`
  // atrás do backdrop enquanto o seletor está aberto, então o clique acontece
  // ANTES: guardamos o dia e o seletor abre com ele JÁ ARMADO, a um clique da
  // confirmação nomeada. É o que mantém o caminho do rail vivo e alcançável.
  const [dayFromDensityRail, setDayFromDensityRail] = useState<string | null | undefined>(undefined)
  const isCompact = useMediaQuery(mediaQueries.compact)
  // Mesmo colapso do ritual semanal (DW-16) e de `MigrationRitualPage.tsx`:
  // abaixo de `desktop` as 3 colunas não cabem, a do meio é esmagada a zero e
  // os botões da lista de decisão vazam POR CIMA do rail de contexto
  // (`target-size` "partially obscured" no axe). Os tokens de rail seguem
  // intactos — só param de valer abaixo de `desktop`.
  const isNarrowLayout = !useMediaQuery(mediaQueries.desktop)
  const isOnline = useOnlineStatus()

  const readiness = useMonthlyCycleReadinessQuery()
  const targetMonthFirst = readiness.data?.planning?.monthFirst
  const hasTarget = Boolean(targetMonthFirst)
  // Autoridade de "mês corrente" (Convenção #8): a query sem parâmetro resolve
  // via `today_for(user)` no servidor — usada só para decidir `'month'` vs
  // `'future'` no destino (Dev Notes → edge case real do `TaskMigrateSerializer`).
  const currentMonthLog = useMonthlyLogQuery()

  const recurring = useMonthlyRecurringSourceQuery(targetMonthFirst ?? '', { enabled: hasTarget })
  const futureLog = useMonthlyFutureLogSourceQuery(targetMonthFirst ?? '', { enabled: hasTarget })
  const previousMonthly = usePreviousMonthlySourceQuery(targetMonthFirst ?? '', { enabled: hasTarget })
  // Densidade real do mês-alvo — a MESMA chave que o rail de contexto consulta
  // (dedup automático do TanStack Query, zero rede extra). O seletor de destino
  // recebe o mapa PRONTO daqui: se ele fizesse a sua própria query
  // (`/task-density/`, endpoint diferente do `/rituals/monthly/density/` do
  // rail), os dois calendários do mesmo mês poderiam mostrar contagens
  // divergentes na mesma tela — achado de review.
  const monthlyDensity = useMonthlyDensityQuery(targetMonthFirst ?? '', { enabled: hasTarget })

  const transitionTask = useRitualTaskTransitionMutation()
  const migrateTask = useMigrateTaskMutation()
  const placeTemplate = usePlaceRecurringTemplateMutation()
  const ritualDecision = useRitualDecisionMutation()
  const cycleAction = useMonthlyCycleActionMutation()

  if (readiness.isPending) {
    return (
      <Box component="main" aria-label="Planejar o mês" sx={{ p: 'var(--ds-space-4)' }}>
        <PlannerSkeleton />
      </Box>
    )
  }

  if (!targetMonthFirst) {
    return (
      <Box component="main" aria-label="Planejar o mês" sx={{ p: 'var(--ds-space-4)' }}>
        Nenhum mês em planejamento no momento.
      </Box>
    )
  }

  const mainLabel = `Planejar ${formatMonthTitle(targetMonthFirst)}`

  function destinationForTarget(): 'month' | 'future' {
    return targetMonthFirst === currentMonthLog.data?.monthFirst ? 'month' : 'future'
  }

  const itemsBySource: Record<MonthlyRitualSourceId, NormalizedRitualItem[]> = {
    recurring: normalizeSource('recurring', recurring.data),
    'future-log': normalizeSource('future-log', futureLog.data),
    'previous-monthly': normalizeSource('previous-monthly', previousMonthly.data),
  }
  const alreadyPlacedBuckets = normalizeAlreadyPlacedBuckets(recurring.data)

  const loadingBySource: Record<MonthlyRitualSourceId, boolean> = {
    recurring: recurring.isPending,
    'future-log': futureLog.isPending,
    'previous-monthly': previousMonthly.isPending,
  }

  const errorBySource: Record<MonthlyRitualSourceId, boolean> = {
    recurring: recurring.isError,
    'future-log': futureLog.isError,
    'previous-monthly': previousMonthly.isError,
  }

  const railEntries: MonthlySourceRailEntry[] = MONTHLY_RITUAL_SOURCE_ORDER.map((sourceId) => {
    const pendingCount = itemsBySource[sourceId].filter((item) => item.decision === null).length
    let subtitle: string | undefined
    if (sourceId === 'recurring') {
      subtitle = `${itemsBySource[sourceId].length} ativos · ${pendingCount} não avaliados`
    } else if (sourceId === 'previous-monthly') {
      subtitle = 'Bloqueia iniciar mês'
    }
    return { sourceId, pendingCount, subtitle, isLoading: loadingBySource[sourceId], isError: errorBySource[sourceId] }
  })

  function retry(sourceId: MonthlyRitualSourceId) {
    if (sourceId === 'recurring') recurring.refetch()
    if (sourceId === 'future-log') futureLog.refetch()
    if (sourceId === 'previous-monthly') previousMonthly.refetch()
  }

  function recordMutation(sourceId: MonthlyRitualSourceId, itemId: string, decision: string) {
    const item = itemsBySource[sourceId].find((candidate) => candidate.id === itemId)
    if (!item) return
    setMutatedThisVisit((prev) => ({ ...prev, [sourceId]: [...(prev[sourceId] ?? []), { ...item, decision }] }))
  }

  function setItemError(itemId: string, message = 'Não foi possível salvar a decisão. Tente novamente.') {
    setItemErrors((prev) => ({ ...prev, [itemId]: message }))
  }

  // Achado de revisão (AC3/AC5): `next_monthly_target` (backend) não tem piso —
  // em meses pulados, o alvo do ritual pode ficar ESTRITAMENTE ANTES do mês
  // corrente real (prova: `test_ciclo_monthly_dois_meses_pulados_exigem_materializacao_sequencial`,
  // `test_services.py`). `TaskMigrateView` só aceita `destination: 'future'` com
  // `monthFirst` ESTRITAMENTE POSTERIOR ao corrente (`views.py:748-755`) e
  // `destination: 'month'` sempre resolve para o corrente no servidor, nunca
  // para o alvo — não existe combinação que migre/adie uma tarefa PARA o
  // próprio mês-alvo quando ele já é passado em relação a hoje. `Alocar`
  // (`place/`) não tem essa restrição (`RecurringTaskTemplatePlaceSerializer`),
  // por isso só os 3 fluxos que passam por `migrateTask` precisam do guard
  // abaixo. Sem solução no escopo desta story (mudaria o contrato do endpoint
  // de migração, pré-existente) — registrado como Questão aberta nº5 no Dev
  // Notes para decisão de produto futura.
  function monthWouldBeRejectedAsFuture(monthFirst: string): boolean {
    const currentMonthFirst = currentMonthLog.data?.monthFirst
    return Boolean(currentMonthFirst && monthFirst <= currentMonthFirst)
  }

  const STALE_TARGET_MIGRATE_ERROR =
    'Este mês já é anterior ao mês atual — migrar ou adiar para um dia específico dele ainda não é suportado. Use Concluir/Cancelar, ou regularize o ciclo para prosseguir.'

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

  function handleAllocate(templateId: string) {
    setDestinationError(null)
    setDestinationTarget({ kind: 'template', id: templateId })
  }

  function handleDeferToFutureLog(id: string) {
    const deferredMonthFirst = addMonthsIso(targetMonthFirst, 1)
    const run = () => {
      clearItemError(id)
      if (activeSourceId === 'recurring') {
        placeTemplate.mutate(
          { templateId: id, monthFirst: deferredMonthFirst },
          {
            onSuccess: () => {
              recordMutation(activeSourceId, id, 'deferred')
              invalidateRitualQueries(queryClient)
            },
            onError: () => setItemError(id),
          },
        )
      } else if (monthWouldBeRejectedAsFuture(deferredMonthFirst)) {
        setItemError(id, STALE_TARGET_MIGRATE_ERROR)
      } else {
        migrateTask.mutate(
          { taskId: id, destination: 'future', monthFirst: deferredMonthFirst },
          {
            onSuccess: () => {
              recordMutation(activeSourceId, id, 'deferred')
              invalidateRitualQueries(queryClient)
            },
            onError: () => setItemError(id),
          },
        )
      }
    }
    retryActionsRef.current[id] = run
    run()
  }

  function handleKeepUndated(taskId: string) {
    const run = () => {
      clearItemError(taskId)
      ritualDecision.mutate(
        { decision: 'keep_undated', monthFirst: targetMonthFirst, taskId },
        { onError: () => setItemError(taskId) },
      )
    }
    retryActionsRef.current[taskId] = run
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
    const destination = destinationForTarget()
    if (destination === 'future' && monthWouldBeRejectedAsFuture(targetMonthFirst)) {
      setItemError(taskId, STALE_TARGET_MIGRATE_ERROR)
      return
    }
    const run = () => {
      clearItemError(taskId)
      migrateTask.mutate(
        { taskId, destination, scheduledDate: destinationDate, ...(destination === 'future' ? { monthFirst: targetMonthFirst } : {}) },
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
    setDestinationTarget({ kind: 'task', id: itemId })
  }

  function handleCloseDestinationPicker() {
    setDestinationTarget(null)
    setDestinationError(null)
    setDayFromDensityRail(undefined)
  }

  function handleConfirmDestination(scheduledDate: string | null) {
    if (!destinationTarget) return
    const { kind, id } = destinationTarget
    setDestinationError(null)
    if (kind === 'template') {
      placeTemplate.mutate(
        { templateId: id, monthFirst: targetMonthFirst, scheduledDate },
        {
          onSuccess: () => {
            recordMutation('recurring', id, 'allocated')
            invalidateRitualQueries(queryClient)
            handleCloseDestinationPicker()
          },
          onError: () => setDestinationError('Não foi possível alocar o template. Tente novamente.'),
        },
      )
      return
    }
    const destination = destinationForTarget()
    if (destination === 'future' && monthWouldBeRejectedAsFuture(targetMonthFirst)) {
      setDestinationError(STALE_TARGET_MIGRATE_ERROR)
      return
    }
    migrateTask.mutate(
      { taskId: id, destination, scheduledDate, ...(destination === 'future' ? { monthFirst: targetMonthFirst } : {}) },
      {
        onSuccess: () => {
          recordMutation(activeSourceId, id, 'migrated')
          invalidateRitualQueries(queryClient)
          handleCloseDestinationPicker()
        },
        onError: () => setDestinationError('Não foi possível migrar a tarefa. Tente novamente.'),
      },
    )
  }

  const activeItems = itemsBySource[activeSourceId].filter((item) =>
    view === 'pending' ? item.decision === null : item.decision !== null,
  )
  const activeAllItems = view === 'all' ? [...activeItems, ...(mutatedThisVisit[activeSourceId] ?? [])] : activeItems

  function refetchReadinessAfter() {
    readiness.refetch()
  }

  function handleCompletePlanning() {
    cycleAction.mutate({ action: 'complete_planning', monthFirst: targetMonthFirst }, { onSettled: refetchReadinessAfter })
  }

  function handleStart() {
    cycleAction.mutate({ action: 'start', monthFirst: targetMonthFirst }, { onSettled: refetchReadinessAfter })
  }

  const previousPeriodStart = previousMonthly.data?.previousPeriodStart ?? null

  function handleFinalizePrevious() {
    if (!previousPeriodStart) return
    cycleAction.mutate({ action: 'finalize', monthFirst: previousPeriodStart }, { onSettled: refetchReadinessAfter })
  }

  function handleNavigateToSource(sourceId: MonthlyRitualSourceId) {
    setActiveSourceId(sourceId)
    setView('pending')
  }

  // Story 14.6 AC6 — "selecionar um dia escolhe destino para a decisão corrente".
  // Com o seletor ABERTO o rail está `aria-hidden` atrás do backdrop, então este
  // clique só chega com o seletor FECHADO: ele arma o dia, que o seletor adota
  // (`armedDate`) na próxima abertura — o rail continua sendo o segundo caminho
  // para o MESMO destino, a um clique da confirmação nomeada, em vez de virar
  // código morto.
  function handleSelectDayFromDensity(scheduledDate: string | null) {
    if (destinationTarget) {
      handleConfirmDestination(scheduledDate)
      return
    }
    setDayFromDensityRail(scheduledDate)
  }

  // Rótulo NOMEADO do ato, nunca um "Confirmar" genérico: o MESMO seletor serve
  // "Alocar" (recorrentes → `place/`) e "Escolher destino…" (tasks →
  // `migrate/`), e o verbo tem de dizer qual dos dois está sendo confirmado.
  function confirmLabelForDestination({ scheduledDate }: DestinationSelection): string {
    const isTemplate = destinationTarget?.kind === 'template'
    if (!scheduledDate) {
      const monthLabel = formatMonthTitle(targetMonthFirst).toLowerCase()
      return isTemplate
        ? `Alocar sem dia definido em ${monthLabel}`
        : `Migrar sem dia definido para ${monthLabel}`
    }
    const day = Number(scheduledDate.slice(8, 10))
    const monthName = MONTH_NAMES_PT[Number(scheduledDate.slice(5, 7)) - 1]
    return isTemplate ? `Alocar em ${day} de ${monthName}` : `Migrar para ${day} de ${monthName}`
  }

  const monthlyDensityByDate = new Map(
    (monthlyDensity.data?.days ?? []).map((day) => [day.date, day.total]),
  )
  // Guard de escrita EM CURSO, além do offline: gate na mutação que este alvo vai
  // realmente disparar, não numa qualquer da página.
  const destinationMutationPending =
    destinationTarget?.kind === 'template' ? placeTemplate.isPending : migrateTask.isPending

  const progressSources: MonthlyProgressSourceInput[] = MONTHLY_RITUAL_SOURCE_ORDER.map((sourceId) => ({
    sourceId,
    eligibleNow: itemsBySource[sourceId].length,
    pendingNow: itemsBySource[sourceId].filter((item) => item.decision === null).length,
  }))

  return (
    <Box
      component="main"
      aria-label={mainLabel}
      sx={{
        display: 'grid',
        gridTemplateColumns: isNarrowLayout
          ? '1fr'
          : 'var(--ds-monthly-planning-source-rail) minmax(0, 1fr) var(--ds-monthly-planning-context-rail)',
        gap: 'var(--ds-space-4)',
        alignItems: 'start',
      }}
    >
      {!isOnline && (
        <Box
          role="status"
          sx={{ gridColumn: '1 / -1', ...typography.body, color: 'var(--ds-danger)', backgroundColor: 'var(--ds-danger-soft)', padding: 'var(--ds-space-2)', borderRadius: 'var(--ds-radius-sm)' }}
        >
          Sem conexão. As ações de planejamento exigem rede. Decisões indisponíveis.
        </Box>
      )}

      <MonthlySourceRail entries={railEntries} activeSourceId={activeSourceId} onSelect={setActiveSourceId} />

      <MonthlyDecisionList
        sourceId={activeSourceId}
        targetMonthFirst={targetMonthFirst}
        items={activeAllItems}
        alreadyPlacedItems={activeSourceId === 'recurring' ? alreadyPlacedBuckets.alreadyPlaced : undefined}
        alreadyPlacedInYearItems={activeSourceId === 'recurring' ? alreadyPlacedBuckets.alreadyPlacedInYear : undefined}
        view={view}
        onViewChange={setView}
        loading={loadingBySource[activeSourceId]}
        error={errorBySource[activeSourceId]}
        offline={!isOnline}
        onRetry={() => retry(activeSourceId)}
        itemErrors={itemErrors}
        onRetryItem={handleRetryItem}
        onAllocate={handleAllocate}
        onDeferToFutureLog={handleDeferToFutureLog}
        onKeepUndated={handleKeepUndated}
        onComplete={handleComplete}
        onCancel={handleCancel}
        onMigrateNamedDay={handleMigrateNamedDay}
        onChooseDestination={handleOpenDestinationPicker}
      />

      <Box component="aside" aria-label="Contexto do planejamento" sx={{ position: 'sticky', top: 0 }}>
        <MonthlyContextRail
          targetMonthFirst={targetMonthFirst}
          readiness={readiness.data ?? { active: null, planning: null, start: null, finalize: null }}
          progressSources={progressSources}
          previousMonthlyPendingCount={progressSources.find((s) => s.sourceId === 'previous-monthly')?.pendingNow ?? 0}
          previousPeriodStart={previousPeriodStart}
          onNavigateToSource={handleNavigateToSource}
          onSelectDay={handleSelectDayFromDensity}
          onCompletePlanning={handleCompletePlanning}
          onStart={handleStart}
          onFinalizePrevious={handleFinalizePrevious}
          planningCompletedAt={readiness.data?.planning?.planningCompletedAt ?? null}
        />
      </Box>

      {/* O mês-alvo do ritual vem de `readiness`, fixo. O `Dialog` portalizado do
          `DestinationDialog` é o que faz o seletor aparecer sobreposto e visível
          sem rolagem no desktop. `disabled` cobre offline E mutação em curso:
          sem a segunda metade, dois cliques rápidos em confirmar viram dois POST
          (duas instâncias do mesmo recorrente, no caso do "Alocar"). */}
      {destinationTarget && (
        <DestinationDialog
          title="Escolher destino"
          description={formatMonthTitle(targetMonthFirst)}
          offer={{
            id: 'target-month',
            day: { kind: 'month', monthFirst: targetMonthFirst, densityByDate: monthlyDensityByDate },
            undated: {},
          }}
          armedDate={dayFromDensityRail}
          compact={isCompact}
          disabled={!isOnline || destinationMutationPending}
          error={destinationError}
          confirmLabelFor={confirmLabelForDestination}
          onConfirm={handleConfirmDestination}
          onClose={handleCloseDestinationPicker}
        />
      )}
    </Box>
  )
}
