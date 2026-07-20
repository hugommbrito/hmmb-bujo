import { Tab, Tabs } from '@mui/material'
import { Link, useLocation } from 'react-router-dom'

// Abas "Hoje" · "Histórico" no topo da superfície de Gratidão (Story 9.2, AC6 — mirror
// exato de MedicationsTabs de 8.3). NÃO é item de Sidebar/BottomNav: vive dentro das
// páginas (no <Outlet/>), então não afeta os 3 testes compartilhados da casca
// (Sidebar/BottomNav/AppLayout) — são `<Link>` puro, sem TanStack Query.
export function GratitudeTabs() {
  const location = useLocation()
  const value =
    location.pathname === '/gratitude/history' ? '/gratitude/history' : '/gratitude'
  return (
    <Tabs value={value} aria-label="Seções do Diário de Gratidão" sx={{ mb: 2 }}>
      <Tab
        label="Hoje"
        value="/gratitude"
        component={Link}
        to="/gratitude"
        sx={{ minHeight: 44 }}
      />
      <Tab
        label="Histórico"
        value="/gratitude/history"
        component={Link}
        to="/gratitude/history"
        sx={{ minHeight: 44 }}
      />
    </Tabs>
  )
}
