"""Horizonte do Future Log (Story 14.7, AC2 — M08).

Módulo próprio, no molde de ``services/density.py``: **projeção de leitura**, não
materialização. A diferença em relação a ``FutureLogView`` (o endpoint legado,
intocado por esta story) é estrutural, não cosmética:

- ``FutureLogView`` devolve **só** os meses que já têm item
  (``.filter(root_task_count__gt=0)``) — não conhece horizonte fixo, mês vazio
  nem a separação horizonte/distante;
- aqui o horizonte é **scaffolding**: os 8 meses seguintes ao âncora existem
  SEMPRE, inclusive com ``task_count: 0``, porque o trilho da superfície nova
  mostra os oito o tempo todo (M08; mockup ``key-future-log.html`` frame A).

**Leitura 100% pura.** Nenhum ``get_or_create``, nenhuma escrita, nenhuma
materialização: este serviço varre um horizonte inteiro de meses que na maioria
das vezes ainda não existem como linha em ``monthly_log``, e materializá-los
criaria oito logs por consulta. (Contraste deliberado com ``MonthlyLogView.get``,
que materializa o mês consultado — comportamento já vigente e aceito para o
BOARD desde a 14.1, mas inaceitável aqui.)
"""

from datetime import date

from django.db.models import Count, Q

from bujo.models import CycleStatus, MonthlyLog
from bujo.services.cycles import add_months
from core.calendar import today_for

#: Tamanho do horizonte rolante (DESIGN.md ``{components.future-board}``:
#: ``horizon-months: '8'``). O cliente lê o mesmo número do token
#: ``futureBoard.horizonMonths`` — nenhum dos dois lados escreve o literal solto.
HORIZON_MONTHS = 8


def _anchor_month_first(user) -> date:
    """Âncora do horizonte: ``max(monthly ACTIVE, mês corrente)``.

    O ``max(...)`` é um **piso, nunca um teto**, e essa assimetria é a razão de
    ele existir:

    - o gate ``date_reached`` de *Iniciar mês* (``today >= planning.month_first``,
      ``services/cycles.py``) impede que um ``active`` fique À FRENTE do mês
      corrente — então o ``max`` nunca "empurra" o horizonte para longe;
    - nada impede, porém, que o ``active`` fique ATRÁS do corrente durante a
      regularização de meses pulados (prova existente:
      ``test_ciclo_monthly_dois_meses_pulados_exigem_materializacao_sequencial``).
      Sem o piso, o horizonte começaria em um mês ``<=`` corrente.

    O piso garante a invariante da superfície: **todo mês do horizonte (e todo
    mês distante) é estritamente maior que o mês corrente** — que é exatamente a
    condição que ``TaskMigrateView`` exige para ``destination: 'future'``
    (``month_first <= current_month_first`` responde 400 "Use 'month' para o mês
    corrente"). Sem ele, esta superfície herdaria o bug CRÍTICO que o code-review
    da Story 14.6 encontrou em ``destinationForTarget()``.
    """
    current_month_first = today_for(user).replace(day=1)
    active = (
        MonthlyLog.objects.filter(status=CycleStatus.ACTIVE)
        .order_by("month_first")
        .first()
    )
    if active is None:
        return current_month_first
    return max(active.month_first, current_month_first)


def future_log_horizon(*, user) -> dict:
    """Horizonte de 8 meses + meses distantes com item, para o trilho do M08.

    Devolve ``{"anchor_month_first", "horizon", "distant"}``, onde ``horizon`` tem
    **exatamente** ``HORIZON_MONTHS`` entradas consecutivas e ascendentes
    começando em ``âncora + 1 mês``, e ``distant`` lista todo ``monthly_log`` além
    do último mês do horizonte que tenha ``task_count > 0``, em ordem ascendente.

    ``task_count`` conta **tarefas raiz** de **qualquer status** — mesma regra que
    ``FutureLogView`` já usa (``Count("tasks", filter=Q(tasks__parent_task__isnull
    =True))``). É o que mantém a contagem do trilho igual ao número de linhas da
    coluna de foco depois de um "definir dia", que deixa origem terminal **e**
    sucessor no mesmo mês.
    """
    anchor = _anchor_month_first(user)
    horizon_months = [add_months(anchor, offset) for offset in range(1, HORIZON_MONTHS + 1)]
    last_horizon_month = horizon_months[-1]

    # UMA query agregada sobre `monthly_log` cobre horizonte E distantes: tudo
    # estritamente após o âncora. A projeção nos 8 slots acontece em Python — o
    # horizonte é scaffolding, então um mês sem linha no banco não pode sumir da
    # resposta (que é o que um `values_list` puro faria).
    counts = {
        row["month_first"]: row["root_task_count"]
        for row in MonthlyLog.objects.filter(month_first__gt=anchor)
        .annotate(root_task_count=Count("tasks", filter=Q(tasks__parent_task__isnull=True)))
        .values("month_first", "root_task_count")
    }

    return {
        "anchor_month_first": anchor,
        "horizon": [
            {"month_first": month_first, "task_count": counts.get(month_first, 0)}
            for month_first in horizon_months
        ],
        "distant": [
            {"month_first": month_first, "task_count": task_count}
            for month_first, task_count in sorted(counts.items())
            if month_first > last_horizon_month and task_count > 0
        ],
    }
