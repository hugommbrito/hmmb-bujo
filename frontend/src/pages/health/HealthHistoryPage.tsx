import { Box } from '@mui/material'
import { HealthHistory } from '../../features/health'
import { HealthMetricsTabs } from './HealthMetricsTabs'

// Story 7.3 — sub-rota /health/metrics/history: histórico read-only em três
// visualizações (tabela dia a dia + gráfico de evolução + dashboard de período).
// Compõe só features/health (fronteira §7.2). Mirror de HabitHistoryPage.
export function HealthHistoryPage() {
  return (
    <Box component="main" aria-label="Métricas de Saúde" sx={{ p: 3 }}>
      <HealthMetricsTabs />
      <HealthHistory />
    </Box>
  )
}
