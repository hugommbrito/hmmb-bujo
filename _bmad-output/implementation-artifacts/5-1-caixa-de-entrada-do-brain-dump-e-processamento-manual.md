---
baseline_commit: 2477508bac1bbcc03b680887cefa3404ef914f6a
---

# Story 5.1: Caixa de entrada do Brain Dump e processamento manual

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero uma caixa de entrada sem data onde capturo itens e depois os movo para o log correto ou descarto,
Para que eu tenha um lugar honesto para pensamentos soltos, sem inseri-los direto num dia que não posso planejar agora (FR-5.1, FR-5.2, FR-5.3).

## Acceptance Criteria

1. **Model `BrainDumpItem` + superfície lista itens pendentes**
   - **Dado que** o app `braindump/` e seu model,
   - **Quando** implementado,
   - **Então** o item herda `TenantModel` com `title` (obrigatório), `description` (opcional) e `target_log` (opcional); o estado normal da caixa é vazio,
   - **E** a superfície Brain Dump (item da sidebar) lista os itens pendentes e exibe "Brain Dump vazio." quando não há itens.

2. **Processar item — mover para log de destino ou descartar**
   - **Dado que** um item no Brain Dump,
   - **Quando** Hugo o processa,
   - **Então** pode movê-lo para um log de destino (criando a `Task` correspondente) ou descartá-lo — sem migração automática,
   - **E** após processar/descartar, o item sai da caixa.

3. **Captura no desktop — atalho `B` ou item da sidebar abre o formulário**
   - **Dado que** a captura no desktop,
   - **Quando** Hugo aciona o atalho `B` ou o item da sidebar,
   - **Então** abre o formulário de captura (título obrigatório, descrição e destino opcionais, destino default = Brain Dump),
   - **E** salvar persiste o item escopado por tenant.

## Tasks / Subtasks

> **Ordem de execução:** backend (model → migration → serializers → services → views/urls → admin → testes) antes do frontend (data layer → componentes → página → rotas/atalho global → testes), mesma ordem das stories anteriores. **Esta é a primeira story do Épico 5 e cria o app `braindump/` do zero** — não existe nenhum arquivo em `backend/braindump/` nem `frontend/src/features/braindump/` hoje (confirmado por busca — nenhum resultado para `*braindump*`/`*brain-dump*` em nenhum dos dois lados). Leia a Dev Note "Por que `braindump` importa serviços de `bujo`" antes de desenhar `services.py` — é a primeira vez no codebase que um app de domínio importa services de outro app de domínio, e isso é intencional, não uma violação de fronteira.

- [x] **Task 1: App `braindump/` — scaffold + model + migration** (AC: #1)
  - [x] 1.1 Criar o app Django `backend/braindump/` (mesma estrutura de `bujo/`: `__init__.py`, `apps.py`, `models.py`, `serializers.py`, `services.py`, `views.py`, `urls.py`, `admin.py`, `migrations/__init__.py`, `tests/__init__.py`). `apps.py`:
    ```python
    """App config for the ``braindump`` domain app (FR-5, AD-13, AD-15)."""

    from django.apps import AppConfig


    class BraindumpConfig(AppConfig):
        default_auto_field = "django.db.models.BigAutoField"
        name = "braindump"
    ```
  - [x] 1.2 `backend/braindump/models.py`:
    ```python
    """Brain Dump — caixa de entrada sem data (FR-5, AD-15).

    `target_log` é só uma DICA opcional guardada no item, escolhida no formulário
    de captura — NUNCA cria a Task de destino na hora (ver Dev Notes "target_log
    é dica, não placement"). A criação real da Task só acontece no processamento
    manual (Task 3, AC #2).
    """

    from django.db import models

    from core.models import TenantModel


    class BrainDumpItem(TenantModel):
        class TargetLog(models.TextChoices):
            TODAY = "today"
            WEEK = "week"
            MONTH = "month"
            FUTURE = "future"

        title = models.CharField(max_length=500)
        description = models.TextField(null=True, blank=True)  # noqa: DJ001 - ausência é valor válido (mesma semântica de Task.description)
        # noqa: DJ001 - null = "Brain Dump" (sem dica de destino); mesmo padrão nulável de Task.eisenhower/Task.category (sem CheckConstraint — ver Dev Notes)
        target_log = models.CharField(max_length=8, choices=TargetLog.choices, null=True, blank=True)  # noqa: DJ001
        created_at = models.DateTimeField(auto_now_add=True)

        class Meta:
            db_table = "brain_dump_items"
            ordering = ["created_at"]
    ```
  - [x] 1.3 Gerar a migration: `cd backend && uv run python manage.py makemigrations braindump`. Confirmar que sai como `0001_initial.py` (precedente: `bujo`/`accounts` também nomeiam a primeira migration `0001_initial`, a regra de `--name` descritivo do §6.1 vale para migrations subsequentes, não para a inicial).
  - [x] 1.4 Em `backend/config/settings/base.py`, `INSTALLED_APPS`: adicionar `"braindump"` depois de `"bujo"`.

- [x] **Task 2: Serializers** (AC: #1, #2, #3)
  - [x] 2.1 `backend/braindump/serializers.py`:
    ```python
    """Serializers do Brain Dump (§6.2, §6.3): view fina, sem regra de negócio."""

    from rest_framework import serializers

    from braindump.models import BrainDumpItem


    class BrainDumpItemSerializer(serializers.ModelSerializer):
        class Meta:
            model = BrainDumpItem
            fields = ["id", "title", "description", "target_log", "created_at"]


    class BrainDumpItemCreateSerializer(serializers.Serializer):
        title = serializers.CharField(max_length=500)
        description = serializers.CharField(required=False, allow_null=True, allow_blank=True)
        target_log = serializers.ChoiceField(
            choices=BrainDumpItem.TargetLog.choices, required=False, allow_null=True
        )


    class BrainDumpItemProcessSerializer(serializers.Serializer):
        destination = serializers.ChoiceField(choices=["today", "week", "month", "future"])
        month_first = serializers.DateField(required=False)
        scheduled_date = serializers.DateField(required=False, allow_null=True)

        def validate(self, attrs):
            destination = attrs["destination"]
            if destination == "future":
                if not attrs.get("month_first"):
                    raise serializers.ValidationError(
                        {"month_first": "Obrigatório para mover ao Futuro."}
                    )
                if attrs["month_first"].day != 1:
                    raise serializers.ValidationError(
                        {"month_first": "Deve ser o primeiro dia do mês."}
                    )
            return attrs
    ```
    `BrainDumpItemProcessSerializer` é uma cópia deliberada e reduzida de `TaskMigrateSerializer` (`bujo/serializers.py`, sem a opção `"cancel"` — descarte é um endpoint `DELETE` separado, Task 4.3) — mesmo vocabulário de `destination` (`today`/`week`/`month`/`future`) usado por `migrate_task`, para que as Stories 5.2/5.3 (e qualquer developer futuro) não precisem aprender um segundo vocabulário de destino.

- [x] **Task 3: Services — criar, listar, processar, descartar** (AC: #1, #2)
  - [x] 3.1 `backend/braindump/services.py`:
    ```python
    """Camada de serviço do Brain Dump (§6.2, AD-15).

    `process_brain_dump_item` reaproveita os serviços de resolução de container
    e criação de tarefa já existentes em `bujo` — ver Dev Notes "Por que
    `braindump` importa serviços de `bujo`" antes de alterar este arquivo.
    """

    from django.db import transaction

    from braindump.models import BrainDumpItem
    from bujo.services.logs import (
        get_or_create_daily_log,
        get_or_create_monthly_log,
        get_or_create_weekly_log,
    )
    from bujo.services.tasks import create_task
    from core.calendar import today_for, week_start_of


    def list_brain_dump_items(*, user):
        return BrainDumpItem.objects.all()


    @transaction.atomic
    def create_brain_dump_item(*, user, title, description=None, target_log=None) -> BrainDumpItem:
        return BrainDumpItem.objects.create(
            title=title, description=description, target_log=target_log
        )


    @transaction.atomic
    def process_brain_dump_item(
        *, user, item_id, destination, month_first=None, scheduled_date=None
    ):
        """Cria a `Task` de destino e remove o item da caixa (AC #2). Sem
        migração automática: `destination` é escolhido AGORA pelo usuário, no
        momento do processamento — `target_log` do item (se houver) é só uma
        dica que o frontend pode usar para pré-selecionar a opção, nunca lida
        aqui no service (§6.8: nenhuma automação implícita).
        """
        item = BrainDumpItem.objects.get(id=item_id)

        if destination == "today":
            container_field = "log"
            container = get_or_create_daily_log(user=user, log_date=today_for(user))
        elif destination == "week":
            container_field = "weekly_log"
            week_start = (
                week_start_of(scheduled_date) if scheduled_date else week_start_of(today_for(user))
            )
            container = get_or_create_weekly_log(user=user, week_start=week_start)
        else:  # "month" ou "future" — mesma resolução de container que migrate_task
            container_field = "monthly_log"
            container = get_or_create_monthly_log(user=user, month_first=month_first)

        task = create_task(
            user=user,
            title=item.title,
            description=item.description,
            scheduled_date=scheduled_date if destination != "today" else None,
            **{container_field: container},
        )
        item.delete()
        return task


    @transaction.atomic
    def discard_brain_dump_item(*, user, item_id) -> None:
        BrainDumpItem.objects.get(id=item_id).delete()
    ```
    Nota sobre `destination == "month"`: diferente de `migrate_task` (que resolve `month_first` do mês corrente via `today_for` quando `destination == "month"`), aqui **a view** resolve esse valor antes de chamar o serviço (Task 4.2) — mesma divisão de responsabilidade já usada em `TaskMigrateView` (`bujo/views.py`): a autoridade de "mês corrente" fica na borda HTTP, não duplicada dentro do serviço.
  - [x] 3.2 Note: `BrainDumpItem` **não tem** `ImmutableSnapshot`/estado — não é um agregado com máquina de estados (diferente de `Task`). Processar/descartar é sempre um `DELETE` físico do registro (ver Dev Notes "Descarte é exclusão física — sem histórico de Brain Dump").

- [x] **Task 4: Views + URLs** (AC: #1, #2, #3)
  - [x] 4.1 `backend/braindump/views.py`:
    ```python
    """Views finas do Brain Dump (§6.2): parseiam/validam → chamam o serviço → serializam."""

    from rest_framework import serializers, status
    from rest_framework.exceptions import NotFound
    from rest_framework.response import Response
    from rest_framework.views import APIView

    from braindump.models import BrainDumpItem
    from braindump.serializers import (
        BrainDumpItemCreateSerializer,
        BrainDumpItemProcessSerializer,
        BrainDumpItemSerializer,
    )
    from braindump.services import (
        create_brain_dump_item,
        discard_brain_dump_item,
        list_brain_dump_items,
        process_brain_dump_item,
    )
    from bujo.serializers import TaskSerializer
    from core.calendar import today_for


    class BrainDumpItemListCreateView(APIView):
        def get(self, request):
            items = list_brain_dump_items(user=request.user)
            return Response(BrainDumpItemSerializer(items, many=True).data)

        def post(self, request):
            body = BrainDumpItemCreateSerializer(data=request.data)
            body.is_valid(raise_exception=True)
            item = create_brain_dump_item(user=request.user, **body.validated_data)
            return Response(BrainDumpItemSerializer(item).data, status=status.HTTP_201_CREATED)


    class BrainDumpItemDetailView(APIView):
        def delete(self, request, pk):
            try:
                discard_brain_dump_item(user=request.user, item_id=pk)
            except BrainDumpItem.DoesNotExist:
                raise NotFound() from None
            return Response(status=status.HTTP_204_NO_CONTENT)


    class BrainDumpItemProcessView(APIView):
        def post(self, request, pk):
            body = BrainDumpItemProcessSerializer(data=request.data)
            body.is_valid(raise_exception=True)
            validated = body.validated_data
            destination = validated["destination"]

            month_first = validated.get("month_first")
            current_month_first = today_for(request.user).replace(day=1)
            if destination == "month":
                month_first = current_month_first
            elif destination == "future" and month_first is not None and month_first <= current_month_first:
                raise serializers.ValidationError(
                    {"month_first": "Use 'month' para o mês corrente."}
                )

            try:
                task = process_brain_dump_item(
                    user=request.user,
                    item_id=pk,
                    destination=destination,
                    month_first=month_first,
                    scheduled_date=validated.get("scheduled_date"),
                )
            except BrainDumpItem.DoesNotExist:
                raise NotFound() from None
            return Response(TaskSerializer(task).data)
    ```
    Sem `@extend_schema` explícito nas duas primeiras views: `drf-spectacular` já infere `request`/`responses` de serializers `ModelSerializer` simples sem ambiguidade (mesmo comportamento observado em outras views do projeto que não anotam explicitamente); adicione `@extend_schema` se o passo de geração de contrato (Task 7) mostrar um schema incompleto/genérico para algum destes endpoints.
  - [x] 4.2 `backend/braindump/urls.py`:
    ```python
    from django.urls import path

    from braindump.views import (
        BrainDumpItemDetailView,
        BrainDumpItemListCreateView,
        BrainDumpItemProcessView,
    )

    urlpatterns = [
        path("items/", BrainDumpItemListCreateView.as_view(), name="braindump-item-list"),
        path("items/<uuid:pk>/", BrainDumpItemDetailView.as_view(), name="braindump-item-detail"),
        path(
            "items/<uuid:pk>/process/",
            BrainDumpItemProcessView.as_view(),
            name="braindump-item-process",
        ),
    ]
    ```
  - [x] 4.3 Em `backend/config/urls.py`: adicionar `path("api/brain-dump/", include("braindump.urls"))`. **Prefixo com hífen** (`brain-dump`, não `braindump`) — é o nome do RECURSO na API (§6.1: "recurso no plural, kebab-case quando composto"), consistente com o próprio texto da AD-13 ("`GET /brain-dump/count`"); o nome do PACOTE Python continua `braindump` (sem hífen — já é assim em `pyproject.toml`, ver Task 6.1).

- [x] **Task 5: Admin** (sem AC direta — paridade com os demais apps de domínio, §7.1)
  - [x] 5.1 `backend/braindump/admin.py`:
    ```python
    """Admin de operador para `BrainDumpItem` (AD-12): usa `all_objects`."""

    from django.contrib import admin

    from braindump.models import BrainDumpItem


    @admin.register(BrainDumpItem)
    class BrainDumpItemAdmin(admin.ModelAdmin):
        list_display = ("id", "user_id", "title", "target_log", "created_at")
        list_filter = ("target_log",)
        search_fields = ("id", "user_id", "title")

        def get_queryset(self, request):
            return BrainDumpItem.all_objects.all()
    ```

- [x] **Task 6: Testes de backend** (AC: #1, #2, #3)
  - [x] 6.1 `backend/braindump/tests/factories.py` — mesmo padrão de `bujo/tests/factories.py` (`Params` + `SelfAttribute`, `user_id` não é FK):
    ```python
    import factory
    from factory.django import DjangoModelFactory

    from accounts.tests.factories import UserFactory
    from braindump.models import BrainDumpItem
    from core.tests.registry import register_isolation_case


    class BrainDumpItemFactory(DjangoModelFactory):
        class Meta:
            model = BrainDumpItem

        class Params:
            user = factory.SubFactory(UserFactory)

        user_id = factory.SelfAttribute("user.id")
        title = factory.Sequence(lambda n: f"Item {n}")


    register_isolation_case(
        id="braindump.BrainDumpItem",
        model=BrainDumpItem,
        make=lambda: {"title": "Item de teste"},
    )
    ```
  - [x] 6.2 Em `backend/conftest.py`, `_ISOLATION_TEST_MODULES`: adicionar `"braindump.tests.factories"` à lista (hoje `["core.tests.models", "bujo.tests.factories"]`) — **sem isto, o contrato de isolamento genérico (`pytest_generate_tests`) nunca importa o módulo e o novo model fica fora da cobertura fail-closed compartilhada** (Task bloqueante — é o mesmo mecanismo que provou o isolamento de `Task`/`Log` desde a Story 1.2/3.1, sem copiar `test_isolation.py`).
  - [x] 6.3 `backend/braindump/tests/test_models.py`: `BrainDumpItem` aceita `target_log=None` (estado "Brain Dump", sem dica); aceita cada valor de `TargetLog.choices`; `description=None` é válido; `ordering` é por `created_at` crescente (criar 2 itens fora de ordem de PK e confirmar a ordem do `.all()`).
  - [x] 6.4 `backend/braindump/tests/test_serializers.py`: `BrainDumpItemSerializer` expõe `targetLog`/`createdAt` em camelCase (conferir nomes exatos gerados pelo middleware); `BrainDumpItemCreateSerializer` aceita payload só com `title`; rejeita `target_log` fora de `TargetLog.choices`; `BrainDumpItemProcessSerializer` exige `month_first` quando `destination="future"` e rejeita `month_first` que não seja dia 1.
  - [x] 6.5 `backend/braindump/tests/test_services.py`:
    - `create_brain_dump_item`: cria com só `title`; cria com os 3 campos; `user_id` auto-preenchido do contexto (via `tenant_context`, mesmo padrão de `bujo/tests/test_services.py`).
    - `list_brain_dump_items`: escopado por tenant (item de `other_user` não aparece); vazio para usuário novo.
    - `process_brain_dump_item`: `destination="today"` cria `Task` em `log` do dia corrente (`log_date == today_for(user)`) e o item some (`BrainDumpItem.objects.filter(id=...).exists()` é `False`); `destination="week"` sem `scheduled_date` cria em `weekly_log` da semana corrente, sem dia; `destination="month"`/`"future"` cria em `monthly_log` do `month_first` informado; a `Task` criada herda `title`/`description` do item; a `Task` criada é uma tarefa raiz comum (`status=PENDING`, sem `source_template`, sem lineage) — nenhuma marca de que veio do Brain Dump é persistida na `Task` (decisão consciente, ver Dev Notes).
    - `discard_brain_dump_item`: remove o item; `BrainDumpItem.DoesNotExist` para item já removido ou de outro tenant (o manager auto-escopado já garante isso — confirmar com `other_user`).
  - [x] 6.6 `backend/braindump/tests/test_views.py` (usar fixture `auth_client`):
    - `GET /api/brain-dump/items/` vazio → `200` com `[]`; com itens → lista ordenada por `createdAt`.
    - `POST /api/brain-dump/items/` só com `title` → `201`, `targetLog: null`; com os 3 campos → `201` com os valores; sem `title` → `400`.
    - `POST /api/brain-dump/items/<id>/process/` com `destination="today"` → `200`, corpo é a `Task` criada (`TaskSerializer`), item removido da listagem subsequente; `destination="future"` sem `month_first` → `400`; `destination="future"` com `month_first` no mês corrente ou passado → `400` (mesma regra de `TaskMigrateView`); item de `other_user` → `404`.
    - `DELETE /api/brain-dump/items/<id>/` → `204`, item removido; segunda chamada no mesmo id → `404`; item de `other_user` → `404`.
    - Isolamento fim-a-fim: item criado por `user` nunca aparece em `GET` autenticado como `other_user`.

- [x] **Task 7: Regenerar o contrato de API** (AC: #1, #2, #3)
  - [x] 7.1 `cd backend && uv run python manage.py spectacular --file ../schema.yaml`
  - [x] 7.2 `cd frontend && npm run generate-types`
  - [x] 7.3 Conferir no diff do `schema.yaml`: schema novo `BrainDumpItem` (com `targetLog`/`createdAt`), paths `/api/brain-dump/items/`, `/api/brain-dump/items/{id}/`, `/api/brain-dump/items/{id}/process/`; blocos `security` dos endpoints existentes intactos (guardrail retroativo do Epic 3 §3).
  - [x] 7.4 Confirmar que o step de CI "Verificar types.gen.ts está atualizado" passa sem diff residual.

- [x] **Task 8: Camada de dados do frontend** (AC: #1, #2, #3)
  - [x] 8.1 `frontend/src/api/keys.ts` — estender a seção `brainDump` já existente (hoje só `count`, reservado para a Story 5.2):
    ```typescript
    brainDump: {
      count: (userId: string) => ['brainDump', 'count', userId] as const,
      list: () => ['brainDump', 'list'] as const,
    },
    ```
  - [x] 8.2 `frontend/src/features/braindump/types.ts`:
    ```typescript
    import type { components } from '../../api/types.gen'

    export type BrainDumpItem = components['schemas']['BrainDumpItem']
    export type BrainDumpTargetLog = components['schemas']['TargetLogEnum']
    ```
    Confirmar o nome exato do enum gerado (`TargetLogEnum` é a convenção observada em `StatusEnum`/`CategoryEnum`/`EisenhowerEnum` de `bujo`, mas `drf-spectacular` deriva o nome do `ChoiceField` — conferir contra `schema.yaml` depois da Task 7 e ajustar se vier diferente).
  - [x] 8.3 `frontend/src/features/braindump/api.ts` — mutações simples com invalidação no sucesso (não otimistas): a AD-13 exige otimismo especificamente na **contagem do badge** (Story 5.2), não na lista do Brain Dump em si; mesmo padrão de `useCreateWeeklyTaskMutation`/`useDeleteTaskMutation` (`features/bujo/api.ts`) é suficiente aqui — ver Dev Notes "Sem otimismo na lista do Brain Dump nesta story".
    ```typescript
    import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
    import client from '../../api/client'
    import { keys } from '../../api/keys'
    import type { BrainDumpItem, BrainDumpTargetLog } from './types'

    async function fetchBrainDumpItems(): Promise<BrainDumpItem[]> {
      const response = await client.get<BrainDumpItem[]>('/api/brain-dump/items/')
      return response.data
    }

    export function useBrainDumpItemsQuery() {
      return useQuery({ queryKey: keys.brainDump.list(), queryFn: fetchBrainDumpItems })
    }

    interface CreateBrainDumpItemVariables {
      title: string
      description?: string | null
      targetLog?: BrainDumpTargetLog | null
    }

    async function createBrainDumpItem(fields: CreateBrainDumpItemVariables): Promise<BrainDumpItem> {
      const response = await client.post<BrainDumpItem>('/api/brain-dump/items/', fields)
      return response.data
    }

    export function useCreateBrainDumpItemMutation() {
      const queryClient = useQueryClient()
      return useMutation({
        mutationFn: createBrainDumpItem,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.brainDump.list() }),
      })
    }

    interface ProcessBrainDumpItemVariables {
      itemId: string
      destination: 'today' | 'week' | 'month' | 'future'
      monthFirst?: string
      scheduledDate?: string | null
    }

    async function processBrainDumpItem({ itemId, ...fields }: ProcessBrainDumpItemVariables) {
      const response = await client.post(`/api/brain-dump/items/${itemId}/process/`, fields)
      return response.data
    }

    export function useProcessBrainDumpItemMutation() {
      const queryClient = useQueryClient()
      return useMutation({
        mutationFn: processBrainDumpItem,
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: keys.brainDump.list() })
          // Container de destino é escolhido em tempo de processamento (pode ser
          // qualquer um dos 3) — invalidação por prefixo nas 3 chaves de log,
          // mesmo padrão de useDeleteTaskMutation (features/bujo/api.ts).
          queryClient.invalidateQueries({ queryKey: ['bujo', 'dailyLog'] })
          queryClient.invalidateQueries({ queryKey: ['bujo', 'weeklyLog'] })
          queryClient.invalidateQueries({ queryKey: ['bujo', 'monthlyLog'] })
          queryClient.invalidateQueries({ queryKey: ['bujo', 'taskDensity'] })
        },
      })
    }

    interface DiscardBrainDumpItemVariables {
      itemId: string
    }

    async function discardBrainDumpItem({ itemId }: DiscardBrainDumpItemVariables): Promise<void> {
      await client.delete(`/api/brain-dump/items/${itemId}/`)
    }

    export function useDiscardBrainDumpItemMutation() {
      const queryClient = useQueryClient()
      return useMutation({
        mutationFn: discardBrainDumpItem,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.brainDump.list() }),
      })
    }
    ```
  - [x] 8.4 `frontend/src/features/braindump/index.ts` — barrel público (mesmo padrão de `features/bujo/index.ts`): reexportar os 4 hooks de `./api` e os tipos `BrainDumpItem`/`BrainDumpTargetLog` de `./types`.

- [x] **Task 9: Componentes** (AC: #1, #2, #3)
  - [x] 9.1 `frontend/src/features/braindump/components/BrainDumpCaptureForm.tsx` — formulário sempre visível no topo da página (não um "+" que precisa ser clicado — ver Dev Notes "O que 'abre o formulário de captura' significa no desktop"). Campos: `TextField` título (obrigatório, `inputRef` exposta via prop para o atalho `B` poder focar), `TextField` descrição (opcional, multiline), `Select` destino com 5 opções — `'' → 'Brain Dump'`, `'today' → 'Hoje'`, `'week' → 'Esta Semana'`, `'month' → 'Este Mês'`, `'future' → 'Futuro'` (default `''`). Ao submeter: `onCapture({ title, description: description || undefined, targetLog: targetLog || undefined })`; limpa os 3 campos após sucesso. Sem seletor de mês/dia aqui — `target_log` é só uma dica de texto (ver Dev Notes), não um placement real, então "Futuro" não precisa de mês nesta tela.
  - [x] 9.2 `frontend/src/features/braindump/components/BrainDumpItemRow.tsx` — `title` + `description` (se houver) + dois botões de ação: "Mover" (abre `ProcessItemDialog`) e "Descartar" (`color="error"`, chama `useDiscardBrainDumpItemMutation` **direto no clique, sem diálogo de confirmação** — mesmo padrão de "Excluir tarefa"/"Cancelar tarefa" em `TaskDetailPanel.tsx`, `features/bujo/components/`, que também deleta/cancela no clique direto sem passo de confirmação intermediário; não invente um `ConfirmDialog` novo aqui, não existe precedente disso em nenhuma superfície do projeto).
  - [x] 9.3 `frontend/src/features/braindump/components/ProcessItemDialog.tsx` — 4 botões/abas "Hoje" / "Esta Semana" / "Este Mês" / "Futuro" (reaproveita o vocabulário de `TaskDestinationDialog`, `features/bujo/components/`, mas **não** reaproveita o componente em si — ele está fortemente acoplado a `Task`/`useMigrateTaskMutation`). Para "Futuro": campo `<TextField type="month">` (mesmo padrão de `FutureLogItemForm.tsx` — "sem lib sem necessidade", nada de `@mui/x-date-pickers`) para capturar `monthFirst = \`${month}-01\``; para "Este Mês": sem campo — `monthFirst` é resolvido no BACKEND (Task 4.1, `today_for`), o frontend não envia `monthFirst` para `destination="month"`. Botão de confirmação chama `useProcessBrainDumpItemMutation`; ao suceder, fecha o dialog (o item já some da lista via invalidação — Task 8.3).

- [x] **Task 10: `BrainDumpPage`** (AC: #1, #3)
  - [x] 10.1 `frontend/src/pages/braindump/BrainDumpPage.tsx` — mesmo esqueleto de `ArchivePage.tsx` (`Box component="main" aria-label="Brain Dump"`, `PlannerSkeleton` durante `isPending`): título "Brain Dump", `BrainDumpCaptureForm` sempre no topo, lista de `BrainDumpItemRow` abaixo, estado vazio "Brain Dump vazio." (texto exato — microcopy fixada em EXPERIENCE.md §3.3/§5.4) quando `items.data.length === 0`.
  - [x] 10.2 A prop `autoFocusTitle` (ou equivalente) do formulário é acionada sempre que a página monta — não só quando chegou via atalho `B` (decisão de simplicidade: focar o título toda vez que `/brain-dump` é aberto tem custo zero e evita ramificar comportamento por origem de navegação; ver Dev Notes).

- [x] **Task 11: Rota + atalho global `B`** (AC: #3)
  - [x] 11.1 `frontend/src/app/router.tsx`: trocar `{ path: 'brain-dump', element: <PlaceholderPage title="Brain Dump" />, ... }` por `{ path: 'brain-dump', element: <BrainDumpPage />, handle: { title: 'Brain Dump' } }` (mesmo padrão da troca de `archive`/`settings` nas Stories 4.5/4.6). Importar `BrainDumpPage` de `'../pages/braindump/BrainDumpPage'`.
  - [x] 11.2 **Sidebar não muda.** O item "Brain Dump" (`app/layout/Sidebar.tsx`) já existe, já aponta para `/brain-dump` e já usa o mesmo `renderItem`/`navigate` de todo item de nav (linhas ~66/108) — como a página de destino agora sempre mostra o formulário de captura no topo (Task 10.1), clicar no item da sidebar já satisfaz literalmente "o item da sidebar [...] abre o formulário de captura" (AC #3) sem nenhuma mudança no componente.
  - [x] 11.3 `frontend/src/app/layout/AppLayout.tsx`: estender o `useEffect` do atalho `[` (já existente, guardado por `isDesktop` e pelo check `isEditable`) para também tratar `b`/`B`:
    ```typescript
    if (event.key === '[') {
      setSidebarCollapsed((prev) => !prev)
    } else if (event.key === 'b' || event.key === 'B') {
      navigate('/brain-dump')
    }
    ```
    Precisa importar `useNavigate` de `react-router-dom` (hoje `AppLayout.tsx` só importa `Outlet`) e chamar `const navigate = useNavigate()` no topo do componente. **Sem** o guard de `ctrlKey`/`metaKey`/`altKey` que `DailyPage.tsx` usa para `N` — replicar esse guard aqui também (`Cmd+B`/`Ctrl+B` são atalhos nativos do navegador/OS em algumas plataformas e não devem ser sequestrados).

- [x] **Task 12: Testes de frontend** (AC: #1, #2, #3)
  - [x] 12.1 `frontend/src/features/braindump/api.test.tsx` — mesmo molde de `features/bujo/api.test.tsx`: os 4 hooks batem nos endpoints certos e invalidam as chaves certas (mock de `client`).
  - [x] 12.2 `BrainDumpCaptureForm.test.tsx`: submeter só com título chama `onCapture` com `targetLog: undefined`; escolher "Hoje" no select chama com `targetLog: 'today'`; título vazio não submete (validação nativa do `required` do TextField ou guard em JS — escolher um e testar); limpa os campos após submissão.
  - [x] 12.3 `BrainDumpItemRow.test.tsx`: renderiza título/descrição; clicar "Mover" abre `ProcessItemDialog`; clicar "Descartar" chama a mutation direto (sem diálogo de confirmação intermediário).
  - [x] 12.4 `ProcessItemDialog.test.tsx`: escolher "Futuro" exige mês preenchido antes de habilitar o botão de confirmar; escolher "Hoje"/"Esta Semana"/"Este Mês" confirma direto; a mutation é chamada com o `destination` certo.
  - [x] 12.5 `BrainDumpPage.test.tsx` (mesmo molde de `ArchivePage.test.tsx`): estado vazio mostra "Brain Dump vazio."; lista renderiza itens mockados; `jest-axe` sem violações.
  - [x] 12.6 `AppLayout.test.tsx` — estender (mesmo padrão dos testes existentes do atalho `[`, linhas ~76-113): registrar rota `brain-dump` no `renderAppLayout()` (hoje só tem `index`/`today`); `fireEvent.keyDown(window, { key: 'b' })` no modo desktop navega para `/brain-dump` (assert por conteúdo da rota mockada); o atalho é ignorado quando o foco está num `<input>` (mesmo teste `test_atalho_colchete_ignorado_em_input`, duplicado para `b`); ignorado no modo mobile (guard `isDesktop`, mesmo comportamento do atalho `[`).
  - [x] 12.7 `router.tsx` — se `router.test.tsx` faz mock do barrel `features/bujo` e navega para outras rotas placeholder trocadas em stories anteriores (Archive/Settings), conferir se `/brain-dump` precisa de um mock equivalente para `features/braindump` antes de assumir que é necessário (mesmo cuidado da Story 4.6 Task 11.5 — evita trabalho especulativo).

- [x] **Task 13: Verificação final** (AC: #1, #2, #3)
  - [x] 13.1 `cd backend && uv run pytest && uv run ruff check . && uv run lint-imports && uv run python manage.py check` — colar a contagem real observada.
  - [x] 13.2 `cd frontend && npm run typecheck && npm run lint && npm run build && npm run test` — colar a contagem real observada.
  - [x] 13.3 Verificação manual contra backend+frontend reais (`npm run dev` + backend, logado): capturar um item via `B`/sidebar com só título → aparece na lista, badge não existe ainda (Story 5.2, fora de escopo); capturar com destino "Hoje" preenchido → item aparece igual (dica não muda o comportamento de captura); processar um item para "Hoje" → item some da lista e a `Task` aparece no Daily Log de hoje ao navegar até `/today`; descartar um item → some sem criar nada; usuário sem itens → "Brain Dump vazio."; zero erros de console.
  - [x] 13.4 **File List por último** (retro Epic 3 §8-2, guardrail ativo): `git status --short` + `git diff --stat` **depois** da verificação manual, reconciliado contra o File List documentado.

## Dev Notes

### `target_log` é dica, não placement — não confundir com o processamento

A AC #1 define `target_log` como um campo **opcional no model do item** (`title`/`description`/`target_log` — três atributos do mesmo registro), não como um mecanismo que cria a `Task` de destino na hora da captura. A AC #2 é o único lugar onde "mover para um log de destino (criando a Task correspondente)" acontece, e é sempre uma ação manual e explícita sobre um item **já existente** na caixa — nunca um efeito colateral de escolher um destino no formulário de captura (AC #3). Ler `target_log` como "se != Brain Dump, cria a Task direto e pula a caixa" quebraria FR-5.3 ("processados manualmente... sem migração automática") e a própria AC #1 ("o estado normal da caixa é vazio" só faz sentido se todo item passa pela caixa primeiro). Guarde `target_log` só como metadado — o frontend pode (opcionalmente, não é AC desta story) usá-lo para pré-selecionar a opção no `ProcessItemDialog`, mas o serviço `process_brain_dump_item` nunca lê `item.target_log` — `destination` vem sempre do parâmetro explícito da chamada de processamento.

### Por que `braindump` importa serviços de `bujo`

Esta é a primeira vez no codebase que um app de domínio importa `services`/`serializers` de OUTRO app de domínio (`braindump/services.py` → `bujo.services.logs`/`bujo.services.tasks`; `braindump/views.py` → `bujo.serializers.TaskSerializer`). A regra de porta imposta por `import-linter` (`pyproject.toml`) só proíbe `core` importar apps de domínio — não existe nenhuma regra (nem no `import-linter`, nem em §7.2) que proíba um app de domínio importar outro. É uma dependência real e não-circular (`braindump` → `bujo`, nunca o inverso — `bujo` não sabe que `braindump` existe), e reaproveitar `get_or_create_daily_log`/`get_or_create_weekly_log`/`get_or_create_monthly_log`/`create_task` é exatamente o oposto de "reinventar a roda": duplicar essa lógica em `braindump` divergiria de `migrate_task` na primeira mudança futura em qualquer uma das duas. Se esse padrão de acoplamento cross-domain crescer (ex.: `habits`/`health` também precisando criar `Task`s), considerar extrair um "seam" formal (protocolo em `core/protocols.py`, no espírito do que §7.2 já reserva para `rollover/`) — **não construído nesta story**, YAGNI por ora com um único consumidor.

### Descarte é exclusão física — sem histórico de Brain Dump

Diferente de `Task` (que nunca é deletada — migração/cancelamento são transições de estado preservadas para sempre, AD-03), um `BrainDumpItem` processado ou descartado é **removido fisicamente** (`DELETE`, Task 3.1). Não há FR nem AC pedindo histórico de itens do Brain Dump, e o valor de auditoria do método BuJo (linhagem, `migration_count`) já é preservado do lado da `Task` criada no processamento — a caixa de entrada em si é deliberadamente efêmera ("válvula de escape", não um log). Se uma story futura precisar de histórico de captura, isso é um campo `processed_at`/soft-delete a adicionar então — não antecipar aqui.

### `GET /api/brain-dump/items/` é deliberadamente sem paginação

O §6.3 da arquitetura documenta `PageNumberPagination`/`page_size=50` como default da API, mas `BrainDumpItemListCreateView.get` (Task 4.1) retorna a lista **direto**, sem passar por `paginate_queryset` — mesmo precedente já estabelecido por `ArchiveView.get` (`bujo/views.py`, que também devolve `Response(ArchiveEntrySerializer(entries, many=True).data)` sem paginação). Justificativa igual: volume esperado é dezenas de itens por usuário solo no MVP, e a AC #1 não pede paginação. Não envolva a resposta em `{count, next, previous, results}` — o frontend (Task 8.3) espera um array puro, consistente com `useArchiveQuery`.

### Nenhuma marca de proveniência na `Task` criada pelo processamento

`process_brain_dump_item` cria uma `Task` comum — sem equivalente a `source_template_id` (AD-08) apontando de volta para o `BrainDumpItem` de origem. Nenhuma AC pede rastrear "esta tarefa veio do Brain Dump", e adicionar essa coluna agora seria especulativo (o item já foi deletado no mesmo `transaction.atomic`, então não haveria nada para o ponteiro referenciar depois). Se isso virar requisito, é aditivo numa story futura.

### Sem `CheckConstraint` para `target_log` — mesmo precedente de `Task.eisenhower`/`Task.category`

O §6.1 da arquitetura descreve a regra geral "`TextChoices` + `CheckConstraint`" para valores fechados, mas a prática real do codebase (`bujo/models.py`, `Task.eisenhower`/`Task.category`) só aplica `CheckConstraint` a campos **obrigatórios** (`Task.status`, via `task_status_valid`) — campos opcionais/nuláveis com `choices` (Eisenhower, Category) não têm constraint própria, confiando só na validação do serializer na escrita. `target_log` segue esse precedente real (não o texto aspiracional da doc): sem `CheckConstraint`, `null=True` + `choices` bastam.

### O que "abre o formulário de captura" significa no desktop

Não existe mockup dedicado da captura desktop do Brain Dump (os 3 mockups referenciados em EXPERIENCE.md §2.1 são Daily Log, Migration Flow e FAB mobile — nenhum de Brain Dump desktop). A leitura mais simples e consistente com a AC #3 ("Hugo aciona o atalho `B` **ou** o item da sidebar" → mesmo resultado) é: o formulário de captura fica **sempre visível** no topo da página `/brain-dump` (Task 9.1/10.1), nunca atrás de um segundo clique ("+"). Isso torna as duas entradas (atalho global `B` e clique no item da sidebar) equivalentes por construção — ambas só precisam navegar para `/brain-dump`, sem nenhum estado de "modal aberto" para sincronizar entre elas. O atalho `B` não abre um modal flutuante sobre a página atual (diferente do Capture Sheet mobile da Story 5.3, que é deliberadamente um overlay para não tirar o usuário do contexto em trânsito — UJ-4). Se essa leitura se provar errada em uso real (Hugo preferir um modal global tipo "quick add" de qualquer tela), é um ajuste de UI isolado a `AppLayout`/`BrainDumpPage`, sem impacto de backend.

### Fora de escopo desta story (Stories 5.2/5.3)

- **Badge numérico** (sidebar + FAB, `GET /api/brain-dump/count`, chave `['brainDump', 'count', userId]`, otimismo na captura) é **Story 5.2** — não implementar aqui. `keys.ts` já reserva `brainDump.count` desde antes desta story; esta story só adiciona `brainDump.list`.
- **FAB + Capture Sheet mobile** (captura rápida universal com destino incluindo Hoje/Semana/Mês/Futuro **fora** do Brain Dump) é **Story 5.3** — o formulário desta story (Task 9.1) é só a captura DENTRO da superfície Brain Dump; não construir o FAB nem o bottom sheet aqui.
- Sem otimismo na lista do Brain Dump (Task 8.3) — só a Story 5.2 precisa de otimismo (no contador do badge, por AD-13 item 5). Invalidação simples no sucesso é suficiente para as mutações desta story.

### Convenção de vocabulário `destination`/`target_log` reaproveitada de `migrate_task`

`today`/`week`/`month`/`future` (sem `cancel`) é o mesmo vocabulário de `TaskDestinationDialog`/`migrate_task` (`DestinationMode`, `frontend/src/features/bujo/components/TaskDestinationDialog.tsx`). Escolha deliberada: qualquer story futura que precise cruzar Brain Dump com o resto do BuJo (ex.: pré-selecionar a aba do `ProcessItemDialog` a partir do `target_log` salvo) não precisa de tradução entre dois vocabulários paralelos.

### Previous Story Intelligence

Story 5.1 é a primeira do Épico 5 — não existe story anterior *no mesmo épico* para herdar aprendizados diretos (o protocolo de "previous story" do workflow de criação não se aplica aqui). Aprendizados relevantes vieram da story mais recente do repositório (4.6, Épico 4, `done`):
- **Contagem de testes sempre real, nunca de memória** (retro Epic 3 §1) — rodar os comandos de verdade (Task 13.1/13.2) antes de escrever Completion Notes/Debug Log.
- **File List por último** (retro Epic 3 §8-2) — `git status --short`/`git diff --stat` depois da verificação manual, não antes (Task 13.4).
- Ambiente de teste do backend usa Postgres remoto (Neon); a 4.6 documentou conexões presas no teardown do pytest-django em rodadas consecutivas — se `pytest` falhar com `DuplicateDatabase`/`ObjectInUse` ao rodar de novo, é ambiente, não regressão desta story (mitigação documentada no Debug Log da 4.6).
- `npm run test` (Vitest) em paralelo pode produzir falhas intermitentes não relacionadas à story; `--no-file-parallelism` é determinístico (mesma nota da 4.6).
- Epic 4 fechou com retrospectiva rodada antes de abrir o Epic 5 (guardrail "retrospective nunca pulada quando o épico realmente fecha") — Epic 5 já está com `epic-5: backlog` → `in-progress` movido por esta mesma execução do workflow (Step 6).

### Git Intelligence

- Branch `main`; HEAD em `2477508` (log final da orquestração do Épico 11 — trabalho recente do repo foi consolidação do Épico 11, não Épico 4/5; a última story de produto antes desta é a 4.6, `done`, commit `a6ebcad` conforme suas próprias Dev Notes). Convenção de commit: `feat(story-5.1): <descrição em pt-BR>`.
- Primeira story do Épico 5 e primeiro app de domínio novo desde `gratitude`/`habits`/`health`/`medications` ainda não existirem — `braindump` é o primeiro desses 4 apps futuros a ser efetivamente criado, o que faz desta story um precedente para como uma app nova se registra (`INSTALLED_APPS`, `_ISOLATION_TEST_MODULES`, prefixo de URL kebab-case) que as Stories dos Épicos 6-9 podem seguir.
- `braindump` já está listado em `pyproject.toml` (`forbidden_modules` do contrato de porta do `core`, `tool.importlinter.contracts`) e em `_bmad-output/planning-artifacts/architecture.md` §7.1 (árvore do projeto) desde a sessão de arquitetura — nenhuma mudança de infraestrutura de guardrail necessária além do `INSTALLED_APPS`/`_ISOLATION_TEST_MODULES` (Tasks 1.4/6.2).

### Project Structure Notes

- Backend: app novo `backend/braindump/` completo (models/serializers/services/views/urls/admin/migrations/tests) — mesmo layout de `bujo/`. Único arquivo de infraestrutura tocado fora do app novo: `config/settings/base.py` (`INSTALLED_APPS`), `config/urls.py` (include), `conftest.py` (`_ISOLATION_TEST_MODULES`). Nenhuma mudança em `core/`.
- Frontend: feature nova `frontend/src/features/braindump/` (api/types/index/components) + página nova `frontend/src/pages/braindump/BrainDumpPage.tsx`. Tocados fora do novo diretório: `api/keys.ts` (seção `brainDump` estendida), `api/types.gen.ts` (regenerado), `app/router.tsx` (troca de `PlaceholderPage` por `BrainDumpPage`, mesmo padrão das Stories 4.5/4.6), `app/layout/AppLayout.tsx` (atalho `B`, estende o `useEffect` do atalho `[` já existente). **`app/layout/Sidebar.tsx` não muda** (item "Brain Dump" já existe e já navega corretamente, ver Task 11.2).
- Fronteiras (§7.2): `features/braindump` não importa `features/bujo` (fronteira de ESLint entre features é só no FRONTEND — o backend não tem essa restrição entre apps de domínio, ver Dev Notes "Por que `braindump` importa serviços de `bujo`"). `pages/braindump` compõe só a feature `braindump` (não precisa compor `bujo` no frontend — a criação da `Task` de destino é 100% backend).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5 intro (linhas 279-283 — "válvula de escape... antecipado para logo após o ciclo BuJo, AD-15"); Story 5.1 (linhas 1046-1067 — user story + 3 ACs); Story 5.2 (linhas 1069-1090 — badge/contador, fora de escopo); Story 5.3 (linhas 1092-1113 — FAB/Capture Sheet mobile, fora de escopo)]
- [Source: _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md#FR-5 (linhas 279-287 — FR-5.1 a FR-5.4); NFR-1 (linha 305 — mobile real, cita brain dump); roadmap Fase 1b (linha 325)]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-13 (linhas 691-723 — badge como server state derivado, TanStack Query, endpoint de contagem — Story 5.2); AD-15 (linhas 743-757 — antecipação para Fase 1b, "trivial e desacoplado"); §6.1 (linhas 856-873 — nomenclatura, `TextChoices`, PKs UUID); §6.2 (linhas 875-892 — apps por domínio incl. `braindump`, assinatura de serviço `*, user, ...`, `@transaction.atomic` no serviço); §6.3 (linhas 894-903 — camelCase na borda, paginação, datas); §6.4 (linhas 905-919 — taxonomia de exceções, mapa exceção→status); §6.7 (linhas 939-947 — contrato de ciclo de vida multi-tenant); §6.9 (linhas 959-976 — enforcement/anti-padrões); §6.10 (linhas 978-1064 — reference implementations: serviço, manager fail-closed, query-key factory); §7.1 (linhas 1099-1141 — árvore do projeto, `braindump/` linhas 1107-1110, `features/` linha 1136); §7.2 (linhas 1143-1152 — fronteiras, regra de porta do `core`, fronteira de features via ESLint no frontend); §7.4 (linhas 1162-1168 — testes/CI, fixture parametrizada de isolamento)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/EXPERIENCE.md#2.1 (linha 60 — tabela de superfícies, Brain Dump); §2.2 (linhas 84/91 — sidebar, item com badge, badge visível colapsada); §2.3 (linhas 102/104 — mobile, FAB abre capture sheet direto — Story 5.3); §4.5 (linhas 258-277 — FAB/Capture Sheet, campos e comportamento — Story 5.3, referência de vocabulário de destino); §4.6 (linhas 280-299 — Sidebar Nav Item, badge só no Brain Dump); §5.4 (linhas 380-385 — estados Vazio/Com itens, microcopy "Brain Dump vazio."); §6.1 (linha 435 — atalho `B` global fora de inputs); §7.2 (linha 494 — aria-label do badge, Story 5.2); Fluxo 2 (linhas 567-579 — UJ-4, captura mobile, contexto)]
- [Source: backend/pyproject.toml (linha 58 — `braindump` já listado em `forbidden_modules` do contrato de porta do `core`, nenhuma mudança necessária)]
- [Source: backend/core/models.py (`TenantModel` — UUID PK, `user_id` auto-preenchido do contextvar, fail-closed); backend/core/tenant.py (`tenant_context`/`TenantManager`); backend/core/exceptions.py (`DomainError`/handler — nenhuma exceção nova necessária, superfície sem máquina de estados); backend/core/tests/registry.py (`register_isolation_case` — mecanismo do fixture parametrizado)]
- [Source: backend/bujo/services/logs.py (`get_or_create_daily_log`/`get_or_create_weekly_log`/`get_or_create_monthly_log` — reaproveitados sem alteração); backend/bujo/services/tasks.py (`create_task`, assinatura + padrão `**{container_field: container}`, linhas ~24-60); backend/bujo/services/migration.py (`migrate_task` — precedente do vocabulário `destination`, linhas 66-113); backend/bujo/serializers.py (`TaskMigrateSerializer` — precedente de validação de `month_first`, linhas 141-161; `TaskCreateSerializer` — precedente de campos opcionais); backend/bujo/views.py (`TaskMigrateView` — precedente de resolução de `month_first` na borda HTTP, linhas 507-536); backend/bujo/models.py (`Task.eisenhower`/`Task.category` — precedente de `choices` nulável sem `CheckConstraint`); backend/bujo/admin.py (padrão `all_objects` no admin); backend/bujo/tests/factories.py (padrão `Params`/`SelfAttribute` para `user_id` não-FK)]
- [Source: backend/conftest.py (`_ISOLATION_TEST_MODULES`, fixtures `user`/`other_user`/`api_client`/`auth_client`); backend/config/settings/base.py (`INSTALLED_APPS` linhas 32-50, `REST_FRAMEWORK` linhas 128-149); backend/config/urls.py (padrão de `include()` por app)]
- [Source: frontend/src/api/keys.ts (seção `brainDump.count` já reservada — comentário sobre ausência de `userId` acessível no frontend, Story 3.2); frontend/src/features/bujo/api.ts (`useCreateWeeklyTaskMutation`/`useDeleteTaskMutation` — precedente de invalidação simples sem otimismo, linhas ~220-255); frontend/src/features/bujo/types.ts (padrão `components['schemas'][...]`); frontend/src/features/bujo/index.ts (padrão de barrel); frontend/src/features/bujo/components/FutureLogItemForm.tsx (`<TextField type="month">`, "sem lib sem necessidade"); frontend/src/features/bujo/components/TaskDestinationDialog.tsx (`DestinationMode`, vocabulário de destino); frontend/src/shared/hooks/useOptimisticMutation.ts (disponível, não usado nesta story — ver Dev Notes)]
- [Source: frontend/src/app/layout/AppLayout.tsx (`useEffect` do atalho `[`, linhas ~24-40 — ponto de extensão para `B`); frontend/src/app/layout/AppLayout.test.tsx (`renderAppLayout`/`mockMatchMedia`, testes do atalho `[`, linhas ~34-49/76-113 — molde para os testes do atalho `B`); frontend/src/app/layout/Sidebar.tsx (item "Brain Dump" já existente, linhas ~66/108 — sem mudança); frontend/src/app/router.tsx (rota `brain-dump` → `PlaceholderPage`, linhas 100-104 — a trocar); frontend/src/pages/daily/DailyPage.tsx (atalho `N` page-scoped + guard `ctrlKey`/`metaKey`/`altKey`, linhas 42-63 — replicar o guard para `B`); frontend/src/pages/archive/ArchivePage.tsx (esqueleto de página de lista simples, estado vazio, `PlannerSkeleton`); frontend/src/pages/PlaceholderPage.tsx (substituído só na rota `brain-dump`)]
- [Source: _bmad-output/implementation-artifacts/4-6-fechamento-de-ciclos-e-arquivo.md#Dev Notes ("File List por último", "contagem de testes sempre real" — guardrails ativos em `_bmad/custom/bmad-dev-story.toml`); #Tasks (precedente de granularidade e nível de detalhe de story)]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- Ambiente: suíte de testes do backend usa Postgres remoto (Neon, `test_neondb`) — reproduzida repetidamente a mesma flakiness já documentada nas retros dos Épicos 3/4 (`OperationalError: server closed the connection unexpectedly` / `database "test_neondb" is being accessed by other users`). Mitigação usada: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'test_neondb'` via `manage.py shell` antes de cada rodada presa. Não é regressão desta story — confirmado rodando a suíte completa (`uv run pytest`, sem escopo de path) limpa duas vezes seguidas: **419 passed** (0 falhas), incluindo os 41 testes novos de `braindump/`.
- Ambiente: `npm run test`/`vitest` sofreu timeouts intermitentes de 5000ms em testes aleatórios (não sempre os mesmos) durante uma janela de carga extrema da máquina (load average de até 171 — processos do sistema, `corespotlightd`/`contactsd`, não relacionados a este trabalho). Confirmado não ser bug: os mesmos testes passam limpos quando a carga cai. Suíte completa do frontend rodada limpa ao final: **577 passed**, 50 arquivos, 0 falhas.
- Gap de infraestrutura encontrado e corrigido: a branch Neon dedicada de E2E (`config.settings.e2e`, `.env.e2e`) não tinha a migration `braindump.0001_initial` aplicada — `GET /api/brain-dump/items/` respondia 500 (`relation "brain_dump_items" does not exist`) na primeira tentativa do spec Playwright novo. Corrigido com `DJANGO_SETTINGS_MODULE=config.settings.e2e uv run python manage.py migrate` (idempotente, só schema aditivo). Após a migration, `frontend/e2e/brain-dump.spec.ts` passou 2/2 contra backend+frontend reais.
- `manage.py spectacular` acusou `unable to guess serializer` nas 3 views novas de `braindump/views.py` (mesmo padrão já visto em `accounts/views.py::signup`, pré-existente) — schema gerado ficava genérico (`"No response body"`, sem schema de request/response). Resolvido com `@extend_schema` explícito por método (mesmo padrão de `bujo/views.py`), exatamente como a Dev Note da Task 4.1 já previa ("adicione `@extend_schema` se o schema vier incompleto").

### Completion Notes List

- Backend (Tasks 1-7): app `braindump/` criado do zero (model `BrainDumpItem` + migration `0001_initial`, serializers, services — `create_brain_dump_item`/`list_brain_dump_items`/`process_brain_dump_item`/`discard_brain_dump_item`, views finas + `@extend_schema` por método, urls, admin com `all_objects`). `process_brain_dump_item` reaproveita `bujo.services.logs`/`bujo.services.tasks` (primeiro import cross-domain do codebase, ver Dev Notes). `INSTALLED_APPS`, `config/urls.py` (`api/brain-dump/`, prefixo kebab-case) e `_ISOLATION_TEST_MODULES` (`conftest.py`) atualizados. Contrato regenerado (`schema.yaml` + `types.gen.ts`); diff conferido — nenhum bloco `security` de endpoint existente foi removido (guardrail retroativo do Epic 3), só adições. Enum gerado confirmado como `TargetLogEnum` (bateu com a previsão da Dev Note). Backend: **419 passed** (suíte completa, sem escopo de path), ruff/lint-imports/`manage.py check` limpos.
- Frontend (Tasks 8-12): data layer (`keys.ts` estendido, `features/braindump/{types,api,index}.ts`), componentes (`BrainDumpCaptureForm` com `forwardRef` para o atalho `B` focar o título, `BrainDumpItemRow` com "Descartar" direto sem confirmação — mesmo padrão de `TaskDetailPanel`, `ProcessItemDialog` com abas Hoje/Esta Semana/Este Mês/Futuro reaproveitando o vocabulário de `TaskDestinationDialog` sem reaproveitar o componente), `BrainDumpPage` (formulário sempre visível no topo, foco automático a cada montagem — Task 10.2), rota `/brain-dump` trocada de `PlaceholderPage`, atalho global `B` estendido no mesmo `useEffect` do atalho `[` em `AppLayout.tsx` (com guard `ctrlKey`/`metaKey`/`altKey`, mesmo cuidado do atalho `N` em `DailyPage.tsx`). Sidebar não precisou de nenhuma mudança (item já existia e já navegava certo). Frontend: **577 passed** (suíte completa), typecheck/lint/build limpos.
- Verificação manual (Task 13.3): feita via novo spec Playwright (`frontend/e2e/brain-dump.spec.ts`) contra backend+frontend reais (branch Neon `e2e` dedicada, mesmo padrão de `archive.spec.ts`/Story 4.6) — **mantido como cobertura de regressão e2e permanente**, não descartado (mesmo padrão real do Epic 4/11, ver guardrail de retro). Cobre: estado vazio "Brain Dump vazio." para usuário novo; captura só com título aparece na lista; captura com destino "Hoje" preenchido aparece igual (dica não muda o comportamento — prova direta da Dev Note "target_log é dica, não placement"); processar para "Hoje" remove o item e a Task aparece no Daily Log real; descartar remove sem criar nada; zero erros de console. 2/2 passou.
- Nenhum gap de especificação (architecture.md/prd.md/epics.md) encontrado durante a implementação — o vocabulário `destination`/`target_log`, a ausência de paginação, a ausência de `CheckConstraint` e a ausência de marca de proveniência na `Task` criada já estavam documentados como esperado pelas Dev Notes desta própria story.
- Adicionado `data-testid="brain-dump-item-row"` em `BrainDumpItemRow.tsx` (não pedido explicitamente pela story) para permitir um locator robusto no spec e2e — mesmo padrão já usado por `TaskRow.tsx` (`data-testid="task-row"`), decisão de consistência, não invenção de padrão novo.

### Senior Developer Review (AI)

**Reviewer:** HugoMMBrito (story-automator, review automatizado) em 2026-07-17

Revisão adversarial completa: git status/diff comparado 1:1 contra o File List (nenhuma discrepância), as 3 ACs verificadas contra a implementação real, as 13 tasks auditadas item a item, código de todos os arquivos do File List lido integralmente. Suítes reexecutadas de verdade (não de memória):
- Backend `braindump/` (escopo do app novo): **43 passed** (41 originais + 2 novas desta revisão), `ruff check`/`lint-imports`/`manage.py check` limpos.
- Backend suíte completa: não foi possível reexecutar até o fim durante esta revisão — load average da máquina chegou a >400 (múltiplas sessões Claude Code concorrentes), processo travado por starvation de CPU (não por bug), abortado. Evidência indireta suficiente: os 419 testes completos já foram documentados como passando pelo próprio Dev Agent Record acima, e o subconjunto de `braindump/` (incluindo os 2 testes novos) passou limpo isoladamente.
- Frontend suíte completa: **577 passed** (50 arquivos), reexecutada do zero e confirmada — bate exatamente com o Completion Notes List acima. `typecheck`/`lint` limpos.
- `router.test.tsx` conferido: Task 12.7 concluiu corretamente que nenhum mock novo era necessário (rota `brain-dump` não é exercitada nesse arquivo; suíte passa sem alteração).

**Achado (MEDIUM, corrigido nesta revisão):** `BrainDumpItemProcessSerializer` (`backend/braindump/serializers.py`) reproduzia o vocabulário de `TaskMigrateSerializer` (`bujo/serializers.py`) mas omitia a validação cruzada `scheduled_date`/`month_first` que o precedente aplica para `destination="future"` (mês/ano de `scheduled_date` deve bater com `month_first`). Sem ela, um POST direto à API (fora da UI desta story, que nunca envia `scheduled_date` para "Futuro") podia criar uma `Task` presa ao `monthly_log` de um mês mas com `scheduled_date` em outro mês — inconsistência de dados sem CHECK constraint no banco para pegar isso. Corrigido copiando a validação exata do precedente + 2 testes novos (`test_brain_dump_item_process_serializer_future_rejeita_scheduled_date_fora_do_mes_de_month_first` / `..._aceita_scheduled_date_no_mes_de_month_first`).

**Nenhum outro achado sobreviveu à verificação** — cobertura de teste é real (não placeholder) em ambos os lados, isolamento de tenant testado fim-a-fim, `@extend_schema` adicionado conforme a própria Dev Note previu, `security` blocks do `schema.yaml` intactos, renomeação de `DestinationEnum` → `TaskMigrateDestinationEnum`/`BrainDumpItemProcessDestinationEnum` é comportamento normal do drf-spectacular ao desambiguar dois enums homônimos (sem nenhum consumidor hardcoded no nome antigo), e o padrão de não resetar estado do diálogo ao reabrir (`ProcessItemDialog`) é herdado fielmente do precedente `TaskDestinationDialog` — não é regressão desta story.

**Outcome:** Approved. 0 issues CRITICAL. Status → `done`.

### File List

- backend/braindump/__init__.py
- backend/braindump/apps.py
- backend/braindump/models.py
- backend/braindump/serializers.py
- backend/braindump/services.py
- backend/braindump/views.py
- backend/braindump/urls.py
- backend/braindump/admin.py
- backend/braindump/migrations/__init__.py
- backend/braindump/migrations/0001_initial.py
- backend/braindump/tests/__init__.py
- backend/braindump/tests/factories.py
- backend/braindump/tests/test_models.py
- backend/braindump/tests/test_serializers.py
- backend/braindump/tests/test_services.py
- backend/braindump/tests/test_views.py
- backend/config/settings/base.py
- backend/config/urls.py
- backend/conftest.py
- schema.yaml
- frontend/src/api/keys.ts
- frontend/src/api/types.gen.ts
- frontend/src/features/braindump/types.ts
- frontend/src/features/braindump/api.ts
- frontend/src/features/braindump/api.test.tsx
- frontend/src/features/braindump/index.ts
- frontend/src/features/braindump/components/BrainDumpCaptureForm.tsx
- frontend/src/features/braindump/components/BrainDumpCaptureForm.test.tsx
- frontend/src/features/braindump/components/BrainDumpItemRow.tsx
- frontend/src/features/braindump/components/BrainDumpItemRow.test.tsx
- frontend/src/features/braindump/components/ProcessItemDialog.tsx
- frontend/src/features/braindump/components/ProcessItemDialog.test.tsx
- frontend/src/pages/braindump/BrainDumpPage.tsx
- frontend/src/pages/braindump/BrainDumpPage.test.tsx
- frontend/src/app/router.tsx
- frontend/src/app/layout/AppLayout.tsx
- frontend/src/app/layout/AppLayout.test.tsx
- frontend/e2e/brain-dump.spec.ts
