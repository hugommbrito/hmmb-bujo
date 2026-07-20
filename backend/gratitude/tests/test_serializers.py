"""Testes dos serializers do Diário de Gratidão (AC1, AC3 da 9.1; AC1/AC2 da 9.2)."""

from datetime import date

from gratitude.serializers import (
    GratitudeDaySerializer,
    GratitudeEntryWriteSerializer,
    GratitudeMonthSerializer,
)

_DAY = date(2026, 1, 15)
_MONTH = date(2026, 1, 1)


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


def test_month_serializer_shape():
    """9.2 AC1/AC2: read-model ``{month, days:[{date, entries}]}`` — reusa o day serializer,
    cada entrada com fields explícitos (id/date/text/created_at), sem user_id."""
    payload = {
        "month": _MONTH,
        "days": [
            {
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
        ],
    }
    data = GratitudeMonthSerializer(payload).data
    assert data["month"] == "2026-01-01"
    assert len(data["days"]) == 1
    day = data["days"][0]
    assert day["date"] == "2026-01-15"
    assert len(day["entries"]) == 1
    entry = day["entries"][0]
    assert set(entry.keys()) == {"id", "date", "text", "created_at"}
    assert "user_id" not in entry


def test_month_serializer_empty_days():
    """9.2 AC5: mês vazio serializa ``days=[]``."""
    data = GratitudeMonthSerializer({"month": _MONTH, "days": []}).data
    assert data == {"month": "2026-01-01", "days": []}
