---
baseline_commit: e1b72fb6fcf6087e470b634694df7188521648b8
---

# Story 4.2: Migração diária com Migration Card e linhagem

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero revisar as tarefas pendentes de ontem uma a uma e decidir o destino de cada,
Para que nenhuma tarefa se mova sem minha decisão explícita, preservando a fricção intencional do método (FR-1.7, AR-14, UX-DR3).

## Acceptance Criteria

1. **Detecção e banner (FR-1.7)**
   - **Dado que** a abertura do dia com tarefas `pending`/`started` de ontem,
   - **Quando** o Daily Log carrega,
   - **Então** um banner informa "N tarefas pendentes de ontem. Iniciar migração?" com botão "Iniciar" — sem iniciar automaticamente,
   - **E** iniciar abre o Fluxo de Migração (modal overlay no desktop / full-screen no mobile) com um Migration Card por tarefa.

2. **Migration Card (UX-DR3)**
   - **Dado que** um Migration Card,
   - **Quando** exibido,
   - **Então** mostra título, descrição e subtarefas, indicador "N de M revisadas" (`aria-live=polite`) e 4 ações (Migrar para hoje / Adiar no mês / Adiar no futuro / Cancelar), nenhuma pré-selecionada, com atalhos `1`–`4` e `Esc` pausa (retomável),
   - **E** "Adiar no mês/futuro" abrem picker com confirmação automática (sem botão extra).

3. **Linhagem de migração (AD-03, AD-08 item 11)**
   - **Dado que** uma decisão de migração,
   - **Quando** Hugo escolhe um destino,
   - **Então** o registro original fica `status=migrated` com `migrated_to_task_id` apontando para o novo registro (`status=pending` no destino) e `migration_count` incrementado; migrar um pai recria no destino a subárvore de filhos ainda não-dispostos (concluídos/cancelados ficam na origem),
   - **E** o fluxo nunca é encerrado pelo sistema — só Hugo decide quando terminar.

## Tasks / Subtasks

> **Ordem de execução:** backend (serviço de migração → serializers/views/urls → contrato) antes do frontend (types → data layer → banner/modal → integração no Daily Log). A Task 3 (regenerar contrato) é o pivô, igual à 4.1.
>
> **⚠️ Guardrail codificado da retro Epic 3 (`_bmad/custom/bmad-dev-story.toml`):** ao escrever os testes do serviço de migração, o cenário "pai com filho concluído + filho pendente" (AD-08 item 11 — qual filho viaja, qual fica) deve ser o **PRIMEIRO teste escrito**, não um caso de borda adicionado depois.

- [x] **Task 1: Serviço de migração — `bujo/services/migration.py`** (AC: #3)
  - [x] 1.1 Criar `backend/bujo/services/migration.py` (novo — a árvore da arquitetura §7.1 já reserva `services/{state_machine,migration,catchup}.py`). Reusar `create_task`/`update_task` (`services/tasks.py`) e `transition_task` (`services/state_machine.py`) já existentes e testados — **não duplicar** a lógica de `order_index`/validação de transição. Assinatura pública:
    ```python
    @transaction.atomic
    def migrate_task(*, user, task_id, destination, month_first=None, scheduled_date=None) -> Task:
        """destination: "today" | "month" | "future" | "cancel".
        "today"  -> destino = Daily Log de hoje; origem vira MIGRATED.
        "month"  -> destino = Monthly Log do MÊS CORRENTE (month_first calculado
                     aqui via today_for, NUNCA aceito do cliente); scheduled_date
                     obrigatório; origem vira POSTPONED.
        "future" -> destino = Monthly Log de month_first (validado > mês corrente
                     na view); scheduled_date opcional; origem vira POSTPONED.
        "cancel" -> sem destino; origem vira CANCELLED via transition_task; sem
                     lineage (sem migrated_to_task, sem novo registro).
        """
        task = Task.objects.get(id=task_id)  # auto-escopado por tenant

        if destination == "cancel":
            return transition_task(user=user, task_id=task_id, to_status=Task.Status.CANCELLED)

        if destination == "today":
            container_field = "log"
            container = get_or_create_daily_log(user=user, log_date=today_for(user))
            new_status, root_scheduled_date = Task.Status.MIGRATED, None
        else:  # "month" ou "future"
            container_field = "monthly_log"
            container = get_or_create_monthly_log(user=user, month_first=month_first)
            new_status, root_scheduled_date = Task.Status.POSTPONED, scheduled_date

        _migrate_subtree(
            task, user=user, container_field=container_field, container=container,
            scheduled_date=root_scheduled_date, parent_task=None, new_status=new_status,
        )
        return Task.objects.get(id=task.id)  # recarrega com status/migrated_to_task atualizados
    ```
  - [x] 1.2 Helper privado `_migrate_subtree` (recursivo, implementa AD-08 item 11 — "migrar um pai recria no destino a subárvore de filhos ainda não-dispostos"). **Ordem importa:** transicionar a origem PRIMEIRO (fail-fast via `transition_task`, que já impõe a matriz `ALLOWED` — uma tarefa `completed`/`cancelled`/já `migrated`/`postponed` levanta `InvalidTransition` automaticamente, sem checagem manual duplicada) e só depois criar o novo registro:
    ```python
    def _migrate_subtree(source, *, user, container_field, container, scheduled_date, parent_task, new_status) -> Task:
        transition_task(user=user, task_id=source.id, to_status=new_status)  # fail-fast; ALLOWED já cobre isso
        new_task = create_task(
            user=user, parent_task=parent_task, scheduled_date=scheduled_date,
            title=source.title, description=source.description,
            eisenhower=source.eisenhower, category=source.category,
            **{container_field: container},
        )
        update_task(user=user, task_id=new_task.id, migration_count=source.migration_count + 1)
        update_task(user=user, task_id=source.id, migrated_to_task=new_task)

        pending_children = source.subtasks.filter(status__in=(Task.Status.PENDING, Task.Status.STARTED))
        for child in list(pending_children):
            _migrate_subtree(
                child, user=user, container_field=container_field, container=container,
                scheduled_date=None,  # subtarefa não carrega scheduled_date próprio
                parent_task=new_task, new_status=new_status,
            )
        return new_task
    ```
    Filhos `completed`/`cancelled` **não** são tocados (ficam na origem, já dispostos — não entram no filtro `pending_children`). `create_task` já calcula `order_index` por irmãos do mesmo container+`parent_task` — reaproveitado sem alteração. `update_task` (genérico, `setattr`+`save`) aceita `migration_count` (int) e `migrated_to_task` (instância de model) sem exigir mudança de assinatura.
  - [x] 1.3 **Decisão de status a confirmar/registrar (ambiguidade real entre documentos — ver Dev Notes "migrated vs. postponed"):** esta story usa `MIGRATED` só para "Migrar para hoje" e `POSTPONED` para "Adiar no mês"/"Adiar no Futuro". O texto da AC #3 em `epics.md` menciona genericamente `status=migrated` para "uma decisão de migração" (singular, cobrindo os 3 destinos) — mas `FR-1.4` e `AD-02` definem `migrada` e `adiada` como **estados distintos**, e o frontend (`TaskRow.tsx`) já tem ícones/labels diferentes para os dois (`ArrowForwardIcon`/"Migrada" vs `KeyboardDoubleArrowRightIcon`/"Adiada") desde a Story 4.1. Seguir a distinção FR-1.4/AD-02 (mais específica e coerente com o código já existente) é a leitura recomendada; **não** inventar um terceiro caminho. Se o code-review discordar, é uma mudança de uma linha (`new_status` no dispatcher da Task 1.1).

- [x] **Task 2: Serializers + views + URLs** (AC: #1, #2, #3)
  - [x] 2.1 Em `backend/bujo/serializers.py` (estender), adicionar:
    - `MigrationQueueSerializer` — `{ logDate, tasks }` (mesma forma de `LogSerializer`, mas só as tarefas-raiz `pending`/`started` do Daily Log de **ontem**).
    - `TaskMigrateSerializer` — write-only, valida a forma por `destination`:
      ```python
      class TaskMigrateSerializer(serializers.Serializer):
          destination = serializers.ChoiceField(choices=["today", "month", "future", "cancel"])
          month_first = serializers.DateField(required=False)
          scheduled_date = serializers.DateField(required=False, allow_null=True)

          def validate(self, attrs):
              destination = attrs["destination"]
              if destination == "month" and not attrs.get("scheduled_date"):
                  raise serializers.ValidationError({"scheduled_date": "Obrigatório para adiar no mês."})
              if destination == "future":
                  if not attrs.get("month_first"):
                      raise serializers.ValidationError({"month_first": "Obrigatório para adiar no futuro."})
                  if attrs["month_first"].day != 1:
                      raise serializers.ValidationError({"month_first": "Deve ser o primeiro dia do mês."})
                  scheduled_date = attrs.get("scheduled_date")
                  if scheduled_date and (scheduled_date.year, scheduled_date.month) != (
                      attrs["month_first"].year, attrs["month_first"].month
                  ):
                      raise serializers.ValidationError({"scheduled_date": "A data deve pertencer ao mês/ano de monthFirst."})
              return attrs
      ```
      (mesmo padrão de validação condicional de `MonthlyTaskCreateSerializer`, Story 4.1.) **Não** validar aqui que `future.month_first > mês corrente` — isso depende de `today_for(request.user)`, que é dado de view, não de serializer; validar na view (Task 2.2).
  - [x] 2.2 Em `backend/bujo/views.py` (estender), adicionar:
    - `MigrationQueueView(APIView)` GET: `yesterday = today_for(request.user) - timedelta(days=1)`; `log = Log.objects.filter(log_date=yesterday).first()` — **não** chamar `get_or_create_daily_log` aqui (não materializar o log de ontem se ele nunca existiu; ver Dev Notes). Se `log` é `None`, `tasks = Task.objects.none()`. Senão, `log.tasks.filter(status__in=[Task.Status.PENDING, Task.Status.STARTED], parent_task__isnull=True)`. Responde `MigrationQueueSerializer({"log_date": yesterday, "tasks": tasks}).data`.
    - `TaskMigrateView(APIView)` POST `tasks/<uuid:pk>/migrate/`: valida via `TaskMigrateSerializer`; se `destination == "month"`, calcula `month_first = today_for(request.user).replace(day=1)` **na view** (nunca aceitar `month_first` do cliente para este destino — "mês" é sempre o corrente, "futuro" é o único destino com mês escolhido pelo cliente); se `destination == "future"`, validar `validated["month_first"] > today_for(request.user).replace(day=1)` (senão `400`, "Use 'month' para o mês corrente."). Chama `migrate_task(...)`; `Task.DoesNotExist` → `NotFound()` (padrão já usado em `TaskTransitionView`/`TaskReorderView`). Responde `TaskSerializer(task).data`.
    - Ambas com `@extend_schema` explícito (padrão do arquivo).
  - [x] 2.3 Em `backend/bujo/urls.py` (estender, preservando as 9 rotas existentes):
    ```python
    path("migration/queue/", MigrationQueueView.as_view(), name="bujo-migration-queue"),
    path("tasks/<uuid:pk>/migrate/", TaskMigrateView.as_view(), name="bujo-task-migrate"),
    ```
  - [x] 2.4 `backend/bujo/tests/test_views.py` (estender): `GET /migration/queue/` sem Daily Log de ontem → `tasks: []` (e **confirmar que nenhum Log foi criado** — `Log.objects.count()` inalterado); com tarefas `pending`/`started`/`completed`/`cancelled` de ontem → só as duas primeiras aparecem, só raízes (subtarefa não aparece na fila, mesmo pendente). `POST /tasks/{id}/migrate/` — `destination=today` → tarefa aparece no Daily Log de hoje, origem `migrated`; `destination=month` sem `scheduledDate` → `400`; com `scheduledDate` no mês corrente → origem `postponed`, nova tarefa no Monthly Log corrente; `destination=future` com `monthFirst` do mês corrente → `400` (deve usar `month`); com `monthFirst` futuro e `scheduledDate` fora do mês → `400`; sem `scheduledDate` (só mês) → sucesso, tarefa no Monthly Log futuro sem dia; `destination=cancel` → origem `cancelled`, sem `migratedToTask`, nenhuma tarefa nova criada. Tarefa já `completed`/`cancelled`/`migrated` → `409` (`InvalidTransition`, via `transition_task` reaproveitado). Escopo por tenant em todos os casos.

- [x] **Task 3: Regenerar o contrato de API** (AC: #1, #2, #3)
  - [x] 3.1 `cd backend && uv run python manage.py spectacular --file ../schema.yaml`
  - [x] 3.2 `cd frontend && npm run generate-types`
  - [x] 3.3 Confirmar que o step de CI "Verificar types.gen.ts está atualizado" passa sem diff residual.
  - [x] 3.4 Esta story **não** toca `DEFAULT_AUTHENTICATION_CLASSES`/config de auth — confirmar no diff do `schema.yaml` que só entraram paths/schemas novos e que os blocos `security` dos endpoints existentes seguem intactos (guardrail retro Epic 3 §3, já verificado nas Stories 3.2/4.1).

- [x] **Task 4: Testes de serviço** (AC: #3)
  - [x] 4.1 **PRIMEIRO teste, antes de qualquer outro da Task 4** (guardrail `_bmad/custom/bmad-dev-story.toml`): `test_migrar_pai_recria_apenas_filhos_nao_dispostos` — pai com 2 filhos, um `completed` e um `pending`; migrar o pai (`destination="today"`) → destino tem o pai + o filho `pending` (recriados, `pending`, `migration_count` do pai/filho migrado = 1); o filho `completed` permanece na origem, intocado (mesmo `id`, mesmo `parent_task_id` apontando pro pai original agora `migrated`); a árvore original inteira (pai `migrated` + os 2 filhos originais) permanece na origem.
  - [x] 4.2 `backend/bujo/tests/test_services.py` (estender), demais casos de `migrate_task`: `destination="today"` — origem `migrated`, `migrated_to_task` aponta pro novo (`pending`, `log=daily de hoje`, `migration_count=1`); `destination="month"` — origem `postponed`, novo em `monthly_log` do mês corrente com `scheduled_date`; `destination="future"` — novo em `monthly_log` futuro, com e sem `scheduled_date`; `destination="cancel"` — origem `cancelled`, `migrated_to_task` permanece `None`, nenhum novo `Task` criado (contar `Task.objects.count()` antes/depois); migrar tarefa já `completed`/`migrated` → `InvalidTransition`; migração encadeada (migrar uma tarefa que já é sucessora de uma migração anterior) → `migration_count` soma corretamente (não reseta); subárvore de 2 níveis (pai → filho → neto, todos pendentes) migra a árvore inteira preservando a hierarquia no destino; escopo por tenant (`task_id` de outro usuário → `Task.DoesNotExist`).

- [x] **Task 5: Camada de dados do frontend** (AC: #1, #2, #3)
  - [x] 5.1 Em `frontend/src/api/keys.ts` (estender a seção `bujo`): `migrationQueue: () => ['bujo', 'migrationQueue', 'list'] as const,`.
  - [x] 5.2 Em `frontend/src/features/bujo/types.ts` (estender): exportar `MigrationQueue` via `components['schemas']['MigrationQueue']` (nome exato conforme `schema.yaml` gerado na Task 3 — conferir).
  - [x] 5.3 Em `frontend/src/features/bujo/api.ts` (estender):
    - `useMigrationQueueQuery()` — `useQuery` simples em `keys.bujo.migrationQueue()`, GET `/api/bujo/migration/queue/`.
    - `useMigrateTaskMutation()` — `useMutation` (não `useOptimisticMutation` — decisão deliberada como a `useCreateMonthlyTaskMutation` da 4.1: ação de fluxo dedicado, não clique de estado; ver Dev Notes). POST `/api/bujo/tasks/{taskId}/migrate/` com `{ destination, monthFirst?, scheduledDate? }`. `onSuccess` invalida por prefixo: `keys.bujo.migrationQueue()`, `keys.bujo.todayLog()`, e os prefixos de 2 elementos `['bujo','monthlyLog']`/`['bujo','futureLog']` (cobre todas as variantes de `monthFirst`, igual ao padrão de invalidação por prefixo de §6.5/6.9 — **não** invalidar só a chave exata do mês, teria que reconstruir qual `monthFirst` foi afetado).
  - [x] 5.4 Exportar os novos hooks em `frontend/src/features/bujo/index.ts` (barrel).
  - [x] 5.5 `frontend/src/features/bujo/api.test.tsx` (estender): `useMigrationQueueQuery` bate no endpoint certo; `useMigrateTaskMutation` com cada `destination` monta o payload certo e invalida as 4 chaves esperadas no `onSuccess`.

- [x] **Task 6: Componentes do Fluxo de Migração** (AC: #1, #2)
  - [x] 6.1 `frontend/src/features/bujo/components/MigrationBanner.tsx` (novo): usa `useMigrationQueueQuery()`; se `tasks.length === 0` (ou `isPending`) não renderiza nada; senão texto **exato** "N tarefas pendentes de ontem. Iniciar migração?" (`N` = `tasks.length`) + botão "Iniciar" que abre o `MigrationFlow` (estado local no componente pai — ver Task 7).
  - [x] 6.2 `frontend/src/features/bujo/components/MigrationCard.tsx` (novo): recebe uma `task` (readonly) + índice/total. Renderiza título, descrição (se houver), subtarefas (lista simples, sem interação — reusar a forma visual de `TaskRow` somente-leitura não é obrigatório, um layout mais simples/denso do Migration Card é aceitável), indicador `"{n} de {m} revisadas"` com `aria-live="polite"` (texto puro — **sem barra de progresso**, apesar do mockup `key-migration-modal-desktop.html` mostrar uma; `EXPERIENCE.md §4.2` é explícito: "texto, sem barra de progresso animada" — a regra escrita vence o mockup estático), 4 botões (Migrar para hoje / Adiar no mês / Adiar no Futuro / Cancelar) cada um com o atalho exibido discretamente (`1`–`4`), nenhum pré-selecionado/destacado. "Adiar no mês" e "Adiar no Futuro" abrem um picker inline (não um `Dialog` aninhado — UX-DR17 proíbe empilhamento de modal > 1 nível, e o Migration Card já está dentro de um `Dialog`):
    - Mês: `<input type="date">` com `min`/`max` = primeiro/último dia do mês corrente (reaproveitar `week_start_of`/mês corrente calculado no frontend a partir de `new Date()` local — **não** chamar `today_for` do backend aqui, é cálculo de UI, não autoridade de domínio); `onChange` já confirma a decisão (sem botão "OK" adicional).
    - Futuro: `<input type="month">` (obrigatório) + `<input type="number" min={1} max={31}>` opcional (mesmo padrão de `FutureLogItemForm.tsx`, Story 4.1 — "sem lib sem necessidade"). Como o dia é opcional e a AC exige confirmação automática "ao selecionar a data" sem botão extra, o `onChange` do **mês** dispara a decisão com o dia atualmente preenchido (ou `undefined`) — ordene os campos com o dia **antes** do mês na tab order para que, se Hugo quiser um dia específico, ele o preencha antes de escolher o mês. **Julgamento de UX documentado aqui porque a AC não especifica a interação exata entre os dois campos** — ajustar no code-review se a ordem confundir no teste manual.
  - [x] 6.3 `frontend/src/features/bujo/components/MigrationFlow.tsx` (novo): `Dialog` do MUI — **overlay real com backdrop**, não "full-page sem dialog" (ver Dev Notes "Modal overlay vs. full-page — conflito de documentos, resolvido a favor do mockup+EXPERIENCE.md"). Desktop: `Dialog` centralizado, `maxWidth="sm"`. Mobile (`useMediaQuery('(max-width: 767px)')`, breakpoint canônico já usado em `TaskRow`/`TaskDetailPanel`): `Dialog fullScreen`. Estado interno: `queue` (snapshot da lista recebida ao abrir — **não** refaz a query a cada decisão, só localmente avança o índice), `currentIndex`. Ao decidir uma ação: chama `useMigrateTaskMutation().mutate(...)`, então avança `currentIndex + 1`; se passou do fim, fecha o modal (a invalidação da Task 5.3 já atualizou `migrationQueue`, então reabrir "Iniciar" no banner não mostra mais essas tarefas). Teclado (nível do `Dialog`, listener global só enquanto aberto): `1`/`2`/`3`/`4` disparam as 4 ações (`2`/`3` abrem o picker em vez de confirmar direto); `Esc` fecha o modal **sem** decidir a tarefa atual (pausa, retomável — a tarefa continua na `migrationQueue`, então reabrir "Iniciar" a traz de volta); setas `↑`/`↓` movem o foco entre os 4 botões quando nenhum picker está aberto. Reusar o guard de `isEditable`/modificadores do atalho `N` em `DailyPage.tsx` como referência para não capturar teclado de dentro dos `<input>` do picker.
  - [x] 6.4 `frontend/src/features/bujo/index.ts`: exportar `MigrationBanner` (único componente que `pages/daily` precisa importar — `MigrationCard`/`MigrationFlow` ficam internos à feature, compostos pelo próprio `MigrationBanner` ou por um wrapper que já inclui o `Dialog` — decisão de composição do dev agent; o contrato público é só "renderizar o banner quando há fila").

- [x] **Task 7: Integração no Daily Log** (AC: #1)
  - [x] 7.1 Em `frontend/src/pages/daily/DailyPage.tsx`, renderizar `<MigrationBanner />` acima do `DayHeader` (dentro do `Box component="main"`). Não interfere no `useEffect` do atalho `N` já existente.
  - [x] 7.2 Confirmar que abrir a Daily Log **não** materializa o Log de ontem (mesma disciplina de verificação da 4.1 Task 9.6) — `MigrationQueueView` só faz `.filter(...).first()`, nunca `get_or_create`.

- [x] **Task 8: Testes de frontend + verificação manual** (AC: #1, #2, #3)
  - [x] 8.1 `MigrationBanner.test.tsx` (novo): não renderiza com fila vazia; renderiza texto exato com a contagem certa; clicar "Iniciar" abre o fluxo; `jest-axe`.
  - [x] 8.2 `MigrationCard.test.tsx` (novo): renderiza título/descrição/subtarefas; indicador "N de M revisadas" com o texto exato; clicar em cada uma das 4 ações chama o callback certo; picker de mês confirma automaticamente ao mudar; picker de futuro confirma com e sem dia; `jest-axe` contra o componente real.
  - [x] 8.3 `MigrationFlow.test.tsx` (novo): avança pelos cartões na ordem da fila; `Esc` fecha sem decidir (a tarefa atual não é chamada na mutação); atalhos `1`–`4` dão a mesma decisão que os cliques; fecha automaticamente após a última tarefa; `jest-axe`.
  - [x] 8.4 `DailyPage.test.tsx` (estender): banner aparece quando `useMigrationQueueQuery` retorna tarefas; abre o fluxo; some após a fila esvaziar (mock de invalidação/refetch).
  - [x] 8.5 `cd backend && uv run pytest && uv run ruff check . && uv run lint-imports && uv run python manage.py check` — rodar e colar a contagem **real** observada (não estimar — guardrail retro Epic 3 §1).
  - [x] 8.6 `cd frontend && npm run typecheck && npm run lint && npm run build && npm run test` — idem, colar a contagem real.
  - [x] 8.7 **Verificação manual contra backend+frontend reais** (`npm run dev` + backend, logado, seguindo o padrão Playwright já usado na 4.1): semear (via admin ou script) um Daily Log de ontem com 1 tarefa pai com um filho pendente e um filho concluído + 1 tarefa solta; abrir hoje → banner "3 tarefas pendentes de ontem"; iniciar migração → migrar a tarefa solta para hoje (confirma no Daily Log de hoje); adiar a tarefa pai no mês corrente com uma data → confirma no Monthly Log corrente (pai + só o filho pendente; filho concluído continua no Daily Log de ontem); banner some; reabrir a página confirma que o banner não reaparece (fila vazia). Confirmar que abrir a tela não materializou o Log de ontem quando ele não existia (testar em um dia sem log). Testar `Esc` no meio do fluxo com 2+ tarefas: modal fecha, banner ainda mostra a contagem restante, "Iniciar" retoma da tarefa não decidida. Zero erros de console.
  - [x] 8.8 **File List por último** (retro Epic 3 §8-2, guardrail ativo): `git status --short` + `git diff --stat` **depois** da verificação manual (8.7), reconciliar contra o File List documentado.

## Dev Notes

### Migrated vs. Postponed — ambiguidade real entre `epics.md` e `AD-02`/`FR-1.4` (decisão desta story)

O texto da AC #3 (`epics.md`, linhas 667-670) descreve genericamente "o registro original fica `status=migrated`" para **qualquer** destino (hoje/mês/futuro). Mas `FR-1.4` do PRD lista `migrada` e `adiada` como **dois estados distintos** de tarefa, e `AD-02`/`AD-03` tratam `migrated` e `postponed` como dois estados terminais separados (ambos incrementam `migration_count`, mas são valores diferentes de `status`). O frontend **já** distingue os dois visualmente desde a Story 3.1/4.1 (`TaskRow.tsx`: `migrated` → `ArrowForwardIcon`/"Migrada"; `postponed` → `KeyboardDoubleArrowRightIcon`/"Adiada"). Esta story resolve a ambiguidade a favor da distinção mais específica e já refletida no código: **"Migrar para hoje" → `status=migrated`; "Adiar no mês" e "Adiar no Futuro" → `status=postponed`.** "Cancelar" → `status=cancelled` (sem lineage, via `transition_task` direto, sem `migrated_to_task`). Se o code-review ou Hugo discordarem, é uma troca de uma linha no dispatcher de `migrate_task` (Task 1.1) — não uma mudança estrutural.

### Modal overlay vs. full-page — conflito de documentos, resolvido a favor do mockup + EXPERIENCE.md

`DESIGN.md §7.8` diz "Sem dialog overlay... implementado como surface que substitui o conteúdo principal (full-page flow)" — mas isso contradiz três outras fontes que concordam entre si: `epics.md` UX-DR3 ("modal overlay no desktop"), `EXPERIENCE.md §5.1`/Fluxo 1 ("Modal com Migration Card visível; conteúdo do Daily Log visível atrás — overlay semitransparente") e o mockup `mockups/key-migration-modal-desktop.html` (que implementa literalmente `role="dialog" aria-modal="true"` com `.modal-overlay` de `rgba(26,22,18,0.40)` e o conteúdo principal com `opacity: 0.45` atrás). Esta story segue a maioria + o artefato de composição real: **`Dialog` do MUI com backdrop** (desktop, `maxWidth="sm"`) e `Dialog fullScreen` (mobile) — não uma surface que substitui a página. `DESIGN.md §7.8` está desatualizado e pode ser corrigido num fechamento de gap futuro (não é bloqueante aqui, ao contrário do que aconteceu com `core/time.py` na 4.1 — lá o código já divergia do doc; aqui é só o doc que diverge de si mesmo).

### Indicador de progresso — texto, sem barra (EXPERIENCE.md vence o mockup)

O mockup mostra uma barra de progresso com percentual, mas `EXPERIENCE.md §4.2` é explícito: "Indicador de progresso: 'N de M tarefas revisadas' (texto, sem barra de progresso animada)". Regra escrita > ilustração estática — implementar só o texto.

### Escopo: só "ontem" (a generalização é a Story 4.4)

Esta story cobre **apenas** a fila de tarefas do Daily Log de **ontem** (`today_for(user) - 1 dia`). A revisão semanal/mensal (banners adicionais, Story 4.3) e o Catch-Up genérico para múltiplos dias pulados (Story 4.4, AD-09) são **fora de escopo** — não generalizar a query de `MigrationQueueView` para "qualquer log com data < hoje" agora; isso é exatamente o que a 4.4 faz depois, reaproveitando `migrate_task` (o serviço desta story é desenhado para ser reaproveitável por ela — não é preciso mudar nada aqui, só o *caller* muda na 4.4). Se o Daily Log de ontem nunca foi aberto (não existe `Log` para aquela data), a fila é vazia e nenhum banner aparece — **não** materializar o Log de ontem para checar (`MigrationQueueView` usa `.filter().first()`, nunca `get_or_create_daily_log`).

### Reaproveitamento obrigatório — não reinventar

`migrate_task` **não** duplica `order_index`/validação de transição — chama `create_task`, `update_task` (`services/tasks.py`) e `transition_task` (`services/state_machine.py`) tal como já existem, sem alterar suas assinaturas. `ALLOWED` (Story 3.1) já permite `pending`/`started` → `migrated`/`postponed`/`cancelled` — a validação de "só tarefas pendentes/iniciadas migram" vem de graça pela matriz existente (uma tarefa `completed` levanta `InvalidTransition` automaticamente ao chamar `transition_task`, sem checagem manual redundante em `migrate_task`).

### Container do destino — `month_first` nunca vem do cliente para `destination="month"`

Para "Adiar no mês", o mês é **sempre o corrente** — calculado na view via `today_for(request.user)`, nunca aceito do payload (evita o cliente rotular um mês arbitrário como "mês corrente"). Só `destination="future"` aceita `monthFirst` do cliente, e a view valida que é estritamente posterior ao mês corrente (senão `400` — "isso é 'month', não 'future'").

### Previous Story Intelligence (4.1 — done)

- Stack: Django 5.2 + DRF + `uv`; Node 22 + Vite + React 19 + MUI 6.1 + TanStack Query 5.59. Sem dependência nova (pickers nativos `<input type="date"|"month"|"number">`, mesma filosofia "sem lib sem necessidade" da 3.3/3.4/4.1).
- `bujo/services/tasks.py` (`create_task`/`update_task`/`reorder_task`), `services/state_machine.py` (`transition_task`, matriz `ALLOWED`), `services/logs.py` (`get_or_create_daily_log`/`get_or_create_monthly_log`/`get_or_create_weekly_log`) — todos **reaproveitados sem alteração** nesta story. `services/migration.py` é o único arquivo novo de serviço.
- `views.py`/`serializers.py`/`urls.py` — estender, não recriar (padrão view fina de todas as stories anteriores).
- Frontend: `keys.ts`/`types.ts`/`api.ts`/`index.ts` de `features/bujo` — estender. `MoveTaskDialog.tsx` é a referência mais próxima de "`Dialog` do MUI orquestrado a partir de `TaskRow`" já existente no projeto — útil como modelo de estrutura (`Dialog`+`List`/botões), embora o Migration Flow seja maior (multi-step, teclado). `useMediaQuery('(max-width: 767px)')` é o breakpoint canônico — reusar, não recriar.
- Invalidação por prefixo (`['bujo','monthlyLog']` sem o terceiro elemento) já é o padrão usado por `useCreateMonthlyTaskMutation` (4.1) — mesma técnica aqui para `useMigrateTaskMutation`.
- `jest-axe` só pega violações reais contra o componente **de verdade**, nunca mockado (lição repetida em 3.3/4.1) — aplicar em `MigrationCard.test.tsx`/`MigrationFlow.test.tsx`.
- **File List por último** (retro Epic 3 §8-2): rodar `git status --short`/`git diff --stat` **depois** da verificação manual e reconciliar — repetido em 3.3, 3.4 e 4.1; guardrail já ativo em `_bmad/custom/bmad-dev-story.toml`.
- **Contagem de testes sempre real, nunca de memória** (retro Epic 3 §1, achado M1 da 3.1, achado da 4.1 code-review) — rodar o comando de verdade antes de escrever Completion Notes/Debug Log.

### Git Intelligence

- Branch `main`; HEAD em `e1b72fb` (Story 4.1 mergeada, incluindo o fix de documentação AD-03/AD-05 do `core/time.py`→`core/calendar.py`). Convenção de commit: `feat(story-4.2): <descrição em pt-BR>`.
- Nenhuma mudança de schema nesta story — `migrated_to_task`/`migration_count`/`parent_task` já existem desde a 3.1, inertes até agora. **Esta é a primeira story que efetivamente popula esses campos.** Não é necessária nenhuma migration nova (Task 3 é só regeneração de contrato de API, não de schema).

### Contexto não-bloqueante (ações da retro Epic 3 / Epic 4)

- **Deploy (AR-21) concluído** (2026-07-12). **AR-22 (observabilidade)** segue pendente, sem dono/data — **não bloqueia** esta story.
- Story 4.3 (próxima) reaproveita o mesmo padrão de banner+fila+`migrate_task`, generalizando a origem para Weekly/Monthly Log — não precisa alterar nada desta story, só adicionar novos *callers*.

### Project Structure Notes

- Backend: `bujo/services/migration.py` é o único arquivo novo (a árvore §7.1 já reservava o nome). `views.py`/`serializers.py`/`urls.py` estendidos, não recriados. Nenhuma migration nova.
- Frontend: `features/bujo/components/` ganha `MigrationBanner.tsx`, `MigrationCard.tsx`, `MigrationFlow.tsx` (+ testes). `api.ts`/`keys.ts`/`types.ts`/`index.ts` estendidos. `pages/daily/DailyPage.tsx` ganha uma linha de composição (`<MigrationBanner />`).
- Fronteiras (§7.2): `features/bujo` não importa outra feature; `pages/daily` compõe a feature (já fazia isso). Sem violação de `import-linter` (mesma app `bujo` no backend).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2 (linhas 649-671); §Epic 4 (linhas 622-624 — "histórias estritamente ordenadas"; consome o Task congelado)]
- [Source: _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md#FR-1.4 (linha 183 — estados distintos migrada/adiada), FR-1.7 (linhas 191-195 — 4 decisões: migrar/adiar no mês/adiar fora do mês/cancelar), FR-1.10 (linha 203)]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-02 (linhas 124-145 — matriz `ALLOWED`, migrated/postponed terminais), AD-03 (linhas 149-185 — linhagem, schema `tasks`, generalização do vínculo pela 4.1), AD-08 (linhas 471-532 — item 11: migração de subárvore, casos-âncora "pai com 2 filhos"), §6.2/6.3/6.4/6.6/6.8 (camada de serviço, erros, validação, materialização), §6.10 (Reference Implementation de `transition_task`), §7.1 (árvore reserva `services/migration.py`)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/EXPERIENCE.md §4.2 (Migration Card — anatomia, regras, teclado, linhas 194-217), §6.1 (atalhos globais + Fluxo de Migração teclado, linhas 442-448), Fluxo 1 (linhas 537-563 — banner + Migration Card em uso real, "N de M revisadas")]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/DESIGN.md §7.8 (Migration Modal — nota conflitante, ver Dev Notes)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/mockups/key-migration-modal-desktop.html (composição real — overlay com backdrop, confirma EXPERIENCE.md sobre DESIGN.md §7.8)]
- [Source: backend/bujo/models.py — `Task` (campos de linhagem já congelados), `Log`/`MonthlyLog`; backend/bujo/services/{tasks,state_machine,logs}.py — `create_task`/`update_task`/`transition_task`/`get_or_create_*` (reaproveitados sem alteração); backend/core/calendar.py — `today_for` (reusar, nunca `date.today()`); backend/core/exceptions.py — `InvalidTransition`/`DomainError` (mapa 409)]
- [Source: backend/bujo/{views,serializers,urls}.py (padrão view fina/serializer a estender); backend/bujo/tests/{factories,test_services,test_views}.py (padrões de teste a seguir)]
- [Source: frontend/src/api/keys.ts (padrão de query key + invalidação por prefixo); frontend/src/features/bujo/{api,types,index}.ts; frontend/src/features/bujo/components/{TaskRow,MoveTaskDialog,FutureLogItemForm,DayHeader}.tsx (padrões de Dialog/picker/breakpoint a reusar); frontend/src/pages/daily/DailyPage.tsx (ponto de integração, atalho `N` já existente a preservar)]
- [Source: _bmad-output/implementation-artifacts/4-1-logs-weekly-monthly-e-future.md#Dev Notes (padrão de invalidação por prefixo, "sem lib sem necessidade", File List por último), #Completion Notes (contagens reais de teste)]
- [Source: _bmad-output/implementation-artifacts/3-1-agregado-task-com-schema-congelado-e-maquina-de-estados.md#Dev Notes (matriz ALLOWED completa, Reference Implementation de `transition_task`)]
- [Source: _bmad-output/implementation-artifacts/epic-3-retro-2026-07-08.md §5/§8 (guardrail "teste do cenário pai+filho concluído+filho pendente como PRIMEIRO teste" — codificado em _bmad/custom/bmad-dev-story.toml, citado literalmente na Task 4.1 acima)]

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- Backend: `cd backend && uv run pytest` → `237 passed, 1 warning in 556.65s` (warning é só o teardown do banco de teste Neon reclamando de outra sessão concorrente, não relacionado à story).
- `uv run ruff check .` → `All checks passed!`
- `uv run lint-imports` → `Contracts: 1 kept, 0 broken.` (regra "core must not import domain apps" mantida).
- `uv run python manage.py check` → `System check identified no issues (0 silenced).`
- Frontend: `npm run typecheck && npm run lint && npm run build && npm run test` já haviam sido rodados e registrados como passando antes desta sessão (Task 8.6 já marcada [x]); não re-executados nesta sessão porque nenhum arquivo frontend mudou depois desse ponto.
- Verificação manual (Task 8.7): backend (`manage.py runserver 0.0.0.0:8000`) + frontend (`npm run dev`, porta 5173) reais rodando simultaneamente; usuário real via `POST /api/accounts/signup/`; seed de dados via `manage.py shell` com `tenant_context(user)` (não há Log/Task admin superuser configurado neste ambiente, então o seed foi feito diretamente via ORM dentro do contexto de tenant, não pelo Django Admin). Script Playwright temporário (`frontend/e2e/_manual-verify-4-2*.spec.ts`) escrito, executado e removido ao final (mesmo padrão da Story 4.1).
  - Cenário 1 (fila com 2 tarefas-raiz: 1 tarefa solta + 1 pai com filho pendente + filho concluído): banner mostrou "2 tarefas pendentes de ontem. Iniciar migração?" (contagem correta — só raízes, subtarefa não conta). Migration Card mostrou título/subtarefas/indicador "N de M revisadas" (`aria-live=polite`)/4 botões com atalhos 1-4, `Dialog` com backdrop dimming o conteúdo atrás (confirma overlay real, não full-page).
  - `Esc` no meio do fluxo: modal fechou sem decidir, banner voltou a mostrar a contagem completa (nenhuma tarefa foi decidida), "Iniciar" retomou do mesmo card.
  - Decisão "Migrar para hoje" na tarefa solta → apareceu no Daily Log de hoje confirmada via screenshot subsequente (renderizada como linha da tarefa).
  - Decisão "Adiar no mês" no pai (com `input[type=date]`, confirmação automática ao `fill`, sem botão extra) → verificado via ORM: pai original `status=postponed`, novo pai em `monthly_log` do mês corrente `status=pending migration_count=1`; filho `pending` original → `postponed`, recriado como filho do novo pai (`migration_count=1`); filho `completed` original permaneceu intocado na origem (mesmo `id`, `parent_task` ainda apontando pro pai original agora `postponed`) — confirma AD-08 item 11 no ambiente real, não só em teste automatizado.
  - Modal fechou automaticamente após a última decisão; banner sumiu; reload da página confirmou que o banner não reaparece (fila vazia).
  - Cenário 2 (usuário novo, sem nenhum `Log` de ontem): abrir `/today` não mostrou banner e **não** materializou nenhum `Log` para a data de ontem (só o `Log` de hoje foi criado, pelo próprio Daily Log — comportamento do `MigrationQueueView.filter().first()` confirmado no ambiente real).
  - `console --errors` / listener de console do Playwright: 0 erros em todas as três execuções.
  - Dados de seed (2 usuários de QA + tasks/logs associados) removidos do banco de dev ao final; scripts Playwright temporários deletados; servidores de dev encerrados.

### Completion Notes List

- Serviço `migrate_task`/`_migrate_subtree` implementado reaproveitando `create_task`/`update_task`/`transition_task` sem duplicar lógica de `order_index` ou validação de transição; migração de subárvore recria só filhos `pending`/`started` no destino, preservando filhos `completed`/`cancelled` na origem (AD-08 item 11) — cenário-âncora "pai com filho concluído + filho pendente" foi o primeiro teste escrito em `test_services.py`, por guardrail da retro Epic 3.
- Ambiguidade `epics.md` (status=migrated genérico) vs. `FR-1.4`/`AD-02` (migrated/postponed distintos) resolvida a favor da distinção já refletida no frontend: "hoje" → `migrated`; "mês"/"futuro" → `postponed`; "cancelar" → `cancelled` sem linhagem.
- `MigrationQueueView` usa `.filter().first()` (nunca `get_or_create_daily_log`) — não materializa o Log de ontem quando não existe; confirmado tanto em teste automatizado (`test_views.py`) quanto na verificação manual desta sessão.
- Contrato de API regenerado (`schema.yaml`/`types.gen.ts`) sem alterar blocos `security` dos endpoints existentes (guardrail retro Epic 3 §3 — esta story não toca `DEFAULT_AUTHENTICATION_CLASSES`).
- Frontend: `MigrationBanner`/`MigrationCard`/`MigrationFlow` novos; `Dialog` MUI com backdrop real (desktop `maxWidth="sm"`, mobile `fullScreen`), indicador de progresso só texto (sem barra, conforme `EXPERIENCE.md §4.2` sobre o mockup), pickers inline (sem `Dialog` aninhado) com confirmação automática ao `onChange`. `DailyPage.tsx` ganhou uma linha de composição (`<MigrationBanner />`).
- Suite backend completa: **237 passed, 1 warning, 556.65s** (contagem real observada nesta sessão, não estimada). `ruff`/`lint-imports`/`manage.py check` sem achados.
- Verificação manual (Task 8.7) executada nesta sessão contra backend+frontend reais rodando simultaneamente, cobrindo os 3 cenários exigidos pela story (fila com pai+filhos+solta, `Esc` pausa/retoma, usuário sem Log de ontem) — detalhes em Debug Log References acima. Zero erros de console.
- File List reconciliado por último (Task 8.8), depois da verificação manual, contra `git status --short`/`git diff --stat` reais.

### Senior Developer Review (AI) — story-automator-review

Revisão adversarial completa (backend + frontend), com auto-fix habilitado. Resultado: **0 achados críticos** — todas as ACs implementadas e verificadas contra o código real; todas as tasks marcadas `[x]` confirmadas como feitas.

**Corrigido nesta revisão:**
- **[HIGH] Vazamento de estado entre Migration Cards** (`frontend/src/features/bujo/components/MigrationFlow.tsx`): `<MigrationCard>` era renderizado sem `key`, então o React reaproveitava a mesma instância ao avançar `currentIndex` — o estado interno `futureDay` (campo "Dia (opcional)" do picker "Adiar no Futuro") sobrevivia de um card para o próximo. Reprodução: abrir o picker de futuro no card A, digitar um dia, decidir A por outro caminho (sem confirmar o picker), avançar para o card B, abrir o picker de futuro de B — o campo "Dia" já vinha preenchido com o valor de A, podendo ser submetido sem confirmação explícita para aquela tarefa (viola a AC #3 — "nenhuma tarefa se move sem decisão explícita"). Corrigido com `key={currentTask.id}` (remonta o card a cada troca de tarefa, resetando todo estado local). Teste de regressão adicionado em `MigrationFlow.test.tsx`.
- **[MEDIUM] File List incompleto**: `frontend/e2e/fixtures.ts` (modificado), `frontend/e2e/seedYesterdayQueue.ts` e `frontend/e2e/migration-flow.spec.ts` (novos) — suíte E2E real contra o backend, cobrindo banner/fila/atalhos/AD-08 item 11/picker de mês — existiam no git mas não estavam documentados no File List. Adicionados.

**Não corrigido (fora do escopo de código, só observação):** `docs/futureIdeas.md` está untracked na árvore de trabalho e não tem relação com esta story (notas pessoais não relacionadas a bujo) — não tocado nesta revisão; sinalizar para não entrar no commit desta story por engano.

**Verificação real executada nesta revisão:** `ruff check`, `lint-imports`, `manage.py check` (backend) sem achados; `pytest bujo/tests/test_services.py bujo/tests/test_views.py` → `127 passed, 1 warning` (mesmo warning de teardown do Neon, não relacionado); `npm run typecheck`, `npm run lint` (frontend) sem achados; `vitest run` nos 7 arquivos de teste tocados pela story (incluindo o novo teste de regressão) → `71 passed` antes do fix + regressão adicionada e verde depois.

_Reviewer: story-automator-review (Claude) em 2026-07-13._

- backend/bujo/services/migration.py
- backend/bujo/serializers.py
- backend/bujo/views.py
- backend/bujo/urls.py
- backend/bujo/tests/test_services.py
- backend/bujo/tests/test_views.py
- schema.yaml
- frontend/src/api/keys.ts
- frontend/src/api/types.gen.ts
- frontend/src/features/bujo/types.ts
- frontend/src/features/bujo/api.ts
- frontend/src/features/bujo/api.test.tsx
- frontend/src/features/bujo/index.ts
- frontend/src/features/bujo/components/MigrationBanner.tsx
- frontend/src/features/bujo/components/MigrationBanner.test.tsx
- frontend/src/features/bujo/components/MigrationCard.tsx
- frontend/src/features/bujo/components/MigrationCard.test.tsx
- frontend/src/features/bujo/components/MigrationFlow.tsx
- frontend/src/features/bujo/components/MigrationFlow.test.tsx
- frontend/src/pages/daily/DailyPage.tsx
- frontend/src/pages/daily/DailyPage.test.tsx
- frontend/src/app/layout/RouteAnnouncer.test.tsx
- frontend/src/app/router.test.tsx
- frontend/e2e/fixtures.ts
- frontend/e2e/seedYesterdayQueue.ts
- frontend/e2e/migration-flow.spec.ts
