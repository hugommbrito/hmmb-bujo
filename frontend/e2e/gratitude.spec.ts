import { test, expect, type Page } from './fixtures'
import { seedGratitudeEntry } from './seedGratitude'

// Cobre a Story 9.1 (Entradas de texto livre) ponta-a-ponta contra o backend real, sem
// mocks de rede:
//  - AC1/AC7: adicionar entrada de texto livre pelo composer (resposta otimista) e a
//    persistência entre recarregamentos.
//  - AC2/AC3: múltiplas entradas na MESMA data (N linhas/dia, sem constraint de
//    unicidade) em ordem cronológica ascendente, cada uma exibindo hora e data.
//  - AC3/AC6: listagem por data com hora exibida; estado vazio informativo.
//  - AC4: seletor de data (hoje/ontem) — o composer registra na data selecionada; em
//    hoje não há datas futuras ("Próximo dia" desabilitado).
//  - AC5: o item "Gratidão" da sidebar abre o Diário de Gratidão; e o link contextual
//    "Gratidão de ontem" a partir de /today abre o diário em ontem (data derivada de
//    today_for no servidor — casa com o seed).
//
// Nota de locator: o texto da entrada aparece em DOIS lugares durante o fluxo — no
// `<textarea>` do composer (até o reset no onSuccess) e no `<li>` da lista. Por isso as
// asserções de "a entrada aparece" são escopadas ao `listitem` (`getByRole('listitem')`),
// evitando a colisão de strict-mode com o textarea.

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

function entryItem(page: Page, text: string) {
  return page.getByRole('listitem').filter({ hasText: text })
}

// Todas as entradas da superfície (escopadas ao <main> do diário, para a contagem/ordem
// não colher nenhum <li> fora da lista de gratidão).
function entryList(page: Page) {
  return page.getByRole('main', { name: 'Diário de Gratidão' }).getByRole('listitem')
}

// Registra uma entrada e ESPERA o POST persistir antes de prosseguir. A resposta é
// otimista (aparece na hora), mas recarregar/navegar antes do POST comprometer perderia
// a entrada — mesma razão do helper `syncAfter` do bujo (fixtures.ts). Sem esperar aqui,
// o `page.reload()` correria com o POST (~2s) e a persistência falharia por corrida.
async function addGratitudeEntry(page: Page, text: string) {
  await page.getByLabel('Sua gratidão').fill(text)
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/gratitude/entries/') && r.request().method() === 'POST',
    ),
    page.getByRole('button', { name: 'Adicionar' }).click(),
  ])
}

test('adiciona entrada de gratidão em texto livre, exibe hora e persiste (AC1, AC3, AC6, AC7)', async ({
  page,
}) => {
  const consoleErrors = trackConsoleErrors(page)

  await page.goto('/gratitude')

  await expect(page.getByRole('main', { name: 'Diário de Gratidão' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Diário de Gratidão', level: 2 })).toBeVisible()
  // AC6 — estado vazio informativo (voz neutra, sem CTA gamificado).
  await expect(page.getByText('Nenhuma entrada para esta data.')).toBeVisible()

  // AC1/AC7 — registrar a entrada (otimista: aparece imediatamente; espera o POST).
  await addGratitudeEntry(page, 'Grato pelo sol da manhã')

  const entry = entryItem(page, 'Grato pelo sol da manhã')
  await expect(entry).toBeVisible()
  // AC3 — cada entrada exibe hora (HH:MM).
  await expect(entry.getByText(/\d{2}:\d{2}/)).toBeVisible()

  // AC7 — persistência: recarregar mantém a entrada gravada.
  await page.reload()
  await expect(entryItem(page, 'Grato pelo sol da manhã')).toBeVisible()

  expect(consoleErrors).toEqual([])
})

test('múltiplas entradas na MESMA data persistem em ordem cronológica, cada uma com hora e data (AC2, AC3)', async ({
  page,
}) => {
  const consoleErrors = trackConsoleErrors(page)

  await page.goto('/gratitude')
  await expect(page.getByText('Nenhuma entrada para esta data.')).toBeVisible()

  // AC2 — N linhas por data: duas entradas na MESMA data (hoje), SEM constraint de
  // unicidade por dia. Ambas devem persistir.
  await addGratitudeEntry(page, 'Primeira gratidão do dia')
  await addGratitudeEntry(page, 'Segunda gratidão do dia')

  await expect(entryItem(page, 'Primeira gratidão do dia')).toBeVisible()
  await expect(entryItem(page, 'Segunda gratidão do dia')).toBeVisible()

  // AC2 — as duas coexistem no mesmo dia (duas <li>).
  const items = entryList(page)
  await expect(items).toHaveCount(2)

  // AC3 — ordem cronológica ascendente: a 1ª adicionada vem antes da 2ª.
  await expect(items.nth(0)).toContainText('Primeira gratidão do dia')
  await expect(items.nth(1)).toContainText('Segunda gratidão do dia')

  // AC3 — cada entrada exibe hora (HH:MM) E data (DD/MM/AAAA).
  const first = entryItem(page, 'Primeira gratidão do dia')
  await expect(first.getByText(/\d{2}:\d{2}/)).toBeVisible()
  await expect(first).toContainText(/\d{2}\/\d{2}\/\d{4}/)

  // Persistência: recarregar mantém ambas, na mesma ordem cronológica.
  await page.reload()
  const reloaded = entryList(page)
  await expect(reloaded).toHaveCount(2)
  await expect(reloaded.nth(0)).toContainText('Primeira gratidão do dia')
  await expect(reloaded.nth(1)).toContainText('Segunda gratidão do dia')

  expect(consoleErrors).toEqual([])
})

test('o seletor de data registra na data selecionada e persiste por data (AC4)', async ({
  page,
}) => {
  const consoleErrors = trackConsoleErrors(page)

  await page.goto('/gratitude')

  // AC4 — em hoje (default) não há datas futuras: "Próximo dia" fica desabilitado.
  await expect(page.getByRole('button', { name: 'Próximo dia' })).toBeDisabled()

  // AC4 — trocar para ontem e registrar lá.
  await page.getByRole('button', { name: 'Dia anterior' }).click()
  // Fora de hoje, avançar volta a ser possível.
  await expect(page.getByRole('button', { name: 'Próximo dia' })).toBeEnabled()
  await expect(page.getByText('Nenhuma entrada para esta data.')).toBeVisible()
  await addGratitudeEntry(page, 'Grato por ontem')
  await expect(entryItem(page, 'Grato por ontem')).toBeVisible()

  // Voltar para hoje: a entrada de ontem não aparece (isolamento por data) e "Próximo
  // dia" volta a ficar desabilitado (cap em hoje).
  await page.getByRole('button', { name: 'Próximo dia' }).click()
  await expect(page.getByRole('button', { name: 'Próximo dia' })).toBeDisabled()
  await expect(page.getByText('Nenhuma entrada para esta data.')).toBeVisible()
  await expect(entryItem(page, 'Grato por ontem')).toHaveCount(0)

  // Voltar para ontem: a entrada persiste.
  await page.getByRole('button', { name: 'Dia anterior' }).click()
  await expect(entryItem(page, 'Grato por ontem')).toBeVisible()

  expect(consoleErrors).toEqual([])
})

test('o link "Gratidão de ontem" no /today abre o diário em ontem com a entrada de ontem (AC4, AC5)', async ({
  page,
  email,
}) => {
  const consoleErrors = trackConsoleErrors(page)

  // Seed de uma entrada em ONTEM (data derivada de today_for no servidor — casa com o
  // alvo do link, que também deriva de today_for).
  const { date: yesterday } = seedGratitudeEntry(email, {
    text: 'Gratidão registrada ontem',
    daysAgo: 1,
  })

  await page.goto('/today')
  await page.getByRole('link', { name: 'Gratidão de ontem' }).click()

  // AC5 — o link abre o Diário de Gratidão exatamente em ontem.
  await expect(page).toHaveURL(`/gratitude?date=${yesterday}`)
  await expect(page.getByRole('main', { name: 'Diário de Gratidão' })).toBeVisible()
  await expect(entryItem(page, 'Gratidão registrada ontem')).toBeVisible()

  expect(consoleErrors).toEqual([])
})

test('o item "Gratidão" da sidebar abre o Diário de Gratidão (AC5)', async ({ page }) => {
  const consoleErrors = trackConsoleErrors(page)

  // O signup landa em /today; a sidebar (desktop, expandida) já traz o item "Gratidão".
  await page.getByRole('button', { name: 'Gratidão', exact: true }).click()

  // AC5 — a superfície real (não mais o stub) abre em /gratitude, no hoje por padrão.
  await expect(page).toHaveURL('/gratitude')
  await expect(page.getByRole('main', { name: 'Diário de Gratidão' })).toBeVisible()
  await expect(page.getByText('Nenhuma entrada para esta data.')).toBeVisible()

  expect(consoleErrors).toEqual([])
})
