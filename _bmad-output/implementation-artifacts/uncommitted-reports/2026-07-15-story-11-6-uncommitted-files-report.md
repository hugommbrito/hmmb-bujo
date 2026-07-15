# Explicacao dos arquivos nao commitados - Story 11.6 mover/migrar tarefa de qualquer superficie

## Visao geral

O conjunto de mudancas implementa a Story 11.6: uma tarefa raiz pode ser movida a partir de qualquer superficie principal do BuJo para um dia especifico, para o mes corrente ou para o futuro. O backend estende o caminho ja existente de migracao para que `destination="week"` aceite `scheduled_date` e deduza a semana de destino pela data. O frontend adiciona o `TaskDestinationDialog`, fia o botao "Mover tarefa" em `TaskRow` e `TaskDetailPanel`, evita colisao semantica com o antigo botao de reorder ao renomea-lo para "Reordenar tarefa", e invalida a densidade de tarefas apos migracoes. A cobertura adicionada inclui testes de servico, API HTTP, hooks, componentes, paginas e um spec Playwright ponta-a-ponta.

## Ordem logica de funcionamento

1. A story e os artefatos de orquestracao registram o escopo, status e verificacoes da Story 11.6.
2. `migrate_task` cria a capacidade backend: destino `"week"` passa a usar `scheduled_date` quando presente.
3. Testes backend validam a regra de servico, a view HTTP e o guardrail de ciclo fechado.
4. Helpers do `MigrationCard` sao exportados para reuso no novo dialogo.
5. `useMigrateTaskMutation` passa a invalidar tambem `taskDensity`, consumido pelo calendario de densidade.
6. `TaskDestinationDialog` oferece as abas Dia / Este mes / Futuro e chama a mutation com payloads adequados.
7. `TaskRow` e `TaskDetailPanel` expõem o dialogo nas superficies reais.
8. Testes de componentes e paginas cobrem disponibilidade, disable por status, ausencia em subtarefas, fechamento correto e labels.
9. O spec E2E valida os fluxos reais entre Daily Log, Esta Semana, Este Mes, Futuro e painel de detalhe.

## 1. Artefatos de planejamento, status e QA

### `_bmad-output/implementation-artifacts/11-6-mover-migrar-tarefa-de-qualquer-superficie.md`

**Funcao geral do arquivo**

Artefato de implementacao da Story 11.6. E documento de planejamento/execucao, nao codigo fonte. Serve como contrato humano da story, checklist de tasks, referencias tecnicas, registro do agente de desenvolvimento, revisao senior e changelog.

**Funcao geral da alteracao**

Arquivo novo que descreve a story como concluida e documenta que nao houve mudanca de contrato OpenAPI nem migracao de banco. Ele tambem registra que a revisao corrigiu um bug no fechamento do painel de detalhe e uma docstring enganosa no backend.

**Blocos principais**

- Linhas 5-49: definem story e ACs. AC4 e o ponto central do backend: `destination="week"` passa a aceitar `scheduled_date` opcional e deduzir `week_start_of(scheduled_date)`.
- Linhas 55-78: tasks backend. Especificam a alteracao cirurgica em `migration.py`, confirmam que serializer/view ja repassavam `scheduled_date`, e listam testes de servico/view.
- Linhas 79-148: tasks frontend. Introduzem `TaskDestinationDialog`, export de helpers do `MigrationCard`, fiação em `TaskRow`/`TaskDetailPanel` e invalidacao de `taskDensity`.
- Linhas 151-188: plano de testes unitarios, pagina e E2E.
- Linhas 242-288: Dev Agent Record e File List. Mapeia todos os arquivos tocados por camada.
- Linhas 289-308: revisao senior e changelog. Registra o bug HIGH corrigido com separacao de `onClose` e `onSuccess`.

**Funcoes, classes e importacoes especificas**

- Nao define simbolos executaveis. O simbolo conceitual mais importante e `TaskDestinationDialog`, especificado como novo componente autocontido.

**Comportamento de libs usadas**

- Nao usa libs diretamente. O documento referencia Django/DRF, React/MUI, TanStack Query, Vitest, jest-axe e Playwright como stack de validacao.

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Funcao geral do arquivo**

Artefato de acompanhamento do sprint, usado para marcar o estado das stories por epic.

**Funcao geral da alteracao**

Atualiza a Story 11.6 de `backlog` para `done` e muda o comentario de `last_updated` para indicar conclusao via `story-automator-review`.

**Blocos principais**

- Linhas 35-38: `last_updated` passa de "story 11.5 done" para "story 11.6 done".
- Linhas 80-86: `11-6-mover-migrar-tarefa-de-qualquer-superficie` muda de `backlog` para `done`.

**Funcoes, classes e importacoes especificas**

- Nao ha funcoes. As chaves YAML `development_status` e `last_updated` sao consumiveis por ferramentas BMAD de status.

**Comportamento de libs usadas**

- YAML e formato de dados. Ferramentas que leem este arquivo esperam pares chave-valor e preservacao de indentacao.

### `_bmad-output/story-automator/orchestration-11-20260714-185946.md`

**Funcao geral do arquivo**

Registro de orquestracao do automator para o Epic 11. Mantem story corrente, etapas, tabela de progresso e timeline.

**Funcao geral da alteracao**

Avanca a orquestracao de 11.5 para 11.6, marca 11.5 como concluida em todos os passos, marca 11.6 como em progresso/concluida nos passos relevantes e adiciona eventos de timeline ate a aprovacao da review.

**Blocos principais**

- Linhas 4-11: `currentStory` muda para `11.6`, `currentStep` fica em `step-03b-execute-finish` e `lastUpdated` vai para `2026-07-15T13:45:36Z`.
- Linhas 58-62: tabela de stories muda 11.5 para `done` completo e 11.6 para `done` nos passos executados.
- Linhas 119-128: timeline adiciona commit de 11.5, inicio de 11.6, review gate, dev-story, automacao e code-review aprovado.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos executaveis.

**Comportamento de libs usadas**

- Markdown com frontmatter. O automator provavelmente consome campos YAML do cabecalho e tabelas como estado humano/maquina.

### `_bmad-output/implementation-artifacts/tests/test-summary.md`

**Funcao geral do arquivo**

Historico agregado de resumos de testes e QA por story.

**Funcao geral da alteracao**

Acrescenta o resumo de automacao da Story 11.6, declarando que nao foram encontrados gaps de cobertura e listando verificacoes executadas ou herdadas.

**Blocos principais**

- Linhas 1569-1582: cabecalho da Story 11.6, frameworks usados e contexto da revisao.
- Linhas 1584-1597: gaps descobertos. Declara nenhum gap e explica a nota sobre tarefas migradas nao desaparecerem das views de origem.
- Linhas 1599-1604: verificacao executada. Registra backend 230 passed no escopo, frontend 133 passed no escopo e E2E nao reexecutado nesta rodada.
- Linhas 1606-1619: matriz AC -> cobertura.
- Linhas 1623-1634: checklist de validacao.
- Linhas 1636-1640: proximos passos, com recomendacao de reexecutar E2E quando a branch Neon `e2e` estiver disponivel.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos executaveis.

**Comportamento de libs usadas**

- `pytest-django`, DRF `APIClient`, Vitest, Testing Library, jest-axe e Playwright sao citados como ferramentas de validacao. Cada uma entrega sinais complementares: unidade/servico, contrato HTTP, renderizacao React, acessibilidade e fluxo real no navegador.

## 2. Backend: servico de migracao

### `backend/bujo/services/migration.py`

**Funcao geral do arquivo**

Modulo de dominio para migracao diaria/semanal/mensal de tarefas. Reaproveita `create_task`, `transition_task` e `set_lineage_fields` para mover uma tarefa e sua subarvore pendente/started sem duplicar regras de ordem, transicao e linhagem.

**Funcao geral da alteracao**

Estende apenas o branch `"week"` de `migrate_task`: quando `scheduled_date` e informado, o weekly log de destino passa a ser `week_start_of(scheduled_date)` e a tarefa nova nasce com esse `scheduled_date`; quando ausente, o comportamento antigo de semana corrente continua.

**Blocos principais**

- Linhas 8-18: importam transacao, modelo `Task`, factories de logs, state machine, helpers de tarefas e calendario.
- Linhas 21-54: `_migrate_subtree` transiciona a origem, cria a tarefa no novo container, atualiza linhagem e migra recursivamente apenas filhos `pending`/`started`.
- Linhas 57-75: `migrate_task` e sua docstring. A docstring agora explica que `week` com `scheduled_date` cria o novo registro com esse dia, sem alterar a origem alem do status.
- Linhas 81-91: branch alterado. `week_start` passa a ser `week_start_of(scheduled_date)` se existir, senao `week_start_of(today_for(user))`; `root_scheduled_date` recebe `scheduled_date`.
- Linhas 97-106: chama `_migrate_subtree` e recarrega a origem do banco para retornar status e `migrated_to_task` atualizados.

**Funcoes, classes e importacoes especificas**

- `migrate_task`: API de dominio chamada pela view de migracao. Espera `user`, `task_id`, `destination` e opcionais `month_first`/`scheduled_date`; retorna a `Task` de origem recarregada.
- `_migrate_subtree`: helper recursivo interno. Espera a task fonte, container de destino e status final da origem; retorna a nova task criada no destino.
- `Task.Status.MIGRATED` / `Task.Status.POSTPONED`: estados terminais usados para origem conforme destino.
- `transition_task`: aplica a matriz de transicao permitida antes de criar o destino.
- `create_task`: cria a tarefa no container e aciona guardrails de ciclo fechado.
- `set_lineage_fields`: atualiza `migration_count` e `migrated_to_task`.

**Comportamento de libs usadas**

- `django.db.transaction.atomic`: executa a migracao inteira em transacao; se transicao, criacao ou guardrail falhar, evita persistencia parcial.
- Django ORM (`Task.objects.get`, queryset `source.subtasks.filter`): espera filtros por campos/modelos e retorna instancias modeladas; o filtro por status restringe a subarvore migrada.
- `week_start_of`: recebe uma data e retorna o inicio da semana correspondente. E usado para transformar um dia especifico em container semanal.
- `today_for`: calcula o "hoje" no contexto do usuario, preservando comportamento anterior quando `scheduled_date` nao vem do cliente.

## 3. Backend: testes de servico e HTTP

### `backend/bujo/tests/test_services.py`

**Funcao geral do arquivo**

Suite pytest de servicos de dominio do app BuJo, cobrindo criacao, transicao, migracao, reviews e regras de ciclo.

**Funcao geral da alteracao**

Adiciona dois testes de servico para provar que `migrate_task(destination="week", scheduled_date=...)` deduz a semana correta tanto para datas futuras quanto passadas, sem regredir o teste existente de semana corrente sem data.

**Blocos principais**

- Linhas 626-642: teste pre-existente de destino `week` sem `scheduled_date`; continua provando semana corrente e `scheduled_date` ausente.
- Linhas 645-666: novo teste com `scheduled_date` tres semanas no futuro. Verifica `result.status == MIGRATED`, weekly log de destino diferente do corrente e `new_task.scheduled_date`.
- Linhas 669-692: novo teste com `scheduled_date` duas semanas no passado. Verifica deducao de semana anterior e que o container nao fica fechado apos a migracao.

**Funcoes, classes e importacoes especificas**

- `tenant_context(user)`: executa operacoes no schema/tenant do usuario.
- `LogFactory`, `TaskFactory`: criam fixtures de log/task no banco de teste.
- `get_or_create_weekly_log`: cria ou retorna o weekly log da semana esperada.
- `is_container_closed`: verifica se o container semanal esta fechado para escrita.

**Comportamento de libs usadas**

- `pytest.mark.django_db`: permite acesso transacional ao banco durante o teste.
- `timedelta`: soma/subtrai semanas para gerar datas de destino controladas.
- Factories de teste esperam parametros de modelo e retornam instancias persistidas.

### `backend/bujo/tests/test_views.py`

**Funcao geral do arquivo**

Suite pytest das views/API do BuJo. Valida contratos HTTP, serializacao, status codes e efeitos no banco.

**Funcao geral da alteracao**

Adiciona cobertura HTTP para `POST /api/bujo/tasks/{id}/migrate/` com `destination="week"` e `scheduledDate`, alem de provar que migrar para uma semana fechada retorna 409 sem mudar o contrato de erro.

**Blocos principais**

- Linhas 1172-1192: teste pre-existente de migracao para weekly log corrente sem `scheduledDate`.
- Linhas 1195-1218: novo teste de `scheduledDate` futuro. Envia payload JSON com `scheduledDate`, espera 200, origem `migrated`, destino no weekly log da data e `scheduled_date` preservado na nova task.
- Linhas 1221-1241: novo teste de guardrail. Cria weekly log passado fechado por task completed, tenta migrar para la, espera HTTP 409 e ausencia de `fields`.

**Funcoes, classes e importacoes especificas**

- `auth_client.post`: cliente DRF autenticado usado para exercitar a API real.
- `WeeklyLogFactory`, `TaskFactory`: montam cenario de origem/destino.
- `week_start_of(today_for(user))`: gera semanas relativas ao usuario.

**Comportamento de libs usadas**

- DRF test client `post(..., format="json")`: serializa o payload como JSON e popula `response.data` com a resposta parseada.
- `pytest-django`: isola estado de banco por teste e permite assertions apos `refresh_from_db`.

## 4. Frontend: helpers, hook de API e cache

### `frontend/src/features/bujo/components/MigrationCard.tsx`

**Funcao geral do arquivo**

Componente do fluxo de migracao ja existente, que apresenta uma tarefa pendente e permite decidir destino: hoje/semana, mes corrente, futuro ou cancelar.

**Funcao geral da alteracao**

Exporta `currentMonthBounds` e `currentMonthLabel` para que o novo `TaskDestinationDialog` reaproveite a mesma logica de bounds/rotulo do mes corrente, em vez de duplicar regras de UI.

**Blocos principais**

- Linhas 24-30: comentario explica que o calculo e apenas de UI e justifica os exports com disable pontual de `react-refresh/only-export-components`.
- Linhas 30-37: `currentMonthBounds` retorna `min` e `max` no formato `YYYY-MM-DD` para o mes local atual.
- Linhas 39-42: `currentMonthLabel` retorna o nome do mes corrente em portugues.
- Linhas 44-80: `MigrationCard` continua consumindo `currentMonthBounds` internamente; a mudanca nao altera seu comportamento visual.

**Funcoes, classes e importacoes especificas**

- `currentMonthBounds`: usado pelo proprio `MigrationCard` e por `TaskDestinationDialog` para configurar `<input type="date">`.
- `currentMonthLabel`: segue exportado para reuso, embora a mudanca observada no dialogo use apenas `currentMonthBounds`.
- `MONTH_NAMES_PT`: array de nomes de meses usado para labels localizados.

**Comportamento de libs usadas**

- React hooks `useRef`/`useState`: mantem estado local de dia futuro e referencias de botoes do card.
- MUI `TextField` espera `slotProps.htmlInput` para props nativas como `min` e `max`.
- ESLint `react-refresh/only-export-components` normalmente recomenda arquivos com exports apenas de componentes para Fast Refresh; o disable pontual aceita helpers pequenos no mesmo modulo.

### `frontend/src/features/bujo/api.ts`

**Funcao geral do arquivo**

Camada de dados frontend da feature BuJo. Define tipos, funcoes HTTP e hooks TanStack Query/Mutation para logs, filas, tarefas, migracoes e recorrencias.

**Funcao geral da alteracao**

No `useMigrateTaskMutation`, adiciona invalidacao de `['bujo', 'taskDensity']` apos sucesso, para que o calendario de densidade reflita migracoes feitas pelo novo fluxo.

**Blocos principais**

- Linhas 351-358: `MigrationDestination` e `MigrateTaskVariables` definem o payload aceito por `migrateTask`.
- Linhas 360-362: `migrateTask` faz `POST /api/bujo/tasks/{taskId}/migrate/` com os campos restantes.
- Linhas 365-381: `useMigrateTaskMutation` usa `useMutation` e invalida filas/logs apos sucesso; linha 380 adiciona a invalidacao de densidade.

**Funcoes, classes e importacoes especificas**

- `useMigrateTaskMutation`: hook consumido por `MigrationFlow`, `MigrationCard` indiretamente e agora `TaskDestinationDialog`.
- `MigrationDestination`: inclui `'today' | 'week' | 'month' | 'future' | 'cancel'`.
- `keys.bujo.*`: factories de query keys para filas e logs principais.

**Comportamento de libs usadas**

- TanStack Query `useMutation`: espera uma `mutationFn` e callbacks como `onSuccess`; retorna `mutate`, `isError`, `isSuccess` etc.
- TanStack Query `queryClient.invalidateQueries`: marca queries matching como stale e permite refetch; com query key prefixada como `['bujo', 'taskDensity']`, todas as variantes de mes da densidade podem ser invalidadas.
- Cliente HTTP (`client.post`) espera URL e payload e retorna `response.data` tipado como `Task`.

### `frontend/src/features/bujo/api.test.tsx`

**Funcao geral do arquivo**

Suite Vitest dos hooks/funcoes da camada API BuJo, com mock do cliente HTTP e `QueryClient` controlado.

**Funcao geral da alteracao**

Atualiza o teste de `useMigrateTaskMutation` para exigir invalidacao de `taskDensity`.

**Blocos principais**

- Linhas 607-621: executa mutation `destination='today'` e valida payload HTTP.
- Linhas 622-630: valida todas as invalidacoes esperadas; a linha 630 e a nova assercao de `['bujo', 'taskDensity']`.

**Funcoes, classes e importacoes especificas**

- `renderHook`: renderiza hook isolado com wrapper de `QueryClientProvider`.
- `mockPost`: substitui o cliente HTTP.
- `invalidateSpy`: observa chamadas a `queryClient.invalidateQueries`.

**Comportamento de libs usadas**

- Vitest `vi.spyOn`: intercepta metodo real e preserva chamadas para assertions.
- Testing Library `waitFor`: aguarda a mutation entrar em estado `isSuccess`.

## 5. Frontend: novo seletor de destino

### `frontend/src/features/bujo/components/TaskDestinationDialog.tsx`

**Funcao geral do arquivo**

Novo componente fonte da Story 11.6. Renderiza um dialogo MUI para mover uma tarefa raiz para um dia, para o mes corrente ou para o futuro, usando hooks de API internamente.

**Funcao geral da alteracao**

Arquivo novo. Concentra a UI e a logica de payload da acao "Mover tarefa" consumida por `TaskRow` e `TaskDetailPanel`.

**Blocos principais**

- Linhas 1-20: importam React, componentes MUI, icones de navegacao, hooks de API, helper de mes, calendario de densidade, nomes de meses e tipo `Task`.
- Linhas 22-31: props. `onClose` fecha dialogo; `onSuccess` e opcional e dispara apenas apos sucesso da mutation.
- Linhas 33-42: tipo `DestinationMode` e helper `currentMonthFirst`.
- Linhas 47-56: estado local (`mode`, `calendarMonthFirst`, `futureDay`), hook `useMigrateTaskMutation`, bounds do mes e `useTaskDensityQuery` habilitado apenas quando aberto na aba Dia.
- Linhas 59-74: helpers internos para sucesso, troca de aba e navegacao de mes.
- Linhas 76-83: `handleThisMonthChange` envia `{ destination: 'month', scheduledDate }`.
- Linhas 85-93: `handleFutureMonthChange` monta `monthFirst` e `scheduledDate` opcional para `{ destination: 'future' }`.
- Linhas 95-123: estrutura do `Dialog`, titulo, resumo da tarefa, descricao, subtarefas e tabs.
- Linhas 125-151: aba Dia. Renderiza botoes de mes anterior/proximo e `MonthDensityCalendar`; clicar num dia envia `{ destination: 'week', scheduledDate: iso }`.
- Linhas 152-161: aba Este mes. `TextField type="date"` com `min`/`max`.
- Linhas 162-181: aba Futuro. Campo de dia opcional e campo `type="month"`.
- Linhas 184-188: mensagem inline quando `migrate.isError`.
- Linhas 190-192: botao Cancelar chama apenas `onClose`.

**Funcoes, classes e importacoes especificas**

- `TaskDestinationDialog`: componente exportado.
- `handleMoveSuccess`: chama `onClose()` e depois `onSuccess?.()`, separando cancelamento de sucesso.
- `shiftCalendarMonth`: calcula o primeiro dia do mes anterior/proximo.
- `useMigrateTaskMutation`: envia migracoes.
- `useTaskDensityQuery`: busca densidade de tarefas por data para o calendario.
- `MonthDensityCalendar`: recebe `monthFirst`, `densityByDate` e `onSelectDay`.

**Comportamento de libs usadas**

- MUI `Dialog`: espera `open` e `onClose`; dispara `onClose` em botao/backdrop/Esc quando conectado.
- MUI `Tabs`/`Tab`: controlados por `value` e `onChange`; `onChange` entrega o novo `value`.
- MUI `TextField`: para `type="date"`/`type="month"` entrega `event.target.value` em formato ISO parcial (`YYYY-MM-DD` ou `YYYY-MM`).
- TanStack Query hook com `enabled`: evita fetch quando o dialogo esta fechado ou fora da aba Dia.
- JavaScript `Map`: transforma array de densidade em lookup por data para o calendario.

## 6. Frontend: superficies que consomem o dialogo

### `frontend/src/features/bujo/components/TaskRow.tsx`

**Funcao geral do arquivo**

Componente de linha de tarefa, usado em Daily Log, Weekly, Monthly, Future e subtarefas. Exibe status, titulo, chips, acoes de reorder e recursao de subtarefas.

**Funcao geral da alteracao**

Adiciona o botao "Mover tarefa" para tarefas raiz, abre `TaskDestinationDialog`, desabilita a acao para estados terminais e impede a acao em subtarefas. Tambem renomeia o antigo botao de reorder de "Mover tarefa" para "Reordenar tarefa".

**Blocos principais**

- Linhas 1-14: adicionam `DriveFileMoveOutlinedIcon` e `TaskDestinationDialog`.
- Linhas 57-67: `TaskRowProps` ganha `isSubtask?: boolean`.
- Linhas 69-82: destructuring com default `isSubtask=false` e novo estado `destinationDialogOpen`.
- Linhas 270-280: novo `IconButton` "Mover tarefa", visivel apenas quando `!isSubtask`, desabilitado se status nao for `pending` nem `started`.
- Linhas 281-294: bloco antigo de reorder permanece, mas o `aria-label` vira "Reordenar tarefa".
- Linhas 304-315: `MoveTaskDialog` de reorder continua igual.
- Linhas 316-322: renderiza `TaskDestinationDialog` para tarefas raiz.
- Linhas 323-333: chamada recursiva de subtarefas passa `isSubtask`, impedindo botao de mover em filhos.

**Funcoes, classes e importacoes especificas**

- `TaskRow`: componente raiz.
- `STATUS_ICON` / `STATUS_LABEL`: mapeiam estados para icones e labels acessiveis.
- `NEXT_STATUS`: controla ciclo de status por clique; permanece separado de migracao.
- `handleStatusClick`, `handleDragStart`, `handleDrop`, `handleTouchStart`: logica pre-existente de status/reorder preservada.
- `TaskDestinationDialog`: recebe apenas `task`, `open` e `onClose` nesta superficie; nao ha `onSuccess` externo a disparar.

**Comportamento de libs usadas**

- MUI `useMediaQuery`: adapta reorder por desktop/mobile.
- MUI `IconButton`: `aria-label` define nome acessivel usado por testes e leitores de tela; `disabled` bloqueia clique e comunica estado.
- MUI icons: `DriveFileMoveOutlinedIcon` comunica acao de mover destino; `MoreVertIcon` continua representando menu/reorder.
- React `useState` controla dois dialogos independentes (`MoveTaskDialog` e `TaskDestinationDialog`).

### `frontend/src/features/bujo/components/TaskDetailPanel.tsx`

**Funcao geral do arquivo**

Painel lateral/inferior de detalhe da tarefa. Permite editar titulo, descricao, categoria, Eisenhower, subtarefas e excluir/cancelar.

**Funcao geral da alteracao**

Adiciona botao "Mover tarefa" para tarefas raiz, com o mesmo disable por status do `TaskRow`, e renderiza `TaskDestinationDialog`. No sucesso da migracao, fecha tambem o painel; no cancelamento do dialogo, fecha apenas o dialogo.

**Blocos principais**

- Linhas 1-17: adiciona import de `TaskDestinationDialog`.
- Linhas 41-50: novo estado `destinationDialogOpen`.
- Linhas 177-191: cria grupo de botoes com "Mover tarefa" e o botao existente de excluir/cancelar.
- Linhas 193-200: renderiza `TaskDestinationDialog` com `onClose={() => setDestinationDialogOpen(false)}` e `onSuccess={onClose}`.

**Funcoes, classes e importacoes especificas**

- `TaskDetailPanel`: componente de detalhe.
- `useUpdateTaskMutation`, `useCreateSubtaskMutation`, `useDeleteTaskMutation`: hooks pre-existentes para edicao/criacao/exclusao.
- `TaskDestinationDialog`: usado com `onSuccess` para fechar o drawer apenas apos mover com sucesso.

**Comportamento de libs usadas**

- MUI `Drawer`: renderiza painel responsivo com `anchor` controlado por media query.
- MUI `Button`: `disabled` impede acao para estados fora de `pending`/`started`.
- React `useState`: guarda abertura do dialogo independente do drawer.

## 7. Frontend: testes de componentes e paginas

### `frontend/src/features/bujo/components/TaskDestinationDialog.test.tsx`

**Funcao geral do arquivo**

Suite nova do componente `TaskDestinationDialog`. Mocka hooks de API, mas renderiza o componente real.

**Funcao geral da alteracao**

Arquivo novo com testes de UI, payloads da mutation, fechamento, erro inline e acessibilidade.

**Blocos principais**

- Linhas 1-19: imports, mocks de `useMigrateTaskMutation` e `useTaskDensityQuery`.
- Linhas 21-44: factories `baseTask` e `renderDialog`.
- Linhas 47-56: setup padrao dos mocks.
- Linhas 58-69: renderizacao de titulo, descricao e subtarefas.
- Linhas 71-100: aba Dia, densidades e navegacao de mes.
- Linhas 102-151: abas Este mes e Futuro, com payloads `month`/`future`.
- Linhas 153-193: erro, cancelar sem `onSuccess`, sucesso com `onSuccess`.
- Linhas 195-198: varredura `jest-axe`.

**Funcoes, classes e importacoes especificas**

- `mockMigrateMutate`: espia chamadas a `mutate`.
- `mockUseTaskDensityQuery`: controla datas/densidade exibidas no calendario.
- `axe`: valida violacoes basicas de acessibilidade no DOM renderizado.

**Comportamento de libs usadas**

- Vitest `vi.mock`: substitui modulo `../api`.
- Testing Library `render`, `screen`, `fireEvent`: renderiza componente e interage por roles/labels.
- jest-axe `axe(document.body)`: analisa a arvore DOM e retorna resultado usado por matcher `toHaveNoViolations`.

### `frontend/src/features/bujo/components/TaskRow.test.tsx`

**Funcao geral do arquivo**

Suite de `TaskRow`, cobrindo renderizacao, status, readonly, reorder, drag/drop, long press e agora mover destino.

**Funcao geral da alteracao**

Mocka os hooks usados pelo novo dialogo, atualiza assertions do antigo reorder para "Reordenar tarefa" e adiciona bloco de testes para o novo botao "Mover tarefa".

**Blocos principais**

- Linhas 8-16: mock de `useMigrateTaskMutation` e `useTaskDensityQuery`, permitindo renderizar `TaskDestinationDialog` real sem rede.
- Linhas 493-505: testes de reorder atualizados para `aria-label="Reordenar tarefa"`.
- Linhas 509-568: novo describe da Story 11.6. Cobre botao em tarefa raiz, abertura do dialogo, disable para `completed`/`cancelled`/`migrated`/`postponed`, enable para `pending`/`started` e ausencia em subtarefas.

**Funcoes, classes e importacoes especificas**

- `renderTaskRow`: helper de render com tema.
- `renderReorderableTaskRow`: monta props de reorder.
- `makeDragEvent`: cria evento de drag/drop controlado para jsdom.

**Comportamento de libs usadas**

- Testing Library usa nomes acessiveis (`getByRole`) para garantir que labels reais da UI nao colidam.
- Vitest fake timers (`vi.useFakeTimers`) simula long press sem esperar 500ms reais.
- MUI ThemeProvider fornece tokens necessarios para estilos de `TaskRow`.

### `frontend/src/features/bujo/components/TaskDetailPanel.test.tsx`

**Funcao geral do arquivo**

Suite do painel de detalhe, cobrindo edicao, subtarefas, excluir/cancelar e acessibilidade.

**Funcao geral da alteracao**

Adiciona mocks para migration/density, renderiza o `TaskDestinationDialog` real e testa abrir, disable, ausencia em subtarefa, sucesso fechando painel e cancelamento fechando apenas o dialogo.

**Blocos principais**

- Linhas 1-23: adiciona `act`, `waitFor`, `mockMigrateMutate` e mocks dos hooks de migracao/densidade.
- Linhas 189-207: testes de abertura, disable fora de `pending`/`started` e ausencia quando `isSubtask`.
- Linhas 209-230: sucesso da migracao chama payload `destination='month'`, dispara `onSuccess` e fecha dialogo/painel.
- Linhas 232-245: regressao do bug de review; cancelar fecha so o dialogo e nao chama `onClose` do painel.

**Funcoes, classes e importacoes especificas**

- `renderPanel`: helper que injeta `ThemeProvider` e retorna `onClose`.
- `mockMigrateMutate`: permite chamar manualmente `onSuccess` passado para a mutation.
- `waitFor`: aguarda unmount do dialogo apos mudanca de estado.

**Comportamento de libs usadas**

- React Testing Library `act`: envolve callbacks que mudam estado React.
- MUI `Drawer` e `Dialog` portalam elementos; os testes consultam `screen` global para encontrar dialogos fora da subarvore local.

### `frontend/src/pages/daily/DailyPage.test.tsx`

**Funcao geral do arquivo**

Suite da pagina Daily Log.

**Funcao geral da alteracao**

Atualiza o teste de reorder para procurar o novo nome acessivel "Reordenar tarefa", evitando confundir reorder com a nova acao "Mover tarefa".

**Blocos principais**

- Linhas 340-360: fixture com duas tarefas raiz e uma subtarefa; assertion espera dois botoes "Reordenar tarefa" para tarefas raiz reorderable.

**Funcoes, classes e importacoes especificas**

- `renderDailyPage`: helper local da suite.
- `mockUseTodayLogQuery`: fornece log diario controlado.

**Comportamento de libs usadas**

- Testing Library `getAllByRole`: valida quantidade de botoes pelo nome acessivel real.

### `frontend/src/pages/planner/WeeklyPage.test.tsx`

**Funcao geral do arquivo**

Suite da pagina Esta Semana.

**Funcao geral da alteracao**

Atualiza o teste readonly para "Reordenar tarefa" e adiciona teste garantindo que "Mover tarefa" aparece mesmo sem `onReorder`.

**Blocos principais**

- Linhas 161-167: confirma que a pagina semanal continua sem reorder.
- Linhas 169-175: confirma que o novo botao "Mover tarefa" aparece em tarefas da semana.

**Funcoes, classes e importacoes especificas**

- `mockUseWeeklyLogQuery`: injeta weekly log fixture.
- `renderWeeklyPage`: renderiza a pagina no contexto de teste.

**Comportamento de libs usadas**

- `queryByRole` retorna `null` quando ausente, adequado para provar que reorder nao foi introduzido.
- `getAllByRole(...).length > 0` prova presenca de pelo menos uma acao de mover.

### `frontend/src/pages/planner/MonthlyPage.test.tsx`

**Funcao geral do arquivo**

Suite da pagina Este Mes.

**Funcao geral da alteracao**

Mesma adaptacao da pagina semanal: separa a ausencia de reorder da presenca do novo mover.

**Blocos principais**

- Linhas 175-181: confirma ausencia de "Reordenar tarefa".
- Linhas 183-189: confirma presenca de "Mover tarefa" mesmo sem `onReorder`.

**Funcoes, classes e importacoes especificas**

- `mockUseMonthlyLogQuery`: injeta monthly log fixture.
- `renderMonthlyPage`: renderiza pagina mensal.

**Comportamento de libs usadas**

- Testing Library `screen` usa roles acessiveis para pegar os botoes reais resultantes de `TaskRow`.

## 8. E2E Playwright

### `frontend/e2e/move-task.spec.ts`

**Funcao geral do arquivo**

Spec Playwright novo que valida a Story 11.6 ponta-a-ponta contra backend real, sem mocks de rede.

**Funcao geral da alteracao**

Arquivo novo com seis cenarios cobrindo Daily Log, Esta Semana, Este Mes, Futuro, painel de detalhe, estado terminal desabilitado e navegacao de mes no calendario.

**Blocos principais**

- Linhas 1-8: imports e comentario de escopo.
- Linhas 10-19: helpers `todayIso` e `nextMonthValue`.
- Linhas 21-56: move do Daily Log para dia da semana corrente via calendario; origem vira "Migrada" e a tarefa aparece em Esta Semana.
- Linhas 58-96: move de Esta Semana para Este Mes; origem vira "Adiada" e aparece em Este Mes.
- Linhas 98-136: move de Este Mes para Futuro.
- Linhas 138-168: move pelo painel de detalhe; sucesso fecha dialogo e painel.
- Linhas 170-188: tarefa `completed` tem "Mover tarefa" desabilitado.
- Linhas 190-227: navega para proximo mes, escolhe dia 15 e verifica que o payload `scheduledDate` esperado foi enviado.

**Funcoes, classes e importacoes especificas**

- `syncAfter`: helper do fixture E2E para sincronizar acao e atualizacao de dados.
- `detailPanel`: helper para localizar o painel de detalhe.
- `page.waitForResponse`: captura a resposta de `/migrate/` e permite validar status/payload.

**Comportamento de libs usadas**

- Playwright `test`/`expect`: executa browser real e fornece assertions assíncronas.
- Locators por role/label (`getByRole`, `getByLabel`, `getByTestId`) aguardam elementos e reduzem acoplamento a markup.
- `page.on('console')` e `page.on('pageerror')`: coletam erros de console/runtime; os testes esperam lista vazia.

## 9. Relacao produtor-consumidor entre arquivos

- `backend/bujo/services/migration.py` produz a nova semantica de dominio para `destination="week"` com `scheduled_date`.
- `backend/bujo/tests/test_services.py` valida diretamente essa semantica em nivel de servico.
- `backend/bujo/tests/test_views.py` valida que a view e serializer ja conseguem transportar `scheduledDate` ate o servico e que o guardrail de ciclo fechado segue ativo.
- `frontend/src/features/bujo/api.ts` transporta payloads do frontend para o endpoint `/migrate/` e invalida caches que as superficies e o calendario consomem.
- `frontend/src/features/bujo/components/MigrationCard.tsx` fornece helpers de bounds de mes reaproveitados por `TaskDestinationDialog`.
- `frontend/src/features/bujo/components/TaskDestinationDialog.tsx` consome `useMigrateTaskMutation`, `useTaskDensityQuery`, `currentMonthBounds` e `MonthDensityCalendar` para montar os tres destinos.
- `TaskRow.tsx` e `TaskDetailPanel.tsx` consomem `TaskDestinationDialog` e expõem a acao nas superficies reais.
- Os testes de componentes validam os contratos internos; os testes de paginas validam integracao com paginas readonly/reorderable; o E2E valida o fluxo completo no app.

## 10. Observacoes de escopo

- Nao ha alteracao em migracoes de banco.
- Nao ha alteracao em `schema.yaml` nem em tipos gerados de OpenAPI, porque o contrato ja aceitava `scheduledDate`.
- O relatorio foi gerado sobre o estado nao commitado antes da criacao deste proprio arquivo; este arquivo de relatorio nao foi reanalisado como item do conjunto.
