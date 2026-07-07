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

    log = models.ForeignKey(Log, on_delete=models.CASCADE, related_name="tasks")
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
    source_template_id = models.UUIDField(null=True, blank=True)

    class Meta:
        db_table = "tasks"
        ordering = ["order_index"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=TaskStatus.values),
                name="task_status_valid",
            ),
        ]
