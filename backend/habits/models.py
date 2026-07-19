"""Sistema de Hábitos — camada de configuração prospectiva (FR-2.x, AD-06, AD-10).

Esta story (6.1) implementa APENAS a configuração prospectiva de AD-06
(``habit_versions``), não o snapshot realizado (``habit_day_entries``, que é 6.2).

Regra de ouro (AD-06 item 6): **mudança de config = INSERT de versão** — o estado
de um hábito no dia D é a ``HabitVersion`` com ``max(effective_from) <= D``. Peso,
``active``, ``meta`` e ``bonus`` são versionados (afetam a contribuição histórica);
``name``/``emoticon``/``group``/``type`` são identidade/cosmético (UPDATE direto, não
versionado). ``type`` é imutável após a criação.
"""

from decimal import Decimal

from django.db import models

from core.models import TenantModel


class HabitType(models.TextChoices):
    """Definida no nível do módulo (não aninhada em ``Habit``): uma classe
    aninhada não é visível ao ``CheckConstraint`` de ``Meta`` (mesmo motivo de
    ``bujo.models.TaskStatus``). Exposta como ``Habit.Type`` para manter o
    acesso ``Habit.Type.BOOLEAN``.
    """

    BOOLEAN = "boolean"
    NUMERIC = "numeric"


class DayType(models.TextChoices):
    """Tipo de dia congelado no snapshot (AD-10, Story 6.3). No nível do módulo
    (como ``HabitType``) para ser visível ao ``CheckConstraint`` de ``Meta``.

    Três valores para ``HabitDayEntry.day_type``; a config de multiplicador
    (``HabitGroupDayMultiplier``) só usa ``WEEKEND``/``HOLIDAY`` (``WEEKDAY`` é
    1.0 implícito, nunca armazenado).
    """

    WEEKDAY = "weekday"
    WEEKEND = "weekend"
    HOLIDAY = "holiday"


class HabitGroup(TenantModel):
    """Grupo de hábitos (AD-10). ``display_order`` já no schema, sem UI de reorder
    nesta story (default sequencial)."""

    name = models.CharField(max_length=200)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "habit_groups"
        ordering = ["display_order", "name"]


class Habit(TenantModel):
    """Identidade do hábito (não versionada). ``type`` imutável após a criação."""

    Type = HabitType

    name = models.CharField(max_length=200)
    emoticon = models.CharField(max_length=16, blank=True)
    group = models.ForeignKey(HabitGroup, on_delete=models.PROTECT, related_name="habits")
    type = models.CharField(max_length=8, choices=HabitType.choices)
    # Unidade de exibição do hábito numérico (ex.: "passos", "min"). Identidade
    # (não versionada, cosmético como name/emoticon) — só numéricos a usam, mas
    # o campo mora em Habit por ser identidade. Story 6.2, decisão da unit.
    unit = models.CharField(max_length=32, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "habits"
        ordering = ["group", "name"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(type__in=HabitType.values),
                name="habit_type_valid",
            ),
        ]


class HabitVersion(TenantModel):
    """Configuração prospectiva versionada (AD-06). Cada mudança de
    ``weight``/``active``/``meta``/``bonus`` é um INSERT com ``effective_from = hoje``.

    Também herda ``TenantModel`` (ganha ``user_id`` denormalizado + auto-scope +
    cobertura do gate de isolamento) — reconciliação da AD-06 com §6.1 (toda tabela
    tenant indexa ``user_id``). Uma versão por ``(habit, effective_from)``: a segunda
    mudança do mesmo dia faz UPDATE na versão do dia (ver Dev Notes da story 6.1).
    """

    habit = models.ForeignKey(Habit, on_delete=models.CASCADE, related_name="versions")
    weight = models.DecimalField(max_digits=6, decimal_places=2)
    active = models.BooleanField(default=True)
    # meta/bonus só se aplicam a hábitos numéricos (null para booleanos).
    meta = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    bonus = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    effective_from = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "habit_versions"
        ordering = ["habit", "-effective_from", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["habit", "effective_from"],
                name="uniq_habit_version_per_day",
            ),
        ]


class HabitGroupDayMultiplier(TenantModel):
    """Config prospectiva do multiplicador de peso por ``(grupo, tipo de dia)``
    (AD-10, Story 6.3). Espelha ``HabitVersion``: cada mudança é um INSERT com
    ``effective_from = hoje``; o multiplicador vigente em D é a linha com
    ``max(effective_from) <= D`` para aquele ``(grupo, day_type)``.

    Só ``weekend``/``holiday`` são armazenados (``weekday`` = 1.0 implícito).
    Grupo sem config para o tipo do dia = 1.0. Herda ``TenantModel`` (UUID PK +
    ``user_id`` denormalizado + auto-scope + gate de isolamento).
    """

    group = models.ForeignKey(
        HabitGroup, on_delete=models.CASCADE, related_name="day_multipliers"
    )
    day_type = models.CharField(
        max_length=8,
        choices=[
            (DayType.WEEKEND, DayType.WEEKEND.label),
            (DayType.HOLIDAY, DayType.HOLIDAY.label),
        ],
    )
    multiplier = models.DecimalField(max_digits=4, decimal_places=2)
    effective_from = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "habit_group_day_multipliers"
        ordering = ["group", "day_type", "-effective_from"]
        constraints = [
            models.UniqueConstraint(
                fields=["group", "day_type", "effective_from"],
                name="uniq_group_day_multiplier_per_day",
            ),
            models.CheckConstraint(
                condition=models.Q(day_type__in=[DayType.WEEKEND, DayType.HOLIDAY]),
                name="group_multiplier_day_type_valid",
            ),
        ]


class HabitDayEntry(TenantModel):
    """Snapshot realizado, congelado e editável por dia (AD-06 — camada da 6.2).

    Uma linha por hábito ativo por dia, materializada na 1ª abertura do dia via
    ``seed_habit_day`` (gap-fill idempotente), semeando ``*_at_time`` da versão
    vigente naquele dia (``current_version_of``). ``value`` nulo = não-feito;
    booleano marcado = ``1``. Espelha exatamente as escalas de ``HabitVersion``.

    Distinção crítica (AD-06 item 6): mudar config = INSERT de ``HabitVersion``
    (prospectivo, não sangra); corrigir um dia passado = UPDATE **só nesta linha**
    (avulso, não toca ``habit_versions``, só aquele dia recalcula).

    Também herda ``TenantModel`` (UUID PK + ``user_id`` denormalizado + auto-scope):
    a AD-06 desenha PK composta ``(user_id, habit_id, date)``, mas o projeto exige
    UUID PK + ``user_id`` indexado em toda tabela tenant (§6.1/AD-12), então a
    unicidade vira ``UniqueConstraint(habit, date)`` — mesma reconciliação que a
    6.1 fez para ``habit_versions``.

    Camada de ritmo (6.3, AD-10): ``day_type`` + ``multiplier_at_time`` são
    congelados **separados** do ``weight_at_time`` base na 1ª abertura. A completude
    usa ``peso_efetivo = weight_at_time × multiplier_at_time``; manter os fatores
    separados habilita transparência na UI, a distinção evento-vs-ritmo (AD-11) e o
    override avulso de um dia. Os defaults (``weekday``/``1.00``) backfillam as
    linhas materializadas na 6.2 com a semântica correta ("sem multiplicador").
    """

    habit = models.ForeignKey(Habit, on_delete=models.CASCADE, related_name="day_entries")
    date = models.DateField()
    # nulo = não-feito; booleano marcado = 1. Espelha as escalas de HabitVersion.
    value = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    weight_at_time = models.DecimalField(max_digits=6, decimal_places=2)
    # meta/bonus só se aplicam a hábitos numéricos (null para booleanos).
    meta_at_time = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    bonus_at_time = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    # Camada de ritmo (6.3): tipo de dia + multiplicador do grupo vigente em D,
    # congelados separados do weight_at_time base. peso_efetivo = weight × multiplier.
    day_type = models.CharField(
        max_length=8, choices=DayType.choices, default=DayType.WEEKDAY
    )
    multiplier_at_time = models.DecimalField(
        max_digits=4, decimal_places=2, default=Decimal("1.00")
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "habit_day_entries"
        ordering = ["date", "habit"]
        constraints = [
            models.UniqueConstraint(
                fields=["habit", "date"],
                name="uniq_habit_day_entry_per_day",
            ),
        ]
