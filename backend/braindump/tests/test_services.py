"""Testes dos serviços do Brain Dump (AC #1, #2)."""

import pytest

from braindump.models import BrainDumpItem
from braindump.services import (
    count_brain_dump_items,
    create_brain_dump_item,
    discard_brain_dump_item,
    list_brain_dump_items,
    process_brain_dump_item,
)
from braindump.tests.factories import BrainDumpItemFactory
from bujo.models import Task
from bujo.services.logs import (
    get_or_create_monthly_log,
    get_or_create_weekly_log,
)
from core.calendar import today_for, week_start_of
from core.tenant import tenant_context


@pytest.mark.django_db
def test_create_brain_dump_item_so_com_title(user):
    with tenant_context(user):
        item = create_brain_dump_item(user=user, title="Item novo")

        assert item.title == "Item novo"
        assert item.description is None
        assert item.target_log is None


@pytest.mark.django_db
def test_create_brain_dump_item_com_os_3_campos(user):
    with tenant_context(user):
        item = create_brain_dump_item(
            user=user,
            title="Item novo",
            description="Descrição",
            target_log=BrainDumpItem.TargetLog.WEEK,
        )

        assert item.title == "Item novo"
        assert item.description == "Descrição"
        assert item.target_log == BrainDumpItem.TargetLog.WEEK


@pytest.mark.django_db
def test_create_brain_dump_item_user_id_auto_preenchido_do_contexto(user):
    with tenant_context(user):
        item = create_brain_dump_item(user=user, title="Item novo")

        assert item.user_id == user.id


@pytest.mark.django_db
def test_list_brain_dump_items_escopado_por_tenant(user, other_user):
    with tenant_context(user):
        BrainDumpItemFactory(user=user, title="Item do user")

    with tenant_context(other_user):
        BrainDumpItemFactory(user=other_user, title="Item do outro user")

        items = list_brain_dump_items(user=other_user)

        assert [item.title for item in items] == ["Item do outro user"]


@pytest.mark.django_db
def test_list_brain_dump_items_vazio_para_usuario_novo(user):
    with tenant_context(user):
        assert list(list_brain_dump_items(user=user)) == []


@pytest.mark.django_db
def test_process_brain_dump_item_destination_today_cria_task_no_log_do_dia_corrente(user):
    with tenant_context(user):
        item = BrainDumpItemFactory(user=user, title="Item", description="Descrição")

        task = process_brain_dump_item(user=user, item_id=item.id, destination="today")

        assert task.title == "Item"
        assert task.description == "Descrição"
        assert task.log.log_date == today_for(user)
        assert task.status == Task.Status.PENDING
        assert task.source_template is None
        assert task.migration_count == 0
        assert not BrainDumpItem.objects.filter(id=item.id).exists()


@pytest.mark.django_db
def test_process_brain_dump_item_destination_week_sem_scheduled_date_cria_na_semana_corrente(user):
    with tenant_context(user):
        item = BrainDumpItemFactory(user=user)

        task = process_brain_dump_item(user=user, item_id=item.id, destination="week")

        current_weekly_log = get_or_create_weekly_log(
            user=user, week_start=week_start_of(today_for(user))
        )
        assert task.weekly_log_id == current_weekly_log.id
        assert task.scheduled_date is None


@pytest.mark.django_db
def test_process_brain_dump_item_destination_month_cria_no_monthly_do_month_first_informado(user):
    with tenant_context(user):
        item = BrainDumpItemFactory(user=user)
        month_first = today_for(user).replace(day=1)

        task = process_brain_dump_item(
            user=user, item_id=item.id, destination="month", month_first=month_first
        )

        monthly_log = get_or_create_monthly_log(user=user, month_first=month_first)
        assert task.monthly_log_id == monthly_log.id


@pytest.mark.django_db
def test_process_brain_dump_item_destination_future_cria_no_monthly_do_month_first_informado(user):
    with tenant_context(user):
        item = BrainDumpItemFactory(user=user)
        future_month_first = today_for(user).replace(day=1).replace(
            year=today_for(user).year + 1
        )

        task = process_brain_dump_item(
            user=user,
            item_id=item.id,
            destination="future",
            month_first=future_month_first,
        )

        monthly_log = get_or_create_monthly_log(user=user, month_first=future_month_first)
        assert task.monthly_log_id == monthly_log.id


@pytest.mark.django_db
def test_process_brain_dump_item_task_criada_herda_title_e_description_do_item(user):
    with tenant_context(user):
        item = BrainDumpItemFactory(
            user=user, title="Título do item", description="Descrição do item"
        )

        task = process_brain_dump_item(user=user, item_id=item.id, destination="today")

        assert task.title == "Título do item"
        assert task.description == "Descrição do item"


@pytest.mark.django_db
def test_process_brain_dump_item_task_criada_e_raiz_comum_sem_marca_de_proveniencia(user):
    with tenant_context(user):
        item = BrainDumpItemFactory(user=user)

        task = process_brain_dump_item(user=user, item_id=item.id, destination="today")

        assert task.status == Task.Status.PENDING
        assert task.source_template is None
        assert task.parent_task is None
        assert task.migration_count == 0
        assert task.migrated_to_task is None


@pytest.mark.django_db
def test_discard_brain_dump_item_remove_o_item(user):
    with tenant_context(user):
        item = BrainDumpItemFactory(user=user)

        discard_brain_dump_item(user=user, item_id=item.id)

        assert not BrainDumpItem.objects.filter(id=item.id).exists()


@pytest.mark.django_db
def test_discard_brain_dump_item_ja_removido_levanta_does_not_exist(user):
    with tenant_context(user):
        item = BrainDumpItemFactory(user=user)
        discard_brain_dump_item(user=user, item_id=item.id)

        with pytest.raises(BrainDumpItem.DoesNotExist):
            discard_brain_dump_item(user=user, item_id=item.id)


@pytest.mark.django_db
def test_discard_brain_dump_item_de_outro_tenant_levanta_does_not_exist(user, other_user):
    with tenant_context(user):
        item = BrainDumpItemFactory(user=user)

    with tenant_context(other_user):
        with pytest.raises(BrainDumpItem.DoesNotExist):
            discard_brain_dump_item(user=other_user, item_id=item.id)


@pytest.mark.django_db
def test_count_brain_dump_items_vazio_para_usuario_novo(user):
    with tenant_context(user):
        assert count_brain_dump_items(user=user) == 0


@pytest.mark.django_db
def test_count_brain_dump_items_conta_apos_criar_n_itens(user):
    with tenant_context(user):
        BrainDumpItemFactory.create_batch(3, user=user)

        assert count_brain_dump_items(user=user) == 3


@pytest.mark.django_db
def test_count_brain_dump_items_escopado_por_tenant(user, other_user):
    with tenant_context(user):
        BrainDumpItemFactory.create_batch(2, user=user)

    with tenant_context(other_user):
        BrainDumpItemFactory(user=other_user)

        assert count_brain_dump_items(user=other_user) == 1
