import { test, expect, E2E_PASSWORD } from './fixtures'
import type { APIRequestContext, Page } from '@playwright/test'

// Cobre a Story 14.4 (soft delete de templates recorrentes) contra o backend
// REAL da branch Neon `e2e`, onde a migration `0009_recurringtasktemplate_deleted_at`
// já está aplicada. A story é backend puro — "nenhuma superfície de UI nova", e o
// botão Excluir só nasce na 14.8 —, então este spec NÃO reexercita a matriz do
// soft delete (o pytest a cobre exaustivamente em Postgres local). O que só aqui
// é verificável:
//
// 1. **AC6 na superfície que o usuário vê**: "inativo = visível com filtro,
//    reversível" × "excluído = fora da biblioteca" é uma distinção de UI. O
//    pytest prova as duas linhas no fio; só o browser prova que ligar
//    "Mostrar inativos" traz o inativo de volta e **não** traz o excluído —
//    porque a biblioteca filtra `active` no CLIENTE (`RecurringTemplateManager`
//    consulta sem params) e `deleted_at` no SERVIDOR. Os dois filtros vivem em
//    camadas diferentes e só se encontram aqui.
// 2. **O consumidor real de `?unplaced_year`**: a seção "Anuais pendentes" do
//    Future Log é o único lugar do produto que emite esse query param. O pytest
//    prova o param; este spec prova a seção.
// 3. **AC5 (linhagem) no banco real**: a `Task` já alocada sobrevive à exclusão
//    do template com a FK `SET_NULL` do Postgres de verdade, e a instância
//    continua visível em "Esta Semana". Um delete físico apagaria a linhagem em
//    silêncio, e nenhum teste em SQLite/mock notaria a diferença.
// 4. **A migration na branch `e2e`**: um `DELETE` que responde 204 aqui é a prova
//    operacional de que a `0009` está aplicada onde o Playwright roda — o bug
//    recorrente das stories 7.1/7.2/14.1, que só aparece nesta camada.
//
// Toda ESCRITA acontece pelo fio (como `ritual-sources.spec.ts` da 14.2 já faz):
// não existe botão Excluir para clicar nesta onda, e as criações via API mantêm o
// spec focado na exclusão — o CRUD pela UI já é coberto por
// `recurring-templates.spec.ts`. Nenhum locator de campo de formulário sem escopo
// é usado (o `BrainDumpCaptureSheet` portaliza um `Título *` oculto em toda rota
// desde a 13.3 — causa das falhas pré-existentes de `weekly-monthly-task-crud`).

const API = 'http://localhost:8000'

interface TemplateNoFio {
  id: string
  title: string
  active: boolean
}

// Cliente HTTP na sessão do próprio usuário do teste, igual ao de
// `ritual-sources.spec.ts`: corpo/resposta em camelCase, query param em snake_case.
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
    // Exclusão LÓGICA: 204 sem corpo. Devolve o status para os testes que
    // asseram idempotência.
    async remove(id: string) {
      const response = await request.delete(`${API}/api/bujo/recurring-templates/${id}/`, {
        headers,
      })
      return response
    },
    async patchActive(id: string, active: boolean) {
      return request.patch(`${API}/api/bujo/recurring-templates/${id}/`, {
        headers,
        data: { active },
      })
    },
    async list() {
      const response = await request.get(`${API}/api/bujo/recurring-templates/`, { headers })
      expect(response.status()).toBe(200)
      return (await response.json()) as TemplateNoFio[]
    },
    // `weekStart` vem do PRÓPRIO backend (`today_for(user)`), nunca calculado em
    // Node: o fuso do usuário é autoridade de negócio e um `new Date()` local
    // erraria a segunda-feira na virada da semana.
    async currentWeekStart() {
      const response = await request.get(`${API}/api/bujo/logs/weekly/`, { headers })
      expect(response.status()).toBe(200)
      return ((await response.json()) as { weekStart: string }).weekStart
    },
    async place(id: string, weekStart: string) {
      const response = await request.post(
        `${API}/api/bujo/recurring-templates/${id}/place/`,
        { headers, data: { weekStart } },
      )
      expect(response.status(), 'placement do template').toBe(201)
    },
  }
}

// Recarrega e ESPERA a listagem chegar do servidor. Sem isso, um assert de
// ausência passaria por página ainda vazia — o modo mais barato de escrever um
// teste vacuoso nesta suíte. Todo assert de "sumiu" deste spec vem depois de um
// assert de "continua aqui" na MESMA renderização, que é a prova de que os dados
// frescos já estão em tela.
async function reloadAndWaitTemplates(page: Page) {
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/bujo/recurring-templates/') &&
        response.request().method() === 'GET' &&
        response.ok(),
    ),
    page.reload(),
  ])
}

test('AC6 na biblioteca real: o excluído não volta nem com "Mostrar inativos" ligado, o inativo volta', async ({
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
  const vivo = await api.create({
    title: 'Regar as plantas',
    recurrenceGroup: 'weekly',
    recurrenceText: 'toda segunda',
  })
  const inativo = await api.create({
    title: 'Alongar de manhã',
    recurrenceGroup: 'weekly',
    recurrenceText: 'todo dia útil',
  })
  const excluido = await api.create({
    title: 'Assinatura cancelada',
    recurrenceGroup: 'weekly',
    recurrenceText: 'toda sexta',
  })
  await api.deactivate(inativo.id)

  await page.getByRole('button', { name: 'Recorrentes' }).click()
  await expect(page.getByLabel('Recorrentes')).toBeVisible()

  // Estado inicial: os três existem, e o inativo já está escondido pelo filtro
  // client-side (default: só ativos) — o comportamento da 11.2, intocado.
  await expect(page.getByText('Regar as plantas', { exact: true })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Assinatura cancelada', { exact: true })).toBeVisible()
  await expect(page.getByText('Alongar de manhã', { exact: true })).toHaveCount(0)

  // Story 14.8: agora existe botão Excluir para clicar — a exclusão passa a
  // acontecer PELA UI (card de edição → lixeira → confirmar no alertdialog),
  // não mais por `api.remove()` direto. A tese do teste (AC6) é a mesma.
  await page.getByRole('button', { name: `Editar ${excluido.title}` }).click()
  const card = page.getByRole('dialog', { name: 'Detalhe do template' })
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: 'Excluir template' }).click()
  const confirmDialog = page.getByRole('alertdialog', { name: 'Confirmar exclusão' })
  await expect(confirmDialog).toBeVisible()
  await confirmDialog.getByRole('button', { name: 'Excluir' }).click()
  await expect(confirmDialog).toHaveCount(0)
  await expect(card).toHaveCount(0)

  // Ordem deliberada: primeiro o assert de PRESENÇA (prova que a listagem fresca
  // renderizou), depois o de ausência.
  await expect(page.getByText('Regar as plantas', { exact: true })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Assinatura cancelada', { exact: true })).toHaveCount(0)

  // O CORAÇÃO DESTE SPEC: ligar "Mostrar inativos" traz o inativo de volta —
  // com o CHIP textual "inativo" (M09 trocou o sufixo " (inativo)" concatenado
  // na subline por um chip próprio; a tese "o inativo volta com o filtro" é a
  // mesma, só o locator muda) — e NÃO traz o excluído. Os dois estados são
  // indistintos nesta tela sem o toggle; com ele, a distinção da AC6 fica
  // visível. Escopo por `listitem` (papel/nome estável) em vez do antigo
  // `xpath=ancestor::div[2]`, frágil por construção.
  await page.getByRole('checkbox', { name: 'Mostrar inativos' }).click()
  const linhaDoInativo = page.getByRole('listitem').filter({ hasText: 'Alongar de manhã' })
  await expect(linhaDoInativo).toBeVisible({ timeout: 10_000 })
  await expect(linhaDoInativo.getByText('Semanal — todo dia útil', { exact: true })).toBeVisible()
  await expect(linhaDoInativo.getByText('inativo', { exact: true })).toBeVisible()
  await expect(page.getByText('Assinatura cancelada', { exact: true })).toHaveCount(0)

  // Reversibilidade do `active` na superfície, contra a irreversibilidade do
  // `deleted_at`: o inativo tem botão "Ativar" e volta a ativo pela UI; o
  // excluído não tem linha, logo não tem botão nenhum.
  await linhaDoInativo.getByRole('button', { name: 'Ativar' }).click()
  const linhaReativada = page.getByRole('listitem').filter({ hasText: 'Alongar de manhã' })
  await expect(linhaReativada.getByText('inativo', { exact: true })).toHaveCount(0, {
    timeout: 10_000,
  })

  await page.getByRole('checkbox', { name: 'Mostrar inativos' }).click()
  await expect(page.getByText('Alongar de manhã', { exact: true })).toBeVisible()
  await expect(page.getByText('Assinatura cancelada', { exact: true })).toHaveCount(0)

  // O estado do SERVIDOR por trás da tela: a listagem devolve os dois vivos (o
  // reativado incluído) e não devolve o excluído. Fecha o raciocínio do teste —
  // o que a UI esconde por filtro client-side ainda existe na resposta; o que o
  // soft delete removeu não existe em resposta nenhuma.
  const idsNoServidor = (await api.list()).map((template) => template.id).sort()
  expect(idsNoServidor).toEqual([vivo.id, inativo.id].sort())
  expect(idsNoServidor).not.toContain(excluido.id)

  expect(consoleErrors).toEqual([])
})

test('Future Log real: o anual excluído sai de "Anuais pendentes" (consumidor de ?unplaced_year) e o vivo permanece', async ({
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

  const anoCorrente = new Date().getFullYear()
  const api = await templatesApi(request, email)
  await api.create({
    title: 'Balanço anual',
    recurrenceGroup: 'annual',
    recurrenceText: 'todo janeiro',
  })
  const extinto = await api.create({
    title: 'Evento extinto',
    recurrenceGroup: 'annual',
    recurrenceText: 'todo dezembro',
  })

  await page.getByRole('button', { name: 'Futuro' }).click()
  await expect(page.getByLabel('Futuro')).toBeVisible()

  // Escopado ao container da seção (não à página): o Future Log lista instâncias
  // colocadas com o mesmo texto em outros meses, então `getByText` solto daria
  // falso positivo — mesma precaução de `future-log-annual.spec.ts`.
  // Story 14.7 (AC6/AC9): o container passou a ser `role="region"` com nome
  // próprio; a TESE deste teste (o excluído sai da elegibilidade sem levar a
  // seção embora) fica literalmente preservada.
  const secaoAnuaisPendentes = page.getByRole('region', {
    name: `Anuais pendentes de ${anoCorrente}`,
  })
  await expect(secaoAnuaisPendentes).toBeVisible({ timeout: 10_000 })
  await expect(secaoAnuaisPendentes.getByText('Balanço anual', { exact: true })).toBeVisible()
  await expect(secaoAnuaisPendentes.getByText('Evento extinto', { exact: true })).toBeVisible()

  expect((await api.remove(extinto.id)).status()).toBe(204)
  await reloadAndWaitTemplates(page)

  // A seção continua existindo (o vivo a sustenta): o excluído sai da
  // elegibilidade anual sem levar a seção embora — se o filtro tivesse vazado
  // para além do combinado, a seção inteira desapareceria.
  await expect(secaoAnuaisPendentes.getByText('Balanço anual', { exact: true })).toBeVisible({
    timeout: 10_000,
  })
  await expect(secaoAnuaisPendentes.getByText('Evento extinto', { exact: true })).toHaveCount(0)

  expect(consoleErrors).toEqual([])
})

// Achado do passo de QA da Story 14.7 (registro, não conserto — a causa raiz é
// de outra story e a decisão é de produto): este teste FALHA em
// `getByText('Revisar finanças — Semanal')` porque a seção de placement de
// recorrentes vive em `WeeklyPage.tsx` (legada) e `planner/week` monta o
// `WeeklyBoardPage` desde a Story 14.5 — a superfície nova não porta a seção.
// Mesma classe (e mesmo tratamento: manter EXECUTÁVEL, nunca deletar nem
// `.skip`) dos 4 testes conhecidos de `move-task.spec.ts`. A tese sobre o
// Future Log — o anual excluído sai de "Anuais pendentes" — está no teste
// ACIMA, que a 14.7 atualizou e que passa.
test('AC5 no banco real: a instância alocada sobrevive à exclusão do template, que sai da seção de placement até com "Mostrar já colocados"', async ({
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
  const comInstancia = await api.create({
    title: 'Reunião semanal',
    recurrenceGroup: 'weekly',
    recurrenceText: 'toda segunda',
  })
  const semInstancia = await api.create({
    title: 'Revisar finanças',
    recurrenceGroup: 'weekly',
    recurrenceText: 'toda sexta',
  })
  await api.place(comInstancia.id, await api.currentWeekStart())

  await page.getByRole('button', { name: 'Esta Semana' }).click()
  await expect(page.getByLabel('Esta Semana')).toBeVisible()
  // A instância existe como Task de verdade (snapshot com linhagem) e cai em
  // "Sem dia definido" — placement sem data.
  await expect(page.getByTestId('task-row').filter({ hasText: 'Reunião semanal' })).toBeVisible({
    timeout: 10_000,
  })
  // Na seção de placement o template com instância está escondido pelo DEDUP da
  // 11.3 (não por exclusão): "Mostrar já colocados" o traz de volta. É esse
  // caminho de volta que a exclusão precisa fechar.
  await expect(page.getByText('Revisar finanças — Semanal')).toBeVisible()
  await page.getByRole('checkbox', { name: 'Mostrar já colocados' }).click()
  await expect(page.getByText('Reunião semanal — Semanal')).toBeVisible({ timeout: 10_000 })

  expect((await api.remove(comInstancia.id)).status()).toBe(204)
  await reloadAndWaitTemplates(page)

  // AC5: a Task alocada continua lá. A exclusão do template não toca a instância
  // — `source_template` fica apontando para uma linha que persiste no banco.
  await expect(page.getByTestId('task-row').filter({ hasText: 'Reunião semanal' })).toBeVisible({
    timeout: 10_000,
  })
  // E o template sumiu da fonte de placement de forma TERMINAL: nem o toggle que
  // desfaz o dedup o traz de volta (o outro template vivo prova que a seção
  // renderizou).
  await expect(page.getByText('Revisar finanças — Semanal')).toBeVisible()
  await page.getByRole('checkbox', { name: 'Mostrar já colocados' }).click()
  await expect(page.getByText('Revisar finanças — Semanal')).toBeVisible()
  await expect(page.getByText('Reunião semanal — Semanal')).toHaveCount(0)

  // "Escondido pelo dedup" × "excluído" no SERVIDOR: a biblioteca devolve só o
  // template sem instância. O que sumiu da seção de placement sumiu da origem,
  // não do toggle.
  expect((await api.list()).map((template) => template.id)).toEqual([semInstancia.id])

  expect(consoleErrors).toEqual([])
})

test('DELETE contra a branch Neon `e2e`: 204 idempotente (migration 0009 aplicada) e nenhum caminho de volta pelo PATCH', async ({
  email,
  request,
}) => {
  const api = await templatesApi(request, email)
  const descartavel = await api.create({
    title: 'Template descartável',
    recurrenceGroup: 'weekly',
    recurrenceText: 'toda terça',
  })
  const permanece = await api.create({
    title: 'Template que permanece',
    recurrenceGroup: 'weekly',
    recurrenceText: 'toda quinta',
  })

  // As duas chamadas em 204 provam a idempotência do serviço contra Postgres
  // real; a primeira, sozinha, já prova que a coluna `deleted_at` existe na
  // branch `e2e` (sem a migration a resposta seria 500 por `UndefinedColumn` —
  // o bug recorrente 7.1/7.2/14.1).
  const primeira = await api.remove(descartavel.id)
  const segunda = await api.remove(descartavel.id)
  expect(primeira.status()).toBe(204)
  expect(await primeira.body()).toHaveLength(0)
  expect(segunda.status()).toBe(204)

  // Irreversível na API, não só na UI: o `PATCH` do excluído é 404, então nem
  // reativar nem "zerar" o carimbo é alcançável.
  expect((await api.patchActive(descartavel.id, true)).status()).toBe(404)
  // O vivo continua editável — o 404 acima é do excluído, não de rota quebrada.
  expect((await api.patchActive(permanece.id, true)).status()).toBe(200)

  // A listagem do backend real devolve exatamente o vivo: o excluído sumiu e a
  // resposta não é uma lista vazia por erro disfarçado.
  expect((await api.list()).map((template) => template.id)).toEqual([permanece.id])
})
