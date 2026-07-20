"""Testes dos serializers do Diário de Gratidão (AC1, AC3)."""

from datetime import date

from gratitude.serializers import (
    GratitudeDaySerializer,
    GratitudeEntryWriteSerializer,
)

_DAY = date(2026, 1, 15)


def test_write_serializer_accepts_text_only():
    """AC4: ``date`` é opcional (ausente → o servidor resolve para hoje)."""
    serializer = GratitudeEntryWriteSerializer(data={"text": "Grato"})
    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data["text"] == "Grato"
    assert "date" not in serializer.validated_data


def test_write_serializer_accepts_explicit_date():
    serializer = GratitudeEntryWriteSerializer(data={"text": "Grato", "date": "2026-01-15"})
    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data["date"] == _DAY


def test_write_serializer_rejects_empty_text():
    """AC1: texto vazio → inválido (400 na view)."""
    serializer = GratitudeEntryWriteSerializer(data={"text": ""})
    assert not serializer.is_valid()
    assert "text" in serializer.errors


def test_write_serializer_rejects_whitespace_only_text():
    """AC1: texto só-espaços → ``trim_whitespace`` esvazia → ``allow_blank=False`` rejeita."""
    serializer = GratitudeEntryWriteSerializer(data={"text": "   "})
    assert not serializer.is_valid()
    assert "text" in serializer.errors


def test_write_serializer_trims_surrounding_whitespace():
    serializer = GratitudeEntryWriteSerializer(data={"text": "  Grato pelo dia  "})
    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data["text"] == "Grato pelo dia"


def test_day_serializer_shape():
    """AC3: read-model ``{date, entries}`` — entries com fields explícitos, sem user_id."""
    payload = {
        "date": _DAY,
        "entries": [
            {
                "id": "00000000-0000-0000-0000-000000000001",
                "date": _DAY,
                "text": "Grato",
                "created_at": "2026-01-15T09:00:00Z",
            }
        ],
    }
    data = GratitudeDaySerializer(payload).data
    assert data["date"] == "2026-01-15"
    assert len(data["entries"]) == 1
    entry = data["entries"][0]
    assert set(entry.keys()) == {"id", "date", "text", "created_at"}
    assert "user_id" not in entry
