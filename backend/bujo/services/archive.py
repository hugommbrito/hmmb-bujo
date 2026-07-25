"""Fechamento de ciclos e Arquivo (FR-1.10, FR-1.13; AD-28 item 5).

Fechamento tem DOIS critérios desde a Story 14.1, e a autoridade mudou:

1. **Estado explícito** — ``status = finalized``, gravado pelo ritual de finalizar
   (``services/cycles.py``). É a autoridade para todo ciclo dentro do regime
   operacional. Antes desta story o módulo declarava "fechamento é sempre
   COMPUTADO na leitura, nunca armazenado": isso **deixou de valer** para o regime
   operacional, porque a derivação não conseguia representar um ciclo finalizado
   VAZIO (ver abaixo).
2. **Derivação por conteúdo** — ``is_container_closed``, mantida INTACTA como
   fallback read-only dos ciclos legados ``status IS NULL``, que nunca passaram por
   ritual. Zero perda de histórico, zero backfill especulativo.

``is_cycle_closed`` escolhe o critério pelo REGIME do ciclo (não aplica os dois ao
mesmo ciclo) e é o que todo consumidor deve chamar. As duas razões da mudança: a
derivação exige ``total_tasks > 0``, então um ciclo finalizado e vazio devolveria
``False`` — ficaria mutável e fora do Arquivo; e, na direção oposta, a derivação
aplicada a um ciclo DENTRO do regime fecharia um alvo em planejamento assim que
sua última tarefa fosse disposta, contra M06/M07 ("só ``finalized`` é readonly").

Nada aqui é calculado por job/cron — a filosofia de "sem automação" da AD-04
item 5 permanece: só o ritual explícito do usuário grava ``finalized``.
"""

from django.db.models import Count, Q

from bujo.models import CycleStatus, MonthlyLog, Task, WeeklyLog

UNDISPOSED = (Task.Status.PENDING, Task.Status.STARTED)


def is_container_closed(log) -> bool:
    """`log`: instância de `WeeklyLog` ou `MonthlyLog` (ambas expõem
    `.tasks`, related_name da FK em `Task`). Fechado = tem >=1 tarefa E
    nenhuma tarefa da subárvore completa (raiz OU subtarefa — a query não
    filtra por `parent_task`) está `pending`/`started` (FR-1.10: um pai
    com filho pendente não fecha)."""
    tasks = log.tasks.all()
    return tasks.exists() and not tasks.filter(status__in=UNDISPOSED).exists()


def is_cycle_closed(log) -> bool:
    """Autoridade de "ciclo fechado" (AD-28 item 5) — o que os consumidores chamam.

    Um critério POR REGIME, nunca os dois sobre o mesmo ciclo:

    - ciclo **dentro** do regime operacional (`status` não-`NULL`): fecha se, e
      somente se, o ritual gravou `finalized`. A derivação por conteúdo NÃO se
      aplica aqui — ela fecharia um alvo em planejamento (ou o ciclo em andamento)
      no instante em que a última tarefa fosse disposta, e M06/M07 são explícitos:
      "Um Weekly Em planejamento permite criar, editar, reordenar, migrar, iniciar
      e concluir tarefas"; só `finalized` é readonly, e "a data do calendário não
      finaliza uma semana automaticamente".
    - ciclo **fora** do regime (`status IS NULL`, legado do Épico 4): a derivação
      permanece INTACTA como fallback read-only — zero perda de histórico, zero
      backfill especulativo (AD-28 item 5).

    Para todo ciclo que já existia antes da Story 14.1 o resultado é idêntico ao
    da derivação (o backfill deixou `NULL` exatamente os ciclos que ela governava),
    e um ciclo `finalized` **vazio** — que a derivação não pegava — passa a contar.
    """
    if log.status is not None:
        return log.status == CycleStatus.FINALIZED
    return is_container_closed(log)


# Mesmo critério-por-regime de `is_cycle_closed`, expresso em SQL. Um único
# queryset por tabela: os dois ramos são mutuamente exclusivos (`status` não-`NULL`
# vs `NULL`), então a união sai sem duplicata por construção, sem `distinct()`.
_CLOSED_BY_EITHER = Q(status=CycleStatus.FINALIZED) | Q(
    status__isnull=True, total__gt=0, undisposed=0
)


def list_closed_cycles(*, user):
    """Semanas e meses fechados do tenant (auto-escopado pelo manager,
    `user` mantido por consistência posicional com `get_or_create_*` em
    `services/logs.py`), mais recentes primeiro.

    `total_tasks=0` (log nunca populado) continua NUNCA contando como fechado
    **pela derivação** — mas um ciclo `finalized` vazio entra pelo estado, porque
    o ritual de finalizar é declaração explícita do usuário (AD-28 item 5). Ciclos
    dentro do regime e não finalizados (`planning`/`active`) NÃO entram, mesmo com
    todo o conteúdo disposto: só o ritual fecha (ver `is_cycle_closed`).
    """
    closed_weekly = WeeklyLog.objects.annotate(
        total=Count("tasks"),
        undisposed=Count("tasks", filter=Q(tasks__status__in=UNDISPOSED)),
    ).filter(_CLOSED_BY_EITHER)
    closed_monthly = MonthlyLog.objects.annotate(
        total=Count("tasks"),
        undisposed=Count("tasks", filter=Q(tasks__status__in=UNDISPOSED)),
    ).filter(_CLOSED_BY_EITHER)

    entries = [
        {"type": "weekly", "week_start": log.week_start, "month_first": None}
        for log in closed_weekly
    ] + [
        {"type": "monthly", "week_start": None, "month_first": log.month_first}
        for log in closed_monthly
    ]
    entries.sort(key=lambda e: e["week_start"] or e["month_first"], reverse=True)
    return entries
