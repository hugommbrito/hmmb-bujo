"""Testes da camada de serviço de Medicamentos (AD-07, AC1–AC6)."""

import uuid
from datetime import timedelta

import pytest

from core.calendar import today_for
from core.exceptions import DomainError
from core.tenant import tenant_context
from medications.models import (
    Doctor,
    Medication,
    MedicationScheduleVersion,
    MedicationSubstanceVersion,
    TimeBlock,
)
from medications.services import (
    _validate_dose,
    add_substance_version,
    create_doctor,
    create_medication,
    create_time_block,
    current_schedule_version_of,
    current_substance_version_of,
    get_medication,
    list_medications,
    list_time_blocks,
    set_schedule,
    update_medication,
    update_time_block,
)
from medications.tests.factories import (
    DoctorFactory,
    MedicationFactory,
    TimeBlockFactory,
)

_DOSE = [{"label": "", "amount": 1, "unit": "comprimido"}]


# ===============================================================================
# AC1 — criar medicamento: slot + versão de substância vigente
# ===============================================================================
def test_create_medication_creates_slot_and_first_substance_version(user):
    with tenant_context(user):
        today = today_for(user)
        med = create_medication(
            user=user, title="Remédio de pressão", substance_name="Losartana",
            laboratory="EMS",
        )
        assert isinstance(med.id, uuid.UUID)
        assert med.title == "Remédio de pressão"
        # Primeira versão de substância criada na mesma transação, effective_from=hoje.
        version = current_substance_version_of(med, today)
        assert version is not None
        assert version.substance_name == "Losartana"
        assert version.laboratory == "EMS"
        assert version.effective_from == today
        # O med é anotado com o estado vigente.
        assert med.current_substance.substance_name == "Losartana"


def test_create_medication_scoped_to_tenant(user, other_user):
    with tenant_context(user):
        create_medication(user=user, title="Meu", substance_name="X")
    with tenant_context(other_user):
        assert list(Medication.objects.all()) == []


def test_create_medication_with_doctor(user):
    with tenant_context(user):
        doctor = DoctorFactory(user=user, name="Dra. Ana")
        med = create_medication(
            user=user, title="Anti-inflamatório", substance_name="Ibuprofeno",
            prescribed_by_id=doctor.id,
        )
        version = current_substance_version_of(med, today_for(user))
        assert version.prescribed_by_id == doctor.id


def test_create_medication_unknown_doctor_raises(user):
    with tenant_context(user), pytest.raises(Doctor.DoesNotExist):
        create_medication(
            user=user, title="X", substance_name="Y", prescribed_by_id=uuid.uuid4()
        )


def test_create_medication_cross_tenant_doctor_raises(user, other_user):
    with tenant_context(other_user):
        alheio = DoctorFactory(user=other_user)
    with tenant_context(user), pytest.raises(Doctor.DoesNotExist):
        create_medication(
            user=user, title="X", substance_name="Y", prescribed_by_id=alheio.id
        )


# ===============================================================================
# AC2 — blocos dinâmicos: append display_order, desativar/reativar
# ===============================================================================
def test_create_time_block_appends_display_order(user):
    with tenant_context(user):
        first = create_time_block(user=user, name="Manhã")
        second = create_time_block(user=user, name="Noite")
        assert first.display_order == 0
        assert second.display_order == 1


def test_create_time_block_respects_explicit_order(user):
    with tenant_context(user):
        block = create_time_block(user=user, name="Almoço", display_order=5)
        assert block.display_order == 5


def test_deactivate_time_block_hides_from_default_list_but_preserves(user):
    with tenant_context(user):
        block = create_time_block(user=user, name="Madrugada")
        update_time_block(user=user, time_block_id=block.id, active=False)
        block.refresh_from_db()
        assert block.active is False
        # Some da lista ativa, mas o registro persiste (nunca deletado).
        assert block.id not in [b.id for b in list_time_blocks(user=user)]
        assert TimeBlock.objects.filter(id=block.id).exists() is True
        assert block.id in [
            b.id for b in list_time_blocks(user=user, include_inactive=True)
        ]


def test_reactivate_time_block(user):
    with tenant_context(user):
        block = TimeBlockFactory(user=user, active=False)
        update_time_block(user=user, time_block_id=block.id, active=True)
        block.refresh_from_db()
        assert block.active is True


# ===============================================================================
# AC3 — dose JSONB validada no serviço
# ===============================================================================
def test_validate_dose_accepts_valid_multi_component():
    _validate_dose([
        {"label": "Componente A", "amount": 50, "unit": "mg"},
        {"label": "Componente B", "amount": 12.5, "unit": "mg"},
    ])


def test_validate_dose_rejects_empty_list():
    with pytest.raises(DomainError):
        _validate_dose([])


def test_validate_dose_rejects_non_list():
    with pytest.raises(DomainError):
        _validate_dose({"amount": 1, "unit": "mg"})


def test_validate_dose_rejects_non_numeric_amount():
    with pytest.raises(DomainError):
        _validate_dose([{"label": "", "amount": "muito", "unit": "mg"}])


def test_validate_dose_rejects_bool_amount():
    """``bool`` é subclasse de ``int`` em Python — rejeitado explicitamente."""
    with pytest.raises(DomainError):
        _validate_dose([{"label": "", "amount": True, "unit": "mg"}])


def test_validate_dose_rejects_empty_unit():
    with pytest.raises(DomainError):
        _validate_dose([{"label": "", "amount": 1, "unit": "  "}])


def test_validate_dose_allows_empty_label():
    """Decisão 1: ``label`` pode ser vazio (droga única identificada por substância)."""
    _validate_dose([{"label": "", "amount": 1, "unit": "comp"}])


def test_set_schedule_persists_valid_dose(user):
    with tenant_context(user):
        med = create_medication(user=user, title="M", substance_name="S")
        block = create_time_block(user=user, name="Manhã")
        version = set_schedule(
            user=user, medication_id=med.id, time_block_id=block.id, dose=_DOSE
        )
        assert version.dose == _DOSE
        assert version.active is True
        assert version.effective_from == today_for(user)


def test_set_schedule_invalid_dose_writes_nothing(user):
    with tenant_context(user):
        med = create_medication(user=user, title="M", substance_name="S")
        block = create_time_block(user=user, name="Manhã")
        with pytest.raises(DomainError):
            set_schedule(
                user=user, medication_id=med.id, time_block_id=block.id,
                dose=[{"label": "", "amount": "x", "unit": "mg"}],
            )
        assert MedicationScheduleVersion.objects.filter(medication=med).count() == 0


def test_set_schedule_first_time_requires_dose(user):
    with tenant_context(user):
        med = create_medication(user=user, title="M", substance_name="S")
        block = create_time_block(user=user, name="Manhã")
        with pytest.raises(DomainError):
            set_schedule(user=user, medication_id=med.id, time_block_id=block.id)


# ===============================================================================
# AC4 — dois eixos independentes, prospectivos; mesmo dia = UPDATE; herança
# ===============================================================================
def test_new_dose_same_day_is_update_not_new_row(user):
    """Segunda mudança de agenda no mesmo dia = UPDATE da versão do dia (UniqueConstraint)."""
    with tenant_context(user):
        med = create_medication(user=user, title="M", substance_name="S")
        block = create_time_block(user=user, name="Manhã")
        set_schedule(
            user=user, medication_id=med.id, time_block_id=block.id,
            dose=[{"label": "", "amount": 1, "unit": "comp"}],
        )
        set_schedule(
            user=user, medication_id=med.id, time_block_id=block.id,
            dose=[{"label": "", "amount": 2, "unit": "comp"}],
        )
        versions = MedicationScheduleVersion.objects.filter(
            medication=med, time_block=block
        )
        assert versions.count() == 1
        assert versions.first().dose == [{"label": "", "amount": 2, "unit": "comp"}]


def test_substance_axis_independent_from_schedule_axis(user):
    """Trocar só a substância insere nova substance version; a agenda não muda."""
    with tenant_context(user):
        med = create_medication(user=user, title="M", substance_name="Antigo")
        block = create_time_block(user=user, name="Manhã")
        set_schedule(user=user, medication_id=med.id, time_block_id=block.id, dose=_DOSE)
        add_substance_version(
            user=user, medication_id=med.id, substance_name="Novo"
        )
        # Eixo substância: 2 versões (mesmo dia → UPDATE, então precisamos de dias
        # diferentes; aqui é o MESMO dia, então também é UPDATE — 1 versão atualizada).
        assert med.substance_versions.count() == 1
        assert current_substance_version_of(med, today_for(user)).substance_name == "Novo"
        # Eixo agenda intacto (1 versão, dose original).
        assert MedicationScheduleVersion.objects.filter(medication=med).count() == 1


def test_add_substance_version_same_day_is_update(user):
    with tenant_context(user):
        med = create_medication(user=user, title="M", substance_name="A", laboratory="Lab1")
        add_substance_version(user=user, medication_id=med.id, substance_name="B")
        # Mesmo dia (create + add) → UPDATE da versão do dia, não nova linha.
        assert med.substance_versions.count() == 1


def test_add_substance_version_inherits_unspecified_fields(user):
    """Campos não informados são herdados da versão vigente (AC4)."""
    with tenant_context(user):
        doctor = DoctorFactory(user=user)
        med = create_medication(
            user=user, title="M", substance_name="Losartana",
            laboratory="EMS", prescribed_by_id=doctor.id,
        )
        # Trocar SÓ o laboratório: substância e médico são herdados.
        add_substance_version(user=user, medication_id=med.id, laboratory="Medley")
        version = current_substance_version_of(med, today_for(user))
        assert version.substance_name == "Losartana"  # herdado
        assert version.laboratory == "Medley"  # alterado
        assert version.prescribed_by_id == doctor.id  # herdado


def test_add_substance_version_prospective_new_day(user):
    """Versões em dias diferentes coexistem; a vigente é a de maior effective_from<=D."""
    with tenant_context(user):
        med = MedicationFactory(user=user)
        today = today_for(user)
        yesterday = today - timedelta(days=1)
        MedicationSubstanceVersion.objects.create(
            medication=med, substance_name="Antigo", effective_from=yesterday
        )
        add_substance_version(user=user, medication_id=med.id, substance_name="Novo")
        assert med.substance_versions.count() == 2
        assert current_substance_version_of(med, yesterday).substance_name == "Antigo"
        assert current_substance_version_of(med, today).substance_name == "Novo"


# ===============================================================================
# AC5 — desativação vive nas versões; histórico preservado; nada retroage
# ===============================================================================
def test_deactivate_schedule_writes_new_version_active_false(user):
    with tenant_context(user):
        med = create_medication(user=user, title="M", substance_name="S")
        block = create_time_block(user=user, name="Manhã")
        set_schedule(user=user, medication_id=med.id, time_block_id=block.id, dose=_DOSE)
        # Desativar = set_schedule(active=False) — nova versão prospectiva; dose herdada.
        version = set_schedule(
            user=user, medication_id=med.id, time_block_id=block.id, active=False
        )
        assert version.active is False
        assert version.dose == _DOSE  # dose herdada (não precisou reenviar)
        # Nada deletado: a versão existe no banco.
        assert MedicationScheduleVersion.objects.filter(medication=med).exists()


def test_past_schedule_version_stays_frozen_after_deactivation(user):
    """Desativar hoje não retroage: a versão de ontem permanece ativa em ontem."""
    with tenant_context(user):
        med = MedicationFactory(user=user)
        block = TimeBlockFactory(user=user)
        today = today_for(user)
        yesterday = today - timedelta(days=1)
        MedicationScheduleVersion.objects.create(
            medication=med, time_block=block, dose=_DOSE, active=True,
            effective_from=yesterday,
        )
        set_schedule(
            user=user, medication_id=med.id, time_block_id=block.id, active=False
        )
        # Ontem: ainda ativa (congelado). Hoje: inativa.
        assert current_schedule_version_of(med, block, yesterday).active is True
        assert current_schedule_version_of(med, block, today).active is False


def test_reactivate_schedule(user):
    with tenant_context(user):
        med = create_medication(user=user, title="M", substance_name="S")
        block = create_time_block(user=user, name="Manhã")
        set_schedule(user=user, medication_id=med.id, time_block_id=block.id, dose=_DOSE)
        set_schedule(user=user, medication_id=med.id, time_block_id=block.id, active=False)
        version = set_schedule(
            user=user, medication_id=med.id, time_block_id=block.id, active=True
        )
        assert version.active is True


# ===============================================================================
# AC6 — médicos como catálogo referenciável
# ===============================================================================
def test_create_doctor(user):
    with tenant_context(user):
        doctor = create_doctor(user=user, name="Dr. Silva", specialty="Cardiologia")
        assert doctor.name == "Dr. Silva"
        assert doctor.specialty == "Cardiologia"


def test_doctor_reused_across_medications(user):
    with tenant_context(user):
        doctor = create_doctor(user=user, name="Dra. Ana")
        med1 = create_medication(
            user=user, title="M1", substance_name="A", prescribed_by_id=doctor.id
        )
        med2 = create_medication(
            user=user, title="M2", substance_name="B", prescribed_by_id=doctor.id
        )
        v1 = current_substance_version_of(med1, today_for(user))
        v2 = current_substance_version_of(med2, today_for(user))
        assert v1.prescribed_by_id == doctor.id
        assert v2.prescribed_by_id == doctor.id


# ===============================================================================
# list_medications / get_medication — read-model anotado + derived active
# ===============================================================================
def test_list_medications_annotates_current_state(user):
    with tenant_context(user):
        med = create_medication(user=user, title="M", substance_name="S")
        block = create_time_block(user=user, name="Manhã")
        set_schedule(user=user, medication_id=med.id, time_block_id=block.id, dose=_DOSE)
        result = list_medications(user=user)
        assert len(result) == 1
        item = result[0]
        assert item.current_substance.substance_name == "S"
        assert len(item.current_schedules) == 1
        assert item.current_schedules[0].dose == _DOSE
        assert item.derived_active is True


def test_derived_active_false_when_all_schedules_inactive(user):
    with tenant_context(user):
        med = create_medication(user=user, title="M", substance_name="S")
        block = create_time_block(user=user, name="Manhã")
        set_schedule(user=user, medication_id=med.id, time_block_id=block.id, dose=_DOSE)
        set_schedule(user=user, medication_id=med.id, time_block_id=block.id, active=False)
        item = get_medication(user=user, medication_id=med.id)
        assert item.derived_active is False


def test_derived_active_true_when_no_schedules(user):
    """Um medicamento recém-criado (sem agenda) é considerado ativo (nada desativado)."""
    with tenant_context(user):
        med = create_medication(user=user, title="M", substance_name="S")
        item = get_medication(user=user, medication_id=med.id)
        assert item.derived_active is True
        assert item.current_schedules == []


def test_list_medications_hides_schedule_of_inactive_block(user):
    """Bloco desativado esconde sua agenda da lista (AC2); a versão é preservada."""
    with tenant_context(user):
        med = create_medication(user=user, title="M", substance_name="S")
        block = create_time_block(user=user, name="Manhã")
        set_schedule(user=user, medication_id=med.id, time_block_id=block.id, dose=_DOSE)
        update_time_block(user=user, time_block_id=block.id, active=False)
        item = get_medication(user=user, medication_id=med.id)
        assert item.current_schedules == []
        # A versão de agenda ainda existe no banco (preservada).
        assert MedicationScheduleVersion.objects.filter(medication=med).exists()


def test_update_medication_title(user):
    with tenant_context(user):
        med = create_medication(user=user, title="Antigo", substance_name="S")
        updated = update_medication(user=user, medication_id=med.id, title="Novo")
        assert updated.title == "Novo"
        med.refresh_from_db()
        assert med.title == "Novo"


# --- isolamento cross-tenant (via service) -------------------------------------
def test_get_medication_cross_tenant_raises(user, other_user):
    with tenant_context(other_user):
        alheio = MedicationFactory(user=other_user)
    with tenant_context(user), pytest.raises(Medication.DoesNotExist):
        get_medication(user=user, medication_id=alheio.id)


def test_set_schedule_cross_tenant_medication_raises(user, other_user):
    with tenant_context(other_user):
        alheio = MedicationFactory(user=other_user)
    with tenant_context(user):
        block = create_time_block(user=user, name="Manhã")
        with pytest.raises(Medication.DoesNotExist):
            set_schedule(
                user=user, medication_id=alheio.id, time_block_id=block.id, dose=_DOSE
            )


def test_set_schedule_cross_tenant_block_raises(user, other_user):
    with tenant_context(other_user):
        alheio_block = TimeBlockFactory(user=other_user)
    with tenant_context(user):
        med = create_medication(user=user, title="M", substance_name="S")
        with pytest.raises(TimeBlock.DoesNotExist):
            set_schedule(
                user=user, medication_id=med.id, time_block_id=alheio_block.id, dose=_DOSE
            )
