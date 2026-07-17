from django.urls import path

from braindump.views import (
    BrainDumpItemDetailView,
    BrainDumpItemListCreateView,
    BrainDumpItemProcessView,
)

urlpatterns = [
    path("items/", BrainDumpItemListCreateView.as_view(), name="braindump-item-list"),
    path("items/<uuid:pk>/", BrainDumpItemDetailView.as_view(), name="braindump-item-detail"),
    path(
        "items/<uuid:pk>/process/",
        BrainDumpItemProcessView.as_view(),
        name="braindump-item-process",
    ),
]
