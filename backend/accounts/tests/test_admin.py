"""Admin de operador de ``accounts`` (AD-12): o escape hatch ``all_objects``.

Molde de ``automation/tests/test_admin.py`` — exercita ``get_queryset`` direto
(mais barato que o fluxo HTTP completo do admin), FORA de qualquer
``tenant_context``: é exatamente o caminho em que ``objects`` falharia fechado.
"""

from datetime import date

from django.contrib.admin.sites import AdminSite
from django.test import RequestFactory

from accounts.admin import UntrackedDayAdmin, UserHolidayAdmin
from accounts.models import UntrackedCollection, UntrackedDay, UserHoliday
from accounts.tests.factories import UntrackedDayFactory, UserHolidayFactory
from core.tenant import tenant_context


def test_untracked_day_admin_sees_every_tenant_without_context(user, other_user):
    """Story 16.2c: ``UntrackedDayAdmin.get_queryset`` usa ``all_objects`` —
    linhas de dois tenants visíveis sem ``tenant_context`` ativo."""
    with tenant_context(user):
        UntrackedDayFactory(user=user, date=date(2026, 1, 5), collection=UntrackedCollection.HABITS)
    with tenant_context(other_user):
        UntrackedDayFactory(
            user=other_user, date=date(2026, 1, 5), collection=UntrackedCollection.MEDICATIONS
        )

    admin_instance = UntrackedDayAdmin(UntrackedDay, AdminSite())
    queryset = admin_instance.get_queryset(RequestFactory().get("/"))

    assert {row.user_id for row in queryset} == {user.id, other_user.id}
    assert {row.collection for row in queryset} == {"habits", "medications"}


def test_user_holiday_admin_sees_every_tenant_without_context(user, other_user):
    """Mesmo contrato do precedente que a 16.2c espelha (``UserHolidayAdmin``)."""
    with tenant_context(user):
        UserHolidayFactory(user=user, date=date(2026, 1, 5))
    with tenant_context(other_user):
        UserHolidayFactory(user=other_user, date=date(2026, 1, 5))

    admin_instance = UserHolidayAdmin(UserHoliday, AdminSite())
    queryset = admin_instance.get_queryset(RequestFactory().get("/"))

    assert {row.user_id for row in queryset} == {user.id, other_user.id}
