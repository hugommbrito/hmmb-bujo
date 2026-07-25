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

from datetime import UTC, date, datetime, timedelta

import factory
from factory.django import DjangoModelFactory

from accounts.tests.factories import UserFactory
from bujo.models import (
    Log,
    MonthlyLog,
    RecurringTaskTemplate,
    RitualDecision,
    RitualDecisionKind,
    Task,
    WeeklyLog,
)
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
        # Soft delete (Story 14.4): `RecurringTaskTemplateFactory(user=u, deleted=True)`.
        # Data FIXA e nunca `now()` — o guardrail temporal de AST varre este
        # arquivo (só `test_*.py`/`conftest.py` são pulados), e o instante em si
        # é irrelevante para os testes: o que importa é `IS NOT NULL`.
        deleted = factory.Trait(deleted_at=datetime(2026, 1, 1, tzinfo=UTC))

    user_id = factory.SelfAttribute("user.id")
    title = factory.Sequence(lambda n: f"Template {n}")
    recurrence_group = RecurringTaskTemplate.RecurrenceGroup.WEEKLY
    recurrence_text = "toda segunda"
    active = True


class RitualDecisionFactory(DjangoModelFactory):
    """Decisão-snapshot (Story 14.2). Default = o par legal mais simples:
    alvo weekly × item Task, decisão ``keep``.

    Nenhum default para `monthly_log`/`recurring_template`: os CHECKs
    *exactly-one* exigem que quem quiser a outra âncora passe `weekly_log=None`
    (ou `task=None`) explicitamente, e é bom que isso seja visível no teste.
    """

    class Meta:
        model = RitualDecision

    class Params:
        user = factory.SubFactory(UserFactory)

    user_id = factory.SelfAttribute("user.id")
    weekly_log = factory.LazyAttribute(
        lambda o: None if o.monthly_log is not None else WeeklyLogFactory(user=o.user)
    )
    monthly_log = None
    task = factory.LazyAttribute(
        lambda o: None
        if o.recurring_template is not None
        else TaskFactory(user=o.user, weekly_log=o.weekly_log, monthly_log=o.monthly_log)
    )
    recurring_template = None
    decision = RitualDecisionKind.KEEP


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
register_isolation_case(
    id="bujo.RitualDecision",
    model=RitualDecision,
    # Sem `user_id` no `make` (o auto-fill FAZ PARTE do contrato) e as duas
    # âncoras exatamente-um satisfeitas: alvo weekly + item template — o par de
    # `skip_week`, que é o único cujo item não é uma Task.
    make=lambda: {
        "weekly_log": WeeklyLog.objects.create(week_start=week_start_of(date(2026, 2, 2))),
        "recurring_template": RecurringTaskTemplate.objects.create(
            title="Template da decisão de isolamento",
            recurrence_group="weekly",
            recurrence_text="toda segunda",
        ),
        "decision": RitualDecisionKind.SKIP_WEEK,
    },
)
