"""Serializers do Sistema de Hábitos (§6.3): split leitura/escrita, view fina.

Saída = ``ModelSerializer`` com ``fields`` explícito (nunca ``"__all__"``). Entrada =
``Serializer`` plano com ``validate``. O wire é camelCase (``djangorestframework-camel-case``);
os campos ficam snake_case aqui e são convertidos na borda.

``HabitSerializer`` expõe a **versão vigente hoje** anexada em ``obj.current_version``
pela camada de serviço.
"""

from rest_framework import serializers

from habits.models import DayType, Habit, HabitDayEntry, HabitGroup, HabitVersion


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
            "id", "name", "emoticon", "group", "type", "unit",
            "weight", "active", "meta", "bonus", "effective_from",
        ]


class HabitCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    emoticon = serializers.CharField(max_length=16, required=False, allow_blank=True, default="")
    unit = serializers.CharField(max_length=32, required=False, allow_blank=True, default="")
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
    unit = serializers.CharField(max_length=32, required=False, allow_blank=True)
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


# --- Snapshot realizado do dia (Story 6.2) ------------------------------------


class HabitDayEntrySerializer(serializers.ModelSerializer):
    """Uma linha do tracker do dia: identidade do hábito + snapshot congelado.

    Expõe a identidade do hábito (``name``/``emoticon``/``type``/``group``/``unit``)
    junto do estado do dia (``value``/``*_at_time``). ``type`` reusa ``HabitTypeEnum``
    via ``ChoiceField`` (mesmo override de enum da 6.1).
    """

    habit_id = serializers.UUIDField(source="habit.id", read_only=True)
    name = serializers.CharField(source="habit.name", read_only=True)
    emoticon = serializers.CharField(source="habit.emoticon", read_only=True)
    unit = serializers.CharField(source="habit.unit", read_only=True)
    type = serializers.ChoiceField(
        choices=Habit.Type.choices, source="habit.type", read_only=True
    )
    group = serializers.UUIDField(source="habit.group_id", read_only=True)
    # Camada de ritmo (6.3): tipo de dia + multiplicador congelados (read).
    day_type = serializers.ChoiceField(choices=DayType.choices, read_only=True)

    class Meta:
        model = HabitDayEntry
        fields = [
            "id", "habit_id", "name", "emoticon", "type", "group", "unit",
            "value", "weight_at_time", "meta_at_time", "bonus_at_time",
            "day_type", "multiplier_at_time",
        ]


class HabitDayGroupSerializer(serializers.Serializer):
    """Cabeçalho de grupo do tracker: nome + % ponderado do grupo."""

    id = serializers.UUIDField()
    name = serializers.CharField()
    completion = serializers.IntegerField()


class HabitDaySerializer(serializers.Serializer):
    """Payload do tracker do dia: % total, % por grupo, tipo do dia e as linhas."""

    date = serializers.DateField()
    total_completion = serializers.IntegerField()
    # Tipo do dia (nível-dia, para o toggle de feriado / legenda). Mesmos 3 valores
    # de HabitDayEntry.day_type → mesmo DayTypeEnum (sem colisão).
    day_type = serializers.ChoiceField(choices=DayType.choices)
    groups = HabitDayGroupSerializer(many=True)
    entries = HabitDayEntrySerializer(many=True)


class HabitDayEntryUpdateSerializer(serializers.Serializer):
    """PATCH de uma linha: marcar/desmarcar ``value`` e/ou correção avulsa.

    ``value`` ``allow_null`` (desmarcar booleano → None). ``weightAtTime``/
    ``metaAtTime``/``bonusAtTime`` opcionais (correção de dia passado). ``habit``/
    ``date`` são identidade imutável do snapshot — enviá-los é rejeitado (400).
    """

    _IMMUTABLE = ("habit", "habit_id", "date")

    value = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, allow_null=True
    )
    weight_at_time = serializers.DecimalField(
        max_digits=6, decimal_places=2, required=False
    )
    meta_at_time = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, allow_null=True
    )
    bonus_at_time = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, allow_null=True
    )
    # Override avulso do multiplicador de uma linha ("nesse sábado eu trabalhei",
    # Story 6.3). Sem allow_null: default é 1.0, não há caso de "desmarcar".
    multiplier_at_time = serializers.DecimalField(
        max_digits=4, decimal_places=2, required=False
    )

    def validate(self, attrs):
        offending = [f for f in self._IMMUTABLE if f in self.initial_data]
        if offending:
            raise serializers.ValidationError(
                {offending[0]: "Campo imutável do snapshot; não pode ser alterado."}
            )
        return attrs


# --- Config de multiplicador por grupo × tipo de dia + feriado (Story 6.3) ----


class GroupMultipliersSerializer(serializers.Serializer):
    """Config vigente do grupo (read): chaves nomeadas ``weekend``/``holiday``.

    Sem enum ``day_type`` no wire (evita colisão de ``DayTypeEnum`` — ver Dev Notes
    da story). ``weekday`` nunca aparece (= 1.0 implícito).
    """

    weekend = serializers.DecimalField(max_digits=4, decimal_places=2)
    holiday = serializers.DecimalField(max_digits=4, decimal_places=2)


class SetGroupMultipliersSerializer(serializers.Serializer):
    """Escrita prospectiva da config (write). Só as chaves enviadas (não-null) são
    aplicadas; ambas opcionais."""

    weekend = serializers.DecimalField(
        max_digits=4, decimal_places=2, required=False, allow_null=True
    )
    holiday = serializers.DecimalField(
        max_digits=4, decimal_places=2, required=False, allow_null=True
    )

    def validate(self, attrs):
        if attrs.get("weekend") is None and attrs.get("holiday") is None:
            raise serializers.ValidationError(
                "Informe ao menos um multiplicador (weekend e/ou holiday)."
            )
        return attrs


class SetHolidaySerializer(serializers.Serializer):
    """Marca/desmarca um dia como feriado por data (write)."""

    date = serializers.DateField()
    is_holiday = serializers.BooleanField()


class HolidayResultSerializer(serializers.Serializer):
    """Resultado do toggle de feriado: a data + o tipo de dia re-resolvido."""

    date = serializers.DateField()
    day_type = serializers.ChoiceField(choices=DayType.choices)
