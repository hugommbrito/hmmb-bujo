---
baseline_commit: 3adda16978542d18a47fea8f298c4aa9dc86d912
---

# Story 4.3: Revisão semanal/mensal e pull automático do Future Log

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero revisar as pendências da semana/mês anterior e receber os itens do Future Log do mês corrente,
Para que a virada de semana e de mês aconteça com julgamento explícito e sem perder o que planejei (FR-1.8, FR-1.9, FR-1.10).

## Acceptance Criteria

1. **Revisão semanal — detecção por condição e Fluxo de Migração generalizado (FR-1.8, FR-1.10)**
   - **Dado que** um Weekly Log anterior com tarefas sem disposição,
   - **Quando** Hugo abre o app (gatilho por condição, não por data — uma segunda pulada ainda dispara na quarta),
   - **Então** um banner "Semana anterior tem N tarefas sem disposição. Revisar?" oferece o fluxo de migração semanal,
   - **E** uma semana é marcada **fechada** quando todas as suas tarefas têm disposição (considerando a subárvore: pai com filho pendente não fecha).

2. **Revisão mensal + pull automático do Future Log (FR-1.9)**
   - **Dado que** a abertura do mês (1ª semana),
   - **Quando** há um Monthly Log anterior com pendências,
   - **Então** o fluxo apresenta cada tarefa para decisão (migrar com data / adiar no futuro / cancelar),
   - **E** o sistema puxa automaticamente os itens do Future Log com destino no mês corrente para uma seção "Itens do Future Log para [mês]" no topo do Monthly Log, com data definida ou "data a definir", aguardando confirmação de Hugo.

## Tasks / Subtasks

> **Ordem de execução:** backend (serviço → serializers/views/urls → contrato) antes do frontend (types → data layer → banners/cards → integração), igual às Stories 4.1/4.2. A Task 3 (regenerar contrato) é o pivô.
>
> **⚠️ Guardrail codificado da retro Epic 3 (`_bmad/custom/bmad-dev-story.toml`):** ao escrever testes de serviço/view que envolvam subárvore, o cenário "pai com filho pendente" (que impede o fechamento, AD-08 item 10) deve estar entre os primeiros testes escritos, não um caso de borda adicionado depois.

- [x] **Task 1: Estender `migrate_task` com destino `"week"`** (AC: #1)
  - [x] 1.1 Em `backend/bujo/services/migration.py`, adicionar o ramo `"week"` ao dispatcher de `migrate_task` — **migra para a Weekly Log CORRENTE** (o equivalente semanal de "hoje" na 4.2: mover para o container do período atual → `status=MIGRATED`, nunca `POSTPONED`; ver Dev Notes "Migrated vs. Postponed também vale para 'semana'"):
    ```python
    elif destination == "week":
        container_field = "weekly_log"
        container = get_or_create_weekly_log(user=user, week_start=week_start_of(today_for(user)))
        new_status, root_scheduled_date = Task.Status.MIGRATED, None
    ```
    Importar `get_or_create_weekly_log` (`services/logs.py`, já existe) e `week_start_of` (`core/calendar.py`, já existe). **Não** duplicar `_migrate_subtree` — o destino `"week"` reaproveita a mesma função recursiva já usada por `"today"`/`"month"`/`"future"`, só troca `container_field`/`container`/`new_status`. `docstring` de `migrate_task`: acrescentar a linha `"week"` na lista de destinos documentados.
  - [x] 1.2 `TaskMigrateSerializer` (`backend/bujo/serializers.py`): adicionar `"week"` a `destination = serializers.ChoiceField(choices=["today", "month", "future", "cancel"])` → `["today", "week", "month", "future", "cancel"]`. **Nenhuma validação condicional nova** — `"week"` não exige `month_first`/`scheduled_date`, igual a `"today"`/`"cancel"`.
  - [x] 1.3 `TaskMigrateView` (`backend/bujo/views.py`): **nenhuma mudança de lógica** — o destino `"week"` não passa pelos ramos condicionais de `month_first` (só `"month"`/`"future"` os tocam), então o dispatcher existente já funciona sem alteração; conferir apenas que o `@extend_schema` permanece correto após a Task 3.

- [x] **Task 2: Serializers + views + URLs — filas de revisão semanal/mensal** (AC: #1, #2)
  - [x] 2.1 Em `backend/bujo/serializers.py`, adicionar dois serializers no mesmo molde de `MigrationQueueSerializer`:
    ```python
    class WeeklyReviewQueueSerializer(serializers.Serializer):
        week_start = serializers.DateField()
        tasks = TaskSerializer(many=True)

    class MonthlyReviewQueueSerializer(serializers.Serializer):
        month_first = serializers.DateField()
        tasks = TaskSerializer(many=True)
    ```
  - [x] 2.2 Em `backend/bujo/views.py`, adicionar duas views análogas a `MigrationQueueView` — **mesma disciplina de não-materialização** (`.filter().first()`, nunca `get_or_create_*`):
    ```python
    class WeeklyReviewQueueView(APIView):
        @extend_schema(responses=WeeklyReviewQueueSerializer)
        def get(self, request):
            previous_week_start = week_start_of(today_for(request.user)) - timedelta(weeks=1)
            log = WeeklyLog.objects.filter(week_start=previous_week_start).first()
            tasks = (
                Task.objects.none()
                if log is None
                else log.tasks.filter(
                    status__in=[Task.Status.PENDING, Task.Status.STARTED], parent_task__isnull=True
                )
            )
            data = {"week_start": previous_week_start, "tasks": tasks}
            return Response(WeeklyReviewQueueSerializer(data).data)


    class MonthlyReviewQueueView(APIView):
        @extend_schema(responses=MonthlyReviewQueueSerializer)
        def get(self, request):
            current_month_first = today_for(request.user).replace(day=1)
            previous_month_first = (current_month_first - timedelta(days=1)).replace(day=1)
            log = MonthlyLog.objects.filter(month_first=previous_month_first).first()
            tasks = (
                Task.objects.none()
                if log is None
                else log.tasks.filter(
                    status__in=[Task.Status.PENDING, Task.Status.STARTED], parent_task__isnull=True
                )
            )
            data = {"month_first": previous_month_first, "tasks": tasks}
            return Response(MonthlyReviewQueueSerializer(data).data)
    ```
    Importar `WeeklyLog` em `views.py` (já importa `Log`, `MonthlyLog`, `Task` — acrescentar `WeeklyLog`). **Gatilho por condição, não por data** (AC #1): nenhuma das duas views checa "é segunda-feira?"/"é o primeiro dia do mês?" — a fila é sempre a query sobre o período anterior, disponível a qualquer momento (mesmo padrão AD-09 "detecção por query, sem cron"). O contador "N tarefas sem disposição" do banner é o `len(tasks)` desta fila raiz — **mesma convenção da 4.2**: subtarefas não contam separadamente, viajam com a raiz.
  - [x] 2.3 **Fechamento (AC #1, "uma semana é marcada fechada quando...")**: esta story **não** introduz nenhum campo `is_closed`/`closed_at` no banco nem um badge "Fechada" na UI — isso é escopo da Story 4.6 (Fechamento de ciclos e Arquivo, epics.md linhas 730-746). O que esta story **precisa** é o predicado de fechamento como **gatilho do banner**: "semana fechada" ⟺ a fila de tarefas-raiz `pending`/`started` do Weekly Log anterior está vazia (exatamente o que `WeeklyReviewQueueView` já calcula — banner não aparece quando a lista vem vazia, ver Task 7). **Não generalizar** o predicado para "qualquer tarefa da subárvore, mesmo sem contar como raiz" — usar a mesma base raiz da fila evita um banner "revisar" que abriria um fluxo vazio (ver Dev Notes "Fechamento considera só tarefas-raiz nesta story — subárvore órfã é gap pré-existente, não desta story").
  - [x] 2.4 Em `backend/bujo/urls.py` (estender, preservando as 11 rotas existentes):
    ```python
    path("weekly-review/queue/", WeeklyReviewQueueView.as_view(), name="bujo-weekly-review-queue"),
    path("monthly-review/queue/", MonthlyReviewQueueView.as_view(), name="bujo-monthly-review-queue"),
    ```
  - [x] 2.5 **Confirmação de data do Future Log (parte do AC #2 — "aguardando confirmação de Hugo")**: em `backend/bujo/serializers.py`, estender `TaskUpdateSerializer` com `scheduled_date = serializers.DateField(required=False, allow_null=True)`. **Não** criar um endpoint novo — o PATCH `tasks/<pk>/` (`TaskDetailView`, já existente, `update_task` já é genérico via `setattr`+`save`) passa a aceitar `scheduledDate` como mais um campo editável, reaproveitado pelo frontend para "confirmar" ou ajustar a data de um item puxado do Future Log (Task 8). **Validação de mês** (mesma regra de `MonthlyTaskCreateSerializer`/`TaskMigrateSerializer` — a data deve pertencer ao mês do `monthly_log` do próprio registro) é **responsabilidade da view**, não do serializer isolado (o serializer não tem acesso à instância): em `TaskDetailView.patch`, se `scheduled_date` está nos campos validados, buscar a task (já é necessário para `update_task`) e, se `task.monthly_log_id` não é `None`, validar `(scheduled_date.year, scheduled_date.month) == (task.monthly_log.month_first.year, task.monthly_log.month_first.month)` — senão `400`. Tarefas de Daily/Weekly Log (sem `monthly_log`) não são afetadas por essa validação (o campo é simplesmente ignorado/gravado sem checagem adicional — não há uma semântica de "mês" ali).
  - [x] 2.6 `backend/bujo/tests/test_views.py` (estender): `GET /weekly-review/queue/` sem Weekly Log anterior → `tasks: []`, **nenhum** `WeeklyLog` criado; com tarefas `pending`/`started`/`completed`/`cancelled` na semana anterior → só as duas primeiras, só raízes. Idem para `GET /monthly-review/queue/` com Monthly Log anterior. `POST /tasks/{id}/migrate/` com `destination=week` → tarefa aparece na Weekly Log corrente, origem `migrated` (mesmo formato dos testes de `destination=today` da 4.2). `PATCH /tasks/{id}/` com `scheduledDate` — dentro do mês do `monthly_log` → 200, task atualizada; fora do mês → `400`; task sem `monthly_log` (daily/weekly) → aceito sem checagem de mês. Escopo por tenant em todas as views novas.

- [x] **Task 3: Regenerar o contrato de API** (AC: #1, #2)
  - [x] 3.1 `cd backend && uv run python manage.py spectacular --file ../schema.yaml`
  - [x] 3.2 `cd frontend && npm run generate-types`
  - [x] 3.3 Confirmar que o step de CI "Verificar types.gen.ts está atualizado" passa sem diff residual.
  - [x] 3.4 Confirmar no diff do `schema.yaml` que só entraram paths/schemas novos (`WeeklyReviewQueue`, `MonthlyReviewQueue`, `destination` com `"week"`, `TaskUpdate` com `scheduledDate`) e que os blocos `security` dos endpoints existentes seguem intactos (guardrail retro Epic 3 §3).

- [x] **Task 4: Testes de serviço** (AC: #1)
  - [x] 4.1 `backend/bujo/tests/test_services.py` (estender), `migrate_task` com `destination="week"`: origem `migrated`, `migrated_to_task` aponta pro novo (`pending`, `weekly_log=` Weekly Log corrente, `migration_count=1`) — mesmo formato do teste `test_migrate_task_destination_today_torna_origem_migrated_e_cria_no_daily_de_hoje` já existente, adaptado para `weekly_log`.
  - [x] 4.2 Subárvore com destino `"week"`: pai com filho `pending` + filho `completed` → destino recebe pai + só o filho `pending` (mesma asserção estrutural do teste-âncora de subárvore da 4.2, reaproveitando `_migrate_subtree` sem necessidade de duplicar o teste inteiro — só a variante de destino).

- [x] **Task 5: Camada de dados do frontend** (AC: #1, #2)
  - [x] 5.1 Em `frontend/src/api/keys.ts` (estender a seção `bujo`): `weeklyReviewQueue: () => ['bujo', 'weeklyReviewQueue', 'list'] as const,` e `monthlyReviewQueue: () => ['bujo', 'monthlyReviewQueue', 'list'] as const,`.
  - [x] 5.2 Em `frontend/src/features/bujo/types.ts` (estender): `export type WeeklyReviewQueue = components['schemas']['WeeklyReviewQueue']` e `export type MonthlyReviewQueue = components['schemas']['MonthlyReviewQueue']` (nomes exatos conforme `schema.yaml` gerado na Task 3 — conferir).
  - [x] 5.3 Em `frontend/src/features/bujo/api.ts` (estender):
    - `useWeeklyReviewQueueQuery()` / `useMonthlyReviewQueueQuery()` — `useQuery` simples, GET `/api/bujo/weekly-review/queue/` e `/api/bujo/monthly-review/queue/` (mesmo molde de `useMigrationQueueQuery`).
    - `export type MigrationDestination = 'today' | 'week' | 'month' | 'future' | 'cancel'` (acrescentar `'week'`).
    - `useMigrateTaskMutation` — estender a lista de invalidação do `onSuccess` com `keys.bujo.weeklyReviewQueue()`, `keys.bujo.monthlyReviewQueue()` e o prefixo de 2 elementos `['bujo', 'weeklyLog']` (a Weekly Log corrente muda quando `destination=week`; o padrão de invalidação por prefixo já existe para `monthlyLog`/`futureLog` desde a 4.1/4.2 — replicar, não reinventar).
    - `useUpdateTaskMutation` (já existe, `services/api.ts`) — **nenhuma mudança de assinatura necessária**: já é genérica (`Partial<TaskFields> & { taskId }`); estender apenas a interface `TaskFields`/`UpdateTaskVariables` com `scheduledDate?: string | null` para o novo campo do PATCH (Task 8 usa isso para confirmar a data de um item do Future Log). Como a query-key otimista de `useUpdateTaskMutation` hoje só atualiza `keys.bujo.todayLog()` (Daily Log), e o uso desta story é sobre uma task de `monthly_log` (não aparece no Daily Log), a mutação otimista não vai encontrar a task no cache do Daily Log — **sem problema**: o `updater` já faz `if (!current) return current`, então é uma mutação sem efeito otimista neste caso específico (comportamento seguro, só sem atualização instantânea) — o `onSuccess` desta mutação deve **também invalidar** `['bujo', 'monthlyLog']` por prefixo para refletir a data confirmada (adicionar este invalidate, hoje ausente porque a mutação nunca tinha sido usada fora do Daily Log).
  - [x] 5.4 Exportar os novos hooks/tipos em `frontend/src/features/bujo/index.ts` (barrel).
  - [x] 5.5 `frontend/src/features/bujo/api.test.tsx` (estender): `useWeeklyReviewQueueQuery`/`useMonthlyReviewQueueQuery` batem nos endpoints certos; `useMigrateTaskMutation` com `destination='week'` monta o payload certo e invalida as chaves esperadas (incluindo as 2 novas filas + prefixo `weeklyLog`); `useUpdateTaskMutation` com `scheduledDate` invalida `monthlyLog` por prefixo.

- [x] **Task 6: `MigrationCard`/`MigrationFlow` — variantes semanal e mensal** (AC: #1, #2)
  - [x] 6.1 **Decisão de design desta story (ver Dev Notes "Anatomia do card por contexto")**: `MigrationCard`/`MigrationFlow` recebem uma nova prop `flowType: 'daily' | 'weekly' | 'monthly'` (default implícito `'daily'` nos usos existentes — `DailyPage`/`MigrationBanner` não mudam). Isso é reaproveitamento do card já existente, não um componente novo — só o conjunto/rótulo/tecla de ações muda por `flowType`:
    - `'daily'` (comportamento atual, sem mudança): 4 botões — Migrar para hoje (`today`) / Adiar no mês (`month`) / Adiar no Futuro (`future`) / Cancelar (`cancel`). Teclas `1`-`4`.
    - `'weekly'`: mesmos 4 botões e teclas, só o botão 1 muda de destino e rótulo — **Migrar para esta semana** (`week`) / Adiar no mês (`month`) / Adiar no Futuro (`future`) / Cancelar (`cancel`). Reflete FR-1.8 ("migrar para o novo Weekly Log, adiar ou cancelar") mantendo os dois sabores de "adiar" já existentes no componente (mês/futuro) em vez de colapsá-los num único botão genérico — ver Dev Notes para o porquê.
    - `'monthly'`: **3 botões** (sem o botão 1 "hoje/semana" — o próprio Monthly Log de origem já É "este mês", não faz sentido "migrar para o mês corrente" como ação distinta) — Definir data em [Mês] (`month`, abre o mesmo picker de data-no-mês-corrente já existente, `scheduled_date` obrigatório) / Adiar no Futuro (`future`) / Cancelar (`cancel`). Teclas `1`-`3` (remapeadas: `1`=mês, `2`=futuro, `3`=cancelar). Reflete FR-1.9 ("migrar com data / adiar no futuro / cancelar").
  - [x] 6.2 `frontend/src/features/bujo/components/MigrationCard.tsx`: adicionar prop `flowType` com default `'daily'`; usar para (a) decidir se o botão 1 é renderizado e com qual rótulo/destino, (b) renumerar os rótulos de atalho exibidos (`1`/`2`/`3` em vez de `2`/`3`/`4` quando `flowType==='monthly'`). **Não** duplicar a estrutura JSX inteira — um `const primaryAction = flowType === 'monthly' ? null : { label: flowType === 'weekly' ? 'Migrar para esta semana' : 'Migrar para hoje', destination: flowType === 'weekly' ? 'week' : 'today' }` no topo do componente é suficiente; o resto do card (subtarefas, indicador "N de M", pickers de mês/futuro, cancelar) é idêntico nos 3 casos.
  - [x] 6.3 `frontend/src/features/bujo/components/MigrationFlow.tsx`: adicionar prop `flowType` (repassada ao `MigrationCard`); o `useEffect` de teclado precisa mapear `1`/`2`/`3`/`4` de acordo com `flowType` (para `'monthly'`: `1`→abre picker de mês, `2`→abre picker de futuro, `3`→cancela; sem tecla para "hoje/semana"). Extrair a tabela de atalhos por `flowType` como um objeto simples (`{ daily: {...}, weekly: {...}, monthly: {...} }`) em vez de um `if/else` aninhado, para os 3 casos ficarem legíveis lado a lado.
  - [x] 6.4 `frontend/src/features/bujo/components/MigrationCard.test.tsx`/`MigrationFlow.test.tsx` (estender): casos novos para `flowType='weekly'` (botão 1 chama `onDecide('week')`) e `flowType='monthly'` (só 3 botões renderizados, sem botão "hoje/semana"; atalhos `1`-`3` mapeados certo). `jest-axe` nas 3 variantes.

- [x] **Task 7: `WeeklyReviewBanner` e `MonthlyReviewBanner`** (AC: #1, #2)
  - [x] 7.1 `frontend/src/features/bujo/components/WeeklyReviewBanner.tsx` (novo, mesmo molde de `MigrationBanner.tsx`): usa `useWeeklyReviewQueueQuery()`; se `tasks.length === 0` (ou `isPending`) não renderiza nada; senão texto **exato** "Semana anterior tem N tarefas sem disposição. Revisar?" (`N` = `tasks.length`, EXPERIENCE.md §5.2) + botão "Iniciar revisão" que abre `<MigrationFlow queue={tasks} flowType="weekly" .../>`.
  - [x] 7.2 `frontend/src/features/bujo/components/MonthlyReviewBanner.tsx` (novo, mesmo molde): usa `useMonthlyReviewQueueQuery()`; texto "Mês anterior tem N tarefas sem disposição. Revisar mês anterior?" (combinação de EXPERIENCE.md §5.3 "Banner informativo com contagem" + rótulo de botão "Revisar mês anterior" já especificado ali) + botão "Revisar mês anterior" que abre `<MigrationFlow queue={tasks} flowType="monthly" .../>`.
  - [x] 7.3 Exportar `WeeklyReviewBanner`/`MonthlyReviewBanner` em `frontend/src/features/bujo/index.ts` (únicos componentes que `pages/daily` precisa importar).
  - [x] 7.4 `WeeklyReviewBanner.test.tsx`/`MonthlyReviewBanner.test.tsx` (novos, mesmo molde de `MigrationBanner.test.tsx`): não renderiza com fila vazia; renderiza texto exato com contagem certa; clicar no botão abre o fluxo com o `flowType` certo; `jest-axe`.

- [x] **Task 8: "Itens do Future Log para [Mês]" no Monthly Log** (AC: #2)
  - [x] 8.1 **Decisão de design desta story (ver Dev Notes "Pull do Future Log é armazenamento, não uma ação nova")**: como o Future Log **já é** o próprio `monthly_log` futuro (AD-03, decisão da 4.1 — não existe tabela separada), uma tarefa "com destino no mês corrente" **já está fisicamente** na `MonthlyLog` do mês corrente assim que o mês vira — não há nada para "puxar" no banco. O que a AC pede é a **apresentação em destaque**: uma seção "Itens do Future Log para [Mês]" no topo do Monthly Log corrente contendo as tarefas sem `scheduledDate` (que aguardam Hugo definir a data — exatamente as que hoje o `MonthlyPage.tsx` já agrupa como `withoutDate`, Story 4.1 `groupTasksByScheduledDate`). Esta story **reaproveita** esse agrupamento existente — não cria uma query nova — mudando em `MonthlyPage.tsx`: (a) quando `monthFirst === currentMonthFirst` (mês exibido é o mês corrente — comparar com `today_for` do frontend, cálculo de UI como no `MigrationCard`, `new Date()` local), renderizar a seção `withoutDate` **antes** de `withDate` (hoje vem depois) com o título "Itens do Future Log para {Mês}" em vez de "Sem dia definido"; (b) para qualquer outro mês (passado/futuro visualizado diretamente), manter o comportamento atual (`withDate` primeiro, "Sem dia definido" depois, sem reordenar). **Limitação assumida:** o schema não distingui "chegou do Future Log" de "criado direto no mês sem data" — ambos caem no mesmo `withoutDate`; tratá-los IGUAL é a leitura mais simples e correta dado o modelo de dados (qualquer tarefa do mês corrente sem data pendente de confirmação é, por definição, uma tarefa "a definir", venha de onde vier).
  - [x] 8.2 Em `frontend/src/pages/planner/MonthlyPage.tsx`: adicionar um input de data inline em cada `TaskRow` da seção `withoutDate` **quando é o mês corrente** — reaproveitar `useUpdateTaskMutation` (Task 5.3) com `scheduledDate` para "confirmar" a data (ao preencher, a tarefa sai de `withoutDate` no próximo refetch/invalidação). Não é obrigatório mover o `TaskRow` para um subcomponente novo — um wrapper simples (`<Box>` com o `TaskRow` + um `<TextField type="date">` ao lado, visível só quando `monthFirst === currentMonthFirst`) resolve sem introduzir um componente inteiro só para isso.
  - [x] 8.3 `frontend/src/pages/planner/MonthlyPage.test.tsx` (estender): mês corrente com tarefas sem data → título "Itens do Future Log para {Mês}" aparece **antes** da seção com data; outro mês (`monthFirst` explícito diferente do corrente) → título continua "Sem dia definido", ordem inalterada (regressão da 4.1). Preencher o input de data de um item sem data → chama `useUpdateTaskMutation` com o `scheduledDate` certo.

- [x] **Task 9: Integração no Daily Log** (AC: #1, #2)
  - [x] 9.1 Em `frontend/src/pages/daily/DailyPage.tsx`, renderizar `<WeeklyReviewBanner />` e `<MonthlyReviewBanner />` logo abaixo de `<MigrationBanner />` (ordem visual: diário → semanal → mensal, mesma ordem de aparição narrada em EXPERIENCE.md Fluxo 1/Fluxo 3 — Hugo pode *resolver* na ordem que quiser, a ordem visual na tela é só essa). Os três banners são independentes (cada um com sua própria query/fila) — não há um "banner combinado".
  - [x] 9.2 Confirmar que abrir a Daily Log **não** materializa nem o Weekly Log nem o Monthly Log anteriores quando não existiam (mesma disciplina de verificação da 4.1/4.2) — `WeeklyReviewQueueView`/`MonthlyReviewQueueView` só fazem `.filter().first()`.

- [x] **Task 10: Testes de frontend + verificação manual** (AC: #1, #2)
  - [x] 10.1 `DailyPage.test.tsx` (estender): os 3 banners aparecem/desaparecem independentemente conforme cada query retorna tarefas ou não.
  - [x] 10.2 `cd backend && uv run pytest && uv run ruff check . && uv run lint-imports && uv run python manage.py check` — rodar e colar a contagem **real** observada (guardrail retro Epic 3 §1, repetido nas Dev Notes da 4.1/4.2).
  - [x] 10.3 `cd frontend && npm run typecheck && npm run lint && npm run build && npm run test` — idem, colar a contagem real.
  - [x] 10.4 **Verificação manual contra backend+frontend reais** (`npm run dev` + backend, logado, padrão Playwright das Stories 4.1/4.2): semear via ORM (`tenant_context(user)`, sem admin configurado neste ambiente — mesmo caminho da 4.2) uma Weekly Log da semana anterior com 1 tarefa pai (1 filho pendente + 1 filho concluído) e uma Monthly Log do mês anterior com 1 tarefa solta pendente + 1 item já no Monthly Log corrente sem `scheduledDate` (simulando uma "chegada" do Future Log). Abrir hoje: confirmar os 3 banners (diário — se houver tarefas de ontem semeadas —, semanal, mensal) todos presentes com as contagens certas. Iniciar a revisão semanal → migrar o pai para "esta semana" (confirma na Weekly Log corrente, filho concluído permanece na semana anterior). Iniciar a revisão mensal → decidir a tarefa solta com "migrar com data" (confirma no Monthly Log corrente com a data escolhida). Abrir o Monthly Log corrente → confirmar que a seção "Itens do Future Log para [Mês]" aparece no topo com o item sem data pré-existente; preencher uma data nele e confirmar que sai da seção após refetch. Reabrir a Daily Log → todos os banners resolvidos não reaparecem. Zero erros de console.
  - [x] 10.5 **File List por último** (retro Epic 3 §8-2, guardrail ativo): `git status --short` + `git diff --stat` **depois** da verificação manual, reconciliar contra o File List documentado.

## Dev Notes

### Migrated vs. Postponed também vale para "semana" (extensão da decisão da 4.2)

A 4.2 resolveu a ambiguidade `epics.md` (genérico "status=migrated") vs. `FR-1.4`/`AD-02` (migrated/postponed distintos) assim: **mover para o container do período CORRENTE = `migrated`; mover para um container FUTURO/adiado = `postponed`**. Esta story estende a mesma regra ao novo destino `"week"`: migrar para a Weekly Log corrente é o equivalente semanal de "migrar para hoje" → `status=migrated`. Não há destino "semana futura" nesta story (isso seria catch-up genérico, Story 4.4) — `"week"` sempre aponta para `week_start_of(today_for(user))`, nunca aceito do cliente (mesmo princípio de "mês nunca vem do cliente para destination=month" da 4.2, Task de `TaskMigrateView`).

### Anatomia do card por contexto — por que não um componente novo por fluxo

`epics.md`/PRD definem 3 conjuntos de decisão diferentes: diário (4: hoje/mês/futuro/cancelar, FR-1.7), semanal (3 nomeados: "migrar para o novo Weekly Log, adiar ou cancelar", FR-1.8) e mensal (3: "migrar com data / adiar no futuro / cancelar", FR-1.9). Uma leitura literal do FR-1.8 sugeriria um card semanal com só 3 botões (1 "migrar", 1 "adiar" genérico, 1 "cancelar") — mas isso exigiria decidir *dentro* do botão "adiar" se é mês ou futuro, uma interação nova sem precedente no componente. EXPERIENCE.md §4.1 já estabelece que o design do sistema reaproveita componentes entre logs ("Task Row... aparece em Daily Log, Weekly Log, Monthly Log e Future Log") — por analogia, o Migration Card também deve ser um único componente parametrizado, não 3 componentes divergentes. Esta story resolve a favor do reaproveitamento máximo: o card semanal mantém a MESMA anatomia de 4 botões do diário (só o botão 1 muda de rótulo/destino), preservando os dois sabores de "adiar" (mês/futuro) que o FR-1.8 generaliza como "adiar" — a interpretação mais rica e coerente com o resto do sistema. Já o card mensal genuinamente **não tem** um botão 1 equivalente (a origem já É o mês corrente — não existe "migrar para o mês corrente" quando a tarefa já está lá), por isso são 3 botões reais, não 4 com um oculto. **Se o code-review ou Hugo discordarem da forma do card semanal**, é uma mudança isolada em `MigrationCard`'s `primaryAction`, não estrutural.

### Fechamento (FR-1.10) considera só tarefas-raiz nesta story

AD-08 item 10 diz que o fechamento de um log "considera a subárvore" — um pai com filho pendente não fecha. Esta story implementa o gatilho do banner e a fila de revisão usando **o mesmo filtro raiz que a fila expõe** (`parent_task__isnull=True`, igual à `MigrationQueueView` da 4.2) — não uma varredura de "qualquer tarefa da subárvore, mesmo órfã de uma raiz já disposta". Motivo prático: se o predicado de fechamento fosse mais amplo que a fila (ex.: contasse um neto pendente cujo avô/pai já foi completado/cancelado diretamente, sem passar por `migrate_task`), o banner apareceria prometendo "revisar" mas o Migration Card não teria nada pra mostrar (a fila só lista raízes) — um beco sem saída. Esse cenário (pai completado com filho ainda pendente, sem usar o fluxo de migração) é um **gap pré-existente da máquina de estados** desde a 3.1/AD-08, ortogonal a esta story — `transition_task` nunca impôs consistência de subárvore no nível de uma transição manual isolada. Não é esta story que introduz nem resolve esse gap; só evita agravá-lo fazendo o predicado de "fechada" bater exatamente com o conteúdo real da fila.

### Pull do Future Log é armazenamento, não uma ação nova

Ver Task 8.1 — o "pull automático" do AC #2 já está resolvido pelo modelo de dados desde a 4.1 (Future Log = `monthly_log` futuro; quando o mês vira, os itens já estão fisicamente na `MonthlyLog` corrente). O trabalho real desta story é só de **apresentação**: destacar, no topo do Monthly Log corrente, os itens sem data (reaproveitando o agrupamento `withoutDate` já existente desde a 4.1) sob o rótulo "Itens do Future Log para [Mês]" em vez de "Sem dia definido", e oferecer confirmação de data inline via o PATCH de tarefa já existente (estendido com `scheduledDate`, Task 2.5/5.3). **Não** criar um endpoint "confirmar item do Future Log" dedicado — seria duplicar o que `TaskDetailView`/`update_task` já fazem.

### Reaproveitamento obrigatório — não reinventar

Nenhum serviço novo nesta story: `migrate_task`/`_migrate_subtree` (4.2), `get_or_create_weekly_log`/`get_or_create_monthly_log` (4.1), `transition_task`/`ALLOWED` (3.1), `create_task`/`update_task` (3.3) — todos reaproveitados sem alteração de assinatura (só `TaskUpdateSerializer` ganha um campo opcional). `WeeklyReviewQueueView`/`MonthlyReviewQueueView` são views finas no mesmo molde de `MigrationQueueView` — não introduzem uma abstração de "fila genérica" prematura (a generalização de fato — catch-up multi-dia — é a Story 4.4, que reaproveita `migrate_task` mudando só o *caller*, conforme já antecipado nas Dev Notes da 4.2).

### Previous Story Intelligence (4.2 — done)

- Stack: Django 5.2 + DRF + `uv`; Node 22 + Vite + React 19 + MUI 6.1 + TanStack Query 5.59. Sem dependência nova.
- `services/migration.py` (`migrate_task`, `_migrate_subtree`), `services/state_machine.py` (`transition_task`, `ALLOWED`), `services/logs.py` (`get_or_create_*`) — reaproveitados sem alteração de assinatura (só o dispatcher de `migrate_task` ganha um `elif`).
- `views.py`/`serializers.py`/`urls.py` — estender, não recriar (padrão view fina de todas as stories anteriores).
- Frontend: `MigrationBanner.tsx` é o molde para `WeeklyReviewBanner.tsx`/`MonthlyReviewBanner.tsx` — copiar a estrutura (query + banner condicional + `MigrationFlow`), não reinventar o layout. `MigrationCard.tsx`/`MigrationFlow.tsx` ganham a prop `flowType` mas continuam sendo os únicos componentes de decisão-por-tarefa do sistema.
- Invalidação por prefixo (`['bujo','monthlyLog']`/`['bujo','weeklyLog']` sem o terceiro elemento) — padrão desde a 4.1/4.2, replicado aqui para as novas filas.
- **Achado do code-review da 4.2 (corrigido nesta sessão, relevante para esta story):** `<MigrationCard>` dentro de `MigrationFlow` **precisa** de `key={currentTask.id}` — sem isso o React reaproveita a instância entre tarefas e o estado interno do picker (`futureDay`) vaza de um card para o próximo, violando "nenhuma tarefa se move sem decisão explícita". Essa `key` já está em produção (`MigrationFlow.tsx` linha 92) — **não remover** ao adicionar a prop `flowType`.
- `jest-axe` só pega violações reais contra o componente **de verdade**, nunca mockado (lição repetida em 3.3/4.1/4.2) — aplicar nas 3 variantes de `flowType` em `MigrationCard.test.tsx`.
- **File List por último** (retro Epic 3 §8-2): rodar `git status --short`/`git diff --stat` **depois** da verificação manual e reconciliar — guardrail ativo em `_bmad/custom/bmad-dev-story.toml`.
- **Contagem de testes sempre real, nunca de memória** (retro Epic 3 §1) — rodar o comando de verdade antes de escrever Completion Notes/Debug Log.

### Git Intelligence

- Branch `main`; HEAD em `3adda16` (Story 4.2 mergeada, incluindo o fix de vazamento de estado entre Migration Cards). Convenção de commit: `feat(story-4.3): <descrição em pt-BR>`.
- Nenhuma mudança de schema nesta story — todos os campos usados (`weekly_log`, `monthly_log`, `scheduled_date`, `migrated_to_task`, `migration_count`) já existem desde a 3.1/4.1. Não é necessária nenhuma migration nova.

### Contexto não-bloqueante (ações da retro Epic 3 / Epic 4)

- **Deploy (AR-21) concluído** (2026-07-12). **AR-22 (observabilidade)** segue pendente, sem dono/data — **não bloqueia** esta story.
- Story 4.4 (Catch-Up de dias pulados, próxima) generaliza a fonte da fila de migração para "qualquer log com data < hoje" — reaproveita `migrate_task` e o mesmo `MigrationCard`/`MigrationFlow` desta e da 4.2, mudando só o *caller*/fonte da fila. Não precisa alterar nada desta story.
- Story 4.6 (Fechamento de ciclos e Arquivo) é quem efetivamente introduz o indicador "Fechada"/"Fechado" e a superfície Arquivo — o predicado de fechamento desta story (Task 2.3) é a base que a 4.6 vai reaproveitar/expor.

### Project Structure Notes

- Backend: nenhum arquivo novo de serviço. `services/migration.py` ganha um `elif` no dispatcher existente. `views.py`/`serializers.py`/`urls.py` estendidos, não recriados. Nenhuma migration nova.
- Frontend: `features/bujo/components/` ganha `WeeklyReviewBanner.tsx`, `MonthlyReviewBanner.tsx` (+ testes) — novos arquivos. `MigrationCard.tsx`/`MigrationFlow.tsx` estendidos com a prop `flowType`, sem novo arquivo. `api.ts`/`keys.ts`/`types.ts`/`index.ts` estendidos. `pages/daily/DailyPage.tsx` ganha duas linhas de composição. `pages/planner/MonthlyPage.tsx` ganha lógica condicional de reordenação/rótulo + input de data inline — sem componente novo.
- Fronteiras (§7.2): `features/bujo` não importa outra feature; `pages/daily`/`pages/planner` compõem a feature (já faziam isso). Sem violação de `import-linter` (mesma app `bujo` no backend).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.3 (linhas 672-688); §Epic 4 (linhas 622-624 — "histórias estritamente ordenadas")]
- [Source: _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md#FR-1.7 (linhas 191-195), FR-1.8 (linha 197 — migrar/adiar/cancelar na semana), FR-1.9 (linhas 199-201 — 2 partes: revisão do mês anterior + pull do Future Log), FR-1.10 (linha 203 — semana fechada quando todas as tarefas têm disposição)]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-02 (linhas 124-145 — matriz ALLOWED), AD-03 (linhas 149-185 — linhagem, generalização Task↔log), AD-08 item 10 (linha 497 — fechamento considera subárvore), item 11 (linha 499 — migração de subárvore), §6.2/6.3/6.4/6.6/6.8 (camada de serviço), Future Log = monthly_log futuro (linha 286)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/EXPERIENCE.md §4.2 (Migration Card — anatomia reaproveitada, linhas 194-217), §5.2 (Weekly Log — estados, banner "Semana anterior tem N tarefas sem disposição. Revisar?", linhas 363-369), §5.3 (Monthly Log — estados, banner "Revisar mês anterior", seção "Itens do Future Log para este mês", linhas 371-378), Fluxo 1 (linhas 537-563 — ordem de banners diário→semanal, revisão semanal em uso), Fluxo 3 (linhas 583-599 — abertura do mês, revisão mensal + pull do Future Log + recorrentes em uso)]
- [Source: backend/bujo/models.py — `WeeklyLog`/`MonthlyLog`/`Task` (campos já existentes, sem alteração de schema); backend/bujo/services/{migration,logs,state_machine,tasks}.py — serviços reaproveitados; backend/core/calendar.py — `today_for`/`week_start_of` (reusar, nunca `date.today()`)]
- [Source: backend/bujo/{views,serializers,urls}.py (padrão view fina/serializer a estender); backend/bujo/tests/{factories,test_services,test_views}.py (padrões de teste e factories `WeeklyLogFactory`/`MonthlyLogFactory` a seguir)]
- [Source: frontend/src/api/keys.ts (padrão de query key + invalidação por prefixo); frontend/src/features/bujo/{api,types,index}.ts; frontend/src/features/bujo/components/{MigrationBanner,MigrationCard,MigrationFlow}.tsx (moldes a reaproveitar/estender); frontend/src/pages/daily/DailyPage.tsx (ponto de integração dos banners); frontend/src/pages/planner/{WeeklyPage,MonthlyPage}.tsx (padrões de página do Épico 4, `groupTasksByScheduledDate` a reaproveitar)]
- [Source: _bmad-output/implementation-artifacts/4-2-migracao-diaria-com-migration-card-e-linhagem.md#Dev Notes (decisão migrated/postponed, escopo "só ontem", reaproveitamento obrigatório), #Senior Developer Review (achado do `key={currentTask.id}` — não remover), #Completion Notes (contagens reais de teste)]
- [Source: _bmad-output/implementation-artifacts/4-1-logs-weekly-monthly-e-future.md#Dev Notes (Future Log = monthly_log futuro, `groupTasksByScheduledDate`, invalidação por prefixo)]
- [Source: _bmad-output/implementation-artifacts/epic-3-retro-2026-07-08.md §5/§8 (guardrails "cenário de subárvore como primeiro teste", "File List por último" — codificados em _bmad/custom/bmad-dev-story.toml)]

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- Backend: `cd backend && uv run pytest` → **249 passed in 577.60s (0:09:37)** (contagem real, execução final após os ajustes de `ruff`). `uv run ruff check .` → `All checks passed!`. `uv run lint-imports` → `Contracts: 1 kept, 0 broken.` (regra "core must not import domain apps" mantida). `uv run python manage.py check` → `System check identified no issues (0 silenced).`
- Frontend: `npm run typecheck` → limpo. `npm run lint` → limpo. `npm run build` → sucesso (warning de chunk >500kB é pré-existente, não desta story). `npx vitest run` → **Test Files 36 passed (36) / Tests 323 passed (323)**.
- Verificação manual (Task 10.4): em vez de um script Playwright temporário descartável, foi escrito um spec E2E **permanente** (`frontend/e2e/weekly-monthly-review.spec.ts` + `frontend/e2e/seedReviewScenario.ts`), mesmo padrão de `migration-flow.spec.ts`/`seedYesterdayQueue.ts` da Story 4.2 (achado MEDIUM do review da 4.2 foi justamente reconhecer esses arquivos como parte do File List, não descartáveis). Rodado com `npx playwright test` contra backend real (`manage.py runserver`, Neon dev branch) + frontend real (`npm run dev`, Vite): usuário real via signup UI; seed via ORM (`tenant_context(user)`, sem admin configurado neste ambiente) de (a) Weekly Log da semana anterior com 1 pai (1 filho `pending` + 1 filho `completed`), (b) Monthly Log do mês anterior com 1 tarefa solta `pending`, (c) Monthly Log do mês corrente com 1 tarefa sem `scheduledDate` (simulando chegada do Future Log).
  - Os 2 banners (`WeeklyReviewBanner`/`MonthlyReviewBanner`) apareceram com o texto exato e contagem certa ("Semana anterior tem 1 tarefas sem disposição. Revisar?" / "Mês anterior tem 1 tarefas sem disposição. Revisar mês anterior?").
  - Revisão semanal: atalho "1" (`flowType="weekly"`, botão "Migrar para esta semana") migrou o pai para a Weekly Log corrente; dialog fechou sozinho (fila esvaziou); banner sumiu.
  - Revisão mensal: `flowType="monthly"` confirmado com só 3 botões (sem "hoje/semana"); "Definir data em [mês]" abriu o mesmo picker `input[type=date]` já usado em `daily`/`weekly`, `fill` confirmou automaticamente (sem botão extra); dialog fechou; banner sumiu.
  - Monthly Log corrente (navegação via clique na Sidebar "Este Mês", não `page.goto` — evita reload completo/reautenticação): seção "Itens do Future Log para [Mês]" apareceu no topo com o item pré-existente sem data; a tarefa recém-migrada com data já apareceu agrupada por dia (`DayHeader`), confirmando a Task 8.1 (reordenação só quando `monthFirst === mês corrente`).
  - Preencher a data (`input` "Confirmar data") do item do Future Log → `PATCH /tasks/{id}/` com `scheduledDate` → seção "Itens do Future Log" desapareceu após o refetch (0 itens sem data restantes).
  - Reaberta a Daily Log (clique em "Hoje" na Sidebar): nenhum dos 2 banners resolvidos reapareceu.
  - Listener de console (`page.on('console')`/`page.on('pageerror')`) confirmou **zero erros** durante todo o fluxo.
  - Suíte E2E completa (`npx playwright test`, todos os specs): 14 passed na primeira rodada + 1 falha em `migration-flow.spec.ts` isolada à etapa de signup (fixture compartilhada, nada relacionado a esta story) — reexecutado esse spec sozinho e os 5 testes passaram, confirmando flake de concorrência (`fullyParallel`, múltiplos signups simultâneos contra o mesmo Neon dev branch), não regressão.

### Completion Notes List

- `migrate_task` (`services/migration.py`) ganhou o ramo `"week"` reaproveitando `_migrate_subtree` sem duplicação — migra para a Weekly Log CORRENTE (`week_start_of(today_for(user))`, nunca aceito do cliente) com `status=MIGRATED` (mesma regra "período corrente = migrated" da 4.2, estendida à semana). Cenário-âncora "pai com filho pendente + filho concluído" para o destino `"week"` foi escrito **antes** do teste simples de `destination="week"` em `test_services.py` (guardrail retro Epic 3 §5, codificado em `_bmad/custom/bmad-dev-story.toml`).
- `WeeklyReviewQueueView`/`MonthlyReviewQueueView` (views finas, mesmo molde de `MigrationQueueView`): `.filter().first()` sobre o período anterior, nunca `get_or_create_*` — não materializam Weekly/Monthly Log quando não existem. Nenhuma checa de "é segunda?"/"é dia 1?" — detecção por condição (fila vazia ⇒ banner some), não por data (AD-09).
- `TaskUpdateSerializer` ganhou `scheduled_date` opcional; a validação de mês (só quando `task.monthly_log_id is not None`) vive em `TaskDetailView.patch` (a view, não o serializer, tem acesso à instância) — Daily/Weekly Log não são afetados pela checagem.
- Contrato de API regenerado (`schema.yaml`/`types.gen.ts`): diff conferido manualmente — só entraram `WeeklyReviewQueue`, `MonthlyReviewQueue`, `"week"` em `DestinationEnum`, `scheduledDate` em `TaskUpdate`; blocos `security` dos endpoints existentes intactos (guardrail retro Epic 3 §3).
- `MigrationCard`/`MigrationFlow` ganharam a prop `flowType: 'daily' | 'weekly' | 'monthly'` (default `'daily'`, usos existentes em `MigrationBanner` inalterados) — reaproveitamento máximo do componente único, sem duplicar JSX; tabela de atalhos por `flowType` como objeto simples em vez de if/else aninhado. `key={currentTask.id}` da 4.2 preservada (não removida).
- `WeeklyReviewBanner`/`MonthlyReviewBanner` novos (mesmo molde de `MigrationBanner`), compostos em `DailyPage.tsx` logo abaixo do `MigrationBanner` — 3 banners independentes, cada um com sua própria query.
- `MonthlyPage.tsx`: quando o mês exibido é o corrente, a seção `withoutDate` (já existente desde a 4.1) vem antes de `withDate` com o rótulo "Itens do Future Log para [Mês]" e ganha um input de data inline por linha (`useUpdateTaskMutation` com `scheduledDate`); qualquer outro mês mantém o comportamento pré-4.3 inalterado (regressão coberta em `MonthlyPage.test.tsx`, com "hoje" fixado via `vi.setSystemTime` para não depender do relógio real da máquina).
- `useUpdateTaskMutation` ganhou invalidação por prefixo de `['bujo','monthlyLog']` no `onSuccess` (ausente até então porque a mutação nunca era usada fora do Daily Log) — necessário porque a atualização otimista existente só toca o cache do Daily Log.
- Testes de frontend que montam `DailyPage`/rotas via mock do barrel `features/bujo` (`RouteAnnouncer.test.tsx`, `router.test.tsx`) precisaram do mock de `WeeklyReviewBanner`/`MonthlyReviewBanner` (`() => null`) — sem isso o mock incompleto quebrava o render (achado durante a rodada de regressão desta sessão, corrigido antes de finalizar).
- Suite backend completa: **249 passed, 577.60s** (contagem real). Suite frontend completa: **323 passed (36 arquivos)** (contagem real). `ruff`/`lint-imports`/`manage.py check`/`typecheck`/`lint`/`build` sem achados.
- Verificação manual (Task 10.4) executada nesta sessão contra backend+frontend reais via um spec E2E permanente (`weekly-monthly-review.spec.ts`), cobrindo os 2 banners, as 2 revisões (semanal `flowType=week`, mensal `flowType=month` com data), a seção "Itens do Future Log" e a confirmação de data — zero erros de console. Detalhes em Debug Log References acima.
- File List reconciliado por último (Task 10.5), depois da verificação manual, contra `git status --short`/`git diff --stat` reais — incluiu os 2 arquivos novos de E2E permanente (mesma lição do achado MEDIUM da revisão da 4.2, aplicada preventivamente desta vez).

### File List

- backend/bujo/serializers.py
- backend/bujo/services/migration.py
- backend/bujo/tests/test_services.py
- backend/bujo/tests/test_views.py
- backend/bujo/urls.py
- backend/bujo/views.py
- schema.yaml
- frontend/src/api/keys.ts
- frontend/src/api/types.gen.ts
- frontend/src/app/layout/RouteAnnouncer.test.tsx
- frontend/src/app/router.test.tsx
- frontend/src/features/bujo/api.ts
- frontend/src/features/bujo/api.test.tsx
- frontend/src/features/bujo/index.ts
- frontend/src/features/bujo/types.ts
- frontend/src/features/bujo/components/MigrationCard.tsx
- frontend/src/features/bujo/components/MigrationCard.test.tsx
- frontend/src/features/bujo/components/MigrationFlow.tsx
- frontend/src/features/bujo/components/MigrationFlow.test.tsx
- frontend/src/features/bujo/components/WeeklyReviewBanner.tsx
- frontend/src/features/bujo/components/WeeklyReviewBanner.test.tsx
- frontend/src/features/bujo/components/MonthlyReviewBanner.tsx
- frontend/src/features/bujo/components/MonthlyReviewBanner.test.tsx
- frontend/src/pages/daily/DailyPage.tsx
- frontend/src/pages/daily/DailyPage.test.tsx
- frontend/src/pages/planner/MonthlyPage.tsx
- frontend/src/pages/planner/MonthlyPage.test.tsx
- frontend/e2e/seedReviewScenario.ts
- frontend/e2e/weekly-monthly-review.spec.ts
- frontend/src/features/bujo/monthNames.ts
- docs/futureIdeas.md

## Senior Developer Review (AI)

**Reviewer:** HugoMMBrito (story-automator, revisão automática) em 2026-07-13

**Verificação independente:** todas as claims de contagem de teste foram reexecutadas nesta sessão, não aceitas de memória — `uv run pytest` → **249 passed** (bate com Debug Log), `uv run ruff check .` → limpo, `uv run lint-imports` → `1 kept, 0 broken`, `uv run python manage.py check` → sem issues, `npm run typecheck`/`npm run lint`/`npm run build` → limpos, `npx vitest run` → **323 passed (36 arquivos)** (bate com Debug Log). Diff de `schema.yaml` conferido linha a linha: só `WeeklyReviewQueue`/`MonthlyReviewQueue`/`"week"` em `DestinationEnum`/`scheduledDate` em `TaskUpdate`, blocos `security` intactos. `npm run generate-types` reexecutado — sem diff residual em `types.gen.ts`. Todas as 2 ACs, os 10 tasks e o File List foram lidos e cruzados contra os diffs reais de cada arquivo (`git diff`).

### Findings

1. **[MEDIUM] Arquivo alterado fora do File List** — `docs/futureIdeas.md` recebeu 2 novas linhas (notas de backlog/bugs) na mesma sessão, mas não constava no File List original da story. **Fix aplicado:** arquivo adicionado ao File List (transparência, sem alterar o conteúdo — a mudança em si é anotação de backlog, não parte do escopo funcional da story).
2. **[LOW] Duplicação de dados — nomes de mês em pt-BR** — `MigrationCard.tsx` (`MONTH_NAMES_PT`, minúsculo) e `MonthlyPage.tsx` (`MONTH_NAMES`, capitalizado) definiam a mesma lista de 12 meses em pt-BR de forma independente — risco de drift (ex.: um typo corrigido em um arquivo e não no outro). **Fix aplicado:** extraído para `frontend/src/features/bujo/monthNames.ts` (`MONTH_NAMES_PT` canônico minúsculo + `capitalize()`), ambos os componentes agora importam do mesmo lugar. Suítes de teste (`MigrationCard.test.tsx`, `MonthlyPage.test.tsx`) e verificação manual (`npx vitest run` → 323 passed, `npm run build` → sucesso) confirmam que o comportamento observável não mudou.

Nenhum achado HIGH/CRITICAL: as 2 ACs estão implementadas e testadas (unit + `test_views`/`test_services` + E2E permanente já presente no File List), nenhuma task marcada `[x]` ficou sem evidência de implementação real, nenhuma discrepância entre git e o restante do File List, `key={currentTask.id}` da 4.2 preservada, guardrails da retro Epic 3 (cenário de subárvore primeiro, File List por último, contagem real de testes) todos respeitados.

**Outcome:** Approved — 0 issues CRITICAL/HIGH remanescentes.
