# Explicacao dos arquivos nao commitados - Story 3.3

## Visao geral

O conjunto de mudancas implementa a Story 3.3: criacao e edicao de tarefas com titulo, descricao, categoria, matriz Eisenhower e subtarefas. O backend passa a expor endpoints de criacao, edicao parcial e criacao de subtarefa; o contrato OpenAPI e os tipos frontend foram regenerados; o frontend ganha mutacoes otimistas, helper de arvore, linha de criacao rapida, painel de detalhe responsivo e renderizacao recursiva de subtarefas. A mudanca tambem instala Playwright para E2E real, atualiza artefatos BMad e adiciona testes backend, frontend unitarios e E2E.

## Ordem logica de funcionamento

1. Artefatos BMad registram que a Story 3.3 foi criada, executada, revisada e marcada como `done`.
2. A configuracao de teste/E2E prepara Playwright, exclui specs E2E do Vitest e ignora artefatos gerados.
3. O backend serializa tarefas como arvore, valida payloads de escrita e cria/edita tarefas via servico transacional.
4. As rotas DRF publicam os endpoints `POST /tasks/`, `PATCH /tasks/{id}/` e `POST /tasks/{id}/subtasks/`.
5. `schema.yaml` e `types.gen.ts` propagam o novo contrato para o frontend.
6. A camada de dados React Query chama os endpoints e atualiza o cache do Daily Log de forma otimista.
7. Componentes e pagina diaria exibem tarefas/subtarefas, criam novas tarefas, abrem o painel de detalhe e salvam edicoes.
8. Testes backend, frontend unitarios e E2E validam o fluxo completo e os gaps descobertos.

## 1. Artefatos BMad e skill de relatorio

### `_bmad-output/implementation-artifacts/3-3-criacao-e-edicao-de-tarefas-com-campos-completos-e-subtarefas.md`

**Funcao geral do arquivo**

Artefato de implementacao da Story 3.3. E documentacao de planejamento/execucao, nao codigo de runtime.

**Funcao geral da alteracao**

Arquivo novo que descreve os acceptance criteria, tarefas tecnicas, decisoes, validacoes, code review e file list final da story.

**Blocos principais**

- Linhas 1-7: metadata de baseline e status `done`.
- Linhas 11-35: historia e ACs para criar tarefa, editar via painel e suportar subtarefas independentes.
- Linhas 39-108: tarefas de servico e serializers, incluindo `order_index` por irmaos e `LogSerializer` filtrando so raizes.
- Linhas 110-180: views, URLs, contrato OpenAPI e mutacoes otimistas do frontend.
- Linhas 182-196: componentes, pagina diaria, atalho `N` e validacoes.
- Linhas 275-304: Dev Agent Record, bug corrigido do atalho `N` e achados de code review.
- Linhas 306-346: File List que enumera todos os arquivos tocados.
- Linhas 348-351: Change Log com execucao e revisao da story.

**Funcoes, classes e importacoes especificas**

- Nao define simbolos executaveis; serve como contrato de implementacao para humanos/agentes.

**Comportamento de libs usadas**

- Nao usa bibliotecas em runtime.

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Funcao geral do arquivo**

Rastreia o status das stories/epics do sprint.

**Funcao geral da alteracao**

Atualiza `last_updated` para 2026-07-07 e move a story `3-3-criacao-e-edicao-de-tarefas-com-campos-completos-e-subtarefas` de `backlog` para `done`.

**Blocos principais**

- Linhas 38 e 66 no arquivo atual: status global e status da story 3.3.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos; YAML consumido por workflows/agentes BMad.

**Comportamento de libs usadas**

- Parsers YAML esperam chaves escalares e listas; este arquivo entrega estado de planejamento.

### `_bmad-output/implementation-artifacts/tests/test-summary.md`

**Funcao geral do arquivo**

Historico resumido de automacao de testes por story.

**Funcao geral da alteracao**

Adiciona o resumo da Story 3.3, documentando a instalacao de Playwright, 5 E2E novos, 2 testes backend extras e os comandos de validacao executados.

**Blocos principais**

- Linhas novas 576-654: resumo da story, decisao de instalar Playwright, cobertura por AC e execucao.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos executaveis.

**Comportamento de libs usadas**

- Markdown; consumido por humanos/agentes.

### `_bmad-output/story-automator/orchestration-3-20260703-191211.md`

**Funcao geral do arquivo**

Estado da orquestracao automatizada do Epic 3.

**Funcao geral da alteracao**

Move `currentStory` para 3.3, registra a story 3.2 como commitada, marca o ciclo 3.3 como executado/revisado e deixa o automator parado aguardando decisao de commit.

**Blocos principais**

- Linhas 7-11: historia atual e timestamp.
- Linhas 58-61: tabela de progresso por story.
- Linhas 104-109: eventos da Story 3.3, incluindo Playwright, code review e status `done`.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos executaveis.

**Comportamento de libs usadas**

- Markdown/YAML front matter simples para leitura por automacao.

### `.agents/skills/bmad-uncommitted-report/SKILL.md`

**Funcao geral do arquivo**

Skill local nova que define como gerar relatorios de arquivos nao commitados.

**Funcao geral da alteracao**

Adiciona instrucoes para inventariar `git status`, inspecionar diffs/untracked, ordenar por fluxo logico e salvar Markdown em `_bmad-output/implementation-artifacts/uncommitted-reports/`.

**Blocos principais**

- Linhas 1-4: metadata da skill.
- Linhas 8-26: local e padrao de nome do relatorio.
- Linhas 28-37: workflow de inventario, inspecao e escrita.
- Linhas 39-79: estrutura obrigatoria do relatorio.
- Linhas 81-91: requisitos de analise por arquivo.
- Linhas 93-109: heuristica de ordenacao produtor-consumidor.
- Linhas 111-126: comandos recomendados.
- Linhas 128-136: regras de qualidade.

**Funcoes, classes e importacoes especificas**

- `description`: usado pelo mecanismo de skills para decidir quando acionar a skill.

**Comportamento de libs usadas**

- O loader de skills espera front matter YAML com `name` e `description`; o restante e Markdown instrucional.

### `.agents/skills/bmad-uncommitted-report/agents/openai.yaml`

**Funcao geral do arquivo**

Configuracao de interface da skill para o agente OpenAI.

**Funcao geral da alteracao**

Arquivo novo com nome visivel, descricao curta e prompt padrao.

**Blocos principais**

- Linhas 1-4: `display_name`, `short_description` e `default_prompt`.

**Funcoes, classes e importacoes especificas**

- `default_prompt`: instrui a usar `$bmad-uncommitted-report`.

**Comportamento de libs usadas**

- YAML de configuracao; o runtime da skill espera valores escalares.

### `_bmad-output/implementation-artifacts/uncommitted-reports/.gitkeep`

**Funcao geral do arquivo**

Mantem versionavel a pasta onde relatorios desta skill sao salvos.

**Funcao geral da alteracao**

Arquivo novo vazio.

**Blocos principais**

- Linha 1: vazia.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos.

**Comportamento de libs usadas**

- Git nao versiona diretorios vazios; `.gitkeep` e uma convencao para preservar a pasta.

## 2. Configuracao e infra de E2E

### `.gitignore`

**Funcao geral do arquivo**

Define artefatos locais ignorados pelo Git.

**Funcao geral da alteracao**

Ignora saidas do Playwright: `frontend/test-results/`, `frontend/playwright-report/` e cache local.

**Blocos principais**

- Linhas novas 25-27: padroes de artefatos E2E.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos.

**Comportamento de libs usadas**

- Git interpreta padroes por linha; diretorios terminados em `/` ignoram todo o conteudo.

### `frontend/package.json`

**Funcao geral do arquivo**

Manifesto npm do frontend.

**Funcao geral da alteracao**

Adiciona script `test:e2e` e dependencia dev `@playwright/test`.

**Blocos principais**

- Linhas 11-15: scripts; `test:e2e` chama `playwright test`.
- Linhas 28-31: dev dependency `@playwright/test`.

**Funcoes, classes e importacoes especificas**

- `test:e2e`: entrypoint padrao para rodar a suite E2E.

**Comportamento de libs usadas**

- npm executa scripts via `npm run <nome>`.
- `@playwright/test` fornece runner, fixtures `test`/`expect`, configuracao de browsers e `webServer`.

### `frontend/package-lock.json`

**Funcao geral do arquivo**

Lockfile npm que fixa resolucoes exatas.

**Funcao geral da alteracao**

Trava `@playwright/test@1.61.1`, `playwright@1.61.1`, `playwright-core@1.61.1` e a dependencia opcional `fsevents` no macOS.

**Blocos principais**

- Bloco raiz: inclui `@playwright/test` em `devDependencies`.
- Blocos `node_modules/@playwright/test`, `node_modules/playwright` e `node_modules/playwright-core`: registram versoes, integridade, bins e engines Node.

**Funcoes, classes e importacoes especificas**

- Nao ha codigo, mas o lockfile e consumido por `npm ci`/`npm install`.

**Comportamento de libs usadas**

- npm usa `integrity` para verificar o pacote baixado e `bin` para expor o comando `playwright`.

### `frontend/playwright.config.ts`

**Funcao geral do arquivo**

Configuracao do runner Playwright para E2E real.

**Funcao geral da alteracao**

Arquivo novo que sobe Vite na porta 5173 e Django na porta 8000 antes dos testes.

**Blocos principais**

- Linhas 1-2: importa `defineConfig` e `devices`.
- Linhas 6-15: define `testDir`, paralelismo, retries, reporter e `baseURL`.
- Linhas 16-18: projeto Chromium desktop.
- Linhas 19-35: `webServer` para frontend e backend, com `DJANGO_SETTINGS_MODULE=config.settings.dev`.

**Funcoes, classes e importacoes especificas**

- `defineConfig`: recebe objeto tipado de configuracao e retorna a configuracao do runner.
- `devices['Desktop Chrome']`: preset de viewport/user agent/browser para Chromium.

**Comportamento de libs usadas**

- Playwright `webServer` espera `command`, `cwd` e `url`; aguarda a URL responder antes de iniciar testes.
- `reuseExistingServer` reaproveita servidores locais fora de CI.

### `frontend/eslint.config.js`

**Funcao geral do arquivo**

Configura ESLint do frontend.

**Funcao geral da alteracao**

Desliga `react-hooks/rules-of-hooks` para `e2e/**/*.ts`, pois a fixture `test.extend` do Playwright usa propriedade chamada `page`, nao hooks React.

**Blocos principais**

- Linhas novas 27-35: override para arquivos E2E.

**Funcoes, classes e importacoes especificas**

- `tseslint.config`: compoe configuracoes flat do ESLint.

**Comportamento de libs usadas**

- ESLint flat config aplica blocos por glob `files`; regras locais sobrescrevem regras globais.

### `frontend/vitest.config.ts`

**Funcao geral do arquivo**

Configura Vitest para testes unitarios/integracao em jsdom.

**Funcao geral da alteracao**

Importa `configDefaults` e adiciona `e2e/**` ao `exclude`, evitando que Vitest colete specs Playwright.

**Blocos principais**

- Linha 1: `configDefaults`.
- Linhas 10-13: `exclude` com defaults + E2E.

**Funcoes, classes e importacoes especificas**

- `defineConfig`: tipa e exporta a configuracao Vite/Vitest.
- `configDefaults.exclude`: lista padrao do Vitest preservada antes de adicionar `e2e/**`.

**Comportamento de libs usadas**

- Vitest roda em `jsdom`; Playwright roda em browser real. Separar a coleta evita APIs incompatíveis.

## 3. Backend: serializers, servicos e rotas

### `backend/bujo/services/tasks.py`

**Funcao geral do arquivo**

Servico de dominio para criar e editar `Task`.

**Funcao geral da alteracao**

Arquivo novo com `create_task` e `update_task`, ambos transacionais e alinhados ao padrao de servicos do app.

**Blocos principais**

- Linhas 1-3: docstring explicando que validacao de forma/enum fica nos serializers.
- Linhas 5-7: imports de `models`, `transaction` e `Task`.
- Linhas 10-29: `create_task` calcula `order_index` por irmaos e cria tarefa em `pending`.
- Linhas 32-38: `update_task` busca por `Task.objects`, aplica somente campos recebidos e salva `updated_at`.

**Funcoes, classes e importacoes especificas**

- `create_task`: recebe `user`, `log`, `title`, campos opcionais e `parent_task`; retorna uma `Task` persistida.
- `update_task`: recebe `user`, `task_id` e patch; retorna a `Task` atualizada.
- `models.Max`: agrega o maior `order_index` dos irmaos.
- `transaction.atomic`: garante atomicidade da leitura do maximo e escrita dentro de uma transacao.

**Comportamento de libs usadas**

- Django ORM `filter(...).aggregate(models.Max(...))` espera queryset e retorna dict com chave `order_index__max`.
- `Task.objects` parece ser tenant-scoped pelo contexto do projeto; por isso `user` fica como parte da assinatura padrao, mas o escopo real vem do manager/contexto.

### `backend/bujo/serializers.py`

**Funcao geral do arquivo**

Serializers DRF do Daily Log.

**Funcao geral da alteracao**

Estende leitura de `Task` com `description` e `subtasks`, muda `LogSerializer.tasks` para retornar apenas tarefas raiz e adiciona serializers de criacao/atualizacao.

**Blocos principais**

- Linhas 6-7: importa `extend_schema_field` e `serializers`.
- Linhas 12-20: `TaskSerializer` com `SerializerMethodField` recursivo para `subtasks`.
- Linhas 23-26: anotacao OpenAPI do campo recursivo depois da definicao da classe.
- Linhas 29-39: `LogSerializer` filtra `parent_task__isnull=True`.
- Linhas 42-50: `TaskCreateSerializer`.
- Linhas 53-61: `TaskUpdateSerializer`.

**Funcoes, classes e importacoes especificas**

- `TaskSerializer.get_subtasks`: serializa `obj.subtasks.all()` com o proprio `TaskSerializer`.
- `LogSerializer.get_tasks`: evita duplicar subtarefas na raiz.
- `serializers.CharField`: valida strings, `max_length` e `allow_blank`.
- `serializers.ChoiceField`: valida enums `Task.Eisenhower.choices` e `Task.Category.choices`.

**Comportamento de libs usadas**

- DRF `SerializerMethodField` chama `get_<field>` durante serializacao e retorna dados de leitura.
- `extend_schema_field` informa ao drf-spectacular o schema real do campo calculado, evitando inferencia incorreta.

### `backend/bujo/views.py`

**Funcao geral do arquivo**

Views DRF finas do app BuJo.

**Funcao geral da alteracao**

Adiciona views para criar tarefa raiz, editar tarefa e criar subtarefa, mantendo `TodayLogView` e transicao de status.

**Blocos principais**

- Linhas 5-21: imports de schema, status HTTP, serializers e servicos.
- Linhas 24-29: `TodayLogView` existente.
- Linhas 32-39: `TaskCreateView.post`.
- Linhas 42-51: `TaskDetailView.patch`.
- Linhas 54-66: `SubtaskCreateView.post`.
- Linhas 69-84: transicao existente preservada.

**Funcoes, classes e importacoes especificas**

- `TaskCreateView`: valida `TaskCreateSerializer`, resolve log de hoje via `today_for(request.user)` e chama `create_task`.
- `TaskDetailView`: valida patch parcial e traduz `Task.DoesNotExist` para `NotFound`.
- `SubtaskCreateView`: resolve o pai pela URL e cria filho herdando `parent.log`.
- `extend_schema`: declara request/response para OpenAPI.

**Comportamento de libs usadas**

- `APIView` despacha metodos HTTP para `get`/`post`/`patch`.
- `body.is_valid(raise_exception=True)` retorna 400 automatico em erro de validacao.
- `Response(..., status=status.HTTP_201_CREATED)` serializa payload e status HTTP 201.
- `NotFound` vira resposta 404 padronizada pelo DRF.

### `backend/bujo/urls.py`

**Funcao geral do arquivo**

Mapa de rotas do app BuJo.

**Funcao geral da alteracao**

Registra as tres novas rotas antes da rota de transicao.

**Blocos principais**

- Linhas 1-8: imports de views.
- Linhas 11-15: rotas `logs/today/`, `tasks/`, `tasks/<uuid:pk>/`, `tasks/<uuid:pk>/subtasks/` e `transition/`.

**Funcoes, classes e importacoes especificas**

- `path`: cria URL pattern Django; conversor `<uuid:pk>` transforma segmento de URL em UUID.

**Comportamento de libs usadas**

- Django avalia patterns na ordem definida; as rotas mais especificas de subtarefa/transicao convivem com `tasks/<uuid:pk>/` por terem sufixos distintos.

## 4. Contratos gerados

### `schema.yaml`

**Funcao geral do arquivo**

Contrato OpenAPI gerado pelo backend.

**Funcao geral da alteracao**

Adiciona endpoints de criacao/edicao/subtarefa e schemas `TaskCreate`, `PatchedTaskUpdate`; amplia `Task` com `description` e `subtasks`.

**Blocos principais**

- Linhas novas em `paths`: `/api/bujo/tasks/`, `/api/bujo/tasks/{id}/`, `/api/bujo/tasks/{id}/subtasks/`.
- Bloco `components.schemas.PatchedTaskUpdate`: patch parcial com campos opcionais.
- Bloco `components.schemas.Task`: inclui `description` e `subtasks` recursivo.
- Bloco `components.schemas.TaskCreate`: payload de criacao.

**Funcoes, classes e importacoes especificas**

- `operationId` como `bujo_tasks_create`, `bujo_tasks_partial_update`, `bujo_tasks_subtasks_create`: nomes consumidos por geradores de tipos.

**Comportamento de libs usadas**

- drf-spectacular gera OpenAPI a partir de serializers e `extend_schema`; `openapi-typescript` consome este YAML para produzir tipos TypeScript.

### `frontend/src/api/types.gen.ts`

**Funcao geral do arquivo**

Tipos TypeScript gerados a partir do OpenAPI.

**Funcao geral da alteracao**

Reflete os novos paths, schemas e operations do backend.

**Blocos principais**

- Linhas 76-124: paths novos para tarefas.
- Linhas 173-210: schemas `PatchedTaskUpdate`, `Task` ampliado e `TaskCreate`.
- Linhas 320-392: operations de criar, editar e criar subtarefa.

**Funcoes, classes e importacoes especificas**

- `paths`: mapeia URL/metodo para `operations`.
- `components["schemas"]["Task"]`: agora contem `readonly subtasks: Task[]`.
- `operations["bujo_tasks_*"]`: descrevem parametros, requestBody e response.

**Comportamento de libs usadas**

- `openapi-typescript` traduz OpenAPI para interfaces TypeScript estruturais; o arquivo e gerado e nao deve ser editado manualmente.

## 5. Frontend: camada de dados e arvore

### `frontend/src/features/bujo/api.ts`

**Funcao geral do arquivo**

Hooks de dados do feature BuJo usando TanStack Query.

**Funcao geral da alteracao**

Adiciona mutacoes otimistas para criar tarefa raiz, criar subtarefa e atualizar tarefa.

**Blocos principais**

- Linhas 1-6: imports de Query, client, keys, mutacao otimista, `mapTaskTree` e tipos.
- Linhas 8-44: query e mutacao de transicao existentes.
- Linhas 46-60: `TaskFields` e `optimisticTask`.
- Linhas 64-78: `createTask` e `useCreateTaskMutation`.
- Linhas 80-104: `createSubtask` e `useCreateSubtaskMutation`.
- Linhas 106-127: `updateTask` e `useUpdateTaskMutation`.

**Funcoes, classes e importacoes especificas**

- `useOptimisticMutation`: wrapper local que aplica snapshot otimista, rollback em erro e invalida query no settle.
- `crypto.randomUUID`: cria id temporario client-side para tarefa otimista.
- `client.post`/`client.patch`: chamam endpoints Axios-like e retornam `response.data`.
- `mapTaskTree`: atualiza um no em qualquer profundidade.

**Comportamento de libs usadas**

- TanStack Query usa `queryKey` para localizar o cache; todas as mutacoes invalidam `keys.bujo.todayLog()`.
- Axios espera URL e body, retornando promise com `data`.

### `frontend/src/features/bujo/index.ts`

**Funcao geral do arquivo**

Barrel export do feature BuJo.

**Funcao geral da alteracao**

Exporta os novos hooks de criacao, subtarefa e atualizacao.

**Blocos principais**

- Linhas 1-8: export dos hooks.
- Linha 9: export dos tipos existentes.

**Funcoes, classes e importacoes especificas**

- `useCreateTaskMutation`, `useCreateSubtaskMutation`, `useUpdateTaskMutation`: consumidos por `DailyPage` e `TaskDetailPanel`.

**Comportamento de libs usadas**

- ES modules reexportam simbolos para reduzir imports profundos.

### `frontend/src/features/bujo/taskTree.ts`

**Funcao geral do arquivo**

Helper puro para trabalhar com arvore de tarefas.

**Funcao geral da alteracao**

Arquivo novo com mapeamento recursivo e busca recursiva por id.

**Blocos principais**

- Linha 1: importa tipo `Task`.
- Linhas 3-9: `mapTaskTree`.
- Linhas 11-18: `findTaskById`.

**Funcoes, classes e importacoes especificas**

- `mapTaskTree(tasks, taskId, fn)`: retorna nova arvore com `fn` aplicada ao no encontrado.
- `findTaskById(tasks, taskId)`: percorre DFS e retorna a primeira tarefa encontrada.

**Comportamento de libs usadas**

- Nao usa libs externas; recursao imutavel preserva compatibilidade com React Query/React.

## 6. Frontend: componentes e pagina

### `frontend/src/features/bujo/components/AddTaskRow.tsx`

**Funcao geral do arquivo**

Componente reutilizavel de entrada rapida para criar tarefa ou subtarefa.

**Funcao geral da alteracao**

Arquivo novo com `TextField`, botao e suporte a ref para o atalho `N`.

**Blocos principais**

- Linhas 1-3: imports React, MUI e icone.
- Linhas 5-9: props.
- Linhas 11-46: componente `forwardRef`, estado local, submit, Enter e UI.

**Funcoes, classes e importacoes especificas**

- `forwardRef`: permite que `DailyPage` foque o input externamente.
- `useState`: controla o titulo digitado.
- `submit`: trim, rejeita vazio, chama `onAdd` e limpa o campo.

**Comportamento de libs usadas**

- MUI `TextField` recebe `inputRef` para o elemento `<input>`.
- MUI `Button` com `startIcon` renderiza icone `AddIcon` antes do texto.

### `frontend/src/features/bujo/components/TaskDetailPanel.tsx`

**Funcao geral do arquivo**

Painel de detalhe/edicao de uma tarefa.

**Funcao geral da alteracao**

Arquivo novo com Drawer responsivo, campos editaveis, selects de categoria/Eisenhower e criacao de subtarefas.

**Blocos principais**

- Linhas 1-15: imports React, MUI, icone, hooks de API, `AddTaskRow` e tipos.
- Linhas 17-31: labels de categoria e Eisenhower.
- Linhas 33-47: props, hooks, estado local e guard sem tarefa.
- Linhas 49-70: `Drawer` lateral/bottom sheet e botao fechar.
- Linhas 71-104: campos `Titulo` e `Descricao`.
- Linhas 105-146: selects `Categoria` e `Eisenhower`.
- Linhas 148-168: lista de subtarefas e input para nova subtarefa quando a tarefa aberta nao e subtarefa.

**Funcoes, classes e importacoes especificas**

- `useMediaQuery('(max-width: 767px)')`: escolhe `anchor="bottom"` no mobile e `right` no desktop.
- `useUpdateTaskMutation`: persiste patches no blur/select.
- `useCreateSubtaskMutation`: cria subtarefa com `parentTaskId`.
- `inputProps={{ 'aria-label': ... }}`: coloca label no elemento correto do MUI Select.

**Comportamento de libs usadas**

- MUI `Drawer` temporario fecha via `onClose` em Escape/clique fora.
- MUI `Select` emite `event.target.value`; valores vazios sao convertidos para `null`.

### `frontend/src/features/bujo/components/TaskRow.tsx`

**Funcao geral do arquivo**

Renderiza uma linha de tarefa com status, chips e interacoes.

**Funcao geral da alteracao**

Torna o titulo clicavel para abrir detalhes e renderiza `subtasks` recursivamente com indentacao.

**Blocos principais**

- Linhas 11-47: mapas de icones, labels, proximo status e chip Eisenhower.
- Linhas 49-53: props agora incluem `onOpenDetail`.
- Linhas 55-71: estado de anuncio e `handleStatusClick`.
- Linhas 73-153: linha principal, botao de status, titulo como botao e chips.
- Linhas 154-165: renderizacao recursiva de subtarefas.

**Funcoes, classes e importacoes especificas**

- `onTransition(task.id, nextStatus)`: mantem ciclo independente por id.
- `onOpenDetail(task.id)`: abre o painel na pagina.
- `role="status"`/`aria-live`: anuncia mudanca de status.

**Comportamento de libs usadas**

- MUI `IconButton` recebe `disabled` para estados fora do ciclo.
- `useMediaQuery` ajusta altura minima em mobile.
- React recursivo renderiza cada subtarefa como outro `TaskRow`.

### `frontend/src/pages/daily/DailyPage.tsx`

**Funcao geral do arquivo**

Pagina do Daily Log.

**Funcao geral da alteracao**

Integra criacao de tarefas, atalho `N`, painel de detalhe e busca recursiva da tarefa aberta.

**Blocos principais**

- Linhas 1-10: imports de hooks, componentes e helper.
- Linhas 12-17: estado de mutacoes, `openTaskId` e ref do input.
- Linhas 19-43: listener do atalho `N`.
- Linhas 45-53: estados loading/sem dados.
- Linhas 55-58: calcula contagem pendente, tarefa aberta e se ela e subtarefa.
- Linhas 60-85: renderiza header, lista, `AddTaskRow` e `TaskDetailPanel`.

**Funcoes, classes e importacoes especificas**

- `useEffect`: registra/remove listener de teclado.
- `useRef<HTMLInputElement>`: aponta para o input de nova tarefa.
- `findTaskById`: localiza tarefas em profundidade.
- `useCreateTaskMutation` e `useTransitionTaskMutation`: conectam UI a API.

**Comportamento de libs usadas**

- React state dispara re-render quando `openTaskId` muda.
- `event.preventDefault()` impede vazamento da tecla `n` para o input recem-focado.

## 7. Testes backend

### `backend/bujo/tests/test_serializers.py`

**Funcao geral do arquivo**

Testa serializers do app BuJo.

**Funcao geral da alteracao**

Atualiza expectativa de campos de `TaskSerializer` e adiciona testes para `description`, `subtasks` e raiz do log.

**Blocos principais**

- Linhas novas 32-41: inclui `description` e `subtasks` nos campos.
- Linhas 60-80: `description=None` vira `null` e subtasks vazias viram `[]`.
- Linhas 83-99: subtarefas respeitam `order_index`.
- Linhas 102-119: `LogSerializer` nao duplica subtarefas na raiz.

**Funcoes, classes e importacoes especificas**

- `tenant_context`: ativa escopo de tenant nos testes.
- `TaskFactory`/`LogFactory`: criam dados persistidos para serializacao.

**Comportamento de libs usadas**

- pytest-django com `@pytest.mark.django_db` permite acesso ao banco.
- DRF serializer retorna `.data` com tipos Python/JSON-like.

### `backend/bujo/tests/test_services.py`

**Funcao geral do arquivo**

Testa servicos de dominio BuJo.

**Funcao geral da alteracao**

Adiciona cobertura para `create_task` e `update_task`.

**Blocos principais**

- Linhas novas 10-11: imports dos servicos e `LogFactory`.
- Linhas 71-82: ordem sequencial para tarefas raiz.
- Linhas 85-108: `order_index` de subtarefa relativo aos irmaos.
- Linhas 111-119: update parcial preserva campos nao enviados.
- Linhas 122-139: isolamento por tenant.

**Funcoes, classes e importacoes especificas**

- `create_task`: validado para raiz, subtarefa e tenant.
- `update_task`: validado para patch parcial e 404 via `DoesNotExist` em outro tenant.

**Comportamento de libs usadas**

- `pytest.raises(Task.DoesNotExist)` confirma que o manager tenant-scoped nao enxerga tarefa de outro usuario.

### `backend/bujo/tests/test_views.py`

**Funcao geral do arquivo**

Testa endpoints HTTP do app BuJo via DRF client.

**Funcao geral da alteracao**

Adiciona testes de API para criar tarefa, editar tarefa, criar subtarefa, validar enums, tenant e aninhamento recursivo.

**Blocos principais**

- Linhas novas 171-198: `POST /api/bujo/tasks/`.
- Linhas 201-243: `PATCH /api/bujo/tasks/{id}/`.
- Linhas 246-294: `POST /api/bujo/tasks/{id}/subtasks/` e raiz sem duplicacao.
- Linhas 297-329: subtarefa de subtarefa aceita e serializada recursivamente.
- Linhas 332-343: titulo em branco no patch retorna 400.

**Funcoes, classes e importacoes especificas**

- `auth_client`: cliente autenticado.
- `get_or_create_daily_log`/`today_for`: confirmam criacao no log correto.
- `Task.objects.get`: verifica persistencia e relacoes.

**Comportamento de libs usadas**

- DRF `APIClient.post/patch/get(..., format="json")` serializa body JSON e retorna `response.data`.

## 8. Testes frontend unitarios/integracao

### `frontend/src/features/bujo/api.test.tsx`

**Funcao geral do arquivo**

Testa hooks de API BuJo com QueryClient em memoria.

**Funcao geral da alteracao**

Mocka `patch` e adiciona testes de otimismo/rollback para criar tarefa, criar subtarefa e atualizar tarefa.

**Blocos principais**

- Linhas 4-18: mock do client e imports dos novos hooks.
- Linhas 40-52: fixture `LOG` com `subtasks`.
- Linhas 115-250: suites das tres novas mutacoes.

**Funcoes, classes e importacoes especificas**

- `renderHook`: executa hooks React em teste.
- `QueryClientProvider`: fornece cache isolado.
- `waitFor`: aguarda mudancas async de estado da mutacao.

**Comportamento de libs usadas**

- TanStack Query atualiza cache sincrona/assincronamente; os testes inspecionam `qc.getQueryData`.
- Vitest `vi.fn` controla resolucao/rejeicao das chamadas HTTP mockadas.

### `frontend/src/features/bujo/taskTree.test.ts`

**Funcao geral do arquivo**

Testa helpers puros de arvore.

**Funcao geral da alteracao**

Arquivo novo cobrindo update em raiz, update em subtarefa, busca em raiz, busca em subtarefa e nao encontrado.

**Blocos principais**

- Linhas 5-15: factory `makeTask`.
- Linhas 17-37: testes de `mapTaskTree`.
- Linhas 39-58: testes de `findTaskById`.

**Funcoes, classes e importacoes especificas**

- `describe`/`it`/`expect`: APIs Vitest de organizacao e assertions.

**Comportamento de libs usadas**

- Nao depende de DOM; Vitest executa como teste unitario puro.

### `frontend/src/features/bujo/components/AddTaskRow.test.tsx`

**Funcao geral do arquivo**

Testa o componente de entrada de tarefa.

**Funcao geral da alteracao**

Arquivo novo cobrindo Enter, vazio, botao e ref.

**Blocos principais**

- Linhas 8-16: helper de render com tema.
- Linhas 18-66: casos AC1.

**Funcoes, classes e importacoes especificas**

- `render`, `screen`, `fireEvent`: Testing Library para render e eventos.
- `createRef`: valida encaminhamento de ref.

**Comportamento de libs usadas**

- Testing Library busca por roles/labels, aproximando comportamento de usuario.

### `frontend/src/features/bujo/components/TaskDetailPanel.test.tsx`

**Funcao geral do arquivo**

Testa o painel de detalhe real.

**Funcao geral da alteracao**

Arquivo novo cobrindo edicao, subtarefas, esconder input em subtarefa, Escape e acessibilidade.

**Blocos principais**

- Linhas 9-15: mocks dos hooks de API.
- Linhas 17-37: fixture e render helper.
- Linhas 44-135: renderizacao, patches, dropdown, subtarefa e lista.
- Linhas 137-143: Escape fecha.
- Linhas 145-162: `jest-axe` sem violacoes relevantes.

**Funcoes, classes e importacoes especificas**

- `vi.mock('../api')`: substitui hooks por mutacoes mockadas.
- `axe(document.body, { rules: { region: { enabled: false } } })`: auditoria de acessibilidade do painel.

**Comportamento de libs usadas**

- MUI `Drawer` renderiza via portal; por isso o teste de axe usa `document.body`.

### `frontend/src/features/bujo/components/TaskRow.test.tsx`

**Funcao geral do arquivo**

Testa a linha de tarefa.

**Funcao geral da alteracao**

Atualiza fixtures com `subtasks`, injeta `onOpenDetail` e cobre titulo clicavel, subtarefas e independencia de status.

**Blocos principais**

- Linhas novas 15-25: fixture/render helper com `subtasks` e `onOpenDetail`.
- Linhas novas 165-207: novos cenarios AC2/AC3.

**Funcoes, classes e importacoes especificas**

- `onOpenDetail`: mock validado ao clicar no titulo.
- `onTransition`: mock validado para subtarefa, sem cascata no pai.

**Comportamento de libs usadas**

- Testing Library `getAllByRole` diferencia botoes de status pai/filho pelo role e label.

### `frontend/src/pages/daily/DailyPage.test.tsx`

**Funcao geral do arquivo**

Testa a pagina diaria em jsdom.

**Funcao geral da alteracao**

Mocka novas dependencias, testa `AddTaskRow`, painel de detalhe, atalho `N`, guards de modificadores/editaveis e acessibilidade com painel aberto.

**Blocos principais**

- Linhas novas 9-24: mocks de mutacao e `TaskDetailPanel`.
- Linhas novas 66-76: input aparece mesmo com lista vazia.
- Linhas novas 137-226: abrir/fechar painel e testes do atalho `N`.
- Linhas novas 233-263: axe com painel aberto.

**Funcoes, classes e importacoes especificas**

- `KeyboardEvent`: usado para testar `preventDefault`.
- `vi.spyOn(event, 'preventDefault')`: confirma que apenas `N` simples e interceptado.

**Comportamento de libs usadas**

- jsdom nao renderiza layout real; por isso o bottom sheet mobile fica coberto nos E2E Playwright.

### `frontend/src/app/router.test.tsx`

**Funcao geral do arquivo**

Testa roteamento da aplicacao.

**Funcao geral da alteracao**

Adiciona mocks para `useCreateTaskMutation` e `TaskDetailPanel` para evitar dependencia de QueryClient real nos testes de router.

**Blocos principais**

- Linhas novas 25-32: mock do hook e componente.

**Funcoes, classes e importacoes especificas**

- `vi.mock`: substitui modulo durante o teste.

**Comportamento de libs usadas**

- Vitest hoista mocks de modulo; isso isola o teste de rotas da camada de dados.

### `frontend/src/app/layout/RouteAnnouncer.test.tsx`

**Funcao geral do arquivo**

Testa o anunciador de rotas/acessibilidade no layout.

**Funcao geral da alteracao**

Mesmo ajuste do router: mocka criacao de tarefa e painel para manter o teste focado em layout.

**Blocos principais**

- Linhas novas 21-28: mock do hook e do componente.

**Funcoes, classes e importacoes especificas**

- `TaskDetailPanel: () => null`: impede uso de mutacoes reais fora de provider.

**Comportamento de libs usadas**

- Testes de layout nao precisam montar portais MUI nem TanStack Query.

## 9. Testes E2E Playwright

### `frontend/e2e/fixtures.ts`

**Funcao geral do arquivo**

Fixtures compartilhadas para E2E.

**Funcao geral da alteracao**

Arquivo novo que cria usuario real por teste, exporta `test`/`expect`, helper de sincronizacao apos mutacoes otimistas e seletor do painel de detalhe.

**Blocos principais**

- Linhas 1-2: imports Playwright.
- Linhas 5-16: signup real e chegada em `/today`.
- Linhas 18-23: fixture `page` customizada.
- Linhas 34-44: `syncAfter`.
- Linhas 46-48: `detailPanel`.

**Funcoes, classes e importacoes especificas**

- `base.extend`: cria fixture customizada.
- `page.waitForResponse`: aguarda refetch de `/api/bujo/logs/today/`.
- `crypto.randomUUID`: gera email unico.

**Comportamento de libs usadas**

- Playwright `page` controla navegador real; `expect(locator).toBeVisible()` aguarda condicoes automaticamente.

### `frontend/e2e/daily-tasks.spec.ts`

**Funcao geral do arquivo**

Suite E2E real da Story 3.3.

**Funcao geral da alteracao**

Arquivo novo com 5 cenarios cobrindo criacao, edicao, subtarefas, mobile bottom sheet e persistencia apos reload.

**Blocos principais**

- Linhas 6-32: criar tarefa via botao/atalho `N` e rejeitar vazio.
- Linhas 34-74: editar campos e adicionar subtarefa aninhada.
- Linhas 76-98: status de subtarefa independente.
- Linhas 100-118: painel como bottom sheet mobile.
- Linhas 120-140: persistencia apos reload.

**Funcoes, classes e importacoes especificas**

- `syncAfter`: evita agir sobre ids temporarios da mutacao otimista.
- `detailPanel`: seleciona o Drawer correto.
- `page.setViewportSize`: simula mobile.
- `boundingBox`: confirma posicao/tamanho real do bottom sheet.

**Comportamento de libs usadas**

- Playwright locators sao resilientes e aguardam elementos; browser real permite testar layout que jsdom nao mede.

## 10. Arquivos gerados/consumidores secundarios

### `frontend/src/features/bujo/components/TaskRow.test.tsx`, `DailyPage.test.tsx`, `api.test.tsx` como consumidores do novo contrato

**Funcao geral dos arquivos**

Suites existentes que consomem o shape `Task`.

**Funcao geral da alteracao**

Todas passam a incluir `subtasks: []` nas fixtures, refletindo o contrato gerado em `types.gen.ts` e o `TaskSerializer`.

**Blocos principais**

- Varios blocos de fixtures: adicionam `subtasks` para manter coerencia com a arvore.

**Funcoes, classes e importacoes especificas**

- `Task` type: agora representa uma arvore.

**Comportamento de libs usadas**

- TypeScript exige que fixtures estejam compativeis com o tipo gerado.

## 11. Relacao produtor-consumidor

- `backend/bujo/services/tasks.py` produz as operacoes de dominio usadas por `backend/bujo/views.py`.
- `backend/bujo/serializers.py` define o shape de leitura/escrita usado por `views.py` e por `schema.yaml`.
- `backend/bujo/urls.py` torna os endpoints acessiveis para o cliente HTTP.
- `schema.yaml` e `frontend/src/api/types.gen.ts` propagam o contrato para o TypeScript.
- `frontend/src/features/bujo/api.ts` consome os endpoints e atualiza o cache `keys.bujo.todayLog()`.
- `frontend/src/features/bujo/taskTree.ts` e consumido por `api.ts` para mutacoes otimistas profundas e por `DailyPage.tsx` para localizar a tarefa aberta.
- `AddTaskRow.tsx`, `TaskRow.tsx`, `TaskDetailPanel.tsx` e `DailyPage.tsx` compoem a experiencia de criacao/edicao/subtarefas.
- Os testes backend validam dominio/API; os testes frontend validam hooks/componentes; os E2E validam integracao real entre browser, Vite e Django.
