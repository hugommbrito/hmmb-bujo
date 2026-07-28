import { test, expect } from './fixtures'
import { seedArchiveScenario } from './seedArchiveScenario'

// Cobre a Story 4.6 (Fechamento de ciclos e Arquivo) ponta-a-ponta contra o
// backend real: um ciclo (semana/mês) só existe no Arquivo se TODAS as suas
// tarefas já tiverem disposição (FR-1.10) — não há affordance de UI para o
// cliente compor esse cenário no passado, por isso o seed via
// `seedArchiveScenario` (mesma técnica de `seedReviewScenario.ts`, 4.3).
//
// Story 14.10 reescreveu a UI (abas Semanal/Mensal + filtro de data + detalhe
// via `ArchiveWeeklyDetailPage`/`ArchiveMonthlyDetailPage`, reaproveitando
// `TaskRowBase`/`TaskDetailCard`) — os seletores abaixo foram atualizados para
// a UI nova, mas a TESE permanece: Arquivo lista os ciclos fechados, mostra o
// estado final de cada tarefa e NENHUMA affordance de escrita (sem "Alocar",
// sem requisição de templates, `migrationCount` chega no payload).

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
  await expect(page.getByRole('main', { name: 'Arquivo' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Semanal', selected: true })).toBeVisible()
  await expect(page.getByText('Nenhuma semana finalizada ainda.')).toBeVisible()

  await page.getByRole('tab', { name: 'Mensal' }).click()
  await expect(page.getByText('Nenhum mês finalizado ainda.')).toBeVisible()
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
  await expect(page.getByRole('main', { name: 'Arquivo' })).toBeVisible()
  await expect(page.getByText('Nenhuma semana finalizada ainda.')).toHaveCount(0)

  const weekLink = page.getByRole('link', { name: `Semana de ${weekStart}` })
  await expect(weekLink).toBeVisible()

  // Semana fechada: indicador "Fechada"/"Somente leitura", estado final das 3
  // tarefas (concluída/cancelada/migrada) e nenhuma affordance de escrita — a
  // requisição de templates recorrentes nem dispara, e o form de criação some.
  const weeklyLogResponse = page.waitForResponse(
    (r) => r.url().includes('/api/bujo/logs/weekly/') && r.request().method() === 'GET' && r.ok(),
  )
  await weekLink.click()
  const weeklyLogPayload = await (await weeklyLogResponse).json()

  await expect(page.getByLabel(`Arquivo — Semana de ${weekStart}`)).toBeVisible()
  await expect(page.getByText('Fechada')).toBeVisible()
  await expect(page.getByText('Somente leitura')).toBeVisible()
  await expect(page.getByLabel('Adicionar tarefa à semana')).toHaveCount(0)

  const completedRow = page.getByTestId('task-row').filter({ hasText: 'Preparar apresentação' })
  await expect(completedRow).toBeVisible()
  // Readonly (High-1 do review de acessibilidade): status terminal vira
  // conteúdo semântico `role="img"`, não um botão focável mudo.
  await expect(completedRow.getByRole('img', { name: 'Concluída' })).toBeVisible()
  await expect(completedRow.getByRole('button', { name: 'Concluída' })).toHaveCount(0)

  const cancelledRow = page.getByTestId('task-row').filter({ hasText: 'Ideia descartada' })
  await expect(cancelledRow).toBeVisible()
  await expect(cancelledRow.getByRole('img', { name: 'Cancelada' })).toBeVisible()

  const migratedRow = page.getByTestId('task-row').filter({ hasText: 'Tarefa migrada para outro ciclo' })
  await expect(migratedRow).toBeVisible()
  // A seta de linhagem continua um controle de NAVEGAÇÃO (não de mutação) mesmo
  // em semana fechada — sem sucessor conhecido nesta seed, fica anunciada como
  // indisponível, nunca oculta.
  await expect(migratedRow.getByRole('button', { name: /Migrada/ })).toBeVisible()

  await expect(page.getByRole('button', { name: 'Alocar' })).toHaveCount(0)
  expect(templatesRequested).toBe(false)

  // Linhagem de migração (AC #2: "o que foi feito com ela, incl. linhagem de
  // migração — migration_count") chega no contrato mesmo sem UI dedicada de
  // detalhe — a superfície de consulta é o payload servido a esta rota.
  const migratedTask = weeklyLogPayload.unscheduled.find(
    (task: { title: string }) => task.title === 'Tarefa migrada para outro ciclo',
  )
  expect(migratedTask.migrationCount).toBe(2)

  // Volta ao Arquivo (aba Semanal continua selecionada) e troca para Mensal.
  await page.getByRole('link', { name: 'Voltar ao Arquivo' }).click()
  await expect(page.getByRole('main', { name: 'Arquivo' })).toBeVisible()
  await page.getByRole('tab', { name: 'Mensal' }).click()
  await page.getByRole('link', { name: monthLabel(monthFirst) }).click()

  await expect(page.getByLabel(`Arquivo — Mês de ${monthFirst}`)).toBeVisible()
  await expect(page.getByText('Fechado')).toBeVisible()
  await expect(page.getByText('Somente leitura')).toBeVisible()

  const monthCompletedRow = page.getByTestId('task-row').filter({ hasText: 'Fechar orçamento do mês' })
  await expect(monthCompletedRow).toBeVisible()
  await expect(monthCompletedRow.getByRole('img', { name: 'Concluída' })).toBeVisible()

  await expect(page.getByLabel('Adicionar tarefa ao mês')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Alocar' })).toHaveCount(0)

  expect(consoleErrors).toEqual([])
})
