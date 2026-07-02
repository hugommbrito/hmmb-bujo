import { useEffect, useState } from 'react'
import { useMatches } from 'react-router-dom'
import { Box } from '@mui/material'

export function RouteAnnouncer() {
  const matches = useMatches()
  const [message, setMessage] = useState('')

  const title = [...matches]
    .reverse()
    .map((match) => (match.handle as { title?: string } | undefined)?.title)
    .find((t): t is string => Boolean(t))

  useEffect(() => {
    if (title) setMessage(title)
  }, [title])

  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}
    >
      {message}
    </Box>
  )
}
