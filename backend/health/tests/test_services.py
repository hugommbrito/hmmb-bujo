"""Testes da camada de serviço das Métricas de Saúde (AD-01, AC1–AC4)."""

import uuid

import pytest

from core.exceptions import DomainError
from core.tenant import tenant_context
from health.models import HealthFieldDefinition, HealthFieldType
from health.services import (
    create_health_field,
    list_health_fields,
    update_health_field,
)
from health.tests.factories import HealthFieldDefinitionFactory


# --- create_health_field (AC1, AC3) --------------------------------------------
def test_create_persists_fields_active_true_and_uuid(user):
    """(a) grava name/field_type, active=True por default e id UUID estável."""
    with tenant_context(user):
        field = create_health_field(
            user=user, name="Peso", field_type=HealthFieldType.DECIMAL
        )
        assert field.name == "Peso"
        assert field.field_type == HealthFieldType.DECIMAL
        assert field.active is True
        assert isinstance(field.id, uuid.UUID)
        assert field.enum_options == []


def test_create_appends_display_order_sequentially(user):
    """Sem display_order → append: primeira em 0, próxima em max+1."""
    with tenant_context(user):
        first = create_health_field(
            user=user, name="Sono", field_type=HealthFieldType.INTEGER
        )
        second = create_health_field(
            user=user, name="Passos", field_type=HealthFieldType.INTEGER
        )
        assert first.display_order == 0
        assert second.display_order == 1


def test_create_respects_explicit_display_order(user):
    with tenant_context(user):
        field = create_health_field(
            user=user, name="Água", field_type=HealthFieldType.INTEGER, display_order=7
        )
        assert field.display_order == 7


def test_create_enum_requires_at_least_one_option(user):
    with tenant_context(user), pytest.raises(DomainError):
        create_health_field(
            user=user, name="Humor", field_type=HealthFieldType.ENUM, enum_options=[]
        )


def test_create_enum_with_options_ok(user):
    with tenant_context(user):
        field = create_health_field(
            user=user, name="Humor", field_type=HealthFieldType.ENUM,
            enum_options=["Bom", "Neutro", "Ruim"],
        )
        assert field.enum_options == ["Bom", "Neutro", "Ruim"]


def test_create_non_enum_rejects_options(user):
    with tenant_context(user), pytest.raises(DomainError):
        create_health_field(
            user=user, name="Peso", field_type=HealthFieldType.DECIMAL,
            enum_options=["não", "permitido"],
        )


# --- update_health_field (AC2, AC4) --------------------------------------------
def test_update_changes_name_without_touching_type(user):
    with tenant_context(user):
        field = create_health_field(
            user=user, name="Antigo", field_type=HealthFieldType.INTEGER
        )
        updated = update_health_field(user=user, field_id=field.id, name="Novo")
        assert updated.name == "Novo"
        field.refresh_from_db()
        assert field.name == "Novo"
        assert field.field_type == HealthFieldType.INTEGER


def test_update_rejects_field_type_change(user):
    """(c) field_type é imutável → DomainError."""
    with tenant_context(user):
        field = create_health_field(
            user=user, name="Peso", field_type=HealthFieldType.INTEGER
        )
        with pytest.raises(DomainError):
            update_health_field(
                user=user, field_id=field.id, field_type=HealthFieldType.DECIMAL
            )


def test_update_changes_display_order(user):
    """display_order é mutável por UPDATE direto (Saúde não versiona)."""
    with tenant_context(user):
        field = create_health_field(
            user=user, name="Peso", field_type=HealthFieldType.DECIMAL
        )
        updated = update_health_field(user=user, field_id=field.id, display_order=5)
        assert updated.display_order == 5
        field.refresh_from_db()
        assert field.display_order == 5


def test_update_enum_options_ok(user):
    with tenant_context(user):
        field = create_health_field(
            user=user, name="Humor", field_type=HealthFieldType.ENUM,
            enum_options=["Bom"],
        )
        updated = update_health_field(
            user=user, field_id=field.id, enum_options=["Bom", "Ruim"]
        )
        assert updated.enum_options == ["Bom", "Ruim"]


def test_update_enum_to_empty_options_rejected(user):
    with tenant_context(user):
        field = create_health_field(
            user=user, name="Humor", field_type=HealthFieldType.ENUM,
            enum_options=["Bom"],
        )
        with pytest.raises(DomainError):
            update_health_field(user=user, field_id=field.id, enum_options=[])


def test_update_non_enum_options_rejected(user):
    with tenant_context(user):
        field = create_health_field(
            user=user, name="Peso", field_type=HealthFieldType.DECIMAL
        )
        with pytest.raises(DomainError):
            update_health_field(
                user=user, field_id=field.id, enum_options=["não", "permitido"]
            )


# --- desativar / reativar (AC2) ------------------------------------------------
def test_deactivate_sets_active_false_and_preserves_record(user):
    with tenant_context(user):
        field = create_health_field(
            user=user, name="Peso", field_type=HealthFieldType.DECIMAL
        )
        update_health_field(user=user, field_id=field.id, active=False)
        field.refresh_from_db()
        assert field.active is False
        # Registro persiste — nunca é deletado (só some da lista ATIVA).
        assert HealthFieldDefinition.objects.filter(id=field.id).exists() is True
        assert field.id not in [f.id for f in list_health_fields(user=user)]


def test_reactivate_sets_active_true(user):
    with tenant_context(user):
        field = HealthFieldDefinitionFactory(user=user, active=False)
        update_health_field(user=user, field_id=field.id, active=True)
        field.refresh_from_db()
        assert field.active is True


# --- list_health_fields (AC2, f) -----------------------------------------------
def test_list_hides_inactive_by_default(user):
    with tenant_context(user):
        active = HealthFieldDefinitionFactory(user=user, name="Ativo", active=True)
        HealthFieldDefinitionFactory(user=user, name="Inativo", active=False)

        default = list(list_health_fields(user=user))
        assert [f.id for f in default] == [active.id]

        with_inactive = list(list_health_fields(user=user, include_inactive=True))
        assert len(with_inactive) == 2


def test_list_orders_by_display_order_then_name(user):
    with tenant_context(user):
        HealthFieldDefinitionFactory(user=user, name="Zeta", display_order=1)
        HealthFieldDefinitionFactory(user=user, name="Alfa", display_order=0)
        result = [f.name for f in list_health_fields(user=user)]
        assert result == ["Alfa", "Zeta"]


# --- isolamento (g) ------------------------------------------------------------
def test_update_cross_tenant_raises_does_not_exist(user, other_user):
    with tenant_context(other_user):
        alheio = HealthFieldDefinitionFactory(user=other_user)
    with tenant_context(user), pytest.raises(HealthFieldDefinition.DoesNotExist):
        update_health_field(user=user, field_id=alheio.id, name="Invadido")
