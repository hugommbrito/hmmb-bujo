import { test, expect, syncAfter } from './fixtures'
import { seedYesterdayQueue } from './seedYesterdayQueue'

// Cobre a Story 4.2 (Migração diária com Migration Card e linhagem)
// ponta-a-ponta contra o backend real. A fila de migração só existe a partir
// de tarefas `pending`/`started` de ONTEM (não há affordance na UI para criar
// dados no passado, de propósito), então cada teste seeda o Daily Log de
// ontem direto no banco (`seedYesterdayQueue`, mesma técnica da verificação
// manual da story) antes de recarregar a página.
//
// Complementa os testes unitários de MigrationBanner/MigrationCard/
// MigrationFlow (que simulam a fila e a mutação isoladamente): aqui validamos
// o fluxo real — banner → Dialog com backdrop → decisões persistidas via
// `migrate_task` → reflexo no Daily Log de hoje / linhagem na origem.

test('banner mostra a contagem certa e só raízes; não migra nada até "Iniciar" (AC1)', async ({
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
  await expect(page.getByText('2 tarefas pendentes de ontem. Iniciar migração?')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.getByRole('button', { name: 'Iniciar' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Tarefa solta')).toBeVisible()
  await expect(dialog.getByText('1 de 2 revisadas')).toBeVisible()
})

test('migra tarefa solta para hoje via atalho "1"; aparece no Daily Log de hoje (AC2, AC3)', async ({
  page,
  email,
}) => {
  seedYesterdayQueue(email, [{ title: 'Revisar PR de ontem' }])
  await page.reload()

  await page.getByRole('button', { name: 'Iniciar' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  await syncAfter(page, async () => page.keyboard.press('1'))

  // Fila esvaziou → modal fecha sozinho e o banner some.
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('tarefas pendentes de ontem')).toHaveCount(0)
  await expect(page.getByTestId('task-row').filter({ hasText: 'Revisar PR de ontem' })).toBeVisible()

  // Banner não reaparece (a fila de ontem esvaziou de verdade no servidor).
  await page.reload()
  await expect(page.getByText('tarefas pendentes de ontem')).toHaveCount(0)
})

test('migra tarefa iniciada (/) para hoje; o sucessor nasce iniciado no Daily Log (Story 12.1 / AD-18 item 1)', async ({
  page,
  email,
}) => {
  // O bug #23: `create_task` grava `pending` hardcoded, então até esta story a
  // tarefa `/` (started) renascia `pending` ao ser carregada adiante. Aqui
  // provamos ponta-a-ponta (UI → migrate_task → UI) que o `/` sobrevive: uma
  // tarefa INICIADA de ontem, migrada para hoje, aparece no Daily Log ainda
  // iniciada. Cobre o único efeito observável da story (backend-only), pela
  // superfície de status já existente em TaskRow — sem UI nova.
  seedYesterdayQueue(email, [{ title: 'Revisar rascunho começado', status: 'started' }])
  await page.reload()

  await page.getByRole('button', { name: 'Iniciar' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  await syncAfter(page, async () => page.keyboard.press('1'))

  // Fila esvaziou → modal fecha sozinho e o banner some.
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('tarefas pendentes de ontem')).toHaveCount(0)

  // O sucessor no Daily Log de hoje carrega o status `started` herdado da
  // origem — não voltou a `pending`. Duas superfícies confirmam: o controle de
  // status acessível ("Em andamento") e o chip visível ("Iniciada").
  const successorRow = page
    .getByTestId('task-row')
    .filter({ hasText: 'Revisar rascunho começado' })
  await expect(successorRow).toBeVisible()
  await expect(successorRow.getByRole('button', { name: 'Em andamento' })).toBeVisible()
  await expect(successorRow.getByText('Iniciada')).toBeVisible()
})

test('Esc pausa sem decidir; "Iniciar" retoma a mesma tarefa não decidida (AC1, AC2)', async ({
  page,
  email,
}) => {
  seedYesterdayQueue(email, [{ title: 'Primeira tarefa' }, { title: 'Segunda tarefa' }])
  await page.reload()

  await page.getByRole('button', { name: 'Iniciar' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Primeira tarefa')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)

  // Nenhuma tarefa foi decidida — a contagem do banner continua em 2.
  await expect(page.getByText('2 tarefas pendentes de ontem. Iniciar migração?')).toBeVisible()

  await page.getByRole('button', { name: 'Iniciar' }).click()
  await expect(dialog.getByText('Primeira tarefa')).toBeVisible()
  await expect(dialog.getByText('1 de 2 revisadas')).toBeVisible()
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

  await page.getByRole('button', { name: 'Iniciar' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Planejar sprint')).toBeVisible()
  await expect(dialog.getByText('Subtarefa concluída')).toBeVisible()
  await expect(dialog.getByText('Subtarefa pendente')).toBeVisible()

  await syncAfter(page, async () => page.keyboard.press('1'))
  await expect(dialog).toHaveCount(0)

  // Destino (Daily Log de hoje): pai recriado + só o filho pendente — o
  // concluído não viaja.
  const parentRow = page.getByTestId('task-row').filter({ hasText: 'Planejar sprint' })
  await expect(parentRow).toBeVisible()
  await expect(page.getByTestId('task-row').filter({ hasText: 'Subtarefa pendente' })).toBeVisible()
  await expect(page.getByTestId('task-row').filter({ hasText: 'Subtarefa concluída' })).toHaveCount(0)
})

test('"Adiar no mês" com data no mês corrente confirma automaticamente (AC2), some da fila', async ({
  page,
  email,
}) => {
  seedYesterdayQueue(email, [{ title: 'Adiar para depois no mês' }])
  await page.reload()

  await page.getByRole('button', { name: 'Iniciar' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  await dialog.getByRole('button', { name: 'Adiar no mês' }).click()
  const dateInput = dialog.getByLabel('Data no mês corrente')
  await expect(dateInput).toBeVisible()

  const today = new Date()
  const day = String(today.getDate()).padStart(2, '0')
  const monthValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${day}`

  // `onChange` já confirma a decisão — sem botão extra a clicar.
  await syncAfter(page, async () => dateInput.fill(monthValue))

  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('tarefas pendentes de ontem')).toHaveCount(0)
})
