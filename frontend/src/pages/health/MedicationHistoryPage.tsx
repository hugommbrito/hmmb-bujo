import { Box } from '@mui/material'
import { MedicationHistorySurface } from '../../features/medications'
import { MedicationsTabs } from './MedicationsTabs'

// Story 8.3 — sub-rota /health/medications/history: histórico de adesão POR DATA
// (registro clínico + correção retroativa; sem gráfico/score — AD-07). Compõe só
// features/medications (fronteira §7.2). Mirror de HealthHistoryPage. O <main
// aria-label="Medicamentos"> é o mesmo landmark da aba "Hoje" (AC8).
export function MedicationHistoryPage() {
  return (
    <Box component="main" aria-label="Medicamentos" sx={{ p: 3 }}>
      <MedicationsTabs />
      <MedicationHistorySurface />
    </Box>
  )
}
