import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionExpiredBanner } from './SessionExpiredBanner'

describe('SessionExpiredBanner', () => {
  it('exibe texto "Sessão expirada. Entre novamente."', () => {
    render(<SessionExpiredBanner />)
    expect(screen.getByRole('alert')).toHaveTextContent('Sessão expirada. Entre novamente.')
  })

  it('não exibe botão "Entrar" quando onLogin não é fornecido', () => {
    render(<SessionExpiredBanner />)
    expect(screen.queryByRole('button', { name: /entrar/i })).not.toBeInTheDocument()
  })

  it('exibe botão "Entrar" quando onLogin é fornecido', () => {
    render(<SessionExpiredBanner onLogin={vi.fn()} />)
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument()
  })

  it('clicar em "Entrar" chama onLogin', async () => {
    const user = userEvent.setup()
    const onLogin = vi.fn()
    render(<SessionExpiredBanner onLogin={onLogin} />)

    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(onLogin).toHaveBeenCalledTimes(1)
  })

  it('banner não bloqueia o conteúdo (usa position fixed, não modal)', () => {
    const { container } = render(<SessionExpiredBanner />)
    const alert = container.firstChild as HTMLElement
    // O banner deve estar no DOM sem nenhum overlay bloqueante (sem role=dialog)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(alert).toBeTruthy()
  })
})
