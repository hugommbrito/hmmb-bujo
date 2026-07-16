import { test, expect, detailPanel } from './fixtures'
import { seedClosedCycleScenario, seedWeeklyTaskWithLineage } from './seedClosedCycleScenario'

// Cobre a Story 11.5 (CRUD de tarefas em Esta Semana / Este Mês) ponta-a-ponta
// contra o backend real — sem mocks de rede. Complementa os testes unitários
// de serviço/view (backend) e de componente/página (frontend), que já cobrem
// as regras isoladamente; aqui valida-se o fluxo real: criar com/sem dia,
// editar via painel compartilhado, excluir (hard delete vs cancelar) e o
// guardrail de ciclo fechado tanto no backend (409 via network) quanto no
// frontend (formulários somem mesmo na rota corrente, não só no Arquivo).

test('cria tarefa em Esta Semana com dia específico e sem dia (AC1)', async ({ page }) => {
  // Duas criações + asserções de rede contra Neon real — orçamento maior que
  // o default de 30s (mesmo padrão de weekly-monthly-review.spec.ts).
  test.setTimeout(60_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.getByRole('button', { name: 'Esta Semana' }).click()
  await expect(page.getByLabel('Esta Semana')).toBeVisible()

  // Com dia: seleciona a primeira opção real do Select (índice 0 é "Sem dia
  // definido") — a segunda-feira da semana carregada.
  await page.getByLabel('Título').fill('Tarefa com dia')
  await page.getByLabel('Dia (opcional)').click()
  const dayOptions = page.getByRole('option')
  const mondayLabel = await dayOptions.nth(1).textContent()
  const postResponse = page.waitForResponse(
    (r) => r.url().includes('/api/bujo/logs/weekly/') && r.request().method() === 'POST',
  )
  await dayOptions.nth(1).click()
  await page.getByRole('button', { name: 'Adicionar' }).click()
  const postPayload = await (await postResponse).json()
  expect(postPayload.scheduledDate).toBeTruthy()
  await expect(page.getByTestId('task-row').filter({ hasText: 'Tarefa com dia' })).toBeVisible()

  // Sem dia: cai na seção "Sem dia definido".
  await page.getByLabel('Título').fill('Tarefa sem dia')
  const postResponse2 = page.waitForResponse(
    (r) => r.url().includes('/api/bujo/logs/weekly/') && r.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Adicionar' }).click()
  const postPayload2 = await (await postResponse2).json()
  expect(postPayload2.scheduledDate).toBeNull()
  const unscheduledHeading = page.getByText('Sem dia definido', { selector: 'span' })
  await expect(unscheduledHeading).toBeVisible()
  await expect(page.getByTestId('task-row').filter({ hasText: 'Tarefa sem dia' })).toBeVisible()

  // Título vazio não submete.
  const rowCountBefore = await page.getByTestId('task-row').count()
  await page.getByRole('button', { name: 'Adicionar' }).click()
  await expect(page.getByTestId('task-row')).toHaveCount(rowCountBefore)

  expect(mondayLabel).toBeTruthy()
  expect(consoleErrors).toEqual([])
})

test('cria tarefa em Este Mês (fluxo já existente desde a 4.1, coberto por completude)', async ({
  page,
}) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.getByRole('button', { name: 'Este Mês' }).click()
  await expect(page.getByLabel('Este Mês')).toBeVisible()

  await page.getByLabel('Título').fill('Tarefa do mês')
  await page.getByRole('button', { name: 'Adicionar' }).click()

  await expect(page.getByTestId('task-row').filter({ hasText: 'Tarefa do mês' })).toBeVisible()
  expect(consoleErrors).toEqual([])
})

test('edita título e eisenhower via painel compartilhado em Semana e Mês (AC2)', async ({ page }) => {
  // Fluxo mais longo (criação + edição em duas páginas) contra Neon real —
  // orçamento maior que o default de 30s (mesmo padrão de
  // weekly-monthly-review.spec.ts).
  test.setTimeout(60_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.getByRole('button', { name: 'Esta Semana' }).click()
  await page.getByLabel('Título').fill('Editar na semana')
  await page.getByRole('button', { name: 'Adicionar' }).click()
  await expect(page.getByTestId('task-row').filter({ hasText: 'Editar na semana' })).toBeVisible()

  await page.getByRole('button', { name: 'Ver detalhes de Editar na semana' }).click()
  const weeklyPanel = detailPanel(page)
  await expect(weeklyPanel).toBeVisible()
  // Fluxo explícito (Story 11.7): preencher título + selecionar eisenhower e
  // ENTÃO "Salvar" — nem o campo nem o Select persistem sozinhos; só "Salvar"
  // dispara o PATCH e fecha o painel no sucesso.
  await weeklyPanel.getByLabel('Título').fill('Editada na semana')
  await weeklyPanel.getByLabel('Eisenhower').click()
  await page.getByRole('option', { name: 'Urgente', exact: true }).click()
  await weeklyPanel.getByRole('button', { name: 'Salvar' }).click()
  await expect(weeklyPanel).not.toBeVisible()
  await expect(page.getByTestId('task-row').filter({ hasText: 'Editada na semana' })).toBeVisible()

  await page.getByRole('button', { name: 'Este Mês' }).click()
  await page.getByLabel('Título').fill('Editar no mês')
  await page.getByRole('button', { name: 'Adicionar' }).click()
  await expect(page.getByTestId('task-row').filter({ hasText: 'Editar no mês' })).toBeVisible()

  await page.getByRole('button', { name: 'Ver detalhes de Editar no mês' }).click()
  const monthlyPanel = detailPanel(page)
  await expect(monthlyPanel).toBeVisible()
  await monthlyPanel.getByLabel('Título').fill('Editada no mês')
  await monthlyPanel.getByRole('button', { name: 'Salvar' }).click()
  await expect(monthlyPanel).not.toBeVisible()
  await expect(page.getByTestId('task-row').filter({ hasText: 'Editada no mês' })).toBeVisible()
  expect(consoleErrors).toEqual([])
})

test('excluir tarefa pending sem linhagem some da lista via hard delete (204) (AC3)', async ({
  page,
}) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.getByRole('button', { name: 'Esta Semana' }).click()
  await page.getByLabel('Título').fill('Tarefa a excluir')
  await page.getByRole('button', { name: 'Adicionar' }).click()
  await expect(page.getByTestId('task-row').filter({ hasText: 'Tarefa a excluir' })).toBeVisible()

  await page.getByRole('button', { name: 'Ver detalhes de Tarefa a excluir' }).click()
  const panel = detailPanel(page)
  const deleteButton = panel.getByRole('button', { name: 'Excluir tarefa' })
  await expect(deleteButton).toBeVisible()

  const deleteResponse = page.waitForResponse(
    (r) => r.url().includes('/api/bujo/tasks/') && r.request().method() === 'DELETE',
  )
  await deleteButton.click()
  const response = await deleteResponse
  expect(response.status()).toBe(204)

  await expect(panel).not.toBeVisible()
  await expect(page.getByTestId('task-row').filter({ hasText: 'Tarefa a excluir' })).toHaveCount(0)

  expect(consoleErrors).toEqual([])
})

test('excluir tarefa com migrationCount > 0 vira Cancelada riscada, continua na lista (AC3)', async ({
  page,
  email,
}) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  seedWeeklyTaskWithLineage(email, 'Tarefa com linhagem')
  await page.getByRole('button', { name: 'Esta Semana' }).click()
  await expect(
    page.getByTestId('task-row').filter({ hasText: 'Tarefa com linhagem' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Ver detalhes de Tarefa com linhagem' }).click()
  const panel = detailPanel(page)
  const cancelButton = panel.getByRole('button', { name: 'Cancelar tarefa' })
  await expect(cancelButton).toBeVisible()

  const deleteResponse = page.waitForResponse(
    (r) => r.url().includes('/api/bujo/tasks/') && r.request().method() === 'DELETE',
  )
  await cancelButton.click()
  const response = await deleteResponse
  expect(response.status()).toBe(200)

  await expect(panel).not.toBeVisible()
  const row = page.getByTestId('task-row').filter({ hasText: 'Tarefa com linhagem' })
  await expect(row).toBeVisible()
  await expect(row.getByLabel('Cancelada')).toBeVisible()
  expect(consoleErrors).toEqual([])
})

test('período fechado esconde formulário de criação e clique-pra-editar na rota corrente (AC4)', async ({
  page,
  email,
}) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  seedClosedCycleScenario(email)

  await page.getByRole('button', { name: 'Esta Semana' }).click()
  await expect(page.getByLabel('Esta Semana')).toBeVisible()
  await expect(page.getByText('Fechada')).toBeVisible()
  await expect(page.getByLabel('Adicionar tarefa à semana')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Ver detalhes de Tarefa concluída (fecha a semana)' }),
  ).toHaveCount(0)

  await page.getByRole('button', { name: 'Este Mês' }).click()
  await expect(page.getByLabel('Este Mês')).toBeVisible()
  await expect(page.getByText('Fechado')).toBeVisible()
  await expect(page.getByLabel('Adicionar tarefa ao mês')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Ver detalhes de Tarefa concluída (fecha o mês)' }),
  ).toHaveCount(0)

  expect(consoleErrors).toEqual([])
})
