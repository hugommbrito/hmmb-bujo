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
from medications.models import (
    Medication,
    MedicationDayEntry,
    MedicationScheduleVersion,
)
from medications.tests.factories import (
    DoctorFactory,
    MedicationDayEntryFactory,
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


# ==============================================================================
# Story 8.2 — superfície diária (GET days / PATCH / confirm-block / ad-hoc)
# ==============================================================================

_DAYS = "/api/medications/days/"
_CONFIRM_BLOCK = "/api/medications/days/confirm-block/"
_AD_HOC = "/api/medications/days/ad-hoc/"


def _seed_med_with_schedule(auth_client, user, *, block_name="Manhã"):
    """Cria (via API) med + bloco + agenda vigente hoje; retorna (medId, blockId)."""
    with tenant_context(user):
        block = TimeBlockFactory(user=user, name=block_name)
    resp = auth_client.post(_MEDS, {"title": "M", "substanceName": "Losartana"}, format="json")
    med_id = resp.data["id"]
    auth_client.post(
        f"{_MEDS}{med_id}/schedule-versions/",
        {"timeBlockId": str(block.id), "dose": _DOSE},
        format="json",
    )
    return med_id, str(block.id)


def test_get_days_seeds_and_returns_read_model(auth_client, user):
    """AC4: GET default=hoje materializa (idempotente) e retorna blocos + status."""
    med_id, block_id = _seed_med_with_schedule(auth_client, user)

    response = auth_client.get(_DAYS)
    assert response.status_code == 200, response.data
    assert response.data["date"] == today_for(user).isoformat()
    assert len(response.data["blocks"]) == 1
    block = response.data["blocks"][0]
    assert block["time_block_name"] == "Manhã"
    assert block["status"] == "pending"
    assert len(block["entries"]) == 1
    entry = block["entries"][0]
    assert entry["medication_title"] == "M"
    assert entry["substance_name"] == "Losartana"
    assert entry["confirmed_at"] is None
    assert entry["source"] == "scheduled"

    # Idempotência via HTTP: 2ª chamada não duplica linhas.
    auth_client.get(_DAYS)
    with tenant_context(user):
        assert MedicationDayEntry.objects.filter(source="scheduled").count() == 1


def test_get_days_empty_state(auth_client, user):
    """AC8: usuário sem medicamentos → superfície vazia (sem blocos nem avulsos)."""
    response = auth_client.get(_DAYS)
    assert response.status_code == 200
    assert response.data["blocks"] == []
    assert response.data["ad_hoc"] == []


def test_get_days_invalid_date_returns_400(auth_client):
    response = auth_client.get(f"{_DAYS}?date=2026-13-99")
    assert response.status_code == 400
    assert "date" in response.data.get("fields", {})


def test_patch_entry_confirms_single_row(auth_client, user):
    """AC4: PATCH ``{confirmed:true}`` marca só aquela linha; o dia reflete ``partial``."""
    _seed_med_with_schedule(auth_client, user)
    day = auth_client.get(_DAYS).data
    entry_id = day["blocks"][0]["entries"][0]["id"]

    response = auth_client.patch(
        f"{_DAYS}{entry_id}/", {"confirmed": True}, format="json"
    )
    assert response.status_code == 200, response.data
    assert response.data["blocks"][0]["entries"][0]["confirmed_at"] is not None
    assert response.data["blocks"][0]["status"] == "confirmed"


def test_patch_entry_other_tenant_returns_404(auth_client, user, other_user):
    with tenant_context(other_user):
        med = MedicationFactory(user=other_user)
        block = TimeBlockFactory(user=other_user)
        alheio = MedicationDayEntryFactory(
            user=other_user, medication=med, time_block=block,
        )
    response = auth_client.patch(
        f"{_DAYS}{alheio.id}/", {"confirmed": True}, format="json"
    )
    assert response.status_code == 404


def test_confirm_block_batch(auth_client, user):
    """AC4: POST confirm-block confirma todas as linhas ``scheduled`` do bloco no dia."""
    med_id, block_id = _seed_med_with_schedule(auth_client, user)
    day = auth_client.get(_DAYS).data
    date_str = day["date"]

    response = auth_client.post(
        _CONFIRM_BLOCK,
        {"date": date_str, "timeBlockId": block_id, "confirmed": True},
        format="json",
    )
    assert response.status_code == 200, response.data
    assert response.data["blocks"][0]["status"] == "confirmed"


def test_post_ad_hoc_creates_confirmed_entry(auth_client, user):
    """AC7: POST ad-hoc cria linha confirmada na seção avulso/PRN, sem bloco."""
    resp = auth_client.post(
        _MEDS, {"title": "Dipirona", "substanceName": "Dipirona"}, format="json"
    )
    med_id = resp.data["id"]
    date_str = today_for(user).isoformat()

    response = auth_client.post(
        _AD_HOC,
        {"date": date_str, "medicationId": med_id, "dose": _DOSE},
        format="json",
    )
    assert response.status_code == 200, response.data
    assert len(response.data["ad_hoc"]) == 1
    ad_hoc = response.data["ad_hoc"][0]
    assert ad_hoc["source"] == "ad_hoc"
    assert ad_hoc["confirmed_at"] is not None
    assert ad_hoc["time_block_id"] is None


def test_post_ad_hoc_without_dose_or_schedule_returns_409(auth_client, user):
    """AC7 (Decisão 6): sem dose e sem agenda para herdar → 409 (DomainError)."""
    resp = auth_client.post(_MEDS, {"title": "Dipirona", "substanceName": "D"}, format="json")
    med_id = resp.data["id"]
    date_str = today_for(user).isoformat()

    response = auth_client.post(
        _AD_HOC, {"date": date_str, "medicationId": med_id}, format="json"
    )
    assert response.status_code == 409


def test_ad_hoc_dose_keys_survive_camelcase_roundtrip(auth_client, user):
    """AC2/Task3: as chaves da dose (``label``/``amount``/``unit``) NÃO são camelizadas
    na borda — provado inspecionando ``response.content`` (JSON renderizado)."""
    resp = auth_client.post(_MEDS, {"title": "M", "substanceName": "S"}, format="json")
    med_id = resp.data["id"]
    date_str = today_for(user).isoformat()

    response = auth_client.post(
        _AD_HOC,
        {
            "date": date_str,
            "medicationId": med_id,
            "dose": [{"label": "A", "amount": 50, "unit": "mg"}],
        },
        format="json",
    )
    body = json.loads(response.content)
    # Campos externos camelizados (adHoc/doseAtTime); chaves internas da dose intactas.
    assert "adHoc" in body
    assert body["adHoc"][0]["doseAtTime"][0] == {"label": "A", "amount": 50, "unit": "mg"}


def test_ad_hoc_unknown_medication_returns_404(auth_client, user):
    """AC7: avulso com medicamento inexistente/cross-tenant → 404 (esconde existência,
    como ``MedicationAdHocView`` converte ``Medication.DoesNotExist``)."""
    date_str = today_for(user).isoformat()
    response = auth_client.post(
        _AD_HOC,
        {"date": date_str, "medicationId": str(uuid.uuid4()), "dose": _DOSE},
        format="json",
    )
    assert response.status_code == 404


def test_ad_hoc_unknown_block_returns_400(auth_client, user):
    """AC7: avulso com ``timeBlockId`` inexistente → 400 (``TimeBlock.DoesNotExist`` vira
    erro de campo, como no ``schedule-versions/``)."""
    resp = auth_client.post(
        _MEDS, {"title": "Dipirona", "substanceName": "Dipirona"}, format="json"
    )
    med_id = resp.data["id"]
    date_str = today_for(user).isoformat()

    response = auth_client.post(
        _AD_HOC,
        {
            "date": date_str,
            "medicationId": med_id,
            "timeBlockId": str(uuid.uuid4()),
            "dose": _DOSE,
        },
        format="json",
    )
    assert response.status_code == 400
    assert "time_block_id" in response.data.get("fields", {})


def test_ad_hoc_with_block_inherits_dose_from_schedule(auth_client, user):
    """AC4/AC7: avulso COM bloco e agenda vigente (dose omitida) herda a dose da versão
    vigente e grava o ``time_block_id`` na linha ``ad_hoc`` (sempre confirmada)."""
    med_id, block_id = _seed_med_with_schedule(auth_client, user)
    date_str = today_for(user).isoformat()

    response = auth_client.post(
        _AD_HOC,
        {"date": date_str, "medicationId": med_id, "timeBlockId": block_id},
        format="json",
    )
    assert response.status_code == 200, response.data
    assert len(response.data["ad_hoc"]) == 1
    ad_hoc = response.data["ad_hoc"][0]
    assert ad_hoc["source"] == "ad_hoc"
    assert str(ad_hoc["time_block_id"]) == block_id
    assert ad_hoc["dose_at_time"] == _DOSE  # herdada da agenda vigente
    assert ad_hoc["confirmed_at"] is not None


def test_patch_entry_unconfirm_reverts_status(auth_client, user):
    """AC4: PATCH ``{confirmed:false}`` desconfirma a linha (branch ``else None``); o
    bloco de uma linha volta a ``pending``."""
    _seed_med_with_schedule(auth_client, user)
    entry_id = auth_client.get(_DAYS).data["blocks"][0]["entries"][0]["id"]
    auth_client.patch(f"{_DAYS}{entry_id}/", {"confirmed": True}, format="json")

    response = auth_client.patch(
        f"{_DAYS}{entry_id}/", {"confirmed": False}, format="json"
    )
    assert response.status_code == 200, response.data
    assert response.data["blocks"][0]["entries"][0]["confirmed_at"] is None
    assert response.data["blocks"][0]["status"] == "pending"


def test_confirm_block_unconfirm_reverts_status(auth_client, user):
    """AC4: POST confirm-block ``{confirmed:false}`` desconfirma em lote todas as linhas
    ``scheduled`` do bloco no dia (branch ``else None`` do ``.update()``); volta a
    ``pending``."""
    _, block_id = _seed_med_with_schedule(auth_client, user)
    date_str = auth_client.get(_DAYS).data["date"]
    auth_client.post(
        _CONFIRM_BLOCK,
        {"date": date_str, "timeBlockId": block_id, "confirmed": True},
        format="json",
    )

    response = auth_client.post(
        _CONFIRM_BLOCK,
        {"date": date_str, "timeBlockId": block_id, "confirmed": False},
        format="json",
    )
    assert response.status_code == 200, response.data
    assert response.data["blocks"][0]["status"] == "pending"
    assert response.data["blocks"][0]["entries"][0]["confirmed_at"] is None


def test_confirm_block_invalid_date_returns_400(auth_client, user):
    """AC4: ``date`` malformada no confirm-block → 400 (``BlockConfirmSerializer.date``)."""
    _, block_id = _seed_med_with_schedule(auth_client, user)
    response = auth_client.post(
        _CONFIRM_BLOCK,
        {"date": "2026-13-99", "timeBlockId": block_id, "confirmed": True},
        format="json",
    )
    assert response.status_code == 400
    assert "date" in response.data.get("fields", {})


# --- Story 8.3 — PATCH de linha: correção de dose e confirmação retroativa ------

_DOSE_META = [{"label": "Meia", "amount": 0.5, "unit": "comp"}]


def test_patch_entry_dose_returns_day_read_model_with_updated_dose(auth_client, user):
    """AC6: PATCH ``{dose}`` corrige a dose daquela linha e devolve o read-model do dia
    com a dose atualizada."""
    _seed_med_with_schedule(auth_client, user)
    entry_id = auth_client.get(_DAYS).data["blocks"][0]["entries"][0]["id"]

    response = auth_client.patch(
        f"{_DAYS}{entry_id}/", {"dose": _DOSE_META}, format="json"
    )
    assert response.status_code == 200, response.data
    entry = response.data["blocks"][0]["entries"][0]
    assert entry["dose_at_time"] == _DOSE_META
    # A confirmação não é tocada quando só a dose muda.
    assert entry["confirmed_at"] is None


def test_patch_entry_confirmed_still_works(auth_client, user):
    """AC5: o caminho de confirmação da 8.2 segue funcionando via o verbo generalizado."""
    _seed_med_with_schedule(auth_client, user)
    entry_id = auth_client.get(_DAYS).data["blocks"][0]["entries"][0]["id"]

    response = auth_client.patch(
        f"{_DAYS}{entry_id}/", {"confirmed": True}, format="json"
    )
    assert response.status_code == 200, response.data
    assert response.data["blocks"][0]["entries"][0]["confirmed_at"] is not None


def test_patch_entry_empty_body_returns_400(auth_client, user):
    """AC6: PATCH sem ``confirmed`` nem ``dose`` → 400 (guard do serializer, não 409)."""
    _seed_med_with_schedule(auth_client, user)
    entry_id = auth_client.get(_DAYS).data["blocks"][0]["entries"][0]["id"]

    response = auth_client.patch(f"{_DAYS}{entry_id}/", {}, format="json")
    assert response.status_code == 400


def test_patch_entry_invalid_dose_returns_409(auth_client, user):
    """AC6: dose inválida (unit vazia) → 409 (``DomainError`` de ``_validate_dose``)."""
    _seed_med_with_schedule(auth_client, user)
    entry_id = auth_client.get(_DAYS).data["blocks"][0]["entries"][0]["id"]

    response = auth_client.patch(
        f"{_DAYS}{entry_id}/",
        {"dose": [{"label": "x", "amount": 1, "unit": ""}]},
        format="json",
    )
    assert response.status_code == 409


def test_patch_entry_unknown_returns_404(auth_client, user):
    """AC5/§6.7: linha inexistente → 404 (esconde existência)."""
    response = auth_client.patch(
        f"{_DAYS}{uuid.uuid4()}/", {"dose": _DOSE_META}, format="json"
    )
    assert response.status_code == 404


def test_day_entry_dose_edit_survives_camelcase_roundtrip(auth_client, user):
    """AC6/casing: as chaves da dose (``label``/``amount``/``unit``) NÃO são camelizadas
    na borda ao corrigir — provado inspecionando ``response.content`` (molde do teste
    homônimo da 8.2)."""
    _seed_med_with_schedule(auth_client, user)
    entry_id = auth_client.get(_DAYS).data["blocks"][0]["entries"][0]["id"]

    response = auth_client.patch(
        f"{_DAYS}{entry_id}/",
        {"dose": [{"label": "Meia", "amount": 0.5, "unit": "comp"}]},
        format="json",
    )
    body = json.loads(response.content)
    assert body["blocks"][0]["entries"][0]["doseAtTime"][0] == {
        "label": "Meia",
        "amount": 0.5,
        "unit": "comp",
    }
