"""Factories de `Log`/`Task` e registro no contrato de isolamento (§7.4).

`user_id` é um `UUIDField` puro (não FK) em `TenantModel` — o model não tem
campo `user`, então `factory.SubFactory(UserFactory)` não pode ser um atributo
direto. O padrão usa `class Params` (parâmetro auxiliar não passado ao model)
+ `SelfAttribute`.

Atenção ao guardrail temporal (`core/tests/test_guardrails.py`): este arquivo
não é `test_*.py`/`conftest.py`, então continua coberto pelo scanner que proíbe
`date.today()` fora de `core/calendar.py` — por isso `log_date` usa uma data
fixa + `timedelta`, nunca `date.today()`.
"""

from datetime import date, timedelta

import factory
from factory.django import DjangoModelFactory

from accounts.tests.factories import UserFactory
from bujo.models import Log, MonthlyLog, RecurringTaskTemplate, Task, WeeklyLog
from core.calendar import week_start_of
from core.tests.registry import register_isolation_case


class LogFactory(DjangoModelFactory):
    class Meta:
        model = Log

    class Params:
        user = factory.SubFactory(UserFactory)

    user_id = factory.SelfAttribute("user.id")
    log_date = factory.Sequence(lambda n: date(2026, 1, 1) + timedelta(days=n))


class WeeklyLogFactory(DjangoModelFactory):
    class Meta:
        model = WeeklyLog

    class Params:
        user = factory.SubFactory(UserFactory)

    user_id = factory.SelfAttribute("user.id")
    # week_start_of garante segunda-feira mesmo com o Sequence avançando por semanas.
    week_start = factory.Sequence(
        lambda n: week_start_of(date(2026, 1, 1) + timedelta(weeks=n))
    )
    # `status` fica no default `None` (fora do regime operacional) DE PROPÓSITO e
    # nunca deve receber outro default: as uniques parciais da Story 14.1 admitem
    # no máximo um `active` e um `planning` por usuário, então um default não-nulo
    # estouraria `IntegrityError` em massa nos testes que criam vários logs para o
    # mesmo `user`. Quem precisa de estado passa `status=` explicitamente.


class MonthlyLogFactory(DjangoModelFactory):
    class Meta:
        model = MonthlyLog

    class Params:
        user = factory.SubFactory(UserFactory)

    user_id = factory.SelfAttribute("user.id")
    month_first = factory.Sequence(
        lambda n: date(2026, 1, 1).replace(year=2026 + (n // 12), month=(n % 12) + 1)
    )
    # Mesmo motivo do `WeeklyLogFactory`: `status` permanece no default `None`.


class TaskFactory(DjangoModelFactory):
    class Meta:
        model = Task

    class Params:
        user = factory.SubFactory(UserFactory)

    user_id = factory.SelfAttribute("user.id")
    # Default: daily log (comportamento pré-existente). Passar weekly_log= ou
    # monthly_log= explicitamente sobrescreve `log` para None — o CHECK
    # task_exactly_one_log exige exatamente um container preenchido.
    weekly_log = None
    monthly_log = None
    log = factory.LazyAttribute(
        lambda o: None
        if (o.weekly_log is not None or o.monthly_log is not None)
        else LogFactory(user=o.user)
    )
    title = factory.Sequence(lambda n: f"Tarefa {n}")
    order_index = factory.Sequence(lambda n: float(n))


class RecurringTaskTemplateFactory(DjangoModelFactory):
    class Meta:
        model = RecurringTaskTemplate

    class Params:
        user = factory.SubFactory(UserFactory)

    user_id = factory.SelfAttribute("user.id")
    title = factory.Sequence(lambda n: f"Template {n}")
    recurrence_group = RecurringTaskTemplate.RecurrenceGroup.WEEKLY
    recurrence_text = "toda segunda"
    active = True


register_isolation_case(
    id="bujo.Log",
    model=Log,
    make=lambda: {"log_date": date(2026, 1, 1)},
)
register_isolation_case(
    id="bujo.Task",
    model=Task,
    make=lambda: {
        "log": Log.objects.create(log_date=date(2026, 1, 1)),
        "title": "Tarefa de isolamento",
        "order_index": 0.0,
    },
)
register_isolation_case(
    id="bujo.WeeklyLog",
    model=WeeklyLog,
    make=lambda: {"week_start": week_start_of(date(2026, 1, 5))},
)
register_isolation_case(
    id="bujo.MonthlyLog",
    model=MonthlyLog,
    make=lambda: {"month_first": date(2026, 1, 1)},
)
register_isolation_case(
    id="bujo.RecurringTaskTemplate",
    model=RecurringTaskTemplate,
    make=lambda: {
        "title": "Template de isolamento",
        "recurrence_group": "weekly",
        "recurrence_text": "toda segunda",
    },
)
