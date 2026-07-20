"""URLs dos blocos de horário dinâmicos (AC2), sob ``/api/time-blocks/``.

Recurso-irmão de ``medications.urls`` — módulo de URL separado no mesmo app (mesmo
split de ``habits.urls`` + ``habits.urls_groups``).
"""

from django.urls import path

from medications.views import TimeBlockDetailView, TimeBlockListCreateView

urlpatterns = [
    path("", TimeBlockListCreateView.as_view(), name="time-block-list"),
    path("<uuid:pk>/", TimeBlockDetailView.as_view(), name="time-block-detail"),
]
