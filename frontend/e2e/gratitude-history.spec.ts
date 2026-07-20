import { test, expect, type Page } from './fixtures'
import { seedGratitudeEntry } from './seedGratitude'

// Cobre a Story 9.2 (Histórico navegável por data e mês) ponta-a-ponta contra o backend
// real (branch Neon `e2e`), sem mocks de rede:
//  - AC6: aba "Histórico" (sub-rota /gratitude/history) + handle.title anunciado.
//  - AC1/AC2: mês corrente agrupado por dia, entradas em ordem cronológica ascendente.
//  - AC4: navegação "Mês anterior" até o mês semeado; "Próximo mês" desabilitado no mês
//    corrente (sem futuro) e habilitado fora dele.
//  - AC3: modo "por data" (reusa o read-model diário da 9.1) exibindo as entradas de uma
//    data específica; "Voltar ao mês" retorna à visão de mês.
//
// Nota de locator: o texto da entrada aparece só no <li> da lista (não há composer no
// histórico), então as asserções escopam ao `listitem` dentro do <main> do diário.

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

function entryItem(page: Page, text: string) {
  return page.getByRole('main', { name: 'Diário de Gratidão' }).getByRole('listitem').filter({
    hasText: text,
  })
}

function entryList(page: Page) {
  return page.getByRole('main', { name: 'Diário de Gratidão' }).getByRole('listitem')
}

test('navega o histórico por mês (agrupado por dia) e por data (AC1, AC2, AC3, AC4, AC6)', async ({
  page,
  email,
}) => {
  const consoleErrors = trackConsoleErrors(page)

  // Seed: duas entradas HOJE (mesmo dia → grupo com ordem cronológica no mês corrente) +
  // uma entrada ~40 dias atrás (garantidamente um mês anterior). As datas são computadas
  // no servidor (today_for), então `todayIso`/`pastDate` casam com o que a UI busca.
  const { date: todayIso } = seedGratitudeEntry(email, { text: 'Gratidão de hoje (1)' })
  seedGratitudeEntry(email, { text: 'Gratidão de hoje (2)' })
  const { date: pastDate } = seedGratitudeEntry(email, {
    text: 'Gratidão do mês passado',
    daysAgo: 40,
  })

  // Quantos cliques em "Mês anterior" até o mês semeado (1 ou 2, conforme o dia de hoje).
  const [ty, tm] = todayIso.split('-').map(Number)
  const [py, pm] = pastDate.split('-').map(Number)
  const monthSteps = (ty - py) * 12 + (tm - pm)

  // AC6 — abrir a superfície e ir para a aba "Histórico".
  await page.goto('/gratitude')
  await page.getByRole('tab', { name: 'Histórico' }).click()
  await expect(page).toHaveURL('/gratitude/history')
  await expect(page.getByRole('heading', { name: 'Histórico', level: 2 })).toBeVisible()
  // O RouteAnnouncer anuncia o handle.title da rota (região visualmente oculta).
  await expect(page.getByText('Histórico de Gratidão')).toBeAttached()

  // AC1/AC2 — mês corrente agrupado por dia: as duas entradas de hoje, em ordem
  // cronológica ascendente, sob o cabeçalho do dia.
  await expect(entryItem(page, 'Gratidão de hoje (1)')).toBeVisible()
  const items = entryList(page)
  await expect(items).toHaveCount(2)
  await expect(items.nth(0)).toContainText('Gratidão de hoje (1)')
  await expect(items.nth(1)).toContainText('Gratidão de hoje (2)')

  // AC4 — no mês corrente não há futuro: "Próximo mês" desabilitado.
  await expect(page.getByRole('button', { name: 'Próximo mês' })).toBeDisabled()

  // AC4 — navegar "Mês anterior" até o mês semeado.
  for (let i = 0; i < monthSteps; i++) {
    await page.getByRole('button', { name: 'Mês anterior' }).click()
  }
  await expect(entryItem(page, 'Gratidão do mês passado')).toBeVisible()
  // Fora do mês corrente, "Próximo mês" volta a ficar habilitado.
  await expect(page.getByRole('button', { name: 'Próximo mês' })).toBeEnabled()

  // AC3 — modo "por data": ir direto à data semeada e ver a entrada daquela data.
  await page.getByLabel('Ir para data').fill(pastDate)
  await expect(entryItem(page, 'Gratidão do mês passado')).toBeVisible()

  // "Voltar ao mês" retorna à visão de mês (o navegador de mês reaparece).
  await page.getByRole('button', { name: 'Voltar ao mês' }).click()
  await expect(page.getByRole('button', { name: 'Mês anterior' })).toBeVisible()

  expect(consoleErrors).toEqual([])
})
