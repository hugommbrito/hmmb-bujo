"""Testes de view/API das Métricas de Saúde (AC1–AC4 + isolamento §6.7).

O wire é camelCase: os bodies enviam ``fieldType``/``enumOptions``/``displayOrder``
(o parser converte para snake_case); ``response.data`` é snake_case (a camelização
só acontece no renderer JSON).
"""

import json
import uuid
from datetime import timedelta

from core.calendar import today_for
from core.tenant import tenant_context
from health.models import HealthFieldDefinition, HealthFieldType, HealthLog
from health.tests.factories import HealthFieldDefinitionFactory

_URL = "/api/health-field-definitions/"
_LOGS_URL = "/api/health-logs/"
_DAILY_URL = "/api/health-logs/daily/"


# --- lista ---------------------------------------------------------------------
def test_get_list_empty_returns_200(auth_client):
    response = auth_client.get(_URL)
    assert response.status_code == 200
    assert response.data == []


# --- criar (AC1, AC3) ----------------------------------------------------------
def test_post_creates_field_active_true_with_uuid(auth_client, user):
    response = auth_client.post(
        _URL, {"name": "Peso", "fieldType": "decimal"}, format="json"
    )
    assert response.status_code == 201, response.data
    assert response.data["name"] == "Peso"
    assert response.data["field_type"] == "decimal"
    assert response.data["active"] is True
    assert response.data["enum_options"] == []
    # id é UUID válido
    uuid.UUID(str(response.data["id"]))
    with tenant_context(user):
        assert HealthFieldDefinition.objects.filter(id=response.data["id"]).exists()


def test_post_enum_with_options_201(auth_client):
    response = auth_client.post(
        _URL,
        {"name": "Humor", "fieldType": "enum", "enumOptions": ["Bom", "Ruim"]},
        format="json",
    )
    assert response.status_code == 201, response.data
    assert response.data["field_type"] == "enum"
    assert response.data["enum_options"] == ["Bom", "Ruim"]


def test_post_enum_without_options_returns_400(auth_client):
    response = auth_client.post(
        _URL, {"name": "Humor", "fieldType": "enum"}, format="json"
    )
    assert response.status_code == 400
    # response.data é snake_case (camelização só no renderer JSON).
    assert "enum_options" in response.data.get("fields", {})


def test_post_non_enum_with_options_returns_400(auth_client):
    response = auth_client.post(
        _URL,
        {"name": "Peso", "fieldType": "decimal", "enumOptions": ["x"]},
        format="json",
    )
    assert response.status_code == 400


def test_post_invalid_field_type_returns_400(auth_client):
    response = auth_client.post(
        _URL, {"name": "X", "fieldType": "invalido"}, format="json"
    )
    assert response.status_code == 400


# --- listar ativos/inativos (AC2) ----------------------------------------------
def test_get_list_hides_inactive_unless_flag(auth_client, user):
    with tenant_context(user):
        HealthFieldDefinitionFactory(user=user, name="Ativo", active=True)
        HealthFieldDefinitionFactory(user=user, name="Inativo", active=False)

    default = auth_client.get(_URL)
    assert {f["name"] for f in default.data} == {"Ativo"}

    with_inactive = auth_client.get(f"{_URL}?includeInactive=true")
    assert {f["name"] for f in with_inactive.data} == {"Ativo", "Inativo"}


# --- editar identidade / field_type imutável (AC4) -----------------------------
def test_patch_updates_name(auth_client, user):
    with tenant_context(user):
        field = HealthFieldDefinitionFactory(user=user, name="Antigo")

    response = auth_client.patch(
        f"{_URL}{field.id}/", {"name": "Novo"}, format="json"
    )
    assert response.status_code == 200, response.data
    assert response.data["name"] == "Novo"


def test_patch_field_type_change_returns_400(auth_client, user):
    with tenant_context(user):
        field = HealthFieldDefinitionFactory(
            user=user, field_type=HealthFieldType.INTEGER
        )

    response = auth_client.patch(
        f"{_URL}{field.id}/", {"fieldType": "decimal"}, format="json"
    )
    assert response.status_code == 400


# --- desativar / reativar via PATCH {active} (AC2) -----------------------------
def test_patch_deactivate_then_reactivate(auth_client, user):
    with tenant_context(user):
        field = HealthFieldDefinitionFactory(user=user, active=True)

    deactivated = auth_client.patch(
        f"{_URL}{field.id}/", {"active": False}, format="json"
    )
    assert deactivated.status_code == 200
    assert deactivated.data["active"] is False

    # some da lista ativa
    listing = auth_client.get(_URL)
    assert field.id not in [uuid.UUID(str(f["id"])) for f in listing.data]

    reactivated = auth_client.patch(
        f"{_URL}{field.id}/", {"active": True}, format="json"
    )
    assert reactivated.status_code == 200
    assert reactivated.data["active"] is True


def test_patch_missing_field_returns_404(auth_client):
    response = auth_client.patch(
        f"{_URL}{uuid.uuid4()}/", {"name": "X"}, format="json"
    )
    assert response.status_code == 404


# --- isolamento multi-tenant (§6.7, g) -----------------------------------------
def test_fields_are_tenant_scoped(auth_client, user, other_user):
    with tenant_context(other_user):
        alheio = HealthFieldDefinitionFactory(user=other_user)

    # auth_client autenticado como `user` — não vê campos de other_user.
    listing = auth_client.get(_URL)
    assert listing.data == []

    # E não consegue mutar o campo do outro tenant (auto-scope → 404).
    patch = auth_client.patch(
        f"{_URL}{alheio.id}/", {"name": "Invadido"}, format="json"
    )
    assert patch.status_code == 404


# ===============================================================================
# Story 7.2 — /api/health-logs/ (PUT upsert) e /daily/ (GET read-model)
# ===============================================================================


# --- PUT upsert (AC1) ----------------------------------------------------------
def test_put_upserts_and_get_daily_reflects(auth_client, user):
    with tenant_context(user):
        field = HealthFieldDefinitionFactory(user=user, field_type=HealthFieldType.DECIMAL)
        today = today_for(user)

    resp = auth_client.put(
        _LOGS_URL,
        {"date": today.isoformat(), "values": {str(field.id): 88.5}},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    # response.data é snake_case e o dict `values` mantém a chave UUID crua.
    assert resp.data["values"] == {str(field.id): 88.5}

    daily = auth_client.get(_DAILY_URL)
    assert daily.status_code == 200
    body = json.loads(daily.content)  # JSON renderizado (camelCase na borda)
    assert body["today"]["values"][str(field.id)] == 88.5


def test_put_missing_date_returns_400(auth_client):
    resp = auth_client.put(_LOGS_URL, {"values": {}}, format="json")
    assert resp.status_code == 400
    assert "date" in resp.data.get("fields", {})


def test_put_invalid_value_type_returns_409(auth_client, user):
    """Tipo incompatível é rejeitado no serviço (DomainError → 409)."""
    with tenant_context(user):
        field = HealthFieldDefinitionFactory(user=user, field_type=HealthFieldType.INTEGER)
        today = today_for(user)
    resp = auth_client.put(
        _LOGS_URL,
        {"date": today.isoformat(), "values": {str(field.id): 1.5}},
        format="json",
    )
    assert resp.status_code == 409


def test_put_unknown_field_returns_409(auth_client, user):
    with tenant_context(user):
        today = today_for(user)
    resp = auth_client.put(
        _LOGS_URL,
        {"date": today.isoformat(), "values": {str(uuid.uuid4()): 5}},
        format="json",
    )
    assert resp.status_code == 409


# --- GET /daily/ (AC3) ---------------------------------------------------------
def test_get_daily_returns_shape(auth_client, user):
    with tenant_context(user):
        HealthFieldDefinitionFactory(user=user, active=True)
    resp = auth_client.get(_DAILY_URL)
    assert resp.status_code == 200
    assert set(resp.data.keys()) == {"yesterday", "today", "fields"}
    assert set(resp.data["yesterday"].keys()) == {"date", "values"}
    assert set(resp.data["today"].keys()) == {"date", "values"}
    assert len(resp.data["fields"]) == 1


def test_get_daily_is_tenant_scoped(auth_client, user, other_user):
    with tenant_context(other_user):
        HealthFieldDefinitionFactory(user=other_user, active=True)
    resp = auth_client.get(_DAILY_URL)
    assert resp.status_code == 200
    # Não vê definições nem logs do outro tenant.
    assert resp.data["fields"] == []
    assert resp.data["yesterday"]["values"] == {}
    assert resp.data["today"]["values"] == {}


# --- AC2: round-trip camelCase idempotente (chaves dinâmicas de `values`) -------
def test_daily_values_dynamic_keys_survive_camelcase_roundtrip(auth_client, user):
    """As chaves DINÂMICAS dentro de `values` NÃO são camelizadas na borda (§6.3, AD-01).

    Prova ponta-a-ponta pela API real (renderer de produção): uma chave com
    underscore (`blood_pressure`) e um UUID sobrevivem intactos no JSON renderido —
    a proteção é o `ignore_fields=("values",)` (base.py), não a forma das chaves.
    Inspeciona `response.content` (JSON renderizado), não `response.data` (pré-render).
    """
    with tenant_context(user):
        yesterday = today_for(user) - timedelta(days=1)
        # Cria a linha direto no ORM (o write valida contra definições; aqui o alvo
        # é o caminho de LEITURA/render de chaves arbitrárias já persistidas).
        HealthLog.objects.create(
            date=yesterday,
            values={"blood_pressure": 120, "a1b2c3d4-ef56-7890": 88.5},
        )

    resp = auth_client.get(_DAILY_URL)
    assert resp.status_code == 200
    body = json.loads(resp.content)
    values = body["yesterday"]["values"]
    # Chave com underscore preservada (NÃO virou bloodPressure).
    assert "blood_pressure" in values
    assert "bloodPressure" not in values
    assert values["blood_pressure"] == 120
    # UUID intacto.
    assert values["a1b2c3d4-ef56-7890"] == 88.5
