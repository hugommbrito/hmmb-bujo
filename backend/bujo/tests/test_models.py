"""Testes de schema de `Log`/`Task` (AC #1): constraints e relações self-FK."""

from datetime import date

import pytest
from django.db import IntegrityError, transaction

from bujo.models import MonthlyLog, Task, WeeklyLog
from bujo.tests.factories import (
    LogFactory,
    MonthlyLogFactory,
    RecurringTaskTemplateFactory,
    TaskFactory,
    WeeklyLogFactory,
)
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


@pytest.mark.django_db
def test_weekly_log_check_constraint_week_start_deve_ser_segunda(user):
    with tenant_context(user):
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                WeeklyLog.objects.create(week_start=date(2026, 7, 14))  # terça


@pytest.mark.django_db
def test_weekly_log_week_start_segunda_grava(user):
    with tenant_context(user):
        log = WeeklyLog.objects.create(week_start=date(2026, 7, 13))  # segunda

        assert log.week_start == date(2026, 7, 13)


@pytest.mark.django_db
def test_weekly_log_unique_constraint_por_user_e_week_start(user):
    with tenant_context(user):
        WeeklyLogFactory(user=user, week_start=date(2026, 7, 13))
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                WeeklyLogFactory(user=user, week_start=date(2026, 7, 13))


@pytest.mark.django_db
def test_monthly_log_check_constraint_month_first_deve_ser_dia_1(user):
    with tenant_context(user):
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                MonthlyLog.objects.create(month_first=date(2026, 7, 2))


@pytest.mark.django_db
def test_monthly_log_month_first_dia_1_grava(user):
    with tenant_context(user):
        log = MonthlyLog.objects.create(month_first=date(2026, 7, 1))

        assert log.month_first == date(2026, 7, 1)


@pytest.mark.django_db
def test_monthly_log_unique_constraint_por_user_e_month_first(user):
    with tenant_context(user):
        MonthlyLogFactory(user=user, month_first=date(2026, 7, 1))
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                MonthlyLogFactory(user=user, month_first=date(2026, 7, 1))


@pytest.mark.django_db
def test_task_check_constraint_exatamente_um_container_nenhum(user):
    with tenant_context(user):
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Task.objects.create(title="Sem container", order_index=0.0)


@pytest.mark.django_db
def test_task_check_constraint_exatamente_um_container_dois(user):
    with tenant_context(user):
        log = LogFactory(user=user)
        monthly_log = MonthlyLogFactory(user=user)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Task.objects.create(
                    log=log,
                    monthly_log=monthly_log,
                    title="Dois containers",
                    order_index=0.0,
                )


@pytest.mark.django_db
def test_task_com_exatamente_um_container_grava(user):
    with tenant_context(user):
        weekly_log = WeeklyLogFactory(user=user)
        task = Task.objects.create(
            weekly_log=weekly_log, title="Só weekly", order_index=0.0
        )

        assert task.log_id is None
        assert task.weekly_log_id == weekly_log.id
        assert task.monthly_log_id is None


@pytest.mark.django_db
def test_task_scheduled_date_nulavel_grava_com_e_sem_valor(user):
    with tenant_context(user):
        monthly_log = MonthlyLogFactory(user=user)
        with_date = TaskFactory(
            user=user, monthly_log=monthly_log, scheduled_date=date(2026, 7, 20)
        )
        without_date = TaskFactory(user=user, monthly_log=monthly_log, scheduled_date=None)

        assert with_date.scheduled_date == date(2026, 7, 20)
        assert without_date.scheduled_date is None


# --- RecurringTaskTemplate (AC #1) ---------------------------------------------


@pytest.mark.django_db
def test_recurring_task_template_nao_tem_campos_de_ciclo_de_vida(user):
    """AD-08 item 1: um template não é uma `Task` e nunca migra — sem
    `status`/`log`/`weekly_log`/`monthly_log`/`parent_task`."""
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(user=user)

        for field in ("status", "log", "weekly_log", "monthly_log", "parent_task"):
            assert not hasattr(template, field)


@pytest.mark.django_db
def test_task_source_template_aceita_none_e_instancia(user):
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(user=user)
        task_sem_template = TaskFactory(user=user)
        task_com_template = TaskFactory(user=user, source_template=template)

        assert task_sem_template.source_template is None
        assert task_com_template.source_template_id == template.id


@pytest.mark.django_db
def test_deletar_template_nao_deleta_a_task_instancia_set_null(user):
    """AD-08 item 2: `source_template` não é referência viva — `on_delete=SET_NULL`
    garante que deletar o template nunca quebra a instância já colocada."""
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(user=user)
        task = TaskFactory(user=user, source_template=template)

        template.delete()
        task.refresh_from_db()

        assert Task.objects.filter(id=task.id).exists()
        assert task.source_template_id is None
