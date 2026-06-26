"""Autoridade temporal do projeto (AD-04, AD-05, §6.8, §6.9).

Única fonte de "hoje" e das fronteiras de calendário (semana/mês).
Nenhum outro módulo de produção deve chamar date.today() / timezone.now()
diretamente — o guardrail em test_guardrails.py faz cumprir essa regra.
"""
import calendar as _calendar  # alias explícito para não confundir com este módulo
from datetime import date, timedelta
from zoneinfo import ZoneInfo

from django.utils import timezone


def today_for(user) -> date:
    """Única fonte de 'hoje'. user deve ter .timezone (string IANA).

    Fuso inválido levanta ZoneInfoNotFoundError — sem silenciar.
    """
    return timezone.now().astimezone(ZoneInfo(user.timezone)).date()


def week_start_of(d: date) -> date:
    """Segunda-feira da semana de d (chave do Weekly Log).

    weekday() retorna 0=seg … 6=dom; subtrair garante segunda como dia 1.
    """
    return d - timedelta(days=d.weekday())


def weeks_of_month(year: int, month: int) -> list[date]:
    """Lista de week_starts do mês.

    1ª semana = a que contém o dia 1; última = a que contém o último dia
    (pode pertencer ao mês seguinte — semana compartilhada).
    """
    first = date(year, month, 1)
    last = date(year, month, _calendar.monthrange(year, month)[1])
    cur, out = week_start_of(first), []
    while cur <= last:
        out.append(cur)
        cur += timedelta(days=7)
    return out


def months_of_week(week_start: date) -> set[tuple[int, int]]:
    """(year, month) tuples a que a semana pertence.

    Retorna 1 elemento para semanas dentro de um mês, 2 para semanas de virada.
    """
    end = week_start + timedelta(days=6)
    return {(week_start.year, week_start.month), (end.year, end.month)}


def is_workday(user, d: date) -> bool:
    """True se d é um dia útil para user. Stub: apenas verifica fim de semana.

    # TODO (Story 2.1+): integrar user_holidays de accounts.models.UserHoliday
    """
    return d.weekday() < 5  # 0=seg … 4=sex; 5=sab, 6=dom
