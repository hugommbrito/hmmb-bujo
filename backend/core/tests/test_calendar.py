"""Testes para core/calendar.py — autoridade temporal (AC1, AC2, Story 1.3)."""
import types
from datetime import UTC, date, datetime, timedelta
from unittest.mock import patch

import pytest

from core.calendar import (
    is_workday,
    months_of_week,
    today_for,
    week_start_of,
    weeks_of_month,
)


@pytest.fixture
def user_sp():
    return types.SimpleNamespace(timezone="America/Sao_Paulo")


@pytest.fixture
def user_utc():
    return types.SimpleNamespace(timezone="UTC")


# --- today_for ---

def test_today_for_retorna_data_no_fuso_correto(user_sp):
    """today_for devolve a data no fuso do usuário, não UTC."""
    # Simula 23:30 UTC = 20:30 BRT (03h de diferença no horário padrão)
    # O dia em UTC é hoje, mas em São Paulo ainda é o mesmo dia
    fixed_utc = datetime(2024, 3, 15, 23, 30, 0, tzinfo=UTC)

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
