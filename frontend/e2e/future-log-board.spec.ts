import { test, expect } from './fixtures'
import { expectNoAxeViolations } from './axeHelper'
import {
  bottomNav,
  dsTokenPx,
  mainNav,
  navigationSheet,
  waitForDialogSettled,
  waitForSheetSettled,
} from './shellHelpers'
import { monthTitleOf, seedFutureLogEmpty, seedFutureLogScenario } from './seedFutureLogScenario'

// Cobre o Future Log do sistema novo (Story 14.7, AC1/AC3/AC4/AC5/AC7) contra o
// backend REAL da branch Neon `e2e`. `/planner/future` é a TERCEIRA superfície
// interna migrada (`surfaceMigrated: true`) — o gate de acessibilidade roda SEM
// `exclude: 'main'` e SEM `disableRules`, nas 5 faixas, desde o primeiro commit.
//
// Nenhuma data é literal: tudo deriva do âncora devolvido pelo seed, que por sua
// vez deriva de `today_for(user)` no servidor (Convenção #8).

// O chrome do shell é montado em TODAS as rotas autenticadas desde a Story
// 13.3 (`BrainDumpCaptureSheet` com campo "Título", item de menu "Brain Dump: N
// itens pendentes"), então locator SEM escopo é ambíguo no app inteiro — os dois
// casos abaixo foram achados reais na primeira execução deste spec:
//   · `getByLabel('Título')` casava 2 elementos (captura do Futuro + sheet do
//     Brain Dump) → escopar ao formulário;
//   · `getByRole('button', { name: 'Pendente' })` casava por SUBSTRING o item
//     "Brain Dump: 0 itens pendentes" da sidebar → escopar à lista de foco.

/** O formulário de captura do header (não o sheet global de Brain Dump). Nome
 * SEM a palavra "Futuro" de propósito — `getByLabel('Futuro')` casa por
 * substring e é como vários specs localizam a superfície. */
function captura(page: import('@playwright/test').Page) {
  return page.getByRole('form', { name: 'Adicionar item ao Future Log' })
}

/** O seletor de destino. Em wide/medium/tablet é INLINE (não é `<Dialog>` do
 * MUI), então `waitForDialogSettled` — que espera `.MuiDialog-container` — nunca
 * assentaria: bastam a visibilidade e o próprio `role="dialog"`. */
function seletorDestino(page: import('@playwright/test').Page) {
  return page.getByRole('dialog', { name: 'Escolher destino' })
}

/** Navega até o Futuro. Em compact o destino NÃO está na bottom nav (só Hoje /
 * Esta Semana / Este Mês / Menu) — vem pelo sheet de navegação completa. */
async function irParaFuturo(
  page: import('@playwright/test').Page,
  faixa: 'desktop' | 'compact' = 'desktop',
) {
  if (faixa === 'compact') {
    await bottomNav(page).getByRole('button', { name: 'Menu' }).click()
    await waitForSheetSettled(page)
    await navigationSheet(page).getByRole('button', { name: 'Futuro' }).click()
  } else {
    await page.getByRole('button', { name: 'Futuro' }).click()
  }
  await expect(page.getByRole('main', { name: 'Futuro' })).toBeVisible()
}

test.describe('Future Log — wide 1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('trilho de 8 meses (vazios inclusive), foco no 1º mês, ordenação dia → sem-dia e troca de foco (AC1/AC3)', async ({
    page,
    email,
  }) => {
    test.setTimeout(60_000)
    const cenario = seedFutureLogScenario(email)

    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => consoleErrors.push(err.message))

    await irParaFuturo(page)

    // Geometria por token, nunca por número hardcoded no spec (AC8).
    expect(await dsTokenPx(page, '--ds-future-board-trail-width')).toBeGreaterThan(0)

    const trilho = page.getByRole('navigation', { name: 'Meses do horizonte' })
    await expect(trilho).toBeVisible()
    // 8 linhas SEMPRE — inclusive as vazias (o horizonte é scaffolding).
    await expect(trilho.getByRole('listitem')).toHaveCount(8)
    await expect(
      trilho.getByRole('button', { name: new RegExp(monthTitleOf(cenario.lastHorizonMonthFirst)) }),
    ).toBeVisible()

    // Foco default = 1º mês do horizonte, com aria-current no trilho.
    const primeiro = monthTitleOf(cenario.firstHorizonMonthFirst)
    await expect(page.getByRole('heading', { name: primeiro, level: 2 })).toBeVisible()
    await expect(trilho.getByRole('button', { name: new RegExp(primeiro) })).toHaveAttribute(
      'aria-current',
      'true',
    )

    // Contagem derivada da PRÓPRIA lista: 3 itens, 2 com dia, 1 sem dia.
    await expect(page.getByText('3 itens · 2 com dia · 1 sem dia')).toBeVisible()

    // Ordenação dia → sem-dia: o item SEM dia foi semeado com order_index 3 e
    // fica por último; os datados vêm por dia ascendente.
    const titulos = await page.getByTestId('task-row').allInnerTexts()
    const indice = (texto: string) => titulos.findIndex((t) => t.includes(texto))
    expect(indice('Renovar passaporte')).toBeLessThan(indice('Aniversario da Maria'))
    expect(indice('Aniversario da Maria')).toBeLessThan(indice('Consulta com a dentista'))

    // Data completa vs. parcial.
    await expect(page.getByText('(14)', { exact: true })).toBeVisible()
    await expect(page.getByLabel(/^Sem dia definido em /)).toBeVisible()

    // Trocar o foco pelo trilho: só a coluna de foco muda, o trilho não pisca.
    const segundo = monthTitleOf(cenario.secondHorizonMonthFirst)
    await trilho.getByRole('button', { name: new RegExp(segundo) }).click()
    await expect(page.getByRole('heading', { name: segundo, level: 2 })).toBeVisible()
    await expect(trilho.getByRole('listitem')).toHaveCount(8)
    await expect(page.getByTestId('task-row').filter({ hasText: 'Item do segundo mes' })).toBeVisible()

    expect(consoleErrors).toEqual([])
  })

  test('rota migrada: o seam legado some SÓ em /planner/future (AC1/AC9)', async ({
    page,
    email,
  }) => {
    test.setTimeout(60_000)
    seedFutureLogScenario(email)

    await irParaFuturo(page)
    // `surfaceMigrated: true` no `shellRouting.ts` tem UM efeito visível, e é
    // este: a faixa editorial do legado desaparece nesta rota.
    await expect(page.getByTestId('legacy-seam-notice')).toHaveCount(0)

    // IRMÃ DE NÃO-VACUIDADE: a rota vizinha (Recorrentes, ainda legada até a
    // 14.8) continua com o seam — o assert acima não é "o seam sumiu do app".
    await page.getByRole('button', { name: 'Recorrentes' }).click()
    await expect(page.getByLabel('Recorrentes')).toBeVisible()
    await expect(page.getByTestId('legacy-seam-notice')).toBeVisible()

    // E voltar ao Futuro faz sumir de novo (não é estado de uma visita só).
    await irParaFuturo(page)
    await expect(page.getByTestId('legacy-seam-notice')).toHaveCount(0)
  })

  test('"Ir para mês…" lista os distantes e o foco distante deixa o trilho sem seleção (AC1)', async ({
    page,
    email,
  }) => {
    test.setTimeout(60_000)
    const cenario = seedFutureLogScenario(email)

    await irParaFuturo(page)

    await page.getByRole('button', { name: 'Ir para mês…' }).click()
    await waitForDialogSettled(page)

    const distante = monthTitleOf(cenario.distantMonthFirst)
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Meses além do horizonte que têm itens.')).toBeVisible()
    await expect(dialog.getByRole('button', { name: new RegExp(distante) })).toBeVisible()
    await dialog.getByRole('button', { name: new RegExp(distante) }).click()

    await expect(page.getByRole('heading', { name: distante, level: 2 })).toBeVisible()
    await expect(page.getByTestId('task-row').filter({ hasText: 'Item bem distante' })).toBeVisible()

    // Foco distante: nenhuma linha do trilho selecionada, e o trilho NÃO cresce.
    const trilho = page.getByRole('navigation', { name: 'Meses do horizonte' })
    await expect(trilho.getByRole('listitem')).toHaveCount(8)
    await expect(trilho.locator('button[aria-current="true"]')).toHaveCount(0)

    // Voltar é selecionar qualquer linha do trilho.
    const primeiro = monthTitleOf(cenario.firstHorizonMonthFirst)
    await trilho.getByRole('button', { name: new RegExp(primeiro) }).click()
    await expect(page.getByRole('heading', { name: primeiro, level: 2 })).toBeVisible()
  })

  test('sem mês distante nenhum, o seletor mostra o estado vazio orientando à captura por data (AC1/AC7)', async ({
    page,
    email,
  }) => {
    const cenario = seedFutureLogEmpty(email)

    await irParaFuturo(page)

    // Vazio GLOBAL: convida a capturar E os 8 meses seguem no trilho.
    await expect(page.getByText('Nada no futuro ainda')).toBeVisible()
    await expect(
      page.getByText(
        'Capture algo que ainda não tem data certa e ele espera aqui até você decidir o dia.',
      ),
    ).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'Meses do horizonte' }).getByRole('listitem'),
    ).toHaveCount(8)

    await page.getByRole('button', { name: 'Ir para mês…' }).click()
    await waitForDialogSettled(page)
    await expect(
      page.getByText(`Nada capturado além de ${monthTitleOf(cenario.lastHorizonMonthFirst)}.`),
    ).toBeVisible()
    await expect(
      page.getByText('Use o campo de captura com uma data para registrar mais adiante.'),
    ).toBeVisible()
  })

  test('captura com data completa e parcial no header; mês não-futuro é rejeitado antes do POST (AC3)', async ({
    page,
    email,
  }) => {
    test.setTimeout(60_000)
    const cenario = seedFutureLogScenario(email)

    await irParaFuturo(page)

    // O campo Mês NASCE com o mês em foco (delta vs. o form legado).
    await expect(captura(page).getByLabel('Mês')).toHaveValue(
      cenario.firstHorizonMonthFirst.slice(0, 7),
    )

    // Captura PARCIAL (só mês).
    await captura(page).getByLabel('Título').fill('Capturado sem dia')
    await captura(page).getByRole('button', { name: 'Adicionar' }).click()
    await expect(page.getByTestId('task-row').filter({ hasText: 'Capturado sem dia' })).toBeVisible({
      timeout: 10_000,
    })

    // Captura COMPLETA (mês + dia).
    await captura(page).getByLabel('Título').fill('Capturado com dia')
    await captura(page).getByLabel('Dia (opcional)').fill('9')
    await captura(page).getByRole('button', { name: 'Adicionar' }).click()
    await expect(page.getByTestId('task-row').filter({ hasText: 'Capturado com dia' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText('(9)', { exact: true })).toBeVisible()

    // Mês ≤ âncora: rejeitado no cliente, com o motivo e a saída nomeada.
    await captura(page).getByLabel('Título').fill('Nao deveria existir')
    await captura(page).getByLabel('Mês').fill(cenario.anchorMonthFirst.slice(0, 7))
    await captura(page).getByRole('button', { name: 'Adicionar' }).click()
    await expect(
      page.getByText('Este mês não pertence ao Futuro. Use o Mês ou a Semana para datas de agora.'),
    ).toBeVisible()
    await expect(page.getByTestId('task-row').filter({ hasText: 'Nao deveria existir' })).toHaveCount(0)
  })

  test('datear no lugar preserva a LINHAGEM: origem "Adiada" com seta acionável + sucessor destacado (AC4)', async ({
    page,
    email,
  }) => {
    test.setTimeout(90_000)
    const cenario = seedFutureLogScenario(email)

    await irParaFuturo(page)

    // Estado ANTES: o trilho conta as 3 raízes semeadas no mês em foco.
    const trilho = page.getByRole('navigation', { name: 'Meses do horizonte' })
    const linhaDoMes = trilho.getByRole('button', {
      name: new RegExp(monthTitleOf(cenario.firstHorizonMonthFirst)),
    })
    await expect(linhaDoMes).toContainText('3 itens')

    await page.getByRole('button', { name: 'Definir dia de Consulta com a dentista' }).click()

    const seletor = seletorDestino(page)
    await expect(seletor).toBeVisible()
    await seletor.getByRole('gridcell', { name: '14', exact: true }).click()
    // Confirmação NOMEADA pelo ato — nunca um "Confirmar" genérico.
    await expect(seletor.getByRole('button', { name: 'Confirmar' })).toHaveCount(0)
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/migrate/') && r.request().method() === 'POST' && r.ok(),
      ),
      seletor.getByRole('button', { name: /^Datar em 14 de / }).click(),
    ])
    await expect(seletor).toHaveCount(0)

    // Origem E sucessor convivem no MESMO mês — nenhuma linha some (frame C).
    const linhas = page.getByTestId('task-row').filter({ hasText: 'Consulta com a dentista' })
    await expect(linhas).toHaveCount(2, { timeout: 10_000 })

    // A seta de linhagem sobre `postponed` — o ponto que a Task 4(b) existe
    // para viabilizar. Com o sucessor no MESMO DOM ela é ACIONÁVEL.
    const seta = page.getByRole('button', { name: 'Adiada — ir para o sucessor' })
    await expect(seta).toBeVisible()
    await expect(seta).toHaveAttribute('aria-disabled', 'false')
    await seta.click()

    // O sucessor recebe o destaque temporário (contorno `--ds-info`).
    const sucessor = page
      .getByTestId('task-row')
      .filter({ hasText: 'Consulta com a dentista' })
      .filter({ hasNot: page.getByRole('button', { name: /^Adiada/ }) })
    await expect(sucessor).toHaveCSS('outline-style', 'solid')

    // AC7: a MESMA seta é acionável por TECLADO. `aria-disabled` não é
    // `disabled`, e um `<div role="button">` passaria em todos os asserts acima
    // e falharia aqui — por isso Enter é medido no browser real, e não só o
    // clique em jsdom.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await seta.press('Enter')
    await expect(sucessor).toBeFocused()

    // AC2: a contagem do trilho conta raízes de QUALQUER status, então origem
    // terminal + sucessor no mesmo mês somam 4 — se contasse só as não
    // terminais, o trilho diria 3 enquanto a coluna de foco mostra 4 linhas.
    await expect(page.getByTestId('task-row')).toHaveCount(4)
    await expect(linhaDoMes).toContainText('4 itens')
    await expect(page.getByText('4 itens · 3 com dia · 1 sem dia')).toBeVisible()
  })

  test('mover para OUTRO mês pela aba "Outro mês" retarga o destino (AC4)', async ({
    page,
    email,
  }) => {
    test.setTimeout(90_000)
    const cenario = seedFutureLogScenario(email)

    await irParaFuturo(page)

    await page.getByRole('button', { name: 'Mover Renovar passaporte' }).click()

    const seletor = seletorDestino(page)
    await expect(seletor).toBeVisible()
    await seletor.getByRole('tab', { name: 'Outro mês' }).click()
    const segundo = monthTitleOf(cenario.secondHorizonMonthFirst)
    await seletor.getByRole('option', { name: segundo }).click()

    await seletor.getByRole('button', { name: 'Sem dia definido' }).click()
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/migrate/') && r.request().method() === 'POST' && r.ok(),
      ),
      seletor.getByRole('button', { name: `Mover para ${segundo.toLowerCase()}` }).click(),
    ])

    // O foco segue o destino, e o sucessor está lá.
    await expect(page.getByRole('heading', { name: segundo, level: 2 })).toBeVisible({ timeout: 10_000 })
    await expect(
      page.getByTestId('task-row').filter({ hasText: 'Renovar passaporte' }),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('concluir e cancelar NÃO existem nesta superfície — nem na linha, nem no detalhe (AC5)', async ({
    page,
    email,
  }) => {
    test.setTimeout(60_000)
    seedFutureLogScenario(email)

    await irParaFuturo(page)

    // Na LINHA: o ícone de status não é botão (é `role="img"` mudo). Escopado à
    // lista de foco: `getByRole(..., { name })` casa por SUBSTRING, e o item
    // "Brain Dump: 0 itens pendentes" da sidebar casaria "Pendente".
    const lista = page.getByRole('list', { name: /^Itens de / })
    await expect(lista.getByRole('button', { name: 'Pendente' })).toHaveCount(0)
    await expect(lista.getByRole('img', { name: 'Pendente' }).first()).toBeVisible()

    // No DETALHE: "Cancelar tarefa" some; Salvar/Mover/Excluir permanecem.
    await page.getByRole('button', { name: 'Ver detalhes de Renovar passaporte' }).click()
    await waitForDialogSettled(page)
    const detalhe = page.getByRole('dialog')
    await expect(detalhe.getByRole('button', { name: 'Cancelar tarefa' })).toHaveCount(0)
    await expect(detalhe.getByRole('button', { name: 'Salvar' })).toBeVisible()
    await expect(detalhe.getByRole('button', { name: 'Mover tarefa' })).toBeVisible()
    await expect(detalhe.getByRole('button', { name: 'Excluir tarefa' })).toBeVisible()
  })

  test('offline: consulta disponível, capturar/datar/mover indisponíveis COM MOTIVO (AC7)', async ({
    page,
    email,
  }) => {
    test.setTimeout(60_000)
    seedFutureLogScenario(email)

    await irParaFuturo(page)
    // Par não-vacuoso: ONLINE os mesmos controles estão habilitados.
    await expect(captura(page).getByRole('button', { name: 'Adicionar' })).toBeEnabled()

    await page.context().setOffline(true)
    try {
      await expect(captura(page).getByRole('button', { name: 'Adicionar' })).toBeDisabled()
      await expect(
        page.getByText(
          'Você está offline. Consulta disponível; capturar, datar e mover ficam indisponíveis até reconectar.',
        ),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Definir dia de Consulta com a dentista' }),
      ).toBeDisabled()
      // Consulta continua: trilho e lista seguem renderizados (cache).
      await expect(
        page.getByRole('navigation', { name: 'Meses do horizonte' }).getByRole('listitem'),
      ).toHaveCount(8)
    } finally {
      await page.context().setOffline(false)
    }
  })

  test('axe sem violações em wide, incluindo o seletor de destino aberto (AC7)', async ({
    page,
    email,
  }) => {
    test.setTimeout(60_000)
    seedFutureLogScenario(email)

    await irParaFuturo(page)
    await expectNoAxeViolations(page, { label: 'wide · /planner/future' })

    await page.getByRole('button', { name: 'Definir dia de Consulta com a dentista' }).click()
    await expect(seletorDestino(page)).toBeVisible()
    await expectNoAxeViolations(page, {
      label: 'wide · /planner/future · seletor de destino aberto',
    })

    // A aba "Outro mês" é a ÚNICA parte do seletor que nenhuma faixa media —
    // e é justamente a estrutura ARIA que esta story acrescentou
    // (`role="tablist"`/`role="tab"` + `role="listbox"`/`role="option"`). Medir
    // só a grade de dias repetiria a lacuna da 14.6, que nunca mediu este
    // componente ABERTO e deixou passar um `aria-required-children` CRITICAL.
    await seletorDestino(page).getByRole('tab', { name: 'Outro mês' }).click()
    await expect(seletorDestino(page).getByRole('listbox', { name: 'Meses de destino' })).toBeVisible()
    await expectNoAxeViolations(page, {
      label: 'wide · /planner/future · seletor de destino na aba "Outro mês"',
    })
  })
})

test.describe('Future Log — medium 1280×800', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('medium preserva trilho + foco e passa no axe (AC1/AC7)', async ({ page, email }) => {
    test.setTimeout(60_000)
    seedFutureLogScenario(email)

    await irParaFuturo(page)
    await expect(
      page.getByRole('navigation', { name: 'Meses do horizonte' }).getByRole('listitem'),
    ).toHaveCount(8)
    await expectNoAxeViolations(page, { label: 'medium · /planner/future' })
  })
})

test.describe('Future Log — tablet 800×720', () => {
  test.use({ viewport: { width: 800, height: 720 } })

  test('tablet: trilho + foco continuam cabendo, sem achado de target-size (AC1/AC7)', async ({
    page,
    email,
  }) => {
    test.setTimeout(60_000)
    seedFutureLogScenario(email)

    // Tablet inicia em RAIL de 64px colapsado (AC6/KB-03 do shell) — expandir
    // primeiro (mesmo padrão de `weekly-board`/`monthly-board`).
    await mainNav(page).getByRole('button', { name: 'Expandir sidebar' }).click()
    await irParaFuturo(page)

    await expect(
      page.getByRole('navigation', { name: 'Meses do horizonte' }).getByRole('listitem'),
    ).toHaveCount(8)
    await expectNoAxeViolations(page, { label: 'tablet · /planner/future' })
  })
})

test.describe('Future Log — compact 390×720', () => {
  test.use({ viewport: { width: 390, height: 720 } })

  test('compact: trilho vira barra de meses rolável, sheets contêm foco, sem scroll horizontal (AC1/AC7)', async ({
    page,
    email,
  }) => {
    test.setTimeout(60_000)
    const cenario = seedFutureLogScenario(email)

    await irParaFuturo(page, 'compact')

    const trilho = page.getByRole('navigation', { name: 'Meses do horizonte' })
    // Em compact NÃO é a lista do desktop — é a barra rolável de botões.
    await expect(trilho.getByRole('listitem')).toHaveCount(0)
    await expect(
      trilho.getByRole('button', { name: new RegExp(`${monthTitleOf(cenario.firstHorizonMonthFirst)}, `) }),
    ).toBeVisible()

    // Sem scroll horizontal no CONTEÚDO da página.
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)

    // "Ir para mês…" abre em SHEET (AC1) — um overlay com papel e nome, não uma
    // gaveta anônima —, contém o conteúdo e devolve o foco ao acionador quando
    // fecha SEM navegar (AC7).
    const acionador = trilho.getByRole('button', { name: 'Ir para mês…' })
    await acionador.click()
    const sheet = page.getByRole('dialog', { name: 'Ir para mês' })
    await expect(sheet).toBeVisible()
    await expect(
      sheet.getByRole('button', { name: new RegExp(monthTitleOf(cenario.distantMonthFirst)) }),
    ).toBeVisible()
    await expectNoAxeViolations(page, {
      label: 'compact 390 · /planner/future · sheet "Ir para mês" aberto',
    })

    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    await expect(acionador).toBeFocused()
    // Fechar não é escolher: o mês em foco continua o primeiro do horizonte.
    await expect(
      page.getByRole('heading', {
        name: monthTitleOf(cenario.firstHorizonMonthFirst),
        level: 2,
      }),
    ).toBeVisible()

    await expectNoAxeViolations(page, { label: 'compact 390 · /planner/future' })
  })
})

test.describe('Future Log — reflow 320×720', () => {
  test.use({ viewport: { width: 320, height: 720 } })

  test('reflow em 320 CSS px sem scroll horizontal (AC7)', async ({ page, email }) => {
    test.setTimeout(60_000)
    seedFutureLogScenario(email)

    await irParaFuturo(page, 'compact')

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)

    await expectNoAxeViolations(page, { label: 'reflow 320 · /planner/future' })
  })
})
