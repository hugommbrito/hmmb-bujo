"""URL configuration for the config project.

Every endpoint lives under the ``/api/`` prefix. Domain routers are added by
later stories; for now we expose only the liveness health-check.
"""

from django.contrib import admin
from django.urls import path

from core.views import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
]
