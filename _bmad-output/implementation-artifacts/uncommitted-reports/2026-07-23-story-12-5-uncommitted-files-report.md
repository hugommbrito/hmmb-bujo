# Explicação dos arquivos não commitados — Story 12.5: Captura externa `POST /api/capture`

## Visão geral

A Story 12.5 entrega o primeiro **endpoint HTTP externo** da Plataforma de Automação:
`POST /api/capture` (AD-19 itens 3/4, FR-3.x). Um agente externo (ex.: atalho iOS) autenticado por
**token de automação** (a auth class da Story 12.4, escopo `capture`) envia um payload raso
`{type, text, value?}`; o endpoint despacha por `type` para o service de domínio correto — hoje só
`"braindump"`, que cria um item de Brain Dump via o **service existente** — e responde `201 {id}`.
`type` desconhecido → `400`. Nasce com **rate limiting** (`ScopedRateThrottle`, taxa configurável por
env) e **log estruturado de auditoria** (FR-3.4). Sem migration nova (reusa `BrainDumpItem`).

**Segurança/contrato:** token pleno nunca logado (só `token_prefix`); `DEFAULT_AUTHENTICATION_CLASSES`
intocado (auth é opt-in per-view); `DEFAULT_THROTTLE_CLASSES` global intocado (throttle per-view);
diff de `schema.yaml` 100% aditivo (nenhum `security` removido).

**Gate:** backend **932 passed** (dev) / `automation/` **41 passed**; **E2E** `external-capture.spec.ts`
1 passed (captura externa → item aparece no Brain Dump, AC2); eslint/tsc/ruff limpos; migration
`automation.0001` já na branch Neon e2e. Code review adversarial: 0 High, 1 Medium (doc-sync,
corrigido), 1 Low. Código de produção intocado pelo review.

## Ordem lógica de funcionamento

1. **Planejamento/status** — story file + `sprint-status.yaml`.
2. **Config** — `settings/base.py` (throttle rate), `.env.example` (env var), `config/urls.py` (wiring).
3. **Serializers** — `automation/serializers.py` (request/response).
4. **Service** — `automation/services.py` (`dispatch_capture`, HTTP-agnóstico).
5. **View** — `automation/views.py` (`CaptureView`: auth + escopo + throttle + log).
6. **URL** — `automation/urls.py` (`/api/capture` sem barra final).
7. **Contrato** — `schema.yaml` + `frontend/src/api/types.gen.ts` (OpenAPI regen).
8. **Testes** — pytest (services/views) + E2E (`external-capture.spec.ts`, `seedAutomationToken.ts`).
9. **Artefatos** — `test-summary-12-5.md`, `_bmad-output/story-automator/*`.

---

## 1. Planejamento/status
- **`12-5-captura-externa-post-api-capture.md`** (novo) — story file: 27 subtasks `[x]`, `Status: done`, Dev Agent Record (932 passed) + review section.
- **`sprint-status.yaml`** — `12-5-...: backlog → done`.

## 2. Config
- **`backend/config/settings/base.py`** — `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["automation-capture"]`
  = `env("AUTOMATION_CAPTURE_THROTTLE", default="60/min")`. **Sem** `DEFAULT_THROTTLE_CLASSES` global.
- **`backend/.env.example`** — `AUTOMATION_CAPTURE_THROTTLE=60/min`.
- **`backend/config/urls.py`** — `path("api/", include("automation.urls"))` (endpoints externos com
  caminhos literais da AD-19 sob `api/` puro, sem prefixo de app compartilhado).

## 3. Serializers
### `backend/automation/serializers.py` (NOVO)
- `CaptureRequestSerializer`: `type` (CharField **aberto**, não ChoiceField — extensível), `text`
  (CharField max_length=500 → `BrainDumpItem.title`), `value` (opcional, **reservado** a tipos futuros).
- `CaptureResponseSerializer`: `id` (UUID read-only) — corpo curto do 201.

## 4. Service
### `backend/automation/services.py` (NOVO)
**`dispatch_capture(*, user, type, text, value=None)`** — composition service **HTTP-agnóstico**:
`match type` → `"braindump"` chama `braindump.services.create_brain_dump_item(user, title=text)`;
`_` → `raise UnknownCaptureType(type)` (erro de **domínio**, a view traduz em 400). `value` aceito e
ignorado no braço braindump. Estender = +1 braço no `match` (AD-27, Occam — sem registro especulativo).
`automation` é app de composição (pode importar `braindump.services`; o import-linter só barra `core`→domínio).

## 5. View
### `backend/automation/views.py` (NOVO)
**`CaptureView(APIView)`** — view fina: `authentication_classes = [AutomationTokenAuthentication]`
(opt-in per-view), `permission_classes = [HasAutomationScope]` + `required_scopes = [SCOPE_CAPTURE]`
(sem `IsAuthenticated` redundante — 401/403 já emergem do fluxo DRF), `throttle_classes =
[ScopedRateThrottle]` + `throttle_scope = "automation-capture"`.
- `post()`: valida `CaptureRequestSerializer` **sem** `raise_exception` (para logar o 400) → despacha →
  `201 {id}`; `UnknownCaptureType` → `400 {type: msg}`. `@extend_schema` documenta o contrato.
- `_audit()`: `logger.info("automation capture", extra={token_prefix, endpoint, status})` em cada
  chamada que alcança o handler (201/400). **Token pleno nunca logado** (só `token_prefix`; o segredo
  sequer é acessível na view). 401/403 ocorrem em `initial()` antes do handler (fora deste log; AR-22).

## 6. URL
### `backend/automation/urls.py` (NOVO)
`path("capture", CaptureView.as_view(), name="automation-capture")` — **sem barra final** de propósito
(`APPEND_SLASH` não resgata POST; atalho iOS chama URL fixa). Prepara `/api/summary/today` (12.6).

## 7. Contrato (OpenAPI regen)
- **`schema.yaml`** — `POST /api/capture` documentado (request/response schemas). Diff 100% aditivo.
- **`frontend/src/api/types.gen.ts`** — tipos TS regenerados do OpenAPI.

## 8. Testes
- **`backend/automation/tests/test_services.py`** (novo) — `dispatch_capture` cria BrainDumpItem;
  `type` desconhecido → `UnknownCaptureType`; `value` ignorado.
- **`backend/automation/tests/test_views.py`** (novo) — endpoint via **Bearer token real**
  (`AutomationToken.issue`, não `force_authenticate`): 201, 400 (type desconhecido/payload inválido),
  401 (sem/invalid/revogado), 403 (sem escopo), 429 (throttle), log de auditoria (`caplog`).
- **`frontend/e2e/external-capture.spec.ts`** + **`seedAutomationToken.ts`** (novos) — E2E de AC2:
  captura via `POST /api/capture` (token real semeado) → item aparece no Brain Dump. 1 passed (22.3s).

## 9. Artefatos
- **`_bmad-output/implementation-artifacts/tests/test-summary-12-5.md`** (novo) — resumo de automação da 12.5.
- **`_bmad-output/story-automator/orchestration-12-*.md`** — documento de estado da run.

---

## Nota

Nenhum comportamento de código-fonte foi alterado por este relatório (documentação apenas). O código de
produção da story vive em `backend/automation/` (serializers, services, views, urls) + config
(`settings/base.py`, `config/urls.py`, `.env.example`) + o contrato regenerado (`schema.yaml`,
`types.gen.ts`).
