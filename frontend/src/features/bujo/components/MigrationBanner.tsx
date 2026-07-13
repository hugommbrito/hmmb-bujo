import { useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { useMigrationQueueQuery } from '../api'
import { MigrationFlow } from './MigrationFlow'

// Único componente que `pages/daily` precisa importar — `MigrationCard`/
// `MigrationFlow` ficam internos à feature, compostos aqui.
export function MigrationBanner() {
  const migrationQueue = useMigrationQueueQuery()
  const [flowOpen, setFlowOpen] = useState(false)
  const tasks = migrationQueue.data?.tasks ?? []

  if (migrationQueue.isPending || tasks.length === 0) return null

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: (theme) => theme.palette.surfaces.header,
          borderRadius: '2px',
          px: 3,
          py: 1.5,
          mb: 2,
        }}
      >
        <Typography variant="body2">
          {tasks.length} tarefas pendentes de ontem. Iniciar migração?
        </Typography>
        <Button variant="contained" onClick={() => setFlowOpen(true)}>
          Iniciar
        </Button>
      </Box>
      <MigrationFlow queue={tasks} open={flowOpen} onClose={() => setFlowOpen(false)} />
    </>
  )
}
