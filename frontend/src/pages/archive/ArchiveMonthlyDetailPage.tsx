// ─────────────────────────────────────────────────────────────────────────────
// Detalhe de um mês do Arquivo (Story 14.10) — substitui `MonthlyPage` legada
// em `archive/monthly/:monthFirst`. Irmã de `ArchiveWeeklyDetailPage.tsx`,
// mesmo racional: readonly DERIVADO do estado real (`closed`/`status`), day-
// groups (agrupados por `scheduledDate`, já que `MonthlyLog` devolve `tasks`
// FLAT), `TaskRowBase`/`TaskDetailCard` reaproveitados, linhagem cross-período
// via `archiveLineageReturn`.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Box, Button, TextField } from '@mui/material'

import {
  TaskDetailCard,
  TaskRowBase,
  useCreateMonthlyTaskMutation,
  useTransitionTaskMutation,
  useMonthlyLogQuery,
  invalidateRitualQueries,
} from '../../features/bujo'
import type { CycleStatus, MigrationTarget, Task, TaskStatus } from '../../features/bujo'
import { PlannerSkeleton } from '../../features/bujo/components/PlannerSkeleton'
import { findTaskById } from '../../features/bujo/taskTree'
import { typography } from '../../shared/design/tokens'
import { useOnlineStatus } from '../../shared/hooks/useOnlineStatus'
import { formatDayLabel, lastDayOfMonth } from '../../shared/date'
import { MONTH_NAMES_PT, capitalize } from '../../features/bujo/monthNames'
import {
  clearLineageReturn,
  focusTaskRow,
  pathForMigrationTarget,
  readLineageReturn,
  writeLineageReturn,
} from './archiveLineageReturn'

interface ArchiveDetailLocationState {
  archiveReturnQuery?: string
  focusTaskId?: string
}

function formatMonthTitle(monthFirst: string): string {
  const [year, month] = monthFirst.split('-').map(Number)
  return `${capitalize(MONTH_NAMES_PT[month - 1])} de ${year}`
}

function groupTasksByScheduledDate(tasks: Task[]) {
  const byDate = new Map<string, Task[]>()
  const withoutDate: Task[] = []
  for (const task of tasks) {
    if (!task.scheduledDate) {
      withoutDate.push(task)
      continue
    }
    const existing = byDate.get(task.scheduledDate)
    if (existing) existing.push(task)
    else byDate.set(task.scheduledDate, [task])
  }
  const withDate = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))
  return { withDate, withoutDate }
}

// Recorre em `subtasks` (Story 14.10, review): sem isso, uma SUBTAREFA
// migrada/adiada cujo sucessor é aberto no mesmo mês nunca mostra "Veio de" —
// mesma classe de bug já corrigida para `onNavigateToSuccessor` em
// `TaskRowBase.tsx`, mas do lado da busca de predecessor.
function findPredecessorTask(tasks: Task[], taskId: string): Task | undefined {
  for (const task of tasks) {
    if (task.migratedToTask === taskId) return task
    const found = findPredecessorTask(task.subtasks ?? [], taskId)
    if (found) return found
  }
  return undefined
}

function findPredecessor(tasks: Task[], taskId: string): { period: string; date: string } | null {
  const predecessor = findPredecessorTask(tasks, taskId)
  if (!predecessor) return null
  if (predecessor.scheduledDate) {
    return {
      period: capitalize(formatDayLabel(predecessor.scheduledDate, 'weekday')),
      date: formatDayLabel(predecessor.scheduledDate, 'day-month'),
    }
  }
  return { period: 'Sem dia definido', date: '' }
}

export function ArchiveMonthlyDetailPage() {
  const { monthFirst } = useParams<{ monthFirst: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isOnline = useOnlineStatus()
  const locationState = (location.state as ArchiveDetailLocationState | null) ?? null
  const archiveReturnQuery = locationState?.archiveReturnQuery ?? ''

  const monthlyLog = useMonthlyLogQuery(monthFirst)
  const createMonthlyTask = useCreateMonthlyTaskMutation()
  const transitionTask = useTransitionTaskMutation()

  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [formSelectedDay, setFormSelectedDay] = useState('')
  const [dayError, setDayError] = useState<string | null>(null)
  const [navigationError, setNavigationError] = useState<string | null>(null)
  const arrivalHandledRef = useRef(false)

  useEffect(() => {
    setOpenTaskId(null)
    setTitle('')
    setFormSelectedDay('')
    setDayError(null)
    setNavigationError(null)
    arrivalHandledRef.current = false
    // `location.key` muda a cada navegação, mesmo quando `monthFirst` é o
    // mesmo (ex.: um segundo salto de linhagem pousando no mês já montado) —
    // sem ele, a segunda chegada nunca recebe foco (Story 14.10, review).
  }, [monthFirst, location.key])

  useEffect(() => {
    if (!monthlyLog.data || arrivalHandledRef.current) return
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
  }, [monthlyLog.data, locationState])

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
    navigate(path, { state: { focusTaskId: successorTaskId, archiveReturnQuery } })
  }

  if (monthlyLog.isPending) {
    return (
      <Box component="main" aria-label="Arquivo — Mês" sx={{ p: 'var(--ds-space-4)' }}>
        <PlannerSkeleton />
      </Box>
    )
  }

  if (monthlyLog.isError || !monthlyLog.data) {
    return (
      <Box
        component="main"
        aria-label="Arquivo — Mês"
        sx={{ p: 'var(--ds-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-2)', alignItems: 'flex-start' }}
      >
        {!isOnline ? (
          <Box sx={{ ...typography.body, color: 'var(--ds-ink-muted)' }}>
            Este mês não está disponível offline.
          </Box>
        ) : (
          <>
            <Box role="alert" sx={{ ...typography.body, color: 'var(--ds-ink)' }}>
              Não foi possível carregar este mês.
            </Box>
            <Button onClick={() => monthlyLog.refetch()} variant="contained">
              Tentar de novo
            </Button>
          </>
        )}
      </Box>
    )
  }

  const { monthFirst: loadedMonthFirst, tasks, closed, status } = monthlyLog.data
  const isReadonly = closed === true || status === 'finalized'
  const { withDate, withoutDate } = groupTasksByScheduledDate(tasks)
  const openTask = openTaskId ? findTaskById(tasks, openTaskId) : undefined
  const isOpenTaskSubtask = openTaskId ? !tasks.some((task) => task.id === openTaskId) : false
  const backToArchiveHref = `/archive${archiveReturnQuery}`
  const minDay = loadedMonthFirst
  const maxDay = `${loadedMonthFirst.slice(0, 8)}${String(lastDayOfMonth(loadedMonthFirst)).padStart(2, '0')}`

  function handleTransition(taskId: string, toStatus: TaskStatus) {
    transitionTask.mutate({ taskId, toStatus }, { onSuccess: () => invalidateRitualQueries(queryClient) })
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return
    // Validação explícita (Story 14.10 review): `min`/`max` no `<input
    // type="date">` não bloqueia de forma confiável todo caminho de submissão
    // (ex.: colar um valor, digitação parcial) — o guard real vive aqui.
    if (formSelectedDay && (formSelectedDay < minDay || formSelectedDay > maxDay)) {
      setDayError('O dia deve pertencer ao mês exibido.')
      return
    }
    setDayError(null)
    createMonthlyTask.mutate(
      { monthFirst: loadedMonthFirst, title: trimmedTitle, scheduledDate: formSelectedDay || undefined },
      { onSuccess: () => monthlyLog.refetch() },
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

  return (
    <Box component="main" aria-label={`Arquivo — Mês de ${loadedMonthFirst}`} sx={{ p: 'var(--ds-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-3)' }}>
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
          {formatMonthTitle(loadedMonthFirst)}
        </Box>
        <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>{tasks.length} tarefas</Box>
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
              Fechado
            </Box>
            <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>Somente leitura</Box>
          </>
        )}
      </Box>

      {tasks.length === 0 ? (
        <Box sx={{ ...typography.body, color: 'var(--ds-ink-muted)' }}>Nenhuma tarefa neste mês.</Box>
      ) : (
        <>
          {withDate.map(([date, dayTasks]) => (
            <Box key={date} component="section" aria-label={`${capitalize(formatDayLabel(date, 'weekday'))}, ${formatDayLabel(date, 'day-month')}`}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 'var(--ds-space-2)', borderBottom: '1px solid var(--ds-border)', pb: 'var(--ds-space-1)', mb: 'var(--ds-space-1)' }}>
                <Box component="h2" sx={{ ...typography['section-title'], color: 'var(--ds-ink)', margin: 0 }}>
                  {formatDayLabel(date, 'day-month')}
                </Box>
                <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
                  {capitalize(formatDayLabel(date, 'weekday'))} · {dayTasks.length} tarefas
                </Box>
              </Box>
              {dayTasks.map((task, index) => renderTaskRow(task, index))}
            </Box>
          ))}

          {withoutDate.length > 0 && (
            <Box component="section" aria-label="Sem dia definido">
              <Box component="h2" sx={{ ...typography['section-title'], color: 'var(--ds-ink)', margin: 0, borderBottom: '1px solid var(--ds-border)', pb: 'var(--ds-space-1)', mb: 'var(--ds-space-1)' }}>
                Sem dia definido
              </Box>
              {withoutDate.map((task, index) => renderTaskRow(task, index))}
            </Box>
          )}
        </>
      )}

      {!isReadonly && (
        <Box
          component="form"
          onSubmit={handleSubmit}
          aria-label="Adicionar tarefa ao mês"
          sx={{ display: 'flex', gap: 'var(--ds-space-2)', alignItems: 'flex-end', flexWrap: 'wrap' }}
        >
          <TextField label="Título" size="small" value={title} onChange={(event) => setTitle(event.target.value)} />
          <TextField
            label="Dia (opcional)"
            type="date"
            size="small"
            value={formSelectedDay}
            onChange={(event) => {
              setFormSelectedDay(event.target.value)
              setDayError(null)
            }}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: minDay, max: maxDay } }}
          />
          <Button type="submit" sx={{ backgroundColor: 'var(--ds-primary)', color: 'var(--ds-on-primary)' }}>
            Adicionar
          </Button>
          {dayError && (
            <Box role="alert" sx={{ ...typography.body, color: 'var(--ds-danger)', width: '100%' }}>
              {dayError}
            </Box>
          )}
        </Box>
      )}

      {openTask && (
        <TaskDetailCard
          key={openTaskId}
          task={openTask}
          isSubtask={isOpenTaskSubtask}
          readonly={isReadonly}
          onClose={() => setOpenTaskId(null)}
          predecessor={openTaskId ? findPredecessor(tasks, openTaskId) : null}
        />
      )}
    </Box>
  )
}
