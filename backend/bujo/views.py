"""Views finas do Daily Log e dos logs de planejamento (§6.2): parseiam/validam
→ chamam o serviço já existente → serializam. Nenhuma regra de transição vive
aqui.
"""

from collections import defaultdict
from datetime import date, timedelta

from django.db.models import Count, Q
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from bujo.models import MonthlyLog, RecurringTaskTemplate, Task, WeeklyLog
from bujo.serializers import (
    ArchiveEntrySerializer,
    BlockingTaskSourceSerializer,
    CatchUpQueueSerializer,
    DensityResponseSerializer,
    FutureLogMonthGroupSerializer,
    LogSerializer,
    MigrationQueueSerializer,
    MonthlyCycleActionSerializer,
    MonthlyCycleSerializer,
    MonthlyLogSerializer,
    MonthlyRecurringSourceSerializer,
    MonthlyReviewQueueSerializer,
    MonthlyTaskCreateSerializer,
    MonthSourceQuerySerializer,
    PendingDailiesSourceSerializer,
    RecurringTaskTemplateCreateSerializer,
    RecurringTaskTemplatePlaceSerializer,
    RecurringTaskTemplateSerializer,
    RecurringTaskTemplateUpdateSerializer,
    RitualDecisionCreateSerializer,
    RitualDecisionSerializer,
    TaskCreateSerializer,
    TaskDensityQuerySerializer,
    TaskDensityResponseSerializer,
    TaskMigrateSerializer,
    TaskReorderSerializer,
    TaskSerializer,
    TaskSourceSerializer,
    TaskUpdateSerializer,
    UnifiedMigrationQueueSerializer,
    WeeklyCycleActionSerializer,
    WeeklyCycleSerializer,
    WeeklyLogSerializer,
    WeeklyRecurringSourceSerializer,
    WeeklyReviewQueueSerializer,
    WeeklyTaskCreateSerializer,
    WeekSourceQuerySerializer,
)
from bujo.services.archive import is_cycle_closed, list_closed_cycles
from bujo.services.cycles import (
    cancel_weekly_planning_target,
    complete_monthly_planning,
    complete_weekly_planning,
    finalize_monthly,
    finalize_weekly,
    open_monthly_planning_target,
    open_weekly_planning_target,
    start_monthly,
    start_weekly,
)
from bujo.services.density import compute_month_density, compute_week_density
from bujo.services.logs import (
    get_or_create_daily_log,
    get_or_create_monthly_log,
    get_or_create_weekly_log,
)
from bujo.services.migration import migrate_task, unified_migration_queue
from bujo.services.recurring import create_template, place_template, update_template
from bujo.services.rituals import (
    list_future_log_items,
    list_monthly_recurring_candidates,
    list_monthly_tasks_in_week,
    list_pending_daily_groups,
    list_previous_monthly_pendings,
    list_previous_weekly_pendings,
    list_weekly_recurring_candidates,
    upsert_ritual_decision,
)
from bujo.services.state_machine import transition_task
from bujo.services.tasks import create_task, delete_task, reorder_task, update_task
from core.calendar import month_turn_week, today_for, week_start_of


class TodayLogView(APIView):
    @extend_schema(responses=LogSerializer)
    def get(self, request):
        log_date_param = request.query_params.get("log_date")
        if log_date_param:
            try:
                log_date = date.fromisoformat(log_date_param)
            except ValueError:
                raise serializers.ValidationError(
                    {"log_date": "Data inválida. Use o formato AAAA-MM-DD."}
                ) from None
        else:
            log_date = today_for(request.user)
        log = get_or_create_daily_log(user=request.user, log_date=log_date)
        return Response(LogSerializer(log, context={"request": request}).data)


class TaskCreateView(APIView):
    @extend_schema(request=TaskCreateSerializer, responses=TaskSerializer)
    def post(self, request):
        body = TaskCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        log = get_or_create_daily_log(user=request.user, log_date=today_for(request.user))
        task = create_task(user=request.user, log=log, **body.validated_data)
        return Response(TaskSerializer(task).data, status=status.HTTP_201_CREATED)


class TaskDetailView(APIView):
    @extend_schema(request=TaskUpdateSerializer, responses=TaskSerializer)
    def patch(self, request, pk):
        body = TaskUpdateSerializer(data=request.data, partial=True)
        body.is_valid(raise_exception=True)
        validated = body.validated_data
        try:
            existing = Task.objects.get(id=pk)
        except Task.DoesNotExist:
            raise NotFound() from None

        # Validação de mês (Task 2.5): só se aplica a tarefas do Monthly Log —
        # o serializer não tem acesso à instância, por isso a checagem vive
        # aqui. Daily/Weekly Log (sem monthly_log) não têm semântica de "mês".
        scheduled_date = validated.get("scheduled_date")
        if (
            "scheduled_date" in validated
            and scheduled_date is not None
            and existing.monthly_log_id is not None
            and (scheduled_date.year, scheduled_date.month)
            != (existing.monthly_log.month_first.year, existing.monthly_log.month_first.month)
        ):
            raise serializers.ValidationError(
                {"scheduled_date": "A data deve pertencer ao mês do Monthly Log."}
            )

        task = update_task(user=request.user, task_id=pk, **validated)
        return Response(TaskSerializer(task).data)

    @extend_schema(responses={204: None, 200: TaskSerializer})
    def delete(self, request, pk):
        try:
            result = delete_task(user=request.user, task_id=pk)
        except Task.DoesNotExist:
            raise NotFound() from None
        if result is None:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(TaskSerializer(result).data, status=status.HTTP_200_OK)


class SubtaskCreateView(APIView):
    @extend_schema(request=TaskCreateSerializer, responses=TaskSerializer)
    def post(self, request, pk):
        body = TaskCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        try:
            parent = Task.objects.get(id=pk)
        except Task.DoesNotExist:
            raise NotFound() from None
        task = create_task(
            user=request.user,
            log=parent.log,
            weekly_log=parent.weekly_log,
            monthly_log=parent.monthly_log,
            parent_task=parent,
            **body.validated_data,
        )
        return Response(TaskSerializer(task).data, status=status.HTTP_201_CREATED)


class TaskTransitionRequestSerializer(serializers.Serializer):
    to_status = serializers.ChoiceField(choices=Task.Status.choices)


class TaskTransitionView(APIView):
    @extend_schema(request=TaskTransitionRequestSerializer, responses=TaskSerializer)
    def post(self, request, pk):
        body = TaskTransitionRequestSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        try:
            task = transition_task(
                user=request.user, task_id=pk, to_status=body.validated_data["to_status"]
            )
        except Task.DoesNotExist:
            raise NotFound() from None
        return Response(TaskSerializer(task).data)


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


class RecurringTaskTemplateListView(APIView):
    @extend_schema(responses=RecurringTaskTemplateSerializer(many=True))
    def get(self, request):
        templates = RecurringTaskTemplate.objects.all().order_by("recurrence_text")
        active_param = request.query_params.get("active")
        if active_param is not None:
            templates = templates.filter(active=active_param.lower() == "true")
        recurrence_group_param = request.query_params.get("recurrence_group")
        if recurrence_group_param:
            templates = templates.filter(recurrence_group=recurrence_group_param)
        unplaced_year_param = request.query_params.get("unplaced_year")
        if unplaced_year_param:
            try:
                unplaced_year = int(unplaced_year_param)
            except ValueError:
                raise serializers.ValidationError(
                    {"unplaced_year": "Deve ser um ano válido (inteiro)."}
                ) from None
            templates = templates.exclude(instances__monthly_log__month_first__year=unplaced_year)
        return Response(RecurringTaskTemplateSerializer(templates, many=True).data)

    @extend_schema(
        request=RecurringTaskTemplateCreateSerializer, responses=RecurringTaskTemplateSerializer
    )
    def post(self, request):
        body = RecurringTaskTemplateCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        template = create_template(user=request.user, **body.validated_data)
        return Response(
            RecurringTaskTemplateSerializer(template).data, status=status.HTTP_201_CREATED
        )


class RecurringTaskTemplateDetailView(APIView):
    @extend_schema(
        request=RecurringTaskTemplateUpdateSerializer, responses=RecurringTaskTemplateSerializer
    )
    def patch(self, request, pk):
        body = RecurringTaskTemplateUpdateSerializer(data=request.data, partial=True)
        body.is_valid(raise_exception=True)
        try:
            template = update_template(
                user=request.user, template_id=pk, **body.validated_data
            )
        except RecurringTaskTemplate.DoesNotExist:
            raise NotFound() from None
        return Response(RecurringTaskTemplateSerializer(template).data)


class RecurringTaskTemplatePlaceView(APIView):
    @extend_schema(request=RecurringTaskTemplatePlaceSerializer, responses=TaskSerializer)
    def post(self, request, pk):
        body = RecurringTaskTemplatePlaceSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        validated = body.validated_data
        try:
            task = place_template(
                user=request.user,
                template_id=pk,
                week_start=validated.get("week_start"),
                month_first=validated.get("month_first"),
                scheduled_date=validated.get("scheduled_date"),
            )
        except RecurringTaskTemplate.DoesNotExist:
            raise NotFound() from None
        return Response(TaskSerializer(task).data, status=status.HTTP_201_CREATED)


class WeeklyLogView(APIView):
    @extend_schema(responses=WeeklyLogSerializer)
    def get(self, request):
        week_start_param = request.query_params.get("week_start")
        if week_start_param:
            try:
                week_start = week_start_of(date.fromisoformat(week_start_param))
            except ValueError:
                raise serializers.ValidationError(
                    {"week_start": "Data inválida. Use o formato AAAA-MM-DD."}
                ) from None
        else:
            week_start = week_start_of(today_for(request.user))
        weekly_log = get_or_create_weekly_log(user=request.user, week_start=week_start)

        days = [
            {
                "date": day,
                "tasks": weekly_log.tasks.filter(scheduled_date=day, parent_task__isnull=True),
            }
            for day in (week_start + timedelta(days=offset) for offset in range(7))
        ]
        unscheduled = weekly_log.tasks.filter(
            scheduled_date__isnull=True, parent_task__isnull=True
        )

        data = {
            "week_start": weekly_log.week_start,
            "days": days,
            "unscheduled": unscheduled,
            "closed": is_cycle_closed(weekly_log),
            # Aditivos (AC8) lidos DIRETO do log: nenhum serviço de ciclo é
            # chamado aqui e nenhum estado é atribuído — navegar não pode criar
            # ciclo operacional (AC4).
            "status": weekly_log.status,
            "planning_completed_at": weekly_log.planning_completed_at,
        }
        return Response(WeeklyLogSerializer(data).data)

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


class MonthlyLogView(APIView):
    @extend_schema(responses=MonthlyLogSerializer)
    def get(self, request):
        month_first_param = request.query_params.get("month_first")
        if month_first_param:
            try:
                month_first = date.fromisoformat(month_first_param).replace(day=1)
            except ValueError:
                raise serializers.ValidationError(
                    {"month_first": "Data inválida. Use o formato AAAA-MM-DD."}
                ) from None
        else:
            month_first = today_for(request.user).replace(day=1)
        monthly_log = get_or_create_monthly_log(user=request.user, month_first=month_first)
        tasks = monthly_log.tasks.filter(parent_task__isnull=True)

        data = {
            "month_first": monthly_log.month_first,
            "tasks": tasks,
            "closed": is_cycle_closed(monthly_log),
            # Aditivos (AC8), lidos direto do log — sem atribuir estado (AC4).
            # Consultar um monthly futuro (armazenamento do Future Log) segue
            # devolvendo `status: null`.
            "status": monthly_log.status,
            "planning_completed_at": monthly_log.planning_completed_at,
        }
        return Response(MonthlyLogSerializer(data).data)

    @extend_schema(request=MonthlyTaskCreateSerializer, responses=TaskSerializer)
    def post(self, request):
        body = MonthlyTaskCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        validated = body.validated_data
        monthly_log = get_or_create_monthly_log(
            user=request.user, month_first=validated["month_first"]
        )
        task = create_task(
            user=request.user,
            monthly_log=monthly_log,
            scheduled_date=validated.get("scheduled_date"),
            title=validated["title"],
            description=validated.get("description"),
            eisenhower=validated.get("eisenhower"),
            category=validated.get("category"),
        )
        return Response(TaskSerializer(task).data, status=status.HTTP_201_CREATED)


# Despacho `action` → serviço, no nível do MÓDULO (não dentro da view): a view
# fica fina de verdade — serializer valida a forma, o dict escolhe o serviço, o
# serviço decide tudo (gates, matriz, idempotência). Zero `atomic` e zero regra
# de transição na camada HTTP (§6.2/§6.6).
WEEKLY_CYCLE_SERVICES = {
    "open_planning_target": open_weekly_planning_target,
    "complete_planning": complete_weekly_planning,
    "start": start_weekly,
    "finalize": finalize_weekly,
    "cancel_planning_target": cancel_weekly_planning_target,
}
MONTHLY_CYCLE_SERVICES = {
    "open_planning_target": open_monthly_planning_target,
    "complete_planning": complete_monthly_planning,
    "start": start_monthly,
    "finalize": finalize_monthly,
}


class WeeklyCycleView(APIView):
    """Ações do ciclo semanal (Story 14.1, AC8) — espelha `tasks/<pk>/transition/`.

    Erros de gate e de matriz sobem como `InvalidTransition`/`CycleTargetConflict`
    (ambos `DomainError`) e viram 409 pelo handler central; nada é tratado aqui.
    """

    @extend_schema(request=WeeklyCycleActionSerializer, responses=WeeklyCycleSerializer)
    def post(self, request):
        body = WeeklyCycleActionSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        validated = body.validated_data
        week_start = validated.get("week_start") or week_start_of(today_for(request.user))

        log = WEEKLY_CYCLE_SERVICES[validated["action"]](
            user=request.user, week_start=week_start
        )
        data = {
            "week_start": log.week_start,
            "status": log.status,
            "planning_completed_at": log.planning_completed_at,
        }
        return Response(WeeklyCycleSerializer(data).data)


class MonthlyCycleView(APIView):
    """Ações do ciclo mensal (Story 14.1, AC8).

    `open_planning_target` não recebe alvo: ele é determinístico (mês seguinte ao
    `active`), sem escolha nem retargeting (M07).
    """

    @extend_schema(request=MonthlyCycleActionSerializer, responses=MonthlyCycleSerializer)
    def post(self, request):
        body = MonthlyCycleActionSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        validated = body.validated_data
        action = validated["action"]

        service = MONTHLY_CYCLE_SERVICES[action]
        if action == "open_planning_target":
            log = service(user=request.user)
        else:
            log = service(user=request.user, month_first=validated["month_first"])

        window_start, window_end = month_turn_week(log.month_first)
        data = {
            "month_first": log.month_first,
            "status": log.status,
            "planning_completed_at": log.planning_completed_at,
            "regular_window_start": window_start,
            "regular_window_end": window_end,
        }
        return Response(MonthlyCycleSerializer(data).data)


class FutureLogView(APIView):
    @extend_schema(responses=FutureLogMonthGroupSerializer(many=True))
    def get(self, request):
        current_month_first = today_for(request.user).replace(day=1)
        monthly_logs = (
            MonthlyLog.objects.filter(month_first__gt=current_month_first)
            .annotate(
                root_task_count=Count("tasks", filter=Q(tasks__parent_task__isnull=True))
            )
            .filter(root_task_count__gt=0)
            .order_by("month_first")
        )
        groups = [
            {
                "year": monthly_log.month_first.year,
                "month": monthly_log.month_first.month,
                "tasks": monthly_log.tasks.filter(parent_task__isnull=True),
            }
            for monthly_log in monthly_logs
        ]
        return Response(FutureLogMonthGroupSerializer(groups, many=True).data)


class TaskDensityView(APIView):
    """Densidade de tarefas por dia do mês (Story 11.3, AC2) — apenas leitura
    agregada, informativa. Conta APENAS tarefas raiz (`parent_task__isnull=True`,
    mesma convenção de WeeklyLogView/LogSerializer/FutureLogView) somando as três
    fontes de "tarefa num dia D":

    - daily  → dia = `log.log_date`;
    - weekly → dia = `scheduled_date` (NULL não conta — sem dia);
    - monthly/annual → dia = `scheduled_date` (idem).

    As três fontes são disjuntas por tarefa (CHECK `task_exactly_one_log`), mas
    uma mesma data pode receber contagens de fontes diferentes — por isso as
    contagens são somadas por data. `Task.objects` (tenant-scoped, fail-closed)
    garante o isolamento por `user_id`; NUNCA `all_objects` (AD-12).
    """

    @extend_schema(
        parameters=[TaskDensityQuerySerializer], responses=TaskDensityResponseSerializer
    )
    def get(self, request):
        query = TaskDensityQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        month_first = query.validated_data["month_first"]
        year, month = month_first.year, month_first.month

        counts: dict[date, int] = defaultdict(int)

        daily = (
            Task.objects.filter(
                log__log_date__year=year,
                log__log_date__month=month,
                parent_task__isnull=True,
            )
            .values("log__log_date")
            .annotate(count=Count("id"))
        )
        for row in daily:
            counts[row["log__log_date"]] += row["count"]

        for source_filter in (
            {"weekly_log__isnull": False},
            {"monthly_log__isnull": False},
        ):
            rows = (
                Task.objects.filter(
                    scheduled_date__year=year,
                    scheduled_date__month=month,
                    parent_task__isnull=True,
                    **source_filter,
                )
                .values("scheduled_date")
                .annotate(count=Count("id"))
            )
            for row in rows:
                counts[row["scheduled_date"]] += row["count"]

        density = [{"date": day, "count": counts[day]} for day in sorted(counts)]
        return Response(TaskDensityResponseSerializer({"density": density}).data)


# --- filas de migração (Story 14.3, AD-28 itens 7-8) ---------------------------
#
# FONTE DE VERDADE: `UnifiedMigrationQueueView` (`/migration/unified-queue/`),
# projeção direta de `services/migration.unified_migration_queue`.
#
# ALIASES: `MigrationQueueView` (`/migration/queue/`) e `CatchUpQueueView`
# (`/catch-up/queue/`) — mesmas rotas, mesmos serializers, ZERO lógica própria de
# query. Cada uma chama o serviço unificado UMA vez e só reagrupa em Python o que
# recebeu. Existem para manter o Daily legado plenamente utilizável (premissa
# blindada até o Épico 17); a remoção formal (rotas + serializers + consumidores)
# é do Épico 18. Testes de caracterização congelam os dois contratos, e um guard
# por `inspect.getsource` falha se alguém "otimizar" um alias reintroduzindo
# query própria.


def _flatten_queue_section(section, *, only_period=None, exclude_period=None):
    """Achata os grupos de uma seção da fila unificada numa lista de tarefas.

    Um helper para os DOIS aliases: eles pedem a mesma operação com parâmetros
    diferentes (`/migration/queue/` quer SÓ o grupo de ontem; `/catch-up/queue/`
    quer TUDO MENOS o grupo de ontem). Escrever a projeção duas vezes seria a
    dívida de gêmeos do Épico 13 outra vez — o que diverge é o parâmetro, e é só
    isso que fica visível no ponto de uso.
    """
    return [
        task
        for group in section["groups"]
        if (only_period is None or group["period_start"] == only_period)
        and (exclude_period is None or group["period_start"] != exclude_period)
        for task in group["items"]
    ]


def _queue_section(queue, source_id):
    return next(section for section in queue["sections"] if section["source_id"] == source_id)


class UnifiedMigrationQueueView(APIView):
    """Fila única de pendências dos três níveis, mês → semana → dia.

    View fina e sem query param: a fila é sempre "tudo que ficou atrás de hoje"
    (AD-09 item 8 — apresenta tudo, item a item, sem janela nem paginação).
    """

    @extend_schema(responses=UnifiedMigrationQueueSerializer)
    def get(self, request):
        queue = unified_migration_queue(user=request.user)
        return Response(UnifiedMigrationQueueSerializer(queue).data)


class MigrationQueueView(APIView):
    """ALIAS FINO de `UnifiedMigrationQueueView` — contrato `{logDate, tasks}`.

    `log_date` vem de `queue["yesterday"]`, pronto do serviço: o alias não
    recalcula tempo por conta própria, o que elimina a chance de incoerência se a
    virada do dia cair entre duas leituras — e é o que torna satisfazível o guard
    de "zero query própria" (o nome da função de calendário nem aparece aqui).
    """

    @extend_schema(responses=MigrationQueueSerializer)
    def get(self, request):
        queue = unified_migration_queue(user=request.user)
        yesterday = queue["yesterday"]
        data = {
            "log_date": yesterday,
            # Só o grupo de ontem (0 ou 1 grupo) — é a diferença entre este
            # alias e o da catch-up, e a razão pela qual a seção `day` precisa
            # dos grupos por `period_start`.
            "tasks": _flatten_queue_section(
                _queue_section(queue, "day"), only_period=yesterday
            ),
        }
        return Response(MigrationQueueSerializer(data).data)


class ArchiveView(APIView):
    @extend_schema(responses=ArchiveEntrySerializer(many=True))
    def get(self, request):
        entries = list_closed_cycles(user=request.user)
        return Response(ArchiveEntrySerializer(entries, many=True).data)


class WeeklyReviewQueueView(APIView):
    @extend_schema(responses=WeeklyReviewQueueSerializer)
    def get(self, request):
        previous_week_start = week_start_of(today_for(request.user)) - timedelta(weeks=1)
        log = WeeklyLog.objects.filter(week_start=previous_week_start).first()  # nunca materializa
        if log is None:
            tasks = Task.objects.none()
        else:
            tasks = log.tasks.filter(
                status__in=[Task.Status.PENDING, Task.Status.STARTED], parent_task__isnull=True
            )
        data = {"week_start": previous_week_start, "tasks": tasks}
        return Response(WeeklyReviewQueueSerializer(data).data)


class MonthlyReviewQueueView(APIView):
    @extend_schema(responses=MonthlyReviewQueueSerializer)
    def get(self, request):
        current_month_first = today_for(request.user).replace(day=1)
        previous_month_first = (current_month_first - timedelta(days=1)).replace(day=1)
        # nunca materializa
        log = MonthlyLog.objects.filter(month_first=previous_month_first).first()
        if log is None:
            tasks = Task.objects.none()
        else:
            tasks = log.tasks.filter(
                status__in=[Task.Status.PENDING, Task.Status.STARTED], parent_task__isnull=True
            )
        data = {"month_first": previous_month_first, "tasks": tasks}
        return Response(MonthlyReviewQueueSerializer(data).data)


class CatchUpQueueView(APIView):
    """ALIAS FINO de `UnifiedMigrationQueueView` (ver a seção de filas acima) —
    contrato `{monthlyTasks, weeklyTasks, dailyTasks}`.

    A única divergência de recorte em relação à fila unificada: `dailyTasks`
    EXCLUI o grupo de ontem, que é território do alias `/migration/queue/`.
    """

    @extend_schema(responses=CatchUpQueueSerializer)
    def get(self, request):
        queue = unified_migration_queue(user=request.user)
        data = {
            "monthly_tasks": _flatten_queue_section(_queue_section(queue, "month")),
            "weekly_tasks": _flatten_queue_section(_queue_section(queue, "week")),
            "daily_tasks": _flatten_queue_section(
                _queue_section(queue, "day"), exclude_period=queue["yesterday"]
            ),
        }
        return Response(CatchUpQueueSerializer(data).data)


class TaskMigrateView(APIView):
    @extend_schema(request=TaskMigrateSerializer, responses=TaskSerializer)
    def post(self, request, pk):
        body = TaskMigrateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        validated = body.validated_data
        destination = validated["destination"]

        month_first = validated.get("month_first")
        current_month_first = today_for(request.user).replace(day=1)
        if destination == "month":
            month_first = current_month_first
        elif (
            destination == "future"
            and month_first is not None
            and month_first <= current_month_first
        ):
            raise serializers.ValidationError(
                {"month_first": "Use 'month' para o mês corrente."}
            )

        try:
            task = migrate_task(
                user=request.user,
                task_id=pk,
                destination=destination,
                month_first=month_first,
                scheduled_date=validated.get("scheduled_date"),
            )
        except Task.DoesNotExist:
            raise NotFound() from None
        return Response(TaskSerializer(task).data)


# --- Rituais (Story 14.2) ------------------------------------------------------
# UMA view por fonte, e nenhuma view agregadora: "fontes carregam/falham
# independentemente" (M06 L251, M07 L309) é requisito de API, não de UI, e só é
# verdade de fato se cada fonte for uma requisição própria — um agregador com
# `try/except` devolveria 200 com erros embutidos e acoplaria os tempos de
# resposta. O rail soma no cliente.
#
# Todas finas (query serializer valida → serviço → serializer de resposta) e
# nenhuma materializa log: os serviços usam `objects.filter(...).first()`.
class _WeekSourceView(APIView):
    """Base das quatro fontes semanais — só o serviço e o serializer variam."""

    service = None
    response_serializer = None

    def get(self, request):
        query = WeekSourceQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        source = self.service(user=request.user, week_start=query.validated_data["week_start"])
        return Response(self.response_serializer(source).data)


class _MonthSourceView(APIView):
    """Base das três fontes mensais (gêmea da semanal: mecânica extraída, não
    copiada — o que diverge é o parâmetro de período e o serviço)."""

    service = None
    response_serializer = None

    def get(self, request):
        query = MonthSourceQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        source = self.service(user=request.user, month_first=query.validated_data["month_first"])
        return Response(self.response_serializer(source).data)


class WeeklyMonthlyInWeekSourceView(_WeekSourceView):
    service = staticmethod(list_monthly_tasks_in_week)
    response_serializer = TaskSourceSerializer

    @extend_schema(parameters=[WeekSourceQuerySerializer], responses=TaskSourceSerializer)
    def get(self, request):
        return super().get(request)


class WeeklyRecurringSourceView(_WeekSourceView):
    service = staticmethod(list_weekly_recurring_candidates)
    response_serializer = WeeklyRecurringSourceSerializer

    @extend_schema(
        parameters=[WeekSourceQuerySerializer], responses=WeeklyRecurringSourceSerializer
    )
    def get(self, request):
        return super().get(request)


class WeeklyPreviousWeeklySourceView(_WeekSourceView):
    service = staticmethod(list_previous_weekly_pendings)
    response_serializer = BlockingTaskSourceSerializer

    @extend_schema(parameters=[WeekSourceQuerySerializer], responses=BlockingTaskSourceSerializer)
    def get(self, request):
        return super().get(request)


class WeeklyPendingDailiesSourceView(_WeekSourceView):
    service = staticmethod(list_pending_daily_groups)
    response_serializer = PendingDailiesSourceSerializer

    @extend_schema(
        parameters=[WeekSourceQuerySerializer], responses=PendingDailiesSourceSerializer
    )
    def get(self, request):
        return super().get(request)


class MonthlyRecurringSourceView(_MonthSourceView):
    service = staticmethod(list_monthly_recurring_candidates)
    response_serializer = MonthlyRecurringSourceSerializer

    @extend_schema(
        parameters=[MonthSourceQuerySerializer], responses=MonthlyRecurringSourceSerializer
    )
    def get(self, request):
        return super().get(request)


class MonthlyFutureLogSourceView(_MonthSourceView):
    service = staticmethod(list_future_log_items)
    response_serializer = TaskSourceSerializer

    @extend_schema(parameters=[MonthSourceQuerySerializer], responses=TaskSourceSerializer)
    def get(self, request):
        return super().get(request)


class MonthlyPreviousMonthlySourceView(_MonthSourceView):
    service = staticmethod(list_previous_monthly_pendings)
    response_serializer = BlockingTaskSourceSerializer

    @extend_schema(parameters=[MonthSourceQuerySerializer], responses=BlockingTaskSourceSerializer)
    def get(self, request):
        return super().get(request)


class WeeklyDensityView(APIView):
    """Densidade real do Weekly-alvo (AC6) — endpoint NOVO.

    `GET /api/bujo/task-density/` fica intocado em rota, forma e semântica: são
    dois contratos distintos (ver docstring de `bujo/services/density.py`), não uma
    correção do antigo.

    NÃO exige alvo em planejamento: aceita qualquer log existente e devolve a
    grade vazia quando o log não existe, para que as Stories 14.5/14.6 (boards em
    `active`) e 14.10 (Arquivo, `finalized`) reusem o mesmo endpoint.
    """

    @extend_schema(parameters=[WeekSourceQuerySerializer], responses=DensityResponseSerializer)
    def get(self, request):
        query = WeekSourceQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        density = compute_week_density(
            user=request.user, week_start=query.validated_data["week_start"]
        )
        return Response(DensityResponseSerializer(density).data)


class MonthlyDensityView(APIView):
    """Densidade real do Monthly-alvo (AC6) — endpoint NOVO, gêmeo do semanal."""

    @extend_schema(parameters=[MonthSourceQuerySerializer], responses=DensityResponseSerializer)
    def get(self, request):
        query = MonthSourceQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        density = compute_month_density(
            user=request.user, month_first=query.validated_data["month_first"]
        )
        return Response(DensityResponseSerializer(density).data)


class RitualDecisionCreateView(APIView):
    """`POST /api/bujo/ritual-decisions/` — persistência imediata, um POST por
    decisão (AD-28 item 6 ponto 6): pausar ou sair do ritual não perde nada.

    O serializer valida FORMA (400). A matriz de combinação legal levanta
    `InvalidRitualDecision` e o alvo fora de `planning` levanta
    `InvalidTransition` — ambas `DomainError`, ambas 409 pelo handler central,
    nenhuma tratada aqui.
    """

    @extend_schema(request=RitualDecisionCreateSerializer, responses=RitualDecisionSerializer)
    def post(self, request):
        body = RitualDecisionCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        decision = upsert_ritual_decision(user=request.user, **body.validated_data)
        return Response(RitualDecisionSerializer(decision).data, status=status.HTTP_201_CREATED)
