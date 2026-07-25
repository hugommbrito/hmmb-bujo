import { test, expect, detailPanel } from './fixtures'
import { seedClosedCycleScenario, seedWeeklyTaskWithLineage } from './seedClosedCycleScenario'

// Cobre a Story 11.5 (CRUD de tarefas em Esta Semana / Este Mês) ponta-a-ponta
// contra o backend real — sem mocks de rede. Complementa os testes unitários
// de serviço/view (backend) e de componente/página (frontend), que já cobrem
// as regras isoladamente; aqui valida-se o fluxo real: criar com/sem dia,
// editar via painel compartilhado, excluir (hard delete vs cancelar) e o
// guardrail de ciclo fechado tanto no backend (409 via network) quanto no
// frontend (formulários somem mesmo na rota corrente, não só no Arquivo).
//
// Atualizado na Story 14.5 (Weekly Board): "Esta Semana" trocou o formulário
// único + Select "Dia (opcional)" por CRIAÇÃO CONTEXTUAL — um formulário por
// painel (cada dia + o pool "Sem dia definido"), então `getByLabel('Título')`
// precisa ser escopado ao painel-alvo (nunca `page.getByLabel` puro). "Este
// Mês" é legado e intocado — mantém o formulário único, só ganhou o mesmo
// escopo por `main`/label da página para evitar colisão com o `Título *`
// oculto e portalizado do `BrainDumpCaptureSheet` (presente em toda rota
// desde a Story 13.3 — a causa real das falhas pré-existentes deste spec).
// O painel de detalhe da Semana também trocou: `TaskDetailCard` novo usa 2
// checkboxes reais para Eisenhower (Urgente/Importante), não mais um Select
// "Eisenhower" com opções — o painel do Mês (`TaskDetailPanel` legado)
// continua com o Select antigo.

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
  const main = page.getByRole('main', { name: 'Esta Semana' })
  await expect(main).toBeVisible()

  // Com dia: o painel da Segunda tem seu PRÓPRIO formulário — o dia nasce do
  // painel, não de um Select à parte.
  const mondayRegion = main.getByRole('region').filter({ hasText: 'abertas' }).first()
  const mondayHref = await mondayRegion.locator('a[href^="/daily/"]').getAttribute('href')
  const mondayDate = mondayHref?.replace('/daily/', '')
  expect(mondayDate).toBeTruthy()

  const postResponse = page.waitForResponse(
    (r) => r.url().includes('/api/bujo/logs/weekly/') && r.request().method() === 'POST',
  )
  await mondayRegion.getByLabel('Título').fill('Tarefa com dia')
  await mondayRegion.getByRole('button', { name: 'Adicionar' }).click()
  const postPayload = await (await postResponse).json()
  expect(postPayload.scheduledDate).toBe(mondayDate)
  await expect(page.getByTestId('task-row').filter({ hasText: 'Tarefa com dia' })).toBeVisible()

  // Sem dia: painel "Sem dia definido" (o pool).
  const pool = main.getByRole('region', { name: 'Sem dia definido' })
  const postResponse2 = page.waitForResponse(
    (r) => r.url().includes('/api/bujo/logs/weekly/') && r.request().method() === 'POST',
  )
  await pool.getByLabel('Título').fill('Tarefa sem dia')
  await pool.getByRole('button', { name: 'Adicionar' }).click()
  const postPayload2 = await (await postResponse2).json()
  expect(postPayload2.scheduledDate).toBeNull()
  await expect(pool.getByTestId('task-row').filter({ hasText: 'Tarefa sem dia' })).toBeVisible()

  // Título vazio não submete (no painel do pool).
  const rowCountBefore = await page.getByTestId('task-row').count()
  await pool.getByRole('button', { name: 'Adicionar' }).click()
  await expect(page.getByTestId('task-row')).toHaveCount(rowCountBefore)

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
  const main = page.getByLabel('Este Mês')
  await expect(main).toBeVisible()

  await main.getByLabel('Título').fill('Tarefa do mês')
  await main.getByRole('button', { name: 'Adicionar' }).click()

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
  const weeklyMain = page.getByRole('main', { name: 'Esta Semana' })
  const mondayRegion = weeklyMain.getByRole('region').filter({ hasText: 'abertas' }).first()
  await mondayRegion.getByLabel('Título').fill('Editar na semana')
  await mondayRegion.getByRole('button', { name: 'Adicionar' }).click()
  await expect(page.getByTestId('task-row').filter({ hasText: 'Editar na semana' })).toBeVisible()

  await page.getByRole('button', { name: 'Ver detalhes de Editar na semana' }).click()
  const weeklyPanel = detailPanel(page)
  await expect(weeklyPanel).toBeVisible()
  // Fluxo explícito (Story 11.7): preencher título + marcar Eisenhower e ENTÃO
  // "Salvar" — nem o campo nem o checkbox persistem sozinhos; só "Salvar"
  // dispara o PATCH e fecha o painel no sucesso. `TaskDetailCard` (Story 14.5)
  // usa 2 checkboxes reais (Urgente/Importante), não mais um Select.
  await weeklyPanel.getByLabel('Título').fill('Editada na semana')
  await weeklyPanel.getByRole('checkbox', { name: /Urgente/ }).check()
  await weeklyPanel.getByRole('button', { name: 'Salvar' }).click()
  await expect(weeklyPanel).not.toBeVisible()
  await expect(page.getByTestId('task-row').filter({ hasText: 'Editada na semana' })).toBeVisible()

  await page.getByRole('button', { name: 'Este Mês' }).click()
  const monthlyMain = page.getByLabel('Este Mês')
  await monthlyMain.getByLabel('Título').fill('Editar no mês')
  await monthlyMain.getByRole('button', { name: 'Adicionar' }).click()
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
  const main = page.getByRole('main', { name: 'Esta Semana' })
  const mondayRegion = main.getByRole('region').filter({ hasText: 'abertas' }).first()
  await mondayRegion.getByLabel('Título').fill('Tarefa a excluir')
  await mondayRegion.getByRole('button', { name: 'Adicionar' }).click()
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

  // "Excluir tarefa" (não "Cancelar tarefa" — Story 14.5 separou os dois
  // serviços): o servidor decide, no PRÓPRIO endpoint de DELETE, entre
  // hard-delete (204) e fallback para cancelamento via transição (200) —
  // é essa decisão do servidor que este teste prova, não o botão novo e
  // sempre-transição "Cancelar tarefa".
  await page.getByRole('button', { name: 'Ver detalhes de Tarefa com linhagem' }).click()
  const panel = detailPanel(page)
  const deleteButton = panel.getByRole('button', { name: 'Excluir tarefa' })
  await expect(deleteButton).toBeVisible()

  const deleteResponse = page.waitForResponse(
    (r) => r.url().includes('/api/bujo/tasks/') && r.request().method() === 'DELETE',
  )
  await deleteButton.click()
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
  const weeklyMain = page.getByRole('main', { name: 'Esta Semana' })
  await expect(weeklyMain).toBeVisible()
  // Fechado por CONTEÚDO (sem estado explícito AD-28) — nenhum badge de
  // status aparece; o readonly se prova pela AUSÊNCIA de formulário/reordenar,
  // não por um texto. "Ver detalhes" (Story 14.5) continua acessível — visão
  // permanece, só a escrita some (verificado abaixo, dentro do painel).
  await expect(weeklyMain.getByLabel('Título')).toHaveCount(0)
  await expect(weeklyMain.getByRole('button', { name: 'Reordenar tarefa' })).toHaveCount(0)

  const weeklyDetailButton = page.getByRole('button', {
    name: 'Ver detalhes de Tarefa concluída (fecha a semana)',
  })
  await expect(weeklyDetailButton).toBeVisible()
  await weeklyDetailButton.click()
  const weeklyPanel = detailPanel(page)
  await expect(weeklyPanel).toBeVisible()
  await expect(weeklyPanel.getByLabel('Título')).toBeDisabled()
  await expect(weeklyPanel.getByRole('button', { name: 'Salvar' })).toHaveCount(0)
  await weeklyPanel.getByRole('button', { name: 'Fechar' }).click()

  await page.getByRole('button', { name: 'Este Mês' }).click()
  await expect(page.getByLabel('Este Mês')).toBeVisible()
  await expect(page.getByText('Fechado')).toBeVisible()
  await expect(page.getByLabel('Adicionar tarefa ao mês')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Ver detalhes de Tarefa concluída (fecha o mês)' }),
  ).toHaveCount(0)

  expect(consoleErrors).toEqual([])
})
