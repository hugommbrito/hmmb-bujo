"""Admin de operador para `BrainDumpItem` (AD-12): usa `all_objects`."""

from django.contrib import admin

from braindump.models import BrainDumpItem


@admin.register(BrainDumpItem)
class BrainDumpItemAdmin(admin.ModelAdmin):
    list_display = ("id", "user_id", "title", "target_log", "created_at")
    list_filter = ("target_log",)
    search_fields = ("id", "user_id", "title")

    def get_queryset(self, request):
        return BrainDumpItem.all_objects.all()
