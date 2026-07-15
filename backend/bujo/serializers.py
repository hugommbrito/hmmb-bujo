"""Serializers de leitura/escrita do Daily Log (§6.2, §6.3): view fina, sem
regra de negócio — só expõem/validam os campos já validados/persistidos pelos
serviços.
"""

from datetime import timedelta

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from bujo.models import Log, RecurringTaskTemplate, Task


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


class TaskReorderSerializer(serializers.Serializer):
    target_task_id = serializers.UUIDField()
    position = serializers.ChoiceField(choices=["before", "after"])


class WeeklyDaySerializer(serializers.Serializer):
    date = serializers.DateField()
    tasks = TaskSerializer(many=True)


class WeeklyLogSerializer(serializers.Serializer):
    week_start = serializers.DateField()
    days = WeeklyDaySerializer(many=True)
    unscheduled = TaskSerializer(many=True)
    closed = serializers.BooleanField()


class MonthlyLogSerializer(serializers.Serializer):
    month_first = serializers.DateField()
    tasks = TaskSerializer(many=True)
    closed = serializers.BooleanField()


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
        if destination == "month" and not attrs.get("scheduled_date"):
            raise serializers.ValidationError(
                {"scheduled_date": "Obrigatório para adiar no mês."}
            )
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
    recurrence_group = serializers.ChoiceField(
        choices=RecurringTaskTemplate.RecurrenceGroup.choices, required=False
    )
    recurrence_text = serializers.CharField(required=False)
    active = serializers.BooleanField(required=False)


class RecurringTaskTemplatePlaceSerializer(serializers.Serializer):
    week_start = serializers.DateField(required=False)
    month_first = serializers.DateField(required=False)
    scheduled_date = serializers.DateField(required=False, allow_null=True)
