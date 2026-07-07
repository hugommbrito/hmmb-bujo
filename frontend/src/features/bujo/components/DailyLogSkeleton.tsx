import { Box, Skeleton } from '@mui/material'

const PLACEHOLDER_ROWS = 4

export function DailyLogSkeleton() {
  return (
    <Box aria-hidden="true">
      <Skeleton variant="rounded" height={36} sx={{ mb: 2 }} />
      {Array.from({ length: PLACEHOLDER_ROWS }).map((_, index) => (
        <Skeleton key={index} variant="rounded" height={36} sx={{ mb: 1 }} />
      ))}
    </Box>
  )
}
