import { Box } from '@mui/material'
import { GratitudeHistorySurface } from '../../features/gratitude'
import { GratitudeTabs } from './GratitudeTabs'

// Story 9.2 — sub-rota /gratitude/history: histórico navegável POR MÊS (agrupado por dia)
// e POR DATA específica (read-only, sem composer/edição). Compõe só features/gratitude
// (fronteira §7.2). Mirror de MedicationHistoryPage. O <main aria-label="Diário de
// Gratidão"> é o mesmo landmark da aba "Hoje" (AC6). O RouteAnnouncer lê o handle.title.
export function GratitudeHistoryPage() {
  return (
    <Box component="main" aria-label="Diário de Gratidão" sx={{ p: 3 }}>
      <GratitudeTabs />
      <GratitudeHistorySurface />
    </Box>
  )
}
