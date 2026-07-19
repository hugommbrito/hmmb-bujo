"""Serializers das Métricas de Saúde (§6.3): split leitura/escrita, view fina.

Saída = ``ModelSerializer`` com ``fields`` explícito (nunca ``"__all__"``). Entrada =
``Serializer`` plano com ``validate``. O wire é camelCase
(``djangorestframework-camel-case``): os campos ficam snake_case aqui e são
convertidos na borda (``fieldType``/``enumOptions``/``displayOrder``).

``field_type`` reusa o enum ``HealthFieldTypeEnum`` (pinado em
``SPECTACULAR_SETTINGS.ENUM_NAME_OVERRIDES`` → contrato aditivo estável).
``enum_options`` é declarado como ``ListField(child=CharField())`` para o schema
tipar ``string[]`` (um ``JSONField`` cru viraria um objeto opaco no contrato).
"""

from rest_framework import serializers

from health.models import HealthFieldDefinition, HealthFieldType

# ``display_order`` é ``PositiveIntegerField`` no model (0..2_147_483_647). Capar o
# input no serializer devolve um 400 limpo em vez de deixar um valor fora de faixa
# estourar como erro de Postgres (500) na camada de escrita.
_MAX_DISPLAY_ORDER = 2147483647


class HealthFieldDefinitionSerializer(serializers.ModelSerializer):
    """Saída: a definição de campo. ``field_type`` emite ``HealthFieldTypeEnum``."""

    enum_options = serializers.ListField(child=serializers.CharField(), read_only=True)

    class Meta:
        model = HealthFieldDefinition
        fields = ["id", "name", "field_type", "enum_options", "active", "display_order"]


class HealthFieldCreateSerializer(serializers.Serializer):
    """Entrada de criação (AC1, AC3). Valida a regra enum⇔opções (→ 400)."""

    name = serializers.CharField(max_length=200)
    field_type = serializers.ChoiceField(choices=HealthFieldType.choices)
    enum_options = serializers.ListField(
        child=serializers.CharField(max_length=200), required=False, default=list
    )
    display_order = serializers.IntegerField(
        required=False, min_value=0, max_value=_MAX_DISPLAY_ORDER
    )

    def validate(self, attrs):
        field_type = attrs["field_type"]
        options = attrs.get("enum_options") or []
        if field_type == HealthFieldType.ENUM and len(options) < 1:
            raise serializers.ValidationError(
                {"enum_options": "Campo do tipo enum exige ao menos uma opção."}
            )
        if field_type != HealthFieldType.ENUM and options:
            raise serializers.ValidationError(
                {"enum_options": "Opções só se aplicam a campos do tipo enum."}
            )
        return attrs


class HealthFieldUpdateSerializer(serializers.Serializer):
    """Entrada de edição (AC2, AC4): ``name``/``enum_options``/``display_order``/
    ``active``. ``field_type`` é **imutável** — enviá-lo é rejeitado (400). A regra
    enum⇔opções no update é validada na camada de serviço contra o ``field_type``
    atual (imutável), pois o serializer não conhece o tipo persistido."""

    _IMMUTABLE = ("field_type", "fieldType")

    name = serializers.CharField(max_length=200, required=False)
    enum_options = serializers.ListField(
        child=serializers.CharField(max_length=200), required=False
    )
    display_order = serializers.IntegerField(
        required=False, min_value=0, max_value=_MAX_DISPLAY_ORDER
    )
    active = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if any(f in self.initial_data for f in self._IMMUTABLE):
            raise serializers.ValidationError(
                {"field_type": "O tipo do campo é imutável e não pode ser alterado."}
            )
        return attrs
