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

from core.calendar import now, today_for
from core.exceptions import DomainError
from medications.models import (
    Doctor,
    Medication,
    MedicationDayEntry,
    MedicationScheduleVersion,
    MedicationSubstanceVersion,
    Source,
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


# --- Camada realizada por dia (Story 8.2, AD-07 itens 7-11) --------------------
# Espelha `habits` (AD-06): seed materializa o snapshot na 1ª abertura do dia;
# confirmação por linha/bloco/avulso muta só o realizado, nunca a config. O
# read-model (leitura) é separado do seed (escrita) — a 8.3 (histórico) reusa o
# read-model sem semear.


@transaction.atomic
def seed_medication_day(*, user, date) -> None:
    """Materializa (idempotente, gap-fill) as linhas ``scheduled`` de ``date`` (AC2/AC3).

    Para cada medicamento e cada **bloco ativo** com uma versão de agenda **vigente e
    ``active`` em ``date``** (``current_schedule_version_of``) que **ainda não tem**
    linha ``scheduled`` em ``(medicamento, bloco, date)``, cria a linha com
    ``dose_at_time`` **copiado** dessa versão, ``confirmed_at=None``,
    ``source=scheduled``. **Nunca** sobrescreve linhas existentes — preserva
    ``confirmed_at`` e correções (padrão create-if-missing, nunca ``update_or_create``;
    molde ``seed_habit_day``).

    Efeitos corretos por construção: (1) dias passados são imunes a medicamentos/agendas
    criados depois (``current_schedule_version_of(D) is None`` para eles); (2) blocos
    desativados (``active=False``) e agendas ``active=False`` em D não geram linha; (3)
    dias pulados abertos depois usam a versão vigente **naquele dia**, nunca a de hoje.
    A lógica de "blocos ativos do med" espelha ``_annotate_medication``.
    """
    existentes = set(
        MedicationDayEntry.objects.filter(
            date=date, source=Source.SCHEDULED
        ).values_list("medication_id", "time_block_id")
    )
    for medication in Medication.objects.all():
        block_ids = list(
            medication.schedule_versions.values_list(
                "time_block_id", flat=True
            ).distinct()
        )
        if not block_ids:
            continue
        for block in TimeBlock.objects.filter(id__in=block_ids, active=True):
            if (medication.id, block.id) in existentes:
                continue
            version = current_schedule_version_of(medication, block, date)
            if version is None or not version.active:
                continue
            MedicationDayEntry.objects.create(
                medication=medication,
                time_block=block,
                date=date,
                dose_at_time=version.dose,
                confirmed_at=None,
                source=Source.SCHEDULED,
            )


def _derive_block_status(entries) -> str:
    """Estado DERIVADO do bloco a partir das suas linhas ``scheduled`` (AC6).

    ``confirmed`` = todas confirmadas; ``partial`` = ≥1 e não todas; ``pending`` =
    nenhuma. **Nunca** armazenado (não há coluna de status de bloco) — a mesma regra
    é reimplementada no ``deriveBlockStatus`` do frontend (updater otimista). ``entries``
    são dicts do read-model (têm ``confirmed_at``); um bloco só existe com ≥1 linha.
    """
    confirmed = sum(1 for e in entries if e["confirmed_at"] is not None)
    if confirmed == 0:
        return "pending"
    if confirmed == len(entries):
        return "confirmed"
    return "partial"


def _entry_read_model(entry, on_date) -> dict:
    """Read-model de uma linha: identidade do medicamento + snapshot congelado.

    ``substance_name`` é derivado por ``current_substance_version_of(med, on_date)``
    (AD-07 item 9) — a substância vigente naquele dia, não uma coluna congelada.
    """
    substance = current_substance_version_of(entry.medication, on_date)
    return {
        "id": entry.id,
        "medication_id": entry.medication_id,
        "medication_title": entry.medication.title,
        "substance_name": substance.substance_name if substance is not None else None,
        "dose_at_time": entry.dose_at_time,
        "confirmed_at": entry.confirmed_at,
        "source": entry.source,
        "time_block_id": entry.time_block_id,
    }


def get_medication_day(*, user, date) -> dict:
    """Read-model do dia (AC4/AC6) — **read-only, NÃO chama ``seed``** (a view semeia
    antes; a 8.3 lê sem semear).

    Monta ``{date, blocks:[...], ad_hoc:[...]}``: agrupa as linhas ``scheduled`` por
    bloco (ordenado por ``display_order``/``name``, com ``status`` derivado por AC6) e
    coloca as linhas ``ad_hoc`` numa lista separada. Uma query
    (``select_related("medication","time_block")``); ``substance_name`` derivado por
    linha (N+1 aceitável — AD-14: single-user, poucos itens).
    """
    entries = list(
        MedicationDayEntry.objects.filter(date=date).select_related(
            "medication", "time_block"
        )
    )
    blocks_map: dict = {}
    ad_hoc = []
    for entry in entries:
        row = _entry_read_model(entry, date)
        if entry.source == Source.AD_HOC:
            ad_hoc.append(row)
            continue
        block = entry.time_block
        blocks_map.setdefault(block.id, {"block": block, "entries": []})
        blocks_map[block.id]["entries"].append(row)

    ordered = sorted(
        blocks_map.values(),
        key=lambda item: (item["block"].display_order, item["block"].name),
    )
    blocks = [
        {
            "time_block_id": item["block"].id,
            "time_block_name": item["block"].name,
            "status": _derive_block_status(item["entries"]),
            "entries": item["entries"],
        }
        for item in ordered
    ]
    return {"date": date, "blocks": blocks, "ad_hoc": ad_hoc}


@transaction.atomic
def confirm_medication_entry(*, user, entry_id, confirmed) -> MedicationDayEntry:
    """Confirma/desconfirma **uma só** linha (AC4) — UPDATE só naquela linha, não
    sangra para vizinhas nem toca agenda/substância (molde ``update_habit_day_entry``).

    ``confirmed_at = now()`` (``TIMESTAMPTZ`` de auditoria — ver ``core.calendar.now``)
    ou ``None``. ``DoesNotExist`` (inclusive cross-tenant) sobe para a view virar 404.
    """
    entry = MedicationDayEntry.objects.get(id=entry_id)
    entry.confirmed_at = now() if confirmed else None
    entry.save(update_fields=["confirmed_at"])
    return entry


@transaction.atomic
def confirm_block(*, user, date, time_block_id, confirmed) -> int:
    """Confirma/desconfirma o **bloco inteiro** (AC4) — escrita em lote (caso-âncora
    AD-07 linha 460: ``UPDATE confirmed_at = now()`` em todas as linhas ``scheduled``
    do bloco no dia). Um único ``.update()`` atômico; ignora ``ad_hoc``. Retorna a
    contagem de linhas afetadas.
    """
    return MedicationDayEntry.objects.filter(
        date=date, time_block_id=time_block_id, source=Source.SCHEDULED
    ).update(confirmed_at=now() if confirmed else None)


@transaction.atomic
def create_ad_hoc_entry(
    *, user, date, medication_id, time_block_id=None, dose=None
) -> MedicationDayEntry:
    """Registra um medicamento avulso/PRN (AC7): linha ``source=ad_hoc``,
    ``confirmed_at`` preenchido, ``time_block`` opcional, **fora** da constraint parcial
    de ``scheduled`` (múltiplos avulsos no mesmo dia/bloco são permitidos).

    ``dose`` omitida (``None``) é **herdada** da agenda vigente (se houver
    ``time_block`` com versão em ``date``); na ausência de agenda para herdar, **exige**
    a dose (``DomainError`` → 409 — Decisão 6: a dose é o dado clínico do avulso). A
    dose final é validada por ``_validate_dose`` antes de qualquer escrita.
    """
    medication = Medication.objects.get(id=medication_id)
    time_block = None
    if time_block_id is not None:
        time_block = TimeBlock.objects.get(id=time_block_id)

    if dose is None and time_block is not None:
        current = current_schedule_version_of(medication, time_block, date)
        if current is not None:
            dose = current.dose
    if dose is None:
        raise DomainError("Informe a dose do medicamento avulso.")

    _validate_dose(dose)

    return MedicationDayEntry.objects.create(
        medication=medication,
        time_block=time_block,
        date=date,
        dose_at_time=dose,
        confirmed_at=now(),
        source=Source.AD_HOC,
    )
