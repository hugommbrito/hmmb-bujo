// Branding do ambiente em 3 estados, sinalizado por VITE_APP_ENV.
//
// Os deploys dev e prod rodam o MESMO build de produção do Vite
// (`npm run build`), então `import.meta.env.PROD`/`MODE` não os distinguem.
// O sinal é a variável VITE_APP_ENV, injetada no build (ou no dev server):
//   - 'local'        → faixa AZUL "Ambiente local", aba LOCAL-bujo, favicon.svg
//                      (dev local via .env.development.local, não versionado).
//   - 'development'  → faixa MARROM de deploy DEV, aba DEV-bujo, favicon.svg.
//   - vazio ou qualquer outro valor (incl. 'production') → SEM faixa, aba BuJo,
//     favicon-prod.svg. A aparência de produção é o estado neutro: só ambientes
//     explicitamente marcados como local/development ganham branding de dev.

type AppEnv = 'local' | 'development' | 'production'

const RAW_ENV = import.meta.env.VITE_APP_ENV

/** Ambiente de branding; qualquer valor fora de local/development é 'production'. */
export const APP_ENV: AppEnv =
  RAW_ENV === 'local' || RAW_ENV === 'development' ? RAW_ENV : 'production'

/** Há faixa de ambiente (local OU development)? Também dita `body.dev-env`. */
export const HAS_ENV_BANNER = APP_ENV !== 'production'

/** Nome exibido na aba do navegador. */
export const APP_TITLE =
  APP_ENV === 'local' ? 'LOCAL-bujo' : APP_ENV === 'development' ? 'DEV-bujo' : 'BuJo'

/** Favicon por ambiente (arquivos em /public). */
const FAVICON_HREF = HAS_ENV_BANNER ? '/favicon.svg' : '/favicon-prod.svg'

/**
 * Aplica o branding do ambiente no DOM: título da aba, favicon e a classe
 * `dev-env` no <body> (que ativa o offset da faixa em index.css quando há
 * faixa — local OU development; sem faixa, sem offset).
 * Idempotente. Chamado uma vez em main.tsx, antes do render.
 */
export function applyEnvBranding(): void {
  document.title = APP_TITLE

  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.type = 'image/svg+xml'
  link.href = FAVICON_HREF

  document.body.classList.toggle('dev-env', HAS_ENV_BANNER)
}
