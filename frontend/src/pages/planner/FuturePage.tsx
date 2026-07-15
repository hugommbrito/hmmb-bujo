import { useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import {
  useCreateMonthlyTaskMutation,
  useFutureLogQuery,
  usePlaceRecurringTemplateMutation,
  useRecurringTemplatesQuery,
} from '../../features/bujo'
import type { RecurringTaskTemplate, Task } from '../../features/bujo'
import { FutureLogItemForm } from '../../features/bujo/components/FutureLogItemForm'
import { PlannerSkeleton } from '../../features/bujo/components/PlannerSkeleton'
import { RecurringPlacementDialog } from '../../features/bujo/components/RecurringPlacementDialog'
import { TaskRow } from '../../features/bujo/components/TaskRow'

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const MONTH_ABBREV = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
]

function formatMonthGroupTitle(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`
}

// Cálculo "agora" client-side, só para rótulo/filtro de UI — mesma técnica de
// MonthlyPage.tsx (currentMonthFirst()). Não é autoridade de negócio (essa
// continua sendo today_for no backend, AR-6). Duplicação intencional — ver
// Dev Notes "currentMonthFirst()/currentYear()" (Story 11.4).
function currentYear(): number {
  return new Date().getFullYear()
}

function currentMonthFirst(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

// EXPERIENCE.md §4.7 / decision-log: "(14)" quando tem dia, "— jul" quando é
// só mês (Future Log parcial, FR-1.2).
function formatDayPrefix(task: Task, month: number): string {
  if (task.scheduledDate) {
    const day = Number(task.scheduledDate.split('-')[2])
    return `(${day})`
  }
  return `— ${MONTH_ABBREV[month - 1]}`
}

export function FuturePage() {
  const futureLog = useFutureLogQuery()
  const createMonthlyTask = useCreateMonthlyTaskMutation()
  const year = currentYear()
  const pendingAnnualTemplates = useRecurringTemplatesQuery({
    active: true,
    recurrenceGroup: 'annual',
    unplacedYear: year,
  })
  const placeTemplate = usePlaceRecurringTemplateMutation()
  const [placingAnnualTemplate, setPlacingAnnualTemplate] = useState<RecurringTaskTemplate | null>(
    null,
  )

  if (futureLog.isPending) {
    return (
      <Box component="main" aria-label="Futuro" sx={{ p: 3 }}>
        <PlannerSkeleton />
      </Box>
    )
  }

  if (!futureLog.data) return null

  // Data escolhida (dialog dateFieldType="date") → monthFirst = mês/ano da
  // data escolhida. Em branco → mês corrente (Task 4.7, Story 11.4).
  function handleConfirmAnnualPlacement(dateValue: string) {
    if (!placingAnnualTemplate) return
    const scheduledDate = dateValue || undefined
    const monthFirst = scheduledDate ? `${scheduledDate.slice(0, 7)}-01` : currentMonthFirst()
    placeTemplate.mutate({ templateId: placingAnnualTemplate.id, monthFirst, scheduledDate })
    setPlacingAnnualTemplate(null)
  }

  // Molde "banner vazio = sem DOM" (RecurringPlacementSection.tsx:47) — AC3.
  const pendingAnnualSection = !pendingAnnualTemplates.isPending &&
    (pendingAnnualTemplates.data ?? []).length > 0 && (
      <Box sx={{ mt: 3 }}>
        <Typography variant="heading" sx={{ px: 1 }}>
          {`Anuais pendentes de ${year}`}
        </Typography>
        {(pendingAnnualTemplates.data ?? []).map((template) => (
          <Box
            key={template.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 1,
              py: 1,
            }}
          >
            <Typography variant="body2">{template.title}</Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setPlacingAnnualTemplate(template)}
            >
              Definir placement
            </Button>
          </Box>
        ))}
      </Box>
    )

  return (
    <Box component="main" aria-label="Futuro" sx={{ p: 3 }}>
      <FutureLogItemForm onAdd={(fields) => createMonthlyTask.mutate(fields)} />
      {futureLog.data.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1, mt: 2 }}>
          Nenhum item no futuro ainda.
        </Typography>
      ) : (
        futureLog.data.map((group) => (
          <Box key={`${group.year}-${group.month}`} sx={{ mt: 3 }}>
            <Typography variant="heading" sx={{ px: 1 }}>
              {formatMonthGroupTitle(group.year, group.month)}
            </Typography>
            {group.tasks.map((task) => (
              <Box key={task.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 40 }}>
                  {formatDayPrefix(task, group.month)}
                </Typography>
                <Box sx={{ flex: 1 }}>
                  <TaskRow task={task} />
                </Box>
              </Box>
            ))}
          </Box>
        ))
      )}
      {pendingAnnualSection}
      <RecurringPlacementDialog
        open={placingAnnualTemplate !== null}
        dateFieldType="date"
        template={placingAnnualTemplate}
        monthFirst={currentMonthFirst()}
        onClose={() => setPlacingAnnualTemplate(null)}
        onConfirm={handleConfirmAnnualPlacement}
      />
    </Box>
  )
}
