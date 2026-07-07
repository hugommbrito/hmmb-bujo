import { test, expect, syncAfter, detailPanel } from './fixtures'

// Cobre a Story 3.3 (criação/edição de tarefas com campos completos e
// subtarefas) ponta-a-ponta contra o backend real — sem mocks de rede.

test('cria tarefa raiz via botão e via atalho N; título vazio não cria nada', async ({ page }) => {
  const titleField = page.getByLabel('Nova tarefa')

  await titleField.fill('Revisar PR')
  await page.getByRole('button', { name: 'Nova tarefa' }).click()
  await expect(page.getByTestId('task-row').filter({ hasText: 'Revisar PR' })).toBeVisible()
  await expect(titleField).toHaveValue('')

  // Atalho `N` só age fora de campos editáveis — clicar em área neutra antes.
  await page.locator('body').click({ position: { x: 10, y: 10 } })
  await page.keyboard.press('n')
  await expect(titleField).toBeFocused()
  // Regressão do bug encontrado na verificação manual da 3.3: sem
  // preventDefault() no keydown, o caractere "n" vazava para o campo.
  await expect(titleField).toHaveValue('')

  await titleField.fill('Escrever changelog')
  await syncAfter(page, () => titleField.press('Enter'))
  await expect(page.getByTestId('task-row').filter({ hasText: 'Escrever changelog' })).toBeVisible()
  // Enter salva e mantém o foco no mesmo campo, pronto para a próxima linha.
  await expect(titleField).toHaveValue('')
  await expect(titleField).toBeFocused()

  await titleField.press('Enter')
  const rows = page.getByTestId('task-row')
  await expect(rows).toHaveCount(2)
})

test('edita campos no painel de detalhe e adiciona subtarefa aninhada', async ({ page }) => {
  const titleField = page.getByLabel('Nova tarefa')
  await titleField.fill('Planejar sprint')
  await syncAfter(page, () => titleField.press('Enter'))

  await page.getByRole('button', { name: 'Ver detalhes de Planejar sprint' }).click()
  const panel = detailPanel(page)
  await expect(panel).toBeVisible()

  const titleInput = panel.getByLabel('Título')
  await titleInput.fill('Planejar sprint 12')
  await titleInput.blur()

  const descriptionInput = panel.getByLabel('Descrição')
  await descriptionInput.fill('Alinhar prioridades com o time')
  await descriptionInput.blur()

  await panel.getByLabel('Categoria').click()
  await page.getByRole('option', { name: 'Purple' }).click()

  await panel.getByLabel('Eisenhower').click()
  await page.getByRole('option', { name: 'Urgente + Importante' }).click()

  await panel.getByLabel('Nova subtarefa').fill('Revisar backlog')
  await syncAfter(page, () => panel.getByRole('button', { name: 'Nova subtarefa' }).click())
  await expect(panel.getByText('Revisar backlog')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(panel).not.toBeVisible()

  // Título editado refletido na Task Row; subtarefa aparece aninhada, nunca
  // solta na raiz da lista (gap fechado nesta story, Task 2.2 dos Dev Notes).
  const parentRow = page.getByTestId('task-row').filter({ hasText: 'Planejar sprint 12' })
  await expect(parentRow).toBeVisible()
  await expect(page.getByTestId('task-row').filter({ hasText: 'Revisar backlog' })).toBeVisible()
  await expect(page.getByTestId('task-row')).toHaveCount(2)

  // Reabrir confirma persistência de descrição/categoria/Eisenhower.
  await page.getByRole('button', { name: 'Ver detalhes de Planejar sprint 12' }).click()
  await expect(panel.getByLabel('Descrição')).toHaveValue('Alinhar prioridades com o time')
})

test('subtarefa cicla status independente do pai, sem cascata', async ({ page }) => {
  const titleField = page.getByLabel('Nova tarefa')
  await titleField.fill('Preparar release')
  await syncAfter(page, () => titleField.press('Enter'))

  await page.getByRole('button', { name: 'Ver detalhes de Preparar release' }).click()
  const panel = detailPanel(page)
  await panel.getByLabel('Nova subtarefa').fill('Rodar testes')
  await syncAfter(page, () => panel.getByRole('button', { name: 'Nova subtarefa' }).click())
  await expect(panel.getByText('Rodar testes')).toBeVisible()
  await page.getByLabel('Fechar').click()

  const parentRow = page.getByTestId('task-row').filter({ hasText: 'Preparar release' })
  const subtaskRow = page.getByTestId('task-row').filter({ hasText: 'Rodar testes' })

  await syncAfter(page, () => subtaskRow.getByRole('button', { name: 'Pendente' }).click())
  await expect(subtaskRow.getByRole('button', { name: 'Em andamento' })).toBeVisible()
  await expect(parentRow.getByRole('button', { name: 'Pendente' })).toBeVisible()

  await syncAfter(page, () => subtaskRow.getByRole('button', { name: 'Em andamento' }).click())
  await expect(subtaskRow.getByRole('button', { name: 'Concluída' })).toBeVisible()
  await expect(parentRow.getByRole('button', { name: 'Pendente' })).toBeVisible()
})

test('painel de detalhe abre como bottom sheet no mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })

  const titleField = page.getByLabel('Nova tarefa')
  await titleField.fill('Tarefa mobile')
  await syncAfter(page, () => titleField.press('Enter'))
  await page.getByRole('button', { name: 'Ver detalhes de Tarefa mobile' }).click()

  const panel = detailPanel(page)
  await expect(panel).toBeVisible()
  const box = await panel.boundingBox()
  expect(box).not.toBeNull()
  // anchor="bottom": ocupa a largura toda e fica colada à base da viewport.
  expect(box!.width).toBeCloseTo(375, 0)
  expect(box!.y + box!.height).toBeCloseTo(667, 0)

  await page.keyboard.press('Escape')
  await expect(panel).not.toBeVisible()
})

test('dados persistem após recarregar a página', async ({ page }) => {
  const titleField = page.getByLabel('Nova tarefa')
  await titleField.fill('Tarefa persistente')
  await syncAfter(page, () => titleField.press('Enter'))
  await page.getByRole('button', { name: 'Ver detalhes de Tarefa persistente' }).click()

  const panel = detailPanel(page)
  await panel.getByLabel('Descrição').fill('Não deve sumir ao recarregar')
  await panel.getByLabel('Descrição').blur()
  await panel.getByLabel('Nova subtarefa').fill('Item filho persistente')
  await syncAfter(page, () => panel.getByRole('button', { name: 'Nova subtarefa' }).click())
  await expect(panel.getByText('Item filho persistente')).toBeVisible()
  await page.keyboard.press('Escape')

  await page.reload()

  await expect(page.getByTestId('task-row').filter({ hasText: 'Tarefa persistente' })).toBeVisible()
  await expect(page.getByTestId('task-row').filter({ hasText: 'Item filho persistente' })).toBeVisible()
  await page.getByRole('button', { name: 'Ver detalhes de Tarefa persistente' }).click()
  await expect(panel.getByLabel('Descrição')).toHaveValue('Não deve sumir ao recarregar')
})
