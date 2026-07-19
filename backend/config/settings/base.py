"""
Base settings shared by all environments.

Environment-specific modules (``dev.py`` / ``prod.py``) read their ``.env`` file
and then ``from .base import *``. Configuration is driven by environment variables
via ``django-environ`` — no secrets are committed (see ``.env.example``).
"""

from datetime import timedelta
from pathlib import Path

import environ

# backend/config/settings/base.py -> backend/
BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DEBUG=(bool, False),
)

AUTH_USER_MODEL = "accounts.User"

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
    "drf_spectacular",
    "django_filters",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    # Local
    "core",
    "accounts",
    "bujo",
    "braindump",
    "habits",
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
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- JWT config ---------------------------------------------------------------
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "TOKEN_USER_CLASS": "rest_framework_simplejwt.models.TokenUser",
}

# --- Django REST Framework -----------------------------------------------------
REST_FRAMEWORK = {
    "EXCEPTION_HANDLER": "core.exceptions.custom_exception_handler",
    # TenantAwareJWTAuthentication (não a JWTAuthentication padrão): seta o
    # tenant context como efeito colateral de authenticate() — ver
    # core/authentication.py e core/middleware.py para o porquê (Story 3.2).
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "core.authentication.TenantAwareJWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    # camelCase na borda (§6.3) — BrowsableAPIRenderer excluído intencionalmente
    "DEFAULT_RENDERER_CLASSES": [
        "djangorestframework_camel_case.render.CamelCaseJSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "djangorestframework_camel_case.parser.CamelCaseJSONParser",
    ],
    # Paginação (§6.3)
    "DEFAULT_PAGINATION_CLASS": "core.pagination.CorePagination",
    "PAGE_SIZE": 50,
    # Filtros (§6.3)
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
    ],
    # Schema (drf-spectacular)
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

# --- drf-spectacular -----------------------------------------------------------
SPECTACULAR_SETTINGS = {
    "TITLE": "hmmb-bujo API",
    "DESCRIPTION": "BuJo Digital — API backend (Django REST Framework)",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": False,
    # Sem este hook, o schema (e portanto types.gen.ts) documenta os nomes de
    # campo em snake_case (como declarados no serializer), mas o corpo real
    # trafega em camelCase via CamelCase{JSON}Renderer/Parser (§6.3) — um
    # contrato incorreto para qualquer campo com underscore (ex.: `log_date`,
    # `to_status`, introduzidos pela Story 3.2). Mantém o hook padrão de enums
    # e acrescenta a camelização (fica condicional a `_` no nome — campos já
    # de uma palavra como `id`/`status`/`category` não mudam).
    "POSTPROCESSING_HOOKS": [
        "drf_spectacular.hooks.postprocess_schema_enums",
        "drf_spectacular.contrib.djangorestframework_camel_case.camelize_serializer_fields",
    ],
    # Sem override, o campo `type` de hábitos (boolean/numeric) colide com o
    # `type` (weekly/monthly) de bujo — ambos viram "TypeEnum" e o drf-spectacular
    # os renomeia com hash instável, poluindo o contrato de um endpoint não-relacionado.
    # Nomear o enum de hábitos explicitamente mantém o "TypeEnum" de bujo intacto.
    "ENUM_NAME_OVERRIDES": {
        "HabitTypeEnum": "habits.models.HabitType",
        # Pin do enum weekly/monthly de `ArchiveEntrySerializer.type`: sem isso, a
        # presença de um segundo campo `type` faz o drf-spectacular renomeá-lo para
        # "ArchiveEntryTypeEnum", mudando o contrato de bujo sem motivo.
        "TypeEnum": ["weekly", "monthly"],
        # Pin do enum de `day_type` (weekday/weekend/holiday) de HabitDayEntry/HabitDay
        # (Story 6.3). A config de multiplicador NÃO emite enum day_type (usa chaves
        # weekend/holiday), então não há colisão a resolver — este pin só estabiliza
        # o nome do único enum de 3 valores.
        "DayTypeEnum": "habits.models.DayType",
    },
}

# --- Exceção JSONB (§6.3, AD-01) -----------------------------------------------
# djangorestframework-camel-case 1.4+ lê sua configuração via o setting Django
# `JSON_CAMEL_CASE` (getattr(settings, "JSON_CAMEL_CASE", {})). A chave interna
# `JSON_UNDERSCOREIZE` controla o comportamento de camelize/underscoreize.
# "values" é a chave usada em health_logs.values; chaves internas (UUIDs, etc.)
# ficam preservadas. Adicionar outros campos JSONB dinâmicos conforme surgirem.
JSON_CAMEL_CASE = {
    "JSON_UNDERSCOREIZE": {"ignore_fields": ("values",)},
}

# --- CORS ----------------------------------------------------------------------
# Origins are configurable per environment so the frontend can be served either
# same-origin (proxied) or cross-origin (CDN) without code changes.
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])
