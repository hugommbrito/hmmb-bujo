import { useState, useMemo } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { queryClient } from '../../api/queryClient'
import { createBujoTheme } from '../../theme'
import { ColorModeContext } from './ColorModeContext'

const STORAGE_KEY = 'bujo-color-scheme'

function readStoredMode(): 'light' | 'dark' {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

interface ProvidersProps { children: React.ReactNode }

export function Providers({ children }: ProvidersProps) {
  const [mode, setMode] = useState<'light' | 'dark'>(readStoredMode)

  const colorMode = useMemo(
    () => ({
      mode,
      toggle: () => {
        setMode((prev) => {
          const next = prev === 'light' ? 'dark' : 'light'
          localStorage.setItem(STORAGE_KEY, next)
          return next
        })
      },
    }),
    [mode],
  )

  const theme = useMemo(() => createBujoTheme(mode), [mode])

  return (
    <ColorModeContext.Provider value={colorMode}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </ColorModeContext.Provider>
  )
}
