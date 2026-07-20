import { Box, Typography } from '@mui/material'
import { MedicationsManager } from '../../features/medications'

export function MedicationsSettingsPage() {
  return (
    <Box component="main" aria-label="Configurações — Medicamentos" sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Medicamentos
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Cadastre medicamentos, doses por bloco, blocos de horário e médicos. Alteração
        válida a partir de hoje — registros anteriores preservados. Desative sem apagar.
      </Typography>
      <MedicationsManager />
    </Box>
  )
}
