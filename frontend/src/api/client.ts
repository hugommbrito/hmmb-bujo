import axios, { AxiosError } from 'axios'
import { queryClient } from './queryClient'
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '../features/auth/tokenStorage'

let refreshing: Promise<void> | null = null
let onLogout: (() => void) | null = null

export function registerLogoutHandler(fn: () => void) {
  onLogout = fn
}

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config

    if (error.response?.status !== 401 || !originalRequest) {
      return Promise.reject(error)
    }

    if (originalRequest.url?.includes('/api/accounts/token/refresh/')) {
      clearTokens()
      queryClient.clear()
      onLogout?.()
      return Promise.reject(error)
    }

    if (!refreshing) {
      refreshing = doRefresh().finally(() => {
        refreshing = null
      })
    }

    try {
      await refreshing
    } catch {
      return Promise.reject(error)
    }

    const newToken = getAccessToken()
    if (originalRequest.headers && newToken) {
      originalRequest.headers.Authorization = `Bearer ${newToken}`
    }
    return client(originalRequest)
  },
)

async function doRefresh(): Promise<void> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    clearTokens()
    queryClient.clear()
    onLogout?.()
    throw new Error('No refresh token')
  }

  try {
    const response = await axios.post(
      `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/accounts/token/refresh/`,
      { refresh: refreshToken },
      { headers: { 'Content-Type': 'application/json' } },
    )
    const { access, refresh } = response.data
    setTokens(access, refresh)
  } catch {
    clearTokens()
    queryClient.clear()
    onLogout?.()
    throw new Error('Refresh failed')
  }
}

export default client
