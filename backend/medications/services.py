"""Camada de serviço de Medicamentos (§6.2, AD-07).

Funções de módulo (nunca classes de serviço); ``user`` é sempre o primeiro kwarg
keyword-only; toda escrita multi-tabela é ``@transaction.atomic``; scoping implícito
via ``TenantManager`` (nunca ``user_id`` cru, nunca ``all_objects``). O service recebe
dados **já validados** + ``user``, nunca o ``request``, e só levanta exceções de
``core/exceptions.py`` (``DomainError`` → 409; ``DoesNotExist`` → a view converte).

Regra de ouro (AD-07, espelha AD-06): mudança = INSERT de versão com
``effective_from = today_for(user)`` (prospectivo); a segunda mudança do **mesmo dia**
é UPDATE da versão daquele dia (via ``UniqueConstraint`` + ``update_or_create``).
Campos não informados são **herdados** da versão vigente (molde ``add_habit_version``).
Dois eixos independentes: ``add_substance_version`` (substância/lab/médico) e
``set_schedule`` (dose/ativo por bloco). Desativar agenda = ``set_schedule(active=False)``
(nova versão prospectiva; **nunca** ``.delete()``). ``today_for`` é a única fonte de
"hoje" (nunca ``date.today()``/``timezone.now()`` — guardrail de AST no CI).
"""

from django.db import transaction
from django.db.models import Max

from core.calendar import today_for
from core.exceptions import DomainError
from medications.models import (
    Doctor,
    Medication,
    MedicationScheduleVersion,
    MedicationSubstanceVersion,
    TimeBlock,
)

# Sentinela para distinguir "não passou o campo" (herdar) de "passou explicitamente".
_UNSET = object()


# --- Leitura vigente (consumida pela tela e pela 8.2) --------------------------


def current_substance_version_of(medication, on_date):
    """Versão de substância vigente do medicamento em ``on_date``
    (maior ``effective_from <= on_date``). Auto-escopado por tenant (``TenantManager``).
    """
    return (
        MedicationSubstanceVersion.objects.filter(
            medication=medication, effective_from__lte=on_date
        )
        .order_by("-effective_from")
        .first()
    )


def current_schedule_version_of(medication, time_block, on_date):
    """Versão de agenda vigente de ``(medicamento, bloco)`` em ``on_date``
    (maior ``effective_from <= on_date``). Auto-escopado por tenant (``TenantManager``).
    """
    return (
        MedicationScheduleVersion.objects.filter(
            medication=medication, time_block=time_block, effective_from__lte=on_date
        )
        .order_by("-effective_from")
        .first()
    )


# --- Validação da dose JSONB (molde ``health/services._validate_value``) --------


def _validate_dose(dose) -> None:
    """Valida a lista de componentes de dose (AC3). Levanta ``DomainError`` (→ 409).

    ``dose`` deve ser **lista não-vazia**; cada componente um dict com ``amount``
    numérico (``bool`` é rejeitado explicitamente porque ``bool ⊂ int`` em Python — um
    toggle marcado não é um número), ``unit`` string **não-vazia** após ``strip`` e
    ``label`` string (pode ser vazia — para remédio de droga única o ``substance_name``
    já identifica; Decisão 1). "Validar tudo antes de qualquer escrita" (molde
    ``upsert_health_log``).
    """
    if not isinstance(dose, list) or not dose:
        raise DomainError("A dose deve ter ao menos um componente.")
    for comp in dose:
        if not isinstance(comp, dict):
            raise DomainError("Componente de dose inválido.")
        amount = comp.get("amount")
        if isinstance(amount, bool) or not isinstance(amount, (int, float)):
            raise DomainError("amount deve ser numérico.")
        unit = comp.get("unit")
        if not isinstance(unit, str) or not unit.strip():
            raise DomainError("unit é obrigatória.")
        label = comp.get("label", "")
        if not isinstance(label, str):
            raise DomainError("label deve ser texto.")


# --- Médicos (AC6) -------------------------------------------------------------


def list_doctors(*, user):
    """Catálogo de médicos do tenant, ordenado por ``name`` (Meta.ordering)."""
    return Doctor.objects.all()


@transaction.atomic
def create_doctor(*, user, name, specialty=None) -> Doctor:
    """Cria um médico no catálogo do tenant (AC6)."""
    return Doctor.objects.create(name=name, specialty=specialty)


@transaction.atomic
def update_doctor(*, user, doctor_id, **fields) -> Doctor:
    """UPDATE direto de ``name``/``specialty`` (catálogo plano, não versionado)."""
    doctor = Doctor.objects.get(id=doctor_id)
    updated = []
    for key in ("name", "specialty"):
        if key in fields:
            setattr(doctor, key, fields[key])
            updated.append(key)
    if updated:
        doctor.save(update_fields=updated)
    return doctor


# --- Blocos de horário (AC2) ---------------------------------------------------


def list_time_blocks(*, user, include_inactive=False):
    """Blocos do tenant, ordenados por ``display_order, name`` (Meta.ordering).

    Por default só os ativos (AC2); ``include_inactive`` traz também os desativados.
    """
    qs = TimeBlock.objects.all()
    if not include_inactive:
        qs = qs.filter(active=True)
    return qs


@transaction.atomic
def create_time_block(*, user, name, display_order=None) -> TimeBlock:
    """Cria um bloco de horário (AC2). Sem ``display_order`` → append
    (``max(display_order)+1`` do tenant; o primeiro fica em 0 — molde
    ``create_health_field``). Dinâmico, sem migração de schema."""
    if display_order is None:
        current_max = TimeBlock.objects.aggregate(m=Max("display_order"))["m"]
        display_order = 0 if current_max is None else current_max + 1
    return TimeBlock.objects.create(name=name, display_order=display_order)


@transaction.atomic
def update_time_block(*, user, time_block_id, **fields) -> TimeBlock:
    """UPDATE direto de ``name``/``display_order``/``active`` (AC2). Desativar
    (``active=false``) esconde sem apagar, preservando as referências históricas das
    versões de agenda (``on_delete=PROTECT``); reativar volta ``active=true``."""
    block = TimeBlock.objects.get(id=time_block_id)
    updated = []
    for key in ("name", "display_order", "active"):
        if key in fields:
            setattr(block, key, fields[key])
            updated.append(key)
    if updated:
        block.save(update_fields=updated)
    return block


# --- Medicamentos: slot + eixo substância (AC1, AC4) ---------------------------


@transaction.atomic
def create_medication(
    *, user, title, substance_name, laboratory=None, prescribed_by_id=None
) -> Medication:
    """Cria o ``Medication`` (slot estável) **+** a primeira
    ``MedicationSubstanceVersion`` (``effective_from = hoje``) na **mesma transação**
    (molde "criar Habit + primeira HabitVersion"). Valida que ``prescribed_by_id``
    (se informado) pertence ao tenant (``Doctor.objects.get`` auto-escopado;
    ``DoesNotExist`` → a view converte). Retorna o medicamento **anotado** com o estado
    vigente (``current_substance``/``current_schedules``/``derived_active``)."""
    doctor = None
    if prescribed_by_id is not None:
        doctor = Doctor.objects.get(id=prescribed_by_id)

    today = today_for(user)
    medication = Medication.objects.create(title=title)
    MedicationSubstanceVersion.objects.create(
        medication=medication,
        substance_name=substance_name,
        laboratory=laboratory,
        prescribed_by=doctor,
        effective_from=today,
    )
    return _annotate_medication(medication, today)


@transaction.atomic
def update_medication(*, user, medication_id, title) -> Medication:
    """UPDATE direto de ``title`` (identidade do slot — não versionada, AC1/AC7)."""
    medication = Medication.objects.get(id=medication_id)
    medication.title = title
    medication.save(update_fields=["title"])
    return _annotate_medication(medication, today_for(user))


@transaction.atomic
def add_substance_version(
    *, user, medication_id, substance_name=None, laboratory=_UNSET,
    prescribed_by_id=_UNSET,
) -> MedicationSubstanceVersion:
    """Insere (ou atualiza, se já houver uma hoje) a versão de substância vigente a
    partir de hoje — eixo **substância** (AC4). Herda da versão vigente os campos não
    informados. Uma versão por ``(medication, effective_from)``: a segunda mudança do
    mesmo dia faz UPDATE da versão do dia (via ``update_or_create``).

    ``laboratory``/``prescribed_by_id`` usam a sentinela ``_UNSET`` para distinguir
    "não informado" (herdar) de valor explícito; ``substance_name`` usa ``None`` para
    "não informado" (é obrigatório no model, então herda quando ausente)."""
    medication = Medication.objects.get(id=medication_id)
    today = today_for(user)
    current = current_substance_version_of(medication, today)

    if substance_name is None:
        if current is None:  # pragma: no cover - toda substância nasce em create_medication
            raise DomainError("Informe a substância.")
        substance_name = current.substance_name

    if laboratory is _UNSET:
        laboratory = current.laboratory if current is not None else None

    if prescribed_by_id is _UNSET:
        doctor = current.prescribed_by if current is not None else None
    elif prescribed_by_id is None:
        doctor = None
    else:
        doctor = Doctor.objects.get(id=prescribed_by_id)

    version, _created = MedicationSubstanceVersion.objects.update_or_create(
        medication=medication,
        effective_from=today,
        defaults={
            "substance_name": substance_name,
            "laboratory": laboratory,
            "prescribed_by": doctor,
        },
    )
    return version


# --- Medicamentos: eixo agenda (AC3, AC5) --------------------------------------


@transaction.atomic
def set_schedule(
    *, user, medication_id, time_block_id, dose=None, active=True
) -> MedicationScheduleVersion:
    """Define (prospectivo) a agenda de ``(medicamento, bloco)`` a partir de hoje —
    eixo **agenda** (AC3/AC4). Uma versão por ``(medication, time_block,
    effective_from)``: a segunda mudança do mesmo dia é UPDATE da versão do dia.

    ``dose`` não informada (``None``) é **herdada** da versão vigente (permite
    desativar/reativar sem reenviar a dose); a primeira agenda de um bloco **exige** a
    dose. A dose final é validada por ``_validate_dose`` **antes** de qualquer escrita.
    **Desativar agenda** = ``set_schedule(..., active=False)`` (nova versão prospectiva
    ``active=false``; nunca ``.delete()`` — AC5)."""
    medication = Medication.objects.get(id=medication_id)
    time_block = TimeBlock.objects.get(id=time_block_id)
    today = today_for(user)

    if dose is None:
        current = current_schedule_version_of(medication, time_block, today)
        if current is None:
            raise DomainError("Informe a dose para criar a agenda deste bloco.")
        dose = current.dose

    _validate_dose(dose)

    version, _created = MedicationScheduleVersion.objects.update_or_create(
        medication=medication,
        time_block=time_block,
        effective_from=today,
        defaults={"dose": dose, "active": active},
    )
    return version


# --- Read-model da tela (estado vigente por medicamento) -----------------------


def _annotate_medication(medication, on_date):
    """Anexa ao ``medication`` o estado vigente em ``on_date``, para a tela renderizar.

    - ``current_substance``: a versão de substância vigente (ou ``None``).
    - ``current_schedules``: a versão de agenda vigente de cada **bloco ativo** que tem
      alguma agenda para este medicamento (bloco desativado é escondido — AC2; a versão
      histórica é preservada). N+1 aceitável (AD-14: single-user, poucos itens).
    - ``derived_active``: ``medications`` **não tem** coluna ``active`` (AC5) → o estado
      é **derivado**: um medicamento sem nenhuma agenda visível é considerado ativo
      (nada foi desativado ainda); com agendas, é ativo se **ao menos uma** está ativa
      (Decisão 5 — "Desativar" no nível do medicamento insere ``active=false`` em todas
      as agendas ativas, tornando-o derivadamente inativo).
    """
    medication.current_substance = current_substance_version_of(medication, on_date)

    block_ids = list(
        medication.schedule_versions.values_list("time_block_id", flat=True).distinct()
    )
    schedules = []
    if block_ids:
        active_blocks = TimeBlock.objects.filter(id__in=block_ids, active=True)
        for block in active_blocks:
            version = current_schedule_version_of(medication, block, on_date)
            if version is not None:
                schedules.append(version)
    schedules.sort(key=lambda s: (s.time_block.display_order, s.time_block.name))
    medication.current_schedules = schedules

    medication.derived_active = (not schedules) or any(s.active for s in schedules)
    return medication


def list_medications(*, user, on_date=None):
    """Medicamentos do tenant com o estado vigente em ``on_date`` (default hoje).

    Cada medicamento vem anotado (``current_substance``/``current_schedules``/
    ``derived_active``) para a tela renderizar o "estado de hoje". Ordenado por
    ``title`` (Meta.ordering)."""
    day = on_date or today_for(user)
    return [_annotate_medication(med, day) for med in Medication.objects.all()]


def get_medication(*, user, medication_id, on_date=None) -> Medication:
    """Um medicamento anotado com o estado vigente (detalhe/PATCH). ``DoesNotExist``
    (inclusive cross-tenant, via auto-scope) sobe para a view virar 404."""
    day = on_date or today_for(user)
    medication = Medication.objects.get(id=medication_id)
    return _annotate_medication(medication, day)
