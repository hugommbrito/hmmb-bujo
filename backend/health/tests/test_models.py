"""Testes de model das Métricas de Saúde: constraints de banco e defaults (AD-01)."""

import uuid

import pytest
from django.db import IntegrityError, transaction

from core.tenant import tenant_context
from health.models import HealthFieldDefinition, HealthFieldType
from health.tests.factories import HealthFieldDefinitionFactory


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
