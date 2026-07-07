"""Tests for ``TenantAwareJWTAuthentication`` (§6.7).

This is what actually wakes up ``current_user_id`` for a real JWT-bearer
request — Django middleware runs before ``request.user`` is resolved, so only
an authentication class (running inside DRF's ``perform_authentication()``)
sees the real user in time to set the context. See ``core/middleware.py`` for
the matching teardown half of this contract.

Wrapped in a real ``rest_framework.request.Request`` (not the raw
``APIRequestFactory`` request) on purpose: that's what DRF actually passes to
``authenticate()`` in production, and it is a *different object* from the raw
Django request — the exact distinction this authentication class has to get
right (it stashes the token on ``request._request``, not on ``request``
itself). Testing against the raw request directly would silently miss that.
"""

import pytest
from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory
from rest_framework_simplejwt.tokens import AccessToken

from accounts.tests.factories import UserFactory
from core.authentication import TenantAwareJWTAuthentication
from core.tenant import current_user_id


@pytest.mark.django_db
def test_authenticate_sets_tenant_context_for_a_valid_token():
    user = UserFactory()
    token = str(AccessToken.for_user(user))
    raw_request = APIRequestFactory().get("/", HTTP_AUTHORIZATION=f"Bearer {token}")

    result = TenantAwareJWTAuthentication().authenticate(Request(raw_request))

    assert result is not None
    assert current_user_id.get() == user.id
    current_user_id.reset(raw_request._tenant_context_token)


def test_authenticate_sets_nothing_without_credentials():
    raw_request = APIRequestFactory().get("/")

    result = TenantAwareJWTAuthentication().authenticate(Request(raw_request))

    assert result is None
    assert not hasattr(raw_request, "_tenant_context_token")
    assert current_user_id.get() is None


def test_spectacular_resolves_a_security_scheme_for_this_class():
    """Regression: drf-spectacular's ``OpenApiAuthenticationExtension`` matches
    ``target_class`` by exact import path (``match_subclasses = False``), so
    swapping ``DEFAULT_AUTHENTICATION_CLASSES`` to this subclass of
    ``JWTAuthentication`` silently dropped the ``security``/``securitySchemes``
    blocks from every endpoint's generated schema — none of the library's
    built-in ``SimpleJWTScheme`` extensions matched anymore.
    ``TenantAwareJWTAuthenticationScheme`` (registered as a side effect of
    importing ``core.authentication``, this module's import above) must
    resolve, or schema.yaml silently drifts from what a fresh
    ``manage.py spectacular`` run produces."""
    match = OpenApiAuthenticationExtension.get_match(TenantAwareJWTAuthentication)

    assert match is not None
    assert match.name == "jwtAuth"
