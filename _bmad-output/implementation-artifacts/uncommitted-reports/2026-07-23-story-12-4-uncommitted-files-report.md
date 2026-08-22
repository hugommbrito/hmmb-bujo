# Explicação dos arquivos não commitados — Story 12.4: Token de automação (`AutomationToken`) com autenticação dedicada

## Visão geral

A Story 12.4 entrega a **infraestrutura de autenticação por token de automação** (AD-19, FR-3.1):
um novo app Django `automation` com o modelo `AutomationToken` (token de longa duração, escopado,
revogável), gestão via **Django admin** (com revelação única do segredo — padrão GitHub PAT), uma
**auth class DRF dedicada** que valida o token por hash e **seta o tenant context** (AD-12), e uma
**permissão per-view** que faz a autorização por escopo (401 vs 403). **Backend-only, sem endpoint
HTTP e sem UI** — os endpoints `POST /api/capture` e `GET /api/summary/today` que consomem esta auth
são das Stories 12.5/12.6; a gestão é via admin.

**Segurança:** o segredo pleno (`bujo_<token_urlsafe(32)>`) é gerado e exibido **uma única vez**;
só o `token_hash` (SHA-256, 64 hex) + `token_prefix` (12 chars) são persistidos — o pleno **nunca**
é armazenado nem logado. O modelo é `models.Model` **puro** (não `TenantModel`), porque o lookup por
hash roda **antes** de qualquer tenant context existir (o contexto é setado *como consequência* de
encontrar o token). Migration `0001_initial` aplicada ao Postgres LOCAL **e** à branch Neon e2e.

**Gate:** suíte backend **912 → +tests** verde; `automation/` **26 tests pass**; ruff limpo;
import-linter mantido (regra de porta do core intacta); sem drift em `schema.yaml`. Code review
adversarial: **0 High / 0 Medium**, 2 Low intencionais/documentados.

## Ordem lógica de funcionamento

1. **Planejamento/status** — story file + `sprint-status.yaml`.
2. **Config** — `config/settings/base.py`: registra o app `automation` em `INSTALLED_APPS`.
3. **App scaffold** — `automation/__init__.py`, `apps.py`.
4. **Modelo + migration** — `models.py` (AutomationToken, hash, issue, scopes) → `0001_initial.py`.
5. **Auth** — `authentication.py` (valida hash + seta tenant context + 401).
6. **Autorização** — `permissions.py` (escopo per-view + 403 + fail-closed).
7. **Admin** — `admin.py` (operador: criar com revelação única, identificar por prefixo, revogar).
8. **Testes** — `tests/` (models, authentication, permissions, admin, settings, factories).
9. **Artefato de testes + orquestração** — `test-summary.md`, `_bmad-output/story-automator/*`.

---

## 1. Planejamento/status

### `_bmad-output/implementation-artifacts/12-4-token-de-automacao-com-autenticacao-dedicada.md`
Story file (novo). 32 subtasks `[x]`; `Status: done`; Dev Agent Record com **912 passed** (dev) +
review (0 High/Medium, 2 Low), migration aplicada à Neon e2e.

### `_bmad-output/implementation-artifacts/sprint-status.yaml`
`12-4-...: backlog → done`.

---

## 2. Config

### `backend/config/settings/base.py`
**Alteração:** `+ "automation"` em `INSTALLED_APPS` (após `gratitude`). Habilita o app (models,
migrations, admin autodiscovery). 1 linha.

---

## 3. App scaffold

### `backend/automation/__init__.py` (vazio) · `backend/automation/apps.py`
`AutomationConfig` (`default_auto_field = BigAutoField`, `name = "automation"`). Sem
`urls.py`/`views.py`/`serializers.py` — não há endpoint HTTP nesta fatia.

---

## 4. Modelo e migration

### `backend/automation/models.py` (NOVO)
**Função geral** — Credencial de auth (não domínio). `models.Model` **puro** (não `TenantModel`).
**Blocos principais**
- `AutomationScope(TextChoices)`: `CAPTURE`/`SUMMARY` (escopos como lista JSONB de strings; sem enum
  nativo do Postgres, AD-01/§6.9). Aliases `SCOPE_CAPTURE`/`SCOPE_SUMMARY`.
- `hash_token(full)` → SHA-256 hex (64). Sem salt (lookup por igualdade; segredo de alta entropia —
  padrão PAT). **Não** `make_password` (salt impediria o lookup). [AD-19 item 1]
- `AutomationToken`: `id` UUID; `user` FK; `name`; `token_prefix` (12); `token_hash` (64, unique,
  db_index); `scopes` JSONB; `last_used_at`; `revoked_at`; `created_at`. `db_table="automation_tokens"`.
- `@classmethod issue(*, user, name, scopes) -> (instance, full)`: gera `bujo_<token_urlsafe(32)>`,
  persiste só hash+prefix, retorna o pleno **só em memória** (exibido uma vez, nunca salvo/logado).

### `backend/automation/migrations/0001_initial.py` (NOVO)
Uma única `CreateModel` limpa de `AutomationToken`. Aplicada ao Postgres LOCAL (pytest) **e** à
branch Neon e2e (lição recorrente 7.1/7.2/11.1/12.2).

---

## 5. Autenticação

### `backend/automation/authentication.py` (NOVO)
**`AutomationTokenAuthentication(BaseAuthentication)`** — opt-in **per-view** (NÃO em
`DEFAULT_AUTHENTICATION_CLASSES`).
- `authenticate()`: extrai `Authorization: Bearer <token>` (sem header desta classe → `None`, deixa
  outras auth decidirem); busca `AutomationToken.objects.filter(token_hash=hash_token(full)).first()`
  (**modelo puro** → `objects` sem fail-closed; roda **antes** do tenant context); não-encontrado →
  `AuthenticationFailed` (401); `revoked_at` setado → 401; válido → atualiza `last_used_at` (via
  `core.calendar.now()`, telemetria de infra) e **seta o tenant context**:
  `request._request._tenant_context_token = current_user_id.set(token.user_id)` (stash no `HttpRequest`
  cru, não no wrapper DRF — evita vazamento entre requests; o `TenantMiddleware` reseta no `finally`).
  Retorna `(token.user, token)` → `token` vira `request.auth`.
- **`authenticate_header()` → `"Bearer"`** (CRÍTICO, AC4): sem isto o DRF converteria a falha em 403;
  com isto, token revogado/inválido responde **401**.
- Import de `current_user_id` de **`core.context`** (não `core.tenant`) — evita import circular, como
  `core/authentication.py`.

---

## 6. Autorização

### `backend/automation/permissions.py` (NOVO)
**`HasAutomationScope(BasePermission)`** — autorização de **escopo per-view** (a auth class valida só
identidade). Lê os escopos exigidos da própria view (`required_scopes: list[str]` ou `required_scope: str`)
e compara com `request.auth.scopes`. Concede só se **todos** os escopos exigidos estiverem presentes.
**Fail-closed:** se `request.auth` não é um `AutomationToken` (view não usou a auth class), nega em vez
de estourar. Falta de escopo → `False` → **403** (autenticado, sem autorização) — distinto do 401.
As views 12.5/12.6 consumirão `required_scopes`.

---

## 7. Admin

### `backend/automation/admin.py` (NOVO)
`AutomationTokenAdmin`: `list_display` (id/user/name/prefix/scopes/last_used/revoked/created),
`search_fields` (prefix/name/user__email), `readonly_fields` (prefix/hash/last_used/created). Fluxo de
criação: operador informa user/name/scopes; ao salvar **novo**, gera o token via `issue()` e exibe o
**pleno uma única vez** via `messages`. Edição nunca regenera; **revogar** = setar `revoked_at`. Lê a
tabela inteira (modelo puro, sem fail-closed `objects`).

---

## 8. Testes

`backend/automation/tests/`: `factories.py` (AutomationTokenFactory), `test_models.py` (issue/hash/
prefix/one-time-plaintext), `test_authentication.py` (hash lookup, revogado→401, tenant context setado
+ isolamento cross-tenant análogo a `test_isolation`, header→401), `test_permissions.py` (escopo AND,
fail-closed, 403), `test_admin.py` (revelação única, revogação), `test_settings.py` (app registrado).
Execução: `automation/` **26 tests pass**; suíte completa **912 passed** (dev) + gaps de QA. ruff limpo.

---

## 9. Artefato de testes + orquestração

- `_bmad-output/implementation-artifacts/tests/test-summary.md` — seção da 12.4 (sem E2E — backend infra
  sem UI; +4 pytest de gaps: revogação AC2, escopo-AND AC4).
- `_bmad-output/story-automator/orchestration-12-*.md` — documento de estado da run.

---

## Nota

Nenhum comportamento de código-fonte foi alterado por este relatório (documentação apenas). O código de
produção da story vive em `backend/automation/` (models, authentication, permissions, admin, apps,
migration) + o registro em `config/settings/base.py`.
