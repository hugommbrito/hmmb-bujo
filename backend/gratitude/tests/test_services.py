"""Testes da camada de serviço do Diário de Gratidão (AC1, AC2, AC3, AC8)."""

from datetime import UTC, date, datetime

from core.tenant import tenant_context
from gratitude.models import GratitudeEntry
from gratitude.services import create_gratitude_entry, get_gratitude_day

_DAY = date(2026, 1, 15)


def test_create_gratitude_entry_persists_and_auto_fills_user(user):
    """AC1: cria a entrada e ``user_id`` é auto-preenchido (nunca passado ao serviço)."""
    with tenant_context(user):
        entry = create_gratitude_entry(user=user, date=_DAY, text="Grato pela família")
        assert entry.pk is not None
        assert entry.user_id == user.id
        assert entry.text == "Grato pela família"
        assert entry.date == _DAY


def test_create_multiple_entries_same_day(user):
    """AC2: múltiplas entradas na mesma data persistem."""
    with tenant_context(user):
        create_gratitude_entry(user=user, date=_DAY, text="Um")
        create_gratitude_entry(user=user, date=_DAY, text="Dois")
        day = get_gratitude_day(user=user, date=_DAY)
    assert [e.text for e in day["entries"]] == ["Um", "Dois"]


def test_get_gratitude_day_empty(user):
    """AC6/AC3: dia sem entradas → read-model com lista vazia."""
    with tenant_context(user):
        day = get_gratitude_day(user=user, date=_DAY)
    assert day == {"date": _DAY, "entries": []}


def test_get_gratitude_day_orders_chronologically(user):
    """AC3: entradas retornadas em ordem cronológica ascendente por ``created_at``."""
    with tenant_context(user):
        e1 = create_gratitude_entry(user=user, date=_DAY, text="primeiro-inserido")
        e2 = create_gratitude_entry(user=user, date=_DAY, text="segundo-inserido")
        e3 = create_gratitude_entry(user=user, date=_DAY, text="terceiro-inserido")
        GratitudeEntry.objects.filter(id=e1.id).update(
            created_at=datetime(2026, 1, 15, 8, 0, tzinfo=UTC)
        )
        GratitudeEntry.objects.filter(id=e2.id).update(
            created_at=datetime(2026, 1, 15, 7, 0, tzinfo=UTC)
        )
        GratitudeEntry.objects.filter(id=e3.id).update(
            created_at=datetime(2026, 1, 15, 9, 0, tzinfo=UTC)
        )
        day = get_gratitude_day(user=user, date=_DAY)
    assert [e.text for e in day["entries"]] == [
        "segundo-inserido",  # 7h
        "primeiro-inserido",  # 8h
        "terceiro-inserido",  # 9h
    ]


def test_get_gratitude_day_is_tenant_scoped(user, other_user):
    """AC8: entradas de outro usuário nunca são lidas (auto-scope → lista vazia)."""
    with tenant_context(other_user):
        create_gratitude_entry(user=other_user, date=_DAY, text="Alheio")
    with tenant_context(user):
        day = get_gratitude_day(user=user, date=_DAY)
    assert day["entries"] == []


def test_get_gratitude_day_filters_by_date(user):
    """AC3: só as entradas daquela data (dias diferentes não vazam)."""
    other_day = date(2026, 1, 16)
    with tenant_context(user):
        create_gratitude_entry(user=user, date=_DAY, text="do dia 15")
        create_gratitude_entry(user=user, date=other_day, text="do dia 16")
        day = get_gratitude_day(user=user, date=_DAY)
    assert [e.text for e in day["entries"]] == ["do dia 15"]
