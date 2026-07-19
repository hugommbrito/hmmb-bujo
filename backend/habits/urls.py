from django.urls import path

from habits.views import (
    HabitDayEntryDetailView,
    HabitDayView,
    HabitDetailView,
    HabitListCreateView,
    HabitVersionCreateView,
)

urlpatterns = [
    path("", HabitListCreateView.as_view(), name="habit-list"),
    # `days/` antes de `<uuid:pk>/`: "days" não casa o conversor uuid, mas mantemos
    # a rota estática explícita no topo por clareza.
    path("days/", HabitDayView.as_view(), name="habit-day"),
    path("days/<uuid:pk>/", HabitDayEntryDetailView.as_view(), name="habit-day-entry-detail"),
    path("<uuid:pk>/", HabitDetailView.as_view(), name="habit-detail"),
    path("<uuid:pk>/versions/", HabitVersionCreateView.as_view(), name="habit-version-create"),
]
