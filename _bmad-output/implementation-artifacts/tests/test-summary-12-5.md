# Test Automation Summary — Story 12.5 (Captura externa `POST /api/capture`)

**Data:** 2026-07-23 · **QA:** HugoMMBrito · **Executor:** workflow `bmad-qa-generate-e2e-tests`
**Frameworks:** pytest (Postgres LOCAL, gate cross-app) + Playwright (browser real vs. backend Neon `e2e`)

> Nota de arquivo: o `default_output_file` do skill é `test-summary.md`, já
> ocupado pelo resumo da Story 12.4. Para não destruir aquele registro, este
> resumo é gravado como `test-summary-12-5.md` (por-story) no mesmo diretório.

---

## Decisão de estratégia: pytest é o gate + **1 E2E** para o AC2 (justificado)

A Story 12.5 entrega `POST /api/capture` — um endpoint **externo autenticado por
token**, **sem UI própria** (Tier 0). O único efeito visível ao usuário (AC2) é o
item capturado por fora aparecer na superfície **legada** do Brain Dump.

A cobertura **pytest pré-existente (40 testes)** já é forte e permanece o **gate**
principal: 201/400 (tipo desconhecido + `text` ausente/vazio), 401 (sem/ inválido/
revogado), 403 (escopo errado), 429 (throttle determinístico), token **Bearer
real** (não `force_authenticate`), tenant context, log de auditoria sem token
pleno, e — no nível de API — que o `GET /api/brain-dump/items/`/`count/` do dono
refletem a captura, com isolamento entre tenants.

Seguindo o julgamento do workflow ("Generate E2E Tests **if UI exists**") e a
instrução explícita do usuário (adicionar E2E **só** se agrega sinal real ao AC2
**e** não é frágil):

### Gap genuíno encontrado (AC2) — e por que um E2E o fecha

A promessa literal da story ("Para que o Back Tap do iPhone jogue pensamentos
direto no Brain Dump") é uma **travessia que nenhum teste cobria**: um **POST HTTP
externo, com Bearer, fora da sessão do browser → o item surge na UI real do Brain
Dump daquele mesmo usuário (sessão JWT)**.

- O **pytest** prova a camada de **API** (via DRF test client — não renderiza
  React).
- O `brain-dump.spec.ts` existente prova a **renderização**, mas só para itens
  capturados **pela própria UI**.
- A junção **canal-externo → UI-do-dono** — o efeito visível único do AC2 — não
  estava exercitada em lugar nenhum.

### Por que este E2E **não é frágil**

1. Token emitido pelo padrão `runShell`/`manage.py shell` já usado por 10+ seeds.
2. A captura é **um único `request.post` HTTP real** (sem interação de UI no lado
   da captura — fiel ao atalho iOS; sem CSRF, pois a view usa só token auth).
3. Refetch **determinístico** via `page.goto('/brain-dump')` (load completo → lista
   e badge refazem a query no boot — o "próximo refetch" do AC2 — sem depender de
   timing de refetch em background).
4. Locators semânticos **já provados** no `brain-dump.spec.ts`
   (`getByRole('main', {name:'Brain Dump'})`, texto do item, badge).
5. POST único + **usuário novo por teste** → sem contaminação de throttle.

### O que **não** foi adicionado (evitar E2E frágil/redundante)

- Isolamento entre tenants via 2º `browser.newContext()`: o **pytest já cobre**
  (`test_item_capturado_nunca_aparece_para_outro_tenant`).
- Qualquer asserção dependente de refetch em background (usei navegação completa).

---

## Testes gerados (novos)

### `frontend/e2e/external-capture.spec.ts` (+1 teste E2E)
- [x] **captura externa por token aparece no Brain Dump do dono — lista e badge (AC2)**
  Signup real (UI) → emite `AutomationToken` escopo `capture` (fora da UI) →
  `POST /api/capture` externo com Bearer → **201 `{id}`** contra o servidor real →
  `goto('/brain-dump')` → o item aparece na caixa de entrada, o estado vazio some
  e o **badge da sidebar mostra "1"**.

### `frontend/e2e/seedAutomationToken.ts` (helper novo)
- [x] `issueAutomationToken(email)` — materializa um token real com escopo
  `capture` via `AutomationToken.issue(...)` (mesma técnica de `seedGratitude.ts`),
  retorna o segredo pleno para o spec disparar a captura externa por HTTP.

### `backend/automation/tests/test_views.py` (+1 pytest — gap de caminho)
- [x] **`test_log_tambem_registra_o_400_de_tipo_desconhecido` (AC3)** — o 400 do
  braço `except UnknownCaptureType` também alcança o handler e **deve logar**;
  caminho **distinto** do 400 de validação (que sai antes, no `is_valid()`) e que
  não estava assertado em lugar nenhum. Sem ele, uma regressão que esquecesse o
  `self._audit(...)` só nesse braço passaria em todos os outros testes.

---

## Mapa de cobertura

| Superfície / AC | pytest (gate) | E2E (browser) |
|---|---|---|
| AC1 — cria via service + 400 (tipo desconhecido, `text` vazio) | coberto (41) | 201 confirmado no fluxo AC2 |
| AC2 — item aparece na **API** do Brain Dump do dono + count | coberto | — |
| **AC2 — item aparece na UI real do Brain Dump (canal externo → tela)** | **N/A (API só)** | **coberto (+1 novo)** |
| AC2 — isolamento entre tenants | coberto | intencionalmente N/A (pytest já cobre) |
| AC3 — 401 / 403 / 429 / log sem token pleno (201 + **ambos os 400s**) | coberto (+1 novo) | — |
| AC4 — dispatcher `match` extensível, `type` aberto | coberto | — |

---

## Resultado

```
# E2E novo (Playwright, browser real vs. backend Neon e2e)
cd frontend && npx playwright test external-capture.spec.ts --project=chromium
1 passed (22.3s)   # POST /api/capture 201 → /brain-dump: count 1 + item na lista

# Gate pytest do app (Postgres LOCAL) — baseline 40 + 1 novo
cd backend && uv run pytest automation/ -q
41 passed in 11.73s
```

- **E2E:** 1 passed ✅ (log do servidor confirma: `POST /api/capture 201` →
  `GET /api/brain-dump/count/ 200 (=1)` → `GET /api/brain-dump/items/ 200`).
- **pytest `automation/`:** 40 → **41 passed** ✅ (+1 gap de caminho: log do 400
  de tipo desconhecido).
- `eslint` nos arquivos novos: limpo ✅ · `tsc -b --noEmit` (typecheck): verde ✅.
- `ruff check` + `ruff format --check` em `test_views.py`: limpos ✅.
- **Sem mudança em código de produção** — apenas 3 arquivos de teste/helper.
- Migration `automation.0001_initial` **já aplicada** à branch Neon `e2e`
  (confirmado: `[X] 0001_initial`) — pré-requisito do E2E satisfeito.

---

## Validação contra o checklist

- Testes de API gerados — **pytest pré-existente é o gate** (40; API HTTP coberta) ✅
- Testes E2E gerados (UI existe: Brain Dump legado) — **+1**, focado no AC2 ✅
- Testes usam APIs padrão do framework (Playwright `test`/`expect`/`request`) ✅
- Cobrem happy path (201 externo → item na UI) ✅
- Cobrem casos de erro críticos (400/401/403/429 no pytest) ✅
- Todos os testes rodam com sucesso — **E2E 1/1 · pytest 41/41** ✅
- Locators semânticos e acessíveis (`getByRole`/`getByText`) ✅
- Descrições claras (nome do teste em pt-BR + comentários de racional) ✅
- Sem waits/sleeps fixos (auto-wait do `expect` + navegação determinística) ✅
- Testes independentes (usuário novo por teste via fixture de signup; token único) ✅

---

## Próximos passos

- Rodar o E2E na suíte completa de CI/e2e junto das demais specs (workers=1, já é
  o default do projeto para a branch Neon `e2e`).
- Story 12.6 (`GET /api/summary/today`) reusa a mesma espinha de auth e o mesmo
  `automation/urls.py`; um E2E análogo só se agregar sinal de UI (a definir na 12.6).
