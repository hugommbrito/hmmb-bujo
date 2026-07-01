import { Box, Typography } from '@mui/material'

interface PlaceholderPageProps {
  title: string
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <Box component="main" aria-label={title} sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Em desenvolvimento.
      </Typography>
    </Box>
  )
}
