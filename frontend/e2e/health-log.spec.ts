import { test, expect } from './fixtures'
import { seedHealthFields, setHealthFieldActive } from './seedHealthFields'

// Cobre a Story 7.2 (Log diário de saúde) ponta-a-ponta contra o backend real
// (branch Neon `e2e`, sem mocks de rede) — a captura/armazenamento de VALORES
// sobre o catálogo de DEFINIÇÕES de 7.1. Complementa `health-metrics.spec.ts`
// (que cobre só a gestão de definições em `/settings/health-metrics`); aqui é a
// superfície própria do ritual matinal (`/health/metrics`):
//  - AC1: gravação validada em `health_logs.values` (JSONB por UUID) — grava só
//    se TODOS os valores forem válidos (submissão atômica); upsert por (user, dia).
//  - AC2: round-trip por UUID — os valores chaveados por UUID voltam idênticos do
//    backend real (recarregar reidrata do servidor, não de cache otimista).
//  - AC3: "Ontem, [data]" NO TOPO, "Hoje, [data]" abaixo; datas resolvidas pela
//    autoridade temporal do servidor (o front não calcula "ontem").
//  - AC4: campo desativado some do log ativo mas seu valor histórico é PRESERVADO
//    (o upsert faz merge, nunca replace); reativar o traz de volta intacto.
//  - AC5: Health Metric Row por tipo (integer/decimal/boolean/enum/text); salvar
//    por dia com confirmação inline discreta; estados empty e erro-de-escrita.
//
// O log NÃO versiona e NÃO tem completude ponderada (divergência de Hábitos): o
// valor é cru no JSONB, tipado pela definição VIVA (AD-01). As definições são
// seedadas direto pela camada de serviço (`seedHealthFields`) para dar controle
// determinístico de tipo/opções — mesma técnica de `seedHabits.ts`.
//
// A mutação de escrita é SEM otimismo (useMutation + invalidateQueries ['health']):
// a confirmação "Dados de [ontem/hoje] salvos." só aparece após o `onSuccess` do
// PUT real, então quando a asserção passa a escrita já commitou no backend — e só
// recarregamos DEPOIS disso, nunca correndo contra uma escrita em voo. A branch
// Neon `e2e` tem latência de cold-start (ver playwright.config.ts), daí os
// timeouts folgados.

// A branch Neon `e2e` tem stalls intermitentes de cold-start/conexão (~30s) em
// QUALQUER request ao DB — instabilidade ambiental documentada (retros Épico 4/5/11,
// playwright.config.ts). Requests "quentes" são ~1s; um stall isolado no GET
// `/daily/` ou no PUT não deve derrubar a asserção. Por isso os timeouts que
// dependem de um round-trip real ao backend são folgados (30s) — é config de
// ambiente, não lógica de spec (mesma disciplina do `RECONCILE` de
// habit-multiplier.spec.ts e do `LIST_TIMEOUT` de health-metrics.spec.ts).
const LIST_TIMEOUT = { timeout: 30_000 }
const SAVE_TIMEOUT = { timeout: 30_000 }

test('AC3/AC5/AC1/AC2 — ritual ontem-no-topo/hoje-abaixo, Health Metric Row por tipo, salvar por dia com confirmação inline, valores persistem (round-trip por UUID)', async ({
  page,
  email,
}) => {
  // Budget generoso: seed + fixture + múltiplos round-trips ao Neon `e2e`, cada um
  // sujeito a um stall de cold-start (~30s) — ver nota dos timeouts no topo.
  test.setTimeout(180_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  // Catálogo ativo (Story 7.1) cobrindo os 5 tipos → exercita a Row de cada tipo (AC5).
  seedHealthFields(email, [
    { name: 'Peso', fieldType: 'integer' },
    { name: 'Temperatura', fieldType: 'decimal' },
    { name: 'Dormiu bem', fieldType: 'boolean' },
    { name: 'Humor', fieldType: 'enum', enumOptions: ['Bom', 'Ruim'] },
    { name: 'Observações', fieldType: 'text' },
  ])

  // AC3 — navegação: a entrada de nav "Saúde › Métricas" (já cabeada antes da 7.2)
  // agora leva à página real do log (antes era placeholder).
  await page.getByRole('button', { name: 'Métricas' }).click()
  await expect(page).toHaveURL('/health/metrics')
  await expect(page.getByRole('main', { name: 'Métricas de Saúde' })).toBeVisible()

  // AC3 — as duas seções do ritual, com datas formatadas em pt-BR vindas do servidor.
  const ontemHeading = page.getByRole('heading', {
    level: 2,
    name: /^Ontem, \d+ de \w+ de \d{4}$/,
  })
  const hojeHeading = page.getByRole('heading', { level: 2, name: /^Hoje, \d+ de \w+ de \d{4}$/ })
  await expect(ontemHeading).toBeVisible(LIST_TIMEOUT)
  await expect(hojeHeading).toBeVisible()

  // "Ontem no topo" literalmente: a seção de ontem fica ACIMA da de hoje no layout.
  const ontemBox = await ontemHeading.boundingBox()
  const hojeBox = await hojeHeading.boundingBox()
  expect(ontemBox!.y).toBeLessThan(hojeBox!.y)

  // Seções escopadas (region = <section aria-label="Ontem/Hoje, …">). Os campos
  // têm os MESMOS rótulos nas duas seções, então todo localizador de valor é
  // escopado à seção para não colidir.
  const hoje = page.getByRole('region', { name: /^Hoje,/ })

  // AC5 — Health Metric Row por tipo, preenchendo os valores de HOJE:
  await hoje.getByLabel('Peso').fill('88') // integer
  await hoje.getByLabel('Temperatura').fill('36.5') // decimal
  await hoje.getByLabel('Dormiu bem').check() // boolean (switch)
  await hoje.getByLabel('Humor').click() // enum (select) → opção no popover
  await page.getByRole('option', { name: 'Bom' }).click()
  await hoje.getByLabel('Observações').fill('dia tranquilo') // text

  // AC5 — salvar-por-dia + confirmação inline discreta (role=status), texto literal.
  await hoje.getByRole('button', { name: 'Salvar' }).click()
  await expect(hoje.getByText('Dados de hoje salvos.')).toBeVisible(SAVE_TIMEOUT)

  // AC1/AC2 — persistência real + round-trip por UUID: recarregar reidrata do
  // backend (não de cache otimista); os valores chaveados por UUID voltam idênticos.
  await page.reload()
  await expect(page.getByRole('main', { name: 'Métricas de Saúde' })).toBeVisible()
  const hoje2 = page.getByRole('region', { name: /^Hoje,/ })
  await expect(hoje2.getByLabel('Peso')).toHaveValue('88', LIST_TIMEOUT)
  await expect(hoje2.getByLabel('Temperatura')).toHaveValue('36.5')
  await expect(hoje2.getByLabel('Dormiu bem')).toBeChecked()
  await expect(hoje2.getByText('Bom')).toBeVisible()
  await expect(hoje2.getByLabel('Observações')).toHaveValue('dia tranquilo')

  // AC3/AC5 — a seção de ONTEM salva independentemente, com a SUA confirmação
  // ("Dados de ontem salvos.") e numa LINHA própria por (user, date).
  const ontem2 = page.getByRole('region', { name: /^Ontem,/ })
  await ontem2.getByLabel('Peso').fill('87')
  await ontem2.getByRole('button', { name: 'Salvar' }).click()
  await expect(ontem2.getByText('Dados de ontem salvos.')).toBeVisible(SAVE_TIMEOUT)

  // Persistência do dia de ontem, e hoje segue intacto (dias são linhas independentes).
  await page.reload()
  await expect(page.getByRole('region', { name: /^Ontem,/ }).getByLabel('Peso')).toHaveValue(
    '87',
    LIST_TIMEOUT,
  )
  await expect(page.getByRole('region', { name: /^Hoje,/ }).getByLabel('Peso')).toHaveValue('88')

  expect(consoleErrors).toEqual([])
})

test('AC4 — campo desativado some do log ativo mas seu valor histórico é preservado (merge); reativar o traz de volta intacto', async ({
  page,
  email,
}) => {
  // Budget generoso: seed + fixture + múltiplos round-trips ao Neon `e2e`, cada um
  // sujeito a um stall de cold-start (~30s) — ver nota dos timeouts no topo.
  test.setTimeout(180_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  seedHealthFields(email, [
    { name: 'Peso', fieldType: 'integer' },
    { name: 'Humor', fieldType: 'enum', enumOptions: ['Bom', 'Ruim'] },
  ])

  await page.goto('/health/metrics')
  await expect(page.getByRole('main', { name: 'Métricas de Saúde' })).toBeVisible()

  // Grava valores de hoje para os dois campos.
  const hoje = page.getByRole('region', { name: /^Hoje,/ })
  await hoje.getByLabel('Peso').fill('90', LIST_TIMEOUT)
  await hoje.getByLabel('Humor').click()
  await page.getByRole('option', { name: 'Bom' }).click()
  await hoje.getByRole('button', { name: 'Salvar' }).click()
  await expect(hoje.getByText('Dados de hoje salvos.')).toBeVisible(SAVE_TIMEOUT)

  // Desativa "Humor" (Story 7.1). O valor "Bom" continua no JSONB (o merge do
  // upsert nunca apaga chaves de campos hoje inativos — AC4).
  setHealthFieldActive(email, 'Humor', false)

  await page.reload()
  await expect(page.getByRole('main', { name: 'Métricas de Saúde' })).toBeVisible()
  // AC4 — só campos ATIVOS são renderizados: "Humor" some das DUAS seções.
  await expect(page.getByLabel('Humor')).toHaveCount(0, LIST_TIMEOUT)
  // Peso (ainda ativo) segue com o valor gravado.
  await expect(page.getByRole('region', { name: /^Hoje,/ }).getByLabel('Peso')).toHaveValue('90')

  // Reativa "Humor": o valor histórico "Bom" nunca foi apagado (merge, não replace).
  setHealthFieldActive(email, 'Humor', true)

  await page.reload()
  await expect(page.getByRole('main', { name: 'Métricas de Saúde' })).toBeVisible()
  const hojeComHumor = page.getByRole('region', { name: /^Hoje,/ })
  await expect(hojeComHumor.getByLabel('Humor')).toHaveCount(1, LIST_TIMEOUT)
  // O valor histórico reaparece intacto na Row reativada.
  await expect(hojeComHumor.getByText('Bom')).toBeVisible()
  await expect(hojeComHumor.getByLabel('Peso')).toHaveValue('90')

  expect(consoleErrors).toEqual([])
})

test('AC5 — sem campos de saúde ativos: mensagem neutra + uma ação (link para Configurações › Métricas de Saúde)', async ({
  page,
}) => {
  // Usuário recém-criado (fixture) ainda não tem NENHUMA definição de campo.
  await page.goto('/health/metrics')
  await expect(page.getByRole('main', { name: 'Métricas de Saúde' })).toBeVisible()

  // Empty state: uma frase factual (voz UX-DR13, sem gamificação) + até uma ação.
  await expect(page.getByText('Nenhum campo de saúde ativo.')).toBeVisible(LIST_TIMEOUT)
  const link = page.getByRole('link', { name: 'Configurar métricas de saúde' })
  await expect(link).toBeVisible()

  // A única ação leva à tela de config da Story 7.1.
  await link.click()
  await expect(page).toHaveURL('/settings/health-metrics')
  await expect(
    page.getByRole('main', { name: 'Configurações — Métricas de Saúde' }),
  ).toBeVisible()
})

test('AC1/AC5 — valor incompatível com o tipo é rejeitado pelo backend real (grava só se tudo válido): erro de escrita inline, input preservado, retry corrige', async ({
  page,
  email,
}) => {
  // Budget generoso: seed + fixture + múltiplos round-trips ao Neon `e2e`, cada um
  // sujeito a um stall de cold-start (~30s) — ver nota dos timeouts no topo.
  test.setTimeout(180_000)

  seedHealthFields(email, [{ name: 'Peso', fieldType: 'integer' }])

  await page.goto('/health/metrics')
  await expect(page.getByRole('main', { name: 'Métricas de Saúde' })).toBeVisible()

  const hoje = page.getByRole('region', { name: /^Hoje,/ })
  // "1.5" num campo INTEGER: o front envia o número 1.5; a validação-contra-
  // definição (camada de serviço) o rejeita (não é inteiro) → 409. Prova o "grava
  // só se tudo válido" (AC1) pelo lado negativo, ponta-a-ponta contra o backend real.
  await hoje.getByLabel('Peso').fill('1.5', LIST_TIMEOUT)
  await hoje.getByRole('button', { name: 'Salvar' }).click()

  // AC5 — erro de escrita: mensagem inline factual (constante única, role=alert)
  // e NADA persistido (a linha do dia não recebeu o valor inválido).
  await expect(hoje.getByText('Não foi possível salvar. Tente novamente.')).toBeVisible(
    SAVE_TIMEOUT,
  )
  // Input preservado: o "1.5" continua no campo para o retry.
  await expect(hoje.getByLabel('Peso')).toHaveValue('1.5')

  // Retry com um valor válido: agora grava e confirma.
  await hoje.getByLabel('Peso').fill('88')
  await hoje.getByRole('button', { name: 'Salvar' }).click()
  await expect(hoje.getByText('Dados de hoje salvos.')).toBeVisible(SAVE_TIMEOUT)

  // Persistência real: recarregar reidrata 88 e a mensagem de erro sumiu.
  await page.reload()
  const hoje2 = page.getByRole('region', { name: /^Hoje,/ })
  await expect(hoje2.getByLabel('Peso')).toHaveValue('88', LIST_TIMEOUT)
  await expect(page.getByText('Não foi possível salvar. Tente novamente.')).toHaveCount(0)
})
