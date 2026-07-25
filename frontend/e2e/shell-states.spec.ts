import type { Page } from '@playwright/test'

import { test, expect } from './fixtures'
import { seedHabitHistory } from './seedHabitHistory'
import { seedHealthHistory } from './seedHealthHistory'
import { bottomNav, captureSheet, mainNav } from './shellHelpers'

// ESTADOS do chrome do App Shell — as lacunas de evidência da seção H do
// `13-shell-parity-checklist.md` (`ST-01` vazio, `ST-02` loading, `ST-06`
// readonly). Os outros três já tinham evidência nomeada antes desta story e
// NÃO são reescritos aqui (AC7 pede evidência nomeada, não cobertura nova):
//
//   · `ST-03` error   → `shell-sidebar.spec.ts::falha do contador não bloqueia a
//                        navegação para o Brain Dump` e
//                        `shell-bottomnav.spec.ts::falha do contador não desabilita
//                        nem bloqueia a captura`
//   · `ST-04` offline → `shell-bottomnav.spec.ts::offline: FAB indisponível com
//                        motivo, focável, sem abrir a captura; navegação segue` +
//                        `…offline: âncora indisponível…` + as duas células
//                        offline da matriz em `shell-a11y.spec.ts`
//   · `ST-05` disabled → mesmo par acima (é o contrato DIV-8: `aria-disabled` +
//                        guard no `onClick`, controle segue focável com
//                        identidade e motivo acessível)
//   · nav mínima      → seam de injeção `collections` nas três superfícies
//                        (`shellDestinations.test.ts`, `ShellSidebar.test.tsx`,
//                        `ShellNavigationSheet.test.tsx`)
//
// FRONTEIRA (registrada no checklist): `ST-01` e `ST-06` são estados da
// SUPERFÍCIE LEGADA. O que a Onda 2a garante — e o que estes testes medem — é que
// o CHROME permanece completo, estável e acessível nesses estados; a auditoria do
// conteúdo interno é das Ondas 3–5 (Épicos 14–16).
//
// [Source: Story 13.4 AC7; EXPERIENCE.md §State Patterns;
//  13-shell-parity-checklist.md ST-01…ST-06, BD-02, DIV-8]

/** Todos os destinos da navegação principal, na ordem canônica. */
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

test.describe('Estados do chrome — wide 1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  // ST-01 (vazio) — a fixture cai num Daily Log VAZIO ("Nenhuma tarefa para
  // hoje."). O estado é da superfície legada; o contrato da Onda 2a é o chrome
  // completo e estável, sem nada "vazio" nele.
  test('ST-01 vazio: superfície sem itens, chrome completo e estável', async ({ page }) => {
    await expect(page.getByText('Nenhuma tarefa para hoje.')).toBeVisible()

    // Chrome inteiro presente: topbar, navegação canônica completa, seam e
    // captura ancorada.
    await expect(page.getByRole('banner')).toContainText('Hoje')
    await expect(mainNav(page).locator('.MuiListItemText-primary')).toHaveText(CANONICAL_ORDER)
    await expect(page.getByRole('complementary')).toBeVisible()
    await expect(
      mainNav(page).getByRole('button', { name: 'Abrir captura rápida', exact: true }),
    ).toBeEnabled()
    // Nenhum destino aparece desabilitado por a superfície estar vazia.
    await expect(mainNav(page).locator('[aria-disabled="true"]')).toHaveCount(0)
    await expect(mainNav(page).locator('[aria-current="page"]')).toHaveCount(1)
  })

  // ST-02 (loading) — com a contagem PENDENTE (a resposta nunca chega), o badge
  // fica oculto (`BD-02`: `invisible` enquanto `data` é undefined) e a
  // disponibilidade do chrome é INDEPENDENTE do contador: navegação e captura
  // seguem funcionando. É o contrato do checklist `:127-128`, não DIV-8.
  test('ST-02 loading: badge oculto, navegação e captura seguem disponíveis', async ({ page }) => {
    // Segura a contagem pendente para sempre — é o estado de loading estável.
    await page.route('**/api/brain-dump/count/', () => {
      /* nunca resolve: mantém a query em loading */
    })
    await page.reload()

    const brainDump = mainNav(page).getByRole('button', { name: /Brain Dump/ })
    await expect(brainDump).toBeVisible()
    // Badge oculto (o MUI mantém o nó e marca a classe `invisible`).
    await expect(brainDump.locator('.MuiBadge-badge')).toHaveClass(/MuiBadge-invisible/)

    // Captura disponível apesar do contador pendente (nada de `aria-disabled`).
    const anchor = mainNav(page).getByRole('button', { name: 'Abrir captura rápida', exact: true })
    await expect(anchor).not.toHaveAttribute('aria-disabled', /.*/)
    await anchor.click()
    await expect(captureSheet(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(captureSheet(page)).toBeHidden()

    // Navegação disponível apesar do contador pendente.
    await mainNav(page).getByText('Arquivo', { exact: true }).click()
    await expect(page).toHaveURL('/archive')
    await expect(page.getByRole('banner')).toContainText('Arquivo')
  })

  // ST-06 (readonly) — rota de histórico: o chrome está completo, o destino PAI
  // fica ativo (AC1 — antes da 13.4 a sidebar ficava sem nenhum ativo aqui) e o
  // chrome NÃO oferece nenhuma ação de escrita específica da superfície. A única
  // ação de escrita no chrome é a captura persistente global, contratada em
  // FAB-06/`{components.capture-action}` para TODA rota (não é ação da superfície).
  test('ST-06 readonly: histórico com chrome completo, pai ativo e sem ação de escrita da superfície', async ({
    page,
  }) => {
    await page.goto('/health/metrics/history')
    await expect(page.getByRole('banner')).toContainText('Métricas de Saúde — Histórico')

    const nav = mainNav(page)
    await expect(nav.locator('.MuiListItemText-primary')).toHaveText(CANONICAL_ORDER)
    await expect(nav.getByRole('button', { name: 'Métricas' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1)

    // O inventário de controles do chrome é FECHADO: toggle da sidebar + os 14
    // itens da navegação canônica + a captura persistente. Nada de "Adicionar",
    // "Salvar", "Editar" ou qualquer ação de escrita da superfície subiu ao chrome.
    const chromeButtons = await nav.getByRole('button').evaluateAll((nodes) =>
      nodes.map((node) => {
        const label = node.getAttribute('aria-label')
        if (label) return label
        const clone = node.cloneNode(true) as HTMLElement
        // Fora do texto: o chevron decorativo do agrupador (`aria-hidden`) e o
        // conteúdo do badge (a contagem entra no nome pelo `aria-label` do
        // `.MuiBadge-root`, não pelo dígito — que aqui é `0` e invisível).
        clone
          .querySelectorAll('[aria-hidden], .MuiBadge-badge')
          .forEach((decorative) => decorative.remove())
        return clone.textContent?.trim() ?? ''
      }),
    )
    expect(chromeButtons).toEqual([
      'Colapsar sidebar',
      ...CANONICAL_ORDER,
      'Abrir captura rápida',
    ])
  })
})

test.describe('Estados do chrome — compact 390×720', () => {
  test.use({ viewport: { width: 390, height: 720 } })

  // ST-02 no compact: os portadores do badge são o FAB e o destino do sheet.
  test('ST-02 loading no compact: badge do FAB oculto, navegação e captura disponíveis', async ({
    page,
  }) => {
    await page.route('**/api/brain-dump/count/', () => {
      /* nunca resolve: mantém a query em loading */
    })
    await page.reload()

    const fab = page.getByRole('button', { name: 'Captura rápida', exact: true })
    await expect(fab).toBeVisible()
    await expect(fab.locator('.MuiBadge-badge')).toHaveClass(/MuiBadge-invisible/)
    await expect(fab).not.toHaveAttribute('aria-disabled', /.*/)

    // Navegação completa segue alcançável pelo Menu.
    await bottomNav(page).getByRole('button', { name: 'Menu' }).click()
    const sheet = page.getByRole('navigation', { name: 'Navegação completa' })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole('button', { name: 'Configurações', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()

    // E a captura abre.
    await fab.click()
    await expect(captureSheet(page)).toBeVisible()
  })

  // ST-06 no compact: rota de histórico fora dos 3 atalhos ⇒ Menu selecionado, e
  // o chrome do compact é exatamente 3 atalhos + Menu + FAB (nenhuma ação de
  // escrita da superfície).
  test('ST-06 readonly no compact: Menu selecionado e chrome fechado em 3 atalhos + Menu + FAB', async ({
    page,
  }) => {
    await page.goto('/habits/history')
    await expect(page.getByRole('banner')).toContainText('Hábitos — Histórico')

    const nav = bottomNav(page)
    await expect(nav.getByRole('button')).toHaveCount(4)
    await expect(nav.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('button', { name: 'Captura rápida', exact: true })).toBeVisible()

    // No sheet, o destino PAI da rota de histórico é o ativo (AC1).
    await nav.getByRole('button', { name: 'Menu' }).click()
    const sheet = page.getByRole('navigation', { name: 'Navegação completa' })
    await expect(sheet.getByRole('button', { name: 'Hábitos', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(sheet.locator('[aria-current="page"]')).toHaveCount(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Nota aberta pela Story 13.1 e resolvida aqui (Task 8 / AC8): o shell novo
// trocou o scroll de DOCUMENTO por um workspace com `overflow: auto` próprio.
// Duas superfícies legadas usam `position: sticky` horizontal
// (`HealthHistoryTable.tsx:103,141` e `HabitHistoryGrid.tsx:137,181`), e `sticky`
// se ancora no ANCESTRAL DE SCROLL mais próximo — se esse ancestral tivesse
// passado a ser o workspace, a coluna fixa deixaria de acompanhar a rolagem
// horizontal da tabela.
//
// Verificação: cada tabela tem o SEU PRÓPRIO `<Box sx={{ overflowX: 'auto' }}>`
// entre o `sticky` e o workspace, então o ancestral de scroll continua sendo o
// wrapper interno — o workspace do shell não entra na conta. Achado registrado no
// checklist como "funciona (sem onda própria)".
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ancestral de SCROLL real de um elemento `position: sticky`, resolvido no
 * browser: o primeiro ancestral cujo `overflow` cria contexto de rolagem
 * (`auto`/`scroll`/`hidden`/`overlay`). É exatamente o elemento em que o `sticky`
 * se ancora — a pergunta que a nota da Story 13.1 deixou aberta.
 */
async function stickyScrollAncestor(page: Page, columnHeader: string) {
  return page.getByRole('columnheader', { name: columnHeader }).evaluate((el) => {
    const scrolls = (value: string) => ['auto', 'scroll', 'hidden', 'overlay'].includes(value)
    let node = el.parentElement
    while (node && node !== document.documentElement) {
      const style = getComputedStyle(node)
      if (scrolls(style.overflowX) || scrolls(style.overflowY)) {
        return {
          testId: node.getAttribute('data-testid'),
          overflowX: style.overflowX,
          containsTable: Boolean(node.querySelector('table')),
          scrollWidth: node.scrollWidth,
          clientWidth: node.clientWidth,
        }
      }
      node = node.parentElement
    }
    return null
  })
}

/**
 * O `sticky` continua ancorado no wrapper INTERNO da tabela (não no workspace do
 * shell) e, quando a tabela transborda, a coluna fixa de fato não se move ao
 * rolar horizontalmente.
 */
async function expectStickyAnchoredToInnerScroller(
  page: Page,
  stickyHeader: string,
): Promise<void> {
  const ancestor = await stickyScrollAncestor(page, stickyHeader)
  expect(ancestor, 'nenhum ancestral de scroll encontrado').not.toBeNull()
  // O achado: é o wrapper da própria tabela, NÃO o workspace do shell.
  expect(ancestor!.testId).not.toBe('shell-workspace')
  expect(ancestor!.overflowX).toBe('auto')
  expect(ancestor!.containsTable).toBe(true)

  // NOTA: o scroll horizontal do DOCUMENTO nesta rota não é assertado aqui de
  // propósito. Ao montar esta verificação encontramos um transbordo REAL e
  // PRÉ-EXISTENTE da superfície legada de hábitos — `HabitHistoryGrid.srOnly`
  // usa `width: 1`/`height: 1` no `sx`, e no sistema `sizing` do MUI um número
  // ≤ 1 significa **100%**, não 1px: cada rótulo sr-only de coluna vira um span
  // absoluto de 100% da largura, empurrando `documentElement.scrollWidth` para
  // ~2136px num viewport de 800. É dívida da SUPERFÍCIE (Onda 3 / Épico 14),
  // não do chrome — inventariada com dono em `13-shell-a11y-legacy-inventory.md`.
  // O reflow do CHROME é medido em `shell-keyboard.spec.ts` (320/720/640).

  if (ancestor!.scrollWidth <= ancestor!.clientWidth + 1) {
    // Sem transbordo nesta faixa não há rolagem horizontal para exercer — a
    // ancoragem acima é o que responde à nota da 13.1.
    return
  }

  const scroller = page.getByRole('table').locator('..')
  const sticky = page.getByRole('columnheader', { name: stickyHeader })
  const lastColumn = page.getByRole('columnheader').last()
  const stickyBefore = await sticky.boundingBox()
  const lastBefore = await lastColumn.boundingBox()

  await scroller.evaluate((el) => el.scrollTo({ left: el.scrollWidth }))
  // A coluna comum ANDA (prova que a rolagem aconteceu de fato)…
  await expect
    .poll(async () => (await lastColumn.boundingBox())?.x ?? Number.POSITIVE_INFINITY)
    .toBeLessThan((lastBefore?.x ?? 0) - 1)
  // …e a coluna sticky NÃO anda.
  const stickyAfter = await sticky.boundingBox()
  expect(Math.abs((stickyAfter?.x ?? 0) - (stickyBefore?.x ?? 0))).toBeLessThanOrEqual(1)
  await expect(sticky).toBeVisible()
}

// As duas tabelas caem num layout de CARTÕES abaixo de 768px
// (`useMediaQuery('(max-width:767px)')` em ambos os componentes), então a
// verificação do `sticky` só faz sentido a partir do tablet — onde a `<table>`
// de fato existe.
test.describe('Sticky das superfícies de histórico sob o workspace do shell — tablet 800×720', () => {
  test.use({ viewport: { width: 800, height: 720 } })

  test('HealthHistoryTable: sticky ancorado no wrapper da tabela, não no workspace do shell', async ({
    page,
    email,
  }) => {
    test.setTimeout(120_000)
    seedHealthHistory(email)

    await page.goto('/health/metrics/history')
    await expect(page.getByRole('table')).toBeVisible({ timeout: 30_000 })

    await expectStickyAnchoredToInnerScroller(page, 'Data')
  })

  test('HabitHistoryGrid: sticky ancorado no wrapper da grade, não no workspace do shell', async ({
    page,
    email,
  }) => {
    test.setTimeout(120_000)
    seedHabitHistory(email)

    await page.goto('/habits/history')
    await expect(page.getByRole('table')).toBeVisible({ timeout: 30_000 })

    await expectStickyAnchoredToInnerScroller(page, 'Hábito')
  })
})
