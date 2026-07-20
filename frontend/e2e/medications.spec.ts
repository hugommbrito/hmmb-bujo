import { test, expect } from './fixtures'
import { seedMedication } from './seedMedications'

// Cobre a Story 8.1 (Cadastro de medicamentos com slot estável e versões) ponta-a-ponta
// contra o backend real (branch Neon `e2e`, sem mocks de rede) — a fundação de
// modelagem do Épico 8. A tela vive em Configurações › Medicamentos
// (`/settings/medications`), sub-página do hub de Configurações. O catálogo versionado
// (`medications` + `medication_substance_versions` + `medication_schedule_versions` +
// `time_blocks` + `doctors`) é a fonte de verdade prospectiva que a 8.2/8.3 vão consumir.
//
// Divergência de saúde: Medicamentos VERSIONA — desativar uma agenda é uma nova versão
// com `active=false` (prospectiva), nunca um delete físico. Mutações config-CRUD são SEM
// otimismo (invalidateQueries ['medications']): a lista só reflete a escrita depois do
// refetch de `onSuccess`. As asserções de visibilidade (reexecutadas com timeout pelo
// Playwright) já provam que o POST commitou no backend real; só recarregamos DEPOIS que a
// UI reflete a mudança. A branch Neon `e2e` tem latência de cold-start (ver
// playwright.config.ts), daí os timeouts folgados.

const LIST_TIMEOUT = { timeout: 15_000 }

test('AC1/AC2/AC3/AC7 — navega Configurações → Medicamentos, cria bloco + medicamento + dose e persiste', async ({
  page,
}) => {
  test.setTimeout(120_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  // Navegabilidade ponta-a-ponta (Task 5): do hub de Configurações até Medicamentos.
  await page.goto('/settings')
  await expect(page.getByRole('main', { name: 'Configurações' })).toBeVisible()
  await page.getByRole('link', { name: 'Medicamentos' }).click()
  await expect(page).toHaveURL('/settings/medications')
  await expect(page.getByRole('main', { name: 'Configurações — Medicamentos' })).toBeVisible()

  // Estado inicial vazio (voz UX-DR13: neutro, sem gamificação).
  await expect(page.getByText('Nenhum medicamento ainda.')).toBeVisible()

  // AC2 — cria um bloco de horário dinâmico (sem migração de schema).
  const blockForm = page.getByRole('form', { name: 'Novo bloco de horário' })
  await blockForm.getByLabel('Novo bloco').fill('Manhã')
  await blockForm.getByRole('button', { name: 'Criar bloco' }).click()
  await expect(page.getByRole('button', { name: 'Desativar bloco Manhã' })).toBeVisible(
    LIST_TIMEOUT,
  )

  // AC1 — cria um medicamento (slot estável + substância vigente). UUID + active derivado.
  const medForm = page.getByRole('form', { name: 'Novo medicamento' })
  await medForm.getByLabel('Título').fill('Remédio de pressão')
  await medForm.getByLabel('Substância').fill('Losartana')
  await medForm.getByRole('button', { name: 'Criar medicamento' }).click()

  await expect(page.getByText('Remédio de pressão', { exact: true })).toBeVisible(LIST_TIMEOUT)
  await expect(page.getByText(/Losartana/)).toBeVisible()
  await expect(page.getByText('Nenhum medicamento ainda.')).toHaveCount(0)

  // AC3 — define a dose multi-componente de um bloco (eixo agenda, prospectivo).
  await page.getByRole('button', { name: 'Editar' }).click()
  await page.getByRole('combobox', { name: 'Bloco da dose de Remédio de pressão' }).click()
  await page.getByRole('option', { name: 'Manhã' }).click()
  await page.getByLabel('Remédio de pressão — quantidade do componente 1').fill('1')
  await page.getByLabel('Remédio de pressão — unidade do componente 1').fill('comp')
  await page.getByRole('button', { name: 'Salvar dose' }).click()

  await expect(page.getByText(/Manhã: 1 comp/)).toBeVisible(LIST_TIMEOUT)

  // AC1/AC3 — persistência real: recarregar reidrata do backend (o slot, a substância e
  // a versão de agenda sobreviveram ao round-trip), não de cache otimista.
  await page.reload()
  await expect(page.getByRole('main', { name: 'Configurações — Medicamentos' })).toBeVisible()
  await expect(page.getByText('Remédio de pressão', { exact: true })).toBeVisible(LIST_TIMEOUT)
  await expect(page.getByText(/Manhã: 1 comp/)).toBeVisible()

  expect(consoleErrors).toEqual([])
})

test('AC5 — desativar uma agenda grava versão active=false (nova versão prospectiva; nada é deletado) e persiste', async ({
  page,
  email,
}) => {
  test.setTimeout(120_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  // Seed determinístico pela camada de serviço (bloco + medicamento + agenda ativa).
  seedMedication(email, {
    title: 'Dipirona',
    substanceName: 'Dipirona sódica',
    blockName: 'Noite',
    dose: [{ label: '', amount: 1, unit: 'comp' }],
  })

  await page.goto('/settings/medications')
  await expect(page.getByRole('main', { name: 'Configurações — Medicamentos' })).toBeVisible()
  await expect(page.getByText('Dipirona', { exact: true })).toBeVisible(LIST_TIMEOUT)
  await expect(page.getByText(/Noite: 1 comp/)).toBeVisible()

  // AC5 — desativar a agenda: grava nova versão `active=false` (prospectiva). A agenda
  // some da lista ATIVA mas NUNCA é deletada — o toggle vira "Ativar" e o rótulo textual
  // "(inativo)" aparece (cor nunca é indicador único — WCAG).
  await page.getByRole('button', { name: 'Desativar agenda Noite' }).click()
  await expect(page.getByRole('button', { name: 'Ativar agenda Noite' })).toBeVisible(
    LIST_TIMEOUT,
  )
  await expect(page.getByText(/Noite: 1 comp \(inativo\)/)).toBeVisible()

  // Prova de não-deleção via persistência: recarregar mostra a agenda ainda existente e
  // desativada no backend (versão congelada, histórico preservado).
  await page.reload()
  await expect(page.getByRole('main', { name: 'Configurações — Medicamentos' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ativar agenda Noite' })).toBeVisible(
    LIST_TIMEOUT,
  )

  expect(consoleErrors).toEqual([])
})

test('AC6 — médico como catálogo: criar, associar na criação e reutilizar entre medicamentos', async ({
  page,
}) => {
  test.setTimeout(120_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.goto('/settings/medications')
  await expect(page.getByRole('main', { name: 'Configurações — Medicamentos' })).toBeVisible()

  // AC6 — cadastrar um médico no catálogo por tenant (name + specialty opcional).
  const doctorForm = page.getByRole('form', { name: 'Novo médico' })
  await doctorForm.getByLabel('Nome do médico').fill('Dra. Ana Prado')
  await doctorForm.getByLabel('Especialidade').fill('Cardiologia')
  await doctorForm.getByRole('button', { name: 'Criar médico' }).click()
  await expect(page.getByText('Dra. Ana Prado · Cardiologia')).toBeVisible(LIST_TIMEOUT)

  // AC6 — associar o médico já no cadastro do medicamento (Select "Médico do
  // medicamento"). O invalidateQueries ['medications'] cobre a query de médicos, então
  // a opção aparece no Select assim que o refetch conclui (o médico visível acima já prova).
  const medForm = page.getByRole('form', { name: 'Novo medicamento' })
  await medForm.getByLabel('Título').fill('Remédio de pressão')
  await medForm.getByLabel('Substância').fill('Losartana')
  await medForm.getByRole('combobox', { name: 'Médico do medicamento' }).click()
  await page.getByRole('option', { name: 'Dra. Ana Prado' }).click()
  await medForm.getByRole('button', { name: 'Criar medicamento' }).click()
  // A linha de substância resolve o nome do médico via prescribedBy → catálogo.
  await expect(page.getByText('Losartana · Dra. Ana Prado')).toBeVisible(LIST_TIMEOUT)

  // AC6 — reutilizar o MESMO médico num segundo medicamento (catálogo referenciável).
  await medForm.getByLabel('Título').fill('Suplemento')
  await medForm.getByLabel('Substância').fill('Vitamina D')
  await medForm.getByRole('combobox', { name: 'Médico do medicamento' }).click()
  await page.getByRole('option', { name: 'Dra. Ana Prado' }).click()
  await medForm.getByRole('button', { name: 'Criar medicamento' }).click()
  await expect(page.getByText('Vitamina D · Dra. Ana Prado')).toBeVisible(LIST_TIMEOUT)
  await expect(page.getByText('Losartana · Dra. Ana Prado')).toBeVisible()

  // Persistência real: ambos os medicamentos reidratam do backend referenciando o médico.
  await page.reload()
  await expect(page.getByRole('main', { name: 'Configurações — Medicamentos' })).toBeVisible()
  await expect(page.getByText('Losartana · Dra. Ana Prado')).toBeVisible(LIST_TIMEOUT)
  await expect(page.getByText('Vitamina D · Dra. Ana Prado')).toBeVisible()

  expect(consoleErrors).toEqual([])
})

test('AC4 — dois eixos de versão independentes: trocar a substância NÃO toca a agenda e vice-versa (prospectivo)', async ({
  page,
  email,
}) => {
  test.setTimeout(120_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  // Estado inicial determinístico: medicamento + agenda ativa de um bloco.
  seedMedication(email, {
    title: 'Remédio de pressão',
    substanceName: 'Losartana',
    blockName: 'Manhã',
    dose: [{ label: '', amount: 1, unit: 'comp' }],
  })

  await page.goto('/settings/medications')
  await expect(page.getByRole('main', { name: 'Configurações — Medicamentos' })).toBeVisible()
  await expect(page.getByText('Remédio de pressão', { exact: true })).toBeVisible(LIST_TIMEOUT)
  await expect(page.getByText('Losartana', { exact: true })).toBeVisible()
  await expect(page.getByText(/Manhã: 1 comp/)).toBeVisible()

  // AC4 (eixo substância) — trocar só a substância/laboratório insere uma NOVA
  // medication_substance_versions prospectiva; a agenda (eixo independente) NÃO muda.
  await page.getByRole('button', { name: 'Editar' }).click()
  const editForm = page.getByRole('form', { name: 'Editar Remédio de pressão' })
  await editForm.getByLabel('Substância de Remédio de pressão').fill('Losartana Potássica')
  await editForm.getByLabel('Laboratório de Remédio de pressão').fill('EMS')
  await editForm.getByRole('button', { name: 'Salvar', exact: true }).click()

  await expect(page.getByText('Losartana Potássica · EMS')).toBeVisible(LIST_TIMEOUT)
  // Independência: a dose de Manhã segue intacta (o eixo agenda não foi tocado).
  await expect(page.getByText(/Manhã: 1 comp/)).toBeVisible()

  // AC4 (eixo agenda) — trocar só a dose insere uma nova medication_schedule_versions;
  // a substância (eixo independente) NÃO muda.
  await page.getByRole('button', { name: 'Editar' }).click()
  await page.getByRole('combobox', { name: 'Bloco da dose de Remédio de pressão' }).click()
  await page.getByRole('option', { name: 'Manhã' }).click()
  await page.getByLabel('Remédio de pressão — quantidade do componente 1').fill('2')
  await page.getByRole('button', { name: 'Salvar dose' }).click()

  await expect(page.getByText(/Manhã: 2 comp/)).toBeVisible(LIST_TIMEOUT)
  // Independência: a substância vigente segue intacta.
  await expect(page.getByText('Losartana Potássica · EMS')).toBeVisible()

  // Persistência real dos dois eixos após round-trip.
  await page.reload()
  await expect(page.getByRole('main', { name: 'Configurações — Medicamentos' })).toBeVisible()
  await expect(page.getByText('Losartana Potássica · EMS')).toBeVisible(LIST_TIMEOUT)
  await expect(page.getByText(/Manhã: 2 comp/)).toBeVisible()

  expect(consoleErrors).toEqual([])
})

test('AC3/AC7 (caso de erro) — dose sem unidade é rejeitada pelo backend real, erro inline e input preservado no retry', async ({
  page,
}) => {
  test.setTimeout(120_000)

  await page.goto('/settings/medications')
  await expect(page.getByRole('main', { name: 'Configurações — Medicamentos' })).toBeVisible()

  // Setup mínimo pela UI: um bloco + um medicamento (ainda sem agenda).
  const blockForm = page.getByRole('form', { name: 'Novo bloco de horário' })
  await blockForm.getByLabel('Novo bloco').fill('Manhã')
  await blockForm.getByRole('button', { name: 'Criar bloco' }).click()
  await expect(page.getByRole('button', { name: 'Desativar bloco Manhã' })).toBeVisible(
    LIST_TIMEOUT,
  )

  const medForm = page.getByRole('form', { name: 'Novo medicamento' })
  await medForm.getByLabel('Título').fill('Dipirona')
  await medForm.getByLabel('Substância').fill('Dipirona sódica')
  await medForm.getByRole('button', { name: 'Criar medicamento' }).click()
  await expect(page.getByText('Dipirona', { exact: true })).toBeVisible(LIST_TIMEOUT)

  // AC3 — a dose é validada na camada de SERVIÇO (unit não-vazia obrigatória). Informar a
  // quantidade e deixar a unidade em branco → o backend REAL rejeita (nada de validação
  // client-side). Prova a AC3 pelo lado negativo, ponta-a-ponta.
  await page.getByRole('button', { name: 'Editar' }).click()
  await page.getByRole('combobox', { name: 'Bloco da dose de Dipirona' }).click()
  await page.getByRole('option', { name: 'Manhã' }).click()
  await page.getByLabel('Dipirona — quantidade do componente 1').fill('1')
  // unidade deixada VAZIA de propósito
  await page.getByRole('button', { name: 'Salvar dose' }).click()

  // AC7 — erro de escrita: mensagem inline factual (role="alert", voz UX-DR13 neutra) e
  // NENHUMA agenda persistida (nenhuma linha "Manhã: ..." aparece).
  await expect(page.getByText('Não foi possível salvar. Tente novamente.')).toBeVisible(
    LIST_TIMEOUT,
  )
  await expect(page.getByText(/Manhã: /)).toHaveCount(0)

  // AC7 — input preservado: a quantidade continua "1" após o erro; basta completar a
  // unidade e reenviar — o retry passa e a agenda é criada.
  await expect(page.getByLabel('Dipirona — quantidade do componente 1')).toHaveValue('1')
  await page.getByLabel('Dipirona — unidade do componente 1').fill('comp')
  await page.getByRole('button', { name: 'Salvar dose' }).click()
  await expect(page.getByText(/Manhã: 1 comp/)).toBeVisible(LIST_TIMEOUT)

  // Persistência real do retry bem-sucedido.
  await page.reload()
  await expect(page.getByRole('main', { name: 'Configurações — Medicamentos' })).toBeVisible()
  await expect(page.getByText(/Manhã: 1 comp/)).toBeVisible(LIST_TIMEOUT)
})

test('AC2/AC5 — desativação em versões: medicamento em lote (nível-Item Row) e bloco (esconde sem apagar), ambos reversíveis', async ({
  page,
  email,
}) => {
  test.setTimeout(120_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  seedMedication(email, {
    title: 'Vitamina C',
    substanceName: 'Ácido ascórbico',
    blockName: 'Manhã',
    dose: [{ label: '', amount: 1, unit: 'comp' }],
  })

  await page.goto('/settings/medications')
  await expect(page.getByRole('main', { name: 'Configurações — Medicamentos' })).toBeVisible()
  await expect(page.getByText('Vitamina C', { exact: true })).toBeVisible(LIST_TIMEOUT)
  await expect(page.getByText(/Manhã: 1 comp/)).toBeVisible()

  // AC5 (Decisão 5) — "Desativar" no nível do medicamento aplica active=false em LOTE a
  // todas as agendas ativas (nova versão prospectiva; nada deletado). Como `medications`
  // não tem coluna active, o estado inativo é DERIVADO (sem agenda ativa) e sinalizado por
  // texto "(inativo)" — cor nunca é indicador único (WCAG).
  await page.getByRole('button', { name: 'Desativar medicamento Vitamina C' }).click()
  await expect(page.getByRole('button', { name: 'Ativar medicamento Vitamina C' })).toBeVisible(
    LIST_TIMEOUT,
  )
  await expect(page.getByText('Vitamina C (inativo)')).toBeVisible()
  await expect(page.getByText(/Manhã: 1 comp \(inativo\)/)).toBeVisible()

  // Prova de não-deleção via persistência: recarregar mostra o medicamento ainda inativo.
  await page.reload()
  await expect(page.getByRole('main', { name: 'Configurações — Medicamentos' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ativar medicamento Vitamina C' })).toBeVisible(
    LIST_TIMEOUT,
  )

  // AC5 — reativar em lote traz o medicamento de volta ao estado ativo (sem "(inativo)").
  await page.getByRole('button', { name: 'Ativar medicamento Vitamina C' }).click()
  await expect(
    page.getByRole('button', { name: 'Desativar medicamento Vitamina C' }),
  ).toBeVisible(LIST_TIMEOUT)
  await expect(page.getByText('Vitamina C (inativo)')).toHaveCount(0)

  // AC2 — desativar um bloco de horário: some da lista ativa mas NUNCA é apagado.
  // "Mostrar inativos" o revela, e reativar o traz de volta (referências históricas
  // das versões de agenda preservadas).
  await page.getByRole('button', { name: 'Desativar bloco Manhã' }).click()
  await expect(page.getByRole('button', { name: 'Desativar bloco Manhã' })).toHaveCount(
    0,
    LIST_TIMEOUT,
  )
  await page.getByRole('checkbox', { name: 'Mostrar inativos' }).click()
  await expect(page.getByRole('button', { name: 'Ativar bloco Manhã' })).toBeVisible(LIST_TIMEOUT)
  await page.getByRole('button', { name: 'Ativar bloco Manhã' }).click()
  await expect(page.getByRole('button', { name: 'Desativar bloco Manhã' })).toBeVisible(
    LIST_TIMEOUT,
  )

  expect(consoleErrors).toEqual([])
})
