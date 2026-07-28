import { test, expect } from './fixtures'
import { expectNoAxeViolations } from './axeHelper'
import { mainNav } from './shellHelpers'
import { seedCatchUpScenario } from './seedCatchUpScenario'
import { seedYesterdayQueue } from './seedYesterdayQueue'

// Cobre o ritual de migração/catch-up unificado do sistema novo (Story 14.9,
// M10) contra o backend REAL da branch Neon `e2e`. Único dado de leitura:
// `unified_migration_queue` (Story 14.3), já provado exaustivamente por
// `unified-migration-queue.spec.ts` — aqui o alvo é a SUPERFÍCIE nova: banner
// unificado no Hoje, ritual ROTEADO dentro do shell (nunca `Dialog`), os 3
// destinos (hoje/escolher destino/cancelar), pausar/retomar e o resumo
// factual. `/migration` é rota NOVA, já migrada (`surfaceMigrated: true`) —
// o gate de acessibilidade roda SEM `exclude: 'main'`.

test.describe('Migration Ritual — wide 1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('banner unificado soma as 3 fontes e abre o ritual ROTEADO (não Dialog) ao clicar "Migrar ›"', async ({
    page,
    email,
  }) => {
    seedCatchUpScenario(email, {
      monthlyTasks: [{ title: 'Fechar orçamento de trimestre' }],
      weeklyTasks: [{ title: 'Revisar backlog antigo' }],
    })
    seedYesterdayQueue(email, [{ title: 'Pendência de ontem' }])
    await page.reload()

    const banner = page.getByRole('region', { name: /tarefas? precisam? de decisão/ })
    await expect(banner).toBeVisible()
    await expect(banner).toHaveAccessibleName(/1 de meses · 1 de semanas · 1 de dias/)

    await banner.getByRole('link', { name: 'Migrar ›' }).click()

    await expect(page).toHaveURL('/migration')
    await expect(page.getByRole('main', { name: 'Migração' })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('rail de fontes mostra Meses→Semanas→Dias com contagem; "Migrar para hoje" remove o item e atualiza o rail (AC destaque)', async ({
    page,
    email,
  }) => {
    // Uma 2ª pendência (semana) impede que decidir a de mês zere a fila
    // inteira — sem ela, o ritual mostraria o RESUMO em vez do rail.
    seedCatchUpScenario(email, {
      monthlyTasks: [{ title: 'Enviar documentos ao contador' }],
      weeklyTasks: [{ title: 'Outra pendência' }],
    })
    await page.goto('/migration')

    const sourceRail = page.getByRole('navigation', { name: 'Fontes da migração' })
    await expect(sourceRail).toBeVisible()
    await expect(page.getByText('Enviar documentos ao contador')).toBeVisible()
    await expect(page.getByText('De: ', { exact: false })).toBeVisible()

    await page.getByRole('button', { name: 'Migrar para hoje' }).click()

    await expect(page.getByText('Enviar documentos ao contador')).toHaveCount(0)
    // "Dias" nunca teve pendência nesta cena (só mês/semana foram semeados) —
    // já nasce "✓ revisado", então a asserção precisa mirar a entrada "Meses"
    // especificamente, não um `getByText` genérico (ficaria ambíguo com 2
    // matches: Meses e Dias).
    await expect(sourceRail.getByRole('button', { name: /^Meses ✓ revisado/ })).toBeVisible()
  })

  test('"Escolher destino…" com as 3 abas: migrar para um dia de "Outro mês" (destination future)', async ({
    page,
    email,
  }) => {
    seedCatchUpScenario(email, { monthlyTasks: [{ title: 'Renovar seguro do carro' }] })
    await page.goto('/migration')
    await expect(page.getByText('Renovar seguro do carro')).toBeVisible()

    await page.getByRole('button', { name: 'Escolher destino…' }).click()
    const dialog = page.getByRole('dialog', { name: 'Escolher destino' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('tab', { name: 'Esta semana' })).toBeVisible()
    await expect(dialog.getByRole('tab', { name: 'Dia no mês' })).toBeVisible()

    await dialog.getByRole('tab', { name: 'Outro mês' }).click()
    await dialog.getByRole('option').first().click()
    await dialog.getByRole('gridcell', { name: '15' }).click()
    await dialog.getByRole('button', { name: /Migrar para/ }).click()

    await expect(dialog).toHaveCount(0)
    await expect(page.getByText('Renovar seguro do carro')).toHaveCount(0)
  })

  test('"Cancelar" remove o item sem sucessor', async ({ page, email }) => {
    seedYesterdayQueue(email, [{ title: 'Tarefa sem lugar' }])
    await page.goto('/migration')
    await expect(page.getByText('Tarefa sem lugar')).toBeVisible()

    await page.getByRole('button', { name: 'Cancelar' }).click()

    await expect(page.getByText('Tarefa sem lugar')).toHaveCount(0)
  })

  test('Pausar preserva as decisões; o banner volta com a variante pausada "N de M restantes" (AC pausar/retomar)', async ({
    page,
    email,
  }) => {
    seedCatchUpScenario(email, {
      monthlyTasks: [{ title: 'Item A' }],
      weeklyTasks: [{ title: 'Item B' }],
    })
    await page.goto('/migration')
    await expect(page.getByText('Item A')).toBeVisible()

    // Decide 1 de 2 antes de pausar — a fila abriu com M=2 nesta sessão.
    await page.getByRole('button', { name: 'Migrar para hoje' }).click()
    await expect(page.getByText('Item A')).toHaveCount(0)

    await page.getByRole('button', { name: 'Pausar', exact: true }).click()
    await expect(page).toHaveURL('/today')

    const banner = page.getByRole('region', { name: /Migração pausada/ })
    await expect(banner).toBeVisible()
    await expect(banner).toHaveAccessibleName('Migração pausada · 1 de 2 restantes')
    await expect(banner.getByRole('link', { name: 'Retomar migração' })).toBeVisible()

    // Retomar mostra só o restante — sem posição/fonte exata reaberta. "Item
    // B" veio de `weeklyTasks`; com "Item A" (mês) já decidido, o rail abre
    // direto na fonte "Semanas" (única com pendência) — foco por padrão na
    // fonte com pendência, corrigido nesta passada (achado do e2e em review).
    await banner.getByRole('link', { name: 'Retomar migração' }).click()
    await expect(page).toHaveURL('/migration')
    await expect(page.getByText('Item B')).toBeVisible()
  })

  test('resumo factual: última decisão zera a fila e "Voltar ao Hoje" some com o banner', async ({
    page,
    email,
  }) => {
    seedYesterdayQueue(email, [{ title: 'Última pendência' }])
    await page.goto('/migration')
    // A fonte de "ontem" é "Dias" — única com pendência, então o rail já
    // abre nela por padrão (foco na fonte com pendência, corrigido nesta
    // passada de review; antes o rail sempre abria em "Meses").
    await expect(page.getByText('Última pendência')).toBeVisible()

    await page.getByRole('button', { name: 'Migrar para hoje' }).click()

    await expect(page.getByText('Migração concluída')).toBeVisible()
    await expect(page.getByText('1 tarefa decidida. Nada ficou sem lugar.')).toBeVisible()
    await expect(page.getByText('migradas')).toBeVisible()

    await page.getByRole('button', { name: 'Voltar ao Hoje' }).click()
    await expect(page).toHaveURL('/today')
    await expect(page.getByRole('region', { name: /precisam? de decisão/ })).toHaveCount(0)
  })

  test('offline desabilita decisões com motivo; clique fica guardado, sem fila local', async ({
    page,
    email,
  }) => {
    seedYesterdayQueue(email, [{ title: 'Pendência offline' }])
    await page.goto('/migration')
    await page.getByRole('navigation', { name: 'Fontes da migração' }).getByText('Dias').click()
    await expect(page.getByText('Pendência offline')).toBeVisible()

    await page.context().setOffline(true)
    try {
      await expect(page.getByText('Sem conexão. Migrar exige rede', { exact: false })).toBeVisible()
      const migrateButton = page.getByRole('button', { name: 'Migrar para hoje' })
      await expect(migrateButton).toHaveAttribute('aria-disabled', 'true')

      // Clique GUARDADO (nunca `disabled` nativo, nunca fila local) — mesmo
      // padrão de `weekly-planning-ritual.spec.ts`.
      await migrateButton.click({ force: true })
      await expect(page.getByText('Pendência offline')).toBeVisible()
    } finally {
      await page.context().setOffline(false)
    }
  })

  test('axe sem exclude: main', async ({ page, email }) => {
    seedCatchUpScenario(email, {
      monthlyTasks: [{ title: 'Item de mês' }],
      weeklyTasks: [{ title: 'Item de semana' }],
    })
    seedYesterdayQueue(email, [{ title: 'Item de ontem' }])
    await page.goto('/migration')
    await expect(page.getByRole('main', { name: 'Migração' })).toBeVisible()

    await expectNoAxeViolations(page, { label: 'wide · /migration' })
  })
})

test.describe('Migration Ritual — medium 1280×800', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('axe sem exclude: main em medium', async ({ page, email }) => {
    seedYesterdayQueue(email, [{ title: 'Item de ontem' }])
    await page.goto('/migration')
    await expect(page.getByRole('main', { name: 'Migração' })).toBeVisible()

    await expectNoAxeViolations(page, { label: 'medium · /migration' })
  })
})

test.describe('Migration Ritual — tablet 800×720', () => {
  test.use({ viewport: { width: 800, height: 720 } })

  test('axe sem exclude: main em tablet', async ({ page, email }) => {
    seedYesterdayQueue(email, [{ title: 'Item de ontem' }])
    await page.goto('/migration')
    await expect(page.getByRole('main', { name: 'Migração' })).toBeVisible()
    // Tablet inicia em rail colapsado (mesma lição de `weekly-planning-ritual.spec.ts`).
    await mainNav(page).getByRole('button', { name: 'Expandir sidebar' }).click()
    await expect(mainNav(page).getByRole('button', { name: 'Recorrentes' })).toBeVisible()
    // A expansão da sidebar anima largura (CSS `transition`) e o submenu
    // "Planner" abre via `Collapse` (MUI, `timeout="auto"`) — sem assentar,
    // o axe mede um frame intermediário e reporta `target-size` num item que,
    // já assentado, mede bem acima do piso (achado real, não regressão desta
    // story: o mesmo padrão de `weekly-planning-ritual.spec.ts` não precisa
    // deste settle porque a rota-alvo sempre tem um destino do Planner ativo).
    await page.waitForTimeout(300)

    await expectNoAxeViolations(page, { label: 'tablet · /migration' })
  })
})

test.describe('Migration Ritual — compact 390×720', () => {
  test.use({ viewport: { width: 390, height: 720 } })

  test('axe sem exclude: main em compact', async ({ page, email }) => {
    seedYesterdayQueue(email, [{ title: 'Item de ontem' }])
    await page.goto('/migration')
    await expect(page.getByRole('main', { name: 'Migração' })).toBeVisible()

    await expectNoAxeViolations(page, { label: 'compact 390 · /migration' })
  })
})

test.describe('Migration Ritual — reflow 320×720', () => {
  test.use({ viewport: { width: 320, height: 720 } })

  test('reflow em 320 CSS px sem scroll horizontal; axe sem exclude: main', async ({ page, email }) => {
    seedYesterdayQueue(email, [{ title: 'Item de ontem' }])
    await page.goto('/migration')
    await expect(page.getByRole('main', { name: 'Migração' })).toBeVisible()

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)

    await expectNoAxeViolations(page, { label: 'reflow 320 · /migration' })
  })
})
