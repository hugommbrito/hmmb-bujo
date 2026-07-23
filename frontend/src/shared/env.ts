// Distinção deploy DEV × PROD.
//
// Os dois deploys (dev e prod) rodam o MESMO build de produção do Vite
// (`npm run build`), então `import.meta.env.PROD`/`MODE` não os distinguem.
// O sinal é a variável `VITE_APP_ENV`, injetada no build:
//   - Os arquivos .env commitados usam 'development' como default fail-safe.
//   - O ambiente PROD do Railway seta VITE_APP_ENV=production (sobrescreve o
//     valor do .env, como já acontece com VITE_API_BASE_URL).
// Assim, só um deploy explicitamente marcado como produção perde o banner e o
// branding de dev — um deploy mal configurado aparece como DEV, nunca o contrário.
export const IS_PROD_DEPLOY = import.meta.env.VITE_APP_ENV === 'production'

/** Nome exibido na aba do navegador. */
export const APP_TITLE = IS_PROD_DEPLOY ? 'BuJo' : 'DEV-bujo'

/** Favicon por ambiente (arquivos em /public). */
const FAVICON_HREF = IS_PROD_DEPLOY ? '/favicon-prod.svg' : '/favicon.svg'

/**
 * Aplica o branding do ambiente no DOM: título da aba, favicon e a classe
 * `dev-env` no <body> (que ativa o offset do banner em index.css).
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

  document.body.classList.toggle('dev-env', !IS_PROD_DEPLOY)
}
