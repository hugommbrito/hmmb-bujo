# Explicacao dos arquivos nao commitados - Story 4.6 fechamento de ciclos e arquivo

## Visao geral

As mudancas implementam a Story 4.6: semanas e meses passam a ser considerados "fechados" quando todas as tarefas do ciclo estao dispostas (`completed`, `cancelled`, `migrated` ou `postponed`), sem persistir esse estado. O backend computa fechamento na leitura, expoe `closed` nos logs semanal/mensal, expoe linhagem de migracao no `TaskSerializer` e cria `GET /api/bujo/archive/` para listar ciclos fechados. O frontend adiciona a pagina Arquivo, rotas parametrizadas para consultar semana/mes arquivados reaproveitando `WeeklyPage`/`MonthlyPage`, data hook `useArchiveQuery`, contrato gerado e testes unitarios/E2E.

## Ordem logica de funcionamento

1. Artefatos BMad registram a story 4.6 como concluida, documentam o plano, revisao, execucao de testes e status do sprint.
2. `backend/bujo/services/archive.py` define a regra de negocio: log vazio nao fecha; log com qualquer tarefa `pending`/`started` nao fecha; demais logs com tarefas fecham.
3. Serializers e views backend adicionam `closed`, linhagem de migracao e o endpoint `/api/bujo/archive/`.
4. `schema.yaml` e `frontend/src/api/types.gen.ts` propagam o contrato para o frontend.
5. A camada de dados frontend cria chave de cache, tipo e hook para buscar o Arquivo.
6. O roteador troca o placeholder de `/archive` por `ArchivePage` e adiciona rotas de detalhe reaproveitando `WeeklyPage`/`MonthlyPage`.
7. `WeeklyPage` e `MonthlyPage` leem parametros de rota, mostram o indicador textual de fechamento e escondem affordances de escrita no modo Arquivo.
8. Testes de backend, frontend e E2E cobrem a regra de fechamento, o contrato, o estado vazio, a navegacao e a consulta dos ciclos fechados.
9. `docs/futureIdeas.md` registra ideias/bugs futuros relacionados ao Epic 4.

## 1. Artefatos de story, sprint e QA

### `_bmad-output/implementation-artifacts/4-6-fechamento-de-ciclos-e-arquivo.md`

**Funcao geral do arquivo**

Artefato de implementacao da Story 4.6. E um documento de processo, nao codigo executavel.

**Funcao geral da alteracao**

Arquivo novo que consolida ACs, tarefas, dev notes, debug log, completion notes, revisao senior e file list da story.

**Blocos principais**

- Linhas 1-7: frontmatter com `baseline_commit` e status final `done`.
- Linhas 17-29: acceptance criteria para fechamento computado e superficie Arquivo.
- Linhas 35-153: tarefas backend e camada de dados, incluindo `services/archive.py`, serializers, views, contrato e hook.
- Linhas 155-264: tarefas frontend para `WeeklyPage`, `MonthlyPage`, `ArchivePage`, rotas e testes.
- Linhas 270-290: dev notes que fixam as decisoes de arquitetura: fechamento nao persistido, sem endpoint de detalhe dedicado, separacao entre `closed` e `isArchiveView`.
- Linhas 327-356: registro de execucao, achado de review e correcao do skeleton em `ArchivePage`.
- Linhas 358-382: file list da story.

**Funcoes, classes e importacoes especificas**

- Nao define simbolos executaveis; referencia simbolos implementados nos arquivos de codigo.

**Comportamento de libs usadas**

- Markdown/frontmatter: consumido por humanos e possivelmente por ferramentas BMad; nao afeta runtime.

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Funcao geral do arquivo**

Estado do sprint em formato YAML usado pelo fluxo BMad/story-automator.

**Funcao geral da alteracao**

Marca a Story 4.6 como `done` e atualiza `last_updated` para refletir code review concluido.

**Blocos principais**

- Linha 38: comentario de `last_updated` muda de story 4-5 para story 4-6.
- Linha 77: `4-6-fechamento-de-ciclos-e-arquivo` passa de `backlog` para `done`.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos de codigo.

**Comportamento de libs usadas**

- YAML: chave/valor estruturado; esperado por scripts de orquestracao.

### `_bmad-output/implementation-artifacts/tests/test-summary.md`

**Funcao geral do arquivo**

Historico de sumarios de automacao de testes.

**Funcao geral da alteracao**

Adiciona o resumo da automacao da Story 4.6, destacando o novo spec E2E de Arquivo e o gap de produto sobre linhagem de migracao sem superficie visual dedicada.

**Blocos principais**

- Linhas 1022-1034: contexto da story e gap de cobertura E2E fechado.
- Linhas 1038-1045: arquivos E2E gerados e cenarios cobertos.
- Linhas 1051-1056: matriz AC x cobertura.
- Linhas 1061-1069: comandos e resultados reportados.
- Linhas 1086-1088: observacao de que `migrationCount` chega no contrato, mas nao e renderizado pela UI.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos executaveis.

**Comportamento de libs usadas**

- Markdown com tabelas: usado como evidencia de QA, nao executado.

### `_bmad-output/story-automator/orchestration-4-20260712-232806.md`

**Funcao geral do arquivo**

Log de orquestracao do Epic 4 pelo story-automator.

**Funcao geral da alteracao**

Avanca de 4.5 para 4.6, registra criacao da story, execucao de dev-story, automacao, ciclos de code review e conclusao.

**Blocos principais**

- Linhas 7-12: `currentStory` passa para 4.6 e `lastUpdated` e atualizado.
- Linhas 58-61: matriz de progresso marca 4.5 completa e 4.6 em progresso/review.
- Linhas 113-122: eventos cronologicos da Story 4.6, incluindo passagens incompletas, geracao de E2E e code review aprovado.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos executaveis.

**Comportamento de libs usadas**

- Markdown/YAML-like: artefato operacional para rastreabilidade.

## 2. Backend: regra de fechamento, serializers, views e URLs

### `backend/bujo/services/archive.py`

**Funcao geral do arquivo**

Novo servico de dominio para fechamento computado e listagem de ciclos arquivaveis.

**Funcao geral da alteracao**

Introduz a regra central da Story 4.6 sem migration e sem campo persistido.

**Blocos principais**

- Linhas 1-6: docstring explicita que fechamento e computado na leitura.
- Linhas 8-12: importa `Count`, `Q`, modelos e define `UNDISPOSED = (PENDING, STARTED)`.
- Linhas 15-22: `is_container_closed(log)` avalia qualquer `WeeklyLog`/`MonthlyLog` via relacao `.tasks`.
- Linhas 25-48: `list_closed_cycles(user=...)` usa agregacao condicional para listar semanas e meses com `total > 0` e `undisposed = 0`, ordenando por data desc.

**Funcoes, classes e importacoes especificas**

- `is_container_closed`: espera uma instancia com related manager `.tasks`; retorna `bool`.
- `list_closed_cycles`: recebe `user` por consistencia com outros services; retorna lista de dicts `{type, week_start, month_first}`.
- `Count("tasks", filter=Q(...))`: conta tarefas filtradas no banco em uma agregacao SQL condicional.

**Comportamento de libs usadas**

- `django.db.models.Count`: agrega linhas relacionadas.
- `django.db.models.Q`: expressa predicados compostos/filtrados em queries.
- Managers de `WeeklyLog`/`MonthlyLog`: presumem tenant scoping ja aplicado no projeto.

### `backend/bujo/serializers.py`

**Funcao geral do arquivo**

Serializers DRF da feature BuJo.

**Funcao geral da alteracao**

Expande o contrato de leitura: tarefas passam a expor linhagem de migracao, logs semanal/mensal passam a expor `closed`, e entradas do Arquivo ganham serializer proprio.

**Blocos principais**

- Linhas 23-27: `TaskSerializer.Meta.fields` adiciona `migration_count` e `migrated_to_task`.
- Linha 90: `WeeklyLogSerializer` adiciona `closed`.
- Linha 96: `MonthlyLogSerializer` adiciona `closed`.
- Linhas 99-102: `ArchiveEntrySerializer` define `type`, `week_start` e `month_first`.

**Funcoes, classes e importacoes especificas**

- `TaskSerializer`: `ModelSerializer`; DRF transforma campos de modelo em campos de saida.
- `WeeklyLogSerializer`/`MonthlyLogSerializer`: serializers simples de resposta.
- `ArchiveEntrySerializer`: valida/serializa a lista produzida por `list_closed_cycles`.

**Comportamento de libs usadas**

- `serializers.BooleanField`: espera booleano e serializa como JSON boolean.
- `serializers.ChoiceField`: restringe `type` a `weekly` ou `monthly`.
- `serializers.DateField(required=False, allow_null=True)`: aceita data ausente ou nula para representar o tipo oposto de entrada.

### `backend/bujo/views.py`

**Funcao geral do arquivo**

Views DRF/APIView da feature BuJo.

**Funcao geral da alteracao**

As respostas semanal/mensal incluem `closed` e uma nova view lista o Arquivo.

**Blocos principais**

- Linhas 17 e 37: importam `ArchiveEntrySerializer`, `is_container_closed` e `list_closed_cycles`.
- Linhas 235-243: `WeeklyLogView.get` adiciona `closed: is_container_closed(weekly_log)`.
- Linhas 260-267: `MonthlyLogView.get` adiciona `closed: is_container_closed(monthly_log)`.
- Linhas 328-332: `ArchiveView.get` chama `list_closed_cycles` e retorna `ArchiveEntrySerializer(..., many=True).data`.

**Funcoes, classes e importacoes especificas**

- `WeeklyLogView.get`: continua buscando/criando o log da data pedida e monta dias/unscheduled; agora tambem computa fechamento.
- `MonthlyLogView.get`: continua retornando tarefas raiz do mes; agora tambem computa fechamento.
- `ArchiveView`: endpoint read-only sem corpo de request.

**Comportamento de libs usadas**

- `APIView`: classe base DRF para declarar handlers HTTP.
- `Response`: empacota dados serializados em resposta HTTP.
- `extend_schema`: informa ao drf-spectacular o schema de resposta, permitindo gerar OpenAPI.

### `backend/bujo/urls.py`

**Funcao geral do arquivo**

Tabela de rotas da app BuJo no backend.

**Funcao geral da alteracao**

Registra o novo endpoint `archive/`.

**Blocos principais**

- Linha 4: importa `ArchiveView`.
- Linha 28: adiciona `path("archive/", ArchiveView.as_view(), name="bujo-archive")`.

**Funcoes, classes e importacoes especificas**

- `ArchiveView.as_view()`: transforma a classe APIView em callable Django.

**Comportamento de libs usadas**

- `django.urls.path`: mapeia o path relativo para a view nomeada.

## 3. Backend: testes

### `backend/bujo/tests/test_services.py`

**Funcao geral do arquivo**

Testes unitarios/de servico da feature BuJo.

**Funcao geral da alteracao**

Adiciona cobertura da regra de fechamento e da listagem do Arquivo.

**Blocos principais**

- Linha 9: importa `is_container_closed` e `list_closed_cycles`.
- Linhas 836-851: logs vazios e logs com tarefas pendentes nao fecham.
- Linhas 854-869: parametriza status dispostos e confirma fechamento.
- Linhas 873-884: pai completo com subtarefa pendente mantem ciclo aberto.
- Linhas 888-893: regra funciona tambem para `MonthlyLog`.
- Linhas 897-918: `list_closed_cycles` retorna apenas ciclos fechados em ordem desc.
- Linhas 922-929: tenant scoping impede vazamento entre usuarios.

**Funcoes, classes e importacoes especificas**

- `@pytest.mark.parametrize`: roda o mesmo teste para `COMPLETED`, `CANCELLED`, `MIGRATED`, `POSTPONED`.
- `WeeklyLogFactory`, `MonthlyLogFactory`, `TaskFactory`: criam objetos no banco de teste.
- `tenant_context`: garante execucao no tenant correto.

**Comportamento de libs usadas**

- `pytest.mark.django_db`: habilita acesso ao banco.
- Factories: retornam instancias persistidas para montar cenarios.

### `backend/bujo/tests/test_serializers.py`

**Funcao geral do arquivo**

Testes de serializers BuJo.

**Funcao geral da alteracao**

Garante que `TaskSerializer` expoe os campos de migracao e que eles representam origem/destino corretamente.

**Blocos principais**

- Linha 12: importa `migrate_task`.
- Linhas 41-45: conjunto esperado de campos passa a incluir `migration_count` e `migrated_to_task`.
- Linhas 108-115: tarefa nunca migrada serializa `migration_count = 0` e `migrated_to_task = None`.
- Linhas 119-130: apos `migrate_task`, a origem aponta para a tarefa destino e a tarefa destino recebe `migration_count = 1`.

**Funcoes, classes e importacoes especificas**

- `TaskSerializer(task).data`: materializa representacao Python/JSON-like.
- `migrate_task`: cria tarefa de destino e recarrega a origem com `migrated_to_task` populado.

**Comportamento de libs usadas**

- DRF `ModelSerializer.data`: aplica transformacao de campos do modelo para valores serializaveis.

### `backend/bujo/tests/test_views.py`

**Funcao geral do arquivo**

Testes de endpoints BuJo via cliente autenticado.

**Funcao geral da alteracao**

Valida `closed` nas respostas semanal/mensal e valida o novo endpoint `/api/bujo/archive/`.

**Blocos principais**

- Linha 15: importa `transition_task`.
- Linhas 537-553: weekly log passa de `closed=false` para `true` apos transicionar tarefa para concluida.
- Linhas 637-652: monthly log passa de `closed=false` para `true` apos cancelar a tarefa.
- Linhas 727-764: `ArchiveView` retorna lista vazia, lista semana/mes fechados e respeita tenant.

**Funcoes, classes e importacoes especificas**

- `auth_client.get`: chama endpoints DRF autenticados.
- `transition_task`: aplica maquina de estados real em vez de mutar status diretamente.
- `get_or_create_weekly_log`/`get_or_create_monthly_log`: criam os containers da data esperada.

**Comportamento de libs usadas**

- DRF test client: retorna `response.data` ja parseado.
- `tenant_context`: isola dados de cada usuario.

## 4. Contrato OpenAPI e tipos gerados

### `schema.yaml`

**Funcao geral do arquivo**

Contrato OpenAPI gerado pelo backend.

**Funcao geral da alteracao**

Adiciona path do Arquivo, schema `ArchiveEntry`, campo `closed` nos logs e campos de migracao em `Task`.

**Blocos principais**

- Linhas 60-74: novo `GET /api/bujo/archive/` com resposta array de `ArchiveEntry`.
- Linhas 449-463: schema `ArchiveEntry`.
- Linhas 585-591: `MonthlyLog.closed` e required.
- Linhas 817-824: `Task.migrationCount` e `Task.migratedToTask`.
- Linhas 929-936: enum `TypeEnum`.
- Linhas 964-970: `WeeklyLog.closed` e required.

**Funcoes, classes e importacoes especificas**

- Nao ha funcoes; e contrato gerado.

**Comportamento de libs usadas**

- drf-spectacular: converte serializers/views DRF em OpenAPI.
- Camel case do contrato: expande `week_start` para `weekStart`, `migration_count` para `migrationCount`.

### `frontend/src/api/types.gen.ts`

**Funcao geral do arquivo**

Tipos TypeScript gerados a partir de `schema.yaml`.

**Funcao geral da alteracao**

Propaga o novo contrato para consumidores frontend.

**Blocos principais**

- Linhas 63-78: path `/api/bujo/archive/`.
- Linhas 355-361: tipo `ArchiveEntry`.
- Linhas 417 e 574: `closed` em `MonthlyLog` e `WeeklyLog`.
- Linhas 510-514: `Task.migrationCount` e `Task.migratedToTask`.
- Linhas 558-564: `TypeEnum`.
- Linhas 651-669: operation `bujo_archive_list`.

**Funcoes, classes e importacoes especificas**

- `paths`, `components`, `operations`: interfaces geradas usadas por aliases em `features/bujo/types.ts`.

**Comportamento de libs usadas**

- openapi-typescript ou gerador equivalente: mapeia schemas OpenAPI para interfaces TypeScript; arquivo e gerado, nao deve ser editado manualmente.

## 5. Frontend: camada de dados BuJo

### `frontend/src/api/keys.ts`

**Funcao geral do arquivo**

Centraliza query keys do TanStack Query.

**Funcao geral da alteracao**

Adiciona chave de cache para a lista do Arquivo.

**Blocos principais**

- Linha 24: `archive: () => ['bujo', 'archive', 'list'] as const`.

**Funcoes, classes e importacoes especificas**

- `keys.bujo.archive`: factory de chave estavel para `useArchiveQuery`.

**Comportamento de libs usadas**

- TanStack Query usa arrays como query keys; `as const` preserva tipos literais e evita widening.

### `frontend/src/features/bujo/types.ts`

**Funcao geral do arquivo**

Aliases de tipos da feature BuJo derivados do contrato gerado.

**Funcao geral da alteracao**

Exporta `ArchiveEntry`.

**Blocos principais**

- Linha 18: `export type ArchiveEntry = components['schemas']['ArchiveEntry']`.

**Funcoes, classes e importacoes especificas**

- `components['schemas']['ArchiveEntry']`: conecta codigo de feature ao OpenAPI gerado.

**Comportamento de libs usadas**

- TypeScript indexed access types: extrai o tipo de uma propriedade aninhada.

### `frontend/src/features/bujo/api.ts`

**Funcao geral do arquivo**

Hooks e mutations da feature BuJo sobre o cliente HTTP e TanStack Query.

**Funcao geral da alteracao**

Adiciona o fetcher e hook para consultar ciclos fechados.

**Blocos principais**

- Linha 7: importa tipo `ArchiveEntry`.
- Linhas 435-438: `fetchArchive` faz `client.get<ArchiveEntry[]>('/api/bujo/archive/')`.
- Linhas 441-446: `useArchiveQuery` registra `queryKey` e `queryFn`.

**Funcoes, classes e importacoes especificas**

- `fetchArchive`: espera resposta HTTP com array de entradas; retorna `response.data`.
- `useArchiveQuery`: hook de leitura sem parametros.

**Comportamento de libs usadas**

- Axios-like `client.get<T>`: parametriza o tipo esperado de `data`.
- `useQuery`: executa/cacheia a funcao de busca e retorna estado (`isPending`, `data`, `isSuccess`, etc.).

### `frontend/src/features/bujo/index.ts`

**Funcao geral do arquivo**

Barrel exports da feature BuJo.

**Funcao geral da alteracao**

Reexporta `useArchiveQuery` e `ArchiveEntry`.

**Blocos principais**

- Linha 21: exporta `useArchiveQuery`.
- Linha 46: exporta tipo `ArchiveEntry`.

**Funcoes, classes e importacoes especificas**

- Reexports permitem que paginas importem de `../../features/bujo`.

**Comportamento de libs usadas**

- TypeScript `export type`: exporta apenas tipo, removido no emit.

### `frontend/src/features/bujo/api.test.tsx`

**Funcao geral do arquivo**

Testes dos hooks de API BuJo.

**Funcao geral da alteracao**

Atualiza fixtures de weekly/monthly log com `closed` e adiciona teste de `useArchiveQuery`.

**Blocos principais**

- Linhas 29-39: importa `useArchiveQuery` e `ArchiveEntry`.
- Linhas 364 e 370: fixtures `WEEKLY_LOG`/`MONTHLY_LOG` ganham `closed: false`.
- Linhas 800-818: mocka resposta de Arquivo e confere `GET /api/bujo/archive/`.

**Funcoes, classes e importacoes especificas**

- `renderHook`: renderiza hook isolado.
- `waitFor`: aguarda `isSuccess`.
- `mockGet`: simula chamada HTTP.

**Comportamento de libs usadas**

- Vitest `vi`: mocks/spies.
- Testing Library `renderHook`/`waitFor`: sincroniza estado async de hooks React.

## 6. Frontend: rotas e paginas de Arquivo

### `frontend/src/app/router.tsx`

**Funcao geral do arquivo**

Define a arvore de rotas React Router da aplicacao.

**Funcao geral da alteracao**

Substitui o placeholder de Arquivo pela pagina real e adiciona rotas parametrizadas para consultar semana/mes fechados.

**Blocos principais**

- Linha 14: importa `ArchivePage`.
- Linha 99: rota `archive` passa a renderizar `<ArchivePage />`.
- Linhas 101-109: novas rotas `archive/weekly/:weekStart` e `archive/monthly/:monthFirst`, renderizando `WeeklyPage` e `MonthlyPage`.

**Funcoes, classes e importacoes especificas**

- `routeDefinitions`: array de `RouteObject`.
- `handle.title`: metadado usado pelo layout/announcer.

**Comportamento de libs usadas**

- React Router `RouteObject`: declara path, element e handle; parametros ficam disponiveis por `useParams`.

### `frontend/src/pages/archive/ArchivePage.tsx`

**Funcao geral do arquivo**

Nova pagina que lista ciclos fechados e permite navegar para o detalhe reutilizando rotas existentes.

**Funcao geral da alteracao**

Arquivo novo de source frontend.

**Blocos principais**

- Linhas 1-6: importa RouterLink, MUI, hook/tipo BuJo, nomes de meses e `PlannerSkeleton`.
- Linhas 8-18: `formatEntryLabel` formata semana como data ISO e mes como nome PT + ano.
- Linhas 20-24: `entryPath` monta a rota parametrizada correta.
- Linhas 26-35: `ArchivePage` mostra skeleton dentro do landmark enquanto carrega.
- Linhas 37-47: trata ausencia de dados e estado vazio.
- Linhas 49-62: renderiza lista de links para semana/mes.

**Funcoes, classes e importacoes especificas**

- `formatEntryLabel`: espera `ArchiveEntry`; retorna string de display.
- `entryPath`: retorna `/archive/weekly/<weekStart>` ou `/archive/monthly/<monthFirst>`.
- `ArchivePage`: componente React que consome `useArchiveQuery`.

**Comportamento de libs usadas**

- MUI `Box`, `List`, `ListItemButton`, `ListItemText`, `Typography`: componentes visuais.
- `RouterLink`: transforma item da lista em link interno sem reload.
- `PlannerSkeleton`: feedback de loading usado por paginas planner.

### `frontend/src/pages/archive/ArchivePage.test.tsx`

**Funcao geral do arquivo**

Testes unitarios da nova pagina Arquivo.

**Funcao geral da alteracao**

Arquivo novo que cobre loading, estado vazio, formatacao, navegacao e acessibilidade.

**Blocos principais**

- Linhas 1-14: imports e mock de `useArchiveQuery`.
- Linhas 16-26: helper com `MemoryRouter` e rotas de destino fake.
- Linhas 28-31: entradas mockadas.
- Linhas 34-40: skeleton/landmark no loading.
- Linhas 42-57: estado vazio e rotulos formatados.
- Linhas 59-68: clique navega para a rota semanal.
- Linhas 70-76: `jest-axe` sem violacoes.

**Funcoes, classes e importacoes especificas**

- `renderArchivePage`: monta a pagina dentro do roteador.
- `mockUseArchiveQuery`: controla estados do hook.

**Comportamento de libs usadas**

- React Router `MemoryRouter`, `Routes`, `Route`: simula navegacao em teste.
- `userEvent`: interage como usuario.
- `axe`: roda checagens automatizadas de acessibilidade.

## 7. Frontend: paginas semanal e mensal em modo Arquivo

### `frontend/src/pages/planner/WeeklyPage.tsx`

**Funcao geral do arquivo**

Pagina de visualizacao do log semanal.

**Funcao geral da alteracao**

Permite reutilizar a pagina como detalhe de semana arquivada, mostra "Fechada" quando `closed=true` e remove placement de recorrentes no modo Arquivo.

**Blocos principais**

- Linha 2: importa `useParams`.
- Linhas 16-18: le `routeWeekStart`, define `isArchiveView` e passa a data para `useWeeklyLogQuery`.
- Linha 34: desestrutura `closed`.
- Linhas 38-45: landmark muda para `Arquivo - Semana de ...` e renderiza "Fechada".
- Linhas 99-124: `RecurringPlacementSection` e dialog so renderizam fora do modo Arquivo.

**Funcoes, classes e importacoes especificas**

- `WeeklyPage`: componente React; agora tem dois modos de entrada.
- `useWeeklyLogQuery(routeWeekStart)`: busca semana da URL quando existe, ou semana padrao quando ausente.

**Comportamento de libs usadas**

- React Router `useParams`: retorna parametros string da rota atual.
- MUI `useMediaQuery`: mantem layout responsivo existente.

### `frontend/src/pages/planner/WeeklyPage.test.tsx`

**Funcao geral do arquivo**

Testes da pagina semanal.

**Funcao geral da alteracao**

Adiciona `MemoryRouter` aos helpers e cobre indicador de fechamento/modo Arquivo.

**Blocos principais**

- Linha 3: importa `MemoryRouter`, `Route`, `Routes`.
- Linhas 53-61: `renderWeeklyPage` passa a montar componente dentro de Router.
- Linhas 64-81: helper `renderWeeklyPageAtArchiveRoute`.
- Linha 96: fixture `WEEKLY_LOG` ganha `closed: false`.
- Linhas 258-271: testa visibilidade/ausencia de "Fechada".
- Linhas 274-285: rota arquivada passa parametro ao hook, altera aria-label e nao busca templates recorrentes.

**Funcoes, classes e importacoes especificas**

- `mockUseWeeklyLogQuery`: valida argumento `weekStart`.
- `mockGet`: garante que recorrentes nao sao buscados no modo Arquivo.

**Comportamento de libs usadas**

- Testing Library `screen`: consulta elementos por texto, label e role.
- Vitest mocks: registram chamadas dos hooks.

### `frontend/src/pages/planner/MonthlyPage.tsx`

**Funcao geral do arquivo**

Pagina de visualizacao e criacao de tarefas do log mensal.

**Funcao geral da alteracao**

Permite reutilizar a pagina como detalhe de mes arquivado, mostra "Fechado" quando `closed=true` e remove formulario/placement de recorrentes no modo Arquivo.

**Blocos principais**

- Linha 2: importa `useParams`.
- Linhas 52-54: le `routeMonthFirst`, define `isArchiveView` e passa a data para `useMonthlyLogQuery`.
- Linha 72: desestrutura `closed`.
- Linhas 139-150: landmark muda para `Arquivo - Mes de ...` e renderiza "Fechado".
- Linhas 186-240: formulario de adicionar tarefa, `RecurringPlacementSection` e dialog ficam dentro de `!isArchiveView`.

**Funcoes, classes e importacoes especificas**

- `MonthlyPage`: componente React; agora tambem serve detalhe de Arquivo.
- `useMonthlyLogQuery(routeMonthFirst)`: busca mes da URL quando existe.
- `handleSubmit`: permanece disponivel apenas quando o formulario e renderizado.

**Comportamento de libs usadas**

- React Router `useParams`: fornece `monthFirst`.
- MUI `TextField`/`Button`: continuam usados somente na visao normal.

### `frontend/src/pages/planner/MonthlyPage.test.tsx`

**Funcao geral do arquivo**

Testes da pagina mensal.

**Funcao geral da alteracao**

Adiciona `MemoryRouter` aos helpers e cobre indicador de fechamento/modo Arquivo.

**Blocos principais**

- Linha 3: importa `MemoryRouter`, `Route`, `Routes`.
- Linhas 43-51: helper normal agora tem Router.
- Linhas 54-72: helper de rota `/archive/monthly/:monthFirst`.
- Linhas 81 e 108: fixtures ganham `closed: false`.
- Linhas 398-417: testa visibilidade/ausencia de "Fechado".
- Linhas 422-433: rota arquivada passa parametro ao hook e esconde form + recorrentes.

**Funcoes, classes e importacoes especificas**

- `mockUseMonthlyLogQuery`: valida argumento `monthFirst`.
- `mockRefetch`: preserva contratos ja existentes dos testes.

**Comportamento de libs usadas**

- Fake timers do Vitest: preservam cenarios dependentes de data fixa.
- Testing Library: valida acessibilidade por labels e roles.

## 8. E2E de Arquivo

### `frontend/e2e/seedArchiveScenario.ts`

**Funcao geral do arquivo**

Helper E2E para criar no banco um cenario de semana/mes fechados.

**Funcao geral da alteracao**

Arquivo novo usado pelo spec de Arquivo.

**Blocos principais**

- Linhas 1-13: imports Node e resolucao do diretorio backend.
- Linhas 15-29: interfaces dos inputs/outputs.
- Linhas 31-92: `seedArchiveScenario` monta script Python, executa `uv run python manage.py shell -c ...` e retorna datas criadas.

**Funcoes, classes e importacoes especificas**

- `seedArchiveScenario(email, input)`: espera email de usuario criado pela fixture e arrays de tarefas; retorna `{weekStart, monthFirst}`.
- `execFileSync`: executa comando sem shell, com argumentos separados.

**Comportamento de libs usadas**

- Node `child_process.execFileSync`: roda processo externo e captura stdout.
- `path`/`fileURLToPath`: resolvem caminhos no contexto ESM.
- Django `manage.py shell -c`: executa script com modelos reais e `tenant_context`.

### `frontend/e2e/archive.spec.ts`

**Funcao geral do arquivo**

Spec Playwright E2E permanente para o fluxo Arquivo.

**Funcao geral da alteracao**

Arquivo novo com dois testes cobrindo estado vazio e fluxo real de listagem/navegacao para ciclos fechados.

**Blocos principais**

- Linhas 1-18: imports e comentario de escopo.
- Linhas 20-30: helper local para label de mes em PT.
- Linhas 32-36: teste de Arquivo vazio.
- Linhas 38-63: seed de semana/mes fechados com tarefas completadas, canceladas e migradas.
- Linhas 64-72: abre Arquivo e verifica links.
- Linhas 78-108: navega para semana, valida "Fechada", status finais e `migrationCount` no payload real.
- Linhas 111-125: navega para mes, valida "Fechado", ausencia de escrita e ausencia de erros de console.

**Funcoes, classes e importacoes especificas**

- `monthLabel`: formata `YYYY-MM-01` para label esperado na UI.
- `page.waitForResponse`: captura payload real de `GET /api/bujo/logs/weekly/`.
- `page.on('request')`: detecta se templates recorrentes foram buscados indevidamente.

**Comportamento de libs usadas**

- Playwright `test`/`expect`: executa fluxo em navegador real.
- Fixtures locais `page`/`email`: autenticam/criam usuario conforme suite existente.

## 9. Documentacao auxiliar

### `docs/futureIdeas.md`

**Funcao geral do arquivo**

Lista informal de ideias futuras e bugs conhecidos.

**Funcao geral da alteracao**

Reformata itens como checklist Markdown, adiciona detalhe sobre resumo diario e lista debitos do Epic 4.

**Blocos principais**

- Linhas 1-9: ideias gerais reformatadas como `- [ ]`.
- Linhas 12-20: secao `BUGs Epico 4` com problemas/desejos sobre banco poluido, recorrentes, edicao/delecao e criacao em semana.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos executaveis.

**Comportamento de libs usadas**

- Markdown checklist: renderiza caixas de tarefas em viewers compatíveis.

## 10. Observacoes de qualidade e consumo entre arquivos

- `services/archive.py` produz as decisoes `closed` e lista de entradas; `views.py` consome esse servico.
- `serializers.py` define a forma de resposta; `schema.yaml` captura essa forma; `types.gen.ts` transforma o contrato em tipos; `features/bujo/types.ts` e `api.ts` consomem os tipos.
- `keys.ts` fornece a chave de cache usada por `useArchiveQuery`.
- `ArchivePage.tsx` consome `useArchiveQuery`, usa labels formatados e gera links que dependem das rotas adicionadas em `router.tsx`.
- `WeeklyPage.tsx` e `MonthlyPage.tsx` consomem os parametros dessas rotas e, por isso, seus testes precisaram de `MemoryRouter`.
- `archive.spec.ts` usa `seedArchiveScenario.ts` para criar dados que exercitam backend, contrato, cache/API frontend e UI no mesmo fluxo.
- `test-summary.md`, `sprint-status.yaml`, `orchestration-*.md` e a story `4-6-...md` sao artefatos de implementacao/processo, nao alteram comportamento da aplicacao.

