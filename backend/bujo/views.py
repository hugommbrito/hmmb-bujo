"""Views finas do Daily Log (§6.2): parseiam/validam → chamam o serviço já
existente → serializam. Nenhuma regra de transição vive aqui.
"""

from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from bujo.models import Task
from bujo.serializers import (
    LogSerializer,
    TaskCreateSerializer,
    TaskSerializer,
    TaskUpdateSerializer,
)
from bujo.services.logs import get_or_create_daily_log
from bujo.services.state_machine import transition_task
from bujo.services.tasks import create_task, update_task
from core.calendar import today_for


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
            user=request.user, log=parent.log, parent_task=parent, **body.validated_data
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
