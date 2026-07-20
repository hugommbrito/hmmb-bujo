"""URL configuration. Todo endpoint sob /api/."""

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from core.views import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/accounts/", include("accounts.urls")),
    path("api/bujo/", include("bujo.urls")),
    path("api/brain-dump/", include("braindump.urls")),
    path("api/habits/", include("habits.urls")),
    path("api/habit-groups/", include("habits.urls_groups")),
    # NÃO usar "api/health/" — reservado para o liveness check acima (colisão).
    path("api/health-field-definitions/", include("health.urls")),
    path("api/health-logs/", include("health.urls_logs")),
    # Medicamentos (Épico 8): slot + versões, catálogo de médicos, blocos dinâmicos.
    path("api/medications/", include("medications.urls")),
    path("api/doctors/", include("medications.urls_doctors")),
    path("api/time-blocks/", include("medications.urls_time_blocks")),
    # Schema endpoints (drf-spectacular)
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/schema/swagger-ui/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
]
