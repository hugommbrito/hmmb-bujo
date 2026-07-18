"""Serializers do Sistema de Hábitos (§6.3): split leitura/escrita, view fina.

Saída = ``ModelSerializer`` com ``fields`` explícito (nunca ``"__all__"``). Entrada =
``Serializer`` plano com ``validate``. O wire é camelCase (``djangorestframework-camel-case``);
os campos ficam snake_case aqui e são convertidos na borda.

``HabitSerializer`` expõe a **versão vigente hoje** anexada em ``obj.current_version``
pela camada de serviço.
"""

from rest_framework import serializers

from habits.models import Habit, HabitGroup, HabitVersion


class HabitGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = HabitGroup
        fields = ["id", "name", "display_order"]


class HabitGroupCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)


class HabitGroupUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)


class HabitVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = HabitVersion
        fields = ["id", "habit", "weight", "active", "meta", "bonus", "effective_from"]


class HabitSerializer(serializers.ModelSerializer):
    """Hábito + campos da versão vigente hoje (``obj.current_version``)."""

    weight = serializers.DecimalField(
        max_digits=6, decimal_places=2, source="current_version.weight", read_only=True
    )
    active = serializers.BooleanField(source="current_version.active", read_only=True)
    meta = serializers.DecimalField(
        max_digits=10, decimal_places=2, source="current_version.meta",
        read_only=True, allow_null=True,
    )
    bonus = serializers.DecimalField(
        max_digits=5, decimal_places=2, source="current_version.bonus",
        read_only=True, allow_null=True,
    )
    effective_from = serializers.DateField(
        source="current_version.effective_from", read_only=True
    )

    class Meta:
        model = Habit
        fields = [
            "id", "name", "emoticon", "group", "type",
            "weight", "active", "meta", "bonus", "effective_from",
        ]


class HabitCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    emoticon = serializers.CharField(max_length=16, required=False, allow_blank=True, default="")
    group = serializers.UUIDField()
    type = serializers.ChoiceField(choices=Habit.Type.choices)
    weight = serializers.DecimalField(max_digits=6, decimal_places=2)
    meta = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, allow_null=True
    )
    bonus = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, allow_null=True
    )

    def validate(self, attrs):
        if attrs["type"] != Habit.Type.NUMERIC and (
            attrs.get("meta") is not None or attrs.get("bonus") is not None
        ):
            raise serializers.ValidationError(
                {"meta": "Meta e bonus só se aplicam a hábitos numéricos."}
            )
        return attrs


class HabitUpdateSerializer(serializers.Serializer):
    """Atualiza identidade. ``type`` é imutável — enviá-lo é rejeitado (400)."""

    name = serializers.CharField(max_length=200, required=False)
    emoticon = serializers.CharField(max_length=16, required=False, allow_blank=True)
    group = serializers.UUIDField(required=False)

    def validate(self, attrs):
        if "type" in self.initial_data:
            raise serializers.ValidationError(
                {"type": "O tipo do hábito é imutável e não pode ser alterado."}
            )
        return attrs


class HabitVersionCreateSerializer(serializers.Serializer):
    """Nova versão prospectiva: mudança de peso/meta/bonus e/ou desativar/reativar.

    Todos os campos são opcionais — os não informados herdam da versão vigente.
    """

    weight = serializers.DecimalField(max_digits=6, decimal_places=2, required=False)
    meta = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, allow_null=True
    )
    bonus = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, allow_null=True
    )
    active = serializers.BooleanField(required=False)
