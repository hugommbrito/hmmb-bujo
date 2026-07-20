"""Testes da camada de serviço do Diário de Gratidão (AC1, AC2, AC3, AC8 da 9.1;
AC1/AC2/AC5/AC7 da 9.2 — histórico por mês)."""

from datetime import UTC, date, datetime

from core.tenant import tenant_context
from gratitude.models import GratitudeEntry
from gratitude.services import (
    create_gratitude_entry,
    get_gratitude_day,
    get_gratitude_month,
)

_DAY = date(2026, 1, 15)
_MONTH = date(2026, 1, 1)


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


# --- 9.2: histórico por mês (get_gratitude_month) ------------------------------
def test_get_gratitude_month_groups_by_day(user):
    """9.2 AC1/AC2: 2 dias com 2 entradas cada → dias ascendentes; dentro de cada dia,
    entradas em ordem cronológica ascendente por ``created_at``."""
    day_10 = date(2026, 1, 10)
    day_20 = date(2026, 1, 20)
    with tenant_context(user):
        create_gratitude_entry(user=user, date=day_20, text="20-A")
        create_gratitude_entry(user=user, date=day_10, text="10-A")
        create_gratitude_entry(user=user, date=day_10, text="10-B")
        create_gratitude_entry(user=user, date=day_20, text="20-B")
        month = get_gratitude_month(user=user, month=_MONTH)

    assert month["month"] == _MONTH
    assert [d["date"] for d in month["days"]] == [day_10, day_20]  # dias ascendentes
    assert [e.text for e in month["days"][0]["entries"]] == ["10-A", "10-B"]
    assert [e.text for e in month["days"][1]["entries"]] == ["20-A", "20-B"]


def test_get_gratitude_month_orders_entries_within_day_chronologically(user):
    """9.2 AC2: dentro de um dia, entradas ordenadas por ``created_at`` (não por inserção)."""
    with tenant_context(user):
        e1 = create_gratitude_entry(user=user, date=_DAY, text="inserida-1")
        e2 = create_gratitude_entry(user=user, date=_DAY, text="inserida-2")
        e3 = create_gratitude_entry(user=user, date=_DAY, text="inserida-3")
        GratitudeEntry.objects.filter(id=e1.id).update(
            created_at=datetime(2026, 1, 15, 8, 0, tzinfo=UTC)
        )
        GratitudeEntry.objects.filter(id=e2.id).update(
            created_at=datetime(2026, 1, 15, 7, 0, tzinfo=UTC)
        )
        GratitudeEntry.objects.filter(id=e3.id).update(
            created_at=datetime(2026, 1, 15, 9, 0, tzinfo=UTC)
        )
        month = get_gratitude_month(user=user, month=_MONTH)

    assert len(month["days"]) == 1
    assert [e.text for e in month["days"][0]["entries"]] == [
        "inserida-2",  # 7h
        "inserida-1",  # 8h
        "inserida-3",  # 9h
    ]


def test_get_gratitude_month_empty_returns_no_days(user):
    """9.2 AC5: mês sem entradas → ``days=[]`` (lacuna honesta, sem gap-fill)."""
    with tenant_context(user):
        month = get_gratitude_month(user=user, month=_MONTH)
    assert month == {"month": _MONTH, "days": []}


def test_get_gratitude_month_excludes_other_months(user):
    """9.2 AC1: entradas de outros meses não aparecem (filtro por ano/mês)."""
    with tenant_context(user):
        create_gratitude_entry(user=user, date=date(2026, 1, 15), text="janeiro")
        create_gratitude_entry(user=user, date=date(2026, 2, 15), text="fevereiro")
        create_gratitude_entry(user=user, date=date(2025, 1, 15), text="ano anterior")
        month = get_gratitude_month(user=user, month=_MONTH)

    assert len(month["days"]) == 1
    assert [e.text for e in month["days"][0]["entries"]] == ["janeiro"]


def test_get_gratitude_month_is_tenant_scoped(user, other_user):
    """9.2 AC7: entradas de outro usuário nunca aparecem (auto-scope → mês vazio)."""
    with tenant_context(other_user):
        create_gratitude_entry(user=other_user, date=_DAY, text="Alheio")
    with tenant_context(user):
        month = get_gratitude_month(user=user, month=_MONTH)
    assert month["days"] == []
