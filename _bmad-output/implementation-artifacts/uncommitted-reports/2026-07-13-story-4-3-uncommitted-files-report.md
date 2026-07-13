# Explicacao dos arquivos nao commitados - Story 4.3

## Visao geral

O conjunto de mudancas implementa a Story 4.3: revisao semanal/mensal e pull automatico do Future Log. No backend, `migrate_task` passa a aceitar o destino `"week"`, surgem filas de revisao para semana e mes anteriores, e o PATCH de task passa a aceitar `scheduledDate` com validacao de mes quando a task pertence a um Monthly Log. No contrato, `schema.yaml` e `types.gen.ts` expõem os novos endpoints/tipos. No frontend, a camada de dados ganha hooks para as novas filas, o Migration Card/Flow ganha variantes `daily | weekly | monthly`, a Daily Page compoe dois novos banners de revisao, e a Monthly Page mostra itens sem data do mes corrente como "Itens do Future Log para [Mes]" com confirmacao inline de data. A cobertura inclui testes de servico, views, hooks, componentes, pagina mensal, pagina diaria e um E2E permanente.

## Ordem logica de funcionamento

1. Artefatos de planejamento/status registram a Story 4.3 como pronta/concluida e documentam verificacoes.
2. O backend amplia serializers, servico de migracao, views e URLs.
3. O contrato OpenAPI e os tipos TypeScript gerados refletem os novos endpoints e campos.
4. A camada de dados frontend define query keys, tipos e hooks para filas de revisao.
5. `MigrationCard` e `MigrationFlow` generalizam o fluxo por contexto.
6. `WeeklyReviewBanner` e `MonthlyReviewBanner` consomem as filas e abrem o fluxo certo.
7. `DailyPage` renderiza os tres banners em sequencia.
8. `MonthlyPage` apresenta o pull do Future Log e confirma `scheduledDate`.
9. Testes unitarios, de API e E2E validam os caminhos novos.

## 1. Artefatos de planejamento, status e notas

### `_bmad-output/implementation-artifacts/4-3-revisao-semanal-mensal-e-pull-automatico-do-future-log.md`

**Funcao geral do arquivo**

Artefato de story da implementacao. E um documento de especificacao, execucao, debug log, file list e review da Story 4.3.

**Funcao geral da alteracao**

Arquivo novo. Registra a historia como `Status: done`, detalha os acceptance criteria, lista as tasks executadas, evidencia comandos de teste, descreve decisoes tecnicas e lista todos os arquivos da historia.

**Blocos principais**

- Linhas 5-30: titulo, status, narrativa da story e ACs de revisao semanal/mensal.
- Linhas 37-123: tarefas backend, contrato e frontend data layer.
- Linhas 125-152: desenho de `MigrationCard`/`MigrationFlow`, banners e Monthly Page.
- Linhas 220-253: Dev Agent Record com comandos reais, notas de conclusao e verificacao manual.
- Linhas 255-287: File List reconciliado.
- Linhas 289-302: Senior Developer Review com achados corrigidos.

**Funcoes, classes e importacoes especificas**

- Nao e codigo fonte. Os simbolos citados (`migrate_task`, `WeeklyReviewQueueView`, `MigrationFlow`, `useUpdateTaskMutation`) orientam a leitura dos arquivos fonte seguintes.

**Comportamento de libs usadas**

- Nao usa bibliotecas em runtime; documenta comandos de Django/pytest/Vitest/Playwright usados na validacao.

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Funcao geral do arquivo**

Fonte de status do sprint para o fluxo BMad/story-automator.

**Funcao geral da alteracao**

Atualiza `last_updated` para marcar a Story 4.3 como done apos code review e muda o status de `4-3-revisao-semanal-mensal-e-pull-automatico-do-future-log` de `backlog` para `done`.

**Blocos principais**

- Linhas alteradas em torno de 38: comentario de `last_updated` passa de Story 4.2 para Story 4.3.
- Linhas alteradas em torno de 74: status da Story 4.3 passa para `done`.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos de codigo.

**Comportamento de libs usadas**

- YAML: estrutura chave/valor consumida por automacoes BMad.

### `_bmad-output/story-automator/orchestration-4-20260712-232806.md`

**Funcao geral do arquivo**

Log de orquestracao do Epic 4 pelo story automator.

**Funcao geral da alteracao**

Move o cursor da orquestracao da Story 4.2 para a 4.3, marca 4.2 como concluida, 4.3 em progresso/done nas etapas e adiciona eventos cronologicos de create-story, dev-story, automate e code-review.

**Blocos principais**

- Linhas iniciais alteradas: `currentStory`, `currentStep` e `lastUpdated`.
- Tabela de progresso: 4.2 passa a done e 4.3 passa a in-progress.
- Novas entradas de log: commit de 4.2, criacao/review/dev/automate/code-review da 4.3.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos de codigo.

**Comportamento de libs usadas**

- Markdown consumido por humanos e automacoes de acompanhamento.

### `_bmad-output/implementation-artifacts/tests/test-summary.md`

**Funcao geral do arquivo**

Historico consolidado de execucoes e decisoes de QA automatizado.

**Funcao geral da alteracao**

Adiciona uma secao da Story 4.3 documentando dois gaps de assercao E2E fechados: verificar o destino real `"week"` na Weekly Log e verificar a ordem da secao "Itens do Future Log".

**Blocos principais**

- Nova secao "Resumo de Automacao de Testes - Story 4.3": contexto de pytest/DRF/Vitest/Playwright.
- Tabela "Gaps Descobertos e Fechados": descreve lacunas e correcoes.
- "Cobertura por AC": mapeia AC1/AC2 para testes.
- "Execucao": registra o spec isolado verde e a suite completa com flake pre-existente.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos de codigo.

**Comportamento de libs usadas**

- Registra comportamento esperado de Playwright (`waitForResponse`, locators semanticamente orientados) e testes de browser real.

### `docs/futureIdeas.md`

**Funcao geral do arquivo**

Backlog livre de ideias futuras e bugs conhecidos.

**Funcao geral da alteracao**

Adiciona uma ideia de aba de historico e dois bugs conhecidos: testes poluindo banco e daily logs passados mantendo tasks pending.

**Blocos principais**

- Linhas finais adicionadas: "Aba de Historico" e secao `BUGs`.

**Funcoes, classes e importacoes especificas**

- Nao ha codigo.

**Comportamento de libs usadas**

- Markdown simples.

## 2. Backend - serializers, servico, views e rotas

### `backend/bujo/serializers.py`

**Funcao geral do arquivo**

Define serializers DRF para entrada/saida dos endpoints BuJo. Converte entre snake_case do modelo e camelCase configurado pela API, valida enums/datas e alimenta o schema do drf-spectacular.

**Funcao geral da alteracao**

Permite atualizar `scheduled_date`, adiciona serializers de fila semanal/mensal e inclui `"week"` como destino de migracao.

**Blocos principais**

- Linhas 62-71: `TaskUpdateSerializer` agora aceita `scheduled_date` opcional/nulo.
- Linhas 101-113: `MigrationQueueSerializer` existente e novos `WeeklyReviewQueueSerializer`/`MonthlyReviewQueueSerializer`.
- Linhas 116-144: `TaskMigrateSerializer` aceita `"today" | "week" | "month" | "future" | "cancel"` e preserva validacoes condicionais de `month`/`future`.

**Funcoes, classes e importacoes especificas**

- `serializers.DateField`: espera string de data ISO no request e entrega `datetime.date` validado para a view/servico.
- `serializers.ChoiceField`: rejeita destinos fora da lista antes de chegar ao servico.
- `TaskSerializer`: serializer recursivo usado para as filas novas, mantendo subtarefas aninhadas.
- `WeeklyReviewQueueSerializer`: retorna `week_start` e `tasks`.
- `MonthlyReviewQueueSerializer`: retorna `month_first` e `tasks`.

**Comportamento de libs usadas**

- DRF `Serializer.is_valid(raise_exception=True)` nas views transforma violacoes em HTTP 400.
- drf-spectacular le esses serializers para gerar `schema.yaml`; os nomes snake_case viram camelCase nos tipos frontend conforme a configuracao do projeto.

### `backend/bujo/services/migration.py`

**Funcao geral do arquivo**

Servico transacional de migracao de tasks entre logs. Centraliza regra de lineage, status da origem, criacao do destino e migracao recursiva de subtarefas ainda nao dispostas.

**Funcao geral da alteracao**

Adiciona o destino `"week"` para migrar tarefas para a Weekly Log corrente, calculada no backend com `week_start_of(today_for(user))`.

**Blocos principais**

- Linhas 11-18: importa `get_or_create_weekly_log` e `week_start_of`.
- Linhas 21-54: `_migrate_subtree` permanece o mecanismo recursivo compartilhado.
- Linhas 57-70: docstring documenta `"week"`.
- Linhas 76-88: dispatcher escolhe container de destino; o novo ramo `"week"` usa `weekly_log` e status `MIGRATED`.
- Linhas 89-98: executa a migracao recursiva e retorna a task de origem recarregada.

**Funcoes, classes e importacoes especificas**

- `_migrate_subtree`: transiciona a origem, cria copia no destino, atualiza `migration_count`, aponta `migrated_to_task` e recursa apenas em filhos `pending`/`started`.
- `migrate_task`: API de servico usada pela view; espera `user`, `task_id`, `destination` e opcionais de mes/data.
- `get_or_create_weekly_log`: materializa a Weekly Log corrente quando o usuario realmente decide migrar para a semana.
- `today_for`/`week_start_of`: autoridade temporal do backend; evita aceitar semana corrente vinda do cliente.
- `transaction.atomic`: garante que origem, destino e subtarefas sejam gravados juntos ou revertidos juntos.

**Comportamento de libs usadas**

- Django ORM `Task.objects.get` e managers tenant-aware escopam a consulta ao usuario atual via contexto.
- `transaction.atomic` abre transacao de banco para a operacao completa.

### `backend/bujo/views.py`

**Funcao geral do arquivo**

Views finas DRF para logs, tasks, filas e migracao. Validam request, chamam servicos e serializam resposta.

**Funcao geral da alteracao**

Valida `scheduled_date` no PATCH de task, adiciona `WeeklyReviewQueueView` e `MonthlyReviewQueueView`, e importa os serializers/modelos necessarios.

**Blocos principais**

- Linhas 15-30: imports incluem `WeeklyLog`, `WeeklyReviewQueueSerializer` e `MonthlyReviewQueueSerializer`.
- Linhas 60-87: `TaskDetailView.patch` busca a task, valida mes quando `scheduled_date` pertence a Monthly Log e delega a `update_task`.
- Linhas 237-249: `MigrationQueueView` continua como referencia de fila sem materializacao.
- Linhas 252-264: `WeeklyReviewQueueView` calcula semana anterior, usa `.filter().first()` e retorna somente tasks raiz `pending`/`started`.
- Linhas 267-281: `MonthlyReviewQueueView` calcula mes anterior, tambem sem materializar log ausente, e retorna tasks raiz pendentes/iniciadas.
- Linhas 284-315: `TaskMigrateView` continua delegando a `migrate_task`; `"week"` passa pelo fluxo sem branch adicional.

**Funcoes, classes e importacoes especificas**

- `TaskDetailView.patch`: faz validacao que depende da instancia existente, algo que o serializer isolado nao conhece.
- `WeeklyReviewQueueView.get`: produz a fila que alimenta `WeeklyReviewBanner`.
- `MonthlyReviewQueueView.get`: produz a fila que alimenta `MonthlyReviewBanner`.
- `serializers.ValidationError`: gera HTTP 400 quando `scheduled_date` sai do mes da task mensal.
- `NotFound`: gera HTTP 404 para task inexistente ou fora do tenant.

**Comportamento de libs usadas**

- DRF `APIView` mapeia metodos HTTP (`get`, `post`, `patch`) para handlers.
- `extend_schema` instrui drf-spectacular sobre request/response.
- Django QuerySet `.filter().first()` evita criar logs vazios so por consultar a fila.
- `Task.objects.none()` devolve QuerySet vazio serializavel sem bater em dados inexistentes.

### `backend/bujo/urls.py`

**Funcao geral do arquivo**

Tabela de rotas do app `bujo`.

**Funcao geral da alteracao**

Registra dois endpoints novos de fila de revisao.

**Blocos principais**

- Linhas 3-17: imports incluem `WeeklyReviewQueueView` e `MonthlyReviewQueueView`.
- Linhas 19-37: `urlpatterns` adiciona `weekly-review/queue/` e `monthly-review/queue/`.

**Funcoes, classes e importacoes especificas**

- `path("weekly-review/queue/", ...)`: endpoint GET usado pelo frontend para revisao semanal.
- `path("monthly-review/queue/", ...)`: endpoint GET usado pelo frontend para revisao mensal.

**Comportamento de libs usadas**

- Django `path` associa caminho relativo, view class-based via `.as_view()` e nome de rota.

## 3. Backend - testes

### `backend/bujo/tests/test_services.py`

**Funcao geral do arquivo**

Testa servicos de dominio do BuJo sem passar pela camada HTTP.

**Funcao geral da alteracao**

Adiciona cobertura de `migrate_task(destination="week")`, incluindo o cenario de subarvore com filho pendente e filho concluido.

**Blocos principais**

- Linhas 17-18: imports passam a incluir `WeeklyLogFactory`/`week_start_of`.
- Linhas 447-492: cenario-ancora para pai com filho pendente e concluido migrando para Weekly Log corrente.
- Linhas 495-511: caso simples garante origem `migrated` e destino em `weekly_log` corrente.

**Funcoes, classes e importacoes especificas**

- `tenant_context`: ativa isolamento tenant nos testes.
- `TaskFactory`, `LogFactory`, `WeeklyLogFactory`: criam fixtures de banco.
- `migrate_task`: funcao sob teste.
- `get_or_create_weekly_log`: usado para localizar o container esperado.
- `week_start_of(today_for(user))`: calcula a semana corrente esperada.

**Comportamento de libs usadas**

- `pytest.mark.django_db` habilita acesso ao banco de teste.
- Factory Boy (via factories do projeto) cria entidades persistidas com defaults.

### `backend/bujo/tests/test_views.py`

**Funcao geral do arquivo**

Testa endpoints HTTP do app BuJo com DRF `APIClient`.

**Funcao geral da alteracao**

Adiciona cobertura para destino `"week"`, filas de revisao semanal/mensal, isolamento por tenant, nao-materializacao de logs ausentes e PATCH de `scheduledDate`.

**Blocos principais**

- Linhas 9-16: imports incluem `MonthlyLog`, `WeeklyLog`, factories e calendario.
- Linhas 901-921: POST migrate com `destination=week` cria task na Weekly Log corrente.
- Linhas 927-970: fila semanal vazia nao materializa log; fila com statuses variados retorna so raizes pending/started.
- Linhas 973-989: fila semanal respeita tenant.
- Linhas 992-1036: mesmos cenarios para fila mensal.
- Linhas 1039-1055: fila mensal respeita tenant.
- Linhas 1061-1112: PATCH `scheduledDate` aceita data dentro do mes, rejeita fora do mes e aceita sem validacao de mes para task sem Monthly Log.

**Funcoes, classes e importacoes especificas**

- `auth_client.get/post/patch`: chama endpoints autenticados.
- `WeeklyLog.objects.count()`/`MonthlyLog.objects.count()`: prova que GET de fila nao materializa logs.
- `TaskFactory`: cria combinacoes de status e hierarquia.

**Comportamento de libs usadas**

- DRF `APIClient` serializa payload JSON com `format="json"` e expõe `response.data`.
- JWT/autenticacao do fixture garante que managers tenant-aware filtrem por usuario.

## 4. Contrato OpenAPI e tipos gerados

### `schema.yaml`

**Funcao geral do arquivo**

Contrato OpenAPI gerado pelo backend e usado para derivar tipos frontend.

**Funcao geral da alteracao**

Adiciona paths de filas de revisao, schemas `WeeklyReviewQueue`/`MonthlyReviewQueue`, destino `"week"` e campo `scheduledDate` em `TaskUpdate`.

**Blocos principais**

- Paths novos: `/api/bujo/weekly-review/queue/` e `/api/bujo/monthly-review/queue/`.
- `DestinationEnum`: inclui `week`.
- `TaskUpdate`: inclui `scheduledDate` date nullable.
- Schemas novos: `WeeklyReviewQueue` com `weekStart` e `tasks`; `MonthlyReviewQueue` com `monthFirst` e `tasks`.

**Funcoes, classes e importacoes especificas**

- Arquivo gerado, sem funcoes manuais.

**Comportamento de libs usadas**

- drf-spectacular gera o YAML a partir de serializers/views DRF.
- O transformador de camelCase do projeto expõe `week_start` como `weekStart` e `scheduled_date` como `scheduledDate`.

### `frontend/src/api/types.gen.ts`

**Funcao geral do arquivo**

Tipos TypeScript gerados a partir do OpenAPI.

**Funcao geral da alteracao**

Reflete o contrato novo no cliente: novos paths, schemas e operacoes para review queues, `DestinationEnum` com `"week"` e `TaskUpdate.scheduledDate`.

**Blocos principais**

- Interfaces de `paths`: adiciona `/api/bujo/monthly-review/queue/` e `/api/bujo/weekly-review/queue/`.
- `components.schemas.DestinationEnum`: inclui `"week"`.
- `components.schemas.MonthlyReviewQueue` e `WeeklyReviewQueue`: definem formato de resposta das filas.
- `operations.bujo_monthly_review_queue_retrieve` e `bujo_weekly_review_queue_retrieve`: tipam respostas 200.

**Funcoes, classes e importacoes especificas**

- Arquivo gerado, consumido por `frontend/src/features/bujo/types.ts`.

**Comportamento de libs usadas**

- openapi-typescript gera interfaces estruturais de `paths`, `components` e `operations`.

## 5. Frontend - camada de dados e exports

### `frontend/src/api/keys.ts`

**Funcao geral do arquivo**

Centraliza query keys do TanStack Query.

**Funcao geral da alteracao**

Adiciona keys para filas de revisao semanal e mensal.

**Blocos principais**

- Linhas 13-20: `bujo` agora tem `weeklyReviewQueue()` e `monthlyReviewQueue()`.

**Funcoes, classes e importacoes especificas**

- `keys.bujo.weeklyReviewQueue`: retorna `['bujo', 'weeklyReviewQueue', 'list']`.
- `keys.bujo.monthlyReviewQueue`: retorna `['bujo', 'monthlyReviewQueue', 'list']`.

**Comportamento de libs usadas**

- TanStack Query usa igualdade estrutural das query keys para cache/refetch/invalidation.

### `frontend/src/features/bujo/types.ts`

**Funcao geral do arquivo**

Reexporta tipos de dominio BuJo derivados de `types.gen.ts`.

**Funcao geral da alteracao**

Expoe `WeeklyReviewQueue` e `MonthlyReviewQueue`.

**Blocos principais**

- Linhas 12-14: novos aliases para schemas gerados.

**Funcoes, classes e importacoes especificas**

- `components['schemas']['WeeklyReviewQueue']`: tipo gerado para resposta semanal.
- `components['schemas']['MonthlyReviewQueue']`: tipo gerado para resposta mensal.

**Comportamento de libs usadas**

- TypeScript indexed access types mantem os aliases sincronizados com o contrato gerado.

### `frontend/src/features/bujo/api.ts`

**Funcao geral do arquivo**

Camada de dados da feature BuJo: hooks de query/mutation e chamadas HTTP ao backend.

**Funcao geral da alteracao**

Inclui `scheduledDate` em updates, invalida Monthly Log apos update, adiciona queries para filas de revisao, adiciona destino `"week"` e amplia invalidacoes de migracao.

**Blocos principais**

- Linhas 6-18: imports de novos tipos.
- Linhas 58-64: `TaskFields` passa a aceitar `scheduledDate`.
- Linhas 128-148: `useUpdateTaskMutation` invalida `['bujo', 'monthlyLog']` no sucesso.
- Linhas 253-275: `fetchWeeklyReviewQueue`, `useWeeklyReviewQueueQuery`, `fetchMonthlyReviewQueue`, `useMonthlyReviewQueueQuery`.
- Linhas 277-288: `MigrationDestination` inclui `"week"`; `migrateTask` monta POST.
- Linhas 291-307: `useMigrateTaskMutation` invalida filas, Today Log, Weekly Log, Monthly Log e Future Log.

**Funcoes, classes e importacoes especificas**

- `client.get`/`client.post`/`client.patch`: wrapper HTTP do projeto.
- `useQuery`: espera `queryKey` e `queryFn`; retorna estado de cache/loading/data.
- `useMutation`: executa mutacoes imperativas e callbacks de sucesso.
- `useQueryClient`: fornece `invalidateQueries`.
- `useOptimisticMutation`: helper local que aplica updater otimista no cache antes do refetch.

**Comportamento de libs usadas**

- TanStack Query `invalidateQueries({ queryKey })` com prefixo de dois itens (`['bujo','monthlyLog']`) invalida todas as variantes de mes.
- A mutacao otimista continua voltada ao Daily Log; quando a task atualizada esta no Monthly Log, o updater e no-op seguro e a invalidacao faz o refetch real.

### `frontend/src/features/bujo/index.ts`

**Funcao geral do arquivo**

Barrel da feature BuJo para paginas importarem hooks, componentes e tipos por um ponto unico.

**Funcao geral da alteracao**

Exporta novos hooks, banners e tipos.

**Blocos principais**

- Linhas 1-16: exporta `useWeeklyReviewQueueQuery` e `useMonthlyReviewQueueQuery`.
- Linhas 17-19: exporta `WeeklyReviewBanner` e `MonthlyReviewBanner`.
- Linhas 21-34: exporta tipos `WeeklyReviewQueue` e `MonthlyReviewQueue`.

**Funcoes, classes e importacoes especificas**

- Nao cria comportamento; reorganiza exports.

**Comportamento de libs usadas**

- ES modules reexportam bindings mantendo tree-shaking do bundler.

### `frontend/src/features/bujo/monthNames.ts`

**Funcao geral do arquivo**

Primitivo compartilhado de nomes de meses em pt-BR.

**Funcao geral da alteracao**

Arquivo novo criado para eliminar duplicacao entre `MigrationCard` e `MonthlyPage`.

**Blocos principais**

- Linhas 1-14: `MONTH_NAMES_PT` com meses minusculos.
- Linhas 16-18: `capitalize`.

**Funcoes, classes e importacoes especificas**

- `MONTH_NAMES_PT`: array indexado por `Date.getMonth()` ou numero de mes - 1.
- `capitalize(word)`: retorna primeira letra maiuscula e restante intacto.

**Comportamento de libs usadas**

- Usa apenas APIs nativas de string/array JavaScript.

## 6. Frontend - fluxo de migracao e banners

### `frontend/src/features/bujo/components/MigrationCard.tsx`

**Funcao geral do arquivo**

Card visual de decisao para uma task dentro do fluxo de migracao.

**Funcao geral da alteracao**

Generaliza o card por `flowType`: diario preserva comportamento anterior, semanal troca botao 1 para `"week"`, mensal remove botao hoje/semana e remapeia atalhos visuais para 1-3.

**Blocos principais**

- Linhas 7-12: tipos `MigrationDecisionExtra` e `MigrationFlowType`.
- Linhas 24-38: helpers de mes corrente e label com `MONTH_NAMES_PT`.
- Linhas 40-67: props e calculo de `primaryAction`, `monthLabel` e `shortcutOffset`.
- Linhas 68-79: handlers dos pickers de data/mes.
- Linhas 81-93: navegacao por setas entre botoes.
- Linhas 95-205: JSX do card, renderizando botao primario condicional, pickers e cancelar.

**Funcoes, classes e importacoes especificas**

- `MigrationFlowType`: `'daily' | 'weekly' | 'monthly'`.
- `currentMonthBounds`: gera `min`/`max` para input date do mes corrente.
- `handleMonthDateChange`: chama `onDecide('month', { scheduledDate })`.
- `handleFutureMonthChange`: chama `onDecide('future', { monthFirst, scheduledDate? })`.
- `handleArrowKeyDown`: move foco entre botoes quando picker nao esta aberto.

**Comportamento de libs usadas**

- React `useState` guarda dia opcional do futuro; `useRef` guarda refs de botoes.
- MUI `Button`, `TextField`, `Typography`, `Box` renderizam controles acessiveis usados pelos testes.
- Input `type="date"` espera valor `YYYY-MM-DD`; input `type="month"` espera `YYYY-MM`.

### `frontend/src/features/bujo/components/MigrationFlow.tsx`

**Funcao geral do arquivo**

Overlay modal que percorre uma fila de tasks e dispara a mutacao de migracao para cada decisao.

**Funcao geral da alteracao**

Recebe `flowType`, repassa ao card e usa tabela de atalhos por contexto.

**Blocos principais**

- Linhas 8-18: props incluem `flowType` com default `daily`.
- Linhas 25-35: captura snapshot da fila ao abrir.
- Linhas 39-56: `handleDecide` executa `migrate.mutate`, limpa picker, avanca ou fecha.
- Linhas 58-99: listener global de teclado com mapeamento `daily`, `weekly`, `monthly`.
- Linhas 103-123: MUI `Dialog` e `MigrationCard` com `key={currentTask.id}`.

**Funcoes, classes e importacoes especificas**

- `useMigrateTaskMutation`: envia POST `/migrate/`.
- `handleDecide`: ponto unico que transforma decisao de UI em variaveis da mutacao.
- `shortcuts`: `weekly` usa `1 -> week`; `monthly` usa `1 -> picker month`, `2 -> picker future`, `3 -> cancel`.

**Comportamento de libs usadas**

- React `useEffect` registra/remove event listener.
- React `useCallback` estabiliza `handleDecide` para dependencias do efeito.
- MUI `Dialog` controla foco/backdrop e `fullScreen` em mobile via `useMediaQuery`.

### `frontend/src/features/bujo/components/WeeklyReviewBanner.tsx`

**Funcao geral do arquivo**

Banner que avisa sobre tarefas sem disposicao na semana anterior.

**Funcao geral da alteracao**

Arquivo novo. Consulta a fila semanal, esconde-se quando vazia/loading e abre `MigrationFlow` com `flowType="weekly"`.

**Blocos principais**

- Linhas 1-4: imports de React, MUI, query hook e flow.
- Linhas 8-14: query, estado `flowOpen`, calculo de tasks e retorno nulo quando vazio/loading.
- Linhas 15-35: banner com texto e botao "Iniciar revisao".
- Linhas 36-41: `MigrationFlow` semanal.

**Funcoes, classes e importacoes especificas**

- `useWeeklyReviewQueueQuery`: busca `/api/bujo/weekly-review/queue/`.
- `setFlowOpen`: controla abertura do dialog.

**Comportamento de libs usadas**

- React `useState` guarda estado local do modal.
- MUI `Box` aplica layout/superficie; `Button` aciona abertura.

### `frontend/src/features/bujo/components/MonthlyReviewBanner.tsx`

**Funcao geral do arquivo**

Banner que avisa sobre tarefas sem disposicao no mes anterior.

**Funcao geral da alteracao**

Arquivo novo. Consulta a fila mensal, esconde-se quando vazia/loading e abre `MigrationFlow` com `flowType="monthly"`.

**Blocos principais**

- Linhas 8-14: query mensal e retorno nulo quando nao ha tarefas.
- Linhas 15-35: texto "Mes anterior tem N tarefas sem disposicao..." e botao.
- Linhas 36-41: `MigrationFlow` mensal.

**Funcoes, classes e importacoes especificas**

- `useMonthlyReviewQueueQuery`: busca `/api/bujo/monthly-review/queue/`.
- `MigrationFlow flowType="monthly"`: remove acao hoje/semana e usa decisoes de data/futuro/cancelar.

**Comportamento de libs usadas**

- Mesmo comportamento React/MUI do banner semanal.

## 7. Frontend - paginas

### `frontend/src/pages/daily/DailyPage.tsx`

**Funcao geral do arquivo**

Pagina principal do Daily Log, com lista de tasks do dia, criacao, reordenacao, transicao e painel de detalhe.

**Funcao geral da alteracao**

Compoe os novos banners de revisao semanal e mensal abaixo do banner diario de migracao.

**Blocos principais**

- Linhas 3-10: imports do barrel incluem `WeeklyReviewBanner` e `MonthlyReviewBanner`.
- Linhas 72-77: renderiza `MigrationBanner`, `WeeklyReviewBanner` e `MonthlyReviewBanner` antes do `DayHeader`.

**Funcoes, classes e importacoes especificas**

- `MigrationBanner`: fila diaria de ontem.
- `WeeklyReviewBanner`: fila da semana anterior.
- `MonthlyReviewBanner`: fila do mes anterior.

**Comportamento de libs usadas**

- React compoe componentes independentes; cada banner tem sua propria query TanStack.

### `frontend/src/pages/planner/MonthlyPage.tsx`

**Funcao geral do arquivo**

Pagina do Monthly Log. Lista tasks agrupadas por `scheduledDate`, permite adicionar task mensal e exibe tasks sem data.

**Funcao geral da alteracao**

Quando o mes exibido e o mes corrente, tasks sem data aparecem antes das tasks com data sob o titulo "Itens do Future Log para [Mes]" e ganham input inline para confirmar data via PATCH.

**Blocos principais**

- Linhas 4-13: imports incluem `useUpdateTaskMutation` e nomes de mes compartilhados.
- Linhas 15-24: `currentMonthFirst` calcula o mes corrente local para comportamento de UI.
- Linhas 26-45: `groupTasksByScheduledDate` separa tasks com/sem data.
- Linhas 47-65: hooks e dados.
- Linhas 66-79: calcula `isCurrentMonth`, titulo da secao sem data e handler de confirmacao.
- Linhas 81-105: `withoutDateSection` com `TextField` "Confirmar data" so no mes corrente.
- Linhas 124-160: ordem condicional: no mes corrente `withoutDateSection` vem antes; em outros meses, depois.
- Linhas 161-185: formulario de criacao mensal existente.

**Funcoes, classes e importacoes especificas**

- `useMonthlyLogQuery`: carrega Monthly Log atual ou selecionado.
- `useCreateMonthlyTaskMutation`: cria task mensal.
- `useUpdateTaskMutation`: confirma `scheduledDate`.
- `TaskRow`: renderiza cada task.
- `DayHeader`: agrupa tasks com data.

**Comportamento de libs usadas**

- MUI `TextField type="date"` entrega valor ISO ao `onChange`.
- TanStack mutation reflete a confirmacao de data por invalidacao do Monthly Log feita em `api.ts`.

## 8. Frontend - testes unitarios/integracao

### `frontend/src/features/bujo/api.test.tsx`

**Funcao geral do arquivo**

Testa hooks de API da feature BuJo com client mockado e QueryClient real.

**Funcao geral da alteracao**

Cobre `scheduledDate` no update, `destination=week`, invalidacoes novas e queries de review queue.

**Blocos principais**

- Imports iniciais: novos hooks e tipos de filas.
- Teste em `useUpdateTaskMutation`: PATCH com `scheduledDate` e invalidacao `['bujo','monthlyLog']`.
- Testes em `useMigrateTaskMutation`: invalidacoes ampliadas e payload `destination: 'week'`.
- Novos describes: `useWeeklyReviewQueueQuery` e `useMonthlyReviewQueueQuery` batem nos endpoints corretos.

**Funcoes, classes e importacoes especificas**

- `renderHook`: monta hooks fora de componente visual.
- `waitFor`: aguarda transicoes assincornas da mutation/query.
- `vi.spyOn(qc, 'invalidateQueries')`: verifica invalidacoes.

**Comportamento de libs usadas**

- Vitest `vi.fn`/`vi.spyOn` mocka client HTTP e QueryClient.
- Testing Library React Hooks via `renderHook` executa hooks com wrapper de provider.

### `frontend/src/features/bujo/components/MigrationCard.test.tsx`

**Funcao geral do arquivo**

Testa comportamento visual, decisao e acessibilidade do Migration Card.

**Funcao geral da alteracao**

Adiciona props de `flowType` ao helper e cobre variantes semanal/mensal.

**Blocos principais**

- Helper `renderCard`: passa `flowType`.
- Casos weekly: botao "Migrar para esta semana" chama `onDecide('week')`, preserva quatro botoes e passa axe.
- Casos monthly: nao renderiza botao hoje/semana, mostra tres botoes, remapeia atalhos visuais, abre picker de mes e passa axe.

**Funcoes, classes e importacoes especificas**

- `fireEvent.click`: simula clique.
- `screen.getByRole`: consulta por papel/nome acessivel.
- `axe`: verifica violacoes WCAG detectaveis.

**Comportamento de libs usadas**

- jest-axe espera DOM renderizado real; retorna resultado que matcher `toHaveNoViolations` avalia.

### `frontend/src/features/bujo/components/MigrationFlow.test.tsx`

**Funcao geral do arquivo**

Testa o overlay de migracao, avancos, atalhos e acessibilidade.

**Funcao geral da alteracao**

Permite passar `flowType` no helper e cobre mapeamento de teclado/click para weekly/monthly.

**Blocos principais**

- Helper `renderFlow`: aceita `flowType`.
- Casos weekly: tecla `1` e botao enviam `destination='week'`.
- Casos monthly: tres botoes, tecla `1` abre data do mes, `2` abre futuro, `3` cancela, `4` nao faz nada.

**Funcoes, classes e importacoes especificas**

- `mockMutate`: espia chamadas da mutacao.
- `fireEvent.keyDown(window, { key })`: simula atalhos globais.

**Comportamento de libs usadas**

- Testing Library valida comportamento pelo DOM e pelas chamadas mockadas.

### `frontend/src/features/bujo/components/WeeklyReviewBanner.test.tsx`

**Funcao geral do arquivo**

Testa o novo banner semanal isoladamente.

**Funcao geral da alteracao**

Arquivo novo.

**Blocos principais**

- Linhas 11-18: mocka `useWeeklyReviewQueueQuery` e `useMigrateTaskMutation`.
- Linhas 20-27: task fixture.
- Linhas 37-55: nao renderiza com fila vazia ou loading.
- Linhas 57-68: renderiza texto exato com contagem.
- Linhas 70-83: clique abre flow weekly com botao "Migrar para esta semana".
- Linhas 85-94: axe.

**Funcoes, classes e importacoes especificas**

- `mockUseWeeklyReviewQueueQuery`: controla estados da fila.
- `renderBanner`: envolve componente com tema real.

**Comportamento de libs usadas**

- Vitest mocka o modulo `../api`; MUI ThemeProvider fornece tokens usados pelo componente.

### `frontend/src/features/bujo/components/MonthlyReviewBanner.test.tsx`

**Funcao geral do arquivo**

Testa o novo banner mensal isoladamente.

**Funcao geral da alteracao**

Arquivo novo.

**Blocos principais**

- Linhas 11-18: mocka query/mutation mensal.
- Linhas 37-55: estados vazio/loading.
- Linhas 57-68: texto exato com contagem.
- Linhas 70-86: clique abre flow monthly e confirma ausencia do botao "Migrar para hoje".
- Linhas 88-97: axe.

**Funcoes, classes e importacoes especificas**

- `useMonthlyReviewQueueQuery`: mockado para retornar fila controlada.
- `MonthlyReviewBanner`: componente real sob teste.

**Comportamento de libs usadas**

- Mesmo conjunto Vitest, Testing Library, MUI e jest-axe do banner semanal.

### `frontend/src/pages/daily/DailyPage.test.tsx`

**Funcao geral do arquivo**

Testa a Daily Page e integracao com banners/fila diaria.

**Funcao geral da alteracao**

Adiciona roteamento de mocks GET por URL para lidar com tres banners independentes e cobre banners semanal/mensal integrados na pagina.

**Blocos principais**

- Novos helpers de GET: defaults por endpoint, resposta persistente e resposta "once".
- Ajustes nos testes de `MigrationBanner`: usam resposta por URL.
- Novo describe `WeeklyReviewBanner/MonthlyReviewBanner integration`: testa independencia dos tres banners, abertura do flow weekly/monthly e ausencia quando as filas estao vazias.

**Funcoes, classes e importacoes especificas**

- `setGetResponse`: configura resposta persistente de endpoint.
- `queueGetResponseOnce`: simula primeira consulta e refetch posterior.
- `resetGetRouting`: instala `mockGet.mockImplementation` roteada por URL.

**Comportamento de libs usadas**

- TanStack Query dispara tres GETs independentes; sem roteamento por URL, um mock generico contaminaria todas as filas.

### `frontend/src/pages/planner/MonthlyPage.test.tsx`

**Funcao geral do arquivo**

Testa a Monthly Page.

**Funcao geral da alteracao**

Fixa o relogio para julho/2026, separa cenarios de mes corrente e nao-corrente, cobre ordem do Future Log e confirmacao de data.

**Blocos principais**

- Imports: adiciona `afterEach`.
- Mocks: adiciona `useUpdateTaskMutation`.
- Fixtures: `MONTHLY_LOG` nao-corrente e `MONTHLY_LOG_CURRENT`.
- `beforeEach`/`afterEach`: usa fake timers e restaura timers reais.
- Novos testes: secao "Itens do Future Log para Julho" antes de tasks com data, mes nao-corrente preserva "Sem dia definido", input "Confirmar data" chama update.

**Funcoes, classes e importacoes especificas**

- `vi.useFakeTimers`/`vi.setSystemTime`: congela `new Date()`.
- `mockUpdateMutate`: verifica payload `{ taskId, scheduledDate }`.
- `document.body.textContent.indexOf`: verifica ordem no DOM.

**Comportamento de libs usadas**

- jest-axe usa timers reais; o teste troca para `vi.useRealTimers()` antes de chamar `axe` para evitar travamento.

### `frontend/src/app/layout/RouteAnnouncer.test.tsx`

**Funcao geral do arquivo**

Testa anuncio de mudanca de rota para acessibilidade.

**Funcao geral da alteracao**

Atualiza mock do barrel `features/bujo` para incluir os novos banners e evitar render real sem QueryClient.

**Blocos principais**

- Comentario atualizado explica que `MigrationBanner`, `WeeklyReviewBanner` e `MonthlyReviewBanner` usam TanStack Query.
- Mock adiciona `WeeklyReviewBanner: () => null` e `MonthlyReviewBanner: () => null`.

**Funcoes, classes e importacoes especificas**

- `vi.mock('../../features/bujo', ...)`: substitui hooks/componentes do BuJo nesse teste de layout.

**Comportamento de libs usadas**

- Vitest module mocking impede dependencias de QueryClient fora do escopo do teste.

### `frontend/src/app/router.test.tsx`

**Funcao geral do arquivo**

Testa configuracao/guards do router.

**Funcao geral da alteracao**

Inclui mocks nulos dos novos banners para manter foco do teste em roteamento.

**Blocos principais**

- Mock de `../features/bujo` adiciona `WeeklyReviewBanner` e `MonthlyReviewBanner`.

**Funcoes, classes e importacoes especificas**

- `vi.mock`: intercepta import do barrel da feature.

**Comportamento de libs usadas**

- Evita que hooks reais de Query rodem em teste que nao monta provider adequado.

## 9. Frontend - E2E

### `frontend/e2e/seedReviewScenario.ts`

**Funcao geral do arquivo**

Helper de seed para o E2E da Story 4.3. Cria dados que nao possuem affordance direta de UI: semana anterior com pendencias, mes anterior com pendencias e mes corrente com item sem data.

**Funcao geral da alteracao**

Arquivo novo.

**Blocos principais**

- Linhas 1-13: imports Node e comentario de contexto.
- Linhas 15-26: interfaces `SeedTaskInput` e `SeedReviewScenarioInput`.
- Linhas 28-40: `seedReviewScenario` monta script Python com dados serializados.
- Linhas 42-74: script Django calcula datas, cria arvores de tasks e containers.
- Linhas 76-80: executa `uv run python manage.py shell -c`.

**Funcoes, classes e importacoes especificas**

- `seedReviewScenario(email, input)`: entrada publica usada pelo spec Playwright.
- `execFileSync`: executa comando sem shell, com argumentos separados.
- `tenant_context`: garante que dados seedados pertencam ao usuario do teste.
- `WeeklyLog.objects.get_or_create`/`MonthlyLog.objects.get_or_create`: materializam os containers de teste.

**Comportamento de libs usadas**

- Node `child_process.execFileSync` espera binario e array de args; falha se o comando retorna codigo nao-zero.
- Django `manage.py shell -c` executa script Python no contexto da app.

### `frontend/e2e/weekly-monthly-review.spec.ts`

**Funcao geral do arquivo**

Spec Playwright permanente para validar a Story 4.3 ponta a ponta contra backend/frontend reais.

**Funcao geral da alteracao**

Arquivo novo com um teste integrado de revisao semanal, revisao mensal, pull do Future Log e confirmacao de data.

**Blocos principais**

- Linhas 1-15: imports e comentario de escopo.
- Linhas 17-30: teste principal, timeout e captura de erros de console/page.
- Linhas 31-44: seed do cenario.
- Linhas 46-70: verifica banners e migra tarefa semanal via atalho `1`.
- Linhas 72-87: navega para Weekly Log corrente e confirma pai/filho pendente presentes e filho concluido ausente.
- Linhas 91-118: revisao mensal com flow monthly e data escolhida.
- Linhas 120-139: Monthly Log corrente mostra "Itens do Future Log" antes da tarefa com data.
- Linhas 141-146: confirma data do item sem data.
- Linhas 148-154: volta ao Daily Log e confirma ausencia dos banners resolvidos e de erros.

**Funcoes, classes e importacoes especificas**

- `test`/`expect`: fixtures Playwright do projeto.
- `seedReviewScenario`: prepara banco para o usuario criado pelo fixture.
- `page.waitForResponse`: sincroniza POST `/migrate/` com acao de UI.
- `getByRole`, `getByText`, `getByTestId`: locators semanticos.

**Comportamento de libs usadas**

- Playwright roda browser real, aguarda visibilidade/contagem e interage com teclado/input.
- `page.on('console')` e `page.on('pageerror')` coletam erros para assercao final.

## 10. Testes e contrato cruzado

### `frontend/src/features/bujo/components/MigrationCard.test.tsx`

Ja coberto na secao 8, mas e importante no fluxo de consumo: garante que `flowType` novo nao quebre a variante diaria pre-existente e prova os rótulos/destinos usados pelos banners.

### `frontend/src/features/bujo/components/MigrationFlow.test.tsx`

Ja coberto na secao 8. Este arquivo valida diretamente que a camada de UI chama `useMigrateTaskMutation` com destinos compativeis com `TaskMigrateSerializer`.

### `frontend/src/api/types.gen.ts` e `schema.yaml`

Ja cobertos na secao 4. Sao arquivos gerados; nao foram inspecionados linha por linha alem dos grupos relevantes porque seu papel e refletir os serializers/views.

## 11. Encadeamento produtor-consumidor

- `backend/bujo/serializers.py` define `WeeklyReviewQueueSerializer`, `MonthlyReviewQueueSerializer`, `scheduled_date` e destino `"week"`.
- `backend/bujo/views.py` usa esses serializers nas novas views e no PATCH de task.
- `backend/bujo/urls.py` expoe as views em `/api/bujo/weekly-review/queue/` e `/api/bujo/monthly-review/queue/`.
- `schema.yaml` registra esses endpoints/schemas.
- `frontend/src/api/types.gen.ts` gera os tipos usados por `frontend/src/features/bujo/types.ts`.
- `frontend/src/api/keys.ts` e `frontend/src/features/bujo/api.ts` criam cache keys, hooks e mutacoes para consumir os endpoints.
- `frontend/src/features/bujo/index.ts` disponibiliza hooks/componentes para paginas.
- `WeeklyReviewBanner` e `MonthlyReviewBanner` consomem as filas e abrem `MigrationFlow`.
- `MigrationFlow` repassa `flowType` para `MigrationCard` e chama `useMigrateTaskMutation`.
- `DailyPage` monta os banners.
- `MonthlyPage` usa `useUpdateTaskMutation` para confirmar data de itens sem `scheduledDate`.
- Testes backend validam servico e HTTP; testes frontend validam hooks/componentes/paginas; Playwright valida fluxo real completo.

## 12. Validacao registrada

Este relatorio nao executou novas suites de teste; ele documenta os arquivos nao commitados. A propria story/test-summary registram execucoes anteriores: backend 249 passed, frontend 323 passed, lint/typecheck/build limpos e E2E alvo `weekly-monthly-review.spec.ts` verde isoladamente, com um flake pre-existente em `migration-flow.spec.ts` na suite completa.
