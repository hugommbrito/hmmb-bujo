import { defineConfig, devices } from '@playwright/test'

import { DJANGO_SETTINGS_MODULE } from './e2e/backendEnv'

// E2E de browser real contra `npm run dev` (5173) + backend Django real (8000,
// config.settings.e2e). Sem mocks de rede: exercita login/signup, API e UI
// juntos.
//
// Banco: Postgres LOCAL `bujo_e2e` (mesmo container docker-compose do pytest,
// `hmmb-test-db`) é o caminho OFICIAL desde 2026-07-28 (docs/e2e-neon-reset.md
// §4b) — elimina cold-start/latência intermitente da branch Neon `e2e`, que
// derrubava a suíte inteira no fixture de signup (achado da story 14.9).
// A branch Neon `e2e` continua documentada como fallback manual para validar
// contra Postgres gerenciado real; para usá-la, exporte DATABASE_URL com a
// connection string da branch antes de rodar o Playwright.
export default defineConfig({
  testDir: './e2e',
  // `e2e/tools/` guarda COLETORES sob demanda (hoje: o inventário da
  // SHELL-DEBT-02 — axe sem `exclude: 'main'` por faixa, Story 13.4 Task 8).
  // Coleta não é gate: fica fora da suíte para não reprovar por dívida de
  // conteúdo legado e para não existir teste permanentemente `skip`ado.
  // Roda com `--config playwright.inventory.config.ts`.
  testIgnore: ['**/tools/**'],
  fullyParallel: true,
  // Contenção da branch Neon `e2e` (locks órfãos + cold-start) tornava a suíte
  // não-determinística sob execução paralela — diagnosticada e mitigada
  // manualmente (`--workers=1`) em todo o Épico 11 e no Épico 5. Promovido a
  // default aqui para parar de depender de lembrar a flag a cada rodada
  // (retro Épico 4 #7 / Épico 11 #1, 4º ciclo — retro Épico 5 §7).
  workers: 1,
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
      command: 'npm run dev -- --mode e2e --port 5173 --strictPort',
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
      // process.env.DATABASE_URL já chega default para o bujo_e2e local pelo
      // side-effect de `./e2e/backendEnv` (import acima) — explícito aqui só
      // pra deixar claro que o webServer nunca diverge do banco que os seeds
      // usam, sem depender da semântica de merge do Playwright.
      env: { DJANGO_SETTINGS_MODULE, DATABASE_URL: process.env.DATABASE_URL! },
    },
  ],
})
