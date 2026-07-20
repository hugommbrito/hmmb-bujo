"""URLs do log diário de valores de saúde (Story 7.2), sob ``/api/health-logs/``.

Recurso-irmão de ``/api/health-field-definitions/`` (7.1) — mesmo split de
``habits`` (``api/habits/`` + ``api/habit-groups/``): definições e logs são módulos
de URL separados no mesmo app. **Nunca** ``/api/health/`` (reservado ao liveness).
"""

from django.urls import path

from health.views import (
    HealthFieldSeriesView,
    HealthHistoryView,
    HealthLogDailyView,
    HealthLogUpsertView,
)

urlpatterns = [
    # Rotas específicas ANTES da raiz (como daily/ já é) — evita a raiz capturar.
    path("daily/", HealthLogDailyView.as_view(), name="health-log-daily"),
    path("history/", HealthHistoryView.as_view(), name="health-log-history"),
    path("series/", HealthFieldSeriesView.as_view(), name="health-log-series"),
    path("", HealthLogUpsertView.as_view(), name="health-log-upsert"),
]
