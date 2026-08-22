---
baseline_commit: c2ba650c25987153f44e73fe90ea623508b1339e
---

# Story 14.1: Ciclos de vida de Weekly e Monthly (backend)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> **Escopo:** backend puro (Django/DRF). **Nenhuma superfície de UI nova.** O único arquivo de frontend tocado é `frontend/src/api/types.gen.ts` — **gerado**, nunca editado à mão (guardrail de CI).
>
> **Autoridade de forma:** `AD-28` do `architecture.md` decide a modelagem (colunas nos próprios logs, constraints únicas parciais, `NULL` = fora do regime). **Não redecidir.** Autoridade de produto (gates, ordem, irreversibilidade): spines M06/M07 no `EXPERIENCE.md`.

## Story

Como Hugo,
Quero os estados explícitos Em planejamento / Em andamento / Finalizada(o) para Weekly e Monthly persistidos com seus gates,
Para que o ciclo operacional do método seja garantido pelo domínio, não pela disciplina (UX-DR23; EXPERIENCE M06/M07; delta aprovado — decisão Hugo 2026-07-22).

## Acceptance Criteria

### AC1 — Schema: estado do ciclo em colunas + unicidade no banco

**Dado que** os ciclos descritos nos spines M06/M07 e a forma decidida na AD-28,
**Quando** a migration nomeada adiciona o estado do ciclo + o marco de "planejamento concluído" a `weekly_log` **e** `monthly_log`,
**Então** as duas tabelas ganham colunas **idênticas** — `status VARCHAR NULL` (`planning | active | finalized`, `TextChoices` + `CheckConstraint`) e `planning_completed_at TIMESTAMPTZ NULL` (timestamp, **nunca** booleano) —, com `status IS NULL` significando **fora do regime operacional**,
**E** `UniqueConstraint` **parcial** por tabela garante no máximo **UM** `active` e **UM** `planning` por usuário (`(user_id) WHERE status='active'` e `(user_id) WHERE status='planning'`), com violação de corrida virando `409` via `DomainError`,
**E** a migration é aplicada à branch Neon `e2e` **antes** de qualquer execução de Playwright.

### AC2 — Serviços de transição idempotentes, com os gates dos spines

**Dado que** os gates dos spines M06/M07,
**Quando** os serviços de **abrir alvo de planejamento / concluir planejamento / iniciar / finalizar / cancelar alvo vazio** rodam,
**Então** cada um é **idempotente** (re-execução no estado-alvo = no-op, mesmo retorno, sem escrita), `@transaction.atomic`, com assinatura `def <verbo>_<substantivo>(*, user, ...)` e a matriz de transições **no serviço** (nunca em serializer),
**E** **Iniciar** exige cumulativamente `today_for(user) >=` a chave-alvo (`week_start` / `month_first`) **+** `planning_completed_at` preenchido **+** ciclo operacional imediatamente anterior `finalized` — somente `pending`/`started` do anterior bloqueiam; avisos de Daily/Monthly/recorrentes **não** bloqueiam,
**E** **Finalizar** exige zero `pending`/`started` na subárvore completa **+** o próximo ciclo já registrado como `planning` — predicado **diferente por tipo**: Weekly = existe log com `status='planning'` e `week_start >` alvo (semanas podem ser puladas, AC3); Monthly = existe log com `status='planning'` e `month_first ==` alvo + 1 mês (sequência sem lacunas) —, e é **irreversível** (`finalized` é terminal, conjunto de saída vazio),
**E** **Concluir planejamento** é **não-bloqueante** (não exige zerar fontes, não congela o ritual, permanece revisitável até Iniciar) e **não** muda `status`, mas **exige** `status == 'planning'`: concluir planejamento de um log fora do regime (`NULL`) é `InvalidTransition`,
**E** **Cancelar alvo de planejamento** existe **só no Weekly**, só quando o alvo tem zero tarefas, e é a única transição "para trás" — zera `status` **e** `planning_completed_at` (o alvo pode ser recriado, e recriado precisa concluir planejamento de novo) sem apagar o log.

### AC3 — Monthly: sequência sem lacunas e janela regular derivada da virada

**Dado que** a continuidade obrigatória do M07,
**Quando** o alvo mensal é aberto,
**Então** o alvo é **sempre** o mês cronologicamente seguinte ao Monthly `active` (determinístico, sem escolha e sem retargeting) e meses pulados exigem **materialização sequencial** — um ciclo por vez, percorrendo planejar → concluir → iniciar → finalizar, **sem lote e sem fechamento automático**,
**E** o alvo semanal aceito é a semana corrente **ou** futura — `week_start < week_start_of(today_for(user))` é rejeitado com `InvalidTransition` (um alvo no passado envenenaria o "anterior operacional" de todos os ciclos seguintes),
**E** a janela regular mensal é a semana **seg→dom que contém a virada** (a mesma semana que é a última do mês anterior e a primeira do novo), computada em `core/calendar.py`, e é **informativa**: fora dela o mesmo ritual segue disponível como regularização atrasada,
**E** o Weekly, ao contrário, aceita como alvo a semana corrente **ou qualquer semana futura, inclusive pulando semanas sem registro** (apenas uma `planning` por vez).

### AC4 — Materialização nunca atribui estado (Future Log intacto)

**Dado que** entrar no regime operacional é sempre ato de ritual (AD-28 item 3),
**Quando** `get_or_create_weekly_log` / `get_or_create_monthly_log` rodam por qualquer caminho existente (GET de navegação, `POST` de tarefa, Brain Dump, placement de recorrente, migração),
**Então** o log nasce e permanece com `status IS NULL` e `planning_completed_at IS NULL` — **nenhum** desses caminhos atribui, altera ou lê estado como pré-condição,
**E** consultar/gravar num `monthly_log` futuro (armazenamento do Future Log) **não** cria nem inicia ciclo operacional.

### AC5 — Contrato legado preservado (premissa blindada do Daily)

**Dado que** o Daily legado permanece plenamente utilizável até o Épico 17,
**Quando** esta story entrega,
**Então** nenhum endpoint consumido pelo Daily/fluxos legados **muda de contrato**: `GET/POST /api/bujo/logs/weekly/`, `GET/POST /api/bujo/logs/monthly/`, `/api/bujo/archive/`, `/api/bujo/future-log/`, `/api/bujo/migration/queue/`, `/api/bujo/catch-up/queue/`, `/api/bujo/weekly-review/queue/`, `/api/bujo/monthly-review/queue/` e `/api/bujo/task-density/` mantêm rotas, campos existentes (incluindo `closed`) e semântica para todos os ciclos que já funcionavam,
**E** as adições são **estritamente aditivas** (campos novos opcionais + endpoints novos), provadas por testes de caracterização,
**E** os aliases de fila permanecem intactos até a 14.3 (nada de unificação aqui).

### AC6 — `finalized` como autoridade de "ciclo fechado", sem perda de histórico

**Dado que** a AD-28 item 5 move a autoridade de fechamento para o estado explícito,
**Quando** um ciclo está `finalized`,
**Então** ele é readonly de fato: qualquer `create_task` / `update_task` / `delete_task` / `reorder_task` naquele container levanta `ClosedCycleReadOnly` (409) — **inclusive quando o ciclo está vazio**, caso que a derivação atual não pegava,
**E** ciclos `NULL` legados que a derivação atual considera fechados continuam entrando no Arquivo pela derivação existente (fallback read-only, zero backfill especulativo), de modo que `/api/bujo/archive/` devolve a **união** dos dois critérios sem duplicar entradas.

### AC7 — Data migration retroativa com contagens verificadas e zero ciclos órfãos

**Dado que** ciclos Weekly/Monthly já existem no banco (abertos e fechados pela semântica do Épico 4),
**Quando** a data migration de estados roda,
**Então** todo ciclo existente recebe estado retroativo coerente: fechados pela derivação vigente → `finalized`; o ciclo do período **corrente** (por `today_for(user)`) → `active`, **materializado dentro da migration se ausente**; monthlies futuros (armazenamento do Future Log) **e** ciclos passados não-fechados → `NULL`,
**E** o backfill varre **somente usuários que já usaram o BuJo** (≥1 linha em `weekly_log`, `monthly_log` ou `tasks`) — materializar ciclo para conta que nunca usou contradiz a política de materialização sob demanda que a AC4 protege e inflaria as contagens,
**E** as contagens **por bucket e por tabela** são produzidas pela própria migration e **coladas literalmente** nas Completion Notes (nunca estimadas),
**E** zero ciclos órfãos: após a migration existe **no máximo um** `active` por tabela por usuário (exatamente um para todo usuário varrido), e o gate "Iniciar exige anterior finalizado" funciona no primeiro uso real porque "anterior" é definido como **o ciclo operacional imediatamente anterior (`status` não-`NULL`)** — ciclos `NULL` passados são ignorados pelo gate e suas tarefas abertas são a população da fila unificada da 14.3.

### AC8 — API do ciclo exposta para as stories de UI (escopo derivado)

**Dado que** os deltas de domínio/API exigem story própria e as Stories 14.5/14.6 são de UI (UX-DR23: "nunca tratados como CSS do redesign"),
**Quando** esta story fecha,
**Então** existe **um** endpoint de ação por tipo — `POST /api/bujo/logs/weekly/cycle/` e `POST /api/bujo/logs/monthly/cycle/` — que despacha `action` para o serviço correspondente (espelhando `tasks/<pk>/transition/`, que já recebe `to_status`) e devolve `{weekStart|monthFirst, status, planningCompletedAt}`,
**E** `GET /api/bujo/logs/weekly/` e `GET /api/bujo/logs/monthly/` passam a expor `status` e `planningCompletedAt` como campos **aditivos** (o campo `closed` permanece),
**E** `schema.yaml` e `frontend/src/api/types.gen.ts` são regenerados e commitados (guardrail de CI compara os dois).

## Tasks / Subtasks

- [x] **Task 1 — Colunas, enum e constraints nos dois models** (AC: 1)
  - [x] Em `backend/bujo/models.py`, criar `class CycleStatus(models.TextChoices)` **no nível do módulo** com `PLANNING = "planning"`, `ACTIVE = "active"`, `FINALIZED = "finalized"` — mesmo motivo documentado em `TaskStatus` (uma classe aninhada não é visível de `Meta`). Expor como `WeeklyLog.Status = CycleStatus` e `MonthlyLog.Status = CycleStatus`.
  - [x] Adicionar em **ambos** os models:
    ```python
    status = models.CharField(  # noqa: DJ001 - NULL é a 3ª semântica (fora do regime operacional), não string vazia — AD-28 item 1
        max_length=16, choices=CycleStatus.choices, null=True, blank=True, default=None
    )
    planning_completed_at = models.DateTimeField(null=True, blank=True, default=None)
    ```
    O `# noqa: DJ001` **não é opcional**: `ruff` roda com `select = [..., "DJ"]` (`backend/pyproject.toml:35`) e DJ001 barra `null=True` em campo de string — todos os 6 casos existentes em `bujo/models.py` (l. 115, 118, 123, 191, 192, 195) carregam a mesma supressão com justificativa. Sem ela o gate `ruff check` da Task 8 falha. Docstring explicando que `NULL` = fora do regime operacional (3ª semântica, sem valor `none` no enum).
  - [x] Constraints por tabela (nomes exatos): `CheckConstraint(condition=Q(status__in=CycleStatus.values) | Q(status__isnull=True), name="weekly_log_status_valid")`; `UniqueConstraint(fields=["user_id"], condition=Q(status=CycleStatus.ACTIVE), name="uniq_weekly_log_active_per_user")`; `UniqueConstraint(fields=["user_id"], condition=Q(status=CycleStatus.PLANNING), name="uniq_weekly_log_planning_per_user")` — e os três equivalentes com prefixo `monthly_log`. Usar `condition=` (Django ≥5.1), como no resto do repo.
  - [x] **Não** tocar `body` (JSONField morto nos dois models) nem embutir estado nele.

- [x] **Task 2 — Migration nomeada + data migration com contagens** (AC: 1, 7)
  - [x] Criar **uma** migration `backend/bujo/migrations/0007_weekly_monthly_cycle_status.py` (`--name` descritivo obrigatório, §6.1; uma migration por story). Ordem das operations: `AddField` ×4 → `AddConstraint` ×6 → `RunPython(backfill, migrations.RunPython.noop)` (as constraints entram **antes** do backfill, para que ele não possa criar dois `active`).
  - [x] Backfill via `apps.get_model(...)` para `accounts.User`, `bujo.WeeklyLog`, `bujo.MonthlyLog`, `bujo.Task`. **Nunca** importar `bujo.models` nem `bujo.services.*`. Varrer **só** os `user_id` que aparecem em `weekly_log`, `monthly_log` ou `tasks` (união de `values_list("user_id", flat=True).distinct()`), e resolver o `User` desses ids — não iterar `User.objects.all()` (AC7). Os models históricos **não** carregam `TenantManager` (`use_in_migrations` não está setado) nem o `save()` de `TenantModel` — então as queries são naturalmente não-escopadas (iterar por usuário explicitamente) e todo `create()` precisa passar `user_id=` à mão.
  - [x] `today_for(user)` vem de `core.calendar` (import direto permitido: o guardrail de AST ignora `migrations/`, e a AD-04 quer uma única autoridade de "hoje"; o `User` histórico tem `.timezone`). Documentar esse tradeoff em comentário.
  - [x] Expor no módulo da migration uma função **pura** `classify_cycle_status(*, kind, key, today, derived_closed) -> str | None` com toda a decisão de bucket — é o ponto de teste da Task 7. Buckets: chave do período corrente → `active` (materializar se ausente); `derived_closed` → `finalized`; futuro ou passado-não-fechado → `NULL`. O período corrente vence `finalized` (garante o invariante de um `active`).
  - [x] Derivação de fechado reimplementada localmente sobre o `Task` histórico (`tasks.exists() and not tasks.filter(status__in=("pending","started")).exists()`, sem filtrar `parent_task` — subárvore completa). Comentar que os literais são congelados pelo agregado `Task` (Story 3.1).
  - [x] Acumular e **imprimir** contagens por tabela × bucket (`finalized`, `active`, `active_materializado`, `null`) no stdout do `migrate`.
  - [x] `reverse_code = migrations.RunPython.noop` com comentário: reverter a migration derruba as colunas, então não há dado a restaurar.

- [x] **Task 3 — Serviços de ciclo (`bujo/services/cycles.py` novo)** (AC: 2, 3)
  - [x] Matriz única no módulo: `ALLOWED = {None: {PLANNING}, PLANNING: {ACTIVE, None}, ACTIVE: {FINALIZED}, FINALIZED: set()}` — `finalized` terminal, auto-transições fora da matriz (padrão de `services/state_machine.py`). Transição fora da matriz **ou** gate não satisfeito → `InvalidTransition(from_status, to_status)` → 409 (literal da AD-28: o gate de data de Iniciar levanta `InvalidTransition`).
  - [x] **`None → ACTIVE` é ilegal e isso é load-bearing:** M06/M07 dão a `planning` uma única saída (Iniciar) e a `active` uma única entrada (confirmação a partir do alvo planejado). Sem essa restrição — combinada com a pré-condição `status == 'planning'` em `complete_*_planning` — existe um bypass completo do ritual: um log materializado por navegação (`NULL`, AC4) receberia o timestamp de planejamento, o gate de "anterior finalizado" seria satisfeito por vacuidade e o usuário entraria em `active` sem nunca ter planejado.
  - [x] Weekly: `open_weekly_planning_target(*, user, week_start)`, `complete_weekly_planning(*, user, week_start)`, `start_weekly(*, user, week_start)`, `finalize_weekly(*, user, week_start)`, `cancel_weekly_planning_target(*, user, week_start)`.
  - [x] Monthly: `open_monthly_planning_target(*, user)` (alvo determinístico, sem parâmetro de data), `complete_monthly_planning(*, user, month_first)`, `start_monthly(*, user, month_first)`, `finalize_monthly(*, user, month_first)`. **Sem** cancelar — decisão explícita do M07 ("O Monthly não herda a ação Cancelar planejamento vazio do Weekly").
  - [x] Todos `@transaction.atomic`, `user` como primeiro kwarg keyword-only, retornando a instância de domínio (§6.2).
  - [x] **Idempotência:** cada serviço detecta "já está no estado-alvo" e retorna o log **sem escrever** (`update_fields` só no caminho que muda). `complete_*_planning` re-executado **preserva** o `planning_completed_at` original (não re-timbra).
  - [x] **Pré-condições de estado, explícitas em cada serviço:** `open_*_planning_target` exige `status IS NULL` (log inexistente é criado); `complete_*_planning` exige `status == 'planning'`; `start_*` exige `status == 'planning'`; `finalize_*` exige `status == 'active'`; `cancel_weekly_planning_target` exige `status == 'planning'` **e** zero tarefas no alvo. Fora disso → `InvalidTransition`.
  - [x] `cancel_weekly_planning_target` zera **as duas** colunas: `save(update_fields=["status", "planning_completed_at"])`. Deixar o timestamp sobreviver permitiria recriar o alvo e passar o gate de Iniciar sem concluir planejamento de novo — M06 admite "cancelado **e recriado**".
  - [x] Predicado "próximo ciclo registrado" de `finalize_*`, **um por tipo** (não compartilhar): Weekly = `exists(status='planning', week_start__gt=alvo)`; Monthly = `exists(status='planning', month_first=alvo + 1 mês)`. Weekly permite pular semanas, Monthly não admite lacuna.
  - [x] `open_weekly_planning_target` rejeita `week_start < week_start_of(today_for(user))` (alvo no passado) com `InvalidTransition`.
  - [x] Helper privado `_previous_operational(...)`: o log de `status` **não-`NULL`** cronologicamente anterior à chave-alvo. Se não existir → gate de "anterior finalizado" satisfeito por vacuidade (é o que faz o primeiro uso real funcionar após a data migration). Se existir e não for `finalized` → `InvalidTransition`.
  - [x] Helper privado `_has_undisposed(log)`: reusa `UNDISPOSED` de `services/archive.py` (não redeclarar a tupla).
  - [x] `IntegrityError` das uniques parciais capturado e re-levantado como `CycleTargetConflict(DomainError)` (nova exceção em `core/exceptions.py`, docstring citando AD-28 item 2) → 409 pelo handler central.
  - [x] `planning_completed_at` escrito com `core.calendar.now()` (única fonte de "agora" para timestamp de auditoria — nunca `timezone.now()` cru).
  - [x] Alvo mensal em `open_monthly_planning_target`: mês seguinte ao `active`; se **não** houver Monthly `active` (usuário novo, nunca no regime), o alvo é o mês corrente por `today_for(user)` — decisão interina registrada em Dev Notes e em Questões abertas.

- [x] **Task 4 — Janela regular da virada em `core/calendar.py`** (AC: 3)
  - [x] Adicionar `month_turn_week(month_first: date) -> tuple[date, date]`: `(week_start_of(month_first), week_start_of(month_first) + timedelta(days=6))` — a semana seg→dom que contém a virada, simultaneamente última do mês anterior e primeira do novo. Docstring citando a decisão de 2026-07-20 ("Janela regular única na virada do mês") e deixando explícito que a janela é **informativa**, não gate.
  - [x] Retornar apenas `date`s (regra de porta: `core` não importa `bujo`).
  - [x] Serviço/endpoint expõem a janela como leitura; **nenhum** serviço a usa como pré-condição.

- [x] **Task 5 — `finalized` como autoridade de fechamento** (AC: 6)
  - [x] Em `backend/bujo/services/archive.py`, adicionar `is_cycle_closed(log) -> bool` = `log.status == CycleStatus.FINALIZED or is_container_closed(log)`. **Manter** `is_container_closed` intacta (é o fallback read-only dos ciclos `NULL` legados) e atualizar o docstring do módulo, que hoje afirma "fechamento é sempre COMPUTADO na leitura, nunca armazenado".
  - [x] `_check_container_open` em `services/tasks.py` passa a usar `is_cycle_closed` — fecha o buraco do ciclo `finalized` **vazio** (`is_container_closed` devolve `False` quando `total_tasks == 0`).
  - [x] `list_closed_cycles` passa a devolver a **união** (`status = finalized` **OR** derivação atual), sem duplicar entradas, mantendo a ordenação "mais recente primeiro" e a regra "`total_tasks = 0` nunca conta como fechado **pela derivação**" (um `finalized` vazio entra pelo estado).
  - [x] Campo `closed` das respostas Weekly/Monthly passa a usar `is_cycle_closed` — mesmo nome, mesmo tipo, semântica **ampliada** (nunca reduzida): tudo que era `closed=true` continua `true`.
  - [x] **Não** tocar `set_lineage_fields` (bypass deliberado e documentado) nem a ordem de operações de `_migrate_subtree` (`migration.py:41-60` cria o sucessor antes de transicionar a origem — a janela existe de propósito).

- [x] **Task 6 — Endpoints + serializers aditivos + schema regenerado** (AC: 5, 8)
  - [x] `backend/bujo/serializers.py`: adicionar `status = serializers.CharField(allow_null=True)` e `planning_completed_at = serializers.DateTimeField(allow_null=True)` a `WeeklyLogSerializer` e `MonthlyLogSerializer`, **preservando** `closed`. Novos: `WeeklyCycleActionSerializer` / `MonthlyCycleActionSerializer` (campo `action` = `ChoiceField`; `week_start`/`month_first` opcionais) e `WeeklyCycleSerializer` / `MonthlyCycleSerializer` de resposta (`week_start|month_first`, `status`, `planning_completed_at`, `regular_window_start`/`regular_window_end` só no monthly).
  - [x] `backend/bujo/views.py`: `WeeklyCycleView` / `MonthlyCycleView` (`APIView`, `@extend_schema`), views **finas** — serializer valida, dict módulo-level mapeia `action` → serviço, serviço decide. Sem `atomic` na view, sem regra de transição na view.
  - [x] `backend/bujo/urls.py`: `logs/weekly/cycle/` (`bujo-weekly-cycle`) e `logs/monthly/cycle/` (`bujo-monthly-cycle`).
  - [x] `WeeklyLogView.get` / `MonthlyLogView.get` passam `status` e `planning_completed_at` no dict de resposta — **sem** chamar serviço de ciclo e **sem** atribuir estado (AC4).
  - [x] Regenerar contrato: `cd backend && uv run python manage.py spectacular --file ../schema.yaml`, depois `cd frontend && npm run generate-types` (Node ≥20.12 — `nvm use 22.15.1` antes). Commitar `schema.yaml` **e** `frontend/src/api/types.gen.ts`; rodar `npx tsc --noEmit` no frontend.

- [x] **Task 7 — Testes** (AC: 1–8)
  - [x] `bujo/tests/test_models.py`: constraints — 2º `active`/`planning` do mesmo usuário levanta `IntegrityError`; `active` de **dois usuários diferentes** coexiste; `status` inválido barrado pelo CHECK; `NULL` aceito.
  - [x] `bujo/tests/test_services.py` (novo bloco de ciclos): **matriz exaustiva** de transições via `itertools.product` sobre `(None, planning, active, finalized)`, no estilo de `test_transition_task_matriz_completa` — cada par ilegal levanta e **não** persiste. Idempotência de cada um dos 9 serviços. Gates de Iniciar em 3 falhas isoladas (data antes do alvo / planejamento não concluído / anterior não finalizado) + o caminho felizes. `finalize` bloqueado por `pending` **e** por `started` **e** por ausência do próximo `planning`. Irreversibilidade de `finalized`. `complete_planning` não muda `status` e re-execução preserva o timestamp. `cancel` só com zero tarefas; ausência de cancel no Monthly. Alvo mensal determinístico + dois meses pulados exigindo materialização sequencial (sem lote). `_previous_operational` ignorando ciclos `NULL`.
  - [x] Guardrail de AC4: `get_or_create_weekly_log` / `get_or_create_monthly_log` devolvem `status=None`; `GET`/`POST` de weekly/monthly, processamento de Brain Dump e `place_template` **não** alteram `status` de um log pré-existente (assert antes/depois).
  - [x] AC6: mutação em ciclo `finalized` **vazio** → `ClosedCycleReadOnly` (o teste que prova o buraco fechado); `finalized` populado idem; `list_closed_cycles` devolve união sem duplicata.
  - [x] `bujo/tests/test_views.py`: 409 nos gates e na corrida de constraint; 200 nos caminhos felizes; `action` inválida → 400; **testes de caracterização de AC5** — o conjunto de chaves das respostas de `/logs/weekly/`, `/logs/monthly/`, `/archive/`, `/future-log/`, `/migration/queue/`, `/catch-up/queue/`, `/weekly-review/queue/`, `/monthly-review/queue/`, `/task-density/` é o esperado **mais** os dois campos novos, e nada mais mudou.
  - [x] `core/tests/test_calendar.py`: `month_turn_week` — mês que começa na segunda; mês que começa no domingo (janela começa no mês anterior); virada de ano (`2026-01-01`); fevereiro bissexto.
  - [x] Data migration: teste puro de `classify_cycle_status` importando o módulo com `importlib.import_module("bujo.migrations.0007_weekly_monthly_cycle_status")` (nome com dígitos funciona via `import_module`), cobrindo os 4 buckets nos dois `kind`. **Registrar explicitamente em Dev Notes/Completion Notes** que o backfill sobre dados reais não é testável pelo pytest (o banco de teste nasce vazio das migrations) — sua evidência é a saída de contagens do `migrate` na branch `dev`.
  - [x] `bujo/tests/factories.py`: `WeeklyLogFactory`/`MonthlyLogFactory` **mantêm `status` no default `None`** — qualquer outro default estoura as uniques parciais em massa nos testes existentes. Registrar os dois models no contrato compartilhado de isolamento (`register_isolation_case`, `make` sem `user_id`); se algo no registry for incompatível, documentar a divergência em vez de improvisar.
  - [x] Prova de não-vacuidade (guardrail de processo): para o teste do ciclo `finalized` vazio e para a matriz de transições, reverter cirurgicamente a correção/gate, ver o teste **falhar**, restaurar, confirmar `git diff --stat` limpo no arquivo de produção. Documentar os experimentos (separados) em Debug Log References.

- [x] **Task 8 — Aplicar a migration e rodar os gates** (AC: 1, 5, 7)
  - [x] Banco `dev` (produz as contagens do AC7): `cd backend && DJANGO_SETTINGS_MODULE=config.settings.dev uv run python manage.py migrate` — **colar a saída literal** nas Completion Notes.
  - [x] Branch Neon `e2e`, **antes** do Playwright: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.e2e uv run python manage.py migrate` (verificado em 2026-07-24/25: a credencial está válida e `migrate --check` sai 0). Se voltar a expirar, usar o fallback `bujo_e2e` local do `docs/e2e-neon-reset.md` §"Fallback validado".
  - [x] Pytest **full-suite, sem escopo de caminho**: `docker compose up -d db && cd backend && uv run pytest` (baseline re-executada nesta criação: **953 passed**, ~4m37s, commit `c2ba650`). Colar a contagem real e a divisão herdados/novos **derivada de `git diff`**, nunca por subtração.
  - [x] E2E de regressão do contrato legado (o AC5 é a razão da seleção): `weekly-monthly-task-crud.spec.ts`, `weekly-monthly-review.spec.ts`, `archive.spec.ts`, `migration-flow.spec.ts`, `daily-tasks.spec.ts`, `brain-dump.spec.ts`. `nvm use 22.15.1`, `CI=1`, e **nunca** matar 5174/8001 (dev local do dono) — o E2E vive em 5173/8000.
  - [x] `uv run ruff check` + `ruff format --check` no backend; `npx tsc --noEmit` no frontend.
  - [x] Atualizar `docs/e2e-neon-reset.md` §"Sintoma: credencial da branch `e2e` stale", que ainda afirma que a credencial está inválida desde 2026-07-24 — o gap de documentação conhecido entra no fechamento da story (guardrail de processo).

## Dev Notes

### Estado atual do código que esta story altera (leia antes de escrever)

**`backend/bujo/models.py:27-64`** — `WeeklyLog` (`db_table="weekly_log"`, `week_start DATE`, `body JSONField`) e `MonthlyLog` (`monthly_log`, `month_first DATE`, `body`). Ambos herdam `TenantModel` (UUID PK, `user_id UUIDField` indexado **não-FK**, `objects = TenantManager()` obrigatoriamente primeiro, `all_objects` como escape hatch). Constraints hoje: unique `(user_id, chave)` + CHECK de segunda-feira / dia 1. **Não há** coluna de estado, nem `created_at`/`updated_at`. Tabelas no **singular** (divergência histórica da convenção plural do §6.1 — preservar). `body` é morto: nenhum consumidor em produção.

**`backend/bujo/services/archive.py`** — `UNDISPOSED = (pending, started)`; `is_container_closed(log)` = tem ≥1 tarefa **e** nenhuma da subárvore completa em `pending`/`started` (não filtra `parent_task`). `list_closed_cycles(*, user)` monta as entradas do Arquivo com `annotate(total, undisposed).filter(total__gt=0, undisposed=0)`. O docstring do módulo declara a filosofia "fechamento sempre COMPUTADO, nunca armazenado" — **esta story a substitui para o regime operacional** e mantém a derivação como fallback dos ciclos `NULL` (AD-28 item 5). Atualizar o docstring é parte do trabalho.

**`backend/bujo/services/tasks.py:13-19`** — `_check_container_open(*, weekly_log=None, monthly_log=None)` levanta `ClosedCycleReadOnly`; chamado por `create_task` (l.42), `update_task` (l.67), `delete_task` (l.102). `set_lineage_fields` (l.71-85) **contorna de propósito** o guardrail, com justificativa longa no docstring — preservar intocado.

**`backend/bujo/services/logs.py`** — os três `get_or_create_*_log`, `@transaction.atomic`, sem normalização (o chamador normaliza via `week_start_of` / `.replace(day=1)`). Chamadores a preservar: `views.py:257,283,309,324`, `services/recurring.py:46,53`, `services/migration.py:143,147`, `braindump/services.py:56,61`. **Nenhum deles pode passar a atribuir estado** (AC4).

**`backend/bujo/services/state_machine.py`** — o padrão a espelhar: `ALLOWED` módulo-level como única fonte de verdade, um serviço `@transaction.atomic`, `InvalidTransition` no serviço, `save(update_fields=[...])`, terminais com conjunto vazio, auto-transições ilegais.

**`backend/bujo/views.py:244-336`** — `WeeklyLogView`/`MonthlyLogView`. O GET **materializa** o log pedido (`get_or_create_*`) e devolve `closed: is_container_closed(...)`. É exatamente o caminho que a AC4 blinda: navegar não pode criar ciclo operacional.

**`backend/core/calendar.py`** — autoridade temporal. `today_for(user)` (date, fuso do usuário), `now()` (TIMESTAMPTZ de auditoria — é o que `planning_completed_at` usa), `week_start_of(d)`, `weeks_of_month(y, m)`, `months_of_week(week_start)`, `is_workday`, `resolve_day_type(s)`. **Não existe** `week_end_of` (Sunday = `+6 dias`, inline em vários pontos) nem helper de janela da virada — a Task 4 cria `month_turn_week`.

**`backend/core/exceptions.py`** — `DomainError` (Exception puro) → 409 pelo `custom_exception_handler`; `InvalidTransition(from_status, to_status)`; `ClosedCycleReadOnly`; `TenantScopeViolation` → 500 opaco + `logger.critical`. **Proibido** levantar `ValidationError`/`ValueError` cru de dentro de `services/` (§6.4).

**`backend/medications/models.py:236-244`** — a **primeira** `UniqueConstraint` parcial do codebase (`condition=Q(source=SCHEDULED)`), com o comentário explicando o índice parcial gerado. É o precedente exato das 4 uniques desta story.

**`backend/medications/services.py:346-388`** (`seed_medication_day`) — precedente de idempotência "create-if-missing, nunca `update_or_create`", para não clobberar timestamps já gravados. Mesmo espírito de `complete_*_planning` re-executado.

### Regras de produto que os serviços precisam materializar (spines vencem conflitos)

**Weekly (M06)** — [Source: ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Weekly e planejamento semanal → Ciclo de vida]

| Estado | Entrada | Saída e restrições |
|---|---|---|
| Em planejamento | registro-alvo criado enquanto outro Weekly está em andamento | plenamente operável; sai somente por **Iniciar semana** |
| Em andamento | confirmação explícita após `week_start`, planejamento concluído e Weekly anterior finalizado | um único Weekly `active`; quando não há `pending`/`started` e já existe o próximo em planejamento, oferece **Finalizar semana** |
| Finalizada | confirmação irreversível, com o próximo Weekly já registrado | somente leitura, nunca reabre |

- "Um Weekly **Em planejamento** permite criar, editar, reordenar, migrar, iniciar e concluir tarefas" — `planning` **não** é readonly. Só `finalized` é.
- "**Concluir planejamento** é uma declaração não bloqueante: pode ocorrer a qualquer momento, não exige abrir/zerar fontes, não congela o ritual e não precisa ser repetida após novas decisões."
- "O planejamento pode escolher a semana do calendário atual ou qualquer semana futura, inclusive pulando semanas sem registro; apenas uma semana pode estar **Em planejamento**." + "planejamento vazio pode ser cancelado e recriado, nunca retargeted".
- Weekly anterior é a **única fonte bloqueante**; "somente tarefas `pending` ou `started` do Weekly imediatamente anterior bloqueiam **Iniciar semana**"; pendências de Daily, Monthly e recorrentes "geram avisos persistentes, mas não bloqueiam".
- "A data do calendário não finaliza uma semana automaticamente; o ciclo operacional pode atravessar a fronteira temporal." E "uma semana futura nunca entra **Em andamento** antes de sua segunda-feira, mesmo quando seu planejamento for concluído antecipadamente."

**Monthly (M07)** — [Source: EXPERIENCE.md#Monthly e planejamento mensal → Ciclo de vida e continuidade]

- Mesmas três colunas de estado, com uma diferença dura: "Em planejamento … **não pode ser cancelado nem trocar de alvo**".
- "**Iniciar mês** exige cumulativamente data igual ou posterior ao dia 1 do alvo, planejamento concluído e Monthly imediatamente anterior finalizado. Somente `pending`/`started` do Monthly anterior bloqueiam."
- "Meses pulados são exceção consciente à política de não materializar períodos ausentes: cada mês intermediário é criado em sequência e percorre individualmente planejar → concluir planejamento → iniciar → finalizar. Não há salto, processamento em lote nem fechamento automático, mesmo quando o ciclo está vazio."
- "O alvo de **Planejar próximo mês** é sempre o mês cronologicamente seguinte ao Monthly em andamento; não existe escolha ou retargeting. A janela regular começa na segunda-feira da semana segunda→domingo que contém a virada do mês … Depois do fim dessa janela, o mesmo ritual permanece disponível como regularização atrasada. `today_for(user)` governa a janela e o gate de início."
- "Monthlies futuros usados apenas como armazenamento do Future Log não aparecem nessa navegação e consultá-los no Future Log não cria nem inicia um ciclo operacional." — [Source: EXPERIENCE.md#Future Log → Identidade temporal e horizonte] reforça: "Abrir o Futuro ou consultar qualquer mês dele não cria nem inicia um Monthly **Em andamento** ou **Em planejamento**."

**Fechamento** — [Source: EXPERIENCE.md#Arquivo e ciclo fechado] "Ciclo finalizado permanece navegável e legível, em readonly. Controles de mutação desaparecem; conteúdo não recebe aparência disabled. Weekly só finaliza explicitamente sem tarefas `pending`/`started` e nunca reabre."

### Forma decidida (AD-28 — não redecidir)

```sql
-- weekly_log E monthly_log (colunas idênticas nas duas tabelas — story 14.1)
status                 VARCHAR NULL,      -- planning | active | finalized; NULL = fora do regime operacional
planning_completed_at  TIMESTAMPTZ NULL,  -- marco "planejamento concluído" (não congela o ritual)
-- CHECK status IN (...); UNIQUE parcial (user_id) WHERE status='planning'; UNIQUE parcial (user_id) WHERE status='active'
```

Pontos vinculantes da AD-28 [Source: _bmad-output/planning-artifacts/architecture.md#AD-28]:

1. Estado **em colunas nos próprios logs, sem tabela de ciclo** — `WeeklyLog`/`MonthlyLog` já *são* o ciclo (1:1 por `(user, chave)`, AD-05). O marco de planejamento é **timestamp, não booleano**.
2. "Unicidade no banco, não na disciplina" — uniques parciais; `IntegrityError` → `DomainError` (409). **Um `active` + um `planning` simultâneos é o estado normal do método.**
3. "Transições só por service explícito — materialização nunca atribui estado." Gates no service, nunca em serializer. `finalized` terminal. **"Cancelar o alvo de planejamento é a única transição 'para trás': reverte `status` a `NULL` (o log sobrevive se já tiver registros)."**
4. Buckets da data migration: `finalized` / `active` (materializado se ausente) / `NULL` para monthlies futuros **e ciclos passados não-fechados** — "estes últimos ficam fora do regime e suas tarefas abertas são exatamente a população da fila unificada", que a 14.3 escoa **sem precisar de estado no ciclo**.
5. `finalized` vira a autoridade de "ciclo fechado" (consumido pela 14.10); ciclos `NULL` legados continuam entrando pela derivação existente — "zero perda de histórico, sem backfill especulativo".

**Casos-âncora da própria AD** (transformar em testes literais): bootstrap com semana corrente → `active`, monthly de outubro só como storage → `NULL`, semana velha com 2 tarefas abertas → `NULL` com as 2 tarefas indo para a fila unificada; 2º "Planejar próxima semana" com alvo já em planejamento → 409; "Iniciar semana na sexta-feira anterior ao alvo: `today_for(user) < alvo` → `InvalidTransition` (409); na segunda-feira … passa — re-executar Iniciar depois é no-op"; dois meses pulados → um ciclo por vez.

### Ambiguidades resolvidas nesta story (documentadas em vez de improvisadas)

1. **Endpoints entram aqui (AC8).** As ACs do épico só falam de migration/constraints/services, mas UX-DR23 é explícito: "deltas de domínio … exigem **stories próprias** — nunca tratados como CSS do redesign", e 14.5/14.6 são stories de UI. Sem API nesta story, a 14.5 seria obrigada a inventar contrato. Forma escolhida: **um endpoint de ação por tipo com campo `action`**, espelhando `tasks/<pk>/transition/` (que já recebe `to_status`) — mantém a superfície de URL e o diff de OpenAPI mínimos.
2. **`closed` amplia, não muda de contrato (AC5 × AC6).** Um ciclo `finalized` **vazio** tem `is_container_closed == False` (a derivação exige `total_tasks > 0`), o que deixaria um ciclo finalizado mutável e fora do Arquivo. `closed` passa a ser a **união** `finalized OR derivado`: mesmo nome, mesmo tipo, e tudo que era `true` continua `true` — ampliação monotônica, não quebra de contrato. Os testes de caracterização provam isso.
3. **"Anterior" no gate = anterior *operacional*.** Se "anterior" fosse o log cronologicamente anterior qualquer, todo usuário com semanas velhas não-fechadas (bucket `NULL`) ficaria travado para sempre no primeiro uso real — exatamente o "ciclo órfão" que a AC7 proíbe. Logo: o gate consulta o anterior de `status` não-`NULL`; nenhum anterior operacional ⇒ gate satisfeito por vacuidade. Coerente com a AD-28 item 4, que manda as tarefas dos ciclos `NULL` para a fila da 14.3.
4. **Usuário novo, sem nenhum `active`.** Nada nos spines cobre o bootstrap de quem nunca entrou no regime (a data migration só cobre dados existentes). Decisão interina: `open_monthly_planning_target` sem `active` mira o **mês corrente** por `today_for(user)`; o Weekly já aceita a semana corrente como alvo por regra própria. Registrado em Questões abertas.
5. **Erro de gate usa `InvalidTransition`, não uma exceção nova por motivo.** É o literal da AD-28. O "porquê" que a UI precisa (painel de verificação de Iniciar da 14.5) é uma **leitura** de prontidão, não o corpo do 409 — o 409 é o guarda de corrida de última instância. Só a colisão de unique ganha exceção nova (`CycleTargetConflict`), porque não é transição ilegal e sim disputa de alvo.

### Convenções que o dev **não** pode violar

- `TextChoices` + `CheckConstraint`; **nunca** ENUM nativo do Postgres. Migration com `--name` descritivo, uma por story [Source: architecture.md#6.1].
- Serviço em `<app>/services/<agregado>.py`, **funções de módulo, nunca classes**; `def <verbo>_<substantivo>(*, user, ...)`; `@transaction.atomic` **no serviço**, nunca na view; view fina (serializer → serviço → serializer) [Source: architecture.md#6.2].
- Transição ilegal é **sempre** `InvalidTransition` levantada no serviço — nunca `validate_status()` em serializer [Source: architecture.md#6.6].
- Nenhuma chamada crua a `date.today()`/`timezone.now()` fora de `core/calendar.py`; guardrail de AST em `core/tests/test_guardrails.py` (que **ignora** `migrations/`, `test_*` e `conftest`) [Source: architecture.md#6.9].
- `core` não importa app de domínio (import-linter no CI) — `month_turn_week` devolve `date`s puras.
- Fora do request, `with tenant_context(user):` é obrigatório (§6.7). **Exceção justificada:** models históricos numa migration não carregam `TenantManager` (`use_in_migrations` não setado) nem o `save()` de `TenantModel` — a data migration itera por usuário e passa `user_id=` à mão, e por isso **não** usa `tenant_context`. Documentar em comentário.
- Testes por camada: `test_models.py` / `test_serializers.py` / `test_services.py` / `test_views.py`; contrato de isolamento pelo registry compartilhado, não por `test_isolation.py` novo em `bujo/`.

### Project Structure Notes

Arquivos previstos (NEW/UPDATE):

| Arquivo | Ação |
|---|---|
| `backend/bujo/models.py` | UPDATE — `CycleStatus` + 2 colunas + 6 constraints |
| `backend/bujo/migrations/0007_weekly_monthly_cycle_status.py` | NEW — schema + backfill + `classify_cycle_status` |
| `backend/bujo/services/cycles.py` | NEW — 9 serviços + matriz + helpers |
| `backend/bujo/services/archive.py` | UPDATE — `is_cycle_closed`, união em `list_closed_cycles`, docstring |
| `backend/bujo/services/tasks.py` | UPDATE — `_check_container_open` usa `is_cycle_closed` |
| `backend/core/calendar.py` | UPDATE — `month_turn_week` |
| `backend/core/exceptions.py` | UPDATE — `CycleTargetConflict` |
| `backend/bujo/serializers.py` | UPDATE — 2 campos aditivos + 4 serializers novos |
| `backend/bujo/views.py` | UPDATE — 2 views novas + 2 campos nas respostas |
| `backend/bujo/urls.py` | UPDATE — 2 rotas |
| `backend/bujo/tests/{factories,test_models,test_services,test_views}.py` | UPDATE |
| `backend/core/tests/test_calendar.py` | UPDATE |
| `backend/conftest.py` | UPDATE (se necessário) — módulos de isolamento |
| `schema.yaml`, `frontend/src/api/types.gen.ts` | UPDATE — **gerados** |
| `docs/e2e-neon-reset.md` | UPDATE — nota de credencial `e2e` desatualizada |

Divergência assumida: `db_table` no singular (`weekly_log`/`monthly_log`) contra a convenção plural do §6.1 — preexistente, preservada.

### Previous Story Intelligence

**Story 14.0** (`14-0-ux-mockups-complementares-do-nucleo-bujo.md`, `done` 2026-07-24) — gate UX do épico, executada pelo rito `bmad-ux`. Relevante aqui: "M06–M10 auditados e mantidos fechados; nenhuma lacuna comprovada exigiu novo frame" — ou seja, **os spines M06/M07 são a autoridade final desta story, sem reabertura**. A auditoria da 14.0 registrou o inventário do fechamento atual: "Fechamento backend: derivado por conteúdo e ausência de `pending`/`started`, incluindo subtarefas — é inventário legado; **AD-28 moverá autoridade para `status = finalized`**" [Source: ux-designs/.../.working/archive-14-0-coverage-audit.md]. E: "testes de comportamento no app permanecem para a Story 14.10" — o Arquivo desta story é só a semântica de backend.

**Épico 13 / retrospectiva 2026-07-24** — a última onda entregou 4 stories com 0 críticos, mas os achados recorrentes que mais custaram foram: (a) contagem de testes escrita de memória e **divisão** herdados/novos errada; (b) File List sem os artefatos criados em passos pós-dev-story; (c) testes **vacuosos** (assert que lia um token e o descartava; teste cujo nome prometia um guard que ele não exercitava). Os três já são `persistent_facts` do `bmad-dev-story` — e as Tasks 7–8 desta story os endereçam explicitamente. Também vale a lição de **não copiar código ao espelhar** (13.3 → SHELL-DEBT-03/04): aqui os dois tipos de ciclo têm regras quase idênticas — **extraia os helpers compartilhados** (`_previous_operational`, `_has_undisposed`, matriz) em vez de duplicar weekly/monthly.

**Pendência de ops herdada** — a `sprint-status.yaml` registra "credencial da branch Neon e2e … vira caminho crítico na 14.1, que tem data migration". **Verificado na criação desta story (2026-07-24/25): resolvida** — `DJANGO_SETTINGS_MODULE=config.settings.e2e uv run python manage.py migrate --check` sai `0`, banco alcançável e sem migration pendente. O `docs/e2e-neon-reset.md` §"credencial stale" está desatualizado (Task 8).

### Git Intelligence

`c2ba650` fecha a orquestração do Épico 13 e `b4be6fe` a retrospectiva; `3bd9318` fecha o gate UX da 14.0. Os últimos commits de código (`8c706cd`, `2fca13f`, `d14e366`) são todos **frontend/shell** — **nenhuma mudança de backend desde `0006_task_waiting_on.py` (Story 12.2, 2026-07-23)**. Consequência prática: `0007` é o próximo número livre sem risco de conflito, e não há padrão de backend recém-estabelecido a herdar além do que já está no repo. Os commits de shell reforçam a convenção de mensagem: `feat(story-14.1): <resumo>`.

### Latest Tech Information

- **Django 5.2.15** (`0006` foi gerado por ela). Consequência direta: `CheckConstraint`/`UniqueConstraint` usam **`condition=`** — `check=` está deprecado desde 5.1 e é removido em 6.0. Todo o repo já usa `condition=`; manter.
- `UniqueConstraint(fields=[...], condition=Q(...))` gera índice único **parcial** no Postgres (`CREATE UNIQUE INDEX ... WHERE ...`). Só o Postgres é alvo (16 em docker-compose / Neon) — sem preocupação de portabilidade.
- **`RunPython`/`RunSQL` é estreia no repo**: `grep -rln "RunPython\|RunSQL" backend/*/migrations/` não retorna nada hoje. Por isso o padrão está escrito na Task 2 em vez de apontado para um exemplo. Models históricos: sem managers customizados (`use_in_migrations` ausente) e sem métodos do model — `save()`/`TenantManager` **não** existem lá.
- `importlib.import_module("bujo.migrations.0007_...")` funciona apesar do nome começar com dígito (a restrição sintática vale só para a palavra-chave `import`) — é como a Task 7 testa `classify_cycle_status`.
- **Node ≥20.12 via nvm** para qualquer comando de frontend/e2e (`nvm use 22.15.1`); a sessão abre em v18 e não há `.nvmrc`.
- Pytest usa **Postgres local** (docker-compose, `hmmb_test`, tmpfs) — full-suite local é barato e é o padrão; o CI roda `uv run pytest` sem escopo.

### Testing

- **Baseline re-executada nesta criação de story** (não copiada de documento anterior): `docker compose up -d db && cd backend && uv run pytest` → **953 passed em 276.79s**, commit `c2ba650`, 2026-07-24. Re-executar ao fechar e colar o número real; derivar a divisão herdados/novos de `git diff`, nunca por subtração.
- Fixtures disponíveis (`backend/conftest.py`, único conftest raiz): `_enable_db_access` (autouse), `user`, `other_user`, `api_client`, `auth_client` (já entra em `tenant_context`). Testes de serviço chamam o serviço direto e **envolvem o corpo em `with tenant_context(user):`** — padrão de `bujo/tests/test_services.py`.
- Exemplar de matriz exaustiva a espelhar: `test_transition_task_matriz_completa` (`bujo/tests/test_services.py:42`) — `itertools.product` sobre todos os estados, assertando persistência no caso legal e `InvalidTransition` + ausência de mudança no ilegal.
- Exemplares de idempotência/tenant: `test_get_or_create_weekly_log_idempotente` (l.410), `..._escopado_por_tenant` (l.420) e os equivalentes monthly (l.431/441).
- E2E: Playwright sobe os servidores sozinho (`webServer`), frontend 5173 (`--mode e2e`, lê `.env.e2e`) e backend 8000 (`config.settings.e2e`), `workers: 1`. **Não** roda no CI — é gate local. `CI=1` e escopo por spec.
- Nomes de teste em pt-BR descritivo, como o resto do arquivo.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 14.1: Ciclos de vida de Weekly e Monthly (backend)] — ACs originais (linhas 2193–2218)
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR23] — ciclo de vida com gates; deltas de domínio exigem stories próprias
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 14: Onda 3 — Núcleo BuJo no Sistema Novo (gate vertical)] — decisão (a), Daily legado utilizável até o Épico 17
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-28] — forma da modelagem, casos-âncora, impacto em AD-05/AD-09
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-05] — `week_start` segunda, `month_first` dia 1, Future Log = `monthly_log` futuro
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-04] — autoridade temporal, sem automação de fechamento
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-18] — `inherited_successor_status` (reuso da 14.3, não desta story)
- [Source: _bmad-output/planning-artifacts/architecture.md#6.1, #6.2, #6.4, #6.6, #6.7, #6.8, #6.9] — nomenclatura, camada de serviço, erros, validação, multi-tenant, tempo, anti-padrões
- [Source: _bmad-output/planning-artifacts/architecture.md#7.4] — E2E/Playwright, branch Neon por ambiente
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Weekly e planejamento semanal] — ciclo de vida, gates, fontes, navegação
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Monthly e planejamento mensal] — ciclo, continuidade, meses pulados, janela regular
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Future Log] / [#Arquivo e ciclo fechado] / [#State Patterns]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/architecture-and-story-handoff.md#M06 — Weekly] / [#M07 — Monthly] / [#Detalhes puramente técnicos]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/.decision-log.md] — entradas de 2026-07-20 dos gates M06/M07
- [Source: _bmad-output/planning-artifacts/implementation-readiness-report-2026-07-23.md] — achado 🟠 que originou a AD-28; premissa blindada do Daily
- [Source: backend/bujo/models.py] / [backend/bujo/services/{archive,tasks,logs,state_machine,migration}.py] / [backend/bujo/{views,serializers,urls}.py]
- [Source: backend/core/{calendar,exceptions,models,tenant}.py] / [backend/conftest.py] / [backend/core/tests/{registry,test_guardrails,test_calendar}.py]
- [Source: backend/medications/models.py#MedicationDayEntry.Meta] — precedente de unique parcial
- [Source: docs/e2e-neon-reset.md] — runbook da branch `e2e` e fallback local

### Questões abertas (para o dono — não bloqueiam a implementação)

1. **Bootstrap de usuário novo no regime operacional.** Os spines só descrevem a operação em regime; a data migration só cobre dados existentes. Decisão interina implementada: sem `active`, o alvo mensal é o **mês corrente** (`today_for`) e o Weekly aceita a semana corrente. Se o desejado for um "onboarding de ciclo" explícito, é story própria.
2. **Endpoints nesta story (AC8).** Incluídos por dedução de UX-DR23 (delta de API não é trabalho de story de UI). Se o dono preferir que 14.5/14.6 os definam, remover a Task 6 e a AC8 — o resto da story permanece válido.
3. **Semântica de `closed` ampliada (AC6).** Necessária para que um ciclo `finalized` **vazio** não fique mutável. Ampliação monotônica, mas é mudança observável de comportamento numa resposta legada — confirmar que é aceitável ou aceitar o buraco até a 14.10.
4. **Evidência do backfill sobre dados reais.** Não é testável pelo pytest (banco de teste nasce vazio das migrations). A evidência contratada é a saída de contagens do `migrate` na branch `dev` colada nas Completion Notes. Se o dono quiser prova automatizada, seria necessário adicionar `django-test-migrations` — fora do escopo aqui.
5. **`body JSONField` morto** em `WeeklyLog`/`MonthlyLog` (sem nenhum consumidor). Não removido aqui (não é o escopo desta story); candidato a limpeza no Épico 18.

## Dev Agent Record

### Agent Model Used

claude-opus-5[1m] (Claude Opus 5, 1M context)

### Debug Log References

**Saída literal do `migrate` no banco `dev`** (evidência contratada do AC7 — o backfill sobre dados reais não é testável pelo pytest, porque o banco de teste nasce vazio das migrations):

```
Applying bujo.0007_weekly_monthly_cycle_status...
[0007 backfill] usuários varridos: 3 (de 3 ids)
[0007 backfill] weekly_log: finalized=4, active=3, active_materializado=0, null=7
[0007 backfill] monthly_log: finalized=2, active=3, active_materializado=2, null=6
 OK
```

**Saída literal do `migrate` na branch Neon `e2e`** (aplicada ANTES de qualquer Playwright):

```
Applying bujo.0007_weekly_monthly_cycle_status...
[0007 backfill] usuários varridos: 1 (de 1 ids)
[0007 backfill] weekly_log: finalized=4, active=1, active_materializado=0, null=7
[0007 backfill] monthly_log: finalized=2, active=1, active_materializado=0, null=6
 OK
```

Invariante do AC7 conferido nas duas bases: **exatamente um `active` por tabela por usuário varrido** (dev: 3 usuários → 3 `active` weekly + 3 `active` monthly; e2e: 1 usuário → 1 + 1). Zero ciclos órfãos.

**Provas de não-vacuidade (experimentos SEPARADOS, guardrail de processo).**

*Experimento 1 — buraco do ciclo `finalized` vazio (AC6).* Revertido cirurgicamente `_check_container_open` de `is_cycle_closed` de volta para `is_container_closed` em `bujo/services/tasks.py`. Resultado: `test_ac6_ciclo_finalized_vazio_e_readonly` **FALHOU** com `Failed: DID NOT RAISE ClosedCycleReadOnly` (1 failed). Correção restaurada; `git diff --stat backend/bujo/services/tasks.py` volta a `16 insertions(+), 5 deletions(-)` — igual ao estado pré-experimento, sem resíduo.

*Experimento 2 — matriz de transições (AC2).* Quebrada a propriedade que a matriz afirma: `ALLOWED[None]` passou de `{PLANNING}` para `{PLANNING, ACTIVE}` (abrindo o bypass do ritual que a matriz existe para impedir). Resultado: **2 failed** — `test_ciclo_weekly_matriz_completa[None-active]` e `test_ciclo_monthly_matriz_completa[None-active]`, exatamente as células que a mudança afeta (o teste passou a esperar transição legal e recebeu `InvalidTransition: planning -> active` do gate). Restaurado e verificado por `grep` (`None: {CycleStatus.PLANNING},` na l. 60) — o arquivo é novo/untracked, então `git diff --stat` não o cobre.

**Experimentos do passo de QA (`bmad-qa-generate-e2e-tests`, 2026-07-25) — SEPARADOS dos dois acima.**

*Experimento 3 — AC6 no E2E do app real.* Revertida `is_cycle_closed` para só a derivação **e**
`_CLOSED_BY_EITHER` reduzida a `Q(total__gt=0, undisposed=0)` em `services/archive.py`. Resultado: o
E2E `ciclo finalized VAZIO entra no Arquivo e a semana fica readonly (AC6)` **FALHOU** nas 3
tentativas em `getByRole('link', { name: 'Semana de <weekStart>' })` — o ciclo vazio desaparece do
Arquivo. Produção restaurada e verificada: `grep EXPERIMENTO` = 0, `git diff --stat
backend/bujo/services/archive.py` de volta a `45 insertions(+), 10 deletions(-)` (idêntico ao estado
pré-experimento) e `bujo/`+`core/` = **539 passed**.

*Experimento 4 — AC4 no E2E do app real.* Injetada em `get_or_create_weekly_log`
(`services/logs.py`) a atribuição de estado que a AC4 proíbe (`status = "planning"` na
materialização). Resultado: o E2E `navegar o app real não cria nem altera ciclo operacional (AC4)`
**FALHOU** nas 3 tentativas na fase 1 (`status: null` recebido como `planning`). Restaurado de backup
e verificado: `grep EXPERIMENTO` = 0 e `git diff --stat backend/bujo/services/logs.py` **vazio** —
correto, porque a 14.1 não altera `logs.py`.

**Gate `ruff check` estava vermelho e foi corrigido no passo de QA.** A afirmação "All checks passed!"
abaixo estava **incorreta** quando escrita: `uv run ruff check` acusava `F841` em
`bujo/tests/test_services.py:1854` (`log` atribuído e nunca usado em
`test_ciclo_weekly_finalizar_aceita_semana_pulada_como_proxima`). Corrigido **fortalecendo** o teste
(`log.refresh_from_db()` + assert de que `finalized` foi persistido, não só retornado) em vez de
apagar a variável — o teste afirmava apenas o valor de retorno. `ruff check` agora sai
`All checks passed!` de verdade.

**Gap de spec fechado dentro da story** (guardrail de processo — `architecture.md`, `prd.md` **e** `epics.md` checados): a AD-28 decidia schema + services, mas não os **endpoints**, a **ampliação de `closed`**, a exceção `CycleTargetConflict`, o bootstrap de usuário novo nem a **precedência futuro > derivação** no backfill. Nada disso estava em `epics.md` (as ACs originais da 14.1 param em migration/constraints/services) nem no `prd.md`. Registrado como **"Adendo as-built 2026-07-25 (Story 14.1 entregue)"** ao fim da AD-28 em `architecture.md`, para que as Stories 14.5/14.6/14.10 não re-derivem o contrato.

**Divergência de contrato observável, deliberada e registrada:** `closed` das respostas Weekly/Monthly passa a ser a união `finalized OR derivado`. Mesmo nome, mesmo tipo, ampliação **monotônica** (tudo que era `true` continua `true`) — é a Questão aberta 3 desta story. E `reorder_task`, que não passava pelo guardrail de ciclo fechado, passou a passar: o AC6 nomeia as quatro mutações (`create`/`update`/`delete`/`reorder`), e sem isso um ciclo fechado seguia reordenável.

### Completion Notes List

**O que foi entregue, por AC.**

- **AC1 (schema + unicidade).** `CycleStatus` no nível do módulo (mesmo motivo documentado em `TaskStatus`: uma classe aninhada não é visível de `Meta`), exposta como `WeeklyLog.Status`/`MonthlyLog.Status`. Colunas idênticas nas duas tabelas (`status VARCHAR NULL` com `# noqa: DJ001` justificado + `planning_completed_at TIMESTAMPTZ NULL`), 6 constraints geradas por um helper `_cycle_status_constraints(prefix)` — extraído em vez de copiado, porque as duas tabelas são gêmeas por decisão (AD-28 item 1) e cópia entre gêmeos é exatamente a dívida SHELL-DEBT-03/04 do Épico 13. Migration aplicada a `dev` **e** à branch Neon `e2e` antes do Playwright (saídas literais nas Debug Log References).
- **AC2 (serviços).** `bujo/services/cycles.py`: matriz `ALLOWED` única no módulo, 9 serviços públicos (5 weekly + 4 monthly), todos `@transaction.atomic` com `user` keyword-only. Weekly e Monthly compartilham a mecânica via `_CycleSpec` (parametrização), e os pontos onde as regras de produto realmente divergem estão nomeados: `next_planning_exists` (por tipo), escolha do alvo (weekly recebe chave, monthly não recebe) e existência de `cancel` (só weekly). Idempotência é checada **antes** da matriz, de propósito: é o caso-âncora da AD-28 ("re-executar Iniciar depois é no-op") — auto-transição é no-op, não erro.
- **AC3 (monthly sequencial + janela).** `next_monthly_target` é determinístico (o `planning` já existente, se houver — precedência acrescentada na code review, achado M1 —, senão o mês seguinte ao `active`, senão o mês corrente para conta nova); `open_monthly_planning_target` não aceita alvo. Teste-âncora de dois meses pulados percorre planejar→concluir→iniciar→finalizar **um ciclo por vez** e prova que iniciar o intermediário antes de finalizar o anterior é bloqueado e que o mês corrente nem é materializado no caminho. `month_turn_week` em `core/calendar.py` devolve `date`s puras e é **informativa** — nenhum serviço a consome como pré-condição.
- **AC4 (materialização nunca atribui estado).** Guardrails cobrindo os 6 caminhos: `get_or_create_*`, GET de weekly/monthly, POST de tarefa, placement de recorrente, Brain Dump e `migrate_task` para o futuro — todos com assert antes/depois em log **pré-existente com estado**, não só em log novo.
- **AC5 (contrato legado).** Testes de caracterização sobre `response.json()` (o contrato de fio em camelCase, não os nomes internos dos serializers) para as 9 respostas nomeadas na AC + a forma do `TaskSerializer`. `schema.yaml` e `types.gen.ts` regenerados: **0 deleções** nos dois (+156 e +141 linhas), o que é a prova mecânica de aditividade estrita.
- **AC6 (`finalized` como autoridade).** `is_cycle_closed` = **um critério por regime**: ciclo com `status` não-`NULL` fecha se e somente se `finalized`; ciclo `status IS NULL` (legado) continua fechando pela derivação, que fica intacta. `list_closed_cycles` filtra pelos dois ramos num único queryset por tabela — mutuamente exclusivos, então sem duplicata por construção e sem `distinct()`. **`reorder_task` passou a chamar o guardrail** (não chamava): o AC6 nomeia as quatro mutações. **Corrigido na code review:** a primeira entrega aplicava a derivação a **todo** ciclo (união irrestrita), o que fechava um alvo `planning` — ou o ciclo `active` — no instante em que sua última tarefa era disposta, contra M06/M07; ver achado A1 da Senior Developer Review.
- **AC7 (data migration).** Uma migration, ordem `AddField ×4 → AddConstraint ×6 → RunPython`: as uniques entram antes do backfill para que ele não possa produzir dois `active` nem por bug. Backfill varre só `user_id` presentes em `weekly_log`/`monthly_log`/`tasks`, itera por usuário e passa `user_id=` à mão (models históricos não têm `TenantManager` nem o `save()` de `TenantModel` — exceção justificada a §6.7, documentada em comentário). Contagens por tabela × bucket impressas pela própria migration.
- **AC8 (API).** Dois endpoints de ação (`logs/weekly/cycle/`, `logs/monthly/cycle/`) com despacho `action` → serviço em dict módulo-level; views finas, zero `atomic` e zero regra de transição na camada HTTP.

**Gates executados (contagens reais, coladas depois do último teste escrito).**

- **Pytest full-suite, sem escopo de caminho** (`uv run pytest`, sem `bujo/ core/`): **1094 passed em 297.74s** (re-executada no passo de QA, que somou testes de API — a contagem do dev-story era **1086 em 301.55s**). Divisão **derivada, não subtraída**: os 73 test functions do dev-story (extraídos de `git diff -U0` dos arquivos de teste) coletam **131** testes parametrizados, mais **2** casos novos no contrato compartilhado de isolamento (`bujo.WeeklyLog`, `bujo.MonthlyLog`) = **133**; o passo de QA adicionou **7** test functions em `test_views.py` que coletam **8** testes (uma é parametrizada ×2) = **141 novos no total**. Baseline herdada **953** (a da criação da story, re-executada no commit `c2ba650`). As derivações fecham exatamente: 953 + 133 = 1086 (dev-story) e 953 + 141 = 1094 (após QA).
- **`uv run ruff check`**: `All checks passed!` (só depois da correção do `F841` registrada nas Debug Log References — estava vermelho ao fim do dev-story).
- **`npx tsc --noEmit`** (Node 22.15.1): limpo.
- **`ruff format --check`**: falha em **48 arquivos, todos pré-existentes** — verificado por diff das listas antes/depois das minhas mudanças (idênticas para os arquivos rastreados; `bujo/models.py`, `bujo/views.py`, `bujo/serializers.py` e `core/calendar.py` já estavam fora de formato no baseline `c2ba650`). O único arquivo NOVO desta story sujeito ao ruff (`bujo/services/cycles.py`) foi formatado, então a story **não adiciona** nenhum arquivo à lista. `migrations/` é `extend-exclude` no `pyproject.toml`, então a `0007` não é coberta. **Este gate está vermelho no repo desde antes desta story e não foi resolvido aqui** — é dívida de formatação de escopo global, fora do escopo de uma story de domínio.
- **E2E de regressão do contrato legado** (6 specs, `CI=1`, Node 22.15.1, branch Neon `e2e` com a `0007` já aplicada, portas 5173/8000 — 5174/8001 do dono intocadas): **28 passed, 4 failed em 16.7m**. As 4 falhas estão TODAS em `weekly-monthly-task-crud.spec.ts` e foram **verificadas como PRÉ-EXISTENTES por execução real no baseline** `c2ba650` (`git stash push -u` → rodar o spec → `git stash pop`): o baseline dá **4 failed, 2 passed** e falha nos **mesmos 4 testes**, identificados pelos mesmos diretórios de `test-results/`:

  | Teste | HEAD (com a story) | Baseline `c2ba650` |
  |---|---|---|
  | `cria tarefa em Esta Semana com dia específico e sem dia (AC1)` | ✘ | ✘ |
  | `cria tarefa em Este Mês (…coberto por completude)` | ✘ | ✘ |
  | `edita título e eisenhower via painel compartilhado em Semana e Mês (AC2)` | ✘ | ✘ |
  | `excluir tarefa pending sem linhagem … hard delete (204) (AC3)` | ✘ | ✘ |

  **Não são regressões desta story** — os 4 specs restantes (`weekly-monthly-review`, `archive`, `migration-flow`, `daily-tasks`, `brain-dump`) passam inteiros no HEAD, incluindo os que exercitam `/archive/` e o `closed` ampliado.

  **Causa-raiz diagnosticada** (do snapshot que o Playwright salvou em `error-context.md`): a página renderiza corretamente o `form "Adicionar tarefa à semana"` com seu `textbox "Título"` visível, mas existe um **segundo campo `Título *`, oculto e portalizado FORA da árvore da página** — o `BrainDumpCaptureSheet` que a Story 13.3 passou a montar no `ShellLayout` como instância única em **todas** as rotas. O spec usa `getByLabel('Título')` **sem escopo**, e o locator resolve para o campo oculto (`required`, `element is not visible`), estourando o timeout. É exatamente a classe de achado da retrospectiva do Épico 13 ("desde a 13.3 existe uma superfície de captura montada em toda faixa, então locator de diálogo/painel sem escopo é ambíguo no app inteiro") e a mesma causa já registrada para `daily-tasks.spec.ts` na Story 13.4 — este spec nunca foi re-rodado depois da 13.3, então o dano ficou latente.

  **Registrado para triagem, fora do escopo desta story:** a correção é escopar os locators do `weekly-monthly-task-crud.spec.ts` (ex.: `page.getByRole('form', { name: 'Adicionar tarefa à semana' }).getByLabel('Título')`), trabalho de frontend/E2E que não toca nada do domínio entregue aqui. Consertá-lo dentro de uma story de backend puro ("Nenhuma superfície de UI nova") ampliaria o escopo sem necessidade.

**Questões abertas para o dono (nenhuma bloqueia).** As 5 registradas na seção "Questões abertas" seguem válidas; três viraram comportamento implementado e merecem confirmação explícita: (2) endpoints incluídos nesta story por dedução de UX-DR23 — se preferir que 14.5/14.6 os definam, remover Task 6/AC8 é reversível; (3) `closed` ampliado é mudança observável numa resposta legada, ainda que monotônica; (4) a evidência do backfill sobre dados reais é a saída do `migrate`, não um teste automatizado (exigiria `django-test-migrations`, fora de escopo).

### File List

Reconciliado contra `git status --short` + `git diff --stat` **depois** de todas as etapas de verificação (migrations em `dev`/`e2e`, regeneração de contrato, experimentos de não-vacuidade, gates) — não contra o que foi lembrado durante a implementação.

**Artefatos de TIPO NOVO tocados por esta story** (nomeados explicitamente, guardrail de processo — não basta "revisei o File List"):

- `backend/bujo/migrations/0007_weekly_monthly_cycle_status.py` — **primeira `RunPython` do repo** (o grep de `RunPython|RunSQL` em `backend/*/migrations/` não retornava nada antes), e primeira migration com função pura testável (`classify_cycle_status`).
- `backend/bujo/services/cycles.py` — módulo de serviço novo.
- `frontend/e2e/weekly-monthly-cycle.spec.ts` — **spec E2E novo**, criado no passo de QA
  (`bmad-qa-generate-e2e-tests`, 2026-07-25). **Corrige** a afirmação do dev-story "nenhum spec E2E
  novo", que era verdadeira quando escrita e ficou FALSA neste passo.
- `frontend/e2e/seedFinalizedEmptyCycle.ts` — **seed E2E novo** (ciclo `finalized` VAZIO, o caso que a
  derivação não representava).
- `_bmad-output/implementation-artifacts/tests/test-summary-14-1.md` — resumo do passo de QA.
- **Nenhum management command novo, nenhum arquivo de teste de pytest novo** — os testes de backend
  entraram em arquivos já existentes (`test_models`/`test_services`/`test_views`/`test_calendar`),
  conforme a convenção de testes por camada (§7.4). O `docs/e2e-neon-reset.md` foi alterado (nota de
  credencial desatualizada), não criado.

**NEW**

| Arquivo | Conteúdo |
|---|---|
| `backend/bujo/migrations/0007_weekly_monthly_cycle_status.py` | 4 `AddField` + 6 `AddConstraint` + `RunPython(backfill)`; `classify_cycle_status` / `current_key` puras |
| `backend/bujo/services/cycles.py` | matriz `ALLOWED`, `_CycleSpec`, 9 serviços públicos, `next_monthly_target`, `add_months`, helpers `_previous_operational`/`_has_undisposed`; **code review**: precedência do `planning` existente em `next_monthly_target` |
| `frontend/e2e/weekly-monthly-cycle.spec.ts` | **passo de QA** — 3 testes E2E: AC4 no cliente real (navegação não atribui estado, duas fases), uniques parciais + irreversibilidade no banco real da branch `e2e`, ciclo `finalized` VAZIO no Arquivo e readonly na UI (AC6) |
| `frontend/e2e/seedFinalizedEmptyCycle.ts` | **passo de QA** — `seedFinalizedEmptyWeekly` via `manage.py shell` + `tenant_context` (mesma técnica de `seedClosedCycleScenario.ts`) |
| `_bmad-output/implementation-artifacts/tests/test-summary-14-1.md` | **passo de QA** — lacunas fechadas, achados, provas de não-vacuidade, gates |

**MODIFIED**

| Arquivo | Mudança |
|---|---|
| `backend/bujo/models.py` | `CycleStatus` (módulo-level) + `_cycle_status_constraints` + 2 colunas × 2 models + 6 constraints |
| `backend/bujo/services/archive.py` | `is_cycle_closed`, `_CLOSED_BY_EITHER` (união em `list_closed_cycles`), docstring do módulo reescrito; **code review**: critério escopado por regime (`status IS NULL` no ramo derivado) |
| `backend/bujo/services/tasks.py` | `_check_container_open` usa `is_cycle_closed`; `reorder_task` passa a chamá-lo |
| `backend/bujo/serializers.py` | `_CycleFieldsMixin` (2 campos aditivos), `WEEKLY/MONTHLY_CYCLE_ACTIONS`, 4 serializers de ciclo |
| `backend/bujo/views.py` | `WeeklyCycleView`/`MonthlyCycleView` + dicts de despacho módulo-level; `status`/`planning_completed_at` nas duas respostas de log; `is_cycle_closed` |
| `backend/bujo/urls.py` | rotas `logs/weekly/cycle/` e `logs/monthly/cycle/` |
| `backend/core/calendar.py` | `month_turn_week` |
| `backend/core/exceptions.py` | `CycleTargetConflict`; docstring de `ClosedCycleReadOnly` atualizado |
| `backend/bujo/tests/factories.py` | comentários de `status=None` como default vinculante; 2 `register_isolation_case` novos (`bujo.WeeklyLog`, `bujo.MonthlyLog`) |
| `backend/bujo/tests/test_models.py` | constraints de ciclo + testes puros da migration `0007` (via `importlib`) |
| `backend/bujo/tests/test_services.py` | bloco de ciclo: matrizes, gates, idempotência, AC4, AC6; **passo de QA**: `F841` corrigido fortalecendo `test_ciclo_weekly_finalizar_aceita_semana_pulada_como_proxima` (assert de persistência); **code review**: 3 regressões novas (ciclo no regime com tudo disposto **não** é readonly ×2, legado `NULL` continua fechado, alvo mensal na janela sem `active`) + helper `_sem_escrita` provando o "sem escrita" da idempotência em SQL |
| `frontend/e2e/fixtures.ts` | **passo de QA** — `E2E_PASSWORD` exportada (o spec de ciclo precisa de JWT real em `/api/accounts/token/`, porque os endpoints ainda não têm UI); **code review**: comentário órfão reordenado (achado B1) |
| `backend/bujo/tests/test_views.py` | endpoints de ciclo (200/400/409) + caracterização do AC5; **passo de QA**: 401 sem token nos 2 endpoints, isolamento por tenant com Bearer real, ciclo de vida completo do monthly por HTTP, gate de iniciar e "sem lacuna" do monthly, idempotência no fio + fronteira "revisitável até Iniciar", AC4 na gravação em mês futuro; **code review**: `closed`/`/archive/`/`POST` de tarefa no ciclo `active` com tudo disposto |
| `backend/core/tests/test_calendar.py` | `month_turn_week` (casos + propriedades) |
| `schema.yaml` | **gerado** por `manage.py spectacular` — estritamente aditivo (0 deleções) |
| `frontend/src/api/types.gen.ts` | **gerado** por `npm run generate-types` — estritamente aditivo (0 deleções) |
| `docs/e2e-neon-reset.md` | §"credencial stale" marcada como RESOLVIDA em 2026-07-25; fallback local mantido como contingência |
| `_bmad-output/planning-artifacts/architecture.md` | adendo as-built ao fim da AD-28 (fecha o gap de spec para 14.5/14.6/14.10); **code review**: itens 3 e 5 reescritos (critério por regime; precedência do alvo mensal) |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | `14-1` → `in-progress` → `review` → `done`; `last_updated` |

`backend/conftest.py` **não** foi alterado: `bujo.tests.factories` já constava em `_ISOLATION_TEST_MODULES`, então os 2 casos de isolamento novos entram no contrato compartilhado sem edição (a Task 7 previa "se necessário").

### Change Log

| Data | Mudança |
|---|---|
| 2026-07-25 | Estado do ciclo operacional (`status` + `planning_completed_at`) adicionado a `weekly_log` e `monthly_log` com `CheckConstraint` e uniques parciais por usuário; `NULL` = fora do regime operacional (AC1). |
| 2026-07-25 | Migration `0007_weekly_monthly_cycle_status` — schema + data migration retroativa com contagens por tabela × bucket impressas pela própria migration; aplicada a `dev` e à branch Neon `e2e` (AC1, AC7). |
| 2026-07-25 | `bujo/services/cycles.py`: 9 serviços de transição idempotentes com a matriz `ALLOWED` única, gates cumulativos de Iniciar, Finalizar irreversível e predicado de "próximo ciclo" diferente por tipo (AC2, AC3). |
| 2026-07-25 | `core/calendar.month_turn_week` — janela regular da virada do mês, informativa (AC3). |
| 2026-07-25 | `finalized` passa a ser a autoridade de "ciclo fechado" via `is_cycle_closed`; fecha o buraco do ciclo finalizado **vazio**, que seguia mutável e fora do Arquivo. `reorder_task` passou a chamar o guardrail, que antes não o cobria (AC6). |
| 2026-07-25 | Dois endpoints de ação de ciclo + `status`/`planningCompletedAt` como campos aditivos nas respostas de weekly/monthly; `schema.yaml` e `types.gen.ts` regenerados com zero deleções (AC5, AC8). |
| 2026-07-25 | `CycleTargetConflict` nova em `core/exceptions.py` para a colisão das uniques parciais (409), distinta de `InvalidTransition` (AC1). |
| 2026-07-25 | Adendo as-built ao fim da AD-28 em `architecture.md` — fecha o gap de especificação (endpoints, `closed` ampliado, exceção nova, bootstrap de usuário novo, precedência futuro > derivação) para as Stories 14.5/14.6/14.10. |
| 2026-07-25 | `docs/e2e-neon-reset.md`: §"credencial stale" corrigida — resolvida em 2026-07-25, fallback local mantido como contingência. |
| 2026-07-25 | **Passo de QA** (`bmad-qa-generate-e2e-tests`): +7 test functions de API (8 testes) fechando 401/isolamento por tenant dos endpoints novos, ciclo de vida e gates do monthly por HTTP, idempotência no fio e AC4 na gravação em mês futuro; +1 spec E2E (`weekly-monthly-cycle.spec.ts`, 3 testes) e +1 seed contra a branch Neon `e2e`; `F841` do `ruff` corrigido fortalecendo um teste de serviço. Full-suite: **1094 passed**. |
| 2026-07-25 | **Code review (story-automator)**: `is_cycle_closed` passa a escolher UM critério **por regime** (estado dentro do regime, derivação só para `status IS NULL`) — a união irrestrita fechava um ciclo `planning`/`active` assim que sua última tarefa era disposta, tornando-o readonly e mandando-o ao Arquivo sem ritual, contra M06/M07; `next_monthly_target` passa a preferir o `planning` já existente, restaurando a idempotência de "Planejar próximo mês" na janela sem `active` (entre `finalize` e `start`); "sem escrita" da idempotência (AC2) passa a ser provado em SQL; adendo as-built da AD-28 (itens 3 e 5) atualizado. Full-suite: **1099 passed**. |

## Senior Developer Review (AI)

**Revisor:** HugoMMBrito (via `bmad-story-automator-review`) · **Data:** 2026-07-25 · **Baseline:** `c2ba650`
**Resultado:** **Aprovada** — 0 críticos. 1 alto + 2 médios + 1 baixo encontrados; **todos corrigidos nesta review** (auto-fix pedido na invocação).

### Alegações re-executadas (não aceitas no papel)

| Gate | Alegado nas Completion Notes | Medido na review | Veredito |
|---|---|---|---|
| Pytest full-suite, sem escopo | 1094 passed | `1094 passed in 299.30s` no HEAD recebido | ✅ confere exatamente |
| `uv run ruff check` | `All checks passed!` | `All checks passed!` | ✅ |
| `ruff format --check` vermelho em 48 arquivos **pré-existentes** | 48, nenhum adicionado pela story | 48 arquivos; os 9 arquivos da story que aparecem na lista **já apareciam no baseline** `c2ba650` (verificado extraindo cada arquivo com `git show c2ba650:` e rodando `ruff format --check --config pyproject.toml` sobre as cópias) — `cycles.py`, novo, está formatado | ✅ claim honesta |
| `schema.yaml` regenerado e em sincronia | gerado por `spectacular` | `manage.py spectacular` num arquivo temporário → `diff` **idêntico** ao `schema.yaml` commitado | ✅ |
| Aditividade estrita do contrato | 0 deleções nos dois gerados | `git diff --numstat`: `schema.yaml` **156/0**, `types.gen.ts` **141/0** | ✅ prova mecânica confere |
| File List reconciliado | tabelas NEW/MODIFIED | conferido contra `git status --short` + `git diff --stat`: nenhum arquivo de código fora da lista, nenhum item da lista sem mudança real | ✅ |
| Contagens do `migrate` (AC7) | saídas literais de `dev` e `e2e` | **não re-executável** (a `0007` já está aplicada nas duas bases; reverter dropa as colunas). Aceita pela consistência interna: 3 usuários → 3 `active` weekly + 3 `active` monthly, 1 usuário → 1 + 1 | ⚠️ aceita, não re-medida |

Não re-executado: a suíte E2E (16,7 min contra a branch Neon compartilhada). As 4 falhas de `weekly-monthly-task-crud.spec.ts` já vinham **medidas no baseline** por `git stash`, com causa-raiz nomeada (locator sem escopo × `BrainDumpCaptureSheet` portalizado da 13.3) — a evidência é do tipo que a review exige e não depende de confiança.

### Achados

**🔴→🟠 A1 (alto, corrigido) — a derivação por conteúdo fechava ciclos DENTRO do regime operacional: `planning`/`active` viravam readonly ao dispor a última tarefa.** `is_cycle_closed` era `status == finalized OR is_container_closed(log)`, aplicada a **todo** ciclo. Consequência concreta, reproduzida antes da correção: abrir o alvo da próxima semana, criar uma tarefa nela e concluí-la fazia `is_container_closed` devolver `True` — a partir daí `create_task`/`update_task`/`delete_task`/`reorder_task` naquele alvo respondiam **409 `ClosedCycleReadOnly`** e a semana aparecia em `/api/bujo/archive/` **sem nunca ter sido finalizada**. Isso contradiz o M06 literalmente ("Um Weekly **Em planejamento** permite criar, editar, reordenar, migrar, iniciar e concluir tarefas"; "a data do calendário não finaliza uma semana automaticamente"), o AC2 (só `finalized` é terminal/readonly) e o **próprio docstring** do módulo, que já declarava a derivação como "fallback read-only dos ciclos legados `status IS NULL`" — a implementação é que não a escopava. O mesmo valia para o ciclo `active`: fechar todas as tarefas da semana em andamento trancava a semana. **Corrigido:** `is_cycle_closed` escolhe **um critério por regime** — `status` não-`NULL` fecha se e somente se `finalized`; `status IS NULL` continua pela derivação, intacta —, e `_CLOSED_BY_EITHER` ganhou `status__isnull=True` no ramo derivado (os dois ramos ficam mutuamente exclusivos, então a união segue sem duplicata e sem `distinct()`). **Nenhum ciclo pré-existente muda de resposta**, porque o backfill deixou `NULL` exatamente os ciclos que a derivação governava — a "ampliação monotônica" do AC5/AC6 continua valendo para os dados legados; o que deixa de acontecer é o fechamento acidental de ciclos que a própria story acabou de criar. Regressões novas: `test_ac6_ciclo_no_regime_operacional_com_tudo_disposto_nao_e_readonly` (×2, `planning` e `active`), `test_ac6_ciclo_null_legado_com_tudo_disposto_continua_fechado_pela_derivacao` (o outro lado da regra) e `test_ciclo_em_andamento_com_tudo_disposto_nao_e_reportado_fechado` (no fio: `closed`, `/archive/` e `POST` de tarefa). **Não-vacuidade:** os dois primeiros **falharam** contra o código original (`assert is_cycle_closed(log) is False` → `assert True is False`) antes da correção.

**🟡 M1 (corrigido) — `next_monthly_target` ignorava o `planning` existente, quebrando a idempotência de "Planejar próximo mês" na janela sem `active`.** A ordem do ritual mensal é obrigatoriamente `open(X+1) → complete(X+1) → finalize(X) → start(X+1)` (finalizar exige o próximo já em planejamento), então existe uma janela real em que **não há `active`** — e nela a função caía na regra de usuário novo (mês corrente por `today_for`). Resultado: `POST {action: open_planning_target}` devolvia **409** (`CycleTargetConflict` pela unique parcial, ou `InvalidTransition` quando o mês corrente já estava `finalized`) em vez do no-op idempotente que o AC2 contrata para todos os serviços. **Corrigido** com a precedência do `planning` existente (no máximo um, garantido pela unique parcial — não há ambiguidade a resolver), antes das regras de `active` e de bootstrap. Regressão nova: `test_ciclo_monthly_alvo_na_janela_entre_finalizar_e_iniciar_e_o_planning_existente`, **provada não-vacuosa** (removida a precedência, o teste falha; restaurada, passa — `cycles.py` é untracked, então a restauração foi conferida por `grep`).

**🟡 M2 (corrigido) — o teste de idempotência prometia "sem escrita" e não exercitava isso.** O docstring de `test_ciclo_idempotencia_dos_nove_servicos` afirma "re-execução no estado-alvo = no-op, mesmo retorno, **sem escrita**", mas as asserções só comparavam valores de retorno — e os logs não têm `updated_at`, então nenhuma delas podia detectar um `UPDATE` desnecessário. É exatamente a classe de achado da retrospectiva do Épico 13 ("teste cujo nome prometia um guard que ele não exercitava"). **Corrigido** com o helper `_sem_escrita`, que roda a re-execução dentro de `CaptureQueriesContext` e afirma **zero** `INSERT`/`UPDATE`/`DELETE` no SQL capturado; as 9 re-execuções passam por ele.

**🟢 B1 (corrigido) — comentário órfão em `frontend/e2e/fixtures.ts`.** A constante `E2E_PASSWORD` foi inserida **entre** o comentário de `signUpAndLandOnToday` e a função que ele documenta, de modo que o bloco "Um usuário novo por teste… Exportada … para specs que precisam de um segundo usuário" passou a ler como documentação da senha. **Corrigido** reordenando (a constante e seu comentário vêm antes; o comentário original volta a encostar na função).

### O que resistiu ao ataque

- **A matriz de transições e os gates.** As 16 células × 2 tipos, com a distinção deliberada entre auto-transição (no-op) e transição ilegal (`InvalidTransition` + assert de não-persistência), estão corretas contra `ALLOWED`; `None → ACTIVE` ausente realmente fecha o bypass do ritual descrito no comentário — e o Experimento 2 do dev-story prova isso empiricamente, com as **duas** células afetadas falhando.
- **`_previous_operational` ignorando ciclos `NULL`** é a leitura certa do AC7: sem isso, todo usuário com semanas velhas abertas ficaria travado no primeiro uso real. O teste `..._iniciar_ignora_ciclos_null_anteriores` cobre o caso.
- **A migration `0007`.** Ordem `AddField → AddConstraint → RunPython` com as uniques **antes** do backfill; varredura restrita a quem tem linha em `weekly_log`/`monthly_log`/`tasks`; `user_id=` explícito nos `create()` (models históricos não têm o `save()` do `TenantModel`); derivação de fechado reimplementada localmente em vez de importada de `services/`; precedência `corrente > futuro > derivação` documentada como normativa e testada nos 4 buckets × 2 `kind` pela função pura.
- **A honestidade do registro.** O dev/QA corrigiu no próprio documento uma afirmação errada anterior (`ruff check` "verde" quando estava vermelho por `F841`) e a corrigiu **fortalecendo** o teste em vez de apagar a variável; as 4 falhas de E2E foram medidas no baseline em vez de estimadas; as contagens de testes são derivadas de `git diff`, não por subtração. Todas as três lições da retro do Épico 13 estão de fato endereçadas.
- **Aditividade do contrato.** `spectacular` regenerado bate byte a byte com o commitado, e as 0 deleções em `schema.yaml`/`types.gen.ts` são a prova mecânica que o AC5 pede — nenhum campo do Daily legado mudou de nome, tipo ou semântica (as caracterizações comparam o JSON de fio em camelCase, não os nomes internos dos serializers).

### Gates depois das correções

- **Pytest full-suite, sem escopo de caminho:** **1099 passed** (1094 herdados + **5 novos**: 4 test functions, uma delas parametrizada ×2 — divisão derivada de `git diff`, não por subtração).
- **`uv run ruff check`:** `All checks passed!`
- **`ruff format --check`:** segue vermelho em **48 arquivos pré-existentes** — confirmado na review como dívida global anterior à story (nenhum arquivo adicionado por ela, incluindo os tocados nesta review).
- **E2E:** não re-executado nesta review (nenhuma das correções toca UI; `frontend/e2e/fixtures.ts` mudou só na ordem de comentários e a asserção `closed: true` do ciclo `finalized` do `weekly-monthly-cycle.spec.ts` continua verdadeira pelo estado). Os seeds legados criam logs com `status` `NULL`, então as expectativas de "fechado por conteúdo" de `archive.spec.ts`/`weekly-monthly-task-crud.spec.ts` seguem valendo por construção.

### Questões abertas para o dono (nenhuma bloqueia)

As 5 da story permanecem; a de número **3** muda de forma: `closed` **não** é mais a união irrestrita, e sim um critério por regime. Para os dados que existem hoje o efeito observável é o mesmo (todo ciclo legado está `NULL`), então a mudança de contrato segue sendo apenas a **ampliação** para o ciclo `finalized` vazio. O que o dono ganha de fato é a garantia de que, a partir do regime operacional, **só o ritual fecha** — nada de fechamento acidental por conteúdo.
