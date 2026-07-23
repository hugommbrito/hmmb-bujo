import { useState } from 'react'
import { BottomNavigation, BottomNavigationAction, Fab, Paper, Tooltip } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'

import TodayIcon from '@mui/icons-material/Today'
import EventNoteIcon from '@mui/icons-material/EventNote'
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder'
import AddIcon from '@mui/icons-material/Add'

import { BrainDumpBadge, BrainDumpCaptureSheet } from '../../features/braindump'
import { useOnlineStatus } from '../../shared/hooks/useOnlineStatus'
import { collections } from '../collections/registry'

// Abas de collection derivadas do registro (Story 12.3 — pixel-idêntico):
//  · Hábitos (aba 2) = entrada `habits` (label + ícone + path).
//  · Saúde (aba 3) = grupo `saude`; APENAS o path vem do registro (rota principal
//    da 1ª collection do grupo = `/health/metrics`). O label "Saúde" e o ícone
//    Favorite são chrome do grupo (não existe collection "Saúde"), então
//    permanecem hardcoded no JSX — ver Dev Notes / BottomNav.
const habitsTab = collections.find((c) => c.id === 'habits')
if (!habitsTab) throw new Error('Collection "habits" ausente no registro de collections')
const HabitsTabIcon = habitsTab.icon

const saudeEntry = collections
  .filter((c) => c.nav.group === 'saude')
  .sort((a, b) => a.nav.order - b.nav.order)[0]
if (!saudeEntry) throw new Error('Grupo de collections "saude" ausente no registro de collections')
const saudeEntryPath = saudeEntry.routes[0].path

const TAB_PATHS = ['/today', '/planner/week', `/${habitsTab.routes[0].path}`, `/${saudeEntryPath}`]

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
  const isOnline = useOnlineStatus()
  const [captureOpen, setCaptureOpen] = useState(false)

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
          <BottomNavigationAction label={habitsTab.nav.label} icon={<HabitsTabIcon />} />
          <BottomNavigationAction label="Saúde" icon={<FavoriteBorderIcon />} />
        </BottomNavigation>
      </Paper>

      <Tooltip title={isOnline ? '' : 'Sem conexão'}>
        {/* span necessário: Tooltip não recebe eventos de hover/foco de um
            elemento disabled (recipe oficial do MUI) — sem o span, o tooltip
            nunca apareceria justamente no estado offline em que é exigido. */}
        <span>
          <Fab
            aria-label={isOnline ? 'Captura rápida' : 'Captura rápida (sem conexão)'}
            disabled={!isOnline}
            onClick={() => setCaptureOpen(true)}
            sx={{
              position: 'fixed',
              bottom: 'calc(56px + env(safe-area-inset-bottom, 0px) + 16px)',
              right: 16,
              width: 52,
              height: 52,
            }}
          >
            <BrainDumpBadge>
              <AddIcon />
            </BrainDumpBadge>
          </Fab>
        </span>
      </Tooltip>
      <BrainDumpCaptureSheet open={captureOpen} onClose={() => setCaptureOpen(false)} />
    </>
  )
}
