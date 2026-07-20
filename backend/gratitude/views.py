"""Views finas do Diário de Gratidão (§6.2): validam → chamam o serviço → serializam.

Um só recurso (como ``bujo``/``braindump``): ``urls.py`` único. GET ``days/?date=``
retorna o read-model da data (default = hoje do usuário); POST ``entries/`` cria uma
entrada (201). **Nunca** ``/api/health/`` (reservado ao liveness). ``APIView`` fina,
``@extend_schema``, ``body.is_valid(raise_exception=True)`` → serviço com
``user=request.user`` → serializa.
"""

from datetime import date as date_cls

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.calendar import today_for
from gratitude.serializers import (
    GratitudeDaySerializer,
    GratitudeEntrySerializer,
    GratitudeEntryWriteSerializer,
    GratitudeMonthSerializer,
)
from gratitude.services import (
    create_gratitude_entry,
    get_gratitude_day,
    get_gratitude_month,
)


def _resolve_day(request):
    """Resolve o parâmetro ``date`` da superfície (default = hoje do usuário via
    ``today_for``). Idioma idêntico ao ``MedicationDayView``; data inválida → 400. O
    ``?date=`` é conveniência de navegação, validada; o cliente **nunca** dita a data
    fora disso (AD-04)."""
    raw = request.query_params.get("date")
    if not raw:
        return today_for(request.user)
    try:
        return date_cls.fromisoformat(raw)
    except ValueError:
        raise serializers.ValidationError(
            {"date": "Data inválida. Use o formato YYYY-MM-DD."}
        ) from None


class GratitudeDayView(APIView):
    """Superfície diária: ``GET days/?date=`` → ``{date, entries}`` (default = hoje).
    Lista simples embutida, **sem paginação** (como as superfícies diárias)."""

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="date", type=str, required=False,
                description="Dia da superfície (YYYY-MM-DD). Default = hoje do usuário.",
            )
        ],
        responses=GratitudeDaySerializer,
    )
    def get(self, request):
        day = _resolve_day(request)
        payload = get_gratitude_day(user=request.user, date=day)
        return Response(GratitudeDaySerializer(payload).data)


def _resolve_month(request):
    """Resolve o parâmetro ``month`` do navegador de mês, normalizando para o dia 1
    (idioma do ``MonthlyLogView``; default = mês corrente via ``today_for``). Data
    inválida → 400. O ``?month=`` é conveniência de navegação, validada; "mês corrente"
    é resolvido no servidor (AD-04)."""
    raw = request.query_params.get("month")
    if not raw:
        return today_for(request.user).replace(day=1)
    try:
        return date_cls.fromisoformat(raw).replace(day=1)
    except ValueError:
        raise serializers.ValidationError(
            {"month": "Data inválida. Use o formato AAAA-MM-DD."}
        ) from None


class GratitudeMonthView(APIView):
    """Superfície de histórico por mês: ``GET months/?month=`` → ``{month, days}`` com as
    entradas do mês agrupadas por dia (default = mês corrente). Somente leitura; lista
    embutida, **sem paginação** (o mês é naturalmente limitado — divergência do range/cap
    da Saúde)."""

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="month", type=str, required=False,
                description=(
                    "Mês do histórico (AAAA-MM-DD; normalizado para o dia 1). "
                    "Default = mês corrente do usuário."
                ),
            )
        ],
        responses=GratitudeMonthSerializer,
    )
    def get(self, request):
        month = _resolve_month(request)
        payload = get_gratitude_month(user=request.user, month=month)
        return Response(GratitudeMonthSerializer(payload).data)


class GratitudeEntryCreateView(APIView):
    """Cria uma entrada (AC1/AC2/AC4): ``POST entries/`` → 201. A ``date`` vem do body
    (data selecionada no composer); ausente → ``today_for(request.user)`` (AD-04). Texto
    em branco → 400 (guard do ``GratitudeEntryWriteSerializer``)."""

    @extend_schema(
        request=GratitudeEntryWriteSerializer, responses=GratitudeEntrySerializer
    )
    def post(self, request):
        body = GratitudeEntryWriteSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = dict(body.validated_data)
        day = data.get("date") or today_for(request.user)
        entry = create_gratitude_entry(
            user=request.user, date=day, text=data["text"]
        )
        return Response(
            GratitudeEntrySerializer(entry).data, status=status.HTTP_201_CREATED
        )
