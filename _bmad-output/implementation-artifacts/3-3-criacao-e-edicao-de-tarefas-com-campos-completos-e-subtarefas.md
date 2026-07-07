---
baseline_commit: 1929ce764168cb4cd56aab4ff4f475cd87640bce
---

# Story 3.3: Criação e edição de tarefas com campos completos e subtarefas

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero criar e editar tarefas com título, descrição, Eisenhower e subtarefas,
Para que eu capture o detalhe necessário de cada tarefa do meu dia (FR-1.3, AR-15).

## Acceptance Criteria

1. **Criar tarefa (botão ou atalho `N`)**
   - **Dado que** o Daily Log,
   - **Quando** Hugo adiciona uma tarefa (botão ou atalho `N`),
   - **Então** o título é obrigatório e descrição, Eisenhower e subtarefas são opcionais; salvar cria a `Task` com `status=pending` e `order_index` no fim da lista,
   - **E** Enter no campo de título salva e abre nova linha.

2. **Editar tarefa e gerenciar subtarefas via painel de detalhe**
   - **Dado que** uma tarefa existente,
   - **Quando** Hugo abre o detalhe (clique no título → painel inline desktop / bottom sheet mobile),
   - **Então** pode editar título, descrição, categoria, Eisenhower e gerenciar subtarefas,
   - **E** uma subtarefa é criada como `Task` com `parent_task_id` apontando para a tarefa-pai (árvore auto-referencial), compartilhando o `log_id` do pai.

3. **Subtarefas aninhadas com ciclo de estados independente**
   - **Dado que** subtarefas de uma tarefa,
   - **Quando** exibidas,
   - **Então** aparecem aninhadas sob o pai e cada uma tem seu próprio ciclo de estados independente (sem cascata automática pai↔filho),
   - **E** concluir todos os filhos não conclui o pai automaticamente.

## Tasks / Subtasks

- [x] **Task 1: Camada de serviço — criar e editar tarefas** (AC: #1, #2)
  - [x] 1.1 Criar `bujo/services/tasks.py` (novo arquivo, ao lado de `logs.py`/`state_machine.py`) — assinatura fixa `*, user` primeiro kwarg (§6.2):
    ```python
    @transaction.atomic
    def create_task(*, user, log, title, description=None, eisenhower=None, category=None, parent_task=None) -> Task:
        siblings = Task.objects.filter(log=log, parent_task=parent_task)
        max_order = siblings.aggregate(models.Max("order_index"))["order_index__max"]
        order_index = 0.0 if max_order is None else max_order + 1.0
        return Task.objects.create(
            log=log, parent_task=parent_task, title=title, description=description,
            eisenhower=eisenhower, category=category, order_index=order_index,
            status=Task.Status.PENDING,
        )

    @transaction.atomic
    def update_task(*, user, task_id, **fields) -> Task:
        task = Task.objects.get(id=task_id)  # objects = auto-escopado por tenant
        for field, value in fields.items():
            setattr(task, field, value)
        task.save(update_fields=[*fields.keys(), "updated_at"])
        return task
    ```
  - [x] 1.2 `order_index` sempre calculado **por irmãos** (`log` + `parent_task` idênticos) — uma subtarefa nunca compete por posição com a tarefa-pai nem com filhos de outro pai (AD-08 item 12: "`order_index` da subtarefa é relativo aos irmãos sob o mesmo pai").
  - [x] 1.3 `create_task`/`update_task` **não** validam forma/enum — isso é responsabilidade do serializer na view (§6.6); o serviço assume dados já validados.
  - [x] 1.4 `bujo/tests/test_services.py`: `create_task` cria tarefa raiz com `order_index` sequencial (0.0, 1.0, 2.0...); `create_task` com `parent_task` cria subtarefa com `order_index` relativo aos irmãos (não ao pai); `update_task` altera só os campos passados; `update_task`/`create_task` escopados por tenant (mesmo padrão de `test_transition_task_escopado_por_tenant`).

- [x] **Task 2: Serializers de leitura/escrita** (AC: #1, #2, #3)
  - [x] 2.1 Em `bujo/serializers.py`, estender `TaskSerializer`: adicionar `description` a `Meta.fields` e um campo `subtasks` (`SerializerMethodField`, recursivo — reusa a própria `TaskSerializer`):
    ```python
    class TaskSerializer(serializers.ModelSerializer):
        subtasks = serializers.SerializerMethodField()

        class Meta:
            model = Task
            fields = ["id", "title", "description", "status", "eisenhower", "category", "subtasks"]

        def get_subtasks(self, obj):
            return TaskSerializer(obj.subtasks.all(), many=True).data
    ```
    `obj.subtasks` usa o `related_name="subtasks"` da FK `Task.parent_task` (já existe desde a 3.1) — vem ordenado por `order_index` via `Task.Meta.ordering`, sem `order_by` explícito.
  - [x] 2.2 **Gap fechado nesta story:** `LogSerializer.tasks` hoje serializa **todos** os registros de `log.tasks` (flat, incluindo subtarefas, já que a subtarefa compartilha `log_id` do pai — AD-08 item 12). Isso duplicaria cada subtarefa: uma vez como filha aninhada (via `TaskSerializer.subtasks`), outra vez solta na raiz da lista. Trocar `LogSerializer.tasks` de `TaskSerializer(many=True, read_only=True)` para `SerializerMethodField` filtrando só raízes:
    ```python
    class LogSerializer(serializers.ModelSerializer):
        tasks = serializers.SerializerMethodField()

        class Meta:
            model = Log
            fields = ["id", "log_date", "tasks"]

        def get_tasks(self, obj):
            roots = obj.tasks.filter(parent_task__isnull=True)
            return TaskSerializer(roots, many=True).data
    ```
  - [x] 2.3 Criar `TaskCreateSerializer(serializers.Serializer)` (write-only, usado por criação de raiz **e** de subtarefa — mesmo shape, o `parent_task` vem da URL, não do body):
    ```python
    class TaskCreateSerializer(serializers.Serializer):
        title = serializers.CharField(max_length=500)
        description = serializers.CharField(required=False, allow_null=True, allow_blank=True)
        eisenhower = serializers.ChoiceField(choices=Task.Eisenhower.choices, required=False, allow_null=True)
        category = serializers.ChoiceField(choices=Task.Category.choices, required=False, allow_null=True)
    ```
  - [x] 2.4 Criar `TaskUpdateSerializer(serializers.Serializer)` — mesmos campos, todos `required=False` (usado com `partial=True` na view; DRF `Serializer` honra `partial` — campo ausente do body é **excluído** de `validated_data`, não vira `None`):
    ```python
    class TaskUpdateSerializer(serializers.Serializer):
        title = serializers.CharField(max_length=500, required=False)
        description = serializers.CharField(required=False, allow_null=True, allow_blank=True)
        eisenhower = serializers.ChoiceField(choices=Task.Eisenhower.choices, required=False, allow_null=True)
        category = serializers.ChoiceField(choices=Task.Category.choices, required=False, allow_null=True)
    ```
  - [x] 2.5 `bujo/tests/test_serializers.py`: `TaskSerializer` expõe `description` (nulo serializa como `null`, não omitido — mesmo contrato da 3.2 para `category`/`eisenhower`); `subtasks` vazio serializa como `[]`; `subtasks` aninha na ordem de `order_index`; `LogSerializer.tasks` **não** inclui subtarefas na raiz (só tarefas com `parent_task=None`), mesmo quando o `Log` tem subtarefas materializadas.

- [x] **Task 3: Views + URLs — criar, editar e criar subtarefa** (AC: #1, #2)
  - [x] 3.1 Em `bujo/views.py`, adicionar `from rest_framework import status` (import novo — o arquivo hoje só importa `serializers`/`Response`/`APIView`/`NotFound`) e `TaskCreateView(APIView)`:
    ```python
    class TaskCreateView(APIView):
        @extend_schema(request=TaskCreateSerializer, responses=TaskSerializer)
        def post(self, request):
            body = TaskCreateSerializer(data=request.data)
            body.is_valid(raise_exception=True)
            log = get_or_create_daily_log(user=request.user, log_date=today_for(request.user))
            task = create_task(user=request.user, log=log, **body.validated_data)
            return Response(TaskSerializer(task).data, status=status.HTTP_201_CREATED)
    ```
    `log_date` resolvido **sempre** via `today_for(request.user)` (AD-04: "o cliente nunca dita a data") — mesmo padrão de `TodayLogView`; esta view só cria tarefas **raiz no Daily Log de hoje** (criar tarefa em outro log/data é fora do escopo desta story).
  - [x] 3.2 `TaskDetailView(APIView)` — só `patch` (sem `get`/`delete`, não pedidos por nenhuma AC):
    ```python
    class TaskDetailView(APIView):
        @extend_schema(request=TaskUpdateSerializer, responses=TaskSerializer)
        def patch(self, request, pk):
            body = TaskUpdateSerializer(data=request.data, partial=True)
            body.is_valid(raise_exception=True)
            try:
                task = update_task(user=request.user, task_id=pk, **body.validated_data)
            except Task.DoesNotExist:
                raise NotFound() from None
            return Response(TaskSerializer(task).data)
    ```
  - [x] 3.3 `SubtaskCreateView(APIView)` — `parent_task_id` vem da URL, não do body (view fina resolve o pai, serviço já existente cria o filho):
    ```python
    class SubtaskCreateView(APIView):
        @extend_schema(request=TaskCreateSerializer, responses=TaskSerializer)
        def post(self, request, pk):
            body = TaskCreateSerializer(data=request.data)
            body.is_valid(raise_exception=True)
            try:
                parent = Task.objects.get(id=pk)
            except Task.DoesNotExist:
                raise NotFound() from None
            task = create_task(user=request.user, log=parent.log, parent_task=parent, **body.validated_data)
            return Response(TaskSerializer(task).data, status=status.HTTP_201_CREATED)
    ```
  - [x] 3.4 `bujo/urls.py` — adicionar, preservando as duas rotas existentes:
    ```python
    path("tasks/", TaskCreateView.as_view(), name="bujo-task-create"),
    path("tasks/<uuid:pk>/", TaskDetailView.as_view(), name="bujo-task-detail"),
    path("tasks/<uuid:pk>/subtasks/", SubtaskCreateView.as_view(), name="bujo-task-subtasks"),
    ```
  - [x] 3.5 `bujo/tests/test_views.py`: `POST /api/bujo/tasks/` cria tarefa em `status=pending` no log de hoje com `order_index` no fim (201); título ausente → 400; `PATCH /api/bujo/tasks/{id}/` edita campos parciais (200), tarefa de outro tenant → 404, `eisenhower`/`category` fora do enum → 400; `POST /api/bujo/tasks/{id}/subtasks/` cria subtarefa com `parent_task_id` correto e `log_id` herdado do pai (201), pai de outro tenant → 404; `GET /api/bujo/logs/today/` após criar subtarefa mostra a subtarefa **só** aninhada em `tasks[].subtasks`, nunca solta na raiz de `tasks[]` (cobre o gap fechado na Task 2.2).

- [x] **Task 4: Regenerar o contrato de API** (AC: #1, #2, #3)
  - [x] 4.1 `cd backend && uv run python manage.py spectacular --file ../schema.yaml`
  - [x] 4.2 `cd frontend && npm run generate-types`
  - [x] 4.3 Confirmar que o step de CI "Verificar types.gen.ts está atualizado" (Story 1.4) passa sem diff

- [x] **Task 5: Camada de dados do frontend — mutações de criação/edição** (AC: #1, #2, #3)
  - [x] 5.1 `frontend/src/features/bujo/api.ts` — adicionar `useCreateTaskMutation()` (`POST /api/bujo/tasks/`), `useCreateSubtaskMutation()` (`POST /api/bujo/tasks/{parentId}/subtasks/`) e `useUpdateTaskMutation()` (`PATCH /api/bujo/tasks/{id}/`). Todas usam `useOptimisticMutation` com `queryKey: keys.bujo.todayLog()` (nenhuma chave nova — mutações de tarefa sempre afetam o Daily Log de hoje nesta story).
  - [x] 5.2 Criar `frontend/src/features/bujo/taskTree.ts` com um helper puro de atualização recursiva da árvore em cache (evita duplicar a lógica de "achar o nó certo" em 3 updaters diferentes):
    ```typescript
    export function mapTaskTree(tasks: Task[], taskId: string, fn: (task: Task) => Task): Task[] {
      return tasks.map((task) =>
        task.id === taskId
          ? fn(task)
          : { ...task, subtasks: mapTaskTree(task.subtasks ?? [], taskId, fn) },
      )
    }
    ```
    - `useUpdateTaskMutation`: `updater` chama `mapTaskTree(current.tasks, taskId, (task) => ({ ...task, ...patch }))` — encontra a tarefa em qualquer profundidade (raiz ou subtarefa; ambas passam pelo mesmo endpoint `PATCH`).
    - `useCreateSubtaskMutation`: `updater` chama `mapTaskTree(current.tasks, parentTaskId, (task) => ({ ...task, subtasks: [...(task.subtasks ?? []), optimisticSubtask] }))`.
    - `useCreateTaskMutation` (raiz): `updater` faz `{ ...current, tasks: [...current.tasks, optimisticTask] }` diretamente (não precisa do helper — sempre entra na raiz).
    - Tarefa/subtarefa otimista usa `id: crypto.randomUUID()` (§6.5/AD-13 — geração de ID no cliente) e `subtasks: []`; o `onSettled` de `useOptimisticMutation` já invalida a query, então o ID temporário é substituído pelo real do servidor na próxima leitura — não precisa reconciliar manualmente.
  - [x] 5.3 `frontend/src/features/bujo/types.ts` — nenhuma mudança manual esperada (os novos campos `description`/`subtasks` e os schemas de request chegam via a regeneração da Task 4; só conferir que `Task` inclui `subtasks?: Task[]` após regenerar).
  - [x] 5.4 `frontend/src/features/bujo/api.test.tsx` (estender o arquivo existente): sucesso + otimismo + rollback das 3 novas mutações, seguindo o mesmo harness de `useTransitionTaskMutation`; teste dedicado de `mapTaskTree` cobrindo achar um nó na raiz e achar um nó dentro de `subtasks`.

- [x] **Task 6: Componentes de frontend — criar tarefa, painel de detalhe, subtarefas aninhadas** (AC: #1, #2, #3)
  - [x] 6.1 Criar `frontend/src/features/bujo/components/AddTaskRow.tsx` — `TextField` de título (único campo obrigatório desta linha; descrição/Eisenhower/subtarefas ficam no painel de detalhe, não na linha de criação rápida — a AC1 permite isso, já que só título é obrigatório e o resto é opcional). Enter no campo: chama `useCreateTaskMutation().mutate({ title })`, limpa o campo e mantém o foco nele (abre "nova linha" reaproveitando o mesmo input, não criando um input novo por tarefa). Renderizado no fim da lista de Task Rows em `DailyPage.tsx`, com um botão "+ Nova tarefa" equivalente (mesma ação do Enter) para quem não usa teclado.
  - [x] 6.2 Atalho `N`: em `DailyPage.tsx`, `useEffect` com `window.addEventListener('keydown', ...)` — **mesmo guard de `AppLayout.tsx`** (`isEditable` checando `INPUT`/`TEXTAREA`/`isContentEditable` no `event.target`, `key === 'n'`/`'N'`) focando o `TextField` de `AddTaskRow` via `ref`. Não duplicar o listener de `[` do `AppLayout` — este é local à página (`N` "no contexto atual", per EXPERIENCE.md §6.1), não global à sidebar.
  - [x] 6.3 `TaskRow.tsx` — tornar o título clicável (`onClick` abre o painel de detalhe, `role="button"` ou `<Typography component="button">` com `aria-label` "Ver detalhes de {title}"); adicionar prop `onOpenDetail: (taskId: string) => void`. Abaixo da linha, se `task.subtasks?.length`, renderizar cada subtarefa como um `TaskRow` recursivo com indentação (`pl` adicional, ex. `theme.spacing(3)`) — **um único nível** de recursão visual é esperado nesta story (a API tecnicamente aninha profundidade arbitrária via AD-08, mas a UI desta story só abre o painel de "adicionar subtarefa" a partir de tarefas raiz — ver Task 6.4). Subtarefas ciclam status de forma independente reusando o mesmo `onTransition` (já é por `taskId`, funciona para qualquer nó da árvore sem mudança).
  - [x] 6.4 Criar `frontend/src/features/bujo/components/TaskDetailPanel.tsx` — painel de edição para uma tarefa (raiz ou subtarefa). Container: `MUI Drawer` `anchor="right"` no desktop (≥ 1024px, layout de dois painéis — EXPERIENCE.md §8.1 "Daily Log + painel de detalhe de tarefa aberto lateralmente") e `anchor="bottom"` no mobile (< 768px — EXPERIENCE.md §8.3 "bottom sheet, não painel lateral"); usar o mesmo `useMediaQuery` de `TaskRow`/`AppLayout` para decidir o anchor. Campos: `TextField` título, `TextField` descrição (multiline), `Select` categoria (6 opções + "nenhuma"), `Select` Eisenhower (4 opções). Cada campo dispara `useUpdateTaskMutation().mutate({ taskId, ...patch })` no `onBlur` (não a cada tecla — evita uma request por caractere; título deve ao menos permitir `onBlur` já que não há botão "Salvar" explícito em nenhum documento de UX). Lista de subtarefas abaixo dos campos + um `AddTaskRow`-like input reaproveitado para adicionar subtarefa (`useCreateSubtaskMutation().mutate({ parentTaskId, title })`). Fecha com `Esc` (EXPERIENCE.md §6.1/§7.1 — "Esc fecha o modal ou popover mais recente") ou clique fora (comportamento padrão do `Drawer` temporário).
  - [x] 6.5 `DailyPage.tsx` — estado local `openTaskId: string | null`; `TaskRow.onOpenDetail` seta esse estado; renderiza `<TaskDetailPanel taskId={openTaskId} onClose={() => setOpenTaskId(null)} />` quando não-nulo (busca a tarefa correspondente em `todayLog.data.tasks`, incluindo subtarefas, via um `findTaskById` local ou o mesmo helper de busca de `taskTree.ts`).

- [x] **Task 7: Testes de frontend + verificação manual** (AC: #1, #2, #3)
  - [x] 7.1 `AddTaskRow.test.tsx`: Enter com título preenchido chama a mutação e limpa o campo; Enter com título vazio não chama a mutação (título obrigatório, AC1); atalho `N` (simulado via `DailyPage`) foca o campo quando o foco não está em outro input.
  - [x] 7.2 `TaskDetailPanel.test.tsx`: abre com os valores atuais da tarefa; editar e sair do campo (`blur`) chama `useUpdateTaskMutation` com o patch correto; adicionar subtarefa chama `useCreateSubtaskMutation`; `Esc` fecha o painel.
  - [x] 7.3 `TaskRow.test.tsx` (estender): clique no título chama `onOpenDetail` com o `id` da tarefa; subtarefas em `task.subtasks` renderizam como linhas aninhadas com indentação e ciclam status de forma independente do pai (concluir subtarefa não muda o status do pai — comportamento já garantido pelo backend, teste cobre que o frontend não introduz cascata na renderização).
  - [x] 7.4 `DailyPage.test.tsx` (estender): `AddTaskRow` aparece no fim da lista mesmo com lista vazia; abrir/fechar o painel de detalhe via clique no título; sem violações de acessibilidade (`jest-axe`) com o painel aberto.
  - [x] 7.5 `cd backend && uv run pytest && uv run ruff check . && uv run lint-imports && uv run python manage.py check` — 0 falhas/issues
  - [x] 7.6 `cd frontend && npm run typecheck && npm run lint && npm run build` — 0 erros
  - [x] 7.7 Verificação manual: `npm run dev`, logar, abrir `/today`; criar tarefa via botão e via atalho `N`; abrir o painel de detalhe (desktop: painel lateral; redimensionar para mobile: bottom sheet), editar título/descrição/categoria/Eisenhower, adicionar 2 subtarefas, ciclar o status de uma subtarefa sem afetar o pai, fechar com `Esc`; recarregar a página e confirmar que tudo persistiu.

## Dev Notes

### Esta story NÃO altera o schema — só API + frontend sobre o schema já congelado

A Story 3.1 já congelou `parent_task`/`description`/`category`/`eisenhower` no model `Task` (todos nuláveis, já existentes). **Nenhuma migration é esperada nesta story.** Se o dev-story achar necessidade de alterar `models.py`, isso é um sinal de que algo foi mal interpretado — parar e reconferir contra `backend/bujo/models.py` antes de prosseguir.

### Gap de serializer fechado nesta story: `LogSerializer.tasks` vazava subtarefas na raiz

`Task.log` tem `related_name="tasks"`; subtarefas **compartilham o `log_id` do pai** (AD-08 item 12), então `log.tasks.all()` hoje retorna tarefas-raiz e subtarefas misturadas, sem filtro. Até a 3.2 isso nunca importava (nenhuma subtarefa existia). Esta story introduz a primeira forma de criar subtarefas — sem o filtro `parent_task__isnull=True` na Task 2.2, uma subtarefa apareceria **duas vezes** na resposta de `GET /api/bujo/logs/today/`: uma vez aninhada em `tasks[].subtasks` (via `TaskSerializer.subtasks`), outra vez solta em `tasks[]` como se fosse uma tarefa raiz. O teste da Task 3.5 cobre isso explicitamente.

### Por que a criação de tarefa raiz é sempre no Daily Log de hoje (não um `log_id` no body)

FR-1.3/AC1 desta story vivem inteiramente no contexto do Daily Log (Épico 3). Aceitar `log_id` arbitrário no body de `POST /api/bujo/tasks/` abriria a porta para criar tarefas em qualquer log de qualquer data — capacidade que nenhuma AC pede e que colide com AD-04 ("o cliente nunca dita a data"). `TaskCreateView` resolve `log = get_or_create_daily_log(user=request.user, log_date=today_for(request.user))` server-side, mesmo padrão de `TodayLogView` (3.2). Criar tarefa em Weekly/Monthly/Future Log é Épico 4+.

### Por que subtarefa não recebe `parent_task_id` no body

`POST /api/bujo/tasks/{id}/subtasks/` já identifica o pai pela URL — repetir `parent_task_id` no body seria redundante e abriria uma inconsistência possível (URL diz um pai, body diz outro). A view resolve `parent = Task.objects.get(id=pk)` (auto-escopado por tenant — pai de outro usuário → 404, mesmo padrão de `TaskTransitionView` da 3.2) e passa `parent_task=parent` para `create_task`, que herda `log=parent.log`.

### Profundidade da árvore: schema arbitrário, UI de um nível nesta story

AD-08 permite profundidade arbitrária no schema (`parent_task` autoreferencial) e diz explicitamente "UI pode limitar a 1–2 níveis". Esta story implementa **um nível de UI**: o painel de detalhe de uma tarefa **raiz** permite adicionar subtarefas; o painel de detalhe de uma **subtarefa** (Task 6.4/6.5, reaproveitando o mesmo componente) edita título/descrição/categoria/Eisenhower normalmente, mas **não** expõe a opção de adicionar sub-subtarefas — decisão de escopo, não limitação técnica (o endpoint `POST /api/bujo/tasks/{id}/subtasks/` aceitaria qualquer `id` de tarefa existente, inclusive uma subtarefa, se chamado diretamente). Se o dev-story achar mais simples desabilitar isso só na UI (esconder o input de "adicionar subtarefa" quando `task.parent_task` não é nulo/quando o painel foi aberto para uma subtarefa), essa é a abordagem esperada — não é necessário bloquear no backend.

### UX gap: container do painel de detalhe tem tipo definido, mas não o layout interno

`EXPERIENCE.md` §8.1 e §8.3 são explícitos sobre o **tipo de container** (painel lateral aberto no desktop / bottom sheet no mobile — não é ambíguo, ao contrário do gap de `category` na 3.2). O que **não** existe em nenhum mockup ou seção de `DESIGN.md`/`EXPERIENCE.md` é a disposição interna exata dos campos do painel (ordem título→descrição→categoria→Eisenhower→subtarefas é uma escolha razoável desta story, seguindo a ordem em que `EXPERIENCE.md` linha 172 os lista: "título, descrição, subtarefas, categoria, Eisenhower" — mas nada impede reordenar por ergonomia). Também não há especificação de "salvar" explícito (nenhum botão "Salvar" aparece em nenhum documento) — a decisão desta story é salvar por campo no `onBlur` (consistente com a filosofia geral do produto de fricção mínima e resposta imediata, mesma filha de "1 clique por decisão" do Task Row). Isso não bloqueia a implementação, mas registrar para a Sally (UX) revisitar numa iteração futura, igual ao gap de "chip de categoria" fechado como não-bloqueante na 3.2.

### Reference: services + views (forma esperada, ver Tasks 1 e 3 acima para o código completo)

Os blocos de código nas Tasks 1.1, 2.1–2.4 e 3.1–3.3 acima são a forma esperada — não reinventar a assinatura do serviço (`*, user` primeiro kwarg, §6.2) nem a taxonomia de exceção (`Task.DoesNotExist` → `NotFound` na view, nunca tratado no serviço — mesmo padrão de `TaskTransitionView` da 3.2, que já fechou esse item para todo o app `bujo`).

### `mapTaskTree` — por que um helper compartilhado

Três mutações (`update`, `create subtask`, e potencialmente futuras) precisam achar um nó em qualquer profundidade da árvore em cache e substituí-lo imutavelmente. Sem um helper único, cada `updater` reimplementaria a mesma recursão com pequenas variações — risco de um bug de imutabilidade (mutar `subtasks` in-place) aparecer em só uma das três. Ver assinatura sugerida na Task 5.2.

### Atalho `N` — escopo de página, não de layout

`AppLayout.tsx` já tem um `useEffect` com o mesmo guard de `isEditable` para o atalho `[` (colapsar sidebar), mas esse é **global** (todas as páginas). O atalho `N` da EXPERIENCE.md §6.1 é "nova tarefa **no contexto atual**" — implementá-lo em `DailyPage.tsx` (não em `AppLayout`) é a leitura correta: quando o Épico 4+ trouxer outras superfícies com criação de tarefa (Weekly/Monthly Log), cada uma implementa seu próprio listener local com o mesmo guard, sem acoplar ao layout. Copiar literalmente o padrão de guard de `AppLayout.tsx:26-37` (checar `INPUT`/`TEXTAREA`/`isContentEditable` antes de agir) — sem esse guard, digitar a letra "n" em qualquer campo de texto da página dispararia o atalho.

### Previous Story Intelligence (3.2 — done)

- Stack confirmada, sem novidade: Django 5.2 + DRF + `uv`; Node 22 + Vite + React 19 + MUI 6.1 + TanStack Query 5.59. Nenhuma dependência nova necessária (sem `react-hook-form`/`zod` no projeto — os formulários existentes, ex. `LoginPage.tsx`, usam `useState` controlado por campo; seguir o mesmo padrão no painel de detalhe, não introduzir uma lib de formulário nova sem necessidade).
- `bujo/serializers.py`, `bujo/views.py`, `bujo/urls.py` já existem (criados na 3.2) — **estender**, não recriar. `bujo/services/logs.py` e `state_machine.py` não mudam nesta story; `services/tasks.py` é o único arquivo novo de serviço.
- `TaskRow.tsx`/`DailyPage.tsx`/`useDailyData.ts`/`api.ts`/`types.ts` (feature `bujo`, `pages/daily`) já existem — estender, não recriar. Padrão de `useOptimisticMutation` já estabelecido e testado (3.2) — reusar literalmente, sem otimismo artesanal (§6.5 proíbe).
- Query key **sem `userId`** (`keys.bujo.todayLog()`) — decisão da 3.2, ainda válida (nenhum accessor de `userId` existe no frontend). Todas as novas mutações desta story usam a mesma chave, nenhuma chave nova em `keys.ts`.
- Bugs de infraestrutura da 3.2 (middleware de tenant + double-prefix `/api/api`) já corrigidos e commitados — não deveriam reaparecer, mas se `GET /api/bujo/logs/today/` retornar 500 com JWT real durante a verificação manual desta story, conferir primeiro se é uma regressão dessas correções antes de investigar como bug novo.

### Git Intelligence

- Branch `main`; HEAD em `1929ce7` (Story 3.2 commitada, working tree limpo). Convenção de commit: `"feat(story-X.Y): <descrição em pt-BR>"`.
- `backend/bujo/services/tasks.py` não existe — criar. `frontend/src/features/bujo/components/AddTaskRow.tsx` e `TaskDetailPanel.tsx` não existem — criar. `frontend/src/features/bujo/taskTree.ts` não existe — criar.

### Project Structure Notes

- Backend: `bujo/services/` ganha um terceiro módulo (`tasks.py`), ao lado de `logs.py`/`state_machine.py` — mesmo padrão de "pacote `<app>/services/<agregado>.py`" do §6.2. Nenhuma alteração em `bujo/models.py`.
- Frontend: `features/bujo/components/` ganha `AddTaskRow.tsx` e `TaskDetailPanel.tsx`; `features/bujo/` ganha `taskTree.ts` (helper puro, sem componente). Nenhum diretório novo — tudo dentro da árvore já estabelecida na 3.2.
- Nenhum conflito entre o schema desta story e a árvore de projeto — mudança é só em serializers/views/services/frontend, schema já congelado desde a 3.1.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3 (linhas 579-600)]
- [Source: _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md#FR-1.3 (linha 176), FR-1.4, FR-1.6]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-03 (linhagem/schema de tasks), AD-08 (subtarefas — árvore auto-referencial, linhas 463-524), §6.1 (nomenclatura), §6.2 (camada de serviço/estrutura), §6.3 (camelCase), §6.4 (erros/404), §6.5 (mutação otimista/query keys), §6.6 (validação na fronteira), §6.7 (tenant), §6.10 (Reference Implementations), §7.1 (árvore do projeto)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/EXPERIENCE.md §4.1 (linha 172 — campos do painel de detalhe), §6.1 (atalho `N`, linha 434; Enter salva e abre nova linha, linha 450), §6.2 (tap mobile abre painel/bottom sheet), §7.1 (Esc fecha modal/painel), §8.1 (painel lateral desktop, linha 512), §8.3 (bottom sheet mobile, linha 529)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/DESIGN.md §7.1 (Task Row — subtarefas expandem verticalmente, linha 351)]
- [Source: _bmad-output/implementation-artifacts/3-2-superficie-do-daily-log-com-task-row-e-ciclo-de-estados.md#Dev Notes — padrões de view fina/404, query key sem userId, bugs de infra corrigidos]
- [Source: backend/bujo/models.py — schema `Task` já congelado (`description`, `category`, `eisenhower`, `parent_task`, `related_name="subtasks"`) desde a 3.1]
- [Source: backend/bujo/services/state_machine.py, logs.py — padrão de assinatura de serviço a seguir em `tasks.py`]
- [Source: backend/bujo/serializers.py, views.py, urls.py — arquivos existentes a estender, não recriar]
- [Source: backend/core/exceptions.py#DomainError/custom_exception_handler — taxonomia de erro, mapa 400/404/409]
- [Source: backend/core/calendar.py#today_for, core/tenant.py — autoridade temporal e escopo de tenant]
- [Source: frontend/src/features/bujo/{api,types,index}.ts, components/TaskRow.tsx — código existente a estender]
- [Source: frontend/src/shared/hooks/useOptimisticMutation.ts — wrapper canônico de mutação otimista, reusar sem variação]
- [Source: frontend/src/api/keys.ts — `keys.bujo.todayLog()` já existe, nenhuma chave nova necessária]
- [Source: frontend/src/app/layout/AppLayout.tsx:22-41 — padrão de atalho de teclado com guard `isEditable`, replicar para `N`]
- [Source: frontend/src/features/auth/components/LoginPage.tsx — padrão de formulário controlado por `useState` (sem lib de formulário)]
- [Source: frontend/src/pages/daily/DailyPage.tsx, useDailyData.ts — página existente a estender]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- Verificação manual (Task 7.7) via Playwright headless contra `npm run dev` + backend real (Neon Postgres de dev): round-trip de criação/edição de tarefa levou ~2-5s neste ambiente (latência do Neon), não é regressão desta story — apenas exigiu esperas maiores no roteiro de verificação para não confundir otimismo de UI com persistência real.
- Bug encontrado e corrigido durante a verificação manual: o atalho `N` movia o foco para `AddTaskRow` dentro do mesmo `keydown`, mas sem `event.preventDefault()` o navegador ainda inseria o caractere "n" no campo recém-focado (ex.: título virava "nTarefa..."). Corrigido em `DailyPage.tsx` com `event.preventDefault()` antes do `focus()`; teste de regressão adicionado em `DailyPage.test.tsx`.

### Completion Notes List

- Backend: `bujo/services/tasks.py` novo (`create_task`/`update_task`, seguindo assinatura `*, user` de `state_machine.py`/`logs.py`); `order_index` calculado por irmãos (`log` + `parent_task`), nunca pelo pai. `TaskSerializer` estendido com `description`/`subtasks` (recursivo); `LogSerializer.tasks` trocado para `SerializerMethodField` filtrando só raízes (`parent_task__isnull=True`) — fecha o gap de duplicação de subtarefas identificado nos Dev Notes. `TaskCreateView`/`TaskDetailView`/`SubtaskCreateView` adicionadas em `views.py`/`urls.py`, seguindo o padrão fino de view + serviço + `Task.DoesNotExist` → `NotFound` já estabelecido na 3.2. Nenhuma migration — schema já congelado desde a 3.1.
- Contrato de API regenerado (`schema.yaml` + `types.gen.ts`); precisou de `@extend_schema_field` explícito em `TaskSerializer.get_subtasks`/`LogSerializer.get_tasks` (o campo recursivo `subtasks` seria inferido como `string` pelo drf-spectacular sem essa anotação, quebrando o tipo `Task.subtasks` no frontend).
- Frontend: `useCreateTaskMutation`/`useCreateSubtaskMutation`/`useUpdateTaskMutation` em `api.ts`, todas usando `useOptimisticMutation` com `keys.bujo.todayLog()` (nenhuma chave nova). `taskTree.ts` novo com `mapTaskTree` (atualização imutável em qualquer profundidade) e `findTaskById` (usado por `DailyPage` para localizar a tarefa aberta no painel). Componentes novos: `AddTaskRow.tsx` (genérico via prop `onAdd`, reaproveitado tanto para criar tarefa raiz quanto subtarefa) e `TaskDetailPanel.tsx` (`Drawer` `anchor="right"` desktop / `anchor="bottom"` mobile, campos salvam no `onBlur`/`onChange` do Select, input de subtarefa oculto quando a tarefa aberta já é uma subtarefa). `TaskRow.tsx` ganhou título clicável (`onOpenDetail`) e renderização recursiva de `subtasks` com indentação.
- Verificação manual ponta-a-ponta (Playwright headless contra backend real): criar tarefa via botão e via atalho `N`; abrir painel de detalhe desktop (painel lateral) e mobile (bottom sheet, viewport 375px); editar título/descrição/categoria/Eisenhower; adicionar 2 subtarefas; ciclar status de uma subtarefa confirmando que o pai não muda; fechar com Esc; recarregar a página e confirmar que título/descrição/categoria/Eisenhower/subtarefas persistiram. Encontrado e corrigido um bug real do atalho `N` (ver Debug Log). Nenhum outro problema funcional encontrado.
- Testes: 85 testes de backend (pytest) + 190 testes de frontend (vitest, incluindo jest-axe) passando; `ruff check`, `lint-imports`, `manage.py check`, `tsc --noEmit`, `eslint`, `vite build` todos limpos.

### Code Review (AI) — Correções Aplicadas

Achados (adversarial review) corrigidos automaticamente, todos em `frontend/`:

1. **File List incompleto (MEDIUM):** a story não listava a infra de E2E (Playwright) efetivamente commitada — `playwright.config.ts`, `e2e/fixtures.ts`, `e2e/daily-tasks.spec.ts`, além de `package.json`/`package-lock.json`/`eslint.config.js`/`vitest.config.ts`/`.gitignore` modificados para suportá-la. File List acima corrigido.
2. **`TaskDetailPanel` — dropdown de Eisenhower duplicava "Nenhum" (MEDIUM):** `EISENHOWER_LABEL` inclui a chave `none` (enum `Task.Eisenhower.NONE`, rótulo "Nenhum") e o componente também renderizava um `MenuItem value=""` manual com o mesmo rótulo — dois itens visualmente idênticos ("Nenhum") mas com valores diferentes por trás (`""` → `null` vs `"none"`). Corrigido filtrando `none` da lista mapeada, já que o item em branco cobre o mesmo caso (mesmo tratamento de `TaskRow.eisenhowerChipInfo`, que já trata `null`/`"none"` como equivalentes). Teste de regressão adicionado.
3. **`TaskDetailPanel` — título esvaziado não revertia visualmente (MEDIUM):** esvaziar o campo Título e sair (blur) corretamente não persistia (título é obrigatório), mas deixava o campo em branco na tela mesmo com a tarefa intacta no servidor — enquanto o painel seguisse aberto, título exibido e título salvo ficavam dessincronizados. Corrigido: blur com título vazio agora reverte o campo para `task.title`. Teste de regressão adicionado.
4. **`DailyPage` — atalho `N` sequestrava Ctrl+N/Cmd+N do navegador (MEDIUM):** o listener global de teclado não verificava teclas modificadoras antes de `preventDefault()`, então Ctrl+N/Cmd+N (atalho nativo de "nova janela") era bloqueado sempre que o foco não estivesse em um campo editável. Corrigido com um guard early-return para `ctrlKey`/`metaKey`/`altKey`. Teste de regressão adicionado.
5. **`TaskDetailPanel` — `aria-label` nos `Select` de Categoria/Eisenhower violava ARIA (MEDIUM, achado via jest-axe ao testar o componente real):** `aria-label` passado direto como prop do MUI `Select` aterrissa no `div` wrapper (`MuiInputBase-root`, sem `role`), não no `div[role="combobox"]` interno — `axe-core` acusa `aria-prohibited-attr` ("aria-label attribute cannot be used on a div with no valid role attribute"). Esse teste nunca rodou antes porque `DailyPage.test.tsx` mocka `TaskDetailPanel` inteiro para o próprio check de a11y (Task 7.4), então o componente real nunca foi varrido pelo jest-axe. Corrigido movendo o `aria-label` para `inputProps` (aterrissa no elemento com `role="combobox"` de fato). Teste de a11y dedicado adicionado em `TaskDetailPanel.test.tsx` cobrindo o componente real (não mockado).

Todos os testes de frontend (194, incluindo os 4 novos) + `tsc --noEmit` + `eslint` + `vite build` re-executados após as correções — limpos. Backend não foi alterado nesta rodada (`pytest` 167 passed, `ruff`, `lint-imports`, `manage.py check` re-confirmados sem regressão). `schema.yaml`/`types.gen.ts` conferidos como já sincronizados com o backend atual (regeneração local não produziu diff).

### File List

**Backend:**
- `backend/bujo/services/tasks.py` (novo)
- `backend/bujo/serializers.py` (modificado)
- `backend/bujo/views.py` (modificado)
- `backend/bujo/urls.py` (modificado)
- `backend/bujo/tests/test_services.py` (modificado)
- `backend/bujo/tests/test_serializers.py` (modificado)
- `backend/bujo/tests/test_views.py` (modificado)

**Contrato de API:**
- `schema.yaml` (regenerado)
- `frontend/src/api/types.gen.ts` (regenerado)

**Frontend:**
- `frontend/src/features/bujo/api.ts` (modificado)
- `frontend/src/features/bujo/api.test.tsx` (modificado)
- `frontend/src/features/bujo/index.ts` (modificado)
- `frontend/src/features/bujo/taskTree.ts` (novo)
- `frontend/src/features/bujo/taskTree.test.ts` (novo)
- `frontend/src/features/bujo/components/AddTaskRow.tsx` (novo)
- `frontend/src/features/bujo/components/AddTaskRow.test.tsx` (novo)
- `frontend/src/features/bujo/components/TaskDetailPanel.tsx` (novo)
- `frontend/src/features/bujo/components/TaskDetailPanel.test.tsx` (novo)
- `frontend/src/features/bujo/components/TaskRow.tsx` (modificado)
- `frontend/src/features/bujo/components/TaskRow.test.tsx` (modificado)
- `frontend/src/pages/daily/DailyPage.tsx` (modificado)
- `frontend/src/pages/daily/DailyPage.test.tsx` (modificado)
- `frontend/src/app/router.test.tsx` (modificado — mock de `useCreateTaskMutation`/`TaskDetailPanel`)
- `frontend/src/app/layout/RouteAnnouncer.test.tsx` (modificado — mock de `useCreateTaskMutation`/`TaskDetailPanel`)

**Infra de teste E2E (Playwright — suporte à verificação manual da Task 7.7, faltava neste File List):**
- `frontend/playwright.config.ts` (novo)
- `frontend/e2e/fixtures.ts` (novo)
- `frontend/e2e/daily-tasks.spec.ts` (novo)
- `frontend/package.json` (modificado — dependência `@playwright/test` + script `test:e2e`)
- `frontend/package-lock.json` (modificado)
- `frontend/eslint.config.js` (modificado — regras para `e2e/**`)
- `frontend/vitest.config.ts` (modificado — exclui `e2e/**` da coleta do Vitest)
- `.gitignore` (modificado — artefatos do Playwright)

## Change Log

- 2026-07-07: Implementação completa da Story 3.3 (Tasks 1-7) — serviço `tasks.py`, serializers/views/urls de criação e edição, contrato de API regenerado, mutações e componentes de frontend (AddTaskRow, TaskDetailPanel, subtarefas aninhadas em TaskRow), suíte de testes (85 backend + 190 frontend) e verificação manual ponta-a-ponta. Corrigido bug do atalho `N` (vazamento de caractere) encontrado durante a verificação manual.
- 2026-07-07: Code review (AI) — 4 achados MEDIUM corrigidos automaticamente (ver "Code Review (AI) — Correções Aplicadas" acima): File List desatualizado (infra E2E Playwright não documentada), dropdown de Eisenhower duplicando "Nenhum", título do painel de detalhe não revertendo ao esvaziar e sair do campo, atalho `N` sequestrando Ctrl+N/Cmd+N, e `aria-label` inválido nos `Select` de Categoria/Eisenhower (achado por jest-axe testando o componente real, não mockado). 0 issues CRITICAL. Suíte de frontend 194 testes + typecheck + lint + build revalidados; backend sem alteração nesta rodada (167 testes + ruff + lint-imports + manage.py check revalidados). Status → done.
