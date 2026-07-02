import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'

vi.mock('../api', () => ({
  loginApi: vi.fn(),
}))

vi.mock('../../../shared/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

import { LoginPage } from './LoginPage'
import { loginApi } from '../api'
import { useAuth } from '../../../shared/hooks/useAuth'

const mockLogin = vi.fn()
const mockAuth = { isAuthenticated: false, sessionExpired: false, login: mockLogin, logout: vi.fn() }

describe('LoginPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue(mockAuth)
  })

  it('renderiza campos de email, senha e botão de submit', () => {
    render(<LoginPage />)

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument()
  })

  it('test_pagina_tem_landmark_main', () => {
    render(<LoginPage />)

    expect(screen.getByRole('main', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('credenciais válidas → chama auth.login() e onSuccess', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    vi.mocked(loginApi).mockResolvedValue({ access: 'acc-token', refresh: 'ref-token' })

    render(<LoginPage onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText(/email/i), 'user@example.com')
    await user.type(screen.getByLabelText(/senha/i), 'senha123')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({ access: 'acc-token', refresh: 'ref-token' })
    })
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('credenciais inválidas → exibe "Email ou senha incorretos." inline', async () => {
    const user = userEvent.setup()
    vi.mocked(loginApi).mockRejectedValue(Object.assign(new Error('401'), { response: { status: 401 } }))

    render(<LoginPage />)

    await user.type(screen.getByLabelText(/email/i), 'wrong@example.com')
    await user.type(screen.getByLabelText(/senha/i), 'senhaerrada')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(screen.getByText('Email ou senha incorretos.')).toBeInTheDocument()
    })
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('botão fica desabilitado durante o loading', async () => {
    const user = userEvent.setup()
    let resolveLogin!: (v: { access: string; refresh: string }) => void
    vi.mocked(loginApi).mockImplementation(
      () => new Promise((resolve) => { resolveLogin = resolve }),
    )

    render(<LoginPage />)

    await user.type(screen.getByLabelText(/email/i), 'user@example.com')
    await user.type(screen.getByLabelText(/senha/i), 'senha123')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => expect(screen.getByRole('button')).toBeDisabled())

    resolveLogin({ access: 'acc', refresh: 'ref' })
    await waitFor(() => expect(screen.getByRole('button')).not.toBeDisabled())
  })

  it('erro não expõe detalhes técnicos na tela', async () => {
    const user = userEvent.setup()
    vi.mocked(loginApi).mockRejectedValue(
      new Error('Internal Server Error: something went wrong at line 42'),
    )

    render(<LoginPage />)

    await user.type(screen.getByLabelText(/email/i), 'user@example.com')
    await user.type(screen.getByLabelText(/senha/i), 'senha123')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(screen.getByText('Email ou senha incorretos.')).toBeInTheDocument()
    })
    expect(screen.queryByText(/internal server error/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/line 42/i)).not.toBeInTheDocument()
  })

  it('test_sem_violacoes_de_acessibilidade', async () => {
    const { container } = render(<LoginPage />)

    expect(await axe(container)).toHaveNoViolations()
  })
})
