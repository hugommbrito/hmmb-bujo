import { test, expect } from './fixtures'

// Cobre a Story 4.5 (Templates de tarefas recorrentes com placement manual)
// ponta-a-ponta contra o backend real, ATUALIZADO pela Story 11.2: a gestão
// de recorrentes saiu de Configurações e passou a viver no Planner
// ("Recorrentes"), com os templates segmentados em abas por grupo
// (Semanal/Mensal/Anual) e um filtro "mostrar inativos" (padrão: só ativos).
// O fluxo Recorrentes → placement → Weekly/Monthly Log continua sendo
// exercitado ponta-a-ponta contra o backend de verdade, provando a
// independência instância/template (AC3) real.
//
// ATUALIZADO pela Story 14.8 (M09): `/planner/recurring` passou a montar a
// biblioteca nova (`RecurringLibraryPage`), então os passos de CRIAÇÃO/EDIÇÃO
// deste arquivo foram PORTADOS do form legado (`RecurringTemplateManager`)
// para o card de detalhe compartilhado. Isso NÃO muda a causa raiz nem a
// posição das 4 falhas conhecidas abaixo — os passos portados só cobrem o
// trecho ANTES do assert que falha; o resto do arquivo (a seção de placement)
// continua intocado, porque falha por um motivo TOTALMENTE alheio à criação:
//
//   `getByText('{título} — {Grupo}')` da `RecurringPlacementSection` não
//   encontra nada porque essa seção vive nas páginas legadas `WeeklyPage.tsx`/
//   `MonthlyPage.tsx`, enquanto `planner/week`/`planner/month` montam os
//   boards NOVOS (`WeeklyBoardPage`/`MonthlyBoardPage`) desde as Stories
//   14.5/14.6 — a alocação de recorrentes virou ato do RITUAL lá, por desenho
//   de produto (M06/M07), e os boards novos simplesmente não renderizam a
//   seção antiga. Consertar isso reintroduzindo a seção no board novo
//   desfaria duas decisões de produto de stories anteriores — não é desta
//   story, nem desta. Dono: Épico 17/18 (quando o legado de placement sair).
//
// Critério de aceite POSICIONAL (Story 14.8, AC9): depois desta entrega, as 4
// falhas continuam exatamente no passo de placement (nunca antes, nunca num
// passo de biblioteca) — nenhum teste é deletado nem `.skip`ado. A cobertura
// REAL da biblioteca nova (criar/editar/desativar/excluir na UI nova) é
// `recurring-library.spec.ts`, não este arquivo — portar aqui só evita que os
// 4 testes morram na PRIMEIRA interação (o form legado não existe mais na
// rota), não dá cobertura nova.

test('CRUD de templates em Recorrentes + placement filtra por grupo e chega ao Weekly/Monthly Log real (AC1, AC2)', async ({
  page,
}) => {
  test.setTimeout(120_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  // AC1: cria um template weekly e um monthly em Planner > Recorrentes
  // (tabela separada de `tasks`, sem ciclo de vida — provado indiretamente
  // pela listagem, já que não há status/log algum nesta tela).
  await page.getByRole('button', { name: 'Recorrentes' }).click()
  await expect(page.getByLabel('Recorrentes')).toBeVisible()

  // Story 14.8: criação passou do form legado para o card de detalhe
  // compartilhado. `getByLabel('Título')` sem escopo casa também o campo
  // oculto do `BrainDumpCaptureSheet` (portalizado em toda rota desde a 13.3)
  // — escopar ao card evita o falso positivo/negativo.
  const card = page.getByRole('dialog', { name: 'Detalhe do template' })

  // Aba "Semanal" é a default → o Grupo herda a aba (AC3 da 14.8).
  await page.getByRole('button', { name: 'Novo template', exact: true }).click()
  await expect(card).toBeVisible()
  await card.getByLabel('Título').fill('Reunião semanal')
  await card.getByLabel('Recorrência', { exact: true }).fill('toda segunda')
  await card.getByRole('button', { name: 'Criar' }).click()
  await expect(card).toHaveCount(0)
  await expect(page.getByText('Semanal — toda segunda')).toBeVisible({ timeout: 10_000 })

  // Trocar para a aba "Mensal" → o próximo template nasce monthly (o Grupo
  // do card herda a aba ativa no momento da criação).
  await page.getByRole('tab', { name: /Mensal/ }).click()
  await page.getByRole('button', { name: 'Novo template', exact: true }).click()
  await expect(card).toBeVisible()
  await card.getByLabel('Título').fill('Pagar contas')
  await card.getByLabel('Recorrência', { exact: true }).fill('todo dia 5')
  await card.getByRole('button', { name: 'Criar' }).click()
  await expect(card).toHaveCount(0)
  await expect(page.getByText('Mensal — todo dia 5')).toBeVisible({ timeout: 10_000 })
  // Segmentação por aba: o weekly não aparece na aba Mensal.
  await expect(page.getByText(/Semanal — toda segunda/)).toHaveCount(0)

  // A PARTIR DAQUI: seção de placement, causa raiz documentada no cabeçalho do
  // arquivo — o assert abaixo falha (posicionalmente, como já falhava antes
  // desta story) porque `RecurringPlacementSection` não existe em
  // `WeeklyBoardPage`. Tudo depois desta linha é código que NÃO EXECUTA hoje
  // (inclusive "Desativar o template mensal" mais abaixo) — não está coberto
  // por ninguém, e não é reescrito por esta story (ver cabeçalho).
  //
  // AC2: na abertura da semana, só o template weekly ativo aparece — sem
  // auto-placement, o botão "Alocar" é a única ação disponível.
  await page.getByRole('button', { name: 'Esta Semana' }).click()
  await expect(page.getByLabel('Esta Semana')).toBeVisible()
  await expect(page.getByText('Reunião semanal — Semanal')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/Pagar contas/)).toHaveCount(0)

  await page.getByRole('button', { name: 'Alocar' }).click()
  const weekDialog = page.getByRole('dialog')
  await expect(weekDialog.getByText('Alocar')).toBeVisible()
  await expect(weekDialog.getByLabel('Data (opcional)')).toBeVisible()
  // Story 11.3 (AC2): o modal mostra as infos da recorrência e o calendário de
  // densidade do mês (informativo). Densidade real vem do endpoint novo.
  await expect(weekDialog.getByText('Reunião semanal')).toBeVisible()
  await expect(weekDialog.getByText('Recorrência: toda segunda')).toBeVisible()
  await expect(weekDialog.getByRole('columnheader', { name: 'Seg' })).toBeVisible()
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/place/') && r.request().method() === 'POST' && r.ok(),
    ),
    weekDialog.getByRole('button', { name: 'Confirmar' }).click(),
  ])
  await expect(weekDialog).toHaveCount(0)

  // A instância colocada é uma Task de verdade (snapshot com linhagem) — cai
  // em "Sem dia definido" porque nenhuma data foi informada.
  await expect(
    page.getByTestId('task-row').filter({ hasText: 'Reunião semanal' }),
  ).toBeVisible({ timeout: 10_000 })

  // Abertura do mês: só o template monthly ativo aparece (mês corrente).
  await page.getByRole('button', { name: 'Este Mês' }).click()
  await expect(page.getByLabel('Este Mês')).toBeVisible()
  await expect(page.getByText('Pagar contas — Mensal')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/Reunião semanal/)).toHaveCount(0)

  await page.getByRole('button', { name: 'Alocar' }).click()
  const monthDialog = page.getByRole('dialog')
  await expect(monthDialog.getByLabel('Dia (opcional)')).toBeVisible()
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/place/') && r.request().method() === 'POST' && r.ok(),
    ),
    monthDialog.getByRole('button', { name: 'Confirmar' }).click(),
  ])
  await expect(monthDialog).toHaveCount(0)
  await expect(
    page.getByTestId('task-row').filter({ hasText: 'Pagar contas' }),
  ).toBeVisible({ timeout: 10_000 })

  // Desativar o template mensal: some da seção de placement (o filtro
  // `active=true` do backend, Task 7.1) e também some da view de Recorrentes
  // (filtro client-side "mostrar inativos" desligado por padrão, Story 11.2),
  // mas continua existindo/editável — desativar não é o mesmo que apagar.
  await page.getByRole('button', { name: 'Recorrentes' }).click()
  await expect(page.getByLabel('Recorrentes')).toBeVisible()
  await page.getByRole('tab', { name: 'Mensal' }).click()
  await expect(page.getByText(/Mensal — todo dia 5/)).toBeVisible({ timeout: 10_000 })
  // Na aba Mensal só "Pagar contas" existe; escopar pela linha certa via
  // ancestral direto do título (`ancestor::div[2]`: Typography do título →
  // Box `flex:1` → Box da linha, mesma estrutura de `TemplateRow`), não pelo
  // texto isolado do botão.
  const pagarContasRow = page
    .getByText('Pagar contas', { exact: true })
    .locator('xpath=ancestor::div[2]')
  await pagarContasRow.getByRole('button', { name: 'Desativar' }).click()
  // Com "mostrar inativos" desligado, o template desativado some da view.
  await expect(page.getByText('Pagar contas', { exact: true })).toHaveCount(0, { timeout: 10_000 })
  // Ligar o Switch "Mostrar inativos" o traz de volta com o sufixo "(inativo)".
  await page.getByRole('checkbox', { name: 'Mostrar inativos' }).click()
  await expect(page.getByText(/Mensal — todo dia 5 \(inativo\)/)).toBeVisible({ timeout: 10_000 })

  await page.getByRole('button', { name: 'Este Mês' }).click()
  await expect(page.getByLabel('Este Mês')).toBeVisible()
  await expect(page.getByText(/Pagar contas — Mensal/)).toHaveCount(0, { timeout: 10_000 })
  // A instância já colocada antes da desativação não desaparece — desativar
  // um template não afeta placements já feitos.
  await expect(page.getByTestId('task-row').filter({ hasText: 'Pagar contas' })).toBeVisible()

  expect(consoleErrors).toEqual([])
})

test('AC3 — editar o template depois de um placement não muda a instância já colocada; colocar de novo usa os campos atualizados', async ({
  page,
}) => {
  test.setTimeout(120_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.getByRole('button', { name: 'Recorrentes' }).click()
  await expect(page.getByLabel('Recorrentes')).toBeVisible()

  // Aba "Semanal" default → Standup nasce weekly (Story 14.8: card em vez do
  // form legado — ver cabeçalho do arquivo).
  const card = page.getByRole('dialog', { name: 'Detalhe do template' })
  await page.getByRole('button', { name: 'Novo template', exact: true }).click()
  await expect(card).toBeVisible()
  await card.getByLabel('Título').fill('Standup')
  await card.getByLabel('Recorrência', { exact: true }).fill('toda manhã')
  await card.getByRole('button', { name: 'Criar' }).click()
  await expect(card).toHaveCount(0)
  await expect(page.getByText('Semanal — toda manhã')).toBeVisible({ timeout: 10_000 })

  // A PARTIR DAQUI: seção de placement — mesma causa raiz do cabeçalho do
  // arquivo (RecurringPlacementSection não existe em WeeklyBoardPage). Tudo
  // depois desta linha, incl. "editar o template depois do placement" mais
  // abaixo, é código que NÃO EXECUTA hoje — não é reescrito por esta story.
  //
  // Primeiro placement, antes de qualquer edição no template.
  await page.getByRole('button', { name: 'Esta Semana' }).click()
  await expect(page.getByLabel('Esta Semana')).toBeVisible()
  await expect(page.getByText('Standup — Semanal')).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Alocar' }).click()
  const firstDialog = page.getByRole('dialog')
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/place/') && r.request().method() === 'POST' && r.ok(),
    ),
    firstDialog.getByRole('button', { name: 'Confirmar' }).click(),
  ])
  await expect(firstDialog).toHaveCount(0)
  await expect(
    page.getByTestId('task-row').filter({ hasText: 'Standup' }),
  ).toBeVisible({ timeout: 10_000 })

  // Edita o template DEPOIS do placement — muda só o título.
  await page.getByRole('button', { name: 'Recorrentes' }).click()
  await expect(page.getByLabel('Recorrentes')).toBeVisible()
  await page.getByRole('button', { name: 'Editar' }).click()
  // A linha da lista renderiza antes do form de criação no DOM — o primeiro
  // campo "Título" é o da linha em edição (mesma técnica documentada no
  // Debug Log da própria story para WeeklyPage/MonthlyPage).
  await page.getByLabel('Título').first().fill('Standup (renomeado)')
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/recurring-templates/') && r.request().method() === 'PATCH' && r.ok(),
    ),
    page.getByRole('button', { name: 'Salvar' }).click(),
  ])
  await expect(page.getByText(/Standup \(renomeado\)/)).toBeVisible({ timeout: 10_000 })

  // AC3, primeira metade: a Task já colocada NÃO muda de título.
  await page.getByRole('button', { name: 'Esta Semana' }).click()
  await expect(page.getByLabel('Esta Semana')).toBeVisible()
  await expect(page.getByTestId('task-row').filter({ hasText: 'Standup' })).toBeVisible({
    timeout: 10_000,
  })
  await expect(
    page.getByTestId('task-row').filter({ hasText: 'Standup (renomeado)' }),
  ).toHaveCount(0)

  // AC3, segunda metade: a seção de placement já reflete o template
  // atualizado. Story 11.3 (dedup): como o Standup já foi colocado nesta
  // semana, ele some da lista por padrão; ligar "Mostrar já colocados" o traz
  // de volta com "(já colocado)" e permite recolocar (nova ocorrência) — o
  // caminho explícito de recolocação sem bloqueio rígido.
  await expect(page.getByText(/Standup \(renomeado\) — Semanal/)).toHaveCount(0, {
    timeout: 10_000,
  })
  await page.getByRole('checkbox', { name: 'Mostrar já colocados' }).click()
  await expect(page.getByText('Standup (renomeado) — Semanal (já colocado)')).toBeVisible({
    timeout: 10_000,
  })
  await page.getByRole('button', { name: 'Alocar' }).click()
  const secondDialog = page.getByRole('dialog')
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/place/') && r.request().method() === 'POST' && r.ok(),
    ),
    secondDialog.getByRole('button', { name: 'Confirmar' }).click(),
  ])
  await expect(secondDialog).toHaveCount(0)

  // As duas instâncias coexistem: a antiga (congelada) e a nova (com o
  // título atualizado) — prova direta de que a Task nunca relê o template.
  await expect(
    page.getByTestId('task-row').filter({ hasText: 'Standup (renomeado)' }),
  ).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('task-row').filter({ hasText: 'Standup' })).toHaveCount(2)

  expect(consoleErrors).toEqual([])
})

test('AC2/AC3 — modal do Monthly mostra título/descrição/recorrência + calendário com densidade real (3 fontes), e o calendário é só informativo', async ({
  page,
}) => {
  test.setTimeout(120_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  // A fixture já pousa em /today com o Daily Log vazio. Uma tarefa avulsa
  // criada aqui vira uma fonte "daily" (log_date = hoje) para o endpoint de
  // densidade (Task 2.2) — prova, contra o backend real, que a agregação
  // do calendário não se limita ao monthly_log.
  await page.getByLabel('Nova tarefa').fill('Tarefa avulsa de hoje')
  await page.getByRole('button', { name: 'Nova tarefa' }).click()
  await expect(
    page.getByTestId('task-row').filter({ hasText: 'Tarefa avulsa de hoje' }),
  ).toBeVisible()

  const now = new Date()
  const monthLabels = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ]
  const todayDay = now.getDate()
  const todayMonthLabel = monthLabels[now.getMonth()]

  // Cria um template mensal com descrição preenchida — cobre o ramo
  // condicional de `template.description` do dialog (não exercitado pelo
  // outro teste, cujos templates nascem sem descrição).
  await page.getByRole('button', { name: 'Recorrentes' }).click()
  await expect(page.getByLabel('Recorrentes')).toBeVisible()
  await page.getByRole('tab', { name: /Mensal/ }).click()
  // Story 14.8: criação passou do form legado para o card compartilhado.
  const card = page.getByRole('dialog', { name: 'Detalhe do template' })
  await page.getByRole('button', { name: 'Novo template', exact: true }).click()
  await expect(card).toBeVisible()
  await card.getByLabel('Título').fill('Fechar o mês')
  await card.getByLabel('Descrição').fill('Conferir saldo e categorizar gastos')
  await card.getByLabel('Recorrência', { exact: true }).fill('todo fim de mês')
  await card.getByRole('button', { name: 'Criar' }).click()
  await expect(card).toHaveCount(0)
  await expect(page.getByText('Mensal — todo fim de mês')).toBeVisible({ timeout: 10_000 })

  // A PARTIR DAQUI: seção de placement — mesma causa raiz do cabeçalho do
  // arquivo (RecurringPlacementSection não existe em MonthlyBoardPage). Não é
  // reescrito por esta story.
  await page.getByRole('button', { name: 'Este Mês' }).click()
  await expect(page.getByLabel('Este Mês')).toBeVisible()
  await expect(page.getByText('Fechar o mês — Mensal')).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Alocar' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Fechar o mês')).toBeVisible()
  await expect(dialog.getByText('Conferir saldo e categorizar gastos')).toBeVisible()
  await expect(dialog.getByText('Recorrência: todo fim de mês')).toBeVisible()

  // Calendário de densidade: aguarda a resposta real do endpoint novo antes
  // de checar a contagem, para não correr contra o fetch em andamento.
  await page.waitForResponse(
    (r) => r.url().includes('/task-density/') && r.request().method() === 'GET' && r.ok(),
  )
  const calendar = dialog.getByRole('table', { name: `Densidade de tarefas de ${todayMonthLabel}` })
  await expect(calendar).toBeVisible()
  await expect(
    calendar.getByRole('cell', { name: `${todayDay} de ${todayMonthLabel}, 1 tarefa` }),
  ).toBeVisible()

  // AC3: nesta story o calendário é puramente informativo — nenhuma célula é
  // um controle interativo (a Story 11.6 é quem liga `onSelectDay`).
  await expect(calendar.getByRole('button')).toHaveCount(0)

  // Fechar sem confirmar não deve criar nenhuma instância nova.
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('Fechar o mês — Mensal')).toBeVisible()

  expect(consoleErrors).toEqual([])
})

// Cobre a Story 11.8 (etiqueta Eisenhower no modal de placement) ponta-a-ponta
// contra o backend real. Os outros testes deste arquivo criam templates SEM
// prioridade, então nunca exercitam a linha nova "Prioridade: …" — e o teste de
// componente monta o dialog com uma fixture mockada, sem provar que `eisenhower`
// percorre form → serializer real → lista → modal. Este teste fecha esse gap:
// cria um template COM prioridade e outro SEM, e assere presença/ausência da
// linha no modal real (AC1 e a regra de nulos AC3).
test('AC1/AC3 (Story 11.8) — modal de placement exibe a etiqueta Eisenhower do template com prioridade real e a omite quando ausente', async ({
  page,
}) => {
  test.setTimeout(120_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.getByRole('button', { name: 'Recorrentes' }).click()
  await expect(page.getByLabel('Recorrentes')).toBeVisible()

  // Template COM prioridade Eisenhower "Urgente + Importante" (ui). Story
  // 14.8: o `<Select>` legado virou o par de checkboxes canônico
  // (`EisenhowerCheckboxPair`) — marcar as duas é o equivalente de "Urgente +
  // Importante". O snapshot de placement copia `eisenhower` do template,
  // então esse valor precisa vir do backend de verdade, não de uma fixture.
  const card = page.getByRole('dialog', { name: 'Detalhe do template' })
  await page.getByRole('button', { name: 'Novo template', exact: true }).click()
  await expect(card).toBeVisible()
  await card.getByLabel('Título').fill('Planejamento crítico')
  await card.getByLabel('Recorrência', { exact: true }).fill('toda segunda')
  await card.getByRole('checkbox', { name: 'Urgente (U)' }).check()
  await card.getByRole('checkbox', { name: 'Importante (I)' }).check()
  await card.getByRole('button', { name: 'Criar' }).click()
  await expect(card).toHaveCount(0)
  await expect(page.getByText('Semanal — toda segunda')).toBeVisible({ timeout: 10_000 })

  // Template SEM prioridade (Eisenhower deixado em "Nenhum") — controle da
  // regra de nulos (AC3).
  await page.getByRole('button', { name: 'Novo template', exact: true }).click()
  await expect(card).toBeVisible()
  await card.getByLabel('Título').fill('Rotina neutra')
  await card.getByLabel('Recorrência', { exact: true }).fill('toda sexta')
  await card.getByRole('button', { name: 'Criar' }).click()
  await expect(card).toHaveCount(0)
  await expect(page.getByText('Semanal — toda sexta')).toBeVisible({ timeout: 10_000 })

  // A PARTIR DAQUI: seção de placement — mesma causa raiz do cabeçalho do
  // arquivo. Não é reescrito por esta story.
  await page.getByRole('button', { name: 'Esta Semana' }).click()
  await expect(page.getByLabel('Esta Semana')).toBeVisible()
  await expect(page.getByText('Planejamento crítico — Semanal')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Rotina neutra — Semanal')).toBeVisible()

  // AC1: o modal do template com prioridade real mostra "Prioridade: …" junto
  // de título e recorrência (que a 11.3 já exibia). Escopa o botão à linha certa
  // (há dois "Alocar" na seção).
  const criticalRow = page
    .getByText('Planejamento crítico — Semanal', { exact: true })
    .locator('xpath=ancestor::div[1]')
  await criticalRow.getByRole('button', { name: 'Alocar' }).click()
  const criticalDialog = page.getByRole('dialog')
  await expect(criticalDialog.getByText('Planejamento crítico', { exact: true })).toBeVisible()
  await expect(criticalDialog.getByText('Recorrência: toda segunda')).toBeVisible()
  await expect(criticalDialog.getByText('Prioridade: Urgente + Importante')).toBeVisible()
  // Fechar sem colocar — o teste é sobre a renderização do modal, não o placement.
  await criticalDialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(criticalDialog).toHaveCount(0)

  // AC3: o modal do template sem prioridade não exibe nenhuma linha "Prioridade:"
  // (nada de "Prioridade: Nenhum"), mas segue mostrando título e recorrência.
  const neutralRow = page
    .getByText('Rotina neutra — Semanal', { exact: true })
    .locator('xpath=ancestor::div[1]')
  await neutralRow.getByRole('button', { name: 'Alocar' }).click()
  const neutralDialog = page.getByRole('dialog')
  await expect(neutralDialog.getByText('Rotina neutra', { exact: true })).toBeVisible()
  await expect(neutralDialog.getByText('Recorrência: toda sexta')).toBeVisible()
  await expect(neutralDialog.getByText(/Prioridade:/)).toHaveCount(0)
  await neutralDialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(neutralDialog).toHaveCount(0)

  expect(consoleErrors).toEqual([])
})
