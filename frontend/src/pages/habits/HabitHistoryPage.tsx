import { Box } from '@mui/material'
import { HabitHistory } from '../../features/habits'
import { HabitsTabs } from './HabitsTabs'

// Story 6.4 — sub-rota /habits/history: histórico read-only (navegação por data +
// gráfico de evolução + grade acessível). Compõe só features/habits (fronteira §7.2).
export function HabitHistoryPage() {
  return (
    <Box component="main" aria-label="Hábitos" sx={{ p: 3 }}>
      <HabitsTabs />
      <HabitHistory />
    </Box>
  )
}
