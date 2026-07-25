import { expect, type Locator, type Page } from '@playwright/test'

// Locators e utilitários COMPARTILHADOS pelos specs E2E do App Shell
// (`shell.spec.ts`, `shell-a11y.spec.ts`, `shell-sidebar.spec.ts`,
// `shell-bottomnav.spec.ts`, `shell-keyboard.spec.ts`).
//
// Extraídos na Story 13.4: `dsToken`/`hexToRgb`/`computed`/`waitForSheetSettled` e
// os locators do chrome existiam DUPLICADOS em `shell-sidebar.spec.ts` e
// `shell-bottomnav.spec.ts`, e a matriz de acessibilidade + a auditoria de
// teclado precisam dos mesmos. Um helper usado por dois specs mora num módulo,
// não em duas cópias que podem divergir (é a mesma lição do predicado de ativo,
// SHELL-DEBT-03).

// ─── Locators do chrome ──────────────────────────────────────────────────────

/** A nav principal (sidebar de wide/medium/tablet), onde vive a âncora de captura. */
export function mainNav(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Navegação principal' })
}

/** A bottom nav do compact (3 atalhos + Menu). */
export function bottomNav(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Atalhos de navegação' })
}

/** O sheet de navegação completa (aberto pelo item Menu). */
export function navigationSheet(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Navegação completa' })
}

/** O paper do `Drawer` permanente que contém a nav principal. */
export function sidebarPaper(page: Page): Locator {
  return page
    .locator('.MuiDrawer-paper')
    .filter({ has: page.getByRole('navigation', { name: 'Navegação principal' }) })
}

/** O paper do sheet de navegação (≠ paper do detalhe / da captura). */
export function sheetPaper(page: Page): Locator {
  return page
    .locator('.MuiDrawer-paper')
    .filter({ has: page.getByRole('navigation', { name: 'Navegação completa' }) })
}

/**
 * A raiz do Modal do sheet de navegação — o container que abriga backdrop e
 * paper. Escopada pela própria nav: o `BrainDumpCaptureSheet` também é um
 * `SwipeableDrawer` (montado mesmo fechado), então `.MuiDrawer-root` solto é
 * ambíguo.
 */
export function sheetModalRoot(page: Page): Locator {
  return page
    .locator('.MuiDrawer-root')
    .filter({ has: page.getByRole('navigation', { name: 'Navegação completa' }) })
}

/** O sheet de captura REAL (superfície legada reutilizada — Épico 15 migra). */
export function captureSheet(page: Page): Locator {
  return page.getByRole('dialog', { name: 'Captura rápida' })
}

// ─── Tokens, cor e geometria ─────────────────────────────────────────────────

/** Valor de um token `--ds-*`/`--dev-*` lido da raiz do shell (não hardcodado). */
export async function dsToken(page: Page, name: string): Promise<string> {
  return page
    .getByTestId('shell-root')
    .evaluate((el, tokenName) => getComputedStyle(el).getPropertyValue(tokenName).trim(), name)
}

/** O mesmo token, já em px numérico (`'64px'` → `64`). */
export async function dsTokenPx(page: Page, name: string): Promise<number> {
  return parseFloat(await dsToken(page, name))
}

/** `#315F5A` → `rgb(49, 95, 90)`, para comparar com `getComputedStyle` do Chrome. */
export function hexToRgb(hex: string): string {
  const value = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16))
  return `rgb(${r}, ${g}, ${b})`
}

export function computed(locator: Locator, property: string): Promise<string> {
  return locator.evaluate((el, prop) => getComputedStyle(el).getPropertyValue(prop), property)
}

/**
 * Espera o slide de entrada/saída do sheet de navegação ASSENTAR. O `toBeFocused`
 * do foco inicial passa cedo (o `ref` foca na montagem, antes do `onEntered`),
 * então qualquer medida de geometria — ou qualquer `analyze()` do axe — tirada
 * logo após a abertura pega o paper ainda transladado. O fim da transição é o
 * `transform` neutro.
 */
export async function waitForSheetSettled(page: Page): Promise<void> {
  await expect
    .poll(async () => computed(sheetPaper(page), 'transform'))
    .toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/)
}
