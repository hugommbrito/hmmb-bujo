import { Tab, Tabs } from '@mui/material'
import { Link, useLocation } from 'react-router-dom'

// Abas "Hoje" · "Histórico" no topo da superfície de Hábitos (Story 6.4, Decisão 2).
// NÃO é item de Sidebar/BottomNav — vive dentro das páginas (no <Outlet/>), então
// não afeta os 3 testes compartilhados da casca (Sidebar/BottomNav/AppLayout).
export function HabitsTabs() {
  const location = useLocation()
  const value = location.pathname === '/habits/history' ? '/habits/history' : '/habits'
  return (
    <Tabs value={value} aria-label="Seções de Hábitos" sx={{ mb: 2 }}>
      <Tab label="Hoje" value="/habits" component={Link} to="/habits" />
      <Tab label="Histórico" value="/habits/history" component={Link} to="/habits/history" />
    </Tabs>
  )
}
