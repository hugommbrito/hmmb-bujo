---
baseline_commit: 61d0806
---

# Story 11.5: CRUD de tarefas em Esta Semana / Este Mês

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero criar, editar e remover tarefas direto nas telas Esta Semana e Este Mês,
Para que eu planeje semana/mês sem depender do Daily Log ou de um fluxo de migração (itens #7, #8 de `docs/futureIdeas.md`).

## Acceptance Criteria

### AC1 — Criar tarefa em Esta Semana (com dia opcional) e Este Mês

- **Dado que** a tela Esta Semana,
- **Quando** adiciono uma tarefa,
- **Então** posso atribuí-la a um dia específico da semana (ou deixá-la sem dia);
- **E** a tela Este Mês permite adicionar ao mês (já implementado desde a Story 4.1 — `useCreateMonthlyTaskMutation`; esta AC cobre o gap real: Esta Semana **não tem** formulário de criação hoje).

### AC2 — Editar campos de uma tarefa em Semana/Mês, igual ao Daily Log

- **Dado que** uma tarefa em Semana/Mês,
- **Quando** a edito,
- **Então** posso alterar seus campos (título, descrição, eisenhower, categoria), igual ao Daily Log — reusando `TaskDetailPanel` sem reinventar um segundo formulário de edição.

### AC3 — Remover tarefa: hard delete se pending sem linhagem, senão cancelar

- **Dado que** uma tarefa `pending` sem linhagem de migração (`migrationCount === 0` e `migratedToTask === null`),
- **Quando** a removo,
- **Então** posso excluí-la permanentemente (hard delete);
- **Dado que** uma tarefa com histórico/linhagem (`migrationCount > 0` ou `migratedToTask` preenchido) — **ou** que não está `pending`,
- **Quando** a removo,
- **Então** ela só pode ser cancelada (`status=cancelled`), preservando a semântica BuJo (o registro não desaparece — vira um item riscado, igual a qualquer outra tarefa cancelada já renderizada por `TaskRow`).

### AC4 — Ciclos fechados (Arquivo) continuam somente-leitura

- **Dado que** ciclos já fechados (Arquivo),
- **Então** continuam somente-leitura — sem criar, editar ou remover tarefas, **tanto na UI quanto no backend** (achado desta story: hoje o "somente-leitura" do Arquivo é garantido *só* pela UI via `isArchiveView`, um flag de rota, não pelo campo `closed` retornado pela API — nenhuma view/serviço do backend rejeita mutação num container fechado. Esta AC exige fechar os dois gaps: (a) o backend passa a recusar mutação (create/update/delete) num container `weekly_log`/`monthly_log` fechado; (b) o frontend do período **corrente** (rota sem parâmetro, `!isArchiveView`) passa a esconder os formulários de criação/edição/remoção quando `closed: true` também — hoje só a rota de Arquivo esconde, e um período corrente que fecha (todas as tarefas dispostas) durante a sessão continua mostrando os formulários).

## Tasks / Subtasks

> **Escopo real:** esta story tem 3 frentes, todas necessárias para as 4 ACs — nenhuma é opcional. (1) Backend: endpoint de criação para Weekly (não existe hoje — só Monthly tem `POST`), endpoint de remoção (não existe **nenhum** `DELETE` em todo o backend hoje) e um guardrail de "ciclo fechado" na camada de serviço (não existe hoje — a proteção atual é só de UI). (2) Frontend: formulário de criação novo no `WeeklyPage` (hoje só tem placement de recorrentes, nenhum form de tarefa) + correção do gate `MonthlyPage` (`!isArchiveView` → `!isArchiveView && !closed`) + wiring de `onOpenDetail` em ambas as páginas (`TaskRow` é usado 100% read-only hoje nelas) + botão de excluir/cancelar em `TaskDetailPanel` (componente compartilhado com o Daily Log — ver Dev Notes "Reuso de `TaskDetailPanel`"). (3) Testes nas 3 camadas (backend service/view, frontend componente/página, e2e).

### Backend

- [x] **Task 1: `ClosedCycleReadOnly` — nova exceção de domínio** (AC: #4)
  - [x] 1.1 Em `backend/core/exceptions.py`, adicionar (perto de `WrongPlacementContainer`, linha ~59):
    ```python
    class ClosedCycleReadOnly(DomainError):
        """Tentativa de mutar um weekly_log/monthly_log já fechado (is_container_closed)."""
    ```
    **Nenhuma mudança no handler necessária** — `custom_exception_handler` (linha 103) já mapeia qualquer `DomainError` (exceto `TenantScopeViolation`) para 409 automaticamente, mesmo padrão de `InvalidTransition`/`WrongPlacementContainer`.

- [x] **Task 2: Guardrail de ciclo fechado em `create_task`/`update_task` + novo `delete_task`** (AC: #3, #4)
  - [x] 2.1 Em `backend/bujo/services/tasks.py`, importar `is_container_closed` de `bujo.services.archive` e `ClosedCycleReadOnly` de `core.exceptions` (sem risco de import circular: `archive.py` só importa de `bujo.models`, não de `services.tasks`).
  - [x] 2.2 Em `create_task` (linha 12), antes do `Task.objects.create(...)`: se `weekly_log is not None and is_container_closed(weekly_log)` ou `monthly_log is not None and is_container_closed(monthly_log)` → `raise ClosedCycleReadOnly("Ciclo fechado — somente leitura.")`. **Daily (`log`) nunca entra nesse check** — só `WeeklyLog`/`MonthlyLog` têm conceito de fechamento (`services/archive.py`, `UNDISPOSED`). Isso protege **todo** call-site de `create_task` (`TaskCreateView`, `SubtaskCreateView`, `MonthlyLogView.post`, o novo `WeeklyLogView.post` desta story, `_migrate_subtree`, `place_template`) com uma única checagem — não duplicar em cada view.
  - [x] 2.3 Em `update_task` (linha 52): buscar `task` primeiro (já faz isso), então se `task.weekly_log_id is not None and is_container_closed(task.weekly_log)` ou `task.monthly_log_id is not None and is_container_closed(task.monthly_log)` → `raise ClosedCycleReadOnly(...)`, **antes** do loop de `setattr`. Subtarefas herdam o container do pai (AD-08 item 12) — checar `task.weekly_log_id`/`task.monthly_log_id` direto na instância cobre qualquer profundidade sem lógica extra.
  - [x] 2.4 Novo `delete_task(*, user, task_id) -> Task | None` em `backend/bujo/services/tasks.py`, mesmo estilo de `update_task`:
    ```python
    @transaction.atomic
    def delete_task(*, user, task_id) -> Task | None:
        task = Task.objects.get(id=task_id)  # objects = auto-escopado por tenant
        if task.weekly_log_id is not None and is_container_closed(task.weekly_log):
            raise ClosedCycleReadOnly("Ciclo fechado — somente leitura.")
        if task.monthly_log_id is not None and is_container_closed(task.monthly_log):
            raise ClosedCycleReadOnly("Ciclo fechado — somente leitura.")
        has_lineage = task.migration_count > 0 or task.migrated_to_task_id is not None
        if task.status == Task.Status.PENDING and not has_lineage:
            task.delete()
            return None
        return transition_task(user=user, task_id=task_id, to_status=Task.Status.CANCELLED)
    ```
    **Regra literal da AC3:** hard delete **só** quando `status == pending` **e** sem linhagem; qualquer outro caso (não-pending OU com linhagem) tenta cancelar via `transition_task` — que já valida a matriz `ALLOWED` (`services/state_machine.py:18-43`). Uma tarefa já `cancelled`/`migrated`/`postponed` (estado terminal) removida gera `InvalidTransition` (409) — comportamento correto por composição, não precisa de checagem extra aqui: a UI não deve oferecer o botão nesses estados (Task 6.3), mas o backend recusa mesmo assim se chamado direto (defesa em profundidade, AD-12 spirit). **Reaproveita `transition_task` já existente** (mesmo caminho que `migrate_task(destination="cancel")` usa, `services/migration.py:73-74`) — não duplicar a transição.

- [x] **Task 3: `WeeklyTaskCreateSerializer` + `WeeklyLogView.post`** (AC: #1)
  - [x] 3.1 Em `backend/bujo/serializers.py`, novo serializer espelhando `MonthlyTaskCreateSerializer` (linha 170-196) — mesmos campos extras (`description`/`eisenhower`/`category`) por simetria de contrato entre os dois endpoints irmãos, mesmo que o form do Task 6 desta story só envie `title`+`scheduledDate`:
    ```python
    class WeeklyTaskCreateSerializer(serializers.Serializer):
        week_start = serializers.DateField()
        title = serializers.CharField(max_length=500)
        scheduled_date = serializers.DateField(required=False, allow_null=True)
        description = serializers.CharField(required=False, allow_null=True, allow_blank=True)
        eisenhower = serializers.ChoiceField(
            choices=Task.Eisenhower.choices, required=False, allow_null=True
        )
        category = serializers.ChoiceField(
            choices=Task.Category.choices, required=False, allow_null=True
        )

        def validate(self, attrs):
            week_start = attrs["week_start"]
            if week_start.isoweekday() != 1:
                raise serializers.ValidationError(
                    {"week_start": "Deve ser uma segunda-feira."}
                )
            scheduled_date = attrs.get("scheduled_date")
            if scheduled_date is not None and not (
                week_start <= scheduled_date <= week_start + timedelta(days=6)
            ):
                raise serializers.ValidationError(
                    {"scheduled_date": "A data deve pertencer à semana de week_start."}
                )
            return attrs
    ```
    `timedelta` já importado em `serializers.py`? **Não** — importar de `datetime` no topo do arquivo (mesmo padrão de `views.py:7`). Mensagens de erro e estrutura de `validate` espelham `MonthlyTaskCreateSerializer` — mesma convenção, não inventar um estilo novo.
  - [x] 3.2 Em `backend/bujo/views.py`, `WeeklyLogView` (linha 224): adicionar `post`, espelhando `MonthlyLogView.post` (linha 282-299):
    ```python
    @extend_schema(request=WeeklyTaskCreateSerializer, responses=TaskSerializer)
    def post(self, request):
        body = WeeklyTaskCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        validated = body.validated_data
        weekly_log = get_or_create_weekly_log(user=request.user, week_start=validated["week_start"])
        task = create_task(
            user=request.user,
            weekly_log=weekly_log,
            scheduled_date=validated.get("scheduled_date"),
            title=validated["title"],
            description=validated.get("description"),
            eisenhower=validated.get("eisenhower"),
            category=validated.get("category"),
        )
        return Response(TaskSerializer(task).data, status=status.HTTP_201_CREATED)
    ```
    Adicionar `WeeklyTaskCreateSerializer` ao import de `bujo.serializers` (linha 17-39, ordem alfabética). **Nenhuma mudança em `urls.py`** — `POST /api/bujo/logs/weekly/` já resolve para `WeeklyLogView.as_view()` (linha 27 de `urls.py`); só faltava o método `post`.
  - [x] 3.3 **`create_task` já recusa container fechado (Task 2.2)** — se `get_or_create_weekly_log` retornar um weekly_log já fechado (ex.: usuário reabriu uma aba antiga com JS stale, ou chamou a API direto), o `create_task` levanta `ClosedCycleReadOnly` antes de criar. Não duplicar a checagem na view.

- [x] **Task 4: `TaskDetailView.delete`** (AC: #3, #4)
  - [x] 4.1 Em `backend/bujo/views.py`, `TaskDetailView` (linha 71): adicionar método `delete`:
    ```python
    @extend_schema(responses={204: None, 200: TaskSerializer})
    def delete(self, request, pk):
        try:
            result = delete_task(user=request.user, task_id=pk)
        except Task.DoesNotExist:
            raise NotFound() from None
        if result is None:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(TaskSerializer(result).data, status=status.HTTP_200_OK)
    ```
    Importar `delete_task` no import existente de `bujo.services.tasks` (linha 49: `from bujo.services.tasks import create_task, delete_task, reorder_task, update_task`). **Sem mudança em `urls.py`** — `DELETE /api/bujo/tasks/<uuid:pk>/` já resolve para `TaskDetailView.as_view()` (linha 39 de `urls.py`); Django despacha por método HTTP automaticamente numa `APIView`.
  - [x] 4.2 **204 (hard delete) vs 200+body (cancelado)** é a distinção que o frontend usa para decidir "remover da lista" vs "atualizar status in-place" (Task 8) — não colapsar os dois em um único formato de resposta.

- [x] **Task 5: Testes de backend** (AC: #1, #3, #4)
  - [x] 5.1 `test_services.py` — `delete_task`: (a) pending sem linhagem → retorna `None`, `Task.objects.filter(id=...).exists()` é `False` (hard delete real); (b) pending com `migration_count=1` → retorna `Task` com `status=cancelled`, registro **ainda existe**; (c) `started`/`completed` sem linhagem → cancela (não hard-delete, mesmo sem lineage — regra literal da AC3, "pending" é condição necessária pro hard delete); (d) task já `cancelled`/`migrated`/`postponed` → `InvalidTransition` (via `pytest.raises`); (e) `delete_task` num weekly_log fechado (todas as outras tarefas do container `completed`) → `ClosedCycleReadOnly`; idem monthly_log; (f) `..._escopado_por_tenant`: `other_user` não consegue deletar task do `user` (`Task.DoesNotExist` via manager auto-escopado — mesmo padrão de `test_update_task_escopado_por_tenant`, linha 145).
  - [x] 5.2 `test_services.py` — `create_task`/`update_task` com container fechado: um teste por função confirmando `ClosedCycleReadOnly` quando `weekly_log`/`monthly_log` já fechado (usar `is_container_closed` diretamente pra montar o cenário: criar `TaskFactory(weekly_log=wl, status=Task.Status.COMPLETED)` até o container fechar, depois tentar `create_task`/`update_task` nele).
  - [x] 5.3 `test_views.py` — `POST /api/bujo/logs/weekly/`: cria tarefa sem `scheduled_date` (fica em `unscheduled`); cria com `scheduled_date` dentro da semana (aparece no dia certo); `scheduled_date` fora da semana → 400; `week_start` não é segunda → 400; `..._escopado_por_tenant` (mesmo padrão de `test_post_monthly_log_*`, linha 599-627).
  - [x] 5.4 `test_views.py` — `DELETE /api/bujo/tasks/<pk>/`: 204 pra pending-sem-linhagem (corpo vazio); 200 + `status: 'cancelled'` no corpo pra caso com linhagem; 404 pra task de `other_user` (mesmo padrão de `test_patch_task_detail_de_outro_tenant_retorna_404`, linha 235); 409 pra task em ciclo fechado (`fields` ausente, só `detail` — confirma o formato do `custom_exception_handler` pra `DomainError`, igual ao formato já usado por `InvalidTransition` noutros testes).
  - [x] 5.5 `test_views.py` — regressão do guardrail em endpoints **já existentes**: `POST /api/bujo/tasks/<pk>/subtasks/` e `POST /api/bujo/logs/monthly/` num container fechado → 409 (a Task 2.2 endurece `create_task` globalmente; um teste por call-site basta, não a suíte inteira).
  - [x] 5.6 `ruff check . && lint-imports && manage.py check` verdes ao fim (guardrail do pós-11.3, ver Previous Story Intelligence).

### Frontend

- [x] **Task 6: Camada de dados — `useCreateWeeklyTaskMutation` e `useDeleteTaskMutation`** (AC: #1, #3)
  - [x] 6.1 Em `frontend/src/features/bujo/api.ts`, novo hook espelhando `useCreateMonthlyTaskMutation` (linha 236-248):
    ```ts
    interface CreateWeeklyTaskVariables {
      weekStart: string
      title: string
      scheduledDate?: string | null
      description?: string | null
      eisenhower?: TaskEisenhower | null
      category?: TaskCategory | null
    }

    async function createWeeklyTask(fields: CreateWeeklyTaskVariables): Promise<Task> {
      const response = await client.post<Task>('/api/bujo/logs/weekly/', fields)
      return response.data
    }

    export function useCreateWeeklyTaskMutation() {
      const queryClient = useQueryClient()
      return useMutation({
        mutationFn: createWeeklyTask,
        onSuccess: (_data, variables) => {
          queryClient.invalidateQueries({ queryKey: keys.bujo.weeklyLog(variables.weekStart) })
          queryClient.invalidateQueries({ queryKey: ['bujo', 'taskDensity'] })
        },
      })
    }
    ```
    `useMutation` simples (não `useOptimisticMutation`) — mesmo padrão de `useCreateMonthlyTaskMutation`, que também não é otimista (o form limpa e espera o `invalidateQueries` refazer o fetch; sem necessidade de otimismo numa tela de planejamento, AD-14: NFR-2 de latência só cobre execução diária).
  - [x] 6.2 Novo `useDeleteTaskMutation`, **não otimista** (a resposta muda de formato — 204 vs 200 — então o cache precisa do resultado real do servidor antes de decidir remover vs atualizar; otimismo exigiria adivinhar qual dos dois vai acontecer):
    ```ts
    interface DeleteTaskVariables {
      taskId: string
    }

    async function deleteTask({ taskId }: DeleteTaskVariables): Promise<Task | null> {
      const response = await client.delete<Task | null>(`/api/bujo/tasks/${taskId}/`)
      return response.status === 204 ? null : response.data
    }

    export function useDeleteTaskMutation() {
      const queryClient = useQueryClient()
      return useMutation({
        mutationFn: deleteTask,
        onSuccess: () => {
          // Container de origem é desconhecido no call-site genérico (Daily,
          // Weekly ou Monthly) — invalidação por prefixo nas 3 chaves, mesmo
          // padrão de useUpdateTaskMutation (api.ts:151) pra 'monthlyLog'.
          queryClient.invalidateQueries({ queryKey: keys.bujo.todayLog() })
          queryClient.invalidateQueries({ queryKey: ['bujo', 'weeklyLog'] })
          queryClient.invalidateQueries({ queryKey: ['bujo', 'monthlyLog'] })
          queryClient.invalidateQueries({ queryKey: ['bujo', 'taskDensity'] })
        },
      })
    }
    ```
  - [x] 6.3 Exportar os dois novos hooks em `frontend/src/features/bujo/index.ts` (barrel), mesmo padrão dos hooks existentes.

- [x] **Task 7: Formulário de criação no `WeeklyPage`** (AC: #1, #4)
  - [x] 7.1 Em `frontend/src/pages/planner/WeeklyPage.tsx`, adicionar estado local `title`/`selectedDay` (string vazia = "sem dia") e um `<Box component="form">` no mesmo estilo do form de `MonthlyPage.tsx:185-217` (`TextField` título + campo de dia + botão "Adicionar").
  - [x] 7.2 **Seletor de dia:** um MUI `Select` com as 7 opções vindas de `weeklyLog.data.days` (cada `day.date` já é uma data ISO exata da semana carregada — não há ambiguidade de "que semana" como have no `RecurringPlacementDialog`) + uma opção extra `value=""` rotulada "Sem dia definido" (mapeia pra `scheduledDate: undefined`). Rótulo de cada opção: dia da semana abreviado + número (ex. "Seg 01") — reescrever localmente uma função de formatação equivalente a `formatDayChipLabel` (`WeekDaySelector.tsx:14-22`) ou `formatDayHeaderDate` (`DayHeader.tsx:16-26`); **não extrair um util compartilhado agora** — ambas já são duplicações locais aceitas no projeto (mesma decisão registrada na Story 11.4 Dev Notes, "Reaproveitamento obrigatório"), uma terceira cópia de ~8 linhas não paga o custo de um módulo novo ainda.
  - [x] 7.3 `handleSubmit`: `createWeeklyTask.mutate({ weekStart, title: trimmedTitle, scheduledDate: selectedDay || undefined })`, limpa `title`/`selectedDay`, sem `onSuccess` manual — a invalidação da Task 6.1 já refaz o fetch de `useWeeklyLogQuery(routeWeekStart)` (chave `keys.bujo.weeklyLog(weekStart)`, que é exatamente a chave ativa da página quando `!isArchiveView` — diferente do caso `MonthlyPage` que precisa de `.refetch()` manual por causa do sentinel `'current'` vs `monthFirst` explícito, aqui não há esse descompasso porque `weekStart` já vem resolvido do payload `weeklyLog.data.weekStart`).
  - [x] 7.4 **Gate:** form só aparece `{!isArchiveView && !closed && (...)}> — mesmo bloco condicional que already envolve `RecurringPlacementSection`/`RecurringPlacementDialog` (linha 114 atual); estender a condição existente com `&& !closed` em vez de criar um segundo bloco condicional.

- [x] **Task 8: Corrigir gate de `closed` no `MonthlyPage` + reaproveitar em ambas as páginas** (AC: #4)
  - [x] 8.1 Em `frontend/src/pages/planner/MonthlyPage.tsx:183`, trocar `{!isArchiveView && (` por `{!isArchiveView && !closed && (` — hoje o form de criação (`title`+`day`) fica visível mesmo com `closed: true` no período corrente (achado desta story, ver AC4). `closed` já está desestruturado de `monthlyLog.data` (linha 72).
  - [x] 8.2 Confirmar que `WeeklyPage.tsx` (Task 7.4) usa a mesma correção — `closed` já vem de `weeklyLog.data` (linha 35 atual).

- [x] **Task 9: `onOpenDetail` (edição) em `TaskRow` de Semana/Mês + botão excluir/cancelar em `TaskDetailPanel`** (AC: #2, #3, #4)
  - [x] 9.1 Em `WeeklyPage.tsx`/`MonthlyPage.tsx`, adicionar `const [openTaskId, setOpenTaskId] = useState<string | null>(null)` e passar `onOpenDetail={!closed ? setOpenTaskId : undefined}` em **todos** os call-sites de `<TaskRow task={...} />` das duas páginas (múltiplos: dias da semana, "sem dia definido", grupos do mês, "sem dia definido" do mês — usar a mesma prop condicional em cada um). `closed` (e não `isArchiveView`) é a condição certa aqui: mesmo no Arquivo o usuário pode querer *ver* o detalhe (só não editar) — mas como `TaskDetailPanel` não tem hoje um modo "só leitura" author, a decisão mais simples e correta pra esta story é: **Arquivo (`isArchiveView`) também não abre o painel** (`onOpenDetail={!isArchiveView && !closed ? setOpenTaskId : undefined}`) — evita construir um modo read-only no painel só pra esta story quando a AC4 já é satisfeita por simplesmente não oferecer a entrada. Reavaliar como melhoria futura se "ver sem editar" virar um requisito explícito.
  - [x] 9.2 Renderizar `<TaskDetailPanel key={openTaskId ?? 'none'} task={...} isSubtask={...} onClose={() => setOpenTaskId(null)} />` no fim de cada página, mesmo padrão de `DailyPage.tsx:98-103`. `findTaskById` (`frontend/src/features/bujo/taskTree.ts`, já usado por `DailyPage`) resolve a tarefa a partir da árvore local — em `WeeklyPage` a árvore é `[...days.flatMap(d => d.tasks), ...unscheduled]`; em `MonthlyPage` é `tasks` (já achatada por `groupTasksByScheduledDate`, mas a lista original `tasks` da resposta já serve de árvore de busca).
  - [x] 9.3 Em `frontend/src/features/bujo/components/TaskDetailPanel.tsx`, adicionar `useDeleteTaskMutation()` e um botão no rodapé do painel:
    ```tsx
    const deleteTask = useDeleteTaskMutation()
    const hasLineage = (task.migrationCount ?? 0) > 0 || Boolean(task.migratedToTask)
    const willHardDelete = task.status === 'pending' && !hasLineage
    // ...
    <Button
      color="error"
      onClick={() =>
        deleteTask.mutate({ taskId: task.id }, { onSuccess: onClose })
      }
    >
      {willHardDelete ? 'Excluir tarefa' : 'Cancelar tarefa'}
    </Button>
    ```
    **`willHardDelete` é só rótulo de UI** (mesma classe de cálculo client-side "só pra UI" já usada em `currentMonthFirst()`/`currentYear()`, Story 11.4 Dev Notes) — a decisão real (hard delete vs cancelar) é feita no backend (`delete_task`, Task 2.4); se o cálculo client diverge por alguma razão (race condition, estado desatualizado), o backend ainda decide certo, só o rótulo do botão que pode ficar momentaneamente impreciso. `onSuccess: onClose` fecha o painel nos dois casos — depois de um hard delete a tarefa suma da lista (o painel ficaria órfão); depois de cancelar, a tarefa continua visível na lista (riscada, via `TaskRow` que já trata `status === 'cancelled'` com `textDecoration: 'line-through'`, `TaskRow.tsx:200`), mas fechar o painel também é o comportamento esperado de "ação concluída" (mesmo padrão de qualquer outro `updateTask.mutate` no painel, que não fecha o painel — **diferença deliberada**: edições de campo são incrementais e o usuário normalmente segue editando; excluir/cancelar é uma ação terminal, fechar é o feedback natural).
  - [x] 9.4 **`TaskDetailPanel` é compartilhado com o Daily Log** (`DailyPage.tsx:98`) — o botão novo aparece **também** ao editar uma tarefa a partir do Daily Log, não só de Semana/Mês. Isso é aceito conscientemente (é a mesma superfície de edição reaproveitada, não uma segunda implementação) e **não** é scope creep: a AC3 desta story não restringe o mecanismo a Semana/Mês, só o **As a/So that** da story enquadra a motivação nessas duas telas. `DailyPage.test.tsx`/`TaskDetailPanel.test.tsx` (Daily, já existentes) precisam de ajuste (Task 10.5) por causa disso — não é uma regressão, é a consequência esperada do reuso.
  - [x] 9.5 Botão de excluir/cancelar **não aparece pra subtarefas via este painel na v1** — `isSubtask` já existe como prop; usar `{!isSubtask && (<Button .../>)}` do mesmo jeito que `AddTaskRow` de subtarefa já é condicionado (`TaskDetailPanel.tsx:159`). Subtarefas têm profundidade só de 1 nível hoje (AD-08) e remover uma subtarefa individualmente não foi pedido por nenhuma AC desta story — deixar de fora evita inventar uma regra de cascata (o que acontece com subtarefas de uma tarefa-pai excluída?) sem necessidade: como o hard delete só é permitido pra tarefas `pending` **raiz** nesta v1, e o backend não tem CASCADE especial pra isso além do `on_delete=models.CASCADE` já existente em `parent_task` (que apagaria subtarefas junto, comportamento correto e já garantido pelo schema — nenhum código novo necessário se um dia isso for exposto pra subtarefas).

### Testes & Verificação

- [x] **Task 10: Testes de frontend** (AC: #1, #2, #3, #4)
  - [x] 10.1 `WeeklyPage.test.tsx`: novo `describe` pro form de criação — submit com dia selecionado chama `client.post('/api/bujo/logs/weekly/', { weekStart, title, scheduledDate })`; submit sem dia chama com `scheduledDate: undefined`; título vazio não submete (mesmo guard client-side de `AddTaskRow`/`MonthlyPage`); form **não aparece** quando `closed: true` (novo teste, cenário hoje só coberto pro texto "Fechada", não pro form — que nem existe ainda); form não aparece em `isArchiveView`.
  - [x] 10.2 `WeeklyPage.test.tsx`: clicar no título de uma `TaskRow` abre `TaskDetailPanel` (via `onOpenDetail`) — real, não mockado (`jest-axe` já exige isso, lição recorrente 3.3–11.4); painel não abre (sem `onOpenDetail`) quando `isArchiveView` ou `closed`.
  - [x] 10.3 `MonthlyPage.test.tsx`: estender o teste existente de `closed: true` — form de criação também não aparece (hoje o teste só verifica o texto "Fechado", não o form); `onOpenDetail` idem Task 10.2.
  - [x] 10.4 `TaskDetailPanel.test.tsx`: botão mostra "Excluir tarefa" pra task `pending` sem linhagem, "Cancelar tarefa" pra task com `migrationCount > 0` ou `migratedToTask` preenchido, ou não-`pending`; clicar chama `useDeleteTaskMutation().mutate({ taskId })` e, no sucesso, `onClose`; botão ausente quando `isSubtask`.
  - [x] 10.5 `DailyPage.test.tsx`: ajustar (não quebrar) os testes existentes de `TaskDetailPanel` — mockar `useDeleteTaskMutation` no barrel (mesma técnica `importOriginal`) pra não afetar os testes que já cobrem título/descrição/categoria/eisenhower; **não precisa testar o delete a partir do Daily aqui** (já coberto por `TaskDetailPanel.test.tsx`, que é a fonte de verdade pro componente).
  - [x] 10.6 `frontend/src/features/bujo/api.test.tsx`: `useCreateWeeklyTaskMutation` — payload correto, invalidação de `weeklyLog(weekStart)` + `taskDensity`; `useDeleteTaskMutation` — resposta 204 (`response.status === 204`) não quebra o parse (mockar `client.delete` retornando `{ status: 204, data: null }`), resposta 200 com corpo, invalidação das 4 chaves (`todayLog`, `weeklyLog`, `monthlyLog`, `taskDensity`).
  - [x] 10.7 `npm run typecheck && npm run lint && npm run build && npm run test` (Node 22, `--no-file-parallelism` se houver flakiness — lição recorrente 11.2–11.4) verdes.

- [x] **Task 11: Contrato — regeneração esperada** (AC: #1, #3)
  - [x] 11.1 **Diferente da 11.4:** esta story **muda** o contrato — `POST /api/bujo/logs/weekly/` é uma operação nova na view (`WeeklyTaskCreateSerializer` declarado via `@extend_schema(request=...)`) e `DELETE /api/bujo/tasks/{id}/` idem. Rodar `manage.py spectacular --file schema.yaml` e `npx openapi-typescript ../schema.yaml -o src/api/types.gen.ts`, commitar ambos. **Diff esperado**, não um erro — não tratar como achado.

- [x] **Task 12: Verificação manual (Playwright real, branch `e2e`)** (AC: #1, #2, #3, #4)
  - [x] 12.1 Novo `frontend/e2e/weekly-monthly-task-crud.spec.ts` (nome de fluxo, não de story — convenção já usada por `future-log-annual.spec.ts`, `recurring-templates.spec.ts` etc.): criar tarefa em Esta Semana com dia específico → aparece no dia certo; criar sem dia → aparece em "Sem dia definido"; criar em Este Mês (já existia, mas cobrir junto por completude do fluxo); editar título/eisenhower via painel em ambas as telas; excluir tarefa pending sem linhagem → some da lista (backend 204 confirmado via network); tentar excluir tarefa com `migrationCount > 0` (seed via migração real ou fixture) → vira "Cancelada" riscada, continua na lista; período fechado (todas as tarefas do container `completed`/`cancelled`) → formulário de criação e clique-pra-editar somem, mesmo na rota corrente (não só no Arquivo) — precisa de um seed dedicado (`seedClosedCycleScenario.ts`-style, já que não há caminho de UI pra fechar um ciclo além de dispor todas as tarefas manualmente).
  - [x] 12.2 Zero erros de console em todos os passos, mesma asserção final já convencional nos specs anteriores.
  - [x] 12.3 **File List por último** (retro Epic 3 §8-2) — reconciliar contra `git status --short`/`git diff --stat` reais, guardrails em `_bmad/custom/bmad-dev-story.toml`.

## Dev Notes

### O que já existe vs. o que é net-new (não assumir nada pré-construído)

- **Já existe:** criação de tarefa no `MonthlyPage` (`useCreateMonthlyTaskMutation`, `POST /api/bujo/logs/monthly/`), edição de campos via `TaskDetailPanel` (só usado hoje pelo Daily Log), a máquina de estados (`AD-02`), o cálculo de "ciclo fechado" (`is_container_closed`, computado na leitura, nunca armazenado).
- **Net-new (confirmado por busca exaustiva no repo, zero ocorrência prévia):** qualquer endpoint `DELETE`; qualquer enforcement de "ciclo fechado" fora da UI (`isArchiveView`); criação de tarefa em `WeeklyPage` (a tela só tem placement de recorrentes hoje); `onOpenDetail`/edição em `TaskRow` de Weekly **ou** Monthly (as duas usam `TaskRow` 100% read-only — comentário explícito em `TaskRow.tsx:55-59` confirma que isso foi um adiamento deliberado das Stories 4.2/4.3, não um esquecimento).

### Regra de hard-delete vs cancelar — por que "pending E sem linhagem", não "sem linhagem" sozinho

A AC3 do epics.md fala especificamente de "tarefa `pending` sem linhagem" pro caso de hard delete. Uma tarefa `started`/`completed` sem nenhuma migração ainda é, em tese, "sem linhagem" — mas a AC não estende o hard delete pra esses estados, e a decisão desta story é **não** estender por conta própria: uma tarefa `completed` é registro histórico do BuJo (a semântica analógica nunca "apaga" o que foi feito), então cancelá-la (mantendo o registro riscado) é mais seguro e mais alinhado ao espírito do produto do que inferir uma regra mais permissiva que a AC não pediu. Ver Task 2.4/5.1(c).

### Por que o guardrail de ciclo fechado vive no service layer, não nas views

Padrão já estabelecido no projeto ("views finas... nenhuma regra de transição vive aqui", `views.py:1-3`): `create_task`/`update_task`/`delete_task` são os únicos pontos de escrita de `Task`, chamados por `TaskCreateView`, `SubtaskCreateView`, `MonthlyLogView.post`, `WeeklyLogView.post` (novo), `TaskDetailView.patch`/`delete`, `migrate_task`, `place_template`. Colocar o guardrail nos serviços (Task 2.2-2.4) protege **todos** esses call-sites de uma vez, incluindo dois que a AC4 nem menciona diretamente (`SubtaskCreateView`, `place_template`) — efeito colateral bom, não escopo adicional buscado à toa (é a mesma checagem, sem código extra). `migrate_task`/`place_template` na prática quase nunca disparam a exceção (destinos de migração são sempre o período corrente recém-criado via `get_or_create_*`, que começa vazio e portanto nunca "fechado" — `is_container_closed` exige `tasks.exists()`); a exceção de fato só é alcançável pelos caminhos novos desta story (Weekly create, qualquer update/delete num período antigo já disposto).

### Reuso de `TaskDetailPanel` — decisão consciente de estender o componente compartilhado

`TaskDetailPanel` é o único formulário de edição de campos (`título`/`descrição`/`categoria`/`eisenhower`) que existe no projeto — construí-lo de novo pra Semana/Mês duplicaria ~130 linhas sem motivo. A AC2 já pede explicitamente "igual ao Daily Log", o que é o mesmo que dizer "reuse o painel". O botão de excluir/cancelar (Task 9.3) entra nesse mesmo componente compartilhado — consequência: ele passa a existir também no Daily Log, mesmo essa story não tendo sido pedida por causa do Daily. Ver Task 9.4 pra rationale completo; `DailyPage.test.tsx` precisa de ajuste de mock (Task 10.5), não é uma regressão.

### AC4 — os dois gaps reais encontrados (não presumir que "fechado = somente leitura" já funciona)

Pesquisa nesta story confirmou dois buracos concretos no comportamento atual, nenhum deles causado por código desta story — são achados pré-existentes que a AC4 força a fechar:
1. **Backend:** nenhuma view/serviço checa `is_container_closed` antes de mutar. Um cliente que chame a API direto (ou um bug futuro de UI) pode escrever num ciclo fechado sem nenhuma barreira server-side.
2. **Frontend:** o gate de formulários usa `isArchiveView` (rota tem parâmetro `:weekStart`/`:monthFirst`) em vez de `closed` (campo vindo da API). Um período **corrente** que se torna `closed` no meio de uma sessão (todas as tarefas dispostas) continua mostrando os formulários de criação até o usuário navegar pra outro lugar e voltar.

Corrigidos nesta story: Task 1-2 (backend), Task 7.4/8 (frontend). Não são "bugs de outra story" a documentar como achado pré-existente — são exigidos pela própria AC4 desta story, então tratados como parte do trabalho, não como nota de review.

### `TaskDensityView`/`taskDensity` — por que invalidar em create/delete de Weekly/Monthly

Mesma razão já documentada na Story 11.3/11.4: a densidade reflete contagem de tarefas por dia; criar ou remover uma tarefa muda esse número. `useCreateMonthlyTaskMutation` já invalida `['bujo', 'taskDensity']` (api.ts:245) — os novos hooks desta story (`useCreateWeeklyTaskMutation`, `useDeleteTaskMutation`) seguem o mesmo padrão por consistência, mesmo que nenhuma AC desta story mencione densidade diretamente.

### Não fazer nesta story (fora de escopo, registrado pra não ser "descoberto" no meio do dev)

- **Clique-pra-ciclar status** (`onTransition`) em `TaskRow` de Semana/Mês — não pedido por nenhuma AC ("editar campos" ≠ "ciclar status"); `TaskRow` continua sem essa prop nessas duas páginas, o ícone de status permanece desabilitado ali (mesmo comportamento de hoje).
- **Reordenar tarefas** (`onReorder`/drag-and-drop) em Semana/Mês — mesma lógica, fora de escopo (Story 3.4 implementou reorder só pro Daily).
- **Confirmação antes de excluir** (modal "tem certeza?") — não existe nenhum padrão de confirm-dialog no projeto hoje; adicionar um só pra esta story seria inventar um componente novo sem pedido explícito de UX. O rótulo do botão já comunica a ação ("Excluir tarefa" vs "Cancelar tarefa"), e cancelar é sempre reversível (`ALLOWED[CANCELLED] = {PENDING}`, AD-02) — só o hard delete é irreversível, e é limitado a tarefas `pending` recém-criadas sem histórico, o caso de menor risco.
- **Ativar `onSelectDay` do `MonthDensityCalendar`** — reservado explicitamente pra Story 11.6 (comentário no próprio componente). Esta story não usa `MonthDensityCalendar` em nenhum lugar novo (o seletor de dia do form de Semana é um `Select` simples, Task 7.2 — não o calendário de densidade).
- **Modo somente-leitura no `TaskDetailPanel`** ("ver sem editar" no Arquivo) — a decisão desta story (Task 9.1) é simplesmente não abrir o painel no Arquivo, não construir um modo read-only nele.

### Previous Story Intelligence (11.4 — done)

- **Stack:** Backend Django + DRF + drf-spectacular + uv/pytest/ruff/lint-imports; Frontend Node 22 + Vite + React 19 + MUI 6.1 + TanStack Query 5.59 + Vitest + jest-axe. Sem dependência nova nesta story.
- **Node 22 obrigatório** (`nvm use 22`); `--no-file-parallelism` se houver flakiness de timeout (lição recorrente 11.2-11.4).
- **`jest-axe` só pega violação real contra o componente de verdade** — nunca mockar o componente sob teste de a11y (lição repetida 3.3-11.4). Isso vale especialmente pra `TaskDetailPanel` nos novos testes de `WeeklyPage`/`MonthlyPage` (Task 10.2/10.3) — não mockar o painel, deixá-lo real.
- **Mocks de barrel `features/bujo`:** técnica `importOriginal` obrigatória sempre que a página ganha um hook novo (Task 6.1 desta story adiciona `useCreateWeeklyTaskMutation`/`useDeleteTaskMutation` ao barrel) — mocks existentes de `WeeklyPage.test.tsx`/`MonthlyPage.test.tsx`/`DailyPage.test.tsx` que já usam `importOriginal` só precisam **acrescentar** os novos hooks ao objeto de override, não reescrever a técnica.
- **Contagem de testes sempre real** (retro Epic 3 §1). **File List por último** (retro Epic 3 §8-2). Guardrails ativos em `_bmad/custom/bmad-dev-story.toml`.
- **AR-22 (observabilidade) segue pendente, sem dono** — não bloqueia, mas continua sendo o pior follow-through do projeto (escalar antes do Épico 5, conforme memória do projeto).
- **11.3 estabeleceu** o padrão `dateFieldType: 'date' | 'day'` em `RecurringPlacementDialog` — esta story **não** usa esse componente (o form de criação de tarefa é mais simples, um `Select` fechado de 7 opções conhecidas, não um date-picker aberto), mas o precedente de "duplicar formatação de data localmente em vez de extrair util cedo demais" (Dev Notes 11.4) é o mesmo raciocínio aplicado ao Task 7.2 desta story.

### Git Intelligence

- Branch `main`; HEAD em `61d0806` (`feat(story-11.4): Anuais pendentes consultáveis e colocáveis no Future Log`). Commits do Épico 11 até aqui: `11.1` (cfdc1ae), `11.2` (81ae849), `11.3` (43d1b6e), fix pós-11.3 do lint-imports (f160b0b), `11.4` (61d0806). Convenção de commit: `feat(story-11.5): <descrição em pt-BR>`.
- `git diff --stat` esperado: `backend/core/exceptions.py` (+`ClosedCycleReadOnly`), `backend/bujo/services/tasks.py` (+guardrail, +`delete_task`), `backend/bujo/serializers.py` (+`WeeklyTaskCreateSerializer`), `backend/bujo/views.py` (+`WeeklyLogView.post`, +`TaskDetailView.delete`), `backend/bujo/tests/test_services.py`/`test_views.py` (+testes), `schema.yaml` + `frontend/src/api/types.gen.ts` (diff real, esperado — Task 11), `frontend/src/features/bujo/api.ts` + `frontend/src/api/keys.ts` (se `keys.ts` precisar — provavelmente não, `weeklyLog`/`todayLog`/`monthlyLog`/`taskDensity` já existem), `frontend/src/features/bujo/index.ts` (+exports), `frontend/src/pages/planner/WeeklyPage.tsx` (+form, +onOpenDetail), `frontend/src/pages/planner/MonthlyPage.tsx` (+gate `closed`, +onOpenDetail), `frontend/src/features/bujo/components/TaskDetailPanel.tsx` (+botão excluir/cancelar), testes correspondentes de cada arquivo tocado, `frontend/e2e/weekly-monthly-task-crud.spec.ts` (novo).

### Project Structure Notes

- **Backend alterado:** `backend/core/exceptions.py`, `backend/bujo/services/tasks.py`, `backend/bujo/serializers.py`, `backend/bujo/views.py`, `backend/bujo/tests/test_services.py`, `backend/bujo/tests/test_views.py`. Nenhum arquivo em `backend/*/migrations/` (nenhum campo de modelo novo — `ClosedCycleReadOnly` é uma exceção Python, não schema).
- **Frontend alterado:** `frontend/src/features/bujo/api.ts`, `frontend/src/features/bujo/index.ts`, `frontend/src/pages/planner/WeeklyPage.tsx` (+`WeeklyPage.test.tsx`), `frontend/src/pages/planner/MonthlyPage.tsx` (+`MonthlyPage.test.tsx`), `frontend/src/features/bujo/components/TaskDetailPanel.tsx` (+`TaskDetailPanel.test.tsx`), `frontend/src/pages/daily/DailyPage.test.tsx` (ajuste de mock), `frontend/src/features/bujo/api.test.tsx`, `frontend/e2e/weekly-monthly-task-crud.spec.ts` (novo). Contrato: `schema.yaml` + `frontend/src/api/types.gen.ts` (diff esperado, Task 11).
- **Fronteiras:** `pages/planner`/`pages/daily` compõem `features/bujo`; nenhuma nova violação de ESLint boundary/import-linter esperada (mesmo padrão de imports já usado). `services/tasks.py` importando `services/archive.py` é novo, mas sem risco de ciclo (archive.py não importa tasks.py — confirmado por leitura direta do arquivo).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 11.5 (linhas 841-863 — AC1-AC4, "itens #7, #8" de futureIdeas.md); §Epic 11 (linha 757 — ordem por dependência: "(5) CRUD em Semana/Mês")]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-02 (linhas 124-147 — matriz `ALLOWED`, cancelled↔pending); #AD-03 (linhas 149-186 — `migration_count`/`migrated_to_task_id`, schema de `tasks`); #AD-12 (linhas 660-688 — isolamento por `TenantManager`/contextvar, `objects` auto-escopado)]
- [Source: backend/bujo/models.py:83-171 (`Task` — campos de linhagem, `CheckConstraint task_exactly_one_log`); backend/bujo/models.py:40 (`WeeklyLog.week_start_is_monday`)]
- [Source: backend/bujo/services/tasks.py:1-58 (`create_task`/`update_task` — ponto de guardrail, Task 2); sem `delete_task` hoje — net-new]
- [Source: backend/bujo/services/state_machine.py:18-53 (`ALLOWED`, `transition_task`) — reaproveitado por `delete_task` (Task 2.4)]
- [Source: backend/bujo/services/archive.py:15-22 (`is_container_closed` — fechado = tem tarefa E nenhuma pending/started na subárvore, computado na leitura)]
- [Source: backend/bujo/services/migration.py:73-74 (`migrate_task(destination="cancel")` → `transition_task(..., CANCELLED)` — precedente exato do caminho de cancelamento reaproveitado por `delete_task`)]
- [Source: backend/core/exceptions.py:27-67 (taxonomia `DomainError`, `WrongPlacementContainer` como modelo de nova exceção); :103-107 (`DomainError` → 409 automático, sem mudança de handler necessária)]
- [Source: backend/bujo/views.py:71-98 (`TaskDetailView.patch` — padrão pra `.delete`, Task 4); :224-256 (`WeeklyLogView.get`, sem `post` — gap, Task 3); :259-299 (`MonthlyLogView` completo, com `post` — modelo a espelhar)]
- [Source: backend/bujo/serializers.py:170-196 (`MonthlyTaskCreateSerializer` — modelo pro `WeeklyTaskCreateSerializer`, Task 3); :12-35 (`TaskSerializer` — já expõe `migration_count`/`migrated_to_task`, sem mudança necessária)]
- [Source: backend/bujo/urls.py:27,39 (rotas `logs/weekly/` e `tasks/<uuid:pk>/` já existem — só faltam os métodos HTTP novos, zero mudança de urls.py)]
- [Source: backend/bujo/tests/factories.py:63-83 (`TaskFactory` — `weekly_log=`/`monthly_log=` sobrescrevem `log`); :36-61 (`WeeklyLogFactory`/`MonthlyLogFactory`)]
- [Source: frontend/src/pages/planner/WeeklyPage.tsx (página a estender — hoje só placement de recorrentes, Task 7/9); :18,35 (`isArchiveView`, `closed` já desestruturados)]
- [Source: frontend/src/pages/planner/MonthlyPage.tsx:183-217 (form de criação existente — modelo pro form de Weekly, Task 7); :72 (`closed` já desestruturado, só falta usar no gate, Task 8.1)]
- [Source: frontend/src/features/bujo/components/TaskRow.tsx:55-64 (comentário explícito: Weekly/Monthly usam `TaskRow` read-only "fora de escopo" das Stories 4.2/4.3 — esta story fecha esse escopo pra edição, não pra transição/reorder); :176-184 (ícone de status já desabilitado sem `onTransition` — comportamento preservado)]
- [Source: frontend/src/features/bujo/components/TaskDetailPanel.tsx (componente a estender — título/descrição/categoria/eisenhower já implementados, Task 9.3 adiciona excluir/cancelar); :159 (`{!isSubtask && (...)}` — padrão pro gate do novo botão, Task 9.5)]
- [Source: frontend/src/pages/daily/DailyPage.tsx:25,70-71,98-103 (`openTaskId`/`findTaskById`/`TaskDetailPanel` — padrão a replicar em WeeklyPage/MonthlyPage, Task 9.1-9.2)]
- [Source: frontend/src/features/bujo/components/AddTaskRow.tsx (padrão de form de criação simples — inspiração de estilo, não reaproveitado diretamente pro form de Weekly por causa do seletor de dia)]
- [Source: frontend/src/features/bujo/components/WeekDaySelector.tsx:14-22 (`formatDayChipLabel` — padrão de formatação de data a espelhar localmente no `Select` do Task 7.2, não reaproveitado diretamente pois o componente é um seletor de view-tab, não um input de formulário)]
- [Source: frontend/src/features/bujo/components/DayHeader.tsx:16-26 (`formatDayHeaderDate` — segunda referência do mesmo padrão de formatação local duplicada, reforça a decisão de não extrair util ainda)]
- [Source: frontend/src/features/bujo/api.ts:134-155 (`useUpdateTaskMutation` — padrão de invalidação por prefixo `['bujo','monthlyLog']`, replicado por `useDeleteTaskMutation`, Task 6.2); :236-248 (`useCreateMonthlyTaskMutation` — modelo pro `useCreateWeeklyTaskMutation`, Task 6.1)]
- [Source: frontend/src/api/keys.ts:13-30 (`keys.bujo.*` — `weeklyLog`/`monthlyLog`/`todayLog`/`taskDensity` já existem, nenhuma chave nova necessária)]
- [Source: frontend/src/api/types.gen.ts:533-549 (`Task` — `migrationCount`/`migratedToTask` já expostos, camelCase via djangorestframework-camel-case)]
- [Source: frontend/src/pages/planner/MonthlyPage.test.tsx:1-60 (padrão `importOriginal`+`QueryClientProvider`+`client` mockado); frontend/src/pages/planner/WeeklyPage.test.tsx:1-30 (idem, mock de `useWeeklyLogQuery`)]
- [Source: _bmad-output/implementation-artifacts/11-4-anuais-pendentes-consultaveis-e-colocaveis-no-future-log.md (Dev Notes "Reaproveitamento obrigatório" — precedente de duplicação local de helpers de data; padrão de teste de página; Node 22 + `--no-file-parallelism`)]
- [Source: _bmad-output/implementation-artifacts/epic-3-retro-2026-07-08.md §1 (contagem real de testes), §8 (File List por último) — guardrails em `_bmad/custom/bmad-dev-story.toml`]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- Backend: `uv run pytest bujo/ core/ -q` → **330 passed** (contagem real, execução completa após todas as mudanças).
- Backend guardrails: `ruff check .` (All checks passed!), `lint-imports` (1 kept, 0 broken), `manage.py check` (0 issues silenciados) — todos verdes.
- Frontend: `npx vitest run --no-file-parallelism` (Node 22) → **446 passed**, 44 arquivos, 0 erros (contagem real, execução completa após todas as mudanças, incluindo a correção do bug encontrado na verificação manual).
- Frontend: `npm run typecheck` / `npm run lint` / `npm run build` — todos verdes.
- Playwright (`e2e/weekly-monthly-task-crud.spec.ts`, branch Neon `e2e`): 6/6 specs verdes na execução final (`--workers=1`, backend real).

### Completion Notes List

- Backend (Tasks 1-5): `ClosedCycleReadOnly` nova exceção de domínio; guardrail de ciclo fechado centralizado em `_check_container_open` (chamado por `create_task`/`update_task`/novo `delete_task`); `WeeklyTaskCreateSerializer` + `WeeklyLogView.post`; `TaskDetailView.delete` (204 hard-delete vs 200+body cancelado); 14 novos testes de serviço + testes de view cobrindo criação/exclusão/guardrail de ciclo fechado, incl. regressão nos endpoints já existentes (`SubtaskCreateView`, `MonthlyLogView.post`).
- **Achado durante a implementação (Task 2, fora do previsto nos Dev Notes):** o guardrail de ciclo fechado em `update_task`, aplicado ingenuamente, quebrava `migrate_task` — migrar a ÚLTIMA tarefa pendente/started de um container faz esse container fechar (`is_container_closed`) como consequência DENTRO da mesma transação, e a chamada subsequente de `update_task` (bookkeeping de `migrated_to_task`/`migration_count` em `_migrate_subtree`) passava a levantar `ClosedCycleReadOnly` indevidamente — regressão real em `test_post_migrate_destination_week_migra_para_weekly_log_corrente` (Epic 4). Corrigido extraindo `set_lineage_fields` (sem o guardrail) em `services/tasks.py`, usado só por `services/migration.py` para os dois updates de linhagem internos — a AC4 protege mutação de um ciclo JÁ fechado, não a disposição legítima que o fecha. Documentado no docstring da função; não é um achado a reportar em review, foi corrigido nesta story.
- Frontend (Tasks 6-9): `useCreateWeeklyTaskMutation`/`useDeleteTaskMutation` (novo hooks); formulário de criação em `WeeklyPage` (Select de dia, mesmo padrão de formatação local de `WeekDaySelector`/`DayHeader`); gate `!isArchiveView && !closed` corrigido em `MonthlyPage` e aplicado em `WeeklyPage`; `onOpenDetail` cabeado em todos os call-sites de `TaskRow` de Semana/Mês; botão excluir/cancelar em `TaskDetailPanel` (compartilhado com o Daily Log, rótulo dinâmico via `willHardDelete`).
- **Achado durante a verificação manual (Task 12, fora do previsto nos Dev Notes):** dois gaps de invalidação de cache só ficaram visíveis contra o backend real (não pegos pelos testes unitários mockados, que não exercitam o `queryKey` ativo de verdade):
  1. `useCreateWeeklyTaskMutation` invalidava `keys.bujo.weeklyLog(weekStart)` com o `weekStart` explícito, mas a chave ativa de `WeeklyPage` na rota corrente é o sentinel `'current'` (`useWeeklyLogQuery(routeWeekStart)` com `routeWeekStart === undefined`) — mesmo descompasso já resolvido em `MonthlyPage` (Task 7.3 original), mas os Dev Notes desta story assumiram, incorretamente, que `WeeklyPage` não tinha esse problema. Corrigido com o mesmo padrão: `{ onSuccess: () => weeklyLog.refetch() }` no `handleSubmit`.
  2. `useUpdateTaskMutation` (hook pré-existente, usado por `TaskDetailPanel`) só invalidava `['bujo','monthlyLog']` no sucesso — nunca `weeklyLog`. Antes desta story `TaskDetailPanel` só era usado no Daily Log (cache próprio, via updater otimista) e em `MonthlyPage` só para confirmar data (já coberto). A AC2 desta story é o primeiro caso de edição de campo via `TaskDetailPanel` em `WeeklyPage` — sem a invalidação, o título editado nunca reaparecia na lista. Corrigido adicionando `invalidateQueries(['bujo','weeklyLog'])` ao lado do `monthlyLog` já existente.
  Ambos os achados geraram teste automatizado novo (`api.test.tsx`) além da cobertura e2e que os expôs — não ficaram como gap de documentação: o comentário incorreto nos Dev Notes originais desta story foi corrigido inline pelas notas acima.
- E2E (Task 12): novo `frontend/e2e/weekly-monthly-task-crud.spec.ts` (6 specs) + `seedClosedCycleScenario.ts` (fecha semana/mês CORRENTE via 1 tarefa `completed` cada — sem affordance de UI para compor esse cenário; `seedWeeklyTaskWithLineage` para o caso "excluir com `migration_count>0` → cancela"). Cobre criação com/sem dia, criação no mês, edição via painel em ambas as telas, hard delete (204) vs cancelamento (200) e o guardrail de ciclo fechado no frontend (form + clique-pra-editar somem na rota corrente, não só no Arquivo). Zero erros de console em todos os specs.
- Contrato (Task 11): `schema.yaml` + `frontend/src/api/types.gen.ts` regenerados — diff esperado (novo `WeeklyTaskCreateSerializer`/`POST /api/bujo/logs/weekly/`/`DELETE /api/bujo/tasks/{id}/`), não é achado.

### File List

**Backend:**
- `backend/core/exceptions.py` — nova exceção `ClosedCycleReadOnly`
- `backend/bujo/services/tasks.py` — guardrail de ciclo fechado (`_check_container_open`), novo `delete_task`, `set_lineage_fields` (achado da Task 2)
- `backend/bujo/services/migration.py` — usa `set_lineage_fields` em vez de `update_task` para bookkeeping de linhagem (achado da Task 2)
- `backend/bujo/serializers.py` — novo `WeeklyTaskCreateSerializer`
- `backend/bujo/views.py` — `WeeklyLogView.post`, `TaskDetailView.delete`
- `backend/bujo/tests/test_services.py` — testes de `delete_task` e guardrail de ciclo fechado em `create_task`/`update_task`
- `backend/bujo/tests/test_views.py` — testes de `POST /api/bujo/logs/weekly/`, `DELETE /api/bujo/tasks/{id}/`, regressão do guardrail em `SubtaskCreateView`/`MonthlyLogView.post`

**Frontend:**
- `frontend/src/features/bujo/api.ts` — `useCreateWeeklyTaskMutation`, `useDeleteTaskMutation`, invalidação de `weeklyLog` em `useUpdateTaskMutation` (achado da Task 12)
- `frontend/src/features/bujo/api.test.tsx` — testes dos 2 novos hooks + teste da invalidação de `weeklyLog`
- `frontend/src/features/bujo/index.ts` — exports dos 2 novos hooks
- `frontend/src/pages/planner/WeeklyPage.tsx` — formulário de criação, gate `!closed`, `onOpenDetail`, `TaskDetailPanel`, refetch explícito no submit (achado da Task 12)
- `frontend/src/pages/planner/WeeklyPage.test.tsx` — testes do formulário e de `onOpenDetail`
- `frontend/src/pages/planner/MonthlyPage.tsx` — gate `!closed` corrigido, `onOpenDetail`, `TaskDetailPanel`
- `frontend/src/pages/planner/MonthlyPage.test.tsx` — testes de `onOpenDetail` e do gate `closed`
- `frontend/src/features/bujo/components/TaskDetailPanel.tsx` — botão excluir/cancelar
- `frontend/src/features/bujo/components/TaskDetailPanel.test.tsx` — testes do botão excluir/cancelar
- `frontend/e2e/weekly-monthly-task-crud.spec.ts` — novo spec e2e (6 testes)
- `frontend/e2e/seedClosedCycleScenario.ts` — novo seed helper

**Contrato:**
- `schema.yaml`
- `frontend/src/api/types.gen.ts`

**Sem alteração (verificado, não precisou de mudança):**
- `frontend/src/pages/daily/DailyPage.test.tsx` — `TaskDetailPanel` já é mockado por inteiro (`vi.mock('../../features/bujo/components/TaskDetailPanel', ...)`), então o botão novo nunca renderiza nesse arquivo; nenhum ajuste foi necessário (a expectativa original dos Dev Notes de que precisaria de ajuste não se confirmou).

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-07-15 | 0.1 | Implementação da Story 11.5: guardrail de ciclo fechado centralizado no service layer (`create_task`/`update_task`/novo `delete_task`), `POST /api/bujo/logs/weekly/`, `DELETE /api/bujo/tasks/{id}/` (204 hard-delete vs 200 cancelado); formulário de criação em `WeeklyPage`, correção do gate `closed` em `MonthlyPage`, `onOpenDetail` em Semana/Mês, botão excluir/cancelar em `TaskDetailPanel` compartilhado. Dois achados reais corrigidos nesta mesma story (não deixados como gap): (1) guardrail de ciclo fechado quebrava `migrate_task` ao migrar a última tarefa pendente de um container — corrigido com `set_lineage_fields` sem guardrail para bookkeeping interno de linhagem; (2) `useCreateWeeklyTaskMutation`/`useUpdateTaskMutation` não invalidavam a chave ativa de `WeeklyPage` (sentinel `'current'` vs `weekStart`/prefixo `weeklyLog` ausente) — corrigido com refetch explícito e invalidação por prefixo, achados via Playwright contra backend real. Backend 330 passed, Frontend 446 passed, Playwright 6/6 (branch `e2e`), contrato com diff esperado (2 endpoints novos). Status → review. | Amelia (dev-story) |
| 2026-07-15 | 0.2 | Revisão adversarial (story-automator-review): git status conferido contra File List (sem discrepâncias, apenas arquivos de tracking BMAD excluídos do escopo); as 4 ACs re-verificadas linha a linha contra o diff real (guardrail `_check_container_open` em `create_task`/`update_task`/`delete_task`, `WeeklyTaskCreateSerializer`+`WeeklyLogView.post`, `TaskDetailView.delete` 204/200, gate `!isArchiveView && !closed` em ambas as páginas, `onOpenDetail`+`TaskDetailPanel` reaproveitado, botão excluir/cancelar com `willHardDelete`); todas as 12 tasks/subtasks `[x]` confirmadas implementadas, nenhuma reivindicação falsa. Suítes reexecutadas do zero (não apenas lidas do Dev Agent Record): backend `pytest` 330 passed, `ruff check` limpo, `lint-imports` 1 kept/0 broken, `manage.py check` 0 issues; frontend `typecheck`/`lint` limpos, `vitest run --no-file-parallelism` 446 passed; `schema.yaml` regenerado e comparado byte-a-byte contra o commitado — idêntico. Zero findings HIGH/MEDIUM/LOW após revisão adversarial completa (AC↔código, task↔evidência, segurança, performance, qualidade de teste). Status → done. | Claude (story-automator-review) |
