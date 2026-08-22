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
// ⚠ AJUSTADO NA STORY 16.1 (M12): o histórico deixou de ser a rota
// `/habits/history` e virou a ABA "Histórico" da superfície única
// (`/habits?tab=historico`); a rota antiga permanece como REDIRECT. O markup é
// o do sistema novo — o detalhe do dia usa um campo "Dia em detalhe", a
// completude aparece como "completude N%" e a grade é SEMANAL (tabela
// "Completude por hábito e semana"), com a tabela equivalente permanente ao
// lado. A cobertura ampla da superfície nova vive em `habits-record.spec.ts`;
// aqui preservamos os contratos de DOMÍNIO da 6.4 (leitura derivada, lacuna
// honesta, marcador de mudança real, tabela acessível).
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
  // A superfície de histórico é uma ABA dentro de Hábitos, não um item novo de
  // Sidebar/BottomNav (evita a armadilha dos 3 testes compartilhados). Desde a
  // 16.1 o estado da aba vive na querystring.
  await page.getByRole('button', { name: 'Hábitos' }).click()
  await expect(page).toHaveURL('/habits')
  await page.getByRole('tab', { name: 'Histórico' }).click()
  await expect(page).toHaveURL('/habits?tab=historico')

  await expect(page.getByRole('heading', { name: 'Evolução por hábito' })).toBeVisible()

  // Usuário recém-criado (fixture) ainda não tem hábitos nem dias materializados:
  // detalhe do dia = lacuna honesta; grade = estado vazio informativo (sem 0%,
  // sem gamificação — UX-DR13).
  await expect(page.getByText('Sem registro neste dia.')).toBeVisible()
  await expect(page.getByText('Nenhum registro no período.')).toBeVisible()
  await expect(
    page.getByText('Selecione um hábito para ver o gráfico de evolução.'),
  ).toBeVisible()

  // AC1/AC4 — a superfície é 100% read-only: nenhum controle de escrita de
  // registro (esses vivem só na aba Hoje).
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: /^Valor de/ })).toHaveCount(0)
})

test('navegação por data read-only: dia com registro mostra %/valores; dia-lacuna é honesto (AC1, AC3, AC4)', async ({
  page,
  email,
}) => {
  test.setTimeout(90_000)

  const { anchorDate, gapDate } = seedHabitHistory(email)

  // A rota antiga REDIRECIONA para a aba (deep link preservado).
  await page.goto('/habits/history')
  await expect(page).toHaveURL('/habits?tab=historico')
  await expect(page.getByRole('heading', { name: 'Evolução por hábito' })).toBeVisible()

  const dateInput = page.getByLabel(/^Dia em detalhe/)

  // AC1 — dia âncora (registro completo): read-only, agrupado, % por grupo + %
  // total, reproduzindo a matemática de completude das 6.2/6.3 (60%). Booleano =
  // "Feito"; numérico = "valor / meta unidade" (nenhum controle editável).
  await dateInput.fill(anchorDate)
  await expect(page.getByText(/completude 60%/)).toBeVisible()
  await expect(page.getByText('Saúde · 60%')).toBeVisible()
  // O nome do hábito também aparece na série e na grade — escopar ao DETALHE
  // do dia é o que torna a asserção sobre a leitura por-data.
  const detail = page.locator('section', { hasText: /completude 60%/ }).first()
  await expect(detail.getByText(/^Meditar/).first()).toBeVisible()
  await expect(detail.getByText('Feito').first()).toBeVisible()
  await expect(page.getByText('2.500 / 5.000 passos (50%)')).toBeVisible()

  // AC1 — dia nunca aberto dentro da janela = LACUNA honesta, nunca 0% fabricado.
  await dateInput.fill(gapDate)
  await expect(page.getByText('Sem registro neste dia.')).toBeVisible()
  await expect(page.getByText(/completude 0%/)).toHaveCount(0)

  // AC4 — read-only: a superfície inteira não expõe nenhum controle de escrita
  // de registro.
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: /^Valor de/ })).toHaveCount(0)
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

  await page.goto('/habits?tab=historico')
  await expect(page.getByRole('heading', { name: 'Evolução por hábito' })).toBeVisible()

  // Seleciona "Meditar" no seletor de hábito (`<select>` nativo do sistema
  // novo) → o gráfico monta. Sem seleção NADA é buscado (`enabled:false`).
  // `getByLabel` casa por SUBSTRING: "Hábitos"/"Seções de Hábitos" também
  // casariam — daí `exact` + o papel do controle.
  await page.getByLabel('Hábito', { exact: true }).selectOption({ label: 'Meditar' })

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

  await page.goto('/habits?tab=historico')
  await expect(page.getByRole('heading', { name: 'Completude por hábito e período' })).toBeVisible()

  // AC3/UX-DR4 — a grade é uma `<table>` semântica; desde a 16.1 as colunas são
  // SEMANAIS (a coluna rotula os dias reais) e a leitura acessível de fato é a
  // TABELA EQUIVALENTE permanente ao lado, em contraste normal.
  const grid = page.getByRole('table', { name: /Completude por hábito e semana/ })
  await expect(grid).toBeVisible()

  // Headers programáticos de hábito (`<th scope="row">`).
  await expect(grid.getByRole('rowheader', { name: /Meditar/ })).toBeVisible()
  await expect(grid.getByRole('rowheader', { name: /Passos/ })).toBeVisible()

  // Tag textual FER na coluna da semana com o feriado semeado (não só cor).
  await expect(grid.getByRole('columnheader', { name: /FER/ })).toBeVisible()

  // Nenhuma célula sem número: "célula sem número é bug, não variante".
  for (const cell of await grid.getByRole('cell').all()) {
    await expect(cell).not.toHaveText('')
  }

  // Tabela equivalente da grade: `<details>` na MESMA superfície (mockup F8).
  // Fechada, fica fora da árvore acessível — abrir o disclosure é o que prova
  // que a leitura acessível existe e é alcançável.
  await page.getByText('Tabela equivalente da grade').click()
  await expect(
    page.getByRole('table', { name: /Mesma leitura em formato linear/ }),
  ).toBeVisible()
})
