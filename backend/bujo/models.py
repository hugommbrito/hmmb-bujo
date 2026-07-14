"""Daily Log e agregado ``Task`` (FR-1.3/1.4/1.5, AD-02, AD-03).

Schema congelado pela Story 3.1: os campos de linhagem (``migrated_to_task``,
``migration_count``, ``parent_task``, ``source_template_id``) já existem aqui,
nulos/inertes, para que o Épico 4 consuma sem precisar alterar o schema.
"""

from django.db import models

from core.models import TenantModel


class Log(TenantModel):
    """Daily Log — um por ``(user, log_date)``, materializado sob demanda."""

    log_date = models.DateField()

    class Meta:
        db_table = "logs"
        constraints = [
            models.UniqueConstraint(
                fields=["user_id", "log_date"], name="uniq_log_user_id_log_date"
            ),
        ]


class WeeklyLog(TenantModel):
    """Weekly Log — um por (user, week_start), week_start SEMPRE segunda (AD-05)."""

    week_start = models.DateField()
    body = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "weekly_log"
        constraints = [
            models.UniqueConstraint(
                fields=["user_id", "week_start"], name="uniq_weekly_log_user_id_week_start"
            ),
            models.CheckConstraint(
                condition=models.Q(week_start__iso_week_day=1), name="week_start_is_monday"
            ),
        ]


class MonthlyLog(TenantModel):
    """Monthly Log — um por (user, month_first), month_first SEMPRE dia 1 (AD-05).

    O Future Log NÃO é uma entidade separada: é o conjunto dos MonthlyLog de
    meses futuros (ver Dev Notes "Future Log = monthly_log futuro").
    """

    month_first = models.DateField()
    body = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "monthly_log"
        constraints = [
            models.UniqueConstraint(
                fields=["user_id", "month_first"], name="uniq_monthly_log_user_id_month_first"
            ),
            models.CheckConstraint(
                condition=models.Q(month_first__day=1), name="month_first_is_day_one"
            ),
        ]


class TaskStatus(models.TextChoices):
    """Definida no nível do módulo (não aninhada em ``Task``): uma classe
    aninhada em ``Meta`` não enxerga o namespace de ``Task`` (só o do módulo),
    então o `CheckConstraint` abaixo não conseguiria referenciar
    ``Task.Status.values`` se ``Status`` fosse aninhada. Exposta como
    ``Task.Status`` logo abaixo para manter o acesso ``Task.Status.PENDING``.
    """

    PENDING = "pending"
    STARTED = "started"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    MIGRATED = "migrated"
    POSTPONED = "postponed"


class Task(TenantModel):
    Status = TaskStatus

    class Eisenhower(models.TextChoices):
        URGENT_IMPORTANT = "ui"
        URGENT = "u"
        IMPORTANT = "i"
        NONE = "none"

    class Category(models.TextChoices):
        TEAL = "teal"
        PURPLE = "purple"
        PINK = "pink"
        YELLOW = "yellow"
        GREEN = "green"
        BLUE = "blue"

    log = models.ForeignKey(
        Log, null=True, blank=True, on_delete=models.CASCADE, related_name="tasks"
    )
    weekly_log = models.ForeignKey(
        WeeklyLog, null=True, blank=True, on_delete=models.CASCADE, related_name="tasks"
    )
    monthly_log = models.ForeignKey(
        MonthlyLog, null=True, blank=True, on_delete=models.CASCADE, related_name="tasks"
    )
    # Dia específico opcional dentro de um weekly/monthly log. null = "só o mês/semana,
    # sem dia" (Future Log parcial, FR-1.2). Em daily log fica null (o dia é o do log).
    scheduled_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.PENDING
    )
    eisenhower = models.CharField(  # noqa: DJ001 - AC exige nulável (nenhum valor definido, não string vazia)
        max_length=8, choices=Eisenhower.choices, null=True, blank=True
    )
    category = models.CharField(  # noqa: DJ001 - ausência de categoria é um valor válido (ver Dev Notes)
        max_length=8, choices=Category.choices, null=True, blank=True
    )
    order_index = models.FloatField()
    title = models.CharField(max_length=500)
    description = models.TextField(null=True, blank=True)  # noqa: DJ001 - AC exige nulável (ver Dev Notes/AD-03)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Congelados/inertes (Épico 4 — linhagem de migração e subtarefas).
    migrated_to_task = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="migrated_from",
    )
    migration_count = models.PositiveIntegerField(default=0)
    parent_task = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="subtasks",
    )
    # Nome do campo Python SEM `_id` — Django adiciona o sufixo à coluna
    # automaticamente, então a coluna continua `source_template_id`, igual ao
    # nome usado desde a 3.1 (mesma convenção de parent_task/migrated_to_task).
    # "RecurringTaskTemplate" como string: a classe só é definida abaixo de Task.
    source_template = models.ForeignKey(
        "RecurringTaskTemplate",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="instances",
    )

    class Meta:
        db_table = "tasks"
        ordering = ["order_index"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=TaskStatus.values),
                name="task_status_valid",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(log__isnull=False, weekly_log__isnull=True, monthly_log__isnull=True)
                    | models.Q(log__isnull=True, weekly_log__isnull=False, monthly_log__isnull=True)
                    | models.Q(log__isnull=True, weekly_log__isnull=True, monthly_log__isnull=False)
                ),
                name="task_exactly_one_log",
            ),
        ]


class RecurringTaskTemplate(TenantModel):
    """Catálogo de recorrentes (AD-08) — tabela separada de `Task`, sem
    `status`/`log_id`/ciclo de vida: um template nunca migra, só é colocado
    (placement manual, sem auto-placement) e vira uma `Task` snapshot."""

    class RecurrenceGroup(models.TextChoices):
        WEEKLY = "weekly"
        MONTHLY = "monthly"
        ANNUAL = "annual"

    title = models.CharField(max_length=500)
    description = models.TextField(null=True, blank=True)  # noqa: DJ001 - mesma semântica nulável de Task.description
    eisenhower = models.CharField(  # noqa: DJ001 - default copiado no placement; ausência é valor válido
        max_length=8, choices=Task.Eisenhower.choices, null=True, blank=True
    )
    recurrence_group = models.CharField(max_length=8, choices=RecurrenceGroup.choices)
    # livre, NÃO parseado (addendum AD-08 item 4) — só exibição
    recurrence_text = models.TextField()
    # booleano simples, SEM versionamento (AD-08 item 6 — YAGNI consciente)
    active = models.BooleanField(default=True)

    class Meta:
        db_table = "recurring_task_templates"
