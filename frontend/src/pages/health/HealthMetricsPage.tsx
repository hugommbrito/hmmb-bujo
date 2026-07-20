import { Box } from '@mui/material'
import { HealthMetricsLog } from '../../features/health'
import { HealthMetricsTabs } from './HealthMetricsTabs'

// Story 7.2 — superfície própria /health/metrics: o log do ritual matinal
// (ontem no topo, hoje abaixo). Mirror de HabitsPage. A entrada de nav
// "Saúde › Métricas" já aponta para cá (Sidebar/BottomNav) desde antes.
// Story 7.3 — vira um shell com abas "Registro" (o log) · "Histórico".
export function HealthMetricsPage() {
  return (
    <Box component="main" aria-label="Métricas de Saúde" sx={{ p: 3 }}>
      <HealthMetricsTabs />
      <HealthMetricsLog />
    </Box>
  )
}
