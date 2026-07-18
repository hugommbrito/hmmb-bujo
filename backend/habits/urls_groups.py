from django.urls import path

from habits.views import HabitGroupDetailView, HabitGroupListCreateView

urlpatterns = [
    path("", HabitGroupListCreateView.as_view(), name="habit-group-list"),
    path("<uuid:pk>/", HabitGroupDetailView.as_view(), name="habit-group-detail"),
]
