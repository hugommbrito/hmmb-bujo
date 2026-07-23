import { Alert, Button } from '@mui/material'

interface SessionExpiredBannerProps {
  onLogin?: () => void
}

export function SessionExpiredBanner({ onLogin }: SessionExpiredBannerProps) {
  const handleLogin = onLogin ?? (() => window.location.assign('/login'))

  return (
    <Alert
      severity="warning"
      // top lê --dev-banner-height (0 em prod, 28px em DEV) para ficar logo
      // abaixo do DevEnvBanner e não sobrepor o botão "Entrar".
      sx={{ position: 'fixed', top: 'var(--dev-banner-height)', left: 0, right: 0, zIndex: 9999 }}
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
