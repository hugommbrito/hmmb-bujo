"""Testes de serializer das Métricas de Saúde: validação de forma (§6.4)."""

from health.serializers import (
    HealthFieldCreateSerializer,
    HealthFieldDefinitionSerializer,
    HealthFieldUpdateSerializer,
)


# --- create (AC1, AC3) ---------------------------------------------------------
def test_create_requires_name_and_field_type():
    serializer = HealthFieldCreateSerializer(data={})
    assert not serializer.is_valid()
    assert "name" in serializer.errors
    assert "field_type" in serializer.errors


def test_create_rejects_invalid_field_type():
    serializer = HealthFieldCreateSerializer(
        data={"name": "X", "field_type": "invalido"}
    )
    assert not serializer.is_valid()
    assert "field_type" in serializer.errors


def test_create_enum_requires_options():
    serializer = HealthFieldCreateSerializer(
        data={"name": "Humor", "field_type": "enum"}
    )
    assert not serializer.is_valid()
    assert "enum_options" in serializer.errors


def test_create_enum_with_options_is_valid():
    serializer = HealthFieldCreateSerializer(
        data={"name": "Humor", "field_type": "enum", "enum_options": ["Bom", "Ruim"]}
    )
    assert serializer.is_valid(), serializer.errors


def test_create_non_enum_rejects_options():
    serializer = HealthFieldCreateSerializer(
        data={"name": "Peso", "field_type": "decimal", "enum_options": ["x"]}
    )
    assert not serializer.is_valid()
    assert "enum_options" in serializer.errors


def test_create_non_enum_without_options_is_valid():
    serializer = HealthFieldCreateSerializer(
        data={"name": "Peso", "field_type": "decimal"}
    )
    assert serializer.is_valid(), serializer.errors


def test_create_rejects_display_order_over_int_max():
    """display_order acima do máximo do PositiveIntegerField → 400 (não 500 no DB)."""
    serializer = HealthFieldCreateSerializer(
        data={"name": "X", "field_type": "integer", "display_order": 2147483648}
    )
    assert not serializer.is_valid()
    assert "display_order" in serializer.errors


# --- update (AC4: field_type imutável) -----------------------------------------
def test_update_rejects_field_type_snake_case():
    serializer = HealthFieldUpdateSerializer(
        data={"name": "Novo", "field_type": "decimal"}
    )
    assert not serializer.is_valid()
    assert "field_type" in serializer.errors


def test_update_rejects_field_type_camel_case():
    """A borda pode receber camelCase antes do parser; barrar ambos por robustez."""
    serializer = HealthFieldUpdateSerializer(
        data={"name": "Novo", "fieldType": "decimal"}
    )
    assert not serializer.is_valid()
    assert "field_type" in serializer.errors


def test_update_without_field_type_is_valid():
    serializer = HealthFieldUpdateSerializer(data={"name": "Novo", "active": False})
    assert serializer.is_valid(), serializer.errors


def test_update_empty_is_valid():
    serializer = HealthFieldUpdateSerializer(data={})
    assert serializer.is_valid(), serializer.errors


def test_update_rejects_display_order_over_int_max():
    serializer = HealthFieldUpdateSerializer(data={"display_order": 2147483648})
    assert not serializer.is_valid()
    assert "display_order" in serializer.errors


# --- read serializer -----------------------------------------------------------
def test_read_serializer_exposes_expected_fields():
    serializer = HealthFieldDefinitionSerializer()
    assert set(serializer.fields) == {
        "id", "name", "field_type", "enum_options", "active", "display_order",
    }
