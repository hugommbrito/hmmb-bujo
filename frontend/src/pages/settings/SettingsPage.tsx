import { Box, Link, List, ListItem, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

// Hub mínimo de Configurações (Story 6.1): por ora só "Hábitos", para que o
// caminho Configurações → Hábitos fique navegável de ponta a ponta.
export function SettingsPage() {
  return (
    <Box component="main" aria-label="Configurações" sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Configurações
      </Typography>
      <List>
        <ListItem disableGutters sx={{ minHeight: 44 }}>
          <Link component={RouterLink} to="/settings/habits">
            Hábitos
          </Link>
        </ListItem>
      </List>
    </Box>
  )
}
