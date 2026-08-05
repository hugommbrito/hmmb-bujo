---
title: 'DW-41/DW-43/DW-47: 401 uniforme em TODO autenticador (automação + claim não-UUID)'
type: 'bugfix'
created: '2026-08-04'
status: 'in-progress'
review_loop_iteration: 0
baseline_revision: '3ae30b94a6356b963c6a442ff2218c9a9b4e04b0'
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Três furos sobrevivem à propriedade que a DW-31 estabeleceu (um 401 nunca revela se uma linha existe). **(1)** `AutomationTokenAuthentication` nunca consulta `is_active` (`grep -rn is_active backend/automation/` = ZERO): como `AutomationToken.user` é `on_delete=CASCADE`, um dono **apagado** leva o token e a request 401a, mas um dono **DESATIVADO** segue recebendo **200 com corpo completo** em `POST /api/capture` e `GET /api/summary/today` — separando os dois casos por sucesso-vs-falha (tell muito mais grosseiro que o corpo do 401) e, pior, **bypassando a desativação**, que é a única ação "trancar esta conta" que o admin oferece (`accounts/admin.py:16`). **(2)** O mesmo autenticador distingue "linha de token inexistente" (`"Token inválido"`, `:49`) de "existente mas revogada" (`"Token revogado"`, `:51`) por mensagem, contra a convenção do spine. **(3)** Em `TenantAwareJWTAuthentication.get_user`, um access token com assinatura válida cujo claim `user_id` não seja UUID parseável faz `User.objects.get(id=<lixo>)` levantar `django.core.exceptions.ValidationError` (**confirmado empiricamente nesta pass**: `ValidationError: '"nao-e-uuid" is not a valid UUID.'`, porque `accounts/models.py:11` é `UUIDField(primary_key=True)`) — que não é `AuthenticationFailed`, não é `APIException` nem `DomainError`, escapa pelo `return None` de `core/exceptions.py:238` e vira **500 cru do Django**.

**Approach:** No autenticador de automação, checar `token.user.is_active` antes de devolver e colapsar os três ramos de falha (hash desconhecido / revogado / dono inativo) num único `AuthenticationFailed` reusando a msgid congelada `_NO_ACTIVE_ACCOUNT`; em `core/authentication.py`, acrescentar `except DjangoValidationError` dentro do `try` que a DW-31 já criou, colapsando na **mesma** exceção. Nada de convenção nova: mesma mensagem, mesma forma de corpo, mesmo código.

## Boundaries & Constraints

**Always:**
- Os dois sítios levantam o `AuthenticationFailed` **nativo do DRF** (`rest_framework.exceptions`, que o de automação já usa) com `code="no_active_account"` → corpo `{"detail": str}` **sem** chave `fields`, idêntico ao 401 de refresh (DW-25) e ao da DW-31.
- `_NO_ACTIVE_ACCOUNT` (`core/exceptions.py:39`) é a **fonte única** da mensagem nos dois arquivos: nunca copiar o literal.
- Em `automation/authentication.py` o import de `core.exceptions` **pode ser no topo do módulo**: este módulo já importa `automation.models` no topo, logo só é importável depois do app registry, e **não** está em `DEFAULT_AUTHENTICATION_CLASSES` — a cadeia de resolução precoce do DRF que obriga o import em runtime em `core/authentication.py` não o alcança. Confirmar com `django.setup()` + suíte completa; se quebrar, cair para import dentro do método, como a DW-31.
- Em `core/authentication.py` o import de `_NO_ACTIVE_ACCOUNT` **continua em runtime, dentro do método** (a DW-31 comprovou o `ImportError` circular) — o ramo novo usa o mesmo import.
- Automação: ordem **checar-depois-carimbar** preservada. Falha nunca carimba `last_used_at` nem seta o tenant context.
- Cada ramo colapsado registra `logger.warning` nomeando **qual** ramo era (mesmo racional da DW-31/DW-25: o cliente perde a distinção, o operador não). Nunca logar o token — nem pleno nem prefixo (AD-19: "token nunca aparece em log") — nem id de usuário.
- O `WWW-Authenticate` é **por autenticador** e constante dentro da superfície: automação devolve `"Bearer"` (`authenticate_header`, `:68-73`), o JWT devolve `Bearer realm="api"`. A uniformidade é asseverada **dentro** de cada superfície (com não-vacuidade) e **cross-superfície apenas no corpo** — o challenge não vaza nada porque é idêntico para toda falha daquela superfície, inclusive "sem header".
- Dono apagado na automação é o **mesmo ramo** que hash desconhecido (CASCADE derruba o token junto): o teste asseve a identidade das respostas, não um ramo novo.
- DW-47 colapsa na **mesma** exceção de "no active account", não em `InvalidToken`/`token_not_valid`: o intent da bundle manda "devolva o mesmo 401 uniforme" e "reusar a mensagem congelada `_NO_ACTIVE_ACCOUNT`". Semanticamente correto — um claim que a PK não parseia é uma linha que não pode existir.

**Block If:**
- Colapsar exigir tocar o simplejwt (fork/monkeypatch/subclasse de serializer), `DEFAULT_AUTHENTICATION_CLASSES`/`SIMPLE_JWT`, ou o `authentication_classes` das views de automação.
- Igualar os challenges das duas superfícies se mostrar necessário para a propriedade (implicaria mudar `authenticate_header` e o teste que pina `"Bearer"` — decisão fora deste intent).
- A suíte completa quebrar em algo que não seja atualização de asserção sobre as mensagens antigas.

**Never:**
- Não editar `_bmad-output/implementation-artifacts/deferred-work.md` (o orquestrador registra resolução).
- Não tocar `core/exceptions.py` (nem `_NO_ACTIVE_ACCOUNT`, nem o ramo `User.DoesNotExist` da DW-25, nem `_authenticate_header`, nem `_normalise_body`) — DW-25/DW-32 estão fechadas e verdes.
- Não chamar `_authenticate_header` de dentro de um autenticador: ele exige o `context` dict do handler (view+request), que não existe nessa camada — mesmo desvio consciente que a DW-31 registrou (objetivo cumprido, literal não).
- Não alterar `authenticate_header` (`"Bearer"`), o caminho de sucesso, o set do tenant context, nem o stash em `request._request` de nenhum dos dois autenticadores.
- Não alargar `_INDISTINGUISHABLE_CODES` (DW-47 não é um `code` do simplejwt; é uma exceção do Django).
- Não alterar `schema.yaml`, `types.gen.ts`, anotações `extend_schema` das views, nem código de frontend.
- Não resolver DW-42/44/45/46/48/49/50 — fora desta bundle.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Dono desativado (automação) | `POST /api/capture` + Bearer de token válido, dono `is_active=False` | **401** `{"detail": "No active account found for the given token."}`, sem `fields`, `WWW-Authenticate: Bearer`. **Hoje é 200.** | `AuthenticationFailed` colapsado |
| Dono apagado (automação) | idem, dono deletado (token cai por CASCADE) | Resposta **idêntica** à de cima | idem (ramo "hash desconhecido") |
| Hash desconhecido | `Bearer bujo_desconhecido` | Resposta **idêntica** | idem |
| Token revogado | Bearer de token com `revoked_at` | Resposta **idêntica** | idem |
| Mesmos 4 casos em `GET /api/summary/today` | idem | Idênticos entre si e ao de `capture` | idem |
| Sem header / header não-Bearer | Nenhum `Authorization`, ou `Basic abc` | **Inalterado**: `authenticate()` devolve `None` → 401 do DRF | Não passa pelos ramos novos |
| Token de automação válido, dono ativo | Bearer válido | **Inalterado**: 200, contexto setado, `last_used_at` carimbado | Nenhum erro |
| Claim `user_id` não-UUID (JWT) | Access token assinado com `user_id="nao-e-uuid"` em `GET /api/bujo/logs/today/` | **401** idêntico ao de apagado/desativado da DW-31. **Hoje é 500 cru.** | `DjangoValidationError` colapsada |
| Apagado / desativado / `Bearer garbage` em rota JWT | idem DW-31 | **Inalterado** (colapso e não-colapso preservados) | DW-31 |

</intent-contract>

## Code Map

- `backend/automation/authentication.py:36-66` — **alvo principal**. `authenticate()`: `:47` lookup por hash fora do tenant scope, `:48-49` `raise AuthenticationFailed("Token inválido")`, `:50-51` `raise AuthenticationFailed("Token revogado")`, `:58-59` carimbo de `last_used_at`, `:63` set do contexto, `:66` `return (token.user, token)` — ou seja, `token.user` **já** é carregado no caminho de sucesso, então checar `is_active` não acrescenta query nova ali. Não tem `logger` ainda (acrescentar `import logging` + `logger = logging.getLogger(__name__)`, precedente em `automation/views.py:27-28`). `:68-73` `authenticate_header` → `"Bearer"` (read-only).
- `backend/automation/models.py:53-59` — `AutomationToken.user` é `ForeignKey(..., on_delete=CASCADE)`: dono apagado ⇒ token apagado. `:41-49` `hash_token`. Read-only.
- `backend/automation/views.py:33-34,103-104` — as **duas** views com `authentication_classes = [AutomationTokenAuthentication]` (`CaptureView`, `SummaryView`), `permission_classes = [HasAutomationScope]` sem `IsAuthenticated`. Read-only — é a superfície externa das ACs.
- `backend/accounts/models.py:11` — `id = models.UUIDField(primary_key=True, ...)`: a causa da DW-47. `accounts/admin.py:16` — `is_active` no `list_display`/fieldset de Permissões: a única alternância de "trancar conta". Read-only.
- `backend/core/authentication.py:141-156` — **alvo**. `try: return super().get_user(...)` / `except AuthenticationFailed` com `_failure_code` + `_INDISTINGUISHABLE_CODES` + `logger.warning` + import runtime de `_NO_ACTIVE_ACCOUNT`. O ramo novo é um `except DjangoValidationError` no MESMO `try` (`from django.core.exceptions import ValidationError as DjangoValidationError` no topo é seguro — `core/exceptions.py:22` já importa desse módulo).
- `backend/.venv/.../rest_framework_simplejwt/authentication.py:120-148` — **read-only**. `get_user`: `InvalidToken` para claim ausente; `objects.get(**{USER_ID_FIELD: user_id})` **sem** try para `ValidationError` (é daí que a DW-47 escapa); depois `user_not_found` / `user_inactive` / `password_changed`.
- `backend/core/exceptions.py:30-39` — `_NO_ACTIVE_ACCOUNT` (msgid congelada, `gettext_lazy`). `:207-235` ramo DW-25. `:241-267` `_authenticate_header` (exige `context`, não aplicável a autenticador). `:270-299` `_normalise_body`: dict com `detail` passa direto e chaves extras virariam `fields` — é por isso que a exceção nativa do DRF (sem `DetailDictMixin`) é a certa. Read-only.
- `backend/automation/tests/test_authentication.py` — **alvo dos testes unitários**. 8 testes; `_request(full_token)` helper (`:22-26`); molde `test_revoked_token_raises_authentication_failed` (`:73-82`). **Correção factual ao intent da bundle:** os testes de `:65` e `:73` **não** pinam as mensagens distinguíveis hoje — só fazem `pytest.raises(AuthenticationFailed)` sem asserção de texto. Logo nada quebra por si; eles precisam ser **fortalecidos** para asseverar a mensagem uniforme, não "corrigidos".
- `backend/automation/tests/test_views.py:133-158,395-413` — **alvo dos testes HTTP**. `CAPTURE_URL = "/api/capture"`, `SUMMARY_URL = "/api/summary/today"`; `test_token_invalido_retorna_401`/`test_token_revogado_retorna_401` (as duas rotas) asseveram **só status**, nunca corpo. Helper `_token_client(user, scopes=...)`. Docstring do módulo: token real, nunca `force_authenticate`.
- `backend/core/tests/test_authentication.py` — **alvo dos testes de DW-47**. Molde completo: `_desativar`/`_apagar`/`_token_de_usuario_mutado` (`:98-118`), `_get_today_log` (`:360-363`), `TODAY_LOG_URL`/`REFRESH_URL` (`:53-54`), `test_get_user_nao_colapsa_token_sem_claim_de_usuario` (`:320-335`, mostra o padrão de mutar `token.payload[jwt_settings.USER_ID_CLAIM]`), `test_o_colapso_registra_o_codigo_original_no_log` (`:157-186`, filtra `caplog` por `r.name == "core.authentication"` e asseve `len(mensagens) == 2` — **o ramo novo não pode disparar log nesse teste**, e não dispara: ele só exercita apagado/desativado), e `test_401_de_no_active_account_e_uma_convencao_so_nas_duas_superficies` (`:456-499`, o molde do teste cross-superfície com `json.dumps(sort_keys=True)`).
- `backend/conftest.py:31-33,36-46` — `_enable_db_access(db)` é `@pytest.fixture(autouse=True)` sem condição (todo teste tem DB); fixtures `user`/`other_user`. `auth_client` usa `force_authenticate` e **não serve** para nada disto.
- `backend/pyproject.toml:60-75` — contrato do import-linter: só proíbe `core → apps de domínio` (inclui `automation`, DW-33). `automation → core.exceptions` é a direção permitida e já praticada (`core.calendar`, `core.context`).
- Baseline de grep (conferido): `"Token inválido"`/`"Token revogado"` só existem em `automation/authentication.py:49,51` — zero ocorrências em frontend, e2e, `schema.yaml` ou testes (os nomes de teste `test_token_invalido_*` são só nomes). `frontend/src/api/client.ts:30` chaveia só em `status`.

## Tasks & Acceptance

**Execution:**
- `backend/automation/authentication.py` -- checar `token.user.is_active` como terceira condição de falha e colapsar os três ramos num helper de módulo que loga o motivo e devolve `AuthenticationFailed(_NO_ACTIVE_ACCOUNT, code="no_active_account")`; três `if` separados (log discrimina, resposta não); acrescentar `logger`; atualizar o docstring do módulo dizendo que a falha é uniforme e por quê -- fecha DW-41 (bypass de desativação) e DW-43 (tell por mensagem) de uma vez, sem tocar caminho de sucesso.
- `backend/core/authentication.py` -- acrescentar `except DjangoValidationError as exc` ao `try` existente de `get_user`, com `logger.warning` estático (nunca o valor do claim) e o mesmo `raise AuthenticationFailed(_NO_ACTIVE_ACCOUNT, code="no_active_account") from exc`; comentário curto citando DW-47, `accounts/models.py:11` e o porquê de não ser `InvalidToken` -- tira o 500 cru do caminho e o coloca na mesma convenção.
- `backend/automation/tests/test_authentication.py` -- fortalecer os dois testes existentes (`:65`, `:73`) para asseverar `detail`/`code` **iguais entre si** e iguais a `_NO_ACTIVE_ACCOUNT`/`no_active_account`; acrescentar dono `is_active=False` e dono apagado (mesmo molde, um usuário por caso, token emitido antes da mutação); um teste que junta os **quatro** casos e asseve uma única resposta distinta; um teste de `caplog` provando que o motivo aparece no log e que token e id de usuário **não** aparecem -- pinça a uniformidade na camada do autenticador e prova que a não-vacuidade não vem de "tudo falha igual por acidente".
- `backend/automation/tests/test_views.py` -- teste HTTP de paridade nas **duas** rotas (`/api/capture`, `/api/summary/today`) com token real: os quatro casos (hash desconhecido, revogado, dono apagado, dono desativado) rendem 401 com `response.json()` idêntico, sem `fields`, `WWW-Authenticate` idêntico e não vazio; mais o pin explícito de que dono desativado **não** devolve mais 200 -- é a superfície externa que o intent nomeia (onde o bypass era observável).
- `backend/core/tests/test_authentication.py` -- (a) unitário: `AccessToken.for_user` com `payload[jwt_settings.USER_ID_CLAIM] = "nao-e-uuid"` levanta o mesmo `AuthenticationFailed` de apagado/desativado, com `__cause__` sendo `DjangoValidationError`; (b) HTTP em `TODAY_LOG_URL` com token assinado: 401 (não 500) com corpo e challenge idênticos aos de apagado/desativado; (c) estender o teste cross-superfície com a superfície de automação **no eixo do corpo** (challenge comparado só dentro de cada superfície, com o motivo registrado) -- fecha DW-47 no fio e prova "uma convenção só" nos três autenticadores.

**Acceptance Criteria:**
- Dado um token de automação válido cujo dono está com `is_active=False`, quando `POST /api/capture` ou `GET /api/summary/today` é chamado, então a resposta é 401 e é indistinguível — status, corpo JSON e `WWW-Authenticate` — das respostas de hash desconhecido, token revogado e dono apagado, e nenhuma delas menciona qual caso era.
- Dado que desativar a conta é a ação de trancamento que o admin oferece, quando o dono é desativado, então nenhuma rota de automação devolve mais 200 para os tokens dele.
- Dado um access token com assinatura válida cujo claim `user_id` não é um UUID parseável, quando ele chega a uma rota autenticada por `TenantAwareJWTAuthentication`, então a resposta é o 401 uniforme (nunca um 500), com corpo e challenge idênticos aos de usuário apagado e desativado.
- Dado que a suíte completa do backend roda (`cd backend && uv run pytest`), quando ela termina, então está verde — incluindo os 15 testes de DW-31 em `core/tests/test_authentication.py`, os 8 de `automation/tests/test_authentication.py` e a paridade da DW-25 em `accounts/tests/test_views.py`.
- Dado o `schema.yaml` commitado e o contrato de import do `core`, quando o schema é regerado e `uv run lint-imports` roda, então não há diff e o contrato segue verde — e `django.setup()` continua sem `ImportError` circular.

## Spec Change Log

## Review Triage Log

## Design Notes

**Por que `_NO_ACTIVE_ACCOUNT` também na automação.** O corpo precisa ser um só para os quatro casos, e a msgid congelada já é a convenção das outras duas superfícies ("no active account for the given token"), que é exatamente o que um token de automação inválido/revogado/de dono trancado significa. Copiar `"Token inválido"` para os quatro seria criar uma segunda convenção para a mesma propriedade — o que o intent proíbe. O `code` não chega ao cliente (o `AuthenticationFailed` nativo do DRF rende `{"detail": str}` sem `fields`); ele existe para o operador e para casar com a DW-31/DW-25.

**Forma esperada (automação):**

```python
def _falha_uniforme(motivo: str) -> AuthenticationFailed:
    # Cliente não distingue; operador sim (DW-41/DW-43, mesmo racional da DW-31).
    logger.warning("Falha de autenticação de automação colapsada: motivo=%s", motivo)
    return AuthenticationFailed(_NO_ACTIVE_ACCOUNT, code="no_active_account")

token = AutomationToken.objects.filter(token_hash=hash_token(full)).first()
if token is None:            # inclui dono apagado: `user` é CASCADE
    raise _falha_uniforme("hash_desconhecido")
if token.revoked_at is not None:
    raise _falha_uniforme("token_revogado")
if not token.user.is_active:  # DW-41: `is_active` é a tranca do admin
    raise _falha_uniforme("dono_inativo")
```

**Assimetria de challenge, dita sem exagero.** `"Bearer"` (automação) vs. `Bearer realm="api"` (JWT) vêm de defaults independentes. Isso **não** é canal lateral: dentro de cada superfície o header é idêntico para toda falha, inclusive a de "sem credencial", então ele não separa caso nenhum. Igualá-los mudaria `authenticate_header` e o teste que o pina, sem ganho de segurança — fora de escopo, registrado aqui para a falha do teste cross-superfície não ser lida como regressão.

## Verification

**Commands:**
- `cd backend && uv run pytest automation/tests/test_authentication.py automation/tests/test_views.py core/tests/test_authentication.py -q` -- expected: verde; os testes novos falham **antes** das mudanças de código (baseline vermelho comprovando não-vacuidade: dono desativado devolve 200, e o claim não-UUID levanta `ValidationError`/500) e passam depois.
- `cd backend && uv run pytest` -- expected: suíte completa verde. Obrigatório, não escopado: muda o 401 das duas rotas de automação e acrescenta ramo no autenticador default.
- `cd backend && uv run ruff check .` -- expected: sem violações (é o que a CI roda, `.github/workflows/ci.yml:71`).
- `cd backend && uv run ruff format --check automation/authentication.py core/authentication.py automation/tests/test_authentication.py automation/tests/test_views.py core/tests/test_authentication.py` -- expected: já formatados. Escopado de propósito: `ruff format --check .` reporta ~50 arquivos pré-existentes nesta árvore e a CI não roda format check, então a versão global não carregaria sinal.
- `cd backend && uv run lint-imports` -- expected: 1 kept, 0 broken.
- `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run python -c "import django; django.setup()"` -- expected: sem erro (guarda direta contra o import circular; é o teste que decide se o import de `core.exceptions` fica no topo de `automation/authentication.py`).
- `cd backend && uv run python manage.py spectacular --file /tmp/schema-check.yaml && diff /tmp/schema-check.yaml ../schema.yaml` -- expected: sem diff (guarda o `Never` de não tocar anotações de view).
- `grep -rn "Token inválido\|Token revogado" frontend/src frontend/e2e schema.yaml` -- expected: zero ocorrências, provando que a troca de mensagem não tem consumidor.
- `cd frontend && nvm use 22.15.1 && npx vitest run src/api/client.test.ts` -- expected: verde (10 testes). Único eixo de frontend com sinal: o interceptor de 401 é o único consumidor de 401 no cliente. **Playwright deliberadamente não roda**: nenhum cenário de E2E usa token de automação nem desativa/apaga usuário no meio da sessão, e o corpo dos 401 de sessão normal (`token_not_valid`) segue byte-idêntico.
