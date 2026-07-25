"""Densidade real de Weekly e Monthly (EXPERIENCE.md M06 L241 / M07 L299).

Módulo próprio, e não um "conserto" de ``TaskDensityView``: são **dois contratos
distintos** que coexistem de propósito. O legado (``GET /api/bujo/task-density/``,
Story 11.3) conta só raízes, sem segmentação por status, somando as **três**
fontes de "tarefa num dia D" (daily + weekly + monthly) — é consumido por
``frontend/src/features/bujo/api.ts`` e fica intocado em rota, forma e semântica.

A densidade **desta** story é a densidade dos rails de ritual, e as regras são o
oposto em quase tudo:

- **só materializado, só no container-alvo** — nada de projetar recorrentes ainda
  não alocados, nada de somar tarefas de outros containers. "Recorrentes não
  alocados nunca aparecem como projeção" é o requisito, e ele se cumpre por
  construção: um template não é uma ``Task``, então não há de onde vir;
- **INCLUI subtarefas** — sem ``parent_task__isnull=True``. É o oposto de todas
  as superfícies de listagem (e de ``TaskDensityView``), de propósito: densidade
  mede carga real do período, e uma subtarefa é trabalho;
- **segmenta os 6 status**, com as seis chaves sempre presentes (zeros inclusive);
- **conta registros, não linhagens**: origem ``migrated`` e sucessor contam
  separadamente, sem deduplicação (M06 L223);
- **grade completa**: todos os dias do período, mesmo vazios, mais a faixa
  ``undated`` (``scheduled_date IS NULL`` — a representação de "Sem dia definido").

Aceita alvo em **qualquer** estado (``planning``/``active``/``finalized``/``NULL``)
e devolve a grade zerada quando o log não existe — decisão deliberada para que as
Stories 14.5/14.6 (boards em ``active``) e 14.10 (Arquivo, ``finalized``) reusem
este mesmo serviço. Como todo módulo de leitura desta onda, **nunca materializa
log**: ``objects.filter(...).first()``, jamais ``get_or_create_*_log``.
"""

import calendar as _calendar
from datetime import date, timedelta

from django.db.models import Count

from bujo.models import MonthlyLog, TaskStatus, WeeklyLog

# A faixa "Sem dia definido" tem chave própria no envelope (não é um dia da grade
# e não é um status): `scheduled_date IS NULL` é a representação de "sem dia" no
# model, não uma data-sentinela.
UNDATED = "undated"


def _empty_cell() -> dict:
    """Célula da grade com as 6 chaves de ``TaskStatus`` sempre presentes.

    Zeros explícitos em vez de chaves ausentes: o consumidor não deve precisar de
    um ``?? 0`` por status, e um dia sem tarefa nenhuma tem que ser distinguível
    de um dia que a resposta esqueceu.
    """
    return {"total": 0, "by_status": {status: 0 for status in TaskStatus.values}}


def _fill(grid: dict, log) -> dict:
    """Distribui as contagens do container nas células já criadas.

    Uma única query agrupando por ``scheduled_date`` **e** ``status``. ``log``
    ``None`` (alvo nunca materializado) devolve a grade intacta — zerada.
    """
    if log is None:
        return grid
    rows = (
        log.tasks.values("scheduled_date", "status")
        .annotate(count=Count("id"))
        .order_by()  # limpa o `Meta.ordering` de Task (order_index quebraria o GROUP BY)
    )
    for row in rows:
        key = row["scheduled_date"] or UNDATED
        cell = grid.get(key)
        if cell is None:
            # Tarefa com `scheduled_date` fora do período do próprio container.
            # É alcançável, ao contrário do que seria confortável supor: a criação
            # valida a data contra o período (`WeeklyTaskCreateSerializer` /
            # `MonthlyTaskCreateSerializer`), mas o `PATCH /api/bujo/tasks/<id>/`
            # aceita qualquer `scheduled_date` (`TaskUpdateSerializer` →
            # `update_task` → `_apply_fields`, sem revalidar o período).
            # Ignorar é a leitura CONSISTENTE com a superfície legada: nem
            # `WeeklyLogView` (`days` por `scheduled_date=day` + `unscheduled` por
            # `IS NULL`) nem `MonthlyLogView` mostram esse registro. Somá-lo a um
            # dia errado, inventar um dia fora da grade ou jogá-lo em `undated`
            # (ele TEM dia) seriam as três maneiras de mentir sobre isso.
            continue
        cell["by_status"][row["status"]] += row["count"]
        cell["total"] += row["count"]
    return grid


def _envelope(grid: dict, *, days: list) -> dict:
    """Serializa a grade na ordem do período + ``undated``, com o total geral."""
    day_cells = [{"date": day, **grid[day]} for day in days]
    undated = grid[UNDATED]
    return {
        "days": day_cells,
        "undated": undated,
        "total": sum(cell["total"] for cell in day_cells) + undated["total"],
    }


def compute_week_density(*, user, week_start) -> dict:
    """Densidade do Weekly-alvo: os **7** dias da semana (vazios visíveis) + ``undated``."""
    days = [week_start + timedelta(days=offset) for offset in range(7)]
    grid = {key: _empty_cell() for key in [*days, UNDATED]}
    log = WeeklyLog.objects.filter(week_start=week_start).first()
    return _envelope(_fill(grid, log), days=days)


def compute_month_density(*, user, month_first) -> dict:
    """Densidade do Monthly-alvo: **todos** os dias reais do mês + ``undated``.

    28–31 dias conforme o mês, fevereiro bissexto incluído — via
    ``calendar.monthrange`` da stdlib, então o caso bissexto cai fora por
    construção e não por um ``if year % 4``.
    """
    day_count = _calendar.monthrange(month_first.year, month_first.month)[1]
    days = [date(month_first.year, month_first.month, day) for day in range(1, day_count + 1)]
    grid = {key: _empty_cell() for key in [*days, UNDATED]}
    log = MonthlyLog.objects.filter(month_first=month_first).first()
    return _envelope(_fill(grid, log), days=days)
