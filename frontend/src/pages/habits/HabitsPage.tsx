import { Box } from '@mui/material'
import { HabitTracker } from '../../features/habits'
import { HabitsTabs } from './HabitsTabs'

// Story 6.2 — superfície /habits mostra o tracker de HOJE.
// Story 6.4 — vira um shell com abas "Hoje" (tracker) · "Histórico".
export function HabitsPage() {
  return (
    <Box component="main" aria-label="Hábitos" sx={{ p: 3 }}>
      <HabitsTabs />
      <HabitTracker />
    </Box>
  )
}
