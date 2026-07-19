import { test, expect } from './fixtures'
import { seedMultiplierScenario } from './seedMultiplierScenario'

// Cobre a Story 6.3 (multiplicador de peso por tipo de dia) ponta-a-ponta contra
// o backend real, sem mocks de rede — a camada de ritmo de AD-10 empilhada sobre
// o snapshot da 6.2:
//  - AC1: config prospectiva do multiplicador por grupo × tipo de dia via a
//    primeira afordância de edição por-grupo (Settings › Hábitos) + marcação
//    manual de feriado pelo toggle do tracker.
//  - AC2: a materialização congela `day_type`+`multiplier_at_time` e a completude
//    passa a usar `peso_efetivo = weight_at_time × multiplier_at_time` em
//    numerador E denominador; o tracker exibe o multiplicador de forma factual
//    (legenda "Feriado · peso ×0,2") sem gamificação (UX-DR13).
//  - AC3: ajustes não sangram — marcar/desmarcar feriado re-resolve só aquele
//    dia (bounded) e o override avulso "tratar como dia útil" volta o peso cheio.
// Complementa a suíte unitária de `habits/` (backend) e os testes de componente
// de `HabitTracker`/`HabitsManager` (que mockam a API): aqui é o fluxo real
// (config → materialização → feriado → peso efetivo persistido).
//
// Determinismo de tempo: o tracker sempre mostra HOJE e o tipo de dia real varia
// com o dia em que a suíte roda (fim de semana automático). Por isso os specs
// usam o toggle de FERIADO como alavanca — `holiday` tem precedência sobre
// `weekend`/`weekday`, então marcar feriado força `day_type = holiday` em
// qualquer dia. Nenhuma asserção depende do dia real da execução: o baseline (só
// grupos sem config de fim de semana → ×1,0) e o estado pós-feriado são estáveis.
//
// Toda marcação/toggle é OTIMISTA (`useOptimisticMutation`/`useMutation` +
// invalidação): a UI mostra o novo estado na hora e a completude (calculada no
// backend) reconcilia após o refetch de `onSettled`. Por isso usamos `.click()`
// (não `.check()`/`.uncheck()`, que verificam o estado intermediário e falham no
// pisca-pisca otimista→refetch) e asseramos a completude (server-side) DEPOIS de
// cada ação — isso serializa as interações e garante o settle antes da próxima.
// A branch Neon `e2e` tem latência de cold-start (ver playwright.config.ts), por
// isso as reconciliações que dependem de POST→recálculo→GET ganham um timeout
// maior — é config de ambiente, não lógica de asserção.
const RECONCILE = { timeout: 20_000 }

test('config prospectiva do multiplicador de grupo persiste (AC1)', async ({ page, email }) => {
  // Um único grupo → os localizadores por-grupo (campo/botão) ficam inequívocos.
  seedMultiplierScenario(email, { onlyProfessional: true })

  // AC1 — primeira edição por-grupo em Settings › Hábitos (afordância greenfield).
  await page.goto('/settings/habits')
  await expect(page.getByRole('main', { name: 'Configurações — Hábitos' })).toBeVisible()

  // O form de multiplicador só monta após carregar a config vigente (default
  // ×1,00) — esperar o valor carregado garante que o form já assentou antes de
  // editar (evita que um refetch remonte o form e descarte o que foi digitado).
  const holidayField = page.getByRole('spinbutton', { name: /Multiplicador de feriado/ })
  await expect(holidayField).toHaveValue(/1\.00?/)
  await holidayField.fill('0.2')
  await expect(holidayField).toHaveValue('0.2')

  // Salvar e esperar o PUT concluir ANTES de recarregar — recarregar com o PUT
  // em voo cancela a escrita (navegação aborta o XHR), e a config não persiste.
  await Promise.all([
    page.waitForResponse(
      (r) => /\/multipliers\/$/.test(r.url()) && r.request().method() === 'PUT' && r.ok(),
    ),
    page.getByRole('button', { name: 'Salvar multiplicadores' }).click(),
  ])

  // Persistência prospectiva: recarregar reidrata o form da config vigente vinda
  // do servidor (DecimalField de 2 casas → "0.20").
  await page.reload()
  await expect(page.getByRole('spinbutton', { name: /Multiplicador de feriado/ })).toHaveValue(
    /0\.20?/,
    RECONCILE,
  )
})

test('feriado congela peso efetivo, exibe legenda factual e o override não sangra (AC1, AC2, AC3)', async ({
  page,
  email,
}) => {
  test.setTimeout(90_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  // "Profissional" (Emails peso 2 + Relatório peso 1) com multiplicador de
  // feriado ×0,2; "Pessoal" (Ler peso 1) sem config (×1,0).
  seedMultiplierScenario(email, { professionalHolidayMultiplier: '0.2' })

  // A 1ª abertura materializa uma linha por hábito, congelando `day_type` e
  // `multiplier_at_time` do dia real (sem config de fim de semana → ×1,0).
  await page.goto('/today')
  await expect(page.getByRole('heading', { name: 'Hábitos', level: 2 })).toBeVisible()

  // AC2 baseline (pesos efetivos = pesos base, ×1,0). Marca um por vez e assere a
  // completude do servidor entre as ações (serializa; sem legenda pois é ×1,0):
  //   Emails feito → (1×2)/(2+1+1) = 50%; + Relatório feito → (2+1)/4 = 75%.
  await page.getByRole('checkbox', { name: 'Emails' }).click()
  await expect(page.getByText('Completude do dia: 50%')).toBeVisible(RECONCILE)
  await page.getByRole('checkbox', { name: 'Relatório' }).click()
  await expect(page.getByText('Completude do dia: 75%')).toBeVisible(RECONCILE)
  await expect(page.getByText(/peso ×/)).toHaveCount(0)

  // AC1/AC2/AC3 — marca hoje como FERIADO. `set_holiday` re-resolve só as linhas
  // de hoje: "Profissional" recebe ×0,2 (config), "Pessoal" fica ×1,0.
  await page.getByRole('checkbox', { name: 'Feriado' }).click()
  await expect(page.getByRole('checkbox', { name: 'Feriado' })).toBeChecked()

  // AC2 — completude por peso efetivo (Dev Notes, exemplo âncora): pesos efetivos
  // Emails=2×0,2=0,4, Relatório=1×0,2=0,2, Ler=1×1,0=1,0 →
  // (1×0,4 + 1×0,2 + 0×1,0)/(0,4+0,2+1,0) = 0,6/1,6 = 37,5% → 38% (ROUND_HALF_UP).
  await expect(page.getByText('Completude do dia: 38%')).toBeVisible(RECONCILE)
  // AC2 — legenda factual de peso efetivo no grupo com multiplicador ≠ 1
  // (texto + ícone; cor nunca sozinha — UX-DR13). "Pessoal" (×1,0) não a exibe.
  await expect(page.getByText('Feriado · peso ×0,2')).toBeVisible()
  // "Profissional" tudo feito → 100%; "Pessoal" nada feito → 0%.
  await expect(page.getByRole('heading', { name: /Profissional.*100%/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Pessoal.*0%/ })).toBeVisible()

  // AC3 — override avulso "tratar este dia como dia útil (peso cheio)": seta
  // `multiplier_at_time = 1,0` só nas linhas de hoje. A completude volta a 75% e
  // a legenda some (multiplicador ×1,0), sem tocar a config nem vizinhos.
  await page.getByRole('button', { name: 'Tratar este dia como dia útil (peso cheio)' }).click()
  await expect(page.getByText('Completude do dia: 75%')).toBeVisible(RECONCILE)
  await expect(page.getByText(/peso ×/)).toHaveCount(0)

  // AC3 — desmarcar o feriado re-resolve só hoje de volta ao tipo real do dia
  // (sem config de fim de semana → ×1,0): o toggle desliga, a completude fica em
  // 75% e nenhuma legenda de peso aparece — em qualquer dia da execução.
  await page.getByRole('checkbox', { name: 'Feriado' }).click()
  await expect(page.getByRole('checkbox', { name: 'Feriado' })).not.toBeChecked()
  await expect(page.getByText('Completude do dia: 75%')).toBeVisible(RECONCILE)
  await expect(page.getByText(/peso ×/)).toHaveCount(0)

  expect(consoleErrors).toEqual([])
})

test('feriado com multiplicador zero remove o grupo do numerador e do denominador (AC2, AC3)', async ({
  page,
  email,
}) => {
  test.setTimeout(90_000)

  // "Profissional" com multiplicador de FERIADO ×0 (semântico: nesse feriado os
  // hábitos do grupo não contam). "Pessoal" sem config (×1,0).
  seedMultiplierScenario(email, { professionalHolidayMultiplier: '0' })

  await page.goto('/today')
  await expect(page.getByRole('heading', { name: 'Hábitos', level: 2 })).toBeVisible()

  // Baseline (×1,0 em todos): deixa "Profissional" incompleto e marca só "Ler"
  // (Pessoal) → (0×2 + 0×1 + 1×1)/(2+1+1) = 1/4 = 25%.
  await page.getByRole('checkbox', { name: 'Ler' }).click()
  await expect(page.getByText('Completude do dia: 25%')).toBeVisible(RECONCILE)

  // AC2/AC3 — marca feriado: "Profissional" passa a peso efetivo 0 → sai de
  // numerador E denominador (guarda Σ peso_efetivo == 0 → 0% no grupo). A
  // completude do dia passa a refletir só "Pessoal" (100% feito): (1×1)/1 = 100%.
  // Sobe de 25% para 100% porque o grupo incompleto foi inteiramente removido —
  // não porque algo foi concluído.
  await page.getByRole('checkbox', { name: 'Feriado' }).click()
  await expect(page.getByRole('checkbox', { name: 'Feriado' })).toBeChecked()
  await expect(page.getByText('Completude do dia: 100%')).toBeVisible(RECONCILE)
  await expect(page.getByText('Feriado · peso ×0')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Profissional.*0%/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Pessoal.*100%/ })).toBeVisible()

  // AC3 — desmarcar feriado re-resolve só hoje; "Profissional" volta ao
  // denominador e a completude cai de volta para 25% (bounded, sem sangramento).
  await page.getByRole('checkbox', { name: 'Feriado' }).click()
  await expect(page.getByRole('checkbox', { name: 'Feriado' })).not.toBeChecked()
  await expect(page.getByText('Completude do dia: 25%')).toBeVisible(RECONCILE)
})
