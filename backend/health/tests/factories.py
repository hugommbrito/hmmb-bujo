"""Factories de saúde + registro no contrato de isolamento (§7.4).

``user_id`` é ``UUIDField`` puro em ``TenantModel`` (não FK), então o padrão usa
``class Params`` + ``SelfAttribute`` (mesmo de ``habits.tests.factories``). Guardrail
temporal: este arquivo não é ``test_*.py``/``conftest.py``, mas o scanner que proíbe
``date.today()`` cobre factories — não há datas aqui (a definição só tem
``created_at`` auto).
"""

import factory
from factory.django import DjangoModelFactory

from accounts.tests.factories import UserFactory
from core.tests.registry import register_isolation_case
from health.models import HealthFieldDefinition, HealthFieldType


class HealthFieldDefinitionFactory(DjangoModelFactory):
    class Meta:
        model = HealthFieldDefinition

    class Params:
        user = factory.SubFactory(UserFactory)

    user_id = factory.SelfAttribute("user.id")
    name = factory.Sequence(lambda n: f"Campo {n}")
    field_type = HealthFieldType.INTEGER
    enum_options = factory.List([])
    active = True
    display_order = factory.Sequence(lambda n: n)


register_isolation_case(
    id="health.HealthFieldDefinition",
    model=HealthFieldDefinition,
    make=lambda: {"name": "Campo de isolamento", "field_type": HealthFieldType.INTEGER},
)
