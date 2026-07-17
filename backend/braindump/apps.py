"""App config for the ``braindump`` domain app (FR-5, AD-13, AD-15)."""

from django.apps import AppConfig


class BraindumpConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "braindump"
