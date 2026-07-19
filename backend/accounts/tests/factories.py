from datetime import date, timedelta

import factory
from factory.django import DjangoModelFactory

from accounts.models import User, UserHoliday
from core.tests.registry import register_isolation_case


class UserFactory(DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    email = factory.Sequence(lambda n: f"user{n}@test.com")
    timezone = "America/Sao_Paulo"
    is_active = True
    is_staff = False

    @factory.post_generation
    def password(self, create, extracted, **kwargs):
        raw = extracted if extracted is not None else "senha-segura-123"
        self.set_password(raw)
        if create:
            self.save()


class UserHolidayFactory(DjangoModelFactory):
    """Feriado manual (Story 6.3). ``user_id`` é UUIDField puro em ``TenantModel``
    (não FK), então usa ``class Params`` + ``SelfAttribute`` (padrão de habits/bujo).
    Guardrail temporal: datas fixas + ``timedelta``, nunca ``date.today()``."""

    class Meta:
        model = UserHoliday

    class Params:
        user = factory.SubFactory(UserFactory)

    user_id = factory.SelfAttribute("user.id")
    date = factory.Sequence(lambda n: date(2026, 1, 1) + timedelta(days=n))


register_isolation_case(
    id="accounts.UserHoliday",
    model=UserHoliday,
    make=lambda: {"date": date(2026, 1, 1)},
)
