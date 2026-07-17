"""Serializers do Brain Dump (§6.2, §6.3): view fina, sem regra de negócio."""

from rest_framework import serializers

from braindump.models import BrainDumpItem


class BrainDumpItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = BrainDumpItem
        fields = ["id", "title", "description", "target_log", "created_at"]


class BrainDumpCountSerializer(serializers.Serializer):
    count = serializers.IntegerField()


class BrainDumpItemCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=500)
    description = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    target_log = serializers.ChoiceField(
        choices=BrainDumpItem.TargetLog.choices, required=False, allow_null=True
    )


class BrainDumpItemProcessSerializer(serializers.Serializer):
    destination = serializers.ChoiceField(choices=["today", "week", "month", "future"])
    month_first = serializers.DateField(required=False)
    scheduled_date = serializers.DateField(required=False, allow_null=True)

    def validate(self, attrs):
        destination = attrs["destination"]
        if destination == "future":
            if not attrs.get("month_first"):
                raise serializers.ValidationError(
                    {"month_first": "Obrigatório para mover ao Futuro."}
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
