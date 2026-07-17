import { useState, useEffect } from 'react'
import {
  Box,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useLocation, useNavigate } from 'react-router-dom'

import TodayIcon from '@mui/icons-material/Today'
import EventNoteIcon from '@mui/icons-material/EventNote'
import DateRangeIcon from '@mui/icons-material/DateRange'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import ScheduleIcon from '@mui/icons-material/Schedule'
import EventRepeatIcon from '@mui/icons-material/EventRepeat'
import RepeatIcon from '@mui/icons-material/Repeat'
import FavoriteOutlineIcon from '@mui/icons-material/FavoriteBorder'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import MedicationIcon from '@mui/icons-material/Medication'
import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt'
import InboxIcon from '@mui/icons-material/Inbox'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import SettingsIcon from '@mui/icons-material/Settings'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import MenuIcon from '@mui/icons-material/Menu'

import { BrainDumpBadge } from '../../features/braindump'

const DRAWER_WIDTH = 240
const COLLAPSED_WIDTH = 56

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
}

const topItems: NavItem[] = [
  { label: 'Hoje', path: '/today', icon: <TodayIcon /> },
]

const plannerItems: NavItem[] = [
  { label: 'Esta Semana', path: '/planner/week', icon: <DateRangeIcon /> },
  { label: 'Este Mês', path: '/planner/month', icon: <CalendarMonthIcon /> },
  { label: 'Futuro', path: '/planner/future', icon: <ScheduleIcon /> },
  { label: 'Recorrentes', path: '/planner/recurring', icon: <EventRepeatIcon /> },
]

const healthItems: NavItem[] = [
  { label: 'Métricas', path: '/health/metrics', icon: <ShowChartIcon /> },
  { label: 'Medicamentos', path: '/health/medications', icon: <MedicationIcon /> },
]

const bottomItems: NavItem[] = [
  { label: 'Hábitos', path: '/habits', icon: <RepeatIcon /> },
  { label: 'Gratidão', path: '/gratitude', icon: <SentimentSatisfiedAltIcon /> },
  { label: 'Brain Dump', path: '/brain-dump', icon: <BrainDumpBadge><InboxIcon /></BrainDumpBadge> },
  { label: 'Arquivo', path: '/archive', icon: <FolderOpenIcon /> },
]

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [plannerOpen, setPlannerOpen] = useState(true)
  const [healthOpen, setHealthOpen] = useState(true)

  useEffect(() => {
    if (collapsed) {
      setPlannerOpen(false)
      setHealthOpen(false)
    }
  }, [collapsed])

  const isActive = (path: string) => location.pathname === path
  const isGroupActive = (paths: NavItem[]) => paths.some((item) => location.pathname.startsWith(item.path))

  const itemSx = (active: boolean) => ({
    borderLeft: '3px solid',
    borderColor: active ? 'primary.main' : 'transparent',
    bgcolor: active ? (theme: { palette: { primary: { main: string } } }) => alpha(theme.palette.primary.main, 0.10) : 'transparent',
    justifyContent: collapsed ? 'center' : 'flex-start',
    px: collapsed ? 0 : 2,
    '&:hover': {
      bgcolor: (theme: { palette: { primary: { main: string } } }) => alpha(theme.palette.primary.main, 0.05),
    },
  })

  const renderItem = (item: NavItem) => {
    const active = isActive(item.path)
    return (
      <ListItemButton
        key={item.path}
        onClick={() => navigate(item.path)}
        sx={itemSx(active)}
        aria-current={active ? 'page' : undefined}
      >
        <ListItemIcon sx={{ minWidth: collapsed ? 0 : 40, justifyContent: 'center' }}>
          {item.icon}
        </ListItemIcon>
        {!collapsed && (
          <ListItemText
            primary={item.label}
            slotProps={{ primary: { fontWeight: active ? 700 : 400 } }}
          />
        )}
      </ListItemButton>
    )
  }

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: collapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: collapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH,
          overflowX: 'hidden',
          transition: 'width 0.2s',
          boxSizing: 'border-box',
        },
      }}
    >
      <Box component="nav" aria-label="Navegação principal">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-end',
            px: 1,
            py: 0.5,
            minHeight: 48,
          }}
        >
          <IconButton onClick={onToggle} aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'} size="small">
            {collapsed ? <MenuIcon /> : <MenuOpenIcon />}
          </IconButton>
        </Box>

        <List disablePadding component="div">
          {topItems.map(renderItem)}

          {/* Grupo Planner */}
          <ListItemButton
            onClick={() => !collapsed && setPlannerOpen((p) => !p)}
            sx={{
              ...itemSx(isGroupActive(plannerItems)),
              cursor: collapsed ? 'default' : 'pointer',
            }}
          >
            <ListItemIcon sx={{ minWidth: collapsed ? 0 : 40, justifyContent: 'center' }}>
              <EventNoteIcon />
            </ListItemIcon>
            {!collapsed && (
              <>
                <ListItemText
                  primary="Planner"
                  slotProps={{ primary: { fontWeight: isGroupActive(plannerItems) ? 700 : 400 } }}
                />
                {plannerOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </>
            )}
          </ListItemButton>
          <Collapse in={plannerOpen && !collapsed} timeout="auto" unmountOnExit>
            <List disablePadding component="div" sx={{ pl: 2 }}>
              {plannerItems.map(renderItem)}
            </List>
          </Collapse>

          {bottomItems.slice(0, 1).map(renderItem)}

          {/* Grupo Saúde */}
          <ListItemButton
            onClick={() => !collapsed && setHealthOpen((h) => !h)}
            sx={{
              ...itemSx(isGroupActive(healthItems)),
              cursor: collapsed ? 'default' : 'pointer',
            }}
          >
            <ListItemIcon sx={{ minWidth: collapsed ? 0 : 40, justifyContent: 'center' }}>
              <FavoriteOutlineIcon />
            </ListItemIcon>
            {!collapsed && (
              <>
                <ListItemText
                  primary="Saúde"
                  slotProps={{ primary: { fontWeight: isGroupActive(healthItems) ? 700 : 400 } }}
                />
                {healthOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </>
            )}
          </ListItemButton>
          <Collapse in={healthOpen && !collapsed} timeout="auto" unmountOnExit>
            <List disablePadding component="div" sx={{ pl: 2 }}>
              {healthItems.map(renderItem)}
            </List>
          </Collapse>

          {bottomItems.slice(1).map(renderItem)}

          <Divider sx={{ my: 1 }} />

          {renderItem({ label: 'Configurações', path: '/settings', icon: <SettingsIcon /> })}
        </List>
      </Box>
    </Drawer>
  )
}
