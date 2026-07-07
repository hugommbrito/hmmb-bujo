"""The tenant contextvar, isolated in its own leaf module (§6.7, AD-12).

Zero internal imports on purpose. ``core.authentication`` needs this contextvar
but must NOT import ``core.tenant`` (which imports ``core.exceptions``):
Django resolves ``DEFAULT_AUTHENTICATION_CLASSES`` very early, as a side effect
of ``core.exceptions`` itself importing ``rest_framework.views`` — which
transitively imports ``rest_framework.schemas``, which reads
``DEFAULT_AUTHENTICATION_CLASSES`` at module load time. If the authentication
class it imports pulls in ``core.tenant`` → ``core.exceptions``, that reaches
back into the *same* ``core.exceptions`` module while it is still mid-import,
which is a circular-import ``ImportError`` (hit for real fixing the
Story 3.2 tenant-middleware bug). This module breaks that cycle by holding
nothing but the contextvar.

Default None means "no tenant set" → fail-closed everywhere (``core.tenant``).
"""

import contextvars

current_user_id = contextvars.ContextVar("current_user_id", default=None)
