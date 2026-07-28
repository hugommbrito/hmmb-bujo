import type { APIRequestContext } from '@playwright/test'

import { countRitualContainers } from './countRitualContainers'
import { test, expect, E2E_PASSWORD } from './fixtures'
import { seedCatchUpScenario } from './seedCatchUpScenario'
import { seedYesterdayQueue } from './seedYesterdayQueue'

// Cobre a Story 14.3 (fila unificada de migração + aliases finos) contra o backend
// REAL da branch Neon `e2e`. A story é backend puro — "nenhuma superfície de UI
// nova" —, então o valor deste spec NÃO é reexercitar fronteiras, ordenação ou
// herança: o pytest já as cobre exaustivamente em Postgres local. O que só aqui é
// verificável:
//
// 1. **AC5/AC6 confrontadas com a superfície que o usuário vê.** Os dois aliases
//    passaram a projetar `unified_migration_queue`, e a premissa blindada do épico
//    é que o Daily LEGADO siga funcionando sem uma linha alterada. O pytest compara
//    JSON com JSON; aqui as contagens dos DOIS banners renderizados são
//    confrontadas com o `totalCount` do endpoint novo, no mesmo instante e no mesmo
//    banco. Se a projeção divergisse, o número que o usuário lê divergiria do
//    número que a 14.9 vai ler — e nenhum teste abaixo do fio pega isso.
// 2. **AC3 no banco real, pela UI real.** "Retomar traz só os restantes" é
//    consequência da re-derivação: decidir pelo `MigrationFlow` legado tem que
//    escoar a fila unificada, e `ritual_decisions` tem que continuar VAZIA
//    (AD-28 item 6 — a mutação é a persistência). A contagem de `RitualDecision`
//    vem de FORA do fio, porque não há endpoint de leitura para ela (decisão de
//    produto da 14.2, Questões abertas #4).
// 3. **AC2 (zero materialização) no Postgres de verdade.** O pytest prova em banco
//    efêmero; aqui a prova atravessa o ciclo de request completo (JWT + middleware
//    de tenant) num banco onde o Daily Log de hoje já foi materializado pelo
//    signup, e a contagem vem de fora do fio — contar containers PELA API é
//    impossível, porque `GET /api/bujo/logs/weekly/` faz `get_or_create` de
//    propósito (AC4 da 14.1).
//
// Nenhum locator de campo de formulário sem escopo é usado: desde a Story 13.3 o
// `BrainDumpCaptureSheet` monta um `Título *` oculto e portalizado em TODA rota
// (causa das falhas pré-existentes de `weekly-monthly-task-crud.spec.ts`).

const API = 'http://localhost:8000'

interface UnifiedQueueSection {
  sourceId: string
  count: number
  groups: { periodStart: string; items: { id: string }[] }[]
}

interface UnifiedQueue {
  totalCount: number
  sections: UnifiedQueueSection[]
}

interface MigrationQueue {
  logDate: string
  tasks: { id: string }[]
}

interface CatchUpQueue {
  monthlyTasks: { id: string }[]
  weeklyTasks: { id: string }[]
  dailyTasks: { id: string }[]
}

// Cliente HTTP na sessão do próprio usuário do teste. A fila unificada não tem
// consumidor no frontend nesta onda (a 14.9 a consome), então ela é lida pelo fio —
// do mesmo jeito que a UI futura o fará.
async function queueApi(request: APIRequestContext, email: string) {
  const tokenResponse = await request.post(`${API}/api/accounts/token/`, {
    data: { email, password: E2E_PASSWORD },
  })
  expect(tokenResponse.status()).toBe(200)
  const { access } = (await tokenResponse.json()) as { access: string }
  const headers = { Authorization: `Bearer ${access}` }

  async function get<T>(path: string): Promise<T> {
    const response = await request.get(`${API}${path}`, { headers })
    expect(response.status(), path).toBe(200)
    return (await response.json()) as T
  }

  return {
    unified: () => get<UnifiedQueue>('/api/bujo/migration/unified-queue/'),
    migration: () => get<MigrationQueue>('/api/bujo/migration/queue/'),
    catchUp: () => get<CatchUpQueue>('/api/bujo/catch-up/queue/'),
  }
}

function topLevelIds(queue: UnifiedQueue): string[] {
  return queue.sections.flatMap((section) =>
    section.groups.flatMap((group) => group.items.map((item) => item.id)),
  )
}

test('o banner unificado (Story 14.9) e a fila unificada contam a mesma coisa no banco real (AC5, AC6)', async ({
  page,
  email,
  request,
}) => {
  // Seed nos três níveis ANTIGOS (fora das janelas de ontem/semana anterior/mês
  // anterior) + uma pendência de ONTEM, que é o território exclusivo do alias
  // `/migration/queue/`.
  seedCatchUpScenario(email, {
    monthlyTasks: [{ title: 'Fechar orçamento de trimestre' }],
    weeklyTasks: [
      { title: 'Revisar backlog antigo', children: [{ title: 'Subtarefa aberta antiga' }] },
    ],
    dailyTasks: [{ title: 'Tarefa diária de dez dias atrás' }],
  })
  seedYesterdayQueue(email, [{ title: 'Pendência de ontem' }])
  await page.reload()

  // A superfície NOVA (Story 14.9): UM banner só, com a soma das 3 fontes —
  // `MigrationBanner`/`CatchUpBanner` legados seguem no repo (intocados em
  // comportamento), só desmontados de `DailyPage.tsx`.
  const banner = page.getByRole('region', { name: /tarefas precisam de decisão/ })
  await expect(banner).toBeVisible()
  await expect(banner).toHaveAccessibleName('4 tarefas precisam de decisão · 1 de meses · 1 de semanas · 2 de dias')

  const api = await queueApi(request, email)
  const [unified, migration, catchUp] = await Promise.all([
    api.unified(),
    api.migration(),
    api.catchUp(),
  ])

  // O número da faixa do Hoje (14.9) é exatamente a soma do que os dois banners
  // legados mostram — 1 + 3. A subtarefa aberta não conta em nenhum dos dois: ela
  // viaja ANINHADA na raiz, não como item de topo.
  expect(unified.totalCount).toBe(4)
  expect(unified.totalCount).toBe(
    migration.tasks.length +
      catchUp.monthlyTasks.length +
      catchUp.weeklyTasks.length +
      catchUp.dailyTasks.length,
  )
  expect(unified.sections.map((section) => [section.sourceId, section.count])).toEqual([
    ['month', 1],
    ['week', 1],
    ['day', 2],
  ])

  // Equivalência de CONJUNTO (AC6), agora no banco real: a união dos dois aliases é
  // exatamente a fila unificada, sem dedup — `Task` tem um container só.
  const aliasIds = [
    ...migration.tasks,
    ...catchUp.monthlyTasks,
    ...catchUp.weeklyTasks,
    ...catchUp.dailyTasks,
  ].map((task) => task.id)
  expect(new Set(aliasIds)).toEqual(new Set(topLevelIds(unified)))
  expect(aliasIds).toHaveLength(topLevelIds(unified).length)

  // A partição de ontem entre os dois aliases, no fio real: o `logDate` do alias é o
  // `periodStart` do grupo mais NOVO da seção `day`, e esse grupo não está na
  // catch-up.
  const daySection = unified.sections.find((section) => section.sourceId === 'day')
  expect(daySection?.groups.map((group) => group.periodStart).at(-1)).toBe(migration.logDate)
  expect(catchUp.dailyTasks.map((task) => task.id)).not.toContain(migration.tasks[0].id)
})

test('decidir pelo ritual roteado (Story 14.9) escoa a fila unificada e não grava decisão de ritual (AC3)', async ({
  page,
  email,
  request,
}) => {
  seedCatchUpScenario(email, { dailyTasks: [{ title: 'Tarefa diária antiga' }] })
  seedYesterdayQueue(email, [{ title: 'Revisar PR de ontem' }])
  await page.reload()

  const api = await queueApi(request, email)
  const antes = await api.unified()
  const decidido = (await api.migration()).tasks[0].id
  expect(antes.totalCount).toBe(2)
  expect(topLevelIds(antes)).toContain(decidido)

  // Decisão pela superfície NOVA (Story 14.9): banner unificado → ritual
  // ROTEADO → "Migrar para hoje". Mesmo verbo de escrita (`POST /migrate/`),
  // nenhum endpoint novo participa.
  await page.getByRole('link', { name: 'Migrar ›' }).click()
  await expect(page).toHaveURL('/migration')
  await expect(page.getByText('Revisar PR de ontem')).toBeVisible()
  await page.getByRole('button', { name: 'Migrar para hoje' }).click()
  await expect(page.getByText('Revisar PR de ontem')).toHaveCount(0)

  // Re-derivação: o item decidido saiu, o resto permaneceu, e a seção `day` continua
  // PRESENTE (a UI da 14.9 desenha o rail completo).
  const depois = await api.unified()
  expect(depois.totalCount).toBe(1)
  expect(depois.sections.map((section) => section.sourceId)).toEqual(['month', 'week', 'day'])
  // O sucessor nasceu no Daily Log de HOJE, por isso não reentra na fila.
  expect(topLevelIds(depois)).toEqual(topLevelIds(antes).filter((id) => id !== decidido))

  // O alias de ontem esvaziou de verdade no servidor; o de catch-up não foi tocado.
  const [migration, catchUp] = await Promise.all([api.migration(), api.catchUp()])
  expect(migration.tasks).toEqual([])
  expect(catchUp.dailyTasks).toHaveLength(1)

  // AD-28 item 6, no banco real: decisão mutante NÃO ganha registro paralelo.
  expect(countRitualContainers(email).decisions).toBe(0)
})

test('a fila unificada não materializa container nenhum no banco real (AC2)', async ({
  page,
  email,
  request,
}) => {
  // Cenário POVOADO nos três níveis: com a fila vazia o teste mediria a ausência de
  // dado, não a ausência de materialização.
  seedCatchUpScenario(email, {
    monthlyTasks: [{ title: 'Mensal antiga' }],
    weeklyTasks: [{ title: 'Semanal antiga' }],
    dailyTasks: [{ title: 'Diária antiga' }],
  })
  await page.reload()

  const api = await queueApi(request, email)
  const antes = countRitualContainers(email)

  // Três leituras seguidas + os dois aliases: se o serviço chamasse
  // `get_or_create_*_log` (o erro que a AC2 proíbe por nome), a primeira já criaria
  // o container do dia/semana/mês corrente e a contagem subiria.
  const leituras = [await api.unified(), await api.unified(), await api.unified()]
  await api.migration()
  await api.catchUp()

  for (const leitura of leituras) {
    expect(leitura.totalCount).toBe(3)
  }
  expect(countRitualContainers(email)).toEqual(antes)
})
