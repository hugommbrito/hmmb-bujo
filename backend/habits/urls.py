from django.urls import path

from habits.views import (
    HabitDetailView,
    HabitListCreateView,
    HabitVersionCreateView,
)

urlpatterns = [
    path("", HabitListCreateView.as_view(), name="habit-list"),
    path("<uuid:pk>/", HabitDetailView.as_view(), name="habit-detail"),
    path("<uuid:pk>/versions/", HabitVersionCreateView.as_view(), name="habit-version-create"),
]
