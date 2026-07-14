"""Fechamento de ciclos e Arquivo (FR-1.10, FR-1.13).

Fechamento é sempre COMPUTADO na leitura, nunca armazenado nem calculado
por job/cron — mesma filosofia de "sem automação" da AD-04 item 5,
generalizada aqui de migração para fechamento de ciclo.
"""

from django.db.models import Count, Q

from bujo.models import MonthlyLog, Task, WeeklyLog

UNDISPOSED = (Task.Status.PENDING, Task.Status.STARTED)


def is_container_closed(log) -> bool:
    """`log`: instância de `WeeklyLog` ou `MonthlyLog` (ambas expõem
    `.tasks`, related_name da FK em `Task`). Fechado = tem >=1 tarefa E
    nenhuma tarefa da subárvore completa (raiz OU subtarefa — a query não
    filtra por `parent_task`) está `pending`/`started` (FR-1.10: um pai
    com filho pendente não fecha)."""
    tasks = log.tasks.all()
    return tasks.exists() and not tasks.filter(status__in=UNDISPOSED).exists()


def list_closed_cycles(*, user):
    """Semanas e meses fechados do tenant (auto-escopado pelo manager,
    `user` mantido por consistência posicional com `get_or_create_*` em
    `services/logs.py`), mais recentes primeiro. `total_tasks=0` (log
    nunca populado) NUNCA conta como fechado — só ciclos com conteúdo
    disposto entram no Arquivo."""
    closed_weekly = WeeklyLog.objects.annotate(
        total=Count("tasks"),
        undisposed=Count("tasks", filter=Q(tasks__status__in=UNDISPOSED)),
    ).filter(total__gt=0, undisposed=0)
    closed_monthly = MonthlyLog.objects.annotate(
        total=Count("tasks"),
        undisposed=Count("tasks", filter=Q(tasks__status__in=UNDISPOSED)),
    ).filter(total__gt=0, undisposed=0)

    entries = [
        {"type": "weekly", "week_start": log.week_start, "month_first": None}
        for log in closed_weekly
    ] + [
        {"type": "monthly", "week_start": None, "month_first": log.month_first}
        for log in closed_monthly
    ]
    entries.sort(key=lambda e: e["week_start"] or e["month_first"], reverse=True)
    return entries
