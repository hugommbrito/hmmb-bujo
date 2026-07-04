"""Testes dos serviços de `bujo` (AC #1, #2, #3)."""

import itertools

import pytest

from bujo.models import Log, Task
from bujo.services.logs import get_or_create_daily_log
from bujo.services.state_machine import ALLOWED, transition_task
from bujo.tests.factories import TaskFactory
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
