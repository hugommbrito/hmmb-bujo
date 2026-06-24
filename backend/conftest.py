"""Root pytest configuration for the backend.

Enables database access by default for every test via an autouse fixture, so
individual tests don't need to repeat ``@pytest.mark.django_db``. The shared
fixtures (``user``, ``other_user``, ``api_client``, ``auth_client``) and the
parametrized tenant-isolation fixture arrive in Story 1.2.
"""

import pytest


@pytest.fixture(autouse=True)
def _enable_db_access(db):  # noqa: PT004 - autouse fixture intentionally returns nothing
    """Grant DB access to all tests (equivalent to default @pytest.mark.django_db)."""
