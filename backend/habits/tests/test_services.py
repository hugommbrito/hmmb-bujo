"""Testes da camada de serviço de hábitos (AD-06, AC1–AC4).

Nota de design (Ponto em aberto da story 6.1, resolvido): há UMA versão por
``(habit, effective_from)`` (``UniqueConstraint`` + ``update_or_create``). Logo,
mudar config no MESMO dia da criação faz UPDATE na versão do dia; o INSERT de uma
2ª versão (AC2/AC3) acontece quando a versão vigente é de um dia ANTERIOR. Os
testes exercitam ambos os caminhos explicitamente.
"""

from datetime import timedelta
from decimal import Decimal

import pytest

from core.calendar import today_for
from core.exceptions import DomainError
from core.tenant import tenant_context
from habits.models import HabitVersion
from habits.services import (
    add_habit_version,
    create_habit,
    create_habit_group,
    current_version_of,
    list_habit_groups,
    list_habits,
    update_habit_identity,
)
from habits.tests.factories import HabitFactory, HabitGroupFactory, HabitVersionFactory


# --- create_habit (AC1) --------------------------------------------------------
def test_create_habit_creates_exactly_one_active_version_effective_today(user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        habit = create_habit(
            user=user, name="Ler", group_id=group.id, type="boolean", weight=Decimal("2")
        )
        versions = HabitVersion.objects.filter(habit=habit)
        assert versions.count() == 1
        version = versions.get()
        assert version.active is True
        assert version.effective_from == today_for(user)
        assert version.weight == Decimal("2")


def test_create_boolean_habit_forces_meta_bonus_null(user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        habit = create_habit(
            user=user, name="Meditar", group_id=group.id, type="boolean",
            weight=Decimal("1"), meta=Decimal("30"), bonus=Decimal("20"),
        )
        version = HabitVersion.objects.get(habit=habit)
        assert version.meta is None
        assert version.bonus is None


def test_create_numeric_habit_keeps_meta_bonus(user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        habit = create_habit(
            user=user, name="Correr", group_id=group.id, type="numeric",
            weight=Decimal("3"), meta=Decimal("30"), bonus=Decimal("20"),
        )
        version = HabitVersion.objects.get(habit=habit)
        assert version.meta == Decimal("30")
        assert version.bonus == Decimal("20")


# --- add_habit_version (AC2) ---------------------------------------------------
def test_weight_change_across_days_inserts_new_version_preserving_old(user):
    """Versão vigente de ontem → mudar peso hoje INSERE 2ª versão; a 1ª fica intacta."""
    with tenant_context(user):
        habit = HabitFactory(user=user, type="boolean")
        yesterday = today_for(user) - timedelta(days=1)
        old = HabitVersionFactory(
            user=user, habit=habit, weight=Decimal("2"), effective_from=yesterday
        )

        new = add_habit_version(user=user, habit_id=habit.id, weight=Decimal("5"))

        assert HabitVersion.objects.filter(habit=habit).count() == 2
        assert new.effective_from == today_for(user)
        assert new.weight == Decimal("5")
        old.refresh_from_db()
        assert old.weight == Decimal("2")  # versão anterior nunca é editada
        assert old.effective_from == yesterday


def test_same_day_change_updates_the_days_version(user):
    """Mudança no mesmo dia da criação faz UPDATE (uma versão por (habit, dia))."""
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        habit = create_habit(
            user=user, name="Água", group_id=group.id, type="boolean", weight=Decimal("1")
        )
        add_habit_version(user=user, habit_id=habit.id, weight=Decimal("4"))

        versions = HabitVersion.objects.filter(habit=habit)
        assert versions.count() == 1
        assert versions.get().weight == Decimal("4")


def test_add_version_inherits_unspecified_fields_from_current(user):
    with tenant_context(user):
        habit = HabitFactory(user=user, type="numeric")
        yesterday = today_for(user) - timedelta(days=1)
        HabitVersionFactory(
            user=user, habit=habit, weight=Decimal("2"),
            meta=Decimal("30"), bonus=Decimal("10"), effective_from=yesterday,
        )
        # Só muda o peso — meta/bonus/active herdam da versão vigente.
        new = add_habit_version(user=user, habit_id=habit.id, weight=Decimal("9"))
        assert new.meta == Decimal("30")
        assert new.bonus == Decimal("10")
        assert new.active is True


# --- deactivate / reactivate (AC3) ---------------------------------------------
def test_deactivate_across_days_inserts_inactive_version(user):
    with tenant_context(user):
        habit = HabitFactory(user=user, type="boolean")
        yesterday = today_for(user) - timedelta(days=1)
        HabitVersionFactory(
            user=user, habit=habit, active=True, effective_from=yesterday
        )
        version = add_habit_version(user=user, habit_id=habit.id, active=False)
        assert version.active is False
        assert version.effective_from == today_for(user)
        assert HabitVersion.objects.filter(habit=habit).count() == 2


def test_reactivate_inserts_active_version(user):
    with tenant_context(user):
        habit = HabitFactory(user=user, type="boolean")
        two_days_ago = today_for(user) - timedelta(days=2)
        HabitVersionFactory(
            user=user, habit=habit, active=False, effective_from=two_days_ago
        )
        version = add_habit_version(user=user, habit_id=habit.id, active=True)
        assert version.active is True


# --- update_habit_identity (type imutável) -------------------------------------
def test_update_identity_changes_name_without_new_version(user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        habit = create_habit(
            user=user, name="Antigo", group_id=group.id, type="boolean", weight=Decimal("1")
        )
        update_habit_identity(user=user, habit_id=habit.id, name="Novo")
        habit.refresh_from_db()
        assert habit.name == "Novo"
        assert HabitVersion.objects.filter(habit=habit).count() == 1  # sem nova versão


def test_update_identity_rejects_type_change(user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        habit = create_habit(
            user=user, name="X", group_id=group.id, type="boolean", weight=Decimal("1")
        )
        with pytest.raises(DomainError):
            update_habit_identity(user=user, habit_id=habit.id, type="numeric")


# --- current_version_of (resolução temporal) -----------------------------------
def test_current_version_of_resolves_max_effective_from_le_date(user):
    with tenant_context(user):
        habit = HabitFactory(user=user, type="boolean")
        d1 = today_for(user) - timedelta(days=5)
        d3 = today_for(user) - timedelta(days=3)
        v1 = HabitVersionFactory(user=user, habit=habit, weight=Decimal("1"), effective_from=d1)
        v3 = HabitVersionFactory(user=user, habit=habit, weight=Decimal("3"), effective_from=d3)

        assert current_version_of(habit, d1 + timedelta(days=1)).id == v1.id
        assert current_version_of(habit, d3 + timedelta(days=1)).id == v3.id
        assert current_version_of(habit, d1 - timedelta(days=1)) is None


# --- list_habits (versão vigente + include_inactive, AC3) ----------------------
def test_list_habits_hides_inactive_by_default_and_attaches_current_version(user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        active_habit = create_habit(
            user=user, name="Ativo", group_id=group.id, type="boolean", weight=Decimal("1")
        )
        inactive_habit = HabitFactory(user=user, group=group, type="boolean")
        HabitVersionFactory(
            user=user, habit=inactive_habit, active=False,
            effective_from=today_for(user) - timedelta(days=1),
        )

        default = list_habits(user=user)
        assert [h.id for h in default] == [active_habit.id]
        assert default[0].current_version.weight == Decimal("1")

        with_inactive = list_habits(user=user, include_inactive=True)
        assert {h.id for h in with_inactive} == {active_habit.id, inactive_habit.id}


# --- grupos (AC4) --------------------------------------------------------------
def test_create_and_list_groups(user):
    with tenant_context(user):
        create_habit_group(user=user, name="Saúde")
        create_habit_group(user=user, name="Trabalho")
        names = sorted(g.name for g in list_habit_groups(user=user))
        assert names == ["Saúde", "Trabalho"]
