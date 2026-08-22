import AxeBuilder from '@axe-core/playwright'

import { test } from '../fixtures'
import { WCAG_2_2_AA_TAGS } from '../axeHelper'

// COLETOR do inventário da SHELL-DEBT-02 — roda o axe em `/today` SEM
// `exclude: 'main'`, uma vez por faixa, e imprime os achados do CONTEÚDO LEGADO
// (regra, impacto, seletor, `helpUrl`) para alimentar
// `_bmad-output/implementation-artifacts/13-shell-a11y-legacy-inventory.md`.
//
//   ▶ É COLETA, NÃO GATE. Por isso vive em `e2e/tools/`, que a
//     `playwright.config.ts` da suíte real IGNORA (`testIgnore: '**/tools/**'`):
//     nada aqui reprova a suíte, e não existe nenhum teste permanentemente
//     `skip`ado no gate — a Story 13.4 preferiu execução sob demanda a um teste
//     pulado (Task 8).
//
//   ▶ Como rodar (com o mesmo webServer/banco da suíte):
//       CI=1 DATABASE_URL=… npx playwright test \
//         --config playwright.inventory.config.ts --reporter=line
//
//   ▶ O gate de verdade (`shell-a11y.spec.ts`) continua com `exclude: 'main'`: a
//     dívida do conteúdo legado é migrada onda a onda (Ondas 3–5), não nesta story.

const BANDS = [
  { label: 'wide 1440×900', viewport: { width: 1440, height: 900 } },
  { label: 'medium 1280×800', viewport: { width: 1280, height: 800 } },
  { label: 'tablet 800×720', viewport: { width: 800, height: 720 } },
  { label: 'compact 390×720', viewport: { width: 390, height: 720 } },
  { label: 'compact 320×720', viewport: { width: 320, height: 720 } },
] as const

for (const band of BANDS) {
  test.describe(`Inventário SHELL-DEBT-02 — ${band.label}`, () => {
    test.use({ viewport: band.viewport })

    test(`coleta axe em /today SEM exclude (${band.label})`, async ({ page }) => {
      const results = await new AxeBuilder({ page }).withTags([...WCAG_2_2_AA_TAGS]).analyze()

      const inventory = results.violations.map((violation) => ({
        rule: violation.id,
        impact: violation.impact ?? 'sem impacto',
        help: violation.help,
        helpUrl: violation.helpUrl,
        nodes: violation.nodes.map((node) => ({
          target: node.target.join(' '),
          // O HTML identifica o controle real (o seletor de classe MUI sozinho
          // não diz QUAL botão) e o resumo do axe traz a razão de contraste.
          html: node.html.slice(0, 160),
          summary: (node.failureSummary ?? '').replace(/\s+/g, ' ').slice(0, 240),
        })),
      }))

      // Saída deliberadamente em uma linha por faixa, prefixada, para extrair do
      // log sem depender de reporter (`grep INVENTORY`).
      console.log(`INVENTORY ${JSON.stringify({ band: band.label, inventory }, null, 2)}`)
    })
  })
}
