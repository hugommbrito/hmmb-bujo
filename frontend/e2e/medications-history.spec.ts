import { test, expect } from './fixtures'
import { seedMedicationPastSchedule } from './seedMedications'

// Cobre a Story 8.3 (Histórico de adesão e dose perdida) ponta-a-ponta contra o
// backend real, sem mocks de rede:
//  - AC1: aba "Histórico" (sub-rota /health/medications/history) + navegador de data.
//  - AC3/AC4: navegar a um dia passado materializa (seed) uma linha `scheduled` sem
//    confirmação → exibida como "Dose perdida" (sinal clínico, texto + ícone).
//  - AC5: confirmar retroativamente aquela linha (vira "Confirmado"), persistente.
//  - AC6: corrigir a dose de um dia passado (UPDATE numa linha), persistente.
//  - AC8: empty state ("Nenhum medicamento neste dia.") para um dia sem med ativo.

test('histórico: dose perdida, confirmação e correção de dose retroativas persistem (AC1, AC3, AC4, AC5, AC6, AC8)', async ({
  page,
  email,
}) => {
  test.setTimeout(120_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  // Agenda ativa vigente ONTEM → navegar ao histórico de ontem materializa a linha.
  seedMedicationPastSchedule(email, {
    title: 'Losartana',
    substanceName: 'Losartana K',
    blockName: 'Manhã',
    dose: [{ label: '', amount: 50, unit: 'mg' }],
    daysAgo: 1,
  })

  // AC1 — abrir a superfície diária e ir para a aba "Histórico".
  await page.goto('/health/medications')
  await page.getByRole('tab', { name: 'Histórico' }).click()
  await expect(page).toHaveURL('/health/medications/history')
  await expect(page.getByRole('heading', { name: 'Histórico', level: 2 })).toBeVisible()

  // AC3/AC4 — navegar a ONTEM materializa a linha `scheduled` sem confirmação →
  // "Dose perdida" (o cabeçalho do bloco vira "Doses perdidas").
  await page.getByRole('button', { name: 'Dia anterior' }).click()
  await expect(page.getByText('Losartana · 50 mg')).toBeVisible()
  await expect(page.getByText('Dose perdida')).toBeVisible()
  await expect(page.getByText('Doses perdidas')).toBeVisible()

  // AC5 — confirmar retroativamente: a linha e o cabeçalho viram "Confirmado"
  // (2 ocorrências: indicador da linha + cabeçalho do bloco) e some "Dose perdida".
  const checkbox = page.getByRole('checkbox', { name: /Losartana/ })
  await checkbox.check()
  await expect(checkbox).toBeChecked()
  await expect(page.getByText('Confirmado').first()).toBeVisible()
  await expect(page.getByText('Dose perdida')).toHaveCount(0)

  // AC6 — corrigir a dose registrada do dia passado (50 mg → 25 mg).
  await page.getByRole('button', { name: 'Corrigir dose' }).click()
  await page.getByLabel('Quantidade do componente 1').fill('25')
  await page.getByRole('button', { name: 'Salvar dose' }).click()
  await expect(page.getByText('Losartana · 25 mg')).toBeVisible()

  // AC5/AC6 — persistência: recarregar e voltar a ontem mantém confirmação + dose.
  await page.reload()
  await page.getByRole('button', { name: 'Dia anterior' }).click()
  await expect(page.getByRole('checkbox', { name: /Losartana/ })).toBeChecked()
  await expect(page.getByText('Losartana · 25 mg')).toBeVisible()

  // AC8 — dois dias atrás não havia agenda ativa → empty state.
  await page.getByRole('button', { name: 'Dia anterior' }).click()
  await expect(page.getByText('Nenhum medicamento neste dia.')).toBeVisible()

  expect(consoleErrors).toEqual([])
})
