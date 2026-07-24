import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { createBujoTheme } from '../theme'

// DevEnvBanner lê APP_ENV/HAS_ENV_BANNER (avaliados no load de env.ts), então
// cada cenário stuba a env ANTES de reimportar (resetModules + import dinâmico).
async function renderBanner(appEnv: string) {
  vi.resetModules()
  vi.stubEnv('VITE_APP_ENV', appEnv)
  const { DevEnvBanner } = await import('./DevEnvBanner')
  return render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <DevEnvBanner />
    </ThemeProvider>,
  )
}

describe('DevEnvBanner', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('test_renderiza_faixa_marrom_em_development', async () => {
    await renderBanner('development')

    const banner = screen.getByRole('note', { name: 'Ambiente de desenvolvimento' })
    expect(banner).toBeInTheDocument()
    expect(banner).toHaveTextContent(/deploy DEV/i)
    expect(banner).toHaveStyle({ backgroundColor: '#b45309' })
  })

  it('test_renderiza_faixa_azul_em_local', async () => {
    await renderBanner('local')

    const banner = screen.getByRole('note', { name: 'Ambiente local' })
    expect(banner).toBeInTheDocument()
    expect(banner).toHaveTextContent(/Ambiente local/i)
    expect(banner).toHaveStyle({ backgroundColor: '#1d4ed8' })
  })

  it('test_nao_renderiza_em_prod', async () => {
    const { container } = await renderBanner('production')

    expect(screen.queryByRole('note')).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })

  it('test_nao_renderiza_com_env_vazia', async () => {
    const { container } = await renderBanner('')

    expect(screen.queryByRole('note')).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })
})
