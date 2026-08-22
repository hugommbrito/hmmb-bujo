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

// Story 14.7 (AC6/AC9): a superfície do Futuro passou a ser `FutureBoardPage`
// (M08). Três acoplamentos deste spec mudaram, e a TESE dele não:
//   (a) o botão do item agora diz "Alocar" (termo canônico do decision-log) —
//       a Story 14.8 fechou a padronização: o TÍTULO do dialog também virou
//       "Alocar" (era "Definir placement" até então), como dona da biblioteca;
//   (b) a seção é `role="region"` com nome próprio, então o container deixa de
//       ser um `xpath=..` frágil ao DOM;
//   (c) cada anual pendente virou um `listitem` — dois botões "Alocar"
//       idênticos precisam de um contorno por linha, e `locator('div')` seria
//       ambíguo (casa a linha E o próprio título);
//   (d) o Future Log novo é trilho + foco: os 8 meses do horizonte aparecem no
//       trilho O TEMPO TODO, então o heading do mês sozinho viraria FALSO
//       POSITIVO — o spec precisa SELECIONAR o mês no trilho antes de assertar
//       a Task Row (o placement cai 2 meses à frente, e o foco default é o 1º
//       mês do horizonte = mês corrente + 1).

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
  // "Agosto de 2026" — o rótulo do trilho/cabeçalho de foco do sistema novo
  // (o Future Log legado usava "Agosto 2026", sem o "de").
  const futureGroupHeading = `${MONTH_NAMES[futureDate.getMonth()]} de ${futureDate.getFullYear()}`

  // AC3 (estado inicial): usuário novo, sem templates — a seção não existe.
  await page.getByRole('button', { name: 'Futuro' }).click()
  await expect(page.getByLabel('Futuro')).toBeVisible()
  await expect(page.getByText(/Anuais pendentes de/)).toHaveCount(0)

  // Cria dois templates `annual` em Recorrentes (aba "Anual") — Story 14.8:
  // a criação passou do form legado (`RecurringTemplateManager`) para o card
  // de detalhe compartilhado (`TemplateDetailCard`), o mesmo card de
  // criar/editar. O Grupo herda a aba ativa (AC3), então com "Anual" já
  // selecionada não é preciso trocar o radio.
  await page.getByRole('button', { name: 'Recorrentes' }).click()
  await expect(page.getByLabel('Recorrentes')).toBeVisible()
  await page.getByRole('tab', { name: /Anual/ }).click()

  // `getByLabel('Título')`/`getByRole('dialog')` sem escopo casam também o
  // campo oculto do `BrainDumpCaptureSheet`, portalizado em toda rota desde a
  // Story 13.3 — escopar ao card evita o falso positivo/negativo.
  const card = page.getByRole('dialog', { name: 'Detalhe do template' })

  await page.getByRole('button', { name: 'Novo template', exact: true }).click()
  await expect(card).toBeVisible()
  await card.getByLabel('Título').fill('Revisão anual')
  await card.getByLabel('Recorrência', { exact: true }).fill('todo dezembro')
  await card.getByRole('button', { name: 'Criar' }).click()
  await expect(card).toHaveCount(0)
  await expect(page.getByText('Anual — todo dezembro')).toBeVisible({ timeout: 10_000 })

  await page.getByRole('button', { name: 'Novo template', exact: true }).click()
  await expect(card).toBeVisible()
  await card.getByLabel('Título').fill('Balanço anual')
  await card.getByLabel('Recorrência', { exact: true }).fill('todo janeiro')
  await card.getByRole('button', { name: 'Criar' }).click()
  await expect(card).toHaveCount(0)
  await expect(page.getByText('Anual — todo janeiro')).toBeVisible({ timeout: 10_000 })

  // AC1: os dois aparecem em "Anuais pendentes de [ano]" no Future Log.
  // Escopado ao container da seção (não a página inteira): depois do
  // placement o título colocado também passa a aparecer no grupo do mês
  // futuro do Future Log (mesmo texto, elemento diferente), então um
  // `getByText` sem escopo daria falso positivo/negativo nas asserções de
  // "sumiu da seção" mais abaixo.
  await page.getByRole('button', { name: 'Futuro' }).click()
  await expect(page.getByLabel('Futuro')).toBeVisible()
  const pendingAnnualSection = page.getByRole('region', {
    name: `Anuais pendentes de ${currentYear}`,
  })
  await expect(pendingAnnualSection).toBeVisible({ timeout: 10_000 })
  await expect(pendingAnnualSection.getByText('Revisão anual', { exact: true })).toBeVisible()
  await expect(pendingAnnualSection.getByText('Balanço anual', { exact: true })).toBeVisible()

  // Estado ANTES do placement: a linha do mês de destino existe no trilho e
  // está ZERADA. É a metade não-vacuosa do assert de contagem lá embaixo — sem
  // ela, "o mês aparece no trilho" seria sempre verdade (os 8 meses do
  // horizonte são scaffolding e estão lá o tempo todo, com item ou sem).
  const trilho = page.getByRole('navigation', { name: 'Meses do horizonte' })
  const linhaDoMesDestino = trilho.getByRole('button', { name: new RegExp(futureGroupHeading) })
  await expect(linhaDoMesDestino).toContainText('0 itens')

  // AC2: "Alocar" reusa o MESMO dialog/calendário da 11.3 — confirmar com uma
  // data preenchida (mês futuro).
  const revisaoRow = pendingAnnualSection
    .getByRole('listitem')
    .filter({ hasText: 'Revisão anual' })
  await revisaoRow.getByRole('button', { name: 'Alocar' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Alocar')).toBeVisible()
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

  // A instância colocada aparece no mês futuro correspondente — prova que a
  // invalidação do Future Log (agora POR PREFIXO, alcançando também o trilho —
  // Story 14.7, AC9) funciona. O placement cai 2 meses à frente, que NÃO é o
  // foco default: selecionar o mês no trilho é obrigatório, senão o assert
  // seria um falso positivo (os 8 meses estão sempre no trilho).
  // A CONTAGEM do trilho é o que prova a invalidação por prefixo: a linha do mês
  // aparecer não prova nada (ela nunca some), mas ela sair de "0 itens" para
  // "1 item" só acontece se `usePlaceRecurringTemplateMutation` alcançar
  // `keys.bujo.futureHorizon()` — que é exatamente a correção da AC9.
  await expect(linhaDoMesDestino).toContainText('1 item', { timeout: 10_000 })
  await linhaDoMesDestino.click()
  await expect(page.getByRole('heading', { name: futureGroupHeading, level: 2 })).toBeVisible()
  await expect(
    page.getByTestId('task-row').filter({ hasText: 'Revisão anual' }),
  ).toBeVisible({ timeout: 10_000 })

  // Coloca o segundo anual sem preencher data — cai no mês corrente.
  const balancoRow = pendingAnnualSection
    .getByRole('listitem')
    .filter({ hasText: 'Balanço anual' })
  await balancoRow.getByRole('button', { name: 'Alocar' }).click()
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
