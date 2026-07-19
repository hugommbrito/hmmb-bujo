"""Testes de model dos hábitos: constraints de banco e defaults (AD-06)."""

from datetime import date
from decimal import Decimal

import pytest
from django.db import IntegrityError, transaction

from core.tenant import tenant_context
from habits.models import Habit, HabitDayEntry, HabitVersion
from habits.tests.factories import (
    HabitDayEntryFactory,
    HabitFactory,
    HabitGroupFactory,
    HabitVersionFactory,
)


def test_habit_type_check_constraint_rejects_invalid_type(user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        with pytest.raises(IntegrityError), transaction.atomic():
            Habit.objects.create(name="Ruim", type="invalido", group=group)


def test_unique_version_per_habit_and_day(user):
    with tenant_context(user):
        habit = HabitFactory(user=user, type="boolean")
        day = date(2026, 3, 10)
        HabitVersionFactory(user=user, habit=habit, effective_from=day)
        with pytest.raises(IntegrityError), transaction.atomic():
            HabitVersion.objects.create(
                habit=habit, weight=Decimal("2"), effective_from=day
            )


def test_two_versions_different_days_allowed(user):
    with tenant_context(user):
        habit = HabitFactory(user=user, type="boolean")
        HabitVersionFactory(user=user, habit=habit, effective_from=date(2026, 3, 10))
        HabitVersionFactory(user=user, habit=habit, effective_from=date(2026, 3, 11))
        assert HabitVersion.objects.filter(habit=habit).count() == 2


def test_habit_group_default_display_order_zero(user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        assert group.display_order == 0


def test_version_ordering_is_most_recent_first(user):
    with tenant_context(user):
        habit = HabitFactory(user=user, type="boolean")
        older = HabitVersionFactory(user=user, habit=habit, effective_from=date(2026, 3, 1))
        newer = HabitVersionFactory(user=user, habit=habit, effective_from=date(2026, 3, 5))
        ordered = list(HabitVersion.objects.filter(habit=habit))
        assert ordered[0].id == newer.id
        assert ordered[1].id == older.id


# --- HabitDayEntry (snapshot realizado, Story 6.2) -----------------------------
def test_unique_day_entry_per_habit_and_day(user):
    with tenant_context(user):
        habit = HabitFactory(user=user, type="boolean")
        day = date(2026, 3, 10)
        HabitDayEntryFactory(user=user, habit=habit, date=day)
        with pytest.raises(IntegrityError), transaction.atomic():
            HabitDayEntry.objects.create(
                habit=habit, date=day, weight_at_time=Decimal("2")
            )


def test_two_day_entries_different_days_allowed(user):
    with tenant_context(user):
        habit = HabitFactory(user=user, type="boolean")
        HabitDayEntryFactory(user=user, habit=habit, date=date(2026, 3, 10))
        HabitDayEntryFactory(user=user, habit=habit, date=date(2026, 3, 11))
        assert HabitDayEntry.objects.filter(habit=habit).count() == 2
