import { test, expect } from './fixtures'
import { seedArchiveScenario } from './seedArchiveScenario'

// Cobre a Story 4.6 (Fechamento de ciclos e Arquivo) ponta-a-ponta contra o
// backend real: um ciclo (semana/mês) só existe no Arquivo se TODAS as suas
// tarefas já tiverem disposição (FR-1.10) — não há affordance de UI para o
// cliente compor esse cenário no passado, por isso o seed via
// `seedArchiveScenario` (mesma técnica de `seedReviewScenario.ts`, 4.3).
//
// Complementa os testes unitários de `services/archive.py`
// (`is_container_closed`/`list_closed_cycles`, subárvore completa) e de
// `WeeklyPage`/`MonthlyPage`/`ArchivePage` (que simulam `closed`/`archive`
// isoladamente via mock): aqui valida-se o fluxo real — Arquivo lista os
// ciclos fechados, a navegação para cada um reaproveita `WeeklyPage`/
// `MonthlyPage` via rota parametrizada (Dev Notes "por que não existe
// endpoint de detalhe dedicado"), mostrando o indicador "Fechada"/"Fechado" e
// o estado final de cada tarefa, sem nenhuma affordance de escrita (form de
// criação, placement de recorrentes).

const MONTH_NAMES_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

function monthLabel(monthFirst: string): string {
  const month = Number(monthFirst.slice(5, 7))
  const year = monthFirst.slice(0, 4)
  const name = MONTH_NAMES_PT[month - 1]
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`
}

test('Arquivo vazio para usuário novo mostra o estado vazio (AC2)', async ({ page }) => {
  await page.getByRole('button', { name: 'Arquivo' }).click()
  await expect(page.getByLabel('Arquivo')).toBeVisible()
  await expect(page.getByText('Nenhuma semana ou mês fechado ainda.')).toBeVisible()
})

test('lista ciclos fechados e navega para semana/mês com estado final, sem affordance de escrita (AC1, AC2)', async ({
  page,
  email,
}) => {
  test.setTimeout(60_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  let templatesRequested = false
  page.on('request', (r) => {
    if (r.url().includes('/api/bujo/recurring-templates/')) templatesRequested = true
  })

  const { weekStart, monthFirst } = seedArchiveScenario(email, {
    closedWeekTasks: [
      { title: 'Preparar apresentação', status: 'completed' },
      { title: 'Ideia descartada', status: 'cancelled' },
      { title: 'Tarefa migrada para outro ciclo', status: 'migrated', migrationCount: 2 },
    ],
    closedMonthTasks: [{ title: 'Fechar orçamento do mês', status: 'completed' }],
  })

  await page.getByRole('button', { name: 'Arquivo' }).click()
  await expect(page.getByLabel('Arquivo')).toBeVisible()
  await expect(page.getByText('Nenhuma semana ou mês fechado ainda.')).toHaveCount(0)

  const weekLink = page.getByRole('link', { name: `Semana de ${weekStart}` })
  const monthLink = page.getByRole('link', { name: monthLabel(monthFirst) })
  await expect(weekLink).toBeVisible()
  await expect(monthLink).toBeVisible()

  // Semana fechada: indicador "Fechada", estado final das 3 tarefas
  // (concluída/cancelada/migrada) e nenhuma affordance de escrita — a
  // requisição de templates recorrentes (RecurringPlacementSection) nem
  // dispara, provando que a seção some por `isArchiveView`, não porque a
  // lista de templates está vazia.
  const weeklyLogResponse = page.waitForResponse(
    (r) => r.url().includes('/api/bujo/logs/weekly/') && r.request().method() === 'GET' && r.ok(),
  )
  await weekLink.click()
  const weeklyLogPayload = await (await weeklyLogResponse).json()

  await expect(page.getByLabel(`Arquivo — Semana de ${weekStart}`)).toBeVisible()
  await expect(page.getByText('Fechada')).toBeVisible()

  const completedRow = page.getByTestId('task-row').filter({ hasText: 'Preparar apresentação' })
  await expect(completedRow).toBeVisible()
  await expect(completedRow.getByLabel('Concluída')).toBeVisible()

  const cancelledRow = page.getByTestId('task-row').filter({ hasText: 'Ideia descartada' })
  await expect(cancelledRow).toBeVisible()
  await expect(cancelledRow.getByLabel('Cancelada')).toBeVisible()

  const migratedRow = page.getByTestId('task-row').filter({ hasText: 'Tarefa migrada para outro ciclo' })
  await expect(migratedRow).toBeVisible()
  await expect(migratedRow.getByLabel('Migrada')).toBeVisible()

  await expect(page.getByRole('button', { name: 'Definir placement' })).toHaveCount(0)
  expect(templatesRequested).toBe(false)

  // Linhagem de migração (AC #2: "o que foi feito com ela, incl. linhagem de
  // migração — migration_count") chega no contrato mesmo sem UI dedicada de
  // detalhe — a superfície de consulta é o payload servido a esta rota.
  const migratedTask = weeklyLogPayload.unscheduled.find(
    (task: { title: string }) => task.title === 'Tarefa migrada para outro ciclo',
  )
  expect(migratedTask.migrationCount).toBe(2)

  // Volta ao Arquivo e navega para o mês fechado.
  await page.getByRole('button', { name: 'Arquivo' }).click()
  await expect(page.getByLabel('Arquivo')).toBeVisible()
  await page.getByRole('link', { name: monthLabel(monthFirst) }).click()

  await expect(page.getByLabel(`Arquivo — Mês de ${monthFirst}`)).toBeVisible()
  await expect(page.getByText('Fechado')).toBeVisible()

  const monthCompletedRow = page.getByTestId('task-row').filter({ hasText: 'Fechar orçamento do mês' })
  await expect(monthCompletedRow).toBeVisible()
  await expect(monthCompletedRow.getByLabel('Concluída')).toBeVisible()

  await expect(page.getByLabel('Adicionar tarefa ao mês')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Definir placement' })).toHaveCount(0)

  expect(consoleErrors).toEqual([])
})
