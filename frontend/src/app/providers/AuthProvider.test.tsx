import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { QueryClient } from '@tanstack/react-query'

vi.mock('../../features/auth/tokenStorage', () => ({
  getAccessToken: vi.fn(() => null),
  getRefreshToken: vi.fn(() => null),
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
}))

vi.mock('../../api/client', () => ({
  registerLogoutHandler: vi.fn(),
  default: { get: vi.fn(), post: vi.fn() },
}))

vi.mock('../../api/queryClient', () => ({
  queryClient: { clear: vi.fn() },
}))

import { AuthProvider } from './AuthProvider'
import { AuthContext } from './AuthContext'
import * as tokenStorage from '../../features/auth/tokenStorage'
import { registerLogoutHandler } from '../../api/client'
import { queryClient } from '../../api/queryClient'
import { useContext } from 'react'

function TestConsumer() {
  const auth = useContext(AuthContext)
  if (!auth) return <div>no auth</div>
  return (
    <div>
      <span data-testid="is-authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="session-expired">{String(auth.sessionExpired)}</span>
      <button onClick={() => auth.login({ access: 'acc', refresh: 'ref' })}>login</button>
      <button onClick={() => auth.logout()}>logout</button>
    </div>
  )
}

function renderWithProviders(ui: React.ReactNode) {
  const testQueryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={testQueryClient}>
      {ui}
    </QueryClientProvider>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(tokenStorage.getAccessToken).mockReturnValue(null)
  })

  it('sem token no localStorage → isAuthenticated = false', () => {
    vi.mocked(tokenStorage.getAccessToken).mockReturnValue(null)

    renderWithProviders(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    expect(screen.getByTestId('is-authenticated').textContent).toBe('false')
  })

  it('restaura sessão do localStorage quando token presente', () => {
    vi.mocked(tokenStorage.getAccessToken).mockReturnValue('existing-token')

    renderWithProviders(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    expect(screen.getByTestId('is-authenticated').textContent).toBe('true')
  })

  it('login() persiste tokens e atualiza isAuthenticated = true', async () => {
    renderWithProviders(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    expect(screen.getByTestId('is-authenticated').textContent).toBe('false')

    await act(async () => {
      screen.getByText('login').click()
    })

    expect(tokenStorage.setTokens).toHaveBeenCalledWith('acc', 'ref')
    expect(screen.getByTestId('is-authenticated').textContent).toBe('true')
    expect(screen.getByTestId('session-expired').textContent).toBe('false')
  })

  it('logout() limpa localStorage e seta isAuthenticated = false', async () => {
    vi.mocked(tokenStorage.getAccessToken).mockReturnValue('some-token')

    renderWithProviders(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    expect(screen.getByTestId('is-authenticated').textContent).toBe('true')

    await act(async () => {
      screen.getByText('logout').click()
    })

    expect(tokenStorage.clearTokens).toHaveBeenCalled()
    expect(queryClient.clear).toHaveBeenCalled()
    expect(screen.getByTestId('is-authenticated').textContent).toBe('false')
  })

  it('registra logout handler no mount via registerLogoutHandler', () => {
    renderWithProviders(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    expect(registerLogoutHandler).toHaveBeenCalledWith(expect.any(Function))
  })

  it('storage event de outra aba seta isAuthenticated = false e sessionExpired = true', async () => {
    vi.mocked(tokenStorage.getAccessToken).mockReturnValue('some-token')

    renderWithProviders(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    expect(screen.getByTestId('is-authenticated').textContent).toBe('true')

    await act(async () => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'access_token', newValue: null }),
      )
    })

    expect(screen.getByTestId('is-authenticated').textContent).toBe('false')
    expect(screen.getByTestId('session-expired').textContent).toBe('true')
  })
})
