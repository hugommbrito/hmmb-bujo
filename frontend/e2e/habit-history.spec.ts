import { test, expect } from './fixtures'
import { seedHabitHistory } from './seedHabitHistory'

// Cobre a Story 6.4 (histórico por data + gráfico de evolução) ponta-a-ponta
// contra o backend real, sem mocks de rede — a CAMADA DE LEITURA (AD-11/AD-14)
// empilhada sobre o snapshot da 6.2 e o ritmo da 6.3:
//  - AC1: navegação por data read-only mostra o snapshot daquele dia (agrupado,
//    % por grupo + % total) e um dia nunca aberto aparece como LACUNA honesta
//    ("Sem registro neste dia."), nunca 0% fabricado; a superfície não tem
//    nenhum controle editável (read-only) e não semeia.
//  - AC2: o gráfico de evolução por hábito deriva a série on-read e anota a
//    MUDANÇA REAL de config (peso 1 → 2) como marcador datado com o diff no texto;
//    o multiplicador/tipo de dia é ritmo (sombreamento), nunca marcador.
//  - AC3: acessibilidade — gráfico com resumo textual (`role="img"`/aria-label) +
//    a grade hábitos × dias como TABELA equivalente (headers programáticos,
//    feriado rotulado por texto, lacuna "—" honesta); cor nunca sozinha; voz
//    pt-BR factual sem gamificação; estados vazios informativos.
//  - AC4: contrato read-only — a superfície vive numa ABA dentro de Hábitos (não
//    item de Sidebar/BottomNav) e é 100% GET (nenhuma mutação/materialização).
// Complementa a suíte unitária de `habits/` (backend) e os testes de componente
// de `HabitHistory`/`HabitEvolutionChart`/`HabitHistoryGrid` (que mockam a API):
// aqui é o fluxo real (config + snapshot passado + versões → leitura derivada).
//
// Determinismo de tempo: a superfície mostra um RANGE (últimos 30 dias) e o tipo
// de dia real varia com o dia da execução. Por isso o seed usa um FERIADO real
// (`UserHoliday`, precedência holiday > weekend > weekday) como alavanca — a
// coluna/sombreamento "Feriado" é estável em qualquer dia. As datas de asserção
// (âncora/lacuna) vêm do seed (relativas a `today_for(user)`), então o spec nunca
// reproduz aritmética de calendário.

test('sem hábitos: o histórico mostra período vazio honesto e é alcançado por aba (AC1, AC3, AC4)', async ({
  page,
}) => {
  // A superfície de histórico é uma ABA dentro de Hábitos (Decisão 2), não um item
  // novo de Sidebar/BottomNav (evita a armadilha dos 3 testes compartilhados).
  await page.getByRole('button', { name: 'Hábitos' }).click()
  await expect(page).toHaveURL('/habits')
  await page.getByRole('tab', { name: 'Histórico' }).click()
  await expect(page).toHaveURL('/habits/history')

  await expect(page.getByRole('heading', { name: 'Histórico', level: 2 })).toBeVisible()

  // Usuário recém-criado (fixture) ainda não tem hábitos nem dias materializados:
  // detalhe do dia = lacuna honesta; grade = estado vazio informativo (sem 0%,
  // sem gamificação — UX-DR13).
  await expect(page.getByText('Sem registro neste dia.')).toBeVisible()
  await expect(page.getByText('Nenhum registro no período.')).toBeVisible()
  await expect(
    page.getByText('Selecione um hábito para ver o gráfico de evolução.'),
  ).toBeVisible()

  // AC1/AC4 — a superfície é 100% read-only: nenhum checkbox/campo numérico
  // editável (esses vivem só no tracker de hoje, não aqui).
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(page.getByRole('spinbutton')).toHaveCount(0)
})

test('navegação por data read-only: dia com registro mostra %/valores; dia-lacuna é honesto (AC1, AC3, AC4)', async ({
  page,
  email,
}) => {
  test.setTimeout(90_000)

  const { anchorDate, gapDate } = seedHabitHistory(email)

  await page.goto('/habits/history')
  await expect(page.getByRole('heading', { name: 'Histórico', level: 2 })).toBeVisible()

  // O controle de data usa aria-label dinâmico ("Data selecionada: DD/MM/AAAA");
  // localizamos por prefixo estável e preenchemos a data ISO devolvida pelo seed.
  const dateInput = page.getByLabel(/^Data selecionada:/)

  // AC1 — dia âncora (registro completo): read-only, agrupado, % por grupo + %
  // total, reproduzindo a matemática de completude das 6.2/6.3 (60%). Booleano =
  // "feito"; numérico = "valor / meta unidade" (nenhum controle editável).
  await dateInput.fill(anchorDate)
  await expect(page.getByText(/Completude do dia: 60%/)).toBeVisible()
  await expect(page.getByText('Saúde · 60%')).toBeVisible()
  await expect(page.getByText('Meditar: feito')).toBeVisible()
  await expect(page.getByText('Passos: 2.500 / 5.000 passos')).toBeVisible()

  // AC1 — dia nunca aberto dentro da janela = LACUNA honesta, nunca 0% fabricado.
  await dateInput.fill(gapDate)
  await expect(page.getByText('Sem registro neste dia.')).toBeVisible()
  await expect(page.getByText(/Completude do dia: 0%/)).toHaveCount(0)

  // AC4 — read-only: a superfície inteira não expõe nenhum controle editável.
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(page.getByRole('spinbutton')).toHaveCount(0)
})

test('gráfico de evolução: série on-read + marcador de mudança real + sombreamento de ritmo (AC2, AC3)', async ({
  page,
  email,
}) => {
  test.setTimeout(90_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  seedHabitHistory(email)

  await page.goto('/habits/history')
  await expect(page.getByRole('heading', { name: 'Histórico', level: 2 })).toBeVisible()

  // Seleciona "Meditar" no seletor de hábito (MUI select) → o gráfico monta. O
  // combobox é o único elemento desse papel (o `<main>`/tablist têm "Hábitos" no
  // nome, mas não são comboboxes) → localizador inequívoco.
  await page.getByRole('combobox', { name: 'Hábito' }).click()
  await page.getByRole('option', { name: 'Meditar' }).click()

  // AC3 — o gráfico expõe um RESUMO TEXTUAL acessível (não depende do SVG): a
  // representação equivalente é a grade (tabela), então o gráfico é `role="img"`.
  await expect(page.getByRole('img', { name: /Evolução de Meditar/ })).toBeVisible()

  // AC2 — a MUDANÇA REAL de config (peso 1 → 2) aparece como marcador datado com
  // o diff no texto ("cor nunca comunica sozinha" — AC3). O "Criado" foi
  // backdatado para fora da janela → só o marcador de peso entra no período.
  await expect(page.getByText('Mudanças no período')).toBeVisible()
  await expect(page.getByText(/Peso 1 → 2/)).toBeVisible()

  // AC2 — o multiplicador/tipo de dia é RITMO (sombreamento), nunca marcador: a
  // legenda factual confirma o sombreamento de fim de semana/feriado.
  await expect(
    page.getByText('Fim de semana e feriados aparecem sombreados.'),
  ).toBeVisible()

  expect(consoleErrors).toEqual([])
})

test('grade acessível hábitos × dias: tabela com feriado rotulado e lacuna honesta (AC1, AC3, UX-DR4)', async ({
  page,
  email,
}) => {
  test.setTimeout(90_000)

  seedHabitHistory(email)

  await page.goto('/habits/history')
  await expect(page.getByRole('heading', { name: 'Histórico', level: 2 })).toBeVisible()

  // AC3/UX-DR4 — a grade densa é uma `<table>` semântica (a tabela equivalente que
  // o Accessibility Floor exige para o gráfico).
  const grid = page.getByRole('table', { name: /Grade de hábitos por dia/ })
  await expect(grid).toBeVisible()

  // Headers programáticos de hábito (`<th scope="row">`).
  await expect(grid.getByRole('rowheader', { name: /Meditar/ })).toBeVisible()
  await expect(grid.getByRole('rowheader', { name: /Passos/ })).toBeVisible()

  // Coluna de FERIADO rotulada por TEXTO (não só cor) — determinística (seed).
  // Fim de semana diz "Fim de semana"; só o feriado semeado diz "Feriado".
  await expect(grid.getByRole('columnheader', { name: /Feriado/ })).toBeVisible()

  // Célula com valor real anuncia estado + unidade; célula-lacuna = "—" honesto
  // (aria "sem registro"), texto e não só cor.
  await expect(grid.getByRole('cell', { name: /Passos.*2\.500 passos/ }).first()).toBeVisible()
  await expect(grid.getByRole('cell', { name: /sem registro/ }).first()).toBeVisible()
})
