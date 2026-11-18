// ─────────────────────────────────────────────────────────────────────────────
// Ritual de planejamento mensal (Story 14.6, AC5) — três regiões: rail de
// fontes (nav), lista de decisões (centro), rail de contexto (aside, sticky).
// Molde direto da `WeeklyPlanningPage` (14.5), com as divergências do M07:
//
//   ▶ O alvo do ritual vem SEMPRE de `readiness.planning.monthFirst` — nunca
//     da URL.
//   ▶ Destino de migração (Story 14.11): UM adaptador, `migrateFieldsForMonth`
//     (`monthlyRitualSources.ts`) — `> corrente` ⇒ `'future'`; senão `'month'`
//     + `monthFirst` explícito, que o servidor aceita na faixa `[alvo de
//     planejamento, corrente]`. Substitui o guard local
//     `monthWouldBeRejectedAsFuture()` da 14.6 (Questão aberta nº 5): em meses
//     pulados o alvo pode ser ANTERIOR ao mês corrente, e agora migrar/adiar
//     alcança o próprio alvo em vez de parar num erro local.
//   ▶ Regularização atrasada (Story 14.11): quando o alvo é anterior ao mês
//     corrente, a faixa `MonthlyCatchUpBanner` nomeia o alvo, conta os meses
//     que faltam e marca o "Próximo passo" (verdade do servidor, via readiness).
//   ▶ Todo POST de ciclo rejeitado (409 de gate, `{detail, code}`) aparece em
//     `role="alert"` com o `detail` do servidor (`domainErrorMessage`); fora do
//     409 vale um fallback genérico. Nenhum botão fica mudo.
//   ▶ "Alocar" (recorrentes) abre o MESMO seletor de destino mensal — unifica
//     as duas opções do mockup ("Escolher dia"/"Alocar sem dia") num único
//     fluxo, já que `place/` aceita `scheduledDate` opcional.
//   ▶ "Adiar ao Future Log" é um clique único e determinístico: sempre o mês
//     imediatamente seguinte ao alvo (mesmo padrão de "sempre o próximo",
//     usado em toda a story para evitar escolha/retargeting). Durante a
//     regularização atrasada esse mês pode ser ≤ corrente — o adaptador então
//     manda `'month'` + `monthFirst`, e o servidor aceita.
//   ▶ Sem `cancel_planning_target` — AC3: não existe "Cancelar planejamento"
//     em nenhuma tela do Monthly.
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Box, Button, useMediaQuery } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

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
import type { MonthlyCycleAction } from '../../features/bujo'
import { domainErrorMessage } from '../../api/errors'
import { PlannerSkeleton } from '../../features/bujo/components/PlannerSkeleton'
import { MonthlySourceRail, type MonthlySourceRailEntry } from '../../features/bujo/components/monthly/MonthlySourceRail'
import { MonthlyDecisionList } from '../../features/bujo/components/monthly/MonthlyDecisionList'
import { MonthlyCatchUpBanner } from '../../features/bujo/components/monthly/MonthlyCatchUpBanner'
import {
  DestinationDialog,
  type DestinationSelection,
} from '../../features/bujo/components/DestinationDialog'
import { MonthlyContextRail, type MonthlyProgressSourceInput } from '../../features/bujo/components/monthly/MonthlyContextRail'
import {
  migrateFieldsForMonth,
  normalizeAlreadyPlacedBuckets,
  normalizeSource,
  MONTHLY_RITUAL_SOURCE_ORDER,
  type MonthlyRitualSourceId,
  type NormalizedRitualItem,
} from '../../features/bujo/components/monthly/monthlyRitualSources'
import { formatMonthTitle, MONTH_NAMES_PT } from '../../features/bujo/monthNames'
import { mediaQueries, typography } from '../../shared/design/tokens'
import { addMonthsIso } from '../../shared/date'
import { useOnlineStatus } from '../../shared/hooks/useOnlineStatus'

type DestinationTarget = { kind: 'template' | 'task'; id: string }

const CYCLE_ERROR_FALLBACK: Record<MonthlyCycleAction['action'], string> = {
  open_planning_target: 'Não foi possível abrir o planejamento. Tente novamente.',
  complete_planning: 'Não foi possível concluir o planejamento. Tente novamente.',
  start: 'Não foi possível iniciar o mês. Tente novamente.',
  finalize: 'Não foi possível finalizar o mês anterior. Tente novamente.',
}

const CURRENT_MONTH_UNKNOWN_ERROR =
  'O mês corrente ainda não carregou — tente novamente em instantes.'
const CURRENT_MONTH_FAILED_ERROR = 'Não foi possível carregar o mês corrente — tente novamente.'

export function MonthlyPlanningPage() {
  const queryClient = useQueryClient()
  const [activeSourceId, setActiveSourceId] = useState<MonthlyRitualSourceId>('recurring')
  const [view, setView] = useState<'pending' | 'all'>('pending')
  const [mutatedThisVisit, setMutatedThisVisit] = useState<Record<string, NormalizedRitualItem[]>>({})
  const [destinationTarget, setDestinationTarget] = useState<DestinationTarget | null>(null)
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({})
  const retryActionsRef = useRef<Record<string, () => void>>({})
  const [destinationError, setDestinationError] = useState<string | null>(null)
  // Story 14.11: motivo do último POST de ciclo rejeitado (409 → `detail` do
  // servidor; outro erro → fallback). Limpo no próximo sucesso.
  const [cycleError, setCycleError] = useState<string | null>(null)
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
  // via `today_for(user)` no servidor — usada pelo adaptador de destino
  // (`'month'` vs `'future'`) e pela faixa de regularização atrasada.
  const currentMonthLog = useMonthlyLogQuery()
  const currentMonthFirst = currentMonthLog.data?.monthFirst ?? null

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

  // Story 14.11 — matriz "readiness falha": sem prontidão não há alvo nem
  // gates; em vez de "nenhum mês em planejamento" (falso), motivo + retry.
  if (readiness.isError) {
    return (
      <Box component="main" aria-label="Planejar o mês" sx={{ p: 'var(--ds-space-4)' }}>
        <Box role="alert" sx={{ ...typography.body, color: 'var(--ds-danger)' }}>
          Não foi possível carregar a prontidão do ciclo mensal.{' '}
          <Button size="small" onClick={() => readiness.refetch()} sx={{ color: 'var(--ds-primary)' }}>
            Tentar novamente
          </Button>
        </Box>
      </Box>
    )
  }

  if (!targetMonthFirst) {
    return (
      <Box component="main" aria-label="Planejar o mês" sx={{ p: 'var(--ds-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-2)', alignItems: 'flex-start' }}>
        <Box sx={{ ...typography.body, color: 'var(--ds-ink)' }}>Nenhum mês em planejamento no momento.</Box>
        {/* Story 14.11: o alvo só nasce pelo board ("Planejar <mês>") — link, não beco. */}
        <Button component={RouterLink} to="/planner/month" sx={{ color: 'var(--ds-primary)' }}>
          Ir para Este Mês
        </Button>
      </Box>
    )
  }

  const mainLabel = `Planejar ${formatMonthTitle(targetMonthFirst)}`
  // Story 14.11: regularização atrasada — o alvo em `planning` é anterior ao
  // mês corrente (meses pulados materializados um a um, M07).
  const targetMonthIsPast = Boolean(currentMonthFirst && targetMonthFirst < currentMonthFirst)

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

  // O adaptador de destino precisa do mês corrente. Query ainda em voo ⇒ "ainda
  // não carregou" (o retry do item basta); query FALHADA ⇒ ninguém a refaria
  // sozinho, então refaz aqui e diz que falhou (Story 14.11, review).
  function currentMonthUnavailableMessage(): string {
    if (currentMonthLog.isError) {
      currentMonthLog.refetch()
      return CURRENT_MONTH_FAILED_ERROR
    }
    return CURRENT_MONTH_UNKNOWN_ERROR
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
      } else if (!currentMonthFirst) {
        setItemError(id, currentMonthUnavailableMessage())
      } else {
        migrateTask.mutate(
          { taskId: id, ...migrateFieldsForMonth(deferredMonthFirst, null, currentMonthFirst) },
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
    const run = () => {
      clearItemError(taskId)
      if (!currentMonthFirst) {
        setItemError(taskId, currentMonthUnavailableMessage())
        return
      }
      migrateTask.mutate(
        { taskId, ...migrateFieldsForMonth(targetMonthFirst, destinationDate, currentMonthFirst) },
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
    if (!currentMonthFirst) {
      setDestinationError(currentMonthUnavailableMessage())
      return
    }
    migrateTask.mutate(
      { taskId: id, ...migrateFieldsForMonth(targetMonthFirst, scheduledDate, currentMonthFirst) },
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

  // Story 14.11: TODA ação de ciclo passa por aqui — o 409 de gate vira texto
  // (`detail` do servidor) em `role="alert"`, qualquer outro erro vira o
  // fallback da ação; sucesso limpa o aviso. `onSettled` re-lê a prontidão.
  function runCycleAction(variables: MonthlyCycleAction) {
    cycleAction.mutate(variables, {
      onSuccess: () => setCycleError(null),
      onError: (error) => setCycleError(domainErrorMessage(error, CYCLE_ERROR_FALLBACK[variables.action])),
      onSettled: () => {
        readiness.refetch()
      },
    })
  }

  function handleCompletePlanning() {
    runCycleAction({ action: 'complete_planning', monthFirst: targetMonthFirst })
  }

  function handleStart() {
    runCycleAction({ action: 'start', monthFirst: targetMonthFirst })
  }

  const previousPeriodStart = previousMonthly.data?.previousPeriodStart ?? null
  // Alvo de Finalizar = o `active` da readiness (verdade do servidor); a chave
  // da fonte bloqueante é o fallback quando a readiness ainda não o trouxe.
  const finalizeTarget = readiness.data?.finalize?.target ?? previousPeriodStart

  function handleFinalizePrevious() {
    if (!finalizeTarget) return
    runCycleAction({ action: 'finalize', monthFirst: finalizeTarget })
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

  const readinessData = readiness.data ?? { active: null, planning: null, start: null, finalize: null }

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

      {targetMonthIsPast && currentMonthFirst && (
        <Box sx={{ gridColumn: '1 / -1' }}>
          <MonthlyCatchUpBanner
            targetMonthFirst={targetMonthFirst}
            currentMonthFirst={currentMonthFirst}
            readiness={readinessData}
            // A readiness já nomeia o anterior (`finalize.target`) antes de a
            // fonte bloqueante responder — a faixa nasce completa, sem o passo
            // "Finalizar" piscando depois.
            previousPeriodStart={finalizeTarget}
          />
        </Box>
      )}

      {cycleError && (
        <Box
          role="alert"
          sx={{ gridColumn: '1 / -1', ...typography.body, color: 'var(--ds-danger)', backgroundColor: 'var(--ds-danger-soft)', padding: 'var(--ds-space-2)', borderRadius: 'var(--ds-radius-sm)' }}
        >
          {cycleError}
        </Box>
      )}

      <MonthlySourceRail entries={railEntries} activeSourceId={activeSourceId} onSelect={setActiveSourceId} />

      <MonthlyDecisionList
        sourceId={activeSourceId}
        targetMonthFirst={targetMonthFirst}
        targetMonthIsPast={targetMonthIsPast}
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
          readiness={readinessData}
          progressSources={progressSources}
          previousMonthlyPendingCount={progressSources.find((s) => s.sourceId === 'previous-monthly')?.pendingNow ?? 0}
          previousMonthlyLoading={previousMonthly.isPending}
          previousMonthlyError={previousMonthly.isError}
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
