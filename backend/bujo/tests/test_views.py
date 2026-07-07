"""Testes de `TodayLogView`/`TaskTransitionView` (AC #1, #2)."""

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from bujo.models import Task
from bujo.services.logs import get_or_create_daily_log
from bujo.tests.factories import TaskFactory
from core.calendar import today_for
from core.tenant import current_user_id, tenant_context


@pytest.mark.django_db
def test_get_today_log_e_idempotente(auth_client):
    first = auth_client.get("/api/bujo/logs/today/")
    second = auth_client.get("/api/bujo/logs/today/")

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.data["id"] == second.data["id"]


@pytest.mark.django_db
def test_get_today_log_com_bearer_token_real_end_a_end(user):
    """Regressão (Story 3.2): `auth_client`/`force_authenticate` contornam o
    middleware real via `tenant_context` manual — este teste passa por um JWT
    de verdade (`Authorization: Bearer ...`) para provar que
    `TenantAwareJWTAuthentication` + `TenantMiddleware` funcionam juntos no
    ciclo de request real, sem nenhum atalho de teste — incluindo o reset do
    contextvar ao final (a versão inicial deste fix vazava: o token era
    guardado no `Request` do DRF, um objeto diferente do `HttpRequest` cru que
    o middleware enxerga, então o reset nunca rodava de verdade)."""
    token = str(AccessToken.for_user(user))
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    response = client.get("/api/bujo/logs/today/")

    assert response.status_code == 200
    assert current_user_id.get() is None  # nenhum vazamento entre requests


@pytest.mark.django_db
def test_get_today_log_sem_autenticacao_retorna_401():
    client = APIClient()

    response = client.get("/api/bujo/logs/today/")

    assert response.status_code == 401


@pytest.mark.django_db
def test_get_today_log_isolamento_entre_tenants(auth_client, user, other_user):
    with tenant_context(user):
        TaskFactory(user=user, title="Tarefa do user")

    other_client = APIClient()
    other_client.force_authenticate(user=other_user)

    response = other_client.get("/api/bujo/logs/today/")

    assert response.status_code == 200
    assert response.data["tasks"] == []


@pytest.mark.django_db
def test_post_transition_valida_pending_para_started(auth_client, user):
    with tenant_context(user):
        task = TaskFactory(user=user, status=Task.Status.PENDING)

    response = auth_client.post(
        f"/api/bujo/tasks/{task.id}/transition/", {"toStatus": "started"}, format="json"
    )

    assert response.status_code == 200
    assert response.data["status"] == "started"


@pytest.mark.django_db
def test_post_transition_ilegal_retorna_409(auth_client, user):
    with tenant_context(user):
        task = TaskFactory(user=user, status=Task.Status.COMPLETED)

    response = auth_client.post(
        f"/api/bujo/tasks/{task.id}/transition/", {"toStatus": "migrated"}, format="json"
    )

    assert response.status_code == 409


@pytest.mark.django_db
def test_post_transition_to_status_fora_do_enum_retorna_400(auth_client, user):
    with tenant_context(user):
        task = TaskFactory(user=user, status=Task.Status.PENDING)

    response = auth_client.post(
        f"/api/bujo/tasks/{task.id}/transition/", {"toStatus": "bogus"}, format="json"
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_post_transition_task_de_outro_usuario_retorna_404(auth_client, other_user):
    with tenant_context(other_user):
        task = TaskFactory(user=other_user, status=Task.Status.PENDING)

    response = auth_client.post(
        f"/api/bujo/tasks/{task.id}/transition/", {"toStatus": "started"}, format="json"
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_post_transition_task_inexistente_retorna_404(auth_client):
    response = auth_client.post(
        "/api/bujo/tasks/00000000-0000-0000-0000-000000000000/transition/",
        {"toStatus": "started"},
        format="json",
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_post_transition_ciclo_completo_pending_started_completed_pending(auth_client, user):
    """Fim-a-fim do ciclo de clique do AC2, contra os endpoints reais em sequência."""
    with tenant_context(user):
        task = TaskFactory(user=user, status=Task.Status.PENDING)

    to_started = auth_client.post(
        f"/api/bujo/tasks/{task.id}/transition/", {"toStatus": "started"}, format="json"
    )
    assert to_started.status_code == 200
    assert to_started.data["status"] == "started"

    to_completed = auth_client.post(
        f"/api/bujo/tasks/{task.id}/transition/", {"toStatus": "completed"}, format="json"
    )
    assert to_completed.status_code == 200
    assert to_completed.data["status"] == "completed"

    back_to_pending = auth_client.post(
        f"/api/bujo/tasks/{task.id}/transition/", {"toStatus": "pending"}, format="json"
    )
    assert back_to_pending.status_code == 200
    assert back_to_pending.data["status"] == "pending"


@pytest.mark.django_db
def test_get_today_log_retorna_tasks_na_ordem_e_com_categoria(auth_client, user):
    """Integração fim-a-fim via view (não só o serializer isolado): ordem por
    `order_index` e campo `category` presentes na resposta real do endpoint."""
    with tenant_context(user):
        log = get_or_create_daily_log(user=user, log_date=today_for(user))
        TaskFactory(
            user=user, log=log, order_index=2.0, category=Task.Category.PURPLE, title="Segunda"
        )
        TaskFactory(user=user, log=log, order_index=1.0, category=None, title="Primeira")

    response = auth_client.get("/api/bujo/logs/today/")

    assert response.status_code == 200
    tasks = response.data["tasks"]
    assert [task["title"] for task in tasks] == ["Primeira", "Segunda"]
    assert tasks[0]["category"] is None
    assert tasks[1]["category"] == "purple"
