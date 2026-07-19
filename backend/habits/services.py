"""Camada de serviço do Sistema de Hábitos (§6.2, AD-06).

Funções de módulo (nunca classes de serviço); ``user`` é sempre o primeiro
kwarg keyword-only; toda escrita é ``@transaction.atomic``; scoping implícito via
``TenantManager``. Regra de ouro (AD-06): mudança de ``weight``/``active``/``meta``/
``bonus`` = INSERT de ``HabitVersion`` com ``effective_from = today_for(user)``
(prospectivo); identidade (``name``/``emoticon``/``group``) é UPDATE direto sem versão;
``type`` é imutável.
"""

from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction

from core.calendar import resolve_day_type, resolve_day_types_range, today_for
from core.exceptions import DomainError
from habits.models import (
    DayType,
    Habit,
    HabitDayEntry,
    HabitGroup,
    HabitGroupDayMultiplier,
    HabitVersion,
)

# Campos de identidade (UPDATE direto no `habits`, não versionados).
_IDENTITY_FIELDS = ("name", "emoticon", "group_id", "unit")

# Sentinela para distinguir "não passou value" de "passou value=None (desmarcar)".
_UNSET = object()

# Multiplicador neutro (weekday, ou grupo sem config para o tipo do dia).
_NEUTRAL_MULTIPLIER = Decimal("1.00")


def current_version_of(habit, on_date):
    """Versão vigente do hábito em ``on_date`` (maior ``effective_from <= on_date``).

    ``HabitVersion.objects`` é auto-escopado por tenant (``TenantManager``).
    """
    return (
        HabitVersion.objects.filter(habit=habit, effective_from__lte=on_date)
        .order_by("-effective_from")
        .first()
    )


def multiplier_for(group, day_type, on_date) -> Decimal:
    """Multiplicador vigente do ``group`` para ``day_type`` em ``on_date`` (AD-10).

    ``weekday`` é sempre ``1.00`` (nunca armazenado). Para ``weekend``/``holiday``,
    a linha vigente é a de maior ``effective_from <= on_date`` (mesma mecânica de
    ``current_version_of``); sem linha → ``1.00`` (grupo sem config para esse tipo).
    Auto-escopado por tenant (``TenantManager``), sem ``user`` (como
    ``current_version_of``).
    """
    if day_type == DayType.WEEKDAY:
        return _NEUTRAL_MULTIPLIER
    row = (
        HabitGroupDayMultiplier.objects.filter(
            group=group, day_type=day_type, effective_from__lte=on_date
        )
        .order_by("-effective_from")
        .first()
    )
    return row.multiplier if row is not None else _NEUTRAL_MULTIPLIER


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


# --- Camada de ritmo: multiplicador por grupo × tipo de dia (Story 6.3) -------


@transaction.atomic
def set_group_day_multiplier(
    *, user, group_id, day_type, multiplier
) -> HabitGroupDayMultiplier:
    """Define (prospectivo) o multiplicador do grupo para ``day_type`` a partir de hoje.

    Espelha ``add_habit_version``: INSERT com ``effective_from = today_for(user)``
    (ou UPDATE se já houver uma linha de hoje). **Não** toca dias congelados —
    dias abertos daqui em diante herdam o novo valor. Só ``weekend``/``holiday``
    são válidos (``weekday`` é 1.0 implícito); outro valor levanta ``DomainError``.
    """
    if day_type not in (DayType.WEEKEND, DayType.HOLIDAY):
        raise DomainError("Multiplicador só se aplica a fim de semana ou feriado.")
    group = HabitGroup.objects.get(id=group_id)
    row, _created = HabitGroupDayMultiplier.objects.update_or_create(
        group=group,
        day_type=day_type,
        effective_from=today_for(user),
        defaults={"multiplier": multiplier},
    )
    return row


def current_multipliers_of(group, on_date) -> dict:
    """Config vigente do grupo em ``on_date`` — ``{"weekend": Decimal, "holiday": Decimal}``.

    Cada valor é o multiplicador vigente (``multiplier_for``); grupo sem config para
    o tipo → ``1.00``. Auto-escopado por tenant (via ``multiplier_for``).
    """
    return {
        "weekend": multiplier_for(group, DayType.WEEKEND, on_date),
        "holiday": multiplier_for(group, DayType.HOLIDAY, on_date),
    }


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

    Camada de ritmo (6.3): resolve ``day_type(date)`` **uma vez** e congela, por
    linha nova, ``day_type`` + ``multiplier_at_time`` (multiplicador do grupo
    vigente em ``date`` para aquele tipo de dia, default ``1.00``) — dias pulados
    recebem o tipo/multiplicador **daquele dia**, nunca os de hoje.
    """
    existentes = set(
        HabitDayEntry.objects.filter(date=date).values_list("habit_id", flat=True)
    )
    day_type = resolve_day_type(user, date)
    for habit in Habit.objects.select_related("group"):
        if habit.id in existentes:
            continue
        version = current_version_of(habit, date)
        if version is None or not version.active:
            continue
        multiplier = multiplier_for(habit.group, day_type, date)
        HabitDayEntry.objects.create(
            habit=habit,
            date=date,
            value=None,
            weight_at_time=version.weight,
            meta_at_time=version.meta,
            bonus_at_time=version.bonus,
            day_type=day_type,
            multiplier_at_time=multiplier,
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


def _effective_weight(entry) -> Decimal:
    """Peso efetivo da linha (AD-10): ``weight_at_time × multiplier_at_time``.

    Fatores congelados separados no snapshot; o produto é o peso que entra na
    completude. ``multiplier_at_time = 0`` (ex.: feriado com ``holiday=0.0``) zera
    o peso efetivo — o hábito sai de numerador **e** denominador.
    """
    return entry.weight_at_time * entry.multiplier_at_time


def _completeness_pct(entries) -> int:
    """% ponderada inteira sobre ``entries``: ``Σ(contrib × peso_efetivo) / Σ(peso_efetivo)``.

    Peso = ``peso_efetivo = weight_at_time × multiplier_at_time`` (AD-10). Denominador
    = soma dos pesos efetivos das linhas (booleano não-marcado conta 0 no numerador,
    mas o peso conta no denominador). Guarda ``Σ peso_efetivo == 0`` → 0 (nunca divide
    por zero — cobre também ``multiplier=0`` em todas as linhas).
    """
    total_weight = sum((_effective_weight(e) for e in entries), Decimal(0))
    if total_weight == 0:
        return 0
    numerator = sum(
        (_contribution(e) * _effective_weight(e) for e in entries), Decimal(0)
    )
    ratio = (numerator / total_weight) * Decimal(100)
    return int(ratio.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _grouped_completeness(entries) -> list[dict]:
    """% ponderada POR GRUPO das ``entries`` do dia, na ordem canônica de ``HabitGroup``.

    Agrupa as linhas por grupo e chama ``_completeness_pct`` por grupo (autoridade
    única do cálculo). Preserva ``display_order``/``name``. Extraído de
    ``compute_day_completeness`` para o histórico (Story 6.4) reusar a MESMA mecânica
    sem reimplementar (AC1 exige o % por grupo no detalhe por-data).
    """
    by_group: dict = {}
    for entry in entries:
        group = entry.habit.group
        by_group.setdefault(group.id, {"group": group, "entries": []})
        by_group[group.id]["entries"].append(entry)

    ordered = sorted(
        by_group.values(),
        key=lambda item: (item["group"].display_order, item["group"].name),
    )
    return [
        {
            "id": item["group"].id,
            "name": item["group"].name,
            "completion": _completeness_pct(item["entries"]),
        }
        for item in ordered
    ]


def compute_day_completeness(*, user, date) -> dict:
    """Completude ponderada do dia ``date`` — total e por grupo (FR-2.4, AD-06 4-6).

    Fonte única: as linhas de ``habit_day_entries`` do dia (sem fallback para versão).
    Grupos preservam a ordem canônica de ``HabitGroup`` (``display_order``, ``name``).
    """
    entries = list(
        HabitDayEntry.objects.filter(date=date).select_related("habit", "habit__group")
    )
    return {
        "total": _completeness_pct(entries),
        "groups": _grouped_completeness(entries),
    }


@transaction.atomic
def set_holiday(*, user, date, is_holiday) -> None:
    """Marca/desmarca ``date`` como feriado e recalcula **só aquele dia** (AD-10 item 6).

    Escreve ``accounts.UserHoliday`` (``habits → accounts`` permitido; import tardio):
    ``is_holiday`` → ``get_or_create``; caso contrário → ``delete``. **Depois**,
    re-resolve ``day_type`` + ``multiplier_at_time`` de **todas as linhas do dia D**
    (bounded — vizinhos intactos, ``value`` preservado, ``habit_versions`` e
    ``weight_at_time`` base nunca tocados). O recálculo re-deriva da config vigente:
    um override avulso anterior daquele dia é re-derivado (comportamento esperado —
    togglar feriado reconstrói o ritmo do dia a partir da config).
    """
    from accounts.models import UserHoliday

    if is_holiday:
        UserHoliday.objects.get_or_create(date=date)
    else:
        UserHoliday.objects.filter(date=date).delete()

    day_type = resolve_day_type(user, date)
    entries = HabitDayEntry.objects.filter(date=date).select_related("habit__group")
    for entry in entries:
        entry.day_type = day_type
        entry.multiplier_at_time = multiplier_for(entry.habit.group, day_type, date)
        entry.save(update_fields=["day_type", "multiplier_at_time"])


@transaction.atomic
def update_habit_day_entry(
    *, user, entry_id, value=_UNSET, weight_at_time=None, meta_at_time=None,
    bonus_at_time=None, multiplier_at_time=None,
) -> HabitDayEntry:
    """UPDATE **só naquela linha** de ``habit_day_entries`` (AD-06 item 6).

    Marcar/desmarcar ``value`` (booleano → 1/None; numérico → registrar), correção
    avulsa de ``weight_at_time``/``meta_at_time``/``bonus_at_time`` e override avulso
    de ``multiplier_at_time`` ("nesse sábado eu trabalhei", Story 6.3). **Não sangra**:
    não toca ``habit_versions`` nem outras linhas; só aquele dia recalcula. ``value``
    usa sentinela (``_UNSET``) para distinguir "não enviado" de "enviado como None"
    (desmarcar); ``multiplier_at_time`` usa ``None`` = "não informado" (não há caso de
    "desmarcar multiplicador"; default é ``1.0``, não null). A identidade do snapshot
    (``habit``/``date``) é imutável — o serializer a rejeita (400).
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
    if multiplier_at_time is not None:
        entry.multiplier_at_time = multiplier_at_time
        updated.append("multiplier_at_time")
    if updated:
        entry.save(update_fields=updated)
    return entry


# --- Camada de LEITURA de histórico (Story 6.4, AD-11/AD-14) ------------------
# Derivada on-read de `habit_day_entries` (série) + `habit_versions` (eventos) +
# day_type (ritmo). Sem schema/série materializada nova, sem `@transaction.atomic`
# (só leitura), e — crítico (AC1) — NUNCA chama `seed_habit_day`: dias nunca
# abertos são lacunas honestas, não 0% fabricado.

_MAX_RANGE_DAYS = 92


def _validate_range(start, end) -> None:
    """Guarda comum das leituras de histórico: ``start <= end`` e range ≤ 92 dias."""
    if start > end:
        raise DomainError("A data inicial deve ser anterior ou igual à data final.")
    if (end - start).days > _MAX_RANGE_DAYS:
        raise DomainError(
            f"O intervalo não pode exceder {_MAX_RANGE_DAYS} dias."
        )


def get_habit_history_range(*, user, start, end) -> dict:
    """Histórico por-data no range ``[start, end]`` — read-only, não-semeador (AC1).

    **Uma** query em ``habit_day_entries`` (``select_related('habit__group')``,
    auto-escopada) + **uma** query de feriados via ``resolve_day_types_range`` — agrupa
    em Python (sem N+1). Retorna ``habits`` (identidade dos hábitos que aparecem no
    range, ordenados por grupo ``display_order``/``name``, depois nome) e ``days`` =
    **todos** os dias de calendário em ``[start, end]``. Cada dia materializado traz
    ``total_completion``/``groups`` (% ponderado, mesma mecânica de
    ``compute_day_completeness`` via ``_grouped_completeness``) e as ``entries``; um dia
    **sem linha** (nunca aberto/pulado) é **lacuna honesta**: ``total_completion=None``,
    ``groups=[]``, ``entries=[]`` — nunca 0% fabricado, e **nada é materializado**.
    """
    _validate_range(start, end)

    entries = list(
        HabitDayEntry.objects.filter(date__range=(start, end)).select_related(
            "habit", "habit__group"
        )
    )
    dtypes = resolve_day_types_range(user, start, end)

    by_date: dict = {}
    habits_seen: dict = {}
    for entry in entries:
        by_date.setdefault(entry.date, []).append(entry)
        habits_seen.setdefault(entry.habit_id, entry.habit)

    habits_ordered = sorted(
        habits_seen.values(),
        key=lambda h: (h.group.display_order, h.group.name, h.name),
    )

    days = []
    d = start
    while d <= end:
        day_entries = by_date.get(d, [])
        if day_entries:
            total = _completeness_pct(day_entries)
            groups = _grouped_completeness(day_entries)
        else:
            # Lacuna honesta: distinguir explicitamente de 0% (_completeness_pct([])==0).
            total = None
            groups = []
        days.append(
            {
                "date": d,
                "day_type": dtypes[d],
                "total_completion": total,
                "groups": groups,
                "entries": day_entries,
            }
        )
        d += timedelta(days=1)

    return {"start": start, "end": end, "habits": habits_ordered, "days": days}


def _decimal_str(value):
    """Serializa um ``Decimal``/``None`` como string estável (ou ``None``) para o diff."""
    return None if value is None else str(value)


def _bool_str(value) -> str:
    """Serializa ``active`` (bool) como string estável ('true'/'false') no diff."""
    return "true" if value else "false"


def _diff_versions(prev, curr) -> list[dict]:
    """Mudanças entre duas versões consecutivas → ``[{field, before, after}]`` (AC2).

    ``prev is None`` (primeira versão) = criação → ``[{field: 'created'}]``. Só campos
    versionados que mudaram (``weight``/``meta``/``bonus``/``active``). Chaves
    ``before``/``after`` — **NUNCA** ``from``/``to`` (``from`` é palavra reservada em
    Python). ``active`` false→true / true→false vira o marcador Reativado/Desativado no
    front (FR-2.7/2.8). Valores heterogêneos como string estável.
    """
    if prev is None:
        return [{"field": "created", "before": None, "after": None}]

    changes = []
    if curr.weight != prev.weight:
        changes.append({
            "field": "weight",
            "before": _decimal_str(prev.weight),
            "after": _decimal_str(curr.weight),
        })
    if curr.meta != prev.meta:
        changes.append({
            "field": "meta",
            "before": _decimal_str(prev.meta),
            "after": _decimal_str(curr.meta),
        })
    if curr.bonus != prev.bonus:
        changes.append({
            "field": "bonus",
            "before": _decimal_str(prev.bonus),
            "after": _decimal_str(curr.bonus),
        })
    if curr.active != prev.active:
        changes.append({
            "field": "active",
            "before": _bool_str(prev.active),
            "after": _bool_str(curr.active),
        })
    return changes


def get_habit_series(*, user, habit_id, start, end) -> dict:
    """Série + eventos de mudança de UM hábito no range — read-only, não-semeador (AC2).

    ``Habit.objects.get(id=habit_id)`` deixa o ``DoesNotExist`` subir para a view virar
    404 (cross-tenant também = 404, via auto-scope). ``points`` = uma query em
    ``habit_day_entries`` (por dia ``{date, value, effective_weight, day_type}``); dias
    sem linha são **omitidos** (o eixo X é o range; a ausência = lacuna no gráfico).
    ``events`` = diff das ``habit_versions`` consecutivas em ordem **ascendente** por
    ``effective_from`` (o ``Meta.ordering`` do model é descendente — o ``order_by``
    explícito é obrigatório), cada transição = marcador datado; só entram eventos cujo
    ``effective_from`` cai no range (a primeira versão = 'created' só aparece se seu
    ``effective_from`` estiver no range). ``day_types`` do range inteiro (para o
    sombreamento até em dias-lacuna). O multiplicador **nunca** vira evento (AD-11).
    """
    _validate_range(start, end)

    habit = Habit.objects.select_related("group").get(id=habit_id)

    point_rows = HabitDayEntry.objects.filter(
        habit_id=habit_id, date__range=(start, end)
    ).order_by("date")
    points = [
        {
            "date": e.date,
            "value": e.value,
            "effective_weight": _effective_weight(e),
            "day_type": e.day_type,
        }
        for e in point_rows
    ]

    versions = list(
        HabitVersion.objects.filter(habit_id=habit_id).order_by(
            "effective_from", "created_at"
        )
    )
    events = []
    prev = None
    for version in versions:
        changes = _diff_versions(prev, version)
        if changes and start <= version.effective_from <= end:
            events.append({"effective_from": version.effective_from, "changes": changes})
        prev = version

    dtypes = resolve_day_types_range(user, start, end)
    day_types = [{"date": d, "day_type": dtypes[d]} for d in sorted(dtypes)]

    return {"habit": habit, "points": points, "events": events, "day_types": day_types}
