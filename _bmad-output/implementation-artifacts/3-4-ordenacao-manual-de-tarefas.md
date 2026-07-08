---
baseline_commit: 9ad645f149ec3726ebd1189cc93fb0e964cbdb98
---

# Story 3.4: Ordenação manual de tarefas

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero reordenar manualmente as tarefas do log,
Para que a ordem reflita minha intenção de execução, não um algoritmo (FR-1.6, UX-DR2).

## Acceptance Criteria

1. **Drag-and-drop no desktop**
   - **Dado que** o Daily Log no desktop,
   - **Quando** Hugo arrasta uma tarefa pelo drag handle,
   - **Então** a posição é atualizada via `order_index` com linha horizontal indicando o destino, persistida no servidor,
   - **E** não há reordenação automática por nenhum algoritmo.

2. **"Mover para..." no mobile**
   - **Dado que** o mobile,
   - **Quando** Hugo faz long-press numa tarefa,
   - **Então** o menu de contexto oferece "Mover para..." com posição relativa (acima de / abaixo de) — sem drag-and-drop,
   - **E** a nova ordem persiste e é refletida ao reabrir o log.

## Tasks / Subtasks

- [x] **Task 1: Camada de serviço — `reorder_task`** (AC: #1, #2)
  - [x] 1.1 Em `backend/core/exceptions.py`, adicionar `InvalidReorderTarget(DomainError)` ao lado de `InvalidTransition` (mesmo padrão — plain `Exception`, mapeada automaticamente para 409 pelo branch genérico `DomainError` já existente em `custom_exception_handler`, **sem** precisar de caso especial novo):
    ```python
    class InvalidReorderTarget(DomainError):
        """Reorder pedido contra um alvo que não é irmão da tarefa movida (Story 3.4)."""

        def __init__(self, task_id, target_task_id):
            self.task_id = task_id
            self.target_task_id = target_task_id
            super().__init__(f"Invalid reorder target: {task_id} -> {target_task_id}")
    ```
  - [x] 1.2 Em `backend/bujo/services/tasks.py` (arquivo existente desde a 3.3 — estender, não recriar), adicionar `reorder_task`, mesma assinatura `*, user` primeiro kwarg (§6.2). Reposiciona `task` como vizinha imediata de `target_task_id` (`position="before"` ou `"after"`), recalculando `order_index` por bisseção (ponto médio entre os dois vizinhos que vão ladear a tarefa após o move — mesma filosofia de índice fracionário já usada em `create_task`, que soma `+1.0` ao máximo):
    ```python
    from core.exceptions import InvalidReorderTarget

    @transaction.atomic
    def reorder_task(*, user, task_id, target_task_id, position) -> Task:
        if str(task_id) == str(target_task_id):
            raise InvalidReorderTarget(task_id, target_task_id)
        task = Task.objects.get(id=task_id)      # objects = auto-escopado por tenant
        target = Task.objects.get(id=target_task_id)  # idem — DoesNotExist -> 404 na view

        siblings = list(
            Task.objects.filter(log=task.log, parent_task=task.parent_task)
            .exclude(id=task.id)
            .order_by("order_index")
        )
        if target not in siblings:
            # `target` existe (passou no .get() acima, escopado por tenant) mas
            # não é irmão de `task` (log ou parent_task diferentes) — 409, não 404.
            raise InvalidReorderTarget(task_id, target_task_id)

        idx = siblings.index(target)
        if position == "after":
            neighbor = siblings[idx + 1] if idx + 1 < len(siblings) else None
            low, high = target.order_index, (neighbor.order_index if neighbor else None)
        else:  # "before"
            neighbor = siblings[idx - 1] if idx > 0 else None
            low, high = (neighbor.order_index if neighbor else None), target.order_index

        if low is None:
            new_order = high - 1.0
        elif high is None:
            new_order = low + 1.0
        else:
            new_order = (low + high) / 2

        task.order_index = new_order
        task.save(update_fields=["order_index", "updated_at"])
        return task
    ```
  - [x] 1.3 `siblings` é escopado por `log` **e** `parent_task` idênticos — mesma regra de AD-08 item 12 já usada em `create_task` (Story 3.3): reordenar uma subtarefa nunca a coloca em disputa de posição com a tarefa-pai ou com filhos de outro pai. Isso significa que `reorder_task` funciona tanto para tarefas raiz quanto para subtarefas **sem branch especial** — mas a UI desta story só aciona reorder em tarefas raiz (ver Dev Notes "Escopo: reorder é raiz-only nesta story").
  - [x] 1.4 `backend/bujo/tests/test_services.py`: `reorder_task` com `position="after"` calcula o ponto médio entre o alvo e o vizinho seguinte; `position="before"` idem com o vizinho anterior; mover para o início da lista (`before` do primeiro irmão, sem vizinho anterior) resulta em `order_index` menor que todos; mover para o fim (`after` do último irmão) resulta em `order_index` maior que todos; `target_task_id == task_id` levanta `InvalidReorderTarget`; `target_task_id` de uma tarefa que não é irmã (outro `log` ou outro `parent_task`) levanta `InvalidReorderTarget`; reorder de uma subtarefa só considera as subtarefas irmãs sob o mesmo pai (não compete com tarefas raiz); escopado por tenant (mesmo padrão de `test_create_task_escopado_por_tenant`/`test_update_task_escopado_por_tenant` — `task_id` ou `target_task_id` de outro tenant → `Task.DoesNotExist`).

- [x] **Task 2: Serializer + view + URL** (AC: #1, #2)
  - [x] 2.1 Em `backend/bujo/serializers.py`, adicionar:
    ```python
    class TaskReorderSerializer(serializers.Serializer):
        target_task_id = serializers.UUIDField()
        position = serializers.ChoiceField(choices=["before", "after"])
    ```
  - [x] 2.2 Em `backend/bujo/views.py`, adicionar `TaskReorderView(APIView)` — mesmo padrão fino de `TaskTransitionView` (try/except único cobre tanto `task_id` quanto `target_task_id`, já que ambos passam por `Task.objects.get` dentro do serviço):
    ```python
    class TaskReorderView(APIView):
        @extend_schema(request=TaskReorderSerializer, responses=TaskSerializer)
        def post(self, request, pk):
            body = TaskReorderSerializer(data=request.data)
            body.is_valid(raise_exception=True)
            try:
                task = reorder_task(
                    user=request.user,
                    task_id=pk,
                    target_task_id=body.validated_data["target_task_id"],
                    position=body.validated_data["position"],
                )
            except Task.DoesNotExist:
                raise NotFound() from None
            return Response(TaskSerializer(task).data)
    ```
    Importar `reorder_task` de `bujo.services.tasks` e `TaskReorderSerializer` de `bujo.serializers` nos imports do topo do arquivo.
  - [x] 2.3 Em `backend/bujo/urls.py`, adicionar (preservando as rotas existentes):
    ```python
    path("tasks/<uuid:pk>/reorder/", TaskReorderView.as_view(), name="bujo-task-reorder"),
    ```
  - [x] 2.4 `backend/bujo/tests/test_views.py`: `POST /api/bujo/tasks/{id}/reorder/` com `{targetTaskId, position}` válido move a tarefa (200, `order_index` mudou no banco); `targetTaskId` de outro tenant → 404; `targetTaskId` == `id` da própria tarefa → 409; `targetTaskId` de uma tarefa que não é irmã (log diferente ou pai diferente) → 409; `position` fora de `["before", "after"]` → 400; `targetTaskId` ausente do body → 400.

- [x] **Task 3: Regenerar o contrato de API** (AC: #1, #2)
  - [x] 3.1 `cd backend && uv run python manage.py spectacular --file ../schema.yaml`
  - [x] 3.2 `cd frontend && npm run generate-types`
  - [x] 3.3 Confirmar que o step de CI "Verificar types.gen.ts está atualizado" (Story 1.4) passa sem diff

- [x] **Task 4: Camada de dados do frontend — mutação de reorder + helper de árvore** (AC: #1, #2)
  - [x] 4.1 Em `frontend/src/features/bujo/taskTree.ts` (arquivo existente desde a 3.3 — estender, não recriar), adicionar `reorderTaskTree`, seguindo o mesmo estilo puro/imutável de `mapTaskTree`/`findTaskById`. Reordena dentro do array onde **ambos** `taskId` e `targetTaskId` aparecem como filhos diretos (raiz ou o mesmo nível de subtarefas); se não encontrar ambos no nível atual, recorre em `subtasks` de cada item (mesma estratégia recursiva de `mapTaskTree`):
    ```typescript
    export function reorderTaskTree(
      tasks: Task[],
      taskId: string,
      targetTaskId: string,
      position: 'before' | 'after',
    ): Task[] {
      const hasBoth = tasks.some((t) => t.id === taskId) && tasks.some((t) => t.id === targetTaskId)
      if (hasBoth) {
        const dragged = tasks.find((t) => t.id === taskId)!
        const rest = tasks.filter((t) => t.id !== taskId)
        const targetIndex = rest.findIndex((t) => t.id === targetTaskId)
        const insertAt = position === 'before' ? targetIndex : targetIndex + 1
        return [...rest.slice(0, insertAt), dragged, ...rest.slice(insertAt)]
      }
      return tasks.map((task) => ({
        ...task,
        subtasks: reorderTaskTree(task.subtasks ?? [], taskId, targetTaskId, position),
      }))
    }
    ```
  - [x] 4.2 Em `frontend/src/features/bujo/api.ts`, adicionar `useReorderTaskMutation()` — mesmo padrão de `useOptimisticMutation` com `queryKey: keys.bujo.todayLog()` (nenhuma chave nova):
    ```typescript
    interface ReorderTaskVariables {
      taskId: string
      targetTaskId: string
      position: 'before' | 'after'
    }

    async function reorderTask({ taskId, targetTaskId, position }: ReorderTaskVariables): Promise<Task> {
      const response = await client.post<Task>(`/api/bujo/tasks/${taskId}/reorder/`, {
        targetTaskId,
        position,
      })
      return response.data
    }

    export function useReorderTaskMutation() {
      return useOptimisticMutation<Task, unknown, ReorderTaskVariables, Log>({
        mutationFn: reorderTask,
        queryKey: keys.bujo.todayLog(),
        updater: (current, { taskId, targetTaskId, position }) => {
          if (!current) return current as unknown as Log
          return { ...current, tasks: reorderTaskTree(current.tasks, taskId, targetTaskId, position) }
        },
      })
    }
    ```
  - [x] 4.3 Exportar `useReorderTaskMutation` em `frontend/src/features/bujo/index.ts` (barrel — só api/hooks/types, §7.2).
  - [x] 4.4 `frontend/src/features/bujo/taskTree.test.ts` (estender): `reorderTaskTree` move um item para antes/depois de outro na raiz; mesma coisa dentro de um array de `subtasks` (mesmo nível); não altera nada quando `taskId`/`targetTaskId` não coexistem em nenhum nível.
  - [x] 4.5 `frontend/src/features/bujo/api.test.tsx` (estender): sucesso + otimismo + rollback de `useReorderTaskMutation`, seguindo o harness já usado para as outras mutações do arquivo.

- [x] **Task 5: Drag-and-drop no desktop (`TaskRow` + `DailyPage`)** (AC: #1)
  - [x] 5.1 **Decisão de escopo — sem nova dependência.** Não há lib de drag-and-drop no projeto (`frontend/package.json` não tem `@dnd-kit`/`react-dnd`/similar) e nada na arquitetura prescreve uma. Implementar com a **API nativa HTML5 Drag and Drop** (`draggable`, `onDragStart`/`onDragOver`/`onDrop`/`onDragEnd`) — sem adicionar dependência nova, mesma filosofia de "não introduzir lib sem necessidade" já aplicada a formulários na 3.3 (Dev Notes da 3.3, "Previous Story Intelligence"). Suficiente para o requisito: reordenar uma lista plana com indicador de linha, restrito a mouse/desktop.
  - [x] 5.2 Em `TaskRow.tsx`, adicionar props opcionais `siblings?: Task[]` e `onReorder?: (taskId: string, targetTaskId: string, position: 'before' | 'after') => void`. Ambas só são passadas pelo `DailyPage.tsx` para as linhas **raiz** (não para a chamada recursiva de subtarefas em `TaskRow` — ver 5.6/Dev Notes "Escopo: reorder é raiz-only"). Um `const isReorderable = Boolean(onReorder)` guarda toda a lógica nova abaixo.
  - [x] 5.3 Drag handle: `DragIndicatorIcon` (mesmo ícone "⠿" do mockup `key-daily-log-desktop.html`) renderizado só quando `isReorderable && !isMobile`, à direita da linha (depois dos chips). Visível ao hover via CSS (`opacity: 0` por padrão, `'&:hover .drag-handle': { opacity: 1 }` no `Box` da linha — EXPERIENCE.md §4 item 5 "visível ao hover (desktop)"), `cursor: 'grab'`. O `<Box>` da linha (não o ícone) recebe `draggable={isReorderable && !isMobile}` e os handlers abaixo — a alça só precisa capturar `onMouseDown` para não competir com o clique no título, mas o `draggable` do HTML5 DnD funciona no elemento inteiro; se o dev-story achar mais robusto restringir o `draggable` real só à área do ícone (evitando que arrastar pelo título dispare drag), usar essa abordagem — não é ambíguo quanto ao resultado visual, só a robustez de qual sub-elemento inicia o gesto.
  - [x] 5.4 Estado local `dragOverPosition: 'before' | 'after' | null` (por linha). Handlers no `Box` da linha:
    - `onDragStart(e)`: `e.dataTransfer.setData('text/plain', task.id)`, `e.dataTransfer.effectAllowed = 'move'`.
    - `onDragOver(e)`: `e.preventDefault()` (obrigatório para permitir `drop`); calcular se o cursor está na metade superior ou inferior da linha via `e.currentTarget.getBoundingClientRect()` vs `e.clientY`; `setDragOverPosition('before' | 'after')`.
    - `onDragLeave`: `setDragOverPosition(null)`.
    - `onDrop(e)`: `e.preventDefault()`; `const draggedId = e.dataTransfer.getData('text/plain')`; se `draggedId !== task.id`, chamar `onReorder!(draggedId, task.id, dragOverPosition ?? 'after')`; `setDragOverPosition(null)`.
    - `onDragEnd`: `setDragOverPosition(null)` (cleanup se o drop não aconteceu, ex. solto fora de qualquer linha).
  - [x] 5.5 Indicador visual: `Box` absoluto de 2px de altura (`bgcolor: 'primary.main'`), posicionado no topo (`top: 0`) ou na base (`bottom: 0`) da linha conforme `dragOverPosition`, renderizado só quando `dragOverPosition !== null` — mesma ideia de "linha horizontal indicando o destino" da AC1/EXPERIENCE.md linha 175.
  - [x] 5.6 Em `DailyPage.tsx`: `const reorder = useReorderTaskMutation()`; `function handleReorder(taskId: string, targetTaskId: string, position: 'before' | 'after') { reorder.mutate({ taskId, targetTaskId, position }) }`. Passar `siblings={tasks}` e `onReorder={handleReorder}` só nas linhas raiz (`tasks.map((task) => <TaskRow ... siblings={tasks} onReorder={handleReorder} />)`) — a chamada recursiva de subtarefas dentro do próprio `TaskRow.tsx` (linha ~156-163 hoje) **não** recebe essas props, então subtarefas continuam sem drag handle nesta story (ver Dev Notes).

- [x] **Task 6: "Mover para..." — mobile (long-press) e desktop (alternativa não-drag, WCAG 2.5.7)** (AC: #2)
  - [x] 6.1 **Requisito não-opcional derivado de WCAG 2.5.7 (Dragging Movements, AA) — mesma baseline estabelecida na Story 2.4.** Toda funcionalidade operada por gesto de arrastar precisa de uma alternativa de ponteiro único sem arrastar, em **qualquer** plataforma onde o drag é oferecido — não só no mobile. A AC2 já pede o fluxo "Mover para..." no mobile (via long-press); esta task exige o **mesmo diálogo, reaproveitado**, também acessível no desktop por clique (não drag), fechando o gap de acessibilidade que o drag-and-drop da Task 5 sozinho deixaria aberto para quem usa mouse/teclado/switch sem conseguir arrastar.
  - [x] 6.2 Criar `frontend/src/features/bujo/components/MoveTaskDialog.tsx` — `MUI Dialog` (funciona igual em desktop e mobile, sem necessidade de variante `Drawer`/bottom-sheet distinta; nenhum documento de UX exige bottom-sheet especificamente aqui, ao contrário do `TaskDetailPanel` na 3.3). Props:
    ```typescript
    interface MoveTaskDialogProps {
      task: Task
      siblings: Task[]
      open: boolean
      onMove: (targetTaskId: string, position: 'before' | 'after') => void
      onClose: () => void
    }
    ```
    Título: `Mover "{task.title}" para...`. Corpo: `List` com, para cada irmão em `siblings.filter((s) => s.id !== task.id)`, dois `ListItemButton`: "Acima de {sibling.title}" (`onClick` → `onMove(sibling.id, 'before')` seguido de `onClose()`) e "Abaixo de {sibling.title}" (`onMove(sibling.id, 'after')`). Lista vazia (só existe uma tarefa raiz) → `Dialog` não deveria nem abrir (ver 6.4/6.5, gate no chamador) ou mostrar um texto "Nenhuma outra tarefa para reordenar" — tratar o caso trivial sem quebrar.
  - [x] 6.3 Em `TaskRow.tsx`, estado local `moveDialogOpen: boolean`. Só relevante quando `isReorderable` (mesma flag da Task 5 — raiz apenas):
    - **Mobile (long-press):** handlers `onTouchStart`/`onTouchEnd`/`onTouchMove`/`onTouchCancel` no `Box` da linha, só ativos quando `isMobile && isReorderable`. `onTouchStart` arma `window.setTimeout(() => setMoveDialogOpen(true), 500)` (≥500ms — EXPERIENCE.md §6.2); `onTouchEnd`/`onTouchMove`/`onTouchCancel` cancelam o timer (`clearTimeout`) — long-press só dispara se o dedo ficar parado sem soltar por 500ms, um `touchmove` (scroll) cancela.
    - **Desktop (WCAG 2.5.7, Task 6.1):** um `IconButton` pequeno (`aria-label="Mover tarefa"`, ícone sugerido `MoreVertIcon` ou similar já usado no projeto) ao lado do drag handle, visível junto com ele (mesmo hover), `onClick={() => setMoveDialogOpen(true)}` — alcançável por teclado (Tab + Enter), sem depender de gesto de arrastar.
  - [x] 6.4 Renderizar `<MoveTaskDialog task={task} siblings={siblings ?? []} open={moveDialogOpen} onMove={(targetId, position) => { onReorder!(task.id, targetId, position); setMoveDialogOpen(false) }} onClose={() => setMoveDialogOpen(false)} />` só quando `isReorderable`.
  - [x] 6.5 `DailyPage.tsx`: nenhuma mudança adicional além da Task 5.6 — `siblings`/`onReorder` já passados cobrem tanto o drag quanto o `MoveTaskDialog`, já que ambos vivem dentro do mesmo `TaskRow`.

- [x] **Task 7: Testes de frontend + verificação manual** (AC: #1, #2)
  - [x] 7.1 `MoveTaskDialog.test.tsx` (novo): renderiza a lista de irmãos (excluindo a própria tarefa); clicar "Acima de X" chama `onMove(x.id, 'before')`; clicar "Abaixo de Y" chama `onMove(y.id, 'after')`; sem acessibilidade quebrada (`jest-axe`) com o diálogo aberto.
  - [x] 7.2 `TaskRow.test.tsx` (estender): `dragstart`/`dragover`/`drop` simulados entre duas linhas raiz chamam `onReorder` com `(draggedId, targetId, position)` correto conforme a metade da linha (topo → `before`, base → `after`); soltar sobre si mesma não chama `onReorder`; indicador de linha aparece/some conforme `dragOverPosition`; long-press simulado (fake timers, `vi.useFakeTimers()`, `onTouchStart` + avançar 500ms sem `onTouchEnd`) abre `MoveTaskDialog`; `onTouchMove` antes dos 500ms cancela o long-press; clique no botão "Mover tarefa" (desktop) abre o mesmo diálogo; nenhuma dessas props/comportamentos aparece quando `onReorder`/`siblings` não são passados (chamada recursiva de subtarefa, comportamento inalterado da 3.3).
  - [x] 7.3 `DailyPage.test.tsx` (estender): `handleReorder` chama `useReorderTaskMutation().mutate` com os argumentos repassados pelo `TaskRow`; `siblings`/`onReorder` chegam só nas linhas raiz.
  - [x] 7.4 `cd backend && uv run pytest && uv run ruff check . && uv run lint-imports && uv run python manage.py check` — 0 falhas/issues
  - [x] 7.5 `cd frontend && npm run typecheck && npm run lint && npm run build` — 0 erros
  - [x] 7.6 Verificação manual: `npm run dev`, logar, abrir `/today` com pelo menos 3 tarefas raiz. Desktop: arrastar a 3ª tarefa para cima da 1ª (linha indicadora aparece durante o drag), soltar, confirmar nova ordem e persistência ao recarregar; clicar no botão "Mover tarefa" (sem arrastar) e mover via diálogo, confirmar mesmo resultado. Redimensionar para viewport mobile (< 768px): long-press (≥500ms) numa linha, confirmar que o diálogo "Mover para..." abre, escolher "Abaixo de" outra tarefa, confirmar persistência ao recarregar. Confirmar que soltar/mover uma subtarefa **não** é possível nesta story (sem drag handle nem long-press nas linhas de subtarefa).

## Dev Notes

### Escopo: reorder é raiz-only nesta story (mesma linha da 3.3 para subtarefas)

O backend (`reorder_task`, Task 1) funciona para qualquer nível — `siblings` é escopado por `log` + `parent_task` idênticos, então tecnicamente já suporta reordenar subtarefas entre si. A **UI** desta story, no entanto, só expõe drag handle e "Mover tarefa"/long-press nas linhas **raiz** (`siblings`/`onReorder` só chegam pelo `DailyPage.tsx`, nunca pela chamada recursiva de subtarefas dentro de `TaskRow.tsx`). Isso segue exatamente o precedente da 3.3 ("Profundidade da árvore: schema arbitrário, UI de um nível nesta story") — decisão de escopo documentada, não limitação técnica. Se o dev-story achar mais simples estender para subtarefas (o serviço já suporta), não é proibido, mas não é exigido por nenhuma AC.

### WCAG 2.5.7 — por que a Task 6 não é "nice to have"

A AC2 já entrega o fluxo "Mover para..." no mobile, mas só para mobile. O drag-and-drop puro da AC1 (Task 5), se deixado como **única** forma de reordenar no desktop, viola WCAG 2.5.7 (Dragging Movements, nível AA — mesma baseline que a Story 2.4 estabeleceu para o projeto inteiro): qualquer funcionalidade operada por gesto de arrastar precisa de uma alternativa de ponteiro único sem arrastar, na mesma plataforma onde o drag é oferecido. A Task 6.3 fecha isso reaproveitando o `MoveTaskDialog` (o mesmo componente do mobile) atrás de um botão clicável no desktop — não é uma segunda implementação, é o mesmo diálogo com dois gatilhos diferentes (`onClick` no desktop, long-press no mobile).

### Por que HTML5 Drag and Drop nativo, não uma lib

Nenhuma lib de drag-and-drop está instalada (`@dnd-kit`, `react-dnd`, etc. ausentes de `frontend/package.json`) e a arquitetura não prescreve nenhuma. Dado o requisito real — reordenar uma lista plana e rasa (tarefas raiz do Daily Log) com um indicador de linha —, a API nativa (`draggable`, `dragstart`/`dragover`/`drop`) é suficiente e evita dependência nova, mesma filosofia da 3.3 ("sem `react-hook-form`/`zod` no projeto... seguir o mesmo padrão, não introduzir uma lib de formulário nova sem necessidade"). A API nativa não tem suporte a touch (por isso a AC2 explicitamente usa long-press + menu no mobile em vez de drag) e não é operável por teclado sozinha (por isso a Task 6 existe).

### Índice fracionário — trade-off aceito, sem normalização nesta story

`order_index` é `float` e o reorder sempre bisecciona entre dois vizinhos (mesmo padrão de índice fracionário que `create_task` já usa ao somar `+1.0` no fim da lista). Reordenar repetidamente entre os dois mesmos vizinhos milhares de vezes eventualmente esgotaria a precisão de um `float` de 64 bits — irrelevante para o padrão de uso real (algumas dezenas de reorders por dia, por usuário). Nenhuma tarefa de renormalização periódica é necessária nesta story; mesma classe de trade-off pragmático já aceito em AD-04 (wall-clock histórico).

### Contrato do endpoint — por que `target_task_id` + `position`, não um `order_index` direto no body

Aceitar um `order_index` calculado no cliente exigiria o cliente conhecer os `order_index` de **todos** os irmãos (para bissectar corretamente) e abriria uma janela de corrida entre dois clientes calculando índices baseados em estado desatualizado. `target_task_id` + `position` ("before"/"after" de uma tarefa específica) é a forma que tanto o drag desktop (a linha onde o drop aconteceu = target; metade superior/inferior = position) quanto o menu mobile ("acima de X" / "abaixo de Y") naturalmente produzem — o servidor sempre recalcula o `order_index` a partir do estado real no banco, dentro de `@transaction.atomic`.

### Reference: `reorder_task`/`TaskReorderView` (forma esperada — ver Tasks 1 e 2 para o código completo)

Mesma taxonomia de exceção do resto do app `bujo`: `Task.DoesNotExist` (tenant-scoped, `target_task_id`/`task_id` que não existem **para este usuário**) → `NotFound` (404) na view; `InvalidReorderTarget` (existe, mas não é irmã) → `DomainError` genérico → 409 automático via `custom_exception_handler` (nenhuma mudança no handler é necessária — só a subclasse nova em `exceptions.py`).

### Previous Story Intelligence (3.3 — done)

- Stack confirmada, sem novidade: Django 5.2 + DRF + `uv`; Node 22 + Vite + React 19 + MUI 6.1 + TanStack Query 5.59. `frontend/package.json` não ganhou nenhuma lib nova na 3.3 além de `@playwright/test` (infra de E2E) — esta story também não deveria precisar de dependência nova (ver "Por que HTML5 Drag and Drop nativo" acima).
- `bujo/services/tasks.py`, `serializers.py`, `views.py`, `urls.py` já existem — **estender**, não recriar. `services/state_machine.py`/`logs.py` não mudam nesta story.
- `TaskRow.tsx`/`DailyPage.tsx`/`taskTree.ts`/`api.ts`/`types.ts` (feature `bujo`) já existem — estender, não recriar. `useOptimisticMutation` é o wrapper canônico, reusar literalmente (§6.5) — nenhum otimismo artesanal.
- Query key sem `userId` (`keys.bujo.todayLog()`) — decisão da 3.2, ainda válida. Reorder usa a mesma chave, nenhuma chave nova em `keys.ts`.
- `TaskRow.tsx` hoje usa breakpoint `(max-width: 767px)` para `isMobile` (idêntico ao usado em `TaskDetailPanel.tsx`) — reusar o mesmo, não introduzir um breakpoint diferente para a lógica de drag/long-press.
- A 3.3 fechou 5 achados MEDIUM em code review (ver arquivo da 3.3, seção "Code Review (AI)") — nenhum é diretamente relevante aqui, mas o padrão geral (aria-label em campo real, não em wrapper `div`; guard de modificadoras em listeners de teclado globais) vale como lembrete de qualidade para os novos elementos interativos desta story (`IconButton` "Mover tarefa", `Dialog`).

### Git Intelligence

- Branch `main`; HEAD em `9ad645f` (Story 3.3 commitada, working tree limpo exceto um arquivo de orquestração do story-automator não relacionado a código). Convenção de commit: `"feat(story-X.Y): <descrição em pt-BR>"`.
- `backend/bujo/services/tasks.py`, `serializers.py`, `views.py`, `urls.py`, `core/exceptions.py` já existem — modificar, não recriar. `frontend/src/features/bujo/components/MoveTaskDialog.tsx` não existe — criar.

### Project Structure Notes

- Backend: nenhum arquivo novo — `reorder_task` entra em `bujo/services/tasks.py` (já existe), `TaskReorderSerializer` em `serializers.py`, `TaskReorderView` em `views.py`, rota em `urls.py`, `InvalidReorderTarget` em `core/exceptions.py`. Nenhuma migration (schema já congelado desde a 3.1 — `order_index` já existe).
- Frontend: `features/bujo/components/` ganha `MoveTaskDialog.tsx` (único arquivo novo de componente). `taskTree.ts`, `api.ts`, `index.ts`, `TaskRow.tsx`, `DailyPage.tsx` são todos modificações em arquivos existentes. Nenhum diretório novo.
- Nenhum conflito entre esta story e a árvore de projeto — schema já congelado, mudança é só em service/serializer/view/frontend.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.4 (linhas 602-618)]
- [Source: _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md#FR-1.6 (linha 186)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Schema de tasks (order_index, linha 174), §6.2 (camada de serviço/estrutura), §6.3 (camelCase), §6.4 (taxonomia de erro/exception handler), §6.5 (mutação otimista/query keys), §6.7 (tenant), §6.10 (Reference Implementations), §7.1 (árvore do projeto), §7.2 (fronteiras — features não se importam)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/EXPERIENCE.md §4 (Task Row — drag handle item 5, linha 152; comportamento hover/long-press/drag, linhas 172-177), §6.1 (drag-and-drop desktop + linha indicadora, linha 440), §6.2 (long-press ≥500ms mobile, linha 456-459), tabela de rastreabilidade FR-1.6 (linha 681)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/mockups/key-daily-log-desktop.html (linhas 407-413, 631, 723 — `.drag-handle`, glifo "⠿", `cursor: grab`)]
- [Source: WCAG 2.2 — Success Criterion 2.5.7 Dragging Movements (AA); baseline de acessibilidade do projeto estabelecida em _bmad-output/implementation-artifacts/2-4-baseline-de-acessibilidade-wcag-2-2-aa.md]
- [Source: _bmad-output/implementation-artifacts/3-3-criacao-e-edicao-de-tarefas-com-campos-completos-e-subtarefas.md#Dev Notes — precedente de escopo "UI de um nível" para subtarefas, decisão "sem lib de formulário nova sem necessidade", padrões de serviço/view/exceção]
- [Source: backend/bujo/models.py — `Task.order_index` (`FloatField`), `Task.Meta.ordering = ["order_index"]`, `parent_task`/`log` já congelados desde a 3.1]
- [Source: backend/bujo/services/tasks.py — `create_task` (padrão de índice fracionário `+1.0`), `update_task` (padrão de assinatura `*, user`)]
- [Source: backend/bujo/services/state_machine.py — padrão de exceção dedicada (`InvalidTransition`) a replicar como `InvalidReorderTarget`]
- [Source: backend/core/exceptions.py — `DomainError`/`custom_exception_handler`, branch genérico de `DomainError` → 409 (nenhuma mudança de handler necessária)]
- [Source: backend/bujo/tests/factories.py — `TaskFactory`/`LogFactory`, `order_index` sequencial]
- [Source: frontend/src/features/bujo/{api,taskTree,types,index}.ts, components/TaskRow.tsx, components/TaskDetailPanel.tsx — código existente a estender; `TaskDetailPanel.tsx` como referência de `Drawer`/`useMediaQuery`/breakpoint `767px`]
- [Source: frontend/src/shared/hooks/useOptimisticMutation.ts — wrapper canônico de mutação otimista, reusar sem variação]
- [Source: frontend/src/api/keys.ts — `keys.bujo.todayLog()` já existe, nenhuma chave nova necessária]
- [Source: frontend/src/pages/daily/DailyPage.tsx, useDailyData.ts — página existente a estender]
- [Source: frontend/package.json — confirmação de que nenhuma lib de drag-and-drop está instalada]

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

### Completion Notes List

- Task 1: `reorder_task` + `InvalidReorderTarget` implementados exatamente conforme o pseudocódigo da story (bisseção de `order_index` entre vizinhos). 9 testes novos em `test_services.py`, todos verdes.
- Task 2: `TaskReorderSerializer` + `TaskReorderView` + rota `tasks/<uuid:pk>/reorder/`. 6 testes novos em `test_views.py`, todos verdes.
- Task 3: `schema.yaml`/`types.gen.ts` regenerados — diff isolado ao novo endpoint `TaskReorder`/`PositionEnum`, sem alteração em nenhum contrato existente.
- Task 4: `reorderTaskTree` (puro/recursivo, mesmo estilo de `mapTaskTree`) + `useReorderTaskMutation` (mesmo `useOptimisticMutation`, sem chave nova). 4 testes novos em `taskTree.test.ts`, 2 em `api.test.tsx` (sucesso otimista + rollback), todos verdes.
- Task 5: Drag-and-drop desktop com API nativa HTML5 (`draggable`/`dragstart`/`dragover`/`drop`/`dragEnd`), sem dependência nova. Indicador de linha (2px, `primary.main`) no topo/base conforme metade da linha sob o cursor. `siblings`/`onReorder` só chegam pelas linhas raiz em `DailyPage.tsx`.
- Task 6: `MoveTaskDialog.tsx` (novo) reaproveitado por dois gatilhos — long-press ≥500ms no mobile (`onTouchStart`/`onTouchEnd`/`onTouchMove`/`onTouchCancel` com `setTimeout`/`clearTimeout`) e um `IconButton` "Mover tarefa" no desktop (WCAG 2.5.7 — alternativa de ponteiro único ao drag, alcançável por teclado).
- Task 7: `MoveTaskDialog.test.tsx` (novo, 5 testes incl. jest-axe), `TaskRow.test.tsx` estendido (+13 testes de drag/long-press/botão), `DailyPage.test.tsx` estendido (+2 testes de wiring). Suíte completa: 215 testes frontend / 182 testes backend, todos verdes; `typecheck`, `lint`, `build` (frontend) e `ruff`/`lint-imports`/`manage.py check` (backend) sem erros. Verificação manual via Playwright (script temporário, removido após uso): drag-and-drop persistiu após reload, diálogo "Mover tarefa" funcionou no desktop, e o mesmo diálogo abriu via long-press em viewport mobile (390×844) — 4 screenshots conferidos visualmente, todos confirmando o comportamento esperado.
- Dois arquivos de teste pré-existentes (`router.test.tsx`, `RouteAnnouncer.test.tsx`) mockavam `../../features/bujo` sem `useReorderTaskMutation`; adicionado o mock nos dois para não quebrar com o novo hook usado por `DailyPage`.
- `frontend/e2e/task-reorder.spec.ts` (novo, seguindo o padrão já estabelecido em `e2e/daily-tasks.spec.ts`): 4 testes E2E contra browser real + backend real (sem mocks de rede), cobrindo AC1 (drag-and-drop desktop com persistência após reload), a alternativa WCAG 2.5.7 no desktop (botão "Mover tarefa"), AC2 (long-press mobile) e o escopo raiz-only (subtarefa sem drag handle/botão). Não fazia parte do File List original — adicionado nesta revisão junto com a correção de discrepância git-vs-story.

### Code Review (AI)

- Revisão adversarial (story-automator review): implementação validada contra as 2 ACs e as 7 tasks — todas as claims de completude conferem (182 testes backend, 215 testes frontend, `ruff`/`lint-imports`/`manage.py check`/`typecheck`/`lint`/`build` sem erros, `schema.yaml` com diff isolado ao novo endpoint). `frontend/e2e/task-reorder.spec.ts` executado contra servidores reais: 4/4 testes verdes (isoladamente; um flake em execução paralela — timeout de reload sob contenção de recursos do dev server compartilhado — não reproduziu ao rodar sozinho, mesma classe de trade-off já aceita na infra E2E existente).
- Único achado: `frontend/e2e/task-reorder.spec.ts` (arquivo novo, untracked) não constava no File List apesar de criado durante a story — discrepância MEDIUM (documentação incompleta). Corrigido nesta revisão: arquivo adicionado ao File List abaixo.

### File List

- backend/core/exceptions.py
- backend/bujo/services/tasks.py
- backend/bujo/serializers.py
- backend/bujo/views.py
- backend/bujo/urls.py
- backend/bujo/tests/test_services.py
- backend/bujo/tests/test_views.py
- schema.yaml
- frontend/src/api/types.gen.ts
- frontend/src/features/bujo/taskTree.ts
- frontend/src/features/bujo/api.ts
- frontend/src/features/bujo/index.ts
- frontend/src/features/bujo/taskTree.test.ts
- frontend/src/features/bujo/api.test.tsx
- frontend/src/features/bujo/components/TaskRow.tsx
- frontend/src/features/bujo/components/TaskRow.test.tsx
- frontend/src/features/bujo/components/MoveTaskDialog.tsx
- frontend/src/features/bujo/components/MoveTaskDialog.test.tsx
- frontend/src/pages/daily/DailyPage.tsx
- frontend/src/pages/daily/DailyPage.test.tsx
- frontend/src/app/router.test.tsx
- frontend/src/app/layout/RouteAnnouncer.test.tsx
- frontend/e2e/task-reorder.spec.ts
