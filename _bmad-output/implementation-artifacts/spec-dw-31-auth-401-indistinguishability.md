---
title: 'DW-31: colapsar usuário apagado/desativado num 401 único em TODA rota autenticada'
type: 'bugfix'
created: '2026-08-04'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_revision: '36cdee860c7da4692dd398bf05b73e59d9678871'
context: []
warnings: ['oversized']
deferred:
  - summary: >-
      `AutomationTokenAuthentication` nunca consulta `is_active`, então desativar um usuário
      NÃO revoga o acesso dele às rotas de automação — e isso por si só distingue apagado de
      desativado, o eixo que a DW-31 acabou de fechar no autenticador JWT.
    evidence: |-
      Achado pelo blind-hunter e pela verification-gap review (2026-08-04) e confirmado por
      mim: `grep -rn "is_active" backend/automation/` = ZERO ocorrências. Como
      `AutomationToken.user` é `on_delete=CASCADE` (`automation/models.py:55-59`), um usuário
      APAGADO leva o token com ele e a request 401a; um usuário DESATIVADO segue recebendo
      200 em `POST /api/capture` e `GET /api/summary/today` (`automation/views.py:34,103`).
      Duas consequências: (1) apagado vs. desativado separados por sucesso/falha, um tell mais
      grosseiro do que os corpos de 401 que a DW-31 unificou; (2) um bypass de desativação —
      `is_active` só é alternável pelo admin do Django (`accounts/admin.py:16`), que é
      exatamente a ação "trancar esta conta" que esse caminho ignora. Nenhum teste em
      `backend/automation/` asseve nada sobre `is_active`. Pré-existente e fora do escopo da
      DW-31, cujo intent nomeia só `TenantAwareJWTAuthentication.get_user`.
    location: >-
      backend/automation/authentication.py:36-66 (sem checagem de is_active)
    severity: high
  - summary: >-
      `POST /api/accounts/signup/` reabre, sem autenticação nenhuma, o mesmo oráculo que a
      DW-31 fechou: com um email conhecido dá para distinguir usuário apagado de desativado
      numa única request.
    evidence: |-
      Achado pelo blind-hunter (2026-08-04). A unicidade de email do serializer
      (`accounts/serializers.py:16-20`) responde 400 "Este email já está em uso." quando a
      linha existe — inclusive com `is_active=False` — e deixa o signup seguir para 201
      quando a linha foi apagada. Ou seja: 400 = desativado, 201 = apagado. É a mesma
      distinção que a DW-31 removeu da superfície autenticada, numa rota pública. Escolha de
      produto embutida (divulgação de email em uso é um trade-off comum e deliberado em muitos
      produtos), então não é patch: precisa de decisão. Pré-existente; o intent da DW-31
      nomeia só o autenticador.
    location: >-
      backend/accounts/serializers.py:16-20 (unicidade de email no signup)
    severity: medium
  - summary: >-
      `AutomationTokenAuthentication` distingue "linha de token inexistente" de "linha
      existente mas revogada" por mensagem, contra a convenção do spine de nunca expor
      existência/inexistência de linha.
    evidence: |-
      Achado pelo blind-hunter e pela verification-gap review (2026-08-04), confirmado por
      mim lendo o arquivo: `raise AuthenticationFailed("Token inválido")` quando o filtro por
      hash não acha nada, e `raise AuthenticationFailed("Token revogado")` quando acha e
      `revoked_at is not None`. As duas mensagens chegam ao cliente pelo mesmo handler
      central. É a mesma família de vazamento que a DW-25/DW-31 trataram no autenticador JWT,
      mas em outro autenticador (opt-in por view, fora de `DEFAULT_AUTHENTICATION_CLASSES`) e
      sobre linhas de `AutomationToken`, não de `User`. Fora do escopo do intent da DW-31.
    location: >-
      backend/automation/authentication.py:47-52
    severity: medium
  - summary: >-
      Ligar `CHECK_REVOKE_TOKEN` transforma o ramo `password_changed` do simplejwt num oráculo
      de existência de linha, e nada pinça esse setting no default seguro.
    evidence: |-
      Levantado pelo edge-case-hunter, pela verification-gap review e pelo intent-alignment
      auditor (2026-08-04). O upstream levanta `password_changed` em
      `rest_framework_simplejwt/authentication.py:141-147`, isto é, só DEPOIS de o lookup ter
      achado a linha e `is_active` ter passado: alcançável apenas para usuário existente E
      ativo, logo divulga existência. Fica fora de `_INDISTINGUISHABLE_CODES` de propósito
      (documentado no comentário) porque hoje é inalcançável — `CHECK_REVOKE_TOKEN` tem
      default `False` e o `SIMPLE_JWT` de `config/settings/base.py:122-131` não o seta — e
      porque não separa apagado de inativo, o eixo da DW-31. Nenhum teste notaria o flip: os
      tokens dos testes novos são recém-emitidos e carregam o claim de hash de senha casando.
      Deliberadamente NÃO pinçado por teste nesta pass, para não congelar um comportamento que
      pode virar vazamento — a decisão (colapsar também, ou pinçar o setting) é separada.
    location: >-
      backend/core/authentication.py (_INDISTINGUISHABLE_CODES) — setting em backend/config/settings/base.py:122-131
    severity: medium
  - summary: >-
      A suíte completa do backend tem um flake que a torna um gate imperfeito:
      `test_task_density_isolamento_entre_tenants` erra com `OperationalError: the connection
      is closed` em algumas execuções full-suite.
    evidence: |-
      Observado pela verification-gap review (2026-08-04): 2 ERRORs na primeira execução full
      dela, limpa na segunda. O teste passa isolado e num prefix run de
      `accounts automation braindump bujo` (821 passed), e coleta ANTES de `core/` na ordem
      determinística (não há `pytest-randomly` instalado), então não é contaminação pelos
      testes novos. As minhas duas execuções full desta pass foram limpas (1385 e 1390
      passed). Ambiental, contra o Postgres local — mas significa que o gate de suíte completa
      não é perfeitamente confiável, o que importa porque a CI roda `uv run pytest` sem
      escopo (`.github/workflows/ci.yml:79-80`).
    location: >-
      backend/bujo/tests/test_views.py::test_task_density_isolamento_entre_tenants
    severity: medium
  - summary: >-
      O corpo `{"detail": str}` (sem `fields`) virou o 401 canônico de TODA rota autenticada e
      não está documentado em lugar nenhum do `schema.yaml`.
    evidence: |-
      Achado pelo blind-hunter (2026-08-04), confirmado por mim: `schema.yaml` documenta 401
      só nas duas rotas de `accounts` (`AccountsLoginFailedResponse` na linha 64,
      `AccountsTokenInvalidResponse` na 97-101). Nenhum componente ou `extend_schema` registra
      a forma que esta mudança tornou canônica em todo o resto da API. Nenhum consumidor
      quebra hoje — `frontend/src/api/client.ts:30` chaveia só em status, nunca no corpo — e a
      regeneração do schema não dá diff, então não é regressão: é lacuna de contrato
      pré-existente (401 nunca foi documentado nessas rotas), agora com uma forma estável o
      suficiente para valer documentar.
    location: >-
      schema.yaml (nenhum 401 documentado fora de /api/accounts/token/ e /token/refresh/)
    severity: low
  - summary: >-
      Um access token válido cujo claim `user_id` não seja um UUID parseável vira 500 do
      Django em vez do 401 uniforme, porque `User.id` é `UUIDField`.
    evidence: |-
      Levantado pelo edge-case-hunter (2026-08-04). `accounts/models.py:11` define
      `id = models.UUIDField(primary_key=True, ...)`, então `objects.get(id=<lixo>)` levanta
      `django.core.exceptions.ValidationError` — não `DoesNotExist` — que escapa de `get_user`
      (o `except AuthenticationFailed` não a pega), não é `APIException` nem `DomainError`, e
      cai no `return None` final do `custom_exception_handler` → 500 cru. NÃO é alcançável por
      atacante: o token precisa de assinatura válida, logo do `SECRET_KEY`, e todo token que
      emitimos carrega um UUID real. Fica como robustez latente (ex. token sobrevivente a uma
      troca de tipo de PK ou de `USER_ID_FIELD`), não como vulnerabilidade.
    location: >-
      backend/core/authentication.py (get_user) — PK em backend/accounts/models.py:11
    severity: low
  - summary: >-
      A entrada DW-31 do ledger de deferred work tem a linha `decision:` duplicada,
      byte-idêntica.
    evidence: |-
      Achado pelo blind-hunter e confirmado pelo intent-alignment auditor (2026-08-04):
      `_bmad-output/implementation-artifacts/deferred-work.md:204` e `:205` são a mesma linha
      `decision: 2026-08-04 Colapsar os dois ramos no autenticador, projeto-inteiro — ...`
      repetida. Pré-existente e visível também no `intent.md` da bundle desta run, que
      reproduz as duas. Não corrigido aqui porque a invocação proíbe explicitamente editar o
      ledger (o orquestrador é que registra resolução) — registrado por este canal para que a
      varredura veja.
    location: >-
      _bmad-output/implementation-artifacts/deferred-work.md:204-205
    severity: low
  - summary: >-
      O `code` `no_active_account` cobre dois msgids distintos em três superfícies (login usa
      "...with the given credentials"; refresh e o autenticador da DW-31 usam "...for the given
      token."), sem nada registrando a divergência.
    evidence: |-
      Achado NOVO do follow-up review pass (blind-hunter, 2026-08-04), verificado por mim no
      simplejwt instalado: `TokenObtainSerializer` levanta o code com
      `_("No active account found with the given credentials")` (`serializers.py:35`), enquanto
      `TokenRefreshSerializer` (`:108`) e agora este autenticador usam
      `_("No active account found for the given token.")`. Não é vazamento — no login, apagado
      e desativado produzem a MESMA resposta, porque o `authenticate()` do Django falha para os
      dois, então o eixo da DW-31 já está fechado ali. É dívida de convenção: acrescentar o
      login como terceira superfície ao teste cross-superfície falharia pelo msgid, não por
      defeito. Mitigado em parte nesta pass (o docstring de `get_user` deixou de afirmar "uma
      convenção só em todo o projeto" e passou a nomear o que iguala e o que não); o que fica
      aberto é a decisão — alinhar o msgid do login ou registrar a polissemia como deliberada.
      Promovido ao ledger como DW-49.
    location: >-
      backend/core/authentication.py (code="no_active_account") × rest_framework_simplejwt/serializers.py:35,108
    severity: low
  - summary: >-
      O Finalize do step-04 commita o bookkeeping pré-staged do ledger junto com os
      patches da própria pass, e o commit resultante se descreve errado.
    evidence: |-
      Achado NOVO da terceira review pass (intent-alignment auditor, 2026-08-04),
      atribuição verificada por mim em `git show`. O commit `e889ead` (follow-up
      review) carrega os appends DW-41..DW-49, que a pass escreveu, E a virada
      `status: open` → `done 2026-08-04` + `resolution:` na entrada DW-31, que é
      bookkeeping do orquestrador (`git show --stat 01b6a09 -- deferred-work.md` é
      vazio: o commit de implementação não tocou o ledger). O corpo de `e889ead`
      afirma "Só append: nenhuma entrada existente foi modificada" — verdadeiro do
      que a pass escreveu, falso do que ela commitou. A pass anterior rejeitou o
      achado como "bookkeeping não-commitado do orquestrador", leitura correta no
      momento do review e superada pelo próprio Finalize. Nada de código errado e
      nenhuma entrada corrompida: a virada é legítima, só está no commit errado com
      a mensagem errada. Nesta pass o ledger já estava limpo antes do Finalize, então
      a mecânica não reincidiu. Promovido ao ledger como DW-50.
    location: >-
      _bmad/render/bmad-build-auto/**/step-04-review.md (Finalize, item 1) — instância em e889ead
    severity: low
---

<intent-contract>

## Intent

**Problem:** `TenantAwareJWTAuthentication` herda `JWTAuthentication.get_user` do simplejwt, que levanta `AuthenticationFailed(_("User not found"), code="user_not_found")` quando a linha do usuário foi **apagada** e `AuthenticationFailed(_("User is inactive"), code="user_inactive")` quando ela existe mas está **inativa** — mensagem E código distintos, em toda request autenticada. Reproduzido em `GET /api/bujo/logs/today/`: apagado devolve `{"detail": "User not found", "fields": {"code": ["user_not_found"]}}`, desativado devolve `{"detail": "User is inactive", "fields": {"code": ["user_inactive"]}}`. Isso anula projeto-inteiro a indistinguibilidade que a DW-25 construiu só em `POST /api/accounts/token/refresh/`: quem tem um access token válido distingue os dois casos trivialmente em qualquer outro endpoint, e a convenção do spine ("nunca expor existência/inexistência de linha") vale para toda a superfície, não para uma rota.

**Approach:** Sobrescrever `get_user` em `TenantAwareJWTAuthentication` para colapsar **apenas** esses dois ramos num único `AuthenticationFailed`, reusando a mensagem congelada `_NO_ACTIVE_ACCOUNT` de `core/exceptions.py:39` — mesma msgid, mesma forma de corpo e mesmo header do 401 de refresh, sem criar uma segunda convenção. Cobrir com testes de paridade (unitário no autenticador + HTTP numa rota autenticada real que não é a de refresh).

## Boundaries & Constraints

**Always:**
- O import de `core.exceptions` dentro de `core/authentication.py` é **em runtime, dentro do método** — nunca no topo do módulo. **Comprovado empiricamente nesta pass:** `from core.exceptions import _NO_ACTIVE_ACCOUNT` no nível do módulo derruba `django.setup()` com `ImportError: cannot import name '_NO_ACTIVE_ACCOUNT' from partially initialized module 'core.exceptions'` — a cadeia é `core/models.py` → `core.tenant` → `core.exceptions:26` (`from rest_framework.views import ...`) → `rest_framework/schemas/__init__.py:32` avalia `api_settings.DEFAULT_AUTHENTICATION_CLASSES` → importa `core.authentication` enquanto `core.exceptions` está a meio caminho (o nome está na linha 39, depois da 26). É o mesmo perigo que o docstring do módulo já documenta para `core.tenant`.
- O corpo do 401 colapsado é a **mesma forma** do 401 de refresh: `{"detail": str}` **sem** chave `fields`. Isso exige levantar o `AuthenticationFailed` **nativo do DRF** (`rest_framework.exceptions`), não o do simplejwt — o do simplejwt tem `DetailDictMixin`, que empacota `{"detail", "code"}` num dict e faz `_normalise_body` emitir `fields: {code: [...]}`.
- Reusar `_NO_ACTIVE_ACCOUNT` como fonte única: nunca copiar o literal da mensagem.
- O `WWW-Authenticate` é responsabilidade do DRF: `APIView.handle_exception` deriva o challenge e o gruda em `exc.auth_header`, e `exception_handler` o copia para a resposta. Com **uma** exceção para os dois casos, a paridade de header é estrutural.
- Colapsar **só** `user_not_found` e `user_inactive`. `token_not_valid` (`InvalidToken`, incluindo o ramo de claim ausente) e `password_changed` seguem passando intactos.
- `authenticate()` (`core/authentication.py:39-44`) fica byte-idêntico: o caminho de sucesso e o set do tenant context não mudam.
- Os testes novos usam Bearer token real (`AccessToken.for_user`), nunca `force_authenticate` — a fixture `auth_client` do `conftest.py` bypassa o autenticador e não exercitaria nada disto.

**Block If:**
- Colapsar os ramos exigir tocar o simplejwt (fork, monkeypatch, subclasse de serializer) ou mexer em `DEFAULT_AUTHENTICATION_CLASSES`.
- A suíte completa quebrar num teste que dependa das mensagens/códigos antigos de forma que não seja mera atualização de asserção.

**Never:**
- Não alterar `DEFAULT_AUTHENTICATION_CLASSES`/`DEFAULT_PERMISSION_CLASSES`, `SIMPLE_JWT` (em especial não sobrescrever `CHECK_USER_IS_ACTIVE`, que fica no default `True`) nem qualquer setting global.
- Não tocar no ramo `User.DoesNotExist` do handler central nem em `_authenticate_header` (`core/exceptions.py:189-241`) — a DW-25 está fechada e verde.
- Não chamar `_authenticate_header` de dentro do autenticador: ele espera o `context` dict do handler (view+request), que não existe nessa camada.
- Não usar a rota de refresh como sujeito do teste de paridade novo.
- Não alterar `schema.yaml`, `types.gen.ts` nem anotações de schema das views (nenhuma rota autenticada documenta 401 hoje — só as duas de `accounts` documentam, e nenhuma delas muda).
- Não mexer no ledger de deferred work.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Usuário apagado em rota autenticada | `GET /api/bujo/logs/today/` + Bearer válido, linha do usuário deletada | 401, corpo `{"detail": "No active account found for the given token."}`, **sem** `fields`, com `WWW-Authenticate` | `AuthenticationFailed` colapsado |
| Usuário desativado em rota autenticada | idem, `is_active=False` | Resposta **idêntica** à de cima: mesmo status, mesmo JSON, mesmo `WWW-Authenticate` | idem |
| Token estruturalmente inválido (inalterado) | `Authorization: Bearer garbage` | 401 com `fields.code == ["token_not_valid"]` | `InvalidToken` passa sem colapso |
| Token sem claim de usuário (inalterado) | Access token sem `user_id` | 401 `token_not_valid` | `InvalidToken` passa sem colapso |
| Usuário ativo (inalterado) | Bearer válido de usuário ativo | 200 e `current_user_id` setado | Nenhum erro esperado |
| Sem credenciais (inalterado) | Nenhum header `Authorization` | `authenticate()` devolve `None` → 401 `NotAuthenticated` | Não passa por `get_user` |
| Refresh de apagado/desativado (inalterado) | `POST /api/accounts/token/refresh/` | Paridade da DW-25 segue valendo | Handler central |

</intent-contract>

## Code Map

- `backend/core/authentication.py:38-44` — **alvo**. `TenantAwareJWTAuthentication(JWTAuthentication)` com só `authenticate()`. O docstring do módulo (linhas 1-30) já explica o perigo de import circular e o porquê de `core.context` em vez de `core.tenant` — o novo comentário deve se ancorar nele.
- `backend/.venv/lib/python3.13/site-packages/rest_framework_simplejwt/authentication.py:120-148` — **read-only (dependência)**. `get_user`: `InvalidToken` para claim ausente (`:126-129`); `AuthenticationFailed(_("User not found"), code="user_not_found")` para `DoesNotExist` (`:133-136`); `AuthenticationFailed(_("User is inactive"), code="user_inactive")` para `not user.is_active` sob `CHECK_USER_IS_ACTIVE` (`:138-139`); `password_changed` sob `CHECK_REVOKE_TOKEN` (`:141-147`, default `False`). Não editar.
- `backend/.venv/lib/python3.13/site-packages/rest_framework_simplejwt/exceptions.py:24-57` — **read-only**. `DetailDictMixin` monta `{"detail", "code"}`; `AuthenticationFailed(DetailDictMixin, exceptions.AuthenticationFailed)`; **`InvalidToken` é subclasse de `AuthenticationFailed`** — por isso o filtro por `code` (e não por classe) é o discriminador correto.
- `backend/core/exceptions.py:30-39` — `_NO_ACTIVE_ACCOUNT`, a msgid congelada a reusar. `:189-209` — ramo `User.DoesNotExist` da DW-25 (não tocar). `:215-241` — `_authenticate_header`, que espera o `context` do handler (não aplicável ao autenticador). `:244-288` — `_normalise_body`: se o corpo é dict com `detail`, as demais chaves viram `fields` (é isto que produziria `fields.code`).
- `backend/.venv/lib/python3.13/site-packages/rest_framework_simplejwt/serializers.py:100-121` — **read-only**. `TokenRefreshSerializer` levanta o `AuthenticationFailed` **nativo do DRF** com a mesma msgid — a forma `{"detail": str}` sem `fields` que o 401 novo deve espelhar.
- `backend/core/tests/test_authentication.py:28-65` — **alvo dos testes**. 3 testes hoje: token válido seta contexto (`:29`), sem credenciais (`:41`), scheme do spectacular (`:51`). Nenhum exercita usuário apagado ou inativo. Já importa `AccessToken`, `UserFactory`, `Request`, `APIRequestFactory` — reusar.
- `backend/accounts/tests/test_views.py:13-48,343-382` — **molde do teste de paridade**: helpers `_desativar`/`_apagar` e `test_token_refresh_401_de_desativado_e_de_apagado_sao_indistinguiveis` (mesmo status + mesmo JSON + mesmo `WWW-Authenticate`, com asserções de não-vacuidade e `translation.override("pt-br")` vs `("en-us")`). Cada caso precisa do seu próprio usuário (as duas mutações são destrutivas).
- `backend/bujo/urls.py:40` — `path("logs/today/", TodayLogView.as_view(), name="bujo-today-log")`: rota autenticada real usada na reprodução. É a rota do teste HTTP novo — acoplamento apenas por **string de URL**, sem import de `bujo` em `core` (o contrato do import-linter em `pyproject.toml:51-63` continua verde).
- `backend/bujo/tests/test_views.py:2999` — exemplo do padrão `client.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(user)}")`.
- `backend/conftest.py:31-33,60-67` — acesso a DB é autouse **sem condição**: `_enable_db_access(db)` é `@pytest.fixture(autouse=True)`, então vale para todo teste da suíte, com ou sem fixture, e `@pytest.mark.django_db` é redundante em qualquer um deles (os 3 testes pré-existentes deste módulo o carregam por herança histórica, não por necessidade). `auth_client` usa `force_authenticate` e **não serve** aqui.
- `backend/core/tests/test_prod_settings.py` — **alvo secundário**. O único arquivo que importa `config.settings.prod` direto; o docstring dele diz que existe para claims de produção que nada mais checa (DW-4/DW-22/DW-23). É onde o pin dos settings de JWT ganha o eixo de ambiente que o pin em `core/tests/` não tem.
- `backend/config/settings/base.py:122-144` — `SIMPLE_JWT` (sem `CHECK_USER_IS_ACTIVE` → default `True`) e `EXCEPTION_HANDLER`/`DEFAULT_AUTHENTICATION_CLASSES`. Read-only.
- `frontend/src/api/client.ts:30` — o interceptor de 401 chaveia só em `status !== 401`, nunca no corpo/`code`: a mudança de corpo não afeta o refresh single-flight.
- Baseline de grep (confirmado nesta pass): `user_not_found`, `user_inactive`, `User not found`, `User is inactive` têm **zero** ocorrências em `backend/` fora de `.venv`. Nenhum teste asseve a distinção hoje.

## Tasks & Acceptance

**Execution:**
- `backend/core/authentication.py` -- adicionar `get_user(self, validated_token)` que chama `super().get_user(...)`, captura `rest_framework.exceptions.AuthenticationFailed`, extrai o `code` do `detail` (dict → `detail["code"]`; `ErrorDetail` → `.code`), re-levanta intacto quando o código não é `user_not_found`/`user_inactive`, e, quando é, importa `_NO_ACTIVE_ACCOUNT` **em runtime** e levanta `AuthenticationFailed(_NO_ACTIVE_ACCOUNT, code="no_active_account") from exc`; comentário curto citando DW-31/DW-25, o motivo do filtro por código (`InvalidToken` é subclasse) e o import circular comprovado -- colapsa os dois ramos numa exceção só, o que torna status, corpo, código e header idênticos por construção.
- `backend/core/tests/test_authentication.py` -- testes unitários chamando `TenantAwareJWTAuthentication().get_user(AccessToken.for_user(user))` direto: (a) usuário apagado e (b) usuário `is_active=False` levantam `AuthenticationFailed` com `detail`/`code` **iguais entre si** e iguais a `_NO_ACTIVE_ACCOUNT`/`no_active_account`; (c) regressão de não-colapso: token sem claim `user_id` segue levantando `InvalidToken` com `token_not_valid` -- pinça o autenticador sem o stack HTTP e prova que o filtro é estreito.
- `backend/core/tests/test_authentication.py` -- teste de paridade HTTP em `GET /api/bujo/logs/today/` com Bearer real, no molde de `accounts/tests/test_views.py:343-382`: mesmo status, `response.json()` idêntico, `WWW-Authenticate` idêntico **e não vazio**, e não-vacuidade de locale comparando `translation.override("pt-br")` contra `("en-us")` na mesma rota -- prova a propriedade na superfície onde ela vale (rota autenticada qualquer), que é o furo que a DW-25 não fechou.

**Acceptance Criteria:**
- Dado um access token válido cujo usuário foi apagado do banco e outro cujo usuário está com `is_active=False`, quando ambos chamam a mesma rota autenticada, então as duas respostas são indistinguíveis em status, corpo JSON e header `WWW-Authenticate`, e nenhuma delas menciona apagado/inexistente/inativo.
- Dado que a suíte completa do backend roda (`uv run pytest`), quando ela termina, então está verde — incluindo os 3 testes pré-existentes de `core/tests/test_authentication.py` e a paridade da DW-25 em `accounts/tests/test_views.py`.
- Dado o `schema.yaml` commitado, quando o schema é regerado a partir das views, então não há diff.
- Dado o contrato de import do `core` (`uv run lint-imports`), quando ele é verificado, então segue verde — e `django.setup()` continua funcionando, sem `ImportError` circular.

## Spec Change Log

## Review Triage Log

### 2026-08-04 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 9: (high 0, medium 3, low 6)
- defer: 8: (high 1, medium 4, low 3)
- reject: 7: (high 0, medium 0, low 7)
- addressed_findings:
  - `[medium]` `[patch]` O ramo de colapso descartava qual dos dois casos disparou, sem log nenhum — o cliente deixa de distinguir, mas o operador também deixava. Adicionado `logger.warning` registrando o código original (sem `exc_info`, sem id de usuário nem conteúdo de token), no mesmo espírito do `logger.warning` da DW-25, mais teste com `caplog`.
  - `[medium]` `[patch]` `_INDISTINGUISHABLE_CODES` duplicava um contrato do upstream com detecção de drift só indireta — um rename do simplejwt falharia como "indistinguibilidade quebrada", apontando para o canal lateral em vez do rename. Adicionado pin direto contra a implementação-pai (`JWTAuthentication.get_user`), no molde de `test_frozen_msgid_still_matches_the_one_simplejwt_raises`.
  - `[medium]` `[patch]` "Não criar uma segunda convenção" é propriedade CROSS-superfície e nada a pinçava: o teste da DW-25 compara refresh×refresh e o novo compara rota×rota. Adicionado teste que asseve corpo e `WWW-Authenticate` idênticos nas quatro combinações (apagado/inativo × refresh/rota autenticada).
  - `[low]` `[patch]` O comentário justificava excluir `password_changed` alegando que ele não diz nada sobre existência de linha — falso, o upstream só o levanta depois do lookup achar a linha e `is_active` passar. Comentário reescrito com o motivo real (inalcançável hoje + não separa apagado de inativo).
  - `[low]` `[patch]` Metade de `_failure_code` (forma não-dict e caminho sem código) nunca era exercitada. Adicionados testes diretos das três formas; ramos defensivos testados, não removidos.
  - `[low]` `[patch]` A prova de que a exceção levantada é a nativa do DRF era só o proxy `not isinstance(detail, dict)`. Adicionadas a asserção direta de classe e a de `__cause__` carregando o código original.
  - `[low]` `[patch]` Nada pinçava o caminho felizes ATRAVÉS do override — `get_user` é o único caminho que devolve o usuário autenticado. Adicionado teste direto.
  - `[low]` `[patch]` O teste do claim ausente hardcodava `"user_id"`, que é configurável em `config/settings/base.py:129`. Passou a usar `api_settings.USER_ID_CLAIM`.
  - `[low]` `[patch]` O docstring atribuía a cópia do `WWW-Authenticate` ao handler central; quem copia é o handler **default** do DRF, que o nosso chama primeiro. Corrigido, e registrada a herança do rebaixamento para 403 do `APIView.handle_exception`.

### 2026-08-04 — Review pass (follow-up)
- intent_gap: 0
- bad_spec: 0
- patch: 9: (high 1, medium 1, low 7)
- defer: 9: (high 1, medium 4, low 4)
- reject: 16: (high 0, medium 0, low 16)
- addressed_findings:
  - `[high]` `[patch]` **Os 8 defers da pass anterior nunca chegaram ao ledger** — ficaram só no frontmatter `deferred:` desta spec, e a DW-31 foi fechada como `done` por cima deles. Levantado por três reviewers independentes. Consequência: o item de severidade `high` (bypass de desativação nas rotas de automação) ficaria invisível para a varredura, exatamente o modo de falha que o `reason` da DW-34 já documenta ("nunca chegou a este arquivo, então sobreviveu a três passes invisível"). Promovidos ao ledger como **DW-41..DW-48**, entradas NOVAS, sem tocar em nenhuma existente (a invocação autoriza append e proíbe modificar/reabrir). A entrada DW-31 em si ficou intacta.
  - `[medium]` `[patch]` Os dois settings de que o colapso depende não eram pinçados por nada. `CHECK_USER_IS_ACTIVE=False` faz o ramo `user_inactive` deixar de existir — usuário desativado volta a receber **200** em toda rota autenticada, bypass e não canal lateral — e o `Never` do intent só o afirmava em prosa. `CHECK_REVOKE_TOKEN=True` torna `password_changed` alcançável e divulgando existência de linha, sem nada vermelho. Adicionado `test_os_dois_settings_de_que_o_colapso_depende_seguem_nos_defaults_seguros`, lendo pelo módulo (`reload_api_settings` **rebinda** o global `api_settings`, então nome importado por valor não veria um `override_settings`). Mutação: com os dois virados num settings module, o teste FALHA; na config real, passa. É tripwire com mensagem apontando para a decisão deferida, não veto — a DW-44 registra que a decisão segue aberta.
  - `[low]` `[patch]` O docstring de `get_user` prometia mais do que entrega: "em toda request autenticada" e "uma convenção só ... em todo o projeto". A propriedade cobre as ~71 rotas sob `DEFAULT_AUTHENTICATION_CLASSES`, **não** as 2 de `AutomationTokenAuthentication`; e o `code` `no_active_account` tem dois msgids (o login usa "...with the given credentials", `serializers.py:35` — verificado). Docstring reescrito nomeando o que iguala (forma do corpo + eixo apagado-vs-inativo) e o que não cobre.
  - `[low]` `[patch]` O comentário do teste cross-superfície justificava `json.dumps` por "uma chave não-hasheável quebraria o `set`" — errado: é o dict do corpo que não é hasheável, chave nenhuma entra nisso. Reescrito com o motivo real.
  - `[low]` `[patch]` O docstring de `test_401_de_token_invalido_...` dizia contrastar o colapso, mas `Bearer garbage` morre em `get_validated_token` **antes** de `get_user` — a request nem entra no `try`. Docstring corrigido para dizer o que o teste pinça de fato (a forma: um 401 não-colapsado ainda traz `fields`) e apontar quem pinça a estreiteza do filtro.
  - `[low]` `[patch]` O pin de códigos do upstream usa igualdade de conjunto, então alargar `_INDISTINGUISHABLE_CODES` de propósito falharia com cara de "o upstream renomeou um código". Adicionada mensagem de assert nomeando as duas causas possíveis.
  - `[low]` `[patch]` A paridade de `WWW-Authenticate` entre as duas superfícies é **coincidência** de dois defaults independentes (`TokenViewBase.www_authenticate_realm` vs. `JWTAuthentication.authenticate_header`), e nada nesta mudança a constrói. Comentário adicionado para a falha não ser lida como "as convenções se separaram" quando a causa é um realm mudando de um lado.
  - `[low]` `[patch]` O docstring do módulo de teste descrevia só o contrato de tenant-context, embora o arquivo tenha virado majoritariamente cobertura da DW-31 — inclusive o único teste cross-superfície do projeto. Parágrafo adicionado.
  - `[low]` `[patch]` A Verification desta spec pedia `ruff format --check .` esperando "sem violações", mas nesta árvore ele reporta 50 arquivos pré-existentes e a CI não roda format check: o comando nunca poderia passar, logo não carregava sinal. Escopado aos dois arquivos alterados, com o motivo registrado.

### 2026-08-04 — Review pass (terceira)
- intent_gap: 0
- bad_spec: 0
- patch: 8: (high 0, medium 2, low 6)
- defer: 1: (high 0, medium 0, low 1)
- reject: 18: (high 0, medium 0, low 18)
- addressed_findings:
  - `[medium]` `[patch]` **A paridade cross-superfície depende de um TERCEIRO setting que nada pinçava.** O 401 de desativado no refresh não vem de `CHECK_USER_IS_ACTIVE`: `TokenRefreshSerializer` chama `api_settings.USER_AUTHENTICATION_RULE(user)`, cujo default é quem consulta `is_active` (verificado no simplejwt instalado). Apontá-lo para uma regra que aceite inativos faz o refresh devolver **200** para desativado e 401 para apagado — eixo da DW-25 reaberto do lado grosseiro — com os dois pins existentes verdes e só o teste cross-superfície falhando como sintoma. Adicionado `test_o_setting_de_que_a_paridade_do_refresh_depende_segue_no_default_seguro`. Mutação: com a regra trocada, FALHA; na config real, passa.
  - `[medium]` `[patch]` **Os pins de settings não veem o settings module de produção.** Eles leem `simplejwt_settings.api_settings`, isto é, o módulo que o pytest carregou (`config.settings.test` local, `config.settings.dev` na CI) — nunca `prod`. Um override de `SIMPLE_JWT` só em `prod.py` passaria verde, restaurando o bypass de desativação (`CHECK_USER_IS_ACTIVE=False`) ou o oráculo de existência (`CHECK_REVOKE_TOKEN=True`) no único ambiente que importa. Hoje `SIMPLE_JWT` existe só em `base.py`, então é lacuna latente, não bug vivo. Adicionado `test_prod_mantem_os_settings_de_jwt_de_que_a_indistinguibilidade_depende` em `core/tests/test_prod_settings.py` — o arquivo que existe declaradamente para essa classe de ponto cego (DW-4/DW-22/DW-23) — resolvendo os três knobs pelos `DEFAULTS` do upstream, não por literais. Mutação: os três mutantes morrem; baseline passa.
  - `[low]` `[patch]` O `zip(..., strict=True)` do teste de log assume exatamente 2 registros sem dizer, então um registro a mais ou a menos saía como `ValueError` cru em vez de asserção nomeada. Adicionado `assert len(mensagens) == 2, mensagens` antes dele.
  - `[low]` `[patch]` O nome local `jwt_settings` no teste dos settings **sombreava** o import do topo — justamente o global obsoleto contra o qual o docstring do teste dedica um parágrafo. Renomeado para `settings_vivos`, com o motivo do nome registrado: se a linha caísse num refactor, o teste passaria a ler o objeto errado em silêncio.
  - `[low]` `[patch]` O overclaim "uma convenção só em todo o projeto", removido do docstring de `get_user` na pass anterior, sobrevivia em dois outros lugares: o docstring do teste cross-superfície e as Design Notes. A DW-49 contradiz os dois (o login usa outro msgid com o mesmo `code`). Reescritos para "nas duas superfícies que este colapso liga".
  - `[low]` `[patch]` A matriz do intent nomeia o corpo exato do 401, e nada o asseverava **no fio** — só transitivamente (a exceção contra a constante, num teste de objeto; e a rota contra o refresh). Adicionada asserção do corpo em en-us contra `_NO_ACTIVE_ACCOUNT`, resolvido dentro do `translation.override` e nunca por literal copiado.
  - `[low]` `[patch]` O Code Map afirmava que o autouse de DB "dispensa `@pytest.mark.django_db` em testes com fixture" — o qualificador é falso: `_enable_db_access(db)` é `@pytest.fixture(autouse=True)` sem condição, valendo para todo teste. Corrigido, e registrado que os 3 testes pré-existentes carregam o marker por herança histórica.
  - `[low]` `[patch]` A Verification não tinha eixo nenhum de frontend, embora a mudança altere o corpo de 401 em toda rota autenticada. Adicionado `vitest run src/api/client.test.ts` (o interceptor de 401 é o único consumidor de 401 no cliente) com o motivo pelo qual o Playwright **não** roda aqui: nenhum cenário de E2E apaga ou desativa usuário no meio da sessão, e a expiração normal (`token_not_valid`) segue byte-idêntica.

## Design Notes

**Por que filtrar por `code` e não por classe de exceção.** `InvalidToken` herda de `AuthenticationFailed` no simplejwt, então `except AuthenticationFailed` sozinho engoliria também o 401 de token inválido — que não revela existência de linha e não deve ser colapsado. O `code` é o único discriminador estável dos dois ramos exatos que a decisão nomeia. Se o simplejwt renomear esses códigos no futuro, o colapso deixa de acontecer e o teste de paridade fica vermelho — falha visível, não silenciosa.

**Por que capturar o `AuthenticationFailed` do DRF (superclasse) e levantar o do DRF (nativo).** Capturar a superclasse cobre os dois (o do simplejwt herda dela). Levantar o nativo — sem `DetailDictMixin` — é o que produz `{"detail": str}` sem `fields`, exatamente o corpo do 401 de refresh da DW-25: uma convenção só para "no active account" **nas duas superfícies que este colapso liga** (rota autenticada e refresh). Não em todo o projeto: o login levanta o mesmo `code` com outro msgid (`serializers.py:35`), divergência registrada à parte — e é por isso que o teste cross-superfície compara duas superfícies, não três.

**Forma esperada:**

```python
def get_user(self, validated_token):
    try:
        return super().get_user(validated_token)
    except AuthenticationFailed as exc:  # rest_framework.exceptions
        if _failure_code(exc) not in _INDISTINGUISHABLE_CODES:
            raise
        from core.exceptions import _NO_ACTIVE_ACCOUNT  # runtime: ver docstring
        raise AuthenticationFailed(_NO_ACTIVE_ACCOUNT, code="no_active_account") from exc
```

**Desvio consciente da decisão do ledger: `_authenticate_header` não é chamado.** A decisão de 2026-08-04 manda "reusar a mensagem congelada `_NO_ACTIVE_ACCOUNT` e o helper `_authenticate_header` ... para nao criar uma segunda convencao". A mensagem é reusada; o helper **não** — e não pode ser, na mesma frase que manda sobrescrever `get_user`. `_authenticate_header(context)` lê `context["view"]`/`context["request"]` e existe só porque a DW-25 constrói um `Response` **à mão** dentro do handler, contornando o caminho normal do challenge (o próprio docstring dele diz isso em `core/exceptions.py:218-223`). Este código não constrói resposta: ele **levanta exceção**, então o caminho que o helper compensa é exatamente o caminho que volta a rodar, e o challenge sai da *mesma* chamada que o helper embrulha (`view.get_authenticate_header(request)`). Cumprimento literal ausente, cumprimento do objetivo completo — e agora pinçado por teste: a paridade de header é asseverada com não-vacuidade, e o corpo/challenge do 401 de refresh é comparado contra o da rota autenticada, que é a propriedade "uma convenção só" que a frase queria. Consequência de viver nessa camada, registrada no docstring de `get_user`: o rebaixamento para 403 do `APIView.handle_exception` (challenge vazio) é herdado, em vez de dispensado como faz o helper.

**Sobre o eixo de locale no teste novo.** Vale a mesma leitura registrada em `accounts/tests/test_views.py:352-361`: hoje não há `LocaleMiddleware` e `LANGUAGE_CODE="en-us"`, então em produção os dois corpos saem em inglês e só o `translation.override` do teste ativa pt-br. O valor vivo dessa metade é detectar um rewording futuro do simplejwt (a msgid deixaria de casar com o catálogo e as duas strings colapsariam numa só, em inglês).

## Verification

**Commands:**
- `cd backend && uv run pytest core/tests/test_authentication.py core/tests/test_exceptions.py core/tests/test_prod_settings.py accounts/tests/test_views.py -q` -- expected: verde; os testes novos falham **antes** da mudança em `core/authentication.py` (baseline vermelho comprovando não-vacuidade) e passam depois.
- `cd backend && uv run pytest` -- expected: suíte completa verde. Obrigatório, não escopado: a mudança altera o corpo de 401 em TODA rota autenticada.
- `cd backend && uv run ruff check .` -- expected: sem violações (é o que a CI roda, `.github/workflows/ci.yml:71`).
- `cd backend && uv run ruff format --check core/authentication.py core/tests/test_authentication.py` -- expected: já formatados. Escopado aos arquivos alterados de propósito: `ruff format --check .` reporta 50 arquivos pré-existentes nesta árvore e a CI não roda format check, então a versão não-escopada nunca passaria e não carregaria sinal nenhum.
- `cd backend && uv run lint-imports` -- expected: contrato do `core` verde.
- `cd backend && uv run python manage.py spectacular --file /tmp/schema-check.yaml && diff /tmp/schema-check.yaml ../schema.yaml` -- expected: sem diff.
- `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run python -c "import django; django.setup()"` -- expected: sem saída de erro (guarda direta contra o import circular comprovado).
- `cd frontend && nvm use 22.15.1 && npx vitest run src/api/client.test.ts` -- expected: verde. Único eixo de frontend com sinal aqui: o interceptor de 401 é o **único** consumidor de 401 no cliente, e a mudança altera o corpo de 401 em toda rota autenticada. O gate real é ele mais o grep (`user_not_found`/`user_inactive`/`no_active_account`/`token_not_valid`/`No active account` têm zero ocorrências em `frontend/src` e `frontend/e2e`, e `client.ts:30` chaveia só em `status`). **Playwright deliberadamente não roda** nesta mudança: nenhum cenário de E2E apaga ou desativa um usuário no meio da sessão, então a suíte só re-provaria caminhos intocados — o corpo muda apenas para apagado/desativado, e a expiração normal (`token_not_valid`) segue byte-idêntica.


## Auto Run Result

Status: done
Blocking condition: nenhuma

### Mudança implementada

`TenantAwareJWTAuthentication` sobrescreve `get_user` e colapsa os dois ramos do simplejwt que revelavam o estado da linha do usuário (`user_not_found` para linha apagada, `user_inactive` para linha existente mas inativa) num único `AuthenticationFailed` **nativo do DRF**, com a mensagem congelada `_NO_ACTIVE_ACCOUNT` e código `no_active_account`. Nas ~71 rotas cujo autenticador é este, os dois casos produzem status, corpo JSON e `WWW-Authenticate` idênticos. Filtro por `code`, não por classe (`InvalidToken` é subclasse). `authenticate()` byte-idêntico.

Esta terceira pass não mudou comportamento: 8 patches, todos de verificação e precisão. As duas de severidade `medium` fecham lacunas reais de guarda — a paridade do refresh dependia de um terceiro setting não pinçado, e os pins existentes não enxergavam o settings module de produção. As seis `low` são precisão de asserção e de documentação.

### Arquivos alterados

- `backend/core/authentication.py` — o override `get_user` + `_INDISTINGUISHABLE_CODES` + `_failure_code` + `logger.warning`. **Inalterado nesta pass.**
- `backend/core/tests/test_authentication.py` — 15 testes de DW-31 (3 pré-existentes no módulo). Nesta pass: `test_o_setting_de_que_a_paridade_do_refresh_depende_segue_no_default_seguro` (novo), asserção do corpo no fio, `assert len(mensagens) == 2`, fim do sombreamento de `jwt_settings`, e o docstring do teste cross-superfície sem o overclaim.
- `backend/core/tests/test_prod_settings.py` — **novo alvo**: `test_prod_mantem_os_settings_de_jwt_de_que_a_indistinguibilidade_depende`, que resolve os três knobs de `SIMPLE_JWT` contra `config.settings.prod`, mais o bullet de DW-31 no docstring do módulo.
- `_bmad-output/implementation-artifacts/deferred-work.md` — **apenas append**: entrada nova DW-50 (8 inserções, 0 remoções, conferido no diff). Nenhuma entrada existente modificada.
- `_bmad-output/implementation-artifacts/spec-dw-31-auth-401-indistinguishability.md` — triage log desta pass, o defer novo no frontmatter, o Code Map corrigido, as Design Notes sem o overclaim e a Verification com o eixo de frontend.

### Achados de review

- **patch: 8 aplicados** (high 0, medium 2, low 6) — detalhe por achado no `## Review Triage Log`.
- **defer: 1** (low) — DW-50: o Finalize do step-04 commita o bookkeeping pré-staged do ledger junto com os patches da pass, e o commit se descreve errado. Verificado por `git show`: `e889ead` carrega os appends DW-41..DW-49 **e** a virada `status: open` → `done` da entrada DW-31, enquanto sua mensagem afirma "Só append: nenhuma entrada existente foi modificada". A pass anterior rejeitou este achado como "bookkeeping não-commitado" — leitura correta no momento do review, superada pelo próprio Finalize dela.
- **reject: 18** (todos low) — os principais: "o pin do conjunto de rotas que optam por fora de `DEFAULT_AUTHENTICATION_CLASSES`" (mesma guarda que a **DW-35** já propõe — meta-teste caminhando pelo `ROOT_URLCONF` —, e criar entrada nova seria quase-duplicata); "o msgid lazy chega sem `str()` ao contrário do ramo da DW-25" (inerte: `_get_error_details` do DRF faz `force_str` na construção, dentro da request, e a asserção pt≠en prova o locale certo); flood e falta de correlação no log (re-adjudicados pela terceira vez — exige assinatura válida, logo limitado ao TTL do access token; e `get_user(validated_token)` não tem a request, então path/request-id não estão disponíveis nessa camada); "a AC de schema sem diff é gate vazio" (ela guarda o `Never` de não tocar anotações de view, que é falhável); `review_loop_iteration: 0` "contradiz o triage log" (conta loopbacks de bad_spec, que seguem em zero); "a spec diz `in-review` e o ledger diz `done`" (o `in-review` é exigido pelo próprio step-04 e vira `done` no Finalize); "as duas convenções de `@pytest.mark.django_db` no arquivo" (convenção dos vizinhos, adjudicado duas vezes) — mas o qualificador **falso** que o Code Map usava para justificá-la foi corrigido; `AUTH_HEADER_TYPES` hardcoded (um "Bearer" errado falha alto, não passa vazio — modo de falha oposto ao de `USER_ID_CLAIM`); "citação errada de `client.ts:30`" (**verificado como correta**: a linha 30 é o `status !== 401`); a contradição 1385-vs-1390 na DW-45 (explicada — testes foram acrescentados no meio daquela pass); e as linhas `decision:` duplicadas (DW-48; a invocação proíbe editar entrada existente).
- **intent_gap: 0 · bad_spec: 0.** A divergência de superfície descrita pelo intent-alignment auditor (título e Problem afirmam "projeto-inteiro"; Approach, Boundaries e matriz escopam a `TenantAwareJWTAuthentication.get_user`) foi re-adjudicada pela terceira vez como não-intent_gap, com autoridade do próprio intent. O auditor mediu na mão os oráculos sobreviventes e todos já estão no ledger: DW-41 (automação: desativado recebe **200**), DW-42 (signup), DW-43, DW-47. O login **não** vaza (apagado e desativado dão a mesma resposta).

### Recomendação de review de follow-up

`true`. Patches por severidade: high 0, medium 2, low 6. Dispara pelo score: 3×2 + 1×6 = **12** (≥ 5). Sem patch `high` nesta pass — o eixo de severidade caiu em relação à anterior (que teve 1 high), e o conteúdo migrou de "achado central grave" para "lacuna de guarda + precisão". A decisão de gastar outra pass é do orquestrador; o que sobra de substantivo está listado nos riscos residuais, não em achados abertos.

### Verificação realizada

Rodada por mim depois dos patches:

- `uv run pytest core/tests/test_authentication.py core/tests/test_prod_settings.py -q` → **23 passed**.
- `uv run pytest` (suíte completa, obrigatória) → **1393 passed** em 4m34s (+2 testes novos sobre os 1391 da pass anterior). Limpa — sem reprodução do flake da DW-45.
- **Mutação dos dois pins novos** (não-vacuidade provada, não presumida): com `CHECK_REVOKE_TOKEN=True`, `CHECK_USER_IS_ACTIVE=False` e `USER_AUTHENTICATION_RULE` trocado em `config.settings.prod`, os três mutantes **morrem** com a mensagem certa; com `USER_AUTHENTICATION_RULE` trocado em runtime via `override_settings`, o pin de runtime **morre**. Baseline passa nos dois casos.
- `uv run ruff check .` → All checks passed. `ruff format --check` nos três arquivos → já formatados (o arquivo novo precisou de um `ruff format`, aplicado).
- `uv run lint-imports` → 1 kept, 0 broken.
- `manage.py spectacular` + `diff` contra `schema.yaml` → **sem diff** (3 warnings pré-existentes, DW-38).
- `django.setup()` sob `config.settings.test` → OK.
- **Frontend** (eixo que faltava): `nvm use 22.15.1 && npx vitest run src/api/client.test.ts` → **10 passed**. Playwright deliberadamente não rodado, com o motivo registrado na Verification.
- **Ledger conferido como append puro:** `git diff` da `deferred-work.md` = 8 inserções, 0 remoções.
- **Frontmatter revalidado como YAML:** uma única chave `deferred`, 10 itens, os 9 anteriores preservados e cada um com `evidence` não-vazio.

### Riscos residuais

- **A indistinguibilidade não é projeto-inteiro, apesar do nome da DW.** As 2 rotas de automação separam apagado de desativado por 200-vs-401 — e o auditor desta pass mediu isso na mão, não por leitura de código: com token de automação válido, dono apagado → 401, dono `is_active=False` → **200 com corpo completo**. É simultaneamente bypass de desativação (DW-41, `high`). Segue no ledger, aberto.
- **O colapso depende de três settings do simplejwt e das strings de `code` do upstream.** Depois desta pass todos os quatro eixos têm pin, e o de settings tem pin também contra `config.settings.prod`. O que nenhum pin cobre é um código **novo** que o upstream venha a acrescentar e que também divulgue existência de linha — só `password_changed` está mapeado (DW-44).
- **`schema.yaml` não documenta a forma de 401 que esta mudança tornou canônica** (DW-46). Nenhum consumidor quebra: o interceptor chaveia só em status (10 testes verdes) e o grep não acha os códigos antigos em `frontend/src` nem `frontend/e2e`.
- **O gate de suíte completa não é 100% confiável** (DW-45), embora as execuções desta pass e da anterior tenham sido limpas.
- **A trilha de auditoria do ledger é ambígua para a entrada DW-31** (DW-50): a resolução dela está atribuída ao commit de uma review pass que estava proibida de mexer em entradas existentes. Nada corrompido; commit e mensagem errados.
