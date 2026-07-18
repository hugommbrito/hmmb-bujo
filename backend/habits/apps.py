"""App config for the ``habits`` domain app (FR-2.x, AD-06, AD-10)."""

from django.apps import AppConfig


class HabitsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "habits"
