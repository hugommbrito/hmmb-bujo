"""Testes de serializer de hábitos: validação de forma (§6.4)."""

import uuid

from rest_framework import serializers as drf_serializers

from habits.serializers import (
    HabitChangeSerializer,
    HabitCreateSerializer,
    HabitDayEntryUpdateSerializer,
    HabitHistoryDaySerializer,
    HabitSeriesPointSerializer,
    HabitUpdateSerializer,
    HabitVersionCreateSerializer,
    SetGroupMultipliersSerializer,
    SetHolidaySerializer,
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


# --- HabitDayEntryUpdateSerializer (Story 6.2) ---------------------------------
def test_day_entry_update_accepts_value_null():
    """Desmarcar booleano: value=None é válido (allow_null)."""
    serializer = HabitDayEntryUpdateSerializer(data={"value": None})
    assert serializer.is_valid(), serializer.errors


def test_day_entry_update_empty_is_valid():
    serializer = HabitDayEntryUpdateSerializer(data={})
    assert serializer.is_valid(), serializer.errors


def test_day_entry_update_rejects_date_mutation():
    serializer = HabitDayEntryUpdateSerializer(data={"date": "2026-03-02"})
    assert not serializer.is_valid()
    assert "date" in serializer.errors


def test_day_entry_update_rejects_habit_mutation():
    serializer = HabitDayEntryUpdateSerializer(data={"habit": str(uuid.uuid4())})
    assert not serializer.is_valid()
    assert "habit" in serializer.errors


# --- Story 6.3 — config de multiplicador + feriado -----------------------------
def test_day_entry_update_accepts_multiplier_at_time():
    """Override avulso do multiplicador de uma linha é aceito (write)."""
    serializer = HabitDayEntryUpdateSerializer(data={"multiplier_at_time": "1.00"})
    assert serializer.is_valid(), serializer.errors


def test_set_group_multipliers_accepts_partial():
    """Só uma chave enviada é válido."""
    serializer = SetGroupMultipliersSerializer(data={"weekend": "0.20"})
    assert serializer.is_valid(), serializer.errors


def test_set_group_multipliers_rejects_empty():
    """Nenhuma chave → 400 (informe ao menos um multiplicador)."""
    serializer = SetGroupMultipliersSerializer(data={})
    assert not serializer.is_valid()


def test_set_holiday_requires_date_and_flag():
    serializer = SetHolidaySerializer(data={"date": "2026-01-10", "is_holiday": True})
    assert serializer.is_valid(), serializer.errors

    invalid = SetHolidaySerializer(data={"is_holiday": True})
    assert not invalid.is_valid()
    assert "date" in invalid.errors


# --- Histórico read-only (Story 6.4) -------------------------------------------
def test_change_serializer_field_is_charfield_not_choicefield():
    """`field` é CharField (não ChoiceField) — não emite enum novo no contrato."""
    field = HabitChangeSerializer().fields["field"]
    assert isinstance(field, drf_serializers.CharField)
    assert not isinstance(field, drf_serializers.ChoiceField)


def test_change_serializer_accepts_created_and_before_after():
    """Aceita `field='created'` (valor arbitrário) e serializa before/after."""
    data = HabitChangeSerializer({"field": "created", "before": None, "after": None}).data
    assert data == {"field": "created", "before": None, "after": None}
    weight = HabitChangeSerializer({"field": "weight", "before": "3.00", "after": "4.00"}).data
    assert weight == {"field": "weight", "before": "3.00", "after": "4.00"}


def test_history_day_serializer_allows_null_total_completion():
    """Dia-lacuna: total_completion=None serializa sem erro (allow_null).
    `untracked` entrou no contrato na 16.2c (dia marcado "não registrado")."""
    data = HabitHistoryDaySerializer(
        {"date": "2026-01-06", "day_type": "weekday", "total_completion": None,
         "untracked": False, "groups": [], "entries": []}
    ).data
    assert data["total_completion"] is None
    assert data["untracked"] is False
    assert data["groups"] == []


def test_day_group_serializer_allows_null_completion():
    """Story 16.2c: dia marcado "não registrado" lista os grupos com completion=None
    (a UI escreve "Não registrado", nunca barra em 0)."""
    from habits.serializers import HabitDayGroupSerializer

    data = HabitDayGroupSerializer(
        {"id": "7b6b4f8e-1b2a-4c3d-9e8f-0a1b2c3d4e5f", "name": "Corpo", "completion": None}
    ).data
    assert data["completion"] is None


def test_series_point_serializer_allows_null_value():
    """Ponto sem value (não-feito) serializa value=None; effective_weight como string."""
    from decimal import Decimal

    data = HabitSeriesPointSerializer(
        {"date": "2026-01-10", "value": None,
         "effective_weight": Decimal("2.00"), "day_type": "weekend"}
    ).data
    assert data["value"] is None
    assert data["effective_weight"] == "2.00"
    assert data["day_type"] == "weekend"
