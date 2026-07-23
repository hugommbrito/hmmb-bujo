---
baseline_commit: d94ab4830412ee7ae6af6364d4e6ab31d0e5b84f
---

# Story 12.5: Captura externa — `POST /api/capture`

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero capturar um item com uma única chamada autenticada por token,
Para que o Back Tap do iPhone jogue pensamentos direto no Brain Dump (FR-3.2, FR-3.4, AR-25, DIR-11, AD-19).

## Acceptance Criteria

**AC1 — `POST /api/capture` cria item de Brain Dump via service existente + `type` desconhecido → 400**

**Dado que** um token com escopo `capture` (`AutomationToken` da Story 12.4),
**Quando** `POST /api/capture` recebe o payload **raso** `{type, text, value?}` com `type: "braindump"`,
**Então** um item de Brain Dump é criado **via o service existente** `braindump.services.create_brain_dump_item` (o `text` do payload vira o `title` do item) e a resposta é um **`201` curto** (corpo mínimo, ex.: `{"id": "<uuid>"}`),
**E** um `type` **desconhecido** retorna **400** com mensagem clara em pt-BR (ex.: `"Tipo de captura desconhecido: <valor>"`),
**E** um payload sem `text` (ausente/vazio) retorna **400**.

**AC2 — O item capturado por fora aparece no Brain Dump (superfície legada, dia 1)**

**Dado que** o item foi capturado por fora (via token),
**Quando** Hugo abre o app (autenticado por JWT normal) e lista o Brain Dump,
**Então** o item aparece na caixa de entrada do Brain Dump (`GET /api/brain-dump/items/` — superfície legada, visível desde o dia 1 — AD-19),
**E** a contagem do badge (`GET /api/brain-dump/count/`) reflete o novo item no próximo refetch (AD-13),
**E** o item pertence **exclusivamente** ao dono do token (isolamento AD-12 setado pela `AutomationTokenAuthentication`) — nunca aparece para outro tenant.

**AC3 — Rate limiting + auditoria nascem junto do endpoint (FR-3.4)**

**Dado que** rate limiting e auditoria nascem juntos com o endpoint (FR-3.4),
**Quando** o endpoint é chamado,
**Então** `ScopedRateThrottle` com escopo `automation-capture` aplica o limite, com a taxa **configurável em settings** (`DEFAULT_THROTTLE_RATES["automation-capture"]`, com override por variável de ambiente),
**E** exceder o limite retorna **429**,
**E** cada chamada que alcança o handler gera **log estruturado** `{token_prefix, endpoint, status}` — o **token pleno nunca aparece em log** (só o `token_prefix`).

**AC4 — Dispatcher por `type` extensível, sem registro especulativo (AD-27 / navalha de Occam)**

**Dado que** tipos futuros de captura,
**Quando** o dispatcher por `type` é implementado,
**Então** adicionar um tipo novo **não exige retrabalho de modelo nem de contrato** — implementação simples (**match por tipo**, ex.: `match`/`if`), **sem padrão de registro especulativo** (navalha de Occam 2026-07-23),
**E** o `type` é um campo **aberto** no contrato (não um enum acoplado à lista de tipos — ver Dev Notes › "Por que `type` é `CharField` e não `ChoiceField`"),
**E** a ingestão de Pressão Arterial **não** passa por aqui — ela terá endpoint próprio (AD-27), reusando a mesma auth class (AD-19 item 3).

## Tasks / Subtasks

- [x] **Task 1 — Serializers de captura** (AC: #1, #4)
  - [x] Criar `backend/automation/serializers.py`:
    - `CaptureRequestSerializer(serializers.Serializer)`: `type = CharField()` (obrigatório, não-vazio — **`CharField` aberto, NÃO `ChoiceField`**; ver Dev Notes), `text = CharField(max_length=500)` (obrigatório, não-branco — mapeia para `BrainDumpItem.title`, cujo `max_length` é 500), `value = CharField(required=False, allow_null=True, allow_blank=True)` (**reservado** para tipos futuros — sem consumidor na captura de braindump; mesma disciplina de campo reservado das Stories 12.3/12.4).
    - `CaptureResponseSerializer(serializers.Serializer)`: corpo curto do 201 — `id = UUIDField(read_only=True)` (id do item criado, para o atalho confirmar). Manter mínimo (AD-19 "resposta curta 201").
  - [x] `type`/`text`/`value` são palavras únicas → o CamelCase parser/renderer (§6.3) é no-op aqui; nenhum campo com `_`.

- [x] **Task 2 — Dispatcher de captura (composition service, HTTP-agnóstico)** (AC: #1, #4)
  - [x] Criar `backend/automation/services.py` com `dispatch_capture(*, user, type, text, value=None)`:
    - `match type` (ou `if/elif`): `"braindump"` → chamar `braindump.services.create_brain_dump_item(user=user, title=text)` e retornar o `BrainDumpItem` criado.
    - Tipo desconhecido → `raise UnknownCaptureType(type)` (definir `class UnknownCaptureType(ValueError)` no módulo — **erro de domínio, HTTP-agnóstico**; a view o traduz em 400 com mensagem clara). **Não** levantar `rest_framework.ValidationError` aqui (services não conhecem HTTP; ver Dev Notes › "Fronteira service × HTTP").
    - `value` é aceito na assinatura e **ignorado** na captura de braindump (reservado a tipos futuros) — documentar no docstring que adicionar um tipo é **adicionar um braço no `match`**, sem tocar modelo/contrato (AD-27, Occam; **sem** registro/plugin especulativo).
  - [x] `automation` **pode** importar `braindump.services` — é **app de composição** (AD-19 item 4; import-linter só proíbe `core` → apps de domínio, `automation` não é `core`). Confirmar que nenhuma nova violação de contrato surge.

- [x] **Task 3 — View `CaptureView` (auth por token + escopo + throttle + log)** (AC: #1, #2, #3)
  - [x] Criar `backend/automation/views.py` com `CaptureView(APIView)`:
    - `authentication_classes = [AutomationTokenAuthentication]` (opt-in per-view — a classe **não** está em `DEFAULT_AUTHENTICATION_CLASSES`).
    - `permission_classes = [HasAutomationScope]`; `required_scopes = ["capture"]` (usar `SCOPE_CAPTURE` de `automation.models`). **Não** adicionar `IsAuthenticated` — é redundante: `HasAutomationScope` já fail-closa e o fluxo DRF entrega 401/403 corretos (ver Dev Notes › "401 vs 403 sem `IsAuthenticated`").
    - `throttle_classes = [ScopedRateThrottle]`; `throttle_scope = "automation-capture"`.
    - `post(self, request)`: validar `CaptureRequestSerializer`; despachar via `dispatch_capture(user=request.user, **validated)`; em sucesso → `201` com `CaptureResponseSerializer({"id": item.id}).data`; em `UnknownCaptureType` → `400` com `{"type": "Tipo de captura desconhecido: <valor>"}`. **Logar o status final de toda chamada que alcança o handler** (201 e 400) — ver Task 4. Documentar OpenAPI com `@extend_schema(request=CaptureRequestSerializer, responses={201: CaptureResponseSerializer})`.
    - **Estilo de validação para permitir o log de 400:** validar com `serializer.is_valid()` (sem `raise_exception=True`) OU envolver o handler de forma que o status de erro de validação também seja logado (a exigência da AC3 é "cada chamada que alcança o handler gera log"). Ver Dev Notes › "Logar todos os desfechos do handler".

- [x] **Task 4 — Log estruturado de auditoria** (AC: #3)
  - [x] `logger = logging.getLogger(__name__)` no topo de `automation/views.py` (precedente: `core/exceptions.py:25`). Emitir `logger.info("automation capture", extra={"token_prefix": request.auth.token_prefix, "endpoint": "/api/capture", "status": <status_final>})` para cada chamada que alcança o handler.
  - [x] **O token pleno NUNCA é logado** (só `token_prefix`) — na view nem sequer há acesso ao pleno (defesa em profundidade: `request.auth` é o `AutomationToken`, que só guarda `token_prefix`/`token_hash`). Confirmar em teste que o pleno não aparece em `caplog`.

- [x] **Task 5 — Configuração de throttle em settings** (AC: #3)
  - [x] Em `backend/config/settings/base.py`, dentro de `REST_FRAMEWORK`, adicionar `"DEFAULT_THROTTLE_RATES": {"automation-capture": env("AUTOMATION_CAPTURE_THROTTLE", default="60/min")}`. **Não** adicionar `DEFAULT_THROTTLE_CLASSES` global (throttlaria todos os endpoints) — o `ScopedRateThrottle` é aplicado **per-view** na `CaptureView`. Documentar em comentário que a taxa é configurável por ambiente.
  - [x] Registrar a env nova em `.env.example` (se o arquivo existir) com o default e um comentário curto.

- [x] **Task 6 — Wiring de URL: `POST /api/capture`** (AC: #1)
  - [x] Criar `backend/automation/urls.py` com `path("capture", CaptureView.as_view(), name="automation-capture")` (**sem barra final** — ver Dev Notes › "Rota externa: `/api/capture` sem barra final").
  - [x] Em `backend/config/urls.py`, incluir `path("api/", include("automation.urls"))` → resolve para `/api/capture` (e prepara `/api/summary/today` da Story 12.6 no mesmo `automation/urls.py`). Adicionar comentário curto explicando por que `automation` entra sob `api/` puro (endpoints externos com caminhos literais da AD-19, sem prefixo de app compartilhado).

- [x] **Task 7 — Testes** (AC: #1, #2, #3, #4)
  - [x] `automation/tests/test_services.py` (unit, sem HTTP): dentro de `tenant_context(user)`, `dispatch_capture(user=user, type="braindump", text="Ideia")` cria um `BrainDumpItem` com `title="Ideia"`; `dispatch_capture(..., type="desconhecido", text="x")` levanta `UnknownCaptureType`; `value` é ignorado no braço braindump.
  - [x] `automation/tests/test_views.py` (endpoint via **Bearer token real**, materializado com `AutomationToken.issue(user=user, name="t", scopes=[SCOPE_CAPTURE])` → header `Authorization: Bearer <full>`; **não** usar `force_authenticate`, que pularia a auth class e não setaria o tenant context — ver Dev Notes › "Testar com token real, não `force_authenticate`"):
    - (AC1) `{type: "braindump", text: "Ideia"}` → **201**, corpo tem `id`; `BrainDumpItem` existe com `title="Ideia"`.
    - (AC1) `type` desconhecido → **400** com mensagem clara.
    - (AC1) sem `text` (ou `text` vazio) → **400**.
    - (AC2) após o POST, uma requisição JWT normal do dono a `GET /api/brain-dump/items/` mostra o item; `GET /api/brain-dump/count/` reflete +1.
    - (AC2/isolamento) o item nunca aparece para `other_user` (via listagem JWT do outro tenant → vazio).
    - (AC3/auth) sem header `Authorization` → **401**; token inválido → **401**; token **revogado** → **401** (`revoked_at` setado).
    - (AC3/escopo) token só com escopo `summary` (sem `capture`) → **403**.
    - (AC3/throttle) exceder a taxa → **429** — ver Dev Notes › "Testar o `ScopedRateThrottle` de forma determinística" (usar `override_settings` com a taxa baixa + limpar o cache).
    - (AC3/log) `caplog` captura o log estruturado com `token_prefix`/`endpoint`/`status`, e o token **pleno não** aparece em nenhum record.
  - [x] Se necessário, adicionar um `AutomationTokenFactory` com escopo custom (a factory da 12.4 já usa `scopes=[SCOPE_CAPTURE]`; para o teste de 403, materializar com `AutomationToken.issue(..., scopes=[SCOPE_SUMMARY])`).

- [x] **Task 8 — Contrato OpenAPI + suíte verde** (AC: #1–#4)
  - [x] **Regenerar o contrato** (há endpoint novo — diferente da 12.4): `cd backend && uv run python manage.py spectacular --file ../schema.yaml`; depois `cd frontend && npm run generate-types` (gera `src/api/types.gen.ts`). **Commitar ambos** — o CI falha se `types.gen.ts` divergir de `schema.yaml` (ver Dev Notes › "CI diffa `types.gen.ts`"). Requer Node ≥20.12 no frontend (`nvm use 22.15.1`).
  - [x] Conferir que o diff de `schema.yaml` inclui **o endpoint `/api/capture`** (e possivelmente a deriva pré-existente `waitingOn` da 12.2, que deixou o `schema.yaml` desatualizado — ver Dev Notes › "Deriva `waitingOn` pré-existente"). Nada além do esperado.
  - [x] `cd backend && uv run pytest` → **suíte inteira verde** (Postgres LOCAL via docker-compose; gate cross-app do projeto).
  - [x] `uv run ruff check .` + `uv run ruff format --check .` (arquivos tocados limpos) e `uv run lint-imports` → **verde** (contrato de porta do `core` intacto; `automation → braindump` permitido).
  - [x] **Sem migration nova** (nenhum campo de modelo muda) → **sem** aplicar migration à branch Neon e2e; **sem** E2E novo (backend-only, sem UI).

## Dev Notes

### Contexto e fronteira da fatia (AD-19 / FR-3.2 / FR-3.4)

- Esta story entrega o **primeiro endpoint HTTP** da Plataforma de Automação (C5). A espinha de auth já existe (Story 12.4, `done`): `AutomationToken` + `AutomationTokenAuthentication` + `HasAutomationScope` + escopos `SCOPE_CAPTURE`/`SCOPE_SUMMARY`. Esta fatia só **consome** essa espinha num endpoint real. `GET /api/summary/today` é a **Story 12.6** (mesmo `automation/urls.py`). [Source: architecture.md#AD-19 (L871-904); epics.md#Story-12.5 (L2020-2044); 12-4-token-de-automacao-com-autenticacao-dedicada.md]
- **Sem UI** (Tier 0). O item cai no **Brain Dump legado**, já visível desde o dia 1 (AD-13/AD-19). Nenhuma superfície nova; nenhuma mudança de frontend **além** do `types.gen.ts` regenerado pelo endpoint novo. [Source: epics.md L2033-2035, L513]
- **PWA não é canal de captura** (FR-3.5): a captura externa vai **direto na API** via atalho iOS. Não há nada de PWA nesta story. [Source: architecture.md#AD-19 item 6; epics.md L1906]

### Forma exata do endpoint (o dev NÃO deve reinventar)

```
POST /api/capture
Authorization: Bearer bujo_<...>          # AutomationToken pleno (Story 12.4)
Content-Type: application/json

{ "type": "braindump", "text": "comprar café", "value": null }
→ 201  { "id": "<uuid do BrainDumpItem>" }

type desconhecido        → 400 { "type": "Tipo de captura desconhecido: <valor>" }
text ausente/vazio       → 400 (validação do serializer)
sem/inválido/revogado    → 401 (Bearer)
token sem escopo capture → 403
excedeu a taxa           → 429
```

### Service existente a reusar — NÃO criar um novo (anti-reinvenção)

`braindump.services.create_brain_dump_item` **já existe** e é o ponto de entrada correto:

```python
# backend/braindump/services.py
@transaction.atomic
def create_brain_dump_item(*, user, title, description=None, target_log=None) -> BrainDumpItem:
    return BrainDumpItem.objects.create(title=title, description=description, target_log=target_log)
```

- O `text` do payload → `title` do item. `description`/`target_log` ficam nos defaults (captura externa é só o texto). **Não** duplicar a lógica de criação; **não** criar `BrainDumpItem.objects.create(...)` direto na view/service de automação — chamar o service de domínio. [Source: backend/braindump/services.py:28-32]
- `create_brain_dump_item` usa `BrainDumpItem.objects` (manager `TenantModel` **fail-closed**): exige tenant context setado. A `AutomationTokenAuthentication` **seta o contexto** com o dono do token como efeito de `authenticate()` — logo, dentro do handler o contexto já está ativo e a criação escopada funciona (e o middleware reseta no `finally`). [Source: backend/automation/authentication.py:58-66; backend/core/middleware.py]

### Por que `type` é `CharField` e não `ChoiceField` (AC4)

A AC4 exige que **adicionar um tipo novo não exija retrabalho de contrato**. Um `ChoiceField(choices=["braindump"])` acoplaria o contrato OpenAPI à lista de tipos — cada tipo novo mudaria o enum no `schema.yaml`/`types.gen.ts`. Um `CharField` aberto + **dispatcher por `match`** mantém o contrato estável e a extensão trivial (um braço a mais no `match`), com **mensagem 400 clara** para tipo desconhecido vinda do dispatcher, não do serializer. É a leitura literal de "match por tipo, **sem** registro especulativo". [Source: epics.md#Story-12.5 AC4 (L2042-2044); architecture.md#AD-19 item 3]

### Fronteira service × HTTP (dispatcher HTTP-agnóstico)

O `dispatch_capture` é um **composition service** — não deve conhecer HTTP. Levantar `rest_framework.serializers.ValidationError` dentro dele vazaria a camada HTTP para o domínio. Padrão do projeto: service levanta erro de domínio (`UnknownCaptureType(ValueError)`), a **view** traduz para o `Response(status=400)` com mensagem clara. Espelha o `braindump/views.py`, onde a view mapeia `BrainDumpItem.DoesNotExist` → `NotFound` (404) e o service permanece agnóstico. [Source: backend/braindump/views.py:43-48; §6.2 "views finas"]

### 401 vs 403 sem `IsAuthenticated` (fluxo DRF)

Com `permission_classes = [HasAutomationScope]` (sem `IsAuthenticated`), os desfechos ficam corretos por construção:
- **Token inválido/revogado:** `AutomationTokenAuthentication.authenticate()` levanta `AuthenticationFailed` → DRF responde **401** (a classe define `authenticate_header()` → `"Bearer"`).
- **Sem header `Authorization`:** `authenticate()` retorna `None` → nenhum autenticador teve sucesso → `HasAutomationScope` nega → DRF, vendo `request.authenticators and not request.successful_authenticator`, levanta `NotAuthenticated` → **401**.
- **Token válido, escopo errado:** houve autenticador com sucesso → `HasAutomationScope` nega → **403**.
- **Token válido com escopo `capture`:** segue para o handler.

`IsAuthenticated` seria redundante (o mesmo 401/403 já emerge) e não agrega — Occam. [Source: DRF `APIView.permission_denied`; backend/automation/authentication.py:68-73; 12-4 Dev Notes "401 vs 403"]

### Logar todos os desfechos do handler (AC3)

A AC3 pede log "cada chamada" com `{token_prefix, endpoint, status}`. Escopo pragmático: logar **toda chamada que alcança o handler** (201 de sucesso e 400 de validação/tipo-desconhecido). Como `raise_exception=True` no serializer aborta antes do log, prefira validar com `serializer.is_valid()` (sem raise) e logar o status em cada braço, **ou** capture o `ValidationError` e logue antes de repropagar. Falhas de **auth/escopo (401/403)** acontecem em `APIView.initial()` **antes** do handler — ficam fora deste log de handler (o pacote de observabilidade AR-22 cobre acesso; não antecipar — Occam). Documentar essa fronteira inline. [Source: architecture.md#AD-19 item 5; epics.md#Story-12.5 AC3]

### Rota externa: `/api/capture` **sem** barra final

A AD-19 escreve os endpoints externos como `POST /api/capture` e `GET /api/summary/today` — **sem barra final** (o resto do projeto usa barra: `items/`, `count/`). Honrar o literal da AD-19: um atalho iOS chama uma URL **fixa** e o `APPEND_SLASH` do Django **não** resgata um **POST** (só redireciona GET) — um POST à variante de barra errada dá 404. Definir `path("capture", ...)` (sem barra) para casar exatamente com o que o Shortcut chama. [Source: architecture.md#AD-19 item 3 (L880-881); Django APPEND_SLASH docs]

### Throttle: `ScopedRateThrottle` per-view + taxa em settings (AC3)

- Aplicar **na view**: `throttle_classes = [ScopedRateThrottle]` + `throttle_scope = "automation-capture"`. **Não** setar `DEFAULT_THROTTLE_CLASSES` global (throttlaria a API inteira). A taxa vem de `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["automation-capture"]` (env-configurável). [Source: DRF throttling docs; architecture.md#AD-19 item 5]
- **Keying:** `ScopedRateThrottle` chaveia por `request.user` (autenticado) por padrão. Como o `request.user` é o **dono do token**, o limite é por-usuário — suficiente para o AC ("aplica o limite"). Limite por-token seria refinamento futuro; **não** exigido aqui (Occam).
- **Cache:** não há `CACHES` configurado → Django usa `LocMemCache` (default). O throttle conta no cache; em teste isso persiste no processo — ver a nota de teste abaixo.

### Testar o `ScopedRateThrottle` de forma determinística

DRF lê as taxas de `api_settings.DEFAULT_THROTTLE_RATES`, que **recarrega** no sinal `setting_changed`. Recomendado para o teste de 429:
```python
from django.core.cache import cache
from django.test import override_settings
rates = {**settings.REST_FRAMEWORK, "DEFAULT_THROTTLE_RATES": {"automation-capture": "1/min"}}
with override_settings(REST_FRAMEWORK=rates):
    cache.clear()                      # zera contadores antes
    r1 = client.post(...)              # 201
    r2 = client.post(...)              # 429
```
Limpe o cache (`cache.clear()`) no início do teste de throttle para não herdar contadores de outros testes. Os demais testes de captura não são afetados desde que a taxa default seja generosa (ex.: `60/min`) e cada teste use um usuário/token distinto (ident diferente). [Source: DRF `SimpleRateThrottle`/`api_settings`; sem CACHES → LocMemCache]

### Testar com token real, não `force_authenticate`

`force_authenticate` substitui os autenticadores por `ForcedAuthentication` — a `AutomationTokenAuthentication` **nunca** roda, então o tenant context **não** é setado e a criação via `BrainDumpItem.objects` (fail-closed) levantaria `TenantScopeViolation`. Para estes testes, materialize um token real e passe o header:
```python
token, full = AutomationToken.issue(user=user, name="t", scopes=[SCOPE_CAPTURE])
client.credentials(HTTP_AUTHORIZATION=f"Bearer {full}")
resp = client.post("/api/capture", {"type": "braindump", "text": "x"}, format="json")
```
O ciclo de request real (APIClient passa pelo middleware) faz a auth setar o contexto e o `TenantMiddleware` resetar no `finally`. É o caminho E2E limpo (e o único que exercita o isolamento de verdade). Contraste registrado em `braindump/tests/test_views.py:171-191` (por que `force_authenticate` sozinho não basta). [Source: backend/automation/authentication.py; backend/braindump/tests/test_views.py:171-191]

### CI diffa `types.gen.ts` — regenerar e commitar (diferente da 12.4)

A 12.4 **não** teve endpoint novo (contrato inalterado). Esta story **adiciona** `/api/capture` → o `schema.yaml` muda → o CI (`ci.yml`) regenera `schema.yaml` via `spectacular` e **falha se `frontend/src/api/types.gen.ts` divergir**. Sequência obrigatória:
```
cd backend  && uv run python manage.py spectacular --file ../schema.yaml
cd frontend && nvm use 22.15.1 && npm run generate-types   # → src/api/types.gen.ts
```
Commitar `schema.yaml` **e** `types.gen.ts`. [Source: .github/workflows/ci.yml:68-81; frontend/package.json:12; MEMORY [[frontend-needs-node-22-via-nvm]]]

### Deriva `waitingOn` pré-existente no `schema.yaml`

A Story 12.4 registrou que o `schema.yaml` commitado está **desatualizado** quanto a `waitingOn` (a 12.2 alterou o backend mas não regenerou o schema). Ao rodar `spectacular` agora, o diff de `schema.yaml` mostrará **duas** coisas: (1) o endpoint novo `/api/capture` (desta story) e (2) os campos `waitingOn` (deriva herdada da 12.2). Ambos são **corretos** — regenerar limpa a deriva de brinde. Não é motivo de alarme; apenas confirme que não há um terceiro delta inesperado. [Source: 12-4 Completion Notes "OpenAPI"; 12-2-flag-waiting-on-no-backend.md]

### Segurança do contrato OpenAPI (caveat menor, opcional)

Como `AutomationTokenAuthentication` **não** está em `DEFAULT_AUTHENTICATION_CLASSES`, o drf-spectacular pode não inferir o `securityScheme` correto do endpoint (tende a herdar o Bearer/JWT global). Isso **não** quebra o CI (que só compara `types.gen.ts` × `schema.yaml`) nem o runtime. Deixar um `OpenApiAuthenticationExtension` para a auth class é **opcional/nice-to-have** (contrato mais honesto) — não obrigatório nesta fatia (Tier 0, sem consumidor de contrato para a auth de automação). Se optar, registrar a extensão em `automation/` e regenerar. [Source: drf-spectacular auth extension docs; backend/config/settings/base.py:139-141]

### Camadas e stack (versões)

Django 5.2, DRF (`APIView`, `ScopedRateThrottle`, `BaseAuthentication`), `drf-spectacular` (`@extend_schema`), `djangorestframework-camel-case` (parser/renderer na borda — §6.3), `django-environ` (`env(...)` para a taxa configurável), Python via `uv`. Logging via `logging` stdlib (`getLogger(__name__)`; precedente `core/exceptions.py`). [Source: backend/config/settings/base.py; backend/pyproject.toml]

### Inteligência das stories anteriores (12.1–12.4)

- **12.4** (espinha de auth, `done`): entregou tudo que esta story consome — `AutomationToken.issue()`, `AutomationTokenAuthentication` (seta tenant context, 401 via `authenticate_header`), `HasAutomationScope` (lê `required_scopes`/`required_scope`, fail-closed), constantes `SCOPE_CAPTURE`/`SCOPE_SUMMARY`, `hash_token`. **Reusar diretamente** — não reimplementar auth/escopo. A 12.4 também consolidou: (a) `core.calendar.now()` para timestamps de infra (o guardrail AST proíbe `timezone.now()` direto); (b) `automation` é app de composição (pode importar services de domínio). [Source: 12-4-token-de-automacao-com-autenticacao-dedicada.md]
- **12.2** (backend `waiting_on`): estabeleceu o ritual de regeneração de contrato e o gate de suíte pytest completa em Postgres LOCAL; deixou a deriva `waitingOn` no `schema.yaml` (ver acima).
- **12.1/12.2** provam o padrão de teste backend (services de domínio + `tenant_context` + asserts).
- **12.3** (frontend, manifest): sem sobreposição técnica (esta é 100% backend), mas reforça a disciplina de **não** antecipar consumidores/registros especulativos (relevante ao dispatcher da AC4).

### Padrões de teste a espelhar

- **Endpoint fino:** `braindump/tests/test_views.py` (POST → 201, validação → 400, isolamento por tenant). Espelhar a forma; trocar `auth_client` (JWT) por token real via `client.credentials(HTTP_AUTHORIZATION="Bearer ...")` para os endpoints de automação. [Source: backend/braindump/tests/test_views.py]
- **Auth de automação (unit):** `automation/tests/test_authentication.py` / `test_permissions.py` (Story 12.4) mostram como materializar tokens e chamar a auth/permissão diretamente — útil para os casos 401/403/429 se preferir granularidade. [Source: backend/automation/tests/]
- **Isolamento fim-a-fim:** o item capturado por um dono nunca aparece para outro tenant — padrão de `test_isolamento_fim_a_fim...` do braindump, mas aqui o contexto vem da **auth por token real**, não de `tenant_context`/`force_authenticate`. [Source: backend/braindump/tests/test_views.py:171-191]

### Project Structure Notes

- **Novos arquivos** (app `automation`): `serializers.py`, `services.py`, `views.py`, `urls.py`, `tests/test_services.py`, `tests/test_views.py`. (A 12.4 deixou explicitamente esses fora — são desta fatia.) [Source: 12-4 Task 1; ls backend/automation/]
- **Modificados:** `backend/config/urls.py` (`include("automation.urls")` sob `path("api/", ...)`); `backend/config/settings/base.py` (`REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]`); `schema.yaml` (endpoint novo + deriva `waitingOn`); `frontend/src/api/types.gen.ts` (regenerado); `.env.example` (env da taxa, se existir).
- **Sem** migration nova (nenhum campo de modelo muda) → **sem** passo Neon e2e, **sem** E2E novo (backend-only, sem UI).
- **Contrato de imports:** `automation` (composição) importa `braindump.services` — permitido; `import-linter` só proíbe `core` → apps de domínio. Confirmar verde. [Source: backend/pyproject.toml:59-63]

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-12.5 (L2020-2044)] — AC-fonte (payload raso, service existente, 400, rate/log, dispatcher por type sem registro especulativo)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-12 (L1902-1908), #Story-12.4 (L1993-2018), #Story-12.6 (L2046-2069)] — contexto do épico e vizinhas (12.4 entrega a auth; 12.6 é o próximo endpoint no mesmo `automation/urls.py`)
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-19 (L871-904)] — Plataforma de Automação: endpoints `/api/capture` e `/api/summary/today`, dispatcher por type, rate limiting + log `{token_prefix, endpoint, status}`, token nunca logado, app de composição
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-13 (L711)] — badge do Brain Dump como server state derivado (refetch reflete a captura externa)
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-27 (L1138, L1186)] — ingestão de PA tem endpoint próprio (não passa pelo `/api/capture`), reusa a mesma auth class
- [Source: _bmad-output/implementation-artifacts/12-4-token-de-automacao-com-autenticacao-dedicada.md] — auth class, permissão de escopo, `AutomationToken.issue()`, `SCOPE_CAPTURE`/`SCOPE_SUMMARY`, 401 via `authenticate_header`, `core.calendar.now()`
- [Source: backend/braindump/services.py:28-32] — `create_brain_dump_item(*, user, title, ...)` — service a reusar
- [Source: backend/braindump/views.py, backend/braindump/tests/test_views.py] — padrão de view fina e de teste de endpoint/isolamento a espelhar
- [Source: backend/automation/authentication.py, permissions.py, models.py] — a espinha da 12.4 a consumir (auth + escopo + constantes)
- [Source: backend/config/urls.py, backend/config/settings/base.py:134-162] — wiring de URL e `REST_FRAMEWORK` (onde a taxa de throttle entra)
- [Source: .github/workflows/ci.yml:68-81, frontend/package.json:12] — CI regenera `schema.yaml` e diffa `types.gen.ts`
- [Source: backend/pyproject.toml:55-63] — contrato import-linter (porta do `core`)
- [Source: MEMORY [[frontend-needs-node-22-via-nvm]], [[ci-runs-full-pytest-suite-on-push]], [[dev-branch-homologation-workflow]], [[ask-dont-assume-functionality-flows]]]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8) — BMAD dev-story workflow

### Debug Log References

- **Suíte backend completa (gate cross-app, Postgres LOCAL):** `cd backend && uv run pytest` → **932 passed** in 306.22s (exit 0), sem regressão. Rodada SEM escopo de caminho (guardrail Retro Epic 11).
- **Automation isolado:** `uv run pytest automation/ -q` → **40 passed** (26 herdados da 12.4 + 14 novos: 3 em `test_services.py`, 11 em `test_views.py`).
- **Throttle determinístico:** `override_settings(REST_FRAMEWORK=...)` NÃO rebinda a taxa — `SimpleRateThrottle.THROTTLE_RATES = api_settings.DEFAULT_THROTTLE_RATES` é ligado UMA vez no import da classe (throttling.py:66) e o sinal `setting_changed` só reseta o `api_settings`, não o atributo de classe. O teste de 429 patcha `ScopedRateThrottle.THROTTLE_RATES` diretamente + `cache.clear()`. Confirmado empiricamente (r1=201, r2=429).
- **Qualidade:** `uv run ruff check` + `uv run ruff format --check` (arquivos tocados) → limpos; `uv run lint-imports` → 1 kept, 0 broken (`automation → braindump` permitido; porta do `core` intacta).
- **Contrato OpenAPI:** `spectacular --file ../schema.yaml` + `npm run generate-types` (Node 22.15.1). Diff aditivo (0 remoções → nenhum `security` perdido): (1) endpoint novo `/api/capture` + schemas `CaptureRequest`/`CaptureResponse`; (2) deriva `waitingOn` herdada da 12.2 em dois schemas de Task. Nenhum terceiro delta inesperado.

### Completion Notes List

- **AC1 — POST /api/capture cria Brain Dump via service existente + 400s.** `CaptureRequestSerializer` (payload raso `{type, text, value?}`); `dispatch_capture` chama `braindump.services.create_brain_dump_item(user=..., title=text)` (service EXISTENTE reusado, sem duplicar `objects.create`); resposta curta 201 `{"id": <uuid>}` via `CaptureResponseSerializer`. `type` desconhecido → 400 `{"type": "Tipo de captura desconhecido: <valor>"}` (mensagem vinda do dispatcher). `text` ausente/vazio → 400 (validação do serializer). Testado em `test_services.py` (unit) e `test_views.py` (endpoint via token real).
- **AC2 — Item aparece no Brain Dump legado do dono + isolamento.** Após o POST por token, uma requisição JWT do dono a `GET /api/brain-dump/items/` mostra o item e `GET /api/brain-dump/count/` reflete +1; o item NUNCA aparece para `other_user` (listagem vazia). O isolamento (AD-12) é setado pela `AutomationTokenAuthentication` no ciclo de request real — por isso os testes usam Bearer real, não `force_authenticate`.
- **AC3 — Rate limit + auditoria nascem junto.** `ScopedRateThrottle` per-view (escopo `automation-capture`); taxa em `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]` (env `AUTOMATION_CAPTURE_THROTTLE`, default `60/min`); exceder → 429. `logger.info("automation capture", extra={token_prefix, endpoint, status})` em cada chamada que alcança o handler (201 e 400 — validação com `is_valid()` sem `raise_exception`). Token PLENO nunca logado nem acessível na view (só `token_prefix`); confirmado em `caplog`. 401/403 ocorrem em `initial()` antes do handler (fora deste log; observabilidade de acesso é AR-22).
- **AC4 — Dispatcher extensível sem registro especulativo.** `dispatch_capture` usa `match type` (um braço `"braindump"`, `case _` → `UnknownCaptureType`); adicionar tipo = adicionar um braço, sem tocar modelo/contrato. `type` é `CharField` ABERTO (não `ChoiceField`) → contrato OpenAPI estável. `value` reservado (aceito e ignorado no braço braindump). PA não passa por aqui (AD-27).
- **Sem migration nova** (nenhum campo de modelo muda) → sem passo Neon e2e. **No dev-story não houve E2E** (backend-only, sem UI); o passo posterior de QA (`bmad-qa-generate-e2e-tests`) adicionou **1 E2E** para o efeito visível do AC2 — ver File List › "QA" e Senior Developer Review (AI). Auth/escopo reusam integralmente a espinha da 12.4 (`AutomationToken.issue`, `AutomationTokenAuthentication`, `HasAutomationScope`, `SCOPE_CAPTURE`).
- **DEFAULT_AUTHENTICATION_CLASSES NÃO foi tocado** (só `DEFAULT_THROTTLE_RATES`) — checagem de `security`/`securitySchemes` (guardrail Retro Epic 3 #4): diff do `schema.yaml` é 100% aditivo, nenhum `security` removido de endpoint algum.
- **Caveat menor (opcional, NÃO implementado — Occam):** o warning `could not resolve authenticator AutomationTokenAuthentication` na geração do schema é esperado (a auth class não está no `DEFAULT_AUTHENTICATION_CLASSES`). Registrar um `OpenApiAuthenticationExtension` é nice-to-have (contrato mais honesto), não obrigatório nesta fatia Tier 0 — ver Dev Notes › "Segurança do contrato OpenAPI". Não quebra CI (só compara `types.gen.ts` × `schema.yaml`) nem runtime.

### File List

**Novos (app `automation`):**
- `backend/automation/serializers.py`
- `backend/automation/services.py`
- `backend/automation/views.py`
- `backend/automation/urls.py`
- `backend/automation/tests/test_services.py`
- `backend/automation/tests/test_views.py`

**Modificados:**
- `backend/config/settings/base.py` — `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["automation-capture"]` (env-configurável, per-view; sem `DEFAULT_THROTTLE_CLASSES` global)
- `backend/config/urls.py` — `path("api/", include("automation.urls"))` (endpoints externos literais da AD-19)
- `backend/.env.example` — `AUTOMATION_CAPTURE_THROTTLE=60/min`
- `schema.yaml` — endpoint `/api/capture` + schemas `CaptureRequest`/`CaptureResponse` + deriva `waitingOn` (regen)
- `frontend/src/api/types.gen.ts` — regenerado do `schema.yaml` (CI diffa este arquivo)

**QA (passo `bmad-qa-generate-e2e-tests`, pós dev-story) — sincronizado na revisão:**
- `frontend/e2e/external-capture.spec.ts` — E2E (Playwright): captura externa por token → item no Brain Dump legado do dono (lista + badge da sidebar), AC2
- `frontend/e2e/seedAutomationToken.ts` — helper de seed `issueAutomationToken(email)` (materializa `AutomationToken.issue` via `manage.py shell`, retorna o pleno para o Bearer do spec)
- `backend/automation/tests/test_views.py` — **+1 teste** (`test_log_tambem_registra_o_400_de_tipo_desconhecido`) → `automation/` passa de 40 para **41 passed**
- `_bmad-output/implementation-artifacts/tests/test-summary-12-5.md` — resumo de automação de testes do passo de QA

**Tracking (BMAD):**
- `_bmad-output/implementation-artifacts/12-5-captura-externa-post-api-capture.md` — frontmatter `baseline_commit`, checkboxes, Dev Agent Record, Senior Developer Review (AI), Change Log, Status
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `12-5 → in-progress → review → done`

## Senior Developer Review (AI)

**Revisor:** HugoMMBrito · **Data:** 2026-07-23 · **Resultado:** ✅ Aprovado (0 CRITICAL, 0 HIGH) · **Modelo:** claude-opus-4-8

### Escopo da revisão

Revisão adversarial: lidos TODOS os arquivos do File List + descobertos via `git status`, cruzando cada AC contra a implementação, auditando cada task `[x]`, e reexecutando os gates de qualidade/testes/contrato desta máquina (não confiando apenas no registro do dev).

### Validação das Acceptance Criteria (todas IMPLEMENTADAS)

- **AC1** — `POST /api/capture` cria Brain Dump via `braindump.services.create_brain_dump_item` (service EXISTENTE reusado; sem duplicar `objects.create`); 201 curto `{id}`; `type` desconhecido → 400 `{"type": "Tipo de captura desconhecido: <valor>"}` (mensagem vinda do dispatcher); `text` ausente/vazio/whitespace → 400 (CharField com `trim_whitespace`). Provado em `test_services.py` + `test_views.py`.
- **AC2** — item aparece no Brain Dump legado do dono (`items/` + `count/ = 1`) e **nunca** vaza para outro tenant; isolamento setado pela auth por **token real** (Bearer), não `force_authenticate`.
- **AC3** — `ScopedRateThrottle` per-view (escopo `automation-capture`); taxa em `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]` com override por env `AUTOMATION_CAPTURE_THROTTLE` (default `60/min`); 429 ao exceder; log estruturado `{token_prefix, endpoint, status}` em cada chamada que alcança o handler (201 + AMBOS os 400s); **token pleno nunca logado nem acessível** na view (`request.auth` só guarda `token_prefix`). Nenhuma chave de `extra=` colide com atributo reservado de `LogRecord`.
- **AC4** — dispatcher `match type` (`case _` → `UnknownCaptureType`); `type` é `CharField` ABERTO → contrato `type: string` **sem enum** (confirmado no `schema.yaml`); `value` reservado e ignorado no braço braindump; sem registro/plugin especulativo.

### Verificações reexecutadas nesta revisão

- `uv run pytest automation/ -q` → **41 passed**.
- `uv run pytest` (suíte completa, gate cross-app, Postgres LOCAL) → **933 passed** (exit 0), sem regressão. (O `baseline` do dev-story era 932; +1 é o teste do passo de QA.)
- `ruff check` + `ruff format --check` (arquivos tocados) → limpos; `lint-imports` → **1 kept, 0 broken** (`automation → braindump` permitido; porta do `core` intacta).
- Contrato: `spectacular` regenerado **== `schema.yaml` commitado (0 diff)**; `npm run generate-types` (Node 22.15.1) **== `types.gen.ts` commitado (0 diff)** → o gate de CI passaria. Os 4 "errors" do `spectacular` são o pré-existente `accounts/signup` (1 único, repetido), **não** introduzidos aqui; o único aviso desta story é o esperado `could not resolve authenticator AutomationTokenAuthentication` (opcional/Tier 0).

### Achados

- **[MÉDIO] File List desatualizado vs realidade do git — CORRIGIDO nesta revisão.** O passo posterior de QA (`bmad-qa-generate-e2e-tests`) adicionou arquivos ausentes do File List do dev-story: `frontend/e2e/external-capture.spec.ts`, `frontend/e2e/seedAutomationToken.ts`, `_bmad-output/implementation-artifacts/tests/test-summary-12-5.md`, e um 14º teste em `backend/automation/tests/test_views.py`. O dev-story também afirmava "sem E2E novo". Sincronizado o File List (subseção "QA") e anotada a Completion Note.
- **[BAIXO] Contagens de teste imprecisas no Debug Log — ANOTADO.** "40 passed (26 herdados + 14 novos: 3 em test_services, 11 em test_views)" — a divisão real é **24 herdados** (12.4) + **16 novos do dev-story** (3 services + 13 views), e o total atual é **41** após o teste do QA. O total 40 do dev-story estava certo; a divisão 26/14/11 não. Não afeta código nem contrato.

### Conclusão

Implementação fiel às ACs, alta qualidade, suíte verde e contrato em sincronia. Nenhum problema CRITICAL/HIGH; os achados são de sincronização de documentação, corrigidos aqui. **Status → done.**

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-07-23 | 1.0 | Implementação da Story 12.5: `POST /api/capture` (app `automation`) — serializers, dispatcher `match`-por-type (`UnknownCaptureType`), `CaptureView` (auth por token + escopo `capture` + `ScopedRateThrottle` + log estruturado), taxa em settings, wiring de URL, 16 testes novos (token real), contrato OpenAPI regenerado. Suíte completa 932 passed. | Amelia (dev-story, Opus 4.8) |
| 2026-07-23 | 1.1 | Revisão adversarial (story-automator-review): ACs 1–4 validadas; suíte completa reexecutada **933 passed**, `automation/` 41, ruff/lint-imports verdes, `schema.yaml`+`types.gen.ts` com 0 diff (gate CI OK). Achados: [MÉDIO] File List sincronizado com os arquivos do passo de QA (E2E `external-capture.spec.ts` + `seedAutomationToken.ts` + `test-summary-12-5.md` + 14º teste); [BAIXO] contagens de teste do Debug Log corrigidas. 0 CRITICAL/HIGH → Status → **done**. | HugoMMBrito (review, Opus 4.8) |
