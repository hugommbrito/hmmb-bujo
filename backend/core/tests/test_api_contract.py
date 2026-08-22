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


@pytest.mark.django_db
def test_swagger_ui_endpoint_retorna_200():
    """GET /api/schema/swagger-ui/ serve a UI anônima — baseline que não existia (DW-34)."""
    client = APIClient()
    response = client.get("/api/schema/swagger-ui/")
    assert response.status_code == 200


@pytest.mark.django_db
def test_schema_com_authorization_header_invalido_retorna_200():
    """DW-34: espelho de test_health_com_authorization_header_invalido_retorna_200 (DW-24).

    Antes de `SERVE_AUTHENTICATION: []`, `SpectacularAPIView` herdava
    DEFAULT_AUTHENTICATION_CLASSES (`TenantAwareJWTAuthentication`) e um bearer
    malformado era rejeitado com 401 antes de a view rodar — apesar de a rota estar
    registrada sem gate de DEBUG e responder 200 sem header nenhum. Nenhum dos 3
    testes de schema existentes mandava `Authorization`, então a falha era invisível.
    """
    client = APIClient()
    response = client.get(
        "/api/schema/", HTTP_ACCEPT="application/json", HTTP_AUTHORIZATION="Bearer garbage"
    )

    assert response.status_code == 200
    data = json.loads(response.content)
    assert "openapi" in data
    # Não basta o 200 e o envelope: `SERVE_AUTHENTICATION` interage com
    # `SERVE_PUBLIC`. Se `SERVE_PUBLIC` virasse False (movimento natural de
    # hardening), o drf-spectacular geraria o schema para um usuário
    # permanentemente anônimo e poderia emitir um documento quase vazio — com
    # `openapi` presente e este teste verde. Pinar uma rota conhecida fecha isso.
    assert "/api/bujo/tasks/" in data.get("paths", {}), (
        "o schema veio sem /api/bujo/tasks/ — documento truncado; verificar "
        "SERVE_PUBLIC/SERVE_AUTHENTICATION em SPECTACULAR_SETTINGS"
    )


@pytest.mark.django_db
def test_swagger_ui_com_authorization_header_invalido_retorna_200():
    """DW-34: a mesma chave conserta a segunda rota de schema (AUTHENTICATION_CLASSES
    é compartilhado por todas as views `serve` do drf-spectacular)."""
    client = APIClient()
    response = client.get("/api/schema/swagger-ui/", HTTP_AUTHORIZATION="Bearer garbage")

    assert response.status_code == 200
    # O status sozinho não distingue "UI servida" de "200 com página quebrada", e o
    # ledger da DW-34 registra uma alegação (não reproduzida) de 500 no render do
    # template do swagger-ui. Afirmar o corpo é o que pegaria isso.
    body = response.content.decode()
    assert "<title>hmmb-bujo API</title>" in body, (
        f"swagger-ui não renderizou o título dos SPECTACULAR_SETTINGS: {body[:200]!r}"
    )
    assert 'id="swagger-ui"' in body
    assert "/api/schema/" in body


def test_views_de_schema_resolvem_authentication_classes_vazio():
    """Prova mecânica do conserto da DW-34, no atributo que de fato o carrega.

    `drf_spectacular/views.py` resolve `AUTHENTICATION_CLASSES` no IMPORT do módulo
    (`if spectacular_settings.SERVE_AUTHENTICATION is not None`), antes de qualquer
    teste rodar — por isso o conserto mora em settings/base.py e não pode ser
    exercitado por `override_settings`. Os 3 testes acima provam o comportamento via
    HTTP; este pina o mecanismo, e falharia também se a chave virasse `None` ou
    sumisse (aí o atributo voltaria a ser o TenantAwareJWTAuthentication global).
    """
    from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

    # Afirmar "presente e vazio", não `== []`: o teste na lib é `is not None`, então
    # `()` funciona idêntico e não deve ser reprovado aqui. O que importa é que a
    # chave exista, não seja None e não carregue autenticador nenhum.
    assert "SERVE_AUTHENTICATION" in settings.SPECTACULAR_SETTINGS, (
        "SPECTACULAR_SETTINGS não declara SERVE_AUTHENTICATION — sem a chave a lib cai "
        "em DEFAULT_AUTHENTICATION_CLASSES e as views de schema voltam a recusar um "
        "Authorization inválido"
    )
    serve_authentication = settings.SPECTACULAR_SETTINGS["SERVE_AUTHENTICATION"]
    assert serve_authentication is not None and len(serve_authentication) == 0, (
        f"SERVE_AUTHENTICATION deve ser uma sequência vazia, é {serve_authentication!r}; "
        "`None` faz a lib cair em DEFAULT_AUTHENTICATION_CLASSES (o teste é `is not None`)"
    )
    assert list(SpectacularAPIView.authentication_classes) == [], (
        "SpectacularAPIView herdou autenticadores: "
        f"{SpectacularAPIView.authentication_classes} — verificar "
        "SPECTACULAR_SETTINGS['SERVE_AUTHENTICATION'] em settings/base.py"
    )
    assert list(SpectacularSwaggerView.authentication_classes) == [], (
        "SpectacularSwaggerView herdou autenticadores: "
        f"{SpectacularSwaggerView.authentication_classes} — verificar "
        "SPECTACULAR_SETTINGS['SERVE_AUTHENTICATION'] em settings/base.py"
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
