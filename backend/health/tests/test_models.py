"""Testes de model das Métricas de Saúde: constraints de banco e defaults (AD-01)."""

import uuid
from datetime import date

import pytest
from django.db import IntegrityError, transaction

from core.tenant import tenant_context
from health.models import HealthFieldDefinition, HealthFieldType, HealthLog
from health.tests.factories import HealthFieldDefinitionFactory, HealthLogFactory


def test_field_type_check_constraint_rejects_invalid_type(user):
    """(b) field_type fora do enum → IntegrityError (CheckConstraint no DB)."""
    with tenant_context(user):
        with pytest.raises(IntegrityError), transaction.atomic():
            HealthFieldDefinition.objects.create(name="Ruim", field_type="invalido")


def test_all_valid_field_types_are_accepted(user):
    with tenant_context(user):
        for field_type in HealthFieldType.values:
            field = HealthFieldDefinition.objects.create(
                name=f"Campo {field_type}", field_type=field_type
            )
            assert field.field_type == field_type


def test_default_active_is_true(user):
    with tenant_context(user):
        field = HealthFieldDefinition.objects.create(
            name="Peso", field_type=HealthFieldType.DECIMAL
        )
        assert field.active is True


def test_default_display_order_zero_and_enum_options_empty(user):
    with tenant_context(user):
        field = HealthFieldDefinition.objects.create(
            name="Sono", field_type=HealthFieldType.INTEGER
        )
        assert field.display_order == 0
        assert field.enum_options == []


def test_id_is_stable_uuid(user):
    """(a) o id é um UUID (a chave estável usada por health_logs.values na 7.2)."""
    with tenant_context(user):
        field = HealthFieldDefinitionFactory(user=user)
        assert isinstance(field.id, uuid.UUID)


def test_created_at_is_set(user):
    with tenant_context(user):
        field = HealthFieldDefinitionFactory(user=user)
        assert field.created_at is not None


def test_ordering_is_display_order_then_name(user):
    with tenant_context(user):
        HealthFieldDefinitionFactory(user=user, name="Zeta", display_order=1)
        HealthFieldDefinitionFactory(user=user, name="Beta", display_order=0)
        HealthFieldDefinitionFactory(user=user, name="Alfa", display_order=0)
        names = [f.name for f in HealthFieldDefinition.objects.all()]
        # display_order 0 primeiro (Alfa, Beta por nome), depois display_order 1 (Zeta).
        assert names == ["Alfa", "Beta", "Zeta"]


# --- HealthLog (Story 7.2, AC1/AC4) --------------------------------------------
def test_health_log_unique_per_user_and_date(user):
    """Uma única linha por (user_id, date): segundo insert do mesmo dia → IntegrityError."""
    with tenant_context(user):
        HealthLog.objects.create(date=date(2026, 1, 20), values={})
        with pytest.raises(IntegrityError), transaction.atomic():
            HealthLog.objects.create(date=date(2026, 1, 20), values={})


def test_health_log_same_date_different_users_ok(user, other_user):
    """A unicidade é por (user_id, date): usuários distintos podem ter o mesmo dia."""
    with tenant_context(user):
        HealthLog.objects.create(date=date(2026, 1, 20), values={})
    with tenant_context(other_user):
        # Não colide — user_id diferente faz parte da chave única.
        HealthLog.objects.create(date=date(2026, 1, 20), values={})


def test_health_log_values_default_empty_dict(user):
    with tenant_context(user):
        row = HealthLog.objects.create(date=date(2026, 1, 21))
        assert row.values == {}


def test_health_log_id_is_uuid_and_created_at_set(user):
    with tenant_context(user):
        row = HealthLogFactory(user=user)
        assert isinstance(row.id, uuid.UUID)
        assert row.created_at is not None
