import type { Page } from '@playwright/test'

import { test, expect } from './fixtures'
import { expectNoAxeViolations } from './axeHelper'
import { seedBrainDumpItems } from './seedBrainDumpItems'
import { bottomNav, captureSheet, mainNav, sidebarPaper } from './shellHelpers'

// GATE DE ACESSIBILIDADE do App Shell — **dono único** da matriz axe do shell.
// Criado na Story 13.1 com 2 células (`/today` em wide e em compact 320); a
// Story 13.4 o amplia para a MATRIZ COMPLETA das quatro faixas do EXPERIENCE
// (§Responsive & Platform): wide ≥1440 · medium 1024–1439 · tablet 768–1023 ·
// compact <768 — nenhuma das duas faixas do meio tinha qualquer cobertura antes.
//
// Escopo: o gate mede o CHROME do shell (topbar, sidebar/rail, bottom nav,
// Menu/sheet, FAB e âncora de captura, skip link, seam legado, badge),
// EXCLUINDO o `<main>` da superfície legada — cuja dívida de acessibilidade é
// migrada onda a onda (SHELL-DEBT-02, re-escopada para as Ondas 3–5 com dono
// explícito; o inventário dos achados sem `exclude` está em
// `13-shell-a11y-legacy-inventory.md`). Nada é silenciado globalmente: não existe
// `disableRules` no repo, nenhuma regra é desligada e nenhuma célula usa
// `test.skip`/`test.fixme`.
//
// Cada faixa é `test.use({ viewport })` DENTRO do describe, nunca um project novo
// do playwright.config.ts — um project novo multiplicaria a suíte E2E inteira.
//
// Duas células da matriz vivem, de propósito, nos specs donos do seu estado (e
// contam para a matriz): `wide · /planner/week · rail` em `shell-sidebar.spec.ts`
// e `compact 390 · /today · sheet de navegação aberto` em
// `shell-bottomnav.spec.ts`.
//
// [Source: Story 13.4 AC4; EXPERIENCE.md §Accessibility Floor / §Responsive &
//  Platform; 13-shell-parity-checklist.md §Onda 2a — equivalência comprovada]

/**
 * Vai para uma rota do shell e espera um marcador ESTÁVEL antes de medir: o
 * título da superfície na `banner`. Rodar `analyze()` durante a transição de
 * rota é o "verde falso" mais fácil desta matriz (risco #5 da story) — a página
 * pode nem ter montado o chrome ainda.
 */
async function gotoShellRoute(page: Page, path: string, title: string): Promise<void> {
  await page.goto(path)
  await expect(page.getByRole('banner')).toContainText(title)
}

/**
 * Escopo das células com o **Capture Sheet aberto**.
 *
 * DIVERGÊNCIA REGISTRADA (Story 13.4 AC4 — "célula que reprove é corrigida no
 * chrome OU registrada como divergência com o motivo e o artefato upstream"):
 * o `BrainDumpCaptureSheet` é a superfície de captura **LEGADA** (migra no
 * Épico 15) e o MUI a renderiza num PORTAL — logo ela cai fora do `<main>` e o
 * `exclude: 'main'` da SHELL-DEBT-02 não a alcança. Medido no browser real: o
 * label do `TextField` "Título" em foco usa o `primary.main` do tema LEGADO
 * (`theme.ts` `brandPrimary = #2BADA0`), que dá ≈2,8:1 sobre a superfície clara
 * — reprova `color-contrast` (WCAG 1.4.3). Não é dívida do chrome: o
 * `--ds-primary` do sistema NOVO (`#315F5A`) já resolve o mesmo papel com
 * contraste conforme, e esta story tem `theme.ts` explicitamente FORA de escopo
 * (rota de rollback).
 *
 * Portanto a exclusão da superfície legada é EXTENSÃO da SHELL-DEBT-02, não uma
 * regra silenciada: nenhuma regra do axe é desligada, o achado está inventariado
 * com dono em `13-shell-a11y-legacy-inventory.md` e registrado como divergência
 * no checklist de paridade. O que a célula mede continua sendo o CHROME com a
 * captura aberta: FAB/âncora, topbar, backdrop, skip link e a inertização do
 * conteúdo inferior pelo Modal.
 */
const LEGACY_CAPTURE_SURFACE = '[role="dialog"][aria-label="Captura rápida"]'

/**
 * Espera o RAIL do tablet ASSENTAR. O tablet nasce com a sidebar expandida e
 * colapsa por efeito (`useEffect` de `isTablet`), com `transition: width 0.2s` no
 * paper e o `Collapse` fechando os filhos dos agrupadores. Medir no meio disso é
 * o vermelho falso do risco #5: um filho de grupo sendo clipado pelo `Collapse`
 * reprova `target-size` por alguns milissegundos (flake observado de fato ao
 * montar esta matriz).
 */
async function waitForRailSettled(page: Page): Promise<void> {
  await expect(sidebarPaper(page)).toHaveCSS('width', '64px')
  // Filhos dos agrupadores DESMONTADOS (fim do `Collapse`), não apenas
  // encolhendo — é o marcador estável do fim da recomposição.
  await expect(mainNav(page).getByRole('button', { name: 'Futuro' })).toHaveCount(0)
}

/** Abre o Capture Sheet real e espera ele assentar (título em foco). */
async function openCaptureSheet(page: Page, trigger: 'fab' | 'anchor'): Promise<void> {
  if (trigger === 'fab') {
    await page.getByRole('button', { name: 'Captura rápida', exact: true }).click()
  } else {
    await mainNav(page).getByRole('button', { name: 'Abrir captura rápida', exact: true }).click()
  }
  await expect(captureSheet(page)).toBeVisible()
  // O FocusTrap do Modal foca o título só ao fim da transição (aprendizado da
  // retro do Épico 5) — medir antes disso é medir a animação.
  await expect(captureSheet(page).getByLabel(/Título/)).toBeFocused()
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabela A — rotas por faixa
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Matriz axe — wide 1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('wide · /today · sidebar expandida', async ({ page }) => {
    await expect(page.getByRole('banner')).toContainText('Hoje')
    await expect(mainNav(page)).toBeVisible()

    await expectNoAxeViolations(page, { exclude: 'main', label: 'wide · /today · sidebar expandida' })
  })

  test('wide · /settings · divisor + último destino do chrome', async ({ page }) => {
    // `/settings` é o único destino atrás de um `Divider` de chrome (SB-10): o
    // divisor não pode virar separador semântico órfão nem quebrar a lista.
    await gotoShellRoute(page, '/settings', 'Configurações')
    await expect(mainNav(page).getByRole('button', { name: 'Configurações' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await expectNoAxeViolations(page, { exclude: 'main', label: 'wide · /settings · divisor' })
  })

  // O AC4 exige que o gate cubra "todo o chrome: … skip link", mas o skip link
  // vive `transform: translateY(-160%)` até receber foco — e o axe não mede
  // `color-contrast` de nó fora da tela. Ou seja: nas outras 15 células o skip
  // link entra no escopo apenas como nó com nome acessível; o estado em que ele é
  // de fato VISTO (pílula com `--ds-surface`, borda `--ds-control-border`, texto
  // `--ds-ink` e anel `--ds-focus`) nunca era medido. Esta célula mede.
  test('wide · /today · skip link EM FOCO (estado visível do único controle off-screen)', async ({
    page,
  }) => {
    await page.keyboard.press('Tab')
    const skipLink = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skipLink).toBeFocused()
    // Marcador estável: o `transform` neutro é o fim da revelação.
    await expect(skipLink).toHaveCSS('transform', 'none')

    await expectNoAxeViolations(page, {
      exclude: 'main',
      label: 'wide · /today · skip link em foco',
    })
  })

  test('wide · /today · Capture Sheet aberto pela âncora', async ({ page }) => {
    await openCaptureSheet(page, 'anchor')

    await expectNoAxeViolations(page, {
      exclude: ['main', LEGACY_CAPTURE_SURFACE],
      label: 'wide · /today · Capture Sheet aberto pela âncora',
    })
  })

  test('wide · /today · offline (âncora aria-disabled)', async ({ page, context }) => {
    await expect(
      mainNav(page).getByRole('button', { name: 'Abrir captura rápida', exact: true }),
    ).toBeVisible()
    await context.setOffline(true)
    // Marcador estável do estado: o nome acessível passa a carregar o motivo.
    await expect(
      mainNav(page).getByRole('button', { name: 'Abrir captura rápida (sem conexão)' }),
    ).toHaveAttribute('aria-disabled', 'true')

    // `aria-disabled` + tinta `ink-disabled` sobre `surface-subtle` precisam
    // passar contraste e nome/papel/estado no axe REAL (jsdom não computa cor).
    await expectNoAxeViolations(page, {
      exclude: 'main',
      label: 'wide · /today · offline (âncora aria-disabled)',
    })
  })
})

test.describe('Matriz axe — medium 1280×800', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('medium · /today · faixa sem nenhuma cobertura antes da 13.4', async ({ page }) => {
    await expect(page.getByRole('banner')).toContainText('Hoje')
    await expect(mainNav(page)).toBeVisible()
    // medium compartilha o comportamento de chrome do wide, mas com gutter
    // `--ds-gutter-medium`: é uma composição própria, logo célula própria.
    await expectNoAxeViolations(page, { exclude: 'main', label: 'medium · /today · sidebar expandida' })
  })

  test('medium · /brain-dump · destino com badge no estado ativo', async ({ page }) => {
    await gotoShellRoute(page, '/brain-dump', 'Brain Dump')
    await expect(mainNav(page).getByRole('button', { name: /Brain Dump/ })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await expectNoAxeViolations(page, { exclude: 'main', label: 'medium · /brain-dump · badge ativo' })
  })

  test('medium · /health/metrics/history · ativo por prefixo (AC1) + readonly', async ({ page }) => {
    // Rota de histórico: superfície READONLY (ST-06) e, desde a 13.4, o destino
    // PAI fica ativo por prefixo — antes a sidebar ficava sem nenhum ativo.
    await gotoShellRoute(page, '/health/metrics/history', 'Métricas de Saúde — Histórico')
    await expect(mainNav(page).getByRole('button', { name: 'Métricas' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(mainNav(page).locator('[aria-current="page"]')).toHaveCount(1)

    await expectNoAxeViolations(page, {
      exclude: 'main',
      label: 'medium · /health/metrics/history · ativo por prefixo',
    })
  })

  test('medium · /today · badge 9+ com contagem real', async ({ page, email }) => {
    expect(seedBrainDumpItems(email, 12)).toBe(12)
    await page.reload()

    const badge = mainNav(page)
      .getByRole('button', { name: /Brain Dump/ })
      .locator('.MuiBadge-badge')
    await expect(badge).toHaveText('9+')

    // A cápsula do badge é `--ds-primary` sobre `--ds-on-primary`: o contraste do
    // texto `9+` só é medido pelo axe real.
    await expectNoAxeViolations(page, { exclude: 'main', label: 'medium · /today · badge 9+' })
  })
})

test.describe('Matriz axe — tablet 800×720', () => {
  test.use({ viewport: { width: 800, height: 720 } })

  test('tablet · /today · rail inicial da faixa', async ({ page }) => {
    await expect(page.getByRole('banner')).toContainText('Hoje')
    await waitForRailSettled(page)
    // O tablet nasce em rail: os nomes acessíveis vêm de `aria-label` e o
    // agrupador some do texto — composição sem nenhuma cobertura antes da 13.4.
    await expect(mainNav(page).getByRole('button', { name: 'Hoje', exact: true })).toBeVisible()
    await expect(mainNav(page).getByText('Hoje', { exact: true })).toHaveCount(0)

    await expectNoAxeViolations(page, { exclude: 'main', label: 'tablet · /today · rail' })
  })

  test('tablet · /habits · collection avulsa derivada do registro', async ({ page }) => {
    await gotoShellRoute(page, '/habits', 'Hábitos')
    await waitForRailSettled(page)
    await expect(mainNav(page).getByRole('button', { name: 'Hábitos', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await expectNoAxeViolations(page, { exclude: 'main', label: 'tablet · /habits · rail' })
  })
})

test.describe('Matriz axe — compact 390×720', () => {
  test.use({ viewport: { width: 390, height: 720 } })

  test('compact 390 · /today · topbar + bottom nav + FAB', async ({ page }) => {
    await expect(page.getByRole('banner')).toContainText('Hoje')
    await expect(bottomNav(page)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Captura rápida', exact: true })).toBeVisible()

    // A 13.1 media só 320: 390 é a largura real de um telefone moderno e a
    // composição da barra (4 colunas com label) muda com ela.
    await expectNoAxeViolations(page, { exclude: 'main', label: 'compact 390 · /today · topbar + bottom nav + FAB' })
  })

  test('compact 390 · /health/metrics · Menu selecionado', async ({ page }) => {
    // Rota fora dos 3 atalhos ⇒ o item Menu aparece selecionado com
    // `aria-current="page"` (divergência contratada DIV-10 do checklist): o
    // atributo num botão que abre sheet precisa passar nome/papel/estado no axe.
    await gotoShellRoute(page, '/health/metrics', 'Métricas de Saúde')
    await expect(bottomNav(page).getByRole('button', { name: 'Menu' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await expectNoAxeViolations(page, {
      exclude: 'main',
      label: 'compact 390 · /health/metrics · Menu selecionado',
    })
  })

  test('compact 390 · /today · Capture Sheet aberto pelo FAB', async ({ page }) => {
    await openCaptureSheet(page, 'fab')

    await expectNoAxeViolations(page, {
      exclude: ['main', LEGACY_CAPTURE_SURFACE],
      label: 'compact 390 · /today · Capture Sheet aberto pelo FAB',
    })
  })

  test('compact 390 · /today · offline (FAB aria-disabled)', async ({ page, context }) => {
    await expect(page.getByRole('button', { name: 'Captura rápida', exact: true })).toBeVisible()
    await context.setOffline(true)
    await expect(page.getByRole('button', { name: 'Captura rápida (sem conexão)' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )

    // Offline não pode degradar navegação nem leitura: a barra segue completa.
    await expect(bottomNav(page).getByRole('button')).toHaveCount(4)

    await expectNoAxeViolations(page, {
      exclude: 'main',
      label: 'compact 390 · /today · offline (FAB aria-disabled)',
    })
  })
})

test.describe('Matriz axe — compact 320×720', () => {
  test.use({ viewport: { width: 320, height: 720 } })

  test('compact 320 · /today · reflow mínimo', async ({ page }) => {
    // No compact o shell novo passa a ter topbar (o AppLayout legado não tinha).
    await expect(page.getByRole('banner')).toContainText('Hoje')
    await expect(bottomNav(page)).toBeVisible()

    // SHELL-DEBT-01 FECHADA (Story 13.3): a `ShellBottomNav` nova entra no gate
    // — o label não-selecionado usa `--ds-ink-muted` sobre `--ds-surface`
    // (≥4.5:1) e precisa passar `color-contrast` no axe real. Só o `<main>` da
    // superfície legada permanece fora (SHELL-DEBT-02).
    await expectNoAxeViolations(page, { exclude: 'main', label: 'compact 320 · /today · reflow mínimo' })
  })

  test('compact 320 · /archive · prefixo profundo na faixa mínima', async ({ page }) => {
    await gotoShellRoute(page, '/archive', 'Arquivo')
    await expect(bottomNav(page).getByRole('button', { name: 'Menu' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await expectNoAxeViolations(page, { exclude: 'main', label: 'compact 320 · /archive · prefixo profundo' })
  })
})
