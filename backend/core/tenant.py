"""Multi-tenant isolation primitives (AD-12 / §6.7 / §6.10).

The whole isolation contract hangs off a single ``contextvar`` holding the
current user's id. The manager reads it on every query and *fails closed*: with
no context set it raises ``TenantScopeViolation`` instead of ever returning rows
for all users.

Acyclic import chain: this module imports only ``core.exceptions`` (which
imports neither ``tenant`` nor ``models``). ``core.models`` imports from here —
never the reverse — so there is no circular import.
"""

import contextvars
from contextlib import contextmanager

from django.db import models

from core.exceptions import TenantScopeViolation

# Normative name (§6.10) — copied verbatim; the contextvar name is part of the
# contract. Default None means "no tenant set" → fail-closed everywhere.
#
# TODO (async/ASGI): the current target is WSGI. If a view ever becomes async,
# this contextvar does NOT propagate automatically across the sync/async
# boundary — it must be bridged with ``sync_to_async`` / ``async_to_sync``
# (§6.7). Out of scope here; this anchor marks where that work lands.
current_user_id = contextvars.ContextVar("current_user_id", default=None)


@contextmanager
def tenant_context(user):
    """Bind ``current_user_id`` to ``user.id`` for the duration of the block.

    Mandatory outside the request cycle (management commands, workers, shell,
    seeding, tests). Inside a request, ``TenantMiddleware`` does this instead.
    The ``finally`` reset guarantees the context never leaks past the block.
    """
    token = current_user_id.set(user.id)
    try:
        yield
    finally:
        current_user_id.reset(token)


class TenantManager(models.Manager):
    """Auto-scoped default manager: every queryset is filtered to the tenant.

    Fail-closed: if no tenant context is set the manager raises *before* touching
    the DB, so a missing context can never silently return cross-tenant data.
    """

    def get_queryset(self):
        uid = current_user_id.get()
        if uid is None:
            raise TenantScopeViolation()  # fail-closed → handler maps to 500 + alert
        return super().get_queryset().filter(user_id=uid)
