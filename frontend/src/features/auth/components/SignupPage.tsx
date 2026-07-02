import { useState } from 'react'
import { TextField, Button, Alert, Box, Typography, CircularProgress } from '@mui/material'
import { useAuth } from '../../../shared/hooks/useAuth'
import { signupApi, loginApi } from '../api'

interface SignupPageProps {
  onSuccess?: () => void
}

export function SignupPage({ onSuccess }: SignupPageProps) {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    try {
      await signupApi({ email, password, timezone })
      const tokens = await loginApi({ email, password })
      auth.login(tokens)
      onSuccess?.()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } }
      if (axiosErr?.response?.status === 400) {
        setError('Dados inválidos. Verifique o formulário.')
      } else {
        setError('Erro ao criar conta. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box component="main" aria-label="Criar conta">
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400, mx: 'auto', mt: 8 }}
      >
        <Typography variant="h4" component="h1">
          Criar conta
        </Typography>
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <TextField
          label="Senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
        {error && <Alert severity="error">{error}</Alert>}
        <Button type="submit" variant="contained" disabled={loading}>
          {loading ? <CircularProgress size={20} /> : 'Criar conta'}
        </Button>
      </Box>
    </Box>
  )
}
