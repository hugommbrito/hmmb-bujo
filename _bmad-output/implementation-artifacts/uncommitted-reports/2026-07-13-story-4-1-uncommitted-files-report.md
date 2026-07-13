# Explicacao dos arquivos nao commitados - Story 4.1 Logs Weekly, Monthly e Future

## Visao geral

O conjunto de mudancas implementa a Story 4.1 do Epic 4: Weekly Log, Monthly Log e Future Log. A base de dados ganha `weekly_log` e `monthly_log`; `Task` passa a pertencer exatamente a um container (`log`, `weekly_log` ou `monthly_log`) e pode ter `scheduled_date`; o backend expoe endpoints de leitura semanal/mensal/futura e criacao de tarefa mensal; o contrato OpenAPI e os tipos TS foram regenerados; o frontend troca placeholders por telas reais de planejamento; os testes cobrem constraints, servicos, views, hooks, componentes, paginas e acessibilidade.

## Ordem logica de funcionamento

1. Artefatos BMad registram que a Story 4.1 foi executada, revisada e marcada como done.
2. A arquitetura documenta a generalizacao `Task` -> daily/weekly/monthly e a decisao de que Future Log e `monthly_log` futuro.
3. Models e migration criam os containers semanais/mensais e as constraints de calendario/container unico.
4. Admin, servicos e serializers permitem materializar logs, criar tarefas em qualquer container e serializar as novas visoes.
5. Views e URLs publicam `/logs/weekly/`, `/logs/monthly/` e `/future-log/`.
6. `schema.yaml` e `types.gen.ts` levam o contrato para o frontend.
7. Query keys, hooks e tipos frontend acessam os novos endpoints.
8. Componentes e paginas renderizam Weekly, Monthly e Future Log.
9. Testes backend/frontend validam comportamento, regressao e acessibilidade.

## 1. Artefatos de planejamento, sprint e automacao

### `_bmad-output/implementation-artifacts/4-1-logs-weekly-monthly-e-future.md`

**Funcao geral do arquivo**

Artefato de historia da Story 4.1. E documentacao/processo, nao codigo executavel.

**Funcao geral da alteracao**

Arquivo novo que consolida acceptance criteria, tasks, dev notes, completion notes, code review e file list da entrega.

**Blocos principais**

- Linhas 5-33: historia e acceptance criteria para weekly/monthly/future log.
- Linhas 40-171: checklist de implementacao backend, migration, servicos, serializers, views, contrato e testes.
- Linhas 172-218: checklist frontend para keys, hooks, componentes, paginas e rotas.
- Linhas 220-247: decisoes de design: Future Log como `monthly_log` futuro, `core/calendar.py` como autoridade temporal e camelCase automatico.
- Linhas 300-317: completion notes e resultado de code review.
- Linhas 318-354: file list da story.

**Funcoes, classes e importacoes especificas**

- Nao define simbolos runtime; referencia `WeeklyLog`, `MonthlyLog`, `Task`, `WeeklyLogView`, `MonthlyLogView`, `FutureLogView` e hooks React como contrato de implementacao.

**Comportamento de libs usadas**

- Nao usa libs em runtime.

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Funcao geral do arquivo**

Rastreador YAML do estado das historias/epicos.

**Funcao geral da alteracao**

Marca `last_updated` como 2026-07-13, muda `epic-4` para `in-progress` e `4-1-logs-weekly-monthly-e-future` para `done`.

**Blocos principais**

- Linhas 35-71: metadados e `development_status`; a mudanca esta no status do Epic 4 e da Story 4.1.

**Funcoes, classes e importacoes especificas**

- Nao aplicavel; arquivo de dados.

**Comportamento de libs usadas**

- YAML e consumido por tooling BMad/story automator como estado serializado.

### `_bmad-output/planning-artifacts/architecture.md`

**Funcao geral do arquivo**

Documento-fonte de arquitetura do produto.

**Funcao geral da alteracao**

Atualiza o schema conceitual de `tasks`, corrige referencias de `core/time.py` para `core/calendar.py` e documenta Future Log como Monthly Log futuro.

**Blocos principais**

- Linhas 166-182: `tasks` passa a ter `log_id` nulavel, `weekly_log_id`, `monthly_log_id` e `scheduled_date`.
- Linhas 182-184: nota explicita do CHECK `task_exactly_one_log`.
- Linhas 198 e 262: autoridade temporal corrigida para `core/calendar.py`.
- Linhas 283-286: Future Log = `monthly_log` futuro; escrita via `POST /api/bujo/logs/monthly/`.

**Funcoes, classes e importacoes especificas**

- Referencia `today_for`, `week_start_of`, `weeks_of_month`, `months_of_week`.

**Comportamento de libs usadas**

- Nao usa libs em runtime; serve como contrato de arquitetura.

### `_bmad/custom/bmad-dev-story.toml`

**Funcao geral do arquivo**

Override de comportamento persistente para a skill de desenvolvimento de story.

**Funcao geral da alteracao**

Expande fatos persistentes vindos da retro do Epic 3, adicionando guardrails condicionais para auth/OpenAPI e migracao de subarvore na Story 4.2.

**Blocos principais**

- Linhas 1-6: comentario de origem agora inclui itens de qualidade #4 e #5.
- Linhas 10-15: novos fatos persistentes para checar `security`/`securitySchemes` quando auth mudar e priorizar teste de subarvore na 4.2.

**Funcoes, classes e importacoes especificas**

- Nao define codigo; configura a automacao BMad.

**Comportamento de libs usadas**

- TOML e lido pelo tooling BMad como configuracao estruturada.

### `_bmad-output/story-automator/*.md|*.json`

**Funcao geral dos arquivos**

Artefatos de automacao da execucao do Epic 4.

**Funcao geral da alteracao**

Arquivos novos registram inicializacao, preflight, complexidade, plano de agentes, estado de orquestracao e snapshot de politicas.

**Blocos principais**

- `init-log-20260712-231855.md`, linha 1: decisao de iniciar Epic 4 fresco.
- `preflight-4-20260712-232251.md`, linhas 1-17: snapshot de historias 4.1-4.6 e complexidades.
- `complexity-orchestration-4-20260712-232806.json`, linha 1: classificacao de complexidade por story.
- `agents/agents-orchestration-4-20260712-232806.md`, linhas 8-156: plano JSON de agentes por story.
- `orchestration-4-20260712-232806.md`, linhas 1-34: estado da orquestracao; linhas 53-78: progresso e action log.
- `policy-snapshots/20260712-232806-79b3b368.json`, linhas 16-244: politica de passos create/dev/auto/review/retro.

**Funcoes, classes e importacoes especificas**

- Nao definem simbolos runtime; descrevem `create`, `dev`, `auto`, `review`, `retro`.

**Comportamento de libs usadas**

- Markdown e JSON sao consumidos por tooling de automacao e verificacao.

## 2. Modelo de dados, migration e admin

### `backend/bujo/models.py`

**Funcao geral do arquivo**

Define os modelos persistidos do BuJo: daily log e tarefas tenant-scoped.

**Funcao geral da alteracao**

Adiciona `WeeklyLog` e `MonthlyLog`; generaliza `Task` para daily/weekly/monthly; adiciona `scheduled_date`; adiciona CHECK de exatamente um container.

**Blocos principais**

- Linhas 27-42: `WeeklyLog` com `week_start`, `body`, `db_table="weekly_log"`, unique por `(user_id, week_start)` e CHECK de segunda-feira.
- Linhas 45-64: `MonthlyLog` com `month_first`, `body`, unique por `(user_id, month_first)` e CHECK de dia 1.
- Linhas 100-111: `Task.log` vira opcional; entram `weekly_log`, `monthly_log` e `scheduled_date`.
- Linhas 153-160: constraint `task_exactly_one_log`.

**Funcoes, classes e importacoes especificas**

- `TenantModel`: fornece UUID PK, `user_id` e managers tenant-scoped.
- `models.ForeignKey(..., on_delete=models.CASCADE)`: apaga tarefas quando o container for apagado.
- `models.JSONField(default=dict, blank=True)`: guarda metadados futuros sem compartilhar dict mutavel entre instancias.
- `models.CheckConstraint`/`models.UniqueConstraint`: delegam invariantes ao banco.

**Comportamento de libs usadas**

- Django ORM transforma lookups como `week_start__iso_week_day=1` e `month_first__day=1` em SQL de constraint. `TextChoices` gera choices e valores enumerados para validacao/serializacao.

### `backend/bujo/migrations/0003_weekly_monthly_log.py`

**Funcao geral do arquivo**

Migration de schema gerada pelo Django.

**Funcao geral da alteracao**

Cria tabelas `monthly_log` e `weekly_log`, altera `tasks.log` para nulavel, adiciona FKs e `scheduled_date`, e cria `task_exactly_one_log`.

**Blocos principais**

- Linhas 15-24: `scheduled_date` e `log` nulavel em `Task`.
- Linhas 25-37: `CreateModel MonthlyLog`.
- Linhas 38-42: FK `monthly_log` em `Task`.
- Linhas 43-55: `CreateModel WeeklyLog`.
- Linhas 56-64: FK `weekly_log` e CHECK de container unico.

**Funcoes, classes e importacoes especificas**

- `migrations.CreateModel`, `AddField`, `AlterField`, `AddConstraint`.

**Comportamento de libs usadas**

- Django migrations aplicam operacoes em ordem; como as novas FKs sao nulaveis, linhas daily existentes continuam validas.

### `backend/bujo/admin.py`

**Funcao geral do arquivo**

Registra models no Django admin usando `all_objects` por operar fora do tenant context de request de negocio.

**Funcao geral da alteracao**

Registra `WeeklyLog` e `MonthlyLog`; expande `TaskAdmin` para exibir os novos containers e `scheduled_date`.

**Blocos principais**

- Linhas 9-10: import dos novos models.
- Linhas 22-39: admins de Weekly/Monthly com filtros por data.
- Linhas 44-55: lista de colunas de Task inclui `weekly_log`, `monthly_log`, `scheduled_date`.

**Funcoes, classes e importacoes especificas**

- `admin.register`: associa model a uma `ModelAdmin`.
- `get_queryset`: troca o manager padrao por `all_objects` para operador enxergar todos os tenants.

**Comportamento de libs usadas**

- Django admin chama `list_display`, `list_filter` e `search_fields` para montar a UI administrativa.

## 3. Servicos, serializers, views e URLs backend

### `backend/bujo/services/logs.py`

**Funcao geral do arquivo**

Materializacao idempotente dos logs.

**Funcao geral da alteracao**

Adiciona funcoes para weekly e monthly log no mesmo padrao de daily log.

**Blocos principais**

- Linhas 8-17: daily log pre-existente.
- Linhas 20-28: `get_or_create_weekly_log`.
- Linhas 31-39: `get_or_create_monthly_log`.

**Funcoes, classes e importacoes especificas**

- `transaction.atomic`: executa cada get-or-create em transacao.
- `WeeklyLog.objects.get_or_create`/`MonthlyLog.objects.get_or_create`: busca por chave tenant-scoped e cria se ausente.

**Comportamento de libs usadas**

- `get_or_create` retorna `(obj, created)`; o codigo ignora `created` e retorna o objeto. O manager `objects` aplica tenant scoping pelo contexto atual.

### `backend/bujo/services/tasks.py`

**Funcao geral do arquivo**

Servicos de criacao, edicao e reordenacao de tarefas.

**Funcao geral da alteracao**

`create_task` passa a aceitar os tres containers e `scheduled_date`; `reorder_task` filtra irmaos pelo container completo.

**Blocos principais**

- Linhas 11-47: `create_task` calcula `order_index` por `(log, weekly_log, monthly_log, parent_task)` e cria a tarefa.
- Linhas 69-78: `reorder_task` escopa siblings pelo mesmo container completo.

**Funcoes, classes e importacoes especificas**

- `models.Max("order_index")`: agrega o maior indice atual entre irmaos.
- `Task.objects.filter(... None ...)`: em Django, `field=None` vira `IS NULL`, preservando o filtro de containers nulos.
- `InvalidReorderTarget`: sinaliza alvo invalido quando nao e irmao real.

**Comportamento de libs usadas**

- `transaction.atomic` garante que calculo de indice e escrita sejam uma unidade. `QuerySet.exclude` e `order_by` montam a lista de irmaos antes da bissecao de indice.

### `backend/bujo/serializers.py`

**Funcao geral do arquivo**

Serializers DRF para leitura/escrita do BuJo.

**Funcao geral da alteracao**

Expande `TaskSerializer` com `scheduled_date`; adiciona serializers de weekly, monthly, future e criacao mensal.

**Blocos principais**

- Linhas 12-29: `TaskSerializer` inclui `scheduled_date` e subtarefas recursivas.
- Linhas 78-87: `WeeklyDaySerializer` e `WeeklyLogSerializer`.
- Linhas 89-97: `MonthlyLogSerializer` e `FutureLogMonthGroupSerializer`.
- Linhas 100-126: `MonthlyTaskCreateSerializer` valida `month_first` dia 1 e `scheduled_date` dentro do mesmo mes.

**Funcoes, classes e importacoes especificas**

- `serializers.ModelSerializer`: deriva campos de `Task`.
- `SerializerMethodField`: renderiza subtarefas dinamicamente.
- `extend_schema_field`: informa ao drf-spectacular o schema de campos computados.
- `ChoiceField`: valida enums de `Task.Eisenhower` e `Task.Category`.

**Comportamento de libs usadas**

- DRF `DateField` parseia ISO date e renderiza date. O middleware/config de camelCase converte snake_case (`scheduled_date`) para camelCase (`scheduledDate`) na borda.

### `backend/bujo/views.py`

**Funcao geral do arquivo**

Views DRF finas: validam request, chamam servicos e serializam resposta.

**Funcao geral da alteracao**

Subtarefas herdam container do pai; adiciona views semanais, mensais e futuras.

**Blocos principais**

- Linhas 67-84: `SubtaskCreateView` passa `log`, `weekly_log` e `monthly_log` do pai para `create_task`.
- Linhas 122-149: `WeeklyLogView` normaliza `week_start`, materializa log, monta 7 dias e tarefas sem dia.
- Linhas 152-169: `MonthlyLogView.get` normaliza `month_first` e retorna tarefas raiz do mes.
- Linhas 171-188: `MonthlyLogView.post` cria tarefa em `monthly_log` com `scheduled_date` opcional.
- Linhas 191-211: `FutureLogView` retorna monthly logs futuros com tarefas raiz agrupadas por mes.

**Funcoes, classes e importacoes especificas**

- `date.fromisoformat`: parseia query params; erros viram `serializers.ValidationError` 400.
- `today_for`: calcula hoje no timezone do usuario.
- `week_start_of`: normaliza qualquer data da semana para segunda-feira.
- `Count(..., filter=Q(...))`: anota quantidade de tarefas raiz por monthly log.
- `extend_schema`: publica request/response para OpenAPI.

**Comportamento de libs usadas**

- DRF `APIView` despacha metodos HTTP e `Response` serializa payload. `ValidationError` vira 400. Django ORM filtra e ordena logs futuros antes da serializacao.

### `backend/bujo/urls.py`

**Funcao geral do arquivo**

Tabela de rotas do app BuJo.

**Funcao geral da alteracao**

Inclui rotas para weekly, monthly e future log sem alterar as rotas diarias/tarefas existentes.

**Blocos principais**

- Linhas 4-14: imports das novas views.
- Linhas 18-20: novas rotas `logs/weekly/`, `logs/monthly/`, `future-log/`.

**Funcoes, classes e importacoes especificas**

- `path`: mapeia URL relativa para `APIView.as_view()` e nomeia a rota.

**Comportamento de libs usadas**

- Django URL resolver usa esses patterns sob o prefixo da API configurado no projeto.

## 4. Contrato OpenAPI e tipos gerados

### `schema.yaml`

**Funcao geral do arquivo**

Contrato OpenAPI gerado pelo backend.

**Funcao geral da alteracao**

Adiciona paths de weekly/monthly/future, schemas dos novos payloads e `scheduledDate` em `Task`.

**Blocos principais**

- Linhas 57-119: paths `/api/bujo/future-log/`, `/api/bujo/logs/monthly/`, `/api/bujo/logs/weekly/`.
- Linhas 294-376: schemas `FutureLogMonthGroup`, `MonthlyLog`, `MonthlyTaskCreate`.
- Linhas 443-479: `Task.scheduledDate`.
- Linhas 542-572: schemas `WeeklyDay` e `WeeklyLog`.

**Funcoes, classes e importacoes especificas**

- Nao define funcoes; e gerado a partir de serializers/views com `drf-spectacular`.

**Comportamento de libs usadas**

- `drf-spectacular` le serializers DRF e `extend_schema` para gerar paths, request bodies, responses e security.

### `frontend/src/api/types.gen.ts`

**Funcao geral do arquivo**

Tipos TypeScript gerados de `schema.yaml`.

**Funcao geral da alteracao**

Reflete os novos endpoints/schemas e adiciona `scheduledDate` ao tipo `Task`.

**Blocos principais**

- Linhas 60-124: novos paths tipados.
- Linhas 228-325: schemas `FutureLogMonthGroup`, `MonthlyLog`, `MonthlyTaskCreate`.
- Linhas 287-289: `Task.scheduledDate`.
- Linhas 325-342: `WeeklyDay` e `WeeklyLog`.
- Linhas 409-514: operations para future/monthly/weekly.

**Funcoes, classes e importacoes especificas**

- `paths`, `components`, `operations`: interfaces geradas para uso por `openapi-typescript`.

**Comportamento de libs usadas**

- `openapi-typescript` converte OpenAPI em tipos estruturais TS; camelCase ja vem do schema gerado.

## 5. Frontend: configuracao, data layer e rotas

### `frontend/package.json` e `frontend/package-lock.json`

**Funcao geral dos arquivos**

Manifesto e lockfile npm do frontend.

**Funcao geral da alteracao**

Atualizam `@types/node` de `^24.13.2` para `^24.13.3`.

**Blocos principais**

- `package.json`, linha 35: versao declarada.
- `package-lock.json`, linhas 25 e 1763-1769: pacote resolvido, URL e integridade.

**Funcoes, classes e importacoes especificas**

- Nao aplicavel.

**Comportamento de libs usadas**

- npm usa `package-lock.json` para instalacao reprodutivel.

### `frontend/src/api/keys.ts`

**Funcao geral do arquivo**

Define query keys canonicas do TanStack Query.

**Funcao geral da alteracao**

Adiciona keys para weekly, monthly e future log.

**Blocos principais**

- Linhas 13-18: `weeklyLog`, `monthlyLog`, `futureLog` entram na secao `bujo`.

**Funcoes, classes e importacoes especificas**

- `as const`: preserva tuplas literais para keys estaveis e tipadas.

**Comportamento de libs usadas**

- TanStack Query usa essas arrays para cache, invalidacao e deduplicacao de requests.

### `frontend/src/features/bujo/types.ts`

**Funcao geral do arquivo**

Exports de tipos de dominio BuJo derivados do contrato gerado.

**Funcao geral da alteracao**

Exporta `WeeklyDay`, `WeeklyLog`, `MonthlyLog` e `FutureLogMonthGroup`.

**Blocos principais**

- Linhas 1-8: aliases de `components['schemas'][...]`.

**Funcoes, classes e importacoes especificas**

- `components` vem de `types.gen.ts`.

**Comportamento de libs usadas**

- TypeScript resolve os aliases em compile-time; nao ha runtime.

### `frontend/src/features/bujo/api.ts`

**Funcao geral do arquivo**

Hooks de API e mutations da feature BuJo.

**Funcao geral da alteracao**

Adiciona queries para weekly/monthly/future e mutation de criacao mensal.

**Blocos principais**

- Linhas 1-15: imports de `useMutation`, `useQueryClient` e novos tipos.
- Linhas 163-175: `fetchWeeklyLog` e `useWeeklyLogQuery`.
- Linhas 177-189: `fetchMonthlyLog` e `useMonthlyLogQuery`.
- Linhas 191-201: `fetchFutureLog` e `useFutureLogQuery`.
- Linhas 203-226: `useCreateMonthlyTaskMutation` com invalidacao de monthly e future log.

**Funcoes, classes e importacoes especificas**

- `client.get`/`client.post`: cliente HTTP Axios-like compartilhado.
- `useQuery`: busca e cacheia dados por `queryKey`.
- `useMutation`: executa POST e chama `onSuccess`.
- `useQueryClient.invalidateQueries`: marca caches como stale e dispara refetch conforme uso.

**Comportamento de libs usadas**

- TanStack Query separa queries por chave. A mutation invalida o mes especifico e a lista futura porque o mesmo POST pode criar tarefa do mes corrente ou futuro.

### `frontend/src/features/bujo/index.ts`

**Funcao geral do arquivo**

Barrel export da feature BuJo.

**Funcao geral da alteracao**

Reexporta hooks e tipos novos para paginas importarem de uma unica fronteira.

**Blocos principais**

- Linhas 1-13: hooks novos reexportados.
- Linhas 14-23: tipos novos reexportados.

**Funcoes, classes e importacoes especificas**

- Exports TypeScript/ESM.

**Comportamento de libs usadas**

- Bundler resolve reexports sem criar logica adicional.

### `frontend/src/app/router.tsx`

**Funcao geral do arquivo**

Define rotas React Router da aplicacao.

**Funcao geral da alteracao**

Troca placeholders de `/planner/week`, `/planner/month` e `/planner/future` por paginas reais.

**Blocos principais**

- Linhas 10-12: imports de `WeeklyPage`, `MonthlyPage`, `FuturePage`.
- Linhas 61-75: tres rotas de planner usam os novos componentes.

**Funcoes, classes e importacoes especificas**

- `createBrowserRouter`, `RouteObject`, `Navigate`: APIs do React Router.

**Comportamento de libs usadas**

- React Router renderiza a rota filha dentro de `AppLayout` e usa `handle.title` como metadata de navegacao/layout.

## 6. Frontend: componentes e paginas

### `frontend/src/features/bujo/components/TaskRow.tsx`

**Funcao geral do arquivo**

Renderiza uma linha de tarefa, com status, chips, subtarefas e reorder quando habilitado.

**Funcao geral da alteracao**

Permite modo somente-leitura quando `onTransition`, `onOpenDetail` e `onReorder` nao sao passados.

**Blocos principais**

- Linhas 55-64: props de interacao viram opcionais.
- Linhas 82-86: clique de status retorna se nao houver `onTransition`.
- Linhas 171-179: botao de status fica desabilitado sem handler.
- Linhas 180-212: titulo vira botao apenas se houver `onOpenDetail`; caso contrario e texto.
- Linhas 240-274: UI de mover aparece apenas com `onReorder`.
- Linhas 275-285: subtarefas preservam handlers recebidos.

**Funcoes, classes e importacoes especificas**

- `useMediaQuery`: alterna comportamento desktop/mobile.
- Icones MUI (`TaskAltIcon`, `DragIndicatorIcon`, etc.): representam status/acoes.
- `MoveTaskDialog`: so montado quando reordenacao existe.

**Comportamento de libs usadas**

- MUI `IconButton`, `Chip`, `Typography` e `Box` renderizam componentes acessiveis/estilizados. React state controla anuncio ARIA, drag-over e dialog.

### `frontend/src/features/bujo/components/WeekDaySelector.tsx`

**Funcao geral do arquivo**

Seletor horizontal de dias para o Weekly Log mobile.

**Funcao geral da alteracao**

Arquivo novo.

**Blocos principais**

- Linhas 3-7: contrato de props.
- Linhas 14-22: `formatDayChipLabel` parseia ISO manualmente e formata `SEG 13`.
- Linhas 26-45: renderiza `Chip`s com role `tab`.

**Funcoes, classes e importacoes especificas**

- `Intl.DateTimeFormat('pt-BR').formatToParts`: formata weekday e dia sem depender de split localizado.
- MUI `Chip`: botao visual clicavel para cada dia.

**Comportamento de libs usadas**

- `formatToParts` retorna partes tipadas de data; parse manual evita deslocamento por UTC em fusos negativos.

### `frontend/src/features/bujo/components/FutureLogItemForm.tsx`

**Funcao geral do arquivo**

Formulario para adicionar item ao Future Log.

**Funcao geral da alteracao**

Arquivo novo.

**Blocos principais**

- Linhas 5-13: tipos de campos e props.
- Linhas 17-34: estado local e submit; gera `monthFirst` e `scheduledDate` opcional.
- Linhas 37-69: formulario MUI com titulo, mes, dia opcional e botao.

**Funcoes, classes e importacoes especificas**

- `useState`: controla inputs.
- `FormEvent`: tipa submit.
- MUI `TextField` com `type="month"` e `type="number"`.

**Comportamento de libs usadas**

- Input nativo `month` retorna `YYYY-MM`; o componente converte para `YYYY-MM-01`, contrato exigido pelo backend.

### `frontend/src/features/bujo/components/PlannerSkeleton.tsx`

**Funcao geral do arquivo**

Skeleton de carregamento comum das paginas de planner.

**Funcao geral da alteracao**

Arquivo novo.

**Blocos principais**

- Linhas 3-14: define quatro linhas de placeholder e um header skeleton.

**Funcoes, classes e importacoes especificas**

- MUI `Skeleton`: renderiza placeholders visuais.

**Comportamento de libs usadas**

- `Array.from({ length })` cria linhas fixas sem depender de dados remotos.

### `frontend/src/pages/planner/WeeklyPage.tsx`

**Funcao geral do arquivo**

Pagina do Weekly Log.

**Funcao geral da alteracao**

Arquivo novo que busca o weekly log e renderiza layout desktop/mobile.

**Blocos principais**

- Linhas 9-25: carrega dados, detecta mobile e controla dia selecionado.
- Linhas 27-48: mobile mostra `WeekDaySelector` e um unico `DayHeader`.
- Linhas 49-71: desktop mostra 7 colunas lado a lado.
- Linhas 72-81: secao de tarefas sem dia definido.

**Funcoes, classes e importacoes especificas**

- `useWeeklyLogQuery`: busca `/api/bujo/logs/weekly/`.
- `useMediaQuery('(max-width: 767px)')`: breakpoint canonico.
- `DayHeader`, `TaskRow`, `PlannerSkeleton`, `WeekDaySelector`.

**Comportamento de libs usadas**

- React renderiza condicionalmente pelo estado do query. MUI flex com `minWidth: 0` evita overflow horizontal no desktop.

### `frontend/src/pages/planner/MonthlyPage.tsx`

**Funcao geral do arquivo**

Pagina do Monthly Log.

**Funcao geral da alteracao**

Arquivo novo que agrupa tarefas por `scheduledDate`, mostra tarefas sem dia e cria novas tarefas no mes.

**Blocos principais**

- Linhas 10-29: `groupTasksByScheduledDate`.
- Linhas 31-49: query/mutation e estado local.
- Linhas 50-65: submit gera `scheduledDate` opcional e chama mutation com refetch local.
- Linhas 67-123: renderizacao de vazio, grupos por dia, sem dia e formulario.

**Funcoes, classes e importacoes especificas**

- `useMonthlyLogQuery`, `useCreateMonthlyTaskMutation`.
- `Map`: agrupa por string de data.
- `DayHeader` e `TaskRow`: reuso visual da daily/weekly.

**Comportamento de libs usadas**

- MUI `TextField` e `Button` montam formulario. O refetch local compensa o query key ativo `current`, diferente da invalidacao por `monthFirst` explicito.

### `frontend/src/pages/planner/FuturePage.tsx`

**Funcao geral do arquivo**

Pagina do Future Log.

**Funcao geral da alteracao**

Arquivo novo que lista meses futuros agrupados e permite adicionar item futuro via mutation mensal.

**Blocos principais**

- Linhas 8-36: nomes e abreviacoes de meses.
- Linhas 38-50: formatacao de titulo de grupo e prefixo `(dia)` ou `-- mes`.
- Linhas 52-64: queries/mutation e skeleton.
- Linhas 66-93: formulario, vazio e lista agrupada por mes.

**Funcoes, classes e importacoes especificas**

- `useFutureLogQuery`: busca grupos futuros.
- `useCreateMonthlyTaskMutation`: mesmo write path do monthly.
- `FutureLogItemForm`, `TaskRow`, `PlannerSkeleton`.

**Comportamento de libs usadas**

- React mapeia grupos e tarefas; MUI `Box`/`Typography` estruturam lista.

## 7. Testes backend

### `backend/bujo/tests/factories.py`

**Funcao geral do arquivo**

Factories para testes Django com `factory_boy`.

**Funcao geral da alteracao**

Adiciona factories de weekly/monthly e ajusta `TaskFactory` para nao preencher dois containers.

**Blocos principais**

- Linhas 33-58: `WeeklyLogFactory` e `MonthlyLogFactory`.
- Linhas 68-79: `TaskFactory.log` vira `LazyAttribute` condicional.

**Funcoes, classes e importacoes especificas**

- `DjangoModelFactory`: cria instancias ORM.
- `factory.Sequence`: gera datas unicas.
- `factory.SelfAttribute`: passa usuario da factory pai.
- `week_start_of`: garante segunda-feira.

**Comportamento de libs usadas**

- `factory_boy` avalia lazy attributes no momento de build/create, permitindo sobrescrever `weekly_log`/`monthly_log` em testes.

### `backend/bujo/tests/test_models.py`

**Funcao geral do arquivo**

Testa constraints de schema dos models BuJo.

**Funcao geral da alteracao**

Adiciona testes para CHECKs de calendario, unique constraints, CHECK de container unico e `scheduled_date` nulavel.

**Blocos principais**

- Linhas 86-107: WeeklyLog invalido/valido/unique.
- Linhas 110-131: MonthlyLog invalido/valido/unique.
- Linhas 134-162: Task com nenhum/dois/exatamente um container.
- Linhas 165-174: `scheduled_date` com e sem valor.

**Funcoes, classes e importacoes especificas**

- `pytest.raises(IntegrityError)` com `transaction.atomic`: isola rollback do erro esperado.
- `tenant_context`: seta tenant corrente para managers.

**Comportamento de libs usadas**

- pytest marca `django_db` para acesso ao banco; Django levanta `IntegrityError` quando o banco rejeita constraints.

### `backend/bujo/tests/test_serializers.py`

**Funcao geral do arquivo**

Valida contrato de serializers.

**Funcao geral da alteracao**

Inclui `scheduled_date` no conjunto esperado de campos de `TaskSerializer`.

**Blocos principais**

- Linhas 33-40: assertion de campos inclui `scheduled_date`.

**Funcoes, classes e importacoes especificas**

- Usa DRF serializer real para verificar schema exposto.

**Comportamento de libs usadas**

- pytest compara sets para evitar dependencia de ordem.

### `backend/bujo/tests/test_services.py`

**Funcao geral do arquivo**

Testa regras de servico de logs, task lifecycle e reorder.

**Funcao geral da alteracao**

Adiciona testes de idempotencia/tenant para weekly/monthly, criacao mensal com `scheduled_date`, subtarefa herdando container e reorder daily com filtro ampliado.

**Blocos principais**

- Linhas 273-312: get-or-create weekly/monthly idempotente e tenant-scoped.
- Linhas 315-333: create task mensal calcula order por container.
- Linhas 336-350: subtarefa em weekly herda container.
- Linhas 353-366: reorder daily continua correto.

**Funcoes, classes e importacoes especificas**

- `get_or_create_weekly_log`, `get_or_create_monthly_log`, `create_task`, `reorder_task`.

**Comportamento de libs usadas**

- Django ORM count/get valida persistencia real; pytest fixtures fornecem usuarios isolados.

### `backend/bujo/tests/test_views.py`

**Funcao geral do arquivo**

Testa endpoints BuJo via DRF `APIClient`.

**Funcao geral da alteracao**

Adiciona cobertura para weekly, monthly, future e subtarefas monthly.

**Blocos principais**

- Linhas 456-519: Weekly GET corrente, normalizacao, 400 em data invalida e tenant scoping.
- Linhas 525-593: Monthly GET/POST, validacoes 400, `scheduledDate` dentro/fora do mes.
- Linhas 599-658: Future Log agrupado, exclui mes corrente e logs sem tarefas, cria item futuro via POST monthly.
- Linhas 664-679: subtarefa de monthly herda `monthly_log`.

**Funcoes, classes e importacoes especificas**

- `APIClient`: dispara requests autenticados.
- `AccessToken`: autentica usuario nos testes existentes.
- `today_for`, `week_start_of`: valores esperados de calendario.

**Comportamento de libs usadas**

- DRF test client serializa JSON e retorna `response.data`; status 400/200/201 validam bordas da API.

## 8. Testes frontend

### `frontend/src/features/bujo/api.test.tsx`

**Funcao geral do arquivo**

Testa hooks de API da feature BuJo.

**Funcao geral da alteracao**

Adiciona testes para weekly, monthly, future e criacao mensal.

**Blocos principais**

- Linhas 309-351: fixtures `WEEKLY_LOG`, `MONTHLY_LOG`, `FUTURE_LOG_GROUPS`.
- Linhas 353-379: `useWeeklyLogQuery`.
- Linhas 381-407: `useMonthlyLogQuery`.
- Linhas 409-423: `useFutureLogQuery`.
- Linhas 425-452: `useCreateMonthlyTaskMutation` e invalidacoes.

**Funcoes, classes e importacoes especificas**

- `renderHook`, `waitFor`: testam hooks assicronos.
- `vi.fn`/`vi.spyOn`: mocks de client e query client.

**Comportamento de libs usadas**

- TanStack Query executa query/mutation dentro de provider de teste; Vitest espiona chamadas HTTP e invalidacoes.

### `frontend/src/features/bujo/components/TaskRow.test.tsx`

**Funcao geral do arquivo**

Testa comportamentos de `TaskRow`.

**Funcao geral da alteracao**

Adiciona suite de modo somente-leitura.

**Blocos principais**

- Linhas 209-264: render sem handlers, status desabilitado, titulo nao clicavel e draggable false.

**Funcoes, classes e importacoes especificas**

- `ThemeProvider`, `createBujoTheme`: render real com tema.
- `screen.getByRole`/`queryByRole`: asserts de acessibilidade.

**Comportamento de libs usadas**

- Testing Library observa a UI como usuario; `matchMedia` e mockado para estabilizar layout.

### `frontend/src/features/bujo/components/WeekDaySelector.test.tsx`

**Funcao geral do arquivo**

Testa o seletor de dias da semana.

**Funcao geral da alteracao**

Arquivo novo.

**Blocos principais**

- Linhas 27-49: renderiza 7 tabs, clique chama `onSelect`, `aria-selected`.
- Linhas 51-55: `jest-axe` sem violacoes.

**Funcoes, classes e importacoes especificas**

- `axe`: auditoria automatizada de acessibilidade.
- `fireEvent`: simula clique.

**Comportamento de libs usadas**

- `jest-axe` analisa DOM renderizado e retorna violacoes WCAG comuns.

### `frontend/src/features/bujo/components/FutureLogItemForm.test.tsx`

**Funcao geral do arquivo**

Testa formulario do Future Log.

**Funcao geral da alteracao**

Arquivo novo.

**Blocos principais**

- Linhas 17-41: submit com mes apenas e com dia.
- Linhas 43-69: bloqueia submit incompleto e limpa campo apos sucesso.
- Linhas 71-75: `jest-axe`.

**Funcoes, classes e importacoes especificas**

- `fireEvent.change` e `fireEvent.click`: simulam preenchimento e submit.

**Comportamento de libs usadas**

- Testing Library consulta por labels reais, validando acessibilidade dos campos.

### `frontend/src/pages/planner/WeeklyPage.test.tsx`

**Funcao geral do arquivo**

Testa a pagina semanal.

**Funcao geral da alteracao**

Arquivo novo.

**Blocos principais**

- Linhas 58-70: skeleton.
- Linhas 72-89: desktop e mobile.
- Linhas 91-117: sem dia definido e modo somente-leitura.
- Linhas 119-134: acessibilidade desktop/mobile.

**Funcoes, classes e importacoes especificas**

- Mock de `useWeeklyLogQuery` e `window.matchMedia`.

**Comportamento de libs usadas**

- Vitest mocka o modulo da feature para isolar a pagina da rede/cache.

### `frontend/src/pages/planner/MonthlyPage.test.tsx`

**Funcao geral do arquivo**

Testa a pagina mensal.

**Funcao geral da alteracao**

Arquivo novo.

**Blocos principais**

- Linhas 52-75: skeleton e estado vazio.
- Linhas 77-93: agrupamento por dia e TaskRow somente-leitura.
- Linhas 95-122: formulario cria tarefa com/sem dia.
- Linhas 124-130: acessibilidade.

**Funcoes, classes e importacoes especificas**

- Mocks de `useMonthlyLogQuery` e `useCreateMonthlyTaskMutation`.

**Comportamento de libs usadas**

- `expect.objectContaining({ onSuccess: expect.any(Function) })` valida que a pagina passa callback local de refetch sem acoplar a implementacao interna.

### `frontend/src/pages/planner/FuturePage.test.tsx`

**Funcao geral do arquivo**

Testa a pagina futura.

**Funcao geral da alteracao**

Arquivo novo.

**Blocos principais**

- Linhas 54-73: skeleton e vazio.
- Linhas 75-99: grupo por mes e prefixos `(14)`/`-- jul`.
- Linhas 101-114: formulario chama mutation.
- Linhas 116-122: acessibilidade.

**Funcoes, classes e importacoes especificas**

- Mock de `useFutureLogQuery` e `useCreateMonthlyTaskMutation`.

**Comportamento de libs usadas**

- Testing Library valida texto final renderizado, incluindo convencao visual de Future Log.

