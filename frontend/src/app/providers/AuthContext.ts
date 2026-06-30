import { createContext } from 'react'
import type { AuthTokens } from '../../features/auth/types'

export interface AuthState {
  isAuthenticated: boolean
  sessionExpired: boolean
  login: (tokens: AuthTokens) => void
  logout: () => void
}

export const AuthContext = createContext<AuthState | null>(null)
