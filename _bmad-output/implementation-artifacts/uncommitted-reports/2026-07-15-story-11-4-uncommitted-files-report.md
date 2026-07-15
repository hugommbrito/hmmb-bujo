# Explicacao dos arquivos nao commitados - Story 11.4

## Visao geral

O conjunto de mudancas implementa a Story 11.4: recorrentes anuais ativos que ainda nao foram colocados no ano corrente passam a ser consultaveis no Future Log e podem ser colocados dali usando o fluxo ja existente de placement. A mudanca adiciona um filtro backend `unplaced_year`, expande a camada de API/cache do frontend, renderiza a secao "Anuais pendentes de [ano]" no `FuturePage`, revoga a regra antiga de mostrar anuais no `MonthlyPage` em janeiro e acrescenta cobertura backend, componente, hook e E2E.

## Ordem logica de funcionamento

1. Artefatos BMad registram a Story 11.4 como concluida e documentam a cobertura.
2. O backend aceita `unplaced_year` em `GET /api/bujo/recurring-templates/` e exclui templates com instancia no ano.
3. A camada frontend mapeia `unplacedYear` para `unplaced_year` e cria uma query key tipada com esse parametro.
4. `FuturePage` busca templates `annual` ativos e nao colocados no ano corrente.
5. A pagina exibe a secao apenas quando ha pendencias e usa `RecurringPlacementDialog` para colocar um anual.
6. A mutation de placement invalida tambem `futureLog`, para refletir instancias colocadas em meses futuros.
7. `MonthlyPage` deixa de misturar anuais na secao mensal, inclusive em janeiro.
8. Testes unitarios, de componente e E2E validam filtros, parametros, cache, UI, placement com/sem data e ausencia de estado vazio.

## 1. Artefatos de planejamento, execucao e QA

### `_bmad-output/implementation-artifacts/11-4-anuais-pendentes-consultaveis-e-colocaveis-no-future-log.md`

**Funcao geral do arquivo**

Artefato de historia da Story 11.4. E documento de implementacao, nao codigo fonte: registra requisitos, tasks, decisoes, verificacoes, file list, change log e review.

**Funcao geral da alteracao**

Arquivo novo que formaliza o escopo da entrega: filtro `unplaced_year` no backend, secao de anuais pendentes no Future Log, revogacao da regra "annual so em janeiro" no `MonthlyPage`, testes e review.

**Blocos principais**

- Linhas 1-7: metadados e status `done`, com baseline em `f160b0b68cdf5eb4f7da85f8485c80bcc8df7aa3`.
- Linhas 11-39: historia, criterios AC1/AC2/AC3 e nota de escopo que revoga a decisao da Story 4.5.
- Linhas 45-72: tasks de backend, incluindo filtro `unplaced_year`, semantica de "colocado no ano" e cenarios de teste.
- Linhas 74-106: tasks de frontend, incluindo `unplacedYear`, secao do `FuturePage`, dialog de placement e mudanca do `MonthlyPage`.
- Linhas 108-139: verificacao final, contrato sem diff, Playwright manual e resultados declarados.
- Linhas 233-239: completion notes com o achado real de invalidadacao de `futureLog`.
- Linhas 241-252: file list final, incluindo o spec E2E permanente.
- Linhas 261-287: review senior, achado MEDIUM corrigido no teste E2E e riscos residuais.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos executaveis. O arquivo referencia `RecurringTaskTemplateListView`, `useRecurringTemplatesQuery`, `usePlaceRecurringTemplateMutation`, `RecurringPlacementDialog`, `FuturePage` e `MonthlyPage` como contrato narrativo da implementacao.

**Comportamento de libs usadas**

- Nao usa bibliotecas em runtime. As referencias a pytest, Vitest, TanStack Query e Playwright explicam ferramentas de validacao: pytest executa testes Django com banco, Vitest testa hooks/componentes, TanStack Query gerencia cache no frontend, Playwright automatiza browser contra stack real.

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Funcao geral do arquivo**

Artefato de status do sprint/epico usado pelo workflow BMad.

**Funcao geral da alteracao**

Atualiza a Story 11.4 de `backlog` para `done` e marca `last_updated` em 2026-07-15.

**Blocos principais**

- Linha 38: `last_updated` passa a apontar a conclusao da Story 11.4 por `story-automator-review`.
- Linhas 80-88: no bloco do Epic 11, `11-4-anuais-pendentes-consultaveis-e-colocaveis-no-future-log` fica `done`; 11.5 e 11.6 continuam em `backlog`.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos executaveis. A chave `development_status` e consumida por processos BMad para orientar proximas historias.

**Comportamento de libs usadas**

- YAML e formato declarativo. O parser espera pares chave/valor e listas indentadas; nao ha efeito na aplicacao Django/React.

### `_bmad-output/story-automator/orchestration-11-20260714-185946.md`

**Funcao geral do arquivo**

Estado da orquestracao automatizada do Epic 11.

**Funcao geral da alteracao**

Move a orquestracao para a Story 11.4 e registra que create-story, dev-story, automate e code-review foram concluidos, faltando commit.

**Blocos principais**

- Linhas 3-11: `currentStory` vira `11.4` e `lastUpdated` vira `2026-07-15T03:18:46Z`.
- Linhas 53-62: tabela de progresso mostra a Story 11.4 com etapas `done`, `git-commit` como `-` e status `in-progress`.
- Linhas 110-115: log historico da Story 11.4, incluindo dev-story, automacao E2E e code review aprovado.

**Funcoes, classes e importacoes especificas**

- Nao ha codigo. As chaves `currentStory`, `currentStep`, `stepsCompleted` e `lastUpdated` sao dados de controle do automator.

**Comportamento de libs usadas**

- Markdown com front matter manual. E lido por ferramentas ou humanos; nao participa do runtime.

### `_bmad-output/implementation-artifacts/tests/test-summary.md`

**Funcao geral do arquivo**

Historico acumulado de resultados e lacunas de testes.

**Funcao geral da alteracao**

Adiciona uma secao de QA para a Story 11.4, destacando a lacuna de E2E permanente e o novo spec que a fecha.

**Blocos principais**

- Linhas 1368-1385: escopo da Story 11.4 e justificativa para teste E2E permanente.
- Linhas 1387-1411: gaps fechados em AC1, AC2, invalidadacao de `futureLog` e placement sem data.
- Linhas 1413-1425: resumo do novo `frontend/e2e/future-log-annual.spec.ts`.
- Linhas 1427-1433: matriz de cobertura por AC.
- Linhas 1435-1453: comandos executados e resultado declarado: typecheck, eslint e 4 testes Playwright passando.
- Linhas 1455-1472: checklist de validacao e proximo passo AR-22, sem novo debito da story.

**Funcoes, classes e importacoes especificas**

- Nao ha codigo executavel. O arquivo referencia `future-log-annual.spec.ts`, `FuturePage.tsx`, `api.test.tsx` e `usePlaceRecurringTemplateMutation` como evidencias.

**Comportamento de libs usadas**

- pytest-django, Vitest, Testing Library, jest-axe e Playwright aparecem como ferramentas: pytest-django integra testes ao banco Django, Testing Library consulta UI como usuario, jest-axe verifica regras de acessibilidade, Playwright executa fluxos reais em navegador.

## 2. Backend: filtro de templates anuais nao colocados

### `backend/bujo/views.py`

**Funcao geral do arquivo**

Define views DRF do modulo BuJo, expondo endpoints para logs, tasks e templates recorrentes.

**Funcao geral da alteracao**

Adiciona o filtro opcional `unplaced_year` ao `RecurringTaskTemplateListView.get`, mantendo o endpoint existente e sem criar contrato OpenAPI novo.

**Blocos principais**

- Linhas 156-175: `RecurringTaskTemplateListView.get` monta a queryset base, aplica `active`, `recurrence_group` e agora `unplaced_year`, retornando `RecurringTaskTemplateSerializer(..., many=True).data`.
- Linhas 166-174: novo bloco le `request.query_params["unplaced_year"]`, converte para inteiro, retorna erro de validacao quando invalido e aplica `.exclude(instances__monthly_log__month_first__year=unplaced_year)`.

**Funcoes, classes e importacoes especificas**

- `RecurringTaskTemplateListView`: `APIView` que responde listagem e criacao de templates recorrentes.
- `request.query_params.get`: API DRF para ler query string normalizada.
- `serializers.ValidationError`: excecao DRF que vira resposta 400 com detalhes de campos.
- `RecurringTaskTemplate.objects.all()`: manager tenant-scoped do modelo, usado como base antes dos filtros.
- `templates.exclude(instances__monthly_log__month_first__year=unplaced_year)`: join reverso pelo `related_name="instances"` de `Task.source_template`; remove templates que ja possuem qualquer task no `monthly_log` daquele ano.
- `RecurringTaskTemplateSerializer`: serializer de resposta usado para converter modelos em JSON.

**Comportamento de libs usadas**

- Django ORM `filter`/`exclude`: recebe lookups por campo ou relacao (`a__b__c`) e retorna nova `QuerySet` lazy; a query so roda na serializacao.
- DRF `APIView`: chama o metodo HTTP (`get`) conforme a requisicao e transforma `Response`/excecoes em respostas HTTP.
- DRF `Response`: recebe dados serializados e produz resposta negociada em JSON.

### `backend/bujo/tests/test_views.py`

**Funcao geral do arquivo**

Suite pytest-django para views BuJo.

**Funcao geral da alteracao**

Importa `place_template` e adiciona sete testes para o filtro `unplaced_year`, cobrindo presenca no ano, ausencia, outro ano, task cancelada, erro 400, isolamento tenant e combinacao com filtros existentes.

**Blocos principais**

- Linha 15: importa `place_template` para criar instancia recorrente diretamente no teste de isolamento.
- Linhas 1436-1460: garante que template anual colocado em 2026 nao volta em `?recurrence_group=annual&unplaced_year=2026`.
- Linhas 1462-1478: garante que template anual sem instancia aparece como pendente.
- Linhas 1481-1504: garante que instancia em 2025 nao bloqueia pendencia de 2026.
- Linhas 1507-1533: coloca template em 2026, cancela a task com `transition_task` e confirma que a presenca ainda conta como colocado.
- Linhas 1536-1541: `unplaced_year=abc` retorna 400 e campo `unplaced_year` no envelope de erro.
- Linhas 1544-1569: cria templates em dois tenants e confirma que instancia do outro usuario nao remove o template do usuario autenticado.
- Linhas 1572-1620: consulta realista combinando `active=true`, `recurrence_group=annual` e `unplaced_year=2026`; apenas o anual ativo pendente retorna.

**Funcoes, classes e importacoes especificas**

- `tenant_context`: ativa contexto multi-tenant para criacao/leitura segura nos testes.
- `RecurringTaskTemplateFactory`: factory de modelos para templates recorrentes.
- `RecurringTaskTemplate.RecurrenceGroup.ANNUAL/MONTHLY/WEEKLY`: enum de grupos de recorrencia.
- `auth_client.get/post`: cliente DRF autenticado que exercita endpoints reais.
- `place_template`: servico de dominio que materializa uma instancia de template recorrente em weekly/monthly log.
- `transition_task`: muda status da task via maquina de estados.
- `Task.Status.CANCELLED`: status usado para provar que cancelada ainda conta como presenca.

**Comportamento de libs usadas**

- `pytest.mark.django_db`: permite acesso ao banco nos testes.
- DRF `APIClient`: envia requisicoes HTTP simuladas e retorna objeto com `status_code` e `data`.
- Factory Boy ou factories locais: criam objetos de teste com defaults consistentes.
- Django tenant context local: delimita queries por usuario; esperado para evitar vazamento cross-tenant.

## 3. Frontend: chaves de cache e hooks de API

### `frontend/src/api/keys.ts`

**Funcao geral do arquivo**

Centraliza chaves de cache do TanStack Query.

**Funcao geral da alteracao**

Expande o tipo de parametros aceitos por `keys.bujo.recurringTemplates` para incluir `unplacedYear?: number`.

**Blocos principais**

- Linhas 13-30: namespace `bujo` com chaves de logs, filas e templates.
- Linhas 22-26: `recurringTemplates` agora aceita `{ active, recurrenceGroup, unplacedYear }` e continua retornando `['bujo', 'recurringTemplates', 'list', params ?? {}]`.

**Funcoes, classes e importacoes especificas**

- `keys.bujo.recurringTemplates`: factory de query key usada por `useRecurringTemplatesQuery` e invalidacoes.
- `as const`: preserva tipos literais da tupla, melhorando inferencia do TanStack Query.

**Comportamento de libs usadas**

- TanStack Query usa igualdade estrutural de query keys e invalidacao por prefixo. A chave `keys.bujo.recurringTemplates()` com `{}` permite invalidar as listas de templates por prefixo, incluindo variantes parametrizadas quando usada como query key parcial.

### `frontend/src/features/bujo/api.ts`

**Funcao geral do arquivo**

Camada de dados do BuJo no frontend: fetchers, hooks de query e mutations para logs, tasks e templates recorrentes.

**Funcao geral da alteracao**

Adiciona `unplacedYear` aos parametros de templates recorrentes, mapeia para `unplaced_year` no fio HTTP e invalida `futureLog` apos placement.

**Blocos principais**

- Linhas 331-335: `RecurringTemplatesParams` inclui `unplacedYear?: number`.
- Linhas 337-351: `fetchRecurringTemplates` chama `client.get('/api/bujo/recurring-templates/', { params })` e converte camelCase frontend para snake_case backend.
- Linhas 354-358: `useRecurringTemplatesQuery` usa a key tipada e o fetcher.
- Linhas 419-428: `placeRecurringTemplate` posta em `/api/bujo/recurring-templates/{templateId}/place/`.
- Linhas 430-450: `usePlaceRecurringTemplateMutation` invalida listas de templates, weekly/monthly logs, agora `futureLog`, e densidade.

**Funcoes, classes e importacoes especificas**

- `RecurringTemplatesParams`: contrato TypeScript local para filtros de listagem.
- `fetchRecurringTemplates`: fetcher que retorna `Promise<RecurringTaskTemplate[]>`.
- `useRecurringTemplatesQuery`: hook TanStack Query consumido por telas como `FuturePage`.
- `PlaceRecurringTemplateVariables`: payload de placement com `templateId`, `weekStart`, `monthFirst` e `scheduledDate`.
- `usePlaceRecurringTemplateMutation`: mutation compartilhada por Weekly/Monthly/Future placement.
- `keys.bujo.futureLog()`: key adicionada a invalidacao para atualizar grupos futuros apos placement anual com data futura.

**Comportamento de libs usadas**

- Axios `client.get/post`: recebe URL e config/payload; `get` envia `params` como query string, `post` envia JSON no corpo.
- TanStack Query `useQuery`: espera `queryKey` e `queryFn`; entrega estado (`isPending`, `data`, `isSuccess`) e cache.
- TanStack Query `useMutation`: espera `mutationFn` e callbacks; `onSuccess` e executado apos resposta bem-sucedida.
- `queryClient.invalidateQueries`: marca queries correspondentes como stale e dispara refetch quando observadas.

## 4. Frontend: experiencia do Planner

### `frontend/src/pages/planner/FuturePage.tsx`

**Funcao geral do arquivo**

Pagina do Future Log: mostra grupos de tarefas futuras, permite adicionar item mensal futuro e agora lista anuais pendentes.

**Funcao geral da alteracao**

Adiciona busca de anuais pendentes do ano corrente, renderiza secao condicional "Anuais pendentes de [ano]" e reaproveita `RecurringPlacementDialog` para colocar templates anuais.

**Blocos principais**

- Linhas 1-13: novos imports de `useState`, `Button`, hooks de recorrencia, tipo `RecurringTaskTemplate` e `RecurringPlacementDialog`.
- Linhas 49-62: helpers `currentYear` e `currentMonthFirst`; calculam datas client-side para rotulo/filtro e fallback de placement sem data.
- Linhas 74-86: `FuturePage` busca `futureLog`, cria mutation de tarefa mensal, calcula `year`, consulta templates `{ active: true, recurrenceGroup: 'annual', unplacedYear: year }`, cria mutation de placement e estado `placingAnnualTemplate`.
- Linhas 98-106: `handleConfirmAnnualPlacement` transforma data preenchida em `monthFirst` do mes escolhido; sem data usa mes corrente; chama `placeTemplate.mutate` e fecha o dialog.
- Linhas 108-137: `pendingAnnualSection` so existe quando a query nao esta pendente e ha dados; renderiza heading, titulo de cada template e botao "Definir placement".
- Linhas 139-165: render existente do Future Log e inclusao da secao no fim da pagina.
- Linhas 166-173: `RecurringPlacementDialog` aberto quando ha template em placement, com `dateFieldType="date"`, `monthFirst` inicial corrente, `onClose` e `onConfirm`.

**Funcoes, classes e importacoes especificas**

- `useState<RecurringTaskTemplate | null>`: guarda qual template esta sendo colocado.
- `useFutureLogQuery`: traz grupos futuros existentes.
- `useRecurringTemplatesQuery`: busca anuais pendentes via filtro novo.
- `usePlaceRecurringTemplateMutation`: posta placement e invalida caches.
- `RecurringPlacementDialog`: componente existente que inclui fluxo de densidade/calendario e confirmacao.
- `Button` e `Box`/`Typography` do MUI: compoem layout e acao da secao.

**Comportamento de libs usadas**

- React `useState`: retorna valor e setter; alteracoes disparam render.
- MUI `Box`: componente utilitario que aceita `sx` para CSS-in-JS.
- MUI `Button`: renderiza botao acessivel com variantes e handler de clique.
- MUI `Typography`: aplica variantes tipograficas do tema.
- TanStack Query hooks: entregam dados assincronos e estado pendente; a UI evita estado vazio ruidoso enquanto `pendingAnnualTemplates.isPending`.

### `frontend/src/pages/planner/MonthlyPage.tsx`

**Funcao geral do arquivo**

Pagina mensal do Planner: mostra tarefas do mes, itens sem data, recurring placement mensal e acoes de revisao.

**Funcao geral da alteracao**

Remove a excecao antiga que adicionava templates `annual` quando o mes corrente era janeiro. A secao mensal volta a consultar apenas `monthly` no mes corrente.

**Blocos principais**

- Linhas 72-80: apos calcular `monthFirst`, `tasks`, `closed` e `isCurrentMonth`, `recurrenceGroups` passa a ser `['monthly']` apenas quando o mes exibido e o mes corrente; caso contrario, `[]`.
- Linhas 81-87: dedup e titulo de sem-data permanecem intactos.

**Funcoes, classes e importacoes especificas**

- `RecurrenceGroup[]`: tipo da lista passada para a secao de placement recorrente.
- `currentMonthFirst()`: helper local existente para determinar mes atual.
- `placedTemplateIds`: conjunto deduplicador que segue funcionando para templates mensais.

**Comportamento de libs usadas**

- JavaScript `Set`: elimina duplicatas de ids para dedup por `sourceTemplate`.
- React render condicional posterior usa `recurrenceGroups` para decidir quais grupos a `RecurringPlacementSection` consulta.

## 5. Testes de frontend e E2E

### `frontend/src/features/bujo/api.test.tsx`

**Funcao geral do arquivo**

Testes de hooks/fetchers da camada API BuJo com TanStack Query e cliente HTTP mockado.

**Funcao geral da alteracao**

Adiciona cobertura para `unplacedYear` como query param snake_case, para invalidacao de `futureLog` e para invalidacao por prefixo da query parametrizada de anuais pendentes.

**Blocos principais**

- Linhas 692-737: `useRecurringTemplatesQuery`; novo teste nas linhas 723-736 confirma `params: { active: true, recurrence_group: 'annual', unplaced_year: 2026 }`.
- Linhas 789-815: teste de `usePlaceRecurringTemplateMutation` agora espera invalidacao de `keys.bujo.futureLog()`.
- Linhas 817-835: cria cache com key parametrizada por `unplacedYear`, executa mutation e confirma `isInvalidated === true`.

**Funcoes, classes e importacoes especificas**

- `renderHook`: monta hook isoladamente para teste.
- `makeWrapper`: fornece `QueryClientProvider` ao hook.
- `mockGet`/`mockPost`: mocks do cliente HTTP.
- `keys.bujo.recurringTemplates` e `keys.bujo.futureLog`: chaves verificadas nas chamadas de invalidacao.
- `qc.setQueryData` e `qc.getQueryState`: APIs do QueryClient para manipular/inspecionar cache.

**Comportamento de libs usadas**

- Vitest `vi`: cria mocks, spies e reset de estado.
- Testing Library `waitFor`: repete a assercao ate passar ou timeout, adequado para updates assincronos de hooks.
- TanStack Query `QueryClient`: cache isolado por teste; `isInvalidated` indica que a query foi marcada stale.

### `frontend/src/pages/planner/FuturePage.test.tsx`

**Funcao geral do arquivo**

Testes de componente do `FuturePage`.

**Funcao geral da alteracao**

Reestrutura o teste para usar `QueryClientProvider` real e cliente mockado, mantendo hooks reais de recurring placement. Acrescenta testes para secao de anuais pendentes, parametros de API, dialog, placement com/sem data e acessibilidade.

**Blocos principais**

- Linhas 1-7: novos imports de `afterEach`, `waitFor` e `QueryClientProvider`.
- Linhas 11-27: mock parcial de `../../features/bujo` com `importOriginal`, preservando hooks reais nao sobrescritos, e mock do `client`.
- Linhas 36-47: `renderFuturePage` envolve a pagina em `QueryClientProvider` e `ThemeProvider`.
- Linhas 76-97: data fixa, template anual fake e roteador de GET para `/api/bujo/recurring-templates/`.
- Linhas 99-171: testes existentes continuam cobrindo skeleton, vazio, agrupamento, prefixos, formulario e a11y, com `mockGet` vazio por padrao.
- Linhas 173-198: secao aparece com heading 2026 e chamada HTTP inclui `unplaced_year`.
- Linhas 200-209: lista vazia nao renderiza heading nem DOM.
- Linhas 211-221: botao abre `RecurringPlacementDialog` real com informacoes do template.
- Linhas 223-245: confirmar com data `2026-11-20` posta `monthFirst: '2026-11-01'` e `scheduledDate`.
- Linhas 247-266: confirmar sem data posta `monthFirst: '2026-07-01'` e `scheduledDate: undefined`.
- Linhas 268-278: `jest-axe` roda com a secao renderizada.

**Funcoes, classes e importacoes especificas**

- `vi.setSystemTime`: fixa relogio em 2026-07-15 para deterministicidade.
- `routeRecurringTemplatesGet`: direciona mocks por URL para simular lista de anuais.
- `ANNUAL_TEMPLATE`: fixture de template annual.
- `mockUseFutureLogQuery`: mantem controle sobre dados do Future Log enquanto hooks reais de recorrentes rodam.
- `axe`: verifica violações de acessibilidade no DOM renderizado.

**Comportamento de libs usadas**

- React Testing Library `render/screen/fireEvent`: renderiza componente, consulta por texto/role/label e dispara eventos de usuario.
- TanStack Query `QueryClientProvider`: necessario para hooks reais de query/mutation funcionarem.
- MUI `ThemeProvider`: aplica tema usado pelos componentes.
- jest-axe `axe`: recebe container DOM e retorna violacoes WCAG detectaveis estaticamente.

### `frontend/src/pages/planner/MonthlyPage.test.tsx`

**Funcao geral do arquivo**

Testes de componente da pagina mensal e sua integracao com `RecurringPlacementSection`.

**Funcao geral da alteracao**

Atualiza o teste de janeiro para refletir a nova regra: mesmo em janeiro, a secao mensal deve mostrar apenas templates mensais, nao anuais.

**Blocos principais**

- Linhas 328-341: nome do teste passa a declarar "annual revogado - Story 11.4"; a assercao troca `findByText(/Revisão anual/)` por `queryByText(...).not.toBeInTheDocument()`.

**Funcoes, classes e importacoes especificas**

- `routeRecurringTemplatesGet([MONTHLY_TEMPLATE, ANNUAL_TEMPLATE])`: simula resposta com ambos os grupos, provando que a UI filtra pelo grupo pedido.
- `vi.setSystemTime(new Date('2026-01-15T12:00:00'))`: fixa janeiro como mes corrente.
- `mockUseMonthlyLogQuery`: fornece `monthFirst: '2026-01-01'` para a pagina.

**Comportamento de libs usadas**

- Testing Library `queryByText`: retorna `null` quando nao encontra o texto, ideal para assercoes de ausencia.
- Vitest fake timers: controlam `new Date()` para que a comparacao de mes corrente seja deterministica.

### `frontend/e2e/future-log-annual.spec.ts`

**Funcao geral do arquivo**

Spec Playwright E2E novo que cobre a Story 11.4 contra frontend e backend reais.

**Funcao geral da alteracao**

Arquivo novo. Cria templates anuais pelo fluxo real, confirma que aparecem no Future Log como pendentes, coloca um com data futura e outro sem data, e valida que a secao some sem estado vazio.

**Blocos principais**

- Linhas 1-7: imports e comentario de escopo AC1/AC2/AC3.
- Linhas 9-22: nomes de meses usados para montar o heading do grupo futuro esperado.
- Linhas 24-37: teste unico, timeout de 120s, captura de console errors e ano corrente.
- Linhas 38-43: calcula data aproximadamente dois meses no futuro e heading esperado.
- Linhas 44-48: estado inicial sem templates; Future Log nao mostra a secao.
- Linhas 49-64: cria dois templates `annual` pela pagina Recorrentes.
- Linhas 65-78: volta ao Future Log, escopa container da secao e verifica ambos os templates pendentes.
- Linhas 80-103: abre dialog do primeiro anual, confirma `RecurringPlacementDialog`, espera densidade e posta placement com data futura.
- Linhas 105-119: verifica que o primeiro item sumiu apenas da secao, que o segundo continua e que a task aparece no grupo futuro.
- Linhas 121-145: coloca o segundo anual sem data e confirma que ele aparece em "Este Mes".
- Linhas 136-147: confirma que a secao desaparece por completo e que nao houve erro de console/page.

**Funcoes, classes e importacoes especificas**

- `test`/`expect` de `./fixtures`: fixture E2E local, provavelmente cria usuario/sessao real conforme padrao do projeto.
- `page.getByRole`, `getByLabel`, `getByText`, `getByTestId`: locators acessiveis/semanticos.
- `page.waitForResponse`: sincroniza com round-trips reais `/task-density/` e `/place/`.
- `locator('xpath=..')` e `ancestor::div[1]`: escopam assercoes ao container correto para evitar conflito com mesmo titulo em outro ponto da pagina.

**Comportamento de libs usadas**

- Playwright `page`: controla navegador real, clica, preenche campos, observa rede e DOM.
- Playwright `expect(locator).toBeVisible/toHaveCount/toHaveValue`: espera automaticamente ate timeout, reduzindo sleeps manuais.
- Eventos `console` e `pageerror`: capturam erros do browser para falhar o teste se a UI logar erro.

## 6. Encadeamento entre arquivos

- `backend/bujo/views.py` produz o filtro `unplaced_year` em `/api/bujo/recurring-templates/`.
- `frontend/src/features/bujo/api.ts` consome esse filtro via `unplacedYear` e envia `unplaced_year` ao backend.
- `frontend/src/api/keys.ts` representa o mesmo parametro na query key, permitindo cache separado para "anuais pendentes de 2026".
- `frontend/src/pages/planner/FuturePage.tsx` usa o hook parametrizado para renderizar a secao e chama a mutation de placement.
- A mesma mutation em `api.ts` invalida `recurringTemplates` e `futureLog`; isso faz o template sumir da secao e a instancia aparecer no grupo futuro sem refresh manual.
- `frontend/src/pages/planner/MonthlyPage.tsx` remove anuais do fluxo mensal para evitar duas superficies concorrentes para a mesma pendencia anual.
- Os testes em `backend/bujo/tests/test_views.py`, `api.test.tsx`, `FuturePage.test.tsx`, `MonthlyPage.test.tsx` e `future-log-annual.spec.ts` validam cada elo do fluxo em ordem crescente de integracao.

## 7. Tipo de cada arquivo

- `_bmad-output/implementation-artifacts/11-4-anuais-pendentes-consultaveis-e-colocaveis-no-future-log.md`: artefato de implementacao.
- `_bmad-output/implementation-artifacts/sprint-status.yaml`: artefato de status/configuracao BMad.
- `_bmad-output/story-automator/orchestration-11-20260714-185946.md`: artefato de orquestracao.
- `_bmad-output/implementation-artifacts/tests/test-summary.md`: artefato de QA.
- `backend/bujo/views.py`: codigo fonte backend.
- `backend/bujo/tests/test_views.py`: teste backend.
- `frontend/src/api/keys.ts`: codigo fonte frontend, infraestrutura de cache.
- `frontend/src/features/bujo/api.ts`: codigo fonte frontend, camada de dados.
- `frontend/src/features/bujo/api.test.tsx`: teste frontend de hooks/API.
- `frontend/src/pages/planner/FuturePage.tsx`: codigo fonte frontend, pagina/UI.
- `frontend/src/pages/planner/FuturePage.test.tsx`: teste frontend de componente.
- `frontend/src/pages/planner/MonthlyPage.tsx`: codigo fonte frontend, pagina/UI.
- `frontend/src/pages/planner/MonthlyPage.test.tsx`: teste frontend de componente.
- `frontend/e2e/future-log-annual.spec.ts`: teste E2E.
