import { test, expect } from './fixtures'
import { seedHabitAnchor } from './seedHabits'

// Cobre a Story 6.2 (Tracker diário com snapshot imutável e completude
// ponderada) ponta-a-ponta contra o backend real, sem mocks de rede:
//  - AC1: o snapshot do dia (`habit_day_entries`) é materializado na 1ª abertura
//    do tracker (GET `/api/habits/days/`, `seed_habit_day` idempotente) e os
//    valores marcados persistem entre recarregamentos (o 2º seed não sobrescreve).
//  - AC2: linhas agrupadas por grupo (cabeçalho com % ponderado do grupo) +
//    total no topo; booleano = checkbox; numérico = campo + unidade + "% da meta"
//    / "Meta atingida"; marcação otimista gravada em `value`.
//  - AC3: completude ponderada `Σ(contrib×peso)/Σ(peso)` visível (exemplo âncora
//    das Dev Notes = 60%); edição avulsa (desmarcar) recalcula só aquele dia; o
//    mesmo snapshot aparece no fluxo da manhã (`/today`) e na superfície
//    `/habits` (server state único).
// Complementa a suíte unitária de `habits/` (backend) e os testes de componente
// de `HabitTracker`/hook `useMarkHabitEntryMutation` (que mockam a API): aqui é
// o fluxo real (config → materialização → marcação → completude persistida).

test('tracker de um usuário sem hábitos mostra o estado vazio em /today e /habits (AC2)', async ({
  page,
}) => {
  // Usuário recém-criado (fixture) ainda não tem nenhum hábito: o tracker do
  // fluxo da manhã aparece, mas honesto e vazio — sem gamificação.
  await expect(page.getByRole('heading', { name: 'Hábitos', level: 2 })).toBeVisible()
  await expect(page.getByText('Completude do dia: 0%')).toBeVisible()
  await expect(page.getByText('Nenhum hábito ativo hoje.')).toBeVisible()

  // A superfície dedicada /habits mostra o mesmo tracker de hoje (mesmo estado).
  await page.getByRole('button', { name: 'Hábitos' }).click()
  await expect(page).toHaveURL('/habits')
  await expect(page.getByRole('heading', { name: 'Hábitos', level: 2 })).toBeVisible()
  await expect(page.getByText('Nenhum hábito ativo hoje.')).toBeVisible()
})

test('materializa, marca e calcula a completude ponderada; o snapshot persiste e não sangra (AC1, AC2, AC3)', async ({
  page,
  email,
}) => {
  test.setTimeout(90_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  // Config prospectiva (Story 6.1): grupo "Saúde" + booleano "Meditar" (peso 1)
  // + numérico "Passos" (peso 2, meta 5000, bonus 20%, unidade "passos").
  seedHabitAnchor(email)

  // AC1 — 1ª abertura do dia materializa uma linha por hábito ativo, com value
  // nulo. Recarrega /today para que o GET `/api/habits/days/` rode com os
  // hábitos já existentes e semeie o snapshot de hoje.
  await page.reload()

  await expect(page.getByRole('heading', { name: 'Hábitos', level: 2 })).toBeVisible()
  await expect(page.getByText('Completude do dia: 0%')).toBeVisible()
  // Cabeçalho de grupo com % ponderado do grupo (AC2).
  await expect(page.getByRole('heading', { name: /Saúde.*0%/ })).toBeVisible()

  // Linha booleana = checkbox (ainda desmarcado); linha numérica = campo +
  // unidade + progresso cru "0 / 5.000 passos" (sem % pois value é nulo).
  const meditar = page.getByRole('checkbox', { name: 'Meditar' })
  const passos = page.getByRole('spinbutton', { name: 'Valor de Passos' })
  await expect(meditar).not.toBeChecked()
  await expect(page.getByText('0 / 5.000 passos')).toBeVisible()

  // AC2 — marcar o booleano grava value=1 (otimista); AC3 — completude sobe para
  // 33% ((1×1 + 0×2)/(1+2) = 0,33) tanto no total quanto no grupo.
  await meditar.check()
  await expect(meditar).toBeChecked()
  await expect(page.getByText('Completude do dia: 33%')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Saúde.*33%/ })).toBeVisible()

  // AC2 — numérico: registrar 2500 mostra "2.500 / 5.000 passos (50%)"; AC3 —
  // contribuição = (2500/5000)×(1−0,20) = 0,40 → completude do dia = (1×1 +
  // 0,4×2)/3 = 60% (exemplo âncora das Dev Notes).
  await passos.fill('2500')
  await passos.blur()
  await expect(page.getByText('2.500 / 5.000 passos (50%)')).toBeVisible()
  await expect(page.getByText('Completude do dia: 60%')).toBeVisible()

  // AC2 — ao atingir a meta o rótulo vira "Meta atingida"; AC3 — contribuição = 1
  // (ganha o bonus) → completude do dia = (1×1 + 1×2)/3 = 100%.
  await passos.fill('5000')
  await passos.blur()
  await expect(page.getByText('Meta atingida')).toBeVisible()
  await expect(page.getByText('Completude do dia: 100%')).toBeVisible()

  // AC3 — acoplamento: a superfície /habits lê o MESMO snapshot do servidor
  // (server state único, sem store de cliente): 100%, booleano marcado, meta atingida.
  await page.getByRole('button', { name: 'Hábitos' }).click()
  await expect(page).toHaveURL('/habits')
  await expect(page.getByText('Completude do dia: 100%')).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Meditar' })).toBeChecked()
  await expect(page.getByText('Meta atingida')).toBeVisible()

  // AC3 — edição avulsa: desmarcar o booleano em /habits grava value=None e
  // recalcula só este dia → (0×1 + 1×2)/3 = 67%.
  await page.getByRole('checkbox', { name: 'Meditar' }).uncheck()
  await expect(page.getByText('Completude do dia: 67%')).toBeVisible()

  // AC1 — o snapshot persiste: voltar para /today e recarregar mantém 67% (o
  // seed idempotente da 2ª abertura NÃO recria nem sobrescreve as linhas já
  // materializadas — value editado e meta atingida preservados).
  await page.getByRole('button', { name: 'Hoje' }).click()
  await expect(page).toHaveURL('/today')
  await expect(page.getByText('Completude do dia: 67%')).toBeVisible()

  await page.reload()
  await expect(page.getByText('Completude do dia: 67%')).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Meditar' })).not.toBeChecked()
  await expect(page.getByText('Meta atingida')).toBeVisible()

  expect(consoleErrors).toEqual([])
})
