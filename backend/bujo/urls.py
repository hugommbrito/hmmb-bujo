from django.urls import path

from bujo.views import (
    FutureLogView,
    MigrationQueueView,
    MonthlyLogView,
    SubtaskCreateView,
    TaskCreateView,
    TaskDetailView,
    TaskMigrateView,
    TaskReorderView,
    TaskTransitionView,
    TodayLogView,
    WeeklyLogView,
)

urlpatterns = [
    path("logs/today/", TodayLogView.as_view(), name="bujo-today-log"),
    path("logs/weekly/", WeeklyLogView.as_view(), name="bujo-weekly-log"),
    path("logs/monthly/", MonthlyLogView.as_view(), name="bujo-monthly-log"),
    path("future-log/", FutureLogView.as_view(), name="bujo-future-log"),
    path("migration/queue/", MigrationQueueView.as_view(), name="bujo-migration-queue"),
    path("tasks/", TaskCreateView.as_view(), name="bujo-task-create"),
    path("tasks/<uuid:pk>/", TaskDetailView.as_view(), name="bujo-task-detail"),
    path("tasks/<uuid:pk>/subtasks/", SubtaskCreateView.as_view(), name="bujo-task-subtasks"),
    path("tasks/<uuid:pk>/transition/", TaskTransitionView.as_view(), name="bujo-task-transition"),
    path("tasks/<uuid:pk>/reorder/", TaskReorderView.as_view(), name="bujo-task-reorder"),
    path("tasks/<uuid:pk>/migrate/", TaskMigrateView.as_view(), name="bujo-task-migrate"),
]
