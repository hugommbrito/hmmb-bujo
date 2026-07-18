"""Testes de serializer de hábitos: validação de forma (§6.4)."""

import uuid

from habits.serializers import (
    HabitCreateSerializer,
    HabitUpdateSerializer,
    HabitVersionCreateSerializer,
)

_GROUP = str(uuid.uuid4())


def test_boolean_habit_rejects_meta_bonus():
    serializer = HabitCreateSerializer(
        data={"name": "X", "group": _GROUP, "type": "boolean", "weight": "1", "meta": "30"}
    )
    assert not serializer.is_valid()
    assert "meta" in serializer.errors


def test_numeric_habit_accepts_meta_bonus():
    serializer = HabitCreateSerializer(
        data={
            "name": "Correr", "group": _GROUP, "type": "numeric",
            "weight": "3", "meta": "30", "bonus": "20",
        }
    )
    assert serializer.is_valid(), serializer.errors


def test_boolean_habit_without_meta_bonus_is_valid():
    serializer = HabitCreateSerializer(
        data={"name": "Ler", "group": _GROUP, "type": "boolean", "weight": "2"}
    )
    assert serializer.is_valid(), serializer.errors


def test_create_requires_group():
    serializer = HabitCreateSerializer(
        data={"name": "SemGrupo", "type": "boolean", "weight": "1"}
    )
    assert not serializer.is_valid()
    assert "group" in serializer.errors


def test_update_rejects_type_change():
    serializer = HabitUpdateSerializer(data={"name": "Novo", "type": "numeric"})
    assert not serializer.is_valid()
    assert "type" in serializer.errors


def test_update_without_type_is_valid():
    serializer = HabitUpdateSerializer(data={"name": "Novo"})
    assert serializer.is_valid(), serializer.errors


def test_version_create_all_fields_optional():
    serializer = HabitVersionCreateSerializer(data={})
    assert serializer.is_valid(), serializer.errors
