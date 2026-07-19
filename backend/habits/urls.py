from django.urls import path

from habits.views import (
    HabitDayEntryDetailView,
    HabitDayView,
    HabitDetailView,
    HabitHolidayView,
    HabitListCreateView,
    HabitVersionCreateView,
)

urlpatterns = [
    path("", HabitListCreateView.as_view(), name="habit-list"),
    # `days/`/`holidays/` antes de `<uuid:pk>/`: rotas estáticas não casam o
    # conversor uuid, mas mantemos a ordem explícita no topo por clareza.
    path("days/", HabitDayView.as_view(), name="habit-day"),
    path("days/<uuid:pk>/", HabitDayEntryDetailView.as_view(), name="habit-day-entry-detail"),
    path("holidays/", HabitHolidayView.as_view(), name="habit-holiday"),
    path("<uuid:pk>/", HabitDetailView.as_view(), name="habit-detail"),
    path("<uuid:pk>/versions/", HabitVersionCreateView.as_view(), name="habit-version-create"),
]
