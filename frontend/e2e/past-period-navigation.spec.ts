import { test, expect, detailPanel } from './fixtures'
import { seedArchiveScenario } from './seedArchiveScenario'
import { seedPastDailyTask } from './seedPastDailyTask'

// Cobre a Story 11.11 (navegar e agir em logs passados não-fechados)
// ponta-a-ponta contra o backend real — sem mocks de rede. Complementa os
// testes unitários de página/componente (WeeklyPage/MonthlyPage/DayHeader/
// DailyPage, que simulam `closed`/período via mock): aqui valida-se o fluxo
// real de navegação anterior/próximo, o drill-down para o Daily Log de um
// dia passado e o guardrail de somente-leitura num período fechado — tudo
// através dos controles de UI desta story, não via URL direta.
//
// Atualizado na Story 14.5 (Weekly Board): "Semana anterior"/"Próxima
// semana" e "Voltar para hoje" viraram BOTÕES (não mais links) — o stepper
// bidirecional novo não esconde "Próxima semana" na semana corrente, e não
// existe mais o aviso textual "Você está vendo uma semana passada."; a
// presença do botão "Voltar para hoje" (renderizado só quando a semana
// carregada NÃO é a corrente) é o indicador equivalente. Locators de
// `getByLabel('Título')` são escopados ao `main`/painel do dia — sem isso,
// resolveriam para o `Título *` oculto e portalizado do
// `BrainDumpCaptureSheet`, presente em toda rota desde a Story 13.3.

test('semana anterior aberta permanece acionável: indicador informativo, formulário funciona, botão volta ao presente (AC1, AC3, AC5)', async ({
  page,
}) => {
  test.setTimeout(60_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.getByRole('button', { name: 'Esta Semana' }).click()
  const main = page.getByRole('main', { name: 'Esta Semana' })
  await expect(main).toBeVisible()
  await expect(page.getByRole('button', { name: 'Voltar para hoje' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Semana anterior' }).click()
  await page.getByRole('button', { name: 'Semana anterior' }).click()

  const backButton = page.getByRole('button', { name: 'Voltar para hoje' })
  await expect(backButton).toBeVisible()

  // Período aberto (sem seed — semana passada intocada nunca fecha sozinha):
  // formulário funciona normalmente (AC3). Escopado ao painel do dia (região
  // "abertas") — o mesmo padrão de weekly-board.spec.ts.
  const mondayRegion = main.getByRole('region').filter({ hasText: 'abertas' }).first()
  await mondayRegion.getByLabel('Título').fill('Tarefa em semana passada aberta')
  await mondayRegion.getByRole('button', { name: 'Adicionar' }).click()
  const row = page.getByTestId('task-row').filter({ hasText: 'Tarefa em semana passada aberta' })
  await expect(row).toBeVisible()

  // "Mover tarefa" (Story 11.10) vive no TaskDetailCard (Story 14.5) — não mais
  // inline na linha — mas já funciona a partir de qualquer superfície por
  // construção; confirma aqui (Task 10.1), não reimplementa o seletor.
  await page.getByRole('button', { name: 'Ver detalhes de Tarefa em semana passada aberta' }).click()
  const panel = detailPanel(page)
  await expect(panel).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Mover tarefa' })).toBeEnabled()
  await panel.getByRole('button', { name: 'Fechar' }).click()
  await expect(panel).not.toBeVisible()

  await backButton.click()
  await expect(main).toBeVisible()
  await expect(page.getByRole('button', { name: 'Voltar para hoje' })).toHaveCount(0)

  expect(consoleErrors).toEqual([])
})

test('semana passada fechada (seed) permanece somente-leitura ao chegar via navegação anterior, idêntico ao Arquivo (AC4)', async ({
  page,
  email,
}) => {
  test.setTimeout(60_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  seedArchiveScenario(email, {
    closedWeekTasks: [{ title: 'Tarefa concluída (fecha a semana passada)', status: 'completed' }],
    closedMonthTasks: [],
  })

  await page.getByRole('button', { name: 'Esta Semana' }).click()
  const main = page.getByRole('main', { name: 'Esta Semana' })
  await expect(main).toBeVisible()

  // `seedArchiveScenario` fecha a semana de 2 semanas atrás — 2 cliques em
  // "Semana anterior" chegam nela pela navegação real, não por URL direta.
  // Este cenário fecha por CONTEÚDO (`closed: true`), sem passar pelo estado
  // explícito da AD-28 — o readonly precisa valer nos dois casos.
  await page.getByRole('button', { name: 'Semana anterior' }).click()
  await page.getByRole('button', { name: 'Semana anterior' }).click()

  await expect(page.getByRole('button', { name: 'Voltar para hoje' })).toBeVisible()
  await expect(main.getByLabel('Título')).toHaveCount(0)
  await expect(main.getByRole('button', { name: 'Reordenar tarefa' })).toHaveCount(0)

  expect(consoleErrors).toEqual([])
})

test('clicar num dia passado dentro de Esta Semana abre o Daily Log daquele dia; tarefa existente é acionável; "Voltar para hoje" funciona (AC2, AC3)', async ({
  page,
  email,
}) => {
  test.setTimeout(60_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  // Um Daily Log de verdade (container `log`, não `weekly_log`) só existe
  // hoje para um dia passado via seed direto — a UI não tem affordance para
  // criar uma tarefa num Daily Log arbitrário (Task 1.2/6.5). A segunda-feira
  // da semana anterior cai exatamente na semana alcançada por 1 clique em
  // "Semana anterior".
  const { logDate } = seedPastDailyTask(email, 1, 'Tarefa em dia passado')

  await page.getByRole('button', { name: 'Esta Semana' }).click()
  await expect(page.getByRole('main', { name: 'Esta Semana' })).toBeVisible()
  await page.getByRole('button', { name: 'Semana anterior' }).click()

  // A tarefa vive num container `Log` (Daily), não `WeeklyLog` — não aparece
  // agrupada na grade de Esta Semana (Dev Notes "por que a rota do Daily Log
  // passado é nova"); o link do cabeçalho do dia existe independente de haver
  // tarefas do weekly_log naquele dia. Localiza pelo `href` real (Task 8.1),
  // não pelo texto formatado — evita acoplar o teste ao formato de exibição.
  await page.locator(`a[href="/daily/${logDate}"]`).click()

  await expect(page).toHaveURL(`/daily/${logDate}`)
  await expect(page.getByLabel(`Daily Log de ${logDate}`)).toBeVisible()
  await expect(page.getByTestId('task-row').filter({ hasText: 'Tarefa em dia passado' })).toBeVisible()
  await expect(page.getByLabel('Nova tarefa')).toHaveCount(0)

  const dayRow = page.getByTestId('task-row').filter({ hasText: 'Tarefa em dia passado' })
  const transitionResponse = page.waitForResponse(
    (r) => r.url().includes('/transition/') && r.request().method() === 'POST',
  )
  await dayRow.getByRole('button', { name: 'Pendente' }).click()
  const response = await transitionResponse
  expect(response.status()).toBe(200)
  await expect(dayRow.getByLabel('Em andamento')).toBeVisible()

  await page.getByRole('link', { name: 'Voltar para hoje' }).click()
  await expect(page.getByLabel('Hoje')).toBeVisible()

  expect(consoleErrors).toEqual([])
})
