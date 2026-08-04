import type { Page } from '@playwright/test'

import { test, expect } from './fixtures'
import { expectNoAxeViolations } from './axeHelper'
import { seedBrainDumpItems } from './seedBrainDumpItems'
import { captureSheet, computed, dsTokenPx, mainNav, waitForDialogSettled } from './shellHelpers'

// GATE DE ACESSIBILIDADE do Brain Dump/Captura — **dono único** da matriz
// axe/teclado/touch-target desta superfície (Story 15.3, fechamento da Onda
// 4). Antes desta story: zero cobertura axe REAL (browser) sobre o conteúdo
// do Brain Dump/Capture Sheet — só jsdom (`BrainDumpInboxPage.test.tsx` e
// irmãos), que este próprio repo documenta como não confiável para
// contraste/layout real (mesmo aprendizado de `shell-a11y.spec.ts`, cujo gate
// mede o CHROME do shell, não o conteúdo das superfícies internas — esta
// suíte é o complemento para o Brain Dump).
//
// Mesmos 3 viewports de `shell-a11y.spec.ts` (wide 1440×900 / medium
// 1280×800 / compact 390×720): tablet fica fora porque o Brain Dump não tem
// composição própria por faixa (a página não é chrome) — `mediaQueries.
// tabletUp` já resolve tablet como "pointer", igual wide/medium.
//
// Nenhuma célula usa `disableRules`/`test.skip`/`test.fixme`/`exclude` novo
// não justificado — mesma disciplina de `shell-a11y.spec.ts`.
//
// [Source: spec-15-3-passe-de-paridade-estados-e-acessibilidade-da-captura.md
//  Code Map/I-O Matrix; EXPERIENCE.md §Accessibility Floor;
//  13-shell-parity-checklist.md §Onda 2a — equivalência comprovada]

const READ_ERROR = 'Não foi possível carregar as pendências.'

/** Vai para `/brain-dump` e espera o `<main>` da página assentar. */
async function gotoBrainDump(page: Page): Promise<void> {
  await page.goto('/brain-dump')
  await expect(page.getByRole('main', { name: 'Brain Dump', exact: true })).toBeVisible()
}

/** O painel Capturar (`aria-label="Capturar"` no `<section>` — mapeia para `region`). */
function capturePanel(page: Page) {
  return page.getByRole('region', { name: 'Capturar' })
}

/** Uma linha do Brain Dump pelo título (`role="listitem"`, mesmo padrão de `brain-dump.spec.ts`). */
function itemRow(page: Page, title: string) {
  return page.getByRole('listitem').filter({ hasText: title })
}

/**
 * Segura o `GET items/` indefinidamente — nunca chama `route.fulfill`/
 * `continue`/`abort`, deixando a requisição pendente de propósito (mesma
 * técnica descrita na I/O Matrix da spec: "`page.route` segurando… `GET
 * items/`"). É o estado que o skeleton de 5 linhas do `BrainDumpInboxPage`
 * cobre (`items.isPending`), medido aqui no browser real.
 */
async function holdItemsRequest(page: Page): Promise<void> {
  await page.route('**/api/brain-dump/items/', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue()
      return
    }
    // Sem chamada a fulfill/continue/abort — fica pendente até o teste acabar.
  })
}

/** Derruba o `GET items/` com 500 — estado de erro (banner + retry). */
async function failItemsRequest(page: Page): Promise<void> {
  await page.route('**/api/brain-dump/items/', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue()
      return
    }
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"boom"}' })
  })
}

/**
 * Abre o Capture Sheet real (âncora no ponteiro, FAB no compact) e espera o
 * título assentar em foco — mesmo marcador de `shell-a11y.spec.ts`
 * (`openCaptureSheet`): o FocusTrap do Modal só foca o título ao FIM da
 * transição, medir antes é medir a animação.
 */
async function openCaptureSheet(page: Page, compact: boolean): Promise<void> {
  const trigger = compact
    ? page.getByRole('button', { name: 'Abrir captura rápida', exact: true })
    : mainNav(page).getByRole('button', { name: 'Abrir captura rápida', exact: true })
  await trigger.click()
  await expect(captureSheet(page)).toBeVisible()
  await expect(captureSheet(page).getByLabel(/Título/)).toBeFocused()
}

/**
 * O paper do `Drawer` (compact) que contém um `role="dialog"` com o nome dado
 * — composição LOCAL sobre `computed`/o padrão de `sheetPaper` de
 * `shellHelpers.ts` (que é escopado à `ShellNavigationSheet` e não serve aqui,
 * já que o Brain Dump abre outros diálogos/Drawers).
 */
function brainDumpDrawerPaper(page: Page, dialogName: string) {
  return page.locator('.MuiDrawer-paper').filter({ has: page.getByRole('dialog', { name: dialogName }) })
}

/**
 * Espera o slide de entrada do Drawer (compact) ASSENTAR — mesmo risco de
 * "verde falso" documentado em `shell-a11y.spec.ts`/`shellHelpers.
 * waitForSheetSettled`: medir logo após `toBeVisible()` pega o paper ainda
 * transladado.
 */
async function waitForBrainDumpDrawerSettled(page: Page, dialogName: string): Promise<void> {
  await expect
    .poll(async () => computed(brainDumpDrawerPaper(page, dialogName), 'transform'))
    .toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/)
}

/** Abre o sheet de edição do item (Dialog no ponteiro, Drawer no compact) pela linha. */
async function openItemSheet(page: Page, title: string, compact: boolean): Promise<void> {
  await itemRow(page, title).getByRole('button', { name: title, exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Item do Brain Dump' })).toBeVisible()
  if (compact) {
    await waitForBrainDumpDrawerSettled(page, 'Item do Brain Dump')
  } else {
    await waitForDialogSettled(page)
  }
}

/**
 * Abre o seletor de destino (Mover). No ponteiro, direto pelo botão trailing
 * da linha; no compact, pelo botão "Mover para um log" DENTRO do sheet de
 * edição (a linha não tem trailing nessa faixa — Design Notes da spec 15.1).
 */
async function openDestinationPicker(page: Page, title: string, compact: boolean): Promise<void> {
  if (compact) {
    await openItemSheet(page, title, true)
    await page
      .getByRole('dialog', { name: 'Item do Brain Dump' })
      .getByRole('button', { name: 'Mover para um log' })
      .click()
    // BD-AC-04 ("nunca empilham"): abrir o picker a partir do sheet de edição
    // precisa FECHAR o sheet, não empilhar um dialog em cima do outro — sem
    // esta asserção o helper só provava que o picker aparecia, nunca que o
    // sheet de edição realmente sumiu.
    await expect(page.getByRole('dialog', { name: 'Item do Brain Dump' })).toHaveCount(0)
  } else {
    await itemRow(page, title)
      .getByRole('button', { name: `Mover ${title}` })
      .click()
  }
  await expect(page.getByRole('dialog', { name: 'Para onde mover este item?' })).toBeVisible()
  if (compact) {
    await waitForBrainDumpDrawerSettled(page, 'Para onde mover este item?')
  } else {
    await waitForDialogSettled(page)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Matriz axe — estados do Inbox + overlays
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Matriz axe — wide 1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('wide · /brain-dump · vazio', async ({ page }) => {
    await gotoBrainDump(page)
    await expect(page.getByText('Brain Dump vazio.')).toBeVisible()
    await expectNoAxeViolations(page, { label: 'wide · /brain-dump · vazio' })
  })

  test('wide · /brain-dump · populado', async ({ page, email }) => {
    expect(seedBrainDumpItems(email, 3)).toBe(3)
    await gotoBrainDump(page)
    // As 3 linhas, não só a primeira (achado de review: uma truncagem da
    // lista para 1 item passaria despercebida se só o item 1 fosse checado).
    await expect(page.getByText('Item semeado 1')).toBeVisible()
    await expect(page.getByText('Item semeado 2')).toBeVisible()
    await expect(page.getByText('Item semeado 3')).toBeVisible()
    await expectNoAxeViolations(page, { label: 'wide · /brain-dump · populado' })
  })

  test('wide · /brain-dump · loading', async ({ page }) => {
    await holdItemsRequest(page)
    await gotoBrainDump(page)
    // Marcador estável: o skeleton é `aria-hidden` (decorativo); o que prova
    // "loading, não erro/sucesso" é o painel Capturar funcional e a ausência
    // do heading "Pendências" (só existe fora do branch `isPending`).
    await expect(capturePanel(page)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pendências' })).toHaveCount(0)
    await expectNoAxeViolations(page, { label: 'wide · /brain-dump · loading' })
  })

  test('wide · /brain-dump · error', async ({ page }) => {
    await failItemsRequest(page)
    await gotoBrainDump(page)
    await expect(page.getByRole('alert').filter({ hasText: READ_ERROR })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible()
    await expectNoAxeViolations(page, { label: 'wide · /brain-dump · error' })
  })

  test('wide · /brain-dump · offline', async ({ page, context, email }) => {
    // Semeado ANTES de ficar offline: sem isto, a asserção de "leitura já
    // carregada permanece" (BD-ST-05) nunca é exercida de verdade — o
    // inbox vazio não prova que dados PRÉ-CARREGADOS sobrevivem ao offline.
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    await expect(itemRow(page, 'Item semeado 1')).toBeVisible()

    // Preenchido ANTES de ficar offline (achado de review): sem isto, o
    // botão Capturar já estaria `disabled` pelo guard de título vazio
    // (`!title.trim()`), e a asserção abaixo provaria o guard errado, não o
    // efeito do offline.
    await page.getByRole('textbox', { name: 'Título' }).fill('Item de teste offline')

    await context.setOffline(true)
    // Marcador estável: o botão Capturar passa a `disabled` nativo (achado
    // já registrado como divergência low no checklist novo).
    await expect(page.getByRole('button', { name: 'Capturar' })).toBeDisabled()
    // Ação de escrita da LINHA também fica indisponível offline (achado de
    // review: só o botão Capturar era verificado, nunca as ações da linha).
    await expect(
      itemRow(page, 'Item semeado 1').getByRole('button', { name: 'Mover Item semeado 1' }),
    ).toBeDisabled()
    // A leitura já carregada permanece — o item semeado não some ao ficar
    // offline (só a ESCRITA fica indisponível).
    await expect(itemRow(page, 'Item semeado 1')).toBeVisible()
    await expectNoAxeViolations(page, { label: 'wide · /brain-dump · offline' })
  })

  test('wide · /brain-dump · Capture Sheet aberto pela âncora', async ({ page }) => {
    await gotoBrainDump(page)
    await openCaptureSheet(page, false)
    await expectNoAxeViolations(page, { label: 'wide · /brain-dump · Capture Sheet aberto' })
  })

  test('wide · /brain-dump · sheet de edição aberto', async ({ page, email }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    await openItemSheet(page, 'Item semeado 1', false)
    await expectNoAxeViolations(page, { label: 'wide · /brain-dump · sheet de edição' })
  })

  test('wide · /brain-dump · seletor de destino aberto', async ({ page, email }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    await openDestinationPicker(page, 'Item semeado 1', false)
    // Estado default (nenhum destino escolhido) — cobre o picker "fechado por
    // dentro"; a revelação de "Esta Semana" (radiogroup de dia, o controle
    // mais novo/complexo da superfície) é medida na célula seguinte.
    await expectNoAxeViolations(page, { label: 'wide · /brain-dump · seletor de destino' })
  })

  // Os sub-controles reais do picker (radiogroup de dia, `MonthDensityCalendar`,
  // input de mês) só existem depois de escolher Esta Semana/Este Mês/Futuro —
  // a célula acima nunca os monta. Esta célula revela "Esta Semana" e mede o
  // axe sobre o radiogroup de dia efetivamente exibido.
  test('wide · /brain-dump · seletor de destino — Esta Semana revela o radiogroup de dia', async ({
    page,
    email,
  }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    await openDestinationPicker(page, 'Item semeado 1', false)

    const picker = page.getByRole('dialog', { name: 'Para onde mover este item?' })
    await picker.getByRole('radio', { name: 'Esta Semana' }).click()
    const weekDays = picker.getByRole('radiogroup', { name: /^Dias de/ })
    await expect(weekDays.getByRole('radio').first()).toBeVisible()

    await expectNoAxeViolations(page, {
      label: 'wide · /brain-dump · seletor de destino — dia revelado',
    })
  })

  // Mesmo motivo da célula acima, para o OUTRO sub-controle revelado (achado
  // de review): `MonthDensityCalendar` e "Sem dia definido" só existem depois
  // de escolher Este Mês/Futuro — nunca eram montados nem escaneados.
  test('wide · /brain-dump · seletor de destino — Este Mês revela o calendário', async ({
    page,
    email,
  }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    await openDestinationPicker(page, 'Item semeado 1', false)

    const picker = page.getByRole('dialog', { name: 'Para onde mover este item?' })
    await picker.getByRole('radio', { name: 'Este Mês' }).click()
    await expect(picker.getByRole('table', { name: /^Densidade de tarefas de/ })).toBeVisible()
    await expect(picker.getByRole('button', { name: 'Sem dia definido' })).toBeVisible()

    await expectNoAxeViolations(page, {
      label: 'wide · /brain-dump · seletor de destino — calendário revelado',
    })
  })

  // I/O Matrix da spec: "offline (Inbox + Capture Sheet) com sheet FECHADO E
  // ABERTO" — offline com o sheet fechado já reprova abrir a captura (o
  // acionador vira aria-disabled, DIV-8); o cenário "sheet aberto" só existe
  // abrindo ENQUANTO online e then indo offline com ele já montado — o
  // `disabled`/`disabledReason` do `BrainDumpCaptureSheet` é ligado ao
  // `useOnlineStatus` ao vivo (`ShellLayout.tsx`), então os campos reagem.
  test('wide · /brain-dump · Capture Sheet aberto, depois offline', async ({ page, context }) => {
    await gotoBrainDump(page)
    await openCaptureSheet(page, false)

    await context.setOffline(true)

    await expect(captureSheet(page).getByLabel(/Título/)).toBeDisabled()
    await expect(captureSheet(page).getByText('Sem conexão. Esta ação exige rede.')).toBeVisible()
    await expect(captureSheet(page)).toBeVisible()

    await expectNoAxeViolations(page, {
      label: 'wide · /brain-dump · Capture Sheet aberto, depois offline',
    })
  })
})

test.describe('Matriz axe — medium 1280×800', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('medium · /brain-dump · vazio', async ({ page }) => {
    await gotoBrainDump(page)
    await expect(page.getByText('Brain Dump vazio.')).toBeVisible()
    await expectNoAxeViolations(page, { label: 'medium · /brain-dump · vazio' })
  })

  test('medium · /brain-dump · populado', async ({ page, email }) => {
    expect(seedBrainDumpItems(email, 3)).toBe(3)
    await gotoBrainDump(page)
    // As 3 linhas, não só a primeira (achado de review: uma truncagem da
    // lista para 1 item passaria despercebida se só o item 1 fosse checado).
    await expect(page.getByText('Item semeado 1')).toBeVisible()
    await expect(page.getByText('Item semeado 2')).toBeVisible()
    await expect(page.getByText('Item semeado 3')).toBeVisible()
    await expectNoAxeViolations(page, { label: 'medium · /brain-dump · populado' })
  })

  test('medium · /brain-dump · loading', async ({ page }) => {
    await holdItemsRequest(page)
    await gotoBrainDump(page)
    await expect(capturePanel(page)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pendências' })).toHaveCount(0)
    await expectNoAxeViolations(page, { label: 'medium · /brain-dump · loading' })
  })

  test('medium · /brain-dump · error', async ({ page }) => {
    await failItemsRequest(page)
    await gotoBrainDump(page)
    await expect(page.getByRole('alert').filter({ hasText: READ_ERROR })).toBeVisible()
    await expectNoAxeViolations(page, { label: 'medium · /brain-dump · error' })
  })

  test('medium · /brain-dump · offline', async ({ page, context, email }) => {
    // Mesmo achado de review da célula wide: sem semear, a asserção de
    // "leitura já carregada permanece" (BD-ST-05) nunca é exercida.
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    await expect(itemRow(page, 'Item semeado 1')).toBeVisible()

    await page.getByRole('textbox', { name: 'Título' }).fill('Item de teste offline')

    await context.setOffline(true)
    await expect(page.getByRole('button', { name: 'Capturar' })).toBeDisabled()
    await expect(
      itemRow(page, 'Item semeado 1').getByRole('button', { name: 'Mover Item semeado 1' }),
    ).toBeDisabled()
    await expect(itemRow(page, 'Item semeado 1')).toBeVisible()
    await expectNoAxeViolations(page, { label: 'medium · /brain-dump · offline' })
  })

  // AC2 da spec: wide/medium/compact × (estados base + Capture Sheet + sheet
  // de edição + seletor de destino) — as 3 células abaixo fecham o gap desta
  // faixa, espelhando as equivalentes de wide/compact.
  test('medium · /brain-dump · Capture Sheet aberto pela âncora', async ({ page }) => {
    await gotoBrainDump(page)
    await openCaptureSheet(page, false)
    await expectNoAxeViolations(page, { label: 'medium · /brain-dump · Capture Sheet aberto' })
  })

  test('medium · /brain-dump · sheet de edição aberto', async ({ page, email }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    await openItemSheet(page, 'Item semeado 1', false)
    await expectNoAxeViolations(page, { label: 'medium · /brain-dump · sheet de edição' })
  })

  test('medium · /brain-dump · seletor de destino aberto', async ({ page, email }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    await openDestinationPicker(page, 'Item semeado 1', false)
    await expectNoAxeViolations(page, { label: 'medium · /brain-dump · seletor de destino' })
  })

  // Mesmo achado de review das células wide equivalentes: os sub-controles
  // revelados do picker (radiogroup de dia, `MonthDensityCalendar`) só eram
  // montados/escaneados em wide — nunca em medium.
  test('medium · /brain-dump · seletor de destino — Esta Semana revela o radiogroup de dia', async ({
    page,
    email,
  }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    await openDestinationPicker(page, 'Item semeado 1', false)

    const picker = page.getByRole('dialog', { name: 'Para onde mover este item?' })
    await picker.getByRole('radio', { name: 'Esta Semana' }).click()
    const weekDays = picker.getByRole('radiogroup', { name: /^Dias de/ })
    await expect(weekDays.getByRole('radio').first()).toBeVisible()

    await expectNoAxeViolations(page, {
      label: 'medium · /brain-dump · seletor de destino — dia revelado',
    })
  })

  test('medium · /brain-dump · seletor de destino — Este Mês revela o calendário', async ({
    page,
    email,
  }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    await openDestinationPicker(page, 'Item semeado 1', false)

    const picker = page.getByRole('dialog', { name: 'Para onde mover este item?' })
    await picker.getByRole('radio', { name: 'Este Mês' }).click()
    await expect(picker.getByRole('table', { name: /^Densidade de tarefas de/ })).toBeVisible()
    await expect(picker.getByRole('button', { name: 'Sem dia definido' })).toBeVisible()

    await expectNoAxeViolations(page, {
      label: 'medium · /brain-dump · seletor de destino — calendário revelado',
    })
  })

  // Mesmo achado de review da célula wide equivalente: a faixa medium nunca
  // teve o cenário "sheet aberto, depois offline" coberto.
  test('medium · /brain-dump · Capture Sheet aberto, depois offline', async ({ page, context }) => {
    await gotoBrainDump(page)
    await openCaptureSheet(page, false)

    await context.setOffline(true)

    await expect(captureSheet(page).getByLabel(/Título/)).toBeDisabled()
    await expect(captureSheet(page).getByText('Sem conexão. Esta ação exige rede.')).toBeVisible()
    await expect(captureSheet(page)).toBeVisible()

    await expectNoAxeViolations(page, {
      label: 'medium · /brain-dump · Capture Sheet aberto, depois offline',
    })
  })
})

test.describe('Matriz axe — compact 390×720', () => {
  test.use({ viewport: { width: 390, height: 720 } })

  test('compact 390 · /brain-dump · vazio', async ({ page }) => {
    await gotoBrainDump(page)
    await expect(page.getByText('Brain Dump vazio.')).toBeVisible()
    await expectNoAxeViolations(page, { label: 'compact 390 · /brain-dump · vazio' })
  })

  test('compact 390 · /brain-dump · populado', async ({ page, email }) => {
    expect(seedBrainDumpItems(email, 3)).toBe(3)
    await gotoBrainDump(page)
    // As 3 linhas, não só a primeira (achado de review: uma truncagem da
    // lista para 1 item passaria despercebida se só o item 1 fosse checado).
    await expect(page.getByText('Item semeado 1')).toBeVisible()
    await expect(page.getByText('Item semeado 2')).toBeVisible()
    await expect(page.getByText('Item semeado 3')).toBeVisible()
    await expectNoAxeViolations(page, { label: 'compact 390 · /brain-dump · populado' })
  })

  test('compact 390 · /brain-dump · loading', async ({ page }) => {
    await holdItemsRequest(page)
    await gotoBrainDump(page)
    await expect(capturePanel(page)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pendências' })).toHaveCount(0)
    await expectNoAxeViolations(page, { label: 'compact 390 · /brain-dump · loading' })
  })

  test('compact 390 · /brain-dump · error', async ({ page }) => {
    await failItemsRequest(page)
    await gotoBrainDump(page)
    await expect(page.getByRole('alert').filter({ hasText: READ_ERROR })).toBeVisible()
    await expectNoAxeViolations(page, { label: 'compact 390 · /brain-dump · error' })
  })

  test('compact 390 · /brain-dump · offline', async ({ page, context, email }) => {
    // Mesmo achado de review da célula wide: sem semear, a asserção de
    // "leitura já carregada permanece" (BD-ST-05) nunca é exercida. Sem
    // asserção de ação de linha aqui: no compact `trailingSlot` é ausente
    // (Design Notes 15.1) — Mover/Descartar só existem dentro do sheet de
    // edição, coberto por `openDestinationPicker`/`openItemSheet` em outras
    // células.
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    await expect(itemRow(page, 'Item semeado 1')).toBeVisible()

    await page.getByRole('textbox', { name: 'Título' }).fill('Item de teste offline')

    await context.setOffline(true)
    await expect(page.getByRole('button', { name: 'Capturar' })).toBeDisabled()
    await expect(itemRow(page, 'Item semeado 1')).toBeVisible()
    await expectNoAxeViolations(page, { label: 'compact 390 · /brain-dump · offline' })
  })

  test('compact 390 · /brain-dump · Capture Sheet aberto pelo FAB', async ({ page }) => {
    await gotoBrainDump(page)
    await openCaptureSheet(page, true)
    await expectNoAxeViolations(page, { label: 'compact 390 · /brain-dump · Capture Sheet aberto' })
  })

  test('compact 390 · /brain-dump · sheet de edição aberto', async ({ page, email }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    await openItemSheet(page, 'Item semeado 1', true)
    await expectNoAxeViolations(page, { label: 'compact 390 · /brain-dump · sheet de edição' })
  })

  test('compact 390 · /brain-dump · seletor de destino aberto', async ({ page, email }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    await openDestinationPicker(page, 'Item semeado 1', true)
    await expectNoAxeViolations(page, { label: 'compact 390 · /brain-dump · seletor de destino' })
  })

  // Mesmo achado de review das células wide/medium equivalentes: os
  // sub-controles revelados do picker nunca eram montados/escaneados nesta
  // faixa.
  test('compact 390 · /brain-dump · seletor de destino — Esta Semana revela o radiogroup de dia', async ({
    page,
    email,
  }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    await openDestinationPicker(page, 'Item semeado 1', true)

    const picker = page.getByRole('dialog', { name: 'Para onde mover este item?' })
    await picker.getByRole('radio', { name: 'Esta Semana' }).click()
    const weekDays = picker.getByRole('radiogroup', { name: /^Dias de/ })
    await expect(weekDays.getByRole('radio').first()).toBeVisible()

    await expectNoAxeViolations(page, {
      label: 'compact 390 · /brain-dump · seletor de destino — dia revelado',
    })
  })

  test('compact 390 · /brain-dump · seletor de destino — Este Mês revela o calendário', async ({
    page,
    email,
  }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    await openDestinationPicker(page, 'Item semeado 1', true)

    const picker = page.getByRole('dialog', { name: 'Para onde mover este item?' })
    await picker.getByRole('radio', { name: 'Este Mês' }).click()
    await expect(picker.getByRole('table', { name: /^Densidade de tarefas de/ })).toBeVisible()
    await expect(picker.getByRole('button', { name: 'Sem dia definido' })).toBeVisible()

    await expectNoAxeViolations(page, {
      label: 'compact 390 · /brain-dump · seletor de destino — calendário revelado',
    })
  })

  // Mesmo cenário da célula wide equivalente, nunca antes espelhado para o
  // Drawer (achado de review): o `disabled`/`disabledReason` do
  // `BrainDumpCaptureSheet` é ligado ao `useOnlineStatus` ao vivo
  // (`ShellLayout.tsx`) em QUALQUER faixa, mas só o Dialog tinha cobertura.
  test('compact 390 · /brain-dump · Capture Sheet aberto, depois offline', async ({ page, context }) => {
    await gotoBrainDump(page)
    await openCaptureSheet(page, true)

    await context.setOffline(true)

    await expect(captureSheet(page).getByLabel(/Título/)).toBeDisabled()
    await expect(captureSheet(page).getByText('Sem conexão. Esta ação exige rede.')).toBeVisible()
    await expect(captureSheet(page)).toBeVisible()

    await expectNoAxeViolations(page, {
      label: 'compact 390 · /brain-dump · Capture Sheet aberto, depois offline',
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Teclado — confirmação em browser real do que já é unit-testado (jsdom)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Teclado', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('ordem de Tab: Capturar → Pendências → linha → ações', async ({ page, email }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    // Marcador estável ANTES de tabular: sem isto, o `GET items/` inicial pode
    // resolver NO MEIO da sequência de Tab, trocando o skeleton (sem nenhum
    // controle focável) pela lista real — a linha some debaixo do cursor de
    // foco, o Tab não acha próximo elemento e o browser reseta para `<body>`
    // (o Tab seguinte reinicia do topo, no skip link). Vermelho falso real,
    // reproduzido ao montar este teste — mesmo risco #5 documentado em
    // `shell-a11y.spec.ts`.
    await expect(itemRow(page, 'Item semeado 1')).toBeVisible()

    // Foco inicial no Título do painel Capturar (Task 10.2, paridade com o legado).
    // Sem `.first()` (achado de review): o Capture Sheet fica DESMONTADO
    // enquanto fechado (MUI `open={false}` sem `keepMounted`), então "Título"
    // é único no DOM agora — usar `.first()` aqui suprimiria o check de
    // duplicata do modo estrito do Playwright, mascarando uma futura
    // regressão que vazasse um segundo campo "Título" no DOM.
    const titulo = page.getByRole('textbox', { name: 'Título' })
    await expect(titulo).toBeFocused()
    // O botão Capturar só entra na sequência de Tab HABILITADO (título
    // preenchido) — vazio ele é `disabled` e o browser o PULA (tabindex
    // implícito -1), então preencher é parte do cenário real, não um atalho.
    await titulo.fill('Item de teste da ordem de Tab')

    await page.keyboard.press('Tab') // Descrição
    await expect(page.getByRole('textbox', { name: 'Descrição' })).toBeFocused()

    await page.keyboard.press('Tab') // Destino (combobox do painel Capturar)
    await expect(page.getByRole('combobox', { name: 'Destino' })).toBeFocused()

    await page.keyboard.press('Tab') // Botão Capturar
    await expect(page.getByRole('button', { name: 'Capturar' })).toBeFocused()

    await page.keyboard.press('Tab') // Linha (título é um controle real — onActivate)
    await expect(
      itemRow(page, 'Item semeado 1').getByRole('button', { name: 'Item semeado 1', exact: true }),
    ).toBeFocused()

    await page.keyboard.press('Tab') // Ação Mover
    await expect(page.getByRole('button', { name: 'Mover Item semeado 1' })).toBeFocused()

    await page.keyboard.press('Tab') // Ação Descartar
    await expect(page.getByRole('button', { name: 'Descartar Item semeado 1' })).toBeFocused()
  })

  test('Escape fecha o Capture Sheet e devolve o foco ao acionador', async ({ page }) => {
    await gotoBrainDump(page)
    const anchor = mainNav(page).getByRole('button', { name: 'Abrir captura rápida', exact: true })
    await openCaptureSheet(page, false)

    await page.keyboard.press('Escape')

    await expect(captureSheet(page)).toHaveCount(0)
    await expect(anchor).toBeFocused()
  })

  test('Escape fecha o sheet de edição (sem alteração) e devolve o foco à linha', async ({
    page,
    email,
  }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    const trigger = itemRow(page, 'Item semeado 1').getByRole('button', {
      name: 'Item semeado 1',
      exact: true,
    })
    await openItemSheet(page, 'Item semeado 1', false)

    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog', { name: 'Item do Brain Dump' })).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })

  test('Escape fecha o seletor de destino e devolve o foco ao acionador', async ({ page, email }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    const trigger = itemRow(page, 'Item semeado 1').getByRole('button', {
      name: 'Mover Item semeado 1',
    })
    await openDestinationPicker(page, 'Item semeado 1', false)

    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog', { name: 'Para onde mover este item?' })).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })
})

// O Drawer (compact) é uma implementação de FocusTrap DIFERENTE do Dialog
// (ponteiro) — Escape/restauração de foco nunca tinham sido verificados em
// browser real nessa faixa. Espelha os 3 testes de `Teclado` acima, trocando
// só o trigger/helper para a variante compact.
test.describe('Teclado (compact)', () => {
  test.use({ viewport: { width: 390, height: 720 } })

  test('ordem de Tab: Capturar → Pendências → linha (compact, sem trailingSlot)', async ({
    page,
    email,
  }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    await expect(itemRow(page, 'Item semeado 1')).toBeVisible()

    const titulo = page.getByRole('textbox', { name: 'Título' })
    await expect(titulo).toBeFocused()
    await titulo.fill('Item de teste da ordem de Tab (compact)')

    await page.keyboard.press('Tab') // Descrição
    await expect(page.getByRole('textbox', { name: 'Descrição' })).toBeFocused()

    await page.keyboard.press('Tab') // Destino (combobox do painel Capturar)
    await expect(page.getByRole('combobox', { name: 'Destino' })).toBeFocused()

    await page.keyboard.press('Tab') // Botão Capturar
    await expect(page.getByRole('button', { name: 'Capturar' })).toBeFocused()

    // No compact `trailingSlot` é ausente (Design Notes 15.1) — a linha
    // INTEIRA é o próximo (e único) parada de Tab, sem Mover/Descartar
    // separados (esses migram para o sheet de edição).
    await page.keyboard.press('Tab') // Linha
    await expect(
      itemRow(page, 'Item semeado 1').getByRole('button', { name: 'Item semeado 1', exact: true }),
    ).toBeFocused()
  })

  test('Escape fecha o Capture Sheet (Drawer, FAB) e devolve o foco ao acionador', async ({ page }) => {
    await gotoBrainDump(page)
    const fab = page.getByRole('button', { name: 'Abrir captura rápida', exact: true })
    await openCaptureSheet(page, true)

    await page.keyboard.press('Escape')

    await expect(captureSheet(page)).toHaveCount(0)
    await expect(fab).toBeFocused()
  })

  test('Escape fecha o sheet de edição (Drawer, sem alteração) e devolve o foco à linha', async ({
    page,
    email,
  }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    const trigger = itemRow(page, 'Item semeado 1').getByRole('button', {
      name: 'Item semeado 1',
      exact: true,
    })
    await openItemSheet(page, 'Item semeado 1', true)

    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog', { name: 'Item do Brain Dump' })).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })

  test('Escape fecha o seletor de destino (Drawer, aberto a partir do sheet) e devolve o foco à linha', async ({
    page,
    email,
  }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    // No compact o picker abre a partir do sheet de edição (Design Notes da
    // spec 15.1): `movingTriggerRef` herda o acionador ORIGINAL da linha, não
    // o botão "Mover para um log" (que desmonta junto com o sheet) — o foco
    // volta para a LINHA, não para um controle já ausente do DOM.
    const trigger = itemRow(page, 'Item semeado 1').getByRole('button', {
      name: 'Item semeado 1',
      exact: true,
    })
    await openDestinationPicker(page, 'Item semeado 1', true)

    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog', { name: 'Para onde mover este item?' })).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Disabled em voo — botão indisponível + `aria-busy`, sem duplo submit (I/O
// Matrix da spec). O guard "Enter repetido não duplica" já é unit-testado
// (`BrainDumpCaptureSheet.test.tsx`); esta célula confirma em BROWSER REAL o
// estado `aria-busy`/botão desabilitado durante o envio.
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Disabled em voo', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('Capture Sheet: Salvar em voo fica aria-busy e desabilitado, sem 2ª requisição', async ({
    page,
  }) => {
    await gotoBrainDump(page)
    let createCalls = 0
    await page.route('**/api/brain-dump/items/', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      createCalls += 1
      // Segura a resposta por uma janela real — tempo suficiente para
      // observar `aria-busy`/botão desabilitado ANTES da criação resolver.
      await new Promise((resolve) => setTimeout(resolve, 500))
      await route.continue()
    })

    await openCaptureSheet(page, false)
    await captureSheet(page).getByLabel(/Título/).fill('Item em voo')
    // Locator ESTÁVEL (`type=submit`), não pelo nome — o próprio texto do
    // botão muda para "Salvando…" assim que o envio começa, então um locator
    // por `name: 'Salvar no Brain Dump'` deixaria de casar exatamente no
    // instante que este teste precisa medir.
    const salvar = captureSheet(page).locator('button[type="submit"]')
    await expect(salvar).toHaveText('Salvar no Brain Dump')
    await salvar.click()

    await expect(captureSheet(page)).toHaveAttribute('aria-busy', 'true')
    await expect(salvar).toBeDisabled()
    await expect(salvar).toHaveText('Salvando…')

    await expect(captureSheet(page)).toHaveCount(0, { timeout: 10_000 })
    expect(createCalls).toBe(1)
  })

  // I/O Matrix: "criar/mover/descartar pendente" — só "criar" tinha cobertura
  // browser-real até esta rodada (achado de review). O botão de confirmação
  // do seletor de destino já computa `disabled={disabled ||
  // processItem.isPending}` em produção (`BrainDumpDestinationPicker.tsx`),
  // mas isso nunca foi verificado em browser real.
  test('Seletor de destino: confirmar "Hoje" em voo fica desabilitado, sem 2ª requisição', async ({
    page,
    email,
  }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    let moveCalls = 0
    await page.route('**/api/brain-dump/items/*/process/', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      moveCalls += 1
      await new Promise((resolve) => setTimeout(resolve, 500))
      await route.continue()
    })

    await openDestinationPicker(page, 'Item semeado 1', false)
    const picker = page.getByRole('dialog', { name: 'Para onde mover este item?' })
    await picker.getByRole('radio', { name: 'Hoje' }).click()
    const confirmar = picker.getByRole('button', { name: 'Mover para hoje' })
    await expect(confirmar).toBeVisible()
    await confirmar.click()

    await expect(confirmar).toBeDisabled()
    await expect(picker).toHaveCount(0, { timeout: 10_000 })
    expect(moveCalls).toBe(1)
  })

  // Mesmo motivo acima, para "descartar": o botão trailing da linha já
  // computa `discarding={discardItem.isPending && ...}`
  // (`BrainDumpInboxPage.tsx`), nunca verificado em browser real.
  test('Linha: Descartar em voo fica desabilitado, sem 2ª requisição', async ({ page, email }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    let discardCalls = 0
    await page.route('**/api/brain-dump/items/*/', async (route) => {
      if (route.request().method() !== 'DELETE') {
        await route.continue()
        return
      }
      discardCalls += 1
      await new Promise((resolve) => setTimeout(resolve, 500))
      await route.continue()
    })

    const descartar = itemRow(page, 'Item semeado 1').getByRole('button', {
      name: 'Descartar Item semeado 1',
    })
    await descartar.click()

    await expect(descartar).toBeDisabled()
    await expect(itemRow(page, 'Item semeado 1')).toHaveCount(0, { timeout: 10_000 })
    expect(discardCalls).toBe(1)
  })
})

// O Drawer (compact/FAB) é a mesma `BrainDumpCaptureSheet` do teste acima,
// mas nunca tinha sido medido nessa variante em browser real (achado de
// review) — `aria-busy` é escrito incondicionalmente no mesmo `content`
// compartilhado pelas duas variantes, mas só o Dialog (ponteiro) tinha
// cobertura.
test.describe('Disabled em voo (compact)', () => {
  test.use({ viewport: { width: 390, height: 720 } })

  test('Capture Sheet (Drawer, FAB): Salvar em voo fica aria-busy e desabilitado, sem 2ª requisição', async ({
    page,
  }) => {
    await gotoBrainDump(page)
    let createCalls = 0
    await page.route('**/api/brain-dump/items/', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      createCalls += 1
      await new Promise((resolve) => setTimeout(resolve, 500))
      await route.continue()
    })

    await openCaptureSheet(page, true)
    await captureSheet(page).getByLabel(/Título/).fill('Item em voo (compact)')
    const salvar = captureSheet(page).locator('button[type="submit"]')
    await expect(salvar).toHaveText('Salvar no Brain Dump')
    await salvar.click()

    await expect(captureSheet(page)).toHaveAttribute('aria-busy', 'true')
    await expect(salvar).toBeDisabled()
    await expect(salvar).toHaveText('Salvando…')

    await expect(captureSheet(page)).toHaveCount(0, { timeout: 10_000 })
    expect(createCalls).toBe(1)
  })

  // Mesmo achado de review da célula wide equivalente — o seletor de destino
  // é o MESMO componente nas duas faixas (só o caminho de abertura muda:
  // pelo sheet de edição no compact), então o `processItem.isPending`
  // também deveria desabilitar o confirmar aqui, mas nunca fora medido
  // nesta variante.
  test('Seletor de destino (a partir do sheet): confirmar "Hoje" em voo fica desabilitado, sem 2ª requisição', async ({
    page,
    email,
  }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    let moveCalls = 0
    await page.route('**/api/brain-dump/items/*/process/', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      moveCalls += 1
      await new Promise((resolve) => setTimeout(resolve, 500))
      await route.continue()
    })

    await openDestinationPicker(page, 'Item semeado 1', true)
    const picker = page.getByRole('dialog', { name: 'Para onde mover este item?' })
    await picker.getByRole('radio', { name: 'Hoje' }).click()
    const confirmar = picker.getByRole('button', { name: 'Mover para hoje' })
    await expect(confirmar).toBeVisible()
    await confirmar.click()

    await expect(confirmar).toBeDisabled()
    await expect(picker).toHaveCount(0, { timeout: 10_000 })
    expect(moveCalls).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Touch target ≥44px (`--ds-touch-target-min`)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Touch target — wide 1440×900 (ponteiro)', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('linha: ações Mover/Descartar atingem --ds-touch-target-min', async ({ page, email }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    const min = await dsTokenPx(page, '--ds-touch-target-min')

    const row = itemRow(page, 'Item semeado 1')
    for (const name of ['Mover Item semeado 1', 'Descartar Item semeado 1']) {
      const box = await row.getByRole('button', { name }).boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(min)
    }
  })

  test('Capture Sheet: Fechar/Salvar/Cancelar atingem --ds-touch-target-min', async ({ page }) => {
    await gotoBrainDump(page)
    const min = await dsTokenPx(page, '--ds-touch-target-min')
    await openCaptureSheet(page, false)

    for (const name of ['Fechar', 'Salvar no Brain Dump', 'Cancelar']) {
      const box = await captureSheet(page).getByRole('button', { name }).boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(min)
    }
  })

  test('sheet de edição: Fechar/Salvar atingem --ds-touch-target-min', async ({ page, email }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    const min = await dsTokenPx(page, '--ds-touch-target-min')
    await openItemSheet(page, 'Item semeado 1', false)

    const sheet = page.getByRole('dialog', { name: 'Item do Brain Dump' })
    for (const name of ['Fechar', 'Salvar']) {
      const box = await sheet.getByRole('button', { name }).boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(min)
    }
  })

  test('seletor de destino: opções (radiogroup), Fechar e o radiogroup de dia (Esta Semana) atingem --ds-touch-target-min', async ({
    page,
    email,
  }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    const min = await dsTokenPx(page, '--ds-touch-target-min')
    await openDestinationPicker(page, 'Item semeado 1', false)

    const picker = page.getByRole('dialog', { name: 'Para onde mover este item?' })
    for (const name of ['Hoje', 'Esta Semana', 'Este Mês', 'Futuro']) {
      const box = await picker.getByRole('radio', { name }).boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(min)
    }
    const closeBox = await picker.getByRole('button', { name: 'Fechar' }).boundingBox()
    expect(closeBox).not.toBeNull()
    expect(closeBox!.height).toBeGreaterThanOrEqual(min)

    // Sub-controle revelado (achado do review): o radiogroup de dia só
    // existe depois de escolher "Esta Semana" — nunca era medido antes.
    await picker.getByRole('radio', { name: 'Esta Semana' }).click()
    const weekDays = picker.getByRole('radiogroup', { name: /^Dias de/ })
    const dayBox = await weekDays.getByRole('radio').first().boundingBox()
    expect(dayBox).not.toBeNull()
    expect(dayBox!.height).toBeGreaterThanOrEqual(min)
  })

  // "Sem dia definido" só existe depois de escolher Esta Semana/Este
  // Mês/Futuro (achado de review) — nunca era medido antes. O outro
  // sub-controle revelado por Este Mês/Futuro (as CÉLULAS do
  // `MonthDensityCalendar`) usa `minHeight: 40` LITERAL no componente
  // compartilhado, abaixo de `--ds-touch-target-min` (44px) — gap PRÉ-
  // EXISTENTE fora do Code Map desta story (componente cross-epic, Story
  // 11.3), registrado como divergência nova (DIV-BD-19) em vez de medido
  // aqui, para não afirmar uma asserção que reprovaria por um componente que
  // esta story não está autorizada a alterar.
  test('seletor de destino: "Sem dia definido" atinge --ds-touch-target-min', async ({
    page,
    email,
  }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    const min = await dsTokenPx(page, '--ds-touch-target-min')
    await openDestinationPicker(page, 'Item semeado 1', false)

    const picker = page.getByRole('dialog', { name: 'Para onde mover este item?' })
    await picker.getByRole('radio', { name: 'Este Mês' }).click()
    const box = await picker.getByRole('button', { name: 'Sem dia definido' }).boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(min)
  })

  // O input nativo revelado por "Futuro" (`aria-label="Mês"`) nunca era
  // medido — único sub-controle de "Futuro" ainda sem cobertura de
  // touch-target (achado de review).
  test('seletor de destino: input de Mês ("Futuro") atinge --ds-touch-target-min', async ({
    page,
    email,
  }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    const min = await dsTokenPx(page, '--ds-touch-target-min')
    await openDestinationPicker(page, 'Item semeado 1', false)

    const picker = page.getByRole('dialog', { name: 'Para onde mover este item?' })
    await picker.getByRole('radio', { name: 'Futuro' }).click()
    const box = await picker.getByLabel('Mês').boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(min)
  })
})

test.describe('Touch target — medium 1280×800 (ponteiro)', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  // Faixa inteira ausente até esta rodada (achado de review): o Approach da
  // spec pede a matriz de touch-target dedicada em wide/medium/compact, mas
  // só wide/compact tinham describe próprio. Espelha wide 1:1 (medium é
  // "ponteiro" como wide — mesmo trailingSlot na linha, mesmo Cancelar no
  // Capture Sheet).
  test('linha: ações Mover/Descartar atingem --ds-touch-target-min', async ({ page, email }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    const min = await dsTokenPx(page, '--ds-touch-target-min')

    const row = itemRow(page, 'Item semeado 1')
    for (const name of ['Mover Item semeado 1', 'Descartar Item semeado 1']) {
      const box = await row.getByRole('button', { name }).boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(min)
    }
  })

  test('Capture Sheet: Fechar/Salvar/Cancelar atingem --ds-touch-target-min', async ({ page }) => {
    await gotoBrainDump(page)
    const min = await dsTokenPx(page, '--ds-touch-target-min')
    await openCaptureSheet(page, false)

    for (const name of ['Fechar', 'Salvar no Brain Dump', 'Cancelar']) {
      const box = await captureSheet(page).getByRole('button', { name }).boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(min)
    }
  })

  test('sheet de edição: Fechar/Salvar atingem --ds-touch-target-min', async ({ page, email }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    const min = await dsTokenPx(page, '--ds-touch-target-min')
    await openItemSheet(page, 'Item semeado 1', false)

    const sheet = page.getByRole('dialog', { name: 'Item do Brain Dump' })
    for (const name of ['Fechar', 'Salvar']) {
      const box = await sheet.getByRole('button', { name }).boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(min)
    }
  })

  test('seletor de destino: opções (radiogroup), Fechar e o radiogroup de dia (Esta Semana) atingem --ds-touch-target-min', async ({
    page,
    email,
  }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    const min = await dsTokenPx(page, '--ds-touch-target-min')
    await openDestinationPicker(page, 'Item semeado 1', false)

    const picker = page.getByRole('dialog', { name: 'Para onde mover este item?' })
    for (const name of ['Hoje', 'Esta Semana', 'Este Mês', 'Futuro']) {
      const box = await picker.getByRole('radio', { name }).boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(min)
    }
    const closeBox = await picker.getByRole('button', { name: 'Fechar' }).boundingBox()
    expect(closeBox).not.toBeNull()
    expect(closeBox!.height).toBeGreaterThanOrEqual(min)

    await picker.getByRole('radio', { name: 'Esta Semana' }).click()
    const weekDays = picker.getByRole('radiogroup', { name: /^Dias de/ })
    const dayBox = await weekDays.getByRole('radio').first().boundingBox()
    expect(dayBox).not.toBeNull()
    expect(dayBox!.height).toBeGreaterThanOrEqual(min)
  })

  test('seletor de destino: "Sem dia definido" atinge --ds-touch-target-min', async ({
    page,
    email,
  }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    const min = await dsTokenPx(page, '--ds-touch-target-min')
    await openDestinationPicker(page, 'Item semeado 1', false)

    const picker = page.getByRole('dialog', { name: 'Para onde mover este item?' })
    await picker.getByRole('radio', { name: 'Este Mês' }).click()
    const box = await picker.getByRole('button', { name: 'Sem dia definido' }).boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(min)
  })

  test('seletor de destino: input de Mês ("Futuro") atinge --ds-touch-target-min', async ({
    page,
    email,
  }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    const min = await dsTokenPx(page, '--ds-touch-target-min')
    await openDestinationPicker(page, 'Item semeado 1', false)

    const picker = page.getByRole('dialog', { name: 'Para onde mover este item?' })
    await picker.getByRole('radio', { name: 'Futuro' }).click()
    const box = await picker.getByLabel('Mês').boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(min)
  })
})

test.describe('Touch target — compact 390×720', () => {
  test.use({ viewport: { width: 390, height: 720 } })

  test('Capture Sheet: Fechar/Salvar atingem --ds-touch-target-min', async ({ page }) => {
    await gotoBrainDump(page)
    const min = await dsTokenPx(page, '--ds-touch-target-min')
    await openCaptureSheet(page, true)

    for (const name of ['Fechar', 'Salvar no Brain Dump']) {
      const box = await captureSheet(page).getByRole('button', { name }).boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(min)
    }
  })

  test('sheet de edição: Fechar/Salvar/Mover para um log/Descartar item atingem --ds-touch-target-min', async ({
    page,
    email,
  }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    const min = await dsTokenPx(page, '--ds-touch-target-min')
    await openItemSheet(page, 'Item semeado 1', true)

    const sheet = page.getByRole('dialog', { name: 'Item do Brain Dump' })
    for (const name of ['Fechar', 'Salvar', 'Mover para um log', 'Descartar item']) {
      const box = await sheet.getByRole('button', { name }).boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(min)
    }
  })

  test('seletor de destino: opções (radiogroup), Fechar e o radiogroup de dia (Esta Semana) atingem --ds-touch-target-min', async ({
    page,
    email,
  }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    const min = await dsTokenPx(page, '--ds-touch-target-min')
    await openDestinationPicker(page, 'Item semeado 1', true)

    const picker = page.getByRole('dialog', { name: 'Para onde mover este item?' })
    for (const name of ['Hoje', 'Esta Semana', 'Este Mês', 'Futuro']) {
      const box = await picker.getByRole('radio', { name }).boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(min)
    }
    const closeBox = await picker.getByRole('button', { name: 'Fechar' }).boundingBox()
    expect(closeBox).not.toBeNull()
    expect(closeBox!.height).toBeGreaterThanOrEqual(min)

    // Mesmo sub-controle revelado medido na célula wide equivalente (achado
    // de review): a variante compact nunca clicava em "Esta Semana", então o
    // radiogroup de dia nunca era medido nesta faixa.
    await picker.getByRole('radio', { name: 'Esta Semana' }).click()
    const weekDays = picker.getByRole('radiogroup', { name: /^Dias de/ })
    const dayBox = await weekDays.getByRole('radio').first().boundingBox()
    expect(dayBox).not.toBeNull()
    expect(dayBox!.height).toBeGreaterThanOrEqual(min)
  })

  // Mesmo achado de review das células wide/medium equivalentes: o input
  // nativo revelado por "Futuro" nunca era medido.
  test('seletor de destino: input de Mês ("Futuro") atinge --ds-touch-target-min', async ({
    page,
    email,
  }) => {
    expect(seedBrainDumpItems(email, 1)).toBe(1)
    await gotoBrainDump(page)
    const min = await dsTokenPx(page, '--ds-touch-target-min')
    await openDestinationPicker(page, 'Item semeado 1', true)

    const picker = page.getByRole('dialog', { name: 'Para onde mover este item?' })
    await picker.getByRole('radio', { name: 'Futuro' }).click()
    const box = await picker.getByLabel('Mês').boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(min)
  })
})
