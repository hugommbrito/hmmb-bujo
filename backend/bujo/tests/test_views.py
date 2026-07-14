"""Testes de `TodayLogView`/`TaskTransitionView` (AC #1, #2)."""

from datetime import date, timedelta

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from bujo.models import Log, MonthlyLog, RecurringTaskTemplate, Task, WeeklyLog
from bujo.services.logs import (
    get_or_create_daily_log,
    get_or_create_monthly_log,
    get_or_create_weekly_log,
)
from bujo.tests.factories import (
    LogFactory,
    MonthlyLogFactory,
    RecurringTaskTemplateFactory,
    TaskFactory,
    WeeklyLogFactory,
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
def test_post_migrate_destination_month_sem_scheduled_date_retorna_400(auth_client, user):
    with tenant_context(user):
        task = TaskFactory(user=user, status=Task.Status.PENDING)

    response = auth_client.post(
        f"/api/bujo/tasks/{task.id}/migrate/", {"destination": "month"}, format="json"
    )

    assert response.status_code == 400


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
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.data["title"] == "Revisão semanal"
    assert response.data["recurrence_group"] == "weekly"
    assert response.data["active"] is True


@pytest.mark.django_db
def test_get_recurring_templates_lista_todos_sem_filtro(auth_client, user):
    with tenant_context(user):
        RecurringTaskTemplateFactory(user=user, title="Ativo", active=True)
        RecurringTaskTemplateFactory(user=user, title="Inativo", active=False)

    response = auth_client.get("/api/bujo/recurring-templates/")

    assert response.status_code == 200
    assert {t["title"] for t in response.data} == {"Ativo", "Inativo"}


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
def test_patch_recurring_template_de_outro_tenant_retorna_404(auth_client, other_user):
    with tenant_context(other_user):
        template = RecurringTaskTemplateFactory(user=other_user, title="De outro tenant")

    response = auth_client.patch(
        f"/api/bujo/recurring-templates/{template.id}/",
        {"title": "Invadido"},
        format="json",
    )

    assert response.status_code == 404


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
