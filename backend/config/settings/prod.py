"""Production settings.

Reads ``.env.prod`` when present (local prod testing). On Railway, all env vars
come from the platform environment — the file is absent and that is expected.
"""

import os
from pathlib import Path

import environ

from .base import *  # noqa: E402, F403

_BASE_DIR = Path(__file__).resolve().parent.parent.parent
_env_file = _BASE_DIR / ".env.prod"
if _env_file.exists():
    environ.Env.read_env(_env_file)

DEBUG = False

# Railway terminates TLS and forwards X-Forwarded-Proto.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Route Django logs to stdout so Railway surfaces them as "info" entries.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {"class": "logging.StreamHandler", "stream": "ext://sys.stdout"},
    },
    "root": {"handlers": ["console"], "level": "WARNING"},
    "loggers": {
        "django": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "django.request": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "django.security": {"handlers": ["console"], "level": "WARNING", "propagate": False},
    },
}

# Railway health check sends Host: healthcheck.railway.app (fixed, not injected).
# RAILWAY_PUBLIC_DOMAIN and RAILWAY_PRIVATE_DOMAIN cover the public and private
# service domains respectively.
_railway_hosts = [
    h for h in [
        "healthcheck.railway.app",
        os.environ.get("RAILWAY_PUBLIC_DOMAIN"),
        os.environ.get("RAILWAY_PRIVATE_DOMAIN"),
    ]
    if h
]
ALLOWED_HOSTS = [*ALLOWED_HOSTS, *_railway_hosts]  # noqa: F405
