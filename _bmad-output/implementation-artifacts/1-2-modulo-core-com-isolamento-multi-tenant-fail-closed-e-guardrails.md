---
baseline_commit: 1ce4b82f073eb8dd57ec8c2dd8d5d5ef7762e0e4
---

# Story 1.2: Módulo `core/` com isolamento multi-tenant fail-closed e guardrails

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como **desenvolvedor do projeto**,
Quero **o `TenantModel` abstrato, o `TenantManager` auto-escopado por `contextvar` (fail-closed), a taxonomia de exceções com handler DRF e os guardrails de CI que impõem o isolamento**,
Para que **o isolamento total de dados entre usuários seja o comportamento padrão e provado verde antes de qualquer modelo de domínio existir** (FR-0.1, NFR-3, AR-2, AR-3, AR-4).

## Acceptance Criteria

**AC1 — `TenantModel` abstrato (PK UUID + manager escopado + auto-fill de `user_id`)**
**Dado que** um model herda `TenantModel`,
**Quando** ele é definido,
**Então** tem PK `UUID` (default `uuid4`), coluna `user_id` indexada, `objects = TenantManager()` (auto-escopado) e `all_objects` (manager não-escopado, só para admin),
**E** na criação o `user_id` é preenchido automaticamente a partir do `current_user_id` do contextvar.

**AC2 — `TenantManager` fail-closed + teste de isolamento**
**Dado que** uma query via `Model.objects` **sem** contexto de tenant setado,
**Quando** a query é executada,
**Então** o `TenantManager` levanta `TenantScopeViolation` (fail-closed) — nunca retorna dados de todos os usuários,
**E** o teste `core/tests/test_isolation.py` cobre esse caso fail-closed e o caso de isolamento entre dois usuários, e passa.

**AC3 — Taxonomia de exceções + handler DRF + middleware de contexto**
**Dado que** a taxonomia de exceções de domínio,
**Quando** `core/exceptions.py` é implementado,
**Então** existe a hierarquia `DomainError` (com `InvalidTransition`, `ImmutableSnapshot`, `TenantScopeViolation`, etc.) e um exception handler DRF que uniformiza o corpo `{ "detail", "fields" }` e mapeia exceção→status (400/401/404/409; contexto de tenant ausente → 500 + alerta),
**E** o `middleware.py` seta o `contextvar` logo após a autenticação e o reseta no `finally`.

**AC4 — Guardrails de CI (regra de porta + manager escopado)**
**Dado que** o pipeline de CI,
**Quando** ele roda,
**Então** o `import-linter` falha o build se `core/` importar qualquer app de domínio (regra de porta),
**E** o guardrail de tenant falha o build se um model tenant expuser manager não-escopado como `objects` default.

## Tasks / Subtasks

- [x] **Task 1 — `core/tenant.py`: contextvar + context manager + `TenantManager` fail-closed** (AC: 2)
  - [x] Criar `core/tenant.py` com `current_user_id = contextvars.ContextVar("current_user_id", default=None)` (ver §6.10 — forma normativa, copiar exatamente o nome do contextvar)
  - [x] Implementar `@contextmanager def tenant_context(user)`: `token = current_user_id.set(user.id)` → `try: yield` → `finally: current_user_id.reset(token)`
  - [x] Implementar `class TenantManager(models.Manager)` com `get_queryset()`: lê `uid = current_user_id.get()`; **se `uid is None` → `raise TenantScopeViolation()`** (fail-closed, ANTES de tocar o DB); senão `return super().get_queryset().filter(user_id=uid)`
  - [x] **NÃO** importar `core.models` em `core.tenant` para evitar import circular (`models.py` é quem importa `tenant.py`). Importar `TenantScopeViolation` de `core.exceptions` (sem ciclo — `exceptions.py` não importa `tenant.py`)
  - [x] Deixar um `# TODO (async/ASGI)` ao lado do `current_user_id` em `core/tenant.py` marcando que, quando uma view virar async, o contextvar precisa ser propagado via `sync_to_async`/`async_to_sync` (herança NÃO é automática) — ver §6.7. Só o comentário-âncora agora; implementação é fora de escopo (WSGI é o alvo atual)
- [x] **Task 2 — `core/exceptions.py`: taxonomia `DomainError` + handler DRF** (AC: 3)
  - [x] Criar hierarquia: `class DomainError(Exception)` base; subclasses `InvalidTransition(DomainError)`, `ImmutableSnapshot(DomainError)`, `TenantScopeViolation(DomainError)`. `InvalidTransition.__init__(self, from_status, to_status)` guarda os estados e monta a mensagem (ver Dev Notes §Exceções)
  - [x] Implementar `custom_exception_handler(exc, context)`: chama o `exception_handler` default do DRF primeiro; depois trata os `DomainError` que o DRF não conhece (são `Exception` puras, não `APIException` → DRF retorna `None` para elas)
  - [x] Mapear: `InvalidTransition`/`ImmutableSnapshot`/demais `DomainError` de regra → **409**; `TenantScopeViolation` (contexto vazio) → **500 + log `critical`/alerta** (NÃO domesticar — é bug de infra, esconder detalhe do corpo); `ValidationError` de serializer → **400 + `fields`**; sem auth → **401**; recurso de outro usuário → **404**
  - [x] **Corpo opaco no 500 do `TenantScopeViolation`:** responder **exatamente** `{"detail": "Internal server error"}` — **nunca** colocar `str(exc)`, a mensagem da exceção ou qualquer dado de contexto no corpo (evita vazar que o problema é de tenant). O detalhe real vai só para o `logger.critical(...)`, não para o cliente
  - [x] Uniformizar o corpo de TODA resposta de erro para `{ "detail": "...", "fields": { "campo": ["msg", ...] } }` — `fields` SEMPRE `{campo: [array de mensagens]}` (formato nativo DRF). `fields` ausente/omitido quando não houver erros de campo
  - [x] **NÃO** levantar `TenantScopeViolation` como `APIException` — ela é um `DomainError` puro; o mapeamento para 500 é responsabilidade exclusiva do handler
- [x] **Task 3 — `core/models.py`: `TenantModel` abstrato** (AC: 1)
  - [x] Criar `TenantModel(models.Model)` com `class Meta: abstract = True`
  - [x] `id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)`
  - [x] `user_id = models.UUIDField(db_index=True)` — **`UUIDField` puro, NÃO `ForeignKey`** (isolamento na camada de aplicação por `user_id`; o model `User` só nasce na Story 2.1 e o design AD-12 não exige FK). Index obrigatório (`db_index=True`)
  - [x] `objects = TenantManager()` e `all_objects = models.Manager()` — **ordem importa**: declarar `objects` PRIMEIRO para que continue sendo o `_default_manager`/`_base_manager`. Confirmar com o guardrail da Task 7
  - [x] Override `save(*args, **kwargs)`: se `self.user_id` for `None`, ler `uid = current_user_id.get()`; **se `uid is None` → `raise TenantScopeViolation()`** (fail-closed também na escrita); senão `self.user_id = uid`. Se `user_id` já veio setado (caminho `all_objects`/admin), preservar
- [x] **Task 4 — `core/middleware.py`: `TenantMiddleware`** (AC: 3)
  - [x] Implementar middleware que, se `request.user.is_authenticated`, faz `token = current_user_id.set(request.user.id)`; senão `token = None`
  - [x] `try: response = get_response(request)` → `finally:` se `token is not None`, `current_user_id.reset(token)` — **proibido vazar contexto entre requests num worker reusado**
  - [x] Registrar em `config/settings/base.py` no `MIDDLEWARE`, **depois** de `AuthenticationMiddleware` (depende de `request.user`) — ver Dev Notes §Settings para a posição exata
  - [x] **Nota de escopo:** sem JWT/`User` ainda (Story 2.1), `request.user` é `AnonymousUser` → o middleware fica **dormente** (não seta contexto). Isso é correto e esperado; ele "acorda" quando a 2.1 ligar a auth. O `/api/health/` segue sem auth e sem contexto
- [x] **Task 5 — Registrar `core` como app Django + wiring de settings** (AC: 1, 3)
  - [x] Criar `core/apps.py` (`class CoreConfig(AppConfig)`, `default_auto_field`, `name = "core"`) e `core/migrations/__init__.py` (pacote vazio — `TenantModel` é abstrato, sem tabela; nenhuma migration gerada)
  - [x] Adicionar `"core"` ao `INSTALLED_APPS` em `base.py` (1.1 deixou explícito que `core` entra quando ganha models — é agora). **NÃO** registrar `accounts` ainda (segue stub até a 2.1)
  - [x] Adicionar bloco `REST_FRAMEWORK = { "EXCEPTION_HANDLER": "core.exceptions.custom_exception_handler" }` em `base.py` (ainda não existe `REST_FRAMEWORK` no settings). **NÃO** configurar paginação/filtros aqui — `core/pagination.py` e os defaults de paginação são da **Story 1.4** (ver §Limites de Escopo)
  - [x] Rodar `uv run python manage.py makemigrations --check --dry-run` e garantir "No changes detected" (model abstrato + test model `managed=False` não devem gerar migration)
- [x] **Task 6 — Testes de isolamento + fixtures + model de teste** (AC: 2)
  - [x] Criar um **model concreto só para teste** herdando `TenantModel` (ver Dev Notes §Model de teste para a estratégia exata: `managed = False` + tabela criada via `schema_editor` numa fixture). Sem isso não há como exercer o `TenantManager` genérico (não há models de domínio até o Épico 3)
  - [x] Em `conftest.py` (raiz `backend/`), adicionar fixtures: `user` e `other_user` (objetos leves com `.id = uuid.uuid4()` — **NÃO** há `User` real até 2.1; ver Dev Notes §Fixtures), `api_client` (`APIClient()`), `auth_client` (envolve `api_client` em `with tenant_context(user):` — ver §6.10)
  - [x] `core/tests/test_isolation.py`:
    - [x] **Fail-closed (leitura):** `with pytest.raises(TenantScopeViolation): TestModel.objects.all()` (sem contexto) — e validar que NÃO retorna queryset vazio
    - [x] **Isolamento entre dois usuários:** criar registros sob `tenant_context(user)` e `tenant_context(other_user)`; afirmar que cada contexto só enxerga os próprios (`count == 1`, `user_id` correto)
    - [x] **Auto-fill na criação:** dentro de `tenant_context(user)`, `TestModel.objects.create(...)` grava `user_id == user.id` sem passá-lo explicitamente
    - [x] **Fail-closed (escrita):** `TestModel().save()` sem contexto levanta `TenantScopeViolation`
    - [x] **Caminho admin:** `TestModel.all_objects.all()` (com tabela populada) retorna cross-tenant sem levantar
  - [x] Estabelecer a **fixture parametrizada de isolamento** no `conftest.py` (mecanismo genérico que apps de domínio plugam depois — ver §7.4 "fixture parametrizada compartilhada, não copy-paste"). Em 1.2 ela cobre só o model de teste; documentar como apps futuros se registram nela
- [x] **Task 7 — Guardrails de CI (regra de porta + manager escopado)** (AC: 4)
  - [x] Adicionar `import-linter` (`importlinter`) ao grupo `dev` do `pyproject.toml`
  - [x] Configurar `[tool.importlinter]` em `pyproject.toml`: `root_packages` apenas com pacotes que EXISTEM hoje (`core`, `config`); contrato `forbidden` de `core` → apps de domínio. **Ler §Guardrail de porta nas Dev Notes** — apps de domínio ainda não existem, então o contrato cresce por story; verificar empiricamente o comportamento do import-linter com módulos inexistentes
  - [x] Implementar o **guardrail de manager escopado** como teste de arquitetura (`core/tests/test_guardrails.py`): varre `apps.get_models()`, e para todo subclass concreto de `TenantModel` afirma `isinstance(model.objects, TenantManager)` e que `model._meta.default_manager` é o `TenantManager`. Falha se algum model tenant expuser manager não-escopado como `objects`
  - [x] Estender `.github/workflows/ci.yml` (job backend): adicionar passo `uv run lint-imports` após o `ruff`. O guardrail de manager roda dentro do `pytest` (não precisa de passo separado). Manter a estrutura existente do `ci.yml` (não reescrever)
  - [x] Verificar que `lint-imports` passa verde com a config atual e que uma violação fabricada (import temporário de um app de domínio em `core`, se existisse) seria pega — documentar como cada story futura adiciona seu módulo ao contrato

### Review Findings

_Code review adversarial (Blind Hunter + Edge Case Hunter + Acceptance Auditor) em 2026-06-24. 0 decisões pendentes (1 resolvida → deferida), 0 patches, 5 deferidos, 10 descartados como ruído. Guardrail do import-linter validado empiricamente (um `import bujo` em `core` quebra o contrato; revertido)._

- [x] [Review][Defer] Escrita cross-tenant não validada contra o contexto ativo [backend/core/models.py:394-402] — deferido: sem serializers/views/`bulk_create` até a Story 1.4; preservar `user_id` explícito é by-design (caminho admin). `save()` só preenche `user_id` quando é `None`, então um `user_id` explícito arbitrário é persistido sem checar `current_user_id`, e `bulk_create` não chama `save()` (contorna auto-fill + fail-closed). Endereçar validação `user_id == current_user_id` + guarda de `bulk_create` quando surgir a primeira camada de escrita de domínio.
- [x] [Review][Defer] Robustez do `custom_exception_handler` para corpos de erro não-triviais [backend/core/exceptions.py:278-315] — deferido: sem serializers/views até a Story 1.4. `_as_list` stringifica erros de serializer aninhado (`{campo: {sub: [...]}}`) como `"{'sub': [...]}"`; `non_field_errors` como string é indexado por caractere (`non_field[0]` → 1ª letra); `data=None` vira `{"detail": "None"}`; dict com `detail` + chaves extras cai no ramo de validação e rebaixa o `detail` real a "campo".
- [x] [Review][Defer] Mapeamento 404 "recurso de outro usuário" não implementado nem testado [backend/core/exceptions.py] — deferido: nasce com a primeira view de recurso (Épico 3+). O mapa do §6.4 lista 404 para recurso de outro tenant; hoje depende de `Http404`/`get_object_or_404` que ainda não existem.
- [x] [Review][Defer] `tenant_context`/middleware com `user.id` None ou falsy [backend/core/tenant.py:446,461; backend/core/middleware.py:345] — deferido: sem `User` real até a Story 2.1. `set(None)`/`set(0)`/`set("")` torna o contexto indistinguível de "sem tenant" → mascarado como `TenantScopeViolation` (500 + log crítico enganoso) ou aceita um id espúrio no filtro/escrita. Guards são estritamente `is None`.
- [x] [Review][Defer] `TenantMiddleware` pode "acordar" via sessão do Django admin com PK incompatível [backend/core/middleware.py:343-345] — deferido: sem superuser nem models de domínio hoje. `django.contrib.admin` está em `INSTALLED_APPS`; um login no admin autentica um `auth.User` de PK **inteiro**, e o middleware setaria `current_user_id` para um int incompatível com `user_id` UUID. O "dormente até 2.1" não é absoluto.

## Dev Notes

### ⚠️ Limites de Escopo (LEIA PRIMEIRO — previne over-build)

Esta story entrega **só a mecânica de isolamento multi-tenant + taxonomia de erros + guardrails**. O repo deve continuar subindo/lintando/testando/buildando verde, agora com o isolamento **provado** por teste, **antes de qualquer model de domínio existir**.

| Pertence a esta Story (1.2) | NÃO faça agora — Story responsável |
|---|---|
| `core/tenant.py` (contextvar, `tenant_context`, `TenantManager`) | `core/calendar.py` + `today_for()` + padrão temporal → **Story 1.3** |
| `core/models.py` (`TenantModel` abstrato) | `core/pagination.py` + defaults de paginação/filtros DRF → **Story 1.4** |
| `core/exceptions.py` (`DomainError` + handler DRF) | `drf-spectacular`, `types.gen.ts`, camel-case, serviço de referência → **Story 1.4** |
| `core/middleware.py` (`TenantMiddleware`) | `User` model (UUID), JWT/simplejwt, endpoints de auth, `force_authenticate`/`auth_client` real → **Story 2.1** |
| import-linter (regra de porta) + guardrail de manager | tema MUI, `api/client.ts`, boundary ESLint do frontend → **Story 1.5** |
| Registrar `core` em `INSTALLED_APPS` | Registrar `accounts` em `INSTALLED_APPS` (ganha models na 2.1) |

**Princípio:** nada além da fundação de isolamento. Sem JWT, sem `User`, sem models de domínio, sem paginação, sem calendário. O `TenantMiddleware` fica dormente até a 2.1 ligar a auth — e tudo bem.
[Source: epics.md#Story-1.2, architecture.md §6.7, §7.4]

### ⚠️ Tensões de ordem de stories (resolvidas aqui — leia antes de codar)

1. **Não há `User` model ainda.** Ele nasce na **Story 2.1** (`accounts.User`, UUID PK). Por isso:
   - `TenantModel.user_id` é **`UUIDField` puro, não `ForeignKey`** — o AD-12 isola por `user_id` na camada de aplicação; FK para `User` não é requisito e nem seria possível agora. Quando a 2.1 chegar, o `user_id` continua `UUIDField` (sem FK), apenas passa a referenciar IDs reais de `User`.
   - As fixtures `user`/`other_user` em 1.2 são **stand-ins leves com `.id = uuid4()`** (ver §Fixtures), não `User` reais.
2. **Não há models de domínio ainda** (Épico 3+). Para provar o `TenantManager` genérico verde, esta story cria um **model concreto só de teste** (§Model de teste). Isto é exatamente o "provado verde antes de qualquer modelo de domínio existir" do épico.
3. **`auth_client` em 1.2 NÃO faz `force_authenticate`** (não há JWT/`User`). Ele apenas envolve o `api_client` em `tenant_context(user)` (forma do §6.10). O `force_authenticate`/JWT real entra na 2.1.

### Multi-Tenant — contrato canônico (AD-12 / §6.7)

Cópia normativa do §6.10 (a **forma é normativa**; copiar nomes exatamente):

```python
# core/tenant.py
import contextvars
from contextlib import contextmanager
from django.db import models
from core.exceptions import TenantScopeViolation

current_user_id = contextvars.ContextVar("current_user_id", default=None)

@contextmanager
def tenant_context(user):
    token = current_user_id.set(user.id)
    try:
        yield
    finally:
        current_user_id.reset(token)

class TenantManager(models.Manager):
    def get_queryset(self):
        uid = current_user_id.get()
        if uid is None:
            raise TenantScopeViolation()       # fail-closed → 500 + alerta
        return super().get_queryset().filter(user_id=uid)
```

Regras de ciclo de vida (§6.7), todas obrigatórias:
- **Fail-closed sempre:** contexto vazio → `TenantScopeViolation`; **nunca** "todos os usuários". (Decisão A.)
- **Dentro do request:** middleware seta o contexto **logo após** a auth e **reseta no `finally`**.
- **Fora do request (commands, workers, shell, seeding, testes):** obrigatório `with tenant_context(user): ...`.
- **Caminho de admin/operador:** `Model.all_objects` (sem escopo) — permitido só em admin/shell, **nunca** em código de aplicação.
- **Async/ASGI:** se uma view virar async um dia, propagar o contextvar via `sync_to_async`/`async_to_sync` (fora de escopo agora; deixar comentário se relevante).
[Source: architecture.md §6.7, §6.10, AD-12 (§3 itens 2-4)]

### `TenantModel` (§6.2 / §7.1 / AD-12)

```python
# core/models.py
import uuid
from django.db import models
from core.tenant import TenantManager, current_user_id
from core.exceptions import TenantScopeViolation

class TenantModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField(db_index=True)

    objects = TenantManager()       # auto-escopado — DEFAULT (declarar primeiro)
    all_objects = models.Manager()  # não-escopado — só admin/operador

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if self.user_id is None:
            uid = current_user_id.get()
            if uid is None:
                raise TenantScopeViolation()   # fail-closed na escrita
            self.user_id = uid
        super().save(*args, **kwargs)
```

- **Ordem dos managers importa:** o primeiro manager declarado vira o `_default_manager`. `objects` (escopado) deve ser o primeiro/default; `all_objects` é o explícito. O guardrail da Task 7 confirma isso para todo model tenant. [Source: architecture.md §6.2, AD-12, §6.7]
- `user_id` indexado é requisito cross-cutting (§1, item 1: "toda tabela carrega `user_id`").
- **Import circular:** `models.py` importa de `tenant.py`; `tenant.py` importa só `exceptions.py`. `exceptions.py` não importa nem `tenant.py` nem `models.py`. Cadeia acíclica: `exceptions` ← `tenant` ← `models`.

### Exceções & handler DRF (§6.4)

Hierarquia em `core/exceptions.py`: base `DomainError(Exception)` com subclasses tipadas `InvalidTransition` (AD-02), `ImmutableSnapshot` (AD-06/07), `TenantScopeViolation` (AD-12). `InvalidTransition` recebe `(from_status, to_status)` e monta a mensagem.

**Handler** (`custom_exception_handler(exc, context)`) — uniformiza o corpo `{ "detail", "fields" }` (`fields` sempre `{campo: [array]}`, formato nativo DRF) e mapeia:

| Exceção / situação | Status |
|---|---|
| Erro de validação de serializer | `400` + `fields` |
| `InvalidTransition` e demais `DomainError` de regra | `409` |
| Sem autenticação | `401` |
| Acesso a recurso de **outro usuário** (existe, não é seu) | `404` (esconde existência) |
| **`TenantScopeViolation`** (contexto vazio) | `500` + **alerta** — o handler **NÃO** domestica; é bug de infra, não negação de acesso |
| Inesperado | `500` |

Detalhes de implementação:
- `DomainError` é `Exception` pura (não `APIException`) → o `exception_handler` default do DRF **retorna `None`** para elas. O handler custom deve: (1) chamar `response = exception_handler(exc, context)`; (2) se `response is not None`, normalizar o corpo para `{detail, fields}`; (3) se `None`, tratar os `DomainError` conhecidos e construir a `Response` manualmente.
- `TenantScopeViolation` → logar `logger.critical(...)` (canal de alerta concreto é Gap I-1, pré-produção — deixar o `logger.critical` como ponto de extensão) e responder `500` com `{"detail": "Internal server error"}` (sem vazar detalhe).
- Registrar via `REST_FRAMEWORK["EXCEPTION_HANDLER"]` (Task 5).
- **Proibido** levantar `ValidationError`/`ValueError`/`PermissionDenied` crus de dentro de `services/` — só exceções de domínio (regra futura; aqui não há services, mas a taxonomia já fica pronta).
[Source: architecture.md §6.4, §6.6, §6.9]

### Middleware (§6.7)

```python
# core/middleware.py
from core.tenant import current_user_id

class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = None
        if getattr(request, "user", None) and request.user.is_authenticated:
            token = current_user_id.set(request.user.id)
        try:
            return self.get_response(request)
        finally:
            if token is not None:
                current_user_id.reset(token)
```
- A forma de classe acima é equivalente à do `sync_and_async_middleware` citado em pesquisa; use a forma de **classe simples** (suficiente para WSGI, que é o alvo atual). [Source: architecture.md §6.7, §7.2]

### Settings (arquivos a ALTERAR — `config/settings/base.py`)

Estado atual relevante (ler [base.py](backend/config/settings/base.py)):
- `INSTALLED_APPS` tem `rest_framework` e `corsheaders`, **sem** `core`. → adicionar `"core"` (depois dos third-party, antes de futuros apps de domínio).
- `MIDDLEWARE` atual (ordem): `corsheaders` → `security` → `sessions` → `common` → `csrf` → `auth` → `messages` → `clickjacking`. → inserir `"core.middleware.TenantMiddleware"` **logo após** `django.contrib.auth.middleware.AuthenticationMiddleware`.
- **Não existe** bloco `REST_FRAMEWORK`. → criar com `EXCEPTION_HANDLER` apenas (paginação é 1.4).
- **Preservar** o comentário/decisão de não hardcodar SSL no `DATABASES`, o `DEFAULT_AUTO_FIELD` etc. — só adicionar, não remover.

### Model de teste & estratégia de tabela (Task 6 — decisão de implementação)

Não há model de domínio até o Épico 3, então defina um model concreto **só para teste** para exercer o `TenantManager` genérico. Estratégia recomendada (não polui migrations de prod):

- Definir o model em `core/tests/` (ex.: `core/tests/models.py`) herdando `TenantModel`, com `class Meta: app_label = "core"; managed = False`.
- Criar a tabela numa **fixture pytest** via `connection.schema_editor()` (`create_model` no setup, `delete_model` no teardown), escopo `module`/`session`. Assim a tabela existe só durante os testes e não exige migration.
- Alternativa, se preferir: usar `django.test.utils.isolate_apps` (`@isolate_apps("core")`). Avalie o que for mais limpo; o requisito é **não** gerar migration que vaze para prod e **não** quebrar `makemigrations --check`.
- O teste **fail-closed** (`Model.objects.all()` sem contexto) levanta ANTES de tocar o DB, então nem precisa de tabela; mas os testes de isolamento, auto-fill e admin precisam da tabela.

### Fixtures (`conftest.py` — arquivo a ALTERAR)

Estado atual (ler [conftest.py](backend/conftest.py)): só o autouse `_enable_db_access(db)`. O próprio comentário diz que as fixtures `user`/`other_user`/`api_client`/`auth_client` + a parametrizada chegam na 1.2 — **é agora**.

- `user` / `other_user`: **stand-ins leves** com `.id = uuid.uuid4()` (ex.: `types.SimpleNamespace(id=uuid.uuid4())`). `tenant_context(user)` só usa `user.id`; o `user_id` do model de teste é `UUIDField` puro → qualquer UUID serve. **Documentar** que a 2.1 troca por `User` reais (`UserFactory`).
- `api_client`: `APIClient()` (de `rest_framework.test`). Já há `djangorestframework` no projeto.
- `auth_client`: envolve em contexto, **sem** `force_authenticate` (forma §6.10):
  ```python
  @pytest.fixture
  def auth_client(user, api_client):
      with tenant_context(user):
          yield api_client
  ```
- **Fixture parametrizada de isolamento** (§7.4): estabelecer o mecanismo genérico compartilhado no `conftest.py` para que apps de domínio pluguem depois (sem copy-paste de `test_isolation.py` por app). Em 1.2 cobre só o model de teste.
[Source: architecture.md §6.10, §7.4]

### Guardrail de porta (import-linter) — ⚠️ verificar empiricamente

A regra de porta (§7.2): **`core` não pode importar nenhum app de domínio** (`bujo`, `habits`, `health`, `medications`, `gratitude`, `braindump`). Imposta por `import-linter` no CI.

**Problema de ordem:** esses apps **ainda não existem** em 1.2. O `import-linter` constrói o grafo a partir de `root_packages`; listar pacotes inexistentes como `forbidden_modules`/`root_packages` tende a **erro** ("Could not find package"). Resolução recomendada:

1. `[tool.importlinter]` com `root_packages = ["core", "config"]` (só o que existe). Contrato `forbidden` de `core` → domínio, listando **apenas módulos existentes** hoje (na prática, contrato trivialmente verde agora). Cada story que cria um app de domínio **adiciona seu módulo** ao `forbidden_modules` (documentar isso na story do app).
2. **Verificar empiricamente** durante o dev: rodar `uv run lint-imports`. Se o import-linter tolerar `forbidden_modules` inexistentes sem erro, já liste todos os apps de domínio futuros no contrato (melhor — falha no minuto em que o app surgir e for mal-importado). Se ele errar com módulo inexistente, fique com a abordagem incremental do item 1.
3. **Garantia de "verde desde já":** o guardrail de manager (teste pytest da Task 7) já é autoritativo e independente do import-linter. Opcionalmente, adicione um teste leve baseado em AST que falhe se `core/*.py` importar qualquer nome da lista conhecida de apps de domínio — isso impõe a regra de porta mesmo antes dos apps existirem. Avalie se vale o esforço ou se o import-linter incremental basta.

Documente no `pyproject.toml` (comentário) que o contrato é estendido por story. [Source: architecture.md §7.2, §7.4, §8.1]

### CI (arquivo a ALTERAR — `.github/workflows/ci.yml`)

Estado atual (ler [ci.yml](.github/workflows/ci.yml)): job `backend` faz `uv sync --frozen` → `ruff check .` → `pytest`; job `frontend` faz tsc/eslint/build. O arquivo foi propositalmente estruturado para extensão (comentário no topo cita import-linter + guardrail de tenant da 1.2).

- Adicionar passo **`uv run lint-imports`** no job backend (após `ruff`, antes do `pytest`).
- O **guardrail de manager** roda dentro do `pytest` (`core/tests/test_guardrails.py`) — **não** precisa de passo de CI separado.
- **Não** reescrever o `ci.yml`; só adicionar o passo. Manter o Postgres efêmero e os `env:` existentes.
[Source: architecture.md §7.4, epics.md#Story-1.2]

### Testing requirements

- `pytest` + `pytest-django`; `conftest.py` na raiz `backend/` (já ativa `django_db` por default via autouse). `factory_boy` está nas deps mas **`UserFactory` é da 2.1** — não criar agora.
- `core/tests/test_isolation.py` é **obrigatório** (§6.7: "sem esse teste, AD-12 é esperança, não padrão"). Cobrir: fail-closed (leitura), isolamento 2 usuários, auto-fill na criação, fail-closed (escrita), caminho `all_objects`.
- `core/tests/test_guardrails.py`: guardrail de manager escopado (varre `apps.get_models()`).
- O smoke test do health (`core/tests/test_health.py`) da 1.1 deve continuar passando.
- Rodar a suíte com `uv run pytest` (gerenciador é `uv` — ver §Previous Story Intelligence).
[Source: architecture.md §6.7, §6.9 (item 7), §7.4]

### Project Structure Notes

Árvore-alvo do `core/` ao fim desta story (subconjunto da §7.1; itens de calendário/paginação são 1.3/1.4):

```
backend/
├── pyproject.toml                 # + importlinter (dev) + [tool.importlinter]
├── conftest.py                    # + user/other_user/api_client/auth_client + fixture parametrizada
├── config/settings/base.py        # + "core" em INSTALLED_APPS, + TenantMiddleware, + REST_FRAMEWORK[EXCEPTION_HANDLER]
├── core/
│   ├── __init__.py
│   ├── apps.py                    # NOVO — CoreConfig
│   ├── models.py                  # NOVO — TenantModel abstrato
│   ├── tenant.py                  # NOVO — contextvar, tenant_context, TenantManager
│   ├── middleware.py              # NOVO — TenantMiddleware
│   ├── exceptions.py              # NOVO — DomainError + subclasses + handler
│   ├── views.py                   # existente (health) — não mexer
│   ├── migrations/__init__.py     # NOVO — pacote vazio (sem migration; model abstrato)
│   └── tests/
│       ├── __init__.py            # existente
│       ├── test_health.py         # existente — não mexer
│       ├── models.py              # NOVO — model concreto de teste (managed=False)
│       ├── test_isolation.py      # NOVO
│       └── test_guardrails.py     # NOVO
└── accounts/                      # segue STUB (sem models até 2.1)
```
- **Não** criar `core/calendar.py` (1.3) nem `core/pagination.py` (1.4). [Source: architecture.md §7.1, §7.2]

### Previous Story Intelligence (1.1 — done)

Aprendizados da Story 1.1 que impactam 1.2 (ler [1-1-...](_bmad-output/implementation-artifacts/1-1-scaffold-do-monorepo-e-pipeline-de-ci-base.md)):
- **Stack real cravada** (desvios M-1 registrados): backend **Python 3.13.5**, **Django 5.2**, **DRF 3.17**, gerenciado por **`uv`** (`uv.lock`); rodar comandos com `uv run ...`. Frontend React 19 / Vite 8 / MUI 6.5 (irrelevante para 1.2).
- 1.1 deixou `core/` e `accounts/` como **stubs sem registro em INSTALLED_APPS** explicitamente "até ganharem models (1.2/2.1)" — esta story registra `core`.
- 1.1 já criou `core/views.py` (health), `core/tests/test_health.py` e `conftest.py` mínimo — **estender**, não recriar.
- `pytest` crava `DJANGO_SETTINGS_MODULE=config.settings.dev`; `testpaths = ["."]`; `python_files = "test_*.py"`.
- **CI usa Postgres efêmero** (`postgres:16`), `DATABASE_URL` **sem `sslmode`**; settings não hardcoda SSL — manter.
- **Deferred (do review da 1.1):** CI não exercita `config.settings.prod` nem roda `makemigrations --check` — o review da 1.1 sugeriu "revisitar nas Stories 1.2+". **Não** é AC desta story, mas: adicionar `makemigrations --check --dry-run` ao CI seria barato e pega drift de migration agora que `core` é app. Considerar como melhoria oportunista (não obrigatório). [Source: deferred-work.md]

### Git Intelligence

- Branch `main`; último commit `1ce4b82` ("Story 1.1: scaffold do monorepo e pipeline de CI base"). Repo limpo. Convenção de commit: "Story X.Y: <descrição>". Commitar ao fim da story (status `done`).

### References

- [Source: epics.md#Story-1.2] — user story e ACs originais (BDD): TenantModel, manager fail-closed, exceptions, guardrails
- [Source: epics.md#Epic-1] — objetivo do épico (alicerce de isolamento provado, NFR-3)
- [Source: architecture.md §1 Cross-Cutting #1] — multi-tenancy: toda tabela com `user_id`, isolamento na camada de aplicação
- [Source: architecture.md AD-12] — isolamento na camada de aplicação (revisa RLS): manager auto-escopado, fail-closed, `all_objects`, guardrail em CI
- [Source: architecture.md §6.2] — estrutura, managers, conftest
- [Source: architecture.md §6.4] — taxonomia de exceções + handler DRF + mapa exceção→status
- [Source: architecture.md §6.7] — contrato de ciclo de vida multi-tenant (fail-closed, middleware, tenant_context, teste obrigatório)
- [Source: architecture.md §6.9] — enforcement (item 1: manager escopado; item 7: teste de isolamento)
- [Source: architecture.md §6.10] — implementações de referência (tenant.py, conftest, test_isolation) — forma normativa
- [Source: architecture.md §7.1] — árvore do projeto (core/, accounts/)
- [Source: architecture.md §7.2] — fronteiras: regra de porta do core (import-linter), fronteira de tenant
- [Source: architecture.md §7.4] — CI (import-linter + guardrail de tenant), fixture parametrizada de isolamento
- [Source: architecture.md §8.1/§8.2] — coerência (fronteiras por CI) e cobertura NFR-3
- [Source: 1-1-...md] — stack cravada, stubs, CI base, deferred work

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8) — workflow `bmad-dev-story`.

### Debug Log References

- **Postgres local:** não havia servidor Postgres rodando; subi um container efêmero `postgres:16` (`hmmb-pg-dev`, porta host `55432`) e criei `backend/.env.dev` (git-ignored) apontando para ele, espelhando a config do CI. Baseline da 1.1 confirmado verde (1 teste) antes de codar.
- **import-linter — verificação empírica (Dev Notes §Guardrail de porta):** listar apps de domínio inexistentes em `forbidden_modules` exige `include_external_packages = true` (grimp trata-os como pacotes externos). Com a flag, o contrato fica verde hoje e já lista todos os apps de domínio futuros. Violação fabricada (`import bujo` temporário em `core/tenant.py`) **quebra** o contrato (`core.tenant -> bujo`) e o build — comportamento removido após a verificação. Optei pela abordagem "listar todos já" (Dev Notes item 2) em vez da incremental, por falhar no minuto exato em que um import indevido surgir.
- **ruff DJ012 × ordem dos managers:** o ruff sinalizou `all_objects` antes do `class Meta`; a ordem `objects` (escopado) primeiro é requisito funcional (default manager / `_default_manager`), não negociável. Suprimi com `# noqa: DJ012` + comentário explicativo, preservando a semântica exigida pela story.

### Completion Notes List

- **AC1 (TenantModel):** `core/models.py` com PK `UUIDField(default=uuid4)`, `user_id = UUIDField(db_index=True)` (puro, sem FK — AD-12), `objects = TenantManager()` (default escopado, declarado primeiro) + `all_objects = models.Manager()`, e `save()` com auto-fill de `user_id` a partir do contextvar (fail-closed também na escrita).
- **AC2 (fail-closed + isolamento):** `core/tenant.py` com `current_user_id` (contextvar), `tenant_context` e `TenantManager.get_queryset()` que levanta `TenantScopeViolation` antes de tocar o DB quando não há contexto. `core/tests/test_isolation.py` cobre: fail-closed leitura, fail-closed escrita, isolamento entre 2 usuários, auto-fill na criação e caminho admin (`all_objects` cross-tenant). Mecanismo de **fixture parametrizada de isolamento** estabelecido (`core/tests/registry.py` + hook `pytest_generate_tests` no `conftest.py`) para apps de domínio plugarem sem copy-paste.
- **AC3 (exceções + handler + middleware):** `core/exceptions.py` com hierarquia `DomainError` (`InvalidTransition`, `ImmutableSnapshot`, `TenantScopeViolation`) e `custom_exception_handler` que uniformiza o corpo `{detail, fields}` e mapeia exceção→status (400+fields / 401 / 409 / 500 opaco para `TenantScopeViolation` com `logger.critical`). `core/middleware.py` (`TenantMiddleware`) seta o contexto após a auth e reseta no `finally` (dormente para `AnonymousUser` até a 2.1). Registrado em `REST_FRAMEWORK[EXCEPTION_HANDLER]` e no `MIDDLEWARE`.
- **AC4 (guardrails):** `import-linter` no `pyproject.toml` (regra de porta `core` ⇏ apps de domínio) + passo `lint-imports` no `ci.yml` após o `ruff`. Guardrail de manager escopado como teste de arquitetura (`core/tests/test_guardrails.py`) varrendo `apps.get_models()`.
- **Validações finais (todas verdes):** `ruff check .` (limpo), `lint-imports` (1 kept / 0 broken), `makemigrations --check --dry-run` (No changes detected — model abstrato + test model `managed=False`), `manage.py check` (0 issues), `pytest` (**16 passed**, incl. o smoke `test_health` da 1.1 sem regressão).
- **Notas de escopo respeitadas:** sem `core/calendar.py` (1.3), sem `core/pagination.py`/paginação DRF (1.4), sem `User`/JWT (2.1), `accounts` segue stub não-registrado. `backend/.env.dev` é artefato local git-ignored (não versionado).

### File List

**Novos:**
- `backend/core/tenant.py`
- `backend/core/models.py`
- `backend/core/exceptions.py`
- `backend/core/middleware.py`
- `backend/core/apps.py`
- `backend/core/migrations/__init__.py`
- `backend/core/tests/models.py`
- `backend/core/tests/registry.py`
- `backend/core/tests/test_isolation.py`
- `backend/core/tests/test_exceptions.py`
- `backend/core/tests/test_middleware.py`
- `backend/core/tests/test_guardrails.py`

**Modificados:**
- `backend/config/settings/base.py` (registra `core` em `INSTALLED_APPS`; insere `TenantMiddleware` após `AuthenticationMiddleware`; adiciona bloco `REST_FRAMEWORK` com `EXCEPTION_HANDLER`)
- `backend/conftest.py` (fixtures `user`/`other_user`/`api_client`/`auth_client` + hook `pytest_generate_tests` da fixture parametrizada de isolamento)
- `backend/pyproject.toml` (`import-linter` no grupo `dev` + `[tool.importlinter]` com a regra de porta)
- `backend/uv.lock` (resolução de `import-linter` e transitivos)
- `.github/workflows/ci.yml` (passo `Import boundaries (import-linter)` no job backend)

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-06-24 | 0.1 | Implementação da Story 1.2 — `core/` multi-tenant fail-closed (TenantModel, TenantManager, tenant_context, taxonomia de exceções + handler DRF, TenantMiddleware) e guardrails de CI (import-linter + guardrail de manager). 16 testes verdes. Status → review. | Amelia (dev agent) |
