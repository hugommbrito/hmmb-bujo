---
title: 'DW-24/DW-25: health público com Authorization inválido + 401 em refresh de usuário apagado'
type: 'bugfix'
created: '2026-08-03'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_revision: 'd768310f03cbfafcc30bf108b83ec97a656ec538'
final_revision: 'cd237d786e7f1483a75426661f9090376f1280eb'
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

### 2026-08-03 — Correção das Design Notes (sem loopback de implementação)

- **Achado que disparou:** dois findings `patch` de severidade medium da review de 2026-08-03 — o 401 novo sem `WWW-Authenticate` (distinguível do 401 de desativado) e a mensagem como literal inglês fixo (divergiria do simplejwt sob qualquer locale ativo).
- **O que foi emendado:** as Design Notes, que (a) justificavam o `get_user_model()` em runtime com a "regra de porta / import-linter" — factualmente errado, `accounts` não está em `forbidden_modules` — e (b) prescreviam "a mensagem reusa **literalmente** a de `no_active_account`" com um exemplo-ouro do ramo sem header e com o literal inline. Reescritas para a razão real (ordem de import / app-registry), para `gettext_lazy` com o mesmo msgid, e para o ramo já com o challenge derivado.
- **Estado ruim evitado:** a spec continua sendo a fonte de verdade de qualquer re-dispatch, e `followup_review_recommended: true` torna uma pass futura provável — as Design Notes antigas empurrariam o implementador de volta exatamente para os dois bugs medium que esta pass corrigiu, e para o comentário de código factualmente errado.
- **Não houve re-derivação:** os findings foram triados como `patch` e corrigidos no código desta pass; o `<intent-contract>` não foi tocado e `review_loop_iteration` permanece 0.
- **KEEP (deve sobreviver a qualquer re-derivação):** o ramo fica no `custom_exception_handler` central, **sem** subclassar/patchar `TokenRefreshSerializer`; `isinstance(exc, ObjectDoesNotExist)` vem antes do `get_user_model()`; a mensagem é o msgid lazy compartilhado, nunca um segundo literal congelado; `_authenticate_header(context)` deriva o challenge do jeito que o `APIView.handle_exception` do DRF deriva e **não** replica o rebaixamento "sem challenge → 403"; e o teste de paridade roda sob `pt-br` com as duas guardas anti-vacuidade (challenge não-vazio, corpo pt-br ≠ en-us) — em `en-us` puro um literal inglês passaria por acidente.

## Review Triage Log

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
if isinstance(exc, ObjectDoesNotExist) and isinstance(exc, get_user_model().DoesNotExist):
    logger.warning("User.DoesNotExist escapou para o handler central", exc_info=exc)
    auth_header = _authenticate_header(context)
    return Response(
        {"detail": _NO_ACTIVE_ACCOUNT},
        status=status.HTTP_401_UNAUTHORIZED,
        headers={"WWW-Authenticate": auth_header} if auth_header else None,
    )
```

O `isinstance(exc, ObjectDoesNotExist)` vem primeiro para que `get_user_model()` não seja chamado no caminho de fallback de toda exceção não reconhecida.

**A garantia de neutralidade é sobre a RESPOSTA inteira, não sobre a string.** `_NO_ACTIVE_ACCOUNT` é `gettext_lazy` com o **mesmo msgid** que o simplejwt usa em `no_active_account` — não um literal copiado. O msgid resolve pelo catálogo mesclado do simplejwt (o app está em `INSTALLED_APPS`), então os dois ramos traduzem igual sob qualquer locale ativo; um literal fixo ficaria em inglês e delataria o caso. E o `WWW-Authenticate` tem que ser derivado à mão (`_authenticate_header(context)`), porque um `Response` construído no handler não passa pelo caminho em que o DRF anexa `exc.auth_header` — sem isso, o 401 de apagado seria o único de `/token/refresh/` sem challenge, um canal lateral de um header só. Ambos os furos existiram na primeira implementação e só apareceram porque nada comparava as duas respostas; hoje `test_token_refresh_401_de_desativado_e_de_apagado_sao_indistinguiveis` é o dono dessa invariante.

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

Fechou os dois gaps de erro em torno de auth da bundle. **DW-24:** `core/views.py::health` ganhou `@authentication_classes([])` — antes herdava `DEFAULT_AUTHENTICATION_CLASSES` e um `Authorization` header malformado fazia o liveness check responder 401 em vez de 200 (confirmado empiricamente antes do fix: `{"detail":"Given token not valid for any token type"}`). **DW-25:** `custom_exception_handler` ganhou um ramo que traduz `User.DoesNotExist` — que o `TokenRefreshSerializer.validate()` do simplejwt levanta sem `try/except` quando a linha do usuário do refresh token foi apagada — para o 401 documentado, em vez do 500 cru do Django (confirmado antes do fix: `accounts.models.DoesNotExist` escapando sem tratamento). O 401 novo é indistinguível do 401 de usuário desativado em status, corpo **e** header `WWW-Authenticate`, sob qualquer locale.

### Arquivos alterados

- `backend/core/views.py` — `@authentication_classes([])` no `health`; racional movido para fora da pilha de decorators e docstring reescrita com o contrato real (qualquer `Authorization` é ignorado).
- `backend/core/exceptions.py` — constante `_NO_ACTIVE_ACCOUNT` (`gettext_lazy`, mesmo msgid do simplejwt), ramo `ObjectDoesNotExist` + `User.DoesNotExist` → 401 com `logger.warning` e challenge, e helper `_authenticate_header(context)` que deriva o `WWW-Authenticate` como o DRF deriva.
- `backend/accounts/views.py` — só comentário: o inventário dos ramos de 401 de `/token/refresh/` passou de dois para três (schema inalterado, `spectacular` byte-idêntico).
- `backend/core/tests/test_health.py` — 2 testes novos (header inválido → 200; bearer válido → 200, request anônima e sem tenant context) e docstring do módulo atualizada.
- `backend/core/tests/test_exceptions.py` — teste unitário do ramo novo (401, sem `fields`, msgid compartilhado, sem challenge com `context={}`, warning do logger certo com `exc_info`) e guarda de estreiteza (`DoesNotExist` de outro model segue caindo em `None`).
- `backend/accounts/tests/test_views.py` — teste de integração do usuário apagado + teste de paridade que compara os dois 401 sob `pt-br` (status, corpo, header) com guardas anti-vacuidade; helpers `_login_e_refresh`/`_desativar`/`_apagar`.

### Achados de review

- **Patches aplicados: 7** (high 0, medium 3, low 4) — os 3 medium: `WWW-Authenticate` ausente (canal lateral que derrotava a neutralidade), literal inglês fixo (divergiria sob locale ativo), e a ausência de qualquer teste da invariante de paridade — que foi justamente o que deixou os outros dois passarem.
- **Deferidos: 3** (todos medium) — mesma classe de bug da DW-24 em `/api/schema/` e `/api/schema/swagger-ui/`; ausência de guarda sistêmico contra o padrão `@api_view` + `AllowAny` sem `authentication_classes`; interceptor de 401 do frontend sem guarda de `_retry`. Detalhes e evidência no `deferred` do frontmatter.
- **Rejeitados: 5** (todos low) — detalhados no fim do Review Triage Log, incluindo uma alegação de 500 no swagger-ui que **não reproduziu** (medi 401).

### Recomendação de review de follow-up

`true`. Só os findings triados `patch` contam: high 0, medium 3, low 4. Score = 3 × 3 + 1 × 4 = **13** ≥ 5.

### Verificação realizada

Todos os comandos da seção `## Verification`, re-rodados **depois** dos patches:

- `uv run pytest core/tests/test_health.py core/tests/test_exceptions.py accounts/tests/test_views.py accounts/tests/test_isolation.py core/tests/test_api_contract.py -q` → **56 passed**
- `uv run pytest -q` (suíte completa, gate cross-app) → **1375 passed** em 6m24s
- `uv run ruff check .` → `All checks passed!`
- `uv run lint-imports` → `core must not import domain apps (port rule) KEPT` — 1 kept, 0 broken
- Drift de schema: `spectacular` regerado → `Errors: 0`, **diff vazio**; `git status --porcelain schema.yaml frontend/src/api/types.gen.ts` limpo

**Controles negativos (as asserções não são vacuosas):** revertendo só `core/views.py`, os 2 testes de health falham — inclusive o `hasattr(_tenant_context_token)`, que era `True` antes do fix. Revertendo `core/views.py` + `core/exceptions.py`, os 3 testes obrigatórios da spec falham, com o traço do `User.DoesNotExist` escapando para um 500. E o teste de paridade falha na asserção pretendida ao remover o `headers=` (challenge `None` vs `Bearer realm="api"`) ou ao trocar o msgid lazy por literal (corpo inglês vs português).

**Auditoria da matriz de I/O:** as 7 linhas têm teste que rodou e passou — health sem auth (`test_health_returns_ok`, `test_health_sem_auth_retorna_200`), header inválido (`test_health_com_authorization_header_invalido_retorna_200`), bearer válido (`test_health_com_bearer_valido_ignora_o_header_e_nao_seta_tenant_context`, adicionado na auditoria por não haver cobertura — os 2 testes de isolamento que tocam `/api/health/` usam `force_authenticate`, que pula os authenticators), usuário apagado (`test_token_refresh_usuario_apagado_retorna_401_sem_fields` + unitário do handler), usuário desativado (`test_token_refresh_usuario_desativado_retorna_401_sem_fields`), token blacklisted (`test_token_refresh_rotacao_blacklist`), exceção desconhecida (`test_unknown_exception_falls_through_to_django` + `test_other_models_does_not_exist_still_falls_through_to_django`).

### Riscos residuais

- **Amplitude do ramo global:** qualquer `User.DoesNotExist` não capturado, de qualquer view, agora vira 401 em vez de 500. É o que o intent pede explicitamente, e verifiquei que não há call site de `User.objects.get()` em `backend/` fora da lib e dos testes — logo é latente, não vivo. O `logger.warning` com `exc_info` é o que mantém uma ocorrência de origem estranha diagnosticável.
- **Msgid congelado:** `_NO_ACTIVE_ACCOUNT` repete o msgid do simplejwt em vez de ler a constante da lib (import de terceiro em runtime dentro de um handler de exceção seria pior). Um rewording upstream dentro de `>=5.3,<6` separaria as duas mensagens — mas quebra o teste de paridade em vez de passar silencioso, que é o que torna a escolha aceitável.
- **Nada apaga usuários hoje:** o caminho da DW-25 só é alcançável por intervenção direta em banco/admin (o app só desativa via `is_active=False`), então o fix é hardening, não correção de bug vivo.
- **Deferidos ainda abertos:** as rotas de schema seguem 401ando com bearer velho em produção, e o interceptor do frontend segue sem guarda de retry.
