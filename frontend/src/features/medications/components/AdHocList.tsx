import { Box, Typography } from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { doseSummary } from '../dayModel'
import type { MedicationDayEntry } from '../types'

// Seção Avulso/PRN read-only (AC7): lista os avulsos (sempre confirmados — ausência
// sem sentido, AD-07). Componente único compartilhado pela superfície diária (8.2) e
// pela de histórico (8.3): mesma renderização, uma só fonte (sem fork — Task 4).
export function AdHocList({ entries }: { entries: MedicationDayEntry[] }) {
  return (
    <Box sx={{ px: 1 }}>
      {entries.map((entry) => {
        const summary = doseSummary(entry.doseAtTime)
        return (
          <Box
            key={entry.id}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minHeight: 44 }}
          >
            <CheckCircleOutlineIcon fontSize="small" color="success" aria-hidden />
            <Typography variant="body2">
              {entry.medicationTitle}
              {summary ? ` · ${summary}` : ''}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}
