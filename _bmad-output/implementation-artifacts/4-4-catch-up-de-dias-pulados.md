---
baseline_commit: 466bcee2350b3035f1b0e07dd68cf6f876af0570
---

# Story 4.4: Catch-Up de dias pulados

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero, ao voltar depois de pular vários dias, reconciliar as tarefas não-dispostas num único fluxo,
Para que uma ausência seja um evento de reencontro, não N migrações de procrastinação (FR-1.7 generalizado, AR-19/AD-09).

## Acceptance Criteria

1. **Catch-Up generalizado — detecção por query, ordem hierárquica mês → semana → dia (AD-09)**
   - **Dado que** tarefas `pending`/`started` em logs com data < hoje após dias pulados,
   - **Quando** Hugo reabre o app,
   - **Então** a detecção é por **query** (sem cron, sem fila acumulada) e o mesmo Fluxo de Migração apresenta as tarefas, na ordem hierárquica **mês → semana → dia**,
   - **E** cada tarefa migrada incrementa `migration_count` em **1** por decisão (não por dia de calendário pulado).

2. **Lacunas honestas — catch-up é só de tarefas**
   - **Dado que** os dias pulados,
   - **Quando** o catch-up roda,
   - **Então** esses dias permanecem como lacunas honestas (sem linhas materializadas, fora de qualquer denominador) — nunca 0% fabricado,
   - **E** o catch-up cobre **somente tarefas**; preencher hábitos/saúde de um dia pulado usa o caminho normal de navegar até o dia.

## Tasks / Subtasks

> **Ordem de execução:** backend (view/serializer → contrato) antes do frontend (data layer → componentes → integração), igual às Stories 4.1/4.2/4.3. A Task 3 (regenerar contrato) é o pivô.
>
> **Decisão de design desta story (ver Dev Notes "Catch-Up é aditivo, não substitui 4.2/4.3"):** esta story **não** altera `MigrationQueueView`/`WeeklyReviewQueueView`/`MonthlyReviewQueueView` (4.2/4.3, já em produção, com E2E cobrindo o comportamento exato) — eles continuam cobrindo **exatamente** "ontem"/"semana anterior"/"mês anterior". O Catch-Up é uma **view nova, aditiva**, que cobre exclusivamente o que fica **fora** dessas três janelas (qualquer coisa **mais antiga** que "ontem"/"semana anterior"/"mês anterior") — sem isso, a mesma tarefa apareceria em dois banners simultaneamente.
>
> **⚠️ Guardrail codificado da retro Epic 3 (`_bmad/custom/bmad-dev-story.toml`):** o cenário "pai com filho pendente, filho concluído" continua sendo reaproveitado de `_migrate_subtree` (4.2) — nenhuma lógica de subárvore nova nesta story; não é necessário reescrevê-lo, só confirmar via teste que a fila do catch-up também só lista raízes (mesma convenção das 4.2/4.3).

- [x] **Task 1: `CatchUpQueueView` — detecção aditiva por query, sem materialização** (AC: #1, #2)
  - [x] 1.1 Em `backend/bujo/serializers.py`, adicionar (mesmo molde de `MigrationQueueSerializer`/`WeeklyReviewQueueSerializer`/`MonthlyReviewQueueSerializer`):
    ```python
    class CatchUpQueueSerializer(serializers.Serializer):
        monthly_tasks = TaskSerializer(many=True)
        weekly_tasks = TaskSerializer(many=True)
        daily_tasks = TaskSerializer(many=True)
    ```
    Três listas separadas (não uma fila única) — o frontend (Task 7) precisa saber a que nível cada tarefa pertence para escolher o `flowType` do `MigrationCard` certo; achatar num único array perderia essa informação.
  - [x] 1.2 Em `backend/bujo/views.py`, adicionar `CatchUpQueueView` reaproveitando **exatamente** os mesmos cálculos de fronteira já usados em `MigrationQueueView`/`WeeklyReviewQueueView`/`MonthlyReviewQueueView` (`yesterday`, `previous_week_start`, `previous_month_first`) — só troca `=` por `<lt`, isolando o catch-up ao que é **mais antigo** que essas fronteiras (nunca sobrepõe as filas da 4.2/4.3):
    ```python
    class CatchUpQueueView(APIView):
        @extend_schema(responses=CatchUpQueueSerializer)
        def get(self, request):
            today = today_for(request.user)
            yesterday = today - timedelta(days=1)
            previous_week_start = week_start_of(today) - timedelta(weeks=1)
            previous_month_first = (today.replace(day=1) - timedelta(days=1)).replace(day=1)

            def undisposed_roots(queryset):
                return queryset.filter(
                    status__in=[Task.Status.PENDING, Task.Status.STARTED], parent_task__isnull=True
                )

            monthly_tasks = undisposed_roots(
                Task.objects.filter(monthly_log__month_first__lt=previous_month_first)
            ).order_by("monthly_log__month_first")
            weekly_tasks = undisposed_roots(
                Task.objects.filter(weekly_log__week_start__lt=previous_week_start)
            ).order_by("weekly_log__week_start")
            daily_tasks = undisposed_roots(
                Task.objects.filter(log__log_date__lt=yesterday)
            ).order_by("log__log_date")

            data = {
                "monthly_tasks": monthly_tasks,
                "weekly_tasks": weekly_tasks,
                "daily_tasks": daily_tasks,
            }
            return Response(CatchUpQueueSerializer(data).data)
    ```
    **Sem `get_or_create_*` em lugar nenhum** — mesma disciplina de não-materialização das 3 views existentes (AD-09 item 2: "não existe fila de migração materializada"). Ordenação `order_by(<campo_de_data>)` = mais antigo primeiro dentro de cada nível (não faz diferença de negócio, só resolve empate de apresentação dentro do mesmo nível — a AC só exige ordem **entre** níveis).
  - [x] 1.3 Em `backend/bujo/urls.py`: `path("catch-up/queue/", CatchUpQueueView.as_view(), name="bujo-catch-up-queue")` (preservando as 14 rotas existentes; importar `CatchUpQueueView` em `views.py` import list).

- [x] **Task 2: Testes de view — isolamento das 3 janelas, não-materialização, tenant** (AC: #1, #2)
  - [x] 2.1 `backend/bujo/tests/test_views.py` (estender, mesma seção `# --- CatchUpQueueView ---`):
    - **Regressão de sobreposição (a mais importante desta story):** com uma tarefa `pending` **só** em "ontem" (`Log.log_date = yesterday`), **só** na "semana anterior" (`WeeklyLog.week_start = previous_week_start`) e **só** no "mês anterior" (`MonthlyLog.month_first = previous_month_first`) → `GET /catch-up/queue/` retorna as **3 listas vazias** (essas tarefas já são cobertas por `MigrationQueueView`/`WeeklyReviewQueueView`/`MonthlyReviewQueueView`, não podem aparecer duplicadas no Catch-Up).
    - Com um `Log` de **10 dias atrás** com 1 tarefa `pending` + 1 `started` + 1 `completed` + 1 `cancelled` + 1 subtarefa `pending` de uma tarefa raiz → `dailyTasks` traz só as 2 raízes `pending`/`started` (mesma convenção "só raízes" de 4.2/4.3).
    - Idem para um `WeeklyLog` de 3 semanas atrás → `weeklyTasks`; idem para um `MonthlyLog` de 3 meses atrás → `monthlyTasks`.
    - Nenhum `Log`/`WeeklyLog`/`MonthlyLog` é criado pela chamada (`tenant_context(user)` + `Log.objects.count() == 0` antes/depois, mesmo padrão da 4.2).
    - Escopo por tenant: tarefa antiga de `other_user` não aparece na resposta de `user` (mesmo padrão `test_get_weekly_review_queue_escopado_por_tenant`).

- [x] **Task 3: Regenerar o contrato de API** (AC: #1)
  - [x] 3.1 `cd backend && uv run python manage.py spectacular --file ../schema.yaml`
  - [x] 3.2 `cd frontend && npm run generate-types`
  - [x] 3.3 Confirmar que o step de CI "Verificar types.gen.ts está atualizado" passa sem diff residual.
  - [x] 3.4 Confirmar no diff do `schema.yaml` que só entrou o schema/path novo (`CatchUpQueue`, `GET /api/bujo/catch-up/queue/`) e que os blocos `security` dos endpoints existentes seguem intactos (guardrail retro Epic 3 §3).

- [x] **Task 4: Teste de serviço — `migration_count` por decisão, não por dia pulado** (AC: #1)
  - [x] 4.1 `backend/bujo/tests/test_services.py` (estender): criar um `Log` com `log_date` **10 dias no passado** e uma `Task` `pending` nele (`migration_count=0`); chamar `migrate_task(destination="today")` **uma vez** → o novo registro tem `migration_count == 1` (não `10`, não o número de dias pulados) — prova direta da AC #1 "por decisão, não por dia de calendário pulado". Não precisa de teste novo de subárvore aqui: `_migrate_subtree` já é exercitado pelas 4.2/4.3 e não muda nesta story.

- [x] **Task 5: Camada de dados do frontend** (AC: #1)
  - [x] 5.1 Em `frontend/src/api/keys.ts` (estender a seção `bujo`): `catchUpQueue: () => ['bujo', 'catchUpQueue', 'list'] as const,`.
  - [x] 5.2 Em `frontend/src/features/bujo/types.ts` (estender): `export type CatchUpQueue = components['schemas']['CatchUpQueue']` (nome exato conforme `schema.yaml` gerado na Task 3 — conferir; campos `monthlyTasks`/`weeklyTasks`/`dailyTasks` via camelCase automático).
  - [x] 5.3 Em `frontend/src/features/bujo/api.ts` (estender): `useCatchUpQueueQuery()` — `useQuery` simples, GET `/api/bujo/catch-up/queue/` (mesmo molde de `useMigrationQueueQuery`). Em `useMigrateTaskMutation`, adicionar `queryClient.invalidateQueries({ queryKey: keys.bujo.catchUpQueue() })` à lista de invalidação do `onSuccess` (mesma técnica das 3 filas existentes).
  - [x] 5.4 Exportar `useCatchUpQueueQuery`/`CatchUpQueue` em `frontend/src/features/bujo/index.ts` (barrel) — só o suficiente para `CatchUpBanner` (Task 8) usar internamente; `CatchUpBanner` é o único export que `pages/daily` precisa.
  - [x] 5.5 `frontend/src/features/bujo/api.test.tsx` (estender): `useCatchUpQueueQuery` bate no endpoint certo; `useMigrateTaskMutation` invalida `catchUpQueue` além das chaves já existentes.

- [x] **Task 6: `MigrationFlow` — sinal de exaustão para orquestração externa** (AC: #1)
  - [x] 6.1 **Decisão de design desta story (ver Dev Notes "Por que `onExhausted`, não reescrever `MigrationFlow`")**: `MigrationFlow` ganha uma prop opcional `onExhausted?: () => void`. Em `handleDecide`, quando `nextIndex >= snapshot.length` (fila local esgotada — todas as tarefas decididas), chamar `onExhausted?.() ?? onClose()` em vez de sempre `onClose()`. O `Dialog`'s `onClose` (Esc/backdrop, "pausa retomável") **continua** chamando só `onClose()`, sem passar por `onExhausted` — só a exaustão natural da fila dispara `onExhausted`. `MigrationBanner`/`WeeklyReviewBanner`/`MonthlyReviewBanner` (4.2/4.3) **não passam** essa prop — comportamento deles **inalterado** (fallback para `onClose()`, idêntico a hoje).
  - [x] 6.2 `frontend/src/features/bujo/components/MigrationFlow.test.tsx` (estender): caso novo — com `onExhausted` fornecido, decidir a última tarefa da fila chama `onExhausted` e **não** chama `onClose`; sem `onExhausted`, decidir a última tarefa chama `onClose` (regressão do comportamento atual). Esc/backdrop sempre chama só `onClose`, nunca `onExhausted`, em ambos os casos.

- [x] **Task 7: `CatchUpFlow` — orquestra mês → semana → dia num único Dialog contínuo** (AC: #1)
  - [x] 7.1 **Decisão de design desta story (ver Dev Notes "Um Dialog contínuo, não três banners separados")**: novo componente `frontend/src/features/bujo/components/CatchUpFlow.tsx`. Recebe `monthlyTasks`/`weeklyTasks`/`dailyTasks` (as 3 listas de `CatchUpQueue`) + `open`/`onClose`. Internamente mantém `stageIndex` sobre `const STAGE_ORDER: MigrationFlowType[] = ['monthly', 'weekly', 'daily']` (ordem hierárquica da AC #1) e renderiza **um único** `<MigrationFlow>` por vez, para o estágio corrente:
    ```tsx
    const queuesByStage: Record<MigrationFlowType, Task[]> = {
      monthly: monthlyTasks,
      weekly: weeklyTasks,
      daily: dailyTasks,
    }
    const [stageIndex, setStageIndex] = useState(0)

    useEffect(() => {
      if (open) {
        const first = STAGE_ORDER.findIndex((stage) => queuesByStage[stage].length > 0)
        setStageIndex(first === -1 ? STAGE_ORDER.length : first)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- só recalcula ao abrir, mesmo padrão do MigrationFlow
    }, [open])

    function handleExhausted() {
      const rest = STAGE_ORDER.slice(stageIndex + 1)
      const nextOffset = rest.findIndex((stage) => queuesByStage[stage].length > 0)
      if (nextOffset === -1) {
        onClose()
      } else {
        setStageIndex(stageIndex + 1 + nextOffset)
      }
    }

    if (!open || stageIndex >= STAGE_ORDER.length) return null
    const stage = STAGE_ORDER[stageIndex]

    return (
      <MigrationFlow
        key={stage}
        queue={queuesByStage[stage]}
        flowType={stage}
        open={open}
        onClose={onClose}
        onExhausted={handleExhausted}
      />
    )
    ```
    **`key={stage}` é obrigatório** — força o `MigrationFlow` a desmontar/remontar ao trocar de estágio, garantindo que seu `snapshot`/`currentIndex` internos (que só recapturam no próprio `useEffect` de `open`, Task 6) comecem limpos no novo nível, sem depender de truques de re-sincronização (mesma disciplina do `key={currentTask.id}` já em produção dentro do `MigrationCard`, achado do review da 4.2 — **não remover nenhum dos dois**). Esc/backdrop em qualquer estágio chama `onClose` direto (propagado sem interceptação) — pausa o Catch-Up inteiro (não avança estágio); reabrir o banner recalcula os estágios a partir da query ao vivo (nenhuma decisão é perdida: tarefas não decididas continuam `pending`/`started` no banco).
  - [x] 7.2 `frontend/src/features/bujo/components/CatchUpFlow.test.tsx` (novo): só `monthlyTasks` preenchido → abre direto em `flowType='monthly'`, fecha ao esgotar (sem passar por weekly/daily vazios). `weeklyTasks` + `dailyTasks` preenchidos (mês vazio) → abre direto em `'weekly'`, avança para `'daily'` ao esgotar `'weekly'`, fecha ao esgotar `'daily'`. Decidir todas as tarefas de `'monthly'` avança automaticamente para `'weekly'` sem fechar o Dialog (mesmo Dialog, sem flash de fechamento visível ao usuário — testável via id do Dialog/role permanecendo montado entre estágios). Esc durante `'weekly'` chama `onClose` do pai (Catch-Up inteiro pausa) sem pular para `'daily'`.

- [x] **Task 8: `CatchUpBanner`** (AC: #1)
  - [x] 8.1 `frontend/src/features/bujo/components/CatchUpBanner.tsx` (novo, mesmo molde de `MigrationBanner.tsx`/`WeeklyReviewBanner.tsx`): usa `useCatchUpQueueQuery()`; `total = monthlyTasks.length + weeklyTasks.length + dailyTasks.length`; se `total === 0` (ou `isPending`) não renderiza nada; senão texto "**{total} tarefas sem disposição de dias, semanas ou meses anteriores. Iniciar Catch-Up?**" + botão "**Iniciar Catch-Up**" que abre `<CatchUpFlow monthlyTasks={...} weeklyTasks={...} dailyTasks={...} .../>`.
  - [x] 8.2 Exportar `CatchUpBanner` em `frontend/src/features/bujo/index.ts` (barrel) — único componente que `pages/daily` precisa importar (mesma convenção de `MigrationBanner`/`WeeklyReviewBanner`/`MonthlyReviewBanner`).
  - [x] 8.3 `frontend/src/features/bujo/components/CatchUpBanner.test.tsx` (novo, mesmo molde de `MigrationBanner.test.tsx`): não renderiza com as 3 filas vazias; renderiza com contagem somada correta quando só 1 das 3 filas tem tarefas; clicar no botão abre o `CatchUpFlow`; `jest-axe` no componente real (nunca mockado — lição repetida em 3.3/4.1/4.2/4.3).

- [x] **Task 9: Integração no Daily Log** (AC: #1)
  - [x] 9.1 Em `frontend/src/pages/daily/DailyPage.tsx`, renderizar `<CatchUpBanner />` logo abaixo de `<MonthlyReviewBanner />` (ordem visual final: diário → semanal → mensal → catch-up, estendendo a ordem já estabelecida na 4.3 — "Hugo pode resolver na ordem que quiser", a posição na tela é só isso; o Catch-Up cobre exclusivamente o que os 3 banners anteriores não cobrem, então não há sobreposição de conteúdo entre eles).
  - [x] 9.2 Confirmar que abrir a Daily Log **não** materializa nenhum Log/WeeklyLog/MonthlyLog adicional por causa do novo banner (mesma disciplina de verificação da 4.1/4.2/4.3) — `CatchUpQueueView` só faz `.filter()`.

- [x] **Task 10: Testes de frontend + verificação manual** (AC: #1, #2)
  - [x] 10.1 `DailyPage.test.tsx` (estender): os 4 banners (diário/semanal/mensal/catch-up) aparecem/desaparecem independentemente conforme cada query retorna tarefas ou não; mock do barrel `features/bujo` usado por `RouteAnnouncer.test.tsx`/`router.test.tsx` precisa incluir `CatchUpBanner: () => null` (mesmo achado preventivo da 4.3, Task 5.4/Completion Notes — aplicar desde já para não quebrar esses testes).
  - [x] 10.2 `cd backend && uv run pytest && uv run ruff check . && uv run lint-imports && uv run python manage.py check` — rodar e colar a contagem **real** observada (guardrail retro Epic 3 §1, repetido nas Dev Notes de 4.1/4.2/4.3).
  - [x] 10.3 `cd frontend && npm run typecheck && npm run lint && npm run build && npm run test` — idem, colar a contagem real.
  - [x] 10.4 **Verificação manual contra backend+frontend reais** (`npm run dev` + backend, logado, padrão Playwright das Stories 4.1–4.3 — escrever um spec E2E **permanente**, `frontend/e2e/catch-up.spec.ts` + seed helper próprio ou reaproveitando `seedReviewScenario.ts` como referência de estilo): semear via ORM (`tenant_context(user)`) (a) um `MonthlyLog` de 3 meses atrás com 1 tarefa `pending`, (b) um `WeeklyLog` de 3 semanas atrás com 1 tarefa pai (1 filho `pending` + 1 filho `completed`), (c) um `Log` de 10 dias atrás com 1 tarefa `pending` — **nenhum** desses coincide com "ontem"/"semana anterior"/"mês anterior" (evitar sobreposição com os banners da 4.2/4.3 no mesmo cenário de teste). Abrir hoje: confirmar que **só** o banner Catch-Up aparece (os outros 3 não, pois não há pendência nas janelas deles) com a contagem certa (3: 1 mensal + 1 semanal (raiz, o pai) + 1 diária). Clicar "Iniciar Catch-Up" → primeiro card é do mês (`flowType='monthly'`, 3 botões); decidir → avança automaticamente (mesmo Dialog, sem fechar) para o card da semana (`flowType='weekly'`, 4 botões, "Migrar para esta semana" como botão 1); decidir o pai → avança para o card do dia (`flowType='daily'`, 4 botões, "Migrar para hoje"); decidir → Dialog fecha sozinho (todos os estágios esgotados); banner Catch-Up some. Reabrir a Daily Log → banner não reaparece. Verificar no admin/ORM que a tarefa do dia migrada tem `migration_count == 1` (não 10). Zero erros de console (`page.on('console')`/`page.on('pageerror')`).
  - [x] 10.5 **File List por último** (retro Epic 3 §8-2, guardrail ativo): `git status --short` + `git diff --stat` **depois** da verificação manual, reconciliar contra o File List documentado.

## Dev Notes

### Catch-Up é aditivo, não substitui 4.2/4.3

A tentação óbvia seria generalizar `MigrationQueueView`/`WeeklyReviewQueueView`/`MonthlyReviewQueueView` in-place (trocar `=` por `<` nos filtros existentes) e reaproveitar os 3 banners já existentes. Essa story rejeita esse caminho por dois motivos: (1) o texto fixo dos banners da 4.2/4.3 ("tarefas pendentes **de ontem**", "Semana anterior tem N...") ficaria **errado** assim que a fila passasse a incluir períodos mais antigos — corrigir o texto exigiria reabrir E2E já validados da 4.2/4.3 sem necessidade; (2) a AC #1 exige que **um único Fluxo de Migração** apresente as tarefas na ordem **mês → semana → dia** quando o catch-up abrange vários níveis — isso não é algo que 3 banners independentes (que o usuário abre na ordem que quiser, decisão explícita da 4.3) conseguem garantir. A solução adotada mantém os 3 endpoints/banners da 4.2/4.3 **intocados**, cobrindo exatamente "o período imediatamente anterior", e introduz `CatchUpQueueView`/`CatchUpBanner`/`CatchUpFlow` cobrindo exclusivamente o que é **mais antigo** que isso — sem sobreposição de tarefas entre os dois mecanismos, sem retrabalho no que já está em produção. Se um dia os dois forem unificados numa única superfície, é um refactor isolado de apresentação, não uma mudança de contrato.

### Por que `onExhausted`, não reescrever `MigrationFlow`

`MigrationFlow` (4.2) já resolve exatamente o problema de "avançar pela fila, capturar snapshot na abertura, não reagir a mudanças da query enquanto aberto, tratar Esc como pausa retomável" — o Catch-Up precisa da mesma máquina, só que **encadeada** três vezes (mês → semana → dia) em vez de uma. Reescrever `MigrationFlow` para aceitar múltiplas sub-filas internamente misturaria duas responsabilidades (decisão-por-tarefa vs. orquestração-entre-níveis) num componente que hoje é usado standalone por 3 banners diferentes. A prop `onExhausted` é a menor mudança possível: sinaliza "a fila local acabou" sem forçar `MigrationFlow` a saber que existe um "próximo nível" — quem decide o que vem depois é o `CatchUpFlow` (Task 7), que é o único lugar que conhece a ordem mês→semana→dia. `MigrationBanner`/`WeeklyReviewBanner`/`MonthlyReviewBanner` continuam chamando `MigrationFlow` exatamente como hoje, sem essa prop — zero risco de regressão nos 3 fluxos já em produção.

### Um Dialog contínuo, não três banners separados

A AC #1 fala em "o **mesmo** Fluxo de Migração" (singular) apresentando as tarefas na ordem hierárquica — isso é uma experiência de reconciliação **contínua**, coerente com a filosofia "uma ausência é UM evento de reencontro, não N migrações" que já motivou toda a AD-09. Por isso `CatchUpFlow` mantém um único `open` controlado pelo `CatchUpBanner` e troca de estágio internamente (via `onExhausted` + `key={stage}` para remount limpo) sem nunca fechar e reabrir o `Dialog` do ponto de vista do usuário — ele só vê o Dialog fechar quando **todos** os estágios com tarefas foram esgotados, ou quando aperta Esc (que pausa o Catch-Up inteiro, não um estágio isolado).

### AC #2 é satisfeita por escopo, não por código novo

"Esses dias permanecem como lacunas honestas... nunca 0% fabricado" e "catch-up cobre somente tarefas" não exigem nenhuma implementação nesta story: `CatchUpQueueView` só lê `Task`/`Log`/`WeeklyLog`/`MonthlyLog` via `.filter()` (nunca `get_or_create_*`, igual às 3 views irmãs) e não tem nenhum caminho de código que toque hábitos/saúde/medicamentos — essas entidades (`habit_day_entries`, `medication_day_entries`, AD-06/AD-07) **ainda não existem no schema** (Épicos 6–8, não implementados). A garantia "preencher hábitos/saúde usa o caminho normal de navegar até o dia" é, portanto, verdadeira por ausência de qualquer atalho neste código — não há nada a testar além do que a Task 2 já cobre (nenhum Log/WeeklyLog/MonthlyLog é criado pela query).

### Reaproveitamento obrigatório — não reinventar

Nenhum serviço novo: `migrate_task`/`_migrate_subtree` (4.2) permanece sem alteração de assinatura — o destino `"week"` (4.3), `"today"`/`"month"`/`"future"`/`"cancel"` (4.2) já cobrem todos os botões que `MigrationCard` oferece em cada `flowType`, incluindo dentro do Catch-Up. `today_for`/`week_start_of` (`core/calendar.py`) reaproveitados nos mesmos cálculos de fronteira já usados nas 3 views existentes — só o operador de comparação muda (`=` → `<`). `MigrationCard`/`MigrationFlow` (flowType `daily`/`weekly`/`monthly`, já com os 3 conjuntos de botões corretos desde a 4.3) reaproveitados sem alteração de anatomia — só a prop nova `onExhausted`, aditiva.

### Previous Story Intelligence (4.3 — done)

- Stack: Django 5.2 + DRF + `uv`; Node 22 + Vite + React 19 + MUI 6.1 + TanStack Query 5.59. Sem dependência nova.
- `MigrationCard`/`MigrationFlow` já suportam `flowType: 'daily' | 'weekly' | 'monthly'` desde a 4.3 — reaproveitados tal como estão (Task 6.1/6.2), só ganham a prop `onExhausted` (Task 6).
- `key={currentTask.id}` dentro de `MigrationCard`/`MigrationFlow` (achado do review da 4.2) segue em produção — **não remover**. Esta story adiciona um segundo guardrail de `key` análogo (`key={stage}` em `CatchUpFlow`, Task 7.1) pelo mesmo motivo (evitar vazamento de estado interno entre remontagens).
- Invalidação por prefixo (`['bujo', X]`) é o padrão desde 4.1 — a nova chave `catchUpQueue` segue exatamente o mesmo molde.
- `jest-axe` só pega violações reais contra o componente **de verdade**, nunca mockado (lição repetida em 3.3/4.1/4.2/4.3) — aplicar em `CatchUpBanner.test.tsx`.
- Mocks do barrel `features/bujo` usados em `RouteAnnouncer.test.tsx`/`router.test.tsx` quebram silenciosamente quando um novo componente exportado do barrel não está no mock (achado da 4.3, corrigido ali) — Task 10.1 já antecipa isso para `CatchUpBanner`.
- **File List por último** (retro Epic 3 §8-2): rodar `git status --short`/`git diff --stat` **depois** da verificação manual e reconciliar — guardrail ativo em `_bmad/custom/bmad-dev-story.toml`.
- **Contagem de testes sempre real, nunca de memória** (retro Epic 3 §1) — rodar o comando de verdade antes de escrever Completion Notes/Debug Log.

### Git Intelligence

- Branch `main`; HEAD em `466bcee` (Story 4.3 mergeada — revisão semanal/mensal + pull do Future Log). Convenção de commit: `feat(story-4.4): <descrição em pt-BR>`.
- Nenhuma mudança de schema nesta story — todos os campos usados (`log`, `weekly_log`, `monthly_log`, `status`, `parent_task`, `migrated_to_task`, `migration_count`) já existem desde a 3.1/4.1/4.3. Não é necessária nenhuma migration nova.

### Contexto não-bloqueante (ações da retro Epic 3 / Epic 4)

- **Deploy (AR-21) concluído** (2026-07-12). **AR-22 (observabilidade)** segue pendente, sem dono/data — **não bloqueia** esta story.
- Story 4.5 (Templates de tarefas recorrentes, próxima) não depende de nada desta story — templates são uma entidade nova (`recurring_task_templates`), sem interseção com o motor de migração/catch-up.
- Story 4.6 (Fechamento de ciclos e Arquivo) é quem introduz o indicador "Fechada"/superfície Arquivo — o Catch-Up desta story não precisa (nem deve) tocar em fechamento de ciclo; migrar/adiar/cancelar via Catch-Up já deixa o log de origem no mesmo caminho de fechamento estabelecido pela 4.3 (predicado raiz-only).

### Project Structure Notes

- Backend: nenhum arquivo novo de serviço nem migration. `serializers.py`/`views.py`/`urls.py` estendidos, não recriados (padrão view fina de todas as stories do épico). `CatchUpQueueView` é a única view nova.
- Frontend: `features/bujo/components/` ganha `CatchUpBanner.tsx`, `CatchUpFlow.tsx` (+ testes) — novos arquivos. `MigrationFlow.tsx` estendido com a prop `onExhausted`, sem novo arquivo. `MigrationCard.tsx` **sem alteração** (já suporta os 3 `flowType` desde a 4.3). `api.ts`/`keys.ts`/`types.ts`/`index.ts` estendidos. `pages/daily/DailyPage.tsx` ganha uma linha de composição.
- Fronteiras (§7.2): `features/bujo` não importa outra feature; `pages/daily` compõe a feature (já fazia isso). Sem violação de `import-linter` (mesma app `bujo` no backend).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.4 (linhas 690-706); §Epic 4 (linhas 622-624 — "histórias estritamente ordenadas")]
- [Source: _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md#FR-1.7 (generalização do fluxo de migração)]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-04 item 5 (linha 205 — "sem automação de migração... reconciliação após dias pulados é ato deliberado... uma ausência é UM evento de reencontro, não N migrações"), AD-09 (linhas 536-568 — resolve T9: Catch-Up = fluxo generalizado; detecção por query sem cron; gatilhos por condição; ordem hierárquica mês→semana→dia (item 4); migration_count por decisão (item 5); dias pulados = lacunas honestas (item 6); catch-up só de tarefas (item 7); horizonte Opção A — apresenta tudo (item 8)), AD-02 (linhas 124-145 — matriz ALLOWED), AD-03 (linhas 149-185 — linhagem), §6.2 (linhas 857-874 — camada de serviço/testes por app), §6.3 (linhas 876-885 — casing camelCase na borda), §6.7 (linhas 921-929 — isolamento multi-tenant fail-closed), §6.8 (linhas 931-939 — "catch-up/log órfão: detecção por query, gatilho on-read/on-login, reusa o mesmo método de service da semeadura")]
- [Source: backend/bujo/models.py — `Task`/`Log`/`WeeklyLog`/`MonthlyLog` (campos já existentes, sem alteração de schema); backend/bujo/services/migration.py (`migrate_task`/`_migrate_subtree`, reaproveitados sem alteração); backend/core/calendar.py (`today_for`/`week_start_of`, reusar, nunca `date.today()`)]
- [Source: backend/bujo/{views,serializers,urls}.py (padrão view fina/serializer a estender — `MigrationQueueView`/`WeeklyReviewQueueView`/`MonthlyReviewQueueView` são o molde direto de `CatchUpQueueView`); backend/bujo/tests/{factories,test_services,test_views}.py (padrões de teste e factories `LogFactory`/`WeeklyLogFactory`/`MonthlyLogFactory`/`TaskFactory` a seguir)]
- [Source: frontend/src/api/keys.ts (padrão de query key + invalidação por prefixo); frontend/src/features/bujo/{api,types,index}.ts; frontend/src/features/bujo/components/{MigrationBanner,WeeklyReviewBanner,MigrationCard,MigrationFlow}.tsx (moldes a reaproveitar/estender — `MigrationCard`/`MigrationFlow` já suportam os 3 `flowType` desde a 4.3); frontend/src/pages/daily/DailyPage.tsx (ponto de integração dos banners)]
- [Source: _bmad-output/implementation-artifacts/4-3-revisao-semanal-mensal-e-pull-automatico-do-future-log.md#Dev Notes (Migrated vs. Postponed por destino, "Anatomia do card por contexto" — os 3 flowType já definidos, "Reaproveitamento obrigatório"), #Senior Developer Review (achado do mock do barrel em RouteAnnouncer/router tests — antecipado na Task 10.1), #Contexto não-bloqueante ("Story 4.4 generaliza a fonte da fila de migração para 'qualquer log com data < hoje' — reaproveita migrate_task e o mesmo MigrationCard/MigrationFlow desta e da 4.2, mudando só o caller")]
- [Source: _bmad-output/implementation-artifacts/4-2-migracao-diaria-com-migration-card-e-linhagem.md#Senior Developer Review (achado do `key={currentTask.id}` — não remover; mesmo padrão replicado em `CatchUpFlow` com `key={stage}`)]
- [Source: _bmad-output/implementation-artifacts/epic-3-retro-2026-07-08.md §1/§8 (guardrails "contagem real de testes", "File List por último" — codificados em _bmad/custom/bmad-dev-story.toml)]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- Bug encontrado no pseudocódigo da própria story (Task 6.1): `onExhausted?.() ?? onClose()` chamaria **as duas** funções sempre que `onExhausted` fosse fornecido — como uma arrow function `() => void` sem `return` explícito sempre avalia para `undefined`, o operador `??` cai no `onClose()` de qualquer forma. Confirmado com um repro Node isolado antes de corrigir. Implementação final seleciona a função primeiro (`const onQueueExhausted = onExhausted ?? onClose; onQueueExhausted()`) em vez de encadear os retornos das chamadas.
- `Task.objects.get(title=...)` no helper de verificação E2E (`queryMigrationCount`) inicialmente levantava `MultipleObjectsReturned` — a tarefa original (agora `status="migrated"`) e a cópia recriada no destino compartilham o mesmo `title`. Corrigido filtrando `.exclude(status="migrated")`.
- `manage.py shell -c` imprime um banner ("N objects imported automatically...") em stdout antes de rodar o script passado — `queryMigrationCount` inicialmente fazia `Number(output.trim())` direto, resultando em `NaN`. Corrigido pegando só a última linha não-vazia da saída.
- E2E (`catch-up.spec.ts`) mostrou flakiness em execuções isoladas subsequentes às duas primeiras (limpas): falhas no cold-start da conexão Neon ao subir um `manage.py runserver`/`vite dev` totalmente novos por invocação do Playwright — mesmo padrão observado em specs pré-existentes não tocados por esta story (`task-reorder.spec.ts` da 3.4, `weekly-monthly-review.spec.ts` da 4.3) quando rodados em sequência/paralelo logo após uma bateria pesada de outros testes na mesma sessão. Não é uma regressão desta story: as duas primeiras execuções do spec, feitas a frio e isoladas, passaram de ponta a ponta sem flakiness, com todos os `POST /migrate/` retornando 200 e a contagem `migration_count == 1` confirmada via ORM.

### Completion Notes List

- `CatchUpQueueView` implementada como view nova e aditiva (não altera `MigrationQueueView`/`WeeklyReviewQueueView`/`MonthlyReviewQueueView`), cobrindo só o que é mais antigo que as 3 janelas já existentes, sem materialização (só `.filter()`).
- `migration_count` incrementa em 1 por decisão, comprovado por teste de serviço migrando uma tarefa de um `Log` 10 dias no passado.
- `MigrationFlow` ganhou a prop opcional `onExhausted` (aditiva — os 3 banners existentes não a passam, comportamento inalterado). `CatchUpFlow` novo orquestra mês → semana → dia num único `Dialog` contínuo via essa prop + `key={stage}` para remount limpo entre estágios.
- `CatchUpBanner` integrado à `DailyPage` abaixo dos outros 3 banners; mocks de barrel em `RouteAnnouncer.test.tsx`/`router.test.tsx` atualizados preventivamente (mesmo achado da 4.3).
- Contrato de API regenerado (`schema.yaml` + `types.gen.ts`) — diff só aditivo (endpoint `CatchUpQueue` novo), blocos `security` dos endpoints existentes intactos (guardrail retro Epic 3 §3, conferido manualmente no diff).
- Contagens reais observadas nesta execução (guardrail retro Epic 3 §1):
  - Backend: `256 passed` (`uv run pytest`, 15:58 min — Neon dev branch remoto); `uv run ruff check .` sem achados; `uv run lint-imports` — 1 contrato mantido, 0 quebrado; `uv run python manage.py check` — 0 problemas.
  - Frontend: `npm run typecheck` sem erros; `npm run lint` sem achados; `npm run build` concluído (aviso pré-existente de chunk size, não relacionado a esta story); `npm run test` → `337 passed` em 38 arquivos.
  - E2E (`frontend/e2e/catch-up.spec.ts`, novo): passou de ponta a ponta em duas execuções isoladas a frio, confirmando contagem do banner (3), ordem mês→semana→dia num único Dialog, ausência de sobreposição com os outros 3 banners, e `migration_count == 1` na tarefa migrada de 10 dias atrás (não 10). Ver Debug Log References sobre flakiness observada em execuções subsequentes sob carga da sessão (ambiental, não regressão).
- AC #2 (lacunas honestas / catch-up só de tarefas) satisfeita por escopo, sem código novo — confirmado por `CatchUpQueueView` não ter nenhum `get_or_create_*` e por testes que verificam `Log`/`WeeklyLog`/`MonthlyLog` count antes/depois da chamada.

### File List

- backend/bujo/serializers.py
- backend/bujo/urls.py
- backend/bujo/views.py
- backend/bujo/tests/test_services.py
- backend/bujo/tests/test_views.py
- schema.yaml
- frontend/src/api/keys.ts
- frontend/src/api/types.gen.ts
- frontend/src/app/layout/RouteAnnouncer.test.tsx
- frontend/src/app/router.test.tsx
- frontend/src/features/bujo/api.ts
- frontend/src/features/bujo/api.test.tsx
- frontend/src/features/bujo/index.ts
- frontend/src/features/bujo/types.ts
- frontend/src/features/bujo/components/MigrationFlow.tsx
- frontend/src/features/bujo/components/MigrationFlow.test.tsx
- frontend/src/features/bujo/components/CatchUpFlow.tsx
- frontend/src/features/bujo/components/CatchUpFlow.test.tsx
- frontend/src/features/bujo/components/CatchUpBanner.tsx
- frontend/src/features/bujo/components/CatchUpBanner.test.tsx
- frontend/src/pages/daily/DailyPage.tsx
- frontend/src/pages/daily/DailyPage.test.tsx
- frontend/e2e/seedCatchUpScenario.ts
- frontend/e2e/catch-up.spec.ts

## Senior Developer Review (AI)

**Reviewer:** HugoMMBrito (story-automator, revisão automática) em 2026-07-13

**Verificação independente:** claims de contagem/qualidade não aceitas de memória — reexecutadas nesta sessão: `uv run pytest bujo/tests/test_views.py -k catch_up` → **6 passed**, `uv run pytest bujo/tests/test_services.py -k catch_up` → **1 passed**, `uv run ruff check .` → limpo, `uv run lint-imports` → `1 kept, 0 broken`; `npx vitest run` nos 7 arquivos de teste tocados (`CatchUpFlow`, `CatchUpBanner`, `MigrationFlow`, `api`, `DailyPage`, `router`, `RouteAnnouncer`) → **86 passed**, `npm run typecheck` → limpo, `npm run lint` → limpo. Diff de `schema.yaml` conferido linha a linha: só `CatchUpQueue`/`GET /api/bujo/catch-up/queue/` novos, blocos `security` dos endpoints existentes intactos. Campos do model (`Task.monthly_log`/`weekly_log`/`log`) conferidos contra `backend/bujo/models.py` — batem com os filtros de `CatchUpQueueView`. `git status`/`git diff --name-only` cruzados contra o File List: nenhuma discrepância (arquivos de tracking do `_bmad-output/` fora do escopo de revisão, por instrução do workflow).

### Findings

Nenhum achado HIGH/CRITICAL/MEDIUM/LOW após revisão adversarial completa: as 2 ACs estão implementadas e comprovadas por teste (view: isolamento das 3 janelas + não-materialização + escopo por tenant; serviço: `migration_count == 1` por decisão, não por dias pulados); nenhuma task marcada `[x]` ficou sem evidência real de implementação; nenhuma discrepância entre git e File List; o bug de `onExhausted?.() ?? onClose()` (dupla-chamada por `??` nunca curto-circuitar em arrow function `void`) foi corretamente identificado e corrigido pelo próprio dev durante a implementação (Debug Log References), com teste de regressão cobrindo os 3 casos (com/sem `onExhausted`, Esc nunca aciona `onExhausted`); `key={stage}` em `CatchUpFlow` replica corretamente o guardrail `key={currentTask.id}` da 4.2 (achado de review anterior, não removido); os 3 endpoints/banners da 4.2/4.3 permanecem intocados (regressão de sobreposição coberta por teste dedicado); testes são asserções reais contra comportamento observável (texto renderizado, chamadas de mutação, contagem HTTP), não placeholders.

**Outcome:** Approved — 0 issues CRITICAL/HIGH remanescentes.
