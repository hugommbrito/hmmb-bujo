"""Testes dos serviços de `bujo` (AC #1, #2, #3)."""

import itertools

import pytest

from bujo.models import Log, Task
from bujo.services.logs import get_or_create_daily_log
from bujo.services.state_machine import ALLOWED, transition_task
from bujo.services.tasks import create_task, reorder_task, update_task
from bujo.tests.factories import LogFactory, TaskFactory
from core.exceptions import InvalidReorderTarget, InvalidTransition
from core.tenant import tenant_context

ALL_STATUSES = list(Task.Status.values)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "from_status,to_status", list(itertools.product(ALL_STATUSES, ALL_STATUSES))
)
def test_transition_task_matriz_completa(user, from_status, to_status):
    """Cobre as 36 combinações (6x6) contra `ALLOWED` — dentro persiste, fora levanta."""
    with tenant_context(user):
        task = TaskFactory(user=user, status=from_status)

        if to_status in ALLOWED[from_status]:
            result = transition_task(user=user, task_id=task.id, to_status=to_status)
            assert result.status == to_status
            task.refresh_from_db()
            assert task.status == to_status
        else:
            with pytest.raises(InvalidTransition):
                transition_task(user=user, task_id=task.id, to_status=to_status)
            task.refresh_from_db()
            assert task.status == from_status


@pytest.mark.django_db
def test_transition_task_escopado_por_tenant(user, other_user):
    """`Task.objects.get` é auto-escopado por `TenantManager` — `transition_task`
    não alcança uma tarefa de outro tenant, mesmo com o `task_id` correto."""
    with tenant_context(user):
        task = TaskFactory(user=user, status=Task.Status.PENDING)

    with tenant_context(other_user):
        with pytest.raises(Task.DoesNotExist):
            transition_task(user=other_user, task_id=task.id, to_status=Task.Status.STARTED)


@pytest.mark.django_db
def test_get_or_create_daily_log_idempotente(user):
    with tenant_context(user):
        first = get_or_create_daily_log(user=user, log_date="2026-01-01")
        second = get_or_create_daily_log(user=user, log_date="2026-01-01")

        assert first.id == second.id
        assert Log.objects.filter(log_date="2026-01-01").count() == 1


@pytest.mark.django_db
def test_get_or_create_daily_log_escopado_por_tenant(user, other_user):
    with tenant_context(user):
        log_user = get_or_create_daily_log(user=user, log_date="2026-01-01")

    with tenant_context(other_user):
        log_other_user = get_or_create_daily_log(user=other_user, log_date="2026-01-01")

    assert log_user.id != log_other_user.id


@pytest.mark.django_db
def test_create_task_raiz_com_order_index_sequencial(user):
    with tenant_context(user):
        log = LogFactory(user=user)

        first = create_task(user=user, log=log, title="Primeira")
        second = create_task(user=user, log=log, title="Segunda")
        third = create_task(user=user, log=log, title="Terceira")

        assert [first.order_index, second.order_index, third.order_index] == [0.0, 1.0, 2.0]
        assert first.status == Task.Status.PENDING
        assert first.parent_task is None


@pytest.mark.django_db
def test_create_task_subtarefa_order_index_relativo_aos_irmaos(user):
    """AD-08 item 12: `order_index` da subtarefa é relativo aos irmãos sob o
    mesmo pai — não compete com o pai nem com filhos de outro pai."""
    with tenant_context(user):
        log = LogFactory(user=user)
        parent = create_task(user=user, log=log, title="Pai")
        other_parent = create_task(user=user, log=log, title="Outro pai")

        child_1 = create_task(user=user, log=log, title="Filha 1", parent_task=parent)
        child_2 = create_task(user=user, log=log, title="Filha 2", parent_task=parent)
        other_child = create_task(
            user=user, log=log, title="Filha de outro pai", parent_task=other_parent
        )

        assert child_1.order_index == 0.0
        assert child_2.order_index == 1.0
        assert other_child.order_index == 0.0
        assert child_1.parent_task_id == parent.id
        assert child_1.log_id == parent.log_id


@pytest.mark.django_db
def test_update_task_altera_so_os_campos_passados(user):
    with tenant_context(user):
        task = TaskFactory(user=user, title="Original", description="Descrição original")

        updated = update_task(user=user, task_id=task.id, title="Atualizada")

        assert updated.title == "Atualizada"
        assert updated.description == "Descrição original"


@pytest.mark.django_db
def test_create_task_escopado_por_tenant(user, other_user):
    with tenant_context(user):
        log = LogFactory(user=user)
        task = create_task(user=user, log=log, title="Tarefa")

    with tenant_context(other_user):
        assert not Task.objects.filter(id=task.id).exists()


@pytest.mark.django_db
def test_update_task_escopado_por_tenant(user, other_user):
    with tenant_context(user):
        task = TaskFactory(user=user, title="Original")

    with tenant_context(other_user):
        with pytest.raises(Task.DoesNotExist):
            update_task(user=other_user, task_id=task.id, title="Invadida")


@pytest.mark.django_db
def test_reorder_task_position_after_calcula_ponto_medio_com_vizinho_seguinte(user):
    with tenant_context(user):
        log = LogFactory(user=user)
        target = TaskFactory(user=user, log=log, order_index=0.0)
        neighbor = TaskFactory(user=user, log=log, order_index=1.0)
        moved = TaskFactory(user=user, log=log, order_index=2.0)

        result = reorder_task(
            user=user, task_id=moved.id, target_task_id=target.id, position="after"
        )

        assert result.order_index == (target.order_index + neighbor.order_index) / 2


@pytest.mark.django_db
def test_reorder_task_position_before_calcula_ponto_medio_com_vizinho_anterior(user):
    with tenant_context(user):
        log = LogFactory(user=user)
        first = TaskFactory(user=user, log=log, order_index=0.0)
        target = TaskFactory(user=user, log=log, order_index=1.0)
        moved = TaskFactory(user=user, log=log, order_index=2.0)

        result = reorder_task(
            user=user, task_id=moved.id, target_task_id=target.id, position="before"
        )

        assert result.order_index == (first.order_index + target.order_index) / 2


@pytest.mark.django_db
def test_reorder_task_para_o_inicio_da_lista_fica_menor_que_todos(user):
    with tenant_context(user):
        log = LogFactory(user=user)
        first = TaskFactory(user=user, log=log, order_index=0.0)
        TaskFactory(user=user, log=log, order_index=1.0)
        moved = TaskFactory(user=user, log=log, order_index=2.0)

        result = reorder_task(
            user=user, task_id=moved.id, target_task_id=first.id, position="before"
        )

        assert result.order_index < first.order_index


@pytest.mark.django_db
def test_reorder_task_para_o_fim_da_lista_fica_maior_que_todos(user):
    with tenant_context(user):
        log = LogFactory(user=user)
        moved = TaskFactory(user=user, log=log, order_index=0.0)
        TaskFactory(user=user, log=log, order_index=1.0)
        last = TaskFactory(user=user, log=log, order_index=2.0)

        result = reorder_task(
            user=user, task_id=moved.id, target_task_id=last.id, position="after"
        )

        assert result.order_index > last.order_index


@pytest.mark.django_db
def test_reorder_task_target_igual_ao_proprio_task_levanta_invalid_reorder_target(user):
    with tenant_context(user):
        task = TaskFactory(user=user)

        with pytest.raises(InvalidReorderTarget):
            reorder_task(user=user, task_id=task.id, target_task_id=task.id, position="after")


@pytest.mark.django_db
def test_reorder_task_target_de_outro_log_levanta_invalid_reorder_target(user):
    with tenant_context(user):
        task = TaskFactory(user=user)
        other_log_task = TaskFactory(user=user)  # LogFactory novo por padrão => log diferente

        with pytest.raises(InvalidReorderTarget):
            reorder_task(
                user=user,
                task_id=task.id,
                target_task_id=other_log_task.id,
                position="after",
            )


@pytest.mark.django_db
def test_reorder_task_target_de_outro_pai_levanta_invalid_reorder_target(user):
    with tenant_context(user):
        log = LogFactory(user=user)
        parent = TaskFactory(user=user, log=log)
        other_parent = TaskFactory(user=user, log=log)
        child = TaskFactory(user=user, log=log, parent_task=parent)
        other_child = TaskFactory(user=user, log=log, parent_task=other_parent)

        with pytest.raises(InvalidReorderTarget):
            reorder_task(
                user=user,
                task_id=child.id,
                target_task_id=other_child.id,
                position="after",
            )


@pytest.mark.django_db
def test_reorder_task_de_subtarefa_so_considera_subtarefas_irmas_sob_o_mesmo_pai(user):
    with tenant_context(user):
        log = LogFactory(user=user)
        parent = TaskFactory(user=user, log=log)
        child_1 = TaskFactory(user=user, log=log, parent_task=parent, order_index=0.0)
        child_2 = TaskFactory(user=user, log=log, parent_task=parent, order_index=1.0)

        result = reorder_task(
            user=user, task_id=child_2.id, target_task_id=child_1.id, position="before"
        )

        assert result.order_index < child_1.order_index
        assert result.parent_task_id == parent.id


@pytest.mark.django_db
def test_reorder_task_escopado_por_tenant(user, other_user):
    with tenant_context(user):
        log = LogFactory(user=user)
        task = TaskFactory(user=user, log=log, order_index=0.0)
        target = TaskFactory(user=user, log=log, order_index=1.0)

    with tenant_context(other_user):
        with pytest.raises(Task.DoesNotExist):
            reorder_task(
                user=other_user, task_id=task.id, target_task_id=target.id, position="after"
            )
