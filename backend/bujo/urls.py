from django.urls import path

from bujo.views import (
    SubtaskCreateView,
    TaskCreateView,
    TaskDetailView,
    TaskReorderView,
    TaskTransitionView,
    TodayLogView,
)

urlpatterns = [
    path("logs/today/", TodayLogView.as_view(), name="bujo-today-log"),
    path("tasks/", TaskCreateView.as_view(), name="bujo-task-create"),
    path("tasks/<uuid:pk>/", TaskDetailView.as_view(), name="bujo-task-detail"),
    path("tasks/<uuid:pk>/subtasks/", SubtaskCreateView.as_view(), name="bujo-task-subtasks"),
    path("tasks/<uuid:pk>/transition/", TaskTransitionView.as_view(), name="bujo-task-transition"),
    path("tasks/<uuid:pk>/reorder/", TaskReorderView.as_view(), name="bujo-task-reorder"),
]
