"""Migração de tarefas pendentes e a fila que a alimenta (FR-1.7, AD-03,
AD-08 item 11, AD-09, AD-28 itens 7-8, §6.2).

Duas metades do MESMO agregado coabitam aqui de propósito (AD-28 item 7: a fila
vive "ao lado de `migrate_task`"):

- a **mutação** — `migrate_task`/`_migrate_subtree`/`inherited_successor_status`.
  Não duplica `order_index`/validação de transição: reaproveita
  `create_task`/`update_task` (`services/tasks.py`) e `transition_task`
  (`services/state_machine.py`) tal como já existem;
- a **leitura** — `unified_migration_queue`, a fila unificada de pendências. Ela
  é 100% DERIVADA por query (zero schema novo, zero cron, zero estado
  acumulado — filosofia AD-09 item 2 intacta) e a decisão por item é a própria
  `migrate_task` logo acima. Separar as duas em módulos diferentes obrigaria a
  ler dois arquivos para entender um único laço "derivar → decidir → re-derivar".
"""

from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, timedelta

from django.db import transaction
from django.db.models import F

from bujo.models import Task
from bujo.services.logs import (
    get_or_create_daily_log,
    get_or_create_monthly_log,
    get_or_create_weekly_log,
)
from bujo.services.rituals import undisposed_roots
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


# --- fila unificada de migração (Story 14.3, AD-28 itens 7-8 / AD-09) ----------


def _previous_week_start(today: date) -> date:
    return week_start_of(today) - timedelta(weeks=1)


def _previous_month_first(today: date) -> date:
    # `.replace(day=1)` inline porque `core/calendar.py` não expõe
    # `month_first_for` — mesma expressão que as views legadas já usavam.
    return (today.replace(day=1) - timedelta(days=1)).replace(day=1)


@dataclass(frozen=True)
class _SectionSpec:
    """O que DIVERGE entre as três seções — e nada mais.

    `source_id` é o rótulo estrutural servido ao cliente; `period_lookup` é o
    caminho ORM da chave de período do container (usado para filtrar, anotar e
    ordenar de uma vez); `boundary` deriva a fronteira EXCLUSIVA (`__lt`) a
    partir de `hoje`. Uma estrutura só, três linhas de dados: copiar o corpo da
    derivação três vezes seria a dívida SHELL-DEBT-03/04 do Épico 13 se
    repetindo (padrão `_CycleSpec` da 14.1 / `ALLOWED_DECISIONS` da 14.2).

    Não há um quarto campo com "o nome do atributo da chave de período" porque a
    derivação ANOTA a chave sempre com o MESMO alias (`period_start`, via
    `F(period_lookup)`): o laço de agrupamento lê um atributo uniforme e a
    mecânica fica genuinamente sem ramos. A alternativa `select_related` (o que
    `rituals.list_pending_daily_groups` faz) exigiria esse quarto campo e um
    acesso diferente por seção — uma query só nas duas, mas com um ramo por
    seção reintroduzido de graça.
    """

    source_id: str
    period_lookup: str
    boundary: Callable[[date], date]


# Ordem hierárquica do BuJo, do mais grosso ao mais fino (AD-09 item 4). Esta
# tupla É o contrato de ordem das seções — a resposta nunca a reordena.
#
# As fronteiras são EXCLUSIVAS (`__lt`) de propósito: com isso a semana e o mês
# ANTERIORES ficam fora da fila por construção. Eles são as fontes bloqueantes
# dos rituais (Story 14.2, `previous-weekly`/`previous-monthly`, servidas por
# `weekly-review/queue/` e `monthly-review/queue/`) — escoá-los também pela fila
# criaria duas superfícies para a mesma pendência. "Ontem", em contraste, É o
# nível `day` (fronteira `< hoje`), não uma quarta seção.
_SECTION_SPECS = (
    _SectionSpec("month", "monthly_log__month_first", _previous_month_first),
    _SectionSpec("week", "weekly_log__week_start", _previous_week_start),
    _SectionSpec("day", "log__log_date", lambda today: today),
)


def unified_migration_queue(*, user) -> dict:
    """Fila única de pendências dos três níveis, mês → semana → dia (AD-28 item 7).

    Leitura pura, derivada por query: nada de `@transaction.atomic` (não há
    escrita, e um `atomic` numa leitura mascararia uma escrita acidental numa
    review futura), nada de `get_or_create_*_log` (jamais materializa container —
    padrão herdado de `MigrationQueueView`) e nada de `all_objects` (o manager
    `objects` é auto-escopado por tenant, AD-12).

    Devolve estrutura PURA (dicts + instâncias de `Task`), nunca `Response`::

        {"total_count": int,
         "sections": [{"source_id": str, "count": int,
                       "groups": [{"period_start": date, "items": [Task]}]}],
         "yesterday": date}

    As três seções estão SEMPRE presentes, inclusive vazias (`count: 0`,
    `groups: []`): a UI da 14.9 desenha o rail de fontes completo, e uma seção
    ausente obrigaria o cliente a inventar a ordem.

    `yesterday` é chave INTERNA, consumida apenas pelos aliases legados
    (`MigrationQueueView`/`CatchUpQueueView`, que precisam da fronteira de ontem
    sem recalcular tempo). `UnifiedMigrationQueueSerializer` declara só
    `total_count`/`sections`, e um `Serializer` com campos declarados ignora
    chaves extras do dict — então ela não vaza para o contrato público.

    Não reusa `_envelope`/`_bucket` de `services/rituals.py`: aquele envelope
    carrega `blocking`, `reviewed`, `counts_toward_progress` e
    `pending_decision_count`, campos SEM significado aqui (a fila não tem
    decisão-snapshot nem gate de ritual). A não-reutilização é deliberada —
    forçar o envelope comum produziria campos falsos, pior que um dict de três
    chaves. Pela mesma razão a fila não CONSULTA `ritual_decisions`: ela lista o
    que está aberto, e só a mutação remove um item (achado A1 da review da 14.2).
    """
    today = today_for(user)
    sections = []

    for spec in _SECTION_SPECS:
        tasks = (
            undisposed_roots(
                Task.objects.filter(**{f"{spec.period_lookup}__lt": spec.boundary(today)})
            )
            # A chave do período tem de vir na MESMA query: filtrar/ordenar por
            # `log__log_date` não popula `task.log`, e ler o container no laço
            # abaixo custaria uma query POR TAREFA.
            .annotate(period_start=F(spec.period_lookup))
            # O `TaskSerializer` recursa em `subtasks`; o prefetch cobre a
            # profundidade 1 e REDUZ (não elimina) as queries da recursão, que
            # desce arbitrariamente fundo. As views legadas não prefetcham nada,
            # então isto é estritamente melhor e não muda contrato.
            .prefetch_related("subtasks")
            # Ordenação DECLARADA, não herdada: `order_by` substitui
            # integralmente `Meta.ordering = ["order_index"]` (Django 5.2), e as
            # views legadas ordenavam só pelo período — a ordem intra-período era
            # indefinida. Aqui ela passa a ser contrato (aperto compatível).
            .order_by("period_start", "order_index")
        )

        groups: OrderedDict = OrderedDict()
        for task in tasks:
            groups.setdefault(task.period_start, []).append(task)

        sections.append(
            {
                "source_id": spec.source_id,
                "count": sum(len(items) for items in groups.values()),
                "groups": [
                    {"period_start": period_start, "items": items}
                    for period_start, items in groups.items()
                ],
            }
        )

    return {
        # `total_count` é a soma direta das três seções, sem dedup: `Task` tem
        # exatamente UM container (CHECK `task_exactly_one_log`), logo as seções
        # são disjuntas por garantia do banco.
        "total_count": sum(section["count"] for section in sections),
        "sections": sections,
        "yesterday": today - timedelta(days=1),
    }
