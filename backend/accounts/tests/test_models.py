import uuid

import pytest
from django.db import IntegrityError

from accounts.tests.factories import UserFactory


def test_user_pk_e_uuid():
    user = UserFactory()
    assert isinstance(user.id, uuid.UUID)


def test_email_e_unico():
    user = UserFactory()
    with pytest.raises(IntegrityError):
        UserFactory(email=user.email)


def test_password_e_hasheado():
    user = UserFactory()
    assert "senha-segura-123" not in user.password
    assert user.password.startswith(("pbkdf2_", "argon2", "bcrypt", "!"))


def test_timezone_default():
    from accounts.models import User
    user = User.objects.create_user(email="tztest@example.com", password="senha-segura-123")
    assert user.timezone == "America/Sao_Paulo"


def test_check_password():
    user = UserFactory()
    assert user.check_password("senha-segura-123") is True


def test_user_is_active_default_true():
    from accounts.models import User
    user = User.objects.create_user(email="ativo@example.com", password="senha-segura-123")
    assert user.is_active is True


def test_create_superuser_e_staff_e_superuser():
    from accounts.models import User
    su = User.objects.create_superuser(email="admin@example.com", password="senha-segura-123")
    assert su.is_staff is True
    assert su.is_superuser is True


def test_create_user_sem_email_levanta_valueerror():
    from accounts.models import User
    with pytest.raises(ValueError, match="Email"):
        User.objects.create_user(email="", password="senha-segura-123")


# --- UntrackedDay (Story 16.2c) ------------------------------------------------


def test_untracked_day_unique_per_user_date_collection(user):
    from datetime import date

    from django.db import transaction

    from accounts.models import UntrackedCollection, UntrackedDay
    from core.tenant import tenant_context

    with tenant_context(user):
        UntrackedDay.objects.create(date=date(2026, 1, 5), collection=UntrackedCollection.HABITS)
        # Outra collection no MESMO dia é permitida (escopo por collection).
        UntrackedDay.objects.create(
            date=date(2026, 1, 5), collection=UntrackedCollection.MEDICATIONS
        )
        with pytest.raises(IntegrityError), transaction.atomic():
            UntrackedDay.objects.create(
                date=date(2026, 1, 5), collection=UntrackedCollection.HABITS
            )


def test_untracked_day_check_constraint_rejects_unknown_collection(user):
    from datetime import date

    from django.db import transaction

    from accounts.models import UntrackedDay
    from core.tenant import tenant_context

    with tenant_context(user):
        with pytest.raises(IntegrityError), transaction.atomic():
            UntrackedDay.objects.create(date=date(2026, 1, 5), collection="health")


def test_untracked_day_table_and_ordering():
    from accounts.models import UntrackedDay

    assert UntrackedDay._meta.db_table == "user_untracked_days"
    assert UntrackedDay._meta.ordering == ["date"]
