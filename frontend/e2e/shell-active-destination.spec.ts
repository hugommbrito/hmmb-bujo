import { test, expect } from './fixtures'
import { bottomNav, mainNav, navigationSheet } from './shellHelpers'

// DESTINO ATIVO no ROUTER REAL — o predicado único da Story 13.4 (AC1,
// SHELL-DEBT-03) medido contra o `createBrowserRouter` de produção, com params de
// rota reais.
//
// Por que este spec existe (lacuna do passo de QA): a invariante "exatamente UM
// `aria-current="page"` por superfície de navegação em toda rota autenticada" e o
// mapa rota → destino pai estavam provados APENAS em jsdom
// (`shellDestinations.test.ts` sobre a lista `shellRoutes`, `ShellSidebar.test.tsx`
// com `MemoryRouter`). Em jsdom o pathname é injetado à mão; aqui ele vem do
// router real, com `useLocation` reagindo ao match mais profundo e com os
// segmentos `:date`/`:weekStart`/`:monthFirst`/aninhamentos de `settings/*`
// resolvidos de verdade.
//
// Os pares de PREFIXO COLIDENTE que o AC1 nomeia como o modo de falha da migração
// para prefixo — `/settings` × `/settings/{habits,health-metrics,medications}` e
// `/archive` × `/archive/{weekly,monthly}/*` — não eram visitados por NENHUM
// teste E2E antes deste arquivo: um segundo `aria-current` nascendo aí passaria
// pelo gate axe (que não conta ocorrências) e por toda a suíte de browser.
//
// [Source: Story 13.4 AC1 + Riscos concretos #1; 13-shell-parity-checklist.md
//  SB-05/SB-13, ST-06; EXPERIENCE.md §Accessibility Floor]

/**
 * Rota autenticada (as 22 de `shellRouting.ts`) → nome acessível do destino que
 * deve ficar ativo. `null` = **nenhum** destino ativo POR CONTRATO (a rota não
 * tem destino próprio nem é prefixo de um).
 *
 * As 9 rotas profundas que antes da 13.4 deixavam a sidebar sem nenhum ativo
 * estão marcadas com ◀ — são a mudança de comportamento intencional do AC1.
 */
// Story 16.1: duas rotas de Hábitos viraram REDIRECT (a superfície é única, com
// abas em `?tab=`). O 3º elemento é a URL RESOLVIDA quando difere da pedida —
// sem ele o `toHaveURL(path)` reprovaria por um motivo que não é o do teste.
const EXPECTED_ACTIVE: ReadonlyArray<readonly [string, string | RegExp | null, string?]> = [
  ['/today', 'Hoje'],
  // Sem destino próprio e sem pai: contrato registrado, não bug (AC1).
  ['/daily/2026-07-01', null],
  ['/planner/week', 'Esta Semana'],
  ['/planner/month', 'Este Mês'],
  ['/planner/future', 'Futuro'],
  ['/planner/recurring', 'Recorrentes'],
  ['/brain-dump', /^Brain Dump/],
  ['/archive', 'Arquivo'],
  ['/archive/weekly/2026-07-20', 'Arquivo'], // ◀ prefixo profundo
  ['/archive/monthly/2026-07-01', 'Arquivo'], // ◀ prefixo profundo
  ['/settings', 'Configurações'],
  // ◀ redirect da 16.1: resolve em `/habits?tab=configuracao`, logo o destino
  // ativo passa a ser Hábitos (a rota de Configurações não existe mais).
  ['/settings/habits', 'Hábitos', '/habits?tab=configuracao'],
  ['/settings/health-metrics', 'Configurações'], // ◀ prefixo colidente
  ['/settings/medications', 'Configurações'], // ◀ prefixo colidente
  ['/habits', 'Hábitos'],
  ['/habits/history', 'Hábitos', '/habits?tab=historico'], // ◀ redirect da 16.1
  ['/health/metrics', 'Métricas'],
  ['/health/metrics/history', 'Métricas'], // ◀
  ['/health/medications', 'Medicamentos'],
  ['/health/medications/history', 'Medicamentos'], // ◀
  ['/gratitude', 'Gratidão'],
  ['/gratitude/history', 'Gratidão'], // ◀
]

test.describe('Destino ativo no router real — wide 1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  // Uma única sessão para as 22 rotas: `page.goto` é ~1s, um signup por rota
  // custaria 22× o setup (risco #10 da story — não cortar cobertura, cortar
  // setup).
  test('exatamente um aria-current no destino pai correto, em toda rota autenticada', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    const nav = mainNav(page)

    for (const [path, expected, resolvedUrl] of EXPECTED_ACTIVE) {
      await page.goto(path)
      await expect(page, path).toHaveURL(resolvedUrl ?? path)
      // Marcador estável: o chrome montou (a nav deriva só do pathname, mas medir
      // antes da montagem mediria zero elementos e passaria em falso).
      await expect(nav.getByRole('button', { name: 'Colapsar sidebar' }), path).toBeVisible()

      const active = nav.locator('[aria-current="page"]')
      if (expected === null) {
        await expect(active, `${path}: contrato = nenhum destino ativo`).toHaveCount(0)
      } else {
        await expect(active, `${path}: exatamente UM ativo na sidebar`).toHaveCount(1)
        await expect(active, `${path}: o ativo é o destino pai`).toHaveAccessibleName(expected)
      }

      // SB-05/SB-13 — o agrupador NUNCA recebe aria-current, em nenhuma rota.
      await expect(nav.locator('[aria-expanded][aria-current]'), path).toHaveCount(0)
    }
  })

  // SB-05/SB-13 na variante que só existe depois do AC1: o filho ativo por
  // PREFIXO (rota de histórico) com o agrupador RECOLHIDO. A 13.2 provou este
  // contrato apenas com a rota exata de um filho (`/planner/week`).
  test('agrupador recolhido com filho ativo por rota profunda: .contains, aria-expanded e nenhum aria-current', async ({
    page,
  }) => {
    await page.goto('/health/medications/history')
    const nav = mainNav(page)
    const group = nav.getByRole('button', { name: 'Saúde' })

    await expect(nav.getByRole('button', { name: 'Medicamentos' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    // Recolher o grupo: a descrição só existe com o grupo fechado (`showContains`).
    await group.click()
    await expect(group).toHaveAttribute('aria-expanded', 'false')
    await expect(nav.getByRole('button', { name: 'Medicamentos' })).toHaveCount(0)

    // O agrupador indica que contém a rota atual — sem herdar aria-current.
    await expect(group).not.toHaveAttribute('aria-current', /.*/)
    const describedBy = await group.getAttribute('aria-describedby')
    expect(describedBy, 'aria-describedby do agrupador com filho ativo').toBeTruthy()
    await expect(page.locator(`#${describedBy}`)).toHaveText(
      'Contém a página atual: Medicamentos.',
    )

    // E a sidebar fica sem NENHUM aria-current (o ativo desmontou com o Collapse):
    // é o mesmo contrato da 13.2 — o agrupador não vira o portador do atributo.
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(0)
  })
})

test.describe('Destino ativo no router real — compact 390×720', () => {
  test.use({ viewport: { width: 390, height: 720 } })

  // O contrato de `/daily/:date` no compact: nenhum destino ativo, mas o item
  // Menu aparece selecionado (DIV-10). Só o lado da sidebar estava provado.
  test('/daily/:date: Menu selecionado e nenhum destino ativo no sheet', async ({ page }) => {
    await page.goto('/daily/2026-07-01')
    const nav = bottomNav(page)

    await expect(nav.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-current', 'page')
    for (const label of ['Hoje', 'Esta Semana', 'Este Mês']) {
      await expect(nav.getByRole('button', { name: label })).not.toHaveAttribute('aria-current')
    }
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1)

    await nav.getByRole('button', { name: 'Menu' }).click()
    const sheet = navigationSheet(page)
    await expect(sheet).toBeVisible()
    await expect(sheet.locator('[aria-current="page"]')).toHaveCount(0)
  })

  // Os dois pares de prefixo colidente na superfície do sheet: o pai ativo UMA
  // vez, com o Menu selecionado na barra.
  for (const { path, parent } of [
    { path: '/settings/medications', parent: 'Configurações' },
    { path: '/archive/weekly/2026-07-20', parent: 'Arquivo' },
  ]) {
    test(`${path}: Menu selecionado e ${parent} ativo uma única vez no sheet`, async ({ page }) => {
      await page.goto(path)
      const nav = bottomNav(page)
      await expect(nav.getByRole('button', { name: 'Menu' })).toHaveAttribute(
        'aria-current',
        'page',
      )

      await nav.getByRole('button', { name: 'Menu' }).click()
      const sheet = navigationSheet(page)
      await expect(sheet.getByRole('button', { name: parent, exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      )
      await expect(sheet.locator('[aria-current="page"]')).toHaveCount(1)
    })
  }
})
