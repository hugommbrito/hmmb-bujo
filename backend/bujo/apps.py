"""App config for the ``bujo`` domain app (Daily Log & Task aggregate)."""

from django.apps import AppConfig


class BujoConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "bujo"
