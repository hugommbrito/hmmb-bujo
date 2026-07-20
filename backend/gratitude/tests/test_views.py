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
_MONTHS = "/api/gratitude/months/"
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


# --- 9.2 AC1/AC4: histórico por mês --------------------------------------------
def test_get_months_default_current_month(auth_client, user):
    """9.2 AC1/AC4: GET sem ``month`` usa o mês corrente do usuário (dia 1 via today_for)."""
    resp = auth_client.get(_MONTHS)
    assert resp.status_code == 200, resp.data
    assert resp.data["month"] == today_for(user).replace(day=1).isoformat()


def test_get_months_default_returns_current_month_entries(auth_client, user):
    """9.2 AC1/AC4: GET sem ``month`` agrupa e retorna as entradas do mês corrente
    (não só o campo ``month`` — exercita o caminho default de ponta a ponta)."""
    with tenant_context(user):
        GratitudeEntryFactory(user=user, date=today_for(user), text="deste mês")
    resp = auth_client.get(_MONTHS)
    assert resp.status_code == 200, resp.data
    assert resp.data["month"] == today_for(user).replace(day=1).isoformat()
    texts = [e["text"] for d in resp.data["days"] for e in d["entries"]]
    assert "deste mês" in texts


def test_get_months_specific_month_normalizes_and_filters(auth_client, user):
    """9.2 AC1/AC4: ``?month=2026-01-15`` normaliza para janeiro/2026 (dia 1) e lista só
    as entradas de janeiro, agrupadas por dia em ordem cronológica ascendente."""
    with tenant_context(user):
        GratitudeEntryFactory(user=user, date="2026-01-10", text="jan-10")
        GratitudeEntryFactory(user=user, date="2026-01-20", text="jan-20")
        GratitudeEntryFactory(user=user, date="2026-02-05", text="fev-05")
    resp = auth_client.get(f"{_MONTHS}?month=2026-01-15")
    assert resp.status_code == 200, resp.data
    assert resp.data["month"] == "2026-01-01"  # normalizado para o dia 1
    dates = [d["date"] for d in resp.data["days"]]
    assert dates == ["2026-01-10", "2026-01-20"]  # só janeiro, dias ascendentes
    assert [e["text"] for e in resp.data["days"][0]["entries"]] == ["jan-10"]


def test_get_months_empty_state(auth_client):
    """9.2 AC5: mês sem entradas → ``days=[]``."""
    resp = auth_client.get(f"{_MONTHS}?month=2026-01-01")
    assert resp.status_code == 200
    assert resp.data["days"] == []


def test_get_months_invalid_month_returns_400(auth_client):
    """9.2 AC1: ``month`` malformado → 400 (mesmo idioma do ``days/``)."""
    resp = auth_client.get(f"{_MONTHS}?month=2026-13-99")
    assert resp.status_code == 400
    assert "month" in resp.data.get("fields", {})


def test_get_months_camelcase_on_the_edge(auth_client, user):
    """9.2 AC7/contrato: ``created_at`` sai como ``createdAt`` na borda, dentro de
    ``days[].entries[]`` (JSON renderizado)."""
    with tenant_context(user):
        GratitudeEntryFactory(user=user, date="2026-01-10", text="jan-10")
    resp = auth_client.get(f"{_MONTHS}?month=2026-01-01")
    assert resp.status_code == 200
    body = json.loads(resp.content)
    entry = body["days"][0]["entries"][0]
    assert "createdAt" in entry
    assert "created_at" not in entry


def test_get_months_is_tenant_scoped(auth_client, user, other_user):
    """9.2 AC7: entradas de outro usuário nunca aparecem (cross-tenant → mês vazio)."""
    with tenant_context(other_user):
        GratitudeEntryFactory(user=other_user, date="2026-01-10", text="Alheio")
    resp = auth_client.get(f"{_MONTHS}?month=2026-01-01")
    assert resp.status_code == 200
    assert resp.data["days"] == []
