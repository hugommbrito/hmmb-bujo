"""Testes de view/API das Métricas de Saúde (AC1–AC4 + isolamento §6.7).

O wire é camelCase: os bodies enviam ``fieldType``/``enumOptions``/``displayOrder``
(o parser converte para snake_case); ``response.data`` é snake_case (a camelização
só acontece no renderer JSON).
"""

import json
import uuid
from datetime import date, timedelta

from core.calendar import today_for
from core.tenant import tenant_context
from health.models import HealthFieldDefinition, HealthFieldType, HealthLog
from health.tests.factories import HealthFieldDefinitionFactory, HealthLogFactory

_URL = "/api/health-field-definitions/"
_LOGS_URL = "/api/health-logs/"
_DAILY_URL = "/api/health-logs/daily/"
_HISTORY_URL = "/api/health-logs/history/"
_SERIES_URL = "/api/health-logs/series/"


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


# ===============================================================================
# Story 7.3 — /api/health-logs/history/ e /series/ (GET read-only)
# ===============================================================================

_HV_START = date(2026, 2, 1)
_HV_D1 = date(2026, 2, 3)
_HV_D2 = date(2026, 2, 5)
_HV_END = date(2026, 2, 28)


def _range_qs(start=_HV_START, end=_HV_END):
    return f"?start={start.isoformat()}&end={end.isoformat()}"


# --- GET /history/ (AC1, AC2) --------------------------------------------------
def test_get_history_returns_shape(auth_client, user):
    """200 com {start, end, fields, days, summary}; response.data é snake_case."""
    with tenant_context(user):
        f = HealthFieldDefinitionFactory(
            user=user, field_type=HealthFieldType.DECIMAL, name="Peso"
        )
        HealthLogFactory(user=user, date=_HV_D1, values={str(f.id): 80.5})
        HealthLogFactory(user=user, date=_HV_D2, values={str(f.id): 82.0})

    resp = auth_client.get(f"{_HISTORY_URL}{_range_qs()}")
    assert resp.status_code == 200, resp.data
    assert set(resp.data.keys()) == {"start", "end", "fields", "days", "summary"}
    assert resp.data["start"] == _HV_START.isoformat()
    assert len(resp.data["days"]) == 2
    assert resp.data["days"][0]["values"] == {str(f.id): 80.5}
    # summary tem o campo numérico com os fatos do período.
    assert len(resp.data["summary"]) == 1
    summ = resp.data["summary"][0]
    assert summ["count"] == 2
    assert summ["min"] == 80.5
    assert summ["max"] == 82.0
    assert summ["latest"] == 82.0


def test_get_history_wire_is_camel_case_but_values_keys_preserved(auth_client, user):
    """O JSON renderizado é camelCase (fieldId), mas as chaves dinâmicas de
    ``values`` (UUID) NÃO são camelizadas (§6.3)."""
    with tenant_context(user):
        f = HealthFieldDefinitionFactory(
            user=user, field_type=HealthFieldType.DECIMAL, name="Peso"
        )
        HealthLogFactory(user=user, date=_HV_D1, values={str(f.id): 80.5})

    resp = auth_client.get(f"{_HISTORY_URL}{_range_qs()}")
    body = json.loads(resp.content)
    assert body["summary"][0]["fieldId"] == str(f.id)  # camelCase na borda
    assert str(f.id) in body["days"][0]["values"]  # chave UUID intacta


def test_get_history_default_range_ok(auth_client, user):
    """Sem params: default end=hoje, start=hoje-29 (últimos 30 dias)."""
    with tenant_context(user):
        HealthFieldDefinitionFactory(user=user)
    resp = auth_client.get(_HISTORY_URL)
    assert resp.status_code == 200, resp.data
    assert resp.data["end"] == today_for(user).isoformat()


def test_get_history_cross_tenant_isolated(auth_client, user, other_user):
    with tenant_context(other_user):
        alheio = HealthFieldDefinitionFactory(
            user=other_user, field_type=HealthFieldType.INTEGER
        )
        HealthLogFactory(user=other_user, date=_HV_D1, values={str(alheio.id): 5})
    resp = auth_client.get(f"{_HISTORY_URL}{_range_qs()}")
    assert resp.status_code == 200
    assert resp.data["days"] == []
    assert resp.data["fields"] == []
    assert resp.data["summary"] == []


def test_get_history_invalid_date_returns_400(auth_client):
    resp = auth_client.get(f"{_HISTORY_URL}?start=2026-13-99&end=2026-01-01")
    assert resp.status_code == 400
    assert "start" in resp.data.get("fields", {})


def test_get_history_range_too_large_returns_400(auth_client):
    resp = auth_client.get(f"{_HISTORY_URL}?start=2026-01-01&end=2026-06-01")
    assert resp.status_code == 400
    assert "exceder" in resp.data["detail"]


# --- GET /series/ (AC2) --------------------------------------------------------
def test_get_series_returns_shape(auth_client, user):
    """200 com {field, points}; série ordenada; snake_case em response.data."""
    with tenant_context(user):
        f = HealthFieldDefinitionFactory(
            user=user, field_type=HealthFieldType.DECIMAL, name="Peso"
        )
        HealthLogFactory(user=user, date=_HV_D2, values={str(f.id): 82.0})
        HealthLogFactory(user=user, date=_HV_D1, values={str(f.id): 80.5})

    resp = auth_client.get(f"{_SERIES_URL}?field={f.id}&{_range_qs()[1:]}")
    assert resp.status_code == 200, resp.data
    assert resp.data["field"]["name"] == "Peso"
    assert [(p["date"], p["value"]) for p in resp.data["points"]] == [
        (_HV_D1.isoformat(), 80.5),
        (_HV_D2.isoformat(), 82.0),
    ]


def test_get_series_missing_field_returns_400(auth_client):
    resp = auth_client.get(f"{_SERIES_URL}{_range_qs()}")
    assert resp.status_code == 400
    assert "field" in resp.data.get("fields", {})


def test_get_series_non_numeric_field_returns_409(auth_client, user):
    """Campo não-numérico = conflito de tipo → 409 (mesmo idioma do 7.2)."""
    with tenant_context(user):
        boolean = HealthFieldDefinitionFactory(
            user=user, field_type=HealthFieldType.BOOLEAN
        )
    resp = auth_client.get(f"{_SERIES_URL}?field={boolean.id}")
    assert resp.status_code == 409


def test_get_series_cross_tenant_field_returns_404(auth_client, other_user):
    with tenant_context(other_user):
        alheio = HealthFieldDefinitionFactory(
            user=other_user, field_type=HealthFieldType.INTEGER
        )
    resp = auth_client.get(f"{_SERIES_URL}?field={alheio.id}")
    assert resp.status_code == 404


def test_get_series_nonexistent_field_returns_404(auth_client):
    resp = auth_client.get(f"{_SERIES_URL}?field={uuid.uuid4()}")
    assert resp.status_code == 404


def test_get_series_malformed_field_returns_404(auth_client):
    """UUID malformado no param → 404 (nunca 500)."""
    resp = auth_client.get(f"{_SERIES_URL}?field=nao-e-uuid")
    assert resp.status_code == 404


def test_get_series_range_too_large_returns_400(auth_client, user):
    with tenant_context(user):
        f = HealthFieldDefinitionFactory(user=user, field_type=HealthFieldType.INTEGER)
    resp = auth_client.get(f"{_SERIES_URL}?field={f.id}&start=2026-01-01&end=2026-06-01")
    assert resp.status_code == 400
    assert "exceder" in resp.data["detail"]
