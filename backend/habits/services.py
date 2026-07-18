"""Camada de serviço do Sistema de Hábitos (§6.2, AD-06).

Funções de módulo (nunca classes de serviço); ``user`` é sempre o primeiro
kwarg keyword-only; toda escrita é ``@transaction.atomic``; scoping implícito via
``TenantManager``. Regra de ouro (AD-06): mudança de ``weight``/``active``/``meta``/
``bonus`` = INSERT de ``HabitVersion`` com ``effective_from = today_for(user)``
(prospectivo); identidade (``name``/``emoticon``/``group``) é UPDATE direto sem versão;
``type`` é imutável.
"""

from django.db import transaction

from core.calendar import today_for
from core.exceptions import DomainError
from habits.models import Habit, HabitGroup, HabitVersion

# Campos de identidade (UPDATE direto no `habits`, não versionados).
_IDENTITY_FIELDS = ("name", "emoticon", "group_id")


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
    *, user, name, group_id, type, weight, emoticon="", meta=None, bonus=None
) -> Habit:
    """Cria ``Habit`` + a primeira ``HabitVersion`` (``active=True``,
    ``effective_from = hoje``) numa transação. ``meta``/``bonus`` só se aplicam a
    hábitos numéricos; para booleanos são forçados a ``None`` (a rejeição de forma
    fica no serializer, AC1)."""
    group = HabitGroup.objects.get(id=group_id)
    if type != Habit.Type.NUMERIC:
        meta = None
        bonus = None

    habit = Habit.objects.create(
        name=name, emoticon=emoticon, group=group, type=type
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
