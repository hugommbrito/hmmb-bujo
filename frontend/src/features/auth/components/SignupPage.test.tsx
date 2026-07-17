import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'

vi.mock('../api', () => ({
  signupApi: vi.fn(),
  loginApi: vi.fn(),
}))

vi.mock('../../../shared/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

import { SignupPage } from './SignupPage'
import { signupApi, loginApi } from '../api'
import { useAuth } from '../../../shared/hooks/useAuth'

const mockLogin = vi.fn()
const mockAuth = {
  isAuthenticated: false,
  sessionExpired: false,
  userId: null,
  login: mockLogin,
  logout: vi.fn(),
}

describe('SignupPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue(mockAuth)
  })

  it('renderiza campos de email, senha e botão de submit', () => {
    render(<SignupPage />)

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /criar conta/i })).toBeInTheDocument()
  })

  it('test_pagina_tem_landmark_main', () => {
    render(<SignupPage />)

    expect(screen.getByRole('main', { name: 'Criar conta' })).toBeInTheDocument()
  })

  it('cadastro bem-sucedido → chama signupApi, loginApi, auth.login() e onSuccess', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    vi.mocked(signupApi).mockResolvedValue(undefined)
    vi.mocked(loginApi).mockResolvedValue({ access: 'acc-token', refresh: 'ref-token' })

    render(<SignupPage onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText(/email/i), 'novo@example.com')
    await user.type(screen.getByLabelText(/senha/i), 'senha123')
    await user.click(screen.getByRole('button', { name: /criar conta/i }))

    await waitFor(() => {
      expect(signupApi).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'novo@example.com', password: 'senha123' }),
      )
    })
    expect(loginApi).toHaveBeenCalledWith({ email: 'novo@example.com', password: 'senha123' })
    expect(mockLogin).toHaveBeenCalledWith({ access: 'acc-token', refresh: 'ref-token' })
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('inclui timezone detectado automaticamente no signupApi', async () => {
    const user = userEvent.setup()
    vi.mocked(signupApi).mockResolvedValue(undefined)
    vi.mocked(loginApi).mockResolvedValue({ access: 'acc', refresh: 'ref' })

    render(<SignupPage />)

    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/senha/i), 'senha')
    await user.click(screen.getByRole('button', { name: /criar conta/i }))

    await waitFor(() => {
      expect(signupApi).toHaveBeenCalledWith(
        expect.objectContaining({ timezone: expect.any(String) }),
      )
    })
    const callArg = vi.mocked(signupApi).mock.calls[0][0]
    expect(callArg.timezone.length).toBeGreaterThan(0)
  })

  it('erro 400 → exibe "Dados inválidos. Verifique o formulário."', async () => {
    const user = userEvent.setup()
    vi.mocked(signupApi).mockRejectedValue(
      Object.assign(new Error('Bad Request'), { response: { status: 400 } }),
    )

    render(<SignupPage />)

    await user.type(screen.getByLabelText(/email/i), 'invalido@example.com')
    await user.type(screen.getByLabelText(/senha/i), 'senha')
    await user.click(screen.getByRole('button', { name: /criar conta/i }))

    await waitFor(() => {
      expect(screen.getByText('Dados inválidos. Verifique o formulário.')).toBeInTheDocument()
    })
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('erro genérico → exibe "Erro ao criar conta. Tente novamente."', async () => {
    const user = userEvent.setup()
    vi.mocked(signupApi).mockRejectedValue(new Error('Network Error'))

    render(<SignupPage />)

    await user.type(screen.getByLabelText(/email/i), 'teste@example.com')
    await user.type(screen.getByLabelText(/senha/i), 'senha')
    await user.click(screen.getByRole('button', { name: /criar conta/i }))

    await waitFor(() => {
      expect(screen.getByText('Erro ao criar conta. Tente novamente.')).toBeInTheDocument()
    })
  })

  it('botão fica desabilitado durante o loading', async () => {
    const user = userEvent.setup()
    let resolveSignup!: () => void
    vi.mocked(signupApi).mockImplementation(
      () => new Promise((resolve) => { resolveSignup = resolve }),
    )

    render(<SignupPage />)

    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/senha/i), 'senha123')
    await user.click(screen.getByRole('button', { name: /criar conta/i }))

    await waitFor(() => expect(screen.getByRole('button')).toBeDisabled())

    resolveSignup()
    await waitFor(() => expect(screen.getByRole('button')).not.toBeDisabled())
  })

  it('test_sem_violacoes_de_acessibilidade', async () => {
    const { container } = render(<SignupPage />)

    expect(await axe(container)).toHaveNoViolations()
  })
})
