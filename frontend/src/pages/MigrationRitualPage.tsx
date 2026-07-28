// ─────────────────────────────────────────────────────────────────────────────
// Ritual de migração/catch-up (Story 14.9, M10) — página ROTEADA dentro do
// shell (`/migration`, `surfaceMigrated: true`), NUNCA `Dialog`/overlay
// full-screen (decisão fechada do mockup `key-migracao.html`, revisando o
// DESIGN.md que previa "tela cheia"). Reusa a anatomia rail-de-fontes/lista/
// rail-de-contexto do `WeeklyPlanningPage`/`MonthlyPlanningPage` (14.5/14.6):
// as "fontes" aqui são os NÍVEIS mês→semana→dia da fila unificada
// (`useUnifiedMigrationQueueQuery`, Story 14.3), único dado de leitura.
//
//   ▶ Única mutação para toda decisão: `useMigrateTaskMutation` (mesmo verbo
//     que `MigrationCard` legado já usa) — nunca `RitualDecision` (a mutação
//     em si é a persistência, docstring de `services/rituals.py`).
//   ▶ Duas contagens DISTINTAS (Design Notes da spec — não confundir):
//     1) `tally` (migradas/adiadas/canceladas) — `useState` local, incrementado
//        a cada sucesso de mutação; só existe enquanto a página está montada
//        (pausar = desmontar = tally se perde; o resumo final reflete só a
//        sessão que terminou).
//     2) `sessionStorage[MIGRATION_SESSION_TOTAL_KEY]` — o total `M` do banner
//        pausado (`MigrationRitualBanner`), capturado aqui no primeiro mount
//        (ou recapturado se a fila crescer além do `M` salvo), limpo quando a
//        fila zera.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { Box, Button, useMediaQuery } from '@mui/material'

import {
  useMigrateTaskMutation,
  useMonthlyLogQuery,
  useTodayLogQuery,
  useUnifiedMigrationQueueQuery,
  useWeeklyLogQuery,
  type MigrationDestination,
} from '../features/bujo'
import { PlannerSkeleton } from '../features/bujo/components/PlannerSkeleton'
import { DestinationPicker, type DestinationConfirmMeta } from '../features/bujo/components/DestinationPicker'
import { MigrationSourceRail } from '../features/bujo/components/migration/MigrationSourceRail'
import { MigrationDecisionList } from '../features/bujo/components/migration/MigrationDecisionList'
import { MigrationContextRail, type MigrationTally } from '../features/bujo/components/migration/MigrationContextRail'
import { MigrationSummary } from '../features/bujo/components/migration/MigrationSummary'
import {
  itemsBySource,
  MIGRATION_SESSION_TOTAL_KEY,
  MIGRATION_SOURCE_ORDER,
  normalizeQueueItem,
  type MigrationSourceId,
  type NormalizedMigrationItem,
} from '../features/bujo/components/migration/migrationRitualSources'
import { addMonthsIso, formatDayLabel } from '../shared/date'
import { MONTH_NAMES_PT } from '../features/bujo/monthNames'
import { mediaQueries, typography } from '../shared/design/tokens'
import { useOnlineStatus } from '../shared/hooks/useOnlineStatus'

const FUTURE_MONTHS_OFFERED = 12
const EMPTY_TALLY: MigrationTally = { migrated: 0, postponed: 0, cancelled: 0 }

function bucketFor(destination: MigrationDestination): keyof MigrationTally {
  if (destination === 'cancel') return 'cancelled'
  if (destination === 'today' || destination === 'week') return 'migrated'
  return 'postponed'
}

export function MigrationRitualPage() {
  const navigate = useNavigate()
  const isOnline = useOnlineStatus()
  const isCompact = useMediaQuery(mediaQueries.compact)
  // Abaixo de "desktop" (<1024px, cobre tablet 768-1023 E compact ≤767), os
  // 2 rails em largura FIXA (`--ds-weekly-planning-source-rail`/`context-rail`,
  // 190px+315px, mesmo molde do Weekly) somados ao conteúdo do shell espremem
  // a coluna central a poucos px — achado real do e2e em review: 3 ações lado
  // a lado ficam sem espaço de toque (WCAG 2.5.8/target-size). Empilhar em
  // coluna única sob esse ponto é um ajuste LOCAL desta página (não toca os
  // tokens compartilhados, então Weekly/Monthly não regridem).
  const isNarrowLayout = !useMediaQuery(mediaQueries.desktop)

  const [activeSourceId, setActiveSourceId] = useState<MigrationSourceId>('month')
  const [view, setView] = useState<'pending' | 'all'>('pending')
  const [mutatedThisVisit, setMutatedThisVisit] = useState<Record<MigrationSourceId, NormalizedMigrationItem[]>>({
    month: [],
    week: [],
    day: [],
  })
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({})
  const retryActionsRef = useRef<Record<string, () => void>>({})
  const [destinationItemId, setDestinationItemId] = useState<string | null>(null)
  const [pickerMonthFirst, setPickerMonthFirst] = useState<string | null>(null)
  const [destinationError, setDestinationError] = useState<string | null>(null)
  const [tally, setTally] = useState<MigrationTally>(EMPTY_TALLY)

  const queue = useUnifiedMigrationQueueQuery()
  const migrateTask = useMigrateTaskMutation()
  const todayLog = useTodayLogQuery()
  const currentWeekLog = useWeeklyLogQuery()
  const currentMonthLog = useMonthlyLogQuery()

  // sessionStorage[M] — Design Notes item 2: capturado no primeiro mount (ou
  // recapturado se a fila JÁ excede o M salvo), limpo quando a fila zera.
  useEffect(() => {
    if (!queue.data) return
    const total = queue.data.totalCount
    if (total === 0) {
      sessionStorage.removeItem(MIGRATION_SESSION_TOTAL_KEY)
      return
    }
    const stored = sessionStorage.getItem(MIGRATION_SESSION_TOTAL_KEY)
    if (stored === null || total > Number(stored)) {
      sessionStorage.setItem(MIGRATION_SESSION_TOTAL_KEY, String(total))
    }
  }, [queue.data])

  // Foco inicial na fonte com pendência (achado real do e2e, 14.9 em review):
  // abrir sempre em "month" deixava o rail parado numa fonte vazia sempre que
  // só "week"/"day" tinham itens. Roda 1x no primeiro carregamento de dados —
  // depois disso a navegação entre fontes é só do usuário (`onSelect`/
  // `onNavigateToSource`), nunca sobrescrita por este efeito de novo.
  //
  //   ▶ Guarda por `queue.isSuccess` (não `!queue.data`, achado de code
  //     review): `!queue.data` sozinho não distingue "ainda carregando" de
  //     "refetch em background falhou mas o React Query manteve dados
  //     antigos em cache" — nesse 2º caso o efeito consumiria o latch único
  //     sobre dado obsoleto e nunca mais reagiria quando dados frescos
  //     chegassem. `isSuccess` espelha a condição de render 2 linhas abaixo
  //     (`queue.isError || !queue.data`), só que do lado positivo.
  //   ▶ `useLayoutEffect` (não `useEffect`, mesmo achado): evita 1 frame
  //     visível com a fonte errada ("month") quando o mount já encontra a
  //     query cacheada (ex. voltando de outra rota) — o efeito corrige ANTES
  //     do paint, não depois.
  const initialSourceAppliedRef = useRef(false)
  useLayoutEffect(() => {
    if (initialSourceAppliedRef.current || !queue.isSuccess) return
    initialSourceAppliedRef.current = true
    const firstNonEmpty = MIGRATION_SOURCE_ORDER.find(
      (sourceId) => (queue.data!.sections.find((section) => section.sourceId === sourceId)?.count ?? 0) > 0,
    )
    if (firstNonEmpty) setActiveSourceId(firstNonEmpty)
  }, [queue.isSuccess, queue.data])

  if (queue.isPending) {
    return (
      <Box component="main" aria-label="Migração" sx={{ p: 'var(--ds-space-4)' }}>
        <PlannerSkeleton />
      </Box>
    )
  }

  if (queue.isError || !queue.data) {
    return (
      <Box component="main" aria-label="Migração" sx={{ p: 'var(--ds-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-2)', alignItems: 'flex-start' }}>
        <Box role="alert" sx={{ ...typography.body, color: 'var(--ds-ink)' }}>
          Não foi possível carregar a migração.
        </Box>
        <Button onClick={() => queue.refetch()} variant="contained">
          Tentar de novo
        </Button>
      </Box>
    )
  }

  const items = itemsBySource(queue.data.sections)
  const totalCount = queue.data.totalCount
  const totalDecided = tally.migrated + tally.postponed + tally.cancelled

  function pause() {
    navigate('/today')
  }

  if (totalCount === 0) {
    if (totalDecided > 0) {
      return (
        <Box component="main" aria-label="Migração" sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <RitualHeader progressText={`${totalDecided} de ${totalDecided} revisadas`} onPause={pause} concluded />
          <Box sx={{ flex: 1, display: 'grid', placeItems: 'center' }}>
            <MigrationSummary tally={tally} onBack={() => navigate('/today')} />
          </Box>
        </Box>
      )
    }
    return (
      <Box component="main" aria-label="Migração" sx={{ p: 'var(--ds-space-4)' }}>
        <Box sx={{ ...typography.body, color: 'var(--ds-ink-muted)' }}>Nada para migrar.</Box>
      </Box>
    )
  }

  const railEntries = MIGRATION_SOURCE_ORDER.map((sourceId) => ({
    sourceId,
    count: queue.data!.sections.find((section) => section.sourceId === sourceId)?.count ?? 0,
  }))

  const activeAllItems: NormalizedMigrationItem[] = [
    ...items[activeSourceId].map(normalizeQueueItem),
    ...mutatedThisVisit[activeSourceId],
  ]
  const activeItems = activeAllItems.filter((item) =>
    view === 'pending' ? item.decision === null : item.decision !== null,
  )

  function findSourceOf(taskId: string): MigrationSourceId | undefined {
    for (const sourceId of MIGRATION_SOURCE_ORDER) {
      if (items[sourceId].some((item) => item.task.id === taskId)) return sourceId
    }
    return undefined
  }

  function recordMutation(taskId: string, decision: string) {
    const sourceId = findSourceOf(taskId) ?? activeSourceId
    const item = items[sourceId].find((candidate) => candidate.task.id === taskId)
    if (!item) return
    setMutatedThisVisit((prev) => ({
      ...prev,
      [sourceId]: [...prev[sourceId], { ...normalizeQueueItem(item), decision }],
    }))
  }

  function clearItemError(taskId: string) {
    setItemErrors((prev) => {
      if (!(taskId in prev)) return prev
      const next = { ...prev }
      delete next[taskId]
      return next
    })
  }

  function setItemError(taskId: string) {
    setItemErrors((prev) => ({ ...prev, [taskId]: 'Não foi possível salvar a decisão. Tente novamente.' }))
  }

  function decide(
    taskId: string,
    destination: MigrationDestination,
    extra: { monthFirst?: string; scheduledDate?: string | null } = {},
    onDecided?: () => void,
  ) {
    const run = () => {
      clearItemError(taskId)
      migrateTask.mutate(
        { taskId, destination, ...extra },
        {
          onSuccess: () => {
            recordMutation(taskId, destination)
            setTally((prev) => ({ ...prev, [bucketFor(destination)]: prev[bucketFor(destination)] + 1 }))
            onDecided?.()
          },
          onError: () => setItemError(taskId),
        },
      )
    }
    retryActionsRef.current[taskId] = run
    run()
  }

  function handleMigrateToday(taskId: string) {
    decide(taskId, 'today')
  }

  function handleCancel(taskId: string) {
    decide(taskId, 'cancel')
  }

  function handleRetryItem(taskId: string) {
    retryActionsRef.current[taskId]?.()
  }

  const otherMonths = currentMonthLog.data
    ? Array.from({ length: FUTURE_MONTHS_OFFERED }, (_, i) => addMonthsIso(currentMonthLog.data!.monthFirst, i + 1))
    : []

  function handleOpenDestinationPicker(taskId: string) {
    setDestinationError(null)
    setDestinationItemId(taskId)
    setPickerMonthFirst(currentMonthLog.data?.monthFirst ?? null)
  }

  function handleCloseDestinationPicker() {
    setDestinationItemId(null)
    setPickerMonthFirst(null)
    setDestinationError(null)
  }

  function handleConfirmDestination(scheduledDate: string | null, meta: DestinationConfirmMeta) {
    if (!destinationItemId) return
    const taskId = destinationItemId
    const currentMonthFirst = currentMonthLog.data?.monthFirst

    let destination: MigrationDestination
    const extra: { monthFirst?: string; scheduledDate?: string | null } = {}
    if (meta.kind === 'today') {
      destination = 'today'
    } else if (meta.kind === 'week') {
      destination = 'week'
      extra.scheduledDate = scheduledDate
    } else if (currentMonthFirst && meta.monthFirst === currentMonthFirst) {
      destination = 'month'
      extra.scheduledDate = scheduledDate
    } else {
      destination = 'future'
      extra.monthFirst = meta.monthFirst
      extra.scheduledDate = scheduledDate
    }

    clearItemError(taskId)
    migrateTask.mutate(
      { taskId, destination, ...extra },
      {
        onSuccess: () => {
          recordMutation(taskId, destination)
          setTally((prev) => ({ ...prev, [bucketFor(destination)]: prev[bucketFor(destination)] + 1 }))
          handleCloseDestinationPicker()
        },
        onError: () => setDestinationError('Não foi possível migrar a tarefa. Tente novamente.'),
      },
    )
  }

  function confirmLabelFor({ kind, scheduledDate, monthFirst }: { kind: DestinationConfirmMeta['kind']; scheduledDate: string | null; monthFirst: string }): string {
    if (kind === 'today') return 'Migrar para hoje'
    if (!scheduledDate) {
      if (kind === 'week') return 'Migrar sem dia definido (esta semana)'
      const [year, month] = monthFirst.split('-').map(Number)
      return `Migrar para ${MONTH_NAMES_PT[month - 1]} de ${year} (sem dia)`
    }
    if (kind === 'week') {
      return `Migrar para ${formatDayLabel(scheduledDate, 'weekday').toLowerCase()}, ${formatDayLabel(scheduledDate, 'day-month')}`
    }
    const day = Number(scheduledDate.slice(8, 10))
    const [, month] = monthFirst.split('-').map(Number)
    return `Migrar para ${day} de ${MONTH_NAMES_PT[month - 1]}`
  }

  function handleNavigateToSource(sourceId: MigrationSourceId) {
    setActiveSourceId(sourceId)
    setView('pending')
  }

  const progressSources = MIGRATION_SOURCE_ORDER.map((sourceId) => ({
    sourceId,
    pendingNow: items[sourceId].length,
  }))
  const totalPending = progressSources.reduce((sum, s) => sum + s.pendingNow, 0)

  return (
    <Box
      component="main"
      aria-label="Migração"
      sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
    >
      <RitualHeader progressText={`${totalDecided} de ${totalDecided + totalPending} revisadas`} onPause={pause} />

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: isNarrowLayout
            ? '1fr'
            : 'var(--ds-weekly-planning-source-rail) minmax(0, 1fr) var(--ds-weekly-planning-context-rail)',
          gap: 'var(--ds-space-4)',
          alignItems: 'start',
          mt: 'var(--ds-space-2)',
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
            Sem conexão. Migrar exige rede — decisões indisponíveis até reconectar.
          </Box>
        )}

        <MigrationSourceRail entries={railEntries} activeSourceId={activeSourceId} onSelect={setActiveSourceId} />

        <MigrationDecisionList
          sourceId={activeSourceId}
          items={activeItems}
          view={view}
          onViewChange={setView}
          loading={false}
          error={false}
          offline={!isOnline}
          onRetry={() => queue.refetch()}
          itemErrors={itemErrors}
          onRetryItem={handleRetryItem}
          onMigrateToday={handleMigrateToday}
          onChooseDestination={handleOpenDestinationPicker}
          onCancel={handleCancel}
        />

        <Box component="aside" aria-label="Contexto da migração" sx={{ position: 'sticky', top: 0 }}>
          <MigrationContextRail
            progressSources={progressSources}
            tally={tally}
            onNavigateToSource={handleNavigateToSource}
            onPause={pause}
          />
        </Box>
      </Box>

      {destinationItemId && pickerMonthFirst && (
        <DestinationPicker
          week={currentWeekLog.data ? { weekStart: currentWeekLog.data.weekStart } : undefined}
          month={{ targetMonthFirst: pickerMonthFirst, selectableMonths: otherMonths, onTargetMonthChange: setPickerMonthFirst }}
          todayIso={todayLog.data?.logDate}
          compact={isCompact}
          error={destinationError}
          confirmLabelFor={confirmLabelFor}
          onConfirm={handleConfirmDestination}
          onClose={handleCloseDestinationPicker}
        />
      )}
    </Box>
  )
}

function RitualHeader({
  progressText,
  onPause,
  concluded = false,
}: {
  progressText: string
  onPause: () => void
  concluded?: boolean
}) {
  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--ds-space-2)',
        border: '1px solid var(--ds-border)',
        borderRadius: 'var(--ds-radius-md)',
        padding: 'var(--ds-space-2) var(--ds-space-3)',
        background: 'var(--ds-surface)',
      }}
    >
      {/* `color: 'var(--ds-primary)'`: fix do achado real de contraste do axe
          (e2e em review). Sem override, o MUI aplica `theme.primary` legado
          (o teal antigo da marca), abaixo de 4.5:1 contra `--ds-surface` — o
          token novo `--ds-primary` (o verde-petróleo do design system novo)
          resolve. */}
      <Button component={RouterLink} to="/today" size="small" sx={{ color: 'var(--ds-primary)' }}>
        ‹ Hoje
      </Button>
      <Box>
        <Box component="h1" sx={{ ...typography['page-title'], margin: 0, color: 'var(--ds-ink)' }}>
          Migração
        </Box>
        <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
          {concluded ? 'concluída' : 'pendências anteriores'}
        </Box>
      </Box>
      <Box sx={{ flex: 1 }} />
      <Box role="status" aria-live="polite" sx={{ ...typography.body, color: 'var(--ds-ink-muted)', fontVariantNumeric: 'tabular-nums' }}>
        {progressText}
      </Box>
      {!concluded && (
        <Button onClick={onPause} variant="outlined" size="small" sx={{ borderColor: 'var(--ds-control-border)', color: 'var(--ds-ink)' }}>
          Pausar
        </Button>
      )}
    </Box>
  )
}
