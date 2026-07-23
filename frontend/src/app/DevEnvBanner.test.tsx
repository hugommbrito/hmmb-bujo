import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { createBujoTheme } from '../theme'

// DevEnvBanner lê IS_PROD_DEPLOY (avaliado no load de env.ts), então cada
// cenário stuba a env ANTES de reimportar (resetModules + import dinâmico).
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

  it('test_renderiza_banner_em_dev', async () => {
    await renderBanner('development')

    const banner = screen.getByRole('note', { name: 'Ambiente de desenvolvimento' })
    expect(banner).toBeInTheDocument()
    expect(banner).toHaveTextContent(/deploy DEV/i)
  })

  it('test_nao_renderiza_em_prod', async () => {
    const { container } = await renderBanner('production')

    expect(screen.queryByRole('note')).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })
})
