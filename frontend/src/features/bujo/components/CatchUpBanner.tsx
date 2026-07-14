import { useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { useCatchUpQueueQuery } from '../api'
import { CatchUpFlow } from './CatchUpFlow'

// Mesmo molde de MigrationBanner.tsx/WeeklyReviewBanner.tsx/MonthlyReviewBanner.tsx —
// único componente que `pages/daily` precisa importar.
export function CatchUpBanner() {
  const catchUpQueue = useCatchUpQueueQuery()
  const [flowOpen, setFlowOpen] = useState(false)
  const monthlyTasks = catchUpQueue.data?.monthlyTasks ?? []
  const weeklyTasks = catchUpQueue.data?.weeklyTasks ?? []
  const dailyTasks = catchUpQueue.data?.dailyTasks ?? []
  const total = monthlyTasks.length + weeklyTasks.length + dailyTasks.length

  if (catchUpQueue.isPending || total === 0) return null

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
          {total} tarefas sem disposição de dias, semanas ou meses anteriores. Iniciar Catch-Up?
        </Typography>
        <Button variant="contained" onClick={() => setFlowOpen(true)}>
          Iniciar Catch-Up
        </Button>
      </Box>
      <CatchUpFlow
        monthlyTasks={monthlyTasks}
        weeklyTasks={weeklyTasks}
        dailyTasks={dailyTasks}
        open={flowOpen}
        onClose={() => setFlowOpen(false)}
      />
    </>
  )
}
