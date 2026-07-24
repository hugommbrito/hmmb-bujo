import type { Locator, Page } from '@playwright/test'

import { test, expect } from './fixtures'
import { expectNoAxeViolations } from './axeHelper'
import { seedBrainDumpItems } from './seedBrainDumpItems'

// E2E da SIDEBAR nova do shell (Story 13.2 — `ShellSidebar` derivada do manifest)
// num browser real. Complementa — não repete — o `ShellSidebar.test.tsx` (jsdom):
// aqui ficam só os contratos que jsdom NÃO consegue exercer de verdade:
//
//   · geometria medida do rail (240px ↔ 64px) e do badge (18px, cantos `full`),
//     porque jsdom não faz layout e não resolve `var(--ds-*)` em cor/px;
//   · cor resolvida dos canais de "ativo" (borda 3px `--ds-primary`, fundo
//     `--ds-primary-soft`) contra o valor do token lido do próprio DOM;
//   · troca real `weight="regular"` → `weight="fill"` do ícone Phosphor no
//     destino selecionado (o `d` do path muda — em jsdom o SVG é opaco);
//   · navegação de fato nas 4 collections derivadas do registro (o path vem de
//     `entry.routes[0].path`, então só o router real prova a derivação);
//   · nome acessível calculado pelo browser (o badge contribui a contagem exata
//     para o nome do destino Brain Dump);
//   · `9+` acima de 9 com contagem REAL do backend (`GET /api/brain-dump/count/`
//     com 12 itens semeados) e o caminho de erro do contador;
//   · colapso só-na-sessão através de um reload de verdade (nada persistido);
//   · tablet (800px) iniciando em rail e o escopo desktop-only do atalho `[`.
//
// A fixture faz signup real por teste e cai em `/today` já dentro do shell novo.
// [Source: Story 13.2 AC2–AC7; 13-shell-parity-checklist.md SB-01…SB-15, BD-01/BD-04,
//  DIV-1/DIV-4/DIV-5/DIV-6]

const CANONICAL_ORDER = [
  'Hoje',
  'Planner',
  'Esta Semana',
  'Este Mês',
  'Futuro',
  'Recorrentes',
  'Hábitos',
  'Saúde',
  'Métricas',
  'Medicamentos',
  'Gratidão',
  'Brain Dump',
  'Arquivo',
  'Configurações',
]

function mainNav(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Navegação principal' })
}

/** O paper do `Drawer` permanente que contém a nav principal (≠ paper do detalhe). */
function sidebarPaper(page: Page): Locator {
  return page
    .locator('.MuiDrawer-paper')
    .filter({ has: page.getByRole('navigation', { name: 'Navegação principal' }) })
}

/** Valor de um token `--ds-*` lido da raiz do shell (não hardcodado no spec). */
async function dsToken(page: Page, name: string): Promise<string> {
  return page
    .getByTestId('shell-root')
    .evaluate((el, prop) => getComputedStyle(el).getPropertyValue(prop).trim(), name)
}

/** `#315F5A` → `rgb(49, 95, 90)`, para comparar com `getComputedStyle` do Chrome. */
function hexToRgb(hex: string): string {
  const value = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16))
  return `rgb(${r}, ${g}, ${b})`
}

function computed(locator: Locator, property: string): Promise<string> {
  return locator.evaluate(
    (el, prop) => getComputedStyle(el).getPropertyValue(prop),
    property,
  )
}

test.describe('Sidebar do shell — wide 1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  // SB-01…SB-10 · AC2 — a ordem de render é o inventário canônico (idêntica à
  // `Sidebar` legada) E as 4 collections navegam de fato para o path que vem do
  // registro (`entry.routes[0].path`), com a topbar refletindo o título da rota.
  test('ordem canônica do inventário e navegação real das collections derivadas do manifest', async ({
    page,
  }) => {
    const nav = mainNav(page)

    await expect(nav.locator('.MuiListItemText-primary')).toHaveText(CANONICAL_ORDER)

    // As 4 collections do registro (label do `nav.label`, path do `routes[0].path`,
    // título da topbar do `routes[0].title`) — nenhuma delas hardcodada no chrome.
    const derived = [
      { label: 'Hábitos', url: '/habits', title: 'Hábitos' },
      { label: 'Métricas', url: '/health/metrics', title: 'Métricas de Saúde' },
      { label: 'Medicamentos', url: '/health/medications', title: 'Medicamentos' },
      { label: 'Gratidão', url: '/gratitude', title: 'Diário de Gratidão' },
    ]

    for (const { label, url, title } of derived) {
      await nav.getByText(label, { exact: true }).click()
      await expect(page).toHaveURL(url)
      await expect(page.getByRole('banner')).toContainText(title)
    }
  })

  // SB-11 · AC5 — "ativo" combina ≥4 canais, com os valores RESOLVIDOS dos tokens
  // (jsdom não resolve `var(--ds-*)`): borda-esquerda 3px `--ds-primary` + fundo
  // `--ds-primary-soft` + label em peso forte + `aria-current="page"`. O ícone em
  // `fill` é o 5º canal, coberto no teste do catálogo Phosphor.
  test('destino ativo combina borda 3px, fundo primary-soft, peso forte e aria-current', async ({
    page,
  }) => {
    const nav = mainNav(page)
    const primary = hexToRgb(await dsToken(page, '--ds-primary'))
    const primarySoft = hexToRgb(await dsToken(page, '--ds-primary-soft'))

    const hoje = nav.getByRole('button', { name: 'Hoje' })
    await expect(hoje).toHaveAttribute('aria-current', 'page')
    expect(await computed(hoje, 'border-left-width')).toBe('3px')
    expect(await computed(hoje, 'border-left-color')).toBe(primary)
    expect(await computed(hoje, 'background-color')).toBe(primarySoft)
    expect(await computed(nav.getByText('Hoje', { exact: true }), 'font-weight')).toBe('700')

    // Inativo: nenhum dos canais ligado (a cor não é o único diferencial, mas
    // também não sobra indicador em quem não está ativo).
    const arquivo = nav.getByRole('button', { name: 'Arquivo' })
    await expect(arquivo).not.toHaveAttribute('aria-current', /.*/)
    expect(await computed(arquivo, 'border-left-color')).toBe('rgba(0, 0, 0, 0)')
    expect(await computed(arquivo, 'background-color')).toBe('rgba(0, 0, 0, 0)')
    expect(await computed(nav.getByText('Arquivo', { exact: true }), 'font-weight')).toBe('500')

    // Exatamente UM `aria-current` na nav, e ele nunca é o agrupador (AC5):
    // navegar para um filho de Saúde mantém o agrupador só com `aria-expanded`.
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1)

    await nav.getByText('Métricas', { exact: true }).click()
    await expect(page).toHaveURL('/health/metrics')

    const saude = nav.getByRole('button', { name: 'Saúde' })
    await expect(saude).toHaveAttribute('aria-expanded', 'true')
    await expect(saude).not.toHaveAttribute('aria-current', /.*/)
    await expect(nav.getByRole('button', { name: 'Métricas' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1)
  })

  // DIV-5 · AC4 — catálogo Phosphor FECHADO no DOM real: todo ícone da nav é um
  // SVG Phosphor (viewBox 256) de 20px em `currentColor`, zero ícone MUI; e o
  // destino selecionado troca `regular` → `fill` (o `d` do path muda de fato).
  test('ícones são Phosphor 20px em currentColor, sem MUI, e trocam para fill no selecionado', async ({
    page,
  }) => {
    const nav = mainNav(page)

    // Nenhum `@mui/icons-material` renderizado (o legado usava só MUI — DIV-5).
    await expect(nav.locator('.MuiSvgIcon-root')).toHaveCount(0)

    const icons = nav.locator('svg')
    const viewBoxes = await icons.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('viewBox')),
    )
    expect(viewBoxes.length).toBeGreaterThan(0)
    expect([...new Set(viewBoxes)]).toEqual(['0 0 256 256'])

    // 20px canônico (`{components.app-shell-nav-icon}`) e tinta herdada.
    const arquivoButton = nav.getByRole('button', { name: 'Arquivo' })
    const arquivoIcon = arquivoButton.locator('svg')
    const box = await arquivoIcon.boundingBox()
    expect(box?.width).toBeCloseTo(20, 0)
    expect(box?.height).toBeCloseTo(20, 0)
    expect(await computed(arquivoIcon, 'fill')).toBe(await computed(arquivoButton, 'color'))

    // `regular` (repouso) → `fill` (selecionado): o mesmo destino, o mesmo glyph,
    // path diferente. É o único jeito de provar o peso — jsdom não vê o SVG.
    const pathAtRest = await arquivoIcon.locator('path').first().getAttribute('d')
    await nav.getByText('Arquivo', { exact: true }).click()
    await expect(page).toHaveURL('/archive')
    await expect(arquivoButton).toHaveAttribute('aria-current', 'page')
    const pathSelected = await arquivoIcon.locator('path').first().getAttribute('d')
    expect(pathSelected).not.toBe(pathAtRest)
  })

  // SB-12/SB-13/SB-15 · DIV-1 · AC6 — geometria MEDIDA do rail: 240px expandida,
  // 64px colapsada (não 56 do legado), labels/chevron somem preservando o nome
  // acessível, grupos fecham e reabrem com o estado da sessão, e o toggle alterna
  // o `aria-label`.
  test('rail mede 240↔64px, oculta labels preservando nomes acessíveis e alterna o toggle', async ({
    page,
  }) => {
    const nav = mainNav(page)
    const paper = sidebarPaper(page)

    // Tokens: o spec não crava 240/64 — lê do shell e confere a geometria real.
    expect(await dsToken(page, '--ds-sidebar-expanded')).toBe('240px')
    expect(await dsToken(page, '--ds-sidebar-collapsed')).toBe('64px')

    await expect(paper).toHaveCSS('width', '240px')
    await expect(nav.getByText('Esta Semana', { exact: true })).toBeVisible()
    // Chevron do agrupador (glyph unicode, decorativo) visível no expandido.
    await expect(nav.getByText('⌃', { exact: true }).first()).toBeVisible()

    await nav.getByRole('button', { name: 'Colapsar sidebar' }).click()

    await expect(paper).toHaveCSS('width', '64px')
    // Labels e chevron somem…
    await expect(nav.getByText('Hoje', { exact: true })).toHaveCount(0)
    await expect(nav.getByText('Planner', { exact: true })).toHaveCount(0)
    await expect(nav.getByText('⌃', { exact: true })).toHaveCount(0)
    await expect(nav.getByText('⌄', { exact: true })).toHaveCount(0)
    // …mas o NOME ACESSÍVEL de cada destino/agrupador permanece (AX tree do
    // browser, não só o atributo): é o contrato "o rail oculta labels sem
    // retirar nomes acessíveis".
    for (const name of ['Hoje', 'Planner', 'Hábitos', 'Saúde', 'Arquivo', 'Configurações']) {
      await expect(nav.getByRole('button', { name, exact: true })).toBeVisible()
    }
    // Grupos fechados no rail (SB-13) e alvo de toque adequado (WCAG 2.5.8).
    await expect(nav.getByRole('button', { name: 'Esta Semana', exact: true })).toHaveCount(0)
    const railBox = await nav.getByRole('button', { name: 'Hoje', exact: true }).boundingBox()
    expect(railBox?.height).toBeGreaterThanOrEqual(44)

    // Toggle alterna o aria-label (SB-15) e reexpandir preserva o estado dos
    // grupos da sessão (Planner volta aberto, sem reset).
    await nav.getByRole('button', { name: 'Expandir sidebar' }).click()
    await expect(paper).toHaveCSS('width', '240px')
    await expect(nav.getByText('Esta Semana', { exact: true })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Colapsar sidebar' })).toBeVisible()
  })

  // AC6 — colapso é estado de SESSÃO: um reload de verdade volta expandida e não
  // existe nada persistido (nem `localStorage`, nem `sessionStorage`, nem banco —
  // a persistência foi explicitamente rejeitada no reconcile da 13.0).
  test('colapso vive só na sessão: reload volta expandida e nada é persistido', async ({ page }) => {
    const paper = sidebarPaper(page)

    await page.keyboard.press('[')
    await expect(paper).toHaveCSS('width', '64px')

    const storageKeys = await page.evaluate(() => ({
      local: Object.keys(window.localStorage),
      session: Object.keys(window.sessionStorage),
    }))
    const suspicious = [...storageKeys.local, ...storageKeys.session].filter((key) =>
      /sidebar|collaps|rail|nav/i.test(key),
    )
    expect(suspicious).toEqual([])

    await page.reload()
    await expect(paper).toHaveCSS('width', '240px')
    await expect(mainNav(page).getByText('Planner', { exact: true })).toBeVisible()
  })

  // AC5 — agrupador RECOLHIDO contendo a rota ativa: indicador lateral + fundo
  // sutil (`.contains`) + descrição acessível, e NUNCA `aria-current` no
  // agrupador. As cores saem dos tokens resolvidos no browser.
  test('agrupador recolhido com a rota ativa dentro mostra .contains e descrição acessível', async ({
    page,
  }) => {
    const nav = mainNav(page)

    await nav.getByText('Esta Semana', { exact: true }).click()
    await expect(page).toHaveURL('/planner/week')

    await page.keyboard.press('[')
    await expect(sidebarPaper(page)).toHaveCSS('width', '64px')

    const planner = nav.getByRole('button', { name: 'Planner', exact: true })
    await expect(planner).toHaveAttribute('aria-expanded', 'false')
    await expect(planner).not.toHaveAttribute('aria-current', /.*/)

    // Canal visual do `.contains` (indicador + fundo sutil), com os valores dos
    // tokens — o teste jsdom só conseguia checar os atributos.
    expect(await computed(planner, 'border-left-width')).toBe('3px')
    expect(await computed(planner, 'border-left-color')).toBe(
      hexToRgb(await dsToken(page, '--ds-primary')),
    )
    expect(await computed(planner, 'background-color')).toBe(
      hexToRgb(await dsToken(page, '--ds-surface-subtle')),
    )

    // Canal acessível: descrição apontada por `aria-describedby`, nomeando o
    // destino ativo escondido dentro do grupo.
    const describedBy = await planner.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    await expect(page.locator(`#${describedBy}`)).toHaveText('Contém a página atual: Esta Semana.')
  })

  // BD-01/BD-04 · DIV-6 · AC7 — badge com contagem REAL do backend acima de 9:
  // mostra `9+`, mantém a contagem exata no nome acessível, usa os tokens de
  // `app-shell-badge`, NÃO desloca o label e permanece perceptível no rail
  // (ancorado ao ícone, sem cobrir o pictograma).
  test('badge do Brain Dump mostra 9+ com contagem exata no nome acessível, tokens e sem deslocar o label', async ({
    page,
    email,
  }) => {
    expect(seedBrainDumpItems(email, 12)).toBe(12)
    await page.reload()

    const nav = mainNav(page)
    const brainDump = nav.getByRole('button', { name: /Brain Dump/ })
    const badgeRoot = brainDump.locator('.MuiBadge-root')
    const badge = brainDump.locator('.MuiBadge-badge')

    // `9+` visual (cap `max={9}`) …
    await expect(badge).toHaveText('9+')
    // … e contagem EXATA preservada no nome acessível calculado pelo browser.
    await expect(badgeRoot).toHaveAttribute('aria-label', 'Brain Dump: 12 itens pendentes')
    await expect(nav.getByRole('button', { name: /Brain Dump: 12 itens pendentes/ })).toBeVisible()

    // Tokens de `{components.app-shell-badge}` resolvidos no DOM.
    expect(await computed(badge, 'min-height')).toBe(await dsToken(page, '--ds-badge-min-height'))
    expect(await computed(badge, 'background-color')).toBe(
      hexToRgb(await dsToken(page, '--ds-primary')),
    )
    expect(await computed(badge, 'color')).toBe(hexToRgb(await dsToken(page, '--ds-on-primary')))
    expect(await computed(badge, 'border-radius')).toBe(await dsToken(page, '--ds-radius-full'))

    // Não desloca o label: o badge está fora do fluxo e o rótulo do Brain Dump
    // começa exatamente na mesma coluna dos outros destinos.
    expect(await computed(badge, 'position')).toBe('absolute')
    const brainDumpLabel = await nav.getByText('Brain Dump', { exact: true }).boundingBox()
    const archiveLabel = await nav.getByText('Arquivo', { exact: true }).boundingBox()
    expect(Math.abs((brainDumpLabel?.x ?? 0) - (archiveLabel?.x ?? 0))).toBeLessThan(1)

    // Perceptível no rail, ancorado ao canto superior direito do ícone (sem
    // cobrir o pictograma) e dentro dos 64px (o paper tem overflow-x hidden:
    // um badge estourando o rail seria cortado).
    await page.keyboard.press('[')
    const paper = sidebarPaper(page)
    await expect(paper).toHaveCSS('width', '64px')
    await expect(badge).toBeVisible()
    await expect(badge).toHaveText('9+')

    const badgeBox = await badge.boundingBox()
    const iconBox = await brainDump.locator('svg').boundingBox()
    const paperBox = await paper.boundingBox()
    expect(badgeBox && iconBox && paperBox).toBeTruthy()
    const badgeCenter = { x: badgeBox!.x + badgeBox!.width / 2, y: badgeBox!.y + badgeBox!.height / 2 }
    const iconCenter = { x: iconBox!.x + iconBox!.width / 2, y: iconBox!.y + iconBox!.height / 2 }
    expect(badgeCenter.x).toBeGreaterThan(iconCenter.x)
    expect(badgeCenter.y).toBeLessThan(iconCenter.y)
    expect(badgeBox!.x + badgeBox!.width).toBeLessThanOrEqual(paperBox!.x + paperBox!.width + 1)
  })

  // AC7 (caso de erro) — falha do contador NÃO bloqueia navegação: o badge só
  // desaparece e o destino Brain Dump continua clicável, sem erro de página.
  test('falha do contador não bloqueia a navegação para o Brain Dump', async ({ page, email }) => {
    expect(seedBrainDumpItems(email, 12)).toBe(12)

    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await page.route('**/api/brain-dump/count/', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"boom"}' }),
    )
    await page.reload()

    const nav = mainNav(page)
    const brainDump = nav.getByRole('button', { name: /Brain Dump/ })
    // Badge some (MUI congela o último `displayValue` durante a transição de
    // saída — "sumir" se verifica pela classe, como no `brain-dump.spec.ts`).
    await expect(brainDump.locator('.MuiBadge-badge')).toHaveClass(/MuiBadge-invisible/)

    // Navegação intacta, apesar da contagem quebrada.
    await brainDump.click()
    await expect(page).toHaveURL('/brain-dump')
    await expect(page.getByRole('banner')).toContainText('Brain Dump')
    await expect(page.getByRole('main', { name: 'Brain Dump', exact: true })).toBeVisible()
    expect(pageErrors).toEqual([])
  })

  // AC5/AC6 — gate axe do CHROME com a sidebar em RAIL (o `shell-a11y.spec.ts`
  // cobre só o estado expandido): nomes acessíveis via `aria-label`, agrupador
  // com `aria-expanded` e a descrição do `.contains` não podem introduzir
  // violação WCAG 2.2 AA. `<main>` legado fora do gate (SHELL-DEBT-02).
  test('axe sem violações no chrome com a sidebar em rail', async ({ page }) => {
    const nav = mainNav(page)
    await nav.getByText('Esta Semana', { exact: true }).click()
    await expect(page).toHaveURL('/planner/week')

    await nav.getByRole('button', { name: 'Colapsar sidebar' }).click()
    await expect(sidebarPaper(page)).toHaveCSS('width', '64px')

    await expectNoAxeViolations(page, { exclude: 'main', label: 'wide · /planner/week · rail' })
  })
})

test.describe('Sidebar do shell — tablet 800×720', () => {
  test.use({ viewport: { width: 800, height: 720 } })

  // AC6 + KB-03 — tablet (768–1023) inicia em RAIL de 64px; o atalho `[` é
  // desktop-only (≥1024, string de media query idêntica à do legado), então aqui
  // só o toggle expande.
  test('tablet inicia em rail de 64px; [ não vale e o toggle expande para 240px', async ({
    page,
  }) => {
    const nav = mainNav(page)
    const paper = sidebarPaper(page)

    await expect(paper).toHaveCSS('width', '64px')
    await expect(nav.getByText('Planner', { exact: true })).toHaveCount(0)
    await expect(nav.getByRole('button', { name: 'Planner', exact: true })).toBeVisible()

    // Fora do escopo desktop: o atalho não faz nada (nem expande, nem colapsa).
    await page.keyboard.press('[')
    await expect(paper).toHaveCSS('width', '64px')

    await nav.getByRole('button', { name: 'Expandir sidebar' }).click()
    await expect(paper).toHaveCSS('width', '240px')
    await expect(nav.getByText('Planner', { exact: true })).toBeVisible()
  })
})
