import { BottomNavigation, BottomNavigationAction, Fab, Paper } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'

import TodayIcon from '@mui/icons-material/Today'
import EventNoteIcon from '@mui/icons-material/EventNote'
import RepeatIcon from '@mui/icons-material/Repeat'
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder'
import AddIcon from '@mui/icons-material/Add'

const TAB_PATHS = ['/today', '/planner/week', '/habits', '/health/metrics']

function getCurrentTab(pathname: string): number {
  if (pathname.startsWith('/today')) return 0
  if (pathname.startsWith('/planner')) return 1
  if (pathname.startsWith('/habits')) return 2
  if (pathname.startsWith('/health')) return 3
  return -1
}

export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const currentTab = getCurrentTab(location.pathname)

  return (
    <>
      <Paper
        component="nav"
        aria-label="Navegação mobile"
        elevation={0}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 'appBar',
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <BottomNavigation
          value={currentTab}
          onChange={(_, newValue: number) => navigate(TAB_PATHS[newValue])}
          sx={{ pb: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <BottomNavigationAction label="Hoje" icon={<TodayIcon />} />
          <BottomNavigationAction label="Planner" icon={<EventNoteIcon />} />
          <BottomNavigationAction label="Hábitos" icon={<RepeatIcon />} />
          <BottomNavigationAction label="Saúde" icon={<FavoriteBorderIcon />} />
        </BottomNavigation>
      </Paper>

      <Fab
        aria-label="Captura rápida (em breve)"
        disabled
        sx={{
          position: 'fixed',
          bottom: 'calc(56px + env(safe-area-inset-bottom, 0px) + 16px)',
          right: 16,
          width: 52,
          height: 52,
        }}
      >
        <AddIcon />
      </Fab>
    </>
  )
}
