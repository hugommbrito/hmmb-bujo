import { Alert, Button } from '@mui/material'

interface SessionExpiredBannerProps {
  onLogin?: () => void
}

export function SessionExpiredBanner({ onLogin }: SessionExpiredBannerProps) {
  const handleLogin = onLogin ?? (() => window.location.assign('/login'))

  return (
    <Alert
      severity="warning"
      sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}
      action={
        <Button color="inherit" size="small" onClick={handleLogin}>
          Entrar
        </Button>
      }
    >
      Sessão expirada. Entre novamente.
    </Alert>
  )
}
