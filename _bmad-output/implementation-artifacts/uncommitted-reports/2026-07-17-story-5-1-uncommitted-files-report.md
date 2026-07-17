# Explicação dos arquivos não commitados - Story 5.1 (Caixa de entrada do Brain Dump e processamento manual)

## Visão geral

Primeira story do **Épico 5 (Brain Dump & Captura Rápida — Fase 1b)**, implementada do zero via story-automator (create-story → dev-story → automate E2E → code-review, todos os passos concluídos, sprint-status = `done`). Cria um app Django novo, `braindump/`, e sua contraparte frontend em `frontend/src/features/braindump/` + `frontend/src/pages/braindump/`, entregando:

1. **Backend**: model `BrainDumpItem` (multi-tenant via `TenantModel`, campos `title`/`description`/`target_log` opcionalmente NULL), migração inicial, serializers (list/create/process), camada de serviço (`create_brain_dump_item`/`list_brain_dump_items`/`process_brain_dump_item`/`discard_brain_dump_item`), views finas + rotas em `api/brain-dump/`, admin de operador, e 41 testes (43 após a correção do code review) cobrindo model/serializers/services/views.
2. **Contrato**: `schema.yaml` (OpenAPI, drf-spectacular) e `frontend/src/api/types.gen.ts` regenerados com os 3 endpoints novos e os schemas/enums associados.
3. **Frontend**: data layer com React Query (`features/braindump/api.ts`), 3 componentes (`BrainDumpCaptureForm`, `BrainDumpItemRow`, `ProcessItemDialog`), a página `BrainDumpPage`, a rota `/brain-dump` (antes um `PlaceholderPage`, agora a página real) e um atalho global de teclado `B` adicionado ao mesmo `useEffect` que já tratava o atalho `[` em `AppLayout.tsx`. A entrada da Sidebar já existia e não precisou de nenhuma mudança.
4. **Testes**: suíte completa de componentes/página no frontend, extensão de `AppLayout.test.tsx` (3 testes novos do atalho `B`), e `frontend/e2e/brain-dump.spec.ts` (spec novo, 4 testes: estado vazio, fluxo captura→processa→descarta contra o backend real, atalho `B` com guard de campo editável, título vazio desabilitado).
5. **Artefatos de processo**: arquivo da story (`_bmad-output/implementation-artifacts/5-1-...md`, 661 linhas, com Dev Agent Record e Senior Developer Review completos), `sprint-status.yaml` atualizado (`5-1-...: backlog → done`, `epic-5: backlog → in-progress`), `test-summary.md` com o resumo da rodada de automação E2E, e um conjunto de arquivos de log/estado do próprio orquestrador story-automator (`_bmad-output/story-automator/`).

O code-review (Senior Developer Review, seção da própria story) encontrou e corrigiu **1 bug real MEDIUM**: `BrainDumpItemProcessSerializer` reproduzia o vocabulário de `TaskMigrateSerializer` mas omitia a validação cruzada `scheduled_date`/`month_first` para `destination="future"` — sem ela, um POST direto à API podia gerar uma `Task` presa a um `monthly_log` de um mês com `scheduled_date` de outro mês. Corrigido copiando a validação do precedente (`bujo/serializers.py`) + 2 testes novos. Outcome: **Approved, 0 issues CRITICAL**.

Um arquivo do conjunto (`_bmad-output/story-automator/orchestration-3-20260703-191211.md`) é uma mudança **pré-existente e fora do escopo desta story** — atualiza o status de uma orquestração antiga (Épico 3) de `STOPPED` para `COMPLETE`; não tem relação funcional com o Brain Dump.

## Ordem lógica de funcionamento

1. Configuração/registro do app Django (`INSTALLED_APPS`, roteamento raiz, isolamento de testes).
2. Modelo de dados e migração (`models.py`, `0001_initial.py`).
3. Admin de operador (`admin.py`).
4. Serializers (contrato Python/DRF).
5. Serviço (`services.py`) — consome serviços já existentes do app `bujo`.
6. Views + urls (expõem o serviço via HTTP).
7. Testes de backend, por camada (model → serializers → services → views).
8. Contrato gerado (`schema.yaml`, `types.gen.ts`) — gerado a partir dos passos 2-6.
9. Camada de dados do frontend (`keys.ts`, `features/braindump/{types,api,index}.ts`) — consome os tipos gerados no passo 8.
10. Componentes de UI (`BrainDumpCaptureForm`, `BrainDumpItemRow`, `ProcessItemDialog`).
11. Página (`BrainDumpPage.tsx`) — compõe os componentes do passo 10.
12. Roteamento e atalho global (`router.tsx`, `AppLayout.tsx`) — conectam a página do passo 11 à navegação do app.
13. Testes de frontend (componentes, página, `AppLayout.test.tsx`).
14. Teste E2E de browser real (`frontend/e2e/brain-dump.spec.ts`).
15. Artefatos de rastreamento/planejamento e orquestração (arquivo da story, `sprint-status.yaml`, `test-summary.md`, logs do story-automator).

## 1. Configuração e registro do app Django

### `backend/config/settings/base.py`

**Função geral do arquivo**

Settings base do Django (compartilhado por todos os ambientes: dev/test/e2e/prod).

**Função geral da alteração**

Uma linha adicionada em `INSTALLED_APPS`, registrando o app novo.

**Blocos principais**

- Linha 50 (diff): `"braindump",` inserida logo após `"bujo",` — mesma posição relativa usada pelos outros apps de domínio.

**Funções, classes e importações específicas**

- `INSTALLED_APPS`: lista padrão do Django; a presença do app aqui é pré-requisito para `makemigrations`/`migrate` encontrarem `braindump/models.py` e para o Django registrar `braindump.apps.BraindumpConfig`.

### `backend/config/urls.py`

**Função geral do arquivo**

`urlpatterns` raiz do projeto — monta os `include()` de cada app de domínio sob prefixos `api/<app>/`.

**Função geral da alteração**

Uma linha adicionada, montando as rotas do app novo.

**Blocos principais**

- Linha 14 (diff): `path("api/brain-dump/", include("braindump.urls")),` — inserida entre `api/bujo/` e o bloco de endpoints de schema (drf-spectacular). Prefixo kebab-case (`brain-dump`, não `braindump`), consistente com a convenção HTTP do projeto (o nome do app Python continua `braindump`, sem hífen).

**Comportamento de libs usadas**

- `django.urls.include`: delega a resolução de todas as sub-rotas de `braindump.urls` para dentro do prefixo `api/brain-dump/`.

### `backend/conftest.py`

**Função geral do arquivo**

Fixtures e configuração compartilhada do pytest para todo o backend, incluindo o registro dos módulos que alimentam o contrato de isolamento de tenant genérico (`core/tests/registry.py`).

**Função geral da alteração**

Uma linha alterada: `_ISOLATION_TEST_MODULES` ganha `"braindump.tests.factories"` na lista.

**Blocos principais**

- Linha 19 (diff): lista passa de `["core.tests.models", "bujo.tests.factories"]` para `["core.tests.models", "bujo.tests.factories", "braindump.tests.factories"]`.

**Funções, classes e importações específicas**

- `_ISOLATION_TEST_MODULES`: cada módulo listado aqui roda seu `register_isolation_case(...)` em tempo de import, alimentando um teste genérico e automático de isolamento de tenant (garante que nenhum novo model esquece de herdar `TenantModel` corretamente). `braindump/tests/factories.py` (seção 7 abaixo) é o módulo que passa a ser importado por essa lista.

## 2. Modelo de dados e migração

### `backend/braindump/models.py` (novo)

**Função geral do arquivo**

Define o único model do app: `BrainDumpItem`.

**Função geral da alteração**

Arquivo novo, 30 linhas. Implementa a entidade central da story: um item de caixa de entrada sem data, escopado por tenant.

**Blocos principais**

- Linhas 14-19: `class BrainDumpItem(TenantModel)` com subclasse `TargetLog(models.TextChoices)` (`TODAY`/`WEEK`/`MONTH`/`FUTURE`, valores `"today"`/`"week"`/`"month"`/`"future"`).
- Linhas 21-25: campos — `title` (`CharField(max_length=500)`, obrigatório), `description` (`TextField(null=True, blank=True)`, ausência é valor válido — mesma semântica de `Task.description`), `target_log` (`CharField(max_length=8, choices=TargetLog.choices, null=True, blank=True)` — `NULL` significa "sem dica de destino", mesmo padrão nulável de `Task.eisenhower`/`Task.category`, deliberadamente **sem** `CheckConstraint`), `created_at` (`DateTimeField(auto_now_add=True)`).
- Linhas 27-29 (`Meta`): `db_table = "brain_dump_items"`, `ordering = ["created_at"]` (ordem crescente, mais antigo primeiro).

**Funções, classes e importações específicas**

- `TenantModel` (importado de `core.models`): base abstrata que dá a `BrainDumpItem` `id` (UUID), `user_id` (indexado) e os dois managers `objects`/`all_objects`. `objects` (o `_default_manager`) é escopado automaticamente pelo tenant corrente via `TenantManager` — é por isso que `list_brain_dump_items` (seção 5) não precisa filtrar por `user` explicitamente.

**Comportamento de libs usadas**

- Docstring do módulo (linhas 1-7) documenta explicitamente a decisão de design mais importante da story: `target_log` é só uma **dica** opcional escolhida na captura, nunca cria a `Task` de destino na hora — a criação real só acontece no processamento manual.

### `backend/braindump/migrations/0001_initial.py` (novo)

**Função geral do arquivo**

Migração Django autogerada (`makemigrations braindump`), primeira do app (`initial = True`, sem dependências).

**Função geral da alteração**

Arquivo novo. Uma única operação.

**Blocos principais**

- Linhas 15-29: `migrations.CreateModel(name='BrainDumpItem', ...)` — cria a tabela `brain_dump_items` com as 6 colunas do model (`id` UUID PK, `user_id` UUID indexado, `title`, `description`, `target_log`, `created_at`), replicando `choices`/`null`/`blank`/`ordering` do model 1:1.

**Comportamento de libs usadas**

- `migrations.CreateModel`: DDL de `CREATE TABLE`; como é a criação inicial da tabela, não há dado existente a migrar/backfill.

### `backend/braindump/__init__.py` e `backend/braindump/migrations/__init__.py` (novos)

Arquivos vazios — marcadores de pacote Python padrão, sem lógica.

## 3. Admin de operador

### `backend/braindump/admin.py` (novo)

**Função geral do arquivo**

Registro do model no Django Admin, para uso de operador/suporte.

**Função geral da alteração**

Arquivo novo, 16 linhas.

**Blocos principais**

- Linhas 8-15: `class BrainDumpItemAdmin(admin.ModelAdmin)` com `list_display`, `list_filter=("target_log",)`, `search_fields`, e um `get_queryset` que retorna `BrainDumpItem.all_objects.all()`.

**Funções, classes e importações específicas**

- `get_queryset` sobrescrito usando `all_objects` (o manager **não** escopado por tenant, herdado de `TenantModel`) — comportamento intencional (AD-12): o admin de operador precisa enxergar itens de qualquer tenant, ao contrário do `objects` usado no resto da aplicação.

## 4. Serializers (contrato Python/DRF)

### `backend/braindump/serializers.py` (novo)

**Função geral do arquivo**

Camada de serialização — "view fina, sem regra de negócio" (comentário do próprio módulo, §6.2/§6.3).

**Função geral da alteração**

Arquivo novo, 47 linhas, com 3 serializers.

**Blocos principais**

- Linhas 8-11: `BrainDumpItemSerializer(serializers.ModelSerializer)` — expõe `id`, `title`, `description`, `target_log`, `created_at` (usado nas respostas de leitura).
- Linhas 14-19: `BrainDumpItemCreateSerializer(serializers.Serializer)` — `title` obrigatório, `description` e `target_log` opcionais (`target_log` validado contra `BrainDumpItem.TargetLog.choices`).
- Linhas 22-46: `BrainDumpItemProcessSerializer(serializers.Serializer)` — `destination` (`ChoiceField` entre `"today"/"week"/"month"/"future"`), `month_first` (`DateField`, opcional), `scheduled_date` (`DateField`, opcional, nulável). Método `validate()` (linhas 27-46): se `destination == "future"`, exige `month_first` (senão erro em `month_first`), exige que `month_first.day == 1` (senão erro), e — **este é o bloco corrigido pelo code review** — se `scheduled_date` foi informado, exige que `(ano, mês)` de `scheduled_date` bata com `(ano, mês)` de `month_first` (linhas 38-45), senão erro em `scheduled_date`.

**Funções, classes e importações específicas**

- `BrainDumpItem.TargetLog.choices`: reusado como `choices` do `ChoiceField` em `BrainDumpItemCreateSerializer`, evitando duplicar o enum.
- A validação cruzada de `BrainDumpItemProcessSerializer.validate()` espelha exatamente o precedente `TaskMigrateSerializer` (`bujo/serializers.py`) — mesmo vocabulário `destination`/`month_first`/`scheduled_date`, reforçado pela Dev Note "Convenção de vocabulário `destination`/`target_log` reaproveitada de `migrate_task`".

**Comportamento de libs usadas**

- `serializers.ChoiceField(choices=...)`: rejeita com 400 qualquer valor fora do enum, sem tocar o banco.
- `serializers.Serializer.validate(self, attrs)`: hook de validação em nível de objeto (roda depois da validação campo-a-campo), usado aqui para checagens que envolvem mais de um campo simultaneamente (`month_first` + `scheduled_date` + `destination`).

## 5. Serviço

### `backend/braindump/services.py` (novo)

**Função geral do arquivo**

Camada de serviço — toda a regra de negócio do Brain Dump vive aqui, não nas views.

**Função geral da alteração**

Arquivo novo, 70 linhas, com 4 funções.

**Blocos principais**

- Linhas 20-21: `list_brain_dump_items(*, user)` — retorna `BrainDumpItem.objects.all()` (sem filtro explícito de `user`: o isolamento vem do manager escopado por tenant, não de um `.filter(user_id=...)` manual).
- Linhas 24-28: `create_brain_dump_item(*, user, title, description=None, target_log=None)` — `@transaction.atomic`, cria o item direto (sem cálculo de `order_index`/posição — a caixa não tem ordenação manual).
- Linhas 31-64: `process_brain_dump_item(*, user, item_id, destination, month_first=None, scheduled_date=None)` — `@transaction.atomic`, é a função central da story (AC #2):
  - Linha 41: busca o item por `id` (levanta `BrainDumpItem.DoesNotExist` se não existir/não pertencer ao tenant — o manager escopado garante o 404 correto).
  - Linhas 43-54: resolve o container de destino conforme `destination` — `"today"` → `get_or_create_daily_log(log_date=today_for(user))`; `"week"` → `get_or_create_weekly_log(week_start=week_start_of(scheduled_date ou hoje))`; `"month"`/`"future"` → `get_or_create_monthly_log(month_first=month_first)` (mesma resolução de container que `migrate_task`).
  - Linhas 56-62: chama `create_task(...)` passando `title`/`description` herdados do item, `scheduled_date` só quando `destination != "today"`, e o container resolvido via `**{container_field: container}` (kwarg dinâmico — `log=`/`weekly_log=`/`monthly_log=`).
  - Linha 63: `item.delete()` — remove o item da caixa após criar a `Task` (AC #2: "após processar/descartar, o item sai da caixa").
- Linhas 67-69: `discard_brain_dump_item(*, user, item_id)` — `@transaction.atomic`, `BrainDumpItem.objects.get(id=item_id).delete()` (exclusão física, sem soft-delete/histórico).

**Funções, classes e importações específicas**

- Importa e reaproveita `get_or_create_daily_log`/`get_or_create_weekly_log`/`get_or_create_monthly_log` (`bujo.services.logs`) e `create_task` (`bujo.services.tasks`) — **primeiro import cross-domain do codebase** (um app de domínio, `braindump`, importando services de outro, `bujo`), decisão documentada explicitamente na Dev Note "Por que `braindump` importa serviços de `bujo`" da story: intencional, não uma violação de fronteira.
- `today_for(user)`/`week_start_of(d)` (`core.calendar`): única fonte de "hoje"/normalização de início de semana no projeto; `process_brain_dump_item` nunca calcula essas datas por conta própria.
- Nenhuma automação implícita: `target_log` do item (a dica salva na captura) **nunca é lida** dentro deste serviço — `destination` é sempre o que o usuário escolheu agora, no momento do processamento (reforça a decisão de design da Dev Note "`target_log` é dica, não placement").

**Comportamento de libs usadas**

- `django.db.transaction.atomic` (decorator): garante que a resolução/criação do container + criação da `Task` + `item.delete()` acontecem como uma única transação — se qualquer passo falhar, nada é persistido (nem a `Task` nem a remoção do item).
- `Model.objects.get(id=...)`: levanta `Model.DoesNotExist` (não `Http404`) quando o registro não existe ou (por ser um manager escopado por tenant) pertence a outro tenant — a view (seção 6) converte essa exceção em `NotFound` (404 HTTP).

## 6. Views e urls

### `backend/braindump/views.py` (novo)

**Função geral do arquivo**

Views HTTP finas — parseiam/validam a requisição, chamam o serviço, serializam a resposta (§6.2). Nenhuma regra de negócio aqui.

**Função geral da alteração**

Arquivo novo, 81 linhas, com 3 `APIView`.

**Blocos principais**

- Linhas 25-36: `BrainDumpItemListCreateView` — `GET` (lista via `list_brain_dump_items`, serializa com `BrainDumpItemSerializer(many=True)`) e `POST` (valida com `BrainDumpItemCreateSerializer`, cria via `create_brain_dump_item`, retorna 201).
- Linhas 39-46: `BrainDumpItemDetailView` — `DELETE` (chama `discard_brain_dump_item`; captura `BrainDumpItem.DoesNotExist` e relança como `NotFound()` → 404; retorna 204 no sucesso).
- Linhas 49-80: `BrainDumpItemProcessView` — `POST` em `.../process/`:
  - Linhas 52-54: valida o corpo com `BrainDumpItemProcessSerializer` (já aplica a validação cruzada da seção 4).
  - Linhas 57-68: resolve `month_first` — se `destination == "month"`, força `month_first = today_for(request.user).replace(day=1)` (mês corrente é sempre calculado no backend, nunca enviado pelo cliente — comentário do componente `ProcessItemDialog`, seção 10, confirma essa decisão do lado frontend); se `destination == "future"` e o `month_first` informado for `<=` o mês corrente, levanta `ValidationError` (400) com a mensagem "Use 'month' para o mês corrente." — impede duplicar o caminho de "mês corrente" via "future".
  - Linhas 70-79: chama `process_brain_dump_item`; captura `BrainDumpItem.DoesNotExist` → `NotFound()` (404); serializa a `Task` criada com `TaskSerializer` (reaproveitado de `bujo.serializers`, não um serializer próprio do Brain Dump).

**Funções, classes e importações específicas**

- `@extend_schema` (drf-spectacular) em cada método — adicionado explicitamente porque, sem ele, `manage.py spectacular` reportava "unable to guess serializer" nas 3 views (mesmo padrão pré-existente em `accounts/views.py::signup`, já previsto pela Dev Note da Task 4.1 da story).
- `TaskSerializer` (`bujo.serializers`): reaproveitado para serializar a `Task` retornada por `POST .../process/` — o Brain Dump não define seu próprio serializer de saída para a tarefa criada.

**Comportamento de libs usadas**

- `rest_framework.exceptions.NotFound`: levantada explicitamente (`raise NotFound() from None`) converte a exceção de domínio (`DoesNotExist`) em 404 HTTP; o `from None` suprime o encadeamento da exceção original no traceback (silencia o `DoesNotExist` como causa, mantendo só o `NotFound` visível).

### `backend/braindump/urls.py` (novo)

**Função geral do arquivo**

`urlpatterns` do app, incluído em `config/urls.py` sob `api/brain-dump/`.

**Função geral da alteração**

Arquivo novo, 17 linhas, 3 rotas:

**Blocos principais**

- `items/` → `BrainDumpItemListCreateView` (nome `braindump-item-list`).
- `items/<uuid:pk>/` → `BrainDumpItemDetailView` (nome `braindump-item-detail`).
- `items/<uuid:pk>/process/` → `BrainDumpItemProcessView` (nome `braindump-item-process`).

**Comportamento de libs usadas**

- Conversor de path `<uuid:pk>`: valida que o segmento da URL é um UUID válido antes mesmo de chegar à view — um `pk` malformado já resulta em 404 do roteador, não em erro de aplicação.

## 7. Testes de backend

### `backend/braindump/tests/factories.py` (novo)

**Função geral do arquivo**

Factory de teste (`factory_boy`) para `BrainDumpItem`, seguindo o mesmo padrão das outras factories do projeto.

**Função geral da alteração**

Arquivo novo, 25 linhas.

**Blocos principais**

- Linhas 9-17: `BrainDumpItemFactory(DjangoModelFactory)` — `user` como `Params`/`SubFactory(UserFactory)`, `user_id = factory.SelfAttribute("user.id")`, `title` sequencial (`f"Item {n}"`).
- Linhas 20-24: `register_isolation_case(id="braindump.BrainDumpItem", model=BrainDumpItem, make=lambda: {"title": "Item de teste"})` — é este registro (executado em tempo de import) que alimenta o teste genérico de isolamento de tenant habilitado em `conftest.py` (seção 1).

### `backend/braindump/tests/test_models.py` (novo, 51 linhas, 4 testes)

Cobre AC #1 em nível de schema: `target_log`/`description` aceitam `None`; cada valor do enum `TargetLog` é aceito; e um teste específico (`test_brain_dump_item_ordering_por_created_at_crescente_nao_por_ordem_de_insercao`) que cria o item "mais novo" primeiro no banco mas com `created_at` mais antigo, provando que `Meta.ordering = ["created_at"]` (e não a ordem de inserção) rege a listagem.

### `backend/braindump/tests/test_serializers.py` (novo, 101 linhas, 7 testes)

Cobre os 3 serializers da seção 4: camelização de `target_log`/`created_at` via `camelize` (a mesma transformação que `CamelCaseJSONRenderer` aplica na borda HTTP); `BrainDumpItemCreateSerializer` aceita payload só com `title` e rejeita `target_log` fora do enum; e 4 testes de `BrainDumpItemProcessSerializer` cobrindo especificamente a validação cruzada `month_first`/`scheduled_date` (exige `month_first` para `"future"`, exige dia 1, e os dois casos da correção do code review: rejeita `scheduled_date` fora do mês de `month_first`, aceita `scheduled_date` no mesmo mês).

### `backend/braindump/tests/test_services.py` (novo, 192 linhas, 14 testes)

Cobre as 4 funções da seção 5: criação com/sem os 3 campos, `user_id` auto-preenchido do contexto de tenant; listagem escopada por tenant (`other_user` não vê itens de `user`) e vazia para usuário novo; processamento para cada um dos 4 destinos (`today`/`week`/`month`/`future`), confirmando o container correto (`log`/`weekly_log`/`monthly_log`) e que a `Task` herda `title`/`description` do item sem nenhuma marca de proveniência (`source_template=None`, `parent_task=None`, `migration_count=0`); descarte remove o item e uma segunda chamada levanta `DoesNotExist`; descarte de item de outro tenant também levanta `DoesNotExist` (isolamento).

### `backend/braindump/tests/test_views.py` (novo, 192 linhas, 15 testes)

Cobre as 3 views via `auth_client` (cliente HTTP autenticado): listagem vazia/com itens ordenados; criação só com `title` e com os 3 campos (incluindo o payload em `camelCase`, `targetLog`); criação sem `title` retorna 400; processamento para `"today"` retorna 200 com a `Task` e remove o item da listagem; processamento para `"future"` sem `month_first` ou com `month_first` no mês corrente/passado retorna 400 (exercitando a lógica da view, seção 6, não só do serializer); processar/deletar item de outro tenant retorna 404 (não 403 — o item simplesmente não existe do ponto de vista do tenant corrente); delete idempotente (2ª chamada no mesmo id → 404); e um teste de isolamento fim-a-fim explícito usando `APIClient().force_authenticate` + `tenant_context` manual (com comentário explicando por que `tenant_context` é necessário nesse caso: `force_authenticate` sozinho não passa pelo `TenantAwareJWTAuthentication` real).

## 8. Contrato gerado (OpenAPI e tipos TypeScript)

### `schema.yaml`

**Função geral do arquivo**

Especificação OpenAPI gerada por `drf-spectacular` (`manage.py spectacular`) a partir das views/serializers reais — não editado manualmente.

**Função geral da alteração**

+190/-diversas linhas. Adiciona:

- 3 paths novos: `/api/brain-dump/items/` (GET/POST), `/api/brain-dump/items/{id}/` (DELETE), `/api/brain-dump/items/{id}/process/` (POST) — cada operação referenciando os serializers da seção 4/6 via `$ref`.
- Schemas novos: `BrainDumpItem`, `BrainDumpItemCreate`, `BrainDumpItemProcess`, `BrainDumpItemProcessDestinationEnum` (`"today"|"week"|"month"|"future"`), `TargetLogEnum` (mesmos 4 valores).
- Efeito colateral esperado do drf-spectacular ao desambiguar dois enums homônimos: o enum de destino que já existia para `migrate_task` (`bujo`) é renomeado para `TaskMigrateDestinationEnum` (linha 220 do diff) para não colidir com o `BrainDumpItemProcessDestinationEnum` novo — confirmado pela Senior Developer Review como comportamento normal da lib, sem nenhum consumidor hardcoded no nome antigo.

O Dev Agent Record confirma que o diff foi conferido manualmente contra o guardrail retroativo do Épico 3: nenhum bloco `security` de endpoint pré-existente foi removido, só adições.

**Comportamento de libs usadas**

- `drf-spectacular`: introspecta `APIView`s + `@extend_schema` + serializers em tempo de execução; roda via `manage.py spectacular --file schema.yaml` (não editado à mão).

### `frontend/src/api/types.gen.ts`

**Função geral do arquivo**

Tipos TypeScript gerados a partir de `schema.yaml` (via `openapi-typescript` ou equivalente do projeto) — consumidos por toda a camada de API do frontend.

**Função geral da alteração**

+192/-poucas linhas, espelhando 1:1 as adições do `schema.yaml`: os 3 paths novos em `paths`, e os schemas `BrainDumpItem`/`BrainDumpItemCreate`/`BrainDumpItemProcess`/`BrainDumpItemProcessDestinationEnum`/`TargetLogEnum` em `components["schemas"]`. Note que `BrainDumpItem["targetLog"]` é tipado como `(TargetLogEnum | BlankEnum | NullEnum) | null` — union gerada pelo par `null=True, blank=True` do model Django.

**Funções, classes e importações específicas**

- `components["schemas"]["BrainDumpItem"]`/`components["schemas"]["TargetLogEnum"]`: são exatamente os dois tipos reexportados por `frontend/src/features/braindump/types.ts` (seção 9) — é o ponto de consumo direto deste arquivo gerado.

## 9. Camada de dados do frontend

### `frontend/src/api/keys.ts`

**Função geral do arquivo**

Fábrica central de `queryKey`s do React Query, usada por todos os hooks de API do projeto (evita strings mágicas espalhadas).

**Função geral da alteração**

Uma chave nova adicionada.

**Blocos principais**

- Linha 8: `list: () => ['brainDump', 'list'] as const` adicionado dentro de `keys.brainDump`, ao lado da chave `count` pré-existente (usada por outra story/feature).

### `frontend/src/features/braindump/types.ts` (novo)

**Função geral do arquivo**

Reexporta tipos do contrato gerado com nomes específicos do domínio Brain Dump — nenhuma lógica, só aliasing.

**Blocos principais**

- `export type BrainDumpItem = components['schemas']['BrainDumpItem']`
- `export type BrainDumpTargetLog = components['schemas']['TargetLogEnum']`

### `frontend/src/features/braindump/api.ts` (novo)

**Função geral do arquivo**

Hooks de React Query (`useQuery`/`useMutation`) para os 3 endpoints do Brain Dump — única camada do frontend que fala HTTP diretamente com `/api/brain-dump/`.

**Função geral da alteração**

Arquivo novo, 78 linhas, 4 hooks exportados.

**Blocos principais**

- Linhas 6-13: `fetchBrainDumpItems` (`GET /api/brain-dump/items/`) + `useBrainDumpItemsQuery()` (`useQuery` com `queryKey: keys.brainDump.list()`).
- Linhas 15-32: `createBrainDumpItem` (`POST /api/brain-dump/items/`) + `useCreateBrainDumpItemMutation()` — no sucesso, invalida só `keys.brainDump.list()`.
- Linhas 34-61: `processBrainDumpItem` (`POST /api/brain-dump/items/{itemId}/process/`) + `useProcessBrainDumpItemMutation()` — no sucesso (linhas 50-58), invalida `keys.brainDump.list()` **e** as 3 chaves de log por prefixo (`['bujo','dailyLog']`/`['bujo','weeklyLog']`/`['bujo','monthlyLog']`) mais `['bujo','taskDensity']`, porque o container de destino só é escolhido em tempo de processamento (pode ser qualquer um dos 3 logs) — mesmo padrão de invalidação de `useDeleteTaskMutation` (`features/bujo/api.ts`, comentário no próprio código, linhas 52-54).
- Linhas 63-77: `discardBrainDumpItem` (`DELETE /api/brain-dump/items/{itemId}/`) + `useDiscardBrainDumpItemMutation()`.

**Comportamento de libs usadas**

- `useQuery`/`useMutation` (`@tanstack/react-query`): `useQuery` cacheia por `queryKey` e refaz fetch conforme a política padrão do `QueryClient` do projeto; `useMutation` expõe `.mutate()`/estado `isPending`/`isError` e permite `onSuccess` para invalidar cache relacionado — `queryClient.invalidateQueries({ queryKey })` marca as queries daquele prefixo como stale, disparando refetch automático nos componentes montados que as consomem.
- `client` (`../../api/client`, instância Axios pré-configurada do projeto, não modificada nesta story): `client.get`/`client.post`/`client.delete` tipados via generics (`client.get<BrainDumpItem[]>(...)`).

### `frontend/src/features/braindump/index.ts` (novo)

**Função geral do arquivo**

Barrel export da feature — ponto único de import para consumidores externos (`BrainDumpPage`).

**Blocos principais**

- Reexporta os 4 hooks de `./api` e os 2 tipos de `./types`.

## 10. Componentes de UI

### `frontend/src/features/braindump/components/BrainDumpCaptureForm.tsx` (novo)

**Função geral do arquivo**

Formulário de captura (título/descrição/destino), renderizado sempre visível no topo de `BrainDumpPage` (AC #3).

**Função geral da alteração**

Arquivo novo, 92 linhas.

**Blocos principais**

- Linhas 16-22: `TARGET_LOG_OPTIONS` — array de opções do `Select` de destino, incluindo uma opção vazia (`{ value: '', label: 'Brain Dump' }`) que representa "sem dica" (default).
- Linhas 28-91: `BrainDumpCaptureForm` — componente `forwardRef<HTMLInputElement, ...>`, expõe o input de título via `ref` (mesmo padrão de `AddTaskRow`, `features/bujo/components/`) para que `BrainDumpPage` possa focá-lo programaticamente.
- Linhas 34-47 (`handleSubmit`): faz `event.preventDefault()`; `trimmedTitle` vazio aborta silenciosamente (sem submeter); no sucesso, chama `onCapture({ title, description: description.trim() || undefined, targetLog: targetLog || undefined })` e limpa os 3 campos do estado local.
- Linha 84: botão "Capturar" com `disabled={!title.trim()}` — reflete no DOM real o guard de `handleSubmit` (é o que o teste E2E de "título vazio" exercita).

**Funções, classes e importações específicas**

- `forwardRef`: permite que o pai (`BrainDumpPage`) passe uma ref que chega até o `<TextField inputRef={ref}>` de título — necessário porque o foco automático (Task 10.2) é responsabilidade da página, não do formulário.

**Comportamento de libs usadas**

- MUI `Select`/`MenuItem`/`TextField`: componentes controlados padrão; `Select` com `inputProps={{ 'aria-label': 'Destino' }}` (acessibilidade, é o locator usado pelo teste E2E `getByRole('combobox', { name: 'Destino' })`).

### `frontend/src/features/braindump/components/BrainDumpItemRow.tsx` (novo)

**Função geral do arquivo**

Uma linha da listagem de itens pendentes, com as ações "Mover" e "Descartar".

**Função geral da alteração**

Arquivo novo, 58 linhas.

**Blocos principais**

- Linhas 15-17: estado local `processDialogOpen` + hook `useDiscardBrainDumpItemMutation()`.
- Linha 21: `data-testid="brain-dump-item-row"` — adicionado deliberadamente (não pedido pela story) para dar um locator robusto ao spec E2E, mesmo padrão de `data-testid="task-row"` em `TaskRow.tsx` (decisão de consistência documentada no Completion Notes List).
- Linhas 43-49: botão "Descartar" chama `discardItem.mutate({ itemId: item.id })` **direto no clique, sem diálogo de confirmação** — mesmo padrão de "Excluir tarefa"/"Cancelar tarefa" em `TaskDetailPanel.tsx` (comentário explícito nas linhas 11-14 justificando a ausência de `ConfirmDialog`, que não tem precedente em nenhuma superfície do projeto).
- Linha 51-55: renderiza `<ProcessItemDialog item={item} open={processDialogOpen} onClose={...} />`.

### `frontend/src/features/braindump/components/ProcessItemDialog.tsx` (novo)

**Função geral do arquivo**

Diálogo modal de "Mover item do Brain Dump" — as 4 abas de destino (Hoje/Esta Semana/Este Mês/Futuro) e o campo de mês (só para "Futuro").

**Função geral da alteração**

Arquivo novo, 99 linhas.

**Blocos principais**

- Linhas 31-34 (comentário): reaproveita o **vocabulário** de destino de `TaskDestinationDialog` (`features/bujo/components/`), mas **não** o componente em si — descrito como fortemente acoplado a `Task`/`useMigrateTaskMutation`.
- Linhas 35-53: estado local `destination` (default `'today'`) e `month` (string `"YYYY-MM"` do `<input type="month">`); `handleConfirm` chama `processItem.mutate({ itemId, destination, monthFirst: destination === 'future' ? `${month}-01` : undefined }, { onSuccess: onClose })` — **"Este Mês" nunca envia `monthFirst`**, resolvido no backend via `today_for` (comentário linha 34, reflete a lógica de `BrainDumpItemProcessView`, seção 6).
- Linhas 70-79: campo de mês só renderiza quando `destination === 'future'`.
- Linhas 81-85: mensagem de erro inline quando `processItem.isError`.
- Linha 91: botão "Mover" com `disabled={destination === 'future' && !month}`.
- Nota (Senior Developer Review): o diálogo não reseta seu estado (`destination`/`month`) ao reabrir para outro item — comportamento herdado fielmente do precedente `TaskDestinationDialog`, não uma regressão desta story.

**Comportamento de libs usadas**

- MUI `Tabs`/`Tab`: `value`/`onChange` controlado, `aria-label="Destino do item"` no `Tabs` (usado pelo próprio DOM, não diretamente pelos testes lidos).
- `<input type="month">` nativo do HTML: produz strings no formato `"YYYY-MM"`, por isso o código concatena `-01` manualmente para montar uma data ISO completa antes de enviar `monthFirst`.

## 11. Página

### `frontend/src/pages/braindump/BrainDumpPage.tsx` (novo)

**Função geral do arquivo**

Página conectada à rota `/brain-dump` — compõe o formulário de captura e a listagem.

**Função geral da alteração**

Arquivo novo, 52 linhas.

**Blocos principais**

- Linhas 12-14: `useBrainDumpItemsQuery()`, `useCreateBrainDumpItemMutation()`, `titleInputRef` (`useRef<HTMLInputElement>`).
- Linhas 19-21: `useEffect(() => { titleInputRef.current?.focus() }, [])` — foca o campo de título **toda vez que a página monta**, não só quando a navegação veio pelo atalho `B` (decisão de simplicidade documentada no comentário: custo zero, evita ramificar comportamento por origem de navegação).
- Linhas 23-29: enquanto `items.isPending`, renderiza `<PlannerSkeleton />` (reaproveitado de `features/bujo/components/`, não um skeleton próprio).
- Linha 31: `if (!items.data) return null` — guarda contra o estado transitório entre "não mais pending" e "dados ainda não populados".
- Linhas 33-51: renderiza `<BrainDumpCaptureForm ref={titleInputRef} onCapture={(fields) => createItem.mutate(fields)} />`, seguido por "Brain Dump vazio." quando `items.data.length === 0` (AC #1) ou a lista de `<BrainDumpItemRow>` (uma por item, `key={item.id}`).

**Funções, classes e importações específicas**

- `<Box component="main" aria-label="Brain Dump">`: é o landmark de acessibilidade usado tanto pelo teste de acessibilidade (`jest-axe`, seção 13) quanto pelo locator `getByRole('main', { name: 'Brain Dump', exact: true })` no spec E2E (seção 14).

## 12. Roteamento e atalho global

### `frontend/src/app/router.tsx`

**Função geral do arquivo**

Definição das rotas do React Router (`routeDefinitions`) usadas pelo app inteiro.

**Função geral da alteração**

A rota `brain-dump` deixa de renderizar `<PlaceholderPage title="Brain Dump" />` e passa a renderizar `<BrainDumpPage />` (import novo na linha 15).

**Blocos principais**

- Diff: bloco de 5 linhas (`path: 'brain-dump', element: <PlaceholderPage .../>, handle: {...}`) substituído por uma única linha `{ path: 'brain-dump', element: <BrainDumpPage />, handle: { title: 'Brain Dump' } }` — mesma rota, mesmo `handle.title`, só troca o componente renderizado.

### `frontend/src/app/layout/AppLayout.tsx`

**Função geral do arquivo**

Layout raiz do app (desktop/tablet/mobile) — inclui a `Sidebar`, o `BottomNav` e o listener de atalhos globais de teclado.

**Função geral da alteração**

Estende o `useEffect` que já tratava o atalho `[` (toggle da sidebar) para também tratar o atalho `B`/`b` (navegar para `/brain-dump`), só no desktop (`isDesktop`).

**Blocos principais**

- Linha 2: import de `useNavigate` adicionado (`react-router-dom`).
- Linha 14: `const navigate = useNavigate()`.
- Linhas 37-42 (bloco novo dentro do `handleKeyDown` existente): `else if (event.key === 'b' || event.key === 'B') { if (event.ctrlKey || event.metaKey || event.altKey) return; navigate('/brain-dump') }` — comentário explícito (linhas 38-40) explicando por que o guard de `ctrlKey`/`metaKey`/`altKey` é necessário: sem ele, `Cmd+B`/`Ctrl+B` (atalhos nativos do navegador/OS em algumas plataformas) seriam sequestrados — mesmo cuidado já aplicado ao atalho `N` em `DailyPage.tsx`.
- Linha 51 (dependências do `useEffect`): `[isDesktop, navigate]` — `navigate` adicionado às deps (identidade estável do React Router, não causa reexecuções espúrias).
- O guard de "não roubar digitação de campo editável" (checado antes do `if (event.key === '[')`/`'b'`, não alterado nesta story) já existia para o atalho `[` e agora também protege `B` — é esse guard pré-existente que faz o teste E2E "dentro de um campo editável, `b` não navega" (seção 14) passar.

**Comportamento de libs usadas**

- `useNavigate()` (`react-router-dom`): retorna uma função estável de navegação programática — chamá-la dentro de um listener global de `keydown` empurra uma nova entrada de histórico sem precisar de um `<Link>`/clique.

## 13. Testes de frontend (componentes, página, layout)

### `frontend/src/features/braindump/api.test.tsx` (novo, 146 linhas, 5 testes)

Testa os 4 hooks de `api.ts` com `MockAdapter` (axios-mock-adapter, padrão já usado no projeto) e um `QueryClient` de teste: busca da lista; criação envia o payload correto e invalida `brainDump.list`; processamento envia o payload correto ao endpoint e — teste mais específico — invalida as 5 chaves (`brainDump.list`, `dailyLog`, `weeklyLog`, `monthlyLog`, `taskDensity`) no sucesso; descarte chama o `DELETE` correto e invalida `brainDump.list`.

### `frontend/src/features/braindump/components/BrainDumpCaptureForm.test.tsx` (novo, 77 linhas, 5 testes)

Submeter só com título chama `onCapture` com `targetLog: undefined`; escolher "Hoje" no select chama `onCapture` com `targetLog: 'today'`; título vazio não submete; campos são limpos após submissão; a ref encaminhada (`forwardRef`) foca corretamente o campo de título.

### `frontend/src/features/braindump/components/BrainDumpItemRow.test.tsx` (novo, 72 linhas, 4 testes)

Renderiza título e descrição; não renderiza descrição quando ausente; clicar "Mover" abre o `ProcessItemDialog`; clicar "Descartar" chama a mutation direto, sem diálogo de confirmação intermediário (prova em teste a decisão de design documentada no componente).

### `frontend/src/features/braindump/components/ProcessItemDialog.test.tsx` (novo, 95 linhas, 5 testes)

Escolher "Futuro" exige mês preenchido antes de habilitar "Mover"; escolher "Hoje"/"Esta Semana" confirma direto com o destino certo; escolher "Este Mês" confirma **sem** enviar `monthFirst` (prova a decisão "mês corrente resolvido no backend"); escolher "Futuro" com mês preenchido chama a mutation com `monthFirst` montado corretamente.

### `frontend/src/pages/braindump/BrainDumpPage.test.tsx` (novo, 70 linhas, 4 testes)

Mostra skeleton (`PlannerSkeleton`) enquanto carrega; estado vazio mostra "Brain Dump vazio."; lista renderiza itens mockados; sem violações de acessibilidade (`jest-axe`).

### `frontend/src/app/layout/AppLayout.test.tsx`

**Função geral da alteração**

3 testes novos (linhas 116-146 do diff) cobrindo o atalho `B` adicionado em `AppLayout.tsx`, mais uma rota `brain-dump` adicionada ao router mockado do arquivo de teste (linha 43).

**Blocos principais**

- `test_atalho_b_navega_para_brain_dump_no_desktop`: `fireEvent.keyDown(window, { key: 'b' })` no desktop → conteúdo de `brain-dump` aparece.
- `test_atalho_b_ignorado_em_input`: foca um `<input>` real anexado ao `document.body`, dispara `keyDown` no próprio input → **não** navega (prova o guard de campo editável, reaproveitado do atalho `[`).
- `test_atalho_b_ignorado_no_mobile`: `mockMatchMedia(false, true)` (mobile) → `keyDown` não navega (o listener só é registrado quando `isDesktop`).

**Comportamento de libs usadas**

- `fireEvent.keyDown` (`@testing-library/react`): dispara um evento `KeyboardEvent` sintético no alvo indicado — usado tanto em `window` (simula atalho global) quanto num `<input>` específico (simula digitação dentro de campo).

## 14. Teste E2E de browser real

### `frontend/e2e/brain-dump.spec.ts` (novo, 104 linhas, 4 testes Playwright)

**Função geral do arquivo**

Spec Playwright novo, rodado contra o stack real (`npm run dev` + `manage.py runserver` sob `config.settings.e2e`, branch Neon `e2e` dedicada — infraestrutura da Story 11.1) — complementa os testes unitários de componentes (que mockam a API) validando o fluxo ponta-a-ponta real, incluindo a `Task` aparecendo de fato no Daily Log depois do processamento.

**Função geral da alteração**

Arquivo novo. 2 testes vieram do dev-story original (estado vazio, e o fluxo completo captura→processa→descarta); **2 testes foram gerados pela rodada de automação E2E** (registrados em `test-summary.md`, seção 15) para fechar gaps que só o dev-story não cobria.

**Blocos principais**

- Linhas 12-17 (teste 1, dev-story): `Brain Dump vazio para usuário novo mostra o estado vazio (AC1)` — clica no item "Brain Dump" da sidebar, confirma o landmark `main` e o texto "Brain Dump vazio.".
- Linhas 19-71 (teste 2, dev-story): fluxo completo — captura um item só com título, captura um segundo com `target_log` "Hoje" (prova que a dica **não** muda o comportamento de captura, ligação direta com a Dev Note "`target_log` é dica, não placement"); processa o primeiro item para "Hoje" via `ProcessItemDialog` e confirma que ele desaparece da lista e a `Task` aparece de fato no Daily Log real (`/today`, `getByLabel('Hoje')`); descarta o segundo item e confirma volta ao estado vazio; monitora `console`/`pageerror` e afirma `consoleErrors` vazio ao final.
- Linhas 73-91 (teste 3, **gerado pela automação E2E**): `abre o Brain Dump via atalho global 'B' (AC3); dentro de um campo editável, 'b' não navega` — clica fora de qualquer campo, pressiona `b` via `page.keyboard.press('b')`, confirma navegação real para `/brain-dump` e o formulário visível; depois navega para `/today`, foca o campo "Nova tarefa" e digita `b`, confirmando que a URL **não** muda e o caractere aparece no campo — mesma classe de regressão já documentada para o atalho `N` em `daily-tasks.spec.ts`.
- Linhas 93-103 (teste 4, **gerado pela automação E2E**): `título vazio não captura nada — botão "Capturar" fica desabilitado (AC3)` — confirma que o botão nasce desabilitado, preencher só a descrição mantém desabilitado, e "Brain Dump vazio." permanece visível.

**Comportamento de libs usadas**

- `page.keyboard.press('b')` (Playwright): dispara um evento de teclado real no browser (não sintético como `fireEvent` do Testing Library) — é o único nível de teste que exercita de fato o listener `window.addEventListener('keydown', ...)` registrado em `AppLayout.tsx` contra um browser real, distinto do teste unitário `AppLayout.test.tsx` (que usa um router mockado).
- Fixture `./fixtures` (não modificada nesta story): provê `page` já autenticado com um usuário novo por teste (garante isolamento entre os 4 testes).

## 15. Artefatos de rastreamento, planejamento e orquestração

### `_bmad-output/implementation-artifacts/5-1-caixa-de-entrada-do-brain-dump-e-processamento-manual.md` (novo, 661 linhas)

**Função geral do arquivo**

Arquivo de story no formato BMAD completo: Story (Como/Quero/Para que), 3 Acceptance Criteria (model+superfície de listagem; processar/descartar; captura via atalho `B` ou sidebar), 13 Tasks/Subtasks detalhadas com snippets de código planejados, Dev Notes extensas (justificativas de design, incluindo as citadas ao longo deste relatório), Dev Agent Record (Debug Log References, Completion Notes List) e uma seção **Senior Developer Review (AI)** completa.

**Função geral da alteração**

Arquivo inteiramente novo — é o artefato central do processo desta story. Conteúdo relevante já incorporado ao longo deste relatório (contagens de teste reais: backend 419→43 no subconjunto `braindump/` após a correção, frontend 577; o achado MEDIUM corrigido; File List reconciliada 1:1 contra `git status`/`git diff --stat` reais, sem discrepância).

**Status registrado:** `done`. **Outcome do review:** `Approved`, 0 issues CRITICAL.

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Função geral do arquivo**

Rastreamento de status por story/épico do sprint (YAML lido pelas skills BMAD).

**Função geral da alteração**

- `last_updated` (comentário): "Epic 11 retrospectiva (3ª passada) — épico fechado" → "Story 5.1 revisada e concluída (done)".
- `epic-5: backlog` → `epic-5: in-progress`.
- `5-1-caixa-de-entrada-do-brain-dump-e-processamento-manual: backlog` → `done`.

Nenhuma outra entrada do arquivo muda (`5-2`/`5-3` seguem `backlog`, `epic-5-retrospective` segue `optional`).

### `_bmad-output/implementation-artifacts/tests/test-summary.md`

**Função geral do arquivo**

Log cumulativo de resumos de automação de testes por story, um bloco `---` por rodada.

**Função geral da alteração**

+69 linhas — um bloco novo anexado ao final (nada removido/editado dos blocos anteriores). Documenta a rodada de automação E2E desta story: contexto (a story já chegou com cobertura extensa própria — 41 testes de backend, suíte completa de componentes frontend, spec Playwright inicial com 2 testes), 3 gaps identificados (atalho `B` sem cobertura E2E de browser real; guard do atalho dentro de campo editável sem cobertura E2E; caso de erro/validação — título vazio — ausente do spec), os 2 testes gerados para fechá-los, uma tabela de cobertura por AC, resultado de execução (`4 passed`, `npm run typecheck` e `eslint` limpos) e um checklist de validação totalmente marcado.

### `_bmad-output/story-automator/orchestration-5-20260716-224123.md` (novo)

**Função geral do arquivo**

Documento de estado do orquestrador `story-automator` para a execução do Épico 5 (front-matter YAML + log de ações/aprendizados em texto).

**Função geral da alteração**

Arquivo novo — registra a execução completa desta sessão do story-automator sobre o Épico 5 (stories 5.1-5.3, só 5.1 concluída até aqui). Front-matter: `status: IN_PROGRESS`, `currentStory: 5.1`, `currentStep: step-03b-execute-finish`. Seção "Story Progress": tabela com `5.1 | done | done | done | done | - | in-progress` (as 4 primeiras colunas — create/dev/automate/review — concluídas; commit ainda pendente, refletindo o estado real do repositório neste momento). Seção "Learnings & Recommendations": log cronológico detalhado, incluindo duas recuperações de erro transiente de API durante o `dev-story` (conexão fechada no meio da resposta; falso positivo de "completed" do monitor de sessão tmux) e uma intervenção manual em processo `pytest` travado — nenhuma delas é bug de produto, são apenas ocorrências operacionais da própria automação.

### `_bmad-output/story-automator/agents/agents-orchestration-5-20260716-224123.md` (novo)

**Função geral do arquivo**

Plano de agentes (JSON embutido em Markdown) definindo, por story do épico e por etapa (`create`/`dev`/`auto`/`review`), qual agente primário usar e se há fallback — aqui, `"claude"` sem fallback em todas as combinações para as 3 stories do épico.

### `_bmad-output/story-automator/complexity-orchestration-5-20260716-224123.json` (novo)

**Função geral do arquivo**

JSON minificado (1 linha) com a estimativa de complexidade por story do épico, consumida pelo planejamento de agentes acima.

### `_bmad-output/story-automator/init-log-20260716-213050.md` (novo)

**Função geral do arquivo**

Log de inicialização de uma linha só: `init: stop-hook=false existing_state=(resolved-epic3-complete)` — registra que, ao iniciar esta sessão do orquestrador, o estado anterior (Épico 3) já estava resolvido/completo.

### `_bmad-output/story-automator/policy-snapshots/20260716-224123-79b3b368.json` (novo)

**Função geral do arquivo**

Snapshot congelado (245 linhas) da política/configuração do story-automator no momento em que esta execução começou (referenciado pelo `orchestration-5-...md` via `policySnapshotFile`/`policySnapshotHash: "79b3b368"`) — garante reprodutibilidade/auditoria da configuração usada, independentemente de mudanças futuras na política global.

### `_bmad-output/story-automator/preflight-5-20260716-214208.md` (novo)

**Função geral do arquivo**

Snapshot de preflight (14 linhas): aponta o épico (`epics.md`, Epic 5), lista as 3 stories selecionadas (5.1/5.2/5.3) e um resumo de complexidade por story (`5.1 | Medium | score=4`, `5.2 | High | score=9`, `5.3 | Low | score=2`) — usado para decidir a estratégia de execução antes de começar.

### `_bmad-output/story-automator/orchestration-3-20260703-191211.md`

**Fora do escopo desta story.** Mudança pré-existente e não relacionada ao Brain Dump: o front-matter deste log de orquestração antigo (Épico 3, já commitado em stories anteriores) tem seu campo `status` alterado de `STOPPED` para `COMPLETE` (única linha do diff). Não há vínculo funcional com a Story 5.1; provavelmente um ajuste de housekeeping de uma sessão anterior que nunca foi commitado.

## Observação final

Nenhum código-fonte foi alterado na produção deste relatório — apenas leitura (`git status`/`git diff`/leitura direta de arquivos). Testes não foram executados nesta sessão; os números de teste citados (419/577/43/4) vêm do próprio Dev Agent Record e Senior Developer Review documentados no arquivo da story.
