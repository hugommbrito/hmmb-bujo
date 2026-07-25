import { test, expect } from './fixtures'
import { expectNoAxeViolations } from './axeHelper'
import { seedBrainDumpItems } from './seedBrainDumpItems'
// Helpers do chrome extraídos para reuso na Story 13.4 (a matriz de a11y e a
// auditoria de teclado usam os mesmos) — antes duplicados aqui e no sidebar.
import {
  bottomNav,
  captureSheet,
  computed,
  dsToken,
  hexToRgb,
  mainNav,
  navigationSheet,
  sheetModalRoot,
  sheetPaper,
  sidebarPaper,
  waitForSheetSettled,
} from './shellHelpers'

// E2E da BOTTOM NAV nova, do sheet de navegação completa e da captura
// persistente (Story 13.3) num browser real. Complementa — não repete — os
// testes jsdom (`ShellBottomNav.test.tsx`/`ShellNavigationSheet.test.tsx`):
// aqui ficam só os contratos que jsdom NÃO consegue exercer de verdade:
//
//   · geometria medida da barra (token `--ds-bottom-nav-height`), do FAB acima
//     dela (FAB-01) e do sheet que TERMINA acima da bottom nav;
//   · o foco inicial do sheet no destino ativo contra o FocusTrap REAL do
//     Modal (o autoFocus sozinho perde a corrida da animação — aprendizado da
//     retro do Epic 5; só o browser real prova o `onEntered`), o foco CONTIDO
//     e o conteúdo inferior INERTE;
//   · retorno de foco ao acionador (Menu) ao fechar sem navegar, pelo botão
//     Fechar, por `Escape` e pelo BACKDROP (hit-test real — jsdom não tem);
//   · catálogo Phosphor fechado no DOM (`regular`→`fill`) e alvos de toque
//     MEDIDOS (WCAG 2.2 `2.5.8`);
//   · contagem REAL do backend no badge do FAB e do sheet (`9+` com contagem
//     exata acessível) e o caminho de erro do contador;
//   · o `BrainDumpCaptureSheet` REAL (com Query/API) aberto pelo FAB (compact) e
//     pela ÂNCORA da navegação (desktop/tablet) — instância única do shell;
//   · o estado OFFLINE contra o evento nativo do browser (`setOffline`), com
//     `aria-disabled` focável, motivo no tooltip e guard no click (DIV-8);
//   · gate axe com o SHEET ABERTO (superfície nova fora do gate da 13.1);
//   · reflow a 320 CSS px sem scroll horizontal (WCAG 2.2 `1.4.10 Reflow`).
//
// A fixture faz signup real por teste e cai em `/today` já dentro do shell novo.
// [Source: Story 13.3 AC2–AC8; 13-shell-parity-checklist.md BN-*/FAB-*/DIV-2/DIV-8]

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

test.describe('Shell bottom nav — compact 390×720', () => {
  test.use({ viewport: { width: 390, height: 720 } })

  // AC2/AC7 · BN-01(novo)/BN-04/BN-05 — 3 atalhos derivados + Menu no landmark
  // novo, com a altura vinda do token (o valor é lido do DOM, não cravado aqui).
  test('3 atalhos default + Menu visíveis; altura da barra vem do token', async ({ page }) => {
    const nav = bottomNav(page)
    await expect(nav).toBeVisible()

    for (const label of ['Hoje', 'Esta Semana', 'Este Mês', 'Menu']) {
      await expect(nav.getByRole('button', { name: label })).toBeVisible()
    }
    // Exatamente 4 itens — nenhum módulo futuro desabilitado (AC2).
    await expect(nav.getByRole('button')).toHaveCount(4)
    // O landmark legado não existe no shell novo.
    await expect(page.getByRole('navigation', { name: 'Navegação mobile' })).toHaveCount(0)

    const tokenHeight = await dsToken(page, '--ds-bottom-nav-height')
    const navBox = await nav.boundingBox()
    expect(navBox).not.toBeNull()
    // Sem safe-area no desktop chromium, a barra mede exatamente o token (±1 de borda).
    expect(Math.abs(navBox!.height - parseFloat(tokenHeight))).toBeLessThanOrEqual(1)
    // Colada no rodapé do viewport.
    expect(navBox!.y + navBox!.height).toBeGreaterThanOrEqual(719)
  })

  // AC2 · BN-02/BN-03 — navegação por atalho e ativo por prefixo do destino.
  test('atalho navega e marca o ativo com aria-current', async ({ page }) => {
    const nav = bottomNav(page)
    await expect(nav.getByRole('button', { name: 'Hoje' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await nav.getByRole('button', { name: 'Esta Semana' }).click()
    await expect(page).toHaveURL('/planner/week')
    await expect(nav.getByRole('button', { name: 'Esta Semana' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(nav.getByRole('button', { name: 'Hoje' })).not.toHaveAttribute('aria-current')
    await expect(page.getByRole('banner')).toContainText('Esta Semana')
  })

  // AC2 — rota fora dos 3 atalhos ⇒ Menu aparece selecionado (decisão interina
  // da Questão Aberta 1: aria-current no Menu, conforme o mockup aprovado).
  test('rota fora dos atalhos: Menu selecionado', async ({ page }) => {
    const nav = bottomNav(page)
    await nav.getByRole('button', { name: 'Menu' }).click()
    await navigationSheet(page).getByRole('button', { name: /Métricas/ }).click()

    await expect(page).toHaveURL('/health/metrics')
    await expect(nav.getByRole('button', { name: 'Menu' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    for (const label of ['Hoje', 'Esta Semana', 'Este Mês']) {
      await expect(nav.getByRole('button', { name: label })).not.toHaveAttribute('aria-current')
    }
  })

  // AC3/AC4 — sheet com o conteúdo canônico completo, terminando acima da
  // bottom nav, e foco inicial no destino ativo (contra o FocusTrap real).
  test('Menu abre o sheet: todos os destinos, acima da bottom nav, foco no ativo', async ({
    page,
  }) => {
    const menuButton = bottomNav(page).getByRole('button', { name: 'Menu' })
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false')

    await menuButton.click()
    const sheet = navigationSheet(page)
    await expect(sheet).toBeVisible()
    // Com o sheet aberto o Modal torna o conteúdo inferior INERTE (aria-hidden
    // — exatamente o contrato do AC4), então a bottom nav sai da accessibility
    // tree: o aria-expanded do Menu é assertado por locator CSS.
    await expect(
      page.locator('nav[aria-label="Atalhos de navegação"] button[aria-expanded]'),
    ).toHaveAttribute('aria-expanded', 'true')

    // Todos os destinos disponíveis — inclusive os 3 atalhos — na ordem canônica.
    for (const label of CANONICAL_ORDER) {
      await expect(sheet.getByText(label, { exact: true })).toBeVisible()
    }

    // Foco inicial no destino ativo (nunca no Fechar) — só o browser real prova
    // que o `onEntered` vence o FocusTrap do Modal após a animação.
    await expect(sheet.getByRole('button', { name: /^Hoje/ })).toBeFocused()

    // O sheet termina ACIMA da bottom nav (mockup frame E). A barra continua
    // renderizada mas inerte sob o Modal — geometria via locator CSS. O foco
    // pode acontecer ainda durante o slide de entrada (autoFocus na montagem),
    // então a geometria é medida com poll até a transição assentar.
    await expect
      .poll(async () => {
        const paperBox = await sheetPaper(page).boundingBox()
        const navBox = await page
          .locator('nav[aria-label="Atalhos de navegação"]')
          .boundingBox()
        if (!paperBox || !navBox) return Number.POSITIVE_INFINITY
        return paperBox.y + paperBox.height - navBox.y
      })
      .toBeLessThanOrEqual(1)
  })

  // AC4 — fechar sem navegar devolve o foco ao Menu; Escape também fecha.
  test('Fechar devolve o foco ao Menu; Escape fecha o sheet', async ({ page }) => {
    const menuButton = bottomNav(page).getByRole('button', { name: 'Menu' })

    await menuButton.click()
    await navigationSheet(page).getByRole('button', { name: 'Fechar' }).click()
    await expect(navigationSheet(page)).toBeHidden()
    await expect(menuButton).toBeFocused()

    await menuButton.click()
    await expect(navigationSheet(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(navigationSheet(page)).toBeHidden()
  })

  // AC3/AC4 — navegar pelo sheet fecha; anúncio segue exclusivo do RouteAnnouncer.
  test('navegar pelo sheet fecha e atualiza topbar/anúncio', async ({ page }) => {
    await bottomNav(page).getByRole('button', { name: 'Menu' }).click()
    await navigationSheet(page).getByRole('button', { name: /Arquivo/ }).click()

    await expect(page).toHaveURL('/archive')
    await expect(navigationSheet(page)).toBeHidden()
    await expect(page.getByRole('banner')).toContainText('Arquivo')
    // Uma única live region na casca (a do RouteAnnouncer).
    await expect(page.getByRole('status')).toHaveCount(1)
  })

  // AC5 · FAB-01/FAB-05 — FAB circular fora da bottom nav, acima dela, abrindo
  // o BrainDumpCaptureSheet REAL (instância única do shell).
  test('FAB de captura acima da barra abre o Capture Sheet real', async ({ page }) => {
    const fab = page.getByRole('button', { name: 'Captura rápida' })
    await expect(fab).toBeVisible()

    // Fora e ACIMA da bottom nav (paridade FAB-01 com tokens).
    const fabBox = await fab.boundingBox()
    const navBox = await bottomNav(page).boundingBox()
    expect(fabBox).not.toBeNull()
    expect(navBox).not.toBeNull()
    expect(fabBox!.y + fabBox!.height).toBeLessThanOrEqual(navBox!.y)
    // Tamanho do token `--ds-capture-fab-size`.
    const fabSize = parseFloat(await dsToken(page, '--ds-capture-fab-size'))
    expect(Math.abs(fabBox!.width - fabSize)).toBeLessThanOrEqual(1)

    // "Sempre visível" (AC5): rolar o workspace até o fim não move nem esconde
    // o FAB — ele é `position: fixed` sobre o canvas, não conteúdo do fluxo.
    await page
      .getByTestId('shell-workspace')
      .evaluate((el) => el.scrollTo({ top: el.scrollHeight }))
    await expect(fab).toBeVisible()
    const fabBoxAfterScroll = await fab.boundingBox()
    expect(Math.abs(fabBoxAfterScroll!.y - fabBox!.y)).toBeLessThanOrEqual(1)

    await fab.click()
    await expect(captureSheet(page)).toBeVisible()
    // Instância ÚNICA do sheet de captura no shell (FAB-05 subiu do BottomNav
    // legado para o ShellLayout).
    await expect(captureSheet(page)).toHaveCount(1)
    // Superfície de captura legada reutilizada como está: título em foco.
    await expect(captureSheet(page).getByLabel(/Título/)).toBeFocused()
  })

  // AC7 · DIV-5 (parte bottom nav) — catálogo Phosphor FECHADO no DOM real: a
  // barra legada usava só `@mui/icons-material`; a nova só tem SVG Phosphor
  // (viewBox 256) de 20px em `currentColor`, troca `regular` → `fill` no
  // selecionado (o `d` do path muda de fato) e cada item cobre ≥48px de alvo
  // (WCAG 2.2 `2.5.8` para controle frequente compacto).
  test('bottom nav: ícones Phosphor 20px sem MUI, fill no selecionado e alvos ≥48px', async ({
    page,
  }) => {
    const nav = bottomNav(page)
    await expect(nav.locator('.MuiSvgIcon-root')).toHaveCount(0)

    const viewBoxes = await nav
      .locator('svg')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('viewBox')))
    expect(viewBoxes).toHaveLength(4)
    expect([...new Set(viewBoxes)]).toEqual(['0 0 256 256'])

    // Alvos: a altura da barra (64px do token) cobre os 48px de cada item.
    for (const label of ['Hoje', 'Esta Semana', 'Este Mês', 'Menu']) {
      const box = await nav.getByRole('button', { name: label }).boundingBox()
      expect(box!.height, `alvo de "${label}"`).toBeGreaterThanOrEqual(48)
      expect(box!.width, `alvo de "${label}"`).toBeGreaterThanOrEqual(44)
    }

    const semana = nav.getByRole('button', { name: 'Esta Semana' })
    const semanaIcon = semana.locator('svg')
    const iconBox = await semanaIcon.boundingBox()
    expect(iconBox!.width).toBeCloseTo(20, 0)
    expect(iconBox!.height).toBeCloseTo(20, 0)
    // Tinta herdada do estado do item (nunca cor cravada no glyph).
    expect(await computed(semanaIcon, 'fill')).toBe(await computed(semana, 'color'))

    const pathAtRest = await semanaIcon.locator('path').first().getAttribute('d')
    await semana.click()
    await expect(semana).toHaveAttribute('aria-current', 'page')
    expect(await semanaIcon.locator('path').first().getAttribute('d')).not.toBe(pathAtRest)
    // Selecionado ⇒ tinta `--ds-primary` + fundo `--ds-primary-soft` (nunca cor
    // isolada); não-selecionado ⇒ `--ds-ink-muted` (fix da SHELL-DEBT-01).
    expect(await computed(semana, 'color')).toBe(hexToRgb(await dsToken(page, '--ds-primary')))
    expect(await computed(semana, 'background-color')).toBe(
      hexToRgb(await dsToken(page, '--ds-primary-soft')),
    )
    expect(await computed(nav.getByRole('button', { name: 'Hoje' }), 'color')).toBe(
      hexToRgb(await dsToken(page, '--ds-ink-muted')),
    )
  })

  // AC4 — `Tab` fica CONTIDO no sheet e o conteúdo inferior fica INERTE. jsdom
  // não implementa nem focus trap nem a árvore de acessibilidade: só o browser
  // real prova os dois lados do contrato.
  test('sheet: Tab contido no Modal e conteúdo inferior inerte', async ({ page }) => {
    await bottomNav(page).getByRole('button', { name: 'Menu' }).click()
    await expect(navigationSheet(page)).toBeVisible()

    // Inerte: a barra e o FAB continuam no DOM, mas saem da accessibility tree.
    await expect(page.getByRole('navigation', { name: 'Atalhos de navegação' })).toHaveCount(0)
    await expect(page.locator('nav[aria-label="Atalhos de navegação"]')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Captura rápida' })).toHaveCount(0)

    // Contido: percorrer a lista inteira com Tab nunca leva o foco para fora do
    // Modal do sheet (o ciclo volta ao primeiro item).
    for (let i = 0; i < 25; i += 1) {
      await page.keyboard.press('Tab')
      const insideSheet = await page.evaluate(() => {
        const nav = document.querySelector('nav[aria-label="Navegação completa"]')
        const modal = nav?.closest('.MuiDrawer-root')
        return !!modal && !!document.activeElement && modal.contains(document.activeElement)
      })
      expect(insideSheet, `Tab #${i + 1} escapou do sheet`).toBe(true)
    }
  })

  // AC4 — quarto modo de fechamento do contrato: BACKDROP. Um hit-test real
  // (clique acima do paper, onde só existe o backdrop `overlay`) — jsdom não faz
  // layout, então este modo só é verificável aqui.
  test('sheet fecha pelo backdrop e devolve o foco ao Menu', async ({ page }) => {
    const menuButton = bottomNav(page).getByRole('button', { name: 'Menu' })
    await menuButton.click()
    await expect(navigationSheet(page)).toBeVisible()

    const backdrop = sheetModalRoot(page).locator('.MuiBackdrop-root')
    // Backdrop = tinta `overlay` do contrato (`--ds-overlay` é hex com alfa: os
    // canais vêm do token e o alfa < 1 é o que o browser resolve).
    const overlayChannels = hexToRgb(await dsToken(page, '--ds-overlay')).slice(4, -1)
    expect(await computed(backdrop, 'background-color')).toMatch(
      new RegExp(`^rgba\\(${overlayChannels}, 0\\.\\d+\\)$`),
    )
    // O sheet começa abaixo da topbar: y=10 é backdrop puro.
    await backdrop.click({ position: { x: 10, y: 10 } })

    await expect(navigationSheet(page)).toBeHidden()
    // Fechou SEM navegar ⇒ rota intacta e foco de volta no acionador.
    await expect(page).toHaveURL('/today')
    await expect(menuButton).toBeFocused()
  })

  // AC3 — agrupadores dentro do sheet: `aria-expanded` e NUNCA `aria-current`,
  // com exatamente UM destino ativo na navegação completa. A rota ativa aqui vem
  // da derivação REAL do registro (`/health/metrics` é filha do grupo Saúde).
  test('sheet: agrupador com a rota ativa dentro usa aria-expanded, nunca aria-current', async ({
    page,
  }) => {
    await bottomNav(page).getByRole('button', { name: 'Menu' }).click()
    await navigationSheet(page)
      .getByRole('button', { name: /Métricas/ })
      .click()
    await expect(page).toHaveURL('/health/metrics')

    await bottomNav(page).getByRole('button', { name: 'Menu' }).click()
    const sheet = navigationSheet(page)
    const saude = sheet.getByRole('button', { name: 'Saúde', exact: true })
    await expect(saude).toHaveAttribute('aria-expanded', 'true')
    await expect(saude).not.toHaveAttribute('aria-current', /.*/)
    await expect(sheet.getByRole('button', { name: 'Métricas', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(sheet.locator('[aria-current="page"]')).toHaveCount(1)

    // Recolher o grupo esconde os filhos, não navega e não fecha o sheet
    // (estado de expansão só na sessão).
    await saude.click()
    await expect(saude).toHaveAttribute('aria-expanded', 'false')
    await expect(sheet.getByRole('button', { name: 'Métricas', exact: true })).toHaveCount(0)
    await expect(page).toHaveURL('/health/metrics')
    await expect(sheet).toBeVisible()
  })

  // AC3 — rolagem INTERNA: a lista rola dentro do sheet, com alça/header/Fechar
  // fixos e o paper imóvel; alvos ≥44px. Só o browser real tem layout/rolagem.
  test('sheet: rolagem interna preserva header e Fechar, com alvos ≥44px', async ({ page }) => {
    await bottomNav(page).getByRole('button', { name: 'Menu' }).click()
    const sheet = navigationSheet(page)
    const fechar = sheet.getByRole('button', { name: 'Fechar' })
    // Baseline só depois do slide de entrada — senão o paper ainda está a
    // caminho e a comparação mede a animação, não a rolagem.
    await waitForSheetSettled(page)
    const paperBefore = await sheetPaper(page).boundingBox()

    const config = sheet.getByRole('button', { name: 'Configurações', exact: true })
    await config.scrollIntoViewIfNeeded()
    await expect(config).toBeVisible()

    // Header FIXO: o sheet não cresce nem sobe para acomodar a rolagem.
    await expect(sheet.getByText('Navegação', { exact: true })).toBeVisible()
    await expect(fechar).toBeVisible()
    const paperAfter = await sheetPaper(page).boundingBox()
    expect(Math.abs(paperAfter!.y - paperBefore!.y)).toBeLessThanOrEqual(1)
    expect(Math.abs(paperAfter!.height - paperBefore!.height)).toBeLessThanOrEqual(1)

    const touchTargetMin = parseFloat(await dsToken(page, '--ds-touch-target-min'))
    for (const target of [config, fechar]) {
      const box = await target.boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(touchTargetMin)
    }
  })

  // AC3/AC5 · BD-01/BD-04/FAB-04 — contagem REAL do backend (12 itens) nos dois
  // portadores novos do badge: o FAB e o destino Brain Dump do sheet. `9+`
  // visual, contagem exata no nome acessível, tokens de `app-shell-badge` e
  // cápsula que não cobre o pictograma.
  test('badge real do Brain Dump: 9+ no FAB e no sheet, com contagem exata acessível', async ({
    page,
    email,
  }) => {
    expect(seedBrainDumpItems(email, 12)).toBe(12)
    await page.reload()

    const fab = page.getByRole('button', { name: 'Captura rápida', exact: true })
    const fabBadge = fab.locator('.MuiBadge-badge')
    await expect(fabBadge).toHaveText('9+')
    await expect(fab.locator('.MuiBadge-root')).toHaveAttribute(
      'aria-label',
      'Brain Dump: 12 itens pendentes',
    )
    expect(await computed(fabBadge, 'min-height')).toBe(
      await dsToken(page, '--ds-badge-min-height'),
    )
    expect(await computed(fabBadge, 'background-color')).toBe(
      hexToRgb(await dsToken(page, '--ds-primary')),
    )
    expect(await computed(fabBadge, 'border-radius')).toBe(await dsToken(page, '--ds-radius-full'))

    // Ancorada ao canto superior direito do ícone, sem cobrir o pictograma.
    const badgeBox = await fabBadge.boundingBox()
    const iconBox = await fab.locator('svg').first().boundingBox()
    const badgeCenter = { x: badgeBox!.x + badgeBox!.width / 2, y: badgeBox!.y + badgeBox!.height / 2 }
    const iconCenter = { x: iconBox!.x + iconBox!.width / 2, y: iconBox!.y + iconBox!.height / 2 }
    expect(badgeCenter.x).toBeGreaterThan(iconCenter.x)
    expect(badgeCenter.y).toBeLessThan(iconCenter.y)

    // No sheet, o destino Brain Dump carrega o mesmo contrato de badge — e ali a
    // contagem exata entra no nome acessível do próprio destino.
    await bottomNav(page).getByRole('button', { name: 'Menu' }).click()
    const sheet = navigationSheet(page)
    await expect(
      sheet.getByRole('button', { name: /Brain Dump: 12 itens pendentes/ }),
    ).toBeVisible()
    await expect(sheet.locator('.MuiBadge-badge')).toHaveText('9+')
  })

  // AC6 (caso de erro) — "falha do contador NÃO altera a disponibilidade": com o
  // endpoint da contagem em 500 o badge só desaparece e a captura continua
  // disponível e funcional.
  test('falha do contador não desabilita nem bloqueia a captura', async ({ page, email }) => {
    expect(seedBrainDumpItems(email, 12)).toBe(12)

    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await page.route('**/api/brain-dump/count/', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"boom"}' }),
    )
    await page.reload()

    const fab = page.getByRole('button', { name: 'Captura rápida', exact: true })
    await expect(fab).toBeVisible()
    await expect(fab).not.toHaveAttribute('aria-disabled', /.*/)
    // Badge some (MUI congela o último `displayValue` na transição de saída — o
    // "sumir" se verifica pela classe, como no `brain-dump.spec.ts`).
    await expect(fab.locator('.MuiBadge-badge')).toHaveClass(/MuiBadge-invisible/)

    await fab.click()
    await expect(captureSheet(page)).toBeVisible()
    expect(pageErrors).toEqual([])
  })

  // AC6 · DIV-8 — offline contra o evento NATIVO do browser (`setOffline`), que
  // é o que `useOnlineStatus` escuta: FAB indisponível com superfície/tinta
  // disabled, mas FOCÁVEL (`aria-disabled`, nunca `disabled` nativo), com motivo
  // acessível no nome e no tooltip, guard no click — e navegação intacta.
  test('offline: FAB indisponível com motivo, focável, sem abrir a captura; navegação segue', async ({
    page,
    context,
  }) => {
    await expect(page.getByRole('button', { name: 'Captura rápida', exact: true })).toBeVisible()

    await context.setOffline(true)

    const offlineFab = page.getByRole('button', { name: 'Captura rápida (sem conexão)' })
    await expect(offlineFab).toBeVisible()
    await expect(offlineFab).toHaveAttribute('aria-disabled', 'true')
    // Divergência contratada vs FAB-03 legado: identidade e foco preservados.
    await expect(offlineFab).not.toHaveAttribute('disabled', /.*/)
    await offlineFab.focus()
    await expect(offlineFab).toBeFocused()
    expect(await computed(offlineFab, 'color')).toBe(
      hexToRgb(await dsToken(page, '--ds-ink-disabled')),
    )
    expect(await computed(offlineFab, 'background-color')).toBe(
      hexToRgb(await dsToken(page, '--ds-surface-subtle')),
    )

    // Motivo também no tooltip (com `aria-disabled` o controle recebe hover —
    // o `<span>` wrapper do legado deixa de ser necessário).
    await offlineFab.hover()
    await expect(page.getByRole('tooltip')).toHaveText('Sem conexão')

    // Guard no click: nada abre. O `force` é necessário porque o próprio
    // Playwright trata `aria-disabled="true"` como "not enabled" e se recusaria a
    // clicar — evidência a mais de que a indisponibilidade é legível por máquina.
    // Com `force`, o clique REAL acontece e prova o guard do `onClick`.
    await offlineFab.click({ force: true })
    await expect(captureSheet(page)).toHaveCount(0)

    // Navegação segue funcional offline (roteamento é client-side).
    const nav = bottomNav(page)
    await nav.getByRole('button', { name: 'Este Mês' }).click()
    await expect(page).toHaveURL('/planner/month')
    await expect(nav.getByRole('button', { name: 'Este Mês' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    // Reconectar devolve a captura (evento `online`).
    await context.setOffline(false)
    const onlineFab = page.getByRole('button', { name: 'Captura rápida', exact: true })
    await expect(onlineFab).toBeVisible()
    await onlineFab.click()
    await expect(captureSheet(page)).toBeVisible()
  })

  // AC8 — o gate axe do `shell-a11y.spec.ts` mede o chrome compact com o sheet
  // FECHADO. O sheet aberto é uma superfície nova (paper no portal, backdrop,
  // grupos com `aria-expanded`, conteúdo inferior inerte) e precisa do seu
  // próprio gate WCAG 2.2 AA. `<main>` legado fora do escopo (SHELL-DEBT-02).
  test('axe sem violações com o sheet de navegação aberto', async ({ page }) => {
    await bottomNav(page).getByRole('button', { name: 'Menu' }).click()
    await expect(navigationSheet(page)).toBeVisible()

    await expectNoAxeViolations(page, {
      exclude: 'main',
      label: 'compact · /today · sheet de navegação aberto',
    })
  })
})

test.describe('Shell bottom nav — reflow 320×720 (WCAG 1.4.10)', () => {
  test.use({ viewport: { width: 320, height: 720 } })

  // AC7 — reflow a 320 CSS px sem perda de conteúdo/ação e SEM scroll horizontal.
  test('sem scroll horizontal; barra, atalhos e FAB seguem visíveis', async ({ page }) => {
    const nav = bottomNav(page)
    await expect(nav).toBeVisible()
    for (const label of ['Hoje', 'Esta Semana', 'Este Mês', 'Menu']) {
      await expect(nav.getByRole('button', { name: label })).toBeVisible()
    }
    await expect(page.getByRole('button', { name: 'Captura rápida' })).toBeVisible()

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(hasHorizontalScroll).toBe(false)
  })

  // AC7 — o sheet aberto é o estado mais denso do fluxo mobile: a 320 CSS px ele
  // continua sem scroll horizontal, sem estourar o viewport, e todos os destinos
  // seguem alcançáveis pela rolagem INTERNA (reflow, não scroll lateral).
  test('sheet aberto a 320px: sem scroll horizontal e todos os destinos alcançáveis', async ({
    page,
  }) => {
    await bottomNav(page).getByRole('button', { name: 'Menu' }).click()
    const sheet = navigationSheet(page)
    await expect(sheet).toBeVisible()

    for (const label of ['Hoje', 'Configurações']) {
      const item = sheet.getByRole('button', { name: label, exact: true })
      await item.scrollIntoViewIfNeeded()
      await expect(item).toBeVisible()
    }

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(hasHorizontalScroll).toBe(false)
    const paperBox = await sheetPaper(page).boundingBox()
    expect(paperBox!.width).toBeLessThanOrEqual(320)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Captura persistente ANCORADA na navegação (decisão Captura A da 13.0): em
// desktop/medium/tablet não existe FAB — a âncora "Abrir captura rápida" fecha a
// navegação da `ShellSidebar` e abre a MESMA instância única do
// `BrainDumpCaptureSheet`. Nada disso é exercível em jsdom: borda/alvo medidos,
// nome acessível calculado no rail, badge com contagem real e o evento offline
// nativo do browser. [AC5/AC6 · FAB-06 · DIV-8]
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Captura persistente ancorada — wide 1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('âncora nominal ao fim da navegação abre a instância única do Capture Sheet', async ({
    page,
  }) => {
    const nav = mainNav(page)
    const anchor = nav.getByRole('button', { name: 'Abrir captura rápida', exact: true })

    // Nominal na sidebar expandida (rótulo visível, não só nome acessível).
    await expect(anchor).toBeVisible()
    await expect(anchor).toHaveText(/Abrir captura rápida/)
    // No desktop o FAB do compact não existe.
    await expect(page.getByRole('button', { name: 'Captura rápida', exact: true })).toHaveCount(0)
    await expect(bottomNav(page)).toHaveCount(0)

    // Borda de `{components.interactive-control}` e alvo ≥ token, MEDIDOS.
    expect(await computed(anchor, 'border-top-width')).toBe('1px')
    expect(await computed(anchor, 'border-top-color')).toBe(
      hexToRgb(await dsToken(page, '--ds-control-border')),
    )
    const anchorBox = await anchor.boundingBox()
    expect(anchorBox!.height).toBeGreaterThanOrEqual(
      parseFloat(await dsToken(page, '--ds-touch-target-min')),
    )

    // "Ao fim da navegação": depois do último destino (Configurações).
    const settingsBox = await nav
      .getByRole('button', { name: 'Configurações', exact: true })
      .boundingBox()
    expect(anchorBox!.y).toBeGreaterThan(settingsBox!.y)

    await anchor.click()
    await expect(captureSheet(page)).toBeVisible()
    // UMA instância do sheet de captura no shell, compartilhada com o compact.
    await expect(captureSheet(page)).toHaveCount(1)
    await expect(captureSheet(page).getByLabel(/Título/)).toBeFocused()
  })

  test('âncora icon-only no rail preserva o nome acessível e o badge dentro dos 64px', async ({
    page,
    email,
  }) => {
    expect(seedBrainDumpItems(email, 12)).toBe(12)
    await page.reload()

    const nav = mainNav(page)
    const anchor = nav.getByRole('button', { name: 'Abrir captura rápida', exact: true })
    await expect(anchor).toHaveText(/Abrir captura rápida/)

    await nav.getByRole('button', { name: 'Colapsar sidebar' }).click()
    const paper = sidebarPaper(page)
    await expect(paper).toHaveCSS('width', '64px')

    // O rótulo some…
    await expect(anchor).not.toHaveText(/Abrir captura rápida/)
    // …e o NOME ACESSÍVEL permanece (AX tree do browser, não só o atributo).
    await expect(anchor).toBeVisible()

    // Badge perceptível no rail, ancorado ao ícone e contido nos 64px (o paper
    // tem `overflow-x: hidden`: um badge estourando o rail seria cortado).
    const badge = anchor.locator('.MuiBadge-badge')
    await expect(badge).toHaveText('9+')
    const badgeBox = await badge.boundingBox()
    const paperBox = await paper.boundingBox()
    expect(badgeBox!.x + badgeBox!.width).toBeLessThanOrEqual(paperBox!.x + paperBox!.width + 1)

    await anchor.click()
    await expect(captureSheet(page)).toBeVisible()
  })

  test('offline: âncora indisponível com motivo, focável e sem abrir a captura', async ({
    page,
    context,
  }) => {
    const nav = mainNav(page)
    await expect(nav.getByRole('button', { name: 'Abrir captura rápida', exact: true })).toBeVisible()

    await context.setOffline(true)

    const offlineAnchor = nav.getByRole('button', { name: 'Abrir captura rápida (sem conexão)' })
    await expect(offlineAnchor).toBeVisible()
    await expect(offlineAnchor).toHaveAttribute('aria-disabled', 'true')
    await expect(offlineAnchor).not.toHaveAttribute('disabled', /.*/)
    await offlineAnchor.focus()
    await expect(offlineAnchor).toBeFocused()

    // Superfície/tinta disabled PRESERVANDO a identidade (a borda do controle
    // continua lá — o controle não vira outra coisa).
    expect(await computed(offlineAnchor, 'color')).toBe(
      hexToRgb(await dsToken(page, '--ds-ink-disabled')),
    )
    expect(await computed(offlineAnchor, 'background-color')).toBe(
      hexToRgb(await dsToken(page, '--ds-surface-subtle')),
    )
    expect(await computed(offlineAnchor, 'border-top-color')).toBe(
      hexToRgb(await dsToken(page, '--ds-control-border')),
    )

    await offlineAnchor.hover()
    await expect(page.getByRole('tooltip')).toHaveText('Sem conexão')

    // `force` pelo mesmo motivo do FAB: o Playwright considera `aria-disabled`
    // como "not enabled"; o clique real prova o guard do `onClick`.
    await offlineAnchor.click({ force: true })
    await expect(captureSheet(page)).toHaveCount(0)

    // A navegação da sidebar segue funcional offline.
    await nav.getByText('Arquivo', { exact: true }).click()
    await expect(page).toHaveURL('/archive')

    await context.setOffline(false)
    const onlineAnchor = nav.getByRole('button', { name: 'Abrir captura rápida', exact: true })
    await expect(onlineAnchor).toBeVisible()
    await onlineAnchor.click()
    await expect(captureSheet(page)).toBeVisible()
  })
})

test.describe('Captura persistente ancorada — tablet 800×720', () => {
  test.use({ viewport: { width: 800, height: 720 } })

  // AC5 — a faixa medium/tablet (768–1023) usa a âncora, não o FAB: o tablet
  // inicia em rail, então a âncora nasce icon-only preservando o nome acessível.
  test('tablet em rail: âncora icon-only abre a captura e não existe FAB nem bottom nav', async ({
    page,
  }) => {
    await expect(sidebarPaper(page)).toHaveCSS('width', '64px')

    const anchor = mainNav(page).getByRole('button', {
      name: 'Abrir captura rápida',
      exact: true,
    })
    await expect(anchor).toBeVisible()
    await expect(anchor).not.toHaveText(/Abrir captura rápida/)

    // Chrome do compact ausente nesta faixa.
    await expect(page.getByRole('button', { name: 'Captura rápida', exact: true })).toHaveCount(0)
    await expect(bottomNav(page)).toHaveCount(0)

    await anchor.click()
    await expect(captureSheet(page)).toBeVisible()
  })
})
