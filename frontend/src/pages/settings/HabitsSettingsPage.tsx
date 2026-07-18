import { Box, Typography } from '@mui/material'
import { HabitsManager } from '../../features/habits'

export function HabitsSettingsPage() {
  return (
    <Box component="main" aria-label="Configurações — Hábitos" sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Hábitos
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Crie e ajuste seus hábitos e grupos. Mudanças de peso valem a partir de hoje.
      </Typography>
      <HabitsManager />
    </Box>
  )
}
