import { test, expect, E2E_PASSWORD } from './fixtures'
import { expectNoAxeViolations } from './axeHelper'
import {
  bottomNav,
  mainNav,
  navigate,
  navigationSheet,
  waitForDialogSettled,
  waitForSheetSettled,
} from './shellHelpers'
import type { APIRequestContext, Page } from '@playwright/test'

// Cobre a biblioteca de Recorrentes do sistema novo (Story 14.8, M09) contra o
// backend REAL da branch Neon `e2e`. `/planner/recurring` é a QUARTA superfície
// interna migrada (`surfaceMigrated: true`) — o gate de acessibilidade roda SEM
// `exclude: 'main'` e SEM `disableRules`, nas 5 faixas, desde o primeiro commit,
// medindo lista, card de detalhe aberto E dialog de confirmação aberto (AC6).
//
// Esta story NÃO altera backend — toda escrita usada para SETUP passa pela API
// (molde de `recurring-soft-delete.spec.ts`); os testes desta suíte exercitam a
// UI nova (criar/editar/desativar/excluir), que é exatamente o que ainda não
// tinha cobertura de browser real.

const API = 'http://localhost:8000'

interface TemplateNoFio {
  id: string
  title: string
  active: boolean
}

async function templatesApi(request: APIRequestContext, email: string) {
  const tokenResponse = await request.post(`${API}/api/accounts/token/`, {
    data: { email, password: E2E_PASSWORD },
  })
  expect(tokenResponse.status()).toBe(200)
  const { access } = (await tokenResponse.json()) as { access: string }
  const headers = { Authorization: `Bearer ${access}` }

  return {
    async create(fields: {
      title: string
      recurrenceGroup: 'weekly' | 'monthly' | 'annual'
      recurrenceText: string
      active?: boolean
    }) {
      const response = await request.post(`${API}/api/bujo/recurring-templates/`, {
        headers,
        data: fields,
      })
      expect(response.status(), `criação de ${fields.title}`).toBe(201)
      return (await response.json()) as TemplateNoFio
    },
    async deactivate(id: string) {
      const response = await request.patch(`${API}/api/bujo/recurring-templates/${id}/`, {
        headers,
        data: { active: false },
      })
      expect(response.status()).toBe(200)
    },
  }
}

/** Navega até a biblioteca e espera o landmark aparecer. */
async function irParaRecorrentes(page: Page): Promise<void> {
  await navigate(page, 'Recorrentes')
}

/** Em compact, "Recorrentes" não está na bottom nav (só Hoje/Esta Semana/Este
 * Mês/Menu) — vem pelo sheet de navegação completa (mesmo padrão do Future Log
 * na Story 14.7). */
async function irParaRecorrentesCompact(page: Page): Promise<void> {
  await bottomNav(page).getByRole('button', { name: 'Menu' }).click()
  await waitForSheetSettled(page)
  await navigationSheet(page).getByRole('button', { name: 'Recorrentes' }).click()
  await expect(page.getByRole('main', { name: 'Recorrentes' })).toBeVisible()
}

function tablist(page: Page) {
  return page.getByRole('tablist', { name: 'Grupo de recorrência' })
}

function filtroInativos(page: Page) {
  return page.getByRole('checkbox', { name: 'Mostrar inativos' })
}

function card(page: Page) {
  return page.getByRole('dialog', { name: 'Detalhe do template' })
}

function confirmDialog(page: Page) {
  return page.getByRole('alertdialog', { name: 'Confirmar exclusão' })
}

/**
 * `waitForDialogSettled` (shellHelpers) assume UM `.MuiDialog-container` na
 * página — aqui, quando o alertdialog de confirmação abre POR CIMA do card de
 * edição, existem DOIS simultaneamente, e `page.locator('.MuiDialog-container')`
 * sem escopo viola strict mode. O de confirmação é sempre o ÚLTIMO no DOM (abre
 * depois). Sem esperar seu Fade assentar, o axe mede o dialog translúcido em
 * transição e acusa `color-contrast` falso — achado real desta story, mesma
 * classe documentada no cabeçalho de `waitForDialogSettled`.
 */
async function waitForTopDialogSettled(page: import('@playwright/test').Page): Promise<void> {
  await expect
    .poll(async () =>
      page.locator('.MuiDialog-container').last().evaluate((el) => getComputedStyle(el).opacity),
    )
    .toBe('1')
}

test.describe('Recorrentes — wide 1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('abas com contagem que muda com o filtro; criar herdando a aba e trocando antes de criar; validação preserva rascunho (AC1/AC3)', async ({
    page,
    email,
    request,
  }) => {
    test.setTimeout(120_000)
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => consoleErrors.push(err.message))

    const api = await templatesApi(request, email)
    await api.create({
      title: 'Reunião semanal',
      recurrenceGroup: 'weekly',
      recurrenceText: 'toda segunda de manhã',
    })
    const semanalInativo = await api.create({
      title: 'Alongar de manhã',
      recurrenceGroup: 'weekly',
      recurrenceText: 'todo dia útil',
    })
    await api.deactivate(semanalInativo.id)

    await irParaRecorrentes(page)
    await expect(tablist(page)).toBeVisible()

    // A contagem reflete a MESMA lista filtrada (AC1): com "Mostrar inativos"
    // desligado, o inativo não entra na contagem nem na lista.
    await expect(page.getByRole('tab', { name: 'Semanal (1)' })).toBeVisible()
    await filtroInativos(page).click()
    await expect(page.getByRole('tab', { name: 'Semanal (2)' })).toBeVisible()
    await filtroInativos(page).click()
    await expect(page.getByRole('tab', { name: 'Semanal (1)' })).toBeVisible()

    // Criar herdando a aba ativa (Semanal por padrão) e depois trocando antes
    // de criar (AC3) — o Grupo é editável só na criação.
    await page.getByRole('button', { name: 'Novo template', exact: true }).click()
    await expect(card(page)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Novo template' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Semanal' })).toHaveAttribute('aria-checked', 'true')

    // Validação: salvar vazio é bloqueado, com motivo visível e rascunho
    // preservado (delta contratado — o legado abortava em silêncio).
    // Escopado ao CARD: o `BrainDumpCaptureSheet` portaliza um campo "Título"
    // próprio, oculto, em toda rota desde a Story 13.3 — `getByLabel('Título')`
    // sem escopo casa os dois (achado conhecido, ver `shellHelpers`/specs do shell).
    await expect(page.getByRole('button', { name: 'Criar' })).toBeDisabled()
    await card(page).getByLabel('Título').fill('Planejar férias')
    await card(page).getByLabel('Título').blur()
    // O motivo só aparece depois do campo TOCADO (evita ruído num form recém-
    // aberto) — `.blur()` sozinho não conta como toque sem um `.focus()` real
    // antes, então focamos explicitamente antes de sair do campo.
    await card(page).getByLabel('Recorrência', { exact: true }).focus()
    await card(page).getByLabel('Recorrência', { exact: true }).blur()
    await expect(card(page).getByText('Informe uma recorrência.')).toBeVisible()
    await expect(card(page).getByLabel('Título')).toHaveValue('Planejar férias')

    // Troca de Grupo antes de criar.
    await page.getByRole('radio', { name: 'Anual' }).click()
    await card(page).getByLabel('Recorrência', { exact: true }).fill('todo dezembro')
    await page.getByRole('button', { name: 'Criar' }).click()
    await expect(card(page)).toHaveCount(0)

    await page.getByRole('tab', { name: /Anual/ }).click()
    await expect(page.getByText('Anual — todo dezembro')).toBeVisible({ timeout: 10_000 })

    expect(consoleErrors).toEqual([])
  })

  test('editar com Grupo readonly; Desativar → chip "inativo" → Ativar; Excluir → dialog → some de TODAS as abas mesmo com "Mostrar inativos" ligado (AC3/AC4)', async ({
    page,
    email,
    request,
  }) => {
    test.setTimeout(120_000)
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => consoleErrors.push(err.message))

    const api = await templatesApi(request, email)
    const alvo = await api.create({
      title: 'Regar as plantas',
      recurrenceGroup: 'weekly',
      recurrenceText: 'toda segunda',
    })
    // Irmã de não-vacuidade: este template continua vivo depois da exclusão do
    // outro — prova que Excluir é escopado ao alvo, não à lista inteira.
    await api.create({
      title: 'Backup fiscal',
      recurrenceGroup: 'weekly',
      recurrenceText: 'toda sexta',
    })

    await irParaRecorrentes(page)
    await expect(tablist(page)).toBeVisible()

    // Editar com Grupo READONLY.
    await page.getByRole('button', { name: `Editar ${alvo.title}` }).click()
    await expect(card(page)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Editar template' })).toBeVisible()
    await expect(page.getByRole('radiogroup', { name: 'Grupo de recorrência' })).toHaveAttribute(
      'aria-readonly',
      'true',
    )
    await card(page).getByRole('button', { name: 'Fechar' }).click()
    await expect(card(page)).toHaveCount(0)

    // Desativar (reversível): a linha some com o filtro desligado, ganha o
    // chip "inativo" e o botão "Ativar" com o filtro ligado.
    await page.getByRole('button', { name: `Desativar ${alvo.title}` }).click()
    await expect(page.getByText(alvo.title, { exact: true })).toHaveCount(0, { timeout: 10_000 })
    await filtroInativos(page).click()
    await expect(page.getByRole('button', { name: `Ativar ${alvo.title}` })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText('inativo', { exact: true })).toBeVisible()

    // Excluir (terminal, sem volta na UI), com o filtro "Mostrar inativos"
    // AINDA LIGADO: o template some mesmo assim, porque o filtro do excluído
    // vive no servidor (AD-08 item 6b), não no cliente — diferente do inativo,
    // que só saiu de vista por causa do filtro client-side.
    await page.getByRole('button', { name: `Editar ${alvo.title}` }).click()
    await expect(card(page)).toBeVisible()
    await page.getByRole('button', { name: 'Excluir template' }).click()
    const dialog = confirmDialog(page)
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(`«${alvo.title}» sai da biblioteca`)).toBeVisible()
    await dialog.getByRole('button', { name: 'Excluir' }).click()

    await expect(dialog).toHaveCount(0)
    await expect(card(page)).toHaveCount(0)
    await expect(page.getByText(alvo.title, { exact: true })).toHaveCount(0, { timeout: 10_000 })
    // Irmã de não-vacuidade: o outro template continua na biblioteca.
    await expect(page.getByText('Backup fiscal', { exact: true })).toBeVisible()

    expect(consoleErrors).toEqual([])
  })

  test('falha de escrita ao criar preserva o rascunho com retry; falha do DELETE mantém dialog utilizável com retry — nunca fecha em cima de um erro (AC3/AC4)', async ({
    page,
    email,
    request,
  }) => {
    // Gap encontrado pelo passo de QA: a AC3/AC4 contratam explicitamente que
    // uma falha de escrita NUNCA fecha o card/dialog em cima do erro — só
    // havia prova disso em jsdom (`TemplateDetailCard.test.tsx`,
    // `RecurringLibraryPage.test.tsx`, mutação mockada). É exatamente a classe
    // de achado que as Stories 14.6/14.7 pagaram por medir estrutura ARIA nova
    // sem exercitar o caminho real: aqui o dialog empilhado (alertdialog sobre
    // o card) só existe de verdade no browser.
    test.setTimeout(60_000)
    const api = await templatesApi(request, email)
    const alvo = await api.create({
      title: 'Anotar despesas',
      recurrenceGroup: 'weekly',
      recurrenceText: 'toda sexta',
    })

    await irParaRecorrentes(page)
    await expect(tablist(page)).toBeVisible()

    // Falha de escrita ao CRIAR (AC3): a 1ª tentativa de POST falha; o card
    // continua aberto com o rascunho intacto e o motivo visível.
    let createAttempts = 0
    await page.route('**/api/bujo/recurring-templates/', async (route) => {
      if (route.request().method() === 'POST') {
        createAttempts += 1
        if (createAttempts === 1) {
          await route.fulfill({ status: 500, body: '{}' })
          return
        }
      }
      await route.continue()
    })

    await page.getByRole('button', { name: 'Novo template', exact: true }).click()
    await expect(card(page)).toBeVisible()
    await card(page).getByLabel('Título').fill('Organizar recibos')
    await card(page).getByLabel('Recorrência', { exact: true }).fill('todo mês')
    await page.getByRole('button', { name: 'Criar' }).click()
    await expect(
      card(page).getByText('Não foi possível salvar o template. Tente novamente.'),
    ).toBeVisible()
    await expect(card(page).getByLabel('Título')).toHaveValue('Organizar recibos')
    await expect(card(page)).toBeVisible()

    // Retry: a 2ª tentativa passa (a rota deixa passar a partir daqui).
    await page.getByRole('button', { name: 'Criar' }).click()
    await expect(card(page)).toHaveCount(0)
    await expect(page.getByText('Semanal — todo mês')).toBeVisible({ timeout: 10_000 })
    await page.unroute('**/api/bujo/recurring-templates/')

    // Falha do DELETE (AC4): mantém o alertdialog utilizável, com motivo,
    // sem fechar em cima do erro.
    let deleteAttempts = 0
    await page.route(`**/api/bujo/recurring-templates/${alvo.id}/`, async (route) => {
      if (route.request().method() === 'DELETE') {
        deleteAttempts += 1
        if (deleteAttempts === 1) {
          await route.fulfill({ status: 500, body: '{}' })
          return
        }
      }
      await route.continue()
    })

    await page.getByRole('button', { name: `Editar ${alvo.title}` }).click()
    await expect(card(page)).toBeVisible()
    await page.getByRole('button', { name: 'Excluir template' }).click()
    const dialog = confirmDialog(page)
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Excluir' }).click()
    await expect(
      dialog.getByText('Não foi possível excluir o template. Tente novamente.'),
    ).toBeVisible()
    // O dialog não fecha em cima do erro — continua utilizável para retry.
    await expect(dialog).toBeVisible()

    // Retry: a 2ª tentativa passa; dialog e card fecham, template some.
    await dialog.getByRole('button', { name: 'Excluir' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(card(page)).toHaveCount(0)
    await expect(page.getByText(alvo.title, { exact: true })).toHaveCount(0, { timeout: 10_000 })
  })

  test('o dialog de confirmação nasce com foco em "Cancelar" (ação não-destrutiva) e devolve o foco ao acionador ao fechar, por Escape e por Cancelar (AC6)', async ({
    page,
    email,
    request,
  }) => {
    // Gap encontrado pelo passo de QA: AC6 contrata contenção/devolução de
    // foco para o dialog e o card, e foco inicial numa ação não-destrutiva —
    // mas nada (nem unit, nem E2E) provava isso; só a estrutura ARIA era
    // medida pelo axe. Foco é comportamento de FocusTrap real do MUI, que
    // jsdom não simula fidedignamente — precisa do browser real.
    test.setTimeout(60_000)
    const api = await templatesApi(request, email)
    const alvo = await api.create({
      title: 'Revisar orçamento',
      recurrenceGroup: 'weekly',
      recurrenceText: 'toda sexta',
    })

    await irParaRecorrentes(page)
    await expect(page.getByText(alvo.title, { exact: true })).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: `Editar ${alvo.title}` }).click()
    await expect(card(page)).toBeVisible()
    const excluirButton = page.getByRole('button', { name: 'Excluir template' })
    await excluirButton.click()
    const dialog = confirmDialog(page)
    await expect(dialog).toBeVisible()
    await waitForTopDialogSettled(page)

    // Foco nasce numa ação NÃO-destrutiva — nunca em "Excluir".
    await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused()

    // Escape fecha SEM excluir e devolve o foco ao acionador.
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(excluirButton).toBeFocused()
    await expect(card(page)).toBeVisible()
    await expect(page.getByText(alvo.title, { exact: true })).toBeVisible()

    // Reabrir e fechar por "Cancelar" tem o mesmo efeito.
    await excluirButton.click()
    await expect(dialog).toBeVisible()
    await waitForTopDialogSettled(page)
    await dialog.getByRole('button', { name: 'Cancelar' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(excluirButton).toBeFocused()
  })

  test('a biblioteca não oferece Alocar — irmã de não-vacuidade: Alocar existe no Future Log para o mesmo template anual (AC5)', async ({
    page,
    email,
    request,
  }) => {
    test.setTimeout(120_000)
    const api = await templatesApi(request, email)
    await api.create({
      title: 'Revisão anual de contratos',
      recurrenceGroup: 'annual',
      recurrenceText: 'todo dezembro',
    })

    await irParaRecorrentes(page)
    await expect(tablist(page)).toBeVisible()
    await page.getByRole('tab', { name: /Anual/ }).click()
    await expect(page.getByText('Revisão anual de contratos', { exact: true })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByRole('button', { name: 'Alocar' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Definir placement' })).toHaveCount(0)

    // Irmã: o MESMO template oferece Alocar no Future Log — a ausência acima
    // é escopo da biblioteca, não um bug de rota/dado.
    await navigate(page, 'Futuro')
    const currentYear = new Date().getFullYear()
    const secao = page.getByRole('region', { name: `Anuais pendentes de ${currentYear}` })
    await expect(secao).toBeVisible({ timeout: 10_000 })
    await expect(
      secao.getByRole('listitem').filter({ hasText: 'Revisão anual de contratos' }).getByRole('button', {
        name: 'Alocar',
      }),
    ).toBeVisible()
  })

  test('offline: motivo visível e criar/editar/ativar/excluir indisponíveis, sem fila local (AC6)', async ({
    page,
    email,
    request,
  }) => {
    test.setTimeout(60_000)
    const api = await templatesApi(request, email)
    const alvo = await api.create({
      title: 'Revisar orçamento',
      recurrenceGroup: 'weekly',
      recurrenceText: 'toda sexta',
    })

    await irParaRecorrentes(page)
    await expect(page.getByText(alvo.title, { exact: true })).toBeVisible({ timeout: 10_000 })

    await page.context().setOffline(true)
    try {
      await expect(
        page.getByText(
          'Você está offline. Consulta disponível; criar e editar templates ficam indisponíveis até reconectar.',
        ),
      ).toBeVisible()
      await expect(page.getByRole('button', { name: 'Novo template', exact: true })).toBeDisabled()
      await expect(page.getByRole('button', { name: `Editar ${alvo.title}` })).toBeDisabled()
      await expect(page.getByRole('button', { name: `Desativar ${alvo.title}` })).toBeDisabled()
      // A consulta continua: o template segue em tela (cache).
      await expect(page.getByText(alvo.title, { exact: true })).toBeVisible()
    } finally {
      await page.context().setOffline(false)
    }
  })

  test('axe sem violações em wide, com o card de detalhe e o dialog de confirmação abertos (AC6)', async ({
    page,
    email,
    request,
  }) => {
    test.setTimeout(60_000)
    const api = await templatesApi(request, email)
    const alvo = await api.create({
      title: 'Revisar orçamento',
      recurrenceGroup: 'weekly',
      recurrenceText: 'toda sexta',
    })

    await irParaRecorrentes(page)
    await expect(page.getByText(alvo.title, { exact: true })).toBeVisible({ timeout: 10_000 })
    await expectNoAxeViolations(page, { label: 'wide · /planner/recurring · lista' })

    await page.getByRole('button', { name: `Editar ${alvo.title}` }).click()
    await waitForDialogSettled(page)
    await expect(page.getByRole('heading', { name: 'Editar template' })).toBeVisible()
    await expectNoAxeViolations(page, { label: 'wide · /planner/recurring · card aberto' })

    await page.getByRole('button', { name: 'Excluir template' }).click()
    await expect(confirmDialog(page)).toBeVisible()
    await waitForTopDialogSettled(page)
    await expectNoAxeViolations(page, {
      label: 'wide · /planner/recurring · dialog de confirmação aberto',
    })
  })
})

test.describe('Recorrentes — medium 1280×800', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('axe sem violações em medium, com o card e o dialog abertos (AC6)', async ({
    page,
    email,
    request,
  }) => {
    test.setTimeout(60_000)
    const api = await templatesApi(request, email)
    const alvo = await api.create({
      title: 'Revisar orçamento',
      recurrenceGroup: 'weekly',
      recurrenceText: 'toda sexta',
    })

    await irParaRecorrentes(page)
    await expect(page.getByText(alvo.title, { exact: true })).toBeVisible({ timeout: 10_000 })
    await expectNoAxeViolations(page, { label: 'medium · /planner/recurring · lista' })

    await page.getByRole('button', { name: `Editar ${alvo.title}` }).click()
    await waitForDialogSettled(page)
    await expectNoAxeViolations(page, { label: 'medium · /planner/recurring · card aberto' })

    await page.getByRole('button', { name: 'Excluir template' }).click()
    await expect(confirmDialog(page)).toBeVisible()
    await waitForTopDialogSettled(page)
    await expectNoAxeViolations(page, {
      label: 'medium · /planner/recurring · dialog de confirmação aberto',
    })
  })
})

test.describe('Recorrentes — tablet 800×720', () => {
  test.use({ viewport: { width: 800, height: 720 } })

  test('tablet: rail colapsado expandido, sem achado de target-size, axe com card e dialog abertos (AC6)', async ({
    page,
    email,
    request,
  }) => {
    test.setTimeout(60_000)
    const api = await templatesApi(request, email)
    const alvo = await api.create({
      title: 'Revisar orçamento',
      recurrenceGroup: 'weekly',
      recurrenceText: 'toda sexta',
    })

    // Tablet inicia em RAIL de 64px colapsado — expandir antes de navegar por
    // um destino aninhado (mesmo padrão de weekly-board/monthly-board/future-log).
    await mainNav(page).getByRole('button', { name: 'Expandir sidebar' }).click()
    await irParaRecorrentes(page)
    await expect(page.getByText(alvo.title, { exact: true })).toBeVisible({ timeout: 10_000 })
    await expectNoAxeViolations(page, { label: 'tablet · /planner/recurring · lista' })

    await page.getByRole('button', { name: `Editar ${alvo.title}` }).click()
    await waitForDialogSettled(page)
    await expectNoAxeViolations(page, { label: 'tablet · /planner/recurring · card aberto' })

    await page.getByRole('button', { name: 'Excluir template' }).click()
    await expect(confirmDialog(page)).toBeVisible()
    await waitForTopDialogSettled(page)
    await expectNoAxeViolations(page, {
      label: 'tablet · /planner/recurring · dialog de confirmação aberto',
    })
  })
})

test.describe('Recorrentes — compact 390×720', () => {
  test.use({ viewport: { width: 390, height: 720 } })

  test('compact: abas em faixa rolável horizontalmente, sem scroll horizontal no conteúdo, axe com card e dialog abertos (AC1/AC6)', async ({
    page,
    email,
    request,
  }) => {
    test.setTimeout(60_000)
    const api = await templatesApi(request, email)
    const alvo = await api.create({
      title: 'Revisar orçamento',
      recurrenceGroup: 'weekly',
      recurrenceText: 'toda sexta',
    })

    await irParaRecorrentesCompact(page)
    await expect(page.getByText(alvo.title, { exact: true })).toBeVisible({ timeout: 10_000 })

    // "Novo template" continua no header (não o FAB do mockup — colisão com o
    // FAB de captura persistente do shell, AC1) e a faixa de abas rola dentro
    // de si, sem levar o conteúdo da página a rolar horizontalmente.
    await expect(page.getByRole('button', { name: 'Novo template', exact: true })).toBeVisible()
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)

    await expectNoAxeViolations(page, { label: 'compact 390 · /planner/recurring · lista' })

    await page.getByRole('button', { name: `Editar ${alvo.title}` }).click()
    await waitForDialogSettled(page)
    await expectNoAxeViolations(page, { label: 'compact 390 · /planner/recurring · card aberto' })

    await page.getByRole('button', { name: 'Excluir template' }).click()
    await expect(confirmDialog(page)).toBeVisible()
    await waitForTopDialogSettled(page)
    await expectNoAxeViolations(page, {
      label: 'compact 390 · /planner/recurring · dialog de confirmação aberto',
    })
  })
})

test.describe('Recorrentes — reflow 320×720', () => {
  test.use({ viewport: { width: 320, height: 720 } })

  test('reflow em 320 CSS px sem scroll horizontal, axe sem violações (AC6)', async ({
    page,
    email,
    request,
  }) => {
    test.setTimeout(60_000)
    const api = await templatesApi(request, email)
    await api.create({
      title: 'Revisar orçamento',
      recurrenceGroup: 'weekly',
      recurrenceText: 'toda sexta',
    })

    await irParaRecorrentesCompact(page)
    await expect(page.getByText('Revisar orçamento', { exact: true })).toBeVisible({ timeout: 10_000 })

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)

    await expectNoAxeViolations(page, { label: 'reflow 320 · /planner/recurring' })
  })
})
