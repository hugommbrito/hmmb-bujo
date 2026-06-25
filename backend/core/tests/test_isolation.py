"""Tenant-isolation contract tests (§6.7 — mandatory: without these, AD-12 is
hope, not a standard).

Two layers:
- A generic, parametrized contract (``test_isolation_contract``) that proves
  per-tenant scoping and auto-fill for every model registered in the shared
  isolation registry. Domain apps get covered for free by registering.
- Explicit scenario tests against the ``core`` test model for the fail-closed
  read/write paths and the unscoped admin escape hatch.
"""

from contextlib import nullcontext

import pytest

from core.exceptions import TenantScopeViolation
from core.tenant import tenant_context
from core.tests.models import TenantTestModel, tenant_test_table


# --- Generic contract (parametrized over the isolation registry) ---------------
def test_isolation_contract(isolation_case, user, other_user):
    """Each registered tenant model scopes reads per-tenant and auto-fills user_id."""
    model = isolation_case["model"]
    make = isolation_case["make"]
    table = isolation_case["table"]

    table_cm = table() if table is not None else nullcontext()
    with table_cm:
        # Auto-fill on create: user_id is never passed explicitly.
        with tenant_context(user):
            created = model.objects.create(**make())
            assert created.user_id == user.id

        with tenant_context(other_user):
            model.objects.create(**make())

        # Each tenant sees only its own row.
        with tenant_context(user):
            assert model.objects.count() == 1
            assert model.objects.get().user_id == user.id

        with tenant_context(other_user):
            assert model.objects.count() == 1
            assert model.objects.get().user_id == other_user.id


# --- Explicit scenarios against the core test model ----------------------------
def test_read_without_context_fails_closed():
    """A scoped read with no tenant context raises — never returns all/empty rows."""
    with pytest.raises(TenantScopeViolation):
        # .all() evaluates get_queryset(), which raises before touching the DB.
        # The point is it RAISES rather than silently returning an empty (or full)
        # queryset.
        list(TenantTestModel.objects.all())


def test_write_without_context_fails_closed():
    """A save with no tenant context and no explicit user_id raises (fail-closed)."""
    with pytest.raises(TenantScopeViolation):
        TenantTestModel(name="orphan").save()


def test_explicit_user_id_is_preserved_on_save(user):
    """The admin/all_objects path may set user_id explicitly; save must keep it."""
    with tenant_test_table():
        instance = TenantTestModel(name="explicit", user_id=user.id)
        # No tenant context active, yet save succeeds because user_id is set.
        instance.save()
        assert TenantTestModel.all_objects.get(pk=instance.pk).user_id == user.id


def test_all_objects_returns_cross_tenant(user, other_user):
    """The unscoped admin manager returns every tenant's rows without raising."""
    with tenant_test_table():
        with tenant_context(user):
            TenantTestModel.objects.create(name="a")
        with tenant_context(other_user):
            TenantTestModel.objects.create(name="b")

        # No context set — all_objects must NOT fail closed and must see both.
        assert TenantTestModel.all_objects.count() == 2
