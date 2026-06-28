import factory
from factory.django import DjangoModelFactory

from accounts.models import User


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
