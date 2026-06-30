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
