"""Views finas do Sistema de Hábitos (§6.2): validam → chamam o serviço → serializam."""

from datetime import date as date_cls

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from core.calendar import today_for
from habits.models import Habit, HabitDayEntry, HabitGroup
from habits.serializers import (
    HabitCreateSerializer,
    HabitDayEntrySerializer,
    HabitDayEntryUpdateSerializer,
    HabitDaySerializer,
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
    compute_day_completeness,
    create_habit,
    create_habit_group,
    list_habit_groups,
    list_habits,
    seed_habit_day,
    update_habit_day_entry,
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


class HabitDayView(APIView):
    """Tracker do dia (snapshot realizado, Story 6.2).

    ``GET`` materializa (idempotente) as linhas do dia via ``seed_habit_day`` e
    retorna ``{date, totalCompletion, groups, entries}`` (default = hoje).
    """

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="date", type=str, required=False,
                description="Dia do tracker (YYYY-MM-DD). Default = hoje do usuário.",
            )
        ],
        responses=HabitDaySerializer,
    )
    def get(self, request):
        raw = request.query_params.get("date")
        if raw:
            try:
                day = date_cls.fromisoformat(raw)
            except ValueError:
                raise serializers.ValidationError(
                    {"date": "Data inválida. Use o formato YYYY-MM-DD."}
                ) from None
        else:
            day = today_for(request.user)

        seed_habit_day(user=request.user, date=day)
        completeness = compute_day_completeness(user=request.user, date=day)
        entries = HabitDayEntry.objects.filter(date=day).select_related(
            "habit", "habit__group"
        )
        payload = {
            "date": day,
            "total_completion": completeness["total"],
            "groups": completeness["groups"],
            "entries": entries,
        }
        return Response(HabitDaySerializer(payload).data)


class HabitDayEntryDetailView(APIView):
    """Marcação e correção avulsa de uma linha do dia (UPDATE só naquela linha)."""

    @extend_schema(
        request=HabitDayEntryUpdateSerializer, responses=HabitDayEntrySerializer
    )
    def patch(self, request, pk):
        body = HabitDayEntryUpdateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        try:
            entry = update_habit_day_entry(
                user=request.user, entry_id=pk, **body.validated_data
            )
        except HabitDayEntry.DoesNotExist:
            raise NotFound() from None
        return Response(HabitDayEntrySerializer(entry).data)
