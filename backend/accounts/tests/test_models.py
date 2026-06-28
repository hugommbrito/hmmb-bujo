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
