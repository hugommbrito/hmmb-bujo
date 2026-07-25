"""Serializers de leitura/escrita do Daily Log (§6.2, §6.3): view fina, sem
regra de negócio — só expõem/validam os campos já validados/persistidos pelos
serviços.
"""

from datetime import timedelta

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from bujo.filters import TaskFilter
from bujo.models import (
    Log,
    RecurringTaskTemplate,
    RitualDecision,
    RitualDecisionKind,
    Task,
)


class TaskSerializer(serializers.ModelSerializer):
    subtasks = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            "id",
            "title",
            "description",
            "status",
            "eisenhower",
            "category",
            "scheduled_date",
            "subtasks",
            # Flag "Aguardando Terceiro" (Story 12.2, AD-18): read-only aqui,
            # sai como `waitingOn` via `CamelCaseJSONRenderer`. A escrita é pelo
            # `TaskUpdateSerializer` (PATCH); criar tarefa já com a flag não é
            # requisito (nasce `false` pelo default do model).
            "waiting_on",
            "migration_count",
            "migrated_to_task",
            # Story 11.3 (AC1): habilita o dedup client-side. Revoga a decisão
            # YAGNI da Story 4.5 (Task 9.4) de NÃO expor a linhagem — a AC1
            # exige que o cliente saiba quais templates já foram colocados no
            # período. Read-only por natureza (FK gravada só no placement
            # service; nenhum write path de tarefa a aceita). Subtarefas
            # carregam `null` (nascem sem template, AD-08 item 8).
            "source_template",
        ]

    def get_subtasks(self, obj):
        return TaskSerializer(obj.subtasks.all(), many=True).data


# `get_subtasks` referencia `TaskSerializer` recursivamente — o decorador só
# pode ser aplicado depois que a classe termina de ser definida (dentro do
# corpo da classe o nome `TaskSerializer` ainda não existe no módulo).
extend_schema_field(TaskSerializer(many=True))(TaskSerializer.get_subtasks)


class LogSerializer(serializers.ModelSerializer):
    tasks = serializers.SerializerMethodField()

    class Meta:
        model = Log
        fields = ["id", "log_date", "tasks"]

    @extend_schema_field(TaskSerializer(many=True))
    def get_tasks(self, obj):
        roots = obj.tasks.filter(parent_task__isnull=True)
        # Filtro `?waitingOn=` (Story 12.2, AC3) só quando há `request` no
        # contexto — o endpoint o injeta; `LogSerializer(log).data` sem contexto
        # (ex.: test_serializers) não filtra nada. `.qs` preserva a ordenação
        # `Meta.ordering = ["order_index"]` do model.
        request = self.context.get("request")
        if request is not None:
            roots = TaskFilter(request.query_params, queryset=roots, request=request).qs
        return TaskSerializer(roots, many=True).data


class TaskCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=500)
    description = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    eisenhower = serializers.ChoiceField(
        choices=Task.Eisenhower.choices, required=False, allow_null=True
    )
    category = serializers.ChoiceField(
        choices=Task.Category.choices, required=False, allow_null=True
    )


class TaskUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=500, required=False)
    description = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    eisenhower = serializers.ChoiceField(
        choices=Task.Eisenhower.choices, required=False, allow_null=True
    )
    category = serializers.ChoiceField(
        choices=Task.Category.choices, required=False, allow_null=True
    )
    scheduled_date = serializers.DateField(required=False, allow_null=True)
    # Alterna "Aguardando Terceiro" (Story 12.2, AC2): o corpo chega como
    # `waitingOn` e o `CamelCaseJSONParser` converte para `waiting_on` antes do
    # serializer. `update_task` já repassa o campo genéricamente (setattr +
    # save escopado), então a ortogonalidade com o `status` é automática.
    waiting_on = serializers.BooleanField(required=False)


class TaskReorderSerializer(serializers.Serializer):
    target_task_id = serializers.UUIDField()
    position = serializers.ChoiceField(choices=["before", "after"])


class WeeklyDaySerializer(serializers.Serializer):
    date = serializers.DateField()
    tasks = TaskSerializer(many=True)


# Campos ADITIVOS de ciclo (Story 14.1, AC8) nas duas respostas de log. `closed`
# permanece com o mesmo nome e tipo — o contrato do Daily legado não muda (AC5).
# Ambos nuláveis: `null` = ciclo fora do regime operacional / planejamento nunca
# declarado, que é o estado de todo log materializado sob demanda (AC4).
class _CycleFieldsMixin(metaclass=serializers.SerializerMetaclass):
    status = serializers.CharField(allow_null=True)
    planning_completed_at = serializers.DateTimeField(allow_null=True)


class WeeklyLogSerializer(_CycleFieldsMixin, serializers.Serializer):
    week_start = serializers.DateField()
    days = WeeklyDaySerializer(many=True)
    unscheduled = TaskSerializer(many=True)
    closed = serializers.BooleanField()


class MonthlyLogSerializer(_CycleFieldsMixin, serializers.Serializer):
    month_first = serializers.DateField()
    tasks = TaskSerializer(many=True)
    closed = serializers.BooleanField()


# --- Ciclo operacional (Story 14.1, AC8) ---------------------------------------
# Um endpoint de ação por tipo, com campo `action`, espelhando
# `tasks/<pk>/transition/` (que já recebe `to_status`): mantém a superfície de URL
# e o diff de OpenAPI mínimos. O serializer valida FORMA; toda regra de transição
# vive em `services/cycles.py` (§6.6 — nunca `validate_status()` em serializer).
WEEKLY_CYCLE_ACTIONS = [
    "open_planning_target",
    "complete_planning",
    "start",
    "finalize",
    "cancel_planning_target",
]
# Sem `cancel_planning_target`: "O Monthly não herda a ação Cancelar planejamento
# vazio do Weekly" (M07). A ausência é regra de produto, não omissão.
MONTHLY_CYCLE_ACTIONS = [
    "open_planning_target",
    "complete_planning",
    "start",
    "finalize",
]


class WeeklyCycleActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=WEEKLY_CYCLE_ACTIONS)
    # Opcional: `open_planning_target` aceita omitir para mirar a semana corrente.
    week_start = serializers.DateField(required=False)

    def validate(self, attrs):
        week_start = attrs.get("week_start")
        if week_start is not None and week_start.isoweekday() != 1:
            raise serializers.ValidationError({"week_start": "Deve ser uma segunda-feira."})
        if attrs["action"] != "open_planning_target" and week_start is None:
            raise serializers.ValidationError(
                {"week_start": "Obrigatório para esta ação."}
            )
        return attrs


class MonthlyCycleActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=MONTHLY_CYCLE_ACTIONS)
    # `open_planning_target` IGNORA este campo: o alvo mensal é determinístico
    # (mês seguinte ao `active`), sem escolha nem retargeting (M07).
    month_first = serializers.DateField(required=False)

    def validate(self, attrs):
        month_first = attrs.get("month_first")
        if month_first is not None and month_first.day != 1:
            raise serializers.ValidationError(
                {"month_first": "Deve ser o primeiro dia do mês."}
            )
        if attrs["action"] != "open_planning_target" and month_first is None:
            raise serializers.ValidationError(
                {"month_first": "Obrigatório para esta ação."}
            )
        return attrs


class WeeklyCycleSerializer(_CycleFieldsMixin, serializers.Serializer):
    week_start = serializers.DateField()


class MonthlyCycleSerializer(_CycleFieldsMixin, serializers.Serializer):
    month_first = serializers.DateField()
    # Janela regular da virada (`core.calendar.month_turn_week`) — leitura
    # INFORMATIVA: fora dela o mesmo ritual segue disponível como regularização
    # atrasada, e nenhum serviço a usa como pré-condição (AC3).
    regular_window_start = serializers.DateField()
    regular_window_end = serializers.DateField()


class ArchiveEntrySerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=["weekly", "monthly"])
    week_start = serializers.DateField(required=False, allow_null=True)
    month_first = serializers.DateField(required=False, allow_null=True)


class FutureLogMonthGroupSerializer(serializers.Serializer):
    year = serializers.IntegerField()
    month = serializers.IntegerField()
    tasks = TaskSerializer(many=True)


class MigrationQueueSerializer(serializers.Serializer):
    log_date = serializers.DateField()
    tasks = TaskSerializer(many=True)


class WeeklyReviewQueueSerializer(serializers.Serializer):
    week_start = serializers.DateField()
    tasks = TaskSerializer(many=True)


class MonthlyReviewQueueSerializer(serializers.Serializer):
    month_first = serializers.DateField()
    tasks = TaskSerializer(many=True)


class CatchUpQueueSerializer(serializers.Serializer):
    monthly_tasks = TaskSerializer(many=True)
    weekly_tasks = TaskSerializer(many=True)
    daily_tasks = TaskSerializer(many=True)


class TaskMigrateSerializer(serializers.Serializer):
    destination = serializers.ChoiceField(choices=["today", "week", "month", "future", "cancel"])
    month_first = serializers.DateField(required=False)
    scheduled_date = serializers.DateField(required=False, allow_null=True)

    def validate(self, attrs):
        destination = attrs["destination"]
        if destination == "future":
            if not attrs.get("month_first"):
                raise serializers.ValidationError(
                    {"month_first": "Obrigatório para adiar no futuro."}
                )
            if attrs["month_first"].day != 1:
                raise serializers.ValidationError(
                    {"month_first": "Deve ser o primeiro dia do mês."}
                )
            scheduled_date = attrs.get("scheduled_date")
            if scheduled_date and (scheduled_date.year, scheduled_date.month) != (
                attrs["month_first"].year,
                attrs["month_first"].month,
            ):
                raise serializers.ValidationError(
                    {"scheduled_date": "A data deve pertencer ao mês/ano de monthFirst."}
                )
        return attrs


class MonthlyTaskCreateSerializer(serializers.Serializer):
    month_first = serializers.DateField()
    title = serializers.CharField(max_length=500)
    scheduled_date = serializers.DateField(required=False, allow_null=True)
    description = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    eisenhower = serializers.ChoiceField(
        choices=Task.Eisenhower.choices, required=False, allow_null=True
    )
    category = serializers.ChoiceField(
        choices=Task.Category.choices, required=False, allow_null=True
    )

    def validate(self, attrs):
        month_first = attrs["month_first"]
        if month_first.day != 1:
            raise serializers.ValidationError(
                {"month_first": "Deve ser o primeiro dia do mês."}
            )
        scheduled_date = attrs.get("scheduled_date")
        if scheduled_date is not None and (
            scheduled_date.year,
            scheduled_date.month,
        ) != (month_first.year, month_first.month):
            raise serializers.ValidationError(
                {"scheduled_date": "A data deve pertencer ao mês/ano de month_first."}
            )
        return attrs


class WeeklyTaskCreateSerializer(serializers.Serializer):
    week_start = serializers.DateField()
    title = serializers.CharField(max_length=500)
    scheduled_date = serializers.DateField(required=False, allow_null=True)
    description = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    eisenhower = serializers.ChoiceField(
        choices=Task.Eisenhower.choices, required=False, allow_null=True
    )
    category = serializers.ChoiceField(
        choices=Task.Category.choices, required=False, allow_null=True
    )

    def validate(self, attrs):
        week_start = attrs["week_start"]
        if week_start.isoweekday() != 1:
            raise serializers.ValidationError(
                {"week_start": "Deve ser uma segunda-feira."}
            )
        scheduled_date = attrs.get("scheduled_date")
        if scheduled_date is not None and not (
            week_start <= scheduled_date <= week_start + timedelta(days=6)
        ):
            raise serializers.ValidationError(
                {"scheduled_date": "A data deve pertencer à semana de week_start."}
            )
        return attrs


class TaskDensityQuerySerializer(serializers.Serializer):
    """Valida o query param do endpoint de densidade (Story 11.3, AC2).

    `month_first` é obrigatório e deve ser o 1º dia do mês — mesma semântica de
    `MonthlyTaskCreateSerializer`.
    """

    month_first = serializers.DateField()

    def validate_month_first(self, value):
        if value.day != 1:
            raise serializers.ValidationError("Deve ser o primeiro dia do mês.")
        return value


class TaskDensityEntrySerializer(serializers.Serializer):
    date = serializers.DateField()
    count = serializers.IntegerField()


class TaskDensityResponseSerializer(serializers.Serializer):
    density = TaskDensityEntrySerializer(many=True)


class RecurringTaskTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecurringTaskTemplate
        fields = [
            "id",
            "title",
            "description",
            "eisenhower",
            "category",
            "recurrence_group",
            "recurrence_text",
            "active",
        ]


class RecurringTaskTemplateCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=500)
    description = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    eisenhower = serializers.ChoiceField(
        choices=Task.Eisenhower.choices, required=False, allow_null=True
    )
    category = serializers.ChoiceField(
        choices=Task.Category.choices, required=False, allow_null=True
    )
    recurrence_group = serializers.ChoiceField(
        choices=RecurringTaskTemplate.RecurrenceGroup.choices
    )
    recurrence_text = serializers.CharField()
    active = serializers.BooleanField(required=False, default=True)


class RecurringTaskTemplateUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=500, required=False)
    description = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    eisenhower = serializers.ChoiceField(
        choices=Task.Eisenhower.choices, required=False, allow_null=True
    )
    category = serializers.ChoiceField(
        choices=Task.Category.choices, required=False, allow_null=True
    )
    recurrence_group = serializers.ChoiceField(
        choices=RecurringTaskTemplate.RecurrenceGroup.choices, required=False
    )
    recurrence_text = serializers.CharField(required=False)
    active = serializers.BooleanField(required=False)


class RecurringTaskTemplatePlaceSerializer(serializers.Serializer):
    week_start = serializers.DateField(required=False)
    month_first = serializers.DateField(required=False)
    scheduled_date = serializers.DateField(required=False, allow_null=True)


# --- Rituais: decisões-snapshot e fontes (Story 14.2) --------------------------
# Distinção deliberada de responsabilidade (§6.6): o serializer valida **forma**
# (400) — exatamente um alvo, exatamente um item, `week_start` numa segunda,
# `month_first` no dia 1. A **matriz** de combinação legal `(alvo, item, decisão)`
# é regra de produto e vive no serviço, devolvendo 409. Forma é validação;
# combinação é regra.
class RitualDecisionCreateSerializer(serializers.Serializer):
    """Corpo do `POST /api/bujo/ritual-decisions/`.

    Campos no CORPO, então chegam do fio em camelCase (`weekStart`, `taskId`,
    `recurringTemplateId`) e o `CamelCaseJSONParser` converte antes do serializer.
    """

    decision = serializers.ChoiceField(choices=RitualDecisionKind.choices)
    week_start = serializers.DateField(required=False)
    month_first = serializers.DateField(required=False)
    task_id = serializers.UUIDField(required=False)
    recurring_template_id = serializers.UUIDField(required=False)

    def validate(self, attrs):
        week_start = attrs.get("week_start")
        month_first = attrs.get("month_first")
        if (week_start is None) == (month_first is None):
            raise serializers.ValidationError(
                "Informe exatamente um alvo: weekStart (ritual semanal) ou monthFirst (mensal)."
            )
        if (attrs.get("task_id") is None) == (attrs.get("recurring_template_id") is None):
            raise serializers.ValidationError(
                "Informe exatamente um item: taskId ou recurringTemplateId."
            )
        if week_start is not None and week_start.isoweekday() != 1:
            raise serializers.ValidationError({"week_start": "Deve ser uma segunda-feira."})
        if month_first is not None and month_first.day != 1:
            raise serializers.ValidationError({"month_first": "Deve ser o primeiro dia do mês."})
        return attrs


class RitualDecisionSerializer(serializers.Serializer):
    """Resposta do `POST /api/bujo/ritual-decisions/`.

    O alvo volta como a **chave de período** que o cliente enviou (`weekStart` /
    `monthFirst`), não como o id do log: o id é opaco para quem endereça o ritual
    por semana/mês, e devolvê-lo obrigaria o cliente a uma segunda leitura só para
    saber a qual ritual a decisão que ele acabou de gravar pertence. O item volta
    como `taskId`/`recurringTemplateId` — o mesmo identificador que entrou.
    """

    id = serializers.UUIDField()
    decision = serializers.CharField()
    week_start = serializers.SerializerMethodField()
    month_first = serializers.SerializerMethodField()
    task_id = serializers.UUIDField(allow_null=True)
    recurring_template_id = serializers.UUIDField(allow_null=True)
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()

    @extend_schema_field(serializers.DateField(allow_null=True))
    def get_week_start(self, decisao: RitualDecision):
        return decisao.weekly_log.week_start if decisao.weekly_log_id else None

    @extend_schema_field(serializers.DateField(allow_null=True))
    def get_month_first(self, decisao: RitualDecision):
        return decisao.monthly_log.month_first if decisao.monthly_log_id else None


# Envelope UNIFORME das sete fontes. **Sem campo `label`** de propósito: a cópia
# pt-BR das fontes é do UI (DESIGN/EXPERIENCE são a autoridade de wording) e uma
# cópia em duas camadas é dívida garantida. O backend expõe `sourceId` estável.
class _SourceEnvelopeSerializer(serializers.Serializer):
    source_id = serializers.CharField()
    blocking = serializers.BooleanField()
    counts_toward_progress = serializers.BooleanField()
    eligible_count = serializers.IntegerField()
    pending_decision_count = serializers.IntegerField()
    reviewed = serializers.BooleanField()


# `decision` fica no ITEM da fonte, nunca no `TaskSerializer`: uma decisão é
# relativa a um alvo de ritual, e o `TaskSerializer` é compartilhado por ~10
# respostas legadas — acrescentá-lo lá mudaria contrato (AC8).
class RitualTaskItemSerializer(serializers.Serializer):
    task = TaskSerializer()
    decision = serializers.CharField(allow_null=True)


class RitualTemplateItemSerializer(serializers.Serializer):
    template = RecurringTaskTemplateSerializer()
    decision = serializers.CharField(allow_null=True)
    instances_in_target_count = serializers.IntegerField()


class _TemplateBucketSerializer(serializers.Serializer):
    """`alreadyPlaced`/`alreadyPlacedInYear` — fora do progresso e dos avisos, mas
    permanentemente consultáveis (novas instâncias continuam permitidas)."""

    counts_toward_progress = serializers.BooleanField()
    items = RitualTemplateItemSerializer(many=True)


class TaskSourceSerializer(_SourceEnvelopeSerializer):
    """Fontes cujos itens são Tasks: `monthly-in-week`, `future-log`."""

    items = RitualTaskItemSerializer(many=True)


class BlockingTaskSourceSerializer(TaskSourceSerializer):
    """`previous-weekly`/`previous-monthly`: acrescentam `readyToFinalize`."""

    ready_to_finalize = serializers.BooleanField()


class WeeklyRecurringSourceSerializer(_SourceEnvelopeSerializer):
    items = RitualTemplateItemSerializer(many=True)
    already_placed = _TemplateBucketSerializer()


class MonthlyRecurringSourceSerializer(WeeklyRecurringSourceSerializer):
    already_placed_in_year = _TemplateBucketSerializer()


class PendingDailyGroupSerializer(serializers.Serializer):
    date = serializers.DateField()
    items = RitualTaskItemSerializer(many=True)


class PendingDailiesSourceSerializer(_SourceEnvelopeSerializer):
    """A única fonte com `groups` em vez de `items` planos (AC3)."""

    groups = PendingDailyGroupSerializer(many=True)


class WeekSourceQuerySerializer(serializers.Serializer):
    """`?week_start=` em **snake_case**: a camelização do
    `djangorestframework-camel-case` cobre corpo (parser/renderer), NÃO query
    string, e é a convenção vigente do repo (`TaskDensityQuerySerializer`, e o
    cliente em `frontend/src/features/bujo/api.ts`)."""

    week_start = serializers.DateField()

    def validate_week_start(self, value):
        if value.isoweekday() != 1:
            raise serializers.ValidationError("Deve ser uma segunda-feira.")
        return value


class MonthSourceQuerySerializer(serializers.Serializer):
    month_first = serializers.DateField()

    def validate_month_first(self, value):
        if value.day != 1:
            raise serializers.ValidationError("Deve ser o primeiro dia do mês.")
        return value


# --- Densidade real (Story 14.2, AC6) ------------------------------------------
# Endpoints NOVOS: `TaskDensity*Serializer` (Story 11.3) fica intocado.
class DensityStatusBreakdownSerializer(serializers.Serializer):
    """As 6 chaves de `TaskStatus`, SEMPRE presentes (zeros inclusive).

    Nenhuma tem underscore, então a camelização de saída não as altera — o que é
    verificado por teste de fio, não deduzido.
    """

    pending = serializers.IntegerField()
    started = serializers.IntegerField()
    completed = serializers.IntegerField()
    cancelled = serializers.IntegerField()
    migrated = serializers.IntegerField()
    postponed = serializers.IntegerField()


class DensityCellSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    by_status = DensityStatusBreakdownSerializer()


class DensityDaySerializer(DensityCellSerializer):
    date = serializers.DateField()


class DensityResponseSerializer(serializers.Serializer):
    days = DensityDaySerializer(many=True)
    undated = DensityCellSerializer()
    total = serializers.IntegerField()
