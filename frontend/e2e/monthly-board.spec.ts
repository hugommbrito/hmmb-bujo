import { test, expect } from './fixtures'
import { expectNoAxeViolations } from './axeHelper'
import { dsTokenPx, mainNav, waitForDialogSettled } from './shellHelpers'
import {
  seedMonthlyBoardScenario,
  seedFinalizedMonthWithTasks,
  seedMonthlyBoardLineageScenario,
} from './seedMonthlyBoardScenario'

// Cobre o Monthly Board do sistema novo (Story 14.6, AC1/AC7/AC9) contra o
// backend REAL da branch Neon `e2e`. `/planner/month` é a SEGUNDA superfície
// interna migrada (`surfaceMigrated: true`) — o gate de acessibilidade aqui
// roda SEM `exclude: 'main'` (a exclusão da SHELL-DEBT-02 só vale para rotas
// ainda legadas).

test.describe('Monthly Board — wide 1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('composição aprovada: geometria por token, calendário completo, pool visível mesmo vazio, filtro global, criação contextual (AC1)', async ({
    page,
    email,
  }) => {
    test.setTimeout(60_000)
    const { dayWithTask } = seedMonthlyBoardScenario(email)

    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => consoleErrors.push(err.message))

    await page.getByRole('button', { name: 'Este Mês' }).click()
    await expect(page.getByRole('main', { name: 'Este Mês' })).toBeVisible()

    // Geometria vem de `--ds-monthly-board-*`, nunca de um número hardcoded
    // no spec — o teste lê o MESMO token que o componente usa (AC8).
    const gap = await dsTokenPx(page, '--ds-monthly-board-gap')
    const undatedWidth = await dsTokenPx(page, '--ds-monthly-board-undated-width')
    expect(gap).toBeGreaterThan(0)
    expect(undatedWidth).toBeGreaterThan(0)

    // O calendário completo: `role="grid"` com colunas SEG…DOM.
    const grid = page.getByRole('grid', { name: /todos os dias e tarefas do mês/ })
    await expect(grid).toBeVisible()
    await expect(page.getByRole('columnheader')).toHaveCount(7)

    // O pool "Sem dia definido" aparece SEMPRE, com 1 item neste cenário.
    const pool = page.getByRole('region', { name: 'Sem dia definido' })
    await expect(pool).toBeVisible()
    await expect(pool.getByText('Nenhuma tarefa.')).toHaveCount(0)

    // Filtro GLOBAL: "concluídas" some da célula do dia E não afeta o pool.
    await expect(page.getByText('Pendente no dia')).toBeVisible()
    await expect(page.getByText('Concluída no dia')).toBeVisible()
    await page.getByRole('button', { name: /concluídas/ }).click()
    await expect(page.getByText('Concluída no dia')).toBeVisible()
    await expect(page.getByText('Pendente no dia')).toHaveCount(0)
    await page.getByRole('button', { name: 'Limpar filtros' }).click()
    await expect(page.getByText('Pendente no dia')).toBeVisible()

    // Criação contextual pela célula do dia — não pelo formulário único legado.
    const dayCell = page.locator(`[data-date="${dayWithTask}"]`)
    await dayCell.getByLabel('Título').fill('Criada pela célula do dia')
    await dayCell.getByRole('button', { name: 'Adicionar' }).click()
    await expect(page.getByTestId('task-row').filter({ hasText: 'Criada pela célula do dia' })).toBeVisible()

    // Criação contextual pelo pool, escopada (não colide com a célula).
    await pool.getByLabel('Título').fill('Criada pelo pool')
    await pool.getByRole('button', { name: 'Adicionar' }).click()
    await expect(pool.getByTestId('task-row').filter({ hasText: 'Criada pelo pool' })).toBeVisible()

    expect(consoleErrors).toEqual([])
  })

  test('readonly em finalized: mutações ausentes do DOM, "Ver detalhes" continua acessível (AC3)', async ({
    page,
    email,
  }) => {
    seedFinalizedMonthWithTasks(email)

    await page.getByRole('button', { name: 'Este Mês' }).click()
    const main = page.getByRole('main', { name: 'Este Mês' })
    await expect(main).toBeVisible()
    // Navega 2 meses atrás, onde o seed finalizou o ciclo.
    await page.getByRole('button', { name: 'Mês anterior' }).click()
    await page.getByRole('button', { name: 'Mês anterior' }).click()

    await expect(page.getByText('Finalizada', { exact: true })).toBeVisible()
    await expect(page.getByText('Tarefa do mês finalizado')).toBeVisible()
    // Nenhum formulário de criação em NENHUMA célula/pool — mutações
    // ausentes do DOM, não `disabled` (o AC exige ausência real).
    await expect(main.getByLabel('Título')).toHaveCount(0)

    const pool = page.getByRole('region', { name: 'Sem dia definido' })
    await expect(pool).toBeVisible()
    await expect(pool.getByText('Nenhuma tarefa.')).toBeVisible()

    // A seta de linhagem sobrevive ao readonly (mesma matriz status×ciclo do
    // Weekly Board): continua CONTROLE (button) mesmo em mês finalizado.
    const lineageArrow = main.getByRole('button', { name: /Migrada — ir para o sucessor/ })
    await expect(lineageArrow).toBeVisible()
    await lineageArrow.click()
    await expect(
      page.getByRole('status').filter({ hasText: 'Veio de tarefa migrada — Sucessora no mês finalizado' }),
    ).toBeVisible()
    await expect(page.locator(':focus')).toContainText('Sucessora no mês finalizado')

    // Detalhe em readonly: campos desabilitados, rodapé de ações ausente.
    await main.getByRole('button', { name: 'Ver detalhes de Tarefa do mês finalizado' }).click()
    const detail = page.getByRole('dialog', { name: 'Detalhe da tarefa' })
    await expect(detail).toBeVisible()
    await expect(detail.getByLabel('Título')).toBeDisabled()
    await expect(detail.getByRole('button', { name: 'Salvar' })).toHaveCount(0)
    await expect(detail.getByRole('button', { name: 'Fechar' })).toBeVisible()
    await detail.getByRole('button', { name: 'Fechar' }).click()
  })

  test('axe sem exclude: main (segunda superfície migrada sem a exclusão da SHELL-DEBT-02)', async ({
    page,
    email,
  }) => {
    seedMonthlyBoardScenario(email)
    await page.getByRole('button', { name: 'Este Mês' }).click()
    await expect(page.getByRole('main', { name: 'Este Mês' })).toBeVisible()

    await expectNoAxeViolations(page, { label: 'wide · /planner/month' })
  })

  test('axe com o Detalhe da tarefa ABERTO (o dialog precisa de nome acessível — 4.1.2)', async ({
    page,
    email,
  }) => {
    seedMonthlyBoardScenario(email)
    await page.getByRole('button', { name: 'Este Mês' }).click()
    await expect(page.getByRole('main', { name: 'Este Mês' })).toBeVisible()

    await page.getByRole('button', { name: 'Ver detalhes de Pendente no dia' }).click()
    await expect(page.getByRole('dialog', { name: 'Detalhe da tarefa' })).toBeVisible()
    await waitForDialogSettled(page)

    await expectNoAxeViolations(page, { label: 'wide · /planner/month · Detalhe da tarefa aberto' })
  })

  test('reordenação relativa no pool: Mover acima/abaixo trocam irmãos do MESMO pool (Task 6)', async ({
    page,
    email,
  }) => {
    seedMonthlyBoardScenario(email)
    await page.getByRole('button', { name: 'Este Mês' }).click()
    await expect(page.getByRole('main', { name: 'Este Mês' })).toBeVisible()

    const pool = page.getByRole('region', { name: 'Sem dia definido' })
    await pool.getByLabel('Título').fill('Segundo item do pool')
    await pool.getByRole('button', { name: 'Adicionar' }).click()
    await expect(pool.getByTestId('task-row').filter({ hasText: 'Segundo item do pool' })).toBeVisible()

    await expect(pool.getByTestId('task-row')).toHaveText([/Sem dia definido/, /Segundo item do pool/])

    const firstRow = pool.getByTestId('task-row').filter({ hasText: 'Sem dia definido' })
    await firstRow.getByRole('button', { name: 'Reordenar tarefa' }).click()
    await page.getByRole('menuitem', { name: 'Mover abaixo' }).click()

    await expect(pool.getByTestId('task-row')).toHaveText([/Segundo item do pool/, /Sem dia definido/])
  })

  test('navegação de linhagem: a seta de origem migrada leva ao sucessor, com destaque e foco (AC2)', async ({
    page,
    email,
  }) => {
    seedMonthlyBoardLineageScenario(email)
    await page.getByRole('button', { name: 'Este Mês' }).click()
    const main = page.getByRole('main', { name: 'Este Mês' })
    await expect(main).toBeVisible()
    await expect(page.getByText('Origem da migração no mês')).toBeVisible()
    await expect(page.getByText('Sucessora da migração no mês')).toBeVisible()

    const lineageArrow = main.getByRole('button', { name: 'Migrada — ir para o sucessor' })
    await expect(lineageArrow).toHaveAttribute('aria-disabled', 'false')
    await lineageArrow.click()

    await expect(page.locator(':focus')).toContainText('Sucessora da migração no mês')
    await expect(
      page.getByRole('status').filter({ hasText: 'Veio de tarefa migrada — Sucessora da migração no mês' }),
    ).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('Detalhe da tarefa: categoria e Eisenhower persistem após Salvar (AC2)', async ({ page, email }) => {
    seedMonthlyBoardScenario(email)
    await page.getByRole('button', { name: 'Este Mês' }).click()
    await expect(page.getByRole('main', { name: 'Este Mês' })).toBeVisible()

    await page.getByRole('button', { name: 'Ver detalhes de Pendente no dia' }).click()
    const detail = page.getByRole('dialog', { name: 'Detalhe da tarefa' })
    await expect(detail).toBeVisible()

    await detail.getByRole('radio', { name: 'Categoria Teal' }).click()
    await expect(detail.getByRole('radio', { name: 'Categoria Teal' })).toHaveAttribute('aria-checked', 'true')
    await detail.getByRole('checkbox', { name: 'Urgente (U)' }).check()

    await Promise.all([
      page.waitForResponse(
        (res) => res.request().method() === 'GET' && /\/api\/bujo\/logs\/monthly\/(\?.*)?$/.test(res.url()),
      ),
      detail.getByRole('button', { name: 'Salvar' }).click(),
    ])
    await expect(detail).toHaveCount(0)

    await page.getByRole('button', { name: 'Ver detalhes de Pendente no dia' }).click()
    const reopened = page.getByRole('dialog', { name: 'Detalhe da tarefa' })
    await expect(reopened.getByRole('radio', { name: 'Categoria Teal' })).toHaveAttribute('aria-checked', 'true')
    await expect(reopened.getByRole('checkbox', { name: 'Urgente (U)' })).toBeChecked()
  })

  test('Detalhe da tarefa: Cancelar transiciona o status; Excluir remove a linha (AC2)', async ({
    page,
    email,
  }) => {
    const { dayWithTask } = seedMonthlyBoardScenario(email)
    await page.getByRole('button', { name: 'Este Mês' }).click()
    const main = page.getByRole('main', { name: 'Este Mês' })
    await expect(main).toBeVisible()

    await page.getByRole('button', { name: 'Ver detalhes de Pendente no dia' }).click()
    const detail = page.getByRole('dialog', { name: 'Detalhe da tarefa' })
    // Espera o refetch da transição responder — a LINHA lê `monthlyLog.data`
    // direto (sem estado próprio), então só reflete o novo status depois que
    // o cache invalidado voltar do backend (mesmo padrão de
    // `weekly-board.spec.ts`, molde direto — `TaskDetailCard` inalterado).
    await Promise.all([
      page.waitForResponse(
        (res) => res.request().method() === 'GET' && /\/api\/bujo\/logs\/monthly\/(\?.*)?$/.test(res.url()),
      ),
      detail.getByRole('button', { name: 'Cancelar tarefa' }).click(),
    ])
    await expect(detail).toHaveCount(0)

    const cancelledRow = page.getByTestId('task-row').filter({ hasText: 'Pendente no dia' })
    // Cancelada é conteúdo semântico (não controle): `role="img"`, não button.
    await expect(cancelledRow.getByRole('img', { name: 'Cancelada' })).toBeVisible()
    await expect(cancelledRow.getByRole('button', { name: 'Pendente', exact: true })).toHaveCount(0)

    // Cria uma tarefa nova (pending, sem linhagem) só para provar o hard
    // delete de verdade removendo a linha do DOM.
    const dayCell = page.locator(`[data-date="${dayWithTask}"]`)
    await dayCell.getByLabel('Título').fill('Tarefa descartável no mês')
    await dayCell.getByRole('button', { name: 'Adicionar' }).click()
    const disposableRow = page.getByTestId('task-row').filter({ hasText: 'Tarefa descartável no mês' })
    await expect(disposableRow).toBeVisible()

    await disposableRow.getByRole('button', { name: 'Ver detalhes de Tarefa descartável no mês' }).click()
    await page.getByRole('dialog', { name: 'Detalhe da tarefa' }).getByRole('button', { name: 'Excluir tarefa' }).click()
    await expect(page.getByRole('dialog', { name: 'Detalhe da tarefa' })).toHaveCount(0)
    await expect(disposableRow).toHaveCount(0)
  })
})

test.describe('Monthly Board — medium 1280×800', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('recomposição medium: pool lateral, calendário completo (AC1)', async ({ page, email }) => {
    seedMonthlyBoardScenario(email)
    await page.getByRole('button', { name: 'Este Mês' }).click()
    await expect(page.getByRole('main', { name: 'Este Mês' })).toBeVisible()

    await expect(page.getByRole('region', { name: 'Sem dia definido' })).toBeVisible()
    await expect(page.getByRole('grid', { name: /todos os dias e tarefas do mês/ })).toBeVisible()
    await expectNoAxeViolations(page, { label: 'medium · /planner/month' })
  })
})

test.describe('Monthly Board — tablet 800×720', () => {
  test.use({ viewport: { width: 800, height: 720 } })

  test('recomposição tablet: reusa o seletor de dia de compact — 7 colunas não cabem alvos de toque conformes (AC1/AC7)', async ({
    page,
    email,
  }) => {
    seedMonthlyBoardScenario(email)
    // Tablet inicia em RAIL de 64px colapsado (AC6/KB-03 do shell) — expandir
    // primeiro (mesmo padrão de `weekly-board.spec.ts`).
    await mainNav(page).getByRole('button', { name: 'Expandir sidebar' }).click()
    await page.getByRole('button', { name: 'Este Mês' }).click()
    await expect(page.getByRole('main', { name: 'Este Mês' })).toBeVisible()

    // Achado real do axe (`target-size`): a 768–1023px, 7 colunas não deixam
    // ≥24px para os alvos de `TaskRowBase` compact (componente compartilhado,
    // "não modificar") — o board cai para a mesma composição de compact
    // (seletor de dia + lista de um dia por vez) em vez da grade completa.
    await expect(page.getByRole('grid', { name: 'Selecionar dia do mês' })).toBeVisible()
    await expect(page.getByText('Sem dia definido')).toBeVisible()
    await expectNoAxeViolations(page, { label: 'tablet · /planner/month' })
  })
})

test.describe('Monthly Board — compact 390×720', () => {
  test.use({ viewport: { width: 390, height: 720 } })

  test('compact: seletor de dia (grid), lista completa de um dia por vez, sem scroll horizontal (AC1)', async ({
    page,
    email,
  }) => {
    const { dayWithTask } = seedMonthlyBoardScenario(email)
    await page.getByRole('button', { name: 'Este Mês' }).click()
    await expect(page.getByRole('main', { name: 'Este Mês' })).toBeVisible()

    const picker = page.getByRole('grid', { name: 'Selecionar dia do mês' })
    await expect(picker).toBeVisible()
    // Só UMA região de dia/pool por vez.
    await expect(page.getByRole('region')).toHaveCount(1)

    const day = Number(dayWithTask.slice(-2))
    await picker.getByRole('gridcell', { name: String(day), exact: true }).click()
    await expect(page.getByText('Pendente no dia')).toBeVisible()

    await page.getByRole('button', { name: 'Sem dia definido' }).click()
    await expect(page.getByRole('region', { name: 'Sem dia definido' })).toBeVisible()

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)

    await expectNoAxeViolations(page, { label: 'compact 390 · /planner/month' })
  })
})

test.describe('Monthly Board — reflow 320×720', () => {
  test.use({ viewport: { width: 320, height: 720 } })

  test('reflow em 320 CSS px sem scroll horizontal (AC7)', async ({ page, email }) => {
    seedMonthlyBoardScenario(email)
    await page.getByRole('button', { name: 'Este Mês' }).click()
    await expect(page.getByRole('main', { name: 'Este Mês' })).toBeVisible()

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)

    await expectNoAxeViolations(page, { label: 'reflow 320 · /planner/month' })
  })
})
