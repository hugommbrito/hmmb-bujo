import { test, expect, E2E_PASSWORD } from './fixtures'
import { countRitualContainers } from './countRitualContainers'
import { navigate } from './shellHelpers'
import type { APIRequestContext } from '@playwright/test'

// Cobre a Story 14.2 (fontes dos rituais, decisões-snapshot e densidade real)
// contra o backend REAL da branch Neon `e2e`, onde a migration
// `0008_ritual_decisions` já está aplicada. A story é backend puro ("nenhuma
// superfície de UI nova"), então o valor deste spec NÃO é reexercitar a matriz de
// decisões nem a elegibilidade das fontes — o pytest já as cobre exaustivamente em
// Postgres local. O que só aqui é verificável:
//
// 1. **AC7 no banco real**: as nove leituras (7 fontes + 2 densidades) percorridas
//    pelo ciclo de request completo não criam container nenhum. A contagem vem de
//    FORA do fio (`countRitualContainers`), porque contar pela API é impossível:
//    `GET /api/bujo/logs/weekly/` materializa de propósito.
// 2. **AC1/AC2 sob concorrência real**: dois POSTs simultâneos da mesma decisão
//    convergem para UMA linha. Isso é o índice único PARCIAL da `0008` fazendo
//    efeito no Postgres de verdade — o `get`-antes-de-`create` do serviço, sozinho,
//    não impede a corrida (que é o clique duplo do usuário no ritual).
// 3. **AC6 confrontada com a superfície que o usuário vê**: a densidade nova conta
//    a subtarefa que a página "Esta Semana" mostra ANINHADA sob o pai — e a conta
//    numa faixa diferente da que o olho sugere. Nenhum teste de unidade compara as
//    duas leituras.
//
// Nenhum locator de campo de formulário sem escopo é usado: desde a Story 13.3 o
// `BrainDumpCaptureSheet` monta um `Título *` oculto e portalizado em TODA rota, e
// `getByLabel('Título')` sem escopo resolve para ele (causa das falhas
// pré-existentes de `weekly-monthly-task-crud.spec.ts`). Toda escrita deste spec
// acontece pelo fio, como a UI das Stories 14.5/14.6 fará.

const API = 'http://localhost:8000'

interface SourceEnvelope {
  sourceId: string
  blocking: boolean
  countsTowardProgress: boolean
  eligibleCount: number
  pendingDecisionCount: number
  reviewed: boolean
  items?: { decision: string | null; task?: { id: string }; template?: { id: string } }[]
  groups?: { date: string; items: unknown[] }[]
  readyToFinalize?: boolean
  alreadyPlaced?: { countsTowardProgress: boolean; items: unknown[] }
  alreadyPlacedInYear?: { countsTowardProgress: boolean; items: unknown[] }
}

interface DensityGrid {
  days: { date: string; total: number; byStatus: Record<string, number> }[]
  undated: { total: number; byStatus: Record<string, number> }
  total: number
}

const FONTES_SEMANAIS = ['monthly-in-week', 'recurring', 'previous-weekly', 'pending-dailies']
const FONTES_MENSAIS = ['recurring', 'future-log', 'previous-monthly']

// Cliente HTTP na sessão do próprio usuário do teste. Os 10 endpoints da 14.2 não
// têm UI nesta onda — o ritual é executado pelo fio, do mesmo jeito que a UI futura
// o fará (query param em snake_case, corpo e resposta em camelCase).
async function ritualApi(request: APIRequestContext, email: string) {
  const tokenResponse = await request.post(`${API}/api/accounts/token/`, {
    data: { email, password: E2E_PASSWORD },
  })
  expect(tokenResponse.status()).toBe(200)
  const { access } = (await tokenResponse.json()) as { access: string }
  const headers = { Authorization: `Bearer ${access}` }

  return {
    headers,
    async weekSource(name: string, weekStart: string) {
      const response = await request.get(
        `${API}/api/bujo/rituals/weekly/sources/${name}/?week_start=${weekStart}`,
        { headers },
      )
      expect(response.status(), `fonte semanal ${name}`).toBe(200)
      return (await response.json()) as SourceEnvelope
    },
    async monthSource(name: string, monthFirst: string) {
      const response = await request.get(
        `${API}/api/bujo/rituals/monthly/sources/${name}/?month_first=${monthFirst}`,
        { headers },
      )
      expect(response.status(), `fonte mensal ${name}`).toBe(200)
      return (await response.json()) as SourceEnvelope
    },
    async weekDensity(weekStart: string) {
      const response = await request.get(
        `${API}/api/bujo/rituals/weekly/density/?week_start=${weekStart}`,
        { headers },
      )
      expect(response.status()).toBe(200)
      return (await response.json()) as DensityGrid
    },
    async monthDensity(monthFirst: string) {
      const response = await request.get(
        `${API}/api/bujo/rituals/monthly/density/?month_first=${monthFirst}`,
        { headers },
      )
      expect(response.status()).toBe(200)
      return (await response.json()) as DensityGrid
    },
    decide(data: Record<string, string>) {
      return request.post(`${API}/api/bujo/ritual-decisions/`, { headers, data })
    },
    cycle(kind: 'weekly' | 'monthly', data: Record<string, string>) {
      return request.post(`${API}/api/bujo/logs/${kind}/cycle/`, { headers, data })
    },
    async weeklyLog() {
      const response = await request.get(`${API}/api/bujo/logs/weekly/`, { headers })
      expect(response.status()).toBe(200)
      return (await response.json()) as { weekStart: string; days: { date: string }[] }
    },
    async monthlyLog() {
      const response = await request.get(`${API}/api/bujo/logs/monthly/`, { headers })
      expect(response.status()).toBe(200)
      return (await response.json()) as { monthFirst: string }
    },
    createWeeklyTask(data: Record<string, string>) {
      return request.post(`${API}/api/bujo/logs/weekly/`, { headers, data })
    },
    createMonthlyTask(data: Record<string, string>) {
      return request.post(`${API}/api/bujo/logs/monthly/`, { headers, data })
    },
    createSubtask(taskId: string, title: string) {
      return request.post(`${API}/api/bujo/tasks/${taskId}/subtasks/`, { headers, data: { title } })
    },
    createTemplate(data: Record<string, string>) {
      return request.post(`${API}/api/bujo/recurring-templates/`, { headers, data })
    },
  }
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function addMonths(monthFirst: string, months: number): string {
  const d = new Date(`${monthFirst}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + months)
  return `${d.toISOString().slice(0, 8)}01`
}

test('as nove leituras de ritual não materializam container no banco real (AC7)', async ({
  page,
  email,
  request,
}) => {
  test.setTimeout(120_000)
  const api = await ritualApi(request, email)

  // Navegar o app materializa os logs de HOJE (comportamento legado, blindado pela
  // AC4 da 14.1). Depois disso o cenário fica estável e qualquer linha nova só pode
  // ter vindo das leituras de ritual.
  await navigate(page, 'Esta Semana')
  await navigate(page, 'Este Mês')

  const semanaFutura = addDays((await api.weeklyLog()).weekStart, 8 * 7)
  const mesFuturo = addMonths((await api.monthlyLog()).monthFirst, 8)
  const antes = countRitualContainers(email)

  for (const nome of FONTES_SEMANAIS) {
    const fonte = await api.weekSource(nome, semanaFutura)
    // Fonte vazia é REVISADA (M06/M07) — o marco não depende de haver item.
    expect(fonte.eligibleCount, nome).toBe(0)
    expect(fonte.pendingDecisionCount, nome).toBe(0)
    expect(fonte.reviewed, nome).toBe(true)
  }
  for (const nome of FONTES_MENSAIS) {
    const fonte = await api.monthSource(nome, mesFuturo)
    expect(fonte.eligibleCount, nome).toBe(0)
    expect(fonte.reviewed, nome).toBe(true)
  }

  // A única fonte bloqueante de cada ritual: sem log anterior, vazia e NÃO pronta —
  // o gate de Iniciar passa por vacuidade, não por "pronta para finalizar".
  expect((await api.weekSource('previous-weekly', semanaFutura)).readyToFinalize).toBe(false)
  expect((await api.monthSource('previous-monthly', mesFuturo)).readyToFinalize).toBe(false)

  // Densidade de chave sem log: grade COMPLETA e zerada, não 404 nem lista vazia.
  const densidadeSemana = await api.weekDensity(semanaFutura)
  expect(densidadeSemana.days).toHaveLength(7)
  expect(densidadeSemana.total).toBe(0)
  expect(Object.keys(densidadeSemana.days[0].byStatus).sort()).toEqual([
    'cancelled',
    'completed',
    'migrated',
    'pending',
    'postponed',
    'started',
  ])
  const densidadeMes = await api.monthDensity(mesFuturo)
  expect(densidadeMes.total).toBe(0)
  expect(densidadeMes.days.length).toBeGreaterThanOrEqual(28)
  expect(densidadeMes.days[0].date).toBe(mesFuturo)

  // O invariante da AC7: nove leituras, zero linhas novas.
  expect(countRitualContainers(email)).toEqual(antes)
})

test('laço do ritual semanal e upsert sob concorrência valem no banco real (AC1, AC2, AC5)', async ({
  page,
  email,
  request,
}) => {
  test.setTimeout(120_000)
  const api = await ritualApi(request, email)

  await navigate(page, 'Esta Semana')
  await navigate(page, 'Este Mês')
  const { weekStart, days } = await api.weeklyLog()
  const { monthFirst } = await api.monthlyLog()

  // Decisão-snapshot só existe em alvo `planning` (14.1 AC2 + 14.2 AC2).
  expect((await api.cycle('weekly', { action: 'open_planning_target' })).status()).toBe(200)

  // Fonte "Monthly na semana": tarefa do Monthly datada DENTRO da semana-alvo. Um
  // dia da semana que também pertence ao mês corrente sempre existe (hoje é um).
  const diaNoMes = days.map((d) => d.date).find((d) => d.startsWith(monthFirst.slice(0, 7)))
  expect(diaNoMes, 'a semana corrente sempre tem ao menos um dia do mês corrente').toBeTruthy()
  const criacao = await api.createMonthlyTask({
    monthFirst,
    title: 'Renovar o seguro',
    scheduledDate: diaNoMes as string,
  })
  expect(criacao.status()).toBe(201)
  const tarefaId = ((await criacao.json()) as { id: string }).id

  const antes = await api.weekSource('monthly-in-week', weekStart)
  expect(antes.eligibleCount).toBe(1)
  expect(antes.pendingDecisionCount).toBe(1)
  expect(antes.reviewed).toBe(false)
  expect(antes.items?.[0].decision).toBeNull()

  expect((await api.decide({ decision: 'keep', weekStart, taskId: tarefaId })).status()).toBe(201)

  // A assimetria que define "decisão-snapshot": a pendência zera, a ELEGIBILIDADE
  // não muda (a Task continua na fonte, intocada — AD-28 item 6 ponto 8).
  const depois = await api.weekSource('monthly-in-week', weekStart)
  expect(depois.eligibleCount).toBe(1)
  expect(depois.pendingDecisionCount).toBe(0)
  expect(depois.reviewed).toBe(true)
  expect(depois.items?.[0].decision).toBe('keep')

  // Fonte "Recorrentes": `skip_week` decide sobre um TEMPLATE, não sobre uma Task.
  const template = await api.createTemplate({
    title: 'Regar as plantas',
    recurrenceGroup: 'weekly',
    recurrenceText: 'toda semana',
  })
  expect(template.status()).toBe(201)
  const templateId = ((await template.json()) as { id: string }).id
  expect((await api.weekSource('recurring', weekStart)).pendingDecisionCount).toBe(1)

  // Dois POSTs SIMULTÂNEOS da mesma decisão. Sem o índice único parcial da `0008`
  // no banco real, a corrida entre o `get` e o `create` do serviço produziria duas
  // linhas e dois ids. Convergir para o mesmo id é a evidência do índice — e é a
  // situação real de um clique duplo no ritual.
  const [a, b] = await Promise.all([
    api.decide({ decision: 'skip_week', weekStart, recurringTemplateId: templateId }),
    api.decide({ decision: 'skip_week', weekStart, recurringTemplateId: templateId }),
  ])
  expect(a.status()).toBe(201)
  expect(b.status()).toBe(201)
  expect(((await a.json()) as { id: string }).id).toBe(((await b.json()) as { id: string }).id)
  expect(countRitualContainers(email).decisions).toBe(2) // `keep` + UM `skip_week`

  const recorrentes = await api.weekSource('recurring', weekStart)
  expect(recorrentes.pendingDecisionCount).toBe(0)
  expect(recorrentes.reviewed).toBe(true)
  // O template continua elegível e listado: "não alocar nesta semana" remove o
  // aviso, não o template (M06). E nenhuma Task nasceu da decisão — a densidade,
  // que só conta materializados, segue zerada.
  expect(recorrentes.eligibleCount).toBe(1)
  expect(recorrentes.items?.[0].decision).toBe('skip_week')
  expect((await api.weekDensity(weekStart)).total).toBe(0)
})

test('a densidade nova conta a subtarefa que a semana real mostra (AC6, AC8)', async ({
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

  const api = await ritualApi(request, email)
  await navigate(page, 'Esta Semana')
  const { weekStart, days } = await api.weeklyLog()
  const primeiroDia = days[0].date

  const raiz = await api.createWeeklyTask({
    weekStart,
    title: 'Preparar a retrospectiva',
    scheduledDate: primeiroDia,
  })
  expect(raiz.status()).toBe(201)
  const raizId = ((await raiz.json()) as { id: string }).id
  expect((await api.createSubtask(raizId, 'Levantar os números')).status()).toBe(201)
  expect((await api.createWeeklyTask({ weekStart, title: 'Sem dia definido' })).status()).toBe(201)

  // A superfície que o usuário vê: a grade da semana lista a RAIZ no primeiro dia e
  // a subtarefa ANINHADA sob ela (a listagem filtra `parent_task__isnull=True` nas
  // raízes, mas o `TaskSerializer` serializa `subtasks` dentro de cada raiz).
  await navigate(page, 'Hoje')
  await navigate(page, 'Esta Semana')
  await expect(page.getByText('Preparar a retrospectiva')).toBeVisible()
  await expect(page.getByText('Levantar os números')).toBeVisible()

  // A divergência que só este confronto expõe, e que a UI das 14.5/14.6 precisa
  // conhecer: a subtarefa herda o CONTAINER do pai, mas não a DATA
  // (`SubtaskCreateView` não aceita `scheduledDate`). Aos olhos ela mora no dia do
  // pai; para a densidade ela é `undated`, porque a faixa é definida pelo
  // `scheduled_date` do próprio registro. Daí `undated.total === 2` — e é aí que a
  // inclusão de subtarefas fica mensurável: com o `parent_task__isnull=True` de toda
  // listagem, esse número seria 1 e o total, 2.
  const densidade = await api.weekDensity(weekStart)
  expect(densidade.days).toHaveLength(7)
  const celula = densidade.days.find((d) => d.date === primeiroDia)
  expect(celula?.total).toBe(1)
  expect(celula?.byStatus.pending).toBe(1)
  expect(densidade.undated.total).toBe(2) // subtarefa + tarefa sem dia
  expect(densidade.undated.byStatus.pending).toBe(2)
  expect(densidade.total).toBe(3)

  // AC8 no backend real: o endpoint legado de densidade — consumido hoje pelo
  // frontend — segue vivo, com a rota e a chave de sempre.
  const { monthFirst } = await api.monthlyLog()
  const legado = await request.get(`${API}/api/bujo/task-density/?month_first=${monthFirst}`, {
    headers: api.headers,
  })
  expect(legado.status()).toBe(200)
  expect(Object.keys((await legado.json()) as object)).toEqual(['density'])

  expect(consoleErrors).toEqual([])
})
