import { useEffect, useState, type FormEvent } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { Box, Button, IconButton, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import {
  RecurringPlacementSection,
  useCreateMonthlyTaskMutation,
  useMonthlyLogQuery,
  usePlaceRecurringTemplateMutation,
  useUpdateTaskMutation,
} from '../../features/bujo'
import type { RecurrenceGroup, RecurringTaskTemplate, Task } from '../../features/bujo'
import { DayHeader } from '../../features/bujo/components/DayHeader'
import { PlannerSkeleton } from '../../features/bujo/components/PlannerSkeleton'
import { RecurringPlacementDialog } from '../../features/bujo/components/RecurringPlacementDialog'
import { TaskDetailPanel } from '../../features/bujo/components/TaskDetailPanel'
import { TaskRow } from '../../features/bujo/components/TaskRow'
import { capitalize, MONTH_NAMES_PT } from '../../features/bujo/monthNames'
import { findTaskById } from '../../features/bujo/taskTree'

// Mês corrente calculado no frontend a partir de `new Date()` local — cálculo
// de UI (mesma técnica de MigrationCard), só usado para decidir a ordem/rótulo
// da seção `withoutDate` (Task 8.1). Autoridade de "mês corrente" de verdade
// é `today_for` no backend.
function currentMonthFirst(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

// 'YYYY-MM-01' + N meses (Task 4.3) — reusa `currentMonthFirst()` acima como
// a única autoridade de "mês corrente" desta página.
function addMonthsIso(monthFirstIso: string, delta: number): string {
  const [year, month] = monthFirstIso.split('-').map(Number)
  const date = new Date(year, month - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
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
    if (existing) {
      existing.push(task)
    } else {
      byDate.set(task.scheduledDate, [task])
    }
  }

  const withDate = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))
  return { withDate, withoutDate }
}

export function MonthlyPage() {
  const { monthFirst: routeMonthFirst } = useParams<{ monthFirst: string }>()
  const isArchiveView = Boolean(routeMonthFirst)
  const monthlyLog = useMonthlyLogQuery(routeMonthFirst)
  const createMonthlyTask = useCreateMonthlyTaskMutation()
  const updateTask = useUpdateTaskMutation()
  const placeTemplate = usePlaceRecurringTemplateMutation()
  const [title, setTitle] = useState('')
  const [day, setDay] = useState('')
  const [placingTemplate, setPlacingTemplate] = useState<RecurringTaskTemplate | null>(null)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)

  // `/planner/month` e `/archive/monthly/:monthFirst` renderizam o mesmo
  // componente na mesma posição da árvore — navegar entre meses via
  // anterior/próximo (Story 11.11, Task 4) não remonta `MonthlyPage`, então
  // sem este reset o rascunho do formulário/painel aberto de um mês vazaria
  // para o próximo.
  useEffect(() => {
    setTitle('')
    setDay('')
    setPlacingTemplate(null)
    setOpenTaskId(null)
  }, [routeMonthFirst])

  if (monthlyLog.isPending) {
    return (
      <Box component="main" aria-label="Este Mês" sx={{ p: 3 }}>
        <PlannerSkeleton />
      </Box>
    )
  }

  if (!monthlyLog.data) return null

  const { monthFirst, tasks, closed } = monthlyLog.data
  const { withDate, withoutDate } = groupTasksByScheduledDate(tasks)
  // Task 8.1: mês exibido é o mês corrente → seção `withoutDate` vem antes de
  // `withDate`, com o rótulo "Itens do Future Log para [Mês]" (itens que já
  // chegaram fisicamente ao Monthly Log corrente, Future Log = monthly_log
  // futuro, AD-03) aguardando confirmação de data. Qualquer outro mês mantém
  // o comportamento pré-4.3 (withDate primeiro, "Sem dia definido" depois).
  const isCurrentMonth = monthFirst === currentMonthFirst()
  const recurrenceGroups: RecurrenceGroup[] = isCurrentMonth ? ['monthly'] : []
  // Dedup (AC1): templates que já têm instância neste mês (via `sourceTemplate`).
  const placedTemplateIds = new Set(
    tasks.map((task) => task.sourceTemplate).filter((id): id is string => Boolean(id)),
  )
  const withoutDateTitle = isCurrentMonth
    ? `Itens do Future Log para ${capitalize(MONTH_NAMES_PT[Number(monthFirst.slice(5, 7)) - 1])}`
    : 'Sem dia definido'

  const openTask = openTaskId ? findTaskById(tasks, openTaskId) : undefined
  const isOpenTaskSubtask = openTaskId ? !tasks.some((task) => task.id === openTaskId) : false
  const onOpenDetail = !closed ? setOpenTaskId : undefined

  // Navegação anterior/próximo (AC1) — reusa `isCurrentMonth`/`currentMonthFirst()`.
  const previousMonthFirst = addMonthsIso(monthFirst, -1)
  const nextMonthFirst = addMonthsIso(monthFirst, 1)
  const nextMonthIsCurrent = nextMonthFirst === currentMonthFirst()

  function handleConfirmScheduledDate(taskId: string, value: string) {
    if (!value) return
    updateTask.mutate({ taskId, scheduledDate: value })
  }

  const withoutDateSection = withoutDate.length > 0 && (
    <Box sx={{ mt: 3 }}>
      <Typography variant="heading" sx={{ px: 1 }}>
        {withoutDateTitle}
      </Typography>
      {withoutDate.map((task) =>
        isCurrentMonth ? (
          <Box key={task.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1 }}>
              <TaskRow task={task} onOpenDetail={onOpenDetail} />
            </Box>
            <TextField
              label="Confirmar data"
              type="date"
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              onChange={(event) => handleConfirmScheduledDate(task.id, event.target.value)}
            />
          </Box>
        ) : (
          <TaskRow key={task.id} task={task} onOpenDetail={onOpenDetail} />
        ),
      )}
    </Box>
  )

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    const scheduledDate = day ? `${monthFirst.slice(0, 7)}-${day.padStart(2, '0')}` : undefined
    createMonthlyTask.mutate(
      { monthFirst, title: trimmedTitle, scheduledDate },
      // O query key ativo desta página é o sentinel 'current' (Task 7.1) —
      // a invalidação da mutação usa `monthFirst` explícito, então não
      // alcança este key. Refetch direto garante o mês corrente atualizado.
      { onSuccess: () => monthlyLog.refetch() },
    )
    setTitle('')
    setDay('')
  }

  return (
    <Box
      component="main"
      aria-label={isArchiveView ? `Arquivo — Mês de ${monthFirst}` : 'Este Mês'}
      sx={{ p: 3 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <IconButton
          component={RouterLink}
          to={`/archive/monthly/${previousMonthFirst}`}
          aria-label="Mês anterior"
        >
          <NavigateBeforeIcon />
        </IconButton>
        {!isCurrentMonth && (
          <IconButton
            component={RouterLink}
            to={nextMonthIsCurrent ? '/planner/month' : `/archive/monthly/${nextMonthFirst}`}
            aria-label="Próximo mês"
          >
            <NavigateNextIcon />
          </IconButton>
        )}
      </Box>
      {closed && (
        <Typography variant="heading" sx={{ px: 1, mb: 1 }}>
          Fechado
        </Typography>
      )}
      {!closed && !isCurrentMonth && (
        <Typography variant="body-sm" component="div" sx={{ px: 1, mb: 1 }}>
          Você está vendo um mês passado.
        </Typography>
      )}
      {!isCurrentMonth && (
        <Button component={RouterLink} to="/planner/month" size="small" sx={{ px: 1, mb: 1 }}>
          Voltar para o mês atual
        </Button>
      )}
      {tasks.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1, mb: 2 }}>
          Nenhuma tarefa neste mês.
        </Typography>
      ) : isCurrentMonth ? (
        <>
          {withoutDateSection}
          {withDate.map(([date, dayTasks]) => (
            <DayHeader
              key={date}
              logDate={date}
              pendingCount={dayTasks.filter((task) => task.status === 'pending').length}
              linkToDaily
            >
              {dayTasks.map((task) => (
                <TaskRow key={task.id} task={task} onOpenDetail={onOpenDetail} />
              ))}
            </DayHeader>
          ))}
        </>
      ) : (
        <>
          {withDate.map(([date, dayTasks]) => (
            <DayHeader
              key={date}
              logDate={date}
              pendingCount={dayTasks.filter((task) => task.status === 'pending').length}
              linkToDaily
            >
              {dayTasks.map((task) => (
                <TaskRow key={task.id} task={task} onOpenDetail={onOpenDetail} />
              ))}
            </DayHeader>
          ))}
          {withoutDateSection}
        </>
      )}
      {!closed && (
        <>
          <Box
            component="form"
            onSubmit={handleSubmit}
            aria-label="Adicionar tarefa ao mês"
            sx={{
              display: 'flex',
              gap: 1,
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              px: 1,
              py: 1,
              mt: 3,
            }}
          >
            <TextField
              label="Título"
              size="small"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <TextField
              label="Dia (opcional)"
              type="number"
              size="small"
              value={day}
              onChange={(event) => setDay(event.target.value)}
              slotProps={{ htmlInput: { min: 1, max: 31 } }}
              sx={{ width: 140 }}
            />
            <Button type="submit" startIcon={<AddIcon />}>
              Adicionar
            </Button>
          </Box>
          <RecurringPlacementSection
            recurrenceGroups={recurrenceGroups}
            onPlace={setPlacingTemplate}
            placedTemplateIds={placedTemplateIds}
          />
          <RecurringPlacementDialog
            open={placingTemplate !== null}
            dateFieldType="day"
            template={placingTemplate}
            monthFirst={monthFirst}
            onClose={() => setPlacingTemplate(null)}
            onConfirm={(dayValue) => {
              if (!placingTemplate) return
              const scheduledDate = dayValue
                ? `${monthFirst.slice(0, 7)}-${dayValue.padStart(2, '0')}`
                : undefined
              placeTemplate.mutate({ templateId: placingTemplate.id, monthFirst, scheduledDate })
              setPlacingTemplate(null)
            }}
          />
        </>
      )}
      <TaskDetailPanel
        key={openTaskId ?? 'none'}
        task={openTask}
        isSubtask={isOpenTaskSubtask}
        onClose={() => setOpenTaskId(null)}
      />
    </Box>
  )
}
