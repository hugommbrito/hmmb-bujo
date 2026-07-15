import { Box, Typography } from '@mui/material'
import { RecurringTemplateManager } from '../../features/bujo'

export function RecurringPage() {
  return (
    <Box component="main" aria-label="Recorrentes" sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Recorrentes
      </Typography>
      <RecurringTemplateManager />
    </Box>
  )
}
