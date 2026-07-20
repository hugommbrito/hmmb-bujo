"""Testes de view/API do Diário de Gratidão (AC1–AC4, AC6, AC8).

O wire é camelCase: ``created_at`` do serializer vira ``createdAt`` na borda (provado
inspecionando ``response.content``). ``response.data`` é snake_case (a camelização só
acontece no renderer JSON).
"""

import json
import uuid

from core.calendar import today_for
from core.tenant import tenant_context
from gratitude.models import GratitudeEntry
from gratitude.tests.factories import GratitudeEntryFactory

_DAYS = "/api/gratitude/days/"
_ENTRIES = "/api/gratitude/entries/"


# --- AC1/AC4: criar entrada ----------------------------------------------------
def test_post_creates_entry_default_today(auth_client, user):
    """AC1/AC4: POST sem ``date`` grava na data de hoje do usuário (resolvida no servidor)."""
    resp = auth_client.post(_ENTRIES, {"text": "Grato pelo café da manhã"}, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["text"] == "Grato pelo café da manhã"
    assert resp.data["date"] == today_for(user).isoformat()
    uuid.UUID(str(resp.data["id"]))
    with tenant_context(user):
        assert GratitudeEntry.objects.filter(id=resp.data["id"]).exists()


def test_post_creates_entry_on_selected_date(auth_client, user):
    """AC4: POST com ``date`` grava na data selecionada (hoje/ontem)."""
    resp = auth_client.post(
        _ENTRIES, {"text": "Grato por ontem", "date": "2026-01-15"}, format="json"
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["date"] == "2026-01-15"


def test_post_blank_text_returns_400(auth_client):
    """AC1: texto vazio → 400 no serializer."""
    resp = auth_client.post(_ENTRIES, {"text": ""}, format="json")
    assert resp.status_code == 400
    assert "text" in resp.data.get("fields", {})


def test_post_whitespace_text_returns_400(auth_client):
    """AC1: texto só-espaços → 400 (trim_whitespace + allow_blank=False)."""
    resp = auth_client.post(_ENTRIES, {"text": "    "}, format="json")
    assert resp.status_code == 400
    assert "text" in resp.data.get("fields", {})


def test_post_entry_camelcase_on_the_edge(auth_client):
    """AC3/contrato: ``created_at`` sai como ``createdAt`` na borda (JSON renderizado)."""
    resp = auth_client.post(_ENTRIES, {"text": "Grato"}, format="json")
    assert resp.status_code == 201
    body = json.loads(resp.content)
    assert "createdAt" in body
    assert "created_at" not in body


# --- AC2: múltiplas entradas no mesmo dia --------------------------------------
def test_multiple_entries_same_day_via_api(auth_client, user):
    """AC2: duas entradas na mesma data — ambas persistem (sem constraint de dia)."""
    today = today_for(user).isoformat()
    auth_client.post(_ENTRIES, {"text": "Primeira", "date": today}, format="json")
    auth_client.post(_ENTRIES, {"text": "Segunda", "date": today}, format="json")

    resp = auth_client.get(_DAYS)
    assert resp.status_code == 200, resp.data
    texts = [e["text"] for e in resp.data["entries"]]
    assert texts == ["Primeira", "Segunda"]


# --- AC3: listar por data ------------------------------------------------------
def test_get_days_default_today_lists_entries(auth_client, user):
    """AC3: GET sem ``date`` lista as entradas de hoje, com ``date``/``createdAt``."""
    auth_client.post(_ENTRIES, {"text": "Grato hoje"}, format="json")
    resp = auth_client.get(_DAYS)
    assert resp.status_code == 200, resp.data
    assert resp.data["date"] == today_for(user).isoformat()
    assert len(resp.data["entries"]) == 1
    entry = resp.data["entries"][0]
    assert entry["text"] == "Grato hoje"
    assert entry["created_at"] is not None

    # camelCase na borda: cada entrada expõe ``createdAt``.
    body = json.loads(resp.content)
    assert "createdAt" in body["entries"][0]


def test_get_days_specific_date(auth_client, user):
    """AC3/AC4: GET ``?date=`` lista as entradas daquela data."""
    with tenant_context(user):
        GratitudeEntryFactory(user=user, date="2026-01-15", text="do dia 15")
        GratitudeEntryFactory(user=user, date="2026-01-16", text="do dia 16")
    resp = auth_client.get(f"{_DAYS}?date=2026-01-15")
    assert resp.status_code == 200
    assert [e["text"] for e in resp.data["entries"]] == ["do dia 15"]


def test_get_days_empty_state(auth_client, user):
    """AC6: dia sem entradas → lista vazia (a UI mostra o estado vazio informativo)."""
    resp = auth_client.get(_DAYS)
    assert resp.status_code == 200
    assert resp.data["entries"] == []


def test_get_days_invalid_date_returns_400(auth_client):
    """AC4: ``date`` malformada → 400."""
    resp = auth_client.get(f"{_DAYS}?date=2026-13-99")
    assert resp.status_code == 400
    assert "date" in resp.data.get("fields", {})


# --- AC8: isolamento multi-tenant ----------------------------------------------
def test_entries_are_tenant_scoped(auth_client, user, other_user):
    """AC8: uma entrada de outro usuário nunca é lida (cross-tenant → lista vazia)."""
    with tenant_context(other_user):
        GratitudeEntryFactory(user=other_user, date=today_for(other_user), text="Alheio")
    resp = auth_client.get(_DAYS)
    assert resp.status_code == 200
    assert resp.data["entries"] == []
