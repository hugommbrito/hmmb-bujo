"""Root pytest configuration for the backend.

Enables database access by default for every test via an autouse fixture, so
individual tests don't need to repeat ``@pytest.mark.django_db``. Also provides
the shared tenant fixtures (``user``, ``other_user``, ``api_client``,
``auth_client``) and the parametrized tenant-isolation mechanism (§7.4) that
domain apps plug into.
"""

import importlib
import types
import uuid

import pytest

from core.tenant import tenant_context

# Test-model modules whose import-time ``register_isolation_case`` calls feed the
# shared isolation contract (see core/tests/registry.py). A new domain app adds
# its ``<app>/tests/models.py`` here so the generic contract covers it too.
_ISOLATION_TEST_MODULES = ["core.tests.models"]


@pytest.fixture(autouse=True)
def _enable_db_access(db):  # noqa: PT004 - autouse fixture intentionally returns nothing
    """Grant DB access to all tests (equivalent to default @pytest.mark.django_db)."""


@pytest.fixture
def user():
    """Lightweight tenant stand-in — only ``.id`` is used by ``tenant_context``.

    There is no real ``User`` model until Story 2.1; ``user_id`` is a plain
    ``UUIDField`` so any UUID works. Story 2.1 replaces this with ``UserFactory``.
    """
    return types.SimpleNamespace(id=uuid.uuid4())


@pytest.fixture
def other_user():
    """A second distinct tenant stand-in, for cross-tenant isolation tests."""
    return types.SimpleNamespace(id=uuid.uuid4())


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient

    return APIClient()


@pytest.fixture
def auth_client(user, api_client):
    """API client bound to ``user``'s tenant context (§6.10).

    No ``force_authenticate`` yet — there is no JWT/``User`` until Story 2.1; this
    only establishes the tenant context. 2.1 layers real authentication on top.
    """
    with tenant_context(user):
        yield api_client


def pytest_generate_tests(metafunc):
    """Parametrize any test requesting ``isolation_case`` over the registry.

    Reading the live registry at collection time (rather than baking the cases
    into a decorator) is what lets domain apps register additional models simply
    by appearing in ``_ISOLATION_TEST_MODULES`` — no edits to the shared test.
    """
    if "isolation_case" not in metafunc.fixturenames:
        return

    for module in _ISOLATION_TEST_MODULES:
        importlib.import_module(module)

    from core.tests.registry import TENANT_ISOLATION_CASES

    metafunc.parametrize(
        "isolation_case",
        TENANT_ISOLATION_CASES,
        ids=[case["id"] for case in TENANT_ISOLATION_CASES],
    )
