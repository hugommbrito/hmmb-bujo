import { Box, Typography } from '@mui/material'
import { HealthMetricsManager } from '../../features/health'

export function HealthMetricsSettingsPage() {
  return (
    <Box component="main" aria-label="Configurações — Métricas de Saúde" sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Métricas de Saúde
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Crie e ajuste os campos que você quer rastrear. Desative sem apagar — o
        histórico é preservado.
      </Typography>
      <HealthMetricsManager />
    </Box>
  )
}
