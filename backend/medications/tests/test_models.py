"""Testes de model de Medicamentos: constraints de banco, defaults e ordering (AD-07)."""

import uuid
from datetime import date

import pytest
from django.db import IntegrityError, transaction

from core.tenant import tenant_context
from medications.models import (
    Medication,
    MedicationScheduleVersion,
    MedicationSubstanceVersion,
    TimeBlock,
)
from medications.tests.factories import (
    DoctorFactory,
    MedicationFactory,
    MedicationScheduleVersionFactory,
    MedicationSubstanceVersionFactory,
    TimeBlockFactory,
)

_D = date(2026, 1, 20)


# --- Medication: slot estável, SEM coluna active (AC1/AC5) ---------------------
def test_medication_has_no_active_column(user):
    """AC1/AC5: o slot ``medications`` NÃO tem coluna ``active`` (o ativo vive nas
    versões de agenda). Garante que a modelagem não regrediu para um flag no slot."""
    field_names = {f.name for f in Medication._meta.get_fields()}
    assert "active" not in field_names


def test_medication_id_is_uuid_and_created_at_set(user):
    with tenant_context(user):
        med = MedicationFactory(user=user)
        assert isinstance(med.id, uuid.UUID)
        assert med.created_at is not None


def test_medication_ordering_by_title(user):
    with tenant_context(user):
        MedicationFactory(user=user, title="Zeta")
        MedicationFactory(user=user, title="Alfa")
        titles = [m.title for m in Medication.objects.all()]
        assert titles == ["Alfa", "Zeta"]


# --- TimeBlock: dinâmico, sem ENUM, defaults (AC2) -----------------------------
def test_time_block_defaults_active_true(user):
    with tenant_context(user):
        block = TimeBlock.objects.create(name="Manhã", display_order=0)
        assert block.active is True


def test_time_block_ordering_display_order_then_name(user):
    with tenant_context(user):
        TimeBlockFactory(user=user, name="Zeta", display_order=1)
        TimeBlockFactory(user=user, name="Beta", display_order=0)
        TimeBlockFactory(user=user, name="Alfa", display_order=0)
        names = [b.name for b in TimeBlock.objects.all()]
        assert names == ["Alfa", "Beta", "Zeta"]


# --- Substância: UniqueConstraint (medication, effective_from) (AC4) -----------
def test_substance_version_unique_per_medication_and_day(user):
    """Uma versão de substância por (medication, effective_from): a segunda inserção
    do mesmo dia viola a constraint (o serviço faz UPDATE em vez de INSERT)."""
    with tenant_context(user):
        med = MedicationFactory(user=user)
        MedicationSubstanceVersion.objects.create(
            medication=med, substance_name="A", effective_from=_D
        )
        with pytest.raises(IntegrityError), transaction.atomic():
            MedicationSubstanceVersion.objects.create(
                medication=med, substance_name="B", effective_from=_D
            )


def test_substance_versions_different_days_ok(user):
    with tenant_context(user):
        med = MedicationFactory(user=user)
        MedicationSubstanceVersion.objects.create(
            medication=med, substance_name="A", effective_from=date(2026, 1, 1)
        )
        MedicationSubstanceVersion.objects.create(
            medication=med, substance_name="B", effective_from=date(2026, 2, 1)
        )
        assert med.substance_versions.count() == 2


# --- Agenda: UniqueConstraint (medication, time_block, effective_from) (AC4) ----
def test_schedule_version_unique_per_med_block_and_day(user):
    with tenant_context(user):
        med = MedicationFactory(user=user)
        block = TimeBlockFactory(user=user)
        MedicationScheduleVersion.objects.create(
            medication=med, time_block=block,
            dose=[{"label": "", "amount": 1, "unit": "comp"}], effective_from=_D,
        )
        with pytest.raises(IntegrityError), transaction.atomic():
            MedicationScheduleVersion.objects.create(
                medication=med, time_block=block,
                dose=[{"label": "", "amount": 2, "unit": "comp"}], effective_from=_D,
            )


def test_schedule_same_day_different_blocks_ok(user):
    """Doses diferentes em blocos diferentes coexistem no mesmo dia (AC3)."""
    with tenant_context(user):
        med = MedicationFactory(user=user)
        b1 = TimeBlockFactory(user=user, name="Manhã", display_order=0)
        b2 = TimeBlockFactory(user=user, name="Noite", display_order=1)
        MedicationScheduleVersion.objects.create(
            medication=med, time_block=b1,
            dose=[{"label": "", "amount": 1, "unit": "comp"}], effective_from=_D,
        )
        MedicationScheduleVersion.objects.create(
            medication=med, time_block=b2,
            dose=[{"label": "", "amount": 2, "unit": "comp"}], effective_from=_D,
        )
        assert med.schedule_versions.count() == 2


def test_schedule_dose_default_is_empty_list(user):
    with tenant_context(user):
        med = MedicationFactory(user=user)
        block = TimeBlockFactory(user=user)
        version = MedicationScheduleVersion.objects.create(
            medication=med, time_block=block, effective_from=_D
        )
        assert version.dose == []
        assert version.active is True


# --- prescribed_by PROTECT preserva histórico (AC6) ----------------------------
def test_doctor_delete_is_protected_when_referenced(user):
    """``prescribed_by`` é ``on_delete=PROTECT``: deletar um médico referenciado por
    uma versão de substância é bloqueado (preserva o histórico da versão)."""
    from django.db.models import ProtectedError

    with tenant_context(user):
        doctor = DoctorFactory(user=user)
        MedicationSubstanceVersionFactory(user=user, prescribed_by=doctor)
        with pytest.raises(ProtectedError):
            doctor.delete()


def test_time_block_delete_is_protected_when_referenced(user):
    """``time_block`` da agenda é ``on_delete=PROTECT``: deletar um bloco referenciado
    é bloqueado (desativar é o caminho — AC2)."""
    from django.db.models import ProtectedError

    with tenant_context(user):
        block = TimeBlockFactory(user=user)
        MedicationScheduleVersionFactory(user=user, time_block=block)
        with pytest.raises(ProtectedError):
            block.delete()


def test_all_models_ids_are_uuid(user):
    with tenant_context(user):
        doctor = DoctorFactory(user=user)
        block = TimeBlockFactory(user=user)
        subst = MedicationSubstanceVersionFactory(user=user)
        sched = MedicationScheduleVersionFactory(user=user)
        for obj in (doctor, block, subst, sched):
            assert isinstance(obj.id, uuid.UUID)
