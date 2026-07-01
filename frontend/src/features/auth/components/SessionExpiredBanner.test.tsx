import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionExpiredBanner } from './SessionExpiredBanner'

describe('SessionExpiredBanner', () => {
  it('exibe texto "Sessão expirada. Entre novamente."', () => {
    render(<SessionExpiredBanner />)
    expect(screen.getByRole('alert')).toHaveTextContent('Sessão expirada. Entre novamente.')
  })

  it('test_botao_entrar_aparece_sem_onLogin_prop — botão "Entrar" sempre presente mesmo sem prop', () => {
    render(<SessionExpiredBanner />)
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument()
  })

  it('test_botao_entrar_chama_onLogin_quando_fornecido', async () => {
    const user = userEvent.setup()
    const onLogin = vi.fn()
    render(<SessionExpiredBanner onLogin={onLogin} />)

    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(onLogin).toHaveBeenCalledTimes(1)
  })

  it('test_botao_entrar_usa_window_location_quando_sem_onLogin', async () => {
    const user = userEvent.setup()
    const assignSpy = vi.fn()
    vi.stubGlobal('location', { assign: assignSpy })

    render(<SessionExpiredBanner />)
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(assignSpy).toHaveBeenCalledWith('/login')
    vi.unstubAllGlobals()
  })

  it('banner não bloqueia o conteúdo (usa position fixed, não modal)', () => {
    const { container } = render(<SessionExpiredBanner />)
    const alert = container.firstChild as HTMLElement
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(alert).toBeTruthy()
  })
})
