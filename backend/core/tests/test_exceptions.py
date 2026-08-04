"""Tests for the domain exception taxonomy and the DRF exception handler (§6.4).

Covers the status mapping and the uniform ``{detail, fields}`` body, including
the opaque 500 for ``TenantScopeViolation`` (must never leak the real reason).
"""

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.exceptions import NotAuthenticated, ValidationError

from core.exceptions import (
    _NO_ACTIVE_ACCOUNT,
    DomainError,
    ImmutableSnapshot,
    InvalidTransition,
    TenantScopeViolation,
    _normalise_body,
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


# --- DW-25: User.DoesNotExist → 401 ---------------------------------------------
def test_user_does_not_exist_maps_to_401_without_fields(caplog):
    # simplejwt's TokenRefreshSerializer looks the token's user up without a
    # try/except, so a *deleted* user made the refresh route 500. The handler now
    # translates it to the documented 401 (AccountsTokenInvalidResponse, variant
    # without "fields").
    response = custom_exception_handler(get_user_model().DoesNotExist(), {})

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "fields" not in response.data
    # The message is the shared lazy msgid, not a second frozen literal — the
    # end-to-end parity against the deactivated-user 401 (including the
    # WWW-Authenticate header and a non-English locale) is owned by
    # test_token_refresh_401_de_desativado_e_de_apagado_sao_indistinguiveis.
    assert response.data["detail"] == _NO_ACTIVE_ACCOUNT
    # context={} carries no view/request, so there is no challenge to derive here;
    # the header path is exercised on the real route by the parity test.
    assert "WWW-Authenticate" not in response.headers
    # The whole safety argument for this branch is "the warning keeps a
    # User.DoesNotExist from some *other* bug visible", so pin the real logger and
    # a message that identifies the case — not merely that some WARNING happened.
    warnings = [
        record
        for record in caplog.records
        if record.levelname == "WARNING" and record.name == "core.exceptions"
    ]
    assert len(warnings) == 1
    assert "User.DoesNotExist" in warnings[0].getMessage()
    # exc_info must ride along, or the log cannot point at the origin.
    assert warnings[0].exc_info is not None


def test_other_models_does_not_exist_still_falls_through_to_django():
    # The branch is deliberately narrow: only User.DoesNotExist. A missing row of
    # any other model is still an unexpected server error, never a 401.
    from core.tests.models import TenantTestModel

    assert custom_exception_handler(TenantTestModel.DoesNotExist(), {}) is None


# --- DW-7: _normalise_body hardening --------------------------------------------
def test_normalise_body_flattens_nested_serializer_error():
    # A nested serializer error must never surface as a stringified dict.
    body = _normalise_body({"campo": {"sub": ["msg"]}})

    assert body["fields"] == {"campo": ["msg"]}


def test_normalise_body_handles_non_list_non_field_errors():
    # A non-list non_field_errors must never be indexed by character.
    body = _normalise_body({"non_field_errors": "msg"})

    assert body["detail"] == "msg"
    assert "fields" not in body


def test_normalise_body_handles_none_data():
    # data=None must never become the literal string "None".
    assert _normalise_body(None) == {"detail": "Unexpected error"}


def test_normalise_body_preserves_detail_with_extra_keys():
    # A real detail alongside extra keys must never be demoted into fields.
    body = _normalise_body({"detail": "real", "code": "x"})

    assert body["detail"] == "real"
    assert body["fields"] == {"code": ["x"]}


def test_normalise_body_keeps_non_field_errors_as_a_field_when_detail_wins():
    # Review finding (Patch 2a): non_field_errors co-occurring with an explicit
    # detail must surface as a normal field key, never be silently dropped.
    body = _normalise_body({"detail": "real", "non_field_errors": ["extra"]})

    assert body["detail"] == "real"
    assert body["fields"] == {"non_field_errors": ["extra"]}


def test_normalise_body_flattens_a_list_detail_value():
    # Review finding (Patch 2b): a "detail" key whose value is itself a list
    # must be flattened, never stringified into a raw Python repr.
    body = _normalise_body({"detail": ["a", "b"]})

    assert body["detail"] == "a"
    assert "fields" not in body


def test_normalise_body_flattens_a_dict_detail_value():
    # _as_list() also recurses into dicts, not just lists -- pin that a nested
    # serializer error under a literal "detail" key is flattened the same way.
    body = _normalise_body({"detail": {"sub": ["msg"]}})

    assert body["detail"] == "msg"
    assert "fields" not in body
