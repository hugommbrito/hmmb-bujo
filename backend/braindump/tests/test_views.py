"""Testes das views do Brain Dump (AC #1, #2, #3)."""

import pytest

from braindump.models import BrainDumpItem
from braindump.tests.factories import BrainDumpItemFactory
from core.calendar import today_for
from core.tenant import tenant_context


@pytest.mark.django_db
def test_get_items_vazio_retorna_200_com_lista_vazia(auth_client):
    response = auth_client.get("/api/brain-dump/items/")

    assert response.status_code == 200
    assert response.data == []


@pytest.mark.django_db
def test_get_items_com_itens_retorna_lista_ordenada_por_created_at(auth_client, user):
    with tenant_context(user):
        BrainDumpItemFactory(user=user, title="Primeiro")
        BrainDumpItemFactory(user=user, title="Segundo")

    response = auth_client.get("/api/brain-dump/items/")

    assert response.status_code == 200
    assert [item["title"] for item in response.data] == ["Primeiro", "Segundo"]
    assert "created_at" in response.data[0]


@pytest.mark.django_db
def test_post_items_so_com_title_retorna_201_com_target_log_null(auth_client):
    response = auth_client.post(
        "/api/brain-dump/items/", {"title": "Item novo"}, format="json"
    )

    assert response.status_code == 201
    assert response.data["title"] == "Item novo"
    assert response.data["target_log"] is None


@pytest.mark.django_db
def test_post_items_com_os_3_campos_retorna_201_com_os_valores(auth_client):
    response = auth_client.post(
        "/api/brain-dump/items/",
        {"title": "Item novo", "description": "Descrição", "targetLog": "week"},
        format="json",
    )

    assert response.status_code == 201
    assert response.data["title"] == "Item novo"
    assert response.data["description"] == "Descrição"
    assert response.data["target_log"] == "week"


@pytest.mark.django_db
def test_post_items_sem_title_retorna_400(auth_client):
    response = auth_client.post("/api/brain-dump/items/", {}, format="json")

    assert response.status_code == 400


@pytest.mark.django_db
def test_post_process_destination_today_retorna_200_com_a_task_criada(auth_client, user):
    with tenant_context(user):
        item = BrainDumpItemFactory(user=user, title="Item")

    response = auth_client.post(
        f"/api/brain-dump/items/{item.id}/process/", {"destination": "today"}, format="json"
    )

    assert response.status_code == 200
    assert response.data["title"] == "Item"

    listing = auth_client.get("/api/brain-dump/items/")
    assert listing.data == []


@pytest.mark.django_db
def test_post_process_destination_future_sem_month_first_retorna_400(auth_client, user):
    with tenant_context(user):
        item = BrainDumpItemFactory(user=user)

    response = auth_client.post(
        f"/api/brain-dump/items/{item.id}/process/", {"destination": "future"}, format="json"
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_post_process_destination_future_com_month_first_no_mes_corrente_retorna_400(
    auth_client, user
):
    with tenant_context(user):
        item = BrainDumpItemFactory(user=user)
    current_month_first = today_for(user).replace(day=1)

    response = auth_client.post(
        f"/api/brain-dump/items/{item.id}/process/",
        {"destination": "future", "monthFirst": current_month_first.isoformat()},
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_post_process_destination_future_com_month_first_passado_retorna_400(auth_client, user):
    with tenant_context(user):
        item = BrainDumpItemFactory(user=user)
    past_month_first = today_for(user).replace(day=1).replace(
        year=today_for(user).year - 1
    )

    response = auth_client.post(
        f"/api/brain-dump/items/{item.id}/process/",
        {"destination": "future", "monthFirst": past_month_first.isoformat()},
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_post_process_item_de_outro_tenant_retorna_404(auth_client, user, other_user):
    with tenant_context(other_user):
        item = BrainDumpItemFactory(user=other_user)

    response = auth_client.post(
        f"/api/brain-dump/items/{item.id}/process/", {"destination": "today"}, format="json"
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_delete_item_retorna_204_e_remove_o_item(auth_client, user):
    with tenant_context(user):
        item = BrainDumpItemFactory(user=user)

    response = auth_client.delete(f"/api/brain-dump/items/{item.id}/")

    assert response.status_code == 204
    assert not BrainDumpItem.objects.filter(id=item.id).exists()


@pytest.mark.django_db
def test_delete_item_segunda_chamada_no_mesmo_id_retorna_404(auth_client, user):
    with tenant_context(user):
        item = BrainDumpItemFactory(user=user)

    first = auth_client.delete(f"/api/brain-dump/items/{item.id}/")
    second = auth_client.delete(f"/api/brain-dump/items/{item.id}/")

    assert first.status_code == 204
    assert second.status_code == 404


@pytest.mark.django_db
def test_delete_item_de_outro_tenant_retorna_404(auth_client, user, other_user):
    with tenant_context(other_user):
        item = BrainDumpItemFactory(user=other_user)

    response = auth_client.delete(f"/api/brain-dump/items/{item.id}/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_isolamento_fim_a_fim_item_de_um_user_nunca_aparece_para_outro(user, other_user):
    from rest_framework.test import APIClient

    with tenant_context(user):
        BrainDumpItemFactory(user=user, title="Item privado")

    other_client = APIClient()
    other_client.force_authenticate(user=other_user)

    # `force_authenticate` sozinho não passa por `TenantAwareJWTAuthentication`
    # (substitui os authenticators por `ForcedAuthentication`, DRF nunca chama
    # a classe real) — sem `tenant_context` aqui, `current_user_id` fica
    # vazio e o manager fail-closed levantaria `TenantScopeViolation` (500),
    # não o 200 que este teste de isolamento verifica. `tenant_context(other_user)`
    # reproduz o efeito colateral que uma autenticação JWT real produziria.
    with tenant_context(other_user):
        response = other_client.get("/api/brain-dump/items/")

    assert response.status_code == 200
    assert response.data == []


@pytest.mark.django_db
def test_get_count_vazio_retorna_200_com_count_zero(auth_client):
    response = auth_client.get("/api/brain-dump/count/")

    assert response.status_code == 200
    assert response.data == {"count": 0}


@pytest.mark.django_db
def test_get_count_com_n_itens_retorna_200_com_count_n(auth_client, user):
    with tenant_context(user):
        BrainDumpItemFactory.create_batch(3, user=user)

    response = auth_client.get("/api/brain-dump/count/")

    assert response.status_code == 200
    assert response.data == {"count": 3}


@pytest.mark.django_db
def test_get_count_isolamento_itens_de_outro_tenant_nao_afetam_a_contagem(
    auth_client, user, other_user
):
    with tenant_context(user):
        BrainDumpItemFactory(user=user)

    with tenant_context(other_user):
        BrainDumpItemFactory.create_batch(2, user=other_user)

    response = auth_client.get("/api/brain-dump/count/")

    assert response.status_code == 200
    assert response.data == {"count": 1}
