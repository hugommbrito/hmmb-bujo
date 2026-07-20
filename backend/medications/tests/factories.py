"""Factories de medicamentos + registro no contrato de isolamento (§7.4).

``user_id`` é ``UUIDField`` puro em ``TenantModel`` (não FK), então o padrão usa
``class Params`` + ``SelfAttribute`` (mesmo de ``habits.tests.factories``). Guardrail
temporal: este arquivo não é ``test_*.py``/``conftest.py``, mas o scanner que proíbe
``date.today()`` cobre factories — as datas são constantes fixas + ``timedelta``, nunca
``date.today()`` (os testes de serviço que precisam de "hoje" usam ``today_for``).

Registra os **6** models de ``TenantModel`` no contrato de isolamento parametrizado
(``medications.tests.factories`` está em ``_ISOLATION_TEST_MODULES`` no ``conftest.py``):
cross-tenant 404 **e** fail-closed ``TenantScopeViolation``.
"""

from datetime import date, timedelta

import factory
from factory.django import DjangoModelFactory

from accounts.tests.factories import UserFactory
from core.tests.registry import register_isolation_case
from medications.models import (
    Doctor,
    Medication,
    MedicationDayEntry,
    MedicationScheduleVersion,
    MedicationSubstanceVersion,
    TimeBlock,
)

# Data fixa das factories/isolation (guardrail temporal: nunca ``date.today()``,
# mesmo em factories).
_FIXED_DATE = date(2026, 1, 15)


class DoctorFactory(DjangoModelFactory):
    class Meta:
        model = Doctor

    class Params:
        user = factory.SubFactory(UserFactory)

    user_id = factory.SelfAttribute("user.id")
    name = factory.Sequence(lambda n: f"Dr. {n}")


class TimeBlockFactory(DjangoModelFactory):
    class Meta:
        model = TimeBlock

    class Params:
        user = factory.SubFactory(UserFactory)

    user_id = factory.SelfAttribute("user.id")
    name = factory.Sequence(lambda n: f"Bloco {n}")
    display_order = factory.Sequence(lambda n: n)
    active = True


class MedicationFactory(DjangoModelFactory):
    class Meta:
        model = Medication

    class Params:
        user = factory.SubFactory(UserFactory)

    user_id = factory.SelfAttribute("user.id")
    title = factory.Sequence(lambda n: f"Medicamento {n}")


class MedicationSubstanceVersionFactory(DjangoModelFactory):
    class Meta:
        model = MedicationSubstanceVersion

    class Params:
        user = factory.SubFactory(UserFactory)

    user_id = factory.SelfAttribute("user.id")
    medication = factory.LazyAttribute(lambda o: MedicationFactory(user=o.user))
    substance_name = factory.Sequence(lambda n: f"Substância {n}")
    laboratory = None
    prescribed_by = None
    effective_from = factory.Sequence(lambda n: _FIXED_DATE + timedelta(days=n))


class MedicationScheduleVersionFactory(DjangoModelFactory):
    class Meta:
        model = MedicationScheduleVersion

    class Params:
        user = factory.SubFactory(UserFactory)

    user_id = factory.SelfAttribute("user.id")
    medication = factory.LazyAttribute(lambda o: MedicationFactory(user=o.user))
    time_block = factory.LazyAttribute(lambda o: TimeBlockFactory(user=o.user))
    dose = factory.List([factory.Dict({"label": "", "amount": 1, "unit": "comp"})])
    active = True
    effective_from = factory.Sequence(lambda n: _FIXED_DATE + timedelta(days=n))


class MedicationDayEntryFactory(DjangoModelFactory):
    """Linha realizada por dia (Story 8.2). ``confirmed_at`` nulo (= não confirmado) e
    ``source=scheduled`` por default; sobrescreva para cenários ``ad_hoc``/confirmados."""

    class Meta:
        model = MedicationDayEntry

    class Params:
        user = factory.SubFactory(UserFactory)

    user_id = factory.SelfAttribute("user.id")
    medication = factory.LazyAttribute(lambda o: MedicationFactory(user=o.user))
    time_block = factory.LazyAttribute(lambda o: TimeBlockFactory(user=o.user))
    date = factory.Sequence(lambda n: _FIXED_DATE + timedelta(days=n))
    dose_at_time = factory.List([factory.Dict({"label": "", "amount": 1, "unit": "comp"})])
    confirmed_at = None
    source = "scheduled"


# --- Contrato de isolamento parametrizado (um caso por model TenantModel) -------
register_isolation_case(
    id="medications.Doctor",
    model=Doctor,
    make=lambda: {"name": "Dr. Isolamento"},
)

register_isolation_case(
    id="medications.TimeBlock",
    model=TimeBlock,
    make=lambda: {"name": "Bloco de isolamento", "display_order": 0},
)

register_isolation_case(
    id="medications.Medication",
    model=Medication,
    make=lambda: {"title": "Medicamento de isolamento"},
)

register_isolation_case(
    id="medications.MedicationSubstanceVersion",
    model=MedicationSubstanceVersion,
    make=lambda: {
        "medication": Medication.objects.create(title="Med iso subst"),
        "substance_name": "Substância iso",
        "effective_from": _FIXED_DATE,
    },
)

register_isolation_case(
    id="medications.MedicationScheduleVersion",
    model=MedicationScheduleVersion,
    make=lambda: {
        "medication": Medication.objects.create(title="Med iso sched"),
        "time_block": TimeBlock.objects.create(name="Bloco iso sched", display_order=0),
        "dose": [{"label": "", "amount": 1, "unit": "comp"}],
        "effective_from": _FIXED_DATE,
    },
)

register_isolation_case(
    id="medications.MedicationDayEntry",
    model=MedicationDayEntry,
    make=lambda: {
        "medication": Medication.objects.create(title="Med iso day"),
        "time_block": TimeBlock.objects.create(name="Bloco iso day", display_order=0),
        "date": _FIXED_DATE,
        "dose_at_time": [{"label": "", "amount": 1, "unit": "comp"}],
        "source": "scheduled",
    },
)
