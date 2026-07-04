"""Materialização idempotente do Daily Log (§6.2, §6.8)."""

from django.db import transaction

from bujo.models import Log


@transaction.atomic
def get_or_create_daily_log(*, user, log_date) -> Log:
    """Retorna o `Log` do tenant para `log_date`, criando-o se ainda não existir.

    `log_date` já vem resolvido pelo chamador — este serviço não decide o que é
    "hoje" (autoridade temporal fica em `core.calendar`, consumida no chamador;
    ver Story 3.2).
    """
    log, _ = Log.objects.get_or_create(log_date=log_date)
    return log
