import { Box, Typography } from '@mui/material'
import { RecurringTemplateManager } from '../../features/bujo'

export function SettingsPage() {
  return (
    <Box component="main" aria-label="Configurações" sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Configurações
      </Typography>
      <RecurringTemplateManager />
    </Box>
  )
}
