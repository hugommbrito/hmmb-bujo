from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from accounts.models import User, UserHoliday


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("email",)
    list_display = ("email", "timezone", "is_active", "is_staff", "date_joined")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Perfil", {"fields": ("timezone",)}),
        (
            "Permissões",
            {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")},
        ),
        ("Datas", {"fields": ("date_joined", "last_login")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "timezone", "password1", "password2")}),
    )
    search_fields = ("email",)
    readonly_fields = ("date_joined",)
    filter_horizontal = ("groups", "user_permissions")


@admin.register(UserHoliday)
class UserHolidayAdmin(admin.ModelAdmin):
    """Admin de operador (AD-12): usa ``all_objects`` (cross-tenant)."""

    list_display = ("id", "user_id", "date", "created_at")
    list_filter = ("date",)
    search_fields = ("id", "user_id")

    def get_queryset(self, request):
        return UserHoliday.all_objects.all()
