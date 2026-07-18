# Explicacao dos arquivos nao commitados - Story 6.1 (Configuracao de habitos e grupos)

> Escopo: apenas os arquivos da Story 6.1 do Epico 6 (Sistema de Habitos). Baseline de
> comparacao para arquivos modificados: commit `a44f20c`. Residuos de outros escopos
> (`_bmad-output/specs/`, logs do story-automator, `learnings.md`, `orchestration-5-*`)
> foram deliberadamente excluidos.

## Visao geral

A Story 6.1 entrega a **fundacao de modelagem do Sistema de Habitos** como uma fatia
vertical de ponta a ponta:

- **Backend novo (app `habits/`)** — models `HabitGroup`/`Habit`/`HabitVersion`, camada
  de servico, serializers split leitura/escrita, API DRF fina, migration inicial, admin e
  suite de testes.
- **Wiring** — registro do app em `INSTALLED_APPS`, rotas `api/habits/` e
  `api/habit-groups/`, override de enum no drf-spectacular e registro das factories no
  contrato de isolamento multi-tenant.
- **Contrato gerado** — `schema.yaml` e `frontend/src/api/types.gen.ts` regenerados de
  forma **puramente aditiva**.
- **Frontend novo (feature `features/habits/` + paginas de settings)** — data-layer
  TanStack Query, componente `HabitsManager`, paginas `SettingsPage`/`HabitsSettingsPage`
  e rota `settings/habits`.

O conceito arquitetural central e **AD-06 (versionamento prospectivo)**: a regra de ouro
e "mudanca de config = INSERT de versao". O estado de um habito no dia D e a
`HabitVersion` com `max(effective_from) <= D`. Peso, `active`, `meta` e `bonus` sao
versionados (afetam contribuicao historica); `name`/`emoticon`/`group`/`type` sao
identidade/cosmetico (UPDATE direto); `type` e imutavel apos a criacao.

## Ordem logica de funcionamento

1. Artefatos da story (planejamento/status).
2. Camada de dados — models + migration.
3. Camada de servico (regras de negocio AD-06).
4. Serializers (validacao de forma, split leitura/escrita).
5. Views + URLs (superficie de API).
6. Admin de operador.
7. Wiring de configuracao (settings, urls raiz, conftest).
8. Contrato gerado (OpenAPI + tipos TS).
9. Frontend data-layer (tipos, keys, hooks de API, barrel).
10. Frontend UI (componente, paginas, rota).
11. Testes, na ordem da camada que validam.

---

## 1. Artefatos da story (planejamento/status)

### `_bmad-output/implementation-artifacts/6-1-configuracao-de-habitos-e-grupos.md`

**Funcao geral do arquivo**

Arquivo de contexto/registro da story (nao e codigo). Concentra Story, Acceptance
Criteria, escopo, Dev Notes de arquitetura, tasks, Dev Agent Record (modelo usado, debug
log, completion notes, File List, change log) e o Senior Developer Review.

**Funcao geral do artefato**

Documenta a implementacao da fundacao do Epico 6. Frontmatter fixa
`baseline_commit: a44f20c...`; `Status: done`. Estabelece o padrao de versionamento
prospectivo (`habit_versions` + `effective_from`) que as stories 6.2/6.3/6.4 vao consumir.

**Blocos principais**

- Story (linhas 10-16): "Como Hugo / Quero criar e ajustar habitos organizados em grupos
  / Para que eu modele meu sistema de habitos com mudancas honestas com o passado".
- Acceptance Criteria (linhas 18-48): AC1 criar habito + 1a versao; AC2 alteracao de
  peso/meta/bonus prospectiva com tooltip de string exata; AC3 desativar/reativar sem
  deletar; AC4 gerenciar grupos + lista agrupada (AC derivada, pre-requisito de
  ponta-a-ponta).
- Dev Notes (linhas 104-318): AD-06 como decisao-mae, padrao temporal `effective_from` +
  `today_for`, schema a criar, resolucao de "versao vigente em D", regras da camada de
  servico, superficie de API, wire de settings/urls, feature de frontend, UX Fluxo 7.
- Dev Agent Record (linhas 320-395): debug log (dev controlado in-session; ponto em
  aberto de "2 mudancas no mesmo dia" resolvido; colisao de enum no schema; flakiness do
  Neon), completion notes, File List (bate com o git) e change log.
- Senior Developer Review (linhas 397-410): Approve (0 CRITICAL/HIGH/MEDIUM) + 6 achados
  LOW/NIT nao bloqueantes registrados como follow-ups (N+1 em `list_habits`, ausencia de
  bound inferior em weight/meta/bonus, assimetria meta/bonus booleano entre serializers,
  POST vazio em `/versions/`, divergencia cosmetica de estado local no `HabitRow`).

**Tipo de arquivo**: artefato de implementacao (documentacao de story).

### `_bmad-output/implementation-artifacts/sprint-status.yaml` (apenas a linha 6-1)

**Funcao geral do arquivo**

Rastreamento de status do sprint por story (file-system tracking).

**Funcao geral da alteracao**

Marca o avanco do Epico 6: `epic-6: backlog -> in-progress` e
`6-1-configuracao-de-habitos-e-grupos: backlog -> done`; atualiza o comentario de
`last_updated` para refletir o review da 6.1 (467 testes backend + 625 frontend verdes).
As demais stories do epico (6-2 a 6-4) permanecem `backlog`.

**Tipo de arquivo**: artefato de status.

---

## 2. Camada de dados — models e migration

### `backend/habits/__init__.py`

Arquivo vazio; marca o pacote Python `habits`.

### `backend/habits/apps.py`

**Funcao geral do arquivo**

`AppConfig` do app `habits` (FR-2.x, AD-06, AD-10).

**Blocos principais**

- `HabitsConfig` (linhas 6-8): `default_auto_field = "django.db.models.BigAutoField"` e
  `name = "habits"`. (Os PKs reais dos models sao `UUIDField`, herdados de `TenantModel`;
  o `default_auto_field` so cobre models sem PK explicito.)

**Tipo de arquivo**: config de app Django.

### `backend/habits/models.py`

**Funcao geral do arquivo**

Camada de configuracao prospectiva do Sistema de Habitos (AD-06). Implementa APENAS a
config prospectiva (`habit_versions`), nao o snapshot realizado (`habit_day_entries`, que
e a 6.2).

**Blocos principais**

- `HabitType(models.TextChoices)` (linhas 18-26): enum `BOOLEAN="boolean"` /
  `NUMERIC="numeric"`. Definido no nivel de modulo (nao aninhado em `Habit`) porque uma
  classe aninhada nao e visivel ao `CheckConstraint` do `Meta` — mesmo motivo de
  `bujo.models.TaskStatus`. Reexposto como `Habit.Type` para manter `Habit.Type.BOOLEAN`.
- `HabitGroup(TenantModel)` (linhas 29-38): `name`, `display_order` (default 0, sem UI de
  reorder nesta story); `db_table = "habit_groups"`; `ordering = ["display_order", "name"]`.
- `Habit(TenantModel)` (linhas 41-60): identidade nao versionada. `name`, `emoticon`
  (blank), `group` FK com `on_delete=PROTECT` + `related_name="habits"`, `type`,
  `created_at` (`auto_now_add`). `db_table = "habits"`; `CheckConstraint` `habit_type_valid`
  garantindo `type in HabitType.values`.
- `HabitVersion(TenantModel)` (linhas 63-89): config versionada. `habit` FK
  `on_delete=CASCADE` + `related_name="versions"`; `weight` (`DecimalField` 6,2);
  `active` (bool, default True); `meta` (10,2, nullable — so numericos), `bonus` (5,2,
  nullable); `effective_from` (`DateField`); `created_at`. `db_table = "habit_versions"`;
  ordering `["habit", "-effective_from", "-created_at"]`; `UniqueConstraint(habit,
  effective_from)` chamada `uniq_habit_version_per_day` — **uma versao por (habit, dia)**.

**Funcoes, classes e importacoes especificas**

- `from core.models import TenantModel`: base multi-tenant que injeta `user_id`
  denormalizado (`UUIDField`, `db_index`), auto-scope por tenant e cobertura do gate de
  isolamento. Todos os tres models herdam dela — inclusive `HabitVersion` (reconciliacao
  de AD-06 com a regra de que toda tabela tenant indexa `user_id`).

**Comportamento de libs usadas**

- `models.CheckConstraint(condition=Q(...))`: cria constraint de verificacao no banco;
  usa `HabitType.values` (lista `["boolean","numeric"]`) para restringir `type`.
- `models.UniqueConstraint(fields=[...])`: unicidade composta no banco; base do padrao
  `update_or_create` da camada de servico (uma versao por dia).

**Tipo de arquivo**: source (models Django).

### `backend/habits/migrations/__init__.py`

Arquivo vazio; marca o pacote de migrations.

### `backend/habits/migrations/0001_initial.py`

**Funcao geral do arquivo**

Migration inicial gerada por Django 5.2.15 (2026-07-17). Sem dependencias (`initial = True`).

**Blocos principais**

- `CreateModel HabitGroup` (linhas 16-28): `id` UUID (default `uuid.uuid4`, nao editavel,
  PK), `user_id` UUID indexado, `name`, `display_order`.
- `CreateModel Habit` (linhas 29-44): `id`/`user_id`, `name`, `emoticon`, `type` (choices
  boolean/numeric), `created_at`, FK `group` (`PROTECT`, related `habits`).
- `CreateModel HabitVersion` (linhas 45-62): `id`/`user_id`, `weight` (6,2), `active`,
  `meta` (10,2 null), `bonus` (5,2 null), `effective_from` DATE, `created_at`, FK `habit`
  (`CASCADE`, related `versions`).
- `AddConstraint` (linhas 63-70): `CheckConstraint habit_type_valid` e
  `UniqueConstraint uniq_habit_version_per_day`.

**Tipo de arquivo**: migration (gerada). Reflete fielmente `models.py`.

---

## 3. Camada de servico (regras de negocio AD-06)

### `backend/habits/services.py`

**Funcao geral do arquivo**

Camada de servico do Sistema de Habitos (secao 6.2, AD-06). Funcoes de modulo (nunca
classes de servico); `user` sempre como primeiro kwarg keyword-only; toda escrita e
`@transaction.atomic`; scoping implicito via `TenantManager`.

**Blocos principais**

- `_IDENTITY_FIELDS = ("name", "emoticon", "group_id")` (linha 18): campos de UPDATE
  direto (nao versionados).
- `current_version_of(habit, on_date)` (linhas 21-30): retorna a versao vigente
  (`effective_from__lte=on_date`, ordenado por `-effective_from`, `.first()`). Auto-escopado
  por tenant. Base de toda leitura temporal.
- `create_habit_group` / `list_habit_groups` (linhas 33-38): CRUD minimo de grupos (AC4).
- `list_habits(*, user, include_inactive=False)` (linhas 41-58): carrega habitos com
  `select_related("group")`, anexa a versao vigente hoje em `habit.current_version`, e sem
  `include_inactive` oculta habitos cuja versao vigente hoje e `active=false` (AC3);
  habitos sem versao sao ocultados.
- `create_habit(...)` (linhas 61-86): `@transaction.atomic`. Cria `Habit` + a primeira
  `HabitVersion` (`active=True`, `effective_from = today_for(user)`) na mesma transacao.
  Forca `meta`/`bonus` a `None` para habitos nao-numericos (defesa; a rejeicao de forma e
  do serializer). Anexa `current_version`.
- `update_habit_identity(*, user, habit_id, **fields)` (linhas 89-111): `@transaction.atomic`.
  UPDATE direto de identidade (nao cria versao). `type` presente em `fields` levanta
  `DomainError` ("O tipo do habito e imutavel."). Ao reatribuir `group_id`, valida
  existencia/escopo com `HabitGroup.objects.get`. Salva so os campos alterados
  (`save(update_fields=updated)`); reanexa `current_version`.
- `add_habit_version(*, user, habit_id, weight=None, meta=None, bonus=None, active=None)`
  (linhas 114-147): `@transaction.atomic`. Insere (ou atualiza, se ja houver uma hoje) a
  versao vigente a partir de hoje. Herda da versao vigente os campos nao informados
  (`_inherit`). Zera meta/bonus para nao-numericos. Usa
  `HabitVersion.objects.update_or_create(habit=..., effective_from=today, defaults=...)`
  — segunda mudanca no mesmo dia faz UPDATE; INSERT de nova versao ocorre quando a versao
  vigente e de dia anterior.

**Funcoes, classes e importacoes especificas**

- `from core.calendar import today_for`: resolve o "hoje" logico do usuario (fonte
  temporal canonica; nunca `date.today()`).
- `from core.exceptions import DomainError`: excecao de dominio (mapeada para 400 na
  borda). Regra do projeto: servico so levanta excecoes de `core`.

**Comportamento de libs usadas**

- `QuerySet.update_or_create(**kwargs, defaults=...)`: busca por `kwargs`; se existir,
  aplica `defaults` (UPDATE) e retorna `(obj, False)`; senao cria (INSERT) e retorna
  `(obj, True)`. Combinado com o `UniqueConstraint(habit, effective_from)`, materializa
  "uma versao por (habit, dia)".
- `transaction.atomic` (decorator): garante que `Habit` + `HabitVersion` sejam gravados
  atomicamente.

**Tipo de arquivo**: source (camada de servico).

---

## 4. Serializers (validacao de forma, split leitura/escrita)

### `backend/habits/serializers.py`

**Funcao geral do arquivo**

Serializers do Sistema de Habitos (secao 6.3): split leitura/escrita, view fina. Saida =
`ModelSerializer` com `fields` explicito; entrada = `Serializer` plano com `validate`. O
wire e camelCase (`djangorestframework-camel-case`); os campos ficam snake_case aqui e sao
convertidos na borda.

**Blocos principais**

- `HabitGroupSerializer` (linhas 16-19): saida de grupo — `id`, `name`, `display_order`.
- `HabitGroupCreateSerializer` / `HabitGroupUpdateSerializer` (linhas 22-27): entrada com
  `name` (max 200).
- `HabitVersionSerializer` (linhas 30-33): saida de versao — `id`, `habit`, `weight`,
  `active`, `meta`, `bonus`, `effective_from`.
- `HabitSerializer` (linhas 36-60): saida de habito **achatada com a versao vigente hoje**.
  Campos `weight`/`active`/`meta`/`bonus`/`effective_from` sao `read_only` com
  `source="current_version.<campo>"` (anexado pela camada de servico); `meta`/`bonus`
  `allow_null`. `fields` inclui identidade (`id`, `name`, `emoticon`, `group`, `type`) +
  os campos da versao.
- `HabitCreateSerializer` (linhas 63-83): entrada de criacao. `name`, `emoticon`
  (opcional, default ""), `group` (`UUIDField`), `type` (`ChoiceField` de
  `Habit.Type.choices`), `weight` (6,2), `meta`/`bonus` opcionais nullable. `validate`
  rejeita meta/bonus quando `type != numeric` (400, chave `meta`).
- `HabitUpdateSerializer` (linhas 86-98): entrada de identidade. `name`/`emoticon`/`group`
  opcionais. `validate` rejeita a presenca de `type` em `initial_data` (imutavel, 400).
- `HabitVersionCreateSerializer` (linhas 101-114): nova versao prospectiva. Todos os campos
  (`weight`, `meta`, `bonus`, `active`) opcionais — os nao informados herdam da versao
  vigente na camada de servico.

**Comportamento de libs usadas**

- `serializers.DecimalField(max_digits, decimal_places, source=..., read_only=True)`: no
  `HabitSerializer` puxa valores de `obj.current_version` e serializa como string decimal
  (preservando precisao).
- `serializers.ValidationError({...})`: dispara HTTP 400 com o dicionario de erros por campo.

**Tipo de arquivo**: source (serializers DRF).

---

## 5. Views e URLs (superficie de API)

### `backend/habits/views.py`

**Funcao geral do arquivo**

Views finas (secao 6.2): validam -> chamam o servico -> serializam. `APIView` +
`@extend_schema` para o contrato OpenAPI.

**Blocos principais**

- `HabitGroupListCreateView` (linhas 30-41): `GET` lista grupos; `POST` valida com
  `HabitGroupCreateSerializer`, chama `create_habit_group`, retorna 201.
- `HabitGroupDetailView` (linhas 44-55): `PATCH` renomeia grupo; 404 se nao existir
  (auto-scope de tenant transforma "de outro usuario" em `DoesNotExist`).
- `HabitListCreateView` (linhas 58-87): `GET` com parametro `includeInactive`
  (interpretado de "true"/"1"); `POST` valida com `HabitCreateSerializer`, extrai `group`
  como `group_id`, chama `create_habit`; `HabitGroup.DoesNotExist` -> 400 com chave `group`.
- `HabitDetailView` (linhas 90-106): `PATCH` de identidade via `update_habit_identity`;
  mapeia `group` -> `group_id`; `Habit.DoesNotExist` -> 404, `HabitGroup.DoesNotExist` -> 400.
- `HabitVersionCreateView` (linhas 109-122): `POST /versions/` valida com
  `HabitVersionCreateSerializer`, chama `add_habit_version`; `Habit.DoesNotExist` -> 404;
  retorna 201 com `HabitVersionSerializer`.

**Comportamento de libs usadas**

- `@extend_schema(request=..., responses=...)` (drf-spectacular): anota cada handler para o
  schema OpenAPI gerado. `OpenApiParameter(name="includeInactive", type=bool)` documenta o
  query param.
- `serializer.is_valid(raise_exception=True)`: dispara 400 automatico em entrada invalida.
- `rest_framework.exceptions.NotFound`: 404 (`raise NotFound() from None` suprime o
  encadeamento do `DoesNotExist`).

**Tipo de arquivo**: source (views DRF).

### `backend/habits/urls.py`

**Funcao geral do arquivo**

Rotas do recurso habito (montadas sob `api/habits/`).

**Blocos principais** (linhas 9-13)

- `""` -> `HabitListCreateView` (`habit-list`).
- `"<uuid:pk>/"` -> `HabitDetailView` (`habit-detail`).
- `"<uuid:pk>/versions/"` -> `HabitVersionCreateView` (`habit-version-create`) — mudanca de
  config e um POST neste sub-recurso.

**Tipo de arquivo**: source (URLconf).

### `backend/habits/urls_groups.py`

**Funcao geral do arquivo**

Rotas de grupo (montadas sob `api/habit-groups/`, separadas para nao aninhar sob habitos).

**Blocos principais** (linhas 5-8)

- `""` -> `HabitGroupListCreateView` (`habit-group-list`).
- `"<uuid:pk>/"` -> `HabitGroupDetailView` (`habit-group-detail`).

**Tipo de arquivo**: source (URLconf).

---

## 6. Admin de operador

### `backend/habits/admin.py`

**Funcao geral do arquivo**

Admin de operador (AD-12) para os tres models. Ponto-chave: cada `get_queryset` usa
`Model.all_objects.all()` (bypass do auto-scope de tenant) — o operador enxerga todos os
tenants no admin.

**Blocos principais**

- `HabitGroupAdmin` (linhas 8-14): `list_display`/`search_fields` com `id`, `user_id`, `name`.
- `HabitAdmin` (linhas 17-24): `list_filter` por `type`.
- `HabitVersionAdmin` (linhas 27-34): `list_filter` por `active`.

**Tipo de arquivo**: source (admin Django).

---

## 7. Wiring de configuracao

### `backend/config/settings/base.py` (modificado, +12)

**Funcao geral da alteracao**

Dois pontos: registra o app e resolve uma colisao de enum no contrato.

**Blocos principais**

- `INSTALLED_APPS`: adiciona `"habits"` apos `"braindump"`.
- `SPECTACULAR_SETTINGS.ENUM_NAME_OVERRIDES`: novo bloco. Sem override, o campo `type` de
  habitos (boolean/numeric) colidia com o `type` (weekly/monthly) do
  `bujo.ArchiveEntrySerializer` — ambos viravam `TypeEnum` e o drf-spectacular os
  renomeava com hash instavel, poluindo o contrato de bujo. O override nomeia
  `"HabitTypeEnum": "habits.models.HabitType"` e fixa `"TypeEnum": ["weekly", "monthly"]`,
  deixando o diff do schema **puramente aditivo** e o contrato de bujo intacto.

**Tipo de arquivo**: config (settings). Sem alteracao de comportamento de codigo.

### `backend/config/urls.py` (modificado, +2)

**Funcao geral da alteracao**

Monta as duas URLconfs do app: `path("api/habits/", include("habits.urls"))` e
`path("api/habit-groups/", include("habits.urls_groups"))`, antes dos endpoints de schema.

**Tipo de arquivo**: config (URLconf raiz).

### `backend/conftest.py` (modificado, +7/-1)

**Funcao geral da alteracao**

Adiciona `"habits.tests.factories"` a `_ISOLATION_TEST_MODULES`. Esses modulos sao
importados no boot dos testes para que as chamadas de `register_isolation_case` (no import)
alimentem o **contrato de isolamento multi-tenant compartilhado** (core/tests/registry.py)
— o teste generico de isolamento passa a cobrir tambem os models de `habits`.

**Tipo de arquivo**: config de teste (fixtures/pytest).

---

## 8. Contrato gerado (OpenAPI + tipos TS)

> Ambos regenerados a partir das views/serializers; puramente aditivos (nenhuma linha
> removida). Descritos em alto nivel por grupo de path/schema, conforme o skill.

### `schema.yaml` (modificado, +351/-0 — gerado)

**Funcao geral da alteracao**

Contrato OpenAPI regenerado. Adiciona os paths `/api/habit-groups/`,
`/api/habit-groups/{id}/`, `/api/habits/`, `/api/habits/{id}/` e `/api/habits/{id}/versions/`
com as operacoes GET/POST/PATCH correspondentes, e os component schemas: `Habit`,
`HabitCreate`, `HabitGroup`, `HabitGroupCreate`, `HabitTypeEnum` (enum boolean/numeric),
`HabitVersion`, `HabitVersionCreate`, `PatchedHabitGroupUpdate`, `PatchedHabitUpdate`. O
`ENUM_NAME_OVERRIDES` de base.py garante que o `TypeEnum` de bujo permaneca inalterado
(diff aditivo).

**Tipo de arquivo**: contrato gerado (OpenAPI).

### `frontend/src/api/types.gen.ts` (modificado, +329/-0 — gerado)

**Funcao geral da alteracao**

Tipos TypeScript regenerados do `schema.yaml`. Adiciona as entradas de `paths` para os 5
endpoints, as `operations` (`habits_list`, `habits_create`, `habits_partial_update`,
`habits_versions_create`, `habit_groups_list`, `habit_groups_create`,
`habit_groups_partial_update`) e os `components["schemas"]` correspondentes
(`Habit`, `HabitCreate`, `HabitGroup`, `HabitGroupCreate`, `HabitTypeEnum` =
`"boolean" | "numeric"`, `HabitVersion`, `HabitVersionCreate`, `PatchedHabitGroupUpdate`,
`PatchedHabitUpdate`). E o contrato consumido pela camada de tipos do frontend
(`features/habits/types.ts`).

**Tipo de arquivo**: contrato gerado (tipos TS).

---

## 9. Frontend data-layer

### `frontend/src/features/habits/types.ts`

**Funcao geral do arquivo**

Deriva os tipos de dominio do contrato gerado (fonte unica de verdade). `Habit`,
`HabitGroup`, `HabitVersion` e `HabitType` (= `HabitTypeEnum`) apontam para
`components['schemas'][...]` de `types.gen.ts`.

**Tipo de arquivo**: source (tipos de feature).

### `frontend/src/api/keys.ts` (modificado, +6/-1)

**Funcao geral da alteracao**

Adiciona a secao `habits` de query keys (sem `userId`, mesmo racional de `bujo.*`: logout
limpa o cache inteiro). `habits.list(params)` -> `['habits','list', params ?? {}]`;
`habits.groups()` -> `['habits','groups','list']`. Substitui o comentario placeholder de
"Story 6.x". O prefixo comum `['habits']` e usado nas invalidacoes das mutations.

**Tipo de arquivo**: source (query keys).

### `frontend/src/features/habits/api.ts`

**Funcao geral do arquivo**

Data-layer TanStack Query da feature: queries de leitura + mutations de escrita com
invalidacao por prefixo `['habits']` (sem otimismo — a 6.1 nao exige).

**Blocos principais**

- Queries: `useHabitsQuery({ includeInactive })` (GET `/api/habits/` + query param
  condicional) e `useHabitGroupsQuery()` (GET `/api/habit-groups/`).
- Mutations (todas com `onSuccess: invalidateQueries({ queryKey: ['habits'] })`):
  `useCreateHabitMutation` (POST `/api/habits/`), `useUpdateHabitIdentityMutation` (PATCH
  `/api/habits/{id}/`), `useAddHabitVersionMutation` (POST `/api/habits/{id}/versions/`),
  `useCreateHabitGroupMutation` (POST `/api/habit-groups/`).
- Interfaces de variaveis (`CreateHabitVariables`, `UpdateHabitIdentityVariables`,
  `AddHabitVersionVariables`, `CreateHabitGroupVariables`) tipam os payloads.

**Comportamento de libs usadas**

- `useQuery({ queryKey, queryFn })` / `useMutation({ mutationFn, onSuccess })` do
  `@tanstack/react-query`: gerenciam server state e revalidacao.
- `queryClient.invalidateQueries({ queryKey: ['habits'] })`: marca como stale toda query
  sob o prefixo `habits` (lista + grupos), disparando refetch apos escrita.
- `client` (axios): `.get`/`.post`/`.patch` retornam `{ data }`.

**Tipo de arquivo**: source (data-layer).

### `frontend/src/features/habits/index.ts`

**Funcao geral do arquivo**

Barrel da feature: reexporta os 6 hooks de `api`, o componente `HabitsManager` e os tipos
(`Habit`, `HabitGroup`, `HabitVersion`, `HabitType`).

**Tipo de arquivo**: source (barrel).

---

## 10. Frontend UI (componente, paginas, rota)

### `frontend/src/features/habits/components/HabitsManager.tsx`

**Funcao geral do arquivo**

Componente central da tela Configuracoes > Habitos (UX Fluxo 7): criacao de grupo, lista
agrupada por grupo, criacao de habito com campos condicionais para numerico, edicao inline
de peso (com o tooltip prospectivo), toggle Desativar/Ativar, switch "Mostrar inativos" e
empty states.

**Blocos principais**

- Constantes (linhas 27-35): `PROSPECTIVE_CHANGE_TOOLTIP` = string EXATA da AC2 ("Alteracao
  valida a partir de hoje. Registros anteriores preservados.", verificada em teste);
  `SAVE_ERROR`; `HABIT_TYPE_LABEL` (booleano/numerico).
- `HabitRow` (linhas 43-146): linha de habito. Estado local de edicao (`weight`/`meta`/
  `bonus`); `handleSave` chama `addVersion.mutate` (envia meta/bonus so p/ numericos);
  `handleToggleActive` insere versao com `active` invertido (AC3). Tooltip no campo de
  peso em edicao; mensagem de erro `role="alert"` em falha.
- `GroupSection` (linhas 153-169): cabecalho `h3` com o nome do grupo; filtra habitos por
  `group === group.id`; empty state "Nenhum habito neste grupo.".
- `HabitsManager` (linhas 171-366): orquestra queries/mutations, estado dos dois forms
  (novo grupo / novo habito), `showInactive`. Form de grupo (aria-label "Novo grupo de
  habitos"); switch "Mostrar inativos"; se sem grupos, orienta a criar grupo e desabilita
  criacao de habito; form de habito (aria-label "Novo habito") com Select de grupo,
  ToggleButtonGroup de tipo, peso e campos Meta/Bonus condicionais (so numerico, com "%").

**Comportamento de libs usadas**

- MUI: `TextField`, `Select`/`MenuItem`, `ToggleButtonGroup`/`ToggleButton`, `Switch`,
  `Tooltip`, `InputAdornment` (sufixo "%"), `Button` com `AddIcon`. Usa tipografia MUI
  nativa (`body2`/`caption`) — decisao documentada na story (evita a armadilha do
  `component="div"` da tipografia custom).
- Hooks da feature (`useHabitsQuery`, `useHabitGroupsQuery`, `useCreateHabitMutation`,
  `useCreateHabitGroupMutation`, `useAddHabitVersionMutation`).

**Tipo de arquivo**: source (componente React).

### `frontend/src/pages/settings/HabitsSettingsPage.tsx`

**Funcao geral do arquivo**

Pagina da rota `settings/habits`. `<Box component="main" aria-label="Configuracoes —
Habitos">` com titulo, subtitulo ("Mudancas de peso valem a partir de hoje.") e o
`HabitsManager`.

**Tipo de arquivo**: source (pagina).

### `frontend/src/pages/settings/SettingsPage.tsx`

**Funcao geral do arquivo**

Hub minimo de Configuracoes (Story 6.1): por ora so o link "Habitos" (`RouterLink` para
`/settings/habits`), para tornar o caminho Configuracoes -> Habitos navegavel de ponta a
ponta. `<main aria-label="Configuracoes">`; item de lista com `minHeight: 44` (touch target).

**Tipo de arquivo**: source (pagina).

### `frontend/src/app/router.tsx` (modificado, +8/-1)

**Funcao geral da alteracao**

Fia as duas paginas no roteador. Importa `SettingsPage` e `HabitsSettingsPage`; troca o
`PlaceholderPage` da rota `settings` por `<SettingsPage />`; adiciona a rota filha
`settings/habits` -> `<HabitsSettingsPage />` com `handle.title = "Configuracoes — Habitos"`.

**Tipo de arquivo**: source (roteamento).

---

## 11. Testes

### `backend/habits/tests/__init__.py`

Arquivo vazio; marca o pacote de testes.

### `backend/habits/tests/factories.py`

**Funcao geral do arquivo**

Factories `factory_boy` dos tres models + registro no contrato de isolamento (secao 7.4).
`user_id` e `UUIDField` puro em `TenantModel`, entao usa `class Params` + `SelfAttribute`
(mesmo de bujo). Datas fixas + `timedelta` (guardrail temporal proibe `date.today()`).

**Blocos principais**

- `HabitGroupFactory` / `HabitFactory` / `HabitVersionFactory` (linhas 20-56): `user_id`
  via `SelfAttribute("user.id")`; `HabitFactory` cria grupo no mesmo user via
  `LazyAttribute`; `HabitVersionFactory` usa `effective_from` sequencial a partir de
  `date(2026,1,1)`.
- `register_isolation_case(...)` x3 (linhas 59-84): registra `habits.HabitGroup`,
  `habits.Habit` e `habits.HabitVersion` no contrato generico de isolamento (consumido via
  conftest).

**Tipo de arquivo**: test (factories + registro de isolamento).

### `backend/habits/tests/test_models.py`

**Funcao geral do arquivo**

Testes de constraints de banco e defaults (AD-06).

**Blocos principais**: rejeicao do `CheckConstraint` de `type` invalido; unicidade de
versao por (habit, dia); duas versoes em dias diferentes permitidas; `display_order`
default 0; ordering "mais recente primeiro". Todos dentro de `tenant_context(user)`.

**Tipo de arquivo**: test (models).

### `backend/habits/tests/test_serializers.py`

**Funcao geral do arquivo**

Testes de validacao de forma (secao 6.4): booleano rejeita meta/bonus; numerico aceita;
booleano sem meta/bonus e valido; criacao exige `group`; update rejeita mudanca de `type`;
update sem `type` valido; version-create com todos os campos opcionais.

**Tipo de arquivo**: test (serializers).

### `backend/habits/tests/test_services.py`

**Funcao geral do arquivo**

Testes da camada de servico (AD-06, AC1-AC4). Documenta inline a resolucao do "ponto em
aberto": uma versao por (habit, effective_from) -> mudanca no mesmo dia da criacao e
UPDATE; INSERT de 2a versao ocorre quando a vigente e de dia anterior. Cobre `create_habit`
(1 versao ativa hoje; forcar/manter meta/bonus), `add_habit_version` (INSERT entre dias
preservando a anterior; UPDATE no mesmo dia; heranca de campos), desativar/reativar,
`update_habit_identity` (muda nome sem versao; rejeita `type`), `current_version_of`
(resolucao temporal) e `list_habits` (oculta inativos + anexa versao vigente) e grupos.

**Tipo de arquivo**: test (servico).

### `backend/habits/tests/test_views.py`

**Funcao geral do arquivo**

Testes de view/API (AC1-AC4 + isolamento secao 6.7) via `auth_client`. Cobre grupos vazio
200 / criacao 201; criar habito + 1a versao; grupo invalido 400 (chave em `fields`);
booleano com meta 400; listagem oculta inativos exceto com `includeInactive=true`; PATCH de
nome; PATCH de `type` 400; POST de versao desativando; POST de versao em habito inexistente
404; e **isolamento multi-tenant**: `user` nao ve habitos de `other_user` (lista vazia) e
nao consegue mutar (auto-scope -> 404).

**Tipo de arquivo**: test (view/API).

### `frontend/src/features/habits/api.test.tsx`

**Funcao geral do arquivo**

Testes dos hooks do data-layer com `client` mockado (`vi.mock`) e `QueryClientProvider`.
Verifica URLs chamadas, payloads e invalidacao do prefixo `['habits']` no sucesso das
mutations. Fixtures `HABIT`/`GROUP` no formato camelCase do wire (`effectiveFrom`,
`displayOrder`).

**Blocos principais**: `useHabitsQuery` (ativos por padrao / `includeInactive=true`);
`useHabitGroupsQuery`; `useCreateHabitMutation` (payload + `invalidateQueries`);
`useUpdateHabitIdentityMutation` (PATCH); `useAddHabitVersionMutation` (POST peso / POST
`active:false`); `useCreateHabitGroupMutation`.

**Tipo de arquivo**: test (hooks/data-layer).

### `frontend/src/features/habits/components/HabitsManager.test.tsx`

**Funcao geral do arquivo**

Testes de componente (Testing Library + userEvent + jest-axe) com `client` mockado por URL.

**Blocos principais**: lista agrupada com empty state por grupo vazio; Meta/Bonus so
aparecem no tipo Numerico; **tooltip de string exata da AC2** ao editar peso; criar habito
com o payload correto; desativar via nova versao (`active:false`); sem grupos orienta a
criar grupo e desabilita "Criar habito"; sem violacoes de acessibilidade (jest-axe).

**Tipo de arquivo**: test (componente).
