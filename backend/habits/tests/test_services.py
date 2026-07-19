"""Testes da camada de serviço de hábitos (AD-06, AC1–AC4).

Nota de design (Ponto em aberto da story 6.1, resolvido): há UMA versão por
``(habit, effective_from)`` (``UniqueConstraint`` + ``update_or_create``). Logo,
mudar config no MESMO dia da criação faz UPDATE na versão do dia; o INSERT de uma
2ª versão (AC2/AC3) acontece quando a versão vigente é de um dia ANTERIOR. Os
testes exercitam ambos os caminhos explicitamente.
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest

from core.calendar import today_for
from core.exceptions import DomainError
from core.tenant import tenant_context
from habits.models import HabitDayEntry, HabitVersion
from habits.services import (
    add_habit_version,
    compute_day_completeness,
    create_habit,
    create_habit_group,
    current_version_of,
    list_habit_groups,
    list_habits,
    seed_habit_day,
    update_habit_day_entry,
    update_habit_identity,
)
from habits.tests.factories import (
    HabitDayEntryFactory,
    HabitFactory,
    HabitGroupFactory,
    HabitVersionFactory,
)

# Datas fixas no passado (relativas ao "hoje" do ambiente) para exercitar o
# snapshot sem depender de today_for — o seed resolve a versão vigente em `date`.
_D1 = date(2026, 3, 1)
_D2 = date(2026, 3, 6)


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


# ==============================================================================
# Story 6.2 — snapshot realizado (seed / completude / edição avulsa)
# ==============================================================================


# --- seed_habit_day (AC1) ------------------------------------------------------
def test_seed_creates_one_row_per_active_habit_null_value_frozen_config(user):
    """(a) Uma linha por hábito ativo em D, value nulo, *_at_time da versão de D."""
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        boolean = HabitFactory(user=user, group=group, type="boolean")
        HabitVersionFactory(user=user, habit=boolean, weight=Decimal("2"), effective_from=_D1)
        numeric = HabitFactory(user=user, group=group, type="numeric")
        HabitVersionFactory(
            user=user, habit=numeric, weight=Decimal("3"),
            meta=Decimal("5000"), bonus=Decimal("20"), effective_from=_D1,
        )

        seed_habit_day(user=user, date=_D1)

        entries = {e.habit_id: e for e in HabitDayEntry.objects.filter(date=_D1)}
        assert len(entries) == 2
        assert entries[boolean.id].value is None
        assert entries[boolean.id].weight_at_time == Decimal("2")
        assert entries[boolean.id].meta_at_time is None
        assert entries[numeric.id].weight_at_time == Decimal("3")
        assert entries[numeric.id].meta_at_time == Decimal("5000")
        assert entries[numeric.id].bonus_at_time == Decimal("20")


def test_seed_is_idempotent_preserves_edited_value(user):
    """(b) 2º seed no mesmo dia não recria/sobrescreve — preserva value editado."""
    with tenant_context(user):
        habit = HabitFactory(user=user, type="boolean")
        HabitVersionFactory(user=user, habit=habit, weight=Decimal("1"), effective_from=_D1)

        seed_habit_day(user=user, date=_D1)
        entry = HabitDayEntry.objects.get(date=_D1, habit=habit)
        entry.value = Decimal("1")
        entry.save(update_fields=["value"])

        seed_habit_day(user=user, date=_D1)  # segunda passada

        assert HabitDayEntry.objects.filter(date=_D1, habit=habit).count() == 1
        entry.refresh_from_db()
        assert entry.value == Decimal("1")  # preservado


def test_seed_skipped_day_uses_version_effective_that_day(user):
    """(c) Dia pulado aberto depois usa a versão vigente NAQUELE dia, não a de hoje."""
    with tenant_context(user):
        habit = HabitFactory(user=user, type="numeric")
        # Versão antiga (vigente em _D1) e versão nova (vigente a partir de _D2).
        HabitVersionFactory(
            user=user, habit=habit, weight=Decimal("2"),
            meta=Decimal("5000"), effective_from=_D1,
        )
        HabitVersionFactory(
            user=user, habit=habit, weight=Decimal("9"),
            meta=Decimal("9999"), effective_from=_D2,
        )

        seed_habit_day(user=user, date=_D1)

        entry = HabitDayEntry.objects.get(date=_D1, habit=habit)
        assert entry.weight_at_time == Decimal("2")  # versão de _D1, não de _D2
        assert entry.meta_at_time == Decimal("5000")


def test_seed_excludes_inactive_habit(user):
    """(d) Hábito inativo em D → sem linha (fora do denominador)."""
    with tenant_context(user):
        habit = HabitFactory(user=user, type="boolean")
        HabitVersionFactory(user=user, habit=habit, active=False, effective_from=_D1)

        seed_habit_day(user=user, date=_D1)

        assert not HabitDayEntry.objects.filter(date=_D1, habit=habit).exists()


def test_seed_excludes_habit_created_after_the_day(user):
    """Dia passado é imune a hábitos criados depois (current_version_of(D) is None)."""
    with tenant_context(user):
        habit = HabitFactory(user=user, type="boolean")
        HabitVersionFactory(user=user, habit=habit, effective_from=_D2)  # nasce em _D2

        seed_habit_day(user=user, date=_D1)  # _D1 < _D2

        assert not HabitDayEntry.objects.filter(date=_D1, habit=habit).exists()


# --- compute_day_completeness (AC3, matemática de completude) -------------------
def _numeric_entry(user, group, *, value, meta, bonus, weight, date=_D1):
    habit = HabitFactory(user=user, group=group, type="numeric")
    return HabitDayEntryFactory(
        user=user, habit=habit, date=date, value=value,
        weight_at_time=weight, meta_at_time=meta, bonus_at_time=bonus,
    )


def test_completeness_boolean_done_and_not_done(user):
    """Booleano feito=1, não-feito=0; peso do não-feito conta no denominador → 50%."""
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        done_habit = HabitFactory(user=user, group=group, type="boolean")
        HabitDayEntryFactory(
            user=user, habit=done_habit, date=_D1, value=Decimal("1"),
            weight_at_time=Decimal("1"),
        )
        not_done = HabitFactory(user=user, group=group, type="boolean")
        HabitDayEntryFactory(
            user=user, habit=not_done, date=_D1, value=None, weight_at_time=Decimal("1"),
        )

        result = compute_day_completeness(user=user, date=_D1)
        assert result["total"] == 50


def test_completeness_numeric_partial_with_bonus(user):
    """value=2500, meta=5000, bonus=20% → (2500/5000)*(1-0.20) = 0.40 → 40%."""
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        _numeric_entry(
            user, group, value=Decimal("2500"), meta=Decimal("5000"),
            bonus=Decimal("20"), weight=Decimal("1"),
        )
        result = compute_day_completeness(user=user, date=_D1)
        assert result["total"] == 40


def test_completeness_numeric_meta_reached_is_full(user):
    """value >= meta → contribuição 1 (ganha o bonus) → 100%."""
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        _numeric_entry(
            user, group, value=Decimal("5000"), meta=Decimal("5000"),
            bonus=Decimal("20"), weight=Decimal("1"),
        )
        result = compute_day_completeness(user=user, date=_D1)
        assert result["total"] == 100


def test_completeness_weighted_anchor_example(user):
    """Âncora da Dev Notes: (1×1 + 0.4×2)/(1+2) = 1.8/3 = 60%."""
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        boolean = HabitFactory(user=user, group=group, type="boolean")
        HabitDayEntryFactory(
            user=user, habit=boolean, date=_D1, value=Decimal("1"),
            weight_at_time=Decimal("1"),
        )
        _numeric_entry(
            user, group, value=Decimal("2500"), meta=Decimal("5000"),
            bonus=Decimal("20"), weight=Decimal("2"),
        )
        result = compute_day_completeness(user=user, date=_D1)
        assert result["total"] == 60


def test_completeness_per_group(user):
    """% por grupo = fórmula restrita às linhas do grupo."""
    with tenant_context(user):
        g_full = HabitGroupFactory(user=user, name="Cheio")
        g_empty = HabitGroupFactory(user=user, name="Vazio")
        done = HabitFactory(user=user, group=g_full, type="boolean")
        HabitDayEntryFactory(
            user=user, habit=done, date=_D1, value=Decimal("1"), weight_at_time=Decimal("1"),
        )
        undone = HabitFactory(user=user, group=g_empty, type="boolean")
        HabitDayEntryFactory(
            user=user, habit=undone, date=_D1, value=None, weight_at_time=Decimal("1"),
        )

        result = compute_day_completeness(user=user, date=_D1)
        by_name = {g["name"]: g["completion"] for g in result["groups"]}
        assert by_name == {"Cheio": 100, "Vazio": 0}
        assert result["total"] == 50


def test_completeness_empty_day_returns_zero(user):
    """Dia sem linhas → total 0, sem grupos (nunca divide por zero)."""
    with tenant_context(user):
        result = compute_day_completeness(user=user, date=_D1)
        assert result["total"] == 0
        assert result["groups"] == []


def test_completeness_zero_weight_does_not_divide_by_zero(user):
    """Σ weight == 0 → 0 (guarda de divisão por zero)."""
    with tenant_context(user):
        habit = HabitFactory(user=user, type="boolean")
        HabitDayEntryFactory(
            user=user, habit=habit, date=_D1, value=Decimal("1"), weight_at_time=Decimal("0"),
        )
        result = compute_day_completeness(user=user, date=_D1)
        assert result["total"] == 0


# --- update_habit_day_entry (AC3 — não sangra) ---------------------------------
def test_update_value_changes_only_that_row(user):
    """(f) UPDATE de value de um dia não altera dias vizinhos nem habit_versions."""
    with tenant_context(user):
        habit = HabitFactory(user=user, type="boolean")
        version = HabitVersionFactory(
            user=user, habit=habit, weight=Decimal("1"), effective_from=_D1
        )
        e1 = HabitDayEntryFactory(user=user, habit=habit, date=_D1, weight_at_time=Decimal("1"))
        e2 = HabitDayEntryFactory(user=user, habit=habit, date=_D2, weight_at_time=Decimal("1"))

        update_habit_day_entry(user=user, entry_id=e1.id, value=Decimal("1"))

        e1.refresh_from_db()
        e2.refresh_from_db()
        version.refresh_from_db()
        assert e1.value == Decimal("1")
        assert e2.value is None  # dia vizinho intacto
        assert HabitVersion.objects.filter(habit=habit).count() == 1
        assert version.weight == Decimal("1")  # habit_versions intacto


def test_update_weight_at_time_changes_only_that_row(user):
    """Correção avulsa de weight_at_time de um dia passado só altera aquela linha."""
    with tenant_context(user):
        habit = HabitFactory(user=user, type="boolean")
        e1 = HabitDayEntryFactory(user=user, habit=habit, date=_D1, weight_at_time=Decimal("1"))
        e2 = HabitDayEntryFactory(user=user, habit=habit, date=_D2, weight_at_time=Decimal("1"))

        update_habit_day_entry(user=user, entry_id=e1.id, weight_at_time=Decimal("5"))

        e1.refresh_from_db()
        e2.refresh_from_db()
        assert e1.weight_at_time == Decimal("5")
        assert e2.weight_at_time == Decimal("1")  # vizinho intacto


def test_update_can_unmark_value_to_null(user):
    """Desmarcar booleano: value volta a None (sentinela distingue None enviado)."""
    with tenant_context(user):
        habit = HabitFactory(user=user, type="boolean")
        entry = HabitDayEntryFactory(
            user=user, habit=habit, date=_D1, value=Decimal("1"), weight_at_time=Decimal("1"),
        )
        update_habit_day_entry(user=user, entry_id=entry.id, value=None)
        entry.refresh_from_db()
        assert entry.value is None
