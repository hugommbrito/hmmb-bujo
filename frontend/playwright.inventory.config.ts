import { defineConfig } from '@playwright/test'

import base from './playwright.config'

// Config SOB DEMANDA dos coletores de `e2e/tools/` (hoje: o inventário da
// SHELL-DEBT-02 — axe em `/today` sem `exclude: 'main'`, por faixa; Story 13.4
// Task 8). Reaproveita integralmente o webServer, o banco e os timeouts da suíte
// real; só troca o `testDir` e desliga o `testIgnore` que mantém os coletores
// fora do gate.
//
//   CI=1 DATABASE_URL=… npx playwright test \
//     --config playwright.inventory.config.ts --reporter=line
export default defineConfig({
  ...base,
  testDir: './e2e/tools',
  testIgnore: [],
  reporter: 'line',
  retries: 0,
})
