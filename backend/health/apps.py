"""App config for the ``health`` domain app (FR-3.x, AD-01)."""

from django.apps import AppConfig


class HealthConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "health"
