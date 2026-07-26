import { test, expect } from './fixtures'
import { seedReviewScenario } from './seedReviewScenario'

// Cobre a Story 4.3 (Revisão semanal/mensal e pull automático do Future Log)
// ponta-a-ponta contra o backend real: as filas de revisão semanal/mensal só
// existem a partir de Weekly/Monthly Log ANTERIORES, e o "pull do Future Log"
// só é observável com uma tarefa já residente no Monthly Log CORRENTE sem
// `scheduledDate` — nenhuma dessas situações tem affordance de UI para o
// cliente criar diretamente, por isso o seed via `seedReviewScenario`
// (mesma técnica de `seedYesterdayQueue.ts`, 4.2).
//
// Complementa os testes unitários de WeeklyReviewBanner/MonthlyReviewBanner/
// MigrationCard(flowType)/MonthlyPage (que simulam fila e mutação
// isoladamente): aqui valida-se o fluxo real de ponta a ponta descrito na
// Task 10.4 da story.

test('revisão semanal + mensal + pull do Future Log, ponta a ponta (AC1, AC2)', async ({
  page,
  email,
}) => {
  // Fluxo mais longo que os outros specs (2 revisões + navegação de página +
  // confirmação de data) contra Neon real — orçamento maior que o default de 30s.
  test.setTimeout(90_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  seedReviewScenario(email, {
    previousWeekTasks: [
      {
        title: 'Planejar sprint',
        children: [
          { title: 'Subtarefa concluída', status: 'completed' },
          { title: 'Subtarefa pendente' },
        ],
      },
    ],
    previousMonthTasks: [{ title: 'Revisar orçamento' }],
    currentMonthTasksWithoutDate: [{ title: 'Item do Future Log' }],
  })
  await page.reload()

  // Os dois banners de revisão aparecem com as contagens certas (só raízes).
  await expect(
    page.getByText('Semana anterior tem 1 tarefas sem disposição. Revisar?'),
  ).toBeVisible()
  await expect(
    page.getByText('Mês anterior tem 1 tarefas sem disposição. Revisar mês anterior?'),
  ).toBeVisible()

  // Revisão semanal: migra o pai para "esta semana" (atalho "1" = flowType
  // weekly) — filho concluído fica na origem, só o pendente viaja (AD-08
  // item 11, coberto pelos testes de serviço; aqui valida-se só o fluxo de UI).
  await page.getByRole('button', { name: 'Iniciar revisão' }).click()
  const weeklyDialog = page.getByRole('dialog')
  await expect(weeklyDialog.getByText('Planejar sprint')).toBeVisible()
  await expect(weeklyDialog.getByRole('button', { name: 'Migrar para esta semana' })).toBeVisible()
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/migrate/') && r.request().method() === 'POST' && r.ok(),
    ),
    page.keyboard.press('1'),
  ])
  await expect(weeklyDialog).toHaveCount(0)
  await expect(
    page.getByText('Semana anterior tem 1 tarefas sem disposição. Revisar?'),
  ).toHaveCount(0)

  // A tarefa migrada precisa aparecer de fato na Weekly Log CORRENTE (destino
  // "week" do dispatcher de migrate_task, Task 1.1) — sem data agendada, cai
  // na seção "Sem dia definido" de `WeeklyPage`. Só o pai + filho pendente
  // viajam (o filho concluído fica na semana de origem, não visível aqui).
  await page.getByRole('button', { name: 'Esta Semana' }).click()
  await expect(page.getByLabel('Esta Semana')).toBeVisible()
  await expect(
    page.getByTestId('task-row').filter({ hasText: 'Planejar sprint' }),
  ).toBeVisible({ timeout: 10_000 })
  // `TaskRowBase` (Weekly Board, Story 14.5) renderiza subtarefas ANINHADAS
  // dentro do próprio nó da tarefa-pai com o MESMO `data-testid="task-row"` —
  // sem excluir o pai, o filtro por texto casa os DOIS nós (o pai também
  // contém "Subtarefa pendente" no texto agregado dos filhos), violando o
  // strict mode. Achado real verificado em execução (pré-existente desde a
  // 14.5, exposto agora por esta suíte de regressão).
  await expect(
    page
      .getByTestId('task-row')
      .filter({ hasText: 'Subtarefa pendente' })
      .filter({ hasNotText: 'Planejar sprint' }),
  ).toBeVisible()
  await expect(
    page.getByTestId('task-row').filter({ hasText: 'Subtarefa concluída' }),
  ).toHaveCount(0)

  await page.getByRole('button', { name: 'Hoje' }).click()
  await expect(page.getByLabel('Hoje')).toBeVisible()

  // Revisão mensal: decide a tarefa solta com "migrar com data" (flowType
  // monthly — sem botão "hoje/semana", 3 botões reais).
  await page.getByRole('button', { name: 'Revisar mês anterior' }).click()
  const monthlyDialog = page.getByRole('dialog')
  await expect(monthlyDialog.getByText('Revisar orçamento')).toBeVisible()
  await expect(
    monthlyDialog.getByRole('button', { name: 'Migrar para hoje' }),
  ).toHaveCount(0)

  const monthNameButton = monthlyDialog.getByRole('button', { name: /^Definir data em /i })
  await monthNameButton.click()
  const monthDateInput = monthlyDialog.getByLabel('Data no mês corrente')
  await expect(monthDateInput).toBeVisible()

  const today = new Date()
  const chosenDay = today.getDate() <= 20 ? today.getDate() + 5 : today.getDate() - 5
  const chosenDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(chosenDay).padStart(2, '0')}`
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/migrate/') && r.request().method() === 'POST' && r.ok(),
    ),
    monthDateInput.fill(chosenDate),
  ])

  await expect(monthlyDialog).toHaveCount(0)
  await expect(
    page.getByText('Mês anterior tem 1 tarefas sem disposição. Revisar mês anterior?'),
  ).toHaveCount(0)

  // Monthly Board novo (Story 14.6): itens do Future Log aparecem na própria
  // célula/pool como qualquer outra tarefa — sem a seção dedicada "Itens do
  // Future Log para [Mês]" nem o campo "Confirmar data" inline, ambos
  // contrato exclusivo do `MonthlyPage` legado (que não existe mais nesta
  // rota). O item sem data cai no pool "Sem dia definido"; a tarefa recém-
  // migrada COM data cai na própria célula do dia. Confirmar data para um
  // item do Future Log passa a ser decisão do RITUAL mensal (fonte "Future
  // Log", ver `monthly-planning-ritual.spec.ts`), não mais um campo inline
  // na grade. Navegação via clique na Sidebar (não `page.goto`) — evita um
  // reload completo da SPA/reautenticação.
  await page.getByRole('button', { name: 'Este Mês' }).click()
  const monthlyMain = page.getByRole('main', { name: 'Este Mês' })
  await expect(monthlyMain).toBeVisible()
  await expect(page.getByText(/^Itens do Future Log para /)).toHaveCount(0)
  await expect(page.getByLabel('Confirmar data')).toHaveCount(0)

  const monthlyPool = monthlyMain.getByRole('region', { name: 'Sem dia definido' })
  await expect(
    monthlyPool.getByTestId('task-row').filter({ hasText: 'Item do Future Log' }),
  ).toBeVisible()
  // A tarefa recém-migrada com data já aparece na própria célula do dia.
  await expect(page.getByTestId('task-row').filter({ hasText: 'Revisar orçamento' })).toBeVisible()

  // Reabrir a Daily Log: nenhum dos banners resolvidos reaparece.
  await page.getByRole('button', { name: 'Hoje' }).click()
  await expect(page.getByLabel('Hoje')).toBeVisible()
  await expect(page.getByText(/Semana anterior tem/)).toHaveCount(0)
  await expect(page.getByText(/Mês anterior tem/)).toHaveCount(0)

  expect(consoleErrors).toEqual([])
})
