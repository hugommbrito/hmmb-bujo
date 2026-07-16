import { test, expect, syncAfter, detailPanel } from './fixtures'

// Cobre a Story 11.6 (mover/migrar tarefa de qualquer superfície) e a Story
// 11.10 (seletor reformulado: 4 abas Hoje/Esta semana/Este mês/Futuro +
// confirmação explícita via botão "Migrar") ponta-a-ponta contra o backend
// real — sem mocks de rede. Complementa os testes unitários de
// serviço/view (backend) e de componente (TaskDestinationDialog/TaskRow/
// TaskDetailPanel, frontend): aqui valida-se o fluxo real através do kebab do
// TaskRow e do painel de detalhe, nas 4 superfícies (Daily Log, Esta Semana,
// Este Mês, Futuro).

function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function nextMonthValue(): string {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
}

test('move do Daily Log para um dia da semana corrente via calendário; origem vira Migrada (AC1, AC2, AC3)', async ({
  page,
}) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.getByLabel('Nova tarefa').fill('Tarefa a mover para o dia')
  await syncAfter(page, () => page.getByRole('button', { name: 'Nova tarefa' }).click())
  const originRow = page.getByTestId('task-row').filter({ hasText: 'Tarefa a mover para o dia' })
  await expect(originRow).toBeVisible()

  await originRow.getByRole('button', { name: 'Mover tarefa' }).click()
  const dialog = page.getByRole('dialog', { name: 'Migrar Tarefa' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('tab', { name: 'Esta semana' }).click()

  const today = new Date()
  await dialog.getByRole('button', { name: new RegExp(`^${today.getDate()} de `) }).click()

  const migrateResponse = page.waitForResponse(
    (r) => r.url().includes('/migrate/') && r.request().method() === 'POST',
  )
  await dialog.getByRole('button', { name: 'Migrar' }).click()
  const response = await migrateResponse
  expect(response.status()).toBe(200)
  await expect(dialog).toHaveCount(0)

  await expect(originRow.getByLabel('Migrada')).toBeVisible()

  await page.getByRole('button', { name: 'Esta Semana' }).click()
  await expect(
    page.getByTestId('task-row').filter({ hasText: 'Tarefa a mover para o dia' }),
  ).toBeVisible()

  expect(consoleErrors).toEqual([])
})

test('move de Esta Semana para Este Mês via calendário (dia); origem vira Adiada — fecha a lacuna do bug relatado (AC2, AC3, AC4)', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.getByRole('button', { name: 'Esta Semana' }).click()
  await expect(page.getByLabel('Esta Semana')).toBeVisible()
  await page.getByLabel('Título').fill('Tarefa a adiar no mês')
  await page.getByRole('button', { name: 'Adicionar' }).click()
  const originRow = page.getByTestId('task-row').filter({ hasText: 'Tarefa a adiar no mês' })
  await expect(originRow).toBeVisible()

  await originRow.getByRole('button', { name: 'Mover tarefa' }).click()
  const dialog = page.getByRole('dialog', { name: 'Migrar Tarefa' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('tab', { name: 'Este mês' }).click()

  const today = new Date()
  await dialog.getByRole('button', { name: new RegExp(`^${today.getDate()} de `) }).click()

  const migrateResponse = page.waitForResponse(
    (r) => r.url().includes('/migrate/') && r.request().method() === 'POST',
  )
  await dialog.getByRole('button', { name: 'Migrar' }).click()
  const response = await migrateResponse
  expect(response.status()).toBe(200)
  const requestPayload = response.request().postDataJSON()
  expect(requestPayload.scheduledDate).toBe(todayIso())
  await expect(dialog).toHaveCount(0)

  await expect(originRow.getByLabel('Adiada')).toBeVisible()

  await page.getByRole('button', { name: 'Este Mês' }).click()
  await expect(
    page.getByTestId('task-row').filter({ hasText: 'Tarefa a adiar no mês' }),
  ).toBeVisible()

  expect(consoleErrors).toEqual([])
})

test('move de Esta Semana clicando no calendário da própria aba "Esta semana" (origem = superfície do bug relatado, AC4)', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.getByRole('button', { name: 'Esta Semana' }).click()
  await expect(page.getByLabel('Esta Semana')).toBeVisible()
  await page.getByLabel('Título').fill('Tarefa nascida em Esta Semana')
  await page.getByRole('button', { name: 'Adicionar' }).click()
  const originRow = page.getByTestId('task-row').filter({ hasText: 'Tarefa nascida em Esta Semana' })
  await expect(originRow).toBeVisible()

  await originRow.getByRole('button', { name: 'Mover tarefa' }).click()
  const dialog = page.getByRole('dialog', { name: 'Migrar Tarefa' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('tab', { name: 'Esta semana' }).click()

  const today = new Date()
  await dialog.getByRole('button', { name: new RegExp(`^${today.getDate()} de `) }).click()

  const migrateResponse = page.waitForResponse(
    (r) => r.url().includes('/migrate/') && r.request().method() === 'POST',
  )
  await dialog.getByRole('button', { name: 'Migrar' }).click()
  const response = await migrateResponse
  expect(response.status()).toBe(200)
  await expect(dialog).toHaveCount(0)

  // Destino == origem (mesma semana): a nova tarefa nasce com o MESMO título
  // na MESMA página — `originRow` passa a casar as duas linhas. `exact: true`
  // isola o botão de status (aria-label exato "Migrada") do chip de linhagem
  // da nova tarefa ("Migrada 1 vez", que também contém a substring "Migrada").
  await expect(originRow.getByLabel('Migrada', { exact: true })).toBeVisible()

  expect(consoleErrors).toEqual([])
})

test('move de Este Mês para Futuro (mês seguinte); aparece em Futuro (AC2, AC3)', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.getByRole('button', { name: 'Este Mês' }).click()
  await expect(page.getByLabel('Este Mês')).toBeVisible()
  await page.getByLabel('Título').fill('Tarefa a adiar no futuro')
  await page.getByRole('button', { name: 'Adicionar' }).click()
  const originRow = page.getByTestId('task-row').filter({ hasText: 'Tarefa a adiar no futuro' })
  await expect(originRow).toBeVisible()

  await originRow.getByRole('button', { name: 'Mover tarefa' }).click()
  const dialog = page.getByRole('dialog', { name: 'Migrar Tarefa' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('tab', { name: 'Futuro' }).click()
  await dialog.getByLabel('Mês').fill(nextMonthValue())

  const migrateResponse = page.waitForResponse(
    (r) => r.url().includes('/migrate/') && r.request().method() === 'POST',
  )
  await dialog.getByRole('button', { name: 'Migrar' }).click()
  const response = await migrateResponse
  expect(response.status()).toBe(200)
  await expect(dialog).toHaveCount(0)

  await expect(originRow.getByLabel('Adiada')).toBeVisible()

  await page.getByRole('button', { name: 'Futuro' }).click()
  await expect(
    page.getByTestId('task-row').filter({ hasText: 'Tarefa a adiar no futuro' }),
  ).toBeVisible()

  expect(consoleErrors).toEqual([])
})

test('move a partir do painel de detalhe fecha diálogo e painel (AC1)', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.getByLabel('Nova tarefa').fill('Tarefa via painel de detalhe')
  await syncAfter(page, () => page.getByRole('button', { name: 'Nova tarefa' }).click())

  await page.getByRole('button', { name: 'Ver detalhes de Tarefa via painel de detalhe' }).click()
  const panel = detailPanel(page)
  await expect(panel).toBeVisible()

  await panel.getByRole('button', { name: 'Mover tarefa' }).click()
  const dialog = page.getByRole('dialog', { name: 'Migrar Tarefa' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('tab', { name: 'Este mês' }).click()

  const today = new Date()
  await dialog.getByRole('button', { name: new RegExp(`^${today.getDate()} de `) }).click()

  const migrateResponse = page.waitForResponse(
    (r) => r.url().includes('/migrate/') && r.request().method() === 'POST',
  )
  await dialog.getByRole('button', { name: 'Migrar' }).click()
  const response = await migrateResponse
  expect(response.status()).toBe(200)

  await expect(dialog).toHaveCount(0)
  await expect(panel).not.toBeVisible()

  expect(consoleErrors).toEqual([])
})

test('tarefa completed tem o controle "Mover tarefa" desabilitado (AC1)', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.getByLabel('Nova tarefa').fill('Tarefa a concluir')
  await syncAfter(page, () => page.getByRole('button', { name: 'Nova tarefa' }).click())
  const row = page.getByTestId('task-row').filter({ hasText: 'Tarefa a concluir' })

  await syncAfter(page, () => row.getByRole('button', { name: 'Pendente' }).click())
  await syncAfter(page, () => row.getByRole('button', { name: 'Em andamento' }).click())
  await expect(row.getByRole('button', { name: 'Concluída' })).toBeVisible()

  await expect(row.getByRole('button', { name: 'Mover tarefa' })).toBeDisabled()

  expect(consoleErrors).toEqual([])
})

test('navegar de mês no calendário (aba Esta semana) e mover para um dia de outro mês deduz a semana correta (AC2, AC4)', async ({
  page,
}) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.getByLabel('Nova tarefa').fill('Tarefa para mês seguinte')
  await syncAfter(page, () => page.getByRole('button', { name: 'Nova tarefa' }).click())
  const originRow = page.getByTestId('task-row').filter({ hasText: 'Tarefa para mês seguinte' })
  await expect(originRow).toBeVisible()

  await originRow.getByRole('button', { name: 'Mover tarefa' }).click()
  const dialog = page.getByRole('dialog', { name: 'Migrar Tarefa' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('tab', { name: 'Esta semana' }).click()

  await dialog.getByRole('button', { name: 'Próximo mês' }).click()

  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 15)
  const expectedIso = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-15`

  await dialog.getByRole('button', { name: /^15 de / }).click()

  const migrateResponse = page.waitForResponse(
    (r) => r.url().includes('/migrate/') && r.request().method() === 'POST',
  )
  await dialog.getByRole('button', { name: 'Migrar' }).click()
  const response = await migrateResponse
  expect(response.status()).toBe(200)
  const requestPayload = response.request().postDataJSON()
  expect(requestPayload.scheduledDate).toBe(expectedIso)
  await expect(dialog).toHaveCount(0)

  await expect(originRow.getByLabel('Migrada')).toBeVisible()

  expect(consoleErrors).toEqual([])
})

test('mover para Hoje a partir de Esta Semana; aparece no Daily Log (AC1, AC5)', async ({ page }) => {
  test.setTimeout(60_000)
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.getByRole('button', { name: 'Esta Semana' }).click()
  await expect(page.getByLabel('Esta Semana')).toBeVisible()
  await page.getByLabel('Título').fill('Tarefa trazida para hoje')
  await page.getByRole('button', { name: 'Adicionar' }).click()
  const originRow = page.getByTestId('task-row').filter({ hasText: 'Tarefa trazida para hoje' })
  await expect(originRow).toBeVisible()

  await originRow.getByRole('button', { name: 'Mover tarefa' }).click()
  const dialog = page.getByRole('dialog', { name: 'Migrar Tarefa' })
  await expect(dialog).toBeVisible()
  // "Hoje" é a aba inicial — sem precisar clicar em nenhuma aba.
  await expect(dialog.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true')

  const migrateResponse = page.waitForResponse(
    (r) => r.url().includes('/migrate/') && r.request().method() === 'POST',
  )
  await dialog.getByRole('button', { name: 'Migrar' }).click()
  const response = await migrateResponse
  expect(response.status()).toBe(200)
  const requestPayload = response.request().postDataJSON()
  expect(requestPayload.destination).toBe('today')
  await expect(dialog).toHaveCount(0)

  await expect(originRow.getByLabel('Migrada')).toBeVisible()

  await page.getByRole('button', { name: 'Hoje' }).click()
  await expect(
    page.getByTestId('task-row').filter({ hasText: 'Tarefa trazida para hoje' }),
  ).toBeVisible()

  expect(consoleErrors).toEqual([])
})

test('mover para Esta semana sem escolher dia; aparece em "Sem dia definido" da semana corrente (AC1, AC5)', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.getByLabel('Nova tarefa').fill('Tarefa para semana sem data')
  await syncAfter(page, () => page.getByRole('button', { name: 'Nova tarefa' }).click())
  const originRow = page.getByTestId('task-row').filter({ hasText: 'Tarefa para semana sem data' })
  await expect(originRow).toBeVisible()

  await originRow.getByRole('button', { name: 'Mover tarefa' }).click()
  const dialog = page.getByRole('dialog', { name: 'Migrar Tarefa' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('tab', { name: 'Esta semana' }).click()

  const migrateResponse = page.waitForResponse(
    (r) => r.url().includes('/migrate/') && r.request().method() === 'POST',
  )
  await dialog.getByRole('button', { name: 'Migrar' }).click()
  const response = await migrateResponse
  expect(response.status()).toBe(200)
  const requestPayload = response.request().postDataJSON()
  expect(requestPayload.destination).toBe('week')
  expect(requestPayload.scheduledDate).toBeUndefined()
  await expect(dialog).toHaveCount(0)

  await expect(originRow.getByLabel('Migrada')).toBeVisible()

  await page.getByRole('button', { name: 'Esta Semana' }).click()
  // O rótulo "Sem dia definido" também aparece no combobox vazio do form de
  // adicionar tarefa (mesmo texto do MenuItem placeholder) — escopar ao
  // heading da seção evita a colisão (`strict mode violation`).
  await expect(page.locator('.MuiTypography-heading', { hasText: 'Sem dia definido' })).toBeVisible()
  await expect(
    page.getByTestId('task-row').filter({ hasText: 'Tarefa para semana sem data' }),
  ).toBeVisible()

  expect(consoleErrors).toEqual([])
})

test('mover para Este mês sem escolher dia; aparece no mês corrente sem dia (AC1, AC5 — depende do ajuste de backend da Task 1)', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.getByLabel('Nova tarefa').fill('Tarefa para mês sem data')
  await syncAfter(page, () => page.getByRole('button', { name: 'Nova tarefa' }).click())
  const originRow = page.getByTestId('task-row').filter({ hasText: 'Tarefa para mês sem data' })
  await expect(originRow).toBeVisible()

  await originRow.getByRole('button', { name: 'Mover tarefa' }).click()
  const dialog = page.getByRole('dialog', { name: 'Migrar Tarefa' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('tab', { name: 'Este mês' }).click()

  const migrateResponse = page.waitForResponse(
    (r) => r.url().includes('/migrate/') && r.request().method() === 'POST',
  )
  await dialog.getByRole('button', { name: 'Migrar' }).click()
  const response = await migrateResponse
  expect(response.status()).toBe(200)
  const requestPayload = response.request().postDataJSON()
  expect(requestPayload.destination).toBe('month')
  expect(requestPayload.scheduledDate).toBeUndefined()
  await expect(dialog).toHaveCount(0)

  await expect(originRow.getByLabel('Adiada')).toBeVisible()

  await page.getByRole('button', { name: 'Este Mês' }).click()
  await expect(
    page.getByTestId('task-row').filter({ hasText: 'Tarefa para mês sem data' }),
  ).toBeVisible()

  expect(consoleErrors).toEqual([])
})
