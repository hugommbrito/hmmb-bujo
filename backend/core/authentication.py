"""Tenant-aware JWT authentication (§6.7, AD-12).

``TenantMiddleware`` (see ``core/middleware.py``) cannot set ``current_user_id``
itself — Django middleware runs before DRF resolves ``request.user`` from the
JWT, so by the time it would inspect ``request.user`` here, authentication has
not happened yet. This class sets the context as a side effect of a successful
``authenticate()`` call, which DRF invokes during ``perform_authentication()``,
exactly when the real user becomes known.

The token is stashed on the request (not reset here) so ``TenantMiddleware``
can guarantee the ``finally``-reset after the response, even though this class
has no teardown hook of its own. Critically, it is stashed on
``request._request`` — the raw Django ``HttpRequest`` — and NOT on ``request``
itself. ``authenticate()`` is called by DRF with its own ``Request`` wrapper
(``rest_framework.request.Request``), a *different object* from the raw
``HttpRequest`` that ``TenantMiddleware`` holds throughout ``get_response()``.
Stashing the token on the wrapper is invisible to the middleware — the context
would never be reset (a real leak hit while building this fix, only surfaced
by tests elsewhere in the suite unexpectedly seeing a stale tenant id).
``request._request`` is DRF's own documented back-reference to that same raw
request, which is what makes the hand-off work.

Imports the contextvar from ``core.context`` — NOT from ``core.tenant`` — on
purpose: ``core.tenant`` imports ``core.exceptions``, and Django resolves
``DEFAULT_AUTHENTICATION_CLASSES`` (this class) very early, as a side effect of
``core.exceptions`` itself importing ``rest_framework.views``. Importing
``core.tenant`` here would reach back into that same, still-mid-import
``core.exceptions`` module — a real circular-import ``ImportError`` hit while
building this fix. See ``core/context.py`` for the full explanation.
"""

from drf_spectacular.contrib.rest_framework_simplejwt import SimpleJWTScheme
from rest_framework_simplejwt.authentication import JWTAuthentication

from core.context import current_user_id


class TenantAwareJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is not None:
            user, _ = result
            request._request._tenant_context_token = current_user_id.set(user.id)
        return result


class TenantAwareJWTAuthenticationScheme(SimpleJWTScheme):
    """Registers the ``jwtAuth`` security scheme for drf-spectacular.

    ``OpenApiAuthenticationExtension`` matches ``target_class`` by exact path
    (``match_subclasses = False`` in drf-spectacular), so swapping
    ``DEFAULT_AUTHENTICATION_CLASSES`` to this subclass silently dropped the
    ``security``/``securitySchemes`` blocks from every endpoint's generated
    schema — none of ``JWTAuthentication``'s built-in extension applied
    anymore. Subclassing the library's own scheme (same pattern it uses for
    ``JWTTokenUserAuthentication``) restores it.
    """

    target_class = "core.authentication.TenantAwareJWTAuthentication"
