"""Views finas do Sistema de Hábitos (§6.2): validam → chamam o serviço → serializam."""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from habits.models import Habit, HabitGroup
from habits.serializers import (
    HabitCreateSerializer,
    HabitGroupCreateSerializer,
    HabitGroupSerializer,
    HabitGroupUpdateSerializer,
    HabitSerializer,
    HabitUpdateSerializer,
    HabitVersionCreateSerializer,
    HabitVersionSerializer,
)
from habits.services import (
    add_habit_version,
    create_habit,
    create_habit_group,
    list_habit_groups,
    list_habits,
    update_habit_identity,
)


class HabitGroupListCreateView(APIView):
    @extend_schema(responses=HabitGroupSerializer(many=True))
    def get(self, request):
        groups = list_habit_groups(user=request.user)
        return Response(HabitGroupSerializer(groups, many=True).data)

    @extend_schema(request=HabitGroupCreateSerializer, responses=HabitGroupSerializer)
    def post(self, request):
        body = HabitGroupCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        group = create_habit_group(user=request.user, **body.validated_data)
        return Response(HabitGroupSerializer(group).data, status=status.HTTP_201_CREATED)


class HabitGroupDetailView(APIView):
    @extend_schema(request=HabitGroupUpdateSerializer, responses=HabitGroupSerializer)
    def patch(self, request, pk):
        body = HabitGroupUpdateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        try:
            group = HabitGroup.objects.get(id=pk)
        except HabitGroup.DoesNotExist:
            raise NotFound() from None
        group.name = body.validated_data["name"]
        group.save(update_fields=["name"])
        return Response(HabitGroupSerializer(group).data)


class HabitListCreateView(APIView):
    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="includeInactive", type=bool, required=False,
                description="Inclui hábitos cuja versão vigente hoje é active=false.",
            )
        ],
        responses=HabitSerializer(many=True),
    )
    def get(self, request):
        include_inactive = request.query_params.get("includeInactive", "").lower() in (
            "true", "1",
        )
        habits = list_habits(user=request.user, include_inactive=include_inactive)
        return Response(HabitSerializer(habits, many=True).data)

    @extend_schema(request=HabitCreateSerializer, responses=HabitSerializer)
    def post(self, request):
        body = HabitCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = dict(body.validated_data)
        group_id = data.pop("group")
        try:
            habit = create_habit(user=request.user, group_id=group_id, **data)
        except HabitGroup.DoesNotExist:
            raise serializers.ValidationError(
                {"group": "Grupo não encontrado."}
            ) from None
        return Response(HabitSerializer(habit).data, status=status.HTTP_201_CREATED)


class HabitDetailView(APIView):
    @extend_schema(request=HabitUpdateSerializer, responses=HabitSerializer)
    def patch(self, request, pk):
        body = HabitUpdateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = dict(body.validated_data)
        if "group" in data:
            data["group_id"] = data.pop("group")
        try:
            habit = update_habit_identity(user=request.user, habit_id=pk, **data)
        except Habit.DoesNotExist:
            raise NotFound() from None
        except HabitGroup.DoesNotExist:
            raise serializers.ValidationError(
                {"group": "Grupo não encontrado."}
            ) from None
        return Response(HabitSerializer(habit).data)


class HabitVersionCreateView(APIView):
    @extend_schema(request=HabitVersionCreateSerializer, responses=HabitVersionSerializer)
    def post(self, request, pk):
        body = HabitVersionCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        try:
            version = add_habit_version(
                user=request.user, habit_id=pk, **body.validated_data
            )
        except Habit.DoesNotExist:
            raise NotFound() from None
        return Response(
            HabitVersionSerializer(version).data, status=status.HTTP_201_CREATED
        )
