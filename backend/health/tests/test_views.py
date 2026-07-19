"""Testes de view/API das Métricas de Saúde (AC1–AC4 + isolamento §6.7).

O wire é camelCase: os bodies enviam ``fieldType``/``enumOptions``/``displayOrder``
(o parser converte para snake_case); ``response.data`` é snake_case (a camelização
só acontece no renderer JSON).
"""

import uuid

from core.tenant import tenant_context
from health.models import HealthFieldDefinition, HealthFieldType
from health.tests.factories import HealthFieldDefinitionFactory

_URL = "/api/health-field-definitions/"


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
