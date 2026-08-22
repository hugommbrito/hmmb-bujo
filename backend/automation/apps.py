"""App config para a Plataforma de Automação (C5, AD-19, FR-3.1).

App de *composição* (paralelo backend do `pages/` do frontend): pode importar
services de apps de domínio (relevante nas Stories 12.5/12.6), sem violar a
regra de porta do `core`. Esta fatia (12.4) entrega só a espinha de auth:
modelo de token + admin + auth class + permissão de escopo — sem endpoints HTTP.
"""

from django.apps import AppConfig


class AutomationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "automation"
