"""Criação/edição de `Task` (§6.2, §6.6). Sem validação de forma/enum — isso
já foi feito pelo serializer na view; o serviço assume dados validados.
"""

from django.db import models, transaction

from bujo.models import Task


@transaction.atomic
def create_task(
    *, user, log, title, description=None, eisenhower=None, category=None, parent_task=None
) -> Task:
    """`order_index` é sempre calculado por irmãos (`log` + `parent_task`
    idênticos) — uma subtarefa nunca compete por posição com a tarefa-pai nem
    com filhos de outro pai (AD-08 item 12)."""
    siblings = Task.objects.filter(log=log, parent_task=parent_task)
    max_order = siblings.aggregate(models.Max("order_index"))["order_index__max"]
    order_index = 0.0 if max_order is None else max_order + 1.0
    return Task.objects.create(
        log=log,
        parent_task=parent_task,
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
