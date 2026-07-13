---
baseline_commit: bdb800e93af84aabd71eaaab2ed218a0422ff8c8
---

# Story 4.1: Logs Weekly, Monthly e Future

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Hugo,
I want acessar o Weekly Log, o Monthly Log e o Future Log,
so that eu planeje tarefas no horizonte certo, com a semântica de calendário correta (FR-1.1 W/M/F, FR-1.2, UX-DR9).

## Acceptance Criteria

**Given** os models de log de planejamento,
**When** implementados,
**Then** `weekly_log` é chaveado por `(user_id, week_start DATE)` com `CHECK` de que `week_start` é segunda-feira, e `monthly_log` por `(user_id, month_first DATE)` com `CHECK` de que é dia 1; o pertencimento a mês/ano é derivado na leitura (nunca ordinal duplicado),
**And** as superfícies usam `week_start_of`/`weeks_of_month`/`months_of_week` de `core/calendar.py`.

**Given** o Future Log,
**When** Hugo adiciona um item,
**Then** aceita data completa (mês + dia, ex.: prefixo `(14)`) ou parcial (só mês, exibida "— jul"),
**And** os itens são agrupados por mês ("Julho 2026") e consultáveis por período.

**Given** o Weekly Log no mobile,
**When** aberto,
**Then** exibe um dia por vez com seletor de dia horizontal (sem scroll horizontal); no desktop exibe os 7 dias quando a viewport permite,
**And** o Monthly Log no mobile é lista vertical de datas (sem grid de calendário).

## Tasks / Subtasks

> **Ordem de execução:** backend (models/alteração do Task → migration → serviços → serializers/views/urls → contrato) antes do frontend (types → data layer → páginas/componentes). Task 5 (regenerar contrato) é o pivô.
>
> **⚠️ Esta story ALTERA o schema do `Task`** (que o Epic 3 congelou assumindo só daily log). O modelo real do Epic 4 exige que uma tarefa possa pertencer a daily/weekly/monthly log — decisão de arquitetura aprovada por Hugo (ver Dev Notes "Modelo de vínculo Task↔log"). A alteração é **aditiva e segura** (colunas nuláveis + CHECK que as linhas existentes já satisfazem) e é devolvida à `architecture.md` na Task 10.

- [x] **Task 1: Models de log + generalização do vínculo `Task`↔log** (AC: #1, #2)
  - [x] 1.1 Em `backend/bujo/models.py`, adicionar `WeeklyLog(TenantModel)` e `MonthlyLog(TenantModel)` (tabelas **separadas**, como AD-05). Herdam `TenantModel` (PK UUID, `user_id` auto-escopado) → **não** declarar `user_id`; o `PRIMARY KEY (user_id, ...)` do SQL de AD-05 vira `UniqueConstraint` sobre a PK UUID herdada (mesmo padrão do `Log` existente). `body` é `JSONField(default=dict, blank=True)` — inerte nesta story; existe para o estado de fechamento/metadados das Stories 4.3/4.6:
    ```python
    from django.db.models import Q
    from django.db.models.functions import ExtractDay, ExtractIsoWeekDay

    class WeeklyLog(TenantModel):
        """Weekly Log — um por (user, week_start), week_start SEMPRE segunda (AD-05)."""
        week_start = models.DateField()
        body = models.JSONField(default=dict, blank=True)

        class Meta:
            db_table = "weekly_log"
            constraints = [
                models.UniqueConstraint(fields=["user_id", "week_start"], name="uniq_weekly_log_user_id_week_start"),
                models.CheckConstraint(condition=Q(week_start__iso_week_day=1), name="week_start_is_monday"),
            ]

    class MonthlyLog(TenantModel):
        """Monthly Log — um por (user, month_first), month_first SEMPRE dia 1 (AD-05).

        O Future Log NÃO é uma entidade separada: é o conjunto dos MonthlyLog de
        meses futuros (ver Dev Notes "Future Log = monthly_log futuro").
        """
        month_first = models.DateField()
        body = models.JSONField(default=dict, blank=True)

        class Meta:
            db_table = "monthly_log"
            constraints = [
                models.UniqueConstraint(fields=["user_id", "month_first"], name="uniq_monthly_log_user_id_month_first"),
                models.CheckConstraint(condition=Q(month_first__day=1), name="month_first_is_day_one"),
            ]
    ```
    **Confirmar o lookup ISO contra Django 5.2 antes de fechar:** o alvo é `CHECK EXTRACT(ISODOW FROM week_start)=1` (Postgres ISODOW: segunda=1). Se `week_start__iso_week_day=1` não for um lookup registrado nesta versão, construir o CHECK com a função `ExtractIsoWeekDay("week_start")`. O teste-âncora da Task 6.1 (inserir não-segunda → `IntegrityError`) é a prova real — o CHECK é imposto pelo Postgres, não pelo Python; um lookup errado gera um CHECK que sempre passa (bug silencioso).
  - [x] 1.2 **Generalizar o `Task`** (mesmo arquivo). Hoje `log = ForeignKey(Log, ...)` é obrigatório e é o único vínculo. Passar a: `log` nulável + duas FKs nuláveis novas (`weekly_log`, `monthly_log`) + `scheduled_date` nulável + CHECK de **exatamente um** dos três vínculos preenchido. As três FKs apontam para models **diferentes**, então `related_name="tasks"` pode se repetir sem colisão (unicidade de `related_name` é por model-alvo):
    ```python
    log = models.ForeignKey(Log, null=True, blank=True, on_delete=models.CASCADE, related_name="tasks")
    weekly_log = models.ForeignKey(WeeklyLog, null=True, blank=True, on_delete=models.CASCADE, related_name="tasks")
    monthly_log = models.ForeignKey(MonthlyLog, null=True, blank=True, on_delete=models.CASCADE, related_name="tasks")
    # Dia específico opcional dentro de um weekly/monthly log. null = "só o mês/semana,
    # sem dia" (Future Log parcial, FR-1.2). Em daily log fica null (o dia é o do log).
    scheduled_date = models.DateField(null=True, blank=True)
    ```
    Adicionar ao `Meta.constraints` do `Task` (ao lado de `task_status_valid`) o CHECK de exatamente-um:
    ```python
    models.CheckConstraint(
        condition=(
            Q(log__isnull=False, weekly_log__isnull=True, monthly_log__isnull=True)
            | Q(log__isnull=True, weekly_log__isnull=False, monthly_log__isnull=True)
            | Q(log__isnull=True, weekly_log__isnull=True, monthly_log__isnull=False)
        ),
        name="task_exactly_one_log",
    ),
    ```
    **Não** mexer em nenhum outro campo do `Task` (status/eisenhower/category/order_index/lineage/parent_task/source_template_id continuam intactos).
  - [x] 1.3 Registrar `WeeklyLog`, `MonthlyLog` em `backend/bujo/admin.py` (mesmo padrão `@admin.register` de `Log`/`Task`) — útil para semear tarefas de weekly/monthly na verificação manual (Task 9.6), já que 4.1 não expõe UI de criação em weekly log.

- [x] **Task 2: Migration** (AC: #1, #2)
  - [x] 2.1 `cd backend && uv run python manage.py makemigrations bujo` → `0003_*.py`. Deve conter: `CreateModel` de `WeeklyLog`/`MonthlyLog`; `AlterField` de `Task.log` (nulável); `AddField` de `Task.weekly_log`/`monthly_log`/`scheduled_date`; `AddConstraint` `task_exactly_one_log`. **Nenhuma** mudança nos demais campos de `Task`/`Log`.
  - [x] 2.2 `uv run python manage.py migrate` — a adição do CHECK `task_exactly_one_log` numa tabela `tasks` já populada é **segura**: linhas existentes têm `log_id` preenchido e as duas FKs novas nulas → satisfazem "exatamente um". Confirmar `uv run python manage.py check` — 0 erros.

- [x] **Task 3: Camada de serviço — anchors de log + create genérico** (AC: #1, #2)
  - [x] 3.1 Em `backend/bujo/services/logs.py` (estender — hoje só `get_or_create_daily_log`), adicionar `get_or_create_weekly_log(*, user, week_start)` e `get_or_create_monthly_log(*, user, month_first)`, idempotentes, `*, user` primeiro kwarg (§6.2). A chave chega **já normalizada** pelo calendário (a view resolve via `week_start_of`/dia-1) — o serviço não normaliza (mesma disciplina do `get_or_create_daily_log`):
    ```python
    from bujo.models import Log, MonthlyLog, WeeklyLog

    @transaction.atomic
    def get_or_create_weekly_log(*, user, week_start) -> WeeklyLog:
        log, _ = WeeklyLog.objects.get_or_create(week_start=week_start)
        return log

    @transaction.atomic
    def get_or_create_monthly_log(*, user, month_first) -> MonthlyLog:
        log, _ = MonthlyLog.objects.get_or_create(month_first=month_first)
        return log
    ```
  - [x] 3.2 Em `backend/bujo/services/tasks.py`, **generalizar `create_task`** para aceitar qualquer um dos três containers + `scheduled_date`. Hoje a assinatura é `(*, user, log, title, ..., parent_task=None)` e os `siblings` são escopados por `log` + `parent_task`. Passar a escopar por **o container real da tarefa** (os três campos de FK, dois nulos):
    ```python
    @transaction.atomic
    def create_task(*, user, log=None, weekly_log=None, monthly_log=None, scheduled_date=None,
                    title, description=None, eisenhower=None, category=None, parent_task=None) -> Task:
        # order_index por irmãos: mesmo container (log/weekly_log/monthly_log) + mesmo parent.
        # Django filtra field=None como IS NULL, então os dois containers nulos entram no filtro.
        siblings = Task.objects.filter(
            log=log, weekly_log=weekly_log, monthly_log=monthly_log, parent_task=parent_task
        )
        max_order = siblings.aggregate(models.Max("order_index"))["order_index__max"]
        order_index = 0.0 if max_order is None else max_order + 1.0
        return Task.objects.create(
            log=log, weekly_log=weekly_log, monthly_log=monthly_log, scheduled_date=scheduled_date,
            parent_task=parent_task, title=title, description=description,
            eisenhower=eisenhower, category=category, order_index=order_index, status=Task.Status.PENDING,
        )
    ```
    O CHECK `task_exactly_one_log` garante no banco que o chamador passou exatamente um container — o serviço não precisa validar isso à mão (falha vira `IntegrityError`, mas as views desta story sempre passam exatamente um).
  - [x] 3.3 Atualizar `SubtaskCreateView` (em `views.py`) para a subtarefa **herdar o container do pai** (hoje passa só `log=parent.log`): passar `log=parent.log, weekly_log=parent.weekly_log, monthly_log=parent.monthly_log` no `create_task`. Assim uma subtarefa de uma tarefa de monthly log nasce no mesmo monthly log (AD-08 item 12 generalizado). `TaskCreateView` (daily) continua chamando `create_task(log=<daily>, ...)` — comportamento inalterado.
  - [x] 3.4 **Nota de correção defensiva (não expandir escopo):** `reorder_task` escopa `siblings` só por `log=task.log`. Para tarefas **daily** (o único caso reordenável nesta story) isso continua correto (os irmãos daily também têm weekly/monthly nulos). Adicionar `weekly_log=task.weekly_log, monthly_log=task.monthly_log` ao filtro de `siblings` em `reorder_task` **por correção** — sem isso, se uma tarefa de weekly/monthly (com `log=None`) fosse reordenada numa story futura, `filter(log=None)` casaria com TODAS as tarefas de todos os weekly/monthly logs. É uma linha, evita uma bomba-relógio para a 4.x. Nenhuma outra mudança em `reorder_task`.
  - [x] 3.5 `backend/bujo/tests/test_services.py` (estender): `get_or_create_weekly_log`/`monthly_log` idempotentes e escopados por tenant; `create_task` com `monthly_log=` e `scheduled_date=` grava e calcula `order_index` por container (duas tarefas no mesmo monthly_log → 0.0/1.0; tarefa em outro monthly_log → 0.0); subtarefa herda o container do pai (via `SubtaskCreateView` → cobrir em test_views); `reorder_task` de duas tarefas daily continua correto com o filtro ampliado.

- [x] **Task 4: Serializers + views + URLs** (AC: #1, #2, #3)
  - [x] 4.1 Em `backend/bujo/serializers.py` (estender). `TaskSerializer` já existe e serializa `id/title/description/status/eisenhower/category/subtasks` — **acrescentar `scheduledDate`** (campo `scheduled_date`, camelCase automático) aos `fields`, pois o Weekly/Monthly precisam saber o dia da tarefa. Adicionar:
    - `WeeklyDaySerializer` — `{ date, tasks }` por dia da semana (tarefas do `weekly_log` cujo `scheduled_date` cai naquele dia; raízes via `parent_task__isnull=True`).
    - `WeeklyLogSerializer` — `{ weekStart, days: [7x], unscheduled: [tasks do weekly_log sem scheduled_date] }`.
    - `MonthlyLogSerializer` — `{ monthFirst, tasks: [...] }` (todas as tarefas-raiz do `monthly_log`; cada uma com `scheduledDate` nulo ou preenchido — o agrupamento por dia é feito no frontend).
    - `FutureLogMonthGroupSerializer` — `{ year, month, tasks: [...] }` para a lista agrupada por mês.
    - `MonthlyTaskCreateSerializer` — write: `{ monthFirst (DATE), title, scheduledDate? (DATE, allow_null), description?, eisenhower?, category? }`; validar que, se `scheduledDate` presente, o mês/ano dela bate com `monthFirst` (dia dentro do mês do log).
    Declarar campos em snake_case; a borda converte para camelCase (§6.3) — **não** renomear à mão.
  - [x] 4.2 Em `backend/bujo/views.py` (estender — views finas, padrão `TodayLogView`), adicionar:
    - `WeeklyLogView(APIView)` GET: query param opcional `week_start`; ausente → `week_start_of(today_for(request.user))`; presente → normalizar com `week_start_of`. `get_or_create_weekly_log` para a âncora; montar 7 dias + `unscheduled` a partir de `weekly_log.tasks`.
    - `MonthlyLogView(APIView)` GET + POST. GET: query param opcional `month_first` (ausente → dia 1 de `today_for`; presente → normalizar p/ dia 1); `get_or_create_monthly_log`; retornar `monthly_log.tasks` raízes. POST: `MonthlyTaskCreateSerializer` → `get_or_create_monthly_log(month_first=...)` → `create_task(monthly_log=log, scheduled_date=..., ...)`. **É este POST que implementa "adicionar item ao Future Log"** quando `monthFirst` é de um mês futuro (ver Dev Notes).
    - `FutureLogView(APIView)` GET: lista os `MonthlyLog` com `month_first` **> mês corrente** que têm tarefas, agrupados por mês em ordem cronológica (usa `MonthlyLog.objects` auto-escopado; "mês corrente" via `today_for`). (Adicionar itens ao Future Log reusa o `POST /logs/monthly/` acima com um `monthFirst` futuro — não precisa de POST separado.)
    - `FutureLogItemView` **não é necessária** (não há entidade separada; editar/excluir um item futuro = editar/excluir a `Task` via os endpoints de tarefa já existentes — `PATCH /tasks/{id}/`, transição/cancelamento). Um item do Future Log **é** uma `Task` num monthly_log futuro.
    Todas com `@extend_schema` explícito.
  - [x] 4.3 Em `backend/bujo/urls.py` (estender, preservando as 6 rotas existentes):
    ```python
    path("logs/weekly/", WeeklyLogView.as_view(), name="bujo-weekly-log"),
    path("logs/monthly/", MonthlyLogView.as_view(), name="bujo-monthly-log"),   # GET + POST
    path("future-log/", FutureLogView.as_view(), name="bujo-future-log"),
    ```
  - [x] 4.4 `backend/bujo/tests/test_views.py` (estender): `GET /logs/weekly/` sem param → semana corrente, `weekStart` é segunda, tarefa com `scheduledDate` no dia certo, tarefa sem dia em `unscheduled`; `?week_start=` no meio da semana normaliza p/ segunda; escopo por tenant. `GET /logs/monthly/` idem (dia 1). `POST /logs/monthly/` com `scheduledDate` (dia definido) e sem (só mês) → 201, tarefa no `monthly_log` certo; `scheduledDate` fora do mês → 400. `GET /future-log/` agrupa meses futuros com tarefas em ordem cronológica; mês corrente **não** aparece. `POST /logs/monthly/` num mês futuro cria o item do Future Log e ele aparece no `GET /future-log/`. Subtarefa (`POST /tasks/{id}/subtasks/`) de uma tarefa de monthly log herda o `monthly_log` do pai (não vai para daily).

- [x] **Task 5: Regenerar o contrato de API** (AC: #1, #2, #3)
  - [x] 5.1 `cd backend && uv run python manage.py spectacular --file ../schema.yaml`
  - [x] 5.2 `cd frontend && npm run generate-types`
  - [x] 5.3 Confirmar que o step de CI "Verificar types.gen.ts está atualizado" (Story 1.4) passa sem diff residual.
  - [x] 5.4 Esta story **não** toca `DEFAULT_AUTHENTICATION_CLASSES` nem config de auth — confirmar no diff do `schema.yaml` que só entraram paths/schemas novos e que os blocos `security` dos endpoints existentes seguem intactos (guardrail da retro Epic 3 §3; o CI só compara os tipos TS, que não capturam a perda de `security`). Ver Dev Notes.

- [x] **Task 6: Testes de model + guardrails de schema** (AC: #1)
  - [x] 6.1 `backend/bujo/tests/test_models.py` (estender): **CHECK segunda** — `WeeklyLog(week_start=terça)` → `IntegrityError`; segunda grava. **CHECK dia-1** — `MonthlyLog(month_first=dia 2)` → `IntegrityError`; dia 1 grava. **CHECK exatamente-um** — `Task` com nenhum container → `IntegrityError`; com dois containers (ex.: `log` + `monthly_log`) → `IntegrityError`; com exatamente um grava. `UniqueConstraint` por `(user, week_start)`/`(user, month_first)`: segundo insert do mesmo par → `IntegrityError`. `scheduled_date` nulável grava com e sem valor.
  - [x] 6.2 `backend/bujo/tests/factories.py` (estender): `WeeklyLogFactory` (usa `week_start_of` p/ garantir segunda), `MonthlyLogFactory` (dia 1). Ajustar `TaskFactory`: hoje sempre seta `log` (daily) — manter esse default (linhas existentes/testes daily continuam válidas), mas permitir `weekly_log=`/`monthly_log=` sobrescrevendo `log=None` (traits `factory_boy` ou params) para semear tarefas de weekly/monthly nos testes de view. Garantir que o default nunca preencha dois containers (violaria o CHECK).

- [x] **Task 7: Camada de dados do frontend** (AC: #2, #3)
  - [x] 7.1 Em `frontend/src/api/keys.ts` (estender a seção `bujo`, preservando `todayLog`), padrão canônico `[escopo, entidade, discriminador, params?]`:
    ```typescript
    bujo: {
      todayLog: () => ['bujo', 'dailyLog', 'today'] as const,
      weeklyLog: (weekStart?: string) => ['bujo', 'weeklyLog', weekStart ?? 'current'] as const,
      monthlyLog: (monthFirst?: string) => ['bujo', 'monthlyLog', monthFirst ?? 'current'] as const,
      futureLog: () => ['bujo', 'futureLog', 'list'] as const,
    },
    ```
  - [x] 7.2 Em `frontend/src/features/bujo/types.ts` (estender), exportar tipos novos via `components['schemas'][...]` (nomes exatos conforme o `schema.yaml` gerado — conferir após Task 5): `WeeklyLog`, `MonthlyLog`, `FutureLogMonthGroup`. `Task` já existe — confirmar que ganhou `scheduledDate` após a regeneração.
  - [x] 7.3 Em `frontend/src/features/bujo/api.ts` (estender): `useWeeklyLogQuery(weekStart?)`, `useMonthlyLogQuery(monthFirst?)`, `useFutureLogQuery()` (queries simples como `useTodayLogQuery`, com o param como query string quando presente) e `useCreateMonthlyTaskMutation()` (POST `/api/bujo/logs/monthly/`). A mutação invalida `keys.bujo.monthlyLog(monthFirst)` **e** `keys.bujo.futureLog()` no `onSuccess` (`queryClient.invalidateQueries`) — adicionar ao mês futuro precisa refletir na lista do Future Log. **Optimistic update é opcional aqui** (ação de formulário deliberada, não clique de estado); um `invalidateQueries` simples basta e evita reconstruir o agrupamento por mês no cliente (a retro do Epic 3 valoriza "sem complexidade sem necessidade"). Reusar `useOptimisticMutation` só se agregar valor real.
  - [x] 7.4 Exportar os novos hooks em `frontend/src/features/bujo/index.ts` (barrel).
  - [x] 7.5 `frontend/src/features/bujo/api.test.tsx` (estender): cada query bate no endpoint/param certo; a mutação de criar tarefa mensal invalida `monthlyLog` e `futureLog`.

- [x] **Task 8: Páginas Weekly / Monthly / Future + roteamento** (AC: #3)
  - [x] 8.1 Criar `frontend/src/pages/planner/WeeklyPage.tsx`, `MonthlyPage.tsx`, `FuturePage.tsx` (novo diretório `pages/planner/`), espelhando `pages/daily/DailyPage.tsx`: `<Box component="main" aria-label="...">`, `isPending` → skeleton, `!data → null`. Cada uma consome sua query da Task 7.3.
  - [x] 8.2 Em `frontend/src/app/router.tsx`, trocar os três `PlaceholderPage` de `planner/week|month|future` pelas páginas reais, **preservando** os `handle: { title }` ("Esta Semana"/"Este Mês"/"Futuro"). Manter o import de `PlaceholderPage` (ainda usado por outras rotas).
  - [x] 8.3 **Weekly Log — responsivo (AC #3):** `useMediaQuery('(max-width: 767px)')` (breakpoint canônico de `TaskRow`/`TaskDetailPanel` — não criar outro). Desktop: 7 dias lado a lado (grid/flex que comprime proporcionalmente, **nunca** scroll horizontal invisível — EXPERIENCE.md §responsividade). Mobile: `WeekDaySelector.tsx` (novo — chips/abas horizontais "Seg…Dom", sem swipe) controlando o dia único exibido. Cada dia reusa `DayHeader` + `TaskRow` **somente-leitura** (só a prop `task`; sem `onTransition`/`onReorder`/`onOpenDetail` — migração/transição a partir do Weekly é escopo da 4.2/4.3). Renderizar também a seção `unscheduled` (tarefas do weekly log sem dia). **Nota:** nesta story o weekly log fica majoritariamente vazio até a migração existir (4.2/4.3) — as tarefas de weekly log chegam por lá; aqui é a superfície/scaffolding responsiva. Os testes usam factories para semear tarefas de weekly log; a verificação manual pode semear via admin.
  - [x] 8.4 **Monthly Log — responsivo (AC #3):** mobile = lista vertical de datas (sem grid de calendário). Agrupar `monthly_log.tasks` por `scheduledDate` (um `DayHeader` por dia com tarefa) + uma seção "Sem dia definido" para as de `scheduledDate` nulo. `TaskRow` somente-leitura. Estado vazio: "Nenhuma tarefa neste mês." Desktop pode manter a mesma lista vertical (o grid/mini-calendário do decision-log é refinamento futuro, não exigido por AC). Incluir um formulário de adicionar tarefa ao mês (título + dia opcional) usando `useCreateMonthlyTaskMutation` — é o mesmo mecanismo do Future Log, mas para o mês corrente.
  - [x] 8.5 **Future Log (AC #2):** a página lista os grupos de `useFutureLogQuery()` — cabeçalho "Julho 2026" por mês, cada tarefa exibindo prefixo `(14)` quando tem `scheduledDate` ou "— jul" quando só mês (EXPERIENCE.md §4.7 / decision-log "•(10) Pix VG" / "— jul"). Componente `FutureLogItemForm.tsx` (novo): título + seletor de mês/ano + dia **opcional** → `useCreateMonthlyTaskMutation({ monthFirst, scheduledDate?, title })`. Estados vazios (geral e por mês). Adicionar um item = criar uma tarefa no monthly_log daquele mês futuro (ver Dev Notes "Future Log = monthly_log futuro").
  - [x] 8.6 Skeleton: um `PlannerSkeleton.tsx` genérico (adaptar de `DailyLogSkeleton.tsx`) serve às três superfícies.

- [x] **Task 9: Testes de frontend + verificação manual** (AC: #2, #3)
  - [x] 9.1 `WeekDaySelector.test.tsx` (novo): renderiza 7 dias; clicar muda o dia selecionado (callback); `jest-axe` contra o componente **real** (a retro Epic 3 lembra: `jest-axe` em componente mockado não pega nada).
  - [x] 9.2 `FutureLogItemForm.test.tsx` (novo): submeter só-mês → mutação sem `scheduledDate`; mês+dia → com `scheduledDate`; `jest-axe`.
  - [x] 9.3 `WeeklyPage.test.tsx`/`MonthlyPage.test.tsx`/`FuturePage.test.tsx` (novos): desktop 7 dias / lista de datas; mobile (mock `useMediaQuery`) seletor de dia / lista vertical; tarefa com dia no dia certo e tarefa sem dia na seção "sem dia"/`unscheduled`; agrupamento por mês no Future; estados vazios; `jest-axe` em cada página **real** (não mockar os componentes internos auditados — lição da 3.3).
  - [x] 9.4 `cd backend && uv run pytest && uv run ruff check . && uv run lint-imports && uv run python manage.py check` — **214 passed** (pytest), ruff `All checks passed!`, lint-imports `1 kept, 0 broken`, `manage.py check`: 0 erros.
  - [x] 9.5 `cd frontend && npm run typecheck && npm run lint && npm run build && npm run test` — typecheck/lint/build: 0 erros; testes: **257 passed** (31 arquivos).
  - [x] 9.6 **Verificação manual contra backend+frontend reais** (`npm run dev` + backend, logado): abrir `/planner/month` → adicionar tarefa só-mês ("Sem dia definido") e mês+dia (aparece no dia), confirmar persistência ao recarregar. Abrir `/planner/future` → adicionar item num mês futuro ("(14)" e "— jul"), confirmar agrupamento por mês e que **não** aparece no mês corrente. Abrir `/planner/week` desktop → 7 dias, sem scroll horizontal ao estreitar; mobile (<768px) → seletor de dia troca o dia. Semear 1 tarefa de weekly log via admin e confirmar que ela renderiza no dia certo. Confirmar que abrir as telas **não** materializou daily logs vazios.

- [x] **Task 10: Fechar gaps de documentação (retro Epic 3 §3/§8-3)** (AC: — processo)
  - [x] 10.1 `architecture.md` AD-04/AD-05: as funções temporais/calendário são citadas como `core/time.py`, mas o módulo real é **`core/calendar.py`** — corrigir as menções (verificado nesta story: código e `test_guardrails.py` usam `core/calendar.py`).
  - [x] 10.2 `architecture.md` **AD-03** ("Schema de tasks"): registrar a **generalização do vínculo Task↔log** feita nesta story — `log_id` agora nulável + `weekly_log_id`/`monthly_log_id` nuláveis + CHECK de exatamente-um + `scheduled_date` (dia opcional em weekly/monthly). Anotar que o "congelamento" do schema no Epic 3 assumiu só daily log e foi **estendido aqui, aditivamente, com aprovação de Hugo**, porque o modelo do Epic 4 exige a tarefa em qualquer horizonte.
  - [x] 10.3 `architecture.md` **AD-05**: registrar que o **Future Log não é entidade separada** — é o conjunto dos `monthly_log` de meses futuros; uma tarefa "adiada no futuro" é uma `Task` num `monthly_log` futuro com `scheduled_date` opcional (parcial = sem dia, FR-1.2). Manter conciso.

## Dev Notes

### Modelo de vínculo Task↔log (decisão de Hugo — registrar em architecture.md, Task 10.2)

O ponto que os documentos de planejamento não fixavam e que Hugo decidiu explicitamente nesta story:

- **Uma tarefa mora em UM log por vez** (daily **ou** weekly **ou** monthly) e só se move por **migração voluntária** (Story 4.2). Não há agregação nem replicação automática. Uma tarefa "de 20/jul" é uma `Task` no **monthly_log de julho com `scheduled_date=2026-07-20`**, aguardando migração — ela **não** aparece no daily log de 20/jul até Hugo movê-la (que pode ser para o daily de outro dia, um weekly, ou outro mês/dia).
- **Vínculo implementado como 3 FKs nuláveis** (`log`/`weekly_log`/`monthly_log`) com CHECK de exatamente-um, escolha de Hugo sobre a alternativa de tabela `logs` unificada. Subtarefas herdam o container do pai.
- **`scheduled_date` (DATE nulável)** carrega o dia específico opcional dentro de um weekly/monthly log. `null` = "só o mês/semana, sem dia" (o parcial do Future Log, FR-1.2). Em daily log fica `null` (o dia é o do próprio log).

Isso **altera** o schema que o Epic 3 congelou (que só previa daily log). A alteração é **aditiva e segura** (colunas nuláveis + CHECK que as linhas daily existentes já satisfazem, pois têm `log_id` preenchido). Como é uma decisão de nível de arquitetura tomada dentro da story, a Task 10 devolve para `architecture.md` (ação de processo #3 da retro do Epic 3).

### Future Log = monthly_log futuro (não há entidade separada)

Decisão de Hugo: **o Future Log é o próprio conjunto de `monthly_log` de meses futuros.** Não existe tabela `future_log_item`. "Jogar uma tarefa pro futuro" = criar uma `Task` no `monthly_log` de um mês futuro (com `scheduled_date` opcional). Consequências no design:
- O `POST /api/bujo/logs/monthly/` é o **único** write path — serve tanto o Monthly Log do mês corrente quanto adicionar ao Future Log (mês futuro). Não há endpoint de Future Log separado para escrita.
- O `GET /api/bujo/future-log/` é só uma **visão**: os `monthly_log` com `month_first > mês corrente` que têm tarefas, agrupados por mês (FR-1.2 "consultáveis por período", "agrupados por mês").
- Editar/excluir um item do Future Log = editar/excluir a `Task` pelos endpoints de tarefa já existentes (`PATCH /tasks/{id}/`, transição). Um item do Future Log **é** uma tarefa.
- Quando o mês futuro chega, a revisão mensal (Story 4.3, FR-1.9) puxa essas tarefas para o mês corrente — nada de conversão de tipo, já são `Task`.

### Escopo: superfícies de planejamento são majoritariamente somente-leitura nesta story

Entregas: **acessar/exibir** os 3 logs + **criar tarefa em monthly log** (mês corrente e futuro = Future Log). **Fora de escopo** (Epic 4 é estritamente ordenado): migração diária/banner (4.2), revisão semanal/mensal + pull do Future Log (4.3), catch-up (4.4), recorrentes (4.5), fechamento/arquivo (4.6). Por isso as `TaskRow` no Weekly/Monthly são somente-leitura (sem handlers). O **weekly log fica quase vazio** até 4.2/4.3 popularem via migração — nesta story é a superfície responsiva + scaffolding (testado com factories; verificação manual semeia via admin).

### Semântica de calendário — reusar `core/calendar.py` (AC #1)

`week_start_of`/`weeks_of_month`/`months_of_week` já existem em `backend/core/calendar.py` (Epic 1/3), com os casos-âncora de AD-05 testados em `core/tests/test_calendar.py`. A view resolve a chave da semana/mês por essas funções — **não** recalcular "segunda"/"dia 1" à mão em `bujo/`. Pertencimento a mês/ano é derivado na leitura, nunca armazenado como ordinal (AD-05) — a semana de virada é uma única linha `weekly_log` compartilhada pelas duas visões mensais.
> ⚠️ `architecture.md` (AD-04/AD-05) chama esse módulo de `core/time.py` — **erro de documentação**; o arquivo real é `core/calendar.py`. Task 10.1 corrige o doc. Use sempre `core/calendar.py`.

### CHECK constraints — o teste-âncora é a prova, não a assinatura

Os CHECKs "week_start é segunda" (ISODOW=1), "month_first é dia 1" e "exatamente um container" são o coração da AC #1. A forma exata do lookup Django (`__iso_week_day` etc.) deve ser confirmada contra Django 5.2 e provada pelos testes-âncora da Task 6.1 (inserir dado inválido → `IntegrityError`). Não marcar a Task 1 como feita porque "parece certo": o CHECK é imposto pelo Postgres; um lookup errado gera um CHECK que sempre passa (bug silencioso).

### Guardrail de `schema.yaml`/`security` (retro Epic 3 §3) — por que a Task 5.4 existe

Na Story 3.2, mexer em `DEFAULT_AUTHENTICATION_CLASSES` derrubou `security`/`securitySchemes` de todos os endpoints no `schema.yaml` gerado, e o CI **não pegou** (só compara `types.gen.ts`; a ausência de `security` não muda os tipos TS). Esta story **não toca autenticação** → risco não deveria se materializar; a Task 5.4 é a checagem barata de confirmação. Se em algum momento a story precisar tocar config de auth (não deveria), a regra da retro se aplica: rodar `spectacular` e comparar `security` manualmente.

### Contrato — camelCase automático na borda (§6.3)

Declarar campos em snake_case; o parser/renderer CamelCase converte `week_start → weekStart`, `month_first → monthFirst`, `scheduled_date → scheduledDate` na borda — **não** renomear à mão (padrão das stories 3.x: `log_date → logDate`, `target_task_id → targetTaskId`).

### Previous Story Intelligence (3.4 — done)

- Stack: Django 5.2 + DRF + `uv`; Node 22 + Vite + React 19 + MUI 6.1 + TanStack Query 5.59. **Não** precisa de dependência nova — o seletor de mês/dia do Future Log pode ser `<select>`/inputs simples; não instalar `@mui/x-date-pickers` sem necessidade (filosofia "sem lib sem necessidade" das 3.3/3.4).
- `bujo/models.py`, `services/{logs,tasks}.py`, `serializers.py`, `views.py`, `urls.py`, `admin.py`, `tests/*` já existem — **estender**. `pages/planner/*`, `WeekDaySelector.tsx`, `FutureLogItemForm.tsx`, `PlannerSkeleton.tsx` são **novos**. `services/state_machine.py` **não** muda.
- Query key sem `userId` (decisão da 3.2, ainda válida) — chaves novas seguem o padrão.
- `useMediaQuery('(max-width: 767px)')` é o breakpoint canônico (`TaskRow`/`TaskDetailPanel`) — reusar; não criar outro.
- `TaskRow` renderiza somente-leitura sem `onTransition`/`onReorder`/`onOpenDetail` (confirmado na 3.4, recursão de subtarefa) — reusar assim no Weekly/Monthly.
- `jest-axe` contra componentes **reais** (não mockados): a 3.3 só pegou a violação de `aria-label` porque `TaskDetailPanel.test.tsx` varreu o componente de verdade. Aplicar em Task 9.3.
- **File List por último** (retro Epic 3 §8-2): rodar `git status --short` + `git diff --stat` **depois** da verificação manual (Task 9.6) e reconciliar — arquivos criados na verificação escaparam do File List em 3.3 e 3.4.

### Git Intelligence

- Branch `main`; HEAD em `bdb800e` (retro Epic 3 fechada). Working tree tem mudanças pendentes só em `frontend/package.json`/`package-lock.json` (não relacionadas — não commitar junto sem confirmar). Convenção: `feat(story-4.1): <descrição em pt-BR>`.
- **Esta é a 1ª story que altera o schema desde a 3.1** — atenção redobrada na migration `0003` (deve ser aditiva; nenhuma perda de dado nas tarefas daily existentes).

### Contexto não-bloqueante do Epic 4 (ações da retro Epic 3)

- **Deploy (AR-21) concluído por Hugo (2026-07-12)** — a metade de deploy do item #6 está fechada. **AR-22 (observabilidade)** segue pendente, sem dono/data — **não bloqueia** esta story.
- **Story 4.2 (próxima):** ao implementar a migração de subárvore (AD-08 item 11), o teste "pai com filho concluído + filho pendente" deve ser o **primeiro** teste escrito (retro Epic 3 §8-5) — cenário-âncora da AD-08, fácil de errar. Fora do escopo daqui; guardrail já ativo em `_bmad/custom/bmad-dev-story.toml`.

### Project Structure Notes

- Backend: sem arquivo de serviço novo — `get_or_create_weekly/monthly_log` entram em `logs.py`; `create_task`/`reorder_task` generalizados em `tasks.py`. Migration `0003` cria 2 tabelas + altera `tasks` (aditivo).
- Frontend: novo diretório `pages/planner/` (3 páginas); `features/bujo/components/` ganha `WeekDaySelector.tsx`, `FutureLogItemForm.tsx`, `PlannerSkeleton.tsx`. `api.ts`/`keys.ts`/`types.ts`/`index.ts` estendidos; `router.tsx` troca 3 nós de placeholder.
- Fronteiras (§7.2): `features/bujo` não importa outras features; `pages/planner` compõe a feature. Sem violação de `import-linter` (mesma app `bujo`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1 (linhas 626-647); §Epic 4 (linhas 269-272, 622-624 — "consome o Task congelado, não o altera" — reinterpretado com aval de Hugo, ver Task 10.2; histórias estritamente ordenadas)]
- [Source: _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md#FR-1.1 (linhas 166-170 — 4 tipos de log; Monthly "tarefas atribuídas a datas"; Future completa/parcial), FR-1.2 (linha 172 — parcial só mês; dia definido na migração mensal)]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-05 (linhas 228-279 — weekly_log/monthly_log, CHECK ISODOW/dia-1, funções de derivação, casos-âncora); AD-04 (linhas 184-224 — DATE vs timestamptz, "sem materialização/migração automática" item 5, today_for); AD-03 (linhas 163-180 — schema de tasks a estender na Task 10.2); §6.2/6.3/6.4/6.5/6.7, §7.1/7.2]
  - ⚠️ AD-04/AD-05 dizem `core/time.py`; o real é `core/calendar.py` — Task 10.1.
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/EXPERIENCE.md §2 (telas W/M/F, linhas 53-55), §4 (Task Row; "adiar no mês → data no Monthly Log", linhas 205-206, 553), §4.7 Future Log Item (linha 302), §6.2 Weekly mobile seletor sem swipe (456-460), §6.3 Monthly lista vertical sem grid (528), responsividade 7 colunas sem scroll-h (511, 520, 527)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/DESIGN.md#Weekly densidade (288-290), §7.2 Day Header (Daily+Weekly, 357-368)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/.decision-log.md (Future "•(10) Pix VG"/"— jul"; Monthly duas colunas + mini-calendário = refinamento futuro; Weekly desktop 7 dias, linhas 31-35, 78)]
- [Source: backend/bujo/models.py — `Log`/`Task`/`TaskStatus`/`CheckConstraint` (padrão a estender; `Task.log` a generalizar), `TenantModel`]
- [Source: backend/core/calendar.py — `today_for`/`week_start_of`/`weeks_of_month`/`months_of_week` (reusar); backend/core/models.py — `TenantModel`; backend/core/exceptions.py — `NotFound`/DoesNotExist tenant-scoped]
- [Source: backend/bujo/services/logs.py (get_or_create idempotente), services/tasks.py (`create_task` order_index por irmãos — a generalizar por container; `reorder_task` sibling scoping — a ampliar defensivamente)]
- [Source: backend/bujo/serializers.py (TaskSerializer/LogSerializer — `parent_task__isnull=True`, `@extend_schema_field`; `scheduledDate` a adicionar), views.py (TodayLogView/SubtaskCreateView/TaskCreateView — view fina, `@extend_schema`; SubtaskCreate a atualizar p/ herdar container), urls.py (rotas a preservar), tests/factories.py (LogFactory/TaskFactory a estender)]
- [Source: frontend/src/api/keys.ts (padrão de query key), features/bujo/{api,types,index}.ts (useTodayLogQuery, tipos via components['schemas']), components/{TaskRow,DayHeader,DailyLogSkeleton,TaskDetailPanel}.tsx (reuso; breakpoint 767px), pages/daily/{DailyPage,useDailyData}.tsx (estrutura a espelhar), app/router.tsx (nós planner/* a substituir)]
- [Source: _bmad-output/implementation-artifacts/3-4-*.md#Dev Notes (índice fracionário, TaskRow somente-leitura, File List por último), 3-3-*.md (jest-axe em componente real, aria-label em campo real)]
- [Source: _bmad-output/implementation-artifacts/epic-3-retro-2026-07-08.md §3/§7/§8 (contagem de testes real; File List após verificação; gap→doc-fonte; guardrail schema.yaml/security; Epic 4 consome Task congelado) — ações #1/#2/#3/#4/#5 ativas via _bmad/custom/bmad-dev-story.toml; #6 deploy concluído]

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

### Completion Notes List

- Task 1: `WeeklyLog`/`MonthlyLog` (`TenantModel`, `UniqueConstraint` + `CheckConstraint` de segunda/dia-1) e generalização de `Task` (`log` nulável + `weekly_log`/`monthly_log`/`scheduled_date` + CHECK `task_exactly_one_log`). Registrados em `admin.py`.
- Task 2: Migration `0003_weekly_monthly_log.py` — `CreateModel` de `WeeklyLog`/`MonthlyLog`, `AlterField` de `Task.log`, `AddField` de `weekly_log`/`monthly_log`/`scheduled_date`, `AddConstraint` `task_exactly_one_log`. `migrate` e `manage.py check` sem erros.
- Task 3: `get_or_create_weekly_log`/`get_or_create_monthly_log` (idempotentes, mesmo padrão de `get_or_create_daily_log`); `create_task` generalizado para os 3 containers + `scheduled_date`; `SubtaskCreateView` passa a herdar `weekly_log`/`monthly_log` do pai; `reorder_task` ganhou o filtro ampliado por correção defensiva (bomba-relógio para 4.x, sem mudança de comportamento observável nesta story). 7 testes novos em `test_services.py`.
- Task 4: Serializers (`WeeklyDaySerializer`, `WeeklyLogSerializer`, `MonthlyLogSerializer`, `FutureLogMonthGroupSerializer`, `MonthlyTaskCreateSerializer` — plain `Serializer`, não `ModelSerializer`, pois compõem dados computados na view); `TaskSerializer` ganhou `scheduled_date`. Views `WeeklyLogView`/`MonthlyLogView`/`FutureLogView` (view fina, `@extend_schema`). Rotas `logs/weekly/`, `logs/monthly/`, `future-log/`. 15 testes novos em `test_views.py`.
- Task 5: `schema.yaml`/`types.gen.ts` regenerados. Diff de `security` isolado às 4 novas operações (7→11 blocos), nenhum endpoint existente perdeu `security` — guardrail da retro Epic 3 §3 confirmado.
- Task 6: Testes-âncora dos 3 CHECKs (segunda/dia-1/exatamente-um) provados via `IntegrityError`, não só "parece certo" — `week_start__iso_week_day=1` confirmado como lookup válido no Django 5.2.15. `WeeklyLogFactory`/`MonthlyLogFactory` novos; `TaskFactory.log` virou `LazyAttribute` condicional a `weekly_log`/`monthly_log` (nunca preenche dois containers).
- Task 7: `keys.bujo.{weeklyLog,monthlyLog,futureLog}`; tipos `WeeklyDay`/`WeeklyLog`/`MonthlyLog`/`FutureLogMonthGroup`; `useWeeklyLogQuery`/`useMonthlyLogQuery`/`useFutureLogQuery` (queries simples) + `useCreateMonthlyTaskMutation` (invalidação simples via `invalidateQueries`, sem optimistic update — decisão deliberada per Dev Notes). 6 testes novos em `api.test.tsx`.
- Task 8: `TaskRow` ganhou modo genuinamente somente-leitura (`onTransition`/`onOpenDetail` agora opcionais — ícone de status desabilitado e título vira texto plano quando ausentes; único jeito de a Weekly/Monthly reusar o componente sem sugerir interatividade falsa). `WeekDaySelector`/`FutureLogItemForm`/`PlannerSkeleton` (novos) + `WeeklyPage`/`MonthlyPage`/`FuturePage` (novos, `pages/planner/`) + `router.tsx` trocando os 3 `PlaceholderPage`. `MonthlyPage` usa `refetch()` local (per-call `onSuccess`) além da invalidação da mutação, porque o query key ativo da página é o sentinel `'current'` (sem `monthFirst` explícito) e a invalidação da mutação usa o `monthFirst` resolvido — sem o refetch local a UI da página não refletiria a tarefa recém-criada até o próximo refetch natural.
- Task 9: `WeekDaySelector.test.tsx`/`FutureLogItemForm.test.tsx`/`{Weekly,Monthly,Future}Page.test.tsx` (novos, com `jest-axe` contra componentes reais) + 4 testes novos em `TaskRow.test.tsx` para o modo somente-leitura. Backend: `uv run pytest` → **214 passed**; `ruff check .` → `All checks passed!`; `lint-imports` → `1 kept, 0 broken`; `manage.py check` → 0 erros. Frontend: `typecheck`/`lint`/`build` → 0 erros; `npm run test` → **257 passed** (31 arquivos). Verificação manual via Playwright (script temporário, removido após uso) contra `manage.py runserver`+`npm run dev` reais, usuário real via `/api/accounts/signup/`: Monthly Log (criar tarefa só-mês e mês+dia, persistência após reload confirmada), Future Log (item em mês futuro com "(14)"/"— mar", agrupamento por mês, mês corrente ausente confirmado programaticamente), Weekly Log (7 dias desktop sem scroll horizontal, seletor de dia mobile com troca de dia confirmada via `aria-selected`), tarefa semeada via admin (`manage.py shell`) num weekly log renderizou no dia correto. Confirmado que abrir as 3 telas não materializou daily logs além do único já esperado da visita a `/today` (comportamento pré-existente da Story 3.2). Zero erros de console em toda a sessão.
- Task 10: `architecture.md` — AD-04/AD-05 corrigidos de `core/time.py` para `core/calendar.py` (2 menções); AD-03 documenta a generalização do vínculo Task↔log (schema atualizado + nota de decisão); AD-05 documenta "Future Log = `monthly_log` futuro, não é entidade separada".

### Code Review (AI)

- Revisão adversarial (story-automator review): implementação validada contra as 3 ACs e as 10 tasks — models/migration/CHECKs conferem linha a linha com o pseudocódigo da story (`WeeklyLog`/`MonthlyLog`/CHECK `task_exactly_one_log`), `services/{logs,tasks}.py` generalizados exatamente como especificado, views/serializers/urls corretos (normalização de `week_start`/`month_first`, validação de `scheduledDate` dentro do mês, escopo por tenant via `TenantManager`), frontend (`TaskRow` somente-leitura opcional, `WeeklyPage`/`MonthlyPage`/`FuturePage`, `WeekDaySelector`, `FutureLogItemForm`) confere com Dev Notes e EXPERIENCE.md (prefixo `(14)`/`— jul`, sem scroll horizontal, mobile sem grid). `architecture.md` (Task 10) com as 3 correções/adições esperadas. Reexecutado nesta revisão: backend `uv run pytest` (214 passed), `ruff check .`, `lint-imports`, `manage.py check` — todos verdes; frontend `npm run test` (257 passed/31 arquivos), `typecheck`, `lint` — todos verdes. `schema.yaml`: 4 novos blocos `security` (7→11), nenhum removido (guardrail retro Epic 3 §3 confirmado).
- Único achado, MEDIUM (documentação): as Completion Notes das Tasks 3/4/7 traziam contagens de teste estimadas/desatualizadas em vez da contagem real observada — `test_services.py` dizia "15 testes novos" (real: 7), `test_views.py` dizia "18" (real: 15), `api.test.tsx` dizia "17" (real: 6); a Task 9.4 e a nota da Task 9 diziam "211 passed" no `pytest`, quando a suíte atual (incluindo os 3 testes de validação 400 já presentes no código, comentados como "Achado de review") totaliza **214 passed**. Viola diretamente o guardrail já codificado em `_bmad/custom/bmad-dev-story.toml` ("rode o comando real da suite de testes e cole a contagem observada literalmente — nunca escreva um número de memória ou estimado", ação #1 da retro Epic 3). Corrigido nesta revisão: as 4 contagens foram atualizadas para os valores reais medidos.

### File List

- backend/bujo/models.py
- backend/bujo/admin.py
- backend/bujo/migrations/0003_weekly_monthly_log.py
- backend/bujo/services/logs.py
- backend/bujo/services/tasks.py
- backend/bujo/serializers.py
- backend/bujo/views.py
- backend/bujo/urls.py
- backend/bujo/tests/factories.py
- backend/bujo/tests/test_models.py
- backend/bujo/tests/test_serializers.py
- backend/bujo/tests/test_services.py
- backend/bujo/tests/test_views.py
- schema.yaml
- frontend/src/api/keys.ts
- frontend/src/api/types.gen.ts
- frontend/src/app/router.tsx
- frontend/src/features/bujo/types.ts
- frontend/src/features/bujo/api.ts
- frontend/src/features/bujo/api.test.tsx
- frontend/src/features/bujo/index.ts
- frontend/src/features/bujo/components/TaskRow.tsx
- frontend/src/features/bujo/components/TaskRow.test.tsx
- frontend/src/features/bujo/components/WeekDaySelector.tsx
- frontend/src/features/bujo/components/WeekDaySelector.test.tsx
- frontend/src/features/bujo/components/FutureLogItemForm.tsx
- frontend/src/features/bujo/components/FutureLogItemForm.test.tsx
- frontend/src/features/bujo/components/PlannerSkeleton.tsx
- frontend/src/pages/planner/WeeklyPage.tsx
- frontend/src/pages/planner/WeeklyPage.test.tsx
- frontend/src/pages/planner/MonthlyPage.tsx
- frontend/src/pages/planner/MonthlyPage.test.tsx
- frontend/src/pages/planner/FuturePage.tsx
- frontend/src/pages/planner/FuturePage.test.tsx
- _bmad-output/planning-artifacts/architecture.md
