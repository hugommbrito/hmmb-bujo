import { Box } from '@mui/material'
import { MedicationDaySurface } from '../../features/medications'

// Story 8.2 — superfície diária real de /health/medications (substitui o
// PlaceholderPage). Casca fina (molde HabitsPage): a query do dia vive DENTRO da
// página (no <Outlet/>), nunca na nav — protege os testes compartilhados da casca.
export function MedicationsPage() {
  return (
    <Box component="main" aria-label="Medicamentos" sx={{ p: 3 }}>
      <MedicationDaySurface />
    </Box>
  )
}
