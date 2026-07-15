import { test, expect } from './fixtures'

// Cobre a Story 4.5 (Templates de tarefas recorrentes com placement manual)
// ponta-a-ponta contra o backend real, ATUALIZADO pela Story 11.2: a gestão
// de recorrentes saiu de Configurações e passou a viver no Planner
// ("Recorrentes"), com os templates segmentados em abas por grupo
// (Semanal/Mensal/Anual) e um filtro "mostrar inativos" (padrão: só ativos).
// O fluxo Recorrentes → placement → Weekly/Monthly Log continua sendo
// exercitado ponta-a-ponta contra o backend de verdade, provando a
// independência instância/template (AC3) real.

test('CRUD de templates em Recorrentes + placement filtra por grupo e chega ao Weekly/Monthly Log real (AC1, AC2)', async ({
  page,
}) => {
  test.setTimeout(120_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  // AC1: cria um template weekly e um monthly em Planner > Recorrentes
  // (tabela separada de `tasks`, sem ciclo de vida — provado indiretamente
  // pela listagem, já que não há status/log algum nesta tela).
  await page.getByRole('button', { name: 'Recorrentes' }).click()
  await expect(page.getByLabel('Recorrentes')).toBeVisible()

  // Aba "Semanal" é a default → o template nasce weekly (form segue a aba).
  const form = page.getByRole('form', { name: 'Novo template recorrente' })
  await form.getByLabel('Título').fill('Reunião semanal')
  await form.getByLabel('Recorrência (texto livre)').fill('toda segunda')
  await form.getByRole('button', { name: 'Criar' }).click()
  await expect(page.getByText('Semanal — toda segunda')).toBeVisible({ timeout: 10_000 })

  // Trocar para a aba "Mensal" → o próximo template nasce monthly (sem
  // <Select> de grupo, que foi removido em favor das abas).
  await page.getByRole('tab', { name: 'Mensal' }).click()
  await form.getByLabel('Título').fill('Pagar contas')
  await form.getByLabel('Recorrência (texto livre)').fill('todo dia 5')
  await form.getByRole('button', { name: 'Criar' }).click()
  await expect(page.getByText('Mensal — todo dia 5')).toBeVisible({ timeout: 10_000 })
  // Segmentação por aba: o weekly não aparece na aba Mensal.
  await expect(page.getByText(/Semanal — toda segunda/)).toHaveCount(0)

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
  // `active=true` do backend, Task 7.1) e também some da view de Recorrentes
  // (filtro client-side "mostrar inativos" desligado por padrão, Story 11.2),
  // mas continua existindo/editável — desativar não é o mesmo que apagar.
  await page.getByRole('button', { name: 'Recorrentes' }).click()
  await expect(page.getByLabel('Recorrentes')).toBeVisible()
  await page.getByRole('tab', { name: 'Mensal' }).click()
  await expect(page.getByText(/Mensal — todo dia 5/)).toBeVisible({ timeout: 10_000 })
  // Na aba Mensal só "Pagar contas" existe; escopar pela linha certa via
  // ancestral direto do título (`ancestor::div[2]`: Typography do título →
  // Box `flex:1` → Box da linha, mesma estrutura de `TemplateRow`), não pelo
  // texto isolado do botão.
  const pagarContasRow = page
    .getByText('Pagar contas', { exact: true })
    .locator('xpath=ancestor::div[2]')
  await pagarContasRow.getByRole('button', { name: 'Desativar' }).click()
  // Com "mostrar inativos" desligado, o template desativado some da view.
  await expect(page.getByText('Pagar contas', { exact: true })).toHaveCount(0, { timeout: 10_000 })
  // Ligar o Switch "Mostrar inativos" o traz de volta com o sufixo "(inativo)".
  await page.getByRole('checkbox', { name: 'Mostrar inativos' }).click()
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

  await page.getByRole('button', { name: 'Recorrentes' }).click()
  await expect(page.getByLabel('Recorrentes')).toBeVisible()

  // Aba "Semanal" default → Standup nasce weekly.
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
  await page.getByRole('button', { name: 'Recorrentes' }).click()
  await expect(page.getByLabel('Recorrentes')).toBeVisible()
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
