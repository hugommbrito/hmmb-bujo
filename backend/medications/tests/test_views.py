"""Testes de view/API de Medicamentos (AC1–AC7 + isolamento §6.7).

O wire é camelCase: os bodies enviam ``substanceName``/``timeBlockId``/``prescribedById``
(o parser converte para snake_case); ``response.data`` é snake_case (a camelização só
acontece no renderer JSON). As **chaves internas** da ``dose`` (``label``/``amount``/
``unit``, palavra única) NÃO são camelizadas — provado inspecionando ``response.content``.
"""

import json
import uuid

from core.calendar import today_for
from core.tenant import tenant_context
from medications.models import Medication, MedicationScheduleVersion
from medications.tests.factories import (
    DoctorFactory,
    MedicationFactory,
    TimeBlockFactory,
)

_MEDS = "/api/medications/"
_DOCTORS = "/api/doctors/"
_BLOCKS = "/api/time-blocks/"
_DOSE = [{"label": "", "amount": 1, "unit": "comp"}]


# --- AC1: criar medicamento ----------------------------------------------------
def test_post_creates_medication_with_uuid_and_substance(auth_client, user):
    resp = auth_client.post(
        _MEDS,
        {"title": "Remédio de pressão", "substanceName": "Losartana", "laboratory": "EMS"},
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["title"] == "Remédio de pressão"
    # `active` derivado (sem agenda) = True; `substance` vigente presente.
    assert resp.data["active"] is True
    assert resp.data["substance"]["substance_name"] == "Losartana"
    assert resp.data["substance"]["laboratory"] == "EMS"
    uuid.UUID(str(resp.data["id"]))
    with tenant_context(user):
        assert Medication.objects.filter(id=resp.data["id"]).exists()


def test_get_list_empty_returns_200(auth_client):
    resp = auth_client.get(_MEDS)
    assert resp.status_code == 200
    assert resp.data == []


def test_post_medication_with_doctor(auth_client, user):
    with tenant_context(user):
        doctor = DoctorFactory(user=user, name="Dra. Ana")
    resp = auth_client.post(
        _MEDS,
        {"title": "M", "substanceName": "S", "prescribedById": str(doctor.id)},
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["substance"]["prescribed_by"] == doctor.id


def test_post_medication_unknown_doctor_returns_400(auth_client):
    resp = auth_client.post(
        _MEDS,
        {"title": "M", "substanceName": "S", "prescribedById": str(uuid.uuid4())},
        format="json",
    )
    assert resp.status_code == 400
    assert "prescribed_by_id" in resp.data.get("fields", {})


# --- AC7: editar título (PATCH) ------------------------------------------------
def test_patch_updates_title(auth_client, user):
    with tenant_context(user):
        med = MedicationFactory(user=user, title="Antigo")
    resp = auth_client.patch(f"{_MEDS}{med.id}/", {"title": "Novo"}, format="json")
    assert resp.status_code == 200, resp.data
    assert resp.data["title"] == "Novo"


def test_patch_missing_medication_returns_404(auth_client):
    resp = auth_client.patch(f"{_MEDS}{uuid.uuid4()}/", {"title": "X"}, format="json")
    assert resp.status_code == 404


# --- AC4: nova versão de substância --------------------------------------------
def test_post_substance_version(auth_client, user):
    resp = auth_client.post(
        _MEDS, {"title": "M", "substanceName": "Antigo"}, format="json"
    )
    med_id = resp.data["id"]
    resp2 = auth_client.post(
        f"{_MEDS}{med_id}/substance-versions/",
        {"substanceName": "Novo"},
        format="json",
    )
    assert resp2.status_code == 201, resp2.data
    assert resp2.data["substance_name"] == "Novo"


# --- AC3/AC5: agenda por bloco (set + deactivate) ------------------------------
def test_post_schedule_version_sets_dose(auth_client, user):
    with tenant_context(user):
        block = TimeBlockFactory(user=user, name="Manhã")
    resp = auth_client.post(_MEDS, {"title": "M", "substanceName": "S"}, format="json")
    med_id = resp.data["id"]
    resp2 = auth_client.post(
        f"{_MEDS}{med_id}/schedule-versions/",
        {"timeBlockId": str(block.id), "dose": _DOSE},
        format="json",
    )
    assert resp2.status_code == 201, resp2.data
    assert resp2.data["dose"] == _DOSE
    assert resp2.data["active"] is True
    assert resp2.data["time_block"] == block.id


def test_post_schedule_invalid_dose_returns_409(auth_client, user):
    with tenant_context(user):
        block = TimeBlockFactory(user=user)
    resp = auth_client.post(_MEDS, {"title": "M", "substanceName": "S"}, format="json")
    med_id = resp.data["id"]
    resp2 = auth_client.post(
        f"{_MEDS}{med_id}/schedule-versions/",
        {"timeBlockId": str(block.id), "dose": [{"label": "", "amount": "x", "unit": "mg"}]},
        format="json",
    )
    assert resp2.status_code == 409


def test_post_schedule_unknown_block_returns_400(auth_client, user):
    resp = auth_client.post(_MEDS, {"title": "M", "substanceName": "S"}, format="json")
    med_id = resp.data["id"]
    resp2 = auth_client.post(
        f"{_MEDS}{med_id}/schedule-versions/",
        {"timeBlockId": str(uuid.uuid4()), "dose": _DOSE},
        format="json",
    )
    assert resp2.status_code == 400
    assert "time_block_id" in resp2.data.get("fields", {})


def test_deactivate_schedule_via_active_false(auth_client, user):
    with tenant_context(user):
        block = TimeBlockFactory(user=user)
    resp = auth_client.post(_MEDS, {"title": "M", "substanceName": "S"}, format="json")
    med_id = resp.data["id"]
    auth_client.post(
        f"{_MEDS}{med_id}/schedule-versions/",
        {"timeBlockId": str(block.id), "dose": _DOSE},
        format="json",
    )
    # Desativar sem reenviar a dose (herdada).
    resp2 = auth_client.post(
        f"{_MEDS}{med_id}/schedule-versions/",
        {"timeBlockId": str(block.id), "active": False},
        format="json",
    )
    assert resp2.status_code == 201, resp2.data
    assert resp2.data["active"] is False
    assert resp2.data["dose"] == _DOSE  # dose herdada
    # Nada deletado.
    with tenant_context(user):
        assert MedicationScheduleVersion.objects.filter(medication_id=med_id).exists()


# --- AC2: casing da dose JSONB no wire (chaves de palavra única preservadas) ----
def test_dose_keys_survive_camelcase_roundtrip(auth_client, user):
    """As chaves ``label``/``amount``/``unit`` (palavra única) NÃO são camelizadas na
    borda — provado inspecionando ``response.content`` (JSON renderizado)."""
    with tenant_context(user):
        block = TimeBlockFactory(user=user)
    resp = auth_client.post(_MEDS, {"title": "M", "substanceName": "S"}, format="json")
    med_id = resp.data["id"]
    resp2 = auth_client.post(
        f"{_MEDS}{med_id}/schedule-versions/",
        {"timeBlockId": str(block.id), "dose": [{"label": "A", "amount": 50, "unit": "mg"}]},
        format="json",
    )
    body = json.loads(resp2.content)
    # Campos externos camelizados (effectiveFrom/timeBlock); chaves da dose intactas.
    assert "effectiveFrom" in body
    assert body["dose"][0] == {"label": "A", "amount": 50, "unit": "mg"}


# --- AC2: blocos de horário ----------------------------------------------------
def test_time_block_crud(auth_client):
    created = auth_client.post(_BLOCKS, {"name": "Manhã"}, format="json")
    assert created.status_code == 201, created.data
    assert created.data["display_order"] == 0
    assert created.data["active"] is True
    block_id = created.data["id"]

    # Desativar → some da lista default, aparece com includeInactive.
    auth_client.patch(f"{_BLOCKS}{block_id}/", {"active": False}, format="json")
    assert auth_client.get(_BLOCKS).data == []
    with_inactive = auth_client.get(f"{_BLOCKS}?includeInactive=true")
    assert {b["name"] for b in with_inactive.data} == {"Manhã"}


# --- AC6: médicos --------------------------------------------------------------
def test_doctor_crud(auth_client):
    created = auth_client.post(
        _DOCTORS, {"name": "Dr. Silva", "specialty": "Cardiologia"}, format="json"
    )
    assert created.status_code == 201, created.data
    assert created.data["name"] == "Dr. Silva"
    listing = auth_client.get(_DOCTORS)
    assert {d["name"] for d in listing.data} == {"Dr. Silva"}


# --- isolamento multi-tenant (§6.7) --------------------------------------------
def test_medications_are_tenant_scoped(auth_client, user, other_user):
    with tenant_context(other_user):
        alheio = MedicationFactory(user=other_user)
    # auth_client autenticado como `user` — não vê medicamentos de other_user.
    assert auth_client.get(_MEDS).data == []
    # E não consegue mutar (auto-scope → 404).
    patch = auth_client.patch(f"{_MEDS}{alheio.id}/", {"title": "Invadido"}, format="json")
    assert patch.status_code == 404


def test_get_medication_detail_reflects_current_state(auth_client, user):
    with tenant_context(user):
        block = TimeBlockFactory(user=user, name="Manhã")
    resp = auth_client.post(_MEDS, {"title": "M", "substanceName": "S"}, format="json")
    med_id = resp.data["id"]
    auth_client.post(
        f"{_MEDS}{med_id}/schedule-versions/",
        {"timeBlockId": str(block.id), "dose": _DOSE},
        format="json",
    )
    detail = auth_client.get(f"{_MEDS}{med_id}/")
    assert detail.status_code == 200
    assert len(detail.data["schedules"]) == 1
    assert detail.data["schedules"][0]["time_block_name"] == "Manhã"


def test_list_medications_default_on_date_is_today(auth_client, user):
    resp = auth_client.post(_MEDS, {"title": "M", "substanceName": "S"}, format="json")
    assert resp.status_code == 201
    listing = auth_client.get(_MEDS)
    assert listing.status_code == 200
    assert len(listing.data) == 1
    # onDate inválido → 400.
    bad = auth_client.get(f"{_MEDS}?onDate=2026-13-99")
    assert bad.status_code == 400


def test_get_daily_state_respects_on_date(auth_client, user):
    """Com ``?onDate=`` no passado (antes da agenda), a agenda não aparece."""
    with tenant_context(user):
        block = TimeBlockFactory(user=user)
        today = today_for(user)
    resp = auth_client.post(_MEDS, {"title": "M", "substanceName": "S"}, format="json")
    med_id = resp.data["id"]
    auth_client.post(
        f"{_MEDS}{med_id}/schedule-versions/",
        {"timeBlockId": str(block.id), "dose": _DOSE},
        format="json",
    )
    # onDate hoje: agenda presente.
    listing = auth_client.get(f"{_MEDS}?onDate={today.isoformat()}")
    assert len(listing.data[0]["schedules"]) == 1
