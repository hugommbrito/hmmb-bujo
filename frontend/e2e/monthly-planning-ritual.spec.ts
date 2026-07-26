import { test, expect } from './fixtures'
import { expectNoAxeViolations } from './axeHelper'
import { countRitualContainers } from './countRitualContainers'
import { mainNav } from './shellHelpers'
import { seedMonthlyPlanningScenario } from './seedMonthlyPlanningScenario'

// Cobre o ritual de planejamento mensal do sistema novo (Story 14.6, AC5/AC9)
// contra o backend REAL da branch Neon `e2e`. `/planner/month/planning` é a
// QUARTA superfície interna migrada — o gate de acessibilidade roda SEM
// `exclude: 'main'`.

test.describe('Monthly Planning Ritual — wide 1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('abrir o ritual NÃO materializa nenhum container novo (AC5, lição da 14.1/14.2)', async ({
    page,
    email,
  }) => {
    seedMonthlyPlanningScenario(email)
    const before = countRitualContainers(email)

    await page.goto('/planner/month/planning')
    await expect(page.getByRole('main', { name: /Planejar/ })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Fontes do planejamento mensal' })).toBeVisible()
    await expect(page.getByRole('region', { name: /Decisões —/ })).toBeVisible()

    const after = countRitualContainers(email)
    expect(after.weekly).toBe(before.weekly)
    expect(after.monthly).toBe(before.monthly)
    expect(after.daily).toBe(before.daily)
    expect(after.decisions).toBe(before.decisions)
  })

  test('as 3 fontes carregam independentemente — uma em erro não bloqueia as outras (AC5)', async ({
    page,
    email,
  }) => {
    seedMonthlyPlanningScenario(email)

    await page.route('**/api/bujo/rituals/monthly/sources/previous-monthly/**', (route) =>
      route.abort('failed'),
    )

    await page.goto('/planner/month/planning')
    await expect(page.getByRole('main', { name: /Planejar/ })).toBeVisible()

    // Fonte ativa por padrão (recurring) segue operável.
    await expect(page.getByText('Recorrente mensal')).toBeVisible()

    const sourceRail = page.getByRole('navigation', { name: 'Fontes do planejamento mensal' })

    await sourceRail.getByRole('button', { name: /Monthly anterior/ }).click()
    await expect(page.getByRole('alert')).toBeVisible()

    await sourceRail.getByRole('button', { name: /Future Log/ }).click()
    await expect(page.getByText('Item do Future Log para o mês-alvo')).toBeVisible()
  })

  test('recorrentes: Alocar abre o seletor de destino mensal e persiste a instância, saindo do progresso para "Já alocados" (AC5)', async ({
    page,
    email,
  }) => {
    test.setTimeout(60_000)
    seedMonthlyPlanningScenario(email)

    await page.goto('/planner/month/planning')
    await expect(page.getByRole('main', { name: /Planejar/ })).toBeVisible()
    await expect(page.getByText('Mensais')).toBeVisible()
    await expect(page.getByText('Recorrente mensal')).toBeVisible()

    const placeResponse = page.waitForResponse(
      (r) => r.url().includes('/place/') && r.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Alocar' }).click()
    const picker = page.getByRole('dialog', { name: 'Escolher destino' })
    await expect(picker).toBeVisible()
    await picker.getByRole('gridcell', { name: '10', exact: true }).click()
    await expect(picker.getByText(/Migrar para 10 de/)).toBeVisible()
    await picker.getByRole('button', { name: 'Confirmar' }).click()
    expect((await placeResponse).status()).toBe(201)

    await expect(picker).toHaveCount(0)
    // Sai da seção em progresso ("Mensais") — refeito o fetch, o template
    // migra para a seção "Já alocados" (fora do progresso, AC5), continuando
    // acessível para novas instâncias conscientes.
    await expect(page.getByText('Mensais')).toHaveCount(0)
    await expect(
      page.getByLabel('Já alocados (fora do progresso)').getByText('Recorrente mensal'),
    ).toBeVisible()
  })

  test('future-log: Manter sem dia persiste decisão sem mudar a tarefa; sem toast (AC5)', async ({
    page,
    email,
  }) => {
    test.setTimeout(60_000)
    seedMonthlyPlanningScenario(email)

    await page.goto('/planner/month/planning')
    await expect(page.getByRole('main', { name: /Planejar/ })).toBeVisible()
    const sourceRail = page.getByRole('navigation', { name: 'Fontes do planejamento mensal' })
    await sourceRail.getByRole('button', { name: /Future Log/ }).click()
    await expect(page.getByText('Item do Future Log para o mês-alvo')).toBeVisible()

    await page.getByRole('button', { name: 'Manter sem dia' }).click()
    await expect(page.getByText('Item do Future Log para o mês-alvo')).toHaveCount(0)
    await expect(page.locator('.MuiSnackbar-root')).toHaveCount(0)

    await page.getByRole('button', { name: 'Tudo' }).click()
    await expect(page.getByText('Item do Future Log para o mês-alvo')).toBeVisible()
  })

  test('previous-monthly: fonte bloqueante — concluir zera a pendência e libera Finalizar mês anterior (AC3, AC5)', async ({
    page,
    email,
  }) => {
    test.setTimeout(60_000)
    seedMonthlyPlanningScenario(email)

    await page.goto('/planner/month/planning')
    await expect(page.getByRole('main', { name: /Planejar/ })).toBeVisible()
    const sourceRail = page.getByRole('navigation', { name: 'Fontes do planejamento mensal' })

    await sourceRail.getByRole('button', { name: /Monthly anterior/ }).click()
    await expect(page.getByText('Pendência do mês anterior')).toBeVisible()
    await page.getByRole('button', { name: 'Concluir', exact: true }).click()
    await expect(page.getByText('Mês anterior pronto para finalizar.')).toBeVisible()

    await page.getByRole('button', { name: 'Finalizar mês anterior' }).click()
    await expect(page.getByRole('alertdialog', { name: /irreversível/ })).toBeVisible()
    await page.getByRole('button', { name: 'Confirmar' }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
  })

  test('painel de verificação: os 3 gates de Iniciar mês aparecem individualmente; sem "Cancelar planejamento" (AC3)', async ({
    page,
    email,
  }) => {
    seedMonthlyPlanningScenario(email)

    await page.goto('/planner/month/planning')
    await expect(page.getByRole('main', { name: /Planejar/ })).toBeVisible()

    const panel = page.getByRole('region', { name: 'Painel de verificação — Iniciar mês' })
    await expect(panel).toBeVisible()
    await expect(panel).toContainText('Data alcançada')
    await expect(panel).toContainText('Planejamento concluído')
    await expect(panel).toContainText('Monthly anterior finalizado')

    const startButton = panel.getByRole('button', { name: 'Iniciar mês', exact: true })
    await expect(startButton).toHaveAttribute('aria-disabled', 'true')

    // AC3 — divergência deliberada do Weekly: nenhuma tela do Monthly tem
    // "Cancelar planejamento".
    await expect(page.getByRole('button', { name: 'Cancelar planejamento' })).toHaveCount(0)
  })

  test('seletor de destino mensal: calendário + entrada direta do dia, Enter confirma a ação nomeada (AC5)', async ({
    page,
    email,
  }) => {
    seedMonthlyPlanningScenario(email)

    await page.goto('/planner/month/planning')
    await expect(page.getByRole('main', { name: /Planejar/ })).toBeVisible()
    const sourceRail = page.getByRole('navigation', { name: 'Fontes do planejamento mensal' })
    await sourceRail.getByRole('button', { name: /Future Log/ }).click()
    await expect(page.getByText('Item do Future Log para o mês-alvo')).toBeVisible()

    await page.getByRole('button', { name: 'Escolher destino…' }).click()
    const picker = page.getByRole('dialog', { name: 'Escolher destino' })
    await expect(picker).toBeVisible()

    await picker.getByLabel('Número do dia').fill('12')
    await expect(picker.getByRole('gridcell', { name: '12', exact: true })).toHaveAttribute('aria-current', 'true')
    const migrateResponse = page.waitForResponse(
      (r) => r.url().includes('/migrate/') && r.request().method() === 'POST',
    )
    await page.keyboard.press('Enter')
    const response = await migrateResponse
    expect(response.status()).toBe(200)
    const requestPayload = response.request().postDataJSON()
    expect(requestPayload.destination).toBe('future')
    expect(requestPayload.scheduledDate).toMatch(/-12$/)

    await expect(picker).toHaveCount(0)
    // A origem vira `postponed` (terminal, sem novo item de decisão); a
    // SUCESSORA nasce no mesmo Monthly-alvo já com dia — ela mesma volta a
    // aparecer na fonte Future Log (item "com data" é uma disposição válida,
    // AC5), então o título continua visível uma única vez (não some por
    // completo — a linhagem, não a ausência, é a prova da migração real).
    await expect(page.getByText('Item do Future Log para o mês-alvo')).toHaveCount(1)
  })

  test('offline desabilita decisões com motivo; clique fica guardado, sem fila local (AC7)', async ({
    page,
    email,
  }) => {
    seedMonthlyPlanningScenario(email)

    await page.goto('/planner/month/planning')
    await expect(page.getByRole('main', { name: /Planejar/ })).toBeVisible()
    const sourceRail = page.getByRole('navigation', { name: 'Fontes do planejamento mensal' })
    await sourceRail.getByRole('button', { name: /Future Log/ }).click()
    await expect(page.getByText('Item do Future Log para o mês-alvo')).toBeVisible()

    await page.context().setOffline(true)
    try {
      await expect(page.getByRole('status').filter({ hasText: 'Sem conexão' })).toBeVisible()
      const keepButton = page.getByRole('button', { name: 'Manter sem dia' })
      await expect(keepButton).toHaveAttribute('aria-disabled', 'true')

      // Clique GUARDADO (nunca `disabled` nativo, nunca fila local): `force`
      // contorna a checagem de actionability do Playwright (que já trata
      // `aria-disabled="true"` como não-clicável) para provar que o PRÓPRIO
      // componente também guarda o clique internamente — defesa em camadas.
      await keepButton.click({ force: true })
      await expect(page.getByText('Item do Future Log para o mês-alvo')).toBeVisible()
    } finally {
      await page.context().setOffline(false)
    }
    await expect(page.getByRole('status').filter({ hasText: 'Sem conexão' })).toHaveCount(0)
  })

  test('axe sem exclude: main', async ({ page, email }) => {
    seedMonthlyPlanningScenario(email)
    await page.goto('/planner/month/planning')
    await expect(page.getByRole('main', { name: /Planejar/ })).toBeVisible()

    await expectNoAxeViolations(page, { label: 'wide · /planner/month/planning' })
  })
})

test.describe('Monthly Planning Ritual — medium 1280×800', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('axe sem exclude: main em medium', async ({ page, email }) => {
    seedMonthlyPlanningScenario(email)
    await page.goto('/planner/month/planning')
    await expect(page.getByRole('main', { name: /Planejar/ })).toBeVisible()

    await expectNoAxeViolations(page, { label: 'medium · /planner/month/planning' })
  })
})

test.describe('Monthly Planning Ritual — tablet 800×720', () => {
  test.use({ viewport: { width: 800, height: 720 } })

  test('axe sem exclude: main em tablet', async ({ page, email }) => {
    seedMonthlyPlanningScenario(email)
    await page.goto('/planner/month/planning')
    await expect(page.getByRole('main', { name: /Planejar/ })).toBeVisible()
    await mainNav(page).getByRole('button', { name: 'Expandir sidebar' }).click()

    await expectNoAxeViolations(page, { label: 'tablet · /planner/month/planning' })
  })
})

test.describe('Monthly Planning Ritual — compact 390×720', () => {
  test.use({ viewport: { width: 390, height: 720 } })

  test('axe sem exclude: main em compact', async ({ page, email }) => {
    seedMonthlyPlanningScenario(email)
    await page.goto('/planner/month/planning')
    await expect(page.getByRole('main', { name: /Planejar/ })).toBeVisible()

    await expectNoAxeViolations(page, { label: 'compact 390 · /planner/month/planning' })
  })
})

test.describe('Monthly Planning Ritual — reflow 320×720', () => {
  test.use({ viewport: { width: 320, height: 720 } })

  test('reflow em 320 CSS px sem scroll horizontal; axe sem exclude: main (AC7)', async ({
    page,
    email,
  }) => {
    seedMonthlyPlanningScenario(email)
    await page.goto('/planner/month/planning')
    await expect(page.getByRole('main', { name: /Planejar/ })).toBeVisible()

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)

    await expectNoAxeViolations(page, { label: 'reflow 320 · /planner/month/planning' })
  })
})
