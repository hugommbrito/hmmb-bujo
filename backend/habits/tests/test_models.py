"""Testes de model dos hábitos: constraints de banco e defaults (AD-06)."""

from datetime import date
from decimal import Decimal

import pytest
from django.db import IntegrityError, transaction

from core.tenant import tenant_context
from habits.models import (
    DayType,
    Habit,
    HabitDayEntry,
    HabitGroupDayMultiplier,
    HabitVersion,
)
from habits.tests.factories import (
    HabitDayEntryFactory,
    HabitFactory,
    HabitGroupDayMultiplierFactory,
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


# --- Story 6.3 — day_type / multiplier -----------------------------------------
def test_day_entry_defaults_weekday_and_neutral_multiplier(user):
    """Defaults novos: day_type=weekday, multiplier_at_time=1.00 (backfill correto)."""
    with tenant_context(user):
        habit = HabitFactory(user=user, type="boolean")
        entry = HabitDayEntry.objects.create(
            habit=habit, date=date(2026, 3, 20), weight_at_time=Decimal("1")
        )
        assert entry.day_type == DayType.WEEKDAY
        assert entry.multiplier_at_time == Decimal("1.00")


def test_unique_group_multiplier_per_group_day_type_and_day(user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        day = date(2026, 3, 10)
        HabitGroupDayMultiplierFactory(
            user=user, group=group, day_type=DayType.WEEKEND, effective_from=day
        )
        with pytest.raises(IntegrityError), transaction.atomic():
            HabitGroupDayMultiplier.objects.create(
                group=group, day_type=DayType.WEEKEND,
                multiplier=Decimal("0.5"), effective_from=day,
            )


def test_group_multiplier_check_constraint_rejects_weekday(user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        with pytest.raises(IntegrityError), transaction.atomic():
            HabitGroupDayMultiplier.objects.create(
                group=group, day_type=DayType.WEEKDAY,
                multiplier=Decimal("1.0"), effective_from=date(2026, 3, 1),
            )


def test_group_multiplier_two_day_types_same_day_allowed(user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        day = date(2026, 3, 10)
        HabitGroupDayMultiplierFactory(
            user=user, group=group, day_type=DayType.WEEKEND, effective_from=day
        )
        HabitGroupDayMultiplierFactory(
            user=user, group=group, day_type=DayType.HOLIDAY, effective_from=day
        )
        assert HabitGroupDayMultiplier.objects.filter(group=group).count() == 2
