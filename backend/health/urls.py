from django.urls import path

from health.views import (
    HealthFieldDefinitionDetailView,
    HealthFieldDefinitionListCreateView,
)

urlpatterns = [
    path("", HealthFieldDefinitionListCreateView.as_view(), name="health-field-list"),
    path(
        "<uuid:pk>/",
        HealthFieldDefinitionDetailView.as_view(),
        name="health-field-detail",
    ),
]
