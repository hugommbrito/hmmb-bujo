import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // DEV: same-origin calls — the app talks to a relative `/api` and Vite
    // proxies to the Django backend, so there is no CORS in development.
    // PROD: the app reads `VITE_API_BASE_URL` (cross-origin). The two paths do
    // not overlap — proxy for dev, base-URL for prod.
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
