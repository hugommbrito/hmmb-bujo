"""App config do domínio ``gratitude`` (FR-4.1, UJ-6, Épico 9).

O domínio mais simples do MVP: um log plano por data com N linhas/dia. NÃO versiona,
NÃO materializa/semeia, sem denominador/score. ``default_auto_field`` fica em
``BigAutoField`` por convenção do projeto, mas nunca é usado — o ``TenantModel`` força
PK UUID (§6.1/AD-12).
"""

from django.apps import AppConfig


class GratitudeConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "gratitude"
