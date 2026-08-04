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

/**
 * Navega pelo item de menu com nome acessível `destination` (sidebar/bottom
 * nav) e espera a superfície de destino aparecer (`<main aria-label>`).
 * Promovido na Story 14.5 — a mesma função existia DUPLICADA em
 * `weekly-monthly-cycle.spec.ts` (:68-71) e `ritual-sources.spec.ts` (:132-135).
 */
export async function navigate(page: Page, destination: string): Promise<void> {
  await page.getByRole('button', { name: destination }).click()
  await expect(page.getByLabel(destination)).toBeVisible()
}

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
 * O elemento está INTEIRAMENTE dentro da viewport — a prova GEOMÉTRICA de
 * "aparece sobreposto e imediatamente visível, sem rolagem".
 *
 * `toBeVisible()` NÃO cobre isso: um elemento no fluxo normal do DOM, abaixo da
 * dobra, é "visível" para o Playwright. Foi exatamente esse o defeito dos
 * seletores de destino dos rituais (`if (!compact) return content` — sem
 * `Dialog` no desktop, o conteúdo entrava no fluxo depois da grade de 3 colunas
 * e nascia fora da tela). Chamar ANTES de qualquer `.click()` no próprio
 * elemento: o Playwright rola o alvo para a viewport antes de clicar, o que
 * mascararia a regressão.
 *
 * As coordenadas de `boundingBox()` JÁ são relativas à viewport, então não há
 * nada a afirmar sobre `window.scrollY` aqui: afirmar isso acoplaria o helper à
 * posição do GATILHO na página (o Playwright rola para clicar em
 * "Alocar"/"Escolher destino…"), reprovando por um motivo que não é o do
 * diálogo.
 */
export async function expectVisibleWithoutScrolling(page: Page, locator: Locator): Promise<void> {
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1)
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

/**
 * Espera o Fade de entrada de um `<Dialog>` (MUI) ASSENTAR. `toBeVisible()`
 * resolve assim que o elemento entra no DOM, muito antes da opacidade do
 * `.MuiDialog-container` (onde o `Fade` injeta `style.opacity`, NÃO no
 * `.MuiDialog-paper`) chegar a 1 — qualquer `analyze()` do axe tirado antes
 * disso mede o card translúcido em transição e acusa `color-contrast` falso
 * (achado real da Story 14.5, QA e2e: o `TaskDetailCard` some quase por
 * completo se medido a ~14ms da abertura). Mesmo padrão de `waitForSheetSettled`.
 */
export async function waitForDialogSettled(page: Page): Promise<void> {
  await expect
    .poll(async () =>
      page.locator('.MuiDialog-container').evaluate((el) => getComputedStyle(el).opacity),
    )
    .toBe('1')
}
