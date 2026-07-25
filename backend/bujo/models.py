"""Daily Log e agregado ``Task`` (FR-1.3/1.4/1.5, AD-02, AD-03).

Schema congelado pela Story 3.1: os campos de linhagem (``migrated_to_task``,
``migration_count``, ``parent_task``, ``source_template_id``) já existem aqui,
nulos/inertes, para que o Épico 4 consuma sem precisar alterar o schema.
"""

from django.db import models

from core.models import TenantModel


class Log(TenantModel):
    """Daily Log — um por ``(user, log_date)``, materializado sob demanda."""

    log_date = models.DateField()

    class Meta:
        db_table = "logs"
        constraints = [
            models.UniqueConstraint(
                fields=["user_id", "log_date"], name="uniq_log_user_id_log_date"
            ),
        ]


class CycleStatus(models.TextChoices):
    """Estado do ciclo operacional de um Weekly/Monthly Log (AD-28, Story 14.1).

    Definida no nível do módulo (não aninhada nos models) pelo MESMO motivo
    documentado em ``TaskStatus``: uma classe aninhada em ``Meta`` não enxerga o
    namespace do model (só o do módulo), então os `CheckConstraint` abaixo não
    conseguiriam referenciar ``WeeklyLog.Status.values``. Exposta como
    ``WeeklyLog.Status`` / ``MonthlyLog.Status``.

    **``NULL`` é a 3ª semântica, e não tem valor no enum:** um log com
    ``status IS NULL`` está *fora do regime operacional* — nasceu por
    materialização sob demanda (navegação, POST de tarefa, Brain Dump, placement
    de recorrente, migração) e nunca passou por um ritual. Entrar no regime é
    SEMPRE ato de ritual explícito (AD-28 item 3), por isso não existe valor
    ``none``: a ausência de estado é a ausência de ciclo, não um estado a mais.
    """

    PLANNING = "planning"
    ACTIVE = "active"
    FINALIZED = "finalized"


def _cycle_status_constraints(prefix: str) -> list:
    """Constraints de estado de ciclo para uma das duas tabelas de log.

    Extraídas em helper porque `weekly_log` e `monthly_log` recebem colunas
    IDÊNTICAS (AD-28 item 1) — copiar os 3 blocos criaria a dívida de
    divergência entre gêmeos (lição da Story 13.3/13.4). Só os NOMES das
    constraints diferem, e nomes precisam ser únicos por tabela.
    """
    return [
        models.CheckConstraint(
            condition=models.Q(status__in=CycleStatus.values) | models.Q(status__isnull=True),
            name=f"{prefix}_status_valid",
        ),
        # UniqueConstraint parcial: gera `CREATE UNIQUE INDEX ... WHERE status='active'`
        # no Postgres (precedente: medications/models.py:236-244). "Unicidade no banco,
        # não na disciplina" (AD-28 item 2) — um `active` E um `planning` simultâneos
        # é o estado NORMAL do método (planeja o próximo enquanto o atual corre).
        models.UniqueConstraint(
            fields=["user_id"],
            condition=models.Q(status=CycleStatus.ACTIVE),
            name=f"uniq_{prefix}_active_per_user",
        ),
        models.UniqueConstraint(
            fields=["user_id"],
            condition=models.Q(status=CycleStatus.PLANNING),
            name=f"uniq_{prefix}_planning_per_user",
        ),
    ]


class WeeklyLog(TenantModel):
    """Weekly Log — um por (user, week_start), week_start SEMPRE segunda (AD-05).

    Também É o ciclo operacional semanal (1:1 por `(user, week_start)`): não há
    tabela de ciclo separada, o estado mora em colunas aqui (AD-28 item 1).
    """

    Status = CycleStatus

    week_start = models.DateField()
    body = models.JSONField(default=dict, blank=True)
    status = models.CharField(  # noqa: DJ001 - NULL é a 3ª semântica (fora do regime operacional), não string vazia — AD-28 item 1
        max_length=16, choices=CycleStatus.choices, null=True, blank=True, default=None
    )
    # Marco "planejamento concluído": TIMESTAMP, nunca booleano (AD-28 item 1) —
    # o ritual permanece revisitável depois de concluído, então o valor é a data
    # da declaração, não um flag de "fechado".
    planning_completed_at = models.DateTimeField(null=True, blank=True, default=None)

    class Meta:
        db_table = "weekly_log"
        constraints = [
            models.UniqueConstraint(
                fields=["user_id", "week_start"], name="uniq_weekly_log_user_id_week_start"
            ),
            models.CheckConstraint(
                condition=models.Q(week_start__iso_week_day=1), name="week_start_is_monday"
            ),
            *_cycle_status_constraints("weekly_log"),
        ]


class MonthlyLog(TenantModel):
    """Monthly Log — um por (user, month_first), month_first SEMPRE dia 1 (AD-05).

    O Future Log NÃO é uma entidade separada: é o conjunto dos MonthlyLog de
    meses futuros (ver Dev Notes "Future Log = monthly_log futuro"). Monthlies
    futuros usados só como armazenamento do Future Log permanecem com
    `status IS NULL` — consultá-los não cria nem inicia ciclo operacional
    (AD-28 item 3).
    """

    Status = CycleStatus

    month_first = models.DateField()
    body = models.JSONField(default=dict, blank=True)
    status = models.CharField(  # noqa: DJ001 - NULL é a 3ª semântica (fora do regime operacional), não string vazia — AD-28 item 1
        max_length=16, choices=CycleStatus.choices, null=True, blank=True, default=None
    )
    planning_completed_at = models.DateTimeField(null=True, blank=True, default=None)

    class Meta:
        db_table = "monthly_log"
        constraints = [
            models.UniqueConstraint(
                fields=["user_id", "month_first"], name="uniq_monthly_log_user_id_month_first"
            ),
            models.CheckConstraint(
                condition=models.Q(month_first__day=1), name="month_first_is_day_one"
            ),
            *_cycle_status_constraints("monthly_log"),
        ]


class TaskStatus(models.TextChoices):
    """Definida no nível do módulo (não aninhada em ``Task``): uma classe
    aninhada em ``Meta`` não enxerga o namespace de ``Task`` (só o do módulo),
    então o `CheckConstraint` abaixo não conseguiria referenciar
    ``Task.Status.values`` se ``Status`` fosse aninhada. Exposta como
    ``Task.Status`` logo abaixo para manter o acesso ``Task.Status.PENDING``.
    """

    PENDING = "pending"
    STARTED = "started"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    MIGRATED = "migrated"
    POSTPONED = "postponed"


class Task(TenantModel):
    Status = TaskStatus

    class Eisenhower(models.TextChoices):
        URGENT_IMPORTANT = "ui"
        URGENT = "u"
        IMPORTANT = "i"
        NONE = "none"

    class Category(models.TextChoices):
        TEAL = "teal"
        PURPLE = "purple"
        PINK = "pink"
        YELLOW = "yellow"
        GREEN = "green"
        BLUE = "blue"

    log = models.ForeignKey(
        Log, null=True, blank=True, on_delete=models.CASCADE, related_name="tasks"
    )
    weekly_log = models.ForeignKey(
        WeeklyLog, null=True, blank=True, on_delete=models.CASCADE, related_name="tasks"
    )
    monthly_log = models.ForeignKey(
        MonthlyLog, null=True, blank=True, on_delete=models.CASCADE, related_name="tasks"
    )
    # Dia específico opcional dentro de um weekly/monthly log. null = "só o mês/semana,
    # sem dia" (Future Log parcial, FR-1.2). Em daily log fica null (o dia é o do log).
    scheduled_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.PENDING
    )
    eisenhower = models.CharField(  # noqa: DJ001 - AC exige nulável (nenhum valor definido, não string vazia)
        max_length=8, choices=Eisenhower.choices, null=True, blank=True
    )
    category = models.CharField(  # noqa: DJ001 - ausência de categoria é um valor válido (ver Dev Notes)
        max_length=8, choices=Category.choices, null=True, blank=True
    )
    order_index = models.FloatField()
    title = models.CharField(max_length=500)
    description = models.TextField(null=True, blank=True)  # noqa: DJ001 - AC exige nulável (ver Dev Notes/AD-03)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # "Aguardando Terceiro" (FR-4.15, AD-18 itens 3-5): anotação sobre a tarefa,
    # NÃO um estado — o enum de 6 estados (`TaskStatus`) permanece congelado
    # (proibido 7º estado). Ortogonal ao `status` (transições não a alteram e
    # alterná-la não muda o `status`) e herdada pelo sucessor na migração.
    waiting_on = models.BooleanField(default=False)

    # Congelados/inertes (Épico 4 — linhagem de migração e subtarefas).
    migrated_to_task = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="migrated_from",
    )
    migration_count = models.PositiveIntegerField(default=0)
    parent_task = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="subtasks",
    )
    # Nome do campo Python SEM `_id` — Django adiciona o sufixo à coluna
    # automaticamente, então a coluna continua `source_template_id`, igual ao
    # nome usado desde a 3.1 (mesma convenção de parent_task/migrated_to_task).
    # "RecurringTaskTemplate" como string: a classe só é definida abaixo de Task.
    source_template = models.ForeignKey(
        "RecurringTaskTemplate",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="instances",
    )

    class Meta:
        db_table = "tasks"
        ordering = ["order_index"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=TaskStatus.values),
                name="task_status_valid",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(log__isnull=False, weekly_log__isnull=True, monthly_log__isnull=True)
                    | models.Q(log__isnull=True, weekly_log__isnull=False, monthly_log__isnull=True)
                    | models.Q(log__isnull=True, weekly_log__isnull=True, monthly_log__isnull=False)
                ),
                name="task_exactly_one_log",
            ),
        ]


class RitualDecisionKind(models.TextChoices):
    """As três decisões de ritual que **não mutam o item** (AD-28 item 6).

    Definida no nível do módulo (não aninhada em ``RitualDecision``) pelo MESMO
    motivo já documentado em ``TaskStatus``/``CycleStatus``: uma classe aninhada
    não é visível do namespace de ``Meta``, então o `CheckConstraint` abaixo não
    conseguiria referenciar ``RitualDecision.Decision.values``. Exposta como
    ``RitualDecision.Decision``.

    Cada valor é amarrado a **um** contexto de ritual pela matriz única do
    serviço (``bujo/services/rituals.py``), não por convenção:

    - ``keep`` — "manter" uma ``Task`` datada do Monthly na semana (M06 fonte 1);
    - ``skip_week`` — "não alocar nesta semana" um ``RecurringTaskTemplate``
      weekly, sem desativá-lo (M06 fonte 3). Decide sobre um **template**, não
      sobre uma Task (AD-28 item 6);
    - ``keep_undated`` — "manter sem dia" um item do Future Log já pertencente ao
      Monthly-alvo (M07 fonte 2).

    Decisões **mutantes** (migrar/alocar/concluir/cancelar/adiar) NÃO entram
    aqui: a própria mutação é a persistência, e registrar em dobro criaria uma
    segunda verdade (AD-28 item 6).
    """

    KEEP = "keep"
    SKIP_WEEK = "skip_week"
    KEEP_UNDATED = "keep_undated"


def _ritual_decision_uniques() -> list:
    """As quatro uniques **parciais** de ``(alvo, item)``, uma por combinação legal.

    Derivadas do produto cartesiano das duas âncoras em vez de escritas quatro
    vezes: os quatro blocos seriam idênticos a menos dos nomes de coluna, e
    copiá-los é exatamente a dívida de divergência entre gêmeos que as retros dos
    Épicos 13/14 mandam evitar (mesmo motivo de ``_cycle_status_constraints``).

    Uma unique parcial por par (e não uma única sobre as 4 colunas) porque no
    Postgres cada ``NULL`` é distinto de todo outro ``NULL``: a unique de 4
    colunas com 2 sempre nulas **nunca** colidiria, e a segunda linha do mesmo
    ``(alvo, item)`` passaria. ``condition=`` (Django 5.2; ``check=`` deprecado)
    gera ``CREATE UNIQUE INDEX ... WHERE`` — precedente ``medications/models.py``.
    """
    return [
        models.UniqueConstraint(
            fields=[target, item],
            condition=models.Q(**{f"{target}__isnull": False, f"{item}__isnull": False}),
            name=f"uniq_ritual_decision_{short_target}_{short_item}",
        )
        for target, short_target in (("weekly_log", "weekly"), ("monthly_log", "monthly"))
        for item, short_item in (("task", "task"), ("recurring_template", "recurring"))
    ]


class RitualDecision(TenantModel):
    """Decisão-snapshot de um ritual: um registro por (ritual-alvo × item).

    Tabela própria porque a decisão é **relativa ao alvo**, não um atributo do
    item: o mesmo template pode ser "não alocado" na semana X e alocado na X+1, e
    a ``Task`` **jamais** é tocada por uma decisão-snapshot (AD-28 item 6, ponto 8).

    Duas âncoras **exclusivas** (padrão CHECK *exactly-one* da AD-03/AD-20, a
    mesma forma de ``Task.Meta.task_exactly_one_log``): o alvo é um weekly XOR um
    monthly; o item é uma ``Task`` XOR um ``RecurringTaskTemplate``.

    Unicidade ``(alvo, item)`` por **uniques parciais por combinação** (quatro,
    uma por par legal) em vez de uma unique sobre as quatro colunas: no Postgres
    ``UNIQUE`` trata ``NULL`` como distinto de qualquer outro ``NULL``, então uma
    unique de 4 colunas com 2 nulas nunca colidiria e a segunda linha do mesmo
    par passaria. Re-decidir é **upsert no serviço**, nunca segunda linha.

    NÃO existe coluna de progresso/contador aqui nem nos logs: progresso de
    ritual é **derivado** na leitura (elegíveis − mutados − decididos), AD-28
    item 6 ponto 7.
    """

    Decision = RitualDecisionKind

    # Alvo do ritual — exatamente um.
    weekly_log = models.ForeignKey(
        WeeklyLog,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="ritual_decisions",
    )
    monthly_log = models.ForeignKey(
        MonthlyLog,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="ritual_decisions",
    )
    # Item decidido — exatamente um. `CASCADE` nos dois: apagar a Task (hard
    # delete de `pending`) ou o template leva a decisão embora, sem órfã.
    task = models.ForeignKey(
        Task,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="ritual_decisions",
    )
    recurring_template = models.ForeignKey(
        "RecurringTaskTemplate",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="ritual_decisions",
    )
    # NOT NULL e SEM default: uma decisão sem valor não é uma decisão.
    decision = models.CharField(max_length=16, choices=RitualDecisionKind.choices)
    created_at = models.DateTimeField(auto_now_add=True)
    # `updated_at` é o que permite PROVAR o upsert idempotente: re-decidir a
    # mesma tupla com o mesmo valor não emite `UPDATE`, então o timestamp fica
    # intacto.
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Plural, como a AD-28 nomeia. A divergência do singular vale só para
        # `weekly_log`/`monthly_log`, que são preexistentes.
        db_table = "ritual_decisions"
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(weekly_log__isnull=False, monthly_log__isnull=True)
                    | models.Q(weekly_log__isnull=True, monthly_log__isnull=False)
                ),
                name="ritual_decision_exactly_one_target",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(task__isnull=False, recurring_template__isnull=True)
                    | models.Q(task__isnull=True, recurring_template__isnull=False)
                ),
                name="ritual_decision_exactly_one_item",
            ),
            models.CheckConstraint(
                condition=models.Q(decision__in=RitualDecisionKind.values),
                name="ritual_decision_valid",
            ),
            *_ritual_decision_uniques(),
        ]


class RecurringTaskTemplate(TenantModel):
    """Catálogo de recorrentes (AD-08) — tabela separada de `Task`, sem
    `status`/`log_id`/ciclo de vida: um template nunca migra, só é colocado
    (placement manual, sem auto-placement) e vira uma `Task` snapshot."""

    class RecurrenceGroup(models.TextChoices):
        WEEKLY = "weekly"
        MONTHLY = "monthly"
        ANNUAL = "annual"

    title = models.CharField(max_length=500)
    description = models.TextField(null=True, blank=True)  # noqa: DJ001 - mesma semântica nulável de Task.description
    eisenhower = models.CharField(  # noqa: DJ001 - default copiado no placement; ausência é valor válido
        max_length=8, choices=Task.Eisenhower.choices, null=True, blank=True
    )
    category = models.CharField(  # noqa: DJ001 - mesma semântica nulável de Task.category
        max_length=8, choices=Task.Category.choices, null=True, blank=True
    )
    recurrence_group = models.CharField(max_length=8, choices=RecurrenceGroup.choices)
    # livre, NÃO parseado (addendum AD-08 item 4) — só exibição
    recurrence_text = models.TextField()
    # booleano simples, SEM versionamento (AD-08 item 6 — YAGNI consciente)
    active = models.BooleanField(default=True)
    # soft delete de M09/UX-DR24: NULL = vivo, preenchido = excluído. Contraste
    # DELIBERADO com `active` logo acima — `active` é reversível e prospectivo (o
    # inativo continua na biblioteca, visível com filtro), `deleted_at` é terminal
    # (some da biblioteca E das fontes dos rituais, sem caminho de volta na API).
    # Os dois eixos são ortogonais: excluir não mexe em `active`.
    # O registro persiste porque `Task.source_template` (:229-235) aponta para ele
    # com `SET_NULL`: exclusão física apagaria a linhagem em silêncio.
    # SEM índice parcial de propósito: tabela de caderno pessoal (dezenas de
    # linhas) com `user_id` já indexado — índice aqui seria otimização
    # especulativa, não esquecimento.
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "recurring_task_templates"
