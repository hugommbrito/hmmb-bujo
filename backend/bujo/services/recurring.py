"""Criação/edição/**exclusão lógica**/placement de `RecurringTaskTemplate`
(§6.2, AD-08). Sem validação de forma/enum — isso já foi feito pelo serializer
na view; o serviço assume dados validados.

`live_templates` é a origem ÚNICA de "template vivo" (M09/UX-DR24): todo ponto
de leitura de template no projeto — as três querysets das fontes dos rituais, a
listagem da biblioteca, `update_template`, `place_template` e o lookup de item de
`upsert_ritual_decision` — passa por ela. A única exceção é
`soft_delete_template`, e o porquê está documentado lá.

O escopo dessa regra é o caminho tenant-scoped (`objects`). O escape hatch
`all_objects` de admin/management (AD-12) fica fora dela por definição: o comando
`management/commands/purge_e2e_users.py` lê e remove FISICAMENTE templates de
usuários de e2e, o que é deliberado e é o único caminho do projeto que faz isso.
"""

from django.db import transaction

from bujo.models import RecurringTaskTemplate, Task
from bujo.services.logs import get_or_create_monthly_log, get_or_create_weekly_log
from bujo.services.tasks import create_task
from core.calendar import now
from core.exceptions import WrongPlacementContainer


def live_templates(queryset=None):
    """Templates NÃO excluídos (`deleted_at IS NULL` = vivo) — a definição única
    de "vivo" de M09, aplicada em todos os pontos de leitura.

    Mesma forma de `undisposed_roots` (`services/rituals.py`): helper de módulo
    que recebe e devolve queryset, para poder ser COMPOSTO com os filtros de cada
    chamador (`active=True`, `recurrence_group=...`) em vez de recriado.

    NÃO é um manager customizado com filtro default, por três razões:
    (a) um filtro default esconderia a linha inclusive de `soft_delete_template`,
        que precisa encontrá-la para ser idempotente, forçando um segundo manager
        só para isso;
    (b) filtro implícito é invisível na leitura do call site — o repo já
        estabeleceu com `undisposed_roots` que predicado compartilhado é
        explícito e greppável;
    (c) `core/tests/test_guardrails.py` assere que `objects` é um `TenantManager`
        para todo `TenantModel` concreto; passar por subclasse é possível, mas
        amarraria escopo de tenant e soft delete no mesmo manager.
    """
    base = queryset if queryset is not None else RecurringTaskTemplate.objects.all()
    return base.filter(deleted_at__isnull=True)


@transaction.atomic
def create_template(*, user, **fields) -> RecurringTaskTemplate:
    return RecurringTaskTemplate.objects.create(**fields)


@transaction.atomic
def update_template(*, user, template_id, **fields) -> RecurringTaskTemplate:
    template = live_templates().get(id=template_id)  # auto-escopado por tenant; vivos só
    for field, value in fields.items():
        setattr(template, field, value)
    template.save(update_fields=[*fields.keys()])
    return template


@transaction.atomic
def soft_delete_template(*, user, template_id) -> RecurringTaskTemplate:
    """Exclusão LÓGICA (M09: "não há exclusão física"): o template sai da
    biblioteca e das fontes dos rituais, mas a linha persiste para preservar a
    linhagem (`Task.source_template`) das instâncias já alocadas.

    Idempotente: chamar duas vezes devolve o mesmo registro com o `deleted_at`
    ORIGINAL, sem emitir escrita nenhuma.
    """
    # ÚNICO ponto de produção que lê template sem `live_templates()`, e é a
    # idempotência que o exige: para devolver o registro já excluído sem
    # reescrever o carimbo, é preciso conseguir encontrá-lo. Todos os outros
    # pontos de leitura passam pelo filtro.
    template = RecurringTaskTemplate.objects.get(id=template_id)  # auto-escopado; 404 na view
    if template.deleted_at is not None:
        return template
    template.deleted_at = now()
    # `update_fields` com uma coluna só: é o que garante MECANICAMENTE que a
    # exclusão nunca toca `active` nem nenhum campo de conteúdo.
    template.save(update_fields=["deleted_at"])
    return template


@transaction.atomic
def place_template(
    *, user, template_id, week_start=None, month_first=None, scheduled_date=None
) -> Task:
    """Copia os campos do template no instante do placement — a `Task`
    resultante nunca relê o template depois (AC #3, snapshot). `source_template`
    existe só para linhagem/auditoria."""
    template = live_templates().get(id=template_id)  # auto-escopado + vivos; 404 na view
    common = dict(
        title=template.title,
        description=template.description,
        eisenhower=template.eisenhower,
        category=template.category,
        source_template=template,
    )
    if template.recurrence_group == RecurringTaskTemplate.RecurrenceGroup.WEEKLY:
        if week_start is None:
            raise WrongPlacementContainer("Template weekly requer week_start.")
        container = get_or_create_weekly_log(user=user, week_start=week_start)
        return create_task(user=user, weekly_log=container, scheduled_date=scheduled_date, **common)
    # monthly E annual colocam no mesmo container (Monthly Log) — AD-08 item 5:
    # recurrence_group só controla EM QUAL abertura de ciclo o template é
    # apresentado, não onde a instância é colocada. Não existe "log anual".
    if month_first is None:
        raise WrongPlacementContainer("Template monthly/annual requer month_first.")
    container = get_or_create_monthly_log(user=user, month_first=month_first)
    return create_task(user=user, monthly_log=container, scheduled_date=scheduled_date, **common)
