---
title: 'DW-33/DW-34/DW-35: rotas públicas que 401am e os guards que não veem isso'
type: 'bugfix'
created: '2026-08-04'
status: 'in-review'
baseline_revision: '825c4abcfa7efc240d147e930a407470c64c376f'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [multiple-goals, oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Três guards do backend não cobrem o que afirmam cobrir. (DW-34) `SPECTACULAR_SETTINGS` não define `SERVE_AUTHENTICATION`, então `/api/schema/` e `/api/schema/swagger-ui/` — registradas SEM gate de `DEBUG`, logo valem em produção — herdam o `TenantAwareJWTAuthentication` global e devolvem **401 com um `Authorization` inválido presente**, apesar de 200 sem header (reproduzido nesta varredura nas duas rotas). (DW-35) É a **terceira** instância da mesma classe: `@api_view` aparece 2x em `backend/` e ambas precisaram do mesmo `@authentication_classes([])` em DWs consecutivas — 100% de taxa de defeito, corrigida um decorator por vez, sem nada impedindo a quarta. (DW-33) O contrato `core must not import domain apps (port rule)` omite `automation`, o único app local de `INSTALLED_APPS` que ficou fora, então um `core -> automation` passaria o gate verde.

**Approach:** Fechar o vazamento em `SPECTACULAR_SETTINGS` com `SERVE_AUTHENTICATION: []` (sem tocar nos defaults globais de DRF), cobrir as duas rotas com o espelho de `test_health_com_authorization_header_invalido_retorna_200`, trocar o patch-por-decorator por um **guard sistêmico**: um meta-teste que caminha o `ROOT_URLCONF`, **deriva** em runtime o conjunto de rotas DRF alcançáveis sem credencial e afirma que toda rota desse conjunto continua não-401 diante de um bearer inválido — e acrescentar `automation` ao `forbidden_modules`.

## Boundaries & Constraints

**Always:**
- `SERVE_AUTHENTICATION: []` entra **só** em `SPECTACULAR_SETTINGS`. `DEFAULT_AUTHENTICATION_CLASSES` e `DEFAULT_PERMISSION_CLASSES` ficam intocados.
- O conjunto de rotas sem-credencial do meta-teste é **derivado do `ROOT_URLCONF` em runtime**. Nenhuma lista de paths, nomes de rota ou nomes de view hardcoded — senão o guard apodrece na próxima rota nova, que é exatamente o modo de falha que ele existe para cobrir.
- O meta-teste **falha alto** quando não consegue classificar uma rota DRF (converter desconhecido, kwarg sem tipo, exceção inesperada). Nunca pular em silêncio.
- O meta-teste afirma não-vacuidade: conjunto público **e** conjunto protegido não-vazios. Hoje são 6 e 69; as 69 protegidas dependem do autenticador global e **devem continuar 401ando**.
- `forbidden_modules` ganha exatamente `automation`. A ausência de `accounts` é **deliberada e documentada** (`core -> accounts` é permitido) — não adicionar.

**Block If:**
- `SERVE_AUTHENTICATION: []` não zerar o 401 (ou seja, se a resolução em `drf_spectacular` diferir do verificado nesta spec). Não escalar para override de settings globais de DRF nem para subclassar/embrulhar as views de schema sem decisão humana.
- `uv run lint-imports` quebrar depois da linha nova: isso revelaria um `core -> automation` real, que é decisão de arquitetura, não conserto de contrato.

**Never:**
- Não criar o helper `@public_api_view` (a alternativa citada na DW-35): mexeria em 2 views por estética sem fechar a classe — as rotas de schema são de terceiros e não passam por decorator nosso.
- Não gatear as rotas de schema por `DEBUG`, não removê-las, não renomeá-las.
- Não alterar nenhuma das 69 rotas protegidas nem os testes de auth existentes.
- Não editar o ledger de deferred work (`.bmad-loop/`), nem promover/fechar entradas.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Schema anônimo | `GET /api/schema/` sem header | 200, corpo OpenAPI (inalterado) | No error expected |
| Schema com bearer podre | `GET /api/schema/` + `Authorization: Bearer garbage` | **200** (hoje 401 `{"detail": "Given token not valid..."}`) | Header ignorado, nenhum autenticador roda |
| Swagger-UI anônimo | `GET /api/schema/swagger-ui/` sem header | 200, HTML (sem teste hoje) | No error expected |
| Swagger-UI com bearer podre | `GET /api/schema/swagger-ui/` + bearer inválido | **200** (hoje 401) | Header ignorado |
| Rota protegida | `GET /api/bujo/tasks/` sem header | 401 (inalterado) | 401 é o comportamento correto |
| Meta-teste, rota nova pública sem `authentication_classes([])` | rota anônima 200 e bearer podre 401 | Teste FALHA nomeando a rota | Mensagem cita a rota e o par de status |
| Meta-teste, converter desconhecido | rota DRF com kwarg de tipo não mapeado | Teste FALHA como não-classificável | Mensagem manda mapear o converter |

</intent-contract>

## Code Map

- `backend/config/settings/base.py:175-216` -- `SPECTACULAR_SETTINGS`. Falta a chave `SERVE_AUTHENTICATION`; adicionar `[]` junto de `SERVE_INCLUDE_SCHEMA`/`COMPONENT_SPLIT_REQUEST` (linhas 179-180). `REST_FRAMEWORK` está em `:164-172` — **read-only** nesta spec.
- `backend/config/urls.py:31-37` -- `SpectacularAPIView` e `SpectacularSwaggerView` registradas sem gate de `DEBUG`. **Read-only**: as rotas ficam como estão.
- `backend/.venv/.../drf_spectacular/views.py:38-41` -- **evidência (read-only)**: `if spectacular_settings.SERVE_AUTHENTICATION is not None:` → o teste é `is not None`, **não** truthiness, então `[]` realmente zera. `AUTHENTICATION_CLASSES` é resolvido no import do módulo e usado no corpo de `SpectacularAPIView` (`:55`) **e** de `SpectacularSwaggerView` (`:125`) — uma chave conserta as duas rotas. Congelado no import ⇒ `override_settings` não testa isto.
- `backend/core/tests/test_api_contract.py:63-93` -- os 3 testes de schema. Nenhum manda `Authorization`; `swagger-ui` não tem teste nenhum. Os novos testes entram aqui.
- `backend/core/tests/test_health.py:29-40` -- `test_health_com_authorization_header_invalido_retorna_200`, o espelho a copiar (DW-24). `:43-65` mostra o padrão de prova mecânica (espiar `_tenant_context_token`).
- `backend/core/tests/test_guardrails.py` -- casa do guard novo. Precedente de meta-teste por AST/registry: `test_no_bare_date_today_outside_calendar:55` (walk de AST) e `test_tenant_models_use_scoped_default_manager:40` (walk do app registry). O docstring do módulo (`:14-15`) já fala da regra de porta — atualizar ao acrescentar o guard.
- `backend/core/views.py:10-34` e `backend/accounts/views.py:91-94` -- as 2 instâncias já corrigidas (DW-24 / DW-15). **Read-only**: servem de referência do mecanismo, não mudam.
- `backend/pyproject.toml:52-63` -- `[tool.importlinter]` + o contrato da regra de porta. O comentário `:57-58` manda literalmente adicionar cada app de domínio novo. `forbidden_modules` (`:63`) recebe `"automation"`.
- `backend/config/settings/base.py:47-55` -- `INSTALLED_APPS` locais: `core, accounts, bujo, braindump, habits, health, medications, gratitude, automation`. **Verificado**: só `automation` falta no contrato.
- `backend/automation/views.py:34,103` -- as **únicas** 2 views com autenticador próprio (`AutomationTokenAuthentication`); 401am sem credencial, logo caem no conjunto protegido. **Read-only**.
- `backend/conftest.py:31-33` -- fixture autouse dá acesso a DB a **todo** teste; o meta-teste não precisa de `@pytest.mark.django_db` (as 2 rotas de automation consultam `automation_tokens`).
- **Verificado por grep:** `core/` não importa `automation` (só uma menção em docstring, `core/authentication.py:125`); nenhum teste referencia `get_resolver`/`url_patterns` (só `core/tests/test_exceptions.py:489-494`, que faz `override_settings(ROOT_URLCONF=...)` para outro fim); não existe `public_api_view`; nenhuma rota usa `re_path`.

## Tasks & Acceptance

**Execution:**
- `backend/config/settings/base.py` -- acrescentar `"SERVE_AUTHENTICATION": []` a `SPECTACULAR_SETTINGS`, com comentário explicando que sem a chave as views de schema caem em `DEFAULT_AUTHENTICATION_CLASSES` e 401am com header velho (DW-34), e que `[]` funciona porque o teste na lib é `is not None` -- fecha o vazamento nas duas rotas de uma vez, sem tocar nos defaults globais.
- `backend/core/tests/test_api_contract.py` -- acrescentar 4 testes: (a) `swagger-ui` anônimo → 200 (baseline que não existia); (b) `/api/schema/` com `Authorization: Bearer garbage` → 200; (c) `swagger-ui` com bearer inválido → 200; (d) prova mecânica de que `SpectacularAPIView.authentication_classes` e `SpectacularSwaggerView.authentication_classes` são `[]` -- (b)/(c) são o espelho pedido do teste de health; (d) pina o atributo resolvido no import, que é o que de fato carrega o conserto.
- `backend/core/tests/test_guardrails.py` -- acrescentar o guard de rotas públicas: helper que caminha recursivamente o `ROOT_URLCONF` (`get_resolver()`, `URLResolver`/`URLPattern`), filtra rotas DRF por `issubclass(getattr(callback, "cls", None), APIView)`, monta kwargs dummy a partir de `pattern.converters`, sonda cada rota anônima e com bearer inválido via `APIRequestFactory`, classifica em público/protegido/não-classificável e afirma o contrato + a não-vacuidade. Atualizar o docstring do módulo -- fecha a classe inteira da DW-35 em vez de esperar a quarta instância.
- `backend/pyproject.toml` -- acrescentar `"automation"` a `forbidden_modules` do contrato da regra de porta -- única omissão real entre os apps locais; gate segue verde (`core` não importa `automation` hoje).

**Acceptance Criteria:**
- Dado que `SPECTACULAR_SETTINGS` declara `SERVE_AUTHENTICATION: []`, quando `GET /api/schema/` e `GET /api/schema/swagger-ui/` recebem `Authorization: Bearer garbage`, então ambas devolvem 200 em vez de 401, e continuam 200 sem header nenhum.
- Dado o guard novo em `test_guardrails.py`, quando ele caminha o `ROOT_URLCONF` e deriva o conjunto de rotas DRF alcançáveis sem credencial, então toda rota desse conjunto responde não-401 diante de um bearer inválido, e o teste falha nomeando a rota infratora quando alguma responde 401.
- Dado o mesmo guard, quando o conjunto derivado de rotas públicas ou o de rotas protegidas fica vazio, ou quando alguma rota DRF não pode ser classificada, então o teste falha com mensagem explícita — nunca passa vacuamente.
- Dado o guard e `SERVE_AUTHENTICATION: []` revertido em `base.py` (mutação manual), quando o guard roda, então ele falha nomeando `api/schema/` e `api/schema/swagger-ui/` — prova de que ele morde.
- Dado `backend/pyproject.toml` com `automation` em `forbidden_modules`, quando `uv run lint-imports` roda, então sai `Contracts: 1 kept, 0 broken`.
- Dado o backend inteiro, quando `uv run pytest` e `uv run ruff check .` rodam, então zero falhas: nenhum teste de auth existente muda de resultado e as 69 rotas protegidas continuam 401ando.

## Spec Change Log

## Review Triage Log

## Design Notes

**Por que a sonda com `GET` basta, inclusive em rotas POST-only.** `APIView.dispatch` chama `self.initial(request)` — autenticação + permissões — **antes** de resolver o handler do método. Logo um `GET` numa rota protegida POST-only dá 401 (auth roda primeiro), e numa rota pública dá 405. Discriminar 401 de 405 é precisamente o sinal que o guard precisa: `signup`, `token` e `token/refresh` aparecem como públicas com 405/405, e uma regressão que reintroduzisse o autenticador global as viraria 405→401.

**Por que chamar o callable direto, e não o `APIClient`.** `APIRequestFactory` + `callback(request, **kwargs)` dispensa construir URLs concretas: os kwargs saem de `pattern.converters` (hoje só `pk`, `UUIDConverter`, em 22 rotas). Um pk que não existe é irrelevante — em rota protegida o 401 acontece antes de `get_object()`. Converter fora do mapa dummy ⇒ **não-classificável** ⇒ falha com mensagem mandando mapeá-lo (é assim que o guard evita apodrecer).

**Por que filtrar por `.cls` e não por prefixo `api/`.** O `ROOT_URLCONF` tem 232 rotas: 77 DRF e 155 do admin do Django, que nem 401am (redirecionam) e só fariam ruído. `getattr(callback, "cls", None)` é setado por `APIView.as_view()` e por `@api_view` — filtro **estrutural**, não uma allowlist de paths.

Núcleo medido hoje (77 DRF → 6 públicas, 71 protegidas, 0 não-classificáveis). Nota: os "69" citados em Boundaries vêm de uma sonda feita FORA do pytest, sem banco, onde as 2 rotas de `automation` estouraram em `automation_tokens does not exist` e caíram como não-classificáveis; com banco elas 401am e entram nas protegidas, fechando 6 + 71 = 77.

```python
for path, entry in _walk(get_resolver()):          # URLResolver → recursa; URLPattern → yield
    cls = getattr(entry.callback, "cls", None)
    if not (isinstance(cls, type) and issubclass(cls, APIView)):
        continue                                    # admin & cia: não é superfície DRF
    kwargs = _dummy_kwargs(entry.pattern)           # converter desconhecido → não-classificável
    anon = entry.callback(factory.get("/" + path), **kwargs)
    if anon.status_code == 401:
        protected.append(path); continue            # depende do autenticador global: correto
    bad = entry.callback(factory.get("/" + path, HTTP_AUTHORIZATION="Bearer garbage"), **kwargs)
    if bad.status_code == 401:
        violations.append(f"{path} ({cls.__name__}): anon={anon.status_code} bad-bearer=401")
```

**Pegadinha do congelamento no import.** `drf_spectacular/views.py:38-41` resolve `AUTHENTICATION_CLASSES` no import do módulo, antes de qualquer teste rodar. Então o conserto **tem** de morar em `base.py` (não em `override_settings`), e o teste (d) observa o atributo já resolvido da classe.

## Verification

**Commands:**
- `cd backend && uv run pytest core/tests/test_api_contract.py core/tests/test_guardrails.py core/tests/test_health.py -q` -- expected: tudo verde, incluindo os 4 testes novos de contrato e o guard novo.
- `cd backend && uv run pytest -q` -- expected: suíte cheia verde (gate cross-app; Postgres local via `docker compose up -d db`).
- `cd backend && uv run lint-imports` -- expected: `Contracts: 1 kept, 0 broken`, e o contrato agora lista `automation`.
- `cd backend && uv run ruff check .` -- expected: sem violações.
- `cd backend && uv run python manage.py spectacular --file /tmp/schema-check.yaml && diff /tmp/schema-check.yaml ../schema.yaml` -- expected: sem diff (`SERVE_AUTHENTICATION` não altera o schema gerado; o CI faz essa comparação).

**Manual checks (if no CLI):**
- Mutação 1: comentar `"SERVE_AUTHENTICATION": []` em `base.py` → o guard de `test_guardrails.py` **e** os testes (b)/(c) de `test_api_contract.py` devem falhar nomeando `api/schema/` e `api/schema/swagger-ui/`. Restaurar em seguida.
- Mutação 2: remover temporariamente `@authentication_classes([])` de `core/views.py::health` → o guard deve falhar nomeando `api/health/` (prova de que ele cobre a classe, não só as rotas de schema). Restaurar em seguida.
