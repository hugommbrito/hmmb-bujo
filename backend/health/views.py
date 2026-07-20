"""Views finas das Métricas de Saúde (§6.2): validam → chamam o serviço → serializam.

Dois recursos-irmãos (mesmo split de ``habits``): definições sob
``/api/health-field-definitions/`` (7.1) e log diário de valores sob
``/api/health-logs/`` (7.2, ``daily/`` + upsert). **Nunca** ``/api/health/``
(reservado ao liveness check em ``config/urls.py``). Padrão idêntico ao ``habits``:
``APIView`` fina, ``@extend_schema``, ``body.is_valid(raise_exception=True)`` →
service ``user=request.user`` → serializa; ``DoesNotExist`` → ``NotFound`` (404).
"""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from health.models import HealthFieldDefinition
from health.serializers import (
    HealthDailySerializer,
    HealthFieldCreateSerializer,
    HealthFieldDefinitionSerializer,
    HealthFieldUpdateSerializer,
    HealthLogSerializer,
    HealthLogWriteSerializer,
)
from health.services import (
    create_health_field,
    get_health_daily,
    list_health_fields,
    update_health_field,
    upsert_health_log,
)


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
