"""Camada de serviço do Diário de Gratidão (§6.2).

Funções de módulo (nunca classes de serviço); ``user`` é sempre o primeiro kwarg
keyword-only; a escrita é ``@transaction.atomic``; scoping implícito via
``TenantManager`` (nunca ``user_id`` cru, nunca ``all_objects``). O serviço recebe dados
**já validados** + ``user``, nunca o ``request``.

Divergência-chave (callout da story): **sem seed/materialização**. ``get_gratitude_day``
apenas lê as entradas da data (auto-escopadas; ``Meta.ordering`` aplica a ordem
cronológica) — não há read-model derivado de snapshot nem gap-fill.
"""

from collections import defaultdict
from datetime import date as date_cls

from django.db import transaction

from gratitude.models import GratitudeEntry


@transaction.atomic
def create_gratitude_entry(*, user, date, text) -> GratitudeEntry:
    """Cria uma entrada de gratidão na ``date`` (AC1/AC2). ``user_id`` é auto-preenchido
    pelo ``TenantModel.save()`` a partir do contexto do tenant — **nunca** passado
    explicitamente. Múltiplas entradas na mesma data são permitidas (sem constraint)."""
    return GratitudeEntry.objects.create(date=date, text=text)


def get_gratitude_day(*, user, date) -> dict:
    """Read-model da data (AC3): ``{date, entries}`` com as entradas daquela data em
    ordem cronológica ascendente (``Meta.ordering=["created_at"]``). Auto-escopado por
    tenant. **Sem seed** (divergência do modelo realizado de medicamentos)."""
    return {
        "date": date,
        "entries": list(GratitudeEntry.objects.filter(date=date)),
    }


def get_gratitude_month(*, user, month) -> dict:
    """Read-model do mês (9.2 AC1/AC2): ``{month, days:[{date, entries}]}`` com todas as
    entradas do mês agrupadas por dia, em ordem cronológica ascendente.

    Idioma de mês do ``bujo`` (``TaskDensityView``), **não** o range/cap da Saúde: filtra
    por ``date__year``/``date__month`` (o mês já é naturalmente limitado — sem paginação,
    sem cap de range). Auto-escopado por tenant (``GratitudeEntry.objects``; nunca
    ``user_id`` cru, nunca ``all_objects``). ``Meta.ordering=["created_at"]`` aplica →
    as linhas chegam globalmente por ``created_at``; o agrupamento em Python preserva essa
    ordem dentro de cada dia. Dias sem entrada não aparecem (lacunas honestas, sem gap-fill).
    Leitura pura (sem ``@transaction.atomic``, como ``get_gratitude_day``)."""
    rows = GratitudeEntry.objects.filter(date__year=month.year, date__month=month.month)
    days: dict[date_cls, list] = defaultdict(list)
    for entry in rows:
        days[entry.date].append(entry)
    return {
        "month": month,
        "days": [{"date": day, "entries": days[day]} for day in sorted(days)],
    }
