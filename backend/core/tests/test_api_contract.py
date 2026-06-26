"""Testes do contrato de API: camelCase, JSONB round-trip, schema e paginação (AC1/AC2/AC3)."""

import json

import pytest
from django.conf import settings
from djangorestframework_camel_case.parser import CamelCaseJSONParser
from djangorestframework_camel_case.render import CamelCaseJSONRenderer
from djangorestframework_camel_case.util import camelize
from rest_framework.request import Request
from rest_framework.test import APIClient, APIRequestFactory


def test_camelcase_renderer_converte_snake_case():
    """Campos snake_case normais viram camelCase na renderização."""
    renderer = CamelCaseJSONRenderer()
    data = {"log_date": "2026-06-26", "health_field_id": "abc-uuid"}
    result = json.loads(renderer.render(data, accepted_media_type="application/json"))
    assert "logDate" in result
    assert "healthFieldId" in result
    assert "log_date" not in result


def test_jsonb_dynamic_keys_sobrevivem_ao_roundtrip():
    """Chaves JSONB dinâmicas dentro de 'values' NÃO são camelizadas (§6.3, AD-01).

    Prova que 'blood_pressure' dentro de health_logs.values não vira 'bloodPressure'.
    Testa via camelize() com ignore_fields — mesma lógica executada pelo renderer
    com JSON_CAMEL_CASE['JSON_UNDERSCOREIZE']['ignore_fields'] configurado em base.py.
    """
    data = {
        "log_date": "2026-06-26",  # Campo normal — DEVE converter
        "values": {
            "blood_pressure": 120,  # Chave dinâmica — NÃO deve converter
            "a1b2c3d4-ef56-7890": 88.5,  # UUID — deve permanecer intacto
        },
    }
    result = camelize(data, ignore_fields=("values",))

    # Campo normal: convertido
    assert "logDate" in result
    assert "log_date" not in result

    # JSONB values: chaves internas preservadas
    assert "blood_pressure" in result["values"], (
        "blood_pressure foi camelizado para bloodPressure — verificar "
        "JSON_CAMEL_CASE['JSON_UNDERSCOREIZE']['ignore_fields'] em settings/base.py"
    )
    assert "bloodPressure" not in result.get("values", {})
    assert "a1b2c3d4-ef56-7890" in result["values"]


def test_jsonb_ignore_fields_configurado_no_renderer():
    """O renderer de produção tem 'values' em ignore_fields via JSON_CAMEL_CASE (§6.3)."""
    renderer = CamelCaseJSONRenderer()
    ignore = renderer.json_underscoreize.get("ignore_fields") or ()
    assert "values" in ignore, (
        f"'values' não está em ignore_fields do renderer: {ignore}. "
        "Verificar JSON_CAMEL_CASE['JSON_UNDERSCOREIZE']['ignore_fields'] em settings/base.py"
    )


@pytest.mark.django_db
def test_schema_endpoint_retorna_200():
    """GET /api/schema/ retorna o schema OpenAPI com content-type JSON (AC1)."""
    client = APIClient()
    response = client.get("/api/schema/", HTTP_ACCEPT="application/json")
    assert response.status_code == 200
    assert "application/json" in response["Content-Type"]
    data = json.loads(response.content)
    assert "openapi" in data
    assert "paths" in data


@pytest.mark.django_db
def test_schema_titulo_e_versao_corretos():
    """Schema OpenAPI inclui título e versão dos SPECTACULAR_SETTINGS (AC1)."""
    client = APIClient()
    response = client.get("/api/schema/", HTTP_ACCEPT="application/json")
    assert response.status_code == 200
    data = json.loads(response.content)
    assert data["info"]["title"] == "hmmb-bujo API"
    assert data["info"]["version"] == "0.1.0"


@pytest.mark.django_db
def test_health_excluido_do_schema():
    """/api/health/ não aparece no schema — @extend_schema(exclude=True) em core/views.py (AC1)."""
    client = APIClient()
    response = client.get("/api/schema/", HTTP_ACCEPT="application/json")
    data = json.loads(response.content)
    assert "/api/health/" not in data.get("paths", {}), (
        "/api/health/ aparece no schema — verificar @extend_schema(exclude=True) em core/views.py"
    )


def test_camelcase_parser_converte_para_snake_case():
    """CamelCaseJSONParser converte camelCase no body de request para snake_case (AC2)."""
    factory = APIRequestFactory()
    raw_request = factory.post(
        "/fake/",
        data=json.dumps({"logDate": "2026-06-26", "healthFieldId": "uuid-123"}),
        content_type="application/json",
    )
    request = Request(raw_request, parsers=[CamelCaseJSONParser()])
    data = request.data
    assert "log_date" in data
    assert "health_field_id" in data
    assert "logDate" not in data
    assert "healthFieldId" not in data


def test_core_pagination_atributos():
    """CorePagination: page_size=50, page_size_query_param='pageSize', max_page_size=200 (AC3)."""
    from core.pagination import CorePagination

    assert CorePagination.page_size == 50
    assert CorePagination.page_size_query_param == "pageSize"
    assert CorePagination.max_page_size == 200


def test_paginacao_shape_padrao():
    """CorePagination produz shape {count, next, previous, results} (AC3)."""
    from core.pagination import CorePagination

    factory = APIRequestFactory()
    request = Request(factory.get("/fake/"))

    paginator = CorePagination()
    page = paginator.paginate_queryset(list(range(100)), request)
    response = paginator.get_paginated_response(page)

    assert set(response.data.keys()) == {"count", "next", "previous", "results"}
    assert response.data["count"] == 100
    assert len(response.data["results"]) == 50


def test_paginacao_class_e_page_size_configurados():
    """DEFAULT_PAGINATION_CLASS e PAGE_SIZE estão corretos em REST_FRAMEWORK (AC3)."""
    assert settings.REST_FRAMEWORK["DEFAULT_PAGINATION_CLASS"] == "core.pagination.CorePagination"
    assert settings.REST_FRAMEWORK["PAGE_SIZE"] == 50


def test_filter_backends_configurados():
    """DjangoFilterBackend e OrderingFilter estão em DEFAULT_FILTER_BACKENDS (AC3)."""
    backends = settings.REST_FRAMEWORK["DEFAULT_FILTER_BACKENDS"]
    assert "django_filters.rest_framework.DjangoFilterBackend" in backends
    assert "rest_framework.filters.OrderingFilter" in backends
