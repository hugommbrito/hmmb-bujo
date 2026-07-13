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

from bujo.models import MonthlyLog, Task
from bujo.serializers import (
    FutureLogMonthGroupSerializer,
    LogSerializer,
    MonthlyLogSerializer,
    MonthlyTaskCreateSerializer,
    TaskCreateSerializer,
    TaskReorderSerializer,
    TaskSerializer,
    TaskUpdateSerializer,
    WeeklyLogSerializer,
)
from bujo.services.logs import (
    get_or_create_daily_log,
    get_or_create_monthly_log,
    get_or_create_weekly_log,
)
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
        try:
            task = update_task(user=request.user, task_id=pk, **body.validated_data)
        except Task.DoesNotExist:
            raise NotFound() from None
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
