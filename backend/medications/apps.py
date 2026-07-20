"""App config for the ``medications`` domain app (FR-3.4, FR-3.5, FR-3.7, AD-07)."""

from django.apps import AppConfig


class MedicationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "medications"
