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
    await expect(page.getByRole('navigation', { name: 'Atalhos de navegação' })).toBeVisible()

    // SHELL-DEBT-01 FECHADA (Story 13.3): a `ShellBottomNav` nova entra no gate
    // — o label não-selecionado usa `--ds-ink-muted` sobre `--ds-surface`
    // (≥4.5:1) e precisa passar `color-contrast` no axe real. Só o `<main>` da
    // superfície legada permanece fora (SHELL-DEBT-02, matriz completa na 13.4).
    await expectNoAxeViolations(page, {
      exclude: 'main',
      label: 'compact · /today',
    })
  })
})
