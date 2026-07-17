"""Camada de serviço do Brain Dump (§6.2, AD-15).

`process_brain_dump_item` reaproveita os serviços de resolução de container
e criação de tarefa já existentes em `bujo` — ver Dev Notes "Por que
`braindump` importa serviços de `bujo`" antes de alterar este arquivo.
"""

from django.db import transaction

from braindump.models import BrainDumpItem
from bujo.services.logs import (
    get_or_create_daily_log,
    get_or_create_monthly_log,
    get_or_create_weekly_log,
)
from bujo.services.tasks import create_task
from core.calendar import today_for, week_start_of


def list_brain_dump_items(*, user):
    return BrainDumpItem.objects.all()


def count_brain_dump_items(*, user) -> int:
    return BrainDumpItem.objects.count()


@transaction.atomic
def create_brain_dump_item(*, user, title, description=None, target_log=None) -> BrainDumpItem:
    return BrainDumpItem.objects.create(
        title=title, description=description, target_log=target_log
    )


@transaction.atomic
def process_brain_dump_item(
    *, user, item_id, destination, month_first=None, scheduled_date=None
):
    """Cria a `Task` de destino e remove o item da caixa (AC #2). Sem
    migração automática: `destination` é escolhido AGORA pelo usuário, no
    momento do processamento — `target_log` do item (se houver) é só uma
    dica que o frontend pode usar para pré-selecionar a opção, nunca lida
    aqui no service (§6.8: nenhuma automação implícita).
    """
    item = BrainDumpItem.objects.get(id=item_id)

    if destination == "today":
        container_field = "log"
        container = get_or_create_daily_log(user=user, log_date=today_for(user))
    elif destination == "week":
        container_field = "weekly_log"
        week_start = (
            week_start_of(scheduled_date) if scheduled_date else week_start_of(today_for(user))
        )
        container = get_or_create_weekly_log(user=user, week_start=week_start)
    else:  # "month" ou "future" — mesma resolução de container que migrate_task
        container_field = "monthly_log"
        container = get_or_create_monthly_log(user=user, month_first=month_first)

    task = create_task(
        user=user,
        title=item.title,
        description=item.description,
        scheduled_date=scheduled_date if destination != "today" else None,
        **{container_field: container},
    )
    item.delete()
    return task


@transaction.atomic
def discard_brain_dump_item(*, user, item_id) -> None:
    BrainDumpItem.objects.get(id=item_id).delete()
