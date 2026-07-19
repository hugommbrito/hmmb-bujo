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

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from health.models import HealthFieldDefinition, HealthFieldType, HealthLog

# ``display_order`` é ``PositiveIntegerField`` no model (0..2_147_483_647). Capar o
# input no serializer devolve um 400 limpo em vez de deixar um valor fora de faixa
# estourar como erro de Postgres (500) na camada de escrita.
_MAX_DISPLAY_ORDER = 2147483647


# ⚠️ O campo DEVE se chamar ``values`` (ver ``HealthLog`` model / base.py:207): o
# ``ignore_fields=("values",)`` preserva as chaves internas (UUIDs) na camelização.
# ``@extend_schema_field`` tipa o contrato como ``Record<string, number|boolean|string>``
# (§7.1:892) em vez do objeto vazio que um ``JSONField`` cru geraria — o
# ``types.gen.ts`` fica utilizável em vez de virar ``Record<string, never>``.
@extend_schema_field(
    {
        "type": "object",
        "additionalProperties": {
            "anyOf": [
                {"type": "number"},
                {"type": "boolean"},
                {"type": "string"},
            ]
        },
    }
)
class HealthValuesField(serializers.JSONField):
    """Dict opaco ``{uuid-definição: number|boolean|string}`` (AD-01, §6.10)."""


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


# --- Log diário de valores (Story 7.2, §6.10, AD-01) ---------------------------
# ``values`` é sempre um dict opaco (``HealthValuesField``) — a validação de conteúdo
# (tipo por campo, UUID ativo) é da camada de serviço, contra as definições do
# tenant (§6.4). Os serializers de escrita só garantem **forma** (``date`` é data,
# ``values`` é objeto).


class HealthLogSerializer(serializers.ModelSerializer):
    """Saída de uma linha upsertada (resposta do ``PUT``): ``{id, date, values}``."""

    values = HealthValuesField()

    class Meta:
        model = HealthLog
        fields = ["id", "date", "values"]


class HealthDaySectionSerializer(serializers.Serializer):
    """Uma seção do ritual (``yesterday``/``today``): a data + os valores do dia."""

    date = serializers.DateField()
    values = HealthValuesField()


class HealthDailySerializer(serializers.Serializer):
    """Read-model do ritual matinal (AC3): ``{yesterday, today, fields}``.

    ``yesterday``/``today`` são ``{date, values}`` (datas resolvidas pelo servidor via
    ``today_for``); ``fields`` são as definições **ativas** (reuso do serializer de
    7.1). ``fields`` é um nome de field declarado — o ``SerializerMetaclass`` o move
    para ``_declared_fields`` (``attrs.pop``), então não colide com a property
    ``Serializer.fields``.
    """

    yesterday = HealthDaySectionSerializer()
    today = HealthDaySectionSerializer()
    fields = HealthFieldDefinitionSerializer(many=True)


class HealthLogWriteSerializer(serializers.Serializer):
    """Entrada do ``PUT`` (AC1): ``{date, values}``. Só valida **forma**.

    O conteúdo de ``values`` (tipo por campo, UUID ativo, atomicidade) é validado na
    camada de serviço (``upsert_health_log``) contra as definições do tenant (§6.4)."""

    date = serializers.DateField()
    values = HealthValuesField()

    def validate_values(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError(
                "Deve ser um objeto de valores indexado por campo."
            )
        return value
