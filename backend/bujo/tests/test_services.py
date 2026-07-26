"""Testes dos serviços de `bujo` (AC #1, #2, #3)."""

import itertools
from datetime import date, timedelta

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from bujo.models import (
    CycleStatus,
    Log,
    MonthlyLog,
    RecurringTaskTemplate,
    RitualDecision,
    RitualDecisionKind,
    Task,
    WeeklyLog,
)
from bujo.serializers import MONTHLY_CYCLE_ACTIONS as MONTHLY_CYCLE_ACTION_CHOICES
from bujo.services.archive import is_container_closed, is_cycle_closed, list_closed_cycles
from bujo.services.cycles import ALLOWED as CYCLE_ALLOWED
from bujo.services.cycles import (
    add_months,
    cancel_weekly_planning_target,
    complete_monthly_planning,
    complete_weekly_planning,
    finalize_monthly,
    finalize_weekly,
    monthly_cycle_readiness,
    next_monthly_target,
    open_monthly_planning_target,
    open_weekly_planning_target,
    start_monthly,
    start_weekly,
    weekly_cycle_readiness,
)
from bujo.services.density import compute_month_density, compute_week_density
from bujo.services.logs import (
    get_or_create_daily_log,
    get_or_create_monthly_log,
    get_or_create_weekly_log,
)
from bujo.services.migration import (
    inherited_successor_status,
    migrate_task,
    unified_migration_queue,
)
from bujo.services.recurring import (
    create_template,
    live_templates,
    place_template,
    soft_delete_template,
    update_template,
)
from bujo.services.rituals import (
    ALLOWED_DECISIONS,
    decisions_for_target,
    list_future_log_items,
    list_monthly_recurring_candidates,
    list_monthly_tasks_in_week,
    list_pending_daily_groups,
    list_previous_monthly_pendings,
    list_previous_weekly_pendings,
    list_weekly_recurring_candidates,
    upsert_ritual_decision,
)
from bujo.services.state_machine import ALLOWED, transition_task
from bujo.services.tasks import create_task, delete_task, reorder_task, update_task
from bujo.tests.factories import (
    LogFactory,
    MonthlyLogFactory,
    RecurringTaskTemplateFactory,
    TaskFactory,
    WeeklyLogFactory,
)
from core.calendar import now as cal_now
from core.calendar import today_for, week_start_of
from core.exceptions import (
    ClosedCycleReadOnly,
    CycleTargetConflict,
    InvalidReorderTarget,
    InvalidRitualDecision,
    InvalidTransition,
    WrongPlacementContainer,
)
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
def test_delete_task_pending_sem_linhagem_faz_hard_delete(user):
    with tenant_context(user):
        task = TaskFactory(user=user, status=Task.Status.PENDING)

        result = delete_task(user=user, task_id=task.id)

        assert result is None
        assert not Task.objects.filter(id=task.id).exists()


@pytest.mark.django_db
def test_delete_task_pending_com_linhagem_cancela_em_vez_de_apagar(user):
    with tenant_context(user):
        task = TaskFactory(user=user, status=Task.Status.PENDING, migration_count=1)

        result = delete_task(user=user, task_id=task.id)

        assert result.status == Task.Status.CANCELLED
        assert Task.objects.filter(id=task.id).exists()


@pytest.mark.django_db
@pytest.mark.parametrize("status", [Task.Status.STARTED, Task.Status.COMPLETED])
def test_delete_task_nao_pending_sem_linhagem_ainda_assim_cancela(user, status):
    """Regra literal da AC3: "pending" é condição necessária pro hard delete,
    mesmo sem nenhuma linhagem."""
    with tenant_context(user):
        task = TaskFactory(user=user, status=status)

        result = delete_task(user=user, task_id=task.id)

        assert result.status == Task.Status.CANCELLED
        assert Task.objects.filter(id=task.id).exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "status", [Task.Status.CANCELLED, Task.Status.MIGRATED, Task.Status.POSTPONED]
)
def test_delete_task_estado_terminal_levanta_invalid_transition(user, status):
    with tenant_context(user):
        task = TaskFactory(user=user, status=status)

        with pytest.raises(InvalidTransition):
            delete_task(user=user, task_id=task.id)


@pytest.mark.django_db
def test_delete_task_weekly_log_fechado_levanta_closed_cycle_read_only(user):
    with tenant_context(user):
        weekly_log = WeeklyLogFactory(user=user)
        task = TaskFactory(user=user, weekly_log=weekly_log, status=Task.Status.COMPLETED)

        with pytest.raises(ClosedCycleReadOnly):
            delete_task(user=user, task_id=task.id)


@pytest.mark.django_db
def test_delete_task_monthly_log_fechado_levanta_closed_cycle_read_only(user):
    with tenant_context(user):
        monthly_log = MonthlyLogFactory(user=user)
        task = TaskFactory(user=user, monthly_log=monthly_log, status=Task.Status.COMPLETED)

        with pytest.raises(ClosedCycleReadOnly):
            delete_task(user=user, task_id=task.id)


@pytest.mark.django_db
def test_delete_task_escopado_por_tenant(user, other_user):
    with tenant_context(user):
        task = TaskFactory(user=user, status=Task.Status.PENDING)

    with tenant_context(other_user):
        with pytest.raises(Task.DoesNotExist):
            delete_task(user=other_user, task_id=task.id)


@pytest.mark.django_db
def test_create_task_weekly_log_fechado_levanta_closed_cycle_read_only(user):
    with tenant_context(user):
        weekly_log = WeeklyLogFactory(user=user)
        TaskFactory(user=user, weekly_log=weekly_log, status=Task.Status.COMPLETED)

        with pytest.raises(ClosedCycleReadOnly):
            create_task(user=user, weekly_log=weekly_log, title="Nova tarefa")


@pytest.mark.django_db
def test_create_task_monthly_log_fechado_levanta_closed_cycle_read_only(user):
    with tenant_context(user):
        monthly_log = MonthlyLogFactory(user=user)
        TaskFactory(user=user, monthly_log=monthly_log, status=Task.Status.CANCELLED)

        with pytest.raises(ClosedCycleReadOnly):
            create_task(user=user, monthly_log=monthly_log, title="Nova tarefa")


@pytest.mark.django_db
def test_update_task_weekly_log_fechado_levanta_closed_cycle_read_only(user):
    with tenant_context(user):
        weekly_log = WeeklyLogFactory(user=user)
        task = TaskFactory(user=user, weekly_log=weekly_log, status=Task.Status.COMPLETED)

        with pytest.raises(ClosedCycleReadOnly):
            update_task(user=user, task_id=task.id, title="Atualizada")


@pytest.mark.django_db
def test_update_task_monthly_log_fechado_levanta_closed_cycle_read_only(user):
    with tenant_context(user):
        monthly_log = MonthlyLogFactory(user=user)
        task = TaskFactory(user=user, monthly_log=monthly_log, status=Task.Status.MIGRATED)

        with pytest.raises(ClosedCycleReadOnly):
            update_task(user=user, task_id=task.id, title="Atualizada")


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
def test_migrate_task_destination_week_com_scheduled_date_deduz_semana_da_data(user):
    with tenant_context(user):
        log = LogFactory(user=user)
        task = TaskFactory(user=user, log=log, status=Task.Status.PENDING)
        current_week_start = week_start_of(today_for(user))
        scheduled_date = current_week_start + timedelta(weeks=3)

        result = migrate_task(
            user=user, task_id=task.id, destination="week", scheduled_date=scheduled_date
        )

        target_weekly_log = get_or_create_weekly_log(
            user=user, week_start=week_start_of(scheduled_date)
        )
        current_weekly_log = get_or_create_weekly_log(user=user, week_start=current_week_start)
        assert result.status == Task.Status.MIGRATED
        new_task = result.migrated_to_task
        assert new_task is not None
        assert new_task.weekly_log_id == target_weekly_log.id
        assert new_task.weekly_log_id != current_weekly_log.id
        assert new_task.scheduled_date == scheduled_date


@pytest.mark.django_db
def test_migrate_task_destination_week_com_scheduled_date_passada_deduz_semana_anterior(user):
    """"Antecipar/adiar em qualquer direção" (epics.md linha 868) — mover
    para trás também funciona, não só para frente. A semana de destino é
    anterior à corrente, mas ainda não fechada (só uma tarefa `pending`
    nela após a migração)."""
    with tenant_context(user):
        log = LogFactory(user=user)
        task = TaskFactory(user=user, log=log, status=Task.Status.PENDING)
        current_week_start = week_start_of(today_for(user))
        scheduled_date = current_week_start - timedelta(weeks=2)

        result = migrate_task(
            user=user, task_id=task.id, destination="week", scheduled_date=scheduled_date
        )

        target_weekly_log = get_or_create_weekly_log(
            user=user, week_start=week_start_of(scheduled_date)
        )
        assert result.status == Task.Status.MIGRATED
        new_task = result.migrated_to_task
        assert new_task.weekly_log_id == target_weekly_log.id
        assert new_task.scheduled_date == scheduled_date
        assert is_container_closed(target_weekly_log) is False


@pytest.mark.django_db
def test_migrate_task_destination_week_mesma_semana_da_origem_nao_fecha_o_proprio_destino(user):
    """Regressão do bug relatado na Story 11.10 (AC4, "modal de migração não
    funciona em Esta Semana"): quando `task` é a ÚNICA pending/started do seu
    `weekly_log` de origem E o destino calculado (`week_start_of(scheduled_date)`)
    é ESSE MESMO weekly_log (ex.: dar um dia a uma tarefa "sem dia" da semana
    corrente), transicionar a origem ANTES de criar o novo registro fechava o
    container (`is_container_closed`) debaixo dos próprios pés — `create_task`
    rejeitava a própria criação com `ClosedCycleReadOnly` (409). Root cause
    encontrada nesta story via e2e; fix em `_migrate_subtree` (cria antes de
    transicionar)."""
    with tenant_context(user):
        current_week_start = week_start_of(today_for(user))
        weekly_log = WeeklyLogFactory(user=user, week_start=current_week_start)
        task = TaskFactory(user=user, weekly_log=weekly_log, status=Task.Status.PENDING)
        scheduled_date = current_week_start + timedelta(days=2)

        result = migrate_task(
            user=user, task_id=task.id, destination="week", scheduled_date=scheduled_date
        )

        assert result.status == Task.Status.MIGRATED
        new_task = result.migrated_to_task
        assert new_task is not None
        assert new_task.weekly_log_id == weekly_log.id
        assert new_task.scheduled_date == scheduled_date
        assert new_task.status == Task.Status.PENDING


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
def test_migrate_task_destination_month_sem_scheduled_date_postpoe_sem_dia(user):
    with tenant_context(user):
        log = LogFactory(user=user)
        task = TaskFactory(user=user, log=log, status=Task.Status.PENDING)
        current_month_first = today_for(user).replace(day=1)

        result = migrate_task(
            user=user,
            task_id=task.id,
            destination="month",
            month_first=current_month_first,
        )

        monthly_log = get_or_create_monthly_log(user=user, month_first=current_month_first)
        assert result.status == Task.Status.POSTPONED
        new_task = result.migrated_to_task
        assert new_task.scheduled_date is None
        assert new_task.monthly_log_id == monthly_log.id


@pytest.mark.django_db
def test_migrate_task_destination_month_mesmo_mes_da_origem_nao_fecha_o_proprio_destino(user):
    """Mesma regressão de
    `test_migrate_task_destination_week_mesma_semana_da_origem_nao_fecha_o_proprio_destino`,
    para "month": tarefa é a única pending/started do `monthly_log` corrente
    (ex.: item "sem dia" do Future Log já chegado ao mês) e ganha um dia
    dentro desse MESMO mês — destino coincide com a origem."""
    with tenant_context(user):
        current_month_first = today_for(user).replace(day=1)
        monthly_log = MonthlyLogFactory(user=user, month_first=current_month_first)
        task = TaskFactory(user=user, monthly_log=monthly_log, status=Task.Status.PENDING)
        scheduled_date = current_month_first.replace(day=15)

        result = migrate_task(
            user=user,
            task_id=task.id,
            destination="month",
            month_first=current_month_first,
            scheduled_date=scheduled_date,
        )

        assert result.status == Task.Status.POSTPONED
        new_task = result.migrated_to_task
        assert new_task is not None
        assert new_task.monthly_log_id == monthly_log.id
        assert new_task.scheduled_date == scheduled_date
        assert new_task.status == Task.Status.PENDING


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


# --- herança de status na migração (Story 12.1 / AD-18 item 1-2, #23) ---------


def test_inherited_successor_status_started_carrega_started():
    """AC4 (regra pura, sem DB): a origem `started` gera sucessor `started`
    (herança por identidade, AD-18 item 1). Este é o coração do AC4 — a regra
    é testável em nível unit e reusável (Épico 14) sem tocar o DB."""
    assert inherited_successor_status(Task.Status.STARTED) == Task.Status.STARTED


def test_inherited_successor_status_pending_carrega_pending():
    """AC4 (regra pura, sem DB): a origem `pending` gera sucessor `pending` —
    a identidade mantém válidos todos os testes de migração pré-existentes."""
    assert inherited_successor_status(Task.Status.PENDING) == Task.Status.PENDING


@pytest.mark.django_db
def test_migrar_started_para_today_sucessor_nasce_started_origem_migrated(user):
    """AC1 (fluxo `today`): uma tarefa `started` migrada gera um sucessor
    `started` (AD-18 item 1); a origem fica terminal `migrated` com linhagem
    intacta (`migrated_to_task` + `migration_count == 1`, AD-03)."""
    with tenant_context(user):
        log = LogFactory(user=user)
        task = TaskFactory(user=user, log=log, status=Task.Status.STARTED)

        result = migrate_task(user=user, task_id=task.id, destination="today")

        assert result.status == Task.Status.MIGRATED
        new_task = result.migrated_to_task
        assert new_task is not None
        assert new_task.status == Task.Status.STARTED
        assert new_task.migration_count == 1
        assert result.migrated_to_task_id == new_task.id


@pytest.mark.django_db
def test_migrar_started_para_week_sucessor_nasce_started_origem_migrated(user):
    """AC1 (fluxo `week`): `started` migrada para a Weekly Log corrente gera
    sucessor `started`; origem `migrated`."""
    with tenant_context(user):
        log = LogFactory(user=user)
        task = TaskFactory(user=user, log=log, status=Task.Status.STARTED)

        result = migrate_task(user=user, task_id=task.id, destination="week")

        current_week_start = week_start_of(today_for(user))
        weekly_log = get_or_create_weekly_log(user=user, week_start=current_week_start)
        assert result.status == Task.Status.MIGRATED
        new_task = result.migrated_to_task
        assert new_task is not None
        assert new_task.status == Task.Status.STARTED
        assert new_task.weekly_log_id == weekly_log.id
        assert new_task.migration_count == 1


@pytest.mark.django_db
def test_migrar_started_para_month_sucessor_nasce_started_origem_postponed(user):
    """AC1 (ramo POSTPONED, fluxo `month`): `started` adiada para o mês
    corrente gera sucessor `started`; origem `postponed`."""
    with tenant_context(user):
        log = LogFactory(user=user)
        task = TaskFactory(user=user, log=log, status=Task.Status.STARTED)
        current_month_first = today_for(user).replace(day=1)

        result = migrate_task(
            user=user, task_id=task.id, destination="month", month_first=current_month_first
        )

        monthly_log = get_or_create_monthly_log(user=user, month_first=current_month_first)
        assert result.status == Task.Status.POSTPONED
        new_task = result.migrated_to_task
        assert new_task is not None
        assert new_task.status == Task.Status.STARTED
        assert new_task.monthly_log_id == monthly_log.id
        assert new_task.migration_count == 1


@pytest.mark.django_db
def test_migrar_started_para_future_sucessor_nasce_started_origem_postponed(user):
    """AC1 (ramo POSTPONED, fluxo `future`): `started` adiada para um mês
    futuro gera sucessor `started`; origem `postponed`."""
    with tenant_context(user):
        log = LogFactory(user=user)
        task = TaskFactory(user=user, log=log, status=Task.Status.STARTED)
        current_month_first = today_for(user).replace(day=1)
        future_month = date(current_month_first.year + 1, current_month_first.month, 1)

        result = migrate_task(
            user=user, task_id=task.id, destination="future", month_first=future_month
        )

        assert result.status == Task.Status.POSTPONED
        new_task = result.migrated_to_task
        assert new_task is not None
        assert new_task.status == Task.Status.STARTED


@pytest.mark.django_db
def test_migrar_subarvore_status_misto_cada_no_herda_o_proprio_status(user):
    """AC2 (AD-18 item 2): numa subárvore de status misto, cada nó recriado
    herda o PRÓPRIO status de origem, não o do pai. Pai `started` com um filho
    `pending` e um filho `started` → novo pai `started`, filho pending
    permanece `pending` (não é promovido pelo status do pai) e filho started
    permanece `started` (não é rebaixado pelo status do pai). Filho `completed`
    fica intocado na origem (comportamento pré-existente). Espelha o padrão de
    `test_migrar_pai_recria_apenas_filhos_nao_dispostos`."""
    with tenant_context(user):
        log = LogFactory(user=user)
        parent = TaskFactory(user=user, log=log, status=Task.Status.STARTED, title="Pai started")
        pending_child = TaskFactory(
            user=user,
            log=log,
            parent_task=parent,
            status=Task.Status.PENDING,
            title="Filho pending",
        )
        started_child = TaskFactory(
            user=user,
            log=log,
            parent_task=parent,
            status=Task.Status.STARTED,
            title="Filho started",
        )
        completed_child = TaskFactory(
            user=user,
            log=log,
            parent_task=parent,
            status=Task.Status.COMPLETED,
            title="Filho concluído",
        )

        result = migrate_task(user=user, task_id=parent.id, destination="today")

        # Origem terminal; filho concluído intocado (comportamento pré-existente).
        pending_child.refresh_from_db()
        started_child.refresh_from_db()
        completed_child.refresh_from_db()
        assert result.status == Task.Status.MIGRATED
        assert pending_child.status == Task.Status.MIGRATED
        assert started_child.status == Task.Status.MIGRATED
        assert completed_child.status == Task.Status.COMPLETED
        assert completed_child.migrated_to_task_id is None

        # Destino: novo pai herda `started`; cada filho recriado herda o próprio.
        new_parent = result.migrated_to_task
        assert new_parent is not None
        assert new_parent.status == Task.Status.STARTED
        destino_filhos = {c.title: c for c in new_parent.subtasks.all()}
        assert set(destino_filhos) == {"Filho pending", "Filho started"}
        assert destino_filhos["Filho pending"].status == Task.Status.PENDING
        assert destino_filhos["Filho started"].status == Task.Status.STARTED


@pytest.mark.django_db
def test_migrar_subarvore_profunda_cada_nivel_herda_o_proprio_status(user):
    """AC2 em profundidade (>1 nível): a herança por-nó vale em qualquer nível
    da subárvore, não só nos filhos diretos. Raiz `started` → filho `pending`
    → neto `started`. Após migrar, cada nó recriado carrega o PRÓPRIO status
    (novo pai `started`, novo filho `pending`, novo neto `started`) — guarda a
    recursão de `_migrate_subtree` contra regressões que assumam profundidade 1."""
    with tenant_context(user):
        log = LogFactory(user=user)
        parent = TaskFactory(user=user, log=log, status=Task.Status.STARTED, title="Raiz started")
        child = TaskFactory(
            user=user,
            log=log,
            parent_task=parent,
            status=Task.Status.PENDING,
            title="Filho pending",
        )
        TaskFactory(
            user=user,
            log=log,
            parent_task=child,
            status=Task.Status.STARTED,
            title="Neto started",
        )

        result = migrate_task(user=user, task_id=parent.id, destination="today")

        new_parent = result.migrated_to_task
        assert new_parent is not None
        assert new_parent.status == Task.Status.STARTED
        new_child = new_parent.subtasks.get(title="Filho pending")
        assert new_child.status == Task.Status.PENDING
        new_grandchild = new_child.subtasks.get(title="Neto started")
        assert new_grandchild.status == Task.Status.STARTED


# --- herança de waiting_on na migração (Story 12.2 / AD-18 item 5, #15) --------


@pytest.mark.django_db
def test_migrar_waiting_on_true_para_today_sucessor_herda_true(user):
    """AC4 (AD-18 item 5): uma tarefa `waiting_on=True` migrada gera um sucessor
    que continua aguardando o terceiro (`waiting_on=True`)."""
    with tenant_context(user):
        log = LogFactory(user=user)
        task = TaskFactory(user=user, log=log, status=Task.Status.PENDING, waiting_on=True)

        result = migrate_task(user=user, task_id=task.id, destination="today")

        new_task = result.migrated_to_task
        assert new_task is not None
        assert new_task.waiting_on is True


@pytest.mark.django_db
def test_migrar_waiting_on_false_para_today_sucessor_permanece_false(user):
    """AC4: a herança é cópia-identidade — origem `waiting_on=False` gera
    sucessor `False` (o default de `create_task` não é indevidamente promovido)."""
    with tenant_context(user):
        log = LogFactory(user=user)
        task = TaskFactory(user=user, log=log, status=Task.Status.PENDING, waiting_on=False)

        result = migrate_task(user=user, task_id=task.id, destination="today")

        new_task = result.migrated_to_task
        assert new_task is not None
        assert new_task.waiting_on is False


@pytest.mark.django_db
def test_migrar_waiting_on_true_para_week_sucessor_herda_true(user):
    """AC4 (fluxo `week`, ritual semanal): `waiting_on` é herdado também na
    migração para a Weekly Log — todos os fluxos passam por `_migrate_subtree`.
    Espelha `test_migrar_started_para_week_...` (12.1) para a dimensão flag."""
    with tenant_context(user):
        log = LogFactory(user=user)
        task = TaskFactory(user=user, log=log, status=Task.Status.PENDING, waiting_on=True)

        result = migrate_task(user=user, task_id=task.id, destination="week")

        current_week_start = week_start_of(today_for(user))
        weekly_log = get_or_create_weekly_log(user=user, week_start=current_week_start)
        new_task = result.migrated_to_task
        assert new_task is not None
        assert new_task.weekly_log_id == weekly_log.id
        assert new_task.waiting_on is True


@pytest.mark.django_db
def test_migrar_waiting_on_true_para_month_sucessor_herda_true(user):
    """AC4 (fluxo `month`, ramo POSTPONED): `waiting_on` é herdado no adiamento
    para o Monthly Log corrente. Espelha `test_migrar_started_para_month_...`."""
    with tenant_context(user):
        log = LogFactory(user=user)
        task = TaskFactory(user=user, log=log, status=Task.Status.PENDING, waiting_on=True)
        current_month_first = today_for(user).replace(day=1)

        result = migrate_task(
            user=user, task_id=task.id, destination="month", month_first=current_month_first
        )

        monthly_log = get_or_create_monthly_log(user=user, month_first=current_month_first)
        new_task = result.migrated_to_task
        assert new_task is not None
        assert new_task.monthly_log_id == monthly_log.id
        assert new_task.waiting_on is True


@pytest.mark.django_db
def test_migrar_waiting_on_true_para_future_sucessor_herda_true(user):
    """AC4 (fluxo `future`, ramo POSTPONED): `waiting_on` é herdado no adiamento
    para um mês futuro. Espelha `test_migrar_started_para_future_...` (12.1)."""
    with tenant_context(user):
        log = LogFactory(user=user)
        task = TaskFactory(user=user, log=log, status=Task.Status.PENDING, waiting_on=True)
        current_month_first = today_for(user).replace(day=1)
        future_month = date(current_month_first.year + 1, current_month_first.month, 1)

        result = migrate_task(
            user=user, task_id=task.id, destination="future", month_first=future_month
        )

        new_task = result.migrated_to_task
        assert new_task is not None
        assert new_task.waiting_on is True


@pytest.mark.django_db
def test_migrar_subarvore_waiting_on_misto_cada_no_herda_o_proprio(user):
    """AC4 (disciplina por-nó, AD-18 item 2): numa subárvore de flag mista, cada
    nó recriado herda o PRÓPRIO `waiting_on`, NÃO o do pai. Pai `True` com um
    filho `False` e um filho `True` → novo pai `True`, filho normal `False` (não
    contaminado pelo pai), filho aguardando `True`. Espelha
    `test_migrar_subarvore_status_misto_cada_no_herda_o_proprio_status` (12.1)."""
    with tenant_context(user):
        log = LogFactory(user=user)
        parent = TaskFactory(
            user=user, log=log, status=Task.Status.PENDING, waiting_on=True, title="Pai aguardando"
        )
        TaskFactory(
            user=user,
            log=log,
            parent_task=parent,
            status=Task.Status.PENDING,
            waiting_on=False,
            title="Filho normal",
        )
        TaskFactory(
            user=user,
            log=log,
            parent_task=parent,
            status=Task.Status.PENDING,
            waiting_on=True,
            title="Filho aguardando",
        )

        result = migrate_task(user=user, task_id=parent.id, destination="today")

        new_parent = result.migrated_to_task
        assert new_parent is not None
        assert new_parent.waiting_on is True
        destino_filhos = {c.title: c for c in new_parent.subtasks.all()}
        assert destino_filhos["Filho normal"].waiting_on is False
        assert destino_filhos["Filho aguardando"].waiting_on is True


# --- recurring.py (AC #1, #2, #3) ----------------------------------------------


@pytest.mark.django_db
def test_create_template_grava_campos_passados(user):
    with tenant_context(user):
        template = create_template(
            user=user,
            title="Revisão semanal",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.WEEKLY,
            recurrence_text="toda sexta",
            category=Task.Category.TEAL,
        )

        assert template.title == "Revisão semanal"
        assert template.recurrence_group == RecurringTaskTemplate.RecurrenceGroup.WEEKLY
        assert template.recurrence_text == "toda sexta"
        assert template.active is True
        assert template.category == Task.Category.TEAL


@pytest.mark.django_db
def test_create_template_escopado_por_tenant(user, other_user):
    with tenant_context(user):
        create_template(
            user=user,
            title="Template do user",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.WEEKLY,
            recurrence_text="toda segunda",
        )

    with tenant_context(other_user):
        assert RecurringTaskTemplate.objects.count() == 0


@pytest.mark.django_db
def test_update_template_altera_so_os_campos_passados(user):
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(user=user, title="Original", active=True)

        updated = update_template(user=user, template_id=template.id, title="Atualizado")

        assert updated.title == "Atualizado"
        assert updated.active is True


@pytest.mark.django_db
def test_update_template_escopado_por_tenant(user, other_user):
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(user=user, title="Original")

    with tenant_context(other_user):
        with pytest.raises(RecurringTaskTemplate.DoesNotExist):
            update_template(user=other_user, template_id=template.id, title="Invadido")


@pytest.mark.django_db
def test_place_template_weekly_cria_task_com_campos_esperados(user):
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(
            user=user,
            title="Revisão semanal",
            description="Descrição",
            eisenhower=Task.Eisenhower.IMPORTANT,
            category=Task.Category.TEAL,
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.WEEKLY,
        )
        week_start = week_start_of(today_for(user))

        task = place_template(user=user, template_id=template.id, week_start=week_start)

        weekly_log = get_or_create_weekly_log(user=user, week_start=week_start)
        assert task.weekly_log_id == weekly_log.id
        assert task.status == Task.Status.PENDING
        assert task.parent_task is None
        assert task.migration_count == 0
        assert task.source_template_id == template.id
        assert task.title == "Revisão semanal"
        assert task.description == "Descrição"
        assert task.eisenhower == Task.Eisenhower.IMPORTANT
        assert task.category == Task.Category.TEAL


@pytest.mark.django_db
def test_place_template_sem_category_cria_task_sem_categoria(user):
    """AC6 — regressão: template sem categoria continua colocando a Task
    sem categoria, exatamente como antes desta story."""
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(
            user=user,
            category=None,
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.WEEKLY,
        )
        week_start = week_start_of(today_for(user))

        task = place_template(user=user, template_id=template.id, week_start=week_start)

        assert task.category is None


@pytest.mark.django_db
@pytest.mark.parametrize(
    "recurrence_group",
    [RecurringTaskTemplate.RecurrenceGroup.MONTHLY, RecurringTaskTemplate.RecurrenceGroup.ANNUAL],
)
def test_place_template_monthly_e_annual_colocam_no_mesmo_container(user, recurrence_group):
    """AD-08 item 5: `recurrence_group` controla apresentação, não placement —
    monthly e annual colocam ambos no Monthly Log, não existe "log anual"."""
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(
            user=user, recurrence_group=recurrence_group, title="Recorrente"
        )
        month_first = today_for(user).replace(day=1)

        task = place_template(user=user, template_id=template.id, month_first=month_first)

        monthly_log = get_or_create_monthly_log(user=user, month_first=month_first)
        assert task.monthly_log_id == monthly_log.id


@pytest.mark.django_db
def test_place_template_weekly_sem_week_start_levanta_wrong_placement_container(user):
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(
            user=user, recurrence_group=RecurringTaskTemplate.RecurrenceGroup.WEEKLY
        )

        with pytest.raises(WrongPlacementContainer):
            place_template(user=user, template_id=template.id)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "recurrence_group",
    [RecurringTaskTemplate.RecurrenceGroup.MONTHLY, RecurringTaskTemplate.RecurrenceGroup.ANNUAL],
)
def test_place_template_monthly_annual_sem_month_first_levanta_wrong_placement_container(
    user, recurrence_group
):
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(user=user, recurrence_group=recurrence_group)

        with pytest.raises(WrongPlacementContainer):
            place_template(user=user, template_id=template.id)


@pytest.mark.django_db
def test_place_template_independencia_instancia_template_ac3(user):
    """AC #3: editar o template depois do placement não altera a Task já
    criada; colocar o mesmo template de novo (após a edição) usa os campos
    atualizados; editar a Task não afeta o template."""
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(
            user=user,
            title="Título original",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.WEEKLY,
        )
        week_start = week_start_of(today_for(user))

        first_task = place_template(user=user, template_id=template.id, week_start=week_start)
        update_template(user=user, template_id=template.id, title="Título atualizado")
        first_task.refresh_from_db()

        assert first_task.title == "Título original"

        second_task = place_template(user=user, template_id=template.id, week_start=week_start)
        assert second_task.title == "Título atualizado"

        update_task(user=user, task_id=first_task.id, title="Editada na instância")
        template.refresh_from_db()
        assert template.title == "Título atualizado"


@pytest.mark.django_db
def test_place_template_escopado_por_tenant(user, other_user):
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(
            user=user, recurrence_group=RecurringTaskTemplate.RecurrenceGroup.WEEKLY
        )

    with tenant_context(other_user):
        with pytest.raises(RecurringTaskTemplate.DoesNotExist):
            place_template(
                user=other_user,
                template_id=template.id,
                week_start=week_start_of(today_for(other_user)),
            )


# --- soft delete de template (Story 14.4, AC1/AC3/AC5) --------------------------


@pytest.mark.django_db
def test_soft_delete_template_grava_deleted_at_sem_tocar_active_nem_conteudo(user):
    """AC3: o `save(update_fields=["deleted_at"])` escreve UMA coluna. `active`
    (o eixo ortogonal, reversível) e todo o conteúdo ficam byte-idênticos —
    "excluído" e "inativo" são conceitos distintos também no schema, não só na UI.
    """
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(
            user=user,
            title="Regar as plantas",
            description="com o regador pequeno",
            eisenhower=Task.Eisenhower.IMPORTANT,
            category=Task.Category.TEAL,
            recurrence_text="toda segunda",
            active=True,
        )

        excluido = soft_delete_template(user=user, template_id=template.id)

        template.refresh_from_db()
        assert template.deleted_at is not None
        assert excluido.deleted_at == template.deleted_at
        assert template.active is True  # NÃO foi desativado — os eixos são ortogonais
        assert template.title == "Regar as plantas"
        assert template.description == "com o regador pequeno"
        assert template.eisenhower == Task.Eisenhower.IMPORTANT
        assert template.category == Task.Category.TEAL
        assert template.recurrence_text == "toda segunda"
        assert template.recurrence_group == RecurringTaskTemplate.RecurrenceGroup.WEEKLY


@pytest.mark.django_db
def test_soft_delete_template_idempotente_preserva_o_deleted_at_original_sem_escrita(user):
    """AC3: re-executar devolve o MESMO registro com o MESMO `deleted_at`, e o
    "sem escrita" é provado no SQL por `_sem_escrita` (nenhum
    `INSERT`/`UPDATE`/`DELETE`), não pelo valor de retorno."""
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(user=user)

        primeiro = soft_delete_template(user=user, template_id=template.id)
        carimbo_original = primeiro.deleted_at

        segundo = _sem_escrita(soft_delete_template, user=user, template_id=template.id)

        assert segundo.id == template.id
        assert segundo.deleted_at == carimbo_original
        template.refresh_from_db()
        assert template.deleted_at == carimbo_original


@pytest.mark.django_db
def test_soft_delete_template_escreve_SOMENTE_a_coluna_deleted_at_no_sql(user):
    """AC3: `save(update_fields=["deleted_at"])` é o que garante MECANICAMENTE que
    a exclusão não toca `active` nem conteúdo — e essa garantia só é observável no
    SQL emitido, nunca por assert de valor.

    Por que este teste existe (achado da code review desta story): sem
    `update_fields`, o Django reescreve TODAS as colunas do model com os mesmos
    valores que acabou de ler do banco, então nenhum assert de igualdade fica
    vermelho — a suíte inteira seguia verde com a cláusula removida. O que se perde
    ali é a proteção contra *lost update*: um `PATCH` concorrente teria seus campos
    sobrescritos pela exclusão, numa operação que é terminal e irreversível. A
    propriedade é do `UPDATE`, então é o `UPDATE` que precisa ser pinado.
    """
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(
            user=user, active=True, title="Regar as plantas", recurrence_text="toda segunda"
        )

        with CaptureQueriesContext(connection) as capturadas:
            soft_delete_template(user=user, template_id=template.id)

        updates = [
            q["sql"]
            for q in capturadas.captured_queries
            if q["sql"].lstrip().upper().startswith("UPDATE")
        ]
        assert len(updates) == 1, f"esperado UM update, veio {len(updates)}: {updates}"
        assert "deleted_at" in updates[0], updates[0]
        # Nenhuma outra coluna do model entra no `SET` — os dois eixos (`active` e
        # `deleted_at`) são ortogonais até no statement.
        for coluna in (
            "active",
            "title",
            "description",
            "eisenhower",
            "category",
            "recurrence_group",
            "recurrence_text",
        ):
            assert coluna not in updates[0], (
                f"`{coluna}` foi reescrita pelo soft delete "
                f"(perdeu o `update_fields`): {updates[0]}"
            )


@pytest.mark.django_db
def test_soft_delete_template_escopado_por_tenant(user, other_user):
    """AD-12: o manager auto-escopado torna a linha alheia inexistente — a view
    traduz em 404, exatamente como `update_template`/`place_template`."""
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(user=user)

    with tenant_context(other_user):
        with pytest.raises(RecurringTaskTemplate.DoesNotExist):
            soft_delete_template(user=other_user, template_id=template.id)

    with tenant_context(user):
        template.refresh_from_db()
        assert template.deleted_at is None  # a tentativa alheia não escreveu nada


@pytest.mark.django_db
def test_soft_delete_template_preserva_a_linhagem_das_instancias_ja_alocadas(user):
    """AC5 — a razão de ser da story: "a linhagem das tarefas já alocadas
    permanece rastreável". Duas instâncias (uma weekly, uma monthly) mantêm
    `source_template_id` IGUAL AO ID ORIGINAL (comparação com o id, não
    `is not None`, que passaria vacuamente) e a linha do template continua
    existindo pelos dois caminhos de leitura."""
    with tenant_context(user):
        semanal = RecurringTaskTemplateFactory(
            user=user, recurrence_group=RecurringTaskTemplate.RecurrenceGroup.WEEKLY
        )
        mensal = RecurringTaskTemplateFactory(
            user=user, recurrence_group=RecurringTaskTemplate.RecurrenceGroup.MONTHLY
        )
        semana = week_start_of(today_for(user))
        instancia_semanal = place_template(user=user, template_id=semanal.id, week_start=semana)
        instancia_mensal = place_template(
            user=user, template_id=mensal.id, month_first=date(2026, 3, 1)
        )

        soft_delete_template(user=user, template_id=semanal.id)
        soft_delete_template(user=user, template_id=mensal.id)

        instancia_semanal.refresh_from_db()
        instancia_mensal.refresh_from_db()
        assert instancia_semanal.source_template_id == semanal.id
        assert instancia_mensal.source_template_id == mensal.id
        # A linha persiste: o manager auto-escopado NÃO filtra excluídos (só
        # `live_templates()` filtra), e o escape hatch de admin também a enxerga.
        assert RecurringTaskTemplate.objects.filter(pk=semanal.id).exists()
        assert RecurringTaskTemplate.objects.filter(pk=mensal.id).exists()
        assert RecurringTaskTemplate.all_objects.filter(pk=semanal.id).exists()
        assert RecurringTaskTemplate.all_objects.filter(pk=mensal.id).exists()


@pytest.mark.django_db
def test_update_template_sobre_excluido_levanta_does_not_exist(user):
    """AC2 ponto 5: `update_template` lê por `live_templates()`, então o excluído
    é inexistente para edição — a view devolve 404, e é isso que torna o soft
    delete irreversível pela API (não existe `PATCH {"deletedAt": null}`)."""
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(user=user, deleted=True)

        with pytest.raises(RecurringTaskTemplate.DoesNotExist):
            update_template(user=user, template_id=template.id, title="Ressuscitado")

        template.refresh_from_db()
        assert template.title != "Ressuscitado"


@pytest.mark.django_db
def test_place_template_sobre_excluido_levanta_does_not_exist(user):
    """AC2 ponto 6: um template excluído não pode gerar instância nova."""
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(
            user=user,
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.WEEKLY,
            deleted=True,
        )
        tarefas_antes = Task.objects.count()

        with pytest.raises(RecurringTaskTemplate.DoesNotExist):
            place_template(
                user=user, template_id=template.id, week_start=week_start_of(today_for(user))
            )

        assert Task.objects.count() == tarefas_antes


@pytest.mark.django_db
def test_live_templates_devolve_so_os_vivos_e_aceita_queryset_de_entrada(user):
    """AC2: UMA definição de "template vivo", na forma de `undisposed_roots` —
    helper de módulo que recebe/devolve queryset. Sem queryset, parte de
    `objects.all()`; com queryset, apenas acrescenta o filtro (é assim que as
    fontes dos rituais o compõem com `active=True`/`recurrence_group`)."""
    with tenant_context(user):
        vivo = RecurringTaskTemplateFactory(user=user, active=True)
        vivo_inativo = RecurringTaskTemplateFactory(user=user, active=False)
        excluido = RecurringTaskTemplateFactory(user=user, deleted=True)

        assert {t.id for t in live_templates()} == {vivo.id, vivo_inativo.id}
        assert excluido.id not in {t.id for t in live_templates()}

        composto = live_templates(RecurringTaskTemplate.objects.filter(active=True))
        assert {t.id for t in composto} == {vivo.id}


# --- archive.py (AC #1, #2) ----------------------------------------------------


@pytest.mark.django_db
def test_is_container_closed_log_sem_tarefas_retorna_false(user):
    """Vazio nunca é "fechado" — evita falso-positivo de um log só
    materializado por navegação (`get_or_create_*`), sem nenhuma tarefa."""
    with tenant_context(user):
        weekly_log = WeeklyLogFactory(user=user)

        assert is_container_closed(weekly_log) is False


@pytest.mark.django_db
def test_is_container_closed_log_com_so_tarefas_pending_retorna_false(user):
    with tenant_context(user):
        weekly_log = WeeklyLogFactory(user=user)
        TaskFactory(user=user, weekly_log=weekly_log, status=Task.Status.PENDING)

        assert is_container_closed(weekly_log) is False


@pytest.mark.django_db
@pytest.mark.parametrize(
    "disposed_status",
    [
        Task.Status.COMPLETED,
        Task.Status.CANCELLED,
        Task.Status.MIGRATED,
        Task.Status.POSTPONED,
    ],
)
def test_is_container_closed_log_com_todas_dispostas_retorna_true(user, disposed_status):
    with tenant_context(user):
        weekly_log = WeeklyLogFactory(user=user)
        TaskFactory(user=user, weekly_log=weekly_log, status=disposed_status)

        assert is_container_closed(weekly_log) is True


@pytest.mark.django_db
def test_is_container_closed_pai_completo_com_subtarefa_pending_retorna_false(user):
    """Prova direta da subárvore completa (FR-1.10): `is_container_closed` não
    filtra por `parent_task`, então um pai disposto com filho ainda pendente
    mantém o ciclo aberto."""
    with tenant_context(user):
        weekly_log = WeeklyLogFactory(user=user)
        parent = TaskFactory(user=user, weekly_log=weekly_log, status=Task.Status.COMPLETED)
        TaskFactory(
            user=user, weekly_log=weekly_log, parent_task=parent, status=Task.Status.PENDING
        )

        assert is_container_closed(weekly_log) is False


@pytest.mark.django_db
def test_is_container_closed_funciona_para_monthly_log(user):
    with tenant_context(user):
        monthly_log = MonthlyLogFactory(user=user)
        TaskFactory(user=user, monthly_log=monthly_log, status=Task.Status.CANCELLED)

        assert is_container_closed(monthly_log) is True


@pytest.mark.django_db
def test_list_closed_cycles_so_retorna_ciclos_fechados_ordenados_por_data_desc(user):
    with tenant_context(user):
        closed_weekly = WeeklyLogFactory(user=user, week_start=date(2026, 6, 1))
        TaskFactory(user=user, weekly_log=closed_weekly, status=Task.Status.COMPLETED)

        open_weekly = WeeklyLogFactory(user=user, week_start=date(2026, 6, 8))
        TaskFactory(user=user, weekly_log=open_weekly, status=Task.Status.PENDING)

        WeeklyLogFactory(user=user, week_start=date(2026, 6, 15))  # vazio — não fechado

        closed_monthly = MonthlyLogFactory(user=user, month_first=date(2026, 5, 1))
        TaskFactory(user=user, monthly_log=closed_monthly, status=Task.Status.CANCELLED)

        open_monthly = MonthlyLogFactory(user=user, month_first=date(2026, 7, 1))
        TaskFactory(user=user, monthly_log=open_monthly, status=Task.Status.STARTED)

        entries = list_closed_cycles(user=user)

        assert entries == [
            {"type": "weekly", "week_start": date(2026, 6, 1), "month_first": None},
            {"type": "monthly", "week_start": None, "month_first": date(2026, 5, 1)},
        ]


@pytest.mark.django_db
def test_list_closed_cycles_escopado_por_tenant(user, other_user):
    with tenant_context(other_user):
        other_closed = WeeklyLogFactory(user=other_user, week_start=date(2026, 6, 1))
        TaskFactory(user=other_user, weekly_log=other_closed, status=Task.Status.COMPLETED)

    with tenant_context(user):
        entries = list_closed_cycles(user=user)

        assert entries == []


# ==============================================================================
# Ciclo de vida operacional de Weekly/Monthly (Story 14.1 — AD-28, M06/M07)
# ==============================================================================
CYCLE_STATUSES = [None, CycleStatus.PLANNING, CycleStatus.ACTIVE, CycleStatus.FINALIZED]

# `to_status` → serviço público que tenta alcançá-lo. `None` (cancelar alvo vazio)
# existe só no Weekly — a ausência no Monthly é regra de produto (M07).
WEEKLY_CYCLE_ACTIONS = {
    CycleStatus.PLANNING: open_weekly_planning_target,
    CycleStatus.ACTIVE: start_weekly,
    CycleStatus.FINALIZED: finalize_weekly,
    None: cancel_weekly_planning_target,
}
MONTHLY_CYCLE_ACTIONS = {
    CycleStatus.ACTIVE: start_monthly,
    CycleStatus.FINALIZED: finalize_monthly,
}


def _current_week(user):
    return week_start_of(today_for(user))


def _current_month(user):
    return today_for(user).replace(day=1)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "from_status,to_status", list(itertools.product(CYCLE_STATUSES, CYCLE_STATUSES))
)
def test_ciclo_weekly_matriz_completa(user, from_status, to_status):
    """As 16 combinações (4x4) contra `cycles.ALLOWED`, no estilo de
    `test_transition_task_matriz_completa`.

    Três desfechos possíveis, e a distinção é deliberada: auto-transição
    (`from == to`) é **no-op idempotente**, não erro — é o caso-âncora da AD-28
    ("re-executar Iniciar depois é no-op"). Fora disso, dentro da matriz persiste,
    fora dela levanta `InvalidTransition` e NÃO escreve.
    """
    with tenant_context(user):
        key = _current_week(user)
        log = WeeklyLogFactory(user=user, week_start=key, status=from_status)
        if from_status == CycleStatus.PLANNING:
            # Satisfaz o gate de planejamento concluído para que a única coisa
            # sob teste seja a matriz (os gates têm testes isolados abaixo).
            log.planning_completed_at = cal_now()
            log.save(update_fields=["planning_completed_at"])
        if from_status == CycleStatus.ACTIVE and to_status == CycleStatus.FINALIZED:
            WeeklyLogFactory(
                user=user, week_start=key + timedelta(days=7), status=CycleStatus.PLANNING
            )

        action = WEEKLY_CYCLE_ACTIONS[to_status]

        if from_status == to_status:
            result = action(user=user, week_start=key)
            assert result.status == from_status
            log.refresh_from_db()
            assert log.status == from_status
        elif to_status in CYCLE_ALLOWED[from_status]:
            result = action(user=user, week_start=key)
            assert result.status == to_status
            log.refresh_from_db()
            assert log.status == to_status
        else:
            with pytest.raises(InvalidTransition):
                action(user=user, week_start=key)
            log.refresh_from_db()
            assert log.status == from_status


@pytest.mark.django_db
@pytest.mark.parametrize(
    "from_status,to_status",
    list(itertools.product(CYCLE_STATUSES, [CycleStatus.ACTIVE, CycleStatus.FINALIZED])),
)
def test_ciclo_monthly_matriz_completa(user, from_status, to_status):
    """Mesma matriz para o Monthly nas colunas endereçáveis por chave.

    A coluna `planning` fica fora daqui porque o alvo mensal é DETERMINÍSTICO
    (sem parâmetro de data): `open_monthly_planning_target` não endereça um mês
    arbitrário. Ela é coberta pelos testes de alvo determinístico logo abaixo.
    """
    with tenant_context(user):
        key = _current_month(user)
        log = MonthlyLogFactory(user=user, month_first=key, status=from_status)
        if from_status == CycleStatus.PLANNING:
            log.planning_completed_at = cal_now()
            log.save(update_fields=["planning_completed_at"])
        if from_status == CycleStatus.ACTIVE and to_status == CycleStatus.FINALIZED:
            MonthlyLogFactory(
                user=user, month_first=add_months(key, 1), status=CycleStatus.PLANNING
            )

        action = MONTHLY_CYCLE_ACTIONS[to_status]

        if from_status == to_status:
            result = action(user=user, month_first=key)
            assert result.status == from_status
        elif to_status in CYCLE_ALLOWED[from_status]:
            result = action(user=user, month_first=key)
            assert result.status == to_status
            log.refresh_from_db()
            assert log.status == to_status
        else:
            with pytest.raises(InvalidTransition):
                action(user=user, month_first=key)
            log.refresh_from_db()
            assert log.status == from_status


@pytest.mark.django_db
@pytest.mark.parametrize(
    "from_status", [CycleStatus.PLANNING, CycleStatus.FINALIZED]
)
def test_ciclo_monthly_abrir_planejamento_matriz_do_mes_corrente(user, from_status):
    """Coluna `planning` da matriz mensal quando o alvo determinístico coincide com
    o mês do log existente (não há `active`, então o alvo é o mês corrente):
    `planning` → no-op idempotente; `finalized` → `InvalidTransition`."""
    with tenant_context(user):
        key = _current_month(user)
        log = MonthlyLogFactory(user=user, month_first=key, status=from_status)

        if from_status == CycleStatus.PLANNING:
            assert open_monthly_planning_target(user=user).id == log.id
        else:
            with pytest.raises(InvalidTransition):
                open_monthly_planning_target(user=user)
        log.refresh_from_db()
        assert log.status == from_status


@pytest.mark.django_db
def test_ciclo_monthly_abrir_planejamento_com_ativo_mira_o_mes_seguinte(user):
    """`None → planning` aplicado ao mês SEGUINTE, nunca convertendo o `active`:
    "não existe escolha ou retargeting" (M07)."""
    with tenant_context(user):
        key = _current_month(user)
        active = MonthlyLogFactory(user=user, month_first=key, status=CycleStatus.ACTIVE)

        target = open_monthly_planning_target(user=user)

        assert target.month_first == add_months(key, 1)
        assert target.status == CycleStatus.PLANNING
        active.refresh_from_db()
        assert active.status == CycleStatus.ACTIVE


@pytest.mark.django_db
def test_ciclo_monthly_nao_tem_cancelar_planejamento(user):
    """M07: "O Monthly não herda a ação Cancelar planejamento vazio do Weekly" —
    a ausência é regra de produto, provada contra o módulo de serviços."""
    import bujo.services.cycles as cycles_module

    assert hasattr(cycles_module, "cancel_weekly_planning_target")
    assert not any(
        name.startswith("cancel_monthly") for name in dir(cycles_module)
    )
    assert "cancel_planning_target" not in MONTHLY_CYCLE_ACTION_CHOICES


# --- Gates de Iniciar (M06/M07: cumulativos) -----------------------------------
@pytest.mark.django_db
def test_ciclo_weekly_iniciar_caminho_feliz(user):
    with tenant_context(user):
        key = _current_week(user)
        open_weekly_planning_target(user=user, week_start=key)
        complete_weekly_planning(user=user, week_start=key)

        log = start_weekly(user=user, week_start=key)

        assert log.status == CycleStatus.ACTIVE


@pytest.mark.django_db
def test_ciclo_weekly_iniciar_falha_isolada_data_antes_do_alvo(user):
    """"Uma semana futura nunca entra Em andamento antes de sua segunda-feira,
    mesmo quando seu planejamento for concluído antecipadamente" (M06)."""
    with tenant_context(user):
        future = _current_week(user) + timedelta(days=7)
        open_weekly_planning_target(user=user, week_start=future)
        complete_weekly_planning(user=user, week_start=future)

        with pytest.raises(InvalidTransition):
            start_weekly(user=user, week_start=future)

        assert WeeklyLog.objects.get(week_start=future).status == CycleStatus.PLANNING


@pytest.mark.django_db
def test_ciclo_weekly_iniciar_falha_isolada_planejamento_nao_concluido(user):
    with tenant_context(user):
        key = _current_week(user)
        open_weekly_planning_target(user=user, week_start=key)  # sem concluir

        with pytest.raises(InvalidTransition):
            start_weekly(user=user, week_start=key)

        assert WeeklyLog.objects.get(week_start=key).status == CycleStatus.PLANNING


@pytest.mark.django_db
def test_ciclo_weekly_iniciar_falha_isolada_anterior_nao_finalizado(user):
    """Só o ciclo operacional imediatamente anterior bloqueia — e ele bloqueia
    tanto em `active` quanto em qualquer estado != `finalized`."""
    with tenant_context(user):
        key = _current_week(user)
        WeeklyLogFactory(
            user=user, week_start=key - timedelta(days=7), status=CycleStatus.ACTIVE
        )
        open_weekly_planning_target(user=user, week_start=key)
        complete_weekly_planning(user=user, week_start=key)

        with pytest.raises(InvalidTransition):
            start_weekly(user=user, week_start=key)

        assert WeeklyLog.objects.get(week_start=key).status == CycleStatus.PLANNING


@pytest.mark.django_db
def test_ciclo_weekly_iniciar_ignora_ciclos_null_anteriores(user):
    """`_previous_operational` só olha `status` não-`NULL`: sem isso, todo usuário
    com semanas velhas não-fechadas (bucket `NULL` do backfill, com tarefas
    abertas) ficaria travado para sempre no primeiro uso real — o "ciclo órfão"
    que o AC7 proíbe."""
    with tenant_context(user):
        key = _current_week(user)
        velha = WeeklyLogFactory(user=user, week_start=key - timedelta(days=14), status=None)
        TaskFactory(user=user, weekly_log=velha, status=Task.Status.PENDING)

        open_weekly_planning_target(user=user, week_start=key)
        complete_weekly_planning(user=user, week_start=key)
        log = start_weekly(user=user, week_start=key)

        assert log.status == CycleStatus.ACTIVE
        velha.refresh_from_db()
        assert velha.status is None  # o ciclo legado não foi tocado


@pytest.mark.django_db
def test_ciclo_weekly_avisos_de_daily_e_monthly_nao_bloqueiam_iniciar(user):
    """"Pendências de Daily, Monthly e recorrentes geram avisos persistentes, mas
    não bloqueiam" — só o Weekly imediatamente anterior é fonte bloqueante."""
    with tenant_context(user):
        key = _current_week(user)
        TaskFactory(user=user, status=Task.Status.PENDING)  # daily pendente
        monthly = MonthlyLogFactory(user=user, month_first=_current_month(user))
        TaskFactory(user=user, monthly_log=monthly, status=Task.Status.STARTED)

        open_weekly_planning_target(user=user, week_start=key)
        complete_weekly_planning(user=user, week_start=key)

        assert start_weekly(user=user, week_start=key).status == CycleStatus.ACTIVE


# --- Gates de Finalizar --------------------------------------------------------
@pytest.mark.django_db
@pytest.mark.parametrize("blocking_status", [Task.Status.PENDING, Task.Status.STARTED])
def test_ciclo_weekly_finalizar_bloqueado_por_tarefa_nao_disposta(user, blocking_status):
    with tenant_context(user):
        key = _current_week(user)
        log = WeeklyLogFactory(user=user, week_start=key, status=CycleStatus.ACTIVE)
        TaskFactory(user=user, weekly_log=log, status=blocking_status)
        WeeklyLogFactory(
            user=user, week_start=key + timedelta(days=7), status=CycleStatus.PLANNING
        )

        with pytest.raises(InvalidTransition):
            finalize_weekly(user=user, week_start=key)

        log.refresh_from_db()
        assert log.status == CycleStatus.ACTIVE


@pytest.mark.django_db
def test_ciclo_weekly_finalizar_bloqueado_por_subtarefa_pendente(user):
    """Subárvore COMPLETA (FR-1.10): pai disposto com filho pendente não finaliza."""
    with tenant_context(user):
        key = _current_week(user)
        log = WeeklyLogFactory(user=user, week_start=key, status=CycleStatus.ACTIVE)
        pai = TaskFactory(user=user, weekly_log=log, status=Task.Status.COMPLETED)
        TaskFactory(
            user=user, weekly_log=log, parent_task=pai, status=Task.Status.PENDING
        )
        WeeklyLogFactory(
            user=user, week_start=key + timedelta(days=7), status=CycleStatus.PLANNING
        )

        with pytest.raises(InvalidTransition):
            finalize_weekly(user=user, week_start=key)


@pytest.mark.django_db
def test_ciclo_weekly_finalizar_bloqueado_sem_proxima_semana_em_planejamento(user):
    with tenant_context(user):
        key = _current_week(user)
        log = WeeklyLogFactory(user=user, week_start=key, status=CycleStatus.ACTIVE)

        with pytest.raises(InvalidTransition):
            finalize_weekly(user=user, week_start=key)

        log.refresh_from_db()
        assert log.status == CycleStatus.ACTIVE


@pytest.mark.django_db
def test_ciclo_weekly_finalizar_aceita_semana_pulada_como_proxima(user):
    """Weekly permite PULAR semanas: qualquer `planning` posterior satisfaz o gate
    (AC3/M06) — exigir a semana imediatamente seguinte travaria o ritual."""
    with tenant_context(user):
        key = _current_week(user)
        log = WeeklyLogFactory(user=user, week_start=key, status=CycleStatus.ACTIVE)
        WeeklyLogFactory(
            user=user, week_start=key + timedelta(days=21), status=CycleStatus.PLANNING
        )

        assert finalize_weekly(user=user, week_start=key).status == CycleStatus.FINALIZED
        log.refresh_from_db()
        assert log.status == CycleStatus.FINALIZED  # persistido, não só retornado


@pytest.mark.django_db
def test_ciclo_monthly_finalizar_exige_o_mes_seguinte_sem_lacuna(user):
    """Monthly NÃO admite lacuna: um `planning` dois meses à frente não serve."""
    with tenant_context(user):
        key = _current_month(user)
        log = MonthlyLogFactory(user=user, month_first=key, status=CycleStatus.ACTIVE)
        distante = MonthlyLogFactory(
            user=user, month_first=add_months(key, 2), status=CycleStatus.PLANNING
        )

        with pytest.raises(InvalidTransition):
            finalize_monthly(user=user, month_first=key)

        distante.status = None
        distante.save(update_fields=["status"])
        MonthlyLogFactory(
            user=user, month_first=add_months(key, 1), status=CycleStatus.PLANNING
        )

        assert finalize_monthly(user=user, month_first=key).status == CycleStatus.FINALIZED
        log.refresh_from_db()
        assert log.status == CycleStatus.FINALIZED


@pytest.mark.django_db
def test_ciclo_weekly_finalizado_e_terminal_nenhuma_saida(user):
    """Irreversibilidade (AD-28 item 3 / M06 "nunca reabre"): conjunto de saída
    vazio — nenhuma das 4 ações weekly tira um ciclo de `finalized`."""
    with tenant_context(user):
        key = _current_week(user)
        log = WeeklyLogFactory(user=user, week_start=key, status=CycleStatus.FINALIZED)

        for action in (
            open_weekly_planning_target,
            start_weekly,
            cancel_weekly_planning_target,
        ):
            with pytest.raises(InvalidTransition):
                action(user=user, week_start=key)

        # `finalize` re-executado é no-op idempotente, não uma saída do estado.
        assert finalize_weekly(user=user, week_start=key).status == CycleStatus.FINALIZED
        log.refresh_from_db()
        assert log.status == CycleStatus.FINALIZED
        assert CYCLE_ALLOWED[CycleStatus.FINALIZED] == set()


# --- Concluir planejamento (não-bloqueante, não muda `status`) ------------------
@pytest.mark.django_db
def test_ciclo_concluir_planejamento_nao_muda_status_e_nao_congela_o_ritual(user):
    """"Declaração não bloqueante: pode ocorrer a qualquer momento, não exige
    abrir/zerar fontes, não congela o ritual" (M06) — o alvo segue plenamente
    operável depois de concluído (só `finalized` é readonly)."""
    with tenant_context(user):
        key = _current_week(user)
        open_weekly_planning_target(user=user, week_start=key)
        log = WeeklyLog.objects.get(week_start=key)
        TaskFactory(user=user, weekly_log=log, status=Task.Status.PENDING)

        result = complete_weekly_planning(user=user, week_start=key)

        assert result.status == CycleStatus.PLANNING
        assert result.planning_completed_at is not None
        # Continua mutável depois da declaração: nada de readonly em `planning`.
        create_task(user=user, weekly_log=log, title="Decisão nova pós-planejamento")


@pytest.mark.django_db
def test_ciclo_concluir_planejamento_reexecutado_preserva_o_timestamp_original(user):
    """Não re-timbra (mesmo espírito do "create-if-missing" de
    `seed_medication_day`): o marco original é dado de auditoria."""
    with tenant_context(user):
        key = _current_week(user)
        open_weekly_planning_target(user=user, week_start=key)
        primeiro = complete_weekly_planning(user=user, week_start=key).planning_completed_at

        segundo = complete_weekly_planning(user=user, week_start=key).planning_completed_at

        assert primeiro == segundo


@pytest.mark.django_db
@pytest.mark.parametrize("status_fora_do_regime", [None, CycleStatus.ACTIVE, CycleStatus.FINALIZED])
def test_ciclo_concluir_planejamento_exige_status_planning(user, status_fora_do_regime):
    """Concluir planejamento de um log FORA do regime (`NULL`) é `InvalidTransition`:
    é o 1º passo do bypass do ritual que a matriz sem `None → active` impede."""
    with tenant_context(user):
        key = _current_week(user)
        log = WeeklyLogFactory(user=user, week_start=key, status=status_fora_do_regime)

        with pytest.raises(InvalidTransition):
            complete_weekly_planning(user=user, week_start=key)

        log.refresh_from_db()
        assert log.planning_completed_at is None


@pytest.mark.django_db
def test_ciclo_concluir_planejamento_de_log_inexistente_levanta(user):
    with tenant_context(user):
        with pytest.raises(InvalidTransition):
            complete_weekly_planning(user=user, week_start=_current_week(user))


# --- Cancelar alvo de planejamento (só Weekly, só vazio) -----------------------
@pytest.mark.django_db
def test_ciclo_weekly_cancelar_zera_status_e_timestamp_sem_apagar_o_log(user):
    """M06 admite "cancelado **e recriado**": deixar o timestamp sobreviver
    permitiria recriar o alvo e passar o gate de Iniciar sem concluir
    planejamento de novo."""
    with tenant_context(user):
        key = _current_week(user)
        open_weekly_planning_target(user=user, week_start=key)
        complete_weekly_planning(user=user, week_start=key)

        log = cancel_weekly_planning_target(user=user, week_start=key)

        assert log.status is None
        assert log.planning_completed_at is None
        assert WeeklyLog.objects.filter(week_start=key).exists()  # o log sobrevive

        # Recriado: precisa concluir planejamento DE NOVO antes de iniciar.
        open_weekly_planning_target(user=user, week_start=key)
        with pytest.raises(InvalidTransition):
            start_weekly(user=user, week_start=key)


@pytest.mark.django_db
def test_ciclo_weekly_cancelar_bloqueado_com_qualquer_tarefa(user):
    """Só planejamento VAZIO pode ser cancelado — qualquer tarefa, em qualquer
    estado, bloqueia."""
    with tenant_context(user):
        key = _current_week(user)
        log = WeeklyLogFactory(user=user, week_start=key, status=CycleStatus.PLANNING)
        TaskFactory(user=user, weekly_log=log, status=Task.Status.COMPLETED)

        with pytest.raises(InvalidTransition):
            cancel_weekly_planning_target(user=user, week_start=key)

        log.refresh_from_db()
        assert log.status == CycleStatus.PLANNING


@pytest.mark.django_db
def test_ciclo_weekly_cancelar_log_inexistente_levanta(user):
    with tenant_context(user):
        with pytest.raises(InvalidTransition):
            cancel_weekly_planning_target(user=user, week_start=_current_week(user))


# --- Alvo de planejamento: janela aceita ---------------------------------------
@pytest.mark.django_db
def test_ciclo_weekly_alvo_no_passado_e_rejeitado(user):
    """Um alvo no passado envenenaria o "anterior operacional" de todos os ciclos
    seguintes (AC3)."""
    with tenant_context(user):
        passado = _current_week(user) - timedelta(days=7)

        with pytest.raises(InvalidTransition):
            open_weekly_planning_target(user=user, week_start=passado)

        assert not WeeklyLog.objects.filter(week_start=passado).exists()


@pytest.mark.django_db
@pytest.mark.parametrize("semanas_a_frente", [0, 1, 5])
def test_ciclo_weekly_alvo_corrente_ou_futuro_inclusive_pulando(user, semanas_a_frente):
    with tenant_context(user):
        alvo = _current_week(user) + timedelta(days=7 * semanas_a_frente)

        log = open_weekly_planning_target(user=user, week_start=alvo)

        assert log.week_start == alvo
        assert log.status == CycleStatus.PLANNING


@pytest.mark.django_db
def test_ciclo_weekly_apenas_um_alvo_em_planejamento_por_vez(user):
    """Segunda chamada de "Planejar próxima semana" com outro alvo já em
    planejamento → 409 pela unique parcial (caso-âncora da AD-28)."""
    with tenant_context(user):
        key = _current_week(user)
        open_weekly_planning_target(user=user, week_start=key)

        with pytest.raises(CycleTargetConflict):
            open_weekly_planning_target(user=user, week_start=key + timedelta(days=7))


# --- Monthly: alvo determinístico e sequência sem lacunas ----------------------
@pytest.mark.django_db
def test_ciclo_monthly_alvo_sem_nenhum_ativo_e_o_mes_corrente(user):
    """Bootstrap de usuário novo (decisão interina das Questões abertas da 14.1):
    sem `active`, o alvo mensal é o mês corrente por `today_for(user)`."""
    with tenant_context(user):
        assert next_monthly_target(user=user) == _current_month(user)

        log = open_monthly_planning_target(user=user)

        assert log.month_first == _current_month(user)
        assert log.status == CycleStatus.PLANNING


@pytest.mark.django_db
def test_ciclo_monthly_dois_meses_pulados_exigem_materializacao_sequencial(user):
    """M07: "cada mês intermediário é criado em sequência e percorre individualmente
    planejar → concluir planejamento → iniciar → finalizar. Não há salto,
    processamento em lote nem fechamento automático, mesmo quando o ciclo está
    vazio." Caso-âncora da AD-28 ("dois meses pulados → um ciclo por vez")."""
    with tenant_context(user):
        atual = _current_month(user)
        m2, m1 = add_months(atual, -2), add_months(atual, -1)
        MonthlyLogFactory(user=user, month_first=m2, status=CycleStatus.ACTIVE)

        # 1º ciclo intermediário: o alvo é m1, NUNCA um salto para o mês corrente.
        assert open_monthly_planning_target(user=user).month_first == m1
        complete_monthly_planning(user=user, month_first=m1)

        # Sem lote: iniciar m1 antes de finalizar m2 é bloqueado.
        with pytest.raises(InvalidTransition):
            start_monthly(user=user, month_first=m1)

        finalize_monthly(user=user, month_first=m2)
        assert start_monthly(user=user, month_first=m1).status == CycleStatus.ACTIVE
        # Sem fechamento automático: o mês corrente ainda não existe como ciclo.
        assert not MonthlyLog.objects.filter(month_first=atual).exists()

        # 2º ciclo: só agora o alvo passa a ser o mês corrente.
        assert open_monthly_planning_target(user=user).month_first == atual
        complete_monthly_planning(user=user, month_first=atual)
        finalize_monthly(user=user, month_first=m1)

        assert start_monthly(user=user, month_first=atual).status == CycleStatus.ACTIVE
        assert MonthlyLog.objects.get(month_first=m2).status == CycleStatus.FINALIZED
        assert MonthlyLog.objects.get(month_first=m1).status == CycleStatus.FINALIZED


# --- Idempotência dos 9 serviços ------------------------------------------------
def _sem_escrita(servico, **kwargs):
    """Executa `servico(**kwargs)` e afirma que NENHUMA escrita foi emitida.

    A parte "sem escrita" do AC2 não é observável pelo valor de retorno (os logs não
    têm `updated_at`), então ela é provada pelo SQL: nenhum `INSERT`/`UPDATE`/`DELETE`
    entre os statements capturados. Sem isso o nome do teste prometeria um guard que
    ele não exercita (achado recorrente da retrospectiva do Épico 13).
    """
    with CaptureQueriesContext(connection) as capturadas:
        resultado = servico(**kwargs)
    escritas = [
        q["sql"]
        for q in capturadas.captured_queries
        if q["sql"].lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE"))
    ]
    assert escritas == [], f"re-execução idempotente escreveu no banco: {escritas}"
    return resultado


@pytest.mark.django_db
def test_ciclo_idempotencia_dos_nove_servicos(user):
    """AC2: re-execução no estado-alvo = no-op, mesmo retorno, sem escrita.

    Um único teste percorrendo o ciclo completo dos dois tipos e re-executando
    CADA serviço logo depois do seu caminho felizes — cobre os 9 (5 weekly + 4
    monthly) sem 9 setups quase idênticos. Toda re-execução passa por
    `_sem_escrita`, que prova o "sem escrita" no SQL.
    """
    with tenant_context(user):
        semana = _current_week(user)
        mes = _current_month(user)

        # --- Weekly: cancelar (5º serviço) primeiro, para liberar a unique de planning.
        assert open_weekly_planning_target(user=user, week_start=semana).status == (
            CycleStatus.PLANNING
        )
        assert _sem_escrita(
            open_weekly_planning_target, user=user, week_start=semana
        ).status == CycleStatus.PLANNING  # idempotente
        assert cancel_weekly_planning_target(user=user, week_start=semana).status is None
        assert _sem_escrita(cancel_weekly_planning_target, user=user, week_start=semana).status is (
            None
        )

        # --- Weekly: planejar → concluir → iniciar → finalizar, cada um 2x.
        open_weekly_planning_target(user=user, week_start=semana)
        marco = complete_weekly_planning(user=user, week_start=semana).planning_completed_at
        assert (
            _sem_escrita(
                complete_weekly_planning, user=user, week_start=semana
            ).planning_completed_at
            == marco
        )

        assert start_weekly(user=user, week_start=semana).status == CycleStatus.ACTIVE
        assert (
            _sem_escrita(start_weekly, user=user, week_start=semana).status == CycleStatus.ACTIVE
        )

        open_weekly_planning_target(user=user, week_start=semana + timedelta(days=7))
        assert finalize_weekly(user=user, week_start=semana).status == CycleStatus.FINALIZED
        assert (
            _sem_escrita(finalize_weekly, user=user, week_start=semana).status
            == CycleStatus.FINALIZED
        )

        # --- Monthly: os 4 serviços, cada um 2x.
        assert open_monthly_planning_target(user=user).month_first == mes
        assert _sem_escrita(open_monthly_planning_target, user=user).month_first == mes

        marco_mes = complete_monthly_planning(user=user, month_first=mes).planning_completed_at
        assert (
            _sem_escrita(
                complete_monthly_planning, user=user, month_first=mes
            ).planning_completed_at
            == marco_mes
        )

        assert start_monthly(user=user, month_first=mes).status == CycleStatus.ACTIVE
        assert _sem_escrita(start_monthly, user=user, month_first=mes).status == CycleStatus.ACTIVE

        open_monthly_planning_target(user=user)  # alvo = mês seguinte
        assert finalize_monthly(user=user, month_first=mes).status == CycleStatus.FINALIZED
        assert (
            _sem_escrita(finalize_monthly, user=user, month_first=mes).status
            == CycleStatus.FINALIZED
        )


# --- Story 14.5, AC4: prontidão agregada do ciclo semanal (leitura pura) -------
@pytest.mark.django_db
def test_readiness_sem_nenhum_ciclo_operacional_devolve_os_quatro_blocos_nulos(user):
    with tenant_context(user):
        assert weekly_cycle_readiness(user=user) == {
            "active": None,
            "planning": None,
            "start": None,
            "finalize": None,
        }


@pytest.mark.django_db
def test_readiness_reflete_active_e_planning_com_os_tres_gates_de_start(user):
    """Espelha o exemplo da AC4: `active` presente, `planning` presente, os três
    gates de `start` computados — sem nenhum planejamento concluído nem semana
    anterior finalizada, os três falham."""
    with tenant_context(user):
        semana = _current_week(user)
        proxima = semana + timedelta(days=7)
        ativo = WeeklyLogFactory(
            user=user,
            week_start=semana,
            status=CycleStatus.ACTIVE,
            planning_completed_at=cal_now(),
        )
        planejamento = WeeklyLogFactory(user=user, week_start=proxima, status=CycleStatus.PLANNING)

        readiness = weekly_cycle_readiness(user=user)

        assert readiness["active"] == {
            "week_start": semana,
            "status": CycleStatus.ACTIVE,
            "planning_completed_at": ativo.planning_completed_at,
        }
        assert readiness["planning"] == {
            "week_start": proxima,
            "status": CycleStatus.PLANNING,
            "planning_completed_at": None,
        }
        assert readiness["start"] == {
            "allowed": False,
            "target": proxima,
            "gates": {
                # `proxima` é uma semana futura: hoje ainda não a alcançou.
                "date_reached": False,
                "planning_completed": False,
                # O `active` de HOJE é o anterior OPERACIONAL de `proxima` (é o
                # ciclo operacional mais recente antes dela) e ainda não está
                # `finalized` — não dá pra Iniciar a próxima antes de Finalizar
                # a corrente.
                "previous_finalized": False,
            },
        }
        assert readiness["finalize"] == {
            # Sem tarefa aberta e com `proxima` já em planejamento, os dois
            # gates de `finalize` passam (seria o momento de Finalizar, ainda
            # que `start` da PRÓXIMA semana continue bloqueado).
            "allowed": True,
            "target": semana,
            "gates": {"no_open_tasks": True, "next_planning_exists": True},
        }
        assert planejamento.status == CycleStatus.PLANNING  # sanity: nada escreveu


@pytest.mark.django_db
def test_readiness_start_allowed_true_quando_os_tres_gates_passam(user):
    with tenant_context(user):
        semana = _current_week(user)
        anterior = semana - timedelta(days=7)
        WeeklyLogFactory(user=user, week_start=anterior, status=CycleStatus.FINALIZED)
        WeeklyLogFactory(
            user=user,
            week_start=semana,
            status=CycleStatus.PLANNING,
            planning_completed_at=cal_now(),
        )

        readiness = weekly_cycle_readiness(user=user)

        assert readiness["start"]["allowed"] is True
        assert readiness["start"]["gates"] == {
            "date_reached": True,
            "planning_completed": True,
            "previous_finalized": True,
        }


@pytest.mark.django_db
def test_readiness_finalize_allowed_true_quando_os_dois_gates_passam(user):
    with tenant_context(user):
        semana = _current_week(user)
        log = WeeklyLogFactory(user=user, week_start=semana, status=CycleStatus.ACTIVE)
        WeeklyLogFactory(
            user=user, week_start=semana + timedelta(days=7), status=CycleStatus.PLANNING
        )

        readiness = weekly_cycle_readiness(user=user)

        assert readiness["finalize"] == {
            "allowed": True,
            "target": semana,
            "gates": {"no_open_tasks": True, "next_planning_exists": True},
        }
        assert log.status == CycleStatus.ACTIVE  # nada escreveu por trás


@pytest.mark.django_db
@pytest.mark.parametrize(
    "gate_alterado,setup,esperado_start,esperado_post",
    [
        ("date_reached", "futuro", False, 409),
        ("planning_completed", "sem_marco", False, 409),
        ("previous_finalized", "anterior_nao_finalizado", False, 409),
    ],
)
def test_readiness_start_e_o_gate_real_nao_podem_divergir(
    user, gate_alterado, setup, esperado_start, esperado_post
):
    """AC4: 'um teste prova que o painel e o gate não podem divergir (mesma
    condição → mesma resposta em GET e em POST)'. Para cada gate isolado (os
    outros dois satisfeitos), a leitura e a transição real concordam."""
    with tenant_context(user):
        hoje = today_for(user)
        if setup == "futuro":
            semana = hoje + timedelta(days=14)
            semana = week_start_of(semana)
        else:
            semana = _current_week(user)

        if setup != "anterior_nao_finalizado":
            anterior = semana - timedelta(days=7)
            if setup == "futuro":
                # A semana-alvo é futura: qualquer "anterior" cronológico real
                # já finalizado satisfaz o terceiro gate sem interferir no que
                # está sob teste (date_reached).
                WeeklyLogFactory(user=user, week_start=anterior, status=CycleStatus.FINALIZED)
        else:
            anterior = semana - timedelta(days=7)
            WeeklyLogFactory(user=user, week_start=anterior, status=CycleStatus.ACTIVE)

        marco = None if setup == "sem_marco" else cal_now()
        WeeklyLogFactory(
            user=user, week_start=semana, status=CycleStatus.PLANNING, planning_completed_at=marco
        )

        readiness = weekly_cycle_readiness(user=user)
        assert readiness["start"]["gates"][gate_alterado] is esperado_start
        assert readiness["start"]["allowed"] is False

        if esperado_post == 409:
            with pytest.raises(InvalidTransition):
                start_weekly(user=user, week_start=semana)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "gate_alterado,setup",
    [
        ("no_open_tasks", "tarefa_aberta"),
        ("next_planning_exists", "sem_proxima_planning"),
    ],
)
def test_readiness_finalize_e_o_gate_real_nao_podem_divergir(user, gate_alterado, setup):
    """Mesma prova de `test_readiness_start_e_o_gate_real_nao_podem_divergir`,
    agora do lado de `finalize` (AC4: 'painel e gate não podem divergir') — a
    divergência-side de `start` sozinha não provava o lado de `finalize`, que
    tem seus PRÓPRIOS dois gates (`no_open_tasks`/`next_planning_exists`)."""
    with tenant_context(user):
        semana = _current_week(user)
        ativo = WeeklyLogFactory(user=user, week_start=semana, status=CycleStatus.ACTIVE)

        if setup == "tarefa_aberta":
            TaskFactory(user=user, weekly_log=ativo, status=Task.Status.PENDING)
            # `next_planning_exists` satisfeito (o gate SOB TESTE é o outro):
            # existe uma PRÓXIMA semana em planning.
            WeeklyLogFactory(
                user=user, week_start=semana + timedelta(days=7), status=CycleStatus.PLANNING
            )
        # else ("sem_proxima_planning"): nenhuma tarefa criada ⇒ `no_open_tasks`
        # satisfeito; nenhuma PRÓXIMA semana em planning ⇒ `next_planning_exists`
        # falha — é o gate sob teste.

        readiness = weekly_cycle_readiness(user=user)
        assert readiness["finalize"]["gates"][gate_alterado] is False
        assert readiness["finalize"]["allowed"] is False

        with pytest.raises(InvalidTransition):
            finalize_weekly(user=user, week_start=semana)


@pytest.mark.django_db
def test_readiness_e_leitura_pura_sem_escrita_nem_get_or_create(user):
    """Zero efeito colateral: `WeeklyLog.objects.count()` inalterado e nenhum
    INSERT/UPDATE/DELETE emitido, provado no SQL (molde de `_sem_escrita`)."""
    with tenant_context(user):
        semana = _current_week(user)
        WeeklyLogFactory(
            user=user,
            week_start=semana,
            status=CycleStatus.ACTIVE,
            planning_completed_at=cal_now(),
        )
        WeeklyLogFactory(
            user=user, week_start=semana + timedelta(days=7), status=CycleStatus.PLANNING
        )
        antes = WeeklyLog.objects.count()

        resultado = _sem_escrita(weekly_cycle_readiness, user=user)

        assert WeeklyLog.objects.count() == antes
        assert resultado["active"]["status"] == CycleStatus.ACTIVE


# --- Story 14.6, AC4: prontidão agregada do ciclo mensal (leitura pura) --------
# Molde direto do bloco `weekly_cycle_readiness` acima, trocando `_WEEKLY`→
# `_MONTHLY` e `week_start`→`month_first` — a única divergência de produto é
# `next_planning_exists`: o Monthly exige o mês EXATAMENTE seguinte (sem
# lacuna), não qualquer planning futuro.
@pytest.mark.django_db
def test_readiness_monthly_sem_nenhum_ciclo_operacional_devolve_os_quatro_blocos_nulos(user):
    with tenant_context(user):
        assert monthly_cycle_readiness(user=user) == {
            "active": None,
            "planning": None,
            "start": None,
            "finalize": None,
        }


@pytest.mark.django_db
def test_readiness_monthly_reflete_active_e_planning_com_os_tres_gates_de_start(user):
    with tenant_context(user):
        mes = _current_month(user)
        proximo = add_months(mes, 1)
        ativo = MonthlyLogFactory(
            user=user,
            month_first=mes,
            status=CycleStatus.ACTIVE,
            planning_completed_at=cal_now(),
        )
        planejamento = MonthlyLogFactory(
            user=user, month_first=proximo, status=CycleStatus.PLANNING
        )

        readiness = monthly_cycle_readiness(user=user)

        assert readiness["active"] == {
            "month_first": mes,
            "status": CycleStatus.ACTIVE,
            "planning_completed_at": ativo.planning_completed_at,
        }
        assert readiness["planning"] == {
            "month_first": proximo,
            "status": CycleStatus.PLANNING,
            "planning_completed_at": None,
        }
        assert readiness["start"] == {
            "allowed": False,
            "target": proximo,
            "gates": {
                "date_reached": False,
                "planning_completed": False,
                # O `active` do mês corrente É o anterior operacional de
                # `proximo` e ainda não está `finalized`.
                "previous_finalized": False,
            },
        }
        assert readiness["finalize"] == {
            "allowed": True,
            "target": mes,
            "gates": {"no_open_tasks": True, "next_planning_exists": True},
        }
        assert planejamento.status == CycleStatus.PLANNING  # sanity: nada escreveu


@pytest.mark.django_db
def test_readiness_monthly_start_allowed_true_quando_os_tres_gates_passam(user):
    with tenant_context(user):
        mes = _current_month(user)
        anterior = add_months(mes, -1)
        MonthlyLogFactory(user=user, month_first=anterior, status=CycleStatus.FINALIZED)
        MonthlyLogFactory(
            user=user,
            month_first=mes,
            status=CycleStatus.PLANNING,
            planning_completed_at=cal_now(),
        )

        readiness = monthly_cycle_readiness(user=user)

        assert readiness["start"]["allowed"] is True
        assert readiness["start"]["gates"] == {
            "date_reached": True,
            "planning_completed": True,
            "previous_finalized": True,
        }


@pytest.mark.django_db
def test_readiness_monthly_finalize_allowed_true_quando_os_dois_gates_passam(user):
    with tenant_context(user):
        mes = _current_month(user)
        log = MonthlyLogFactory(user=user, month_first=mes, status=CycleStatus.ACTIVE)
        MonthlyLogFactory(
            user=user, month_first=add_months(mes, 1), status=CycleStatus.PLANNING
        )

        readiness = monthly_cycle_readiness(user=user)

        assert readiness["finalize"] == {
            "allowed": True,
            "target": mes,
            "gates": {"no_open_tasks": True, "next_planning_exists": True},
        }
        assert log.status == CycleStatus.ACTIVE  # nada escreveu por trás


@pytest.mark.django_db
@pytest.mark.parametrize(
    "gate_alterado,setup,esperado_start,esperado_post",
    [
        ("date_reached", "futuro", False, 409),
        ("planning_completed", "sem_marco", False, 409),
        ("previous_finalized", "anterior_nao_finalizado", False, 409),
    ],
)
def test_readiness_monthly_start_e_o_gate_real_nao_podem_divergir(
    user, gate_alterado, setup, esperado_start, esperado_post
):
    """AC4: 'um teste prova que o painel e o gate real não podem divergir
    (mesma condição → mesma resposta em GET e POST)' — molde de
    `test_readiness_start_e_o_gate_real_nao_podem_divergir` (Weekly, 14.5)."""
    with tenant_context(user):
        hoje = _current_month(user)
        if setup == "futuro":
            mes = add_months(hoje, 2)
        else:
            mes = hoje

        if setup != "anterior_nao_finalizado":
            anterior = add_months(mes, -1)
            if setup == "futuro":
                MonthlyLogFactory(user=user, month_first=anterior, status=CycleStatus.FINALIZED)
        else:
            anterior = add_months(mes, -1)
            MonthlyLogFactory(user=user, month_first=anterior, status=CycleStatus.ACTIVE)

        marco = None if setup == "sem_marco" else cal_now()
        MonthlyLogFactory(
            user=user, month_first=mes, status=CycleStatus.PLANNING, planning_completed_at=marco
        )

        readiness = monthly_cycle_readiness(user=user)
        assert readiness["start"]["gates"][gate_alterado] is esperado_start
        assert readiness["start"]["allowed"] is False

        if esperado_post == 409:
            with pytest.raises(InvalidTransition):
                start_monthly(user=user, month_first=mes)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "gate_alterado,setup",
    [
        ("no_open_tasks", "tarefa_aberta"),
        ("next_planning_exists", "sem_proxima_planning"),
    ],
)
def test_readiness_monthly_finalize_e_o_gate_real_nao_podem_divergir(user, gate_alterado, setup):
    """Mesma prova do lado de `finalize`, agora para o Monthly (AC4)."""
    with tenant_context(user):
        mes = _current_month(user)
        ativo = MonthlyLogFactory(user=user, month_first=mes, status=CycleStatus.ACTIVE)

        if setup == "tarefa_aberta":
            TaskFactory(user=user, monthly_log=ativo, status=Task.Status.PENDING)
            MonthlyLogFactory(
                user=user, month_first=add_months(mes, 1), status=CycleStatus.PLANNING
            )
        # else ("sem_proxima_planning"): nenhuma tarefa criada ⇒ `no_open_tasks`
        # satisfeito; nenhum mês seguinte em planning ⇒ `next_planning_exists`
        # falha — é o gate sob teste.

        readiness = monthly_cycle_readiness(user=user)
        assert readiness["finalize"]["gates"][gate_alterado] is False
        assert readiness["finalize"]["allowed"] is False

        with pytest.raises(InvalidTransition):
            finalize_monthly(user=user, month_first=mes)


@pytest.mark.django_db
def test_readiness_monthly_e_leitura_pura_sem_escrita_nem_get_or_create(user):
    """Zero efeito colateral: `MonthlyLog.objects.count()` inalterado e nenhum
    INSERT/UPDATE/DELETE emitido, provado no SQL (molde de `_sem_escrita`)."""
    with tenant_context(user):
        mes = _current_month(user)
        MonthlyLogFactory(
            user=user,
            month_first=mes,
            status=CycleStatus.ACTIVE,
            planning_completed_at=cal_now(),
        )
        MonthlyLogFactory(
            user=user, month_first=add_months(mes, 1), status=CycleStatus.PLANNING
        )
        antes = MonthlyLog.objects.count()

        resultado = _sem_escrita(monthly_cycle_readiness, user=user)

        assert MonthlyLog.objects.count() == antes
        assert resultado["active"]["status"] == CycleStatus.ACTIVE


# --- AC4: materialização NUNCA atribui estado ----------------------------------
@pytest.mark.django_db
def test_ac4_get_or_create_logs_nascem_fora_do_regime_operacional(user):
    with tenant_context(user):
        weekly = get_or_create_weekly_log(user=user, week_start=_current_week(user))
        monthly = get_or_create_monthly_log(user=user, month_first=_current_month(user))

        for log in (weekly, monthly):
            assert log.status is None
            assert log.planning_completed_at is None


@pytest.mark.django_db
def test_ac4_get_or_create_nao_altera_estado_de_log_preexistente(user):
    """Idempotência de materialização NÃO pode clobberar estado já conquistado pelo
    ritual — `get_or_create` reencontra o log e o devolve intacto."""
    with tenant_context(user):
        semana, mes = _current_week(user), _current_month(user)
        WeeklyLogFactory(user=user, week_start=semana, status=CycleStatus.ACTIVE)
        MonthlyLogFactory(user=user, month_first=mes, status=CycleStatus.PLANNING)

        assert get_or_create_weekly_log(user=user, week_start=semana).status == (
            CycleStatus.ACTIVE
        )
        assert get_or_create_monthly_log(user=user, month_first=mes).status == (
            CycleStatus.PLANNING
        )


@pytest.mark.django_db
def test_ac4_placement_de_recorrente_nao_altera_estado_do_container(user):
    with tenant_context(user):
        semana = _current_week(user)
        log = WeeklyLogFactory(user=user, week_start=semana, status=CycleStatus.PLANNING)
        antes = (log.status, log.planning_completed_at)
        template = RecurringTaskTemplateFactory(user=user)

        place_template(user=user, template_id=template.id, week_start=semana)

        log.refresh_from_db()
        assert (log.status, log.planning_completed_at) == antes


@pytest.mark.django_db
def test_ac4_brain_dump_nao_altera_estado_do_container(user):
    """`braindump` reaproveita `get_or_create_*` + `create_task` de `bujo` — import
    local no teste porque este arquivo é do app `bujo`."""
    from braindump.services import create_brain_dump_item, process_brain_dump_item

    with tenant_context(user):
        semana = _current_week(user)
        log = WeeklyLogFactory(user=user, week_start=semana, status=CycleStatus.ACTIVE)
        antes = (log.status, log.planning_completed_at)
        item = create_brain_dump_item(user=user, title="Ideia solta")

        process_brain_dump_item(user=user, item_id=item.id, destination="week")

        log.refresh_from_db()
        assert (log.status, log.planning_completed_at) == antes


@pytest.mark.django_db
def test_ac4_monthly_futuro_do_future_log_nao_entra_no_regime(user):
    """"Consultar qualquer mês do Futuro não cria nem inicia um Monthly Em andamento
    ou Em planejamento" (EXPERIENCE.md#Future Log)."""
    with tenant_context(user):
        futuro = add_months(_current_month(user), 6)

        log = get_or_create_monthly_log(user=user, month_first=futuro)
        create_task(user=user, monthly_log=log, title="Viagem")

        log.refresh_from_db()
        assert log.status is None
        assert log.planning_completed_at is None


@pytest.mark.django_db
def test_ac4_migracao_para_o_futuro_nao_atribui_estado(user):
    with tenant_context(user):
        futuro = add_months(_current_month(user), 3)
        task = TaskFactory(user=user, status=Task.Status.PENDING)

        migrate_task(user=user, task_id=task.id, destination="future", month_first=futuro)

        assert MonthlyLog.objects.get(month_first=futuro).status is None


# --- AC6: `finalized` é a autoridade de "ciclo fechado" ------------------------
@pytest.mark.django_db
def test_ac6_ciclo_finalized_vazio_e_readonly(user):
    """O BURACO que esta story fecha: `is_container_closed` devolve `False` para um
    ciclo sem tarefas (`total_tasks == 0`), então um ciclo finalizado e VAZIO
    continuava mutável. `is_cycle_closed` cobre o caso pelo estado explícito."""
    with tenant_context(user):
        log = WeeklyLogFactory(
            user=user, week_start=_current_week(user), status=CycleStatus.FINALIZED
        )

        assert is_container_closed(log) is False  # a derivação legada não pega
        assert is_cycle_closed(log) is True  # o estado explícito pega

        with pytest.raises(ClosedCycleReadOnly):
            create_task(user=user, weekly_log=log, title="Não deveria entrar")


@pytest.mark.django_db
@pytest.mark.parametrize("factory_cls,container_kwarg", [
    (WeeklyLogFactory, "weekly_log"),
    (MonthlyLogFactory, "monthly_log"),
])
def test_ac6_mutacoes_em_ciclo_finalized_populado_levantam(user, factory_cls, container_kwarg):
    """AC6 nomeia create/update/delete/reorder — as quatro passam pelo guardrail."""
    with tenant_context(user):
        log = factory_cls(user=user, status=None)
        primeira = TaskFactory(user=user, status=Task.Status.COMPLETED, **{container_kwarg: log})
        segunda = TaskFactory(user=user, status=Task.Status.COMPLETED, **{container_kwarg: log})
        log.status = CycleStatus.FINALIZED
        log.save(update_fields=["status"])

        with pytest.raises(ClosedCycleReadOnly):
            create_task(user=user, title="nova", **{container_kwarg: log})
        with pytest.raises(ClosedCycleReadOnly):
            update_task(user=user, task_id=primeira.id, title="editada")
        with pytest.raises(ClosedCycleReadOnly):
            delete_task(user=user, task_id=primeira.id)
        with pytest.raises(ClosedCycleReadOnly):
            reorder_task(
                user=user,
                task_id=primeira.id,
                target_task_id=segunda.id,
                position="after",
            )


@pytest.mark.django_db
def test_ac6_arquivo_devolve_uniao_dos_dois_criterios_sem_duplicar(user):
    """`list_closed_cycles` = união (`finalized` OU derivação), sem duplicata: um
    ciclo que satisfaz OS DOIS critérios aparece uma vez só."""
    with tenant_context(user):
        base = _current_week(user)

        # (a) só pela derivação legada: `NULL` com todas as tarefas dispostas.
        legado = WeeklyLogFactory(user=user, week_start=base - timedelta(days=21), status=None)
        TaskFactory(user=user, weekly_log=legado, status=Task.Status.COMPLETED)
        # (b) só pelo estado: `finalized` e vazio.
        vazio = WeeklyLogFactory(
            user=user, week_start=base - timedelta(days=14), status=CycleStatus.FINALIZED
        )
        # (c) pelos DOIS: `finalized` e com tarefas dispostas.
        ambos = WeeklyLogFactory(
            user=user, week_start=base - timedelta(days=7), status=None
        )
        TaskFactory(user=user, weekly_log=ambos, status=Task.Status.COMPLETED)
        ambos.status = CycleStatus.FINALIZED
        ambos.save(update_fields=["status"])
        # (d) nenhum dos dois: `NULL` com tarefa aberta — não entra no Arquivo.
        aberto = WeeklyLogFactory(user=user, week_start=base, status=None)
        TaskFactory(user=user, weekly_log=aberto, status=Task.Status.PENDING)

        entries = [e for e in list_closed_cycles(user=user) if e["type"] == "weekly"]
        semanas = [e["week_start"] for e in entries]

        assert sorted(semanas, reverse=True) == semanas  # mais recentes primeiro
        assert set(semanas) == {legado.week_start, vazio.week_start, ambos.week_start}
        assert len(semanas) == 3  # (c) entra UMA vez, apesar dos dois critérios
        assert aberto.week_start not in semanas


@pytest.mark.django_db
def test_ac6_log_vazio_sem_estado_continua_fora_do_arquivo(user):
    """"`total_tasks = 0` nunca conta como fechado **pela derivação**" — a regra
    antiga permanece para ciclos sem estado."""
    with tenant_context(user):
        WeeklyLogFactory(user=user, week_start=_current_week(user), status=None)

        assert list_closed_cycles(user=user) == []


@pytest.mark.django_db
@pytest.mark.parametrize("status_operacional", [CycleStatus.PLANNING, CycleStatus.ACTIVE])
def test_ac6_ciclo_no_regime_operacional_com_tudo_disposto_nao_e_readonly(
    user, status_operacional
):
    """REVISÃO 14.1: a derivação por conteúdo é o fallback dos ciclos `NULL` legados
    (AC6) — ela NÃO pode fechar um ciclo que está dentro do regime operacional.

    M06/M07 são explícitos: "Um Weekly Em planejamento permite criar, editar,
    reordenar, migrar, iniciar e concluir tarefas" e só `finalized` é readonly. Sem
    escopar a derivação, concluir a última tarefa de um alvo em planejamento (ou do
    ciclo em andamento) tornava o container readonly e o ritual travava: a próxima
    tarefa recebia 409 `ClosedCycleReadOnly`, e o ciclo aparecia no Arquivo sem
    nunca ter sido finalizado.
    """
    with tenant_context(user):
        log = WeeklyLogFactory(user=user, week_start=_current_week(user), status=None)
        TaskFactory(user=user, weekly_log=log, status=Task.Status.COMPLETED)
        log.status = status_operacional
        log.save(update_fields=["status"])

        assert is_cycle_closed(log) is False
        # a derivação continua dizendo "fechado" — o que muda é quem tem autoridade
        assert is_container_closed(log) is True
        # não entra no Arquivo: não foi finalizado por ritual
        assert list_closed_cycles(user=user) == []
        # e segue mutável
        nova = create_task(user=user, weekly_log=log, title="ainda posso planejar")
        assert nova.weekly_log_id == log.id


@pytest.mark.django_db
def test_ac6_ciclo_null_legado_com_tudo_disposto_continua_fechado_pela_derivacao(user):
    """O outro lado da mesma regra: escopar a derivação ao regime NÃO pode reduzir
    o fechamento dos ciclos legados (`status IS NULL`), que é o fallback que o AC6
    manda preservar."""
    with tenant_context(user):
        log = WeeklyLogFactory(user=user, week_start=_current_week(user), status=None)
        TaskFactory(user=user, weekly_log=log, status=Task.Status.COMPLETED)

        assert is_cycle_closed(log) is True
        assert [e["week_start"] for e in list_closed_cycles(user=user)] == [log.week_start]
        with pytest.raises(ClosedCycleReadOnly):
            create_task(user=user, weekly_log=log, title="ciclo legado fechado")


@pytest.mark.django_db
def test_ciclo_monthly_alvo_na_janela_entre_finalizar_e_iniciar_e_o_planning_existente(user):
    """REVISÃO 14.1: a ordem obrigatória do ritual mensal (finalizar exige o próximo
    já em planejamento) cria uma janela SEM `active` — e nela o alvo determinístico
    tem de continuar sendo o único `planning` que existe.

    Antes da correção, `next_monthly_target` caía na regra de usuário novo (mês
    corrente por `today_for`) e "Planejar próximo mês" respondia 409 (disputa de
    alvo, pela unique parcial) ou `InvalidTransition` (mês corrente já `finalized`)
    em vez do no-op idempotente.
    """
    with tenant_context(user):
        mes = _current_month(user)
        seguinte = add_months(mes, 1)

        open_monthly_planning_target(user=user)
        complete_monthly_planning(user=user, month_first=mes)
        start_monthly(user=user, month_first=mes)
        assert open_monthly_planning_target(user=user).month_first == seguinte
        complete_monthly_planning(user=user, month_first=seguinte)
        finalize_monthly(user=user, month_first=mes)

        # Janela: `mes` finalizado, `seguinte` em planejamento, NENHUM `active`.
        assert MonthlyLog.objects.filter(status=CycleStatus.ACTIVE).count() == 0
        assert next_monthly_target(user=user) == seguinte
        alvo = open_monthly_planning_target(user=user)
        assert (alvo.month_first, alvo.status) == (seguinte, CycleStatus.PLANNING)
        assert MonthlyLog.objects.filter(status=CycleStatus.PLANNING).count() == 1


# =============================================================================
# Story 14.2 — decisões-snapshot e fontes dos rituais
# =============================================================================
# Datas fixas (o guardrail de AST proíbe `date.today()` fora de `core/calendar`)
# e escolhidas para exercitar as regras de calendário: `_SEMANA_VIRADA` é uma
# segunda cuja semana cruza março→abril.
_SEMANA = date(2026, 3, 2)  # segunda
_SEMANA_VIRADA = date(2026, 3, 30)  # segunda; a semana vai até 2026-04-05
_MES = date(2026, 3, 1)

_ITEM_TIPOS = ("task", "template")
_ALVO_TIPOS = ("weekly", "monthly")
# As 3 células legais da matriz, na forma `(decisão, alvo, item)`.
_CELULAS_LEGAIS = {
    (RitualDecisionKind.KEEP, "weekly", "task"),
    (RitualDecisionKind.SKIP_WEEK, "weekly", "template"),
    (RitualDecisionKind.KEEP_UNDATED, "monthly", "task"),
}


def _alvos_em_planejamento(user, *, week_start=_SEMANA, month_first=_MES):
    """Weekly e Monthly do mesmo usuário, ambos em `planning`.

    Legal simultaneamente: as uniques parciais da 14.1 são por TABELA, então um
    `planning` weekly e um `planning` monthly coexistem (é o estado normal do
    método).
    """
    return (
        WeeklyLogFactory(user=user, week_start=week_start, status=CycleStatus.PLANNING),
        MonthlyLogFactory(user=user, month_first=month_first, status=CycleStatus.PLANNING),
    )


def _kwargs_da_celula(*, alvo_tipo, item_tipo, weekly, monthly, tarefa, template):
    alvo = (
        {"week_start": weekly.week_start}
        if alvo_tipo == "weekly"
        else {"month_first": monthly.month_first}
    )
    item = {"task_id": tarefa.id} if item_tipo == "task" else {"recurring_template_id": template.id}
    return {**alvo, **item}


@pytest.mark.django_db
@pytest.mark.parametrize(
    "decisao,alvo_tipo,item_tipo",
    list(itertools.product(list(RitualDecisionKind.values), _ALVO_TIPOS, _ITEM_TIPOS)),
)
def test_ritual_decisao_matriz_completa(user, decisao, alvo_tipo, item_tipo):
    """AC2: matriz exaustiva 3 × 2 × 2 = 12 células — 3 legais, 9 ilegais.

    Célula ilegal levanta `InvalidRitualDecision` **e não persiste** (o assert de
    contagem é o que impede um "levantou depois de escrever" passar batido).
    """
    with tenant_context(user):
        weekly, monthly = _alvos_em_planejamento(user)
        tarefa = TaskFactory(user=user, weekly_log=weekly)
        template = RecurringTaskTemplateFactory(user=user)
        kwargs = _kwargs_da_celula(
            alvo_tipo=alvo_tipo,
            item_tipo=item_tipo,
            weekly=weekly,
            monthly=monthly,
            tarefa=tarefa,
            template=template,
        )

        legal = (decisao, alvo_tipo, item_tipo) in _CELULAS_LEGAIS
        if legal:
            registro = upsert_ritual_decision(user=user, decision=decisao, **kwargs)
            assert registro.decision == decisao
            assert RitualDecision.objects.count() == 1
        else:
            with pytest.raises(InvalidRitualDecision):
                upsert_ritual_decision(user=user, decision=decisao, **kwargs)
            assert RitualDecision.objects.count() == 0


@pytest.mark.django_db
def test_ritual_decisao_matriz_cobre_as_tres_celulas_legais(user):
    """Guarda a própria matriz: `ALLOWED_DECISIONS` tem exatamente 3 entradas, uma
    por valor do enum. Um 4º par (ex.: `(monthly, template)`, o "Não alocar neste
    mês" que M07 proíbe para anual) quebraria aqui antes de chegar à API."""
    assert set(ALLOWED_DECISIONS) == set(RitualDecisionKind.values)
    assert set(ALLOWED_DECISIONS.values()) == {
        ("weekly", "task"),
        ("weekly", "template"),
        ("monthly", "task"),
    }


@pytest.mark.django_db
def test_ritual_decisao_exige_exatamente_um_alvo_e_um_item(user):
    """A validação de forma acontece ANTES de tocar o banco (o CHECK é rede)."""
    with tenant_context(user):
        weekly, monthly = _alvos_em_planejamento(user)
        tarefa = TaskFactory(user=user, weekly_log=weekly)
        template = RecurringTaskTemplateFactory(user=user)
        formas_invalidas = [
            {"task_id": tarefa.id},  # nenhum alvo
            {
                "week_start": weekly.week_start,
                "month_first": monthly.month_first,
                "task_id": tarefa.id,
            },  # dois alvos
            {"week_start": weekly.week_start},  # nenhum item
            {
                "week_start": weekly.week_start,
                "task_id": tarefa.id,
                "recurring_template_id": template.id,
            },  # dois itens
        ]
        for kwargs in formas_invalidas:
            with pytest.raises(InvalidRitualDecision):
                upsert_ritual_decision(user=user, decision=RitualDecisionKind.KEEP, **kwargs)
        assert RitualDecision.objects.count() == 0


@pytest.mark.django_db
@pytest.mark.parametrize(
    "status_do_alvo", [None, CycleStatus.ACTIVE, CycleStatus.FINALIZED, CycleStatus.PLANNING]
)
def test_ritual_decisao_exige_alvo_em_planejamento(user, status_do_alvo):
    """AC2: decisão-snapshot é ato de RITUAL, e o ritual só existe no alvo em
    planejamento. Só `planning` passa; os outros três regimes são 409."""
    with tenant_context(user):
        weekly = WeeklyLogFactory(user=user, week_start=_SEMANA, status=status_do_alvo)
        tarefa = TaskFactory(user=user, weekly_log=weekly)
        chamada = dict(
            user=user,
            decision=RitualDecisionKind.KEEP,
            week_start=_SEMANA,
            task_id=tarefa.id,
        )
        if status_do_alvo == CycleStatus.PLANNING:
            assert upsert_ritual_decision(**chamada).weekly_log_id == weekly.id
        else:
            with pytest.raises(InvalidTransition):
                upsert_ritual_decision(**chamada)
            assert RitualDecision.objects.count() == 0


@pytest.mark.django_db
def test_ritual_decisao_alvo_inexistente_e_409_e_nao_materializa(user):
    """Alvo que nunca foi materializado conta como `status = None` — e consultar
    NÃO pode criar o log (guardrail da AC4 da 14.1, do lado da escrita)."""
    with tenant_context(user):
        outro_weekly = WeeklyLogFactory(user=user, week_start=_SEMANA, status=CycleStatus.PLANNING)
        tarefa = TaskFactory(user=user, weekly_log=outro_weekly)
        semana_sem_log = _SEMANA + timedelta(weeks=4)

        with pytest.raises(InvalidTransition):
            upsert_ritual_decision(
                user=user,
                decision=RitualDecisionKind.KEEP,
                week_start=semana_sem_log,
                task_id=tarefa.id,
            )
        assert not WeeklyLog.objects.filter(week_start=semana_sem_log).exists()


@pytest.mark.django_db
def test_ritual_decisao_item_de_outro_tenant_e_indistinguivel_de_inexistente(user, other_user):
    """A mensagem é NEUTRA de propósito: revelar "não existe" vs. "existe mas não é
    seu" vazaria a presença de linha alheia."""
    with tenant_context(other_user):
        alheia = TaskFactory(user=other_user)
    with tenant_context(user):
        WeeklyLogFactory(user=user, week_start=_SEMANA, status=CycleStatus.PLANNING)
        with pytest.raises(InvalidRitualDecision) as alheio:
            upsert_ritual_decision(
                user=user,
                decision=RitualDecisionKind.KEEP,
                week_start=_SEMANA,
                task_id=alheia.id,
            )
        with pytest.raises(InvalidRitualDecision) as inexistente:
            upsert_ritual_decision(
                user=user,
                decision=RitualDecisionKind.KEEP,
                week_start=_SEMANA,
                task_id="00000000-0000-0000-0000-000000000000",
            )
        assert str(alheio.value) == str(inexistente.value)


@pytest.mark.django_db
def test_ritual_decisao_upsert_e_idempotente_sem_escrita(user):
    """AC2: re-executar com a mesma tupla NÃO escreve — provado em SQL com
    `_sem_escrita` (criado na review da 14.1), não por comparação de retorno."""
    with tenant_context(user):
        weekly, monthly = _alvos_em_planejamento(user)
        tarefa = TaskFactory(user=user, weekly_log=weekly)
        template = RecurringTaskTemplateFactory(user=user)
        tarefa_mensal = TaskFactory(user=user, monthly_log=monthly)

        chamadas = [
            dict(decision=RitualDecisionKind.KEEP, week_start=_SEMANA, task_id=tarefa.id),
            dict(
                decision=RitualDecisionKind.SKIP_WEEK,
                week_start=_SEMANA,
                recurring_template_id=template.id,
            ),
            dict(
                decision=RitualDecisionKind.KEEP_UNDATED,
                month_first=_MES,
                task_id=tarefa_mensal.id,
            ),
        ]
        for chamada in chamadas:
            primeiro = upsert_ritual_decision(user=user, **chamada)
            timbre = primeiro.updated_at
            segundo = _sem_escrita(upsert_ritual_decision, user=user, **chamada)
            assert segundo.id == primeiro.id
            # `updated_at` intacto: `auto_now` só se move num `save()` de verdade,
            # então este assert é a segunda prova (independente do SQL) de no-op.
            assert segundo.updated_at == timbre
        assert RitualDecision.objects.count() == 3


@pytest.mark.django_db
def test_ritual_decisao_jamais_toca_o_item(user):
    """AD-28 item 6 ponto 8: "A Task jamais é tocada por uma decisão-snapshot".

    Snapshot de TODOS os campos concretos (não só `status`): um `save()` acidental
    de `updated_at`, `order_index` ou `scheduled_date` também é "tocar".
    """

    def instantaneo(instancia):
        instancia.refresh_from_db()
        return {
            campo.attname: getattr(instancia, campo.attname)
            for campo in instancia._meta.concrete_fields
        }

    with tenant_context(user):
        weekly = WeeklyLogFactory(user=user, week_start=_SEMANA, status=CycleStatus.PLANNING)
        tarefa = TaskFactory(user=user, weekly_log=weekly, scheduled_date=_SEMANA)
        template = RecurringTaskTemplateFactory(user=user)
        antes_tarefa, antes_template = instantaneo(tarefa), instantaneo(template)

        upsert_ritual_decision(
            user=user, decision=RitualDecisionKind.KEEP, week_start=_SEMANA, task_id=tarefa.id
        )
        upsert_ritual_decision(
            user=user,
            decision=RitualDecisionKind.SKIP_WEEK,
            week_start=_SEMANA,
            recurring_template_id=template.id,
        )

        assert instantaneo(tarefa) == antes_tarefa
        assert instantaneo(template) == antes_template


@pytest.mark.django_db
def test_ritual_decisao_some_com_o_item_por_cascade(user):
    """As FKs são `CASCADE`: apagar a Task (hard delete de `pending`) ou o
    template leva a decisão embora — nunca sobra decisão órfã apontando para um
    item que não existe mais."""
    with tenant_context(user):
        weekly = WeeklyLogFactory(user=user, week_start=_SEMANA, status=CycleStatus.PLANNING)
        tarefa = TaskFactory(user=user, weekly_log=weekly)
        template = RecurringTaskTemplateFactory(user=user)
        upsert_ritual_decision(
            user=user, decision=RitualDecisionKind.KEEP, week_start=_SEMANA, task_id=tarefa.id
        )
        upsert_ritual_decision(
            user=user,
            decision=RitualDecisionKind.SKIP_WEEK,
            week_start=_SEMANA,
            recurring_template_id=template.id,
        )
        assert RitualDecision.objects.count() == 2

        delete_task(user=user, task_id=tarefa.id)  # hard delete: a tarefa é `pending`
        assert RitualDecision.objects.filter(task__isnull=False).count() == 0

        template.delete()
        assert RitualDecision.objects.count() == 0


# --- fontes do ritual SEMANAL (AC3/AC5) ----------------------------------------
@pytest.mark.django_db
def test_fonte_monthly_na_semana_traz_os_dois_monthly_na_virada(user):
    """AC3 fonte 1: "incluindo **ambos** os Monthly quando a semana cruza meses".

    A semana de 2026-03-30 vai até 2026-04-05, então `months_of_week` devolve
    março E abril — e uma implementação que olhasse só o mês do `week_start`
    perderia a tarefa de abril.
    """
    with tenant_context(user):
        WeeklyLogFactory(user=user, week_start=_SEMANA_VIRADA, status=CycleStatus.PLANNING)
        marco = MonthlyLogFactory(user=user, month_first=date(2026, 3, 1))
        abril = MonthlyLogFactory(user=user, month_first=date(2026, 4, 1))
        TaskFactory(user=user, monthly_log=marco, scheduled_date=date(2026, 3, 31))
        TaskFactory(user=user, monthly_log=abril, scheduled_date=date(2026, 4, 2))
        # Fora da janela: mesmo Monthly, dia depois do domingo da semana-alvo.
        TaskFactory(user=user, monthly_log=abril, scheduled_date=date(2026, 4, 6))
        # Fora por status (não é `pending`/`started`).
        TaskFactory(
            user=user,
            monthly_log=marco,
            scheduled_date=date(2026, 3, 30),
            status=Task.Status.COMPLETED,
        )

        fonte = list_monthly_tasks_in_week(user=user, week_start=_SEMANA_VIRADA)

        assert fonte["source_id"] == "monthly-in-week"
        assert fonte["blocking"] is False
        assert fonte["counts_toward_progress"] is True
        assert [item["task"].scheduled_date for item in fonte["items"]] == [
            date(2026, 3, 31),
            date(2026, 4, 2),
        ]
        assert fonte["eligible_count"] == 2
        assert fonte["pending_decision_count"] == 2
        assert fonte["reviewed"] is False


@pytest.mark.django_db
def test_fonte_monthly_na_semana_keep_zera_pendencia_sem_mudar_elegibilidade(user):
    """AC5: `keep` retira o item de `pendingDecisionCount` MAS ele continua
    elegível e listado — decisão-snapshot não remove nada da fonte."""
    with tenant_context(user):
        WeeklyLogFactory(user=user, week_start=_SEMANA, status=CycleStatus.PLANNING)
        mes = MonthlyLogFactory(user=user, month_first=_MES)
        tarefa = TaskFactory(user=user, monthly_log=mes, scheduled_date=_SEMANA)

        upsert_ritual_decision(
            user=user, decision=RitualDecisionKind.KEEP, week_start=_SEMANA, task_id=tarefa.id
        )
        fonte = list_monthly_tasks_in_week(user=user, week_start=_SEMANA)

        assert fonte["eligible_count"] == 1
        assert fonte["pending_decision_count"] == 0
        assert fonte["reviewed"] is True
        assert fonte["items"][0]["decision"] == RitualDecisionKind.KEEP


@pytest.mark.django_db
def test_fonte_recorrentes_semanais_ordem_alfabetica_e_already_placed_fora_do_progresso(user):
    """AC3 fonte 3 + AC5: `alreadyPlaced` sai do denominador (bucket com
    `countsTowardProgress: False`) e continua consultável."""
    with tenant_context(user):
        WeeklyLogFactory(user=user, week_start=_SEMANA, status=CycleStatus.PLANNING)
        zeta = RecurringTaskTemplateFactory(user=user, recurrence_text="zelar pelas plantas")
        alfa = RecurringTaskTemplateFactory(user=user, recurrence_text="acordar cedo")
        colocado = RecurringTaskTemplateFactory(user=user, recurrence_text="mercado")
        inativo = RecurringTaskTemplateFactory(user=user, recurrence_text="antigo", active=False)
        mensal = RecurringTaskTemplateFactory(
            user=user,
            recurrence_text="pagar contas",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.MONTHLY,
        )
        place_template(user=user, template_id=colocado.id, week_start=_SEMANA)

        fonte = list_weekly_recurring_candidates(user=user, week_start=_SEMANA)

        assert [item["template"].id for item in fonte["items"]] == [alfa.id, zeta.id]
        assert inativo.id not in {item["template"].id for item in fonte["items"]}
        assert mensal.id not in {item["template"].id for item in fonte["items"]}
        assert [item["template"].id for item in fonte["already_placed"]["items"]] == [colocado.id]
        assert fonte["already_placed"]["counts_toward_progress"] is False
        assert fonte["eligible_count"] == 2  # o já alocado NÃO entra no denominador
        assert fonte["pending_decision_count"] == 2


@pytest.mark.django_db
def test_fonte_recorrentes_skip_week_sai_da_pendencia_sem_desativar_o_template(user):
    """AC3 fonte 3, literal do M06: "Não alocar nesta semana **remove o aviso sem
    desativar o template**" — e sem criar nenhuma Task."""
    with tenant_context(user):
        WeeklyLogFactory(user=user, week_start=_SEMANA, status=CycleStatus.PLANNING)
        template = RecurringTaskTemplateFactory(user=user, recurrence_text="regar")
        tarefas_antes = Task.objects.count()

        upsert_ritual_decision(
            user=user,
            decision=RitualDecisionKind.SKIP_WEEK,
            week_start=_SEMANA,
            recurring_template_id=template.id,
        )
        fonte = list_weekly_recurring_candidates(user=user, week_start=_SEMANA)

        template.refresh_from_db()
        assert template.active is True  # não desativado
        assert Task.objects.count() == tarefas_antes  # NENHUMA Task nasce
        assert fonte["items"][0]["decision"] == RitualDecisionKind.SKIP_WEEK
        assert fonte["eligible_count"] == 1
        assert fonte["pending_decision_count"] == 0
        assert fonte["reviewed"] is True


@pytest.mark.django_db
def test_fonte_recorrentes_semanais_exclui_o_template_excluido_de_items_E_de_already_placed(user):
    """AC2 ponto 2 (Story 14.4): "some da biblioteca **e das fontes dos rituais**".

    Os DOIS buckets são cobertos de uma vez porque `live_templates` entra na
    ORIGEM da queryset, antes de `_partition_by_placement` — que parte a mesma
    queryset. O excluído de `already_placed` tem instância semeada no alvo, senão
    o bucket estaria vazio por acidente e o assert seria vacuoso; e cada bucket
    tem um template VIVO ao lado, para o assert comparar CONJUNTO DE IDS em vez
    de `len(...) == 0` (achado B1 da 14.2).
    """
    with tenant_context(user):
        WeeklyLogFactory(user=user, week_start=_SEMANA, status=CycleStatus.PLANNING)
        vivo_pendente = RecurringTaskTemplateFactory(user=user, recurrence_text="regar")
        vivo_alocado = RecurringTaskTemplateFactory(user=user, recurrence_text="mercado")
        excluido_pendente = RecurringTaskTemplateFactory(user=user, recurrence_text="antigo")
        excluido_alocado = RecurringTaskTemplateFactory(user=user, recurrence_text="obsoleto")
        place_template(user=user, template_id=vivo_alocado.id, week_start=_SEMANA)
        place_template(user=user, template_id=excluido_alocado.id, week_start=_SEMANA)
        soft_delete_template(user=user, template_id=excluido_pendente.id)
        soft_delete_template(user=user, template_id=excluido_alocado.id)

        fonte = list_weekly_recurring_candidates(user=user, week_start=_SEMANA)

        assert {item["template"].id for item in fonte["items"]} == {vivo_pendente.id}
        assert {item["template"].id for item in fonte["already_placed"]["items"]} == {
            vivo_alocado.id
        }
        assert fonte["eligible_count"] == 1


@pytest.mark.django_db
def test_fonte_recorrentes_mensais_exclui_o_excluido_das_TRES_saidas(user):
    """AC2 pontos 3 e 4: `monthly`, `annual_eligible` e `already_placed_in_year`
    derivam das duas mesmas querysets — filtrar na ORIGEM (achado A1 da 14.2:
    invariante por construção, não filtro colado em cada saída) cobre as três.

    Cada saída tem um vivo ao lado do excluído, então nenhum assert é vacuoso.
    """
    with tenant_context(user):
        MonthlyLogFactory(user=user, month_first=_MES, status=CycleStatus.PLANNING)
        Group = RecurringTaskTemplate.RecurrenceGroup
        mensal_vivo = RecurringTaskTemplateFactory(
            user=user, recurrence_text="aluguel", recurrence_group=Group.MONTHLY
        )
        mensal_excluido = RecurringTaskTemplateFactory(
            user=user, recurrence_text="assinatura cancelada", recurrence_group=Group.MONTHLY
        )
        anual_vivo = RecurringTaskTemplateFactory(
            user=user, recurrence_text="aniversário", recurrence_group=Group.ANNUAL
        )
        anual_excluido = RecurringTaskTemplateFactory(
            user=user, recurrence_text="evento extinto", recurrence_group=Group.ANNUAL
        )
        anual_no_ano_vivo = RecurringTaskTemplateFactory(
            user=user, recurrence_text="checkup", recurrence_group=Group.ANNUAL
        )
        anual_no_ano_excluido = RecurringTaskTemplateFactory(
            user=user, recurrence_text="revisão extinta", recurrence_group=Group.ANNUAL
        )
        place_template(user=user, template_id=anual_no_ano_vivo.id, month_first=_MES)
        place_template(user=user, template_id=anual_no_ano_excluido.id, month_first=_MES)
        for excluido in (mensal_excluido, anual_excluido, anual_no_ano_excluido):
            soft_delete_template(user=user, template_id=excluido.id)

        fonte = list_monthly_recurring_candidates(user=user, month_first=_MES)

        # `items` = mensais pendentes + anuais elegíveis (as duas primeiras saídas)
        assert [item["template"].id for item in fonte["items"]] == [
            mensal_vivo.id,
            anual_vivo.id,
        ]
        # 3ª saída: a elegibilidade anual JÁ RESOLVIDA no ano do alvo
        assert {item["template"].id for item in fonte["already_placed_in_year"]["items"]} == {
            anual_no_ano_vivo.id
        }
        assert fonte["eligible_count"] == 2


@pytest.mark.django_db
def test_upsert_ritual_decision_skip_week_sobre_template_excluido_levanta_invalid_ritual_decision(
    user,
):
    """AC2 ponto 7 — o ponto que herda o filtro DE GRAÇA: com `live_templates()`
    no lookup do item, um template excluído cai no caminho `item is None` que já
    existia e devolve `InvalidRitualDecision` com a mensagem NEUTRA (409), sem
    exceção nova e sem mensagem nova. O alvo está em `planning` de propósito: o
    teste tem de morrer no item, não no gate de ciclo."""
    with tenant_context(user):
        WeeklyLogFactory(user=user, week_start=_SEMANA, status=CycleStatus.PLANNING)
        template = RecurringTaskTemplateFactory(user=user, recurrence_text="regar", deleted=True)

        with pytest.raises(InvalidRitualDecision):
            upsert_ritual_decision(
                user=user,
                decision=RitualDecisionKind.SKIP_WEEK,
                week_start=_SEMANA,
                recurring_template_id=template.id,
            )

        assert RitualDecision.objects.count() == 0


@pytest.mark.django_db
def test_fonte_recorrentes_permite_multiplas_instancias_no_mesmo_dia(user):
    """"Múltiplas instâncias por template" (AD-08/M09): nenhuma constraint de
    template × dia nem × alvo. Duas instâncias no MESMO dia são legais, e o
    `instancesInTargetCount` as conta."""
    with tenant_context(user):
        WeeklyLogFactory(user=user, week_start=_SEMANA, status=CycleStatus.PLANNING)
        template = RecurringTaskTemplateFactory(user=user, recurrence_text="treinar")
        for _ in range(2):
            place_template(
                user=user, template_id=template.id, week_start=_SEMANA, scheduled_date=_SEMANA
            )

        fonte = list_weekly_recurring_candidates(user=user, week_start=_SEMANA)

        assert fonte["items"] == []
        assert fonte["already_placed"]["items"][0]["instances_in_target_count"] == 2


@pytest.mark.django_db
def test_fonte_weekly_anterior_usa_o_anterior_OPERACIONAL_ignorando_ciclos_null(user):
    """AC3 fonte 4: o log anterior vem do mesmo predicado do gate de `start_weekly`.

    Com um ciclo `NULL` na semana imediatamente anterior e um `active` duas
    semanas atrás, "anterior" é o `active` — nunca `week_start − 7 dias`. Se a
    fonte divergisse do gate, a UI diria "pronta para finalizar" enquanto Iniciar
    responderia 409.
    """
    with tenant_context(user):
        alvo = _SEMANA + timedelta(weeks=2)
        WeeklyLogFactory(user=user, week_start=alvo, status=CycleStatus.PLANNING)
        intermediario = WeeklyLogFactory(user=user, week_start=_SEMANA + timedelta(weeks=1))
        operacional = WeeklyLogFactory(user=user, week_start=_SEMANA, status=CycleStatus.ACTIVE)
        TaskFactory(user=user, weekly_log=intermediario, title="do ciclo NULL")
        TaskFactory(user=user, weekly_log=operacional, title="do ciclo operacional")

        fonte = list_previous_weekly_pendings(user=user, week_start=alvo)

        assert [item["task"].title for item in fonte["items"]] == ["do ciclo operacional"]
        assert fonte["blocking"] is True
        assert fonte["ready_to_finalize"] is False
        assert fonte["reviewed"] is False


@pytest.mark.django_db
def test_fonte_weekly_anterior_previous_period_start_ignora_ciclo_null_intermediario(user):
    """Story 14.5, AC4: `previousPeriodStart` é a chave do anterior OPERACIONAL,
    nunca `week_start − 7 dias` — o mesmo cenário do teste acima (ciclo `NULL`
    entre o alvo e o `active`) prova que a aritmética erraria o alvo."""
    with tenant_context(user):
        alvo = _SEMANA + timedelta(weeks=2)
        WeeklyLogFactory(user=user, week_start=alvo, status=CycleStatus.PLANNING)
        WeeklyLogFactory(user=user, week_start=_SEMANA + timedelta(weeks=1))  # ciclo NULL
        operacional = WeeklyLogFactory(user=user, week_start=_SEMANA, status=CycleStatus.ACTIVE)

        fonte = list_previous_weekly_pendings(user=user, week_start=alvo)

        assert fonte["previous_period_start"] == operacional.week_start
        assert fonte["previous_period_start"] != alvo - timedelta(days=7)  # `weekStart - 7` erraria


@pytest.mark.django_db
def test_fonte_weekly_anterior_ausente_previous_period_start_e_none(user):
    with tenant_context(user):
        WeeklyLogFactory(user=user, week_start=_SEMANA, status=CycleStatus.PLANNING)

        fonte = list_previous_weekly_pendings(user=user, week_start=_SEMANA)

        assert fonte["previous_period_start"] is None


@pytest.mark.django_db
def test_fonte_monthly_anterior_previous_period_start_usa_month_first(user):
    """Gêmea mensal: a mesma mecânica (`_blocking_previous_source`) devolve
    `previousPeriodStart` como `month_first`, não `week_start`."""
    with tenant_context(user):
        alvo = date(_MES.year, _MES.month, 1) + timedelta(days=62)
        alvo = alvo.replace(day=1)
        MonthlyLogFactory(user=user, month_first=alvo, status=CycleStatus.PLANNING)
        anterior = MonthlyLogFactory(user=user, month_first=_MES, status=CycleStatus.ACTIVE)

        fonte = list_previous_monthly_pendings(user=user, month_first=alvo)

        assert fonte["previous_period_start"] == anterior.month_first


@pytest.mark.django_db
def test_fonte_weekly_anterior_ready_to_finalize_quando_zera(user):
    """AC3: "Ao zerar, mostra Semana anterior pronta para finalizar"."""
    with tenant_context(user):
        alvo = _SEMANA + timedelta(weeks=1)
        WeeklyLogFactory(user=user, week_start=alvo, status=CycleStatus.PLANNING)
        anterior = WeeklyLogFactory(user=user, week_start=_SEMANA, status=CycleStatus.ACTIVE)
        TaskFactory(user=user, weekly_log=anterior, status=Task.Status.COMPLETED)

        fonte = list_previous_weekly_pendings(user=user, week_start=alvo)

        assert fonte["items"] == []
        assert fonte["reviewed"] is True  # vazio é revisado
        assert fonte["ready_to_finalize"] is True


@pytest.mark.django_db
def test_fonte_weekly_anterior_ausente_e_vazia_e_nao_pronta(user):
    """AC3: anterior ausente ⇒ fonte vazia, `blocking: true`,
    `readyToFinalize: false` — o gate de Iniciar passa por vacuidade (AC7 da
    14.1), mas não há "mês/semana anterior" a finalizar."""
    with tenant_context(user):
        WeeklyLogFactory(user=user, week_start=_SEMANA, status=CycleStatus.PLANNING)

        fonte = list_previous_weekly_pendings(user=user, week_start=_SEMANA)

        assert fonte["items"] == []
        assert fonte["blocking"] is True
        assert fonte["reviewed"] is True
        assert fonte["ready_to_finalize"] is False


@pytest.mark.django_db
def test_fonte_weekly_anterior_ignora_decisao_snapshot_gravada_no_log_anterior(user):
    """AC3 fonte 4 + AC5: a fonte bloqueante NÃO oferece decisão-snapshot (M06:
    "não oferece 'manter'"), então `pendingDecisionCount == eligibleCount` sempre.

    O caso que prova a construção em vez da coincidência: a matriz de
    `upsert_ritual_decision` casa só *tipos* de alvo e item, então `keep` é aceito
    sobre uma Task ancorada no PRÓPRIO weekly enquanto ele é o `planning`. Se a
    fonte lesse as decisões do log anterior, aquele item sairia da pendência,
    `reviewed` viraria `True` com tarefa aberta de pé, e a UI ofereceria "pronta
    para finalizar" enquanto Iniciar responderia 409.
    """
    with tenant_context(user):
        anterior = WeeklyLogFactory(user=user, week_start=_SEMANA, status=CycleStatus.PLANNING)
        tarefa = TaskFactory(user=user, weekly_log=anterior, title="aberta na semana anterior")
        upsert_ritual_decision(
            user=user, decision=RitualDecisionKind.KEEP, week_start=_SEMANA, task_id=tarefa.id
        )
        # O anterior sai de `planning` e passa a ser o operacional do alvo seguinte.
        anterior.status = CycleStatus.ACTIVE
        anterior.save(update_fields=["status"])
        alvo = _SEMANA + timedelta(weeks=1)
        WeeklyLogFactory(user=user, week_start=alvo, status=CycleStatus.PLANNING)

        fonte = list_previous_weekly_pendings(user=user, week_start=alvo)

        assert [item["task"].title for item in fonte["items"]] == ["aberta na semana anterior"]
        assert fonte["items"][0]["decision"] is None
        assert fonte["pending_decision_count"] == fonte["eligible_count"] == 1
        assert fonte["reviewed"] is False  # a pendência só sai por MUTAÇÃO
        assert fonte["ready_to_finalize"] is False


@pytest.mark.django_db
def test_fonte_daily_pendentes_agrupa_por_data_do_mais_antigo_ao_mais_recente(user):
    """AC3 fonte 5: agrupados por data, ordem CRESCENTE, e a fronteira
    `log_date < weekStart` (ambiguidade #1) exclui os dias da semana-alvo."""
    with tenant_context(user):
        WeeklyLogFactory(user=user, week_start=_SEMANA, status=CycleStatus.PLANNING)
        recente = LogFactory(user=user, log_date=_SEMANA - timedelta(days=1))
        antigo = LogFactory(user=user, log_date=_SEMANA - timedelta(days=10))
        dentro_da_semana = LogFactory(user=user, log_date=_SEMANA + timedelta(days=1))
        resolvido = LogFactory(user=user, log_date=_SEMANA - timedelta(days=5))
        TaskFactory(user=user, log=recente, title="recente")
        TaskFactory(user=user, log=antigo, title="antigo")
        TaskFactory(user=user, log=dentro_da_semana, title="dentro da semana-alvo")
        TaskFactory(user=user, log=resolvido, status=Task.Status.COMPLETED)

        fonte = list_pending_daily_groups(user=user, week_start=_SEMANA)

        assert [grupo["date"] for grupo in fonte["groups"]] == [
            _SEMANA - timedelta(days=10),
            _SEMANA - timedelta(days=1),
        ]
        assert [grupo["items"][0]["task"].title for grupo in fonte["groups"]] == [
            "antigo",
            "recente",
        ]
        assert "items" not in fonte  # esta fonte serializa `groups`, não `items`
        assert fonte["eligible_count"] == 2
        assert fonte["blocking"] is False


@pytest.mark.django_db
def test_fonte_daily_pendentes_vazia_e_revisada(user):
    """AC5: "vazio é revisado" (M06/M07) — a fonte sem itens não trava progresso."""
    with tenant_context(user):
        WeeklyLogFactory(user=user, week_start=_SEMANA, status=CycleStatus.PLANNING)

        fonte = list_pending_daily_groups(user=user, week_start=_SEMANA)

        assert fonte["groups"] == []
        assert fonte["eligible_count"] == 0
        assert fonte["pending_decision_count"] == 0
        assert fonte["reviewed"] is True


# --- fontes do ritual MENSAL (AC4/AC5) -----------------------------------------
@pytest.mark.django_db
def test_fonte_recorrentes_mensais_ordem_mensal_depois_anual(user):
    """AC4 fonte 1: "templates `monthly` ativos **primeiro**, depois `annual`"."""
    with tenant_context(user):
        MonthlyLogFactory(user=user, month_first=_MES, status=CycleStatus.PLANNING)
        anual = RecurringTaskTemplateFactory(
            user=user,
            recurrence_text="aniversário",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.ANNUAL,
        )
        mensal_z = RecurringTaskTemplateFactory(
            user=user,
            recurrence_text="zerar planilha",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.MONTHLY,
        )
        mensal_a = RecurringTaskTemplateFactory(
            user=user,
            recurrence_text="aluguel",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.MONTHLY,
        )
        RecurringTaskTemplateFactory(user=user, recurrence_text="semanal ignorado")

        fonte = list_monthly_recurring_candidates(user=user, month_first=_MES)

        # Mensais em ordem alfabética primeiro, o anual depois — mesmo que
        # "aniversário" viesse antes de "aluguel" numa ordenação global.
        assert [item["template"].id for item in fonte["items"]] == [
            mensal_a.id,
            mensal_z.id,
            anual.id,
        ]
        assert fonte["eligible_count"] == 3
        # Nenhuma decisão-snapshot existe nesta fonte (a matriz não tem célula
        # `(monthly, template)`): "Não existe 'Não alocar neste mês' para anual".
        assert all(item["decision"] is None for item in fonte["items"])


@pytest.mark.django_db
def test_fonte_recorrentes_mensais_anual_com_instancia_em_mes_FUTURO_do_ano_sai_da_elegibilidade(
    user,
):
    """AC4: a elegibilidade anual é por ANO do alvo, não por mês — é o caso que
    prova "sem parsing de `recurrence_text`".

    O anual foi alocado em NOVEMBRO; o alvo é MARÇO. Ele sai da elegibilidade de
    março porque já tem destino no ano, e vai para `alreadyPlacedInYear` — fora do
    progresso e dos avisos (M07 L301). Uma implementação que olhasse "instância no
    mês-alvo" o manteria pendente para sempre.
    """
    with tenant_context(user):
        MonthlyLogFactory(user=user, month_first=_MES, status=CycleStatus.PLANNING)
        anual_alocado = RecurringTaskTemplateFactory(
            user=user,
            recurrence_text="revisão anual",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.ANNUAL,
        )
        anual_livre = RecurringTaskTemplateFactory(
            user=user,
            recurrence_text="seguro do carro",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.ANNUAL,
        )
        place_template(
            user=user, template_id=anual_alocado.id, month_first=date(2026, 11, 1)
        )
        # Ano DIFERENTE não resolve a pendência do ano-alvo.
        place_template(user=user, template_id=anual_livre.id, month_first=date(2027, 5, 1))

        fonte = list_monthly_recurring_candidates(user=user, month_first=_MES)

        assert [item["template"].id for item in fonte["items"]] == [anual_livre.id]
        assert [item["template"].id for item in fonte["already_placed_in_year"]["items"]] == [
            anual_alocado.id
        ]
        assert fonte["already_placed_in_year"]["counts_toward_progress"] is False
        assert fonte["eligible_count"] == 1


@pytest.mark.django_db
def test_fonte_recorrentes_mensais_regra_de_dezembro_e_emergente(user):
    """AC4: "em dezembro somente o próprio mês-alvo resolve a pendência anual" —
    **sem nenhum código especial de dezembro**.

    Teste-âncora da dedução: com alvo em dezembro não existe mês posterior dentro
    do mesmo ano, então a única alocação que tira o anual da fonte é a que cai no
    próprio dezembro. O teste prova as duas metades: alocar em dezembro resolve;
    alocar em janeiro do ano SEGUINTE não resolve.
    """
    with tenant_context(user):
        dezembro = date(2026, 12, 1)
        MonthlyLogFactory(user=user, month_first=dezembro, status=CycleStatus.PLANNING)
        no_proprio_dezembro = RecurringTaskTemplateFactory(
            user=user,
            recurrence_text="balanço do ano",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.ANNUAL,
        )
        no_ano_seguinte = RecurringTaskTemplateFactory(
            user=user,
            recurrence_text="checkup",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.ANNUAL,
        )
        place_template(user=user, template_id=no_proprio_dezembro.id, month_first=dezembro)
        place_template(user=user, template_id=no_ano_seguinte.id, month_first=date(2027, 1, 1))

        fonte = list_monthly_recurring_candidates(user=user, month_first=dezembro)

        assert [item["template"].id for item in fonte["items"]] == [no_ano_seguinte.id]
        assert [item["template"].id for item in fonte["already_placed_in_year"]["items"]] == [
            no_proprio_dezembro.id
        ]


@pytest.mark.django_db
def test_fonte_recorrentes_mensais_already_placed_no_alvo_fora_do_progresso(user):
    """AC4: `alreadyPlaced` (mensal com instância NO alvo) fica fora do progresso e
    continua consultável — a primeira instância resolve a pendência do ciclo."""
    with tenant_context(user):
        MonthlyLogFactory(user=user, month_first=_MES, status=CycleStatus.PLANNING)
        colocado = RecurringTaskTemplateFactory(
            user=user,
            recurrence_text="pagar aluguel",
            recurrence_group=RecurringTaskTemplate.RecurrenceGroup.MONTHLY,
        )
        place_template(user=user, template_id=colocado.id, month_first=_MES)

        fonte = list_monthly_recurring_candidates(user=user, month_first=_MES)

        assert fonte["items"] == []
        assert [item["template"].id for item in fonte["already_placed"]["items"]] == [colocado.id]
        assert fonte["already_placed"]["counts_toward_progress"] is False
        assert fonte["eligible_count"] == 0
        assert fonte["reviewed"] is True


@pytest.mark.django_db
def test_fonte_future_log_ordena_dia_depois_sem_dia_e_aceita_keep_undated(user):
    """AC4 fonte 2: raízes do monthly-alvo, ordenadas dia → sem-dia (M08), com
    `keep_undated` retirando o item da pendência sem mudar a Task."""
    with tenant_context(user):
        mes = MonthlyLogFactory(user=user, month_first=_MES, status=CycleStatus.PLANNING)
        sem_dia = TaskFactory(user=user, monthly_log=mes, scheduled_date=None, title="sem dia")
        dia_20 = TaskFactory(
            user=user, monthly_log=mes, scheduled_date=date(2026, 3, 20), title="dia 20"
        )
        dia_5 = TaskFactory(
            user=user, monthly_log=mes, scheduled_date=date(2026, 3, 5), title="dia 5"
        )
        TaskFactory(user=user, monthly_log=mes, status=Task.Status.CANCELLED, title="cancelada")
        # Subtarefa: vai aninhada no `TaskSerializer`, nunca como raiz da fonte.
        TaskFactory(user=user, monthly_log=mes, parent_task=dia_5, title="subtarefa")

        upsert_ritual_decision(
            user=user,
            decision=RitualDecisionKind.KEEP_UNDATED,
            month_first=_MES,
            task_id=sem_dia.id,
        )
        fonte = list_future_log_items(user=user, month_first=_MES)

        assert [item["task"].id for item in fonte["items"]] == [dia_5.id, dia_20.id, sem_dia.id]
        assert fonte["items"][-1]["decision"] == RitualDecisionKind.KEEP_UNDATED
        assert fonte["eligible_count"] == 3
        assert fonte["pending_decision_count"] == 2


@pytest.mark.django_db
def test_fonte_future_log_nao_reapresenta_sucessor_recem_migrado_do_monthly_anterior(user):
    """AC4/ambiguidade #2: a fonte "Monthly anterior" migra itens PARA o alvo
    durante o MESMO ritual. Sem a exclusão, o sucessor recém-criado voltaria à
    fila do Future Log como item indeciso — fila que nunca zera.

    O item adiado de um ritual MAIS ANTIGO (predecessor em mês−2) **continua
    aparecendo**: esse é o Future Log funcionando, não o mesmo caso.
    """
    with tenant_context(user):
        anterior = MonthlyLogFactory(
            user=user, month_first=date(2026, 2, 1), status=CycleStatus.ACTIVE
        )
        antigo = MonthlyLogFactory(user=user, month_first=date(2026, 1, 1))
        alvo = MonthlyLogFactory(user=user, month_first=_MES, status=CycleStatus.PLANNING)

        sucessor_recente = TaskFactory(user=user, monthly_log=alvo, title="migrada do mês passado")
        predecessor_recente = TaskFactory(
            user=user, monthly_log=anterior, status=Task.Status.POSTPONED
        )
        predecessor_recente.migrated_to_task = sucessor_recente
        predecessor_recente.save(update_fields=["migrated_to_task"])

        sucessor_antigo = TaskFactory(user=user, monthly_log=alvo, title="adiada de janeiro")
        predecessor_antigo = TaskFactory(
            user=user, monthly_log=antigo, status=Task.Status.POSTPONED
        )
        predecessor_antigo.migrated_to_task = sucessor_antigo
        predecessor_antigo.save(update_fields=["migrated_to_task"])

        propria = TaskFactory(user=user, monthly_log=alvo, title="nasceu no alvo")

        fonte = list_future_log_items(user=user, month_first=_MES)

        titulos = {item["task"].title for item in fonte["items"]}
        assert sucessor_recente.title not in titulos
        assert titulos == {sucessor_antigo.title, propria.title}


@pytest.mark.django_db
def test_fonte_previous_monthly_e_bloqueante_e_espelha_a_semanal(user):
    """AC4 fonte 3: mesma mecânica da fonte bloqueante semanal (extraída, não
    copiada) — anterior OPERACIONAL, `blocking`, `readyToFinalize`."""
    with tenant_context(user):
        MonthlyLogFactory(user=user, month_first=_MES, status=CycleStatus.PLANNING)
        MonthlyLogFactory(user=user, month_first=date(2026, 2, 1))  # NULL: ignorado
        operacional = MonthlyLogFactory(
            user=user, month_first=date(2026, 1, 1), status=CycleStatus.ACTIVE
        )
        TaskFactory(user=user, monthly_log=operacional, title="aberta em janeiro")

        fonte = list_previous_monthly_pendings(user=user, month_first=_MES)

        assert fonte["source_id"] == "previous-monthly"
        assert [item["task"].title for item in fonte["items"]] == ["aberta em janeiro"]
        assert fonte["blocking"] is True
        assert fonte["ready_to_finalize"] is False
        assert all(item["decision"] is None for item in fonte["items"])


@pytest.mark.django_db
def test_decisions_for_target_devolve_os_dois_dicts_em_uma_query(user):
    """`decisions_for_target` é o que evita N+1 nas fontes: uma query só, e a
    separação por tipo de item já feita."""
    with tenant_context(user):
        weekly = WeeklyLogFactory(user=user, week_start=_SEMANA, status=CycleStatus.PLANNING)
        mes = MonthlyLogFactory(user=user, month_first=_MES)
        tarefa = TaskFactory(user=user, monthly_log=mes, scheduled_date=_SEMANA)
        template = RecurringTaskTemplateFactory(user=user)
        upsert_ritual_decision(
            user=user, decision=RitualDecisionKind.KEEP, week_start=_SEMANA, task_id=tarefa.id
        )
        upsert_ritual_decision(
            user=user,
            decision=RitualDecisionKind.SKIP_WEEK,
            week_start=_SEMANA,
            recurring_template_id=template.id,
        )

        with CaptureQueriesContext(connection) as capturadas:
            por_task, por_template = decisions_for_target(user=user, weekly_log=weekly)

        assert len(capturadas.captured_queries) == 1
        assert por_task == {tarefa.id: RitualDecisionKind.KEEP}
        assert por_template == {template.id: RitualDecisionKind.SKIP_WEEK}
        assert decisions_for_target(user=user, weekly_log=None) == ({}, {})


# --- densidade real (AC6) -------------------------------------------------------
_SEIS_STATUS = set(Task.Status.values)


@pytest.mark.django_db
def test_densidade_semanal_conta_subtarefas(user):
    """AC6: a densidade **inclui subtarefas** — o OPOSTO de todas as superfícies de
    listagem e de `TaskDensityView`. Este é o teste que falha se alguém copiar
    `parent_task__isnull=True` de lá."""
    with tenant_context(user):
        semana = WeeklyLogFactory(user=user, week_start=_SEMANA)
        raiz = TaskFactory(user=user, weekly_log=semana, scheduled_date=_SEMANA)
        TaskFactory(user=user, weekly_log=semana, scheduled_date=_SEMANA, parent_task=raiz)
        TaskFactory(user=user, weekly_log=semana, scheduled_date=_SEMANA, parent_task=raiz)

        densidade = compute_week_density(user=user, week_start=_SEMANA)

        assert densidade["days"][0]["total"] == 3
        assert densidade["total"] == 3


@pytest.mark.django_db
def test_densidade_semanal_grade_completa_com_seis_status_e_undated(user):
    """AC6: 7 dias (vazios visíveis), faixa `undated` separada, e as 6 chaves de
    status SEMPRE presentes com zeros."""
    with tenant_context(user):
        semana = WeeklyLogFactory(user=user, week_start=_SEMANA)
        TaskFactory(user=user, weekly_log=semana, scheduled_date=_SEMANA)
        TaskFactory(
            user=user,
            weekly_log=semana,
            scheduled_date=_SEMANA + timedelta(days=3),
            status=Task.Status.CANCELLED,
        )
        TaskFactory(user=user, weekly_log=semana, scheduled_date=None)

        densidade = compute_week_density(user=user, week_start=_SEMANA)

        assert len(densidade["days"]) == 7
        assert [dia["date"] for dia in densidade["days"]] == [
            _SEMANA + timedelta(days=offset) for offset in range(7)
        ]
        for celula in [*densidade["days"], densidade["undated"]]:
            assert set(celula["by_status"]) == _SEIS_STATUS
        assert densidade["days"][0]["by_status"]["pending"] == 1
        assert densidade["days"][1]["total"] == 0  # dia vazio presente na grade
        assert densidade["days"][3]["by_status"]["cancelled"] == 1
        assert densidade["undated"]["total"] == 1
        assert densidade["total"] == 3


@pytest.mark.django_db
def test_densidade_conta_registros_nao_linhagens(user):
    """AC6/M06 L223: "o resumo conta **registros, não linhagens**" — origem
    `migrated` e sucessor contam SEPARADAMENTE, sem deduplicação."""
    with tenant_context(user):
        semana = WeeklyLogFactory(user=user, week_start=_SEMANA)
        sucessor = TaskFactory(user=user, weekly_log=semana, scheduled_date=_SEMANA)
        origem = TaskFactory(
            user=user,
            weekly_log=semana,
            scheduled_date=_SEMANA,
            status=Task.Status.MIGRATED,
            migration_count=1,
        )
        origem.migrated_to_task = sucessor
        origem.save(update_fields=["migrated_to_task"])

        densidade = compute_week_density(user=user, week_start=_SEMANA)

        assert densidade["days"][0]["total"] == 2
        assert densidade["days"][0]["by_status"]["migrated"] == 1
        assert densidade["days"][0]["by_status"]["pending"] == 1


@pytest.mark.django_db
def test_densidade_nao_projeta_recorrente_nao_alocado_nem_outros_containers(user):
    """AC6: "recorrentes ainda não alocados **não são projeção**", e nada de somar
    tarefas de outros containers (o legado `task-density/` soma três fontes)."""
    with tenant_context(user):
        WeeklyLogFactory(user=user, week_start=_SEMANA)
        RecurringTaskTemplateFactory(user=user, recurrence_text="toda segunda")
        outra_semana = WeeklyLogFactory(user=user, week_start=_SEMANA + timedelta(weeks=1))
        TaskFactory(user=user, weekly_log=outra_semana, scheduled_date=_SEMANA + timedelta(days=7))
        mes = MonthlyLogFactory(user=user, month_first=_MES)
        TaskFactory(user=user, monthly_log=mes, scheduled_date=_SEMANA)
        LogFactory(user=user, log_date=_SEMANA)  # daily do mesmo dia

        densidade = compute_week_density(user=user, week_start=_SEMANA)

        assert densidade["total"] == 0


@pytest.mark.django_db
def test_densidade_mensal_grade_completa_incluindo_fevereiro_bissexto(user):
    """AC6: todos os dias reais do mês (28–31), bissexto incluído — via
    `calendar.monthrange`, não por aritmética de ano."""
    with tenant_context(user):
        for month_first, dias in ((date(2028, 2, 1), 29), (date(2026, 2, 1), 28)):
            MonthlyLogFactory(user=user, month_first=month_first)
            densidade = compute_month_density(user=user, month_first=month_first)
            assert len(densidade["days"]) == dias
            assert densidade["days"][-1]["date"].day == dias


@pytest.mark.django_db
def test_densidade_mensal_conta_apenas_o_container_alvo(user):
    """AC6: só `monthly_log = <alvo>`. Uma tarefa de OUTRO monthly com data dentro
    do mês-alvo (possível via Future Log) não pode aparecer."""
    with tenant_context(user):
        alvo = MonthlyLogFactory(user=user, month_first=_MES)
        outro = MonthlyLogFactory(user=user, month_first=date(2026, 4, 1))
        TaskFactory(user=user, monthly_log=alvo, scheduled_date=date(2026, 3, 10))
        TaskFactory(user=user, monthly_log=outro, scheduled_date=date(2026, 3, 10))

        densidade = compute_month_density(user=user, month_first=_MES)

        assert densidade["days"][9]["total"] == 1
        assert densidade["total"] == 1


@pytest.mark.django_db
def test_densidade_aceita_alvo_em_qualquer_estado_e_log_ausente_devolve_grade_zerada(user):
    """AC6: a densidade NÃO exige alvo em planejamento (reuso por 14.5/14.6/14.10),
    e log inexistente devolve a grade completa zerada — não 404, não vazio."""
    with tenant_context(user):
        for status_do_alvo in (None, CycleStatus.PLANNING, CycleStatus.FINALIZED):
            semana = _SEMANA + timedelta(weeks=len(WeeklyLog.objects.all()))
            log = WeeklyLogFactory(user=user, week_start=semana, status=status_do_alvo)
            TaskFactory(user=user, weekly_log=log, scheduled_date=semana)
            assert compute_week_density(user=user, week_start=semana)["total"] == 1

        semana_sem_log = _SEMANA + timedelta(weeks=40)
        vazia = compute_week_density(user=user, week_start=semana_sem_log)
        assert len(vazia["days"]) == 7
        assert vazia["total"] == 0
        assert set(vazia["undated"]["by_status"]) == _SEIS_STATUS


@pytest.mark.django_db
def test_fontes_e_densidades_nao_materializam_nenhum_log(user):
    """AC7: **nenhum** endpoint desta story materializa log.

    Chama as SETE fontes e as DUAS densidades para chaves sem log nenhum e afirma
    que `WeeklyLog`/`MonthlyLog`/`Log` não ganharam linhas — é o guardrail da AC4
    da Story 14.1, agora do lado da leitura.
    """
    with tenant_context(user):
        semana = _SEMANA + timedelta(weeks=52)
        mes = date(2027, 9, 1)
        antes = (WeeklyLog.objects.count(), MonthlyLog.objects.count(), Log.objects.count())

        for servico in (
            list_monthly_tasks_in_week,
            list_weekly_recurring_candidates,
            list_previous_weekly_pendings,
            list_pending_daily_groups,
            compute_week_density,
        ):
            servico(user=user, week_start=semana)
        for servico in (
            list_monthly_recurring_candidates,
            list_future_log_items,
            list_previous_monthly_pendings,
            compute_month_density,
        ):
            servico(user=user, month_first=mes)

        assert (
            WeeklyLog.objects.count(),
            MonthlyLog.objects.count(),
            Log.objects.count(),
        ) == antes
        assert antes == (0, 0, 0)


@pytest.mark.django_db
def test_fontes_e_densidades_isolam_por_tenant(user, other_user):
    """AC7: todo acesso usa o manager auto-escopado `objects`. O usuário B não vê
    nada do A, mesmo com as chaves de período idênticas."""
    with tenant_context(other_user):
        semana = WeeklyLogFactory(user=other_user, week_start=_SEMANA, status=CycleStatus.PLANNING)
        mes = MonthlyLogFactory(user=other_user, month_first=_MES, status=CycleStatus.PLANNING)
        TaskFactory(user=other_user, weekly_log=semana, scheduled_date=_SEMANA)
        TaskFactory(user=other_user, monthly_log=mes, scheduled_date=_SEMANA)
        RecurringTaskTemplateFactory(user=other_user)
        LogFactory(user=other_user, log_date=_SEMANA - timedelta(days=2))
        TaskFactory(user=other_user, log=Log.objects.get(log_date=_SEMANA - timedelta(days=2)))

    with tenant_context(user):
        assert list_monthly_tasks_in_week(user=user, week_start=_SEMANA)["eligible_count"] == 0
        assert (
            list_weekly_recurring_candidates(user=user, week_start=_SEMANA)["eligible_count"] == 0
        )
        assert list_previous_weekly_pendings(user=user, week_start=_SEMANA)["eligible_count"] == 0
        assert list_pending_daily_groups(user=user, week_start=_SEMANA)["groups"] == []
        assert (
            list_monthly_recurring_candidates(user=user, month_first=_MES)["eligible_count"] == 0
        )
        assert list_future_log_items(user=user, month_first=_MES)["eligible_count"] == 0
        assert list_previous_monthly_pendings(user=user, month_first=_MES)["eligible_count"] == 0
        assert compute_week_density(user=user, week_start=_SEMANA)["total"] == 0
        assert compute_month_density(user=user, month_first=_MES)["total"] == 0


# --- fila unificada de migração (Story 14.3; AD-28 itens 7-8, AD-09) -----------
#
# As fronteiras dos testes são derivadas de `today_for(user)` da MESMA forma que
# o produto (AD-09 item 1), mas escritas aqui de forma independente: se alguém
# afrouxar `__lt` para `__lte` no serviço, o teste tem de ficar vermelho — por
# isso nada de importar o spec das seções para montar as datas esperadas.


def _fronteiras(user):
    """(hoje, ontem, início da semana anterior, primeiro dia do mês anterior)."""
    hoje = today_for(user)
    return (
        hoje,
        hoje - timedelta(days=1),
        week_start_of(hoje) - timedelta(weeks=1),
        (hoje.replace(day=1) - timedelta(days=1)).replace(day=1),
    )


def _secao(fila, source_id):
    return next(secao for secao in fila["sections"] if secao["source_id"] == source_id)


def _ids_da_secao(fila, source_id):
    return [
        task.id for grupo in _secao(fila, source_id)["groups"] for task in grupo["items"]
    ]


@pytest.mark.django_db
def test_fila_unificada_fronteira_da_secao_month(user):
    """AC1: o mês ANTERIOR fica fora (é fonte bloqueante do ritual da 14.2);
    o mês retro-anterior entra. A fronteira é `<`, não `<=`."""
    with tenant_context(user):
        _, _, _, mes_anterior = _fronteiras(user)
        mes_retro_anterior = (mes_anterior - timedelta(days=1)).replace(day=1)

        de_fora = TaskFactory(
            user=user,
            monthly_log=MonthlyLogFactory(user=user, month_first=mes_anterior),
            status=Task.Status.PENDING,
        )
        de_dentro = TaskFactory(
            user=user,
            monthly_log=MonthlyLogFactory(user=user, month_first=mes_retro_anterior),
            status=Task.Status.PENDING,
        )

        fila = unified_migration_queue(user=user)

        assert _ids_da_secao(fila, "month") == [de_dentro.id]
        assert de_fora.id not in _ids_da_secao(fila, "month")


@pytest.mark.django_db
def test_fila_unificada_fronteira_da_secao_week(user):
    """AC1: a semana ANTERIOR fica fora; a de duas semanas atrás entra."""
    with tenant_context(user):
        _, _, semana_anterior, _ = _fronteiras(user)
        duas_semanas_atras = semana_anterior - timedelta(weeks=1)

        de_fora = TaskFactory(
            user=user,
            weekly_log=WeeklyLogFactory(user=user, week_start=semana_anterior),
            status=Task.Status.STARTED,
        )
        de_dentro = TaskFactory(
            user=user,
            weekly_log=WeeklyLogFactory(user=user, week_start=duas_semanas_atras),
            status=Task.Status.PENDING,
        )

        fila = unified_migration_queue(user=user)

        assert _ids_da_secao(fila, "week") == [de_dentro.id]
        assert de_fora.id not in _ids_da_secao(fila, "week")


@pytest.mark.django_db
def test_fila_unificada_fronteira_da_secao_day_inclui_ontem(user):
    """AC1: a fronteira do nível `day` é `log_date < hoje` — ONTEM entra (é a
    diferença em relação à catch-up legada, que corta em `< ontem`), anteontem
    entra, hoje não. "Ontem" é o nível `day`, não uma quarta seção."""
    with tenant_context(user):
        hoje, ontem, _, _ = _fronteiras(user)
        anteontem = hoje - timedelta(days=2)

        de_hoje = TaskFactory(
            user=user, log=LogFactory(user=user, log_date=hoje), status=Task.Status.PENDING
        )
        de_ontem = TaskFactory(
            user=user, log=LogFactory(user=user, log_date=ontem), status=Task.Status.PENDING
        )
        de_anteontem = TaskFactory(
            user=user, log=LogFactory(user=user, log_date=anteontem), status=Task.Status.STARTED
        )

        fila = unified_migration_queue(user=user)

        assert _ids_da_secao(fila, "day") == [de_anteontem.id, de_ontem.id]
        assert de_hoje.id not in _ids_da_secao(fila, "day")
        assert fila["yesterday"] == ontem


@pytest.mark.django_db
def test_fila_unificada_ordem_das_secoes_e_mes_semana_dia(user):
    """AC1/AD-09 item 4: ordem hierárquica do BuJo, do mais grosso ao mais fino.
    Asserção sobre a LISTA (um `set` não provaria ordem nenhuma)."""
    with tenant_context(user):
        fila = unified_migration_queue(user=user)

        assert [secao["source_id"] for secao in fila["sections"]] == ["month", "week", "day"]


@pytest.mark.django_db
def test_fila_unificada_grupos_crescentes_e_itens_por_order_index(user):
    """AC1: grupos por período CRESCENTE (mais antigo primeiro) e itens por
    `order_index` — ordenação declarada, não herdada do `Meta.ordering` (que
    `order_by` substitui) nem do humor do Postgres."""
    with tenant_context(user):
        hoje, ontem, _, _ = _fronteiras(user)
        anteontem = hoje - timedelta(days=2)

        log_ontem = LogFactory(user=user, log_date=ontem)
        log_anteontem = LogFactory(user=user, log_date=anteontem)
        # Criados fora de ordem de propósito, em período E em order_index.
        segunda_de_ontem = TaskFactory(
            user=user, log=log_ontem, status=Task.Status.PENDING, order_index=20.0
        )
        primeira_de_ontem = TaskFactory(
            user=user, log=log_ontem, status=Task.Status.PENDING, order_index=10.0
        )
        de_anteontem = TaskFactory(
            user=user, log=log_anteontem, status=Task.Status.PENDING, order_index=99.0
        )

        fila = unified_migration_queue(user=user)
        grupos = _secao(fila, "day")["groups"]

        assert [grupo["period_start"] for grupo in grupos] == [anteontem, ontem]
        assert [task.id for task in grupos[0]["items"]] == [de_anteontem.id]
        assert [task.id for task in grupos[1]["items"]] == [
            primeira_de_ontem.id,
            segunda_de_ontem.id,
        ]


@pytest.mark.django_db
def test_fila_unificada_count_por_secao_total_e_secoes_vazias_presentes(user):
    """AC2: `count` é o total de ITENS da seção (não de grupos), `total_count` é
    a soma das três, e uma seção sem pendência continua PRESENTE com
    `count: 0`/`groups: []` — a UI da 14.9 desenha o rail completo."""
    with tenant_context(user):
        hoje, ontem, _, mes_anterior = _fronteiras(user)
        mes_retro_anterior = (mes_anterior - timedelta(days=1)).replace(day=1)
        mes_log = MonthlyLogFactory(user=user, month_first=mes_retro_anterior)
        TaskFactory(user=user, monthly_log=mes_log, status=Task.Status.PENDING)
        TaskFactory(user=user, monthly_log=mes_log, status=Task.Status.PENDING)
        TaskFactory(
            user=user, log=LogFactory(user=user, log_date=ontem), status=Task.Status.PENDING
        )
        TaskFactory(
            user=user,
            log=LogFactory(user=user, log_date=hoje - timedelta(days=3)),
            status=Task.Status.PENDING,
        )

        fila = unified_migration_queue(user=user)

        assert _secao(fila, "month")["count"] == 2
        assert len(_secao(fila, "month")["groups"]) == 1  # 2 itens, 1 grupo
        assert _secao(fila, "day")["count"] == 2
        assert _secao(fila, "week")["count"] == 0
        assert _secao(fila, "week")["groups"] == []
        assert fila["total_count"] == 4
        assert fila["total_count"] == sum(secao["count"] for secao in fila["sections"])


@pytest.mark.django_db
def test_fila_unificada_descarta_dispostos_e_subtarefas(user):
    """AC1: só raízes `pending`/`started`. `completed`/`cancelled`/`migrated`/
    `postponed` antigos ficam fora, e a SUBTAREFA aberta de uma raiz aberta não
    é item de topo — este é o assert que falha se alguém esquecer
    `parent_task__isnull=True` (as subtarefas vão ANINHADAS no serializer)."""
    with tenant_context(user):
        hoje, _, _, _ = _fronteiras(user)
        log = LogFactory(user=user, log_date=hoje - timedelta(days=4))
        raiz = TaskFactory(user=user, log=log, status=Task.Status.STARTED)
        subtarefa = TaskFactory(
            user=user, log=log, parent_task=raiz, status=Task.Status.PENDING
        )
        dispostos = [
            TaskFactory(user=user, log=log, status=status)
            for status in (
                Task.Status.COMPLETED,
                Task.Status.CANCELLED,
                Task.Status.MIGRATED,
                Task.Status.POSTPONED,
            )
        ]

        fila = unified_migration_queue(user=user)

        assert _ids_da_secao(fila, "day") == [raiz.id]
        assert subtarefa.id not in _ids_da_secao(fila, "day")
        for disposto in dispostos:
            assert disposto.id not in _ids_da_secao(fila, "day")


@pytest.mark.django_db
def test_fila_unificada_rederivacao_remove_o_item_decidido_sem_persistencia_nova(user):
    """AC3: "retomar traz só os restantes" é consequência da RE-DERIVAÇÃO, não de
    estado salvo. Migrar tira o item (vira `migrated`), cancelar também (vira
    `cancelled`), a seção continua presente mesmo vazia, e NENHUMA linha entra em
    `ritual_decisions` — a mutação é a persistência (AD-28 item 6)."""
    with tenant_context(user):
        hoje, ontem, _, _ = _fronteiras(user)
        log = LogFactory(user=user, log_date=ontem)
        a_migrar = TaskFactory(user=user, log=log, status=Task.Status.PENDING, order_index=1.0)
        a_cancelar = TaskFactory(user=user, log=log, status=Task.Status.PENDING, order_index=2.0)
        remanescente = TaskFactory(
            user=user, log=log, status=Task.Status.STARTED, order_index=3.0
        )

        inicial = unified_migration_queue(user=user)
        assert inicial["total_count"] == 3

        migrate_task(user=user, task_id=a_migrar.id, destination="today")
        depois_da_migracao = unified_migration_queue(user=user)
        assert a_migrar.id not in _ids_da_secao(depois_da_migracao, "day")
        assert depois_da_migracao["total_count"] == 2
        assert set(_ids_da_secao(depois_da_migracao, "day")) == {
            a_cancelar.id,
            remanescente.id,
        }

        migrate_task(user=user, task_id=a_cancelar.id, destination="cancel")
        depois_do_cancelamento = unified_migration_queue(user=user)
        assert _ids_da_secao(depois_do_cancelamento, "day") == [remanescente.id]
        assert depois_do_cancelamento["total_count"] == 1
        # A seção segue PRESENTE mesmo depois de esvaziar as outras duas.
        assert [secao["source_id"] for secao in depois_do_cancelamento["sections"]] == [
            "month",
            "week",
            "day",
        ]

        # AD-28 item 6: decisão mutante não ganha registro paralelo.
        assert RitualDecision.objects.count() == 0


@pytest.mark.django_db
@pytest.mark.parametrize("secao_alvo", ["month", "week", "day"])
def test_fila_unificada_heranca_de_status_e_waiting_on_por_secao(user, secao_alvo):
    """AC4: item da fila migrado para hoje nasce sucessor com o status herdado
    (AD-18 item 1, via `inherited_successor_status` — regra REUSADA, não
    reimplementada aqui) e `waiting_on` copiado, origem `migrated`,
    `migration_count` +1, e a subárvore migra junta com cada filho herdando O
    PRÓPRIO status (AD-08 item 11 / AD-18 item 2). Um caso por seção: a fila é
    a ENTRADA sob teste, não a herança como mecanismo novo."""
    with tenant_context(user):
        hoje, ontem, semana_anterior, mes_anterior = _fronteiras(user)
        containers = {
            "month": {
                "monthly_log": MonthlyLogFactory(
                    user=user, month_first=(mes_anterior - timedelta(days=1)).replace(day=1)
                )
            },
            "week": {
                "weekly_log": WeeklyLogFactory(
                    user=user, week_start=semana_anterior - timedelta(weeks=1)
                )
            },
            "day": {"log": LogFactory(user=user, log_date=ontem)},
        }[secao_alvo]

        raiz = TaskFactory(
            user=user, status=Task.Status.STARTED, waiting_on=True, migration_count=0, **containers
        )
        filho_iniciado = TaskFactory(
            user=user, parent_task=raiz, status=Task.Status.STARTED, **containers
        )
        filho_pendente = TaskFactory(
            user=user, parent_task=raiz, status=Task.Status.PENDING, **containers
        )
        filho_concluido = TaskFactory(
            user=user, parent_task=raiz, status=Task.Status.COMPLETED, **containers
        )

        # A fila é a entrada: o item existe nela ANTES da decisão.
        assert raiz.id in _ids_da_secao(unified_migration_queue(user=user), secao_alvo)

        origem = migrate_task(user=user, task_id=raiz.id, destination="today")

        assert origem.status == Task.Status.MIGRATED
        sucessor = origem.migrated_to_task
        assert sucessor.status == inherited_successor_status(Task.Status.STARTED)
        assert sucessor.status == Task.Status.STARTED
        assert sucessor.waiting_on is True
        assert sucessor.migration_count == 1
        assert sucessor.log.log_date == hoje

        por_titulo = {filho.title: filho for filho in sucessor.subtasks.all()}
        assert set(por_titulo) == {filho_iniciado.title, filho_pendente.title}
        assert por_titulo[filho_iniciado.title].status == Task.Status.STARTED
        assert por_titulo[filho_pendente.title].status == Task.Status.PENDING
        # Filho já disposto não viaja e permanece na origem.
        filho_concluido.refresh_from_db()
        assert filho_concluido.status == Task.Status.COMPLETED
        assert filho_concluido.parent_task_id == raiz.id

        # E a re-derivação remove o item decidido (caso-âncora da AD-28, L1247).
        assert raiz.id not in _ids_da_secao(unified_migration_queue(user=user), secao_alvo)


@pytest.mark.django_db
def test_fila_unificada_migration_count_conta_por_decisao_nao_por_dia_pulado(user):
    """AC4/AD-09 item 5: entrando PELA FILA UNIFICADA, um item cujo log é de
    várias semanas atrás ganha `migration_count == 1` numa decisão só — a
    contagem é por decisão, não por dia de calendário pulado. Extensão do caso
    já coberto por `test_migrate_task_catch_up_conta_por_decisao_nao_por_dia_pulado`
    (mesma propriedade, entrada nova)."""
    with tenant_context(user):
        hoje, _, _, _ = _fronteiras(user)
        antiga = hoje - timedelta(weeks=5)
        task = TaskFactory(
            user=user,
            log=LogFactory(user=user, log_date=antiga),
            status=Task.Status.PENDING,
            migration_count=0,
        )

        fila = unified_migration_queue(user=user)
        assert task.id in _ids_da_secao(fila, "day")

        sucessor = migrate_task(user=user, task_id=task.id, destination="today").migrated_to_task

        assert sucessor.migration_count == 1


@pytest.mark.django_db
def test_fila_unificada_nao_materializa_nenhum_log_e_e_leitura_pura(user):
    """AC2: usuário sem log nenhum recebe as três seções vazias e a chamada não
    cria linha em `Log`/`WeeklyLog`/`MonthlyLog`. `_sem_escrita` reforça no SQL:
    zero `INSERT`/`UPDATE`/`DELETE` (a derivação é leitura, e é por isso que o
    serviço não é `@transaction.atomic`)."""
    with tenant_context(user):
        fila = _sem_escrita(unified_migration_queue, user=user)

        assert [secao["source_id"] for secao in fila["sections"]] == ["month", "week", "day"]
        assert [secao["count"] for secao in fila["sections"]] == [0, 0, 0]
        assert [secao["groups"] for secao in fila["sections"]] == [[], [], []]
        assert fila["total_count"] == 0
        assert Log.objects.count() == 0
        assert WeeklyLog.objects.count() == 0
        assert MonthlyLog.objects.count() == 0


@pytest.mark.django_db
def test_fila_unificada_escopada_por_tenant(user, other_user):
    """AC2: tudo pelo manager auto-escopado `objects` — a pendência antiga de
    outro usuário não vaza para a fila."""
    with tenant_context(other_user):
        hoje = today_for(other_user)
        TaskFactory(
            user=other_user,
            log=LogFactory(user=other_user, log_date=hoje - timedelta(days=3)),
            status=Task.Status.PENDING,
        )

    with tenant_context(user):
        fila = unified_migration_queue(user=user)

        assert fila["total_count"] == 0


@pytest.mark.django_db
def test_fila_unificada_nao_faz_n_mais_1_por_grupo(user):
    """AC1 ("nunca N+1 por log"): o custo em queries da derivação NÃO cresce com o
    número de grupos nem de tarefas.

    Este é o assert que a Task 1 pede e que nenhum outro teste faz: a chave do
    período vem `annotate`ada na MESMA query, então o laço de agrupamento lê um
    atributo simples e nunca toca `task.log`/`task.weekly_log`/`task.monthly_log`.
    Sem a anotação (ou sem o `select_related` equivalente) a fila continuaria
    devolvendo o conteúdo correto — e uma tarefa a mais viraria uma query a mais,
    silenciosamente. Comparar duas medições reais (magra × gorda) é o único jeito
    de detectar isso; um número absoluto fixado à mão quebraria a cada mudança de
    `prefetch_related`.
    """

    def _semear(indice, *, raizes_por_container):
        """Um container por nível, `raizes_por_container` raízes abertas em cada."""
        hoje = today_for(user)
        # Um mês distinto por `indice`, todos ANTERIORES ao mês anterior (que a AC1
        # mantém fora da fila): retrocede mês a mês pelo primeiro dia, sem aritmética
        # de 31 dias, que pularia fevereiro.
        mes = (hoje.replace(day=1) - timedelta(days=1)).replace(day=1)
        for _ in range(indice + 1):
            mes = (mes - timedelta(days=1)).replace(day=1)
        containers = (
            ("monthly_log", MonthlyLogFactory(user=user, month_first=mes)),
            (
                "weekly_log",
                WeeklyLogFactory(
                    user=user, week_start=week_start_of(hoje) - timedelta(weeks=2 + indice)
                ),
            ),
            ("log", LogFactory(user=user, log_date=hoje - timedelta(days=2 + indice))),
        )
        for campo, container in containers:
            for ordem in range(raizes_por_container):
                TaskFactory(
                    user=user,
                    status=Task.Status.PENDING,
                    order_index=float(ordem + 1),
                    **{campo: container},
                )

    def _medir():
        with CaptureQueriesContext(connection) as capturadas:
            fila = unified_migration_queue(user=user)
        return len(capturadas.captured_queries), fila

    with tenant_context(user):
        _semear(0, raizes_por_container=1)
        queries_magra, fila_magra = _medir()
        assert fila_magra["total_count"] == 3, "as três seções precisam estar POVOADAS"
        # (com seção vazia o Django pula o `prefetch_related` e a comparação viraria
        # ruído: o teste mediria a ausência de dado, não a ausência de N+1)

        for indice in range(1, 4):
            _semear(indice, raizes_por_container=4)
        queries_gorda, fila_gorda = _medir()
        assert fila_gorda["total_count"] == 3 + 3 * 3 * 4
        assert [len(secao["groups"]) for secao in fila_gorda["sections"]] == [4, 4, 4]

        assert queries_gorda == queries_magra, (
            f"a derivação passou de {queries_magra} para {queries_gorda} queries ao ir de "
            f"1 para 4 grupos por seção — a chave de período deixou de vir na mesma query"
        )


@pytest.mark.django_db
@pytest.mark.parametrize("destino", ["today", "week", "month", "future"])
def test_fila_unificada_sucessor_de_qualquer_destino_nao_reentra_na_fila(user, destino):
    """AC3: o ritual da fila TERMINA — nenhum dos quatro destinos com linhagem
    devolve o sucessor para dentro da fila.

    A re-derivação já é testada para `today` e `cancel`; os destinos `week`,
    `month` e `future` criam o sucessor em containers cujo período é comparado com
    as MESMAS fronteiras da fila (`< semana anterior`, `< mês anterior`), e é aí
    que um erro de sinal produziria um laço infinito: o usuário decide, o item
    volta, a faixa do Hoje nunca zera. Nenhum teste cobria esse par
    (destino → fronteira) além de `today`.
    """
    with tenant_context(user):
        hoje, _, _, mes_anterior = _fronteiras(user)
        mes_seguinte = (hoje.replace(day=28) + timedelta(days=7)).replace(day=1)
        origem = TaskFactory(
            user=user,
            log=LogFactory(user=user, log_date=hoje - timedelta(days=3)),
            status=Task.Status.PENDING,
        )
        assert unified_migration_queue(user=user)["total_count"] == 1

        migrate_task(
            user=user,
            task_id=origem.id,
            destination=destino,
            # `month` recebe o mês CORRENTE (a view o força; o serviço o exige) e
            # `future` um mês adiante — nunca `mes_anterior`, que a AC1 mantém fora
            # da fila por ser fonte bloqueante do ritual da 14.2.
            month_first=(
                hoje.replace(day=1)
                if destino == "month"
                else mes_seguinte
                if destino == "future"
                else None
            ),
        )

        fila = unified_migration_queue(user=user)
        sucessor = Task.objects.get(id=origem.id).migrated_to_task
        assert sucessor is not None, "os quatro destinos deste teste criam linhagem"
        assert fila["total_count"] == 0, (
            f"destino {destino!r}: o sucessor {sucessor.id} reentrou na fila — "
            f"a decisão nunca escoaria a pendência"
        )
        assert [secao["source_id"] for secao in fila["sections"]] == ["month", "week", "day"]
        assert mes_anterior < hoje.replace(day=1)  # sanidade da fronteira usada acima
