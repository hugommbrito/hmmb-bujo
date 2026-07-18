"""Sistema de Hábitos — camada de configuração prospectiva (FR-2.x, AD-06, AD-10).

Esta story (6.1) implementa APENAS a configuração prospectiva de AD-06
(``habit_versions``), não o snapshot realizado (``habit_day_entries``, que é 6.2).

Regra de ouro (AD-06 item 6): **mudança de config = INSERT de versão** — o estado
de um hábito no dia D é a ``HabitVersion`` com ``max(effective_from) <= D``. Peso,
``active``, ``meta`` e ``bonus`` são versionados (afetam a contribuição histórica);
``name``/``emoticon``/``group``/``type`` são identidade/cosmético (UPDATE direto, não
versionado). ``type`` é imutável após a criação.
"""

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
