import type { Page } from '@playwright/test'

import { test, expect } from './fixtures'
import {
  bottomNav,
  captureSheet,
  dsToken,
  dsTokenPx,
  hexToRgb,
  mainNav,
  navigationSheet,
  sidebarPaper,
  waitForSheetSettled,
} from './shellHelpers'

// AUDITORIA DE TECLADO, FOCO, LIVE REGION, ZOOM 200% e REFLOW 320 do App Shell
// (Story 13.4 AC5/AC6) num browser real. É o complemento do gate axe
// (`shell-a11y.spec.ts`): o axe mede regras estáticas por nó, não ordem de
// tabulação, não foco encoberto por chrome fixo (WCAG 2.2 `2.4.11`), não escopo
// de atalho por faixa e não recomposição do chrome sob zoom.
//
// Nada aqui é exercível em jsdom: ordem de Tab real, `:focus-visible` resolvido,
// geometria medida contra chrome `position: fixed`, e a troca de composição
// wide → compact quando o viewport cai abaixo de 768 CSS px.
//
//   ▶ `prefers-reduced-motion` está FORA deste spec por decisão consciente do
//     dono (UX-DR30 item 6 dispensado para o App Shell — Hugo, 2026-07-24;
//     `A11Y-07` do checklist é waiver, não dívida). Não há teste de reduced
//     motion aqui de propósito.
//
// [Source: Story 13.4 AC5/AC6; EXPERIENCE.md §Accessibility Floor /
//  §Interaction Primitives; 13-shell-parity-checklist.md KB-01…KB-03,
//  RA-01…RA-03, A11Y-01…A11Y-06]

const SHELL_CONTENT_ID = 'conteudo-da-superficie'
const SKIP_LINK_NAME = 'Pular para o conteúdo'

/**
 * Enumerador de focáveis VISÍVEIS em ordem de DOM. Filtra o que o `SwipeableDrawer`
 * do Capture Sheet mantém montado-e-oculto (`keepMounted` do MUI) e o que o Modal
 * do sheet de navegação marca como inerte (`aria-hidden`) — senão "o último
 * focável" seria um controle que o usuário nunca alcança.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

interface FocusReport {
  name: string
  /** Está INTEIRO dentro do viewport ao receber foco? */
  inViewport: boolean
  /** Nada o cobre no seu próprio centro? (hit-test real — WCAG 2.2 `2.4.11`) */
  onTop: boolean
  rect: { top: number; right: number; bottom: number; left: number }
  viewport: { width: number; height: number }
}

/**
 * Foca o primeiro/último focável visível e devolve o laudo de visibilidade e de
 * "não encoberto". O `elementFromPoint` é o teste rigoroso do `2.4.11`: se
 * topbar, bottom nav, FAB, safe-area ou a faixa DEV cobrissem o controle focado,
 * o hit-test do centro devolveria o elemento de cima, não o focado.
 */
async function focusEdgeControl(page: Page, which: 'first' | 'last'): Promise<FocusReport> {
  return page.evaluate(
    ({ pick, selector }) => {
      const isVisible = (el: HTMLElement) => {
        const style = getComputedStyle(el)
        if (style.visibility === 'hidden' || style.display === 'none') return false
        if (el.closest('[aria-hidden="true"], [inert]')) return false
        // `position: fixed` não tem `offsetParent`; o skip link é fixo e fica
        // fora da tela até receber foco, então não pode ser filtrado por rect.
        if (style.position === 'fixed') return true
        return el.offsetParent !== null && el.getClientRects().length > 0
      }
      const els = [...document.querySelectorAll<HTMLElement>(selector)].filter(isVisible)
      const el = pick === 'first' ? els[0] : els[els.length - 1]
      el.focus()

      const rect = el.getBoundingClientRect()
      const width = document.documentElement.clientWidth
      const height = document.documentElement.clientHeight
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const hit = document.elementFromPoint(centerX, centerY)

      return {
        name: el.getAttribute('aria-label') || el.textContent?.trim() || el.tagName.toLowerCase(),
        inViewport:
          rect.width > 0 &&
          rect.height > 0 &&
          rect.top >= -0.5 &&
          rect.left >= -0.5 &&
          rect.bottom <= height + 0.5 &&
          rect.right <= width + 0.5,
        onTop: Boolean(hit) && (el.contains(hit) || hit!.contains(el)),
        rect: { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left },
        viewport: { width, height },
      }
    },
    { pick: which, selector: FOCUSABLE_SELECTOR },
  )
}

/**
 * Nomes acessíveis (aproximados) dos focáveis visíveis, em ordem de DOM.
 *
 * O texto IGNORA subárvores `aria-hidden`: o chevron decorativo do agrupador
 * (`⌄`/`⌃`) entra no `textContent` mas não no nome acessível — sem isso o nome do
 * Planner viria como `"Planner⌃"`.
 */
async function focusableNames(page: Page): Promise<string[]> {
  return page.evaluate((selector) => {
    const isVisible = (el: HTMLElement) => {
      const style = getComputedStyle(el)
      if (style.visibility === 'hidden' || style.display === 'none') return false
      if (el.closest('[aria-hidden="true"], [inert]')) return false
      if (style.position === 'fixed') return true
      return el.offsetParent !== null && el.getClientRects().length > 0
    }
    const nameOf = (el: HTMLElement) => {
      const label = el.getAttribute('aria-label')
      if (label) return label
      const clone = el.cloneNode(true) as HTMLElement
      clone.querySelectorAll('[aria-hidden]').forEach((node) => node.remove())
      return clone.textContent?.trim() || el.tagName.toLowerCase()
    }
    return [...document.querySelectorAll<HTMLElement>(selector)].filter(isVisible).map(nameOf)
  }, FOCUSABLE_SELECTOR)
}

async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
}

/**
 * Asserts comuns de "primeiro e último focáveis" numa faixa: alcançáveis por
 * teclado, inteiramente visíveis e não encobertos, com as faixas de chrome fixo
 * lidas dos TOKENS (nunca 0 assumido — no ambiente e2e `--dev-banner-height` é
 * 28px, porque `.env.e2e` define `VITE_APP_ENV=development`).
 */
async function expectEdgeControlsUnobscured(page: Page, { compact }: { compact: boolean }) {
  const devBanner = await dsTokenPx(page, '--dev-banner-height')
  expect(devBanner, 'faixa DEV ativa no e2e — nunca assumir 0').toBeGreaterThan(0)
  const bottomNavHeight = compact ? await dsTokenPx(page, '--ds-bottom-nav-height') : 0

  const first = await focusEdgeControl(page, 'first')
  expect(first.name).toBe(SKIP_LINK_NAME)
  expect(first.inViewport, `primeiro focável "${first.name}" saiu do viewport`).toBe(true)
  expect(first.onTop, `primeiro focável "${first.name}" está encoberto`).toBe(true)
  // Abaixo da faixa DEV, que empurra o documento inteiro (`body.dev-env`).
  expect(first.rect.top).toBeGreaterThanOrEqual(devBanner - 0.5)

  const last = await focusEdgeControl(page, 'last')
  expect(last.inViewport, `último focável "${last.name}" saiu do viewport`).toBe(true)
  expect(last.onTop, `último focável "${last.name}" está encoberto`).toBe(true)
  expect(last.rect.top).toBeGreaterThanOrEqual(devBanner - 0.5)
  // No compact, o último focável é o próprio chrome fixo (FAB, acima da barra):
  // ele não pode estar SOB a bottom nav — o `onTop` acima já garante que nada o
  // cobre; aqui a folga contra o rodapé é medida pelo token.
  expect(last.rect.bottom).toBeLessThanOrEqual(last.viewport.height + 0.5)
  if (compact) {
    expect(bottomNavHeight, 'token da bottom nav lido do DOM').toBeGreaterThan(0)
    // A FAIXA da barra fixa é território proibido para o último focável: o FAB
    // vive `bottom = bottom-nav + safe-area + 16px`, logo sua borda inferior fica
    // ACIMA da barra. Sem este assert o token era lido e descartado, e só o
    // hit-test do centro mediria a sobreposição (um controle mais alto que o FAB
    // poderia invadir a barra pela base sem que o centro fosse coberto).
    expect(
      last.rect.bottom,
      `último focável "${last.name}" invade a faixa da bottom nav (${bottomNavHeight}px)`,
    ).toBeLessThanOrEqual(last.viewport.height - bottomNavHeight + 0.5)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AC5 — Teclado, ordem de foco, foco visível/não encoberto e live region única
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Teclado e foco — wide 1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  // A11Y-01 · WCAG 2.4.1 — o primeiro focável é o skip link e ele move o foco
  // para o wrapper de conteúdo (que NÃO é um segundo `<main>`).
  test('skip link é o primeiro focável e leva ao wrapper de conteúdo', async ({ page }) => {
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: SKIP_LINK_NAME })).toBeFocused()

    await page.keyboard.press('Enter')
    await expect(page.locator(`#${SHELL_CONTENT_ID}`)).toBeFocused()
  })

  // WCAG 2.4.3 — a ordem de Tab acompanha a ordem visual: chrome (skip link →
  // sidebar, da esquerda para a direita) ANTES do conteúdo. Asserts por nome
  // acessível, nunca por índice cru.
  test('ordem de Tab acompanha a ordem visual: skip link → sidebar → conteúdo', async ({ page }) => {
    // Asserts pelo NOME ACESSÍVEL calculado pelo browser (locator do Playwright),
    // não por índice cru nem por `textContent`.
    const expected = [
      page.getByRole('link', { name: SKIP_LINK_NAME }),
      mainNav(page).getByRole('button', { name: 'Colapsar sidebar' }),
      mainNav(page).getByRole('button', { name: 'Hoje', exact: true }),
      mainNav(page).getByRole('button', { name: 'Planner', exact: true }),
      mainNav(page).getByRole('button', { name: 'Esta Semana', exact: true }),
    ]
    for (const [index, locator] of expected.entries()) {
      await page.keyboard.press('Tab')
      await expect(locator, `Tab #${index + 1}`).toBeFocused()
    }

    // Todo o chrome da navegação vem antes do primeiro controle do conteúdo: a
    // âncora de captura é o último item da sidebar, e o conteúdo começa depois.
    const names = await focusableNames(page)
    expect(names.indexOf('Abrir captura rápida')).toBeGreaterThan(names.indexOf('Configurações'))
    expect(names.indexOf('Abrir captura rápida')).toBeLessThan(names.indexOf('Nova tarefa'))
  })

  // WCAG 2.2 2.4.11 — nenhum controle focado fica encoberto por chrome
  // fixo/sticky, faixa DEV incluída.
  test('primeiro e último focáveis ficam visíveis e não encobertos', async ({ page }) => {
    await expectEdgeControlsUnobscured(page, { compact: false })
  })

  // A11Y-06 · WCAG 2.4.7 — o anel de foco resolve a partir dos TOKENS (cor,
  // largura e offset lidos do DOM, nada hardcodado no spec).
  test('foco visível resolve outline de --ds-focus com 2px e offset 2px', async ({ page }) => {
    // Tab de verdade ⇒ `:focus-visible` casa (um `.focus()` programático não).
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await expect(mainNav(page).getByRole('button', { name: 'Colapsar sidebar' })).toBeFocused()

    const ring = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement
      const style = getComputedStyle(el)
      return {
        width: style.outlineWidth,
        style: style.outlineStyle,
        color: style.outlineColor,
        offset: style.outlineOffset,
      }
    })
    expect(ring.style).toBe('solid')
    expect(ring.width).toBe(await dsToken(page, '--ds-focus-ring-width'))
    expect(ring.offset).toBe(await dsToken(page, '--ds-focus-ring-offset'))
    expect(ring.color).toBe(hexToRgb(await dsToken(page, '--ds-focus')))
  })

  // RA-01/RA-02 · WCAG 4.1.3 — UMA única live region de rota no chrome. A topbar
  // mostra o mesmo título de forma ESTÁTICA. O assert é escopado ao chrome: o
  // `<main>` legado tem live regions próprias (TaskRow, HealthHistory…).
  test('o chrome tem exatamente uma live region de rota; a topbar é estática', async ({ page }) => {
    const chromeLiveRegions = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('[aria-live], [role="status"], [role="alert"]')]
      return nodes
        .filter((node) => !node.closest('main'))
        .map((node) => ({
          role: node.getAttribute('role'),
          live: node.getAttribute('aria-live'),
          text: node.textContent?.trim() ?? '',
        }))
    })
    expect(chromeLiveRegions).toEqual([{ role: 'status', live: 'polite', text: 'Hoje' }])

    const banner = page.getByRole('banner')
    await expect(banner).toContainText('Hoje')
    await expect(banner).not.toHaveAttribute('aria-live')
    await expect(banner).not.toHaveAttribute('role', 'status')

    // Ao navegar, o anúncio continua único (não nasce uma segunda region).
    await mainNav(page).getByText('Arquivo', { exact: true }).click()
    await expect(page).toHaveURL('/archive')
    await expect(banner).toContainText('Arquivo')
    await expect(page.getByRole('status')).toHaveCount(1)
  })
})

test.describe('Teclado e foco — medium 1280×800', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('skip link é o primeiro focável e leva ao wrapper de conteúdo (medium)', async ({ page }) => {
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: SKIP_LINK_NAME })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator(`#${SHELL_CONTENT_ID}`)).toBeFocused()
  })

  test('primeiro e último focáveis ficam visíveis e não encobertos (medium)', async ({ page }) => {
    await expectEdgeControlsUnobscured(page, { compact: false })
  })

  // KB-01/KB-02/KB-03 — a faixa medium é o limite INFERIOR do escopo dos atalhos
  // (`(min-width: 1024px)`): eles precisam funcionar aqui, e a 13.3 nunca mediu
  // esta faixa.
  test('atalhos [ e B funcionam em medium, com guard de campo editável e de modificador', async ({
    page,
  }) => {
    const paper = sidebarPaper(page)
    await expect(paper).toHaveCSS('width', '240px')

    await page.keyboard.press('[')
    await expect(paper).toHaveCSS('width', '64px')
    await page.keyboard.press('[')
    await expect(paper).toHaveCSS('width', '240px')

    // Guard de modificador em AMBOS os atalhos (AC5: "ambos … com guard de
    // ctrl/meta/alt") — senão o shell sequestra atalhos NATIVOS do browser/OS.
    await page.keyboard.press('Control+b')
    await expect(page).toHaveURL('/today')
    await page.keyboard.press('Meta+b')
    await expect(page).toHaveURL('/today')
    await page.keyboard.press('Alt+b')
    await expect(page).toHaveURL('/today')

    // `Cmd+[` é "voltar" no macOS: com modificador, o `[` NÃO pode colapsar a
    // sidebar. (Assimetria encontrada na review da 13.4 — o guard existia só
    // para o `B`, e nenhum teste cobria o `[`.)
    await page.keyboard.press('Control+[')
    await expect(paper).toHaveCSS('width', '240px')
    await page.keyboard.press('Meta+[')
    await expect(paper).toHaveCSS('width', '240px')
    await page.keyboard.press('Alt+[')
    await expect(paper).toHaveCSS('width', '240px')

    // Guard de campo editável: dentro de um input, `[` e `b` são digitação.
    const novaTarefa = page.getByLabel('Nova tarefa')
    await novaTarefa.click()
    await page.keyboard.type('[b')
    await expect(novaTarefa).toHaveValue('[b')
    await expect(paper).toHaveCSS('width', '240px')
    await expect(page).toHaveURL('/today')

    // Fora do campo, `b` navega.
    await novaTarefa.blur()
    await page.keyboard.press('b')
    await expect(page).toHaveURL('/brain-dump')
  })

  // WCAG 2.4.3 em CADA faixa (AC5): medium compartilha a composição de chrome do
  // wide, mas é uma faixa própria da matriz (gutter e workspace máximo diferem) —
  // e a ordem de Tab dela não estava assertada em lugar nenhum.
  test('ordem de Tab acompanha a ordem visual em medium (chrome antes do conteúdo)', async ({
    page,
  }) => {
    const expected = [
      page.getByRole('link', { name: SKIP_LINK_NAME }),
      mainNav(page).getByRole('button', { name: 'Colapsar sidebar' }),
      mainNav(page).getByRole('button', { name: 'Hoje', exact: true }),
      mainNav(page).getByRole('button', { name: 'Planner', exact: true }),
      mainNav(page).getByRole('button', { name: 'Esta Semana', exact: true }),
    ]
    for (const [index, locator] of expected.entries()) {
      await page.keyboard.press('Tab')
      await expect(locator, `Tab #${index + 1} (medium)`).toBeFocused()
    }

    const names = await focusableNames(page)
    expect(names.indexOf('Abrir captura rápida')).toBeGreaterThan(names.indexOf('Configurações'))
    expect(names.indexOf('Abrir captura rápida')).toBeLessThan(names.indexOf('Nova tarefa'))
  })
})

test.describe('Teclado e foco — tablet 800×720', () => {
  test.use({ viewport: { width: 800, height: 720 } })

  test('skip link é o primeiro focável e leva ao wrapper de conteúdo (tablet)', async ({ page }) => {
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: SKIP_LINK_NAME })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator(`#${SHELL_CONTENT_ID}`)).toBeFocused()
  })

  test('primeiro e último focáveis ficam visíveis e não encobertos (tablet, rail)', async ({
    page,
  }) => {
    await expect(sidebarPaper(page)).toHaveCSS('width', '64px')
    await expectEdgeControlsUnobscured(page, { compact: false })
  })

  // WCAG 2.4.3 no RAIL — a composição mais distinta do chrome: os nomes
  // acessíveis passam a vir de `aria-label`, os filhos dos agrupadores estão
  // DESMONTADOS (`Collapse unmountOnExit`) e o toggle inverte o rótulo. A ordem de
  // Tab da faixa tablet não estava assertada como SEQUÊNCIA em nenhum spec.
  test('ordem de Tab no rail do tablet: toggle → destinos por aria-label → captura', async ({
    page,
  }) => {
    // O tablet nasce expandido e colapsa por efeito: esperar o rail ASSENTAR
    // (paper em 64px E filhos de grupo desmontados) antes de enumerar focáveis.
    await expect(sidebarPaper(page)).toHaveCSS('width', '64px')
    await expect(mainNav(page).getByRole('button', { name: 'Futuro' })).toHaveCount(0)

    const expected = [
      page.getByRole('link', { name: SKIP_LINK_NAME }),
      mainNav(page).getByRole('button', { name: 'Expandir sidebar' }),
      mainNav(page).getByRole('button', { name: 'Hoje', exact: true }),
      mainNav(page).getByRole('button', { name: 'Planner', exact: true }),
      // Sem os filhos do Planner no rail, o próximo é a collection avulsa.
      mainNav(page).getByRole('button', { name: 'Hábitos', exact: true }),
    ]
    for (const [index, locator] of expected.entries()) {
      await page.keyboard.press('Tab')
      await expect(locator, `Tab #${index + 1} (rail)`).toBeFocused()
    }

    // A sequência COMPLETA do chrome em rail, terminando na âncora de captura —
    // e o conteúdo só depois dela.
    const names = await focusableNames(page)
    expect(names.slice(0, 11)).toEqual([
      SKIP_LINK_NAME,
      'Expandir sidebar',
      'Hoje',
      'Planner',
      'Hábitos',
      'Saúde',
      'Gratidão',
      'Brain Dump',
      'Arquivo',
      'Configurações',
      'Abrir captura rápida',
    ])
    expect(names.indexOf('Nova tarefa')).toBeGreaterThan(10)
  })

  // KB-03 — fora do escopo `(min-width: 1024px)`: nenhum dos dois atalhos age.
  test('atalhos [ e B NÃO valem em tablet', async ({ page }) => {
    const paper = sidebarPaper(page)
    await expect(paper).toHaveCSS('width', '64px')

    await page.keyboard.press('[')
    await expect(paper).toHaveCSS('width', '64px')

    await page.keyboard.press('b')
    await expect(page).toHaveURL('/today')
  })
})

test.describe('Teclado e foco — compact 390×720', () => {
  test.use({ viewport: { width: 390, height: 720 } })

  test('skip link é o primeiro focável e leva ao wrapper de conteúdo (compact)', async ({ page }) => {
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: SKIP_LINK_NAME })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator(`#${SHELL_CONTENT_ID}`)).toBeFocused()
  })

  // Caso limítrofe CONHECIDO e registrado (não corrigido de propósito): no DOM o
  // `ShellLayout` renderiza a bottom nav ANTES do FAB, mas visualmente o FAB fica
  // ACIMA da barra. WCAG 2.4.3 pede ordem que preserve significado e
  // operabilidade — não coincidência pixel a pixel. Reordenar o DOM mudaria o
  // `pb`/`scroll-padding` do compact e o gate axe da 13.3.
  test('ordem de Tab no compact: conteúdo → bottom nav → FAB, todos alcançáveis', async ({
    page,
  }) => {
    const names = await focusableNames(page)

    expect(names[0]).toBe(SKIP_LINK_NAME)
    // Os 3 atalhos + Menu aparecem consecutivos, na ordem visual da barra.
    const hojeIndex = names.lastIndexOf('Hoje')
    expect(names.slice(hojeIndex, hojeIndex + 4)).toEqual([
      'Hoje',
      'Esta Semana',
      'Este Mês',
      'Menu',
    ])
    // O FAB vem imediatamente DEPOIS do Menu no DOM, apesar de ficar acima da
    // barra na tela — comportamento verificado e registrado no checklist.
    expect(names[hojeIndex + 4]).toBe('Abrir captura rápida')
    // O conteúdo vem antes da barra (ordem visual: topbar → conteúdo → barra).
    expect(names.indexOf('Nova tarefa')).toBeLessThan(hojeIndex)

    // Ambos alcançáveis POR TECLADO de fato (não só presentes no DOM).
    await page.getByRole('button', { name: 'Menu' }).focus()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Abrir captura rápida', exact: true })).toBeFocused()
  })

  test('primeiro e último focáveis ficam visíveis e não encobertos (compact)', async ({ page }) => {
    await expectEdgeControlsUnobscured(page, { compact: true })
  })

  test('foco visível resolve outline de --ds-focus na bottom nav (compact)', async ({ page }) => {
    await page.getByRole('button', { name: 'Este Mês' }).focus()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Menu' })).toBeFocused()

    const ring = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as HTMLElement)
      return { width: style.outlineWidth, style: style.outlineStyle, color: style.outlineColor }
    })
    expect(ring.style).toBe('solid')
    expect(ring.width).toBe(await dsToken(page, '--ds-focus-ring-width'))
    expect(ring.color).toBe(hexToRgb(await dsToken(page, '--ds-focus')))
  })

  // A11Y-06 · WCAG 2.4.7 DENTRO DO PORTAL. O sheet de navegação é chrome, mas o
  // MUI o renderiza num portal em `document.body` — logo ele NÃO é descendente do
  // `shell-root`, onde vive a regra `'& :focus-visible'` do `ShellLayout`. É
  // exatamente a mesma classe de armadilha que a 13.3 documentou para os tokens
  // (`var()` do root não alcança o paper do portal, reaplicados por `style` nos
  // slots): sem a regra reaplicada, o foco dentro do sheet cai no anel DEFAULT do
  // browser e o piso "todo controle do chrome exibe o focus-ring do token" deixa
  // de valer numa superfície inteira do chrome compact.
  test('foco visível usa o anel do token também DENTRO do sheet portalizado', async ({ page }) => {
    const menu = bottomNav(page).getByRole('button', { name: 'Menu' })
    await menu.click()
    await expect(navigationSheet(page)).toBeVisible()
    await waitForSheetSettled(page)

    // Tab REAL dentro do trap ⇒ `:focus-visible` casa (o foco inicial do sheet é
    // programático e, depois de um clique, o Chromium não o trata como visível).
    await page.keyboard.press('Tab')

    const ring = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement
      const style = getComputedStyle(el)
      return {
        insideSheet: Boolean(el.closest('.MuiDrawer-paper')),
        name: el.getAttribute('aria-label') || el.textContent?.trim() || el.tagName,
        width: style.outlineWidth,
        style: style.outlineStyle,
        color: style.outlineColor,
        offset: style.outlineOffset,
      }
    })

    expect(ring.insideSheet, `o foco escapou do sheet (foi para "${ring.name}")`).toBe(true)
    expect(ring.style, `anel de foco de "${ring.name}"`).toBe('solid')
    expect(ring.width).toBe(await dsToken(page, '--ds-focus-ring-width'))
    expect(ring.offset).toBe(await dsToken(page, '--ds-focus-ring-offset'))
    expect(ring.color).toBe(hexToRgb(await dsToken(page, '--ds-focus')))
  })

  // KB-03 — atalhos são desktop-only: no compact `[` e `b` não fazem nada (e não
  // existe sidebar para colapsar).
  test('atalhos [ e B NÃO valem no compact', async ({ page }) => {
    await page.keyboard.press('[')
    await page.keyboard.press('b')
    await expect(page).toHaveURL('/today')
    await expect(mainNav(page)).toHaveCount(0)
  })

  // EXPERIENCE §Resiliência canônica — `Escape` fecha o sheet DEVOLVENDO o foco
  // ao acionador (Menu). O spec da 13.3 provava o retorno de foco pelo botão
  // Fechar e pelo backdrop; por `Escape` só provava o fechamento.
  test('Escape fecha o sheet e devolve o foco ao Menu', async ({ page }) => {
    const menu = bottomNav(page).getByRole('button', { name: 'Menu' })
    await menu.click()
    await expect(navigationSheet(page)).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(navigationSheet(page)).toBeHidden()
    await expect(menu).toBeFocused()
  })

  test('o chrome do compact tem exatamente uma live region de rota', async ({ page }) => {
    const chromeLiveRegions = await page.evaluate(() =>
      [...document.querySelectorAll('[aria-live], [role="status"], [role="alert"]')]
        .filter((node) => !node.closest('main'))
        .map((node) => `${node.getAttribute('role')}/${node.getAttribute('aria-live')}`),
    )
    expect(chromeLiveRegions).toEqual(['status/polite'])
    await expect(page.getByRole('banner')).not.toHaveAttribute('aria-live')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC6 — Zoom 200% e reflow em 320 CSS px
//
// EMULAÇÃO ESCOLHIDA (e por quê): zoom de 200% é emulado por VIEWPORT em CSS px
// equivalentes — metade das dimensões da faixa de origem (1440×900 → 720×450;
// 1280×800 → 640×400). É a única emulação previsível para `1.4.4`/`1.4.10` no
// Chromium: `Emulation.setPageScaleFactor` (CDP) é pinch-zoom, escala pixels sem
// mudar CSS px e sem refluir o layout; `document.documentElement.style.zoom`
// recompõe, mas interage com `position: fixed`, `100svh` e
// `env(safe-area-inset-*)` do chrome — só serviria como complemento, e a
// equivalência por viewport já exercita exatamente o que o piso exige: nenhuma
// perda de conteúdo ou ação abaixo de 320 CSS px de largura efetiva.
// ─────────────────────────────────────────────────────────────────────────────

/** Todo o chrome de navegação e captura segue alcançável e acionável. */
async function expectChromeUsableInCompact(page: Page): Promise<void> {
  const nav = bottomNav(page)
  await expect(nav).toBeVisible()
  for (const label of ['Hoje', 'Esta Semana', 'Este Mês', 'Menu']) {
    await expect(nav.getByRole('button', { name: label })).toBeVisible()
  }
  await expect(page.getByRole('button', { name: 'Abrir captura rápida', exact: true })).toBeVisible()

  // Nenhum destino perdido na recomposição: o sheet lista TODOS.
  await nav.getByRole('button', { name: 'Menu' }).click()
  const sheet = navigationSheet(page)
  await expect(sheet).toBeVisible()
  for (const label of ['Hoje', 'Planner', 'Hábitos', 'Saúde', 'Gratidão', 'Configurações']) {
    const item = sheet.getByRole('button', { name: label, exact: true })
    await item.scrollIntoViewIfNeeded()
    await expect(item).toBeVisible()
  }
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()

  // Captura acionável de fato (não só visível).
  await page.getByRole('button', { name: 'Abrir captura rápida', exact: true }).click()
  await expect(captureSheet(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(captureSheet(page)).toBeHidden()
}

test.describe('Reflow 320×720 (WCAG 1.4.10)', () => {
  test.use({ viewport: { width: 320, height: 720 } })

  test('320 CSS px: sem scroll horizontal, navegação e captura alcançáveis', async ({ page }) => {
    expect(await hasHorizontalScroll(page)).toBe(false)
    await expectChromeUsableInCompact(page)
    expect(await hasHorizontalScroll(page)).toBe(false)
  })

  test('320 CSS px: primeiro e último focáveis visíveis e não encobertos', async ({ page }) => {
    await expectEdgeControlsUnobscured(page, { compact: true })
  })
})

test.describe('Zoom 200% a partir de wide (1440×900 → 720×450)', () => {
  test.use({ viewport: { width: 720, height: 450 } })

  // A recomposição É parte do aceite: 720 CSS px cai abaixo de 768, então o
  // chrome troca sidebar por topbar + 3 atalhos + Menu + FAB. Nenhum destino ou
  // ação pode ficar inalcançável na troca.
  test('chrome recompõe para compact sem perder destino nem ação', async ({ page }) => {
    await expect(mainNav(page)).toHaveCount(0)
    await expect(page.getByRole('banner')).toContainText('Hoje')
    expect(await hasHorizontalScroll(page)).toBe(false)

    await expectChromeUsableInCompact(page)
    expect(await hasHorizontalScroll(page)).toBe(false)
  })

  test('primeiro e último focáveis visíveis e não encobertos sob zoom 200%', async ({ page }) => {
    await expectEdgeControlsUnobscured(page, { compact: true })
  })
})

test.describe('Zoom 200% a partir de medium (1280×800 → 640×400)', () => {
  test.use({ viewport: { width: 640, height: 400 } })

  test('chrome recompõe para compact sem perder destino nem ação (640×400)', async ({ page }) => {
    await expect(mainNav(page)).toHaveCount(0)
    expect(await hasHorizontalScroll(page)).toBe(false)

    await expectChromeUsableInCompact(page)
    expect(await hasHorizontalScroll(page)).toBe(false)
  })

  test('primeiro e último focáveis visíveis e não encobertos (640×400)', async ({ page }) => {
    await expectEdgeControlsUnobscured(page, { compact: true })
  })
})
