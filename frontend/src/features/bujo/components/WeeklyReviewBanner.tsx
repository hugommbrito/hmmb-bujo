import { useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { useWeeklyReviewQueueQuery } from '../api'
import { MigrationFlow } from './MigrationFlow'

// Mesmo molde de MigrationBanner.tsx (Task 7.1) — query + banner condicional +
// MigrationFlow com flowType="weekly" (Task 6).
export function WeeklyReviewBanner() {
  const weeklyReviewQueue = useWeeklyReviewQueueQuery()
  const [flowOpen, setFlowOpen] = useState(false)
  const tasks = weeklyReviewQueue.data?.tasks ?? []

  if (weeklyReviewQueue.isPending || tasks.length === 0) return null

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
          Semana anterior tem {tasks.length} tarefas sem disposição. Revisar?
        </Typography>
        <Button variant="contained" onClick={() => setFlowOpen(true)}>
          Iniciar revisão
        </Button>
      </Box>
      <MigrationFlow
        queue={tasks}
        open={flowOpen}
        onClose={() => setFlowOpen(false)}
        flowType="weekly"
      />
    </>
  )
}
