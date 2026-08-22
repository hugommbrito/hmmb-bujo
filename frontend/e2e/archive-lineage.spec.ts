import { test, expect } from './fixtures'
import { expectNoAxeViolations } from './axeHelper'
import { mainNav } from './shellHelpers'
import { seedArchiveLineageScenario } from './seedArchiveLineageScenario'

// Story 14.10 (Arquivo — linhagem cross-período): a seta de linhagem de uma
// tarefa `migrated`/`postponed` cujo sucessor está em OUTRO período navega
// para a rota de destino (Weekly/Monthly via Arquivo, Daily via `daily/:date`)
// em vez de ficar muda — capacidade NOVA desta story (`migration_target` no
// `TaskSerializer` + `onNavigateToSuccessor` em `TaskRowBase`).
//
// Complementa `archive.spec.ts` (tese de "sem affordance de escrita"): aqui a
// tese é navegação + foco — chegada foca a linha sucessora, e o retorno (botão
// nativo do navegador) restaura o foco na seta de origem.

test.describe('Archive lineage — wide 1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('Weekly→Monthly: navega, foca o sucessor, destino renderiza mutável, voltar restaura foco na origem (AC2/AC3)', async ({
    page,
    email,
  }) => {
    test.setTimeout(60_000)

    const { originWeekStart, originWeeklyTaskTitle, destMonthFirst, destWeeklySuccessorTitle } =
      seedArchiveLineageScenario(email)

    await page.getByRole('button', { name: 'Arquivo' }).click()
    await expect(page.getByLabel('Arquivo')).toBeVisible()
    await page.getByRole('link', { name: `Semana de ${originWeekStart}` }).click()
    await expect(page.getByLabel(`Arquivo — Semana de ${originWeekStart}`)).toBeVisible()

    const originRow = page.getByTestId('task-row').filter({ hasText: originWeeklyTaskTitle })
    const originArrow = originRow.getByRole('button', { name: /ir para o sucessor/i })
    await expect(originArrow).toBeVisible()
    await originArrow.click()

    // Navegou para o mês de destino (via Arquivo) e focou a linha sucessora
    // (o primeiro botão dentro dela — aqui, o controle de status, já que o
    // sucessor mutável não tem seta de linhagem própria).
    await expect(page).toHaveURL(new RegExp(`/archive/monthly/${destMonthFirst}$`))
    const successorRow = page.getByTestId('task-row').filter({ hasText: destWeeklySuccessorTitle })
    await expect(successorRow).toBeVisible()
    await expect(successorRow.getByRole('button').first()).toBeFocused()

    // Destino NÃO está fechado (só a tarefa sucessora, pendente) — renderiza
    // mutável, mesma derivação usada pelos boards ativos (AC3).
    await expect(page.getByText('Fechado')).toHaveCount(0)
    await expect(page.getByLabel('Adicionar tarefa ao mês')).toBeVisible()

    // Retorno via botão nativo do navegador restaura a semana de origem e o
    // foco na seta que disparou a navegação.
    await page.goBack()
    await expect(page.getByLabel(`Arquivo — Semana de ${originWeekStart}`)).toBeVisible()
    await expect(page.getByTestId('task-row').filter({ hasText: originWeeklyTaskTitle }).getByRole('button', { name: /ir para o sucessor/i })).toBeFocused()
  })

  test('Monthly→Daily: seta de linhagem navega para a rota Daily existente (AC2)', async ({ page, email }) => {
    test.setTimeout(60_000)

    const { originMonthFirst, originMonthlyTaskTitle, destLogDate } = seedArchiveLineageScenario(email)

    // Navega direto pela rota (equivalente a: Arquivo → aba Mensal → o link do
    // mês) — o comportamento da aba/lista já é coberto por `archive.spec.ts`.
    await page.goto(`/archive/monthly/${originMonthFirst}`)
    await expect(page.getByLabel(`Arquivo — Mês de ${originMonthFirst}`)).toBeVisible()

    const originRow = page.getByTestId('task-row').filter({ hasText: originMonthlyTaskTitle })
    const originArrow = originRow.getByRole('button', { name: /ir para o sucessor/i })
    await expect(originArrow).toBeVisible()
    await originArrow.click()

    await expect(page).toHaveURL(new RegExp(`/daily/${destLogDate}$`))
  })

  test('axe sem exclude: main (detalhe semanal com seta de linhagem)', async ({ page, email }) => {
    const { originWeekStart } = seedArchiveLineageScenario(email)
    await page.goto(`/archive/weekly/${originWeekStart}`)
    await expect(page.getByLabel(`Arquivo — Semana de ${originWeekStart}`)).toBeVisible()

    await expectNoAxeViolations(page, { label: 'wide · /archive/weekly/:weekStart (linhagem)' })
  })
})

test.describe('Archive lineage — medium 1280×800', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('axe sem exclude: main em medium', async ({ page, email }) => {
    const { originWeekStart } = seedArchiveLineageScenario(email)
    await page.goto(`/archive/weekly/${originWeekStart}`)
    await expect(page.getByLabel(`Arquivo — Semana de ${originWeekStart}`)).toBeVisible()

    await expectNoAxeViolations(page, { label: 'medium · /archive/weekly/:weekStart (linhagem)' })
  })
})

test.describe('Archive lineage — compact 390×720', () => {
  test.use({ viewport: { width: 390, height: 720 } })

  test('axe sem exclude: main em compact', async ({ page, email }) => {
    const { originWeekStart } = seedArchiveLineageScenario(email)
    await page.goto(`/archive/weekly/${originWeekStart}`)
    await expect(page.getByLabel(`Arquivo — Semana de ${originWeekStart}`)).toBeVisible()

    await expectNoAxeViolations(page, { label: 'compact 390 · /archive/weekly/:weekStart (linhagem)' })
  })
})

test.describe('Archive lineage — tablet 800×720', () => {
  test.use({ viewport: { width: 800, height: 720 } })

  test('axe sem exclude: main em tablet', async ({ page, email }) => {
    const { originWeekStart } = seedArchiveLineageScenario(email)
    await page.goto(`/archive/weekly/${originWeekStart}`)
    await expect(page.getByLabel(`Arquivo — Semana de ${originWeekStart}`)).toBeVisible()
    // Tablet inicia em rail colapsado (mesma lição de
    // `weekly-planning-ritual.spec.ts`/`migration-ritual.spec.ts` — dívida
    // pré-existente do rail colapsado, fora do escopo desta story).
    await mainNav(page).getByRole('button', { name: 'Expandir sidebar' }).click()
    await expect(mainNav(page).getByRole('button', { name: 'Recorrentes' })).toBeVisible()
    await page.waitForTimeout(300)

    await expectNoAxeViolations(page, { label: 'tablet · /archive/weekly/:weekStart (linhagem)' })
  })
})
