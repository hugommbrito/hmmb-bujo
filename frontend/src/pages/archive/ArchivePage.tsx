import { Link as RouterLink } from 'react-router-dom'
import { Box, List, ListItemButton, ListItemText, Typography } from '@mui/material'
import { useArchiveQuery } from '../../features/bujo'
import type { ArchiveEntry } from '../../features/bujo'
import { capitalize, MONTH_NAMES_PT } from '../../features/bujo/monthNames'
import { PlannerSkeleton } from '../../features/bujo/components/PlannerSkeleton'

function formatEntryLabel(entry: ArchiveEntry): string {
  if (entry.type === 'weekly' && entry.weekStart) {
    return `Semana de ${entry.weekStart}`
  }
  if (entry.type === 'monthly' && entry.monthFirst) {
    const month = Number(entry.monthFirst.slice(5, 7))
    const year = entry.monthFirst.slice(0, 4)
    return `${capitalize(MONTH_NAMES_PT[month - 1])} ${year}`
  }
  return ''
}

function entryPath(entry: ArchiveEntry): string {
  return entry.type === 'weekly'
    ? `/archive/weekly/${entry.weekStart}`
    : `/archive/monthly/${entry.monthFirst}`
}

export function ArchivePage() {
  const archive = useArchiveQuery()

  if (archive.isPending) {
    return (
      <Box component="main" aria-label="Arquivo" sx={{ p: 3 }}>
        <PlannerSkeleton />
      </Box>
    )
  }

  if (!archive.data) return null

  return (
    <Box component="main" aria-label="Arquivo" sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Arquivo
      </Typography>
      {archive.data.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Nenhuma semana ou mês fechado ainda.
        </Typography>
      ) : (
        <List disablePadding component="div">
          {archive.data.map((entry) => (
            <ListItemButton
              key={`${entry.type}-${entry.weekStart ?? entry.monthFirst}`}
              component={RouterLink}
              to={entryPath(entry)}
            >
              <ListItemText
                primary={formatEntryLabel(entry)}
                secondary={entry.type === 'weekly' ? 'Semana' : 'Mês'}
              />
            </ListItemButton>
          ))}
        </List>
      )}
    </Box>
  )
}
