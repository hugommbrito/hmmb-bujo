import { useEffect, useState, useCallback } from 'react'
import { queryClient } from '../../api/queryClient'
import { registerLogoutHandler } from '../../api/client'
import {
  getAccessToken,
  getCurrentUserId,
  setTokens,
  clearTokens,
} from '../../features/auth/tokenStorage'
import { SessionExpiredBanner } from '../../features/auth/components/SessionExpiredBanner'
import type { AuthTokens } from '../../features/auth/types'
import { AuthContext } from './AuthContext'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getAccessToken())
  const [sessionExpired, setSessionExpired] = useState(false)
  const [userId, setUserId] = useState(() => getCurrentUserId())

  const logout = useCallback(() => {
    clearTokens()
    queryClient.clear()
    setIsAuthenticated(false)
    setUserId(null)
  }, [])

  const login = useCallback((tokens: AuthTokens) => {
    setTokens(tokens.access, tokens.refresh)
    setIsAuthenticated(true)
    setSessionExpired(false)
    setUserId(getCurrentUserId())
  }, [])

  useEffect(() => {
    registerLogoutHandler(() => {
      logout()
      setSessionExpired(true)
    })
  }, [logout])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'access_token' && event.newValue === null) {
        setIsAuthenticated(false)
        setSessionExpired(true)
        setUserId(null)
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  return (
    <AuthContext.Provider value={{ isAuthenticated, sessionExpired, userId, login, logout }}>
      {sessionExpired && <SessionExpiredBanner />}
      {children}
    </AuthContext.Provider>
  )
}
