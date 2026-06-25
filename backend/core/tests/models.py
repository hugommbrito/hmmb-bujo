"""Concrete model used ONLY to exercise the generic ``TenantManager``.

No domain models exist until Epic 3, so we need a concrete ``TenantModel``
subclass to prove the isolation mechanics green. It is ``managed = False`` so it
never produces a migration (keeping ``makemigrations --check`` clean) — the
table is created/dropped on demand via ``schema_editor`` in a fixture (see the
``table`` callable registered below).

This module is imported only by test code (and the root ``conftest`` isolation
hook), never by Django's normal model loading, so the model stays invisible to
``makemigrations`` and to production.
"""

from contextlib import contextmanager

from django.db import connection, models

from core.models import TenantModel
from core.tests.registry import register_isolation_case


class TenantTestModel(TenantModel):
    name = models.CharField(max_length=50)

    class Meta:
        app_label = "core"
        managed = False


@contextmanager
def tenant_test_table():
    """Create the ``TenantTestModel`` table for the duration of the block."""
    with connection.schema_editor() as schema_editor:
        schema_editor.create_model(TenantTestModel)
    try:
        yield TenantTestModel
    finally:
        with connection.schema_editor() as schema_editor:
            schema_editor.delete_model(TenantTestModel)


register_isolation_case(
    id="core.TenantTestModel",
    model=TenantTestModel,
    make=lambda: {"name": "row"},
    table=tenant_test_table,
)
