# Explicacao dos arquivos nao commitados - Story 11.5 CRUD de tarefas em Esta Semana / Este Mes

## Visao geral

O conjunto de mudancas implementa a Story 11.5: criar tarefas diretamente em Esta Semana, editar tarefas de Semana/Mes pelo `TaskDetailPanel`, remover tarefa por hard delete quando `pending` sem linhagem ou por cancelamento nos demais casos, e bloquear mutacoes em ciclos semanais/mensais fechados. A mudanca atravessa artefatos BMad, dominio Django, OpenAPI, hooks React Query, paginas React e testes unitarios/E2E.

## Ordem logica de funcionamento

1. Artefatos BMad registram a story 11.5, status do sprint, orquestracao e resumo de testes.
2. O backend cria a excecao `ClosedCycleReadOnly` e passa a centralizar o bloqueio de escrita em `services/tasks.py`.
3. O fluxo de migracao usa `set_lineage_fields` para manter bookkeeping de linhagem sem ser bloqueado pelo novo guardrail.
4. Serializers e views expõem `POST /api/bujo/logs/weekly/` e `DELETE /api/bujo/tasks/{id}/`.
5. `schema.yaml` e `types.gen.ts` propagam os novos contratos para o frontend.
6. Hooks React Query criam/cancelam/excluem tarefas e invalidam caches de Daily/Weekly/Monthly/taskDensity.
7. `WeeklyPage`, `MonthlyPage` e `TaskDetailPanel` conectam criacao, edicao, exclusao/cancelamento e modo somente leitura.
8. Testes de backend, frontend e E2E validam regras de dominio, contratos HTTP, UI e fluxos reais.

## 1. Artefatos de planejamento e execucao

### `_bmad-output/implementation-artifacts/11-5-crud-de-tarefas-em-esta-semana-este-mes.md`

**Funcao geral do arquivo**

Artefato de story da BMad para a Story 11.5. E um documento de implementacao, nao codigo-fonte, que descreve escopo, ACs, tasks/subtasks e decisoes tecnicas.

**Funcao geral da alteracao**

Arquivo novo que define o contrato funcional da mudanca: CRUD em Semana/Mes, hard delete vs cancelamento, e ciclos fechados somente-leitura tanto na UI quanto no backend.

**Blocos principais**

- Linhas 1-7: metadata da story e `baseline_commit`.
- Linhas 11-50: narrativa da story e quatro acceptance criteria.
- Linhas 54-180: tasks de backend: `ClosedCycleReadOnly`, guardrail em `create_task`/`update_task`, `delete_task`, serializer semanal, view semanal e `DELETE`.
- Linhas 181 em diante: tasks de frontend e testes, incluindo hooks, formularios, `TaskDetailPanel`, schema e E2E.

**Funcoes, classes e importacoes especificas**

- Nao define simbolos executaveis; funciona como especificacao consumida por implementadores e revisores.

**Comportamento de libs usadas**

- Markdown e YAML front matter sao apenas formato documental; nao ha runtime.

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Funcao geral do arquivo**

Rastreamento de status das stories do projeto.

**Funcao geral da alteracao**

Marca `11-5-crud-de-tarefas-em-esta-semana-este-mes` como `done` e atualiza `last_updated` para refletir conclusao por code-review.

**Blocos principais**

- Linhas 38-40: atualizacao de `last_updated`.
- Linhas 83-86: status da story 11.5 muda de `backlog` para `done`.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos; e configuracao/estado em YAML.

**Comportamento de libs usadas**

- YAML representa pares chave/valor e listas; consumidores leem esse arquivo para saber status de sprint.

### `_bmad-output/story-automator/orchestration-11-20260714-185946.md`

**Funcao geral do arquivo**

Registro da orquestracao automatizada do epic 11.

**Funcao geral da alteracao**

Avanca `currentStory` para 11.5, atualiza timestamp e registra eventos da conclusao da 11.4 e execucao da 11.5.

**Blocos principais**

- Linhas 4-13: metadata da orquestracao, story atual e step atual.
- Linhas 57-62: tabela de progresso; 11.4 fica completa, 11.5 entra em progresso/concluida nas etapas aplicaveis.
- Linhas 116-121: log cronologico da story 11.5, incluindo dev-story, automacao, achado de UX fora de escopo e code-review.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos executaveis.

**Comportamento de libs usadas**

- Markdown com tabela e front matter; usado por humanos e possiveis automacoes BMad.

### `_bmad-output/implementation-artifacts/tests/test-summary.md`

**Funcao geral do arquivo**

Historico de resumos de validacao automatizada.

**Funcao geral da alteracao**

Adiciona o resumo da Story 11.5, descrevendo cobertura por AC, execucoes Playwright/TypeScript/ESLint e um achado de UX fora do escopo do workflow.

**Blocos principais**

- Linhas 1475-1486: escopo da validacao 11.5.
- Linhas 1488-1502: lacuna corrigida no E2E, adicionando assercao de zero erros de console a 4 testes.
- Linhas 1508-1517: achado fora de escopo sobre botao de delete/cancel em estado terminal.
- Linhas 1519-1558: cobertura por AC, resultado de comandos e checklist.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos; e artefato de QA.

**Comportamento de libs usadas**

- Markdown registra comandos e resultados; nao altera runtime.

## 2. Excecoes e servicos de dominio

### `backend/core/exceptions.py`

**Funcao geral do arquivo**

Centraliza excecoes de dominio usadas pelo backend. O handler global mapeia subclasses de `DomainError` para respostas HTTP consistentes.

**Funcao geral da alteracao**

Adiciona `ClosedCycleReadOnly`, a excecao que representa tentativa de mutar `WeeklyLog`/`MonthlyLog` fechado.

**Blocos principais**

- Linhas 59-64: `WrongPlacementContainer` permanece e `ClosedCycleReadOnly` e introduzida ao lado de outras excecoes de dominio.

**Funcoes, classes e importacoes especificas**

- `ClosedCycleReadOnly`: sinaliza "ciclo fechado, somente leitura"; por herdar de `DomainError`, segue o fluxo de resposta 409 do handler existente.

**Comportamento de libs usadas**

- Classes Python de excecao carregam semantica via heranca. O DRF consome a excecao atraves do exception handler do projeto.

### `backend/bujo/services/tasks.py`

**Funcao geral do arquivo**

Servico de criacao, edicao e reordenacao de `Task`, com operacoes atomicas e escopo por tenant via manager.

**Funcao geral da alteracao**

Centraliza o bloqueio de escrita em ciclo fechado, cria `delete_task`, separa `_apply_fields` e adiciona `set_lineage_fields` para bookkeeping interno de migracao.

**Blocos principais**

- Linhas 7-10: novos imports de `is_container_closed`, `transition_task` e `ClosedCycleReadOnly`.
- Linhas 13-19: `_check_container_open` valida `weekly_log`/`monthly_log` e levanta `ClosedCycleReadOnly`.
- Linhas 22-61: `create_task` chama o guardrail antes de calcular `order_index` e criar `Task`.
- Linhas 64-68: `update_task` busca a task escopada, valida ciclo aberto e delega a aplicacao de campos.
- Linhas 71-84: `set_lineage_fields` atualiza campos internos de linhagem sem passar pelo guardrail de ciclo fechado.
- Linhas 87-91: `_apply_fields` aplica campos e salva com `update_fields`.
- Linhas 94-107: `delete_task` decide entre hard delete e cancelamento via state machine.

**Funcoes, classes e importacoes especificas**

- `_check_container_open`: recebe containers opcionais; espera objetos `WeeklyLog`/`MonthlyLog`; retorna `None` ou levanta `ClosedCycleReadOnly`.
- `create_task`: espera dados ja validados por serializers; retorna `Task` criada com `status=PENDING`.
- `update_task`: espera `task_id` e campos validados; retorna `Task` persistida.
- `set_lineage_fields`: usada por migracao para `migration_count`/`migrated_to_task`; retorna `Task` persistida.
- `delete_task`: retorna `None` quando faz hard delete ou retorna `Task` quando cancela.
- `transition_task`: funcao de state machine importada que espera `user`, `task_id` e `to_status`; retorna a task transicionada ou levanta `InvalidTransition`.
- `is_container_closed`: espera container semanal/mensal; retorna booleano conforme existe tarefa e nao ha `pending`/`started`.

**Comportamento de libs usadas**

- `transaction.atomic`: do Django, executa cada operacao em transacao; em excecao, faz rollback.
- `models.Max`: agregacao do ORM que retorna o maior `order_index` dos irmaos.

### `backend/bujo/services/migration.py`

**Funcao geral do arquivo**

Executa migracao/disposicao de tarefas entre Daily, Weekly, Monthly e Future Log.

**Funcao geral da alteracao**

Troca chamadas a `update_task` por `set_lineage_fields` para campos de linhagem. Isso evita que o novo guardrail de ciclo fechado bloqueie bookkeeping que ocorre como parte legitima de uma transicao ja validada.

**Blocos principais**

- Linhas 16-18: importa `set_lineage_fields` junto de `create_task`.
- Linhas 29-41: `_migrate_subtree` transiciona origem, cria nova task e atualiza `migration_count`/`migrated_to_task` via `set_lineage_fields`.

**Funcoes, classes e importacoes especificas**

- `_migrate_subtree`: cria copia migrada da task e percorre subtarefas pendentes/started.
- `transition_task`: garante fail-fast pela matriz de transicoes antes da criacao da copia.
- `set_lineage_fields`: atualiza campos internos sem expor essa brecha a requests comuns.

**Comportamento de libs usadas**

- `transaction.atomic` envolve `migrate_task`; se uma parte da migracao falha, o conjunto volta ao estado anterior.

## 3. Serializers, views e contratos HTTP

### `backend/bujo/serializers.py`

**Funcao geral do arquivo**

Define serializers DRF para validar entrada e formatar saida da API BuJo.

**Funcao geral da alteracao**

Adiciona `WeeklyTaskCreateSerializer`, simetrico ao serializer mensal, com validacao de segunda-feira e de `scheduled_date` dentro da semana.

**Blocos principais**

- Linha 5: novo import de `timedelta`.
- Linhas 201-211: campos aceitos pelo POST semanal: `week_start`, `title`, `scheduled_date`, `description`, `eisenhower`, `category`.
- Linhas 213-226: validacao de `week_start.isoweekday() == 1` e intervalo `[week_start, week_start + 6 dias]`.

**Funcoes, classes e importacoes especificas**

- `WeeklyTaskCreateSerializer`: serializer de entrada; transforma camelCase do request em snake_case pelo pipeline ja existente do projeto.
- `serializers.DateField`: espera string de data; entrega `datetime.date`.
- `serializers.ChoiceField`: restringe valores aos enums de `Task`.

**Comportamento de libs usadas**

- DRF `Serializer.is_valid(raise_exception=True)` executa `validate` e retorna 400 em erro de validacao.
- `timedelta(days=6)` calcula o ultimo dia aceito da semana.

### `backend/bujo/views.py`

**Funcao geral do arquivo**

Expõe endpoints HTTP da API BuJo via DRF `APIView`.

**Funcao geral da alteracao**

Adiciona `DELETE /api/bujo/tasks/{id}/` e `POST /api/bujo/logs/weekly/`, usando os servicos de dominio e serializers novos.

**Blocos principais**

- Linhas 101-109: `TaskDetailView.delete` chama `delete_task`, retorna 204 sem corpo para hard delete ou 200 com `TaskSerializer` para cancelamento.
- Linhas 235-267: `WeeklyLogView.get` ja monta semana, tarefas sem dia e `closed`.
- Linhas 269-284: `WeeklyLogView.post` valida payload semanal, obtém/cria `WeeklyLog`, chama `create_task` e retorna 201.

**Funcoes, classes e importacoes especificas**

- `TaskDetailView.delete`: captura `Task.DoesNotExist` e converte em `NotFound`.
- `WeeklyLogView.post`: consome `WeeklyTaskCreateSerializer` e produz `TaskSerializer`.
- `delete_task`: encapsula regra hard delete vs cancelamento.
- `create_task`: encapsula ordenacao, status inicial e guardrail de ciclo fechado.

**Comportamento de libs usadas**

- `extend_schema`: do drf-spectacular, descreve request/response para gerar OpenAPI.
- `Response`: do DRF, serializa corpo e status HTTP.
- `status.HTTP_204_NO_CONTENT`, `HTTP_200_OK`, `HTTP_201_CREATED`: constantes legiveis de status HTTP.

### `schema.yaml`

**Funcao geral do arquivo**

Contrato OpenAPI gerado para a API.

**Funcao geral da alteracao**

Adiciona `POST /api/bujo/logs/weekly/`, `DELETE /api/bujo/tasks/{id}/` e schema `WeeklyTaskCreate`.

**Blocos principais**

- Linhas 164-183: operacao `bujo_logs_weekly_create` com request `WeeklyTaskCreate` e response `Task`.
- Linhas 379-400: operacao `bujo_tasks_destroy` com response 204 ou 200 com `Task`.
- Linhas 1084-1117: schema `WeeklyTaskCreate` com datas, titulo e campos opcionais.

**Funcoes, classes e importacoes especificas**

- Nao define funcoes; e contrato gerado a partir de serializers/views.

**Comportamento de libs usadas**

- OpenAPI usa `$ref` para reaproveitar schemas e `oneOf` para enums nullable.

### `frontend/src/api/types.gen.ts`

**Funcao geral do arquivo**

Tipos TypeScript gerados a partir do OpenAPI.

**Funcao geral da alteracao**

Reflete os novos endpoints e componentes do schema para uso tipado no frontend.

**Blocos principais**

- Linhas 149-152: `/api/bujo/logs/weekly/` passa a ter `post`.
- Linhas 293-296: `/api/bujo/tasks/{id}/` passa a ter `delete`.
- Linhas 619-628: tipo `WeeklyTaskCreate`.
- Linhas 839-861: operacao `bujo_logs_weekly_create`.
- Linhas 1036-1064: operacao `bujo_tasks_destroy`, com respostas 200/204.

**Funcoes, classes e importacoes especificas**

- `components["schemas"]["WeeklyTaskCreate"]`: tipo de payload semanal.
- `operations["bujo_tasks_destroy"]`: tipo da operacao DELETE.

**Comportamento de libs usadas**

- TypeScript interfaces descrevem shape estatico; nao geram runtime.

## 4. Camada de dados do frontend

### `frontend/src/features/bujo/api.ts`

**Funcao geral do arquivo**

Hooks e funcoes de acesso HTTP da feature BuJo, usando cliente Axios e React Query.

**Funcao geral da alteracao**

Invalida cache semanal em edicoes, adiciona `useCreateWeeklyTaskMutation` e `useDeleteTaskMutation`.

**Blocos principais**

- Linhas 146-155: `useUpdateTaskMutation` invalida `weeklyLog` e `monthlyLog` quando edicoes podem acontecer fora do Daily Log.
- Linhas 199-221: define payload e hook de criacao semanal.
- Linhas 224-247: define payload e hook de delete/cancelamento.

**Funcoes, classes e importacoes especificas**

- `createWeeklyTask`: espera `weekStart`, `title` e campos opcionais; envia POST e retorna `Task`.
- `useCreateWeeklyTaskMutation`: invalida cache `keys.bujo.weeklyLog(weekStart)` e `taskDensity`.
- `deleteTask`: envia DELETE; retorna `null` em 204 ou `Task` em 200.
- `useDeleteTaskMutation`: invalida `todayLog`, `weeklyLog`, `monthlyLog` e `taskDensity`.
- `useUpdateTaskMutation`: usa update otimista no Daily Log, mas invalida caches de Semana/Mes para refetch.

**Comportamento de libs usadas**

- `useMutation`: React Query executa mutacoes e callbacks de sucesso/erro.
- `queryClient.invalidateQueries`: marca caches como stale e dispara refetch para queries ativas.
- Axios `client.post`, `client.delete`: retornam objeto com `data` e `status`.

### `frontend/src/features/bujo/index.ts`

**Funcao geral do arquivo**

Barrel export da feature BuJo.

**Funcao geral da alteracao**

Exporta `useCreateWeeklyTaskMutation` e `useDeleteTaskMutation` para paginas e componentes consumirem.

**Blocos principais**

- Linhas 9-18: lista de hooks exportados ganha os dois novos hooks.

**Funcoes, classes e importacoes especificas**

- Reexporta simbolos definidos em `api.ts`; nao implementa logica propria.

**Comportamento de libs usadas**

- ES modules permitem reexportar simbolos para reduzir imports profundos.

## 5. UI e fluxos de usuario

### `frontend/src/pages/planner/WeeklyPage.tsx`

**Funcao geral do arquivo**

Pagina "Esta Semana", exibindo tarefas por dia, tarefas sem dia e placement de recorrentes.

**Funcao geral da alteracao**

Adiciona formulario de criacao semanal, abertura do `TaskDetailPanel`, gate por `closed`/arquivo e refetch apos criacao.

**Blocos principais**

- Linhas 1-18: novos imports de `FormEvent`, MUI controls, `AddIcon`, hook de criacao, `TaskDetailPanel` e `findTaskById`.
- Linhas 20-33: `formatDaySelectLabel` monta rotulos como `SEG 13`.
- Linhas 35-46: estados de titulo, dia selecionado e task aberta.
- Linhas 73-77: calcula tarefa aberta, se e subtarefa, e `onOpenDetail` somente para periodo corrente aberto.
- Linhas 78-100: `handleSubmit` valida titulo, chama `createWeeklyTask.mutate`, refaz query ativa e limpa formulario.
- Linhas 129-167: `TaskRow` recebe `onOpenDetail` em mobile, desktop e sem dia.
- Linhas 170-233: formulario de criacao e recorrentes aparecem apenas quando `!isArchiveView && !closed`.
- Linhas 234-239: renderiza `TaskDetailPanel`.

**Funcoes, classes e importacoes especificas**

- `formatDaySelectLabel`: espera ISO date; retorna label pt-BR uppercase.
- `handleSubmit`: impede submit vazio e envia `scheduledDate` opcional.
- `findTaskById`: busca a task na arvore para popular o painel.
- `useCreateWeeklyTaskMutation`: cria task no endpoint semanal.

**Comportamento de libs usadas**

- React `useState` controla formulario e painel.
- React Router `useParams` distingue arquivo por rota com `weekStart`.
- MUI `Select`, `MenuItem`, `TextField`, `Button` compõem formulario acessivel.
- `Intl.DateTimeFormat(...).formatToParts` retorna partes localizadas de data.

### `frontend/src/pages/planner/MonthlyPage.tsx`

**Funcao geral do arquivo**

Pagina "Este Mes", exibindo tarefas por data, tarefas sem data e placement de recorrentes mensais.

**Funcao geral da alteracao**

Reusa `TaskDetailPanel` para edicao/exclusao, bloqueia form quando `closed: true` mesmo na rota corrente, e passa `onOpenDetail` para todas as `TaskRow`.

**Blocos principais**

- Linhas 16-19: importa `TaskDetailPanel` e `findTaskById`.
- Linhas 60-63: estado de task aberta.
- Linhas 92-95: resolve task aberta e desliga abertura em arquivo/ciclo fechado.
- Linhas 101-124: tarefas sem data recebem `onOpenDetail`.
- Linhas 168-184: tarefas agrupadas por data recebem `onOpenDetail`.
- Linhas 190-246: form de criacao e recorrentes aparecem apenas quando `!isArchiveView && !closed`.
- Linhas 247-252: renderiza `TaskDetailPanel`.

**Funcoes, classes e importacoes especificas**

- `groupTasksByScheduledDate`: organiza tarefas em `withDate` e `withoutDate`.
- `handleSubmit`: ja existia para criacao mensal; agora fica protegido por `closed`.
- `handleConfirmScheduledDate`: continua atualizando data de itens sem dia.
- `findTaskById`: resolve tambem subtarefas para o painel.

**Comportamento de libs usadas**

- MUI `Box`, `TextField`, `Button` formam layout e inputs.
- React Query hook mensal faz `refetch` direto porque a query ativa usa sentinel de periodo corrente.

### `frontend/src/features/bujo/components/TaskDetailPanel.tsx`

**Funcao geral do arquivo**

Drawer compartilhado para editar titulo, descricao, categoria, Eisenhower e subtarefas de uma task.

**Funcao geral da alteracao**

Adiciona botao de exclusao/cancelamento para tarefas raiz, usando a regra visual derivada de status e linhagem.

**Blocos principais**

- Linhas 1-16: importa `Button` e `useDeleteTaskMutation`.
- Linhas 40-52: instancia mutation de delete e calcula `hasLineage`/`willHardDelete`.
- Linhas 76-151: campos editaveis continuam chamando `useUpdateTaskMutation`.
- Linhas 153-172: subtarefas permanecem disponiveis so em task raiz.
- Linhas 175-182: botao chama `deleteTask.mutate` e fecha o painel no sucesso; label alterna entre `Excluir tarefa` e `Cancelar tarefa`.

**Funcoes, classes e importacoes especificas**

- `useDeleteTaskMutation`: hook que executa DELETE e invalida caches.
- `willHardDelete`: booleano local que espelha regra de backend para label.
- `AddTaskRow`: componente de criacao de subtarefa reaproveitado.

**Comportamento de libs usadas**

- MUI `Drawer` monta painel lateral/bottom sheet.
- MUI `Select` emite valores por `event.target.value`; o codigo converte para enums TypeScript.

## 6. Testes de backend

### `backend/bujo/tests/test_services.py`

**Funcao geral do arquivo**

Testa regras de servico BuJo com pytest e banco Django.

**Funcao geral da alteracao**

Adiciona cobertura para `delete_task` e para guardrail de ciclo fechado em create/update/delete.

**Blocos principais**

- Linhas 15-29: imports adicionam `delete_task` e `ClosedCycleReadOnly`.
- Linhas 156-227: casos de `delete_task`: hard delete, cancelamento por linhagem, cancelamento de nao-pending, erro em estado terminal, ciclo fechado e tenant scope.
- Linhas 229-280: create/update em `WeeklyLog`/`MonthlyLog` fechado levantam `ClosedCycleReadOnly`.

**Funcoes, classes e importacoes especificas**

- `pytest.mark.django_db`: habilita acesso ao banco.
- `tenant_context`: define tenant corrente para manager auto-escopado.
- `TaskFactory`, `WeeklyLogFactory`, `MonthlyLogFactory`: montam cenarios persistidos.
- `pytest.raises`: confirma excecoes esperadas.

**Comportamento de libs usadas**

- pytest parametriza status com `@pytest.mark.parametrize`.
- Django ORM `Task.objects.filter(...).exists()` verifica hard delete real.

### `backend/bujo/tests/test_views.py`

**Funcao geral do arquivo**

Testa endpoints DRF da feature BuJo.

**Funcao geral da alteracao**

Adiciona testes para POST semanal, DELETE de task e regressao do guardrail em endpoints existentes.

**Blocos principais**

- Linhas 554-622: `POST /api/bujo/logs/weekly/` cria sem dia, cria com dia, rejeita data fora da semana, rejeita semana nao segunda, preserva tenant e retorna 409 em ciclo fechado.
- Linhas 625-674: `DELETE /api/bujo/tasks/{id}/` retorna 204 para hard delete, 200 com `cancelled` para linhagem, 404 cross-tenant e 409 em ciclo fechado.
- Linhas 677-706: subtask create e monthly create em ciclo fechado retornam 409.

**Funcoes, classes e importacoes especificas**

- `auth_client.post/delete`: cliente DRF autenticado.
- `get_or_create_weekly_log`/`get_or_create_monthly_log`: montam containers reais.
- `week_start_of`, `today_for`: calculam datas conforme regra do backend.

**Comportamento de libs usadas**

- DRF test client serializa JSON com `format="json"` e disponibiliza `response.data`.

## 7. Testes do frontend unitario/componente

### `frontend/src/features/bujo/api.test.tsx`

**Funcao geral do arquivo**

Testa hooks da camada de dados BuJo com React Testing Library e Vitest.

**Funcao geral da alteracao**

Mocka `client.delete`, testa invalidacao semanal em update, criacao semanal e delete/cancelamento.

**Blocos principais**

- Linhas 4-22: mock do cliente ganha `delete`; imports ganham novos hooks.
- Linhas 350-368: `useUpdateTaskMutation` invalida `weeklyLog`.
- Linhas 493-523: `useCreateWeeklyTaskMutation` envia payload e invalida weekly/taskDensity.
- Linhas 525-580: `useDeleteTaskMutation` trata 204 como `null`, 200 como `Task` e invalida caches.

**Funcoes, classes e importacoes especificas**

- `renderHook`: monta hook isolado.
- `QueryClientProvider`: fornece cache React Query aos hooks.
- `vi.fn`, `vi.spyOn`: mocks e spies do Vitest.

**Comportamento de libs usadas**

- `waitFor` aguarda estado assíncrono `isSuccess`.
- React Query `QueryClient` permite verificar chamadas de invalidacao.

### `frontend/src/features/bujo/components/TaskDetailPanel.test.tsx`

**Funcao geral do arquivo**

Testa comportamento do drawer de detalhe de task.

**Funcao geral da alteracao**

Mocka delete mutation e cobre labels/acao do novo botao.

**Blocos principais**

- Linhas 8-15: `mockDeleteMutate` e mock de `useDeleteTaskMutation`.
- Linhas 136-185: labels `Excluir tarefa`/`Cancelar tarefa`, acionamento de mutation, fechamento no sucesso e ausencia do botao em subtarefa.

**Funcoes, classes e importacoes especificas**

- `baseTask`: factory local de objeto `Task`.
- `fireEvent.click`: simula clique no botao.
- `screen.getByRole/queryByRole`: consultas acessiveis.

**Comportamento de libs usadas**

- Testing Library testa a UI pelo papel/nome acessivel, reduzindo acoplamento ao DOM interno.

### `frontend/src/pages/planner/WeeklyPage.test.tsx`

**Funcao geral do arquivo**

Testa a pagina semanal com mocks de hooks/API.

**Funcao geral da alteracao**

Adiciona testes de formulario semanal, gates `closed`/arquivo e abertura do `TaskDetailPanel`.

**Blocos principais**

- Linhas 20-27: mock do cliente ganha `delete`.
- Linhas 140-158: ajustes de seletor para desambiguar `Sem dia definido`.
- Linhas 346-423: formulario cria com dia, sem dia, nao submete vazio e some em `closed`/arquivo.
- Linhas 425-462: clique em `TaskRow` abre painel apenas quando periodo esta editavel.

**Funcoes, classes e importacoes especificas**

- `mockUseWeeklyLogQuery`: controla retorno da query.
- `mockPost`: confirma payload enviado ao hook.
- `mockMatchMedia`: simula viewport.

**Comportamento de libs usadas**

- MUI Select exige `mouseDown` no combobox e clique na `option`.

### `frontend/src/pages/planner/MonthlyPage.test.tsx`

**Funcao geral do arquivo**

Testa a pagina mensal com mocks de hooks/API.

**Funcao geral da alteracao**

Cobre o novo gate `closed` no periodo corrente e abertura/bloqueio do painel de detalhe.

**Blocos principais**

- Linhas 26-30: mock do cliente ganha `delete`.
- Linhas 499-510: form de criacao some quando `closed: true` no periodo corrente.
- Linhas 513-555: `TaskRow` abre painel quando editavel e nao abre em arquivo/ciclo fechado.

**Funcoes, classes e importacoes especificas**

- `renderMonthlyPage`/`renderMonthlyPageAtArchiveRoute`: helpers de rota.
- `mockUseMonthlyLogQuery`: controla dados da pagina.

**Comportamento de libs usadas**

- `vi.useFakeTimers`/`vi.setSystemTime` fixam o mes corrente em testes dependentes de data.

## 8. Testes E2E e seeds

### `frontend/e2e/seedClosedCycleScenario.ts`

**Funcao geral do arquivo**

Helper E2E para criar cenarios diretamente no backend real via `manage.py shell`.

**Funcao geral da alteracao**

Arquivo novo com seeds para ciclo corrente fechado e task semanal com linhagem.

**Blocos principais**

- Linhas 1-13: imports Node e calculo de `backendDir`.
- Linhas 20-64: `seedClosedCycleScenario` cria `WeeklyLog`/`MonthlyLog` correntes com task `completed`.
- Linhas 69-96: `seedWeeklyTaskWithLineage` cria task semanal `pending` com `migration_count=2`.

**Funcoes, classes e importacoes especificas**

- `execFileSync`: executa `uv run python manage.py shell -c`.
- `DJANGO_SETTINGS_MODULE`: garante ambiente E2E.
- `JSON.stringify`: injeta strings no script Python com escape seguro.

**Comportamento de libs usadas**

- Node `path.resolve` e `fileURLToPath` calculam caminho portavel do backend.
- `execFileSync` espera processo terminar e retorna stdout; o helper parseia a ultima linha JSON.

### `frontend/e2e/weekly-monthly-task-crud.spec.ts`

**Funcao geral do arquivo**

Spec Playwright E2E da Story 11.5 contra backend real.

**Funcao geral da alteracao**

Arquivo novo cobrindo AC1-AC4 em fluxos de usuario completos.

**Blocos principais**

- Linhas 1-10: imports e comentario de escopo.
- Linhas 12-60: cria task semanal com dia e sem dia, valida POST e ausencia de erro de console.
- Linhas 62-79: cria task mensal.
- Linhas 81-125: edita titulo/eisenhower via painel em Semana e Mes.
- Linhas 127-157: hard delete de task `pending` sem linhagem retorna 204 e remove linha.
- Linhas 159-192: task com linhagem retorna 200, vira cancelada e permanece na lista.
- Linhas 194-223: ciclo corrente fechado esconde forms e clique para editar.

**Funcoes, classes e importacoes especificas**

- `test`, `expect`, `detailPanel`: fixtures Playwright do projeto.
- `seedClosedCycleScenario`: prepara ciclo fechado corrente.
- `seedWeeklyTaskWithLineage`: prepara caso de cancelamento em vez de hard delete.

**Comportamento de libs usadas**

- Playwright `page.getByRole/getByLabel/getByTestId` usa locators acessiveis/estaveis.
- `page.waitForResponse` sincroniza com chamadas HTTP reais sem sleeps.
- `page.on('console')` e `page.on('pageerror')` coletam erros de runtime para assercao final.

## 9. Contratos consumidos e validacao cruzada

### Relacao produtor-consumidor

- `backend/bujo/serializers.py` e `backend/bujo/views.py` produzem os endpoints que aparecem em `schema.yaml`.
- `schema.yaml` produz `frontend/src/api/types.gen.ts`.
- `frontend/src/features/bujo/api.ts` consome os endpoints novos e expõe hooks.
- `frontend/src/features/bujo/index.ts` disponibiliza esses hooks para paginas.
- `WeeklyPage.tsx`, `MonthlyPage.tsx` e `TaskDetailPanel.tsx` consomem os hooks e expõem os fluxos.
- Testes de backend validam regra isolada; testes de frontend validam wiring de UI/hook; E2E valida o fluxo integrado.

### Observacao de risco ja registrada

O resumo de testes registra um achado fora do escopo: `TaskDetailPanel` mostra botao de excluir/cancelar para estados terminais em tarefas raiz. O backend recusa com 409 via `InvalidTransition`, mas a UI ainda nao comunica esse erro. Isso foi documentado para revisao futura; nao bloqueia a explicacao dos arquivos nao commitados.
