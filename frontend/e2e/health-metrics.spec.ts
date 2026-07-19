import { test, expect } from './fixtures'

// Cobre a Story 7.1 (Campos de saúde dinâmicos) ponta-a-ponta contra o backend
// real (branch Neon `e2e`, sem mocks de rede) — a fundação de modelagem do
// Épico 7. A tela vive em Configurações › Métricas de Saúde
// (`/settings/health-metrics`), sub-página do hub de Configurações. O catálogo
// `health_field_definitions` é a fonte de verdade que 7.2/7.3 vão consumir; aqui
// exercitamos só a gestão de DEFINIÇÕES (nome + tipo + opções de enum + ativo),
// não valores/log/histórico (7.2/7.3).
//
// Divergência de hábitos: Saúde NÃO versiona — desativar é um PATCH {active}
// simples (não sub-recurso `versions/`) e nada apaga fisicamente uma definição.
//
// Mutações config-CRUD são SEM otimismo (useMutation + invalidateQueries
// ['health']): a lista só reflete a escrita depois do refetch de `onSuccess`.
// Por isso as asserções de visibilidade (que o Playwright reexecuta com timeout)
// já provam que o POST/PATCH commitou no backend real — e só recarregamos a
// página DEPOIS que a UI reflete a mudança, para nunca correr contra uma escrita
// em voo (mesma disciplina do habit-multiplier.spec.ts). A branch Neon `e2e` tem
// latência de cold-start (ver playwright.config.ts), daí os timeouts folgados.

const LIST_TIMEOUT = { timeout: 15_000 }

test('AC1/AC4 — cria campo, renomeia (identidade mutável, tipo imutável na UI) e persiste no backend real; navegação Configurações → Métricas de Saúde', async ({
  page,
}) => {
  test.setTimeout(120_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  // Navegabilidade ponta-a-ponta (Task 5): do hub de Configurações até a tela de
  // Métricas de Saúde pelo link que a 7.1 adicionou.
  await page.goto('/settings')
  await expect(page.getByRole('main', { name: 'Configurações' })).toBeVisible()
  await page.getByRole('link', { name: 'Métricas de Saúde' }).click()
  await expect(page).toHaveURL('/settings/health-metrics')
  await expect(page.getByRole('main', { name: 'Configurações — Métricas de Saúde' })).toBeVisible()

  // Estado inicial vazio (voz UX-DR13: neutro, sem gamificação).
  await expect(page.getByText('Nenhum campo de saúde ainda.')).toBeVisible()

  // AC1 — cria um campo `integer` (tipo default do form → não precisa mexer no
  // seletor). O registro nasce com UUID estável e `active=true`.
  const form = page.getByRole('form', { name: 'Novo campo de saúde' })
  await form.getByLabel('Nome').fill('Peso')
  await form.getByRole('button', { name: 'Criar campo' }).click()

  const list = page.getByRole('main', { name: 'Configurações — Métricas de Saúde' })
  // Escopar o tipo à LINHA do campo (`ancestor::div[1]` = a Box `flex:1` que
  // agrupa nome + tipo). O rótulo "Inteiro" também é o valor exibido pelo
  // <Select> de tipo do form (default `integer`), então um `getByText('Inteiro')`
  // solto colidiria com o combobox — escopar à linha evita a ambiguidade.
  const pesoRow = list.getByText('Peso', { exact: true }).locator('xpath=ancestor::div[1]')
  await expect(pesoRow).toBeVisible(LIST_TIMEOUT)
  await expect(pesoRow.getByText('Inteiro', { exact: true })).toBeVisible()
  // O empty state some assim que existe um campo.
  await expect(page.getByText('Nenhum campo de saúde ainda.')).toHaveCount(0)

  // AC1 — persistência real: recarregar reidrata a lista do backend (o registro
  // e seu UUID sobreviveram ao round-trip), não de cache otimista.
  await page.reload()
  await expect(page.getByRole('main', { name: 'Configurações — Métricas de Saúde' })).toBeVisible()
  await expect(page.getByText('Peso', { exact: true })).toBeVisible(LIST_TIMEOUT)

  // AC4 — `name` é identidade MUTÁVEL (renomear não corrompe o histórico, que é
  // chaveado por UUID). O form de edição expõe só o Nome — NÃO há seletor de
  // tipo na linha (tipo imutável após a criação, garantido pela ausência da
  // afordância na UI + rejeição no backend).
  await page.getByRole('button', { name: 'Editar' }).click()
  await page.getByLabel('Nome de Peso').fill('Peso corporal')
  await page.getByRole('button', { name: 'Salvar' }).click()

  const pesoCorporalRow = page
    .getByText('Peso corporal', { exact: true })
    .locator('xpath=ancestor::div[1]')
  await expect(pesoCorporalRow).toBeVisible(LIST_TIMEOUT)
  // O tipo continua "Inteiro" na linha renomeada — renomear não retipa nada
  // (integridade NFR-4). Escopado à linha para não colidir com o <Select>.
  await expect(pesoCorporalRow.getByText('Inteiro', { exact: true })).toBeVisible()

  // Persistência do rename.
  await page.reload()
  await expect(page.getByText('Peso corporal', { exact: true })).toBeVisible(LIST_TIMEOUT)

  expect(consoleErrors).toEqual([])
})

test('AC3 — campo enum exige opções definidas pelo usuário; tipos não-enum não têm opções', async ({
  page,
}) => {
  test.setTimeout(120_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.goto('/settings/health-metrics')
  await expect(page.getByRole('main', { name: 'Configurações — Métricas de Saúde' })).toBeVisible()

  const form = page.getByRole('form', { name: 'Novo campo de saúde' })

  // Tipo default `integer` → o editor de opções NÃO aparece (opções só se
  // aplicam a enum; para os demais tipos são rejeitadas/ignoradas — AC3).
  await expect(form.getByText('Opções (obrigatório ao menos uma)')).toHaveCount(0)

  // Trocar o tipo para Enum (MUI Select por aria-label "Tipo do campo"; a opção
  // é renderizada num popover fora do form, daí o getByRole no nível da página).
  await form.getByLabel('Tipo do campo').click()
  await page.getByRole('option', { name: 'Enum' }).click()

  // Agora o editor de opções condicional aparece (net-new desta story).
  await expect(form.getByText('Opções (obrigatório ao menos uma)')).toBeVisible()

  // Definir 2 opções (rótulos definidos pelo usuário — AC3).
  await form.getByLabel('Novo campo — opção 1').fill('Bom')
  await form.getByRole('button', { name: 'Adicionar opção' }).click()
  await form.getByLabel('Novo campo — opção 2').fill('Ruim')
  await form.getByLabel('Nome').fill('Humor')
  await form.getByRole('button', { name: 'Criar campo' }).click()

  // A definição (tipo + opções) é a fonte de verdade — a linha mostra o tipo e
  // os rótulos exatamente como definidos.
  await expect(page.getByText('Humor', { exact: true })).toBeVisible(LIST_TIMEOUT)
  await expect(page.getByText('Enum · Bom, Ruim')).toBeVisible()

  // Persistência real das opções (JSONB `enum_options`).
  await page.reload()
  await expect(page.getByText('Humor', { exact: true })).toBeVisible(LIST_TIMEOUT)
  await expect(page.getByText('Enum · Bom, Ruim')).toBeVisible()

  expect(consoleErrors).toEqual([])
})

test('AC2 — desativar não deleta (some da lista ativa, reaparece em "Mostrar inativos") e reativar traz de volta', async ({
  page,
}) => {
  test.setTimeout(120_000)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.goto('/settings/health-metrics')
  await expect(page.getByRole('main', { name: 'Configurações — Métricas de Saúde' })).toBeVisible()

  // Cria um campo ativo.
  const form = page.getByRole('form', { name: 'Novo campo de saúde' })
  await form.getByLabel('Nome').fill('Sono')
  await form.getByRole('button', { name: 'Criar campo' }).click()
  await expect(page.getByText('Sono', { exact: true })).toBeVisible(LIST_TIMEOUT)

  // AC2 — desativar: recebe `active=false`, some da lista ativa (default só
  // ativos), mas NUNCA é deletado.
  await page.getByRole('button', { name: 'Desativar' }).click()
  await expect(page.getByText('Sono', { exact: true })).toHaveCount(0, LIST_TIMEOUT)

  // Ligar "Mostrar inativos" o traz de volta com o rótulo textual "(inativo)"
  // (cor nunca é indicador único — WCAG).
  await page.getByRole('checkbox', { name: 'Mostrar inativos' }).click()
  await expect(page.getByText('Sono (inativo)')).toBeVisible(LIST_TIMEOUT)

  // Prova de não-deleção via persistência: recarregar (o Switch volta a
  // desligado → oculto) e religar "Mostrar inativos" mostra o registro ainda
  // existente e desativado no backend.
  await page.reload()
  await expect(page.getByRole('main', { name: 'Configurações — Métricas de Saúde' })).toBeVisible()
  await expect(page.getByText('Sono', { exact: true })).toHaveCount(0)
  await page.getByRole('checkbox', { name: 'Mostrar inativos' }).click()
  await expect(page.getByText('Sono (inativo)')).toBeVisible(LIST_TIMEOUT)

  // AC2 — reativar (`active=true`) faz o campo reaparecer na lista ativa (sem o
  // sufixo "(inativo)").
  await page.getByRole('button', { name: 'Ativar' }).click()
  await expect(page.getByText('Sono (inativo)')).toHaveCount(0, LIST_TIMEOUT)
  await expect(page.getByText('Sono', { exact: true })).toBeVisible()

  expect(consoleErrors).toEqual([])
})

test('AC3 (regra de negócio, caso de erro) — enum sem opção é rejeitado pelo backend real, mostra erro inline e preserva o input para retry', async ({
  page,
}) => {
  test.setTimeout(120_000)

  await page.goto('/settings/health-metrics')
  await expect(page.getByRole('main', { name: 'Configurações — Métricas de Saúde' })).toBeVisible()

  const form = page.getByRole('form', { name: 'Novo campo de saúde' })

  // Enum com a opção obrigatória deixada em branco: o `handleCreate` limpa
  // strings vazias (`.filter(Boolean)`) → envia `enumOptions: []`. A regra
  // "enum ⇒ ≥1 opção" é validada na camada de serviço/serializer (a definição é
  // a fonte de verdade), então o BACKEND REAL rejeita (4xx) — nada de validação
  // client-side aqui. Prova a AC3 pelo lado negativo, ponta-a-ponta.
  await form.getByLabel('Tipo do campo').click()
  await page.getByRole('option', { name: 'Enum' }).click()
  await form.getByLabel('Nome').fill('Ânimo')
  await form.getByRole('button', { name: 'Criar campo' }).click()

  // Erro de escrita: mensagem inline factual (constante única, voz UX-DR13) e
  // NENHUMA linha "Ânimo" criada (a lista segue vazia — a definição inválida
  // não foi persistida).
  await expect(page.getByText('Não foi possível salvar. Tente novamente.')).toBeVisible(
    LIST_TIMEOUT,
  )
  await expect(page.getByText('Ânimo', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Nenhum campo de saúde ainda.')).toBeVisible()

  // Input preservado (nome + tipo enum seguem no form após o erro): basta
  // preencher a opção e reenviar — o retry agora passa e o campo é criado.
  await form.getByLabel('Novo campo — opção 1').fill('Alto')
  await form.getByRole('button', { name: 'Criar campo' }).click()

  await expect(page.getByText('Ânimo', { exact: true })).toBeVisible(LIST_TIMEOUT)
  await expect(page.getByText('Enum · Alto')).toBeVisible()
  await expect(page.getByText('Nenhum campo de saúde ainda.')).toHaveCount(0)
})
