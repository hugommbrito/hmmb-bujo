"""Testes de `TodayLogView`/`TaskTransitionView` (AC #1, #2)."""

import inspect
import uuid
from datetime import date, timedelta

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

import bujo.services.recurring
from bujo.models import Log, MonthlyLog, RecurringTaskTemplate, RitualDecision, Task, WeeklyLog
from bujo.services.cycles import add_months
from bujo.services.logs import (
    get_or_create_daily_log,
    get_or_create_monthly_log,
    get_or_create_weekly_log,
)
from bujo.services.recurring import place_template
from bujo.services.state_machine import transition_task
from bujo.tests.factories import (
    LogFactory,
    MonthlyLogFactory,
    RecurringTaskTemplateFactory,
    TaskFactory,
    WeeklyLogFactory,
)
from bujo.views import (
    CatchUpQueueView,
    MigrationQueueView,
    RecurringTaskTemplateDetailView,
)
from core.calendar import today_for, week_start_of
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
def test_get_today_log_com_log_date_passado_retorna_log_daquele_dia(auth_client, user):
    past_date = today_for(user) - timedelta(days=10)

    response = auth_client.get(f"/api/bujo/logs/today/?log_date={past_date.isoformat()}")

    assert response.status_code == 200
    assert response.data["log_date"] == past_date.isoformat()


@pytest.mark.django_db
def test_get_today_log_com_log_date_e_idempotente(auth_client, user):
    past_date = today_for(user) - timedelta(days=10)

    first = auth_client.get(f"/api/bujo/logs/today/?log_date={past_date.isoformat()}")
    second = auth_client.get(f"/api/bujo/logs/today/?log_date={past_date.isoformat()}")

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.data["id"] == second.data["id"]


@pytest.mark.django_db
def test_get_today_log_log_date_malformado_retorna_400(auth_client):
    response = auth_client.get("/api/bujo/logs/today/?log_date=not-a-date")

    assert response.status_code == 400
    assert "log_date" in response.data["fields"]


@pytest.mark.django_db
def test_get_today_log_sem_log_date_continua_retornando_log_de_hoje(auth_client, user):
    """Regressão: sem `log_date`, `TodayLogView` continua resolvendo hoje."""
    expected_today = today_for(user)

    response = auth_client.get("/api/bujo/logs/today/")

    assert response.status_code == 200
    assert response.data["log_date"] == expected_today.isoformat()


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


@pytest.mark.django_db
def test_post_task_create_cria_tarefa_em_pending_no_log_de_hoje(auth_client, user):
    response = auth_client.post("/api/bujo/tasks/", {"title": "Nova tarefa"}, format="json")

    assert response.status_code == 201
    assert response.data["title"] == "Nova tarefa"
    assert response.data["status"] == "pending"

    with tenant_context(user):
        log = get_or_create_daily_log(user=user, log_date=today_for(user))
        assert log.tasks.filter(title="Nova tarefa").exists()


@pytest.mark.django_db
def test_post_task_create_ordena_no_fim_da_lista(auth_client, user):
    with tenant_context(user):
        log = get_or_create_daily_log(user=user, log_date=today_for(user))
        TaskFactory(user=user, log=log, title="Primeira", order_index=0.0)

    response = auth_client.post("/api/bujo/tasks/", {"title": "Segunda"}, format="json")

    assert response.status_code == 201

    list_response = auth_client.get("/api/bujo/logs/today/")
    assert [task["title"] for task in list_response.data["tasks"]] == ["Primeira", "Segunda"]


@pytest.mark.django_db
def test_post_task_create_sem_titulo_retorna_400(auth_client):
    response = auth_client.post("/api/bujo/tasks/", {}, format="json")

    assert response.status_code == 400


@pytest.mark.django_db
def test_patch_task_detail_edita_campos_parciais(auth_client, user):
    with tenant_context(user):
        task = TaskFactory(user=user, title="Original", description="Antes")

    response = auth_client.patch(
        f"/api/bujo/tasks/{task.id}/", {"title": "Atualizada"}, format="json"
    )

    assert response.status_code == 200
    assert response.data["title"] == "Atualizada"
    assert response.data["description"] == "Antes"


@pytest.mark.django_db
def test_patch_task_detail_alterna_waiting_on_e_persiste(auth_client, user):
    """Story 12.2 (AC2): PATCH `{"waitingOn": true|false}` alterna a flag e
    persiste. Corpo em camelCase (`waitingOn`); `response.data` em snake_case
    (`waiting_on`) — a camelização só ocorre no render do corpo HTTP."""
    with tenant_context(user):
        task = TaskFactory(user=user, waiting_on=False)

    on = auth_client.patch(
        f"/api/bujo/tasks/{task.id}/", {"waitingOn": True}, format="json"
    )
    assert on.status_code == 200
    assert on.data["waiting_on"] is True
    with tenant_context(user):
        assert Task.objects.get(id=task.id).waiting_on is True

    off = auth_client.patch(
        f"/api/bujo/tasks/{task.id}/", {"waitingOn": False}, format="json"
    )
    assert off.status_code == 200
    assert off.data["waiting_on"] is False
    with tenant_context(user):
        assert Task.objects.get(id=task.id).waiting_on is False


@pytest.mark.django_db
def test_transicao_de_estado_preserva_waiting_on(auth_client, user):
    """Story 12.2 (AC2, ortogonalidade sentido 1): transicionar o estado NÃO
    altera `waiting_on` — a flag sobrevive a `pending→started` (`transition_task`
    salva só `update_fields=["status"]`)."""
    with tenant_context(user):
        task = TaskFactory(user=user, status=Task.Status.PENDING, waiting_on=True)

    response = auth_client.post(
        f"/api/bujo/tasks/{task.id}/transition/", {"toStatus": "started"}, format="json"
    )

    assert response.status_code == 200
    assert response.data["status"] == "started"
    with tenant_context(user):
        assert Task.objects.get(id=task.id).waiting_on is True


@pytest.mark.django_db
def test_alternar_waiting_on_preserva_status(auth_client, user):
    """Story 12.2 (AC2, ortogonalidade sentido 2): alternar `waiting_on` NÃO
    altera o `status` — `update_task` salva só `update_fields=["waiting_on",
    "updated_at"]`."""
    with tenant_context(user):
        task = TaskFactory(user=user, status=Task.Status.STARTED, waiting_on=False)

    response = auth_client.patch(
        f"/api/bujo/tasks/{task.id}/", {"waitingOn": True}, format="json"
    )

    assert response.status_code == 200
    assert response.data["waiting_on"] is True
    assert response.data["status"] == "started"
    with tenant_context(user):
        assert Task.objects.get(id=task.id).status == Task.Status.STARTED


@pytest.mark.django_db
def test_get_today_log_filtra_por_waiting_on(auth_client, user):
    """Story 12.2 (AC3): `?waitingOn=true|false` filtra as raízes do Daily Log;
    ausência do parâmetro retorna todas; combina com `?log_date=` sem conflito."""
    with tenant_context(user):
        log_date = today_for(user)
        log = get_or_create_daily_log(user=user, log_date=log_date)
        TaskFactory(user=user, log=log, title="Aguardando", waiting_on=True, order_index=1.0)
        TaskFactory(user=user, log=log, title="Normal", waiting_on=False, order_index=2.0)

    only_waiting = auth_client.get("/api/bujo/logs/today/?waitingOn=true")
    assert only_waiting.status_code == 200
    assert [t["title"] for t in only_waiting.data["tasks"]] == ["Aguardando"]

    only_normal = auth_client.get("/api/bujo/logs/today/?waitingOn=false")
    assert only_normal.status_code == 200
    assert [t["title"] for t in only_normal.data["tasks"]] == ["Normal"]

    todas = auth_client.get("/api/bujo/logs/today/")
    assert {t["title"] for t in todas.data["tasks"]} == {"Aguardando", "Normal"}

    # combina com o parâmetro pré-existente `?log_date=` sem conflito (AC3)
    combinado = auth_client.get(
        f"/api/bujo/logs/today/?log_date={log_date.isoformat()}&waitingOn=true"
    )
    assert [t["title"] for t in combinado.data["tasks"]] == ["Aguardando"]


@pytest.mark.django_db
def test_get_today_log_filtro_waiting_on_aplica_so_nas_raizes(auth_client, user):
    """Story 12.2 (AC3, "só as raízes"): o filtro `?waitingOn=` decide APENAS
    pela flag da raiz — subtarefas aninhadas NÃO são filtradas independentemente.
    (1) uma raiz `waiting_on=False` com filha `True` fica de fora de
    `?waitingOn=true` (a raiz é que conta, não a filha aguardando); (2) uma raiz
    `waiting_on=True` aparece com TODAS as filhas aninhadas, mesmo as `False` (o
    filtro não poda a subárvore). Guarda `LogSerializer.get_tasks` (filtra só
    `parent_task__isnull=True`) e `get_subtasks` (serializa a subárvore sem
    filtro) contra regressões que estendam o filtro às subtarefas."""
    with tenant_context(user):
        log = get_or_create_daily_log(user=user, log_date=today_for(user))
        pai_normal = TaskFactory(
            user=user, log=log, title="Pai normal", waiting_on=False, order_index=1.0
        )
        TaskFactory(
            user=user, log=log, parent_task=pai_normal, title="Filha aguardando", waiting_on=True
        )
        pai_aguardando = TaskFactory(
            user=user, log=log, title="Pai aguardando", waiting_on=True, order_index=2.0
        )
        TaskFactory(
            user=user, log=log, parent_task=pai_aguardando, title="Filha normal", waiting_on=False
        )

    # `?waitingOn=true`: só a raiz aguardando (a raiz normal fica fora apesar da
    # filha `True`), e a subárvore da raiz aguardando vem inteira (filha `False`).
    only_waiting = auth_client.get("/api/bujo/logs/today/?waitingOn=true")
    assert only_waiting.status_code == 200
    assert [t["title"] for t in only_waiting.data["tasks"]] == ["Pai aguardando"]
    assert [c["title"] for c in only_waiting.data["tasks"][0]["subtasks"]] == ["Filha normal"]

    # `?waitingOn=false`: só a raiz normal, com a filha aguardando ainda aninhada.
    only_normal = auth_client.get("/api/bujo/logs/today/?waitingOn=false")
    assert only_normal.status_code == 200
    assert [t["title"] for t in only_normal.data["tasks"]] == ["Pai normal"]
    assert [c["title"] for c in only_normal.data["tasks"][0]["subtasks"]] == ["Filha aguardando"]


@pytest.mark.django_db
def test_patch_task_detail_de_outro_tenant_retorna_404(auth_client, other_user):
    with tenant_context(other_user):
        task = TaskFactory(user=other_user, title="Original")

    response = auth_client.patch(
        f"/api/bujo/tasks/{task.id}/", {"title": "Invadida"}, format="json"
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_patch_task_detail_eisenhower_fora_do_enum_retorna_400(auth_client, user):
    with tenant_context(user):
        task = TaskFactory(user=user)

    response = auth_client.patch(
        f"/api/bujo/tasks/{task.id}/", {"eisenhower": "bogus"}, format="json"
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_patch_task_detail_category_fora_do_enum_retorna_400(auth_client, user):
    with tenant_context(user):
        task = TaskFactory(user=user)

    response = auth_client.patch(
        f"/api/bujo/tasks/{task.id}/", {"category": "bogus"}, format="json"
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_post_subtask_create_cria_subtarefa_com_parent_e_log_corretos(auth_client, user):
    with tenant_context(user):
        parent = TaskFactory(user=user, title="Pai")

    response = auth_client.post(
        f"/api/bujo/tasks/{parent.id}/subtasks/", {"title": "Filha"}, format="json"
    )

    assert response.status_code == 201
    assert response.data["title"] == "Filha"

    with tenant_context(user):
        child = Task.objects.get(id=response.data["id"])
        assert child.parent_task_id == parent.id
        assert child.log_id == parent.log_id


@pytest.mark.django_db
def test_post_subtask_create_pai_de_outro_tenant_retorna_404(auth_client, other_user):
    with tenant_context(other_user):
        parent = TaskFactory(user=other_user, title="Pai")

    response = auth_client.post(
        f"/api/bujo/tasks/{parent.id}/subtasks/", {"title": "Filha"}, format="json"
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_get_today_log_apos_criar_subtarefa_nao_duplica_na_raiz(auth_client, user):
    """Cobre o gap fechado na Task 2.2: a subtarefa deve aparecer só aninhada
    em `tasks[].subtasks`, nunca solta na raiz de `tasks[]`."""
    with tenant_context(user):
        log = get_or_create_daily_log(user=user, log_date=today_for(user))
        parent = TaskFactory(user=user, log=log, title="Pai")

    subtask_response = auth_client.post(
        f"/api/bujo/tasks/{parent.id}/subtasks/", {"title": "Filha"}, format="json"
    )
    assert subtask_response.status_code == 201

    response = auth_client.get("/api/bujo/logs/today/")

    assert response.status_code == 200
    tasks = response.data["tasks"]
    assert [task["title"] for task in tasks] == ["Pai"]
    assert [child["title"] for child in tasks[0]["subtasks"]] == ["Filha"]


@pytest.mark.django_db
def test_post_subtask_create_aceita_pai_que_e_subtarefa_e_serializer_aninha_recursivamente(
    auth_client, user
):
    """Dev Notes ("Profundidade da árvore"): a UI desta story só oferece
    "adicionar subtarefa" a partir de uma tarefa raiz, mas o endpoint aceita
    qualquer `id` existente como pai — inclusive uma subtarefa — porque o
    bloqueio é decisão de escopo de UI, não do backend. `TaskSerializer.subtasks`
    é recursivo (Task 2.1); sem teste, uma subtarefa-de-subtarefa (avó→pai→neta)
    poderia não aninhar na profundidade correta."""
    with tenant_context(user):
        log = get_or_create_daily_log(user=user, log_date=today_for(user))
        grandparent = TaskFactory(user=user, log=log, title="Avó")
        parent = TaskFactory(user=user, log=log, parent_task=grandparent, title="Pai")

    response = auth_client.post(
        f"/api/bujo/tasks/{parent.id}/subtasks/", {"title": "Neta"}, format="json"
    )

    assert response.status_code == 201
    with tenant_context(user):
        grandchild = Task.objects.get(id=response.data["id"])
        assert grandchild.parent_task_id == parent.id
        assert grandchild.log_id == grandparent.log_id

    today_response = auth_client.get("/api/bujo/logs/today/")
    tasks = today_response.data["tasks"]
    assert [task["title"] for task in tasks] == ["Avó"]
    assert [child["title"] for child in tasks[0]["subtasks"]] == ["Pai"]
    assert [
        grandchild["title"] for grandchild in tasks[0]["subtasks"][0]["subtasks"]
    ] == ["Neta"]


@pytest.mark.django_db
def test_post_reorder_valido_move_a_tarefa_e_persiste_order_index(auth_client, user):
    with tenant_context(user):
        log = get_or_create_daily_log(user=user, log_date=today_for(user))
        target = TaskFactory(user=user, log=log, order_index=0.0)
        task = TaskFactory(user=user, log=log, order_index=1.0)

    response = auth_client.post(
        f"/api/bujo/tasks/{task.id}/reorder/",
        {"targetTaskId": str(target.id), "position": "before"},
        format="json",
    )

    assert response.status_code == 200
    with tenant_context(user):
        task.refresh_from_db()
        assert task.order_index < target.order_index


@pytest.mark.django_db
def test_post_reorder_target_task_id_de_outro_tenant_retorna_404(auth_client, user, other_user):
    with tenant_context(user):
        log = get_or_create_daily_log(user=user, log_date=today_for(user))
        task = TaskFactory(user=user, log=log, order_index=0.0)

    with tenant_context(other_user):
        other_task = TaskFactory(user=other_user, order_index=0.0)

    response = auth_client.post(
        f"/api/bujo/tasks/{task.id}/reorder/",
        {"targetTaskId": str(other_task.id), "position": "after"},
        format="json",
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_post_reorder_target_task_id_igual_a_propria_tarefa_retorna_409(auth_client, user):
    with tenant_context(user):
        task = TaskFactory(user=user, order_index=0.0)

    response = auth_client.post(
        f"/api/bujo/tasks/{task.id}/reorder/",
        {"targetTaskId": str(task.id), "position": "after"},
        format="json",
    )

    assert response.status_code == 409


@pytest.mark.django_db
def test_post_reorder_target_task_id_que_nao_e_irma_retorna_409(auth_client, user):
    with tenant_context(user):
        log = get_or_create_daily_log(user=user, log_date=today_for(user))
        task = TaskFactory(user=user, log=log, order_index=0.0)
        other_log_task = TaskFactory(user=user, order_index=0.0)

    response = auth_client.post(
        f"/api/bujo/tasks/{task.id}/reorder/",
        {"targetTaskId": str(other_log_task.id), "position": "after"},
        format="json",
    )

    assert response.status_code == 409


@pytest.mark.django_db
def test_post_reorder_position_fora_do_enum_retorna_400(auth_client, user):
    with tenant_context(user):
        log = get_or_create_daily_log(user=user, log_date=today_for(user))
        task = TaskFactory(user=user, log=log, order_index=0.0)
        target = TaskFactory(user=user, log=log, order_index=1.0)

    response = auth_client.post(
        f"/api/bujo/tasks/{task.id}/reorder/",
        {"targetTaskId": str(target.id), "position": "sideways"},
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_post_reorder_target_task_id_ausente_retorna_400(auth_client, user):
    with tenant_context(user):
        task = TaskFactory(user=user, order_index=0.0)

    response = auth_client.post(
        f"/api/bujo/tasks/{task.id}/reorder/", {"position": "after"}, format="json"
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_patch_task_detail_titulo_em_branco_retorna_400(auth_client, user):
    """Título é obrigatório na criação (AC1); `TaskUpdateSerializer.title` não
    define `allow_blank=True`, então editar para uma string vazia também deve
    ser rejeitado — sem isso seria possível esvaziar o único campo obrigatório
    da tarefa via PATCH."""
    with tenant_context(user):
        task = TaskFactory(user=user, title="Original")

    response = auth_client.patch(f"/api/bujo/tasks/{task.id}/", {"title": ""}, format="json")

    assert response.status_code == 400


# --- WeeklyLogView ---------------------------------------------------------


@pytest.mark.django_db
def test_get_weekly_log_sem_param_usa_semana_corrente_e_week_start_e_segunda(
    auth_client, user
):
    with tenant_context(user):
        expected_week_start = week_start_of(today_for(user))
        weekly_log = get_or_create_weekly_log(user=user, week_start=expected_week_start)
        TaskFactory(
            user=user,
            weekly_log=weekly_log,
            title="Com dia",
            scheduled_date=expected_week_start,
        )
        TaskFactory(user=user, weekly_log=weekly_log, title="Sem dia", scheduled_date=None)

    response = auth_client.get("/api/bujo/logs/weekly/")

    assert response.status_code == 200
    assert response.data["week_start"] == expected_week_start.isoformat()
    assert len(response.data["days"]) == 7
    first_day = response.data["days"][0]
    assert first_day["date"] == expected_week_start.isoformat()
    assert [task["title"] for task in first_day["tasks"]] == ["Com dia"]
    assert [task["title"] for task in response.data["unscheduled"]] == ["Sem dia"]


@pytest.mark.django_db
def test_get_weekly_log_com_week_start_no_meio_da_semana_normaliza_para_segunda(
    auth_client, user
):
    mid_week = date(2026, 7, 15)  # quarta-feira
    expected_week_start = week_start_of(mid_week)

    response = auth_client.get(f"/api/bujo/logs/weekly/?week_start={mid_week.isoformat()}")

    assert response.status_code == 200
    assert response.data["week_start"] == expected_week_start.isoformat()


@pytest.mark.django_db
def test_get_weekly_log_week_start_malformado_retorna_400(auth_client):
    """Achado de review (Story 4.1): `date.fromisoformat` sem tratamento levantava
    `ValueError` não capturado -> 500. Query param inválido deve virar 400, como
    o resto da API (ex.: `title` ausente em `POST /tasks/`)."""
    response = auth_client.get("/api/bujo/logs/weekly/?week_start=not-a-date")

    assert response.status_code == 400


@pytest.mark.django_db
def test_get_weekly_log_escopado_por_tenant(auth_client, user, other_user):
    with tenant_context(other_user):
        other_weekly_log = WeeklyLogFactory(
            user=other_user, week_start=week_start_of(today_for(other_user))
        )
        TaskFactory(
            user=other_user,
            weekly_log=other_weekly_log,
            scheduled_date=other_weekly_log.week_start,
            title="Da outra tenant",
        )

    response = auth_client.get("/api/bujo/logs/weekly/")

    assert response.status_code == 200
    all_titles = [task["title"] for day in response.data["days"] for task in day["tasks"]]
    all_titles += [task["title"] for task in response.data["unscheduled"]]
    assert "Da outra tenant" not in all_titles


@pytest.mark.django_db
def test_get_weekly_log_closed_e_false_com_tarefa_pending_e_true_apos_disposicao(
    auth_client, user
):
    with tenant_context(user):
        expected_week_start = week_start_of(today_for(user))
        weekly_log = get_or_create_weekly_log(user=user, week_start=expected_week_start)
        task = TaskFactory(user=user, weekly_log=weekly_log, status=Task.Status.PENDING)

    response = auth_client.get("/api/bujo/logs/weekly/")
    assert response.data["closed"] is False

    with tenant_context(user):
        transition_task(user=user, task_id=task.id, to_status=Task.Status.STARTED)
        transition_task(user=user, task_id=task.id, to_status=Task.Status.COMPLETED)

    response = auth_client.get("/api/bujo/logs/weekly/")
    assert response.data["closed"] is True


@pytest.mark.django_db
def test_post_weekly_log_sem_scheduled_date_cria_tarefa_sem_dia(auth_client, user):
    week_start = week_start_of(date(2026, 7, 6))  # segunda-feira

    response = auth_client.post(
        "/api/bujo/logs/weekly/",
        {"weekStart": week_start.isoformat(), "title": "Sem dia"},
        format="json",
    )

    assert response.status_code == 201
    assert response.data["scheduled_date"] is None

    with tenant_context(user):
        weekly_log = get_or_create_weekly_log(user=user, week_start=week_start)
        assert weekly_log.tasks.filter(title="Sem dia", scheduled_date__isnull=True).exists()


@pytest.mark.django_db
def test_post_weekly_log_com_scheduled_date_cria_tarefa_no_dia_certo(auth_client, user):
    week_start = week_start_of(date(2026, 7, 6))
    scheduled_date = week_start + timedelta(days=2)

    response = auth_client.post(
        "/api/bujo/logs/weekly/",
        {
            "weekStart": week_start.isoformat(),
            "title": "Com dia",
            "scheduledDate": scheduled_date.isoformat(),
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.data["scheduled_date"] == scheduled_date.isoformat()


@pytest.mark.django_db
def test_post_weekly_log_scheduled_date_fora_da_semana_retorna_400(auth_client):
    week_start = week_start_of(date(2026, 7, 6))

    response = auth_client.post(
        "/api/bujo/logs/weekly/",
        {
            "weekStart": week_start.isoformat(),
            "title": "Data errada",
            "scheduledDate": (week_start + timedelta(days=10)).isoformat(),
        },
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_post_weekly_log_week_start_nao_e_segunda_retorna_400(auth_client):
    response = auth_client.post(
        "/api/bujo/logs/weekly/",
        {"weekStart": "2026-07-08", "title": "Semana errada"},  # quarta-feira
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_post_weekly_log_escopado_por_tenant(auth_client, user, other_user):
    week_start = week_start_of(date(2026, 7, 6))

    response = auth_client.post(
        "/api/bujo/logs/weekly/",
        {"weekStart": week_start.isoformat(), "title": "Da tenant certa"},
        format="json",
    )

    assert response.status_code == 201
    with tenant_context(other_user):
        assert not Task.objects.filter(id=response.data["id"]).exists()


@pytest.mark.django_db
def test_post_weekly_log_ciclo_fechado_retorna_409(auth_client, user):
    with tenant_context(user):
        week_start = week_start_of(today_for(user))
        weekly_log = get_or_create_weekly_log(user=user, week_start=week_start)
        TaskFactory(user=user, weekly_log=weekly_log, status=Task.Status.COMPLETED)

    response = auth_client.post(
        "/api/bujo/logs/weekly/",
        {"weekStart": week_start.isoformat(), "title": "Ciclo fechado"},
        format="json",
    )

    assert response.status_code == 409
    assert "fields" not in response.data


# --- TaskDetailView.delete ----------------------------------------------------


@pytest.mark.django_db
def test_delete_task_pending_sem_linhagem_retorna_204_e_apaga(auth_client, user):
    with tenant_context(user):
        task = TaskFactory(user=user, status=Task.Status.PENDING)

    response = auth_client.delete(f"/api/bujo/tasks/{task.id}/")

    assert response.status_code == 204
    assert not response.data
    with tenant_context(user):
        assert not Task.objects.filter(id=task.id).exists()


@pytest.mark.django_db
def test_delete_task_com_linhagem_retorna_200_e_cancela(auth_client, user):
    with tenant_context(user):
        task = TaskFactory(user=user, status=Task.Status.PENDING, migration_count=1)

    response = auth_client.delete(f"/api/bujo/tasks/{task.id}/")

    assert response.status_code == 200
    assert response.data["status"] == "cancelled"
    with tenant_context(user):
        assert Task.objects.filter(id=task.id).exists()


@pytest.mark.django_db
def test_delete_task_de_outro_tenant_retorna_404(auth_client, other_user):
    with tenant_context(other_user):
        task = TaskFactory(user=other_user, status=Task.Status.PENDING)

    response = auth_client.delete(f"/api/bujo/tasks/{task.id}/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_delete_task_ciclo_fechado_retorna_409_so_com_detail(auth_client, user):
    with tenant_context(user):
        monthly_log = MonthlyLogFactory(user=user)
        task = TaskFactory(user=user, monthly_log=monthly_log, status=Task.Status.COMPLETED)

    response = auth_client.delete(f"/api/bujo/tasks/{task.id}/")

    assert response.status_code == 409
    assert "fields" not in response.data


# --- Guardrail de ciclo fechado em endpoints já existentes --------------------


@pytest.mark.django_db
def test_post_subtask_create_em_ciclo_fechado_retorna_409(auth_client, user):
    with tenant_context(user):
        weekly_log = WeeklyLogFactory(user=user)
        parent = TaskFactory(user=user, weekly_log=weekly_log, status=Task.Status.COMPLETED)

    response = auth_client.post(
        f"/api/bujo/tasks/{parent.id}/subtasks/", {"title": "Filha"}, format="json"
    )

    assert response.status_code == 409


@pytest.mark.django_db
def test_post_monthly_log_em_ciclo_fechado_retorna_409(auth_client, user):
    with tenant_context(user):
        month_first = today_for(user).replace(day=1)
        monthly_log = get_or_create_monthly_log(user=user, month_first=month_first)
        TaskFactory(user=user, monthly_log=monthly_log, status=Task.Status.CANCELLED)

    response = auth_client.post(
        "/api/bujo/logs/monthly/",
        {"monthFirst": month_first.isoformat(), "title": "Ciclo fechado"},
        format="json",
    )

    assert response.status_code == 409


# --- MonthlyLogView ----------------------------------------------------------


@pytest.mark.django_db
def test_get_monthly_log_sem_param_usa_mes_corrente_e_month_first_e_dia_1(auth_client, user):
    with tenant_context(user):
        expected_month_first = today_for(user).replace(day=1)
        monthly_log = get_or_create_monthly_log(user=user, month_first=expected_month_first)
        TaskFactory(user=user, monthly_log=monthly_log, title="Tarefa do mês")

    response = auth_client.get("/api/bujo/logs/monthly/")

    assert response.status_code == 200
    assert response.data["month_first"] == expected_month_first.isoformat()
    assert [task["title"] for task in response.data["tasks"]] == ["Tarefa do mês"]


@pytest.mark.django_db
def test_get_monthly_log_month_first_malformado_retorna_400(auth_client):
    """Achado de review (Story 4.1): mesmo gap do `week_start` -- query param
    inválido levantava `ValueError` não capturado -> 500."""
    response = auth_client.get("/api/bujo/logs/monthly/?month_first=not-a-date")

    assert response.status_code == 400


@pytest.mark.django_db
def test_post_monthly_log_month_first_nao_e_dia_1_retorna_400(auth_client):
    """Achado de review (Story 4.1): sem validação no serializer, `month_first`
    fora do dia 1 chegava intacto em `get_or_create_monthly_log` e violava o
    CHECK `month_first_is_day_one` no banco -> `IntegrityError` não capturado
    -> 500. Deve ser rejeitado como 400, como qualquer outro campo inválido."""
    response = auth_client.post(
        "/api/bujo/logs/monthly/",
        {"monthFirst": "2026-07-15", "title": "Data inválida"},
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_post_monthly_log_com_scheduled_date_cria_tarefa_no_dia_certo(auth_client, user):
    response = auth_client.post(
        "/api/bujo/logs/monthly/",
        {"monthFirst": "2026-07-01", "title": "Com dia", "scheduledDate": "2026-07-20"},
        format="json",
    )

    assert response.status_code == 201
    assert response.data["scheduled_date"] == "2026-07-20"

    with tenant_context(user):
        monthly_log = get_or_create_monthly_log(user=user, month_first=date(2026, 7, 1))
        assert monthly_log.tasks.filter(title="Com dia", scheduled_date=date(2026, 7, 20)).exists()


@pytest.mark.django_db
def test_post_monthly_log_sem_scheduled_date_cria_tarefa_so_mes(auth_client, user):
    response = auth_client.post(
        "/api/bujo/logs/monthly/",
        {"monthFirst": "2026-07-01", "title": "Só mês"},
        format="json",
    )

    assert response.status_code == 201
    assert response.data["scheduled_date"] is None


@pytest.mark.django_db
def test_post_monthly_log_scheduled_date_fora_do_mes_retorna_400(auth_client):
    response = auth_client.post(
        "/api/bujo/logs/monthly/",
        {"monthFirst": "2026-07-01", "title": "Data errada", "scheduledDate": "2026-08-05"},
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_get_monthly_log_closed_e_false_com_tarefa_pending_e_true_apos_disposicao(
    auth_client, user
):
    with tenant_context(user):
        expected_month_first = today_for(user).replace(day=1)
        monthly_log = get_or_create_monthly_log(user=user, month_first=expected_month_first)
        task = TaskFactory(user=user, monthly_log=monthly_log, status=Task.Status.PENDING)

    response = auth_client.get("/api/bujo/logs/monthly/")
    assert response.data["closed"] is False

    with tenant_context(user):
        transition_task(user=user, task_id=task.id, to_status=Task.Status.CANCELLED)

    response = auth_client.get("/api/bujo/logs/monthly/")
    assert response.data["closed"] is True


# --- FutureLogView -----------------------------------------------------------


@pytest.mark.django_db
def test_get_future_log_agrupa_meses_futuros_com_tarefas_em_ordem_cronologica(
    auth_client, user
):
    with tenant_context(user):
        current_month_first = today_for(user).replace(day=1)
        far_future = MonthlyLogFactory(
            user=user, month_first=date(current_month_first.year + 1, 3, 1)
        )
        near_future = MonthlyLogFactory(
            user=user, month_first=date(current_month_first.year + 1, 1, 1)
        )
        TaskFactory(user=user, monthly_log=far_future, title="Tarefa distante")
        TaskFactory(user=user, monthly_log=near_future, title="Tarefa próxima")

    response = auth_client.get("/api/bujo/future-log/")

    assert response.status_code == 200
    assert [group["month"] for group in response.data] == [1, 3]
    assert [task["title"] for task in response.data[0]["tasks"]] == ["Tarefa próxima"]


@pytest.mark.django_db
def test_get_future_log_mes_corrente_nao_aparece(auth_client, user):
    with tenant_context(user):
        current_month_first = today_for(user).replace(day=1)
        current_monthly_log = get_or_create_monthly_log(
            user=user, month_first=current_month_first
        )
        TaskFactory(user=user, monthly_log=current_monthly_log, title="Tarefa do mês corrente")

    response = auth_client.get("/api/bujo/future-log/")

    assert response.status_code == 200
    assert response.data == []


@pytest.mark.django_db
def test_get_future_log_mes_futuro_sem_tarefas_nao_aparece(auth_client, user):
    with tenant_context(user):
        current_month_first = today_for(user).replace(day=1)
        MonthlyLogFactory(user=user, month_first=date(current_month_first.year + 1, 6, 1))

    response = auth_client.get("/api/bujo/future-log/")

    assert response.status_code == 200
    assert response.data == []


@pytest.mark.django_db
def test_post_monthly_log_mes_futuro_aparece_no_future_log(auth_client):
    create_response = auth_client.post(
        "/api/bujo/logs/monthly/",
        {"monthFirst": "2030-12-01", "title": "Item do futuro"},
        format="json",
    )
    assert create_response.status_code == 201

    future_response = auth_client.get("/api/bujo/future-log/")

    assert future_response.status_code == 200
    matching = [g for g in future_response.data if g["year"] == 2030 and g["month"] == 12]
    assert len(matching) == 1
    assert [task["title"] for task in matching[0]["tasks"]] == ["Item do futuro"]


# --- ArchiveView (AC #2) -------------------------------------------------------


@pytest.mark.django_db
def test_get_archive_vazio_retorna_200_com_lista_vazia(auth_client):
    response = auth_client.get("/api/bujo/archive/")

    assert response.status_code == 200
    assert response.data == []


@pytest.mark.django_db
def test_get_archive_com_semana_e_mes_fechados_retorna_as_duas_entradas(auth_client, user):
    with tenant_context(user):
        closed_weekly = WeeklyLogFactory(user=user, week_start=date(2026, 6, 1))
        TaskFactory(user=user, weekly_log=closed_weekly, status=Task.Status.COMPLETED)

        closed_monthly = MonthlyLogFactory(user=user, month_first=date(2026, 5, 1))
        TaskFactory(user=user, monthly_log=closed_monthly, status=Task.Status.CANCELLED)

    response = auth_client.get("/api/bujo/archive/")

    assert response.status_code == 200
    assert len(response.data) == 2
    assert response.data[0]["type"] == "weekly"
    assert response.data[0]["week_start"] == "2026-06-01"
    assert response.data[0]["month_first"] is None
    assert response.data[1]["type"] == "monthly"
    assert response.data[1]["week_start"] is None
    assert response.data[1]["month_first"] == "2026-05-01"


@pytest.mark.django_db
def test_get_archive_escopado_por_tenant(auth_client, user, other_user):
    with tenant_context(other_user):
        other_closed = WeeklyLogFactory(user=other_user, week_start=date(2026, 6, 1))
        TaskFactory(user=other_user, weekly_log=other_closed, status=Task.Status.COMPLETED)

    response = auth_client.get("/api/bujo/archive/")

    assert response.status_code == 200
    assert response.data == []


# --- Subtarefa herda container do pai (weekly/monthly) ------------------------


@pytest.mark.django_db
def test_post_subtask_create_de_tarefa_de_monthly_log_herda_monthly_log_do_pai(
    auth_client, user
):
    with tenant_context(user):
        monthly_log = MonthlyLogFactory(user=user)
        parent = TaskFactory(user=user, monthly_log=monthly_log, title="Pai mensal")

    response = auth_client.post(
        f"/api/bujo/tasks/{parent.id}/subtasks/", {"title": "Filha"}, format="json"
    )

    assert response.status_code == 201
    with tenant_context(user):
        child = Task.objects.get(id=response.data["id"])
        assert child.monthly_log_id == monthly_log.id
        assert child.log_id is None


# --- MigrationQueueView / TaskMigrateView (AC #1, #2, #3) ---------------------


@pytest.mark.django_db
def test_get_migration_queue_sem_log_de_ontem_retorna_vazio_e_nao_materializa_log(
    auth_client, user
):
    response = auth_client.get("/api/bujo/migration/queue/")

    assert response.status_code == 200
    assert response.data["tasks"] == []
    with tenant_context(user):
        assert Log.objects.count() == 0


@pytest.mark.django_db
def test_get_migration_queue_so_traz_raizes_pending_started_de_ontem(auth_client, user):
    with tenant_context(user):
        yesterday = today_for(user) - timedelta(days=1)
        yesterday_log = LogFactory(user=user, log_date=yesterday)
        pending = TaskFactory(
            user=user, log=yesterday_log, status=Task.Status.PENDING, title="Pendente"
        )
        TaskFactory(user=user, log=yesterday_log, status=Task.Status.STARTED, title="Iniciada")
        TaskFactory(user=user, log=yesterday_log, status=Task.Status.COMPLETED, title="Concluída")
        TaskFactory(user=user, log=yesterday_log, status=Task.Status.CANCELLED, title="Cancelada")
        TaskFactory(
            user=user,
            log=yesterday_log,
            parent_task=pending,
            status=Task.Status.PENDING,
            title="Subtarefa",
        )

    response = auth_client.get("/api/bujo/migration/queue/")

    assert response.status_code == 200
    titles = {task["title"] for task in response.data["tasks"]}
    assert titles == {"Pendente", "Iniciada"}


@pytest.mark.django_db
def test_post_migrate_destination_today_migra_para_daily_log_de_hoje(auth_client, user):
    with tenant_context(user):
        yesterday_log = LogFactory(user=user, log_date=today_for(user) - timedelta(days=1))
        task = TaskFactory(user=user, log=yesterday_log, status=Task.Status.PENDING)

    response = auth_client.post(
        f"/api/bujo/tasks/{task.id}/migrate/", {"destination": "today"}, format="json"
    )

    assert response.status_code == 200
    # `migrate_task` retorna a ORIGEM recarregada (status atualizado +
    # `migrated_to_task`), não o novo registro — ver Dev Notes do dispatcher.
    assert response.data["status"] == "migrated"
    assert response.data["id"] == str(task.id)
    with tenant_context(user):
        task.refresh_from_db()
        assert task.status == "migrated"
        today_log = get_or_create_daily_log(user=user, log_date=today_for(user))
        assert today_log.tasks.filter(id=task.migrated_to_task_id).exists()


@pytest.mark.django_db
def test_post_migrate_destination_month_sem_scheduled_date_postpoe_no_monthly_corrente(
    auth_client, user
):
    with tenant_context(user):
        task = TaskFactory(user=user, status=Task.Status.PENDING)
        current_month_first = today_for(user).replace(day=1)

    response = auth_client.post(
        f"/api/bujo/tasks/{task.id}/migrate/", {"destination": "month"}, format="json"
    )

    assert response.status_code == 200
    assert response.data["status"] == "postponed"
    with tenant_context(user):
        task.refresh_from_db()
        assert task.status == "postponed"
        monthly_log = get_or_create_monthly_log(user=user, month_first=current_month_first)
        assert monthly_log.tasks.filter(id=task.migrated_to_task_id).exists()
        assert task.migrated_to_task.scheduled_date is None


@pytest.mark.django_db
def test_post_migrate_destination_month_com_scheduled_date_postpoe_no_mes_corrente(
    auth_client, user
):
    with tenant_context(user):
        task = TaskFactory(user=user, status=Task.Status.PENDING)
        current_month_first = today_for(user).replace(day=1)
        scheduled_date = current_month_first.replace(day=2)

    response = auth_client.post(
        f"/api/bujo/tasks/{task.id}/migrate/",
        {"destination": "month", "scheduledDate": scheduled_date.isoformat()},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["status"] == "postponed"
    with tenant_context(user):
        task.refresh_from_db()
        assert task.status == "postponed"
        monthly_log = get_or_create_monthly_log(user=user, month_first=current_month_first)
        assert monthly_log.tasks.filter(id=task.migrated_to_task_id).exists()


@pytest.mark.django_db
def test_post_migrate_destination_future_com_month_first_do_mes_corrente_retorna_400(
    auth_client, user
):
    with tenant_context(user):
        task = TaskFactory(user=user, status=Task.Status.PENDING)
        current_month_first = today_for(user).replace(day=1)

    response = auth_client.post(
        f"/api/bujo/tasks/{task.id}/migrate/",
        {"destination": "future", "monthFirst": current_month_first.isoformat()},
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_post_migrate_destination_future_com_scheduled_date_fora_do_mes_retorna_400(
    auth_client, user
):
    with tenant_context(user):
        task = TaskFactory(user=user, status=Task.Status.PENDING)
        current_month_first = today_for(user).replace(day=1)
        future_month = date(current_month_first.year + 1, current_month_first.month, 1)
        outro_mes = date(future_month.year, future_month.month % 12 + 1, 5)

    response = auth_client.post(
        f"/api/bujo/tasks/{task.id}/migrate/",
        {
            "destination": "future",
            "monthFirst": future_month.isoformat(),
            "scheduledDate": outro_mes.isoformat(),
        },
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_post_migrate_destination_future_sem_scheduled_date_postpoe_sem_dia(auth_client, user):
    with tenant_context(user):
        task = TaskFactory(user=user, status=Task.Status.PENDING)
        current_month_first = today_for(user).replace(day=1)
        future_month = date(current_month_first.year + 1, current_month_first.month, 1)

    response = auth_client.post(
        f"/api/bujo/tasks/{task.id}/migrate/",
        {"destination": "future", "monthFirst": future_month.isoformat()},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["status"] == "postponed"
    with tenant_context(user):
        task.refresh_from_db()
        assert task.status == "postponed"
        assert task.migrated_to_task.scheduled_date is None


@pytest.mark.django_db
def test_post_migrate_destination_cancel_cancela_sem_lineage(auth_client, user):
    with tenant_context(user):
        task = TaskFactory(user=user, status=Task.Status.PENDING)
        count_before = Task.objects.count()

    response = auth_client.post(
        f"/api/bujo/tasks/{task.id}/migrate/", {"destination": "cancel"}, format="json"
    )

    assert response.status_code == 200
    assert response.data["status"] == "cancelled"
    with tenant_context(user):
        assert Task.objects.count() == count_before


@pytest.mark.django_db
@pytest.mark.parametrize("status", ["completed", "cancelled", "migrated"])
def test_post_migrate_status_nao_migravel_retorna_409(auth_client, user, status):
    with tenant_context(user):
        task = TaskFactory(user=user, status=status)

    response = auth_client.post(
        f"/api/bujo/tasks/{task.id}/migrate/", {"destination": "today"}, format="json"
    )

    assert response.status_code == 409


@pytest.mark.django_db
def test_post_migrate_escopado_por_tenant(auth_client, user, other_user):
    with tenant_context(other_user):
        task = TaskFactory(user=other_user, status=Task.Status.PENDING)

    response = auth_client.post(
        f"/api/bujo/tasks/{task.id}/migrate/", {"destination": "today"}, format="json"
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_post_migrate_destination_week_migra_para_weekly_log_corrente(auth_client, user):
    with tenant_context(user):
        previous_week = WeeklyLogFactory(
            user=user, week_start=week_start_of(today_for(user)) - timedelta(weeks=1)
        )
        task = TaskFactory(user=user, weekly_log=previous_week, status=Task.Status.PENDING)

    response = auth_client.post(
        f"/api/bujo/tasks/{task.id}/migrate/", {"destination": "week"}, format="json"
    )

    assert response.status_code == 200
    assert response.data["status"] == "migrated"
    with tenant_context(user):
        task.refresh_from_db()
        assert task.status == "migrated"
        current_weekly_log = get_or_create_weekly_log(
            user=user, week_start=week_start_of(today_for(user))
        )
        assert current_weekly_log.tasks.filter(id=task.migrated_to_task_id).exists()


@pytest.mark.django_db
def test_post_migrate_destination_week_com_scheduled_date_migra_para_semana_da_data(
    auth_client, user
):
    with tenant_context(user):
        task = TaskFactory(user=user, status=Task.Status.PENDING)
        scheduled_date = week_start_of(today_for(user)) + timedelta(weeks=3)

    response = auth_client.post(
        f"/api/bujo/tasks/{task.id}/migrate/",
        {"destination": "week", "scheduledDate": scheduled_date.isoformat()},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["status"] == "migrated"
    with tenant_context(user):
        task.refresh_from_db()
        assert task.status == "migrated"
        target_weekly_log = get_or_create_weekly_log(
            user=user, week_start=week_start_of(scheduled_date)
        )
        assert target_weekly_log.tasks.filter(id=task.migrated_to_task_id).exists()
        assert task.migrated_to_task.scheduled_date == scheduled_date


@pytest.mark.django_db
def test_post_migrate_destination_week_para_semana_fechada_retorna_409_so_com_detail(
    auth_client, user
):
    """Prova, via HTTP, que o guardrail de ciclo fechado da Story 11.5
    (`_check_container_open`, chamado por dentro de `_migrate_subtree`) já
    protege o destino desta story sem nenhum código novo."""
    with tenant_context(user):
        past_week_start = week_start_of(today_for(user)) - timedelta(weeks=4)
        closed_weekly_log = WeeklyLogFactory(user=user, week_start=past_week_start)
        TaskFactory(user=user, weekly_log=closed_weekly_log, status=Task.Status.COMPLETED)
        task = TaskFactory(user=user, status=Task.Status.PENDING)

    response = auth_client.post(
        f"/api/bujo/tasks/{task.id}/migrate/",
        {"destination": "week", "scheduledDate": past_week_start.isoformat()},
        format="json",
    )

    assert response.status_code == 409
    assert "fields" not in response.data


# --- WeeklyReviewQueueView / MonthlyReviewQueueView (AC #1, #2) --------------


@pytest.mark.django_db
def test_get_weekly_review_queue_sem_semana_anterior_retorna_vazio_e_nao_materializa(
    auth_client, user
):
    response = auth_client.get("/api/bujo/weekly-review/queue/")

    assert response.status_code == 200
    assert response.data["tasks"] == []
    with tenant_context(user):
        assert WeeklyLog.objects.count() == 0


@pytest.mark.django_db
def test_get_weekly_review_queue_so_traz_raizes_pending_started_da_semana_anterior(
    auth_client, user
):
    with tenant_context(user):
        previous_week_start = week_start_of(today_for(user)) - timedelta(weeks=1)
        previous_week = WeeklyLogFactory(user=user, week_start=previous_week_start)
        pending = TaskFactory(
            user=user, weekly_log=previous_week, status=Task.Status.PENDING, title="Pendente"
        )
        TaskFactory(
            user=user, weekly_log=previous_week, status=Task.Status.STARTED, title="Iniciada"
        )
        TaskFactory(
            user=user, weekly_log=previous_week, status=Task.Status.COMPLETED, title="Concluída"
        )
        TaskFactory(
            user=user, weekly_log=previous_week, status=Task.Status.CANCELLED, title="Cancelada"
        )
        TaskFactory(
            user=user,
            weekly_log=previous_week,
            parent_task=pending,
            status=Task.Status.PENDING,
            title="Subtarefa",
        )

    response = auth_client.get("/api/bujo/weekly-review/queue/")

    assert response.status_code == 200
    titles = {task["title"] for task in response.data["tasks"]}
    assert titles == {"Pendente", "Iniciada"}


@pytest.mark.django_db
def test_get_weekly_review_queue_escopado_por_tenant(auth_client, user, other_user):
    with tenant_context(other_user):
        previous_week = WeeklyLogFactory(
            user=other_user, week_start=week_start_of(today_for(other_user)) - timedelta(weeks=1)
        )
        TaskFactory(
            user=other_user,
            weekly_log=previous_week,
            status=Task.Status.PENDING,
            title="Da outra tenant",
        )

    response = auth_client.get("/api/bujo/weekly-review/queue/")

    assert response.status_code == 200
    assert response.data["tasks"] == []


@pytest.mark.django_db
def test_get_monthly_review_queue_sem_mes_anterior_retorna_vazio_e_nao_materializa(
    auth_client, user
):
    response = auth_client.get("/api/bujo/monthly-review/queue/")

    assert response.status_code == 200
    assert response.data["tasks"] == []
    with tenant_context(user):
        assert MonthlyLog.objects.count() == 0


@pytest.mark.django_db
def test_get_monthly_review_queue_so_traz_raizes_pending_started_do_mes_anterior(
    auth_client, user
):
    with tenant_context(user):
        current_month_first = today_for(user).replace(day=1)
        previous_month_first = (current_month_first - timedelta(days=1)).replace(day=1)
        previous_month = MonthlyLogFactory(user=user, month_first=previous_month_first)
        pending = TaskFactory(
            user=user, monthly_log=previous_month, status=Task.Status.PENDING, title="Pendente"
        )
        TaskFactory(
            user=user, monthly_log=previous_month, status=Task.Status.STARTED, title="Iniciada"
        )
        TaskFactory(
            user=user, monthly_log=previous_month, status=Task.Status.COMPLETED, title="Concluída"
        )
        TaskFactory(
            user=user, monthly_log=previous_month, status=Task.Status.CANCELLED, title="Cancelada"
        )
        TaskFactory(
            user=user,
            monthly_log=previous_month,
            parent_task=pending,
            status=Task.Status.PENDING,
            title="Subtarefa",
        )

    response = auth_client.get("/api/bujo/monthly-review/queue/")

    assert response.status_code == 200
    titles = {task["title"] for task in response.data["tasks"]}
    assert titles == {"Pendente", "Iniciada"}


@pytest.mark.django_db
def test_get_monthly_review_queue_escopado_por_tenant(auth_client, user, other_user):
    with tenant_context(other_user):
        current_month_first = today_for(other_user).replace(day=1)
        previous_month_first = (current_month_first - timedelta(days=1)).replace(day=1)
        previous_month = MonthlyLogFactory(user=other_user, month_first=previous_month_first)
        TaskFactory(
            user=other_user,
            monthly_log=previous_month,
            status=Task.Status.PENDING,
            title="Da outra tenant",
        )

    response = auth_client.get("/api/bujo/monthly-review/queue/")

    assert response.status_code == 200
    assert response.data["tasks"] == []


# --- CatchUpQueueView (AC #1, #2) --------------------------------------------


@pytest.mark.django_db
def test_get_catch_up_queue_nao_sobrepoe_migration_weekly_monthly_review(auth_client, user):
    """Regressão de sobreposição (a mais importante desta story): tarefas só
    em "ontem"/"semana anterior"/"mês anterior" já são cobertas por
    `MigrationQueueView`/`WeeklyReviewQueueView`/`MonthlyReviewQueueView` — não
    podem aparecer duplicadas no Catch-Up."""
    with tenant_context(user):
        yesterday = today_for(user) - timedelta(days=1)
        previous_week_start = week_start_of(today_for(user)) - timedelta(weeks=1)
        current_month_first = today_for(user).replace(day=1)
        previous_month_first = (current_month_first - timedelta(days=1)).replace(day=1)

        yesterday_log = LogFactory(user=user, log_date=yesterday)
        TaskFactory(user=user, log=yesterday_log, status=Task.Status.PENDING, title="Ontem")

        previous_week = WeeklyLogFactory(user=user, week_start=previous_week_start)
        TaskFactory(
            user=user, weekly_log=previous_week, status=Task.Status.PENDING, title="Semana"
        )

        previous_month = MonthlyLogFactory(user=user, month_first=previous_month_first)
        TaskFactory(
            user=user, monthly_log=previous_month, status=Task.Status.PENDING, title="Mês"
        )

    response = auth_client.get("/api/bujo/catch-up/queue/")

    assert response.status_code == 200
    assert response.data["daily_tasks"] == []
    assert response.data["weekly_tasks"] == []
    assert response.data["monthly_tasks"] == []


@pytest.mark.django_db
def test_get_catch_up_queue_diaria_so_traz_raizes_pending_started_mais_antigas(
    auth_client, user
):
    with tenant_context(user):
        old_date = today_for(user) - timedelta(days=10)
        old_log = LogFactory(user=user, log_date=old_date)
        pending = TaskFactory(
            user=user, log=old_log, status=Task.Status.PENDING, title="Pendente"
        )
        TaskFactory(user=user, log=old_log, status=Task.Status.STARTED, title="Iniciada")
        TaskFactory(user=user, log=old_log, status=Task.Status.COMPLETED, title="Concluída")
        TaskFactory(user=user, log=old_log, status=Task.Status.CANCELLED, title="Cancelada")
        TaskFactory(
            user=user,
            log=old_log,
            parent_task=pending,
            status=Task.Status.PENDING,
            title="Subtarefa",
        )

    response = auth_client.get("/api/bujo/catch-up/queue/")

    assert response.status_code == 200
    titles = {task["title"] for task in response.data["daily_tasks"]}
    assert titles == {"Pendente", "Iniciada"}


@pytest.mark.django_db
def test_get_catch_up_queue_semanal_so_traz_raizes_pending_started_mais_antigas(
    auth_client, user
):
    with tenant_context(user):
        old_week_start = week_start_of(today_for(user)) - timedelta(weeks=3)
        old_week = WeeklyLogFactory(user=user, week_start=old_week_start)
        pending = TaskFactory(
            user=user, weekly_log=old_week, status=Task.Status.PENDING, title="Pendente"
        )
        TaskFactory(user=user, weekly_log=old_week, status=Task.Status.STARTED, title="Iniciada")
        TaskFactory(
            user=user, weekly_log=old_week, status=Task.Status.COMPLETED, title="Concluída"
        )
        TaskFactory(
            user=user, weekly_log=old_week, status=Task.Status.CANCELLED, title="Cancelada"
        )
        TaskFactory(
            user=user,
            weekly_log=old_week,
            parent_task=pending,
            status=Task.Status.PENDING,
            title="Subtarefa",
        )

    response = auth_client.get("/api/bujo/catch-up/queue/")

    assert response.status_code == 200
    titles = {task["title"] for task in response.data["weekly_tasks"]}
    assert titles == {"Pendente", "Iniciada"}


@pytest.mark.django_db
def test_get_catch_up_queue_mensal_so_traz_raizes_pending_started_mais_antigas(
    auth_client, user
):
    with tenant_context(user):
        current_month_first = today_for(user).replace(day=1)
        old_month_first = current_month_first.replace(year=current_month_first.year - 1)
        old_month = MonthlyLogFactory(user=user, month_first=old_month_first)
        pending = TaskFactory(
            user=user, monthly_log=old_month, status=Task.Status.PENDING, title="Pendente"
        )
        TaskFactory(user=user, monthly_log=old_month, status=Task.Status.STARTED, title="Iniciada")
        TaskFactory(
            user=user, monthly_log=old_month, status=Task.Status.COMPLETED, title="Concluída"
        )
        TaskFactory(
            user=user, monthly_log=old_month, status=Task.Status.CANCELLED, title="Cancelada"
        )
        TaskFactory(
            user=user,
            monthly_log=old_month,
            parent_task=pending,
            status=Task.Status.PENDING,
            title="Subtarefa",
        )

    response = auth_client.get("/api/bujo/catch-up/queue/")

    assert response.status_code == 200
    titles = {task["title"] for task in response.data["monthly_tasks"]}
    assert titles == {"Pendente", "Iniciada"}


@pytest.mark.django_db
def test_get_catch_up_queue_nao_materializa_nenhum_log(auth_client, user):
    with tenant_context(user):
        old_date = today_for(user) - timedelta(days=10)
        old_log = LogFactory(user=user, log_date=old_date)
        TaskFactory(user=user, log=old_log, status=Task.Status.PENDING, title="Pendente")
        log_count_before = Log.objects.count()
        weekly_log_count_before = WeeklyLog.objects.count()
        monthly_log_count_before = MonthlyLog.objects.count()

    response = auth_client.get("/api/bujo/catch-up/queue/")

    assert response.status_code == 200
    with tenant_context(user):
        assert Log.objects.count() == log_count_before
        assert WeeklyLog.objects.count() == weekly_log_count_before
        assert MonthlyLog.objects.count() == monthly_log_count_before


@pytest.mark.django_db
def test_get_catch_up_queue_escopado_por_tenant(auth_client, user, other_user):
    with tenant_context(other_user):
        old_date = today_for(other_user) - timedelta(days=10)
        old_log = LogFactory(user=other_user, log_date=old_date)
        TaskFactory(
            user=other_user, log=old_log, status=Task.Status.PENDING, title="Da outra tenant"
        )

    response = auth_client.get("/api/bujo/catch-up/queue/")

    assert response.status_code == 200
    assert response.data["daily_tasks"] == []
    assert response.data["weekly_tasks"] == []
    assert response.data["monthly_tasks"] == []


# --- TaskDetailView PATCH scheduledDate (AC #2 — confirmação do Future Log) --


@pytest.mark.django_db
def test_patch_task_detail_scheduled_date_dentro_do_mes_do_monthly_log_atualiza(
    auth_client, user
):
    with tenant_context(user):
        current_month_first = today_for(user).replace(day=1)
        monthly_log = MonthlyLogFactory(user=user, month_first=current_month_first)
        task = TaskFactory(user=user, monthly_log=monthly_log, scheduled_date=None)
        new_date = current_month_first.replace(day=15)

    response = auth_client.patch(
        f"/api/bujo/tasks/{task.id}/", {"scheduledDate": new_date.isoformat()}, format="json"
    )

    assert response.status_code == 200
    assert response.data["scheduled_date"] == new_date.isoformat()
    with tenant_context(user):
        task.refresh_from_db()
        assert task.scheduled_date == new_date


@pytest.mark.django_db
def test_patch_task_detail_scheduled_date_fora_do_mes_do_monthly_log_retorna_400(
    auth_client, user
):
    with tenant_context(user):
        current_month_first = today_for(user).replace(day=1)
        monthly_log = MonthlyLogFactory(user=user, month_first=current_month_first)
        task = TaskFactory(user=user, monthly_log=monthly_log, scheduled_date=None)
        outro_mes = date(current_month_first.year, current_month_first.month % 12 + 1, 5)

    response = auth_client.patch(
        f"/api/bujo/tasks/{task.id}/", {"scheduledDate": outro_mes.isoformat()}, format="json"
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_patch_task_detail_scheduled_date_sem_monthly_log_aceito_sem_checagem_de_mes(
    auth_client, user
):
    with tenant_context(user):
        yesterday_log = LogFactory(user=user)
        task = TaskFactory(user=user, log=yesterday_log, scheduled_date=None)

    response = auth_client.patch(
        f"/api/bujo/tasks/{task.id}/", {"scheduledDate": "2099-12-25"}, format="json"
    )

    assert response.status_code == 200
    assert response.data["scheduled_date"] == "2099-12-25"


# --- RecurringTaskTemplateView* (AC #1, #2, #3) --------------------------------


@pytest.mark.django_db
def test_post_recurring_template_cria_e_retorna_201(auth_client):
    response = auth_client.post(
        "/api/bujo/recurring-templates/",
        {
            "title": "Revisão semanal",
            "recurrenceGroup": "weekly",
            "recurrenceText": "toda sexta",
            "category": "teal",
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.data["title"] == "Revisão semanal"
    assert response.data["recurrence_group"] == "weekly"
    assert response.data["active"] is True
    assert response.data["category"] == "teal"


@pytest.mark.django_db
def test_get_recurring_templates_lista_todos_sem_filtro(auth_client, user):
    with tenant_context(user):
        RecurringTaskTemplateFactory(user=user, title="Ativo", active=True)
        RecurringTaskTemplateFactory(user=user, title="Inativo", active=False)

    response = auth_client.get("/api/bujo/recurring-templates/")

    assert response.status_code == 200
    assert {t["title"] for t in response.data} == {"Ativo", "Inativo"}


@pytest.mark.django_db
def test_get_recurring_templates_ordena_por_recurrence_text(auth_client, user):
    with tenant_context(user):
        RecurringTaskTemplateFactory(user=user, title="Sexta", recurrence_text="toda sexta")
        RecurringTaskTemplateFactory(
            user=user, title="Quarta", recurrence_text="toda quarta"
        )
        RecurringTaskTemplateFactory(
            user=user, title="Segunda", recurrence_text="toda segunda"
        )

    response = auth_client.get("/api/bujo/recurring-templates/")

    assert response.status_code == 200
    assert [t["recurrence_text"] for t in response.data] == [
        "toda quarta",
        "toda segunda",
        "toda sexta",
    ]


@pytest.mark.django_db
def test_get_recurring_templates_filtra_por_active(auth_client, user):
    with tenant_context(user):
        RecurringTaskTemplateFactory(user=user, title="Ativo", active=True)
        RecurringTaskTemplateFactory(user=user, title="Inativo", active=False)

    response = auth_client.get("/api/bujo/recurring-templates/?active=true")

    assert response.status_code == 200
    assert [t["title"] for t in response.data] == ["Ativo"]


@pytest.mark.django_db
def test_get_recurring_templates_filtra_por_recurrence_group(auth_client, user):
    with tenant_context(user):
        RecurringTaskTemplateFactory(
            user=user,
            title="Semanal",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.WEEKLY,
        )
        RecurringTaskTemplateFactory(
            user=user,
            title="Mensal",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.MONTHLY,
        )

    response = auth_client.get("/api/bujo/recurring-templates/?recurrence_group=monthly")

    assert response.status_code == 200
    assert [t["title"] for t in response.data] == ["Mensal"]


@pytest.mark.django_db
def test_get_recurring_templates_unplaced_year_exclui_template_colocado_no_ano(
    auth_client, user
):
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(
            user=user,
            title="Revisão anual",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.ANNUAL,
        )

    place_response = auth_client.post(
        f"/api/bujo/recurring-templates/{template.id}/place/",
        {"monthFirst": "2026-03-01"},
        format="json",
    )
    assert place_response.status_code == 201

    response = auth_client.get(
        "/api/bujo/recurring-templates/?recurrence_group=annual&unplaced_year=2026"
    )

    assert response.status_code == 200
    assert response.data == []


@pytest.mark.django_db
def test_get_recurring_templates_unplaced_year_inclui_template_sem_nenhuma_instancia(
    auth_client, user
):
    with tenant_context(user):
        RecurringTaskTemplateFactory(
            user=user,
            title="Revisão anual",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.ANNUAL,
        )

    response = auth_client.get(
        "/api/bujo/recurring-templates/?recurrence_group=annual&unplaced_year=2026"
    )

    assert response.status_code == 200
    assert [t["title"] for t in response.data] == ["Revisão anual"]


@pytest.mark.django_db
def test_get_recurring_templates_unplaced_year_inclui_template_colocado_em_outro_ano(
    auth_client, user
):
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(
            user=user,
            title="Revisão anual",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.ANNUAL,
        )

    place_response = auth_client.post(
        f"/api/bujo/recurring-templates/{template.id}/place/",
        {"monthFirst": "2025-03-01"},
        format="json",
    )
    assert place_response.status_code == 201

    response = auth_client.get(
        "/api/bujo/recurring-templates/?recurrence_group=annual&unplaced_year=2026"
    )

    assert response.status_code == 200
    assert [t["title"] for t in response.data] == ["Revisão anual"]


@pytest.mark.django_db
def test_get_recurring_templates_unplaced_year_presenca_inclui_cancelada(auth_client, user):
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(
            user=user,
            title="Revisão anual",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.ANNUAL,
        )

    place_response = auth_client.post(
        f"/api/bujo/recurring-templates/{template.id}/place/",
        {"monthFirst": "2026-03-01"},
        format="json",
    )
    assert place_response.status_code == 201

    with tenant_context(user):
        transition_task(
            user=user, task_id=place_response.data["id"], to_status=Task.Status.CANCELLED
        )

    response = auth_client.get(
        "/api/bujo/recurring-templates/?recurrence_group=annual&unplaced_year=2026"
    )

    assert response.status_code == 200
    assert response.data == []


@pytest.mark.django_db
def test_get_recurring_templates_unplaced_year_invalido_retorna_400(auth_client, user):
    response = auth_client.get("/api/bujo/recurring-templates/?unplaced_year=abc")

    assert response.status_code == 400
    assert "unplaced_year" in response.data["fields"]


@pytest.mark.django_db
def test_get_recurring_templates_unplaced_year_isola_por_tenant(
    auth_client, user, other_user
):
    with tenant_context(user):
        RecurringTaskTemplateFactory(
            user=user,
            title="Revisão anual",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.ANNUAL,
        )
    with tenant_context(other_user):
        other_template = RecurringTaskTemplateFactory(
            user=other_user,
            title="Revisão anual",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.ANNUAL,
        )
        place_template(
            user=other_user, template_id=other_template.id, month_first=date(2026, 3, 1)
        )

    response = auth_client.get(
        "/api/bujo/recurring-templates/?recurrence_group=annual&unplaced_year=2026"
    )

    assert response.status_code == 200
    assert [t["title"] for t in response.data] == ["Revisão anual"]


@pytest.mark.django_db
def test_get_recurring_templates_unplaced_year_combinado_com_active_e_recurrence_group(
    auth_client, user
):
    with tenant_context(user):
        pending_annual = RecurringTaskTemplateFactory(
            user=user,
            title="Anual pendente",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.ANNUAL,
            active=True,
        )
        placed_annual = RecurringTaskTemplateFactory(
            user=user,
            title="Anual colocado",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.ANNUAL,
            active=True,
        )
        RecurringTaskTemplateFactory(
            user=user,
            title="Anual inativo",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.ANNUAL,
            active=False,
        )
        RecurringTaskTemplateFactory(
            user=user,
            title="Mensal pendente",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.MONTHLY,
            active=True,
        )
        RecurringTaskTemplateFactory(
            user=user,
            title="Semanal pendente",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.WEEKLY,
            active=True,
        )

    place_response = auth_client.post(
        f"/api/bujo/recurring-templates/{placed_annual.id}/place/",
        {"monthFirst": "2026-03-01"},
        format="json",
    )
    assert place_response.status_code == 201

    response = auth_client.get(
        "/api/bujo/recurring-templates/?active=true&recurrence_group=annual&unplaced_year=2026"
    )

    assert response.status_code == 200
    assert [t["title"] for t in response.data] == [pending_annual.title]


@pytest.mark.django_db
def test_patch_recurring_template_atualiza_e_retorna_200(auth_client, user):
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(user=user, title="Original")

    response = auth_client.patch(
        f"/api/bujo/recurring-templates/{template.id}/",
        {"title": "Atualizado"},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["title"] == "Atualizado"


@pytest.mark.django_db
def test_patch_recurring_template_atualiza_category_e_retorna_200(auth_client, user):
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(user=user, category=None)

    response = auth_client.patch(
        f"/api/bujo/recurring-templates/{template.id}/",
        {"category": "purple"},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["category"] == "purple"


@pytest.mark.django_db
def test_patch_recurring_template_de_outro_tenant_retorna_404(auth_client, other_user):
    with tenant_context(other_user):
        template = RecurringTaskTemplateFactory(user=other_user, title="De outro tenant")

    response = auth_client.patch(
        f"/api/bujo/recurring-templates/{template.id}/",
        {"title": "Invadido"},
        format="json",
    )

    assert response.status_code == 404


# --- DELETE lógico de template (Story 14.4, AC4/AC5/AC6) ------------------------


@pytest.mark.django_db
def test_delete_recurring_template_retorna_204_sem_corpo_e_some_da_listagem(auth_client, user):
    """AC4: `204 No Content` sem corpo (idioma DRF), e o template desaparece da
    biblioteca. Um template VIVO ao lado impede que o assert de ausência passe
    por lista vazia."""
    with tenant_context(user):
        excluido = RecurringTaskTemplateFactory(user=user, title="A excluir")
        vivo = RecurringTaskTemplateFactory(user=user, title="Permanece")

    response = auth_client.delete(f"/api/bujo/recurring-templates/{excluido.id}/")

    assert response.status_code == 204
    assert response.content == b""
    listagem = auth_client.get("/api/bujo/recurring-templates/").json()
    assert {t["id"] for t in listagem} == {str(vivo.id)}


@pytest.mark.django_db
def test_delete_recurring_template_duas_vezes_retorna_204_com_deleted_at_inalterado(
    auth_client, user
):
    """AC4: idempotência observada NO FIO — 204 nas duas chamadas e o carimbo da
    segunda igual ao da primeira (relido do banco entre as duas, não do retorno).
    Um duplo-clique não pode virar erro visível."""
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(user=user)

    primeira = auth_client.delete(f"/api/bujo/recurring-templates/{template.id}/")
    with tenant_context(user):
        template.refresh_from_db()
        carimbo_original = template.deleted_at

    segunda = auth_client.delete(f"/api/bujo/recurring-templates/{template.id}/")

    assert primeira.status_code == 204
    assert segunda.status_code == 204
    assert carimbo_original is not None
    with tenant_context(user):
        template.refresh_from_db()
        assert template.deleted_at == carimbo_original


@pytest.mark.django_db
def test_delete_recurring_template_sem_token_retorna_401(user):
    """AC4: sem `Authorization`, 401 — o `APIClient` cru não passa pelo
    `auth_client` (que já entra em `tenant_context`)."""
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(user=user)

    response = APIClient().delete(f"/api/bujo/recurring-templates/{template.id}/")

    assert response.status_code == 401
    with tenant_context(user):
        template.refresh_from_db()
        assert template.deleted_at is None


@pytest.mark.django_db
def test_delete_recurring_template_de_outro_tenant_retorna_404_com_bearer_real(user, other_user):
    """AC4 + AD-12: a linha alheia é inexistente para o manager escopado. Com JWT
    de verdade (não `force_authenticate`), o ciclo completo
    `TenantAwareJWTAuthentication` + `TenantMiddleware` é exercitado — e o
    template do outro tenant continua VIVO depois da tentativa."""
    with tenant_context(other_user):
        alheio = RecurringTaskTemplateFactory(user=other_user, title="De outro tenant")

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(user)!s}")
    response = client.delete(f"/api/bujo/recurring-templates/{alheio.id}/")

    assert response.status_code == 404
    with tenant_context(other_user):
        alheio.refresh_from_db()
        assert alheio.deleted_at is None


@pytest.mark.django_db
def test_delete_recurring_template_inexistente_retorna_404(auth_client):
    response = auth_client.delete(f"/api/bujo/recurring-templates/{uuid.uuid4()}/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_matriz_active_x_excluido_em_todas_as_combinacoes_de_query_param(auth_client, user):
    """AC6 — a matriz de 4 células (`active` × vivo/excluído) assertada sobre a
    MESMA listagem, célula por célula, sem nenhuma inferida:

    |              | vivo                          | excluído              |
    |--------------|-------------------------------|-----------------------|
    | active=True  | aparece (sem filtro e `?active=true`)  | não aparece  |
    | active=False | aparece (sem filtro e `?active=false`) | não aparece  |

    Provada em TODAS as combinações de query param que a listagem aceita —
    inclusive `?unplaced_year`, a que mais escapa, porque é a que o `FuturePage`
    usa para os anuais pendentes. Asserts de CONJUNTO de ids (nunca `len`), em
    camelCase via `.json()` (nunca `.data`, que é pré-render/snake_case).
    """
    with tenant_context(user):
        Group = RecurringTaskTemplate.RecurrenceGroup
        vivo_ativo = RecurringTaskTemplateFactory(
            user=user, title="Vivo ativo", active=True, recurrence_group=Group.ANNUAL
        )
        vivo_inativo = RecurringTaskTemplateFactory(
            user=user, title="Vivo inativo", active=False, recurrence_group=Group.ANNUAL
        )
        excluido_ativo = RecurringTaskTemplateFactory(
            user=user, title="Excluído ativo", active=True, recurrence_group=Group.ANNUAL
        )
        excluido_inativo = RecurringTaskTemplateFactory(
            user=user, title="Excluído inativo", active=False, recurrence_group=Group.ANNUAL
        )

    for alvo in (excluido_ativo, excluido_inativo):
        assert auth_client.delete(f"/api/bujo/recurring-templates/{alvo.id}/").status_code == 204

    def ids(url):
        return {t["id"] for t in auth_client.get(url).json()}

    assert ids("/api/bujo/recurring-templates/") == {str(vivo_ativo.id), str(vivo_inativo.id)}
    assert ids("/api/bujo/recurring-templates/?active=true") == {str(vivo_ativo.id)}
    assert ids("/api/bujo/recurring-templates/?active=false") == {str(vivo_inativo.id)}
    assert ids("/api/bujo/recurring-templates/?recurrence_group=annual") == {
        str(vivo_ativo.id),
        str(vivo_inativo.id),
    }
    assert ids("/api/bujo/recurring-templates/?unplaced_year=2026") == {
        str(vivo_ativo.id),
        str(vivo_inativo.id),
    }

    # O soft delete NÃO altera `active`: os dois eixos são ortogonais no schema,
    # não só na UI. O excluído que era ativo continua ativo na linha.
    with tenant_context(user):
        excluido_ativo.refresh_from_db()
        excluido_inativo.refresh_from_db()
        assert excluido_ativo.active is True
        assert excluido_inativo.active is False
        assert excluido_ativo.deleted_at is not None
        assert excluido_inativo.deleted_at is not None


@pytest.mark.django_db
def test_active_e_reversivel_e_deleted_at_e_irreversivel(auth_client, user):
    """AC6: os dois conceitos, provados DISTINTOS de ponta a ponta —
    `active` volta por `PATCH`; `deleted_at` não tem caminho de volta (o próprio
    `PATCH` passa a devolver 404, então nem `{"deletedAt": null}` teria onde
    chegar)."""
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(user=user, active=True)
    url = f"/api/bujo/recurring-templates/{template.id}/"

    def ids_ativos():
        resposta = auth_client.get("/api/bujo/recurring-templates/?active=true")
        return {t["id"] for t in resposta.json()}

    assert auth_client.patch(url, {"active": False}, format="json").status_code == 200
    assert ids_ativos() == set()
    assert auth_client.patch(url, {"active": True}, format="json").status_code == 200
    assert ids_ativos() == {str(template.id)}

    assert auth_client.delete(url).status_code == 204

    # Irreversível: nenhuma escrita alcança o excluído.
    assert auth_client.patch(url, {"active": True}, format="json").status_code == 404
    assert auth_client.patch(url, {"deletedAt": None}, format="json").status_code == 404
    assert (
        auth_client.post(url + "place/", {"weekStart": "2026-03-02"}, format="json").status_code
        == 404
    )


@pytest.mark.django_db
def test_delete_recurring_template_preserva_source_template_da_instancia_no_fio(auth_client, user):
    """AC5 no fio: excluir o template não muda UMA VÍRGULA da resposta de Task —
    `sourceTemplate` continua trazendo o MESMO uuid depois da exclusão."""
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(
            user=user, recurrence_group=RecurringTaskTemplate.RecurrenceGroup.WEEKLY
        )
        week_start = week_start_of(today_for(user))

    place = auth_client.post(
        f"/api/bujo/recurring-templates/{template.id}/place/",
        {"weekStart": week_start.isoformat()},
        format="json",
    )
    assert place.status_code == 201
    antes = auth_client.get(f"/api/bujo/logs/weekly/?week_start={week_start.isoformat()}").json()

    assert auth_client.delete(f"/api/bujo/recurring-templates/{template.id}/").status_code == 204

    depois = auth_client.get(f"/api/bujo/logs/weekly/?week_start={week_start.isoformat()}").json()
    # Placement sem `scheduledDate` cai em `unscheduled` (a instância existe e
    # continua apontando para o template excluído).
    assert [t["sourceTemplate"] for t in depois["unscheduled"]] == [str(template.id)]
    assert depois["unscheduled"] == antes["unscheduled"]  # a exclusão não altera nada da Task


def test_nenhum_caminho_de_producao_faz_exclusao_fisica_de_template():
    """AC3: guard de fonte (mesmo padrão do guard de alias da 14.3) — nem o
    serviço de recorrentes nem a view de detalhe emitem exclusão física. M09 é
    literal: "não há exclusão física", e a linha precisa persistir para a FK
    `Task.source_template` (`SET_NULL`) não apagar a linhagem em silêncio.

    O literal procurado tem o PONTO (`.delete(`), então `def delete(self, ...)`
    da view não casa — é isso que torna o guard escrevível. Cuidado ao editar os
    comentários/docstrings destes dois alvos: `inspect.getsource` lê o bloco
    inteiro, então citar o literal em prosa quebraria o guard.
    """
    for alvo in (bujo.services.recurring, RecurringTaskTemplateDetailView):
        fonte = inspect.getsource(alvo)
        assert ".delete(" not in fonte, getattr(alvo, "__name__", str(alvo))


# --- Passo de QA da Story 14.4 (bmad-qa-generate-e2e-tests) ---------------------
# Lacunas de FIO que o dev-story deixou abertas. As duas daqui são de CONTRATO da
# biblioteca; as das fontes de ritual e da decisão-snapshot ficam na seção da 14.2
# (fim do arquivo), onde as URLs literais e as constantes de alvo já moram.

# Chaves do `RecurringTaskTemplateSerializer` camelizadas — as 8 do `fields`, nem
# uma mais. Constante de módulo porque três respostas diferentes a asseram.
_CHAVES_DE_TEMPLATE_NO_FIO = {
    "id",
    "title",
    "description",
    "eisenhower",
    "category",
    "recurrenceGroup",
    "recurrenceText",
    "active",
}


@pytest.mark.django_db
def test_deleted_at_nao_vaza_no_contrato_de_template_em_nenhuma_das_tres_respostas(
    auth_client, user
):
    """AC4: `RecurringTaskTemplateSerializer` fica INTOCADO — `deleted_at` é
    estado interno, não campo de contrato: seria `null` em 100% das respostas que
    a API consegue emitir (toda resposta traz template vivo), então expô-lo seria
    ruído permanente. `djangorestframework-camel-case` o entregaria como
    `deletedAt`, que é o nome procurado aqui.

    A própria story indicou este teste e este lugar: "se quiser blindar a
    ausência, o lugar é o assert de CONJUNTO DE CHAVES do teste de fio da
    listagem, não um teste de serializer novo". Assert de conjunto (não `not in`)
    e nas TRÊS respostas que emitem template, porque um `fields` ampliado por
    engano vaza nas três de uma vez.
    """
    criacao = auth_client.post(
        "/api/bujo/recurring-templates/",
        {"title": "Regar plantas", "recurrenceGroup": "weekly", "recurrenceText": "toda segunda"},
        format="json",
    )
    assert criacao.status_code == 201
    template_id = criacao.json()["id"]

    listagem = auth_client.get("/api/bujo/recurring-templates/").json()
    edicao = auth_client.patch(
        f"/api/bujo/recurring-templates/{template_id}/", {"active": False}, format="json"
    )
    assert edicao.status_code == 200

    assert set(criacao.json()) == _CHAVES_DE_TEMPLATE_NO_FIO
    assert len(listagem) == 1
    assert set(listagem[0]) == _CHAVES_DE_TEMPLATE_NO_FIO
    assert set(edicao.json()) == _CHAVES_DE_TEMPLATE_NO_FIO


@pytest.mark.django_db
def test_excluido_some_da_listagem_com_os_tres_query_params_combinados(auth_client, user):
    """AC1/AC6: a matriz da story prova cada query param ISOLADO. "Some da
    biblioteca em toda combinação" inclui os três encadeados de uma vez —
    `?active=true&recurrence_group=annual&unplaced_year=`, que é a forma que o
    `FuturePage` mais se aproxima de emitir.

    Cenário com três anuais ativos, para nenhum dos filtros passar por vacuidade:
    o vivo sem instância no ano (deve aparecer), o vivo COM instância no ano (sai
    pelo `unplaced_year`, provando que a cláusula está viva) e o excluído sem
    instância no ano (sai só pelo `live_templates` — se o filtro de vivos não
    existisse, ele seria indistinguível do primeiro).
    """
    ano = 2026
    with tenant_context(user):
        Group = RecurringTaskTemplate.RecurrenceGroup
        vivo_pendente = RecurringTaskTemplateFactory(
            user=user, title="Vivo pendente", active=True, recurrence_group=Group.ANNUAL
        )
        vivo_com_instancia = RecurringTaskTemplateFactory(
            user=user, title="Vivo já colocado", active=True, recurrence_group=Group.ANNUAL
        )
        excluido_pendente = RecurringTaskTemplateFactory(
            user=user, title="Excluído pendente", active=True, recurrence_group=Group.ANNUAL
        )
        place_template(user=user, template_id=vivo_com_instancia.id, month_first=date(ano, 11, 1))

    assert (
        auth_client.delete(f"/api/bujo/recurring-templates/{excluido_pendente.id}/").status_code
        == 204
    )

    combinado = auth_client.get(
        f"/api/bujo/recurring-templates/?active=true&recurrence_group=annual&unplaced_year={ano}"
    ).json()

    assert {t["id"] for t in combinado} == {str(vivo_pendente.id)}


@pytest.mark.django_db
def test_post_place_weekly_cria_task_201(auth_client, user):
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(
            user=user, recurrence_group=RecurringTaskTemplate.RecurrenceGroup.WEEKLY
        )
        week_start = week_start_of(today_for(user))

    response = auth_client.post(
        f"/api/bujo/recurring-templates/{template.id}/place/",
        {"weekStart": week_start.isoformat()},
        format="json",
    )

    assert response.status_code == 201
    assert response.data["title"] == template.title


@pytest.mark.django_db
def test_post_place_monthly_cria_task_201(auth_client, user):
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(
            user=user, recurrence_group=RecurringTaskTemplate.RecurrenceGroup.MONTHLY
        )
        month_first = today_for(user).replace(day=1)

    response = auth_client.post(
        f"/api/bujo/recurring-templates/{template.id}/place/",
        {"monthFirst": month_first.isoformat()},
        format="json",
    )

    assert response.status_code == 201
    assert response.data["title"] == template.title


@pytest.mark.django_db
def test_post_place_sem_o_parametro_de_container_certo_retorna_409(auth_client, user):
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(
            user=user, recurrence_group=RecurringTaskTemplate.RecurrenceGroup.WEEKLY
        )

    response = auth_client.post(
        f"/api/bujo/recurring-templates/{template.id}/place/", {}, format="json"
    )

    assert response.status_code == 409
    assert "detail" in response.data


@pytest.mark.django_db
def test_post_place_template_inexistente_retorna_404(auth_client):
    response = auth_client.post(
        "/api/bujo/recurring-templates/00000000-0000-0000-0000-000000000000/place/",
        {"weekStart": "2026-07-13"},
        format="json",
    )

    assert response.status_code == 404


# ─── TaskDensityView (Story 11.3, AC2) ───────────────────────────────────────


@pytest.mark.django_db
def test_task_density_agrega_as_tres_fontes_e_soma_datas_coincidentes(auth_client, user):
    """(a) daily por log_date, weekly/monthly por scheduled_date; datas
    coincidentes entre fontes somam as contagens."""
    with tenant_context(user):
        daily_log = LogFactory(user=user, log_date=date(2026, 7, 10))
        TaskFactory(user=user, log=daily_log)
        weekly_log = WeeklyLogFactory(user=user, week_start=week_start_of(date(2026, 7, 10)))
        TaskFactory(user=user, weekly_log=weekly_log, scheduled_date=date(2026, 7, 10))
        monthly_log = MonthlyLogFactory(user=user, month_first=date(2026, 7, 1))
        TaskFactory(user=user, monthly_log=monthly_log, scheduled_date=date(2026, 7, 15))

    response = auth_client.get("/api/bujo/task-density/?month_first=2026-07-01")

    assert response.status_code == 200
    by_date = {str(entry["date"]): entry["count"] for entry in response.data["density"]}
    assert by_date == {"2026-07-10": 2, "2026-07-15": 1}


@pytest.mark.django_db
def test_task_density_ordena_por_data_asc_e_so_dias_com_contagem(auth_client, user):
    """(f) resposta só inclui dias com count > 0, ordenados ascendentemente."""
    with tenant_context(user):
        monthly_log = MonthlyLogFactory(user=user, month_first=date(2026, 7, 1))
        TaskFactory(user=user, monthly_log=monthly_log, scheduled_date=date(2026, 7, 20))
        TaskFactory(user=user, monthly_log=monthly_log, scheduled_date=date(2026, 7, 5))

    response = auth_client.get("/api/bujo/task-density/?month_first=2026-07-01")

    assert response.status_code == 200
    dates = [str(entry["date"]) for entry in response.data["density"]]
    assert dates == ["2026-07-05", "2026-07-20"]  # ordenado, sem dias vazios


@pytest.mark.django_db
def test_task_density_scheduled_date_null_nao_conta(auth_client, user):
    """(b) tarefa weekly/monthly sem scheduled_date não tem dia — não conta."""
    with tenant_context(user):
        weekly_log = WeeklyLogFactory(user=user, week_start=week_start_of(date(2026, 7, 6)))
        TaskFactory(user=user, weekly_log=weekly_log, scheduled_date=None)
        monthly_log = MonthlyLogFactory(user=user, month_first=date(2026, 7, 1))
        TaskFactory(user=user, monthly_log=monthly_log, scheduled_date=None)

    response = auth_client.get("/api/bujo/task-density/?month_first=2026-07-01")

    assert response.status_code == 200
    assert response.data["density"] == []


@pytest.mark.django_db
def test_task_density_so_conta_raizes(auth_client, user):
    """(c) subtarefa não infla a contagem do dia — só raízes contam."""
    with tenant_context(user):
        daily_log = LogFactory(user=user, log_date=date(2026, 7, 12))
        parent = TaskFactory(user=user, log=daily_log)
        TaskFactory(user=user, log=daily_log, parent_task=parent)

    response = auth_client.get("/api/bujo/task-density/?month_first=2026-07-01")

    assert response.status_code == 200
    by_date = {str(entry["date"]): entry["count"] for entry in response.data["density"]}
    assert by_date == {"2026-07-12": 1}  # o filho não conta


@pytest.mark.django_db
def test_task_density_so_o_mes_pedido(auth_client, user):
    """(d) tarefas de outros meses não entram na contagem do mês pedido."""
    with tenant_context(user):
        july = MonthlyLogFactory(user=user, month_first=date(2026, 7, 1))
        TaskFactory(user=user, monthly_log=july, scheduled_date=date(2026, 7, 3))
        august = MonthlyLogFactory(user=user, month_first=date(2026, 8, 1))
        TaskFactory(user=user, monthly_log=august, scheduled_date=date(2026, 8, 3))

    response = auth_client.get("/api/bujo/task-density/?month_first=2026-07-01")

    assert response.status_code == 200
    by_date = {str(entry["date"]): entry["count"] for entry in response.data["density"]}
    assert by_date == {"2026-07-03": 1}


@pytest.mark.django_db
def test_task_density_month_first_ausente_retorna_400(auth_client):
    """(e) month_first é obrigatório."""
    response = auth_client.get("/api/bujo/task-density/")

    assert response.status_code == 400
    assert "month_first" in response.data["fields"]


@pytest.mark.django_db
def test_task_density_month_first_invalido_retorna_400(auth_client):
    """(e) data mal formada → 400."""
    response = auth_client.get("/api/bujo/task-density/?month_first=nao-e-data")

    assert response.status_code == 400


@pytest.mark.django_db
def test_task_density_month_first_nao_dia_1_retorna_400(auth_client):
    """(e) deve ser o 1º dia do mês (mesma semântica de MonthlyTaskCreate)."""
    response = auth_client.get("/api/bujo/task-density/?month_first=2026-07-15")

    assert response.status_code == 400
    assert "month_first" in response.data["fields"]


@pytest.mark.django_db
def test_task_density_isolamento_entre_tenants(auth_client, user, other_user):
    """Isolamento (AD-12): tarefas de outro tenant não aparecem na densidade.
    Nova superfície de leitura → exige cobertura de isolamento."""
    with tenant_context(other_user):
        other_monthly = MonthlyLogFactory(user=other_user, month_first=date(2026, 7, 1))
        TaskFactory(user=other_user, monthly_log=other_monthly, scheduled_date=date(2026, 7, 8))

    # auth_client está autenticado como `user`; não deve ver a tarefa de other_user.
    response = auth_client.get("/api/bujo/task-density/?month_first=2026-07-01")

    assert response.status_code == 200
    assert response.data["density"] == []


@pytest.mark.django_db
def test_task_density_sem_autenticacao_retorna_401():
    client = APIClient()

    response = client.get("/api/bujo/task-density/?month_first=2026-07-01")

    assert response.status_code == 401


# ==============================================================================
# Endpoints de ciclo (Story 14.1, AC8) e caracterização do contrato legado (AC5)
# ==============================================================================
WEEKLY_CYCLE_URL = "/api/bujo/logs/weekly/cycle/"
MONTHLY_CYCLE_URL = "/api/bujo/logs/monthly/cycle/"


@pytest.mark.django_db
def test_post_weekly_cycle_abrir_planejamento_sem_alvo_usa_a_semana_corrente(
    auth_client, user
):
    response = auth_client.post(
        WEEKLY_CYCLE_URL, {"action": "open_planning_target"}, format="json"
    )

    assert response.status_code == 200
    body = response.json()
    assert body == {
        "status": "planning",
        "planningCompletedAt": None,
        "weekStart": week_start_of(today_for(user)).isoformat(),
    }


@pytest.mark.django_db
def test_post_weekly_cycle_ciclo_de_vida_completo_via_http(auth_client, user):
    """Percorre planejar → concluir → iniciar → (planejar próxima) → finalizar,
    todo pelo endpoint — 200 em cada caminho felizes."""
    semana = week_start_of(today_for(user))
    proxima = semana + timedelta(days=7)

    def post(action, week_start=None):
        payload = {"action": action}
        if week_start is not None:
            payload["weekStart"] = week_start.isoformat()
        return auth_client.post(WEEKLY_CYCLE_URL, payload, format="json")

    assert post("open_planning_target", semana).status_code == 200
    concluido = post("complete_planning", semana)
    assert concluido.status_code == 200
    assert concluido.json()["planningCompletedAt"] is not None
    assert concluido.json()["status"] == "planning"  # concluir NÃO muda o status

    iniciado = post("start", semana)
    assert iniciado.status_code == 200
    assert iniciado.json()["status"] == "active"

    assert post("open_planning_target", proxima).status_code == 200
    finalizado = post("finalize", semana)
    assert finalizado.status_code == 200
    assert finalizado.json()["status"] == "finalized"


@pytest.mark.django_db
def test_post_weekly_cycle_cancelar_alvo_vazio_retorna_status_null(auth_client, user):
    semana = week_start_of(today_for(user))
    auth_client.post(
        WEEKLY_CYCLE_URL,
        {"action": "open_planning_target", "weekStart": semana.isoformat()},
        format="json",
    )

    response = auth_client.post(
        WEEKLY_CYCLE_URL,
        {"action": "cancel_planning_target", "weekStart": semana.isoformat()},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["status"] is None


@pytest.mark.django_db
def test_post_weekly_cycle_gate_de_iniciar_retorna_409(auth_client, user):
    """Gate não satisfeito → `InvalidTransition` → 409 pelo handler central."""
    semana = week_start_of(today_for(user))
    auth_client.post(
        WEEKLY_CYCLE_URL,
        {"action": "open_planning_target", "weekStart": semana.isoformat()},
        format="json",
    )  # sem concluir planejamento

    response = auth_client.post(
        WEEKLY_CYCLE_URL, {"action": "start", "weekStart": semana.isoformat()}, format="json"
    )

    assert response.status_code == 409
    assert "detail" in response.json()


@pytest.mark.django_db
def test_post_weekly_cycle_segundo_alvo_de_planejamento_retorna_409(auth_client, user):
    """Colisão da unique parcial → `CycleTargetConflict` → 409 (não é transição
    ilegal, é disputa de alvo)."""
    semana = week_start_of(today_for(user))
    auth_client.post(
        WEEKLY_CYCLE_URL,
        {"action": "open_planning_target", "weekStart": semana.isoformat()},
        format="json",
    )

    response = auth_client.post(
        WEEKLY_CYCLE_URL,
        {
            "action": "open_planning_target",
            "weekStart": (semana + timedelta(days=7)).isoformat(),
        },
        format="json",
    )

    assert response.status_code == 409


@pytest.mark.django_db
def test_post_weekly_cycle_alvo_no_passado_retorna_409(auth_client, user):
    passado = week_start_of(today_for(user)) - timedelta(days=7)

    response = auth_client.post(
        WEEKLY_CYCLE_URL,
        {"action": "open_planning_target", "weekStart": passado.isoformat()},
        format="json",
    )

    assert response.status_code == 409


@pytest.mark.django_db
def test_post_weekly_cycle_action_invalida_retorna_400(auth_client):
    response = auth_client.post(WEEKLY_CYCLE_URL, {"action": "reabrir"}, format="json")

    assert response.status_code == 400
    assert "action" in response.json()["fields"]


@pytest.mark.django_db
def test_post_weekly_cycle_week_start_nao_segunda_retorna_400(auth_client):
    response = auth_client.post(
        WEEKLY_CYCLE_URL,
        {"action": "start", "weekStart": "2026-07-22"},  # quarta-feira
        format="json",
    )

    assert response.status_code == 400
    assert "weekStart" in response.json()["fields"]


@pytest.mark.django_db
@pytest.mark.parametrize(
    "action", ["complete_planning", "start", "finalize", "cancel_planning_target"]
)
def test_post_weekly_cycle_acoes_nao_abertura_exigem_week_start(auth_client, action):
    response = auth_client.post(WEEKLY_CYCLE_URL, {"action": action}, format="json")

    assert response.status_code == 400
    assert "weekStart" in response.json()["fields"]


@pytest.mark.django_db
def test_get_weekly_cycle_sem_ciclo_nenhum_devolve_os_quatro_blocos_nulos(auth_client):
    response = auth_client.get(WEEKLY_CYCLE_URL)

    assert response.status_code == 200
    assert response.json() == {
        "active": None,
        "planning": None,
        "start": None,
        "finalize": None,
    }


@pytest.mark.django_db
def test_get_weekly_cycle_devolve_os_quatro_blocos_no_fio_camelcase(auth_client, user):
    """Story 14.5, AC4: forma exata da projeção — os 3 gates de `start`, os 2 de
    `finalize`, e nenhuma escrita (o endpoint é `GET`, mas provado no fio: repetir
    a chamada devolve exatamente o mesmo corpo)."""
    semana = week_start_of(today_for(user))
    proxima = semana + timedelta(days=7)
    auth_client.post(
        WEEKLY_CYCLE_URL,
        {"action": "open_planning_target", "weekStart": semana.isoformat()},
        format="json",
    )
    auth_client.post(
        WEEKLY_CYCLE_URL,
        {"action": "complete_planning", "weekStart": semana.isoformat()},
        format="json",
    )
    auth_client.post(
        WEEKLY_CYCLE_URL, {"action": "start", "weekStart": semana.isoformat()}, format="json"
    )
    auth_client.post(
        WEEKLY_CYCLE_URL,
        {"action": "open_planning_target", "weekStart": proxima.isoformat()},
        format="json",
    )

    corpo = auth_client.get(WEEKLY_CYCLE_URL).json()

    assert corpo["active"]["weekStart"] == semana.isoformat()
    assert corpo["active"]["status"] == "active"
    assert corpo["planning"]["weekStart"] == proxima.isoformat()
    assert corpo["planning"]["status"] == "planning"
    assert corpo["planning"]["planningCompletedAt"] is None
    assert corpo["start"] == {
        "allowed": False,
        "target": proxima.isoformat(),
        "gates": {
            "dateReached": False,
            "planningCompleted": False,
            # `semana` (a corrente, `active`) É o anterior operacional de
            # `proxima` e ainda não está finalizada.
            "previousFinalized": False,
        },
    }
    assert corpo["finalize"] == {
        "allowed": True,
        "target": semana.isoformat(),
        "gates": {"noOpenTasks": True, "nextPlanningExists": True},
    }
    # Repetir a leitura devolve exatamente o mesmo corpo — nenhuma escrita no GET.
    assert auth_client.get(WEEKLY_CYCLE_URL).json() == corpo


@pytest.mark.django_db
def test_get_weekly_cycle_isolamento_entre_tenants_com_bearer_real(user, other_user):
    with tenant_context(other_user):
        semana = week_start_of(today_for(other_user))
        WeeklyLogFactory(user=other_user, week_start=semana, status=WeeklyLog.Status.ACTIVE)

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(user)}")

    assert client.get(WEEKLY_CYCLE_URL).json() == {
        "active": None,
        "planning": None,
        "start": None,
        "finalize": None,
    }


@pytest.mark.django_db
def test_get_weekly_cycle_sem_autenticacao_retorna_401():
    client = APIClient()

    assert client.get(WEEKLY_CYCLE_URL).status_code == 401


@pytest.mark.django_db
def test_post_monthly_cycle_abrir_planejamento_devolve_janela_regular(auth_client, user):
    mes = today_for(user).replace(day=1)
    janela_inicio = week_start_of(mes)

    response = auth_client.post(
        MONTHLY_CYCLE_URL, {"action": "open_planning_target"}, format="json"
    )

    assert response.status_code == 200
    assert response.json() == {
        "status": "planning",
        "planningCompletedAt": None,
        "monthFirst": mes.isoformat(),
        "regularWindowStart": janela_inicio.isoformat(),
        "regularWindowEnd": (janela_inicio + timedelta(days=6)).isoformat(),
    }


@pytest.mark.django_db
def test_post_monthly_cycle_nao_aceita_cancelar_planejamento(auth_client, user):
    """A ação não existe no Monthly (M07) — barrada como `action` inválida (400),
    nunca chegando a um serviço."""
    response = auth_client.post(
        MONTHLY_CYCLE_URL,
        {
            "action": "cancel_planning_target",
            "monthFirst": today_for(user).replace(day=1).isoformat(),
        },
        format="json",
    )

    assert response.status_code == 400
    assert "action" in response.json()["fields"]


@pytest.mark.django_db
def test_post_monthly_cycle_month_first_nao_dia_1_retorna_400(auth_client):
    response = auth_client.post(
        MONTHLY_CYCLE_URL, {"action": "start", "monthFirst": "2026-07-15"}, format="json"
    )

    assert response.status_code == 400
    assert "monthFirst" in response.json()["fields"]


@pytest.mark.django_db
def test_get_weekly_log_expoe_status_e_planning_completed_at(auth_client, user):
    """Campos ADITIVOS (AC8): `closed` permanece, e o GET não atribui estado (AC4)."""
    response = auth_client.get("/api/bujo/logs/weekly/")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] is None
    assert body["planningCompletedAt"] is None
    assert body["closed"] is False

    with tenant_context(user):
        log = WeeklyLog.objects.get(week_start=week_start_of(today_for(user)))
        assert log.status is None  # navegar NÃO cria ciclo operacional


@pytest.mark.django_db
def test_get_monthly_log_expoe_status_e_planning_completed_at(auth_client, user):
    response = auth_client.get("/api/bujo/logs/monthly/")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] is None
    assert body["planningCompletedAt"] is None
    assert body["closed"] is False


@pytest.mark.django_db
def test_get_logs_nao_alteram_estado_de_ciclo_preexistente(auth_client, user):
    """AC4 no nível HTTP: `GET` e `POST` de tarefa passam por `get_or_create_*`, e
    nenhum dos dois pode tocar o estado já conquistado pelo ritual."""
    with tenant_context(user):
        semana = week_start_of(today_for(user))
        weekly = WeeklyLogFactory(user=user, week_start=semana, status="active")
        mes = today_for(user).replace(day=1)
        monthly = MonthlyLogFactory(user=user, month_first=mes, status="planning")

    assert auth_client.get("/api/bujo/logs/weekly/").json()["status"] == "active"
    assert auth_client.get("/api/bujo/logs/monthly/").json()["status"] == "planning"

    auth_client.post(
        "/api/bujo/logs/weekly/",
        {"weekStart": semana.isoformat(), "title": "Tarefa nova"},
        format="json",
    )
    auth_client.post(
        "/api/bujo/logs/monthly/",
        {"monthFirst": mes.isoformat(), "title": "Tarefa nova"},
        format="json",
    )

    weekly.refresh_from_db()
    monthly.refresh_from_db()
    assert (weekly.status, weekly.planning_completed_at) == ("active", None)
    assert (monthly.status, monthly.planning_completed_at) == ("planning", None)


# --- AC5: caracterização do contrato legado ------------------------------------
# O conjunto de chaves de cada resposta consumida pelo Daily/fluxos legados é o
# esperado MAIS os dois campos novos nos dois logs, e nada mais mudou. Chaves em
# camelCase porque a asserção é sobre o CONTRATO DE FIO (`response.json()`), o que
# o frontend realmente recebe — não sobre os nomes internos dos serializers.
LEGACY_TASK_KEYS = {
    "id",
    "title",
    "description",
    "status",
    "eisenhower",
    "category",
    "scheduledDate",
    "subtasks",
    "waitingOn",
    "migrationCount",
    "migratedToTask",
    "sourceTemplate",
}


@pytest.mark.django_db
def test_ac5_caracterizacao_das_respostas_de_log(auth_client, user):
    weekly = auth_client.get("/api/bujo/logs/weekly/").json()
    monthly = auth_client.get("/api/bujo/logs/monthly/").json()

    # `closed` PRESERVADO + exatamente os 2 campos aditivos.
    assert set(weekly) == {
        "weekStart",
        "days",
        "unscheduled",
        "closed",
        "status",
        "planningCompletedAt",
    }
    assert set(monthly) == {
        "monthFirst",
        "tasks",
        "closed",
        "status",
        "planningCompletedAt",
    }
    assert set(weekly["days"][0]) == {"date", "tasks"}


@pytest.mark.django_db
def test_ac5_caracterizacao_da_forma_da_task(auth_client, user):
    """`TaskSerializer` é intocado por esta story — nenhum campo de ciclo vaza
    para dentro da tarefa."""
    with tenant_context(user):
        log = get_or_create_daily_log(user=user, log_date=today_for(user))
        TaskFactory(user=user, log=log)

    tasks = auth_client.get("/api/bujo/logs/today/").json()["tasks"]

    assert set(tasks[0]) == LEGACY_TASK_KEYS


@pytest.mark.django_db
def test_ac5_caracterizacao_das_filas_e_do_arquivo(auth_client, user):
    """Os CONTRATOS de fila permanecem intactos — agora congelados SOBRE o serviço
    unificado (Story 14.3, AD-28 item 8). `/migration/queue/` e `/catch-up/queue/`
    passaram a ser aliases finos de `unified_migration_queue`, e este teste é
    exatamente a prova de que a mudança de implementação não vazou para o fio:
    mesmas rotas, mesmas chaves, mesmos tipos. A remoção formal dos aliases é do
    Épico 18. `weekly-review/queue/` e `monthly-review/queue/` não foram
    unificadas (servem o período ANTERIOR, matéria de ritual) e seguem intactas
    também em implementação."""
    with tenant_context(user):
        semana = week_start_of(today_for(user))
        fechada = WeeklyLogFactory(user=user, week_start=semana - timedelta(days=7))
        TaskFactory(user=user, weekly_log=fechada, status=Task.Status.COMPLETED)
        futuro = MonthlyLogFactory(user=user, month_first=date(2027, 3, 1))
        TaskFactory(user=user, monthly_log=futuro, status=Task.Status.PENDING)

    esperado = {
        "/api/bujo/archive/": {"type", "weekStart", "monthFirst"},
        "/api/bujo/future-log/": {"year", "month", "tasks"},
    }
    for url, keys in esperado.items():
        entries = auth_client.get(url).json()
        assert entries, f"{url} deveria ter ao menos uma entrada"
        assert set(entries[0]) == keys, url

    assert set(auth_client.get("/api/bujo/migration/queue/").json()) == {
        "logDate",
        "tasks",
    }
    assert set(auth_client.get("/api/bujo/weekly-review/queue/").json()) == {
        "weekStart",
        "tasks",
    }
    assert set(auth_client.get("/api/bujo/monthly-review/queue/").json()) == {
        "monthFirst",
        "tasks",
    }
    assert set(auth_client.get("/api/bujo/catch-up/queue/").json()) == {
        "monthlyTasks",
        "weeklyTasks",
        "dailyTasks",
    }
    density = auth_client.get(
        f"/api/bujo/task-density/?month_first={today_for(user).replace(day=1).isoformat()}"
    ).json()
    assert set(density) == {"density"}


@pytest.mark.django_db
def test_ac5_ciclo_finalized_entra_no_arquivo_junto_dos_legados(auth_client, user):
    """AC6 no nível HTTP: `/archive/` devolve a UNIÃO dos dois critérios, sem
    duplicar — e o ciclo `finalized` vazio, que a derivação não pegava, entra."""
    with tenant_context(user):
        base = week_start_of(today_for(user))
        legado = WeeklyLogFactory(user=user, week_start=base - timedelta(days=14))
        TaskFactory(user=user, weekly_log=legado, status=Task.Status.COMPLETED)
        WeeklyLogFactory(
            user=user, week_start=base - timedelta(days=7), status="finalized"
        )

    entries = auth_client.get("/api/bujo/archive/").json()
    semanas = [e["weekStart"] for e in entries if e["type"] == "weekly"]

    assert semanas == [
        (base - timedelta(days=7)).isoformat(),
        (base - timedelta(days=14)).isoformat(),
    ]


# ==============================================================================
# Endpoints de ciclo — lacunas fechadas no passo de QA da Story 14.1
# ==============================================================================
# O dev-story cobriu o caminho felizes e os 409 de gate do WEEKLY via HTTP. O que
# faltava (e entra aqui): autenticação/isolamento dos dois endpoints novos — a
# superfície de maior risco do repo (§6.7) —, o ciclo de vida completo do MONTHLY
# por HTTP (o weekly tinha; o monthly só tinha abertura e os 400 de payload), a
# idempotência no nível do fio (caso-âncora da AD-28 "re-executar Iniciar depois é
# no-op") e o AC4 no caminho de GRAVAÇÃO em mês futuro (armazenamento do Future
# Log), que só era coberto para o mês corrente.


@pytest.mark.django_db
@pytest.mark.parametrize("url", [WEEKLY_CYCLE_URL, MONTHLY_CYCLE_URL])
def test_post_cycle_sem_autenticacao_retorna_401(url):
    """Os dois endpoints novos herdam `IsAuthenticated` do default — sem token
    não existe `user` para o serviço escopar, então nada pode passar."""
    response = APIClient().post(url, {"action": "open_planning_target"}, format="json")

    assert response.status_code == 401


@pytest.mark.django_db
def test_post_weekly_cycle_escopado_por_tenant(user, other_user):
    """A unique parcial é `(user_id) WHERE status=...` — dois usuários podem ter,
    cada um, o SEU alvo na MESMA semana sem colidir, e a ação de um nunca toca o
    log do outro. Bearer real nos dois clientes (não `force_authenticate`), para
    passar pelo middleware de tenant como no request de produção."""
    semana = week_start_of(today_for(user))

    def client_for(u):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(u)}")
        return client

    payload = {"action": "open_planning_target", "weekStart": semana.isoformat()}
    assert client_for(user).post(WEEKLY_CYCLE_URL, payload, format="json").status_code == 200
    assert (
        client_for(other_user).post(WEEKLY_CYCLE_URL, payload, format="json").status_code
        == 200
    )

    # Concluir planejamento pelo other_user não pode timbrar o log do user.
    client_for(other_user).post(
        WEEKLY_CYCLE_URL,
        {"action": "complete_planning", "weekStart": semana.isoformat()},
        format="json",
    )

    with tenant_context(user):
        do_user = WeeklyLog.objects.get(week_start=semana)
    with tenant_context(other_user):
        do_other = WeeklyLog.objects.get(week_start=semana)

    assert do_user.id != do_other.id
    assert (do_user.status, do_user.planning_completed_at) == ("planning", None)
    assert do_other.status == "planning"
    assert do_other.planning_completed_at is not None


@pytest.mark.django_db
def test_post_monthly_cycle_ciclo_de_vida_completo_via_http(auth_client, user):
    """Espelha o teste de ciclo de vida weekly, do lado monthly: planejar →
    concluir → iniciar → (planejar o mês seguinte) → finalizar, tudo pelo
    endpoint. O alvo nunca é enviado na abertura (é determinístico, AC3)."""
    mes = today_for(user).replace(day=1)
    seguinte = add_months(mes, 1)

    def post(action, month_first=None):
        payload = {"action": action}
        if month_first is not None:
            payload["monthFirst"] = month_first.isoformat()
        return auth_client.post(MONTHLY_CYCLE_URL, payload, format="json")

    aberto = post("open_planning_target")
    assert aberto.status_code == 200
    assert aberto.json()["monthFirst"] == mes.isoformat()

    concluido = post("complete_planning", mes)
    assert concluido.status_code == 200
    assert concluido.json()["status"] == "planning"  # concluir NÃO muda o status
    assert concluido.json()["planningCompletedAt"] is not None

    iniciado = post("start", mes)
    assert iniciado.status_code == 200
    assert iniciado.json()["status"] == "active"

    # O alvo passa a ser o mês seguinte SEM que o cliente escolha (determinismo).
    proximo = post("open_planning_target")
    assert proximo.status_code == 200
    assert proximo.json()["monthFirst"] == seguinte.isoformat()

    finalizado = post("finalize", mes)
    assert finalizado.status_code == 200
    assert finalizado.json()["status"] == "finalized"


@pytest.mark.django_db
def test_post_monthly_cycle_gate_de_iniciar_retorna_409(auth_client, user):
    """Iniciar sem planejamento concluído → `InvalidTransition` → 409, igual ao
    weekly (o gate vive no serviço, compartilhado pelos dois tipos)."""
    mes = today_for(user).replace(day=1)
    auth_client.post(MONTHLY_CYCLE_URL, {"action": "open_planning_target"}, format="json")

    response = auth_client.post(
        MONTHLY_CYCLE_URL, {"action": "start", "monthFirst": mes.isoformat()}, format="json"
    )

    assert response.status_code == 409
    assert "detail" in response.json()


@pytest.mark.django_db
def test_post_monthly_cycle_finalizar_sem_proximo_mes_em_planejamento_retorna_409(
    auth_client, user
):
    """Predicado sem lacuna do monthly (AC3): finalizar exige o mês seguinte já
    registrado como `planning`. Sem ele, 409 — e o ciclo continua `active`."""
    mes = today_for(user).replace(day=1)
    auth_client.post(MONTHLY_CYCLE_URL, {"action": "open_planning_target"}, format="json")
    auth_client.post(
        MONTHLY_CYCLE_URL,
        {"action": "complete_planning", "monthFirst": mes.isoformat()},
        format="json",
    )
    auth_client.post(
        MONTHLY_CYCLE_URL, {"action": "start", "monthFirst": mes.isoformat()}, format="json"
    )

    response = auth_client.post(
        MONTHLY_CYCLE_URL,
        {"action": "finalize", "monthFirst": mes.isoformat()},
        format="json",
    )

    assert response.status_code == 409
    with tenant_context(user):
        assert MonthlyLog.objects.get(month_first=mes).status == "active"


@pytest.mark.django_db
def test_post_weekly_cycle_reexecutar_iniciar_e_no_op_com_o_mesmo_corpo(auth_client, user):
    """Caso-âncora da AD-28: "na segunda-feira … passa — re-executar Iniciar
    depois é no-op". No fio isso significa 200 com corpo IDÊNTICO (nunca 409), e
    nenhuma escrita nova: `planningCompletedAt` não é re-timbrado."""
    semana = week_start_of(today_for(user))

    def post(action):
        return auth_client.post(
            WEEKLY_CYCLE_URL,
            {"action": action, "weekStart": semana.isoformat()},
            format="json",
        )

    post("open_planning_target")
    concluido = post("complete_planning")

    # Ainda EM PLANEJAMENTO: concluir de novo é no-op que preserva o timestamp
    # original ("não precisa ser repetida após novas decisões", M06) — nunca 409,
    # nunca re-timbrado.
    reconcluido = post("complete_planning")
    assert reconcluido.status_code == 200
    assert reconcluido.json()["planningCompletedAt"] == concluido.json()["planningCompletedAt"]

    primeira = post("start")
    segunda = post("start")

    assert (primeira.status_code, segunda.status_code) == (200, 200)
    assert primeira.json() == segunda.json()
    assert primeira.json()["status"] == "active"

    # Fronteira do "revisitável ATÉ Iniciar": depois de iniciar, concluir
    # planejamento deixa de ser no-op e passa a ser transição ilegal (409) — o
    # marco de planejamento pertence à fase `planning`, e o corpo do 200 acima
    # prova que o timestamp sobreviveu à transição.
    assert post("complete_planning").status_code == 409
    assert primeira.json()["planningCompletedAt"] == concluido.json()["planningCompletedAt"]


@pytest.mark.django_db
def test_post_task_em_mes_futuro_nao_cria_ciclo_operacional(auth_client, user):
    """AC4 no caminho de GRAVAÇÃO: escrever num `monthly_log` FUTURO é uso do
    Future Log como armazenamento, não entrada em regime. O log nasce e permanece
    `status IS NULL`, aparece no `/future-log/` e não vira ciclo — o teste de AC4
    que já existia só cobria logs do mês corrente."""
    futuro = add_months(today_for(user).replace(day=1), 3)

    criado = auth_client.post(
        "/api/bujo/logs/monthly/",
        {"monthFirst": futuro.isoformat(), "title": "Viagem planejada"},
        format="json",
    )
    assert criado.status_code == 201

    with tenant_context(user):
        log = MonthlyLog.objects.get(month_first=futuro)
    assert (log.status, log.planning_completed_at) == (None, None)

    # Consultar o Future Log (leitura do mesmo log) também não atribui estado.
    future_log = auth_client.get("/api/bujo/future-log/")
    assert future_log.status_code == 200
    assert {(g["year"], g["month"]) for g in future_log.json()} == {
        (futuro.year, futuro.month)
    }
    with tenant_context(user):
        assert MonthlyLog.objects.get(month_first=futuro).status is None


@pytest.mark.django_db
def test_ciclo_em_andamento_com_tudo_disposto_nao_e_reportado_fechado(auth_client, user):
    """REVISÃO 14.1, no fio: `closed` do ciclo DENTRO do regime operacional responde
    ao ritual, não ao conteúdo.

    Antes da correção, dispor a última tarefa da semana `active` devolvia
    `closed: true`, a semana entrava em `/archive/` sem nunca ter sido finalizada e o
    `POST` de uma tarefa nova respondia 409 — trancando o ciclo que M06 declara
    plenamente operável ("a data do calendário não finaliza uma semana
    automaticamente", e só `finalized` é readonly).
    """
    with tenant_context(user):
        semana = week_start_of(today_for(user))
        log = WeeklyLogFactory(user=user, week_start=semana, status="active")
        TaskFactory(user=user, weekly_log=log, status=Task.Status.COMPLETED)

    resposta = auth_client.get("/api/bujo/logs/weekly/").json()
    assert (resposta["status"], resposta["closed"]) == ("active", False)
    assert auth_client.get("/api/bujo/archive/").json() == []

    criacao = auth_client.post(
        "/api/bujo/logs/weekly/",
        {"weekStart": semana.isoformat(), "title": "a semana segue operável"},
        format="json",
    )
    assert criacao.status_code == 201


# =============================================================================
# Story 14.2 — endpoints de fonte, densidade e decisão-snapshot
# =============================================================================
_R_SEMANA = date(2026, 3, 2)  # segunda
_R_MES = date(2026, 3, 1)

# URLs como LITERAIS (convenção do arquivo): a rota É contrato, então um `reverse`
# esconderia exatamente a mudança que estes testes precisam pegar.
FONTES_SEMANAIS = [
    "/api/bujo/rituals/weekly/sources/monthly-in-week/",
    "/api/bujo/rituals/weekly/sources/recurring/",
    "/api/bujo/rituals/weekly/sources/previous-weekly/",
    "/api/bujo/rituals/weekly/sources/pending-dailies/",
    "/api/bujo/rituals/weekly/density/",
]
FONTES_MENSAIS = [
    "/api/bujo/rituals/monthly/sources/recurring/",
    "/api/bujo/rituals/monthly/sources/future-log/",
    "/api/bujo/rituals/monthly/sources/previous-monthly/",
    "/api/bujo/rituals/monthly/density/",
]
DECISOES_URL = "/api/bujo/ritual-decisions/"


@pytest.mark.django_db
@pytest.mark.parametrize("url", [*FONTES_SEMANAIS, *FONTES_MENSAIS, DECISOES_URL])
def test_ritual_endpoints_sem_autenticacao_retornam_401(url):
    """AC7: os 10 endpoints novos exigem token."""
    client = APIClient()
    metodo = client.post if url == DECISOES_URL else client.get
    assert metodo(url).status_code == 401


@pytest.mark.django_db
@pytest.mark.parametrize("url", FONTES_SEMANAIS)
def test_fontes_semanais_exigem_week_start_numa_segunda(auth_client, url):
    """AC7/Task 7: query param `week_start` em snake_case, validado como segunda."""
    assert auth_client.get(url).status_code == 400  # ausente
    assert auth_client.get(f"{url}?week_start=2026-03-03").status_code == 400  # terça
    assert auth_client.get(f"{url}?week_start={_R_SEMANA.isoformat()}").status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize("url", FONTES_MENSAIS)
def test_fontes_mensais_exigem_month_first_no_dia_um(auth_client, url):
    assert auth_client.get(url).status_code == 400
    assert auth_client.get(f"{url}?month_first=2026-03-15").status_code == 400
    assert auth_client.get(f"{url}?month_first={_R_MES.isoformat()}").status_code == 200


@pytest.mark.django_db
def test_fontes_isolamento_entre_tenants_com_bearer_real(user, other_user):
    """AC7: isolamento provado pelo ciclo de request COMPLETO (JWT + middleware),
    não por `tenant_context` manual."""
    with tenant_context(other_user):
        semana = WeeklyLogFactory(
            user=other_user, week_start=_R_SEMANA, status=WeeklyLog.Status.PLANNING
        )
        mes = MonthlyLogFactory(
            user=other_user, month_first=_R_MES, status=MonthlyLog.Status.PLANNING
        )
        TaskFactory(user=other_user, weekly_log=semana, scheduled_date=_R_SEMANA)
        TaskFactory(user=other_user, monthly_log=mes, scheduled_date=_R_SEMANA)
        RecurringTaskTemplateFactory(user=other_user)

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(user)}")

    for url in FONTES_SEMANAIS:
        corpo = client.get(f"{url}?week_start={_R_SEMANA.isoformat()}").json()
        assert corpo.get("eligibleCount", 0) == 0
        assert corpo.get("total", 0) == 0
    for url in FONTES_MENSAIS:
        corpo = client.get(f"{url}?month_first={_R_MES.isoformat()}").json()
        assert corpo.get("eligibleCount", 0) == 0
        assert corpo.get("total", 0) == 0


@pytest.mark.django_db
def test_post_decisao_ritual_cria_e_e_idempotente_no_fio(auth_client, user):
    """AC2/AC8: corpo em camelCase (`weekStart`/`taskId`) pelo `CamelCaseJSONParser`,
    resposta camelizada, e re-postar devolve o MESMO registro."""
    with tenant_context(user):
        WeeklyLogFactory(user=user, week_start=_R_SEMANA, status=WeeklyLog.Status.PLANNING)
        mes = MonthlyLogFactory(user=user, month_first=_R_MES)
        tarefa = TaskFactory(user=user, monthly_log=mes, scheduled_date=_R_SEMANA)

    corpo = {"decision": "keep", "weekStart": _R_SEMANA.isoformat(), "taskId": str(tarefa.id)}
    primeiro = auth_client.post(DECISOES_URL, corpo, format="json")
    segundo = auth_client.post(DECISOES_URL, corpo, format="json")

    assert primeiro.status_code == 201
    assert set(primeiro.json()) == {
        "id",
        "decision",
        "weekStart",
        "monthFirst",
        "taskId",
        "recurringTemplateId",
        "createdAt",
        "updatedAt",
    }
    assert primeiro.json()["decision"] == "keep"
    # O alvo volta como a CHAVE DE PERÍODO enviada, não como o id do log: quem
    # endereça o ritual por semana/mês não teria o que fazer com um UUID opaco.
    assert primeiro.json()["weekStart"] == _R_SEMANA.isoformat()
    assert primeiro.json()["taskId"] == str(tarefa.id)
    assert primeiro.json()["monthFirst"] is None
    assert primeiro.json()["recurringTemplateId"] is None
    assert segundo.json()["id"] == primeiro.json()["id"]
    assert segundo.json()["updatedAt"] == primeiro.json()["updatedAt"]  # nenhuma escrita


@pytest.mark.django_db
def test_post_decisao_ritual_forma_invalida_e_400(auth_client, user):
    """A distinção é deliberada: **forma** é 400 no serializer; **combinação** é 409
    no serviço (regra de produto nunca em serializer — §6.6)."""
    with tenant_context(user):
        semana = WeeklyLogFactory(
            user=user, week_start=_R_SEMANA, status=WeeklyLog.Status.PLANNING
        )
        tarefa = TaskFactory(user=user, weekly_log=semana)
        template = RecurringTaskTemplateFactory(user=user)

    corpos_invalidos = [
        {"decision": "keep", "taskId": str(tarefa.id)},  # nenhum alvo
        {
            "decision": "keep",
            "weekStart": _R_SEMANA.isoformat(),
            "monthFirst": _R_MES.isoformat(),
            "taskId": str(tarefa.id),
        },  # dois alvos
        {"decision": "keep", "weekStart": _R_SEMANA.isoformat()},  # nenhum item
        {
            "decision": "keep",
            "weekStart": _R_SEMANA.isoformat(),
            "taskId": str(tarefa.id),
            "recurringTemplateId": str(template.id),
        },  # dois itens
        {"decision": "keep", "weekStart": "2026-03-03", "taskId": str(tarefa.id)},  # terça
        {"decision": "keep", "monthFirst": "2026-03-15", "taskId": str(tarefa.id)},  # dia 15
        {"decision": "skip_month", "weekStart": _R_SEMANA.isoformat(), "taskId": str(tarefa.id)},
    ]
    for corpo in corpos_invalidos:
        assert auth_client.post(DECISOES_URL, corpo, format="json").status_code == 400, corpo


@pytest.mark.django_db
def test_post_decisao_ritual_combinacao_ilegal_e_alvo_fora_de_planning_sao_409(auth_client, user):
    with tenant_context(user):
        semana = WeeklyLogFactory(user=user, week_start=_R_SEMANA, status=WeeklyLog.Status.ACTIVE)
        tarefa = TaskFactory(user=user, weekly_log=semana)
        template = RecurringTaskTemplateFactory(user=user)

    # Alvo em `active` (não `planning`) → InvalidTransition.
    fora_de_planning = auth_client.post(
        DECISOES_URL,
        {"decision": "keep", "weekStart": _R_SEMANA.isoformat(), "taskId": str(tarefa.id)},
        format="json",
    )
    # Combinação ilegal: `keep` não se aplica a template → InvalidRitualDecision.
    combinacao = auth_client.post(
        DECISOES_URL,
        {
            "decision": "keep",
            "weekStart": _R_SEMANA.isoformat(),
            "recurringTemplateId": str(template.id),
        },
        format="json",
    )
    assert fora_de_planning.status_code == 409
    assert combinacao.status_code == 409


@pytest.mark.django_db
def test_envelope_de_fonte_no_fio_e_camelcase(auth_client, user):
    """AC8/AC5: forma exata do envelope no fio, incluindo o bucket
    `alreadyPlaced` e a ausência deliberada de `label` (a cópia pt-BR é do UI)."""
    with tenant_context(user):
        WeeklyLogFactory(user=user, week_start=_R_SEMANA, status=WeeklyLog.Status.PLANNING)
        template = RecurringTaskTemplateFactory(user=user, recurrence_text="regar plantas")
        colocado = RecurringTaskTemplateFactory(user=user, recurrence_text="mercado")
        place_template(user=user, template_id=colocado.id, week_start=_R_SEMANA)

    corpo = auth_client.get(
        f"/api/bujo/rituals/weekly/sources/recurring/?week_start={_R_SEMANA.isoformat()}"
    ).json()

    assert set(corpo) == {
        "sourceId",
        "blocking",
        "countsTowardProgress",
        "eligibleCount",
        "pendingDecisionCount",
        "reviewed",
        "items",
        "alreadyPlaced",
    }
    assert "label" not in corpo
    assert corpo["sourceId"] == "recurring"
    assert set(corpo["items"][0]) == {"template", "decision", "instancesInTargetCount"}
    assert corpo["items"][0]["template"]["id"] == str(template.id)
    assert corpo["items"][0]["decision"] is None
    assert set(corpo["alreadyPlaced"]) == {"countsTowardProgress", "items"}
    assert corpo["alreadyPlaced"]["countsTowardProgress"] is False


@pytest.mark.django_db
def test_fonte_pending_dailies_no_fio_usa_groups(auth_client, user):
    """AC3: a única fonte com `groups` em vez de `items` planos."""
    with tenant_context(user):
        WeeklyLogFactory(user=user, week_start=_R_SEMANA, status=WeeklyLog.Status.PLANNING)
        log = LogFactory(user=user, log_date=_R_SEMANA - timedelta(days=3))
        TaskFactory(user=user, log=log)

    corpo = auth_client.get(
        f"/api/bujo/rituals/weekly/sources/pending-dailies/?week_start={_R_SEMANA.isoformat()}"
    ).json()

    assert "items" not in corpo
    assert [grupo["date"] for grupo in corpo["groups"]] == [
        (_R_SEMANA - timedelta(days=3)).isoformat()
    ]
    assert set(corpo["groups"][0]["items"][0]) == {"task", "decision"}
    # `decision` NUNCA entra no `TaskSerializer` (compartilhado por ~10 respostas
    # legadas): fica no item da fonte — AC8.
    assert "decision" not in corpo["groups"][0]["items"][0]["task"]


@pytest.mark.django_db
def test_fontes_bloqueantes_no_fio_expoem_ready_to_finalize(auth_client, user):
    for url, param in (
        (
            f"/api/bujo/rituals/weekly/sources/previous-weekly/?week_start={_R_SEMANA.isoformat()}",
            "weekly",
        ),
        (
            f"/api/bujo/rituals/monthly/sources/previous-monthly/?month_first={_R_MES.isoformat()}",
            "monthly",
        ),
    ):
        corpo = auth_client.get(url).json()
        assert corpo["blocking"] is True, param
        assert corpo["readyToFinalize"] is False, param
        assert corpo["sourceId"] == f"previous-{param}", param
        # Story 14.5, AC4: campo aditivo, `null` sem anterior operacional.
        assert corpo["previousPeriodStart"] is None, param


@pytest.mark.django_db
def test_fontes_bloqueantes_no_fio_expoem_previous_period_start(auth_client, user):
    """Story 14.5, AC4: `previousPeriodStart` no fio, camelCase, com o valor real
    do anterior operacional (não `null`) quando ele existe."""
    with tenant_context(user):
        WeeklyLogFactory(
            user=user, week_start=_R_SEMANA + timedelta(weeks=1), status=WeeklyLog.Status.PLANNING
        )
        WeeklyLogFactory(user=user, week_start=_R_SEMANA, status=WeeklyLog.Status.ACTIVE)
        MonthlyLogFactory(
            user=user, month_first=add_months(_R_MES, 1), status=MonthlyLog.Status.PLANNING
        )
        MonthlyLogFactory(user=user, month_first=_R_MES, status=MonthlyLog.Status.ACTIVE)

    semana_alvo = (_R_SEMANA + timedelta(weeks=1)).isoformat()
    semanal = auth_client.get(
        f"/api/bujo/rituals/weekly/sources/previous-weekly/?week_start={semana_alvo}"
    ).json()
    mes_alvo = add_months(_R_MES, 1).isoformat()
    mensal = auth_client.get(
        f"/api/bujo/rituals/monthly/sources/previous-monthly/?month_first={mes_alvo}"
    ).json()

    assert semanal["previousPeriodStart"] == _R_SEMANA.isoformat()
    assert mensal["previousPeriodStart"] == _R_MES.isoformat()


@pytest.mark.django_db
def test_densidade_no_fio_tem_by_status_com_as_seis_chaves(auth_client, user):
    """AC6: as 6 chaves de status não têm underscore, então a camelização de saída
    não as altera — verificado no FIO, não deduzido."""
    with tenant_context(user):
        semana = WeeklyLogFactory(user=user, week_start=_R_SEMANA)
        raiz = TaskFactory(user=user, weekly_log=semana, scheduled_date=_R_SEMANA)
        TaskFactory(user=user, weekly_log=semana, scheduled_date=_R_SEMANA, parent_task=raiz)

    corpo = auth_client.get(
        f"/api/bujo/rituals/weekly/density/?week_start={_R_SEMANA.isoformat()}"
    ).json()

    assert set(corpo) == {"days", "undated", "total"}
    assert len(corpo["days"]) == 7
    assert set(corpo["days"][0]) == {"date", "total", "byStatus"}
    assert set(corpo["days"][0]["byStatus"]) == {
        "pending",
        "started",
        "completed",
        "cancelled",
        "migrated",
        "postponed",
    }
    assert corpo["days"][0]["total"] == 2  # subtarefa contada
    assert corpo["total"] == 2
    assert set(corpo["undated"]) == {"total", "byStatus"}


@pytest.mark.django_db
def test_densidade_mensal_no_fio_devolve_todos_os_dias_do_mes(auth_client, user):
    corpo = auth_client.get("/api/bujo/rituals/monthly/density/?month_first=2028-02-01").json()
    assert len(corpo["days"]) == 29  # bissexto


# --- Passo de QA (bmad-qa-generate-e2e-tests) ----------------------------------
# Lacunas de FIO que o dev-story deixou abertas: as três formas de resposta e as
# duas células da matriz que só existiam na camada de serviço, mais o laço de
# ritual (ler fonte → decidir → reler fonte) que é a razão de os endpoints
# existirem e que nenhum teste percorria inteiro por HTTP.
@pytest.mark.django_db
def test_fonte_recorrentes_mensais_no_fio_expoe_os_dois_buckets(auth_client, user):
    """AC4/AC5 no fio: a fonte mensal é a ÚNICA com dois buckets, e
    `alreadyPlacedInYear` (a elegibilidade anual por ano-alvo) só aparecia em
    teste de serviço — `already_placed_in_year` é também a única chave de bucket
    com underscore, então a camelização precisa ser verificada, não deduzida.
    """
    with tenant_context(user):
        MonthlyLogFactory(user=user, month_first=_R_MES, status=MonthlyLog.Status.PLANNING)
        RecurringTaskTemplateFactory(
            user=user,
            recurrence_text="a-mensal pendente",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.MONTHLY,
        )
        mensal_colocado = RecurringTaskTemplateFactory(
            user=user,
            recurrence_text="b-mensal colocado",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.MONTHLY,
        )
        place_template(user=user, template_id=mensal_colocado.id, month_first=_R_MES)
        RecurringTaskTemplateFactory(
            user=user,
            recurrence_text="c-anual pendente",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.ANNUAL,
        )
        anual_no_ano = RecurringTaskTemplateFactory(
            user=user,
            recurrence_text="d-anual ja resolvido no ano",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.ANNUAL,
        )
        # Instância em NOVEMBRO do mesmo ano: resolve a pendência anual de MARÇO
        # sem que uma linha de código leia `recurrence_text`.
        place_template(user=user, template_id=anual_no_ano.id, month_first=date(2026, 11, 1))

    corpo = auth_client.get(
        f"/api/bujo/rituals/monthly/sources/recurring/?month_first={_R_MES.isoformat()}"
    ).json()

    assert set(corpo) == {
        "sourceId",
        "blocking",
        "countsTowardProgress",
        "eligibleCount",
        "pendingDecisionCount",
        "reviewed",
        "items",
        "alreadyPlaced",
        "alreadyPlacedInYear",
    }
    assert corpo["sourceId"] == "recurring"
    assert corpo["blocking"] is False
    # Ordem do M07: mensais ativos PRIMEIRO, depois anuais elegíveis.
    assert [item["template"]["recurrenceText"] for item in corpo["items"]] == [
        "a-mensal pendente",
        "c-anual pendente",
    ]
    assert corpo["eligibleCount"] == 2
    assert [item["template"]["recurrenceText"] for item in corpo["alreadyPlaced"]["items"]] == [
        "b-mensal colocado"
    ]
    assert [
        item["template"]["recurrenceText"] for item in corpo["alreadyPlacedInYear"]["items"]
    ] == ["d-anual ja resolvido no ano"]
    # Nenhum dos dois buckets entra no denominador do progresso (AC5).
    assert corpo["alreadyPlaced"]["countsTowardProgress"] is False
    assert corpo["alreadyPlacedInYear"]["countsTowardProgress"] is False


@pytest.mark.django_db
def test_post_decisao_keep_undated_no_fio_grava_no_alvo_mensal(auth_client, user):
    """AC2: a célula `keep_undated` (alvo MENSAL × Task do Future Log) nunca havia
    devolvido 201 por HTTP — só `keep` tinha. O caso-âncora da AD-28 exige também
    que a Task permaneça INTACTA e sem dia."""
    with tenant_context(user):
        mes = MonthlyLogFactory(user=user, month_first=_R_MES, status=MonthlyLog.Status.PLANNING)
        tarefa = TaskFactory(user=user, monthly_log=mes, scheduled_date=None)

    resposta = auth_client.post(
        DECISOES_URL,
        {"decision": "keep_undated", "monthFirst": _R_MES.isoformat(), "taskId": str(tarefa.id)},
        format="json",
    )

    assert resposta.status_code == 201
    assert resposta.json()["decision"] == "keep_undated"
    assert resposta.json()["monthFirst"] == _R_MES.isoformat()
    assert resposta.json()["weekStart"] is None
    with tenant_context(user):
        tarefa.refresh_from_db()
        assert tarefa.scheduled_date is None
        assert tarefa.status == Task.Status.PENDING
        assert tarefa.monthly_log_id == mes.id


@pytest.mark.django_db
def test_post_decisao_skip_week_no_fio_nao_cria_task_nem_desativa_template(auth_client, user):
    """AC2 + caso-âncora literal da AD-28 item 6, no fio: "linha em
    `ritual_decisions`; **nenhuma Task nasce**; o template **não** é desativado"."""
    with tenant_context(user):
        WeeklyLogFactory(user=user, week_start=_R_SEMANA, status=WeeklyLog.Status.PLANNING)
        template = RecurringTaskTemplateFactory(
            user=user,
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.WEEKLY,
            recurrence_text="regar plantas",
        )
        tarefas_antes = Task.objects.count()

    resposta = auth_client.post(
        DECISOES_URL,
        {
            "decision": "skip_week",
            "weekStart": _R_SEMANA.isoformat(),
            "recurringTemplateId": str(template.id),
        },
        format="json",
    )

    assert resposta.status_code == 201
    assert resposta.json()["recurringTemplateId"] == str(template.id)
    assert resposta.json()["taskId"] is None
    with tenant_context(user):
        assert Task.objects.count() == tarefas_antes  # nenhuma Task nasceu
        template.refresh_from_db()
        assert template.active is True  # o aviso some, o template continua vivo


@pytest.mark.django_db
def test_laco_do_ritual_no_fio_decisao_zera_a_pendencia_sem_mudar_a_elegibilidade(
    auth_client, user
):
    """AC2/AC5 fim a fim por HTTP: ler a fonte → POSTar a decisão → reler a fonte.

    É o laço que a UI das 14.5/14.6 vai executar. O invariante que importa é a
    assimetria: `pendingDecisionCount` cai e `reviewed` vira `true`, mas
    `eligibleCount` NÃO muda — decisão-snapshot não remove o item da fonte, e a
    Task não é tocada (AD-28 item 6, ponto 8).
    """
    with tenant_context(user):
        WeeklyLogFactory(user=user, week_start=_R_SEMANA, status=WeeklyLog.Status.PLANNING)
        mes = MonthlyLogFactory(user=user, month_first=_R_MES)
        tarefa = TaskFactory(user=user, monthly_log=mes, scheduled_date=_R_SEMANA)

    url = f"/api/bujo/rituals/weekly/sources/monthly-in-week/?week_start={_R_SEMANA.isoformat()}"
    antes = auth_client.get(url).json()
    assert (antes["eligibleCount"], antes["pendingDecisionCount"], antes["reviewed"]) == (
        1,
        1,
        False,
    )
    assert antes["items"][0]["decision"] is None

    criacao = auth_client.post(
        DECISOES_URL,
        {"decision": "keep", "weekStart": _R_SEMANA.isoformat(), "taskId": str(tarefa.id)},
        format="json",
    )
    assert criacao.status_code == 201

    depois = auth_client.get(url).json()
    assert (depois["eligibleCount"], depois["pendingDecisionCount"], depois["reviewed"]) == (
        1,
        0,
        True,
    )
    assert depois["items"][0]["decision"] == "keep"
    assert depois["items"][0]["task"]["id"] == str(tarefa.id)


@pytest.mark.django_db
def test_post_decisao_com_item_de_outro_tenant_e_409_e_nao_persiste(user, other_user):
    """AC7 na ESCRITA: o isolamento do fio só era provado nas leituras. Uma decisão
    apontando para a Task de outro tenant é indistinguível de item inexistente
    (409, mensagem neutra) e não deixa linha em nenhum dos dois tenants."""
    with tenant_context(user):
        WeeklyLogFactory(user=user, week_start=_R_SEMANA, status=WeeklyLog.Status.PLANNING)
    with tenant_context(other_user):
        mes_alheio = MonthlyLogFactory(user=other_user, month_first=_R_MES)
        tarefa_alheia = TaskFactory(
            user=other_user, monthly_log=mes_alheio, scheduled_date=_R_SEMANA
        )

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(user)}")
    resposta = client.post(
        DECISOES_URL,
        {"decision": "keep", "weekStart": _R_SEMANA.isoformat(), "taskId": str(tarefa_alheia.id)},
        format="json",
    )

    assert resposta.status_code == 409
    with tenant_context(user):
        assert RitualDecision.objects.count() == 0
    with tenant_context(other_user):
        assert RitualDecision.objects.count() == 0


@pytest.mark.django_db
@pytest.mark.parametrize("url", [*FONTES_SEMANAIS, *FONTES_MENSAIS])
def test_fontes_e_densidades_recusam_escrita(auth_client, url):
    """AC7/AC8: fonte e densidade são LEITURA. Um `POST` que passasse a 200 seria
    uma superfície de escrita nascida por acidente de roteamento."""
    assert auth_client.post(url, {}, format="json").status_code == 405


@pytest.mark.django_db
def test_decisoes_de_ritual_recusam_leitura(auth_client):
    """AC2/Questão aberta #4: `/ritual-decisions/` é só `POST` — não há listagem
    nem `DELETE` de decisão-snapshot nesta story, e isso é contrato, não omissão."""
    assert auth_client.get(DECISOES_URL).status_code == 405
    assert auth_client.delete(DECISOES_URL).status_code == 405


# --- AC8: caracterização do contrato legado ------------------------------------
@pytest.mark.django_db
def test_ac8_contrato_legado_preservado_nas_nove_respostas_nomeadas(auth_client, user):
    """AC8: **nenhum** endpoint existente muda de rota, campo ou semântica.

    Caracterização sobre o JSON de fio (camelCase) das 9 respostas que a AC8 nomeia
    — as chaves de topo são o contrato que ~10 superfícies de frontend consomem.
    Um campo acrescentado por engano (ex.: `decision` no `TaskSerializer`) quebra
    aqui.
    """
    with tenant_context(user):
        semana = WeeklyLogFactory(user=user, week_start=_R_SEMANA)
        mes = MonthlyLogFactory(user=user, month_first=_R_MES)
        TaskFactory(user=user, weekly_log=semana, scheduled_date=_R_SEMANA)
        TaskFactory(user=user, monthly_log=mes)
        RecurringTaskTemplateFactory(user=user)

    esperado = {
        f"/api/bujo/task-density/?month_first={_R_MES.isoformat()}": {"density"},
        "/api/bujo/migration/queue/": {"logDate", "tasks"},
        "/api/bujo/weekly-review/queue/": {"weekStart", "tasks"},
        "/api/bujo/monthly-review/queue/": {"monthFirst", "tasks"},
        "/api/bujo/catch-up/queue/": {"monthlyTasks", "weeklyTasks", "dailyTasks"},
        f"/api/bujo/logs/weekly/?week_start={_R_SEMANA.isoformat()}": {
            "weekStart",
            "days",
            "unscheduled",
            "closed",
            "status",
            "planningCompletedAt",
        },
        f"/api/bujo/logs/monthly/?month_first={_R_MES.isoformat()}": {
            "monthFirst",
            "tasks",
            "closed",
            "status",
            "planningCompletedAt",
        },
    }
    for url, chaves in esperado.items():
        resposta = auth_client.get(url)
        assert resposta.status_code == 200, url
        assert set(resposta.json()) == chaves, url

    # Respostas de LISTA: o contrato é o conjunto de chaves de cada elemento.
    campos_de_template = {
        "id",
        "title",
        "description",
        "eisenhower",
        "category",
        "recurrenceGroup",
        "recurrenceText",
        "active",
    }
    templates = auth_client.get("/api/bujo/recurring-templates/")
    assert templates.status_code == 200
    assert set(templates.json()[0]) == campos_de_template
    # `future-log/` só devolve meses FUTUROS com tarefa raiz, então precisa de um
    # mês semeado relativo a `today_for` — sem ele o assert de forma seria vácuo
    # (lista vazia passa por qualquer contrato).
    with tenant_context(user):
        futuro = MonthlyLogFactory(
            user=user, month_first=date(today_for(user).year + 1, 3, 1)
        )
        TaskFactory(user=user, monthly_log=futuro)
    grupos = auth_client.get("/api/bujo/future-log/")
    assert grupos.status_code == 200
    assert grupos.json(), "o mês futuro semeado deveria aparecer"
    assert set(grupos.json()[0]) == {"year", "month", "tasks"}


@pytest.mark.django_db
def test_ac8_task_serializer_nao_ganhou_campo_de_decisao(auth_client, user):
    """AC8, dito de forma direta: `decision` é relativa a um ALVO de ritual, então
    não pode virar campo do `TaskSerializer` — que é compartilhado por ~10
    respostas legadas."""
    with tenant_context(user):
        semana = WeeklyLogFactory(user=user, week_start=_R_SEMANA)
        TaskFactory(user=user, weekly_log=semana, scheduled_date=_R_SEMANA)

    dias = auth_client.get(f"/api/bujo/logs/weekly/?week_start={_R_SEMANA.isoformat()}").json()
    tarefa = dias["days"][0]["tasks"][0]
    assert set(tarefa) == {
        "id",
        "title",
        "description",
        "status",
        "eisenhower",
        "category",
        "scheduledDate",
        "subtasks",
        "waitingOn",
        "migrationCount",
        "migratedToTask",
        "sourceTemplate",
    }


# --- fila unificada de migração (Story 14.3; AD-28 itens 7-8) -------------------

_FILA_UNIFICADA_URL = "/api/bujo/migration/unified-queue/"
_MIGRATION_QUEUE_URL = "/api/bujo/migration/queue/"
_CATCH_UP_QUEUE_URL = "/api/bujo/catch-up/queue/"


def _ids_de_topo_da_fila_unificada(payload):
    return [
        item["id"]
        for secao in payload["sections"]
        for grupo in secao["groups"]
        for item in grupo["items"]
    ]


def _semear_cenario_da_fila(user):
    """Pendências nos TRÊS níveis + 6 distratores. Devolve (pendentes, distratores)
    como dicts de `nome -> id serializado` para os asserts nomearem o que provam."""
    hoje = today_for(user)
    ontem = hoje - timedelta(days=1)
    anteontem = hoje - timedelta(days=2)
    semana_anterior = week_start_of(hoje) - timedelta(weeks=1)
    mes_anterior = (hoje.replace(day=1) - timedelta(days=1)).replace(day=1)
    mes_retro_anterior = (mes_anterior - timedelta(days=1)).replace(day=1)

    log_antigo = LogFactory(user=user, log_date=anteontem)
    raiz_aberta = TaskFactory(user=user, log=log_antigo, status=Task.Status.STARTED)
    pendentes = {
        "month": TaskFactory(
            user=user,
            monthly_log=MonthlyLogFactory(user=user, month_first=mes_retro_anterior),
            status=Task.Status.PENDING,
        ).id,
        "week": TaskFactory(
            user=user,
            weekly_log=WeeklyLogFactory(user=user, week_start=semana_anterior - timedelta(weeks=1)),
            status=Task.Status.PENDING,
        ).id,
        "day_anteontem": raiz_aberta.id,
        "day_ontem": TaskFactory(
            user=user, log=LogFactory(user=user, log_date=ontem), status=Task.Status.PENDING
        ).id,
    }
    distratores = {
        "de_hoje": TaskFactory(
            user=user, log=LogFactory(user=user, log_date=hoje), status=Task.Status.PENDING
        ).id,
        "semana_anterior": TaskFactory(
            user=user,
            weekly_log=WeeklyLogFactory(user=user, week_start=semana_anterior),
            status=Task.Status.PENDING,
        ).id,
        "mes_anterior": TaskFactory(
            user=user,
            monthly_log=MonthlyLogFactory(user=user, month_first=mes_anterior),
            status=Task.Status.PENDING,
        ).id,
        "completed_antiga": TaskFactory(
            user=user, log=log_antigo, status=Task.Status.COMPLETED
        ).id,
        # Subtarefa ABERTA de raiz ABERTA: não é item de topo em nenhuma resposta,
        # mas APARECE aninhada em `subtasks` da raiz — `TaskSerializer.get_subtasks`
        # devolve `obj.subtasks.all()` sem filtro de status, e isso é o contrato
        # vigente. Daí o assert comparar ids de TOPO, e não procurar o id no corpo.
        "subtarefa_aberta": TaskFactory(
            user=user, log=log_antigo, parent_task=raiz_aberta, status=Task.Status.PENDING
        ).id,
    }
    # Ids como STRING: as asserções são sobre o JSON de fio, onde `UUIDField`
    # sai serializado — comparar `UUID(...)` com `str` falha silenciosamente por
    # tipo, não por conteúdo.
    return (
        {nome: str(task_id) for nome, task_id in pendentes.items()},
        {nome: str(task_id) for nome, task_id in distratores.items()},
    )


@pytest.mark.django_db
def test_get_fila_unificada_sem_autenticacao_retorna_401():
    assert APIClient().get(_FILA_UNIFICADA_URL).status_code == 401


@pytest.mark.django_db
def test_get_fila_unificada_escopada_por_tenant_com_bearer_real(user, other_user):
    """AC2: escopo por tenant pelo manager `objects`, provado no ciclo de request
    real (JWT de verdade, sem `force_authenticate`) — a pendência antiga de
    `other_user` não vaza."""
    with tenant_context(other_user):
        TaskFactory(
            user=other_user,
            log=LogFactory(user=other_user, log_date=today_for(other_user) - timedelta(days=3)),
            status=Task.Status.PENDING,
        )

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(user)}")
    payload = client.get(_FILA_UNIFICADA_URL).json()

    assert payload["totalCount"] == 0
    assert _ids_de_topo_da_fila_unificada(payload) == []
    assert current_user_id.get() is None  # nenhum vazamento entre requests


@pytest.mark.django_db
def test_get_fila_unificada_forma_de_fio_em_camelcase(auth_client, user):
    """AC2/AC7: a camelização é do RENDERER, então só se prova no fio (`.json()`).
    Três seções SEMPRE presentes, na ordem `month`/`week`/`day`, com `count` por
    fonte, `periodStart` por grupo e itens no `TaskSerializer` puro."""
    with tenant_context(user):
        pendentes, _ = _semear_cenario_da_fila(user)

    payload = auth_client.get(_FILA_UNIFICADA_URL).json()

    assert set(payload) == {"totalCount", "sections"}
    assert [secao["sourceId"] for secao in payload["sections"]] == ["month", "week", "day"]
    for secao in payload["sections"]:
        assert set(secao) == {"sourceId", "count", "groups"}
        for grupo in secao["groups"]:
            assert set(grupo) == {"periodStart", "items"}
    assert payload["totalCount"] == len(pendentes)
    assert payload["totalCount"] == sum(secao["count"] for secao in payload["sections"])
    itens = [
        item
        for secao in payload["sections"]
        for grupo in secao["groups"]
        for item in grupo["items"]
    ]
    assert itens, "o cenário semeado tem pendências nos três níveis"
    assert set(itens[0]) == LEGACY_TASK_KEYS  # `TaskSerializer` puro, sem campo novo


@pytest.mark.django_db
def test_get_fila_unificada_secoes_vazias_presentes_e_sem_materializar_log(auth_client, user):
    """AC2: usuário sem log nenhum recebe as três seções vazias (não 404) e a
    requisição não cria linha em `Log`/`WeeklyLog`/`MonthlyLog`."""
    payload = auth_client.get(_FILA_UNIFICADA_URL).json()

    assert payload["totalCount"] == 0
    assert [
        (secao["sourceId"], secao["count"], secao["groups"]) for secao in payload["sections"]
    ] == [("month", 0, []), ("week", 0, []), ("day", 0, [])]
    with tenant_context(user):
        assert Log.objects.count() == 0
        assert WeeklyLog.objects.count() == 0
        assert MonthlyLog.objects.count() == 0


@pytest.mark.django_db
def test_uniao_dos_dois_aliases_equivale_a_fila_unificada(auth_client, user, other_user):
    """AC6: o conjunto de ids de `/migration/queue/` ∪ `/catch-up/queue/` é
    EXATAMENTE o da fila unificada, num cenário com pendências nos três níveis e
    6 distratores — nenhum distrator aparece como item de TOPO nas três respostas.
    """
    with tenant_context(other_user):
        de_outro_tenant = TaskFactory(
            user=other_user,
            log=LogFactory(user=other_user, log_date=today_for(other_user) - timedelta(days=3)),
            status=Task.Status.PENDING,
        )
    with tenant_context(user):
        pendentes, distratores = _semear_cenario_da_fila(user)
    # 6º distrator: pendência antiga de OUTRO tenant, nomeada junto dos cinco.
    distratores["outro_tenant"] = str(de_outro_tenant.id)

    unificada = auth_client.get(_FILA_UNIFICADA_URL).json()
    migration = auth_client.get(_MIGRATION_QUEUE_URL).json()
    catch_up = auth_client.get(_CATCH_UP_QUEUE_URL).json()

    ids_unificada = _ids_de_topo_da_fila_unificada(unificada)
    ids_migration = [item["id"] for item in migration["tasks"]]
    ids_catch_up = [
        item["id"]
        for chave in ("monthlyTasks", "weeklyTasks", "dailyTasks")
        for item in catch_up[chave]
    ]

    assert set(ids_unificada) == set(pendentes.values())
    assert set(ids_migration) | set(ids_catch_up) == set(ids_unificada)
    # Sem dedup: `Task` tem exatamente um container (CHECK `task_exactly_one_log`),
    # então as seções são disjuntas e os dois aliases particionam a união.
    assert len(ids_migration) + len(ids_catch_up) == len(ids_unificada)

    for nome, task_id in distratores.items():
        assert task_id not in ids_unificada, nome
        assert task_id not in ids_migration, nome
        assert task_id not in ids_catch_up, nome


@pytest.mark.django_db
def test_particao_de_ontem_entre_os_dois_aliases(auth_client, user):
    """AC5: "ontem" é o nível `day` da fila unificada e território EXCLUSIVO do
    alias `/migration/queue/`; `/catch-up/queue/.dailyTasks` continua cortando em
    `< ontem`. É a fronteira que separa os dois aliases."""
    with tenant_context(user):
        pendentes, _ = _semear_cenario_da_fila(user)
        ontem = today_for(user) - timedelta(days=1)

    unificada = auth_client.get(_FILA_UNIFICADA_URL).json()
    migration = auth_client.get(_MIGRATION_QUEUE_URL).json()
    catch_up = auth_client.get(_CATCH_UP_QUEUE_URL).json()

    assert migration["logDate"] == ontem.isoformat()
    assert [item["id"] for item in migration["tasks"]] == [pendentes["day_ontem"]]

    secao_day = next(s for s in unificada["sections"] if s["sourceId"] == "day")
    assert pendentes["day_ontem"] in [
        item["id"] for grupo in secao_day["groups"] for item in grupo["items"]
    ]
    assert [grupo["periodStart"] for grupo in secao_day["groups"]] == [
        (ontem - timedelta(days=1)).isoformat(),
        ontem.isoformat(),
    ]

    ids_dailies = [item["id"] for item in catch_up["dailyTasks"]]
    assert pendentes["day_ontem"] not in ids_dailies
    assert ids_dailies == [pendentes["day_anteontem"]]


def test_aliases_de_fila_nao_contem_query_propria():
    """AC5: guard de fonte (espelha os greps `?raw` do Épico 13) — os dois aliases
    projetam a resposta do serviço unificado e mais nada. Falha alta e cedo se
    alguém "otimizar" um alias reintroduzindo query própria, o que faria os
    contratos legados divergirem silenciosamente da fila unificada."""
    proibidos = ("Task.objects", "Log.objects", ".filter(", "status__in", "today_for")
    for view in (MigrationQueueView, CatchUpQueueView):
        fonte = inspect.getsource(view)
        assert "unified_migration_queue(user=request.user)" in fonte, view.__name__
        for token in proibidos:
            assert token not in fonte, f"{view.__name__} voltou a conter `{token}`"


@pytest.mark.django_db
@pytest.mark.parametrize("metodo", ["post", "put", "patch", "delete"])
def test_fila_unificada_recusa_escrita(auth_client, metodo):
    """AC3: "nenhum endpoint de escrita novo é criado" — a ausência de superfície de
    escrita é DECISÃO de produto (a decisão por item continua sendo
    `POST /tasks/<pk>/migrate/`), e ausência não testada é ausência que volta.

    Um `405` aqui é o contrato; um `2xx` significaria que alguém acoplou mutação à
    rota da fila e a herança da AD-18 passou a ter duas portas.
    """
    resposta = getattr(auth_client, metodo)(_FILA_UNIFICADA_URL, {}, format="json")

    assert resposta.status_code == 405, metodo


@pytest.mark.django_db
def test_fila_unificada_ignora_query_params_e_nao_pagina(auth_client, user):
    """AC2/AD-09 item 8: a fila "apresenta TUDO, item a item" — sem janela, sem
    limite, sem paginação, e sem query param nenhum ("a fila é sempre tudo que ficou
    atrás de hoje").

    O teste manda os params que um cliente distraído (ou uma 14.9 apressada) tentaria
    primeiro e exige o corpo IDÊNTICO ao da chamada sem params: se um dia alguém
    acrescentar `?limit=`/`?source_id=`, este teste falha e a mudança de contrato
    passa a ser deliberada em vez de silenciosa.
    """
    with tenant_context(user):
        pendentes, _ = _semear_cenario_da_fila(user)

    sem_params = auth_client.get(_FILA_UNIFICADA_URL).json()
    com_params = auth_client.get(
        f"{_FILA_UNIFICADA_URL}?limit=1&page=2&cursor=abc&source_id=day&sourceId=day"
    ).json()

    assert sem_params["totalCount"] == len(pendentes)  # cenário povoado (não-vacuidade)
    assert com_params == sem_params


@pytest.mark.django_db
def test_fila_unificada_ignora_periodos_futuros_nos_tres_niveis(auth_client, user):
    """AC1: as fronteiras são EXCLUSIVAS e olham para trás — o futuro nunca é
    pendência.

    O sétimo distrator, que o cenário de equivalência não tem: pendências em
    containers FUTUROS. Não é hipótese de laboratório — o Future Log (Épico 6) cria
    tarefas em Monthly Logs de meses adiante, e o Weekly/Daily de amanhã existe assim
    que o usuário navega para frente (`past-period-navigation`). Se alguma fronteira
    virasse `__gt`/`__lte` mal escrita, a fila passaria a cobrar decisão sobre o que
    ainda não aconteceu — e os dois aliases levariam isso ao Daily legado.
    """
    with tenant_context(user):
        hoje = today_for(user)
        proximo_mes = (hoje.replace(day=28) + timedelta(days=7)).replace(day=1)
        futuros = {
            "amanha": TaskFactory(
                user=user,
                log=LogFactory(user=user, log_date=hoje + timedelta(days=1)),
                status=Task.Status.PENDING,
            ).id,
            "proxima_semana": TaskFactory(
                user=user,
                weekly_log=WeeklyLogFactory(
                    user=user, week_start=week_start_of(hoje) + timedelta(weeks=1)
                ),
                status=Task.Status.STARTED,
            ).id,
            "proximo_mes": TaskFactory(
                user=user,
                monthly_log=MonthlyLogFactory(user=user, month_first=proximo_mes),
                status=Task.Status.PENDING,
            ).id,
        }

    unificada = auth_client.get(_FILA_UNIFICADA_URL).json()
    migration = auth_client.get(_MIGRATION_QUEUE_URL).json()
    catch_up = auth_client.get(_CATCH_UP_QUEUE_URL).json()

    assert unificada["totalCount"] == 0
    assert [
        (secao["sourceId"], secao["count"], secao["groups"]) for secao in unificada["sections"]
    ] == [("month", 0, []), ("week", 0, []), ("day", 0, [])]
    assert migration["tasks"] == []
    assert (catch_up["monthlyTasks"], catch_up["weeklyTasks"], catch_up["dailyTasks"]) == (
        [],
        [],
        [],
    )
    # As três tarefas existem de verdade (o cenário não é vazio por acidente de seed).
    with tenant_context(user):
        assert Task.objects.filter(id__in=futuros.values()).count() == 3


# =============================================================================
# Story 14.4 — soft delete NAS FONTES DOS RITUAIS, no fio (passo de QA)
# =============================================================================
# O dev-story provou a AC2 pontos 2/3/4/7 na camada de SERVIÇO. Aqui mora o que
# só o fio mostra e que a UI das 14.5/14.6 vai consumir: os envelopes das duas
# fontes "Recorrentes" (quatro buckets, não dois), as contagens de progresso
# derivadas deles (`eligibleCount`/`pendingDecisionCount`/`reviewed`) e o
# `POST /ritual-decisions/` sobre template excluído — cujo 409 e cuja mensagem
# NEUTRA são contrato de segurança, não detalhe de implementação.
_URL_FONTE_RECORRENTES_SEMANAL = (
    f"/api/bujo/rituals/weekly/sources/recurring/?week_start={_R_SEMANA.isoformat()}"
)
_URL_FONTE_RECORRENTES_MENSAL = (
    f"/api/bujo/rituals/monthly/sources/recurring/?month_first={_R_MES.isoformat()}"
)


@pytest.mark.django_db
def test_fonte_recorrentes_semanal_no_fio_perde_o_excluido_dos_dois_buckets_e_das_contagens(
    auth_client, user
):
    """AC2 ponto 2 no FIO: o excluído sai de `items` E de `alreadyPlaced`, e as
    contagens de progresso do envelope acompanham.

    O que só aqui é verificável: `eligibleCount`/`pendingDecisionCount`/`reviewed`
    são computados na leitura sobre a lista de itens (nenhuma coluna, nenhum
    cache), então excluir um template PENDENTE muda o denominador do progresso do
    ritual — e excluir o ÚLTIMO pendente faz a fonte passar a "revisada". É o
    efeito de produto do soft delete sobre o ritual, e nenhum teste de serviço o
    observa.

    Cada bucket tem um template VIVO ao lado do excluído, então os asserts são de
    CONJUNTO de ids e nenhum passa por lista vazia (achado B1 da 14.2). O
    `template` aninhado é serializado pelo MESMO
    `RecurringTaskTemplateSerializer` da biblioteca: a ausência de `deletedAt`
    vale para ele também.
    """
    with tenant_context(user):
        WeeklyLogFactory(user=user, week_start=_R_SEMANA, status=WeeklyLog.Status.PLANNING)
        vivo_pendente = RecurringTaskTemplateFactory(user=user, recurrence_text="a-vivo pendente")
        excluido_pendente = RecurringTaskTemplateFactory(
            user=user, recurrence_text="b-excluido pendente"
        )
        vivo_alocado = RecurringTaskTemplateFactory(user=user, recurrence_text="c-vivo alocado")
        excluido_alocado = RecurringTaskTemplateFactory(
            user=user, recurrence_text="d-excluido alocado"
        )
        place_template(user=user, template_id=vivo_alocado.id, week_start=_R_SEMANA)
        place_template(user=user, template_id=excluido_alocado.id, week_start=_R_SEMANA)

    antes = auth_client.get(_URL_FONTE_RECORRENTES_SEMANAL).json()
    assert (antes["eligibleCount"], antes["pendingDecisionCount"], antes["reviewed"]) == (
        2,
        2,
        False,
    )
    assert set(antes["items"][0]["template"]) == _CHAVES_DE_TEMPLATE_NO_FIO

    for alvo in (excluido_pendente, excluido_alocado):
        assert auth_client.delete(f"/api/bujo/recurring-templates/{alvo.id}/").status_code == 204

    depois = auth_client.get(_URL_FONTE_RECORRENTES_SEMANAL).json()
    assert {item["template"]["id"] for item in depois["items"]} == {str(vivo_pendente.id)}
    assert {item["template"]["id"] for item in depois["alreadyPlaced"]["items"]} == {
        str(vivo_alocado.id)
    }
    # O pendente excluído saiu do denominador do progresso, mas a fonte continua
    # com pendência de pé — `reviewed` NÃO virou `true` por tabela.
    assert (depois["eligibleCount"], depois["pendingDecisionCount"], depois["reviewed"]) == (
        1,
        1,
        False,
    )

    # Excluir o último pendente encerra a pendência da fonte: é o soft delete
    # atuando sobre o progresso do ritual, não só sobre a biblioteca. O bucket
    # fora do progresso continua intacto (o já alocado não é pendência).
    assert (
        auth_client.delete(f"/api/bujo/recurring-templates/{vivo_pendente.id}/").status_code == 204
    )
    final = auth_client.get(_URL_FONTE_RECORRENTES_SEMANAL).json()
    assert (final["eligibleCount"], final["pendingDecisionCount"], final["reviewed"]) == (
        0,
        0,
        True,
    )
    assert {item["template"]["id"] for item in final["alreadyPlaced"]["items"]} == {
        str(vivo_alocado.id)
    }


@pytest.mark.django_db
def test_fonte_recorrentes_mensal_no_fio_perde_o_excluido_dos_quatro_buckets(auth_client, user):
    """AC2 pontos 3 e 4 no FIO — e nos QUATRO buckets, não nos três da story.

    A fonte mensal é a única com dois buckets fora do progresso, e o teste de
    serviço da story cobriu `items` (mensal + anual elegível) e
    `alreadyPlacedInYear`, deixando `alreadyPlaced` (o mensal JÁ colocado no
    mês-alvo) sem nenhuma cobertura de exclusão em nenhuma camada. Aqui os quatro
    são assertados, cada um com um vivo ao lado do excluído.

    Ordenação por `recurrence_text` (prefixos `a-`…`h-`) para os asserts de
    `items` poderem ser de LISTA: a ordem "mensais primeiro, anuais depois" é
    contrato do M07 e não deve ser afrouxada para conjunto só porque a story
    acrescentou um filtro.
    """
    with tenant_context(user):
        MonthlyLogFactory(user=user, month_first=_R_MES, status=MonthlyLog.Status.PLANNING)
        Group = RecurringTaskTemplate.RecurrenceGroup
        # Os dois vivos que só aparecem em `items` não precisam de nome: o assert
        # é sobre `recurrenceText`, e a ordenação do M07 é parte do contrato.
        RecurringTaskTemplateFactory(
            user=user, recurrence_text="a-mensal vivo", recurrence_group=Group.MONTHLY
        )
        mensal_excluido = RecurringTaskTemplateFactory(
            user=user, recurrence_text="b-mensal excluido", recurrence_group=Group.MONTHLY
        )
        mensal_alocado_vivo = RecurringTaskTemplateFactory(
            user=user, recurrence_text="c-mensal alocado vivo", recurrence_group=Group.MONTHLY
        )
        mensal_alocado_excluido = RecurringTaskTemplateFactory(
            user=user, recurrence_text="d-mensal alocado excluido", recurrence_group=Group.MONTHLY
        )
        RecurringTaskTemplateFactory(
            user=user, recurrence_text="e-anual vivo", recurrence_group=Group.ANNUAL
        )
        anual_excluido = RecurringTaskTemplateFactory(
            user=user, recurrence_text="f-anual excluido", recurrence_group=Group.ANNUAL
        )
        anual_no_ano_vivo = RecurringTaskTemplateFactory(
            user=user, recurrence_text="g-anual no ano vivo", recurrence_group=Group.ANNUAL
        )
        anual_no_ano_excluido = RecurringTaskTemplateFactory(
            user=user, recurrence_text="h-anual no ano excluido", recurrence_group=Group.ANNUAL
        )
        place_template(user=user, template_id=mensal_alocado_vivo.id, month_first=_R_MES)
        place_template(user=user, template_id=mensal_alocado_excluido.id, month_first=_R_MES)
        # Instância em NOVEMBRO do mesmo ano resolve a elegibilidade anual de MARÇO.
        place_template(user=user, template_id=anual_no_ano_vivo.id, month_first=date(2026, 11, 1))
        place_template(
            user=user, template_id=anual_no_ano_excluido.id, month_first=date(2026, 11, 1)
        )

    for alvo in (mensal_excluido, mensal_alocado_excluido, anual_excluido, anual_no_ano_excluido):
        assert auth_client.delete(f"/api/bujo/recurring-templates/{alvo.id}/").status_code == 204

    corpo = auth_client.get(_URL_FONTE_RECORRENTES_MENSAL).json()

    # Bucket 1 e 2 — mensais pendentes e anuais elegíveis, na ordem do M07.
    assert [item["template"]["recurrenceText"] for item in corpo["items"]] == [
        "a-mensal vivo",
        "e-anual vivo",
    ]
    # Bucket 3 — mensal já colocado no mês-alvo (sem cobertura de exclusão antes).
    assert [item["template"]["recurrenceText"] for item in corpo["alreadyPlaced"]["items"]] == [
        "c-mensal alocado vivo"
    ]
    # Bucket 4 — elegibilidade anual já resolvida no ano do alvo.
    assert [
        item["template"]["recurrenceText"] for item in corpo["alreadyPlacedInYear"]["items"]
    ] == ["g-anual no ano vivo"]
    assert (corpo["eligibleCount"], corpo["pendingDecisionCount"], corpo["reviewed"]) == (
        2,
        2,
        False,
    )


@pytest.mark.django_db
def test_post_decisao_skip_week_sobre_template_excluido_e_409_neutro_e_nao_persiste(
    auth_client, user
):
    """AC2 ponto 7 no FIO. A story especifica o STATUS (409) e a MENSAGEM
    (`_ILLEGAL`, neutra) — as duas coisas que o teste de serviço, que só assere a
    exceção, não observa.

    A neutralidade é contrato de SEGURANÇA herdado da 14.2: a mesma mensagem
    responde a "combinação ilegal", "item de outro tenant" e "item inexistente",
    porque um texto específico de "não existe" revelaria a ausência (ou a
    presença) de linha alheia. Um 404 aqui também seria vazamento — e é a
    tentação natural, já que o `PATCH` sobre excluído devolve exatamente 404.

    O template VIVO ao lado prova que o cenário é decidível: o mesmo POST, com o
    id do vivo, devolve 201. Sem ele, um 409 por qualquer outro motivo (alvo fora
    de `planning`, matriz, corpo malformado) passaria por este teste.
    """
    with tenant_context(user):
        WeeklyLogFactory(user=user, week_start=_R_SEMANA, status=WeeklyLog.Status.PLANNING)
        vivo = RecurringTaskTemplateFactory(user=user, recurrence_text="a-vivo")
        excluido = RecurringTaskTemplateFactory(user=user, recurrence_text="b-excluido")

    assert auth_client.delete(f"/api/bujo/recurring-templates/{excluido.id}/").status_code == 204

    def decidir(template_id):
        return auth_client.post(
            DECISOES_URL,
            {
                "decision": "skip_week",
                "weekStart": _R_SEMANA.isoformat(),
                "recurringTemplateId": str(template_id),
            },
            format="json",
        )

    sobre_excluido = decidir(excluido.id)
    sobre_vivo = decidir(vivo.id)

    assert sobre_excluido.status_code == 409
    assert sobre_excluido.json()["detail"] == "Esta decisão não se aplica a este item neste ritual."
    assert "não existe" not in sobre_excluido.json()["detail"]
    assert "fields" not in sobre_excluido.json()
    assert sobre_vivo.status_code == 201  # o cenário É decidível — o 409 é do excluído
    with tenant_context(user):
        assert {d.recurring_template_id for d in RitualDecision.objects.all()} == {vivo.id}


@pytest.mark.django_db
def test_excluir_template_com_decisao_snapshot_preserva_a_decisao_e_a_leitura_da_fonte(
    auth_client, user
):
    """Interação 14.2 × 14.4, sem cobertura em nenhuma das duas stories.

    `RitualDecision.recurring_template` é `on_delete=CASCADE`: num delete FÍSICO a
    decisão-snapshot iria embora com o template. O soft delete não dispara
    CASCADE — a linha da decisão SOBREVIVE (auditoria do ritual preservada, mesma
    razão de ser da linhagem da AC5), enquanto o template desaparece da fonte.

    O risco real coberto aqui é a órfã de leitura: `decisions_for_target` monta
    `by_template` a partir das decisões DO ALVO, sem saber de exclusão, então uma
    entrada aponta para um template que a fonte não lista mais. A fonte tem de
    continuar respondendo 200 com o conjunto certo, e não contar a órfã em
    `eligibleCount`.
    """
    with tenant_context(user):
        WeeklyLogFactory(user=user, week_start=_R_SEMANA, status=WeeklyLog.Status.PLANNING)
        decidido = RecurringTaskTemplateFactory(user=user, recurrence_text="a-decidido")
        vivo = RecurringTaskTemplateFactory(user=user, recurrence_text="b-vivo")

    decisao = auth_client.post(
        DECISOES_URL,
        {
            "decision": "skip_week",
            "weekStart": _R_SEMANA.isoformat(),
            "recurringTemplateId": str(decidido.id),
        },
        format="json",
    )
    assert decisao.status_code == 201
    antes = auth_client.get(_URL_FONTE_RECORRENTES_SEMANAL).json()
    assert [(i["template"]["id"], i["decision"]) for i in antes["items"]] == [
        (str(decidido.id), "skip_week"),
        (str(vivo.id), None),
    ]

    assert auth_client.delete(f"/api/bujo/recurring-templates/{decidido.id}/").status_code == 204

    depois = auth_client.get(_URL_FONTE_RECORRENTES_SEMANAL).json()
    assert [(i["template"]["id"], i["decision"]) for i in depois["items"]] == [
        (str(vivo.id), None)
    ]
    assert (depois["eligibleCount"], depois["pendingDecisionCount"], depois["reviewed"]) == (
        1,
        1,
        False,
    )
    # A decisão-snapshot persiste apontando para o template excluído: nada de
    # CASCADE, nada de órfã apagada em silêncio.
    with tenant_context(user):
        assert RitualDecision.objects.filter(recurring_template_id=decidido.id).count() == 1
        assert RecurringTaskTemplate.objects.filter(pk=decidido.id).exists()
