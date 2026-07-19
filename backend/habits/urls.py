from django.urls import path

from habits.views import (
    HabitDayEntryDetailView,
    HabitDayView,
    HabitDetailView,
    HabitHistoryRangeView,
    HabitHolidayView,
    HabitListCreateView,
    HabitSeriesView,
    HabitVersionCreateView,
)

urlpatterns = [
    path("", HabitListCreateView.as_view(), name="habit-list"),
    # `days/`/`holidays/`/`history/` antes de `<uuid:pk>/`: rotas estáticas não casam
    # o conversor uuid, mas mantemos a ordem explícita no topo por clareza.
    path("days/", HabitDayView.as_view(), name="habit-day"),
    path("days/<uuid:pk>/", HabitDayEntryDetailView.as_view(), name="habit-day-entry-detail"),
    path("holidays/", HabitHolidayView.as_view(), name="habit-holiday"),
    # Histórico read-only (Story 6.4): intervalo (grade + detalhe por-data) e série por hábito.
    path("history/", HabitHistoryRangeView.as_view(), name="habit-history"),
    path("<uuid:pk>/", HabitDetailView.as_view(), name="habit-detail"),
    path("<uuid:pk>/versions/", HabitVersionCreateView.as_view(), name="habit-version-create"),
    path("<uuid:pk>/series/", HabitSeriesView.as_view(), name="habit-series"),
]
