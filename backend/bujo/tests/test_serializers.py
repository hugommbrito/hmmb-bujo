"""Testes de `LogSerializer`/`TaskSerializer` (AC #1, #2)."""

import pytest

from bujo.models import Task
from bujo.serializers import LogSerializer, TaskSerializer
from bujo.tests.factories import LogFactory, TaskFactory
from core.tenant import tenant_context


@pytest.mark.django_db
def test_log_serializer_aninha_tarefas_na_ordem_de_order_index(user):
    with tenant_context(user):
        log = LogFactory(user=user)
        TaskFactory(user=user, log=log, title="Terceira", order_index=3.0)
        TaskFactory(user=user, log=log, title="Primeira", order_index=1.0)
        TaskFactory(user=user, log=log, title="Segunda", order_index=2.0)

        data = LogSerializer(log).data

        assert [task["title"] for task in data["tasks"]] == [
            "Primeira",
            "Segunda",
            "Terceira",
        ]


def test_task_serializer_expoe_exatamente_os_campos_esperados():
    assert set(TaskSerializer.Meta.fields) == {
        "id",
        "title",
        "status",
        "eisenhower",
        "category",
    }


@pytest.mark.django_db
def test_task_serializer_categoria_nula_serializa_como_null(user):
    with tenant_context(user):
        task = TaskFactory(user=user, category=None)

        data = TaskSerializer(task).data

        assert "category" in data
        assert data["category"] is None


@pytest.mark.django_db
def test_task_serializer_categoria_definida_serializa_valor(user):
    with tenant_context(user):
        task = TaskFactory(user=user, category=Task.Category.TEAL)

        data = TaskSerializer(task).data

        assert data["category"] == Task.Category.TEAL
