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
        "description",
        "status",
        "eisenhower",
        "category",
        "subtasks",
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


@pytest.mark.django_db
def test_task_serializer_descricao_nula_serializa_como_null(user):
    with tenant_context(user):
        task = TaskFactory(user=user, description=None)

        data = TaskSerializer(task).data

        assert "description" in data
        assert data["description"] is None


@pytest.mark.django_db
def test_task_serializer_subtasks_vazio_serializa_como_lista_vazia(user):
    with tenant_context(user):
        task = TaskFactory(user=user)

        data = TaskSerializer(task).data

        assert data["subtasks"] == []


@pytest.mark.django_db
def test_task_serializer_subtasks_aninha_na_ordem_de_order_index(user):
    with tenant_context(user):
        log = LogFactory(user=user)
        parent = TaskFactory(user=user, log=log, title="Pai")
        TaskFactory(user=user, log=log, parent_task=parent, title="Segunda filha", order_index=2.0)
        TaskFactory(user=user, log=log, parent_task=parent, title="Primeira filha", order_index=1.0)

        data = TaskSerializer(parent).data

        assert [child["title"] for child in data["subtasks"]] == [
            "Primeira filha",
            "Segunda filha",
        ]


@pytest.mark.django_db
def test_log_serializer_tasks_nao_inclui_subtarefas_na_raiz(user):
    """Gap fechado nesta story: subtarefas compartilham `log_id` do pai
    (AD-08 item 12) — sem o filtro `parent_task__isnull=True`, apareceriam
    duplicadas: uma vez aninhadas, outra vez soltas na raiz."""
    with tenant_context(user):
        log = LogFactory(user=user)
        parent = TaskFactory(user=user, log=log, title="Pai")
        TaskFactory(user=user, log=log, parent_task=parent, title="Filha")

        data = LogSerializer(log).data

        assert [task["title"] for task in data["tasks"]] == ["Pai"]
        assert data["tasks"][0]["subtasks"][0]["title"] == "Filha"
