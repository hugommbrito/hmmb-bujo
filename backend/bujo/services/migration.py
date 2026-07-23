"""Migração diária de tarefas pendentes (FR-1.7, AD-03, AD-08 item 11, §6.2).

`migrate_task` não duplica `order_index`/validação de transição — reaproveita
`create_task`/`update_task` (`services/tasks.py`) e `transition_task`
(`services/state_machine.py`) tal como já existem.
"""

from django.db import transaction

from bujo.models import Task
from bujo.services.logs import (
    get_or_create_daily_log,
    get_or_create_monthly_log,
    get_or_create_weekly_log,
)
from bujo.services.state_machine import transition_task
from bujo.services.tasks import create_task, set_lineage_fields
from core.calendar import today_for, week_start_of


def inherited_successor_status(source_status):
    """Status com que o sucessor de uma migração nasce (AD-18 item 1, FR-4.16).

    Dados puros — sem DB, sem side effects: recebe o status da ORIGEM e devolve
    o status que o sucessor deve carregar. A regra é identidade para os dois
    únicos estados migráveis (`pending`→`pending`, `started`→`started`): o `/`
    iniciado não se perde ao carregar a tarefa adiante.

    Pré-condição: `source_status` é sempre migrável (`pending`/`started`). A
    matriz AD-02 (`services/state_machine.py`) já barra `completed`/`cancelled`/
    `migrated`/`postponed` na raiz da migração, e `_migrate_subtree` só recorre
    em filhos `pending`/`started` — nenhum outro estado chega aqui. Manter esta
    função como regra nomeada e sem DB é o que o Épico 14 (fila unificada, 14.3)
    reusa sem duplicação (arch. §3b item 7).
    """
    return source_status


def _migrate_subtree(
    source, *, user, container_field, container, scheduled_date, parent_task, new_status
) -> Task:
    """Recursivo (AD-08 item 11) — migra `source` e, em seguida, só os filhos
    ainda não-dispostos (`pending`/`started`); filhos `completed`/`cancelled`
    ficam intocados na origem. Ordem importa: criar o novo registro PRIMEIRO e
    só depois transicionar a origem — não o inverso. Quando o destino é o
    MESMO container da origem (ex.: "semana sem data" → um dia específico
    dessa mesma semana corrente), transicionar `source` antes deixaria o
    container sem nenhuma tarefa `pending`/`started` por um instante, e
    `is_container_closed` (`services/archive.py`) o consideraria fechado —
    `create_task` então rejeitaria a própria inserção que a migração está
    tentando fazer (`ClosedCycleReadOnly`, 409). Criar antes elimina essa
    janela; `migrate_task` é `@transaction.atomic`, então uma falha posterior
    em `transition_task` (não esperada aqui — `source` já passou pela mesma
    matriz `ALLOWED` na chamada raiz) reverte a criação também, sem órfão.

    Herança de status (AD-18 item 1): o sucessor herda o status da ORIGEM.
    `source_status` é lido POR NÓ e ANTES de qualquer transição — é o que
    garante que cada filho carregue o PRÓPRIO status, não o do pai (AC2 /
    AD-18 item 2). Não confundir com `new_status`, que é o status TERMINAL da
    origem (`MIGRATED`/`POSTPONED`), dimensão independente da herança."""
    source_status = source.status  # AC2: por nó, ANTES de transicionar
    # Herança de `waiting_on` (Story 12.2, AC4 / AD-18 item 5): cópia-identidade
    # de um booleano — lida POR NÓ (cada filho herda o PRÓPRIO valor, não o do
    # pai). `transition_task` sobre a origem só toca `status`, então este valor é
    # estável; ler no topo mantém a simetria com `source_status`.
    source_waiting_on = source.waiting_on
    new_task = create_task(
        user=user,
        parent_task=parent_task,
        scheduled_date=scheduled_date,
        title=source.title,
        description=source.description,
        eisenhower=source.eisenhower,
        category=source.category,
        **{container_field: container},
    )
    transition_task(user=user, task_id=source.id, to_status=new_status)
    # O sucessor nasce `waiting_on=False` (via `create_task`); `set_lineage_fields`
    # (contorna o guardrail de ciclo fechado — veículo correto, `update_task`
    # rodaria `_check_container_open`) copia o valor da origem junto ao bump de
    # `migration_count`, na mesma escrita escopada.
    set_lineage_fields(
        task_id=new_task.id,
        migration_count=source.migration_count + 1,
        waiting_on=source_waiting_on,
    )
    set_lineage_fields(task_id=source.id, migrated_to_task=new_task)

    # `create_task` sempre nasce `pending`; promover o sucessor a `started`
    # quando a origem era `started` mantém `state_machine` como autoridade única
    # sobre status (`pending→started` já é legal na matriz AD-02). `pending`→
    # `pending` é identidade e não exige transição.
    if inherited_successor_status(source_status) == Task.Status.STARTED:
        transition_task(user=user, task_id=new_task.id, to_status=Task.Status.STARTED)

    pending_children = source.subtasks.filter(status__in=(Task.Status.PENDING, Task.Status.STARTED))
    for child in list(pending_children):
        _migrate_subtree(
            child,
            user=user,
            container_field=container_field,
            container=container,
            scheduled_date=None,  # subtarefa não carrega scheduled_date próprio
            parent_task=new_task,
            new_status=new_status,
        )
    return new_task


@transaction.atomic
def migrate_task(*, user, task_id, destination, month_first=None, scheduled_date=None) -> Task:
    """destination: "today" | "week" | "month" | "future" | "cancel".
    "today"  -> destino = Daily Log de hoje; origem vira MIGRATED.
    "week"   -> destino = Weekly Log da semana de `scheduled_date`, quando
                 informado (week_start_of(scheduled_date); o NOVO registro
                 nasce com esse dia, a origem não é alterada além do status);
                 quando `scheduled_date` está ausente, comportamento
                 pré-existente: semana CORRENTE (week_start calculado aqui
                 via today_for, novo registro sem dia). Origem vira MIGRATED
                 em ambos os casos.
    "month"  -> destino = Monthly Log do MÊS CORRENTE (month_first calculado
                 aqui via today_for, NUNCA aceito do cliente); scheduled_date
                 opcional; origem vira POSTPONED.
    "future" -> destino = Monthly Log de month_first (validado > mês corrente
                 na view); scheduled_date opcional; origem vira POSTPONED.
    "cancel" -> sem destino; origem vira CANCELLED via transition_task; sem
                 lineage (sem migrated_to_task, sem novo registro).
    """
    task = Task.objects.get(id=task_id)  # auto-escopado por tenant

    if destination == "cancel":
        return transition_task(user=user, task_id=task_id, to_status=Task.Status.CANCELLED)

    if destination == "today":
        container_field = "log"
        container = get_or_create_daily_log(user=user, log_date=today_for(user))
        new_status, root_scheduled_date = Task.Status.MIGRATED, None
    elif destination == "week":
        container_field = "weekly_log"
        week_start = (
            week_start_of(scheduled_date) if scheduled_date else week_start_of(today_for(user))
        )
        container = get_or_create_weekly_log(user=user, week_start=week_start)
        new_status, root_scheduled_date = Task.Status.MIGRATED, scheduled_date
    else:  # "month" ou "future"
        container_field = "monthly_log"
        container = get_or_create_monthly_log(user=user, month_first=month_first)
        new_status, root_scheduled_date = Task.Status.POSTPONED, scheduled_date

    _migrate_subtree(
        task,
        user=user,
        container_field=container_field,
        container=container,
        scheduled_date=root_scheduled_date,
        parent_task=None,
        new_status=new_status,
    )
    return Task.objects.get(id=task.id)  # recarrega com status/migrated_to_task atualizados
