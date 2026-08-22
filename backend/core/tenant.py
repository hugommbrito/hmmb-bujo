"""Multi-tenant isolation primitives (AD-12 / §6.7 / §6.10).

The whole isolation contract hangs off a single ``contextvar`` (in
``core.context``) holding the current user's id. The manager reads it on every
query and *fails closed*: with no context set it raises
``TenantScopeViolation`` instead of ever returning rows for all users.

Acyclic import chain: this module imports only ``core.exceptions`` (which
imports neither ``tenant`` nor ``models``) and ``core.context`` (which imports
nothing internal). ``core.models`` imports from here — never the reverse — so
there is no circular import.

TODO (async/ASGI): the current target is WSGI. If a view ever becomes async,
the contextvar does NOT propagate automatically across the sync/async
boundary — it must be bridged with ``sync_to_async`` / ``async_to_sync``
(§6.7). Out of scope here; this note marks where that work lands.
"""

from contextlib import contextmanager

from django.db import models

from core.context import current_user_id
from core.exceptions import TenantScopeViolation


@contextmanager
def tenant_context(user):
    """Bind ``current_user_id`` to ``user.id`` for the duration of the block.

    Mandatory outside the request cycle (management commands, workers, shell,
    seeding, tests). Inside a request, ``TenantAwareJWTAuthentication`` does
    this instead (``core/authentication.py``) — ``TenantMiddleware`` only
    guarantees the reset. The ``finally`` reset here guarantees the context
    never leaks past the block either way.
    """
    token = current_user_id.set(user.id)
    try:
        yield
    finally:
        current_user_id.reset(token)


def assign_tenant_user_id(instance):
    """Auto-fill/validate ``instance.user_id`` from the active tenant context.

    Shared by ``TenantModel.save()`` and ``TenantManager.bulk_create()`` so the
    fail-closed logic lives in exactly one place (DW-6/DW-9):

    - A falsy-but-not-``None`` context (``0``, ``""``) is always rejected,
      unconditionally — regardless of whether ``user_id`` is explicit or not.
      (A prior version only checked this on the auto-fill branch, so an
      explicit ``user_id`` sailed through unvalidated against a spurious
      context — fixed here.)
    - ``user_id is None`` (no explicit value): auto-fill from the context, or
      raise if there is no active context (fail-closed on writes).
    - ``user_id`` set explicitly and there IS an active context: it must match
      — a divergent explicit id is rejected rather than silently persisted.
      Compared via ``str(...)`` on both sides so a logically-equal id passed
      as a different type (``str`` vs ``uuid.UUID``) is not a false mismatch
      (``uuid.UUID.__eq__`` returns ``NotImplemented`` for non-UUID operands,
      so a raw ``!=`` would wrongly reject it).
    - ``user_id`` set explicitly and there is NO active context: preserved as
      is (the admin/``all_objects`` path — by design, unchanged).
    """
    uid = current_user_id.get()
    if uid is not None and not uid:
        raise TenantScopeViolation()  # a set-but-spurious context never gets a pass

    if instance.user_id is None:
        if uid is None:
            raise TenantScopeViolation()  # fail-closed on writes too
        instance.user_id = uid
    elif uid is not None and str(instance.user_id) != str(uid):
        raise TenantScopeViolation()  # explicit user_id diverges from active context


class TenantManager(models.Manager):
    """Auto-scoped default manager: every queryset is filtered to the tenant.

    Fail-closed: if no tenant context is set the manager raises *before* touching
    the DB, so a missing context can never silently return cross-tenant data.
    """

    def get_queryset(self):
        uid = current_user_id.get()
        if not uid:
            raise TenantScopeViolation()  # fail-closed → handler maps to 500 + alert
        return super().get_queryset().filter(user_id=uid)

    def bulk_create(self, objs, *args, **kwargs):
        # Validate the whole list in Python BEFORE the single super() call, so a
        # bad item raises before any INSERT runs (bulk_create bypasses save()).
        objs = list(objs)
        for obj in objs:
            assign_tenant_user_id(obj)
        return super().bulk_create(objs, *args, **kwargs)
