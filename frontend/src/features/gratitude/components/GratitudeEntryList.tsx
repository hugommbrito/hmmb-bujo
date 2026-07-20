import { Box, List, ListItem, ListItemText, Typography } from '@mui/material'
import type { GratitudeEntry } from '../types'

// Formatação hora+data (D9): `createdAt` é um INSTANTE ISO completo com offset →
// seguro em `new Date(createdAt).toLocaleTimeString(...)`; a data (coluna DATE) é
// formatada por SPLIT DE STRING (`formatDateBR`), nunca `new Date(iso)` (evita drift
// de fuso — mesma regra tz-safe de MedicationHistorySurface). Não confundir os dois.
function formatTimeBR(createdAt: string): string {
  return new Date(createdAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR')
}

interface GratitudeEntryListProps {
  entries: GratitudeEntry[]
}

export function GratitudeEntryList({ entries }: GratitudeEntryListProps) {
  return (
    <List disablePadding>
      {entries.map((entry) => (
        <ListItem key={entry.id} alignItems="flex-start" sx={{ px: 1 }} divider>
          <ListItemText
            primary={
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {entry.text}
              </Typography>
            }
            secondary={
              <Box component="span" sx={{ color: 'text.secondary' }}>
                {`${formatTimeBR(entry.createdAt)} · ${formatDateBR(entry.date)}`}
              </Box>
            }
          />
        </ListItem>
      ))}
    </List>
  )
}
