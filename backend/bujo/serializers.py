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
        fields = ["id", "title", "description", "status", "eisenhower", "category", "subtasks"]

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
