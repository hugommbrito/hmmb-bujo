import { Box } from '@mui/material'
import { MedicationDaySurface } from '../../features/medications'
import { MedicationsTabs } from './MedicationsTabs'

// Story 8.2/8.3 — aba "Hoje" de /health/medications (superfície diária). Casca fina
// (molde HabitsPage): a query do dia vive DENTRO da página (no <Outlet/>), nunca na
// nav — protege os testes compartilhados da casca. As abas "Hoje"/"Histórico" (8.3)
// vivem na página, não na nav (AC1).
export function MedicationsPage() {
  return (
    <Box component="main" aria-label="Medicamentos" sx={{ p: 3 }}>
      <MedicationsTabs />
      <MedicationDaySurface />
    </Box>
  )
}
