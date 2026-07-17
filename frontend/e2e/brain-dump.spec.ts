import { test, expect, signUpAndLandOnToday } from './fixtures'

// Cobre a Story 5.1 (Brain Dump — caixa de entrada e processamento manual)
// ponta-a-ponta contra o backend real: captura via formulário sempre visível
// no topo de `/brain-dump` (AC3), listagem/estado vazio (AC1), e
// processamento manual que cria a `Task` de destino e remove o item da caixa
// — sem migração automática (AC2). Complementa os testes unitários de
// `braindump/services.py`/`views.py` e dos componentes React (que simulam a
// API via mock): aqui valida-se o fluxo real, incluindo a Task aparecendo no
// Daily Log de hoje após o processamento.

test('Brain Dump vazio para usuário novo mostra o estado vazio (AC1)', async ({ page }) => {
  await page.getByRole('button', { name: 'Brain Dump' }).click()

  await expect(page.getByRole('main', { name: 'Brain Dump', exact: true })).toBeVisible()
  await expect(page.getByText('Brain Dump vazio.')).toBeVisible()
})

test('captura, processa para Hoje e descarta um item, sem afetar o comportamento de captura por target_log (AC1, AC2, AC3)', async ({
  page,
}) => {
  test.setTimeout(60_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.getByRole('button', { name: 'Brain Dump' }).click()
  await expect(page.getByRole('main', { name: 'Brain Dump', exact: true })).toBeVisible()

  // Captura só com título — item aparece na lista.
  await page.getByRole('textbox', { name: 'Título' }).fill('Ideia solta sem destino')
  await page.getByRole('button', { name: 'Capturar' }).click()
  await expect(page.getByText('Ideia solta sem destino')).toBeVisible()
  await expect(page.getByText('Brain Dump vazio.')).toHaveCount(0)

  // Captura com destino preenchido — dica não muda o comportamento de
  // captura: o item aparece igual, ainda pendente de processamento manual.
  await page.getByRole('textbox', { name: 'Título' }).fill('Ideia com dica de Hoje')
  await page.getByRole('combobox', { name: 'Destino' }).click()
  await page.getByRole('option', { name: 'Hoje' }).click()
  await page.getByRole('button', { name: 'Capturar' }).click()
  await expect(page.getByText('Ideia com dica de Hoje')).toBeVisible()

  // Processar "Ideia solta sem destino" para Hoje — item some da lista e a
  // Task aparece no Daily Log de hoje.
  const itemRow = page
    .getByTestId('brain-dump-item-row')
    .filter({ hasText: 'Ideia solta sem destino' })
  await itemRow.getByRole('button', { name: 'Mover' }).click()
  await expect(page.getByText('Mover item do Brain Dump')).toBeVisible()
  await page.getByRole('button', { name: 'Mover' }).last().click()
  await expect(page.getByText('Mover item do Brain Dump')).toHaveCount(0)
  await expect(page.getByText('Ideia solta sem destino')).toHaveCount(0)

  await page.getByRole('button', { name: 'Hoje' }).click()
  await expect(page.getByLabel('Hoje')).toBeVisible()
  await expect(page.getByText('Ideia solta sem destino')).toBeVisible()

  // Descartar "Ideia com dica de Hoje" — some sem criar nada.
  await page.getByRole('button', { name: 'Brain Dump' }).click()
  await expect(page.getByRole('main', { name: 'Brain Dump', exact: true })).toBeVisible()
  await expect(page.getByText('Ideia com dica de Hoje')).toBeVisible()
  await page.getByRole('button', { name: 'Descartar' }).click()
  await expect(page.getByText('Ideia com dica de Hoje')).toHaveCount(0)
  await expect(page.getByText('Brain Dump vazio.')).toBeVisible()

  expect(consoleErrors).toEqual([])
})

test('capturar um item mostra o badge "1" na sidebar; descartar o item faz o badge sumir (AC1, AC2)', async ({
  page,
}) => {
  // Cobertura de regressão permanente da Story 5.2 (badge como server state
  // derivado, sem store de cliente) — estende o e2e da Story 5.1 no mesmo
  // arquivo, não cria um novo.
  const brainDumpNavButton = page.getByRole('button', { name: 'Brain Dump' })
  // MUI Badge congela o último `displayValue` enquanto some visualmente (CSS
  // `MuiBadge-invisible`, para a transição de saída) — "sumir" se verifica
  // pela classe, não pela ausência do texto do dígito no DOM.
  const badgeCounter = brainDumpNavButton.locator('.MuiBadge-badge')

  await brainDumpNavButton.click()
  await expect(page.getByRole('main', { name: 'Brain Dump', exact: true })).toBeVisible()
  await expect(badgeCounter).toHaveClass(/MuiBadge-invisible/)

  await page.getByRole('textbox', { name: 'Título' }).fill('Item para o badge')
  await page.getByRole('button', { name: 'Capturar' }).click()
  await expect(page.getByText('Item para o badge')).toBeVisible()

  await expect(brainDumpNavButton.getByText('1')).toBeVisible()
  await expect(badgeCounter).not.toHaveClass(/MuiBadge-invisible/)

  const itemRow = page.getByTestId('brain-dump-item-row').filter({ hasText: 'Item para o badge' })
  await itemRow.getByRole('button', { name: 'Descartar' }).click()
  await expect(page.getByText('Item para o badge')).toHaveCount(0)

  await expect(badgeCounter).toHaveClass(/MuiBadge-invisible/)
})

test.describe('badge no FAB mobile', () => {
  // AC1 exige o badge também no FAB mobile — o teste acima só cobre a
  // sidebar (viewport desktop padrão do projeto Playwright). `useMediaQuery`
  // troca `Sidebar` por `BottomNav` puramente por largura de viewport
  // (`AppLayout.tsx`), então basta um viewport estreito para exercitar o
  // mesmo `BrainDumpBadge` dentro do `Fab`.
  test.use({ viewport: { width: 390, height: 844 } })

  test('capturar um item mostra o badge no FAB; o badge persiste ao navegar para outra página (AC1)', async ({
    page,
  }) => {
    const fab = page.getByRole('button', { name: 'Captura rápida (em breve)' })
    const fabBadge = fab.locator('.MuiBadge-badge')

    await expect(fab).toBeVisible()
    await expect(fabBadge).toHaveClass(/MuiBadge-invisible/)

    // Sem item de navegação para o Brain Dump no BottomNav (fora de escopo
    // desta story) — navega direto pela URL, único jeito de chegar lá no
    // layout mobile hoje.
    await page.goto('/brain-dump')
    await expect(page.getByRole('main', { name: 'Brain Dump', exact: true })).toBeVisible()
    await page.getByRole('textbox', { name: 'Título' }).fill('Item mobile para o FAB')
    await page.getByRole('button', { name: 'Capturar' }).click()
    await expect(page.getByText('Item mobile para o FAB')).toBeVisible()

    await expect(fab.getByText('1')).toBeVisible()
    await expect(fabBadge).not.toHaveClass(/MuiBadge-invisible/)

    // Contagem é server state global (TanStack Query) — continua "1" ao sair
    // da página do Brain Dump, sem precisar de store de cliente.
    await page.getByRole('button', { name: 'Hoje' }).click()
    await expect(page).toHaveURL('/today')
    await expect(fab.getByText('1')).toBeVisible()
  })
})

test('dois usuários em navegadores distintos têm badges isolados; a captura de um nunca aparece para o outro (AC3)', async ({
  browser,
  page,
}) => {
  const brainDumpNavButton = page.getByRole('button', { name: 'Brain Dump' })
  await brainDumpNavButton.click()
  await expect(page.getByRole('main', { name: 'Brain Dump', exact: true })).toBeVisible()

  await page.getByRole('textbox', { name: 'Título' }).fill('Item privado do usuário A')
  await page.getByRole('button', { name: 'Capturar' }).click()
  await expect(page.getByText('Item privado do usuário A')).toBeVisible()
  await expect(brainDumpNavButton.getByText('1')).toBeVisible()

  // Segundo usuário, contexto de navegador isolado (cookies/localStorage
  // próprios) — mesmo padrão usado para simular "duas abas/perfis distintos"
  // na verificação manual da story (Task 12.3), agora automatizado.
  const contextB = await browser.newContext()
  const pageB = await contextB.newPage()
  await signUpAndLandOnToday(pageB)

  const brainDumpNavButtonB = pageB.getByRole('button', { name: 'Brain Dump' })
  const badgeCounterB = brainDumpNavButtonB.locator('.MuiBadge-badge')
  await expect(badgeCounterB).toHaveClass(/MuiBadge-invisible/)

  await brainDumpNavButtonB.click()
  await expect(pageB.getByRole('main', { name: 'Brain Dump', exact: true })).toBeVisible()
  await expect(pageB.getByText('Brain Dump vazio.')).toBeVisible()
  await expect(pageB.getByText('Item privado do usuário A')).toHaveCount(0)

  await contextB.close()
})

test('abre o Brain Dump via atalho global `B` (AC3); dentro de um campo editável, `b` não navega', async ({
  page,
}) => {
  // Fora de qualquer campo editável — atalho global navega e mostra o formulário.
  await page.locator('body').click({ position: { x: 10, y: 10 } })
  await page.keyboard.press('b')
  await expect(page).toHaveURL('/brain-dump')
  await expect(page.getByRole('main', { name: 'Brain Dump', exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Título' })).toBeVisible()

  // Dentro de um campo editável (outra página), `b` é só um caractere digitado
  // — não sequestra o atalho (mesmo cuidado do atalho `N` em DailyPage.tsx).
  await page.getByRole('button', { name: 'Hoje' }).click()
  await expect(page).toHaveURL('/today')
  const newTaskField = page.getByRole('textbox', { name: 'Nova tarefa' })
  await newTaskField.fill('b')
  await expect(newTaskField).toHaveValue('b')
  await expect(page).toHaveURL('/today')
})

test('título vazio não captura nada — botão "Capturar" fica desabilitado (AC3)', async ({ page }) => {
  await page.getByRole('button', { name: 'Brain Dump' }).click()
  await expect(page.getByRole('main', { name: 'Brain Dump', exact: true })).toBeVisible()

  await expect(page.getByRole('button', { name: 'Capturar' })).toBeDisabled()

  // Preencher só a descrição, sem título, continua sem habilitar a captura.
  await page.getByRole('textbox', { name: 'Descrição' }).fill('Só descrição, sem título')
  await expect(page.getByRole('button', { name: 'Capturar' })).toBeDisabled()
  await expect(page.getByText('Brain Dump vazio.')).toBeVisible()
})
