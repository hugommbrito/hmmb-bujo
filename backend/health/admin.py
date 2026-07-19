"""Admin de operador para os models de saúde (AD-12): usa ``all_objects``."""

from django.contrib import admin

from health.models import HealthFieldDefinition, HealthLog


@admin.register(HealthFieldDefinition)
class HealthFieldDefinitionAdmin(admin.ModelAdmin):
    list_display = ("id", "user_id", "name", "field_type", "active", "display_order")
    list_filter = ("field_type", "active")
    search_fields = ("id", "user_id", "name")

    def get_queryset(self, request):
        return HealthFieldDefinition.all_objects.all()


@admin.register(HealthLog)
class HealthLogAdmin(admin.ModelAdmin):
    list_display = ("id", "user_id", "date", "created_at")
    list_filter = ("date",)
    search_fields = ("id", "user_id")

    def get_queryset(self, request):
        return HealthLog.all_objects.all()
