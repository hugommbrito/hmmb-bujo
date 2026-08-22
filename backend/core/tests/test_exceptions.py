"""Tests for the domain exception taxonomy and the DRF exception handler (§6.4).

Covers three things:

- the status mapping and the uniform ``{detail, fields}`` body, including the
  opaque 500 for ``TenantScopeViolation`` (must never leak the real reason);
- ``_normalise_body``'s flattening rules (DW-7);
- that every branch returning a ``Response`` marks the request's transaction for
  rollback under ``ATOMIC_REQUESTS`` (DW-32) — asserted both at the function
  surface and through a real request.
"""

import pytest
from django.contrib.auth import get_user_model
from django.db import connections, transaction
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
    # ...but already resolved to a real str: this is the only branch that could have
    # left a lazy proxy in response.data, and "{"detail": str}" is the documented
    # contract, not just the rendered wire format (found by review 2026-08-03).
    assert isinstance(response.data["detail"], str)
    # context={} carries no view/request, so there is no challenge to derive here.
    # This is the DEGENERATE path — APIView.get_exception_handler_context() always
    # supplies view+request, so the two tests below cover the production shape.
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


def test_related_object_does_not_exist_still_falls_through_to_django():
    # "Only User.DoesNotExist" is narrower than isinstance() alone can express:
    # Django builds a FK/O2O descriptor's RelatedObjectDoesNotExist as a subclass of
    # BOTH the target model's DoesNotExist and AttributeError, so dereferencing an
    # unset FK to User (``obj.user`` with no user_id) passes
    # ``isinstance(exc, User.DoesNotExist)`` while being a plain programming error,
    # not a missing row. Before the AttributeError exclusion it came back as the
    # login-shaped 401 *with* an auth challenge, so a null-deref bug read to the
    # client as "your session ended" — and to the frontend interceptor as a reason to
    # refresh and replay (found by review 2026-08-04).
    #
    # LogEntry is Django's own admin model, used here precisely because it is a real
    # descriptor-generated exception with a real FK to AUTH_USER_MODEL and costs
    # ``core`` no coupling to any domain app.
    from django.contrib.admin.models import LogEntry

    exc = LogEntry.user.RelatedObjectDoesNotExist("no user set")
    # Non-vacuity: if a future Django stopped shaping it this way, the assertion
    # below would pass for the wrong reason and the exclusion would look unnecessary.
    assert isinstance(exc, get_user_model().DoesNotExist)
    assert isinstance(exc, AttributeError)

    assert custom_exception_handler(exc, {}) is None


def test_frozen_msgid_still_matches_the_one_simplejwt_raises():
    # The whole neutrality design rests on _NO_ACTIVE_ACCOUNT being the *same msgid*
    # simplejwt raises for a deactivated user — not a copy that happened to read the
    # same the day it was written. If upstream rewords theirs, ours stops resolving
    # through their catalogue and the two 401 bodies drift apart.
    #
    # Until now the only thing that would have noticed was the pt-br round-trip in
    # test_token_refresh_401_de_desativado_e_de_apagado_sao_indistinguiveis, which
    # detects the drift only indirectly and only while simplejwt keeps shipping a
    # pt_BR catalogue for that msgid (found by review 2026-08-04). This pins it
    # directly, against the constant the serializer actually raises, and fails with a
    # message that names the real cause.
    from rest_framework_simplejwt.serializers import TokenRefreshSerializer

    upstream = TokenRefreshSerializer.default_error_messages["no_active_account"]
    assert _NO_ACTIVE_ACCOUNT == upstream


class _StubView:
    """Minimal stand-in for the ``view`` DRF puts in the handler context."""

    def __init__(self, header=None, raises=False, query_first=False):
        self._header = header
        self._raises = raises
        self._query_first = query_first

    def get_authenticate_header(self, request):
        if self._raises:
            raise RuntimeError("authenticate_header boom")
        if self._query_first:
            # Stands in for an authenticator that reads the DB to build its challenge
            # (a realm off a row, a tenant-specific scheme). Harmless normally; fatal
            # once the handler has marked the transaction — which is the point, see
            # test_challenge_is_derived_before_the_transaction_is_marked.
            from django.contrib.sessions.models import Session

            Session.objects.exists()
        return self._header


def test_user_does_not_exist_carries_the_views_challenge():
    # The production shape: APIView.get_exception_handler_context() always supplies
    # view+request, so this — not the context={} case above — is what real requests
    # take. Without the challenge the deleted-row 401 would be the only 401 on
    # /token/refresh/ lacking the header, a one-header side channel disclosing
    # exactly what the matching body hides.
    context = {"view": _StubView(header='Bearer realm="api"'), "request": object()}

    response = custom_exception_handler(get_user_model().DoesNotExist(), context)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.headers["WWW-Authenticate"] == 'Bearer realm="api"'


def test_challenge_derivation_failure_still_returns_the_401(caplog):
    # The try/except in _authenticate_header exists so that deriving a header can
    # never mask the exception we were translating — i.e. never turn the DW-25 401
    # back into the 500 it was written to remove. Nothing exercised that path
    # before (found by review 2026-08-03: replacing the except body with a raise
    # left the whole suite green), so it could have been narrowed or deleted during
    # any broad-except cleanup without a single test objecting.
    context = {"view": _StubView(raises=True), "request": object()}

    response = custom_exception_handler(get_user_model().DoesNotExist(), context)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.data["detail"] == _NO_ACTIVE_ACCOUNT
    # A challenge that could not be derived is simply absent — the branch never
    # invents one, and never downgrades to 403 the way DRF would.
    assert "WWW-Authenticate" not in response.headers
    messages = [
        record.getMessage()
        for record in caplog.records
        if record.levelname == "WARNING" and record.name == "core.exceptions"
    ]
    assert any("WWW-Authenticate" in message for message in messages)


def test_get_user_model_is_not_resolved_on_the_fallback_path(monkeypatch):
    # The two isinstance() calls are ordered on purpose: the cheap
    # ObjectDoesNotExist test gates the app-registry lookup, so an unrelated
    # exception never pays for it — and, more importantly, a lookup that raised
    # (misconfigured AUTH_USER_MODEL) could never mask the exception being handled.
    # Found by review 2026-08-03: swapping the operands left the suite green, so the
    # ordering was enforced by a comment alone despite being a spec-level invariant.
    def boom():
        raise AssertionError("get_user_model() must not run on the fallback path")

    monkeypatch.setattr("core.exceptions.get_user_model", boom)

    assert custom_exception_handler(RuntimeError("boom"), {}) is None


# --- DW-32: set_rollback() on the hand-built responses ---------------------------
@pytest.fixture
def atomic_requests():
    """Turn ``ATOMIC_REQUESTS`` on for the duration of one test.

    Be clear about what this touches: for an open connection,
    ``connection.settings_dict``, ``connections.settings["default"]`` and
    ``django.conf.settings.DATABASES["default"]`` are all the *same dict object*
    (verified). So this is a mutation of the live per-database settings, visible
    process-wide — nothing about it is scoped to the test. What makes it safe is
    only the teardown restore below.

    ``override_settings(DATABASES=...)`` is not the tidier alternative it looks
    like: it rebinds ``settings.DATABASES`` to a new dict, but
    ``ConnectionHandler.settings`` is an already-materialised ``cached_property``
    and the open ``DatabaseWrapper`` holds the *original* per-alias dict — so both
    ``set_rollback()`` and ``make_view_atomic()`` keep reading the old value and the
    override has no effect at all (verified on Django 5.2). Django also lists
    ``DATABASES`` in ``COMPLEX_OVERRIDE_SETTINGS`` and warns when you override it.

    Flips the ``default`` alias only, while DRF's ``set_rollback()`` loops
    ``connections.all()``. Correct today because ``config/settings/base.py`` defines
    exactly one database; a second alias would have to be flipped here too.

    The ``transaction.atomic()`` around the ``yield`` is a safety net, not the
    subject: a future test that requests this fixture but forgets its own inner
    block would set ``needs_rollback`` on pytest-django's test transaction, and the
    *next* test's first query would fail far from the cause. Here a stray flag dies
    with this savepoint instead. The restore stays outside it so it runs regardless.
    """
    settings_dict = connections["default"].settings_dict
    original = settings_dict.get("ATOMIC_REQUESTS", False)
    settings_dict["ATOMIC_REQUESTS"] = True
    try:
        with transaction.atomic():
            yield
    finally:
        settings_dict["ATOMIC_REQUESTS"] = original


def _handle_in_atomic_block(exc, context=None):
    """Run the handler inside a savepoint; return ``(response, rollback flag)``.

    The inner ``transaction.atomic()`` gives ``set_rollback()`` a block of its own
    on top of the transaction pytest-django already holds. On exit, Django rolls
    back to the savepoint and *clears* ``needs_rollback``, so the flag can never
    leak into the next test of the suite.

    The flag has to be read from *inside* the block — ``get_rollback()`` raises
    ``TransactionManagementError`` outside one — and, once it is set, so does any
    query in that block. Hence nothing but the response and the flag is touched in
    here; database assertions belong after the block.
    """
    with transaction.atomic():
        response = custom_exception_handler(exc, {} if context is None else context)
        return response, connections["default"].get_rollback()


def test_tenant_scope_violation_marks_rollback(atomic_requests):
    # The 500 contract is unchanged (asserted above); what is new is that the
    # request's transaction is marked, so the writes that preceded the infra bug
    # cannot commit alongside the error response.
    response, rolled_back = _handle_in_atomic_block(TenantScopeViolation())

    assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert response.data == {"detail": "Internal server error"}
    assert rolled_back is True


def test_domain_error_marks_rollback(atomic_requests):
    response, rolled_back = _handle_in_atomic_block(DomainError("x"))

    assert response.status_code == status.HTTP_409_CONFLICT
    assert rolled_back is True


def test_user_does_not_exist_marks_rollback(atomic_requests):
    # Uses the production-shaped context (view+request), so this pins the whole row
    # of the contract — status, body *and* challenge unchanged, plus the rollback —
    # rather than letting the status code stand in for the other three.
    context = {"view": _StubView(header='Bearer realm="api"'), "request": object()}

    response, rolled_back = _handle_in_atomic_block(get_user_model().DoesNotExist(), context)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.data["detail"] == _NO_ACTIVE_ACCOUNT
    assert response.headers["WWW-Authenticate"] == 'Bearer realm="api"'
    assert rolled_back is True


def test_challenge_is_derived_before_the_transaction_is_marked(atomic_requests):
    # Pins the ordering the branch comment calls load-bearing, which until now was
    # enforced by that comment alone: hoisting ``set_rollback()`` above
    # ``_authenticate_header()`` left the whole suite green (measured by review
    # 2026-08-04). With the flag set, a challenge derived from a query raises
    # ``TransactionManagementError``, which ``_authenticate_header``'s deliberately
    # broad ``except`` swallows — so the 401 would come back *silently* without
    # ``WWW-Authenticate``, restoring exactly the one-header side channel DW-25 closed.
    context = {
        "view": _StubView(header='Bearer realm="api"', query_first=True),
        "request": object(),
    }

    response, rolled_back = _handle_in_atomic_block(get_user_model().DoesNotExist(), context)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.headers["WWW-Authenticate"] == 'Bearer realm="api"'
    assert rolled_back is True


def test_domain_error_message_is_built_before_the_transaction_is_marked(atomic_requests):
    # Same ordering invariant one branch up, and the reason the body is hoisted into a
    # local instead of being written inline in the ``Response(...)`` call: ``str(exc)``
    # runs a subclass's arbitrary ``__str__``. Marked first, this ``__str__`` raises
    # ``TransactionManagementError`` — nothing catches it there, so the documented 409
    # would become Django's raw 500.
    class _QueryingDomainError(DomainError):
        def __str__(self):
            from django.contrib.sessions.models import Session

            return f"conflito ({Session.objects.count()} sessões)"

    response, rolled_back = _handle_in_atomic_block(_QueryingDomainError())

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.data["detail"].startswith("conflito (")
    assert rolled_back is True


def test_drf_recognised_branch_still_marks_rollback(atomic_requests):
    # Regression guard for the "free" case: the branch that returns DRF's own
    # Response inherits the call from the default handler. If someone ever stops
    # delegating to ``exception_handler`` first, this is what notices.
    response, rolled_back = _handle_in_atomic_block(NotAuthenticated())

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    # Normalisation runs *after* the inherited mark, so assert it here too rather
    # than leaning on ``test_missing_auth_maps_to_401``, which runs with the flag off.
    assert "detail" in response.data
    assert "fields" not in response.data
    assert rolled_back is True


def test_unknown_exception_does_not_mark_rollback(atomic_requests):
    # Negative control — this is what proves the ``is True`` assertions above come
    # from the handler and not from ambient state left by the fixture or by
    # pytest-django's own transaction.
    #
    # Not marking here is *not* a licence to commit half a mutation: returning
    # ``None`` makes DRF re-raise out of ``APIView.handle_exception``, so the
    # exception escapes the ``transaction.atomic()`` that Django's own
    # ``make_view_atomic()`` wrapped the view in, and that block rolls the whole
    # request back. The three branches above need the explicit call precisely
    # *because* they swallow the exception and return a response instead.
    response, rolled_back = _handle_in_atomic_block(RuntimeError("boom"))

    assert response is None
    assert rolled_back is False


@pytest.mark.parametrize(
    ("make_exc", "expected_status"),
    [
        (TenantScopeViolation, status.HTTP_500_INTERNAL_SERVER_ERROR),
        (lambda: DomainError("x"), status.HTTP_409_CONFLICT),
        # A callable, not the exception itself: ``get_user_model()`` must not be
        # resolved at collection time (see the fallback-path test above).
        (lambda: get_user_model().DoesNotExist(), status.HTTP_401_UNAUTHORIZED),
    ],
    ids=["tenant_scope_violation", "domain_error", "user_does_not_exist"],
)
def test_no_rollback_marked_when_atomic_requests_is_off(make_exc, expected_status):
    # Deliberately does NOT use the atomic_requests fixture: this pins today's
    # production shape, in which the new calls are inert. It doubles as the
    # non-vacuity proof for the fixture itself — without it, the flag stays False.
    # Covers all three branches because the acceptance criterion is about *any* of
    # them answering exactly as it does today.
    assert connections["default"].settings_dict["ATOMIC_REQUESTS"] is False, (
        "Premise of this test, not a handler bug: ATOMIC_REQUESTS is absent from "
        "backend/config/ and from the env files, so DRF's guard is False and the "
        "set_rollback() calls are no-ops. If the flag is now legitimately enabled, "
        "the correct action is to invert or delete THIS TEST (the branches above "
        "already assert the marking) — never to revert the infra change. Enabling "
        "the flag has prerequisites outside this handler: see DW-54 in the "
        "deferred-work ledger."
    )

    response, rolled_back = _handle_in_atomic_block(make_exc())

    assert response.status_code == expected_status
    assert rolled_back is False


def test_partial_write_is_discarded_when_the_handler_marks_rollback(atomic_requests):
    # The point of the whole fix: a row written before the exception is gone once the
    # atomic block unwinds. Without ``set_rollback()`` the savepoint would be
    # *released* on the way out and the row would survive.
    #
    # ``Session`` is Django's own model with a real table, no FK and no tenant
    # scoping, so the write needs neither a factory nor a ``tenant_context``. The
    # ``LogEntry`` reasoning above does not transfer as a *layering* argument:
    # ``accounts`` is absent from the port rule's forbidden list
    # (``pyproject.toml``), and ``core/tests/test_authentication.py`` already
    # imports ``UserFactory`` at module level.
    from django.contrib.sessions.models import Session
    from django.utils import timezone

    with transaction.atomic():
        Session.objects.create(
            session_key="dw32-handler", session_data="x", expire_date=timezone.now()
        )
        # Everything DB-touching must happen before the flag is set: afterwards any
        # query in this block raises TransactionManagementError.
        assert Session.objects.filter(session_key="dw32-handler").exists()

        response = custom_exception_handler(DomainError("x"), {})

        assert response.status_code == status.HTTP_409_CONFLICT
        assert connections["default"].get_rollback() is True

    assert not Session.objects.filter(session_key="dw32-handler").exists()


def test_request_level_partial_write_is_discarded(atomic_requests, client):
    # The tests above prove the marking at the function surface; this proves the
    # guarantee where it actually bites — a real request, with Django's own
    # ``make_view_atomic()`` supplying the transaction (it reads the very
    # ``settings_dict`` the fixture mutates), DRF's dispatch calling the handler, and
    # the response phase running afterwards.
    #
    # That last part is a risk nothing else here covers: with ``needs_rollback`` set,
    # anything in middleware or rendering that touched the DB would turn the 409 into
    # a ``TransactionManagementError``. It does not, because the atomic block exits —
    # rolling back to its savepoint and clearing the flag — before the response phase.
    from django.contrib.sessions.models import Session
    from django.test import override_settings
    from django.urls import path
    from django.utils import timezone
    from rest_framework.decorators import api_view, permission_classes
    from rest_framework.permissions import AllowAny

    @api_view(["POST"])
    @permission_classes([AllowAny])
    def _write_then_fail(request):
        Session.objects.create(
            session_key="dw32-request", session_data="x", expire_date=timezone.now()
        )
        raise DomainError("boom")

    class _UrlConf:
        # A class rather than a module or SimpleNamespace: ``get_resolver()`` caches on
        # the urlconf object, so it must be hashable. ``override_settings`` clears that
        # cache on both enter and exit, so this one does not outlive the block.
        urlpatterns = [path("dw32-rollback/", _write_then_fail)]

    with override_settings(ROOT_URLCONF=_UrlConf):
        response = client.post("/dw32-rollback/")

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json()["detail"] == "boom"
    assert not Session.objects.filter(session_key="dw32-request").exists()


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
