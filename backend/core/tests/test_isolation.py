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
from core.tenant import current_user_id, tenant_context
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


# --- DW-6: explicit user_id mismatch / bulk_create hardening --------------------
def test_explicit_user_id_matching_active_context_is_allowed(user):
    """An explicit user_id that matches the active context is not a mismatch —
    it must save normally, same as auto-fill would have produced."""
    with tenant_test_table():
        with tenant_context(user):
            instance = TenantTestModel(name="explicit-match", user_id=user.id)
            instance.save()

            assert TenantTestModel.objects.get(pk=instance.pk).user_id == user.id


def test_explicit_user_id_mismatch_with_active_context_fails_closed(user, other_user):
    """An explicit user_id diverging from the active context is rejected — it
    must never be silently persisted. Distinct from the admin/no-context path
    pinned by ``test_explicit_user_id_is_preserved_on_save``: here a context
    IS active, so an explicit id for a *different* tenant is a bug, not admin
    override."""
    with tenant_test_table():
        with tenant_context(user):
            with pytest.raises(TenantScopeViolation):
                TenantTestModel(name="mismatch", user_id=other_user.id).save()

        assert TenantTestModel.all_objects.count() == 0


def test_bulk_create_auto_fills_user_id_from_context(user):
    """bulk_create without an explicit user_id auto-fills every row, same as save()."""
    with tenant_test_table():
        with tenant_context(user):
            TenantTestModel.objects.bulk_create(
                [TenantTestModel(name="a"), TenantTestModel(name="b")]
            )

            assert TenantTestModel.objects.count() == 2
            assert all(row.user_id == user.id for row in TenantTestModel.objects.all())


def test_bulk_create_rejects_explicit_mismatch_before_any_insert(user, other_user):
    """One divergent item in the batch aborts the whole bulk_create — nothing
    is persisted, not even the valid items ahead of it in the list."""
    with tenant_test_table():
        with tenant_context(user):
            with pytest.raises(TenantScopeViolation):
                TenantTestModel.objects.bulk_create(
                    [
                        TenantTestModel(name="a"),
                        TenantTestModel(name="b", user_id=other_user.id),
                    ]
                )

        assert TenantTestModel.all_objects.count() == 0


def test_bulk_create_without_context_fails_closed():
    """bulk_create bypasses save() entirely (Django's QuerySet.bulk_create issues
    INSERTs directly) — without our override it would skip the fail-closed guard."""
    with tenant_test_table():
        with pytest.raises(TenantScopeViolation):
            TenantTestModel.objects.bulk_create([TenantTestModel(name="orphan")])

        assert TenantTestModel.all_objects.count() == 0


# --- DW-9: falsy-but-not-None context must fail closed too ---------------------
@pytest.mark.parametrize("falsy_uid", [0, ""])
def test_read_with_falsy_non_none_context_fails_closed(falsy_uid):
    """A falsy-but-not-None context (0, "") must fail closed, not be treated as
    "no context" (returning nothing) or accepted as a spurious real id."""
    token = current_user_id.set(falsy_uid)
    try:
        with pytest.raises(TenantScopeViolation):
            list(TenantTestModel.objects.all())
    finally:
        current_user_id.reset(token)


@pytest.mark.parametrize("falsy_uid", [0, ""])
def test_write_with_falsy_non_none_context_fails_closed(falsy_uid):
    token = current_user_id.set(falsy_uid)
    try:
        with pytest.raises(TenantScopeViolation):
            TenantTestModel(name="orphan").save()
    finally:
        current_user_id.reset(token)


@pytest.mark.parametrize("falsy_uid", [0, ""])
def test_explicit_user_id_with_falsy_non_none_context_fails_closed(falsy_uid, user):
    """Review finding (Patch 1): a falsy-but-not-None context must fail closed
    even when user_id IS explicit — not only on the auto-fill path. Previously
    neither guard branch fired for this combination (auto-fill skipped because
    user_id wasn't None; mismatch skipped because `uid` was falsy), so an
    explicit id sailed through unvalidated against a spurious context."""
    token = current_user_id.set(falsy_uid)
    try:
        with pytest.raises(TenantScopeViolation):
            TenantTestModel(name="explicit", user_id=user.id).save()
    finally:
        current_user_id.reset(token)


def test_explicit_user_id_as_string_matches_active_context(user):
    """Review finding (Patch 3): a logically-equal user_id passed as a str (not
    a uuid.UUID) must not be rejected as a mismatch — the comparison must be
    type-tolerant, since a raw `!=` against a UUID returns True for any
    non-UUID operand even when the underlying id is the same."""
    with tenant_test_table():
        with tenant_context(user):
            instance = TenantTestModel(name="stringy", user_id=str(user.id))
            instance.save()
            assert TenantTestModel.objects.get(pk=instance.pk).user_id == user.id


@pytest.mark.parametrize("falsy_uid", [0, ""])
def test_bulk_create_with_falsy_non_none_context_fails_closed(falsy_uid):
    """bulk_create shares assign_tenant_user_id with save(), so a falsy-but-not-
    None context (0, "") must fail closed here too — pinned separately since
    test_write_with_falsy_non_none_context_fails_closed only exercises save()."""
    with tenant_test_table():
        token = current_user_id.set(falsy_uid)
        try:
            with pytest.raises(TenantScopeViolation):
                TenantTestModel.objects.bulk_create([TenantTestModel(name="orphan")])
        finally:
            current_user_id.reset(token)

        assert TenantTestModel.all_objects.count() == 0


def test_save_update_with_mismatched_context_fails_closed(user, other_user):
    """Review finding (fresh review pass 3): assign_tenant_user_id() runs on
    EVERY save() call, not only inserts — every prior mismatch test constructs
    a fresh unsaved instance, leaving the UPDATE path unexercised. A row
    fetched cross-tenant (e.g. via all_objects) and saved back while a
    *different* tenant's context is active must fail closed too, exactly like
    a fresh instance with a mismatched explicit user_id would."""
    with tenant_test_table():
        with tenant_context(user):
            instance = TenantTestModel.objects.create(name="original")

        stale = TenantTestModel.all_objects.get(pk=instance.pk)
        stale.name = "mutated"
        with tenant_context(other_user):
            with pytest.raises(TenantScopeViolation):
                stale.save()

        assert TenantTestModel.all_objects.get(pk=instance.pk).name == "original"
