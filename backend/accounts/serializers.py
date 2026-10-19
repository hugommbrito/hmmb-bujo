from zoneinfo import available_timezones

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from accounts.models import User

_VALID_TIMEZONES = available_timezones()


class SignupSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    timezone = serializers.CharField(max_length=64, default="America/Sao_Paulo")

    def validate_email(self, value):
        normalized = value.lower()
        if User.objects.filter(email=normalized).exists():
            raise serializers.ValidationError("Este email já está em uso.")
        return normalized

    def validate_timezone(self, value):
        if value not in _VALID_TIMEZONES:
            raise serializers.ValidationError(
                "Fuso horário inválido. Use um timezone IANA válido (ex: 'America/Sao_Paulo')."
            )
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            timezone=validated_data.get("timezone", "America/Sao_Paulo"),
        )


# --- Dia "não registrado" por collection (Story 16.2c) -------------------------
# Contrato ÚNICO dos dois endpoints (`/api/habits/untracked-days/` e
# `/api/medications/untracked-days/`): `{date, untracked}` na entrada e na saída.
# `collection` fica FORA do wire (cada view fixa a sua) — nenhum enum novo no schema.


class SetUntrackedDaySerializer(serializers.Serializer):
    """Marca/desmarca um dia como não registrado (write). ``date`` ≤ hoje do
    usuário (a regra mora em ``accounts.services.set_untracked_day``)."""

    date = serializers.DateField()
    untracked = serializers.BooleanField()


class UntrackedDayResultSerializer(serializers.Serializer):
    """Resultado do toggle: a data + o estado efetivo após a escrita."""

    date = serializers.DateField()
    untracked = serializers.BooleanField()
