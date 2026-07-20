"""Serializers de Medicamentos (§6.3): split leitura/escrita, view fina.

Saída = ``ModelSerializer`` com ``fields`` **explícito** (nunca ``"__all__"``). Entrada =
``Serializer`` plano com ``validate``. O wire é camelCase (``djangorestframework-camel-case``):
os campos ficam snake_case aqui e são convertidos na borda (``substanceName``/
``timeBlockId``/``effectiveFrom``…).

⚠️ **Casing da dose JSONB (§6.3, AD-07):** a ``dose`` é ``[{label, amount, unit}]`` — chaves
estáticas de **palavra única**, que o ``underscoreize``/``camelize`` deixa **intactas**
(não há underscore nem fronteira de caso). Por isso ``dose`` **NÃO** entra em
``JSON_UNDERSCOREIZE.ignore_fields`` (base.py) — ao contrário de ``health_logs.values``
(indexado por UUID). O ``DoseField`` só existe para **tipar o contrato** (OpenAPI/TS) como
um array de objetos ``{label, amount, unit}``; um ``JSONField`` cru viraria um objeto opaco.
"""

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from medications.models import (
    Doctor,
    Medication,
    MedicationScheduleVersion,
    MedicationSubstanceVersion,
    Source,
    TimeBlock,
)

# ``display_order`` é ``PositiveIntegerField`` (0..2_147_483_647). Capar o input no
# serializer devolve um 400 limpo em vez de deixar um valor fora de faixa estourar
# como erro de Postgres (500) na escrita (mesmo racional de ``health``).
_MAX_DISPLAY_ORDER = 2147483647


# ``dose`` = array de componentes ``{label, amount, unit}`` (§7.1). ``@extend_schema_field``
# tipa o contrato TS como ``{ label?; amount?; unit? }[]`` em vez do objeto opaco de um
# ``JSONField`` cru. A validação de conteúdo (amount numérico, unit não-vazia, lista
# não-vazia) vive na camada de serviço (``_validate_dose``), não aqui (§6.4).
@extend_schema_field(
    {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "label": {"type": "string"},
                "amount": {"type": "number"},
                "unit": {"type": "string"},
            },
        },
    }
)
class DoseField(serializers.JSONField):
    """Lista de componentes de dose ``[{label, amount, unit}]`` (AD-07, §6.10)."""


# --- Médicos (AC6) -------------------------------------------------------------


class DoctorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Doctor
        fields = ["id", "name", "specialty"]


class DoctorCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    specialty = serializers.CharField(
        max_length=200, required=False, allow_blank=True, allow_null=True
    )


class DoctorUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=False)
    specialty = serializers.CharField(
        max_length=200, required=False, allow_blank=True, allow_null=True
    )


# --- Blocos de horário (AC2) ---------------------------------------------------


class TimeBlockSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeBlock
        fields = ["id", "name", "display_order", "active"]


class TimeBlockCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    display_order = serializers.IntegerField(
        required=False, min_value=0, max_value=_MAX_DISPLAY_ORDER
    )


class TimeBlockUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=False)
    display_order = serializers.IntegerField(
        required=False, min_value=0, max_value=_MAX_DISPLAY_ORDER
    )
    active = serializers.BooleanField(required=False)


# --- Versões (saída) -----------------------------------------------------------


class MedicationSubstanceVersionSerializer(serializers.ModelSerializer):
    """Saída de uma versão de substância vigente/criada (eixo substância)."""

    class Meta:
        model = MedicationSubstanceVersion
        fields = [
            "id", "medication", "substance_name", "laboratory",
            "prescribed_by", "effective_from",
        ]


class MedicationScheduleVersionSerializer(serializers.ModelSerializer):
    """Saída de uma versão de agenda vigente/criada (eixo agenda). ``dose`` é o array
    tipado; ``time_block_name`` acompanha para a tela renderizar sem uma query extra."""

    dose = DoseField()
    time_block_name = serializers.CharField(source="time_block.name", read_only=True)

    class Meta:
        model = MedicationScheduleVersion
        fields = [
            "id", "medication", "time_block", "time_block_name",
            "dose", "active", "effective_from",
        ]


# --- Medicamento (saída: slot + estado vigente anotado) ------------------------


class MedicationSerializer(serializers.ModelSerializer):
    """Medicamento + estado vigente hoje (anotado pela camada de serviço).

    ``active`` é **derivado** (``medications`` não tem coluna ``active``, AC5):
    ``obj.derived_active`` vem do serviço. ``substance`` = versão de substância vigente
    (ou null); ``schedules`` = versões de agenda vigentes por bloco ativo."""

    active = serializers.BooleanField(source="derived_active", read_only=True)
    substance = MedicationSubstanceVersionSerializer(
        source="current_substance", read_only=True, allow_null=True
    )
    schedules = MedicationScheduleVersionSerializer(
        source="current_schedules", many=True, read_only=True
    )

    class Meta:
        model = Medication
        fields = ["id", "title", "active", "substance", "schedules"]


# --- Medicamento (entrada) -----------------------------------------------------


class MedicationCreateSerializer(serializers.Serializer):
    """Entrada de criação (AC1): slot ``title`` + primeira versão de substância.

    A agenda por bloco é definida em passo separado (``set_schedule``), espelhando as
    ACs ("cadastra um medicamento" vs. "define a agenda de doses"; Decisão 2)."""

    title = serializers.CharField(max_length=200)
    substance_name = serializers.CharField(max_length=200)
    laboratory = serializers.CharField(
        max_length=200, required=False, allow_blank=True, allow_null=True
    )
    prescribed_by_id = serializers.UUIDField(required=False, allow_null=True)


class MedicationUpdateSerializer(serializers.Serializer):
    """Entrada de edição do slot (AC7): só ``title`` (identidade, não versionada)."""

    title = serializers.CharField(max_length=200)


class SubstanceVersionCreateSerializer(serializers.Serializer):
    """Entrada de nova versão de substância (AC4). Todos opcionais — os não informados
    são **herdados** da versão vigente na camada de serviço."""

    substance_name = serializers.CharField(max_length=200, required=False)
    laboratory = serializers.CharField(
        max_length=200, required=False, allow_blank=True, allow_null=True
    )
    prescribed_by_id = serializers.UUIDField(required=False, allow_null=True)


class ScheduleVersionCreateSerializer(serializers.Serializer):
    """Entrada de nova versão de agenda (AC3/AC5): ``time_block_id`` + ``dose`` +
    ``active``. Só valida **forma** (``dose`` é uma lista quando informada); o conteúdo
    (amount numérico, unit não-vazia, lista não-vazia) é validado na camada de serviço
    (``_validate_dose``, §6.4). ``dose`` omitida → herda a vigente (permite
    desativar/reativar sem reenviar a dose)."""

    time_block_id = serializers.UUIDField()
    dose = DoseField(required=False)
    active = serializers.BooleanField(required=False, default=True)

    def validate_dose(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("A dose deve ser uma lista de componentes.")
        return value


# --- Camada realizada por dia (Story 8.2, AD-07 itens 7-11) --------------------
# Read-model montado pela camada de serviço (dicts, não models): plano `Serializer`
# com fields explícitos. `dose_at_time` reusa `DoseField` (array tipado); `source`
# reusa o `SourceEnum` (pinado em ENUM_NAME_OVERRIDES). `status` do bloco é `CharField`
# (NÃO ChoiceField) de propósito — é DERIVADO (AC6), e um ChoiceField emitiria um enum
# novo e instável no contrato (mesma decisão do `HabitChange.field`).


class MedicationDayEntrySerializer(serializers.Serializer):
    """Uma linha realizada do dia (``scheduled`` ou ``ad_hoc``). ``substanceName`` é
    derivado da versão de substância vigente no dia; ``confirmedAt`` nulo = não
    confirmado; ``timeBlockId`` nulo = avulso sem bloco (AC4/AC7)."""

    id = serializers.UUIDField()
    medication_id = serializers.UUIDField()
    medication_title = serializers.CharField()
    substance_name = serializers.CharField(allow_null=True)
    dose_at_time = DoseField()
    confirmed_at = serializers.DateTimeField(allow_null=True)
    source = serializers.ChoiceField(choices=Source.choices)
    time_block_id = serializers.UUIDField(allow_null=True)


class MedicationDayBlockSerializer(serializers.Serializer):
    """Um Medication Block do dia: cabeçalho (nome + estado derivado) + suas linhas
    ``scheduled`` (AC5/AC6)."""

    time_block_id = serializers.UUIDField()
    time_block_name = serializers.CharField()
    status = serializers.CharField()  # DERIVADO (AC6): confirmed/partial/pending
    entries = MedicationDayEntrySerializer(many=True)


class MedicationDaySerializer(serializers.Serializer):
    """Payload da superfície diária: blocos agendados + seção avulso/PRN (AC4/AC7)."""

    date = serializers.DateField()
    blocks = MedicationDayBlockSerializer(many=True)
    ad_hoc = MedicationDayEntrySerializer(many=True)


class EntryConfirmSerializer(serializers.Serializer):
    """PATCH de uma linha: corrigir a confirmação e/ou a dose (AC4/AC5/AC6).

    Aditivo sobre a 8.2 (que só tinha ``confirmed``): ganha ``dose`` opcional (correção
    retroativa da dose, AC6) e ``confirmed`` passa a ser opcional — mas **ao menos um**
    deve vir. O guard "ambos ausentes" mora no ``validate()`` e levanta
    ``ValidationError`` → **400** (não ``DomainError``/409). O conteúdo da ``dose``
    (amount numérico, unit não-vazia, lista não-vazia) é validado na camada de serviço
    (``_validate_dose``, §6.4); aqui só a **forma** (é uma lista quando informada). O nome
    da classe é mantido (contrato aditivo, sem renomear o componente do schema)."""

    confirmed = serializers.BooleanField(required=False)
    dose = DoseField(required=False)

    def validate_dose(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("A dose deve ser uma lista de componentes.")
        return value

    def validate(self, attrs):
        if "confirmed" not in attrs and "dose" not in attrs:
            raise serializers.ValidationError(
                "Informe ao menos um campo para atualizar (confirmed ou dose)."
            )
        return attrs


class BlockConfirmSerializer(serializers.Serializer):
    """POST de confirmação em lote de um bloco no dia (AC4)."""

    date = serializers.DateField()
    time_block_id = serializers.UUIDField()
    confirmed = serializers.BooleanField()


class AdHocCreateSerializer(serializers.Serializer):
    """POST de registro de avulso/PRN (AC7). ``time_block_id``/``dose`` opcionais:
    ``dose`` omitida herda da agenda vigente (se houver bloco), senão o serviço exige
    (``DomainError`` → 409). Só valida **forma** (``dose`` é lista quando informada); o
    conteúdo é validado no serviço (``_validate_dose``, §6.4)."""

    date = serializers.DateField()
    medication_id = serializers.UUIDField()
    time_block_id = serializers.UUIDField(required=False, allow_null=True)
    dose = DoseField(required=False)

    def validate_dose(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("A dose deve ser uma lista de componentes.")
        return value
