"""Camada de serviço do Sistema de Hábitos (§6.2, AD-06).

Funções de módulo (nunca classes de serviço); ``user`` é sempre o primeiro
kwarg keyword-only; toda escrita é ``@transaction.atomic``; scoping implícito via
``TenantManager``. Regra de ouro (AD-06): mudança de ``weight``/``active``/``meta``/
``bonus`` = INSERT de ``HabitVersion`` com ``effective_from = today_for(user)``
(prospectivo); identidade (``name``/``emoticon``/``group``) é UPDATE direto sem versão;
``type`` é imutável.
"""

from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction

from core.calendar import today_for
from core.exceptions import DomainError
from habits.models import Habit, HabitDayEntry, HabitGroup, HabitVersion

# Campos de identidade (UPDATE direto no `habits`, não versionados).
_IDENTITY_FIELDS = ("name", "emoticon", "group_id", "unit")

# Sentinela para distinguir "não passou value" de "passou value=None (desmarcar)".
_UNSET = object()


def current_version_of(habit, on_date):
    """Versão vigente do hábito em ``on_date`` (maior ``effective_from <= on_date``).

    ``HabitVersion.objects`` é auto-escopado por tenant (``TenantManager``).
    """
    return (
        HabitVersion.objects.filter(habit=habit, effective_from__lte=on_date)
        .order_by("-effective_from")
        .first()
    )


def create_habit_group(*, user, name) -> HabitGroup:
    return HabitGroup.objects.create(name=name)


def list_habit_groups(*, user):
    return HabitGroup.objects.all()


def list_habits(*, user, include_inactive=False):
    """Hábitos com a versão vigente hoje anexada em ``habit.current_version``.

    Sem ``include_inactive``, oculta hábitos cuja versão vigente hoje é
    ``active=false`` (AC3). Hábitos sem versão (não deveria acontecer) são ocultados.
    """
    today = today_for(user)
    habits = Habit.objects.all().select_related("group")
    out = []
    for habit in habits:
        version = current_version_of(habit, today)
        if version is None:
            continue
        if not include_inactive and not version.active:
            continue
        habit.current_version = version
        out.append(habit)
    return out


@transaction.atomic
def create_habit(
    *, user, name, group_id, type, weight, emoticon="", unit="", meta=None, bonus=None
) -> Habit:
    """Cria ``Habit`` + a primeira ``HabitVersion`` (``active=True``,
    ``effective_from = hoje``) numa transação. ``meta``/``bonus`` só se aplicam a
    hábitos numéricos; para booleanos são forçados a ``None`` (a rejeição de forma
    fica no serializer, AC1). ``unit`` é identidade cosmética (só numéricos a usam,
    Story 6.2) — não forçamos a vazio para booleanos, o form já a esconde."""
    group = HabitGroup.objects.get(id=group_id)
    if type != Habit.Type.NUMERIC:
        meta = None
        bonus = None

    habit = Habit.objects.create(
        name=name, emoticon=emoticon, group=group, type=type, unit=unit
    )
    version = HabitVersion.objects.create(
        habit=habit,
        weight=weight,
        active=True,
        meta=meta,
        bonus=bonus,
        effective_from=today_for(user),
    )
    habit.current_version = version
    return habit


@transaction.atomic
def update_habit_identity(*, user, habit_id, **fields) -> Habit:
    """Atualiza identidade (``name``/``emoticon``/``group``) com UPDATE direto — não
    cria versão. ``type`` é imutável: passá-lo levanta ``DomainError``."""
    if "type" in fields:
        raise DomainError("O tipo do hábito é imutável.")

    habit = Habit.objects.get(id=habit_id)
    updated = []
    for key, value in fields.items():
        if key not in _IDENTITY_FIELDS:
            continue
        if key == "group_id":
            # Valida existência/escopo do grupo antes de reatribuir.
            HabitGroup.objects.get(id=value)
        setattr(habit, key, value)
        updated.append(key)
    if updated:
        habit.save(update_fields=updated)

    today = today_for(user)
    habit.current_version = current_version_of(habit, today)
    return habit


@transaction.atomic
def add_habit_version(
    *, user, habit_id, weight=None, meta=None, bonus=None, active=None
) -> HabitVersion:
    """Insere (ou atualiza, se já houver uma hoje) a versão vigente a partir de hoje.

    Herda da versão vigente os campos não informados. Usado para mudança de
    ``weight``/``meta``/``bonus`` (AC2) e para desativar/reativar via ``active`` (AC3).
    Uma versão por ``(habit, effective_from)``: a segunda mudança do mesmo dia faz
    UPDATE na versão do dia (ainda prospectiva; nenhum dia anterior materializado)."""
    habit = Habit.objects.get(id=habit_id)
    today = today_for(user)
    current = current_version_of(habit, today)

    def _inherit(new, fallback):
        return new if new is not None else fallback

    if current is not None:
        weight = _inherit(weight, current.weight)
        active = _inherit(active, current.active)
        meta = _inherit(meta, current.meta)
        bonus = _inherit(bonus, current.bonus)
    else:  # pragma: no cover - todo hábito nasce com uma versão (create_habit)
        active = True if active is None else active

    if habit.type != Habit.Type.NUMERIC:
        meta = None
        bonus = None

    version, _created = HabitVersion.objects.update_or_create(
        habit=habit,
        effective_from=today,
        defaults={"weight": weight, "active": active, "meta": meta, "bonus": bonus},
    )
    return version


# --- Camada de snapshot realizado (Story 6.2, AD-06) --------------------------


@transaction.atomic
def seed_habit_day(*, user, date) -> None:
    """Materializa (idempotente, gap-fill) as linhas de ``habit_day_entries`` de ``date``.

    Para cada hábito cuja versão vigente em ``date`` (``current_version_of``) existe
    **e** está ``active`` e que **ainda não tem** linha em ``(habit, date)``, cria a
    linha semeando ``weight_at_time``/``meta_at_time``/``bonus_at_time`` daquela versão,
    com ``value=None``. **Nunca** sobrescreve linhas existentes — preserva ``value`` e
    correções avulsas (imutabilidade do que já aconteceu, AD-06 item 3-4/FR-2.6).

    Efeitos corretos por construção (Dev Notes): (1) dias passados são imunes a
    hábitos criados depois (``current_version_of`` retorna ``None`` para eles em D);
    (2) reativação só entra no denominador de dias abertos a partir dela; (3) dias
    pulados abertos depois usam a versão vigente **naquele dia**, nunca a de hoje.
    ``date`` já vem resolvido pelo chamador (a view usa ``today_for(user)``).
    """
    existentes = set(
        HabitDayEntry.objects.filter(date=date).values_list("habit_id", flat=True)
    )
    for habit in Habit.objects.select_related("group"):
        if habit.id in existentes:
            continue
        version = current_version_of(habit, date)
        if version is None or not version.active:
            continue
        HabitDayEntry.objects.create(
            habit=habit,
            date=date,
            value=None,
            weight_at_time=version.weight,
            meta_at_time=version.meta,
            bonus_at_time=version.bonus,
        )


def _contribution(entry) -> Decimal:
    """Contribuição em [0, 1] de uma linha para a completude ponderada (FR-2.4).

    Booleano: 1 se ``value == 1`` (marcado), senão 0 (nulo/0 = não-feito).
    Numérico: 0 se sem ``value`` ou sem ``meta`` (>0); **1** ao atingir/passar a meta
    (salto discreto — ganha o bonus); senão proporcional de 0 até
    ``(1 − bonus/100)`` ao aproximar-se da meta. ``bonus`` nulo = 0.
    """
    value = entry.value
    if entry.habit.type != Habit.Type.NUMERIC:
        return Decimal(1) if value == 1 else Decimal(0)

    meta = entry.meta_at_time
    if value is None or meta is None or meta == 0:
        return Decimal(0)
    if value >= meta:
        return Decimal(1)  # atingiu a meta → 100% (ganha o bonus)
    bonus = entry.bonus_at_time or Decimal(0)
    return (value / meta) * (Decimal(1) - bonus / Decimal(100))


def _completeness_pct(entries) -> int:
    """% ponderada inteira sobre ``entries``: ``Σ(contrib × w) / Σ(w)``.

    Denominador = todos os pesos das linhas (booleano não-marcado conta com 0 no
    numerador mas o peso conta no denominador). Guarda ``Σw == 0`` → 0 (nunca
    divide por zero). ``weight_at_time`` é isolado — a 6.3 multiplicará por
    ``multiplier_at_time`` sem reescrever esta fórmula.
    """
    total_weight = sum((e.weight_at_time for e in entries), Decimal(0))
    if total_weight == 0:
        return 0
    numerator = sum(
        (_contribution(e) * e.weight_at_time for e in entries), Decimal(0)
    )
    ratio = (numerator / total_weight) * Decimal(100)
    return int(ratio.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def compute_day_completeness(*, user, date) -> dict:
    """Completude ponderada do dia ``date`` — total e por grupo (FR-2.4, AD-06 4-6).

    Fonte única: as linhas de ``habit_day_entries`` do dia (sem fallback para versão).
    Grupos preservam a ordem canônica de ``HabitGroup`` (``display_order``, ``name``).
    """
    entries = list(
        HabitDayEntry.objects.filter(date=date).select_related("habit", "habit__group")
    )
    by_group: dict = {}
    for entry in entries:
        group = entry.habit.group
        by_group.setdefault(group.id, {"group": group, "entries": []})
        by_group[group.id]["entries"].append(entry)

    ordered = sorted(
        by_group.values(),
        key=lambda item: (item["group"].display_order, item["group"].name),
    )
    return {
        "total": _completeness_pct(entries),
        "groups": [
            {
                "id": item["group"].id,
                "name": item["group"].name,
                "completion": _completeness_pct(item["entries"]),
            }
            for item in ordered
        ],
    }


@transaction.atomic
def update_habit_day_entry(
    *, user, entry_id, value=_UNSET, weight_at_time=None, meta_at_time=None, bonus_at_time=None
) -> HabitDayEntry:
    """UPDATE **só naquela linha** de ``habit_day_entries`` (AD-06 item 6).

    Marcar/desmarcar ``value`` (booleano → 1/None; numérico → registrar) e correção
    avulsa de ``weight_at_time``/``meta_at_time``/``bonus_at_time`` de um dia passado.
    **Não sangra**: não toca ``habit_versions`` nem outras linhas; só aquele dia
    recalcula. ``value`` usa sentinela (``_UNSET``) para distinguir "não enviado" de
    "enviado como None" (desmarcar). A identidade do snapshot (``habit``/``date``) é
    imutável — o serializer não aceita esses campos (400), então não os tratamos aqui.
    """
    entry = HabitDayEntry.objects.get(id=entry_id)
    updated = []
    if value is not _UNSET:
        entry.value = value
        updated.append("value")
    if weight_at_time is not None:
        entry.weight_at_time = weight_at_time
        updated.append("weight_at_time")
    if meta_at_time is not None:
        entry.meta_at_time = meta_at_time
        updated.append("meta_at_time")
    if bonus_at_time is not None:
        entry.bonus_at_time = bonus_at_time
        updated.append("bonus_at_time")
    if updated:
        entry.save(update_fields=updated)
    return entry
