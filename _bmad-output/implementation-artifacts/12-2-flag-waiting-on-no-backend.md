---
baseline_commit: 8dfca03fe6bb355c131c4bea776ed97875629c2f
---

# Story 12.2: Flag `waiting_on` no backend (#15)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo (praticante do BuJo),
Quero marcar via API uma tarefa como "Aguardando Terceiro" (`waiting_on`), alternar a flag e filtrar por ela,
Para que dependências externas fiquem registradas e consultáveis sem poluir a máquina de estados (FR-4.15, AR-24, DIR-4, AD-18 itens 3-5).

## Acceptance Criteria

**AC1 — Schema: novo campo booleano, enum de 6 estados intocado, migration aplicada à branch Neon e2e**
**Dado que** o agregado `Task` congelado (Story 3.1),
**Quando** uma migration nomeada adiciona `waiting_on BOOLEAN NOT NULL DEFAULT false` em `tasks`,
**Então** o enum de 6 estados (`TaskStatus`) permanece **intocado** (**proibido criar 7º estado**) e nenhuma outra coluna/constraint muda,
**E** a migration é aplicada ao Postgres LOCAL (pytest) **e também à branch Neon e2e antes da suíte Playwright** (lição recorrente 7.1/7.2/11.1).

**AC2 — Alternar a flag via PATCH, com ortogonalidade total à máquina de estados**
**Dado que** uma tarefa existente,
**Quando** o cliente envia `PATCH /api/bujo/tasks/{id}/` com corpo `{"waitingOn": true|false}` (camelCase na borda, §6.3),
**Então** a flag alterna e **persiste**, e a resposta reflete o novo valor,
**E** transições de estado (AD-02, `transition_task`) **não** alteram `waiting_on` (a flag sobrevive a `pending→started→completed…`), **nem** alternar a flag altera o `status` — as duas dimensões são ortogonais (AD-18 item 4).

**AC3 — Filtro `?waitingOn=` via django-filter na listagem de tarefas**
**Dado que** a listagem de tarefas do Daily Log (`GET /api/bujo/logs/today/`),
**Quando** o cliente filtra por `?waitingOn=true` ou `?waitingOn=false` (via `django-filter`, §6.3),
**Então** o resultado respeita o filtro (só as raízes com o valor pedido), combinando com os parâmetros já existentes do endpoint (`?logDate=`/`?log_date=`) sem conflito,
**E** ausência do parâmetro retorna todas as tarefas (comportamento pré-existente inalterado).

**AC4 — Sucessor de migração herda `waiting_on` da origem (todos os fluxos, por nó)**
**Dado que** uma tarefa com `waiting_on = true` é migrada ou adiada por **qualquer** fluxo (migração diária, ritual semanal/mensal, Catch-Up, Mover — Stories 4.2/11.6/11.10, todos via `migrate_task` → `_migrate_subtree`),
**Quando** o service cria o sucessor,
**Então** o sucessor **herda `waiting_on`** da origem (a tarefa continua aguardando o terceiro ao ser carregada adiante — AD-18 item 5, confirmado por Hugo 2026-07-22),
**E** na migração de uma subárvore cada filho recriado herda o **próprio** `waiting_on` de origem, não o do pai (mesma disciplina por-nó da herança de status — Story 12.1 / AD-18 item 2).

**AC5 — Escopo Tier 0: nenhuma UI alterada**
**Dado que** o Épico 12 é Tier 0 (DIR-15),
**Quando** a story é entregue,
**Então** **nenhuma superfície de UI muda** — o indicador visual na Task Row e o filtro de UI nascem na Onda 2b (Épico 17, Story 17.5 / D3). Esta story entrega **só** backend: campo + serializer + PATCH + filtro + herança na migração.

## Tasks / Subtasks

- [x] **Task 1 — Schema: campo `waiting_on` + migration nomeada + branch Neon e2e (AC1)**
  - [x] Em `backend/bujo/models.py`, adicionar ao `Task` o campo `waiting_on = models.BooleanField(default=False)`. Posição sugerida: logo após `updated_at` (a ordem no model não afeta o schema). NÃO tocar em `TaskStatus`, nas constraints (`task_status_valid`, `task_exactly_one_log`) nem em nenhum outro campo.
  - [x] Gerar a migration: `cd backend && uv run python manage.py makemigrations bujo`. Deve produzir **`0006_task_waiting_on.py`** (nome descritivo automático; se necessário, `--name task_waiting_on`) contendo **uma única** `AddField`. Conferir que não há nenhuma outra operação no arquivo (nenhuma alteração de enum/constraint).
  - [x] Aplicar ao Postgres LOCAL (automático ao rodar `pytest`/`migrate` com `docker-compose` de teste no ar).
  - [x] **Aplicar à branch Neon e2e ANTES do Playwright** (lição recorrente): `cd backend && DJANGO_SETTINGS_MODULE=config.settings.e2e uv run python manage.py migrate` (runbook `docs/e2e-neon-reset.md §2`, exige `backend/.env.e2e` configurado). Se as credenciais Neon e2e não estiverem disponíveis nesta sessão, registrar explicitamente que este passo ficou pendente para a sessão interativa antes de rodar os E2E.

- [x] **Task 2 — Expor `waiting_on` na leitura e aceitar na escrita (AC2)**
  - [x] `backend/bujo/serializers.py` — `TaskSerializer.Meta.fields`: adicionar `"waiting_on"` (read; sai como `waitingOn` via `CamelCaseJSONRenderer`).
  - [x] `backend/bujo/serializers.py` — `TaskUpdateSerializer`: adicionar `waiting_on = serializers.BooleanField(required=False)` (o corpo chega como `waitingOn` e o `CamelCaseJSONParser` converte para `waiting_on` antes do serializer).
  - [x] **NÃO** adicionar `waiting_on` aos serializers de criação (`TaskCreateSerializer`/`WeeklyTaskCreateSerializer`/`MonthlyTaskCreateSerializer`) — criar tarefa já com a flag não é requisito; tarefas nascem `false` (default).
  - [x] **Sem mudança no service `update_task`**: ele já é genérico (`update_task(*, user, task_id, **fields)` → `_apply_fields` faz `setattr` + `save(update_fields=[*fields, "updated_at"])`). `TaskDetailView.patch` já repassa `**validated` — `waiting_on` flui automaticamente. Confirmar (ler `services/tasks.py`) e NÃO alterar.

- [x] **Task 3 — Filtro `?waitingOn=` via django-filter no Daily Log (AC3)**
  - [x] Criar **`backend/bujo/filters.py`** (NOVO) com `TaskFilter(django_filters.FilterSet)`: filtro **declarado** `waitingOn = django_filters.BooleanFilter(field_name="waiting_on")` e `class Meta: model = Task; fields = []` (filtros declarados entram independentemente de `Meta.fields`). O nome do parâmetro na borda é `waitingOn` (camelCase, §6.1/§6.3); mapeia para a coluna `waiting_on`.
  - [x] `backend/bujo/views.py` — `TodayLogView.get`: passar `context={"request": request}` ao `LogSerializer` (`LogSerializer(log, context={"request": request}).data`).
  - [x] `backend/bujo/serializers.py` — `LogSerializer.get_tasks`: aplicar o `TaskFilter` sobre as raízes quando houver `request` no contexto:
    ```python
    def get_tasks(self, obj):
        roots = obj.tasks.filter(parent_task__isnull=True)
        request = self.context.get("request")
        if request is not None:
            roots = TaskFilter(request.query_params, queryset=roots, request=request).qs
        return TaskSerializer(roots, many=True).data
    ```
    O `if request is not None` mantém o teste `test_serializers.py` (que chama `LogSerializer(log).data` sem contexto) verde e não filtra nada fora do endpoint. A ordenação `Meta.ordering = ["order_index"]` é preservada por `.qs`.
  - [x] Escopo do filtro: **só o Daily Log** nesta story (a "listagem de tarefas" do Hoje que a 17.5 consome). `TaskFilter` fica **reutilizável** para Weekly/Monthly/filas — a adoção nessas superfícies é do Épico 17 (spec 17.0), fora do escopo aqui. Ver questão aberta ao final.

- [x] **Task 4 — Herança de `waiting_on` na migração, por nó (AC4)**
  - [x] `backend/bujo/services/migration.py` — em `_migrate_subtree`, capturar `source_waiting_on = source.waiting_on` no topo, ao lado do `source_status` já existente (disciplina por-nó — cada filho lê o próprio valor ANTES de qualquer transição).
  - [x] Aplicar a flag ao sucessor **dobrando na chamada de linhagem já existente**:
    ```python
    set_lineage_fields(
        task_id=new_task.id,
        migration_count=source.migration_count + 1,
        waiting_on=source_waiting_on,
    )
    ```
    O sucessor nasce `waiting_on=False` (via `create_task`, default) — este set copia o valor da origem. `set_lineage_fields` (bookkeeping interno de migração que contorna o guardrail de ciclo fechado — ver docstring) é o veículo correto; `update_task` NÃO serve aqui (roda `_check_container_open`). Cópia direta (identidade) é a "regra" — não criar função/wrapper novo para um booleano (YAGNI; a fila unificada 14.3 reusa este mesmo `_migrate_subtree`, então a herança já vem sem duplicação — arch. §3b item 7).
  - [x] A recursão nos filhos já passa cada `child` como seu próprio `source` → herança de `waiting_on` por-nó é automática. Nenhuma mudança estrutural na recursão.

- [x] **Task 5 — Testes: schema, PATCH, ortogonalidade, filtro, herança (AC1-AC4)**
  - [x] **Serializer** (`backend/bujo/tests/test_serializers.py`): atualizar `test_task_serializer_expoe_exatamente_os_campos_esperados` (linha ~43) adicionando `"waiting_on"` ao set esperado (senão o teste quebra). Adicionar teste curto: `TaskSerializer(task).data["waiting_on"] is False` para tarefa comum (chaves de `.data` são snake_case — a camelização só ocorre no render).
  - [x] **PATCH** (`backend/bujo/tests/test_views.py`, padrão de `test_patch_task_detail_edita_campos_parciais`): `PATCH /api/bujo/tasks/{id}/` com `{"waitingOn": true}` → `200`, `response.data["waiting_on"] is True` e persiste no banco; PATCH de volta com `{"waitingOn": false}` → `False`.
  - [x] **Ortogonalidade** (AC2, dois sentidos): (a) tarefa com `waiting_on=True`, `POST .../transition/` `{"toStatus": "started"}` → status muda, `waiting_on` permanece `True`; (b) tarefa `started`, `PATCH {"waitingOn": true}` → flag muda, `status` permanece `started`.
  - [x] **Filtro** (AC3, `backend/bujo/tests/test_views.py`): num Daily Log com 2 raízes (uma `waiting_on=True`, uma `False`), `GET /api/bujo/logs/today/?waitingOn=true` retorna só a aguardando; `?waitingOn=false` só a outra; sem parâmetro retorna as duas. Usar `TaskFactory(user=user, log=log, waiting_on=True/False)` dentro de `with tenant_context(user):`.
  - [x] **Herança na migração** (AC4, `backend/bujo/tests/test_services.py`, padrão dos testes de `migrate_task` da 12.1): (a) tarefa `waiting_on=True` migrada para `today` → `result.migrated_to_task.waiting_on is True`; (b) subárvore de status/flag misto: pai `waiting_on=True` + filho `waiting_on=False` → novo pai `True`, novo filho `False` (prova herança por-nó); (c) tarefa `waiting_on=False` migrada → sucessor `False`.
  - [x] **(Opcional, recomendado) e2e**: não é obrigatório (superfície de UI é da 17.5); se adicionado, exige a migration aplicada à branch Neon e2e (Task 1). Backend-only → o gate real é a suíte pytest. **Não adicionado** (opcional; a UI/consumo é da Story 17.5).
  - [x] Rodar a suíte completa do backend: `cd backend && uv run pytest` (Postgres LOCAL via docker-compose — full-suite local é o padrão do projeto). Colar contagem real de passed no Debug Log.

## Dev Notes

### O que a story entrega (e o que NÃO entrega)

Backend Tier 0 do `waiting_on` (#15), em quatro peças pequenas: **schema** (1 coluna booleana), **API de escrita** (PATCH já genérico), **filtro** (`?waitingOn=` via django-filter no Daily Log) e **herança na migração** (o sucessor continua aguardando o terceiro). `waiting_on` é **anotação sobre a tarefa, não estado** — o enum de 6 estados está congelado (Story 3.1) e é **proibido criar um 7º estado** (AD-18 item 3, diretriz vinculante do proposal §8).

**Nenhuma UI muda** (AC5). O indicador visual na Task Row e o filtro de UI são a Story **17.5** (Onda 2b / D3). A 17.5 depende deste backend e verifica que o sucessor migrado mantém o indicador (herança já garantida aqui).

### Arquivos que esta story toca

- **`backend/bujo/models.py`** (UPDATE) — adiciona `waiting_on = models.BooleanField(default=False)` ao `Task`. Estado atual: `Task` tem `status` (`TaskStatus`, 6 estados), linhagem (`migrated_to_task`, `migration_count`, `parent_task`, `source_template`) e duas `CheckConstraint` (`task_status_valid`, `task_exactly_one_log`). **Preservar:** enum e ambas as constraints intactos. `BooleanField(default=False)` gera exatamente `NOT NULL DEFAULT false`; a `AddField` preenche linhas existentes com `false` sem `null=True`.
- **`backend/bujo/migrations/0006_task_waiting_on.py`** (NEW) — gerada por `makemigrations`; conferir que é uma única `AddField`.
- **`backend/bujo/serializers.py`** (UPDATE) — `TaskSerializer.Meta.fields` (+`waiting_on`, read), `TaskUpdateSerializer` (+`waiting_on` BooleanField, write), `LogSerializer.get_tasks` (aplica `TaskFilter` do contexto). Estado atual: `TaskSerializer` é `ModelSerializer` com `subtasks` recursivo via `SerializerMethodField`; `LogSerializer.get_tasks` devolve `obj.tasks.filter(parent_task__isnull=True)` serializado.
- **`backend/bujo/filters.py`** (NEW) — `TaskFilter(FilterSet)` com `waitingOn → waiting_on`.
- **`backend/bujo/views.py`** (UPDATE — mínimo) — `TodayLogView.get` passa `context={"request": request}` ao `LogSerializer`. **Nada mais**: `TaskDetailView.patch` já repassa `**validated` para `update_task`.
- **`backend/bujo/services/migration.py`** (UPDATE) — `_migrate_subtree`: capturar `source_waiting_on` e copiá-lo ao sucessor na chamada de `set_lineage_fields` já existente.
- **Testes** (UPDATE): `test_serializers.py`, `test_views.py`, `test_services.py`.
- **NÃO alterar:** `services/tasks.py` (`create_task`/`update_task` já servem), `services/state_machine.py` (matriz `ALLOWED` — a ortogonalidade é automática, ver abaixo), `TaskStatus`/enum, os serializers de criação.

### Ortogonalidade é automática — mas precisa de teste (AC2)

`transition_task` (`services/state_machine.py:52`) salva **só** `update_fields=["status"]` → **nunca** toca `waiting_on`. E `update_task` com `{"waiting_on": ...}` salva `update_fields=["waiting_on", "updated_at"]` → **nunca** toca `status`. Portanto a ortogonalidade AD-18 item 4 já vem de graça pela forma como os dois services salvam campos escopados. **Não há código a escrever para isso** — mas AC2 exige prová-la com teste nos dois sentidos (transição preserva flag; toggle da flag preserva status).

### Filtro: por que Daily Log e por que `TaskFilter` standalone (AC3)

O sistema **não tem** um endpoint plano `GET /api/tasks/`: tarefas são servidas **aninhadas** dentro de `LogSerializer`/`WeeklyLogSerializer`/`MonthlyLogSerializer` e das filas — todas `APIView` (não `GenericAPIView`/`ViewSet`), então o `DjangoFilterBackend` de `DEFAULT_FILTER_BACKENDS` **não se aplica automaticamente**. A forma limpa de usar django-filter aqui é instanciar o `FilterSet` diretamente: `TaskFilter(query_params, queryset=roots).qs` — django-filter suporta uso standalone, e isso satisfa "via django-filter" (AC3, §6.3) sem refatorar `APIView` → `ViewSet`.

**Superfície escolhida: o Daily Log** (`GET /api/bujo/logs/today/`) — é a "listagem de tarefas" do **Hoje/Daily** que a Story 17.5 explicitamente consome ("filtro `waitingOn` disponível no Hoje/Daily e nas superfícies de tasks conforme spec da 17.0"). O `TaskFilter` fica reutilizável; estender para Weekly/Monthly/filas é do Épico 17 (spec 17.0), **não** desta story — mantém o escopo Tier 0 enxuto. **Ver a questão aberta ao final** (confirmar com Hugo se a superfície do Daily Log basta para a 12.2).

Convenção de query param: **camelCase na borda** (`?waitingOn=`, §6.1/§6.3), coerente com o AC e com AD-18. Nota: alguns endpoints legados usam query param snake_case (`?log_date=`, `?week_start=`) — **não** os toque; o filtro novo segue a convenção correta (camelCase).

`BooleanFilter` aceita `true`/`false` (via `NullBooleanField`), casando com `?waitingOn=true|false` do AC. Parâmetro ausente = sem filtro.

### Herança na migração: caminho único, cópia por nó (AC4)

**Todos** os fluxos de migração/adiamento passam por `migrate_task` → `_migrate_subtree` (endpoint único `POST /api/tasks/{pk}/migrate/`, `views.py:507`). Alterar `_migrate_subtree` cobre `today`/`week`/`month`/`future` de uma vez (4.2/11.6/11.10/Catch-Up). A Story 12.1 já provou esse ponto único para a herança de **status** — o `waiting_on` entra ao lado, como cópia-identidade.

Mecânica (espelha o `source_status` da 12.1): o sucessor é criado por `create_task` (nasce `waiting_on=False`); logo após fixar a linhagem, copiamos `source.waiting_on` para o sucessor via a mesma `set_lineage_fields(task_id=new_task.id, ...)`. Ler `source_waiting_on` no topo do nó garante que cada filho recriado herde o **próprio** valor, não o do pai. `transition_task` sobre a origem não altera `waiting_on` da origem (só `status`), então `source.waiting_on` é estável — mas ler no topo é mais claro e simétrico.

**Por que não uma função de regra nomeada** (como `inherited_successor_status` da 12.1): a 12.1 extraiu função porque **seu** AC4 exigia teste unit da regra e a promoção de status envolvia a máquina de estados. Aqui é cópia direta de um booleano (identidade pura) e o AC não pede função unit-testável isolada — um wrapper seria over-engineering. A fila unificada 14.3 reusa o **mesmo** `_migrate_subtree`, então herda `waiting_on` sem duplicação (arch. §3b item 7 já prevê "herança de status e `waiting_on` reusando a função de regra da AD-18").

### Lição recorrente: migration na branch Neon e2e (AC1)

Bug recorrente do projeto (7.1, 7.2, 11.1): branches Neon `dev` e `e2e` são independentes; uma migration pendente na `e2e` trava toda a suíte Playwright. Aplicar **antes** de rodar E2E:
```bash
cd backend && DJANGO_SETTINGS_MODULE=config.settings.e2e uv run python manage.py migrate
```
Runbook completo em `docs/e2e-neon-reset.md §2`. Requer `backend/.env.e2e` com a connection string da branch `e2e`. Se as credenciais não estiverem nesta sessão, o passo é manual antes do Playwright — registrar como pendência (não bloqueia os testes pytest, que rodam em Postgres LOCAL).

### `types.gen.ts` / schema OpenAPI (não obrigatório)

O drf-spectacular derivará `waitingOn` automaticamente no schema a partir do `TaskSerializer` (hook de camelização já configurado). Regenerar `frontend/src/api/types.gen.ts` (`npm run generate-types`, a partir de `schema.yaml`) **não é requisito** desta story e não conta como "UI": o frontend só consome `waitingOn` na Story 17.5, que regenera os tipos quando entrar. Não incluir na entrega para respeitar AC5 (Tier 0, sem UI) e evitar churn de tipos sem consumidor.

### Inteligência da story anterior (12.1) e do git

- **12.1 (`8dfca03`, mergeada — HEAD/baseline desta story)** implementou a herança de **status** no mesmíssimo `_migrate_subtree`, com `source_status` lido por nó e o padrão de teste `with tenant_context(user):` + `migrate_task` + asserts. **Reusar** esse padrão para `waiting_on`; a herança das duas dimensões vive lado a lado no mesmo ponto.
- 12.1 confirmou que `transition_task` salva `update_fields=["status"]` e portanto promover/mudar status não sobrescreve `migration_count`/`migrated_to_task` — a mesma garantia vale para `waiting_on` no sucessor (o set de linhagem e a promoção de status não se pisam).
- Factories/fixtures já disponíveis (`bujo/tests/factories.py`): `TaskFactory`, `LogFactory`, `WeeklyLogFactory`, `MonthlyLogFactory`; fixtures `user`/`other_user`; helper `tenant_context`; `today_for`/`week_start_of`. `TaskFactory` aceita kwargs de campos do model — `TaskFactory(user=user, log=log, waiting_on=True)` funciona assim que o campo existir. **Reusar — não** criar factory/fixture novo.

### Testing standards summary

- Framework: `pytest` + `pytest-django`; DB Postgres **LOCAL** (docker-compose) — full-suite local é barato e padrão (`cd backend && uv run pytest`). CI roda `uv run pytest` sem scoping.
- Convenção de borda confirmada no código: **corpo de request em camelCase** (ex.: `{"waitingOn": true}`, como `{"toStatus": "started"}` nos testes de transição); **`response.data` em snake_case** (ex.: `response.data["waiting_on"]`, como `response.data["status"]`/`response.data["log_date"]`) — a camelização só ocorre no render do corpo HTTP, que `response.data` não passa. **Query param em camelCase** na URL (`?waitingOn=true`).
- Teste que quebra se ignorado: `test_serializers.py::test_task_serializer_expoe_exatamente_os_campos_esperados` faz `assert set(TaskSerializer.Meta.fields) == {...}` — **adicionar `"waiting_on"` ao set** ou o teste falha.

### Project Structure Notes

- Alinhado à estrutura por camadas: schema em `models.py`; regra de migração em `services/migration.py`; borda em `serializers.py`/`views.py`; filtro em `bujo/filters.py` (novo, ao lado dos demais artefatos do app `bujo`). `django-filter` já é dependência (`pyproject.toml`) e `django_filters` está em `INSTALLED_APPS` + `DEFAULT_FILTER_BACKENDS` (`config/settings/base.py`).
- Nenhuma variância de estrutura. Único arquivo novo: `bujo/filters.py`. Sem novos apps/pastas.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 12.2: Flag `waiting_on` no backend (#15)] — user story + 5 ACs originais (linhas ~1936-1964).
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-18] — decisão canônica: item 3 (campo `waiting_on BOOLEAN NOT NULL DEFAULT false`, "anotação não estado", proibido 7º estado, filtro `?waitingOn=` via django-filter §6.3, UI na Onda 2b), item 4 (ortogonalidade), item 5 (sucessor herda `waiting_on`, confirmado por Hugo 2026-07-22). Schema delta: "`tasks.waiting_on boolean default false`. Nada mais." (linhas ~848-867).
- [Source: _bmad-output/planning-artifacts/architecture.md §6.3] — casing camelCase na borda; filtros via django-filter, nomes em camelCase mapeados a snake_case no backend (linhas ~1391-1398).
- [Source: _bmad-output/planning-artifacts/architecture.md §3b item 7 / AD (14.3)] — fila unificada reusa "herança de status e `waiting_on` reusando a função de regra da AD-18" sem duplicação (linha ~1210).
- [Source: _bmad-output/planning-artifacts/epics.md#Story 17.5: UI da flag "Aguardando Terceiro" (#15)] — consumidor do backend: indicador + filtro `waitingOn` no Hoje/Daily; sucessor migrado mantém indicador (linhas ~2770-2785).
- [Source: backend/bujo/models.py:83] — `Task`; `TaskStatus` (6 estados congelados) e constraints — adicionar `waiting_on`, NÃO tocar no resto.
- [Source: backend/bujo/services/migration.py:39] — `_migrate_subtree`/`migrate_task`; `inherited_successor_status` (12.1) mostra o padrão de herança por-nó a espelhar.
- [Source: backend/bujo/services/tasks.py:64] — `update_task`/`_apply_fields` genéricos (PATCH de `waiting_on` sem mudança); `set_lineage_fields:72` (contorna guardrail de ciclo fechado — veículo da cópia ao sucessor).
- [Source: backend/bujo/services/state_machine.py:46] — `transition_task` salva só `update_fields=["status"]` → ortogonalidade automática; NÃO alterar a matriz `ALLOWED`.
- [Source: backend/bujo/serializers.py:14] — `TaskSerializer` (+`waiting_on`), `TaskUpdateSerializer:73` (+campo), `LogSerializer.get_tasks:56` (aplicar filtro).
- [Source: backend/bujo/views.py:54] — `TodayLogView` (passar `context`); `TaskDetailView.patch:83` (já repassa `**validated`).
- [Source: backend/config/settings/base.py:155] — `DEFAULT_FILTER_BACKENDS` com `DjangoFilterBackend`; renderer/parser camelCase (:144-150).
- [Source: backend/bujo/tests/test_serializers.py:42] — assert de campos exatos a atualizar.
- [Source: backend/bujo/tests/test_views.py:123] — padrão camelCase no corpo (`{"toStatus": ...}`) e snake_case em `response.data`.
- [Source: docs/e2e-neon-reset.md §2] — aplicar migration à branch Neon e2e antes do Playwright.

### Questões abertas / suposições (confirmar com Hugo)

1. **Superfície do filtro (AC3).** Assumi que aplicar `?waitingOn=` ao **Daily Log** (`GET /api/bujo/logs/today/`) satisfaz "listagens de tarefas" na 12.2, deixando Weekly/Monthly/filas para o Épico 17 (spec 17.0), com `TaskFilter` já reutilizável. Racional: 17.5 cita o Hoje/Daily como superfície; Tier 0 pede escopo enxuto. **Se a intenção era o filtro em todas as superfícies de tasks já na 12.2**, é uma expansão pequena (aplicar o mesmo `TaskFilter` em `WeeklyLogView`/`MonthlyLogView`/filas) — sinalizar antes/na dev-story.
2. **Herança sem função nomeada (AC4).** Optei por cópia-identidade direta de `waiting_on` no `_migrate_subtree` (sem `inherited_successor_waiting_on`), diferente da 12.1 que nomeou `inherited_successor_status`. Se preferir simetria explícita (uma função de regra por dimensão), é trivial extrair — mas para um booleano identidade parece over-engineering.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) — bmad-dev-story workflow.

### Debug Log References

- Suíte completa do backend (Postgres LOCAL via docker-compose `hmmb-test-db`), DB recriado do zero para forçar a aplicação da migration 0006:
  `cd backend && uv run pytest --create-db -q` → **888 passed in 179.54s**. Comando sem escopo de caminho (inclui `accounts/`, `core/`, `bujo/`) — guardrail de contagem real.
- Testes novos desta story (subset): `uv run pytest -k waiting_on` → **8 passed, 880 deselected** (1 serializer + 4 views + 3 services; além do assert de campos-exatos atualizado, que não casa com `-k waiting_on` pelo nome).
- Lint: `uv run ruff check` nos 9 arquivos tocados → **All checks passed!**
- Migration na branch Neon `e2e` (lição recorrente 7.1/7.2/11.1): `DJANGO_SETTINGS_MODULE=config.settings.e2e uv run python manage.py showmigrations bujo` → `0006_task_waiting_on [X]`; `... migrate bujo` → **No migrations to apply** (branch e2e já sincronizada; credenciais reais presentes em `backend/.env.e2e`).

### Completion Notes List

- **AC1 (schema):** `waiting_on = models.BooleanField(default=False)` em `Task`; migration `0006_task_waiting_on.py` é **uma única `AddField`** (`NOT NULL DEFAULT false`), enum `TaskStatus` (6 estados) e as constraints `task_status_valid`/`task_exactly_one_log` intactos — nenhum 7º estado. Aplicada ao Postgres LOCAL (pytest `--create-db`) **e** à branch Neon e2e.
- **AC2 (PATCH + ortogonalidade):** `waiting_on` exposto no `TaskSerializer` (read) e aceito no `TaskUpdateSerializer` (`BooleanField(required=False)`, write). `update_task`/`TaskDetailView.patch` já genéricos — nenhuma mudança de service. Ortogonalidade é automática (`transition_task` salva só `update_fields=["status"]`; `update_task` salva só `["waiting_on", "updated_at"]`) e provada nos dois sentidos por teste.
- **AC3 (filtro):** `backend/bujo/filters.py` (NOVO) com `TaskFilter` declarando `waitingOn → waiting_on` (`BooleanFilter`); `TodayLogView.get` passa `context={"request": request}` e `LogSerializer.get_tasks` aplica o filtro só quando há `request` (mantém `test_serializers` sem contexto verde). `.qs` preserva a ordenação `order_index`. Escopo Tier 0: **só o Daily Log** (decisão da Task 3 / questão aberta #1, alinhada ao texto explícito da AC3 que nomeia `GET /api/bujo/logs/today/`; Weekly/Monthly/filas ficam para o Épico 17 com o mesmo `TaskFilter` reutilizável). Combina com `?log_date=` sem conflito (testado).
- **AC4 (herança na migração):** `_migrate_subtree` lê `source_waiting_on` no topo (por-nó) e copia ao sucessor via `set_lineage_fields(..., waiting_on=source_waiting_on)` — cópia-identidade de booleano, sem função nomeada (decisão da Task 4 / questão aberta #2; AC4 não exige regra unit-testável isolada). Herança por-nó comprovada por teste de subárvore de flag mista (pai `True` + filho `False` + filho `True`).
- **AC5 (Tier 0, sem UI):** nenhuma superfície de UI alterada; `frontend/src/api/types.gen.ts` **não** regenerado (é da Story 17.5). Entrega 100% backend.
- **Ambiguidades resolvidas (persistent_facts / prática institucional Epics 4 e 11):** as duas questões abertas da story foram decididas em favor do documento mais específico + código existente e documentadas inline; ambas alinham-se ao texto explícito das ACs (AC3 nomeia o Daily Log; AC4 pede só herança, não função nomeada). Nenhum gap de especificação em `architecture.md`/`epics.md`/`prd.md` — AD-18 itens 3-5 já documentam o campo, ortogonalidade e herança.

### File List

- `backend/bujo/models.py` (M) — campo `waiting_on = BooleanField(default=False)` no `Task`.
- `backend/bujo/migrations/0006_task_waiting_on.py` (NEW) — única `AddField` de `waiting_on`.
- `backend/bujo/serializers.py` (M) — `TaskSerializer.Meta.fields` (+`waiting_on`, read); `TaskUpdateSerializer` (+`waiting_on`, write); `LogSerializer.get_tasks` aplica `TaskFilter` do contexto.
- `backend/bujo/filters.py` (NEW) — `TaskFilter(FilterSet)` mapeando `waitingOn → waiting_on`.
- `backend/bujo/views.py` (M) — `TodayLogView.get` passa `context={"request": request}` ao `LogSerializer`.
- `backend/bujo/services/migration.py` (M) — `_migrate_subtree` captura `source_waiting_on` e copia ao sucessor via `set_lineage_fields`.
- `backend/bujo/tests/test_serializers.py` (M) — assert de campos exatos (+`waiting_on`) e teste de default `False`.
- `backend/bujo/tests/test_views.py` (M) — PATCH toggle, ortogonalidade (2 sentidos), filtro `?waitingOn=` no Daily Log.
- `backend/bujo/tests/test_services.py` (M) — herança na migração: `True`→sucessor `True`, `False`→`False`, subárvore mista por-nó.

## Senior Developer Review (AI)

**Revisor:** HugoMMBrito · **Data:** 2026-07-23 · **Resultado:** Aprovado (Approve) · **Status:** review → done

### Escopo verificado (git × File List)
File List da story bate **exatamente** com o git (9 arquivos: 7 M + 2 NEW — `models.py`, `serializers.py`, `services/migration.py`, `views.py`, 3 test modules, `filters.py`, `migrations/0006`). Nenhuma discrepância. Nenhum arquivo de UI/frontend tocado (AC5 ✓).

### Validação das ACs (todas CONFIRMED contra o código)
- **AC1 (schema):** `waiting_on = BooleanField(default=False)`; `0006_task_waiting_on.py` é **uma única `AddField`** (`NOT NULL DEFAULT false`); enum `TaskStatus` (6 estados) e as duas `CheckConstraint` (`task_status_valid`/`task_exactly_one_log`) intactos — sem 7º estado. Migration aplicada ao Postgres LOCAL e à branch Neon e2e (Debug Log).
- **AC2 (PATCH + ortogonalidade):** read no `TaskSerializer`, write no `TaskUpdateSerializer`. Ortogonalidade é **estrutural**: `transition_task` grava só `update_fields=["status"]` (`state_machine.py:52`); `update_task`/`_apply_fields` gravam só `["waiting_on","updated_at"]`. Provada nos dois sentidos por teste (`test_transicao_de_estado_preserva_waiting_on`, `test_alternar_waiting_on_preserva_status`).
- **AC3 (filtro):** `TaskFilter` (django-filter standalone) aplicado **só às raízes** em `LogSerializer.get_tasks`, guardado por `request` no contexto; `.qs` preserva `Meta.ordering=["order_index"]` (confirmado `models.py:163`); combina com `?log_date=` (testado); subárvore não é podada (`test_..._aplica_so_nas_raizes`). `LogSerializer` é usado **só** por `TodayLogView` — nenhum efeito colateral em Weekly/Monthly.
- **AC4 (herança na migração):** **todos** os fluxos (today/week/month/future, Catch-Up, Mover) passam pelo **único** caminho `migrate_task → _migrate_subtree` (único caller: `views.py:529`; nenhum path de sucessor bypassa). `source_waiting_on` lido **por nó** antes de transicionar e copiado via `set_lineage_fields`; a promoção de status posterior (`update_fields=["status"]`) não sobrescreve a flag. Herança por-nó comprovada (subárvore mista) + 4 destinos.
- **AC5 (Tier 0):** nenhuma superfície de UI; `types.gen.ts` não regenerado (correto — é da 17.5).

### Qualidade / testes
- `uv run pytest bujo/tests/test_serializers.py test_services.py test_views.py -q` → **278 passed**. `ruff check` nos 6 arquivos-fonte tocados → **All checks passed**. Testes são asserts reais (persistência no banco, ambos os sentidos de ortogonalidade, herança por-nó) — sem placeholders.

### Achados (nenhum CRITICAL/HIGH/MEDIUM — nada a corrigir)
- **[LOW · por-design, sem ação]** `GET /api/bujo/logs/today/` não declara o query param `waitingOn` (nem o pré-existente `log_date`) no schema OpenAPI, pois o filtro é aplicado manualmente dentro do serializer numa `APIView` (sem `DjangoFilterBackend`). Consequência: o cliente tipado (`types.gen.ts`) não conhece `waitingOn`. **Coerente com o comportamento pré-existente do `log_date` e deliberadamente adiado para a Story 17.5** (Dev Notes "types.gen.ts / schema OpenAPI"; AC5). Corrigir agora violaria o escopo Tier 0 → registrado só como lembrete para a 17.5 declarar o param ao regenerar tipos.
- **[LOW · marginal]** Não há teste para valor malformado de `?waitingOn=` (ex.: `?waitingOn=abc`). `BooleanFilter` (via `NullBooleanField`) trata valor não-parseável como "sem filtro" (retorna tudo), sem risco de 500 — o gap fixaria comportamento de biblioteca de terceiros, não código nosso. Sem ação.

Nenhum issue HIGH/MEDIUM → nenhuma correção automática aplicada. 0 CRITICAL → Status → **done**.

## Change Log

- 2026-07-23 — Story 12.2 implementada (backend `waiting_on`, #15): schema + migration 0006, serializer read/write, filtro `?waitingOn=` no Daily Log (novo `bujo/filters.py`), herança na migração por-nó. 8 testes novos; suíte completa **888 passed**. Migration aplicada ao Postgres LOCAL e à branch Neon e2e. Status → review.
- 2026-07-23 — Senior Developer Review (AI, story-automator): revisão adversarial das 5 ACs contra a implementação — todas CONFIRMED. File List × git sem discrepância; 278 passed nos módulos afetados; ruff limpo. 0 CRITICAL/HIGH/MEDIUM; 2 achados LOW informativos (schema OpenAPI do `waitingOn` adiado para a 17.5; edge de valor malformado). Nenhuma correção necessária. Status → done.
