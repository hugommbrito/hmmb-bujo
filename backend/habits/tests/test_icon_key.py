"""``icon_key`` em Hábitos — contrato de API (Story 16.2).

Cobre a I/O Matrix da story ponta a ponta pela API: criar com/sem chave, 400 de
chave inexistente e de PascalCase, PATCH que persiste, PATCH que limpa, exposição
nas superfícies de leitura e isolamento entre tenants.

O wire é camelCase (``iconKey``); ``response.data`` é snake_case (a camelização
só acontece no renderer JSON) — mesma convenção de ``health/tests/test_views.py``.
Antes desta story **nenhum** teste assevera o campo cosmético do hábito.
"""

from datetime import timedelta
from decimal import Decimal

from core.calendar import today_for
from core.tenant import tenant_context
from habits.models import Habit
from habits.tests.factories import (
    HabitDayEntryFactory,
    HabitFactory,
    HabitGroupFactory,
    HabitVersionFactory,
)

_URL = "/api/habits/"


def _group(user):
    with tenant_context(user):
        return HabitGroupFactory(user=user)


def _payload(group, **overrides):
    body = {"name": "Ler", "group": str(group.id), "type": "boolean", "weight": "2"}
    body.update(overrides)
    return body


# --- criar ---------------------------------------------------------------------
def test_post_com_chave_valida_persiste_e_devolve(auth_client, user):
    group = _group(user)
    response = auth_client.post(
        _URL, _payload(group, iconKey="barbell"), format="json"
    )
    assert response.status_code == 201, response.data
    assert response.data["icon_key"] == "barbell"
    with tenant_context(user):
        assert Habit.objects.get(id=response.data["id"]).icon_key == "barbell"


def test_post_sem_chave_devolve_null(auth_client, user):
    """Hábito sem pictograma é estado válido — a coluna do glifo fica vazia."""
    group = _group(user)
    response = auth_client.post(_URL, _payload(group), format="json")
    assert response.status_code == 201, response.data
    assert response.data["icon_key"] is None
    with tenant_context(user):
        assert Habit.objects.get(id=response.data["id"]).icon_key is None


def test_post_com_chave_inexistente_retorna_400(auth_client, user):
    group = _group(user)
    response = auth_client.post(
        _URL, _payload(group, iconKey="nao-existe"), format="json"
    )
    assert response.status_code == 400
    assert "icon_key" in response.data.get("fields", {})
    with tenant_context(user):
        assert not Habit.objects.exists()


def test_post_com_chave_pascalcase_retorna_400(auth_client, user):
    """Só kebab-case é aceito: ``AddressBook`` é o export do pacote, não o nome público."""
    group = _group(user)
    response = auth_client.post(
        _URL, _payload(group, iconKey="AddressBook"), format="json"
    )
    assert response.status_code == 400
    assert "icon_key" in response.data.get("fields", {})


# --- editar (identidade, não versionada) ---------------------------------------
def test_patch_persiste_a_chave(auth_client, user):
    """Regressão do bug silencioso: fora de ``_IDENTITY_FIELDS`` o PATCH devolveria
    200 sem gravar nada."""
    with tenant_context(user):
        habit = HabitFactory(user=user)
        HabitVersionFactory(user=user, habit=habit, effective_from=today_for(user))

    response = auth_client.patch(
        f"{_URL}{habit.id}/", {"iconKey": "book-open"}, format="json"
    )
    assert response.status_code == 200, response.data
    assert response.data["icon_key"] == "book-open"
    with tenant_context(user):
        habit.refresh_from_db()
        assert habit.icon_key == "book-open"


def test_patch_com_null_limpa_o_pictograma(auth_client, user):
    with tenant_context(user):
        habit = HabitFactory(user=user, icon_key="barbell")
        HabitVersionFactory(user=user, habit=habit, effective_from=today_for(user))

    response = auth_client.patch(f"{_URL}{habit.id}/", {"iconKey": None}, format="json")
    assert response.status_code == 200, response.data
    assert response.data["icon_key"] is None
    with tenant_context(user):
        habit.refresh_from_db()
        assert habit.icon_key is None


def test_patch_com_chave_inexistente_retorna_400_e_nao_persiste(auth_client, user):
    with tenant_context(user):
        habit = HabitFactory(user=user, icon_key="barbell")
        HabitVersionFactory(user=user, habit=habit, effective_from=today_for(user))

    response = auth_client.patch(
        f"{_URL}{habit.id}/", {"iconKey": "nao-existe"}, format="json"
    )
    assert response.status_code == 400
    assert "icon_key" in response.data.get("fields", {})
    with tenant_context(user):
        habit.refresh_from_db()
        assert habit.icon_key == "barbell"


def test_espacos_em_volta_sao_aparados_pela_api(auth_client, user):
    """O `CharField` do DRF apara espaços antes da validação (`trim_whitespace`).

    Documenta a borda: `"  barbell  "` NÃO é 400 — entra como `"barbell"`. O valor
    persistido é sempre uma chave canônica do catálogo, que é o que importa; a
    função `is_valid_icon_key` sozinha rejeitaria a string com espaços.
    """
    with tenant_context(user):
        group = HabitGroupFactory(user=user)

    response = auth_client.post(
        _URL,
        {
            "name": "Treino",
            "group": str(group.id),
            "type": "boolean",
            "weight": "1.00",
            "iconKey": "  barbell  ",
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.data["icon_key"] == "barbell"


def test_string_vazia_e_rejeitada(auth_client, user):
    """`""` não é o caminho de limpar o pictograma — `null` é (sem `allow_blank`)."""
    with tenant_context(user):
        group = HabitGroupFactory(user=user)

    response = auth_client.post(
        _URL,
        {
            "name": "Treino",
            "group": str(group.id),
            "type": "boolean",
            "weight": "1.00",
            "iconKey": "",
        },
        format="json",
    )

    assert response.status_code == 400
    assert "icon_key" in response.data["fields"]


def test_patch_de_outro_campo_nao_apaga_a_chave(auth_client, user):
    """``icon_key`` é identidade: renomear o hábito não pode zerar o pictograma."""
    with tenant_context(user):
        habit = HabitFactory(user=user, icon_key="barbell")
        HabitVersionFactory(user=user, habit=habit, effective_from=today_for(user))

    response = auth_client.patch(f"{_URL}{habit.id}/", {"name": "Novo"}, format="json")
    assert response.status_code == 200, response.data
    assert response.data["icon_key"] == "barbell"


def test_emoticon_continua_gravavel_e_independente(auth_client, user):
    """A coluna ``emoticon`` permanece como dado histórico — a story não a dropa
    nem para de gravá-la (as superfícies legado ainda a leem)."""
    group = _group(user)
    response = auth_client.post(
        _URL, _payload(group, emoticon="✅", iconKey="check-circle"), format="json"
    )
    assert response.status_code == 201, response.data
    assert response.data["emoticon"] == "✅"
    assert response.data["icon_key"] == "check-circle"


# --- leitura nas demais superfícies --------------------------------------------
def test_lista_de_habitos_expoe_a_chave(auth_client, user):
    with tenant_context(user):
        habit = HabitFactory(user=user, icon_key="barbell")
        HabitVersionFactory(user=user, habit=habit, effective_from=today_for(user))

    response = auth_client.get(_URL)
    assert response.status_code == 200
    assert [h["icon_key"] for h in response.data] == ["barbell"]


def test_tracker_do_dia_expoe_a_chave_da_linha(auth_client, user):
    today = today_for(user)
    with tenant_context(user):
        habit = HabitFactory(user=user, icon_key="drop")
        HabitVersionFactory(
            user=user, habit=habit, weight=Decimal("1"), active=True,
            effective_from=today - timedelta(days=1),
        )

    response = auth_client.get(f"/api/habits/days/?date={today.isoformat()}")
    assert response.status_code == 200, response.data
    assert [e["icon_key"] for e in response.data["entries"]] == ["drop"]


def test_historico_expoe_a_chave_no_slim(auth_client, user):
    today = today_for(user)
    with tenant_context(user):
        habit = HabitFactory(user=user, icon_key="book-open")
        HabitVersionFactory(
            user=user, habit=habit, weight=Decimal("1"), active=True,
            effective_from=today - timedelta(days=2),
        )
        HabitDayEntryFactory(
            user=user, habit=habit, date=today, value=None,
            weight_at_time=Decimal("1"),
        )

    response = auth_client.get(
        f"/api/habits/history/?start={today.isoformat()}&end={today.isoformat()}"
    )
    assert response.status_code == 200, response.data
    assert [h["icon_key"] for h in response.data["habits"]] == ["book-open"]


def test_habito_sem_chave_sai_null_na_leitura(auth_client, user):
    with tenant_context(user):
        habit = HabitFactory(user=user, icon_key=None)
        HabitVersionFactory(user=user, habit=habit, effective_from=today_for(user))

    response = auth_client.get(_URL)
    assert response.data[0]["icon_key"] is None


# --- isolamento entre tenants (§6.7) -------------------------------------------
def test_patch_em_habito_de_outro_tenant_retorna_404(auth_client, other_user):
    with tenant_context(other_user):
        habit = HabitFactory(user=other_user, icon_key="barbell")

    response = auth_client.patch(
        f"{_URL}{habit.id}/", {"iconKey": "drop"}, format="json"
    )
    assert response.status_code == 404
    with tenant_context(other_user):
        habit.refresh_from_db()
        assert habit.icon_key == "barbell"


def test_lista_nao_vaza_a_chave_de_outro_tenant(auth_client, user, other_user):
    with tenant_context(other_user):
        alheio = HabitFactory(user=other_user, icon_key="alien")
        HabitVersionFactory(user=other_user, habit=alheio, effective_from=today_for(other_user))
    with tenant_context(user):
        meu = HabitFactory(user=user, icon_key="barbell")
        HabitVersionFactory(user=user, habit=meu, effective_from=today_for(user))

    response = auth_client.get(_URL)
    assert [h["icon_key"] for h in response.data] == ["barbell"]
