"""Testes dos serviços de `bujo` (AC #1, #2, #3)."""

import itertools

import pytest

from bujo.models import Log, Task
from bujo.services.logs import get_or_create_daily_log
from bujo.services.state_machine import ALLOWED, transition_task
from bujo.services.tasks import create_task, update_task
from bujo.tests.factories import LogFactory, TaskFactory
from core.exceptions import InvalidTransition
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
