"""Testes do model ``GratitudeEntry`` (AC1, AC2, AC3)."""

from datetime import UTC, date, datetime

from core.tenant import tenant_context
from gratitude.models import GratitudeEntry
from gratitude.tests.factories import GratitudeEntryFactory

_DAY = date(2026, 1, 15)


def test_create_entry_auto_fills_user_id(user):
    """AC1: ``user_id`` é auto-preenchido pelo ``TenantModel.save()`` (nunca do cliente)."""
    with tenant_context(user):
        entry = GratitudeEntry.objects.create(date=_DAY, text="Grato pelo café")
        assert entry.user_id == user.id
        assert entry.text == "Grato pelo café"
        assert entry.date == _DAY
        assert entry.created_at is not None


def test_multiple_entries_same_day_all_persist(user):
    """AC2: N entradas na mesma data — sem constraint de unicidade por dia."""
    with tenant_context(user):
        GratitudeEntryFactory(user=user, date=_DAY, text="Um")
        GratitudeEntryFactory(user=user, date=_DAY, text="Dois")
        GratitudeEntryFactory(user=user, date=_DAY, text="Três")
        assert GratitudeEntry.objects.filter(date=_DAY).count() == 3


def test_default_ordering_is_created_at_ascending(user):
    """AC3/D1: ``Meta.ordering=["created_at"]`` → ordem cronológica ascendente."""
    with tenant_context(user):
        first = GratitudeEntryFactory(user=user, date=_DAY, text="cedo")
        middle = GratitudeEntryFactory(user=user, date=_DAY, text="depois")
        last = GratitudeEntryFactory(user=user, date=_DAY, text="por fim")
        # Força created_at fora da ordem de inserção para PROVAR a ordenação por created_at.
        GratitudeEntry.objects.filter(id=first.id).update(
            created_at=datetime(2026, 1, 15, 8, 0, tzinfo=UTC)
        )
        GratitudeEntry.objects.filter(id=middle.id).update(
            created_at=datetime(2026, 1, 15, 7, 0, tzinfo=UTC)
        )
        GratitudeEntry.objects.filter(id=last.id).update(
            created_at=datetime(2026, 1, 15, 9, 0, tzinfo=UTC)
        )
        texts = list(GratitudeEntry.objects.filter(date=_DAY).values_list("text", flat=True))
    assert texts == ["depois", "cedo", "por fim"]  # 7h, 8h, 9h
