"""Diário de Gratidão (FR-4.1, UJ-6) — o domínio MAIS SIMPLES do MVP.

Um **log plano por data com N linhas/dia** (mais leve até que Saúde). Divergência
explícita das máquinas dos épicos anteriores (o callout da story impediu
over-engineering-por-analogia em dois épicos seguidos):

- **NÃO versiona** (≠ Hábitos/Medicamentos — nada de ``*_versions``/``effective_from``).
- **NÃO materializa/semeia** (≠ camada realizada da 8.2 — sem ``seed_*_day``, sem
  ``UniqueConstraint`` de dia, sem read-model derivado de snapshot).
- **Sem denominador/score/gráfico/streak/insight/IA** (o resumo por IA é FR-4.3,
  [BACKLOG], fora do MVP).

O modelo é literalmente ``GratitudeEntry(id, user_id, date, text, created_at)``.
Domínio independente: sem FK (nem para ``bujo``, nem para ``health``).
"""

from django.db import models

from core.models import TenantModel


class GratitudeEntry(TenantModel):
    """Uma entrada de gratidão em texto livre associada a uma data (AC1/AC2/AC3).

    Herda ``TenantModel`` → PK UUID + ``user_id`` UUIDField plano (indexado) +
    managers auto-escopados. ``date`` é uma coluna ``DATE`` pura (o "dia" do ritual);
    ``created_at`` é ``timestamptz`` de auditoria (``auto_now_add``, exibido como hora
    na borda). **Sem ``UniqueConstraint`` de dia** — cardinalidade N-linhas-por-data
    (AC2), como as linhas ``ad_hoc`` de medicamentos, não como ``health_logs``.
    """

    date = models.DateField(db_index=True)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gratitude_entries"
        ordering = ["created_at"]  # cronológico ascendente (AC3/D1); SEM UniqueConstraint (AC2)
