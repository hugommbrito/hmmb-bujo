import type { Page } from '@playwright/test'

import { test, expect, syncAfter, detailPanel } from './fixtures'

// Cobre a Story 11.6 (mover/migrar tarefa de qualquer superfície), a Story
// 11.10 (seletor legado: 4 abas Hoje/Esta semana/Este mês/Futuro + confirmação
// explícita via botão "Migrar") e DW-27 (o "Mover tarefa" dos boards do sistema
// novo, pelo DETALHE da tarefa) ponta-a-ponta contra o backend real — sem mocks
// de rede. Complementa os testes unitários de serviço/view (backend) e de
// componente (TaskDestinationDialog/DestinationDialog/TaskRow/TaskDetailPanel,
// frontend): aqui valida-se o fluxo real nas 4 superfícies (Daily Log, Esta
// Semana, Este Mês, Futuro), pelos DOIS caminhos que existem hoje — o kebab do
// `TaskRow` legado (Daily Log e afins) e o detalhe do `TaskDetailCard` (boards).

function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** Segunda-feira da semana corrente ("AAAA-MM-DD") — espelho de
 * `core.calendar.week_start_of`, para conferir o `scheduledDate` do POST. */
function mondayIsoOfToday(): string {
  const now = new Date()
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
}

function nextMonthValue(): string {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
}

const MONTH_NAMES_PT_BR = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

/** "Agosto de 2026" — o rótulo do trilho do Future Log do sistema novo
 * (Story 14.7). Par de `nextMonthValue()`, que dá o mesmo mês em "AAAA-MM". */
function nextMonthTitle(): string {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return `${MONTH_NAMES_PT_BR[next.getMonth()]} de ${next.getFullYear()}`
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

// ─────────────────────────────────────────────────────────────────────────────
// Os 4 testes abaixo cobrem o caminho que DW-27 abriu nos boards do sistema
// novo: DETALHE DA TAREFA → "Mover tarefa" → seletor de destino
// (`DestinationDialog` com os destinos NOMEADOS da superfície). Até DW-27 esse
// botão existia com `onClick={undefined}` em `WeeklyBoardPage`/`MonthlyBoardPage`
// — clique morto silencioso —, e estes testes ficavam vermelhos de propósito,
// como registro executável da regressão. Agora eles provam o fluxo real.
//
// O caminho pelo KEBAB do `TaskRow` legado (usado pelos demais testes deste
// arquivo, que nascem no Daily Log) segue existindo e intocado: `TaskRowBase`
// não ganhou affordance de mover na LINHA — o caminho nos boards é o detalhe.
// ─────────────────────────────────────────────────────────────────────────────

/** Cria uma tarefa no pool "Sem dia definido" do board em foco e devolve a
 * linha dela. O pool é o mesmo `role="region"` nos dois boards. */
async function criarNoPool(page: Page, boardLabel: string, titulo: string) {
  const main = page.getByRole('main', { name: boardLabel })
  await expect(main).toBeVisible()
  const pool = main.getByRole('region', { name: 'Sem dia definido' })
  await pool.getByLabel('Título').fill(titulo)
  await pool.getByRole('button', { name: 'Adicionar' }).click()
  const row = page.getByTestId('task-row').filter({ hasText: titulo })
  await expect(row).toBeVisible()
  return row
}

/** Abre o detalhe da tarefa e, dele, o seletor de destino. O detalhe FECHA ao
 * abrir o seletor (dois modais empilhados disputariam foco e backdrop). */
async function abrirSeletorDeDestino(page: Page, titulo: string) {
  await page.getByRole('button', { name: `Ver detalhes de ${titulo}` }).click()
  const detalhe = page.getByRole('dialog', { name: 'Detalhe da tarefa' })
  await expect(detalhe).toBeVisible()
  await detalhe.getByRole('button', { name: 'Mover tarefa' }).click()
  await expect(detalhe).toHaveCount(0)
  const seletor = page.getByRole('dialog', { name: 'Escolher destino' })
  await expect(seletor).toBeVisible()
  return seletor
}

test('Weekly Board: detalhe → "Mover tarefa" → Este Mês com dia; origem vira Adiada (DW-27)', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.getByRole('button', { name: 'Esta Semana' }).click()
  const originRow = await criarNoPool(page, 'Esta Semana', 'Tarefa a adiar no mês')

  const dialog = await abrirSeletorDeDestino(page, 'Tarefa a adiar no mês')
  await dialog.getByRole('radio', { name: 'Este Mês' }).click()

  const today = new Date()
  await dialog.getByRole('button', { name: new RegExp(`^${today.getDate()} de `) }).click()

  const migrateResponse = page.waitForResponse(
    (r) => r.url().includes('/migrate/') && r.request().method() === 'POST',
  )
  await dialog.getByRole('button', { name: /^Mover para / }).click()
  const response = await migrateResponse
  expect(response.status()).toBe(200)
  const requestPayload = response.request().postDataJSON()
  expect(requestPayload.destination).toBe('month')
  expect(requestPayload.scheduledDate).toBe(todayIso())
  await expect(dialog).toHaveCount(0)

  await expect(originRow.getByLabel(/^Adiada/)).toBeVisible()

  await page.getByRole('button', { name: 'Este Mês' }).click()
  await expect(
    page.getByTestId('task-row').filter({ hasText: 'Tarefa a adiar no mês' }),
  ).toBeVisible()

  expect(consoleErrors).toEqual([])
})

test('Weekly Board: detalhe → "Mover tarefa" → Esta Semana num dia nomeado; origem vira Migrada (DW-27)', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.getByRole('button', { name: 'Esta Semana' }).click()
  await criarNoPool(page, 'Esta Semana', 'Tarefa nascida em Esta Semana')

  const dialog = await abrirSeletorDeDestino(page, 'Tarefa nascida em Esta Semana')
  await dialog.getByRole('radio', { name: 'Esta Semana' }).click()

  // O grupo de DIAS é um radiogroup próprio, distinto do de destinos — daí o
  // escopo. "1 …" é a segunda-feira da semana corrente (Story 14.5 AC5).
  const dias = dialog.getByRole('radiogroup', { name: /^Dias de/ })
  await dias.getByRole('radio', { name: /^1 / }).click()

  const migrateResponse = page.waitForResponse(
    (r) => r.url().includes('/migrate/') && r.request().method() === 'POST',
  )
  await dialog.getByRole('button', { name: /^Mover para / }).click()
  const response = await migrateResponse
  expect(response.status()).toBe(200)
  const requestPayload = response.request().postDataJSON()
  expect(requestPayload.destination).toBe('week')
  expect(requestPayload.scheduledDate).toBe(mondayIsoOfToday())
  await expect(dialog).toHaveCount(0)

  // Destino == origem (mesma semana): a nova tarefa nasce com o MESMO título na
  // MESMA página, então filtrar só por texto casa as DUAS linhas. O controle de
  // linhagem ("<Status> — ir para o sucessor") só existe na ORIGEM — filtrar a
  // `task-row` pelo título E por esse controle isola exatamente uma linha, sem
  // depender de ser a única migrada da semana (o que viraria violação de strict
  // mode assim que houvesse uma segunda).
  const origem = page
    .getByTestId('task-row')
    .filter({ hasText: 'Tarefa nascida em Esta Semana' })
    .filter({ has: page.getByRole('button', { name: /^Migrada — / }) })
  await expect(origem).toHaveCount(1)
  await expect(origem.getByRole('button', { name: /^Migrada — / })).toBeVisible()

  expect(consoleErrors).toEqual([])
})

test('Monthly Board: detalhe → "Mover tarefa" → Futuro (mês seguinte); aparece em Futuro (DW-27)', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.getByRole('button', { name: 'Este Mês' }).click()
  const originRow = await criarNoPool(page, 'Este Mês', 'Tarefa a adiar no futuro')

  const dialog = await abrirSeletorDeDestino(page, 'Tarefa a adiar no futuro')
  await dialog.getByRole('radio', { name: 'Futuro' }).click()
  await dialog.getByLabel('Mês').fill(nextMonthValue())
  await dialog.getByRole('button', { name: '0 Sem dia definido' }).click()

  const migrateResponse = page.waitForResponse(
    (r) => r.url().includes('/migrate/') && r.request().method() === 'POST',
  )
  await dialog.getByRole('button', { name: /^Mover sem dia definido/ }).click()
  const response = await migrateResponse
  expect(response.status()).toBe(200)
  const requestPayload = response.request().postDataJSON()
  expect(requestPayload.destination).toBe('future')
  expect(requestPayload.monthFirst).toBe(`${nextMonthValue()}-01`)
  await expect(dialog).toHaveCount(0)

  await expect(originRow.getByLabel(/^Adiada/)).toBeVisible()

  // `exact: true`: o título da tarefa contém "futuro", e o botão "Ver detalhes
  // de …" casaria por substring (match do Playwright é case-insensitive).
  await page.getByRole('button', { name: 'Futuro', exact: true }).click()
  // Story 14.7 (AC9): o Futuro virou trilho + coluna de foco. O destino aqui é o
  // MÊS SEGUINTE, que É o foco default (1º mês do horizonte) — o assert final
  // continua válido —, mas a seleção explícita no trilho tira a dependência
  // desse default: se o horizonte mudar de âncora, o teste falha por motivo
  // certo em vez de virar falso positivo/negativo silencioso.
  const trilhoDoFuturo = page.getByRole('navigation', { name: 'Meses do horizonte' })
  await trilhoDoFuturo.getByRole('button', { name: new RegExp(nextMonthTitle()) }).click()
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

test('Weekly Board: detalhe → "Mover tarefa" → Hoje; aparece no Daily Log (DW-27)', async ({ page }) => {
  test.setTimeout(60_000)
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.getByRole('button', { name: 'Esta Semana' }).click()
  const originRow = await criarNoPool(page, 'Esta Semana', 'Tarefa trazida para hoje')

  const dialog = await abrirSeletorDeDestino(page, 'Tarefa trazida para hoje')
  // "Hoje" é um destino SEM escolha de dia: confirmável de imediato (o servidor
  // é quem resolve o Daily Log de hoje).
  await dialog.getByRole('radio', { name: 'Hoje' }).click()

  const migrateResponse = page.waitForResponse(
    (r) => r.url().includes('/migrate/') && r.request().method() === 'POST',
  )
  await dialog.getByRole('button', { name: 'Mover para hoje' }).click()
  const response = await migrateResponse
  expect(response.status()).toBe(200)
  const requestPayload = response.request().postDataJSON()
  expect(requestPayload.destination).toBe('today')
  await expect(dialog).toHaveCount(0)

  await expect(originRow.getByLabel(/^Migrada/)).toBeVisible()

  // `exact: true`: o título da tarefa contém "hoje", e o botão "Ver detalhes de
  // …" casaria por substring (match do Playwright é case-insensitive).
  await page.getByRole('button', { name: 'Hoje', exact: true }).click()
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
  // O rótulo "Sem dia definido" também aparece no form de adicionar tarefa —
  // escopar à SEÇÃO evita a colisão (`strict mode violation`). O pool do Weekly
  // Board do sistema novo (Story 14.5) é um `role="region"` nomeado; o
  // `.MuiTypography-heading` do painel legado não existe mais nesta superfície.
  const pool = page.getByRole('main', { name: 'Esta Semana' }).getByRole('region', { name: 'Sem dia definido' })
  await expect(pool).toBeVisible()
  await expect(pool.getByTestId('task-row').filter({ hasText: 'Tarefa para semana sem data' })).toBeVisible()

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
