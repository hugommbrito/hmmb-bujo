"""Factory de gratidão + registro no contrato de isolamento (§7.4).

``user_id`` é ``UUIDField`` puro em ``TenantModel`` (não FK), então o padrão usa
``class Params`` + ``SelfAttribute`` (mesmo de ``medications.tests.factories``).
Guardrail temporal: este arquivo não é ``test_*.py``/``conftest.py``, mas o scanner que
proíbe ``date.today()`` cobre factories — a data é constante fixa + ``timedelta``, nunca
``date.today()``.

Registra o único model de ``TenantModel`` do app no contrato parametrizado
(``gratitude.tests.factories`` está em ``_ISOLATION_TEST_MODULES`` no ``conftest.py``):
per-tenant scoping + auto-fill de ``user_id`` (AC8), além do fail-closed provado uma vez
contra o test model de ``core``.
"""

from datetime import date, timedelta

import factory
from factory.django import DjangoModelFactory

from accounts.tests.factories import UserFactory
from core.tests.registry import register_isolation_case
from gratitude.models import GratitudeEntry

# Data fixa das factories/isolation (guardrail temporal: nunca ``date.today()``).
_FIXED_DATE = date(2026, 1, 15)


class GratitudeEntryFactory(DjangoModelFactory):
    class Meta:
        model = GratitudeEntry

    class Params:
        user = factory.SubFactory(UserFactory)

    user_id = factory.SelfAttribute("user.id")
    date = factory.Sequence(lambda n: _FIXED_DATE + timedelta(days=n))
    text = factory.Sequence(lambda n: f"Grato por algo {n}")


# --- Contrato de isolamento parametrizado (um caso por model TenantModel) -------
register_isolation_case(
    id="gratitude.GratitudeEntry",
    model=GratitudeEntry,
    make=lambda: {"date": _FIXED_DATE, "text": "Gratidão de isolamento"},
)
