"""URLs do Diário de Gratidão, sob ``/api/gratitude/``.

Um só recurso (layout flat, como ``bujo``/``braindump``): ``urls.py`` único, sem splits.
Rotas estáticas (não há ``<uuid:pk>`` na 9.1 — editar/excluir é escopo futuro, D3).
**Nunca** colidir com ``/api/health/`` (liveness).
"""

from django.urls import path

from gratitude.views import GratitudeDayView, GratitudeEntryCreateView

urlpatterns = [
    path("days/", GratitudeDayView.as_view(), name="gratitude-day"),
    path(
        "entries/",
        GratitudeEntryCreateView.as_view(),
        name="gratitude-entry-create",
    ),
]
