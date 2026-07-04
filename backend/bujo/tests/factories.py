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
from bujo.models import Log, Task
from core.tests.registry import register_isolation_case


class LogFactory(DjangoModelFactory):
    class Meta:
        model = Log

    class Params:
        user = factory.SubFactory(UserFactory)

    user_id = factory.SelfAttribute("user.id")
    log_date = factory.Sequence(lambda n: date(2026, 1, 1) + timedelta(days=n))


class TaskFactory(DjangoModelFactory):
    class Meta:
        model = Task

    class Params:
        user = factory.SubFactory(UserFactory)

    user_id = factory.SelfAttribute("user.id")
    log = factory.SubFactory(LogFactory, user=factory.SelfAttribute("..user"))
    title = factory.Sequence(lambda n: f"Tarefa {n}")
    order_index = factory.Sequence(lambda n: float(n))


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
