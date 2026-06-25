"""Tests for ``TenantMiddleware`` (§6.7).

Proves the request-scoped lifecycle: context is set for an authenticated user,
always reset afterwards (no leak across requests on a reused worker), and the
middleware stays dormant for anonymous requests (correct until Story 2.1).
"""

import types
import uuid

from core.middleware import TenantMiddleware
from core.tenant import current_user_id


def _request(*, authenticated, user_id=None):
    user = types.SimpleNamespace(is_authenticated=authenticated, id=user_id)
    return types.SimpleNamespace(user=user)


def test_sets_and_resets_context_for_authenticated_user():
    uid = uuid.uuid4()
    seen = {}

    def get_response(_request):
        seen["uid"] = current_user_id.get()
        return "response"

    middleware = TenantMiddleware(get_response)
    result = middleware(_request(authenticated=True, user_id=uid))

    assert result == "response"
    assert seen["uid"] == uid  # context was set during the request
    assert current_user_id.get() is None  # and reset afterwards


def test_dormant_for_anonymous_request():
    seen = {}

    def get_response(_request):
        seen["uid"] = current_user_id.get()
        return "response"

    middleware = TenantMiddleware(get_response)
    middleware(_request(authenticated=False))

    assert seen["uid"] is None  # no context set for an anonymous user
    assert current_user_id.get() is None


def test_resets_context_even_when_view_raises():
    uid = uuid.uuid4()

    def get_response(_request):
        raise RuntimeError("boom")

    middleware = TenantMiddleware(get_response)
    try:
        middleware(_request(authenticated=True, user_id=uid))
    except RuntimeError:
        pass

    assert current_user_id.get() is None  # finally-reset ran despite the error
