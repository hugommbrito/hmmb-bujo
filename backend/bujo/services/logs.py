"""Materialização idempotente dos logs de planejamento (§6.2, §6.8)."""

from django.db import transaction

from bujo.models import Log, MonthlyLog, WeeklyLog


@transaction.atomic
def get_or_create_daily_log(*, user, log_date) -> Log:
    """Retorna o `Log` do tenant para `log_date`, criando-o se ainda não existir.

    `log_date` já vem resolvido pelo chamador — este serviço não decide o que é
    "hoje" (autoridade temporal fica em `core.calendar`, consumida no chamador;
    ver Story 3.2).
    """
    log, _ = Log.objects.get_or_create(log_date=log_date)
    return log


@transaction.atomic
def get_or_create_weekly_log(*, user, week_start) -> WeeklyLog:
    """Retorna o `WeeklyLog` do tenant para `week_start`, criando-o se preciso.

    `week_start` já vem normalizado (segunda) pelo chamador via
    `core.calendar.week_start_of` — este serviço não normaliza.
    """
    log, _ = WeeklyLog.objects.get_or_create(week_start=week_start)
    return log


@transaction.atomic
def get_or_create_monthly_log(*, user, month_first) -> MonthlyLog:
    """Retorna o `MonthlyLog` do tenant para `month_first`, criando-o se preciso.

    `month_first` já vem normalizado (dia 1) pelo chamador — este serviço não
    normaliza.
    """
    log, _ = MonthlyLog.objects.get_or_create(month_first=month_first)
    return log
