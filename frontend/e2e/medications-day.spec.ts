import { test, expect } from './fixtures'
import {
  seedMedication,
  seedMedicationCatalogOnly,
  seedMedicationOnBlock,
} from './seedMedications'

// Cobre a Story 8.2 (Confirmação diária por bloco ou individual) ponta-a-ponta
// contra o backend real, sem mocks de rede:
//  - AC2: a 1ª abertura do dia materializa (`seed_medication_day`, idempotente) uma
//    linha `scheduled` por (medicamento, bloco) agendado e ativo, com dose congelada.
//  - AC4/AC5: confirmação individual (checkbox) e por bloco ("Confirmar todos") —
//    otimistas — persistem entre recarregamentos.
//  - AC6: o estado do bloco (pendente/parcial/confirmado) é derivado das linhas
//    (texto + ícone), nunca armazenado.
// Complementa a suíte unitária de `medications/` (backend) e os testes de componente
// de `MedicationBlock`/hooks (que mockam a API): aqui é o fluxo real
// (config → materialização → confirmação → persistência).

test('superfície vazia para usuário sem medicamentos (AC8)', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.goto('/health/medications')

  await expect(page.getByRole('main', { name: 'Medicamentos' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Medicamentos', level: 2 })).toBeVisible()
  await expect(page.getByText('Nenhum medicamento para hoje.')).toBeVisible()

  expect(consoleErrors).toEqual([])
})

test('materializa, confirma por linha e por bloco; estado derivado e persistência (AC2, AC4, AC5, AC6)', async ({
  page,
  email,
}) => {
  test.setTimeout(90_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  // Config (Story 8.1): bloco "Manhã" com dois medicamentos agendados.
  const { blockId } = seedMedication(email, {
    title: 'Losartana',
    substanceName: 'Losartana K',
    blockName: 'Manhã',
    dose: [{ label: '', amount: 50, unit: 'mg' }],
  })
  seedMedicationOnBlock(email, blockId, {
    title: 'AAS',
    substanceName: 'Ácido acetilsalicílico',
    dose: [{ label: '', amount: 100, unit: 'mg' }],
  })

  // AC2 — 1ª abertura materializa o snapshot do dia (GET /api/medications/days/).
  await page.goto('/health/medications')

  await expect(page.getByRole('heading', { name: 'Manhã', level: 3 })).toBeVisible()
  // Dose congelada visível na linha (nome + dose).
  await expect(page.getByText('Losartana · 50 mg')).toBeVisible()
  await expect(page.getByText('AAS · 100 mg')).toBeVisible()
  // AC6 — estado inicial derivado: nenhuma confirmada → "Pendente".
  await expect(page.getByText('Pendente')).toBeVisible()

  const losartana = page.getByRole('checkbox', { name: /Losartana/ })
  const aas = page.getByRole('checkbox', { name: /AAS/ })
  await expect(losartana).not.toBeChecked()

  // AC4/AC5 — confirmar UMA linha (otimista); AC6 — bloco vira "Parcial" (1 de 2).
  await losartana.check()
  await expect(losartana).toBeChecked()
  await expect(page.getByText('Parcial')).toBeVisible()
  await expect(aas).not.toBeChecked() // não sangra

  // AC4/AC5 — "Confirmar todos" (lote); AC6 — bloco vira "Confirmado".
  await page.getByRole('button', { name: /Confirmar todos — Manhã/ }).click()
  await expect(page.getByText('Confirmado')).toBeVisible()
  await expect(aas).toBeChecked()

  // AC2/AC4 — persistência: recarregar mantém o estado confirmado (o 2º seed é
  // idempotente e não sobrescreve as confirmações já gravadas).
  await page.reload()
  await expect(page.getByText('Confirmado')).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /Losartana/ })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: /AAS/ })).toBeChecked()

  expect(consoleErrors).toEqual([])
})

test('registra um avulso/PRN pelo formulário e ele aparece na seção Avulso/PRN (AC7)', async ({
  page,
  email,
}) => {
  test.setTimeout(90_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  // Medicamento SÓ no catálogo (sem agenda): não materializa bloco algum no dia, mas
  // fica selecionável no formulário de avulso.
  seedMedicationCatalogOnly(email, { title: 'Dipirona', substanceName: 'Dipirona' })

  await page.goto('/health/medications')

  // Sem agenda ativa → nenhum bloco agendado; a superfície começa vazia.
  await expect(page.getByText('Nenhum medicamento para hoje.')).toBeVisible()

  // AC7 — registrar o avulso: selecionar o medicamento + dose (quantidade + unidade).
  await page.getByRole('combobox', { name: 'Medicamento avulso' }).click()
  await page.getByRole('option', { name: 'Dipirona' }).click()
  await page.getByLabel('Quantidade da dose avulsa').fill('1')
  await page.getByLabel('Unidade da dose avulsa').fill('comp')
  await page.getByRole('button', { name: 'Registrar avulso' }).click()

  // AC7 — o avulso aparece na seção "Avulso / PRN" (distinta dos blocos agendados),
  // sempre confirmado (sem contrapartida esperada).
  await expect(
    page.getByRole('heading', { name: 'Avulso / PRN', level: 3 }),
  ).toBeVisible()
  await expect(page.getByText('Dipirona · 1 comp')).toBeVisible()

  // Persistência: recarregar mantém o avulso registrado no dia.
  await page.reload()
  await expect(page.getByText('Dipirona · 1 comp')).toBeVisible()

  expect(consoleErrors).toEqual([])
})
