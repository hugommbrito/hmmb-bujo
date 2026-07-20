import { Tab, Tabs } from '@mui/material'
import { Link, useLocation } from 'react-router-dom'

// Abas "Registro" · "Histórico" no topo da superfície de Métricas de Saúde
// (Story 7.3, Decisão 1 — espelha HabitsTabs de 6.4). NÃO é item de Sidebar/
// BottomNav: vive dentro das páginas (no <Outlet/>), então não afeta os 3 testes
// compartilhados da casca (Sidebar/BottomNav/AppLayout).
export function HealthMetricsTabs() {
  const location = useLocation()
  const value =
    location.pathname === '/health/metrics/history'
      ? '/health/metrics/history'
      : '/health/metrics'
  return (
    <Tabs value={value} aria-label="Seções de Métricas de Saúde" sx={{ mb: 2 }}>
      <Tab label="Registro" value="/health/metrics" component={Link} to="/health/metrics" />
      <Tab
        label="Histórico"
        value="/health/metrics/history"
        component={Link}
        to="/health/metrics/history"
      />
    </Tabs>
  )
}
