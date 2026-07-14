"""Testes dos serviços de `bujo` (AC #1, #2, #3)."""

import itertools
from datetime import date, timedelta

import pytest

from bujo.models import Log, MonthlyLog, Task, WeeklyLog
from bujo.services.logs import (
    get_or_create_daily_log,
    get_or_create_monthly_log,
    get_or_create_weekly_log,
)
from bujo.services.migration import migrate_task
from bujo.services.state_machine import ALLOWED, transition_task
from bujo.services.tasks import create_task, reorder_task, update_task
from bujo.tests.factories import LogFactory, MonthlyLogFactory, TaskFactory, WeeklyLogFactory
from core.calendar import today_for, week_start_of
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


@pytest.mark.django_db
def test_get_or_create_weekly_log_idempotente(user):
    with tenant_context(user):
        first = get_or_create_weekly_log(user=user, week_start="2026-07-13")
        second = get_or_create_weekly_log(user=user, week_start="2026-07-13")

        assert first.id == second.id
        assert WeeklyLog.objects.filter(week_start="2026-07-13").count() == 1


@pytest.mark.django_db
def test_get_or_create_weekly_log_escopado_por_tenant(user, other_user):
    with tenant_context(user):
        log_user = get_or_create_weekly_log(user=user, week_start="2026-07-13")

    with tenant_context(other_user):
        log_other_user = get_or_create_weekly_log(user=other_user, week_start="2026-07-13")

    assert log_user.id != log_other_user.id


@pytest.mark.django_db
def test_get_or_create_monthly_log_idempotente(user):
    with tenant_context(user):
        first = get_or_create_monthly_log(user=user, month_first="2026-07-01")
        second = get_or_create_monthly_log(user=user, month_first="2026-07-01")

        assert first.id == second.id
        assert MonthlyLog.objects.filter(month_first="2026-07-01").count() == 1


@pytest.mark.django_db
def test_get_or_create_monthly_log_escopado_por_tenant(user, other_user):
    with tenant_context(user):
        log_user = get_or_create_monthly_log(user=user, month_first="2026-07-01")

    with tenant_context(other_user):
        log_other_user = get_or_create_monthly_log(user=other_user, month_first="2026-07-01")

    assert log_user.id != log_other_user.id


@pytest.mark.django_db
def test_create_task_com_monthly_log_e_scheduled_date_grava_e_calcula_order_index(user):
    with tenant_context(user):
        monthly_log = MonthlyLogFactory(user=user)
        other_monthly_log = MonthlyLogFactory(user=user)

        first = create_task(
            user=user, monthly_log=monthly_log, scheduled_date="2026-07-20", title="Primeira"
        )
        second = create_task(user=user, monthly_log=monthly_log, title="Segunda")
        other = create_task(user=user, monthly_log=other_monthly_log, title="Outro mês")

        assert first.monthly_log_id == monthly_log.id
        assert str(first.scheduled_date) == "2026-07-20"
        assert first.log_id is None
        assert first.weekly_log_id is None
        assert [first.order_index, second.order_index] == [0.0, 1.0]
        assert other.order_index == 0.0


@pytest.mark.django_db
def test_create_task_subtarefa_herda_container_do_pai(user):
    with tenant_context(user):
        weekly_log = WeeklyLogFactory(user=user)
        parent = create_task(user=user, weekly_log=weekly_log, title="Pai semanal")

        child = create_task(
            user=user, weekly_log=parent.weekly_log, parent_task=parent, title="Filha"
        )

        assert child.weekly_log_id == weekly_log.id
        assert child.log_id is None
        assert child.monthly_log_id is None


@pytest.mark.django_db
def test_reorder_task_de_duas_tarefas_daily_continua_correto_com_filtro_ampliado(user):
    with tenant_context(user):
        log = LogFactory(user=user)
        target = TaskFactory(user=user, log=log, order_index=0.0)
        neighbor = TaskFactory(user=user, log=log, order_index=1.0)
        moved = TaskFactory(user=user, log=log, order_index=2.0)

        result = reorder_task(
            user=user, task_id=moved.id, target_task_id=target.id, position="after"
        )

        assert result.order_index == (target.order_index + neighbor.order_index) / 2


# --- migrate_task (AC #3, AD-08 item 11) --------------------------------------


@pytest.mark.django_db
def test_migrar_pai_recria_apenas_filhos_nao_dispostos(user):
    """Cenário-âncora AD-08 item 11 (guardrail retro Epic 3 §5): migrar um pai
    com um filho concluído e um filho pendente recria no destino só o pai e o
    filho pendente; o filho concluído fica intocado na origem, junto com a
    árvore original inteira. `migrate_task` retorna a ORIGEM recarregada
    (status atualizado + `migrated_to_task` apontando pro novo registro) — não
    o novo registro em si (ver Dev Notes/comentário do dispatcher)."""
    with tenant_context(user):
        log = LogFactory(user=user)
        parent = TaskFactory(user=user, log=log, status=Task.Status.PENDING, title="Pai")
        completed_child = TaskFactory(
            user=user,
            log=log,
            parent_task=parent,
            status=Task.Status.COMPLETED,
            title="Filho concluído",
        )
        pending_child = TaskFactory(
            user=user,
            log=log,
            parent_task=parent,
            status=Task.Status.PENDING,
            title="Filho pendente",
        )

        result = migrate_task(user=user, task_id=parent.id, destination="today")

        # Origem: árvore original inteira permanece, pai e filho pendente migrated,
        # filho concluído intocado. `result` é a própria origem recarregada.
        completed_child.refresh_from_db()
        pending_child.refresh_from_db()
        assert result.id == parent.id
        assert result.status == Task.Status.MIGRATED
        assert completed_child.status == Task.Status.COMPLETED
        assert completed_child.parent_task_id == parent.id
        assert completed_child.migrated_to_task_id is None
        assert pending_child.status == Task.Status.MIGRATED
        assert pending_child.parent_task_id == parent.id

        # Destino: pai recriado + só o filho pendente (recriado, pending, migration_count=1).
        new_parent = result.migrated_to_task
        assert new_parent is not None
        assert new_parent.status == Task.Status.PENDING
        assert new_parent.migration_count == 1
        assert new_parent.title == "Pai"
        destino_filhos = list(new_parent.subtasks.all())
        assert len(destino_filhos) == 1
        assert destino_filhos[0].title == "Filho pendente"
        assert destino_filhos[0].status == Task.Status.PENDING
        assert destino_filhos[0].migration_count == 1
        assert destino_filhos[0].parent_task_id == new_parent.id
        assert destino_filhos[0].id == pending_child.migrated_to_task_id


@pytest.mark.django_db
def test_migrate_task_destination_today_torna_origem_migrated_e_cria_no_daily_de_hoje(user):
    with tenant_context(user):
        yesterday_log = LogFactory(user=user)
        task = TaskFactory(user=user, log=yesterday_log, status=Task.Status.PENDING)

        result = migrate_task(user=user, task_id=task.id, destination="today")

        today_log = get_or_create_daily_log(user=user, log_date=today_for(user))
        assert result.status == Task.Status.MIGRATED
        new_task = result.migrated_to_task
        assert new_task is not None
        assert new_task.status == Task.Status.PENDING
        assert new_task.migration_count == 1
        assert new_task.log_id == today_log.id
        assert new_task.parent_task is None


@pytest.mark.django_db
def test_migrar_pai_com_filho_pendente_e_filho_completo_para_destino_week(user):
    """Cenário-âncora AD-08 item 11 (guardrail retro Epic 3 §5), variante do
    destino "week" desta story: pai com um filho `pending` e um filho
    `completed` migrado para a Weekly Log corrente recria no destino só o pai
    e o filho pendente; o filho concluído fica intocado na origem."""
    with tenant_context(user):
        log = LogFactory(user=user)
        parent = TaskFactory(user=user, log=log, status=Task.Status.PENDING, title="Pai")
        completed_child = TaskFactory(
            user=user,
            log=log,
            parent_task=parent,
            status=Task.Status.COMPLETED,
            title="Filho concluído",
        )
        pending_child = TaskFactory(
            user=user,
            log=log,
            parent_task=parent,
            status=Task.Status.PENDING,
            title="Filho pendente",
        )

        result = migrate_task(user=user, task_id=parent.id, destination="week")

        completed_child.refresh_from_db()
        pending_child.refresh_from_db()
        assert result.status == Task.Status.MIGRATED
        assert completed_child.status == Task.Status.COMPLETED
        assert completed_child.parent_task_id == parent.id
        assert completed_child.migrated_to_task_id is None
        assert pending_child.status == Task.Status.MIGRATED

        current_week_start = week_start_of(today_for(user))
        weekly_log = get_or_create_weekly_log(user=user, week_start=current_week_start)
        new_parent = result.migrated_to_task
        assert new_parent is not None
        assert new_parent.weekly_log_id == weekly_log.id
        assert new_parent.status == Task.Status.PENDING
        assert new_parent.migration_count == 1
        destino_filhos = list(new_parent.subtasks.all())
        assert len(destino_filhos) == 1
        assert destino_filhos[0].title == "Filho pendente"
        assert destino_filhos[0].status == Task.Status.PENDING
        assert destino_filhos[0].weekly_log_id == weekly_log.id
        assert destino_filhos[0].id == pending_child.migrated_to_task_id


@pytest.mark.django_db
def test_migrate_task_destination_week_torna_origem_migrated_e_cria_no_weekly_corrente(user):
    with tenant_context(user):
        log = LogFactory(user=user)
        task = TaskFactory(user=user, log=log, status=Task.Status.PENDING)

        result = migrate_task(user=user, task_id=task.id, destination="week")

        current_week_start = week_start_of(today_for(user))
        weekly_log = get_or_create_weekly_log(user=user, week_start=current_week_start)
        assert result.status == Task.Status.MIGRATED
        new_task = result.migrated_to_task
        assert new_task is not None
        assert new_task.status == Task.Status.PENDING
        assert new_task.migration_count == 1
        assert new_task.weekly_log_id == weekly_log.id
        assert new_task.parent_task is None


@pytest.mark.django_db
def test_migrate_task_destination_month_torna_origem_postponed_e_cria_no_monthly_corrente(user):
    with tenant_context(user):
        log = LogFactory(user=user)
        task = TaskFactory(user=user, log=log, status=Task.Status.PENDING)
        current_month_first = today_for(user).replace(day=1)
        scheduled_date = current_month_first.replace(day=2)

        result = migrate_task(
            user=user,
            task_id=task.id,
            destination="month",
            month_first=current_month_first,
            scheduled_date=scheduled_date,
        )

        monthly_log = get_or_create_monthly_log(user=user, month_first=current_month_first)
        assert result.status == Task.Status.POSTPONED
        new_task = result.migrated_to_task
        assert new_task.status == Task.Status.PENDING
        assert new_task.monthly_log_id == monthly_log.id
        assert new_task.scheduled_date == scheduled_date


@pytest.mark.django_db
def test_migrate_task_destination_future_com_e_sem_scheduled_date(user):
    with tenant_context(user):
        log = LogFactory(user=user)
        task_a = TaskFactory(user=user, log=log, status=Task.Status.PENDING)
        task_b = TaskFactory(user=user, log=log, status=Task.Status.PENDING)
        current_month_first = today_for(user).replace(day=1)
        future_month = date(current_month_first.year + 1, current_month_first.month, 1)

        result_a = migrate_task(
            user=user,
            task_id=task_a.id,
            destination="future",
            month_first=future_month,
            scheduled_date=future_month.replace(day=10),
        )
        result_b = migrate_task(
            user=user, task_id=task_b.id, destination="future", month_first=future_month
        )

        assert result_a.status == Task.Status.POSTPONED
        new_task_a = result_a.migrated_to_task
        new_task_b = result_b.migrated_to_task
        assert new_task_a.scheduled_date == future_month.replace(day=10)
        assert new_task_b.scheduled_date is None
        assert new_task_a.monthly_log_id == new_task_b.monthly_log_id


@pytest.mark.django_db
def test_migrate_task_destination_cancel_nao_cria_lineage(user):
    with tenant_context(user):
        log = LogFactory(user=user)
        task = TaskFactory(user=user, log=log, status=Task.Status.PENDING)
        count_before = Task.objects.count()

        result = migrate_task(user=user, task_id=task.id, destination="cancel")

        assert result.status == Task.Status.CANCELLED
        assert result.migrated_to_task_id is None
        assert Task.objects.count() == count_before


@pytest.mark.django_db
@pytest.mark.parametrize("status", [Task.Status.COMPLETED, Task.Status.MIGRATED])
def test_migrate_task_status_nao_migravel_levanta_invalid_transition(user, status):
    with tenant_context(user):
        log = LogFactory(user=user)
        task = TaskFactory(user=user, log=log, status=status)

        with pytest.raises(InvalidTransition):
            migrate_task(user=user, task_id=task.id, destination="today")


@pytest.mark.django_db
def test_migrate_task_encadeada_soma_migration_count_sem_resetar(user):
    with tenant_context(user):
        log = LogFactory(user=user)
        task = TaskFactory(user=user, log=log, status=Task.Status.PENDING)

        first_result = migrate_task(user=user, task_id=task.id, destination="today")
        new_task_1 = first_result.migrated_to_task
        assert new_task_1.migration_count == 1

        second_result = migrate_task(user=user, task_id=new_task_1.id, destination="today")
        new_task_2 = second_result.migrated_to_task
        assert new_task_2.migration_count == 2


@pytest.mark.django_db
def test_migrate_task_catch_up_conta_por_decisao_nao_por_dia_pulado(user):
    """AC #1: `migration_count` incrementa em 1 por decisão, não por dia de
    calendário pulado — mesmo migrando uma tarefa de um `Log` 10 dias no
    passado, uma única chamada a `migrate_task` produz `migration_count == 1`."""
    with tenant_context(user):
        old_date = today_for(user) - timedelta(days=10)
        log = LogFactory(user=user, log_date=old_date)
        task = TaskFactory(user=user, log=log, status=Task.Status.PENDING, migration_count=0)

        result = migrate_task(user=user, task_id=task.id, destination="today")
        new_task = result.migrated_to_task

        assert new_task.migration_count == 1


@pytest.mark.django_db
def test_migrate_task_subarvore_dois_niveis_preserva_hierarquia(user):
    with tenant_context(user):
        log = LogFactory(user=user)
        grandparent = TaskFactory(user=user, log=log, status=Task.Status.PENDING, title="Avô")
        parent = TaskFactory(
            user=user, log=log, parent_task=grandparent, status=Task.Status.PENDING, title="Pai"
        )
        TaskFactory(
            user=user, log=log, parent_task=parent, status=Task.Status.PENDING, title="Filho"
        )

        result = migrate_task(user=user, task_id=grandparent.id, destination="today")

        new_grandparent = result.migrated_to_task
        new_parent = new_grandparent.subtasks.get()
        new_child = new_parent.subtasks.get()
        assert new_parent.title == "Pai"
        assert new_child.title == "Filho"
        assert new_parent.parent_task_id == new_grandparent.id
        assert new_child.parent_task_id == new_parent.id


@pytest.mark.django_db
def test_migrate_task_escopado_por_tenant(user, other_user):
    with tenant_context(user):
        log = LogFactory(user=user)
        task = TaskFactory(user=user, log=log, status=Task.Status.PENDING)

    with tenant_context(other_user):
        with pytest.raises(Task.DoesNotExist):
            migrate_task(user=other_user, task_id=task.id, destination="today")
