# Explicacao dos arquivos nao commitados - Story 11.2 Recorrentes no Planner

## Visao geral

O conjunto de mudancas conclui a Story 11.2: o CRUD de templates recorrentes sai de Configuracoes e passa para o Planner em `/planner/recurring`. A tela de recorrentes agora segmenta templates em abas por grupo (`weekly`, `monthly`, `annual`), filtra inativos no cliente por padrao, e deixa o formulario de criacao seguir a aba ativa. Configuracoes volta a ser uma pagina placeholder.

As mudancas tambem atualizam artefatos BMad de status, planejamento e testes: a Story 11.2 passa para `done`, a orquestracao registra dev/automate/review, a estrategia de deploy fica explicitada como Railway, e a observabilidade/logging e deferida para o gate multiusuario do Epic 10.0. Nao ha mudancas em backend, schema, migrations, OpenAPI ou tipos gerados.

## Ordem logica de funcionamento

1. Artefatos BMad documentam a decisao: mover recorrentes para Planner, manter filtragem client-side e nao alterar backend.
2. Planejamento e arquitetura registram Railway como alvo de deploy e deslocam observabilidade/logging para Epic 10.0.
3. O roteador registra `/planner/recurring` e reverte `/settings` para placeholder.
4. A Sidebar expõe o novo item "Recorrentes" dentro do grupo Planner.
5. `RecurringPage` monta a pagina com `<main aria-label="Recorrentes">` e compoe `RecurringTemplateManager`.
6. `RecurringTemplateManager` busca todos os templates, filtra localmente por aba/ativo, cria usando o grupo da aba e preserva edicao/toggle inline.
7. Testes unitarios/componentes e E2E validam navegacao, composicao, filtros, criacao por grupo, acessibilidade e regressao de placement.

## 1. Artefatos de story, status e orquestracao

### `_bmad-output/implementation-artifacts/11-2-recorrentes-no-planner-com-abas-e-filtro.md`

**Funcao geral do arquivo**

Artefato de story BMad da Story 11.2. Define objetivo, acceptance criteria, tarefas, notas tecnicas, registros de execucao, completion notes e lista de arquivos.

**Funcao geral da alteracao**

A story foi marcada como `done`, todas as tarefas/subtarefas foram marcadas como concluidas, e foram adicionados registros de debug, notas de conclusao, verificacao e file list real. O arquivo passa de especificacao pronta para desenvolvimento para registro de execucao final.

**Blocos principais**

- Linhas 5-31: definem a story e ACs. AC1 move gestao de recorrentes para Planner; AC2 organiza templates por abas e filtro de ativos.
- Linhas 35-37: preservam a decisao de arquitetura da story: frontend-only, sem backend/schema/contrato, com um unico `useRecurringTemplatesQuery()` e filtragem client-side.
- Linhas 39-76: checklist de tasks concluido. Registra abas/filtro, `RecurringPage`, rota, Sidebar, remocao de `SettingsPage`, testes e verificacoes.
- Linhas 80-116: notas de desenvolvimento. Explicam que a story e movimentacao/apresentacao, que `RecurringPlacementSection` nao muda e que `Tabs` do MUI deve receber `aria-label`.
- Linhas 160-169: completion notes. Resume AC1/AC2, testes, typecheck/lint/build/test, E2E real e ausencia de backend tocado.
- Linhas 170-180: file list de implementacao, incluindo novos arquivos, modificados e deletados.

**Funcoes, classes e importacoes especificas**

- Nao contem codigo executavel. Os simbolos citados (`RecurringTemplateManager`, `RecurringPage`, `useRecurringTemplatesQuery`, `keys.bujo.recurringTemplates`) sao contratos documentais consumidos pelos arquivos fonte abaixo.

**Comportamento de libs usadas**

- Nao usa libs em runtime. Documenta comportamento esperado de MUI `Tabs`/`Tab`, TanStack Query via hook existente e `jest-axe` como gate de acessibilidade.

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Funcao geral do arquivo**

Rastreador YAML de status de epics/stories BMad.

**Funcao geral da alteracao**

Atualiza a Story 11.2 para `done` dentro do Epic 11 e ajusta `last_updated` para 2026-07-14.

**Blocos principais**

- Linhas 37-43: metadata do tracking; `last_updated` aponta para Story 11.2.
- Linhas 80-88: Epic 11. Story 11.1 e 11.2 estao `done`; 11.3-11.6 seguem em backlog.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos de codigo; e arquivo de dados.

**Comportamento de libs usadas**

- YAML espera pares chave/valor e estrutura indentada. Ferramentas BMad usam esses slugs para saber o status de cada story.

### `_bmad-output/story-automator/orchestration-11-20260714-185946.md`

**Funcao geral do arquivo**

Estado persistente da orquestracao automatizada do Epic 11.

**Funcao geral da alteracao**

Avanca a orquestracao da Story 11.1 para a Story 11.2, registra commit da 11.1, dev-story/automate/code-review da 11.2 e deixa a 11.2 em andamento ate o commit.

**Blocos principais**

- Linhas 3-11: frontmatter de estado. `currentStory` vira `11.2`, `lastUpdated` vira `2026-07-15T00:03:46Z`.
- Linhas 53-62: tabela de progresso. 11.1 esta totalmente done; 11.2 esta done em create/dev/automate/review, mas sem commit.
- Linhas 89-101: log cronologico. Registra commit `cfdc1ae9` da 11.1 e os resultados da 11.2: vitest 385, E2E 2/2, automate +7 testes, code-review aprovado.

**Funcoes, classes e importacoes especificas**

- Nao ha codigo executavel. O arquivo alimenta a continuidade do story automator.

**Comportamento de libs usadas**

- Markdown com frontmatter YAML. O bloco superior e legivel por automacao; o restante e registro humano.

### `_bmad-output/implementation-artifacts/tests/test-summary.md`

**Funcao geral do arquivo**

Historico cumulativo de resumos de automacao de testes por story.

**Funcao geral da alteracao**

Adiciona a secao da Story 11.2, documentando lacunas cobertas no componente de recorrentes e resultados de teste.

**Blocos principais**

- Linhas 1186-1197: escopo da Story 11.2 e contexto: CRUD move para `/planner/recurring`, abas e filtro.
- Linhas 1199-1210: lacunas preenchidas no `RecurringTemplateManager.test.tsx`: annual, payload com descricao/eisenhower, guardas de validacao, reset do form, loading e save vazio.
- Linhas 1211-1217: matriz AC -> camada de teste.
- Linhas 1218-1225: contagem por arquivo: manager 17 testes, page 4, sidebar 11, E2E 2.
- Linhas 1227-1242: resultado: typecheck/lint ok, vitest 392/42; E2E nao reexecutado nessa etapa porque ja havia passado na dev-story.
- Linhas 1244-1255: checklist de validacao.

**Funcoes, classes e importacoes especificas**

- Nao ha codigo executavel. Referencia testes e comandos.

**Comportamento de libs usadas**

- `vitest run --no-file-parallelism`: executa testes Vitest sem paralelismo por arquivo para reduzir flakiness ambiental.
- `jest-axe`: valida regras de acessibilidade contra DOM renderizado.
- Playwright: citado como camada E2E contra backend real.

## 2. Planejamento e arquitetura

### `_bmad-output/planning-artifacts/architecture.md`

**Funcao geral do arquivo**

Documento de arquitetura do projeto: stack, decisoes, fluxos, gaps e prontidao.

**Funcao geral da alteracao**

Define Railway como alvo de deploy, ajusta NFR-6 para depender de monitoramento externo e explicita que observabilidade/logging ficam como gate antes de multiusuario, nao como bloqueio do MVP solo.

**Blocos principais**

- Linha 85: tabela de stack muda deploy para Railway.
- Linhas 1142 e 1150: fluxos externos e deploy passam a citar Neon + Railway.
- Linha 1187: NFR-6 continua parcial, agora por falta de monitoramento/canal de alerta, nao por falta de alvo.
- Linhas 1200-1214: I-1/I-2 e decisao deferida AR-21/AR-22: JSON logs, Sentry, Better Stack, `/health/`, dados proibidos e fora de escopo inicial.
- Linha 1255: areas futuras passam a apontar observabilidade minima antes de multiusuario.

**Funcoes, classes e importacoes especificas**

- Nao ha codigo executavel. Produz requisitos futuros consumidos por epics/stories.

**Comportamento de libs usadas**

- `python-json-logger`/`structlog`, `sentry-sdk[django]` e Better Stack sao citados como opcoes/decisoes futuras. O documento nao instala nem invoca essas libs.

### `_bmad-output/planning-artifacts/epics.md`

**Funcao geral do arquivo**

Documento mestre de epics, requisitos e stories.

**Funcao geral da alteracao**

Move AR-21/AR-22 para o gate multiusuario do Epic 10 e cria a Story 10.0 de observabilidade minima antes de usuarios convidados.

**Blocos principais**

- Linhas 141-142: AR-21 e AR-22 deixam de bloquear o MVP solo e viram pre-requisitos do Epic 10.
- Linhas 219 e 236: NFR-6 e AR-21/AR-22 apontam para Epic 10.0.
- Linha 309: descricao do Epic 10 passa a incluir observabilidade minima antes de convidados.
- Linhas 1254-1298: nova Story 10.0 com ACs para logs JSON, politica de dados proibidos, Sentry, `/health/`, Better Stack e documentacao operacional.

**Funcoes, classes e importacoes especificas**

- Nao ha codigo executavel. A Story 10.0 criada aqui sera consumida futuramente por create/dev-story.

**Comportamento de libs usadas**

- Cita Sentry e Better Stack como ferramentas futuras. Nao altera dependencias.

## 3. Roteamento e navegacao

### `frontend/src/app/router.tsx`

**Funcao geral do arquivo**

Define as rotas React Router da SPA, incluindo rotas publicas, layout protegido e children autenticados.

**Funcao geral da alteracao**

Troca a importacao de `SettingsPage` por `RecurringPage`, adiciona a rota protegida `planner/recurring` e reverte `settings` para `PlaceholderPage`.

**Blocos principais**

- Linhas 1-14: imports. `RecurringPage` passa a ser importada de `../pages/planner/RecurringPage`; `SettingsPage` deixa de existir.
- Linhas 16-36: wrappers de login/signup permanecem inalterados.
- Linhas 48-82: lista de rotas protegidas. `planner/recurring` entra apos `planner/future`, com `handle.title = 'Recorrentes'`.
- Linhas 115-119: `settings` volta a `PlaceholderPage title="Configuracoes"`.

**Funcoes, classes e importacoes especificas**

- `createBrowserRouter`: recebe `routeDefinitions` e cria o roteador do browser.
- `Navigate`: redireciona usuarios autenticados ou nao autenticados conforme contexto.
- `useNavigate`: fornece callback imperativo usado em login/signup.
- `useAuth`: hook local que expõe `isAuthenticated`.
- `RouteObject`: tipo do React Router para validar a estrutura das rotas.

**Comportamento de libs usadas**

- `react-router-dom` espera objetos com `path`, `element` e `children`; children em `/` sao renderizados dentro de `AppLayout`.
- `handle` e metadata livre do React Router; o app pode usar `handle.title` para titulo/anunciador de rota.

### `frontend/src/app/layout/Sidebar.tsx`

**Funcao geral do arquivo**

Renderiza a navegacao lateral persistente da SPA com grupos expansivos, icones, estado ativo e comportamento colapsado.

**Funcao geral da alteracao**

Adiciona o item "Recorrentes" ao grupo Planner e importa `EventRepeatIcon` para o novo item.

**Blocos principais**

- Linhas 16-33: imports de icones MUI. `EventRepeatIcon` entra na linha 21.
- Linhas 53-58: `plannerItems` agora inclui `{ label: 'Recorrentes', path: '/planner/recurring', icon: <EventRepeatIcon /> }`.
- Linhas 72-86: estado e helpers de path continuam inalterados; `isGroupActive` passa automaticamente a considerar a nova rota porque percorre `plannerItems`.
- Linhas 154-179: grupo Planner renderiza todos os `plannerItems`; o novo item aparece no mesmo `Collapse`.
- Linha 214: item "Configuracoes" permanece no rodape da nav, mas agora aponta para placeholder via router.

**Funcoes, classes e importacoes especificas**

- `Sidebar`: componente principal, recebe `collapsed` e `onToggle`.
- `renderItem`: helper que cria `ListItemButton` com icone, texto e `aria-current`.
- `isActive`: compara `location.pathname === path`.
- `isGroupActive`: usa `startsWith` para marcar grupo ativo quando a rota atual pertence aos itens.
- `EventRepeatIcon`: icone MUI novo para diferenciar recorrentes de `RepeatIcon`, ja usado em Habitos.

**Comportamento de libs usadas**

- MUI `Drawer`, `List`, `ListItemButton`, `Collapse` compoem a navegacao.
- `alpha` aplica fundo ativo com transparencia da cor primaria.
- `useLocation` le o path atual; `useNavigate` navega no click sem reload.

## 4. Pagina do Planner e remocao de SettingsPage

### `frontend/src/pages/planner/RecurringPage.tsx`

**Funcao geral do arquivo**

Nova pagina fina do Planner para hospedar a gestao de templates recorrentes.

**Funcao geral da alteracao**

Arquivo novo. Cria a casca de pagina com landmark `main`, titulo `Recorrentes` e composicao do manager existente via barrel de `features/bujo`.

**Blocos principais**

- Linhas 1-2: imports de MUI e `RecurringTemplateManager`.
- Linhas 4-13: `RecurringPage` retorna `<Box component="main" aria-label="Recorrentes">`, `<Typography variant="h5">Recorrentes</Typography>` e `<RecurringTemplateManager />`.

**Funcoes, classes e importacoes especificas**

- `RecurringPage`: pagina de rota em `/planner/recurring`.
- `RecurringTemplateManager`: componente de feature que contem toda a UI/logic de CRUD.

**Comportamento de libs usadas**

- MUI `Box` aceita `component="main"` para renderizar semanticamente um `<main>`.
- MUI `Typography` com `variant="h5"` renderiza o titulo visual conforme tema.

### `frontend/src/pages/settings/SettingsPage.tsx` (deletado)

**Funcao geral do arquivo**

Antes da delecao, era uma pagina fina de Configuracoes que renderizava titulo "Configuracoes" e compunha `RecurringTemplateManager`.

**Funcao geral da alteracao**

Arquivo deletado porque a unica funcao real da pagina era hospedar recorrentes. A rota `settings` agora usa `PlaceholderPage`, entao nao ha mais importador valido para `SettingsPage`.

**Blocos principais removidos**

- Linhas 1-2 antigas: imports de MUI e `RecurringTemplateManager`.
- Linhas 4-12 antigas: `SettingsPage` com `<main aria-label="Configuracoes">`, titulo e manager.

**Funcoes, classes e importacoes especificas**

- `SettingsPage`: removida. `rg "SettingsPage" frontend/src` retorna zero ocorrencias apos a mudanca.

**Comportamento de libs usadas**

- Usava MUI `Box`/`Typography` da mesma forma que a nova `RecurringPage`, mas com label/titulo de Configuracoes.

### `frontend/src/pages/settings/SettingsPage.test.tsx` (deletado)

**Funcao geral do arquivo**

Smoke test de composicao da antiga `SettingsPage`, com mock de `RecurringTemplateManager` e `jest-axe`.

**Funcao geral da alteracao**

Arquivo deletado junto da pagina. A cobertura equivalente foi recriada para `RecurringPage.test.tsx`.

**Blocos principais removidos**

- Imports de Vitest, Testing Library, `axe` e `SettingsPage`.
- Mock de `../../features/bujo`.
- Quatro testes: titulo, manager renderizado, landmark `main`, acessibilidade.

**Funcoes, classes e importacoes especificas**

- `vi.mock`: mockava o barrel `features/bujo`.
- `axe`: validava acessibilidade da pagina.

**Comportamento de libs usadas**

- Vitest `describe`/`it`/`expect` estruturava a suite.
- Testing Library `render`/`screen` consultava DOM por roles/test ids.

## 5. Gestao de templates recorrentes

### `frontend/src/features/bujo/components/RecurringTemplateManager.tsx`

**Funcao geral do arquivo**

Componente de feature responsavel por listar, criar, editar e ativar/desativar templates recorrentes.

**Funcao geral da alteracao**

Reorganiza o manager para viver no Planner: remove heading interno, adiciona abas por grupo, adiciona switch "Mostrar inativos", filtra a lista localmente e remove o select de grupo do formulario. A criacao usa `recurrenceGroup` da aba ativa. A edicao inline e o toggle de ativo continuam usando a mutation existente.

**Blocos principais**

- Linhas 1-21: imports. Entram `Switch`, `Tab`, `Tabs`; permanecem hooks de API e tipos `RecurrenceGroup`, `RecurringTaskTemplate`, `TaskEisenhower`.
- Linhas 23-34: mapas de rotulo para grupos de recorrencia e Eisenhower.
- Linhas 36-112: `TemplateRow`, componente de linha com edicao inline e toggle. Continua inalterado funcionalmente.
- Linhas 117-126: estado do manager. `group` default `weekly` e `showInactive` default `false`; estado `recurrenceGroup` do form foi removido.
- Linhas 128-134: `visibleTemplates` filtra `(templates.data ?? [])` por `template.recurrenceGroup === group` e por `showInactive || template.active`.
- Linhas 136-155: `handleSubmit` valida titulo/recorrencia, chama `createTemplate.mutate` com `recurrenceGroup: group`, e reseta campos.
- Linhas 159-168: `Tabs`/`Tab` do MUI com `aria-label="Grupo de recorrencia"` e valores `weekly/monthly/annual`.
- Linhas 170-180: regiao `tabpanel` e `Switch` "Mostrar inativos".
- Linhas 182-194: estado vazio por aba ou render de `TemplateRow`.
- Linhas 196-245: formulario de criacao sem select de grupo; mantem titulo, descricao, Eisenhower, recorrencia, ativo e botao criar.

**Funcoes, classes e importacoes especificas**

- `TemplateRow`: recebe `template`, gerencia `editing`, `title`, `recurrenceText`.
- `handleToggleActive`: chama `useUpdateRecurringTemplateMutation().mutate({ templateId, active: !template.active })`.
- `handleSave`: trim em titulo/recorrencia; se ambos existem, envia PATCH parcial com `title` e `recurrenceText`.
- `RecurringTemplateManager`: componente exportado usado por `RecurringPage` e por testes/mocks de barrel.
- `useRecurringTemplatesQuery`: busca templates. Aqui e chamado sem params para carregar tudo uma vez.
- `useCreateRecurringTemplateMutation`: mutation de criacao; recebe payload com `title`, `description`, `eisenhower`, `recurrenceGroup`, `recurrenceText`, `active`.
- `useUpdateRecurringTemplateMutation`: mutation de update parcial.

**Comportamento de libs usadas**

- React `useState` armazena estado local de aba, filtro e formulario; re-renderiza ao mudar.
- React `FormEvent` tipa o evento de submit.
- Array `.filter()` espera predicate booleano e devolve novo array sem alterar `templates.data`.
- MUI `Tabs` espera `value` e `onChange(event, value)`; `Tab` fornece `role="tab"` e `aria-selected`.
- MUI `Switch` e renderizado com semantica de controle binario; Testing Library o encontra por role `checkbox`.
- MUI `Select` com `displayEmpty` e `inputProps` cria combobox acessivel para Eisenhower.
- MUI `Button` com `startIcon={<AddIcon />}` adiciona icone visual ao comando de criacao.

## 6. Testes unitarios e de componente

### `frontend/src/features/bujo/components/RecurringTemplateManager.test.tsx`

**Funcao geral do arquivo**

Suite Vitest/Testing Library para o manager de templates recorrentes.

**Funcao geral da alteracao**

Reescreve e expande a suite para o novo layout com abas/filtro. A cobertura agora inclui weekly/monthly/annual, inativos, criacao por grupo, payload com campos opcionais, guardas de validacao, reset do formulario, loading, edicao/toggle e acessibilidade.

**Blocos principais**

- Linhas 1-7: imports de Vitest, Testing Library, ThemeProvider, `axe`, tema e tipos.
- Linhas 9-20: mocks de API (`useRecurringTemplatesQuery`, mutations de create/update).
- Linhas 22-60: fixtures `WEEKLY_TEMPLATE`, `MONTHLY_TEMPLATE`, `INACTIVE_TEMPLATE`, `ANNUAL_TEMPLATE`.
- Linhas 62-68: `renderManager` embrulha o componente em `ThemeProvider`.
- Linhas 75-131: testes de abas, filtragem weekly/monthly, empty state e mostrar inativos.
- Linhas 133-235: testes de criacao por grupo e payload com descricao/eisenhower.
- Linhas 237-277: guardas do formulario, reset e loading pending.
- Linhas 279-329: edicao inline, save vazio, toggle active e `within` para labels duplicados.
- Linhas 331-340: `jest-axe` contra o componente real.

**Funcoes, classes e importacoes especificas**

- `vi.mock('../api')`: substitui hooks reais por mocks controlados.
- `mockCreateMutate`/`mockUpdateMutate`: capturam payloads de mutations.
- `mockUseRecurringTemplatesQuery`: injeta estados `data` e `isPending`.
- `renderManager`: garante tema MUI customizado para variantes como `body-sm`.
- `within(form)`: escopa queries dentro do formulario para evitar ambiguidade quando ha dois campos "Titulo".

**Comportamento de libs usadas**

- Vitest `beforeEach` limpa mocks para evitar vazamento entre testes.
- Testing Library `screen.getByRole`, `getByLabelText`, `queryByText` simulam uso por semantica acessivel.
- `fireEvent.click/change/mouseDown` dispara eventos DOM/MUI.
- `jest-axe` recebe `container` e retorna relatorio de violacoes; `toHaveNoViolations` falha se houver problema.

### `frontend/src/pages/planner/RecurringPage.test.tsx`

**Funcao geral do arquivo**

Smoke test da nova pagina `RecurringPage`.

**Funcao geral da alteracao**

Arquivo novo. Substitui a cobertura da antiga `SettingsPage.test.tsx` para a nova pagina do Planner.

**Blocos principais**

- Linhas 1-4: imports de Vitest, Testing Library, `axe` e `RecurringPage`.
- Linhas 6-8: mock do barrel `../../features/bujo`, retornando `data-testid="recurring-template-manager"`.
- Linhas 10-34: testes de titulo, composicao do manager, landmark `main` e acessibilidade.

**Funcoes, classes e importacoes especificas**

- `RecurringPage`: componente real sob teste.
- `vi.mock('../../features/bujo')`: isola a pagina do manager para testar apenas composicao.

**Comportamento de libs usadas**

- Testing Library consulta `heading`, `main` e `testid` para validar semantica e montagem.
- `axe` valida a estrutura renderizada sem depender da logica interna do manager.

### `frontend/src/app/layout/Sidebar.test.tsx`

**Funcao geral do arquivo**

Suite de testes da Sidebar.

**Funcao geral da alteracao**

Adiciona um caso garantindo que "Recorrentes" aparece sob o grupo Planner expandido junto dos demais itens.

**Blocos principais**

- Linhas 56-67 adicionadas: novo teste `test_item_recorrentes_sob_grupo_planner`, renderiza sidebar em `/today` e espera "Esta Semana", "Este Mes", "Futuro" e "Recorrentes".

**Funcoes, classes e importacoes especificas**

- `renderSidebar`: helper existente da suite, usado para montar a Sidebar com router/contexto.
- `screen.getByText`: valida presenca de labels visiveis.

**Comportamento de libs usadas**

- Testing Library verifica DOM renderizado; o teste se beneficia do estado inicial `plannerOpen=true` na Sidebar.

## 7. Teste E2E

### `frontend/e2e/recurring-templates.spec.ts`

**Funcao geral do arquivo**

Spec Playwright que exercita o fluxo real de templates recorrentes contra backend/frontend reais, incluindo placement em Weekly/Monthly Log e independencia template/instancia.

**Funcao geral da alteracao**

Atualiza o E2E da UI antiga de Configuracoes para a nova UI em Planner > Recorrentes. Remove uso do select "Grupo de recorrencia", troca para abas e adiciona verificacao do filtro "Mostrar inativos".

**Blocos principais**

- Linhas 3-10: comentario de escopo atualizado para Story 11.2.
- Linhas 12-121: primeiro teste. Cria weekly na aba default, troca para Mensal, cria monthly, valida segmentacao por aba, faz placement semanal/mensal, desativa o monthly, liga "Mostrar inativos" e confirma que placement ativo some sem apagar instancia ja criada.
- Linhas 123-208: segundo teste. Cria template weekly, faz placement, edita template depois, confirma que instancia antiga permanece com titulo antigo e novo placement usa titulo atualizado.

**Funcoes, classes e importacoes especificas**

- `test`/`expect` importados de `./fixtures`: fixture local que provavelmente provisiona usuario/sessao e servidores.
- `page.getByRole('button'|'tab'|'form'|'dialog')`: locators semanticos para navegar e interagir.
- `page.waitForResponse`: sincroniza POST `/place/` e PATCH `/recurring-templates/` antes de seguir.
- `locator('xpath=ancestor::div[2]')`: escopa o botao "Desativar" para a linha do template "Pagar contas".
- `consoleErrors`: acumula erros de console e pageerror, esperado vazio ao fim.

**Comportamento de libs usadas**

- Playwright `expect(locator).toBeVisible({ timeout })` espera ate o DOM refletir estado real apos round-trips.
- `Promise.all([waitForResponse, click])` evita race condition: inicia a espera antes do clique que dispara a requisicao.
- `toHaveCount(0)` verifica ausencia sem falhar por locator nao unico.

## 8. Relacao entre artefatos e consumo posterior

### Como os artefatos criados em um arquivo sao consumidos por outros

- `epics.md` e `architecture.md` produzem requisitos e decisoes futuras: Epic 10.0 consumira AR-21/AR-22 quando o projeto abrir multiusuario.
- `11-2-recorrentes-no-planner-com-abas-e-filtro.md` produz o contrato da story e a file list, consumidos por code review, sprint status e futuras auditorias.
- `sprint-status.yaml` e `orchestration-11-20260714-185946.md` permitem que automacoes BMad saibam que a 11.2 esta implementada/revisada e ainda pendente de commit.
- `router.tsx` consome `RecurringPage` novo; `Sidebar.tsx` aponta o usuario para a rota nova.
- `RecurringPage.tsx` consome `RecurringTemplateManager` pelo barrel de `features/bujo`.
- `RecurringTemplateManager.tsx` consome os hooks existentes de API; suas mutations continuam invalidando cache de recorrentes, que tambem alimenta seções de placement em Weekly/Monthly.
- `RecurringTemplateManager.test.tsx`, `RecurringPage.test.tsx`, `Sidebar.test.tsx` e `recurring-templates.spec.ts` consomem a nova estrutura de UI para garantir que a mudanca nao quebre navegacao, CRUD, acessibilidade ou placement.

## 9. Inventario final dos arquivos nao commitados

**Artefatos/documentacao**

- Modificado: `_bmad-output/implementation-artifacts/11-2-recorrentes-no-planner-com-abas-e-filtro.md`
- Modificado: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Modificado: `_bmad-output/implementation-artifacts/tests/test-summary.md`
- Modificado: `_bmad-output/planning-artifacts/architecture.md`
- Modificado: `_bmad-output/planning-artifacts/epics.md`
- Modificado: `_bmad-output/story-automator/orchestration-11-20260714-185946.md`

**Fonte frontend**

- Modificado: `frontend/src/app/layout/Sidebar.tsx`
- Modificado: `frontend/src/app/router.tsx`
- Modificado: `frontend/src/features/bujo/components/RecurringTemplateManager.tsx`
- Novo: `frontend/src/pages/planner/RecurringPage.tsx`
- Deletado: `frontend/src/pages/settings/SettingsPage.tsx`

**Testes**

- Modificado: `frontend/e2e/recurring-templates.spec.ts`
- Modificado: `frontend/src/app/layout/Sidebar.test.tsx`
- Modificado: `frontend/src/features/bujo/components/RecurringTemplateManager.test.tsx`
- Novo: `frontend/src/pages/planner/RecurringPage.test.tsx`
- Deletado: `frontend/src/pages/settings/SettingsPage.test.tsx`

**Observacao**

Este relatorio foi criado depois do inventario e nao reanalisa a si proprio. Nenhum arquivo de backend, contrato gerado, migration ou schema aparece no conjunto de mudancas.
