import { test, expect } from './fixtures'
import { queryMigrationCount, seedCatchUpScenario } from './seedCatchUpScenario'

// Cobre a Story 4.4 (Catch-Up de dias pulados) ponta-a-ponta contra o backend
// real: a fila de Catch-Up só existe a partir de tarefas MAIS ANTIGAS que
// "ontem"/"semana anterior"/"mês anterior" (fora das janelas da 4.2/4.3) —
// sem affordance de UI para criar dados nesse passado, por isso o seed via
// `seedCatchUpScenario` (mesma técnica de `seedYesterdayQueue`/
// `seedReviewScenario`).
//
// Complementa os testes unitários de CatchUpBanner/CatchUpFlow/MigrationFlow
// (que simulam as 3 filas e a mutação isoladamente): aqui valida-se o fluxo
// real de ponta a ponta descrito na Task 10.4 da story — um único Dialog
// contínuo atravessando mês → semana → dia, sem sobreposição com os 3
// banners da 4.2/4.3, com `migration_count` == 1 ao final.

test('catch-up mês → semana → dia num único Dialog contínuo, sem sobreposição com os outros banners (AC1, AC2)', async ({
  page,
  email,
}) => {
  // Fluxo de 3 estágios contra Neon real — orçamento maior que o default de 30s.
  test.setTimeout(90_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  seedCatchUpScenario(email, {
    monthlyTasks: [{ title: 'Tarefa mensal antiga' }],
    weeklyTasks: [
      {
        title: 'Planejar retro antiga',
        children: [
          { title: 'Subtarefa concluída antiga', status: 'completed' },
          { title: 'Subtarefa pendente antiga' },
        ],
      },
    ],
    dailyTasks: [{ title: 'Tarefa diária antiga' }],
  })
  await page.reload()

  // Só o banner Catch-Up aparece — os outros 3 não têm pendência nas janelas
  // deles (nenhum dado seedado em "ontem"/"semana anterior"/"mês anterior").
  await expect(
    page.getByText('3 tarefas sem disposição de dias, semanas ou meses anteriores. Iniciar Catch-Up?'),
  ).toBeVisible()
  await expect(page.getByText(/tarefas pendentes de ontem/)).toHaveCount(0)
  await expect(page.getByText(/Semana anterior tem/)).toHaveCount(0)
  await expect(page.getByText(/Mês anterior tem/)).toHaveCount(0)

  await page.getByRole('button', { name: 'Iniciar Catch-Up' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  // Estágio 1: mês (flowType='monthly', 3 botões — sem "hoje/semana").
  await expect(dialog.getByText('Tarefa mensal antiga')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Migrar para hoje' })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Migrar para esta semana' })).toHaveCount(0)
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/migrate/') && r.request().method() === 'POST' && r.ok(),
    ),
    dialog.getByRole('button', { name: 'Cancelar' }).click(),
  ])

  // Mesmo Dialog, sem fechar — avança automaticamente para o estágio 2 (semana).
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Planejar retro antiga')).toBeVisible()
  await expect(dialog.getByText('Subtarefa pendente antiga')).toBeVisible()
  await expect(dialog.getByText('Subtarefa concluída antiga')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Migrar para esta semana' })).toBeVisible()
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/migrate/') && r.request().method() === 'POST' && r.ok(),
    ),
    dialog.getByRole('button', { name: 'Migrar para esta semana' }).click(),
  ])

  // Avança automaticamente para o estágio 3 (dia).
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Tarefa diária antiga')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Migrar para hoje' })).toBeVisible()
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/migrate/') && r.request().method() === 'POST' && r.ok(),
    ),
    dialog.getByRole('button', { name: 'Migrar para hoje' }).click(),
  ])

  // Todos os estágios esgotados: o Dialog fecha sozinho, o banner some.
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText(/sem disposição de dias, semanas ou meses anteriores/)).toHaveCount(0)

  // A tarefa do dia migrada aparece no Daily Log de hoje.
  await expect(
    page.getByTestId('task-row').filter({ hasText: 'Tarefa diária antiga' }),
  ).toBeVisible()

  // Reabrir a Daily Log: banner não reaparece (nenhuma decisão pendente restou).
  await page.reload()
  await expect(page.getByText(/sem disposição de dias, semanas ou meses anteriores/)).toHaveCount(0)

  // migration_count por DECISÃO, não por dia de calendário pulado (AC #1) —
  // a tarefa migrada de 10 dias atrás tem migration_count == 1, não 10.
  expect(queryMigrationCount(email, 'Tarefa diária antiga')).toBe(1)

  expect(consoleErrors).toEqual([])
})

// Gap identificado na geração de testes E2E (qa-generate-e2e-tests): o teste
// acima só exercita o caminho em que todos os 3 estágios são decididos em
// sequência — nunca prova que Esc PAUSA o Catch-Up inteiro (em vez de só
// avançar/pular o estágio corrente), nem que reabrir recalcula o estágio
// certo a partir da query ao vivo (sem reiniciar do mês, já vazio). Esse é o
// comportamento novo desta story (Dev Notes "Um Dialog contínuo..."), análogo
// ao teste "Esc pausa sem decidir" já existente em migration-flow.spec.ts
// (4.2) — aqui adaptado para a orquestração entre estágios do Catch-Up.
test('Esc pausa o Catch-Up inteiro (não avança estágio); reabrir retoma no estágio certo (AC1)', async ({
  page,
  email,
}) => {
  test.setTimeout(90_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  seedCatchUpScenario(email, {
    monthlyTasks: [{ title: 'Tarefa mensal pausada' }],
    weeklyTasks: [{ title: 'Tarefa semanal pausada' }],
    dailyTasks: [{ title: 'Tarefa diária pausada' }],
  })
  await page.reload()

  await expect(
    page.getByText('3 tarefas sem disposição de dias, semanas ou meses anteriores. Iniciar Catch-Up?'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Iniciar Catch-Up' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Tarefa mensal pausada')).toBeVisible()

  // Decide o estágio mensal — o Dialog avança sozinho para o semanal (mesmo
  // Dialog, sem fechar).
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/migrate/') && r.request().method() === 'POST' && r.ok(),
    ),
    dialog.getByRole('button', { name: 'Cancelar' }).click(),
  ])
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Tarefa semanal pausada')).toBeVisible()

  // Esc no estágio semanal: pausa o Catch-Up INTEIRO — não pula para o
  // diário, só fecha o Dialog no estágio em que estava.
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)

  // A tarefa mensal já foi decidida no servidor: a contagem cai para 2
  // (semanal + diária), nunca 3 de novo.
  await expect(
    page.getByText('2 tarefas sem disposição de dias, semanas ou meses anteriores. Iniciar Catch-Up?'),
  ).toBeVisible()

  await page.reload()
  await expect(
    page.getByText('2 tarefas sem disposição de dias, semanas ou meses anteriores. Iniciar Catch-Up?'),
  ).toBeVisible()

  // Reabrir recalcula os estágios a partir da query ao vivo: mês já vazio →
  // retoma direto no semanal, sem reiniciar do mês.
  await page.getByRole('button', { name: 'Iniciar Catch-Up' }).click()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Tarefa semanal pausada')).toBeVisible()
  await expect(dialog.getByText('Tarefa mensal pausada')).toHaveCount(0)

  expect(consoleErrors).toEqual([])
})
