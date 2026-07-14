import { Box, Button, Typography } from '@mui/material'
import { useRecurringTemplatesQuery } from '../api'
import type { RecurrenceGroup } from '../types'

interface RecurringPlacementSectionProps {
  recurrenceGroups: RecurrenceGroup[]
  onPlace: (templateId: string) => void
}

const RECURRENCE_GROUP_LABEL: Record<RecurrenceGroup, string> = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  annual: 'Anual',
}

// Mesmo molde "banner vazio = sem DOM" de MigrationBanner/CatchUpBanner — um
// único useRecurringTemplatesQuery({ active: true }) e filtro client-side por
// recurrenceGroups (Task 12.1: evita N requisições, uma por grupo). O
// componente não decide o container do placement (weekStart/monthFirst) —
// só lista e delega via onPlace, que a página (WeeklyPage/MonthlyPage) usa
// para abrir o diálogo de confirmação com os dados de container que só ela tem.
export function RecurringPlacementSection({
  recurrenceGroups,
  onPlace,
}: RecurringPlacementSectionProps) {
  const templates = useRecurringTemplatesQuery({ active: true })
  const filtered = (templates.data ?? []).filter((template) =>
    recurrenceGroups.includes(template.recurrenceGroup),
  )

  if (templates.isPending || filtered.length === 0) return null

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="heading" sx={{ px: 1 }}>
        Recorrentes
      </Typography>
      {filtered.map((template) => (
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
          <Typography variant="body2">
            {template.title} — {RECURRENCE_GROUP_LABEL[template.recurrenceGroup]}
          </Typography>
          <Button size="small" variant="outlined" onClick={() => onPlace(template.id)}>
            Definir placement
          </Button>
        </Box>
      ))}
    </Box>
  )
}
