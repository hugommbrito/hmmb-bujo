"""Admin de operador para os models de hábitos (AD-12): usa ``all_objects``."""

from django.contrib import admin

from habits.models import (
    Habit,
    HabitDayEntry,
    HabitGroup,
    HabitGroupDayMultiplier,
    HabitVersion,
)


@admin.register(HabitGroup)
class HabitGroupAdmin(admin.ModelAdmin):
    list_display = ("id", "user_id", "name", "display_order")
    search_fields = ("id", "user_id", "name")

    def get_queryset(self, request):
        return HabitGroup.all_objects.all()


@admin.register(Habit)
class HabitAdmin(admin.ModelAdmin):
    list_display = ("id", "user_id", "name", "type", "group_id", "created_at")
    list_filter = ("type",)
    search_fields = ("id", "user_id", "name")

    def get_queryset(self, request):
        return Habit.all_objects.all()


@admin.register(HabitVersion)
class HabitVersionAdmin(admin.ModelAdmin):
    list_display = ("id", "user_id", "habit_id", "weight", "active", "effective_from")
    list_filter = ("active",)
    search_fields = ("id", "user_id", "habit_id")

    def get_queryset(self, request):
        return HabitVersion.all_objects.all()


@admin.register(HabitDayEntry)
class HabitDayEntryAdmin(admin.ModelAdmin):
    list_display = (
        "id", "user_id", "habit_id", "date", "value",
        "weight_at_time", "day_type", "multiplier_at_time",
    )
    list_filter = ("date", "day_type")
    search_fields = ("id", "user_id", "habit_id")

    def get_queryset(self, request):
        return HabitDayEntry.all_objects.all()


@admin.register(HabitGroupDayMultiplier)
class HabitGroupDayMultiplierAdmin(admin.ModelAdmin):
    list_display = ("id", "user_id", "group_id", "day_type", "multiplier", "effective_from")
    list_filter = ("day_type",)
    search_fields = ("id", "user_id", "group_id")

    def get_queryset(self, request):
        return HabitGroupDayMultiplier.all_objects.all()
