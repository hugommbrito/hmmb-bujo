import { test, expect } from './fixtures'
import { expectNoAxeViolations } from './axeHelper'

// Acessibilidade do SHELL novo (Story 13.1) numa rota real — `/today` — em wide
// e em compact. A fixture faz signup real por teste e cai em `/today` já dentro
// do shell novo (o registro `shellRouting.ts` monta o shell em todas as rotas).
//
// Escopo: o gate mede o CHROME do shell (topbar, sidebar/bottom nav, skip link,
// seam), excluindo o `<main>` da superfície legada — cuja dívida de
// acessibilidade é da Story 13.4 (matriz completa). Nada é silenciado
// globalmente: a exclusão é explícita e registrada no
// `13-shell-parity-checklist.md`.
//
// Compact é `test.use({ viewport })` DENTRO do describe, não um project novo do
// playwright.config.ts — um project novo multiplicaria a suíte E2E inteira.

test.describe('Shell a11y — wide', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('axe sem violações no chrome do shell em /today (wide)', async ({ page }) => {
    await expect(page.getByRole('banner')).toContainText('Hoje')
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible()

    await expectNoAxeViolations(page, { exclude: 'main', label: 'wide · /today' })
  })
})

test.describe('Shell a11y — compact', () => {
  test.use({ viewport: { width: 320, height: 720 } })

  test('axe sem violações no chrome do shell em /today (compact)', async ({ page }) => {
    // No compact o shell novo passa a ter topbar (o AppLayout legado não tinha).
    await expect(page.getByRole('banner')).toContainText('Hoje')
    await expect(page.getByRole('navigation', { name: 'Navegação mobile' })).toBeVisible()

    // O `BottomNav` LEGADO é renderizado sem alteração nesta story (seu contrato
    // novo — 3 atalhos + Menu — é a Story 13.3). O label de aba não-selecionada
    // reprova `color-contrast` (dívida preexistente do componente legado, não
    // regressão do shell): fica FORA do gate aqui e registrada no
    // `13-shell-parity-checklist.md` (SHELL-DEBT-01). O gate compact cobre o
    // resto do chrome novo — topbar, skip link e seam.
    await expectNoAxeViolations(page, {
      exclude: 'main, nav[aria-label="Navegação mobile"]',
      label: 'compact · /today',
    })
  })
})
