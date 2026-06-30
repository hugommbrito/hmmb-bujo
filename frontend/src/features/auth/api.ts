import client from '../../api/client'
import type { LoginCredentials, SignupCredentials, AuthTokens } from './types'

export async function loginApi(credentials: LoginCredentials): Promise<AuthTokens> {
  const response = await client.post<{ access: string; refresh: string }>(
    '/api/accounts/token/',
    credentials,
  )
  return response.data
}

export async function signupApi(credentials: SignupCredentials): Promise<void> {
  await client.post('/api/accounts/signup/', credentials)
}
