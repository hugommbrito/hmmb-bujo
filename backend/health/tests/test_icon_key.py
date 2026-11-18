"""``icon_key`` em Métricas de Saúde — contrato de API (Story 16.2).

Saúde recebe **só o campo**, sem UI: a apresentação está atrás do gate UX 16.3.
O que precisa estar certo agora é o contrato — criar, ler, editar, limpar,
rejeitar chave inválida — porque ``HealthFieldDefinitionSerializer`` é o **único**
serializer de leitura da app e se propaga para daily/history/series.

O wire é camelCase (``iconKey``); ``response.data`` é snake_case.
"""

from core.tenant import tenant_context
from health.models import HealthFieldDefinition
from health.tests.factories import HealthFieldDefinitionFactory

_URL = "/api/health-field-definitions/"


# --- criar ---------------------------------------------------------------------
def test_post_com_chave_valida_persiste_e_devolve(auth_client, user):
    response = auth_client.post(
        _URL, {"name": "Peso", "fieldType": "decimal", "iconKey": "scales"}, format="json"
    )
    assert response.status_code == 201, response.data
    assert response.data["icon_key"] == "scales"
    with tenant_context(user):
        assert HealthFieldDefinition.objects.get(id=response.data["id"]).icon_key == "scales"


def test_post_sem_chave_devolve_null(auth_client):
    response = auth_client.post(
        _URL, {"name": "Peso", "fieldType": "decimal"}, format="json"
    )
    assert response.status_code == 201, response.data
    assert response.data["icon_key"] is None


def test_post_com_chave_inexistente_retorna_400(auth_client, user):
    response = auth_client.post(
        _URL, {"name": "Peso", "fieldType": "decimal", "iconKey": "nao-existe"},
        format="json",
    )
    assert response.status_code == 400
    assert "icon_key" in response.data.get("fields", {})
    with tenant_context(user):
        assert not HealthFieldDefinition.objects.exists()


def test_post_com_chave_pascalcase_retorna_400(auth_client):
    response = auth_client.post(
        _URL, {"name": "Peso", "fieldType": "decimal", "iconKey": "AddressBook"},
        format="json",
    )
    assert response.status_code == 400
    assert "icon_key" in response.data.get("fields", {})


# --- editar --------------------------------------------------------------------
def test_patch_persiste_a_chave(auth_client, user):
    """Regressão do bug silencioso: fora de ``_MUTABLE_FIELDS`` o PATCH devolveria
    200 sem gravar nada."""
    with tenant_context(user):
        field = HealthFieldDefinitionFactory(user=user)

    response = auth_client.patch(
        f"{_URL}{field.id}/", {"iconKey": "heartbeat"}, format="json"
    )
    assert response.status_code == 200, response.data
    assert response.data["icon_key"] == "heartbeat"
    with tenant_context(user):
        field.refresh_from_db()
        assert field.icon_key == "heartbeat"


def test_patch_com_null_limpa_o_pictograma(auth_client, user):
    with tenant_context(user):
        field = HealthFieldDefinitionFactory(user=user, icon_key="heartbeat")

    response = auth_client.patch(f"{_URL}{field.id}/", {"iconKey": None}, format="json")
    assert response.status_code == 200, response.data
    assert response.data["icon_key"] is None
    with tenant_context(user):
        field.refresh_from_db()
        assert field.icon_key is None


def test_patch_com_chave_inexistente_retorna_400_e_nao_persiste(auth_client, user):
    with tenant_context(user):
        field = HealthFieldDefinitionFactory(user=user, icon_key="heartbeat")

    response = auth_client.patch(
        f"{_URL}{field.id}/", {"iconKey": "nao-existe"}, format="json"
    )
    assert response.status_code == 400
    assert "icon_key" in response.data.get("fields", {})
    with tenant_context(user):
        field.refresh_from_db()
        assert field.icon_key == "heartbeat"


# --- leitura -------------------------------------------------------------------
def test_lista_expoe_a_chave(auth_client, user):
    with tenant_context(user):
        HealthFieldDefinitionFactory(user=user, icon_key="scales")

    response = auth_client.get(_URL)
    assert response.status_code == 200
    assert [f["icon_key"] for f in response.data] == ["scales"]


def test_daily_expoe_a_chave_nas_definicoes(auth_client, user):
    """``HealthFieldDefinitionSerializer`` é reusado pelo read-model do dia — um
    campo adicionado nele propaga para as 4 superfícies de leitura."""
    with tenant_context(user):
        HealthFieldDefinitionFactory(user=user, icon_key="scales")

    response = auth_client.get("/api/health-logs/daily/")
    assert response.status_code == 200, response.data
    assert [f["icon_key"] for f in response.data["fields"]] == ["scales"]


# --- isolamento entre tenants (§6.7) -------------------------------------------
def test_patch_em_definicao_de_outro_tenant_retorna_404(auth_client, other_user):
    with tenant_context(other_user):
        field = HealthFieldDefinitionFactory(user=other_user, icon_key="scales")

    response = auth_client.patch(
        f"{_URL}{field.id}/", {"iconKey": "heartbeat"}, format="json"
    )
    assert response.status_code == 404
    with tenant_context(other_user):
        field.refresh_from_db()
        assert field.icon_key == "scales"


def test_lista_nao_vaza_a_chave_de_outro_tenant(auth_client, user, other_user):
    with tenant_context(other_user):
        HealthFieldDefinitionFactory(user=other_user, icon_key="alien")
    with tenant_context(user):
        HealthFieldDefinitionFactory(user=user, icon_key="scales")

    response = auth_client.get(_URL)
    assert [f["icon_key"] for f in response.data] == ["scales"]
