---
title: 'DW-11/DW-12/DW-14/DW-15: precisão do schema OpenAPI de accounts + guarda de CI contra drift'
type: 'chore'
created: '2026-08-03'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_revision: 'd36bb032ceaf36ed36adc94cd0719aa77c757baf'
final_revision: '635089cd8d729842536ed6f1498d39cd409e56a9'
context: []
warnings: ['multiple-goals', 'oversized']
deferred:
  - summary: >-
      O novo step de CI (DW-14) fecha só a superfície "schema.yaml commitado bate com o que
      as anotações @extend_schema geram agora"; não adiciona um teste de contrato dinâmico
      (resposta HTTP real vs. schema documentado), então uma anotação plausível-mas-errada que
      fosse regerada e commitada de boa-fé passaria pelo check sem acusar nada -- a mesma forma
      de falha do bug original da DW-11.
    evidence: |-
      Achado pela auditoria de alinhamento de intenção (2026-08-03). O ledger da DW-14 oferece
      explicitamente as duas leituras ("contract test or schema-vs-view assertion", com
      "considerar"/"lightweight"), então implementar só a leitura estática é uma escolha
      sancionada pelo próprio intent, não um erro desta pass -- mas o gap residual é real: nada
      no diff executa os 3 endpoints e compara a resposta real contra o schema.yaml documentado.
    location: .github/workflows/ci.yml (step "Gerar schema OpenAPI e checar drift schema-vs-view")
    severity: medium
  - summary: >-
      `extend_schema_view` reatribui `TokenObtainPairView`/`TokenRefreshView` no lugar (mesmo
      objeto de classe do `rest_framework_simplejwt.views`, técnica oficial do drf-spectacular
      com isolamento anti-vazamento via `isolate_view_method`) -- qualquer código futuro que
      importe essas classes direto do módulo do simplejwt (nenhum hoje) herdaria silenciosamente
      os metadados de schema anexados aqui.
    evidence: |-
      Achado pelo blind-hunter (2026-08-03). Confirmado lendo `drf_spectacular/utils.py:656-681`:
      o decorator muta e retorna o MESMO objeto de classe, não uma cópia/subclasse. Sem efeito em
      runtime (só metadados de introspecção do drf-spectacular) e sem caminho real hoje --
      `accounts/urls.py` era o único importador dessas classes no repo inteiro, e esta pass o fez
      importar de `accounts.views` (a versão anotada), não mais do módulo do simplejwt.
    location: backend/accounts/views.py (TokenObtainPairView/TokenRefreshView reassignment)
    severity: low
  - summary: >-
      O novo step de CI (`diff /tmp/schema.committed.yaml ../schema.yaml || (echo ... && exit 1)`)
      não distingue exit code 1 do `diff` (conteúdo diverge) de 2+ (erro de I/O, ex. arquivo
      ilegível) -- os dois caem no mesmo `||` e mostram a mesma mensagem de "schema divergiu".
    evidence: |-
      Achado pelo edge-case-hunter (2026-08-03). O step-irmão pré-existente "Verificar types.gen.ts
      está atualizado" (mesmo arquivo, alguns steps abaixo) já tem a mesma característica -- não
      introduzida por este diff, e corrigir só o step novo quebraria o objetivo explícito de
      consistência de estilo desta bundle ("mesmo padrão do check de types.gen.ts já existente").
    location: .github/workflows/ci.yml (step "Gerar schema OpenAPI e checar drift schema-vs-view")
    severity: low
  - summary: >-
      `health` (`core/views.py`) tem exatamente o mesmo padrão que causava o bug da DW-15 em
      `signup` (`@api_view` + `permission_classes=[AllowAny]` sem `authentication_classes=[]`
      próprio, herdando `DEFAULT_AUTHENTICATION_CLASSES` global) -- um `Authorization` header
      inválido presente faz o liveness check 401ar em vez de 200ar, apesar do docstring dizer
      "no auth".
    evidence: |-
      Achado pela verification-gap review (2026-08-03), confirmado empiricamente rodando
      `GET /api/health/` com um header `Authorization` inválido: retorna 401 em vez de 200.
      Nenhum dos 2 testes existentes (`core/tests/test_health.py::test_health_returns_ok`,
      `accounts/tests/test_views.py::test_health_sem_auth_retorna_200`) envia um header
      `Authorization`, então a regressão fica invisível a ambos. Fora do escopo desta bundle
      (o ledger nomeia só `signup`/`token`/`token-refresh` de `accounts`) -- registrado como
      DW-24 no ledger.
    location: backend/core/views.py (health)
    severity: medium
  - summary: >-
      `TokenRefreshSerializer.validate()` (rest_framework_simplejwt) chama
      `get_user_model().objects.get(...)` sem tratar `DoesNotExist` -- um
      refresh token estruturalmente válido cujo usuário foi apagado do banco
      (não apenas desativado) produz um 500 não tratado em vez de um 401.
    evidence: |-
      Achado pelo edge-case-hunter (2026-08-03). Confirmado lendo o código-fonte
      instalado (rest_framework_simplejwt/serializers.py:111-124): não há
      try/except em torno do `.get()`. `custom_exception_handler`
      (core/exceptions.py) não reconhece `ObjectDoesNotExist` como
      `APIException` nem como `DomainError`, então cai no fallback `return None`
      e vira o 500 padrão do Django. Pré-existente, não introduzido por este
      diff (que só anota schema em torno destas views). Nenhum fluxo do app
      hoje apaga usuários de fato (só desativa via `is_active=False`), então o
      caminho só é alcançável por intervenção direta no banco/admin -- por isso
      severity medium, não high.
    location: rest_framework_simplejwt/serializers.py:111-124 (TokenRefreshSerializer.validate); backend/core/exceptions.py (custom_exception_handler)
    severity: medium
---

<intent-contract>

## Intent

**Problem:** `schema.yaml` documenta os 3 endpoints públicos de `accounts` (signup, token, token/refresh) de forma incompleta/errada em relação ao comportamento real: `signup` (`@api_view` sem `@extend_schema`) aparece como `200` com corpo vazio quando na realidade é `201` com `{"detail": "Conta criada com sucesso."}` e nenhum requestBody; nenhuma das 3 operações documenta os erros `400`/`401` que `accounts/tests/test_views.py` já exercita de verdade; e `signup` mostra `security: - jwtAuth: [] - {}` (JWT opcional) por herdar `DEFAULT_AUTHENTICATION_CLASSES` global, confuso num endpoint `AllowAny` que nunca autentica. E `ci.yml` hoje só valida `types.gen.ts` contra o `schema.yaml` **regerado nesta run** — nunca contra o `schema.yaml` versionado no repo — então esse tipo de drift podia se repetir sem CI acusar.

**Approach:** anotar `signup` com `@extend_schema(request=SignupSerializer, responses={201: ..., 400: ...})` e `authentication_classes=[]`; estender via `extend_schema_view` os `TokenObtainPairView`/`TokenRefreshView` do `simplejwt` (sem subclassar) com `responses={200: <serializer original>, 400: ..., 401: ...}`; regenerar `schema.yaml`/`types.gen.ts`; adicionar um step de CI que diffa o `schema.yaml` regerado contra o versionado (mesmo padrão do check de `types.gen.ts` já existente).

## Boundaries & Constraints

**Always:** os 3 corpos de erro documentados devem espelhar exatamente o que `core.exceptions.custom_exception_handler`/`_normalise_body` produz de verdade (verificado empiricamente, não só por leitura) — nunca inventar um formato "razoável" que a app não produz. `TokenObtainPairView`/`TokenRefreshView` continuam vindo de `rest_framework_simplejwt.views` (sem subclasse nova) — a anotação usa `extend_schema_view`, que isola a anotação por classe (não vaza entre as duas, mesmo compartilhando `TokenViewBase.post`). O novo step de CI segue o mesmo padrão (`cp` + regerar + `diff`) do step "Verificar types.gen.ts está atualizado" logo abaixo dele, para consistência de estilo.

**Block If:** _nenhum — os 3 corpos de erro reais foram confirmados rodando os fluxos (não é uma decisão de produto, é leitura de comportamento existente)._

**Never:** não tocar nenhuma view fora de `accounts` (o ledger nomeia só signup/token/token-refresh; outras apps não documentam 400/401 hoje e ficam fora desta bundle). Não introduzir um serializer de erro "oficial" reusável em `core/` — os 3 formatos (`ValidationErrorResponse`, `LoginFailedResponse`, `TokenInvalidResponse`) ficam locais a `accounts/views.py` via `inline_serializer`, sem novo módulo/abstração. Não editar `deferred-work.md` — o orquestrador registra a resolução.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Signup válido | payload `SignupSerializer` válido | `201` + `{"detail": "Conta criada com sucesso."}` | — |
| Signup email duplicado / senha fraca | `email` já existe, ou `password` não passa `validate_password` | `400` | `{"detail": "Validation failed", "fields": {"email"\|"password": [msg]}}` |
| Login credenciais inválidas | email inexistente ou senha errada | `401` | `{"detail": "No active account found with the given credentials"}` (sem `fields`) |
| Login campo obrigatório ausente | POST sem `password` (ou sem `email`) | `400` | `{"detail": "Validation failed", "fields": {"password": ["This field is required."]}}` |
| Refresh token inválido/expirado/blacklisted | `refresh` malformado ou reusado após rotação | `401` | `{"detail": "Token is invalid"\|"Token is blacklisted", "fields": {"code": ["token_not_valid"]}}` (sempre com `fields.code`) |
| Refresh campo obrigatório ausente | POST sem `refresh` | `400` | `{"detail": "Validation failed", "fields": {"refresh": ["This field is required."]}}` |
| CI: `schema.yaml` desatualizado | dev muda uma view sem rodar `manage.py spectacular` | step "Gerar schema OpenAPI e checar drift schema-vs-view" falha o diff | mensagem aponta o comando de regeneração |

</intent-contract>

## Code Map

- `backend/accounts/views.py` — antes só `signup` (bare `@api_view`, sem schema). Ganhou: 3 `inline_serializer` module-level (`_VALIDATION_ERROR_RESPONSE`, `_LOGIN_FAILED_RESPONSE`, `_TOKEN_INVALID_RESPONSE`); `@extend_schema` em `signup` (`request=SignupSerializer`, `responses={201: OpenApiResponse(inline_serializer("SignupSuccessResponse", ...), examples=[...]), 400: _VALIDATION_ERROR_RESPONSE}`) + `@authentication_classes([])`; `TokenObtainPairView`/`TokenRefreshView` importados de `rest_framework_simplejwt.views` e reatribuídos via `extend_schema_view(post=extend_schema(responses={200: <serializer original>, 400: ..., 401: ...}))(View)` — padrão oficial do drf-spectacular pra anotar view de terceiro sem subclassar; `extend_schema_view` isola a anotação por classe via `isolate_view_method` (confirmado lendo `drf_spectacular/utils.py:656-681` — não há vazamento entre as duas mesmo com `post` herdado do mesmo `TokenViewBase`).
- `backend/accounts/urls.py` — trocado o import de `TokenObtainPairView`/`TokenRefreshView` de `rest_framework_simplejwt.views` para `accounts.views` (onde agora vivem as versões anotadas); `signup` continua vindo de lá também.
- `backend/accounts/serializers.py` — `SignupSerializer` (não mudou) — vira o `request=` do `@extend_schema` de signup.
- `backend/core/exceptions.py` — `custom_exception_handler`/`_normalise_body` (não mudou) — é a fonte de verdade dos 3 formatos de erro documentados; confirmado empiricamente (não só por leitura) rodando os 3 endpoints com payloads reais: validação (`{"detail": "Validation failed", "fields": {...}}`), falha de login (`{"detail": str}`, sem `fields` — `AuthenticationFailed` nativo do DRF carrega só string), token inválido (`{"detail": str, "fields": {"code": [...]}}` — `InvalidToken` do simplejwt usa `DetailDictMixin`, que sempre inclui `code`).
- `rest_framework_simplejwt.views.TokenViewBase` (`.venv/.../rest_framework_simplejwt/views.py:14-16`) — `authentication_classes = ()` **já vazio por padrão** nas duas views de token (por isso `schema.yaml` nunca mostrou `security:` nelas) — só `signup` (função `@api_view` sem authentication_classes próprio) herdava o `DEFAULT_AUTHENTICATION_CLASSES` global; DW-15 é escopado só a `signup`.
- `backend/accounts/tests/test_views.py` — 2 testes novos (`test_login_campo_obrigatorio_ausente_retorna_400`, `test_token_refresh_campo_obrigatorio_ausente_retorna_400`) fecham a lacuna: os 4 testes citados verbatim no ledger cobrem `signup:400` e `token:401`, mas nenhum teste existente cobria `token:400`/`token-refresh:400` nem `token-refresh:401` isoladamente de reuso pós-rotação — `test_token_refresh_rotacao_blacklist` (linha 165, já existente) cobre esse último caso.
- `schema.yaml` / `frontend/src/api/types.gen.ts` — regerados (`manage.py spectacular` + `npm run generate-types`); diff isolado às 3 operações de `accounts` + 5 novos componentes (`Signup`, `SignupSuccessResponse`, `ValidationErrorResponse`, `LoginFailedResponse`, `TokenInvalidResponse`).
- `.github/workflows/ci.yml` — step "Gerar schema OpenAPI" renomeado para "Gerar schema OpenAPI e checar drift schema-vs-view": agora copia o `schema.yaml` commitado pra `/tmp` antes de regenerar, e diffa depois — fecha DW-14 (mesmo padrão do step seguinte, que já diffa `types.gen.ts`).

## Tasks & Acceptance

**Execution:**
- `backend/accounts/views.py` — anotar `signup`/`TokenObtainPairView`/`TokenRefreshView` com `@extend_schema`/`extend_schema_view` (request, responses 201/400/401 conforme o Code Map) e `authentication_classes=[]` em `signup` — fecha DW-11, DW-12, DW-15.
- `backend/accounts/urls.py` — importar as views de token de `accounts.views` em vez de `rest_framework_simplejwt.views`.
- `backend/accounts/tests/test_views.py` — 2 testes novos fixando `token:400` e `token-refresh:400`.
- `schema.yaml` + `frontend/src/api/types.gen.ts` — regerar e commitar.
- `.github/workflows/ci.yml` — novo step de diff schema-vs-commitado antes do step de `types.gen.ts` — fecha DW-14.

**Acceptance Criteria:**
- Given um signup válido, when a request roda, then `schema.yaml` documenta `201` com `{"detail": string}` e `requestBody` do `SignupSerializer` — não mais `200` vazio.
- Given `email` duplicado ou senha fraca no signup, when a validação falha, then `schema.yaml` documenta `400` com o formato real (`{"detail", "fields"}`), coberto por `test_signup_email_duplicado_retorna_400`/`test_signup_senha_fraca_retorna_400` (já existentes, sem alteração).
- Given credenciais inválidas em `/token/`, when a autenticação falha, then `schema.yaml` documenta `401` com `{"detail": string}` (sem `fields`), coberto por `test_login_email_invalido_retorna_401`/`test_login_senha_errada_retorna_401` (já existentes).
- Given campo obrigatório ausente em `/token/` ou `/token/refresh/`, when a validação do serializer falha, then `schema.yaml` documenta `400`, coberto pelos 2 testes novos.
- Given um `refresh` inválido/blacklisted, when `/token/refresh/` processa, then `schema.yaml` documenta `401` com `fields.code`, coberto por `test_token_refresh_rotacao_blacklist` (já existente).
- Given a view `signup`, when o schema é gerado, then `security` mostra só `[{}]` (público, sem opção de JWT) — nunca mais `jwtAuth` opcional.
- Given o `schema.yaml` versionado divergir do que `manage.py spectacular` gera agora (qualquer view sem anotação completa), when o CI roda, then o novo step falha com uma mensagem acionável, antes mesmo do diff de `types.gen.ts`.
- Given a suíte completa (`uv run pytest`), when roda após as mudanças, then permanece 100% verde.

## Review Triage Log

### 2026-08-03 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 5 (high 0, medium 4, low 1)
- defer: 3 (high 0, medium 1, low 2)
- reject: 7 (high 0, medium 0, low 7)
- addressed_findings:
  - `[medium]` `[patch]` Nenhum teste protegia o comportamento novo da DW-15 (`authentication_classes=[]` em `signup`) -- um `Authorization: Bearer <lixo>` continuaria 401ando o signup se o decorator regredisse, sem nenhum teste acusando. Corrigido: novo teste `test_signup_com_authorization_header_invalido_ainda_retorna_201` em `test_views.py`. (achado: verification-gap, blind-hunter)
  - `[medium]` `[patch]` Os 2 testes novos de `token:400`/`token-refresh:400` só checavam `status_code`, nunca o corpo -- o contrato `fields` que o schema agora documenta ficava sem nenhuma verificação executável, e os 2 testes existentes de 401 (`test_login_mensagem_erro_generica`, `test_token_refresh_rotacao_blacklist`) também nunca liam o corpo, deixando a assimetria documentada nos Design Notes (login 401 sem `fields`, refresh 401 sempre com `fields.code`) sem nenhum teste. Corrigido: os 4 testes agora leem `response.json()` e afirmam a forma exata (`"fields" in`/`not in`, chave do campo esperado, `fields["code"]`). (achado: blind-hunter, verification-gap)
  - `[medium]` `[patch]` `_VALIDATION_ERROR_RESPONSE.fields` estava modelado como opcional (`required=False`), mas nenhuma das 3 views tem um `validate()` de serializer inteiro que gere erro sem chave de campo -- na prática `fields` é sempre populado nos 3 endpoints. Corrigido: `fields` agora é obrigatório no schema, batendo com o comportamento real. (achado: blind-hunter)
  - `[medium]` `[patch]` Os 3 `inline_serializer` (`ValidationErrorResponse`, `LoginFailedResponse`, `TokenInvalidResponse`) usavam nomes genéricos de topo, virando componentes globais reusáveis em `schema.yaml`/`types.gen.ts` -- na prática o mesmo "serializer de erro oficial reusável" que o `Never` da spec proíbe, só que sem uma classe Python compartilhada. Corrigido: renomeados com prefixo `Accounts` (`AccountsValidationErrorResponse`, `AccountsLoginFailedResponse`, `AccountsTokenInvalidResponse`), deixando explícito que são locais a esta app -- mesma cautela que `ENUM_NAME_OVERRIDES` (`config/settings/base.py`) já demonstra ter com colisão de nome de schema entre apps. (achado: blind-hunter)
  - `[low]` `[patch]` `TokenInvalidResponse.fields` era um dict genérico (`{[key: string]: string[]}`), mas na prática é sempre exatamente `{"code": [...]}` -- nunca uma chave arbitrária. Corrigido: `fields` agora é um objeto com a única chave `code` (`ListField` de string), mais preciso que o mapa genérico. (achado: blind-hunter)
- Achados roteados como `defer` (registrados em `deferred` no frontmatter, não repetidos aqui): DW-14 fecha só a superfície "regeneração bate com o commitado", não adiciona um teste de contrato dinâmico (resposta HTTP real vs. schema documentado) -- uma anotação `@extend_schema` plausível-mas-errada que fosse regerada e commitada de boa-fé passaria pelo novo step sem acusar nada (mesma forma de falha da DW-11 original); o ledger oferece as duas leituras explicitamente ("contract test or schema-vs-view assertion"), então isto é uma lacuna residual da leitura escolhida, não um erro desta pass. `extend_schema_view` reatribui as classes de `simplejwt` no lugar (técnica oficial do drf-spectacular, com isolamento anti-vazamento via `isolate_view_method`) -- qualquer código futuro que importe `TokenObtainPairView`/`TokenRefreshView` direto de `rest_framework_simplejwt.views` (nenhum hoje) herdaria silenciosamente esses metadados de schema (sem efeito em runtime, só na introspecção do drf-spectacular). O novo step de CI (`diff` + `||`) não distingue exit code 1 (conteúdo diverge) de 2+ (erro de I/O) -- mesma característica do step-irmão "Verificar types.gen.ts" já existente; corrigir só o step novo violaria o próprio objetivo de consistência de estilo desta bundle.
- Achados descartados como `reject` (ruído/fora de escopo/estrutural, não repetidos individualmente): faltam `OpenApiExample` nos outros 3 responses (só `SignupSuccessResponse` ganhou -- consistente com o resto do app, que não usa exemplos em nenhum endpoint); `Signup.password`/`Signup.timezone` não capturam as regras semânticas de `validate_password`/`validate_timezone` (limitação estrutural de OpenAPI/JSON-schema, universal a todo `schema.yaml`, e este diff é a primeira vez que `signup` ganha *algum* schema de request, então é melhoria estrita); `signup` mostra `security: [{}]` enquanto `/token/`/`/token/refresh/` não mostram chave `security` nenhuma -- ambos significam "público", diferença cosmética de representação do drf-spectacular entre view baseada em função vs. classe, fora do escopo literal da DW-15; `schema.yaml`'s `info.version` não foi incrementado -- nenhum precedente deste projeto faz isso; a auditoria de alinhamento de intenção notou que só 2 dos 4 testes citados verbatim no ledger realmente embasavam o que foi documentado (os outros vieram de testes novos desta pass) -- descritivo, não um defeito (o diff já resolveu isso escrevendo os testes que faltavam); `accounts/urls.py` não é citado em nenhum `location:` do ledger -- plumbing necessário e autoevidente para a técnica escolhida.

### 2026-08-03 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 2 (high 1, medium 1, low 0)
- defer: 1 (high 0, medium 1, low 0)
- reject: 16 (high 0, medium 0, low 16)
- addressed_findings:
  - `[high]` `[patch]` `TokenRefreshSerializer.validate()` tem um segundo ramo de 401 (usuário referenciado pelo token ficou inativo -- `USER_AUTHENTICATION_RULE`) que levanta o `AuthenticationFailed` NATIVO do DRF (sem `DetailDictMixin`), produzindo `{"detail": str}` SEM `fields` -- mas `AccountsTokenInvalidResponse` (fixado na pass anterior) documentava `fields` como obrigatório, assumindo que só o ramo `InvalidToken` (sempre com `fields.code`) existia. Confirmado empiricamente lendo `rest_framework_simplejwt/serializers.py`/`exceptions.py` e `core/exceptions.py::_normalise_body`, e reproduzindo o cenário (login, desativar o usuário, tentar refresh com o token ainda válido) via novo teste. Corrigido: `fields` agora opcional (`required=False`) em `_TOKEN_INVALID_RESPONSE`; `schema.yaml`/`types.gen.ts` regerados; novo teste `test_token_refresh_usuario_desativado_retorna_401_sem_fields` fixa o comportamento real. Sem essa correção, qualquer frontend confiando no tipo gerado (`fields` obrigatório) quebraria em runtime (`undefined.code`) nesse cenário real de desativação de conta. (achado: blind-hunter)
  - `[medium]` `[patch]` `test_signup_email_duplicado_retorna_400` (`assert "email" in str(data).lower()`) e `test_signup_senha_fraca_retorna_400` (só `status_code`) ficaram com verificação mais fraca que os 4 testes irmãos de login/token-refresh, que a pass anterior reforçou para afirmar `fields` estruturado -- inconsistência de rigor dentro da mesma pass, no mesmo par de ACs (400 de signup). Corrigido: os 2 testes agora afirmam `"email"/"password" in response.json()["fields"]`, no mesmo padrão dos demais. (achado: auditoria de alinhamento de intenção)
- Achado roteado como `defer` (registrado em `deferred` no frontmatter e como DW-24 no ledger, não repetido aqui): `core/views.py::health` tem exatamente o padrão que causava o bug da DW-15 em `signup` (`@api_view`/`AllowAny` sem `authentication_classes=[]` próprio, herdando o autenticador global) -- um `Authorization` header inválido presente faz o liveness check 401ar em vez de 200ar. Confirmado empiricamente pela verification-gap review. Fora do escopo desta bundle (`Never` do intent-contract nomeia só as views de `accounts`), não corrigido nesta pass.
- Achados descartados como `reject` (ruído/duplicata de item já deferido/estrutural, não repetidos individualmente): monkey-patch global do `extend_schema_view` sobre as classes do `simplejwt` (duplicata do item já registrado em `deferred`); ausência de teste de contrato dinâmico ligando os `inline_serializer` à resposta HTTP real (duplicata do item DW-14 já registrado em `deferred`); exit code do novo step de CI não distingue `diff` divergente de erro de I/O (duplicata do item já registrado em `deferred`); artefato de formatação na montagem do diff revisado (`schema.yaml` sem seu próprio cabeçalho `diff --git`) -- processo de review, não defeito de código; asserções de corpo por membership (`"password" in fields`) em vez de forma completa/exata -- sem cenário de falha concreto demonstrado; `test_signup_com_authorization_header_invalido_ainda_retorna_201` não verifica ausência de efeito colateral de tenant context -- sem falha demonstrada; ausência de hook local (pre-commit) equivalente ao novo step de CI -- pedido de tooling além do que o intent especifica; mensagem de erro do novo step de CI não menciona que `types.gen.ts` também pode precisar regenerar -- nicho de DX, não exigido pela AC; `AccountsTokenErrorCode.code` tipado como `string[]` genérico em vez de enum das strings conhecidas do simplejwt -- sugestão estrutural, mesma classe dos itens já rejeitados na pass anterior; ausência de teste para usuário desativado no LOGIN (comportamento já correto e verificado, só não fixado por teste) -- sem bug demonstrado; corpo não-objeto (lista/string/número) no POST de signup/token/refresh supostamente omitiria `fields` -- checado contra `_normalise_body`/DRF `to_internal_value` e não se sustenta (erro de "not a dict" ainda cai em `non_field_errors`, que vira `fields`); `TokenObtainPairSerializer.validate()` supostamente podendo levantar `TokenError` -- não corroborado pela leitura do código-fonte (só usa `AuthenticationFailed` nativo, contradizendo a hipótese); a superfície schema↔runtime nunca conectada por um artefato executável, e o step de CI cobrir só "regeneração bate com commitado" -- descritivo, duplicata dos 2 itens de `deferred` já citados; strings literais de erro (`"No active account found..."`, `"Token is invalid"`, etc.) não verificadas por nenhum teste -- vêm de dependências pinadas (Django/DRF/simplejwt), sem histórico de mudança silenciosa nesse formato; assimetria de `security` entre `signup` (`[{}]`) e `/token/`/`/token/refresh/` (chave ausente) -- duplicata de item já rejeitado na pass anterior pelo mesmo motivo (fora do escopo literal da DW-15).

### 2026-08-03 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 1 (high 1, medium 0, low 0)
- defer: 1 (high 0, medium 1, low 0)
- reject: 17 (high 0, medium 0, low 17)
- addressed_findings:
  - `[high]` `[patch]` `AccountsValidationErrorResponse.fields` era documentado como obrigatório em todo 400 de signup/token/token-refresh, mas um corpo de requisição com JSON malformado nunca chega ao serializer -- o `JSONParser` do DRF levanta `ParseError` antes disso, e `_normalise_body` produz só `{"detail": "JSON parse error - ..."}` sem `fields` nenhum. Confirmado empiricamente enviando `{not valid json` às 3 rotas (mesma classe de erro que este bundle inteiro existe para corrigir: documentar um contrato plausível-mas-errado). Corrigido: `fields` agora opcional (`required=False`) em `_VALIDATION_ERROR_RESPONSE` (mesmo padrão já aplicado a `_TOKEN_INVALID_RESPONSE.fields` na pass anterior); `schema.yaml`/`types.gen.ts` regerados; 3 novos testes (`test_signup_json_malformado_retorna_400_sem_fields`, `test_login_json_malformado_retorna_400_sem_fields`, `test_token_refresh_json_malformado_retorna_400_sem_fields`) fixam o comportamento real. Sem essa correção, qualquer frontend confiando no tipo gerado (`fields` obrigatório) quebraria em runtime (`undefined.field`) diante de um body malformado -- entrada alcançável por qualquer cliente não autenticado. (achado: blind-hunter)
- Achado roteado como `defer` (registrado em `deferred` no frontmatter e como DW-25 no ledger, não repetido aqui): `TokenRefreshSerializer.validate()` (`rest_framework_simplejwt`) chama `get_user_model().objects.get(...)` sem tratar `DoesNotExist` -- se o usuário referenciado por um refresh token ainda válido for definitivamente apagado do banco (não apenas desativado), a exceção não é reconhecida por `custom_exception_handler` e vira um 500 não tratado do Django. Confirmado lendo o código-fonte instalado do simplejwt. Pré-existente, não introduzido por este diff (que só anota schema em torno dessas views, sem tocar `TokenRefreshSerializer`); nenhum fluxo do app hoje apaga usuários (só desativa), então a severidade é medium, não high.
- Achados descartados como `reject` (ruído/fora de escopo/duplicata/estrutural, não repetidos individualmente): sugestão de corrigir `core/views.py::health` (mesmo bug da DW-15) diretamente nesta bundle -- fora do escopo literal (`Never` nomeia só views de `accounts`) e DW-24 (que já registra o achado) é uma entrada existente do ledger que este pass não pode reabrir/reescrever; monkey-patch global do `extend_schema_view` sobre as classes do `simplejwt` -- duplicata do item já registrado em `deferred`; ausência de consumo do schema mais preciso no frontend (`features/auth/api.ts` usa generics manuais, não os tipos gerados) -- fora do escopo do intent (que trata de documentar o contrato existente, não de migrar consumidores); `AccountsTokenErrorCode.code` tipado como `string[]` genérico em vez de enum -- mesma classe de sugestão estrutural já rejeitada em pass anterior; asserções de shape bolted-on em `test_login_mensagem_erro_generica` -- nitpick de organização de teste, sem bug; novo step de CI conflatar geração+diff num único step -- seguir o mesmo padrão do step de `types.gen.ts` é a consistência de estilo que o próprio intent pede; step de drift falhar em diffs cosméticos de upgrade de dependência -- característica inerente a qualquer diff-check, não uma falha desta bundle; crítica de que a severidade `medium` já atribuída à DW-24 (entrada existente do ledger) deveria ser `high` -- não pode ser alterada por este pass; falta de `OpenApiExample` nos responses de erro -- duplicata exata de item já rejeitado em pass 1; DW-24 sem teste de regressão -- fora do escopo (view de `health` não é tocada por esta bundle); nome do component `Signup` sem prefixo `Accounts` -- ao contrário dos 3 serializers de erro (que o `Never` proíbe de virarem "oficiais" reusáveis), `Signup` segue a mesma convenção universal de todo `schema.yaml` (nome do serializer menos o sufixo, sem prefixo de app), então não é uma inconsistência real; `cp ../schema.yaml /tmp/...` no novo step de CI sem guarda para arquivo-fonte ausente -- cenário sem precedente demonstrado (o arquivo é sempre parte do checkout); tensão entre a matriz I/O ("sempre com fields.code" no refresh) e o código agora opcional -- já resolvido e explicado nos Design Notes da pass anterior, não uma divergência nova; fronteira `Never: não editar deferred-work.md` vs. os commits de sweep que editam o ledger -- o próprio texto do intent explica que é "o orquestrador" (um passo separado) quem registra a resolução, não uma violação; teste de "campo obrigatório ausente" no login cobrir só `password`, não `email` -- mesmo branch de código, mesma forma de resposta, sem comportamento distinto demonstrado; teste de header inválido no signup ser mais amplo que a matriz -- cobertura extra, não um problema.

## Design Notes

Os 3 formatos de erro documentados NÃO são uma escolha de design nova — são o comportamento real de `core.exceptions.custom_exception_handler` combinado com o que cada exceção upstream (`ValidationError` do DRF, `AuthenticationFailed` do DRF, `InvalidToken`/`DetailDictMixin` do simplejwt) carrega em `.detail`. Confirmado rodando os 3 fluxos com payloads reais (não só lendo o código):
```
SIGNUP DUP EMAIL 400:   {"detail": "Validation failed", "fields": {"email": ["Este email já está em uso."]}}
LOGIN BAD EMAIL 401:    {"detail": "No active account found with the given credentials"}
REFRESH GARBAGE 401:    {"detail": "Token is invalid", "fields": {"code": ["token_not_valid"]}}
```
A assimetria importa: o erro de login (`401`) nunca tem `fields`; o de refresh (`401`) tem `fields.code` quando a falha é `InvalidToken` do simplejwt (`DetailDictMixin`, sempre injeta `code`), mas NÃO tem `fields` quando `TokenRefreshSerializer.validate()` cai no outro ramo de 401 — token estruturalmente válido cujo usuário ficou inativo (`USER_AUTHENTICATION_RULE`), que levanta o `AuthenticationFailed` NATIVO do DRF (sem `DetailDictMixin`), produzindo o mesmo formato do 401 de login. Por isso `AccountsTokenInvalidResponse.fields` é opcional (achado pela fresh review pass de 2026-08-03, corrigido depois de uma pass anterior tê-lo modelado como obrigatório). Documentar os dois com o mesmo serializer teria sido factualmente errado.

`TokenObtainPairView`/`TokenRefreshView` já tinham `authentication_classes = ()` (vazio) por padrão, herdado de `TokenViewBase` — não é algo que este diff precisou setar. Só `signup` precisava do `authentication_classes=[]` explícito, porque é `@api_view` e por isso herda o `DEFAULT_AUTHENTICATION_CLASSES` global a menos que seja explicitamente esvaziado.

`AccountsValidationErrorResponse.fields` também é opcional (achado pela fresh review pass de 2026-08-03): um corpo de requisição com JSON malformado (`{not valid json`, `Content-Type: application/json`) nunca chega ao serializer — o `JSONParser` do DRF levanta `ParseError` antes disso, e `_normalise_body` produz `{"detail": "JSON parse error - ..."}` sem `fields`. Mesma classe de correção já aplicada a `AccountsTokenInvalidResponse.fields`: o `400` "típico" (validação de campo) sempre tem `fields`, mas nem todo `400` destas 3 rotas passa pelo serializer.

## Verification

**Commands:**
- `cd backend && uv run pytest accounts/ -q` — expected: todos passam, incluindo os 2 testes novos.
- `cd backend && uv run pytest` — expected: suíte completa verde (1364 testes), zero regressão.
- `cd backend && uv run ruff check .` — expected: limpo.
- `cd backend && uv run lint-imports` — expected: contrato `core` não importa apps de domínio, intacto (não tocado por esta bundle).
- `cd backend && uv run python manage.py spectacular --file ../schema.yaml` — expected: gera sem novos warnings (os 3 warnings pré-existentes, não relacionados a `accounts`, continuam).
- `cd frontend && npm run generate-types` (Node ≥20.12 via nvm) — expected: `types.gen.ts` regerado sem diff pendente contra o commitado.
- Simulação do novo step de CI: `cp schema.yaml /tmp/x.yaml && (cd backend && uv run python manage.py spectacular --file ../schema.yaml) && diff /tmp/x.yaml schema.yaml` — expected: sem diff (confirma que o step passaria hoje).

## Auto Run Result

**Resumo desta pass:** terceira fresh review pass sobre o bundle já implementado e finalizado (DW-11/DW-12/DW-14/DW-15), disparada porque o spec estava `status: done`. 4 revisores rodaram em paralelo (blind-hunter, edge-case-hunter, verification-gap, auditoria de alinhamento de intenção) sobre o diff completo desde `baseline_revision`. Achado principal (`high`, blind-hunter, confirmado empiricamente enviando `{not valid json` às 3 rotas): `AccountsValidationErrorResponse.fields` era documentado como obrigatório em todo `400` de signup/token/token-refresh, mas um corpo de requisição com JSON malformado nunca chega ao serializer — o `JSONParser` do DRF levanta `ParseError` antes disso, produzindo `{"detail": "..."}` sem `fields`. Mesma classe de falha que este bundle inteiro existe para corrigir (documentar um contrato plausível-mas-errado), agora encontrada num canto que a pass anterior não cobriu. Um achado foi roteado como `defer` (edge-case-hunter, confirmado lendo o código-fonte instalado do simplejwt, novo item DW-25 no ledger): `TokenRefreshSerializer.validate()` pode 500ar (não 401ar) se o usuário do token foi de fato apagado do banco — pré-existente, fora do escopo desta bundle. A auditoria de alinhamento de intenção e o verification-gap não trouxeram achados acionáveis novos (o verification-gap explicitamente não encontrou gaps; os pontos de divergência da auditoria já estavam resolvidos/explicados pelos Design Notes de passes anteriores ou pelo próprio texto do intent-contract).

**Arquivos alterados nesta pass:**
- `backend/accounts/views.py` — `_VALIDATION_ERROR_RESPONSE.fields` passou de obrigatório para opcional (`required=False`), com comentário atualizado explicando o ramo de `ParseError`.
- `backend/accounts/tests/test_views.py` — 3 novos testes (`test_signup_json_malformado_retorna_400_sem_fields`, `test_login_json_malformado_retorna_400_sem_fields`, `test_token_refresh_json_malformado_retorna_400_sem_fields`) fixam o comportamento real para as 3 rotas.
- `schema.yaml` / `frontend/src/api/types.gen.ts` — regerados; `AccountsValidationErrorResponse.fields` agora opcional (`fields?:` no TS).
- `_bmad-output/implementation-artifacts/deferred-work.md` — novo item DW-25 registrado por esta pass (nenhuma entrada existente modificada).
- Este spec — `## Review Triage Log` (nova entrada), `deferred` no frontmatter (novo item), Design Notes (assimetria de `fields` do 400 de validação documentada), este `## Auto Run Result`.

**Review findings:** 1 `patch` aplicado (high 1); 1 `defer` (medium 1, novo — DW-25 no ledger); 17 `reject` (todos low — duplicatas de itens já deferidos/rejeitados em passes anteriores, sugestões fora do escopo do intent, nitpicks estruturais/de DX sem falha demonstrada, ou uma crítica sobre a severidade de uma entrada já existente do ledger que este pass não tem autoridade para alterar; ver Review Triage Log).

**Recomendação de follow-up review:** `true` (patch de severidade `high` nesta pass). Patches por severidade: high 1, medium 0, low 0. Score (informativo, não decisivo aqui): 3×0 (medium) + 1×0 (low) = 0.

**Verificação executada:**
- `cd backend && uv run pytest accounts/ -q` — 33 passed (era 30; +3 pelos testes de JSON malformado).
- `cd backend && uv run pytest` — 1369 passed em ~277s (suíte completa, zero regressão; era 1366 antes desta pass).
- `cd backend && uv run ruff check .` — limpo.
- `cd backend && uv run lint-imports` — contrato `core` intacto.
- `manage.py spectacular --file ../schema.yaml` — mesmos 3 warnings pré-existentes, não relacionados a `accounts`.
- `npm run generate-types` (Node 22.15.1 via nvm) — regenerado; diff isolado a `AccountsValidationErrorResponse.fields` virando opcional.
- Simulação do novo step de CI (`cp` + regerar + `diff`) — sem diff, confirmado após as mudanças.

**Riscos residuais:** os 5 itens `defer` agora registrados no frontmatter (severidade medium/low/low/medium/medium) — os 2 mais recentes (DW-24, `health` 401ando com `Authorization` inválido; DW-25, `TokenRefreshSerializer` podendo 500ar com usuário apagado) são bugs reais confirmados fora do escopo literal desta bundle; os 3 itens pré-existentes (superfície schema-vs-runtime nunca conectada por teste de contrato dinâmico, monkey-patch global do `extend_schema_view`, exit code do `diff` no CI não distingue conteúdo-divergente de erro de I/O) permanecem sem mudança, com o mesmo raciocínio já registrado. Nenhum achado `intent_gap`/`bad_spec` nesta pass — o intent-contract permanece coerente com o código.

