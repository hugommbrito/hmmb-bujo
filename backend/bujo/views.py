"""Views finas do Daily Log e dos logs de planejamento (§6.2): parseiam/validam
→ chamam o serviço já existente → serializam. Nenhuma regra de transição vive
aqui.
"""

from datetime import date, timedelta

from django.db.models import Count, Q
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from bujo.models import Log, MonthlyLog, Task, WeeklyLog
from bujo.serializers import (
    CatchUpQueueSerializer,
    FutureLogMonthGroupSerializer,
    LogSerializer,
    MigrationQueueSerializer,
    MonthlyLogSerializer,
    MonthlyReviewQueueSerializer,
    MonthlyTaskCreateSerializer,
    TaskCreateSerializer,
    TaskMigrateSerializer,
    TaskReorderSerializer,
    TaskSerializer,
    TaskUpdateSerializer,
    WeeklyLogSerializer,
    WeeklyReviewQueueSerializer,
)
from bujo.services.logs import (
    get_or_create_daily_log,
    get_or_create_monthly_log,
    get_or_create_weekly_log,
)
from bujo.services.migration import migrate_task
from bujo.services.state_machine import transition_task
from bujo.services.tasks import create_task, reorder_task, update_task
from core.calendar import today_for, week_start_of


class TodayLogView(APIView):
    @extend_schema(responses=LogSerializer)
    def get(self, request):
        log_date = today_for(request.user)
        log = get_or_create_daily_log(user=request.user, log_date=log_date)
        return Response(LogSerializer(log).data)


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

        data = {"week_start": weekly_log.week_start, "days": days, "unscheduled": unscheduled}
        return Response(WeeklyLogSerializer(data).data)


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

        data = {"month_first": monthly_log.month_first, "tasks": tasks}
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


class MigrationQueueView(APIView):
    @extend_schema(responses=MigrationQueueSerializer)
    def get(self, request):
        yesterday = today_for(request.user) - timedelta(days=1)
        log = Log.objects.filter(log_date=yesterday).first()  # nunca materializa o log de ontem
        if log is None:
            tasks = Task.objects.none()
        else:
            tasks = log.tasks.filter(
                status__in=[Task.Status.PENDING, Task.Status.STARTED], parent_task__isnull=True
            )
        data = {"log_date": yesterday, "tasks": tasks}
        return Response(MigrationQueueSerializer(data).data)


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
