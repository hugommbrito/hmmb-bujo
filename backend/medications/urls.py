"""URLs de medicamentos (slot + versões), sob ``/api/medications/``.

Recurso do app ``medications`` (irmão de ``urls_doctors`` + ``urls_time_blocks``,
mesmo split de ``habits.urls`` + ``habits.urls_groups``). **Nunca** ``/api/health/``
(reservado ao liveness). Rotas com sub-recurso sob ``<uuid:pk>/`` — o conversor
``uuid`` não casa os segmentos estáticos ``substance-versions``/``schedule-versions``.
"""

from django.urls import path

from medications.views import (
    MedicationDetailView,
    MedicationListCreateView,
    MedicationScheduleVersionCreateView,
    MedicationSubstanceVersionCreateView,
)

urlpatterns = [
    path("", MedicationListCreateView.as_view(), name="medication-list"),
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
