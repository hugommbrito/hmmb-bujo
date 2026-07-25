"""Fontes dos rituais Semana/Mês e decisões-snapshot (AD-28 item 6; M06/M07).

Duas responsabilidades, uma por metade do módulo:

1. **Decisão-snapshot** — ``upsert_ritual_decision`` persiste as três decisões
   que **não mutam o item** (``keep``, ``skip_week``, ``keep_undated``) numa
   tabela própria por ``(ritual-alvo × item)``. Decisões **mutantes**
   (migrar/alocar/concluir/cancelar/adiar) NÃO passam por aqui: a própria mutação
   é a persistência, e o item simplesmente deixa de ser elegível na re-derivação
   da fonte — "registrar em dobro criaria segunda verdade" (AD-28 item 6).

2. **Fontes** — sete funções de leitura, **uma por fonte** (quatro do ritual
   semanal, três do mensal). Não existe função "todas as fontes" e não existe
   endpoint agregador: "fontes carregam/falham independentemente" (M06 L251,
   M07 L309) só é verdade de fato se cada fonte for uma requisição própria. Um
   agregador com ``try/except`` devolveria 200 com erros embutidos e acoplaria os
   tempos de resposta das sete.

**Progresso é DERIVADO na leitura** (elegíveis − mutados − decididos), nunca um
contador armazenado (AD-28 item 6 ponto 7): não existe coluna de progresso em
``ritual_decisions`` nem em ``weekly_log``/``monthly_log``, e ``reviewed`` é
simplesmente ``pending_decision_count == 0`` — **fonte vazia é revisada**.

Nenhuma função deste módulo materializa log: sempre ``objects.filter(...).first()``
(o padrão explícito de ``MigrationQueueView``), **jamais** ``get_or_create_*_log``.
Consultar uma fonte não pode criar ciclo nem tirar um log do regime ``NULL``
(guardrail da AC4 da Story 14.1, agora do lado da leitura).
"""

from collections import OrderedDict
from datetime import date, timedelta

from django.db import IntegrityError, transaction
from django.db.models import Count, F, Q

from bujo.models import (
    CycleStatus,
    MonthlyLog,
    RecurringTaskTemplate,
    RitualDecision,
    RitualDecisionKind,
    Task,
    WeeklyLog,
)
from bujo.services.archive import UNDISPOSED
from bujo.services.cycles import (
    has_undisposed,
    previous_operational_monthly,
    previous_operational_weekly,
)
from bujo.services.recurring import live_templates
from core.calendar import months_of_week
from core.exceptions import InvalidRitualDecision, InvalidTransition

# Pseudo-alvo na mensagem de `InvalidTransition` quando o alvo do ritual não está
# em `planning`: decidir não é mudar `status`, então não há `to_status` real a
# citar (mesmo recurso de `PLANNING_COMPLETED` em `services/cycles.py`).
RITUAL_DECISION = "ritual_decision"

# Rótulos internos das duas âncoras — usados só para casar a matriz. NÃO são
# contrato de API (o fio expõe `weekStart`/`monthFirst` e `taskId`/`templateId`).
_WEEKLY_TARGET = "weekly"
_MONTHLY_TARGET = "monthly"
_TASK_ITEM = "task"
_TEMPLATE_ITEM = "template"

# Matriz ÚNICA de combinações legais `decisão → (tipo de alvo, tipo de item)`.
# Espelha o `ALLOWED` de `state_machine.py`/`cycles.py`: matriz no serviço, nunca
# em serializer. Cada célula é uma decisão de produto explícita dos spines, e as
# AUSÊNCIAS são tão load-bearing quanto as presenças:
#
# - não existe `(monthly, template)`: "Não existe 'Não alocar neste mês' para
#   anual" (M07, literal) — e o mensal também não a oferece;
# - não existe `(weekly, task)` para o Weekly anterior porque a fonte "Weekly
#   anterior" não oferece "manter" (M06, literal). `keep` existe para a fonte
#   Monthly-na-semana; a fonte bloqueante escoa por MUTAÇÃO, não por snapshot.
ALLOWED_DECISIONS: dict[str, tuple[str, str]] = {
    RitualDecisionKind.KEEP: (_WEEKLY_TARGET, _TASK_ITEM),  # M06 fonte 1 (Monthly na semana)
    RitualDecisionKind.SKIP_WEEK: (_WEEKLY_TARGET, _TEMPLATE_ITEM),  # M06 fonte 3 (recorrentes)
    RitualDecisionKind.KEEP_UNDATED: (_MONTHLY_TARGET, _TASK_ITEM),  # M07 fonte 2 (Future Log)
}

# Mensagem única e NEUTRA. Serve tanto para combinação ilegal quanto para item
# inexistente/de outro tenant — de propósito: uma mensagem específica de "não
# existe" revelaria a ausência (ou a presença) de linha alheia.
_ILLEGAL = "Esta decisão não se aplica a este item neste ritual."


# --- decisões-snapshot ---------------------------------------------------------
def _exactly_one(first, second, *, field_pair: str):
    """Impõe exatamente-um ANTES de tocar o banco (o CHECK é rede de segurança,
    não a validação — §6.6). Devolve qual dos dois veio preenchido."""
    if (first is None) == (second is None):
        raise InvalidRitualDecision(f"Informe exatamente um {field_pair} para a decisão de ritual.")
    return first is not None


@transaction.atomic
def upsert_ritual_decision(
    *,
    user,
    decision,
    week_start=None,
    month_first=None,
    task_id=None,
    recurring_template_id=None,
) -> RitualDecision:
    """Registra (ou re-lê) a decisão-snapshot de um item num ritual.

    **Idempotente de verdade:** re-executar com a mesma tupla e o mesmo valor não
    emite nenhum ``UPDATE`` — devolve o registro existente, ``updated_at``
    intacto. É por isso que "persistência imediata, um POST por decisão"
    (AD-28 item 6 ponto 6) pode ser o protocolo: pausar, sair e retomar o ritual
    não perde nem duplica nada.

    **A ``Task``/``RecurringTaskTemplate`` JAMAIS é tocada** (AD-28 item 6 ponto
    8): nenhum ``save``, nenhum ``status``, nenhum ``scheduled_date``, nenhum
    ``set_lineage_fields``. Quem quiser mudar o item usa os endpoints de mutação,
    e aí não há snapshot nenhum a escrever.
    """
    is_weekly = _exactly_one(week_start, month_first, field_pair="alvo (weekStart ou monthFirst)")
    is_task = _exactly_one(task_id, recurring_template_id, field_pair="item (taskId ou templateId)")

    target_kind = _WEEKLY_TARGET if is_weekly else _MONTHLY_TARGET
    item_kind = _TASK_ITEM if is_task else _TEMPLATE_ITEM
    if ALLOWED_DECISIONS.get(decision) != (target_kind, item_kind):
        raise InvalidRitualDecision(_ILLEGAL)

    # Alvo: nunca materializa (ver docstring do módulo) e precisa estar em
    # `planning` — decisão-snapshot é ato de ritual, e o ritual só existe no alvo
    # em planejamento. Alvo inexistente conta como `status = None`.
    if is_weekly:
        target = WeeklyLog.objects.filter(week_start=week_start).first()
    else:
        target = MonthlyLog.objects.filter(month_first=month_first).first()
    target_status = target.status if target is not None else None
    if target_status != CycleStatus.PLANNING:
        raise InvalidTransition(target_status, RITUAL_DECISION)

    # Item pelo manager auto-escopado: linha de outro tenant é simplesmente
    # inexistente aqui (AD-12), e o erro devolvido é o neutro.
    if is_task:
        item = Task.objects.filter(pk=task_id).first()
    else:
        # `live_templates`: um template excluído (Story 14.4) não é decidível —
        # cai no `item is None` abaixo e devolve o mesmo 409 neutro de sempre.
        item = live_templates().filter(pk=recurring_template_id).first()
    if item is None:
        raise InvalidRitualDecision(_ILLEGAL)

    lookup = {
        "weekly_log": target if is_weekly else None,
        "monthly_log": None if is_weekly else target,
        "task": item if is_task else None,
        "recurring_template": None if is_task else item,
    }

    existing = RitualDecision.objects.filter(**lookup).first()
    if existing is not None:
        if existing.decision == decision:
            return existing  # idempotente: ZERO escrita, `updated_at` preservado
        # Mudança de decisão para a mesma tupla: um `UPDATE` de uma linha. Hoje é
        # inalcançável (a matriz dá uma única decisão possível por combinação),
        # mas implementado porque é o significado de "upsert" e porque um valor
        # novo no enum (AD-28 item 6 ponto 4) o tornaria alcançável sem aviso.
        existing.decision = decision
        existing.save(update_fields=["decision", "updated_at"])
        return existing

    try:
        # Savepoint aninhado: sem ele a `IntegrityError` deixaria a transação
        # externa quebrada antes de conseguirmos re-ler.
        with transaction.atomic():
            return RitualDecision.objects.create(decision=decision, **lookup)
    except IntegrityError:
        # Corrida de upsert do MESMO par (a unique parcial fez seu trabalho).
        # NÃO é `CycleTargetConflict`: lá a colisão é disputa por um alvo único e
        # o perdedor precisa saber que perdeu; aqui as duas requisições queriam a
        # mesma linha com o mesmo valor, então re-ler é o resultado correto e o
        # cliente não tem nada a fazer diferente. Upsert, não conflito.
        return RitualDecision.objects.get(**lookup)


def decisions_for_target(*, user, weekly_log=None, monthly_log=None) -> tuple[dict, dict]:
    """``(decisões_por_task_id, decisões_por_template_id)`` do alvo, em UMA query.

    Cada fonte anota ``decision`` nos seus itens a partir destes dois dicts, em
    vez de consultar por item (N+1). Alvo inexistente ⇒ dois dicts vazios.

    ``user`` na assinatura por uniformidade com o resto do módulo, mesmo que o
    manager já escope por tenant.
    """
    target = weekly_log if weekly_log is not None else monthly_log
    if target is None:
        return {}, {}
    field = "weekly_log" if weekly_log is not None else "monthly_log"

    by_task: dict = {}
    by_template: dict = {}
    for row in RitualDecision.objects.filter(**{field: target}).values(
        "task_id", "recurring_template_id", "decision"
    ):
        if row["task_id"] is not None:
            by_task[row["task_id"]] = row["decision"]
        else:
            by_template[row["recurring_template_id"]] = row["decision"]
    return by_task, by_template


# --- envelope de fonte ---------------------------------------------------------
# Forma uniforme das sete fontes. `eligible_count`/`pending_decision_count`/
# `reviewed` são SEMPRE computados aqui, na leitura — nenhum cache, nenhuma
# coluna. `counts_toward_progress` do envelope é `True` nas sete: o que fica fora
# do denominador são os buckets `already_placed*` (que carregam o seu próprio
# `counts_toward_progress: False`) e o "Monthly ampliado", que nem endpoint desta
# story é (é servido por `GET /api/bujo/logs/monthly/?month_first=`).
def _bucket(items) -> dict:
    """Bucket fora do progresso (`alreadyPlaced`/`alreadyPlacedInYear`)."""
    return {"counts_toward_progress": False, "items": items}


def _envelope(source_id: str, *, items: list, blocking: bool = False, **extra) -> dict:
    pending = sum(1 for item in items if item["decision"] is None)
    return {
        "source_id": source_id,
        "blocking": blocking,
        "counts_toward_progress": True,
        "eligible_count": len(items),
        "pending_decision_count": pending,
        # Vazio é revisado (M06/M07): 0 itens ⇒ 0 sem decisão ⇒ `True`.
        "reviewed": pending == 0,
        "items": items,
        **extra,
    }


def _task_items(tasks, decisions_by_task: dict) -> list:
    return [{"task": task, "decision": decisions_by_task.get(task.id)} for task in tasks]


def undisposed_roots(queryset):
    """Raízes abertas. ``parent_task__isnull=True`` porque as subtarefas vão
    aninhadas no ``TaskSerializer`` (convenção de todas as listagens — a
    densidade é a única superfície que faz o oposto). ``UNDISPOSED`` vem de
    ``services/archive.py``: fonte única de "tarefa aberta", não redeclarada.

    PÚBLICA desde a Story 14.3 (era ``_undisposed_roots``): ``services/migration.py``
    a consome para as três seções da fila unificada em vez de redeclarar o
    predicado. Promover em vez de importar um símbolo privado entre serviços
    mantém uma fonte única de "raiz aberta" sem tornar o acoplamento invisível."""
    return queryset.filter(status__in=UNDISPOSED, parent_task__isnull=True)


def _by_day_then_undated(queryset):
    """Ordenação "dia → sem-dia" (M08). ``nulls_last`` é DECLARADO em vez de
    herdado do default do Postgres: a ordenação é contrato de produto."""
    return queryset.order_by(F("scheduled_date").asc(nulls_last=True), "order_index")


def _blocking_previous_source(source_id: str, previous) -> dict:
    """Fonte bloqueante ("Weekly anterior" / "Monthly anterior") — mecânica ÚNICA.

    Extraída em vez de escrita duas vezes: as duas fontes são idênticas a menos do
    ``source_id`` e de qual log é "o anterior" (lição SHELL-DEBT-03/04 do Épico
    13 — copiar o código dos gêmeos é a próxima dívida).

    **Nenhum item desta fonte carrega decisão-snapshot, e isso é construção, não
    coincidência:** o ``decision`` sai ``None`` porque nada é consultado, então
    ``pending_decision_count == eligible_count`` SEMPRE. M06 é literal ("o Weekly
    anterior **não oferece 'manter'**") e o item só sai da fonte por MUTAÇÃO
    (concluir/cancelar/migrar/adiar). Anotar decisões aqui seria pior que inútil:
    a matriz de ``upsert_ritual_decision`` casa apenas *tipos* de alvo e item, e
    portanto aceita ``keep`` sobre uma Task ancorada no PRÓPRIO log anterior
    (enquanto ele era o ``planning``). Se essa linha fosse lida por esta fonte, um
    item aberto sairia de ``pending_decision_count``, ``reviewed`` viraria ``True``
    com pendência de pé, e a UI ofereceria "pronta para finalizar" enquanto
    Iniciar responderia 409 — exatamente a divergência entre fonte e gate que
    ``previous_operational_*`` existe para impedir.

    Anterior ausente ⇒ fonte vazia, ``blocking: True``, ``ready_to_finalize:
    False`` — e o gate de Iniciar passa por vacuidade, que é o comportamento
    contratado na AC7 da Story 14.1. ``ready_to_finalize`` é o MESMO predicado do
    gate de finalizar (``has_undisposed``), não uma reimplementação.
    """
    tasks = [] if previous is None else _by_day_then_undated(undisposed_roots(previous.tasks))
    return _envelope(
        source_id,
        items=_task_items(tasks, {}),
        blocking=True,
        ready_to_finalize=previous is not None and not has_undisposed(previous),
    )


def _template_items(templates, decisions_by_template: dict) -> list:
    return [
        {
            "template": template,
            "decision": decisions_by_template.get(template.id),
            "instances_in_target_count": template.instances_in_target_count,
        }
        for template in templates
    ]


def _partition_by_placement(templates) -> tuple[list, list]:
    """``(pendentes, já alocados)`` por existência de instância no alvo.

    Feito em Python sobre a queryset já anotada — uma query, não duas: o
    ``Count`` anotado é o mesmo número que a partição consulta e que o
    ``instancesInTargetCount`` do item expõe.
    """
    pending, already = [], []
    for template in templates:
        (already if template.instances_in_target_count > 0 else pending).append(template)
    return pending, already


# --- fontes do ritual SEMANAL (M06) --------------------------------------------
def list_monthly_tasks_in_week(*, user, week_start) -> dict:
    """Fonte 1 — tarefas datadas do Monthly que caem na semana-alvo.

    "Incluindo **ambos** os Monthly quando a semana cruza meses" sai de graça de
    ``months_of_week``, que devolve dois ``(ano, mês)`` na semana de virada: a
    regra de produto é o helper, não um ``if`` de virada. Fim da semana é
    ``week_start + 6`` (não existe ``week_end_of`` em ``core/calendar``; o ``+6``
    é inline em vários pontos do repo).

    Aceita ``keep`` ("manter") — a única fonte semanal que aceita decisão-snapshot
    de Task.
    """
    weekly_log = WeeklyLog.objects.filter(week_start=week_start).first()
    by_task, _ = decisions_for_target(user=user, weekly_log=weekly_log)
    month_keys = [date(year, month, 1) for year, month in months_of_week(week_start)]
    tasks = undisposed_roots(
        Task.objects.filter(
            monthly_log__month_first__in=month_keys,
            scheduled_date__range=(week_start, week_start + timedelta(days=6)),
        )
    ).order_by("scheduled_date", "order_index")
    return _envelope("monthly-in-week", items=_task_items(tasks, by_task))


def list_weekly_recurring_candidates(*, user, week_start) -> dict:
    """Fonte 3 — **todos** os templates ``weekly`` ativos, alfabéticos.

    ``order_by("recurrence_text")`` é a mesma ordem alfabética que
    ``RecurringTaskTemplateListView`` já usa como default.

    Um template com ``skip_week`` para este alvo **continua listado** em
    ``items`` (e continua ativo — "remove o aviso sem desativar o template"), só
    sai de ``pending_decision_count`` porque carrega ``decision``. Os já alocados
    vão para o bucket fora do progresso, e **permanecem consultáveis**: novas
    instâncias, inclusive duplicadas no mesmo dia, continuam permitidas — não
    existe nenhuma constraint de template × dia nem template × alvo
    ("múltiplas instâncias por template", AD-08/M09).
    """
    weekly_log = WeeklyLog.objects.filter(week_start=week_start).first()
    _, by_template = decisions_for_target(user=user, weekly_log=weekly_log)
    templates = (
        live_templates(
            RecurringTaskTemplate.objects.filter(
                active=True, recurrence_group=RecurringTaskTemplate.RecurrenceGroup.WEEKLY
            )
        )
        .annotate(
            instances_in_target_count=Count(
                "instances", filter=Q(instances__weekly_log__week_start=week_start)
            )
        )
        .order_by("recurrence_text")
    )
    pending, already_placed = _partition_by_placement(templates)
    return _envelope(
        "recurring",
        items=_template_items(pending, by_template),
        already_placed=_bucket(_template_items(already_placed, by_template)),
    )


def list_previous_weekly_pendings(*, user, week_start) -> dict:
    """Fonte 4 — a **única fonte bloqueante** do ritual semanal.

    O log anterior vem de ``previous_operational_weekly`` (o mesmo predicado do
    gate de ``start_weekly``) e **não** de ``week_start − 7 dias``: um ciclo
    ``NULL`` intermediário é ignorado pelo gate, e uma fonte que o contasse
    mostraria "pronta para finalizar" enquanto Iniciar devolveria 409.
    """
    previous = previous_operational_weekly(user=user, week_start=week_start)
    return _blocking_previous_source("previous-weekly", previous)


def list_pending_daily_groups(*, user, week_start) -> dict:
    """Fonte 5 — Daily Logs não resolvidos, agrupados por data, do mais antigo ao
    mais recente. Informativa: nunca bloqueia e não oferece decisão-snapshot.

    Fronteira ``log_date < week_start`` (ambiguidade #1 das Dev Notes): o ritual
    planeja a semana-alvo, então os Daily dentro dela ainda vão acontecer e não
    são matéria deste planejamento.

    Uma query só, com ``select_related("log")``, e o agrupamento em Python —
    iterar logs e consultar tarefas de cada um seria N+1.
    """
    tasks = (
        undisposed_roots(Task.objects.filter(log__log_date__lt=week_start))
        .select_related("log")
        .order_by("log__log_date", "order_index")
    )
    groups: OrderedDict = OrderedDict()
    for task in tasks:
        groups.setdefault(task.log.log_date, []).append({"task": task, "decision": None})

    flat = [item for items in groups.values() for item in items]
    envelope = _envelope(
        "pending-dailies",
        items=flat,
        groups=[{"date": day, "items": items} for day, items in groups.items()],
    )
    # `groups` É a forma no fio desta fonte (AC3); `items` fica só como insumo das
    # contagens derivadas e não é serializado.
    del envelope["items"]
    return envelope


# --- fontes do ritual MENSAL (M07) ---------------------------------------------
def list_monthly_recurring_candidates(*, user, month_first) -> dict:
    """Fonte 1 — ``monthly`` ativos **primeiro**, depois ``annual`` ativos ainda
    sem instância no **ano do Monthly-alvo**.

    A elegibilidade anual é ``exclude(instances__monthly_log__month_first__year=
    <ano do alvo>)`` — literalmente a expressão que ``RecurringTaskTemplateList
    View`` já usa em ``?unplaced_year``, reusada e não reinventada. ``recurrence_
    text`` **nunca** é parseado (AD-08 item 4; M07 explícito): "sem parsing" não é
    uma promessa de estilo, é o que faz um anual alocado em QUALQUER mês do ano
    sair da elegibilidade sem que ninguém precise saber em que mês ele "deveria"
    cair.

    **A regra de dezembro é EMERGENTE, não codificada.** M07 diz "em dezembro,
    somente o próprio mês-alvo resolve a pendência anual" — e isso já é
    consequência da elegibilidade por ano-alvo: com alvo em dezembro, não existe
    mês posterior dentro do mesmo ano para onde adiar, então a única alocação que
    tira o anual da fonte é a que cai no próprio dezembro. Nenhum ``if month ==
    12`` é escrito aqui, e nenhum deve ser.

    Nenhuma decisão-snapshot existe nesta fonte (a matriz não tem célula
    ``(monthly, template)``): "Não existe 'Não alocar neste mês' para anual".
    """
    monthly_log = MonthlyLog.objects.filter(month_first=month_first).first()
    _, by_template = decisions_for_target(user=user, monthly_log=monthly_log)
    Group = RecurringTaskTemplate.RecurrenceGroup

    # `distinct=True` porque os dois blocos abaixo aplicam um SEGUNDO filtro sobre
    # a mesma relação multi-valorada (`instances`), e o JOIN extra inflaria a
    # contagem sem ele.
    active_in_target = Count(
        "instances",
        filter=Q(instances__monthly_log__month_first=month_first),
        distinct=True,
    )
    monthly_templates = (
        live_templates(
            RecurringTaskTemplate.objects.filter(active=True, recurrence_group=Group.MONTHLY)
        )
        .annotate(instances_in_target_count=active_in_target)
        .order_by("recurrence_text")
    )
    monthly_pending, monthly_already = _partition_by_placement(monthly_templates)

    # `live_templates` na ORIGEM da queryset anual: as três saídas derivadas
    # (`annual_eligible`, `annual_in_year` e as contagens) herdam o filtro de uma
    # vez, em vez de repeti-lo em cada uma.
    annual = (
        live_templates(
            RecurringTaskTemplate.objects.filter(active=True, recurrence_group=Group.ANNUAL)
        )
        .annotate(instances_in_target_count=active_in_target)
        .order_by("recurrence_text")
    )
    in_year = Q(instances__monthly_log__month_first__year=month_first.year)
    annual_eligible = annual.exclude(in_year)
    annual_in_year = annual.filter(in_year).distinct()

    return _envelope(
        "recurring",
        # Ordem fixa do M07: mensais primeiro, anuais depois.
        items=_template_items(monthly_pending, by_template)
        + _template_items(annual_eligible, by_template),
        already_placed=_bucket(_template_items(monthly_already, by_template)),
        already_placed_in_year=_bucket(_template_items(annual_in_year, by_template)),
    )


def list_future_log_items(*, user, month_first) -> dict:
    """Fonte 2 — itens do Future Log que **já pertencem** ao Monthly-alvo.

    Chegam com data preservada ou em "Sem dia definido" (``scheduled_date IS
    NULL``), ordenados dia → sem-dia. Aceita ``keep_undated`` ("manter sem dia").
    Concluir/cancelar **não existem nesta fonte** — o backend não precisa impedir
    uma transição feita por outro endpoint, mas não a oferece aqui.

    **Exclusão deliberada** (ambiguidade #2 das Dev Notes): sucessores cujo
    predecessor vive no Monthly operacional imediatamente anterior. A fonte
    "Monthly anterior" migra itens PARA o alvo durante o mesmo ritual; sem esta
    exclusão o sucessor recém-criado voltaria à fila como item indeciso, inflando
    o denominador e contradizendo "retomar traz só os restantes". Fora do ritual a
    leitura é a mesma: quem moveu um item do mês passado para este mês já decidiu.
    Itens adiados de rituais mais antigos (predecessor em mês−2 ou anterior)
    **continuam aparecendo**, que é o Future Log funcionando.
    """
    monthly_log = MonthlyLog.objects.filter(month_first=month_first).first()
    by_task, _ = decisions_for_target(user=user, monthly_log=monthly_log)
    if monthly_log is None:
        tasks = []
    else:
        queryset = undisposed_roots(monthly_log.tasks)
        previous = previous_operational_monthly(user=user, month_first=month_first)
        if previous is not None:
            # `migrated_from` é o reverso de `Task.migrated_to_task`, então isto
            # lê "tarefas cujo PREDECESSOR está no monthly anterior".
            queryset = queryset.exclude(migrated_from__monthly_log=previous)
        tasks = _by_day_then_undated(queryset)
    return _envelope("future-log", items=_task_items(tasks, by_task))


def list_previous_monthly_pendings(*, user, month_first) -> dict:
    """Fonte 3 — a **única fonte bloqueante** do ritual mensal (gêmea da semanal:
    mesma mecânica extraída, mesmo predicado de ``ready_to_finalize``)."""
    previous = previous_operational_monthly(user=user, month_first=month_first)
    return _blocking_previous_source("previous-monthly", previous)
