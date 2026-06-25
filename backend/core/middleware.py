"""Request-scoped tenant context wiring (§6.7).

Sets ``current_user_id`` right after authentication and resets it in ``finally``
so context never leaks between requests on a reused worker.

Scope note (Story 1.2): there is no JWT/``User`` model yet (Story 2.1), so
``request.user`` is always ``AnonymousUser`` and this middleware stays dormant —
it sets no context. That is correct and expected; it "wakes up" once 2.1 wires
auth. ``/api/health/`` runs without auth and without context regardless.

Plain class form (not the async-capable form): WSGI is the current target.
"""

from core.tenant import current_user_id


class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = None
        if getattr(request, "user", None) and request.user.is_authenticated:
            token = current_user_id.set(request.user.id)
        try:
            return self.get_response(request)
        finally:
            if token is not None:
                current_user_id.reset(token)
