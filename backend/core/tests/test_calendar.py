"""Testes para core/calendar.py — autoridade temporal (AC1, AC2, Story 1.3)."""
import types
from datetime import UTC, date, datetime, timedelta
from unittest.mock import patch

import pytest

from core.calendar import (
    is_workday,
    months_of_week,
    now,
    resolve_day_type,
    resolve_day_types_range,
    today_for,
    week_start_of,
    weeks_of_month,
)
from core.tenant import tenant_context


@pytest.fixture
def user_sp():
    return types.SimpleNamespace(timezone="America/Sao_Paulo")


@pytest.fixture
def user_utc():
    return types.SimpleNamespace(timezone="UTC")


# --- now (timestamp de auditoria, Story 8.2) ---
def test_now_returns_timezone_aware_datetime():
    """``now()`` é a única fonte de 'agora' para timestamps de auditoria de escrita
    (ex.: ``confirmed_at``) — timezone-aware, distinta de ``today_for`` (uma ``date``)."""
    result = now()
    assert isinstance(result, datetime)
    assert result.tzinfo is not None


# --- today_for ---

def test_today_for_retorna_data_no_fuso_correto(user_sp):
    """today_for devolve a data no fuso do usuário, não UTC.

    00:30 UTC do dia 16 = 21:30 BRT do dia 15: datas UTC e BRT divergem.
    Se a função usasse UTC incorretamente retornaria 16, não 15.
    """
    fixed_utc = datetime(2024, 3, 16, 0, 30, 0, tzinfo=UTC)

    with patch("django.utils.timezone.now", return_value=fixed_utc):
        resultado = today_for(user_sp)

    assert resultado == date(2024, 3, 15)


def test_today_for_virada_de_meia_noite_utc_vs_sp(user_sp):
    """Às 01:00 UTC, São Paulo (UTC-3) ainda está no dia anterior."""
    # 01:00 UTC do dia 16 = 22:00 BRT do dia 15 (UTC-3)
    fixed_utc = datetime(2024, 3, 16, 1, 0, 0, tzinfo=UTC)

    with patch("django.utils.timezone.now", return_value=fixed_utc):
        resultado = today_for(user_sp)

    # São Paulo está 3h atrás do UTC, então ainda é dia 15
    assert resultado == date(2024, 3, 15)


def test_today_for_fuso_invalido_levanta_erro(user_sp):
    """Fuso inválido deve explodir com ZoneInfoNotFoundError — sem silenciar."""
    from zoneinfo import ZoneInfoNotFoundError

    user_invalido = types.SimpleNamespace(timezone="Mars/Olympus_Mons")
    with pytest.raises(ZoneInfoNotFoundError):
        today_for(user_invalido)


# --- week_start_of (casos-âncora AC2) ---

def test_week_start_ancora_domingo():
    """AC2-a: 01/01/2023 era domingo → semana começa em 26/12/2022 (segunda)."""
    assert week_start_of(date(2023, 1, 1)) == date(2022, 12, 26)


def test_week_start_of_segunda_e_ela_mesma():
    """Segunda-feira retorna ela mesma."""
    assert week_start_of(date(2022, 12, 26)) == date(2022, 12, 26)


def test_week_start_of_sabado():
    """Sábado → segunda da mesma semana."""
    assert week_start_of(date(2022, 12, 31)) == date(2022, 12, 26)


# --- months_of_week (casos-âncora AC2) ---

def test_months_of_week_ancora_virada():
    """AC2-b: semana 26/12/2022 pertence a dez/2022 e jan/2023."""
    assert months_of_week(date(2022, 12, 26)) == {(2022, 12), (2023, 1)}


def test_months_of_week_semana_no_meio_do_mes():
    """Semana inteiramente dentro de um mês retorna apenas um tuple."""
    resultado = months_of_week(date(2023, 1, 9))  # 09–15/jan
    assert resultado == {(2023, 1)}


# --- weeks_of_month (casos-âncora AC2) ---

def test_weeks_of_month_ancora_compartilhada():
    """AC2-c: última semana de dez/2022 é a primeira de jan/2023."""
    ultima_dez = weeks_of_month(2022, 12)[-1]
    primeira_jan = weeks_of_month(2023, 1)[0]
    assert ultima_dez == primeira_jan
    assert ultima_dez == date(2022, 12, 26)


def test_weeks_of_month_fevereiro_4_semanas():
    """Fevereiro 2021 tem exatamente 4 semanas (começa segunda, 28 dias)."""
    semanas = weeks_of_month(2021, 2)
    assert len(semanas) == 4
    assert semanas[0] == date(2021, 2, 1)
    assert semanas[-1] == date(2021, 2, 22)


def test_weeks_of_month_mes_com_6_semanas():
    """Outubro 2023 tem 6 semanas (começa no domingo, então a 1ª semana é set/25)."""
    semanas = weeks_of_month(2023, 10)
    # A semana que contém 01/10 começa em 25/09 (segunda antes do dia 1)
    assert semanas[0] == date(2023, 9, 25)
    assert len(semanas) == 6


def test_weeks_of_month_retorna_list_de_dates():
    """weeks_of_month retorna list[date]."""
    resultado = weeks_of_month(2023, 6)
    assert isinstance(resultado, list)
    assert all(isinstance(d, date) for d in resultado)
    assert len(resultado) >= 4


# --- is_workday (stub) ---

def test_is_workday_segunda_a_sexta(user_sp):
    for offset in range(5):  # seg=0 ... sex=4
        d = date(2024, 1, 1) + timedelta(days=offset)
        assert is_workday(user_sp, d) is True, f"{d} deveria ser dia útil"


def test_is_workday_sabado_domingo(user_sp):
    sabado = date(2024, 1, 6)
    domingo = date(2024, 1, 7)
    assert is_workday(user_sp, sabado) is False
    assert is_workday(user_sp, domingo) is False


# --- gaps de cobertura adicionados pelo QA (Story 1.3) ---

# G1: today_for com fuso positivo (UTC+9, Tokyo)
def test_today_for_fuso_positivo_utc_mais_9():
    """Às 23:30 UTC do dia 15, Tokyo (UTC+9) já está no dia 16."""
    user_tokyo = types.SimpleNamespace(timezone="Asia/Tokyo")
    fixed_utc = datetime(2024, 3, 15, 23, 30, 0, tzinfo=UTC)

    with patch("django.utils.timezone.now", return_value=fixed_utc):
        resultado = today_for(user_tokyo)

    assert resultado == date(2024, 3, 16)


# G2: today_for com timezone UTC direto
def test_today_for_fuso_utc(user_utc):
    """Usuário com timezone UTC recebe a data UTC sem distorção."""
    fixed_utc = datetime(2024, 3, 15, 12, 0, 0, tzinfo=UTC)

    with patch("django.utils.timezone.now", return_value=fixed_utc):
        resultado = today_for(user_utc)

    assert resultado == date(2024, 3, 15)


# G3: week_start_of para dia intermediário (quarta-feira)
def test_week_start_of_quarta():
    """Quarta-feira (weekday=2) retorna a segunda da mesma semana."""
    quarta = date(2022, 12, 28)  # quarta, mesma semana de 26/12 (segunda)
    assert week_start_of(quarta) == date(2022, 12, 26)


# G4: weeks_of_month mês com 5 semanas (caso mais comum)
def test_weeks_of_month_marco_2023_cinco_semanas():
    """Março 2023 começa na quarta → 5 semanas; 1ª week_start em 27/02."""
    semanas = weeks_of_month(2023, 3)
    assert len(semanas) == 5
    assert semanas[0] == date(2023, 2, 27)
    assert semanas[-1] == date(2023, 3, 27)


# G5: weeks_of_month mês que começa exatamente na segunda
def test_weeks_of_month_mes_comecando_na_segunda():
    """Abril 2024 começa numa segunda → 1ª week_start = 01/04 (sem recuo ao mês anterior)."""
    semanas = weeks_of_month(2024, 4)
    assert semanas[0] == date(2024, 4, 1)
    assert len(semanas) == 5


# G6: todos os resultados de weeks_of_month são segundas-feiras
def test_weeks_of_month_todos_os_itens_sao_segundas():
    """weeks_of_month deve retornar somente segundas-feiras (weekday == 0)."""
    for year, month in [(2023, 3), (2023, 10), (2024, 1), (2024, 4)]:
        for d in weeks_of_month(year, month):
            assert d.weekday() == 0, f"{d} não é segunda-feira em {year}-{month:02d}"


# G7: months_of_week semana no final do mês sem cruzar virada
def test_months_of_week_semana_fim_de_mes_sem_cruzar():
    """Semana 25/12/2023 (Seg) até 31/12/2023 (Dom) — inteiramente em dezembro."""
    resultado = months_of_week(date(2023, 12, 25))
    assert resultado == {(2023, 12)}


# --- resolve_day_type (Story 6.3, AC2) -----------------------------------------

def test_resolve_day_type_weekday(user):
    """Seg–sex sem feriado → 'weekday'."""
    with tenant_context(user):
        for offset in range(5):  # 06/01/2026 é uma terça; cobre seg–sex
            d = date(2026, 1, 5) + timedelta(days=offset)  # 05/01 = segunda
            assert resolve_day_type(user, d) == "weekday", d


def test_resolve_day_type_weekend(user):
    """Sáb/dom sem feriado → 'weekend' (semana começa na segunda, AD-05)."""
    with tenant_context(user):
        sabado = date(2026, 1, 10)  # sábado
        domingo = date(2026, 1, 11)  # domingo
        assert resolve_day_type(user, sabado) == "weekend"
        assert resolve_day_type(user, domingo) == "weekend"


def test_resolve_day_type_holiday(user):
    """Linha em user_holidays (num dia útil) → 'holiday'."""
    from accounts.models import UserHoliday

    d = date(2026, 1, 5)  # segunda (dia útil)
    with tenant_context(user):
        UserHoliday.objects.create(date=d)
        assert resolve_day_type(user, d) == "holiday"


def test_resolve_day_type_holiday_precede_weekend(user):
    """Precedência sem acumular: sábado marcado feriado → 'holiday', não 'weekend'."""
    from accounts.models import UserHoliday

    sabado = date(2026, 1, 10)  # sábado
    with tenant_context(user):
        UserHoliday.objects.create(date=sabado)
        assert resolve_day_type(user, sabado) == "holiday"


def test_resolve_day_type_holiday_is_tenant_scoped(user, other_user):
    """Feriado é por usuário: o de other_user não vira feriado para user."""
    from accounts.models import UserHoliday

    d = date(2026, 1, 5)  # segunda
    with tenant_context(other_user):
        UserHoliday.objects.create(date=d)
    with tenant_context(user):
        assert resolve_day_type(user, d) == "weekday"


# --- resolve_day_types_range (Story 6.4, AC2) ----------------------------------

def test_resolve_day_types_range_cobre_todos_os_dias(user):
    """O mapa retorna uma entrada para CADA dia de calendário no range (inclusive)."""
    start = date(2026, 1, 5)  # segunda
    end = date(2026, 1, 11)  # domingo (7 dias)
    with tenant_context(user):
        mapa = resolve_day_types_range(user, start, end)
    esperado = {start + timedelta(days=i) for i in range(7)}
    assert set(mapa.keys()) == esperado


def test_resolve_day_types_range_sabado_domingo_weekend(user):
    """Sáb/dom sem feriado → 'weekend'; seg–sex → 'weekday'."""
    start = date(2026, 1, 5)  # segunda
    end = date(2026, 1, 11)  # domingo
    with tenant_context(user):
        mapa = resolve_day_types_range(user, start, end)
    assert mapa[date(2026, 1, 5)] == "weekday"  # segunda
    assert mapa[date(2026, 1, 9)] == "weekday"  # sexta
    assert mapa[date(2026, 1, 10)] == "weekend"  # sábado
    assert mapa[date(2026, 1, 11)] == "weekend"  # domingo


def test_resolve_day_types_range_feriado_marcado_precede_weekend(user):
    """Feriado marcado (mesmo num sábado) → 'holiday' (precedência sobre weekend)."""
    from accounts.models import UserHoliday

    start = date(2026, 1, 5)  # segunda
    end = date(2026, 1, 11)  # domingo
    dia_util_feriado = date(2026, 1, 6)  # terça
    sabado_feriado = date(2026, 1, 10)  # sábado
    with tenant_context(user):
        UserHoliday.objects.create(date=dia_util_feriado)
        UserHoliday.objects.create(date=sabado_feriado)
        mapa = resolve_day_types_range(user, start, end)
    assert mapa[dia_util_feriado] == "holiday"
    assert mapa[sabado_feriado] == "holiday"  # precede weekend


def test_resolve_day_types_range_e_tenant_scoped(user, other_user):
    """Feriado de other_user não vaza para o mapa de user."""
    from accounts.models import UserHoliday

    d = date(2026, 1, 6)  # terça
    with tenant_context(other_user):
        UserHoliday.objects.create(date=d)
    with tenant_context(user):
        mapa = resolve_day_types_range(user, date(2026, 1, 5), date(2026, 1, 9))
    assert mapa[d] == "weekday"


def test_resolve_day_types_range_um_unico_dia(user):
    """Range de 1 dia (start == end) retorna exatamente esse dia."""
    d = date(2026, 1, 10)  # sábado
    with tenant_context(user):
        mapa = resolve_day_types_range(user, d, d)
    assert mapa == {d: "weekend"}
