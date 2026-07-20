"""Testes da camada de serviço de Medicamentos (AD-07, AC1–AC6)."""

import uuid
from datetime import date, timedelta

import pytest

from core.calendar import today_for
from core.exceptions import DomainError
from core.tenant import tenant_context
from medications.models import (
    Doctor,
    Medication,
    MedicationDayEntry,
    MedicationScheduleVersion,
    MedicationSubstanceVersion,
    Source,
    TimeBlock,
)
from medications.services import (
    _validate_dose,
    add_substance_version,
    confirm_block,
    confirm_medication_entry,
    create_ad_hoc_entry,
    create_doctor,
    create_medication,
    create_time_block,
    current_schedule_version_of,
    current_substance_version_of,
    get_medication,
    get_medication_day,
    list_medications,
    list_time_blocks,
    seed_medication_day,
    set_schedule,
    update_medication,
    update_time_block,
)
from medications.tests.factories import (
    DoctorFactory,
    MedicationDayEntryFactory,
    MedicationFactory,
    MedicationScheduleVersionFactory,
    MedicationSubstanceVersionFactory,
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


# ==============================================================================
# Story 8.2 — camada realizada (seed / confirmação / read-model / avulso)
# ==============================================================================

_D1 = date(2026, 3, 1)
_D2 = date(2026, 3, 2)
_DOSE_A = [{"label": "", "amount": 1, "unit": "comp"}]
_DOSE_B = [{"label": "", "amount": 2, "unit": "comp"}]


def _schedule(user, *, med, block, dose, effective_from, active=True):
    return MedicationScheduleVersionFactory(
        user=user, medication=med, time_block=block, dose=dose,
        effective_from=effective_from, active=active,
    )


# --- seed_medication_day (AC2) -------------------------------------------------
def test_seed_creates_one_scheduled_row_per_active_block_frozen_dose(user):
    """AC2: uma linha ``scheduled`` por (med, bloco) ativo em D, dose congelada da
    versão vigente, ``confirmed_at`` null."""
    with tenant_context(user):
        med = MedicationFactory(user=user)
        manha = TimeBlockFactory(user=user, name="Manhã", display_order=0)
        noite = TimeBlockFactory(user=user, name="Noite", display_order=1)
        _schedule(user, med=med, block=manha, dose=_DOSE_A, effective_from=_D1)
        _schedule(user, med=med, block=noite, dose=_DOSE_B, effective_from=_D1)

        seed_medication_day(user=user, date=_D1)

        rows = {e.time_block_id: e for e in MedicationDayEntry.objects.filter(date=_D1)}
        assert len(rows) == 2
        assert rows[manha.id].dose_at_time == _DOSE_A
        assert rows[manha.id].confirmed_at is None
        assert rows[manha.id].source == "scheduled"
        assert rows[noite.id].dose_at_time == _DOSE_B


def test_seed_is_idempotent_and_preserves_confirmation(user):
    """AC2: 2ª abertura não recria/sobrescreve — preserva ``confirmed_at`` editado."""
    with tenant_context(user):
        med = MedicationFactory(user=user)
        block = TimeBlockFactory(user=user)
        _schedule(user, med=med, block=block, dose=_DOSE_A, effective_from=_D1)

        seed_medication_day(user=user, date=_D1)
        entry = MedicationDayEntry.objects.get(date=_D1, medication=med, time_block=block)
        confirm_medication_entry(user=user, entry_id=entry.id, confirmed=True)

        seed_medication_day(user=user, date=_D1)  # 2ª passada

        assert MedicationDayEntry.objects.filter(date=_D1, source="scheduled").count() == 1
        entry.refresh_from_db()
        assert entry.confirmed_at is not None  # preservado


def test_seed_excludes_inactive_block(user):
    """AC2: bloco desativado (``active=False``) não gera linha."""
    with tenant_context(user):
        med = MedicationFactory(user=user)
        block = TimeBlockFactory(user=user, active=False)
        _schedule(user, med=med, block=block, dose=_DOSE_A, effective_from=_D1)

        seed_medication_day(user=user, date=_D1)

        assert not MedicationDayEntry.objects.filter(date=_D1).exists()


def test_seed_excludes_inactive_schedule_version(user):
    """AC2: agenda vigente ``active=False`` em D não gera linha."""
    with tenant_context(user):
        med = MedicationFactory(user=user)
        block = TimeBlockFactory(user=user)
        _schedule(user, med=med, block=block, dose=_DOSE_A, effective_from=_D1, active=False)

        seed_medication_day(user=user, date=_D1)

        assert not MedicationDayEntry.objects.filter(date=_D1).exists()


def test_seed_immune_to_schedule_created_after_the_day(user):
    """AC2: dia passado é imune a agenda criada depois (``current_...(D) is None``)."""
    with tenant_context(user):
        med = MedicationFactory(user=user)
        block = TimeBlockFactory(user=user)
        _schedule(user, med=med, block=block, dose=_DOSE_A, effective_from=_D2)  # nasce D2

        seed_medication_day(user=user, date=_D1)  # _D1 < _D2

        assert not MedicationDayEntry.objects.filter(date=_D1).exists()


# --- seed gap-fill (AC3) -------------------------------------------------------
def test_seed_skipped_day_uses_version_effective_that_day(user):
    """AC3: dia pulado aberto depois usa a versão vigente NAQUELE dia, não a de hoje."""
    with tenant_context(user):
        med = MedicationFactory(user=user)
        block = TimeBlockFactory(user=user)
        _schedule(user, med=med, block=block, dose=_DOSE_A, effective_from=_D1)
        _schedule(user, med=med, block=block, dose=_DOSE_B, effective_from=_D2)

        seed_medication_day(user=user, date=_D1)

        entry = MedicationDayEntry.objects.get(date=_D1)
        assert entry.dose_at_time == _DOSE_A  # versão de _D1, não a de _D2


def test_materialized_day_keeps_frozen_dose_after_schedule_change(user):
    """AC3: dia já materializado mantém a dose congelada mesmo que a agenda mude depois."""
    with tenant_context(user):
        med = MedicationFactory(user=user)
        block = TimeBlockFactory(user=user)
        _schedule(user, med=med, block=block, dose=_DOSE_A, effective_from=_D1)

        seed_medication_day(user=user, date=_D1)
        # Agenda muda a partir de _D2; re-seed de _D1 NÃO reescreve.
        _schedule(user, med=med, block=block, dose=_DOSE_B, effective_from=_D2)
        seed_medication_day(user=user, date=_D1)

        entry = MedicationDayEntry.objects.get(date=_D1)
        assert entry.dose_at_time == _DOSE_A


# --- confirmação individual e em lote (AC4) ------------------------------------
def test_confirm_entry_updates_only_that_row(user):
    """AC4: confirmar uma linha seta ``confirmed_at`` só nela; desconfirmar volta a None."""
    with tenant_context(user):
        med = MedicationFactory(user=user)
        b1 = TimeBlockFactory(user=user, name="Manhã", display_order=0)
        b2 = TimeBlockFactory(user=user, name="Noite", display_order=1)
        e1 = MedicationDayEntryFactory(user=user, medication=med, time_block=b1, date=_D1)
        e2 = MedicationDayEntryFactory(user=user, medication=med, time_block=b2, date=_D1)

        confirm_medication_entry(user=user, entry_id=e1.id, confirmed=True)
        e1.refresh_from_db()
        e2.refresh_from_db()
        assert e1.confirmed_at is not None
        assert e2.confirmed_at is None  # não sangra

        confirm_medication_entry(user=user, entry_id=e1.id, confirmed=False)
        e1.refresh_from_db()
        assert e1.confirmed_at is None


def test_confirm_block_batch_affects_scheduled_only(user):
    """AC4: confirmar bloco = lote sobre todas as linhas ``scheduled`` do bloco no dia;
    ignora ``ad_hoc`` e devolve a contagem afetada."""
    with tenant_context(user):
        med1 = MedicationFactory(user=user)
        med2 = MedicationFactory(user=user)
        block = TimeBlockFactory(user=user)
        MedicationDayEntryFactory(user=user, medication=med1, time_block=block, date=_D1)
        MedicationDayEntryFactory(user=user, medication=med2, time_block=block, date=_D1)
        # Um ad_hoc no mesmo bloco/dia NÃO deve ser afetado pelo lote.
        ad_hoc = MedicationDayEntryFactory(
            user=user, medication=med1, time_block=block, date=_D1, source="ad_hoc",
        )

        affected = confirm_block(
            user=user, date=_D1, time_block_id=block.id, confirmed=True
        )
        assert affected == 2
        scheduled = MedicationDayEntry.objects.filter(date=_D1, source="scheduled")
        assert all(e.confirmed_at is not None for e in scheduled)
        ad_hoc.refresh_from_db()
        assert ad_hoc.confirmed_at is None  # ad_hoc do factory nasce sem confirmação


# --- avulso / PRN (AC7) --------------------------------------------------------
def test_create_ad_hoc_entry_always_confirmed_no_block(user):
    """AC7: avulso sem bloco, sempre confirmado, ``source=ad_hoc``, com a dose dada."""
    with tenant_context(user):
        med = MedicationFactory(user=user)
        entry = create_ad_hoc_entry(
            user=user, date=_D1, medication_id=med.id, dose=_DOSE_A
        )
        assert entry.source == "ad_hoc"
        assert entry.time_block_id is None
        assert entry.confirmed_at is not None
        assert entry.dose_at_time == _DOSE_A


def test_create_ad_hoc_inherits_dose_from_current_schedule(user):
    """AC4/AC7: com bloco e agenda vigente, a dose omitida é herdada da versão vigente."""
    with tenant_context(user):
        med = MedicationFactory(user=user)
        block = TimeBlockFactory(user=user)
        _schedule(user, med=med, block=block, dose=_DOSE_B, effective_from=_D1)

        entry = create_ad_hoc_entry(
            user=user, date=_D1, medication_id=med.id, time_block_id=block.id
        )
        assert entry.dose_at_time == _DOSE_B


def test_create_ad_hoc_without_dose_or_schedule_raises(user):
    """AC7 (Decisão 6): sem dose e sem agenda para herdar → ``DomainError``."""
    with tenant_context(user):
        med = MedicationFactory(user=user)
        with pytest.raises(DomainError):
            create_ad_hoc_entry(user=user, date=_D1, medication_id=med.id)


# --- read-model + status derivado do bloco (AC4/AC6) ---------------------------
def test_get_medication_day_groups_blocks_and_derives_status(user):
    """AC4/AC6: read-model agrupa por bloco (ordenado), deriva status e separa avulsos;
    ``substance_name`` vem da versão vigente no dia. Duas linhas ``scheduled`` no mesmo
    bloco exigem medicamentos DISTINTOS (a constraint parcial proíbe duplicar (med,
    bloco, dia))."""
    with tenant_context(user):
        med1 = MedicationFactory(user=user, title="Losartana")
        # Substância vigente em _D1 (não hoje) — para o read-model derivar o nome
        # naquele dia (create_medication criaria a versão com effective_from=hoje).
        MedicationSubstanceVersionFactory(
            user=user, medication=med1, substance_name="Losartana K", effective_from=_D1,
        )
        med2 = MedicationFactory(user=user, title="AAS")
        med3 = MedicationFactory(user=user, title="Vitamina D")
        manha = TimeBlockFactory(user=user, name="Manhã", display_order=0)
        noite = TimeBlockFactory(user=user, name="Noite", display_order=1)
        # Manhã: 2 meds (1 confirmado → partial). Noite: 1 med não confirmado → pending.
        m1 = MedicationDayEntryFactory(user=user, medication=med1, time_block=manha, date=_D1)
        MedicationDayEntryFactory(user=user, medication=med2, time_block=manha, date=_D1)
        MedicationDayEntryFactory(user=user, medication=med3, time_block=noite, date=_D1)
        MedicationDayEntryFactory(
            user=user, medication=med1, time_block=None, date=_D1, source="ad_hoc",
        )
        confirm_medication_entry(user=user, entry_id=m1.id, confirmed=True)

        day = get_medication_day(user=user, date=_D1)

        assert day["date"] == _D1
        assert [b["time_block_name"] for b in day["blocks"]] == ["Manhã", "Noite"]
        assert day["blocks"][0]["status"] == "partial"
        assert day["blocks"][1]["status"] == "pending"
        # A substância vem da versão vigente do med1 (os factory-meds não têm versão).
        substances = {e["substance_name"] for e in day["blocks"][0]["entries"]}
        assert "Losartana K" in substances
        assert len(day["ad_hoc"]) == 1
        assert day["ad_hoc"][0]["source"] == "ad_hoc"


def test_get_medication_day_block_confirmed_when_all_confirmed(user):
    """AC6: status ``confirmed`` quando todas as linhas ``scheduled`` do bloco estão
    confirmadas (via lote). Meds distintos (constraint parcial)."""
    with tenant_context(user):
        med1 = MedicationFactory(user=user)
        med2 = MedicationFactory(user=user)
        block = TimeBlockFactory(user=user)
        MedicationDayEntryFactory(user=user, medication=med1, time_block=block, date=_D1)
        MedicationDayEntryFactory(user=user, medication=med2, time_block=block, date=_D1)

        confirm_block(user=user, date=_D1, time_block_id=block.id, confirmed=True)
        day = get_medication_day(user=user, date=_D1)

        assert day["blocks"][0]["status"] == "confirmed"


def test_confirm_entry_cross_tenant_raises(user, other_user):
    with tenant_context(other_user):
        med = MedicationFactory(user=other_user)
        block = TimeBlockFactory(user=other_user)
        alheio = MedicationDayEntryFactory(
            user=other_user, medication=med, time_block=block, date=_D1,
        )
    with tenant_context(user):
        with pytest.raises(MedicationDayEntry.DoesNotExist):
            confirm_medication_entry(user=user, entry_id=alheio.id, confirmed=True)


def test_seed_read_model_status_field_is_not_a_column(user):
    """AC6: ``status`` é derivado — não existe coluna de status de bloco no schema."""
    field_names = {f.name for f in MedicationDayEntry._meta.get_fields()}
    assert "status" not in field_names
    assert Source.values == ["scheduled", "ad_hoc"]
