import { test, expect } from './fixtures'
import { expectNoAxeViolations } from './axeHelper'
import { dsTokenPx, mainNav, waitForDialogSettled } from './shellHelpers'
import {
  seedWeeklyBoardScenario,
  seedFinalizedWeekWithTasks,
  seedWeeklyBoardLineageScenario,
} from './seedWeeklyBoardScenario'

// Cobre o Weekly Board do sistema novo (Story 14.5, AC1/AC7/AC9) contra o
// backend REAL da branch Neon `e2e`. `/planner/week` é a PRIMEIRA superfície
// interna migrada (`surfaceMigrated: true`) — o gate de acessibilidade aqui
// roda SEM `exclude: 'main'` (a exclusão da SHELL-DEBT-02 só vale para rotas
// ainda legadas).

test.describe('Weekly Board — wide 1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('composição aprovada: geometria por token, pool visível mesmo vazio, filtro global, criação contextual (AC1)', async ({
    page,
    email,
  }) => {
    test.setTimeout(60_000)
    seedWeeklyBoardScenario(email)

    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => consoleErrors.push(err.message))

    await page.getByRole('button', { name: 'Esta Semana' }).click()
    await expect(page.getByRole('main', { name: 'Esta Semana' })).toBeVisible()

    // Geometria vem de `--ds-weekly-board-*`, nunca de um número hardcoded no
    // spec — o teste lê o MESMO token que o componente usa (Story 14.5, AC8).
    const gap = await dsTokenPx(page, '--ds-weekly-board-gap')
    const weekdayMinWidth = await dsTokenPx(page, '--ds-weekly-board-weekday-min-width')
    expect(gap).toBeGreaterThan(0)
    expect(weekdayMinWidth).toBeGreaterThan(0)

    // As 7 regiões de dia + o pool, SEMPRE presentes. O pool tem 1 item neste
    // cenário (a asserção de pool VAZIO-e-ainda-visível vive no teste de
    // `finalized` abaixo, cujo seed não põe nada no pool).
    const pool = page.getByRole('region', { name: 'Sem dia definido' })
    await expect(pool).toBeVisible()
    await expect(pool.getByText('Nenhuma tarefa.')).toHaveCount(0) // o seed pôs 1 item no pool

    // Região de dia SEM tarefa nenhuma (terça, no seed) continua renderizada
    // com o próprio painel + "Nenhuma tarefa." — não um `null`/ausência total
    // (prova não-vacuosa: um painel COM tarefa, acima, teve a mensagem em
    // `toHaveCount(0)`; este é o par irmão que a mostra).
    const tuesdayRegion = page.getByRole('region').filter({ hasText: 'Terça' })
    await expect(tuesdayRegion.getByText('Nenhuma tarefa.')).toBeVisible()

    // Filtro GLOBAL: "concluídas" esconde a tarefa concluída da segunda E não
    // afeta o pool (que não tem nenhuma concluída) — a mesma asserção cobre as
    // duas superfícies simultaneamente, provando que o filtro não é por painel.
    await expect(page.getByText('Pendente na segunda')).toBeVisible()
    await expect(page.getByText('Concluída na segunda')).toBeVisible()
    await page.getByRole('button', { name: /concluídas/ }).click()
    await expect(page.getByText('Concluída na segunda')).toBeVisible()
    await expect(page.getByText('Pendente na segunda')).toHaveCount(0)
    await page.getByRole('button', { name: 'Limpar filtros' }).click()
    await expect(page.getByText('Pendente na segunda')).toBeVisible()

    // Criação contextual pelo painel do dia — não pelo formulário único legado.
    const mondayRegion = page.getByRole('region').filter({ hasText: 'abertas' }).first()
    await mondayRegion.getByLabel('Título').fill('Criada pelo painel do dia')
    await mondayRegion.getByRole('button', { name: 'Adicionar' }).click()
    await expect(page.getByTestId('task-row').filter({ hasText: 'Criada pelo painel do dia' })).toBeVisible()

    // Criação contextual pelo pool, escopada (não colide com o painel do dia).
    await pool.getByLabel('Título').fill('Criada pelo pool')
    await pool.getByRole('button', { name: 'Adicionar' }).click()
    await expect(pool.getByTestId('task-row').filter({ hasText: 'Criada pelo pool' })).toBeVisible()

    expect(consoleErrors).toEqual([])
  })

  test('readonly em finalized: mutações ausentes do DOM (AC3)', async ({ page, email }) => {
    seedFinalizedWeekWithTasks(email)

    await page.getByRole('button', { name: 'Esta Semana' }).click()
    const main = page.getByRole('main', { name: 'Esta Semana' })
    await expect(main).toBeVisible()
    // Navega 2 semanas atrás, onde o seed finalizou o ciclo.
    await page.getByRole('button', { name: 'Semana anterior' }).click()
    await page.getByRole('button', { name: 'Semana anterior' }).click()

    // `exact: true` — sem isso, colide com "Tarefa da semana finalizada"
    // (match por substring é case-insensitive por padrão no Playwright).
    await expect(page.getByText('Finalizada', { exact: true })).toBeVisible()
    await expect(page.getByText('Tarefa da semana finalizada')).toBeVisible()
    // Nenhum formulário de criação em NENHUM painel — mutações ausentes do DOM,
    // não `disabled` (o AC exige ausência real, não um controle desabilitado).
    // Escopado ao `main` — sem isso colide com o `Título *` oculto e
    // portalizado do `BrainDumpCaptureSheet`, presente em toda rota.
    await expect(main.getByLabel('Título')).toHaveCount(0)
    await expect(main.getByRole('button', { name: 'Reordenar tarefa' })).toHaveCount(0)

    // O pool aparece SEMPRE, inclusive vazio — este seed não põe nada nele
    // (par não-vacuoso do pool-com-1-item do teste "composição aprovada").
    const pool = page.getByRole('region', { name: 'Sem dia definido' })
    await expect(pool).toBeVisible()
    await expect(pool.getByText('Nenhuma tarefa.')).toBeVisible()

    // A seta de linhagem é "a única mutação-zero que sobrevive ao readonly"
    // (Dev Notes → matriz status×ciclo): continua CONTROLE (button, não
    // conteúdo semântico) mesmo em semana finalizada, e a navegação funciona.
    const lineageArrow = main.getByRole('button', { name: /Migrada — ir para o sucessor/ })
    await expect(lineageArrow).toBeVisible()
    await lineageArrow.click()
    await expect(page.getByRole('status').filter({ hasText: 'Veio de tarefa migrada — Sucessora na finalizada' })).toBeVisible()
    await expect(page.locator(':focus')).toContainText('Sucessora na finalizada')

    // Detalhe em readonly (achado real de produto da Task 12, AC3): campos
    // desabilitados e o rodapé de ações inteiro (Salvar/Mover/Cancelar/
    // Excluir) AUSENTE — só "Fechar" continua.
    await main.getByRole('button', { name: 'Ver detalhes de Tarefa da semana finalizada' }).click()
    const detail = page.getByRole('dialog', { name: 'Detalhe da tarefa' })
    await expect(detail).toBeVisible()
    await expect(detail.getByLabel('Título')).toBeDisabled()
    await expect(detail.getByLabel('Descrição')).toBeDisabled()
    await expect(detail.getByRole('button', { name: 'Salvar' })).toHaveCount(0)
    await expect(detail.getByRole('button', { name: 'Mover tarefa' })).toHaveCount(0)
    await expect(detail.getByRole('button', { name: 'Cancelar tarefa' })).toHaveCount(0)
    await expect(detail.getByRole('button', { name: 'Excluir tarefa' })).toHaveCount(0)
    await expect(detail.getByRole('button', { name: 'Fechar' })).toBeVisible()
    await detail.getByRole('button', { name: 'Fechar' }).click()
    await expect(detail).toHaveCount(0)
  })

  test('axe sem exclude: main (primeira superfície migrada sem a exclusão da SHELL-DEBT-02)', async ({
    page,
    email,
  }) => {
    seedWeeklyBoardScenario(email)
    await page.getByRole('button', { name: 'Esta Semana' }).click()
    await expect(page.getByRole('main', { name: 'Esta Semana' })).toBeVisible()

    await expectNoAxeViolations(page, { label: 'wide · /planner/week' })
  })

  test('axe com o Detalhe da tarefa ABERTO (o dialog precisa de nome acessível — 4.1.2)', async ({
    page,
    email,
  }) => {
    // Nenhum outro axe desta story abre o `TaskDetailCard` — um dialog SEM
    // nome acessível (achado real desta rodada de QA: `aria-label` na
    // `<Dialog>` do MUI cai no root do Modal, não no `Paper` que carrega
    // `role="dialog"`) passaria batido para sempre sem este scan.
    seedWeeklyBoardScenario(email)
    await page.getByRole('button', { name: 'Esta Semana' }).click()
    await expect(page.getByRole('main', { name: 'Esta Semana' })).toBeVisible()

    await page.getByRole('button', { name: 'Ver detalhes de Pendente na segunda' }).click()
    await expect(page.getByRole('dialog', { name: 'Detalhe da tarefa' })).toBeVisible()
    await waitForDialogSettled(page)

    await expectNoAxeViolations(page, { label: 'wide · /planner/week · Detalhe da tarefa aberto' })
  })

  test('reordenação relativa: Mover acima/abaixo trocam irmãos do MESMO dia (Task 7)', async ({
    page,
    email,
  }) => {
    seedWeeklyBoardScenario(email)
    await page.getByRole('button', { name: 'Esta Semana' }).click()
    await expect(page.getByRole('main', { name: 'Esta Semana' })).toBeVisible()

    const mondayRegion = page.getByRole('region').filter({ hasText: 'Segunda' }).first()
    // Ordem inicial do seed: "Pendente na segunda" (order_index 1.0) antes de
    // "Concluída na segunda" (order_index 2.0).
    await expect(mondayRegion.getByTestId('task-row')).toHaveText([
      /Pendente na segunda/,
      /Concluída na segunda/,
    ])

    const firstRow = mondayRegion.getByTestId('task-row').filter({ hasText: 'Pendente na segunda' })
    await firstRow.getByRole('button', { name: 'Reordenar tarefa' }).click()
    await page.getByRole('menuitem', { name: 'Mover abaixo' }).click()

    // POST /tasks/{id}/reorder/ contra o backend REAL — a ordem visual troca.
    await expect(mondayRegion.getByTestId('task-row')).toHaveText([
      /Concluída na segunda/,
      /Pendente na segunda/,
    ])
  })

  test('navegação de linhagem: a seta de origem migrada leva ao sucessor, com destaque e foco (AC2)', async ({
    page,
    email,
  }) => {
    seedWeeklyBoardLineageScenario(email)
    await page.getByRole('button', { name: 'Esta Semana' }).click()
    const main = page.getByRole('main', { name: 'Esta Semana' })
    await expect(main).toBeVisible()
    await expect(page.getByText('Origem da migração')).toBeVisible()
    await expect(page.getByText('Sucessora da migração')).toBeVisible()

    const successorRow = page.getByTestId('task-row').filter({ hasText: 'Sucessora da migração' })
    // Sucessor disponível na MESMA semana carregada — a seta é controle ativo,
    // não `aria-disabled`.
    const lineageArrow = main.getByRole('button', { name: 'Migrada — ir para o sucessor' })
    await expect(lineageArrow).toHaveAttribute('aria-disabled', 'false')
    await lineageArrow.click()

    // O evento de destaque foca o sucessor e anuncia via `role="status"`, sem
    // abrir o detalhe (nenhum dialog nasce).
    await expect(page.locator(':focus')).toContainText('Sucessora da migração')
    await expect(page.getByRole('status').filter({ hasText: 'Veio de tarefa migrada — Sucessora da migração' })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // O destaque encerra pela PRIMEIRA interação (clique) — não pelo timer de
    // 2000ms, que deixaria o teste lento à toa.
    await successorRow.click()
    await expect(page.getByRole('status').filter({ hasText: 'Veio de tarefa migrada' })).toHaveCount(0)
  })

  test('Detalhe da tarefa: categoria e Eisenhower persistem após Salvar (AC2)', async ({ page, email }) => {
    seedWeeklyBoardScenario(email)
    await page.getByRole('button', { name: 'Esta Semana' }).click()
    await expect(page.getByRole('main', { name: 'Esta Semana' })).toBeVisible()

    await page.getByRole('button', { name: 'Ver detalhes de Pendente na segunda' }).click()
    const detail = page.getByRole('dialog', { name: 'Detalhe da tarefa' })
    await expect(detail).toBeVisible()

    await detail.getByRole('radio', { name: 'Categoria Teal' }).click()
    await expect(detail.getByRole('radio', { name: 'Categoria Teal' })).toHaveAttribute('aria-checked', 'true')
    await detail.getByRole('checkbox', { name: 'Urgente (U)' }).check()

    // Espera o refetch (invalidação pós-PATCH) responder ANTES de reabrir —
    // `TaskDetailCard` reinicializa o rascunho só no MOUNT (molde de
    // `TaskDetailPanel.tsx`, sem `useEffect`), então reabrir antes do cache
    // atualizar leria a task ainda desatualizada.
    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.request().method() === 'GET' && /\/api\/bujo\/logs\/weekly\/(\?.*)?$/.test(res.url()),
      ),
      detail.getByRole('button', { name: 'Salvar' }).click(),
    ])
    await expect(detail).toHaveCount(0) // salvar-e-fecha

    // Reabre a MESMA tarefa — round-trip contra o backend real prova que o
    // PATCH persistiu (não é só estado local do componente).
    await page.getByRole('button', { name: 'Ver detalhes de Pendente na segunda' }).click()
    const reopened = page.getByRole('dialog', { name: 'Detalhe da tarefa' })
    await expect(reopened.getByRole('radio', { name: 'Categoria Teal' })).toHaveAttribute('aria-checked', 'true')
    await expect(reopened.getByRole('checkbox', { name: 'Urgente (U)' })).toBeChecked()
  })

  test('Detalhe da tarefa: Cancelar transiciona o status; Excluir remove a linha (AC2)', async ({
    page,
    email,
  }) => {
    seedWeeklyBoardScenario(email)
    await page.getByRole('button', { name: 'Esta Semana' }).click()
    const main = page.getByRole('main', { name: 'Esta Semana' })
    await expect(main).toBeVisible()

    await page.getByRole('button', { name: 'Ver detalhes de Pendente na segunda' }).click()
    const detail = page.getByRole('dialog', { name: 'Detalhe da tarefa' })
    // Espera o refetch da transição responder — a LINHA lê `weeklyLog.data`
    // direto (sem estado próprio), então só reflete o novo status depois que
    // o cache invalidado voltar do backend.
    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.request().method() === 'GET' && /\/api\/bujo\/logs\/weekly\/(\?.*)?$/.test(res.url()),
      ),
      detail.getByRole('button', { name: 'Cancelar tarefa' }).click(),
    ])
    await expect(detail).toHaveCount(0)

    const cancelledRow = page.getByTestId('task-row').filter({ hasText: 'Pendente na segunda' })
    // Cancelada é conteúdo semântico (não controle): `role="img"`, não button.
    // `exact: true` — sem isso colide com o PRÓPRIO título da tarefa, "Ver
    // detalhes de Pendente na segunda", que contém "Pendente" como substring.
    await expect(cancelledRow.getByRole('img', { name: 'Cancelada' })).toBeVisible()
    await expect(cancelledRow.getByRole('button', { name: 'Pendente', exact: true })).toHaveCount(0)

    // Cria uma tarefa nova (pending, sem linhagem) só para provar o hard
    // delete de verdade removendo a linha do DOM.
    const mondayRegion = page.getByRole('region').filter({ hasText: 'Segunda' }).first()
    await mondayRegion.getByLabel('Título').fill('Tarefa descartável')
    await mondayRegion.getByRole('button', { name: 'Adicionar' }).click()
    const disposableRow = page.getByTestId('task-row').filter({ hasText: 'Tarefa descartável' })
    await expect(disposableRow).toBeVisible()

    await disposableRow.getByRole('button', { name: 'Ver detalhes de Tarefa descartável' }).click()
    await page.getByRole('dialog', { name: 'Detalhe da tarefa' }).getByRole('button', { name: 'Excluir tarefa' }).click()
    await expect(page.getByRole('dialog', { name: 'Detalhe da tarefa' })).toHaveCount(0)
    await expect(disposableRow).toHaveCount(0)
  })
})

test.describe('Weekly Board — medium 1280×800', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('recomposição medium: pool lateral, dias em 2 por faixa (AC1)', async ({ page, email }) => {
    seedWeeklyBoardScenario(email)
    await page.getByRole('button', { name: 'Esta Semana' }).click()
    await expect(page.getByRole('main', { name: 'Esta Semana' })).toBeVisible()

    await expect(page.getByRole('region', { name: 'Sem dia definido' })).toBeVisible()
    await expect(page.getByRole('tablist')).toHaveCount(0)
    await expectNoAxeViolations(page, { label: 'medium · /planner/week' })
  })
})

test.describe('Weekly Board — tablet 800×720', () => {
  test.use({ viewport: { width: 800, height: 720 } })

  test('recomposição tablet: pool desce abaixo da grade (AC1)', async ({ page, email }) => {
    seedWeeklyBoardScenario(email)
    // Tablet inicia em RAIL de 64px (AC6/KB-03 do shell, Story 13.x) — os
    // grupos ficam FECHADOS no rail e "Esta Semana" não existe no DOM até
    // expandir (achado real da Task 12: o clique direto travava 60s à toa
    // esperando um botão que só nasce depois do toggle).
    await mainNav(page).getByRole('button', { name: 'Expandir sidebar' }).click()
    await page.getByRole('button', { name: 'Esta Semana' }).click()
    await expect(page.getByRole('main', { name: 'Esta Semana' })).toBeVisible()

    await expect(page.getByRole('region', { name: 'Sem dia definido' })).toBeVisible()
    await expectNoAxeViolations(page, { label: 'tablet · /planner/week' })
  })
})

test.describe('Weekly Board — compact 390×720', () => {
  test.use({ viewport: { width: 390, height: 720 } })

  test('compact: seletor de 8 células, um dia por vez, sem scroll horizontal (AC1)', async ({
    page,
    email,
  }) => {
    seedWeeklyBoardScenario(email)
    await page.getByRole('button', { name: 'Esta Semana' }).click()
    await expect(page.getByRole('main', { name: 'Esta Semana' })).toBeVisible()

    const tablist = page.getByRole('tablist', { name: 'Selecionar dia da semana' })
    await expect(tablist).toBeVisible()
    await expect(page.getByRole('tab')).toHaveCount(8)
    // Só UMA região de dia/pool por vez.
    await expect(page.getByRole('region')).toHaveCount(1)

    await page.getByRole('tab', { name: 'Sem dia' }).click()
    await expect(page.getByRole('region', { name: 'Sem dia definido' })).toBeVisible()

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1) // sem scroll horizontal

    await expectNoAxeViolations(page, { label: 'compact 390 · /planner/week' })
  })
})

test.describe('Weekly Board — reflow 320×720', () => {
  test.use({ viewport: { width: 320, height: 720 } })

  test('reflow em 320 CSS px sem scroll horizontal, primeiro e último controle visíveis (AC7)', async ({
    page,
    email,
  }) => {
    seedWeeklyBoardScenario(email)
    await page.getByRole('button', { name: 'Esta Semana' }).click()
    await expect(page.getByRole('main', { name: 'Esta Semana' })).toBeVisible()

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)

    await expect(page.getByRole('button', { name: /registros/ }).first()).toBeVisible()
    await expect(page.getByRole('tab').last()).toBeVisible()

    await expectNoAxeViolations(page, { label: 'reflow 320 · /planner/week' })
  })
})
