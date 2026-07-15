"""Migração diária de tarefas pendentes (FR-1.7, AD-03, AD-08 item 11, §6.2).

`migrate_task` não duplica `order_index`/validação de transição — reaproveita
`create_task`/`update_task` (`services/tasks.py`) e `transition_task`
(`services/state_machine.py`) tal como já existem.
"""

from django.db import transaction

from bujo.models import Task
from bujo.services.logs import (
    get_or_create_daily_log,
    get_or_create_monthly_log,
    get_or_create_weekly_log,
)
from bujo.services.state_machine import transition_task
from bujo.services.tasks import create_task, set_lineage_fields
from core.calendar import today_for, week_start_of


def _migrate_subtree(
    source, *, user, container_field, container, scheduled_date, parent_task, new_status
) -> Task:
    """Recursivo (AD-08 item 11) — migra `source` e, em seguida, só os filhos
    ainda não-dispostos (`pending`/`started`); filhos `completed`/`cancelled`
    ficam intocados na origem. Ordem importa: transicionar a origem PRIMEIRO
    (fail-fast via `transition_task`, que já impõe a matriz `ALLOWED`) e só
    depois criar o novo registro."""
    transition_task(user=user, task_id=source.id, to_status=new_status)  # fail-fast; via ALLOWED
    new_task = create_task(
        user=user,
        parent_task=parent_task,
        scheduled_date=scheduled_date,
        title=source.title,
        description=source.description,
        eisenhower=source.eisenhower,
        category=source.category,
        **{container_field: container},
    )
    set_lineage_fields(task_id=new_task.id, migration_count=source.migration_count + 1)
    set_lineage_fields(task_id=source.id, migrated_to_task=new_task)

    pending_children = source.subtasks.filter(status__in=(Task.Status.PENDING, Task.Status.STARTED))
    for child in list(pending_children):
        _migrate_subtree(
            child,
            user=user,
            container_field=container_field,
            container=container,
            scheduled_date=None,  # subtarefa não carrega scheduled_date próprio
            parent_task=new_task,
            new_status=new_status,
        )
    return new_task


@transaction.atomic
def migrate_task(*, user, task_id, destination, month_first=None, scheduled_date=None) -> Task:
    """destination: "today" | "week" | "month" | "future" | "cancel".
    "today"  -> destino = Daily Log de hoje; origem vira MIGRATED.
    "week"   -> destino = Weekly Log da SEMANA CORRENTE (week_start calculado
                 aqui via today_for, NUNCA aceito do cliente); origem vira MIGRATED.
    "month"  -> destino = Monthly Log do MÊS CORRENTE (month_first calculado
                 aqui via today_for, NUNCA aceito do cliente); scheduled_date
                 obrigatório; origem vira POSTPONED.
    "future" -> destino = Monthly Log de month_first (validado > mês corrente
                 na view); scheduled_date opcional; origem vira POSTPONED.
    "cancel" -> sem destino; origem vira CANCELLED via transition_task; sem
                 lineage (sem migrated_to_task, sem novo registro).
    """
    task = Task.objects.get(id=task_id)  # auto-escopado por tenant

    if destination == "cancel":
        return transition_task(user=user, task_id=task_id, to_status=Task.Status.CANCELLED)

    if destination == "today":
        container_field = "log"
        container = get_or_create_daily_log(user=user, log_date=today_for(user))
        new_status, root_scheduled_date = Task.Status.MIGRATED, None
    elif destination == "week":
        container_field = "weekly_log"
        container = get_or_create_weekly_log(user=user, week_start=week_start_of(today_for(user)))
        new_status, root_scheduled_date = Task.Status.MIGRATED, None
    else:  # "month" ou "future"
        container_field = "monthly_log"
        container = get_or_create_monthly_log(user=user, month_first=month_first)
        new_status, root_scheduled_date = Task.Status.POSTPONED, scheduled_date

    _migrate_subtree(
        task,
        user=user,
        container_field=container_field,
        container=container,
        scheduled_date=root_scheduled_date,
        parent_task=None,
        new_status=new_status,
    )
    return Task.objects.get(id=task.id)  # recarrega com status/migrated_to_task atualizados
