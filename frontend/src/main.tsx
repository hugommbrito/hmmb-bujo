import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import './index.css'
import App from './App.tsx'
import { Providers } from './app/providers/index.tsx'
import { applyEnvBranding } from './shared/env'

// Título da aba, favicon e classe `dev-env` conforme o ambiente, antes do render.
applyEnvBranding()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
)
