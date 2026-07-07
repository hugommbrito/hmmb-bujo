import { defineConfig, devices } from '@playwright/test'

// E2E de browser real contra `npm run dev` (5173) + backend Django real (8000,
// config.settings.dev — mesmo Neon dev branch usado na verificação manual da
// story 3.3). Sem mocks de rede: exercita login/signup, API e UI juntos.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      cwd: '.',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'uv run python manage.py runserver 8000',
      cwd: '../backend',
      url: 'http://localhost:8000/api/health/',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { DJANGO_SETTINGS_MODULE: 'config.settings.dev' },
    },
  ],
})
