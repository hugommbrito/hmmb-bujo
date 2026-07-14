import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Typography, useMediaQuery } from '@mui/material'
import {
  RecurringPlacementSection,
  usePlaceRecurringTemplateMutation,
  useWeeklyLogQuery,
} from '../../features/bujo'
import { DayHeader } from '../../features/bujo/components/DayHeader'
import { PlannerSkeleton } from '../../features/bujo/components/PlannerSkeleton'
import { RecurringPlacementDialog } from '../../features/bujo/components/RecurringPlacementDialog'
import { TaskRow } from '../../features/bujo/components/TaskRow'
import { WeekDaySelector } from '../../features/bujo/components/WeekDaySelector'

export function WeeklyPage() {
  const { weekStart: routeWeekStart } = useParams<{ weekStart: string }>()
  const isArchiveView = Boolean(routeWeekStart)
  const weeklyLog = useWeeklyLogQuery(routeWeekStart)
  const placeTemplate = usePlaceRecurringTemplateMutation()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)
  const [placingTemplateId, setPlacingTemplateId] = useState<string | null>(null)

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
              selectedDay.tasks.map((task) => <TaskRow key={task.id} task={task} />)
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
                  day.tasks.map((task) => <TaskRow key={task.id} task={task} />)
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
            <TaskRow key={task.id} task={task} />
          ))}
        </Box>
      )}
      {!isArchiveView && (
        <>
          <RecurringPlacementSection
            recurrenceGroups={['weekly']}
            onPlace={setPlacingTemplateId}
          />
          <RecurringPlacementDialog
            open={placingTemplateId !== null}
            dateFieldType="date"
            onClose={() => setPlacingTemplateId(null)}
            onConfirm={(scheduledDate) => {
              if (!placingTemplateId) return
              placeTemplate.mutate({
                templateId: placingTemplateId,
                weekStart,
                scheduledDate: scheduledDate || undefined,
              })
              setPlacingTemplateId(null)
            }}
          />
        </>
      )}
    </Box>
  )
}
