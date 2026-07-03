"""Production settings.

Reads ``.env.prod`` when present (local prod testing). On Railway, all env vars
come from the platform environment — the file is absent and that is expected.
"""

from pathlib import Path

import environ

_BASE_DIR = Path(__file__).resolve().parent.parent.parent
_env_file = _BASE_DIR / ".env.prod"
if _env_file.exists():
    environ.Env.read_env(_env_file)

from .base import *  # noqa: E402, F403

DEBUG = False

# Railway terminates TLS and forwards X-Forwarded-Proto.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
