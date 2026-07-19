import { Box } from '@mui/material'
import { HabitTracker } from '../../features/habits'

// Story 6.2 — superfície /habits mostra o tracker de HOJE (histórico por data = 6.4).
export function HabitsPage() {
  return (
    <Box component="main" aria-label="Hábitos" sx={{ p: 3 }}>
      <HabitTracker />
    </Box>
  )
}
