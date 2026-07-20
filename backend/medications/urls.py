"""URLs de medicamentos (slot + versões), sob ``/api/medications/``.

Recurso do app ``medications`` (irmão de ``urls_doctors`` + ``urls_time_blocks``,
mesmo split de ``habits.urls`` + ``habits.urls_groups``). **Nunca** ``/api/health/``
(reservado ao liveness). Rotas com sub-recurso sob ``<uuid:pk>/`` — o conversor
``uuid`` não casa os segmentos estáticos ``substance-versions``/``schedule-versions``.
"""

from django.urls import path

from medications.views import (
    MedicationAdHocView,
    MedicationBlockConfirmView,
    MedicationDayEntryDetailView,
    MedicationDayView,
    MedicationDetailView,
    MedicationListCreateView,
    MedicationScheduleVersionCreateView,
    MedicationSubstanceVersionCreateView,
)

urlpatterns = [
    path("", MedicationListCreateView.as_view(), name="medication-list"),
    # Superfície diária realizada (Story 8.2). Rotas estáticas `days/…` ANTES de
    # `days/<uuid:pk>/` (o conversor uuid não casa `confirm-block`/`ad-hoc`, mas a
    # ordem explícita é a convenção) e antes de `<uuid:pk>/` (idem, molde habits).
    path("days/", MedicationDayView.as_view(), name="medication-day"),
    path(
        "days/confirm-block/",
        MedicationBlockConfirmView.as_view(),
        name="medication-confirm-block",
    ),
    path("days/ad-hoc/", MedicationAdHocView.as_view(), name="medication-ad-hoc"),
    path(
        "days/<uuid:pk>/",
        MedicationDayEntryDetailView.as_view(),
        name="medication-day-entry-detail",
    ),
    path("<uuid:pk>/", MedicationDetailView.as_view(), name="medication-detail"),
    path(
        "<uuid:pk>/substance-versions/",
        MedicationSubstanceVersionCreateView.as_view(),
        name="medication-substance-version-create",
    ),
    path(
        "<uuid:pk>/schedule-versions/",
        MedicationScheduleVersionCreateView.as_view(),
        name="medication-schedule-version-create",
    ),
]
