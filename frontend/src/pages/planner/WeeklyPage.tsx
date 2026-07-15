import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Button, MenuItem, Select, TextField, Typography, useMediaQuery } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import {
  RecurringPlacementSection,
  useCreateWeeklyTaskMutation,
  usePlaceRecurringTemplateMutation,
  useWeeklyLogQuery,
} from '../../features/bujo'
import type { RecurringTaskTemplate } from '../../features/bujo'
import { DayHeader } from '../../features/bujo/components/DayHeader'
import { PlannerSkeleton } from '../../features/bujo/components/PlannerSkeleton'
import { RecurringPlacementDialog } from '../../features/bujo/components/RecurringPlacementDialog'
import { TaskDetailPanel } from '../../features/bujo/components/TaskDetailPanel'
import { TaskRow } from '../../features/bujo/components/TaskRow'
import { WeekDaySelector } from '../../features/bujo/components/WeekDaySelector'
import { findTaskById } from '../../features/bujo/taskTree'

/**
 * `date` é uma data ISO ("YYYY-MM-DD") — mesma técnica local de
 * `WeekDaySelector.formatDayChipLabel`/`DayHeader.formatDayHeaderDate` (não
 * extraída pra util compartilhado ainda, mesma decisão da Story 11.4).
 */
function formatDaySelectLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
  const parts = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit' }).formatToParts(
    parsed,
  )
  const part = (type: string) => parts.find((p) => p.type === type)?.value.replace('.', '') ?? ''
  return `${part('weekday')} ${part('day')}`.toUpperCase()
}

export function WeeklyPage() {
  const { weekStart: routeWeekStart } = useParams<{ weekStart: string }>()
  const isArchiveView = Boolean(routeWeekStart)
  const weeklyLog = useWeeklyLogQuery(routeWeekStart)
  const placeTemplate = usePlaceRecurringTemplateMutation()
  const createWeeklyTask = useCreateWeeklyTaskMutation()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)
  const [placingTemplate, setPlacingTemplate] = useState<RecurringTaskTemplate | null>(null)
  const [title, setTitle] = useState('')
  const [formSelectedDay, setFormSelectedDay] = useState('')
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)

  if (weeklyLog.isPending) {
    return (
      <Box component="main" aria-label="Esta Semana" sx={{ p: 3 }}>
        <PlannerSkeleton />
      </Box>
    )
  }

  if (!weeklyLog.data) return null

  const { days, unscheduled, weekStart, closed } = weeklyLog.data
  const selectedDay = days[selectedDayIndex]

  // Dedup (AC1): templates já colocados nesta semana, via `sourceTemplate` das
  // tarefas de todos os dias + as sem dia.
  const placedTemplateIds = new Set(
    [...days.flatMap((day) => day.tasks), ...unscheduled]
      .map((task) => task.sourceTemplate)
      .filter((id): id is string => Boolean(id)),
  )
  // monthFirst do calendário = 1º dia do mês que contém a segunda-feira da
  // semana. Semana de virada (AD-05) mostra o mês da segunda — densidade é
  // apenas informativa, então a escolha é aceitável (Dev Notes / Task 8.2).
  const monthFirst = `${weekStart.slice(0, 7)}-01`

  const allTasks = [...days.flatMap((day) => day.tasks), ...unscheduled]
  const openTask = openTaskId ? findTaskById(allTasks, openTaskId) : undefined
  const isOpenTaskSubtask = openTaskId ? !allTasks.some((task) => task.id === openTaskId) : false
  const onOpenDetail = !isArchiveView && !closed ? setOpenTaskId : undefined

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    createWeeklyTask.mutate(
      {
        weekStart,
        title: trimmedTitle,
        scheduledDate: formSelectedDay || undefined,
      },
      // O query key ativo desta página é o sentinel 'current' (routeWeekStart
      // é undefined quando !isArchiveView) — a invalidação da mutação usa
      // `weekStart` explícito (keys.ts:15), então não alcança este key.
      // Mesmo descompasso 'current' vs explícito já corrigido em MonthlyPage
      // (Task 7.3 original assumiu, incorretamente, que não se aplicava aqui
      // — achado desta verificação manual). Refetch direto garante a semana
      // corrente atualizada.
      { onSuccess: () => weeklyLog.refetch() },
    )
    setTitle('')
    setFormSelectedDay('')
  }

  return (
    <Box
      component="main"
      aria-label={isArchiveView ? `Arquivo — Semana de ${weekStart}` : 'Esta Semana'}
      sx={{ p: 3 }}
    >
      {closed && (
        <Typography variant="heading" sx={{ px: 1, mb: 1 }}>
          Fechada
        </Typography>
      )}
      {isMobile ? (
        <>
          <WeekDaySelector
            days={days}
            selectedIndex={selectedDayIndex}
            onSelect={setSelectedDayIndex}
          />
          <DayHeader
            logDate={selectedDay.date}
            pendingCount={selectedDay.tasks.filter((task) => task.status === 'pending').length}
          >
            {selectedDay.tasks.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ px: 3, py: 2 }}>
                Nenhuma tarefa neste dia.
              </Typography>
            ) : (
              selectedDay.tasks.map((task) => (
                <TaskRow key={task.id} task={task} onOpenDetail={onOpenDetail} />
              ))
            )}
          </DayHeader>
        </>
      ) : (
        // 7 dias lado a lado, comprimindo proporcionalmente — `minWidth: 0`
        // em cada coluna evita o scroll horizontal invisível (EXPERIENCE.md
        // §responsividade).
        <Box sx={{ display: 'flex', gap: 1 }}>
          {days.map((day) => (
            <Box key={day.date} sx={{ flex: '1 1 0', minWidth: 0 }}>
              <DayHeader
                logDate={day.date}
                pendingCount={day.tasks.filter((task) => task.status === 'pending').length}
              >
                {day.tasks.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 1 }}>
                    —
                  </Typography>
                ) : (
                  day.tasks.map((task) => (
                    <TaskRow key={task.id} task={task} onOpenDetail={onOpenDetail} />
                  ))
                )}
              </DayHeader>
            </Box>
          ))}
        </Box>
      )}
      {unscheduled.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="heading" sx={{ px: 1 }}>
            Sem dia definido
          </Typography>
          {unscheduled.map((task) => (
            <TaskRow key={task.id} task={task} onOpenDetail={onOpenDetail} />
          ))}
        </Box>
      )}
      {!isArchiveView && !closed && (
        <>
          <Box
            component="form"
            onSubmit={handleSubmit}
            aria-label="Adicionar tarefa à semana"
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
                  {formatDaySelectLabel(day.date)}
                </MenuItem>
              ))}
            </Select>
            <Button type="submit" startIcon={<AddIcon />}>
              Adicionar
            </Button>
          </Box>
          <RecurringPlacementSection
            recurrenceGroups={['weekly']}
            onPlace={setPlacingTemplate}
            placedTemplateIds={placedTemplateIds}
          />
          <RecurringPlacementDialog
            open={placingTemplate !== null}
            dateFieldType="date"
            template={placingTemplate}
            monthFirst={monthFirst}
            onClose={() => setPlacingTemplate(null)}
            onConfirm={(scheduledDate) => {
              if (!placingTemplate) return
              placeTemplate.mutate({
                templateId: placingTemplate.id,
                weekStart,
                scheduledDate: scheduledDate || undefined,
              })
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
