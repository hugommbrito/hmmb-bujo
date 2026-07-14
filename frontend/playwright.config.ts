import { defineConfig, devices } from '@playwright/test'

import { DJANGO_SETTINGS_MODULE } from './e2e/backendEnv'

// E2E de browser real contra `npm run dev` (5173) + backend Django real (8000,
// config.settings.e2e — branch Neon `e2e` dedicada, isolada da branch de dev
// onde o app é de fato usado; story 11.1). Sem mocks de rede: exercita
// login/signup, API e UI juntos.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  // Toda asserção aqui depende de um round-trip real contra o Neon; o default
  // de 5s do Playwright estoura sob a latência de cold-start da branch `e2e`
  // (mesma fricção ambiental documentada na retro do Épico 4, ação #4).
  // 10s é config, não lógica de spec — os `.spec.ts` seguem intocados.
  expect: { timeout: 10_000 },
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
      env: { DJANGO_SETTINGS_MODULE },
    },
  ],
})
