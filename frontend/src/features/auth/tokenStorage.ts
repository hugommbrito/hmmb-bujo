const ACCESS_KEY = 'access_token'
const REFRESH_KEY = 'refresh_token'

export const getAccessToken = (): string | null => localStorage.getItem(ACCESS_KEY)
export const getRefreshToken = (): string | null => localStorage.getItem(REFRESH_KEY)

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(ACCESS_KEY, access)
  localStorage.setItem(REFRESH_KEY, refresh)
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

// Decodifica o claim `user_id` do access token (SIMPLE_JWT.USER_ID_CLAIM,
// backend/config/settings/base.py) — só o payload, sem verificar
// assinatura (a autoridade de acesso já é do backend; isto serve só para
// namespacing de cache no frontend, AD-13/Story 5.2). Sem lib nova.
export function getCurrentUserId(): string | null {
  const token = getAccessToken()
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return (JSON.parse(json) as { user_id?: string }).user_id ?? null
  } catch {
    return null
  }
}
