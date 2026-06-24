"""Production settings — reads ``.env.prod`` (Neon main branch)."""

from pathlib import Path

import environ

_BASE_DIR = Path(__file__).resolve().parent.parent.parent
environ.Env.read_env(_BASE_DIR / ".env.prod")

from .base import *  # noqa: E402, F403

DEBUG = False

# Sensible production hardening (HTTPS-aware proxies set this header).
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
