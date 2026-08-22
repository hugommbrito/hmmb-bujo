# Test Automation Summary — Story 12.6 (Resumo do dia `GET /api/summary/today`)

**Data:** 2026-07-23 · **QA:** HugoMMBrito · **Executor:** workflow `bmad-qa-generate-e2e-tests`
**Frameworks:** pytest (Postgres LOCAL, gate cross-app). **Sem Playwright** (justificado abaixo).

> Nota de arquivo: o `default_output_file` do skill é `test-summary.md`, já
> ocupado pelo resumo da Story 12.4 (e `test-summary-12-5.md` pela 12.5). Para
> não destruir aqueles registros, este resumo é gravado como
> `test-summary-12-6.md` (por-story) no mesmo diretório.

---

## Decisão de estratégia: pytest é o gate — **sem E2E de browser** (Tier 0, sem UI)

A Story 12.6 entrega `GET /api/summary/today` — o **segundo e último endpoint HTTP**
da Plataforma de Automação (C5), **autenticado por `AutomationToken` (Bearer)**,
consumido por **automação externa** (um widget **Scriptable** do iOS que guarda o
token no Keychain e faz refresh a cada 15–60 min). **Nenhuma superfície de browser**
renderiza este endpoint: o FR-3.5 diz explicitamente que a consulta externa vai
**direto na API**, o PWA **não é canal**. É um endpoint **Tier 0 sem UI**.

Seguindo o julgamento do próprio workflow ("Generate E2E Tests **if UI exists**") e
a instrução explícita do usuário:

### Por que **não** há Playwright aqui (contraste consciente com a 12.5)

A 12.5 (`POST /api/capture`) **adicionou 1 E2E** porque tinha uma travessia
genuína com **efeito visível numa UI existente**: um POST externo → o item aparece
na tela **legada** do Brain Dump do mesmo usuário. Havia uma superfície de browser
real onde o resultado da automação se manifestava.

A 12.6 **não tem essa travessia**. A saída do endpoint (`pendingTasks`, `habits`,
`lastJournalEntry`) é consumida por um **widget iOS fora do browser** — não existe
tela do PWA que renderize essa resposta. Um Playwright que "navegasse até o resumo"
estaria **inventando uma superfície que a story não entrega**: seria um teste
**frágil e sem sinal real** (asseveraria sobre uma UI fabricada, não sobre o
contrato que o widget de fato consome). O sinal real e não-frágil desse endpoint é
**HTTP/contrato**, e é exatamente o que o **pytest via Bearer token real** exercita.

**Portanto o gate desta story é o pytest** — o único nível onde o comportamento
observável (auth, escopo, throttle, shape agregado, isolamento por tenant,
read-only, auditoria) realmente vive.

---

## Cobertura pré-existente (o gate, 19 testes) — forte e mantida

| Nível | Arquivo | Testes | O que cobre |
|---|---|---|---|
| Endpoint | `automation/tests/test_views.py` | 11 | 200 + shape camelCase; raízes `pending`/`started` (exclui `completed`/subtarefa); isolamento por dono; **zero-seed** de hábitos (conta antes/depois); `lastJournalEntry` null→preenchido (≠ `lastGratitude`); 401 (sem/inválido/revogado); 403 (escopo errado); 429 (throttle determinístico via patch de `THROTTLE_RATES` + `cache.clear`); log estruturado sem token pleno |
| Service (composição) | `automation/tests/test_services.py` | 4 | `build_today_summary`: raízes pend./started + `date==hoje`; bloco `habits` com `total`/`groups`; `last_journal_entry` = gratidão mais recente; `None` sem gratidão |
| Service (domínio) | `gratitude/tests/test_services.py` | 4 | `get_latest_gratitude_entry`: mais recente por `date`; desempate por `created_at`; `None` vazio; **auto-escopado** (a última do outro tenant nunca vaza) |

Token sempre via **Bearer real** (`AutomationToken.issue(..., scopes=[SCOPE_SUMMARY])`),
nunca `force_authenticate` (que pularia a auth class → tenant context não setado →
leituras escopadas estourariam `TenantScopeViolation`).

---

## Gap genuíno encontrado — e o teste que o fecha (+1 pytest)

Auditando os **5 serializers de resposta** da 12.6, exatamente **um** nunca era
exercitado com dados:

| Serializer de resposta | Exercitado com dados? |
|---|---|
| `SummaryResponseSerializer` (corpo inteiro) | ✅ |
| `SummaryTaskSerializer` `{id,title,status}` | ✅ (teste das raízes pend./started) |
| `SummaryJournalEntrySerializer` `{text,date}` | ✅ (teste `lastJournalEntry` preenchido) |
| `SummaryHabitsSerializer` `{total,groups}` | só as chaves — **`groups` sempre `[]`** |
| **`SummaryHabitsGroupSerializer` `{id,name,completion}`** | ❌ **nunca — todo teste de `habits` usava dia NÃO semeado** |

**O gap:** todos os testes que tocavam `habits` (endpoint e service) usavam um dia
**não semeado** → `total=0, groups=[]`. O serializer aninhado de grupo — declarado
justamente para o `groups: [{id, name, completion}]` do **AC1** — **nunca renderizava
um grupo real**. Uma regressão que renomeasse `completion`→`percent` (ou quebrasse a
serialização de `groups`) **passaria na suíte inteira**. Análogo ao gap de
caminho-distinto que a 12.5 fechou (o log do 400 de tipo desconhecido).

### `automation/tests/test_views.py` (+1 pytest — gap de shape)

- [x] **`test_summary_habits_bloco_reflete_grupos_reais_com_shape_id_name_completion` (AC1)**
  Um hábito **booleano concluído hoje** (`HabitDayEntryFactory(..., value=1)`,
  grupo "Manhã") materializa uma linha de `habit_day_entries` **no setup** (não pela
  view — a view é read-only). O GET então retorna `habits.total == 100` e
  `habits.groups == [{id, name: "Manhã", completion: 100}]` — a **primeira** vez que
  o `SummaryHabitsGroupSerializer` renderiza um grupo real na borda. Fecha o único
  caminho de serialização que estava só declarado, nunca exercitado.

### O que **não** foi adicionado (evitar redundância/fragilidade)

- **Qualquer Playwright/E2E de browser** — não há superfície de UI (justificado acima).
- **Matemática de `compute_day_completeness`** — já é serviço de domínio com suíte
  própria em `habits/tests/test_services.py`; o gap aqui era o **render do serializer
  do `automation`**, não o cálculo. Não re-testei a matemática.
- **`lastJournalEntry` "mais recente" no endpoint** — já coberto no service
  (`build_today_summary` + `get_latest_gratitude_entry`); a view só repassa o valor.
- **Isolamento de `habits`/`lastJournalEntry` por tenant no endpoint** — o mesmo
  mecanismo (token→tenant context) que o teste de isolamento de `pendingTasks` já
  exercita governa os três blocos; e cada bloco tem teste de auto-escopo no seu
  service de domínio.
- **`405` para métodos não-GET** — comportamento default do `APIView` do DRF (testar
  o framework); a 12.5 igualmente não testou "GET /api/capture → 405". Descartado por
  consistência.

---

## Mapa de cobertura por AC

| AC | pytest (gate) | E2E |
|---|---|---|
| AC1 — agregado raso derivado de services; raízes pend./started; isolamento; read-only (zero-seed) | coberto | N/A (sem UI) |
| **AC1 — bloco `habits` com grupos reais `{id,name,completion}` + total** | **coberto (+1 novo)** | N/A |
| AC2 — campo genérico `lastJournalEntry` (null→preenchido, ≠ `lastGratitude`); fonte = última gratidão | coberto | N/A |
| AC3 — throttle `automation-summary` (429); auditoria estruturada sem token pleno; 401/403 | coberto | N/A |
| AC4 — `automation` como app de composição (imports permitidos, porta do `core` intacta) | coberto por `lint-imports` (fora deste run; verde no dev-story) | N/A |

---

## Resultado

```
# O novo teste isolado
cd backend && uv run pytest \
  "automation/tests/test_views.py::test_summary_habits_bloco_reflete_grupos_reais_com_shape_id_name_completion" -q
1 passed in 1.09s

# Módulos do escopo (gate pytest, Postgres LOCAL via docker-compose)
cd backend && uv run pytest automation/ gratitude/ -q
101 passed in 27.92s
```

- **Novo teste:** 1 passed ✅ (`habits.total == 100`, `groups[0] == {id, name:"Manhã", completion:100}`).
- **`automation/` + `gratitude/`:** **101 passed** ✅ (nenhuma regressão; inclui os 19 testes da 12.6 → agora **20**).
- `ruff check` + `ruff format --check` em `automation/tests/test_views.py`: **limpos** ✅.
- **Sem mudança em código de produção** — apenas 1 arquivo de teste tocado
  (`automation/tests/test_views.py`: import de `Decimal` + factories de hábito, +1 teste).
- **Sem migration** → **sem** passo Neon e2e; **sem** E2E novo (backend-only, sem UI).

---

## Validação contra o checklist (`checklist.md`)

- [x] Testes de API gerados — **pytest é o gate** (endpoint via Bearer real; +1 novo de shape)
- [x] Testes E2E gerados **se UI existe** — **N/A por design** (Tier 0, sem superfície de browser; justificado)
- [x] Testes usam APIs padrão do framework (pytest + `APIClient` do DRF + factories)
- [x] Cobrem happy path (200 agregado com grupos reais)
- [x] Cobrem casos de erro críticos (401/403/429 pré-existentes)
- [x] Todos os testes rodam com sucesso — **novo 1/1 · escopo 101/101**
- [x] Locators — N/A (sem UI); asserções sobre `resp.json()` (corpo camelCase renderizado)
- [x] Descrições claras (nome em pt-BR + comentário de racional do gap)
- [x] Sem waits/sleeps fixos
- [x] Testes independentes (usuário/token por teste; `cache.clear()` cerca o teste de throttle)

---

## Próximos passos

- O novo teste roda no gate full-suite de CI junto do resto (`uv run pytest` sem escopo — guardrail Retro Épico 11).
- **Épico 14 (contract-first):** os testes de caracterização lá é que verificam a
  compatibilidade pós-reescrita do read-model (AC2 desta story deixou isso explícito
  como **não-AC-testável** aqui — navalha de Occam 2026-07-23). Nada a antecipar no QA da 12.6.
- **Épico 16.11:** quando o Journalling assumir a fonte do campo genérico
  `lastJournalEntry` (hoje = última gratidão), o ponto de troca é `get_latest_gratitude_entry`
  → o service do journalling, **sem** tocar o contrato; os testes de `lastJournalEntry`
  desta story continuam válidos como contrato de borda (nome/nulabilidade/shape).
