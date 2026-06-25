"""Shared tenant-isolation case registry (§7.4).

The generic isolation contract (fail-closed, per-tenant scoping, auto-fill,
admin escape hatch) is proven once, here, against every registered model —
instead of copy-pasting ``test_isolation.py`` into every domain app.

A domain app plugs in by importing its test-model module (which calls
``register_isolation_case`` at import time) and adding that module to
``_ISOLATION_TEST_MODULES`` in the root ``conftest.py``. The root
``pytest_generate_tests`` hook then parametrizes the shared contract test over
every registered case. In Story 1.2 the only case is ``core``'s test model.
"""

# Populated at import time by each app's test-model module.
TENANT_ISOLATION_CASES = []


def register_isolation_case(*, id, model, make, table=None):
    """Register one model under the shared tenant-isolation contract.

    Args:
        id: stable, human-readable case id (used as the pytest param id).
        model: a concrete ``TenantModel`` subclass.
        make: zero-arg callable returning the ``create()`` kwargs for one row
            (must NOT include ``user_id`` — auto-fill is part of the contract).
        table: optional zero-arg callable returning a context manager that
            creates the table on enter and drops it on exit. Use it for
            ``managed = False`` test models; leave ``None`` when migrations
            already provide the table (real domain models).
    """
    TENANT_ISOLATION_CASES.append(
        {"id": id, "model": model, "make": make, "table": table}
    )
