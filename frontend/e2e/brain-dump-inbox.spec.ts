import { test, expect } from './fixtures'

// Cobertura DEDICADA da Story 15.1 (M11 — Inbox do Brain Dump no sistema
// novo): os dois deltas que `brain-dump.spec.ts` (Story 5.1, ajustado nesta
// story) não cobria — edição paritária do item (PATCH novo) e `scheduled_date`
// real no seletor de destino (Esta Semana com dia escolhido). Mesmo padrão de
// `recurring-library.spec.ts` (Story 14.8): um spec novo por superfície
// migrada, ao lado do spec legado ajustado.

test('editar título/descrição/destino do item via o sheet — a linha atualiza in-place, sem otimismo (I/O Matrix)', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Brain Dump' }).click()
  await expect(page.getByRole('main', { name: 'Brain Dump', exact: true })).toBeVisible()

  await page.getByRole('textbox', { name: 'Título' }).fill('Item para editar')
  await page.getByRole('button', { name: 'Capturar' }).click()
  await expect(page.getByText('Item para editar')).toBeVisible()

  // Ativa a linha (título é um controle real — `onActivate`, ItemRowBase) e
  // abre o sheet de edição.
  const row = page.getByRole('listitem').filter({ hasText: 'Item para editar' })
  await row.getByRole('button', { name: /^Item para editar/ }).click()
  await expect(page.getByRole('dialog', { name: 'Item do Brain Dump' })).toBeVisible()

  const titleField = page.getByRole('textbox', { name: 'Título' })
  await expect(titleField).toHaveValue('Item para editar')
  await titleField.fill('Item editado')
  await page.getByRole('textbox', { name: 'Descrição' }).fill('Detalhes acrescentados na edição')
  await page.getByRole('combobox', { name: 'Destino' }).selectOption('week')

  await page.getByRole('button', { name: 'Salvar' }).click()

  // Sheet fecha; a linha reflete os 3 campos atualizados.
  await expect(page.getByRole('dialog', { name: 'Item do Brain Dump' })).toHaveCount(0)
  await expect(page.getByText('Item editado')).toBeVisible()
  await expect(page.getByText('Detalhes acrescentados na edição')).toBeVisible()
  await expect(page.getByText('Dica: Esta Semana', { exact: false })).toBeVisible()
  await expect(page.getByText('Item para editar', { exact: true })).toHaveCount(0)
})

test('mover para Esta Semana com um dia escolhido cria a Task com scheduled_date (delta do M11 vs. o legado)', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Brain Dump' }).click()
  await expect(page.getByRole('main', { name: 'Brain Dump', exact: true })).toBeVisible()

  await page.getByRole('textbox', { name: 'Título' }).fill('Reunião da diretoria')
  await page.getByRole('button', { name: 'Capturar' }).click()
  await expect(page.getByText('Reunião da diretoria')).toBeVisible()

  await page.getByRole('button', { name: 'Mover Reunião da diretoria' }).click()
  const picker = page.getByRole('dialog', { name: 'Para onde mover este item?' })
  await expect(picker).toBeVisible()

  await page.getByRole('radio', { name: 'Esta Semana' }).click()
  const weekDays = picker.getByRole('radiogroup', { name: /^Dias de/ })
  await weekDays.getByRole('radio').first().click()

  await picker.getByRole('button', { name: /^Mover para/ }).click()

  await expect(picker).toHaveCount(0)
  await expect(page.getByText('Reunião da diretoria')).toHaveCount(0)
  await expect(page.getByText('Brain Dump vazio.')).toBeVisible()
})

test('fechar o sheet de edição sem alteração fecha direto; com alteração pede confirmação (dirty-check)', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Brain Dump' }).click()
  await page.getByRole('textbox', { name: 'Título' }).fill('Item de teste do dirty-check')
  await page.getByRole('button', { name: 'Capturar' }).click()
  await expect(page.getByText('Item de teste do dirty-check')).toBeVisible()

  const row = page.getByRole('listitem').filter({ hasText: 'Item de teste do dirty-check' })

  // Sem alteração: fecha direto, sem dialog.
  await row.getByRole('button', { name: /^Item de teste do dirty-check/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Item do Brain Dump' })
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: 'Fechar' }).click()
  await expect(sheet).toHaveCount(0)
  await expect(page.getByText('Descartar alterações?')).toHaveCount(0)

  // Com alteração não salva: pede confirmação, foco em "Continuar editando".
  await row.getByRole('button', { name: /^Item de teste do dirty-check/ }).click()
  await expect(sheet).toBeVisible()
  await page.getByRole('textbox', { name: 'Título' }).fill('Rascunho não salvo')
  await sheet.getByRole('button', { name: 'Fechar' }).click()

  await expect(page.getByText('Descartar alterações?')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continuar editando' })).toBeFocused()

  // Escape continua editando (nunca descarta).
  await page.keyboard.press('Escape')
  await expect(page.getByText('Descartar alterações?')).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Título' })).toHaveValue('Rascunho não salvo')
})
