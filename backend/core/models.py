"""Abstract base model carrying the multi-tenant contract (§6.2 / §7.1 / AD-12).

Every domain table inherits ``TenantModel`` and so gets: a UUID primary key, an
indexed ``user_id`` column, an auto-scoped default manager (``objects``) and an
unscoped escape hatch (``all_objects``, admin/operator only).

``user_id`` is a plain ``UUIDField``, NOT a ``ForeignKey`` (AD-12): isolation is
enforced in the application layer, the ``User`` model only arrives in Story 2.1,
and no FK is required. When 2.1 lands, ``user_id`` keeps its type and simply
references real ``User`` ids.
"""

import uuid

from django.db import models

from core.exceptions import TenantScopeViolation
from core.tenant import TenantManager, current_user_id


class TenantModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField(db_index=True)

    # Manager order matters: the first one declared becomes ``_default_manager``
    # / ``_base_manager``. ``objects`` (scoped) MUST be first so it stays the
    # default; ``all_objects`` is the explicit, unscoped admin/operator path.
    # The Task 7 guardrail asserts this for every concrete tenant model.
    objects = TenantManager()
    all_objects = models.Manager()  # noqa: DJ012 - deliberate: scoped `objects` must stay first (default manager)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        # Auto-fill user_id from the tenant context on create. If it was set
        # explicitly (the all_objects/admin path), preserve it.
        if self.user_id is None:
            uid = current_user_id.get()
            if uid is None:
                raise TenantScopeViolation()  # fail-closed on writes too
            self.user_id = uid
        super().save(*args, **kwargs)
