---
baseline_commit: 7b866dc1bc36014fb60ee1ca13de6b2af837d86d
---

# Story 12.4: Token de automação (`AutomationToken`) com autenticação dedicada

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero criar um token de automação de longa duração, escopado e revogável,
Para que meus atalhos iOS e o widget autentiquem na API sem expor senha nem sessão (FR-3.1, AR-25, DIR-11, AD-19).

## Acceptance Criteria

**AC1 — Novo app `automation` + modelo `AutomationToken` + migration (também na branch Neon e2e)**

**Dado que** o novo app backend `automation` (registrado em `INSTALLED_APPS`),
**Quando** a migration `automation/migrations/0001_initial.py` cria a tabela `automation_tokens` com os campos `name`, `token_prefix`, `token_hash` (SHA-256), `scopes` (JSONB), `last_used_at`, `revoked_at`, `created_at` (+ `id` UUID e `user`),
**Então** o token **pleno** é gerado e exibido **uma única vez** na criação (padrão GitHub PAT) — **nunca** armazenado (só o hash) **nem logado**,
**E** a migration é aplicada ao Postgres LOCAL (pytest) **e também à branch Neon e2e** antes de qualquer suíte Playwright (lição recorrente 7.1/7.2/11.1/12.2).

**AC2 — Gestão via Django admin (criar / identificar por prefixo / revogar)**

**Dado que** a gestão inicial é via Django admin (UI própria é story futura, **fora de escopo**),
**Quando** o operador acessa o admin de `AutomationToken`,
**Então** consegue **criar** um token escolhendo os escopos (`capture` e/ou `summary`) e vê o **token pleno exibido uma única vez** na tela de confirmação da criação,
**E** consegue **identificar** cada token pelo `token_prefix` (o pleno nunca reaparece) e **revogá-lo** (setando `revoked_at`),
**E** o admin **nunca** expõe campo de entrada para `token_hash`/`token_prefix` (derivados na geração) e usa o caminho de operador cross-tenant (`all_objects`, AD-12).

**AC3 — Auth class dedicada `AutomationTokenAuthentication` que seta o tenant context (AD-12)**

**Dado que** a auth class DRF dedicada `AutomationTokenAuthentication`,
**Quando** uma requisição chega com `Authorization: Bearer <token>` a um endpoint que **opta explicitamente** por ela (`authentication_classes = [AutomationTokenAuthentication]`),
**Então** ela valida o **hash** (lookup por `token_hash` — busca **fora do tenant scope**, pois o contexto ainda não existe) + **não-revogado** (`revoked_at IS NULL`), atualiza `last_used_at`, **seta o tenant context (AD-12)** com o **dono do token** (mesmo mecanismo de `TenantAwareJWTAuthentication`: `current_user_id.set(user.id)` + stash em `request._request._tenant_context_token` para o `TenantMiddleware` resetar),
**E** existe teste no app `automation` provando que, dentro do escopo setado pela auth, uma query de domínio retorna **apenas** dados do dono do token (caminho de isolamento coberto — análogo a `test_isolation`),
**E** a auth class **não** é adicionada a `DEFAULT_AUTHENTICATION_CLASSES` (não vale em nenhum endpoint fora do app `automation`) e **nunca** emite sessão/JWT.

**AC4 — Escopo como autorização per-view + respostas 401/403 corretas**

**Dado que** um token **revogado** ou **sem o escopo** exigido pelo endpoint,
**Quando** ele é usado,
**Então** revogado/ausente/hash-inválido → **401** imediato (a auth class levanta `AuthenticationFailed` **e** define `authenticate_header()` → `"Bearer"`, para o DRF responder 401 e não 403),
**E** escopo insuficiente → **403** (autenticação OK, autorização não) via um mecanismo de checagem de escopo **per-view** reutilizável (permissão `HasAutomationScope` lendo o escopo exigido declarado na view — testável unitariamente sem endpoint real nesta fatia).

## Tasks / Subtasks

- [x] **Task 1 — Scaffold do app `automation` + registro** (AC: #1)
  - [x] Criar o pacote `backend/automation/` com `__init__.py`, `apps.py` (`AutomationConfig`, `default_auto_field = "django.db.models.BigAutoField"`, `name = "automation"`), `models.py`, `admin.py`, `authentication.py`, `permissions.py`, `migrations/__init__.py`, `tests/__init__.py`. **Não** criar `urls.py`/`views.py`/`serializers.py` nesta fatia — não há endpoint HTTP (os endpoints `POST /api/capture` e `GET /api/summary/today` são das Stories 12.5/12.6).
  - [x] Registrar `"automation"` em `INSTALLED_APPS` (bloco "Local" de `config/settings/base.py`, ao lado de `braindump`/`habits`/…).

- [x] **Task 2 — Modelo `AutomationToken` + geração de token + migration** (AC: #1)
  - [x] Em `automation/models.py`, declarar `AutomationToken` como **`models.Model` puro (NÃO `TenantModel`)** — ver Dev Notes › "Por que NÃO herda `TenantModel`". Campos: `id = UUIDField(primary_key, default=uuid.uuid4, editable=False)`; `user = ForeignKey(settings.AUTH_USER_MODEL, on_delete=CASCADE, related_name="automation_tokens")`; `name = CharField`; `token_prefix = CharField(max_length=12)`; `token_hash = CharField(max_length=64, unique=True, db_index=True)`; `scopes = JSONField(default=list)`; `last_used_at = DateTimeField(null=True, blank=True)`; `revoked_at = DateTimeField(null=True, blank=True)`; `created_at = DateTimeField(auto_now_add=True)`. `class Meta: db_table = "automation_tokens"`.
  - [x] Definir os escopos como constantes/`TextChoices` no módulo (ex.: `SCOPE_CAPTURE = "capture"`, `SCOPE_SUMMARY = "summary"`) — reusadas pelo admin, pela permissão e pelos testes. **Sem** enum nativo do Postgres (AD-01 / §6.9): `scopes` é uma lista JSONB de strings.
  - [x] Helper de geração (classmethod `AutomationToken.issue(*, user, name, scopes)` **ou** função de módulo): gera o segredo com `secrets.token_urlsafe(32)` **prefixado** por `bujo_` (→ `bujo_<random>`), calcula `token_hash = hashlib.sha256(full.encode()).hexdigest()` (64 hex → cabe em `VARCHAR(64)`), `token_prefix = full[:12]`, persiste o registro e **retorna a tupla `(instance, full_plaintext)`** — o pleno **só** existe em memória, nunca é salvo. Documentar no docstring que o pleno é descartado após a exibição única.
  - [x] Gerar a migration: `DATABASE_URL=... uv run python manage.py makemigrations automation` → `0001_initial.py`. Conferir que é uma única `CreateModel` limpa.
  - [x] Aplicar ao Postgres LOCAL (automático ao rodar `pytest`/`migrate` com o `docker-compose` de teste no ar) **e** à branch Neon e2e — ver Dev Notes › "Lição recorrente: migration na branch Neon e2e". Se as credenciais Neon e2e não estiverem nesta sessão, registrar explicitamente a pendência (não bloqueia pytest, que roda em Postgres LOCAL).

- [x] **Task 3 — Admin de operador com revelação única do token** (AC: #2)
  - [x] Em `automation/admin.py`, registrar `AutomationTokenAdmin(admin.ModelAdmin)`. `list_display = ("id", "user", "name", "token_prefix", "scopes", "last_used_at", "revoked_at", "created_at")`; `list_filter` por `revoked_at`; `search_fields` por `token_prefix`, `name` (e `user__email`). `readonly_fields` para `token_prefix`, `token_hash`, `last_used_at`, `created_at`. Caminho de operador cross-tenant não é necessário via `all_objects` aqui porque `AutomationToken` **não** é `TenantModel` (não há `objects` fail-closed) — o admin lê a tabela inteira normalmente. Documentar essa diferença no docstring do admin.
  - [x] Fluxo de **criação**: na tela de "add", o operador informa `user`, `name`, `scopes` (widget de escolha dos escopos — ex.: um form custom com `MultipleChoiceField` sobre as constantes de escopo, gravando lista JSONB). Ao salvar um objeto **novo**, gerar o token via o helper da Task 2 (não deixar o operador digitar hash/prefix) e **exibir o pleno uma única vez** via `django.contrib.messages` (ex.: `self.message_user(request, "Token (copie agora, não será exibido de novo): <pleno>", level=messages.WARNING)`). Ver Dev Notes › "Admin: revelar o pleno uma vez" para os hooks corretos (`save_model` para gerar; `response_add` ou `message_user` para exibir).
  - [x] Edição de um token existente **nunca** regenera o segredo (só permite editar `name`/`scopes` e revogar). **Revogar** = setar `revoked_at` (ação de admin dedicada **ou** campo editável) — documentar a escolha.

- [x] **Task 4 — Auth class `AutomationTokenAuthentication`** (AC: #3, #4)
  - [x] Em `automation/authentication.py`, subclasse de `rest_framework.authentication.BaseAuthentication`. `authenticate(self, request)`:
    - Ler o header `Authorization`; se ausente ou não começa com `Bearer ` → `return None` (deixa outras auth/`IsAuthenticated` decidirem; resulta em 401 vazio).
    - Extrair o token pleno, calcular o mesmo `sha256(...).hexdigest()`, buscar `AutomationToken.objects.filter(token_hash=hash).first()` (**modelo puro** → `objects` é o manager padrão do Django, **sem** fail-closed; a busca roda **antes** de qualquer tenant context — ver Dev Notes).
    - Token não encontrado → `raise AuthenticationFailed(...)` (401).
    - `revoked_at IS NOT NULL` → `raise AuthenticationFailed("Token revogado")` (401).
    - Válido: `token.last_used_at = timezone_now_via_today_for?` **não** — `last_used_at` é um carimbo de infra, não data de domínio; usar `django.utils.timezone.now()` é aceitável aqui (não é "hoje do usuário"; AD-04 rege datas de domínio, não telemetria de auth). Persistir com `update_fields=["last_used_at"]`.
    - Setar o tenant context: `request._request._tenant_context_token = current_user_id.set(token.user_id)` — **importar `current_user_id` de `core.context`** (não de `core.tenant`), exatamente como `core/authentication.py` (ver Dev Notes › "Import de `current_user_id`").
    - `return (token.user, token)` — o `token` vai para `request.auth`, de onde a permissão de escopo lê os `scopes`.
  - [x] Definir `authenticate_header(self, request)` → `return "Bearer"` — **crítico**: sem isso o DRF responde **403** em vez de **401** para falha de autenticação (AC4). Ver Dev Notes › "401 vs 403".
  - [x] **Não** adicionar a classe a `DEFAULT_AUTHENTICATION_CLASSES`. Ela é opt-in per-view (as views de 12.5/12.6 farão `authentication_classes = [AutomationTokenAuthentication]`).

- [x] **Task 5 — Permissão de escopo per-view `HasAutomationScope`** (AC: #4)
  - [x] Em `automation/permissions.py`, `HasAutomationScope(BasePermission)`: lê o escopo exigido declarado na view (ex.: atributo `required_scopes: list[str]` ou `required_scope: str`) e checa se está contido em `request.auth.scopes` (o `token` retornado pela auth). Falta → `has_permission` retorna `False` → DRF responde **403** (autenticado, mas sem autorização). Documentar o contrato (qual atributo a view declara) no docstring — as views de 12.5/12.6 o consumirão.
  - [x] Se `request.auth` não for um `AutomationToken` (ex.: view mal configurada sem a auth class), a permissão nega com segurança (fail-closed) em vez de estourar.

- [x] **Task 6 — Testes (sem endpoint HTTP nesta fatia)** (AC: #1, #2, #3, #4)
  - [x] `automation/tests/factories.py`: `AutomationTokenFactory` (`DjangoModelFactory`) — `user = SubFactory(UserFactory)`; ajuda a materializar tokens em estados variados (com/sem `revoked_at`, escopos diversos). Como `AutomationToken` **não** é `TenantModel`, **não** registrar `register_isolation_case` para ele (o contrato de isolamento é para models tenant-scoped) — ver Dev Notes.
  - [x] `automation/tests/test_models.py`: `issue()` gera prefixo `bujo_…`, grava só o hash (o pleno retornado **não** aparece em nenhum campo persistido), `token_prefix == full[:12]`, `token_hash == sha256(full)`.
  - [x] `automation/tests/test_authentication.py` (espelhar o padrão de `core/tests/test_authentication.py` — chamar `.authenticate(Request(raw_request))` diretamente, **sem** endpoint): (a) token válido → retorna `(user, token)`, `current_user_id.get() == user.id`, `last_used_at` atualizado (resetar o contextvar no fim, como o teste do core faz); (b) sem header → `None`, nada setado; (c) hash desconhecido → `AuthenticationFailed`; (d) token revogado → `AuthenticationFailed`; (e) `authenticate_header()` retorna `"Bearer"`; (f) **isolamento** (AC3): dentro do contexto setado por `authenticate()`, uma query de domínio (ex.: `BrainDumpItem.objects.count()` após criar itens para dois usuários) enxerga só os do dono do token.
  - [x] `automation/tests/test_permissions.py`: `HasAutomationScope` com uma **view stub** (APIView de teste declarando `required_scopes`) ou objeto-duplo de view + `request.auth` = token com/sem o escopo → concede/nega (403).
  - [x] `automation/tests/test_settings.py` (ou assert dentro de outro teste): `AutomationTokenAuthentication` **não** está em `settings.REST_FRAMEWORK["DEFAULT_AUTHENTICATION_CLASSES"]` (AC3 — não vale globalmente).
  - [x] `automation/tests/test_admin.py` (opcional, recomendado): criar um token pelo admin (via `admin_client`/`Client` logado como superuser, ou testar `save_model`/form) gera hash+prefix e **não** deixa o operador definir o hash; a mensagem de revelação única contém o prefixo. Se o teste de admin via HTTP for custoso, cobrir `save_model` diretamente.

- [x] **Task 7 — Suíte verde + contrato OpenAPI** (AC: #1–#4)
  - [x] `cd backend && uv run pytest` → **toda a suíte verde** (Postgres LOCAL via `docker-compose`; ver Dev Notes › Ambiente). Rodar a suíte inteira (gate cross-app do projeto).
  - [x] `uv run ruff check .` + `uv run ruff format --check .` → sem erros.
  - [x] **import-linter** (`uv run lint-imports`) → verde: `automation` **pode** importar services de apps de domínio (é app de composição — AD-19 item 4), mas a **regra de porta do `core`** permanece intacta. Nesta fatia `automation` só importa `core.context`/`core.tenant`/`accounts` (User) — confirmar que nenhuma nova violação surge.
  - [x] **Contrato OpenAPI**: como não há endpoint novo, `types.gen.ts`/`schema.yaml` **não** devem mudar por causa desta story. Se o CI diff de `types.gen.ts` acusar mudança, investigar (não deveria haver). A auth class não entra no schema global (não está em `DEFAULT_AUTHENTICATION_CLASSES`) — nenhum `securityScheme` novo nesta fatia.

## Dev Notes

### Contexto e fronteira da fatia (AD-19 / FR-3.1)

- Esta é a **primeira** fatia da Plataforma de Automação (C5). Entrega **só** a espinha de autenticação: modelo de token + admin + auth class + permissão de escopo. **Sem endpoints HTTP** — `POST /api/capture` é a **Story 12.5** e `GET /api/summary/today` é a **12.6**; ambas farão `authentication_classes = [AutomationTokenAuthentication]` + `permission_classes = [HasAutomationScope]` e declararão seu `required_scopes`. [Source: architecture.md#AD-19; epics.md#Epic-12 / Story-12.4, 12.5, 12.6]
- **Rate limiting/auditoria (`ScopedRateThrottle`, log `{token_prefix, endpoint, status}`) NÃO entram aqui** — nascem junto do endpoint de captura (Story 12.5, FR-3.4). Não antecipe (Occam). [Source: architecture.md#AD-19 item 5; epics.md#Story-12.5]
- **`source: import` (ponte PA/Apple Health)**: a Story 22.x reusará esta mesma auth class num endpoint próprio de medições. Nada a fazer agora além de manter a auth class genérica e opt-in per-view. [Source: architecture.md#AD-19 item 3, §3b L1186; epics.md L2044, L576]

### Forma do modelo (AD-19 "Schema")

```sql
automation_tokens (
  id, user_id,
  name          TEXT,          -- rótulo do usuário ("Atalhos do iPhone")
  token_prefix  VARCHAR(12),   -- exibição/identificação
  token_hash    VARCHAR(64),   -- SHA-256; token pleno NUNCA armazenado
  scopes        JSONB,         -- ["capture", "summary"]
  last_used_at  TIMESTAMPTZ NULL,
  revoked_at    TIMESTAMPTZ NULL,
  created_at    TIMESTAMPTZ
)
```
[Source: architecture.md#AD-19 (L886-899)]

### 🚨 Por que `AutomationToken` NÃO herda `TenantModel` (decisão crítica de design)

Todos os models de **domínio** herdam `TenantModel` (`core/models.py`), cujo manager `objects` é **fail-closed**: sem tenant context setado, **qualquer** query levanta `TenantScopeViolation` (§6.7). Mas o `AutomationToken` é uma **credencial de auth**, buscada **por hash ANTES de qualquer tenant context existir** — o contexto só é setado *como consequência* de encontrar o token. Se `AutomationToken` fosse `TenantModel`, o lookup na `authenticate()` estouraria `TenantScopeViolation` (não há contexto ainda), forçando `all_objects` em todo lugar e derrotando o propósito do auto-scope.

Precedente do próprio projeto: o `User` (`accounts/models.py`) **também não** é `TenantModel` — é buscado por `email` fora de contexto, exatamente pelo mesmo motivo. `AutomationToken` segue o `User`: **`models.Model` puro**, com `user = ForeignKey(AUTH_USER_MODEL)` (o `User` já existe desde a 2.1, então FK real é idiomática aqui — a regra "UUIDField não-FK" da AD-12 vale para tabelas de *domínio* tenant-scoped, não para credenciais de auth). Consequências:
- Nenhum `register_isolation_case` para `AutomationToken` (o contrato de isolamento parametrizado cobre `TenantModel`s; este não é um).
- O admin lê a tabela inteira com `objects` normal (sem precisar de `all_objects`).
- O **isolamento que ele fornece** é *setar o contexto* para as queries de domínio que vierem depois (nos endpoints de 12.5/12.6), não ser tenant-scoped ele mesmo. É por isso que AC3 pede um teste de isolamento **do caminho** (contexto setado → query de domínio escopada), análogo ao `test_isolation`. [Source: core/models.py; accounts/models.py (User é plain model); architecture.md#AD-12, §6.7]

### Auth class — espelhar `TenantAwareJWTAuthentication` (o "meio contrato" com o middleware)

O padrão de tenant context em request tem **dois lados** que já existem e devem ser reusados exatamente:
1. **Auth class seta** o contexto e **stasha o `contextvars.Token`** em `request._request._tenant_context_token` (o `_request` é o `HttpRequest` cru, objeto **diferente** do `rest_framework.request.Request` que o DRF passa a `authenticate()` — stashar no wrapper vaza contexto entre requests; foi um bug real). [Source: core/authentication.py:38-44 e seu docstring]
2. **`TenantMiddleware` reseta** no `finally`, lendo `request._tenant_context_token` (`core/middleware.py`). Nada a mudar no middleware — ele já reseta qualquer token stashado, venha de JWT ou de token de automação.

> **Import de `current_user_id`:** importar de **`core.context`**, NÃO de `core.tenant`. `core.tenant` importa `core.exceptions`, que o Django resolve muito cedo (efeito colateral de `core.exceptions` importar `rest_framework.views`); importar `core.tenant` na auth class arrisca um `ImportError` circular. `core/authentication.py` já faz `from core.context import current_user_id` por essa razão exata — copiar. [Source: core/authentication.py:23-35, core/context.py]

### 🚨 401 vs 403 — `authenticate_header()` é obrigatório

O DRF só responde **401 Unauthorized** para falha de autenticação se **algum** authenticator define `authenticate_header()`; caso contrário, ele "domestica" para **403 Forbidden**. AC4 exige **401** para token revogado/inválido. Portanto `AutomationTokenAuthentication.authenticate_header(self, request)` **deve** retornar `"Bearer"`. Escopo insuficiente é caso **diferente** (autenticado, sem autorização) → **403** pela permissão `HasAutomationScope`. Não confundir os dois caminhos. [Source: DRF authentication docs; AC4]

### Escopo: autenticação vs autorização

A auth class valida **identidade** (hash + não-revogado) e para por aí — ela **não** conhece qual escopo um endpoint arbitrário exige (uma auth class é global à requisição, não à view). A checagem de **escopo** é **autorização per-view**: a permissão `HasAutomationScope` lê o escopo exigido declarado pela própria view e o compara com `request.auth.scopes`. Assim, o texto da AC ("a auth class valida hash + não-revogado + escopo") se realiza pelo **par auth + permission entregues juntos** no app `automation`, com o escopo checado no ponto onde a view declara sua exigência. Esta divisão é idiomática no DRF e **testável agora** (permissão contra view stub), sem depender dos endpoints reais (12.5/12.6). Precedente institucional: resolver ambiguidade em favor do documento mais específico + código existente, documentando inline (Retro Épico 4 #3; Stories 12.2/12.3). [Source: architecture.md#AD-19 item 2; AC3/AC4]

### Admin: revelar o pleno uma vez (padrão GitHub PAT)

O operador **não** digita `token_hash`/`token_prefix` — eles são derivados na geração. Fluxo recomendado:
- Form de "add" expõe só `user`, `name`, `scopes` (widget de múltipla escolha sobre as constantes de escopo).
- `AutomationTokenAdmin.save_model(request, obj, form, change)`: se `change is False` (criação), gerar via o helper `issue()` (que já persiste), stashar o pleno em `request` (ou num atributo) e **exibir** com `self.message_user(request, f"Token: {pleno} — copie agora, não será exibido novamente", level=messages.WARNING)`. Em edição (`change is True`), **nunca** regenerar.
- Cuidado para o `save_model` não salvar duas vezes de forma conflitante — se usar `issue()` (que faz o `create`), garanta que o objeto do admin não seja re-salvo com hash vazio. Uma abordagem limpa: sobrescrever `save_model` para chamar `issue()` e atribuir os campos derivados ao `obj` do admin, ou usar `response_add` para injetar a mensagem. Escolher **uma** e documentar. **O pleno nunca é logado** (só `message_user` na UI da sessão do admin). [Source: architecture.md#AD-19 item 1; admin precedent: braindump/admin.py, accounts/admin.py]

### Geração do segredo — `secrets` + `hashlib`

- Não há precedente de `secrets`/`hashlib` no backend ainda (senhas usam `AbstractBaseUser.set_password`/`check_password` — Argon/PBKDF2 do Django). Para o token de automação, um **hash rápido determinístico** (SHA-256) é o correto: precisamos de **lookup por igualdade** do hash (`filter(token_hash=...)`), e o segredo é de alta entropia (`token_urlsafe(32)` ≈ 256 bits), então SHA-256 sem salt é o padrão da indústria para PATs (GitHub/HA). **Não** use `make_password` (salt aleatório impede lookup por igualdade). [Source: architecture.md#AD-19 item 1 "SHA-256"]
- Formato: `full = "bujo_" + secrets.token_urlsafe(32)`; `token_hash = hashlib.sha256(full.encode()).hexdigest()` (64 chars hex); `token_prefix = full[:12]`.

### Lição recorrente: migration na branch Neon e2e (AC1)

Bug recorrente do projeto (7.1, 7.2, 11.1, 12.2): as branches Neon `dev` e `e2e` são independentes; uma migration pendente na `e2e` trava toda a suíte Playwright. Aplicar **antes** de rodar E2E:
```
cd backend && DJANGO_SETTINGS_MODULE=config.settings.e2e uv run python manage.py migrate
```
Runbook completo em `docs/e2e-neon-reset.md §2`. Requer `backend/.env.e2e` com a connection string da branch `e2e`. Se as credenciais não estiverem nesta sessão, o passo é **manual antes do Playwright** — registrar como pendência (não bloqueia o pytest, que roda em Postgres LOCAL). Nesta story **não há E2E novo** (sem UI), então o gate real é o pytest; ainda assim a migration deve ser aplicada à `e2e` para não travar suítes futuras. [Source: MEMORY [[apply-new-migration-to-neon-e2e-branch-before-e2e]]; 12-2 Debug Log; config/settings/e2e.py]

### Ambiente e comandos (backend)

- **pytest** roda em **Postgres LOCAL** (docker-compose), não Neon: `docker compose up -d db` e então `cd backend && uv run pytest`. `config/settings/test.py` já aponta para `postgres://postgres:postgres@localhost:5432/hmmb_test` via `setdefault`. Rodar a **suíte inteira** (gate cross-app; barato em Postgres local). [Source: config/settings/test.py; MEMORY [[ci-runs-full-pytest-suite-on-push]], [[epic8-cross-app-regression-gate-deferred]]]
- **Lint/format:** `uv run ruff check .` + `uv run ruff format --check .`. **Import-linter:** `uv run lint-imports` (regra de porta do `core`). [Source: architecture.md §7.4 CI (L1664)]
- **Migrations:** `uv run python manage.py makemigrations automation` / `migrate`.

### Padrões de teste a espelhar

- **Auth por chamada direta** (sem endpoint): `core/tests/test_authentication.py` chama `TenantAwareJWTAuthentication().authenticate(Request(raw_request))` e assere `current_user_id.get() == user.id`, resetando o contextvar no fim. **Copie esse esqueleto** para `AutomationTokenAuthentication` (é o precedente exato para "auth class sem endpoint"). [Source: core/tests/test_authentication.py]
- **Isolamento:** o padrão de `test_isolation` (`with tenant_context(user): Model.objects.create(...)` + asserts de `count()` por tenant) — mas aqui o contexto é setado **pela auth class**, não por `tenant_context`. Prove que, após `authenticate()` setar o contexto do dono, uma query de domínio (ex.: `BrainDumpItem.objects.count()`) escopa correto. [Source: core/tests/test_isolation.py]
- **Factories:** `DjangoModelFactory` com `class Params` + `SelfAttribute` é o padrão para `user_id` UUID em `TenantModel`; aqui, como `AutomationToken` tem **FK real** `user`, use `user = factory.SubFactory(UserFactory)` diretamente (mais simples). [Source: braindump/tests/factories.py, accounts/tests/factories.py]

### Stack (versões)

Django 5.2, DRF (auth via `BaseAuthentication`), `djangorestframework-simplejwt` (só JWT de usuário — **não** reusar para automação, AD-19), `django-environ`, `drf-spectacular`, `django-filter`, `djangorestframework-camel-case`. Python via `uv`. `scopes` como `JSONField` nativo do Django (Postgres JSONB). [Source: config/settings/base.py]

### Inteligência das stories anteriores (12.1, 12.2, 12.3)

- **12.2** (backend, `waiting_on`): estabeleceu o ritual da migration na branch Neon e2e e o gate de suíte pytest completa em Postgres LOCAL. Reusar. Também consolidou "resolver ambiguidade em favor do documento mais específico + código existente, documentando inline". [Source: 12-2-flag-waiting-on-no-backend.md]
- **12.1/12.2** provam que services de domínio + `tenant_context` + asserts é o padrão de teste backend do projeto.
- **12.3** (frontend, manifest): sem sobreposição técnica direta (esta é 100% backend), mas confirmou a disciplina de **não** antecipar consumidores futuros (o registro tinha campos reservados sem consumidor; aqui, a auth class é entregue sem endpoint consumidor — mesma disciplina, o consumo é 12.5/12.6).

### Project Structure Notes

- **Novo app**: `backend/automation/` (`__init__.py`, `apps.py`, `models.py`, `admin.py`, `authentication.py`, `permissions.py`, `migrations/`, `tests/`). Sem `urls.py`/`views.py` nesta fatia. `automation` é **app de composição** (paralelo backend do `pages/` do frontend): pode importar services de apps de domínio (relevante em 12.5/12.6), sem violar a regra de porta do `core`. [Source: architecture.md#AD-19 item 4, §7.2]
- **Modificado**: `config/settings/base.py` — `"automation"` em `INSTALLED_APPS` (bloco Local). **Nenhuma** mudança em `DEFAULT_AUTHENTICATION_CLASSES` (a auth class é opt-in per-view). **Nenhuma** rota em `config/urls.py` nesta fatia (endpoints são 12.5/12.6).
- **Sem** mudança em frontend, sem `types.gen.ts` novo (sem endpoint), sem mudança de contrato OpenAPI.
- Variância vs. o "Schema" da AD-19: o DDL da AD mostra `user_id`; a decisão desta story é usar **FK `user`** (coluna resultante `user_id`) por `AutomationToken` ser plain model (não `TenantModel`) — mesma coluna física, com a conveniência de `token.user`. Documentado em Dev Notes › "Por que NÃO herda `TenantModel`".

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-12 / Story-12.4 (L1993-2018)] — AC-fonte
- [Source: _bmad-output/planning-artifacts/epics.md#Story-12.5 (L2020-2044), #Story-12.6 (L2046-2061)] — consumidores da auth class (endpoints)
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-19 (L871-904)] — `AutomationToken`, auth class dedicada, escopos, schema, casos-âncora
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-12 (L680), §6.7 (L1436-1444), §6.9/6.10 (L1456-1536)] — isolamento multi-tenant, fail-closed, referência de tenant_context/manager
- [Source: backend/core/authentication.py, backend/core/middleware.py, backend/core/context.py] — padrão de auth que seta contexto + middleware que reseta (espelhar)
- [Source: backend/core/tests/test_authentication.py, backend/core/tests/test_isolation.py] — padrões de teste a espelhar
- [Source: backend/accounts/models.py (User é plain model), backend/accounts/admin.py, backend/braindump/admin.py] — precedente de credencial não-TenantModel e admin de operador
- [Source: backend/config/settings/base.py] — INSTALLED_APPS, REST_FRAMEWORK, SIMPLE_JWT
- [Source: docs/e2e-neon-reset.md §2] — aplicar migration à branch Neon e2e antes do Playwright
- [Source: MEMORY [[apply-new-migration-to-neon-e2e-branch-before-e2e]], [[ci-runs-full-pytest-suite-on-push]], [[dev-branch-homologation-workflow]]]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, dev-story workflow)

### Debug Log References

- **Guardrail temporal (AD-04 / §6.9) vs. `timezone.now()`:** a primeira execução da suíte completa falhou em `core/tests/test_guardrails.py::test_no_bare_date_today_outside_calendar` — o scanner AST proíbe `timezone.now()` direto em **todo** módulo de produção fora de `core/calendar.py`, sem distinguir "hoje de negócio" de timestamp de auditoria. A Dev Note da Task 4 sugeria `django.utils.timezone.now()` para `last_used_at` (correto **semanticamente** — não é "hoje do usuário"), mas o **mecanismo** precisa rotear por `core.calendar.now()` (a fonte única de "agora" de auditoria, mesma usada por `medication_day_entries.confirmed_at`). Reconciliação institucionalizada (favorecer o código existente + documentar inline): trocado `timezone.now()` → `core.calendar.now()` em `authentication.py` (`last_used_at`) e `admin.py` (ação de revogar). Suíte reexecutada verde.
- **Neon e2e:** `.env.e2e` presente nesta sessão → migration `automation.0001_initial` aplicada à branch Neon `e2e` (`DJANGO_SETTINGS_MODULE=config.settings.e2e ... migrate automation` → OK). Sem E2E novo nesta story (backend-only, sem UI), mas a migration foi aplicada para não travar suítes Playwright futuras (lição recorrente 7.1/7.2/11.1/12.2).

### Completion Notes List

- **App novo `automation`** (composição, AD-19): entrega só a espinha de auth — `AutomationToken` (plain `models.Model`, **não** `TenantModel`), admin de operador, auth class dedicada e permissão de escopo. **Sem** endpoints HTTP (são 12.5/12.6), **sem** `urls.py`/`views.py`/`serializers.py`.
- **AC1:** `AutomationToken.issue()` gera `bujo_<token_urlsafe(32)>`, persiste só `token_hash` (SHA-256, 64 hex) + `token_prefix` (12 chars), retorna `(instance, full_plaintext)`; o pleno só existe em memória (nunca salvo/logado). Migration `0001_initial` = uma única `CreateModel` limpa; aplicada ao Postgres LOCAL (pytest) **e** à branch Neon e2e.
- **AC2:** `AutomationTokenAdmin` — criação via form custom (`user`/`name`/`scopes` por checkboxes; operador nunca digita hash/prefix); `save_model` chama `issue()` na criação e revela o pleno **uma única vez** via `message_user(WARNING)` (nunca logado); edição nunca regenera; revogar via ação de admin + campo `revoked_at` editável. Não usa `all_objects` (não é `TenantModel`).
- **AC3:** `AutomationTokenAuthentication` (`BaseAuthentication`) — valida hash + não-revogado fora do tenant scope, carimba `last_used_at`, seta o tenant context com o dono (`current_user_id.set(token.user_id)` importado de `core.context`, stash em `request._request._tenant_context_token`); **não** está em `DEFAULT_AUTHENTICATION_CLASSES` (opt-in per-view). Teste de isolamento prova que, no contexto setado pela auth, `BrainDumpItem.objects.count()` enxerga só os itens do dono.
- **AC4:** `authenticate_header()` → `"Bearer"` (garante 401, não 403, em falha de auth). Escopo insuficiente → 403 via `HasAutomationScope` (permissão per-view lendo `required_scopes`/`required_scope` da view vs. `request.auth.scopes`; fail-closed se `request.auth` não for um `AutomationToken`).
- **OpenAPI:** `manage.py spectacular` diff vs. `schema.yaml` commitado mostra **apenas** campos `waitingOn` (deriva pré-existente da Story 12.2, que deixou `schema.yaml` desatualizado) — **nenhuma** entrada atribuível a 12.4. Confirmado: zero endpoint/securityScheme novo. A deriva `waitingOn` é de 12.2 (fora do escopo desta story; não corrigida aqui).
- **Lint:** `ruff check automation/` e `ruff format --check automation/` limpos; `lint-imports` verde (regra de porta do `core` intacta). Nota: `ruff format --check .` (repo inteiro) reporta 48 arquivos pré-existentes em apps não tocados (`habits`/`health`/`medications`/`manage.py`) — deriva pré-existente, **não** introduzida por esta story.
- Contagem da suíte completa: **912 passed in 261.01s** (`cd backend && uv run pytest -q`; Postgres LOCAL, saída literal). Baseline pré-story: 892 coletados; +20 testes de `automation/` = 912.

### File List

**Novos (app `automation`):**
- `backend/automation/__init__.py`
- `backend/automation/apps.py`
- `backend/automation/models.py`
- `backend/automation/admin.py`
- `backend/automation/authentication.py`
- `backend/automation/permissions.py`
- `backend/automation/migrations/__init__.py`
- `backend/automation/migrations/0001_initial.py`
- `backend/automation/tests/__init__.py`
- `backend/automation/tests/factories.py`
- `backend/automation/tests/test_models.py`
- `backend/automation/tests/test_authentication.py`
- `backend/automation/tests/test_permissions.py`
- `backend/automation/tests/test_settings.py`
- `backend/automation/tests/test_admin.py`

**Modificados:**
- `backend/config/settings/base.py` — `"automation"` em `INSTALLED_APPS` (bloco Local). Nenhuma mudança em `DEFAULT_AUTHENTICATION_CLASSES`.
- `_bmad-output/implementation-artifacts/12-4-token-de-automacao-com-autenticacao-dedicada.md` — frontmatter `baseline_commit`, checkboxes, Dev Agent Record, Status.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status 12.4 → in-progress → review.

## Senior Developer Review (AI)

**Revisor:** Hugo · **Data:** 2026-07-23 · **Resultado:** ✅ Aprovado (Status → done)

Revisão adversarial automatizada (story-automator-review). Verificação executada, não só leitura:

- **Git × File List:** sem discrepâncias — os 15 arquivos novos do app `automation` + a modificação em `config/settings/base.py` batem com o `git status`. Nenhum arquivo alegado sem evidência, nenhuma mudança fora do File List.
- **AC1–AC4:** todas implementadas e cobertas por testes reais (não placeholders). O teste de isolamento (`test_context_set_by_auth_isolates_domain_query`) prova de fato o fail-closed: sem contexto setado, `BrainDumpItem.objects` levantaria `TenantScopeViolation` em vez de retornar 2.
- **Auditoria de tasks [x]:** cada uma confirmada no código — `core.calendar.now()` para `last_used_at`/revogação (guardrail temporal), `current_user_id` importado de `core.context`, stash em `request._request._tenant_context_token` (o `HttpRequest` cru), `authenticate_header()` → `"Bearer"` (garante 401).
- **Suíte/lint:** `pytest automation/ core/tests/test_guardrails.py` → **26 passed**; `ruff check`/`format` limpos; `lint-imports` → contrato do `core` KEPT; `schema.yaml` não modificado (zero deriva OpenAPI atribuível a 12.4).

**Observações LOW (não bloqueiam, sem correção):**
1. `HasAutomationScope` concede quando a view não declara escopo (`all([])` é vacuamente `True`) — comportamento **intencional e documentado**, com teste dedicado (`test_grants_when_view_requires_no_scope`); os endpoints 12.5/12.6 sempre declararão escopo.
2. O pleno transita pelo framework de `messages` (session-backed no admin) — condizente com o padrão GitHub-PAT exigido pela AC; nunca logado.

Nenhum achado CRITICAL/HIGH/MEDIUM → nada a auto-corrigir no código.

## Change Log

- 2026-07-23 — Review adversarial (story-automator-review): aprovado, Status → done. 26 testes de `automation/` verdes, lint/import-linter OK, sem deriva de schema; 2 observações LOW documentadas (sem correção).
- 2026-07-23 — Implementada a Story 12.4 (espinha de autenticação da Plataforma de Automação): app `automation` com `AutomationToken` (SHA-256, pleno exibido uma única vez), admin de operador, `AutomationTokenAuthentication` (seta tenant context AD-12, 401 via `authenticate_header`), permissão de escopo `HasAutomationScope` (403). Migration aplicada ao Postgres LOCAL e à branch Neon e2e. Suíte completa verde.
