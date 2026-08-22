---
baseline_commit: 931ccc591fd8c8dea95657e0d7296c8cf3566f6f
---

# Story 12.6: Resumo do dia — `GET /api/summary/today`

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero um resumo agregado do meu dia numa única requisição autenticada por token,
Para que o widget Scriptable mostre o dia (tarefas pendentes, hábitos, última reflexão) sem abrir o app (FR-3.3, FR-3.4, AR-25, AD-19).

## Acceptance Criteria

**AC1 — `GET /api/summary/today` responde JSON raso agregado, derivado de services de domínio**

**Dado que** um token com escopo `summary` (`AutomationToken` da Story 12.4),
**Quando** `GET /api/summary/today` é chamado,
**Então** responde **`200`** com um JSON **raso** contendo três blocos:
  1. **tarefas pendentes do dia** — tarefas **raiz** (`parent_task IS NULL`) do Daily Log de **hoje** (`core.calendar.today_for(user)`) com status ∈ {`pending`, `started`}, cada uma como `{id, title, status}` (`pendingTasks` na borda camelCase, §6.3);
  2. **hábitos do dia** — a completude ponderada de hoje via o service **read-only** `habits.services.compute_day_completeness(user=user, date=hoje)` → `{total, groups: [{id, name, completion}]}`;
  3. **última entrada de journalling** — em um **campo de nome genérico** (`lastJournalEntry`) que **não quebra quando a fonte trocar**; enquanto o Journalling não existir (Épico 16), a fonte é a **última gratidão** (AD-19) → `{text, date}` ou **`null`** quando não há nenhuma entrada,
**E** toda contagem/estrutura **deriva de services de domínio** (`today_for`, `get_or_create_daily_log`, `compute_day_completeness`, `get_latest_gratitude_entry`) — **nunca** de queries ad-hoc cross-tenant (`Task.objects…`, `HabitDayEntry.objects…`) montadas dentro do `automation`,
**E** o item pertence **exclusivamente** ao dono do token (isolamento AD-12 setado pela `AutomationTokenAuthentication`) — os três blocos **nunca** trazem dados de outro tenant.

**AC2 — Campo genérico da última entrada + contrato OpenAPI contract-first (compatível com os spines do Épico 14)**

**Dado que** os ciclos de vida M06–M10 chegam no Épico 14 (contract-first — revisão 2026-07-22),
**Quando** o shape da resposta é definido,
**Então** o campo da última reflexão tem **nome genérico** (`lastJournalEntry`, **não** `lastGratitude`) para que a troca da fonte gratidão→journalling no Épico 16 (Story 16.11) seja **sem breaking change**,
**E** as estruturas **não assumem semântica legada** que os spines do Épico 14 mudam (o `pendingTasks` deriva do Daily Log de hoje, não de um read-model que o Épico 14 reescreve),
**E** o contrato é **declarado no OpenAPI** (`drf-spectacular` via `@extend_schema` + serializers de resposta tipados). *(A compatibilidade pós-Épico 14 é verificada lá, pelos testes de caracterização — **não** é AC testável desta story; navalha de Occam 2026-07-23.)*

**AC3 — Rate limiting + auditoria nascem junto do endpoint (FR-3.4), escopo `automation-summary`**

**Dado que** rate limiting e auditoria nascem juntos com o endpoint (FR-3.4),
**Quando** o endpoint é chamado,
**Então** `ScopedRateThrottle` com escopo **`automation-summary`** aplica o limite, com a taxa **configurável em settings** (`DEFAULT_THROTTLE_RATES["automation-summary"]`, override por env `AUTOMATION_SUMMARY_THROTTLE`),
**E** exceder o limite retorna **`429`**,
**E** cada chamada que alcança o handler gera **log estruturado** `{token_prefix, endpoint, status}` (`endpoint = "/api/summary/today"`) — o **token pleno nunca aparece em log** (só o `token_prefix`).

**AC4 — `automation` como app de composição: importa services de domínio, porta do `core` intacta**

**Dado que** `automation` é app de composição (AD-19 item 4),
**Quando** o summary importa services de `bujo`/`habits`/`gratitude`,
**Então** os imports são **permitidos** (o `import-linter` só proíbe `core` → apps de domínio; `automation` não é `core`),
**E** a regra de porta do `core` (§7.2) permanece **intacta** (`uv run lint-imports` verde no CI),
**E** a captura de Pressão Arterial **não** entra aqui (endpoint próprio — AD-27); este endpoint é somente leitura de resumo.

## Tasks / Subtasks

- [x] **Task 1 — Service de domínio read-only: última gratidão** (AC: #1, #2, #4)
  - [x] Adicionar `get_latest_gratitude_entry(*, user)` a `backend/gratitude/services.py`: retorna a `GratitudeEntry` **mais recente** (`GratitudeEntry.objects.order_by("-date", "-created_at").first()`) ou **`None`** quando não há nenhuma. Leitura pura (sem `@transaction.atomic`, como `get_gratitude_day`); auto-escopado por tenant (`GratitudeEntry.objects` — **nunca** `all_objects`, **nunca** `user_id` cru).
  - [x] Docstring: registrar que é a **fonte temporária** do campo genérico `lastJournalEntry` do summary; quando o Journalling existir (Épico 16.11) o summary troca a fonte **sem** mudar o contrato. Observar que o `Meta.ordering=["created_at"]` (ascendente) é **sobrescrito** aqui por `order_by("-date", "-created_at")` de propósito (queremos a última, não a primeira).
  - [x] **Por que um service novo e não query ad-hoc:** AC2 exige "estruturas derivam de services de domínio". `automation` (composição) **pode** importar `gratitude.services`, mas montar `GratitudeEntry.objects…` dentro do `automation` seria a query ad-hoc que a AC proíbe. O ponto de leitura correto é o próprio app de domínio. Ver Dev Notes › "Última entrada: service de domínio, não query no `automation`".

- [x] **Task 2 — Composition service `build_today_summary` (HTTP-agnóstico)** (AC: #1, #2, #4)
  - [x] Adicionar `build_today_summary(*, user) -> dict` a `backend/automation/services.py` (mesmo módulo do `dispatch_capture`):
    - `today = today_for(user)` (`from core.calendar import today_for`).
    - **Tarefas pendentes:** `log = get_or_create_daily_log(user=user, log_date=today)` (`from bujo.services.logs import get_or_create_daily_log` — service EXISTENTE, idempotente; **é o mesmo caminho que `DailyLogView.get` usa** — criar o log de hoje num GET é o padrão já estabelecido do projeto, não um efeito colateral novo); depois `pending = log.tasks.filter(parent_task__isnull=True, status__in=[Task.Status.PENDING, Task.Status.STARTED])` (`from bujo.models import Task`). O reverse manager `log.tasks` já é duplamente escopado (pelo `log` do dono + tenant manager).
    - **Hábitos:** `habits = compute_day_completeness(user=user, date=today)` (`from habits.services import compute_day_completeness` — **read-only**; ver o guardrail abaixo).
    - **Última reflexão:** `last = get_latest_gratitude_entry(user=user)` (Task 1).
    - Retornar `{"date": today, "pending_tasks": list(pending), "habits": habits, "last_journal_entry": last}` — **dados brutos** (instâncias/dicts de domínio); a serialização (incl. `null` para `last is None`) fica na borda (Task 3).
  - [x] **NÃO escrever nada de hábitos:** usar **`compute_day_completeness`** (só lê `habit_day_entries` existentes) — **nunca** `seed_habit_day` (que **escreve**). Um GET de widget que roda a cada 15–60 min não pode materializar entradas de hábito. Se o dia ainda não foi semeado, `total=0`/`groups=[]` é a resposta honesta. Ver Dev Notes › "GET é leitura: proibido `seed_habit_day`".
  - [x] `automation` **pode** importar `bujo.services`/`bujo.models`/`habits.services`/`gratitude.services` — é **app de composição** (AD-19 item 4). Confirmar que nenhuma nova violação de `import-linter` surge (AC4).

- [x] **Task 3 — Serializers de resposta do summary** (AC: #1, #2)
  - [x] Em `backend/automation/serializers.py`, adicionar os serializers de resposta (só `to_representation`, todos `read_only`):
    - `SummaryTaskSerializer(serializers.Serializer)`: `id = UUIDField(read_only=True)`, `title = CharField(read_only=True)`, `status = CharField(read_only=True)`.
    - `SummaryHabitsGroupSerializer(serializers.Serializer)`: `id = UUIDField(read_only=True)`, `name = CharField(read_only=True)`, `completion = IntegerField(read_only=True)` — casando o shape de `_grouped_completeness` (`{id, name, completion}`). `HabitGroup` herda `id` **UUID** de `TenantModel` (`core/models.py:22`); `completion` é `int` (percentual).
    - `SummaryHabitsSerializer(serializers.Serializer)`: `total = IntegerField(read_only=True)`, `groups = SummaryHabitsGroupSerializer(many=True, read_only=True)`.
    - `SummaryJournalEntrySerializer(serializers.Serializer)`: `text = CharField(read_only=True)`, `date = DateField(read_only=True)`.
    - `SummaryResponseSerializer(serializers.Serializer)`: `date = DateField(read_only=True)`, `pending_tasks = SummaryTaskSerializer(many=True, read_only=True)`, `habits = SummaryHabitsSerializer(read_only=True)`, `last_journal_entry = SummaryJournalEntrySerializer(read_only=True, allow_null=True)`.
  - [x] **CamelCase na borda (§6.3) ENTRA EM JOGO aqui** (diferente da 12.5, cujos campos eram palavras únicas): `pending_tasks`→`pendingTasks`, `last_journal_entry`→`lastJournalEntry`. O `CamelCaseJSONRenderer` cameliza **recursivamente** todas as chaves da resposta, inclusive as internas de `groups`. Documentar em comentário que os nomes `snake_case` do serializer viram `camelCase` no JSON e no `schema.yaml`/`types.gen.ts`.

- [x] **Task 4 — View `SummaryView` (auth por token + escopo `summary` + throttle + log)** (AC: #1, #3)
  - [x] Em `backend/automation/views.py`, adicionar `SummaryView(APIView)`:
    - `authentication_classes = [AutomationTokenAuthentication]` (opt-in per-view — a classe **não** está no `DEFAULT_AUTHENTICATION_CLASSES`).
    - `permission_classes = [HasAutomationScope]`; `required_scopes = [SCOPE_SUMMARY]` (usar `SCOPE_SUMMARY` de `automation.models`). **Não** adicionar `IsAuthenticated` — redundante (mesmo racional 401/403 da `CaptureView`; ver Dev Notes › "401 vs 403 sem `IsAuthenticated`").
    - `throttle_classes = [ScopedRateThrottle]`; `throttle_scope = "automation-summary"`.
    - `get(self, request)`: `data = build_today_summary(user=request.user)`; logar o desfecho (`self._audit(request, status.HTTP_200_OK)` — Task 5); retornar `Response(SummaryResponseSerializer(data).data)` (200 default). **Sem** payload de entrada → não há caminho 400 de validação; só 200 (+ 401/403/429 antes/fora do handler). Documentar OpenAPI com `@extend_schema(responses={200: SummaryResponseSerializer})`.

- [x] **Task 5 — Log estruturado de auditoria (`SummaryView._audit`)** (AC: #3)
  - [x] Dar à `SummaryView` seu **próprio** `_audit(self, request, status_code)` que emite `logger.info("automation summary", extra={"token_prefix": request.auth.token_prefix, "endpoint": "/api/summary/today", "status": status_code})`, reusando o `logger = logging.getLogger(__name__)` já no topo de `automation/views.py` (logger `automation.views`).
  - [x] **Mensagem distinta ("automation summary") de propósito:** o teste de `caplog` da 12.5 filtra por `getMessage() == "automation capture"` e afirma `len == 1` — uma mensagem distinta garante **zero colisão** com os testes da 12.5 (mesmo logger, mensagens diferentes). Ver Dev Notes › "Por que `_audit` próprio e não helper compartilhado".
  - [x] **Token pleno NUNCA logado** (só `token_prefix`) — na view sequer há acesso ao pleno (`request.auth` é o `AutomationToken`, que só guarda `token_prefix`/`token_hash`). Confirmar em teste que o pleno não aparece em `caplog`.

- [x] **Task 6 — Configuração de throttle em settings** (AC: #3)
  - [x] Em `backend/config/settings/base.py`, dentro de `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]`, adicionar `"automation-summary": env("AUTOMATION_SUMMARY_THROTTLE", default="60/min")` **ao lado** do `automation-capture` já existente. **Não** adicionar `DEFAULT_THROTTLE_CLASSES` global. Atualizar o comentário do bloco para citar os dois escopos.
  - [x] Registrar `AUTOMATION_SUMMARY_THROTTLE=60/min` em `backend/.env.example` (ao lado do `AUTOMATION_CAPTURE_THROTTLE` da 12.5).

- [x] **Task 7 — Wiring de URL: `GET /api/summary/today`** (AC: #1)
  - [x] Em `backend/automation/urls.py`, adicionar `path("summary/today", SummaryView.as_view(), name="automation-summary")` (**sem barra final** — literal da AD-19, consistente com `capture`; ver Dev Notes › "Rota externa sem barra final"). O `include("automation.urls")` sob `path("api/", …)` **já existe** (Story 12.5) e o comentário no `config/urls.py` já antecipa `/api/summary/today` — **não** mexer no `config/urls.py`.

- [x] **Task 8 — Testes** (AC: #1, #2, #3, #4)
  - [x] `backend/automation/tests/test_services.py` (unit, sem HTTP; dentro de `tenant_context(user)`): `build_today_summary(user=user)` com um Daily Log de hoje contendo uma tarefa `pending`, uma `started`, uma `completed` e uma subtarefa → `pending_tasks` traz **só** as duas raízes pendentes/started (sem a `completed`, sem a subtarefa); `habits` tem as chaves `total`/`groups`; com uma gratidão criada, `last_journal_entry` é a **mais recente**; sem gratidão, é `None`.
  - [x] `backend/gratitude/tests/test_services.py` (unit, arquivo existente): `get_latest_gratitude_entry(user=user)` retorna a entrada de maior (`date`, `created_at`); `None` quando vazio; **auto-escopado** (a última do `other_user` nunca vaza — cobrir dentro do respectivo `tenant_context`).
  - [x] `backend/automation/tests/test_views.py` (endpoint via **Bearer token real** — `AutomationToken.issue(user=user, name="t", scopes=[SCOPE_SUMMARY])` → header `Authorization: Bearer <full>`; **não** usar `force_authenticate`, que pularia a auth class e não setaria o tenant context — ver Dev Notes › "Testar com token real"):
    - (AC1) `GET /api/summary/today` → **200**; corpo tem `date`, `pendingTasks` (camelCase!), `habits.total`, `habits.groups`, `lastJournalEntry`.
    - (AC1) com tarefas pendentes/started no Daily Log de hoje → aparecem em `pendingTasks` com `{id, title, status}`; tarefa `completed` e subtarefas **não** aparecem.
    - (AC1/isolamento) os dados são **só** do dono — um `other_user` com tarefas/hábitos/gratidão próprios recebe **o seu** resumo, nunca o do primeiro (dois tokens distintos).
    - (AC1/read-only) o GET **não** semeia hábitos: nenhum `HabitDayEntry` novo é criado por chamar o endpoint (contar antes/depois).
    - (AC2) `lastJournalEntry` é `null` quando não há gratidão; é `{text, date}` da **última** gratidão quando há; a chave é `lastJournalEntry` (não `lastGratitude`).
    - (AC3/auth) sem header `Authorization` → **401**; token inválido → **401**; token **revogado** → **401** (`revoked_at` setado).
    - (AC3/escopo) token só com escopo `capture` (sem `summary`) → **403**.
    - (AC3/throttle) exceder a taxa → **429** — patchar `ScopedRateThrottle.THROTTLE_RATES` direto + `cache.clear()` (ver Dev Notes › "Testar o `ScopedRateThrottle` de forma determinística"; `override_settings` **não** rebinda a taxa — lição empírica da 12.5).
    - (AC3/log) `caplog` (logger `automation.views`, mensagem `"automation summary"`) captura `{token_prefix, endpoint: "/api/summary/today", status: 200}`, e o token **pleno não** aparece em nenhum record.
  - [x] A factory/token de escopo `summary` já é materializável com `AutomationToken.issue(..., scopes=[SCOPE_SUMMARY])` (a `AutomationTokenFactory` default usa `[SCOPE_CAPTURE]`; para escopo `summary`, use `issue` com o escopo explícito, como a 12.5 fez para o teste de 403).

- [x] **Task 9 — Contrato OpenAPI + suíte verde** (AC: #1–#4)
  - [x] **Regenerar o contrato** (há endpoint novo): `cd backend && uv run python manage.py spectacular --file ../schema.yaml`; depois `cd frontend && nvm use 22.15.1 && npm run generate-types` (gera `src/api/types.gen.ts`). **Commitar ambos** — o CI falha se `types.gen.ts` divergir de `schema.yaml` (ver Dev Notes › "CI diffa `types.gen.ts`"). Requer Node ≥20.12 no frontend.
  - [x] Conferir que o diff de `schema.yaml` inclui **o endpoint `/api/summary/today`** + os schemas de resposta (`SummaryResponse`/`SummaryTask`/`SummaryHabits…`/`SummaryJournalEntry`) com as chaves em **camelCase** (`pendingTasks`, `lastJournalEntry`). Nada além do esperado (o `waitingOn` da 12.2 e o `/api/capture` da 12.5 **já** estão no schema commitado — não devem reaparecer no diff).
  - [x] `cd backend && uv run pytest` → **suíte inteira verde** (Postgres LOCAL via docker-compose; gate cross-app do projeto — rodar **sem** escopo de caminho, guardrail da Retro Épico 11).
  - [x] `uv run ruff check .` + `uv run ruff format --check .` (arquivos tocados limpos) e `uv run lint-imports` → **verde** (AC4: `automation → bujo/habits/gratitude` permitido; porta do `core` intacta).
  - [x] **Sem migration nova** (nenhum campo de modelo muda) → **sem** aplicar migration à branch Neon e2e; **sem** E2E novo (backend-only, sem UI).

## Dev Notes

### Contexto e fronteira da fatia (AD-19 / FR-3.3 / FR-3.4)

- Esta é a **última story do Épico 12** e o **segundo (e último) endpoint HTTP** da Plataforma de Automação (C5) — par do `POST /api/capture` (Story 12.5). Toda a espinha já existe e é só **consumida** aqui: auth por token (`AutomationTokenAuthentication`), escopo (`HasAutomationScope` + `SCOPE_SUMMARY`), throttle per-view, log estruturado, wiring `include("automation.urls")` sob `api/`. **Não reimplementar** nada disso. [Source: architecture.md#AD-19 (L871-904); epics.md#Story-12.6 (L2046-2069); 12-5-captura-externa-post-api-capture.md]
- **Sem UI** (Tier 0). O consumidor é um **widget Scriptable** do lado do usuário (Keychain guarda o token; refresh 15–60 min — orçamento WidgetKit). Nenhuma superfície nova; nenhuma mudança de frontend **além** do `types.gen.ts` regenerado pelo endpoint novo. [Source: epics.md L2050; architecture.md#AD-19 casos-âncora L903]
- **PWA não é canal** (FR-3.5): a consulta externa vai **direto na API**. Nada de PWA aqui. [Source: architecture.md#AD-19 item 6]

### Forma exata do endpoint (o dev NÃO deve reinventar)

```
GET /api/summary/today
Authorization: Bearer bujo_<...>          # AutomationToken pleno com escopo `summary` (Story 12.4)

→ 200 (camelCase na borda — §6.3)
{
  "date": "2026-07-23",
  "pendingTasks": [
    { "id": "<uuid>", "title": "comprar café", "status": "pending" },
    { "id": "<uuid>", "title": "revisar PR",   "status": "started" }
  ],
  "habits": { "total": 40, "groups": [ { "id": "<uuid>", "name": "Manhã", "completion": 66 } ] },
  "lastJournalEntry": { "text": "grato pelo sol", "date": "2026-07-22" }   // ou null
}

sem/inválido/revogado         → 401 (Bearer)
token sem escopo `summary`    → 403
excedeu a taxa                → 429
```

### Services de domínio a reusar — NÃO montar queries ad-hoc (anti-reinvenção, AC2)

O `build_today_summary` é **composição pura** — cada bloco vem de um service de domínio EXISTENTE (ou, no caso da gratidão, um service novo **no app de domínio**, Task 1):

| Bloco | Fonte (service de domínio) | Observação |
|-------|----------------------------|------------|
| data de hoje | `core.calendar.today_for(user)` | mesma autoridade temporal de todo o `bujo` [Source: core/calendar.py:14] |
| Daily Log de hoje | `bujo.services.logs.get_or_create_daily_log(user=, log_date=)` | idempotente; **é o mesmo caminho de `DailyLogView.get`** [Source: bujo/services/logs.py:9; bujo/views.py:76] |
| tarefas pendentes | `log.tasks.filter(parent_task__isnull=True, status__in=[PENDING, STARTED])` | raízes pendentes/started; espelha o `get_tasks` do `LogSerializer` (`obj.tasks.filter(parent_task__isnull=True)`) [Source: bujo/serializers.py:63-64; bujo/models.py:75-76,100-101] |
| hábitos do dia | `habits.services.compute_day_completeness(user=, date=)` | **read-only**; `{total, groups:[{id,name,completion}]}` [Source: habits/services.py:351-366,323-350] |
| última reflexão | `gratitude.services.get_latest_gratitude_entry(user=)` (Task 1) | `GratitudeEntry` ou `None` [Source: gratitude/services.py; gratitude/models.py:22-38] |

**Não** montar `Task.objects.filter(...)` nem `HabitDayEntry.objects.filter(...)` dentro do `automation` — isso é a query ad-hoc que a AC2 proíbe. O ponto de leitura correto é sempre o app de domínio (via seu service ou seu reverse manager escopado). [Source: epics.md#Story-12.6 AC2 (L2058-2061)]

### "Tarefas pendentes" = `pending` + `started` (decisão explícita para a revisão)

O AC diz "tarefas **pendentes** do dia". Interpretação adotada: status ∈ {`pending`, `started`} — ambos são **não-terminais e acionáveis** (o widget mostra "o que ainda falta hoje", e uma tarefa `/` iniciada é justamente algo a terminar). Casa com a regra de migração (AD-02: só `pending`/`started` são migráveis) e exclui os terminais `completed`/`cancelled`/`migrated`/`postponed`. **Se a revisão quiser só `pending` estrito**, é uma linha no filtro — mas a leitura acima é a que serve o propósito do widget. Filtrar só raízes (`parent_task IS NULL`) evita despejar subtarefas soltas no resumo. [Source: bujo/models.py:75-80 (enum); bujo/serializers.py:63-64 (raízes)]

### GET é leitura: proibido `seed_habit_day` (efeito colateral)

- `habits.services` tem `seed_habit_day(*, user, date)` que **materializa** `habit_day_entries` (escreve). **NÃO chamar** no summary: um GET consumido por widget a cada 15–60 min não pode ficar semeando entradas de hábito num usuário que talvez nem abriu o app. Use **`compute_day_completeness`** (só lê as entradas já existentes). Dia não semeado → `total=0`, `groups=[]` — resposta honesta, sem escrita. [Source: habits/services.py:231 (`seed_habit_day` — NÃO usar), 351 (`compute_day_completeness` — usar)]
- A **única** materialização aceitável no caminho é o `get_or_create_daily_log` (idempotente e idêntico ao que o app faz ao abrir o Daily). Um teste conta `HabitDayEntry` antes/depois do GET para provar zero-write de hábitos (Task 8). [Source: bujo/views.py:76 (`DailyLogView.get` também usa `get_or_create_daily_log`)]

### Última entrada: service de domínio, não query no `automation` (AC2)

A AC2 pede que as estruturas "derivam de services de domínio (não de queries ad-hoc)". Não existe hoje um service "última gratidão" — os existentes são por-data (`get_gratitude_day`) e por-mês (`get_gratitude_month`). Adicione `get_latest_gratitude_entry(*, user)` **em `gratitude/services.py`** (Task 1), não um `GratitudeEntry.objects…` embutido no `automation`. Isso mantém a composição honesta **e** dá o ponto de troca único quando o Journalling (Épico 16.11) assumir a fonte do campo genérico `lastJournalEntry` — a troca vira "aponta o summary para o service do journalling", sem tocar o contrato. [Source: gratitude/services.py:29-57; epics.md L2660 (16.11 troca a fonte no campo genérico, sem breaking change)]

### Campo genérico `lastJournalEntry` — por que o nome importa

O Épico 16 aposenta a Gratidão e o Journalling passa a servir esse campo. Se o campo se chamasse `lastGratitude`, a troca seria breaking (o widget teria que mudar). Nome **journalling-neutro** (`lastJournalEntry`) hoje = troca de fonte silenciosa amanhã. É a leitura literal de "num campo de nome genérico que não quebra quando a fonte trocar" (AC1) e do plano do 16.11. [Source: epics.md#Story-12.6 AC1 (L2056), L2660 (Story 16.11)]

### CamelCase na borda ENTRA EM JOGO (diferente da 12.5)

A 12.5 tinha só campos de palavra única (`type`/`text`/`value`/`id`) → o parser/renderer CamelCase era no-op. Aqui há `pending_tasks` e `last_journal_entry` → o `CamelCaseJSONRenderer` (§6.3) **cameliza recursivamente** toda a resposta: `pendingTasks`, `lastJournalEntry`, e as chaves internas de `groups`. Escreva os serializers em `snake_case` (idioma Python) e confie na borda — mas **lembre** que o `schema.yaml`/`types.gen.ts` mostrarão camelCase, e os testes de endpoint devem asseverar as chaves **camelCase** (`resp.data["pendingTasks"]`). [Source: config/settings/base.py:150-158 (renderer/parser CamelCase); 12-5 Task 1 (contraste: campos de palavra única)]

### 401 vs 403 sem `IsAuthenticated` (fluxo DRF) — idêntico à `CaptureView`

Com `permission_classes = [HasAutomationScope]` (sem `IsAuthenticated`), os desfechos ficam corretos por construção: token inválido/revogado → `AuthenticationFailed` → **401** (a auth class define `authenticate_header` → `"Bearer"`); sem header → `authenticate()` retorna `None` → `HasAutomationScope` nega → DRF levanta `NotAuthenticated` → **401**; token válido, escopo errado → **403**; escopo `summary` presente → handler. `IsAuthenticated` seria redundante (Occam). [Source: 12-5 Dev Notes "401 vs 403"; automation/authentication.py:68-73; automation/permissions.py:33-41]

### Por que `_audit` próprio e não helper compartilhado (Occam + segurança dos testes da 12.5)

A `CaptureView` tem um `_audit` privado que loga `"automation capture"` no logger `automation.views`. Dê à `SummaryView` seu **próprio** `_audit` no **mesmo módulo** (mesmo logger `automation.views`) com mensagem **distinta** `"automation summary"`. Razões: (1) o teste de `caplog` da 12.5 filtra por `getMessage() == "automation capture"` e afirma `len == 1` — mensagem distinta = zero colisão; (2) extrair um helper compartilhado mudaria o logger/estrutura do caminho já auditado da 12.5 e arriscaria seus asserts. A duplicação de ~8 linhas é um trade-off consciente (blast radius mínimo na fatia final do épico). O invariante de segurança ("token pleno nunca logado") é idêntico e testado em ambos. [Source: automation/views.py:67-85; automation/tests/test_views.py:186-237]

### Rota externa: `/api/summary/today` sem barra final (consistência com `capture`)

A AD-19 escreve os endpoints externos **sem barra final** (`POST /api/capture`, `GET /api/summary/today`) — o resto do projeto usa barra (`items/`). O `include("automation.urls")` já está sob `path("api/", …)` (12.5) e o comentário no `config/urls.py` já antecipa este endpoint. Definir `path("summary/today", …)` (sem barra) casa o literal que o widget chama. Para GET o `APPEND_SLASH` até redirecionaria a variante com barra, mas o Scriptable chama a URL **fixa** — honrar o literal da AD-19. **Não** tocar `config/urls.py`. [Source: architecture.md#AD-19 item 3 (L881); automation/urls.py; config/urls.py:26-30]

### Throttle: `ScopedRateThrottle` per-view, escopo `automation-summary`

- Aplicar **na view** (`throttle_classes = [ScopedRateThrottle]` + `throttle_scope = "automation-summary"`). A taxa vem de `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["automation-summary"]` (env `AUTOMATION_SUMMARY_THROTTLE`, default `60/min`). **Não** setar `DEFAULT_THROTTLE_CLASSES` global. Keying por `request.user` (dono do token) — por-usuário, suficiente para o AC. [Source: config/settings/base.py:166-169 (bloco já existente do `automation-capture`); DRF throttling docs]

### Testar o `ScopedRateThrottle` de forma determinística (lição empírica da 12.5)

`override_settings(REST_FRAMEWORK=…)` **NÃO** rebinda a taxa: `SimpleRateThrottle.THROTTLE_RATES` é ligado UMA vez no import da classe e o sinal `setting_changed` só reseta o `api_settings`, não o atributo de classe. Para o teste de 429, **patche `ScopedRateThrottle.THROTTLE_RATES` diretamente** (ex.: `{"automation-summary": "1/min"}`) + `cache.clear()` antes. Sem `CACHES` configurado → `LocMemCache`; limpe o cache no início do teste de throttle para não herdar contadores. [Source: 12-5 Debug Log ("Throttle determinístico"); DRF `SimpleRateThrottle`]

### Testar com token real, não `force_authenticate`

`force_authenticate` substitui os autenticadores → a `AutomationTokenAuthentication` **nunca** roda → o tenant context **não** é setado → a leitura escopada (`log.tasks`, `compute_day_completeness`, `get_latest_gratitude_entry`) rodaria fora de contexto (fail-closed → `TenantScopeViolation`). Materialize um token real e passe o header:
```python
token, full = AutomationToken.issue(user=user, name="t", scopes=[SCOPE_SUMMARY])
client.credentials(HTTP_AUTHORIZATION=f"Bearer {full}")
resp = client.get("/api/summary/today")
```
O ciclo de request real faz a auth setar o contexto e o `TenantMiddleware` resetar no `finally`. É o único caminho que exercita o isolamento de verdade. [Source: 12-5 Dev Notes "Testar com token real"; automation/authentication.py:37-66]

### CI diffa `types.gen.ts` — regenerar e commitar (endpoint novo)

Esta story **adiciona** `/api/summary/today` → o `schema.yaml` muda → o CI regenera via `spectacular` e **falha se `frontend/src/api/types.gen.ts` divergir**. Sequência obrigatória:
```
cd backend  && uv run python manage.py spectacular --file ../schema.yaml
cd frontend && nvm use 22.15.1 && npm run generate-types   # → src/api/types.gen.ts
```
Commitar `schema.yaml` **e** `types.gen.ts`. O `waitingOn` (12.2) e o `/api/capture` (12.5) **já** estão no schema commitado — o diff desta story deve ser **só** o `/api/summary/today` + seus schemas. [Source: .github/workflows/ci.yml:68-81; frontend/package.json:12; MEMORY [[frontend-needs-node-22-via-nvm]]; 12-5 Debug Log "Contrato OpenAPI"]

### Segurança do contrato OpenAPI (caveat menor, opcional — herdado da 12.5)

Como `AutomationTokenAuthentication` **não** está em `DEFAULT_AUTHENTICATION_CLASSES`, o `spectacular` emite o warning esperado `could not resolve authenticator AutomationTokenAuthentication` e pode inferir o `securityScheme` Bearer/JWT global para este endpoint. **Não** quebra o CI (que só compara `types.gen.ts` × `schema.yaml`) nem o runtime. Um `OpenApiAuthenticationExtension` é nice-to-have (Tier 0), **não** obrigatório. Confirmar apenas que o diff do `schema.yaml` é **aditivo** (nenhum `security` removido de outro endpoint — guardrail Retro Épico 3 #4). [Source: 12-5 Dev Notes "Segurança do contrato OpenAPI"; base.py:139-141]

### Camadas e stack (versões)

Django 5.2, DRF (`APIView`, `ScopedRateThrottle`, `BaseAuthentication`), `drf-spectacular` (`@extend_schema`), `djangorestframework-camel-case` (renderer/parser na borda — §6.3, **ativo** aqui), `django-environ` (`env(...)` para a taxa), Python via `uv`. Logging via `logging` stdlib (`getLogger(__name__)`). [Source: config/settings/base.py; pyproject.toml]

### Inteligência das stories anteriores (12.1–12.5)

- **12.5** (captura, `done`): estabeleceu o **molde exato** que esta story espelha — `automation/{serializers,services,views,urls}.py`, view fina com auth+escopo+throttle+`_audit`, teste via token real, throttle determinístico (patch de `THROTTLE_RATES` + `cache.clear`), regen de contrato + commit de `types.gen.ts`. **Reusar o molde**; a diferença é: GET (não POST), sem payload/400, camelCase ativo, e composição de **3** apps de domínio (não 1). [Source: 12-5-captura-externa-post-api-capture.md]
- **12.4** (espinha de auth, `done`): entregou `AutomationToken.issue()`, `AutomationTokenAuthentication` (seta tenant context, 401 via `authenticate_header`), `HasAutomationScope`, `SCOPE_SUMMARY`. **Reusar diretamente**. Consolidou também `core.calendar.now()`/`today_for` como autoridade temporal (guardrail AST proíbe `timezone.now()`/`date.today()` cru). [Source: 12-4-token-de-automacao-com-autenticacao-dedicada.md]
- **12.2** (backend `waiting_on`): deixou a deriva `waitingOn` no schema — **já limpa pela 12.5**; não deve reaparecer no diff desta story.
- **12.1/12.2** provam o padrão de teste backend (services de domínio + `tenant_context` + asserts de nível de função).

### Padrões de teste a espelhar

- **Endpoint fino de automação:** `automation/tests/test_views.py` (12.5) — token real via `client.credentials(HTTP_AUTHORIZATION="Bearer …")`, casos 401/403/429, `caplog` do log estruturado. **Copiar a forma**, trocar `POST /api/capture` por `GET /api/summary/today`, escopo `summary`, mensagem de log `"automation summary"`. [Source: backend/automation/tests/test_views.py]
- **Composition service (unit):** `automation/tests/test_services.py` (12.5) — dentro de `tenant_context(user)`, montar fixtures de domínio e asseverar o dict retornado. [Source: backend/automation/tests/test_services.py]
- **Service de domínio read-only:** espelhar `get_gratitude_day`/`get_gratitude_month` para o novo `get_latest_gratitude_entry` (leitura pura, auto-escopada). [Source: gratitude/services.py:29-57; gratitude/tests/]

### Project Structure Notes

- **Novos arquivos:** nenhum arquivo novo de módulo (todos os alvos já existem desde a 12.5). **Novo símbolo** em cada: `get_latest_gratitude_entry` (gratitude/services.py), `build_today_summary` (automation/services.py), 5 serializers de resposta (automation/serializers.py), `SummaryView` (automation/views.py), rota (automation/urls.py). Testes: adições a `automation/tests/test_services.py`, `automation/tests/test_views.py`, e `gratitude/tests/test_services.py`.
- **Modificados:** `backend/gratitude/services.py`; `backend/automation/{services,serializers,views,urls}.py`; `backend/config/settings/base.py` (`DEFAULT_THROTTLE_RATES["automation-summary"]`); `backend/.env.example` (`AUTOMATION_SUMMARY_THROTTLE`); `schema.yaml` (endpoint novo); `frontend/src/api/types.gen.ts` (regenerado). **Não** tocar `config/urls.py` (o include já existe).
- **Sem** migration nova → **sem** passo Neon e2e, **sem** E2E novo (backend-only, sem UI).
- **Contrato de imports:** `automation` (composição) importa `bujo`/`habits`/`gratitude` (services/models) — permitido; `import-linter` só proíbe `core` → apps de domínio. Confirmar verde (AC4). [Source: backend/pyproject.toml:56-63]

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-12.6 (L2046-2069)] — AC-fonte (JSON raso, tarefas via `today_for`, hábitos, última gratidão em campo genérico, throttle `automation-summary` + log, composição sem quebrar a porta do `core`)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-12 (L1902-1908), #Story-12.5 (L2020-2044)] — contexto do épico (última story, sem UI) e o par `POST /api/capture` que esta espelha
- [Source: _bmad-output/planning-artifacts/epics.md L2660] — Story 16.11 troca a fonte do campo genérico (gratidão→journalling) sem breaking change
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-19 (L871-904)] — Plataforma de Automação: `GET /api/summary/today` (agregado; última gratidão enquanto Journalling não existe), app de composição, throttle + log `{token_prefix, endpoint, status}`, token nunca logado
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-27] — ingestão de PA tem endpoint próprio (não passa por aqui)
- [Source: _bmad-output/implementation-artifacts/12-5-captura-externa-post-api-capture.md] — molde exato (view fina, `_audit`, token real, throttle determinístico, regen de contrato)
- [Source: _bmad-output/implementation-artifacts/12-4-token-de-automacao-com-autenticacao-dedicada.md] — `AutomationToken.issue`, auth class, `HasAutomationScope`, `SCOPE_SUMMARY`
- [Source: backend/core/calendar.py:14] — `today_for(user)` (autoridade temporal)
- [Source: backend/bujo/services/logs.py:9, bujo/views.py:76, bujo/serializers.py:63-64, bujo/models.py:75-76,100-101] — `get_or_create_daily_log`, padrão de listagem de tarefas raiz do log, enum de status
- [Source: backend/habits/services.py:351-366,323-350,231] — `compute_day_completeness` (read-only, `{total, groups:[{id,name,completion}]}`) e `seed_habit_day` (NÃO usar)
- [Source: backend/gratitude/services.py:29-57, gratitude/models.py:22-38] — services de gratidão a espelhar + model (`date`, `text`, `created_at`)
- [Source: backend/automation/{views,serializers,services,urls,models,permissions,authentication}.py] — a espinha da 12.4/12.5 a consumir
- [Source: backend/config/settings/base.py:134-169, config/urls.py:26-30] — `REST_FRAMEWORK`/throttle e o include já existente sob `api/`
- [Source: .github/workflows/ci.yml:68-81, frontend/package.json:12] — CI regenera `schema.yaml` e diffa `types.gen.ts`
- [Source: backend/pyproject.toml:56-63] — contrato import-linter (porta do `core`)
- [Source: MEMORY [[frontend-needs-node-22-via-nvm]], [[ci-runs-full-pytest-suite-on-push]], [[dev-branch-homologation-workflow]], [[ask-dont-assume-functionality-flows]]]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8)

### Debug Log References

- **Suíte completa (sem escopo de caminho, guardrail Retro Épico 11):** `cd backend && uv run pytest -q` → **952 passed in 282.24s** (Postgres LOCAL via docker-compose `hmmb-test-db`). Contagem colada da execução real, não de memória.
- **Drift de contrato OpenAPI:** `uv run python manage.py spectacular --file <tmp>` e `diff` contra o `schema.yaml` commitado → **0 diff (sem drift)**. `spectacular` emite o warning esperado `could not resolve authenticator AutomationTokenAuthentication` para `CaptureView` e `SummaryView` (Tier 0, nice-to-have, não quebra CI nem runtime — Dev Notes › "Segurança do contrato OpenAPI"). Diff aditivo: só `/api/summary/today` + schemas `SummaryResponse/SummaryTask/SummaryHabits/SummaryHabitsGroup/SummaryJournalEntry`; nenhum `security` removido de outro endpoint (guardrail Retro Épico 3 #4).
- **Drift de tipos frontend:** `cd frontend && nvm use 22.15.1 && npm run generate-types` e `diff` contra o `types.gen.ts` commitado → **0 diff (sem drift)**. O gate de CI (regen `schema.yaml` × `types.gen.ts`) passa.
- **Qualidade:** `uv run ruff check .` → All checks passed. `uv run ruff format --check` nos 9 arquivos tocados → 9 já formatados (os 48 arquivos que o `--check` global sinalizaria são estado pré-existente do repo — ex.: `gratitude/views.py`, `health/`, `medications/` — fora do escopo desta story). `uv run lint-imports` → 1 kept, 0 broken (porta do `core` intacta; `automation → bujo/habits/gratitude` permitido — AC4).
- **Throttle determinístico (herdado da 12.5):** o teste de 429 patcha `ScopedRateThrottle.THROTTLE_RATES` direto + `cache.clear()` (`override_settings` NÃO rebinda a taxa ligada no import da classe).

### Completion Notes List

Story concluída como a fatia final do Épico 12 (segundo e último endpoint HTTP da Plataforma de Automação). Implementação espelha o molde exato da 12.5, consumindo a espinha já existente (auth por token, escopo, throttle per-view, log estruturado, wiring `include`).

- **AC1 — `GET /api/summary/today` agregado read-only, derivado de services de domínio:** `build_today_summary(*, user)` (`automation/services.py`) compõe 3 blocos exclusivamente via services de domínio (`today_for`, `get_or_create_daily_log` + reverse manager escopado `log.tasks`, `compute_day_completeness`, `get_latest_gratitude_entry`) — zero query ad-hoc cross-tenant no `automation`. `pending_tasks` traz só raízes (`parent_task IS NULL`) com status ∈ {`pending`, `started`}. Isolamento por token verificado com dois donos distintos (teste `test_summary_dados_sao_so_do_dono`).
- **AC2 — campo genérico + contrato contract-first:** campo `lastJournalEntry` (journalling-neutro, NÃO `lastGratitude`), fonte temporária = última gratidão via `get_latest_gratitude_entry` (novo service NO app de domínio `gratitude`, ponto de troca único para o Épico 16.11). `null` quando não há entrada. Contrato declarado no OpenAPI via `@extend_schema(responses={200: SummaryResponseSerializer})` + serializers de resposta tipados.
- **AC3 — throttle + auditoria nascem juntos:** `ScopedRateThrottle` escopo `automation-summary`, taxa em `DEFAULT_THROTTLE_RATES` (env `AUTOMATION_SUMMARY_THROTTLE`, default `60/min`); 429 ao exceder. `SummaryView._audit` próprio (mensagem distinta `"automation summary"` — zero colisão com o `caplog` da 12.5) loga `{token_prefix, endpoint: "/api/summary/today", status}`; token pleno nunca aparece em log (verificado em `caplog`).
- **AC4 — `automation` como app de composição:** imports de `bujo`/`habits`/`gratitude` permitidos; porta do `core` intacta (`lint-imports` verde). Captura de PA não entra aqui (endpoint próprio, AD-27).
- **Read-only garantido:** o GET usa `compute_day_completeness` (só lê), nunca `seed_habit_day`; teste conta `HabitDayEntry` antes/depois = 0 (nenhuma escrita de hábito). Única materialização é o `get_or_create_daily_log` idempotente (idêntico ao `DailyLogView.get`).
- **CamelCase na borda (§6.3) ativo:** serializers em `snake_case`; a borda cameliza recursivamente → `pendingTasks`/`lastJournalEntry` no corpo HTTP e no `schema.yaml`/`types.gen.ts`. Testes de endpoint asseveram sobre `resp.json()` (corpo renderizado, camelCase), não `resp.data`.
- **Testes:** todos via **Bearer token real** (`AutomationToken.issue(..., scopes=[SCOPE_SUMMARY])` + header), nunca `force_authenticate` (que pularia a auth class e não setaria o tenant context). Novos casos: 4 unit em `automation/tests/test_services.py`, 4 unit em `gratitude/tests/test_services.py`, 12 de endpoint em `automation/tests/test_views.py` (200/shape camelCase, raízes pendentes/started, isolamento, zero-seed de hábito, `lastJournalEntry` null→preenchido, 401×3, 403, 429, log estruturado sem token pleno).
- **Sem migration nova** (nenhum campo de modelo muda) → sem passo Neon e2e, sem E2E novo (backend-only, sem UI). File List reconciliada contra `git status --short` + `git diff --stat` como última etapa (guardrail Retro Épico 3/11): 12 arquivos, todos modificações de arquivos existentes — nenhum artefato de tipo novo (nenhum arquivo de teste, management command ou spec E2E criado).

### File List

- `backend/gratitude/services.py` — novo `get_latest_gratitude_entry(*, user)` (service de domínio read-only, fonte temporária de `lastJournalEntry`).
- `backend/automation/services.py` — novo composition service `build_today_summary(*, user)`.
- `backend/automation/serializers.py` — novos serializers de resposta: `SummaryTaskSerializer`, `SummaryHabitsGroupSerializer`, `SummaryHabitsSerializer`, `SummaryJournalEntrySerializer`, `SummaryResponseSerializer`.
- `backend/automation/views.py` — nova `SummaryView(APIView)` (auth por token + escopo `summary` + `ScopedRateThrottle` `automation-summary` + `_audit` próprio).
- `backend/automation/urls.py` — nova rota `path("summary/today", SummaryView.as_view(), name="automation-summary")` (sem barra final).
- `backend/config/settings/base.py` — `DEFAULT_THROTTLE_RATES["automation-summary"]` (env `AUTOMATION_SUMMARY_THROTTLE`, default `60/min`).
- `backend/.env.example` — `AUTOMATION_SUMMARY_THROTTLE=60/min`.
- `backend/automation/tests/test_services.py` — 4 testes unit de `build_today_summary`.
- `backend/automation/tests/test_views.py` — 12 testes de endpoint de `GET /api/summary/today`.
- `backend/gratitude/tests/test_services.py` — 4 testes unit de `get_latest_gratitude_entry`.
- `schema.yaml` — regenerado: endpoint `/api/summary/today` + schemas de resposta (camelCase).
- `frontend/src/api/types.gen.ts` — regenerado a partir do `schema.yaml`.

### Senior Developer Review (AI)

- **Revisor:** HugoMMBrito (adversarial code review automatizado) — 2026-07-23.
- **Desfecho:** **Aprovado (done)**. Zero achados CRITICAL/HIGH/MEDIUM. Todos os 4 ACs implementados e todas as 9 tasks `[x]` verificadas contra o código real.
- **Validação empírica (não de memória):**
  - `automation/tests/{test_services,test_views}.py` + `gratitude/tests/test_services.py` → **48 passed** (Postgres LOCAL `hmmb-test-db`).
  - `uv run lint-imports` → **1 kept, 0 broken** (porta do `core` intacta; `automation → bujo/habits/gratitude` permitido — AC4).
  - `spectacular` regenerado × `schema.yaml` commitado → **0 diff (sem drift)**; `/api/summary/today` + schemas `Summary*` presentes com chaves **camelCase** (`pendingTasks`, `lastJournalEntry`, `lastJournalEntry` nullable). `types.gen.ts` casa. Warnings esperados (`AutomationTokenAuthentication`) — Tier 0, não quebram CI/runtime.
  - `ruff check` / `ruff format --check` nos arquivos tocados → limpos.
- **Verificações-chave contra o código de domínio:** composição sem query ad-hoc cross-tenant (usa `today_for`, `get_or_create_daily_log` + reverse manager escopado `log.tasks`, `compute_day_completeness` read-only, `get_latest_gratitude_entry`); **zero escrita de hábito** no GET (`seed_habit_day` nunca chamado — teste conta `HabitDayEntry` antes/depois = 0); isolamento por token comprovado no HTTP (tarefas) e no service (gratidão `is_tenant_scoped`); log de auditoria `{token_prefix, endpoint, status}` sem token pleno; `SummaryResponseSerializer(data).data` usado como **instância** (serialização), correto para campos `read_only`.
- **Achados e ações:**
  - 🟢 **LOW (test-coverage) — CORRIGIDO:** a ordem de `pendingTasks` (contrato de UX do widget, garantida por `Task.Meta.ordering = ["order_index"]`, espelhando `LogSerializer.get_tasks`) não era asseverada — todos os testes de tarefa usavam comparação por conjunto, então uma regressão de reordenação passaria silenciosamente. Reforçado `test_summary_pending_tasks_traz_so_raizes_pendentes_ou_started` para asseverar a **lista ordenada** (`["comprar café", "revisar PR"]`), determinística via `factory.Sequence` do `order_index`.
  - 🟢 **LOW (contrato OpenAPI) — NÃO corrigido (consciente):** `@extend_schema` documenta só `200`; os desfechos `401/403/429` do AC3 não são declarados no OpenAPI. É **consistente com o molde da 12.5** (`CaptureView`) — não é regressão. Auto-corrigir divergiria do padrão estabelecido e churnaria `schema.yaml`/`types.gen.ts` por uma melhoria Tier 0. Deixado como nota.

### Change Log

- 2026-07-23 — Review adversarial da Story 12.6: aprovado, status → **done**. 48 testes das áreas tocadas verdes, lint-imports 1 kept/0 broken, schema/types sem drift. Fix aplicado: reforço de asserção de **ordem** em `pendingTasks` (LOW test-coverage). Sprint-status sincronizado (`12-6-... → done`).
- 2026-07-23 — Implementação da Story 12.6 (`GET /api/summary/today`) concluída e marcada para review. Suíte completa: 952 passed. Contrato OpenAPI + tipos frontend regenerados sem drift; ruff/lint-imports verdes.
