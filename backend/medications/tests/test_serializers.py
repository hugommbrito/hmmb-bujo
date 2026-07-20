"""Testes de serializer de Medicamentos: validação de forma (§6.4)."""

from medications.serializers import (
    DoctorCreateSerializer,
    MedicationCreateSerializer,
    MedicationScheduleVersionSerializer,
    MedicationSerializer,
    ScheduleVersionCreateSerializer,
    TimeBlockCreateSerializer,
    TimeBlockUpdateSerializer,
)


# --- create medication (AC1) ---------------------------------------------------
def test_medication_create_requires_title_and_substance():
    serializer = MedicationCreateSerializer(data={})
    assert not serializer.is_valid()
    assert "title" in serializer.errors
    assert "substance_name" in serializer.errors


def test_medication_create_valid_minimal():
    serializer = MedicationCreateSerializer(
        data={"title": "Remédio", "substanceName": "Losartana"}
    )
    # Nota: o parser camelCase converteria substanceName→substance_name na borda;
    # aqui testamos o serializer com snake_case direto (pós-parse).
    serializer = MedicationCreateSerializer(
        data={"title": "Remédio", "substance_name": "Losartana"}
    )
    assert serializer.is_valid(), serializer.errors


def test_medication_create_accepts_laboratory_and_doctor():
    serializer = MedicationCreateSerializer(
        data={
            "title": "R", "substance_name": "S", "laboratory": "EMS",
            "prescribed_by_id": "a1b2c3d4-ef56-7890-abcd-000000000000",
        }
    )
    assert serializer.is_valid(), serializer.errors


# --- schedule version (AC3) ----------------------------------------------------
def test_schedule_create_requires_time_block():
    serializer = ScheduleVersionCreateSerializer(data={"dose": [{"amount": 1, "unit": "mg"}]})
    assert not serializer.is_valid()
    assert "time_block_id" in serializer.errors


def test_schedule_create_dose_must_be_list():
    serializer = ScheduleVersionCreateSerializer(
        data={
            "time_block_id": "a1b2c3d4-ef56-7890-abcd-000000000000",
            "dose": {"amount": 1, "unit": "mg"},
        }
    )
    assert not serializer.is_valid()
    assert "dose" in serializer.errors


def test_schedule_create_valid_with_dose():
    serializer = ScheduleVersionCreateSerializer(
        data={
            "time_block_id": "a1b2c3d4-ef56-7890-abcd-000000000000",
            "dose": [{"label": "", "amount": 1, "unit": "comp"}],
        }
    )
    assert serializer.is_valid(), serializer.errors


def test_schedule_create_dose_optional_for_deactivation():
    """Sem ``dose`` (só toggle ``active``) é válido — a dose é herdada no serviço."""
    serializer = ScheduleVersionCreateSerializer(
        data={"time_block_id": "a1b2c3d4-ef56-7890-abcd-000000000000", "active": False}
    )
    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data["active"] is False


# --- time block (AC2) ----------------------------------------------------------
def test_time_block_create_requires_name():
    serializer = TimeBlockCreateSerializer(data={})
    assert not serializer.is_valid()
    assert "name" in serializer.errors


def test_time_block_update_rejects_display_order_over_int_max():
    serializer = TimeBlockUpdateSerializer(data={"display_order": 2147483648})
    assert not serializer.is_valid()
    assert "display_order" in serializer.errors


def test_time_block_update_empty_is_valid():
    serializer = TimeBlockUpdateSerializer(data={})
    assert serializer.is_valid(), serializer.errors


# --- doctor (AC6) --------------------------------------------------------------
def test_doctor_create_requires_name():
    serializer = DoctorCreateSerializer(data={})
    assert not serializer.is_valid()
    assert "name" in serializer.errors


def test_doctor_create_specialty_optional():
    serializer = DoctorCreateSerializer(data={"name": "Dr. X"})
    assert serializer.is_valid(), serializer.errors


# --- read serializers ----------------------------------------------------------
def test_medication_read_serializer_exposes_expected_fields():
    serializer = MedicationSerializer()
    assert set(serializer.fields) == {"id", "title", "active", "substance", "schedules"}


def test_schedule_read_serializer_exposes_expected_fields():
    serializer = MedicationScheduleVersionSerializer()
    assert set(serializer.fields) == {
        "id", "medication", "time_block", "time_block_name",
        "dose", "active", "effective_from",
    }
