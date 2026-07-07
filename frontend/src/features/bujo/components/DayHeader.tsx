import { useState, type ReactNode } from 'react'
import { Box, IconButton, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

interface DayHeaderProps {
  logDate: string
  pendingCount: number
  children: ReactNode
}

/**
 * `logDate` é uma data ISO ("YYYY-MM-DD") sem hora — parsear os componentes
 * manualmente evita que `new Date(string)` interprete a string como
 * UTC-midnight e desloque o dia exibido em fusos negativos (ex. UTC-3).
 */
function formatDayHeaderDate(logDate: string): string {
  const [year, month, day] = logDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const parts = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).formatToParts(date)
  const part = (type: string) => parts.find((p) => p.type === type)?.value.replace('.', '') ?? ''
  return `${part('weekday')}, ${part('day')} ${part('month')}`.toUpperCase()
}

export function DayHeader({ logDate, pendingCount, children }: DayHeaderProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: (theme) => theme.palette.surfaces.header,
          px: 3,
          py: 1,
          borderRadius: '2px',
        }}
      >
        <Typography variant="heading">{formatDayHeaderDate(logDate)}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body-sm" color="text.secondary">
            {pendingCount} pendentes
          </Typography>
          <IconButton
            size="small"
            aria-label={collapsed ? 'Expandir lista de tarefas' : 'Colapsar lista de tarefas'}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((prev) => !prev)}
          >
            <ExpandMoreIcon
              fontSize="small"
              sx={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 120ms ease' }}
            />
          </IconButton>
        </Box>
      </Box>
      {!collapsed && children}
    </Box>
  )
}
