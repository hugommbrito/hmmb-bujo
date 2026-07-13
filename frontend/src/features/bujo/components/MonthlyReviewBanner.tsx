import { useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { useMonthlyReviewQueueQuery } from '../api'
import { MigrationFlow } from './MigrationFlow'

// Mesmo molde de MigrationBanner.tsx (Task 7.2) — query + banner condicional +
// MigrationFlow com flowType="monthly" (Task 6).
export function MonthlyReviewBanner() {
  const monthlyReviewQueue = useMonthlyReviewQueueQuery()
  const [flowOpen, setFlowOpen] = useState(false)
  const tasks = monthlyReviewQueue.data?.tasks ?? []

  if (monthlyReviewQueue.isPending || tasks.length === 0) return null

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
          Mês anterior tem {tasks.length} tarefas sem disposição. Revisar mês anterior?
        </Typography>
        <Button variant="contained" onClick={() => setFlowOpen(true)}>
          Revisar mês anterior
        </Button>
      </Box>
      <MigrationFlow
        queue={tasks}
        open={flowOpen}
        onClose={() => setFlowOpen(false)}
        flowType="monthly"
      />
    </>
  )
}
