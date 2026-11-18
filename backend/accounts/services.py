"""Camada de serviço do dia "não registrado" por collection (Story 16.2c).

Regra e escrita **únicas** para os dois endpoints (``habits``/``medications``):
cada módulo chama estas funções fixando a sua ``collection`` — nenhum enum vai
para o wire. Funções de módulo; ``user`` é o primeiro kwarg keyword-only; a
escrita é ``@transaction.atomic``; scoping implícito via ``TenantManager``.

Marcar/desmarcar toca **só** ``user_untracked_days``: nenhuma linha de domínio
é apagada, re-semeada ou recalculada — o servidor passa a tratar o dia marcado
exatamente como dia sem linha (completude nula, fora de todo denominador, ponto
omitido na série), e desmarcar devolve o dia às estatísticas sem recálculo.
``today_for(user)`` é a única fonte de "hoje" (data futura é rejeitada).
"""

from datetime import date as date_cls

from django.db import transaction

from accounts.models import UntrackedDay
from core.calendar import today_for
from core.exceptions import DomainError

FUTURE_DAY_MESSAGE = "Não é possível marcar um dia futuro como não registrado."


def is_untracked(*, user, date, collection) -> bool:
    """``True`` se ``(user, date, collection)`` está marcado como não registrado.

    Auto-escopado por tenant (``TenantManager``): a flag de outro usuário é
    invisível, e a flag de outra ``collection`` não conta.
    """
    return UntrackedDay.objects.filter(date=date, collection=collection).exists()


def untracked_dates(*, user, start, end, collection) -> set[date_cls]:
    """Datas marcadas em ``[start, end]`` para ``collection`` — **uma** query.

    Para as leituras de range (histórico, série) não consultarem dia a dia.
    ``start > end`` devolve conjunto vazio (o chamador valida o range antes).
    """
    return set(
        UntrackedDay.objects.filter(
            date__range=(start, end), collection=collection
        ).values_list("date", flat=True)
    )


@transaction.atomic
def set_untracked_day(*, user, date, collection, untracked) -> None:
    """Marca (``get_or_create``) ou desmarca (``delete``) o dia — idempotente.

    ``date > today_for(user)`` levanta ``DomainError`` (a view converte em 400
    ``{"date": ...}``); hoje é permitido. Marcar duas vezes mantém uma linha;
    desmarcar sem linha não é erro. Nada além de ``user_untracked_days`` é tocado.
    """
    if date > today_for(user):
        raise DomainError(FUTURE_DAY_MESSAGE)
    if untracked:
        UntrackedDay.objects.get_or_create(date=date, collection=collection)
    else:
        UntrackedDay.objects.filter(date=date, collection=collection).delete()
