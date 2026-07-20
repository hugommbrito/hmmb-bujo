"""Views finas de Medicamentos (§6.2): validam → chamam o serviço → serializam.

Três recursos-irmãos, cada um no seu módulo de URL (mesmo split de ``habits``/``health``):
``/api/medications/`` (slot + versões), ``/api/doctors/`` (catálogo) e
``/api/time-blocks/`` (blocos dinâmicos). **Nunca** ``/api/health/`` (reservado ao
liveness check em ``config/urls.py``). Padrão idêntico ao ``habits``: ``APIView`` fina,
``@extend_schema``, ``body.is_valid(raise_exception=True)`` → service
``user=request.user`` → serializa; ``DoesNotExist`` → ``NotFound`` (404, esconde
existência cross-tenant); ``DomainError`` → 409 (``custom_exception_handler``).
"""

from datetime import date as date_cls

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from core.calendar import today_for
from medications.models import Doctor, Medication, MedicationDayEntry, TimeBlock
from medications.serializers import (
    AdHocCreateSerializer,
    BlockConfirmSerializer,
    DoctorCreateSerializer,
    DoctorSerializer,
    DoctorUpdateSerializer,
    EntryConfirmSerializer,
    MedicationCreateSerializer,
    MedicationDaySerializer,
    MedicationScheduleVersionSerializer,
    MedicationSerializer,
    MedicationSubstanceVersionSerializer,
    MedicationUpdateSerializer,
    ScheduleVersionCreateSerializer,
    SubstanceVersionCreateSerializer,
    TimeBlockCreateSerializer,
    TimeBlockSerializer,
    TimeBlockUpdateSerializer,
)
from medications.services import (
    add_substance_version,
    confirm_block,
    create_ad_hoc_entry,
    create_doctor,
    create_medication,
    create_time_block,
    get_medication,
    get_medication_day,
    list_doctors,
    list_medications,
    list_time_blocks,
    seed_medication_day,
    set_schedule,
    update_day_entry,
    update_doctor,
    update_medication,
    update_time_block,
)


def _resolve_on_date(request):
    """Resolve o parâmetro ``onDate`` (default = hoje do usuário via ``today_for``).

    Data inválida → 400 (mesmo idioma da resolução de range de ``health``/``habits``).
    """
    raw = request.query_params.get("onDate")
    if not raw:
        return today_for(request.user)
    try:
        return date_cls.fromisoformat(raw)
    except ValueError:
        raise serializers.ValidationError(
            {"onDate": "Data inválida. Use o formato YYYY-MM-DD."}
        ) from None


def _resolve_day(request):
    """Resolve o parâmetro ``date`` da superfície diária (default = hoje do usuário).

    Idioma idêntico ao ``HabitDayView`` (``?date=`` / hoje); data inválida → 400.
    """
    raw = request.query_params.get("date")
    if not raw:
        return today_for(request.user)
    try:
        return date_cls.fromisoformat(raw)
    except ValueError:
        raise serializers.ValidationError(
            {"date": "Data inválida. Use o formato YYYY-MM-DD."}
        ) from None


# --- Medicamentos --------------------------------------------------------------


class MedicationListCreateView(APIView):
    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="onDate", type=str, required=False,
                description="Data do estado vigente (YYYY-MM-DD). Default = hoje do usuário.",
            )
        ],
        responses=MedicationSerializer(many=True),
    )
    def get(self, request):
        on_date = _resolve_on_date(request)
        meds = list_medications(user=request.user, on_date=on_date)
        return Response(MedicationSerializer(meds, many=True).data)

    @extend_schema(request=MedicationCreateSerializer, responses=MedicationSerializer)
    def post(self, request):
        body = MedicationCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        try:
            medication = create_medication(user=request.user, **body.validated_data)
        except Doctor.DoesNotExist:
            raise serializers.ValidationError(
                {"prescribed_by_id": "Médico não encontrado."}
            ) from None
        return Response(
            MedicationSerializer(medication).data, status=status.HTTP_201_CREATED
        )


class MedicationDetailView(APIView):
    @extend_schema(responses=MedicationSerializer)
    def get(self, request, pk):
        try:
            medication = get_medication(user=request.user, medication_id=pk)
        except Medication.DoesNotExist:
            raise NotFound() from None
        return Response(MedicationSerializer(medication).data)

    @extend_schema(request=MedicationUpdateSerializer, responses=MedicationSerializer)
    def patch(self, request, pk):
        body = MedicationUpdateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        try:
            medication = update_medication(
                user=request.user, medication_id=pk, **body.validated_data
            )
        except Medication.DoesNotExist:
            raise NotFound() from None
        return Response(MedicationSerializer(medication).data)


class MedicationSubstanceVersionCreateView(APIView):
    """Nova versão de substância (eixo substância, AC4): ``POST
    /api/medications/{id}/substance-versions/``."""

    @extend_schema(
        request=SubstanceVersionCreateSerializer,
        responses=MedicationSubstanceVersionSerializer,
    )
    def post(self, request, pk):
        body = SubstanceVersionCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        try:
            version = add_substance_version(
                user=request.user, medication_id=pk, **body.validated_data
            )
        except Medication.DoesNotExist:
            raise NotFound() from None
        except Doctor.DoesNotExist:
            raise serializers.ValidationError(
                {"prescribed_by_id": "Médico não encontrado."}
            ) from None
        return Response(
            MedicationSubstanceVersionSerializer(version).data,
            status=status.HTTP_201_CREATED,
        )


class MedicationScheduleVersionCreateView(APIView):
    """Set/deactivate da agenda de um bloco (eixo agenda, AC3/AC5): ``POST
    /api/medications/{id}/schedule-versions/``. ``DomainError`` (dose inválida ou
    sem dose para herdar) → 409; bloco inexistente/cross-tenant → 400."""

    @extend_schema(
        request=ScheduleVersionCreateSerializer,
        responses=MedicationScheduleVersionSerializer,
    )
    def post(self, request, pk):
        body = ScheduleVersionCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = dict(body.validated_data)
        time_block_id = data.pop("time_block_id")
        try:
            version = set_schedule(
                user=request.user,
                medication_id=pk,
                time_block_id=time_block_id,
                **data,
            )
        except Medication.DoesNotExist:
            raise NotFound() from None
        except TimeBlock.DoesNotExist:
            raise serializers.ValidationError(
                {"time_block_id": "Bloco de horário não encontrado."}
            ) from None
        return Response(
            MedicationScheduleVersionSerializer(version).data,
            status=status.HTTP_201_CREATED,
        )


# --- Médicos -------------------------------------------------------------------


class DoctorListCreateView(APIView):
    @extend_schema(responses=DoctorSerializer(many=True))
    def get(self, request):
        doctors = list_doctors(user=request.user)
        return Response(DoctorSerializer(doctors, many=True).data)

    @extend_schema(request=DoctorCreateSerializer, responses=DoctorSerializer)
    def post(self, request):
        body = DoctorCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        doctor = create_doctor(user=request.user, **body.validated_data)
        return Response(DoctorSerializer(doctor).data, status=status.HTTP_201_CREATED)


class DoctorDetailView(APIView):
    @extend_schema(request=DoctorUpdateSerializer, responses=DoctorSerializer)
    def patch(self, request, pk):
        body = DoctorUpdateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        try:
            doctor = update_doctor(
                user=request.user, doctor_id=pk, **body.validated_data
            )
        except Doctor.DoesNotExist:
            raise NotFound() from None
        return Response(DoctorSerializer(doctor).data)


# --- Blocos de horário ---------------------------------------------------------


class TimeBlockListCreateView(APIView):
    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="includeInactive", type=bool, required=False,
                description="Inclui blocos com active=false (desativados).",
            )
        ],
        responses=TimeBlockSerializer(many=True),
    )
    def get(self, request):
        include_inactive = request.query_params.get("includeInactive", "").lower() in (
            "true", "1",
        )
        blocks = list_time_blocks(
            user=request.user, include_inactive=include_inactive
        )
        return Response(TimeBlockSerializer(blocks, many=True).data)

    @extend_schema(request=TimeBlockCreateSerializer, responses=TimeBlockSerializer)
    def post(self, request):
        body = TimeBlockCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        block = create_time_block(user=request.user, **body.validated_data)
        return Response(TimeBlockSerializer(block).data, status=status.HTTP_201_CREATED)


class TimeBlockDetailView(APIView):
    @extend_schema(request=TimeBlockUpdateSerializer, responses=TimeBlockSerializer)
    def patch(self, request, pk):
        body = TimeBlockUpdateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        try:
            block = update_time_block(
                user=request.user, time_block_id=pk, **body.validated_data
            )
        except TimeBlock.DoesNotExist:
            raise NotFound() from None
        return Response(TimeBlockSerializer(block).data)


# --- Superfície diária realizada (Story 8.2) -----------------------------------
# Molde exato de `habits.HabitDayView`: o GET materializa (seed no view, não no
# serializer) e serializa o read-model. Cada mutação (linha/bloco/avulso) devolve o
# read-model do dia atualizado (Decisão 2 — poupa um GET de reconciliação e uniformiza
# a resposta para o updater otimista).


class MedicationDayView(APIView):
    """Superfície diária: ``GET`` materializa (idempotente) as linhas ``scheduled`` do
    dia e retorna ``{date, blocks, adHoc}`` (default = hoje). Molde ``HabitDayView``."""

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="date", type=str, required=False,
                description="Dia da superfície (YYYY-MM-DD). Default = hoje do usuário.",
            )
        ],
        responses=MedicationDaySerializer,
    )
    def get(self, request):
        day = _resolve_day(request)
        seed_medication_day(user=request.user, date=day)
        payload = get_medication_day(user=request.user, date=day)
        return Response(MedicationDaySerializer(payload).data)


class MedicationDayEntryDetailView(APIView):
    """Edição retroativa de **uma** linha (AC4/AC5/AC6): confirma/desconfirma e/ou
    corrige a dose. Devolve o read-model do dia da linha. ``DoesNotExist`` (inclusive
    cross-tenant) → 404 (esconde existência); ``DomainError`` (dose inválida) → 409
    (propaga ao ``custom_exception_handler``, como ``MedicationScheduleVersionCreateView``);
    body sem ``confirmed`` nem ``dose`` → 400 (guard do ``EntryConfirmSerializer``)."""

    @extend_schema(request=EntryConfirmSerializer, responses=MedicationDaySerializer)
    def patch(self, request, pk):
        body = EntryConfirmSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        try:
            entry = update_day_entry(
                user=request.user, entry_id=pk, **body.validated_data
            )
        except MedicationDayEntry.DoesNotExist:
            raise NotFound() from None
        payload = get_medication_day(user=request.user, date=entry.date)
        return Response(MedicationDaySerializer(payload).data)


class MedicationBlockConfirmView(APIView):
    """Confirma/desconfirma o **bloco inteiro** no dia (AC4, escrita em lote). Devolve
    o read-model do dia atualizado."""

    @extend_schema(request=BlockConfirmSerializer, responses=MedicationDaySerializer)
    def post(self, request):
        body = BlockConfirmSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = dict(body.validated_data)
        day = data["date"]
        confirm_block(
            user=request.user,
            date=day,
            time_block_id=data["time_block_id"],
            confirmed=data["confirmed"],
        )
        payload = get_medication_day(user=request.user, date=day)
        return Response(MedicationDaySerializer(payload).data)


class MedicationAdHocView(APIView):
    """Registra um avulso/PRN no dia (AC7). Medicamento inexistente/cross-tenant → 404;
    bloco inexistente → 400; ``DomainError`` (dose ausente sem agenda para herdar) → 409
    (propaga ao ``custom_exception_handler``, como ``MedicationScheduleVersionCreateView``).
    Devolve o read-model do dia atualizado."""

    @extend_schema(request=AdHocCreateSerializer, responses=MedicationDaySerializer)
    def post(self, request):
        body = AdHocCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = dict(body.validated_data)
        day = data.pop("date")
        try:
            create_ad_hoc_entry(user=request.user, date=day, **data)
        except Medication.DoesNotExist:
            raise NotFound() from None
        except TimeBlock.DoesNotExist:
            raise serializers.ValidationError(
                {"time_block_id": "Bloco de horário não encontrado."}
            ) from None
        payload = get_medication_day(user=request.user, date=day)
        return Response(MedicationDaySerializer(payload).data)
