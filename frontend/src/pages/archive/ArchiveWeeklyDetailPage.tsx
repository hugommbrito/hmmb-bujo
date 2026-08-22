// ─────────────────────────────────────────────────────────────────────────────
// Detalhe de uma semana do Arquivo (Story 14.10) — substitui `WeeklyPage`
// legada em `archive/weekly/:weekStart`. Readonly é DERIVADO do estado REAL da
// semana (`closed === true || status === 'finalized'`, mesmo padrão de
// `WeeklyBoardPage.tsx`), nunca da rota — paridade com o bugfix da Story 11.11
// (`isArchiveView` gateando escrita por rota). Uma semana alcançada via seta de
// linhagem que NÃO está fechada renderiza mutável normalmente.
//
//   ▶ Day-groups (não a grade 7 colunas do Weekly Board): anatomia do mockup
//     `key-archive.html`, um card por dia com tarefas + seção "Sem dia
//     definido". `TaskRowBase`/`TaskDetailCard` reaproveitados sem nova
//     anatomia (`variant="readonly"` quando fechada).
//   ▶ Linhagem cross-período: `onNavigateToSuccessor` grava a origem em
//     `archiveLineageReturn` e navega com `location.state.focusTaskId` para o
//     destino focar o sucessor ao montar.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Box, Button, MenuItem, Select, TextField } from '@mui/material'

import {
  TaskDetailCard,
  TaskRowBase,
  useCreateWeeklyTaskMutation,
  useTransitionTaskMutation,
  useWeeklyLogQuery,
  useMonthlyLogQuery,
  invalidateRitualQueries,
} from '../../features/bujo'
import type { CycleStatus, MigrationTarget, MonthlyLog, Task, TaskStatus, WeeklyDay, WeeklyLog } from '../../features/bujo'
import { PlannerSkeleton } from '../../features/bujo/components/PlannerSkeleton'
import { findTaskById } from '../../features/bujo/taskTree'
import { typography } from '../../shared/design/tokens'
import { useOnlineStatus } from '../../shared/hooks/useOnlineStatus'
import { addDaysIso, formatDayLabel, parseLocalDate } from '../../shared/date'
import { MONTH_NAMES_PT, capitalize } from '../../features/bujo/monthNames'
import {
  clearLineageReturn,
  focusTaskRow,
  pathForMigrationTarget,
  readLineageReturn,
  writeLineageReturn,
} from './archiveLineageReturn'
import { findPredecessorInMonthlyLog, findPredecessorInWeeklyLog, type PredecessorLocation } from './archivePredecessor'

interface ArchiveDetailLocationState {
  archiveReturnQuery?: string
  focusTaskId?: string
  // DW-17: a página de ORIGEM (esta mesma página, ou `ArchiveMonthlyDetailPage`)
  // grava sua própria identidade de período antes de navegar — permite que o
  // DESTINO carregue esse período sob demanda quando o predecessor não está
  // no período que já tem carregado (predecessor cross-período).
  originPeriod?: MigrationTarget
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

// Busca o predecessor no período CARREGADO primeiro; se não encontrar (DW-17:
// o predecessor mora em outro período, alcançado via seta de linhagem
// cross-período), tenta o período de ORIGEM — semanal de outra semana (mesma
// página, período diferente) ou mensal (cross-tipo). `originWeeklyLog`/
// `originMonthlyLog` só chegam preenchidos quando a query de origem
// correspondente está habilitada E já resolveu (ver call site).
//
// Ordem de parâmetros (`originWeeklyLog` antes de `originMonthlyLog`) é a
// MESMA em `ArchiveMonthlyDetailPage.tsx` — as duas páginas são espelho
// exato, e esta função é o único lugar onde a ordem poderia divergir sem
// nenhum erro de tipo acusar (achado de review, puramente cosmético — sem
// mudança de comportamento).
function findPredecessor(
  days: WeeklyDay[],
  unscheduled: Task[],
  taskId: string,
  originWeeklyLog: WeeklyLog | undefined,
  originMonthlyLog: MonthlyLog | undefined,
): PredecessorLocation | null {
  return (
    findPredecessorInWeeklyLog(days, unscheduled, taskId) ??
    (originWeeklyLog ? findPredecessorInWeeklyLog(originWeeklyLog.days, originWeeklyLog.unscheduled, taskId) : null) ??
    (originMonthlyLog ? findPredecessorInMonthlyLog(originMonthlyLog.tasks, taskId) : null)
  )
}

export function ArchiveWeeklyDetailPage() {
  const { weekStart } = useParams<{ weekStart: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isOnline = useOnlineStatus()
  const locationState = (location.state as ArchiveDetailLocationState | null) ?? null
  const archiveReturnQuery = locationState?.archiveReturnQuery ?? ''
  const originPeriod = locationState?.originPeriod

  const weeklyLog = useWeeklyLogQuery(weekStart)
  // DW-17: período de ORIGEM de uma linhagem cross-período, carregado SOB
  // DEMANDA — `enabled` só liga quando `originPeriod` existe E seu `type`
  // bate com o hook chamado; nunca dispara a busca "semana atual"/"mês
  // atual" (sentinela) como efeito colateral de um parâmetro ausente
  // (`weekStart`/`monthFirst` ficam `undefined` quando desabilitado).
  const originIsMonthly = originPeriod?.type === 'monthly' && Boolean(originPeriod?.monthFirst)
  const originIsWeekly = originPeriod?.type === 'weekly' && Boolean(originPeriod?.weekStart)
  const originMonthlyLog = useMonthlyLogQuery(originIsMonthly ? originPeriod?.monthFirst ?? undefined : undefined, {
    enabled: originIsMonthly,
  })
  const originWeeklyLog = useWeeklyLogQuery(originIsWeekly ? originPeriod?.weekStart ?? undefined : undefined, {
    enabled: originIsWeekly,
  })
  const createWeeklyTask = useCreateWeeklyTaskMutation()
  const transitionTask = useTransitionTaskMutation()

  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [formSelectedDay, setFormSelectedDay] = useState('')
  const [navigationError, setNavigationError] = useState<string | null>(null)
  const arrivalHandledRef = useRef(false)

  useEffect(() => {
    setOpenTaskId(null)
    setTitle('')
    setFormSelectedDay('')
    setNavigationError(null)
    arrivalHandledRef.current = false
    // `location.key` muda a cada navegação, mesmo quando `weekStart` é o mesmo
    // (ex.: um segundo salto de linhagem pousando na semana já montada) —
    // sem ele, a segunda chegada nunca recebe foco (Story 14.10, review).
  }, [weekStart, location.key])

  // Foco de chegada (via seta de linhagem, `location.state.focusTaskId`) OU de
  // retorno (via `archiveLineageReturn`, ao voltar para esta página) — só uma
  // tentativa por período carregado.
  useEffect(() => {
    if (!weeklyLog.data || arrivalHandledRef.current) return
    arrivalHandledRef.current = true
    const arrivalTaskId = locationState?.focusTaskId
    if (arrivalTaskId) {
      focusTaskRow(arrivalTaskId)
      return
    }
    // A entrada é lida e limpa JUNTAS (Story 14.10 review): uma tentativa que
    // falha (linha não existe mais nesta montagem) não pode deixar a entrada
    // presa indefinidamente — é melhor esforço, não fila.
    const pendingReturnTaskId = readLineageReturn()
    if (pendingReturnTaskId) {
      clearLineageReturn()
      focusTaskRow(pendingReturnTaskId)
    }
  }, [weeklyLog.data, locationState])

  function handleNavigateToSuccessor(
    successorTaskId: string,
    originTaskId: string,
    target: MigrationTarget,
  ) {
    const path = pathForMigrationTarget(target)
    if (!path) {
      // Defensivo (achado da review): `migrationTarget` resolvido mas sem
      // chave utilizável (inconsistência de dados) — feedback visível em vez
      // de um clique morto e silencioso.
      setNavigationError('Não foi possível abrir o período de destino desta linhagem.')
      return
    }
    setNavigationError(null)
    writeLineageReturn(originTaskId)
    // DW-17: esta página (a ORIGEM da navegação) já sabe sua própria
    // identidade de período (`loadedWeekStart`, via closure — a função só
    // EXECUTA em resposta a um clique, depois que o corpo do componente já
    // rodou até a linha que destructura `weeklyLog.data`) — o destino usa
    // isso para carregar este período sob demanda se precisar mostrar "Veio
    // de" para uma tarefa que migrou PARA lá.
    navigate(path, {
      state: {
        focusTaskId: successorTaskId,
        archiveReturnQuery,
        originPeriod: { type: 'weekly', weekStart: loadedWeekStart } satisfies MigrationTarget,
      },
    })
  }

  if (weeklyLog.isPending) {
    return (
      <Box component="main" aria-label="Arquivo — Semana" sx={{ p: 'var(--ds-space-4)' }}>
        <PlannerSkeleton />
      </Box>
    )
  }

  if (weeklyLog.isError || !weeklyLog.data) {
    return (
      <Box
        component="main"
        aria-label="Arquivo — Semana"
        sx={{ p: 'var(--ds-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-2)', alignItems: 'flex-start' }}
      >
        {!isOnline ? (
          <Box sx={{ ...typography.body, color: 'var(--ds-ink-muted)' }}>
            Esta semana não está disponível offline.
          </Box>
        ) : (
          <>
            <Box role="alert" sx={{ ...typography.body, color: 'var(--ds-ink)' }}>
              Não foi possível carregar esta semana.
            </Box>
            <Button onClick={() => weeklyLog.refetch()} variant="contained">
              Tentar de novo
            </Button>
          </>
        )}
      </Box>
    )
  }

  const { days, unscheduled, weekStart: loadedWeekStart, closed, status } = weeklyLog.data
  const isReadonly = closed === true || status === 'finalized'
  const allTasks = [...days.flatMap((day) => day.tasks), ...unscheduled]
  const totalTasks = allTasks.length
  const openTask = openTaskId ? findTaskById(allTasks, openTaskId) : undefined
  const isOpenTaskSubtask = openTaskId ? !allTasks.some((task) => task.id === openTaskId) : false
  const backToArchiveHref = `/archive${archiveReturnQuery}`

  function handleTransition(taskId: string, toStatus: TaskStatus) {
    transitionTask.mutate({ taskId, toStatus }, { onSuccess: () => invalidateRitualQueries(queryClient) })
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return
    createWeeklyTask.mutate(
      { weekStart: loadedWeekStart, title: trimmedTitle, scheduledDate: formSelectedDay || undefined },
      { onSuccess: () => weeklyLog.refetch() },
    )
    setTitle('')
    setFormSelectedDay('')
  }

  function renderTaskRow(task: Task, index: number) {
    return (
      <TaskRowBase
        key={task.id}
        task={task}
        variant={isReadonly ? 'readonly' : 'full'}
        cycleStatus={status as CycleStatus}
        order={index + 1}
        onOpenDetail={setOpenTaskId}
        onTransition={isReadonly ? undefined : handleTransition}
        onNavigateToSuccessor={handleNavigateToSuccessor}
      />
    )
  }

  const daysWithTasks = days.filter((day) => day.tasks.length > 0)

  return (
    <Box component="main" aria-label={`Arquivo — Semana de ${loadedWeekStart}`} sx={{ p: 'var(--ds-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-3)' }}>
      <Box>
        <Button component={RouterLink} to={backToArchiveHref} size="small" sx={{ color: 'var(--ds-primary)' }}>
          ‹ Voltar ao Arquivo
        </Button>
      </Box>

      {!isOnline && (
        <Box
          role="status"
          sx={{ ...typography.body, color: 'var(--ds-danger)', backgroundColor: 'var(--ds-danger-soft)', padding: 'var(--ds-space-2)', borderRadius: 'var(--ds-radius-sm)' }}
        >
          Sem conexão. Mostrando dados já carregados neste dispositivo.
        </Box>
      )}

      {navigationError && (
        <Box role="alert" sx={{ ...typography.body, color: 'var(--ds-danger)' }}>
          {navigationError}
        </Box>
      )}

      <Box component="header" sx={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-2)', flexWrap: 'wrap' }}>
        <Box component="h1" sx={{ ...typography['page-title'], color: 'var(--ds-ink)', margin: 0 }}>
          {formatWeekRange(loadedWeekStart)}
        </Box>
        <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>{totalTasks} tarefas</Box>
        {isReadonly && (
          <>
            <Box
              sx={{
                ...typography.label,
                color: 'var(--ds-success)',
                border: '1px solid var(--ds-success)',
                borderRadius: 'var(--ds-radius-full)',
                padding: 'var(--ds-space-1) var(--ds-space-2)',
              }}
            >
              Fechada
            </Box>
            <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>Somente leitura</Box>
          </>
        )}
      </Box>

      {daysWithTasks.length === 0 && unscheduled.length === 0 ? (
        <Box sx={{ ...typography.body, color: 'var(--ds-ink-muted)' }}>Nenhuma tarefa nesta semana.</Box>
      ) : (
        <>
          {daysWithTasks.map((day) => (
            <Box key={day.date} component="section" aria-label={`${capitalize(formatDayLabel(day.date, 'weekday'))}, ${formatDayLabel(day.date, 'day-month')}`}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 'var(--ds-space-2)', borderBottom: '1px solid var(--ds-border)', pb: 'var(--ds-space-1)', mb: 'var(--ds-space-1)' }}>
                <Box component="h2" sx={{ ...typography['section-title'], color: 'var(--ds-ink)', margin: 0 }}>
                  {capitalize(formatDayLabel(day.date, 'weekday'))}
                </Box>
                <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
                  {formatDayLabel(day.date, 'day-month')} · {day.tasks.length} tarefas
                </Box>
              </Box>
              {day.tasks.map((task, index) => renderTaskRow(task, index))}
            </Box>
          ))}

          {unscheduled.length > 0 && (
            <Box component="section" aria-label="Sem dia definido">
              <Box component="h2" sx={{ ...typography['section-title'], color: 'var(--ds-ink)', margin: 0, borderBottom: '1px solid var(--ds-border)', pb: 'var(--ds-space-1)', mb: 'var(--ds-space-1)' }}>
                Sem dia definido
              </Box>
              {unscheduled.map((task, index) => renderTaskRow(task, index))}
            </Box>
          )}
        </>
      )}

      {!isReadonly && (
        <Box
          component="form"
          onSubmit={handleSubmit}
          aria-label="Adicionar tarefa à semana"
          sx={{ display: 'flex', gap: 'var(--ds-space-2)', alignItems: 'flex-end', flexWrap: 'wrap' }}
        >
          <TextField label="Título" size="small" value={title} onChange={(event) => setTitle(event.target.value)} />
          <Select
            displayEmpty
            size="small"
            value={formSelectedDay}
            onChange={(event) => setFormSelectedDay(event.target.value)}
            inputProps={{ 'aria-label': 'Dia (opcional)' }}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">Sem dia definido</MenuItem>
            {days.map((day) => (
              <MenuItem key={day.date} value={day.date}>
                {capitalize(formatDayLabel(day.date, 'weekday'))} · {formatDayLabel(day.date, 'day-month')}
              </MenuItem>
            ))}
          </Select>
          <Button type="submit" sx={{ backgroundColor: 'var(--ds-primary)', color: 'var(--ds-on-primary)' }}>
            Adicionar
          </Button>
        </Box>
      )}

      {openTask && (
        <TaskDetailCard
          key={openTaskId}
          task={openTask}
          isSubtask={isOpenTaskSubtask}
          readonly={isReadonly}
          onClose={() => setOpenTaskId(null)}
          predecessor={
            openTaskId
              ? findPredecessor(
                  days,
                  unscheduled,
                  openTaskId,
                  originIsWeekly ? originWeeklyLog.data : undefined,
                  originIsMonthly ? originMonthlyLog.data : undefined,
                )
              : null
          }
        />
      )}
    </Box>
  )
}
