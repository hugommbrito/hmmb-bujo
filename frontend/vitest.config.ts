import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    // e2e/ roda em Playwright (browser real), não em jsdom — mantê-lo fora
    // do Vitest evita que ele tente coletar specs de outro test runner.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
