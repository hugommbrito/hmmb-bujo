"""Views finas do Sistema de Hábitos (§6.2): validam → chamam o serviço → serializam."""

from datetime import date as date_cls
from datetime import timedelta

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from core.calendar import resolve_day_type, today_for
from core.exceptions import DomainError
from habits.models import Habit, HabitDayEntry, HabitGroup
from habits.serializers import (
    GroupMultipliersSerializer,
    HabitCreateSerializer,
    HabitDayEntrySerializer,
    HabitDayEntryUpdateSerializer,
    HabitDaySerializer,
    HabitGroupCreateSerializer,
    HabitGroupSerializer,
    HabitGroupUpdateSerializer,
    HabitHistoryRangeSerializer,
    HabitSerializer,
    HabitSeriesSerializer,
    HabitUpdateSerializer,
    HabitVersionCreateSerializer,
    HabitVersionSerializer,
    HolidayResultSerializer,
    SetGroupMultipliersSerializer,
    SetHolidaySerializer,
)
from habits.services import (
    add_habit_version,
    compute_day_completeness,
    create_habit,
    create_habit_group,
    current_multipliers_of,
    get_habit_history_range,
    get_habit_series,
    list_habit_groups,
    list_habits,
    seed_habit_day,
    set_group_day_multiplier,
    set_holiday,
    update_habit_day_entry,
    update_habit_identity,
)

# --- Parse de range de datas (histórico read-only, Story 6.4) -----------------
# Default: end = hoje do usuário; start = end - 29 dias (últimos 30 dias, inclusivo).
# NUNCA date.today() cru (autoridade temporal = today_for).

_HISTORY_DEFAULT_SPAN = timedelta(days=29)


def _parse_date_param(raw, field):
    try:
        return date_cls.fromisoformat(raw)
    except ValueError:
        raise serializers.ValidationError(
            {field: "Data inválida. Use o formato YYYY-MM-DD."}
        ) from None


def _resolve_history_range(request):
    end_raw = request.query_params.get("end")
    start_raw = request.query_params.get("start")
    end = _parse_date_param(end_raw, "end") if end_raw else today_for(request.user)
    start = (
        _parse_date_param(start_raw, "start")
        if start_raw
        else end - _HISTORY_DEFAULT_SPAN
    )
    return start, end


_HISTORY_RANGE_PARAMS = [
    OpenApiParameter(
        name="start", type=str, required=False,
        description="Início do intervalo (YYYY-MM-DD). Default = fim − 29 dias.",
    ),
    OpenApiParameter(
        name="end", type=str, required=False,
        description="Fim do intervalo (YYYY-MM-DD). Default = hoje do usuário.",
    ),
]


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
            "day_type": resolve_day_type(request.user, day),
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


class HabitGroupMultipliersView(APIView):
    """Config prospectiva do multiplicador por grupo × tipo de dia (Story 6.3).

    ``GET`` → config vigente hoje (``{weekend, holiday}``). ``PUT`` → aplica as
    chaves enviadas (prospectivo, não sangra dias congelados) e devolve a config
    vigente resultante.
    """

    @extend_schema(responses=GroupMultipliersSerializer)
    def get(self, request, pk):
        try:
            group = HabitGroup.objects.get(id=pk)
        except HabitGroup.DoesNotExist:
            raise NotFound() from None
        data = current_multipliers_of(group, today_for(request.user))
        return Response(GroupMultipliersSerializer(data).data)

    @extend_schema(
        request=SetGroupMultipliersSerializer, responses=GroupMultipliersSerializer
    )
    def put(self, request, pk):
        body = SetGroupMultipliersSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        try:
            for day_type in ("weekend", "holiday"):
                value = body.validated_data.get(day_type)
                if value is not None:
                    set_group_day_multiplier(
                        user=request.user, group_id=pk,
                        day_type=day_type, multiplier=value,
                    )
            group = HabitGroup.objects.get(id=pk)
        except HabitGroup.DoesNotExist:
            raise NotFound() from None
        except DomainError as exc:
            raise serializers.ValidationError({"detail": str(exc)}) from None
        data = current_multipliers_of(group, today_for(request.user))
        return Response(GroupMultipliersSerializer(data).data)


class HabitHolidayView(APIView):
    """Marca/desmarca um dia como feriado (Story 6.3): escreve ``accounts.UserHoliday``
    e recalcula (bounded) só aquele dia. ``POST``/``PATCH`` são equivalentes."""

    @extend_schema(request=SetHolidaySerializer, responses=HolidayResultSerializer)
    def post(self, request):
        body = SetHolidaySerializer(data=request.data)
        body.is_valid(raise_exception=True)
        set_holiday(user=request.user, **body.validated_data)
        day = body.validated_data["date"]
        result = {"date": day, "day_type": resolve_day_type(request.user, day)}
        return Response(HolidayResultSerializer(result).data)

    patch = post


class HabitHistoryRangeView(APIView):
    """Histórico por-data no intervalo (Story 6.4) — GET puro, read-only, não-semeador.

    Alimenta a grade hábitos × dias **e** o detalhe por-data (fatia do mesmo payload).
    **Nunca** materializa (não chama ``seed_habit_day``): dias nunca abertos são
    lacunas honestas (``totalCompletion=null``), não 0% fabricado (AC1).
    """

    @extend_schema(
        parameters=_HISTORY_RANGE_PARAMS, responses=HabitHistoryRangeSerializer
    )
    def get(self, request):
        start, end = _resolve_history_range(request)
        try:
            data = get_habit_history_range(user=request.user, start=start, end=end)
        except DomainError as exc:
            raise serializers.ValidationError({"detail": str(exc)}) from None
        return Response(HabitHistoryRangeSerializer(data).data)


class HabitSeriesView(APIView):
    """Série de evolução + eventos de mudança de UM hábito (Story 6.4) — GET read-only.

    Série diária derivada on-read de ``habit_day_entries``; eventos derivados do stream
    de ``habit_versions``; ritmo (day_type) para o sombreamento. ``Habit.DoesNotExist``
    (inclusive cross-tenant) → 404, como as views existentes.
    """

    @extend_schema(parameters=_HISTORY_RANGE_PARAMS, responses=HabitSeriesSerializer)
    def get(self, request, pk):
        start, end = _resolve_history_range(request)
        try:
            data = get_habit_series(
                user=request.user, habit_id=pk, start=start, end=end
            )
        except Habit.DoesNotExist:
            raise NotFound() from None
        except DomainError as exc:
            raise serializers.ValidationError({"detail": str(exc)}) from None
        return Response(HabitSeriesSerializer(data).data)
