import { test, expect, syncAfter } from './fixtures'
import { seedYesterdayQueue } from './seedYesterdayQueue'

// Cobre a Story 4.2 (Migração diária com linhagem) ponta-a-ponta contra o
// backend real, ATRAVÉS DA SUPERFÍCIE NOVA (Story 14.9, M10): o banner
// unificado (`MigrationRitualBanner`) substituiu `MigrationBanner` em
// `DailyPage.tsx`, e o ritual ROTEADO (`/migration`) substituiu o `Dialog`
// (`MigrationFlow`/`MigrationCard`) como o caminho de decisão. Os arquivos
// legados (`MigrationBanner.tsx`, `MigrationFlow.tsx`, `MigrationCard.tsx`)
// permanecem no repo intocados em comportamento — só DESMONTADOS de
// `DailyPage.tsx` (mesmo padrão de rollback-por-arquivo das 14.5-14.8) — e o
// endpoint `migrate_task`/`POST /tasks/{id}/migrate/` que este spec exercita é
// EXATAMENTE o mesmo verbo, chamado agora pela lista de decisão da 14.9.
//
// A fila só existe a partir de tarefas `pending`/`started` de ONTEM (não há
// affordance na UI para criar dados no passado), então cada teste continua
// seedando o Daily Log de ontem direto no banco (`seedYesterdayQueue`).

test('banner unificado mostra a contagem certa e só raízes; nada migra até abrir o ritual (AC1)', async ({
  page,
  email,
}) => {
  seedYesterdayQueue(email, [
    { title: 'Tarefa solta' },
    {
      title: 'Tarefa com subtarefa pendente',
      children: [{ title: 'Subtarefa pendente' }],
    },
  ])
  await page.reload()

  // Só as 2 raízes contam — a subtarefa pendente não é uma linha própria na fila.
  const banner = page.getByRole('region', { name: /tarefas precisam de decisão/ })
  await expect(banner).toBeVisible()
  await expect(banner).toHaveAccessibleName(/2 tarefas precisam de decisão/)
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await banner.getByRole('link', { name: 'Migrar ›' }).click()

  await expect(page).toHaveURL('/migration')
  await expect(page.getByText('Tarefa solta')).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'revisadas' })).toHaveText('0 de 2 revisadas')
})

test('migra tarefa solta para hoje via "Migrar para hoje"; aparece no Daily Log de hoje (AC2, AC3)', async ({
  page,
  email,
}) => {
  seedYesterdayQueue(email, [{ title: 'Revisar PR de ontem' }])
  await page.reload()

  await page.getByRole('link', { name: 'Migrar ›' }).click()
  await expect(page.getByText('Revisar PR de ontem')).toBeVisible()

  await syncAfter(page, async () =>
    page.getByRole('button', { name: 'Migrar para hoje' }).click(),
  )

  // Fila esvaziou → resumo factual, não um Dialog fechando sozinho.
  await expect(page.getByText('Migração concluída')).toBeVisible()
  await page.getByRole('button', { name: 'Voltar ao Hoje' }).click()

  await expect(page).toHaveURL('/today')
  await expect(page.getByRole('region', { name: /precisam? de decisão/ })).toHaveCount(0)
  await expect(page.getByTestId('task-row').filter({ hasText: 'Revisar PR de ontem' })).toBeVisible()

  // Banner não reaparece (a fila de ontem esvaziou de verdade no servidor).
  await page.reload()
  await expect(page.getByRole('region', { name: /precisam? de decisão/ })).toHaveCount(0)
})

test('migra tarefa iniciada (/) para hoje; o sucessor nasce iniciado no Daily Log (Story 12.1 / AD-18 item 1)', async ({
  page,
  email,
}) => {
  // O bug #23: `create_task` grava `pending` hardcoded, então até esta story a
  // tarefa `/` (started) renascia `pending` ao ser carregada adiante. Aqui
  // provamos ponta-a-ponta (UI → migrate_task → UI) que o `/` sobrevive.
  seedYesterdayQueue(email, [{ title: 'Revisar rascunho começado', status: 'started' }])
  await page.reload()

  await page.getByRole('link', { name: 'Migrar ›' }).click()
  await expect(page.getByText('Revisar rascunho começado')).toBeVisible()

  await syncAfter(page, async () =>
    page.getByRole('button', { name: 'Migrar para hoje' }).click(),
  )
  await page.getByRole('button', { name: 'Voltar ao Hoje' }).click()

  // O sucessor no Daily Log de hoje carrega o status `started` herdado da
  // origem — não voltou a `pending`.
  const successorRow = page.getByTestId('task-row').filter({ hasText: 'Revisar rascunho começado' })
  await expect(successorRow).toBeVisible()
  await expect(successorRow.getByRole('button', { name: 'Em andamento' })).toBeVisible()
  await expect(successorRow.getByText('Iniciada')).toBeVisible()
})

test('Pausar preserva decisões; retomar mostra a mesma tarefa não decidida (AC1, AC2)', async ({
  page,
  email,
}) => {
  seedYesterdayQueue(email, [{ title: 'Primeira tarefa' }, { title: 'Segunda tarefa' }])
  await page.reload()

  await page.getByRole('link', { name: 'Migrar ›' }).click()
  await expect(page.getByText('Primeira tarefa')).toBeVisible()

  // `exact: true` porque o rail de contexto também tem "Pausar e sair" —
  // sem `exact`, o match por nome acessível de substring vira ambíguo (achado
  // real do e2e em review, exposto só depois de corrigir o foco padrão de
  // fonte: antes "Primeira tarefa" nunca ficava visível a tempo de chegar
  // aqui, então esta ambiguidade nunca era exercitada).
  await page.getByRole('button', { name: 'Pausar', exact: true }).click()
  await expect(page).toHaveURL('/today')

  // Nenhuma tarefa foi decidida — o banner volta na variante PAUSADA (Story
  // 14.9, M ficou salvo em sessionStorage ao abrir o ritual): "N de M
  // restantes", ambos 2 (nada foi decidido ainda).
  const banner = page.getByRole('region', { name: /Migração pausada/ })
  await expect(banner).toHaveAccessibleName('Migração pausada · 2 de 2 restantes')

  await banner.getByRole('link', { name: 'Retomar migração' }).click()
  await expect(page.getByText('Primeira tarefa')).toBeVisible()
  await expect(page.getByText('Segunda tarefa')).toBeVisible()
})

test('migrar um pai recria só o filho pendente no destino; filho concluído fica na origem (AD-08 item 11, AC3)', async ({
  page,
  email,
}) => {
  seedYesterdayQueue(email, [
    {
      title: 'Planejar sprint',
      children: [
        { title: 'Subtarefa concluída', status: 'completed' },
        { title: 'Subtarefa pendente' },
      ],
    },
  ])
  await page.reload()

  await page.getByRole('link', { name: 'Migrar ›' }).click()
  await expect(page.getByText('Planejar sprint')).toBeVisible()

  await syncAfter(page, async () =>
    page.getByRole('button', { name: 'Migrar para hoje' }).click(),
  )
  await expect(page.getByText('Migração concluída')).toBeVisible()
  await page.getByRole('button', { name: 'Voltar ao Hoje' }).click()

  // Destino (Daily Log de hoje): pai recriado + só o filho pendente — o
  // concluído não viaja.
  const parentRow = page.getByTestId('task-row').filter({ hasText: 'Planejar sprint' })
  await expect(parentRow).toBeVisible()
  await expect(page.getByTestId('task-row').filter({ hasText: 'Subtarefa pendente' })).toBeVisible()
  await expect(page.getByTestId('task-row').filter({ hasText: 'Subtarefa concluída' })).toHaveCount(0)
})

test('"Escolher destino…" → aba "Dia no mês" com data no mês corrente resolve para destination "month" e some da fila (AC2)', async ({
  page,
  email,
}) => {
  seedYesterdayQueue(email, [{ title: 'Adiar para depois no mês' }])
  await page.reload()

  await page.getByRole('link', { name: 'Migrar ›' }).click()
  await expect(page.getByText('Adiar para depois no mês')).toBeVisible()

  await page.getByRole('button', { name: 'Escolher destino…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Escolher destino' })
  await expect(dialog).toBeVisible()

  const today = new Date()
  const day = today.getDate()

  // O picker abre por padrão na aba "Esta semana" (há semana corrente) — o
  // teste precisa da aba "Dia no mês" explicitamente para expor o `gridcell`.
  await dialog.getByRole('tab', { name: 'Dia no mês' }).click()

  await syncAfter(page, async () => {
    await dialog.getByRole('gridcell', { name: String(day), exact: true }).click()
    await dialog.getByRole('button', { name: /Migrar para/ }).click()
  })

  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('Adiar para depois no mês')).toHaveCount(0)
})
