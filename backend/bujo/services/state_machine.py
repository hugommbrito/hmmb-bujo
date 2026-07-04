"""Máquina de estados de `Task` (AD-02, §6.10).

A matriz `ALLOWED` é a única fonte de verdade sobre transições legais. Qual
caller/UI aciona uma transição (clique, menu, fluxo de migração, edição
manual) é responsabilidade de quem chama `transition_task` — o serviço impõe
a matriz inteira, não uma função por gatilho.
"""

from django.db import transaction

from bujo.models import Task
from core.exceptions import InvalidTransition

Status = Task.Status

# Auto-transições (ex.: pending -> pending) NÃO estão presentes em nenhum
# conjunto abaixo — contam como ilegais também.
ALLOWED = {
    Status.PENDING: {
        Status.STARTED,
        Status.COMPLETED,
        Status.CANCELLED,
        Status.MIGRATED,
        Status.POSTPONED,
    },
    Status.STARTED: {
        Status.PENDING,
        Status.COMPLETED,
        Status.CANCELLED,
        Status.MIGRATED,
        Status.POSTPONED,
    },
    Status.COMPLETED: {
        Status.PENDING,
        Status.STARTED,
        Status.CANCELLED,
    },
    Status.CANCELLED: {
        Status.PENDING,
    },
    Status.MIGRATED: set(),
    Status.POSTPONED: set(),
}


@transaction.atomic
def transition_task(*, user, task_id, to_status) -> Task:
    task = Task.objects.get(id=task_id)  # objects = auto-escopado por user
    if to_status not in ALLOWED[task.status]:
        raise InvalidTransition(task.status, to_status)
    task.status = to_status
    task.save(update_fields=["status"])
    return task
