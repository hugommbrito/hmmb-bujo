import { describe, it, expect, afterEach, vi } from 'vitest'

// env.ts lê import.meta.env.VITE_APP_ENV no topo do módulo, então cada cenário
// precisa stubar a env ANTES de reimportar (resetModules + import dinâmico).
async function loadEnv(appEnv: string) {
  vi.resetModules()
  vi.stubEnv('VITE_APP_ENV', appEnv)
  return import('./env')
}

function seedIconLink(href: string) {
  const link = document.createElement('link')
  link.rel = 'icon'
  link.href = href
  document.head.appendChild(link)
}

describe('env branding', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    document.body.className = ''
    document.title = ''
    document.head
      .querySelectorAll("link[rel~='icon']")
      .forEach((link) => link.remove())
  })

  it('test_prod_seta_titulo_bujo_favicon_prod_sem_classe_dev', async () => {
    seedIconLink('/favicon.svg')
    const { applyEnvBranding, APP_ENV, HAS_ENV_BANNER, APP_TITLE } =
      await loadEnv('production')

    applyEnvBranding()

    expect(APP_ENV).toBe('production')
    expect(HAS_ENV_BANNER).toBe(false)
    expect(APP_TITLE).toBe('BuJo')
    expect(document.title).toBe('BuJo')
    const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
    expect(link?.getAttribute('href')).toBe('/favicon-prod.svg')
    expect(document.body.classList.contains('dev-env')).toBe(false)
  })

  it('test_development_seta_titulo_devbujo_favicon_dev_com_classe_dev', async () => {
    seedIconLink('/favicon-prod.svg')
    const { applyEnvBranding, APP_ENV, HAS_ENV_BANNER, APP_TITLE } =
      await loadEnv('development')

    applyEnvBranding()

    expect(APP_ENV).toBe('development')
    expect(HAS_ENV_BANNER).toBe(true)
    expect(APP_TITLE).toBe('DEV-bujo')
    expect(document.title).toBe('DEV-bujo')
    const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
    expect(link?.getAttribute('href')).toBe('/favicon.svg')
    expect(document.body.classList.contains('dev-env')).toBe(true)
  })

  it('test_local_seta_titulo_localbujo_favicon_dev_com_classe_dev', async () => {
    seedIconLink('/favicon-prod.svg')
    const { applyEnvBranding, APP_ENV, HAS_ENV_BANNER, APP_TITLE } =
      await loadEnv('local')

    applyEnvBranding()

    expect(APP_ENV).toBe('local')
    expect(HAS_ENV_BANNER).toBe(true)
    expect(APP_TITLE).toBe('LOCAL-bujo')
    expect(document.title).toBe('LOCAL-bujo')
    const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
    expect(link?.getAttribute('href')).toBe('/favicon.svg')
    expect(document.body.classList.contains('dev-env')).toBe(true)
  })

  it('test_vazio_trata_como_prod_neutro', async () => {
    const { applyEnvBranding, APP_ENV, HAS_ENV_BANNER, APP_TITLE } =
      await loadEnv('')

    applyEnvBranding()

    expect(APP_ENV).toBe('production')
    expect(HAS_ENV_BANNER).toBe(false)
    expect(APP_TITLE).toBe('BuJo')
    expect(document.body.classList.contains('dev-env')).toBe(false)
  })

  it('test_valor_desconhecido_trata_como_prod_neutro', async () => {
    const { APP_ENV, HAS_ENV_BANNER, APP_TITLE } = await loadEnv('staging')

    expect(APP_ENV).toBe('production')
    expect(HAS_ENV_BANNER).toBe(false)
    expect(APP_TITLE).toBe('BuJo')
  })

  it('test_cria_link_icon_quando_ausente', async () => {
    const { applyEnvBranding } = await loadEnv('production')

    applyEnvBranding()

    const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
    expect(link).not.toBeNull()
    expect(link?.getAttribute('href')).toBe('/favicon-prod.svg')
    expect(link?.type).toBe('image/svg+xml')
  })
})
