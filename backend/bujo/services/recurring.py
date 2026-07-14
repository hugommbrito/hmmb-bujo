"""Criação/edição/placement de `RecurringTaskTemplate` (§6.2, AD-08). Sem
validação de forma/enum — isso já foi feito pelo serializer na view; o
serviço assume dados validados.
"""

from django.db import transaction

from bujo.models import RecurringTaskTemplate, Task
from bujo.services.logs import get_or_create_monthly_log, get_or_create_weekly_log
from bujo.services.tasks import create_task
from core.exceptions import WrongPlacementContainer


@transaction.atomic
def create_template(*, user, **fields) -> RecurringTaskTemplate:
    return RecurringTaskTemplate.objects.create(**fields)


@transaction.atomic
def update_template(*, user, template_id, **fields) -> RecurringTaskTemplate:
    template = RecurringTaskTemplate.objects.get(id=template_id)  # auto-escopado por tenant
    for field, value in fields.items():
        setattr(template, field, value)
    template.save(update_fields=[*fields.keys()])
    return template


@transaction.atomic
def place_template(
    *, user, template_id, week_start=None, month_first=None, scheduled_date=None
) -> Task:
    """Copia os campos do template no instante do placement — a `Task`
    resultante nunca relê o template depois (AC #3, snapshot). `source_template`
    existe só para linhagem/auditoria."""
    template = RecurringTaskTemplate.objects.get(id=template_id)  # auto-escopado; 404 na view
    common = dict(
        title=template.title,
        description=template.description,
        eisenhower=template.eisenhower,
        source_template=template,
    )
    if template.recurrence_group == RecurringTaskTemplate.RecurrenceGroup.WEEKLY:
        if week_start is None:
            raise WrongPlacementContainer("Template weekly requer week_start.")
        container = get_or_create_weekly_log(user=user, week_start=week_start)
        return create_task(user=user, weekly_log=container, scheduled_date=scheduled_date, **common)
    # monthly E annual colocam no mesmo container (Monthly Log) — AD-08 item 5:
    # recurrence_group só controla EM QUAL abertura de ciclo o template é
    # apresentado, não onde a instância é colocada. Não existe "log anual".
    if month_first is None:
        raise WrongPlacementContainer("Template monthly/annual requer month_first.")
    container = get_or_create_monthly_log(user=user, month_first=month_first)
    return create_task(user=user, monthly_log=container, scheduled_date=scheduled_date, **common)
