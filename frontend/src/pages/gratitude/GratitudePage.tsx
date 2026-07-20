import { Box } from '@mui/material'
import { GratitudeDaySurface } from '../../features/gratitude'
import { GratitudeTabs } from './GratitudeTabs'

// Story 9.1/9.2 — casca fina (§7.2): a query do dia vive DENTRO da surface (sob o
// <Outlet/>), nunca na casca de navegação — protege os testes compartilhados
// (AppLayout/router/RouteAnnouncer). O RouteAnnouncer lê o `handle.title` da rota.
// As abas "Hoje"/"Histórico" (9.2) vivem na página, não na nav (AC6).
export function GratitudePage() {
  return (
    <Box component="main" aria-label="Diário de Gratidão" sx={{ p: 3 }}>
      <GratitudeTabs />
      <GratitudeDaySurface />
    </Box>
  )
}
