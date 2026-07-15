"""Testes de `LogSerializer`/`TaskSerializer` (AC #1, #2)."""

from datetime import date

import pytest

from bujo.models import RecurringTaskTemplate, Task
from bujo.serializers import (
    LogSerializer,
    RecurringTaskTemplateCreateSerializer,
    RecurringTaskTemplateUpdateSerializer,
    TaskSerializer,
)
from bujo.services.migration import migrate_task
from bujo.services.recurring import place_template
from bujo.tests.factories import (
    LogFactory,
    MonthlyLogFactory,
    RecurringTaskTemplateFactory,
    TaskFactory,
)
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
        "scheduled_date",
        "subtasks",
        "migration_count",
        "migrated_to_task",
        "source_template",
    }


@pytest.mark.django_db
def test_task_serializer_source_template_e_null_para_tarefa_comum(user):
    with tenant_context(user):
        task = TaskFactory(user=user)

        data = TaskSerializer(task).data

        assert "source_template" in data
        assert data["source_template"] is None


@pytest.mark.django_db
def test_task_serializer_source_template_e_o_id_do_template_apos_placement(user):
    """AC1: uma tarefa colocada via `place_template` serializa `source_template`
    com o id do template — é o que habilita o dedup client-side."""
    with tenant_context(user):
        MonthlyLogFactory(user=user, month_first=date(2026, 7, 1))
        template = RecurringTaskTemplateFactory(
            user=user, recurrence_group=RecurringTaskTemplate.RecurrenceGroup.MONTHLY
        )

        task = place_template(
            user=user, template_id=template.id, month_first=date(2026, 7, 1)
        )
        data = TaskSerializer(task).data

        assert data["source_template"] == template.id


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
def test_task_serializer_migrated_to_task_e_null_quando_nunca_migrou(user):
    with tenant_context(user):
        task = TaskFactory(user=user)

        data = TaskSerializer(task).data

        assert data["migration_count"] == 0
        assert data["migrated_to_task"] is None


@pytest.mark.django_db
def test_task_serializer_migrated_to_task_e_o_id_da_tarefa_de_destino_apos_migrar(user):
    with tenant_context(user):
        task = TaskFactory(user=user, status=Task.Status.PENDING)

        # `migrate_task` retorna a ORIGEM recarregada (Task.Status.MIGRATED,
        # `migrated_to_task` populado) — não a tarefa de destino nova.
        migrated_source = migrate_task(user=user, task_id=task.id, destination="today")
        data = TaskSerializer(migrated_source).data

        assert data["migrated_to_task"] == migrated_source.migrated_to_task_id
        new_task = migrated_source.migrated_to_task
        assert TaskSerializer(new_task).data["migration_count"] == 1


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


# --- RecurringTaskTemplate serializers (AC #1) ---------------------------------


@pytest.mark.parametrize("recurrence_group", list(RecurringTaskTemplate.RecurrenceGroup.values))
def test_create_serializer_aceita_todos_os_recurrence_group_validos(recurrence_group):
    serializer = RecurringTaskTemplateCreateSerializer(
        data={
            "title": "Template",
            "recurrence_group": recurrence_group,
            "recurrence_text": "toda segunda",
        }
    )

    assert serializer.is_valid(), serializer.errors


def test_create_serializer_recurrence_group_fora_do_enum_e_invalido():
    serializer = RecurringTaskTemplateCreateSerializer(
        data={"title": "Template", "recurrence_group": "bogus", "recurrence_text": "texto"}
    )

    assert not serializer.is_valid()
    assert "recurrence_group" in serializer.errors


def test_create_serializer_description_e_eisenhower_aceitam_null():
    serializer = RecurringTaskTemplateCreateSerializer(
        data={
            "title": "Template",
            "description": None,
            "eisenhower": None,
            "recurrence_group": "weekly",
            "recurrence_text": "toda segunda",
        }
    )

    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data["description"] is None
    assert serializer.validated_data["eisenhower"] is None


def test_update_serializer_todos_os_campos_sao_opcionais():
    serializer = RecurringTaskTemplateUpdateSerializer(data={}, partial=True)

    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data == {}
