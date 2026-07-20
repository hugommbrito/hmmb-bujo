"""Views finas das Métricas de Saúde (§6.2): validam → chamam o serviço → serializam.

Dois recursos-irmãos (mesmo split de ``habits``): definições sob
``/api/health-field-definitions/`` (7.1) e log diário de valores sob
``/api/health-logs/`` (7.2, ``daily/`` + upsert). **Nunca** ``/api/health/``
(reservado ao liveness check em ``config/urls.py``). Padrão idêntico ao ``habits``:
``APIView`` fina, ``@extend_schema``, ``body.is_valid(raise_exception=True)`` →
service ``user=request.user`` → serializa; ``DoesNotExist`` → ``NotFound`` (404).
"""

from datetime import date as date_cls
from datetime import timedelta

from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from core.calendar import today_for
from core.exceptions import DomainError
from health.models import HealthFieldDefinition
from health.serializers import (
    HealthDailySerializer,
    HealthFieldCreateSerializer,
    HealthFieldDefinitionSerializer,
    HealthFieldSeriesSerializer,
    HealthFieldUpdateSerializer,
    HealthHistorySerializer,
    HealthLogSerializer,
    HealthLogWriteSerializer,
)
from health.services import (
    _validate_history_range,
    create_health_field,
    get_health_daily,
    get_health_field_series,
    get_health_history,
    list_health_fields,
    update_health_field,
    upsert_health_log,
)

# --- Parse de range de datas (histórico read-only, Story 7.3) -----------------
# Default: end = hoje do usuário; start = end - 29 dias (últimos 30 dias, inclusivo).
# NUNCA date.today() cru (autoridade temporal = today_for). Mesmo idioma de
# habits/views.py:51-88 (a resolução de "hoje" é da view, não do serviço).

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


class HealthFieldDefinitionListCreateView(APIView):
    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="includeInactive", type=bool, required=False,
                description="Inclui campos com active=false (desativados).",
            )
        ],
        responses=HealthFieldDefinitionSerializer(many=True),
    )
    def get(self, request):
        include_inactive = request.query_params.get("includeInactive", "").lower() in (
            "true", "1",
        )
        fields = list_health_fields(user=request.user, include_inactive=include_inactive)
        return Response(HealthFieldDefinitionSerializer(fields, many=True).data)

    @extend_schema(
        request=HealthFieldCreateSerializer, responses=HealthFieldDefinitionSerializer
    )
    def post(self, request):
        body = HealthFieldCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        field = create_health_field(user=request.user, **body.validated_data)
        return Response(
            HealthFieldDefinitionSerializer(field).data, status=status.HTTP_201_CREATED
        )


class HealthFieldDefinitionDetailView(APIView):
    """Edita ``name``/``enum_options``/``display_order``/``active`` (AC2, AC4).

    Desativar/reativar é ``PATCH {active: false/true}`` — Saúde não versiona, então
    não há sub-recurso ``versions/`` (precedente ``RecurringTaskTemplate.active``).
    """

    @extend_schema(
        request=HealthFieldUpdateSerializer, responses=HealthFieldDefinitionSerializer
    )
    def patch(self, request, pk):
        body = HealthFieldUpdateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        try:
            field = update_health_field(
                user=request.user, field_id=pk, **body.validated_data
            )
        except HealthFieldDefinition.DoesNotExist:
            raise NotFound() from None
        return Response(HealthFieldDefinitionSerializer(field).data)


class HealthLogDailyView(APIView):
    """Read-model do ritual matinal (Story 7.2, AC3): ``GET /api/health-logs/daily/``.

    Retorna ``{yesterday, today, fields}`` — **ontem no topo, hoje abaixo**. As datas
    são resolvidas pela autoridade temporal do servidor (``today_for``, fuso do
    usuário); o frontend nunca calcula "ontem". Espelha o precedente ``HabitDayView``
    (GET read-model resolvendo o dia; escrita separada).
    """

    @extend_schema(responses=HealthDailySerializer)
    def get(self, request):
        payload = get_health_daily(user=request.user)
        return Response(HealthDailySerializer(payload).data)


class HealthLogUpsertView(APIView):
    """Upsert-merge validado do dia (Story 7.2, AC1/AC4): ``PUT /api/health-logs/``.

    Body ``{date, values}`` → grava só se **todos** os valores forem válidos
    (validação atômica na camada de serviço contra as definições ativas). Merge:
    preserva chaves não submetidas (inclusive de campos inativos — AC4). ``DomainError``
    da validação de conteúdo vira 409 (``custom_exception_handler``).
    """

    @extend_schema(request=HealthLogWriteSerializer, responses=HealthLogSerializer)
    def put(self, request):
        body = HealthLogWriteSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        row = upsert_health_log(
            user=request.user,
            log_date=body.validated_data["date"],
            values=body.validated_data["values"],
        )
        return Response(HealthLogSerializer(row).data)


class HealthHistoryView(APIView):
    """Histórico dia a dia + dashboard de período (Story 7.3, AC1/AC2):
    ``GET /api/health-logs/history/?start=&end=``.

    View fina: resolve o range (default = últimos 30 dias, autoridade ``today_for``)
    → ``get_health_history`` → serializa. Read-only puro (nenhuma escrita, transação
    ou materialização). ``DomainError`` do range (start>end / >92 dias) vira 409;
    data inválida no parâmetro vira 400.
    """

    @extend_schema(parameters=_HISTORY_RANGE_PARAMS, responses=HealthHistorySerializer)
    def get(self, request):
        start, end = _resolve_history_range(request)
        try:
            payload = get_health_history(user=request.user, start=start, end=end)
        except DomainError as exc:
            # Único DomainError possível aqui = range inválido (start>end / >92 dias):
            # parâmetro de requisição ruim → 400 (mesmo idioma da history view de 6.4).
            raise serializers.ValidationError({"detail": str(exc)}) from None
        return Response(HealthHistorySerializer(payload).data)


class HealthFieldSeriesView(APIView):
    """Série de evolução de UM campo numérico (Story 7.3, AC2):
    ``GET /api/health-logs/series/?field=<uuid>&start=&end=``.

    ``field`` é obrigatório (ausente → 400). Campo **não-numérico** → ``DomainError``
    (409); ``field`` inexistente/cross-tenant (ou UUID malformado) → 404. Read-only
    via cast JSONB — nenhuma materialização.
    """

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="field", type=str, required=True,
                description="UUID do campo numérico (integer/decimal) a plotar.",
            ),
            *_HISTORY_RANGE_PARAMS,
        ],
        responses=HealthFieldSeriesSerializer,
    )
    def get(self, request):
        field = request.query_params.get("field")
        if not field:
            raise serializers.ValidationError(
                {"field": "O parâmetro field (UUID do campo) é obrigatório."}
            )
        start, end = _resolve_history_range(request)
        # Duas fontes distintas de DomainError no serviço precisam de status diferentes:
        # (1) range inválido = parâmetro ruim → 400 (validado aqui, antes do serviço);
        # (2) campo não-numérico = conflito de tipo → 409 (propaga do serviço; mesmo
        # idioma do 7.2, onde valor de tipo incompatível também vira 409). A validação
        # de range é redundante com a do serviço (defesa em profundidade), mas permite
        # a separação limpa dos dois status.
        try:
            _validate_history_range(start, end)
        except DomainError as exc:
            raise serializers.ValidationError({"detail": str(exc)}) from None
        try:
            payload = get_health_field_series(
                user=request.user, field_id=field, start=start, end=end
            )
        except (HealthFieldDefinition.DoesNotExist, DjangoValidationError, ValueError):
            # Inexistente, cross-tenant (auto-scope) ou UUID malformado → 404
            # (nunca 500: um field irresolúvel é "não encontrado").
            raise NotFound() from None
        return Response(HealthFieldSeriesSerializer(payload).data)
