"""Request-scoped tenant context teardown (§6.7).

Guarantees ``current_user_id`` is reset after every request, so it never leaks
between requests on a reused worker — regardless of whether the view raised.

This middleware does NOT set the context (it did in a since-corrected earlier
version — see Story 3.2 fix). Django middleware runs *before* DRF resolves
``request.user``: JWT authentication happens inside ``APIView.dispatch()`` via
``perform_authentication()``, which fires only once the view layer is reached.
By the time this middleware's ``__call__`` would inspect ``request.user``, no
authentication has happened yet, so it would always see ``AnonymousUser`` —
the context would never actually be set for a real JWT-bearer request. Setting
the context is ``TenantAwareJWTAuthentication.authenticate()``'s job instead
(``core/authentication.py``): it runs exactly when the real user is known, and
stashes the ``contextvars.Token`` on the request for this middleware to reset.

Plain class form (not the async-capable form): WSGI is the current target.
"""

from core.tenant import current_user_id


class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            return self.get_response(request)
        finally:
            token = getattr(request, "_tenant_context_token", None)
            if token is not None:
                current_user_id.reset(token)
