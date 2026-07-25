import { test, expect, E2E_PASSWORD } from './fixtures'
import { seedFinalizedEmptyWeekly } from './seedFinalizedEmptyCycle'
import type { APIRequestContext, Page } from '@playwright/test'

// Cobre a Story 14.1 (ciclos de vida de Weekly e Monthly) contra o backend REAL
// da branch Neon `e2e`, onde a migration `0007_weekly_monthly_cycle_status` já
// está aplicada. A story é backend puro ("nenhuma superfície de UI nova"), então
// o valor deste spec NÃO é reexercitar regras de transição — o pytest (matriz
// exaustiva, gates, idempotência) já as cobre em Postgres local. O que só aqui é
// verificável:
//
// 1. **AC4 no cliente real**: navegar o app (Hoje → Semana → Mês → Futuro) dispara
//    os `get_or_create_*` de verdade, com prefetch e refetch do TanStack Query —
//    nenhum teste de DRF client reproduz essa sequência. A promessa é que nada
//    disso cria nem altera ciclo operacional.
// 2. **AC1 no banco real**: as uniques PARCIAIS (`(user_id) WHERE status=...`) e o
//    CHECK só existem se a `0007` de fato aplicou constraints na branch `e2e`. Um
//    409 na disputa de alvo aqui é evidência do índice no banco de verdade, não do
//    Postgres efêmero do pytest.
// 3. **AC6 na UI**: um ciclo `finalized` e VAZIO — o buraco que a story fechou,
//    porque a derivação exige `total_tasks > 0` — aparecendo no Arquivo e sem
//    affordance de escrita na página da semana. É o único efeito da story que o
//    usuário enxerga hoje.
//
// Nenhum locator de campo de formulário sem escopo é usado: desde a Story 13.3 o
// `BrainDumpCaptureSheet` monta um `Título *` oculto e portalizado em TODA rota, e
// `getByLabel('Título')` sem escopo resolve para ele (causa das falhas
// pré-existentes de `weekly-monthly-task-crud.spec.ts`).

const API = 'http://localhost:8000'

// Cliente HTTP na sessão do próprio usuário do teste. Os endpoints de ciclo
// (`POST /api/bujo/logs/{weekly,monthly}/cycle/`) existem para as Stories 14.5/14.6
// e ainda não têm UI, então o ritual é executado pelo fio — do mesmo jeito que a
// UI futura o fará.
async function cycleApi(request: APIRequestContext, email: string) {
  const tokenResponse = await request.post(`${API}/api/accounts/token/`, {
    data: { email, password: E2E_PASSWORD },
  })
  expect(tokenResponse.status()).toBe(200)
  const { access } = (await tokenResponse.json()) as { access: string }
  const headers = { Authorization: `Bearer ${access}` }

  return {
    async post(kind: 'weekly' | 'monthly', data: Record<string, string>) {
      return request.post(`${API}/api/bujo/logs/${kind}/cycle/`, { headers, data })
    },
    async log(kind: 'weekly' | 'monthly') {
      const response = await request.get(`${API}/api/bujo/logs/${kind}/`, { headers })
      expect(response.status()).toBe(200)
      return (await response.json()) as {
        status: string | null
        planningCompletedAt: string | null
        closed: boolean
        weekStart?: string
        monthFirst?: string
      }
    },
    async createWeeklyTask(weekStart: string, title: string) {
      return request.post(`${API}/api/bujo/logs/weekly/`, {
        headers,
        data: { weekStart, title },
      })
    },
  }
}

async function navigate(page: Page, destination: string) {
  await page.getByRole('button', { name: destination }).click()
  await expect(page.getByLabel(destination)).toBeVisible()
}

test('navegar o app real não cria nem altera ciclo operacional (AC4)', async ({
  page,
  email,
  request,
}) => {
  test.setTimeout(90_000)
  const api = await cycleApi(request, email)

  // Fase 1 — usuário novo: a navegação MATERIALIZA os logs (é o que sempre fez),
  // e todos nascem fora do regime operacional (`status` nulo).
  await navigate(page, 'Esta Semana')
  await navigate(page, 'Este Mês')
  await navigate(page, 'Futuro')

  expect(await api.log('weekly')).toMatchObject({ status: null, planningCompletedAt: null })
  expect(await api.log('monthly')).toMatchObject({ status: null, planningCompletedAt: null })

  // Fase 2 — entra no regime pelo ÚNICO caminho legítimo (o ritual explícito).
  const semana = (await api.log('weekly')).weekStart as string
  expect((await api.post('weekly', { action: 'open_planning_target' })).status()).toBe(200)
  expect(
    (await api.post('weekly', { action: 'complete_planning', weekStart: semana })).status(),
  ).toBe(200)
  expect((await api.post('weekly', { action: 'start', weekStart: semana })).status()).toBe(200)
  expect((await api.post('monthly', { action: 'open_planning_target' })).status()).toBe(200)

  const weeklyAntes = await api.log('weekly')
  const monthlyAntes = await api.log('monthly')
  expect(weeklyAntes.status).toBe('active')
  expect(weeklyAntes.planningCompletedAt).not.toBeNull()
  expect(monthlyAntes.status).toBe('planning')

  // Re-navegar o app inteiro com o regime já conquistado: o estado é intocável
  // por navegação — nem o `status`, nem o timestamp do marco de planejamento.
  await navigate(page, 'Hoje')
  await navigate(page, 'Esta Semana')
  await navigate(page, 'Este Mês')
  await navigate(page, 'Futuro')

  expect(await api.log('weekly')).toMatchObject({
    status: 'active',
    planningCompletedAt: weeklyAntes.planningCompletedAt,
  })
  expect(await api.log('monthly')).toMatchObject({
    status: 'planning',
    planningCompletedAt: null,
  })
})

test('unicidade de alvo e irreversibilidade de finalizar valem no banco real (AC1, AC2)', async ({
  email,
  request,
}) => {
  test.setTimeout(90_000)
  const api = await cycleApi(request, email)
  const semana = (await api.log('weekly')).weekStart as string
  const proxima = new Date(`${semana}T00:00:00Z`)
  proxima.setUTCDate(proxima.getUTCDate() + 7)
  const proximaSemana = proxima.toISOString().slice(0, 10)

  expect((await api.post('weekly', { action: 'open_planning_target' })).status()).toBe(200)

  // Segundo alvo com um já `planning`: a unique PARCIAL do banco (aplicada pela
  // `0007` nesta branch) transforma a disputa em 409 — não é disciplina de código.
  const segundoAlvo = await api.post('weekly', {
    action: 'open_planning_target',
    weekStart: proximaSemana,
  })
  expect(segundoAlvo.status()).toBe(409)

  await api.post('weekly', { action: 'complete_planning', weekStart: semana })
  await api.post('weekly', { action: 'start', weekStart: semana })
  // Com a semana corrente `active`, o alvo de planejamento fica livre de novo.
  expect(
    (
      await api.post('weekly', {
        action: 'open_planning_target',
        weekStart: proximaSemana,
      })
    ).status(),
  ).toBe(200)

  expect((await api.post('weekly', { action: 'finalize', weekStart: semana })).status()).toBe(
    200,
  )

  // `finalized` é terminal: nenhuma ação TIRA o ciclo do estado. Re-finalizar é
  // no-op idempotente (200, caso-âncora da AD-28 "re-executar é no-op"); as outras
  // três são transição ilegal (409). Distinção deliberada — a idempotência é
  // checada antes da matriz.
  expect((await api.post('weekly', { action: 'finalize', weekStart: semana })).status()).toBe(
    200,
  )
  for (const action of ['start', 'complete_planning', 'cancel_planning_target']) {
    expect((await api.post('weekly', { action, weekStart: semana })).status()).toBe(409)
  }
  expect(await api.log('weekly')).toMatchObject({ status: 'finalized', closed: true })
})

test('ciclo finalized VAZIO entra no Arquivo e a semana fica readonly (AC6)', async ({
  page,
  email,
  request,
}) => {
  test.setTimeout(90_000)
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  const { weekStart } = seedFinalizedEmptyWeekly(email)
  const api = await cycleApi(request, email)

  // Arquivo: antes da 14.1 esta semana não apareceria (zero tarefas ⇒ a derivação
  // devolve `False`). O estado explícito a coloca lá.
  await navigate(page, 'Arquivo')
  await expect(page.getByRole('link', { name: `Semana de ${weekStart}` })).toBeVisible()
  await expect(page.getByText('Nenhuma semana ou mês fechado ainda.')).toHaveCount(0)

  // Página da semana: indicador de fechada e nenhuma affordance de escrita —
  // mesma expectativa do ciclo fechado por conteúdo (`weekly-monthly-task-crud`),
  // agora para um ciclo que só o estado explícito fecha.
  await navigate(page, 'Esta Semana')
  await expect(page.getByText('Fechada')).toBeVisible()
  await expect(page.getByLabel('Adicionar tarefa à semana')).toHaveCount(0)

  // E o readonly é de fato garantido pelo domínio, não só pela ausência de botão.
  const criacao = await api.createWeeklyTask(weekStart, 'Não deveria entrar')
  expect(criacao.status()).toBe(409)

  expect(consoleErrors).toEqual([])
})
