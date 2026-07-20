"""Serializers do Diário de Gratidão (§6.3): split leitura/escrita, view fina.

Saída = ``ModelSerializer`` com ``fields`` **explícito** (nunca ``"__all__"``; ``user_id``
omitido). Entrada = ``Serializer`` plano. O wire é camelCase
(``djangorestframework-camel-case``): ``created_at`` sai como ``createdAt`` na borda.
Gratidão **não** tem JSONB de chave dinâmica → nada de ``ignore_fields``.
"""

from rest_framework import serializers

from gratitude.models import GratitudeEntry


class GratitudeEntrySerializer(serializers.ModelSerializer):
    """Saída de uma entrada (leitura). ``created_at`` (ISO timestamptz) → ``createdAt``
    na borda; a hora é derivada dele no frontend."""

    class Meta:
        model = GratitudeEntry
        fields = ["id", "date", "text", "created_at"]


class GratitudeDaySerializer(serializers.Serializer):
    """Read-model da data (AC3): a data + a lista de entradas daquela data."""

    date = serializers.DateField()
    entries = GratitudeEntrySerializer(many=True)


class GratitudeEntryWriteSerializer(serializers.Serializer):
    """Entrada de criação (AC1/AC4). Só valida **forma**: ``text`` não-branco
    (``trim_whitespace`` → texto só-espaços vira vazio → ``allow_blank=False`` → 400);
    ``date`` opcional (ausente → o servidor resolve para ``today_for(user)``, AD-04)."""

    text = serializers.CharField(allow_blank=False, trim_whitespace=True)
    date = serializers.DateField(required=False)
