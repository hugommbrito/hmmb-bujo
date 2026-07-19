"""Views finas das Métricas de Saúde (§6.2): validam → chamam o serviço → serializam.

Endpoints sob ``/api/health-field-definitions/`` — **não** ``/api/health/`` (reservado
para o liveness check em ``config/urls.py``). Padrão idêntico ao ``habits``: ``APIView``
fina, ``@extend_schema``, ``body.is_valid(raise_exception=True)`` → service
``user=request.user`` → serializa; ``DoesNotExist`` → ``NotFound`` (404).
"""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from health.models import HealthFieldDefinition
from health.serializers import (
    HealthFieldCreateSerializer,
    HealthFieldDefinitionSerializer,
    HealthFieldUpdateSerializer,
)
from health.services import (
    create_health_field,
    list_health_fields,
    update_health_field,
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
