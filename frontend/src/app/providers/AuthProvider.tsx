import { useEffect, useState, useCallback } from 'react'
import { queryClient } from '../../api/queryClient'
import { registerLogoutHandler } from '../../api/client'
import { getAccessToken, setTokens, clearTokens } from '../../features/auth/tokenStorage'
import { SessionExpiredBanner } from '../../features/auth/components/SessionExpiredBanner'
import type { AuthTokens } from '../../features/auth/types'
import { AuthContext } from './AuthContext'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getAccessToken())
  const [sessionExpired, setSessionExpired] = useState(false)

  const logout = useCallback(() => {
    clearTokens()
    queryClient.clear()
    setIsAuthenticated(false)
  }, [])

  const login = useCallback((tokens: AuthTokens) => {
    setTokens(tokens.access, tokens.refresh)
    setIsAuthenticated(true)
    setSessionExpired(false)
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
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  return (
    <AuthContext.Provider value={{ isAuthenticated, sessionExpired, login, logout }}>
      {sessionExpired && <SessionExpiredBanner />}
      {children}
    </AuthContext.Provider>
  )
}
