import { test, expect } from './fixtures'
import { expectNoAxeViolations } from './axeHelper'
import { countRitualContainers } from './countRitualContainers'
import { expectVisibleWithoutScrolling, mainNav, waitForDialogSettled } from './shellHelpers'
import { seedWeeklyPlanningScenario } from './seedWeeklyPlanningScenario'

// Cobre o ritual de planejamento semanal do sistema novo (Story 14.5, AC5/AC9)
// contra o backend REAL da branch Neon `e2e`. `/planner/week/planning` é a
// segunda superfície interna migrada — o gate de acessibilidade roda SEM
// `exclude: 'main'`.

test.describe('Weekly Planning Ritual — wide 1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('abrir o ritual NÃO materializa nenhum container novo (AC5, lição da 14.1/14.2)', async ({
    page,
    email,
  }) => {
    seedWeeklyPlanningScenario(email)
    const before = countRitualContainers(email)

    await page.goto('/planner/week/planning')
    await expect(page.getByRole('main', { name: 'Planejar a semana' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Fontes do planejamento' })).toBeVisible()
    // Espera as 4 fontes com endpoint próprio assentarem antes de contar.
    await expect(page.getByRole('region', { name: /Decisões —/ })).toBeVisible()

    const after = countRitualContainers(email)
    expect(after.weekly).toBe(before.weekly)
    expect(after.monthly).toBe(before.monthly)
    expect(after.daily).toBe(before.daily)
    expect(after.decisions).toBe(before.decisions)
  })

  test('as 5 fontes carregam independentemente — uma em erro não bloqueia as outras (AC5)', async ({
    page,
    email,
  }) => {
    seedWeeklyPlanningScenario(email)

    // Aborta SÓ a fonte `previous-weekly` — as outras seguem hitting o backend real.
    await page.route('**/api/bujo/rituals/weekly/sources/previous-weekly/**', (route) =>
      route.abort('failed'),
    )

    await page.goto('/planner/week/planning')
    await expect(page.getByRole('main', { name: 'Planejar a semana' })).toBeVisible()

    // Fonte ativa por padrão (monthly-in-week) segue operável.
    await expect(page.getByText('Tarefa do Monthly na semana-alvo')).toBeVisible()

    // Escopado à navegação das fontes — a sidebar (link "Recorrentes") e o
    // rail de contexto (avisos, ex. "Recorrentes: 1 pendente(s)") têm
    // controles homônimos fora deste `nav`.
    const sourceRail = page.getByRole('navigation', { name: 'Fontes do planejamento' })

    // A fonte com erro mostra a mensagem local + Tentar novamente, sem
    // travar a navegação para as outras fontes.
    await sourceRail.getByRole('button', { name: /Weekly anterior/ }).click()
    await expect(page.getByRole('alert')).toBeVisible()

    await sourceRail.getByRole('button', { name: /Recorrentes/ }).click()
    await expect(page.getByText('Recorrente semanal')).toBeVisible()

    await sourceRail.getByRole('button', { name: /Daily pendentes/ }).click()
    await expect(page.getByText('Tarefa de um dia passado')).toBeVisible()

    // 5ª fonte (`monthly-expanded`, consulta OPCIONAL/sob seleção): também
    // segue operável com `previous-weekly` em erro — sem isso o teste só
    // prova independência entre 4 das 5 fontes, não as 5 que o título afirma.
    await sourceRail.getByRole('button', { name: /Monthly ampliado/ }).click()
    await expect(page.getByText('Tarefa do Monthly na semana-alvo')).toBeVisible()
  })

  test('decisão persistida sai de Pendentes e permanece em Tudo; sem toast (AC5)', async ({
    page,
    email,
  }) => {
    test.setTimeout(60_000)
    seedWeeklyPlanningScenario(email)

    await page.goto('/planner/week/planning')
    await expect(page.getByRole('main', { name: 'Planejar a semana' })).toBeVisible()
    await expect(page.getByText('Tarefa do Monthly na semana-alvo')).toBeVisible()

    await page.getByRole('button', { name: 'Manter' }).click()
    await expect(page.getByText('Tarefa do Monthly na semana-alvo')).toHaveCount(0)

    // Sem toast de sucesso (nenhum Snackbar/Alert transitório) — o retorno é
    // a remoção da linha em si.
    await expect(page.locator('.MuiSnackbar-root')).toHaveCount(0)

    await page.getByRole('button', { name: 'Tudo' }).click()
    await expect(page.getByText('Tarefa do Monthly na semana-alvo')).toBeVisible()
  })

  // Este é o teste do DEFEITO relatado: antes da correção o seletor não era um
  // `Dialog` no desktop — entrava no fluxo do DOM depois da grade de 3 colunas
  // do ritual e abria ABAIXO DA DOBRA, então clicar em "Escolher destino…"
  // parecia não fazer nada. A prova é GEOMÉTRICA (o diálogo inteiro dentro da
  // viewport), não só de presença no DOM. Cobre também a Story 14.5 AC5: as
  // teclas `1`–`7`/`0` e o Enter que confirma o destino nomeado.
  test('seletor abre SOBREPOSTO e visível sem rolagem; teclas 1-7/0 + Enter confirmam o destino nomeado (AC5)', async ({
    page,
    email,
  }) => {
    seedWeeklyPlanningScenario(email)

    await page.goto('/planner/week/planning')
    await expect(page.getByRole('main', { name: 'Planejar a semana' })).toBeVisible()
    await expect(page.getByText('Tarefa do Monthly na semana-alvo')).toBeVisible()

    await page.getByRole('button', { name: 'Escolher destino…' }).click()
    const picker = page.getByRole('dialog', { name: 'Escolher destino' })
    await expect(picker).toBeVisible()

    // Medido ANTES de qualquer clique: `.click()` do Playwright rola o elemento
    // para a viewport, o que mascararia exatamente o defeito sob teste.
    await waitForDialogSettled(page)
    await expectVisibleWithoutScrolling(page, picker)

    // Lembrete visível dos atalhos + o foco inicial na PRIMEIRA opção de dia (não
    // no "×" do cabeçalho), as duas affordances restauradas da 14.5.
    await expect(picker.getByText(/^Atalhos: 1–7 escolhem o dia/)).toBeVisible()
    await expect(picker.getByRole('radio', { name: /^1 Segunda/ })).toBeFocused()

    await page.keyboard.press('2') // terça da semana-alvo
    await expect(picker.getByRole('radio', { name: /^2 Terça/ })).toHaveAttribute('aria-checked', 'true')
    await expect(picker.getByRole('button', { name: /^Migrar para terça/ })).toBeVisible()

    const migrateResponse = page.waitForResponse(
      (r) => r.url().includes('/migrate/') && r.request().method() === 'POST',
    )
    await page.keyboard.press('Enter')
    expect((await migrateResponse).status()).toBe(200)

    await expect(page.getByRole('dialog', { name: 'Escolher destino' })).toHaveCount(0)
    await expect(page.getByText('Tarefa do Monthly na semana-alvo')).toHaveCount(0)
  })

  test('"Sem dia definido" fica indisponível COM MOTIVO quando a semana-alvo não é a corrente (lacuna B7)', async ({
    page,
    email,
  }) => {
    seedWeeklyPlanningScenario(email)

    await page.goto('/planner/week/planning')
    await expect(page.getByRole('main', { name: 'Planejar a semana' })).toBeVisible()
    await expect(page.getByText('Tarefa do Monthly na semana-alvo')).toBeVisible()

    await page.getByRole('button', { name: 'Escolher destino…' }).click()
    const picker = page.getByRole('dialog', { name: 'Escolher destino' })
    await expect(picker).toBeVisible()

    // O cenário semeia a PRÓXIMA semana como alvo: migrar `destination: 'week'`
    // sem `scheduledDate` cairia na semana CORRENTE no servidor, nunca na alvo.
    const undated = picker.getByRole('button', { name: /^0 Sem dia definido — indisponível/ })
    await expect(undated).toHaveAttribute('aria-disabled', 'true')
    await undated.click({ force: true })
    // Nem o atalho `0` arma um destino que cairia na semana errada.
    await page.keyboard.press('0')
    await expect(picker.getByRole('button', { name: /^Migrar/ })).toHaveCount(0)
  })

  test('painel de verificação: os 3 gates de Iniciar semana aparecem individualmente (AC3)', async ({
    page,
    email,
  }) => {
    seedWeeklyPlanningScenario(email)

    await page.goto('/planner/week/planning')
    await expect(page.getByRole('main', { name: 'Planejar a semana' })).toBeVisible()

    const panel = page.getByRole('region', { name: 'Painel de verificação — Iniciar semana' })
    await expect(panel).toBeVisible()
    await expect(panel).toContainText('Data alcançada')
    await expect(panel).toContainText('Planejamento concluído')
    await expect(panel).toContainText('Weekly anterior finalizado')

    // A semana-alvo é a PRÓXIMA semana — "Data alcançada" começa ✗, e o
    // planejamento ainda não foi concluído neste cenário. Escopado ao painel —
    // sem isso colide com o texto do card "Weekly anterior" (que também
    // menciona "Iniciar semana" ao descrever o que está bloqueando).
    const startButton = panel.getByRole('button', { name: 'Iniciar semana', exact: true })
    await expect(startButton).toHaveAttribute('aria-disabled', 'true')
  })

  test('Finalizar semana anterior dentro do ritual, com dialog irreversível (AC3)', async ({
    page,
    email,
  }) => {
    test.setTimeout(60_000)
    seedWeeklyPlanningScenario(email)

    await page.goto('/planner/week/planning')
    await expect(page.getByRole('main', { name: 'Planejar a semana' })).toBeVisible()
    const sourceRail = page.getByRole('navigation', { name: 'Fontes do planejamento' })

    // Zera a pendência bloqueante: conclui a única tarefa da semana anterior.
    await sourceRail.getByRole('button', { name: /Weekly anterior/ }).click()
    await expect(page.getByText('Pendência da semana anterior')).toBeVisible()
    // `exact` — sem isso colide com o botão "Concluir planejamento" do rodapé.
    await page.getByRole('button', { name: 'Concluir', exact: true }).click()
    await expect(page.getByText('Semana anterior pronta para finalizar.')).toBeVisible()

    await page.getByRole('button', { name: 'Finalizar semana anterior' }).click()
    await expect(page.getByRole('alertdialog', { name: /irreversível/ })).toBeVisible()
    await page.getByRole('button', { name: 'Confirmar' }).click()

    await expect(page.getByRole('alertdialog')).toHaveCount(0)
  })

  test('Migrar para <dia>: atalho de destino nomeado que preserva o dia de origem (AC5)', async ({
    page,
    email,
  }) => {
    seedWeeklyPlanningScenario(email)

    await page.goto('/planner/week/planning')
    await expect(page.getByRole('main', { name: 'Planejar a semana' })).toBeVisible()
    await expect(page.getByText('Tarefa do Monthly na semana-alvo')).toBeVisible()

    // A tarefa foi semeada com `scheduled_date = target_week` (segunda) — o
    // atalho nomeado preserva esse dia, sem abrir o seletor de destino.
    await page.getByRole('button', { name: 'Migrar para Segunda' }).click()

    await expect(page.getByRole('dialog', { name: 'Escolher destino' })).toHaveCount(0)
    await expect(page.getByText('Tarefa do Monthly na semana-alvo')).toHaveCount(0)

    await page.getByRole('button', { name: 'Tudo' }).click()
    await expect(page.getByText('Tarefa do Monthly na semana-alvo')).toBeVisible()
  })

  test('Cancelar planejamento remove o alvo quando não há decisão nem tarefa (AC3)', async ({
    page,
    email,
  }) => {
    seedWeeklyPlanningScenario(email)

    await page.goto('/planner/week/planning')
    await expect(page.getByRole('main', { name: 'Planejar a semana' })).toBeVisible()

    // O alvo semeado não tem NENHUMA decisão nem tarefa — a UI impõe a regra
    // do spine mesmo o backend só bloqueando por tarefa (Dev Notes → lacuna B11).
    await page.getByRole('button', { name: 'Cancelar planejamento' }).click()

    await expect(page.getByText('Nenhuma semana em planejamento no momento.')).toBeVisible()
  })

  test('offline desabilita decisões com motivo; clique fica guardado, sem fila local (AC7)', async ({
    page,
    email,
  }) => {
    seedWeeklyPlanningScenario(email)

    await page.goto('/planner/week/planning')
    await expect(page.getByRole('main', { name: 'Planejar a semana' })).toBeVisible()
    await expect(page.getByText('Tarefa do Monthly na semana-alvo')).toBeVisible()

    await page.context().setOffline(true)
    try {
      await expect(page.getByRole('status').filter({ hasText: 'Sem conexão' })).toBeVisible()
      const keepButton = page.getByRole('button', { name: 'Manter' })
      await expect(keepButton).toHaveAttribute('aria-disabled', 'true')

      // Clique GUARDADO (nunca `disabled` nativo, nunca fila local): `force`
      // contorna a checagem de actionability do Playwright (que já trata
      // `aria-disabled="true"` como não-clicável) para provar que o PRÓPRIO
      // componente também guarda o clique internamente — defesa em camadas.
      await keepButton.click({ force: true })
      await expect(page.getByText('Tarefa do Monthly na semana-alvo')).toBeVisible()
    } finally {
      await page.context().setOffline(false)
    }
    await expect(page.getByRole('status').filter({ hasText: 'Sem conexão' })).toHaveCount(0)
  })

  test('axe sem exclude: main', async ({ page, email }) => {
    seedWeeklyPlanningScenario(email)
    await page.goto('/planner/week/planning')
    await expect(page.getByRole('main', { name: 'Planejar a semana' })).toBeVisible()

    await expectNoAxeViolations(page, { label: 'wide · /planner/week/planning' })
  })
})

test.describe('Weekly Planning Ritual — medium 1280×800', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('axe sem exclude: main em medium', async ({ page, email }) => {
    seedWeeklyPlanningScenario(email)
    await page.goto('/planner/week/planning')
    await expect(page.getByRole('main', { name: 'Planejar a semana' })).toBeVisible()

    await expectNoAxeViolations(page, { label: 'medium · /planner/week/planning' })
  })
})

test.describe('Weekly Planning Ritual — tablet 800×720', () => {
  test.use({ viewport: { width: 800, height: 720 } })

  test('axe sem exclude: main em tablet', async ({ page, email }) => {
    seedWeeklyPlanningScenario(email)
    await page.goto('/planner/week/planning')
    await expect(page.getByRole('main', { name: 'Planejar a semana' })).toBeVisible()
    // Tablet inicia em RAIL colapsado (AC6/KB-03 do shell, Story 13.x): os
    // itens de navegação viram ícone-só, com alvo de toque abaixo de 24px —
    // achado real do axe (`target-size`), não do conteúdo desta página.
    // Expandir primeiro é o mesmo padrão de `weekly-board.spec.ts`.
    await mainNav(page).getByRole('button', { name: 'Expandir sidebar' }).click()

    await expectNoAxeViolations(page, { label: 'tablet · /planner/week/planning' })
  })
})

test.describe('Weekly Planning Ritual — compact 390×720', () => {
  test.use({ viewport: { width: 390, height: 720 } })

  test('axe sem exclude: main em compact', async ({ page, email }) => {
    seedWeeklyPlanningScenario(email)
    await page.goto('/planner/week/planning')
    await expect(page.getByRole('main', { name: 'Planejar a semana' })).toBeVisible()

    await expectNoAxeViolations(page, { label: 'compact 390 · /planner/week/planning' })
  })
})

test.describe('Weekly Planning Ritual — reflow 320×720', () => {
  test.use({ viewport: { width: 320, height: 720 } })

  test('reflow em 320 CSS px sem scroll horizontal; axe sem exclude: main (AC7)', async ({
    page,
    email,
  }) => {
    seedWeeklyPlanningScenario(email)
    await page.goto('/planner/week/planning')
    await expect(page.getByRole('main', { name: 'Planejar a semana' })).toBeVisible()

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)

    await expectNoAxeViolations(page, { label: 'reflow 320 · /planner/week/planning' })
  })
})
