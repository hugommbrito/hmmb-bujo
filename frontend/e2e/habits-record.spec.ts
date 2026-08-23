import { test, expect } from './fixtures'
import { seedHabitAnchor } from './seedHabits'
import { seedHabitHistory } from './seedHabitHistory'
import { seedMultiplierScenario } from './seedMultiplierScenario'
import { mainNav } from './shellHelpers'

// Story 16.1 (M12) — superfície de REGISTRO de Hábitos no sistema novo, contra
// o backend real, sem mocks de rede:
//  - AC1: um `<main aria-label="Hábitos">` com `tablist` de TRÊS abas na ordem
//    Hoje · Histórico · Configuração; a aba ativa reflete `?tab=` e o `back` do
//    navegador volta à aba anterior.
//  - AC2: os deep links antigos (`/habits/history`, `/settings/habits`,
//    inclusive pelo link de Configurações) redirecionam para as abas.
//  - Registro: booleano + numérico com persistência real, dia passado editável,
//    feriado/override, grade e tabela equivalente.
//  - DW-60: o pictograma do `iconKey` no tracker, com a AUSÊNCIA (hábito sem
//    chave) como estado válido de mesma largura — nunca tofu ou quadrado.
//
// Determinismo de tempo: o tracker abre HOJE e o tipo de dia real varia com o
// dia da execução — por isso o toggle de FERIADO é a alavanca (precedência
// holiday > weekend > weekday), como nos specs 6.3/6.4. Nenhuma asserção
// depende do dia real.
//
// Toda marcação é OTIMISTA no VALOR e a porcentagem reconcilia no refetch; por
// isso usamos `.click()` (não `.check()`) e asseramos a porcentagem — que vem
// do servidor — DEPOIS de cada ação, serializando as interações.
const RECONCILE = { timeout: 20_000 }

test('AC1 — a superfície tem um main e três abas na ordem canônica, com estado em ?tab=', async ({
  page,
}) => {
  // `shellHelpers.navigate()` NÃO serve aqui: ele fecha com
  // `getByLabel(destino)`, que casa por SUBSTRING — e a tablist se chama
  // "Seções de Hábitos" (rótulo do gate), então dois elementos casariam
  // "Hábitos". Navegamos pelo mesmo botão e fechamos pelo `role`.
  await mainNav(page).getByRole('button', { name: 'Hábitos' }).click()
  await expect(page).toHaveURL('/habits')

  const main = page.getByRole('main', { name: 'Hábitos' })
  await expect(main).toBeVisible()
  await expect(page.getByRole('main')).toHaveCount(1)

  const tabs = page.getByRole('tab')
  await expect(tabs).toHaveCount(3)
  await expect(tabs.nth(0)).toHaveText('Hoje')
  await expect(tabs.nth(1)).toHaveText('Histórico')
  await expect(tabs.nth(2)).toHaveText('Configuração')
  await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true')

  // O seam legado NÃO aparece em nenhuma das rotas de Hábitos.
  await expect(page.getByTestId('legacy-seam-notice')).toHaveCount(0)

  await page.getByRole('tab', { name: 'Histórico' }).click()
  await expect(page).toHaveURL('/habits?tab=historico')
  await expect(page.getByRole('tab', { name: 'Histórico' })).toHaveAttribute(
    'aria-selected',
    'true',
  )

  await page.getByRole('tab', { name: 'Configuração' }).click()
  await expect(page).toHaveURL('/habits?tab=configuracao')

  // `back` volta à aba anterior (estado na querystring, não em memória).
  await page.goBack()
  await expect(page).toHaveURL('/habits?tab=historico')
  await expect(page.getByRole('tab', { name: 'Histórico' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
})

test('AC2 — os deep links antigos redirecionam para as abas correspondentes', async ({ page }) => {
  await page.goto('/habits/history')
  await expect(page).toHaveURL('/habits?tab=historico')
  await expect(page.getByRole('tab', { name: 'Histórico' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByTestId('legacy-seam-notice')).toHaveCount(0)

  await page.goto('/settings/habits')
  await expect(page).toHaveURL('/habits?tab=configuracao')
  await expect(page.getByRole('tab', { name: 'Configuração' })).toHaveAttribute(
    'aria-selected',
    'true',
  )

  // O link de entrada de Configurações continua levando ao lugar certo.
  await page.goto('/settings')
  await page.getByRole('link', { name: 'Hábitos' }).click()
  await expect(page).toHaveURL('/habits?tab=configuracao')
})

test('registro booleano e numérico persistem; nenhum emoji é exibido', async ({ page, email }) => {
  test.setTimeout(90_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  // Grupo "Saúde" + "Meditar" (booleano, peso 1) + "Passos" (numérico, peso 2,
  // meta 5000, bonus 20%, unidade "passos").
  seedHabitAnchor(email)

  await page.goto('/habits')
  await expect(page.getByRole('main', { name: 'Hábitos' })).toBeVisible()

  // Estado inicial vindo do servidor — 0%, com a barra redundante ao número.
  await expect(page.getByTestId('habits-day-percent')).toHaveText('0%', RECONCILE)
  await expect(page.getByRole('img', { name: /Completude do dia: 0 por cento/ })).toBeVisible()
  await expect(page.getByText('Não feito').first()).toBeVisible()

  // Booleano: marca → 33% ((1×1 + 0×2)/3), vindo do servidor após o refetch.
  await page.getByRole('checkbox', { name: 'Meditar' }).click()
  await expect(page.getByTestId('habits-day-percent')).toHaveText('33%', RECONCILE)

  // Numérico: o parser aceita VÍRGULA; 2500 → contribuição 0,4 → 60%.
  const passos = page.getByRole('textbox', { name: 'Valor de Passos' })
  await passos.fill('2500')
  await passos.blur()
  await expect(page.getByText('2.500 / 5.000 passos (50%)')).toBeVisible()
  await expect(page.getByTestId('habits-day-percent')).toHaveText('60%', RECONCILE)

  // Meta atingida: checkbox INDICADOR marca sozinho e continua disabled.
  await passos.fill('5000')
  await passos.blur()
  await expect(page.getByText('Meta atingida · 5.000 / 5.000 passos')).toBeVisible()
  const indicator = page.getByRole('checkbox', { name: 'Passos: indicador de meta' })
  await expect(indicator).toBeChecked()
  await expect(indicator).toBeDisabled()
  await expect(page.getByTestId('habits-day-percent')).toHaveText('100%', RECONCILE)

  // Persistência real: recarregar mantém o snapshot (o 2º seed é idempotente).
  await page.reload()
  await expect(page.getByTestId('habits-day-percent')).toHaveText('100%', RECONCILE)
  await expect(page.getByRole('checkbox', { name: 'Meditar' })).toBeChecked()

  // DW-60 — o pictograma. "Meditar" foi semeado com `icon_key="barbell"` e
  // "Passos" sem chave: o MESMO cenário prova o glifo presente e a ausência
  // como estado válido, contra o backend real (a migração da 16.2 já rodou no
  // banco do E2E).
  const glyphColumns = page.getByTestId('habit-glyph-column')
  await expect(glyphColumns).toHaveCount(2)
  // Nenhum emoji em lugar nenhum (o `emoticon` segue no contrato de leitura).
  await expect(page.getByRole('main')).not.toContainText('🧘')

  // A ordem das linhas NÃO é contrato: ancoramos cada coluna na LINHA do
  // respectivo hábito (o `habit-tracker-row` que contém o controle nomeado).
  const rowOf = (control: ReturnType<typeof page.getByRole>) =>
    page.getByTestId('habit-tracker-row').filter({ has: control })
  const meditarGlyph = rowOf(page.getByRole('checkbox', { name: 'Meditar' })).getByTestId(
    'habit-glyph-column',
  )
  const passosGlyph = rowOf(page.getByRole('textbox', { name: 'Valor de Passos' })).getByTestId(
    'habit-glyph-column',
  )

  // Glifo presente: um `svg` decorativo, medido pelo token e em `currentColor`.
  const svg = meditarGlyph.locator('svg')
  await expect(svg).toHaveCount(1)
  await expect(svg).toHaveAttribute('fill', 'currentColor')
  expect(await svg.getAttribute('style')).toContain('var(--ds-domain-icon-size-default)')
  // A coluna continua `aria-hidden`: o nome do hábito é o label visível.
  await expect(meditarGlyph).toHaveAttribute('aria-hidden', 'true')

  // Ausência: coluna VAZIA, com a MESMA largura — nunca tofu, quadrado ou
  // glifo de erro. Mesma largura é o que garante o layout inalterado da 16.1.
  await expect(passosGlyph.locator('svg')).toHaveCount(0)
  await expect(passosGlyph).toHaveText('')
  const [comGlifo, semGlifo] = await Promise.all([
    meditarGlyph.boundingBox(),
    passosGlyph.boundingBox(),
  ])
  // Box nulo (elemento fora do layout) NÃO pode passar por "larguras iguais":
  // sem estas duas asserções, `comGlifo?.width` viria `undefined` e a falha
  // apontaria comparação de tipos, não a deriva de layout que o teste mede.
  expect(comGlifo, 'a coluna com glifo tem de estar no layout').not.toBeNull()
  expect(semGlifo, 'a coluna sem glifo tem de estar no layout').not.toBeNull()
  expect(comGlifo!.width).toBeCloseTo(semGlifo!.width, 1)

  expect(consoleErrors).toEqual([])
})

test('feriado congela o peso, a legenda é factual e o override toca só o dia visível', async ({
  page,
  email,
}) => {
  test.setTimeout(90_000)

  // "Profissional" (Emails peso 2 + Relatório peso 1) com feriado ×0,2;
  // "Pessoal" (Ler peso 1) sem config (×1,0).
  seedMultiplierScenario(email, { professionalHolidayMultiplier: '0.2' })

  await page.goto('/habits')
  await expect(page.getByTestId('habits-day-percent')).toBeVisible(RECONCILE)

  await page.getByRole('checkbox', { name: 'Emails' }).click()
  await expect(page.getByTestId('habits-day-percent')).toHaveText('50%', RECONCILE)
  await page.getByRole('checkbox', { name: 'Relatório' }).click()
  await expect(page.getByTestId('habits-day-percent')).toHaveText('75%', RECONCILE)
  // Sem multiplicador ≠ 1, nenhuma legenda.
  await expect(page.getByText(/peso ×/)).toHaveCount(0)

  await page.getByRole('checkbox', { name: 'Marcar este dia como feriado' }).click()
  await expect(page.getByTestId('habits-day-percent')).toHaveText('38%', RECONCILE)
  await expect(page.getByText('Feriado · peso ×0,2 neste grupo')).toBeVisible()
  // Os fatores congelados aparecem SEPARADOS na linha.
  await expect(page.getByText('Peso 2 × 0,2 = 0,4')).toBeVisible()

  // Override avulso: `multiplierAtTime = 1,00` nas linhas do dia visível.
  await page.getByRole('button', { name: 'Tratar este dia como dia útil (peso cheio)' }).click()
  await expect(page.getByTestId('habits-day-percent')).toHaveText('75%', RECONCILE)
  await expect(page.getByText(/peso ×/)).toHaveCount(0)
})

test('dia passado é editável com os pesos congelados dele (sem limite de retroatividade)', async ({
  page,
  email,
}) => {
  test.setTimeout(90_000)

  const { anchorDate } = seedHabitHistory(email)

  await page.goto('/habits')
  await expect(page.getByTestId('habits-day-percent')).toBeVisible(RECONCILE)

  // Navega dois dias para trás até o dia âncora (60% no seed).
  await page.getByRole('button', { name: 'Dia anterior' }).click()
  await page.getByRole('button', { name: 'Dia anterior' }).click()
  await expect(page.getByTestId('habits-day-percent')).toHaveText('60%', RECONCILE)
  await expect(page.getByText('2.500 / 5.000 passos (50%)')).toBeVisible()

  // Corrigir o dia passado afeta SÓ aquele dia.
  const passos = page.getByRole('textbox', { name: 'Valor de Passos' })
  await passos.fill('5000')
  await passos.blur()
  await expect(page.getByTestId('habits-day-percent')).toHaveText('100%', RECONCILE)

  // Voltar para hoje não herda o valor do dia corrigido. O botão vive na
  // superfície (a sidebar também tem um destino "Hoje").
  await page.getByTestId('shell-workspace').getByRole('button', { name: 'Hoje' }).click()
  await expect(page.getByTestId('habits-day-percent')).not.toHaveText('100%', RECONCILE)

  // E o histórico daquele dia reflete a correção.
  await page.goto(`/habits?tab=historico`)
  await page.getByLabel(/^Dia em detalhe/).fill(anchorDate)
  await expect(page.getByText(/completude 100%/)).toBeVisible(RECONCILE)
})

test('histórico é readonly, leva o dia para a aba Hoje e traz grade + tabela equivalente', async ({
  page,
  email,
}) => {
  test.setTimeout(90_000)

  const { anchorDate, gapDate } = seedHabitHistory(email)

  await page.goto('/habits?tab=historico')
  await expect(page.getByRole('heading', { name: 'Evolução por hábito' })).toBeVisible(RECONCILE)

  // Nenhum controle de escrita de registro vive aqui.
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: /^Valor de/ })).toHaveCount(0)

  const dayField = page.getByLabel(/^Dia em detalhe/)
  await dayField.fill(anchorDate)
  await expect(page.getByText(/completude 60%/)).toBeVisible(RECONCILE)
  // O nome do hábito aparece no detalhe do dia (e também na grade/serie): a
  // asserção é escopada ao bloco do detalhe.
  const detail = page.locator('section', { hasText: /completude 60%/ }).first()
  await expect(detail.getByText(/^Meditar/).first()).toBeVisible()

  // Dia-lacuna: frase honesta + a nota, sem NENHUMA porcentagem.
  await dayField.fill(gapDate)
  await expect(page.getByText('Sem registro neste dia.')).toBeVisible()
  await expect(
    page.getByText('Nenhuma linha foi materializada para este dia — o dia nunca foi aberto.'),
  ).toBeVisible()

  // Grade semanal: tabela semântica com caption, cabeçalhos e a tabela
  // equivalente permanente (o que sustenta a exceção de contraste das células).
  const grid = page.getByRole('table', { name: /Completude por hábito e semana/ })
  await expect(grid).toBeVisible()
  await expect(grid.getByRole('rowheader', { name: /Meditar/ })).toBeVisible()
  // A tabela equivalente da GRADE vive num `<details>` na MESMA superfície
  // (mockup F8) — fechada ela fica fora da árvore acessível, por isso abrimos
  // o disclosure antes de asserir. (A tabela equivalente do GRÁFICO é
  // permanente, sem disclosure — asserida abaixo.)
  await page.getByText('Tabela equivalente da grade').click()
  await expect(
    page.getByRole('table', { name: /Mesma leitura em formato linear/ }),
  ).toBeVisible()

  // Célula sem número é bug, não variante — E a leitura tem de ser REAL.
  // `not.toHaveText('')` sozinho é satisfeito por um travessão e é vacuoso se o
  // locator não casar nada: re-chavear o índice `entriesByHabit` por `entry.id`
  // derrubaria toda célula para "—" e o laço passaria igual.
  const cells = grid.getByRole('cell')
  const cellCount = await cells.count()
  expect(cellCount).toBeGreaterThan(0)
  for (const cell of await cells.all()) {
    await expect(cell).not.toHaveText('')
  }
  // Toda LINHA de hábito semeado tem pelo menos um período com leitura real:
  // se a fiação entrada→bucket quebrar, sobram só travessões e isto falha.
  for (const row of await grid.getByRole('row').all()) {
    const header = row.getByRole('rowheader')
    if ((await header.count()) === 0) continue
    const texts = await row.getByRole('cell').allInnerTexts()
    expect(
      texts.some((text) => text.trim() !== '' && !text.trim().startsWith('\u2014')),
      `linha "${await header.innerText()}" só tem células sem registro`,
    ).toBe(true)
  }

  // A única saída para escrita é levar o dia para a aba Hoje.
  await dayField.fill(anchorDate)
  await page.getByRole('button', { name: 'Abrir este dia para edição' }).click()
  await expect(page).toHaveURL('/habits?tab=hoje')
  await expect(page.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('habits-day-percent')).toHaveText('60%', RECONCILE)
})

test('configuração: identidade × versionado, desativar/reativar e multiplicadores', async ({
  page,
  email,
}) => {
  test.setTimeout(90_000)

  seedHabitAnchor(email)

  await page.goto('/habits?tab=configuracao')
  await expect(page.getByRole('heading', { name: 'Adicionar hábito' })).toBeVisible(RECONCILE)

  // O aviso é TEXTO persistente (nunca tooltip) e a precedência é declarada
  // no próprio bloco onde a config é editada.
  await expect(page.getByTestId('prospective-notice').first()).toHaveText(
    'Alteração válida a partir de hoje. Registros anteriores preservados.',
  )
  await expect(page.getByText(/Precedência: feriado > fim de semana > dia útil\./)).toBeVisible()

  // Identidade (nome) e versionado (peso) saem em DUAS mutações do mesmo form.
  await page.getByRole('button', { name: 'Editar Passos' }).click()
  const weight = page.getByRole('textbox', { name: 'Peso de Passos' })
  await weight.fill('4')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText(/Peso 4/)).toBeVisible(RECONCILE)

  // Excluir NÃO existe; a ação nomeia a consequência.
  await expect(page.getByRole('button', { name: /Excluir/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Desativar hábito Meditar' }).click()
  await expect(page.getByText('Meditar')).toHaveCount(0, RECONCILE)

  // O inativo reaparece com "Mostrar inativos", com chip TEXTUAL.
  await page.getByRole('checkbox', { name: 'Mostrar inativos' }).click()
  await expect(page.getByTestId('habit-inactive-chip')).toHaveText('Inativo', RECONCILE)
  await page.getByRole('button', { name: 'Reativar hábito Meditar' }).click()
  await expect(page.getByRole('button', { name: 'Desativar hábito Meditar' })).toBeVisible(
    RECONCILE,
  )

  // Multiplicador: campo vazio ⇄ 1,00 (placeholder), salvo prospectivamente.
  const holiday = page.getByRole('textbox', { name: 'Multiplicador de feriado de Saúde' })
  await expect(holiday).toHaveValue('')
  await expect(holiday).toHaveAttribute('placeholder', '1,00')
  await holiday.fill('0,2')
  await Promise.all([
    page.waitForResponse(
      (r) => /\/multipliers\/$/.test(r.url()) && r.request().method() === 'PUT' && r.ok(),
    ),
    page.getByRole('button', { name: 'Salvar multiplicadores' }).click(),
  ])
  await page.reload()
  await expect(
    page.getByRole('textbox', { name: 'Multiplicador de feriado de Saúde' }),
  ).toHaveValue('0,2', RECONCILE)
})

test('sem grupo cadastrado, criar hábito fica indisponível com o motivo escrito', async ({
  page,
}) => {
  await page.goto('/habits?tab=configuracao')
  // O motivo é ESCRITO e acessível, não só um botão apagado. (`role="note"`
  // sozinho é ambíguo: o shell em DEV também tem uma nota de ambiente — por
  // isso a asserção é pelo TEXTO, e a ligação é provada pelo
  // `aria-describedby` do botão.)
  const reason = page.getByText('Crie um grupo para começar a adicionar hábitos.')
  await expect(reason).toBeVisible()
  await expect(reason).toHaveAttribute('role', 'note')

  const addHabit = page.getByRole('button', { name: 'Adicionar hábito' })
  await expect(addHabit).toBeDisabled()
  const reasonId = await reason.getAttribute('id')
  await expect(addHabit).toHaveAttribute('aria-describedby', reasonId!)
})

test('sem hábito ativo, a aba Hoje diz a frase honesta e não fabrica porcentagem', async ({
  page,
}) => {
  await page.goto('/habits')
  await expect(page.getByText('Nenhum hábito ativo hoje.')).toBeVisible()
})
