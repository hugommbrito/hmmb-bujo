"""Brain Dump — caixa de entrada sem data (FR-5, AD-15).

`target_log` é só uma DICA opcional guardada no item, escolhida no formulário
de captura — NUNCA cria a Task de destino na hora (ver Dev Notes "target_log
é dica, não placement"). A criação real da Task só acontece no processamento
manual (Task 3, AC #2).
"""

from django.db import models

from core.models import TenantModel


class BrainDumpItem(TenantModel):
    class TargetLog(models.TextChoices):
        TODAY = "today"
        WEEK = "week"
        MONTH = "month"
        FUTURE = "future"

    title = models.CharField(max_length=500)
    description = models.TextField(null=True, blank=True)  # noqa: DJ001 - ausência é valor válido (mesma semântica de Task.description)
    # noqa: DJ001 - null = "Brain Dump" (sem dica de destino); mesmo padrão nulável de Task.eisenhower/Task.category (sem CheckConstraint — ver Dev Notes)
    target_log = models.CharField(max_length=8, choices=TargetLog.choices, null=True, blank=True)  # noqa: DJ001
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "brain_dump_items"
        ordering = ["created_at"]
