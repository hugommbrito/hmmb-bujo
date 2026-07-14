import { test, expect } from './fixtures'

// Cobre a Story 4.5 (Templates de tarefas recorrentes com placement manual)
// ponta-a-ponta contra o backend real. Diferente de 4.2/4.3/4.4, o dev-story
// desta story NÃO deixou um spec E2E permanente — a verificação manual da
// Task 13.3 usou um script Playwright temporário, criado e apagado na mesma
// sessão (ver Debug Log References / Completion Notes da própria story). É
// o gap real fechado por esta rodada de QA: até aqui, o fluxo Configurações
// > Recorrentes → placement → Weekly/Monthly Log só tinha sido exercitado
// via testes de componente com `useRecurringTemplatesQuery`/mutations
// mockadas (RecurringTemplateManager.test.tsx, RecurringPlacementSection.test.tsx)
// — nenhum teste cruzava páginas reais nem provava a independência
// instância/template (AC3) contra o backend de verdade.

test('CRUD de templates em Configurações + placement filtra por grupo e chega ao Weekly/Monthly Log real (AC1, AC2)', async ({
  page,
}) => {
  test.setTimeout(120_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  // AC1: cria um template weekly e um monthly em Configurações > Recorrentes
  // (tabela separada de `tasks`, sem ciclo de vida — provado indiretamente
  // pela listagem, já que não há status/log algum nesta tela).
  await page.getByRole('button', { name: 'Configurações' }).click()
  await expect(page.getByLabel('Configurações')).toBeVisible()

  const form = page.getByRole('form', { name: 'Novo template recorrente' })
  await form.getByLabel('Título').fill('Reunião semanal')
  await form.getByLabel('Recorrência (texto livre)').fill('toda segunda')
  await form.getByRole('button', { name: 'Criar' }).click()
  await expect(page.getByText('Semanal — toda segunda')).toBeVisible({ timeout: 10_000 })

  await form.getByLabel('Título').fill('Pagar contas')
  await form.getByLabel('Recorrência (texto livre)').fill('todo dia 5')
  await page.getByLabel('Grupo de recorrência').click()
  await page.getByRole('option', { name: 'Mensal' }).click()
  await form.getByRole('button', { name: 'Criar' }).click()
  await expect(page.getByText('Mensal — todo dia 5')).toBeVisible({ timeout: 10_000 })

  // AC2: na abertura da semana, só o template weekly ativo aparece — sem
  // auto-placement, o botão "Definir placement" é a única ação disponível.
  await page.getByRole('button', { name: 'Esta Semana' }).click()
  await expect(page.getByLabel('Esta Semana')).toBeVisible()
  await expect(page.getByText('Reunião semanal — Semanal')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/Pagar contas/)).toHaveCount(0)

  await page.getByRole('button', { name: 'Definir placement' }).click()
  const weekDialog = page.getByRole('dialog')
  await expect(weekDialog.getByText('Definir placement')).toBeVisible()
  await expect(weekDialog.getByLabel('Data (opcional)')).toBeVisible()
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/place/') && r.request().method() === 'POST' && r.ok(),
    ),
    weekDialog.getByRole('button', { name: 'Confirmar' }).click(),
  ])
  await expect(weekDialog).toHaveCount(0)

  // A instância colocada é uma Task de verdade (snapshot com linhagem) — cai
  // em "Sem dia definido" porque nenhuma data foi informada.
  await expect(
    page.getByTestId('task-row').filter({ hasText: 'Reunião semanal' }),
  ).toBeVisible({ timeout: 10_000 })

  // Abertura do mês: só o template monthly ativo aparece (mês corrente).
  await page.getByRole('button', { name: 'Este Mês' }).click()
  await expect(page.getByLabel('Este Mês')).toBeVisible()
  await expect(page.getByText('Pagar contas — Mensal')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/Reunião semanal/)).toHaveCount(0)

  await page.getByRole('button', { name: 'Definir placement' }).click()
  const monthDialog = page.getByRole('dialog')
  await expect(monthDialog.getByLabel('Dia (opcional)')).toBeVisible()
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/place/') && r.request().method() === 'POST' && r.ok(),
    ),
    monthDialog.getByRole('button', { name: 'Confirmar' }).click(),
  ])
  await expect(monthDialog).toHaveCount(0)
  await expect(
    page.getByTestId('task-row').filter({ hasText: 'Pagar contas' }),
  ).toBeVisible({ timeout: 10_000 })

  // Desativar o template mensal: some da seção de placement (o filtro
  // `active=true` do backend, Task 7.1), mas continua visível/editável em
  // Configurações — desativar não é o mesmo que apagar.
  await page.getByRole('button', { name: 'Configurações' }).click()
  await expect(page.getByLabel('Configurações')).toBeVisible()
  await expect(page.getByText(/Mensal — todo dia 5/)).toBeVisible({ timeout: 10_000 })
  // Duas linhas ativas coexistem ("Reunião semanal" e "Pagar contas"), cada
  // uma com seu próprio botão "Desativar" — escopar pela linha certa via
  // ancestral direto do título (`ancestor::div[2]`: Typography do título →
  // Box `flex:1` → Box da linha, mesma estrutura de `TemplateRow`), não pelo
  // texto isolado do botão.
  const pagarContasRow = page
    .getByText('Pagar contas', { exact: true })
    .locator('xpath=ancestor::div[2]')
  await pagarContasRow.getByRole('button', { name: 'Desativar' }).click()
  await expect(page.getByText(/Mensal — todo dia 5 \(inativo\)/)).toBeVisible({ timeout: 10_000 })

  await page.getByRole('button', { name: 'Este Mês' }).click()
  await expect(page.getByLabel('Este Mês')).toBeVisible()
  await expect(page.getByText(/Pagar contas — Mensal/)).toHaveCount(0, { timeout: 10_000 })
  // A instância já colocada antes da desativação não desaparece — desativar
  // um template não afeta placements já feitos.
  await expect(page.getByTestId('task-row').filter({ hasText: 'Pagar contas' })).toBeVisible()

  expect(consoleErrors).toEqual([])
})

test('AC3 — editar o template depois de um placement não muda a instância já colocada; colocar de novo usa os campos atualizados', async ({
  page,
}) => {
  test.setTimeout(120_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.getByRole('button', { name: 'Configurações' }).click()
  await expect(page.getByLabel('Configurações')).toBeVisible()

  const form = page.getByRole('form', { name: 'Novo template recorrente' })
  await form.getByLabel('Título').fill('Standup')
  await form.getByLabel('Recorrência (texto livre)').fill('toda manhã')
  await form.getByRole('button', { name: 'Criar' }).click()
  await expect(page.getByText('Semanal — toda manhã')).toBeVisible({ timeout: 10_000 })

  // Primeiro placement, antes de qualquer edição no template.
  await page.getByRole('button', { name: 'Esta Semana' }).click()
  await expect(page.getByLabel('Esta Semana')).toBeVisible()
  await expect(page.getByText('Standup — Semanal')).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Definir placement' }).click()
  const firstDialog = page.getByRole('dialog')
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/place/') && r.request().method() === 'POST' && r.ok(),
    ),
    firstDialog.getByRole('button', { name: 'Confirmar' }).click(),
  ])
  await expect(firstDialog).toHaveCount(0)
  await expect(
    page.getByTestId('task-row').filter({ hasText: 'Standup' }),
  ).toBeVisible({ timeout: 10_000 })

  // Edita o template DEPOIS do placement — muda só o título.
  await page.getByRole('button', { name: 'Configurações' }).click()
  await expect(page.getByLabel('Configurações')).toBeVisible()
  await page.getByRole('button', { name: 'Editar' }).click()
  // A linha da lista renderiza antes do form de criação no DOM — o primeiro
  // campo "Título" é o da linha em edição (mesma técnica documentada no
  // Debug Log da própria story para WeeklyPage/MonthlyPage).
  await page.getByLabel('Título').first().fill('Standup (renomeado)')
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/recurring-templates/') && r.request().method() === 'PATCH' && r.ok(),
    ),
    page.getByRole('button', { name: 'Salvar' }).click(),
  ])
  await expect(page.getByText(/Standup \(renomeado\)/)).toBeVisible({ timeout: 10_000 })

  // AC3, primeira metade: a Task já colocada NÃO muda de título.
  await page.getByRole('button', { name: 'Esta Semana' }).click()
  await expect(page.getByLabel('Esta Semana')).toBeVisible()
  await expect(page.getByTestId('task-row').filter({ hasText: 'Standup' })).toBeVisible({
    timeout: 10_000,
  })
  await expect(
    page.getByTestId('task-row').filter({ hasText: 'Standup (renomeado)' }),
  ).toHaveCount(0)

  // AC3, segunda metade: a seção de placement já reflete o template
  // atualizado, e colocar de novo usa os campos novos.
  await expect(page.getByText('Standup (renomeado) — Semanal')).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Definir placement' }).click()
  const secondDialog = page.getByRole('dialog')
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/place/') && r.request().method() === 'POST' && r.ok(),
    ),
    secondDialog.getByRole('button', { name: 'Confirmar' }).click(),
  ])
  await expect(secondDialog).toHaveCount(0)

  // As duas instâncias coexistem: a antiga (congelada) e a nova (com o
  // título atualizado) — prova direta de que a Task nunca relê o template.
  await expect(
    page.getByTestId('task-row').filter({ hasText: 'Standup (renomeado)' }),
  ).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('task-row').filter({ hasText: 'Standup' })).toHaveCount(2)

  expect(consoleErrors).toEqual([])
})
