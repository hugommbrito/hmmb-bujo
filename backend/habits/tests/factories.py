"""Factories de hábitos + registro no contrato de isolamento (§7.4).

``user_id`` é ``UUIDField`` puro em ``TenantModel`` (não FK), então o padrão usa
``class Params`` + ``SelfAttribute`` (mesmo de ``bujo.tests.factories``). Guardrail
temporal: este arquivo não é ``test_*.py``/``conftest.py``, então continua coberto
pelo scanner que proíbe ``date.today()`` — as datas são fixas + ``timedelta``.
"""

from datetime import date, timedelta
from decimal import Decimal

import factory
from factory.django import DjangoModelFactory

from accounts.tests.factories import UserFactory
from core.tests.registry import register_isolation_case
from habits.models import Habit, HabitGroup, HabitVersion


class HabitGroupFactory(DjangoModelFactory):
    class Meta:
        model = HabitGroup

    class Params:
        user = factory.SubFactory(UserFactory)

    user_id = factory.SelfAttribute("user.id")
    name = factory.Sequence(lambda n: f"Grupo {n}")


class HabitFactory(DjangoModelFactory):
    class Meta:
        model = Habit

    class Params:
        user = factory.SubFactory(UserFactory)

    user_id = factory.SelfAttribute("user.id")
    name = factory.Sequence(lambda n: f"Hábito {n}")
    emoticon = "✅"
    type = Habit.Type.BOOLEAN
    group = factory.LazyAttribute(lambda o: HabitGroupFactory(user=o.user))


class HabitVersionFactory(DjangoModelFactory):
    class Meta:
        model = HabitVersion

    class Params:
        user = factory.SubFactory(UserFactory)

    user_id = factory.SelfAttribute("user.id")
    habit = factory.LazyAttribute(lambda o: HabitFactory(user=o.user))
    weight = Decimal("1.00")
    active = True
    effective_from = factory.Sequence(lambda n: date(2026, 1, 1) + timedelta(days=n))


register_isolation_case(
    id="habits.HabitGroup",
    model=HabitGroup,
    make=lambda: {"name": "Grupo de isolamento"},
)
register_isolation_case(
    id="habits.Habit",
    model=Habit,
    make=lambda: {
        "name": "Hábito de isolamento",
        "type": Habit.Type.BOOLEAN,
        "group": HabitGroup.objects.create(name="Grupo iso"),
    },
)
register_isolation_case(
    id="habits.HabitVersion",
    model=HabitVersion,
    make=lambda: {
        "habit": Habit.objects.create(
            name="Hábito iso",
            type=Habit.Type.BOOLEAN,
            group=HabitGroup.objects.create(name="Grupo iso v"),
        ),
        "weight": Decimal("1.00"),
        "effective_from": date(2026, 1, 1),
    },
)
