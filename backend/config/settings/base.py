"""
Base settings shared by all environments.

Environment-specific modules (``dev.py`` / ``prod.py``) read their ``.env`` file
and then ``from .base import *``. Configuration is driven by environment variables
via ``django-environ`` — no secrets are committed (see ``.env.example``).
"""

from pathlib import Path

import environ

# backend/config/settings/base.py -> backend/
BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DEBUG=(bool, False),
)

# --- Core security / hosts (all driven by env) ---------------------------------
SECRET_KEY = env("SECRET_KEY")
DEBUG = env.bool("DEBUG", default=False)
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=[])

# --- Applications --------------------------------------------------------------
# NOTE: `accounts` exists as a placeholder package but is NOT registered here
# yet — it gains models in Story 2.1. `core` is registered as of Story 1.2 (it
# now owns the TenantModel base + tenant middleware).
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "corsheaders",
    # Local
    "core",
]

MIDDLEWARE = [
    # CorsMiddleware must come as early as possible, before CommonMiddleware.
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    # Must come right after AuthenticationMiddleware — it reads request.user to
    # set the tenant context (dormant until Story 2.1 wires auth).
    "core.middleware.TenantMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# --- Database ------------------------------------------------------------------
# Parsed entirely from DATABASE_URL (incl. sslmode). Do NOT hardcode SSL OPTIONS:
# the ephemeral Postgres used in CI does not speak SSL, so sslmode must come only
# from the connection string.
DATABASES = {
    "default": env.db("DATABASE_URL"),
}

# --- Password validation -------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --- Internationalization ------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# --- Static files --------------------------------------------------------------
STATIC_URL = "static/"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Django REST Framework -----------------------------------------------------
# Only the project-wide exception handler is wired here (uniform {detail, fields}
# error bodies + domain-exception → status mapping). Pagination/filtering
# defaults belong to Story 1.4 — do NOT add them here.
REST_FRAMEWORK = {
    "EXCEPTION_HANDLER": "core.exceptions.custom_exception_handler",
}

# --- CORS ----------------------------------------------------------------------
# Origins are configurable per environment so the frontend can be served either
# same-origin (proxied) or cross-origin (CDN) without code changes.
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])
