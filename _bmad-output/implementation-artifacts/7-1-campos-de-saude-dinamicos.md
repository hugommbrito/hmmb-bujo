---
baseline_commit: 65828bcdefebb8f17fe4ad06c2455aa971c388c0
---

# Story 7.1: Campos de saúde dinâmicos

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero criar e gerenciar meus próprios campos de métrica de saúde (nome + tipo), podendo desativar sem apagar,
Para que eu rastreie exatamente o que importa para mim, com o conjunto de campos evoluindo no tempo e o histórico preservado (FR-3.1, AR-7, AD-01).

**Primeira story do Épico 7 (Métricas de Saúde).** É a fundação de modelagem do domínio de Saúde: cria o app `health/` do backend do zero e a feature `features/health/` do frontend do zero, mais a tela **Configurações > Métricas de Saúde**. Estabelece o **catálogo de campos dinâmicos** (`health_field_definitions`) que é a **fonte de verdade** para tipar/validar/renderizar valores — consumido pela Story 7.2 (log diário grava `health_logs.values` JSONB indexado pelo **UUID** de cada definição) e pela Story 7.3 (histórico/gráficos via cast JSONB). Ordem interna do épico: **definições (7.1) → log diário (7.2) → histórico em 3 visualizações (7.3)**.

> **Divergência-chave em relação ao Épico 6 (Hábitos):** hábitos são **versionados** (`habit_versions`, `effective_from`) porque peso/ativo alimentam um denominador de completude congelado historicamente (AD-06/AD-10). **Saúde NÃO tem cálculo de completude ponderada** — a AD-01 desenha `health_field_definitions` como uma tabela **plana e não-versionada** `(id, user_id, name, field_type, active, display_order)`. **NÃO porte `habit_versions`/`effective_from`/snapshots para 7.1.** A definição é um registro simples, fonte de verdade viva.

## Acceptance Criteria

### AC1 — Criar campo de saúde (FR-3.1, AR-7, AD-01)

**Dado que** estou na tela Configurações > Métricas de Saúde,
**Quando** crio um campo,
**Então** `health_field_definitions` grava `name`, `field_type` (um de: `integer` / `decimal` / `boolean` / `enum` / `text`), `active` (default `true`) e `display_order`, **escopado por tenant** (`user_id` via `TenantModel`),
**E** o `id` do campo é um **UUID estável** (será a chave usada em `health_logs.values` na Story 7.2).

### AC2 — Desativar sem deletar; preservado no histórico (FR-3.1, FR-3.2, NFR-4)

**Dado que** existe um campo ativo,
**Quando** o desativo,
**Então** o campo recebe `active=false` (nunca é deletado) e some da lista ativa, mas continua existindo (o registro e seus valores históricos futuros são preservados),
**E** reativar (`active=true`) faz o campo reaparecer na lista ativa. **Nenhuma operação apaga fisicamente uma definição.**

### AC3 — Campo enum tem opções definidas pelo usuário (FR-3.1, AD-01)

**Dado que** crio um campo `field_type = enum`,
**Quando** o defino,
**Então** informo suas **opções** (lista de rótulos definida por mim; pelo menos uma opção obrigatória),
**E** para os demais tipos (`integer`/`decimal`/`boolean`/`text`) opções **não** se aplicam (rejeitadas ou ignoradas na validação),
**E** a definição (tipo + opções) é a **fonte de verdade** para tipar, validar e renderizar o campo na leitura e na escrita (contrato consumido por 7.2/7.3; nada de renderização/validação de valor é construído aqui).

### AC4 — Editar identidade sem quebrar integridade histórica (FR-3.1, NFR-4)

**Dado que** existe um campo,
**Quando** o edito,
**Então** posso alterar `name`, `display_order`, `active` e (para enum) as `enum_options`,
**E** `field_type` é **imutável após a criação** — a tentativa de alterá-lo é rejeitada (mudar o tipo invalidaria a tipagem dos valores históricos que a Story 7.2 grava por UUID; a definição precisa continuar tipando corretamente o passado — NFR-4).

## Escopo — o que NÃO entra nesta story (limites explícitos)

Para impedir que o dev construa o épico inteiro de uma vez, estes itens são de stories posteriores e **não devem** ser construídos aqui:

- ❌ **Tabela `health_logs` / gravação de valores / validação de valor JSONB por `field_type` / exclusão camelCase de `values` (`ignore_fields`) / round-trip idempotente** → **Story 7.2**. O `HealthFieldDefinition` de 7.1 deve ser *projetado* para tipar/validar os valores de 7.2 (o `id` UUID é a chave futura), mas **nenhuma linha de `health_logs` é criada ou lida aqui**, e **`JSON_CAMEL_CASE['JSON_UNDERSCOREIZE']['ignore_fields']` NÃO é alterado nesta story** (`values` é campo da 7.2).
- ❌ **Health Metric Row / controles de input por tipo (teclado numérico `inputMode`, toggle booleano, select enum) / ritual da manhã "Ontem, [data]" / confirmação inline de salvamento** → **Story 7.2**. 7.1 só gerencia *definições*, não *valores*.
- ❌ **Histórico em tabela, gráficos de evolução (`(values->>'uuid')::numeric`), dashboard de período, `recharts`** → **Story 7.3**.
- ❌ **Qualquer versionamento/effective-dating/snapshot ao estilo hábitos** → não existe em Saúde (AD-01). Ver nota na seção Story.
- ❌ **Qualquer FK para `medications`** → domínios independentes, sem FK (architecture.md §7.1 linha 1150).
- ❌ **Substituir o placeholder do primeiro-nível `/health/metrics` ou mexer no Sidebar/BottomNav "Saúde › Métricas"** → aquela superfície é o *log diário* da Story 7.2. 7.1 vive em **`/settings/health-metrics`**, alcançada via a página Configurações.

O `display_order` **entra no schema** (a AD-01 o especifica), populado sequencialmente na criação (append ao fim). **UI de reordenação (drag/subir-descer) é opcional/deferível** — espelha o precedente de 6.1 (`display_order` no schema, sem UI de reorder na primeira fatia). Ver "Decisões a confirmar".

## Tasks / Subtasks

- [x] **Task 1 — Criar o app Django `health/` e o model (AC1, AC2, AC3, AC4)**
  - [x] Criar `backend/health/` espelhando o esqueleto de `backend/habits/` (`__init__.py`, `apps.py`, `models.py`, `serializers.py`, `services.py`, `views.py`, `urls.py`, `admin.py`, `migrations/`, `tests/`). Ver Dev Notes › "Esqueleto do app".
  - [x] Registrar `"health"` no fim do bloco `# Local` de `INSTALLED_APPS` em `backend/config/settings/base.py` (após `"habits"`).
  - [x] Enum **em nível de módulo** (não aninhado — senão o `CheckConstraint` não o enxerga): `class HealthFieldType(models.TextChoices): INTEGER="integer"; DECIMAL="decimal"; BOOLEAN="boolean"; ENUM="enum"; TEXT="text"`.
  - [x] `HealthFieldDefinition(TenantModel)`: `name` (CharField, ex. `max_length=200`), `field_type` (CharField + `choices=HealthFieldType.choices`, imutável), `enum_options` (JSONField, default `list`, `blank=True` — ver Dev Notes › "Opções de enum"), `active` (BooleanField, default `True`), `display_order` (PositiveIntegerField, default 0), `created_at` (DateTimeField `auto_now_add`). `Meta.db_table = "health_field_definitions"`, `ordering = ["display_order", "name"]`, `constraints = [CheckConstraint(condition=Q(field_type__in=HealthFieldType.values), name="health_field_type_valid")]`. Re-expor `FieldType = HealthFieldType` como atributo de classe para ergonomia. Ver Dev Notes › "Modelo de dados".
  - [x] `makemigrations health --name initial` — **uma** migration (`0001_initial`).
- [x] **Task 2 — Camada de serviço (AC1, AC2, AC3, AC4)**
  - [x] `create_health_field(*, user, name, field_type, enum_options=None, display_order=None) -> HealthFieldDefinition` (`@transaction.atomic`): cria a definição; se `display_order` não vier, calcula `max(display_order)+1` do tenant (append). Regra de negócio: enum exige ≥1 opção; não-enum não aceita opções.
  - [x] `update_health_field(*, user, field_id, **fields) -> HealthFieldDefinition` (`@transaction.atomic`): UPDATE direto de `name`/`display_order`/`enum_options`/`active`. **Rejeitar `field_type`** (imutável) → `DomainError` (ou barrar no serializer de update; escolher uma e testar). → Feito em AMBOS: `DomainError` no service **e** rejeição no serializer (`self.initial_data`, snake+camel).
  - [x] ~~`set_health_field_active(...)`~~ **coberto via `update_health_field`** (a task já previa "ou cobrir via `update_health_field`"): `active` está em `_MUTABLE_FIELDS`; desativar/reativar = `PATCH {active}`. Nunca `.delete()`.
  - [x] `list_health_fields(*, user, include_inactive=False)`: lista escopada; por default só ativos, ordenados por `display_order, name`.
  - [x] **Só levantar exceções de `core/exceptions.py`** (`DomainError` → 409). Sem `ValidationError`/`ValueError` cru no service. Ver Dev Notes › "Camada de serviço".
- [x] **Task 3 — API DRF + contrato (AC1, AC2, AC3, AC4)**
  - [x] Views finas `APIView` (o codebase **não** usa ViewSet/router) com `@extend_schema`. Endpoints sob **`/api/health-field-definitions/`** (ver Dev Notes › "Colisão de URL — `/api/health/` é reservado!"):
        `GET /api/health-field-definitions/` (lista; `?includeInactive=true`), `POST` (criar), `PATCH /api/health-field-definitions/{id}/` (editar name/enum_options/display_order/active; **desativar/reativar = `PATCH {active}`**).
  - [x] Serializers com split leitura/escrita: `ModelSerializer` de saída com `fields` explícito (nunca `"__all__"`) expondo `id, name, fieldType, enumOptions, active, displayOrder`; `Serializer` plano de entrada com `validate()` (enum⇔opções; rejeição de `field_type` em update via `self.initial_data`). `enum_options` declarado como `ListField(child=CharField())` para tipar `string[]` no contrato.
  - [x] Wire em `backend/config/urls.py`: `path("api/health-field-definitions/", include("health.urls"))` — **NÃO** usar `api/health/` (colisão com o healthcheck).
  - [x] Adicionar `ENUM_NAME_OVERRIDES` para o enum de tipo em `SPECTACULAR_SETTINGS` (`base.py`): `"HealthFieldTypeEnum": "health.models.HealthFieldType"` — mantém o contrato **aditivo/estável** (lição do Épico 6). Ver Dev Notes › "Contrato/casing".
  - [x] Regenerar contrato: `uv run python manage.py spectacular --file ../schema.yaml` + `npm run generate-types` → `schema.yaml` (+156 linhas, 0 remoções — puramente aditivo) **e** `frontend/src/api/types.gen.ts` regenerados.
- [x] **Task 4 — Feature frontend `features/health/` (AC1, AC2, AC3, AC4)**
  - [x] Criar `frontend/src/features/health/` espelhando `features/habits/`: `api.ts` (hooks TanStack Query), `types.ts` (`import type { components } from '../../api/types.gen'` → `HealthFieldDefinition`/`HealthFieldTypeEnum`), `index.ts` (barrel), `components/`.
  - [x] Adicionar seção `health` em `frontend/src/api/keys.ts` (slot reservado). `health: { fieldDefinitions: (params?: { includeInactive?: boolean }) => ['health', 'fieldDefinitions', 'list', params ?? {}] as const }`.
  - [x] Hooks: `useHealthFieldDefinitionsQuery`, `useCreateHealthFieldMutation`, `useUpdateHealthFieldMutation` (o toggle de `active` usa o de update — sem hook set-active dedicado para evitar wrapper redundante). Escrita = `useMutation` + `invalidateQueries({ queryKey: ['health'] })` por prefixo (padrão config-CRUD; **sem otimismo**).
  - [x] `HealthMetricsManager.tsx` modelado em `HabitsManager.tsx`: lista ordenada por `displayOrder`, form inline com **seletor de tipo** (`Select` com `aria-label`), **editor de opções condicional** (`{fieldType === 'enum' && (...)}` — lista repetível com adicionar/remover), toggle Desativar/Ativar, `Switch` "Mostrar inativos", empty state, **estados de loading (skeleton)/erro de leitura (retry)/erro de escrita (input preservado)**.
  - [x] Formulários com `useState` controlado + MUI. Erro inline via constante única: `"Não foi possível salvar. Tente novamente."`.
- [x] **Task 5 — Rota e navegação (AC1)**
  - [x] Criar `frontend/src/pages/settings/HealthMetricsSettingsPage.tsx` (espelho de `HabitsSettingsPage.tsx`): `<Box component="main" aria-label="Configurações — Métricas de Saúde">` renderizando `<HealthMetricsManager/>`.
  - [x] Adicionar rota `{ path: 'settings/health-metrics', element: <HealthMetricsSettingsPage/>, handle: { title: 'Configurações — Métricas de Saúde' } }` em `frontend/src/app/router.tsx` (irmã de `settings/habits`).
  - [x] Adicionar um `<ListItem>`/`<Link>` "Métricas de Saúde" em `frontend/src/pages/settings/SettingsPage.tsx` (hub), para navegabilidade ponta-a-ponta.
  - [x] **NÃO** toquei no placeholder `/health/metrics` nem no Sidebar/BottomNav. **Nada** Query-driven adicionado à nav (os 3 testes compartilhados seguem verdes).
- [x] **Task 6 — Testes backend (todas as ACs)**
  - [x] `health/tests/factories.py`: `HealthFieldDefinitionFactory` no padrão `class Params: user = SubFactory(UserFactory)` + `user_id = SelfAttribute("user.id")`; chama `register_isolation_case(...)`. Sem `date.today()`.
  - [x] Adicionar `"health.tests.factories"` a `_ISOLATION_TEST_MODULES` em `backend/conftest.py`.
  - [x] `test_models.py`, `test_serializers.py`, `test_services.py`, `test_views.py` cobrindo: criação grava campos + `active=true` + UUID; `field_type` inválido barrado (IntegrityError no DB / 400 no serializer); **`field_type` imutável** (rejeição no update, snake+camel); enum exige ≥1 opção / não-enum rejeita opções (create+update); desativar seta `active=false` (registro persiste) e reativar; `display_order` default/append; isolamento cross-tenant (404 via service+view) e **fail-closed** (`TenantScopeViolation` sem contexto — coberto pelo contrato de isolamento parametrizado).
- [x] **Task 7 — Testes frontend (todas as ACs)**
  - [x] `features/health/api.test.tsx` e `components/HealthMetricsManager.test.tsx` espelhando os de `habits`: `vi.mock('../../../api/client')`, wrapper `QueryClientProvider` (`retry:false`), `jest-axe` sem violações. Assert de endpoint/payload (camelCase), invalidação `['health']`, editor de opções condicional (só com tipo `enum`), toggle ativo, empty state, erro de leitura com retry, rótulo "(inativo)".
  - [x] N/A: nenhum input numérico (`<input type="number">`) na tela desta fatia (reorder deferido) — sem o caveat jsdom.
- [x] **Task 8 — Verificação e contrato**
  - [x] Backend verde: `ruff` (health/config/conftest — All checks passed), `lint-imports` (contrato "core must not import domain apps" KEPT — `health` já em `forbidden_modules`, nenhuma mudança), `pytest` (health app: 46 passed; suíte completa: ver Completion Notes), `spectacular` + diff `types.gen.ts` (aditivo).
  - [x] Frontend verde: `tsc` (typecheck limpo), ESLint (limpo), `vitest` (suíte completa: 677 passed / 61 files, inclui 15 novos de health), `vite build` (ok). Node 22.15.1 via nvm.
  - [x] Migration `health.0001_initial` aplicada ao test DB do Neon via `pytest --create-db` (rebuild com a nova migration). Run escopado disponível como fallback (`pytest health accounts core --reuse-db`) se a full-suite travar.

## Dev Notes

### Contexto de arquitetura — AD-01 (Schema Dinâmico diferenciado) é a decisão-mãe

A story implementa **apenas o catálogo de definições** da AD-01, não o armazenamento/validação de valores (que é 7.2). Texto literal da AD-01 [Source: architecture.md#AD-01 linhas 91-120]:

> *"**Métricas de saúde → JSONB.** Os campos são genuinamente abertos — o usuário define nome, tipo e quantidade. JSONB com índice GIN e validação de tipo na camada de serviço (contra `health_field_definitions`)."*

Schema simplificado (AD-01, linhas 108-110) [Source: architecture.md linhas 108-110]:

```
health_field_definitions (id, user_id, name, field_type, active, display_order)
health_logs (id, user_id, date, values JSONB)   -- 7.2, NÃO nesta story
-- values = {"uuid-campo-peso": 88.2, "uuid-campo-sono": 4, "uuid-atividade": true}
```

**O ponto crítico de fundação:** o `id` (UUID) de cada `health_field_definition` é **a chave** que a Story 7.2 usará dentro de `health_logs.values`. Por isso o UUID precisa ser estável (o `TenantModel` garante — UUID PK imutável) e `field_type` precisa ser imutável (senão os valores históricos por UUID ficariam mal-tipados). A operacionalização na escrita/leitura (7.2) [Source: architecture.md#AD-01 linhas 117-120]: *"serviço carrega `health_field_definitions` ativas do usuário, valida cada valor submetido contra o `field_type` correspondente... Na leitura: serviço usa as definições para saber como tipar e renderizar cada campo."* — 7.1 entrega exatamente esse catálogo-fonte-de-verdade.

### ⚠️ Colisão de URL — `/api/health/` já é reservado (healthcheck)!

**NÃO monte o domínio de saúde em `/api/health/`.** Já existe `path("api/health/", health, name="health")` em `config/urls.py` — é o **liveness check** (sem auth, sem DB, `@extend_schema(exclude=True)`), com teste dedicado garantindo que **não** aparece no schema [Source: backend/core/views.py; backend/config/urls.py:11; backend/core/tests/test_api_contract.py:86-94 `test_health_excluido_do_schema`]. A arquitetura §6.1 já prescreve o prefixo correto para composto: **`/api/health-field-definitions/`** [Source: architecture.md#§6.1 linhas 867-869]. Use esse. (Para 7.2, `/api/health-logs/` será o irmão — mesmo padrão de prefixos-irmãos de `habits`/`habit-groups`.) O **nome do app** pode ser `health` (o conflito é só de rota).

> Observação de teste: `backend/core/tests/test_api_contract.py` **já** referencia `health_field_id` e `health_logs.values` (linhas 17, 27, 34-50) — o domínio de saúde está pré-cabeado no contrato. O `health_field_id` normal **cameliza** para `healthFieldId` (é campo comum, não chave dinâmica de JSONB) — a exceção de camelCase é só para as *chaves internas* de `health_logs.values`, e isso é 7.2.

### Modelo de dados — `health_field_definitions` (plano, não-versionado)

Diretrizes de implementação (convenções §6.1) [Source: architecture.md#§6.1 linhas 858-869; backend/habits/models.py]:

- **Herda `core.models.TenantModel`** → UUID PK `id` + `user_id UUIDField(db_index=True)` + managers `objects=TenantManager()` (auto-escopado, fail-closed) / `all_objects` [Source: backend/core/models.py:21-43]. Import: `from core.models import TenantModel`. **Não redeclarar `id`/`user_id`.**
- **`field_type`**: `CharField(max_length=10, choices=HealthFieldType.choices)` + `CheckConstraint(Q(field_type__in=HealthFieldType.values))`. O `TextChoices` **em nível de módulo** (não aninhado no model — um enum aninhado fica fora de escopo para o `Meta.CheckConstraint`; idioma load-bearing repetido em `HabitType`/`TaskStatus`/`DayType`) [Source: backend/habits/models.py:20-29,57-80]. **Nunca ENUM nativo do Postgres.**
- **`active`**: `BooleanField(default=True)` — mecanismo de desativar-não-deletar (precedente exato: `RecurringTaskTemplate.active` em `bujo/models.py`; e `Habit`/`HabitVersion.active`).
- **`display_order`**: `PositiveIntegerField(default=0)`; `Meta.ordering = ["display_order", "name"]` (padrão idêntico ao `HabitGroup`) [Source: backend/habits/models.py:45-54].
- **`created_at`**: `DateTimeField(auto_now_add=True)` (o `TenantModel` **não** fornece timestamps).
- **`db_table = "health_field_definitions"`** explícito (snake_case plural — nomeado na arquitetura §6.1 linha 859).

### Opções de enum — decisão de armazenamento (não mandatada pela arquitetura)

**Achado honesto:** o schema da AD-01 lista só `(id, user_id, name, field_type, active, display_order)` — **não há coluna de opções de enum**, e a arquitetura em lugar nenhum especifica como armazená-las. A AC3 exige que existam. O `TextChoices+CheckConstraint` serve para conjuntos **fixos do sistema** (o próprio `field_type`), não para opções **definidas pelo usuário em runtime, por tenant**.

- **Default recomendado:** coluna `enum_options = models.JSONField(default=list, blank=True)` na própria linha da definição — uma **lista de strings** (os rótulos). Precedente arquitetural: a AD-07 guarda dose de medicamento como JSONB estruturado, *"mesmo padrão das métricas de saúde da AD-01"* [Source: architecture.md#AD-07 linhas 377-384]. Validação (enum ⇒ ≥1 opção; não-enum ⇒ vazio) na **camada de serviço/serializer**.
- **camelCase:** uma lista de **strings** JSON **não** é afetada pela varredura do `djangorestframework-camel-case` (ela converte *chaves de dict*, não elementos de array). Portanto `enum_options` como `list[str]` é seguro e **não** requer entrada em `ignore_fields`. **Não** modele as opções como lista de dicts `{value,label}` sem necessidade — se o fizer, os *keys* camelizariam (inócuo aqui, mas evite). O `ignore_fields` (`values`) é assunto exclusivamente da 7.2.

### `field_type` imutável; `name` mutável — identidade vs. integridade

Ecoa a separação identidade-vs-config da 6.1, adaptada:
- **`name`** é identidade **mutável/cosmética** (UPDATE direto) — renomear **não** corrompe o histórico, porque `health_logs.values` é chaveado por **UUID**, não por nome. Renomear é seguro.
- **`field_type`** é **imutável após a criação** — mudá-lo re-tiparia (erradamente) todos os valores históricos que a 7.2 grava por UUID (NFR-4: o sistema nunca retroage). Rejeitar mudança: no serializer de update, inspecionar `self.initial_data` (idioma do `habits/serializers.py`) **ou** `DomainError` no service. Escolher uma e testar [Source: backend/habits/serializers.py:95-100,198-204; backend/habits/services.py:127-149].
- **`active`, `display_order`, `enum_options`** são config **mutável** por UPDATE simples (sem versão — Saúde não versiona).

### Camada de serviço (§6.2) — regras não-negociáveis

[Source: architecture.md#§6.2 linhas 879-884; backend/habits/services.py:1-9]:
- Lógica em `health/services.py`, **funções de módulo, NUNCA classes de serviço**.
- Assinatura fixa: `def <verbo>_<substantivo>(*, user, ...)` — `user` sempre **primeiro kwarg, keyword-only**; o service recebe dados **já validados** + `user`, nunca o `request`.
- **`@transaction.atomic` decora toda função de escrita**; a view **nunca** abre transação.
- Scoping implícito: use `HealthFieldDefinition.objects.get/create/filter` (auto-escopado por `TenantManager`) — **não** passe `user_id` nas queries, **não** use `all_objects` (exceto admin). `Model.objects.get(id=...)` cross-tenant levanta `DoesNotExist` → a view converte em `NotFound` (404).
- **Só exceções de `core/exceptions.py`** — `DomainError` (base, é `Exception` puro, **não** `APIException`) → 409; serializer inválido → 400 `{detail, fields}`; `TenantScopeViolation` → 500 opaco [Source: backend/core/exceptions.py:29-114].

### Superfície de API (§6.1, §6.3, AR-8/AR-10)

Views finas `APIView` (o codebase **não** usa ViewSet/router — confirmado em todo `habits`/`bujo`/`braindump`) com `@extend_schema(request=..., responses=...)`; padrão: `body.is_valid(raise_exception=True)` → chama service `user=request.user, **body.validated_data` → serializa resposta; `Model.DoesNotExist` → `raise NotFound() from None` [Source: backend/habits/views.py:91-116].

| Método & rota | Ação |
|---|---|
| `GET /api/health-field-definitions/` | lista campos ativos (`?includeInactive=true` inclui desativados) |
| `POST /api/health-field-definitions/` | cria `{name, fieldType, enumOptions?, displayOrder?}` |
| `PATCH /api/health-field-definitions/{id}/` | edita `{name?, enumOptions?, displayOrder?, active?}` — **desativar/reativar = `PATCH {active:false/true}`** |

**Por que PATCH `{active}` (e não sub-recurso `versions/` como em hábitos):** Saúde **não** versiona (AD-01), então desativar é um UPDATE de flag simples — o precedente é `RecurringTaskTemplate.active`, não `habit_versions`. Manter enxuto.

**Contrato/casing (AR-9/AR-10):** JSON camelCase na borda via `djangorestframework-camel-case` (interno snake_case); serializer snake_case, wire vira camelCase automaticamente [Source: architecture.md#§6.3]. Serializers split leitura (`ModelSerializer` com `fields=[...]`) / escrita (`Serializer` plano com `validate`) [Source: backend/habits/serializers.py:1-27]. **`ENUM_NAME_OVERRIDES` obrigatório** para o novo enum de tipo, senão o `drf-spectacular` gera um `*Enum` com hash instável e pode colidir/poluir o contrato de `bujo`/`habits` — o `SPECTACULAR_SETTINGS.ENUM_NAME_OVERRIDES` já pina `HabitTypeEnum`/`TypeEnum`/`DayTypeEnum`; **adicionar `"HealthFieldTypeEnum": "health.models.HealthFieldType"`** seguindo o precedente [Source: backend/config/settings/base.py:182-193; epic-6-retro §2/§3 "disciplina de contrato aditivo"]. Meta: diff de `schema.yaml`/`types.gen.ts` **puramente aditivo**.

### Wire de settings/urls/conftest (arquivos existentes modificados)

- `INSTALLED_APPS` bloco `# Local`: adicionar `"health"` após `"habits"` [Source: backend/config/settings/base.py:32-52].
- `config/urls.py`: `path("api/health-field-definitions/", include("health.urls"))` [Source: backend/config/urls.py].
- `conftest.py`: `"health.tests.factories"` em `_ISOLATION_TEST_MODULES` [Source: backend/conftest.py:19].
- `import-linter`: `health` **já** consta em `forbidden_modules` do contrato "core must not import domain apps" — **nenhuma mudança**; `core` nunca importa `health` (se algum dia `core` precisar ler saúde, é import tardio na direção domínio, como `core.calendar` faz com `accounts`) [Source: backend/pyproject.toml:55-59].
- `apps.py`: `class HealthConfig(AppConfig): default_auto_field="django.db.models.BigAutoField"; name="health"`. `admin.py`: registrar com `all_objects` e exibir `user_id` (padrão operador) [Source: backend/habits/{apps,admin}.py].

### Frontend — feature `features/health/`

**Anatomia** (espelhar `features/habits/`): `api.ts` (hooks), `types.ts` (`import type { components } from '../../api/types.gen'` → `components['schemas']['HealthFieldDefinition']`, `['HealthFieldTypeEnum']`), `index.ts` (barrel — expõe só hooks/componentes/types; **feature nunca importa outra feature**), `components/*.tsx` [Source: frontend/src/features/habits/{api,types,index}.ts; architecture.md §7.1 linhas 1135-1141]. Os tipos gerados **só resolvem depois** do backend + `npm run generate-types` (hoje `types.gen.ts` não tem schemas de health).

**Query keys** — `frontend/src/api/keys.ts` tem slot reservado (~linhas 48-49, comentário `// health: { logs: {...} } → Story 7.x`). Adicionar:
```ts
health: {
  fieldDefinitions: (params?: { includeInactive?: boolean }) =>
    ['health', 'fieldDefinitions', 'list', params ?? {}] as const,
},
```
Mutações invalidam por prefixo `['health']`. Chaves sem `userId` (logout limpa o cache inteiro — padrão do projeto).

**Client:** `import client from '../../api/client'` → `client.get/post/patch`. O wire **já é camelCase** (não há transform no client) — enviar bodies camelCase (`displayOrder`, `enumOptions`, `fieldType`) [Source: frontend/src/api/client.ts].

**Mutations:** config-CRUD usa `useMutation` + `onSuccess: () => queryClient.invalidateQueries({ queryKey: ['health'] })` (estilo (A) de `HabitsManager`) — **sem** `useOptimisticMutation` (esse hook, em `frontend/src/shared/hooks/`, é só para toggles/marks de alta frequência; config não precisa) [Source: frontend/src/features/habits/api.ts:122-193].

**Tela (`HealthMetricsManager.tsx`)** — análogo direto: `features/habits/components/HabitsManager.tsx`. Reaproveitar:
- **Lista** de campos ordenada por `displayOrder` (sem grupos — Saúde não tem grupos), `Switch` "Mostrar inativos" alimentando `includeInactive`, linhas inativas com `opacity` **+ rótulo textual** "(inativo)" (cor nunca é indicador único — WCAG) [Source: HabitsManager.tsx:73-75,93,362-371].
- **Seletor de tipo**: preferir `<Select>` com `inputProps={{ 'aria-label': 'Tipo do campo' }}` (5 tipos → `ToggleButtonGroup` fica apertado no mobile). Mapa `Record<HealthFieldType, string>` para rótulos pt-BR (Inteiro/Decimal/Booleano/Enum/Texto) [padrão de `HabitsManager.tsx:35-38,403-433`].
- **Editor de opções (net-new — não há análogo)**: condicional `{fieldType === 'enum' && (...)}` (padrão de campos condicionais `HabitsManager.tsx:442-471`); lista repetível de `TextField` com botões adicionar/remover opção, acessível (labels/`aria`).
- **Toggle Desativar/Ativar**: `Button` chamando a mutation de `active`.
- **Formulários**: `useState` controlado + MUI `TextField`/`Select`/`Switch` — **sem lib de formulário**. Erro inline: `role="alert"` + constante `"Não foi possível salvar. Tente novamente."` [Source: HabitsManager.tsx:33,353-357].
- **Estados obrigatórios** (parte do aceite, não afterthought): loading (skeleton), empty-inicial ("uma frase + até uma ação"), erro de leitura (msg + retry), erro de escrita (input preservado + retry) [Source: ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#State Patterns linhas 124-140].

**Rota/nav** — `router.tsx`: adicionar `{ path: 'settings/health-metrics', element: <HealthMetricsSettingsPage/>, handle: { title: 'Configurações — Métricas de Saúde' } }` (irmã de `settings/habits` nas linhas ~122-131). `SettingsPage.tsx`: adicionar `<Link to="/settings/health-metrics">`. **Existe** um placeholder em `/health/metrics` (linhas ~96-99) e entradas "Saúde › Métricas" no `Sidebar`/`BottomNav` — **essas são a superfície do log diário (7.2); não tocar.** A tela de 7.1 é sub-página de Configurações [Source: frontend/src/app/router.tsx:96-99,122-131; frontend/src/pages/settings/{SettingsPage,HabitsSettingsPage}.tsx].

**Tema/tokens**: `createBujoTheme` central; touch targets ≥44px já default em `MuiButton`/`MuiIconButton`; `shadows` todos `none` (design flat — não reintroduzir elevação); **não hardcodar hex** — usar sx semântico (`color: 'text.secondary'`, `error.main`, etc.) [Source: frontend/src/theme.ts:104-155].

### Nota do design-system em migração (não bloqueante, mas evitar dívida)

O `specs/spec-design-system-migration/` é **contrato de planejamento — implementação NÃO autorizada**; **não há** biblioteca de primitivos nova no código ainda (só `shared/components/Modal.tsx`) [Source: specs/spec-design-system-migration/SPEC.md#Non-goals/Constraints]. Construa a tela com **`theme.ts` + padrões de `habits` existentes**, mas honre os princípios preservados para não criar dívida: semântica redundante (status nunca só por cor), 44px, WCAG 2.2 AA, sem scroll horizontal no mobile, densidade controlada / cabeçalho de seção. Saúde é um "novo módulo" da **Onda 5** da migração — **sinalize a tela como candidata a re-skin** e evite estilos estruturais one-off / hex hardcoded para que a migração futura seja barata [Source: specs/spec-design-system-migration/{SPEC.md,migration-plan.md,design-system-contract.md}].

### UX — fonte canônica e o gap de mockup

- **Canônico:** `ux-designs/ux-hmmb-bujo-2026-07-17/` (DESIGN.md + EXPERIENCE.md), regido pela SPEC de design-system. A pasta `ux-hmmb-bujo-2026-06-15/` é **LEGADO CONGELADO** (`status: legacy`) — não é autoridade; em conflito, 17/07 + SPEC vencem [Source: ux-designs/ux-hmmb-bujo-2026-06-15/LEGACY.md; ux-hmmb-bujo-2026-07-17/.decision-log.md].
- **UX-DR10 (Health Metric Row)** — autoritativo via `epics.md` (as docs UX 17/07 não o detalham): *"input por tipo (inteiro/decimal/booleano/enum/texto); ... campos inativos não aparecem; sem exclusão, só desativação."* Isto fixa os **5 `field_type`** e a política **desativar-não-deletar** que 7.1 modela; **a Row em si é 7.2** [Source: epics.md#UX-DR10 (seção UX Design Requirements); epics.md#Story 7.2 linha 1257].
- **Padrão da tela** = página tipo **"Coleção/Settings"** (grupos/filtros → lista → criar/editar; anatomia "Item Row" compartilhada com recorrentes/settings) [Source: ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Padrões de página linhas 63-71,94]. O fluxo de referência é a **Configuração de Hábitos** já entregue (`HabitsManager`) — mesma anatomia (lista → "+ Novo" form inline → campos extras aparecem após escolher o tipo → salvar → aparece na lista; toggle ativo/inativo).
- **Gap explícito:** o mockup visual detalhado da tela (M22 "Configurações — métricas | campos dinâmicos, tipo enum, desativação") está no plano de cobertura mas **não foi produzido**. 7.1 se apoia nos **contratos de componente do design-system + o precedente de `HabitsManager`** [Source: ux-hmmb-bujo-2026-07-17/.working/mockup-coverage-plan.md; review-accessibility-product.md].
- **Voz (UX-DR13)/a11y (WCAG 2.2 AA):** pt-BR neutro, **zero gamificação** ("Campo desativado.", empty "Nenhum campo de saúde ainda."); `<main aria-label>` por superfície; `Esc` fecha camada de topo; erros de formulário anunciados; reorder (se houver) sempre com alternativa não-drag ("Mover acima/abaixo").

### Testes

**Backend** [Source: backend/conftest.py; backend/habits/tests/]:
- Estrutura fixa: `health/tests/{test_models,test_serializers,test_services,test_views}.py` + `factories.py`.
- `conftest.py` da raiz já dá DB autouse + fixtures `user`/`other_user`/`api_client`/`auth_client` (o `auth_client` roda o corpo dentro de `tenant_context(user)`; `response.data` é **snake_case** — camelização só no renderer JSON). Services em teste rodam dentro de `with tenant_context(user):`.
- Factories: `class Params: user = factory.SubFactory(UserFactory)` + `user_id = factory.SelfAttribute("user.id")` (o `user_id` é UUID cru, não FK); ao final, `register_isolation_case(id="health.HealthFieldDefinition", model=HealthFieldDefinition, make=lambda: {...})`. **Adicionar `"health.tests.factories"` a `_ISOLATION_TEST_MODULES` (conftest.py:19)** — é o wiring do gate de isolamento parametrizado (o guardrail de manager em `core/tests/test_guardrails.py` já percorre todo `TenantModel`).
- **Sem `date.today()` em factories/tests** (guardrail AST — usar datas fixas + `timedelta`).
- Casos-âncora (das ACs): (a) criar grava campos + `active=true` + UUID + `display_order` append; (b) `field_type` inválido barrado (IntegrityError no DB dentro de `transaction.atomic`, e 400 no serializer); (c) `field_type` **imutável** rejeitado no update; (d) enum exige ≥1 opção / não-enum rejeita opções; (e) desativar → `active=false`, registro persiste; reativar → `active=true`; (f) `list_health_fields` esconde inativos por default; (g) cross-tenant 404 + fail-closed `TenantScopeViolation` sem contexto.

**Frontend** [Source: frontend/src/features/habits/*.test.tsx; frontend/src/test-setup.ts]:
- vitest + RTL, `fileParallelism:false` (default). `vi.mock('../../../api/client', () => ({ default: { get, post, patch, delete: vi.fn() } }))` + mock de `useAuth` se necessário. Wrapper `QueryClientProvider` (`retry:false`). `jest-axe`: `expect(await axe(container)).toHaveNoViolations()`. **Sem MSW.**
- **Caveat jsdom para `<input type="number">`:** `userEvent.type/clear` não funcionam — usar `fireEvent.change(field, { target: { value } })`.

### Armadilha dos 3 testes compartilhados (memória do projeto — CONFIRMADA)

`AppLayout.test.tsx`, `router.test.tsx` e `RouteAnnouncer.test.tsx` renderizam a casca **sem** `QueryClientProvider`, sobrevivendo só porque `vi.mock`am todo filho de nav que usa TanStack Query. **A tela de config é página no `<Outlet/>` → NÃO afeta esses três testes.** Só quebraria se você adicionasse ao `Sidebar`/`BottomNav` um filho que usa Query (ex.: um badge). **Recomendação: não adicionar nada Query-driven à nav nesta story** [Source: memória `sidebar-bottomnav-shared-tests-need-query-mock`; frontend/src/app/layout/*.test.tsx].

### Ambiente / CI / operação

- **Node ≥ 22.15.1 via nvm**: a sessão inicia em v18; rodar `nvm use 22.15.1` antes de todo comando de frontend/e2e [Source: memória `frontend-needs-node-22-via-nvm`].
- **Paralelismo Neon**: `fileParallelism:false` (vitest) e `workers:1` (playwright) já são default — **não** passar as flags [Source: epic-5/epic-6 retro].
- **Migration em branches Neon dedicadas**: aplicar `health.0001_initial` às branches `dev` e `e2e` antes de suítes que batem no banco (lacuna recorrente ao introduzir app novo).
- **Full-suite do Neon trava** (recorrente): fallback = run **escopado** `pytest health accounts core --reuse-db` para contagem honesta (a contagem full é registro, não gate). **Vitest não roda no CI** — é rede local/review [Source: epic-6-retro §3/§7].
- **Gates de CI** (ordem): backend `ruff` → `lint-imports` → `pytest` → `spectacular` + diff `types.gen.ts`; frontend `tsc` → ESLint → `vite build`.
- **Commit ao fim da story**: 1 commit/story; rodar `/bmad-uncommitted-report`, salvar o report, então commitar **sem** pedir "[S]im" [Source: memória `commit-at-end-of-each-story`]. **Não** varrer para o commit as mudanças de planejamento/UX do Hugo no working tree (`architecture.md`, `epics.md`, `ux-designs/*`, `specs/*`) — são trabalho paralelo dele [Source: epic-6-retro §9].

### Inteligência da story anterior (6.1 + retrospectiva do Épico 6)

Não há story anterior **neste épico** (7.1 é a primeira). A **6.1** (Configuração de hábitos) é o análogo estrutural direto — app+feature+tela de settings do zero, config-CRUD, desativar-não-deletar, `display_order`. Padrões diretamente reaproveitáveis [Source: 6-1-configuracao-de-habitos-e-grupos.md; epic-6-retro-2026-07-19.md §6]:
- **Fatia vertical limpa na 1ª story de-risca o épico** (confirmado no Épico 6): investir bem em 7.1 (model + serviço + contrato + tela) paga dividendos em 7.2/7.3.
- **`ENUM_NAME_OVERRIDES`** foi a chave para contrato aditivo em todo o Épico 6 — aplicar já a `HealthFieldTypeEnum` (o `field_type` colidiria/hasharia senão).
- **Resolver decisão de design não-explícita por leitura literal + código existente + doc, e documentar inline** (guardrail institucionalizado): aplicar às "Decisões a confirmar" abaixo (armazenamento de enum, prefixo de URL, imutabilidade de `field_type`).
- **File List completo**: nomear também os arquivos **modificados** (`config/urls.py`, `settings/base.py`, `conftest.py`, `keys.ts`, `router.tsx`, `SettingsPage.tsx`, `schema.yaml`, `types.gen.ts`); colar a contagem de testes **depois** do último teste.
- **Charting `recharts`** já instalado (6.4) é ativo compartilhado — **relevante só para 7.3**, não para 7.1.

### Decisões a confirmar (defaults para #YOLO — endossar todos e seguir)

1. **Armazenamento de opções de enum** → coluna `enum_options` JSONField (lista de strings) na linha da definição, validada no serviço (enum ⇒ ≥1; não-enum ⇒ vazio). *Default: sim.* (Precedente AD-07.)
2. **Prefixo de URL** → `/api/health-field-definitions/` (a AD-01/§6.1 usa esse exemplo; evita a colisão com o liveness `/api/health/`). *Default: sim.*
3. **`field_type` imutável após criação** → sim (integridade histórica NFR-4). `name`/`active`/`display_order`/`enum_options` mutáveis. *Default: sim.*
4. **UI de reordenação** → apenas coluna `display_order` (append na criação); **sem** UI de reorder na primeira fatia (espelha 6.1). *Default: só coluna; reorder deferível.*
5. **`models.py` único vs pacote `models/`** → arquivo único `health/models.py` (só `HealthFieldDefinition`; espelha o precedente real de `habits`). A dica da arquitetura de um pacote `models/` (definições + logs) aplica-se quando 7.2 trouxer `health_logs`. *Default: arquivo único.*
6. **Reativação** → incluir (natural, espelha 6.1), embora a AC cite explicitamente só desativação. *Default: incluir.*
7. **Desativar via `PATCH {active}`** (não sub-recurso `versions/`, que é específico do versionamento de hábitos). *Default: PATCH.*

### Project Structure Notes

- **Backend (novo app):** `backend/health/` — `apps.py`, `models.py`, `services.py`, `serializers.py`, `views.py`, `urls.py`, `admin.py`, `migrations/0001_initial.py`, `tests/{factories,test_models,test_serializers,test_services,test_views}.py`. Espelho: `backend/habits/`.
- **Frontend (nova feature + página):** `frontend/src/features/health/` (mirror de `features/habits/`) + `frontend/src/pages/settings/HealthMetricsSettingsPage.tsx`.
- **Arquivos existentes modificados:** `backend/config/settings/base.py` (INSTALLED_APPS `health` + `ENUM_NAME_OVERRIDES`), `backend/config/urls.py` (rota), `backend/conftest.py` (`_ISOLATION_TEST_MODULES`), `frontend/src/api/keys.ts` (seção health), `frontend/src/app/router.tsx` (rota settings/health-metrics), `frontend/src/pages/settings/SettingsPage.tsx` (link), `schema.yaml` + `frontend/src/api/types.gen.ts` (regenerados).
- Alinhamento total com a estrutura unificada (feature-folder isolada, camada de serviço obrigatória, `TenantModel`, query-key factory, `APIView` fina). Nenhuma variância de estrutura detectada além das decisões documentadas acima.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-7.1 linhas 1219-1235] — user story + ACs originais
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-7 linhas 1215-1281] — objetivo do épico + escopo 7.1/7.2/7.3
- [Source: _bmad-output/planning-artifacts/epics.md#FR-3.1 linha 66; #AR-7 linha 118; #AR-9 linha 120; #AR-3 linha 111; #AR-8 linha 119; #AR-10 linha 121; #UX-DR10 (UX Design Requirements)]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-01 linhas 91-120] — schema dinâmico, `health_field_definitions`/`health_logs`, validação no serviço
- [Source: _bmad-output/planning-artifacts/architecture.md#§6.1 linhas 858-869] — naming, `/api/health-field-definitions/`, TextChoices+CheckConstraint, 1 migration/story
- [Source: _bmad-output/planning-artifacts/architecture.md#§6.2/§6.3/§6.4/§6.7] — serviço, camelCase/JSONB, erros, isolamento
- [Source: _bmad-output/planning-artifacts/architecture.md#§7.1 linhas 1103-1104,1150] — app `health/`, sem FK com medicamentos
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-07 linhas 377-384] — precedente JSONB estruturado ("mesmo padrão da saúde")
- [Source: backend/core/models.py:21-43] — `TenantModel`
- [Source: backend/core/views.py; backend/config/urls.py:11; backend/core/tests/test_api_contract.py:17,27,86-94] — **liveness `/api/health/` reservado**; health pré-cabeado no contrato
- [Source: backend/core/exceptions.py:29-114] — taxonomia + handler (DomainError→409, 400 fields, 500 opaco)
- [Source: backend/habits/{models,services,serializers,views,urls,apps,admin}.py] — app de domínio a espelhar (display_order, TextChoices módulo-level, APIView fina, split serializers)
- [Source: backend/config/settings/base.py:32-52,182-193] — INSTALLED_APPS, `ENUM_NAME_OVERRIDES`
- [Source: backend/conftest.py:19] — `_ISOLATION_TEST_MODULES`
- [Source: backend/pyproject.toml:55-59] — import-linter (`health` já listado)
- [Source: frontend/src/features/habits/{api,types,index}.ts; components/HabitsManager.tsx] — feature + tela de config a espelhar
- [Source: frontend/src/api/keys.ts (~48-49); client.ts; queryClient.ts] — query-key factory (slot health reservado), client camelCase
- [Source: frontend/src/pages/settings/{SettingsPage,HabitsSettingsPage}.tsx; frontend/src/app/router.tsx:96-99,122-131] — hub de settings, rota-irmã, placeholder `/health/metrics` (não tocar)
- [Source: frontend/src/theme.ts:104-155] — `createBujoTheme`, 44px, flat/no-shadow, sx semântico
- [Source: _bmad-output/specs/spec-design-system-migration/{SPEC.md,migration-plan.md,design-system-contract.md}] — migração não autorizada; Saúde = Onda 5 (candidata a re-skin)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/{EXPERIENCE.md,DESIGN.md,.decision-log.md,.working/mockup-coverage-plan.md}] — UX canônico (IA/design-system), padrões de página/estado, gap M22
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/LEGACY.md] — pasta 15/06 é legado congelado (referência-only)
- [Source: _bmad-output/implementation-artifacts/6-1-configuracao-de-habitos-e-grupos.md] — análogo estrutural direto
- [Source: _bmad-output/implementation-artifacts/epic-6-retro-2026-07-19.md §3/§6/§7/§9] — aprendizados aplicáveis (contrato aditivo, run escopado Neon, não varrer planejamento no commit)
- [Source: memórias do projeto] — `commit-at-end-of-each-story`, `story-language-conventions`, `frontend-needs-node-22-via-nvm`, `sidebar-bottomnav-shared-tests-need-query-mock`, `ask-dont-assume-functionality-flows`

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context)

### Debug Log References

- `test_post_enum_without_options_returns_400` inicialmente falhou por assertar a chave de erro em camelCase (`enumOptions`). Corrigido: `response.data` é snake_case (a camelização acontece só no renderer JSON de saída, não em `response.data`) — precedente idêntico aos testes de `habits`. Assert ajustado para `enum_options`.
- ESLint: um `// eslint-disable-next-line react/no-array-index-key` referenciava uma regra não configurada no projeto (erro "Definition for rule not found"). Removido — a regra não está ativa, então usar o índice como key na lista editável de opções é permitido.

### Completion Notes List

**Story 7.1 — Campos de saúde dinâmicos.** Fundação do Épico 7 (Métricas de Saúde): novo app Django `health/` + feature `features/health/` + tela **Configurações › Métricas de Saúde** (`/settings/health-metrics`), do zero, espelhando o precedente estrutural de `habits` (6.1).

**Decisões de design resolvidas por leitura literal + código existente + doc (guardrail institucionalizado), documentadas inline:**
1. **Armazenamento de opções de enum** → coluna `enum_options` `JSONField(default=list)` (lista de strings) na própria linha da definição (precedente AD-07). Lista de strings JSON **não** é afetada pela camelização (converte chaves de dict, não elementos de array), então **não** entra em `ignore_fields`. No contrato, declarada como `ListField(child=CharField())` → tipa `string[]` (um `JSONField` cru viraria objeto opaco).
2. **Prefixo de URL** → `/api/health-field-definitions/` (evita a colisão com o liveness `/api/health/`, que segue excluído do schema — `test_health_excluido_do_schema` continua verde).
3. **`field_type` imutável** → rejeitado em AMBAS as camadas: `DomainError` (→409) no service **e** `ValidationError` (→400) no serializer via `self.initial_data` (barra `field_type` snake e `fieldType` camel).
4. **Regra enum⇔opções** → enum exige ≥1 opção; não-enum rejeita opções. No create: serializer (→400) + service (`DomainError`→409, defesa em profundidade). No update: service valida contra o `field_type` atual (imutável), pois o serializer de update não conhece o tipo persistido.
5. **Desativar/reativar** → `PATCH {active}` simples (Saúde não versiona — precedente `RecurringTaskTemplate.active`, não `habit_versions`). `set_health_field_active` dedicado foi **omitido**: `active` está em `_MUTABLE_FIELDS` do `update_health_field` (a task já previa "ou cobrir via update"), evitando dead code / wrapper redundante.
6. **`display_order`** → coluna no schema, append na criação (`max(display_order)+1`; a primeira definição = 0). **UI de reorder deferida** (espelha 6.1) — nenhum `<input type="number">` na tela desta fatia.

**Contrato aditivo:** `ENUM_NAME_OVERRIDES["HealthFieldTypeEnum"] = "health.models.HealthFieldType"` pina o enum de tipo. `schema.yaml` regenerado: **+156 linhas, 0 remoções** (puramente aditivo). `types.gen.ts` regenerado. Endpoints novos: `HealthFieldDefinition`/`HealthFieldCreate`/`PatchedHealthFieldUpdate`/`HealthFieldTypeEnum`.

**Escopo respeitado:** nenhuma linha de `health_logs`/valores/JSONB `values`/`ignore_fields` tocada (7.2); nenhum gráfico/histórico (7.3); nenhum versionamento; placeholder `/health/metrics` e Sidebar/BottomNav intocados; nada Query-driven na nav (os 3 testes compartilhados seguem verdes).

**Contagens de teste (observadas literalmente, não de memória):**
- Frontend `vitest run` (suíte completa, Node 22.15.1): **677 passed / 61 files** (inclui 15 novos de health: 7 em `api.test.tsx` + 8 em `HealthMetricsManager.test.tsx`). `tsc` e ESLint limpos; `vite build` ok.
- Backend — a suíte completa sem args (`pytest`) foi **morta com >15 min** no Neon (o "trava recorrente do full-suite" documentado nas Dev Notes/retro do Épico 6). Para uma contagem **honesta e completa** — sem omitir nenhum app (guardrail Retro Épico 11: nunca reportar uma contagem escopada como se fosse a total) — rodei **todos os 6 apps locais em lotes** com `--reuse-db`:
  - `pytest health accounts core` → **145 passed** (inclui o app novo `health` + o contrato de isolamento parametrizado que agora cobre `health.HealthFieldDefinition` + guardrails de manager + `test_api_contract` com `/api/health/` fora do schema).
  - `pytest habits` → **124 passed**.
  - `pytest bujo braindump` → **346 passed**.
  - **Total backend = 145 + 124 + 346 = 615 passed, 0 failed** (união dos lotes = todos os apps de `INSTALLED_APPS` locais: core, accounts, bujo, braindump, habits, health). Sem regressões.
- `pytest health` isolado (com `--create-db`, aplicando a nova migration): **46 passed** (já incluídos nos 145 acima).

**Gap de especificação (AD-01) — resolvido no doc-fonte:** o schema da AD-01 listava `(id, user_id, name, field_type, active, display_order)` sem coluna de opções de enum; a AC3 exige que existam. Resolvido no código com `enum_options` JSONB (precedente AD-07), documentado inline no model, **e** no doc-fonte: adicionada a coluna `enum_options JSONB` ao schema simplificado da AD-01 em `architecture.md` (linha ~108), com comentário referenciando a Story 7.1/AC3 (guardrail: gap de spec encontrado → atualizar doc-fonte no fechamento). `architecture.md` já estava sob edição paralela do Hugo, então a correção de 1 linha viaja com o working-tree dele e **não** entra no commit desta story (guardrail epic-6 §9: não varrer planejamento/arquitetura para o commit da story).

### File List

**Backend — app novo `health/`:**
- `backend/health/__init__.py`
- `backend/health/apps.py`
- `backend/health/models.py`
- `backend/health/services.py`
- `backend/health/serializers.py`
- `backend/health/views.py`
- `backend/health/urls.py`
- `backend/health/admin.py`
- `backend/health/migrations/__init__.py`
- `backend/health/migrations/0001_initial.py`
- `backend/health/tests/__init__.py`
- `backend/health/tests/factories.py`
- `backend/health/tests/test_models.py`
- `backend/health/tests/test_serializers.py`
- `backend/health/tests/test_services.py`
- `backend/health/tests/test_views.py`

**Backend — modificados:**
- `backend/config/settings/base.py` (INSTALLED_APPS `"health"` + `ENUM_NAME_OVERRIDES["HealthFieldTypeEnum"]`)
- `backend/config/urls.py` (rota `api/health-field-definitions/`)
- `backend/conftest.py` (`"health.tests.factories"` em `_ISOLATION_TEST_MODULES`)

**Frontend — feature nova + página:**
- `frontend/src/features/health/api.ts`
- `frontend/src/features/health/types.ts`
- `frontend/src/features/health/index.ts`
- `frontend/src/features/health/api.test.tsx`
- `frontend/src/features/health/components/HealthMetricsManager.tsx`
- `frontend/src/features/health/components/HealthMetricsManager.test.tsx`
- `frontend/src/pages/settings/HealthMetricsSettingsPage.tsx`

**E2E (etapa de QA automation da story):**
- `frontend/e2e/health-metrics.spec.ts` (4 specs — AC1/AC2/AC3/AC4 ponta-a-ponta contra a branch Neon `e2e`)
- `_bmad-output/implementation-artifacts/tests/test-summary.md` (append da seção 7.1)

**Frontend — modificados:**
- `frontend/src/api/keys.ts` (seção `health`)
- `frontend/src/api/types.gen.ts` (regenerado do schema)
- `frontend/src/app/router.tsx` (rota `settings/health-metrics`)
- `frontend/src/pages/settings/SettingsPage.tsx` (link "Métricas de Saúde")

**Contrato (regenerado):**
- `schema.yaml` (repo root)

**Story/tracking (seções permitidas):**
- `_bmad-output/implementation-artifacts/7-1-campos-de-saude-dinamicos.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Senior Developer Review (AI)

**Revisor:** HugoMMBrito · **Data:** 2026-07-19 · **Resultado:** Aprovado (com correções aplicadas automaticamente).

Revisão adversarial da implementação contra as alegações da story. **Todas as 4 ACs verificadas como IMPLEMENTADAS**; todas as 8 tasks marcadas `[x]` confirmadas como realmente feitas (cruzando arquivos + git + suítes reexecutadas). Nenhuma questão CRÍTICA ou ALTA.

**Validação de alegações (reexecutado nesta revisão, não de memória):**
- Backend: `ruff` health/config/conftest → All checks passed; `lint-imports` → contrato "core must not import domain apps" KEPT; `pytest health` → **46 passed** (batia com a alegação; **49** após as correções desta revisão).
- Contrato: `spectacular` diff **puramente aditivo** e `schema.yaml` **em sincronia** com o código (regenerei e diferenciei — 0 drift); `test_api_contract` (11 passed, inclui `/api/health/` liveness fora do schema — colisão de URL evitada).
- Frontend: `tsc` limpo; `vitest` health → **15 passed**; ESLint limpo; os 3 testes compartilhados de nav (`AppLayout`/`router`/`RouteAnnouncer` → 22 passed) seguem verdes (nada Query-driven na nav).

**Correções aplicadas automaticamente (invocação #YOLO / auto-fix):**
1. **[MÉDIA · documentação] File List incompleto.** O spec E2E `frontend/e2e/health-metrics.spec.ts` e o append de `test-summary.md` (etapa de QA automation) faziam parte dos entregáveis da story mas não constavam no File List. → Adicionados ao File List.
2. **[BAIXA · robustez] `display_order` sem limite superior no input.** `HealthFieldCreate`/`PatchedHealthFieldUpdate` aceitavam `display_order` acima do máximo do `PositiveIntegerField` (2 147 483 647), o que estouraria como erro de Postgres (500) em vez de um 400 limpo — gap específico de Saúde (Hábitos não aceita `display_order` gravável pelo cliente). → `max_value=_MAX_DISPLAY_ORDER` nos dois serializers de escrita; `schema.yaml` regenerado (aditivo: +2 linhas `maximum`; `types.gen.ts` inalterado — min/max não vira tipo TS) e reverificado em sincronia.
3. **[BAIXA · cobertura de teste] `display_order` mutável sem teste.** `display_order` está em `_MUTABLE_FIELDS` de `update_health_field`, mas nenhum teste exercitava a atualização (só `name`/`active`/`enum_options` tinham). → `test_update_changes_display_order` (serviço) + `test_create_rejects_display_order_over_int_max` / `test_update_rejects_display_order_over_int_max` (serializer, cobrem a correção #2).

**Notas de qualidade (sem ação necessária):** o padrão de estado local do `HealthFieldRow` (`useState` derivado de props, keyed por `id`, sem `useEffect` de sincronização) espelha exatamente o precedente de `HabitRow` — consistente com o codebase e sem manifestação no fluxo config-CRUD mono-usuário. A dupla rejeição de `field_type` (serializer `self.initial_data` snake+camel **e** `DomainError` no service) e a assimetria de status para a regra enum⇔opções (400 no create / 409 no update) são decisões documentadas e defensáveis, não defeitos.

**Pós-correções:** `pytest health` → **49 passed**; `ruff` limpo; `schema.yaml` em sincronia. **0 questões CRÍTICAS remanescentes → Status: done.**

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-07-19 | 0.1 | Implementação da Story 7.1 — app `health/` + `HealthFieldDefinition` (catálogo de campos dinâmicos, AD-01), camada de serviço, API DRF `/api/health-field-definitions/` (contrato aditivo), feature `features/health/` + tela Configurações › Métricas de Saúde, testes backend (46) e frontend (15 novos). | Amelia (dev agent) |
| 2026-07-19 | 0.2 | Revisão sênior (AI, auto-fix): File List completado (E2E spec + test-summary); `max_value` em `display_order` (create/update) → 400 em vez de 500 no overflow, `schema.yaml` regenerado (aditivo); +3 testes (display_order update + 2 de overflow). Backend health 46→49 passed, 0 críticas → Status done. | HugoMMBrito (review) |
