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
from habits.models import (
    DayType,
    Habit,
    HabitDayEntry,
    HabitGroupDayMultiplier,
    HabitVersion,
)
from habits.services import (
    add_habit_version,
    compute_day_completeness,
    create_habit,
    create_habit_group,
    current_multipliers_of,
    current_version_of,
    get_habit_history_range,
    get_habit_series,
    list_habit_groups,
    list_habits,
    multiplier_for,
    seed_habit_day,
    set_group_day_multiplier,
    set_holiday,
    update_habit_day_entry,
    update_habit_identity,
)
from habits.tests.factories import (
    HabitDayEntryFactory,
    HabitFactory,
    HabitGroupDayMultiplierFactory,
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


# ==============================================================================
# Story 6.3 — multiplicador de peso por tipo de dia
# ==============================================================================

# Sábado/domingo/segunda fixos (2026-01: 01=qui). 10=sáb, 11=dom, 12=seg.
# _EARLY é anterior a todos eles → config/versão vigente nos dias de teste.
_EARLY = date(2026, 1, 1)
_SAT = date(2026, 1, 10)
_MON = date(2026, 1, 12)


# --- multiplier_for (AC1) ------------------------------------------------------
def test_multiplier_for_weekday_is_always_one(user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        # Mesmo com config de weekend/holiday, weekday é sempre 1.00.
        HabitGroupDayMultiplierFactory(
            user=user, group=group, day_type=DayType.WEEKEND,
            multiplier=Decimal("0.20"), effective_from=_EARLY,
        )
        assert multiplier_for(group, DayType.WEEKDAY, _SAT) == Decimal("1.00")


def test_multiplier_for_uses_config_when_present(user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        HabitGroupDayMultiplierFactory(
            user=user, group=group, day_type=DayType.WEEKEND,
            multiplier=Decimal("0.20"), effective_from=_EARLY,
        )
        assert multiplier_for(group, DayType.WEEKEND, _SAT) == Decimal("0.20")


def test_multiplier_for_defaults_to_one_without_config(user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        assert multiplier_for(group, DayType.WEEKEND, _SAT) == Decimal("1.00")
        assert multiplier_for(group, DayType.HOLIDAY, _SAT) == Decimal("1.00")


def test_multiplier_for_resolves_max_effective_from_le_date(user):
    """Mesma mecânica de current_version_of: vigente = maior effective_from <= D."""
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        HabitGroupDayMultiplierFactory(
            user=user, group=group, day_type=DayType.WEEKEND,
            multiplier=Decimal("0.50"), effective_from=date(2026, 1, 1),
        )
        HabitGroupDayMultiplierFactory(
            user=user, group=group, day_type=DayType.WEEKEND,
            multiplier=Decimal("0.20"), effective_from=date(2026, 1, 8),
        )
        # Antes da 2ª versão → 0.50; depois → 0.20.
        assert multiplier_for(group, DayType.WEEKEND, date(2026, 1, 5)) == Decimal("0.50")
        assert multiplier_for(group, DayType.WEEKEND, _SAT) == Decimal("0.20")


# --- seed congela day_type + multiplier (AC2) ----------------------------------
def test_seed_freezes_weekend_day_type_and_group_multiplier(user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        habit = HabitFactory(user=user, group=group, type="boolean")
        HabitVersionFactory(user=user, habit=habit, weight=Decimal("2"), effective_from=_EARLY)
        HabitGroupDayMultiplierFactory(
            user=user, group=group, day_type=DayType.WEEKEND,
            multiplier=Decimal("0.20"), effective_from=_EARLY,
        )

        seed_habit_day(user=user, date=_SAT)  # _SAT é sábado

        entry = HabitDayEntry.objects.get(date=_SAT, habit=habit)
        assert entry.day_type == DayType.WEEKEND
        assert entry.multiplier_at_time == Decimal("0.20")
        assert entry.weight_at_time == Decimal("2")  # base separada do multiplicador


def test_seed_holiday_precedence_over_weekend(user):
    """Sábado marcado feriado → day_type=holiday e multiplicador de holiday."""
    from accounts.models import UserHoliday

    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        habit = HabitFactory(user=user, group=group, type="boolean")
        HabitVersionFactory(user=user, habit=habit, weight=Decimal("1"), effective_from=_EARLY)
        HabitGroupDayMultiplierFactory(
            user=user, group=group, day_type=DayType.WEEKEND,
            multiplier=Decimal("0.20"), effective_from=_EARLY,
        )
        HabitGroupDayMultiplierFactory(
            user=user, group=group, day_type=DayType.HOLIDAY,
            multiplier=Decimal("0.00"), effective_from=_EARLY,
        )
        UserHoliday.objects.create(date=_SAT)  # sábado vira feriado

        seed_habit_day(user=user, date=_SAT)

        entry = HabitDayEntry.objects.get(date=_SAT, habit=habit)
        assert entry.day_type == DayType.HOLIDAY
        assert entry.multiplier_at_time == Decimal("0.00")


def test_seed_weekday_freezes_neutral_multiplier(user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        habit = HabitFactory(user=user, group=group, type="boolean")
        HabitVersionFactory(user=user, habit=habit, weight=Decimal("1"), effective_from=_EARLY)

        seed_habit_day(user=user, date=_MON)  # segunda

        entry = HabitDayEntry.objects.get(date=_MON, habit=habit)
        assert entry.day_type == DayType.WEEKDAY
        assert entry.multiplier_at_time == Decimal("1.00")


def test_seed_group_without_config_freezes_one(user):
    """Fim de semana, mas grupo sem config → multiplicador 1.00."""
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        habit = HabitFactory(user=user, group=group, type="boolean")
        HabitVersionFactory(user=user, habit=habit, weight=Decimal("3"), effective_from=_EARLY)

        seed_habit_day(user=user, date=_SAT)

        entry = HabitDayEntry.objects.get(date=_SAT, habit=habit)
        assert entry.day_type == DayType.WEEKEND
        assert entry.multiplier_at_time == Decimal("1.00")


# --- completude por peso efetivo (AC2, matemática) -----------------------------
def test_completeness_effective_weight_full_within_weekend_group(user):
    """Âncora: sábado, weekend=0.2, dois booleanos feitos → 100% (peso escala junto)."""
    with tenant_context(user):
        group = HabitGroupFactory(user=user, name="Profissional")
        h1 = HabitFactory(user=user, group=group, type="boolean")
        HabitDayEntryFactory(
            user=user, habit=h1, date=_SAT, value=Decimal("1"),
            weight_at_time=Decimal("2"), day_type=DayType.WEEKEND,
            multiplier_at_time=Decimal("0.20"),
        )
        h2 = HabitFactory(user=user, group=group, type="boolean")
        HabitDayEntryFactory(
            user=user, habit=h2, date=_SAT, value=Decimal("1"),
            weight_at_time=Decimal("1"), day_type=DayType.WEEKEND,
            multiplier_at_time=Decimal("0.20"),
        )
        result = compute_day_completeness(user=user, date=_SAT)
        assert result["total"] == 100


def test_completeness_effective_weight_mixed_groups_anchor(user):
    """Âncora da Dev Notes: (0.4+0.2+0)/(0.4+0.2+1.0) = 0.6/1.6 = 37,5% → 38%."""
    with tenant_context(user):
        g_prof = HabitGroupFactory(user=user, name="Profissional")
        h1 = HabitFactory(user=user, group=g_prof, type="boolean")
        HabitDayEntryFactory(
            user=user, habit=h1, date=_SAT, value=Decimal("1"),
            weight_at_time=Decimal("2"), day_type=DayType.WEEKEND,
            multiplier_at_time=Decimal("0.20"),
        )
        h2 = HabitFactory(user=user, group=g_prof, type="boolean")
        HabitDayEntryFactory(
            user=user, habit=h2, date=_SAT, value=Decimal("1"),
            weight_at_time=Decimal("1"), day_type=DayType.WEEKEND,
            multiplier_at_time=Decimal("0.20"),
        )
        g_other = HabitGroupFactory(user=user, name="Outro")
        h3 = HabitFactory(user=user, group=g_other, type="boolean")
        HabitDayEntryFactory(
            user=user, habit=h3, date=_SAT, value=None,
            weight_at_time=Decimal("1"), day_type=DayType.WEEKEND,
            multiplier_at_time=Decimal("1.00"),
        )
        result = compute_day_completeness(user=user, date=_SAT)
        assert result["total"] == 38


def test_completeness_multiplier_zero_removes_group_from_num_and_den(user):
    """Feriado com holiday=0.0 → peso_efetivo=0: hábito sai de num E den."""
    with tenant_context(user):
        # Grupo A com multiplicador 0 (não conta), grupo B normal e não-feito.
        g_zero = HabitGroupFactory(user=user, name="Zerado")
        h_zero = HabitFactory(user=user, group=g_zero, type="boolean")
        HabitDayEntryFactory(
            user=user, habit=h_zero, date=_SAT, value=None,
            weight_at_time=Decimal("5"), day_type=DayType.HOLIDAY,
            multiplier_at_time=Decimal("0.00"),
        )
        g_norm = HabitGroupFactory(user=user, name="Normal")
        h_norm = HabitFactory(user=user, group=g_norm, type="boolean")
        HabitDayEntryFactory(
            user=user, habit=h_norm, date=_SAT, value=Decimal("1"),
            weight_at_time=Decimal("1"), day_type=DayType.HOLIDAY,
            multiplier_at_time=Decimal("1.00"),
        )
        result = compute_day_completeness(user=user, date=_SAT)
        # Só h_norm conta: feito, peso 1 → 100%. h_zero não entra no denominador.
        assert result["total"] == 100
        by_name = {g["name"]: g["completion"] for g in result["groups"]}
        assert by_name["Zerado"] == 0  # Σ peso_efetivo == 0 → 0 (guarda)


# --- set_group_day_multiplier prospectivo não sangra (AC3) ---------------------
def test_set_group_multiplier_is_prospective_from_today(user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        row = set_group_day_multiplier(
            user=user, group_id=group.id, day_type="weekend", multiplier=Decimal("0.30")
        )
        assert row.effective_from == today_for(user)
        assert row.multiplier == Decimal("0.30")
        assert row.day_type == DayType.WEEKEND


def test_set_group_multiplier_rejects_weekday(user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        with pytest.raises(DomainError):
            set_group_day_multiplier(
                user=user, group_id=group.id, day_type="weekday", multiplier=Decimal("2")
            )


def test_set_group_multiplier_does_not_bleed_frozen_entries(user):
    """Alterar o multiplicador hoje não muda linhas de dias já congelados."""
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        habit = HabitFactory(user=user, group=group, type="boolean")
        frozen = HabitDayEntryFactory(
            user=user, habit=habit, date=_SAT, weight_at_time=Decimal("1"),
            day_type=DayType.WEEKEND, multiplier_at_time=Decimal("0.20"),
        )
        set_group_day_multiplier(
            user=user, group_id=group.id, day_type="weekend", multiplier=Decimal("0.90")
        )
        frozen.refresh_from_db()
        assert frozen.multiplier_at_time == Decimal("0.20")  # dia congelado intacto


def test_set_group_multiplier_same_day_updates(user):
    """Duas escritas no mesmo dia → UPDATE (uma linha por (grupo, day_type, dia))."""
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        set_group_day_multiplier(
            user=user, group_id=group.id, day_type="weekend", multiplier=Decimal("0.30")
        )
        set_group_day_multiplier(
            user=user, group_id=group.id, day_type="weekend", multiplier=Decimal("0.50")
        )
        rows = HabitGroupDayMultiplier.objects.filter(group=group, day_type=DayType.WEEKEND)
        assert rows.count() == 1
        assert rows.get().multiplier == Decimal("0.50")


def test_current_multipliers_of_reports_both_types(user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        HabitGroupDayMultiplierFactory(
            user=user, group=group, day_type=DayType.WEEKEND,
            multiplier=Decimal("0.20"), effective_from=_EARLY,
        )
        result = current_multipliers_of(group, _SAT)
        assert result == {"weekend": Decimal("0.20"), "holiday": Decimal("1.00")}


# --- set_holiday recalcula só o dia (AC3) --------------------------------------
def test_set_holiday_recalculates_only_that_day_preserving_value(user):
    from accounts.models import UserHoliday

    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        HabitGroupDayMultiplierFactory(
            user=user, group=group, day_type=DayType.HOLIDAY,
            multiplier=Decimal("0.00"), effective_from=_EARLY,
        )
        habit = HabitFactory(user=user, group=group, type="boolean")
        version = HabitVersionFactory(
            user=user, habit=habit, weight=Decimal("1"), effective_from=_EARLY
        )
        # Dia D (segunda) já semeado como weekday, value marcado; vizinho intacto.
        d_entry = HabitDayEntryFactory(
            user=user, habit=habit, date=_MON, value=Decimal("1"),
            weight_at_time=Decimal("1"), day_type=DayType.WEEKDAY,
            multiplier_at_time=Decimal("1.00"),
        )
        neighbor = HabitDayEntryFactory(
            user=user, habit=habit, date=_MON + timedelta(days=1),
            weight_at_time=Decimal("1"), day_type=DayType.WEEKDAY,
            multiplier_at_time=Decimal("1.00"),
        )

        set_holiday(user=user, date=_MON, is_holiday=True)

        d_entry.refresh_from_db()
        neighbor.refresh_from_db()
        version.refresh_from_db()
        assert UserHoliday.objects.filter(date=_MON).exists()
        assert d_entry.day_type == DayType.HOLIDAY
        assert d_entry.multiplier_at_time == Decimal("0.00")
        assert d_entry.value == Decimal("1")  # value preservado
        assert neighbor.day_type == DayType.WEEKDAY  # vizinho intacto
        assert neighbor.multiplier_at_time == Decimal("1.00")
        assert HabitVersion.objects.filter(habit=habit).count() == 1  # versões intactas
        assert version.weight == Decimal("1")


def test_unset_holiday_reresolves_day_type_back(user):
    from accounts.models import UserHoliday

    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        habit = HabitFactory(user=user, group=group, type="boolean")
        UserHoliday.objects.create(date=_MON)
        entry = HabitDayEntryFactory(
            user=user, habit=habit, date=_MON, weight_at_time=Decimal("1"),
            day_type=DayType.HOLIDAY, multiplier_at_time=Decimal("0.00"),
        )

        set_holiday(user=user, date=_MON, is_holiday=False)

        entry.refresh_from_db()
        assert not UserHoliday.objects.filter(date=_MON).exists()
        assert entry.day_type == DayType.WEEKDAY  # segunda volta a dia útil
        assert entry.multiplier_at_time == Decimal("1.00")


# --- override avulso de multiplier_at_time (AC3) -------------------------------
def test_override_multiplier_at_time_changes_only_that_row(user):
    """"Nesse sábado eu trabalhei": UPDATE só naquela linha, sem sangrar."""
    with tenant_context(user):
        habit = HabitFactory(user=user, type="boolean")
        e1 = HabitDayEntryFactory(
            user=user, habit=habit, date=_SAT, weight_at_time=Decimal("2"),
            day_type=DayType.WEEKEND, multiplier_at_time=Decimal("0.20"),
        )
        e2 = HabitDayEntryFactory(
            user=user, habit=habit, date=_SAT + timedelta(days=1),
            weight_at_time=Decimal("2"), day_type=DayType.WEEKEND,
            multiplier_at_time=Decimal("0.20"),
        )
        update_habit_day_entry(user=user, entry_id=e1.id, multiplier_at_time=Decimal("1.00"))
        e1.refresh_from_db()
        e2.refresh_from_db()
        assert e1.multiplier_at_time == Decimal("1.00")
        assert e2.multiplier_at_time == Decimal("0.20")  # vizinho intacto


# --- Histórico read-only (Story 6.4, AC1/AC2/AC4) ------------------------------
# Datas fixas ancoradas na mesma semana da 6.3: _SAT=10/01 (sáb), _SUN=11/01,
# _MON=12/01. A semana 05–11/01/2026 começa numa segunda (05/01).
_HIST_MON = date(2026, 1, 5)   # segunda
_HIST_FRI = date(2026, 1, 9)   # sexta
_HIST_SAT = date(2026, 1, 10)  # sábado
_HIST_SUN = date(2026, 1, 11)  # domingo


def test_history_range_dia_materializado_retorna_pct(user):
    """Dia com linha booleana marcada → total_completion e groups com % (reusa a
    autoridade _completeness_pct)."""
    with tenant_context(user):
        group = HabitGroupFactory(user=user, name="Saúde")
        habit = HabitFactory(user=user, group=group, type="boolean", name="Ler")
        HabitDayEntryFactory(
            user=user, habit=habit, date=_HIST_MON, value=Decimal("1"),
            weight_at_time=Decimal("2"), day_type=DayType.WEEKDAY,
            multiplier_at_time=Decimal("1.00"),
        )
        result = get_habit_history_range(user=user, start=_HIST_MON, end=_HIST_MON)

    day = result["days"][0]
    assert day["date"] == _HIST_MON
    assert day["total_completion"] == 100
    assert day["groups"] == [{"id": group.id, "name": "Saúde", "completion": 100}]
    assert len(day["entries"]) == 1
    assert len(result["habits"]) == 1
    assert result["habits"][0].id == habit.id


def test_history_range_dia_sem_linha_e_lacuna_honesta(user):
    """Dia sem linha materializada → total_completion=None, groups=[], entries=[]
    (lacuna honesta, NUNCA 0% fabricado)."""
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        habit = HabitFactory(user=user, group=group, type="boolean")
        HabitDayEntryFactory(
            user=user, habit=habit, date=_HIST_MON, value=Decimal("1"),
            weight_at_time=Decimal("1"),
        )
        result = get_habit_history_range(user=user, start=_HIST_MON, end=_HIST_SUN)

    days_by_date = {d["date"]: d for d in result["days"]}
    # Range inteiro presente (segunda a domingo).
    assert len(result["days"]) == 7
    # Terça (sem linha) → lacuna.
    gap = days_by_date[date(2026, 1, 6)]
    assert gap["total_completion"] is None
    assert gap["groups"] == []
    assert gap["entries"] == []
    # Segunda → materializado, não é lacuna.
    assert days_by_date[_HIST_MON]["total_completion"] == 100


def test_history_range_nao_semeia_dias_passados(user):
    """A leitura NUNCA materializa: consultar dias nunca abertos (incl. um sábado)
    não cria nenhuma linha em habit_day_entries (AC1)."""
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        habit = HabitFactory(user=user, group=group, type="boolean")
        HabitVersionFactory(
            user=user, habit=habit, weight=Decimal("2"),
            active=True, effective_from=date(2025, 1, 1),
        )
        # Só um dia materializado; o resto do range nunca foi aberto.
        HabitDayEntryFactory(
            user=user, habit=habit, date=_HIST_MON, value=Decimal("1"),
            weight_at_time=Decimal("2"),
        )
        before = HabitDayEntry.objects.count()
        get_habit_history_range(user=user, start=_HIST_MON, end=_HIST_SUN)
        after = HabitDayEntry.objects.count()

    assert before == after == 1  # zero linhas criadas


def test_history_range_ordena_habits_por_grupo(user):
    """habits ordenados por (group.display_order, group.name, habit.name)."""
    with tenant_context(user):
        g_b = HabitGroupFactory(user=user, name="B-Grupo", display_order=1)
        g_a = HabitGroupFactory(user=user, name="A-Grupo", display_order=0)
        h_b = HabitFactory(user=user, group=g_b, type="boolean", name="Zeta")
        h_a = HabitFactory(user=user, group=g_a, type="boolean", name="Alfa")
        HabitDayEntryFactory(user=user, habit=h_b, date=_HIST_MON, weight_at_time=Decimal("1"))
        HabitDayEntryFactory(user=user, habit=h_a, date=_HIST_MON, weight_at_time=Decimal("1"))
        result = get_habit_history_range(user=user, start=_HIST_MON, end=_HIST_MON)

    # display_order 0 (A-Grupo/Alfa) vem antes de display_order 1 (B-Grupo/Zeta).
    assert [h.id for h in result["habits"]] == [h_a.id, h_b.id]


def test_history_range_maior_que_92_dias_domainerror(user):
    with tenant_context(user), pytest.raises(DomainError):
        get_habit_history_range(
            user=user, start=date(2026, 1, 1), end=date(2026, 1, 1) + timedelta(days=93)
        )


def test_history_range_start_depois_de_end_domainerror(user):
    with tenant_context(user), pytest.raises(DomainError):
        get_habit_history_range(user=user, start=_HIST_SUN, end=_HIST_MON)


def test_history_range_sombreia_dias_lacuna_com_day_type(user):
    """day_type resolve para TODO dia de calendário, inclusive lacunas (para o
    sombreamento de fim de semana/feriado no gráfico)."""
    with tenant_context(user):
        # Nenhuma linha materializada em todo o range → tudo lacuna, mas day_type resolve.
        result = get_habit_history_range(user=user, start=_HIST_FRI, end=_HIST_SUN)

    by_date = {d["date"]: d for d in result["days"]}
    assert by_date[_HIST_FRI]["day_type"] == "weekday"
    assert by_date[_HIST_SAT]["day_type"] == "weekend"
    assert by_date[_HIST_SUN]["day_type"] == "weekend"
    # Todas lacunas, sem hábitos que apareçam.
    assert result["habits"] == []


# --- get_habit_series ----------------------------------------------------------


def test_series_points_value_effective_weight_daytype_e_lacunas(user):
    """points trazem value/effective_weight/day_type; dias sem linha são omitidos."""
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        habit = HabitFactory(user=user, group=group, type="boolean")
        HabitVersionFactory(
            user=user, habit=habit, weight=Decimal("4"),
            active=True, effective_from=date(2025, 1, 1),
        )
        HabitDayEntryFactory(
            user=user, habit=habit, date=_HIST_MON, value=Decimal("1"),
            weight_at_time=Decimal("4"), multiplier_at_time=Decimal("1.00"),
            day_type=DayType.WEEKDAY,
        )
        # Sábado: multiplicador 0.5 → effective_weight = 4 × 0.5 = 2.00.
        HabitDayEntryFactory(
            user=user, habit=habit, date=_HIST_SAT, value=None,
            weight_at_time=Decimal("4"), multiplier_at_time=Decimal("0.50"),
            day_type=DayType.WEEKEND,
        )
        result = get_habit_series(user=user, habit_id=habit.id, start=_HIST_MON, end=_HIST_SUN)

    points = result["points"]
    # Segunda e sábado têm linha; os outros dias do range são omitidos (lacuna).
    assert [p["date"] for p in points] == [_HIST_MON, _HIST_SAT]
    assert points[0]["value"] == Decimal("1")
    assert points[0]["effective_weight"] == Decimal("4.00")
    assert points[0]["day_type"] == DayType.WEEKDAY
    assert points[1]["value"] is None
    assert points[1]["effective_weight"] == Decimal("2.00")
    assert points[1]["day_type"] == DayType.WEEKEND
    # day_types cobre o range inteiro (7 dias) para o sombreamento.
    assert len(result["day_types"]) == 7
    assert result["habit"].id == habit.id


def test_series_events_derivados_de_versoes_consecutivas(user):
    """events = diff de versões consecutivas (peso 3→4; ativar/desativar); só
    effective_from no range; before/after (nunca from/to)."""
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        habit = HabitFactory(user=user, group=group, type="boolean")
        # v1 fora do range (created não entra); v2/v3/v4 no range.
        HabitVersionFactory(user=user, habit=habit, weight=Decimal("3"), active=True,
                            effective_from=date(2025, 12, 1))
        HabitVersionFactory(user=user, habit=habit, weight=Decimal("4"), active=True,
                            effective_from=_HIST_MON)          # peso 3→4
        HabitVersionFactory(user=user, habit=habit, weight=Decimal("4"), active=False,
                            effective_from=_HIST_FRI)          # desativado
        HabitVersionFactory(user=user, habit=habit, weight=Decimal("4"), active=True,
                            effective_from=_HIST_SAT)          # reativado
        result = get_habit_series(user=user, habit_id=habit.id, start=_HIST_MON, end=_HIST_SUN)

    events = result["events"]
    assert [e["effective_from"] for e in events] == [_HIST_MON, _HIST_FRI, _HIST_SAT]
    # peso 3 → 4
    assert events[0]["changes"] == [{"field": "weight", "before": "3.00", "after": "4.00"}]
    # desativado (active true → false)
    assert events[1]["changes"] == [{"field": "active", "before": "true", "after": "false"}]
    # reativado (active false → true)
    assert events[2]["changes"] == [{"field": "active", "before": "false", "after": "true"}]
    # nenhuma chave 'from'/'to' nas mudanças
    for e in events:
        for change in e["changes"]:
            assert set(change.keys()) == {"field", "before", "after"}


def test_series_primeira_versao_created_so_se_no_range(user):
    """A primeira versão (created) só vira marcador se seu effective_from cair no range."""
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        habit = HabitFactory(user=user, group=group, type="boolean")
        HabitVersionFactory(user=user, habit=habit, weight=Decimal("2"), active=True,
                            effective_from=_HIST_MON)  # criada dentro do range
        result = get_habit_series(user=user, habit_id=habit.id, start=_HIST_MON, end=_HIST_SUN)

    assert len(result["events"]) == 1
    assert result["events"][0]["effective_from"] == _HIST_MON
    assert result["events"][0]["changes"] == [{"field": "created", "before": None, "after": None}]


def test_series_cross_tenant_habit_id_raises_does_not_exist(user, other_user):
    """habit_id de outro tenant → DoesNotExist (a view traduz para 404)."""
    with tenant_context(other_user):
        group = HabitGroupFactory(user=other_user)
        alheio = HabitFactory(user=other_user, group=group, type="boolean")
    with tenant_context(user), pytest.raises(Habit.DoesNotExist):
        get_habit_series(user=user, habit_id=alheio.id, start=_HIST_MON, end=_HIST_SUN)


def test_series_range_maior_que_92_domainerror(user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        habit = HabitFactory(user=user, group=group, type="boolean")
    with tenant_context(user), pytest.raises(DomainError):
        get_habit_series(
            user=user, habit_id=habit.id,
            start=date(2026, 1, 1), end=date(2026, 1, 1) + timedelta(days=93),
        )


def test_series_nao_semeia(user):
    """get_habit_series NUNCA materializa (mesmo sobre dias nunca abertos)."""
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        habit = HabitFactory(user=user, group=group, type="boolean")
        HabitVersionFactory(user=user, habit=habit, weight=Decimal("2"), active=True,
                            effective_from=date(2025, 1, 1))
        before = HabitDayEntry.objects.count()
        get_habit_series(user=user, habit_id=habit.id, start=_HIST_MON, end=_HIST_SUN)
        after = HabitDayEntry.objects.count()
    assert before == after == 0
