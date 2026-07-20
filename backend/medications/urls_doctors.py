"""URLs do catálogo de médicos (AC6), sob ``/api/doctors/``.

Recurso-irmão de ``medications.urls`` — módulo de URL separado no mesmo app (mesmo
split de ``habits.urls`` + ``habits.urls_groups``).
"""

from django.urls import path

from medications.views import DoctorDetailView, DoctorListCreateView

urlpatterns = [
    path("", DoctorListCreateView.as_view(), name="doctor-list"),
    path("<uuid:pk>/", DoctorDetailView.as_view(), name="doctor-detail"),
]
