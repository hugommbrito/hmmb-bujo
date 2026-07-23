# Explicação dos arquivos não commitados — Story 12.2: Flag `waiting_on` no backend (#15)

## Visão geral

A Story 12.2 entrega o backend Tier 0 da flag **"Aguardando Terceiro"** (`waiting_on`, #15,
AD-18 itens 3–5): uma anotação booleana sobre a tarefa — **não** um estado (o enum de 6 estados
`TaskStatus` permanece congelado; proibido 7º estado). Quatro peças pequenas: **schema** (1 coluna
`waiting_on BOOLEAN NOT NULL DEFAULT false`, migration 0006), **API de escrita** (`PATCH {"waitingOn": …}`,
reusando o `update_task` genérico), **filtro** (`?waitingOn=` via django-filter *standalone* no Daily
Log) e **herança na migração** (o sucessor continua aguardando o terceiro ao ser carregado adiante).
`waiting_on` é **ortogonal** ao `status`: transições não a alteram e alterná-la não muda o status.

**Backend-only:** Épico 12 é Tier 0 (DIR-15); **AC5 proíbe qualquer mudança de UI**. O indicador
visual e o filtro de UI nascem na Story 17.5 (Onda 2b / Épico 17). Nenhum arquivo de frontend foi
tocado; `types.gen.ts`/OpenAPI **não** regenerados (correto — são da 17.5).

## Ordem lógica de funcionamento

1. **Planejamento/status** — story file + `sprint-status.yaml`.
2. **Modelo + migration** — `models.py` (campo) → `0006_task_waiting_on.py` (AddField), aplicada ao Postgres LOCAL **e** à branch Neon e2e.
3. **Filtro (primitivo compartilhado)** — `filters.py` (novo): `TaskFilter` django-filter standalone.
4. **Serializers/contrato** — `serializers.py`: leitura + escrita + aplicação do filtro no Daily Log.
5. **View** — `views.py`: injeta `request` no contexto do `LogSerializer` (ativa o filtro).
6. **Herança na migração** — `services/migration.py`: `_migrate_subtree` copia `waiting_on` por nó.
7. **Testes** — `test_serializers.py`, `test_views.py`, `test_services.py`.
8. **Artefato de testes + orquestração** — `test-summary.md`, `_bmad-output/story-automator/*`.

---

## 1. Planejamento/status

### `_bmad-output/implementation-artifacts/12-2-flag-waiting-on-no-backend.md`
Story file (novo). 27 subtasks `[x]`; `Status: done`; Dev Agent Record com **888 passed** (dev) e
seção de review (0 CRITICAL/HIGH/MEDIUM; 2 LOW out-of-scope). AC1–AC5 documentadas.

### `_bmad-output/implementation-artifacts/sprint-status.yaml`
`12-2-...: backlog → done`. Fonte da verdade consumida pelo orquestrador.

---

## 2. Modelo e migration

### `backend/bujo/models.py`
**Alteração:** +6 linhas — `waiting_on = models.BooleanField(default=False)` no `Task`, após
`updated_at`, com comentário citando FR-4.15/AD-18 (anotação, não estado; ortogonal; herdada).
`TaskStatus` (6 estados) e as constraints `task_status_valid`/`task_exactly_one_log` intactos.

### `backend/bujo/migrations/0006_task_waiting_on.py` (NOVO)
**Uma única** `migrations.AddField` de `waiting_on` (`NOT NULL DEFAULT false`), dependente de
`0005_recurringtasktemplate_category`. Nenhuma alteração de enum/constraint. Aplicada ao Postgres
LOCAL (pytest `--create-db`) **e** à branch Neon `e2e` (lição recorrente 7.1/7.2/11.1).

---

## 3. Filtro (primitivo compartilhado)

### `backend/bujo/filters.py` (NOVO)
**Função geral** — FilterSets do app `bujo`. Como não há endpoint plano `GET /api/tasks/` (tarefas
são servidas aninhadas em `LogSerializer` e nas filas, todas `APIView`, não `GenericAPIView`/`ViewSet`),
o `DjangoFilterBackend` não se aplica automaticamente.
**`TaskFilter(django_filters.FilterSet)`** — uso **standalone**: `TaskFilter(query_params, queryset=roots,
request=request).qs`. Filtro **declarado** `waitingOn = django_filters.BooleanFilter(field_name="waiting_on")`
(camelCase na borda §6.1/§6.3 → coluna snake_case) e `Meta: model=Task, fields=[]` (filtros declarados
entram independentemente de `Meta.fields`). Reutilizável — adoção em Weekly/Monthly/filas é do Épico 17.
**Comportamento de lib** — `BooleanFilter` (via `NullBooleanField`): aceita `true`/`false`; parâmetro
ausente ou não-parseável = sem filtro.

---

## 4. Serializers/contrato

### `backend/bujo/serializers.py`
- **`TaskSerializer.Meta.fields`**: `+ "waiting_on"` (read; sai como `waitingOn` via `CamelCaseJSONRenderer`).
- **`LogSerializer.get_tasks`**: aplica `TaskFilter` **só quando há `request` no contexto** — o endpoint
  injeta; `LogSerializer(log).data` sem contexto (test_serializers) não filtra. `.qs` preserva a ordenação
  `Meta.ordering = ["order_index"]`. **O filtro decide pela raiz** — subárvore serializada por `get_subtasks` sem filtro (AC3).
- **`TaskUpdateSerializer`**: `+ waiting_on = serializers.BooleanField(required=False)`. O corpo chega como
  `waitingOn`, o `CamelCaseJSONParser` converte antes do serializer; `update_task` (genérico) já repassa
  `**validated` (`setattr` + `save(update_fields=...)`) → ortogonalidade com `status` é automática, **sem
  mudar o service**.

---

## 5. View

### `backend/bujo/views.py`
**Alteração:** `TodayLogView` passa `context={"request": request}` ao `LogSerializer` (1 linha) — é o que
ativa o filtro `?waitingOn=` no `GET /api/bujo/logs/today/`. Sem efeito colateral em Weekly/Monthly.

---

## 6. Herança na migração

### `backend/bujo/services/migration.py`
**Alteração:** em `_migrate_subtree`, captura `source_waiting_on = source.waiting_on` **por nó e ANTES**
de transicionar (mesma disciplina da herança de status da 12.1) e copia ao sucessor via
`set_lineage_fields(..., waiting_on=source_waiting_on)` (o veículo correto — `update_task` rodaria
`_check_container_open`). Cada filho herda o próprio `waiting_on`, não o do pai (AC4). Único caller:
`views.py:529` → nenhum path de sucessor bypassa.

---

## 7. Testes

- **`backend/bujo/tests/test_serializers.py`** — set de campos-exatos atualizado com `"waiting_on"` + assert de default `False`.
- **`backend/bujo/tests/test_views.py`** — PATCH toggle (2 sentidos), ortogonalidade status×flag, filtro no Daily Log, e "filtro só nas raízes" (subárvore não podada).
- **`backend/bujo/tests/test_services.py`** — herança `waiting_on` nos 4 destinos (`today`/`week`/`month`/`future`) + subárvore de status/flag misto (herança por nó).

Execução real (guardrail de contagem): **892 passed (181.14s)** (baseline dev 888 + 4 da automação); `-k waiting_on` → 11 passed; ruff limpo.

---

## 8. Artefato de testes + orquestração

- `_bmad-output/implementation-artifacts/tests/test-summary.md` — seção da Story 12.2 (decisão "sem E2E" justificada+verificada; 2 gaps de API/serviço fechados; contagem real).
- `_bmad-output/story-automator/orchestration-12-*.md` — documento de estado da run (incluído por opção do usuário).

---

## Nota

Nenhum comportamento de código-fonte foi alterado por este relatório (documentação apenas). O
código de produção da story vive em `models.py`, `filters.py`, `serializers.py`, `views.py`,
`services/migration.py` e na migration `0006_task_waiting_on.py`.
