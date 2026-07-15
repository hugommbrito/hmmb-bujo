import { test, expect } from './fixtures'

// Cobre a Story 11.4 (Anuais pendentes consultáveis e colocáveis no Future
// Log) ponta-a-ponta contra o backend real: o Future Log passa a listar os
// templates `annual` ainda não colocados no ano corrente (AC1), reaproveitando
// 100% do fluxo de placement da Story 11.3 (AC2), sem estado vazio ruidoso
// quando não há nenhum anual pendente (AC3).

const MONTH_NAMES = [
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

test('Future Log lista anuais pendentes do ano, placement reusa o fluxo da 11.3 e some sem deixar estado vazio (AC1, AC2, AC3)', async ({
  page,
}) => {
  test.setTimeout(120_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  const now = new Date()
  const currentYear = now.getFullYear()

  // Data ~2 meses no futuro, garantindo que o mês caia num grupo distinto do
  // mês corrente (o Future Log só cobre meses futuros — `month_first__gt`).
  const futureDate = new Date(now.getFullYear(), now.getMonth() + 2, 15)
  const futureDateStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-15`
  const futureGroupHeading = `${MONTH_NAMES[futureDate.getMonth()]} ${futureDate.getFullYear()}`

  // AC3 (estado inicial): usuário novo, sem templates — a seção não existe.
  await page.getByRole('button', { name: 'Futuro' }).click()
  await expect(page.getByLabel('Futuro')).toBeVisible()
  await expect(page.getByText(/Anuais pendentes de/)).toHaveCount(0)

  // Cria dois templates `annual` em Recorrentes (aba "Anual").
  await page.getByRole('button', { name: 'Recorrentes' }).click()
  await expect(page.getByLabel('Recorrentes')).toBeVisible()
  await page.getByRole('tab', { name: 'Anual' }).click()

  const form = page.getByRole('form', { name: 'Novo template recorrente' })
  await form.getByLabel('Título').fill('Revisão anual')
  await form.getByLabel('Recorrência (texto livre)').fill('todo dezembro')
  await form.getByRole('button', { name: 'Criar' }).click()
  await expect(page.getByText('Anual — todo dezembro')).toBeVisible({ timeout: 10_000 })

  await form.getByLabel('Título').fill('Balanço anual')
  await form.getByLabel('Recorrência (texto livre)').fill('todo janeiro')
  await form.getByRole('button', { name: 'Criar' }).click()
  await expect(page.getByText('Anual — todo janeiro')).toBeVisible({ timeout: 10_000 })

  // AC1: os dois aparecem em "Anuais pendentes de [ano]" no Future Log.
  // Escopado ao container da seção (não a página inteira): depois do
  // placement o título colocado também passa a aparecer no grupo do mês
  // futuro do Future Log (mesmo texto, elemento diferente), então um
  // `getByText` sem escopo daria falso positivo/negativo nas asserções de
  // "sumiu da seção" mais abaixo.
  await page.getByRole('button', { name: 'Futuro' }).click()
  await expect(page.getByLabel('Futuro')).toBeVisible()
  const pendingAnnualSection = page
    .getByText(`Anuais pendentes de ${currentYear}`)
    .locator('xpath=..')
  await expect(pendingAnnualSection).toBeVisible({ timeout: 10_000 })
  await expect(pendingAnnualSection.getByText('Revisão anual', { exact: true })).toBeVisible()
  await expect(pendingAnnualSection.getByText('Balanço anual', { exact: true })).toBeVisible()

  // AC2: "Definir placement" reusa o dialog/calendário da 11.3 — confirmar
  // com uma data preenchida (mês futuro).
  const revisaoRow = pendingAnnualSection
    .getByText('Revisão anual', { exact: true })
    .locator('xpath=ancestor::div[1]')
  await revisaoRow.getByRole('button', { name: 'Definir placement' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Definir placement')).toBeVisible()
  await expect(dialog.getByText('Revisão anual', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Recorrência: todo dezembro')).toBeVisible()
  await expect(dialog.getByLabel('Data (opcional)')).toBeVisible()
  await page.waitForResponse(
    (r) => r.url().includes('/task-density/') && r.request().method() === 'GET' && r.ok(),
  )

  await dialog.getByLabel('Data (opcional)').fill(futureDateStr)
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/place/') && r.request().method() === 'POST' && r.ok(),
    ),
    dialog.getByRole('button', { name: 'Confirmar' }).click(),
  ])
  await expect(dialog).toHaveCount(0)

  // O item some da seção ao ser colocado (AC2), o outro anual permanece.
  // Escopado à seção: o título colocado também passa a existir no grupo do
  // mês futuro do Future Log (abaixo), então checar a página inteira daria
  // falso negativo aqui.
  await expect(
    pendingAnnualSection.getByText('Revisão anual', { exact: true }),
  ).toHaveCount(0, { timeout: 10_000 })
  await expect(pendingAnnualSection.getByText('Balanço anual', { exact: true })).toBeVisible()

  // A instância colocada aparece no grupo do mês futuro correspondente — prova
  // que a invalidação de `futureLog` (achado real desta story) funciona.
  await expect(page.getByText(futureGroupHeading)).toBeVisible({ timeout: 10_000 })
  await expect(
    page.getByTestId('task-row').filter({ hasText: 'Revisão anual' }),
  ).toBeVisible({ timeout: 10_000 })

  // Coloca o segundo anual sem preencher data — cai no mês corrente.
  const balancoRow = pendingAnnualSection
    .getByText('Balanço anual', { exact: true })
    .locator('xpath=ancestor::div[1]')
  await balancoRow.getByRole('button', { name: 'Definir placement' }).click()
  const secondDialog = page.getByRole('dialog')
  await expect(secondDialog.getByLabel('Data (opcional)')).toHaveValue('')
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/place/') && r.request().method() === 'POST' && r.ok(),
    ),
    secondDialog.getByRole('button', { name: 'Confirmar' }).click(),
  ])
  await expect(secondDialog).toHaveCount(0)

  // AC3: sem nenhum anual pendente, a seção inteira some (nem o heading fica).
  await expect(page.getByText(/Anuais pendentes de/)).toHaveCount(0, { timeout: 10_000 })

  // Placement sem data cai no mês corrente — visível em "Este Mês", não no
  // Future Log (que só cobre meses futuros).
  await page.getByRole('button', { name: 'Este Mês' }).click()
  await expect(page.getByLabel('Este Mês')).toBeVisible()
  await expect(
    page.getByTestId('task-row').filter({ hasText: 'Balanço anual' }),
  ).toBeVisible({ timeout: 10_000 })

  expect(consoleErrors).toEqual([])
})
