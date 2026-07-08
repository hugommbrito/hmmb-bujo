import { test, expect, syncAfter } from './fixtures'
import type { Page } from '@playwright/test'

// Cobre a Story 3.4 (ordenação manual de tarefas) ponta-a-ponta contra o
// backend real — sem mocks de rede. Complementa os testes unitários de
// TaskRow/MoveTaskDialog (que simulam eventos de drag/touch isoladamente):
// aqui validamos o gesto real do navegador + persistência via `order_index`
// no servidor, o mesmo roteiro da verificação manual descrita na story
// (Task 7.6).

async function createTasks(page: Page, titles: string[]) {
  const titleField = page.getByLabel('Nova tarefa')
  for (const title of titles) {
    await titleField.fill(title)
    await syncAfter(page, () => titleField.press('Enter'))
  }
  // `syncAfter` casa com o *próximo* GET de todayLog(), mas em criações
  // consecutivas rápidas o React Query (StrictMode) às vezes dispara um GET
  // extra fora de ordem, deixando a linha ainda com o id otimista temporário
  // quando o teste segue para uma ação (drag/reorder) que depende do id real
  // (ver comentário em fixtures.ts `syncAfter`). `networkidle` garante que
  // toda a rede residual assente antes de continuar.
  await page.waitForLoadState('networkidle')
}

async function expectOrder(page: Page, titles: string[]) {
  const rows = page.getByTestId('task-row')
  await expect(rows).toHaveCount(titles.length)
  for (let i = 0; i < titles.length; i += 1) {
    await expect(rows.nth(i)).toContainText(titles[i])
  }
}

test('arrasta tarefa via drag handle no desktop; ordem persiste após recarregar (AC1)', async ({ page }) => {
  await createTasks(page, ['Tarefa A', 'Tarefa B', 'Tarefa C'])
  await expectOrder(page, ['Tarefa A', 'Tarefa B', 'Tarefa C'])

  const rowC = page.getByTestId('task-row').filter({ hasText: 'Tarefa C' })
  const rowA = page.getByTestId('task-row').filter({ hasText: 'Tarefa A' })
  const sourceBox = await rowC.boundingBox()
  if (!sourceBox) throw new Error('linha de origem sem bounding box')

  // Solta na metade superior da linha alvo → `position: 'before'`
  // (TaskRow.tsx `handleDragOver`, AC1: "linha horizontal indicando o destino").
  await syncAfter(page, () =>
    rowC.dragTo(rowA, {
      sourcePosition: { x: sourceBox.width - 8, y: sourceBox.height / 2 },
      targetPosition: { x: 20, y: 2 },
    }),
  )

  await expectOrder(page, ['Tarefa C', 'Tarefa A', 'Tarefa B'])

  await page.reload()
  await expectOrder(page, ['Tarefa C', 'Tarefa A', 'Tarefa B'])
})

test('desktop: botão "Mover tarefa" reordena sem arrastar (alternativa WCAG 2.5.7) e persiste', async ({
  page,
}) => {
  await createTasks(page, ['Tarefa A', 'Tarefa B', 'Tarefa C'])

  const rowA = page.getByTestId('task-row').filter({ hasText: 'Tarefa A' })
  await rowA.getByRole('button', { name: 'Mover tarefa' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Mover "Tarefa A" para...')).toBeVisible()

  await syncAfter(page, () => dialog.getByRole('button', { name: 'Abaixo de Tarefa C' }).click())
  await expect(dialog).not.toBeVisible()

  await expectOrder(page, ['Tarefa B', 'Tarefa C', 'Tarefa A'])

  await page.reload()
  await expectOrder(page, ['Tarefa B', 'Tarefa C', 'Tarefa A'])
})

test('mobile: long-press abre "Mover para..." e a nova ordem persiste ao reabrir o log (AC2)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await createTasks(page, ['Tarefa A', 'Tarefa B', 'Tarefa C'])

  const rowB = page.getByTestId('task-row').filter({ hasText: 'Tarefa B' })
  // Dispara o gesto de toque; o diálogo só abre após LONG_PRESS_MS (500ms —
  // TaskRow.tsx). `toBeVisible()` faz polling automático até o timer
  // disparar, sem sleep fixo no teste.
  await rowB.dispatchEvent('touchstart')

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Mover "Tarefa B" para...')).toBeVisible()

  await syncAfter(page, () => dialog.getByRole('button', { name: 'Abaixo de Tarefa C' }).click())
  await expect(dialog).not.toBeVisible()

  await expectOrder(page, ['Tarefa A', 'Tarefa C', 'Tarefa B'])

  await page.reload()
  await expectOrder(page, ['Tarefa A', 'Tarefa C', 'Tarefa B'])
})

test('subtarefas não expõem drag handle nem "Mover tarefa" (reorder é raiz-only nesta story)', async ({
  page,
}) => {
  await createTasks(page, ['Tarefa raiz'])
  await page.getByRole('button', { name: 'Ver detalhes de Tarefa raiz' }).click()
  const panel = page.locator('.MuiDrawer-paper').filter({ hasText: 'Detalhe da tarefa' })
  await panel.getByLabel('Nova subtarefa').fill('Item filho reorder')
  await syncAfter(page, () => panel.getByRole('button', { name: 'Nova subtarefa' }).click())
  await expect(panel.getByText('Item filho reorder')).toBeVisible()
  await page.keyboard.press('Escape')

  const subtaskRow = page.getByTestId('task-row').filter({ hasText: 'Item filho reorder' })
  await expect(subtaskRow).toHaveAttribute('draggable', 'false')
  await expect(subtaskRow.getByRole('button', { name: 'Mover tarefa' })).toHaveCount(0)
})
