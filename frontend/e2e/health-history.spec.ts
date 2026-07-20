import { test, expect } from './fixtures'
import { seedHealthHistory } from './seedHealthHistory'

// Cobre a Story 7.3 (histórico de saúde em três visualizações) ponta-a-ponta contra
// o backend real (branch Neon `e2e`, sem mocks de rede) — a CAMADA DE LEITURA
// analítica (AD-01/AD-14) empilhada sobre o catálogo da 7.1 e os valores da 7.2:
//  - AC1: TABELA dia a dia read-only, tipada pela DEFINIÇÃO viva de cada campo
//    (número pt-BR / "Sim"/"Não" / string), com coluna também para campo INATIVO
//    que tem valor no range (a 7.2 preserva o histórico ao desativar), lacuna "—"
//    honesta para chave ausente e dia SEM linha simplesmente ausente da tabela.
//  - AC2: GRÁFICO de evolução de um campo numérico (série derivada via cast JSONB)
//    com resumo textual acessível (`role="img"` + `<figcaption>`), seletor que
//    oferece SÓ campos numéricos; DASHBOARD de período com um cartão por campo
//    numérico (registros/mín/máx/média/mais recente), computados no backend.
//  - AC3: superfície 100% read-only (GET puro) — nenhum controle editável (os
//    controles de captura vivem só na aba "Registro"/7.2). Isolamento cross-tenant
//    e taxonomia de erro (400/404/409) são cobertos pelos testes de view do backend.
//  - AC4: acessibilidade — `<table>` semântica com headers programáticos, gráfico
//    com equivalente tabular; a superfície é alcançada por ABA dentro de Saúde (não
//    item de Sidebar/BottomNav); voz pt-BR factual, zero gamificação; estados vazios.
// Complementa a suíte de componente de `HealthHistory`/`HealthHistoryTable`/
// `HealthEvolutionChart`/`HealthPeriodDashboard` (que mockam a API): aqui é o fluxo
// real (definições + linhas passadas → leitura derivada on-read via cast JSONB).
//
// Determinismo de tempo: a superfície mostra um RANGE (últimos 30 dias). O seed usa
// datas relativas a `today_for(user)` (autoridade única de "hoje" do backend) e as
// devolve em ISO — o spec nunca reproduz aritmética de calendário; formata a data no
// mesmo idioma do componente (split de string, sem drift de fuso).

// A branch Neon `e2e` tem stalls de cold-start/conexão (~30s) em QUALQUER request ao
// DB — instabilidade ambiental documentada (retros Épico 4/5/11, playwright.config.ts).
// Timeouts que dependem de um round-trip real ao backend são folgados (config de
// ambiente, não lógica de spec — mesma disciplina de health-log.spec.ts).
const LOAD_TIMEOUT = { timeout: 30_000 }

// Formata "YYYY-MM-DD" → "DD/MM/YYYY" por split de string (idioma de
// healthHistoryUtils.formatDateBR) — sem `new Date(iso)` (evita o desvio de fuso que
// deslocaria o dia). Reproduz o que a tabela renderiza para localizar linhas por data.
function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

test('sem campos de saúde: histórico vazio honesto, alcançado por aba, read-only (AC1, AC4)', async ({
  page,
}) => {
  // AC4 — a superfície de histórico é uma ABA dentro de Saúde (Decisão 1), não um
  // item novo de Sidebar/BottomNav (evita a armadilha dos 3 testes compartilhados).
  await page.getByRole('button', { name: 'Métricas' }).click()
  await expect(page).toHaveURL('/health/metrics')
  await page.getByRole('tab', { name: 'Histórico' }).click()
  await expect(page).toHaveURL('/health/metrics/history')

  await expect(page.getByRole('heading', { name: 'Histórico', level: 2 })).toBeVisible()

  // Usuário recém-criado (fixture) ainda não tem NENHUMA definição de campo → estado
  // vazio factual (voz UX-DR13, sem gamificação), sem tabela/gráfico/dashboard.
  await expect(page.getByText('Nenhum campo de saúde para exibir.')).toBeVisible(LOAD_TIMEOUT)

  // AC1/AC3 — a superfície é 100% read-only: nenhum controle de captura (esses vivem
  // só na aba "Registro"/7.2). Sem checkbox (boolean), sem spinbutton (numérico).
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(page.getByRole('spinbutton')).toHaveCount(0)
})

test('tabela dia a dia: célula tipada pela definição, lacuna honesta, coluna de campo inativo-com-valor, dia sem linha ausente (AC1, AC4)', async ({
  page,
  email,
}) => {
  test.setTimeout(120_000)

  const { anchorDate, midDate, oldDate, gapDate } = seedHealthHistory(email)

  await page.goto('/health/metrics/history')
  await expect(page.getByRole('heading', { name: 'Histórico', level: 2 })).toBeVisible()

  // AC4 — a grade dia a dia é uma `<table>` semântica (a tabela equivalente que o
  // Accessibility Floor exige para o gráfico). É a única tabela da superfície.
  const table = page.getByRole('table')
  await expect(table).toBeVisible(LOAD_TIMEOUT)

  // AC1 — colunas (headers programáticos `<th scope="col">`): campos ATIVOS + o campo
  // INATIVO-COM-VALOR ("Pressão", desativado após gravar 120 em d(2)); "Campo Antigo"
  // (inativo SEM valor) NÃO aparece.
  await expect(table.getByRole('columnheader', { name: 'Data' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Peso' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Passos' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Dormiu bem' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Humor' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Observações' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Pressão' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Campo Antigo' })).toHaveCount(0)

  // AC1 — linhas = datas com registro (headers `<th scope="row">`), mais recente
  // primeiro. O dia-lacuna (d(4), sem linha `health_logs`) NÃO aparece.
  await expect(table.getByRole('rowheader', { name: formatDateBR(anchorDate) })).toBeVisible()
  await expect(table.getByRole('rowheader', { name: formatDateBR(midDate) })).toBeVisible()
  await expect(table.getByRole('rowheader', { name: formatDateBR(oldDate) })).toBeVisible()
  await expect(table.getByRole('rowheader', { name: formatDateBR(gapDate) })).toHaveCount(0)

  // AC1 — cada célula é tipada pela DEFINIÇÃO viva (aria-label "campo, data: valor"):
  //  integer/decimal → número pt-BR; boolean → "Sim"/"Não"; enum/text → string.
  await expect(table.getByRole('cell', { name: `Peso, ${formatDateBR(anchorDate)}: 88` })).toBeVisible()
  await expect(
    table.getByRole('cell', { name: `Passos, ${formatDateBR(anchorDate)}: 6.000` }),
  ).toBeVisible()
  await expect(
    table.getByRole('cell', { name: `Dormiu bem, ${formatDateBR(anchorDate)}: Sim` }),
  ).toBeVisible()
  await expect(
    table.getByRole('cell', { name: `Humor, ${formatDateBR(anchorDate)}: Bom` }),
  ).toBeVisible()
  await expect(
    table.getByRole('cell', { name: `Observações, ${formatDateBR(anchorDate)}: dia tranquilo` }),
  ).toBeVisible()

  // AC1 — distinção crucial "sem valor" (—) vs. `false` real gravado ("Não"):
  //  d(5) tem "Dormiu bem" = false → "Não"; d(8) NÃO tem a chave → "sem registro" (—).
  await expect(
    table.getByRole('cell', { name: `Dormiu bem, ${formatDateBR(midDate)}: Não` }),
  ).toBeVisible()
  await expect(
    table.getByRole('cell', { name: `Dormiu bem, ${formatDateBR(oldDate)}: sem registro` }),
  ).toBeVisible()

  // AC1/AC3 — read-only: nenhum controle editável em toda a superfície.
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(page.getByRole('spinbutton')).toHaveCount(0)
})

test('gráfico de evolução: série via cast JSONB, resumo textual acessível, seletor só numérico (AC2, AC4)', async ({
  page,
  email,
}) => {
  test.setTimeout(120_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  seedHealthHistory(email)

  await page.goto('/health/metrics/history')
  await expect(page.getByRole('heading', { name: 'Histórico', level: 2 })).toBeVisible()

  // AC2 — o seletor do gráfico oferece SÓ campos numéricos (integer/decimal):
  //  "Peso"/"Passos" e o inativo-com-valor "Pressão"; boolean/enum/text NÃO plotáveis.
  const selector = page.getByRole('combobox', { name: 'Campo numérico' })
  await expect(selector).toBeVisible(LOAD_TIMEOUT)
  await selector.click()
  await expect(page.getByRole('option', { name: 'Peso' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Passos' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Pressão' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Dormiu bem' })).toHaveCount(0)
  await expect(page.getByRole('option', { name: 'Humor' })).toHaveCount(0)
  await expect(page.getByRole('option', { name: 'Observações' })).toHaveCount(0)

  // Seleciona "Passos" → a série é derivada on-read via cast JSONB
  // (values->>'uuid')::double precision. 3 dias com registro (d8/d5/d2).
  await page.getByRole('option', { name: 'Passos' }).click()

  // AC2/AC4 — o gráfico expõe RESUMO TEXTUAL acessível (não depende do SVG): a
  // representação equivalente é a tabela, então o gráfico é `role="img"` + figcaption.
  await expect(page.getByRole('img', { name: /Evolução de Passos/ })).toBeVisible(LOAD_TIMEOUT)
  await expect(page.getByText(/3 dias com registro no período/)).toBeVisible()

  expect(consoleErrors).toEqual([])
})

test('dashboard de período: um cartão por campo numérico com os 5 fatos, sem score/gamificação (AC2)', async ({
  page,
  email,
}) => {
  test.setTimeout(120_000)

  seedHealthHistory(email)

  await page.goto('/health/metrics/history')
  await expect(page.getByRole('heading', { name: 'Histórico', level: 2 })).toBeVisible()

  // AC2 — o dashboard resume o período: uma lista de cartões, um por campo numérico.
  const dashboard = page.getByRole('list', { name: 'Resumo do período por campo' })
  await expect(dashboard).toBeVisible(LOAD_TIMEOUT)

  // Cartão de "Passos": os 5 fatos, computados no backend via agregação castada,
  // formatados em pt-BR (separador de milhar "."). count=3, mín 4.000, máx/mais
  // recente 6.000, média 5.000.
  const passosCard = dashboard.getByRole('listitem').filter({ hasText: 'Passos' })
  await expect(passosCard).toContainText('Registros')
  await expect(passosCard).toContainText('3')
  await expect(passosCard).toContainText('Mínimo')
  await expect(passosCard).toContainText('4.000')
  await expect(passosCard).toContainText('Máximo')
  await expect(passosCard).toContainText('6.000')
  await expect(passosCard).toContainText('Média')
  await expect(passosCard).toContainText('5.000')
  await expect(passosCard).toContainText('Mais recente')

  // Cartão de "Peso": "mais recente" (88, valor na maior data com registro = d2) é
  // DISTINTO do máximo (89, em d5) — prova a semântica da Decisão 8 (não é o máx).
  const pesoCard = dashboard.getByRole('listitem').filter({ hasText: 'Peso' })
  await expect(pesoCard).toContainText('Mínimo')
  await expect(pesoCard).toContainText('87')
  await expect(pesoCard).toContainText('Máximo')
  await expect(pesoCard).toContainText('89')
  await expect(pesoCard).toContainText('Média')
  await expect(pesoCard).toContainText('88')

  // Campo INATIVO-COM-VALOR ("Pressão") também gera cartão (Decisão 3): count=1, 120.
  const pressaoCard = dashboard.getByRole('listitem').filter({ hasText: 'Pressão' })
  await expect(pressaoCard).toContainText('120')

  // AC2/AC4 — SÓ campos numéricos entram no dashboard: boolean/enum/text não têm
  // cartão (Saúde não tem "% de saúde"/score inventado — só fatos por campo).
  await expect(dashboard.getByRole('listitem').filter({ hasText: 'Dormiu bem' })).toHaveCount(0)
  await expect(dashboard.getByRole('listitem').filter({ hasText: 'Humor' })).toHaveCount(0)
  await expect(dashboard.getByRole('listitem').filter({ hasText: 'Observações' })).toHaveCount(0)

  // Voz UX-DR13 — zero gamificação (sem troféus/sequências/parabéns).
  await expect(page.getByText(/parabéns|troféu|sequência|🏆/i)).toHaveCount(0)
})
