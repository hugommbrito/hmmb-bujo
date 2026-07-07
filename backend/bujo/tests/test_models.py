"""Testes de schema de `Log`/`Task` (AC #1): constraints e relações self-FK."""

import pytest
from django.db import IntegrityError, transaction

from bujo.models import Task
from bujo.tests.factories import LogFactory, TaskFactory
from core.tenant import tenant_context


@pytest.mark.django_db
def test_log_unique_constraint_por_user_e_data(user):
    with tenant_context(user):
        LogFactory(user=user, log_date="2026-01-01")
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                LogFactory(user=user, log_date="2026-01-01")


@pytest.mark.django_db
def test_task_check_constraint_status_invalido(user):
    with tenant_context(user):
        log = LogFactory(user=user)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Task.objects.create(
                    log=log,
                    status="bogus",
                    title="Tarefa inválida",
                    order_index=0.0,
                )


@pytest.mark.django_db
def test_task_relacao_parent_subtasks(user):
    with tenant_context(user):
        parent = TaskFactory(user=user)
        child = TaskFactory(user=user, parent_task=parent)

        assert child.parent_task_id == parent.id
        assert list(parent.subtasks.all()) == [child]


@pytest.mark.django_db
def test_task_relacao_migrated_to_task(user):
    with tenant_context(user):
        original = TaskFactory(user=user)
        successor = TaskFactory(user=user, migrated_to_task=original)

        assert successor.migrated_to_task_id == original.id
        assert list(original.migrated_from.all()) == [successor]


@pytest.mark.django_db
def test_task_campos_de_linhagem_tem_defaults_inertes(user):
    """Campos congelados (Épico 4) nascem nulos/zerados numa `Task` comum —
    nenhum valor "mágico" é atribuído por padrão fora do fluxo de migração."""
    with tenant_context(user):
        task = TaskFactory(user=user)

        assert task.migrated_to_task_id is None
        assert task.migration_count == 0
        assert task.parent_task_id is None
        assert task.source_template_id is None
        assert list(task.subtasks.all()) == []
        assert list(task.migrated_from.all()) == []


@pytest.mark.django_db
@pytest.mark.parametrize("category", list(Task.Category.values))
def test_task_category_aceita_as_6_choices_validas(user, category):
    with tenant_context(user):
        task = TaskFactory(user=user, category=category)

        assert task.category == category


@pytest.mark.django_db
def test_task_category_aceita_null(user):
    with tenant_context(user):
        task = TaskFactory(user=user, category=None)

        assert task.category is None
