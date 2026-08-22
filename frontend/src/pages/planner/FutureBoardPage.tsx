// ─────────────────────────────────────────────────────────────────────────────
// Future Log do sistema novo (Story 14.7 — M08). TERCEIRA superfície do Épico
// 14, depois de `WeeklyBoardPage` (14.5) e `MonthlyBoardPage` (14.6).
//
//   ▶ NÃO É UM RITUAL. Leitura + captura sobre `monthly_log` FUTUROS: sem
//     `planning`/`active`/`finalized`, sem rail de fontes, sem decisões-snapshot,
//     sem densidade. Abrir o Futuro ou consultar qualquer mês dele não inicia
//     ciclo nenhum — o log que nasce da consulta tem `status IS NULL`, inerte
//     para todos os predicados de `cycles.py` (AD-28 item 1).
//   ▶ CONCLUIR E CANCELAR NÃO EXISTEM aqui (regra de produto do M08): a Task Row
//     recebe `allowStatusCycle={false}` e o detalhe `allowCancel={false}` — as
//     duas props aditivas da Story 14.7 nos canônicos da 14.5.
//   ▶ Mês em foco é ESTADO LOCAL, sem param de rota — coerente com o stepper da
//     14.6. Deep-link (`?month=AAAA-MM`) é decisão de produto pendente (Questão
//     aberta #1), não improviso de implementação.
//   ▶ `FuturePage.tsx` (legada) permanece no repositório, apenas desmontada da
//     rota: a remoção do legado é o Épico 18, junto com `TaskRow.tsx`.
//   ▶ `GET /logs/monthly/` MATERIALIZA o mês consultado (`get_or_create`), e isso
//     é aceito de propósito — é o comportamento já vigente do endpoint desde a
//     14.1 e o log criado nasce inerte. Quem NÃO pode materializar é o endpoint
//     do horizonte, que varre 8 meses por consulta: por isso a leitura pura é
//     provada só dele (AC2).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { Box, Button, useMediaQuery } from '@mui/material'

import {
  TaskDetailCard,
  TaskRowBase,
  useCreateMonthlyTaskMutation,
  useFutureHorizonQuery,
  useMigrateTaskMutation,
  useMonthlyLogQuery,
  usePlaceRecurringTemplateMutation,
  useRecurringTemplatesQuery,
} from '../../features/bujo'
import type { RecurringTaskTemplate, Task } from '../../features/bujo'
import { RecurringPlacementDialog } from '../../features/bujo/components/RecurringPlacementDialog'
import { MonthlyDestinationPicker } from '../../features/bujo/components/monthly/MonthlyDestinationPicker'
import { FutureCaptureForm } from '../../features/bujo/components/future/FutureCaptureForm'
import { FutureHorizonTrail } from '../../features/bujo/components/future/FutureHorizonTrail'
import { FutureMonthPicker } from '../../features/bujo/components/future/FutureMonthPicker'
import {
  dayPrefixLabelOf,
  dayPrefixOf,
  focusCountsOf,
  formatFocusCounts,
  formatMonthTitle,
  sortByDayThenUndated,
} from '../../features/bujo/components/future/futureHorizon'
import { MONTH_NAMES_PT } from '../../features/bujo/monthNames'
import { futureBoard, mediaQueries, typography } from '../../shared/design/tokens'
import { useOnlineStatus } from '../../shared/hooks/useOnlineStatus'

/** Cores EXPLÍCITAS do design system (achado real do axe nesta story): o
 * `primary` do tema MUI é o teal de marca, que sobre `--ds-surface` mede
 * ~2,4:1 e reprova AA. Todo `Button` desta superfície declara a cor que usa. */
const RETRY_BUTTON_SX = {
  minHeight: 'var(--ds-touch-target-min)',
  backgroundColor: 'var(--ds-primary)',
  color: 'var(--ds-on-primary)',
  '&:hover': { backgroundColor: 'var(--ds-primary-hover)' },
} as const

const OFFLINE_REASON =
  'Você está offline. Consulta disponível; capturar, datar e mover ficam indisponíveis até reconectar.'

/** Tarefa com o seletor de destino aberto. O ATO (datar / mover / manter sem
 * dia) não é estado: sai do par (mês-alvo, dia armado) no momento da
 * confirmação — ver `confirmLabelFor`. Guardar um `kind` aqui seria uma segunda
 * fonte de verdade para a mesma coisa. */
type PendingMove = { task: Task }

function currentYearOf(anchorMonthFirst: string): number {
  // O ano dos "anuais pendentes" vem do ÂNCORA do servidor, não de `new Date()`
  // (Convenção #8: "hoje" nunca vem do cliente). O âncora tem piso no mês
  // corrente, então seu ano É o ano corrente sempre que não há `active`
  // adiantado — e um `active` adiantado é impossível (gate `date_reached`).
  return Number(anchorMonthFirst.slice(0, 4))
}

export function FutureBoardPage() {
  const horizon = useFutureHorizonQuery()
  const [focusedMonthFirst, setFocusedMonthFirst] = useState<string | null>(null)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)
  const [moveTargetMonth, setMoveTargetMonth] = useState<string | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)
  const [monthPickerOpen, setMonthPickerOpen] = useState(false)
  const [placingAnnualTemplate, setPlacingAnnualTemplate] = useState<RecurringTaskTemplate | null>(null)

  const isTabletUp = useMediaQuery(mediaQueries.tabletUp)
  const isOnline = useOnlineStatus()
  const compact = !isTabletUp

  const horizonMonths = horizon.data?.horizon ?? []
  const effectiveMonthFirst = focusedMonthFirst ?? horizonMonths[0]?.monthFirst ?? null

  const monthlyLog = useMonthlyLogQuery(effectiveMonthFirst ?? undefined, {
    enabled: Boolean(effectiveMonthFirst),
  })
  const createTask = useCreateMonthlyTaskMutation()
  const migrateTask = useMigrateTaskMutation()
  const placeTemplate = usePlaceRecurringTemplateMutation()

  const anchorMonthFirst = horizon.data?.anchorMonthFirst ?? null
  const pendingAnnualTemplates = useRecurringTemplatesQuery(
    { active: true, recurrenceGroup: 'annual', unplacedYear: anchorMonthFirst ? currentYearOf(anchorMonthFirst) : undefined },
    { enabled: Boolean(anchorMonthFirst) },
  )

  // ── initial loading: skeleton PRESERVANDO a geometria trilho + foco ────────
  // `PlannerSkeleton` (pilha de 5 barras) não serve aqui — a AC7 exige que o
  // esqueleto já tenha a forma da superfície, não uma barra genérica.
  if (horizon.isPending) {
    return (
      <Box component="main" aria-label="Futuro" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-3)', height: '100%', minHeight: 0 }}>
        <Box aria-hidden sx={{ display: 'flex', gap: 'var(--ds-space-3)', flex: 1, minHeight: 0, flexDirection: compact ? 'column' : 'row' }}>
          <Box
            sx={{
              width: compact ? '100%' : 'var(--ds-future-board-trail-width)',
              flex: compact ? '0 0 auto' : '0 0 var(--ds-future-board-trail-width)',
              display: 'flex',
              flexDirection: compact ? 'row' : 'column',
              gap: 'var(--ds-space-1)',
            }}
          >
            {/* Uma barra por mês do horizonte — a geometria que a AC7 exige é a
                do trilho REAL, não um número decorativo. `futureBoard.horizonMonths`
                é a única fonte do número no cliente (AC8): o esqueleto é o
                consumidor de produção desse token, já que o horizonte carregado
                vem inteiro do servidor. */}
            {Array.from({ length: futureBoard.horizonMonths }, (_, index) => (
              <Box
                key={index}
                sx={{
                  height: 'var(--ds-touch-target-min)',
                  flex: compact ? '1 1 0' : '0 0 auto',
                  borderRadius: 'var(--ds-radius-sm)',
                  backgroundColor: 'var(--ds-surface-subtle)',
                }}
              />
            ))}
          </Box>
          <Box sx={{ flex: 1, borderRadius: 'var(--ds-radius-md)', backgroundColor: 'var(--ds-surface-subtle)' }} />
        </Box>
        <Box role="status" sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
          Carregando o futuro…
        </Box>
      </Box>
    )
  }

  // ── read error do TRILHO: a superfície inteira depende dele ───────────────
  if (horizon.isError || !horizon.data || !effectiveMonthFirst || !anchorMonthFirst) {
    return (
      <Box component="main" aria-label="Futuro" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-2)' }}>
        <Box role="alert" sx={{ ...typography.body, color: 'var(--ds-ink)' }}>
          Não foi possível carregar os itens do futuro.
        </Box>
        <Button onClick={() => horizon.refetch()} sx={{ ...RETRY_BUTTON_SX, alignSelf: 'flex-start' }}>
          Tentar de novo
        </Button>
      </Box>
    )
  }

  const lastHorizonMonthFirst = horizonMonths[horizonMonths.length - 1].monthFirst
  const horizonTotal = horizonMonths.reduce((sum, month) => sum + month.taskCount, 0)
  const distantTotal = horizon.data.distant.reduce((sum, month) => sum + month.taskCount, 0)
  const isGlobalEmpty = horizonTotal === 0 && distantTotal === 0

  const rootTasks = monthlyLog.data?.tasks ?? []
  const orderedTasks = sortByDayThenUndated(rootTasks)
  const focusCounts = focusCountsOf(rootTasks)
  const allTasksById = new Map<string, Task>()
  for (const task of rootTasks) {
    allTasksById.set(task.id, task)
    for (const subtask of task.subtasks ?? []) allTasksById.set(subtask.id, subtask)
  }
  const openTask = openTaskId ? allTasksById.get(openTaskId) : undefined
  const isOpenTaskSubtask = openTaskId ? !rootTasks.some((task) => task.id === openTaskId) : false

  /** Meses selecionáveis na aba "Outro mês" — os mesmos dados do trilho e do
   * "Ir para mês…" (AC4), nunca uma lista paralela. */
  const selectableMonths = [
    ...horizonMonths.map((month) => month.monthFirst),
    ...horizon.data.distant.map((month) => month.monthFirst),
  ]

  function selectMonth(monthFirst: string) {
    setFocusedMonthFirst(monthFirst)
    setMonthPickerOpen(false)
  }

  function openMove(task: Task) {
    setPendingMove({ task })
    setMoveTargetMonth(effectiveMonthFirst)
    setMoveError(null)
  }

  function closeMove() {
    setPendingMove(null)
    setMoveTargetMonth(null)
    setMoveError(null)
  }

  function confirmMove(scheduledDate: string | null) {
    if (!pendingMove || !moveTargetMonth) return
    migrateTask.mutate(
      {
        taskId: pendingMove.task.id,
        destination: 'future',
        monthFirst: moveTargetMonth,
        scheduledDate: scheduledDate ?? undefined,
      },
      {
        // Sucesso NÃO mostra toast (AC4): a lista, as contagens do trilho e o
        // cabeçalho de foco se atualizam sozinhos pela invalidação por prefixo.
        onSuccess: () => {
          if (moveTargetMonth !== effectiveMonthFirst) setFocusedMonthFirst(moveTargetMonth)
          closeMove()
        },
        // Falha PRESERVA o seletor aberto com o destino armado (AC4/AC7).
        onError: () => setMoveError('Não foi possível mover a tarefa. Tente novamente.'),
      },
    )
  }

  /** Rótulo NOMEADO do ato (AC4) — nunca um "Confirmar" genérico. */
  function confirmLabelFor({ monthFirst, scheduledDate }: { monthFirst: string; scheduledDate: string | null }) {
    const monthName = MONTH_NAMES_PT[Number(monthFirst.slice(5, 7)) - 1]
    if (!scheduledDate) {
      return monthFirst === effectiveMonthFirst
        ? 'Manter sem dia definido'
        : `Mover para ${formatMonthTitle(monthFirst).toLowerCase()}`
    }
    return `Datar em ${Number(scheduledDate.slice(8, 10))} de ${monthName}`
  }

  function handleConfirmAnnualPlacement(dateValue: string) {
    if (!placingAnnualTemplate || !anchorMonthFirst) return
    const scheduledDate = dateValue || undefined
    const monthFirst = scheduledDate ? `${scheduledDate.slice(0, 7)}-01` : `${anchorMonthFirst.slice(0, 7)}-01`
    placeTemplate.mutate({ templateId: placingAnnualTemplate.id, monthFirst, scheduledDate })
    setPlacingAnnualTemplate(null)
  }

  // Molde "banner vazio = sem DOM" (AC6): sem nenhum anual pendente, a seção
  // simplesmente não renderiza — sem placeholder, sem heading órfão.
  const annualYear = currentYearOf(anchorMonthFirst)
  const pendingAnnuals = pendingAnnualTemplates.data ?? []
  const pendingAnnualSection = !pendingAnnualTemplates.isPending && pendingAnnuals.length > 0 && (
    <Box
      role="region"
      aria-label={`Anuais pendentes de ${annualYear}`}
      sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}
    >
      <Box sx={{ ...typography['section-title'], color: 'var(--ds-ink)' }}>
        {`Anuais pendentes de ${annualYear}`}
      </Box>
      {/* `<ul>/<li>` (e não `div`s soltas): dá a cada anual um contorno próprio
          na árvore de acessibilidade, o que é o que permite distinguir dois
          botões "Alocar" idênticos — por leitor de tela e por teste. O rótulo
          VISÍVEL e acessível do botão continua sendo exatamente "Alocar" (AC6). */}
      <Box
        component="ul"
        sx={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}
      >
        {pendingAnnuals.map((template) => (
          <Box
            component="li"
            key={template.id}
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--ds-space-2)' }}
          >
            <Box sx={{ ...typography.body, color: 'var(--ds-ink)' }}>{template.title}</Box>
            <Button
              size="small"
              disabled={!isOnline}
              onClick={() => setPlacingAnnualTemplate(template)}
              sx={{
                minHeight: 'var(--ds-touch-target-min)',
                border: '1px solid var(--ds-control-border)',
                color: 'var(--ds-ink)',
                '&.Mui-disabled': { color: 'var(--ds-ink-muted)' },
              }}
            >
              Alocar
            </Button>
          </Box>
        ))}
      </Box>
    </Box>
  )

  const focusColumn = (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--ds-space-2)',
        border: '1px solid var(--ds-border)',
        borderRadius: 'var(--ds-radius-md)',
        backgroundColor: 'var(--ds-surface)',
        padding: 'var(--ds-panel-padding)',
      }}
    >
      <Box component="header">
        <Box component="h2" sx={{ ...typography['section-title'], color: 'var(--ds-ink)', margin: 0 }}>
          {formatMonthTitle(effectiveMonthFirst)}
        </Box>
        <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
          {formatFocusCounts(focusCounts)}
        </Box>
      </Box>

      {/* local loading: a troca de mês afeta SÓ esta coluna — o trilho não some. */}
      {monthlyLog.isPending ? (
        <Box role="status" sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
          Carregando o mês…
        </Box>
      ) : monthlyLog.isError ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-2)', alignItems: 'flex-start' }}>
          <Box role="alert" sx={{ ...typography.body, color: 'var(--ds-ink)' }}>
            Não foi possível carregar os itens do futuro.
          </Box>
          {/* Retry SEM trocar o mês em foco (AC7). */}
          <Button onClick={() => monthlyLog.refetch()} sx={RETRY_BUTTON_SX}>
            Tentar de novo
          </Button>
        </Box>
      ) : orderedTasks.length === 0 ? (
        <Box sx={{ ...typography.body, color: 'var(--ds-ink-muted)' }}>
          Nada capturado em {formatMonthTitle(effectiveMonthFirst).toLowerCase()} ainda.
        </Box>
      ) : (
        <Box
          component="ul"
          aria-label={`Itens de ${formatMonthTitle(effectiveMonthFirst)}`}
          sx={{ listStyle: 'none', margin: 0, padding: 0, flex: 1, minHeight: 0, overflowY: 'auto' }}
        >
          {orderedTasks.map((task) => (
            <Box
              component="li"
              key={task.id}
              sx={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-2)' }}
            >
              <Box
                aria-label={dayPrefixLabelOf(task, effectiveMonthFirst)}
                sx={{
                  ...typography.meta,
                  color: 'var(--ds-ink-muted)',
                  fontVariantNumeric: 'tabular-nums',
                  flex: '0 0 auto',
                  whiteSpace: 'nowrap',
                }}
              >
                {dayPrefixOf(task, effectiveMonthFirst)}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <TaskRowBase
                  task={task}
                  cycleStatus={null}
                  // Concluir/cancelar não existem nesta superfície (M08).
                  allowStatusCycle={false}
                  onOpenDetail={setOpenTaskId}
                  // UM controle por linha — a coluna 5 do `TaskRowBase` é fixa
                  // em 24px e não comporta os DOIS botões do mockup ("definir
                  // dia" + `⇢ Mover de mês`). O ato é nomeado pelo estado do
                  // item, e mover um item SEM dia continua alcançável no mesmo
                  // fluxo: o seletor que este botão abre tem a aba "Outro mês"
                  // (e o detalhe tem "Mover tarefa"). Anatomia de duas
                  // affordances = Questão aberta #8, não improviso (AC5).
                  trailingSlot={
                    <Button
                      size="small"
                      disabled={!isOnline}
                      aria-label={
                        task.scheduledDate
                          ? `Mover ${task.title}`
                          : `Definir dia de ${task.title}`
                      }
                      onClick={() => openMove(task)}
                      sx={{
                        minWidth: 0,
                        minHeight: 'var(--ds-touch-target-min)',
                        color: 'var(--ds-ink-muted)',
                        '&.Mui-disabled': { color: 'var(--ds-ink-disabled)' },
                      }}
                    >
                      {/* Glifo do mockup para o ato de mover de mês (`⇢`); o
                          `⌖` de lá pertence a "Ir para mês…", outro controle. */}
                      ⇢
                    </Button>
                  }
                />
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )

  return (
    <Box
      component="main"
      aria-label="Futuro"
      sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-3)', height: '100%', minHeight: 0 }}
    >
      <Box component="header" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-2)' }}>
        <Box sx={{ ...typography['page-title'], color: 'var(--ds-ink)' }}>Futuro</Box>
        <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
          {`horizonte rolante · ${formatMonthTitle(horizonMonths[0].monthFirst).toLowerCase()} – ${formatMonthTitle(lastHorizonMonthFirst).toLowerCase()}`}
        </Box>
        <FutureCaptureForm
          focusedMonthFirst={effectiveMonthFirst}
          anchorMonthFirst={anchorMonthFirst}
          disabled={!isOnline}
          disabledReason={OFFLINE_REASON}
          onAdd={(fields) => createTask.mutate(fields)}
        />
      </Box>

      {/* empty GLOBAL: os 8 meses seguem visíveis no trilho (AC7). */}
      {isGlobalEmpty && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
          <Box sx={{ ...typography['section-title'], color: 'var(--ds-ink)' }}>Nada no futuro ainda</Box>
          <Box sx={{ ...typography.body, color: 'var(--ds-ink-muted)' }}>
            Capture algo que ainda não tem data certa e ele espera aqui até você decidir o dia.
          </Box>
        </Box>
      )}

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: compact ? 'column' : 'row',
          gap: 'var(--ds-space-3)',
        }}
      >
        <FutureHorizonTrail
          months={horizonMonths}
          focusedMonthFirst={effectiveMonthFirst}
          compact={compact}
          onSelect={selectMonth}
          onOpenMonthPicker={() => setMonthPickerOpen(true)}
        />
        {focusColumn}
      </Box>

      {pendingAnnualSection}

      {monthPickerOpen && (
        <FutureMonthPicker
          distant={horizon.data.distant}
          lastHorizonMonthFirst={lastHorizonMonthFirst}
          compact={compact}
          onSelect={selectMonth}
          onClose={() => setMonthPickerOpen(false)}
        />
      )}

      {pendingMove && moveTargetMonth && (
        <MonthlyDestinationPicker
          targetMonthFirst={moveTargetMonth}
          compact={compact}
          error={moveError}
          selectableMonths={selectableMonths}
          onTargetMonthChange={setMoveTargetMonth}
          confirmLabelFor={confirmLabelFor}
          onConfirm={confirmMove}
          onClose={closeMove}
        />
      )}

      {openTask && (
        <TaskDetailCard
          key={openTaskId}
          task={openTask}
          isSubtask={isOpenTaskSubtask}
          // Cancelar não existe nesta superfície (M08); editar, mover e excluir sim.
          allowCancel={false}
          onMove={() => {
            setOpenTaskId(null)
            openMove(openTask)
          }}
          onClose={() => setOpenTaskId(null)}
        />
      )}

      <RecurringPlacementDialog
        open={placingAnnualTemplate !== null}
        dateFieldType="date"
        template={placingAnnualTemplate}
        monthFirst={effectiveMonthFirst}
        onClose={() => setPlacingAnnualTemplate(null)}
        onConfirm={handleConfirmAnnualPlacement}
      />
    </Box>
  )
}
