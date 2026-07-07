"""Tests for ``TenantMiddleware`` (§6.7).

Setting ``current_user_id`` is ``TenantAwareJWTAuthentication``'s job (see
``core/authentication.py`` and its tests) — it runs inside DRF's
``perform_authentication()``, after the real user is known. Django middleware
runs *before* that, so this middleware only owns the ``finally``-guaranteed
reset, reading the ``contextvars.Token`` that authentication class stashes on
``request._tenant_context_token``. These tests simulate that hand-off directly
rather than going through real JWT auth (covered end-to-end in
``core/tests/test_authentication.py`` and ``bujo/tests/test_views.py``).
"""

import types
import uuid

from core.middleware import TenantMiddleware
from core.tenant import current_user_id


def test_resets_context_when_a_token_was_stashed_during_the_request():
    uid = uuid.uuid4()

    def get_response(request):
        # Simulates what TenantAwareJWTAuthentication.authenticate() does.
        request._tenant_context_token = current_user_id.set(uid)
        return "response"

    middleware = TenantMiddleware(get_response)
    result = middleware(types.SimpleNamespace())

    assert result == "response"
    assert current_user_id.get() is None  # reset afterwards


def test_dormant_when_no_token_was_stashed():
    def get_response(_request):
        return "response"

    middleware = TenantMiddleware(get_response)
    middleware(types.SimpleNamespace())

    assert current_user_id.get() is None


def test_resets_context_even_when_view_raises():
    uid = uuid.uuid4()

    def get_response(request):
        request._tenant_context_token = current_user_id.set(uid)
        raise RuntimeError("boom")

    middleware = TenantMiddleware(get_response)
    try:
        middleware(types.SimpleNamespace())
    except RuntimeError:
        pass

    assert current_user_id.get() is None  # finally-reset ran despite the error
