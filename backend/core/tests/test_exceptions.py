"""Tests for the domain exception taxonomy and the DRF exception handler (§6.4).

Covers the status mapping and the uniform ``{detail, fields}`` body, including
the opaque 500 for ``TenantScopeViolation`` (must never leak the real reason).
"""

from rest_framework import status
from rest_framework.exceptions import NotAuthenticated, ValidationError

from core.exceptions import (
    DomainError,
    ImmutableSnapshot,
    InvalidTransition,
    TenantScopeViolation,
    custom_exception_handler,
)


def test_invalid_transition_builds_message():
    exc = InvalidTransition("open", "done")
    assert exc.from_status == "open"
    assert exc.to_status == "done"
    assert "open" in str(exc) and "done" in str(exc)


def test_tenant_scope_violation_maps_to_opaque_500(caplog):
    response = custom_exception_handler(TenantScopeViolation(), {})

    assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    # Body must be opaque — never reveal it is a tenant-scope problem.
    assert response.data == {"detail": "Internal server error"}
    # The real detail goes to a critical log, not the client.
    assert any(record.levelname == "CRITICAL" for record in caplog.records)


def test_domain_rule_errors_map_to_409():
    for exc in (InvalidTransition("a", "b"), ImmutableSnapshot("frozen"), DomainError("x")):
        response = custom_exception_handler(exc, {})
        assert response.status_code == status.HTTP_409_CONFLICT
        assert "detail" in response.data
        assert "fields" not in response.data


def test_validation_error_maps_to_400_with_fields():
    response = custom_exception_handler(ValidationError({"name": ["This field is required."]}), {})

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.data["fields"] == {"name": ["This field is required."]}


def test_missing_auth_maps_to_401():
    response = custom_exception_handler(NotAuthenticated(), {})

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "detail" in response.data
    assert "fields" not in response.data


def test_unknown_exception_falls_through_to_django():
    # A plain, non-domain exception is not ours to translate — return None so
    # Django produces its standard 500.
    assert custom_exception_handler(RuntimeError("boom"), {}) is None
