---
baseline_commit: 971da7cb988da0783ce8e93745e7a53e423bdf6f
---

# Story 14.2: Fontes dos rituais e decisões-snapshot (backend)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> **Escopo:** backend puro (Django/DRF). **Nenhuma superfície de UI nova.** Os únicos arquivos de frontend tocados são `schema.yaml` e `frontend/src/api/types.gen.ts` — **gerados**, nunca editados à mão (guardrail de CI).
>
> **Autoridade de forma:** `AD-28` item 6 do `architecture.md` decide a modelagem de `ritual_decisions` (tabela própria, âncoras exclusivas, uniques parciais por combinação, progresso derivado). **Não redecidir.** **Autoridade de produto** (quais fontes, ordem, elegibilidade, o que conta no progresso, o que a densidade conta): spines **M06/M07** no `EXPERIENCE.md` — os spines vencem qualquer conflito.
>
> **Dependência satisfeita:** Story 14.1 (`done` 2026-07-25) entregou `status`/`planning_completed_at` em `weekly_log`/`monthly_log`, `bujo/services/cycles.py`, `is_cycle_closed` e os 2 endpoints de ação de ciclo. Esta story **consome** aquele estado e **não** o altera.

## Story

Como Hugo,
Quero as fontes de planejamento (Monthly na semana, recorrentes, Weekly anterior, Daily pendentes, Future Log, Monthly anterior) agregadas por endpoints independentes com registro de decisão por item,
Para que os rituais Semana/Mês operem com progresso real e retomável (UX-DR23; EXPERIENCE M06/M07).

## Acceptance Criteria

### AC1 — `ritual_decisions`: tabela própria com âncoras exclusivas e unicidade no banco

**Dado que** a forma decidida na AD-28 item 6 (um registro por *ritual-alvo × item*, **só** para decisões que não mutam o item),
**Quando** a migration nomeada cria `ritual_decisions`,
**Então** a tabela tem âncora **exclusiva** do alvo (`weekly_log_id` **XOR** `monthly_log_id`) e do item (`task_id` **XOR** `recurring_template_id`), ambas impostas por `CheckConstraint` no estilo *exactly-one* já usado em `Task.Meta` (`task_exactly_one_log`), mais `decision` como `TextChoices` + `CheckConstraint` com exatamente os três valores `keep | skip_week | keep_undated`,
**E** a unicidade `(alvo, item)` é garantida por **`UniqueConstraint` parciais por combinação** — uma por par (`weekly_log`,`task`), (`weekly_log`,`recurring_template`), (`monthly_log`,`task`), (`monthly_log`,`recurring_template`) —, de modo que re-decidir é **upsert no serviço**, nunca segunda linha,
**E** o model é `TenantModel` de pleno direito: `objects = TenantManager()` declarado **primeiro**, entrada nova em `purge_e2e_users.TENANT_MODELS` **e** no espelho `test_purge_e2e_users.py`, e caso registrado no contrato compartilhado de isolamento via `register_isolation_case` em `bujo/tests/factories.py`,
**E** a migration é aplicada à branch Neon `e2e` **antes** de qualquer execução de Playwright.

### AC2 — Matriz de decisões válidas por (alvo × item), upsert idempotente, Task jamais tocada

**Dado que** os spines nomeiam **exatamente três** decisões sem mutação, cada uma amarrada a um contexto (M06/M07),
**Quando** `POST /api/bujo/ritual-decisions/` recebe uma decisão,
**Então** o serviço impõe uma **matriz única** de combinações legais — `keep` só em (alvo **weekly** × **Task**, a fonte "Monthly na semana"); `skip_week` só em (alvo **weekly** × **RecurringTaskTemplate**); `keep_undated` só em (alvo **monthly** × **Task**, a fonte Future Log) — e **qualquer** outra combinação levanta `InvalidRitualDecision` (409): não existe "Não alocar neste mês" para anual (M07, explícito) e o Weekly anterior **não oferece "manter"** (M06, explícito),
**E** o alvo precisa **existir** e estar com `status == 'planning'`: decisão contra alvo `NULL`/`active`/`finalized` ou contra log inexistente é `InvalidTransition` (409) — decisão-snapshot é ato de ritual, e o ritual só existe no alvo em planejamento,
**E** o serviço é `@transaction.atomic`, assinatura `def upsert_ritual_decision(*, user, ...)`, **idempotente** (re-executar com a mesma tupla não escreve e devolve o mesmo registro) e **nunca** toca a `Task`/`RecurringTaskTemplate` — nenhum campo do item muda, nenhum `status`, nenhum `scheduled_date`,
**E** decisões **mutantes** (migrar/alocar/concluir/cancelar/adiar) **não** ganham registro em `ritual_decisions`: a própria mutação é a persistência (AD-28 item 6 — "registrar em dobro criaria segunda verdade"), e o item simplesmente deixa de ser elegível na re-derivação da fonte.

### AC3 — Fontes do ritual semanal: quatro endpoints independentes com a elegibilidade do M06

**Dado que** as fontes do M06 em **ordem fixa** com navegação livre,
**Quando** os endpoints de fonte do ritual semanal são implementados sob `GET /api/bujo/rituals/weekly/sources/<fonte>/?week_start=`,
**Então** existem **quatro** fontes, cada uma num endpoint próprio (carrega/falha isolada — AC7):
1. **`monthly-in-week`** — tarefas `pending`/`started` com `scheduled_date` dentro de `[weekStart, weekStart+6]` ancoradas em **monthly_log**, incluindo **os dois** Monthly quando a semana cruza meses (via `core.calendar.months_of_week`); conta no progresso; aceita `keep`;
2. **`recurring`** — **todos** os templates `weekly` **ativos**, ordenados alfabeticamente por `recurrence_text`, separados em **pendentes** (sem instância no weekly-alvo e sem decisão `skip_week` para esse alvo) e **`alreadyPlaced`** (com ≥1 instância no alvo) — `alreadyPlaced` permanece consultável e **fora** do progresso, e novas instâncias (inclusive duplicadas no mesmo dia) continuam permitidas: **nenhuma** constraint de template × dia;
3. **`previous-weekly`** — somente `pending`/`started` do **Weekly operacional imediatamente anterior** ao alvo, obtido reusando o helper de 14.1 (`_previous_operational`, promovido a função pública — **não** duplicar a query, **não** assumir `weekStart − 7 dias`); é a **única fonte bloqueante** do ritual semanal (`blocking: true`) e expõe `readyToFinalize` quando zera;
4. **`pending-dailies`** — todos os Daily Logs não resolvidos com `log_date < weekStart`, **agrupados por data** e ordenados do mais antigo ao mais recente; informativa, nunca bloqueante,

**E** **"Monthly ampliado"** (fonte 2 do spine — mês anterior/futuro navegável, opcional) **não ganha endpoint novo**: é servido pelo `GET /api/bujo/logs/monthly/?month_first=` existente e está **fora do denominador** do progresso por decisão do spine — a story registra isso explicitamente em vez de inventar uma quinta rota.

### AC4 — Fontes do ritual mensal: três endpoints, elegibilidade anual sem parsing

**Dado que** as três fontes do M07 em ordem fixa (recorrentes → Future Log → Monthly anterior),
**Quando** os endpoints são implementados sob `GET /api/bujo/rituals/monthly/sources/<fonte>/?month_first=`,
**Então**:
1. **`recurring`** — templates `monthly` ativos **primeiro**, depois `annual` ativos **ainda sem instância no ano do Monthly-alvo**; a elegibilidade anual é `exclude(instances__monthly_log__month_first__year=<ano do alvo>)` — a **mesma** regra já implementada em `RecurringTaskTemplateListView` (`?unplaced_year`), reusada, **jamais** parseando `recurrence_text`; `alreadyPlaced` (mensal, instância no alvo) e `alreadyPlacedInYear` (anual, instância no ano) ficam **fora** do progresso e dos avisos;
2. **`future-log`** — `pending`/`started` raiz **já pertencentes ao monthly-alvo** (data preservada ou `scheduled_date IS NULL`), ordenados dia → sem-dia; aceita `keep_undated`; **concluir/cancelar não existem nesta fonte** (o backend não precisa impedir uma transição feita por outro endpoint, mas **não** oferece a decisão aqui);
3. **`previous-monthly`** — somente `pending`/`started` do **Monthly operacional imediatamente anterior** ao alvo (mesmo helper público de 14.1), **única fonte bloqueante** do ritual mensal, com `readyToFinalize` quando zera,

**E** a **regra de dezembro** ("em dezembro somente o próprio mês-alvo resolve a pendência anual") é **emergente** da elegibilidade por ano-alvo — não existe mês posterior dentro do mesmo ano — e **nenhum código especial de dezembro é escrito**; a story documenta a dedução e um teste-âncora a prova,
**E** o planejamento mensal **nunca** envia tarefa diretamente ao Weekly: nenhuma fonte mensal oferece destino semanal.

### AC5 — Progresso e "revisada" derivados por fonte, nunca contador armazenado

**Dado que** a AD-28 item 6 exige progresso **derivado** (elegíveis − mutados − decididos),
**Quando** qualquer endpoint de fonte responde,
**Então** ele devolve `eligibleCount`, `pendingDecisionCount` e `reviewed` **computados na leitura** — nenhuma coluna de contador, nenhum campo de progresso em `weekly_log`/`monthly_log`, nenhum cache —, e cada item carrega `decision` (o valor da decisão-snapshot vigente para aquele alvo, ou `null`),
**E** `reviewed` é `pendingDecisionCount == 0` — **fonte vazia é revisada** (M06/M07),
**E** o campo `countsTowardProgress` marca o que entra no denominador: **`false`** para os buckets `alreadyPlaced`/`alreadyPlacedInYear` e para o Monthly ampliado (que não é endpoint desta story); **`true`** para as demais fontes,
**E** a chegada de item novo numa fonte já revisada **não** revoga o marco de planejamento: `planning_completed_at` **jamais** é limpo por esta story (M06/M07 — "novos itens preservam o marco anterior e reativam o aviso da fonte"; o aviso é derivado de `reviewed`, não persistido).

### AC6 — Week/Month Density: só materializado, com subtarefas, segmentado por todos os status

**Dado que** a densidade real dos rails (M06 L241 / M07 L299) e o AC do épico ("contam somente registros materializados no alvo, incluindo subtarefas, segmentados por todos os status — recorrentes não alocados nunca aparecem como projeção"),
**Quando** `GET /api/bujo/rituals/weekly/density/?week_start=` e `GET /api/bujo/rituals/monthly/density/?month_first=` respondem,
**Então** contam **exclusivamente** `Task` já materializadas **no container-alvo** (`weekly_log` = alvo / `monthly_log` = alvo) — nada de projetar recorrentes não alocados, nada de somar tarefas de outros containers,
**E** **incluem subtarefas** (sem filtro `parent_task__isnull=True` — o **oposto** de todas as superfícies de listagem) e **segmentam por todos os 6 status** (`byStatus` com as 6 chaves sempre presentes, valor `0` inclusive),
**E** a grade é **completa**: weekly devolve os **7** dias (vazios visíveis) + a faixa **`undated`** (`scheduled_date IS NULL`); monthly devolve **todos** os dias reais do mês (28–31, bissexto incluído) + `undated`,
**E** o resumo **conta registros, não linhagens**: origem `migrated` e sucessor contam separadamente, sem deduplicação,
**E** o endpoint legado `GET /api/bujo/task-density/` fica **intocado** em rota, forma e semântica (é consumido por `frontend/src/features/bujo/api.ts`) — a densidade nova é endpoint **novo**, jamais um "conserto" do antigo,
**E** a densidade **não** exige alvo em planejamento: aceita qualquer log existente (`planning`/`active`/`finalized`/`NULL`) para que 14.5/14.6/14.10 a reusem, e devolve a grade **vazia** quando o log não existe.

### AC7 — Independência de carga/falha, zero materialização na leitura, isolamento por tenant

**Dado que** "fontes carregam/falham independentemente" é requisito de **API**, não de UI (M06 L251, M07 L309, State Pattern *Partial source error*),
**Quando** as fontes são consultadas,
**Então** cada fonte é **uma requisição própria** e não existe endpoint agregador que junte fontes numa resposta só — uma fonte com erro não pode derrubar as demais, e isso é estrutural, não um `try/except`,
**E** **nenhum** endpoint desta story materializa log: sempre `Model.objects.filter(...).first()` (o padrão explícito de `MigrationQueueView`), **nunca** `get_or_create_*_log` — consultar uma fonte ou a densidade não pode criar ciclo nem sair do regime `NULL` (guardrail da AC4 da Story 14.1),
**E** todo acesso usa o manager auto-escopado `objects` (**nunca** `all_objects`), com teste de isolamento por tenant para cada endpoint novo (usuário B não vê nada do usuário A) e `401` sem token.

### AC8 — Contrato legado preservado e aditividade estrita do contrato gerado

**Dado que** o Daily legado permanece plenamente utilizável até o Épico 17 (premissa blindada),
**Quando** esta story entrega,
**Então** **nenhum** endpoint existente muda de rota, campo ou semântica — em especial `/api/bujo/task-density/`, `/api/bujo/future-log/`, `/api/bujo/recurring-templates/`, `/api/bujo/weekly-review/queue/`, `/api/bujo/monthly-review/queue/`, `/api/bujo/migration/queue/`, `/api/bujo/catch-up/queue/`, `/api/bujo/logs/weekly/` e `/api/bujo/logs/monthly/` —, provado por testes de caracterização sobre o JSON de fio (camelCase),
**E** os aliases de fila permanecem intactos (a unificação é a 14.3 — **nada** de fila unificada aqui),
**E** `schema.yaml` e `frontend/src/api/types.gen.ts` são regenerados e commitados com **0 deleções** (prova mecânica de aditividade estrita, via `git diff --numstat`).

## Tasks / Subtasks

- [x] **Task 1 — Model `RitualDecision` + enum + constraints** (AC: 1, 2)
  - [x] Em `backend/bujo/models.py`, criar `class RitualDecisionKind(models.TextChoices)` **no nível do módulo** (mesmo motivo já documentado em `TaskStatus`/`CycleStatus`: classe aninhada não é visível de `Meta`): `KEEP = "keep"`, `SKIP_WEEK = "skip_week"`, `KEEP_UNDATED = "keep_undated"`. Expor como `RitualDecision.Decision = RitualDecisionKind`.
  - [x] `class RitualDecision(TenantModel)` com FKs **todas** `null=True`, `on_delete=models.CASCADE`: `weekly_log`, `monthly_log`, `task`, `recurring_template` (aponta para `RecurringTaskTemplate`). `related_name` explícitos e distintos de `"tasks"`/`"instances"` — use `related_name="ritual_decisions"` nos quatro (nomes iguais em models diferentes não colidem).
  - [x] `decision = models.CharField(max_length=16, choices=RitualDecisionKind.choices)` (NOT NULL, **sem** default) + `created_at = auto_now_add`, `updated_at = auto_now` (o par existe em `Task`; aqui é útil para provar upsert sem escrita).
  - [x] `Meta`: `db_table = "ritual_decisions"` (plural — a AD-28 nomeia assim; a divergência do singular vale só para `weekly_log`/`monthly_log`, preexistente).
  - [x] Constraints, nomes exatos:
    - `CheckConstraint(condition=Q(weekly_log__isnull=False, monthly_log__isnull=True) | Q(weekly_log__isnull=True, monthly_log__isnull=False), name="ritual_decision_exactly_one_target")`
    - `CheckConstraint(condition=Q(task__isnull=False, recurring_template__isnull=True) | Q(task__isnull=True, recurring_template__isnull=False), name="ritual_decision_exactly_one_item")`
    - `CheckConstraint(condition=Q(decision__in=RitualDecisionKind.values), name="ritual_decision_valid")`
    - 4 uniques **parciais** por combinação: `UniqueConstraint(fields=["weekly_log", "task"], condition=Q(weekly_log__isnull=False, task__isnull=False), name="uniq_ritual_decision_weekly_task")` e as 3 análogas (`weekly_recurring`, `monthly_task`, `monthly_recurring`). Use `condition=` (Django 5.2; `check=` está deprecado) — espelhe a forma de `_cycle_status_constraints` (`bujo/models.py:49-76`) e o precedente de `medications/models.py:233-244`.
  - [x] **Não** adicionar coluna de progresso/contador em lugar nenhum (AD-28 item 6: progresso é derivado).
  - [x] Espelhar o *exactly-one* de `Task.Meta` (`task_exactly_one_log`, `bujo/models.py:245-252`) na **forma**, sem copiar texto — o padrão é AD-03/AD-20.

- [x] **Task 2 — Migration + obrigações de novo model tenant-scoped** (AC: 1)
  - [x] `backend/bujo/migrations/0008_ritual_decisions.py` (`--name` descritivo obrigatório, uma migration por story; `dependencies = [("bujo", "0007_weekly_monthly_cycle_status")]`). **Sem `RunPython`** — não há dado retroativo: decisões-snapshot nascem com o ritual.
  - [x] `backend/bujo/management/commands/purge_e2e_users.py:35` — acrescentar `RitualDecision` a `TENANT_MODELS` (o comentário nas linhas 32-34 diz literalmente que todo model tenant-scoped novo PRECISA entrar aqui) **e** espelhar em `backend/bujo/tests/test_purge_e2e_users.py:34`. **Ordem de purga importa:** `RitualDecision` referencia `Task`/logs por FK `CASCADE`, então precisa ser purgada **antes** (ou depender do CASCADE) — verifique a ordem real da lista e teste.
  - [x] `backend/bujo/tests/factories.py` — `RitualDecisionFactory` no padrão `Params.user = SubFactory(UserFactory)` + `user_id = SelfAttribute("user.id")`, **datas fixas + `timedelta`** (o guardrail de AST de tempo também varre `factories.py`), e `register_isolation_case("bujo.RitualDecision", make=...)` **sem** `user_id` no `make` (padrão de `bujo.RecurringTaskTemplate`, `factories.py:129-136`). `backend/conftest.py` **não** precisa mudar: `bujo.tests.factories` já está em `_ISOLATION_TEST_MODULES`.
  - [x] O guardrail `core/tests/test_guardrails.py:40-52` (todo model tenant tem `objects`/`default_manager` = `TenantManager`) pega o model novo automaticamente — confirme que passa sem edição.

- [x] **Task 3 — Exceção nova + serviço de decisão** (AC: 2)
  - [x] `backend/core/exceptions.py`: `class InvalidRitualDecision(DomainError)` com docstring citando AD-28 item 6 e a matriz do M06/M07 → 409 pelo handler central. **Justificativa de ser exceção nova** (registrar no docstring): não é transição de estado ilegal (`InvalidTransition`) nem disputa de alvo (`CycleTargetConflict`) — é combinação `(alvo, item, decisão)` que o produto não define.
  - [x] `backend/bujo/services/rituals.py` **novo**. `ALLOWED_DECISIONS` como **estrutura única no nível do módulo** mapeando `decision → (tipo de alvo, tipo de item)`:
    ```python
    ALLOWED_DECISIONS = {
        RitualDecisionKind.KEEP: ("weekly", "task"),            # M06 fonte 1 (Monthly na semana)
        RitualDecisionKind.SKIP_WEEK: ("weekly", "template"),   # M06 fonte 3 (recorrentes weekly)
        RitualDecisionKind.KEEP_UNDATED: ("monthly", "task"),   # M07 fonte 2 (Future Log)
    }
    ```
    Espelha o padrão `ALLOWED` de `state_machine.py`/`cycles.py`: matriz única, no serviço, nunca em serializer.
  - [x] `upsert_ritual_decision(*, user, decision, week_start=None, month_first=None, task_id=None, recurring_template_id=None) -> RitualDecision`, `@transaction.atomic`:
    - valida exatamente-um alvo e exatamente-um item **antes** de tocar o banco (o CHECK é rede de segurança, não a validação);
    - consulta a matriz → `InvalidRitualDecision` na combinação ilegal;
    - resolve o log-alvo por `objects.filter(...).first()` — **nunca** `get_or_create` — e exige `status == CycleStatus.PLANNING`, senão `InvalidTransition(status_atual, "ritual_decision")`;
    - resolve o item pelo manager escopado (item de outro tenant = inexistente → 409/404 coerente com o repo: levante `InvalidRitualDecision` com mensagem neutra, **sem** revelar existência);
    - **idempotência real:** se já existe registro com a mesma tupla **e** o mesmo `decision`, devolve sem escrever (nenhum `UPDATE`, `updated_at` preservado); mudança de `decision` para a mesma tupla é `UPDATE` de uma linha (não é caso possível hoje, dado que a matriz dá uma única decisão por combinação — implemente de todo modo e documente);
    - captura `IntegrityError` da unique parcial e re-levanta como `CycleTargetConflict`? **Não** — aqui a colisão é corrida de upsert do mesmo par; capture e **re-leia** o registro (upsert), devolvendo-o. Documente a escolha.
    - **jamais** escreve na `Task`/`RecurringTaskTemplate` (nenhum `save`, nenhum `set_lineage_fields`).
  - [x] `decisions_for_target(*, weekly_log=None, monthly_log=None) -> tuple[dict, dict]` — devolve `(por_task_id, por_template_id)` numa **única** query, para que cada fonte anote `decision` nos itens sem N+1. Função de leitura; mantenha `user` na assinatura por uniformidade com o resto do módulo mesmo que o manager já escope.
  - [x] Delete de item **não** deixa decisão órfã: as FKs são `CASCADE`, então o hard delete de uma `Task` `pending` (`delete_task`) ou a remoção de um template levam a decisão embora. Cobrir com um teste — é o tipo de invariante que ninguém confere depois.

- [x] **Task 4 — Serviços das fontes do ritual semanal** (AC: 3, 5, 7)
  - [x] Ainda em `bujo/services/rituals.py`, quatro funções de leitura, **uma por fonte** (nenhuma função "todas as fontes" — a independência é estrutural, AC7). Todas: `objects` escopado, `parent_task__isnull=True` (raízes; subtarefas vão aninhadas no `TaskSerializer`), `UNDISPOSED` importado de `services/archive.py` (**não** redeclarar a tupla `("pending","started")` — ela já existe em `archive.py:30` e `cycles.py` a reusa).
  - [x] `list_monthly_tasks_in_week(*, user, week_start)` — `Task.objects.filter(monthly_log__month_first__in=<meses da semana>, scheduled_date__range=(week_start, week_start + 6 dias), status__in=UNDISPOSED, parent_task__isnull=True)`. Os meses vêm de `core.calendar.months_of_week(week_start)`, que devolve um `set[tuple[int, int]]` com **2** elementos na semana de virada — exatamente o "incluindo ambos os Monthly quando cruza meses" do M06; converta para chaves de log com `[date(y, m, 1) for y, m in months_of_week(week_start)]`. Fim da semana = `week_start + timedelta(days=6)` (não existe `week_end_of` em `core/calendar.py`; o `+6` é inline em vários pontos do repo). Ordenar por `scheduled_date`, depois `order_index`.
  - [x] `list_weekly_recurring_candidates(*, user, week_start)` — templates `active=True, recurrence_group="weekly"`, `order_by("recurrence_text")` (a ordem alfabética que o M06 exige **já** é o default de `RecurringTaskTemplateListView`, `views.py:194`). Particionar em `pending` × `already_placed` por existência de instância **no weekly-alvo**: `instances__weekly_log__week_start=week_start` (o reverso de `Task.source_template` é `instances`, `models.py:229-235`). Um template com `skip_week` para o alvo continua em `pending` na lista, mas com `decision="skip_week"` — e portanto **fora** de `pendingDecisionCount`.
  - [x] `list_previous_weekly_pendings(*, user, week_start)` — o log anterior vem de **um helper público novo em `cycles.py`** (ex.: `previous_operational_weekly(*, user, week_start)`) que delega ao `_previous_operational(_WEEKLY, key=week_start)` já existente (`cycles.py:134-149`). **Proibido** reimplementar a query e **proibido** assumir `week_start - 7 dias`: se a fonte bloqueante divergir do log que o gate de `start_weekly` consulta, a UI mostra "pronta para finalizar" enquanto o Iniciar responde 409. Devolver também `ready_to_finalize` = `not _has_undisposed(previous)` (helper de `cycles.py:152-158`, promover a público junto). Log anterior ausente ⇒ fonte vazia, `blocking: true`, `readyToFinalize: false` — e o gate de Iniciar passa por vacuidade (é o comportamento contratado na AC7 da 14.1).
  - [x] `list_pending_daily_groups(*, user, week_start)` — Daily Logs com ≥1 raiz `pending`/`started` e `log_date < week_start`, agrupados por data, **ordem crescente** (mais antigo → mais recente). Uma query só para as tarefas (`log__log_date__lt=week_start`, ordenada por `log__log_date`, `order_index`) e agrupamento em Python — **não** N+1 por log.
  - [x] Todas as quatro anotam `decision` por item via `decisions_for_target` (uma query), e devolvem estruturas puras (dicts/dataclasses), **não** `Response`.

- [x] **Task 5 — Serviços das fontes do ritual mensal** (AC: 4, 5, 7)
  - [x] `list_monthly_recurring_candidates(*, user, month_first)` — dois blocos na ordem do M07: (a) `monthly` ativos, particionados por instância **no monthly-alvo** (`instances__monthly_log__month_first=month_first`); (b) `annual` ativos, elegíveis = `exclude(instances__monthly_log__month_first__year=month_first.year)` — **a mesma expressão** de `views.py:209`; os não-elegíveis vão para `already_placed_in_year`. Dentro de cada bloco, `order_by("recurrence_text")`. **Nunca** parsear `recurrence_text` (AD-08 item 4; M07 explícito).
  - [x] Escrever, em comentário no serviço, a dedução da **regra de dezembro**: a elegibilidade por ano-alvo já a implementa (não há mês posterior no mesmo ano quando o alvo é dezembro) — nenhum `if month == 12`.
  - [x] `list_future_log_items(*, user, month_first)` — raízes `pending`/`started` do **monthly-alvo**, ordenadas `scheduled_date` ascendente com **nulos ao final** (`F("scheduled_date").asc(nulls_last=True)` — M08 "ordenação dia→sem-dia"), depois `order_index`. **Exclusão deliberada** (ver Dev Notes, ambiguidade #2): sucessores cujo predecessor vive no **monthly operacional imediatamente anterior** — `exclude(migrated_from__monthly_log=<log anterior>)` — para que o que a fonte "Monthly anterior" acabou de migrar para o alvo não volte à fila do Future Log como item indeciso. `migrated_from` é o `related_name` reverso de `Task.migrated_to_task` (`models.py:210-216`).
  - [x] `list_previous_monthly_pendings(*, user, month_first)` — mesmo desenho do `previous-weekly`, com `previous_operational_monthly(*, user, month_first)` público em `cycles.py`; `blocking: true`; `ready_to_finalize`.
  - [x] **Nenhuma** fonte mensal expõe destino semanal (M07: "O planejamento mensal nunca envia uma tarefa diretamente ao Weekly").

- [x] **Task 6 — Densidade real (módulo novo)** (AC: 6)
  - [x] `backend/bujo/services/density.py` **novo** (módulo por agregado; a densidade será reusada pelos boards das 14.5/14.6 e pelo Arquivo da 14.10, não é exclusiva do ritual).
  - [x] `compute_week_density(*, user, week_start) -> dict` e `compute_month_density(*, user, month_first) -> dict`. Regras **vinculantes**:
    - container-alvo apenas: `weekly_log=<alvo>` / `monthly_log=<alvo>`; log ausente ⇒ grade completa com zeros;
    - **sem** filtro `parent_task` (subtarefas contam — o oposto de todas as listagens e de `TaskDensityView`);
    - agrupar por `scheduled_date` **e** `status` numa única query (`.values("scheduled_date", "status").annotate(count=Count("id"))`);
    - grade completa: 7 dias do `week_start` / todos os dias reais do mês (use `calendar.monthrange` da stdlib ou aritmética com `add_months` de `cycles.py:73-76`; bissexto cai fora por construção), cada dia com `total` e `by_status` contendo **as 6 chaves** de `TaskStatus` (zeros inclusive);
    - faixa `undated` = `scheduled_date IS NULL`, mesma forma;
    - `total` geral = soma dos dias + `undated`;
    - **zero projeção**: nada de recorrentes, nada de outros containers, nada de dedup de linhagem (origem `migrated` e sucessor contam separadamente).
  - [x] **Não tocar** `TaskDensityView` nem seus serializers (`serializers.py:322-343`) — contrato legado consumido pelo frontend (`frontend/src/features/bujo/api.ts:520`, query key em `frontend/src/api/keys.ts:28-29`).

- [x] **Task 7 — Serializers, views e rotas** (AC: 2–8)
  - [x] `backend/bujo/serializers.py`:
    - `RitualDecisionCreateSerializer` — `decision` (`ChoiceField` sobre `RitualDecisionKind.choices`), `week_start`/`month_first` (`DateField`, opcionais), `task_id`/`recurring_template_id` (`UUIDField`, opcionais) — no **corpo**, portanto chegam como `weekStart`/`taskId` no fio e o `CamelCaseJSONParser` faz a conversão, com `validate()` cruzado exigindo **exatamente um** alvo e **exatamente um** item (400 para forma inválida; a **matriz** de combinação é 409 no serviço — a distinção é deliberada: forma é validação, combinação é regra de produto);
    - `RitualDecisionSerializer` de resposta — `id, decision, week_start|month_first, task_id|recurring_template_id, created_at, updated_at`;
    - **envelope uniforme de fonte:** `source_id`, `blocking`, `counts_toward_progress`, `eligible_count`, `pending_decision_count`, `reviewed`, `items`. **Sem campo `label`**: a cópia pt-BR é do UI (DESIGN/EXPERIENCE), não do backend — decisão registrada em Dev Notes;
    - item de tarefa = `{"task": TaskSerializer, "decision": <str|null>}`; item de template = `{"template": RecurringTaskTemplateSerializer, "decision": <str|null>, "instances_in_target_count": int}`. **Proibido** adicionar `decision` ao `TaskSerializer`: decisão é relativa a um alvo, e o `TaskSerializer` é compartilhado por ~10 respostas legadas (mudaria contrato — AC8);
    - variações por fonte: `recurring` acrescenta `already_placed` (e `already_placed_in_year` no mensal); `pending-dailies` usa `groups: [{date, items}]` em vez de `items` plano; `previous-*` acrescentam `ready_to_finalize`;
    - serializers de densidade: `by_status` como objeto de 6 chaves (as chaves de valor `pending`/`started`/… **não** têm underscore, então a camelização de saída não as altera — verifique no teste de fio).
  - [x] `backend/bujo/views.py` — uma `APIView` por endpoint, **finas** (query serializer valida → serviço → serializer de resposta), `@extend_schema` com `parameters=[<QuerySerializer>]` e `responses=` em **todas**. `DjangoFilterBackend` não se aplica (tudo é `APIView`).
  - [x] `backend/bujo/urls.py` — rotas novas (kebab-case, barra final, `name="bujo-…"`):
    ```
    rituals/weekly/sources/monthly-in-week/     bujo-ritual-weekly-monthly-in-week
    rituals/weekly/sources/recurring/          bujo-ritual-weekly-recurring
    rituals/weekly/sources/previous-weekly/    bujo-ritual-weekly-previous-weekly
    rituals/weekly/sources/pending-dailies/    bujo-ritual-weekly-pending-dailies
    rituals/weekly/density/                    bujo-ritual-weekly-density
    rituals/monthly/sources/recurring/         bujo-ritual-monthly-recurring
    rituals/monthly/sources/future-log/        bujo-ritual-monthly-future-log
    rituals/monthly/sources/previous-monthly/  bujo-ritual-monthly-previous-monthly
    rituals/monthly/density/                   bujo-ritual-monthly-density
    ritual-decisions/                          bujo-ritual-decision-create
    ```
  - [x] **Query params em `snake_case`** — `?week_start=`, `?month_first=`. Esta é a convenção **vigente e verificada** do repo: `TaskDensityQuerySerializer` usa `month_first` e o cliente manda snake_case com o comentário explícito "snake_case no fio, igual a fetchMonthlyLog/fetchWeeklyLog" (`frontend/src/features/bujo/api.ts:194,259,522`). A camelização do `djangorestframework-camel-case` cobre **corpo** (parser/renderer), **não** query string; o único param camelCase do repo é `waitingOn`, e ele é assim porque é um `BooleanFilter` de `django-filter` (`filters.py:26`), não um query serializer. **Não** inventar uma segunda convenção. O **corpo** do `POST /ritual-decisions/` e **todas as respostas** seguem camelCase pelo parser/renderer (`weekStart`, `taskId`, `byStatus`…).
  - [x] Validar `week_start` como segunda-feira e `month_first` como dia 1 no query serializer (400) — mesmo espírito de `TaskDensityQuerySerializer` (`serializers.py:322-334`), que já valida "deve ser dia 1".
  - [x] Regenerar o contrato: `cd backend && uv run python manage.py spectacular --file ../schema.yaml`; `cd frontend && nvm use 22.15.1 && npm run generate-types`; `npx tsc --noEmit`. Commitar `schema.yaml` **e** `frontend/src/api/types.gen.ts`. Se o enum novo colidir com um `*Enum` já existente no schema, fixe em `SPECTACULAR_SETTINGS.ENUM_NAME_OVERRIDES` (`config/settings/base.py:196-218`, precedente `"TypeEnum"`).

- [x] **Task 8 — Testes** (AC: 1–8)
  - [x] `bujo/tests/test_models.py`: as 4 uniques parciais (2ª linha do mesmo par ⇒ `IntegrityError`; pares diferentes coexistem); os 2 CHECKs *exactly-one* (dois alvos ⇒ erro; zero alvos ⇒ erro; idem itens); `decision` inválida barrada pelo CHECK.
  - [x] `bujo/tests/test_services.py`:
    - **matriz exaustiva** de `(decisão × tipo de alvo × tipo de item)` via `itertools.product` — 3 × 2 × 2 = 12 células, 3 legais e 9 ilegais; ilegal levanta `InvalidRitualDecision` **e não persiste** (estilo de `test_ciclo_weekly_matriz_completa`, `test_services.py:1571-1616`);
    - alvo em cada `status` (`NULL`/`planning`/`active`/`finalized`) e alvo inexistente: só `planning` passa;
    - **idempotência provada em SQL** com o helper `_sem_escrita` (já existe em `test_services.py`, criado na review da 14.1 — **reuse**, não recrie): re-upsert não emite `INSERT`/`UPDATE`/`DELETE`;
    - **a Task não é tocada**: snapshot de todos os campos do item antes/depois (não só `status`);
    - elegibilidade por fonte, um teste por regra do spine: semana de virada trazendo **os dois** Monthly; `alreadyPlaced` fora do progresso; `skip_week` tirando o template de `pendingDecisionCount` sem desativá-lo; previous-weekly usando o **anterior operacional** (com um ciclo `NULL` no meio, que deve ser ignorado — espelha `..._iniciar_ignora_ciclos_null_anteriores`); daily groups em ordem crescente; anual elegível sem instância no ano-alvo **e** anual com instância em **mês futuro** do mesmo ano saindo da elegibilidade (é o caso que prova "sem parsing" e a regra do ano); **dezembro** resolvendo só no próprio mês;
    - Future Log source **não** reapresentando o sucessor recém-migrado do Monthly anterior (a exclusão da Task 5);
    - `reviewed` verdadeiro em fonte **vazia**;
    - densidade: subtarefas contadas (o teste que falha se alguém copiar `parent_task__isnull=True` do `TaskDensityView`), 6 chaves de status sempre presentes, dias vazios presentes, `undated` separado, fevereiro **bissexto** com 29 dias, origem `migrated` + sucessor contando **duas** vezes, recorrente não alocado contando **zero**, log ausente ⇒ grade zerada;
    - **zero materialização**: chamar toda fonte e as duas densidades para chaves sem log e assertar que `WeeklyLog`/`MonthlyLog`/`Log` **não** ganharam linhas (o guardrail da AC4 da 14.1, agora do lado da leitura).
  - [x] `bujo/tests/test_views.py`: `401` sem token em **todos** os 10 endpoints novos; isolamento por tenant com Bearer real (padrão de `test_views.py:39-57`); `400` de forma (dois alvos, nenhum item, `week_start` que não é segunda, `month_first` que não é dia 1); `409` da matriz e do alvo fora de `planning`; **caracterização da AC8** — o conjunto de chaves das 9 respostas legadas nomeadas na AC8 permanece idêntico.
  - [x] `bujo/tests/test_serializers.py`: forma camelCase do envelope de fonte e do `byStatus` no fio.
  - [x] `bujo/tests/test_purge_e2e_users.py`: `RitualDecision` na lista espelho + purga efetiva de uma decisão.
  - [x] **Prova de não-vacuidade** (guardrail de processo, experimentos **separados** e documentados nas Debug Log References): (a) reverta o `include` de subtarefas na densidade → o teste de subtarefa falha; (b) reverta a exclusão do sucessor no Future Log → o teste correspondente falha; (c) reverta a precedência do "anterior operacional" para `week_start − 7 dias` → o teste do ciclo `NULL` intermediário falha. Restaurar e confirmar `git diff --stat` limpo nos arquivos de produção.

- [x] **Task 9 — Migration aplicada e gates** (AC: 1, 8)
  - [x] Banco `dev`: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.dev uv run python manage.py migrate` — colar a saída literal.
  - [x] Branch Neon `e2e`, **antes** do Playwright: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.e2e uv run python manage.py migrate` (credencial renovada e verificada em 2026-07-25; se voltar a expirar, usar o fallback `bujo_e2e` local do `docs/e2e-neon-reset.md` §"Fallback validado"). **Bug recorrente (7.1, 7.2, 14.1): migration pendente na branch `e2e` trava a suíte inteira.**
  - [x] Pytest **full-suite, sem escopo de caminho**: `docker compose up -d db && cd backend && uv run pytest`. Baseline re-executada na criação desta story: **1099 passed em 299.46s** no commit `971da7c` (ver §Testing). Colar a contagem real ao fechar e derivar a divisão herdados/novos de `git diff`, **nunca** por subtração.
  - [x] E2E de **regressão do contrato legado** (a AC8 é a razão da seleção): `weekly-monthly-review.spec.ts`, `archive.spec.ts`, `migration-flow.spec.ts`, `future-log-annual.spec.ts`, `recurring-templates.spec.ts`, `weekly-monthly-cycle.spec.ts`. `nvm use 22.15.1`, `CI=1`, portas 5173/8000 — **nunca** matar 5174/8001 (dev local do dono). Se rodar também `weekly-monthly-task-crud.spec.ts`, as **4 falhas** de locator ambíguo já estão **medidas como pré-existentes** no baseline (Story 14.1, causa-raiz: `getByLabel('Título')` sem escopo × `BrainDumpCaptureSheet` portalizado da 13.3) — **não** re-diagnosticar e **não** consertar dentro de uma story de backend puro; apenas citar.
  - [x] `uv run ruff check` (deve ficar verde) + `uv run lint-imports`. `ruff format --check` **já está vermelho em 48 arquivos pré-existentes** — a story não pode **adicionar** arquivo à lista; verifique por diff das listas antes/depois, e formate os arquivos **novos** (`services/rituals.py`, `services/density.py`).
  - [x] `npx tsc --noEmit` no frontend + `git diff --numstat schema.yaml frontend/src/api/types.gen.ts` provando **0 deleções**.

## Dev Notes

### Estado atual do código que esta story consome ou estende (leia antes de escrever)

**`backend/bujo/models.py`** — `Task` (`models.py:159-253`): containers mutuamente exclusivos `log`/`weekly_log`/`monthly_log` (todos com `related_name="tasks"`, CHECK `task_exactly_one_log`); **`scheduled_date = DateField(null=True)` é a representação de "Sem dia definido"** (`models.py:185-187`) — não é status, não é data-sentinela; `order_index = FloatField()` **obrigatório, sem default** (só `create_task` sabe calcular); `parent_task` (`related_name="subtasks"`); `migrated_to_task` (`related_name="migrated_from"`); `source_template` → `RecurringTaskTemplate` (`related_name="instances"`, coluna `source_template_id`). `RecurringTaskTemplate` (`models.py:256-281`): `recurrence_group` ∈ `weekly|monthly|annual`, `recurrence_text` **texto livre nunca parseado**, `active` booleano, **sem** soft delete (é a 14.4). `WeeklyLog`/`MonthlyLog` (`:79-140`) com `status`/`planning_completed_at` da 14.1 e `db_table` no **singular**.

**`backend/core/models.py:21-43`** + **`backend/core/tenant.py:27-55`** — `TenantModel`: `user_id UUIDField` **não-FK**, `objects = TenantManager()` obrigatoriamente **declarado primeiro**, `all_objects` como escape hatch **proibido** aqui, `save()` preenchendo `user_id` do contextvar e falhando com `TenantScopeViolation` quando ausente. Fora do request: `with tenant_context(user):`.

**`backend/bujo/services/archive.py:30`** — `UNDISPOSED = (Task.Status.PENDING, Task.Status.STARTED)`. **Fonte única** de "tarefa aberta"; `cycles.py` já a importa. Não redeclarar.

**`backend/bujo/services/cycles.py`** — `_previous_operational(spec, *, key)` (`:134-149`) e `_has_undisposed(log)` (`:152-158`) são **exatamente** os predicados que as fontes bloqueantes precisam, e o docstring do primeiro explica por que ciclos `NULL` são ignorados. `_CycleSpec` (`:79-114`) é o padrão do repo para parametrizar os gêmeos weekly/monthly — **reuse a ideia** nas fontes gêmeas em vez de duplicar. `add_months` (`:73-76`) é a aritmética de mês normalizada em dia 1.

**`backend/bujo/views.py`** — padrões a espelhar e a **não** quebrar:
- `MigrationQueueView` (`:522-534`) é o exemplar de "**nunca materializa o log**" (`Log.objects.filter(...).first()`, comentário inline).
- `CatchUpQueueView` (`:576-604`) tem o helper `undisposed_roots` e as três querysets ordenadas por período.
- `RecurringTaskTemplateListView.get` (`:191-210`) já implementa `?active=`, `?recurrence_group=`, `order_by("recurrence_text")` e — crucial — `?unplaced_year` como `exclude(instances__monthly_log__month_first__year=Y)`: **a regra de elegibilidade anual do M07 já existe em código**. Reusar a expressão, não reinventar.
- `FutureLogView` (`:439-459`) mostra a convenção de `annotate(root_task_count=Count("tasks", filter=Q(tasks__parent_task__isnull=True)))`.
- `TaskDensityView` (`:462-519`) tem no docstring a semântica **antiga** de densidade (raízes só, sem segmentação, somando 3 fontes). A densidade desta story é **outra coisa** — não é conserto daquela. Ler o docstring para não confundir os dois contratos.
- `WeeklyLogView`/`MonthlyLogView` (`:259-361`) leem `status`/`planning_completed_at` direto do log e **não** chamam serviço de ciclo (AC4 da 14.1) — as views desta story seguem a mesma disciplina.

**`backend/core/calendar.py`** — `months_of_week(week_start) -> set[tuple[int, int]]` (`:81-87`) devolve **2** elementos na semana de virada: é o helper exato do "incluindo ambos os Monthly quando cruza meses". `week_start_of` (`:37-42`), `today_for` (`:14-19`), `now()` (`:22-34`), `month_turn_week` (`:60-78`, informativa). **Não existe** `month_first_for` — use `.replace(day=1)`, como `views.py:328,442,562`. Guardrail de AST proíbe `date.today()`/`timezone.now()` fora deste módulo.

**`backend/core/exceptions.py`** — `DomainError` (Exception puro) → **409** pelo `custom_exception_handler`; `InvalidTransition(from, to)`; `CycleTargetConflict` (colisão de unique parcial, 14.1); `ClosedCycleReadOnly`. **Proibido** `ValidationError`/`ValueError` cru dentro de `services/`.

**`backend/bujo/management/commands/purge_e2e_users.py:32-35`** — comentário normativo: model tenant-scoped novo **precisa** entrar em `TENANT_MODELS`. Espelho em `test_purge_e2e_users.py:34`.

### Regras de produto (spines vencem conflitos)

**Fontes do ritual semanal — ordem fixa 1→5** [Source: EXPERIENCE.md#Weekly e planejamento semanal → Fontes do ritual (L225-L237)]:

| # | Fonte | Elegibilidade (literal do spine) | No progresso? | Bloqueia? | Decisão-snapshot |
|---|---|---|---|---|---|
| 1 | Monthly na semana | "`pending`/`started` datadas dentro do intervalo, incluindo **ambos os Monthly** quando cruza meses" | sim | não | `keep` ("manter") |
| 2 | Monthly ampliado | "qualquer mês anterior/futuro navegável; fonte **opcional, fora do progresso** obrigatório" | **não** | não | — (endpoint existente) |
| 3 | Recorrentes | "**todos** os templates weekly ativos, ordenados alfabeticamente pelo texto de recorrência… **Já alocados** permite novas instâncias, inclusive duplicadas no mesmo dia; **Não alocar nesta semana** remove o aviso sem desativar o template" | sim (só os pendentes) | não | `skip_week` |
| 4 | Weekly anterior | "somente `pending`/`started`; **não oferece 'manter'**. É a **única fonte que bloqueia** iniciar a semana. Ao zerar, mostra **Semana anterior pronta para finalizar**" | sim | **sim** | nenhuma |
| 5 | Daily pendentes | "**todos** os Daily Logs não resolvidos, do mais antigo ao mais recente, agrupados por data e recolhíveis" | sim | não | nenhuma |

Progresso [L243]: "Uma fonte obrigatória fica revisada automaticamente quando não restam itens sem decisão; **vazio é revisado**. Manter, não alocar, concluir, cancelar, migrar e adiar contam. **Monthly ampliado não entra no denominador.** Novos itens preservam o marco anterior e reativam o aviso da fonte."

Densidade [L241]: "Densidade usa **apenas registros reais já materializados** no Weekly, **inclui subtarefas** e **segmenta todos os status**. Monthly/recorrentes **não aparecem como projeção**." + [L223] "O resumo conta **registros, não linhagens**: origem migrada e sucessor contam separadamente."

Independência [L251]: "Fontes **carregam/falham independentemente**."

**Fontes do ritual mensal — três regiões, ordem fixa** [Source: EXPERIENCE.md#Monthly e planejamento mensal → Fontes e decisões do ritual (L287-L295)]:

1. **Recorrentes** — "templates `monthly` ativos **primeiro**; depois `annual` ativos **ainda sem instância no ano do Monthly alvo**. `recurrence_text` é apenas exibido, **nunca parseado** para inferir mês… A primeira instância resolve a pendência do ciclo, mas **Já alocados**/**Já alocados no ano** continuam acessíveis **fora do progresso**… Um anual só deixa de ser lembrado quando recebe destino no ano do alvo; pode ir ao Monthly alvo ou a um mês posterior do Future Log dentro desse mesmo ano. **Em dezembro, somente o próprio mês-alvo resolve** a pendência anual. **Não existe 'Não alocar neste mês' para anual.**"
2. **Future Log** — "itens destinados ao mês-alvo **já pertencem a esse Monthly** e chegam com data preservada ou em **Sem dia definido**. No ritual, oferecem **somente** escolher um dia, **Manter sem dia** ou adiar para um Monthly futuro. Manter conta como decisão persistida no snapshot do ritual **sem mudar a Task**… **Concluir/cancelar não aparecem nessa fonte.**"
3. **Monthly anterior** — "somente `pending`/`started`; permite concluir ou cancelar na origem, migrar para o alvo com dia/**Sem dia definido**, ou adiar ao Future Log. É a **única fonte bloqueante** do gate de início. Ao zerar, oferece **Finalizar mês anterior**."

[L295] "O planejamento mensal **nunca envia uma tarefa diretamente ao Weekly**." [L301] "**Já alocados no ano** não entra em progresso nem avisos." [L299] "Conta **somente Tasks reais já materializadas** no Monthly, **incluindo subtarefas**; recorrentes ainda não alocados **não são projeção**." [L309] "Recorrentes, Future Log e Monthly anterior **carregam/falham independentemente**."

**Handoff downstream** [Source: architecture-and-story-handoff.md#M06 (L27)]: "decisões `manter`/`não alocar` e snapshots; **agregação independente** de Monthly/Weekly/Daily/recorrentes; … **densidade com subtarefas e todos os status**". [#M07 (L31)]: "decisão **Manter sem dia** e snapshots; **agregação independente das três fontes**; distinção Monthly/Future; **elegibilidade anual sem parsing de `recurrence_text`**; **múltiplas instâncias por template**; densidade com subtarefas/status."

**Consequência dura de "múltiplas instâncias por template"**: **não** pode existir unique de template × dia nem template × alvo. Alocar duas vezes no mesmo dia é comportamento contratado.

### Forma decidida (AD-28 item 6 — não redecidir)

```sql
ritual_decisions (
  id, user_id,
  weekly_log_id          UUID NULL,   -- alvo do ritual — exatamente um
  monthly_log_id         UUID NULL,
  task_id                UUID NULL,   -- item decidido — exatamente um
  recurring_template_id  UUID NULL,
  decision               VARCHAR,     -- keep | skip_week | keep_undated (TextChoices + CheckConstraint)
  created_at, updated_at,
  CONSTRAINT ritual_decision_exactly_one_target CHECK (weekly_log XOR monthly_log),
  CONSTRAINT ritual_decision_exactly_one_item   CHECK (task XOR recurring_template)
  -- UNIQUE (alvo, item) via constraints parciais por combinação; upsert no service
)
```

Pontos **vinculantes** [Source: architecture.md#AD-28 (item 6, L1212; casos-âncora L1243-L1249)]:

1. Tabela própria, **um registro por (ritual-alvo × item)**, **só** para decisões que **não** mutam o item.
2. Decisões **mutantes não ganham registro paralelo** — "a própria mutação é a persistência: a fonte deixa de listar o item na re-derivação; registrar em dobro criaria segunda verdade".
3. Âncoras **exclusivas** (padrão CHECK exactly-one da AD-03/AD-20). "**'Não alocar nesta semana' decide sobre um template, não uma Task.**"
4. `decision` em `TextChoices` + `CheckConstraint`; valores novos entram por migration limpa.
5. Unicidade `(alvo, item)` por uniques parciais; **re-decidir = upsert no serviço**.
6. **Persistência imediata, um POST por decisão** (pausar/sair não perde nada).
7. **Progresso do ritual é derivado** (elegíveis − mutados − decididos), **nunca contador armazenado**.
8. "**A Task jamais é tocada por uma decisão-snapshot.**"

Casos-âncora da própria AD, a transformar em testes literais:
- "*Recorrente semanal 'Não alocar nesta semana'*: linha em `ritual_decisions` (item = template, alvo = weekly em `planning`); **nenhuma Task nasce**; progresso conta a decisão; retomar **não reapresenta**; **a densidade não projeta** (só materializados — AC 14.2)."
- "*'Manter sem dia' no ritual mensal*: item do Future Log ganha decisão-snapshot; **a Task permanece intacta** no monthly, sem dia."

### Ambiguidades resolvidas nesta story (documentadas em vez de improvisadas)

1. **Fronteira dos "Daily pendentes".** O spine diz "todos os Daily Logs não resolvidos" sem limite superior. Como o ritual planeja a semana-alvo, os Daily dentro dela ainda vão acontecer: a fonte usa **`log_date < weekStart`**. Um alvo na semana corrente ⇒ os dias já vividos da semana ficam de fora desta fonte (eles são pendência do Weekly corrente, não matéria do planejamento do alvo). Registrado em Questões abertas #1.
2. **Quem é "item do Future Log" no ritual mensal.** O spine define a fonte por *pertencimento ao monthly-alvo*, mas a fonte "Monthly anterior" **migra itens para o alvo durante o mesmo ritual** — sem filtro, o sucessor recém-criado voltaria à fila como item indeciso, inflando o denominador e contradizendo "retomar traz só os restantes". Regra escolhida: **excluir sucessores cujo predecessor vive no monthly operacional imediatamente anterior**. Coerente também fora do ritual: quem moveu um item do mês passado para este mês **já decidiu**. Itens adiados de rituais mais antigos (predecessor em mês−2 ou anterior) **continuam aparecendo**, que é o comportamento correto do Future Log. Registrado em Questões abertas #2.
3. **Estado exigido do alvo.** A **decisão-snapshot** (`POST /ritual-decisions/`) exige alvo `status == 'planning'` — o ritual só existe no alvo em planejamento; "Revisar planejamento" permanece disponível porque `complete_planning` **não** muda `status` (14.1 AC2). As **fontes** e a **densidade** são leituras e **não** têm gate de estado: aceitam qualquer log existente **e a ausência de log**, devolvendo envelope/grade vazios. Não é frouxidão, é o que a AC7 exige — o guardrail de zero-materialização chama as 7 fontes e as 2 densidades para chaves **sem log nenhum** e espera resposta, e um gate de `planning` só poderia ser aplicado materializando o alvo ou devolvendo 409 onde a AC contrata `eligibleCount: 0`. 14.5/14.6 (boards em `active`) e 14.10 (Arquivo, `finalized`) reusam as duas leituras por isso. *(Redação corrigida na code review: a versão anterior desta linha dizia "fontes e decisões exigem `planning`", o que nunca foi implementado nem poderia ser.)*
4. **Sem `label` no backend.** O AC do épico fala em "rótulo e contagem por fonte" — mas isso está na **14.3** (fila unificada). Aqui a cópia pt-BR permanece no UI (DESIGN/EXPERIENCE são a autoridade de wording), e o backend expõe `sourceId` estável. Uma cópia em duas camadas é dívida garantida. Registrado em Questões abertas #3.
5. **Sem `DELETE` de decisão-snapshot.** A matriz dá **uma** decisão possível por combinação, então "re-decidir" é upsert idempotente por construção, e mudar de ideia para uma decisão **mutante** resolve por mutação (o item sai da fonte). Nenhum spine pede "desfazer manter". Não implementar agora; registrado em Questões abertas #4.
6. **Endpoint por fonte, sem agregador.** "Carregam/falham independentemente" só é verdade de fato se cada fonte for uma requisição. Um agregador com `try/except` por fonte devolveria 200 com erros embutidos e acoplaria os tempos de resposta. O rail soma no cliente. É também o que permite que a UI mostre `Partial source error` sem inventar um protocolo de erro parcial.
7. **`InvalidRitualDecision` nova em vez de reusar `InvalidTransition`.** Combinação `(alvo, item, decisão)` fora da matriz não é transição de estado nem disputa de alvo. Segue a mesma lógica que criou `CycleTargetConflict` na 14.1 — 409 pelo mesmo handler, semântica distinguível pelo consumidor.

### Convenções que o dev **não** pode violar

- `TextChoices` + `CheckConstraint`; **nunca** ENUM nativo do Postgres. `condition=` (Django 5.2), nunca `check=`. Migration com `--name` descritivo, **uma** por story [Source: architecture.md#6.1].
- Serviço em `<app>/services/<agregado>.py`, **funções de módulo, nunca classes**; `def <verbo>_<substantivo>(*, user, ...)`; `@transaction.atomic` **no serviço**, nunca na view; view **fina** (serializer → serviço → serializer); serviço recebe dados validados, nunca `request` [Source: architecture.md#6.2].
- Regra de produto **no serviço**, nunca em serializer; erro de domínio é `DomainError` → 409 [Source: architecture.md#6.4, #6.6].
- Manager auto-escopado `objects` sempre; `all_objects` **proibido** fora de admin/migration [Source: architecture.md#AD-12]. Fora do request, `with tenant_context(user):`.
- Sem `date.today()`/`timezone.now()` fora de `core/calendar.py` — guardrail de AST em `core/tests/test_guardrails.py:55-106` (varre também `factories.py`).
- `core` não importa app de domínio (import-linter no CI) — nada de `bujo` dentro de `core/calendar.py`.
- Testes por camada: `test_models.py` / `test_serializers.py` / `test_services.py` / `test_views.py`; isolamento pelo **registry compartilhado** (`register_isolation_case` em `factories.py`), nunca um `test_isolation.py` novo em `bujo/`.
- `parameters=[<QuerySerializer>]` + `responses=` em **todo** `@extend_schema` (`views.py` passim) — o schema é gate de CI.
- **Não copiar código ao espelhar gêmeos** (lição SHELL-DEBT-03/04 do Épico 13, repetida com sucesso na 14.1 via `_CycleSpec`): weekly e monthly compartilham quase tudo nas fontes bloqueantes e na densidade — **extraia** a mecânica e nomeie os pontos onde o produto realmente diverge (`skip_week` só no weekly; `already_placed_in_year` só no anual; grade de 7 dias × dias do mês).

### Project Structure Notes

| Arquivo | Ação |
|---|---|
| `backend/bujo/models.py` | UPDATE — `RitualDecisionKind` + `RitualDecision` + 7 constraints |
| `backend/bujo/migrations/0008_ritual_decisions.py` | NEW — schema puro (sem `RunPython`) |
| `backend/bujo/services/rituals.py` | NEW — `ALLOWED_DECISIONS`, `upsert_ritual_decision`, 7 funções de fonte, `decisions_for_target` |
| `backend/bujo/services/density.py` | NEW — `compute_week_density`, `compute_month_density` |
| `backend/bujo/services/cycles.py` | UPDATE — promover `_previous_operational`/`_has_undisposed` a wrappers públicos por tipo |
| `backend/core/exceptions.py` | UPDATE — `InvalidRitualDecision` |
| `backend/bujo/serializers.py` | UPDATE — envelope de fonte, itens, decisão, densidade, query serializers |
| `backend/bujo/views.py` | UPDATE — 10 views novas |
| `backend/bujo/urls.py` | UPDATE — 10 rotas novas |
| `backend/bujo/management/commands/purge_e2e_users.py` | UPDATE — `RitualDecision` em `TENANT_MODELS` |
| `backend/bujo/tests/{factories,test_models,test_serializers,test_services,test_views,test_purge_e2e_users}.py` | UPDATE |
| `schema.yaml`, `frontend/src/api/types.gen.ts` | UPDATE — **gerados**, 0 deleções |

**Fora de escopo, explicitamente:** fila unificada de migração e aliases finos (14.3), soft delete de template (14.4), qualquer superfície de UI (14.5–14.10), conserto dos locators de `weekly-monthly-task-crud.spec.ts` (triagem de frontend herdada da 14.1), `ruff format` global (48 arquivos pré-existentes).

### Previous Story Intelligence

**Story 14.1** (`done` 2026-07-25) — a base direta desta story. O que importa herdar:

- **`is_cycle_closed` tem UM critério por regime** (correção A1 da code review): ciclo com `status` não-`NULL` fecha **se e somente se** `finalized`; `status IS NULL` segue pela derivação por conteúdo, intacta. **Consequência para esta story:** um alvo `planning` com todas as tarefas dispostas **não** é fechado nem readonly — as fontes e a densidade precisam funcionar normalmente nesse estado. Não reintroduza derivação por conteúdo em nada que esta story escreva.
- **`next_monthly_target` prefere o `planning` existente** (correção M1): existe uma janela real, entre `finalize(X)` e `start(X+1)`, em que **não há `active`**. Qualquer código desta story que precise do "mês em planejamento" deve consultar `status='planning'` diretamente, **não** derivar de `active + 1`.
- **Idempotência precisa ser provada em SQL:** o helper `_sem_escrita` (criado na review da 14.1, em `test_services.py`, com `CaptureQueriesContext` afirmando zero `INSERT/UPDATE/DELETE`) existe — **reuse** para o upsert desta story. Um teste que só compara valores de retorno não prova "sem escrita".
- **Precedência de bucket e "anterior operacional":** ciclos `NULL` passados são ignorados pelos gates e suas tarefas abertas são a população da **14.3**, não desta story. Nenhuma fonte desta story deve tentar escoá-los.
- **Contrato aditivo é provado mecanicamente:** `git diff --numstat` em `schema.yaml`/`types.gen.ts` (a 14.1 fechou com `156/0` e `141/0`).
- **Falhas de E2E pré-existentes:** `weekly-monthly-task-crud.spec.ts` tem **4** falhas medidas no baseline `c2ba650`, causa-raiz `getByLabel('Título')` sem escopo × `BrainDumpCaptureSheet` portalizado (13.3). **Não** é regressão e **não** é escopo aqui.
- **`ruff format --check`** está vermelho em 48 arquivos **pré-existentes** desde antes da 14.1 — dívida global; a obrigação é não **adicionar** arquivo.

**Story 14.0** (`done` 2026-07-24) — gate UX do épico: "M06–M10 auditados e mantidos fechados; nenhuma lacuna comprovada exigiu novo frame". Os spines são a **autoridade final** desta story, sem reabertura.

**Retrospectiva do Épico 13** — as três classes de achado que mais custaram e que as Tasks 8/9 endereçam: contagem/divisão de testes escrita de memória; File List sem os artefatos dos passos pós-`dev-story`; **testes vacuosos** (nome prometendo um guard que o teste não exercitava). Além disso: **copiar código ao espelhar** gerou SHELL-DEBT-03/04 — aqui o risco gêmeo é weekly × monthly.

### Git Intelligence

`971da7c` (`feat(story-14.1): Ciclos de vida de Weekly e Monthly (backend)`) é o HEAD e o **único** commit de backend do épico até agora; antes dele, o último backend era `0006_task_waiting_on` (Story 12.2). Consequências práticas:

- **`0008` é o próximo número livre** de migration em `bujo/` (a `0007` é da 14.1), sem risco de conflito.
- O padrão de código imediatamente anterior é o **da própria 14.1** — é dele que vêm `_CycleSpec` (parametrização de gêmeos), o dict módulo-level de despacho `action → serviço` (`views.py:368-380`), o `_CycleFieldsMixin` de campos aditivos (`serializers.py:117-119`) e o `_sem_escrita` dos testes. Espelhe **esses** padrões, não os de 13.x (frontend).
- Convenção de mensagem: `feat(story-14.2): <resumo>`.

### Latest Tech Information

- **Django 5.2.15** — `CheckConstraint`/`UniqueConstraint` usam **`condition=`** (`check=` deprecado em 5.1, removido em 6.0). Todo o repo já usa `condition=`.
- `UniqueConstraint(fields=[...], condition=Q(...))` gera **índice único parcial** no Postgres. Alvo é só Postgres (16 local / Neon) — as 4 uniques parciais desta story são o mesmo mecanismo já provado na 14.1 e em `medications/models.py:233-244`.
- **`Q(a__isnull=False, b__isnull=True) | Q(a__isnull=True, b__isnull=False)`** é a forma exata do *exactly-one* já usada em `Task.Meta` — reproduza a forma; não invente `Case/When`.
- `F("scheduled_date").asc(nulls_last=True)` é a ordenação "dia → sem-dia" (Postgres coloca NULL por último em ASC por default, mas **declare** explicitamente: a ordenação é contrato de produto, não acidente do banco).
- **djangorestframework-camel-case** cameliza chaves de dict na saída, inclusive as de dicionários de dados — as 6 chaves de `byStatus` (`pending`, `started`, `completed`, `cancelled`, `migrated`, `postponed`) **não** têm underscore, então passam inalteradas. Confirme por teste de fio, não por dedução.
- `drf-spectacular` com `camelize_serializer_fields` nos `POSTPROCESSING_HOOKS` (`config/settings/base.py:188-191`) — sem ele o schema documentaria snake_case; **não** mexer.
- **Node ≥20.12 via nvm** (`nvm use 22.15.1`) antes de **qualquer** comando de frontend/e2e — a sessão abre em v18 e não há `.nvmrc`.
- Pytest usa **Postgres local** (docker-compose, tmpfs): full-suite local é barato e é o padrão; o CI roda `uv run pytest` sem escopo.

### Testing

- **Baseline re-executada na criação desta story** (comando real, não copiada de documento anterior): `docker compose up -d db && cd backend && uv run pytest` no commit `971da7c` (2026-07-25) → **1099 passed em 299.46s**. Re-executar ao fechar, colar o número real e derivar a divisão herdados/novos de `git diff`, **nunca** por subtração.
- Fixtures (`backend/conftest.py`, único conftest raiz): `_enable_db_access` (autouse), `user`, `other_user`, `api_client`, `auth_client` (já entra em `tenant_context`). Testes de serviço envolvem o corpo em `with tenant_context(user):`.
- Exemplares a espelhar: matriz exaustiva `test_ciclo_weekly_matriz_completa` (`test_services.py:1571-1616`); gates em falhas **isoladas** (`:1719-1761`); "ausência é regra de produto" (`test_ciclo_monthly_nao_tem_cancelar_planejamento`, `:1693-1704`); `_sem_escrita` (idempotência em SQL); URLs como **literais** em `test_views.py` (`:2298-2299`), asserts do corpo em **camelCase**; JWT real para isolamento (`:39-57`).
- Nomes e docstrings de teste em **pt-BR** descritivo.
- E2E: Playwright sobe os servidores sozinho (`webServer`), frontend 5173 (`--mode e2e`, lê `.env.e2e`) e backend 8000 (`config.settings.e2e`), `workers: 1`, **não** roda no CI. `CI=1` e escopo por spec. **Nunca** matar 5174/8001.
- Esta story **não** cria superfície de UI: os E2E são de **regressão de contrato legado** (AC8), não de feature nova. Se o passo de QA (`bmad-qa-generate-e2e-tests`) criar spec/seed novo, **reconcilie o File List depois dele** — o guardrail cobre o handoff `dev-story` → QA.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 14.2: Fontes dos rituais e decisões-snapshot (backend)] — ACs originais (linhas 2220–2235)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 14: Onda 3 — Núcleo BuJo no Sistema Novo (gate vertical)] — ordem domínio-primeiro, decisão (a), Daily legado utilizável até o Épico 17 (linhas 531–535, 2172–2174)
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-28] — item 6 (`ritual_decisions`), casos-âncora (L1243–L1249), adendo as-built da 14.1 (L1252–L1259)
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-08] — template em tabela separada, `recurrence_text` não parseado, placement cria snapshot com `source_template_id`, subtarefas
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-03] / [#AD-20] — padrão CHECK *exactly-one*
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-05] — `week_start` segunda, `month_first` dia 1, Future Log = `monthly_log` futuro
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-12] — manager auto-escopado, `all_objects` proibido
- [Source: _bmad-output/planning-artifacts/architecture.md#6.1, #6.2, #6.4, #6.6, #6.7, #6.9] — nomenclatura, camada de serviço, erros, validação, multi-tenant, tempo/anti-padrões
- [Source: ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Weekly e planejamento semanal] — fontes (L225–L237), densidade/progresso (L241–L245), independência (L251)
- [Source: ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Monthly e planejamento mensal] — fontes (L287–L295), densidade/progresso (L299–L301), independência (L309)
- [Source: ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Component Patterns] — Weekly/Monthly Planning Sources, Week/Month Density (L129–L135); [#State Patterns] — *Partial source error* (L422), *Migração pausada* (L423)
- [Source: ux-designs/ux-hmmb-bujo-2026-07-17/architecture-and-story-handoff.md#M06 — Weekly] / [#M07 — Monthly] / [#M08 — Future Log] / [#M09 — Recorrentes]
- [Source: _bmad-output/implementation-artifacts/14-1-ciclos-de-vida-de-weekly-e-monthly-backend.md] — Dev Notes, Completion Notes e Senior Developer Review (achados A1/M1/M2)
- [Source: backend/bujo/models.py] / [backend/bujo/services/{archive,cycles,tasks,logs,migration,recurring,state_machine}.py] / [backend/bujo/{views,serializers,urls,filters}.py]
- [Source: backend/core/{calendar,exceptions,models,tenant}.py] / [backend/conftest.py] / [backend/core/tests/{registry,test_guardrails}.py]
- [Source: backend/bujo/management/commands/purge_e2e_users.py] — obrigação de `TENANT_MODELS`
- [Source: docs/e2e-neon-reset.md] — runbook da branch `e2e` e fallback local

### Questões abertas (para o dono — não bloqueiam a implementação)

1. **Fronteira dos Daily pendentes.** Implementado `log_date < weekStart`. Se o desejado for "tudo que está aberto, inclusive dias já vividos da semana-alvo", é troca de uma linha no filtro.
2. **Sucessor recém-migrado na fonte Future Log.** Excluído quando o predecessor está no monthly operacional anterior (evita a fila que nunca zera). Efeito colateral aceito: um item movido do mês passado para o alvo **fora** do ritual também não aparece para decisão — a leitura é que mover já foi decidir.
3. **`sourceId` sem `label`.** A cópia pt-BR das fontes fica no UI. Se o dono preferir rótulo servido pelo backend (como a 14.3 prevê para a fila unificada), é campo aditivo.
4. **Ausência de `DELETE` de decisão-snapshot.** Nenhum spine pede "desfazer manter". Se a 14.5/14.6 precisarem de desfazer explícito, é endpoint aditivo + teste, sem mudança de schema.
5. **Densidade aceita alvo em qualquer estado.** Escolha deliberada para reuso por 14.5/14.6/14.10. Se o dono quiser restringir a densidade ao ritual, é um gate de uma linha — mas então os boards precisarão de outro endpoint.

## Dev Agent Record

### Agent Model Used

claude-opus-5[1m] (Claude Opus 5, 1M context) — workflow `bmad-dev-story`.

### Debug Log References

**Provas de não-vacuidade (3 experimentos SEPARADOS, cada um revertendo UMA propriedade):**

| # | Reversão cirúrgica aplicada | Teste que passou a FALHAR | Restauração |
|---|---|---|---|
| (a) | `density.py`: `log.tasks.values(...)` → `log.tasks.filter(parent_task__isnull=True).values(...)` (o filtro copiado de `TaskDensityView`) | `test_densidade_semanal_conta_subtarefas` **e** `test_densidade_no_fio_tem_by_status_com_as_seis_chaves` — 2 failed | restaurado; `ruff format --check` limpo, 2 passed |
| (b) | `rituals.py`: `if previous is not None:` → `if False and previous is not None:` na exclusão do sucessor no Future Log | `test_fonte_future_log_nao_reapresenta_sucessor_recem_migrado_do_monthly_anterior` — 1 failed | restaurado; `grep -c "if False"` = 0, 1 passed |
| (c) | `rituals.py`: `previous_operational_weekly(...)` → `WeeklyLog.objects.filter(week_start=week_start - timedelta(days=7)).first()` | `test_fonte_weekly_anterior_usa_o_anterior_OPERACIONAL_ignorando_ciclos_null` — 1 failed | restaurado; 50 passed no escopo `-k "fonte or densidade or ritual"` |

Nota metodológica: (a) exigiu experimento próprio para o teste de serviço **e** o de fio porque são asserts diferentes (grade agregada vs. `byStatus` camelizado) — o guardrail do Épico 13 manda experimentos separados quando dois asserts parecem medir a mesma coisa. `git diff --stat` dos arquivos de produção conferido limpo depois das três restaurações (`rituals.py`/`density.py` são arquivos NOVOS, então a verificação foi por `grep` da expressão revertida + re-execução verde).

**Advertência de `spectacular` verificada como PRÉ-EXISTENTE:** `Warning: encountered multiple names for the same choice set (ToStatusEnum)` aparece **idêntica** no baseline `971da7c` (medido por `git stash push -u -- backend/` + `spectacular --file /dev/null`). O enum novo **não** colidiu: virou `DecisionEnum`, nome único — nenhuma entrada em `ENUM_NAME_OVERRIDES` foi necessária.

**Dívida de `ruff format` conferida por diff de listas, não por contagem:** as listas de `Would reformat` antes (via `git stash`) e depois são **byte-idênticas** (48 arquivos em ambas, `diff` vazio). Os dois arquivos novos (`services/rituals.py`, `services/density.py`) foram formatados e passam `ruff format --check`.

**Experimentos do passo de QA (`bmad-qa-generate-e2e-tests`, 2026-07-25) — SEPARADOS dos três acima.**

| # | Reversão cirúrgica aplicada | Teste que passou a FALHAR | Restauração |
|---|---|---|---|
| (d) | `rituals.py::_envelope`: `pending = sum(1 for item in items if item["decision"] is None)` → `pending = len(items)` | `test_laco_do_ritual_no_fio_decisao_zera_a_pendencia_sem_mudar_a_elegibilidade` — 1 failed | restaurado; `grep -c "EXPERIMENTO"` = 0, 1 passed |
| (e) | `rituals.py`: `annual_eligible = annual.exclude(in_year)` → `annual_eligible = annual` | `test_fonte_recorrentes_mensais_no_fio_expoe_os_dois_buckets` — 1 failed | restaurado; `grep -c "EXPERIMENTO"` = 0, 1 passed |
| (g) | `density.py`: `WeeklyLog.objects.filter(week_start=...).first()` → `get_or_create(week_start=...)` | E2E `as nove leituras de ritual não materializam container no banco real (AC7)` — 1 failed nas 3 tentativas | restaurado; `grep` de `get_or_create` em `density.py`/`rituals.py` só acha as **docstrings** originais; full-suite verde depois |

(d) e (e) foram experimentos separados por medirem propriedades distintas (derivação do progresso × elegibilidade anual por ano-alvo), mesmo tocando o mesmo arquivo — o guardrail do Épico 13 manda separar quando dois asserts poderiam parecer o mesmo. (g) exigiu execução E2E própria: é o único assert desta story que atravessa o fio até o banco real.

**Experimento da code review (2026-07-25) — SEPARADO dos anteriores.**

| # | Reversão cirúrgica aplicada | Teste que passou a FALHAR | Restauração |
|---|---|---|---|
| (h) | `rituals.py`: `_blocking_previous_source` voltando a receber e anotar `decisions_for_target(weekly_log=previous)` (o defeito A1) | `test_fonte_weekly_anterior_ignora_decisao_snapshot_gravada_no_log_anterior` — 1 failed (`assert 'keep' is None`) | restaurado; `grep -c "_EXPERIMENTO"` = 0, `ruff format --check` limpo, 27 passed no escopo `-k "fonte or densidade or ignora_decisao_snapshot"` |

**(f) Evidência DIRETA dos índices únicos parciais na branch Neon `e2e`** (premissa da asserção de concorrência do E2E, e por isso verificada em vez de presumida): `select indexname, indexdef from pg_indexes where tablename='ritual_decisions'` devolve os **4** índices com os nomes contratados (`uniq_ritual_decision_{weekly,monthly}_{task,recurring}`) e o predicado `WHERE ((… IS NOT NULL) AND (… IS NOT NULL))` esperado. Ou seja: quando o E2E dispara dois POSTs simultâneos da mesma decisão e ambos devolvem o mesmo `id`, é o índice do banco de verdade fazendo o upsert convergir — não o `get`-antes-de-`create` do serviço, que sozinho perderia a corrida.

**Assunção do spec E2E que se provou FALSA e foi corrigida (Achado 1 do passo de QA):** a primeira versão do teste de densidade assertava que a subtarefa **não** apareceria na grade da semana (`toHaveCount(0)`), por analogia com o `parent_task__isnull=True` de toda listagem. O teste falhou: a grade lista as **raízes** filtradas, mas o `TaskSerializer` serializa `subtasks` **dentro** de cada raiz, então a subtarefa aparece aninhada. A consequência não é defeito e sim contrato a comunicar: aos olhos a subtarefa mora no dia do pai, mas para a densidade ela é `undated`, porque `SubtaskCreateView` não aceita `scheduledDate` e a faixa é definida pelo `scheduled_date` do próprio registro. **A UI das 14.5/14.6 precisa saber disso antes de desenhar o heatmap** — a barra de um dia não é a soma visual dos cartões daquele dia.

**`.data` vs `.json()` nos testes de fio:** a primeira versão dos testes de view usou `response.data`, que é **pré-render** (snake_case) — a camelização é do renderer. 6 testes falharam e foram convertidos para `.json()`, que é a convenção já vigente no arquivo (`test_views.py:2311+`). Registrado porque é uma armadilha reincidente para quem escreve o primeiro assert de fio de uma story.

### Completion Notes List

**Contagens reais (comando executado, nunca de memória):**

- `docker compose up -d db && cd backend && uv run pytest` (full-suite, **sem escopo de caminho**) → **1209 passed em 328.15s**, re-executada no **passo de QA** como último gate, depois dos 4 experimentos de não-vacuidade dele. (No fim do `dev-story` eram **1194 em 325.49s**; a diferença são os 15 testes de API que o passo de QA somou.)
- Baseline: **1099 passed em 299.46s** no commit `971da7c` (HEAD desta story), re-executada na criação — ver §Testing.
- Divisão **derivada de `git diff`, não por subtração**, em duas camadas:
  - **`dev-story`:** 62 funções `test_` novas nos 5 arquivos de teste (models +8, services +36, views +14, serializers +3, purge +1), que a parametrização expande em **94** testes coletados (`pytest --collect-only` filtrado pelos nomes extraídos do diff), **mais 1** caso novo no contrato compartilhado de isolamento (`bujo.RitualDecision`, via `register_isolation_case`) = **95**. 1099 + 95 = 1194 ✓.
  - **passo de QA:** **7** funções `test_` novas, todas em `test_views.py`, das quais uma é parametrizada ×9 (`test_fontes_e_densidades_recusam_escrita`) → **15** testes coletados. 1194 + 15 = 1209 ✓ (o total corrobora cada divisão; nenhuma delas foi obtida dele).
- **Contrato gerado intocado pelo passo de QA:** `schema.yaml` e `types.gen.ts` não foram regenerados nem deveriam ser — nenhuma rota, serializer ou enum mudou, só testes e um spec E2E novo.
- `uv run ruff check` → **All checks passed**. `uv run lint-imports` → **1 kept, 0 broken**.
- `npx tsc --noEmit` (Node 22.15.1) → limpo.
- `git diff --numstat schema.yaml frontend/src/api/types.gen.ts` → **`583 0`** e **`553 0`** — aditividade estrita provada mecanicamente (AC8).

**Migrations aplicadas (saída literal):**

- Banco `dev` (`DJANGO_SETTINGS_MODULE=config.settings.dev`): `Applying bujo.0008_ritual_decisions... OK`
- Branch Neon `e2e` (`config.settings.e2e`), **antes** do Playwright: `Applying bujo.0008_ritual_decisions... OK`; `migrate --check` subsequente **sem saída** (nada pendente). O bug recorrente das Stories 7.1/7.2/14.1 não se repetiu.

**E2E de regressão do contrato legado (AC8) — 6 specs, `CI=1`, Node 22.15.1, portas 5173/8000 (5174/8001 intocadas):**

`weekly-monthly-review.spec.ts`, `archive.spec.ts`, `migration-flow.spec.ts`, `future-log-annual.spec.ts`, `recurring-templates.spec.ts`, `weekly-monthly-cycle.spec.ts` → **16 passed / 1 failed em 12,5 min**.

**E2E novo do passo de QA (`bmad-qa-generate-e2e-tests`) — 1 spec, 3 testes:** `frontend/e2e/ritual-sources.spec.ts` → **3 passed em 1,7 min** (`CI=1`, Node 22.15.1, portas 5173/8000). **Corrige** a afirmação "Nenhum spec E2E novo" que o `dev-story` deixou no File List: ela ficou falsa neste passo. Os três testes cobrem só o que o pytest não alcança — AC7 provada por contagem de containers **fora do fio** (`countRitualContainers` via `manage.py shell`, porque contar pela API é impossível: `GET /api/bujo/logs/weekly/` materializa de propósito), AC1/AC2 sob **concorrência real** (dois POSTs simultâneos convergindo para uma linha pelo índice único parcial da `0008` no Postgres de verdade) e AC6/AC8 confrontadas com a superfície que o usuário vê. Detalhes em `_bmad-output/implementation-artifacts/tests/test-summary-14-2.md`.

Os 6 specs de regressão do contrato legado **não** foram reexecutados no passo de QA, porque ele **não alterou nenhum arquivo de produção**: os 4 experimentos de não-vacuidade foram revertidos e a full-suite ficou verde depois deles.

A única falha do bloco acima — `recurring-templates.spec.ts:306` ("AC1/AC3 (Story 11.8) — modal de placement exibe a etiqueta Eisenhower…"), timeout do locator `getByRole('button', { name: 'Definir placement' })` dentro de `ancestor::div[1]` — foi **verificada como PRÉ-EXISTENTE por execução no baseline**, não presumida: com `git stash push -u -- backend/ schema.yaml frontend/src/api/types.gen.ts` (toda a story fora da árvore), o **mesmo** teste falha no **mesmo** locator e na **mesma** linha (`3 passed / 1 failed` no spec isolado). É a mesma classe de defeito de locator herdada da 14.1 (superfície de captura portalizada da 13.3 tornando locators sem escopo ambíguos no app inteiro) e **não** é regressão desta story — que é backend puro e não toca nenhum componente de UI. Registrada para a triagem de frontend já aberta; **não** re-diagnosticada nem consertada aqui, conforme o escopo contratado na Task 9.

**O que foi entregue por AC:**

- **AC1** — `RitualDecisionKind` no nível do módulo + `RitualDecision(TenantModel)` com `objects = TenantManager()` herdado, `db_table = "ritual_decisions"` e **7 constraints**: 2 CHECK *exactly-one* (alvo, item), 1 CHECK do enum e as **4 uniques parciais por combinação**, derivadas do produto cartesiano das duas âncoras em `_ritual_decision_uniques()` — helper, não quatro blocos copiados (mesmo motivo de `_cycle_status_constraints`). Migration `0008_ritual_decisions` **sem `RunPython`**. `RitualDecision` entrou em `TENANT_MODELS` e no espelho do teste, **primeiro na lista** (folha→raiz: purgar depois de `Task` faria o CASCADE levar as decisões e a linha do relatório diria `0`). `RitualDecisionFactory` + `register_isolation_case("bujo.RitualDecision")` (com o par `weekly × template`, o único cujo item não é Task). O guardrail de `TenantManager` em `core/tests/test_guardrails.py` pegou o model novo sem edição.
- **AC2** — `ALLOWED_DECISIONS` como matriz única no nível do módulo (3 células), `upsert_ritual_decision` `@transaction.atomic`. Matriz exaustiva testada em **12 células** (`itertools.product`): 3 legais, 9 ilegais, cada ilegal levantando `InvalidRitualDecision` **e não persistindo**. Alvo exigido em `planning` (os 4 regimes testados + alvo inexistente, que também **não materializa**). Idempotência provada em SQL com o helper `_sem_escrita` reusado da 14.1, mais o assert independente de `updated_at` intacto. `Task`/template provados intactos por **snapshot de todos os campos concretos** (não só `status`). Colisão da unique parcial é re-lida como upsert (não vira `CycleTargetConflict`) — escolha documentada inline. CASCADE coberto por teste.
- **AC3** — 4 endpoints semanais independentes. `monthly-in-week` traz **os dois** Monthly na semana de virada via `months_of_week`. `recurring` particiona pendentes × `alreadyPlaced` numa query anotada; `skip_week` tira do `pendingDecisionCount` **sem desativar o template e sem criar Task**; múltiplas instâncias no mesmo dia provadas legais. `previous-weekly` usa `previous_operational_weekly` (wrapper público novo em `cycles.py` delegando a `_previous_operational` — **não** uma segunda query), com o teste do ciclo `NULL` intermediário. `pending-dailies` agrupa por data em ordem crescente, uma query com `select_related`. "Monthly ampliado" **não** ganhou rota: registrado como servido por `logs/monthly/`.
- **AC4** — 3 endpoints mensais. Elegibilidade anual pela **mesma expressão** de `RecurringTaskTemplateListView` (`exclude(instances__monthly_log__month_first__year=…)`), com o teste que prova "sem parsing": anual alocado em **novembro** sai da elegibilidade de **março**. **Regra de dezembro emergente** — zero `if month == 12`, com teste-âncora nas duas metades (dezembro resolve; janeiro do ano seguinte não). Nenhuma fonte mensal expõe destino semanal (a matriz não tem célula que permita).
- **AC5** — `eligibleCount`/`pendingDecisionCount`/`reviewed` computados na leitura em `_envelope`; nenhuma coluna de contador (provado por teste que varre `_meta` dos 3 models). `reviewed = pendingDecisionCount == 0`, então **fonte vazia é revisada**. `countsTowardProgress` é `True` no envelope das 7 fontes e `False` nos buckets `alreadyPlaced`/`alreadyPlacedInYear`. `planning_completed_at` **não é escrito em lugar nenhum** desta story.
- **AC6** — `services/density.py` novo: só materializado no container-alvo, **com** subtarefas, 6 chaves de status sempre presentes, grade completa (7 dias / 28–31 com bissexto via `calendar.monthrange`) + faixa `undated`, registros e não linhagens. `TaskDensityView` e seus serializers **intocados**. Aceita alvo em qualquer estado e devolve grade zerada sem log.
- **AC7** — 10 rotas, **nenhum agregador**. Nenhum serviço materializa log (teste chama as 7 fontes + as 2 densidades para chaves sem log e afirma `(0, 0, 0)` em `WeeklyLog`/`MonthlyLog`/`Log`). `objects` em todo acesso; isolamento por tenant testado na camada de serviço e no fio com Bearer real; `401` nos 10 endpoints.
- **AC8** — caracterização das respostas legadas nomeadas (chaves de topo das 7 respostas de objeto + forma dos elementos das 2 de lista) mais um teste dedicado a "o `TaskSerializer` **não** ganhou `decision`" — `decision` vive no item da fonte porque é relativa a um alvo. Aliases de fila intactos. `schema.yaml`/`types.gen.ts` regenerados com **0 deleções**.

**Decisões de implementação registradas (nenhuma redecide a AD-28):**

1. `_ritual_decision_uniques()` deriva as 4 uniques do produto cartesiano em vez de escrevê-las quatro vezes — os quatro blocos seriam idênticos a menos dos nomes de coluna. Os **nomes** das constraints são exatamente os contratados (`uniq_ritual_decision_weekly_task` etc.), verificado na migration gerada.
2. `_blocking_previous_source()` extrai a mecânica das duas fontes bloqueantes (idênticas a menos do `source_id` e de qual log é "o anterior") — evita a dívida SHELL-DEBT-03/04 de copiar código entre gêmeos. Mesma disciplina em `_WeekSourceView`/`_MonthSourceView` e em `_envelope`/`_bucket`.
3. `pending-dailies` serializa `groups` e **não** `items`: as contagens derivadas são computadas sobre a lista plana e a chave `items` é removida do envelope antes de serializar (a fonte não tem forma plana no fio).
4. `has_undisposed` também foi promovido a público em `cycles.py`: um `readyToFinalize` que não fosse **o mesmo predicado** do gate de finalizar seria uma promessa que o botão não honraria.
5. `Count(..., distinct=True)` na anotação de instâncias do bloco anual: os dois sub-blocos aplicam um segundo filtro sobre a mesma relação multi-valorada, e o JOIN extra inflaria a contagem.
6. Sem `label` no backend (Questão aberta #3) e sem `DELETE` de decisão (Questão aberta #4) — ambas como a story contratou.

**Gaps de especificação:** nenhum encontrado. `architecture.md` (AD-28 item 6 + o adendo as-built da 14.1), `epics.md` (ACs da 14.2) e os spines M06/M07 cobriram tudo o que o código precisou; as 5 divergências que exigiam escolha já estavam resolvidas e documentadas nas Dev Notes/Questões abertas da própria story (fronteira dos Daily, exclusão do sucessor no Future Log, `sourceId` sem `label`, ausência de `DELETE`, densidade em qualquer estado). Nada a atualizar em documento-fonte.

### File List

**Backend — produção**
- `backend/bujo/models.py` — UPDATE: `RitualDecisionKind`, `_ritual_decision_uniques()`, `RitualDecision`
- `backend/bujo/migrations/0008_ritual_decisions.py` — **NEW** (schema puro, sem `RunPython`)
- `backend/bujo/services/rituals.py` — **NEW** (matriz, upsert, `decisions_for_target`, 7 fontes) · *code review A1: fontes bloqueantes deixaram de anotar decisão-snapshot*
- `backend/bujo/services/density.py` — **NEW** (`compute_week_density`, `compute_month_density`) · *code review M3: comentário do descarte fora-do-período corrigido*
- `backend/bujo/services/cycles.py` — UPDATE: `previous_operational_weekly`, `previous_operational_monthly`, `has_undisposed` (wrappers públicos)
- `backend/bujo/serializers.py` — UPDATE: envelope de fonte, itens, buckets, query serializers, densidade, decisão · *code review M1: `RitualDecisionSerializer` devolvendo `weekStart|monthFirst` + `taskId|recurringTemplateId`*
- `backend/bujo/views.py` — UPDATE: 10 views novas (2 bases parametrizadas + 10 concretas finas)
- `backend/bujo/urls.py` — UPDATE: 10 rotas novas
- `backend/bujo/management/commands/purge_e2e_users.py` — UPDATE: `RitualDecision` em `TENANT_MODELS` (primeiro na ordem)
- `backend/core/exceptions.py` — UPDATE: `InvalidRitualDecision`

**Backend — testes**
- `backend/bujo/tests/factories.py` — UPDATE: `RitualDecisionFactory` + `register_isolation_case("bujo.RitualDecision")`
- `backend/bujo/tests/test_models.py` — UPDATE: 8 testes (4 uniques parciais, 2 CHECKs *exactly-one*, enum, ausência de coluna de progresso)
- `backend/bujo/tests/test_services.py` — UPDATE: 36 testes (matriz 12 células, gates de alvo, idempotência em SQL, item intacto, CASCADE, elegibilidade das 7 fontes, densidade, zero-materialização, isolamento)
- `backend/bujo/tests/test_views.py` — UPDATE: 14 testes do `dev-story` (401 × 10, 400 de forma, 409 de matriz/estado, fio camelCase, caracterização da AC8) + **7 do passo de QA** (dois buckets da fonte mensal no fio, `keep_undated` e `skip_week` devolvendo 201 por HTTP, laço do ritual fim a fim, item de outro tenant na ESCRITA, 405 nos 9 endpoints de leitura e no `GET`/`DELETE` de `/ritual-decisions/`)
- `backend/bujo/tests/test_serializers.py` — UPDATE: 3 testes (forma do envelope, ausência de `label`, `byStatus` sem underscore)
- `backend/bujo/tests/test_purge_e2e_users.py` — UPDATE: lista espelho + purga efetiva de uma decisão

**Frontend — E2E (passo de QA, `bmad-qa-generate-e2e-tests`, 2026-07-25)**
- `frontend/e2e/ritual-sources.spec.ts` — **NEW** (spec E2E; 3 testes: AC7 sem materialização no banco real, AC1/AC2 sob concorrência, AC6/AC8 confrontadas com a UI)
- `frontend/e2e/countRitualContainers.ts` — **NEW** (helper de contagem via `manage.py shell` + `tenant_context`, mesma técnica de `seedFinalizedEmptyCycle.ts`)

**Contrato gerado (nunca editado à mão)**
- `schema.yaml` — UPDATE (regenerado; `583/0` no `dev-story`, **`594/0`** depois da correção M1 da code review)
- `frontend/src/api/types.gen.ts` — UPDATE (regenerado; `553/0` → **`562/0`**)

**Rastreamento**
- `_bmad-output/implementation-artifacts/14-2-fontes-dos-rituais-e-decisoes-snapshot-backend.md` — esta story
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `14-2` → `in-progress` → `review` → `done`
- `_bmad-output/story-automator/orchestration-14-20260725-024358.md` — UPDATE: bookkeeping do orquestrador do Épico 14 (acrescentado ao File List na code review; estava modificado em `git status` sem constar aqui)
- `_bmad-output/implementation-artifacts/tests/test-summary-14-2.md` — **NEW** (resumo do passo de QA: lacunas fechadas, achados, provas de não-vacuidade, gates)

**Artefatos de tipo novo nesta story** (nomeados explicitamente, como o guardrail exige): dois **módulos de serviço novos** (`bujo/services/rituals.py`, `bujo/services/density.py`), uma **migration nova** (`0008_ritual_decisions.py`), um **spec E2E novo** (`frontend/e2e/ritual-sources.spec.ts`) e um **helper de E2E novo** (`frontend/e2e/countRitualContainers.ts`). **Nenhum** management command novo, **nenhum** arquivo de frontend de produção escrito à mão.

> **Reconciliação pós-`dev-story` (feita no passo de QA, como o guardrail exige).** O `dev-story` fechou este File List afirmando "**Nenhum** spec E2E novo … Se o passo de QA criar spec/seed, este File List precisa ser reconciliado depois dele". A afirmação **ficou falsa** e está corrigida acima, não só no File List mas no texto: o passo de QA criou 1 spec E2E + 1 helper, somou 7 funções de teste de API (15 testes coletados) e criou o test-summary. Conferido contra `git status --short` e `git diff --stat`.

## Senior Developer Review (AI)

**Revisor:** Hugo (workflow `bmad-story-automator-review`, auto-fix) · **Data:** 2026-07-25 · **Resultado:** aprovada com correções aplicadas — **0 críticos remanescentes**.

**Alegações re-executadas antes de revisar (nada aceito de memória):** `uv run pytest` full-suite no HEAD recebido → **1209 passed em 328.75s**, exatamente o número declarado nas Completion Notes. `uv run ruff check` → limpo. `ruff format --check` nos dois arquivos novos → limpo. `npx tsc --noEmit` (Node 22.15.1) → limpo. `git diff --numstat schema.yaml frontend/src/api/types.gen.ts` → `583 0` / `553 0`, aditividade estrita confirmada. Advertência `ToStatusEnum` e os 4 "errors" de `spectacular` (`accounts/views.py:signup`, autenticador de `automation`) reproduzidos com a story fora do caminho: **pré-existentes**, como a story afirma. File List conferido contra `git status --porcelain`: um único arquivo modificado não constava (ver B2).

### 🔴 Alto — corrigido

**A1 — As fontes bloqueantes liam decisões-snapshot do log ANTERIOR, e podiam declarar `reviewed: true` com pendência de pé.**
`list_previous_weekly_pendings`/`list_previous_monthly_pendings` chamavam `decisions_for_target(weekly_log=previous)` e passavam o resultado para `_blocking_previous_source` — cujo próprio docstring afirmava que `pending_decision_count == eligible_count` "sempre", porque M06 é literal: o Weekly anterior **não oferece "manter"**. A afirmação não era imposta por construção. A matriz de `upsert_ritual_decision` casa apenas *tipos* de alvo e item, então `POST {decision: keep, weekStart: P, taskId: T}` é aceito com `T` ancorada no **próprio** weekly `P` enquanto `P` é o `planning`. Quando `P` vira `active` e `P+1` entra em planejamento, `previous-weekly?week_start=P+1` devolvia `T` com `decision: "keep"` — item aberto **fora** de `pendingDecisionCount`, `reviewed` virando `true`, e a UI oferecendo "semana anterior pronta para finalizar" enquanto `start_weekly` responderia 409. É exatamente a divergência entre fonte e gate que `previous_operational_*` foi promovido a público para impedir, entrando pela outra porta. **Correção:** a mecânica bloqueante não consulta decisão nenhuma (`_task_items(tasks, {})`), então o invariante passa a ser construção e não coincidência; as duas queries inúteis saíram junto. Docstring reescrito com o porquê. Teste novo `test_fonte_weekly_anterior_ignora_decisao_snapshot_gravada_no_log_anterior`, **provado não-vácuo** (experimento (h) abaixo).

### 🟡 Médios — corrigidos

**M1 — A resposta do `POST /api/bujo/ritual-decisions/` não era a contratada, e não permitia ao cliente saber a que ritual a decisão pertence.** A Task 7 contratou `id, decision, week_start|month_first, task_id|recurring_template_id, created_at, updated_at`; o entregue era um `ModelSerializer` devolvendo `weeklyLog`/`monthlyLog`/`task`/`recurringTemplate` — ids de log opacos, no lugar da chave de período que o cliente usou para endereçar o ritual, e o item sob nome de FK em vez de `…Id`. Um cliente que POSTa `weekStart` recebia um UUID que ele não tem de onde conhecer. **Correção:** `RitualDecisionSerializer` reescrito como `Serializer` explícito, com `week_start`/`month_first` derivados do log (`SerializerMethodField` + `extend_schema_field(DateField)`) e `task_id`/`recurring_template_id`. Os 3 testes de fio da decisão atualizados, mais um assert novo do **conjunto** de chaves (a forma agora é travada, não só campos avulsos). `schema.yaml` e `types.gen.ts` regenerados: **`594 0`** e **`562 0`** — 0 deleções preservadas, AC8 intacta.

**M2 — Dev Notes, ambiguidade #3 afirmava um gate que não existe e não pode existir.** O texto dizia "fontes **e** decisões exigem alvo `status == 'planning'`". Nenhuma das 7 fontes tem esse gate, e não poderia ter: o guardrail de zero-materialização da AC7 chama as 7 fontes e as 2 densidades para chaves **sem log** e espera envelope vazio, o que um gate de `planning` só conseguiria atender materializando o alvo ou devolvendo 409 onde a AC contrata `eligibleCount: 0`. O código está certo, o documento estava errado — e é o documento que 14.5/14.6 vão ler. **Correção:** ambiguidade #3 reescrita separando escrita (com gate) de leitura (sem gate), com o motivo.

**M3 — O comentário que justifica o descarte na densidade apoiava-se numa premissa falsa.** `density._fill` ignora tarefa cujo `scheduled_date` cai fora do período do próprio container, dizendo "não deveria existir (os writes validam)". A criação valida (`WeeklyTaskCreateSerializer`/`MonthlyTaskCreateSerializer`), mas o `PATCH /api/bujo/tasks/<id>/` **não**: `TaskUpdateSerializer.scheduled_date` → `update_task` → `_apply_fields` grava qualquer data sem revalidar o período. O ramo é alcançável. **Não é defeito de comportamento** — ignorar é o que `WeeklyLogView` (`days` por `scheduled_date=day` + `unscheduled` por `IS NULL`) e `MonthlyLogView` já fazem com o mesmo registro, então a densidade concorda com a superfície legada em vez de divergir dela. **Correção:** comentário substituído pela razão real (paridade com o legado) e pelas três alternativas que seriam mentira (somar a um dia errado, inventar dia fora da grade, jogar em `undated` um registro que **tem** dia). Zero mudança de comportamento; a dívida real é do `PATCH`, fora do escopo desta story.

### 🟢 Baixos

**B1 — corrigido.** O assert de `/api/bujo/future-log/` em `test_ac8_contrato_legado_preservado_nas_nove_respostas_nomeadas` era **vácuo**: `isinstance(json(), list)` passa com lista vazia, e a fonte só devolve meses futuros com tarefa raiz — nenhum era semeado. Agora o teste semeia um Monthly futuro relativo a `today_for(user)` e afirma `{year, month, tasks}`. (A forma já tinha cobertura equivalente na 14.1, `test_ac5_caracterizacao_das_filas_e_do_arquivo`; o problema era o teste desta story prometer 9 respostas e entregar 8 + uma tautologia.)

**B2 — corrigido.** `_bmad-output/story-automator/orchestration-14-20260725-024358.md` aparecia modificado em `git status` sem constar no File List. Acrescentado em §Rastreamento.

**B3 — registrado, sem mudança de código.** A AC3 fonte 2 define `pendentes` como "sem instância no weekly-alvo **e sem decisão `skip_week` para esse alvo}"; a Task 4 contrata o oposto ("um template com `skip_week` **continua em `pending` na lista**, mas com `decision`… e portanto fora de `pendingDecisionCount`"), e é a Task 4 que o código segue. O comportamento entregue é o que M06 pede — "remove o aviso sem desativar o template", com o aviso derivado de `reviewed` — e é o que a AC5 exige ("cada item carrega `decision`"). Um template que desaparecesse da lista ao receber `skip_week` seria indistinguível de desativado na tela. O parêntese da AC ficou solto; nada a corrigir no código, e o texto da AC não é reescrito em review.

### Gates após as correções

`uv run pytest` full-suite (sem escopo de caminho) → **1210 passed em 329.14s** (1209 + 1 teste novo de regressão do A1; divisão derivada da função de teste acrescentada, não por subtração). `uv run ruff check` → **All checks passed**; `ruff format --check` nos dois arquivos novos → limpo; `uv run lint-imports` → **1 kept, 0 broken**. `npx tsc --noEmit` (Node 22.15.1) → limpo. `git diff --numstat schema.yaml frontend/src/api/types.gen.ts` → **`594 0`** / **`562 0`**. E2E **não** reexecutado: nenhuma correção toca UI, `ritual-sources.spec.ts` não assere os campos renomeados de M1 (ele lê `id` e `status()` do POST) e as leituras de fonte que ele percorre não mudaram de forma; a falha pré-existente de `recurring-templates.spec.ts:306` segue registrada para a triagem de frontend aberta.

## Change Log

| Data | Mudança |
|---|---|
| 2026-07-25 | **Code review (story-automator, auto-fix)** — 0 críticos; 1 alto + 3 médios + 2 baixos corrigidos, 1 baixo registrado. **A1:** as fontes bloqueantes liam as decisões-snapshot do log anterior, então um `keep` gravado sobre uma Task do próprio weekly-anterior (combinação que a matriz aceita, porque ela casa só *tipos*) tirava um item aberto de `pendingDecisionCount` e podia declarar `reviewed: true` — "semana anterior pronta para finalizar" com o gate de Iniciar respondendo 409; agora a mecânica bloqueante não consulta decisão nenhuma, o invariante `pendingDecisionCount == eligibleCount` é construção, e um teste novo (não-vácuo, experimento (h)) o trava. **M1:** resposta do `POST /ritual-decisions/` devolvia ids de log opacos em vez da chave de período contratada na Task 7 — reescrita para `weekStart|monthFirst` + `taskId|recurringTemplateId`, com assert do conjunto de chaves; `schema.yaml`/`types.gen.ts` regenerados (`594/0` e `562/0`, 0 deleções preservadas). **M2:** ambiguidade #3 das Dev Notes afirmava gate de `planning` nas fontes, que não existe nem pode existir (o guardrail de zero-materialização da AC7 exige resposta para chaves sem log) — redação corrigida separando escrita de leitura. **M3:** comentário de `density.py` justificava o descarte de tarefa fora do período com "os writes validam", falso para o `PATCH /tasks/<id>/`; razão real registrada (paridade com `WeeklyLogView`), zero mudança de comportamento. **B1:** assert vácuo de `/future-log/` (lista vazia passava) fortalecido com mês futuro semeado. **B2:** arquivo de orquestração acrescentado ao File List. **B3** registrado: o parêntese da AC3 fonte 2 divergindo da Task 4; a Task 4 é a especificação operante e o comportamento entregue é o do M06. Gates pós-correção: pytest **1210 passed**, ruff/format limpos, tsc limpo, 0 deleções no contrato gerado. |
| 2026-07-25 | Story 14.2 implementada. `ritual_decisions` (model + migration `0008` + 7 constraints) com âncoras exclusivas e 4 uniques parciais por combinação; `InvalidRitualDecision` nova (409); `bujo/services/rituals.py` com a matriz única de 3 decisões legais, `upsert_ritual_decision` idempotente (provado em SQL) que jamais toca a `Task`, e as 7 fontes de ritual como funções independentes; `bujo/services/density.py` com a densidade real (só materializado no alvo, com subtarefas, 6 status, grade completa + `undated`); `previous_operational_weekly`/`previous_operational_monthly`/`has_undisposed` promovidos a públicos em `cycles.py` para que a fonte bloqueante não divirja do gate de Iniciar; 10 endpoints novos (7 fontes + 2 densidades + `POST /ritual-decisions/`), sem agregador. Contrato legado intocado e caracterizado; `schema.yaml`/`types.gen.ts` regenerados com 0 deleções. Gates: pytest full-suite **1194 passed** em 325.49s (1099 herdados + 95 novos, divisão derivada de `git diff`), `ruff check` limpo, `lint-imports` 1/0, `tsc` limpo, migration aplicada a `dev` e à branch Neon `e2e`. |
| 2026-07-25 | **Passo de QA** (`bmad-qa-generate-e2e-tests`): +7 funções de teste de API (**15** testes coletados) fechando as lacunas de FIO que o `dev-story` deixou — os dois buckets da fonte mensal de recorrentes (incluindo a camelização de `alreadyPlacedInYear`), as células `keep_undated` e `skip_week` devolvendo 201 por HTTP pela primeira vez, o **laço do ritual fim a fim** (ler fonte → decidir → reler, provando que `pendingDecisionCount` cai sem que `eligibleCount` mude), isolamento por tenant na **escrita**, e o 405 fixando que fonte/densidade são leitura e que `/ritual-decisions/` não lista nem deleta. +1 spec E2E (`ritual-sources.spec.ts`, 3 testes) e +1 helper (`countRitualContainers.ts`) contra a branch Neon `e2e`: AC7 provada por contagem fora do fio, upsert convergindo sob dois POSTs simultâneos pelo índice único parcial real, densidade confrontada com a UI. 4 experimentos de não-vacuidade (3 reversões + 1 evidência direta dos índices em `pg_indexes`). Achado documentado: a subtarefa aparece aninhada no dia do pai mas conta como `undated` na densidade — insumo para o heatmap das 14.5/14.6. Nenhum defeito de produção; nenhum arquivo de produção alterado. Full-suite: **1209 passed** em 328.15s. |
