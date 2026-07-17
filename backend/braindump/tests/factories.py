import factory
from factory.django import DjangoModelFactory

from accounts.tests.factories import UserFactory
from braindump.models import BrainDumpItem
from core.tests.registry import register_isolation_case


class BrainDumpItemFactory(DjangoModelFactory):
    class Meta:
        model = BrainDumpItem

    class Params:
        user = factory.SubFactory(UserFactory)

    user_id = factory.SelfAttribute("user.id")
    title = factory.Sequence(lambda n: f"Item {n}")


register_isolation_case(
    id="braindump.BrainDumpItem",
    model=BrainDumpItem,
    make=lambda: {"title": "Item de teste"},
)
