from django.urls import path

from habits.views import (
    HabitGroupDetailView,
    HabitGroupListCreateView,
    HabitGroupMultipliersView,
)

urlpatterns = [
    path("", HabitGroupListCreateView.as_view(), name="habit-group-list"),
    path("<uuid:pk>/", HabitGroupDetailView.as_view(), name="habit-group-detail"),
    path(
        "<uuid:pk>/multipliers/",
        HabitGroupMultipliersView.as_view(),
        name="habit-group-multipliers",
    ),
]
