"""Serializers de leitura do Daily Log (§6.2, §6.3): view fina, sem regra de
negócio — só expõem os campos já validados/persistidos pelos serviços.
"""

from rest_framework import serializers

from bujo.models import Log, Task


class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = ["id", "title", "status", "eisenhower", "category"]


class LogSerializer(serializers.ModelSerializer):
    tasks = TaskSerializer(many=True, read_only=True)

    class Meta:
        model = Log
        fields = ["id", "log_date", "tasks"]
