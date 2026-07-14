# Explicacao dos arquivos nao commitados - Story 4.5 templates de tarefas recorrentes com placement manual

## Visao geral

O conjunto de mudancas implementa a Story 4.5: cadastro de templates recorrentes em tabela propria, placement manual em Weekly/Monthly Log, independencia entre template e instancias criadas, contrato OpenAPI/tipos frontend atualizados, UI em Configuracoes e cobertura backend/frontend/E2E. Tambem atualiza artefatos BMad de story, sprint e testes para marcar a story como concluida.

## Ordem logica de funcionamento

1. Artefatos BMad documentam a story, execucao, QA e status final.
2. Backend cria o modelo persistente `RecurringTaskTemplate` e transforma `Task.source_template_id` em FK real.
3. Servicos e excecoes implementam CRUD de template e placement transacional.
4. Serializers, views e URLs expõem endpoints REST.
5. Schema OpenAPI e tipos TypeScript gerados levam o contrato ao frontend.
6. Hooks TanStack Query consomem os endpoints e invalidam caches afetados.
7. Configuracoes ganha CRUD de recorrentes; Weekly/Monthly ganham placement manual.
8. Testes unitarios, integracao e E2E cobrem AC1/AC2/AC3.

## 1. Artefatos de planejamento, status e QA

### `_bmad-output/implementation-artifacts/4-5-templates-de-tarefas-recorrentes-com-placement-manual.md`

**Funcao geral do arquivo**

Arquivo de story BMad da Story 4.5. E artefato de implementacao, nao codigo fonte.

**Funcao geral da alteracao**

Arquivo novo que registra ACs, tarefas, notas de desenvolvimento, logs, evidencias de teste, lista de arquivos e revisao senior da implementacao.

**Blocos principais**

- Linhas 5-35: define a story e os tres ACs: template separado, placement manual criando snapshot e independencia template/instancia.
- Linhas 37-160: lista as tarefas backend, incluindo model, migration, exception, servico, serializers, views, testes e contrato.
- Linhas 162-216: lista as tarefas frontend, incluindo hooks, pagina de Configuracoes, componentes de placement e integracao em Weekly/Monthly.
- Linhas 254-279: `Dev Agent Record`, com debug log e contagens reais de validacao.
- Linhas 280-317: `File List`, incluindo o E2E novo adicionado na rodada de QA.
- Linhas 318-330: revisao senior, achados corrigidos e aprovacao.

**Funcoes, classes e importacoes especificas**

- Nao possui simbolos executaveis; e documento Markdown.

**Comportamento de libs usadas**

- Markdown: estrutura titulos, listas e blocos de codigo para consumo humano e por agentes BMad.

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Funcao geral do arquivo**

Fonte de verdade do status de sprint/stories BMad.

**Funcao geral da alteracao**

Marca a Story 4.5 como `done` e atualiza `last_updated` para 2026-07-14.

**Blocos principais**

- Linhas alteradas no cabecalho: `last_updated` passa de story 4-4 para story 4-5.
- Linha de `development_status`: `4-5-templates-de-tarefas-recorrentes-com-placement-manual` muda de `backlog` para `done`.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos executaveis.

**Comportamento de libs usadas**

- YAML: estrutura chave/valor usada por automacoes BMad para rastrear status.

### `_bmad-output/implementation-artifacts/tests/test-summary.md`

**Funcao geral do arquivo**

Historico consolidado de QA e automacao de testes por story.

**Funcao geral da alteracao**

Adiciona resumo de automacao da Story 4.5, registrando o gap E2E fechado por `frontend/e2e/recurring-templates.spec.ts`, cobertura por AC e resultado das execucoes.

**Blocos principais**

- Linhas adicionadas 951-965: contexto da Story 4.5 e gap de E2E cross-page.
- Linhas adicionadas 967-978: descrevem os dois testes Playwright novos.
- Linhas adicionadas 980-989: mapeiam ACs para testes existentes e novos.
- Linhas adicionadas 991-1001: comandos/resultados de execucao.
- Linhas adicionadas 1003-1015: checklist de validacao e proximos passos.

**Funcoes, classes e importacoes especificas**

- Nao ha codigo executavel.

**Comportamento de libs usadas**

- Markdown tables: organizam cobertura por AC e gaps de teste.

### `_bmad-output/story-automator/orchestration-4-20260712-232806.md`

**Funcao geral do arquivo**

Registro de orquestracao automatizada do Epico 4.

**Funcao geral da alteracao**

Atualiza o ponteiro de story atual para 4.5, marca 4.4 como concluida, 4.5 em fluxo de revisao/finalizacao e adiciona eventos de create-story, dev-story, automacao, code review e achados corrigidos.

**Blocos principais**

- Linhas alteradas 4-12: `currentStory`, `currentStep` e `lastUpdated`.
- Linhas alteradas 57-64: matriz de status por story.
- Linhas adicionadas 105-112: log cronologico da conclusao da 4.4 e execucao da 4.5.

**Funcoes, classes e importacoes especificas**

- Nao ha codigo executavel.

**Comportamento de libs usadas**

- Markdown + frontmatter YAML: mantem estado legivel por humanos e por automacoes.

## 2. Modelo, migracao e primitivas backend

### `backend/bujo/models.py`

**Funcao geral do arquivo**

Define os models Django do dominio BuJo: logs, tarefas e agora templates recorrentes.

**Funcao geral da alteracao**

Troca `Task.source_template_id` de UUID solto para `ForeignKey` real e adiciona `RecurringTaskTemplate` como tabela separada de `Task`.

**Blocos principais**

- Linhas 140-152: `Task.source_template` vira FK nullable para `"RecurringTaskTemplate"`, com `on_delete=SET_NULL` e `related_name="instances"`.
- Linhas 172-176: `RecurringTaskTemplate.RecurrenceGroup` define enum `weekly`, `monthly`, `annual`.
- Linhas 178-187: campos do template: `title`, `description`, `eisenhower`, `recurrence_group`, `recurrence_text`, `active`.
- Linhas 189-190: `Meta.db_table = "recurring_task_templates"`.

**Funcoes, classes e importacoes especificas**

- `Task.source_template`: guarda linhagem/auditoria da task criada a partir de template.
- `RecurringTaskTemplate`: model `TenantModel`, portanto escopado por tenant via manager/contexto existente.
- `RecurrenceGroup`: `TextChoices` usado por serializers, servicos, testes e contrato OpenAPI.

**Comportamento de libs usadas**

- `models.ForeignKey`: espera model alvo e politica `on_delete`; retorna relacao ORM e cria coluna `<campo>_id`.
- `models.SET_NULL`: ao remover o template, preserva a task e limpa a FK.
- `models.TextChoices`: gera choices Django e valores enumerados reutilizaveis.

### `backend/bujo/migrations/0004_recurringtasktemplate_remove_task_source_template_id_and_more.py`

**Funcao geral do arquivo**

Migration Django gerada para aplicar o novo schema no banco.

**Funcao geral da alteracao**

Cria tabela `recurring_task_templates`, remove o UUID antigo `source_template_id` e adiciona a FK `source_template` em `tasks`.

**Blocos principais**

- Linhas 10-12: depende de `0003_weekly_monthly_log`.
- Linhas 15-30: `CreateModel` de `RecurringTaskTemplate`.
- Linhas 31-34: remove campo `Task.source_template_id` antigo.
- Linhas 35-39: adiciona FK nullable `Task.source_template`.

**Funcoes, classes e importacoes especificas**

- `migrations.CreateModel`: cria tabela nova com `id`, `user_id` e campos de recorrencia.
- `migrations.RemoveField`/`AddField`: troca tipo logico da linhagem.

**Comportamento de libs usadas**

- Django migrations: recebem operacoes declarativas e aplicam alteracoes incrementais no banco.
- `django.db.models.deletion.SET_NULL`: preserva registros dependentes ao deletar o alvo.

### `backend/core/exceptions.py`

**Funcao geral do arquivo**

Define excecoes de dominio compartilhadas e mapeadas pelo handler DRF.

**Funcao geral da alteracao**

Adiciona `WrongPlacementContainer` para rejeitar placement com container errado.

**Blocos principais**

- Linhas 59-60: nova subclasse `WrongPlacementContainer(DomainError)`.

**Funcoes, classes e importacoes especificas**

- `WrongPlacementContainer`: usada por `place_template` quando falta `week_start` para weekly ou `month_first` para monthly/annual.

**Comportamento de libs usadas**

- Subclasse de exception Python: carrega mensagem de erro; por herdar `DomainError`, o handler existente retorna erro de dominio, documentado nos testes como HTTP 409.

## 3. Servicos backend

### `backend/bujo/services/tasks.py`

**Funcao geral do arquivo**

Contem operacoes de dominio para criar, editar e reordenar tarefas.

**Funcao geral da alteracao**

Estende `create_task` para aceitar `source_template` sem quebrar callers existentes.

**Blocos principais**

- Linhas 21-24: novo parametro keyword-only `source_template=None`.
- Linhas 38-42: passa `source_template` para `Task.objects.create`.

**Funcoes, classes e importacoes especificas**

- `create_task`: agora consegue criar snapshot de template com linhagem, mantendo default `None` para fluxo normal.

**Comportamento de libs usadas**

- `Task.objects.create`: espera campos do model e persiste um registro; com FK recebe instancia ou `None`.

### `backend/bujo/services/recurring.py`

**Funcao geral do arquivo**

Novo servico de dominio para templates recorrentes.

**Funcao geral da alteracao**

Implementa criacao, atualizacao e placement manual transacional de templates.

**Blocos principais**

- Linhas 14-16: `create_template` cria `RecurringTaskTemplate`.
- Linhas 19-25: `update_template` busca template escopado, aplica campos parciais e salva `update_fields`.
- Linhas 28-41: `place_template` busca template e monta campos snapshot (`title`, `description`, `eisenhower`, `source_template`).
- Linhas 42-46: grupo weekly exige `week_start`, cria/obtem Weekly Log e cria `Task`.
- Linhas 47-53: grupos monthly/annual exigem `month_first`, usam Monthly Log e criam `Task`.

**Funcoes, classes e importacoes especificas**

- `create_template`: encapsula persistencia do catalogo de recorrentes.
- `update_template`: garante que edicao do template nao toca tasks ja criadas.
- `place_template`: implementa AC2/AC3 copiando campos no instante do placement.
- `get_or_create_weekly_log`/`get_or_create_monthly_log`: produzem o container correto.
- `create_task`: consumidor do snapshot gerado pelo template.
- `WrongPlacementContainer`: erro de dominio para requisicao semanticamente incompatível.

**Comportamento de libs usadas**

- `transaction.atomic`: executa cada operacao em transacao; se houver excecao, o banco faz rollback.
- Django ORM `.get`: espera filtros; retorna um objeto ou levanta `DoesNotExist`.
- Django ORM `.save(update_fields=...)`: persiste apenas campos listados.

## 4. Serializers, views e rotas backend

### `backend/bujo/serializers.py`

**Funcao geral do arquivo**

Define serializers DRF que validam payloads e formatam respostas do app BuJo.

**Funcao geral da alteracao**

Adiciona serializers para listar, criar, atualizar e colocar templates recorrentes.

**Blocos principais**

- Linhas 6-9: importa `RecurringTaskTemplate`.
- Linhas 181-195: `RecurringTaskTemplateSerializer` expoe campos de leitura.
- Linhas 198-211: `RecurringTaskTemplateCreateSerializer` valida criacao.
- Linhas 214-225: `RecurringTaskTemplateUpdateSerializer` valida PATCH parcial.
- Linhas 228-231: `RecurringTaskTemplatePlaceSerializer` valida parametros opcionais de placement.

**Funcoes, classes e importacoes especificas**

- `RecurringTaskTemplateSerializer`: transforma model em JSON.
- `RecurringTaskTemplateCreateSerializer`: exige `title`, `recurrence_group`, `recurrence_text`.
- `RecurringTaskTemplateUpdateSerializer`: torna todos os campos opcionais.
- `RecurringTaskTemplatePlaceSerializer`: aceita `week_start`, `month_first`, `scheduled_date`; regra de obrigatoriedade fica no servico.

**Comportamento de libs usadas**

- `serializers.ModelSerializer`: deriva campos a partir do model.
- `serializers.Serializer`: valida estrutura declarada manualmente.
- `ChoiceField`: aceita apenas valores definidos no enum/choices.
- `DateField`: converte strings ISO date para `date`.

### `backend/bujo/views.py`

**Funcao geral do arquivo**

Define views DRF finas que conectam HTTP, serializers e servicos de dominio.

**Funcao geral da alteracao**

Adiciona endpoints de list/create, patch e place para templates recorrentes.

**Blocos principais**

- Linhas 12-42: imports de model, serializers e servicos de recorrentes.
- Linhas 151-162: `RecurringTaskTemplateListView.get` lista templates com filtros `active` e `recurrence_group`.
- Linhas 164-173: `post` valida criacao e retorna 201.
- Linhas 176-190: `RecurringTaskTemplateDetailView.patch` valida patch e traduz `DoesNotExist` para 404.
- Linhas 193-211: `RecurringTaskTemplatePlaceView.post` valida placement, chama servico e retorna `TaskSerializer`.

**Funcoes, classes e importacoes especificas**

- `RecurringTaskTemplateListView`: usado por Configuracoes e pelas secoes de placement.
- `RecurringTaskTemplateDetailView`: usado por edicao/toggle de ativo.
- `RecurringTaskTemplatePlaceView`: usado quando o usuario confirma "Definir placement".
- `extend_schema`: documenta request/response para drf-spectacular gerar `schema.yaml`.

**Comportamento de libs usadas**

- `APIView`: classe base DRF para metodos HTTP.
- `Response`: serializa corpo e status HTTP.
- `NotFound`: vira HTTP 404.
- `request.query_params`: le query string.

### `backend/bujo/urls.py`

**Funcao geral do arquivo**

Registra rotas URL do app BuJo.

**Funcao geral da alteracao**

Adiciona tres rotas REST para templates recorrentes.

**Blocos principais**

- Linhas 6-15: importa novas views.
- Linhas 42-56: registra `/recurring-templates/`, `/<uuid:pk>/` e `/<uuid:pk>/place/`.

**Funcoes, classes e importacoes especificas**

- `RecurringTaskTemplateListView.as_view()`: GET/POST.
- `RecurringTaskTemplateDetailView.as_view()`: PATCH.
- `RecurringTaskTemplatePlaceView.as_view()`: POST placement.

**Comportamento de libs usadas**

- `django.urls.path`: espera padrao, view e nome; cria entradas de roteamento.

## 5. Contrato gerado

### `schema.yaml`

**Funcao geral do arquivo**

Contrato OpenAPI gerado pelo backend.

**Funcao geral da alteracao**

Adiciona paths e schemas para templates recorrentes.

**Blocos principais**

- Linhas adicionadas 176-262: paths `/api/bujo/recurring-templates/`, `/{id}/` e `/{id}/place/`.
- Linhas adicionadas 602-625: schema `PatchedRecurringTaskTemplateUpdate`.
- Linhas adicionadas 653-661: enum `RecurrenceGroupEnum`.
- Linhas adicionadas 662-722: schemas `RecurringTaskTemplate`, `RecurringTaskTemplateCreate`, `RecurringTaskTemplatePlace`.

**Funcoes, classes e importacoes especificas**

- Nao possui codigo executavel; e contrato consumido por geracao de tipos.

**Comportamento de libs usadas**

- OpenAPI: descreve endpoints, payloads, respostas, auth e schemas para clientes.
- drf-spectacular: gera este arquivo a partir de views/serializers e converte snake_case interno para camelCase no contrato.

### `frontend/src/api/types.gen.ts`

**Funcao geral do arquivo**

Tipos TypeScript gerados a partir de `schema.yaml`.

**Funcao geral da alteracao**

Adiciona tipos de paths, operations e schemas de recorrentes para uso tipado no frontend.

**Blocos principais**

- Linhas 172-217: novos paths de recorrentes.
- Linhas 409-416: tipo `PatchedRecurringTaskTemplateUpdate`.
- Linhas 431-463: `RecurrenceGroupEnum`, `RecurringTaskTemplate`, `RecurringTaskTemplateCreate`, `RecurringTaskTemplatePlace`.
- Linhas 773-864: operations de list/create/patch/place.

**Funcoes, classes e importacoes especificas**

- `paths["/api/bujo/recurring-templates/"]`: contrato tipado das rotas.
- `components["schemas"]["RecurringTaskTemplate"]`: tipo base exportado por `features/bujo/types.ts`.

**Comportamento de libs usadas**

- TypeScript interfaces: contratos estruturais compilados estaticamente; nao geram runtime.

## 6. Camada de dados frontend

### `frontend/src/api/keys.ts`

**Funcao geral do arquivo**

Centraliza query keys do TanStack Query.

**Funcao geral da alteracao**

Adiciona key parametrizada para lista de templates recorrentes.

**Blocos principais**

- Linhas 19-21: `recurringTemplates(params)` retorna `['bujo', 'recurringTemplates', 'list', params ?? {}]`.

**Funcoes, classes e importacoes especificas**

- `keys.bujo.recurringTemplates`: usada por queries e invalidacoes por prefixo.

**Comportamento de libs usadas**

- TanStack Query query keys: arrays estaveis identificam caches e permitem invalidacao seletiva.

### `frontend/src/features/bujo/types.ts`

**Funcao geral do arquivo**

Reexporta tipos de dominio BuJo a partir do contrato gerado.

**Funcao geral da alteracao**

Exporta `RecurringTaskTemplate` e `RecurrenceGroup`.

**Blocos principais**

- Linhas 16-17: novos type aliases baseados em `components["schemas"]`.

**Funcoes, classes e importacoes especificas**

- `RecurringTaskTemplate`: usado em componentes e testes.
- `RecurrenceGroup`: restringe `weekly|monthly|annual`.

**Comportamento de libs usadas**

- TypeScript indexed access types: referencia propriedades de interfaces geradas.

### `frontend/src/features/bujo/api.ts`

**Funcao geral do arquivo**

Define hooks de API do dominio BuJo usando client HTTP e TanStack Query.

**Funcao geral da alteracao**

Adiciona query e tres mutations para templates recorrentes.

**Blocos principais**

- Linhas 321-342: `fetchRecurringTemplates` e `useRecurringTemplatesQuery`.
- Linhas 344-367: payload de criacao e `useCreateRecurringTemplateMutation`.
- Linhas 369-390: patch parcial e `useUpdateRecurringTemplateMutation`.
- Linhas 392-431: placement e `usePlaceRecurringTemplateMutation`.

**Funcoes, classes e importacoes especificas**

- `useRecurringTemplatesQuery`: GET `/api/bujo/recurring-templates/` com filtros `active` e `recurrence_group`.
- `useCreateRecurringTemplateMutation`: POST criacao e invalida listas.
- `useUpdateRecurringTemplateMutation`: PATCH update/toggle ativo e invalida listas.
- `usePlaceRecurringTemplateMutation`: POST placement e invalida templates, weeklyLog e monthlyLog.

**Comportamento de libs usadas**

- `useQuery`: executa fetch, cacheia resultado e expõe estados como `isPending`.
- `useMutation`: executa alteracao server-side e permite `onSuccess`.
- `queryClient.invalidateQueries`: marca caches como stale para refetch.
- Axios-like `client.get/post/patch`: espera URL/config/payload; retorna `{ data }`.

### `frontend/src/features/bujo/index.ts`

**Funcao geral do arquivo**

Barrel export de feature BuJo.

**Funcao geral da alteracao**

Exporta novos hooks, componentes e tipos de recorrentes.

**Blocos principais**

- Linhas 14-21: novos hooks.
- Linhas 24-27: `RecurringTemplateManager` e `RecurringPlacementSection`.
- Linhas 40-43: tipos `RecurringTaskTemplate` e `RecurrenceGroup`.

**Funcoes, classes e importacoes especificas**

- Permite que paginas importem recorrentes via `../../features/bujo`.

**Comportamento de libs usadas**

- ES module reexports: agregam API publica da feature sem alterar runtime alem da resolucao de modulo.

## 7. UI de Configuracoes e placement

### `frontend/src/pages/settings/SettingsPage.tsx`

**Funcao geral do arquivo**

Pagina real de Configuracoes.

**Funcao geral da alteracao**

Arquivo novo que substitui placeholder da rota `/settings` e compoe `RecurringTemplateManager`.

**Blocos principais**

- Linhas 1-2: importa MUI e manager de recorrentes.
- Linhas 4-13: renderiza `<main aria-label="Configurações">`, titulo e manager.

**Funcoes, classes e importacoes especificas**

- `SettingsPage`: pagina de composicao; nao contem logica de dados propria.
- `RecurringTemplateManager`: consumidor da pagina.

**Comportamento de libs usadas**

- MUI `Box`: componente layout com `sx`.
- MUI `Typography`: renderiza titulo com variante visual.

### `frontend/src/features/bujo/components/RecurringTemplateManager.tsx`

**Funcao geral do arquivo**

Componente de CRUD de templates recorrentes em Configuracoes.

**Funcao geral da alteracao**

Arquivo novo com listagem, criacao, edicao inline e toggle ativo/inativo.

**Blocos principais**

- Linhas 20-31: labels de grupo e Eisenhower.
- Linhas 33-109: `TemplateRow` com modo leitura/edicao e toggle de ativo.
- Linhas 111-141: estado e submit de criacao.
- Linhas 143-161: titulo, estado vazio e lista de templates.
- Linhas 163-224: formulario de novo template.

**Funcoes, classes e importacoes especificas**

- `TemplateRow`: recebe `RecurringTaskTemplate`, edita `title`/`recurrenceText` e alterna `active`.
- `handleSave`: faz trim e chama `useUpdateRecurringTemplateMutation`.
- `handleToggleActive`: PATCH direto de `active`.
- `RecurringTemplateManager`: chama `useRecurringTemplatesQuery` e `useCreateRecurringTemplateMutation`.

**Comportamento de libs usadas**

- React `useState`: controla formularios e modo edicao.
- React `FormEvent`: tipa submit.
- MUI `TextField`, `Select`, `MenuItem`, `Checkbox`, `Button`: controles de entrada.
- MUI icon `AddIcon`: icone visual no botao criar.

### `frontend/src/features/bujo/components/RecurringPlacementSection.tsx`

**Funcao geral do arquivo**

Seção reutilizavel que mostra templates ativos elegiveis para placement.

**Funcao geral da alteracao**

Arquivo novo que consulta templates ativos, filtra pelos grupos recebidos e renderiza botoes "Definir placement".

**Blocos principais**

- Linhas 5-8: props `recurrenceGroups` e `onPlace`.
- Linhas 10-14: labels de grupo.
- Linhas 22-31: query de templates ativos e retorno vazio quando pendente ou sem templates elegiveis.
- Linhas 33-58: renderizacao de cada template e botao.

**Funcoes, classes e importacoes especificas**

- `RecurringPlacementSection`: componente presentacional; nao decide `weekStart`/`monthFirst`.
- `onPlace(template.id)`: delega para pagina abrir dialog e chamar mutation correta.

**Comportamento de libs usadas**

- `Array.prototype.filter`: filtra templates client-side por grupos de recorrencia.
- MUI `Box`, `Typography`, `Button`: estrutura visual da seção.

### `frontend/src/features/bujo/components/RecurringPlacementDialog.tsx`

**Funcao geral do arquivo**

Dialog reutilizavel para confirmar placement e opcionalmente coletar data/dia.

**Funcao geral da alteracao**

Arquivo novo compartilhado entre WeeklyPage e MonthlyPage.

**Blocos principais**

- Linhas 4-9: props de abertura, tipo de campo e callbacks.
- Linhas 21-31: estado local e handlers de confirmar/fechar.
- Linhas 33-64: dialog MUI com campo `Data (opcional)` ou `Dia (opcional)`.

**Funcoes, classes e importacoes especificas**

- `RecurringPlacementDialog`: coleta string crua e entrega ao caller.
- `handleConfirm`: chama `onConfirm(value)` e limpa estado.
- `handleClose`: limpa estado e fecha.

**Comportamento de libs usadas**

- MUI `Dialog`, `DialogTitle`, `DialogActions`: cria modal acessivel.
- MUI `TextField type="date"`: espera string ISO date.
- MUI `TextField type="number"`: espera texto numerico; bounds sao passados em `slotProps.htmlInput`.

### `frontend/src/pages/planner/WeeklyPage.tsx`

**Funcao geral do arquivo**

Pagina do Weekly Log.

**Funcao geral da alteracao**

Integra recorrentes weekly ativos e permite placement manual no log semanal.

**Blocos principais**

- Linhas 1-14: imports de `RecurringPlacementSection`, mutation de placement e dialog.
- Linhas 17-23: cria mutation e estado `placingTemplateId`.
- Linhas 28-29: extrai `weekStart` do log.
- Linhas 86-109: renderiza seção weekly e dialog; confirma com `templateId`, `weekStart` e `scheduledDate`.

**Funcoes, classes e importacoes especificas**

- `usePlaceRecurringTemplateMutation`: cria task snapshot via API.
- `setPlacingTemplateId`: controla qual template esta em placement.

**Comportamento de libs usadas**

- React state: abre/fecha dialog por id nullable.
- TanStack mutation: envia POST e invalida caches via hook.

### `frontend/src/pages/planner/MonthlyPage.tsx`

**Funcao geral do arquivo**

Pagina do Monthly Log.

**Funcao geral da alteracao**

Integra recorrentes monthly e annual na abertura do mes corrente; annual aparece apenas em janeiro.

**Blocos principais**

- Linhas 2-16: imports de seção/dialog/mutation.
- Linhas 51-55: cria mutation e estado de template em placement.
- Linhas 74-82: calcula `recurrenceGroups` a partir de mes corrente e janeiro.
- Linhas 196-210: renderiza seção e dialog; converte dia informado em `YYYY-MM-DD`.

**Funcoes, classes e importacoes especificas**

- `recurrenceGroups`: `[]` fora do mes corrente, `['monthly']` no mes corrente, `['monthly','annual']` em janeiro corrente.
- `scheduledDate`: construido com `monthFirst.slice(0, 7)` e `padStart(2, '0')`.

**Comportamento de libs usadas**

- `String.prototype.padStart`: garante dia com dois digitos.
- TanStack mutation: POST de placement e invalidacao de caches.

### `frontend/src/app/router.tsx`

**Funcao geral do arquivo**

Define rotas React Router.

**Funcao geral da alteracao**

Troca a rota `/settings` de `PlaceholderPage` para `SettingsPage`.

**Blocos principais**

- Linha 13: importa `SettingsPage`.
- Linhas 98-102: rota `settings` usa `<SettingsPage />`.

**Funcoes, classes e importacoes especificas**

- `routeDefinitions`: consumidor direto da nova pagina.

**Comportamento de libs usadas**

- React Router `RouteObject`: estrutura rotas, elementos e handles.

## 8. Testes backend

### `backend/bujo/tests/factories.py`

**Funcao geral do arquivo**

Factories de teste e registro de isolamento multi-tenant.

**Funcao geral da alteracao**

Adiciona factory de template recorrente e registra caso de isolamento.

**Blocos principais**

- Linhas 17-20: importa `RecurringTaskTemplate`.
- Linhas 85-98: `RecurringTaskTemplateFactory`.
- Linhas 113-121: `register_isolation_case` para novo model.

**Funcoes, classes e importacoes especificas**

- `RecurringTaskTemplateFactory`: cria templates com `user_id`, titulo sequencial, group weekly, texto e ativo.
- `register_isolation_case`: garante que testes compartilhados de isolamento incluam a nova tabela.

**Comportamento de libs usadas**

- factory_boy `DjangoModelFactory`: cria objetos Django em testes.
- `factory.Sequence`: gera valores unicos.
- `factory.SelfAttribute`: copia `user.id` para `user_id`.

### `backend/bujo/tests/test_models.py`

**Funcao geral do arquivo**

Testes unitarios de invariantes dos models.

**Funcao geral da alteracao**

Adiciona testes de que template nao tem ciclo de vida de task, FK aceita `None`/instancia e delete do template faz SET_NULL.

**Blocos principais**

- Linhas 188-203: verifica ausencia de campos `status`, `log`, `weekly_log`, `monthly_log`, `parent_task`.
- Linhas 206-214: valida `source_template` nullable e FK.
- Linhas 217-230: valida `on_delete=SET_NULL`.

**Funcoes, classes e importacoes especificas**

- `RecurringTaskTemplateFactory`: produz template para assertions.
- `TaskFactory(source_template=template)`: cria instancia com linhagem.

**Comportamento de libs usadas**

- pytest `mark.django_db`: habilita banco nos testes.
- Django ORM `refresh_from_db`: recarrega estado apos delete.

### `backend/bujo/tests/test_serializers.py`

**Funcao geral do arquivo**

Testes de validacao e serializacao DRF.

**Funcao geral da alteracao**

Adiciona cobertura para serializers de recorrentes.

**Blocos principais**

- Linhas 115-126: parametriza todos os grupos validos.
- Linhas 129-136: rejeita grupo fora do enum.
- Linhas 139-153: aceita `description` e `eisenhower` como `null`.
- Linhas 156-160: update aceita payload vazio.

**Funcoes, classes e importacoes especificas**

- `RecurringTaskTemplateCreateSerializer`: valida criacao.
- `RecurringTaskTemplateUpdateSerializer`: valida patch parcial.

**Comportamento de libs usadas**

- pytest `parametrize`: executa o mesmo teste para cada valor do enum.
- DRF `.is_valid()`: popula `validated_data` ou `errors`.

### `backend/bujo/tests/test_services.py`

**Funcao geral do arquivo**

Testes de regras de dominio nos servicos BuJo.

**Funcao geral da alteracao**

Adiciona cobertura para criar/editar/colocar templates, containers corretos, erro de container e isolamento tenant.

**Blocos principais**

- Linhas 664-680: `create_template` grava campos.
- Linhas 683-696: criacao escopada por tenant.
- Linhas 699-715: update parcial.
- Linhas 718-724: update de outro tenant levanta `DoesNotExist`.
- Linhas 727-750: placement weekly cria `Task` esperada.
- Linhas 754-769: monthly e annual entram no Monthly Log.
- Linhas 772-798: containers ausentes levantam `WrongPlacementContainer`.
- Linhas 801-827: AC3, template editado nao altera instancia antiga e novo placement usa dados novos.
- Linhas 830-843: placement de outro tenant e bloqueado.

**Funcoes, classes e importacoes especificas**

- `create_template`, `update_template`, `place_template`: funcoes sob teste.
- `update_task`: comprova que editar instancia nao altera template.
- `get_or_create_weekly_log`/`get_or_create_monthly_log`: conferem container criado.

**Comportamento de libs usadas**

- `pytest.raises`: espera excecoes de dominio/ORM.
- Django tenant context: escopa queries por usuario ativo.

### `backend/bujo/tests/test_views.py`

**Funcao geral do arquivo**

Testes de endpoints HTTP do app BuJo.

**Funcao geral da alteracao**

Adiciona cobertura dos endpoints REST de templates recorrentes.

**Blocos principais**

- Linhas 1287-1300: POST cria template com 201.
- Linhas 1303-1334: GET lista e filtra por `active`/`recurrence_group`.
- Linhas 1337-1360: PATCH atualiza e respeita tenant.
- Linhas 1363-1399: POST place weekly/monthly cria task 201.
- Linhas 1402-1415: place sem container correto retorna 409.
- Linhas 1418-1425: template inexistente retorna 404.

**Funcoes, classes e importacoes especificas**

- `auth_client`: cliente autenticado com JWT.
- `RecurringTaskTemplateFactory`: prepara dados de endpoint.

**Comportamento de libs usadas**

- DRF `APIClient`: simula requests HTTP em testes.
- `format="json"`: serializa corpo como JSON.

## 9. Testes frontend e E2E

### `frontend/src/features/bujo/api.test.tsx`

**Funcao geral do arquivo**

Testes dos hooks de API BuJo.

**Funcao geral da alteracao**

Adiciona testes de query/mutations de templates recorrentes.

**Blocos principais**

- Linhas 672-718: `useRecurringTemplatesQuery`, sem filtros e com filtros snake_case.
- Linhas 720-747: create mutation e invalidacao.
- Linhas 749-772: update mutation e invalidacao.
- Linhas 774-804: place mutation e invalidacoes cruzadas.

**Funcoes, classes e importacoes especificas**

- `mockGet`, `mockPost`, `mockPatch`: validam URL/payload.
- `renderHook`: executa hooks em ambiente de teste.

**Comportamento de libs usadas**

- React Testing Library `renderHook`/`waitFor`: renderiza hooks e aguarda estado assinc.
- Vitest `vi.spyOn`: observa invalidacoes no QueryClient.

### `frontend/src/features/bujo/components/RecurringTemplateManager.test.tsx`

**Funcao geral do arquivo**

Testes do componente de CRUD em Configuracoes.

**Funcao geral da alteracao**

Arquivo novo cobrindo lista, vazio, criacao, edicao, toggle ativo e acessibilidade.

**Blocos principais**

- Linhas 12-20: mocks dos hooks de API.
- Linhas 22-40: fixtures active/inactive.
- Linhas 55-75: renderizacao e estado vazio.
- Linhas 77-96: submit de criacao.
- Linhas 98-123: edicao e toggle ativo.
- Linhas 125-134: `jest-axe`.

**Funcoes, classes e importacoes especificas**

- `renderManager`: envolve componente no tema MUI.
- `mockCreateMutate`/`mockUpdateMutate`: validam payloads.

**Comportamento de libs usadas**

- `@testing-library/react` `render`, `screen`, `fireEvent`: testa comportamento pelo DOM.
- `jest-axe`: verifica violacoes de acessibilidade.
- MUI `ThemeProvider`: fornece tema necessario ao componente.

### `frontend/src/features/bujo/components/RecurringPlacementSection.test.tsx`

**Funcao geral do arquivo**

Testes da seção de placement.

**Funcao geral da alteracao**

Arquivo novo cobrindo DOM vazio, filtros por grupo, clique de placement e acessibilidade.

**Blocos principais**

- Linhas 9-15: mock de `useRecurringTemplatesQuery`.
- Linhas 17-35: fixtures weekly/monthly.
- Linhas 53-67: nao renderiza sem dados ou durante loading.
- Linhas 69-93: filtra grupos simples e multiplos.
- Linhas 95-103: clique chama `onPlace`.
- Linhas 105-111: `jest-axe`.

**Funcoes, classes e importacoes especificas**

- `renderSection`: injeta tema e retorna spy `onPlace`.

**Comportamento de libs usadas**

- `queryByText` vs `getByText`: diferencia ausencia esperada de presenca obrigatoria.

### `frontend/src/pages/settings/SettingsPage.test.tsx`

**Funcao geral do arquivo**

Smoke tests da pagina de Configuracoes.

**Funcao geral da alteracao**

Arquivo novo que garante titulo, composicao do manager, landmark acessivel e ausencia de violacoes axe.

**Blocos principais**

- Linhas 6-8: mock de `RecurringTemplateManager`.
- Linhas 10-33: quatro testes de composicao/acessibilidade.

**Funcoes, classes e importacoes especificas**

- `SettingsPage`: componente sob teste.

**Comportamento de libs usadas**

- `screen.getByRole`: valida semantica acessivel.
- `axe`: audita o HTML renderizado.

### `frontend/src/pages/planner/WeeklyPage.test.tsx`

**Funcao geral do arquivo**

Testes da pagina semanal.

**Funcao geral da alteracao**

Atualiza harness para manter `RecurringPlacementSection` real, mockar client HTTP e testar integracao weekly.

**Blocos principais**

- Linhas 1-33: adiciona `QueryClientProvider` e mock do client HTTP.
- Linhas 46-57: `renderWeeklyPage` agora fornece QueryClient.
- Linhas 80-84: default sem templates recorrentes.
- Linhas 160-173: fixture e roteador de mock GET.
- Linhas 175-225: testes da seção recorrente weekly e POST de placement.

**Funcoes, classes e importacoes especificas**

- `routeRecurringTemplatesGet`: responde GET de recorrentes e evita interferir em outras chamadas.
- `mockPost`: valida payload `{ weekStart, scheduledDate }`.

**Comportamento de libs usadas**

- TanStack `QueryClientProvider`: necessario para hooks reais.
- `waitFor`: aguarda chamadas assíncronas de query/mutation.

### `frontend/src/pages/planner/MonthlyPage.test.tsx`

**Funcao geral do arquivo**

Testes da pagina mensal.

**Funcao geral da alteracao**

Atualiza harness com QueryClient e adiciona testes de recorrentes monthly/annual e placement por dia.

**Blocos principais**

- Linhas 1-41: adiciona QueryClient e mock de client HTTP.
- Linhas 31-43: `renderMonthlyPage` com provider real.
- Linhas 109-113: default sem templates.
- Linhas 247-270: fixtures monthly/annual e roteador de mock GET.
- Linhas 272-360: testes de mes corrente, janeiro, mes nao corrente e POST de placement.

**Funcoes, classes e importacoes especificas**

- `routeRecurringTemplatesGet`: injeta templates retornados.
- `vi.setSystemTime`: controla mes atual para decidir exibicao.
- `mockPost`: valida payload `{ monthFirst, scheduledDate }`.

**Comportamento de libs usadas**

- Vitest fake timers: congela data atual.
- React Testing Library `getAllByLabelText`: resolve labels duplicados com dialog MUI.

### `frontend/src/app/router.test.tsx`

**Funcao geral do arquivo**

Testes do roteador.

**Funcao geral da alteracao**

Atualiza mock do barrel BuJo para incluir `RecurringTemplateManager`, evitando quebra quando `SettingsPage` e renderizada.

**Blocos principais**

- Linha 33: adiciona `RecurringTemplateManager: () => null`.

**Funcoes, classes e importacoes especificas**

- Mock de `../features/bujo`: substitui componentes pesados por nulos.

**Comportamento de libs usadas**

- Vitest `vi.mock`: intercepta import de modulo durante testes.

### `frontend/src/app/layout/RouteAnnouncer.test.tsx`

**Funcao geral do arquivo**

Testes do anunciador de rota/layout.

**Funcao geral da alteracao**

Atualiza mock do barrel BuJo para cobrir o novo export usado por Configuracoes.

**Blocos principais**

- Linha 30: adiciona `RecurringTemplateManager: () => null`.

**Funcoes, classes e importacoes especificas**

- Mock de `../../features/bujo`.

**Comportamento de libs usadas**

- Vitest module mocking: previne dependencia de hooks reais no teste de layout.

### `frontend/e2e/recurring-templates.spec.ts`

**Funcao geral do arquivo**

Spec Playwright E2E permanente para a Story 4.5.

**Funcao geral da alteracao**

Arquivo novo que cobre fluxo real cross-page Configuracoes -> Weekly/Monthly Log e AC3 contra backend real.

**Blocos principais**

- Linhas 15-115: teste CRUD, filtros por grupo, placement semanal/mensal e desativacao sem apagar instancia.
- Linhas 117-201: teste AC3, garantindo que editar template nao muda instancias antigas e novo placement usa titulo atualizado.

**Funcoes, classes e importacoes especificas**

- `test.setTimeout(120_000)`: acomoda round-trips reais do ambiente.
- `page.waitForResponse`: sincroniza com POST/PATCH reais.
- `page.getByTestId('task-row')`: confirma que placement criou task visivel no log.

**Comportamento de libs usadas**

- Playwright `test`/`expect`: executa browser real e faz assertions assíncronas.
- Locators `getByRole`, `getByLabel`, `getByText`: selecionam por semantica acessivel.

## 10. Resumo de consumo entre arquivos

- `backend/bujo/models.py` produz `RecurringTaskTemplate` e `Task.source_template`.
- `backend/bujo/migrations/0004...py` aplica esse schema no banco.
- `backend/bujo/services/recurring.py` consome o model e `create_task` para produzir `Task` snapshot.
- `backend/bujo/serializers.py`, `views.py` e `urls.py` tornam os servicos acessiveis via REST.
- `schema.yaml` e `frontend/src/api/types.gen.ts` propagam o contrato.
- `frontend/src/features/bujo/types.ts`, `api.ts` e `keys.ts` consomem os tipos/paths para criar hooks.
- `RecurringTemplateManager` consome hooks de CRUD em `/settings`.
- `RecurringPlacementSection` e `RecurringPlacementDialog` sao consumidos por `WeeklyPage` e `MonthlyPage`.
- Testes backend validam persistencia, dominio e HTTP; testes frontend validam hooks/componentes/paginas; E2E valida o fluxo completo.
