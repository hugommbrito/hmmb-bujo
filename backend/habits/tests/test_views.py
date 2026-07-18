"""Testes de view/API de hábitos (AC1–AC4 + isolamento §6.7)."""

from datetime import timedelta
from decimal import Decimal

from core.calendar import today_for
from core.tenant import tenant_context
from habits.models import HabitVersion
from habits.tests.factories import HabitFactory, HabitGroupFactory, HabitVersionFactory


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
