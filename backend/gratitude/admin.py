"""Admin de operador para as entradas de gratidão (AD-12): usa ``all_objects``."""

from django.contrib import admin

from gratitude.models import GratitudeEntry


@admin.register(GratitudeEntry)
class GratitudeEntryAdmin(admin.ModelAdmin):
    list_display = ("id", "user_id", "date", "created_at")
    list_filter = ("date",)
    search_fields = ("id", "user_id", "text")

    def get_queryset(self, request):
        return GratitudeEntry.all_objects.all()
