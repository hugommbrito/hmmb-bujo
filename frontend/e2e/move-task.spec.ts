import { test, expect, syncAfter, detailPanel } from './fixtures'

// Cobre a Story 11.6 (mover/migrar tarefa de qualquer superfície) ponta-a-ponta
// contra o backend real — sem mocks de rede. Complementa os testes unitários
// de serviço/view (backend) e de componente (TaskDestinationDialog/TaskRow/
// TaskDetailPanel, frontend): aqui valida-se o fluxo real do
// TaskDestinationDialog através do kebab do TaskRow e do painel de detalhe,
// nas 4 superfícies (Daily Log, Esta Semana, Este Mês, Futuro).

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
  const dialog = page.getByRole('dialog', { name: 'Mover tarefa' })
  await expect(dialog).toBeVisible()

  const today = new Date()
  const migrateResponse = page.waitForResponse(
    (r) => r.url().includes('/migrate/') && r.request().method() === 'POST',
  )
  await dialog.getByRole('button', { name: new RegExp(`^${today.getDate()} de `) }).click()
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

test('move de Esta Semana para Este Mês vira postponed; aparece em Este Mês (AC2, AC3)', async ({
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
  const dialog = page.getByRole('dialog', { name: 'Mover tarefa' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('tab', { name: 'Este mês' }).click()

  const migrateResponse = page.waitForResponse(
    (r) => r.url().includes('/migrate/') && r.request().method() === 'POST',
  )
  await dialog.getByLabel('Data no mês corrente').fill(todayIso())
  const response = await migrateResponse
  expect(response.status()).toBe(200)
  await expect(dialog).toHaveCount(0)

  await expect(originRow.getByLabel('Adiada')).toBeVisible()

  await page.getByRole('button', { name: 'Este Mês' }).click()
  await expect(
    page.getByTestId('task-row').filter({ hasText: 'Tarefa a adiar no mês' }),
  ).toBeVisible()

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
  const dialog = page.getByRole('dialog', { name: 'Mover tarefa' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('tab', { name: 'Futuro' }).click()

  const migrateResponse = page.waitForResponse(
    (r) => r.url().includes('/migrate/') && r.request().method() === 'POST',
  )
  await dialog.getByLabel('Mês').fill(nextMonthValue())
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
  const dialog = page.getByRole('dialog', { name: 'Mover tarefa' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('tab', { name: 'Este mês' }).click()

  const migrateResponse = page.waitForResponse(
    (r) => r.url().includes('/migrate/') && r.request().method() === 'POST',
  )
  await dialog.getByLabel('Data no mês corrente').fill(todayIso())
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

test('navegar de mês no calendário e mover para um dia de outro mês deduz a semana correta (AC2, AC4)', async ({
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
  const dialog = page.getByRole('dialog', { name: 'Mover tarefa' })
  await expect(dialog).toBeVisible()

  await dialog.getByRole('button', { name: 'Próximo mês' }).click()

  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 15)
  const expectedIso = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-15`

  const migrateResponse = page.waitForResponse(
    (r) => r.url().includes('/migrate/') && r.request().method() === 'POST',
  )
  await dialog.getByRole('button', { name: /^15 de / }).click()
  const response = await migrateResponse
  expect(response.status()).toBe(200)
  const requestPayload = response.request().postDataJSON()
  expect(requestPayload.scheduledDate).toBe(expectedIso)
  await expect(dialog).toHaveCount(0)

  await expect(originRow.getByLabel('Migrada')).toBeVisible()

  expect(consoleErrors).toEqual([])
})
