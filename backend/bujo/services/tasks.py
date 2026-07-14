"""Criação/edição de `Task` (§6.2, §6.6). Sem validação de forma/enum — isso
já foi feito pelo serializer na view; o serviço assume dados validados.
"""

from django.db import models, transaction

from bujo.models import Task
from core.exceptions import InvalidReorderTarget


@transaction.atomic
def create_task(
    *,
    user,
    log=None,
    weekly_log=None,
    monthly_log=None,
    scheduled_date=None,
    title,
    description=None,
    eisenhower=None,
    category=None,
    parent_task=None,
    source_template=None,
) -> Task:
    """`order_index` é sempre calculado por irmãos (mesmo container —
    `log`/`weekly_log`/`monthly_log` — + `parent_task` idênticos) — uma
    subtarefa nunca compete por posição com a tarefa-pai nem com filhos de
    outro pai (AD-08 item 12). O CHECK `task_exactly_one_log` garante no banco
    que o chamador passou exatamente um container."""
    siblings = Task.objects.filter(
        log=log, weekly_log=weekly_log, monthly_log=monthly_log, parent_task=parent_task
    )
    max_order = siblings.aggregate(models.Max("order_index"))["order_index__max"]
    order_index = 0.0 if max_order is None else max_order + 1.0
    return Task.objects.create(
        log=log,
        weekly_log=weekly_log,
        monthly_log=monthly_log,
        scheduled_date=scheduled_date,
        parent_task=parent_task,
        source_template=source_template,
        title=title,
        description=description,
        eisenhower=eisenhower,
        category=category,
        order_index=order_index,
        status=Task.Status.PENDING,
    )


@transaction.atomic
def update_task(*, user, task_id, **fields) -> Task:
    task = Task.objects.get(id=task_id)  # objects = auto-escopado por tenant
    for field, value in fields.items():
        setattr(task, field, value)
    task.save(update_fields=[*fields.keys(), "updated_at"])
    return task


@transaction.atomic
def reorder_task(*, user, task_id, target_task_id, position) -> Task:
    """Reposiciona `task` como vizinha imediata de `target_task_id`, recalculando
    `order_index` por bisseção entre os dois vizinhos que vão ladear a tarefa
    após o move (mesmo índice fracionário de `create_task`, que soma `+1.0`)."""
    if str(task_id) == str(target_task_id):
        raise InvalidReorderTarget(task_id, target_task_id)
    task = Task.objects.get(id=task_id)  # objects = auto-escopado por tenant
    target = Task.objects.get(id=target_task_id)  # idem — DoesNotExist -> 404 na view

    siblings = list(
        Task.objects.filter(
            log=task.log,
            weekly_log=task.weekly_log,
            monthly_log=task.monthly_log,
            parent_task=task.parent_task,
        )
        .exclude(id=task.id)
        .order_by("order_index")
    )
    if target not in siblings:
        # `target` existe (passou no .get() acima, escopado por tenant) mas
        # não é irmão de `task` (log ou parent_task diferentes) — 409, não 404.
        raise InvalidReorderTarget(task_id, target_task_id)

    idx = siblings.index(target)
    if position == "after":
        neighbor = siblings[idx + 1] if idx + 1 < len(siblings) else None
        low, high = target.order_index, (neighbor.order_index if neighbor else None)
    else:  # "before"
        neighbor = siblings[idx - 1] if idx > 0 else None
        low, high = (neighbor.order_index if neighbor else None), target.order_index

    if low is None:
        new_order = high - 1.0
    elif high is None:
        new_order = low + 1.0
    else:
        new_order = (low + high) / 2

    task.order_index = new_order
    task.save(update_fields=["order_index", "updated_at"])
    return task
