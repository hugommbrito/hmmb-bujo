"""Testes do serviço do dia "não registrado" por collection (Story 16.2c).

Regra única dos dois endpoints: idempotência, rejeição de data futura, uma
query por range e escopo por ``(usuário, data, collection)``. Datas fixas +
``timedelta`` relativas a ``today_for`` (guardrail proíbe ``date.today()``).
"""

from datetime import timedelta

import pytest

from accounts.models import UntrackedCollection, UntrackedDay
from accounts.services import (
    FUTURE_DAY_MESSAGE,
    is_untracked,
    set_untracked_day,
    untracked_dates,
)
from accounts.tests.factories import UntrackedDayFactory
from core.calendar import today_for
from core.exceptions import DomainError
from core.tenant import tenant_context

_HABITS = UntrackedCollection.HABITS
_MEDS = UntrackedCollection.MEDICATIONS


def test_mark_past_day_creates_one_row(user):
    with tenant_context(user):
        day = today_for(user) - timedelta(days=3)
        set_untracked_day(user=user, date=day, collection=_HABITS, untracked=True)
        assert UntrackedDay.objects.filter(date=day, collection=_HABITS).count() == 1
        assert is_untracked(user=user, date=day, collection=_HABITS) is True


def test_mark_is_idempotent_and_unmark_without_row_is_not_an_error(user):
    with tenant_context(user):
        day = today_for(user) - timedelta(days=1)
        set_untracked_day(user=user, date=day, collection=_HABITS, untracked=True)
        set_untracked_day(user=user, date=day, collection=_HABITS, untracked=True)
        assert UntrackedDay.objects.filter(date=day).count() == 1

        set_untracked_day(user=user, date=day, collection=_HABITS, untracked=False)
        set_untracked_day(user=user, date=day, collection=_HABITS, untracked=False)
        assert UntrackedDay.objects.filter(date=day).count() == 0
        assert is_untracked(user=user, date=day, collection=_HABITS) is False


def test_today_is_allowed(user):
    with tenant_context(user):
        today = today_for(user)
        set_untracked_day(user=user, date=today, collection=_HABITS, untracked=True)
        assert is_untracked(user=user, date=today, collection=_HABITS) is True


def test_future_day_raises_domain_error_without_writing(user):
    with tenant_context(user):
        tomorrow = today_for(user) + timedelta(days=1)
        with pytest.raises(DomainError, match=FUTURE_DAY_MESSAGE):
            set_untracked_day(user=user, date=tomorrow, collection=_HABITS, untracked=True)
        # Desmarcar um dia futuro também é rejeitado (a regra é da data, não do verbo).
        with pytest.raises(DomainError):
            set_untracked_day(user=user, date=tomorrow, collection=_HABITS, untracked=False)
        assert UntrackedDay.objects.count() == 0


def test_flag_is_per_collection(user):
    """A flag de `habits` em D não marca `medications` em D (e vice-versa)."""
    with tenant_context(user):
        day = today_for(user) - timedelta(days=2)
        set_untracked_day(user=user, date=day, collection=_HABITS, untracked=True)
        assert is_untracked(user=user, date=day, collection=_HABITS) is True
        assert is_untracked(user=user, date=day, collection=_MEDS) is False

        set_untracked_day(user=user, date=day, collection=_MEDS, untracked=True)
        assert UntrackedDay.objects.filter(date=day).count() == 2

        # Desmarcar uma collection não toca a outra.
        set_untracked_day(user=user, date=day, collection=_HABITS, untracked=False)
        assert is_untracked(user=user, date=day, collection=_HABITS) is False
        assert is_untracked(user=user, date=day, collection=_MEDS) is True


def test_flag_of_other_tenant_is_invisible(user, other_user):
    day = today_for(user) - timedelta(days=1)
    with tenant_context(other_user):
        UntrackedDayFactory(user=other_user, date=day, collection=_HABITS)
    with tenant_context(user):
        assert is_untracked(user=user, date=day, collection=_HABITS) is False
        assert untracked_dates(
            user=user, start=day, end=day, collection=_HABITS
        ) == set()


def test_untracked_dates_returns_only_the_range_and_collection(user):
    with tenant_context(user):
        today = today_for(user)
        inside_a = today - timedelta(days=5)
        inside_b = today - timedelta(days=2)
        outside = today - timedelta(days=20)
        UntrackedDayFactory(user=user, date=inside_a, collection=_HABITS)
        UntrackedDayFactory(user=user, date=inside_b, collection=_HABITS)
        UntrackedDayFactory(user=user, date=outside, collection=_HABITS)
        UntrackedDayFactory(user=user, date=inside_a, collection=_MEDS)

        got = untracked_dates(
            user=user, start=today - timedelta(days=10), end=today, collection=_HABITS
        )
        assert got == {inside_a, inside_b}
        assert untracked_dates(
            user=user, start=today - timedelta(days=10), end=today, collection=_MEDS
        ) == {inside_a}


def test_untracked_dates_is_one_query(user, django_assert_num_queries):
    with tenant_context(user):
        today = today_for(user)
        UntrackedDayFactory(user=user, date=today - timedelta(days=1), collection=_HABITS)
        with django_assert_num_queries(1):
            untracked_dates(
                user=user, start=today - timedelta(days=30), end=today, collection=_HABITS
            )
