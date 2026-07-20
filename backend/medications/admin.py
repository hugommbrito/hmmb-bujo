"""Admin de operador para os models de medicamentos (AD-12): usa ``all_objects``."""

from django.contrib import admin

from medications.models import (
    Doctor,
    Medication,
    MedicationScheduleVersion,
    MedicationSubstanceVersion,
    TimeBlock,
)


@admin.register(Doctor)
class DoctorAdmin(admin.ModelAdmin):
    list_display = ("id", "user_id", "name", "specialty", "created_at")
    search_fields = ("id", "user_id", "name")

    def get_queryset(self, request):
        return Doctor.all_objects.all()


@admin.register(TimeBlock)
class TimeBlockAdmin(admin.ModelAdmin):
    list_display = ("id", "user_id", "name", "display_order", "active")
    list_filter = ("active",)
    search_fields = ("id", "user_id", "name")

    def get_queryset(self, request):
        return TimeBlock.all_objects.all()


@admin.register(Medication)
class MedicationAdmin(admin.ModelAdmin):
    list_display = ("id", "user_id", "title", "created_at")
    search_fields = ("id", "user_id", "title")

    def get_queryset(self, request):
        return Medication.all_objects.all()


@admin.register(MedicationSubstanceVersion)
class MedicationSubstanceVersionAdmin(admin.ModelAdmin):
    list_display = (
        "id", "user_id", "medication_id", "substance_name",
        "laboratory", "prescribed_by_id", "effective_from",
    )
    search_fields = ("id", "user_id", "medication_id", "substance_name")

    def get_queryset(self, request):
        return MedicationSubstanceVersion.all_objects.all()


@admin.register(MedicationScheduleVersion)
class MedicationScheduleVersionAdmin(admin.ModelAdmin):
    list_display = (
        "id", "user_id", "medication_id", "time_block_id", "active", "effective_from",
    )
    list_filter = ("active",)
    search_fields = ("id", "user_id", "medication_id", "time_block_id")

    def get_queryset(self, request):
        return MedicationScheduleVersion.all_objects.all()
