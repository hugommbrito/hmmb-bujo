---
title: 'DW-24/DW-25: health público com Authorization inválido + 401 em refresh de usuário apagado'
type: 'bugfix'
created: '2026-08-03'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: 'd768310f03cbfafcc30bf108b83ec97a656ec538'
final_revision: '3f0c700996b0d6acfe9bef92005e1daf7ca15ac0'
context: []
warnings: ['multiple-goals', 'oversized']
deferred:
  - summary: >-
      `/api/schema/` e `/api/schema/swagger-ui/` têm exatamente a mesma classe de bug que a
      DW-24 corrigiu no health: permitem acesso anônimo (`SERVE_PERMISSIONS` = AllowAny) mas
      herdam o autenticador JWT global, então um `Authorization` header velho/corrompido faz
      as duas rotas 401arem em vez de servirem o schema.
    evidence: |-
      Achado pela verification-gap review e pelo edge-case-hunter (2026-08-03), confirmado
      empiricamente por mim nesta pass: `GET /api/schema/` sem header -> 200; com
      `Authorization: Bearer garbage` -> 401 `{"detail": "Given token not valid for any token
      type", ...}`. `GET /api/schema/swagger-ui/` -> 200 sem header, 401 com o header
      inválido. (Um reviewer alegou 500 no swagger-ui por InvalidToken escapando durante o
      render do template; NÃO reproduziu no meu probe — o que medi foi 401 nas duas.)
      Causa: `drf_spectacular/settings.py` tem `SERVE_AUTHENTICATION = None`, que faz as
      views caírem em `api_settings.DEFAULT_AUTHENTICATION_CLASSES`, e
      `SPECTACULAR_SETTINGS` em `config/settings/base.py` não sobrescreve a chave. As rotas
      são registradas em `config/urls.py:32-36` sem gate de DEBUG, logo valem em produção
      também. Fora do escopo desta bundle: o intent e o ledger da DW-24 nomeiam só
      `backend/core/views.py (health)`. Correção provável sem tocar settings globais:
      `SPECTACULAR_SETTINGS["SERVE_AUTHENTICATION"] = []`. Nenhum dos 3 testes de
      `core/tests/test_api_contract.py:65-93` envia `Authorization`, e o step de schema do CI
      usa `manage.py spectacular` (management command), então nada no CI exercita esse
      caminho HTTP.
    location: >-
      backend/config/settings/base.py (SPECTACULAR_SETTINGS) — rotas em backend/config/urls.py:32-36
    severity: medium
  - summary: >-
      Nada impede a próxima recorrência do padrão `@api_view` + `AllowAny` sem
      `authentication_classes=[]` — as duas únicas function-based views do repo tiveram o bug
      (signup na DW-15, health na DW-24, 100% de taxa de defeito) e as rotas de schema acima
      são uma terceira instância da mesma classe, mas cada correção foi um patch pontual de
      decorator.
    evidence: |-
      Achado pelo blind-hunter (2026-08-03). `@api_view` aparece exatamente 2x em `backend/`
      (`accounts/views.py:79`, `core/views.py:11`) e ambas precisaram do mesmo one-liner, em
      DWs consecutivas. Um guarda sistêmico barato fecharia a classe inteira: um meta-teste
      caminhando pelo URLconf e afirmando que toda view com `AllowAny` tem
      `authentication_classes` vazio, ou um helper compartilhado `@public_api_view`.
      Deliberadamente fora do escopo: o intent da DW-24 pede explicitamente "the same
      one-line @authentication_classes([]) pattern", e o spec proíbe tocar
      `DEFAULT_AUTHENTICATION_CLASSES`/`DEFAULT_PERMISSION_CLASSES` globais — então o guarda é
      trabalho separado, não parte desta bundle.
    location: >-
      backend/core/tests/ (meta-teste ausente) — instâncias em backend/accounts/views.py:79 e backend/core/views.py:11
    severity: medium
  - summary: >-
      O interceptor de 401 do frontend (`client.ts`) não tem guarda de `_retry`: ele
      reenvia a request original via `client(originalRequest)`, que passa pelo MESMO
      interceptor, então um endpoint que 401e deterministicamente enquanto o refresh continua
      funcionando entra em loop ilimitado de refresh+retry.
    evidence: |-
      Achado pelo blind-hunter (2026-08-03); confirmado por mim lendo
      `frontend/src/api/client.ts:25-59` — só há early-return para a própria rota de refresh,
      nenhuma marca de tentativa na request replayada. Contraria a própria regra do
      ARCHITECTURE-SPINE ("401 concorrentes aguardam e fazem retry 1x"), então é desvio
      pré-existente de arquitetura no frontend, não algo introduzido aqui. O blind-hunter
      alegou que a DW-25 torna isso alcançável (um `User.DoesNotExist` escapando de um
      endpoint qualquer virou 401 em vez de 500); verifiquei que o gatilho NÃO existe hoje:
      `grep` por `User.objects.get`/`get_user_model().objects.get` fora de `.venv` e de
      `tests/` não retorna nenhum call site em `backend/`, e o único produtor real dessa
      exceção é o `TokenRefreshSerializer` do simplejwt — cuja rota é justamente a que o
      interceptor já trata com early-return. Latente, não vivo.
    location: >-
      frontend/src/api/client.ts:25-59
    severity: medium
  - summary: >-
      `JWTAuthentication.get_user` do simplejwt distingue usuário apagado
      (`code="user_not_found"`) de desativado (`code="user_inactive"`) — mensagem E
      código diferentes — em TODA rota autenticada, anulando fora do refresh a
      indistinguibilidade que a DW-25 construiu dentro dele.
    evidence: |-
      Achado pelo blind-hunter (2026-08-03), confirmado por mim lendo o simplejwt
      instalado (`authentication.py:120-139`): o ramo `DoesNotExist` levanta
      `AuthenticationFailed(_("User not found"), code="user_not_found")` e o ramo
      `is_active` levanta `AuthenticationFailed(_("User is inactive"),
      code="user_inactive")`. `TenantAwareJWTAuthentication` herda esse `get_user`,
      logo a distinção vaza em toda request autenticada. Quem tem um access token
      ainda válido — isto é, quem acabou de obter o refresh token que replayaria —
      distingue os dois casos trivialmente. Pré-existente e fora do escopo: o intent
      da DW-25 nomeia só o handler central e a rota de refresh, e fechar isso exige
      decidir a política no autenticador (provável override de `get_user` colapsando
      os dois ramos), não no exception handler. Carrega decisão de produto embutida:
      se a propriedade vale, vale projeto-inteiro e este é o furo principal; se não
      vale, `_authenticate_header` e metade do teste de paridade são complexidade
      não-ganha. Registrado como DW-31.
    location: >-
      rest_framework_simplejwt/authentication.py:120-139 — superfície do projeto em backend/core/authentication.py
    severity: medium
  - summary: >-
      Os três ramos de `Response` construída à mão em `custom_exception_handler` não
      chamam `set_rollback()`, que o handler default do DRF sempre chama antes de
      devolver — então uma exceção dentro de `ATOMIC_REQUESTS` não rolaria de volta.
    evidence: |-
      Achado pelo blind-hunter (2026-08-03), confirmado por mim no DRF instalado:
      `rest_framework/views.py:99` chama `set_rollback()` imediatamente antes do
      `return`, exatamente para não deixar escrita parcial commitada. LATENTE, não
      vivo: `ATOMIC_REQUESTS` não está setado em lugar nenhum de `backend/config/`
      (grep vazio), logo não há transação por request para rolar de volta hoje.
      Pré-existente em 2 dos 3 ramos (`TenantScopeViolation` e `DomainError`
      antecedem esta story); a DW-25 só acrescentou a terceira instância do mesmo
      padrão, e corrigir só o ramo novo deixaria a inconsistência pior. Vale uma
      correção única nos três, com teste de rollback, e vale ANTES de qualquer
      decisão de ligar `ATOMIC_REQUESTS` — é aí que o latente vira perda de dados
      silenciosa. Registrado como DW-32.
    location: >-
      backend/core/exceptions.py (ramos TenantScopeViolation, DomainError e User.DoesNotExist)
    severity: medium
  - summary: >-
      O contrato do import-linter que impõe a regra de porta do `core` omite o app
      `automation`, que é app de domínio instalado — então `core` importando
      `automation` passaria o gate verde, contra a instrução explícita do próprio
      comentário do arquivo.
    evidence: |-
      Achado pela verification-gap review (2026-08-04), confirmado por mim:
      `forbidden_modules` em `backend/pyproject.toml:59-63` lista
      `bujo, habits, health, medications, gratitude, braindump` e para aí, mas
      `INSTALLED_APPS` em `config/settings/base.py:46-55` inclui `automation`, que tem
      models (`AutomationToken`, com FK para `AUTH_USER_MODEL`) e views. O comentário
      logo acima do contrato manda literalmente "When a new domain app is created, add
      its package name to `forbidden_modules` below" — foi esquecido quando o app
      nasceu. `core` não importa `automation` hoje (grep vazio), então a correção é de
      uma linha e o gate segue verde depois dela: `uv run lint-imports` continuaria
      "1 kept, 0 broken". Pré-existente e fora do escopo desta bundle (o intent não
      fala do contrato de import). Nota de contexto: `accounts` está fora da lista de
      propósito e documentado (ver Code Map) — não confundir os dois casos.
    location: >-
      backend/pyproject.toml:59-63 (contrato "core must not import domain apps")
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Dois gaps de erro em torno de auth. (1) `core/views.py::health` usa `@api_view` + `permission_classes([AllowAny])` sem `authentication_classes([])`, então herda `DEFAULT_AUTHENTICATION_CLASSES` (`TenantAwareJWTAuthentication`) e um `Authorization` header inválido faz o liveness check devolver **401** (`{"detail":"Given token not valid for any token type"}`, confirmado empiricamente) em vez de 200, apesar do docstring dizer "no auth" — um probe de monitoramento/reverse proxy que encaminhe um bearer velho recebe um falso "unhealthy". (2) `TokenRefreshSerializer.validate()` do simplejwt busca o usuário do token sem `try/except`; se esse usuário foi **apagado** do banco (diferente de desativado), `User.DoesNotExist` sobe sem tratamento — confirmado empiricamente: `accounts.models.DoesNotExist` escapa do `custom_exception_handler` (não é `APIException` nem `DomainError`), cai no `return None` final e vira o 500 padrão do Django em vez do 401 documentado.

**Approach:** (1) Decorar `health` com `@authentication_classes([])` — o mesmo one-liner que a DW-15 aplicou ao `signup` — e cobrir com um teste que envia header malformado. (2) Adicionar um ramo `isinstance(exc, get_user_model().DoesNotExist)` no `custom_exception_handler`, ao lado dos ramos `TenantScopeViolation`/`DomainError` já existentes, mapeando para 401 `{"detail": str}` sem `fields` — a mesma forma dos outros 401 de refresh.

## Boundaries & Constraints

**Always:**
- `core/exceptions.py` nunca importa app de domínio estaticamente (regra de porta do `core`, imposta por import-linter): usar `django.contrib.auth.get_user_model()` **chamado em runtime dentro do handler**, nunca `from accounts.models import User`.
- O 401 novo respeita a forma já documentada em `AccountsTokenInvalidResponse` (`accounts/views.py`): `{"detail": str}`, **sem** chave `fields` — igual ao 401 de usuário desativado.
- Mensagem do 401 neutra: não revelar que a linha do usuário foi apagada (convenção de erros do spine — nunca expor existência/inexistência de linha).
- Ordem do handler preservada: o ramo novo entra **depois** de `TenantScopeViolation`/`DomainError` e **antes** do `return None` final; `RuntimeError` continua caindo em `None`.
- `health` permanece `@extend_schema(exclude=True)` — `schema.yaml` não muda e o guard de drift da DW-14 segue verde.

**Block If:**
- Adicionar `@authentication_classes([])` ao `health` quebrar algum teste que dependa de tenant context em `/api/health/`.
- Mapear o 401 exigir tocar `TokenRefreshSerializer`/`TokenRefreshView` do simplejwt (subclasse, monkeypatch ou fork) — o intent proíbe esse caminho.

**Never:**
- Não alterar `DEFAULT_AUTHENTICATION_CLASSES`/`DEFAULT_PERMISSION_CLASSES` globais em `config/settings/base.py`.
- Não capturar `ObjectDoesNotExist` genérico nem transformar todo `<Model>.DoesNotExist` em 401 — só `User.DoesNotExist`.
- Não mexer nas anotações de schema de `accounts/views.py`, em `schema.yaml`/`types.gen.ts`, nem no ledger de deferred work.
- Não adicionar soft-delete/hard-delete de usuário nem qualquer fluxo de app que apague usuários (o caminho segue alcançável só por banco/admin).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| health sem auth (inalterado) | `GET /api/health/`, sem header | 200 `{"status":"ok"}` | Nenhum erro esperado |
| health com bearer inválido (DW-24) | `GET /api/health/` + `Authorization: Bearer garbage` | 200 `{"status":"ok"}` | Header ignorado — nenhum autenticador roda na view |
| health com bearer válido | `GET /api/health/` + JWT válido | 200 `{"status":"ok"}` | Header ignorado; tenant context não é setado (view não usa DB) |
| refresh de usuário apagado (DW-25) | `POST /api/accounts/token/refresh/` com refresh válido, linha do usuário deletada | 401, corpo `{"detail": <msg neutra>}`, **sem** `fields` | Handler central traduz `User.DoesNotExist`; nunca 500 |
| refresh de usuário desativado (inalterado) | `is_active=False`, refresh ainda válido | 401 sem `fields` | `AuthenticationFailed` nativo do DRF |
| refresh de token inválido/blacklisted (inalterado) | Refresh já rotacionado | 401 com `fields.code` | `InvalidToken` (DetailDictMixin) |
| exceção desconhecida (inalterado) | `RuntimeError` chega ao handler | Handler devolve `None` → 500 do Django | Não é nossa para traduzir |

</intent-contract>

## Code Map

- `backend/core/views.py:10-15` — `health`: `@extend_schema(exclude=True)` + `@api_view(["GET"])` + `@permission_classes([AllowAny])`, **sem** `authentication_classes`. Alvo da DW-24; `authentication_classes` vem de `rest_framework.decorators` (import já parcial nesse módulo).
- `backend/accounts/views.py:79-86` — `signup`: padrão-alvo já aplicado pela DW-15 (`@api_view` → `@permission_classes([AllowAny])` → `@authentication_classes([])`). Espelhar essa ordem.
- `backend/accounts/views.py:45-64` — `_TOKEN_INVALID_RESPONSE` (`AccountsTokenInvalidResponse`): documenta o 401 de `/token/refresh/` como `detail` obrigatório + `fields` **opcional**. O 401 novo cai na variante sem `fields` — schema já cobre, nada a anotar.
- `backend/core/exceptions.py:113-149` — `custom_exception_handler`: chama `exception_handler` do DRF; se `response is not None` normaliza corpo; senão ramos `TenantScopeViolation` (500 opaco + `logger.critical`) e `DomainError` (409); `return None` final. `logger` já existe no módulo (linha 25). Docstring do módulo (linhas 15-17) proíbe importar `core.tenant`/`core.models` — restrição de import a respeitar.
- `backend/.venv/lib/python3.13/site-packages/rest_framework_simplejwt/serializers.py:110-118` — **read-only (dependência)**: `TokenRefreshSerializer.validate()` faz `get_user_model().objects.get(**{USER_ID_FIELD: user_id})` sem `try/except`; a exceção sobe antes do ramo `USER_AUTHENTICATION_RULE` (o 401 de desativado). Não editar.
- `backend/accounts/models.py:10-27` — `User` com `objects = UserManager()` (**não** tenant-scoped, então o lookup do simplejwt não passa por `TenantManager`); `User.DoesNotExist` é `accounts.models.DoesNotExist`, exatamente o que `get_user_model().DoesNotExist` referencia.
- `backend/core/tests/test_health.py` — único teste de health no `core` (usa `APIClient()` direto, sem fixture). Alvo do teste da DW-24.
- `backend/accounts/tests/test_views.py:111-124` — `test_signup_com_authorization_header_invalido_ainda_retorna_201`: teste-espelho a copiar (usa `HTTP_AUTHORIZATION="Bearer garbage"`). `:259-285` — `test_token_refresh_usuario_desativado_retorna_401_sem_fields`: vizinho direto do novo teste da DW-25 (login → mutar user → refresh).
- `backend/core/tests/test_exceptions.py:27-64` — testes unitários do handler, chamados direto (`custom_exception_handler(exc, {})`); `test_unknown_exception_falls_through_to_django` (`:60-63`) é a regressão que o ramo novo não pode quebrar.
- `backend/pyproject.toml:55-63` — contrato do import-linter: `forbidden_modules` lista os apps de domínio e **não** inclui `accounts` (core → accounts é permitido, ver docstring de `UserHoliday`) — mesmo assim o handler usa runtime lookup, que não cria import nenhum.
- `backend/conftest.py:31-33` — acesso a DB é autouse: testes novos não precisam de `@pytest.mark.django_db`.

## Tasks & Acceptance

**Execution:**
- `backend/core/views.py` -- acrescentar `authentication_classes` ao import de `rest_framework.decorators` e decorar `health` com `@authentication_classes([])` logo abaixo de `@permission_classes([AllowAny])`; comentário curto citando DW-24/DW-15 -- torna o docstring "no auth" verdadeiro e impede que um autenticador global rejeite o liveness check.
- `backend/core/exceptions.py` -- importar `get_user_model` de `django.contrib.auth` (topo do módulo, import de Django, não de app) e adicionar no `custom_exception_handler`, após o ramo `DomainError` e antes do `return None`, um ramo `isinstance(exc, get_user_model().DoesNotExist)` → `logger.warning(...)` + `Response({"detail": <msg neutra>}, status=status.HTTP_401_UNAUTHORIZED)` -- traduz o único caminho hoje 500-ável do refresh para o 401 já documentado, sem tocar o simplejwt.
- `backend/core/tests/test_health.py` -- novo teste `test_health_com_authorization_header_invalido_retorna_200` espelhando `test_signup_com_authorization_header_invalido_ainda_retorna_201`, com comentário citando DW-24 -- fecha o ponto cego dos 2 testes existentes, que nunca enviam `Authorization`.
- `backend/core/tests/test_exceptions.py` -- teste unitário do ramo novo (401, `detail` presente, `fields` ausente, mensagem não menciona apagado/deletado) -- cobre a linha do handler isoladamente, sem depender do stack HTTP.
- `backend/accounts/tests/test_views.py` -- teste de integração `test_token_refresh_usuario_apagado_retorna_401_sem_fields` ao lado do irmão de usuário desativado (login → `user.delete()` → refresh) -- prova o comportamento fim-a-fim pela rota real, que é onde o 500 aparecia.

**Acceptance Criteria:**
- Dado que o app está no ar, quando um cliente faz `GET /api/health/` com um `Authorization` header malformado, então a resposta é 200 `{"status":"ok"}` e nenhum autenticador global roda antes da view.
- Dado um refresh token estruturalmente válido cujo usuário foi apagado do banco, quando o cliente chama `POST /api/accounts/token/refresh/`, então a resposta é 401 com corpo `{"detail": str}` sem chave `fields`, e nunca um 500.
- Dado o handler central, quando ele recebe uma exceção não-domínio que não seja `User.DoesNotExist` (ex. `RuntimeError`), então continua devolvendo `None` para o 500 padrão do Django.
- Dado o `schema.yaml` commitado, quando o schema é regerado a partir das views, então não há diff — nenhuma das duas mudanças altera a superfície documentada.

## Spec Change Log

### 2026-08-04 — Estreitamento do ramo nas Design Notes (sem loopback de implementação)

- **Achado que disparou:** o blind-hunter mostrou que `isinstance(exc, get_user_model().DoesNotExist)` é mais largo do que "só `User.DoesNotExist`": Django constrói `RelatedObjectDoesNotExist` como subclasse de `<Model>.DoesNotExist` **e** `AttributeError`, logo um deref de FK/O2O nula para `User` também caía no ramo. Confirmado por mim empiricamente antes de patchar (`LogEntry.user.RelatedObjectDoesNotExist` → handler devolvia 401 com challenge) e por controle negativo depois.
- **O que foi emendado:** o snippet das Design Notes (que prescrevia o `if` de duas condições) passou a incluir `not isinstance(exc, AttributeError)` como segunda condição, antes do `get_user_model()`, com um parágrafo novo explicando o mecanismo e a razão da posição. A nota do msgid congelado passou a citar a asserção direta contra o simplejwt.
- **Estado ruim evitado:** o `<intent-contract>` proíbe nominalmente "transformar todo `<Model>.DoesNotExist` em 401 — só `User.DoesNotExist`", e o snippet das Design Notes era a única prescrição executável do ramo. Deixá-lo com duas condições faria qualquer re-derivação futura reintroduzir a largura extra — exatamente o modo de falha que as duas entradas anteriores deste change log descrevem.
- **Não houve re-derivação:** os achados foram triados como `patch` e corrigidos no código desta pass; o `<intent-contract>` não foi tocado e `review_loop_iteration` permanece 0.
- **KEEP (deve sobreviver a qualquer re-derivação):** tudo do KEEP anterior, mais — a ordem das **três** condições é load-bearing (`ObjectDoesNotExist` barato primeiro, `AttributeError` antes do `get_user_model()`, para que nem o registry nem o custo caiam no fallback de toda exceção); a exclusão de `AttributeError` é o único discriminador possível entre "linha de `User` faltando" e "FK nula desreferenciada", e é asseverada com guarda de não-vacuidade sobre as duas heranças; o teste desse ramo usa `django.contrib.admin.models.LogEntry` **de propósito**, nunca um app de domínio, para não criar acoplamento `core → <domínio>` que o contrato do import-linter hoje não pegaria; e o msgid congelado é asseverado direto contra `TokenRefreshSerializer.default_error_messages["no_active_account"]`, não só pelo eixo de locale.

### 2026-08-03 — Correção das Design Notes (sem loopback de implementação)

- **Achado que disparou:** dois findings `patch` de severidade medium da review de 2026-08-03 — o 401 novo sem `WWW-Authenticate` (distinguível do 401 de desativado) e a mensagem como literal inglês fixo (divergiria do simplejwt sob qualquer locale ativo).
- **O que foi emendado:** as Design Notes, que (a) justificavam o `get_user_model()` em runtime com a "regra de porta / import-linter" — factualmente errado, `accounts` não está em `forbidden_modules` — e (b) prescreviam "a mensagem reusa **literalmente** a de `no_active_account`" com um exemplo-ouro do ramo sem header e com o literal inline. Reescritas para a razão real (ordem de import / app-registry), para `gettext_lazy` com o mesmo msgid, e para o ramo já com o challenge derivado.
- **Estado ruim evitado:** a spec continua sendo a fonte de verdade de qualquer re-dispatch, e `followup_review_recommended: true` torna uma pass futura provável — as Design Notes antigas empurrariam o implementador de volta exatamente para os dois bugs medium que esta pass corrigiu, e para o comentário de código factualmente errado.
- **Não houve re-derivação:** os findings foram triados como `patch` e corrigidos no código desta pass; o `<intent-contract>` não foi tocado e `review_loop_iteration` permanece 0.
- **KEEP (deve sobreviver a qualquer re-derivação):** o ramo fica no `custom_exception_handler` central, **sem** subclassar/patchar `TokenRefreshSerializer`; `isinstance(exc, ObjectDoesNotExist)` vem antes do `get_user_model()`; a mensagem é o msgid lazy compartilhado, nunca um segundo literal congelado; `_authenticate_header(context)` deriva o challenge do jeito que o `APIView.handle_exception` do DRF deriva e **não** replica o rebaixamento "sem challenge → 403"; e o teste de paridade roda sob `pt-br` com as duas guardas anti-vacuidade (challenge não-vazio, corpo pt-br ≠ en-us) — em `en-us` puro um literal inglês passaria por acidente.

### 2026-08-03 — Correção do snippet das Design Notes (sem loopback de implementação)

- **Achado que disparou:** dois reviewers independentes (blind-hunter e intent-alignment) notaram que `response.data["detail"]` do ramo novo era um `__proxy__` de `gettext_lazy`, e não um `str` — o único ramo do handler assim, contra um `<intent-contract>` que especifica `{"detail": str}`.
- **O que foi emendado:** o bloco de código das Design Notes, que prescrevia literalmente `{"detail": _NO_ACTIVE_ACCOUNT}`, passou a `{"detail": str(_NO_ACTIVE_ACCOUNT)}`, com a razão explicitada; e o `logger.warning` do snippet passou a inglês, alinhado ao `logger.critical` pré-existente do mesmo handler.
- **Estado ruim evitado:** patchar só o código deixaria a spec contradizendo-o, e como `followup_review_recommended` continua `true`, uma re-derivação futura reintroduziria o proxy lazy — exatamente o modo de falha que a entrada anterior deste change log descreve.
- **Não houve re-derivação:** o achado foi triado como `patch` e corrigido no código desta pass; o `<intent-contract>` não foi tocado e `review_loop_iteration` permanece 0.
- **KEEP (deve sobreviver a qualquer re-derivação):** tudo do KEEP anterior, mais — o `str()` resolve o msgid lazy **no momento da request** (nunca em import time, ou a tradução congelaria); a ordem `isinstance(exc, ObjectDoesNotExist)` antes de `get_user_model()` agora é asseverada por teste, não por comentário; o `try/except` de `_authenticate_header` tem teste próprio e não pode ser estreitado por uma limpeza de broad-except sem falhar; e o teste unitário cobre as **duas** formas de contexto (o `{}` degenerado e a de produção, com `view`+`request`), porque `APIView.get_exception_handler_context()` sempre fornece ambos.

## Review Triage Log

### 2026-08-04 — Review pass (follow-up)
- intent_gap: 0
- bad_spec: 0
- patch: 2: (high 0, medium 1, low 1)
- defer: 1: (high 0, medium 1, low 0)
- reject: 16: (high 0, medium 0, low 16)
- addressed_findings:
  - `[medium]` `[patch]` O ramo era mais largo do que o `<intent-contract>` autoriza ("só `User.DoesNotExist`"): Django constrói o `RelatedObjectDoesNotExist` de um descritor de FK/O2O como subclasse de `<Model>.DoesNotExist` **e** de `AttributeError`, então `isinstance(exc, get_user_model().DoesNotExist)` capturava também o deref de uma FK nula para `User`. Verifiquei empiricamente antes de patchar (`LogEntry.user.RelatedObjectDoesNotExist` → handler devolvia 401 com challenge): um erro de programação chegava ao cliente como o 401 de login e, pelo interceptor do frontend, como motivo para refresh + replay. Corrigido com `not isinstance(exc, AttributeError)` como segunda condição — único discriminador possível, e seguro porque `ObjectDoesNotExist` não é `AttributeError` — mais `test_related_object_does_not_exist_still_falls_through_to_django` com guarda de não-vacuidade sobre as duas heranças. Latente hoje (a única FK para `User` em `backend/` é a não-nula de `AutomationToken`), por isso medium.
  - `[low]` `[patch]` O msgid congelado em `core/exceptions.py` — de que depende toda a indistinguibilidade dos dois 401 — não era comparado com o do simplejwt em teste nenhum. O único detector de drift era indireto: o eixo pt-br do teste de paridade, que só acusa enquanto o simplejwt continuar publicando catálogo pt_BR para aquele msgid, e falha com uma mensagem que fala de canal lateral de locale em vez da causa real. Adicionado `test_frozen_msgid_still_matches_the_one_simplejwt_raises`, que asseve direto contra `TokenRefreshSerializer.default_error_messages["no_active_account"]` (confirmado: é exatamente `"No active account found for the given token."`, distinto do `no_active_account` do `TokenObtainSerializer`).

Deferido (1, medium): o contrato do import-linter em `backend/pyproject.toml:59-63` lista `bujo, habits, health, medications, gratitude, braindump` mas **omite `automation`**, que é app de domínio instalado, com models e views — então `core → automation` passaria o gate verde, contra a instrução explícita do próprio comentário do arquivo ("When a new domain app is created, add its package name to `forbidden_modules`"). Pré-existente e fora do escopo (o intent não fala do contrato); `core` não importa `automation` hoje, então a correção é de uma linha e verificável. Registrado como DW-33.

Promovidos ao ledger sem serem achado novo (3): a verification-gap review mostrou que **três** dos itens de `deferred` desta spec nunca chegaram a `deferred-work.md` — confirmei por grep (`swagger`, `SERVE_AUTH`, `client.ts`, `interceptor`, `_retry`: zero ocorrências no ledger). Como o ledger é a fila que o orquestrador varre, um defer que vive só no frontmatter da spec é invisível: as rotas de schema já sobreviveram **três** passes assim. Anexados como entradas novas (DW-34/DW-35/DW-36), sem tocar nenhuma entrada existente: rotas `/api/schema/` + `/api/schema/swagger-ui/` 401ando com `Authorization` velho (reproduzido de novo nesta pass por dois reviewers independentes), ausência de guarda sistêmico contra a próxima recorrência de `@api_view` + `AllowAny` sem `authentication_classes([])`, e o interceptor de 401 do frontend sem guarda de `_retry`.

Rejeitados (16, todos low). Já deferidos, re-achados: (1) rotas de schema/swagger-ui — item de `deferred` desde a primeira pass, agora promovido ao ledger, não achado novo; (2) guarda sistêmico ausente — idem; (3) interceptor sem `_retry` — idem, e a observação nova (o teste `client.test.ts:189` só termina porque o mock zera `getRefreshToken()`) reforça a entrada sem mudar a triagem; (4) DW-31 (o autenticador distingue apagado de desativado em toda rota) apresentado como bloqueador desta bundle em vez de follow-up — a autoridade de escopo é o intent, que nomeia só o handler central e a rota de refresh, e o intent-alignment auditor confirma independentemente que essa leitura (R4) excede o contrato; (5) DW-32 (`set_rollback()`) — idem. Contrariam invariante KEEP declarada: (6) rebaixar para 403 quando não há challenge (view sem autenticadores), replicando o `APIView.handle_exception` do DRF — o KEEP proíbe nominalmente esse rebaixamento e a matriz do intent especifica 401, e o cenário é inalcançável (nenhuma view sem autenticadores levanta `User.DoesNotExist`); (7) estreitar o `except Exception` de `_authenticate_header` — o KEEP existe justamente para que uma limpeza de broad-except não o apague. Já rejeitados em passes anteriores, sem fato novo: (8) envolver `get_user_model()` em `try/except`; (9) `exc_info`/`logger.warning` em caminho acionável por cliente como amplificador de log (terceira vez, agora na forma "falta throttle no refresh"); (10) cobertura de `/api/health/` espalhada por três módulos, com `test_health_sem_auth_retorna_200` duplicando `test_health_returns_ok` — organizacional; (11) volume de comentário no código-fonte. Verificados como não-defeito: (12) "o path `get_authenticate_header() → None` não é testado" — o caminho de código a jusante (`headers=None`) já é exercitado por dois testes (`context={}` e o que levanta), então não há linha descoberta; (13) "duas asserções de `test_isolation.py` viraram vacuosas com esta mudança" — `health` já era `AllowAny` antes do diff, logo a fraqueza é pré-existente; os docstrings dos dois testes **já declaram** essa limitação e apontam para `test_contextvar_conteudo_correto`, e `force_authenticate` continua autenticando (o `Request.__init__` do DRF troca `self.authenticators` por `ForcedAuthentication`, independente de `authentication_classes([])`); (14) "citar `lint-imports` como verificação é teatro porque `accounts` está fora do contrato" — a omissão de `accounts` é deliberada e documentada (Code Map), `core/tests/test_authentication.py` já importa a mesma factory, e o comando é citado como regressão, não como prova de desacoplamento (a omissão de `automation`, essa sim, virou DW-33); (15) `assert len(warnings) == 1` seria frágil se um segundo WARNING aparecesse — não é alcançável naquele teste (`context={}` não loga em `_authenticate_header`), e a contagem exata é asserção deliberada da pass anterior; (16) o comentário de `test_health.py` sobre vacuidade do `hasattr(_tenant_context_token)` seria falso porque `test_authentication.py` pegaria o rename — a afirmação local do comentário (esta asserção ficaria vacuosa) segue verdadeira, e é a terceira vez que se pede a reescrita do mesmo comentário. Também rejeitado como mecânica do próprio workflow, não defeito do artefato: a observação (dois reviewers) de que o diff sob review omitia a edição não-commitada que removeu o `## Auto Run Result` — é a preparação do orquestrador para esta pass, reescrita no Finalize abaixo.

### 2026-08-03 — Review pass (follow-up)
- intent_gap: 0
- bad_spec: 0
- patch: 8: (high 0, medium 0, low 8)
- defer: 2: (high 0, medium 2, low 0)
- reject: 10: (high 0, medium 0, low 10)
- addressed_findings:
  - `[low]` `[patch]` O `try/except` de `_authenticate_header` — cuja única função é impedir que derivar um header transforme o 401 da DW-25 de volta no 500 que ela existe para remover — não era exercitado por teste nenhum. A verification-gap review provou com canário: trocando o corpo do `except` por um `raise`, a suíte inteira seguia verde, logo o guarda podia ser estreitado ou apagado por qualquer limpeza de broad-except sem uma única objeção. Adicionado `test_challenge_derivation_failure_still_returns_the_401` com uma view-stub cujo `get_authenticate_header` levanta.
  - `[low]` `[patch]` A ordem `isinstance(exc, ObjectDoesNotExist)` antes de `get_user_model()` — invariante KEEP declarada nesta spec — era imposta só por comentário. A verification-gap review provou por mutação: trocando os operandos, a suíte seguia verde. Adicionado `test_get_user_model_is_not_resolved_on_the_fallback_path`, que monkeypatcha `get_user_model` para levantar e asseve que um `RuntimeError` ainda cai em `None`.
  - `[low]` `[patch]` Os dois testes unitários do ramo só exercitavam `context={}`, forma que **não ocorre em produção** (`APIView.get_exception_handler_context()` sempre fornece `view`+`request`), então a asserção de header pinava o caminho degenerado e toda a garantia real ficava dependendo de um único teste de integração. Adicionado `test_user_does_not_exist_carries_the_views_challenge`, que roda a forma de produção e asseve que o challenge da view é anexado.
  - `[low]` `[patch]` `response.data["detail"]` era um `__proxy__` de `gettext_lazy`, o único ramo do handler assim — os dois ramos vizinhos passam string literal e todo erro reconhecido pelo DRF passa por `_normalise_body`/`_stringify`. O corpo na rede era idêntico, mas o `{"detail": str}` do contrato vale na superfície de `response.data` também. Corrigido com `str(...)` (resolve com o locale ativo na request) e pinado com `isinstance(response.data["detail"], str)`.
  - `[low]` `[patch]` O docstring de módulo de `core/tests/test_health.py` afirmava que o módulo "now touches the DB ... rather than being auth-free" — factualmente errado: a fixture autouse `_enable_db_access(db)` do `conftest` raiz já dava acesso a DB a **todo** teste antes deste diff (o que mudou é que agora ele *escreve* uma linha). E a rewrite apagou sem relocar a razão documentada da existência do módulo (garantir que o pytest colete ≥1 teste, evitando exit code 5). Ambos corrigidos.
  - `[low]` `[patch]` `_login_e_refresh` não tinha diagnóstico de falha: `login.json()["refresh"]` viraria `KeyError: 'refresh'` a qualquer regressão no login, fazendo os **três** testes que dependem dele apontar para o helper em vez de para a rota que quebrou. Adicionado `assert login.status_code == 200, login.content`.
  - `[low]` `[patch]` As duas mensagens de log novas estavam em português enquanto o `logger.critical("TenantScopeViolation: ...")` pré-existente, na mesma função, está em inglês — e mensagem de log é chave de grep/alerta. Ambas passadas para inglês (a asserção `"User.DoesNotExist" in ...` do teste unitário sobrevive por ser o nome da exceção).
  - `[low]` `[patch]` O comentário do teste de paridade afirmava um risco de locale que **não é alcançável hoje**: verifiquei que não há `LocaleMiddleware` no `MIDDLEWARE` e `LANGUAGE_CODE = "en-us"`, então toda request real renderiza os dois corpos em inglês e só o `translation.override` do teste ativa pt-br. Comentário reescrito para o valor vivo da asserção (detectar rewording upstream do simplejwt, que é o que torna aceitável o msgid congelado) mantendo o registro de que o eixo vira canal lateral real no dia em que houver negociação de idioma.

Rejeitados (10, todos low): (1) blast radius global do ramo para um bug que vive num serializer de terceiro, com a sugestão de subclassar `TokenRefreshSerializer` — o `<intent-contract>` manda exatamente o desenho implementado e o **Block If** proíbe nominalmente subclasse/monkeypatch/fork do simplejwt, então a alternativa proposta é vedada pela própria autoridade de escopo; (2) o `logger.warning` seria invisível porque não haveria `LOGGING` dictConfig — **factualmente errado**, `config/settings/prod.py:50` define `LOGGING` com root em WARNING para stdout (Railway); (3) `exc_info` em caminho acionável por cliente polui log / é amplificador — já rejeitado na pass anterior pela mesma razão, e o alcance segue limitado; (4) `/api/schema/` e swagger-ui com a mesma classe de bug — já estava em `deferred` desde a pass anterior, não é achado novo; (5) interceptor de 401 do frontend sem guarda de `_retry` — idem, já deferido; (6) `get_user_model()` deveria ser envolvido em `try/except` por simetria com `_authenticate_header` — em tempo de execução do handler o app registry está sempre pronto (só há chamada via dispatch de view), e um `AUTH_USER_MODEL` mal configurado quebraria toda request de qualquer forma: seria uma segunda camada de mascaramento para condição inalcançável; (7) refresh token sem claim `user_id` passa sem checagem de existência/`is_active` — confirmei o `if user_id and (...)` no simplejwt, mas forjar tal token exige a `SECRET_KEY`, e o access token resultante é inútil (`get_user` levanta `InvalidToken` por não reconhecer identificação de usuário); (8) `test_user_does_not_exist_maps_to_401_without_fields` seria tautológico — não é: `response.data["detail"] == _NO_ACTIVE_ACCOUNT` falha se o ramo trocar a constante por um literal, que é exatamente o que o comentário afirma cobrir; (9) o comentário do teste de paridade atribuiria o challenge ao `exc.auth_header` do DRF quando a origem real é o override hardcoded de `TokenViewBase` — o mecanismo descrito está correto (o DRF anexa via `exc.auth_header`; o valor vem da view), e o teste falhar num rewording upstream é precisamente o tripwire pretendido; (10) volume de comentário e anotações de histórico de review no código-fonte — reescrever os mesmos comentários uma terceira vez tem valor negativo, e as anotações são o que explica por que invariantes não-óbvias existem. Também rejeitados por serem organizacionais/não-defeitos: cobertura de `/api/health/` espalhada por três módulos; a nota de vacuidade do `hasattr(_tenant_context_token)` (a afirmação local do comentário segue verdadeira); a alegação errada de import-linter dentro do `<intent-contract>` (bloco imutável, e Code Map/Design Notes já registram o fato correto).

### 2026-08-03 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 7: (high 0, medium 3, low 4)
- defer: 3: (high 0, medium 3, low 0)
- reject: 5: (high 0, medium 0, low 5)
- addressed_findings:
  - `[medium]` `[patch]` O 401 novo não carregava `WWW-Authenticate`, então era distinguível do 401 de usuário desativado — o exato oposto da garantia da branch. Medido por mim na rota real: desativado → `Bearer realm="api"`, apagado → header ausente (e um 401 sem challenge viola a RFC 7235). Corrigido derivando o challenge do `context` (argumento que já existia e estava sem uso) da mesma forma que o `APIView.handle_exception` do DRF, via helper `_authenticate_header()`.
  - `[medium]` `[patch]` A mensagem era um literal inglês fixo, mas a do simplejwt é `gettext_lazy` com catálogo pt_BR — sob qualquer locale ativo os dois corpos divergiriam. Verifiquei que `gettext` resolve o msgid pelo catálogo mesclado do simplejwt (`pt-br` → "Nenhuma conta ativa encontrada para o token fornecido."). Corrigido com `_NO_ACTIVE_ACCOUNT = gettext_lazy(<mesmo msgid>)`; descartado importar `TokenRefreshSerializer` dentro do handler (import de terceiro em runtime num handler de exceção viraria amplificador de falha).
  - `[medium]` `[patch]` Nenhum teste asseverava a invariante em que o desenho se apoia: o teste de apagado congelava o literal e o irmão de desativado não asseverava `detail` nenhum, então os dois 401 podiam divergir com a suíte verde — foi exatamente assim que os dois achados acima passaram. Adicionado `test_token_refresh_401_de_desativado_e_de_apagado_sao_indistinguiveis`, que roda os dois fluxos sob `pt-br` e compara status, corpo e header, com duas guardas anti-vacuidade (challenge não-vazio; corpo pt-br ≠ corpo en-us).
  - `[low]` `[patch]` `get_user_model()` passou a ser avaliado no caminho de fallback de toda exceção não reconhecida; se ele levantasse ali, mascararia a exceção original. Corrigido com um teste barato antes: `isinstance(exc, ObjectDoesNotExist) and isinstance(exc, get_user_model().DoesNotExist)`.
  - `[low]` `[patch]` O comentário da branch justificava o lookup em runtime com "regra de porta, imposta por import-linter" — factualmente errado: `accounts` não está em `forbidden_modules` e `core/calendar.py` importa `accounts.models` direto. Reescrito com a razão real (ordem de import / app-registry) e enxugado. (O Code Map desta spec já registrava o fato correto; foram as Design Notes que carregaram a versão errada para o código.)
  - `[low]` `[patch]` A asserção de log do teste unitário era satisfeita por qualquer WARNING avulso, embora todo o argumento de segurança da branch seja "o warning mantém visível um `User.DoesNotExist` de outra origem". Passou a pinar `record.name == "core.exceptions"`, exatamente um registro, o caso na mensagem e `exc_info` presente; o blacklist de substrings (`delet`/`apagad`/`exist`) saiu em favor da comparação com o msgid compartilhado.
  - `[low]` `[patch]` Precisão de documentação em 3 pontos: docstring do `health` ainda dizia só "no auth, no DB access" (a mentira que a própria DW-24 corrigiu) e o bloco de racional estava encravado entre decorators, sobre a única ordem que não pode ser perturbada; o inventário de ramos de 401 em `accounts/views.py:45-56` dizia "um segundo ramo" e enumerava dois, quando agora são três; e o docstring de `core/tests/test_health.py` ainda se descrevia como o canário sem dependências. Todos atualizados (verificado: saída do `spectacular` segue byte-idêntica, logo nada disso mexe em anotação de schema). O teste de bearer válido também ganhou asserção de superfície pública (`response.wsgi_request.user.is_anonymous`) ao lado da sondagem do atributo privado.

Rejeitados (5, todos low): (1) `logger.warning` deveria ser `critical` por analogia com `TenantScopeViolation` — a analogia não se sustenta, aquele é sempre bug de infra e este é condição de cliente esperada (CRITICAL viraria fadiga de alarme); (2) `exc_info` em caminho acionável por cliente polui log — o traceback é justamente o que torna diagnosticável um `User.DoesNotExist` de origem estranha, e o alcance é limitado; (3) docstring de módulo de `core/exceptions.py` estaria desatualizado ("duas responsabilidades") — segue correto, a branch nova é parte do trabalho do handler, e a proibição de importar `core.tenant`/`core.models` continua verdadeira; (4) a alegação de impacto da DW-24 estaria apresentada como confirmada — tanto o ledger quanto o comentário estão no condicional ("para qualquer probe que encaminhe"), sem afirmar que tal probe existe; (5) o swagger-ui devolveria 500 por `InvalidToken` escapando no render do template — não reproduziu no meu probe (medi 401); a parte verificada virou item de `deferred`.

## Design Notes

**Por que `get_user_model()` em runtime, e não `from accounts.models import User`:** porque `core.exceptions` é importado muito cedo (ver docstring de `core/authentication.py`), então uma referência a model em nível de módulo arrisca `AppRegistryNotReady`; `get_user_model()` é lookup no registry do Django resolvido só quando o handler executa. **Não** é a regra de porta: `accounts` não está em `forbidden_modules` do import-linter e `core/calendar.py` importa `accounts.models` direto — o Code Map acima registra isso corretamente (corrigido na review de 2026-08-03; a versão anterior desta nota afirmava o contrário e vazou para um comentário de código).

**Trade-off deliberado da amplitude:** o handler é global, então o ramo passa a converter **qualquer** `User.DoesNotExist` não capturado, em qualquer view, em 401 — não só o do refresh. É o que o intent pede explicitamente ("add an isinstance(...) branch in custom_exception_handler"), e 401 é uma leitura defensável em qualquer lugar (o usuário referenciado não existe mais). O `logger.warning` existe justamente para que um `User.DoesNotExist` originado de outro bug não fique invisível ao virar 401. Verificado na review: não há nenhum call site de `User.objects.get()` em `backend/` fora da lib e dos testes, então a amplitude é latente, não viva.

Forma do ramo novo (espelhando o ramo `TenantScopeViolation`):

```python
if (
    isinstance(exc, ObjectDoesNotExist)
    and not isinstance(exc, AttributeError)
    and isinstance(exc, get_user_model().DoesNotExist)
):
    logger.warning("User.DoesNotExist escaped to the central handler", exc_info=exc)
    auth_header = _authenticate_header(context)
    return Response(
        {"detail": str(_NO_ACTIVE_ACCOUNT)},
        status=status.HTTP_401_UNAUTHORIZED,
        headers={"WWW-Authenticate": auth_header} if auth_header else None,
    )
```

O `isinstance(exc, ObjectDoesNotExist)` vem primeiro para que `get_user_model()` não seja chamado no caminho de fallback de toda exceção não reconhecida — e essa ordem é asseverada por `test_get_user_model_is_not_resolved_on_the_fallback_path`, não só por comentário (corrigido na review de 2026-08-03: trocar os operandos deixava a suíte inteira verde).

O `not isinstance(exc, AttributeError)` é o que faz o "só `User.DoesNotExist`" do `<intent-contract>` ser verdade de fato (corrigido na review de 2026-08-04). Django constrói o `RelatedObjectDoesNotExist` de um descritor de FK/O2O como subclasse **de ambos** `<Model>.DoesNotExist` **e** `AttributeError` — verificado empiricamente: `LogEntry.user.RelatedObjectDoesNotExist` é `isinstance` de `User.DoesNotExist`, então um deref de FK nula para `User` (`obj.user` sem `user_id`) caía no ramo e voltava como o 401 de login **com** challenge, vestindo um erro de programação de "sua sessão expirou" — e, para o interceptor do frontend, de motivo para refresh + replay. A exclusão é segura porque `ObjectDoesNotExist` não é `AttributeError`, e é asseverada por `test_related_object_does_not_exist_still_falls_through_to_django` (com guarda de não-vacuidade sobre as duas heranças). Mantido fora de qualquer app de domínio: o teste usa `django.contrib.admin.models.LogEntry`, que tem FK real para `AUTH_USER_MODEL` e não custa acoplamento nenhum ao `core`.

O `str(...)` em torno da constante lazy é deliberado e resolve com o locale ativo **no momento da request**, que é quando o handler roda — mesmo valor, mas um `str` de verdade em `response.data`. Sem ele, este seria o único ramo do handler em que `response.data["detail"]` não é o `str` que o contrato de `AccountsTokenInvalidResponse` promete: os dois ramos acima passam string literal e todo erro reconhecido pelo DRF passa por `_normalise_body`, cujo `_stringify` garante isso (corrigido na review de 2026-08-03).

**A garantia de neutralidade é sobre a RESPOSTA inteira, não sobre a string.** `_NO_ACTIVE_ACCOUNT` é `gettext_lazy` com o **mesmo msgid** que o simplejwt usa em `no_active_account` — não um literal copiado, e desde a review de 2026-08-04 isso é asseverado **diretamente** contra `TokenRefreshSerializer.default_error_messages["no_active_account"]` (`test_frozen_msgid_still_matches_the_one_simplejwt_raises`), não só de forma indireta pelo round-trip pt-br. O msgid resolve pelo catálogo mesclado do simplejwt (o app está em `INSTALLED_APPS`), então os dois ramos traduzem igual sob qualquer locale ativo; um literal fixo ficaria em inglês e delataria o caso. E o `WWW-Authenticate` tem que ser derivado à mão (`_authenticate_header(context)`), porque um `Response` construído no handler não passa pelo caminho em que o DRF anexa `exc.auth_header` — sem isso, o 401 de apagado seria o único de `/token/refresh/` sem challenge, um canal lateral de um header só. Ambos os furos existiram na primeira implementação e só apareceram porque nada comparava as duas respostas; hoje `test_token_refresh_401_de_desativado_e_de_apagado_sao_indistinguiveis` é o dono dessa invariante.

## Verification

**Commands:**
- `cd backend && uv run pytest core/tests/test_health.py core/tests/test_exceptions.py accounts/tests/test_views.py -q` -- expected: todos passam, incluindo os 3 testes novos
- `cd backend && uv run pytest -q` -- expected: suíte completa verde (gate cross-app; Postgres local via `docker compose up -d db`)
- `cd backend && uv run ruff check .` -- expected: sem findings
- `cd backend && uv run lint-imports` -- expected: contrato "core must not import domain apps" verde
- `cd backend && cp ../schema.yaml /tmp/schema.dw2425.yaml && uv run python manage.py spectacular --file ../schema.yaml && diff /tmp/schema.dw2425.yaml ../schema.yaml` -- expected: diff vazio (nenhuma mudança de schema); se sujar, restaurar `schema.yaml` do git

## Auto Run Result

Status: done
Blocking condition: nenhuma

### Mudança implementada

Fechou os dois gaps de erro em torno de auth da bundle. **DW-24:** `core/views.py::health` ganhou `@authentication_classes([])` — antes herdava `DEFAULT_AUTHENTICATION_CLASSES` e um `Authorization` header malformado fazia o liveness check responder 401 em vez de 200 (confirmado empiricamente antes do fix: `{"detail":"Given token not valid for any token type"}`). **DW-25:** `custom_exception_handler` ganhou um ramo que traduz `User.DoesNotExist` — que o `TokenRefreshSerializer.validate()` do simplejwt levanta sem `try/except` quando a linha do usuário do refresh token foi apagada — para o 401 documentado, em vez do 500 cru do Django. O 401 novo é indistinguível do 401 de usuário desativado em status, corpo **e** header `WWW-Authenticate`.

Esta pass foi a **segunda review de follow-up** (a spec entrou como `done`, com `followup_review_recommended: true`). Ela estreitou o ramo da DW-25, que era mais largo do que o `<intent-contract>` autoriza: `isinstance(exc, get_user_model().DoesNotExist)` também casava com o `RelatedObjectDoesNotExist` de qualquer FK/O2O para `User`, porque Django o constrói como subclasse de `<Model>.DoesNotExist` **e** de `AttributeError` — um deref de FK nula voltava como o 401 de login com challenge. Fora isso, o único outro patch foi de verificação (o msgid congelado passou a ser asseverado direto contra o simplejwt). Uma condição pré-existente foi deferida (DW-33) e três defers antigos que viviam só no frontmatter desta spec foram finalmente promovidos ao ledger (DW-34/35/36).

### Arquivos alterados

- `backend/core/views.py` — `@authentication_classes([])` no `health`; racional fora da pilha de decorators e docstring com o contrato real (qualquer `Authorization` é ignorado). *(inalterado nesta pass)*
- `backend/core/exceptions.py` — constante `_NO_ACTIVE_ACCOUNT` (`gettext_lazy`, msgid do simplejwt), ramo `ObjectDoesNotExist` + `User.DoesNotExist` → 401 com `logger.warning` e challenge, helper `_authenticate_header(context)`. **Nesta pass:** terceira condição `not isinstance(exc, AttributeError)` entre as duas existentes (antes do `get_user_model()`, preservando a invariante do caminho de fallback), com o comentário do ramo reescrito para o mecanismo do `RelatedObjectDoesNotExist`.
- `backend/accounts/views.py` — só comentário: inventário dos ramos de 401 de `/token/refresh/` (dois → três). *(inalterado nesta pass)*
- `backend/core/tests/test_health.py` — 2 testes de header (inválido → 200; bearer válido → 200, anônima e sem tenant context). *(inalterado nesta pass)*
- `backend/core/tests/test_exceptions.py` — **+2 testes nesta pass:** `test_related_object_does_not_exist_still_falls_through_to_django` (usa `django.contrib.admin.models.LogEntry`, FK real para `AUTH_USER_MODEL`, para não acoplar `core` a app de domínio; com guarda de não-vacuidade sobre as duas heranças) e `test_frozen_msgid_still_matches_the_one_simplejwt_raises` (asseve contra `TokenRefreshSerializer.default_error_messages["no_active_account"]`).
- `backend/accounts/tests/test_views.py` — teste do usuário apagado + teste de paridade dos dois 401 sob `pt-br`. *(inalterado nesta pass)*
- `_bmad-output/implementation-artifacts/deferred-work.md` — **nesta pass:** 4 entradas novas (DW-33 a DW-36), append-only (28 inserções, 0 remoções — nenhuma entrada existente tocada).

### Achados de review

- **Patches aplicados: 2** (high 0, medium 1, low 1). O medium é o estreitamento do ramo: um erro de programação (FK nula desreferenciada) chegava ao cliente como 401 de login com auth challenge — e, pelo interceptor do frontend, como motivo para refresh + replay. Latente hoje, porque a única FK para `User` em `backend/` é a não-nula de `AutomationToken`. O low fecha a única lacuna real de verificação restante: o msgid congelado não era comparado com o do simplejwt em teste nenhum (o eixo pt-br do teste de paridade o detectava só indiretamente, e só enquanto o simplejwt publicar catálogo pt_BR).
- **Deferidos: 1** (medium) — **DW-33:** o contrato do import-linter da regra de porta do `core` omite `automation`, app de domínio instalado com models e views, contra a instrução explícita do comentário do próprio arquivo; o gate citado como verificação em várias stories não veria um `core → automation`.
- **Promovidos ao ledger (3, sem serem achado novo):** a verification-gap review mostrou que três itens de `deferred` desta spec nunca chegaram a `deferred-work.md` — o ledger é a fila que o orquestrador varre, então um defer só no frontmatter é invisível, e as rotas de schema já tinham sobrevivido três passes assim. Anexados como **DW-34** (rotas `/api/schema/` e `/api/schema/swagger-ui/` 401ando com bearer velho — reproduzido de novo por dois reviewers independentes nesta pass), **DW-35** (guarda sistêmico ausente contra a próxima recorrência de `@api_view` + `AllowAny`) e **DW-36** (interceptor de 401 do frontend sem guarda de `_retry`).
- **Rejeitados: 16** (todos low) — detalhados no fim do Review Triage Log. Cinco eram itens já deferidos re-achados; dois contrariam invariante KEEP declarada nesta spec (rebaixar 401→403 sem challenge; estreitar o `except` de `_authenticate_header`); quatro já tinham sido rejeitados em passes anteriores sem fato novo; e cinco verifiquei como não-defeito. Um merece nota: a alegação de que duas asserções de `accounts/tests/test_isolation.py` teriam virado vacuosas com esta mudança — `health` já era `AllowAny` antes do diff, os docstrings dos dois testes já declaram a limitação, e `force_authenticate` continua autenticando porque o `Request.__init__` do DRF troca `self.authenticators` por `ForcedAuthentication` independentemente de `authentication_classes([])`.

### Recomendação de review de follow-up

`false`. Só os findings triados `patch` contam: high 0, medium 1, low 1. Score = 3 × 1 + 1 × 1 = **4** < 5, e nenhum high.

### Verificação realizada

Todos os comandos da seção `## Verification`, re-rodados **depois** dos patches:

- `uv run pytest core/tests/test_health.py core/tests/test_exceptions.py accounts/tests/test_views.py -q` → **46 passed** (44 + os 2 novos)
- `uv run pytest -q` (suíte completa, gate cross-app) → **1380 passed** em 5m03s (1378 + os 2 novos)
- `uv run ruff check .` → `All checks passed!`
- `uv run lint-imports` → `core must not import domain apps (port rule) KEPT` — 1 kept, 0 broken (o teste novo importa `django.contrib.admin`, não app de domínio)
- Drift de schema: `spectacular` regerado → `Errors: 0`, **diff vazio**; `git status --porcelain schema.yaml frontend/src/api/types.gen.ts` limpo

**Controles negativos dos 2 testes desta pass (nenhuma asserção é vacuosa).** Cada mutação foi aplicada isoladamente, com a fonte restaurada em seguida:

| Mutação em `core/exceptions.py` | Teste que falhou |
|---|---|
| condição `not isinstance(exc, AttributeError)` removida | `test_related_object_does_not_exist_still_falls_through_to_django` |
| msgid congelado reescrito (`"No active account found, sorry."`) | `test_frozen_msgid_still_matches_the_one_simplejwt_raises` **e** `test_token_refresh_401_de_desativado_e_de_apagado_sao_indistinguiveis` |

A segunda mutação também documenta o ganho do teste novo: o drift já era detectado, mas só pelo teste de paridade, que falha falando de canal lateral de locale em vez da causa. Os controles negativos das duas passes anteriores seguem válidos (reverter `core/views.py` falha os 2 testes de health; reverter o ramo do handler falha os 3 testes obrigatórios; os 4 controles da pass de 2026-08-03 seguem descritos acima neste log).

Verificação independente extra, antes de patchar: confirmei em shell Django que `LogEntry.user.RelatedObjectDoesNotExist` é subclasse de `User.DoesNotExist` **e** de `AttributeError`, que o handler devolvia 401 para ele, que `User.DoesNotExist` **não** é `AttributeError` (logo a exclusão é segura), e que `TokenRefreshSerializer.default_error_messages["no_active_account"]` é exatamente `"No active account found for the given token."` — distinto do `no_active_account` do `TokenObtainSerializer` (`"...with the given credentials"`), que é o msgid errado a congelar.

### Riscos residuais

- **A indistinguibilidade é uma propriedade de uma rota, não do sistema (DW-31).** Segue sendo a nota mais importante: `JWTAuthentication.get_user` vaza a distinção apagado/desativado em **toda** rota autenticada, com código de erro diferente inclusive. Quem tem um access token válido distingue os dois casos trivialmente. O trabalho de header/locale desta bundle vale para `/token/refresh/`; a propriedade só passa a valer de verdade quando a DW-31 for decidida.
- **Amplitude do ramo global:** qualquer `User.DoesNotExist` não capturado, de qualquer view, vira 401. É o que o intent pede explicitamente, e não há call site de `User.objects.get()` em `backend/` fora da lib e dos testes — latente, não vivo. O estreitamento desta pass fecha só o eixo `RelatedObjectDoesNotExist`; o eixo de rota continua aberto por desenho.
- **Msgid congelado:** `_NO_ACTIVE_ACCOUNT` repete o msgid do simplejwt em vez de ler a constante da lib em runtime (import de terceiro dentro de um handler de exceção seria amplificador de falha). Um rewording upstream dentro de `>=5.3,<6` separaria as mensagens — mas agora quebra dois testes, um deles apontando direto para a causa.
- **O eixo de locale do teste de paridade não é alcançável em produção hoje** (sem `LocaleMiddleware`, `LANGUAGE_CODE="en-us"`), e depende do simplejwt continuar publicando catálogo pt_BR para aquele msgid. Com a asserção direta desta pass, ele deixou de ser o único detector de drift.
- **`set_rollback()` ausente nos três ramos (DW-32):** latente enquanto `ATOMIC_REQUESTS` não estiver ligado — e é exatamente o momento de ligar que transforma isso em perda de dados silenciosa.
- **Deferidos ainda abertos:** DW-31, DW-32 e agora DW-33 a DW-36 — as rotas de schema seguem 401ando com bearer velho em produção (DW-34), não há guarda sistêmico contra a próxima recorrência do padrão (DW-35), o interceptor do frontend segue sem guarda de retry (DW-36) e o contrato do import-linter segue cego para `core → automation` (DW-33).

