"""Serializers de leitura/escrita do Daily Log (§6.2, §6.3): view fina, sem
regra de negócio — só expõem/validam os campos já validados/persistidos pelos
serviços.
"""

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from bujo.models import Log, Task


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


class MonthlyLogSerializer(serializers.Serializer):
    month_first = serializers.DateField()
    tasks = TaskSerializer(many=True)


class FutureLogMonthGroupSerializer(serializers.Serializer):
    year = serializers.IntegerField()
    month = serializers.IntegerField()
    tasks = TaskSerializer(many=True)


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
