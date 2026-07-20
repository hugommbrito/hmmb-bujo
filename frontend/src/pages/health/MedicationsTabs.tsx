import { Tab, Tabs } from '@mui/material'
import { Link, useLocation } from 'react-router-dom'

// Abas "Hoje" · "Histórico" no topo da superfície de Medicamentos (Story 8.3, AC1 —
// mirror exato de HabitsTabs de 6.4 / HealthMetricsTabs de 7.3). NÃO é item de
// Sidebar/BottomNav: vive dentro das páginas (no <Outlet/>), então não afeta os 3
// testes compartilhados da casca (Sidebar/BottomNav/AppLayout).
export function MedicationsTabs() {
  const location = useLocation()
  const value =
    location.pathname === '/health/medications/history'
      ? '/health/medications/history'
      : '/health/medications'
  return (
    <Tabs value={value} aria-label="Seções de Medicamentos" sx={{ mb: 2 }}>
      <Tab
        label="Hoje"
        value="/health/medications"
        component={Link}
        to="/health/medications"
        sx={{ minHeight: 44 }}
      />
      <Tab
        label="Histórico"
        value="/health/medications/history"
        component={Link}
        to="/health/medications/history"
        sx={{ minHeight: 44 }}
      />
    </Tabs>
  )
}
