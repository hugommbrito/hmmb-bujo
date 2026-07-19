"""Testes de view/API de hábitos (AC1–AC4 + isolamento §6.7)."""

from datetime import date, timedelta
from decimal import Decimal

from core.calendar import today_for
from core.tenant import tenant_context
from habits.models import DayType, HabitDayEntry, HabitGroupDayMultiplier, HabitVersion
from habits.services import create_habit
from habits.tests.factories import (
    HabitDayEntryFactory,
    HabitFactory,
    HabitGroupDayMultiplierFactory,
    HabitGroupFactory,
    HabitVersionFactory,
)


# --- grupos (AC4) --------------------------------------------------------------
def test_get_groups_empty_returns_200(auth_client):
    response = auth_client.get("/api/habit-groups/")
    assert response.status_code == 200
    assert response.data == []


def test_post_group_creates_201(auth_client):
    response = auth_client.post("/api/habit-groups/", {"name": "Saúde"}, format="json")
    assert response.status_code == 201
    assert response.data["name"] == "Saúde"
    assert response.data["display_order"] == 0


# --- criar hábito (AC1) --------------------------------------------------------
def test_post_habit_creates_habit_and_first_version(auth_client, user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)

    response = auth_client.post(
        "/api/habits/",
        {"name": "Ler", "group": str(group.id), "type": "boolean", "weight": "2"},
        format="json",
    )
    assert response.status_code == 201, response.data
    assert response.data["name"] == "Ler"
    assert Decimal(response.data["weight"]) == Decimal("2")
    assert response.data["active"] is True
    assert response.data["effective_from"] == today_for(user).isoformat()
    with tenant_context(user):
        assert HabitVersion.objects.filter(habit_id=response.data["id"]).count() == 1


def test_post_habit_invalid_group_returns_400(auth_client):
    import uuid

    response = auth_client.post(
        "/api/habits/",
        {"name": "X", "group": str(uuid.uuid4()), "type": "boolean", "weight": "1"},
        format="json",
    )
    assert response.status_code == 400
    assert "group" in response.data.get("fields", {})


def test_post_boolean_habit_with_meta_returns_400(auth_client, user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
    response = auth_client.post(
        "/api/habits/",
        {"name": "X", "group": str(group.id), "type": "boolean", "weight": "1", "meta": "30"},
        format="json",
    )
    assert response.status_code == 400


# --- listar hábitos (AC3: include_inactive) ------------------------------------
def test_get_habits_hides_inactive_unless_flag(auth_client, user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        active = HabitFactory(user=user, group=group, type="boolean", name="Ativo")
        HabitVersionFactory(user=user, habit=active, active=True,
                            effective_from=today_for(user) - timedelta(days=1))
        inactive = HabitFactory(user=user, group=group, type="boolean", name="Inativo")
        HabitVersionFactory(user=user, habit=inactive, active=False,
                            effective_from=today_for(user) - timedelta(days=1))

    default = auth_client.get("/api/habits/")
    assert {h["name"] for h in default.data} == {"Ativo"}

    with_inactive = auth_client.get("/api/habits/?includeInactive=true")
    assert {h["name"] for h in with_inactive.data} == {"Ativo", "Inativo"}


# --- identidade / type imutável (AC1) ------------------------------------------
def test_patch_habit_updates_name(auth_client, user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        habit = HabitFactory(user=user, group=group, type="boolean", name="Antigo")
        HabitVersionFactory(user=user, habit=habit, effective_from=today_for(user))

    response = auth_client.patch(
        f"/api/habits/{habit.id}/", {"name": "Novo"}, format="json"
    )
    assert response.status_code == 200
    assert response.data["name"] == "Novo"


def test_patch_habit_type_change_returns_400(auth_client, user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        habit = HabitFactory(user=user, group=group, type="boolean")
        HabitVersionFactory(user=user, habit=habit, effective_from=today_for(user))

    response = auth_client.patch(
        f"/api/habits/{habit.id}/", {"type": "numeric"}, format="json"
    )
    assert response.status_code == 400


# --- versões: mudar peso / desativar (AC2, AC3) --------------------------------
def test_post_version_deactivates_habit(auth_client, user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        habit = HabitFactory(user=user, group=group, type="boolean")
        HabitVersionFactory(user=user, habit=habit, active=True,
                            effective_from=today_for(user) - timedelta(days=1))

    response = auth_client.post(
        f"/api/habits/{habit.id}/versions/", {"active": False}, format="json"
    )
    assert response.status_code == 201
    assert response.data["active"] is False
    assert response.data["effective_from"] == today_for(user).isoformat()


def test_post_version_on_missing_habit_returns_404(auth_client):
    import uuid

    response = auth_client.post(
        f"/api/habits/{uuid.uuid4()}/versions/", {"weight": "5"}, format="json"
    )
    assert response.status_code == 404


# --- isolamento multi-tenant (§6.7) --------------------------------------------
def test_habits_are_tenant_scoped(auth_client, user, other_user):
    with tenant_context(other_user):
        group = HabitGroupFactory(user=other_user)
        other_habit = HabitFactory(user=other_user, group=group, type="boolean")
        HabitVersionFactory(user=other_user, habit=other_habit,
                            effective_from=today_for(other_user))

    # auth_client está autenticado como `user` — não vê hábitos de other_user.
    listing = auth_client.get("/api/habits/")
    assert listing.data == []

    # E não consegue mutar o hábito do outro tenant (auto-scope → 404).
    patch = auth_client.patch(
        f"/api/habits/{other_habit.id}/", {"name": "Invadido"}, format="json"
    )
    assert patch.status_code == 404


# ==============================================================================
# Story 6.2 — tracker do dia (GET days / PATCH entry)
# ==============================================================================


def test_get_day_seeds_and_returns_tracker_payload(auth_client, user):
    """GET default=hoje materializa (idempotente) e retorna o payload completo."""
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        create_habit(
            user=user, name="Água", group_id=group.id, type="boolean", weight=Decimal("1")
        )

    # response.data é snake_case (a camelização é feita só no renderer JSON).
    response = auth_client.get("/api/habits/days/")
    assert response.status_code == 200, response.data
    assert response.data["date"] == today_for(user).isoformat()
    assert response.data["total_completion"] == 0  # nada marcado ainda
    assert len(response.data["entries"]) == 1
    entry = response.data["entries"][0]
    assert entry["name"] == "Água"
    assert entry["value"] is None
    assert entry["weight_at_time"] == "1.00"
    assert len(response.data["groups"]) == 1

    # Idempotência via HTTP: 2ª chamada não duplica linhas.
    auth_client.get("/api/habits/days/")
    with tenant_context(user):
        assert HabitDayEntry.objects.filter(date=today_for(user)).count() == 1


def test_get_day_weighted_completion(auth_client, user):
    """Âncora ponderada exposta pela API: (1×1 + 0.4×2)/3 = 60%."""
    day = date(2026, 3, 1)
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        boolean = HabitFactory(user=user, group=group, type="boolean")
        HabitDayEntryFactory(
            user=user, habit=boolean, date=day, value=Decimal("1"),
            weight_at_time=Decimal("1"),
        )
        numeric = HabitFactory(user=user, group=group, type="numeric")
        HabitDayEntryFactory(
            user=user, habit=numeric, date=day, value=Decimal("2500"),
            weight_at_time=Decimal("2"), meta_at_time=Decimal("5000"),
            bonus_at_time=Decimal("20"),
        )

    response = auth_client.get(f"/api/habits/days/?date={day.isoformat()}")
    assert response.status_code == 200
    assert response.data["total_completion"] == 60


def test_get_day_invalid_date_returns_400(auth_client):
    response = auth_client.get("/api/habits/days/?date=2026-13-99")
    assert response.status_code == 400
    assert "date" in response.data.get("fields", {})


def test_patch_entry_marks_value(auth_client, user):
    day = date(2026, 3, 1)
    with tenant_context(user):
        habit = HabitFactory(user=user, type="boolean")
        entry = HabitDayEntryFactory(
            user=user, habit=habit, date=day, value=None, weight_at_time=Decimal("1"),
        )

    response = auth_client.patch(
        f"/api/habits/days/{entry.id}/", {"value": "1"}, format="json"
    )
    assert response.status_code == 200, response.data
    assert Decimal(response.data["value"]) == Decimal("1")


def test_patch_entry_corrects_weight_at_time(auth_client, user):
    day = date(2026, 3, 1)
    with tenant_context(user):
        habit = HabitFactory(user=user, type="boolean")
        entry = HabitDayEntryFactory(
            user=user, habit=habit, date=day, weight_at_time=Decimal("1"),
        )

    # Envio camelCase (o parser aceita e converte para snake_case); resposta
    # em response.data é snake_case.
    response = auth_client.patch(
        f"/api/habits/days/{entry.id}/", {"weightAtTime": "5"}, format="json"
    )
    assert response.status_code == 200
    assert Decimal(response.data["weight_at_time"]) == Decimal("5")


def test_patch_entry_rejects_identity_mutation(auth_client, user):
    """Trocar habit/date de uma linha materializada é rejeitado (400)."""
    day = date(2026, 3, 1)
    with tenant_context(user):
        habit = HabitFactory(user=user, type="boolean")
        entry = HabitDayEntryFactory(
            user=user, habit=habit, date=day, weight_at_time=Decimal("1"),
        )

    response = auth_client.patch(
        f"/api/habits/days/{entry.id}/", {"date": "2026-03-02"}, format="json"
    )
    assert response.status_code == 400


def test_patch_entry_other_tenant_returns_404(auth_client, user, other_user):
    day = date(2026, 3, 1)
    with tenant_context(other_user):
        habit = HabitFactory(user=other_user, type="boolean")
        entry = HabitDayEntryFactory(
            user=other_user, habit=habit, date=day, weight_at_time=Decimal("1"),
        )

    response = auth_client.patch(
        f"/api/habits/days/{entry.id}/", {"value": "1"}, format="json"
    )
    assert response.status_code == 404


# ==============================================================================
# Story 6.3 — multiplicador por tipo de dia + feriado (API)
# ==============================================================================

# 2026-01: 01=qui; 10=sáb, 12=seg.
_SAT_6_3 = date(2026, 1, 10)
_MON_6_3 = date(2026, 1, 12)


def test_get_day_includes_day_type_and_frozen_multiplier(auth_client, user):
    """GET days expõe day_type (nível-dia) e day_type/multiplier_at_time nas linhas."""
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        HabitGroupDayMultiplierFactory(
            user=user, group=group, day_type=DayType.WEEKEND,
            multiplier=Decimal("0.20"), effective_from=date(2026, 1, 1),
        )
        # Versão vigente antes do sábado consultado (create_habit nasceria hoje).
        habit = HabitFactory(user=user, group=group, type="boolean", name="Ler")
        HabitVersionFactory(
            user=user, habit=habit, weight=Decimal("2"), effective_from=date(2026, 1, 1)
        )

    response = auth_client.get(f"/api/habits/days/?date={_SAT_6_3.isoformat()}")
    assert response.status_code == 200, response.data
    # response.data é snake_case (camelização só no renderer JSON).
    assert response.data["day_type"] == "weekend"
    entry = response.data["entries"][0]
    assert entry["day_type"] == "weekend"
    assert entry["multiplier_at_time"] == "0.20"


def test_get_multipliers_returns_current_config(auth_client, user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        HabitGroupDayMultiplierFactory(
            user=user, group=group, day_type=DayType.WEEKEND,
            multiplier=Decimal("0.20"), effective_from=date(2026, 1, 1),
        )

    response = auth_client.get(f"/api/habit-groups/{group.id}/multipliers/")
    assert response.status_code == 200, response.data
    assert Decimal(response.data["weekend"]) == Decimal("0.20")
    assert Decimal(response.data["holiday"]) == Decimal("1.00")


def test_put_multipliers_sets_prospectively(auth_client, user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)

    response = auth_client.put(
        f"/api/habit-groups/{group.id}/multipliers/",
        {"weekend": "0.20", "holiday": "0.00"},
        format="json",
    )
    assert response.status_code == 200, response.data
    assert Decimal(response.data["weekend"]) == Decimal("0.20")
    assert Decimal(response.data["holiday"]) == Decimal("0.00")
    with tenant_context(user):
        rows = HabitGroupDayMultiplier.objects.filter(group=group)
        assert rows.count() == 2
        assert all(r.effective_from == today_for(user) for r in rows)


def test_put_multipliers_empty_returns_400(auth_client, user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
    response = auth_client.put(
        f"/api/habit-groups/{group.id}/multipliers/", {}, format="json"
    )
    assert response.status_code == 400


def test_get_multipliers_missing_group_returns_404(auth_client):
    import uuid

    response = auth_client.get(f"/api/habit-groups/{uuid.uuid4()}/multipliers/")
    assert response.status_code == 404


def test_post_holiday_marks_and_recalculates_the_day(auth_client, user):
    """POST holiday escreve UserHoliday e recalcula só aquele dia (bounded)."""
    from accounts.models import UserHoliday

    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        HabitGroupDayMultiplierFactory(
            user=user, group=group, day_type=DayType.HOLIDAY,
            multiplier=Decimal("0.00"), effective_from=date(2026, 1, 1),
        )
        habit = HabitFactory(user=user, group=group, type="boolean")
        entry = HabitDayEntryFactory(
            user=user, habit=habit, date=_MON_6_3, value=Decimal("1"),
            weight_at_time=Decimal("1"), day_type=DayType.WEEKDAY,
            multiplier_at_time=Decimal("1.00"),
        )

    response = auth_client.post(
        "/api/habits/holidays/",
        {"date": _MON_6_3.isoformat(), "isHoliday": True},
        format="json",
    )
    assert response.status_code == 200, response.data
    assert response.data["day_type"] == "holiday"
    with tenant_context(user):
        assert UserHoliday.objects.filter(date=_MON_6_3).exists()
        entry.refresh_from_db()
        assert entry.day_type == DayType.HOLIDAY
        assert entry.multiplier_at_time == Decimal("0.00")
        assert entry.value == Decimal("1")  # value preservado


def test_patch_entry_override_multiplier(auth_client, user):
    """Override avulso via PATCH: multiplier_at_time de uma linha (AC3)."""
    with tenant_context(user):
        habit = HabitFactory(user=user, type="boolean")
        entry = HabitDayEntryFactory(
            user=user, habit=habit, date=_SAT_6_3, weight_at_time=Decimal("2"),
            day_type=DayType.WEEKEND, multiplier_at_time=Decimal("0.20"),
        )

    response = auth_client.patch(
        f"/api/habits/days/{entry.id}/", {"multiplierAtTime": "1.00"}, format="json"
    )
    assert response.status_code == 200, response.data
    assert Decimal(response.data["multiplier_at_time"]) == Decimal("1.00")


def test_multipliers_other_tenant_returns_404(auth_client, user, other_user):
    with tenant_context(other_user):
        group = HabitGroupFactory(user=other_user)

    response = auth_client.get(f"/api/habit-groups/{group.id}/multipliers/")
    assert response.status_code == 404


# ==============================================================================
# Story 6.4 — histórico read-only (GET history / GET series)
# ==============================================================================

_H_MON = date(2026, 1, 5)   # segunda
_H_FRI = date(2026, 1, 9)   # sexta
_H_SAT = date(2026, 1, 10)  # sábado
_H_SUN = date(2026, 1, 11)  # domingo


def test_get_history_range_returns_shape(auth_client, user):
    """GET /api/habits/history/ → 200 com days (todos os dias) e habits; snake_case."""
    with tenant_context(user):
        group = HabitGroupFactory(user=user, name="Saúde")
        habit = HabitFactory(user=user, group=group, type="boolean", name="Ler")
        HabitDayEntryFactory(
            user=user, habit=habit, date=_H_MON, value=Decimal("1"),
            weight_at_time=Decimal("2"), day_type=DayType.WEEKDAY,
        )

    response = auth_client.get(
        f"/api/habits/history/?start={_H_MON.isoformat()}&end={_H_SUN.isoformat()}"
    )
    assert response.status_code == 200, response.data
    # response.data é snake_case (camelização só no renderer JSON).
    assert response.data["start"] == _H_MON.isoformat()
    assert response.data["end"] == _H_SUN.isoformat()
    assert len(response.data["days"]) == 7
    assert len(response.data["habits"]) == 1
    days = {d["date"]: d for d in response.data["days"]}
    # Segunda materializada: 100%; sábado (lacuna) None; sábado é weekend.
    assert days[_H_MON.isoformat()]["total_completion"] == 100
    assert days[_H_MON.isoformat()]["groups"][0]["completion"] == 100
    assert days[_H_SAT.isoformat()]["total_completion"] is None
    assert days[_H_SAT.isoformat()]["day_type"] == "weekend"


def test_get_history_default_range_is_30_days(auth_client, user):
    """Sem params: default end=hoje, start=hoje-29 → 30 dias inclusive."""
    response = auth_client.get("/api/habits/history/")
    assert response.status_code == 200, response.data
    assert len(response.data["days"]) == 30
    assert response.data["end"] == today_for(user).isoformat()


def test_get_history_does_not_seed(auth_client, user):
    """Consultar histórico NUNCA materializa linhas (AC1)."""
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        habit = HabitFactory(user=user, group=group, type="boolean")
        HabitDayEntryFactory(
            user=user, habit=habit, date=_H_MON, value=Decimal("1"),
            weight_at_time=Decimal("1"),
        )
        before = HabitDayEntry.objects.count()

    auth_client.get(
        f"/api/habits/history/?start={_H_MON.isoformat()}&end={_H_SUN.isoformat()}"
    )
    with tenant_context(user):
        assert HabitDayEntry.objects.count() == before == 1


def test_get_history_invalid_date_returns_400(auth_client):
    response = auth_client.get("/api/habits/history/?start=2026-13-99&end=2026-01-01")
    assert response.status_code == 400
    assert "start" in response.data.get("fields", {})


def test_get_history_range_too_large_returns_400(auth_client):
    response = auth_client.get("/api/habits/history/?start=2026-01-01&end=2026-06-01")
    assert response.status_code == 400
    assert "exceder" in response.data["detail"]


def test_get_series_returns_shape(auth_client, user):
    """GET /api/habits/<pk>/series/ → 200 com points/events/day_types; snake_case."""
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        habit = HabitFactory(user=user, group=group, type="boolean", name="Ler")
        HabitVersionFactory(user=user, habit=habit, weight=Decimal("3"), active=True,
                            effective_from=date(2025, 12, 1))
        HabitVersionFactory(user=user, habit=habit, weight=Decimal("4"), active=True,
                            effective_from=_H_MON)  # peso 3→4 no range
        HabitDayEntryFactory(
            user=user, habit=habit, date=_H_MON, value=Decimal("1"),
            weight_at_time=Decimal("4"), multiplier_at_time=Decimal("1.00"),
        )

    response = auth_client.get(
        f"/api/habits/{habit.id}/series/?start={_H_MON.isoformat()}&end={_H_SUN.isoformat()}"
    )
    assert response.status_code == 200, response.data
    assert response.data["habit"]["name"] == "Ler"
    assert len(response.data["points"]) == 1
    assert response.data["points"][0]["value"] == "1.00"
    assert response.data["points"][0]["effective_weight"] == "4.00"
    # evento de mudança de peso, com before/after (nunca from/to)
    assert len(response.data["events"]) == 1
    change = response.data["events"][0]["changes"][0]
    assert change == {"field": "weight", "before": "3.00", "after": "4.00"}
    assert len(response.data["day_types"]) == 7


def test_get_series_cross_tenant_returns_404(auth_client, other_user):
    """Série de um hábito de outro tenant → 404 (auto-scope + DoesNotExist)."""
    with tenant_context(other_user):
        group = HabitGroupFactory(user=other_user)
        alheio = HabitFactory(user=other_user, group=group, type="boolean")
    response = auth_client.get(f"/api/habits/{alheio.id}/series/")
    assert response.status_code == 404


def test_get_series_range_too_large_returns_400(auth_client, user):
    with tenant_context(user):
        group = HabitGroupFactory(user=user)
        habit = HabitFactory(user=user, group=group, type="boolean")
        HabitVersionFactory(user=user, habit=habit, weight=Decimal("1"), active=True,
                            effective_from=date(2025, 1, 1))
    response = auth_client.get(
        f"/api/habits/{habit.id}/series/?start=2026-01-01&end=2026-06-01"
    )
    assert response.status_code == 400
    assert "exceder" in response.data["detail"]
