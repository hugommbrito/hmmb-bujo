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


def now():
    """Única fonte de 'agora' (``TIMESTAMPTZ`` timezone-aware) para timestamps de
    auditoria de escrita — ex.: ``medication_day_entries.confirmed_at`` (AD-04/AD-07).

    Distinção deliberada de ``today_for`` (que retorna uma **``date``**, a "autoridade
    temporal de negócio" do usuário): ``now()`` é um instante de auditoria, não uma
    noção de "dia atual". Mora aqui porque o guardrail de AST
    (``test_no_bare_date_today_outside_calendar``) proíbe ``timezone.now()`` em
    **todo** módulo de produção fora de ``core/calendar.py``, sem distinguir intenção
    (autoridade de "hoje" vs. timestamp de auditoria). Centralizar mantém o guardrail
    válido e dá um único ponto de mock nos testes.
    """
    return timezone.now()


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


def resolve_day_type(user, d: date) -> str:
    """Tipo do dia ``d`` para ``user`` — nova autoridade de tipo de dia (AD-10, Story 6.3).

    Retorna a **string literal** ``"holiday"`` / ``"weekend"`` / ``"weekday"``
    (``core`` não pode importar ``habits.models.DayType`` — regra de porta; ``habits``
    valida/mapeia a string). Precedência ``holiday > weekend > weekday`` **sem
    acumular** (um sábado marcado feriado → ``"holiday"``, não ``"weekend"``):

    - ``holiday``: presença de linha em ``user_holidays`` para ``(user, d)``.
    - ``weekend``: ``d.weekday() >= 5`` (sáb/dom; semana começa na segunda — AD-05).
    - ``weekday``: o resto.

    Import tardio de ``UserHoliday`` (``core → accounts`` permitido pelo import-linter;
    ``accounts`` é ``root_package``, não app de domínio): blinda contra ordem de
    carregamento, já que ``calendar`` é importado amplamente. A query é auto-escopada
    por tenant (``TenantManager`` lê ``current_user_id`` do contexto do request;
    fail-closed sem contexto).
    """
    from accounts.models import UserHoliday

    if UserHoliday.objects.filter(date=d).exists():
        return "holiday"
    if d.weekday() >= 5:
        return "weekend"
    return "weekday"


def resolve_day_types_range(user, start: date, end: date) -> dict[date, str]:
    """Tipo de dia de **cada dia de calendário** em ``[start, end]`` (batch, read-only).

    Espelha ``resolve_day_type`` — mesma precedência ``holiday > weekend > weekday``
    sem acumular e as mesmas strings literais (``core`` não importa
    ``habits.DayType``) — mas resolve o range inteiro com **uma** query em
    ``user_holidays`` (evita N chamadas a ``resolve_day_type``). Usado pela camada de
    leitura de histórico (Story 6.4) para sombrear fim de semana/feriado até em
    dias-lacuna (sem linha materializada). ``start > end`` retorna ``{}`` (o chamador
    valida o range antes). Import tardio de ``UserHoliday`` (``core → accounts``
    permitido) e query auto-escopada por tenant, como ``resolve_day_type``.
    """
    from accounts.models import UserHoliday

    holidays = set(
        UserHoliday.objects.filter(date__range=(start, end)).values_list(
            "date", flat=True
        )
    )
    out: dict[date, str] = {}
    d = start
    while d <= end:
        if d in holidays:
            out[d] = "holiday"
        elif d.weekday() >= 5:
            out[d] = "weekend"
        else:
            out[d] = "weekday"
        d += timedelta(days=1)
    return out
